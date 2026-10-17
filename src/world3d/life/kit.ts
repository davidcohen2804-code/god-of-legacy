// The 3D world's life: what moves in a place for its own sake (birds, butterflies, fireflies, cloth in the wind, swinging
// lanterns, water, smoke, clouds, onlookers). Every module is a function `(scene, at, opts) → Life` that builds itself
// into the three.js scene and is stepped by the place each frame; the place (the arena's courtyard in Room.ts, a world
// map in src/world3d/) only decides where each thing goes. Shared here: the contract, the wind, soft particles and the
// small painted textures the modules draw for themselves.
import * as THREE from 'three';

/** A living thing of a place: stepped each frame (ms since the last, the time in s, how dark the place is 0..1). */
export interface Life {
  update(ms: number, t: number, dim: number): void;
  dispose(): void;
}

/** The wind every living thing shares, set by the place each frame: a steady breeze (units / s along x and z) and the
 *  gusts of big blows (0..1+, `dir` ±1 along x), fading on their own. */
export interface Wind { x: number; z: number; gust: number; dir: number }

export const stillAir = (): Wind => ({ x: 0.3, z: 0.05, gust: 0, dir: 1 });

/** Several lives as one. */
export function lives(list: Life[]): Life {
  return { update: (ms, t, dim) => { for (const l of list) l.update(ms, t, dim); }, dispose: () => { for (const l of list) l.dispose(); } };
}

