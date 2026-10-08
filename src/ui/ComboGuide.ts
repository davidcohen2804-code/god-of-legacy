// Combo guide (the PvP arena, left side): the class's locked routes, the shortest first and longer down the list (it
// scrolls; it never reaches the chat below) — each step as its key and icon, in order, and the hits the route lands.
// The keys follow Key Settings. Folds to its title bar (remembered on this device).
// DOM inside the HUD overlay (1920x1080 design px, scaled with it).
import { CLASS_NAMES, FONT_FAMILY } from '../config/layout';
import { COMBO_GUIDE, GuideRoute, GuideStep } from '../data/comboGuide';
import { iconUrl } from '../skills/FinalKit';
import type { ClassId, FinalSkill } from '../skills/SkillTypes';

const STYLE_ID = 'gol-cg-style';
const STORE = 'godoflegacy.comboGuide';

const CSS = `
.gol-cg{position:absolute;left:18px;top:184px;width:420px;box-sizing:border-box;display:none;flex-direction:column;gap:9px;padding:13px 14px 14px;pointer-events:auto;
  background:linear-gradient(rgba(6,10,18,.84),rgba(6,10,18,.7));border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.45),inset 0 0 0 1px rgba(201,154,69,.5);font-family:${FONT_FAMILY}}
.gol-cg.on{display:flex}
.gol-cg .cg-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px}
.gol-cg .cg-hd span{font:700 12px ${FONT_FAMILY};letter-spacing:2.5px;color:#f3d58a;text-shadow:0 1px 2px #000}
.gol-cg .cg-t{width:28px;height:24px;border-radius:6px;border:1px solid #6a5630;background:#0b121b;color:#e9cf8f;font:700 15px/1 ${FONT_FAMILY};cursor:pointer;padding:0}
.gol-cg .cg-t:hover{border-color:#c99a45;box-shadow:0 0 10px rgba(232,178,90,.35)}
.gol-cg .cg-sub{margin-top:-4px;padding:0 2px;font:600 11px/15px var(--gl-body,system-ui);color:#a9b4bf}
.gol-cg .cg-rs{display:flex;flex-direction:column;gap:4px;max-height:494px;overflow-y:auto;overscroll-behavior:contain;margin-right:-6px;padding-right:6px;
  scrollbar-width:thin;scrollbar-color:rgba(201,154,69,.55) transparent}
.gol-cg .cg-rs::-webkit-scrollbar{width:6px}
.gol-cg .cg-rs::-webkit-scrollbar-thumb{border-radius:3px;background:rgba(201,154,69,.55)}
.gol-cg .cg-rs::-webkit-scrollbar-track{background:transparent}
.gol-cg.min .cg-sub,.gol-cg.min .cg-rs{display:none}
.gol-cg .cg-r{flex:none;display:grid;grid-template-columns:66px 1fr 38px;align-items:center;column-gap:8px;min-height:33px;padding:3px 8px;box-sizing:border-box;border-radius:8px;background:rgba(255,255,255,.045)}
.gol-cg .cg-r.long{grid-template-columns:1fr auto;grid-template-areas:"n h" "s s";row-gap:7px;padding:8px 10px 9px}
.gol-cg .cg-r.long .cg-n{grid-area:n}
.gol-cg .cg-r.long .cg-n small{display:inline;margin:0 0 0 9px}
.gol-cg .cg-r.long .cg-h{grid-area:h;flex-direction:row;align-items:baseline;gap:4px}
.gol-cg .cg-r.long .cg-h small{margin-top:0}
.gol-cg .cg-r.long .cg-s{grid-area:s;row-gap:6px}
.gol-cg .cg-n{font:700 10.5px/1.15 ${FONT_FAMILY};letter-spacing:1.4px;color:#c9b48a;white-space:nowrap}
.gol-cg .cg-n small{display:block;margin-top:2px;font:800 8.5px var(--gl-body,system-ui);letter-spacing:1.2px}
.gol-cg .cg-n small.CLOSE{color:#9fb3c8}
.gol-cg .cg-n small.MID{color:#e9c46a}
.gol-cg .cg-n small.FAR{color:#f29b85}
.gol-cg .cg-s{display:flex;align-items:center;flex-wrap:wrap;gap:4px}
.gol-cg .cg-k{display:inline-flex;align-items:center;gap:5px;height:27px;padding:0 8px 0 3px;box-sizing:border-box;border-radius:6px;border:1px solid #6a5630;background:#0b121b;white-space:nowrap}
.gol-cg .cg-k img{width:21px;height:21px;border-radius:4px;display:block}
.gol-cg .cg-k b{font:700 13px var(--gl-body,system-ui);color:#ffe7a8;min-width:9px;text-align:center}
.gol-cg .cg-k b.nk{color:#7d8794}
.gol-cg .cg-k b.lg{font-size:10.5px;letter-spacing:.3px}
.gol-cg .cg-k i{font:700 11px var(--gl-body,system-ui);font-style:normal;color:#c9b48a;margin-left:-2px}
.gol-cg .cg-k em{font:800 8.5px var(--gl-body,system-ui);font-style:normal;letter-spacing:.8px;color:#9ed8ff;border:1px solid rgba(158,216,255,.5);border-radius:4px;padding:2px 3px}
.gol-cg .cg-k.j{padding:0 8px}
.gol-cg .cg-k.j u{text-decoration:none;font:800 14px var(--gl-body,system-ui);color:#9ed8ff}
.gol-cg .cg-st{display:inline-flex;align-items:center;gap:4px}
.gol-cg .cg-a{font:700 15px/1 var(--gl-body,system-ui);color:#8a7650;padding:0 1px}
.gol-cg .cg-h{display:flex;flex-direction:column;align-items:center;line-height:1}
.gol-cg .cg-h b{font:700 15px var(--gl-body,system-ui);color:#fff}
.gol-cg .cg-h small{font:700 8.5px var(--gl-body,system-ui);letter-spacing:1px;color:#bfb08e;margin-top:3px}`;

