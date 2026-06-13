# Auto Scroll

Auto Scroll is an Obsidian plugin that keeps the active editor moving while you type. When the cursor reaches a configured point in the visible editor, the plugin scrolls down so the insertion point stays comfortably above the bottom of the pane.

## Settings

- Enable auto-scroll: turns the behavior on or off.
- Trigger point: the viewport percentage where scrolling begins. The default is 80%.
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
