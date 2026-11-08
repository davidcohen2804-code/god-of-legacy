// THE CHIBI PAPER DOLL (David 8 Nov: clothes easy to change and remove, a character creation, a cash shop). Every frame
// is exported (tools/chibi/archer/src/doll_R.py → assets/chibi/<cls>/<cls>.doll.json) as an ordered list of layers —
// the base body's parts and each item's parts, already moved where that frame puts them — and '@' slots where the head's
// drawings go (tools/chibi/archer/src/looks_R.py: the hair styles, the eyes, the hats, the face accessories — one drawing
// each, laid at the head's place in every frame). A look (the items worn, their colours, the skin, the hair and its
// colour, the eyes, a hat, a face accessory) is composed here once into a texture: the worn layers and the drawings
// stacked in order, then every bare edge closed with an outline inside the frame's reference silhouette (the frame with
// every original item on — so with the original look the result IS the approved frame). Nothing is recomposed per game
// frame.
import Phaser from 'phaser';

interface Layer { key: string; item: string; x: number; y: number; w: number; h: number; px: Uint8Array }
interface Mask { x: number; y: number; w: number; h: number; m: Uint8Array }
interface Frame { layers: (Layer | string)[]; ref: Mask; T: number[]; shut: boolean }
/** A drawing in the master's pixels (its own letters; its own colours over the palette's). */
interface Art { x: number; y: number; w: number; h: number; px: Uint8Array; letters: string[]; pal: Record<string, string>; cut?: Mask; shut?: Art }
interface RawArt { x: number; y: number; rle: string; pal?: Record<string, string>; cut?: RawArt; shut?: RawArt }
export interface DollAnim { frames: number[]; ms: number[]; loop: boolean }
/** The looks' catalogue (looks_R.export_json): names and colour maps, in the order GPT gave them. */
export interface DollCatalog {
  hairStyles: [string, string][]; hairColours: [string, string, Record<string, string>][]; eyes: [string, string][];
  skins: [string, string, Record<string, string>][]; outfits: [string, string, string[], Record<string, Record<string, string>>][];
  bows: [string, string, Record<string, string>][];
  shop: Record<string, [string, string, ShopDef][]>; archer: string[];
}
export interface ShopDef { att?: string; wear?: string[]; unwear?: string[]; maps?: Record<string, Record<string, string>>; cut?: string }
export interface DollData {
  frame: number; origin: [number, number]; height: number; facing: 'right' | 'left'; pal: Record<string, string>;
  anims: Record<string, DollAnim>; frames: unknown[];
  looks?: { hair: Record<string, RawArt>; eyes: Record<string, RawArt>; att: Record<string, RawArt>; cuts: Record<string, RawArt>;
    hairLetters: string; skinLetters: string; catalog: DollCatalog };
}
interface Doll { data: DollData; letters: string[]; idx: Record<string, number>; frames: Frame[];
  hair: Record<string, Art>; eyes: Record<string, Art>; att: Record<string, Art>; cuts: Record<string, Mask> }

/** A look as the compositor takes it. maps: per item ('base', 'tunic', 'boots', 'cape', 'hood', 'bow'…) letter → colour. */
export interface Look {
  wear: string[];
  maps?: Record<string, Record<string, string>>;
  skin?: Record<string, string>;            // S, s → colour (every layer and drawing)
  hair?: string; hairMap?: Record<string, string>;   // the hair style; J, H, h, b → colour (the hair, the hood's hair pixels)
  eyes?: string; hat?: string; face?: string;
  cut?: string;                              // the hair hidden under headgear ('hood'); a hat drawing hides its own
  nobow?: boolean;                           // (an item's picture in the shop: the bow left out)
}

const dolls = new Map<string, Doll>();

function decodeRows(rle: string, val: (ch: string) => number): { w: number; h: number; px: Uint8Array } {
  const rows = rle.split('/');
  const out: number[][] = [];
  let w = 0;
  for (const r of rows) {
    const row: number[] = [];
    for (let i = 0; i < r.length;) {
      let n = 0;
      while (r.charCodeAt(i) >= 48 && r.charCodeAt(i) <= 57) { n = n * 10 + (r.charCodeAt(i) - 48); i++; }
      const v = val(r[i++]);
      for (let k = 0; k < (n || 1); k++) row.push(v);
    }
    w = Math.max(w, row.length); out.push(row);
  }
  const px = new Uint8Array(w * out.length);
  out.forEach((row, y) => row.forEach((v, x) => { px[y * w + x] = v; }));
  return { w, h: out.length, px };
}
const decode = (rle: string, idx: Record<string, number>) => decodeRows(rle, (ch) => (ch === '.' ? 0 : idx[ch] ?? 0));
const decodeMask = (rle: string) => decodeRows(rle, (ch) => (ch === '#' ? 1 : 0));

