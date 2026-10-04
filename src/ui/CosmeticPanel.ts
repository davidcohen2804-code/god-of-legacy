// Inventory (I) and Cosmetic Shop (O): cosmetics only (no stats, no payment). Both views share one live Phaser
// preview of the real class body with the runtime cosmetic layers, cycling through every animation state and all four
// directions. Ownership / equipped ids persist in the local character store (abstract enough for a later backend).
import Phaser from 'phaser';
import { CLASS_NAMES, FONT_FAMILY } from '../config/layout';
import { Character } from '../characters/CharacterTypes';
import { CharacterStore } from '../characters/CharacterStore';
import { syncOverlay } from './CharacterSelectUI';
import { PreviewStage, Rect, holeMask } from './PreviewStage';
import { ActorView, COSMETICS, CosSlot, Equipped, cosmetic, slotOf } from '../game/ActorView';
import { ClassKey, resolvePose } from '../game/Body';
import { AnimSnap, LAND_MS, Mode, poseQuery } from '../game/PoseState';
import { Dir } from '../world/collision';
import { kitFor } from '../skills/FinalKit';
import { isQAMode } from '../qa/QAPanel';

type Tab = 'inventory' | 'shop';
type InvCat = 'equipped' | 'owned' | 'sets' | 'weapon' | 'headface' | 'back' | 'aura';
type ShopCat = 'all' | 'sets' | 'weapon' | 'headface' | 'back' | 'aura';
type PState = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt' | 'dead';
interface Item { id: string; type: string; icon: string; name: string; desc: string; parts?: string[] }

const INV = 'assets/final/ui/inventory', SHOP = 'assets/final/ui/cash_shop';
const INV_BG = { x: 360, y: 140, w: 1200, h: 800 };
const SHOP_BG = { x: 210, y: 90, w: 1500, h: 900 };
const INV_PREVIEW: Rect = { x: 36, y: 104, w: 400, h: 564 };
const SHOP_PREVIEW: Rect = { x: 40, y: 104, w: 470, h: 540 };
const SLOT_LABEL: Record<CosSlot, string> = { head: 'Head', face: 'Face', back: 'Cape / Back', weapon: 'Weapon', aura: 'Aura', damage: 'Damage Skin', pet: 'Companion', hair: 'Hair Colour', armor: 'Armor Finish', hairstyle: 'Hairstyle', top: 'Chest Plate', gloves: 'Gauntlets', shoes: 'Boots', pants: 'Trousers' };
const TYPE_LABEL: Record<string, string> = {
  head: 'Head', mask: 'Face', cape: 'Cape', back: 'Back', weapon: 'Weapon skin', weapon_animated: 'Animated weapon skin', bow: 'Bow skin',
  book: 'Book skin', aura: 'Aura', set: 'Full set',
};
const INV_TABS: [InvCat, string][] = [['equipped', 'Equipped'], ['owned', 'Owned'], ['sets', 'Sets'], ['weapon', 'Weapon Skins'], ['headface', 'Head / Face'], ['back', 'Cape / Back'], ['aura', 'Aura / Effects']];
const SHOP_TABS: [ShopCat, string][] = [['all', 'All'], ['sets', 'Sets'], ['weapon', 'Weapons'], ['headface', 'Head / Face'], ['back', 'Cape / Back'], ['aura', 'Aura / Effects']];
const STATES: [PState, string][] = [['idle', 'Idle'], ['walk', 'Walk'], ['run', 'Run'], ['jump', 'Jump'], ['attack', 'Attack'], ['hurt', 'Hit'], ['dead', 'Death']];
const DIRS: Dir[] = ['down', 'right', 'up', 'left'];

const catOf = (it: Item): Exclude<ShopCat, 'all'> => {
  if (it.type === 'set') return 'sets';
  const s = slotOf(it.type);
  return s === 'weapon' ? 'weapon' : s === 'head' || s === 'face' ? 'headface' : s === 'back' ? 'back' : 'aura';
};

