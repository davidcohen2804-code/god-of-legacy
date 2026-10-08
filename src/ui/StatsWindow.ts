// STATS window (MapleStory's stat window, our look): the character's name, job and level; the combat numbers (attack
// range, HP, attack, defence, critical, attack speed, evasion, speed %, jump %); and the four stats with the AP to place
// (− / + on each, AUTO for the job, RESET at any time), in the game's window style (theme.ts).
import { ICONS, ensureTheme } from './theme';
import { BASE_STAT, STAT_INFO, STAT_KEYS, STAT_NAMES, StatKey, Stats } from '../game/Stats';

const STYLE_ID = 'gol-stats-style';
const W = 800;
const CSS = `
.gol-stats{left:${(1920 - W) / 2}px;top:170px;width:${W}px;display:none;flex-direction:column}
.gol-stats.open{display:flex}
.gol-stats .gl-sub b{color:var(--gl-text);font-weight:600}
.gol-stats .body{display:grid;grid-template-columns:1.12fr 1fr;gap:18px;padding:22px 26px 26px}
.gol-stats .col{padding:18px 20px;display:flex;flex-direction:column}
.gol-stats .col > .gl-cap{margin:0 0 12px}
.gol-stats .row{display:flex;justify-content:space-between;align-items:center;height:32px;border-bottom:1px solid var(--gl-line);font-size:14.5px}
.gol-stats .row:last-child{border-bottom:0}
.gol-stats .row span{color:var(--gl-text2)}
.gol-stats .row b{color:var(--gl-text);font-weight:600;font-variant-numeric:tabular-nums}
.gol-stats .row b.up{color:var(--gl-green)}
.gol-stats .ap{display:flex;justify-content:space-between;align-items:center;margin:0 0 8px;padding:10px 14px;border-radius:12px;background:var(--gl-goldsoft);border:1px solid rgba(231,196,124,.32)}
.gol-stats .ap span{font:700 12px var(--gl-body);letter-spacing:1.4px;color:#e2c88f;text-transform:uppercase}
.gol-stats .ap b{font:700 22px var(--gl-body);color:var(--gl-gold2);font-variant-numeric:tabular-nums}
.gol-stats .st{display:grid;grid-template-columns:64px 1fr 34px 34px;align-items:center;gap:8px;height:46px;border-bottom:1px solid var(--gl-line)}
.gol-stats .st .n{font:700 15px var(--gl-body);letter-spacing:1.4px;color:var(--gl-text2)}
.gol-stats .st.main .n{color:var(--gl-gold2)}
.gol-stats .st.main .n::after{content:' ★';font-size:11px}
.gol-stats .st .v{font:700 18px var(--gl-body);color:var(--gl-text);font-variant-numeric:tabular-nums}
.gol-stats .st button{width:34px;height:34px;padding:0;border-radius:10px;border:1px solid rgba(231,196,124,.4);background:var(--gl-goldsoft);color:var(--gl-gold2);cursor:pointer;
  display:grid;place-items:center;transition:background 120ms,border-color 120ms}
.gol-stats .st button::before{content:'';width:15px;height:15px;background:currentColor;-webkit-mask:${ICONS.plus} center/contain no-repeat;mask:${ICONS.plus} center/contain no-repeat}
.gol-stats .st button.minus{border-color:var(--gl-line2);background:rgba(255,255,255,.04);color:var(--gl-text2)}
.gol-stats .st button.minus::before{-webkit-mask-image:${ICONS.minus};mask-image:${ICONS.minus}}
.gol-stats .st button.minus:hover:not(:disabled){background:rgba(255,255,255,.08);border-color:var(--gl-goldline);color:var(--gl-text)}
.gol-stats .st button:hover:not(:disabled){background:rgba(231,196,124,.22);border-color:var(--gl-gold)}
.gol-stats .st button:disabled{opacity:.3;cursor:default}
.gol-stats .act{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:auto;padding-top:12px}
.gol-stats .tip{font:500 13px/1.45 var(--gl-body);color:var(--gl-text3);min-height:40px;padding:10px 2px 0}
`;

export interface StatsView {
  name: string; job: string; level: number; stats: Stats; ap: number; main: StatKey; canReset: boolean;
  combat: [string, string, boolean?][];   // label, value, raised by a buff now
}
export interface StatsHandlers { add: (k: StatKey) => void; sub: (k: StatKey) => void; auto: () => void; reset: () => void; onOpen: (open: boolean) => void }

