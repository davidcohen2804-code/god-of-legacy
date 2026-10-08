// Inventory (I) and Cosmetic Shop (O). The inventory's GEAR tab holds the character's equipment (MapleStory-style: worn
// pieces in the equipment slots, the rest in the bag; take off / wear, stats on every piece); cosmetics have no stats and
// no payment. Both views share one live Phaser preview of the real body with its layers, cycling through every animation
// state and both directions. Ownership / equipped / worn ids persist in the local character store (abstract enough for a
// backend). Drawn in the game's window style (theme.ts).
import Phaser from 'phaser';
import { CLASS_NAMES } from '../config/layout';
import { Character } from '../characters/CharacterTypes';
import { CharacterStore } from '../characters/CharacterStore';
import { genderOf, headLookOf } from '../characters/Look';
import { syncOverlay } from './CharacterSelectUI';
import { PreviewStage, Rect, holeMask } from './PreviewStage';
import { ActorView, COSMETICS, CosSlot, Equipped, cosmetic, slotOf } from '../game/ActorView';
import { BaseLook, ClassKey, resolvePose } from '../game/Body';
import { AnimSnap, LAND_MS, Mode, poseQuery } from '../game/PoseState';
import { Dir } from '../world/collision';
import { kitFor } from '../skills/FinalKit';
import { isQAMode } from '../qa/QAPanel';
import { keyLabel, loadBindings } from '../game/KeyBindings';
import { GEAR, GearItem, GearSlot, GearState, SLOT_NAMES, WornLook, bagItems, gearStats, itemName, starterGear, takeOff, wear, wornItem, wornLook } from '../items/Gear';
import { ICONS, IconName, ensureTheme } from './theme';

type Tab = 'inventory' | 'shop';
type InvCat = 'equipped' | 'owned' | 'sets' | 'fashion' | 'weapon' | 'headface' | 'back' | 'aura';
type ShopCat = 'all' | 'sets' | 'fashion' | 'weapon' | 'headface' | 'back' | 'aura';
type PState = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt' | 'dead';
interface Item { id: string; type: string; icon: string; name: string; desc: string; parts?: string[] }

/** Both windows (design px): same place and size; the live preview's stage (window-local) on the left. */
const WIN = { x: 196, y: 136, w: 1528, h: 808 };
const INV_BG = WIN, SHOP_BG = WIN;
const PREVIEW: Rect = { x: 28, y: 92, w: 340, h: 560 };
const INV_PREVIEW = PREVIEW, SHOP_PREVIEW = PREVIEW;
/** The right side: tabs, then the content panel. */
const CONTENT = { x: 396, y: 92, w: 1104 };
const PANEL: Rect = { x: CONTENT.x, y: 150, w: CONTENT.w, h: 574 };
type InvTab = 'gear' | 'items' | 'materials' | 'key' | 'cosmetics';
const MAIN_TABS: [InvTab, string][] = [['gear', 'Gear'], ['items', 'Items'], ['materials', 'Materials'], ['key', 'Key Items'], ['cosmetics', 'Cosmetics']];
/** The equipment slots, head to toe (left column: what can be worn now; right: gear still to come). */
const DOLL: [string, IconName, GearSlot?][] = [['Head', 'helmet', 'head'], ['Necklace', 'necklace'], ['Weapon', 'sword', 'weapon'], ['Earring', 'earring'], ['Top', 'shirt', 'top'],
  ['Shield', 'shield'], ['Bottom', 'pants', 'bottom'], ['Belt', 'belt'], ['Shoes', 'boots', 'shoes'], ['Ring', 'ring']];
/** Bag / grid slots. */
const SLOT = 72, GAP = 12;
/** A piece's icon (bag, equipment, tooltip). */
const gearIcon = (it: GearItem) => `assets/items/${it.id}${GEAR[it.id]?.colors ? `_c${it.color}` : ''}.png`;
const TIP_W = 270;
const SLOT_LABEL: Record<CosSlot, string> = { head: 'Head', face: 'Face', back: 'Cape / Back', weapon: 'Weapon', aura: 'Aura', damage: 'Damage Skin', pet: 'Companion', hair: 'Hair Colour', armor: 'Armor Finish', hairstyle: 'Hairstyle', top: 'Top', gloves: 'Gloves', shoes: 'Shoes', pants: 'Bottoms', hat: 'Hat', faceacc: 'Face', earring: 'Earring', nametag: 'Name Tag', trail: 'Footstep Trail' };
const TYPE_LABEL: Record<string, string> = {
  head: 'Head', mask: 'Face', cape: 'Cape', back: 'Back', weapon: 'Weapon skin', weapon_animated: 'Animated weapon skin', bow: 'Bow skin',
  book: 'Book skin', aura: 'Aura', set: 'Full set', hat: 'Hat', faceacc: 'Face accessory', earring: 'Earring', hair: 'Hair colour',
  hairstyle: 'Hairstyle', armor: 'Armor finish', top: 'Top', gloves: 'Gloves', shoes: 'Shoes', pants: 'Bottoms',
  nametag: 'Name tag', trail: 'Footstep trail', damage: 'Damage skin', pet: 'Companion',
};
const INV_TABS: [InvCat, string][] = [['equipped', 'Equipped'], ['owned', 'Owned'], ['sets', 'Sets'], ['fashion', 'Clothes'], ['weapon', 'Weapon Skins'], ['headface', 'Head / Face'], ['back', 'Cape / Back'], ['aura', 'Aura / Effects']];
const SHOP_TABS: [ShopCat, string][] = [['all', 'All'], ['sets', 'Sets'], ['fashion', 'Clothes'], ['weapon', 'Weapons'], ['headface', 'Head / Face'], ['back', 'Cape / Back'], ['aura', 'Aura / Effects']];
const STATES: [PState, string][] = [['idle', 'Idle'], ['walk', 'Walk'], ['run', 'Run'], ['jump', 'Jump'], ['attack', 'Attack'], ['hurt', 'Hit'], ['dead', 'Death']];
const DIRS: Dir[] = ['right', 'left']; // side view only

