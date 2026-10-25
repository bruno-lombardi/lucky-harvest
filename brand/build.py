#!/usr/bin/env python3
"""Generates the Lucky Harvest brand assets (SVG sources, favicons, social image) from code.

Run:  python3 brand/build.py        (needs fonttools + brotli, and Playwright's chromium for the PNG exports)
Outputs SVGs into brand/ and public/, PNG/ICO exports into public/.
The wordmark is converted to outlines from the game's own font (Fredoka), so no font file is needed to display it.
"""
import os, sys, subprocess, math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.environ.get('FONT_DIR', '/tmp/brand')
INK = '#4a2b0f'
GREEN_L, GREEN_M, GREEN_D = '#9be35a', '#6cc23a', '#3f9a2e'
GOLD_1, GOLD_2 = '#ffe98a', '#f7b928'

def text_path(font_file, text, size, tracking=0.0):
    """Returns (svg path data, width) for text set at `size` px, baseline at y=0."""
    font = TTFont(font_file)
    gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font['hmtx']
    scale = size / font['head'].unitsPerEm
    x, d = 0.0, []
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: f'{v:.1f}')
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, 0)))
        d.append(pen.getCommands())
        x += hmtx[name][0] * scale + tracking
    return ' '.join(d), x - tracking

LEAF = 'M0 0 C-6 -3 -17 -10 -17 -22 C-17 -31 -9 -35 -4 -31 C-2 -29 -1 -27 0 -25 C1 -27 2 -29 4 -31 C9 -35 17 -31 17 -22 C17 -10 6 -3 0 0 Z'

def clover(cx, cy, s=1.0):
    """Four-leaf clover with a gold coin at its heart, centred on (cx, cy)."""
    out = []
    shades = [(GREEN_M, GREEN_L), (GREEN_D, GREEN_M), (GREEN_M, GREEN_L), (GREEN_D, GREEN_M)]
    for n, ang in enumerate([-45, 45, 135, 225]):
        base, hi = shades[n]
        out.append(
            f'<g transform="translate({cx} {cy}) rotate({ang}) scale({s})">'
            f'<path d="{LEAF}" fill="{base}" stroke="{INK}" stroke-width="{4/s:.2f}" stroke-linejoin="round"/>'
            f'<path d="M-9 -14 C-11 -19 -10 -24 -6 -26" fill="none" stroke="{hi}" stroke-width="{3/s:.2f}" stroke-linecap="round"/>'
            f'<path d="M0 -3 L0 -22" fill="none" stroke="{INK}" stroke-opacity=".35" stroke-width="{1.8/s:.2f}" stroke-linecap="round"/>'
            f'</g>')
    # coin
    r = 11 * s
    star = ' '.join(f'{cx + (r*0.62 if i%2==0 else r*0.26)*math.sin(i*math.pi/5):.2f},{cy - (r*0.62 if i%2==0 else r*0.26)*math.cos(i*math.pi/5):.2f}' for i in range(10))
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{r:.2f}" fill="{GOLD_2}" stroke="{INK}" stroke-width="{3.6*s:.2f}"/>'
               f'<circle cx="{cx}" cy="{cy}" r="{r*0.74:.2f}" fill="{GOLD_1}"/>'
               f'<polygon points="{star}" fill="{GOLD_2}" stroke="{INK}" stroke-width="{1.2*s:.2f}" stroke-linejoin="round"/>')
    return ''.join(out)

def stem(cx, top, bottom, lean=6):
    d = f'M{cx} {top} C{cx} {top+16} {cx+lean} {bottom-18} {cx+lean*0.4:.1f} {bottom}'
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>'
            f'<path d="{d}" fill="none" stroke="{GREEN_M}" stroke-width="4.4" stroke-linecap="round"/>')

def mark_body(cx=64, cy=52, s=1.0, ground=True):
    parts = []
    if ground:
        parts.append(f'<ellipse cx="{cx+2}" cy="112" rx="30" ry="8" fill="#8a5527" stroke="{INK}" stroke-width="3.6"/>')
        parts.append(f'<ellipse cx="{cx+2}" cy="109.5" rx="21" ry="3.6" fill="#a46a35"/>')
    parts.append(stem(cx, cy + 10, 112))
    # a little sprout leaf on the stem
    parts.append(f'<path d="M{cx+4} 90 C{cx+22} 92 {cx+30} 82 {cx+30} 72 C{cx+14} 72 {cx+4} 78 {cx+4} 90Z" fill="{GREEN_L}" stroke="{INK}" stroke-width="3.4" stroke-linejoin="round"/>')
    parts.append(clover(cx, cy, s))
    return ''.join(parts)

