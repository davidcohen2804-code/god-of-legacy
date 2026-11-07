// THE CHIBI PAPER DOLL (David 8 Nov: clothes easy to change and remove, a character creation, a cash shop). Every frame
// is exported (tools/chibi/archer/src/doll_R.py → assets/chibi/<cls>/<cls>.doll.json) as an ordered list of layers —
// the base body's parts and each item's parts, already moved where that frame puts them. A look (the items worn, the
// skin and hair colours) is composed here once into a texture: the worn layers stacked in order, then every bare edge
// closed with an outline inside the frame's reference silhouette (the frame with every original item on — so with
// everything worn the result IS the approved frame). Nothing is recomposed per game frame.
import Phaser from 'phaser';

interface Layer { key: string; item: string; x: number; y: number; w: number; h: number; px: Uint8Array }
interface Frame { layers: (Layer | string)[]; ref: { x: number; y: number; w: number; h: number; m: Uint8Array }; head: [number, number] }
export interface DollAnim { frames: number[]; ms: number[]; loop: boolean }
export interface DollData { frame: number; origin: [number, number]; height: number; facing: 'right' | 'left'; pal: Record<string, string>; anims: Record<string, DollAnim>; frames: unknown[] }
interface Doll { data: DollData; letters: string[]; idx: Record<string, number>; frames: Frame[] }

/** A look: the items worn (layer keys' items: 'hood', 'tunic', …) and colour swaps (letter → letter of the palette). */
export interface Look { wear: string[]; skin?: Record<string, string>; hair?: Record<string, string> }

const dolls = new Map<string, Doll>();

function decode(rle: string, idx: Record<string, number>, mask = false): { w: number; h: number; px: Uint8Array } {
  const rows = rle.split('/');
  const out: number[][] = [];
  let w = 0;
  for (const r of rows) {
    const row: number[] = [];
    for (let i = 0; i < r.length;) {
      let n = 0;
      while (r.charCodeAt(i) >= 48 && r.charCodeAt(i) <= 57) { n = n * 10 + (r.charCodeAt(i) - 48); i++; }
      const ch = r[i++];
      const v = mask ? (ch === '#' ? 1 : 0) : ch === '.' ? 0 : idx[ch] ?? 0;
      for (let k = 0; k < (n || 1); k++) row.push(v);
    }
    w = Math.max(w, row.length); out.push(row);
  }
  const px = new Uint8Array(w * out.length);
  out.forEach((row, y) => row.forEach((v, x) => { px[y * w + x] = v; }));
  return { w, h: out.length, px };
}

export function parseDoll(cls: string, data: DollData): Doll {
  let d = dolls.get(cls);
  if (d) return d;
  const letters = ['.', ...Object.keys(data.pal)];
  const idx: Record<string, number> = {};
  letters.forEach((l, i) => { idx[l] = i; });
  const frames = (data.frames as { L: unknown[][]; ref: [number, number, string]; head: [number, number] }[]).map((f) => ({
    layers: f.L.map((l) => {
      if (l.length === 1) return l[0] as string;
      const key = l[0] as string, x = l[1] as number, y = l[2] as number, p = decode(l[3] as string, idx);
      return { key, item: key.split('.')[0], x, y, w: p.w, h: p.h, px: p.px };
    }),
    ref: (() => { const p = decode(f.ref[2], idx, true); return { x: f.ref[0], y: f.ref[1], w: p.w, h: p.h, m: p.px }; })(),
    head: f.head,
  }));
  d = { data, letters, idx, frames };
  dolls.set(cls, d);
  return d;
}

const hexRGB = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Composes one look into a canvas texture (frames named `<anim>_<i>`, as the static atlas did); returns its anims. */
export function composeLook(scene: Phaser.Scene, cls: string, doll: Doll, look: Look, key: string): Record<string, { frames: string[]; ms: number[]; loop: boolean }> {
  const F = doll.data.frame, N = doll.frames.length, COLS = 12, rows = Math.ceil(N / COLS);
  const wear = new Set(look.wear);
  const rgb = doll.letters.map((l) => (l === '.' ? [0, 0, 0] : hexRGB(doll.data.pal[l])) as [number, number, number]);
  const swap = (m?: Record<string, string>) => doll.letters.map((l, i) => (m && m[l] && doll.idx[m[l]] !== undefined ? doll.idx[m[l]] : i));
  const skinMap = swap(look.skin), hairMap = swap(look.hair);
  const O = doll.idx.O;
  const canvas = document.createElement('canvas');
  canvas.width = COLS * F; canvas.height = rows * F;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const buf = new Uint8Array(F * F);
  doll.frames.forEach((fr, n) => {
    buf.fill(0);
    for (const l of fr.layers) {
      if (typeof l === 'string') continue;                                   // (head slots: attachments come later)
      if (l.item !== 'base' && l.item !== 'bow' && !wear.has(l.item)) continue;
      const map = l.item === 'hair' ? hairMap : skinMap;
      for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) {
        const v = l.px[y * l.w + x];
        if (v) buf[(l.y + y) * F + l.x + x] = map[v];
      }
    }
    const r = fr.ref, add: number[] = [];                                     // bare edges closed inside the reference
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if (!r.m[y * r.w + x]) continue;
      const X = r.x + x, Y = r.y + y, p = Y * F + X;
      if (buf[p]) continue;
      const nb = [X > 0 ? buf[p - 1] : 0, X < F - 1 ? buf[p + 1] : 0, Y > 0 ? buf[p - F] : 0, Y < F - 1 ? buf[p + F] : 0];
      if (nb.some((v) => v && v !== O)) add.push(p);
    }
    for (const p of add) buf[p] = O;
    const cx = (n % COLS) * F, cy = Math.floor(n / COLS) * F;
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
    anims[name] = { frames: a.frames.map((i, k) => { const nm = `${name}_${k}`; tex.add(nm, 0, (i % COLS) * F, Math.floor(i / COLS) * F, F, F); return nm; }), ms: a.ms, loop: a.loop };
  }
  return anims;
}