const catOf = (it: Item): Exclude<ShopCat, 'all'> => {
  if (it.type === 'set') return 'sets';
  const s = slotOf(it.type);
  if (s === 'top' || s === 'pants' || s === 'shoes' || s === 'gloves' || s === 'hair' || s === 'hairstyle') return 'fashion';
  return s === 'weapon' ? 'weapon' : s === 'head' || s === 'face' || s === 'hat' || s === 'faceacc' || s === 'earring' ? 'headface' : s === 'back' ? 'back' : 'aura';
};
const rarityOf = (it: Item): string => it.type === 'set' ? 'Epic' : it.type === 'weapon_animated' || it.type === 'damage' ? 'Legendary'
  : ['aura', 'weapon', 'bow', 'book', 'trail', 'pet'].includes(it.type) ? 'Rare' : ['cape', 'back', 'head', 'mask', 'hat', 'armor', 'hairstyle'].includes(it.type) ? 'Uncommon' : 'Common';
const RARITY_COLOR: Record<string, string> = { Common: '#c9d1dc', Uncommon: '#8fe0a0', Rare: '#86bdf0', Epic: '#c39bf0', Legendary: '#f4c46a' };

const STYLE_ID = 'gol-cosmetic-style';
const CSS = `
.gol-cp{z-index:40;display:none}
.gol-cp.open{display:block}
.gol-cp .bg{display:none}
.gol-cp .bg.on{display:block}
.gol-cp .gl-head .sw{height:38px;padding:0 16px;font-size:13.5px}
.gol-cp .gl-head .sw .gl-key{margin-left:4px}
/* the preview's stage, its frame and controls */
.gol-cp .stage{position:absolute;border-radius:16px;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
.gol-cp .st{position:absolute;height:48px;display:flex;align-items:center;justify-content:center;gap:6px}
.gol-cp .st .sn{width:84px;text-align:center;font:600 14px var(--gl-body);letter-spacing:.4px;color:var(--gl-text)}
.gol-cp .st .ib{width:36px;height:36px;padding:0;border-radius:10px;border:1px solid var(--gl-line2);background:rgba(255,255,255,.04);color:var(--gl-text2);cursor:pointer;
  display:grid;place-items:center;transition:background 120ms,color 120ms,border-color 120ms}
.gol-cp .st .ib::before{content:'';width:16px;height:16px;background:currentColor;-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.gol-cp .st .ib:hover{background:rgba(255,255,255,.08);color:var(--gl-text);border-color:var(--gl-goldline)}
.gol-cp .st .sep{width:1px;height:24px;margin:0 6px;background:var(--gl-line2)}
.gol-cp .st .auto{height:36px;padding:0 14px;font-size:13px}
.gol-cp .st .auto.on{border-color:rgba(231,196,124,.6);color:var(--gl-gold2);background:var(--gl-goldsoft)}
/* the right side */
.gol-cp .tabsrow{position:absolute;left:${CONTENT.x}px;top:${CONTENT.y}px;width:${CONTENT.w}px}
.gol-cp .ct{position:absolute;left:${PANEL.x}px;top:${PANEL.y}px;width:${PANEL.w}px;height:${PANEL.h}px;overflow:hidden}
.gol-cp .foot{position:absolute;left:${CONTENT.x}px;top:${PANEL.y + PANEL.h + 14}px;width:${CONTENT.w}px;height:40px;display:flex;align-items:center;gap:22px}
.gol-cp .curr{display:flex;align-items:center;gap:8px;font:600 14px var(--gl-body);color:var(--gl-text2)}
.gol-cp .curr b{font:700 15px var(--gl-body);color:var(--gl-text);font-variant-numeric:tabular-nums}
.gol-cp .hint{margin-left:auto;font:500 13.5px var(--gl-body);color:var(--gl-text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* gear: equipment slots, stats, the bag */
.gol-cp .eq{position:absolute;left:24px;top:22px;width:196px}
.gol-cp .eq .gl-cap{display:block;margin-bottom:14px}
.gol-cp .eq .grid2{display:grid;grid-template-columns:repeat(2,${SLOT}px);column-gap:24px;row-gap:12px}
.gol-cp .es{display:flex;flex-direction:column;align-items:center;gap:5px}
.gol-cp .es small{font:500 11.5px var(--gl-body);color:var(--gl-text3);white-space:nowrap}
.gol-cp .sl{width:${SLOT}px;height:${SLOT}px;display:grid;place-items:center}
.gol-cp .sl > i{width:28px;height:28px;background:rgba(174,182,195,.22);-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.gol-cp .sl.later > i{background:rgba(174,182,195,.1)}
.gol-cp .sl img{width:54px;height:54px;object-fit:contain;pointer-events:none}
.gol-cp .sl.worn{background:linear-gradient(180deg,#1a2740,#0e1626);border-color:rgba(231,196,124,.35)}
.gol-cp .vr{position:absolute;left:236px;top:22px;bottom:22px;width:1px;background:var(--gl-line)}
.gol-cp .bagwrap{position:absolute;left:276px;top:22px;right:24px;bottom:22px}
.gol-cp .bagtop{display:flex;align-items:center;justify-content:space-between;height:36px;margin-bottom:16px}
.gol-cp .gstat{display:flex;gap:26px;font:600 14px var(--gl-body);color:var(--gl-text2)}
.gol-cp .gstat b{margin-left:8px;font:700 18px var(--gl-body);color:var(--gl-text);font-variant-numeric:tabular-nums}
.gol-cp .tb{display:flex;gap:8px}
.gol-cp .tb button{width:36px;height:36px;padding:0;border-radius:10px;border:1px solid var(--gl-line2);background:rgba(255,255,255,.04);color:var(--gl-text2);cursor:pointer;display:grid;place-items:center;
  transition:background 120ms,color 120ms}
.gol-cp .tb button::before{content:'';width:17px;height:17px;background:currentColor;-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.gol-cp .tb button:hover{background:rgba(255,255,255,.08);color:var(--gl-text)}
.gol-cp .bag{display:grid;grid-template-columns:repeat(8,${SLOT}px);gap:${GAP}px}
.gol-cp .bag.wide{grid-template-columns:repeat(12,${SLOT}px);justify-content:center}
.gol-cp .sl.it{cursor:pointer}
.gol-cp .sl.it:hover{border-color:rgba(231,196,124,.55);transform:translateY(-2px)}
.gol-cp .soonhint{margin-top:22px;text-align:center;font:500 14.5px var(--gl-body);color:var(--gl-text2)}
/* cosmetics (inventory) */
.gol-cp .ctabs{position:absolute;left:24px;top:20px;right:24px}
.gol-cp .ctabs .gl-seg{flex-wrap:wrap}
.gol-cp .grid{position:absolute;left:24px;right:16px;top:84px;bottom:18px;padding-right:8px}
.gol-cp .cells{display:grid;grid-template-columns:repeat(auto-fill,128px);gap:14px}
.gol-cp .cell{position:relative;height:150px;border-radius:14px;cursor:pointer;text-align:center;background:var(--gl-inset);border:1px solid rgba(255,255,255,.07);transition:border-color 120ms,transform 120ms}
.gol-cp .cell:hover{border-color:rgba(231,196,124,.5);transform:translateY(-2px)}
.gol-cp .cell.eq{border-color:rgba(126,212,146,.6)}
.gol-cp .cell img{position:absolute;left:24px;top:14px;width:80px;height:80px;object-fit:contain;pointer-events:none}
.gol-cp .cell .nm{position:absolute;left:8px;right:8px;top:104px;font:600 12.5px/1.3 var(--gl-body);color:var(--gl-text)}
.gol-cp .cell .eqt{position:absolute;right:8px;top:8px}
.gol-cp .rows{display:flex;flex-direction:column;gap:10px}
.gol-cp .row{display:flex;align-items:center;gap:14px;min-height:72px;padding:0 16px 0 20px}
.gol-cp .row .rn{width:240px;font:600 15px var(--gl-body);color:var(--gl-text)}
.gol-cp .row .rn small{display:block;font:500 13px var(--gl-body);color:var(--gl-text2);margin-top:2px}
.gol-cp .row .pt{display:flex;gap:6px;flex:1}
.gol-cp .row img{width:48px;height:48px;object-fit:contain;border-radius:8px;background:rgba(0,0,0,.25)}
.gol-cp .empty{display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:110px;text-align:center;font:500 16px/1.5 var(--gl-body);color:var(--gl-text2)}
.gol-cp .soon{position:absolute;inset:0}
.gol-cp .soon i{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;background:var(--gl-goldsoft);color:var(--gl-gold2);box-shadow:inset 0 0 0 1px rgba(231,196,124,.3)}
.gol-cp .soon i::before{content:'';width:28px;height:28px;background:currentColor;-webkit-mask:${ICONS.sparkle} center/contain no-repeat;mask:${ICONS.sparkle} center/contain no-repeat}
/* shop */
.gol-cp .stabs{position:absolute;left:${CONTENT.x}px;top:${CONTENT.y}px}
.gol-cp .sgrid{position:absolute;left:${PANEL.x}px;top:${PANEL.y}px;width:${PANEL.w}px;height:470px}
.gol-cp .sgrid .in{position:absolute;inset:18px 12px 18px 22px;padding-right:10px}
.gol-cp .kcards{display:grid;grid-template-columns:repeat(auto-fill,176px);gap:16px}
.gol-cp .kcard{position:relative;height:226px;border-radius:14px;cursor:pointer;background:var(--gl-inset);border:1px solid rgba(255,255,255,.07);transition:border-color 120ms,transform 120ms}
.gol-cp .kcard:hover{border-color:rgba(231,196,124,.5);transform:translateY(-2px)}
.gol-cp .kcard.sel{border-color:var(--gl-gold);box-shadow:0 0 0 3px rgba(231,196,124,.16)}
.gol-cp .kcard img.ic{position:absolute;left:38px;top:22px;width:100px;height:100px;object-fit:contain;pointer-events:none}
.gol-cp .kcard .nm{position:absolute;left:10px;right:10px;top:138px;text-align:center;font:600 13.5px var(--gl-body);color:var(--gl-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-cp .kcard .pr{position:absolute;left:10px;right:10px;top:170px;height:36px;display:flex;justify-content:center;align-items:center;gap:7px;border-radius:10px;
  background:rgba(255,255,255,.04);font:700 13.5px var(--gl-body);color:var(--gl-gold2)}
.gol-cp .kcard.own .pr{color:var(--gl-green)}
.gol-cp .abar{position:absolute;left:${PANEL.x}px;top:${PANEL.y + 486}px;width:${PANEL.w}px;height:88px;display:flex;align-items:center;gap:16px;padding:0 18px 0 16px}
.gol-cp .abar .ai{width:58px;height:58px;object-fit:contain;border-radius:10px;background:rgba(0,0,0,.25)}
.gol-cp .abar .at{flex:1;min-width:0;font:500 14px/1.45 var(--gl-body);color:var(--gl-text2)}
.gol-cp .abar .at b{display:block;font:700 17px var(--gl-title);letter-spacing:.8px;color:#f3e3bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-cp .abar .at .parts{display:flex;gap:4px;margin-top:4px}
.gol-cp .abar .at .parts img{width:26px;height:26px;object-fit:contain;border-radius:6px;background:rgba(0,0,0,.3)}
/* the hover card */
.gol-cp .tip{position:absolute;width:${TIP_W}px;padding:14px 16px 14px;display:none;z-index:5;pointer-events:none}
.gol-cp .tip.on{display:block}
.gol-cp .tip .th{display:flex;align-items:center;gap:12px}
.gol-cp .tip .th img{width:56px;height:56px;object-fit:contain;border-radius:10px;background:rgba(0,0,0,.25);flex:none}
.gol-cp .tip .tn{font:700 15px/1.3 var(--gl-title);letter-spacing:.6px;color:#f3e3bd}
.gol-cp .tip .tt{margin-top:3px;font:700 11px var(--gl-body);letter-spacing:1.4px;text-transform:uppercase}
.gol-cp .tip .tb{display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--gl-line)}
.gol-cp .tip .ts{font:700 14px/1.5 var(--gl-body);color:var(--gl-green)}
.gol-cp .tip .td{font:400 13.5px/1.5 var(--gl-body);color:#d9d4c8}
.gol-cp .tip .te{margin-top:10px;font:600 12px var(--gl-body);color:var(--gl-text3)}
`;

