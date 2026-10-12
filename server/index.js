'use strict';
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS designs (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    doc TEXT NOT NULL,
    thumbnail TEXT,
    starred INTEGER NOT NULL DEFAULT 0,
    trashed_at INTEGER,
    share_token TEXT UNIQUE,
    share_mode TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    name TEXT,
    doc TEXT NOT NULL,
    thumbnail TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS versions_design ON versions(design_id, created_at);
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page_id TEXT,
    element_id TEXT,
    parent_id TEXT,
    text TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS comments_design ON comments(design_id, created_at);
  CREATE TABLE IF NOT EXISTS brand_kits (
    owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL
  );
`);

// Columns added after the first release.
for (const [table, col, type] of [
  ['uploads', 'kind', "TEXT NOT NULL DEFAULT 'image'"],
  ['uploads', 'duration', 'REAL'],
  ['uploads', 'poster', 'TEXT'],
  ['designs', 'folder_id', 'TEXT'],
]) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
}

const id = () => crypto.randomBytes(9).toString('base64url');
const now = () => Date.now();
const SESSION_MS = 30 * 24 * 3600 * 1000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, now() + SESSION_MS);
  res.cookie('sid', token, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_MS });
}

function currentUser(req) {
  const token = req.cookies.sid;
  if (!token) return null;
  const row = db
    .prepare('SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?')
    .get(token, now());
  return row || null;
}

function auth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  req.user = user;
  next();
}

// ---------- Auth ----------
app.post('/api/auth/signup', (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Email and a password of 6+ characters are required' });
  }
  const normalized = String(email).trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalized)) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const userId = id();
  db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userId, normalized, (name || normalized.split('@')[0]).trim(), hashPassword(password), now(),
  );
  startSession(res, userId);
  res.json(db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId));
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!row || !verifyPassword(String(password || ''), row.password_hash)) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  startSession(res, row.id);
  res.json({ id: row.id, email: row.email, name: row.name });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.cookies.sid) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.cookies.sid);
  res.clearCookie('sid');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  res.json(user);
});

// ---------- Designs ----------
const summaryCols = 'id, title, thumbnail, starred, trashed_at, share_token, share_mode, folder_id, created_at, updated_at';

function shapeDesign(row, includeDoc) {
  if (!row) return row;
  const out = {
    id: row.id,
    title: row.title,
    thumbnail: row.thumbnail,
    starred: !!row.starred,
    trashedAt: row.trashed_at,
    shareToken: row.share_token,
    shareMode: row.share_mode,
    folderId: row.folder_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeDoc) out.doc = JSON.parse(row.doc);
  return out;
}

app.get('/api/designs', auth, (req, res) => {
  const view = req.query.view || 'all';
  let where = 'owner_id = ? AND trashed_at IS NULL';
  if (view === 'starred') where += ' AND starred = 1';
  if (view === 'trash') where = 'owner_id = ? AND trashed_at IS NOT NULL';
  const q = String(req.query.q || '').trim();
  const params = [req.user.id];
  if (req.query.folder) {
    where += ' AND folder_id = ?';
    params.push(String(req.query.folder));
  }
  if (q) {
    where += ' AND title LIKE ?';
    params.push(`%${q}%`);
  }
  const rows = db.prepare(`SELECT ${summaryCols} FROM designs WHERE ${where} ORDER BY updated_at DESC`).all(...params);
  res.json(rows.map((r) => shapeDesign(r, false)));
});

app.post('/api/designs', auth, (req, res) => {
  const { title, doc } = req.body || {};
  if (!doc) return res.status(400).json({ error: 'doc is required' });
  const designId = id();
  const t = now();
  db.prepare('INSERT INTO designs (id, owner_id, title, doc, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    designId, req.user.id, title || 'Untitled design', JSON.stringify(doc), t, t,
  );
  res.json(shapeDesign(db.prepare('SELECT * FROM designs WHERE id = ?').get(designId), true));
});

function ownDesign(req, res) {
  const row = db.prepare('SELECT * FROM designs WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!row) res.status(404).json({ error: 'Design not found' });
  return row;
}

app.get('/api/designs/:id', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (row) res.json(shapeDesign(row, true));
});

app.patch('/api/designs/:id', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (!row) return;
  const b = req.body || {};
  const sets = [];
  const params = [];
  if (b.title !== undefined) { sets.push('title = ?'); params.push(String(b.title).slice(0, 200)); }
  if (b.doc !== undefined) {
    sets.push('doc = ?');
    params.push(JSON.stringify(b.doc));
    snapshot(row, false);
  }
  if (b.folderId !== undefined) { sets.push('folder_id = ?'); params.push(b.folderId || null); }
  if (b.thumbnail !== undefined) { sets.push('thumbnail = ?'); params.push(b.thumbnail); }
  if (b.starred !== undefined) { sets.push('starred = ?'); params.push(b.starred ? 1 : 0); }
  if (b.trashed !== undefined) { sets.push('trashed_at = ?'); params.push(b.trashed ? now() : null); }
  if (!sets.length) return res.json(shapeDesign(row, false));
  sets.push('updated_at = ?');
  params.push(now(), row.id);
  db.prepare(`UPDATE designs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  res.json(shapeDesign(db.prepare(`SELECT ${summaryCols} FROM designs WHERE id = ?`).get(row.id), false));
});

