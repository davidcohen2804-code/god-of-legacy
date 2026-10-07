// DOM overlay for Character Creation: name and body, style (face, hair and its colour, skin), the class fan, outfit
// colours, BACK / CREATE.
import { CHARACTER_CREATE as L, CHARACTER_PREVIEWS, CLASS_OPTIONS } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { KIT_LAYOUT, ensureCharacterUIStyles, ensureSelectKitStyles, syncOverlay } from './CharacterSelectUI';
import OUTFIT_COLORS from '../data/outfit-colors.json';
import HAIR_COLORS from '../data/hair-colors.json';
import FAN from '../data/class-fan.json';
import { LookData, lookCounts } from '../characters/LookArt';
import { DEFAULT_SKIN, SKIN_TONES } from '../characters/Skin';

/** What the new character looks like: body, face, hairstyle and its colour, skin tone, the colour of each starter piece. */
export type CreateLook = LookData;
export const FIRST_LOOK: CreateLook = { gender: 'male', face: 0, hair: 0, hairColor: 0, skin: DEFAULT_SKIN, top: 0, pants: 0, shoes: 0, weapon: true };
type Piece = 'top' | 'pants' | 'shoes';
const PIECES: { id: Piece; label: string }[] = [{ id: 'top', label: 'SHIRT' }, { id: 'pants', label: 'PANTS' }, { id: 'shoes', label: 'BOOTS' }];
const COLORS_OF = OUTFIT_COLORS as Record<Piece, { name: string; swatch: string }[]>;
/** Swatch rows: hair colour and skin tone (STYLE panel), each starter piece (OUTFIT panel). */
type SwatchRow = 'hairColor' | 'skin' | Piece;
const SWATCHES: Record<SwatchRow, { name: string; swatch: string }[]> = { hairColor: HAIR_COLORS as { name: string; swatch: string }[], skin: SKIN_TONES, ...COLORS_OF };

const KIT = (f: string) => `assets/final/ui/kit/${f}.png`;
/** The class fan (tools/ui/class_fan.py): the fan, and each card's background lit up (shown while the pointer is on it). */
const FAN_DIR = 'assets/final/character_create/';
/** New characters start as the Beginner (the sword Beginner; the class itself comes later in the game). */
const STARTER = CLASS_OPTIONS[0];
/** Kit layout (design px). kit/modal_window.png: header strip at 15..22% of its height, body 25..85%. */
const C = {
  char: { x: 92, y: 196, w: 470, h: 350 },
  // the class fan: centred over OUTFIT and CREATE (x 1603), in the right column above OUTFIT
  fan: { x: 1308, y: 239, w: 590 },
  create: { x: 1438, y: 922, w: 330, h: 126 },
  // STYLE (left, under CHARACTER): face and hairstyle buttons, hair colour and skin swatches; OUTFIT (right, under the class fan)
  look: { x: 92, y: 560, w: 470, h: 360, col: 150, icon: 52, iconGap: 16, sw: 34, swGap: 20, rows: [102, 166, 232, 278] },
  outfit: { x: 1388, y: 680, w: 430, h: 236, col: 150, sw: 34, swGap: 20, rows: [72, 122, 172] },
} as const;

export interface CharacterCreateHandlers {
  onBack: () => void;
  onCreated: () => void;
  /** Male / female base character chosen (scene shows him / her). */
  onGenderChange?: (gender: 'male' | 'female') => void;
  /** Body, face, hair, skin or a piece's colour changed (scene dresses the preview, then redraws the buttons: setIcons). */
  onLookChange?: (look: CreateLook) => void;
}

