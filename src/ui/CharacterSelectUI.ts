// DOM overlay for Character Select: slots, text, buttons, info panel and modal.
import { ASSET_MANIFEST, CHARACTER_PREVIEWS, CHARACTER_SELECT as L, CLASS_NAMES, COLORS, DESIGN, FONT_FAMILY } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { Character, SlotId } from '../characters/CharacterTypes';
import { previewKeyOf } from '../characters/Look';
import { jobsFor } from '../skills/Jobs';
import { expToNext } from '../game/Progression';
import { ICONS, ensureTheme } from './theme';

export interface CharacterSelectHandlers {
  onBack: () => void;
  onCreate: () => void;
  onEnterWorld: () => void;
  /** PvP arena with the selected character (moved here from the main menu). */
  onPvp?: () => void;
  /** Called on every render with the selected character's full-body preview asset key (or null to hide). */
  onPreview?: (assetKey: string | null) => void;
  /** Pointer over a slot: its character's class (null when leaving / empty slot). */
  onHover?: (classId: string | null) => void;
}

const DASH = '—';
/** Layout (design px): the roster (2x2 cards) on the left, the info panel and the buttons on the right, the name under the
 *  hero in the middle. */
const K = {
  plaque: { x: 580, y: 6, w: 760, h: 161 },
  card: { x: 94, y: 152, w: 228, h: 312, gx: 26, gy: 22, art: { x: 12, y: 12, w: 204, h: 232 } },
  info: { x: 1420, y: 196, w: 380, h: 284 },
  roster: { x: 66, y: 98, w: 538, h: 728 },
  stageName: { cx: 985, y: 868, w: 460 },
  enter: { x: 1420, y: 504, w: 380, h: 64 },
  pvp: { x: 1420, y: 584, w: 380, h: 52 },
  create: { x: 1420, y: 504, w: 380, h: 64 },
  back: { x: 94, y: 856, w: 200, h: 52 },
  del: { x: 306, y: 856, w: 52, h: 52 },
} as const;
const SEL_CSS = `
.gol-sel .plq{display:none}
.gol-sel .title{left:0!important;width:100%!important;top:${K.plaque.y + 40}px!important;font:700 34px/1.2 var(--gl-title)!important;letter-spacing:6px!important;color:#f4e6c2!important;
  text-shadow:0 2px 12px rgba(0,0,0,.75)!important}
.gol-sel .title::after{content:'';display:block;width:280px;height:1px;margin:14px auto 0;background:linear-gradient(90deg,rgba(231,196,124,0),rgba(244,216,150,.9),rgba(231,196,124,0))}
.gol-sel .roster{box-sizing:border-box;border-radius:20px;background:rgba(11,18,31,.82);border:1px solid rgba(231,196,124,.2);box-shadow:0 20px 50px rgba(0,0,0,.45);pointer-events:none}
.gol-sel .roster .rh{position:absolute;left:28px;right:28px;top:18px;height:24px;display:flex;justify-content:space-between;align-items:center}
.gol-sel .roster .rh span{font:700 11.5px var(--gl-body);letter-spacing:1.6px;color:#c9ae78;text-transform:uppercase}
.gol-sel .slot{border-radius:16px!important;background:#121b2d!important;border:1px solid rgba(255,255,255,.08);box-sizing:border-box;filter:none!important;transform:none!important;
  box-shadow:0 8px 20px rgba(0,0,0,.3);transition:border-color 140ms,box-shadow 140ms,transform 140ms!important}
.gol-sel .slot:hover{border-color:rgba(231,196,124,.45);transform:translateY(-3px)!important}
.gol-sel .slot.sel{border-color:var(--gl-gold);box-shadow:0 0 0 3px rgba(231,196,124,.18),0 14px 30px rgba(0,0,0,.45)}
.gol-sel .slot .portrait{left:${K.card.art.x}px!important;top:${K.card.art.y}px!important;width:${K.card.art.w}px!important;height:${K.card.art.h}px!important;border-radius:12px!important;
  background-color:#0b1220}
.gol-sel .slot .name{left:12px!important;right:12px;top:${K.card.art.y + K.card.art.h + 10}px!important;height:24px;line-height:24px;text-align:center;font:700 17px var(--gl-title)!important;
  letter-spacing:1px!important;color:#f3e3bd!important;text-shadow:none!important;overflow:hidden;text-overflow:ellipsis}
.gol-sel .slot.sel .name{color:var(--gl-gold2)!important}
.gol-sel .slot .sub{display:none}
.gol-sel .slot .chip{position:absolute;left:0;right:0;top:${K.card.art.y + K.card.art.h + 36}px;text-align:center;font:500 13px var(--gl-body);color:var(--gl-text2);pointer-events:none;white-space:nowrap}
.gol-sel .slot.empty{background:rgba(18,27,45,.6)!important;border-style:dashed;border-color:rgba(255,255,255,.14);box-shadow:none}
.gol-sel .slot.empty.sel{border-color:var(--gl-gold)}
.gol-sel .slot.empty .portrait{background:transparent!important}
.gol-sel .slot.empty .portrait::after{content:'';position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:rgba(231,196,124,.1);
  box-shadow:inset 0 0 0 1px rgba(231,196,124,.35)}
.gol-sel .slot.empty .portrait::before{content:'';position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;z-index:1;background:var(--gl-gold2);
  -webkit-mask:${ICONS.plus} center/contain no-repeat;mask:${ICONS.plus} center/contain no-repeat}
.gol-sel .slot.empty .name{color:var(--gl-text2)!important;font:600 15px var(--gl-body)!important;letter-spacing:.3px!important}
.gol-sel .slot.empty .chip{display:none}
.gol-sel .slot.empty .plus-hint{position:absolute;left:0;right:0;top:${K.card.art.y + K.card.art.h / 2 + 40}px;text-align:center;font:600 12.5px var(--gl-body);letter-spacing:.4px;color:var(--gl-gold2);opacity:0;transition:opacity 150ms;pointer-events:none}
.gol-sel .slot.empty:hover .plus-hint,.gol-sel .slot.empty.sel .plus-hint{opacity:1}
.gol-sel .slot:not(.empty) .plus-hint{display:none}
.gol-sel .panel.info{box-sizing:border-box;border-radius:18px;background:rgba(11,18,31,.9);border:1px solid rgba(231,196,124,.22);box-shadow:0 20px 50px rgba(0,0,0,.45)}
.gol-sel .info h2{top:22px!important;left:26px!important;width:auto!important;text-align:left!important;font:700 11.5px var(--gl-body)!important;letter-spacing:1.6px!important;color:#c9ae78!important;text-transform:uppercase}
.gol-sel .info .row{position:absolute;left:26px;right:26px;height:36px;display:flex;justify-content:space-between;align-items:center;gap:16px;font:500 15px var(--gl-body);border-bottom:1px solid var(--gl-line)}
.gol-sel .info .row.lv{border-bottom:0}
.gol-sel .info .row b{font-weight:500;color:var(--gl-text2)}
.gol-sel .info .row span{color:var(--gl-text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
.gol-sel .info .xpb{position:absolute;left:26px;right:26px;height:6px;border-radius:999px;background:#0a101c;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);overflow:hidden}
.gol-sel .info .xpb i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#c99a45,#f3d58c)}
.gol-sel .info .none{position:absolute;left:30px;right:30px;top:110px;text-align:center;font:500 15px/1.6 var(--gl-body);color:var(--gl-text2)}
.gol-sel .kbtn{pointer-events:auto;cursor:pointer;box-sizing:border-box;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(15,23,38,.92);font:600 15px var(--gl-body)!important;
  letter-spacing:.8px;color:var(--gl-text);white-space:nowrap;box-shadow:0 10px 24px rgba(0,0,0,.35);transition:background 120ms,border-color 120ms,filter 120ms,transform 120ms}
.gol-sel .kbtn:hover:not(:disabled){background:rgba(26,37,58,.96);border-color:rgba(231,196,124,.5)}
.gol-sel .kbtn:active:not(:disabled){transform:translateY(1px)}
.gol-sel .kbtn.primary{background:linear-gradient(180deg,#f2d493,#d2a65a);border-color:#f6dc9f;color:#24180a;font:700 19px var(--gl-title)!important;letter-spacing:2px;
  box-shadow:0 10px 30px rgba(210,166,90,.3),inset 0 1px 0 rgba(255,255,255,.35)}
.gol-sel .kbtn.primary:hover:not(:disabled){background:linear-gradient(180deg,#f6dca2,#d8ad62);filter:brightness(1.04)}
.gol-sel .kbtn:disabled{cursor:default;opacity:.45}
.gol-sel .ktrash{pointer-events:auto;cursor:pointer;box-sizing:border-box;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(15,23,38,.92);color:var(--gl-text2);
  display:grid;place-items:center;box-shadow:0 10px 24px rgba(0,0,0,.35);transition:background 120ms,border-color 120ms,color 120ms}
.gol-sel .ktrash::before{content:'';width:20px;height:20px;background:currentColor;-webkit-mask:${ICONS.trash} center/contain no-repeat;mask:${ICONS.trash} center/contain no-repeat}
.gol-sel .ktrash:hover:not(:disabled){color:#ffb1a5;border-color:rgba(239,127,111,.6);background:rgba(60,22,24,.9)}
.gol-sel .ktrash:disabled{cursor:default;opacity:.4}
.gol-sel .stagename{position:absolute;text-align:center;pointer-events:none}
.gol-sel .stagename .n{font:700 30px var(--gl-title);letter-spacing:2px;color:#f6e8c6;text-shadow:0 2px 10px rgba(0,0,0,.85)}
.gol-sel .stagename .j{margin-top:4px;font:600 14px var(--gl-body);letter-spacing:1.2px;color:#e9dcbb;text-shadow:0 1px 6px rgba(0,0,0,.9)}
.gol-sel .hint{position:absolute;left:0;right:0;bottom:22px;text-align:center;font:500 13.5px var(--gl-body);letter-spacing:.3px;color:rgba(238,232,218,.78);text-shadow:0 1px 4px rgba(0,0,0,.85);pointer-events:none}
.gol-sel .vign{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.5) 0%,rgba(0,0,0,0) 34%,rgba(0,0,0,0) 66%,rgba(0,0,0,.5) 100%)}
.gol-sel .modal.kit{box-sizing:border-box;border-radius:18px;background:linear-gradient(180deg,#152035,#0f1828);border:1px solid rgba(231,196,124,.28);box-shadow:0 30px 80px rgba(0,0,0,.6)}
.gol-sel .modal .q{top:58px!important;font:700 22px var(--gl-title)!important;letter-spacing:1.5px;color:#f3e3bd}
.gol-sel .modal .qs{position:absolute;left:30px;right:30px;top:100px;text-align:center;font:500 14.5px var(--gl-body);color:var(--gl-text2)}
.gol-sel .modal .kbtn{font-size:15px!important}
.gol-sel .modal .kbtn.primary.danger{background:linear-gradient(180deg,#f08a7b,#c8524a);border-color:#f6a59a;color:#2a0b08;font:700 15px var(--gl-body)!important;letter-spacing:.8px;box-shadow:0 10px 24px rgba(200,82,74,.3)}
`;
const SEL_STYLE_ID = 'gol-charselect-kit';
/** Kit styles (plaque title, plate buttons, kit windows) shared by Character Select and Character Create. */
export function ensureSelectKitStyles(): void {
  ensureTheme();
  if (document.getElementById(SEL_STYLE_ID)) return;
  const st = document.createElement('style'); st.id = SEL_STYLE_ID; st.textContent = SEL_CSS; document.head.appendChild(st);
}
export const KIT_LAYOUT = K;
const STYLE_ID = 'gol-charselect-style';

