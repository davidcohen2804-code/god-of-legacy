// Inventory (I) and Cosmetic Shop (O). The inventory's GEAR tab holds the character's equipment (MapleStory-style: worn
// pieces on the doll, the rest in the bag; take off / wear, stats on every piece); cosmetics have no stats and no payment.
// Both views share one live Phaser preview of the real body with its layers, cycling through every animation state and
// both directions. Ownership / equipped / worn ids persist in the local character store (abstract enough for a backend).
import Phaser from 'phaser';
import { CLASS_NAMES, FONT_FAMILY, HUD } from '../config/layout';
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

type Tab = 'inventory' | 'shop';
type InvCat = 'equipped' | 'owned' | 'sets' | 'fashion' | 'weapon' | 'headface' | 'back' | 'aura';
type ShopCat = 'all' | 'sets' | 'fashion' | 'weapon' | 'headface' | 'back' | 'aura';
type PState = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt' | 'dead';
interface Item { id: string; type: string; icon: string; name: string; desc: string; parts?: string[] }

const INV = 'assets/final/ui/inventory', SHOP = 'assets/final/ui/cash_shop';
const KIT = 'assets/final/ui/kit';
const INV_BG = { x: 160, y: 140, w: 1600, h: 800 };
const SHOP_BG = { x: 160, y: 140, w: 1600, h: 800 };
// zones measured on kit/inventory_window.png (1600x800): alcove, 5 tab frames, grid panel, currency bar
const INV_PREVIEW: Rect = { x: 61, y: 119, w: 351, h: 527 };
const INV_TAB_X = [467, 678, 892, 1107, 1322], INV_TAB_W = 205, INV_TAB_Y = 136, INV_TAB_H = 61;
const INV_PANEL: Rect = { x: 476, y: 232, w: 1062, h: 414 };
type InvTab = 'gear' | 'items' | 'materials' | 'key' | 'cosmetics';
const MAIN_TABS: [InvTab, string, string][] = [['gear', 'GEAR', 'icon_gear'], ['items', 'ITEMS', 'icon_items'], ['materials', 'MATERIALS', 'icon_materials'], ['key', 'KEY ITEMS', 'icon_key'], ['cosmetics', 'COSMETICS', 'icon_cosmetics']];
// sockets painted into kit/doll_panel_gear.png (374x578, tools/base/gear_doll.py): [label, centre x, centre y, gear slot]
// — the left column holds the gear, head to toe: weapon, top, bottom, shoes; the others are for gear still to come
const DOLL: [string, number, number, GearSlot?][] = [['Head', 187, 114], ['Weapon', 81, 168, 'weapon'], ['Necklace', 293, 168], ['Top', 73, 272, 'top'], ['Earring', 299, 272], ['Bottom', 79, 372, 'bottom'], ['Shield', 296, 372], ['Shoes', 85, 464, 'shoes'], ['Belt', 190, 462], ['Ring', 282, 464]];
/** A piece's icon (bag, doll, tooltip). */
const gearIcon = (it: GearItem) => `assets/items/${it.id}${GEAR[it.id]?.colors ? `_c${it.color}` : ''}.png`;
const DOLL_SCALE = 400 / 578;
/** tip_*.png (263x477) shown 240 wide: name beside the gem, rule (art y 118), icon, stats + text, the action above the
 *  bottom ornament (art y 430+). T(): art px → shown px. */
const TIP = { w: 240, h: Math.round(477 * 240 / 263) };
const T = (v: number) => Math.round(v * 240 / 263);
/** Two curved arrows (turn around), gold. */
const TURN_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f0cf86" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9a8 8 0 0 1 14-3l2 2"/><path d="M20 4v4h-4"/><path d="M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M4 20v-4h4"/></svg>')}`;
const SHOP_PREVIEW: Rect = { x: 48, y: 104, w: 430, h: 556 };
const SHOP_TABS_Y = 112;
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

