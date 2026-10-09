// In-game HUD (DOM overlay, 1920x1080 design pixels scaled to the displayed game rect by syncOverlay).
// Panels: player status, contextual target, 8 action slots, north-up minimap, PvP room chip,
// plus hooks (effects, combat feedback) that stay hidden until the game supplies real data.
import { FONT_FAMILY, HUD as H, PVP } from '../config/layout';
import { ensureCharacterUIStyles, syncOverlay } from './CharacterSelectUI';
import { HudEffect, HudSlot, HudState, PortraitRef } from './hud/HudState';
import { GameMenu } from './HudExtras';
import { ICONS, ensureTheme } from './theme';

const A = (f: string) => `${H.path}/${f}.png`;
const P = H.palette;
const STYLE_ID = 'gol-hud-style';

const K = (f: string) => `assets/final/ui/kit/${f}.png`;
/** HUD geometry (1920x1080 design px). The player card (portrait, level, name, HP / resource) top-left, buffs under it. */
const G = {
  card: { x: 18, y: 16, w: 436, h: 104 },
  portrait: { x: 14, y: 14, d: 76 },
  name: { x: 106, y: 13, w: 314, h: 30 },
  hp: { x: 106, y: 48, w: 314, h: 19 },
  mp: { x: 106, y: 73, w: 314, h: 19 },
  buffs: { x: 22, y: 130, size: 38, gap: 8 },
  exp: { x: 460, y: 1046, w: 1000, h: 18 },
  /** Map window (rounded panel, the map inset in it) and the area's name under it. */
  minimap: { x: 1664, y: 16, w: 240, h: 240, view: { x: 8, y: 8, w: 222, h: 222 } },
  region: { x: 1664, y: 264, w: 240, h: 36 },
  room: { x: 1340, y: 16, w: 300, h: 64 },
  target: { x: 740, y: 16, w: 440, h: 92, in: { x: 92, y: 16, w: 320 } },
  combo: { x: 1320, y: 470, w: 300, h: 97 },
  /** The panels' pills: a column at the bottom right, over the gear menu. */
  menu: { right: 1904, bottom: 994, w: 220, h: 40, gap: 6 },
  /** Gold (left of the gear menu) and the pickup feed above it. */
  gold: { right: 1834, y: 1015 },
  feed: { right: 1668, bottom: 994 },
} as const;

/** Skill dock (bottom centre): the 20 slots in two rows of 10 — Space, 1-7, Q R above, F G C V T H Z X B N below — each slot
 *  the skill's own icon with its key on a small cap in its corner; the passives (always on) in a small grid on its right
 *  under their caption. The EXP bar runs under the dock. */
const DK = {
  slot: 64, gapX: 8, rowGap: 8, cols: 11,
  pad: { t: 14, r: 16, b: 14, l: 16 },
  pas: { icon: 36, gap: 6, cols: 4, rows: 3, sep: 16, head: 18 },
  /** The potions' column (HP above, MP below) between the skills and the passives. */
  pot: { sep: 16 },
  bottom: 1036,
} as const;
/** Row pitch, the slots' block and the dock's height. */
const ROW = DK.slot + DK.rowGap;
const GRID = { w: DK.cols * DK.slot + (DK.cols - 1) * DK.gapX, h: DK.slot + ROW };
const PAS_H = DK.pas.head + DK.pas.rows * DK.pas.icon + (DK.pas.rows - 1) * DK.pas.gap;
const INNER_H = Math.max(GRID.h, PAS_H);
const DOCK_H = DK.pad.t + INNER_H + DK.pad.b;
const slotAt = (i: number) => ({ x: DK.pad.l + (i % DK.cols) * (DK.slot + DK.gapX), y: DK.pad.t + Math.round((INNER_H - GRID.h) / 2) + Math.floor(i / DK.cols) * ROW });

