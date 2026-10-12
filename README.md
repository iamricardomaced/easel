# Easel

A browser design editor for social posts, decks and print: React + TypeScript + Vite front end, Express + SQLite (Node's built-in `node:sqlite`) back end.

## Run it

```bash
npm install          # root (concurrently)
npm run install:all  # server + client deps
npm run dev          # API on :3001, editor on http://localhost:5173
```

Production: `npm run build && npm start` serves the built client and API from http://localhost:3001.
Data lives in `server/data/` (SQLite database and uploaded files). Set `PORT` or `DATA_DIR` to change them.

Requires Node 22.5+ (for `node:sqlite`). Built and tested on Node 24.

## Features

**Home**: sign up / log in, size presets (social, video, presentation, print), custom size in px/mm/in, template gallery, recent designs with thumbnails, search, star, rename, duplicate, trash and restore, folders (drag designs onto a folder), "Shared with you".

**Editor**
- Multi-page canvas with zoom (⌘/Ctrl + wheel, slider, fit), space-drag panning, page add/duplicate/delete/reorder, page titles, speaker notes.
- Elements: text, 11 shapes (with text inside), lines and arrows, ~1,900 searchable icons, images, image frames, freehand pen and highlighter (with eraser), tables, bar/line/pie/donut charts, QR codes.
- Selection: click, shift-click, marquee; move with snapping guides to page and element edges and centres (hold ⌥ to skip); resize from 8 handles with rotation-aware math; rotate with 45° snapping (⇧ for 15°); groups; lock; layers panel with drag to reorder.
- Text: inline editing, 30 Google Fonts, size, colour, bold/italic/underline/strike/uppercase, alignment, bullet and numbered lists, letter spacing, line height, effects (lift, hollow, outline, neon, background).
- Images: drag from Photos or Uploads, drop files from the desktop, paste from the clipboard, drop onto an image to replace it, crop mode (double-click), side handles crop instead of stretching, filter presets and adjustments, flip, frames (circle, heart, star, hexagon, triangle), rounded corners, border, set as page background.
- Fills: solid colours, document colours, brand colours, linear gradients, eyedropper.
- Arrange: align to page or selection, distribute, layer order, precise X/Y/W/H/rotation, opacity, drop shadow.
- Templates: 10 built-in, scaled to the current design size; replace the page or append pages.
- Brand kit: colours and heading/body fonts saved per account.
- Undo/redo (100 steps), copy/cut/paste/duplicate, context menu, keyboard shortcuts (File → Keyboard shortcuts).
- Resize & Magic Switch: resize in place, or copy into several sizes at once, with content scaled to fit.
- Autosave with status indicator; thumbnails regenerate in the background.
- Text extras: curved text, Shadow/Echo/Splice/Glitch effects with an effect colour, copy style (paint roller), find and replace (⌘F).
- Elements extras: photo grids, emoji, links on any element (URL or `#3` for page 3), background remover for photos on a plain background.
- Styles panel: colour palettes (click again to shuffle) and font sets for the page or the whole design. Apps → Bulk create fills `{{Field}}` placeholders from CSV, one page per row.
- Pages: grid view with drag to reorder, hide pages (skipped when presenting and downloading), rulers and draggable guides that elements snap to (⇧R).

**Video and audio**
- Video elements from uploads (MP4, WebM, MOV) with trim, volume, mute, loop, frames and inline playback. A page with a clip lasts as long as the clip.
- Record yourself: camera, screen, or screen with a round camera bubble, plus microphone; countdown, pause/resume, 15-minute limit, discard or save into the design.
- Timeline: page durations (drag the edge of a page), transitions between pages (dissolve, slide, push, wipe, zoom, circle wipe, flip), audio tracks you can move, fade, trim and loop, and playback in the editor.
- Audio library of six music tracks synthesised in the browser, plus audio uploads.
- 11 entrance animations with an optional exit animation, shared by the editor preview, Present, playback and exports.

**Collaboration**
- Invite people by email to edit, comment or view. Everyone with the design open sees saved changes live (Server-Sent Events), avatars of who is here and outlines of what they have selected; simultaneous edits to different elements merge.
- Comments pinned to elements or pages, with replies, resolve and badges on the canvas.
- Version history: automatic snapshots every ten minutes, named versions, preview and restore.

**Output**: download PNG (up to 4×, optional transparent background), JPG, SVG, multi-page PDF, MP4 video (480p to 4K, with animations, transitions, video clips and mixed audio, encoded in the browser with WebCodecs) or GIF; present full screen with animations, transitions, video and music, clickable links and autoplay; share a read-only link or a "use as template" link that copies the design into the viewer's account.

## How this was informed by REA

The design was informed by running [REA](https://github.com/iamricardomacedo/rea) (`analyze-javascript-application`) on the local Canva desktop app (`/Applications/Canva.app/Contents/Resources/app.asar`):

- 807 files, 751 parsed JavaScript files, 983 modules, no parse failures.
- The app is a thin Electron shell: its renderer bundle is `dist/renderer/desktop_chrome_v2` (tab and window chrome), and `dist/main.js` hosts `www.canva.com` in `WebContentsView`s (31 references, 11 `loadURL` calls). REA found no preload context-bridge APIs or IPC channels.
- The bundle also ships `dist/renderer/desktop_recording` (mission control, overlay, talking-head and display-picker windows). Its English strings describe the recording flow: camera, microphone and screen sources, a "Starts in 3" countdown, pause/resume, a minute limit, "Save and upload" and a cancel confirmation. Easel's Record yourself dialog follows that flow.
- So the editor itself is Canva's web app, which is not in the desktop bundle. This project is an independent implementation of the editor behaviour visible in the product (DOM-rendered pages of absolutely positioned elements, contextual toolbar, side panels, multi-page documents). No Canva code or assets are used.

The raw REA output is not committed (it is 64 MB); rerun it with `node <rea>/scripts/rea.mjs analyze-javascript-application <path-to-app.asar> --json`.

## Layout

```
server/index.js          API: auth (scrypt + session cookie), designs, members and roles, live events (SSE),
                         comments, versions, folders, uploads (images, video, audio), sharing, brand kit
client/src/types.ts      Document model (DesignDoc → pages → elements)
client/src/store/        Zustand stores: editor (doc, selection, history), auth, brand kit
client/src/editor/       Canvas, ElementView (renderer), Toolbar, Sidebar, TopBar, Present
client/src/lib/          geometry (resize/snap), shapes, templates, export, factories, motion (animation and
                         timeline model), video (MP4/GIF encoder), media (music synth), live + merge (collaboration)
client/src/pages/        Home, Editor, Auth, Shared
```

## Known limits

- Collaboration syncs on each autosave (about a second), not keystroke by keystroke, and undo history is per person. Two people changing the same element at the same moment: the later save wins.
- Invites only reach people who already have an Easel account; no emails are sent.
- Photos come from Lorem Picsum (no keyword search; the query only changes the seed). There is no stock video library; the music library is synthesised.
- No AI features (Magic Write, Magic Media, translate): they need an AI provider and an API key.
- The background remover handles plain backgrounds, not busy scenes.
- Multi-selection can be resized but not rotated as a group.
- MP4 needs a browser with WebCodecs H.264 (recent Chrome, Edge, Safari); others fall back to WebM.
