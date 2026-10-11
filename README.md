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

**Home**: sign up / log in, size presets (social, video, presentation, print), custom size in px/mm/in, template gallery, recent designs with thumbnails, search, star, rename, duplicate, trash and restore.

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
- Resize design, or "Copy & resize" into a new design, with content scaled to fit.
- Autosave with status indicator; thumbnails regenerate in the background.

**Output**: download PNG (up to 4×, optional transparent background), JPG, SVG or multi-page PDF; present full screen with element animations (fade, rise, pan, pop, wipe) and autoplay; share a read-only link or a "use as template" link that copies the design into the viewer's account.

## How this was informed by REA

The design was informed by running [REA](https://github.com/iamricardomacedo/rea) (`analyze-javascript-application`) on the local Canva desktop app (`/Applications/Canva.app/Contents/Resources/app.asar`):

- 807 files, 751 parsed JavaScript files, 983 modules, no parse failures.
- The app is a thin Electron shell: its renderer bundle is `dist/renderer/desktop_chrome_v2` (tab and window chrome), and `dist/main.js` hosts `www.canva.com` in `WebContentsView`s (31 references, 11 `loadURL` calls). REA found no preload context-bridge APIs or IPC channels.
- So the editor itself is Canva's web app, which is not in the desktop bundle. This project is an independent implementation of the editor behaviour visible in the product (DOM-rendered pages of absolutely positioned elements, contextual toolbar, side panels, multi-page documents). No Canva code or assets are used.

The raw REA output is not committed (it is 64 MB); rerun it with `node <rea>/scripts/rea.mjs analyze-javascript-application <path-to-app.asar> --json`.

## Layout

```
server/index.js          API: auth (scrypt + session cookie), designs, uploads, sharing, brand kit
client/src/types.ts      Document model (DesignDoc → pages → elements)
client/src/store/        Zustand stores: editor (doc, selection, history), auth, brand kit
client/src/editor/       Canvas, ElementView (renderer), Toolbar, Sidebar, TopBar, Present
client/src/lib/          geometry (resize/snap), shapes, templates, export, factories
client/src/pages/        Home, Editor, Auth, Shared
```

## Known limits

- One editor per design at a time; there is no real-time co-editing or comments.
- Photos come from Lorem Picsum (no keyword search; the query only changes the seed).
- No video, audio or GIF animation export; animations play only in Present mode.
- Multi-selection can be resized but not rotated as a group.