function ensureStyles(): void {
  ensureTheme();
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
}

// ----------------------------------------------------------------------------------------------- live preview

class CosPreview {
  private view: ActorView;
  state: PState = 'idle';
  dir: Dir = 'right';
  autoTurn = true;
  private t = 0;
  private turnT = 0;
  private z = 0;
  private vz = 0;
  private basic;

  constructor(scene: Phaser.Scene, private stage: PreviewStage, readonly cls: ClassKey, private floor = 80, private gender: 'male' | 'female' = 'male', look: BaseLook | null = null) {
    this.basic = kitFor(cls)[0];
    this.view = new ActorView(scene, cls, stage.ox, stage.oy);
    this.view.setBaseLook(look, gender);
  }

  setEquipped(e: Equipped): void { this.view.setEquipped(e); }
  setGear(w: WornLook): void { this.view.setGear(w, this.gender); }
  setState(s: PState): void { this.state = s; this.t = 0; this.z = 0; this.vz = 0; }
  turn(step: number): void { this.dir = DIRS[(DIRS.indexOf(this.dir) + step + 2) % 2]; this.autoTurn = false; this.turnT = 0; }

  update(ms: number): void {
    this.t += ms;
    if (this.autoTurn) { this.turnT += ms; if (this.turnT > 2200) { this.turnT = 0; this.dir = DIRS[(DIRS.indexOf(this.dir) + 1) % 2]; } }
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
    const pose = resolvePose(this.cls, this.dir, poseQuery({ mode, t: mt, speed, vz, skill, stunMs: 320 }), this.view.wantsBase, this.gender);
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
  private shopTabs = new Map<ShopCat, HTMLButtonElement>();
  /** The preview's animation name (one per window) and the window-switch buttons (labels follow Key Settings). */
  private stateLabels: HTMLDivElement[] = [];
  private swBtns: { el: HTMLButtonElement; label: string; action: 'bag' | 'shop' }[] = [];
  private bundle!: HTMLDivElement;
  private invCat: InvCat = 'equipped';
  private mainTab: InvTab = 'gear';
  private mainTabs = new Map<InvTab, HTMLButtonElement>();
  private content!: HTMLDivElement;
  private tip!: HTMLDivElement;
  private invHint!: HTMLDivElement;
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
    private getEquipped: () => Equipped, private onEquip: (e: Equipped) => void, private onGear?: (g: GearState) => void) {
    ensureStyles();
    this.cls = character.classId as ClassKey;
    this.items = (COSMETICS[this.cls] ?? []) as Item[];
    this.root = document.createElement('div');
    this.root.className = 'gol-cs gol-cp';
    host.appendChild(this.root);
    this.inv = this.buildInventory();
    this.shop = this.buildShop();
    this.invStage = new PreviewStage(scene, { x: INV_BG.x + INV_PREVIEW.x, y: INV_BG.y + INV_PREVIEW.y, w: INV_PREVIEW.w, h: INV_PREVIEW.h }, -26000, 30000, 2.0, 'gl-inv-stage');
    this.shopStage = new PreviewStage(scene, { x: SHOP_BG.x + SHOP_PREVIEW.x, y: SHOP_BG.y + SHOP_PREVIEW.y, w: SHOP_PREVIEW.w, h: SHOP_PREVIEW.h }, -22000, 30000, 2.0, 'gl-shop-stage');
    this.invPrev = new CosPreview(scene, this.invStage, this.cls, 104, genderOf(character), headLookOf(character));
    this.shopPrev = new CosPreview(scene, this.shopStage, this.cls, 104, genderOf(character), headLookOf(character));
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

  // ------------------------------------------------------------------ equipment (gear: stats, drawn on the character)

  private get gear(): GearState { return CharacterStore.getGear(this.character.id) ?? starterGear(this.character.look); }
  private setGear(g: GearState): void {
    CharacterStore.setGear(this.character.id, g);
    this.tip.classList.remove('on');
    this.onGear?.(this.gear); this.refresh();
  }

  // ------------------------------------------------------------------ DOM

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; parent.appendChild(e); return e;
  }
  private place(e: HTMLElement, x: number, y: number, w?: number, h?: number): void {
    e.style.left = `${x}px`; e.style.top = `${y}px`; if (w !== undefined) e.style.width = `${w}px`; if (h !== undefined) e.style.height = `${h}px`;
  }
  private icon(id: string): string { return cosmetic(id)?.icon ?? ''; }
  private iconBtn(cls: string, parent: HTMLElement, name: IconName, title: string): HTMLButtonElement {
    const b = this.el('button', cls, parent); b.type = 'button'; b.style.setProperty('--i', ICONS[name]); b.title = title; b.setAttribute('aria-label', title); return b;
  }

