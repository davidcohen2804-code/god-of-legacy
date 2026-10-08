// The cloth banners painted into the world sway gently in the wind. tools/world/banners.py cuts each one out of its
// picture with a margin of its surroundings (one atlas); here that patch lies exactly over the picture as a grid of
// triangles whose points move sideways: not at all along the patch's edges and the cloth's top, more toward the tip — so
// at rest it is the picture itself, and swaying it never shows a seam.
import Phaser from 'phaser';
import DATA from '../data/world-banners.json';
import { tileKey } from './Areas';

export const BANNERS_KEY = 'world-banners';
export const BANNERS_URL = 'assets/world/banners.webp';

interface Def { layer: string; x: number; y: number; s: number; at: [number, number, number, number]; cloth: [number, number, number, number] }
interface View { mesh: Phaser.GameObjects.Mesh; under: string; gate: boolean; x0: number; x1: number; y0: number; y1: number;
  /** Per point: rest x, how much it moves, where it sits along the cloth (0 top .. 1 tip). */ rest: Float32Array; amt: Float32Array; along: Float32Array;
  amp: number; ph: number; speed: number }

/** Grid lines across [0, n] with fixed lines at the cloth's edges (so the cloth itself moves as one, its margin eases). */
const lines = (n: number, a: number, b: number, inner: number): number[] => {
  const out = [0, a];
  for (let i = 1; i < inner; i++) out.push(a + ((b - a) * i) / inner);
  out.push(b, n);
  return out.filter((v, i, arr) => i === 0 || v > arr[i - 1] + 0.01);
};

export class WorldBanners {
  private views: View[] = [];

  constructor(private scene: Phaser.Scene, private depthOf: (layer: string) => number) {
    if (!scene.textures.exists(BANNERS_KEY)) return;
    const W = DATA.w, H = DATA.h;
    (DATA.banners as Def[]).forEach((d, n) => {
      const [ax, ay, pw, ph] = d.at, [cx0, cy0, cx1, cy1] = d.cloth, s = d.s;
      const xs = lines(pw, cx0, cx1, 3), ys = lines(ph, cy0, cy1, 10);
      const verts: number[] = [], uvs: number[] = [], idx: number[] = [], rest: number[] = [], amt: number[] = [], along: number[] = [];
      for (const py of ys) for (const px of xs) {
        verts.push(px * s, -py * s); uvs.push((ax + px) / W, (ay + py) / H);
        // sideways: 1 across the cloth, easing to 0 at the patch's sides; down: from the cloth's top to its tip, then
        // easing back to 0 at the patch's bottom
        const across = px < cx0 ? px / cx0 : px > cx1 ? (pw - px) / Math.max(1, pw - cx1) : 1;
        const t = py <= cy0 ? 0 : py <= cy1 ? (py - cy0) / (cy1 - cy0) : 1;
        const down = py <= cy1 ? Math.pow(t, 1.35) : Math.max(0, 1 - (py - cy1) / Math.max(1, ph - cy1));
        rest.push(px * s); amt.push(across * down); along.push(t);
      }
      const cols = xs.length;
      for (let r = 0; r < ys.length - 1; r++) for (let c = 0; c < cols - 1; c++) {
        const i = r * cols + c;
        idx.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
      }
      const mesh = this.scene.add.mesh(d.x, d.y, BANNERS_KEY);
      mesh.setSize(1, 1); mesh.setOrtho(1, 1); mesh.hideCCW = false; mesh.ignoreDirtyCache = true;
      mesh.addVertices(verts, uvs, idx);
      mesh.setDepth(this.depthOf(d.layer)).setVisible(false);
      const len = (cy1 - cy0) * s;
      const under = d.layer === 'strip' ? tileKey(Math.floor((d.x + 2) / 2048)) : d.layer.startsWith('heights:') ? `heights-${d.layer.slice(8)}` : 'world-gate-front';
      this.views.push({ mesh, under, gate: d.layer === 'gate', x0: d.x, x1: d.x + pw * s, y0: d.y, y1: d.y + ph * s,
        rest: Float32Array.from(rest), amt: Float32Array.from(amt), along: Float32Array.from(along),
        amp: Phaser.Math.Clamp(len * 0.045, 2, 6), ph: n * 2.17, speed: 0.0011 + ((n * 37) % 10) * 0.00006 });
    });
  }

  /** Sway the ones in view (`gateAlpha`: the temple gate's front, faded while you walk behind it). */
  update(t: number, view: Phaser.Geom.Rectangle, gateAlpha: number): void {
    for (const v of this.views) {
      const on = v.x1 > view.x - 40 && v.x0 < view.right + 40 && v.y1 > view.y - 40 && v.y0 < view.bottom + 40 && this.scene.textures.exists(v.under);
      v.mesh.setVisible(on);
      if (!on) continue;
      if (v.gate) v.mesh.setAlpha(gateAlpha);
      const w = t * v.speed + v.ph, gust = 0.75 + 0.25 * Math.sin(t * 0.00023 + v.ph * 0.6);
      const verts = v.mesh.vertices;
      for (let i = 0; i < verts.length; i++) {
        const a = v.amt[i];
        verts[i].x = a ? v.rest[i] + a * v.amp * gust * (Math.sin(w - v.along[i] * 2.2) + 0.3 * Math.sin(w * 1.9 - v.along[i] * 4 + 1)) : v.rest[i];
      }
    }
  }

  destroy(): void { for (const v of this.views) v.mesh.destroy(); this.views = []; }
}
