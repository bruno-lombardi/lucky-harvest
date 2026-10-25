# UI and audio (`src/ui`, `src/audio.ts`)

The interface is plain DOM and CSS laid over the canvas: no framework. All text is Brazilian Portuguese.

## Structure

- `index.html` declares the static containers: `#hud` (top bar, toolbar, seed tray, goal chip), `#toast`, `#floaters`, `#tip`, and one empty `<div>` per dialog (`#shop`, `#barn`, `#pen`, `#tonico`, `#bakery`, `#book`, `#menu`).
- `src/main.ts` instantiates the classes below on those containers and connects them to `dispatch`.
- `src/ui/style.css` holds all styling (CSS variables for the palette, Fredoka font from `@fontsource-variable/fredoka`).

| Module | Role |
|---|---|
| `hud.ts` | Level/XP bar, coins, clock, tile info line |
| `toolbar.ts` | The six tools, the seed tray, the "look" tool; owns the selected tool, crop and tree |
| `modal.ts` | `Modal<Tab>` base class: backdrop, framed panel, tabs, scroll preservation, safe re-render |
| `shop.ts`, `barn.ts`, `pen.ts`, `bakery.ts`, `tonico.ts`, `book.ts`, `menu.ts` | The dialogs, all subclasses of `Modal` |
| `kit.ts` | HTML helpers shared by dialogs: `row(...)`, `coin(...)`, `heading(...)`, `rarityBadge(...)`, and the `Dispatch` type |
| `info-card.ts`, `info.ts` | Hover / long-press detail cards for anything marked `data-info="kind:id"` |
| `messages.ts` | Maps every `FailReason` to a Portuguese message; also helper wording |
| `feedback.ts` | `Toast` and `Floaters` (floating +coins/+xp numbers) |
| `icons.ts`, `item-icons.ts`, `good-icons.ts`, `bakery-icon.ts`, `cursors.ts` | Inline SVG icons and tool cursors, drawn in code |
| `splash.ts` | Drives the loading screen |

## How dialogs work

A dialog extends `Modal` and implements three methods:

```ts
protected title(): string            // header HTML
protected html(): string             // the whole body as an HTML string, built from the Farm
protected onAction(action, data) {}  // called for <button data-act="..."> clicks
```

`Modal` re-renders only when the produced HTML string changed (and never while a pointer is down, so buttons don't vanish under a finger), restoring scroll position. A click handler reads `data-act` and `data-*` attributes, builds a `Command` and calls the injected `dispatch`. The dialog never touches `Farm` state directly; after a successful command `main.ts` calls `refreshUi`, which calls `refresh()` on every dialog.

This "render a string from state" approach is simple and robust, but it re-renders whole panels. If a dialog gets heavy (for example a long friends list), split it into smaller sub-panels or move to a small reactive library at that point, not before.

## Info cards

Any element with `data-info="crop:milho"` gets a card on hover (mouse) or long-press (touch). `info.ts` has the resolver `infoCard(key, farm)` that returns the card HTML from the same tables the rules use, so the cards stay in sync with balance changes.

## Audio

`src/audio.ts` synthesises everything with the Web Audio API: effects are short oscillator/noise envelopes, the music is a generated pentatonic loop, birds by day and crickets by night, animals and the truck have their own voices. `Sfx` is the union of valid effect names. The audio context starts on the first user gesture (browser rule), and the speaker button mutes everything. `main.ts` decides *when* to play (after commands, helper events, deliveries); the rules never trigger sound.

## Conventions

- Escape nothing by hand: dialogs build HTML from trusted data tables only. **If you ever show player-authored text (neighbor names, chat), escape it** or build nodes with `textContent`.
- Prices are formatted with `toLocaleString('pt-BR')` (see `coin()`).
- Keep strings that the player reads in `messages.ts`/`info.ts`/the data tables rather than scattered in logic, so a future i18n pass has one place to look.