const STYLE_ID = 'gol-cosmetic-style';
const READ = HUD.bodyFont;
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
.gol-cp .cell .sl{position:absolute;left:12px;top:0;width:96px;height:96px;background:url("${KIT}/slot_filled.png") 0 0/100% 100%;transition:transform 120ms,filter 120ms}
.gol-cp .cell.eq .sl{background-image:url("${KIT}/slot_selected.png");filter:drop-shadow(0 0 8px rgba(90,220,130,.6))}
.gol-cp .cell:hover .sl{transform:scale(1.04);filter:brightness(1.2)}
.gol-cp .cell img{position:absolute;left:12px;top:12px;width:72px;height:72px;object-fit:contain;pointer-events:none}
.gol-cp .cell .nm{position:absolute;left:0;right:0;top:100px;font-size:13px;line-height:15px;color:#e8dcc2;text-shadow:0 1px 2px #000}
.gol-cp .cell .eqt{position:absolute;left:50%;top:76px;transform:translateX(-50%);padding:1px 6px;border-radius:4px;background:#0b121bd9;border:1px solid #3f7a52;font-size:9px;letter-spacing:1px;color:#8ff0a8;font-weight:700;white-space:nowrap}
.gol-cp .row{position:absolute;left:0;width:100%;height:84px;background:url("${INV}/set_bundle_frame.png") 0 0/100% 100%;display:flex;align-items:center;gap:12px;padding:0 70px 0 72px}
.gol-cp .row .rn{width:190px;font-size:17px;font-weight:700;color:#f3e2bf;line-height:21px}
.gol-cp .row .rn small{display:block;font-size:14px;font-weight:400;color:#a9b8c6;font-family:${READ}}
.gol-cp .row img{width:52px;height:52px;object-fit:contain;border-radius:6px;background:rgba(0,0,0,.25)}
.gol-cp .row .pt{display:flex;gap:6px;flex:1}
.gol-cp .act{height:38px;padding:0 16px;border-radius:7px;border:1px solid #c99a45;background:#2a1a08;color:#ffe2a0;font-size:14px;font-weight:700;letter-spacing:1px}
.gol-cp .act.alt{background:#0d1a26;border-color:#5a86b0;color:#cfe6ff}
.gol-cp .empty{position:absolute;left:0;right:0;top:120px;text-align:center;font-size:18px;color:#a9b8c6;font-family:${READ};line-height:1.5}
.gol-cp .card{position:absolute;width:176px;height:224px;background:url("${SHOP}/item_card.png") 0 0/100% 100%;cursor:pointer;transition:transform 120ms,filter 120ms}
.gol-cp .card.sel{background-image:url("${SHOP}/item_card_selected.png");filter:drop-shadow(0 0 10px rgba(240,190,90,.5))}
.gol-cp .card:hover{transform:translateY(-2px);filter:brightness(1.12)}
.gol-cp .card img.ic{position:absolute;left:32px;top:14px;width:112px;height:112px;object-fit:contain;pointer-events:none}
.gol-cp .card .nm{position:absolute;left:8px;right:8px;top:128px;text-align:center;font-size:14px;font-weight:700;color:#f3e2bf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-cp .card .ty{position:absolute;left:8px;right:8px;top:147px;text-align:center;font-size:11px;color:#9fb0c0;font-family:${READ}}
.gol-cp .card .pr{position:absolute;left:0;right:0;top:164px;display:flex;justify-content:center;align-items:center;gap:6px;font-size:14px;color:#ffe2a0;font-weight:700}
.gol-cp .card .pr img{width:64px;height:26px}
.gol-cp .card .pr .own{font-size:11px;letter-spacing:1px;color:#8ff0a8}
.gol-cp .card .bt{position:absolute;left:10px;right:10px;bottom:10px;display:flex;gap:6px}
.gol-cp .card .bt button{flex:1;height:26px;padding:0;font-size:11px;letter-spacing:.5px;border-radius:5px}
.gol-cp .st{position:absolute;height:48px;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:nowrap}
.gol-cp .st .sn{width:78px;text-align:center;font:700 14px ${FONT_FAMILY};letter-spacing:1.2px;color:#ffe2a0;text-shadow:0 1px 2px #000}
.gol-cp .st .sep{width:1px;height:26px;margin:0 6px;background:rgba(201,154,69,.45)}
.gol-cp .st .pb{height:32px;padding:0 12px;border-radius:7px;border:1px solid #6a5630;background:#0d1520;color:#c9d6e2;font:700 12.5px ${READ};letter-spacing:1.2px;white-space:nowrap}
.gol-cp .st .pb.turn{width:34px;padding:0;background:#0d1520 url("${TURN_ICON}") center/20px 20px no-repeat}
.gol-cp .st .pb.on{border-color:#c99a45;color:#ffe2a0;background-color:#251a0a;box-shadow:0 0 10px rgba(232,178,90,.3)}
.gol-cp .bundle{position:absolute;height:118px;background:url("${INV}/set_bundle_frame.png") 0 0/100% 100%;padding:12px 64px;display:none}
.gol-cp .bundle.on{display:block}
.gol-cp .bundle .bh{font-size:14px;font-weight:700;color:#f3e2bf;letter-spacing:1px}
.gol-cp .bundle .bp{margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:2px 10px}
.gol-cp .bundle .bp div{display:flex;align-items:center;gap:6px;font-size:12px;color:#c9d6e2;font-family:${READ}}
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
.gol-cp .ks small{position:absolute;left:-20px;right:-20px;top:88px;text-align:center;font-size:12px;letter-spacing:1px;color:#a9b8c6}
.gol-cp .sec{position:absolute;font-size:13px;letter-spacing:2px;color:#c99a45;font-weight:700}
.gol-cp .hint{position:absolute;font-size:15px;line-height:20px;color:#a9b8c6;font-family:${READ}}
.gol-cp .ctabs{position:absolute;display:flex;gap:4px;flex-wrap:nowrap;justify-content:center}
.gol-cp .ctabs button{flex:none;min-width:92px;height:46px;padding:0 22px;border:0;background:url("${KIT}/pill_normal.png") center/100% 100% no-repeat;color:#d3dce5;font-size:13px;font-weight:700;letter-spacing:.5px;white-space:nowrap;text-shadow:0 1px 2px #000}
.gol-cp .ctabs button:hover{background-image:url("${KIT}/pill_hover.png")}
.gol-cp .ctabs button.on{background-image:url("${KIT}/pill_selected.png");color:#ffe2a0}
.gol-cp .tb{position:absolute;display:flex;gap:8px}
.gol-cp .tb button{width:44px;height:44px;border:0;background:0 0/100% 100% no-repeat}
.gol-cp .tb button.sort{background-image:url("${KIT}/btn_sort.png")} .gol-cp .tb button.sort:hover{background-image:url("${KIT}/btn_sort_hover.png")}
.gol-cp .tb button.filter{background-image:url("${KIT}/btn_filter.png")} .gol-cp .tb button.filter:hover{background-image:url("${KIT}/btn_filter_hover.png")}
.gol-cp .tb button.search{background-image:url("${KIT}/btn_search.png")} .gol-cp .tb button.search:hover{background-image:url("${KIT}/btn_search_hover.png")}
.gol-cp .st button.arw{width:30px;height:32px;padding:0;border:0;color:transparent;flex:none;background:url("${KIT}/btn_left.png") center/contain no-repeat}
.gol-cp .st button.arw:hover{background-image:url("${KIT}/btn_left_hover.png")}
.gol-cp .st button.arw.r{background-image:url("${KIT}/btn_right.png")} .gol-cp .st button.arw.r:hover{background-image:url("${KIT}/btn_right_hover.png")}
.gol-cp .kitbar{scrollbar-width:auto;scrollbar-color:auto}
.gol-cp .kitbar::-webkit-scrollbar{width:18px}
.gol-cp .kitbar::-webkit-scrollbar-track{background:url("${KIT}/scroll_track.png") center/100% 100% no-repeat}
.gol-cp .kitbar::-webkit-scrollbar-thumb{background:url("${KIT}/scroll_handle.png") center/contain no-repeat;min-height:30px}
.gol-cp .tip{position:absolute;width:${TIP.w}px;height:${TIP.h}px;background:url("${KIT}/tip_common.png") 0 0/100% 100% no-repeat;pointer-events:none;display:none;z-index:5;color:#dfe6ee;font-family:${READ}}
.gol-cp .tip.on{display:block}
.gol-cp .tip .tn{position:absolute;left:${T(96)}px;right:${T(16)}px;top:${T(36)}px;height:${T(40)}px;display:flex;align-items:center;font:700 15px/18px ${FONT_FAMILY};color:#f6e6c2;text-shadow:0 1px 2px #000;overflow:hidden}
.gol-cp .tip .tt{position:absolute;left:${T(96)}px;right:${T(16)}px;top:${T(80)}px;font:700 11.5px/15px ${READ};letter-spacing:1.6px;color:#e8b25a;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-cp .tip img{position:absolute;left:${(TIP.w - 92) / 2}px;top:${T(134)}px;width:92px;height:92px;object-fit:contain;filter:drop-shadow(0 4px 6px #000)}
.gol-cp .tip .tb{position:absolute;left:${T(28)}px;right:${T(28)}px;top:${T(246)}px;bottom:${T(84)}px;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.gol-cp .tip .td{font-size:14px;line-height:20px;color:#dde3ea}
.gol-cp .tip .te{position:absolute;left:${T(20)}px;right:${T(20)}px;top:${T(392)}px;font:700 11.5px/16px ${READ};letter-spacing:1.6px;color:#8ff0a8;text-align:center;text-transform:uppercase}
.gol-cp .pnl{position:absolute;background:0 0/100% 100% no-repeat}
.gol-cp .sock{position:absolute;width:78px;height:78px;margin:-39px 0 0 -39px;border-radius:50%;cursor:pointer}
.gol-cp .sock:hover{box-shadow:0 0 14px 4px rgba(255,214,130,.45)}
.gol-cp .sock span{display:none;position:absolute;left:50%;top:62px;transform:translateX(-50%);white-space:nowrap;font-size:13px;letter-spacing:1.2px;color:#ffe2a0;background:#0b121bee;padding:3px 10px;border-radius:5px;box-shadow:inset 0 0 0 1px rgba(201,154,69,.5);z-index:3}
.gol-cp .sock:hover span{display:block}
.gol-cp .sock.gear img{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px 0 0 -20px;object-fit:contain;pointer-events:none;filter:drop-shadow(0 2px 3px #000)}
.gol-cp .sock.gear.worn{background:radial-gradient(circle,#162438 0,#0c1420 70%);box-shadow:inset 0 0 0 1px rgba(232,178,90,.35)}
.gol-cp .sock.gear.worn:hover{box-shadow:0 0 14px 4px rgba(255,214,130,.45),inset 0 0 0 1px rgba(232,178,90,.5)}
.gol-cp .sock span.top{top:auto;bottom:62px}
.gol-cp .ks.it{cursor:pointer;background-image:url("${KIT}/slot_empty.png");transition:transform 120ms,filter 120ms}
.gol-cp .ks.it:hover{transform:scale(1.05);filter:brightness(1.2)}
.gol-cp .ks.it img{left:10px;top:10px;width:60px;height:60px;opacity:1;filter:drop-shadow(0 2px 3px #000)}
.gol-cp .gstat{position:absolute;display:flex;gap:30px;font:700 16px ${FONT_FAMILY};letter-spacing:1.5px;color:#c9d3dc;white-space:nowrap}
.gol-cp .gstat b{color:#ffe2a0;margin-left:9px;font-size:19px}
.gol-cp .tip .ts{font:700 14.5px/20px ${READ};letter-spacing:.6px;color:#8ff0a8}
.gol-cp .cur{position:absolute;width:342px;height:74px;background:url("${KIT}/currency_bar.png") 0 0/100% 100%}
.gol-cp .cur b{position:absolute;top:26px;width:80px;text-align:center;font-size:16px;color:#ffe2a0;font-family:${READ}}
.gol-cp .hdr{position:absolute;left:390px;top:-38px;width:820px;height:145px;background:url("${KIT}/banner_shop.png") 0 0/100% 100% no-repeat;text-align:center;pointer-events:none}
.gol-cp .hdr .ttl{position:static;display:block;margin-top:55px;font-size:24px;line-height:28px;letter-spacing:4px}
.gol-cp .hdr .sub{position:static;display:block;margin-top:4px;font:600 12.5px/16px ${READ};letter-spacing:1.6px;color:#b4c2d0;text-transform:uppercase;white-space:nowrap}
.gol-cp .soon{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;pointer-events:none}
.gol-cp .soon i{width:84px;height:84px;background:url("${KIT}/gem_premium.png") center/contain no-repeat;opacity:.85;filter:drop-shadow(0 0 18px rgba(110,200,255,.35))}
.gol-cp .soon b{font:700 26px/32px ${FONT_FAMILY};letter-spacing:3px;color:#f3dcaa;text-shadow:0 2px 4px #000}
.gol-cp .soon span{font:500 16px/22px ${READ};color:#b4c2d0}
.gol-cp .sw.kit{height:58px;width:260px;padding:0 34px;border:0;background:url("${KIT}/pill_normal.png") center/100% 100% no-repeat;font-size:14px;letter-spacing:1px;color:#ffe2a0;white-space:nowrap;text-shadow:0 1px 2px #000}
.gol-cp .sw.kit:hover{background-image:url("${KIT}/pill_hover.png")}
.gol-cp .row.kit{height:76px;background:linear-gradient(90deg,#15233a,#0b1422 60%,#0b1422);border:1px solid #6a5630;border-radius:8px;box-shadow:inset 0 0 0 1px #0a1018,0 2px 6px rgba(0,0,0,.5);padding:0 22px 0 18px}
.gol-cp .row.kit:before{content:'';width:6px;height:46px;border-radius:3px;background:linear-gradient(#f3d27a,#8a6420);margin-right:6px}
.gol-cp .row.kit .rn{width:220px}
.gol-cp .kcard{position:absolute;width:176px;height:245px;background:url("${KIT}/shop_card.png") center/100% 100% no-repeat;cursor:pointer;transition:transform 120ms,filter 120ms}
.gol-cp .kcard:hover{transform:translateY(-2px);filter:brightness(1.1)}
.gol-cp .kcard.sel{background-image:url("${KIT}/shop_card_sel.png")}
.gol-cp .kcard img.ic{position:absolute;left:37px;top:51px;width:102px;height:102px;object-fit:contain;pointer-events:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.6))}
.gol-cp .kcard .nm{position:absolute;left:10px;right:10px;top:166px;text-align:center;font-size:12px;line-height:14px;font-weight:700;color:#f3e2bf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px #000}
.gol-cp .kcard .pr{position:absolute;left:26px;right:26px;top:188px;height:28px;display:flex;justify-content:center;align-items:center;gap:5px;font-size:13px;font-weight:700;color:#3a2606;letter-spacing:.5px}
.gol-cp .kcard .pr img{width:18px;height:18px}
.gol-cp .kcard .seal{position:absolute;right:-6px;top:-6px;width:44px;height:44px;background:url("${KIT}/seal_owned.png") center/contain no-repeat;filter:drop-shadow(0 2px 3px #000)}
.gol-cp .kcard.eq .seal{filter:drop-shadow(0 0 6px rgba(140,255,170,.8))}
.gol-cp .abar{position:absolute;display:flex;align-items:center;gap:14px;padding:0 10px}
.gol-cp .abar .ai{width:60px;height:60px;object-fit:contain;filter:drop-shadow(0 3px 4px rgba(0,0,0,.6))}
.gol-cp .abar .at{flex:1;min-width:0;color:#dfe6ee;font-family:${READ};font-size:15px;line-height:1.35}
.gol-cp .abar .at b{display:block;font:700 18px ${FONT_FAMILY};color:#f3e2bf;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-cp .abar .at span{color:#9fb0c0}
.gol-cp .abar .at .parts{display:flex;gap:4px;margin-top:3px}
.gol-cp .abar .at .parts img{width:26px;height:26px;object-fit:contain;border-radius:4px;background:rgba(0,0,0,.3)}
.gol-cp .plate{width:170px;height:62px;padding:0 16px;border:0;background:url("${KIT}/plate_normal.png") center/100% 100% no-repeat;font-size:14px;font-weight:700;letter-spacing:1px;color:#ffe2a0;text-shadow:0 1px 2px #000;flex:none}
.gol-cp .plate:hover:not(:disabled){background-image:url("${KIT}/plate_hover.png");filter:none;transform:scale(1.02)}
.gol-cp .plate:disabled{background-image:url("${KIT}/plate_disabled.png");color:#9aa3ab;opacity:1}
.gol-cp .wtab{position:absolute;top:${INV_TAB_Y}px;width:${INV_TAB_W}px;height:${INV_TAB_H}px;border:0;background:transparent;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:8px;
  color:#d3dce5;font-size:15px;font-weight:700;letter-spacing:1.2px;text-shadow:0 1px 2px #000;transition:background 120ms,box-shadow 120ms}
.gol-cp .wtab:hover{background:rgba(255,214,130,.08);filter:none;transform:none}
.gol-cp .wtab.on{background:linear-gradient(90deg,rgba(255,200,90,.06),rgba(255,200,90,.22),rgba(255,200,90,.06));box-shadow:inset 0 -3px 0 #e8b25a;color:#ffe2a0}
.gol-cp .wtab img{width:30px;height:30px;object-fit:contain}
.gol-cp .cico{position:absolute;background:center/contain no-repeat;pointer-events:none;filter:drop-shadow(0 2px 3px #000)}
.gol-cp .curr{position:absolute;display:grid;grid-template-columns:auto auto;gap:2px 14px;align-items:center}
.gol-cp .curr span{font:700 11.5px/21px ${READ};letter-spacing:1.6px}
.gol-cp .curr b{font:700 16px/21px ${READ};color:#fff1cc;text-shadow:0 1px 2px #000;font-variant-numeric:tabular-nums}
.gol-cp .x.win{position:absolute;left:1515px;top:87px;width:56px;height:56px;border:0;border-radius:50%;background:transparent;color:transparent;transition:box-shadow 120ms}
.gol-cp .x.win:hover{box-shadow:0 0 16px 6px rgba(255,214,130,.45);filter:none;transform:none}
.gol-cp .hdr.win{left:503px;top:34px;width:597px;height:64px;background:none}
.gol-cp .hdr.win .ttl{margin-top:9px;font-size:25px;line-height:28px}
.gol-cp .hdr.win .sub{margin-top:1px;font-size:13px;line-height:18px}
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
  private invTabs = new Map<InvCat, HTMLButtonElement>();
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
    this.invStage = new PreviewStage(scene, { x: INV_BG.x + INV_PREVIEW.x, y: INV_BG.y + INV_PREVIEW.y, w: INV_PREVIEW.w, h: INV_PREVIEW.h }, -26000, 30000, 2.0, 'ui-inv-preview');
    this.shopStage = new PreviewStage(scene, { x: SHOP_BG.x + SHOP_PREVIEW.x, y: SHOP_BG.y + SHOP_PREVIEW.y, w: SHOP_PREVIEW.w, h: SHOP_PREVIEW.h }, -22000, 30000, 2.0, 'ui-shop-preview');
    this.invPrev = new CosPreview(scene, this.invStage, this.cls, 109, genderOf(character), headLookOf(character));
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

  private header(bg: HTMLDivElement, title: string, sub: string, swLabel: string, sw: Tab): void {
    this.el('div', 'ttl', bg, title);
    this.el('div', 'sub', bg, sub);
    const x = this.el('button', 'x', bg, '✕'); x.title = 'Close (Esc)'; x.addEventListener('click', () => this.close());
    const b = this.el('button', 'sw', bg, swLabel); b.addEventListener('click', () => this.show(sw));
    this.swBtns.push({ el: b, label: swLabel, action: sw === 'shop' ? 'shop' : 'bag' });
  }

  /** The preview's controls in one row: ◀ ANIMATION ▶ (idle, walk, run, jump, attack, hit, death), TURN, AUTO-ROTATE. */
  private stateBar(bg: HTMLDivElement, x: number, y: number, w: number, prev: () => CosPreview): void {
    const bar = this.el('div', 'st', bg); this.place(bar, x, y, w);
    const step = (d: number) => { const p = prev(), i = STATES.findIndex(([s]) => s === p.state); p.setState(STATES[(i + d + STATES.length) % STATES.length][0]); this.syncStates(); };
    const l = this.el('button', 'arw', bar, 'Previous'); l.title = 'Previous animation'; l.addEventListener('click', () => step(-1));
    this.stateLabels.push(this.el('div', 'sn', bar));
    const r = this.el('button', 'arw r', bar, 'Next'); r.title = 'Next animation'; r.addEventListener('click', () => step(1));
    this.el('i', 'sep', bar);
    const t = this.el('button', 'pb turn', bar); t.title = 'Turn around'; t.setAttribute('aria-label', 'Turn around'); t.addEventListener('click', () => { prev().turn(1); this.syncStates(); });
    const a = this.el('button', 'pb auto', bar, 'ROTATE'); a.title = 'Keep turning around by itself'; a.addEventListener('click', () => { const p = prev(); p.autoTurn = !p.autoTurn; this.syncStates(); });
  }

  private syncStates(): void {
    const p = this.tab === 'inventory' ? this.invPrev : this.shopPrev;
    const name = (STATES.find(([s]) => s === p.state)?.[1] ?? '').toUpperCase();
    for (const l of this.stateLabels) l.textContent = name;
    this.root.querySelectorAll('.auto').forEach((e) => e.classList.toggle('on', p.autoTurn));
  }

  private buildInventory(): HTMLDivElement {
    const bg = this.el('div', 'bg', this.root); this.place(bg, INV_BG.x, INV_BG.y, INV_BG.w, INV_BG.h);
    bg.style.backgroundImage = `url("${KIT}/inventory_window.png")`;
    holeMask(bg, INV_PREVIEW);
    this.header(bg, 'INVENTORY', `${this.character.name} · ${CLASS_NAMES[this.cls] ?? this.cls}`, 'COSMETIC SHOP', 'shop');
    (bg.querySelector('.x') as HTMLElement).classList.add('win');
    const sw = bg.querySelector('.sw') as HTMLElement; sw.classList.add('kit'); sw.style.right = 'auto'; sw.style.left = '1270px'; sw.style.top = '40px';
    const hdr = this.el('div', 'hdr win', bg); hdr.appendChild(bg.querySelector('.ttl')!); hdr.appendChild(bg.querySelector('.sub')!);
    this.stateBar(bg, 70, 691, 335, () => this.invPrev); // inside the strip painted under the alcove (art x 57..418, y 688..740)
    for (const [i, [t, label, ic]] of MAIN_TABS.entries()) {
      const b = this.el('button', 'wtab', bg); b.style.left = `${INV_TAB_X[i]}px`;
      const im = this.el('img', '', b); im.src = `${KIT}/${ic}.png`; im.alt = ''; this.el('span', '', b, label);
      b.addEventListener('click', () => { this.mainTab = t; this.refresh(); });
      this.mainTabs.set(t, b);
    }
    this.content = this.el('div', 'ct', bg); this.place(this.content, INV_PANEL.x, INV_PANEL.y, INV_PANEL.w, INV_PANEL.h);
    // currency bar painted at the bottom of the window: coin + gem in its two ring sockets, amounts beside them
    const coin = this.el('div', 'cico', bg); this.place(coin, 522 - 34, 715 - 34, 68, 68); coin.style.backgroundImage = `url("${KIT}/coin_gold.png")`;
    const gem = this.el('div', 'cico', bg); this.place(gem, 618 - 38, 715 - 38, 76, 76); gem.style.backgroundImage = `url("${KIT}/gem_premium.png")`;
    // the amounts beside the rings, each named in its own colour (gold coin, blue gem)
    const cur = this.el('div', 'curr', bg); this.place(cur, 684, 692);
    for (const [name, color] of [['GOLD', '#e9c46a'], ['GEMS', '#8fd8ff']]) { const n = this.el('span', '', cur, name); n.style.color = color; this.el('b', '', cur, '0'); }
    this.invHint = this.el('div', 'hint', bg); this.place(this.invHint, 790, 705, 740); this.invHint.style.textAlign = 'center';
    this.tip = this.el('div', 'tip', bg);
    return bg;
  }

  private slotGrid(parent: HTMLElement, x0: number, y0: number, cols: number, rows: number): void {
    for (let i = 0; i < cols * rows; i++) { const s = this.el('div', 'ks', parent); this.place(s, x0 + (i % cols) * 88, y0 + Math.floor(i / cols) * 88, 80, 80); }
  }

  private renderMain(): void {
    const c = this.content; c.innerHTML = '';
    for (const [t, b] of this.mainTabs) b.classList.toggle('on', t === this.mainTab);
    const W = INV_PANEL.w;
    if (this.mainTab === 'cosmetics') {
      this.invHint.textContent = '';
      if (!this.items.length) {   // none yet: they come with a later update
        const d = this.el('div', 'soon', c); const i = this.el('i', '', d); i.style.backgroundImage = `url("${KIT}/icon_cosmetics.png")`;
        this.el('b', '', d, 'NO COSMETICS YET'); this.el('span', '', d, 'New cosmetics arrive with an upcoming update.');
        return;
      }
      const ct = this.el('div', 'ctabs', c); this.place(ct, 0, 4, W);
      INV_TABS.forEach(([cat, label]) => { const b = this.el('button', '', ct, label); b.classList.toggle('on', cat === this.invCat); b.addEventListener('click', () => { this.invCat = cat; this.refresh(); }); });
      this.invGrid = this.el('div', 'grid kitbar', c); this.place(this.invGrid, 14, 58, W - 28, INV_PANEL.h - 64);
      this.renderInventory();
      return;
    }
    if (this.mainTab === 'gear') { // the worn pieces on the doll (click: take off), the rest in the bag (click: wear)
      const g = this.gear, dw = Math.round(374 * DOLL_SCALE), dh = 400;
      const doll = this.el('div', 'pnl', c); this.place(doll, 8, 7, dw, dh); doll.style.backgroundImage = `url("${KIT}/doll_panel_gear.png")`;
      for (const [label, x, y, slot] of DOLL) {
        const s = this.el('div', slot ? 'sock gear' : 'sock', doll); this.place(s, Math.round(x * DOLL_SCALE), Math.round(y * DOLL_SCALE)); s.style.width = s.style.height = '56px'; s.style.margin = '-28px 0 0 -28px';
        const it = slot ? wornItem(g, slot) : null;
        if (slot && it) {
          s.classList.add('worn'); const im = this.el('img', '', s); im.src = gearIcon(it); im.alt = '';
          this.gearTip(s, it, true); s.addEventListener('click', () => this.setGear(takeOff(this.gear, slot)));
        } else this.el('span', '', s, slot ? `${label.toUpperCase()} · EMPTY` : label.toUpperCase());
      }
      const st = gearStats(g), gs = this.el('div', 'gstat', c); this.place(gs, dw + 44, 18);
      for (const [k, v] of [['ATTACK', st.att], ['DEFENSE', st.def]] as const) { const sp = this.el('span', '', gs, k); this.el('b', '', sp, String(v)); }
      this.toolbar(c, W);
      const bag = bagItems(g);
      for (let i = 0; i < 32; i++) {
        const cell = this.el('div', 'ks', c); this.place(cell, dw + 40 + (i % 8) * 88, 56 + Math.floor(i / 8) * 88, 80, 80);
        const it = bag[i]; if (!it) continue;
        cell.classList.add('it'); const im = this.el('img', '', cell); im.src = gearIcon(it); im.alt = '';
        this.gearTip(cell, it, false); cell.addEventListener('click', () => this.setGear(wear(this.gear, it.uid)));
      }
      this.invHint.textContent = 'Click a worn piece to take it off · click a piece in the bag to wear it.';
      return;
    }
    this.toolbar(c, W); this.slotGrid(c, 47, 56, 11, 4);
    this.invHint.textContent = { items: 'Potions, buffs and consumables will appear here.', materials: 'Upgrade stones, ores and monster drops will appear here.', key: 'Quest items, keys and tokens will appear here.' }[this.mainTab];
  }

  /** Sort / filter / search buttons (kit art) in a panel's top-right corner — visual only until items exist. */
  private toolbar(pnl: HTMLElement, w: number): void {
    const tb = this.el('div', 'tb', pnl); this.place(tb, w - 3 * 44 - 2 * 8 - 16, 6);
    for (const k of ['sort', 'filter', 'search']) { const b = this.el('button', k, tb); b.title = k[0].toUpperCase() + k.slice(1); }
  }

  /** Hover tooltip card (kit art, rarity-tinted gem) following the pointer inside the inventory window. */
  private hoverTip(cell: HTMLElement, it: Item): void {
    const rarity = it.type === 'set' ? 'epic' : it.type === 'weapon_animated' || it.type === 'damage' ? 'legendary' : ['aura', 'weapon', 'bow', 'book', 'trail', 'pet'].includes(it.type) ? 'rare' : ['cape', 'back', 'head', 'mask', 'hat', 'armor', 'hairstyle'].includes(it.type) ? 'uncommon' : 'common';
    cell.addEventListener('mouseenter', () => {
      const t = this.tip; t.innerHTML = ''; t.style.backgroundImage = `url("${KIT}/tip_${rarity}.png")`;
      this.el('div', 'tn', t, it.name); this.el('div', 'tt', t, TYPE_LABEL[it.type] ?? it.type);
      const im = this.el('img', '', t); im.src = it.icon; im.alt = '';
      this.el('div', 'td', this.el('div', 'tb', t), it.desc.charAt(0).toUpperCase() + it.desc.slice(1)); this.el('div', 'te', t, this.isEquipped(it) ? 'Equipped · click to take off' : 'Click to wear');
      t.classList.add('on');
    });
    this.tipFollow(cell);
  }

  /** Hover card of a gear piece: name, slot, icon, its stats, what a click does. */
  private gearTip(cell: HTMLElement, it: GearItem, worn: boolean): void {
    cell.addEventListener('mouseenter', () => {
      const d = GEAR[it.id], t = this.tip; t.innerHTML = ''; t.style.backgroundImage = `url("${KIT}/tip_common.png")`;
      this.el('div', 'tn', t, itemName(it)); this.el('div', 'tt', t, SLOT_NAMES[d.slot]);
      const im = this.el('img', '', t); im.src = gearIcon(it); im.alt = '';
      const tb = this.el('div', 'tb', t), ts = this.el('div', 'ts', tb);
      if (d.att) this.el('div', '', ts, `ATTACK +${d.att}`);
      if (d.def) this.el('div', '', ts, `DEFENSE +${d.def}`);
      this.el('div', 'td', tb, d.desc); this.el('div', 'te', t, worn ? 'Click to take off' : 'Click to wear');
      t.classList.add('on');
    });
    this.tipFollow(cell);
  }

  private tipFollow(cell: HTMLElement): void {
    cell.addEventListener('mousemove', (ev) => {
      const r = this.inv.getBoundingClientRect(), k = r.width / INV_BG.w;
      const x = Math.min(INV_BG.w - TIP.w - 8, (ev.clientX - r.left) / k + 18), y = Math.min(INV_BG.h - TIP.h - 8, Math.max(8, (ev.clientY - r.top) / k - 40));
      this.place(this.tip, x, y);
    });
    cell.addEventListener('mouseleave', () => this.tip.classList.remove('on'));
  }

  private buildShop(): HTMLDivElement {
    const bg = this.el('div', 'bg', this.root); this.place(bg, SHOP_BG.x, SHOP_BG.y, SHOP_BG.w, SHOP_BG.h);
    bg.style.backgroundImage = `url("${KIT}/window.png")`;
    holeMask(bg, SHOP_PREVIEW);
    const sub = !this.items.length ? 'New items coming soon' : this.qa ? 'QA build · every item costs 0 · no payment' : 'Not open in this build';
    this.header(bg, 'COSMETIC SHOP', `${CLASS_NAMES[this.cls] ?? this.cls} · ${sub}`, 'INVENTORY', 'inventory');
    const x = bg.querySelector('.x') as HTMLElement; x.classList.add('kit'); x.style.right = '34px'; x.style.top = '26px';
    const sw = bg.querySelector('.sw') as HTMLElement; sw.classList.add('kit'); sw.style.right = '92px'; sw.style.top = '22px';
    const hdr = this.el('div', 'hdr', bg); hdr.appendChild(bg.querySelector('.ttl')!); hdr.appendChild(bg.querySelector('.sub')!);
    this.stateBar(bg, SHOP_PREVIEW.x, SHOP_PREVIEW.y + SHOP_PREVIEW.h + 18, SHOP_PREVIEW.w, () => this.shopPrev);
    const ct = this.el('div', 'ctabs', bg); this.place(ct, 508, 108, 1050);
    if (!this.items.length) ct.style.display = 'none';   // nothing on sale yet: no categories
    SHOP_TABS.forEach(([c, label]) => {
      const b = this.el('button', '', ct, label);
      b.addEventListener('click', () => { this.shopCat = c; this.refresh(); });
      this.shopTabs.set(c, b);
    });
    const pnl = this.el('div', 'pnl', bg); this.place(pnl, 508, 164, 1050, 500); pnl.style.backgroundImage = `url("${KIT}/grid_panel_wide.png")`;
    this.shopGrid = this.el('div', 'grid kitbar', pnl); this.place(this.shopGrid, 44, 44, 980, 418);
    if (!this.items.length) {   // the shop is being restocked: its items come with a later update
      const d = this.el('div', 'soon', pnl); this.el('i', '', d); this.el('b', '', d, 'NEW ITEMS COMING SOON'); this.el('span', '', d, 'The shop is being restocked for an upcoming update.');
    }
    this.bundle = this.el('div', 'abar', bg); this.place(this.bundle, 508, 672, 1050, 70);
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
      const c = this.el('div', 'kcard', g); this.place(c, 12 + (i % 5) * 194, Math.floor(i / 5) * 258);
      c.classList.toggle('sel', this.selected === it.id);
      const im = this.el('img', 'ic', c); im.src = it.icon; im.alt = '';
      this.el('div', 'nm', c, it.name);
      const pr = this.el('div', 'pr', c);
      const has = owned.has(it.id);
      if (has) { this.el('span', '', pr, this.isEquipped(it) ? 'EQUIPPED' : 'OWNED'); this.el('div', 'seal', c); c.classList.toggle('eq', this.isEquipped(it)); }
      else if (this.qa) { const b = this.el('img', '', pr); b.src = `${KIT}/gem_premium.png`; b.alt = ''; this.el('span', '', pr, '0'); }
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

  /** Action bar under the shop grid: the selected item (being previewed), its set pieces, TRY ON / GET / EQUIP. */
  private renderBundle(): void {
    const it = this.items.find((x) => x.id === this.selected);
    const b = this.bundle; b.innerHTML = '';
    if (!this.items.length) return;
    if (!it) { const t = this.el('div', 'at', b); this.el('span', '', t, 'Select an item to preview it on your character.'); return; }
    const im = this.el('img', 'ai', b); im.src = it.icon; im.alt = '';
    const t = this.el('div', 'at', b); this.el('b', '', t, it.name);
    const parts = it.type === 'set' ? it.parts ?? [] : [];
    this.el('span', '', t, it.type === 'set' ? `Full set · ${parts.length} pieces · previewing` : `${TYPE_LABEL[it.type] ?? it.type} · ${it.desc.charAt(0).toUpperCase() + it.desc.slice(1)}`);
    if (parts.length) { const pp = this.el('div', 'parts', t); for (const p of parts) { const pi = this.el('img', '', pp); pi.src = this.icon(p); pi.alt = ''; pi.title = cosmetic(p)?.name ?? p; } }
    const has = this.owned.has(it.id);
    const stop = this.el('button', 'plate', b, 'STOP PREVIEW'); stop.title = 'Back to what you actually wear';
    stop.addEventListener('click', () => { this.selected = null; this.tryOn = {}; this.refresh(); });
    const label = !has ? (this.qa ? 'GET FREE' : 'UNAVAILABLE') : this.isEquipped(it) ? 'UNEQUIP' : 'EQUIP';
    const act = this.el('button', 'plate', b, label);
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
    for (const b of this.swBtns) { const k = keyLabel(keys[b.action]); b.el.textContent = k ? `${b.label}  (${k})` : b.label; }
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