const STYLE_ID = 'gol-charcreate-style';
const CSS = `
.gol-cc .info.p-char h2{top:${Math.round(C.char.h * 0.186) - 10}px!important}
.gol-cc .fan{position:absolute;pointer-events:none}
.gol-cc .fan img{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;-webkit-user-drag:none}
.gol-cc .fan .art{filter:drop-shadow(0 8px 16px rgba(0,0,0,.6))}
.gol-cc .fan .glow{opacity:0;transition:opacity 320ms ease-out}
.gol-cc .fan .glow.on{opacity:1;transition-duration:200ms}
.gol-cc .fan .hit{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:auto}
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
.gol-cc .info.p-look h2{top:${Math.round(C.look.h * 0.186) - 10}px!important}
.gol-cc .info.p-outfit h2{top:${Math.round(C.outfit.h * 0.186) - 10}px!important}
.gol-cc .hbtn,.gol-cc .swb{position:absolute;pointer-events:auto;cursor:pointer;border:0;padding:0;border-radius:50%;
  background:#0a1018 center/cover no-repeat;box-shadow:0 0 0 2px #c99a45,0 2px 6px rgba(0,0,0,.6);transition:transform 120ms,box-shadow 120ms}
.gol-cc .hbtn:hover,.gol-cc .swb:hover{transform:scale(1.08)}
.gol-cc .hbtn.on,.gol-cc .swb.on{box-shadow:0 0 0 3px #ffe2a0,0 0 12px rgba(255,200,90,.85)}
.gol-cs .cc-opt{left:40px}
.gol-cs .cc-opt:not(.primary){opacity:.72}
.gol-cs .cc-opt:not(.primary):hover{opacity:1}
`;

export class CharacterCreateUI {
  private root: HTMLDivElement;
  private input: HTMLInputElement;
  private btnCreate: HTMLButtonElement;
  private genderBtns: HTMLButtonElement[] = [];
  private gender: 'male' | 'female' = 'male';
  private icons: Record<'face' | 'hair', HTMLButtonElement[]> = { face: [], hair: [] };
  private swatches: Record<SwatchRow, HTMLButtonElement[]> = { hairColor: [], skin: [], top: [], pants: [], shoes: [] };
  private look: CreateLook = { ...FIRST_LOOK };
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