export interface GuideKeys { slots: string[]; jump: string }

export class ComboGuide {
  /** This class has routes to show. */
  static has(cls: string): boolean { return !!COMBO_GUIDE[cls as ClassId]?.length; }

  private readonly root: HTMLDivElement;
  private readonly tog: HTMLButtonElement;
  /** Every key letter shown (slot index, or -1 for the jump key): relabelled when Key Settings change. */
  private readonly keyEls: { el: HTMLElement; slot: number; chip: HTMLElement; title: string }[] = [];
  private on = false;

  constructor(parent: HTMLElement, cls: ClassId, kit: FinalSkill[], keys: GuideKeys) {
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    const root = this.root = document.createElement('div'); root.className = 'gol-cg';
    root.addEventListener('mousedown', (e) => { if (e.target !== rs) { e.stopPropagation(); e.preventDefault(); } }); // (the scroll bar still drags)
    const hd = document.createElement('div'); hd.className = 'cg-hd';
    const title = document.createElement('span'); title.textContent = `${(CLASS_NAMES[cls] ?? cls).toUpperCase()} COMBOS`;
    const tog = this.tog = document.createElement('button'); tog.type = 'button'; tog.className = 'cg-t';
    tog.addEventListener('click', () => this.fold(!root.classList.contains('min')));
    hd.append(title, tog);
    const sub = document.createElement('div'); sub.className = 'cg-sub'; sub.textContent = 'Each key right after the last hit of the one before';
    const rs = document.createElement('div'); rs.className = 'cg-rs';
    const slotOf = new Map(kit.map((s, i) => [s.id, i]));
    // the shortest routes first (fewest keys on the row, then fewest presses), the longer ones down the list
    const presses = (r: GuideRoute) => r.steps.reduce((a, st) => a + (st.n ?? 1), 0);
    const routes = [...(COMBO_GUIDE[cls] ?? [])].sort((a, b) => a.steps.length - b.steps.length || presses(a) - presses(b));
    for (const r of routes) {
      const row = document.createElement('div'); row.className = r.steps.length > 3 ? 'cg-r long' : 'cg-r';
      const nm = document.createElement('span'); nm.className = 'cg-n'; nm.textContent = r.name;
      const rg = document.createElement('small'); rg.className = r.range; rg.textContent = r.range; nm.appendChild(rg);
      nm.title = r.range === 'CLOSE' ? 'Open from close by' : r.range === 'MID' ? 'Open from a few steps away' : 'Open from far away';
      const seq = document.createElement('span'); seq.className = 'cg-s';
      r.steps.forEach((st, n) => { // each arrow goes with the key after it (a wrapped line starts with ›, never ends with it)
        const g = document.createElement('span'); g.className = 'cg-st';
        if (n) { const a = document.createElement('span'); a.className = 'cg-a'; a.textContent = '›'; g.appendChild(a); }
        g.appendChild(this.chip(st, kit, slotOf));
        seq.appendChild(g);
      });
      const h = document.createElement('span'); h.className = 'cg-h'; h.title = `${r.hits} hits`;
      const hb = document.createElement('b'); hb.textContent = String(r.hits);
      const hs = document.createElement('small'); hs.textContent = 'HITS';
      h.append(hb, hs);
      row.append(nm, seq, h);
      rs.appendChild(row);
    }
    root.append(hd, sub, rs);
    parent.appendChild(root);
    let folded = false;
    try { folded = localStorage.getItem(STORE) === 'min'; } catch { /* storage unavailable */ }
    this.fold(folded, false);
    this.setKeys(keys);
  }

