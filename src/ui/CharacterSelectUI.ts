// DOM overlay for Character Select: slots, text, buttons, info panel and modal.
import { ASSET_MANIFEST, CHARACTER_SELECT as L, COLORS, DESIGN, FONT_FAMILY } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { Character, SlotId } from '../characters/CharacterTypes';

export interface CharacterSelectHandlers {
  onBack: () => void;
  onCreate: () => void;
  onEnterWorld: () => void;
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
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:${L.slots.w - L.slots.textX - 34}px;text-shadow:0 1px 3px #000}
.gol-cs .slot .sub{position:absolute;left:${L.slots.textX}px;top:72px;font-size:${L.slots.subSize}px;opacity:.75;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:${L.slots.w - L.slots.textX - 34}px}
.gol-cs .panel{background:rgba(10,18,28,.96);border:2px solid ${COLORS.goldCss};border-radius:10px;
  box-shadow:inset 0 0 0 5px rgba(10,18,28,.96),inset 0 0 0 6px rgba(201,154,69,.35),0 6px 18px rgba(0,0,0,.5)}
.gol-cs .info h2{margin:0;position:absolute;left:0;width:100%;text-align:center;font-size:${L.info.headerSize}px;
  font-weight:700;color:#E8C77E;letter-spacing:1px}
.gol-cs .info .f{position:absolute;left:${L.info.padX}px;right:24px;font-size:${L.info.fieldSize}px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.gol-cs .info .f b{font-weight:400;opacity:.75}
.gol-cs .btn{pointer-events:auto;cursor:pointer;background:#142131;border:2px solid ${COLORS.goldCss};border-radius:6px;
  color:${COLORS.text};font-family:inherit;font-weight:700;letter-spacing:1px;padding:0;
  transition:transform 120ms ease-out,background-color 120ms ease-out,filter 120ms ease-out;box-shadow:0 4px 12px rgba(0,0,0,.45)}
.gol-cs .btn:hover{background:#1d2e42;transform:scale(1.025);filter:brightness(1.12)}
.gol-cs .btn:active{transform:translateY(2px) scale(.985);filter:brightness(.92)}
.gol-cs .btn.primary{background:#6b1c21}
.gol-cs .btn.primary:hover{background:#7d242a}
.gol-cs .btn:disabled{cursor:default;opacity:.42;transform:none;filter:grayscale(.35)}
.gol-cs .btn:disabled:hover{background:#142131}
.gol-cs .btn.primary:disabled:hover{background:#6b1c21}
.gol-cs .overlay{pointer-events:auto;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,${COLORS.overlayAlpha})}
.gol-cs .modal .q{position:absolute;left:24px;right:24px;top:72px;text-align:center;font-size:${L.modal.titleSize}px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;

export class CharacterSelectUI {
  private root: HTMLDivElement;
  private slotEls = new Map<SlotId, HTMLDivElement>();
  private fields: Record<'name' | 'cls' | 'level' | 'last', HTMLSpanElement>;
  private btnEnter: HTMLButtonElement;
  private btnDelete: HTMLButtonElement;
  private modal?: HTMLDivElement;
  private lastRect = '';
  private readonly onKey = (e: KeyboardEvent) => this.handleKey(e);

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, private h: CharacterSelectHandlers) {
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement('style');
      st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
    }
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
      this.el('div', 'name', d); this.el('div', 'sub', d);
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
    this.button('CREATE CHARACTER', B.create, () => this.h.onCreate());

    window.addEventListener('keydown', this.onKey);
    this.render();
    this.layout();
  }

  /** Keep the 1920x1080 overlay locked to the canvas (call every frame; cheap). */
  layout(): void {
    const c = this.canvas.getBoundingClientRect();
    const p = this.host.getBoundingClientRect();
    const key = `${c.left - p.left},${c.top - p.top},${c.width}`;
    if (key === this.lastRect) return;
    this.lastRect = key;
    this.root.style.left = `${c.left - p.left}px`;
    this.root.style.top = `${c.top - p.top}px`;
    this.root.style.transform = `scale(${c.width / DESIGN.width})`;
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
      b.textContent = label; b.style.fontSize = '26px';
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
      (d.children[1] as HTMLElement).textContent = c ? `${c.classId} · Level ${c.level}` : 'EMPTY';
      d.classList.toggle('sel', slot.slotId === sel);
    }
    const ch: Character | null = CharacterStore.getSelectedCharacter();
    this.fields.name.textContent = ch ? ch.name : DASH;
    this.fields.cls.textContent = ch ? ch.classId : DASH;
    this.fields.level.textContent = ch ? String(ch.level) : DASH;
    this.fields.last.textContent = ch?.lastPlayedAt ? formatDate(ch.lastPlayedAt) : DASH;
    this.btnEnter.disabled = !ch;
    this.btnDelete.disabled = !ch;
  }

  private button(label: string, b: { x: number; y: number; w: number; h: number; size: number }, fn: () => void, primary = false) {
    const el = this.el('button', `btn abs${primary ? ' primary' : ''}`, this.root) as HTMLButtonElement;
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
