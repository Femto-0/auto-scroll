# Auto Scroll

Auto Scroll is an Obsidian plugin that keeps the active editor moving while you write and navigate. It can scroll when the text cursor reaches a configured point while typing, when you press the Down arrow, or when the mouse pointer moves into a configured edge zone.

## Settings

- Enable auto-scroll: turns the behavior on or off.
- Scroll while typing: scrolls when the text cursor reaches the configured trigger point after typing.
- Scroll on Down arrow: moves the viewport every time the Down arrow is pressed.
- Down arrow scroll amount: controls how many pixels the viewport moves per Down arrow press.
- Scroll with mouse near bottom: scrolls downward when the mouse pointer reaches the lower trigger zone.
- Scroll with mouse near top: scrolls upward when the mouse pointer reaches the upper trigger zone.
- Trigger point: the viewport percentage where scrolling begins. The default is 80%. For mouse scrolling, this means the bottom 20% scrolls down and the top 20% scrolls up when both mouse directions are enabled.
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