// ---------- Version history ----------
// Before a save overwrites the doc, keep the previous one if the last snapshot is older
// than ten minutes. Named versions are kept forever; automatic ones are capped.
const VERSION_GAP_MS = 10 * 60 * 1000;
function snapshot(row, force, name = null) {
  const last = db.prepare('SELECT created_at FROM versions WHERE design_id = ? ORDER BY created_at DESC LIMIT 1').get(row.id);
  if (!force && last && now() - last.created_at < VERSION_GAP_MS) return null;
  if (!force && row.created_at === row.updated_at && !last) return null; // brand-new design, nothing to keep yet
  const vid = id();
  db.prepare('INSERT INTO versions (id, design_id, title, name, doc, thumbnail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    vid, row.id, row.title, name, row.doc, row.thumbnail, now(),
  );
  db.prepare(`DELETE FROM versions WHERE design_id = ? AND name IS NULL AND id NOT IN
    (SELECT id FROM versions WHERE design_id = ? AND name IS NULL ORDER BY created_at DESC LIMIT 60)`).run(row.id, row.id);
  return vid;
}

app.get('/api/designs/:id/versions', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (!row) return;
  const rows = db.prepare('SELECT id, title, name, thumbnail, created_at FROM versions WHERE design_id = ? ORDER BY created_at DESC').all(row.id);
  res.json(rows.map((r) => ({ id: r.id, title: r.title, name: r.name, thumbnail: r.thumbnail, createdAt: r.created_at })));
});

app.get('/api/designs/:id/versions/:vid', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (!row) return;
  const v = db.prepare('SELECT * FROM versions WHERE id = ? AND design_id = ?').get(req.params.vid, row.id);
  if (!v) return res.status(404).json({ error: 'Version not found' });
  res.json({ id: v.id, title: v.title, name: v.name, createdAt: v.created_at, doc: JSON.parse(v.doc) });
});

// Save the current state as a named version.
app.post('/api/designs/:id/versions', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (!row) return;
  const vid = snapshot(row, true, String(req.body?.name || 'Saved version').slice(0, 80));
  res.json({ id: vid });
});

// Restoring keeps the current state as a version first, so it can be undone.
app.post('/api/designs/:id/versions/:vid/restore', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (!row) return;
  const v = db.prepare('SELECT * FROM versions WHERE id = ? AND design_id = ?').get(req.params.vid, row.id);
  if (!v) return res.status(404).json({ error: 'Version not found' });
  snapshot(row, true, 'Before restoring');
  db.prepare('UPDATE designs SET doc = ?, title = ?, thumbnail = ?, updated_at = ? WHERE id = ?').run(v.doc, v.title, v.thumbnail, now(), row.id);
  res.json(shapeDesign(db.prepare('SELECT * FROM designs WHERE id = ?').get(row.id), true));
});

// ---------- Comments ----------
const shapeComment = (r) => ({
  id: r.id, pageId: r.page_id, elementId: r.element_id, parentId: r.parent_id, text: r.text,
  resolved: !!r.resolved, createdAt: r.created_at, author: { id: r.user_id, name: r.author_name },
});
const commentQuery = 'SELECT c.*, u.name AS author_name FROM comments c JOIN users u ON u.id = c.user_id';

app.get('/api/designs/:id/comments', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (!row) return;
  res.json(db.prepare(`${commentQuery} WHERE c.design_id = ? ORDER BY c.created_at`).all(row.id).map(shapeComment));
});