  /** Window title, its subtitle, the switch to the other window and the close button. */
  private header(bg: HTMLDivElement, title: string, sub: string, swLabel: string, sw: Tab): void {
    const hd = this.el('div', 'gl-head', bg);
    this.el('div', 'gl-title', hd, title);
    this.el('div', 'gl-sub', hd, sub);
    this.el('div', 'gl-sp', hd);
    const b = this.el('button', 'gl-btn sw', hd, swLabel); b.type = 'button'; b.addEventListener('click', () => this.show(sw));
    this.swBtns.push({ el: b, label: swLabel, action: sw === 'shop' ? 'shop' : 'bag' });
    const x = this.el('button', 'gl-x', hd); x.type = 'button'; x.title = 'Close (Esc)'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', () => this.close());
  }

  /** The preview's controls in one row: ◀ ANIMATION ▶ (idle, walk, run, jump, attack, hit, death), TURN, AUTO-ROTATE. */
  private stateBar(bg: HTMLDivElement, prev: () => CosPreview): void {
    const bar = this.el('div', 'st', bg); this.place(bar, PREVIEW.x, PREVIEW.y + PREVIEW.h + 12, PREVIEW.w);
    const step = (d: number) => { const p = prev(), i = STATES.findIndex(([s]) => s === p.state); p.setState(STATES[(i + d + STATES.length) % STATES.length][0]); this.syncStates(); };
    this.iconBtn('ib', bar, 'left', 'Previous animation').addEventListener('click', () => step(-1));
    this.stateLabels.push(this.el('div', 'sn', bar));
    this.iconBtn('ib', bar, 'right', 'Next animation').addEventListener('click', () => step(1));
    this.el('i', 'sep', bar);
    this.iconBtn('ib', bar, 'rotate', 'Turn around').addEventListener('click', () => { prev().turn(1); this.syncStates(); });
    const a = this.el('button', 'gl-btn auto', bar, 'Rotate'); a.type = 'button'; a.title = 'Keep turning around by itself'; a.addEventListener('click', () => { const p = prev(); p.autoTurn = !p.autoTurn; this.syncStates(); });
  }

