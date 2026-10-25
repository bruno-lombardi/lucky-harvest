# Brand and visual identity

## The mark

A **four-leaf clover with a gold star coin at its heart**, growing from a mound of soil. *Lucky* is the clover, *Harvest* is the plant growing, and the coin is the same star coin the player earns in the HUD, so the logo and the game share one symbol.

The look follows the game: chunky shapes, a dark-brown outline (`#4a2b0f`) on everything, flat toon colours with one light highlight stroke, and a warm brown drop shadow under the lettering.

| Asset | File | Use |
|---|---|---|
| Mark (transparent) | `brand/mark.svg` | Anywhere a small logo is needed on a light or coloured background |
| Stacked lockup | `brand/logo.svg` (also `public/logo.svg`) | Posters, README banners, store listings |
| Horizontal lockup | `brand/logo-horizontal.svg` (also `public/`) | Headers, the in-game menu |
| Wordmark only | `brand/wordmark.svg` (also `public/`) | The loading screen |
| App icon / favicon | `brand/icon.svg` → `public/favicon.svg` | Browser tab, bookmarks |
| Maskable icon | `brand/icon-maskable.svg` | Android adaptive icons (mark inside the safe zone) |
| Social image | `brand/social.svg` → `public/social.png` (1200×630) | Link previews (Open Graph and Twitter card) |

Exports in `public/`: `favicon.svg`, `favicon.ico` (16/32/48), `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `social.png`, plus `manifest.webmanifest` (name, colours, icons) which prepares the PWA step on the roadmap.

### Regenerating

Everything is generated from code, in the same spirit as the game's art:

```bash
pip install fonttools brotli playwright        # once
python3 brand/build.py
```

`brand/build.py` draws the SVGs, converts the wordmark to outlines from the game's own font (Fredoka Bold, so no font is needed to display it), and exports the PNG/ICO files with Chromium. To change the mark, edit `clover()`, `stem()` or `mark_body()` and rerun. The script expects Fredoka instances at `FONT_DIR` (default `/tmp/brand`, created with fontTools' `instancer` from `node_modules/@fontsource-variable/fredoka`); see the top of the script.

### Usage rules

- Keep clear space of at least the coin's diameter around the mark.
- Minimum size: mark 16 px (use the favicon version below 32 px), lockup 120 px wide.
- Do not recolour the leaves, rotate the mark, remove the outline, or place it on a busy photo. On dark backgrounds use the badge (`icon.svg`), which carries its own sky background.
- The wordmark is always white with a brown outline and shadow; never set "Lucky Harvest" in another typeface for the logo.

## Palette

| Role | Hex | Where |
|---|---|---|
| Ink (outline, text on parchment) | `#4a2b0f` | Outlines, logo, dialog text |
| Sky top / mid / bottom | `#5db7f2` / `#a6dcfb` / `#e4f6ff` | Page background, splash, social image, theme colour |
| Grass | `#7ec850`, light `#98d963`, shade `#6aa845` | Hills, buttons (green), progress bar |
| Clover | `#9be35a`, `#6cc23a`, `#3f9a2e` | Mark leaves |
| Gold | `#ffe98a`, `#f7b928`, `#c98410` | Coin, gold buttons, HUD badges |
| Wood | `#b97a3e`, `#8a5527` | Panels, wordmark shadow, soil |
| Parchment | `#fff7e3` area | Dialog bodies |

These are the same values as the CSS variables at the top of `src/ui/style.css` (`--sky-*`, `--gold-*`, `--wood-*`, `--ink`) and the 3D scene's palettes, so UI, logo and world read as one thing.

## Typography

**Fredoka** (variable, weights 300 to 700) for everything: UI text at 500 to 600, headings and the wordmark at 700. It is bundled with `@fontsource-variable/fredoka`, so there is no network font request. Numbers use the same face (the HUD already sets them heavy).

## Voice

Warm, friendly, a little cheeky, in Brazilian Portuguese; short sentences; characters have personality (Tonico grumbles, Dona Zefa bakes with love). Tagline: **"Sua fazendinha isométrica"**.

## Where the identity shows up in the game

- **Loading screen** (`index.html`): the animated mark (the coin pulses, the plant sways) over the sky, the wordmark, and the progress bar styled as a furrow.
- **Menu dialog**: horizontal lockup at the top.
- **Browser**: the favicon, `theme-color` (sky blue), Apple touch icon and web manifest, plus Open Graph and Twitter tags so shared links show the social image. The `og:image` URL is absolute (GitHub Pages address); update it if the site moves.