const STYLE_ID = 'gol-cosmetic-style';
const CSS = `
.gol-cp{z-index:40;display:none}
.gol-cp.open{display:block}
.gol-cp .bg{position:absolute;background-size:100% 100%;pointer-events:auto;animation:golCpIn 240ms ease-out;display:none}
.gol-cp .bg.on{display:block}
@keyframes golCpIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
.gol-cp .ttl{position:absolute;left:40px;top:24px;font-size:32px;font-weight:700;letter-spacing:3px;color:#f0d9a6;text-shadow:0 2px 6px #000}
.gol-cp .sub{position:absolute;left:42px;top:68px;font-size:15px;letter-spacing:.5px;color:#b9c6d3;white-space:nowrap}
.gol-cp button{font-family:${FONT_FAMILY};cursor:pointer;pointer-events:auto;transition:transform 120ms ease-out,filter 120ms ease-out}
.gol-cp button:hover:not(:disabled){filter:brightness(1.25);transform:scale(1.02)}
.gol-cp button:active:not(:disabled){transform:scale(.985)}
.gol-cp button:disabled{opacity:.45;cursor:default}
.gol-cp .x{position:absolute;right:24px;top:20px;width:44px;height:44px;border-radius:8px;border:2px solid #c99a45;background:#0d151f;color:#f0d9a6;font-size:22px;font-weight:700}
.gol-cp .sw{position:absolute;right:84px;top:24px;height:36px;padding:0 16px;border-radius:7px;border:1px solid #c99a45;background:#1a1408;color:#f0d9a6;font-size:14px;font-weight:700;letter-spacing:1px}
.gol-cp .tab{position:absolute;border:0;background:transparent 0 0/100% 100% no-repeat;color:#c9d3dc;font-size:15px;font-weight:700;letter-spacing:.5px}
.gol-cp .tab.on{color:#ffe2a0;filter:brightness(1.35) drop-shadow(0 0 8px rgba(240,190,90,.55))}
.gol-cp .grid{position:absolute;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#6a5630 transparent}
.gol-cp .cell{position:absolute;width:120px;height:146px;cursor:pointer;text-align:center}
.gol-cp .cell .sl{position:absolute;left:12px;top:0;width:96px;height:96px;background:url("${INV}/slot.png") 0 0/100% 100%;transition:transform 120ms,filter 120ms}
.gol-cp .cell.eq .sl{background-image:url("${INV}/slot_equipped.png");filter:drop-shadow(0 0 8px rgba(90,220,130,.6))}
.gol-cp .cell:hover .sl{transform:scale(1.04);filter:brightness(1.2)}
.gol-cp .cell img{position:absolute;left:12px;top:12px;width:72px;height:72px;object-fit:contain;pointer-events:none}
.gol-cp .cell .nm{position:absolute;left:0;right:0;top:100px;font-size:13px;line-height:15px;color:#e8dcc2;text-shadow:0 1px 2px #000}
.gol-cp .cell .eqt{position:absolute;left:14px;top:3px;font-size:10px;letter-spacing:1px;color:#8ff0a8;font-weight:700}
.gol-cp .row{position:absolute;left:0;width:100%;height:84px;background:url("${INV}/set_bundle_frame.png") 0 0/100% 100%;display:flex;align-items:center;gap:12px;padding:0 70px 0 72px}
.gol-cp .row .rn{width:190px;font-size:16px;font-weight:700;color:#f3e2bf;line-height:19px}
.gol-cp .row .rn small{display:block;font-size:12px;font-weight:400;color:#9fb0c0;font-family:Georgia,serif}
.gol-cp .row img{width:52px;height:52px;object-fit:contain;border-radius:6px;background:rgba(0,0,0,.25)}
.gol-cp .row .pt{display:flex;gap:6px;flex:1}
.gol-cp .act{height:34px;padding:0 14px;border-radius:6px;border:1px solid #c99a45;background:#2a1a08;color:#ffe2a0;font-size:13px;font-weight:700;letter-spacing:1px}
.gol-cp .act.alt{background:#0d1a26;border-color:#5a86b0;color:#cfe6ff}
.gol-cp .empty{position:absolute;left:0;right:0;top:120px;text-align:center;font-size:17px;color:#9fb0c0;font-family:Georgia,serif;line-height:1.5}
.gol-cp .card{position:absolute;width:176px;height:224px;background:url("${SHOP}/item_card.png") 0 0/100% 100%;cursor:pointer;transition:transform 120ms,filter 120ms}
.gol-cp .card.sel{background-image:url("${SHOP}/item_card_selected.png");filter:drop-shadow(0 0 10px rgba(240,190,90,.5))}
.gol-cp .card:hover{transform:translateY(-2px);filter:brightness(1.12)}
.gol-cp .card img.ic{position:absolute;left:32px;top:14px;width:112px;height:112px;object-fit:contain;pointer-events:none}
.gol-cp .card .nm{position:absolute;left:8px;right:8px;top:128px;text-align:center;font-size:14px;font-weight:700;color:#f3e2bf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-cp .card .ty{position:absolute;left:8px;right:8px;top:147px;text-align:center;font-size:11px;color:#9fb0c0;font-family:Georgia,serif}
.gol-cp .card .pr{position:absolute;left:0;right:0;top:164px;display:flex;justify-content:center;align-items:center;gap:6px;font-size:14px;color:#ffe2a0;font-weight:700}
.gol-cp .card .pr img{width:64px;height:26px}
.gol-cp .card .pr .own{font-size:11px;letter-spacing:1px;color:#8ff0a8}
.gol-cp .card .bt{position:absolute;left:10px;right:10px;bottom:10px;display:flex;gap:6px}
.gol-cp .card .bt button{flex:1;height:26px;padding:0;font-size:11px;letter-spacing:.5px;border-radius:5px}
.gol-cp .st{position:absolute;display:flex;gap:5px;flex-wrap:nowrap}
.gol-cp .st button{height:30px;padding:0 8px;border-radius:5px;border:1px solid #4a5f74;background:#0d1520;color:#c9d6e2;font-size:12px;font-weight:700;letter-spacing:.5px}
.gol-cp .st button.on{border-color:#c99a45;color:#ffe2a0;background:#251a0a}
.gol-cp .bundle{position:absolute;height:118px;background:url("${INV}/set_bundle_frame.png") 0 0/100% 100%;padding:12px 64px;display:none}
.gol-cp .bundle.on{display:block}
.gol-cp .bundle .bh{font-size:14px;font-weight:700;color:#f3e2bf;letter-spacing:1px}
.gol-cp .bundle .bp{margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:2px 10px}
.gol-cp .bundle .bp div{display:flex;align-items:center;gap:6px;font-size:12px;color:#c9d6e2;font-family:Georgia,serif}
.gol-cp .bundle .bp img{width:34px;height:34px;object-fit:contain}
.gol-cp .pcap{position:absolute;font-size:12px;letter-spacing:2px;color:#9fc6e8}
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
}

// ----------------------------------------------------------------------------------------------- live preview

class CosPreview {
  private view: ActorView;
  state: PState = 'idle';
  dir: Dir = 'down';
  autoTurn = true;
  private t = 0;
  private turnT = 0;
  private z = 0;
  private vz = 0;
  private basic;

  constructor(scene: Phaser.Scene, private stage: PreviewStage, readonly cls: ClassKey) {
    this.basic = kitFor(cls)[0];
    this.view = new ActorView(scene, cls, stage.ox, stage.oy);
  }

  setEquipped(e: Equipped): void { this.view.setEquipped(e); }
  setState(s: PState): void { this.state = s; this.t = 0; this.z = 0; this.vz = 0; }
  turn(step: number): void { this.dir = DIRS[(DIRS.indexOf(this.dir) + step + 4) % 4]; this.autoTurn = false; this.turnT = 0; }

  update(ms: number): void {
    this.t += ms;
    if (this.autoTurn) { this.turnT += ms; if (this.turnT > 2200) { this.turnT = 0; this.dir = DIRS[(DIRS.indexOf(this.dir) + 1) % 4]; } }
    let mode: Mode = 'idle', mt = this.t, speed = 0, vz = 0;
    let skill: AnimSnap['skill'];
    switch (this.state) {
      case 'walk': mode = 'walk'; speed = 188; break;
      case 'run': mode = 'run'; speed = 270; break;
      case 'jump': {
        // take-off → rise → apex → fall → landing → short idle, looping (real jump physics numbers).
        const cyc = 80 + 810 + LAND_MS + 380, c = this.t % cyc;
        if (c < 80) { mode = 'takeoff'; mt = c; this.z = 0; }
        else if (c < 890) { const a = (c - 80) / 1000; this.vz = 445 - 1100 * a; this.z = Math.max(0, 445 * a - 550 * a * a); mode = this.z > 0 ? 'air' : 'land'; vz = this.vz; }
        else if (c < 890 + LAND_MS) { mode = 'land'; mt = c - 890; this.z = 0; }
        else { mode = 'idle'; this.z = 0; }
        break;
      }
      case 'attack': {
        const s = this.basic, stages = s.chain?.stages.length ?? 1;
        const tim = (i: number) => s.chain?.timings?.[i] ?? s;
        const lens = Array.from({ length: stages }, (_, i) => tim(i).startup + tim(i).active + tim(i).recovery);
        const cyc = lens.reduce((a, b) => a + b, 0) + 500;
        let c = this.t % cyc, i = 0;
        while (i < stages && c >= lens[i]) { c -= lens[i]; i++; }
        if (i < stages) { mode = 'skill'; const T = tim(i); skill = { id: s.id, stage: i, elapsed: c, startup: T.startup, active: T.active, recovery: T.recovery }; }
        else { mode = 'recover'; mt = c; }
        break;
      }
      case 'hurt': { const c = this.t % 900; mode = c < 320 ? 'hurt' : 'idle'; mt = c; break; }
      case 'dead': { const c = this.t % 2200; mode = c < 1700 ? 'dead' : 'idle'; mt = c; break; }
    }
    const pose = resolvePose(this.cls, this.dir, poseQuery({ mode, t: mt, speed, vz, skill, stunMs: 320 }));
    this.view.render(ms, pose, this.stage.ox, this.stage.oy + 80, this.z, 0, this.dir);
  }

  setVisible(v: boolean): void { this.view.setVisible(v); }
  destroy(): void { this.view.destroy(); }
}

// ----------------------------------------------------------------------------------------------- panel

export class CosmeticPanel {
  open = false;
  tab: Tab = 'inventory';
  private root: HTMLDivElement;
  private inv: HTMLDivElement;
  private shop: HTMLDivElement;
  private invGrid!: HTMLDivElement;
  private shopGrid!: HTMLDivElement;
  private invTabs = new Map<InvCat, HTMLButtonElement>();
  private shopTabs = new Map<ShopCat, HTMLButtonElement>();
  private stateBtns: { el: HTMLButtonElement; s: PState }[] = [];
  private bundle!: HTMLDivElement;
  private invCat: InvCat = 'equipped';
  private shopCat: ShopCat = 'all';
  private selected: string | null = null;
  private tryOn: Equipped = {};
  private lastRect = '';
  private items: Item[];
  private cls: ClassKey;
  private qa = isQAMode();
  private invStage: PreviewStage;
  private shopStage: PreviewStage;
  private invPrev: CosPreview;
  private shopPrev: CosPreview;

  constructor(scene: Phaser.Scene, private host: HTMLElement, private canvas: HTMLCanvasElement, private character: Character,
    private getEquipped: () => Equipped, private onEquip: (e: Equipped) => void) {
    ensureStyles();
    this.cls = character.classId as ClassKey;
    this.items = (COSMETICS[this.cls] ?? []) as Item[];
    this.root = document.createElement('div');
    this.root.className = 'gol-cs gol-cp';
    host.appendChild(this.root);
    this.inv = this.buildInventory();
    this.shop = this.buildShop();
    this.invStage = new PreviewStage(scene, { x: INV_BG.x + INV_PREVIEW.x, y: INV_BG.y + INV_PREVIEW.y, w: INV_PREVIEW.w, h: INV_PREVIEW.h }, -26000, 30000, 2.2, 'ui-inv-preview');
    this.shopStage = new PreviewStage(scene, { x: SHOP_BG.x + SHOP_PREVIEW.x, y: SHOP_BG.y + SHOP_PREVIEW.y, w: SHOP_PREVIEW.w, h: SHOP_PREVIEW.h }, -22000, 30000, 2.2, 'ui-shop-preview');
    this.invPrev = new CosPreview(scene, this.invStage, this.cls);
    this.shopPrev = new CosPreview(scene, this.shopStage, this.cls);
    this.invPrev.setVisible(false); this.shopPrev.setVisible(false);
  }

  // ------------------------------------------------------------------ ownership (local store; backend-ready seam)

  private get owned(): Set<string> { return new Set(CharacterStore.getCosmetics(this.character.id).owned); }
  private grant(ids: string[]): void {
    const c = CharacterStore.getCosmetics(this.character.id);
    CharacterStore.setCosmetics(this.character.id, { owned: [...c.owned, ...ids], equipped: this.getEquipped() as Record<string, string> });
  }
  private isEquipped(it: Item): boolean {
    const e = this.getEquipped();
    if (it.type === 'set') return (it.parts ?? []).every((p) => { const s = slotOf(cosmetic(p)?.type ?? ''); return !!s && e[s] === p; });
    const s = slotOf(it.type);
    return !!s && e[s] === it.id;
  }
  private equip(it: Item): void {
    const e = { ...this.getEquipped() };
    for (const id of it.type === 'set' ? it.parts ?? [] : [it.id]) { const s = slotOf(cosmetic(id)?.type ?? ''); if (s) e[s] = id; }
    this.onEquip(e); this.refresh();
  }
  private unequip(it: Item): void {
    const e = { ...this.getEquipped() };
    for (const id of it.type === 'set' ? it.parts ?? [] : [it.id]) { const s = slotOf(cosmetic(id)?.type ?? ''); if (s && e[s] === id) delete e[s]; }
    this.onEquip(e); this.refresh();
  }
  private toggleEquip(it: Item): void { if (this.isEquipped(it)) this.unequip(it); else this.equip(it); }

  // ------------------------------------------------------------------ DOM

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; parent.appendChild(e); return e;
  }
  private place(e: HTMLElement, x: number, y: number, w?: number, h?: number): void {
    e.style.left = `${x}px`; e.style.top = `${y}px`; if (w !== undefined) e.style.width = `${w}px`; if (h !== undefined) e.style.height = `${h}px`;
  }
  private icon(id: string): string { return cosmetic(id)?.icon ?? ''; }

  private header(bg: HTMLDivElement, title: string, sub: string, swLabel: string, sw: Tab): void {
    this.el('div', 'ttl', bg, title);
    this.el('div', 'sub', bg, sub);
    const x = this.el('button', 'x', bg, '✕'); x.title = 'Close (Esc)'; x.addEventListener('click', () => this.close());
    const b = this.el('button', 'sw', bg, swLabel); b.addEventListener('click', () => this.show(sw));
  }

  private stateBar(bg: HTMLDivElement, x: number, y: number, w: number, prev: () => CosPreview): void {
    const bar = this.el('div', 'st', bg); this.place(bar, x, y, w);
    for (const [s, label] of STATES) {
      const b = this.el('button', '', bar, label);
      b.addEventListener('click', () => { prev().setState(s); this.syncStates(); });
      this.stateBtns.push({ el: b, s });
    }
    const bar2 = this.el('div', 'st', bg); this.place(bar2, x, y + 38, w);
    const l = this.el('button', '', bar2, '◀ Turn'); l.addEventListener('click', () => { prev().turn(-1); this.syncStates(); });
    const r = this.el('button', '', bar2, 'Turn ▶'); r.addEventListener('click', () => { prev().turn(1); this.syncStates(); });
    const a = this.el('button', 'auto', bar2, 'Auto-rotate'); a.addEventListener('click', () => { const p = prev(); p.autoTurn = !p.autoTurn; this.syncStates(); });
  }

  private syncStates(): void {
    const p = this.tab === 'inventory' ? this.invPrev : this.shopPrev;
    for (const b of this.stateBtns) b.el.classList.toggle('on', b.s === p.state);
    this.root.querySelectorAll('.auto').forEach((e) => e.classList.toggle('on', p.autoTurn));
  }

  private buildInventory(): HTMLDivElement {
    const bg = this.el('div', 'bg', this.root); this.place(bg, INV_BG.x, INV_BG.y, INV_BG.w, INV_BG.h);
    bg.style.backgroundImage = `url("${INV}/inventory_background.png")`;
    holeMask(bg, INV_PREVIEW);
    this.header(bg, 'INVENTORY', `${this.character.name} · ${CLASS_NAMES[this.cls] ?? this.cls} · cosmetics are visual only`, 'COSMETIC SHOP  (O)', 'shop');
    this.stateBar(bg, INV_PREVIEW.x, INV_PREVIEW.y + INV_PREVIEW.h + 14, INV_PREVIEW.w, () => this.invPrev);
    INV_TABS.forEach(([c, label], i) => {
      const b = this.el('button', 'tab', bg, label);
      b.style.backgroundImage = `url("${INV}/category_tab.png")`;
      this.place(b, 470 + (i % 4) * 172, 100 + Math.floor(i / 4) * 50, 164, 44);
      b.addEventListener('click', () => { this.invCat = c; this.refresh(); });
      this.invTabs.set(c, b);
    });
    this.invGrid = this.el('div', 'grid', bg); this.place(this.invGrid, 470, 214, 690, 556);
    return bg;
  }

  private buildShop(): HTMLDivElement {
    const bg = this.el('div', 'bg', this.root); this.place(bg, SHOP_BG.x, SHOP_BG.y, SHOP_BG.w, SHOP_BG.h);
    bg.style.backgroundImage = `url("${SHOP}/cashshop_background.png")`;
    holeMask(bg, SHOP_PREVIEW);
    const sub = this.qa ? 'QA build: every catalog item costs 0 · no payment integration' : 'The cosmetic shop is not open in this build';
    this.header(bg, 'COSMETIC SHOP', `Class: ${CLASS_NAMES[this.cls] ?? this.cls} · ${sub}`, 'INVENTORY  (I)', 'inventory');
    this.stateBar(bg, SHOP_PREVIEW.x, SHOP_PREVIEW.y + SHOP_PREVIEW.h + 12, SHOP_PREVIEW.w, () => this.shopPrev);
    this.bundle = this.el('div', 'bundle', bg); this.place(this.bundle, SHOP_PREVIEW.x - 6, 752, SHOP_PREVIEW.w + 12, 118);
    SHOP_TABS.forEach(([c, label], i) => {
      const b = this.el('button', 'tab', bg, label);
      b.style.backgroundImage = `url("${SHOP}/category_tab.png")`;
      this.place(b, 560 + i * 150, 100, 142, 42);
      b.addEventListener('click', () => { this.shopCat = c; this.refresh(); });
      this.shopTabs.set(c, b);
    });
    this.shopGrid = this.el('div', 'grid', bg); this.place(this.shopGrid, 560, 160, 900, 712);
    return bg;
  }

  // ------------------------------------------------------------------ content

  private refresh(): void {
    const e = this.getEquipped();
    this.invPrev.setEquipped(e);
    this.shopPrev.setEquipped({ ...e, ...this.tryOn });
    for (const [c, b] of this.invTabs) b.classList.toggle('on', c === this.invCat);
    for (const [c, b] of this.shopTabs) b.classList.toggle('on', c === this.shopCat);
    if (this.tab === 'inventory') this.renderInventory(); else this.renderShop();
    this.syncStates();
  }

  private renderInventory(): void {
    const g = this.invGrid; g.innerHTML = '';
    const owned = this.owned, e = this.getEquipped();
    const pieces = this.items.filter((it) => it.type !== 'set' && owned.has(it.id));
    if (this.invCat === 'equipped') {
      const slots = [...new Set(this.items.map((it) => slotOf(it.type)).filter((s): s is CosSlot => !!s))];
      slots.forEach((s, i) => {
        const row = this.el('div', 'row', g); row.style.top = `${i * 94}px`;
        const id = e[s], it = id ? this.items.find((x) => x.id === id) : undefined;
        const nm = this.el('div', 'rn', row, SLOT_LABEL[s]);
        this.el('small', '', nm, it ? it.name : 'Empty — class default');
        const pt = this.el('div', 'pt', row);
        if (it) { const im = this.el('img', '', pt); im.src = it.icon; im.alt = ''; }
        if (it) { const b = this.el('button', 'act alt', row, 'UNEQUIP'); b.addEventListener('click', () => this.unequip(it)); }
      });
      return;
    }
    if (this.invCat === 'sets') {
      const sets = this.items.filter((it) => it.type === 'set' && owned.has(it.id));
      if (!sets.length) { this.empty(g, 'No sets owned yet.'); return; }
      sets.forEach((it, i) => {
        const row = this.el('div', 'row', g); row.style.top = `${i * 94}px`;
        const nm = this.el('div', 'rn', row, it.name); this.el('small', '', nm, `${(it.parts ?? []).length} pieces · mix & match after equipping`);
        const pt = this.el('div', 'pt', row);
        for (const p of it.parts ?? []) { const im = this.el('img', '', pt); im.src = this.icon(p); im.alt = ''; im.title = cosmetic(p)?.name ?? p; }
        const on = this.isEquipped(it);
        const b = this.el('button', on ? 'act alt' : 'act', row, on ? 'UNEQUIP SET' : 'EQUIP SET');
        b.addEventListener('click', () => (on ? this.unequip(it) : this.equip(it)));
      });
      return;
    }
    const list = this.invCat === 'owned' ? pieces : pieces.filter((it) => catOf(it) === this.invCat);
    if (!list.length) { this.empty(g, 'Nothing owned in this category yet.'); return; }
    list.forEach((it, i) => {
      const c = this.el('div', 'cell', g); this.place(c, (i % 5) * 136, Math.floor(i / 5) * 154);
      c.classList.toggle('eq', this.isEquipped(it));
      this.el('div', 'sl', c);
      const im = this.el('img', '', c); im.src = it.icon; im.alt = '';
      this.el('div', 'nm', c, it.name);
      if (this.isEquipped(it)) this.el('div', 'eqt', c, 'EQUIPPED');
      c.title = `${TYPE_LABEL[it.type] ?? it.type} — click to ${this.isEquipped(it) ? 'unequip' : 'equip'}`;
      c.addEventListener('click', () => this.toggleEquip(it));
    });
  }

  private empty(g: HTMLElement, msg: string): void {
    const d = this.el('div', 'empty', g, msg);
    const b = this.el('button', 'act', d, 'OPEN COSMETIC SHOP'); b.style.marginTop = '14px'; b.style.display = 'inline-block';
    d.insertBefore(document.createElement('br'), b);
    b.addEventListener('click', () => this.show('shop'));
  }

  private renderShop(): void {
    const g = this.shopGrid; g.innerHTML = '';
    const owned = this.owned;
    const list = this.items.filter((it) => this.shopCat === 'all' || catOf(it) === this.shopCat)
      .sort((a, b) => (a.type === 'set' ? 0 : 1) - (b.type === 'set' ? 0 : 1));
    list.forEach((it, i) => {
      const c = this.el('div', 'card', g); this.place(c, 74 + (i % 4) * 192, Math.floor(i / 4) * 240);
      c.classList.toggle('sel', this.selected === it.id);
      const im = this.el('img', 'ic', c); im.src = it.icon; im.alt = '';
      this.el('div', 'nm', c, it.name);
      this.el('div', 'ty', c, it.type === 'set' ? `Full set · ${(it.parts ?? []).length} pieces` : TYPE_LABEL[it.type] ?? it.type);
      const pr = this.el('div', 'pr', c);
      const has = owned.has(it.id);
      if (has) this.el('span', 'own', pr, this.isEquipped(it) ? 'OWNED · EQUIPPED' : 'OWNED');
      else if (this.qa) { this.el('span', '', pr, '0'); const b = this.el('img', '', pr); b.src = `${SHOP}/qa_free_badge.png`; b.alt = 'QA free'; }
      else this.el('span', '', pr, '—');
      const bt = this.el('div', 'bt', c);
      const tryB = this.el('button', 'act alt', bt, 'TRY ON');
      tryB.addEventListener('click', (ev) => { ev.stopPropagation(); this.select(it); });
      const label = !has ? (this.qa ? 'GET FREE' : 'UNAVAILABLE') : this.isEquipped(it) ? 'UNEQUIP' : 'EQUIP';
      const act = this.el('button', 'act', bt, label);
      act.disabled = !has && !this.qa;
      act.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!has) { this.grant(it.type === 'set' ? [it.id, ...(it.parts ?? [])] : [it.id]); this.tryOn = {}; this.equip(it); return; }
        this.tryOn = {}; this.toggleEquip(it);
      });
      c.addEventListener('click', () => this.select(it));
    });
    this.renderBundle();
  }

  /** Select a shop card: live try-on on the preview (does not change what is equipped). */
  private select(it: Item): void {
    this.selected = it.id;
    this.tryOn = {};
    for (const id of it.type === 'set' ? it.parts ?? [] : [it.id]) { const s = slotOf(cosmetic(id)?.type ?? ''); if (s) this.tryOn[s] = id; }
    this.refresh();
  }

  private renderBundle(): void {
    const it = this.items.find((x) => x.id === this.selected);
    const b = this.bundle;
    b.classList.toggle('on', !!it);
    b.innerHTML = '';
    if (!it) return;
    this.el('div', 'bh', b, it.type === 'set' ? `SET BUNDLE — ${it.name.toUpperCase()} (previewing)` : `PREVIEWING — ${it.name.toUpperCase()}`);
    const bp = this.el('div', 'bp', b);
    const parts = it.type === 'set' ? it.parts ?? [] : [it.id];
    for (const p of parts) {
      const d = this.el('div', '', bp); const im = this.el('img', '', d); im.src = this.icon(p); im.alt = '';
      const c = cosmetic(p); this.el('span', '', d, c ? `${c.name}` : p);
    }
    if (it.type !== 'set') this.el('div', '', bp, it.desc.charAt(0).toUpperCase() + it.desc.slice(1));
  }

  // ------------------------------------------------------------------ open / close

  toggle(tab: Tab): void { if (this.open && this.tab === tab) this.close(); else this.show(tab); }

  show(tab: Tab): void {
    this.tab = tab; this.open = true;
    if (tab === 'inventory') { this.tryOn = {}; this.selected = null; }
    this.root.classList.add('open');
    this.inv.classList.toggle('on', tab === 'inventory');
    this.shop.classList.toggle('on', tab === 'shop');
    this.invStage.setVisible(tab === 'inventory'); this.invPrev.setVisible(tab === 'inventory');
    this.shopStage.setVisible(tab === 'shop'); this.shopPrev.setVisible(tab === 'shop');
    this.refresh();
    this.layout();
  }

  close(): void {
    if (!this.open) return;
    this.open = false; this.tryOn = {}; this.selected = null;
    this.root.classList.remove('open');
    this.invStage.setVisible(false); this.shopStage.setVisible(false);
    this.invPrev.setVisible(false); this.shopPrev.setVisible(false);
  }

  layout(): void { if (this.open) this.lastRect = syncOverlay(this.root, this.host, this.canvas, this.lastRect); }

  update(ms: number): void {
    if (!this.open) return;
    if (this.tab === 'inventory') this.invPrev.update(ms); else this.shopPrev.update(ms);
  }

  /** QA hooks. */
  get previewState(): { state: PState; dir: Dir; tryOn: Equipped } { const p = this.tab === 'inventory' ? this.invPrev : this.shopPrev; return { state: p.state, dir: p.dir, tryOn: this.tryOn }; }
  setPreview(state: PState, dir?: Dir): void { const p = this.tab === 'inventory' ? this.invPrev : this.shopPrev; p.setState(state); if (dir) { p.dir = dir; p.autoTurn = false; } this.syncStates(); }

  destroy(): void { this.invPrev.destroy(); this.shopPrev.destroy(); this.invStage.destroy(); this.shopStage.destroy(); this.root.remove(); }
}
