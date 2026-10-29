// God of Legacy Studio — the panels' controls, each bound to one profile value: it shows the value, changes it live
// (the preview updates at once), makes one undo step when the change ends, and puts back the game's default (↺).
import { getPath } from '../model/store';
import type { StudioStore } from '../model/store';
import { defaultProfile } from '../model/profile';
import { h, icon, ICONS } from './dom';

export interface Ctx {
  store: StudioStore;
  /** Every control's "show the value again" (run on any change of the profile). */
  refreshers: (() => void)[];
  /** The live read-outs (run a few times a second, with the preview's report). */
  live: (() => void)[];
}
const DEFAULTS = defaultProfile();
const defaultOf = (path: string): unknown => getPath(DEFAULTS, path);

function labelEl(text: string, help?: string): HTMLElement {
  return h('div', { class: 'st-label' }, text, help ? h('span', { class: 'st-help', title: help, 'aria-label': help }, '?') : null);
}
function resetBtn(onClick: () => void, title = 'ברירת המחדל של המשחק'): HTMLButtonElement {
  return h('button', { class: 'st-icon-btn st-reset', title, onclick: onClick }, icon(ICONS.reset, 14));
}

export interface SliderOpt {
  path: string; label: string; min: number; max: number; step: number; unit?: string; help?: string;
  /** Shown × this (0.25 → 25 with unit %). */
  show?: number; digits?: number;
  /** A read-out after the value (a jump's height from its strength). */
  extra?: () => string;
  onChange?: (v: number) => void;
}
/** A slider with its number: drag (live), type (Enter / leave), ↺ for the default. */
export function slider(ctx: Ctx, o: SliderOpt): HTMLElement {
  const s = ctx.store, k = o.show ?? 1, dg = o.digits ?? (o.step * k < 1 ? 2 : 0);
  const range = h('input', { type: 'range', class: 'st-range', min: String(o.min), max: String(o.max), step: String(o.step) }) as HTMLInputElement;
  const num = h('input', { type: 'number', class: 'st-num', step: String(o.step * k), dir: 'ltr' }) as HTMLInputElement;
  const extra = o.extra ? h('span', { class: 'st-extra' }) : null;
  let dragging = false;
  const put = (v: number, commit: boolean) => {
    const c = Number((Math.round(Math.min(o.max, Math.max(o.min, v)) / o.step) * o.step).toFixed(6));
    s.set(o.path, c);
    o.onChange?.(c);
    if (commit) s.commit();
  };
  range.addEventListener('pointerdown', () => { dragging = true; });
  range.addEventListener('input', () => put(Number(range.value), false));
  range.addEventListener('change', () => { dragging = false; put(Number(range.value), true); });
  num.addEventListener('change', () => { const v = Number(num.value); if (Number.isFinite(v)) put(v / k, true); });
  num.addEventListener('keydown', (e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); });
  const refresh = () => {
    const v = Number(getPath(s.profile, o.path) ?? 0);
    if (!dragging) range.value = String(v);
    if (document.activeElement !== num) num.value = (v * k).toFixed(dg).replace(/\.0+$/, '');
    if (extra && o.extra) extra.textContent = o.extra();
    const d = Number(defaultOf(o.path)), pct = ((v - o.min) / (o.max - o.min)) * 100;
    range.style.setProperty('--fill', `${Math.min(100, Math.max(0, pct))}%`);
    row.classList.toggle('st-changed', Number.isFinite(d) && Math.abs(d - v) > 1e-9);
  };
  const row = h('div', { class: 'st-row st-slider' },
    labelEl(o.label, o.help),
    h('div', { class: 'st-slider-line' }, range, h('div', { class: 'st-num-wrap' }, num, o.unit ? h('span', { class: 'st-unit' }, o.unit) : null), resetBtn(() => { const d = defaultOf(o.path); if (typeof d === 'number') put(d, true); })),
    extra);
  ctx.refreshers.push(refresh); refresh();
  return row;
}

export interface ToggleOpt { path: string; label: string; help?: string; get?: () => boolean; set?: (v: boolean) => void }
/** An on / off switch (a profile value, or anything through get / set). */
export function toggle(ctx: Ctx, o: ToggleOpt): HTMLElement {
  const s = ctx.store;
  const input = h('input', { type: 'checkbox', class: 'st-switch-input' }) as HTMLInputElement;
  input.addEventListener('change', () => { if (o.set) o.set(input.checked); else { s.set(o.path, input.checked); s.commit(); } });
  const refresh = () => { input.checked = o.get ? o.get() : !!getPath(s.profile, o.path); };
  const row = h('label', { class: 'st-row st-toggle' }, labelEl(o.label, o.help), h('span', { class: 'st-switch' }, input, h('span', { class: 'st-switch-ui' })));
  ctx.refreshers.push(refresh); refresh();
  return row;
}