    // Style panel: face and hairstyle (pictures of this look's head), hair colour and skin tone (swatches).
    const Lk = C.look;
    const lp = this.el('div', 'abs panel info p-look', this.root);
    this.box(lp, Lk.x, Lk.y, Lk.w, Lk.h);
    const h4 = this.el('h2', '', lp); h4.textContent = 'STYLE';
    const most = (k: 'faces' | 'styles') => Math.max(lookCounts('male')[k], lookCounts('female')[k]);
    (['face', 'hair'] as const).forEach((kind, r) => {
      const y = Lk.rows[r];
      const lb = this.el('div', 'cc-label', lp); lb.textContent = kind === 'face' ? 'FACE' : 'HAIR'; lb.style.top = `${y + Lk.icon / 2 - 9}px`;
      for (let k = 0; k < most(kind === 'face' ? 'faces' : 'styles'); k++) {
        const b = this.el('button', 'hbtn', lp) as HTMLButtonElement;
        this.box(b, Lk.col + k * (Lk.icon + Lk.iconGap), y, Lk.icon, Lk.icon);
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => this.setLook({ [kind]: k } as Partial<CreateLook>));
        this.icons[kind].push(b);
      }
    });
    this.swatchRow(lp, 'hairColor', 'COLOR', Lk.col, Lk.rows[2], Lk.sw, Lk.swGap);
    this.swatchRow(lp, 'skin', 'SKIN', Lk.col, Lk.rows[3], Lk.sw, Lk.swGap);

    // Outfit panel: the colour of each starter piece.
    const O = C.outfit;
    const op = this.el('div', 'abs panel info p-outfit', this.root);
    this.box(op, O.x, O.y, O.w, O.h);
    const h5 = this.el('h2', '', op); h5.textContent = 'OUTFIT';
    PIECES.forEach((p, r) => this.swatchRow(op, p.id, p.label, O.col, O.rows[r], O.sw, O.swGap));

    // The class fan: every class in the game side by side (nothing to pick: a new character starts as the Beginner).
    // The pointer on a card lights up that card's background; its hero and the frame stay as they are.
    const Fn = C.fan;
    const fan = this.el('div', 'fan', this.root);
    this.box(fan, Fn.x, Fn.y, Fn.w, Math.round((Fn.w * FAN.h) / FAN.w));
    this.img(fan, 'art', `${FAN_DIR}class_fan.webp`);
    const glows = FAN.cards.map((_, i) => this.img(fan, 'glow', `${FAN_DIR}class_fan_glow_${i}.webp`));
    FAN.cards.forEach((outline, i) => {
      const hit = this.el('div', 'hit', fan);
      hit.style.clipPath = `polygon(${outline.map(([x, y]) => `${((x / FAN.w) * 100).toFixed(2)}% ${((y / FAN.h) * 100).toFixed(2)}%`).join(',')})`;
      hit.addEventListener('mouseenter', () => glows[i].classList.add('on'));
      hit.addEventListener('mouseleave', () => glows[i].classList.remove('on'));
      hit.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the name field
    });

    // Buttons.
    this.button('BACK', { ...KIT_LAYOUT.back, size: 22 }, () => this.h.onBack());
    this.btnCreate = this.button('CREATE CHARACTER', { ...C.create, size: 20 }, () => this.create(), true);

    window.addEventListener('keydown', this.onKey);
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
    const { hair, hairColor, skin, face, top, pants, shoes } = this.look;
    if (CharacterStore.createCharacter(id, this.input.value, STARTER.classId, STARTER.appearanceId, this.gender, { hair, hairColor, skin, face, top, pants, shoes })) this.h.onCreated();
  }

  private selectGender(g: 'male' | 'female'): void {
    this.gender = g;
    this.genderBtns.forEach((b, k) => b.classList.toggle('on', (k === 0 ? 'male' : 'female') === g));
    this.h.onGenderChange?.(g);
    const n = lookCounts(g);
    this.icons.face.forEach((b, k) => { b.style.display = k < n.faces ? '' : 'none'; });
    this.icons.hair.forEach((b, k) => { b.style.display = k < n.styles ? '' : 'none'; });
    for (const b of [...this.icons.face, ...this.icons.hair]) b.style.backgroundImage = ''; // the scene draws them for this body
    this.setLook({ gender: g, hair: Math.min(this.look.hair, Math.max(0, n.styles - 1)), face: Math.min(this.look.face, Math.max(0, n.faces - 1)),
      hairColor: Math.min(this.look.hairColor, Math.max(0, n.colors - 1)) });
  }

  /** One choice changed: buttons light up, the scene dresses the preview. */
  private setLook(p: Partial<CreateLook>): void {
    this.look = { ...this.look, ...p };
    this.icons.face.forEach((b, k) => b.classList.toggle('on', k === this.look.face));
    this.icons.hair.forEach((b, k) => b.classList.toggle('on', k === this.look.hair));
    for (const r of Object.keys(this.swatches) as SwatchRow[]) this.swatches[r].forEach((b, i) => b.classList.toggle('on', i === this.look[r]));
    this.h.onLookChange?.(this.look);
  }

  /** The face / hairstyle buttons as pictures of this look (each option on the current head; scene-drawn). */
  setIcons(icons: { face: string[]; hair: string[] }): void {
    for (const kind of ['face', 'hair'] as const) this.icons[kind].forEach((b, k) => { const u = icons[kind][k]; b.style.backgroundImage = u ? `url("${u}")` : ''; });
  }

  /** A labelled row of colour swatches (one choice of the look). */
  private swatchRow(parent: HTMLElement, row: SwatchRow, label: string, x: number, y: number, size: number, gap: number): void {
    const lb = this.el('div', 'cc-label', parent); lb.textContent = label; lb.style.top = `${y + size / 2 - 9}px`;
    SWATCHES[row].forEach((c, i) => {
      const b = this.el('button', 'swb', parent) as HTMLButtonElement;
      this.box(b, x + i * (size + gap), y, size, size);
      b.style.backgroundColor = c.swatch; b.title = c.name;
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => this.setLook({ [row]: i } as Partial<CreateLook>));
      this.swatches[row].push(b);
    });
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

  private img(parent: HTMLElement, cls: string, src: string): HTMLImageElement {
    const im = this.el('img', cls, parent) as HTMLImageElement;
    Object.assign(im, { src, alt: '', draggable: false });
    return im;
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