  private syncStates(): void {
    const p = this.tab === 'inventory' ? this.invPrev : this.shopPrev;
    const name = STATES.find(([s]) => s === p.state)?.[1] ?? '';
    for (const l of this.stateLabels) l.textContent = name;
    this.root.querySelectorAll('.auto').forEach((e) => e.classList.toggle('on', p.autoTurn));
  }

  /** The window, its stage for the live preview (a hole the scene's preview camera shows through, with a fine frame). */
  private windowFrame(): HTMLDivElement {
    const bg = this.el('div', 'bg gl-win', this.root); this.place(bg, WIN.x, WIN.y, WIN.w, WIN.h);
    holeMask(bg, PREVIEW);
    const st = this.el('div', 'stage', bg); this.place(st, PREVIEW.x, PREVIEW.y, PREVIEW.w, PREVIEW.h);
    return bg;
  }

  private buildInventory(): HTMLDivElement {
    const bg = this.windowFrame();
    this.header(bg, 'INVENTORY', `${this.character.name} · ${CLASS_NAMES[this.cls] ?? this.cls}`, 'Cosmetic Shop', 'shop');
    this.stateBar(bg, () => this.invPrev);
    const tabs = this.el('div', 'tabsrow gl-tabs', bg);
    for (const [t, label] of MAIN_TABS) {
      const b = this.el('button', 'gl-tab', tabs, label); b.type = 'button';
      b.addEventListener('click', () => { this.mainTab = t; this.refresh(); });
      this.mainTabs.set(t, b);
    }
    this.content = this.el('div', 'ct gl-sec', bg);
    const foot = this.el('div', 'foot', bg);
    for (const [name, cls] of [['Gold', 'gl-coin'], ['Gems', 'gl-gem']]) { const c = this.el('div', 'curr', foot); this.el('i', cls, c); this.el('span', '', c, name); this.el('b', '', c, '0'); }
    this.invHint = this.el('div', 'hint', foot);
    this.tip = this.el('div', 'tip gl-tip', bg);
    return bg;
  }

