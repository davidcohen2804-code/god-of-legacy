// DOM overlay for Character Creation: name and body, style (face, hair and its colour, skin), the class fan, outfit
// colours, BACK / CREATE.
import { CHARACTER_CREATE as L, CLASS_OPTIONS } from '../config/layout';
import { BEGINNER_TO, TEST_MIN_LEVEL, playedClass } from '../skills/Jobs';
import { CharacterStore } from '../characters/CharacterStore';
import { KIT_LAYOUT, ensureCharacterUIStyles, ensureSelectKitStyles, syncOverlay } from './CharacterSelectUI';
import OUTFIT_COLORS from '../data/outfit-colors.json';
import HAIR_COLORS from '../data/hair-colors.json';
import FAN from '../data/class-fan.json';
import { EYE_COLORS, LookData, lookCounts } from '../characters/LookArt';
import { DEFAULT_SKIN, SKIN_TONES } from '../characters/Skin';

/** What the new character looks like: body, face, hairstyle and its colour, skin tone, eye colour, the colour of each
 *  starter piece. */
export type CreateLook = LookData;
export const FIRST_LOOK: CreateLook = { gender: 'male', face: 0, hair: 0, hairColor: 0, skin: DEFAULT_SKIN, eyeColor: 0, top: 0, pants: 0, shoes: 0, weapon: true };
type Piece = 'top' | 'pants' | 'shoes';
const PIECES: { id: Piece; label: string }[] = [{ id: 'top', label: 'Shirt' }, { id: 'pants', label: 'Pants' }, { id: 'shoes', label: 'Boots' }];
const COLORS_OF = OUTFIT_COLORS as Record<Piece, { name: string; swatch: string }[]>;
/** Swatch rows: hair colour, skin tone and eye colour (STYLE panel), each starter piece (OUTFIT panel). */
type SwatchRow = 'hairColor' | 'skin' | 'eyeColor' | Piece;
const SWATCHES: Record<SwatchRow, { name: string; swatch: string }[]> = { hairColor: HAIR_COLORS as { name: string; swatch: string }[], skin: SKIN_TONES, eyeColor: EYE_COLORS, ...COLORS_OF };

/** The male / female signs on the BODY buttons, drawn (♂: circle and arrow; ♀: circle and cross). */
const SEX_SIGN = {
  male: '<svg viewBox="0 0 32 32"><circle cx="13" cy="19" r="7.5"/><path d="M18.5 13.5L25.5 6.5M19 6.5h6.5V13"/></svg>',
  female: '<svg viewBox="0 0 32 32"><circle cx="16" cy="11.5" r="7.5"/><path d="M16 19v10M11.5 24.5h9"/></svg>',
};
/** The class fan (tools/ui/class_fan.py): the fan, and each card's background lit up (shown while the pointer is on it). */
const FAN_DIR = 'assets/final/character_create/';
/** New characters start as the Beginner (the sword Beginner; the class itself comes later in the game). */
const STARTER = CLASS_OPTIONS[0];
/** TESTING ONLY (to be closed later — in the game the class is chosen later): click a card in the fan to create that class.
 *  Fan cards in order: warrior, book mage, archer, samurai, (coming soon). */
const TEST_PICK = true;
const FAN_CLASS = ['warrior', 'book_mage', 'archer', 'samurai'];
/** Layout (design px): the panels on the left, the class fan and the outfit on the right. */
const C = {
  // CHARACTER (left, top): name and body; its rows (design px from the panel top): NAME label, input, BODY label, buttons
  char: { x: 92, y: 150, w: 470, h: 262, rows: [62, 86, 160, 184] },
  // the class fan: centred over OUTFIT and CREATE (x 1603), in the right column above OUTFIT
  fan: { x: 1308, y: 239, w: 590 },
  create: { x: 1418, y: 884, w: 400, h: 60 },
  // STYLE (left, under CHARACTER): face and hairstyle buttons, hair colour, skin and eye colour swatches (its bottom level with
  // OUTFIT's); OUTFIT (right, under the class fan)
  look: { x: 92, y: 432, w: 470, h: 392, col: 150, icon: 52, iconGap: 14, sw: 32, swGap: 16, rows: [66, 132, 214, 266, 318] },
  outfit: { x: 1388, y: 648, w: 430, h: 214, col: 150, sw: 32, swGap: 16, rows: [60, 110, 160] },
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
.gol-cc .fan{position:absolute;pointer-events:none}
.gol-cc .fan img{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;-webkit-user-drag:none}
.gol-cc .fan .art{filter:drop-shadow(0 8px 16px rgba(0,0,0,.6))}
.gol-cc .fan .glow{opacity:0;transition:opacity 320ms ease-out}
.gol-cc .fan .glow.on{opacity:1;transition-duration:200ms}
.gol-cc .fan .hit{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:auto;cursor:pointer}
.gol-cc .fan .glow.pick{opacity:1}
.gol-cc .fan .tag{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);padding:8px 18px;border-radius:999px;background:rgba(11,18,31,.9);border:1px solid rgba(231,196,124,.4);
  color:var(--gl-gold2);font:600 13px var(--gl-body);letter-spacing:.8px;white-space:nowrap;pointer-events:none}
