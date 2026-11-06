# Himayat Portfolio

A portfolio told as a story. The page stays fixed like the opening of a film or game, and scrolling plays it forward: a short "based on a true story" opening, then eight chapters from Kashmir to Dubai, ending with contact details.

## Run
Open `index.html` in a browser. No install or build step. VS Code Live Server works too.

## Files
- `index.html` — every chapter and the full résumé.
- `style.css` — colours (in `:root`), typography, scenes and the résumé sheet.
- `script.js` — the story engine.

## How the story works
Each chapter is a `<section class="scene">`:
- `data-chapter` / `data-title` — label shown at the top and on the timeline.
- `data-len` — how much scrolling the chapter takes, in screen heights.
- `data-tone` — background glow colour: `lime`, `blue` or `amber`.

Inside a chapter, elements react to how far through it the reader is (0 to 1):
- `data-in=".3"` — appears at 30% and hides again when scrolling back.
- `class="scrub" data-from=".1" data-to=".6"` — words light up one by one.
- `data-count="88" data-from=".05" data-to=".45"` — the number counts up.
- `data-fill=".2,.7"` — sets the CSS variable `--f` from 0 to 1, used for drawn lines.

To add a chapter, copy a `<section class="scene">` block and change the text and numbers. The timeline dots are built automatically.

## Always reachable
- **Résumé** (top right) opens the full résumé at any point in the story.
- **Skip story** jumps to the contact chapter; the timeline dots jump to any chapter. Page Up / Page Down move one chapter.
- With "reduce motion" switched on, or without JavaScript, the chapters show as a normal scrolling page with the résumé at the end.

Google Fonts (DM Sans, DM Serif Display) need an internet connection; system fonts are the fallback.

## Host
Upload `index.html`, `style.css` and `script.js` to any static host (GitHub Pages works).
