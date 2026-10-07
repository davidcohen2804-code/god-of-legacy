// In-game HUD (DOM overlay, 1920x1080 design pixels scaled to the displayed game rect by syncOverlay).
// Panels: player status, contextual target, 8 action slots, north-up minimap, PvP room chip,
// plus hooks (effects, combat feedback) that stay hidden until the game supplies real data.
import { FONT_FAMILY, HUD as H, PVP } from '../config/layout';
import { ensureCharacterUIStyles, syncOverlay } from './CharacterSelectUI';
import { HudEffect, HudSlot, HudState, PortraitRef } from './hud/HudState';
import { GameMenu } from './HudExtras';

const A = (f: string) => `${H.path}/${f}.png`;
const P = H.palette;
const STYLE_ID = 'gol-hud-style';

const K = (f: string) => `assets/final/ui/kit/${f}.png`;
/** Kit geometry (1920x1080 design px). Bar channels / frame insets measured on the GPT HUD sheet. */
const G = {
  portrait: { x: 20, y: 14, w: 136, h: 133, img: { x: 30, y: 30, d: 74 } },
  name: { x: 168, y: 22, w: 300 }, level: { x: 512, y: 14, w: 46, h: 52 },
  hp: { x: 148, y: 58, w: 430, h: 69, ch: { x: 37, y: 21, w: 356, h: 29 } },
  mp: { x: 148, y: 104, w: 430, h: 69, ch: { x: 37, y: 21, w: 356, h: 29 } },
  buffs: { x: 158, y: 164, size: 38, gap: 6 },
  exp: { x: 420, y: 1032, w: 1080, h: 55, ch: { x: 44, y: 21, w: 992, h: 14 } },
  tray: { x: 379, y: 936, w: 1162, h: 100, slot: 64, gap: 6, x0: 24, y0: 8 }, // 16 slots
  /** Square: minimap_square.png (382 art px, its opening 33..349) over the map window. */
  minimap: { x: 1668, y: 12, w: 232, h: 232, view: { x: 20, y: 21, w: 192, h: 192 } },
  region: { x: 1666, y: 254, w: 236, h: 67 },
  room: { x: 1350, y: 14, w: 300, h: 74 },
  target: { x: 760, y: 18, w: 400, h: 110, in: { x: 88, y: 22, w: 268 } },
  combo: { x: 1560, y: 480, w: 300, h: 97 },
  menu: { x: 1716, y: 330, w: 180, h: 50, gap: 6 },
  back: { x: 20, y: 990, w: 320, h: 74 },
} as const;