  private chip(st: GuideStep, kit: FinalSkill[], slotOf: Map<string, number>): HTMLElement {
    const c = document.createElement('span'); c.className = 'cg-k';
    const key = document.createElement('b');
    if (!st.id) { // a jump
      c.classList.add('j');
      const u = document.createElement('u'); u.textContent = '↑';
      c.append(u, key);
      this.keyEls.push({ el: key, slot: -1, chip: c, title: 'Jump' });
      return c;
    }
    const slot = slotOf.get(st.id) ?? -2, s = kit[slot];
    if (s) { const img = document.createElement('img'); img.src = iconUrl(s); img.alt = ''; img.draggable = false; c.appendChild(img); }
    c.appendChild(key);
    if (st.n && st.n > 1) { const x = document.createElement('i'); x.textContent = `×${st.n}`; c.appendChild(x); }
    if (st.hold) { const e = document.createElement('em'); e.textContent = 'HOLD'; c.appendChild(e); }
    const name = s?.name ?? st.id;
    this.keyEls.push({ el: key, slot, chip: c, title: `${name}${st.n && st.n > 1 ? ` ×${st.n}` : ''}${st.hold ? ' — hold the key until it is fully drawn' : ''}` });
    return c;
  }

  /** The keys of Key Settings (unbound: a dash and a hint). */
  setKeys(keys: GuideKeys): void {
    for (const k of this.keyEls) {
      const label = k.slot === -1 ? keys.jump : keys.slots[k.slot] ?? '';
      k.el.textContent = label || '—';
      k.el.classList.toggle('nk', !label);
      k.el.classList.toggle('lg', label.length > 2); // SPACE / SHIFT / CTRL: a smaller letter, the row stays on one line
      k.chip.title = label ? k.title : `${k.title} — no key: set one in Key Settings`;
    }
  }

  /** Folded to the title bar / open. */
  private fold(min: boolean, save = true): void {
    this.root.classList.toggle('min', min);
    this.tog.textContent = min ? '+' : '–';
    this.tog.title = min ? 'Show the combos' : 'Hide the combos';
    if (save) try { localStorage.setItem(STORE, min ? 'min' : 'open'); } catch { /* storage unavailable */ }
  }

  show(on: boolean): void { if (on !== this.on) { this.on = on; this.root.classList.toggle('on', on); } }

  destroy(): void { this.root.remove(); }
}
