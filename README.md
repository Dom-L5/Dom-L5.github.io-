# Domenic Landriscina — portfolio

Live site: https://dom-l5.github.io

## How to change the words

1. Open `index.html` in this repository and press the pencil icon (Edit).
2. Search the page for **EDIT HERE**. Each project has its own labelled section.
3. Change only the words between the tags, for example:
   `<h2>A window blind that opens itself in the morning</h2>`
   Keep the `<` `>` parts as they are.
4. Press **Commit changes**. The live site updates in about a minute.

Useful patterns:

- A bullet point is one line: `<li>Your sentence here.</li>`. Copy a line to add one, delete a line to remove one.
- A link is `<a href="https://address">Text people see</a>`.
- If something breaks, open the file's **History**, pick the last good version, and restore it.

## The opening scene

The opening is pixel art drawn live by `js/hero.js`: the blind, the lamp, the campus and the workshop.
It reads its words from `index.html`, so you still edit them there:

- Your name and the line under it: the **OPENING SCREEN** section.
- The tags under the projects on the workbench: the `data-label="..."` values in the same section.
- The sign-off on the last screen: the heading in the **ENDING** section.

They are drawn in capitals and can use letters, numbers and `. , : - ' ! ?`.

## Branches

- `main` is the live site.
- `base-v1` is the site as it was before the pixel-art opening. To go back, restore `index.html`, `js/hero.js` and `js/main.js` from that branch.

## What's where

| File | What it is |
|---|---|
| `index.html` | All the words and the page layout |
| `assets/` | Photos and videos |
| `js/` | The pixel-art opening (`hero.js`), the blind drive drawing and the robot model |
| `vendor/` | three.js, the 3D library |
