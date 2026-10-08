// CAMERA window (the arena; from the gear menu): two sliders that move the camera as you drag them — ZOOM (farther /
// closer) and ANGLE (look more from below / more from above) — RESET (the default view) and SAVE (kept for next time).
// Bottom-right, beside the gear, so the arena stays in view while you set it. DOM, 1920x1080 design px (HUD overlay).
import { ensureTheme } from './theme';
import { CAM, CamPrefs } from '../game/CameraPrefs';

const STYLE_ID = 'gol-cam-style';
const P = { right: 86, bottom: 16, w: 340 };

const CSS = `
.gol-cam{position:absolute;right:${P.right}px;bottom:${P.bottom}px;width:${P.w}px;display:none;flex-direction:column;gap:16px;padding:16px 20px 20px;pointer-events:auto;
  font-family:var(--gl-body);color:var(--gl-text)}
.gol-cam.open{display:flex}
.gol-cam .hd{display:flex;align-items:center;gap:10px}
.gol-cam .hd b{flex:1;font:700 15px var(--gl-title);letter-spacing:2.5px;color:#f3d58a}
.gol-cam .hd .gl-x{width:32px;height:32px}
.gol-cam .row{display:flex;flex-direction:column;gap:8px}
.gol-cam .top{display:flex;align-items:baseline;justify-content:space-between}
.gol-cam .top i{font:700 13px var(--gl-body);font-style:normal;letter-spacing:.5px;color:#f1dfb5}
.gol-cam .ends{display:flex;justify-content:space-between;font:600 11px var(--gl-body);letter-spacing:1.2px;color:var(--gl-text3);text-transform:uppercase}
.gol-cam input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:22px;margin:0;background:transparent;cursor:pointer}
.gol-cam input[type=range]:focus{outline:none}
.gol-cam input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(90deg,rgba(231,196,124,.25),rgba(231,196,124,.55));box-shadow:inset 0 0 0 1px rgba(231,196,124,.25)}
.gol-cam input[type=range]::-moz-range-track{height:6px;border-radius:3px;background:linear-gradient(90deg,rgba(231,196,124,.25),rgba(231,196,124,.55))}
.gol-cam input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-7px;border-radius:50%;border:2px solid #f6dc9f;
  background:linear-gradient(180deg,#f2d493,#d2a65a);box-shadow:0 2px 8px rgba(0,0,0,.5)}
.gol-cam input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;border:2px solid #f6dc9f;background:linear-gradient(180deg,#f2d493,#d2a65a)}
.gol-cam .tip{font:500 12px/1.4 var(--gl-body);color:var(--gl-text2)}
.gol-cam .act{display:flex;gap:10px}
.gol-cam .act .gl-btn{flex:1;height:38px}`;

export interface CameraPanelHandlers {
  /** A slider moved (applied at once). */
  change(p: Partial<CamPrefs>): void;
  /** Back to the default view; returns it. */
  reset(): CamPrefs;
  /** Keep the camera for next time; false if it could not be stored. */
  save(): boolean;
}

export class CameraPanel {
  private readonly root: HTMLDivElement;
  private readonly zoom: HTMLInputElement;
  private readonly angle: HTMLInputElement;
  private readonly zv: HTMLElement;
  private readonly av: HTMLElement;
  private readonly saveBtn: HTMLButtonElement;
  private savedTimer = 0;
  private readonly onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && this.isOpen) { e.preventDefault(); e.stopPropagation(); this.close(); } };

  constructor(parent: HTMLElement, private readonly h: CameraPanelHandlers) {
    ensureTheme();
    if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, p: HTMLElement, text?: string) => {
      const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; p.appendChild(e); return e;
    };
    const root = this.root = el('div', 'gol-cam gl-panel', parent);
    const hd = el('div', 'hd', root);
    el('b', '', hd, 'CAMERA');
    const x = el('button', 'gl-x', hd); x.type = 'button'; x.title = 'Close (Esc)'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', () => this.close());
    const slider = (label: string, min: number, max: number, step: number, lo: string, hi: string) => {
      const row = el('div', 'row', root), top = el('div', 'top', row);
      el('span', 'gl-cap', top, label);
      const v = el('i', '', top);
      const r = el('input', '', row); r.type = 'range'; r.min = String(min); r.max = String(max); r.step = String(step);
      const ends = el('div', 'ends', row); el('span', '', ends, lo); el('span', '', ends, hi);
      r.addEventListener('pointerup', () => r.blur()); r.addEventListener('change', () => r.blur()); // (never keeps the keys: they move your fighter)
      return { r, v };
    };
    const z = slider('ZOOM', CAM.zoom.min, CAM.zoom.max, 0.01, 'Farther', 'Closer');
    const a = slider('ANGLE', CAM.angle.min, CAM.angle.max, 0.05, 'From below', 'From above');
    this.zoom = z.r; this.zv = z.v; this.angle = a.r; this.av = a.v;
    this.zoom.addEventListener('input', () => { this.h.change({ zoom: Number(this.zoom.value) }); this.show(); });
    this.angle.addEventListener('input', () => { this.h.change({ angle: Number(this.angle.value) }); this.show(); });
    el('div', 'tip', root, 'Mouse wheel over the arena: zoom in and out.');
    const act = el('div', 'act', root);
    const reset = el('button', 'gl-btn', act, 'RESET'); reset.type = 'button';
    reset.addEventListener('click', () => this.set(this.h.reset()));
    const save = this.saveBtn = el('button', 'gl-btn pri', act, 'SAVE'); save.type = 'button';
    save.addEventListener('click', () => {
      const ok = this.h.save();
      save.textContent = ok ? 'SAVED' : 'COULD NOT SAVE';
      window.clearTimeout(this.savedTimer);
      this.savedTimer = window.setTimeout(() => { save.textContent = 'SAVE'; }, 1600);
    });
    for (const b of [x, reset, save]) b.addEventListener('mousedown', (e) => e.preventDefault()); // (buttons never take the keys either)
    window.addEventListener('keydown', this.onKey, true);
  }

  get isOpen(): boolean { return this.root.classList.contains('open'); }
  open(p: CamPrefs): void { this.set(p); this.root.classList.add('open'); }
  close(): void { this.root.classList.remove('open'); }
  toggle(p: CamPrefs): void { if (this.isOpen) this.close(); else this.open(p); }

  /** Show these values (the wheel moved the camera, RESET). */
  set(p: CamPrefs): void { this.zoom.value = String(p.zoom); this.angle.value = String(p.angle); this.show(); }

  private show(): void {
    this.zv.textContent = `${Math.round(Number(this.zoom.value) * 100)}%`;
    const a = Number(this.angle.value);
    this.av.textContent = Math.abs(a) < 0.025 ? 'Level' : `${a > 0 ? 'Above' : 'Below'} ${Math.round(Math.abs(a) * 100)}%`;
  }

  destroy(): void { window.clearTimeout(this.savedTimer); window.removeEventListener('keydown', this.onKey, true); this.root.remove(); }
}