  /** An empty grid (items, materials, key items until they exist). */
  private slotGrid(parent: HTMLElement, n: number): void {
    const g = this.el('div', 'bag wide', parent);
    for (let i = 0; i < n; i++) this.el('div', 'sl gl-slot', g);
  }

  private renderMain(): void {
    const c = this.content; c.innerHTML = ''; this.tip?.classList.remove('on');
    for (const [t, b] of this.mainTabs) b.classList.toggle('on', t === this.mainTab);
    if (this.mainTab === 'cosmetics') {
      this.invHint.textContent = '';
      if (!this.items.length) {   // none yet: they come with a later update
        const d = this.el('div', 'soon gl-empty', c); this.el('i', '', d);
        this.el('b', '', d, 'NO COSMETICS YET'); this.el('span', '', d, 'New cosmetics arrive with an upcoming update.');
        return;
      }
      const ct = this.el('div', 'ctabs', c), seg = this.el('div', 'gl-seg', ct);
      INV_TABS.forEach(([cat, label]) => { const b = this.el('button', '', seg, label); b.type = 'button'; b.classList.toggle('on', cat === this.invCat); b.addEventListener('click', () => { this.invCat = cat; this.refresh(); }); });
      this.invGrid = this.el('div', 'grid gl-scroll', c);
      this.renderInventory();
      return;
    }
    if (this.mainTab === 'gear') { // the worn pieces in the equipment slots (click: take off), the rest in the bag (click: wear)
      const g = this.gear;
      const eq = this.el('div', 'eq', c); this.el('span', 'gl-cap', eq, 'Equipped');
      const two = this.el('div', 'grid2', eq);
      for (const [label, ic, slot] of DOLL) {
        const es = this.el('div', 'es', two);
        const s = this.el('div', `sl gl-slot${slot ? '' : ' later'}`, es);
        const it = slot ? wornItem(g, slot) : null;
        if (slot && it) {
          s.classList.add('worn', 'it'); const im = this.el('img', '', s); im.src = gearIcon(it); im.alt = '';
          this.gearTip(s, it, true); s.addEventListener('click', () => this.setGear(takeOff(this.gear, slot)));
        } else { const i = this.el('i', '', s); i.style.setProperty('--i', ICONS[ic]); s.title = slot ? `${label} — empty` : `${label} — coming later`; }
        this.el('small', '', es, label);
      }
      this.el('div', 'vr', c);
      const bw = this.el('div', 'bagwrap', c), top = this.el('div', 'bagtop', bw);
      const st = gearStats(g), gs = this.el('div', 'gstat', top);
      for (const [k, v] of [['Attack', st.att], ['Defense', st.def]] as const) { const sp = this.el('span', '', gs, k); this.el('b', '', sp, String(v)); }
      this.toolbar(top);
      const bag = bagItems(g), grid = this.el('div', 'bag', bw);
      for (let i = 0; i < 32; i++) {
        const cell = this.el('div', 'sl gl-slot', grid);
        const it = bag[i]; if (!it) continue;
        cell.classList.add('it'); const im = this.el('img', '', cell); im.src = gearIcon(it); im.alt = '';
        this.gearTip(cell, it, false); cell.addEventListener('click', () => this.setGear(wear(this.gear, it.uid)));
      }
      this.invHint.textContent = 'Click a worn piece to take it off · click a piece in the bag to wear it';
      return;
    }
    const wrap = this.el('div', 'bagwrap', c); wrap.style.left = '24px';
    const top = this.el('div', 'bagtop', wrap); this.el('span', 'gl-cap', top, MAIN_TABS.find(([t]) => t === this.mainTab)?.[1] ?? ''); this.toolbar(top);
    this.slotGrid(wrap, 48);
    const msg = { items: 'Potions, buffs and other items you use will be kept here.', materials: 'Upgrade stones, ores and monster drops will be kept here.', key: 'Quest items, keys and tokens will be kept here.' }[this.mainTab];
    this.el('div', 'soonhint', wrap, msg);
    this.invHint.textContent = '';
  }

  /** Sort / filter / search (visual only until items exist). */
  private toolbar(parent: HTMLElement): void {
    const tb = this.el('div', 'tb', parent);
    for (const [k, title] of [['sort', 'Sort'], ['filter', 'Filter'], ['search', 'Search']] as const) this.iconBtn('', tb, k, title);
  }

  /** Hover card of a cosmetic: name, kind (rarity colour), icon, what it is, what a click does. */
  private hoverTip(cell: HTMLElement, it: Item): void {
    cell.addEventListener('mouseenter', () => {
      const t = this.tip; t.innerHTML = '';
      const rarity = rarityOf(it);
      const th = this.el('div', 'th', t); const im = this.el('img', '', th); im.src = it.icon; im.alt = '';
      const nm = this.el('div', '', th); this.el('div', 'tn', nm, it.name); const tt = this.el('div', 'tt', nm, `${rarity} · ${TYPE_LABEL[it.type] ?? it.type}`); tt.style.color = RARITY_COLOR[rarity];
      const tb = this.el('div', 'tb', t); this.el('div', 'td', tb, it.desc.charAt(0).toUpperCase() + it.desc.slice(1));
      this.el('div', 'te', t, this.isEquipped(it) ? 'Equipped · click to take off' : 'Click to wear');
      t.classList.add('on');
    });
    this.tipFollow(cell);
  }