def svg(w, h, body, defs='', vb=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb or f"0 0 {w} {h}"}" width="{w}" height="{h}">{f"<defs>{defs}</defs>" if defs else ""}{body}</svg>\n'

SKY = '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5db7f2"/><stop offset=".62" stop-color="#a6dcfb"/><stop offset="1" stop-color="#e4f6ff"/></linearGradient>'

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w').write(text)

# ---- mark (transparent) --------------------------------------------------
write(f'{ROOT}/brand/mark.svg', svg(128, 128, mark_body(), vb='0 0 128 128'))

# ---- app icon / favicon (badge) -----------------------------------------
def badge(size=128, rounded=True, scale=1.0):
    rx = 30 if rounded else 0
    inner = (
        f'<rect width="128" height="128" rx="{rx}" fill="url(#sky)"/>'
        f'<clipPath id="c"><rect width="128" height="128" rx="{rx}"/></clipPath>'
        f'<g clip-path="url(#c)">'
        f'<ellipse cx="64" cy="150" rx="104" ry="52" fill="#98d963"/><ellipse cx="64" cy="156" rx="104" ry="50" fill="#7ec850"/>'
        f'</g>'
        f'<g transform="translate(64 64) scale({scale}) translate(-66 -64)">{mark_body(cx=64, cy=50, s=1.12, ground=False)}</g>'
        f'<rect x="1.5" y="1.5" width="125" height="125" rx="{max(rx-1.5,0)}" fill="none" stroke="{INK}" stroke-width="3"/>')
    return svg(size, size, inner, SKY, vb='0 0 128 128')
write(f'{ROOT}/public/favicon.svg', badge())
write(f'{ROOT}/brand/icon.svg', badge())
write(f'{ROOT}/brand/icon-maskable.svg', badge(rounded=False, scale=0.82))  # square, safe zone for Android masks

# ---- wordmark ------------------------------------------------------------
BOLD, MED = f'{FONT_DIR}/fredoka700.ttf', f'{FONT_DIR}/fredoka500.ttf'
def wordmark(size=84):
    lucky, wl = text_path(BOLD, 'Lucky', size, tracking=1)
    harv, wh = text_path(BOLD, 'Harvest', size, tracking=1)
    width = max(wl, wh)
    lh = size * 0.98
    uid = [0]
    def line(d, w, y):
        dx = (width - w) / 2
        uid[0] += 1
        i = f'g{size}-{uid[0]}'
        # One outline path, reused for the shadow, the brown outline and the white fill.
        return (f'<g transform="translate({dx:.2f} {y:.2f})"><defs><path id="{i}" d="{d}"/></defs>'
                f'<use href="#{i}" transform="translate(0 {size*0.1:.1f})" fill="#8a5527" stroke="#8a5527" stroke-width="{size*0.2:.1f}" stroke-linejoin="round"/>'
                f'<use href="#{i}" fill="#fff" stroke="{INK}" stroke-width="{size*0.15:.1f}" stroke-linejoin="round"/>'
                f'<use href="#{i}" fill="#fff"/></g>')
    body = line(lucky, wl, size * 0.78) + line(harv, wh, size * 0.78 + lh)
    return body, width, lh + size * 1.05

# ---- lockup: mark + wordmark (stacked) ----------------------------------
wm, ww, wh_ = wordmark(76)
pad = 24
MS = 1.6  # mark scale in the lockup
lw = max(ww, 128 * MS) + pad * 2
mark_g = f'<g transform="translate({lw/2-64*MS:.1f} {pad}) scale({MS})">{mark_body()}</g>'
wm_g = f'<g transform="translate({(lw-ww)/2:.1f} {pad+128*MS-4})">{wm}</g>'
lh_ = pad + 128 * MS - 4 + wh_ + pad * 0.4
write(f'{ROOT}/brand/logo.svg', svg(round(lw), round(lh_), mark_g + wm_g, vb=f'0 0 {lw:.0f} {lh_:.0f}'))
# horizontal lockup for headers
wm2, ww2, _ = wordmark(52)
hl = f'<g transform="translate(8 6) scale(.9)">{mark_body()}</g>'
tw = ww2
wm_h = f'<g transform="translate(130 12)">{wm2}</g>'
write(f'{ROOT}/brand/logo-horizontal.svg', svg(round(130 + tw + 12), 128, hl + wm_h))

