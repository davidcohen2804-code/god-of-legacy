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
const KIT = 'assets/final/ui/kit';
const INV_BG = { x: 160, y: 140, w: 1600, h: 800 };
const SHOP_BG = { x: 210, y: 90, w: 1500, h: 900 };
const INV_PREVIEW: Rect = { x: 48, y: 104, w: 430, h: 556 };
type InvTab = 'gear' | 'items' | 'materials' | 'key' | 'cosmetics';
const MAIN_TABS: [InvTab, string, string][] = [['gear', 'GEAR', 'icon_gear'], ['items', 'ITEMS', 'icon_items'], ['materials', 'MATERIALS', 'icon_materials'], ['key', 'KEY ITEMS', 'icon_key'], ['cosmetics', 'COSMETICS', 'icon_cosmetics']];
// sockets painted into kit/doll_panel.png (374x578): [label, centre x, centre y]
const DOLL: [string, number, number][] = [['Head', 187, 114], ['Weapon', 81, 168], ['Necklace', 293, 168], ['Armor', 73, 272], ['Earring', 299, 272], ['Gloves', 79, 372], ['Shield', 296, 372], ['Ring', 85, 464], ['Belt', 190, 462], ['Ring', 282, 464]];
const SHOP_PREVIEW: Rect = { x: 40, y: 104, w: 470, h: 540 };
const SLOT_LABEL: Record<CosSlot, string> = { head: 'Head', face: 'Face', back: 'Cape / Back', weapon: 'Weapon', aura: 'Aura', damage: 'Damage Skin', pet: 'Companion', hair: 'Hair Colour', armor: 'Armor Finish', hairstyle: 'Hairstyle', top: 'Chest Plate', gloves: 'Gauntlets', shoes: 'Boots', pants: 'Trousers', hat: 'Hat', faceacc: 'Face', earring: 'Earring', nametag: 'Name Tag', trail: 'Footstep Trail' };
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
.gol-cp .mt{position:absolute;display:flex;gap:10px}
.gol-cp .mt button{width:202px;height:58px;border:0;background:url("${KIT}/tab_normal.png") 0 0/100% 100%;display:flex;align-items:center;justify-content:center;gap:8px;
  color:#c9d3dc;font-size:16px;font-weight:700;letter-spacing:1.5px}
.gol-cp .mt button:hover{background-image:url("${KIT}/tab_hover.png")}
.gol-cp .mt button.on{background-image:url("${KIT}/tab_selected.png");color:#ffe2a0;filter:drop-shadow(0 0 8px rgba(110,170,255,.4))}
.gol-cp .mt button img{width:34px;height:34px;object-fit:contain}
.gol-cp .ct{position:absolute;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#c99a45 #0b121b}
.gol-cp .ks{position:absolute;width:84px;height:84px;background:url("${KIT}/slot_empty.png") 0 0/100% 100%}
.gol-cp .ks img{position:absolute;left:20px;top:20px;width:44px;height:44px;object-fit:contain;opacity:.55}
.gol-cp .ks small{position:absolute;left:-20px;right:-20px;top:88px;text-align:center;font-size:11px;letter-spacing:1px;color:#9fb0c0}
.gol-cp .sec{position:absolute;font-size:13px;letter-spacing:2px;color:#c99a45;font-weight:700}
.gol-cp .hint{position:absolute;font-size:14px;color:#8fa1b3;font-family:Georgia,serif}
.gol-cp .ctabs{position:absolute;display:flex;gap:6px;flex-wrap:nowrap}
.gol-cp .ctabs button{width:142px;height:44px;padding:0 18px;border:0;background:url("${KIT}/pill_normal.png") center/100% 100% no-repeat;color:#c9d6e2;font-size:12px;font-weight:700;letter-spacing:1px;white-space:nowrap}
.gol-cp .ctabs button:hover{background-image:url("${KIT}/pill_hover.png")}
.gol-cp .ctabs button.on{background-image:url("${KIT}/pill_selected.png");color:#ffe2a0}
.gol-cp .tb{position:absolute;display:flex;gap:8px}
.gol-cp .tb button{width:44px;height:44px;border:0;background:0 0/100% 100% no-repeat}
.gol-cp .tb button.sort{background-image:url("${KIT}/btn_sort.png")} .gol-cp .tb button.sort:hover{background-image:url("${KIT}/btn_sort_hover.png")}
.gol-cp .tb button.filter{background-image:url("${KIT}/btn_filter.png")} .gol-cp .tb button.filter:hover{background-image:url("${KIT}/btn_filter_hover.png")}
.gol-cp .tb button.search{background-image:url("${KIT}/btn_search.png")} .gol-cp .tb button.search:hover{background-image:url("${KIT}/btn_search_hover.png")}
.gol-cp .st button.arw{width:38px;height:40px;padding:0;border:0;color:transparent;background:url("${KIT}/btn_left.png") center/contain no-repeat}
.gol-cp .st button.arw:hover{background-image:url("${KIT}/btn_left_hover.png")}
.gol-cp .st button.arw.r{background-image:url("${KIT}/btn_right.png")} .gol-cp .st button.arw.r:hover{background-image:url("${KIT}/btn_right_hover.png")}
.gol-cp .kitbar{scrollbar-width:auto;scrollbar-color:auto}
.gol-cp .kitbar::-webkit-scrollbar{width:18px}
.gol-cp .kitbar::-webkit-scrollbar-track{background:url("${KIT}/scroll_track.png") center/100% 100% no-repeat}
.gol-cp .kitbar::-webkit-scrollbar-thumb{background:url("${KIT}/scroll_handle.png") center/contain no-repeat;min-height:30px}
.gol-cp .tip{position:absolute;width:224px;height:406px;background:url("${KIT}/tip_common.png") 0 0/100% 100% no-repeat;pointer-events:none;display:none;z-index:5;color:#dfe6ee;font-family:Georgia,serif}
.gol-cp .tip.on{display:block}
.gol-cp .tip .tn{position:absolute;left:66px;right:18px;top:24px;font:700 15px ${FONT_FAMILY};line-height:18px;color:#f3e2bf;text-shadow:0 1px 2px #000}
.gol-cp .tip .tt{position:absolute;left:66px;right:18px;top:64px;font-size:11px;letter-spacing:1.5px;color:#e8b25a;font-family:${FONT_FAMILY};text-transform:uppercase}
.gol-cp .tip img{position:absolute;left:62px;top:112px;width:100px;height:100px;object-fit:contain;filter:drop-shadow(0 4px 6px #000)}
.gol-cp .tip .td{position:absolute;left:24px;right:24px;top:226px;font-size:13px;line-height:1.4;color:#d7dee6}
.gol-cp .tip .te{position:absolute;left:24px;right:24px;bottom:26px;font:700 11px ${FONT_FAMILY};letter-spacing:1.5px;color:#8ff0a8;text-align:center}
.gol-cp .pnl{position:absolute;background:0 0/100% 100% no-repeat}
.gol-cp .sock{position:absolute;width:78px;height:78px;margin:-39px 0 0 -39px;border-radius:50%;cursor:pointer}
.gol-cp .sock:hover{box-shadow:0 0 14px 4px rgba(255,214,130,.45)}
.gol-cp .sock span{display:none;position:absolute;left:50%;top:84px;transform:translateX(-50%);white-space:nowrap;font-size:11px;letter-spacing:1.5px;color:#ffe2a0;background:#0b121bdd;padding:2px 8px;border-radius:4px}
.gol-cp .sock:hover span{display:block}
.gol-cp .cur{position:absolute;width:342px;height:74px;background:url("${KIT}/currency_bar.png") 0 0/100% 100%}
.gol-cp .cur b{position:absolute;top:26px;width:80px;text-align:center;font-size:16px;color:#ffe2a0;font-family:Georgia,serif}
.gol-cp .hdr{position:absolute;left:450px;top:18px;width:700px;height:82px;background:url("${KIT}/header.png") 0 0/100% 100% no-repeat;text-align:center;pointer-events:none}
.gol-cp .hdr .ttl{position:static;display:block;margin-top:27px;font-size:21px;line-height:24px;letter-spacing:4px}
.gol-cp .hdr .sub{position:static;display:block;font-size:11px;line-height:14px;letter-spacing:2px;color:#9fb0c0;text-transform:uppercase}
.gol-cp .sw.kit{height:58px;width:250px;padding:0 24px;border:0;background:url("${KIT}/pill_normal.png") center/100% 100% no-repeat;font-size:12px;letter-spacing:1px;color:#ffe2a0}
.gol-cp .sw.kit:hover{background-image:url("${KIT}/pill_hover.png")}
.gol-cp .row.kit{height:76px;background:linear-gradient(90deg,#15233a,#0b1422 60%,#0b1422);border:1px solid #6a5630;border-radius:8px;box-shadow:inset 0 0 0 1px #0a1018,0 2px 6px rgba(0,0,0,.5);padding:0 22px 0 18px}
.gol-cp .row.kit:before{content:'';width:6px;height:46px;border-radius:3px;background:linear-gradient(#f3d27a,#8a6420);margin-right:6px}
.gol-cp .row.kit .rn{width:220px}
.gol-cp .x.kit{border:0;background:url("${KIT}/close.png") 0 0/100% 100%;color:transparent;width:52px;height:52px}
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

  constructor(scene: Phaser.Scene, private stage: PreviewStage, readonly cls: ClassKey, private floor = 80) {
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
    this.view.render(ms, pose, this.stage.ox, this.stage.oy + this.floor, this.z, 0, this.dir);
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
  private mainTab: InvTab = 'gear';
  private mainTabs = new Map<InvTab, HTMLButtonElement>();
  private content!: HTMLDivElement;
  private tip!: HTMLDivElement;
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
    this.invStage = new PreviewStage(scene, { x: INV_BG.x + INV_PREVIEW.x, y: INV_BG.y + INV_PREVIEW.y, w: INV_PREVIEW.w, h: INV_PREVIEW.h }, -26000, 30000, 2.0, 'ui-inv-preview');
    this.shopStage = new PreviewStage(scene, { x: SHOP_BG.x + SHOP_PREVIEW.x, y: SHOP_BG.y + SHOP_PREVIEW.y, w: SHOP_PREVIEW.w, h: SHOP_PREVIEW.h }, -22000, 30000, 2.2, 'ui-shop-preview');
    this.invPrev = new CosPreview(scene, this.invStage, this.cls, 104);
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
    const l = this.el('button', 'arw', bar2, 'Turn left'); l.title = 'Turn left'; l.addEventListener('click', () => { prev().turn(-1); this.syncStates(); });
    const r = this.el('button', 'arw r', bar2, 'Turn right'); r.title = 'Turn right'; r.addEventListener('click', () => { prev().turn(1); this.syncStates(); });
    const a = this.el('button', 'auto', bar2, 'Auto-rotate'); a.addEventListener('click', () => { const p = prev(); p.autoTurn = !p.autoTurn; this.syncStates(); });
  }

  private syncStates(): void {
    const p = this.tab === 'inventory' ? this.invPrev : this.shopPrev;
    for (const b of this.stateBtns) b.el.classList.toggle('on', b.s === p.state);
    this.root.querySelectorAll('.auto').forEach((e) => e.classList.toggle('on', p.autoTurn));
  }

  private buildInventory(): HTMLDivElement {
    const bg = this.el('div', 'bg', this.root); this.place(bg, INV_BG.x, INV_BG.y, INV_BG.w, INV_BG.h);
    bg.style.backgroundImage = `url("${KIT}/window.png")`;
    holeMask(bg, INV_PREVIEW);
    this.header(bg, 'INVENTORY', `${this.character.name} · ${CLASS_NAMES[this.cls] ?? this.cls}`, 'COSMETIC SHOP  (O)', 'shop');
    const x = bg.querySelector('.x') as HTMLElement; x.classList.add('kit'); x.style.right = '34px'; x.style.top = '26px';
    const sw = bg.querySelector('.sw') as HTMLElement; sw.classList.add('kit'); sw.style.right = '92px'; sw.style.top = '22px';
    const hdr = this.el('div', 'hdr', bg); hdr.appendChild(bg.querySelector('.ttl')!); hdr.appendChild(bg.querySelector('.sub')!);
    this.stateBar(bg, INV_PREVIEW.x, INV_PREVIEW.y + INV_PREVIEW.h + 12, INV_PREVIEW.w, () => this.invPrev);
    const mt = this.el('div', 'mt', bg); this.place(mt, 508, 104);
    for (const [t, label, ic] of MAIN_TABS) {
      const b = this.el('button', '', mt); const im = this.el('img', '', b); im.src = `${KIT}/${ic}.png`; im.alt = ''; this.el('span', '', b, label);
      b.addEventListener('click', () => { this.mainTab = t; this.refresh(); });
      this.mainTabs.set(t, b);
    }
    this.content = this.el('div', 'ct', bg); this.place(this.content, 508, 182, 1050, 578);
    this.tip = this.el('div', 'tip', bg);
    return bg;
  }

  private slotGrid(parent: HTMLElement, x0: number, y0: number, cols: number, rows: number): void {
    for (let i = 0; i < cols * rows; i++) { const s = this.el('div', 'ks', parent); this.place(s, x0 + (i % cols) * 88, y0 + Math.floor(i / cols) * 88, 80, 80); }
  }

  private renderMain(): void {
    const c = this.content; c.innerHTML = '';
    for (const [t, b] of this.mainTabs) b.classList.toggle('on', t === this.mainTab);
    if (this.mainTab === 'cosmetics') {
      const ct = this.el('div', 'ctabs', c); this.place(ct, 0, 2, 1050);
      INV_TABS.forEach(([cat, label]) => { const b = this.el('button', '', ct, label); b.classList.toggle('on', cat === this.invCat); b.addEventListener('click', () => { this.invCat = cat; this.refresh(); }); });
      const pnl = this.el('div', 'pnl', c); this.place(pnl, 0, 56, 1050, 500); pnl.style.backgroundImage = `url("${KIT}/grid_panel_wide.png")`;
      this.invGrid = this.el('div', 'grid kitbar', pnl); this.place(this.invGrid, 44, 44, 980, 420);
      this.renderInventory();
      return;
    }
    if (this.mainTab === 'gear') {
      const doll = this.el('div', 'pnl', c); this.place(doll, 0, 0, 374, 578); doll.style.backgroundImage = `url("${KIT}/doll_panel.png")`;
      for (const [label, x, y] of DOLL) { const s = this.el('div', 'sock', doll); this.place(s, x, y); this.el('span', '', s, label.toUpperCase()); }
      const bag = this.el('div', 'pnl', c); this.place(bag, 400, 0, 650, 500); bag.style.backgroundImage = `url("${KIT}/grid_panel_bag.png")`;
      this.toolbar(bag, 650); this.slotGrid(bag, 61, 80, 6, 4);
      this.footer(c, 400, 'Gear drops and upgrades arrive with the adventure update.');
      return;
    }
    const pnl = this.el('div', 'pnl', c); this.place(pnl, 0, 0, 1050, 500); pnl.style.backgroundImage = `url("${KIT}/grid_panel_wide.png")`;
    this.toolbar(pnl, 1050); this.slotGrid(pnl, 85, 80, 10, 4);
    const label = { items: 'Potions, buffs and consumables will appear here.', materials: 'Upgrade stones, ores and monster drops will appear here.', key: 'Quest items, keys and tokens will appear here.' }[this.mainTab];
    this.footer(c, 0, label);
  }

  /** Sort / filter / search buttons (kit art) in a panel's top-right corner — visual only until items exist. */
  private toolbar(pnl: HTMLElement, w: number): void {
    const tb = this.el('div', 'tb', pnl); this.place(tb, w - 3 * 44 - 2 * 8 - 44, 16);
    for (const k of ['sort', 'filter', 'search']) { const b = this.el('button', k, tb); b.title = k[0].toUpperCase() + k.slice(1); }
  }

  /** Hover tooltip card (kit art, rarity-tinted gem) following the pointer inside the inventory window. */
  private hoverTip(cell: HTMLElement, it: Item): void {
    const rarity = it.type === 'set' ? 'epic' : it.type === 'weapon_animated' ? 'legendary' : it.type === 'aura' || it.type === 'weapon' || it.type === 'bow' || it.type === 'book' ? 'rare' : it.type === 'cape' || it.type === 'back' || it.type === 'head' || it.type === 'mask' ? 'uncommon' : 'common';
    cell.addEventListener('mouseenter', () => {
      const t = this.tip; t.innerHTML = ''; t.style.backgroundImage = `url("${KIT}/tip_${rarity}.png")`;
      this.el('div', 'tn', t, it.name); this.el('div', 'tt', t, TYPE_LABEL[it.type] ?? it.type);
      const im = this.el('img', '', t); im.src = it.icon; im.alt = '';
      this.el('div', 'td', t, it.desc); this.el('div', 'te', t, this.isEquipped(it) ? 'EQUIPPED' : 'CLICK TO EQUIP');
      t.classList.add('on');
    });
    cell.addEventListener('mousemove', (ev) => {
      const r = this.inv.getBoundingClientRect(), k = r.width / INV_BG.w;
      const x = Math.min(INV_BG.w - 232, (ev.clientX - r.left) / k + 18), y = Math.min(INV_BG.h - 414, Math.max(8, (ev.clientY - r.top) / k - 40));
      this.place(this.tip, x, y);
    });
    cell.addEventListener('mouseleave', () => this.tip.classList.remove('on'));
  }

  private footer(c: HTMLElement, x: number, hint: string): void {
    const cur = this.el('div', 'cur', c); this.place(cur, x, 504);
    this.el('b', '', cur, '0').style.left = '76px'; this.el('b', '', cur, '0').style.left = '232px';
    const n = this.el('div', 'hint', c, hint); this.place(n, x + 360, 530);
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
    for (const [c, b] of this.shopTabs) b.classList.toggle('on', c === this.shopCat);
    if (this.tab === 'inventory') this.renderMain(); else this.renderShop();
    this.syncStates();
  }

  private renderInventory(): void {
    const g = this.invGrid; g.innerHTML = ''; this.tip?.classList.remove('on');
    const owned = this.owned, e = this.getEquipped();
    const pieces = this.items.filter((it) => it.type !== 'set' && owned.has(it.id));
    if (this.invCat === 'equipped') {
      const slots = [...new Set(this.items.map((it) => slotOf(it.type)).filter((s): s is CosSlot => !!s))];
      slots.forEach((s, i) => {
        const row = this.el('div', 'row kit', g); row.style.top = `${i * 86}px`;
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
        const row = this.el('div', 'row kit', g); row.style.top = `${i * 86}px`;
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
      const c = this.el('div', 'cell', g); this.place(c, (i % 7) * 136, Math.floor(i / 7) * 154);
      this.hoverTip(c, it);
      c.classList.toggle('eq', this.isEquipped(it));
      this.el('div', 'sl', c);
      const im = this.el('img', '', c); im.src = it.icon; im.alt = '';
      this.el('div', 'nm', c, it.name);
      if (this.isEquipped(it)) this.el('div', 'eqt', c, 'EQUIPPED');
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