  /** Hover card of a gear piece: name, slot, icon, its stats, what a click does. */
  private gearTip(cell: HTMLElement, it: GearItem, worn: boolean): void {
    cell.addEventListener('mouseenter', () => {
      const d = GEAR[it.id], t = this.tip; t.innerHTML = '';
      const th = this.el('div', 'th', t); const im = this.el('img', '', th); im.src = gearIcon(it); im.alt = '';
      const nm = this.el('div', '', th); this.el('div', 'tn', nm, itemName(it)); const tt = this.el('div', 'tt', nm, SLOT_NAMES[d.slot]); tt.style.color = 'var(--gl-gold2)';
      const tb = this.el('div', 'tb', t), ts = this.el('div', 'ts', tb);
      if (d.att) this.el('div', '', ts, `Attack +${d.att}`);
      if (d.def) this.el('div', '', ts, `Defense +${d.def}`);
      this.el('div', 'td', tb, d.desc); this.el('div', 'te', t, worn ? 'Click to take off' : 'Click to wear');
      t.classList.add('on');
    });
    this.tipFollow(cell);
  }

  private tipFollow(cell: HTMLElement): void {
    cell.addEventListener('mousemove', (ev) => {
      const r = this.inv.getBoundingClientRect(), k = r.width / INV_BG.w, h = this.tip.offsetHeight || 220;
      const x = Math.min(INV_BG.w - TIP_W - 12, (ev.clientX - r.left) / k + 20), y = Math.min(INV_BG.h - h - 12, Math.max(12, (ev.clientY - r.top) / k - 30));
      this.place(this.tip, x, y);
    });
    cell.addEventListener('mouseleave', () => this.tip.classList.remove('on'));
  }

  private buildShop(): HTMLDivElement {
    const bg = this.windowFrame();
    const sub = !this.items.length ? 'New items coming soon' : this.qa ? 'QA build · every item costs 0 · no payment' : 'Not open in this build';
    this.header(bg, 'COSMETIC SHOP', `${CLASS_NAMES[this.cls] ?? this.cls} · ${sub}`, 'Inventory', 'inventory');
    this.stateBar(bg, () => this.shopPrev);
    const ct = this.el('div', 'stabs gl-seg', bg);
    if (!this.items.length) ct.style.display = 'none';   // nothing on sale yet: no categories
    SHOP_TABS.forEach(([c, label]) => {
      const b = this.el('button', '', ct, label); b.type = 'button';
      b.addEventListener('click', () => { this.shopCat = c; this.refresh(); });
      this.shopTabs.set(c, b);
    });
    const pnl = this.el('div', 'sgrid gl-sec', bg);
    if (!this.items.length) { pnl.style.top = `${CONTENT.y}px`; pnl.style.height = `${PANEL.y + PANEL.h - CONTENT.y}px`; }
    this.shopGrid = this.el('div', 'in gl-scroll', pnl);
    if (!this.items.length) {   // the shop is being restocked: its items come with a later update
      const d = this.el('div', 'soon gl-empty', pnl); this.el('i', '', d); this.el('b', '', d, 'NEW ITEMS COMING SOON'); this.el('span', '', d, 'The shop is being restocked for an upcoming update.');
    }
    this.bundle = this.el('div', 'abar gl-sec', bg);
    if (!this.items.length) this.bundle.style.display = 'none';
    return bg;
  }

  // ------------------------------------------------------------------ content