const CSS = `
.gol-hud{color:${P.text};font-family:${H.bodyFont}}
.gol-hud .pn{position:absolute;pointer-events:none}
.gol-hud .h{font-family:${FONT_FAMILY};font-weight:700;letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 1px 2px #000}
.gol-hud .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px #000}
.gol-hud .kimg{position:absolute;background:0 0/100% 100% no-repeat;pointer-events:none}
.gol-hud .pf{position:absolute;background:url("${K('portrait_frame')}") 0 0/100% 100% no-repeat;filter:drop-shadow(0 3px 6px rgba(0,0,0,.6))}
.gol-hud .pf .img{position:absolute;border-radius:50%;background-repeat:no-repeat;background-color:#0a1018}
.gol-hud .lvl{position:absolute;background:url("${K('hex_badge')}") center/100% 100% no-repeat;text-align:center;font:700 16px/52px ${FONT_FAMILY};color:#ffe2a0;text-shadow:0 1px 2px #000}
.gol-hud .bar{position:absolute;background:0 0/100% 100% no-repeat}
.gol-hud .bar .ch{position:absolute;overflow:hidden;border-radius:6px}
.gol-hud .bar .fill{position:absolute;left:0;top:0;bottom:0;overflow:hidden;transition:width ${H.barEaseMs}ms ease-out}
.gol-hud .bar .fill img{position:absolute;left:0;top:0;height:100%}
.gol-hud .bar .val{position:absolute;display:flex;align-items:center;justify-content:center;
  font-size:15px;font-weight:700;text-shadow:0 1px 2px #000,0 0 3px #000;letter-spacing:.5px}
.gol-hud .pas{position:absolute;display:flex;align-items:center;gap:6px;padding:4px 10px 4px 6px;box-sizing:border-box;width:auto!important;
  background:linear-gradient(rgba(6,10,18,.72),rgba(6,10,18,.55));border-radius:10px;box-shadow:0 3px 12px rgba(0,0,0,.4),inset 0 0 0 1px rgba(201,154,69,.35)}
.gol-hud .pas .lab{padding:0 8px 0 6px;font:700 11px ${FONT_FAMILY};letter-spacing:2px;color:#c9b48a;white-space:nowrap}
.gol-hud .pas .pi{position:relative;width:38px;height:38px;flex:none;pointer-events:auto;cursor:help;transition:transform 100ms}
.gol-hud .pas .pi:hover{transform:scale(1.12)}
.gol-hud .pas .pi img{width:100%;height:100%;display:block}
.gol-hud .pas .pi.lk img{filter:grayscale(1) brightness(.45)}
.gol-hud .pas .pi.lk:after{content:'';position:absolute;left:11px;top:7px;width:16px;height:22px;background:url("${K('lock')}") center/contain no-repeat;filter:drop-shadow(0 1px 2px #000)}
.gol-hud .bar.xp .val{justify-content:flex-start;padding-left:18px;box-sizing:border-box;font-size:12px;letter-spacing:1px;color:#fff3cf;text-shadow:0 1px 2px #000,0 0 4px #000,0 0 6px #000}
.gol-hud .tray{background:linear-gradient(rgba(6,10,18,.72),rgba(6,10,18,.55));border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.45),inset 0 0 0 1px rgba(201,154,69,.35)}
.gol-hud .aslot{position:absolute;padding:0;border:0;background:url("${K('hud_slot')}") center/128% 128% no-repeat;pointer-events:auto;cursor:pointer;
  font:inherit;color:inherit;outline:none;transition:transform 100ms}
.gol-hud .aslot:hover{transform:scale(1.06)}
.gol-hud .aslot.pressed{transform:scale(.94)}
.gol-hud .aslot.sig{background-image:url("${K('hud_slot_hover')}")}
.gol-hud .aslot:focus-visible{box-shadow:0 0 0 2px ${P.text}}
.gol-hud .aslot[aria-disabled=true]{cursor:default}
.gol-hud .aslot .ic{position:absolute;left:9px;top:9px;width:46px;height:46px;border-radius:5px}
.gol-hud .aslot.off .ic{opacity:.4;filter:grayscale(1)}
.gol-hud .aslot .cd{position:absolute;inset:7px;border-radius:6px;display:none;align-items:center;justify-content:center;
  font-size:20px;font-weight:700;text-shadow:0 1px 2px #000}
.gol-hud .aslot .ult{position:absolute;inset:-6px;background:url("${K('hud_slot_ult')}") center/100% 100% no-repeat;display:none;pointer-events:none;animation:golUlt 1.3s ease-in-out infinite}
.gol-hud .aslot.ult-ready .ult{display:block}
@keyframes golUlt{0%,100%{opacity:.7;filter:brightness(1)}50%{opacity:1;filter:brightness(1.35)}}
.gol-hud .key{position:absolute;text-align:center;font:700 12px ${FONT_FAMILY};color:#ffe2a0;text-shadow:0 1px 2px #000;background:url("${K('keycap')}") center/100% 100% no-repeat;line-height:24px}
.gol-hud .key.wide{background-image:url("${K('keycap_wide')}");font-size:10px;letter-spacing:1px}
.gol-hud .fx{position:absolute;display:flex;gap:${G.buffs.gap}px}
.gol-hud .fx .e{position:relative;background:url("${K('buff_frame')}") center/100% 100% no-repeat}
.gol-hud .fx .e img{position:absolute;left:22%;top:24%;width:56%;height:52%;border-radius:4px}
.gol-hud .fx .e.bad{background-image:url("${K('buff_frame_expiring')}")}
.gol-hud .fx .more{font-size:18px;align-self:center}
.gol-hud .mm{filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))}
.gol-hud .mm .view{position:absolute;overflow:hidden;background:#06101c;border-radius:6px}
.gol-hud .mm .frame{position:absolute;inset:0;background:url("${K('minimap_square')}") 0 0/100% 100% no-repeat;pointer-events:none;z-index:5}
.gol-hud .mm .view img.bg{position:absolute}
.gol-hud .mm .mk{position:absolute;width:${H.minimap.marker}px;height:${H.minimap.marker}px;margin:-${H.minimap.marker / 2}px 0 0 -${H.minimap.marker / 2}px}
.gol-hud .mm .na{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:${P.secondary};opacity:.7}
.gol-hud .region{position:absolute;background:url("${K('region_plaque')}") center/100% 100% no-repeat;text-align:center;font:400 14px/${G.region.h}px Georgia,serif;color:#f0d9a6;letter-spacing:.5px;text-shadow:0 1px 2px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 28px}
.gol-hud .room{background:url("${K('toast')}") 0 0/100% 100% no-repeat}
.gol-hud .target{background:url("${K('toast')}") 0 0/100% 100% no-repeat;filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))}
.gol-hud .target .tpf{position:absolute;left:20px;top:25px;width:56px;height:56px;border-radius:50%;overflow:hidden;background:#0a1018;box-shadow:0 0 0 2px #c99a45}
.gol-hud .target .tpf .img{position:absolute;inset:0;background-repeat:no-repeat}
.gol-hud .thp{position:absolute;height:12px;border-radius:6px;background:#0a1018;box-shadow:inset 0 0 0 1px #6a5630;overflow:hidden}
.gol-hud .thp .fill{position:absolute;left:0;top:0;bottom:0;overflow:hidden;transition:width ${H.barEaseMs}ms ease-out}
.gol-hud .thp .fill img{position:absolute;left:0;top:0;height:100%}
.gol-hud.compact .room .n2{display:none!important}
@media (prefers-reduced-motion:reduce){.gol-hud .bar .fill,.gol-hud .thp .fill{transition:none}}
.gol-hud .combo{position:absolute;left:${G.combo.x}px;top:${G.combo.y}px;width:${G.combo.w}px;height:${G.combo.h}px;background:url("${K('combo_plaque')}") 0 0/100% 100% no-repeat;
  pointer-events:none;transition:opacity .18s}
.gol-hud .combo .n{position:absolute;left:74px;width:152px;top:34px;height:32px;text-align:center;font-family:${FONT_FAMILY};font-weight:700;font-style:italic;font-size:30px;line-height:32px;color:#ffe2a0;
  text-shadow:0 2px 0 #3a1406,0 0 12px rgba(255,160,60,.6)}
.gol-hud .combo .n small{font-size:12px;margin-left:6px;color:#f3d9a5;letter-spacing:1px}
.gol-hud .combo .l{position:absolute;left:-40px;right:-40px;top:${G.combo.h + 2}px;text-align:center;font-size:16px;letter-spacing:2px;color:#9fe8ff;font-weight:700;font-style:italic;text-shadow:0 2px 0 #06141c}
.gol-hud .combo .pulse{position:absolute;left:-40px;top:-16px;width:380px;height:128px;mix-blend-mode:screen;opacity:0;
  background:url("assets/final/ui/hud/combo_pulse.png") 0 0/3040px 128px}
.gol-hud .combo.bump .pulse{animation:golPulse .32s steps(8) 1}
@keyframes golPulse{0%{opacity:1;background-position:0 0}100%{opacity:0;background-position:-3040px 0}}
.gol-hud .banner{position:absolute;left:560px;top:300px;width:800px;height:110px;display:none;align-items:center;justify-content:center;
  font-family:${FONT_FAMILY};font-weight:700;font-size:64px;letter-spacing:10px;color:#f0c27a;text-shadow:0 3px 0 #2a0a04,0 0 24px rgba(200,40,20,.7);
  background:radial-gradient(ellipse at center,rgba(40,6,4,.75) 0%,rgba(40,6,4,0) 70%)}
.gol-hud .banner small{display:block;font-size:22px;letter-spacing:4px;color:#e9d9b8;margin-top:4px}
.gol-hud .menu{position:absolute;left:${G.menu.x}px;top:${G.menu.y}px;width:${G.menu.w}px;display:flex;flex-direction:column;gap:${G.menu.gap}px;pointer-events:auto}
.gol-hud .menu button{height:${G.menu.h}px;border:0;background:url("${K('pill_normal')}") center/100% 100% no-repeat;color:#efddb0;font:700 12px ${FONT_FAMILY};
  letter-spacing:1px;cursor:pointer;transition:transform .12s;padding:0 22px;white-space:nowrap}
.gol-hud .menu button:hover{transform:scale(1.03);background-image:url("${K('pill_hover')}")}
.gol-hud .menu button:active{transform:scale(.985)}
.gol-hud .menu button b{color:#e8b45f;margin-right:7px}
.gol-hud .kback{position:absolute;left:${G.back.x}px;top:${G.back.y}px;width:${G.back.w}px;height:${G.back.h}px;border:0;background:url("${K('toast')}") center/100% 100% no-repeat;
  color:#efddb0;font:700 14px ${FONT_FAMILY};letter-spacing:1.2px;cursor:pointer;pointer-events:auto;padding:0 24px 0 74px;text-align:left;white-space:nowrap;transition:transform .12s}
.gol-hud .kback:hover{transform:scale(1.03);background-image:url("${K('toast_glow')}")}
.gol-hud .kback:active{transform:scale(.985)}
`;