.gol-cc .cc-label{position:absolute;left:28px!important;font:700 11px var(--gl-body)!important;letter-spacing:1.5px!important;color:#c9ae78!important;opacity:1!important;text-transform:uppercase}
.gol-cc .cc-input{position:absolute;box-sizing:border-box;height:48px!important;padding:0 16px!important;border-radius:12px!important;border:1px solid rgba(255,255,255,.14)!important;
  background:#0a101c!important;box-shadow:none!important;font:500 17px var(--gl-body)!important;letter-spacing:.3px!important;color:#fff!important;pointer-events:auto;outline:none;
  transition:border-color 120ms,box-shadow 120ms}
.gol-cc .cc-input:focus{border-color:rgba(231,196,124,.6)!important;box-shadow:0 0 0 3px rgba(231,196,124,.14)!important}
.gol-cc .cc-input::placeholder{color:#6f7a8b!important}
.gol-cc .kopt{position:absolute;pointer-events:auto;cursor:pointer;box-sizing:border-box;padding:0 0 0 60px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);
  text-align:left;font:600 15px var(--gl-body);letter-spacing:.4px;color:var(--gl-text2);transition:background 120ms,border-color 120ms,color 120ms}
.gol-cc .kopt:hover{background:rgba(255,255,255,.06);color:var(--gl-text)}
.gol-cc .kopt.on{background:#1d2a41;border-color:rgba(231,196,124,.6);color:var(--gl-gold2);box-shadow:0 0 0 3px rgba(231,196,124,.1)}
.gol-cc .kopt .pf{position:absolute;left:14px;top:50%;width:34px;height:34px;margin-top:-17px;border-radius:50%;background:#0a1018;display:flex;align-items:center;justify-content:center}
.gol-cc .kopt .pf.sym svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.gol-cc .kopt .pf.sym.male{color:#86bdf0}
.gol-cc .kopt .pf.sym.female{color:#f3a2cb}
.gol-cc .hbtn,.gol-cc .swb{position:absolute;pointer-events:auto;cursor:pointer;border:0;padding:0;border-radius:50%;
  background:#0a1018 center/cover no-repeat;box-shadow:0 0 0 1px rgba(255,255,255,.18);transition:transform 120ms,box-shadow 120ms}
.gol-cc .hbtn{border-radius:12px}
.gol-cc .hbtn:hover,.gol-cc .swb:hover{transform:scale(1.07);box-shadow:0 0 0 1px rgba(231,196,124,.6)}
.gol-cc .hbtn.on,.gol-cc .swb.on{box-shadow:0 0 0 2px var(--gl-gold),0 0 0 5px rgba(231,196,124,.18)}
`;

export class CharacterCreateUI {
  /** Testing: the class picked in the fan (null = the Beginner). */
  private testClass: string | null = null;
  private root: HTMLDivElement;
  private input: HTMLInputElement;
  private btnCreate: HTMLButtonElement;
  private genderBtns: HTMLButtonElement[] = [];
  private gender: 'male' | 'female' = 'male';
  private icons: Record<'face' | 'hair', HTMLButtonElement[]> = { face: [], hair: [] };
  private swatches: Record<SwatchRow, HTMLButtonElement[]> = { hairColor: [], skin: [], eyeColor: [], top: [], pants: [], shoes: [] };
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

    // Character panel: name.
    const cp = this.el('div', 'abs panel info p-char', this.root);
    this.box(cp, C.char.x, C.char.y, C.char.w, C.char.h);
    const h2 = this.el('h2', '', cp); h2.textContent = 'Character';
    const R = C.char.rows;
    const lab = this.el('div', 'cc-label', cp); lab.textContent = 'Name'; lab.style.top = `${R[0]}px`;
    this.input = this.el('input', 'cc-input', cp) as HTMLInputElement;
    Object.assign(this.input, { type: 'text', placeholder: 'Your name', maxLength: L.character.input.maxLength, autocomplete: 'off', spellcheck: false });
    Object.assign(this.input.style, { top: `${R[1]}px`, left: '28px', right: '28px' });
    this.input.addEventListener('input', () => this.render());
    // Body: the clean base character, male or female — each button marked with its sign (♂ / ♀).
    const lb2 = this.el('div', 'cc-label', cp); lb2.textContent = 'Body'; lb2.style.top = `${R[2]}px`;
    const GW = Math.floor((C.char.w - 56 - 12) / 2);
    (['male', 'female'] as const).forEach((g, i) => {
      const b = this.el('button', 'kopt gd', cp) as HTMLButtonElement;
      this.el('div', `pf sym ${g}`, b).innerHTML = SEX_SIGN[g];
      b.appendChild(document.createTextNode(g === 'male' ? 'Male' : 'Female'));
      this.box(b, 28 + i * (GW + 12), R[3], GW, 52);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => this.selectGender(g));
      this.genderBtns.push(b);
    });

    // Style panel: face and hairstyle (pictures of this look's head), hair colour, skin tone and eye colour (swatches).
    const Lk = C.look;
    const lp = this.el('div', 'abs panel info p-look', this.root);
    this.box(lp, Lk.x, Lk.y, Lk.w, Lk.h);
    const h4 = this.el('h2', '', lp); h4.textContent = 'Style';
    const most = (k: 'faces' | 'styles') => Math.max(lookCounts('male')[k], lookCounts('female')[k]);
    (['face', 'hair'] as const).forEach((kind, r) => {
      const y = Lk.rows[r];
      const lb = this.el('div', 'cc-label', lp); lb.textContent = kind === 'face' ? 'Face' : 'Hair'; lb.style.top = `${y + Lk.icon / 2 - 6}px`;
      for (let k = 0; k < most(kind === 'face' ? 'faces' : 'styles'); k++) {
        const b = this.el('button', 'hbtn', lp) as HTMLButtonElement;
        this.box(b, Lk.col + k * (Lk.icon + Lk.iconGap), y, Lk.icon, Lk.icon);
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => this.setLook({ [kind]: k } as Partial<CreateLook>));
        this.icons[kind].push(b);
      }
    });
    this.swatchRow(lp, 'hairColor', 'Hair colour', Lk.col, Lk.rows[2], Lk.sw, Lk.swGap);
    this.swatchRow(lp, 'skin', 'Skin', Lk.col, Lk.rows[3], Lk.sw, Lk.swGap);
    this.swatchRow(lp, 'eyeColor', 'Eyes', Lk.col, Lk.rows[4], Lk.sw, Lk.swGap);

    // Outfit panel: the colour of each starter piece.
    const O = C.outfit;
    const op = this.el('div', 'abs panel info p-outfit', this.root);
    this.box(op, O.x, O.y, O.w, O.h);
    const h5 = this.el('h2', '', op); h5.textContent = 'Outfit';
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
      if (TEST_PICK && FAN_CLASS[i]) hit.addEventListener('click', () => { // testing: pick this class (click again = back to the Beginner)
        this.testClass = this.testClass === FAN_CLASS[i] ? null : FAN_CLASS[i];
        glows.forEach((g, k) => g.classList.toggle('pick', FAN_CLASS[k] === this.testClass));
        tag.textContent = this.testClass ? `Test · ${this.testClass === 'book_mage' ? 'Book Mage' : this.testClass[0].toUpperCase() + this.testClass.slice(1)}` : 'Test · click a class';
      });
    });
    const tag = this.el('div', 'tag', fan); tag.textContent = 'Test · click a class'; tag.style.display = TEST_PICK ? '' : 'none';

    // Buttons.
    this.button('Back', { ...KIT_LAYOUT.back, y: 884, h: 60, size: 15 }, () => this.h.onBack());
    this.btnCreate = this.button('CREATE CHARACTER', { ...C.create, size: 19 }, () => this.create(), true);

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
    const { hair, hairColor, skin, face, eyeColor, top, pants, shoes } = this.look;
    const pick = this.testClass ? CLASS_OPTIONS.find((c) => c.classId === this.testClass) ?? STARTER : STARTER;
    // a test pick plays as that class at once (other classes are the sword Beginner below the 1st job)
    const lvl = pick.classId === STARTER.classId || playedClass({ classId: pick.classId, level: 1 }) === pick.classId ? TEST_MIN_LEVEL : 19; // a test pick of another class: past the old 1st-job level, so it plays that class with its skills
    if (CharacterStore.createCharacter(id, this.input.value, pick.classId, pick.appearanceId, this.gender, { hair, hairColor, skin, face, eyeColor, top, pants, shoes }, lvl)) this.h.onCreated();
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
    const lb = this.el('div', 'cc-label', parent); lb.textContent = label; lb.style.top = `${y + size / 2 - 6}px`;
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