/** A small seeded random (the same life every load). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (v: number): number => { const k = clamp01(v); return k * k * (3 - 2 * k); };
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ------------------------------------------------------------------ painted textures

export function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); return c;
}

export function tex(c: HTMLCanvasElement, colour = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c); if (colour) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** A soft round dot (white, fading out); `core` keeps a solid middle. */
export function dotCanvas(core = 0.15, size = 64): HTMLCanvasElement {
  return canvas(size, size, (g) => {
    const r = size / 2, gr = g.createRadialGradient(r, r, 0, r, r, r - 0.5);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(core, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
  });
}

/** A puff of smoke: a few soft blobs, the middle denser. */
export function smokeCanvas(seed = 3): HTMLCanvasElement {
  const r = rng(seed);
  return canvas(128, 128, (g) => {
    for (let i = 0; i < 7; i++) {
      const x = 64 + (r() - 0.5) * 48, y = 64 + (r() - 0.5) * 48, rad = 22 + r() * 22;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
  });
}

/** A cloud: a bank of soft lobes, lit from above (the top edge pale, the belly in the dusk's rose). */
export function cloudCanvas(seed = 7): HTMLCanvasElement {
  const r = rng(seed);
  return canvas(512, 256, (g) => {
    const lobes: [number, number, number][] = [];
    for (let i = 0; i < 14; i++) lobes.push([90 + r() * 332, 120 + (r() - 0.3) * 70, 34 + r() * 52]);
    // the body: each lobe a soft disc, the whole shaded top-light to belly-dark
    for (const [x, y, rad] of lobes) {
      const gr = g.createRadialGradient(x, y - rad * 0.25, rad * 0.1, x, y, rad);
      gr.addColorStop(0, 'rgba(255,245,236,0.95)'); gr.addColorStop(0.55, 'rgba(236,200,205,0.75)'); gr.addColorStop(0.85, 'rgba(190,140,170,0.35)'); gr.addColorStop(1, 'rgba(170,120,160,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    // a flat belly: the lower part faded out so the cloud sits on the air
    const belly = g.createLinearGradient(0, 150, 0, 256); belly.addColorStop(0, 'rgba(0,0,0,0)'); belly.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = belly; g.fillRect(0, 150, 512, 106);
  });
}

/** A butterfly's wings (both, open flat; the body a dark line down the middle). `v` picks the colouring. */
export function butterflyCanvas(v: number): HTMLCanvasElement {
  const look = [['#fff6e8', '#ffd27a', '#9a5a2a'], ['#f8e9ff', '#d9a6ff', '#5a3a7a'], ['#ffffff', '#ffd0dc', '#8a4a5a'], ['#fff2c0', '#ffb347', '#6a3a1a']][v % 4];
  return canvas(128, 96, (g) => {
    const wing = (sx: number) => {
      g.save(); g.translate(64, 50); g.scale(sx, 1);
      // the fore wing
      g.fillStyle = look[1]; g.beginPath(); g.moveTo(2, 0); g.bezierCurveTo(30, -58, 66, -46, 60, -14); g.bezierCurveTo(56, 2, 30, 8, 2, 4); g.fill();
      // the hind wing
      g.fillStyle = look[0]; g.beginPath(); g.moveTo(2, 4); g.bezierCurveTo(40, 2, 54, 30, 36, 42); g.bezierCurveTo(22, 50, 6, 30, 2, 8); g.fill();
      // veins and the rim
      g.strokeStyle = look[2]; g.lineWidth = 2.2; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(2, 0); g.bezierCurveTo(30, -58, 66, -46, 60, -14); g.bezierCurveTo(56, 2, 30, 8, 2, 4); g.stroke();
      g.lineWidth = 1.2; for (const a of [-40, -25, -10]) { g.beginPath(); g.moveTo(4, 0); g.lineTo(52, a); g.stroke(); }
      g.globalAlpha = 1;
      // a spot on the fore wing
      g.fillStyle = look[2]; g.globalAlpha = 0.55; g.beginPath(); g.arc(40, -24, 5, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      g.restore();
    };
    wing(1); wing(-1);
    g.strokeStyle = '#2a1a14'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(64, 28); g.lineTo(64, 70); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(64, 30); g.lineTo(56, 18); g.moveTo(64, 30); g.lineTo(72, 18); g.stroke();
  });
}

/** A koi seen from above (head to the right): `v` 0 white with orange patches, 1 orange and gold, 2 white with black. */
export function koiCanvas(v: number): HTMLCanvasElement {
  const base = ['#f4efe6', '#f08a2a', '#f2ede4'][v % 3], patch = ['#f07a1a', '#ffd25a', '#2a2420'][v % 3];
  const r = rng(11 + v);
  return canvas(128, 64, (g) => {
    g.translate(0, 32);
    // the body (a long leaf), the tail forked at the left
    g.fillStyle = base; g.beginPath(); g.moveTo(118, 0); g.bezierCurveTo(112, -16, 70, -17, 36, -9); g.lineTo(14, -16); g.lineTo(22, 0); g.lineTo(14, 16); g.lineTo(36, 9); g.bezierCurveTo(70, 17, 112, 16, 118, 0); g.fill();
    // patches
    g.fillStyle = patch;
    for (let i = 0; i < 3; i++) { const x = 44 + r() * 56, y = (r() - 0.5) * 14, rx = 9 + r() * 10, ry = 5 + r() * 6; g.beginPath(); g.ellipse(x, y, rx, ry, (r() - 0.5) * 0.8, 0, Math.PI * 2); g.fill(); }
    // the fins (translucent), the eye, a dark back line
    g.fillStyle = 'rgba(255,230,200,0.55)'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(84, s * 8); g.lineTo(70, s * 22); g.lineTo(60, s * 9); g.fill(); }
    g.strokeStyle = 'rgba(80,40,20,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(112, 0); g.bezierCurveTo(90, -2, 50, -2, 24, 0); g.stroke();
    g.fillStyle = '#1a1210'; g.beginPath(); g.arc(104, -5, 2.2, 0, Math.PI * 2); g.arc(104, 5, 2.2, 0, Math.PI * 2); g.fill();
  });
}

/** A lily pad from above (a notch toward the stem). */
export function lilyCanvas(seed = 5): HTMLCanvasElement {
  const r = rng(seed);
  return canvas(96, 96, (g) => {
    g.translate(48, 48);
    const gr = g.createRadialGradient(-10, -12, 4, 0, 0, 46); gr.addColorStop(0, '#9fcf6a'); gr.addColorStop(0.7, '#5f9a42'); gr.addColorStop(1, '#3f6e30');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 44, 0.35, Math.PI * 2 - 0.35); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,80,30,0.45)'; g.lineWidth = 1.4;
    for (let i = 0; i < 9; i++) { const a = 0.5 + i * ((Math.PI * 2 - 1) / 8) + (r() - 0.5) * 0.1; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 42, Math.sin(a) * 42); g.stroke(); }
  });
}

/** A paper streamer (shide): a white zigzag strip on transparency. */
export function shideCanvas(): HTMLCanvasElement {
  return canvas(32, 128, (g) => {
    g.fillStyle = '#f8f4ec'; g.beginPath(); g.moveTo(4, 0); g.lineTo(28, 0); g.lineTo(28, 30); g.lineTo(14, 36); g.lineTo(28, 42); g.lineTo(28, 72); g.lineTo(12, 78); g.lineTo(28, 84); g.lineTo(28, 124); g.lineTo(10, 128); g.lineTo(4, 122); g.lineTo(4, 90); g.lineTo(18, 84); g.lineTo(4, 78); g.lineTo(4, 48); g.lineTo(18, 42); g.lineTo(4, 36); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,100,80,0.35)'; g.lineWidth = 1; g.stroke();
  });
}