const CSS = `
.gol-hud{color:var(--gl-text);font-family:var(--gl-body)}
.gol-hud .pn{position:absolute;pointer-events:none}
.gol-hud .h{font-family:var(--gl-title);font-weight:700;letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.gol-hud .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-hud .kimg{position:absolute;background:0 0/100% 100% no-repeat;pointer-events:none}
/* player card */
.gol-hud .card{position:absolute}
.gol-hud .pf{position:absolute;border-radius:50%;background:#0b1220;box-shadow:0 0 0 2px rgba(231,196,124,.75),0 0 0 5px rgba(13,20,33,.9),0 4px 12px rgba(0,0,0,.5);overflow:hidden}
.gol-hud .pf .img{position:absolute;inset:0;background-repeat:no-repeat}
.gol-hud .nm{position:absolute;display:flex;align-items:center;gap:10px;min-width:0}
.gol-hud .lvl{flex:none;height:24px;padding:0 9px;border-radius:999px;background:var(--gl-goldsoft);border:1px solid rgba(231,196,124,.4);
  font:700 12.5px/22px var(--gl-body);color:var(--gl-gold2);letter-spacing:.3px;white-space:nowrap}
.gol-hud .lvl::before{content:'Lv ';font-weight:600;opacity:.8}
.gol-hud .pname{min-width:0;font:700 20px/28px var(--gl-title);letter-spacing:1.2px;color:#f3e3bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* bars: a rounded track, a smooth fill, the value inside */
.gol-hud .bar{position:absolute;border-radius:999px;background:#0a101c;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),inset 0 2px 4px rgba(0,0,0,.5);overflow:hidden}
.gol-hud .bar .fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;transition:width ${H.barEaseMs}ms ease-out}
.gol-hud .bar .fill::after{content:'';position:absolute;left:4px;right:4px;top:2px;height:35%;border-radius:999px;background:linear-gradient(rgba(255,255,255,.32),rgba(255,255,255,0))}
.gol-hud .bar.hp .fill{background:linear-gradient(180deg,#f0685b,#c13a30)}
.gol-hud .bar.mp .fill{background:linear-gradient(180deg,#6fb4ff,#2f6fc7)}
.gol-hud .bar.xp .fill{background:linear-gradient(180deg,#f3d58c,#c99a45)}
.gol-hud .bar.thp .fill{background:linear-gradient(180deg,#f0685b,#c13a30)}
.gol-hud .bar .val{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 12.5px var(--gl-body);letter-spacing:.4px;color:#fff;
  text-shadow:0 1px 2px rgba(0,0,0,.85);font-variant-numeric:tabular-nums}
@keyframes golLow{0%,100%{box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 0 0 0 rgba(255,70,60,0)}50%{box-shadow:inset 0 0 0 1px rgba(255,120,110,.7),0 0 10px 1px rgba(255,70,60,.55)}}
.gol-hud .bar.hp.low{animation:golLow .9s ease-in-out infinite}
.gol-hud .bar.hp.low .fill{filter:saturate(1.25) brightness(1.1)}
.gol-hud .pjob{flex:none;font:600 12.5px/28px var(--gl-body);letter-spacing:.4px;color:var(--gl-text2);white-space:nowrap}
.gol-hud .pjob:empty{display:none}
/* potions in the dock */
.gol-hud .aslot.pot .ic{left:8px;top:8px;width:48px;height:48px}
.gol-hud .aslot .cnt{position:absolute;right:5px;bottom:3px;font:700 13px/16px var(--gl-body);color:#fff;text-shadow:0 1px 2px #000,0 0 4px #000;font-variant-numeric:tabular-nums}
.gol-hud .aslot.pot.none .ic{opacity:.35;filter:grayscale(1)}
.gol-hud .aslot.pot.none .cnt{color:#9aa3b2}
/* first find of an item (top centre) */
.gol-hud .nitem{position:absolute;left:${960 - 270}px;top:128px;width:540px;display:flex;align-items:center;gap:16px;padding:14px 22px 14px 14px;box-sizing:border-box;border-radius:16px;
  opacity:0;transform:translateY(-10px);transition:opacity 260ms ease-out,transform 260ms ease-out;pointer-events:none}
.gol-hud .nitem.on{opacity:1;transform:none}
.gol-hud .nitem .ic{flex:none;width:64px;height:64px;border-radius:14px;display:grid;place-items:center;background:radial-gradient(circle at 50% 45%,rgba(255,255,255,.12),rgba(255,255,255,.02) 70%);box-shadow:inset 0 0 0 1px var(--rc)}
.gol-hud .nitem .ic img{width:52px;height:52px}
.gol-hud .nitem .tx{min-width:0;display:flex;flex-direction:column;gap:4px}
.gol-hud .nitem .cap{font:700 11px/1 var(--gl-body);letter-spacing:1.8px;text-transform:uppercase;color:#c9ae78}
.gol-hud .nitem .cap i{font-style:normal;color:var(--rc);margin-left:8px}
.gol-hud .nitem .nm2{font:700 19px/1.2 var(--gl-title);letter-spacing:1px;color:var(--rc)}
.gol-hud .nitem .lo{font:italic 500 13.5px/1.45 var(--gl-body);color:var(--gl-text2)}
/* gold + pickups (bottom right) */
.gol-hud .gold{position:absolute;display:flex;align-items:center;gap:9px;height:40px;padding:0 16px 0 10px;border-radius:999px;
  font:700 15px/1 var(--gl-body);color:var(--gl-gold2);font-variant-numeric:tabular-nums;letter-spacing:.3px;white-space:nowrap}
.gol-hud .gold img{width:26px;height:26px}
.gol-hud .camc{position:absolute;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px;border-radius:14px;pointer-events:auto}
.gol-hud .camc.pvp{left:auto!important;top:auto!important;right:${1920 - 1846 + 12}px!important;bottom:${1080 - 1006 - 58 + 10}px!important;flex-direction:row;padding:6px 8px}
.gol-hud .camc.pvp .cl{margin:0 4px 0 2px}
.gol-hud .camc.pvp .sep{width:1px;height:22px;margin:0 3px}
.gol-hud .camc .cl{font:700 9.5px/12px var(--gl-body);letter-spacing:1.4px;color:#c9ae78;margin-bottom:2px}
.gol-hud .camc .sep{width:22px;height:1px;background:var(--gl-line2);margin:3px 0}
.gol-hud .camc button{width:34px;height:34px;padding:0;border-radius:10px;border:1px solid var(--gl-line2);background:rgba(255,255,255,.04);color:var(--gl-text2);
  cursor:pointer;display:grid;place-items:center;transition:background 120ms,border-color 120ms,color 120ms,transform 100ms}
.gol-hud .camc button:hover{background:var(--gl-goldsoft);border-color:var(--gl-goldline);color:var(--gl-gold2)}
.gol-hud .camc button:active{transform:scale(.92)}
.gol-hud .camc button::before{content:'';width:15px;height:15px;background:currentColor;-webkit-mask:var(--i) center/contain no-repeat;mask:var(--i) center/contain no-repeat}
.gol-hud .feed{position:absolute;display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none}
.gol-hud .feed .it{display:flex;align-items:center;gap:8px;height:32px;padding:0 14px 0 8px;border-radius:999px;background:rgba(9,14,24,.78);
  border:1px solid rgba(255,255,255,.1);font:700 13.5px/1 var(--gl-body);letter-spacing:.3px;white-space:nowrap;text-shadow:0 1px 2px #000;
  animation:golFeedIn 180ms ease-out;transition:opacity 400ms}
.gol-hud .feed .it img{width:22px;height:22px}
@keyframes golFeedIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
.gol-hud .bar.xp .val{letter-spacing:.6px;color:#fff8e6}
/* skill dock */
.gol-hud .dock{border-radius:16px}
.gol-hud .aslot{position:absolute;padding:0;border:0;border-radius:12px;background:#0b1220;pointer-events:auto;cursor:pointer;overflow:hidden;
  font:inherit;color:inherit;outline:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),inset 0 2px 6px rgba(0,0,0,.4);transition:transform 100ms,filter 100ms}
.gol-hud .aslot:hover{transform:translateY(-2px);filter:brightness(1.12)}
.gol-hud .aslot.pressed{transform:scale(.93)}
.gol-hud .aslot:focus-visible{box-shadow:0 0 0 2px var(--gl-gold)}
.gol-hud .aslot[aria-disabled=true]{cursor:default}
.gol-hud .aslot .ic{position:absolute;left:0;top:0;width:100%;height:100%}
.gol-hud .aslot.empty .ic{display:none}
.gol-hud .aslot.empty::before{content:'';position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px 0 0 -10px;background:rgba(174,182,195,.28);
  -webkit-mask:${ICONS.lock} center/contain no-repeat;mask:${ICONS.lock} center/contain no-repeat}
.gol-hud .aslot.sig{box-shadow:0 0 0 1px rgba(231,196,124,.7),0 0 12px rgba(231,196,124,.35)}
.gol-hud .aslot.off .ic{opacity:.4;filter:grayscale(1)}
.gol-hud .aslot .cd{position:absolute;inset:0;border-radius:12px;display:none;align-items:center;justify-content:center;
  font:700 24px var(--gl-body);text-shadow:0 1px 3px #000,0 0 6px #000}
.gol-hud .aslot .ult{position:absolute;inset:0;border-radius:12px;display:none;pointer-events:none;box-shadow:inset 0 0 0 2px #ff7a5c,0 0 14px rgba(255,110,80,.6);animation:golUlt 1.3s ease-in-out infinite}
.gol-hud .aslot.ult-ready .ult{display:block}
@keyframes golUlt{0%,100%{opacity:.65}50%{opacity:1}}
.gol-hud .key{position:absolute;z-index:2;height:18px;min-width:20px;padding:0 5px;box-sizing:border-box;border-radius:6px;background:rgba(9,14,24,.88);
  border:1px solid rgba(255,255,255,.18);text-align:center;font:700 10.5px/16px var(--gl-body);letter-spacing:.3px;color:#ece5d3;pointer-events:none;white-space:nowrap}
.gol-hud .dock .sep{position:absolute;width:1px;background:var(--gl-line2)}
.gol-hud .dock .pas{position:absolute}
.gol-hud .dock .pas .lab{position:absolute;left:0;right:0;top:0;height:14px;text-align:center;font:700 10.5px/14px var(--gl-body);letter-spacing:1.6px;color:#c9ae78;white-space:nowrap}
.gol-hud .dock .pas .pi{position:absolute;width:${DK.pas.icon}px;height:${DK.pas.icon}px;border-radius:9px;overflow:hidden;pointer-events:auto;cursor:help;transition:transform 100ms;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.gol-hud .dock .pas .pi:hover{transform:scale(1.08)}
.gol-hud .dock .pas .pi img{width:100%;height:100%;display:block}
.gol-hud .dock .pas .pi.lk img{filter:grayscale(1) brightness(.4)}
.gol-hud .dock .pas .pi.lk::after{content:'';position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;background:rgba(220,226,235,.75);
  -webkit-mask:${ICONS.lock} center/contain no-repeat;mask:${ICONS.lock} center/contain no-repeat}
/* buffs */
.gol-hud .fx{position:absolute;display:flex;gap:${G.buffs.gap}px}
.gol-hud .fx .e{position:relative;border-radius:9px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.14),0 3px 8px rgba(0,0,0,.4)}
.gol-hud .fx .e img{position:absolute;left:0;top:0;width:100%;height:100%}
.gol-hud .fx .e.bad{box-shadow:0 0 0 1px rgba(239,127,111,.8),0 0 8px rgba(239,127,111,.5)}
.gol-hud .fx .more{font:700 16px var(--gl-body);align-self:center;text-shadow:0 1px 2px #000}
/* map */
.gol-hud .mm .view{position:absolute;overflow:hidden;background:#06101c;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.gol-hud .mm .view img.bg{position:absolute}
.gol-hud .mm .mk{position:absolute;width:${H.minimap.marker}px;height:${H.minimap.marker}px;margin:-${H.minimap.marker / 2}px 0 0 -${H.minimap.marker / 2}px}
.gol-hud .mm .na{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--gl-text2);opacity:.7}
.gol-hud .region{position:absolute;display:flex;align-items:center;justify-content:center;font:700 14px var(--gl-title);color:#f0dfb6;letter-spacing:1.2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 16px;border-radius:999px}
.gol-hud .target .tpf{position:absolute;left:16px;top:16px;width:60px;height:60px;border-radius:50%;overflow:hidden;background:#0a1018;box-shadow:0 0 0 2px rgba(231,196,124,.7)}
.gol-hud .target .tpf .img{position:absolute;inset:0;background-repeat:no-repeat}
.gol-hud.compact .room .n2{display:none!important}
@media (prefers-reduced-motion:reduce){.gol-hud .bar .fill{transition:none}}
.gol-hud .dim{position:absolute;left:0;top:0;width:1920px;height:1080px;z-index:20;background:rgba(4,7,14,.55);opacity:0;visibility:hidden;transition:opacity .18s,visibility .18s;pointer-events:none}
.gol-hud.modal .dim{opacity:1;visibility:visible}
.gol-hud .gol-ql,.gol-hud .gol-pw,.gol-hud .gol-pi,.gol-hud .gol-keys,.gol-hud .gol-dlg,.gol-hud .gol-shop,.gol-hud .gol-stats{z-index:30}
.gol-hud.bare > :not(.gol-ql):not(.gol-pw):not(.gol-pi):not(.gol-keys):not(.gol-dlg):not(.gol-shop):not(.gol-stats){visibility:hidden}
.gol-hud .combo{position:absolute;left:${G.combo.x}px;top:${G.combo.y}px;width:${G.combo.w}px;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;transition:opacity .18s}
.gol-hud .combo .n{display:flex;align-items:baseline;gap:8px;padding:6px 22px 8px;border-radius:999px;background:rgba(13,20,33,.86);border:1px solid rgba(231,196,124,.35);
  box-shadow:0 8px 20px rgba(0,0,0,.35);font:700 34px/1 var(--gl-title);color:var(--gl-gold2);font-variant-numeric:tabular-nums}
.gol-hud .combo .n small{font:700 12px var(--gl-body);letter-spacing:1.6px;color:#d9c79f}
.gol-hud .combo .l{font:600 13px var(--gl-body);letter-spacing:.6px;color:#cfe3f5;text-shadow:0 1px 3px rgba(0,0,0,.8);white-space:nowrap}
.gol-hud .combo.bump .n{animation:golBump .22s ease-out 1}
@keyframes golBump{0%{transform:scale(1.14)}100%{transform:scale(1)}}
.gol-hud .banner{position:absolute;left:560px;top:300px;width:800px;height:110px;display:none;align-items:center;justify-content:center;
  font-family:var(--gl-title);font-weight:700;font-size:64px;letter-spacing:10px;color:#f0c27a;text-shadow:0 3px 0 #2a0a04,0 0 24px rgba(200,40,20,.7);
  background:radial-gradient(ellipse at center,rgba(40,6,4,.75) 0%,rgba(40,6,4,0) 70%)}
.gol-hud .banner small{display:block;font-size:22px;letter-spacing:4px;color:#e9d9b8;margin-top:4px}
/* the panels' buttons (right side, under the map) */
.gol-hud .menu{position:absolute;right:${1920 - G.menu.right}px;bottom:${1080 - G.menu.bottom}px;width:${G.menu.w}px;display:flex;flex-direction:column;gap:${G.menu.gap}px;pointer-events:auto}
.gol-hud .menu button{height:${G.menu.h}px;justify-content:flex-start;padding:0 14px;gap:12px;border-radius:12px;background:rgba(13,20,33,.9);border-color:rgba(231,196,124,.22);
  box-shadow:0 6px 16px rgba(0,0,0,.3);font-size:13.5px}
.gol-hud:has(.gol-menu.open) .menu{visibility:hidden}
.gol-hud .menu button:hover:not(:disabled){background:rgba(24,34,52,.95)}
.gol-hud .menu button b{font-weight:700}
.gol-hud .menu button .gl-key{min-width:26px}
/* battle mode (arena 1v1): the fight's own HUD across the top takes over — no card, target, map, panels pills or EXP */
.gol-hud.battle .card,.gol-hud.battle .target,.gol-hud.battle .tfx,.gol-hud.battle .mm,.gol-hud.battle .region,.gol-hud.battle .menu,
.gol-hud.battle .room,.gol-hud.battle .gol-qt,.gol-hud.battle .xpw,.gol-hud.battle .camc,.gol-hud.battle .gol-chat{display:none!important}
`;

