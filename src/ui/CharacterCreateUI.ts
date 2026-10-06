// DOM overlay for Character Creation: name field, fixed Warrior class panel, BACK / CREATE CHARACTER.
import { CHARACTER_CREATE as L, CHARACTER_PREVIEWS, CLASS_NAMES, CLASS_OPTIONS } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { KIT_LAYOUT, ensureCharacterUIStyles, ensureSelectKitStyles, syncOverlay } from './CharacterSelectUI';

const KIT = (f: string) => `assets/final/ui/kit/${f}.png`;
/** Kit layout (design px). kit/modal_window.png: header strip at 15..22% of its height, body 25..85%. */
const C = {
  char: { x: 92, y: 196, w: 470, h: 350 },
  cls: { x: 1388, y: 196, w: 430, h: 470, optTop: 126, optGap: 68, optW: 370, optH: 62 },
  create: { x: 1398, y: 690, w: 410, h: 150 },
} as const;

export interface CharacterCreateHandlers {
  onBack: () => void;
  onCreated: () => void;
  /** Selected class changed (scene swaps the centre preview). */
  onClassChange: (classId: string, appearanceId: string) => void;
  /** Male / female base character chosen (scene shows him / her). */
  onGenderChange?: (gender: 'male' | 'female') => void;
}