export interface SelectOpt { path: string; label: string; help?: string; options: () => [string | number, string][]; numeric?: boolean; onChange?: (v: string | number) => void }
export function select(ctx: Ctx, o: SelectOpt): HTMLElement {
  const s = ctx.store;
  const el = h('select', { class: 'st-select' }) as HTMLSelectElement;
  let sig = '';
  const fill = () => {
    const opts = o.options(), n = JSON.stringify(opts);
    if (n === sig) return; sig = n;
    el.replaceChildren(...opts.map(([v, t]) => h('option', { value: String(v) }, t)));
  };
  el.addEventListener('change', () => { const v = o.numeric ? Number(el.value) : el.value; s.set(o.path, v); o.onChange?.(v); s.commit(); });
  const refresh = () => { fill(); if (document.activeElement !== el) el.value = String(getPath(s.profile, o.path)); };
  const row = h('div', { class: 'st-row st-select-row' }, labelEl(o.label, o.help), el);
  ctx.refreshers.push(refresh); refresh();
  return row;
}

export interface SwatchOpt { path: string; label: string; help?: string; options: { value: number; color: string; name: string }[]; none?: string }
/** Colour chips (a "none" chip first when the piece can be taken off). */
export function swatches(ctx: Ctx, o: SwatchOpt): HTMLElement {
  const s = ctx.store;
  const chips: [number, HTMLButtonElement][] = [];
  const pick = (v: number) => { s.set(o.path, v); s.commit(); };
  if (o.none) chips.push([-1, h('button', { class: 'st-sw st-sw-none', title: o.none, onclick: () => pick(-1) }, '∅')]);
  for (const op of o.options) chips.push([op.value, h('button', { class: 'st-sw', title: op.name, style: { background: op.color }, onclick: () => pick(op.value) })]);
  const refresh = () => { const v = Number(getPath(s.profile, o.path)); for (const [cv, b] of chips) b.classList.toggle('on', cv === v); };
  const row = h('div', { class: 'st-row st-swatches' }, labelEl(o.label, o.help), h('div', { class: 'st-chips' }, ...chips.map((c) => c[1])));
  ctx.refreshers.push(refresh); refresh();
  return row;
}

export interface SegOpt { path: string; label: string; help?: string; options: [string, string][] }
/** A few choices side by side. */
export function segmented(ctx: Ctx, o: SegOpt): HTMLElement {
  const s = ctx.store;
  const btns = o.options.map(([v, t]) => [v, h('button', { class: 'st-seg-btn', onclick: () => { s.set(o.path, v); s.commit(); } }, t)] as [string, HTMLButtonElement]);
  const refresh = () => { const v = String(getPath(s.profile, o.path)); for (const [bv, b] of btns) b.classList.toggle('on', bv === v); };
  const row = h('div', { class: 'st-row st-seg-row' }, labelEl(o.label, o.help), h('div', { class: 'st-seg' }, ...btns.map((b) => b[1])));
  ctx.refreshers.push(refresh); refresh();
  return row;
}

export function text(ctx: Ctx, o: { path: string; label: string; help?: string; max?: number }): HTMLElement {
  const s = ctx.store;
  const el = h('input', { type: 'text', class: 'st-text', maxLength: o.max ?? 60 }) as HTMLInputElement;
  el.addEventListener('input', () => s.set(o.path, el.value));
  el.addEventListener('change', () => s.commit());
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); });
  const refresh = () => { if (document.activeElement !== el) el.value = String(getPath(s.profile, o.path) ?? ''); };
  const row = h('div', { class: 'st-row st-text-row' }, labelEl(o.label, o.help), el);
  ctx.refreshers.push(refresh); refresh();
  return row;
}

/** A row of buttons. */
export function buttons(...bs: { label: string; onClick: () => void; kind?: 'primary' | 'danger' | 'ghost'; icon?: string; title?: string }[]): HTMLElement {
  return h('div', { class: 'st-row st-buttons' }, ...bs.map((b) => h('button', { class: `st-btn ${b.kind ? `st-btn-${b.kind}` : ''}`, title: b.title ?? '', onclick: b.onClick }, b.icon ? icon(b.icon, 16) : null, h('span', {}, b.label))));
}

/** A titled group that folds. */
export function section(title: string, open: boolean, ...children: (HTMLElement | null)[]): HTMLElement {
  const body = h('div', { class: 'st-section-body' }, ...children);
  const sec = h('section', { class: `st-section ${open ? 'open' : ''}` },
    h('button', { class: 'st-section-head', onclick: () => sec.classList.toggle('open') }, h('span', { class: 'st-chev' }, '▸'), h('span', {}, title)),
    body);
  return sec;
}

/** A short explanation line. */
export const note = (t: string, kind: 'info' | 'warn' = 'info'): HTMLElement => h('p', { class: `st-note st-note-${kind}` }, t);

/** A read-out that updates itself (live values). */
export function readout(ctx: Ctx, label: string, get: () => string): HTMLElement {
  const v = h('span', { class: 'st-readout-v', dir: 'ltr' });
  const refresh = () => { const t = get(); if (v.textContent !== t) v.textContent = t; };
  ctx.live.push(refresh); refresh();
  return h('div', { class: 'st-row st-readout' }, h('span', { class: 'st-label' }, label), v);
}

/** Shown only while `when()` holds (re-checked with every refresh). */
export function showIf(ctx: Ctx, when: () => boolean, el: HTMLElement): HTMLElement {
  const refresh = () => { el.style.display = when() ? '' : 'none'; };
  ctx.refreshers.push(refresh); refresh();
  return el;
}