app.post('/api/designs/:id/comments', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (!row) return;
  const { text, pageId, elementId, parentId } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Write a comment first' });
  const cid = id();
  db.prepare('INSERT INTO comments (id, design_id, user_id, page_id, element_id, parent_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    cid, row.id, req.user.id, pageId || null, elementId || null, parentId || null, String(text).slice(0, 4000), now(),
  );
  res.json(shapeComment(db.prepare(`${commentQuery} WHERE c.id = ?`).get(cid)));
});

function ownComment(req, res) {
  const c = db.prepare('SELECT c.* FROM comments c JOIN designs d ON d.id = c.design_id WHERE c.id = ? AND d.owner_id = ?').get(req.params.cid, req.user.id);
  if (!c) res.status(404).json({ error: 'Comment not found' });
  return c;
}

app.patch('/api/comments/:cid', auth, (req, res) => {
  const c = ownComment(req, res);
  if (!c) return;
  if (req.body?.resolved !== undefined) db.prepare('UPDATE comments SET resolved = ? WHERE id = ? OR parent_id = ?').run(req.body.resolved ? 1 : 0, c.id, c.id);
  if (req.body?.text !== undefined) db.prepare('UPDATE comments SET text = ? WHERE id = ?').run(String(req.body.text).slice(0, 4000), c.id);
  res.json(shapeComment(db.prepare(`${commentQuery} WHERE c.id = ?`).get(c.id)));
});

app.delete('/api/comments/:cid', auth, (req, res) => {
  const c = ownComment(req, res);
  if (!c) return;
  db.prepare('DELETE FROM comments WHERE id = ? OR parent_id = ?').run(c.id, c.id);
  res.json({ ok: true });
});

// ---------- Folders ----------
app.get('/api/folders', auth, (req, res) => {
  const rows = db.prepare(`SELECT f.id, f.name, f.created_at, (SELECT COUNT(*) FROM designs d WHERE d.folder_id = f.id AND d.trashed_at IS NULL) AS count
    FROM folders f WHERE f.owner_id = ? ORDER BY f.name COLLATE NOCASE`).all(req.user.id);
  res.json(rows.map((r) => ({ id: r.id, name: r.name, count: r.count, createdAt: r.created_at })));
});

app.post('/api/folders', auth, (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: 'Name the folder' });
  const fid = id();
  db.prepare('INSERT INTO folders (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)').run(fid, req.user.id, name, now());
  res.json({ id: fid, name, count: 0, createdAt: now() });
});

app.patch('/api/folders/:fid', auth, (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 80);
  const r = db.prepare('UPDATE folders SET name = ? WHERE id = ? AND owner_id = ?').run(name, req.params.fid, req.user.id);
  if (!r.changes || !name) return res.status(404).json({ error: 'Folder not found' });
  res.json({ ok: true });
});

// Deleting a folder keeps its designs; they move back to "All designs".
app.delete('/api/folders/:fid', auth, (req, res) => {
  const r = db.prepare('DELETE FROM folders WHERE id = ? AND owner_id = ?').run(req.params.fid, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Folder not found' });
  db.prepare('UPDATE designs SET folder_id = NULL WHERE folder_id = ? AND owner_id = ?').run(req.params.fid, req.user.id);
  res.json({ ok: true });
});

app.post('/api/designs/:id/duplicate', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (!row) return;
  const designId = id();
  const t = now();
  db.prepare('INSERT INTO designs (id, owner_id, title, doc, thumbnail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    designId, req.user.id, `${row.title} (copy)`, row.doc, row.thumbnail, t, t,
  );
  res.json(shapeDesign(db.prepare(`SELECT ${summaryCols} FROM designs WHERE id = ?`).get(designId), false));
});

