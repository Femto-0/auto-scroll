# Auto Scroll

Auto Scroll is an Obsidian plugin that keeps the active editor moving while you write and navigate. Cursor navigation includes Vim motions: after a motion, the plugin keeps the cursor inside the configured viewport band. It can also scroll while typing, take fixed steps on either arrow key, and follow the mouse at configured edge zones.

## Settings

- Enable auto-scroll: turns the behavior on or off.
- Scroll while typing: scrolls when the text cursor reaches the configured trigger point after typing.
- Keep cursor visible during navigation: follows selection changes from keyboard movement and Vim motions, scrolling only when the cursor leaves the viewport band.
- Scroll on Down arrow / Scroll on Up arrow: add a fixed viewport step for each respective arrow press.
- Up and Down arrow scroll amounts: control the pixel step for each direction.
- Scroll with mouse near bottom: scrolls downward when the mouse pointer reaches the lower trigger zone.
- Scroll with mouse near top: scrolls upward when the mouse pointer reaches the upper trigger zone.
- Trigger point: the lower edge of the cursor's visible band; the upper edge mirrors it. The default is 80%. For mouse scrolling, this means the bottom 20% scrolls down and the top 20% scrolls up when both mouse directions are enabled.
- Maximum scroll step: caps how many pixels the plugin scrolls per trigger.
- Scroll cooldown: sets the minimum time between automatic scrolls.
- Only near document bottom: requires the editor to be near the configured document depth before scrolling.
- Document depth: controls where the near-bottom requirement becomes active.
- Smooth scrolling: animates each scroll movement.

## Commands

- Toggle auto-scroll: quickly enables or disables the plugin from the command palette.

## Development

Install dependencies:

```bash
npm install
```

Build the plugin:

```bash
npm run build
```

For watch mode during development:

```bash
npm run dev
```
