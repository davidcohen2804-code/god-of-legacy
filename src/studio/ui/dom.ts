// God of Legacy Studio — small DOM helpers and the toolbar's icons (inline SVG, no files).

type Child = Node | string | null | undefined | false;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** An icon from path data (24×24 view box, stroked). */
/** The character's state in words (the mover's modes). */
const STATE_HE: Record<string, string> = { idle: 'עומד', walk: 'הולך', run: 'רץ', takeoff: 'ניתור', air: 'באוויר', land: 'נחיתה', runstop: 'עוצר', skill: 'מתקפה' };
export const stateName = (m: string): string => STATE_HE[m] ?? m;

export function icon(paths: string, size = 20): SVGSVGElement {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', String(size)); s.setAttribute('height', String(size));
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = paths;
  return s;
}

export const ICONS = {
  select: '<path d="M5 3l14 8-6 2-2 6z"/>',
  pan: '<path d="M8 11V5a1.5 1.5 0 013 0v5"/><path d="M11 10V4a1.5 1.5 0 013 0v6"/><path d="M14 10V6a1.5 1.5 0 013 0v7a7 7 0 01-7 7h-1a6 6 0 01-5-3l-2.5-4.5a1.5 1.5 0 012.5-1.5L8 13"/>',
  level: '<path d="M3 15l4-4h14l-4 4z"/><path d="M3 15v4h14v-4"/><path d="M17 19l4-4v-4"/>',
  platform: '<rect x="5" y="9" width="10" height="9"/><path d="M5 9l4-4h10l-4 4"/><path d="M19 5v9l-4 4"/>',
  oneway: '<path d="M3 11h18"/><path d="M5 11l2 3h10l2-3"/><path d="M12 21v-5"/><path d="M9.5 18.5L12 21l2.5-2.5"/>',
  ramp: '<path d="M3 19L19 7v12z"/><path d="M8 19v-1.5M12 19v-4.5M16 19v-7"/>',
  spawn: '<path d="M6 21V4"/><path d="M6 4h11l-3 4 3 4H6"/>',
  grid: '<path d="M4 4h16v16H4z"/><path d="M4 10h16M4 15h16M10 4v16M15 4v16"/>',
  collide: '<circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
  camera: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>',
  frameAll: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  focus: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3"/><rect x="8" y="13" width="8" height="6"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M4 3h16"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.8M6.6 6.6A17 17 0 002 12s4 7 10 7a9.6 9.6 0 004.9-1.3"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  reset: '<path d="M4 12a8 8 0 108-8"/><path d="M4 4v5h5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
};
