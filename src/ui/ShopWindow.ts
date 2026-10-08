// Mira's shop (Sunstone Plaza): buy food, potions, buff potions and the Return Scroll; sell anything from the bag
// (materials for gold). In the game's window style (theme.ts), the gold carried at the bottom.
import { ICONS, ensureTheme } from './theme';
import { BAG_MAX, ITEMS, ITEM_IDS, SHOP, shortDesc } from '../game/Loot';

const STYLE_ID = 'gol-shop-style';
const W = 1040;
const CSS = `
.gol-shop{left:${(1920 - W) / 2}px;top:96px;width:${W}px;display:none;flex-direction:column}
.gol-shop.open{display:flex}
.gol-shop .body{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:22px 26px 0}
.gol-shop .col{padding:16px 16px 10px;display:flex;flex-direction:column;min-height:0}
.gol-shop .col > .gl-cap{margin:2px 4px 12px}
.gol-shop .list{display:flex;flex-direction:column;gap:4px;flex:none;height:494px;overflow-y:auto;padding-right:4px}
.gol-shop .list::-webkit-scrollbar{width:6px}.gol-shop .list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:3px}
.gol-shop .row{display:grid;grid-template-columns:48px 1fr auto auto;align-items:center;gap:12px;min-height:50px;padding:4px 10px 4px 8px;border-radius:12px;
  background:rgba(255,255,255,.03);border:1px solid transparent;box-sizing:border-box}
.gol-shop .row:hover{border-color:var(--gl-goldline);background:rgba(255,255,255,.05)}
.gol-shop .row img{width:40px;height:40px;justify-self:center}
.gol-shop .row .inm{min-width:0;display:flex;flex-direction:column;gap:3px}
.gol-shop .row .inm b{font:700 14.5px var(--gl-body);color:var(--gl-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-shop .row .inm span{font:500 12.5px var(--gl-body);color:var(--gl-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-shop .row .inm em{font-style:normal;color:var(--gl-text3)}
.gol-shop .pr{display:flex;align-items:center;gap:6px;font:700 14px var(--gl-body);color:var(--gl-gold2);font-variant-numeric:tabular-nums;white-space:nowrap;justify-content:flex-end;min-width:74px}
.gol-shop .pr.no{color:#e0796e}
.gol-shop .act{display:flex;align-items:center;gap:6px}
.gol-shop .qty{display:flex;align-items:center;height:34px;border-radius:9px;background:var(--gl-inset);border:1px solid var(--gl-line)}
.gol-shop .qty button{width:28px;height:32px;padding:0;border:0;background:transparent;color:var(--gl-text2);cursor:pointer;display:grid;place-items:center}
.gol-shop .qty button::before{content:'';width:12px;height:12px;background:currentColor;-webkit-mask:${ICONS.plus} center/contain no-repeat;mask:${ICONS.plus} center/contain no-repeat}
.gol-shop .qty button.m::before{-webkit-mask-image:${ICONS.minus};mask-image:${ICONS.minus}}
.gol-shop .qty button:hover{color:var(--gl-text)}
.gol-shop .qty span{min-width:30px;text-align:center;font:700 14px var(--gl-body);font-variant-numeric:tabular-nums}
.gol-shop .act .gl-btn{height:34px;min-width:66px;padding:0 14px;font-size:13.5px}
.gol-shop .empty{display:grid;place-items:center;height:100%;font:500 14px var(--gl-body);color:var(--gl-text3)}
.gol-shop .foot{display:flex;align-items:center;gap:10px;height:68px;padding:0 30px;font:600 14px var(--gl-body);color:var(--gl-text2)}
.gol-shop .foot img{width:26px;height:26px}
.gol-shop .foot b{font:700 18px var(--gl-body);color:var(--gl-gold2);font-variant-numeric:tabular-nums}
.gol-shop .foot .msg{margin-left:auto;font:600 13.5px var(--gl-body);color:var(--gl-text3);transition:color 200ms}
.gol-shop .foot .msg.ok{color:var(--gl-green)}.gol-shop .foot .msg.bad{color:#e0796e}
`;

export interface ShopHandlers { buy: (id: string, n: number) => string | null; sell: (id: string, n: number) => string | null; onOpen: (open: boolean) => void; state: () => { gold: number; bag: Record<string, number> } }

