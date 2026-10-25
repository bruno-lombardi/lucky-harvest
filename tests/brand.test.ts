import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const file = (p: string): string => new URL(`../${p}`, import.meta.url).pathname;

describe('brand assets', () => {
  it('ships every icon the page and the manifest point at', () => {
    const html = readFileSync(file('index.html'), 'utf8');
    const manifest = JSON.parse(readFileSync(file('public/manifest.webmanifest'), 'utf8')) as { icons: { src: string }[] };
    const referenced = [
      ...[...html.matchAll(/(?:href|src)="\/([^"]+\.(?:svg|png|ico|webmanifest))"/g)].map((m) => m[1]!),
      ...manifest.icons.map((i) => i.src),
    ];
    expect(referenced.length).toBeGreaterThan(6);
    for (const name of referenced) expect(existsSync(file(`public/${name}`)), name).toBe(true);
  });
});