const STYLE_ID = 'gol-charcreate-style';
const CSS = `
.gol-cc .info.p-char h2{top:${Math.round(C.char.h * 0.186) - 10}px!important}
.gol-cc .info.p-cls h2{top:${Math.round(C.cls.h * 0.186) - 10}px!important}
.gol-cc .cc-input{background:url("${KIT('choice_btn')}") 0 0/100% 100% no-repeat!important;border:0!important;box-shadow:none!important;border-radius:0!important;
  padding:0 34px!important;font-size:20px!important;height:62px!important}
.gol-cc .cc-input:focus{background-image:url("${KIT('choice_btn_hover')}")!important}
.gol-cc .cc-label{left:44px!important;font-size:14px!important;letter-spacing:3px!important;color:#e8b25a;opacity:1!important}
.gol-cc .kopt{position:absolute;pointer-events:auto;cursor:pointer;border:0;padding:0 0 0 86px;background:url("${KIT('choice_btn')}") 0 0/100% 100% no-repeat;
  text-align:left;font-family:inherit;font-weight:700;font-size:18px;letter-spacing:2px;color:#cfd6de;text-shadow:0 1px 2px #000;transition:transform 120ms,filter 120ms}
.gol-cc .kopt:hover{filter:brightness(1.15);transform:translateX(3px)}
.gol-cc .kopt.on{background-image:url("${KIT('choice_btn_hover')}");color:#ffe7a8}
.gol-cc .kopt .pf{position:absolute;left:24px;top:7px;width:48px;height:48px;border-radius:50%;background-repeat:no-repeat;background-color:#0a1018;box-shadow:0 0 0 2px #c99a45,0 2px 6px rgba(0,0,0,.6)}
.gol-cc .kopt.on .pf{box-shadow:0 0 0 2px #ffe2a0,0 0 10px rgba(255,200,90,.7)}
.gol-cc .kopt.gd{padding:0 0 0 76px;font-size:17px}
.gol-cc .kopt.gd .pf{left:16px}
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
  private genderBtns: HTMLButtonElement[] = [];
  private gender: 'male' | 'female' = 'male';
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
    ensureSelectKitStyles();
    this.root = this.el('div', 'gol-cs gol-sel gol-cc');
    host.appendChild(this.root);

    const P = KIT_LAYOUT.plaque;
    const pq = this.el('div', 'abs plq', this.root); this.box(pq, P.x, P.y, P.w, P.h);
    const t = this.el('div', 'abs title', this.root);
    t.textContent = L.title.text;
    Object.assign(t.style, { top: `${L.title.top}px`, fontSize: `${L.title.size}px` });

    // Character panel: name.
    const cp = this.el('div', 'abs panel info p-char', this.root);
    this.box(cp, C.char.x, C.char.y, C.char.w, C.char.h);
    const h2 = this.el('h2', '', cp); h2.textContent = 'CHARACTER';
    const lab = this.el('div', 'cc-label', cp); lab.textContent = 'NAME'; lab.style.top = '96px';
    this.input = this.el('input', 'cc-input', cp) as HTMLInputElement;
    Object.assign(this.input, { type: 'text', placeholder: 'Your name', maxLength: L.character.input.maxLength, autocomplete: 'off', spellcheck: false });
    Object.assign(this.input.style, { top: '120px', left: '30px', right: '30px' });
    this.input.addEventListener('input', () => this.render());
    // Body: the clean base character, male or female.
    const lb2 = this.el('div', 'cc-label', cp); lb2.textContent = 'BODY'; lb2.style.top = '204px';
    const GW = Math.floor((C.char.w - 60 - 14) / 2);
    (['male', 'female'] as const).forEach((g, i) => {
      const b = this.el('button', 'kopt gd', cp) as HTMLButtonElement;
      const pf = this.el('div', 'pf', b);
      const pv = CHARACTER_PREVIEWS[`base/${g}`];
      if (pv) { const k = 48 / (pv.crop.w * 0.8); Object.assign(pf.style, { backgroundImage: `url("${pv.file}")`, backgroundSize: `${pv.width * k}px ${pv.height * k}px`, backgroundPosition: `${-(pv.crop.x + pv.crop.w * 0.1) * k}px ${-(pv.crop.y + 10) * k}px` }); }
      b.appendChild(document.createTextNode(g === 'male' ? 'MALE' : 'FEMALE'));
      this.box(b, 30 + i * (GW + 14), 228, GW, 62);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => this.selectGender(g));
      this.genderBtns.push(b);
    });

    // Class panel: the single fixed class.
    const K = C.cls;
    const kp = this.el('div', 'abs panel info p-cls', this.root);
    this.box(kp, K.x, K.y, K.w, K.h);
    const h3 = this.el('h2', '', kp); h3.textContent = 'CLASS';
    // Class choice: one kit plate per class with a round portrait; the selected one glows.
    CLASS_OPTIONS.forEach((opt, i) => {
      const b = this.el('button', 'kopt', kp) as HTMLButtonElement;
      const pf = this.el('div', 'pf', b);
      const pv = CHARACTER_PREVIEWS[`${opt.classId}/${opt.appearanceId}`];
      if (pv?.portrait) Object.assign(pf.style, { backgroundImage: `url("${pv.portrait}")`, backgroundSize: 'cover', backgroundPosition: 'center top' });
      else if (pv) { const k = 48 / (pv.crop.w * 0.62); Object.assign(pf.style, { backgroundImage: `url("${pv.file}")`, backgroundSize: `${pv.width * k}px ${pv.height * k}px`, backgroundPosition: `${-(pv.crop.x + pv.crop.w * 0.19) * k}px ${-pv.crop.y * k}px` }); }
      b.appendChild(document.createTextNode((CLASS_NAMES[opt.classId] ?? opt.classId).toUpperCase()));
      this.box(b, (K.w - K.optW) / 2, K.optTop + i * K.optGap, K.optW, K.optH);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => this.selectClass(i));
      this.classBtns.push(b);
    });

    // Buttons.
    this.button('BACK', { ...KIT_LAYOUT.back, size: 22 }, () => this.h.onBack());
    this.btnCreate = this.button('CREATE CHARACTER', { ...C.create, size: 20 }, () => this.create(), true);

    window.addEventListener('keydown', this.onKey);
    this.selectClass(0);
    this.selectGender('male');
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
    if (CharacterStore.createCharacter(id, this.input.value, opt.classId, opt.appearanceId, this.gender)) this.h.onCreated();
  }

  private selectGender(g: 'male' | 'female'): void {
    this.gender = g;
    this.genderBtns.forEach((b, k) => b.classList.toggle('on', (k === 0 ? 'male' : 'female') === g));
    this.h.onGenderChange?.(g);
  }

  private selectClass(i: number): void {
    this.classIdx = i;
    this.classBtns.forEach((b, k) => b.classList.toggle('on', k === i));
    const opt = CLASS_OPTIONS[i];
    this.h.onClassChange(opt.classId, opt.appearanceId);
  }

  private render(): void {
    this.btnCreate.disabled = !this.canCreate();
  }

  private button(label: string, b: { x: number; y: number; w: number; h: number; size: number }, fn: () => void, primary = false) {
    const el = this.el('button', `kbtn abs${primary ? ' primary' : ''}`, this.root) as HTMLButtonElement;
    el.textContent = label;
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