/** A banner's cloth: deep red, a gold border, the sun emblem (rays round a disc) — `tall` for a hanging / standing banner. */
export function bannerCanvas(seed = 1, emblem = true): HTMLCanvasElement {
  const r = rng(seed);
  return canvas(128, 384, (g) => {
    const base = g.createLinearGradient(0, 0, 128, 0); base.addColorStop(0, '#8e1a1e'); base.addColorStop(0.5, '#b8262a'); base.addColorStop(1, '#8a181c');
    g.fillStyle = base; g.fillRect(0, 0, 128, 384);
    // the weave: faint horizontal threads
    g.globalAlpha = 0.08; g.fillStyle = '#000'; for (let y = 0; y < 384; y += 3) if (r() < 0.6) g.fillRect(0, y, 128, 1); g.globalAlpha = 1;
    // the gold border and a tassel row at the hem
    g.strokeStyle = '#e0b04c'; g.lineWidth = 5; g.strokeRect(8, 8, 112, 368);
    g.fillStyle = '#e0b04c'; for (let x = 12; x < 124; x += 14) { g.beginPath(); g.moveTo(x, 376); g.lineTo(x + 7, 384); g.lineTo(x + 14, 376); g.fill(); }
    if (!emblem) return;
    // the sun: a disc and twelve rays, gold on red
    g.save(); g.translate(64, 150);
    g.fillStyle = '#f2c660'; g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e0b04c'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, L = i % 2 ? 36 : 46; g.beginPath(); g.moveTo(Math.cos(a - 0.12) * 26, Math.sin(a - 0.12) * 26); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a + 0.12) * 26, Math.sin(a + 0.12) * 26); g.fill(); }
    g.fillStyle = '#b8262a'; g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
    g.restore();
    // a gold character band below the emblem
    g.fillStyle = '#e0b04c'; for (let i = 0; i < 3; i++) { const y = 230 + i * 44; g.fillRect(44, y, 40, 5); g.fillRect(60, y - 12, 8, 30); g.fillRect(40, y + 16, 48, 4); }
  });
}

// ------------------------------------------------------------------ soft particles

/** A pool of soft particles (smoke, sparks, fireflies): each its own colour, size, alpha and fade, drifting under its own
 *  velocity with drag and gravity; drawn as point sprites sized by their distance (one draw for the pool). */
export class Puffs {
  readonly pts: THREE.Points;
  private pos: Float32Array; private vel: Float32Array; private col: Float32Array; private size: Float32Array; private alpha: Float32Array;
  private life: Float32Array; private max: Float32Array; private a0: Float32Array; private grow: Float32Array; private grav: Float32Array; private drag: Float32Array;
  private next = 0;
  private mat: THREE.ShaderMaterial;
  private v2 = new THREE.Vector2();
  constructor(private n: number, map: THREE.Texture, additive: boolean) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1);
    this.a0 = new Float32Array(n); this.grow = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, vh: { value: 900 } },
      vertexShader: 'attribute float psize; attribute float palpha; attribute vec3 pcolor; uniform float vh; varying float vA; varying vec3 vC;\n'
        + 'void main() { vA = palpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = palpha > 0.0 ? psize * projectionMatrix[1][1] * vh * 0.5 / max(0.2, -mv.z) : 0.0; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying float vA; varying vec3 vC;\n'
        + 'void main() { vec4 t = texture2D(map, gl_PointCoord); float a = t.a * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC * t.rgb, a); }',
      transparent: true, depthWrite: false, depthTest: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false;
    // the point size follows the picture's height, whatever target this is drawn into
    this.pts.onBeforeRender = (renderer) => { this.mat.uniforms.vh.value = renderer.getDrawingBufferSize(this.v2).y; };
  }
  /** One particle: where, its speed (units / s), colour (sRGB hex), size (units), life (ms), and how it moves. */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, size: number, ms: number, o: { a?: number; grow?: number; grav?: number; drag?: number } = {}): number {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.col.set([((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], i * 3);
    this.size[i] = size; this.life[i] = ms; this.max[i] = ms; this.a0[i] = o.a ?? 1; this.alpha[i] = this.a0[i];
    this.grow[i] = o.grow ?? 0; this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 1;
    return i;
  }
  /** A nudge to every live particle (wind). */
  push(vx: number, vy: number, vz: number): void {
    for (let i = 0; i < this.n; i++) { if (this.life[i] <= 0) continue; const j = i * 3; this.vel[j] += vx; this.vel[j + 1] += vy; this.vel[j + 2] += vz; }
  }
  step(ms: number, curl = 0, t = 0): void {
    const dt = ms / 1000;
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; any = true; } continue; }
      any = true; this.life[i] -= ms;
      const j = i * 3, d = Math.pow(this.drag[i], dt);
      this.vel[j + 1] -= this.grav[i] * dt;
      if (curl) { this.vel[j] += Math.sin(t * 1.7 + i * 1.3 + this.pos[j + 1] * 2.1) * curl * dt; this.vel[j + 2] += Math.cos(t * 1.3 + i * 0.7 + this.pos[j + 1] * 1.7) * curl * dt; }
      this.vel[j] *= d; this.vel[j + 1] *= d; this.vel[j + 2] *= d;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      this.alpha[i] = this.life[i] > 0 ? this.a0[i] * Math.min(1, k * 2.5) * Math.min(1, (1 - k) * 6 + 0.1) : 0; // (in, full, out)
    }
    if (!any) return;
    const g = this.pts.geometry;
    for (const a of ['position', 'psize', 'palpha', 'pcolor']) (g.attributes[a] as THREE.BufferAttribute).needsUpdate = true;
  }
  dispose(): void { this.pts.geometry.dispose(); this.mat.dispose(); }
}