# wordmark alone (used by the loading screen) and public copies of the lockups
wmo, wwo, who = wordmark(76)
write(f'{ROOT}/brand/wordmark.svg', svg(round(wwo + 24), round(who - 6), f'<g transform="translate(12 0)">{wmo}</g>'))
for name in ('wordmark', 'logo', 'logo-horizontal'):
    write(f'{ROOT}/public/{name}.svg', open(f'{ROOT}/brand/{name}.svg').read())

# ---- social image 1200x630 ----------------------------------------------
def social():
    wmk, w, h = wordmark(120)
    tag, tw_ = text_path(MED, 'Sua fazendinha isométrica', 40)
    hills = ('<ellipse cx="300" cy="700" rx="620" ry="190" fill="#6aa845"/>'
             '<ellipse cx="860" cy="720" rx="700" ry="200" fill="#98d963"/><ellipse cx="860" cy="732" rx="700" ry="196" fill="#7ec850"/>')
    fields = ''.join(f'<path d="M{x} 600 l70 -22" stroke="#6aa845" stroke-width="5" stroke-linecap="round" opacity=".5"/>' for x in range(40, 1200, 130))
    clouds = ('<g fill="#fff" opacity=".9" stroke="#fff" stroke-width="0">'
              '<ellipse cx="170" cy="120" rx="70" ry="26"/><ellipse cx="215" cy="104" rx="46" ry="28"/><ellipse cx="130" cy="108" rx="40" ry="22"/>'
              '<ellipse cx="1030" cy="170" rx="80" ry="28"/><ellipse cx="985" cy="152" rx="46" ry="26"/><ellipse cx="1075" cy="152" rx="40" ry="22"/></g>')
    mk = f'<g transform="translate(150 118) scale(2.6)">{mark_body()}</g>'
    wx = 600
    wmg = f'<g transform="translate({wx} 120)">{wmk}</g>'
    tg = f'<g transform="translate({wx + (w - tw_) / 2:.1f} {120 + h + 34})"><path d="{tag}" fill="#2d4a1a"/></g>'
    body = '<rect width="1200" height="630" fill="url(#sky)"/>' + clouds + hills + fields + mk + wmg + tg
    return svg(1200, 630, body, SKY)
write(f'{ROOT}/brand/social.svg', social())

# ---- PNG / ICO exports via Chromium -------------------------------------
from playwright.sync_api import sync_playwright
exports = [
    ('brand/icon.svg', 'public/favicon-32.png', 32), ('brand/icon.svg', 'public/favicon-16.png', 16),
    ('brand/icon.svg', 'public/apple-touch-icon.png', 180), ('brand/icon.svg', 'public/icon-192.png', 192),
    ('brand/icon.svg', 'public/icon-512.png', 512), ('brand/icon-maskable.svg', 'public/icon-maskable-512.png', 512),
    ('brand/social.svg', 'public/social.png', None), ('brand/logo.svg', 'brand/logo.png', None),
]
with sync_playwright() as p:
    b = p.chromium.launch()
    for src, dst, size in exports:
        text = open(f'{ROOT}/{src}').read()
        if size:
            html = f'<html><body style="margin:0;background:transparent"><div style="width:{size}px;height:{size}px">{text.replace("<svg ", f"<svg style=\"width:{size}px;height:{size}px\" ", 1)}</div></body></html>'
            page = b.new_page(viewport={'width': size, 'height': size})
        else:
            import re
            m = re.search(r'viewBox="0 0 (\d+) (\d+)"', text); w, h = int(m[1]), int(m[2])
            k = 2 if 'logo' in src else 1
            html = f'<html><body style="margin:0;background:transparent">{text.replace("<svg ", f"<svg style=\"width:{w*k}px;height:{h*k}px\" ", 1)}</body></html>'
            page = b.new_page(viewport={'width': w * k, 'height': h * k})
        page.set_content(html)
        page.screenshot(path=f'{ROOT}/{dst}', omit_background=True)
        page.close()
    b.close()

from PIL import Image
im = Image.open(f'{ROOT}/public/icon-512.png').convert('RGBA')
im.save(f'{ROOT}/public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('brand assets built')
