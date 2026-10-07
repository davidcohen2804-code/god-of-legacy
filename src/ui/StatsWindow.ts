// STATS window (MapleStory's stat window, our look): the character's name, job and level; the combat numbers (attack
// range, HP, attack, defence, critical, attack speed, evasion, speed %, jump %); and the four stats with the AP to place
// (+ on each, AUTO for the job, RESET while still free). Drawn on the kit's window frame (window.png, 9-sliced).
import { FONT_FAMILY, HUD } from '../config/layout';
import { STAT_INFO, STAT_KEYS, STAT_NAMES, StatKey, Stats } from '../game/Stats';

const K = (f: string) => `assets/final/ui/kit/${f}.png`;
const STYLE_ID = 'gol-stats-style';
const W = 780, H = 620;
const CSS = `
.gol-stats{position:absolute;left:${(1920 - W) / 2}px;top:150px;width:${W}px;height:${H}px;box-sizing:border-box;display:none;pointer-events:auto;
  border:46px solid transparent;border-image:url("${K('window')}") 60 fill / 46px stretch;padding:0;color:#efe3c4;font-family:${HUD.bodyFont};
  filter:drop-shadow(0 10px 24px rgba(0,0,0,.6))}
.gol-stats.open{display:block}
.gol-stats .in{position:absolute;inset:8px 10px 10px;display:flex;flex-direction:column;gap:16px}
.gol-stats .hd{display:flex;align-items:center;gap:16px;padding:6px 72px 14px 12px;border-bottom:1px solid rgba(201,154,69,.45)}
.gol-stats .hd .w{margin-left:auto}
.gol-stats .hd .t{font:700 24px ${FONT_FAMILY};letter-spacing:4px;color:#f3d58a;text-shadow:0 2px 4px #000}
.gol-stats .hd .w{font:600 15px ${HUD.bodyFont};color:#cdbb92;letter-spacing:.5px}
.gol-stats .hd .w b{color:#ffe2a0;font-weight:700}
.gol-stats .x{position:absolute;right:16px;top:12px;width:32px;height:32px;border:0;padding:0;cursor:pointer;background:url("${K('btn_close_sm')}") center/100% 100% no-repeat}
.gol-stats .x:hover{background-image:url("${K('btn_close_sm_hover')}")}
.gol-stats .body{flex:1;display:grid;grid-template-columns:1.15fr 1fr;gap:18px;min-height:0}
.gol-stats .col{background:rgba(4,8,18,.55);border-radius:10px;box-shadow:inset 0 0 0 1px rgba(201,154,69,.35);padding:16px 20px;display:flex;flex-direction:column;gap:2px}
.gol-stats .cap{font:700 13px ${FONT_FAMILY};letter-spacing:3px;color:#cdb98a;margin:0 0 8px}
.gol-stats .row{display:flex;justify-content:space-between;align-items:center;height:30px;padding:0 4px;border-bottom:1px solid rgba(255,255,255,.05);font-size:15px}
.gol-stats .row:last-child{border-bottom:0}
.gol-stats .row span{color:#bfb08e}
.gol-stats .row b{color:#fff1cc;font-weight:700;letter-spacing:.3px}
.gol-stats .row b.up{color:#9dff9a}
.gol-stats .ap{display:flex;justify-content:space-between;align-items:center;margin:0 0 10px;padding:8px 12px;border-radius:8px;background:rgba(201,154,69,.12);box-shadow:inset 0 0 0 1px rgba(201,154,69,.4)}
.gol-stats .ap span{font:700 13px ${FONT_FAMILY};letter-spacing:2.5px;color:#e7cf91}
.gol-stats .ap b{font:700 22px ${FONT_FAMILY};color:#ffe28a;text-shadow:0 1px 3px #000}
.gol-stats .st{display:grid;grid-template-columns:62px 1fr 38px;align-items:center;gap:10px;height:44px;padding:0 4px;border-bottom:1px solid rgba(255,255,255,.05)}
.gol-stats .st .n{font:700 16px ${FONT_FAMILY};letter-spacing:2px;color:#e8d7aa}
.gol-stats .st.main .n{color:#ffd36a}
.gol-stats .st.main .n::after{content:' ★';font-size:11px;color:#ffd36a}
.gol-stats .st .v{font:700 18px ${HUD.bodyFont};color:#fff1cc}
.gol-stats .st button{width:34px;height:34px;border-radius:8px;border:1px solid #8a6f3a;background:linear-gradient(#3a2a10,#22180a);color:#ffe7a8;font:700 20px/1 ${FONT_FAMILY};cursor:pointer;padding:0}
.gol-stats .st button:hover:not(:disabled){border-color:#e8b25a;box-shadow:0 0 10px rgba(232,178,90,.45)}
.gol-stats .st button:disabled{opacity:.3;cursor:default}
.gol-stats .act{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:auto;padding-top:12px}
.gol-stats .act button{height:40px;border-radius:9px;border:1px solid #8a6f3a;background:linear-gradient(#3a2a10,#22180a);color:#ffe7a8;font:700 14px ${FONT_FAMILY};letter-spacing:2px;cursor:pointer}
.gol-stats .act button:hover:not(:disabled){border-color:#e8b25a;box-shadow:0 0 12px rgba(232,178,90,.4)}
.gol-stats .act button:disabled{opacity:.35;cursor:default}
.gol-stats .tip{font-size:13px;line-height:18px;color:#a99d80;min-height:36px;padding:8px 4px 0}
`;

