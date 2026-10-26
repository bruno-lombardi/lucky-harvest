import { Tool } from '../core/actions';
import { LOOK_ICON, TOOL_ICONS } from './icons';

export type ToolMode = Tool | 'olhar';

const SIZE = 36;

/** Where the "click" lands inside each 48-unit icon (the working end of the tool), as a fraction. */
const HOTSPOT: Record<ToolMode, [number, number]> = {
  olhar: [0.22, 0.1],
  colher: [0.5, 0.55],
  arar: [0.34, 0.74],
  semear: [0.5, 0.6],
  regar: [0.1, 0.55],
  cuidar: [0.5, 0.45],
  limpar: [0.3, 0.88],
  adubar: [0.55, 0.6],
};

const cache = new Map<ToolMode, string>();

/** A CSS cursor made from the tool's own icon, so the pointer shows what a tap will do. */
export function cursorFor(mode: ToolMode): string {
  let css = cache.get(mode);
  if (css) return css;
  const svg = (mode === 'olhar' ? LOOK_ICON : TOOL_ICONS[mode]).replace('<svg ', `<svg width="${SIZE}" height="${SIZE}" `);
  const [hx, hy] = HOTSPOT[mode];
  css = `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round(hx * SIZE)} ${Math.round(hy * SIZE)}, ${mode === 'olhar' ? 'default' : 'crosshair'}`;
  cache.set(mode, css);
  return css;
}
