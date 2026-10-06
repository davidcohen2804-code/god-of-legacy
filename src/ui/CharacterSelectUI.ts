// DOM overlay for Character Select: slots, text, buttons, info panel and modal.
import { ASSET_MANIFEST, CHARACTER_PREVIEWS, CHARACTER_SELECT as L, CLASS_NAMES, COLORS, DESIGN, FONT_FAMILY } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { Character, SlotId } from '../characters/CharacterTypes';

export interface CharacterSelectHandlers {
  onBack: () => void;
  onCreate: () => void;
  onEnterWorld: () => void;
  /** Called on every render with the selected character's full-body preview asset key (or null to hide). */
  onPreview?: (assetKey: string | null) => void;
  /** Pointer over a slot: its character's class (null when leaving / empty slot). */
  onHover?: (classId: string | null) => void;
}

const DASH = '—';
const KIT = (f: string) => `assets/final/ui/kit/${f}.png`;
/** Kit layout (design px). Card zones measured on kit/char_slot.png (310x474: art 39..295 x 72..369, plaque y 378..420). */
const K = {
  plaque: { x: 580, y: 6, w: 760, h: 161 },
  card: { x: 92, y: 150, w: 230, h: 352, gx: 30, gy: 36, art: { x: 29, y: 53, w: 190, h: 221 }, plq: { y: 281, h: 31 } },
  info: { x: 1388, y: 196, w: 430, h: 280 },
  enter: { x: 1408, y: 500, w: 390, h: 150 },
  create: { x: 1428, y: 662, w: 350, h: 128 },
  back: { x: 92, y: 930, w: 280, h: 110 },
  del: { x: 404, y: 942, w: 82, h: 86 },
} as const;
const SEL_CSS = `
.gol-sel .plq{background:url("${KIT('logo_plaque')}") 0 0/100% 100% no-repeat;pointer-events:none}
.gol-sel .title{left:${K.plaque.x}px!important;width:${K.plaque.w}px!important;top:${K.plaque.y + 60}px!important;font-size:30px!important;letter-spacing:4px!important;line-height:36px}
.gol-sel .slot{background:url("${KIT('char_slot')}") 0 0/100% 100% no-repeat!important;filter:drop-shadow(0 6px 12px rgba(0,0,0,.55))}
.gol-sel .slot.empty{background-image:url("${KIT('char_slot_empty')}")!important}
.gol-sel .slot.sel{background-image:url("${KIT('char_slot_sel')}")!important;transform:translateY(-4px);filter:brightness(1.05) drop-shadow(0 0 14px rgba(255,190,90,.55))}
.gol-sel .slot:hover{filter:brightness(1.12) drop-shadow(0 6px 12px rgba(0,0,0,.55))}
.gol-sel .slot .portrait{left:${K.card.art.x}px!important;top:${K.card.art.y}px!important;width:${K.card.art.w}px!important;height:${K.card.art.h}px!important;border-radius:4px!important}
.gol-sel .slot .name{left:14px!important;right:14px;top:${K.card.plq.y}px!important;height:${K.card.plq.h}px;line-height:${K.card.plq.h}px;text-align:center;font-size:16px!important;
  color:#2a1806;text-shadow:0 1px 0 rgba(255,236,180,.6)!important;overflow:hidden;text-overflow:ellipsis}
.gol-sel .slot .sub{left:10px!important;right:10px;width:auto!important;top:${K.card.h + 2}px!important;text-align:center;font-size:13px!important;opacity:.9!important;color:#e8dcc2;text-shadow:0 1px 2px #000}
.gol-sel .slot.empty .sub{display:none}
.gol-sel .panel.info{background:url("${KIT('modal_window')}") 0 0/100% 100% no-repeat;border:0;box-shadow:none;border-radius:0;filter:drop-shadow(0 6px 14px rgba(0,0,0,.5))}
.gol-sel .info h2{top:43px!important;font-size:18px!important;letter-spacing:3px!important;line-height:20px}
.gol-sel .info .f{left:58px!important;right:52px!important;font-size:17px!important}
.gol-sel .kbtn{pointer-events:auto;cursor:pointer;padding:0 40px;text-align:center;border:0;background:url("${KIT('menu_btn')}") 0 0/100% 100% no-repeat;font-family:inherit;font-weight:700;
  letter-spacing:2px;color:#f3e2bf;text-shadow:0 2px 3px #000,0 0 8px rgba(0,0,0,.6);transition:transform 120ms,filter 120ms;white-space:nowrap}
.gol-sel .kbtn:hover:not(:disabled){background-image:url("${KIT('menu_btn_hover')}");transform:scale(1.03);color:#fff1c8}
.gol-sel .kbtn:active:not(:disabled){background-image:url("${KIT('menu_btn_pressed')}");transform:translateY(2px) scale(.985)}
.gol-sel .kbtn.primary{background-image:url("${KIT('menu_btn_hover')}");color:#ffe7a8}
.gol-sel .kbtn:disabled{cursor:default;filter:grayscale(.6) brightness(.6)}
.gol-sel .ktrash{pointer-events:auto;cursor:pointer;border:0;padding:0;background:url("${KIT('btn_trash')}") center/contain no-repeat;transition:transform 120ms}
.gol-sel .ktrash:hover:not(:disabled){background-image:url("${KIT('btn_trash_hover')}");transform:scale(1.06)}
.gol-sel .ktrash:disabled{cursor:default;filter:grayscale(.8) brightness(.55)}
.gol-sel .modal.kit{background:url("${KIT('dialog_window')}") 0 0/100% 100% no-repeat;border:0;box-shadow:none}
`;
const SEL_STYLE_ID = 'gol-charselect-kit';
/** Kit styles (plaque title, plate buttons, kit windows) shared by Character Select and Character Create. */
export function ensureSelectKitStyles(): void {
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
const previewFor = (c: Character) => CHARACTER_PREVIEWS[`${c.classId}/${c.appearanceId}`];

export class CharacterSelectUI {
  private root: HTMLDivElement;
  private slotEls = new Map<SlotId, HTMLDivElement>();
  private fields: Record<'name' | 'cls' | 'level' | 'last', HTMLSpanElement>;
  private btnEnter: HTMLButtonElement;
  private btnDelete: HTMLButtonElement;
  private btnCreate: HTMLButtonElement;
  private modal?: HTMLDivElement;
  private lastRect = '';
  private readonly onKey = (e: KeyboardEvent) => this.handleKey(e);

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, private h: CharacterSelectHandlers) {
    ensureCharacterUIStyles();
    ensureSelectKitStyles();
    this.root = this.el('div', 'gol-cs gol-sel');
    host.appendChild(this.root);

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
      this.el('div', 'name', d); this.el('div', 'sub', d); this.el('div', 'portrait', d);
      d.addEventListener('click', () => this.select(slot.slotId));
      d.addEventListener('mouseenter', () => this.h.onHover?.(CharacterStore.getSlot(slot.slotId).character?.classId ?? null));
      d.addEventListener('mouseleave', () => this.h.onHover?.(null));
      this.slotEls.set(slot.slotId, d);
    });

    // Info panel.
    const info = this.el('div', 'abs panel info', this.root);
    this.box(info, K.info.x, K.info.y, K.info.w, K.info.h);
    const h2 = this.el('h2', '', info); h2.textContent = 'CHARACTER INFO';
    const mk = (i: number, label: string) => {
      const f = this.el('div', 'f', info); f.style.top = `${92 + i * 40}px`;
      const b = this.el('b', '', f); b.textContent = `${label}: `;
      return this.el('span', '', f) as HTMLSpanElement;
    };
    this.fields = { name: mk(0, 'Name'), cls: mk(1, 'Class'), level: mk(2, 'Level'), last: mk(3, 'Last played') };

    // Buttons.
    this.button('BACK', { ...K.back, size: 22 }, () => this.h.onBack());
    this.btnDelete = this.el('button', 'abs ktrash', this.root) as HTMLButtonElement;
    this.box(this.btnDelete, K.del.x, K.del.y, K.del.w, K.del.h); this.btnDelete.title = 'Delete character';
    this.btnDelete.setAttribute('aria-label', 'Delete character');
    this.btnDelete.addEventListener('mousedown', (e) => e.preventDefault());
    this.btnDelete.addEventListener('click', () => this.openDeleteConfirm());
    this.btnEnter = this.button('ENTER WORLD', { ...K.enter, size: 26 }, () => this.enterWorld(), true);
    this.btnCreate = this.button('CREATE CHARACTER', { ...K.create, size: 18 }, () => this.h.onCreate());

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
    const bw = 220, bh = 92, by = M.h - 54 - bh / 2;
    const mkBtn = (label: string, cx: number, fn: () => void, primary = false) => {
      const b = this.el('button', `kbtn abs${primary ? ' primary' : ''}`, p) as HTMLButtonElement;
      b.textContent = label; b.style.fontSize = '20px';
      this.box(b, cx - bw / 2, by, bw, bh);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', fn);
    };
    mkBtn('DELETE', M.w / 2 - 130, () => { CharacterStore.deleteCharacter(id); this.closeModal(); this.render(); }, true);
    mkBtn('CANCEL', M.w / 2 + 130, () => this.closeModal());
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
      (d.children[0] as HTMLElement).textContent = c ? c.name : `CHARACTER SLOT ${slot.slotId}`;
      (d.children[1] as HTMLElement).textContent = c ? `${className(c.classId)} · Level ${c.level}` : 'EMPTY';
      if (!c) (d.children[0] as HTMLElement).textContent = 'EMPTY SLOT';
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
    this.fields.name.textContent = ch ? ch.name : DASH;
    this.fields.cls.textContent = ch ? className(ch.classId) : DASH;
    this.fields.level.textContent = ch ? String(ch.level) : DASH;
    this.fields.last.textContent = ch?.lastPlayedAt ? formatDate(ch.lastPlayedAt) : DASH;
    this.btnEnter.disabled = !ch;
    // CREATE CHARACTER only for a selected empty slot (never overwrites).
    this.btnCreate.disabled = !(sel && !CharacterStore.getSlot(sel).character);
    this.btnDelete.disabled = !ch;
  }

  private button(label: string, b: { x: number; y: number; w: number; h: number; size: number }, fn: () => void, primary = false) {
    const el = this.el('button', `kbtn abs${primary ? ' primary' : ''}`, this.root) as HTMLButtonElement;
    el.textContent = label;
    el.style.fontSize = `${b.size}px`;
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
