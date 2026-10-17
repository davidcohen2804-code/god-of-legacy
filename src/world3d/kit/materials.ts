// The island's materials: GPT tiles when they exist (public/assets/world3d/tex/<kit>/<name>.webp, + _n), procedural
// stand-ins meanwhile (flagstones, ashlar, terracotta, slate), and the courtyard's own tiles where they fit.
import * as THREE from 'three';
import { canvasTex, noiseCanvas, normalFrom } from '../../arena3d/RoomKit';
import type { Disposable } from './units';

/** A loader bound to a kit's folder: a painted tile when the file exists, the stand-in canvas until then / otherwise. */
export class Tiles {
  readonly disposables: Disposable[] = [];
  private loader = new THREE.TextureLoader();
  constructor(private renderer: THREE.WebGLRenderer, private kit: string, private onLoaded: () => void) {}
  /** A colour tile (sRGB) with a normal map: the painted one if present, else the canvas given (and a normal made from it). */
  pair(name: string, fallback: () => HTMLCanvasElement, repeat = 1, normalStrength = 1.6): { map: THREE.Texture; normalMap: THREE.Texture } {
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const c = fallback(), map: THREE.Texture = canvasTex(c), normalMap: THREE.Texture = normalFrom(c, normalStrength, 256);
    map.anisotropy = normalMap.anisotropy = aniso; map.repeat.set(repeat, repeat); normalMap.repeat.set(repeat, repeat);
    this.disposables.push(map, normalMap);
    // the painted tile replaces the stand-in when it arrives (missing: the stand-in stays; the error is quiet)
    const url = `assets/world3d/tex/${this.kit}/${name}.webp`;
    const out = { map, normalMap };
    this.loader.load(url, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.repeat.copy(map.repeat); out.map = t; this.swap(map, t); this.disposables.push(t); this.onLoaded(); }, undefined, () => undefined);
    this.loader.load(`assets/world3d/tex/${this.kit}/${name}_n.webp`, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.repeat.copy(normalMap.repeat); out.normalMap = t; this.swap(normalMap, t); this.disposables.push(t); this.onLoaded(); }, undefined, () => undefined);
    return out;
  }
  private users = new Map<THREE.Texture, THREE.MeshStandardMaterial[]>();
  /** Materials using a stand-in: swapped to the painted tile when it lands. */
  use(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    for (const t of [m.map, m.normalMap]) if (t) { const l = this.users.get(t) ?? []; l.push(m); this.users.set(t, l); }
    this.disposables.push(m); return m;
  }
  private swap(from: THREE.Texture, to: THREE.Texture): void {
    for (const m of this.users.get(from) ?? []) { if (m.map === from) m.map = to; if (m.normalMap === from) m.normalMap = to; m.needsUpdate = true; }
  }
  dispose(): void { for (const d of this.disposables) d.dispose(); }
}

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); return c;
}

/** Warm sandstone flagstones: a mottled base, grout lines in a staggered grid, a few darker stones. */
export function flagstoneCanvas(base: [number, number, number] = [222, 190, 142], seed = 4): HTMLCanvasElement {
  const n = noiseCanvas(512, base, 0.3, seed, 10);
  return canvas(512, 512, (g) => {
    g.drawImage(n, 0, 0);
    let s = seed; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const rows = 4, cols = 4;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const off = (r % 2) * 64, x = c * 128 + off, y = r * 128;
      g.fillStyle = `rgba(${R() < 0.3 ? '90,60,40' : '255,235,200'},${0.05 + R() * 0.08})`; g.fillRect(x, y, 128, 128);
    }
    g.strokeStyle = 'rgba(70,45,30,0.55)'; g.lineWidth = 5;
    for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * 128); g.lineTo(512, r * 128); g.stroke(); }
    for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) { const off = (r % 2) * 64, x = (c * 128 + off) % 512; g.beginPath(); g.moveTo(x, r * 128); g.lineTo(x, r * 128 + 128); g.stroke(); }
    g.strokeStyle = 'rgba(255,240,210,0.25)'; g.lineWidth = 2;
    for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * 128 + 4); g.lineTo(512, r * 128 + 4); g.stroke(); }
  });
}

/** Ashlar: courses of dressed stone, staggered, with a thin dark joint and a light top edge. */
export function ashlarCanvas(base: [number, number, number] = [212, 182, 138], seed = 6): HTMLCanvasElement {
  const n = noiseCanvas(512, base, 0.28, seed, 8);
  return canvas(512, 512, (g) => {
    g.drawImage(n, 0, 0);
    let s = seed; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const ch = 512 / 5;
    for (let r = 0; r < 5; r++) {
      const off = (r % 2) * 110;
      for (let x = -110 + off; x < 512; x += 220) { g.fillStyle = `rgba(${R() < 0.5 ? '255,236,205' : '110,80,55'},${0.04 + R() * 0.07})`; g.fillRect(x, r * ch, 220, ch); }
    }
    g.strokeStyle = 'rgba(60,40,28,0.6)'; g.lineWidth = 4;
    for (let r = 0; r <= 5; r++) { g.beginPath(); g.moveTo(0, r * ch); g.lineTo(512, r * ch); g.stroke(); }
    for (let r = 0; r < 5; r++) { const off = (r % 2) * 110; for (let x = off; x < 512; x += 220) { g.beginPath(); g.moveTo(x, r * ch); g.lineTo(x, r * ch + ch); g.stroke(); } }
    g.strokeStyle = 'rgba(255,240,215,0.22)'; g.lineWidth = 2;
    for (let r = 0; r <= 5; r++) { g.beginPath(); g.moveTo(0, r * ch + 3); g.lineTo(512, r * ch + 3); g.stroke(); }
  });
}

export const terracottaCanvas = (): HTMLCanvasElement => noiseCanvas(256, [190, 108, 68], 0.3, 9, 6);
export const slateCanvas = (): HTMLCanvasElement => {
  const n = noiseCanvas(256, [96, 104, 128], 0.3, 12, 6);
  return canvas(256, 256, (g) => { g.drawImage(n, 0, 0); g.strokeStyle = 'rgba(30,30,45,0.5)'; g.lineWidth = 2; for (let y = 0; y < 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); for (let x = (y / 32) % 2 ? 24 : 0; x < 256; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } } });
};