export interface StatsView {
  name: string; job: string; level: number; stats: Stats; ap: number; main: StatKey; canReset: boolean;
  combat: [string, string, boolean?][];   // label, value, raised by a buff now
}
export interface StatsHandlers { add: (k: StatKey) => void; auto: () => void; reset: () => void; onOpen: (open: boolean) => void }

export class StatsWindow {
  private root: HTMLDivElement;
  private hdW!: HTMLDivElement; private combat!: HTMLDivElement; private apV!: HTMLElement; private rows = new Map<StatKey, { el: HTMLDivElement; v: HTMLElement; b: HTMLButtonElement }>();
  private autoB!: HTMLButtonElement; private resetB!: HTMLButtonElement; private tip!: HTMLDivElement;
  private onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && this.isOpen) { e.preventDefault(); e.stopPropagation(); this.close(); } };

  constructor(parent: HTMLElement, private h: StatsHandlers) {
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.root = document.createElement('div'); this.root.className = 'gol-stats';
    const inn = this.el('div', 'in', this.root);
    const hd = this.el('div', 'hd', inn); this.el('div', 't', hd).textContent = 'CHARACTER STATS'; this.hdW = this.el('div', 'w', hd) as HTMLDivElement;
    const x = this.el('button', 'x', inn) as HTMLButtonElement; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', () => this.close());
    const body = this.el('div', 'body', inn);
    const left = this.el('div', 'col', body); this.el('div', 'cap', left).textContent = 'COMBAT'; this.combat = this.el('div', '', left) as HTMLDivElement;
    const right = this.el('div', 'col', body); this.el('div', 'cap', right).textContent = 'ABILITY';
    const ap = this.el('div', 'ap', right); this.el('span', '', ap).textContent = 'AP AVAILABLE'; this.apV = this.el('b', '', ap);
    for (const k of STAT_KEYS) {
      const r = this.el('div', 'st', right) as HTMLDivElement; this.el('div', 'n', r).textContent = STAT_NAMES[k];
      const v = this.el('div', 'v', r); const b = this.el('button', '', r) as HTMLButtonElement; b.type = 'button'; b.textContent = '+';
      b.addEventListener('click', () => this.h.add(k));
      r.addEventListener('mouseenter', () => { this.tip.textContent = STAT_INFO[k]; }); r.addEventListener('mouseleave', () => { this.tip.textContent = ''; });
      this.rows.set(k, { el: r, v, b });
    }
    this.tip = this.el('div', 'tip', right) as HTMLDivElement;
    const act = this.el('div', 'act', right);
    this.autoB = this.el('button', '', act) as HTMLButtonElement; this.autoB.type = 'button'; this.autoB.textContent = 'AUTO'; this.autoB.addEventListener('click', () => this.h.auto());
    this.autoB.addEventListener('mouseenter', () => { this.tip.textContent = 'Place every free AP into your job\'s stats.'; });
    this.resetB = this.el('button', '', act) as HTMLButtonElement; this.resetB.type = 'button'; this.resetB.textContent = 'RESET'; this.resetB.addEventListener('click', () => this.h.reset());
    this.resetB.addEventListener('mouseenter', () => { this.tip.textContent = this.resetB.disabled ? 'Free resets end with your 1st job.' : 'Take every point back (free until your 1st job).'; });
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
    this.hdW.innerHTML = ''; const n = document.createElement('b'); n.textContent = v.name; this.hdW.append(n, ` · ${v.job} · Lv. ${v.level}`);
    this.combat.textContent = '';
    for (const [label, value, up] of v.combat) {
      const r = this.el('div', 'row', this.combat); this.el('span', '', r).textContent = label; const b = this.el('b', up ? 'up' : '', r); b.textContent = value;
    }
    this.apV.textContent = String(v.ap);
    for (const [k, r] of this.rows) { r.v.textContent = String(v.stats[k]); r.b.disabled = v.ap <= 0; r.el.classList.toggle('main', k === v.main); }
    this.autoB.disabled = v.ap <= 0; this.resetB.disabled = !v.canReset;
  }
}
