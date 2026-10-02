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
}

const DASH = '—';
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
    this.root = this.el('div', 'gol-cs');
    host.appendChild(this.root);

    const t = this.el('div', 'abs title', this.root);
    t.textContent = L.title.text;
    Object.assign(t.style, { top: `${L.title.top}px`, fontSize: `${L.title.size}px` });

    // Slots (one reusable frame image).
    const S = L.slots;
    CharacterStore.getSlots().forEach((slot, i) => {
      const d = this.el('div', 'abs slot', this.root);
      this.box(d, S.x, S.firstY + i * S.step, S.w, S.h);
      d.style.backgroundImage = `url("${ASSET_MANIFEST['characterSelect.slotFrame']}")`;
      this.el('div', 'name', d); this.el('div', 'sub', d); this.el('div', 'portrait', d);
      d.addEventListener('click', () => this.select(slot.slotId));
      this.slotEls.set(slot.slotId, d);
    });

    // Info panel.
    const I = L.info;
    const info = this.el('div', 'abs panel info', this.root);
    this.box(info, I.x, I.y, I.w, I.h);
    const h2 = this.el('h2', '', info); h2.textContent = 'CHARACTER INFO'; h2.style.top = `${I.headerTop}px`;
    const mk = (i: number, label: string) => {
      const f = this.el('div', 'f', info); f.style.top = `${I.fieldsTop + i * I.fieldStep}px`;
      const b = this.el('b', '', f); b.textContent = `${label}: `;
      return this.el('span', '', f) as HTMLSpanElement;
    };
    this.fields = { name: mk(0, 'Name'), cls: mk(1, 'Class'), level: mk(2, 'Level'), last: mk(3, 'Last played') };

    // Buttons.
    const B = L.buttons;
    this.button('BACK', B.back, () => this.h.onBack());
    this.btnDelete = this.button('DELETE', B.delete, () => this.openDeleteConfirm());
    this.btnEnter = this.button('ENTER WORLD', B.enter, () => this.enterWorld(), true);
    this.btnCreate = this.button('CREATE CHARACTER', B.create, () => this.h.onCreate());

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
      case 'ArrowDown': e.preventDefault(); this.select(ids[Math.min(ids.length - 1, idx + 1)]); break;
      case 'ArrowUp': e.preventDefault(); this.select(ids[Math.max(0, idx - 1)]); break;
      case 'Enter': e.preventDefault(); this.enterWorld(); break;
    }
  }

  private openDeleteConfirm(): void {
    const id = CharacterStore.getSelectedId();
    const ch = CharacterStore.getSelectedCharacter();
    if (!id || !ch || this.modal) return;
    const M = L.modal;
    const m = this.el('div', 'abs overlay', this.root);
    const p = this.el('div', 'abs panel modal', m);
    this.box(p, (DESIGN.width - M.w) / 2, (DESIGN.height - M.h) / 2, M.w, M.h);
    const q = this.el('div', 'q', p); q.textContent = `Delete ${ch.name}?`;
    const bw = 200, bh = 56, by = M.h - 70 - bh / 2;
    const mkBtn = (label: string, cx: number, fn: () => void, primary = false) => {
      const b = this.el('button', `btn abs${primary ? ' primary' : ''}`, p) as HTMLButtonElement;
      this.el('span', '', b).textContent = label; b.style.fontSize = '26px';
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
      d.classList.toggle('sel', slot.slotId === sel);
      // Face/upper-body crop of the same full-body preview (display-only; empty slots stay blank).
      const pv = c ? previewFor(c) : undefined;
      const po = d.children[2] as HTMLElement;
      if (pv?.portrait) {
        // Dedicated portrait file (face/shoulders), scaled to the frame.
        Object.assign(po.style, { backgroundImage: `url("${pv.portrait}")`, backgroundSize: 'cover', backgroundPosition: 'center top' });
      } else if (pv) {
        const k = L.slots.portrait.size / pv.crop.w;
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
    const el = this.el('button', `btn abs${primary ? ' primary' : ''}`, this.root) as HTMLButtonElement;
    this.el('span', '', el).textContent = label;
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