export class ShopWindow {
  private root: HTMLDivElement;
  private buyL!: HTMLDivElement; private sellL!: HTMLDivElement; private goldV!: HTMLElement; private msg!: HTMLElement;
  private qty = new Map<string, number>();
  private onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && this.isOpen) { e.preventDefault(); e.stopPropagation(); this.close(); } };

  constructor(parent: HTMLElement, private h: ShopHandlers) {
    ensureTheme();
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.root = this.el('div', 'gol-shop gl-win pop', parent) as HTMLDivElement;
    const hd = this.el('div', 'gl-head', this.root); this.el('div', 'gl-title', hd).textContent = "MIRA'S GOODS"; this.el('div', 'gl-sub', hd).textContent = 'Traveling merchant · Sunstone Plaza';
    this.el('div', 'gl-sp', hd);
    const x = this.el('button', 'gl-x', hd) as HTMLButtonElement; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.title = 'Close (Esc)'; x.addEventListener('click', () => this.close());
    const body = this.el('div', 'body', this.root);
    const l = this.el('div', 'col gl-sec', body); this.el('div', 'gl-cap', l).textContent = 'Buy'; this.buyL = this.el('div', 'list', l) as HTMLDivElement;
    const r = this.el('div', 'col gl-sec', body); this.el('div', 'gl-cap', r).textContent = 'Sell from your bag'; this.sellL = this.el('div', 'list', r) as HTMLDivElement;
    const f = this.el('div', 'foot', this.root);
    const gi = document.createElement('img'); gi.src = 'assets/final/items/gold_small.png'; gi.alt = ''; f.appendChild(gi);
    this.el('span', '', f).textContent = 'Gold'; this.goldV = this.el('b', '', f); this.msg = this.el('span', 'msg', f);
  }

  private el(tag: string, cls: string, parent: HTMLElement): HTMLElement { const e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); return e; }

  get isOpen(): boolean { return this.root.classList.contains('open'); }
  open(): void { if (this.isOpen) return; this.qty.clear(); this.msg.textContent = ''; this.root.classList.add('open'); window.addEventListener('keydown', this.onEsc, true); this.refresh(); this.h.onOpen(true); }
  close(): void { if (!this.isOpen) return; this.root.classList.remove('open'); window.removeEventListener('keydown', this.onEsc, true); this.h.onOpen(false); }
  destroy(): void { window.removeEventListener('keydown', this.onEsc, true); this.root.remove(); }

  private say(text: string, ok: boolean): void { this.msg.textContent = text; this.msg.className = `msg ${ok ? 'ok' : 'bad'}`; }

  refresh(): void {
    if (!this.isOpen) return;
    const { gold, bag } = this.h.state();
    this.goldV.textContent = gold.toLocaleString('en-US');
    this.buyL.textContent = '';
    for (const id of SHOP) {
      const d = ITEMS[id], key = `b:${id}`, max = Math.max(1, Math.min(BAG_MAX - (bag[id] ?? 0), Math.floor(gold / (d.price ?? 1))));
      const n = Math.min(this.qty.get(key) ?? 1, Math.max(1, max));
      this.row(this.buyL, id, shortDesc(d), (d.price ?? 0) * n, gold >= (d.price ?? 0) * n, key, n, max, 'Buy', () => { const e = this.h.buy(id, n); if (e) this.say(e, false); else { this.say(`Bought ${d.name} ×${n}`, true); this.qty.delete(key); } this.refresh(); });
    }
    this.sellL.textContent = '';
    const have = ITEM_IDS.filter((id) => (bag[id] ?? 0) > 0);
    if (!have.length) this.el('div', 'empty', this.sellL).textContent = 'Your bag is empty.';
    for (const id of have) {
      const d = ITEMS[id], key = `s:${id}`, max = bag[id], n = Math.min(this.qty.get(key) ?? 1, max);
      this.row(this.sellL, id, `You have ${bag[id]}  ·  ${d.sell} G each`, d.sell * n, true, key, n, max, 'Sell', () => { const e = this.h.sell(id, n); if (e) this.say(e, false); else { this.say(`Sold ${d.name} ×${n} for ${(d.sell * n).toLocaleString('en-US')} gold`, true); this.qty.delete(key); } this.refresh(); });
    }
  }

  private row(list: HTMLElement, id: string, sub: string, price: number, afford: boolean, key: string, n: number, max: number, verb: string, go: () => void): void {
    const d = ITEMS[id], r = this.el('div', 'row', list);
    const im = document.createElement('img'); im.src = d.icon; im.alt = ''; r.appendChild(im);
    const nm = this.el('div', 'inm', r); this.el('b', '', nm).textContent = d.name; this.el('span', '', nm).textContent = sub;
    const pr = this.el('div', `pr${afford ? '' : ' no'}`, r); pr.textContent = `${price.toLocaleString('en-US')} G`;
    const act = this.el('div', 'act', r), q = this.el('div', 'qty', act);
    const m = this.el('button', 'm', q) as HTMLButtonElement; m.type = 'button'; m.setAttribute('aria-label', 'Less'); m.disabled = n <= 1;
    this.el('span', '', q).textContent = String(n);
    const p = this.el('button', '', q) as HTMLButtonElement; p.type = 'button'; p.setAttribute('aria-label', 'More'); p.disabled = n >= max;
    m.addEventListener('click', () => { this.qty.set(key, Math.max(1, n - 1)); this.refresh(); });
    p.addEventListener('click', () => { this.qty.set(key, Math.min(max, n + 1)); this.refresh(); });
    const b = this.el('button', `gl-btn${verb === 'Buy' ? ' pri' : ''}`, act) as HTMLButtonElement; b.type = 'button'; b.textContent = verb; b.disabled = !afford;
    b.addEventListener('click', go);
  }
}