const CSS = `
.gol-cs{position:absolute;left:0;top:0;width:${DESIGN.width}px;height:${DESIGN.height}px;transform-origin:0 0;
  pointer-events:none;font-family:${FONT_FAMILY};color:${COLORS.text};user-select:none;-webkit-user-select:none}
.gol-cs *{box-sizing:border-box}
.gol-cs .abs{position:absolute}
.gol-cs .title{left:0;width:100%;text-align:center;font-weight:700;letter-spacing:2px;color:#F3E2BF;
  text-shadow:0 2px 6px rgba(0,0,0,.75)}
.gol-cs .slot{pointer-events:auto;cursor:pointer;background-size:100% 100%;
  transition:transform ${L.slots.duration}ms ease-out,filter ${L.slots.duration}ms ease-out}
.gol-cs .slot:hover{filter:brightness(${L.slots.hoverBrightness})}
.gol-cs .slot.sel{transform:scale(${L.slots.selectedScale});
  filter:brightness(${L.slots.selectedBrightness}) drop-shadow(0 0 10px rgba(255,180,90,.55))}
.gol-cs .slot:active,.gol-cs .slot.sel:active{transform:scale(${L.slots.pressedScale})}
.gol-cs .slot .name{position:absolute;left:${L.slots.textX}px;top:30px;font-size:${L.slots.nameSize}px;font-weight:700;
  white-space:nowrap;letter-spacing:.5px;text-shadow:0 1px 3px #000}
.gol-cs .slot .portrait{position:absolute;left:${L.slots.portrait.x}px;top:${L.slots.portrait.y}px;
  width:${L.slots.portrait.size}px;height:${L.slots.portrait.size}px;border-radius:6px;background-repeat:no-repeat}
.gol-cs .slot .sub{position:absolute;left:${L.slots.textX}px;top:72px;font-size:${L.slots.subSize}px;opacity:.75;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:${L.slots.w - L.slots.textX - 34}px}
.gol-cs .panel{background:rgba(10,18,28,.96);border:2px solid ${COLORS.goldCss};border-radius:10px;
  box-shadow:inset 0 0 0 5px rgba(10,18,28,.96),inset 0 0 0 6px rgba(201,154,69,.35),0 6px 18px rgba(0,0,0,.5)}
.gol-cs .info h2{margin:0;position:absolute;left:0;width:100%;text-align:center;font-size:${L.info.headerSize}px;
  font-weight:700;color:#E8C77E;letter-spacing:1px}
.gol-cs .info .f{position:absolute;left:${L.info.padX}px;right:24px;font-size:${L.info.fieldSize}px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.gol-cs .info .f b{font-weight:400;opacity:.75}
.gol-cs .btn{pointer-events:auto;cursor:pointer;padding:0;border:2px solid ${COLORS.goldCss};border-radius:4px;
  font-family:inherit;font-weight:700;letter-spacing:1.5px;overflow:visible;
  background:radial-gradient(ellipse at 50% -10%,rgba(232,199,126,.20),transparent 62%),
    linear-gradient(180deg,#1d1a1e 0%,#0e0c10 55%,#16121a 100%);
  box-shadow:inset 0 0 0 1px #3d2c12,inset 0 0 0 4px rgba(14,12,16,.95),inset 0 0 0 5px rgba(232,199,126,.42),
    0 0 0 1px #24190a,0 6px 16px rgba(0,0,0,.6);
  transition:transform 120ms ease-out,filter 120ms ease-out}
.gol-cs .btn span{background:linear-gradient(180deg,#fff2cc 0%,#e8c77e 48%,#b07c2c 100%);-webkit-background-clip:text;
  background-clip:text;color:transparent;filter:drop-shadow(0 2px 1px rgba(0,0,0,.9))}
.gol-cs .btn::before,.gol-cs .btn::after{content:'';position:absolute;left:50%;width:11px;height:11px;margin-left:-7.5px;
  transform:rotate(45deg);border:2px solid ${COLORS.goldCss};background:radial-gradient(circle at 35% 35%,#ff6a4a,#8e1414 60%,#3a0606);
  box-shadow:0 0 6px rgba(255,90,60,.45)}
.gol-cs .btn::before{top:-9px}
.gol-cs .btn::after{bottom:-9px}
.gol-cs .btn.primary::after{display:none} /* ENTER WORLD sits 14px above CREATE CHARACTER: avoid touching gems */
.gol-cs .btn.primary{background:radial-gradient(ellipse at 50% 0%,rgba(255,120,80,.28),transparent 65%),
    linear-gradient(180deg,#8a1d1d 0%,#4b0d10 58%,#6a1616 100%);
  box-shadow:inset 0 0 0 1px #3d2c12,inset 0 0 0 4px rgba(60,10,12,.9),inset 0 0 0 5px rgba(232,199,126,.5),
    inset 0 0 18px rgba(255,90,60,.25),0 0 0 1px #24190a,0 6px 16px rgba(0,0,0,.6)}
.gol-cs .btn:hover{transform:scale(1.025);filter:brightness(1.12) drop-shadow(0 0 8px rgba(255,180,90,.45))}
.gol-cs .btn:active{transform:translateY(2px) scale(.985);filter:brightness(.92)}
.gol-cs .btn:disabled{cursor:default;opacity:.55;transform:none;filter:grayscale(.55) brightness(.7)}
.gol-cs .overlay{pointer-events:auto;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,${COLORS.overlayAlpha})}
.gol-cs .modal .q{position:absolute;left:24px;right:24px;top:72px;text-align:center;font-size:${L.modal.titleSize}px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;

/** Shared by the Character Select and Character Create overlays. */
export function ensureCharacterUIStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
}

/** Locks a 1920x1080 DOM overlay to the canvas; returns the new cache key. */
export function syncOverlay(root: HTMLElement, host: HTMLElement, canvas: HTMLCanvasElement, prevKey: string): string {
  const c = canvas.getBoundingClientRect();
  const p = host.getBoundingClientRect();
  const key = `${c.left - p.left},${c.top - p.top},${c.width}`;
  if (key === prevKey) return key;
  root.style.left = `${c.left - p.left}px`;
  root.style.top = `${c.top - p.top}px`;
  root.style.transform = `scale(${c.width / DESIGN.width})`;
  return key;
}

const className = (id: string) => CLASS_NAMES[id] ?? id;
const previewFor = (c: Character) => CHARACTER_PREVIEWS[previewKeyOf(c)];

export class CharacterSelectUI {
  private root: HTMLDivElement;
  private slotEls = new Map<SlotId, HTMLDivElement>();
  private fields: Record<'name' | 'cls' | 'level' | 'last', HTMLSpanElement>;
  private btnEnter: HTMLButtonElement;
  private btnDelete: HTMLButtonElement;
  private btnCreate: HTMLButtonElement;
  private btnPvp?: HTMLButtonElement;
  private rosterCount!: HTMLElement;
  private jobField!: HTMLSpanElement;
  private xpBar!: HTMLDivElement;
  private noneMsg!: HTMLDivElement;
  private infoRows: HTMLElement[] = [];
  private stage!: HTMLDivElement;
  private modal?: HTMLDivElement;
  private lastRect = '';
  private readonly onKey = (e: KeyboardEvent) => this.handleKey(e);

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, private h: CharacterSelectHandlers) {
    ensureCharacterUIStyles();
    ensureSelectKitStyles();
    this.root = this.el('div', 'gol-cs gol-sel');
    host.appendChild(this.root);

    this.el('div', 'vign', this.root);
    const ro = this.el('div', 'abs roster', this.root); this.box(ro, K.roster.x, K.roster.y, K.roster.w, K.roster.h);
    const rh = this.el('div', 'rh', ro); this.el('span', '', rh).textContent = 'Characters'; this.rosterCount = this.el('i', 'gl-badge', rh);
    const pq = this.el('div', 'abs plq', this.root); this.box(pq, K.plaque.x, K.plaque.y, K.plaque.w, K.plaque.h);
    const t = this.el('div', 'abs title', this.root);
    t.textContent = L.title.text;
    Object.assign(t.style, { top: `${L.title.top}px`, fontSize: `${L.title.size}px` });

    // Slots (one reusable frame image).
    const S = L.slots;
    CharacterStore.getSlots().forEach((slot, i) => {
      const d = this.el('div', 'abs slot', this.root);
      const C = K.card;
      this.box(d, C.x + (i % 2) * (C.w + C.gx), C.y + Math.floor(i / 2) * (C.h + C.gy), C.w, C.h);
      this.el('div', 'name', d); this.el('div', 'sub', d); this.el('div', 'portrait', d); this.el('div', 'chip', d); this.el('div', 'plus-hint', d).textContent = 'Create a new hero';
      d.addEventListener('click', () => this.select(slot.slotId));
      d.addEventListener('dblclick', () => { const c = CharacterStore.getSlot(slot.slotId).character; if (c) this.enterWorld(); else this.h.onCreate(); });
      d.addEventListener('mouseenter', () => this.h.onHover?.(CharacterStore.getSlot(slot.slotId).character?.classId ?? null));
      d.addEventListener('mouseleave', () => this.h.onHover?.(null));
      this.slotEls.set(slot.slotId, d);
    });

    // Info panel.
    const info = this.el('div', 'abs panel info', this.root);
    this.box(info, K.info.x, K.info.y, K.info.w, K.info.h);
    const h2 = this.el('h2', '', info); h2.textContent = 'Character';
    const mk = (i: number, label: string) => {
      const f = this.el('div', 'row', info); f.style.top = `${[52, 88, 124, 178, 214][i]}px`;
      this.el('b', '', f).textContent = label;
      return this.el('span', '', f) as HTMLSpanElement;
    };
    this.fields = { name: mk(0, 'Name'), cls: mk(1, 'Class'), level: mk(2, 'Level'), last: mk(4, 'Last played') };
    this.jobField = mk(3, 'Job');
    info.querySelectorAll('.row')[2]?.classList.add('lv');
    this.xpBar = this.el('div', 'xpb', info); this.xpBar.style.top = '162px'; this.el('i', '', this.xpBar);
    this.noneMsg = this.el('div', 'none', info);
    this.infoRows = [...info.querySelectorAll<HTMLElement>('.row')];
    // name + job under the character on the stage
    this.stage = this.el('div', 'stagename', this.root); this.box(this.stage, K.stageName.cx - K.stageName.w / 2, K.stageName.y, K.stageName.w, 70);
    this.el('div', 'n', this.stage); this.el('div', 'j', this.stage);
    this.el('div', 'hint', this.root).textContent = 'Double-click a character to play  ·  Enter: enter the world  ·  Arrow keys: choose';

    // Buttons.
    this.button('Back', { ...K.back, size: 15 }, () => this.h.onBack());
    this.btnDelete = this.el('button', 'abs ktrash', this.root) as HTMLButtonElement;
    this.box(this.btnDelete, K.del.x, K.del.y, K.del.w, K.del.h); this.btnDelete.title = 'Delete character';
    this.btnDelete.setAttribute('aria-label', 'Delete character');
    this.btnDelete.addEventListener('mousedown', (e) => e.preventDefault());
    this.btnDelete.addEventListener('click', () => this.openDeleteConfirm());
    this.btnEnter = this.button('ENTER WORLD', { ...K.enter, size: 19 }, () => this.enterWorld(), true);
    if (this.h.onPvp) this.btnPvp = this.button('PvP Arena', { ...K.pvp, size: 15 }, () => { if (CharacterStore.getSelectedCharacter()) this.h.onPvp?.(); });
    this.btnCreate = this.button('CREATE CHARACTER', { ...K.create, size: 19 }, () => this.h.onCreate(), true);

    window.addEventListener('keydown', this.onKey);
    this.render();
    this.layout();
  }

  /** Keep the 1920x1080 overlay locked to the canvas (call every frame; cheap). */
  layout(): void {
    this.lastRect = syncOverlay(this.root, this.host, this.canvas, this.lastRect);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }

  // ---------- behavior ----------

  private select(id: SlotId): void {
    CharacterStore.select(id);
    this.render();
  }

  private enterWorld(): void {
    if (CharacterStore.getSelectedCharacter()) this.h.onEnterWorld();
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.modal) {
      if (e.key === 'Escape') { e.preventDefault(); this.closeModal(); }
      return;
    }
    const ids = CharacterStore.getSlots().map((s) => s.slotId);
    const cur = CharacterStore.getSelectedId();
    const idx = cur ? ids.indexOf(cur) : -1;
    switch (e.key) {
      case 'Escape': e.preventDefault(); this.h.onBack(); break;
      case 'ArrowDown': e.preventDefault(); this.select(ids[Math.min(ids.length - 1, idx + 2)]); break;
      case 'ArrowUp': e.preventDefault(); this.select(ids[Math.max(0, idx - 2)]); break;
      case 'ArrowRight': e.preventDefault(); this.select(ids[Math.min(ids.length - 1, idx + 1)]); break;
      case 'ArrowLeft': e.preventDefault(); this.select(ids[Math.max(0, idx - 1)]); break;
      case 'Enter': e.preventDefault(); this.enterWorld(); break;
    }
  }

  private openDeleteConfirm(): void {
    const id = CharacterStore.getSelectedId();
    const ch = CharacterStore.getSelectedCharacter();
    if (!id || !ch || this.modal) return;
    const M = L.modal;
    const m = this.el('div', 'abs overlay', this.root);
    const p = this.el('div', 'abs panel modal kit', m);
    this.box(p, (DESIGN.width - M.w) / 2, (DESIGN.height - M.h) / 2, M.w, M.h);
    const q = this.el('div', 'q', p); q.textContent = `Delete ${ch.name}?`;
    this.el('div', 'qs', p).textContent = 'This character and everything it carries will be gone for good.';
    const bw = 200, bh = 50, by = M.h - 34 - bh;
    const mkBtn = (label: string, cx: number, fn: () => void, cls = '') => {
      const b = this.el('button', `kbtn abs ${cls}`, p) as HTMLButtonElement;
      b.textContent = label;
      this.box(b, cx - bw / 2, by, bw, bh);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', fn);
    };
    mkBtn('Cancel', M.w / 2 - 110, () => this.closeModal());
    mkBtn('Delete', M.w / 2 + 110, () => { CharacterStore.deleteCharacter(id); this.closeModal(); this.render(); }, 'primary danger');
    this.modal = m;
  }

  private closeModal(): void {
    this.modal?.remove();
    this.modal = undefined;
  }

  // ---------- rendering ----------

  private render(): void {
    const sel = CharacterStore.getSelectedId();
    for (const slot of CharacterStore.getSlots()) {
      const d = this.slotEls.get(slot.slotId)!;
      const c = slot.character;
      (d.children[0] as HTMLElement).textContent = c ? c.name : `Character slot ${slot.slotId}`;
      (d.children[1] as HTMLElement).textContent = '';
      (d.children[3] as HTMLElement).textContent = c ? `${className(c.classId)} · Lv ${c.level}` : '';
      if (!c) (d.children[0] as HTMLElement).textContent = 'Empty slot';
      d.classList.toggle('sel', slot.slotId === sel);
      d.classList.toggle('empty', !c);
      // Face/upper-body crop of the same full-body preview (display-only; empty slots stay blank).
      const pv = c ? previewFor(c) : undefined;
      const po = d.children[2] as HTMLElement;
      if (pv?.portrait) {
        // Dedicated portrait file (face/shoulders), scaled to the frame.
        Object.assign(po.style, { backgroundImage: `url("${pv.portrait}")`, backgroundSize: 'cover', backgroundPosition: 'center top' });
      } else if (pv) {
        const k = K.card.art.w / pv.crop.w;
        Object.assign(po.style, {
          backgroundImage: `url("${pv.file}")`,
          backgroundSize: `${pv.width * k}px ${pv.height * k}px`,
          backgroundPosition: `${-pv.crop.x * k}px ${-pv.crop.y * k}px`,
        });
      } else po.style.backgroundImage = '';
    }
    const ch: Character | null = CharacterStore.getSelectedCharacter();
    this.h.onPreview?.(ch ? previewFor(ch)?.key ?? null : null);
    const job = ch ? (jobsFor(ch.level < 19 ? 'warrior' : ch.classId).filter((j) => ch.level >= j.level).pop()?.name ?? 'Beginner') : DASH;
    this.fields.name.textContent = ch ? ch.name : DASH;
    this.fields.cls.textContent = ch ? className(ch.classId) : DASH;
    const need = ch ? expToNext(ch.level) : 0, pct = ch && Number.isFinite(need) ? Math.min(100, ((ch.exp ?? 0) / need) * 100) : 0;
    this.fields.level.textContent = ch ? `${ch.level}  ·  ${pct.toFixed(1)}% EXP` : DASH;
    this.jobField.textContent = job;
    this.fields.last.textContent = ch?.lastPlayedAt ? formatDate(ch.lastPlayedAt) : 'Never';
    (this.xpBar.firstChild as HTMLElement).style.width = `${pct}%`;
    for (const r of this.infoRows) r.style.display = ch ? 'flex' : 'none';
    this.xpBar.style.display = ch ? 'block' : 'none';
    this.noneMsg.style.display = ch ? 'none' : 'block';
    this.noneMsg.textContent = sel && !CharacterStore.getSlot(sel).character ? 'This slot is empty.\nCreate a new hero to begin your legacy.' : 'Select a character.';
    this.noneMsg.style.whiteSpace = 'pre-line';
    const used = CharacterStore.getSlots().filter((x) => x.character).length;
    this.rosterCount.textContent = `${used} / ${CharacterStore.getSlots().length}`;
    const emptySel = !!sel && !CharacterStore.getSlot(sel).character;
    (this.stage.children[0] as HTMLElement).textContent = ch ? ch.name : emptySel ? 'NEW HERO' : '';
    (this.stage.children[1] as HTMLElement).textContent = ch ? `${className(ch.classId)}  ·  ${job}  ·  Lv ${ch.level}` : emptySel ? 'Press Create Character to begin' : '';
    // Context buttons: a character → ENTER WORLD + PVP ARENA; an empty slot → CREATE CHARACTER in the same place.
    const empty = !!sel && !CharacterStore.getSlot(sel).character;
    this.btnEnter.style.display = empty ? 'none' : '';
    if (this.btnPvp) this.btnPvp.style.display = empty ? 'none' : '';
    this.btnCreate.style.display = empty ? '' : 'none';
    this.btnEnter.disabled = !ch;
    if (this.btnPvp) this.btnPvp.disabled = !ch;
    this.btnCreate.disabled = !empty;
    this.btnDelete.disabled = !ch;
  }

  private button(label: string, b: { x: number; y: number; w: number; h: number; size: number }, fn: () => void, primary = false) {
    const el = this.el('button', `kbtn abs${primary ? ' primary' : ''}`, this.root) as HTMLButtonElement;
    el.textContent = label;
    this.box(el, b.x, b.y, b.w, b.h);
    el.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus off buttons (keyboard handled globally)
    el.addEventListener('click', fn);
    return el;
  }

  private el<T extends HTMLElement = HTMLDivElement>(tag: string, cls: string, parent?: HTMLElement): T {
    const e = document.createElement(tag) as T;
    if (cls) e.className = cls;
    parent?.appendChild(e);
    return e;
  }

  private box(e: HTMLElement, x: number, y: number, w: number, h: number): void {
    Object.assign(e.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