export class StatsWindow {
  private root: HTMLDivElement;
  private hdW!: HTMLDivElement; private combat!: HTMLDivElement; private apV!: HTMLElement; private rows = new Map<StatKey, { el: HTMLDivElement; v: HTMLElement; b: HTMLButtonElement; m: HTMLButtonElement }>();
  private autoB!: HTMLButtonElement; private resetB!: HTMLButtonElement; private tip!: HTMLDivElement;
  private onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && this.isOpen) { e.preventDefault(); e.stopPropagation(); this.close(); } };

  constructor(parent: HTMLElement, private h: StatsHandlers) {
    ensureTheme();
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.root = document.createElement('div'); this.root.className = 'gol-stats gl-win pop';
    const hd = this.el('div', 'gl-head', this.root); this.el('div', 'gl-title', hd).textContent = 'CHARACTER STATS'; this.hdW = this.el('div', 'gl-sub', hd) as HTMLDivElement;
    this.el('div', 'gl-sp', hd);
    const x = this.el('button', 'gl-x', hd) as HTMLButtonElement; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.title = 'Close (Esc)'; x.addEventListener('click', () => this.close());
    const body = this.el('div', 'body', this.root);
    const left = this.el('div', 'col gl-sec', body); this.el('div', 'gl-cap', left).textContent = 'Combat'; this.combat = this.el('div', '', left) as HTMLDivElement;
    const right = this.el('div', 'col gl-sec', body); this.el('div', 'gl-cap', right).textContent = 'Ability';
    const ap = this.el('div', 'ap', right); this.el('span', '', ap).textContent = 'AP available'; this.apV = this.el('b', '', ap);
    for (const k of STAT_KEYS) {
      const r = this.el('div', 'st', right) as HTMLDivElement; this.el('div', 'n', r).textContent = STAT_NAMES[k];
      const v = this.el('div', 'v', r);
      const m = this.el('button', 'minus', r) as HTMLButtonElement; m.type = 'button'; m.setAttribute('aria-label', `Take a point from ${STAT_NAMES[k]}`); m.addEventListener('click', () => this.h.sub(k));
      const b = this.el('button', '', r) as HTMLButtonElement; b.type = 'button'; b.setAttribute('aria-label', `Add a point to ${STAT_NAMES[k]}`); b.addEventListener('click', () => this.h.add(k));
      r.addEventListener('mouseenter', () => { this.tip.textContent = STAT_INFO[k]; }); r.addEventListener('mouseleave', () => { this.tip.textContent = ''; });
      this.rows.set(k, { el: r, v, b, m });
    }
    this.tip = this.el('div', 'tip', right) as HTMLDivElement;
    const act = this.el('div', 'act', right);
    this.autoB = this.el('button', 'gl-btn pri', act) as HTMLButtonElement; this.autoB.type = 'button'; this.autoB.textContent = 'Auto'; this.autoB.addEventListener('click', () => this.h.auto());
    this.autoB.addEventListener('mouseenter', () => { this.tip.textContent = 'Place every free AP into your job\'s stats.'; });
    this.resetB = this.el('button', 'gl-btn', act) as HTMLButtonElement; this.resetB.type = 'button'; this.resetB.textContent = 'Reset'; this.resetB.addEventListener('click', () => this.h.reset());
    this.resetB.addEventListener('mouseenter', () => { this.tip.textContent = 'Take every point back to place them again.'; });
    for (const b of [this.autoB, this.resetB]) b.addEventListener('mouseleave', () => { this.tip.textContent = ''; });
    parent.appendChild(this.root);
  }

  private el(tag: string, cls: string, parent: HTMLElement): HTMLElement { const e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); return e; }

  get isOpen(): boolean { return this.root.classList.contains('open'); }
  open(): void { if (this.isOpen) return; this.root.classList.add('open'); window.addEventListener('keydown', this.onEsc, true); this.h.onOpen(true); }
  close(): void { if (!this.isOpen) return; this.root.classList.remove('open'); window.removeEventListener('keydown', this.onEsc, true); this.h.onOpen(false); }
  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
  destroy(): void { window.removeEventListener('keydown', this.onEsc, true); this.root.remove(); }

  render(v: StatsView): void {
    this.hdW.innerHTML = ''; const n = document.createElement('b'); n.textContent = v.name; this.hdW.append(n, ` · ${v.job} · Lv ${v.level}`);
    this.combat.textContent = '';
    for (const [label, value, up] of v.combat) {
      const r = this.el('div', 'row', this.combat); this.el('span', '', r).textContent = label; const b = this.el('b', up ? 'up' : '', r); b.textContent = value;
    }
    this.apV.textContent = String(v.ap);
    for (const [k, r] of this.rows) { r.v.textContent = String(v.stats[k]); r.b.disabled = v.ap <= 0; r.m.disabled = v.stats[k] <= BASE_STAT; r.el.classList.toggle('main', k === v.main); }
    this.autoB.disabled = v.ap <= 0; this.resetB.disabled = !v.canReset;
  }
}
