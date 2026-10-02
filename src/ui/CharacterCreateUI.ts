// DOM overlay for Character Creation: name field, fixed Warrior class panel, BACK / CREATE CHARACTER.
import { CHARACTER_CREATE as L, CLASS_NAMES, CLASS_OPTIONS } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { ensureCharacterUIStyles, syncOverlay } from './CharacterSelectUI';

export interface CharacterCreateHandlers {
  onBack: () => void;
  onCreated: () => void;
  /** Selected class changed (scene swaps the centre preview). */
  onClassChange: (classId: string, appearanceId: string) => void;
}

const STYLE_ID = 'gol-charcreate-style';
const CSS = `
.gol-cs .cc-label{position:absolute;left:34px;font-size:${L.character.labelSize}px;letter-spacing:1.5px;opacity:.8}
.gol-cs .cc-input{position:absolute;left:34px;right:34px;pointer-events:auto;box-sizing:border-box;
  height:${L.character.input.h}px;padding:0 18px;font-family:inherit;font-size:${L.character.input.size}px;letter-spacing:1px;
  color:#F3E7CF;background:rgba(5,9,14,.85);border:1.5px solid rgba(201,154,69,.75);border-radius:4px;outline:none;
  box-shadow:inset 0 0 0 3px rgba(5,9,14,.9),inset 0 0 0 4px rgba(232,199,126,.25)}
.gol-cs .cc-input::placeholder{color:rgba(243,231,207,.4)}
.gol-cs .cc-input:focus{border-color:#E8C77E;box-shadow:inset 0 0 0 3px rgba(5,9,14,.9),inset 0 0 0 4px rgba(232,199,126,.4),0 0 10px rgba(232,199,126,.35)}
.gol-cs .cc-opt{left:40px}
.gol-cs .cc-opt:not(.primary){opacity:.72}
.gol-cs .cc-opt:not(.primary):hover{opacity:1}
`;

export class CharacterCreateUI {
  private root: HTMLDivElement;
  private input: HTMLInputElement;
  private btnCreate: HTMLButtonElement;
  private classBtns: HTMLButtonElement[] = [];
  private classIdx = 0;
  private lastRect = '';
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); this.h.onBack(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.create(); }
  };

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, private h: CharacterCreateHandlers) {
    ensureCharacterUIStyles();
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement('style');
      st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
    }
    this.root = this.el('div', 'gol-cs');
    host.appendChild(this.root);

    const t = this.el('div', 'abs title', this.root);
    t.textContent = L.title.text;
    Object.assign(t.style, { top: `${L.title.top}px`, fontSize: `${L.title.size}px` });

    // Character panel: name.
    const C = L.character;
    const cp = this.el('div', 'abs panel info', this.root);
    this.box(cp, C.x, C.y, C.w, C.h);
    const h2 = this.el('h2', '', cp); h2.textContent = 'CHARACTER'; h2.style.top = `${C.headerTop}px`;
    const lab = this.el('div', 'cc-label', cp); lab.textContent = 'NAME'; lab.style.top = `${C.labelTop}px`;
    this.input = this.el('input', 'cc-input', cp) as HTMLInputElement;
    Object.assign(this.input, { type: 'text', placeholder: 'Your name', maxLength: C.input.maxLength, autocomplete: 'off', spellcheck: false });
    this.input.style.top = `${C.input.top}px`;
    this.input.addEventListener('input', () => this.render());

    // Class panel: the single fixed class.
    const K = L.classPanel;
    const kp = this.el('div', 'abs panel info', this.root);
    this.box(kp, K.x, K.y, K.w, K.h);
    const h3 = this.el('h2', '', kp); h3.textContent = 'CLASS'; h3.style.top = `${K.headerTop}px`;
    // Class choice: one button per class; the selected one uses the primary (crimson) style.
    CLASS_OPTIONS.forEach((opt, i) => {
      const b = this.el('button', 'btn abs cc-opt', kp) as HTMLButtonElement;
      this.el('span', '', b).textContent = (CLASS_NAMES[opt.classId] ?? opt.classId).toUpperCase();
      b.style.fontSize = `${K.optionSize}px`;
      this.box(b, (K.w - K.optionW) / 2, K.optionTop + i * K.optionGap, K.optionW, K.optionH);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => this.selectClass(i));
      this.classBtns.push(b);
    });

    // Buttons.
    this.button('BACK', L.buttons.back, () => this.h.onBack());
    this.btnCreate = this.button('CREATE CHARACTER', L.buttons.create, () => this.create(), true);

    window.addEventListener('keydown', this.onKey);
    this.selectClass(0);
    this.render();
    this.layout();
    this.input.focus();
  }

  layout(): void {
    this.lastRect = syncOverlay(this.root, this.host, this.canvas, this.lastRect);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }

  /** Valid only with a non-blank name and a selected EMPTY slot. */
  private canCreate(): boolean {
    const id = CharacterStore.getSelectedId();
    return !!this.input.value.trim() && !!id && !CharacterStore.getSlot(id).character;
  }

  private create(): void {
    const id = CharacterStore.getSelectedId();
    if (!id || !this.canCreate()) return;
    const opt = CLASS_OPTIONS[this.classIdx];
    if (CharacterStore.createCharacter(id, this.input.value, opt.classId, opt.appearanceId)) this.h.onCreated();
  }

  private selectClass(i: number): void {
    this.classIdx = i;
    this.classBtns.forEach((b, k) => b.classList.toggle('primary', k === i));
    const opt = CLASS_OPTIONS[i];
    this.h.onClassChange(opt.classId, opt.appearanceId);
  }

  private render(): void {
    this.btnCreate.disabled = !this.canCreate();
  }

  private button(label: string, b: { x: number; y: number; w: number; h: number; size: number }, fn: () => void, primary = false) {
    const el = this.el('button', `btn abs${primary ? ' primary' : ''}`, this.root) as HTMLButtonElement;
    this.el('span', '', el).textContent = label;
    el.style.fontSize = `${b.size}px`;
    this.box(el, b.x, b.y, b.w, b.h);
    el.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the name field
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