function art(r: RawArt): Art {
  const letters = ['.'];
  const p = decodeRows(r.rle, (ch) => { if (ch === '.') return 0; let i = letters.indexOf(ch); if (i < 0) { i = letters.length; letters.push(ch); } return i; });
  const a: Art = { x: r.x, y: r.y, w: p.w, h: p.h, px: p.px, letters, pal: r.pal ?? {} };
  if (r.cut) { const m = decodeMask(r.cut.rle); a.cut = { x: r.cut.x, y: r.cut.y, w: m.w, h: m.h, m: m.px }; }
  if (r.shut) a.shut = art(r.shut);
  return a;
}

export function parseDoll(cls: string, data: DollData): Doll {
  let d = dolls.get(cls);
  if (d) return d;
  const letters = ['.', ...Object.keys(data.pal)];
  const idx: Record<string, number> = {};
  letters.forEach((l, i) => { idx[l] = i; });
  const frames = (data.frames as { L: unknown[][]; ref: [number, number, string]; head: [number, number]; T?: number[]; shut?: number }[]).map((f) => ({
    layers: f.L.map((l) => {
      if (l.length === 1) return l[0] as string;
      const key = l[0] as string, x = l[1] as number, y = l[2] as number, p = decode(l[3] as string, idx);
      return { key, item: key.split('.')[0], x, y, w: p.w, h: p.h, px: p.px };
    }),
    ref: (() => { const p = decodeMask(f.ref[2]); return { x: f.ref[0], y: f.ref[1], w: p.w, h: p.h, m: p.px }; })(),
    T: f.T ?? [1, 0, 0, 0, 1, 0], shut: !!f.shut,
  }));
  const L = data.looks;
  const map = <T>(o: Record<string, RawArt> | undefined, fn: (r: RawArt) => T) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, fn(v)]));
  d = { data, letters, idx, frames,
    hair: map(L?.hair, art), eyes: map(L?.eyes, art), att: map(L?.att, art),
    cuts: map(L?.cuts, (r) => { const m = decodeMask(r.rle); return { x: r.x, y: r.y, w: m.w, h: m.h, m: m.px }; }) };
  dolls.set(cls, d);
  return d;
}

const hexRGB = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const inMask = (m: Mask | undefined, x: number, y: number) => !!m && x >= m.x && y >= m.y && x < m.x + m.w && y < m.y + m.h && m.m[(y - m.y) * m.w + x - m.x] === 1;