  private refresh(): void {
    const e = this.getEquipped(), w = wornLook(this.gear);
    this.invPrev.setEquipped(e); this.invPrev.setGear(w);
    this.shopPrev.setEquipped({ ...e, ...this.tryOn }); this.shopPrev.setGear(w);
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
      const rows = this.el('div', 'rows', g);
      slots.forEach((s) => {
        const row = this.el('div', 'row gl-sec', rows);
        const id = e[s], it = id ? this.items.find((x) => x.id === id) : undefined;
        const nm = this.el('div', 'rn', row, SLOT_LABEL[s]);
        this.el('small', '', nm, it ? it.name : 'Empty — class default');
        const pt = this.el('div', 'pt', row);
        if (it) { const im = this.el('img', '', pt); im.src = it.icon; im.alt = ''; }
        if (it) { const b = this.el('button', 'gl-btn', row, 'Take off'); b.type = 'button'; b.addEventListener('click', () => this.unequip(it)); }
      });
      return;
    }
    if (this.invCat === 'sets') {
      const sets = this.items.filter((it) => it.type === 'set' && owned.has(it.id));
      if (!sets.length) { this.empty(g, 'No sets owned yet.'); return; }
      const rows = this.el('div', 'rows', g);
      sets.forEach((it) => {
        const row = this.el('div', 'row gl-sec', rows);
        const nm = this.el('div', 'rn', row, it.name); this.el('small', '', nm, `${(it.parts ?? []).length} pieces · mix and match after wearing`);
        const pt = this.el('div', 'pt', row);
        for (const p of it.parts ?? []) { const im = this.el('img', '', pt); im.src = this.icon(p); im.alt = ''; im.title = cosmetic(p)?.name ?? p; }
        const on = this.isEquipped(it);
        const b = this.el('button', on ? 'gl-btn' : 'gl-btn pri', row, on ? 'Take off set' : 'Wear set'); b.type = 'button';
        b.addEventListener('click', () => (on ? this.unequip(it) : this.equip(it)));
      });
      return;
    }
    const list = this.invCat === 'owned' ? pieces : pieces.filter((it) => catOf(it) === this.invCat);
    if (!list.length) { this.empty(g, 'Nothing owned in this category yet.'); return; }
    const cells = this.el('div', 'cells', g);
    list.forEach((it) => {
      const c = this.el('div', 'cell', cells);
      this.hoverTip(c, it);
      c.classList.toggle('eq', this.isEquipped(it));
      const im = this.el('img', '', c); im.src = it.icon; im.alt = '';
      this.el('div', 'nm', c, it.name);
      if (this.isEquipped(it)) this.el('span', 'eqt gl-chip ok', c, 'Worn');
      c.addEventListener('click', () => this.toggleEquip(it));
    });
  }

  private empty(g: HTMLElement, msg: string): void {
    const d = this.el('div', 'empty', g, msg);
    const b = this.el('button', 'gl-btn pri', d, 'Open the Cosmetic Shop'); b.type = 'button';
    b.addEventListener('click', () => this.show('shop'));
  }

  private renderShop(): void {
    const g = this.shopGrid; g.innerHTML = '';
    const owned = this.owned;
    const list = this.items.filter((it) => this.shopCat === 'all' || catOf(it) === this.shopCat)
      .sort((a, b) => (a.type === 'set' ? 0 : 1) - (b.type === 'set' ? 0 : 1));
    const cards = this.el('div', 'kcards', g);
    list.forEach((it) => {
      const c = this.el('div', 'kcard', cards);
      c.classList.toggle('sel', this.selected === it.id);
      const im = this.el('img', 'ic', c); im.src = it.icon; im.alt = '';
      this.el('div', 'nm', c, it.name);
      const pr = this.el('div', 'pr', c);
      const has = owned.has(it.id);
      if (has) { c.classList.add('own'); this.el('span', '', pr, this.isEquipped(it) ? 'Wearing' : 'Owned'); }
      else if (this.qa) { this.el('i', 'gl-gem', pr); this.el('span', '', pr, '0'); }
      else this.el('span', '', pr, '—');
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

  /** Action bar under the shop grid: the selected item (being previewed), its set pieces, STOP PREVIEW / GET / WEAR. */
  private renderBundle(): void {
    const it = this.items.find((x) => x.id === this.selected);
    const b = this.bundle; b.innerHTML = '';
    if (!this.items.length) return;
    if (!it) { const t = this.el('div', 'at', b); this.el('span', '', t, 'Select an item to try it on your character.'); return; }
    const im = this.el('img', 'ai', b); im.src = it.icon; im.alt = '';
    const t = this.el('div', 'at', b); this.el('b', '', t, it.name);
    const parts = it.type === 'set' ? it.parts ?? [] : [];
    this.el('span', '', t, it.type === 'set' ? `Full set · ${parts.length} pieces · trying on` : `${TYPE_LABEL[it.type] ?? it.type} · ${it.desc.charAt(0).toUpperCase() + it.desc.slice(1)}`);
    if (parts.length) { const pp = this.el('div', 'parts', t); for (const p of parts) { const pi = this.el('img', '', pp); pi.src = this.icon(p); pi.alt = ''; pi.title = cosmetic(p)?.name ?? p; } }
    const has = this.owned.has(it.id);
    const stop = this.el('button', 'gl-btn', b, 'Stop trying on'); stop.type = 'button'; stop.title = 'Back to what you actually wear';
    stop.addEventListener('click', () => { this.selected = null; this.tryOn = {}; this.refresh(); });
    const label = !has ? (this.qa ? 'Get free' : 'Unavailable') : this.isEquipped(it) ? 'Take off' : 'Wear';
    const act = this.el('button', 'gl-btn pri', b, label); act.type = 'button';
    act.disabled = !has && !this.qa;
    act.addEventListener('click', () => {
      if (!has) { this.grant(it.type === 'set' ? [it.id, ...(it.parts ?? [])] : [it.id]); this.tryOn = {}; this.equip(it); return; }
      this.tryOn = {}; this.toggleEquip(it);
    });
  }

  // ------------------------------------------------------------------ open / close

  toggle(tab: Tab): void { if (this.open && this.tab === tab) this.close(); else this.show(tab); }

  show(tab: Tab): void {
    this.tab = tab; this.open = true;
    const keys = loadBindings();
    for (const b of this.swBtns) { const k = keyLabel(keys[b.action]); b.el.textContent = b.label; if (k) this.el('span', 'gl-key', b.el, k); }
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

  /** A screen-space object of the scene (the veil behind open windows) that the previews must not draw over the character. */
  keepOutOfPreviews(o: Phaser.GameObjects.GameObject): void { this.invStage.cam.ignore(o); this.shopStage.cam.ignore(o); }

  update(ms: number): void {
    if (!this.open) return;
    if (this.tab === 'inventory') this.invPrev.update(ms); else this.shopPrev.update(ms);
  }

  /** QA hooks. */
  get previewState(): { state: PState; dir: Dir; tryOn: Equipped } { const p = this.tab === 'inventory' ? this.invPrev : this.shopPrev; return { state: p.state, dir: p.dir, tryOn: this.tryOn }; }
  setPreview(state: PState, dir?: Dir): void { const p = this.tab === 'inventory' ? this.invPrev : this.shopPrev; p.setState(state); if (dir) { p.dir = dir; p.autoTurn = false; } this.syncStates(); }

  destroy(): void { this.invPrev.destroy(); this.shopPrev.destroy(); this.invStage.destroy(); this.shopStage.destroy(); this.root.remove(); }
}
