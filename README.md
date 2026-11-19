# Neon Coast Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Anggizx90/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Anggizx90/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline web app that turns your photo and a caption into GTA 6-style cover
art — the multi-panel poster look with bold lettering and a Vice City sunset or
neon grade — and exports it as a PNG to share. Built for the
[make.fun gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01?ref=ymjg9sbn)
($250, top 50 paid).

Everything is original: no Rockstar logo, artwork or fonts. The lettering is
Anton and Pacifico, vendored under the SIL Open Font License
(`app/fonts/OFL-*.txt`). The three sample photos were made with an image model.

## What it does

- **6 layouts, one click each** — 9-panel cover grid, hero-and-three, full-bleed,
  tilted snapshot collage, diagonal split, poster strip. Each re-renders instantly.
- **7 gradient-map colour grades** — Vice Sunset, Neon Night, Palm Gold,
  Teal/Pink duotone, Noir, Faded Film, Candy Pop — plus an intensity slider.
  Grades are applied on canvas (luminance lookup tables + tint overlays), so the
  exported PNG carries exactly the grade the preview shows.
- **Any photo** — upload 1+ photos (FileReader, they never leave your machine),
  click a panel to select it, drag to position its photo, scroll to zoom, or use
  the sliders. One photo can fill several panels with different crops; click a
  thumbnail to put a different photo in the selected panel.
- **Caption editing** — title and subtitle fields with live update, title size,
  letter-spacing and outline controls. The title is set in a halftone title block
  in Anton; the subtitle is a neon Pacifico script, under a "Neon Coast" badge
  ribbon.
- **Effects** — film grain, vignette, halftone dots on the title block, inked
  panel borders, and palm silhouettes drawn in canvas.
- **Export** — real PNGs at exactly 1080×1080, 1080×1350 and 1920×1080, one button
  per size or "Export all three".
- **Polish** — undo/redo (Ctrl+Z / Ctrl+Shift+Z and buttons), four one-click
  preset covers (Sunset Heist, Boulevard Queen, Pier Pressure, Night Shift),
  three built-in sample photos so the app is demonstrable with no upload.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network requests, every
script, font and image is a file under `app/`.

Photo → PNG in a few clicks: pick a sample photo (or upload your own), pick a
layout and a grade, type your caption, hit **Export all three**.

## Screenshots

- `screenshots/1-cover.jpg` — a finished 1920×1080 cover (9-panel grid, Vice Sunset)
- `screenshots/2-editor.jpg` — the editor with a photo loaded
- `screenshots/3-cover.jpg` — a finished 1080×1350 portrait cover (full-bleed, Teal/Pink)
- `screenshots/4-cover-story.jpg` — a finished 1920×1080 cover (tilted snaps, Neon Night)

Fixed screenshot scenes live in `shots.json` (`?shot=cover` shows a finished
cover alone, `?shot=editor` shows the editor with a sample photo loaded).

## How it is built

- `app/src/cover-renderer.js` — draws the whole cover: panels, title block,
  badge ribbon, palms, grain, vignette
- `app/src/grades.js` — the seven gradient-map grades and their lookup tables
- `app/src/layouts.js` — the six panel layouts and the title-block geometry
- `app/src/editor.js` — state, undo/redo history, photo loading, panel picking
  and dragging, control wiring
- `app/src/export-png.js` — exact-size PNG export via `canvas.toBlob`
- `app/src/shots.js` — fixed `?shot=` scenes for screenshots
- `app/src/main.js` — boot: fonts, editor, shot scenes
- `main.ts` — the make.fun program: copies `app/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with `buildDossier`

## License

MIT — see [LICENSE](LICENSE).