/** Composes one look into a canvas texture (frames named `<anim>_<i>`, as the static atlas did); returns its anims. */
export function composeLook(scene: Phaser.Scene, cls: string, doll: Doll, look: Look, key: string, only?: string[]): Record<string, { frames: string[]; ms: number[]; loop: boolean }> {
  const F = doll.data.frame, COLS = 12;
  const wear = new Set(look.wear);
  const SKIN = doll.data.looks?.skinLetters ?? 'Ss', HAIR = doll.data.looks?.hairLetters ?? 'JHhb';
  // the colours: the palette's, then each look's own (a table of RGB, outline or not)
  const rgb: [number, number, number][] = [[0, 0, 0]], isO: boolean[] = [false], seen = new Map<string, number>();
  const colour = (hex: string, o: boolean): number => {
    const k = hex.toLowerCase() + (o ? '!' : '');
    let i = seen.get(k);
    if (i === undefined) { i = rgb.length; rgb.push(hexRGB(hex)); isO.push(o); seen.set(k, i); }
    return i;
  };
  const resolve = (l: string, item: string | null, pal?: Record<string, string>, hairy = false): number => {
    if (l === '.') return 0;
    const hex = (item ? look.maps?.[item]?.[l] : undefined) ?? pal?.[l]
      ?? (SKIN.includes(l) ? look.skin?.[l] : undefined) ?? (hairy && HAIR.includes(l) ? look.hairMap?.[l] : undefined)
      ?? doll.data.pal[l] ?? '#ff00ff';
    return colour(hex, l === 'O');
  };
  const luts = new Map<string, Uint16Array>();
  const lutItem = (item: string) => {
    let t = luts.get(item);
    if (!t) { t = Uint16Array.from(doll.letters, (l) => resolve(l, item, undefined, item === 'hood')); luts.set(item, t); }
    return t;
  };
  const lutArt = (a: Art, hairy: boolean) => Uint16Array.from(a.letters, (l) => resolve(l, null, a.pal, hairy));
  const hair = doll.hair[look.hair ?? 'wind'] ?? doll.hair.wind, eyes = doll.eyes[look.eyes ?? 'calm'] ?? doll.eyes.calm;
  const hat = look.hat ? doll.att[look.hat] : undefined, face = look.face ? doll.att[look.face] : undefined;
  const cuts = [look.cut ? doll.cuts[look.cut] : undefined, hat?.cut].filter((c): c is Mask => !!c);
  const L = { hair: hair && lutArt(hair, true), eyes: eyes && lutArt(eyes, false), shut: eyes?.shut && lutArt(eyes.shut, false),
    hat: hat && lutArt(hat, false), face: face && lutArt(face, false) };

  const frameIdx = only ? [...new Set(only.flatMap((n) => doll.data.anims[n]?.frames ?? []))] : doll.frames.map((_, i) => i);
  const N = frameIdx.length, rows = Math.ceil(N / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * F; canvas.height = rows * F;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const buf = new Uint16Array(F * F);
  const O = colour(doll.data.pal.O, true);
  const draw = (a: Art | undefined, lut: Uint16Array | undefined, T: number[], cut = false) => {
    if (!a || !lut) return;
    for (let j = 0; j < a.h; j++) for (let i = 0; i < a.w; i++) {
      const v = a.px[j * a.w + i]; if (!v) continue;
      const mx = a.x + i, my = a.y + j;
      if (cut && cuts.some((c) => inMask(c, mx, my))) continue;
      const X = T[0] * mx + T[1] * my + T[2], Y = T[3] * mx + T[4] * my + T[5];
      if (X >= 0 && Y >= 0 && X < F && Y < F) buf[Y * F + X] = lut[v];
    }
  };
  const slot = new Map<number, number>();                                   // frame index → its cell in the texture
  frameIdx.forEach((n, cell) => {
    slot.set(n, cell);
    const fr = doll.frames[n];
    buf.fill(0);
    for (const l of fr.layers) {
      if (typeof l === 'string') {
        if (l === '@hair') draw(hair, L.hair, fr.T, true);
        else if (l === '@eyes') { if (fr.shut && eyes?.shut) draw(eyes.shut, L.shut, fr.T); else draw(eyes, L.eyes, fr.T); }
        else if (l === '@face') draw(face, L.face, fr.T);
        else if (l === '@hat') draw(hat, L.hat, fr.T);
        continue;
      }
      if (l.item !== 'base' && l.item !== 'bow' && !wear.has(l.item)) continue;
      if (l.item === 'bow' && look.nobow) continue;
      const lut = lutItem(l.item);
      for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
        const v = l.px[y * l.w + x];
        if (v) buf[(l.y + y) * F + l.x + x] = lut[v];
      }
    }
    const r = fr.ref, add: number[] = [];                                     // bare edges closed inside the reference
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if (!r.m[y * r.w + x]) continue;
      const X = r.x + x, Y = r.y + y, p = Y * F + X;
      if (buf[p]) continue;
      const nb = [X > 0 ? buf[p - 1] : 0, X < F - 1 ? buf[p + 1] : 0, Y > 0 ? buf[p - F] : 0, Y < F - 1 ? buf[p + F] : 0];
      if (nb.some((v) => v && !isO[v])) add.push(p);
    }
    for (const p of add) buf[p] = O;
    const cx = (cell % COLS) * F, cy = Math.floor(cell / COLS) * F;
    for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) {
      const v = buf[y * F + x]; if (!v) continue;
      const o = ((cy + y) * canvas.width + cx + x) * 4, c = rgb[v];
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
  });
  ctx.putImageData(img, 0, 0);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas)!;
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  const anims: Record<string, { frames: string[]; ms: number[]; loop: boolean }> = {};
  for (const [name, a] of Object.entries(doll.data.anims)) {
    if (only && !only.includes(name)) continue;
    anims[name] = { frames: a.frames.map((i, k) => { const nm = `${name}_${k}`, c = slot.get(i)!; tex.add(nm, 0, (c % COLS) * F, Math.floor(c / COLS) * F, F, F); return nm; }), ms: a.ms, loop: a.loop };
  }
  return anims;
}