interface Bar { root: HTMLDivElement; fill: HTMLDivElement; img: HTMLImageElement; val?: HTMLSpanElement; w: number; last: string }
interface SlotEl { btn: HTMLButtonElement; icon: HTMLImageElement; cd: HTMLDivElement; last: string; slot?: HudSlot }

export interface WorldHUDOptions {
  returnLabel: string;
  onReturn: () => void;
  /** Click on a slot: the same action handler as its hotkey (scene validates; never a second Space attack). */
  onSlot: (index: number) => void;
  /** Skill Book (K) / Inventory (I) / Cosmetic Shop (O) toggles. */
  onMenu?: (key: 'K' | 'I' | 'O' | 'P') => void;
  /** Gear menu: open the Key Settings window. */
  onKeys?: () => void;
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
  /** Current hotkey label per slot (aria / tooltips). */
  labels: string[] = [];
  private tGauge: HTMLElement[] = [];
  private markers = new Map<string, HTMLImageElement>();
  private mmPic?: HTMLImageElement;
  private mmImage = '';
  private sinceMarkers = Infinity;
  private lastNow = 0;
  private cache = new Map<string, string>();

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, private opts: WorldHUDOptions) {
    ensureCharacterUIStyles();
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement('style');
      st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
    }
    this.root = this.div('gol-cs gol-hud');
    host.appendChild(this.root);
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
      { key: 'K', label: 'SKILL BOOK', run: () => opts.onMenu?.('K') },
      { key: 'I', label: 'INVENTORY', run: () => opts.onMenu?.('I') },
      { key: 'O', label: 'COSMETIC SHOP', run: () => opts.onMenu?.('O') },
      { key: 'P', label: 'PARTY', run: () => opts.onMenu?.('P') },
      { label: 'KEY SETTINGS', run: () => opts.onKeys?.() },
      { label: opts.returnLabel, run: () => opts.onReturn() },
    ]);
    this.layout();
  }

  // ------------------------------------------------------------------ build

  private buildPlayer(): void {
    const p = this.panel('player', { x: 0, y: 0, w: 620, h: 220 });
    const pf = this.div('pf', p); this.at(pf, G.portrait.x, G.portrait.y, G.portrait.w, G.portrait.h);
    this.els.portrait = this.div('img', pf); this.at(this.els.portrait, G.portrait.img.x, G.portrait.img.y, G.portrait.img.d, G.portrait.img.d);
    const name = this.div('h', p); this.at(name, G.name.x, G.name.y, G.name.w, 32); name.style.fontSize = '24px';
    this.els.pName = name;
    const lv = this.div('lvl', p); this.at(lv, G.level.x, G.level.y, G.level.w, G.level.h);
    this.els.pLevel = lv;
    this.hp = this.bar(p, G.hp, 'hp_frame', 'hp_fill', true);
    this.res = this.bar(p, G.mp, 'mp_frame', 'mp_fill', true);
    this.res.root.style.display = 'none';
    this.els.pFx = this.div('fx', this.root); this.at(this.els.pFx, G.buffs.x, G.buffs.y, 400, G.buffs.size);
    // EXP bar along the bottom edge (fills when the progression system supplies player.exp)
    const ex = this.div('pn', this.root); this.box(ex, { x: 0, y: 0, w: 1920, h: 1080 });
    this.exp = this.bar(ex, G.exp, 'exp_frame', 'exp_fill', true);
    this.exp.root.classList.add('xp');
  }

  private buildTarget(): void {
    const t = this.panel('target', G.target);
    t.style.display = 'none';
    const pf = this.div('tpf', t);
    this.els.tIconWrap = pf;
    this.els.tIcon = this.div('img', pf);
    const I = G.target.in;
    this.els.tName = this.div('h', t); this.at(this.els.tName, I.x, I.y, I.w - 70, 24); this.els.tName.style.fontSize = '18px';
    this.els.tType = this.div('t', t); this.at(this.els.tType, I.x, I.y + 22, I.w - 70, 18); Object.assign(this.els.tType.style, { fontSize: '12px', color: P.secondary });
    const thp = this.div('thp', t); this.at(thp, I.x, I.y + 44, I.w, 12);
    const fill = this.div('fill', thp); const img = document.createElement('img'); img.alt = ''; img.src = K('hp_fill'); img.style.width = `${I.w}px`; fill.appendChild(img);
    this.thp = { root: thp, fill, img, w: I.w, last: '' };
    // Combat state chip + three combo-protection gauges (standing / air / down) under the HP bar.
    const chip = this.div('chip', t); Object.assign(chip.style, { position: 'absolute', right: '40px', top: `${I.y}px`, fontSize: '13px', fontWeight: '700', fontStyle: 'italic', letterSpacing: '1px', textShadow: '0 2px 0 #000' });
    this.els.tChip = chip;
    const gw = (I.w - 8) / 3;
    this.tGauge = (['#ff5a4a', '#5ab8ff', '#ffd25a'] as const).map((c, i) => {
      const bg = this.div('g', t); this.at(bg, I.x + i * (gw + 4), I.y + 61, gw, 5); Object.assign(bg.style, { background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.18)', borderRadius: '3px' });
      const f = this.div('gf', bg); Object.assign(f.style, { position: 'absolute', left: '0', top: '0', bottom: '0', width: '0%', background: c, boxShadow: `0 0 6px ${c}` });
      return f;
    });
    this.els.tFx = this.div('fx', this.root); this.at(this.els.tFx, G.target.x + 20, G.target.y + G.target.h + 6, G.target.w, 30);
  }

  private buildMinimap(): void {
    const m = this.panel('mm', G.minimap);
    const V = G.minimap.view;
    const view = this.div('view', m); this.at(view, V.x, V.y, V.w, V.h);
    this.div('frame', m); // the gold frame lies over the map's edges
    this.els.mmView = view;
    const label = this.div('region', this.root); this.box(label, G.region);
    this.els.mmLabel = label;
  }

  private buildRoom(): void {
    const r = this.panel('room', G.room);
    r.style.display = 'none';
    const n1 = this.div('t', r); this.at(n1, 64, 16, G.room.w - 90, 20); Object.assign(n1.style, { fontSize: '16px', fontWeight: '700', lineHeight: '20px' });
    const n2 = this.div('t n2', r); this.at(n2, 64, 38, G.room.w - 90, 20); Object.assign(n2.style, { fontSize: '14px', color: P.secondary, lineHeight: '20px' });
    this.els.roomLabel = n1; this.els.roomCount = n2;
  }

  private buildSkills(): void {
    const T = G.tray;
    const tray = this.panel('tray', T);
    H.skills.hotkeys.forEach((key, i) => {
      const x = T.x0 + i * (T.slot + T.gap), y = T.y0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aslot';
      this.at(btn, x, y, T.slot, T.slot);
      const icon = document.createElement('img'); icon.className = 'ic'; icon.alt = ''; icon.draggable = false;
      const cd = this.div('cd', btn);
      btn.insertBefore(icon, cd);
      btn.insertBefore(this.div('ult'), icon); // glowing red frame sits under the icon
      btn.addEventListener('mousedown', (e) => e.preventDefault()); // no focus steal from the game
      btn.addEventListener('keyup', (e) => { if (e.key === ' ') e.preventDefault(); }); // Phaser owns Space: block the button's own Space click (no 2nd attack)
      const el: SlotEl = { btn, icon, cd, last: '' };
      btn.addEventListener('click', () => { if (el.slot?.assigned && el.slot.enabled && !el.slot.busy) this.opts.onSlot(i); });
      tray.appendChild(btn);
      const k = this.div('key', tray);
      this.keyEls.push({ el: k, x, y: y + T.slot + 2 });
      this.slots.push(el);
    });
  }

  /** Passive skills strip above the skill tray (always-on skills; locked ones dimmed). */
  private buildPassives(): void {
    this.els.passives = this.div('pas', this.root); this.at(this.els.passives, G.tray.x + 14, G.tray.y - 54, 900, 46);
  }

  setPassives(list: { id: string; name: string; iconUrl: string; owned: boolean; info: string }[]): void {
    const box = this.els.passives;
    box.innerHTML = '';
    box.style.display = list.length ? 'flex' : 'none';
    if (!list.length) return;
    this.div('lab', box).textContent = 'PASSIVE';
    for (const p of list) {
      const e = this.div(`pi${p.owned ? '' : ' lk'}`, box);
      const img = document.createElement('img'); img.src = p.iconUrl; img.alt = ''; img.draggable = false; e.appendChild(img);
      e.title = `${p.name}${p.owned ? '' : ' (locked)'}\n${p.info}`;
    }
  }

  private buildCombat(): void {
    const c = this.panel('combat', H.combat);
    c.style.display = 'none';
    c.remove();
    const combo = this.div('combo', this.root); combo.style.display = 'none';
    const n = this.div('n', combo), l = this.div('l', combo);
    this.div('pulse', combo);
    this.els.combat = combo; this.els.cN = n; this.els.cL = l;
    const ban = this.div('banner', this.root); this.els.banner = ban;
    if (this.opts.onMenu) {
      const m = this.div('menu', this.root);
      for (const [k, label] of [['K', 'SKILL BOOK'], ['I', 'INVENTORY'], ['O', 'COSMETIC SHOP'], ['P', 'PARTY']] as const) {
        const b = document.createElement('button'); b.type = 'button';
        b.innerHTML = `<b>${k}</b>${label}`;
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
    const pl = s.player;
    this.text(this.els.pName, pl.name, 'pName');
    this.text(this.els.pLevel, String(pl.level), 'pLevel');
    this.portrait(this.els.portrait, pl.portrait, 'pPortrait', G.portrait.img.d);
    this.setBar(this.hp, pl.hp, pl.maxHp, 'HP');
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
      if (hasIcon) this.portrait(this.els.tIcon, t.portrait, 'tPortrait', 56);
      this.text(this.els.tName, t.name, 'tName');
      this.text(this.els.tType, t.type, 'tType');
      this.setBar(this.thp, t.hp, t.maxHp);
      const st = t.state ?? '';
      if (this.changed('tChip', st)) { this.els.tChip.textContent = st; this.els.tChip.style.color = st === 'AERIAL' ? '#7fd0ff' : st === 'DOWN' ? '#ffd25a' : '#ff8a6a'; }
      const g = t.gauges;
      this.tGauge.forEach((f, i) => { const v = g ? [g.stand, g.air, g.down][i] : 0; f.style.width = `${Math.min(100, v * 100)}%`; f.style.opacity = v >= 1 ? '1' : '0.75'; });
      this.effects(this.els.tFx, t.effects, 28, now, 'tFx');
    } else this.effects(this.els.tFx, [], 28, now, 'tFx');

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
        this.els.cN.innerHTML = `${f.count}<small>HITS</small>`;
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
      el.icon.src = icon;
      el.btn.setAttribute('aria-disabled', String(disabled || busy));
      el.btn.setAttribute('aria-label', `${label} (${s.hotkey})${busy ? ' — Busy' : ''}`);
      el.btn.title = busy ? `${label} — Busy` : `${label} — ${s.hotkey}`;
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
    const key = live.map((e) => `${e.id}:${e.iconUrl}:${e.harmful}`).join(',');
    if (!this.changed(id, key)) return;
    row.replaceChildren();
    row.style.display = live.length ? 'flex' : 'none';
    live.slice(0, H.buffs.max).forEach((e) => {
      const d = this.div(`e${e.harmful ? ' bad' : ''}`, row);
      Object.assign(d.style, { width: `${size}px`, height: `${size}px` });
      d.title = e.label; d.setAttribute('aria-label', e.label);
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

  /** Kit bar: ornate frame with the fill strip clipped inside its channel. */
  private bar(parent: HTMLElement, r: { x: number; y: number; w: number; h: number; ch: { x: number; y: number; w: number; h: number } }, frame: string, fillFile: string, withValue: boolean): Bar {
    const root = this.div('bar', parent); this.at(root, r.x, r.y, r.w, r.h); root.style.backgroundImage = `url("${K(frame)}")`;
    root.setAttribute('role', 'meter');
    const ch = this.div('ch', root); this.at(ch, r.ch.x, r.ch.y, r.ch.w, r.ch.h);
    const fill = this.div('fill', ch);
    const img = document.createElement('img'); img.alt = ''; img.src = K(fillFile); img.style.width = `${r.ch.w}px`; fill.appendChild(img);
    const b: Bar = { root, fill, img, w: r.ch.w, last: '' };
    if (withValue) { b.val = document.createElement('span'); b.val.className = 'val'; this.at(b.val, r.ch.x, r.ch.y, r.ch.w, r.ch.h); root.appendChild(b.val); }
    return b;
  }

  // ------------------------------------------------------------------ misc

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

  /** Hotkey caps under the tray slots (Key Settings): long names (SPACE, SHIFT…) on the wide cap. */
  setKeyLabels(labels: string[]): void {
    const T = G.tray;
    this.keyEls.forEach((k, i) => {
      const t = labels[i] ?? '', wide = t.length > 2;
      k.el.className = wide ? 'key wide' : 'key';
      this.at(k.el, wide ? k.x - 2 : k.x + 20, k.y, wide ? T.slot + 4 : 24, 24);
      k.el.textContent = t; k.el.style.visibility = t ? '' : 'hidden';
    });
    this.labels = labels;
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
    this.els[cls === 'mm' ? 'mm' : cls] = p;
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