interface Bar { root: HTMLDivElement; fill: HTMLDivElement; val?: HTMLSpanElement; w: number; last: string }
interface SlotEl { btn: HTMLButtonElement; icon: HTMLImageElement; cd: HTMLDivElement; last: string; slot?: HudSlot }

export interface WorldHUDOptions {
  returnLabel: string;
  onReturn: () => void;
  /** Click on a slot: the same action handler as its hotkey (scene validates; never a second Space attack). */
  onSlot: (index: number) => void;
  /** Skill Book (K) / Inventory (I) / Cosmetic Shop (O) toggles. */
  onMenu?: (key: 'K' | 'I' | 'O' | 'J' | 'P' | 'U') => void;
  /** Gear menu: open the Key Settings window. */
  onKeys?: () => void;
  /** The camera buttons beside the minimap. */
  onCam?: (what: 'in' | 'out' | 'up' | 'down' | 'reset') => void;
  /** A buff right-clicked (one that can be ended early). */
  onCancelBuff?: (id: string) => void;
  /** Click on a potion (0 HP, 1 MP). */
  onPotion?: (i: 0 | 1) => void;
}

export class WorldHUD {
  private root: HTMLDivElement;
  private menu: GameMenu;
  private lastRect = '';
  private status?: HTMLDivElement;
  private els: Record<string, HTMLElement> = {};
  private hp!: Bar;
  private res!: Bar;
  private exp!: Bar;
  private thp!: Bar;
  private slots: SlotEl[] = [];
  private keyEls: { el: HTMLDivElement; x: number; y: number }[] = [];
  private pots: { btn: HTMLButtonElement; icon: HTMLImageElement; cnt: HTMLElement; key: HTMLElement; last: string }[] = [];
  private potsOn = false;
  private passiveCount = 0;
  /** Current hotkey label per slot (aria / tooltips). */
  labels: string[] = [];
  private tGauge: HTMLElement[] = [];
  private markers = new Map<string, HTMLImageElement>();
  /** The key letter on each menu pill (follows Key Settings). */
  private menuKeys = new Map<string, HTMLElement>();
  private mmPic?: HTMLImageElement;
  private mmImage = '';
  private sinceMarkers = Infinity;
  private lastNow = 0;
  private cache = new Map<string, string>();

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, private opts: WorldHUDOptions) {
    ensureCharacterUIStyles();
    ensureTheme();
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement('style');
      st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
    }
    this.root = this.div('gol-cs gol-hud');
    host.appendChild(this.root);
    this.div('dim', this.root); // the world and the HUD fade back under an open window
    this.buildPlayer();
    this.buildTarget();
    this.buildMinimap();
    this.buildRoom();
    this.buildSkills();
    this.buildPassives();
    this.setKeyLabels(H.skills.hotkeys.map((k) => (k === 'Space' ? 'SPACE' : k)));
    this.buildCombat();

    // Gear MENU (bottom-right): the panels and the way back (Back to Characters / Exit Arena).
    this.menu = new GameMenu(this.root, [
      { key: 'I', label: 'INVENTORY', run: () => opts.onMenu?.('I') },
      { key: 'K', label: 'SKILL BOOK', run: () => opts.onMenu?.('K') },
      { key: 'U', label: 'STATS', run: () => opts.onMenu?.('U') },
      { key: 'J', label: 'QUESTS', run: () => opts.onMenu?.('J') },
      { key: 'P', label: 'PARTY', run: () => opts.onMenu?.('P') },
      { key: 'O', label: 'COSMETIC SHOP', run: () => opts.onMenu?.('O') },
      { label: 'KEY SETTINGS', run: () => opts.onKeys?.() },
      { label: opts.returnLabel, run: () => opts.onReturn() },
    ]);
    this.layout();
  }

  // ------------------------------------------------------------------ build

  private buildPlayer(): void {
    const p = this.panel('card gl-panel', G.card);
    const pf = this.div('pf', p); this.at(pf, G.portrait.x, G.portrait.y, G.portrait.d, G.portrait.d);
    this.els.portrait = this.div('img', pf);
    const nm = this.div('nm', p); this.at(nm, G.name.x, G.name.y, G.name.w, G.name.h);
    this.els.pLevel = this.div('lvl', nm);
    this.els.pName = this.div('pname', nm);
    this.els.pJob = this.div('pjob', nm);
    this.hp = this.bar(p, G.hp, 'hp', true);
    this.res = this.bar(p, G.mp, 'mp', true);
    this.res.root.style.display = 'none';
    this.els.pFx = this.div('fx', this.root); this.at(this.els.pFx, G.buffs.x, G.buffs.y, 400, G.buffs.size);
    // EXP bar under the skill dock (fills when the progression system supplies player.exp)
    const ex = this.div('pn xpw', this.root); this.box(ex, { x: 0, y: 0, w: 1920, h: 1080 });
    this.exp = this.bar(ex, G.exp, 'xp', true);
  }

  private buildTarget(): void {
    const t = this.panel('target gl-panel', G.target);
    t.style.display = 'none';
    const pf = this.div('tpf', t);
    this.els.tIconWrap = pf;
    this.els.tIcon = this.div('img', pf);
    const I = G.target.in;
    this.els.tName = this.div('h', t); this.at(this.els.tName, I.x, I.y - 2, I.w - 80, 24); Object.assign(this.els.tName.style, { fontSize: '17px', lineHeight: '24px' });
    this.els.tType = this.div('t', t); this.at(this.els.tType, I.x, I.y + 22, I.w - 80, 18); Object.assign(this.els.tType.style, { fontSize: '13px', lineHeight: '18px', color: 'var(--gl-text2)' });
    this.thp = this.bar(t, { x: I.x, y: I.y + 44, w: I.w, h: 10 }, 'thp', false);
    // Combat state chip + three combo-protection gauges (standing / air / down) under the HP bar.
    const chip = this.div('chip', t); Object.assign(chip.style, { position: 'absolute', right: '22px', top: `${I.y}px`, fontSize: '13px', fontWeight: '700', letterSpacing: '1px' });
    this.els.tChip = chip;
    const gw = (I.w - 8) / 3;
    this.tGauge = (['#ff5a4a', '#5ab8ff', '#ffd25a'] as const).map((c, i) => {
      const bg = this.div('g', t); this.at(bg, I.x + i * (gw + 4), I.y + 60, gw, 5); Object.assign(bg.style, { background: 'rgba(0,0,0,.45)', borderRadius: '3px', overflow: 'hidden' });
      const f = this.div('gf', bg); Object.assign(f.style, { position: 'absolute', left: '0', top: '0', bottom: '0', width: '0%', background: c, borderRadius: '3px' });
      return f;
    });
    this.els.tFx = this.div('fx tfx', this.root); this.at(this.els.tFx, G.target.x + 16, G.target.y + G.target.h + 8, G.target.w, 32);
  }

  private buildMinimap(): void {
    const m = this.panel('mm gl-panel', G.minimap);
    const V = G.minimap.view;
    const view = this.div('view', m); this.at(view, V.x, V.y, V.w, V.h);
    this.els.mmView = view;
    const label = this.div('region gl-panel', this.root); this.box(label, G.region);
    this.els.mmLabel = label;
  }

  private buildRoom(): void {
    const r = this.panel('room gl-panel', G.room);
    r.style.display = 'none';
    const n1 = this.div('t', r); this.at(n1, 20, 11, G.room.w - 40, 20); Object.assign(n1.style, { fontSize: '15px', fontWeight: '700', lineHeight: '20px' });
    const n2 = this.div('t n2', r); this.at(n2, 20, 33, G.room.w - 40, 20); Object.assign(n2.style, { fontSize: '13px', color: 'var(--gl-text2)', lineHeight: '20px' });
    this.els.roomLabel = n1; this.els.roomCount = n2;
  }

  private buildSkills(): void {
    const dock = this.panel('dock gl-panel', { x: 0, y: DK.bottom - DOCK_H, w: 0, h: DOCK_H });
    H.skills.hotkeys.forEach((key, i) => {
      const { x, y } = slotAt(i);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aslot';
      this.at(btn, x, y, DK.slot, DK.slot);
      const icon = document.createElement('img'); icon.className = 'ic'; icon.alt = ''; icon.draggable = false;
      const cd = this.div('cd', btn);
      btn.insertBefore(icon, cd);
      btn.insertBefore(this.div('ult'), icon); // glowing red frame sits under the icon
      btn.addEventListener('mousedown', (e) => e.preventDefault()); // no focus steal from the game
      btn.addEventListener('keyup', (e) => { if (e.key === ' ') e.preventDefault(); }); // Phaser owns Space: block the button's own Space click (no 2nd attack)
      const el: SlotEl = { btn, icon, cd, last: '' };
      btn.addEventListener('click', () => { if (el.slot?.assigned && el.slot.enabled && !el.slot.busy) this.opts.onSlot(i); });
      dock.appendChild(btn);
      const k = this.div('key', dock);
      this.keyEls.push({ el: k, x: x + 4, y: y + 4 }); // the cap: in the slot's top-left corner
      this.slots.push(el);
    });
  }

  /** The passives' corner of the dock (always-on skills; locked ones dimmed), right of the slots past a thin divider. */
  private buildPassives(): void {
    this.els.sep = this.div('sep', this.els.dock);
    this.els.passives = this.div('pas', this.els.dock);
    this.els.potSep = this.div('sep', this.els.dock);
    for (let i = 0; i < 2; i++) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'aslot pot';
      const icon = document.createElement('img'); icon.className = 'ic'; icon.alt = ''; icon.draggable = false; btn.appendChild(icon);
      const cnt = this.div('cnt', btn);
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => this.opts.onPotion?.(i as 0 | 1));
      this.els.dock.appendChild(btn);
      const k = this.div('key', this.els.dock);
      this.pots.push({ btn, icon, cnt, key: k, last: '' });
    }
    const gold = this.div('gold gl-panel', this.root); gold.style.top = `${G.gold.y}px`; gold.style.right = `${1920 - G.gold.right}px`; gold.style.display = 'none';
    const gi = document.createElement('img'); gi.src = 'assets/final/items/gold_small.png'; gi.alt = ''; gold.appendChild(gi);
    this.els.goldV = document.createElement('span'); gold.appendChild(this.els.goldV); gold.title = 'Gold';
    this.els.gold = gold;
    const feed = this.div('feed', this.root); feed.style.right = `${1920 - G.feed.right}px`; feed.style.bottom = `${1080 - G.feed.bottom}px`; this.els.feed = feed;
    // the camera's buttons: zoom in / out, view up / down, reset — a slim column left of the minimap (held: repeats)
    const cc = this.div('camc gl-panel', this.root); cc.style.right = `${1920 - (G.menu.right - G.menu.w - 10)}px`; cc.style.bottom = `${1080 - G.menu.bottom}px`;   // left of the panels' pills, bottom right cc.setAttribute('aria-label', 'Camera'); this.els.camc = cc;
    this.div('cl', cc).textContent = 'CAM';
    const btn = (what: 'in' | 'out' | 'up' | 'down' | 'reset', icon: string, title: string) => {
      const b = document.createElement('button'); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.style.setProperty('--i', icon);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      let rep = 0; const go = () => this.opts.onCam?.(what);
      b.addEventListener('pointerdown', () => { go(); if (what !== 'reset') rep = window.setInterval(go, 140); });
      for (const ev of ['pointerup', 'pointerleave']) b.addEventListener(ev, () => window.clearInterval(rep));
      cc.appendChild(b);
    };
    btn('in', ICONS.plus, 'Zoom in (mouse wheel)'); btn('out', ICONS.minus, 'Zoom out (mouse wheel)');
    this.div('sep', cc);
    btn('up', ICONS.up, 'View up (PageUp)'); btn('down', ICONS.down, 'View down (PageDown)');
    this.div('sep', cc);
    btn('reset', ICONS.rotate, 'Reset camera (Home)');
    this.placeDock(0);
  }

  setPassives(list: { id: string; name: string; iconUrl: string; owned: boolean; info: string }[]): void {
    const box = this.els.passives, A = DK.pas;
    box.innerHTML = '';
    const cols = Math.max(A.cols, Math.ceil(list.length / A.rows));
    list.forEach((p, i) => {
      const e = this.div(`pi${p.owned ? '' : ' lk'}`, box);
      e.style.left = `${(i % cols) * (A.icon + A.gap)}px`; e.style.top = `${A.head + Math.floor(i / cols) * (A.icon + A.gap)}px`;
      const img = document.createElement('img'); img.src = p.iconUrl; img.alt = ''; img.draggable = false; e.appendChild(img);
      e.title = `${p.name}${p.owned ? '' : ' (locked)'}\n${p.info}`;
    });
    if (list.length) this.div('lab', box).textContent = 'PASSIVE';
    this.passiveCount = list.length; this.placeDock(list.length);
  }

  /** The dock's width follows its passives (none: the slots alone); it stays centred over the EXP bar. */
  private placeDock(passives: number): void {
    const A = DK.pas, dock = this.els.dock, sep = this.els.sep, box = this.els.passives;
    const potOn = this.potsOn;
    this.els.potSep.style.display = potOn ? '' : 'none';
    this.pots.forEach((p, i) => {
      p.btn.style.display = p.key.style.display = potOn ? '' : 'none';
      const x = DK.pad.l + GRID.w + DK.pot.sep * 2 + 1, y = slotAt(i * DK.cols).y;
      this.at(p.btn, x, y, DK.slot, DK.slot); this.at(p.key, x + 4, y + 4, 0, 18); p.key.style.width = '';
    });
    if (potOn) this.at(this.els.potSep, DK.pad.l + GRID.w + DK.pot.sep, DK.pad.t + 8, 1, INNER_H - 16);
    const gw = DK.pad.l + GRID.w + (potOn ? DK.pot.sep * 2 + 1 + DK.slot : 0);
    let w = gw + DK.pad.r;
    const on = passives > 0;
    sep.style.display = box.style.display = on ? '' : 'none';
    if (on) {
      const cols = Math.max(A.cols, Math.ceil(passives / A.rows)), rows = Math.ceil(passives / cols);
      const bw = cols * A.icon + (cols - 1) * A.gap, bh = A.head + rows * A.icon + (rows - 1) * A.gap;
      const sx = gw + A.sep;
      this.at(sep, sx, DK.pad.t + 8, 1, INNER_H - 16);
      this.at(box, sx + 1 + A.sep, DK.pad.t + Math.round((INNER_H - bh) / 2), bw, bh);
      w = sx + 1 + A.sep + bw + DK.pad.r;
    }
    this.box(dock, { x: Math.round(960 - w / 2), y: DK.bottom - DOCK_H, w, h: DOCK_H });
  }

  private buildCombat(): void {
    const c = this.panel('combat', H.combat);
    c.style.display = 'none';
    c.remove();
    const combo = this.div('combo', this.root); combo.style.display = 'none';
    const n = this.div('n', combo), l = this.div('l', combo);
    this.els.combat = combo; this.els.cN = n; this.els.cL = l;
    const ban = this.div('banner', this.root); this.els.banner = ban;
    if (this.opts.onMenu) {
      const m = this.div('menu', this.root);
      for (const [k, label] of [['I', 'Inventory'], ['K', 'Skill Book'], ['U', 'Stats'], ['J', 'Quests'], ['P', 'Party'], ['O', 'Cosmetic Shop']] as const) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'gl-btn';
        b.innerHTML = `<span class="gl-key">${k}</span><b>${label}</b>`; this.menuKeys.set(k, b.firstChild as HTMLElement);
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => this.opts.onMenu?.(k));
        m.appendChild(b);
      }
    }
  }

  // ------------------------------------------------------------------ update

  /** `now` = adapter clock in ms (used for cooldown/feedback expiry). Writes the DOM only on change. */
  update(s: HudState, now: number, ms: number): void {
    this.lastNow = now;
    // Player
    this.els.camc?.classList.toggle('pvp', s.mode === 'pvp');
    const pl = s.player;
    this.text(this.els.pName, pl.name, 'pName');
    this.text(this.els.pLevel, String(pl.level), 'pLevel');
    this.portrait(this.els.portrait, pl.portrait, 'pPortrait', G.portrait.d);
    this.text(this.els.pJob, pl.job ?? '', 'pJob');
    this.setBar(this.hp, pl.hp, pl.maxHp, 'HP');
    this.hp.root.classList.toggle('low', pl.maxHp > 0 && pl.hp > 0 && pl.hp / pl.maxHp < 0.25);
    this.show(this.els.gold, pl.gold !== undefined);
    if (pl.gold !== undefined) this.text(this.els.goldV, pl.gold.toLocaleString('en-US'), 'gold');
    const potOn = !!pl.potions?.length;
    if (potOn !== this.potsOn) { this.potsOn = potOn; this.placeDock(this.passiveCount); }
    pl.potions?.slice(0, 2).forEach((p, i) => {
      const e = this.pots[i], key = `${p.iconUrl}|${p.count}|${p.hotkey}`;
      if (key === e.last) return; e.last = key;
      e.icon.src = p.iconUrl; e.cnt.textContent = String(p.count); e.key.textContent = p.hotkey; e.key.style.display = p.hotkey ? '' : 'none';
      e.btn.classList.toggle('none', p.count <= 0);
      e.btn.title = `${p.name} ×${p.count}${p.hotkey ? ` — ${p.hotkey}` : ''}`; e.btn.setAttribute('aria-label', e.btn.title);
    });
    if (pl.resource) { this.res.root.style.display = ''; this.setBar(this.res, pl.resource.value, pl.resource.max, pl.resource.kind.toUpperCase()); }
    else this.res.root.style.display = 'none';
    this.setBar(this.exp, pl.exp?.value ?? 0, pl.exp?.max ?? 1, 'EXP');
    this.effects(this.els.pFx, pl.effects, G.buffs.size, now, 'pFx');

    // Target
    const t = s.target, tp = this.els.target;
    this.show(tp, !!t);
    if (t) {
      const hasIcon = !!t.portrait;
      this.show(this.els.tIconWrap, hasIcon);
      if (hasIcon) this.portrait(this.els.tIcon, t.portrait, 'tPortrait', 60);
      this.text(this.els.tName, t.name, 'tName');
      this.text(this.els.tType, t.type, 'tType');
      this.setBar(this.thp, t.hp, t.maxHp);
      const st = t.state ?? '';
      if (this.changed('tChip', st)) { this.els.tChip.textContent = st; this.els.tChip.style.color = st === 'AERIAL' ? '#7fd0ff' : st === 'DOWN' ? '#ffd25a' : '#ff8a6a'; }
      const g = t.gauges;
      this.tGauge.forEach((f, i) => { const v = g ? [g.stand, g.air, g.down][i] : 0; f.style.width = `${Math.min(100, v * 100)}%`; f.style.opacity = v >= 1 ? '1' : '0.75'; });
      this.effects(this.els.tFx, t.effects, 32, now, 'tFx');
    } else this.effects(this.els.tFx, [], 32, now, 'tFx');

    // Slots
    s.slots.slice(0, this.slots.length).forEach((sl, i) => this.renderSlot(this.slots[i], sl, now));

    // Minimap (markers ~10Hz)
    this.sinceMarkers += ms;
    this.renderMinimap(s, this.sinceMarkers >= H.minimap.updateMs);
    if (this.sinceMarkers >= H.minimap.updateMs) this.sinceMarkers = 0;

    // PvP room chip
    this.show(this.els.room, !!s.room);
    if (s.room) {
      this.text(this.els.roomLabel, s.room.label, 'roomLabel');
      this.text(this.els.roomCount, `${s.room.playerCount}${s.room.maxPlayers ? ` / ${s.room.maxPlayers}` : ''} PLAYERS`, 'roomCount');
    }

    // Combo counter: confirmed hits only (shown from the 2nd hit, persists ~850ms after the last one).
    const f = s.combatFeedback && Number.isFinite(s.combatFeedback.expiresAtMs) && s.combatFeedback.expiresAtMs > now ? s.combatFeedback : null;
    this.show(this.els.combat, !!f);
    if (f) {
      if (this.changed('cN', String(f.count))) {
        this.els.cN.innerHTML = `${f.count}<small>HITS</small>`; // the count bumps on every hit
        this.els.combat.classList.remove('bump'); void this.els.combat.offsetWidth; this.els.combat.classList.add('bump');
      }
      this.text(this.els.cL, f.chain ?? '', 'cL');
      this.els.combat.style.opacity = String(Math.min(1, (f.expiresAtMs - now) / 180));
    } else this.changed('cN', '');
    if (this.bannerLeft > 0) { this.bannerLeft -= ms; if (this.bannerLeft <= 0) this.show(this.els.banner, false); else this.els.banner.querySelector('small')!.textContent = this.bannerSub(); }
  }

  private bannerLeft = 0;
  private bannerTotal = 0;
  private bannerCountdown = true;
  private bannerSub(): string { return this.bannerCountdown && this.bannerTotal > 900 ? `RESPAWN IN ${Math.ceil(this.bannerLeft / 1000)}` : ''; }

  /** Short centre banner (defeat / KO); `ms` = how long it stays (respawn countdown shown when long enough). */
  /** Big centred banner; `countdown` adds the RESPAWN IN n line (death). */
  banner(text: string, ms: number, countdown = true): void {
    this.bannerLeft = ms; this.bannerTotal = ms; this.bannerCountdown = countdown;
    this.els.banner.innerHTML = `<div style="text-align:center">${text}<small></small></div>`;
    this.els.banner.style.display = 'flex';
  }

  private renderSlot(el: SlotEl, s: HudSlot, now: number): void {
    el.slot = s;
    let rem = 0;
    const cd = s.cooldown;
    if (cd && Number.isFinite(cd.endTimeMs) && cd.durationMs > 0) rem = Math.min(cd.durationMs, Math.max(0, cd.endTimeMs - now));
    const disabled = !s.assigned || !s.enabled;
    const state = disabled ? 'disabled' : rem > 0 ? 'cooldown' : s.pressed ? 'pressed' : 'ready'; // manifest precedence
    const icon = s.iconUrl ?? (s.assigned ? A('icon-attack') : A('icon-lock'));
    const label = s.assigned ? s.label : 'Unassigned';
    const busy = !disabled && !!s.busy; // action lock / control: looks ready or cooling, but cannot execute
    const key = `${state}|${icon}|${label}|${s.hotkey}|${busy}|${s.tier ?? ''}`;
    if (key !== el.last) {
      el.btn.classList.toggle('ult-ready', s.tier === 'ultimate' && state === 'ready');
      el.btn.classList.toggle('sig', s.tier === 'signature');
      el.btn.classList.toggle('pressed', state === 'pressed');
      el.last = key;
      el.btn.classList.toggle('off', disabled);
      el.btn.classList.toggle('empty', !s.iconUrl); // no skill art: the kit's empty socket, the small pictogram in it
      el.icon.src = icon;
      el.btn.setAttribute('aria-disabled', String(disabled || busy));
      el.btn.setAttribute('aria-label', `${label}${s.hotkey ? ` (${s.hotkey})` : ''}${busy ? ' — Busy' : ''}`);
      el.btn.title = busy ? `${label} — Busy` : s.hotkey ? `${label} — ${s.hotkey}` : label;
    }
    if (rem > 0) {
      const pct = (rem / cd!.durationMs) * 100;
      el.cd.style.display = 'flex';
      el.cd.style.background = `conic-gradient(rgba(0,0,0,.62) 0 ${pct}%, transparent ${pct}% 100%)`;
      el.cd.textContent = String(Math.ceil(rem / 1000)); // ceil(seconds); 0 => ready
    } else if (el.cd.style.display !== 'none') el.cd.style.display = 'none';
  }

  private renderMinimap(s: HudState, markersDue: boolean): void {
    const m = s.minimap, view = this.els.mmView;
    this.text(this.els.mmLabel, m?.label ?? '', 'mmLabel');
    const vw = G.minimap.view.w, vh = G.minimap.view.h;
    if (!m || !(m.bounds.width > 0 && m.bounds.height > 0)) { this.mapUnavailable(); return; }
    // The window (bounds) fills the view; the picture (image, world px) slides under it as you walk.
    const B = m.bounds, I = m.image ?? { x: B.minX, y: B.minY, w: B.width, h: B.height };
    const k = Math.min(vw / B.width, vh / B.height), ox = (vw - B.width * k) / 2, oy = (vh - B.height * k) / 2;
    if (m.imageUrl !== this.mmImage) {
      this.mmImage = m.imageUrl ?? '';
      view.replaceChildren(); this.markers.clear(); this.mmPic = undefined;
      if (m.imageUrl) {
        const img = document.createElement('img');
        img.className = 'bg'; img.alt = ''; img.draggable = false;
        img.onerror = () => this.mapUnavailable();
        img.src = m.imageUrl;
        view.appendChild(img);
        this.mmPic = img;
      }
    }
    if (this.mmPic) this.at(this.mmPic, ox + (I.x - B.minX) * k, oy + (I.y - B.minY) * k, I.w * k, I.h * k);
    const seen = new Set<string>();
    for (const mk of m.markers) {
      if (!Number.isFinite(mk.x) || !Number.isFinite(mk.y)) continue;
      const u = ox + (mk.x - B.minX) * k, v = oy + (mk.y - B.minY) * k;
      if (u < 0 || u > vw || v < 0 || v > vh) continue; // outside the window: hidden
      seen.add(mk.id);
      let el = this.markers.get(mk.id);
      if (!el) {
        if (!markersDue) continue;
        el = document.createElement('img');
        el.className = 'mk'; el.alt = ''; el.draggable = false;
        el.src = K(mk.kind === 'player' ? 'marker_player' : mk.kind === 'npc' ? 'marker_npc' : mk.kind === 'quest' ? 'marker_quest_star' : mk.kind === 'enemy' ? 'marker_boss' : 'marker_portal');
        el.style.zIndex = mk.kind === 'player' ? '3' : '2';
        view.appendChild(el);
        this.markers.set(mk.id, el);
      }
      el.style.left = `${u.toFixed(1)}px`;
      el.style.top = `${v.toFixed(1)}px`;
    }
    for (const [id, el] of this.markers) if (!seen.has(id)) { el.remove(); this.markers.delete(id); }
  }

  private mapUnavailable(): void {
    const view = this.els.mmView;
    if (view.querySelector('.na')) return;
    view.replaceChildren(); this.markers.clear(); this.mmPic = undefined;
    this.div('na', view).textContent = 'Map unavailable';
  }

  private effects(row: HTMLElement, list: HudEffect[], size: number, now: number, id: string): void {
    const live = list.filter((e) => e.expiresAtMs === undefined || e.expiresAtMs > now);
    const key = live.map((e) => `${e.id}:${e.iconUrl}:${e.harmful}:${e.cancellable ? 1 : 0}`).join(',');
    if (!this.changed(id, key)) return;
    row.replaceChildren();
    row.style.display = live.length ? 'flex' : 'none';
    live.slice(0, H.buffs.max).forEach((e) => {
      const d = this.div(`e${e.harmful ? ' bad' : ''}`, row);
      Object.assign(d.style, { width: `${size}px`, height: `${size}px` });
      d.title = e.cancellable ? `${e.label} — right-click to end` : e.label; d.setAttribute('aria-label', e.label);
      if (e.cancellable) { d.style.pointerEvents = 'auto'; d.style.cursor = 'pointer'; d.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.opts.onCancelBuff?.(e.id); }); }
      const img = document.createElement('img'); img.alt = ''; img.src = e.iconUrl; d.appendChild(img);
    });
    if (live.length > H.buffs.max) {
      const more = this.div('more', row);
      more.textContent = `+${live.length - H.buffs.max}`;
      more.title = live.slice(H.buffs.max).map((e) => e.label).join(', ');
    }
  }

  private portrait(el: HTMLElement, p: PortraitRef | undefined, id: string, w: number): void {
    const key = p ? `${p.url}|${p.crop ? Object.values(p.crop).join(',') : ''}` : '';
    if (!this.changed(id, key)) return;
    const fallback = () => Object.assign(el.style, { backgroundImage: `url("${A('icon-portrait-fallback')}")`, backgroundSize: '70%', backgroundPosition: 'center' });
    if (!p) { fallback(); return; }
    const probe = new Image();
    probe.onerror = fallback; // safe fallback on a missing portrait file
    probe.src = p.url;
    if (p.crop) {
      const k = w / p.crop.w;
      Object.assign(el.style, { backgroundImage: `url("${p.url}")`, backgroundSize: `${p.crop.imgW * k}px ${p.crop.imgH * k}px`, backgroundPosition: `${-p.crop.x * k}px ${-p.crop.y * k}px` });
    } else Object.assign(el.style, { backgroundImage: `url("${p.url}")`, backgroundSize: 'cover', backgroundPosition: 'center top' });
  }

  private setBar(b: Bar, value: number, max: number, what = 'HP'): void {
    const ok = Number.isFinite(value) && Number.isFinite(max) && max > 0;
    const ratio = ok ? Math.min(1, Math.max(0, value / max)) : 0;
    const key = ok ? `${value}/${max}` : '';
    if (key === b.last) return;
    b.last = key;
    b.fill.style.width = `${b.w * ratio}px`;
    if (b.val) b.val.textContent = !ok ? '' : what === 'EXP' ? `EXP  ${Math.round(value).toLocaleString('en-US')} / ${Math.round(max).toLocaleString('en-US')}  (${(ratio * 100).toFixed(2)}%)` : `${Math.max(0, Math.round(value))} / ${Math.round(max)}`;
    b.root.setAttribute('aria-label', ok ? `${what} ${Math.round(value)} of ${Math.round(max)}` : 'unknown');
  }

  /** A bar: rounded track, smooth fill, the value inside. */
  private bar(parent: HTMLElement, r: { x: number; y: number; w: number; h: number }, kind: 'hp' | 'mp' | 'xp' | 'thp', withValue: boolean): Bar {
    const root = this.div(`bar ${kind}`, parent); this.at(root, r.x, r.y, r.w, r.h);
    root.setAttribute('role', 'meter');
    const fill = this.div('fill', root);
    const b: Bar = { root, fill, w: r.w, last: '' };
    if (withValue) { b.val = document.createElement('span'); b.val.className = 'val'; root.appendChild(b.val); }
    return b;
  }

  // ------------------------------------------------------------------ misc

  private nq: [string, string, string, string, string][] = [];
  private nBusy = false;
  /** The first time an item is found: a card with its picture, name (rarity colour) and its story, a few seconds. */
  newItem(iconUrl: string, name: string, color: string, rarity: string, lore: string): void {
    this.nq.push([iconUrl, name, color, rarity, lore]); if (!this.nBusy) this.nextNew();
  }
  private nextNew(): void {
    const n = this.nq.shift(); if (!n) { this.nBusy = false; return; }
    this.nBusy = true;
    const c = this.div('nitem gl-panel', this.root); c.style.setProperty('--rc', n[2]);
    const ic = this.div('ic', c), im = document.createElement('img'); im.src = n[0]; im.alt = ''; ic.appendChild(im);
    const tx = this.div('tx', c), cap = this.div('cap', tx); cap.textContent = 'New item'; const r = document.createElement('i'); r.textContent = n[3]; cap.appendChild(r);
    this.div('nm2', tx).textContent = n[1]; this.div('lo', tx).textContent = n[4];
    requestAnimationFrame(() => c.classList.add('on'));
    window.setTimeout(() => { c.classList.remove('on'); window.setTimeout(() => { c.remove(); this.nextNew(); }, 300); }, 5200);
  }

  /** A pickup line in the bottom-right feed (newest at the bottom, gone after a few seconds). */
  lootFeed(iconUrl: string, text: string, color: string): void {
    const f = this.els.feed; if (!f) return;
    const it = this.div('it', f); const im = document.createElement('img'); im.src = iconUrl; im.alt = ''; it.appendChild(im);
    const t = document.createElement('span'); t.textContent = text; t.style.color = color; it.appendChild(t);
    while (f.children.length > 5) f.firstElementChild!.remove();
    window.setTimeout(() => { it.style.opacity = '0'; window.setTimeout(() => it.remove(), 420); }, 2600);
  }

  /** PvP: simple centered status line (CONNECTING… / ROOM FULL); null hides it. */
  setStatus(text: string | null): void {
    if (!text) { this.status?.remove(); this.status = undefined; return; }
    if (!this.status) {
      const S = PVP.hud.status;
      this.status = document.createElement('div');
      this.status.className = 'abs panel';
      this.box(this.status, { x: S.centerX - S.w / 2, y: S.centerY - S.h / 2, w: S.w, h: S.h });
      Object.assign(this.status.style, {
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${S.size}px`,
        fontWeight: '700', letterSpacing: '2px', color: '#E8C77E', fontFamily: FONT_FAMILY,
      });
      this.root.appendChild(this.status);
    }
    this.status.textContent = text;
  }

  layout(): void {
    this.lastRect = syncOverlay(this.root, this.host, this.canvas, this.lastRect);
    const scale = this.canvas.getBoundingClientRect().width / 1920;
    this.root.classList.toggle('compact', scale < 1279 / 1920); // below 1280x720: hide optional detail
  }

  /** Hotkey caps in the tray slots' corners (Key Settings). */
  setKeyLabels(labels: string[]): void {
    this.keyEls.forEach((k, i) => {
      const t = labels[i] ?? '';
      Object.assign(k.el.style, { position: 'absolute', left: `${k.x}px`, top: `${k.y}px` });
      k.el.textContent = t; k.el.style.visibility = t ? '' : 'hidden';
    });
    this.labels = labels;
  }

  /** A window is open: 'dim' — the HUD and the world fade back under it (windows inside the HUD); 'bare' — the HUD steps
   *  aside for a big window (skill book, inventory, shop: the scene dims the world itself, their previews stay clear). */
  setModal(m: 'none' | 'dim' | 'bare'): void {
    if (this.modal === m) return;
    this.modal = m;
    this.root.classList.toggle('modal', m === 'dim');
    this.root.classList.toggle('bare', m === 'bare');
  }
  private modal: 'none' | 'dim' | 'bare' = 'none';

  /** The keys bound to the panels (Key Settings): shown on the menu pills and in the gear menu; unbound = no letter. */
  setMenuKeys(keys: Record<'K' | 'I' | 'O' | 'J' | 'P' | 'U', string>): void {
    for (const [k, el] of this.menuKeys) { const t = keys[k as 'K'] ?? ''; el.textContent = t; el.style.display = t ? '' : 'none'; }
    this.menu.setKeys(keys);
  }

  /** Battle mode: the fight's HUD takes the top of the screen; your buffs sit under your own bar (left or right side). */
  setBattle(on: boolean, side: 'l' | 'r' = 'l'): void {
    this.root.classList.toggle('battle', on);
    const fx = this.els.pFx;
    if (!on) { this.at(fx, G.buffs.x, G.buffs.y, 400, G.buffs.size); fx.style.flexDirection = ''; return; }
    this.at(fx, side === 'l' ? 142 : 1920 - 142 - 400, 130, 400, G.buffs.size);
    fx.style.flexDirection = side === 'l' ? 'row' : 'row-reverse';
  }

  /** The 1920x1080 overlay element (chat, quest tracker and other HUD parts live inside it). */
  get overlay(): HTMLElement { return this.root; }

  destroy(): void {
    this.menu.destroy();
    this.root.remove();
    this.markers.clear();
    this.cache.clear();
  }

  private panel(cls: string, r: { x: number; y: number; w: number; h: number }): HTMLDivElement {
    const p = this.div(`pn ${cls}`, this.root);
    this.box(p, r);
    this.els[cls.split(' ')[0]] = p;
    return p;
  }

  private show(el: HTMLElement, on: boolean): void { const d = on ? '' : 'none'; if (el.style.display !== d) el.style.display = d; }
  private changed(id: string, v: string): boolean { if (this.cache.get(id) === v) return false; this.cache.set(id, v); return true; }
  private text(el: HTMLElement, v: string, id: string): void { if (this.changed(id, v)) { el.textContent = v; el.title = v; } }

  private div(cls: string, parent?: HTMLElement): HTMLDivElement {
    const d = document.createElement('div');
    d.className = cls;
    parent?.appendChild(d);
    if (cls.split(' ').some((c) => ['h', 't', 'key', 'fx', 'view', 'na'].includes(c))) d.style.position = d.style.position || 'absolute';
    return d;
  }

  /** Position inside a nine-slice panel (coordinates relative to the padding box: panel border = 16px). */
  private at(e: HTMLElement, x: number, y: number, w: number, h: number): void {
    Object.assign(e.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }

  private box(e: HTMLElement, r: { x: number; y: number; w: number; h: number }): void {
    Object.assign(e.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  }
}