app.delete('/api/designs/:id', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (!row) return;
  db.prepare('DELETE FROM designs WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

// Share: mode is 'view' (read-only link) or null (disable). 'template' lets others copy it.
app.post('/api/designs/:id/share', auth, (req, res) => {
  const row = ownDesign(req, res);
  if (!row) return;
  const mode = req.body?.mode;
  if (!mode) {
    db.prepare('UPDATE designs SET share_token = NULL, share_mode = NULL WHERE id = ?').run(row.id);
    return res.json({ shareToken: null, shareMode: null });
  }
  if (!['view', 'template'].includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
  const token = row.share_token || crypto.randomBytes(12).toString('base64url');
  db.prepare('UPDATE designs SET share_token = ?, share_mode = ? WHERE id = ?').run(token, mode, row.id);
  res.json({ shareToken: token, shareMode: mode });
});

app.get('/api/shared/:token', (req, res) => {
  const row = db.prepare('SELECT d.*, u.name AS owner_name FROM designs d JOIN users u ON u.id = d.owner_id WHERE share_token = ?').get(req.params.token);
  if (!row || row.trashed_at) return res.status(404).json({ error: 'This link is no longer active' });
  res.json({ ...shapeDesign(row, true), ownerName: row.owner_name });
});

app.post('/api/shared/:token/copy', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM designs WHERE share_token = ? AND share_mode = ?').get(req.params.token, 'template');
  if (!row) return res.status(404).json({ error: 'This design cannot be copied' });
  const designId = id();
  const t = now();
  db.prepare('INSERT INTO designs (id, owner_id, title, doc, thumbnail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    designId, req.user.id, row.title, row.doc, row.thumbnail, t, t,
  );
  res.json({ id: designId });
});

// ---------- Uploads ----------
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm',
]);
const kindOf = (mime) => (mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'image');
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${id()}${path.extname(file.originalname).toLowerCase().slice(0, 8)}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype.split(';')[0])),
});

const shapeUpload = (r) => ({
  id: r.id, url: `/files/${r.stored_name}`, filename: r.filename, width: r.width, height: r.height,
  kind: r.kind || 'image', duration: r.duration ?? null, poster: r.poster ?? null,
});

app.post('/api/uploads', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload an image (PNG, JPEG, GIF, WebP, SVG), a video (MP4, WebM, MOV) or audio (MP3, WAV, M4A, OGG)' });
  const uploadId = id();
  const width = Number(req.body.width) || null;
  const height = Number(req.body.height) || null;
  const duration = Number(req.body.duration) || null;
  const poster = typeof req.body.poster === 'string' && req.body.poster.startsWith('data:image/') ? req.body.poster.slice(0, 400000) : null;
  const mime = req.file.mimetype.split(';')[0];
  db.prepare('INSERT INTO uploads (id, owner_id, filename, stored_name, mime, width, height, kind, duration, poster, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    uploadId, req.user.id, req.file.originalname, req.file.filename, mime, width, height, kindOf(mime), duration, poster, now(),
  );
  res.json(shapeUpload(db.prepare('SELECT * FROM uploads WHERE id = ?').get(uploadId)));
});

app.get('/api/uploads', auth, (req, res) => {
  const kind = req.query.kind;
  const rows = kind
    ? db.prepare('SELECT * FROM uploads WHERE owner_id = ? AND kind = ? ORDER BY created_at DESC').all(req.user.id, String(kind))
    : db.prepare('SELECT * FROM uploads WHERE owner_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map(shapeUpload));
});

app.delete('/api/uploads/:id', auth, (req, res) => {
  const row = db.prepare('SELECT * FROM uploads WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Upload not found' });
  db.prepare('DELETE FROM uploads WHERE id = ?').run(row.id);
  fs.rm(path.join(UPLOAD_DIR, row.stored_name), { force: true }, () => {});
  res.json({ ok: true });
});

// Uploaded files are referenced from shared designs, so they are served without auth
// behind unguessable names.
app.use('/files', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

// ---------- Brand kit ----------
const DEFAULT_KIT = { colors: ['#FF5C39', '#16181D', '#F3F0EA', '#2F6F6A'], fonts: { heading: 'Space Grotesk', body: 'Inter' } };

app.get('/api/brand-kit', auth, (req, res) => {
  const row = db.prepare('SELECT data FROM brand_kits WHERE owner_id = ?').get(req.user.id);
  res.json(row ? JSON.parse(row.data) : DEFAULT_KIT);
});

app.put('/api/brand-kit', auth, (req, res) => {
  const data = JSON.stringify(req.body || DEFAULT_KIT);
  db.prepare('INSERT INTO brand_kits (owner_id, data) VALUES (?, ?) ON CONFLICT(owner_id) DO UPDATE SET data = excluded.data').run(req.user.id, data);
  res.json(JSON.parse(data));
});

// ---------- Static client (production) ----------
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api|files).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
