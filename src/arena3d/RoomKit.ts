// PVP 3D: the room's modelling kit — geometry helpers (boxes with world-scaled UVs, tapered tubes for branches, lathes),
// a merge-by-material builder (one draw per material for the whole temple), and the procedural textures the room falls
// back to until its painted ones load (or when they are missing).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** A small seeded random (the same room every load). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Planar UVs from the geometry's own (room) coordinates, by each vertex's dominant normal axis: a texture keeps one
 *  size over every piece, whatever its shape (call after the piece is placed). */
export function worldUV(g: THREE.BufferGeometry, tile = 1, rot = false): THREE.BufferGeometry {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
    if (rot) [u, v] = [v, u];
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
  return g;
}

/** A box (w × h × d) whose bottom centre sits at (x, y, z), bevelled when asked, world UVs. */
export function box(w: number, h: number, d: number, x: number, y: number, z: number, tile = 1, bevel = 0): THREE.BufferGeometry {
  const g = bevel > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w / 2.2, h / 2.2, d / 2.2)) : new THREE.BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return worldUV(g, tile);
}

/** A cylinder standing on (x, y, z): its UVs wrap round it (u: tile per `tile` units of the circumference). */
export function cyl(r0: number, r1: number, h: number, x: number, y: number, z: number, seg = 16, tile = 1): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1);
  const uv = g.attributes.uv as THREE.BufferAttribute, C = Math.PI * 2 * Math.max(r0, r1);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * C / tile, uv.getY(i) * h / tile);
  g.translate(x, y + h / 2, z);
  return g;
}

/** A lathe from a (radius, height) profile, standing on (x, y, z). */
export function lathe(profile: [number, number][], x: number, y: number, z: number, seg = 16, tile = 1): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h)), seg);
  const uv = g.attributes.uv as THREE.BufferAttribute; let len = 0;
  for (let i = 1; i < profile.length; i++) len += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]);
  const C = Math.PI * 2 * Math.max(...profile.map((p) => p[0]));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * C / tile, uv.getY(i) * len / tile);
  g.translate(x, y, z);
  return g;
}

/** A tube along a curve, its radius running from r0 to r1 (a branch), UVs: u round it, v along it. */
export function taperTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, segs = 8, radial = 7, tile = 0.6): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segs, false), len = curve.getLength();
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; curve.getPointAt(t, P);
    const r = r0 + (r1 - r0) * Math.pow(t, 0.85), Nn = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      N.set(c * Nn.x + s * B.x, c * Nn.y + s * B.y, c * Nn.z + s * B.z).normalize();
      pos.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r); nor.push(N.x, N.y, N.z);
      uv.push((j / radial) * Math.PI * 2 * Math.max(r, 0.05) / tile, (t * len) / tile);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1); // (wound outward: the faces' normals agree with the vertex normals — the Maps chat found it inside-out: limbs drawn by their dark inner wall)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

/** Collects the pieces of the room by material and merges them: one mesh (one draw) per material. */
export class Parts {
  private by = new Map<string, THREE.BufferGeometry[]>();
  add(key: string, ...gs: THREE.BufferGeometry[]): void { const l = this.by.get(key) ?? []; for (const g of gs) l.push(g); this.by.set(key, l); }
  /** Copies of `g` moved to each of the places (a row of posts, lanterns). */
  addAt(key: string, g: THREE.BufferGeometry, at: [number, number, number][], rotY: number[] = []): void {
    at.forEach(([x, y, z], i) => { const c = g.clone(); if (rotY[i]) c.rotateY(rotY[i]); c.translate(x, y, z); this.add(key, c); });
  }
  build(mats: Record<string, THREE.Material>, target: THREE.Object3D, shadows = true): Map<string, THREE.Mesh> {
    const out = new Map<string, THREE.Mesh>();
    for (const [k, list] of this.by) {
      const m = mats[k]; if (!m || !list.length) continue;
      const geo = mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(a)) n.deleteAttribute(a); return n; }), false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, m); mesh.castShadow = shadows; mesh.receiveShadow = true; mesh.name = k;
      target.add(mesh); out.set(k, mesh);
    }
    for (const list of this.by.values()) for (const g of list) g.dispose();
    this.by.clear();
    return out;
  }
}

// ------------------------------------------------------------------ procedural textures (fallbacks and small details)

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); return c;
}

/** A texture from a canvas (sRGB colour, repeating). */
export function canvasTex(c: HTMLCanvasElement, colour = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (colour) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** Value noise in a canvas (a mottled base colour): `base` the colour, `amp` how much it varies. */
export function noiseCanvas(size: number, base: [number, number, number], amp: number, seed = 1, scale = 8): HTMLCanvasElement {
  const r = rng(seed), N = scale, grid: number[] = []; for (let i = 0; i < N * N; i++) grid.push(r());
  const at = (x: number, y: number) => grid[((y % N) + N) % N * N + ((x % N) + N) % N];
  return canvas(size, size, (g) => {
    const im = g.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let v = 0, f = 1, a = 0.5;
      for (let o = 0; o < 4; o++) { const fx = (x / size) * N * f, fy = (y / size) * N * f, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const n = (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy; v += n * a; a *= 0.5; f *= 2; }
      const k = 1 + (v - 0.5) * amp, i = (y * size + x) * 4;
      im.data[i] = Math.min(255, base[0] * k); im.data[i + 1] = Math.min(255, base[1] * k); im.data[i + 2] = Math.min(255, base[2] * k); im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
}

/** A tangent-space normal map from a colour texture's brightness (Sobel): the painted relief catches the room's light. */
export function normalFrom(src: CanvasImageSource & { width: number; height: number }, strength = 2, size = 512): THREE.CanvasTexture {
  const c = canvas(size, size, (g) => g.drawImage(src as CanvasImageSource, 0, 0, size, size));
  const g = c.getContext('2d')!, d = g.getImageData(0, 0, size, size).data, out = g.createImageData(size, size), L = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const at = (x: number, y: number) => L[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * size + x) * 4; out.data[i] = (nx * 0.5 + 0.5) * 255; out.data[i + 1] = (ny * 0.5 + 0.5) * 255; out.data[i + 2] = (nz * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return canvasTex(c, false);
}

/** A cherry petal (soft pink, notched tip) on transparency. */
export function petalCanvas(): HTMLCanvasElement {
  return canvas(64, 64, (g) => {
    g.translate(32, 34);
    const gr = g.createRadialGradient(0, 6, 2, 0, 0, 28); gr.addColorStop(0, '#fff4f8'); gr.addColorStop(0.6, '#ffc6da'); gr.addColorStop(1, '#f59ab9');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 26); g.bezierCurveTo(-26, 10, -22, -22, -6, -26); g.lineTo(0, -18); g.lineTo(6, -26); g.bezierCurveTo(22, -22, 26, 10, 0, 26); g.fill();
  });
}

/** A soft round glow (white centre fading out) for halos round the lights. */
export function glowCanvas(): HTMLCanvasElement {
  return canvas(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}

/** A soft dark blot (a body's contact shadow on the floor). */
export function shadowCanvas(): HTMLCanvasElement {
  return canvas(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(10,4,6,0.78)'); gr.addColorStop(0.45, 'rgba(10,4,6,0.45)'); gr.addColorStop(1, 'rgba(10,4,6,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}
