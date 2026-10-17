// PVP 3D (opened from the main menu's PVP 3D button): the arena as a real 3D place — the temple courtyard modelled in
// 3D (Room.ts) under a perspective camera that follows the fight and turns a little with it — while the fighters,
// skills, effects and the whole combat stay the game's own (Phaser, the same world coordinates and rules). The room is
// drawn by three.js into its own canvas and shown as two Phaser layers (everything behind the fighters, and the railing
// in front of them); every Phaser object of the world is placed for the frame where the 3D camera sees its floor point,
// at the size the depth gives it, and put straight back after the frame (like CameraPitch): the game never sees it.
import Phaser from 'phaser';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildRoom, type Room } from './Room';
import { Fx3D } from './Fx3D';
import { ImpactFx } from '../skills/ImpactFx';
import type { Projectile } from '../skills/HitGeometry';


/** World px → 3D units: 1 unit = 100 px; the floor's depth stretched (a deep room), heights as drawn. */
const U = 100, HEIGHT_K = 1.0;
/** The camera: pitch below the horizon, field of view, distance (units) — and how much it turns with the fight. */
const CAM = { pitch: 24, fov: 32, dist: 8.4, distPerSpan: 0.3, distMax: 14, yawMax: 11, follow: 0.12, aim: 0.5 };
/** The floor's depth stretch (world px of depth → units). Things drawn without a floor point of their own (effects in
 *  the top layers, numbers) are placed over the fighter nearest to them, so any depth reads right. */
const DEPTH_K = 1.15;
/** Voxel size (units). */
/** The room's render size (a share of the game's): the paintings stay crisp, the cost stays low. */
const RES = 0.85;

type Placed = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Visible
  & { scrollFactorX?: number; scrollFactorY?: number; depth: number; displayWidth?: number };

/** A pool of soft particles in the room (dust, wood chips, embers): each its own colour, size and fade, falling under
 *  its gravity and bouncing off the planks. Drawn as point sprites (one draw for the pool). */
class Bits {
  readonly pts: THREE.Points;
  private pos: Float32Array; private vel: Float32Array; private col: Float32Array; private size: Float32Array; private alpha: Float32Array;
  private life: Float32Array; private max: Float32Array; private a0: Float32Array; private grow: Float32Array; private grav: Float32Array; private drag: Float32Array;
  private next = 0;
  private mat: THREE.ShaderMaterial;
  constructor(private n: number, tex: THREE.Texture, additive: boolean) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1);
    this.a0 = new Float32Array(n); this.grow = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 400 } },
      vertexShader: 'attribute float psize; attribute float palpha; attribute vec3 pcolor; uniform float scale; varying float vA; varying vec3 vC;\n'
        + 'void main() { vA = palpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = palpha > 0.0 ? psize * scale / max(0.2, -mv.z) : 0.0; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying float vA; varying vec3 vC;\n'
        + 'void main() { vec4 t = texture2D(map, gl_PointCoord); float a = t.a * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC * t.rgb, a); }',
      transparent: true, depthWrite: false, depthTest: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false;
  }
  /** px per unit of size at 1 unit from the camera (the render's height and the lens). */
  setScale(s: number): void { this.mat.uniforms.scale.value = s; }
  /** One particle: where, its speed (units / s), colour (sRGB hex), size (units), life (ms), and how it moves. */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, size: number, ms: number, o: { a?: number; grow?: number; grav?: number; drag?: number } = {}): void {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.col.set([((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], i * 3);
    this.size[i] = size; this.life[i] = ms; this.max[i] = ms; this.a0[i] = o.a ?? 1; this.alpha[i] = this.a0[i];
    this.grow[i] = o.grow ?? 0; this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 1;
  }
  step(ms: number): void {
    const dt = ms / 1000;
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; any = true; } continue; }
      any = true; this.life[i] -= ms;
      const j = i * 3, d = Math.pow(this.drag[i], dt);
      this.vel[j + 1] -= this.grav[i] * dt;
      this.vel[j] *= d; this.vel[j + 1] *= d; this.vel[j + 2] *= d;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.grav[i] > 0 && this.pos[j + 1] < 0.01) { this.pos[j + 1] = 0.01; this.vel[j + 1] *= -0.32; this.vel[j] *= 0.55; this.vel[j + 2] *= 0.55; } // (a bounce on the planks)
      this.size[i] += this.grow[i] * dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      this.alpha[i] = this.life[i] > 0 ? this.a0[i] * Math.min(1, k * 2.2) : 0; // (full most of its life, fading at the end)
    }
    if (!any) return;
    const g = this.pts.geometry;
    for (const a of ['position', 'psize', 'palpha', 'pcolor']) (g.attributes[a] as THREE.BufferAttribute).needsUpdate = true;
  }
  dispose(): void { this.pts.geometry.dispose(); this.mat.dispose(); }
}

/** Two sRGB hex colours mixed (t: 0 = a, 1 = b). */
const mix = (a: number, b: number, t: number): number => {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};
const r01 = Math.random;

/** A soft round sprite (white, fading to the edge) for the particles: `core` keeps a solid middle (chips, embers). */
function dotTexture(core: number): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(core, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export interface Floor { x0: number; x1: number; back: number; front: number }

export class Arena3D {
  private renderer: THREE.WebGLRenderer;
  private scene3 = new THREE.Scene();
  private front3 = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private bg: Phaser.GameObjects.Image;
  private fg: Phaser.GameObjects.Image;
  /** The skills' glow in front of the fighters (Fx3D), added over the picture. */
  private glow3 = new THREE.Scene();
  private fxImg: Phaser.GameObjects.Image;
  /** The skills in the room's 3D: pillars, cracks and chunks, waves, domes, crystals, lightning, trails, slash arcs. */
  fx!: Fx3D;
  /** The blow felt on the whole picture (set by the scene: its ImpactFx). */
  onImpact?: (at: { x: number; y: number; z: number }, big: 0 | 1 | 2) => void;
  /** The fighters' bodies as drawn (set by the scene each frame, with their contact shadow): each casts the sun's
   *  shadow on the floor — its own silhouette laid down away from the low sun (sheared like a real cast shadow). */
  bodies: { body: Phaser.GameObjects.Sprite; foot: Phaser.GameObjects.Image; z: number }[] = [];
  private shades = new Map<Phaser.GameObjects.Sprite, { c: Phaser.GameObjects.Container; im: Phaser.GameObjects.Image; dark: Phaser.GameObjects.Image; lit: Phaser.GameObjects.Image }>();
  /** The sun's shadow per px of height, as drawn: the shear of the silhouette laid on the floor. */
  private sunShadow = { a: 0.9, b: 0.35 };
  /** Where a fighter stands (set by the scene): the skills' pieces follow their caster. */
  casterPos: (id: string) => { x: number; y: number; z: number } | null = () => null;
  private bgCanvas: HTMLCanvasElement;
  private fgCanvas: HTMLCanvasElement;
  private saved: [Placed, number, number, number, number][] = [];
  private look = new THREE.Vector3();
  private pos = new THREE.Vector3();
  private yaw = 0;
  private dist = CAM.dist;
  /** The modelled courtyard (its light, its petals, its wind). */
  private room!: Room;
  /** The room's picture with a soft bloom (the lanterns, the doors, the blows' light glow into the air). */
  private composer?: EffectComposer;
  private sunBase = 0; private hemiBase = 0;
  /** The hits' light: a small pool of point lights, each placed on a hit and fading (the floor and the ground take it). */
  private hitLights: { L: THREE.PointLight; F: THREE.PointLight; left: number; ms: number; power: number }[] = [];
  /** The marks a heavy blow leaves on the floor (a soft dark scorch / dust ring, fading). */
  private marks: { m: THREE.Mesh; left: number; ms: number }[] = [];
  private markTex?: THREE.Texture;
  /** How dark the room is (0 = as painted, 1 = night): eased toward `dimWant`, set by the scene in a big moment. */
  private dimNow = 0;
  dimWant = 0;
  /** The room's answer to a blow: dust and wood chips (behind / in front of the fighters), embers (glowing, the same). */
  private dustB!: Bits; private dustF!: Bits; private chipB!: Bits; private chipF!: Bits; private glowB!: Bits; private glowF!: Bits;
  /** Rings of light running over the planks from a heavy blow / a body slammed down. */
  private rings: { m: THREE.Mesh; left: number; ms: number; r0: number; r1: number; a: number }[] = [];
  private ringTex?: THREE.Texture;
  /** A small push-in of the camera on a heavy blow (fades by itself). */
  private kick = 0;
  /** A jolt of the camera across the view on a heavy blow (units; the picture jumps the way the blow goes), springing back. */
  private nudge = 0;
  /** The fighters' feet last frame (world px) and the way run since the last puff: running and being driven back
   *  along the planks kick up dust (more, and wood grit, the faster). */
  private feet: { x: number; y: number; run: number }[] = [];
  private t = 0;
  /** The fighters' midpoint and spread (world px), set by the scene each frame. */
  focus = { x: 0, y: 0, z: 0, span: 0 };
  /** A punch-in (1 = none), set by the scene (an ultimate, the K.O.). */
  punch = 1;
  /** The fighters' floor points (world px), set by the scene: what floats without a floor of its own is drawn over the
   *  nearest of them. */
  anchors: { x: number; y: number; z?: number }[] = [];

  constructor(private scene: Phaser.Scene, private floor: Floor) {
    const soft = !!(navigator as { webdriver?: boolean }).webdriver; // (test browsers render on the CPU: half size, no shadows)
    const res = soft ? 0.4 : RES, w = Math.round(scene.scale.width * res), h = Math.round(scene.scale.height * res);
    // one three.js canvas: the room is drawn into it, handed to Phaser (a GPU copy), then the railing, handed over too
    this.bgCanvas = document.createElement('canvas');
    this.fgCanvas = this.bgCanvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.bgCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true; // (the skills' pieces split round the fighters: behind them in the room, in front over them)
    this.camera = new THREE.PerspectiveCamera(CAM.fov, w / h, 0.5, 400);
    this.build(soft);
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: soft ? 0 : 4 })); // (multisampled: the room's edges stay smooth)
    this.composer.addPass(new RenderPass(this.scene3, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(Math.round(w / 2), Math.round(h / 2)), 0.5, 0.55, 0.86));
    this.composer.addPass(new OutputPass());
    const ps = h / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2))); // (a particle's size in units → px at 1 unit away)
    for (const b of [this.dustB, this.dustF, this.chipB, this.chipF, this.glowB, this.glowF]) b.setScale(ps);
    this.focus = { x: (floor.x0 + floor.x1) / 2, y: (floor.back + floor.front) / 2, z: 0, span: 0 };
    this.place(true);
    // the two layers: the room behind everything, the railing (front3) over the fighters
    for (const k of ['arena3d-bg', 'arena3d-fg']) if (scene.textures.exists(k)) scene.textures.remove(k);
    scene.textures.addImage('arena3d-bg', this.bgCanvas as unknown as HTMLImageElement);
    scene.textures.addImage('arena3d-fg', this.fgCanvas as unknown as HTMLImageElement);
    this.bg = scene.add.image(0, 0, 'arena3d-bg').setOrigin(0, 0).setScrollFactor(0).setDepth(-1e6).setDisplaySize(scene.scale.width, scene.scale.height);
    this.fg = scene.add.image(0, 0, 'arena3d-fg').setOrigin(0, 0).setScrollFactor(0).setDepth(90000).setDisplaySize(scene.scale.width, scene.scale.height);
    if (scene.textures.exists('arena3d-fx')) scene.textures.remove('arena3d-fx');
    scene.textures.addImage('arena3d-fx', this.bgCanvas as unknown as HTMLImageElement);
    this.fxImg = scene.add.image(0, 0, 'arena3d-fx').setOrigin(0, 0).setScrollFactor(0).setDepth(89990).setDisplaySize(scene.scale.width, scene.scale.height).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    // the blows on the whole picture land where this camera shows them
    ImpactFx.screenOf = (x, y, z) => this.project(x, y, z);
    ImpactFx.drawnAt = (x, wy) => this.drawnAt(x, wy);
    this.fx.warm(this.renderer);
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.apply, this);
    scene.events.on(Phaser.Scenes.Events.RENDER, this.restore, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // ------------------------------------------------------------------ the room

  private w3 = (x: number) => x / U;
  private d3 = (y: number) => (y / U) * DEPTH_K;
  private h3 = (z: number) => (z / U) * HEIGHT_K;

  private build(soft: boolean): void {
    const F = this.floor;
    this.room = buildRoom(this.scene3, this.front3, this.renderer, { x0: this.w3(F.x0), x1: this.w3(F.x1), zB: this.d3(F.back), zF: this.d3(F.front) }, soft);
    this.sunBase = this.room.sun.intensity; this.hemiBase = this.room.hemi.intensity;
    { // the sun's shadow: per unit of height, how far it lies on the floor (x, toward the camera) — and how that looks
      const d = this.room.sun.position.clone().sub(this.room.sun.target.position).normalize(), up = Math.max(0.2, d.y);
      const fx = -d.x / up, fz = -d.z / up, p = Phaser.Math.DegToRad(CAM.pitch);
      this.sunShadow = { a: fx / Math.cos(p), b: fz * Math.tan(p) };
    }
    // what a blow throws up from the floor: dust, wood chips, embers — behind the fighters and in front of them
    const dsoft = dotTexture(0.12), solid = dotTexture(0.6);
    this.dustB = new Bits(120, dsoft, false); this.dustF = new Bits(80, dsoft, false);
    this.chipB = new Bits(90, solid, false); this.chipF = new Bits(60, solid, false);
    this.glowB = new Bits(140, solid, true); this.glowF = new Bits(90, solid, true);
    this.scene3.add(this.dustB.pts, this.chipB.pts, this.glowB.pts); this.front3.add(this.dustF.pts, this.chipF.pts, this.glowF.pts);
    // the blows' light: always in the scene (a light switched on or off recompiles every material: a hitch), dark when idle
    for (let i = 0; i < 4; i++) {
      const L = new THREE.PointLight(0xffffff, 0, 6, 1.6), F = new THREE.PointLight(0xffffff, 0, 6, 1.6); // (the same light on the railing and the chunks in front)
      this.scene3.add(L); this.front3.add(F); this.hitLights.push({ L, F, left: 0, ms: 1, power: 0 });
    }
    // the skills' 3D pieces
    this.fx = new Fx3D({
      back: this.scene3, solid: this.front3, glow: this.glow3, camera: this.camera,
      w3: this.w3, d3: this.d3, h3: this.h3,
      flare: (hx, hy, hz, color, power, dist, ms) => this.flare(hx, hy, hz, color, power, dist, ms),
      dust: (hx, hz, n, k) => this.dust(hx, hz, n, k),
      embers: (hx, hy, hz, color, n, speed) => this.embers(hx, hy, hz, color, n, speed),
      ring: (hx, hz, color, r1, ms, a) => this.ring(hx, hz, color, r1, ms, a),
      blow: (hx, hy, hz, R, st) => this.blowPetals(hx, hy, hz, R, st),
      kick: (a) => { this.kick = Math.max(this.kick, a); },
      casterPos: (id) => this.casterPos(id),
      impact: (at, big) => this.onImpact?.(at, big),
    });
  }

  /** A flare of light at a point (units) from the hit lights' pool. */
  private flare(hx: number, hy: number, hz: number, color: number, power: number, dist: number, ms: number): void {
    const slot = this.hitLights.reduce((a, b) => (b.left < a.left ? b : a));
    for (const L of [slot.L, slot.F]) { L.color.set(color); L.distance = dist; L.position.set(hx, hy, hz); }
    slot.left = ms; slot.ms = ms; slot.power = power;
  }

  /** Glowing sparks thrown from a point (units), falling and bouncing on the planks. */
  private embers(hx: number, hy: number, hz: number, color: number, n: number, speed: number): void {
    const r = Math.random, c = mix(color, 0xffffff, 0.4);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, up = 0.3 + r() * 0.7, sp = speed * (0.5 + r() * 0.8);
      const vx = Math.cos(a) * sp * (1 - up * 0.5), vz = Math.sin(a) * sp * (1 - up * 0.5) * 0.8;
      (vz > 0 ? this.glowF : this.glowB).emit(hx, hy, hz, vx, up * sp, vz, c, 0.06 + r() * 0.07, 380 + r() * 500, { grav: 7, drag: 0.55 });
    }
  }

  /** PVP 3D: a point drawn at (x, drawn y) with no floor of its own: over the nearest fighter, as every effect is placed. */
  private drawnAt(x: number, wy: number): { sx: number; sy: number; k: number } {
    let best: { x: number; y: number } | null = null;
    for (const a of this.anchors) if (!best || Math.abs(a.x - x) < Math.abs(best.x - x)) best = a;
    const floor = best && Math.abs(best.x - x) < 700 && wy <= best.y + 30 ? best.y : wy;
    return this.project(x, floor, floor - wy);
  }

  // ------------------------------------------------------------------ the skills in the room

  /** A blow lands at a world point (x, depth y, height z px): its light flares on the floor around it in the skill's
   *  colour and fades (heavier blows: brighter, wider, longer); a heavy one leaves a mark on the floor. */
  hit(x: number, y: number, z: number, color: number, weight: 'light' | 'heavy' | 'ultimate'): void {
    const P = weight === 'ultimate' ? { power: 34, dist: 11, ms: 520 } : weight === 'heavy' ? { power: 20, dist: 8, ms: 340 } : { power: 9, dist: 5, ms: 200 };
    this.flare(this.w3(x), this.h3(Math.max(40, z)) + 0.35, this.d3(y) + 0.25, color, P.power, P.dist, P.ms);
    if (weight !== 'light') this.mark(x, y, weight === 'ultimate' ? 2.4 : 1.4, color);
    // the room answers the blow (Prometheus: the skills live in the room): embers fly from it and bounce on the planks;
    // a heavy one throws up wood chips and dust, runs a ring of its light over the floor, blows the petals away, and
    // pushes the camera in a touch
    const hx = this.w3(x), hy = this.h3(Math.max(40, z)), hz = this.d3(y), big = weight === 'ultimate' ? 2 : weight === 'heavy' ? 1 : 0;
    const ember = mix(color, 0xffffff, 0.45), r = Math.random;
    for (let i = 0, n = [4, 14, 28][big]; i < n; i++) {
      const a = r() * Math.PI * 2, up = 0.35 + r() * 0.65, sp = (big ? 2.2 + r() * 3.4 : 1.4 + r() * 1.8) * (big === 2 ? 1.25 : 1);
      const vx = Math.cos(a) * sp * (1 - up * 0.5), vz = Math.sin(a) * sp * (1 - up * 0.5) * 0.8, vy = up * sp;
      (vz > 0 ? this.glowF : this.glowB).emit(hx, hy, hz, vx, vy, vz, ember, [0.07, 0.1, 0.12][big] + r() * [0.03, 0.07, 0.08][big], 420 + r() * 520, { grav: 7.5, drag: 0.55 });
    }
    if (!big) return;
    for (let i = 0, n = big === 2 ? 16 : 8; i < n; i++) {
      const a = r() * Math.PI * 2, out = 0.8 + r() * 1.8, ox = (r() - 0.5) * 0.4, oz = (r() - 0.5) * 0.3;
      const wood = [0x5a3422, 0x7a4b2a, 0x3a2418, 0x8a5a34][i % 4];
      (Math.sin(a) > 0 ? this.chipF : this.chipB).emit(hx + ox, 0.04, hz + oz, Math.cos(a) * out, 2 + r() * 2.6, Math.sin(a) * out * 0.8, wood, 0.04 + r() * 0.035, 800 + r() * 500, { grav: 11, drag: 0.8 });
    }
    this.dust(hx, hz, big === 2 ? 12 : 6, big === 2 ? 1.25 : 1);
    this.ring(hx, hz, color, big === 2 ? 4.2 : 2.4, big === 2 ? 420 : 260, 0.9);
    if (big === 2) this.ring(hx, hz, 0xffffff, 2.6, 300, 0.6);
    this.blowPetals(hx, hy, hz, big === 2 ? 5 : 3.2, big === 2 ? 5.5 : 3.2);
    this.kick = Math.max(this.kick, big === 2 ? 0.07 : 0.035);
    // the picture jumps the way the blow goes (from the other fighter to the struck one)
    let foe: { x: number } | null = null, near = Infinity;
    for (const a of this.anchors) { const d = Math.hypot(a.x - x, a.y - y); if (d > 40 && d < near) { near = d; foe = a; } }
    if (foe) this.nudge = -Math.sign(x - foe.x || 1) * (big === 2 ? 0.09 : 0.05);
  }

  /** A body comes down on the floor (world px; its falling speed px / s): a slam throws up dust and chips and runs a
   *  dusty ring over the planks; a landing from a jump only puffs a little dust. */
  land(x: number, y: number, speed: number): void {
    if (speed < 300) return;
    const hx = this.w3(x), hz = this.d3(y), slam = speed >= 600;
    this.dust(hx, hz, slam ? 7 : 3, slam ? 0.9 : 0.55);
    if (!slam) return;
    for (let i = 0; i < 6; i++) {
      const a = r01() * Math.PI * 2, out = 0.6 + r01() * 1.2;
      (Math.sin(a) > 0 ? this.chipF : this.chipB).emit(hx + (r01() - 0.5) * 0.6, 0.04, hz, Math.cos(a) * out, 1.4 + r01() * 1.8, Math.sin(a) * out * 0.8, [0x5a3422, 0x7a4b2a, 0x3a2418][i % 3], 0.035 + r01() * 0.03, 700 + r01() * 400, { grav: 11, drag: 0.8 });
    }
    this.ring(hx, hz, 0xd8bfa6, 2.0, 260, 0.45);
    this.blowPetals(hx, 0.3, hz, 2.4, 2.2);
    this.kick = Math.max(this.kick, 0.02);
  }

  /** Warm dust rolling out over the planks from a point (units): n puffs, `k` their size. */
  private dust(hx: number, hz: number, n: number, k: number): void {
    const r = Math.random;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, out = (0.4 + r() * 0.9) * k;
      (Math.sin(a) > 0 ? this.dustF : this.dustB).emit(hx + Math.cos(a) * 0.2, 0.12 + r() * 0.12, hz + Math.sin(a) * 0.15, Math.cos(a) * out, 0.12 + r() * 0.25, Math.sin(a) * out * 0.75, [0xcdb39c, 0xbfa38c, 0xd9c2a8][i % 3], (0.45 + r() * 0.35) * k, 700 + r() * 600, { a: 0.18 + r() * 0.1, grow: (1 + r() * 1.1) * k, drag: 0.3 });
    }
  }

  /** A ring of light running out over the planks (units): from a little round the point to `r1`, fading. */
  private ring(hx: number, hz: number, color: number, r1: number, ms: number, a: number): void {
    if (!this.ringTex) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 63);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.72, 'rgba(255,255,255,0)'); gr.addColorStop(0.9, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); this.ringTex = new THREE.CanvasTexture(c);
    }
    const mat = new THREE.MeshBasicMaterial({ map: this.ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(mix(color, 0xffffff, 0.25)), opacity: a, fog: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(hx, 0.02, hz); this.scene3.add(m);
    this.rings.push({ m, left: ms, ms, r0: 0.3, r1, a });
  }

  /** The petals near a blow (falling, and lying on the floor) are thrown away from it. */
  private blowPetals(hx: number, hy: number, hz: number, R: number, strength: number): void { this.room.blow(hx, hy, hz, R, strength); }

  private mark(x: number, y: number, size: number, color: number): void {
    if (!this.markTex) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(20,10,8,0.75)'); gr.addColorStop(0.55, 'rgba(30,16,10,0.35)'); gr.addColorStop(1, 'rgba(30,16,10,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 38; g.fillStyle = `rgba(15,8,6,${0.25 + Math.random() * 0.3})`; g.fillRect(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 3, 3); } // (grit)
      this.markTex = new THREE.CanvasTexture(c);
    }
    const mat = new THREE.MeshBasicMaterial({ map: this.markTex, transparent: true, depthWrite: false, color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.6) });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.8), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(this.w3(x), 0.012 + this.marks.length * 0.0005, this.d3(y)); this.scene3.add(m);
    this.marks.push({ m, left: 2600, ms: 2600 });
    if (this.marks.length > 14) { const old = this.marks.shift()!; this.scene3.remove(old.m); old.m.geometry.dispose(); (old.m.material as THREE.Material).dispose(); }
  }

  /** Each frame: the hit lights fade, the marks fade, the room darkens / brightens toward what the moment wants. */
  private stepFx(ms: number): void {
    for (const h of this.hitLights) {
      if (h.left <= 0) { h.L.intensity = h.F.intensity = 0; continue; }
      h.left -= ms; const k = Math.max(0, h.left / h.ms);
      h.L.intensity = h.F.intensity = h.power * (k * k * (3 - 2 * k)); // (a fast flare, a soft fade)
    }
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mk = this.marks[i]; mk.left -= ms;
      (mk.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, mk.left / 900);
      if (mk.left <= 0) { this.scene3.remove(mk.m); mk.m.geometry.dispose(); (mk.m.material as THREE.Material).dispose(); this.marks.splice(i, 1); }
    }
    for (const b of [this.dustB, this.dustF, this.chipB, this.chipF, this.glowB, this.glowF]) b.step(ms);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const g = this.rings[i]; g.left -= ms;
      const k = 1 - Math.max(0, g.left / g.ms), e = 1 - (1 - k) * (1 - k) * (1 - k), s = g.r0 + (g.r1 - g.r0) * e; // (fast out, slowing)
      g.m.scale.set(s * 2, s * 2, 1); (g.m.material as THREE.MeshBasicMaterial).opacity = g.a * (1 - k) * (1 - k * 0.3);
      if (g.left <= 0) { this.scene3.remove(g.m); g.m.geometry.dispose(); (g.m.material as THREE.Material).dispose(); this.rings.splice(i, 1); }
    }
    this.kick -= this.kick * Math.min(1, ms / 110);
    this.nudge -= this.nudge * Math.min(1, ms / 70);
    this.dimNow += (this.dimWant - this.dimNow) * Math.min(1, ms / (this.dimWant > this.dimNow ? 120 : 380));
    const lit = 1 - 0.7 * this.dimNow; // (the sun and the sky go down; the lanterns and the temple's doors burn on)
    this.room.sun.intensity = this.sunBase * lit; this.room.hemi.intensity = this.hemiBase * (1 - 0.55 * this.dimNow);
  }

  // ------------------------------------------------------------------ the camera

  /** Follow the fight: the fighters' midpoint ahead, pulled back as they part, turned a little as it slides. */
  /** What flies this frame (set by the scene): the skills' trails and crests follow it. */
  flying: Projectile[] = [];

  /** Each frame: `fxMs` is the effects' time (0 through a hit-stop: the blow's sparks, chunks and light hang in the air
   *  with the fighters — the impact frame); the camera and the room's own life (wind, petals) run on `ms`. */
  step(ms: number, fxMs = ms): void {
    this.t += ms;
    this.stepFx(fxMs);
    this.fx.update(fxMs, this.flying);
    const f = this.focus, F = this.floor, k = Math.min(1, (ms / 16) * CAM.follow);
    const want = new THREE.Vector3(this.w3(f.x), this.h3(Math.min(160, f.z * 0.4)) + CAM.aim, this.d3(f.y));
    this.look.lerp(want, this.look.lengthSq() ? k : 1);
    const cx = (F.x0 + F.x1) / 2, half = Math.max(1, (F.x1 - F.x0) / 2);
    this.yaw += ((-Phaser.Math.Clamp((f.x - cx) / half, -1, 1) * CAM.yawMax) - this.yaw) * k;
    this.dist += (Math.min(CAM.distMax, CAM.dist + this.w3(f.span) * CAM.distPerSpan) / this.punch - this.dist) * k;
    this.place(false);
    this.footDust(ms);
    for (const [i, L] of this.room.warm.entries()) { const b = (L.userData.base ??= L.intensity) as number; L.intensity = b * (1 + Math.sin(this.t / 140 + i * 1.7) * 0.08 + Math.sin(this.t / 53 + i) * 0.04); } // flicker
    this.room.update(ms, this.t / 1000, this.dimNow);
  }

  /** Running, dashing and being driven back along the planks kick up dust at the feet (wood grit when fast). */
  private footDust(ms: number): void {
    if (ms <= 0) return;
    this.anchors.forEach((a, i) => {
      const f = this.feet[i] ?? (this.feet[i] = { x: a.x, y: a.y, run: 0 });
      const d = Math.hypot(a.x - f.x, a.y - f.y), v = (d * 1000) / ms; f.x = a.x; f.y = a.y;
      if (d > 140 || (a.z ?? 0) > 3 || v < 330) { f.run = 0; return; } // (a teleport, in the air, or walking)
      f.run += d;
      const every = v > 700 ? 34 : 52;
      while (f.run >= every) {
        f.run -= every;
        const hx = this.w3(a.x), hz = this.d3(a.y), k = Math.min(1.3, v / 700), r = Math.random;
        (r() < 0.5 ? this.dustF : this.dustB).emit(hx + (r() - 0.5) * 0.15, 0.06, hz + (r() - 0.5) * 0.1, (r() - 0.5) * 0.5, 0.15 + r() * 0.2, (r() - 0.5) * 0.3, [0xcdb39c, 0xbfa38c][i % 2], (0.28 + r() * 0.2) * k, 520 + r() * 380, { a: 0.14 + 0.1 * k, grow: 0.9 * k, drag: 0.35 });
        if (v > 650) (r() < 0.5 ? this.chipF : this.chipB).emit(hx, 0.03, hz, (r() - 0.5) * 1.2, 0.8 + r() * 1.2, (r() - 0.5) * 0.8, [0x5a3422, 0x7a4b2a][i % 2], 0.025 + r() * 0.02, 500 + r() * 300, { grav: 11, drag: 0.8 });
      }
    });
  }

  private place(snap: boolean): void {
    if (snap) { const f = this.focus; this.look.set(this.w3(f.x), CAM.aim, this.d3(f.y)); }
    const p = Phaser.Math.DegToRad(CAM.pitch), y = Phaser.Math.DegToRad(this.yaw), d = this.dist / (1 + this.kick);
    this.pos.set(this.look.x + Math.sin(y) * Math.cos(p) * d, this.look.y + Math.sin(p) * d, this.look.z + Math.cos(y) * Math.cos(p) * d);
    const nx = Math.cos(y) * this.nudge, nz = -Math.sin(y) * this.nudge; // (across the view)
    this.camera.position.set(this.pos.x + nx, this.pos.y, this.pos.z + nz);
    this.camera.lookAt(this.look.x + nx, this.look.y, this.look.z + nz); this.camera.updateMatrixWorld(); this.camera.updateProjectionMatrix();
  }

  /** Screen point (Phaser px) of a world point (x, depth y, height z px) and the px per world px there. */
  private v = new THREE.Vector3(); private v2 = new THREE.Vector3();
  project(x: number, y: number, z: number): { sx: number; sy: number; k: number } {
    const w = this.scene.scale.width, h = this.scene.scale.height;
    this.v.set(this.w3(x), this.h3(z), this.d3(y)).project(this.camera);
    this.v2.set(this.w3(x), this.h3(z + U), this.d3(y)).project(this.camera);
    const sx = (this.v.x + 1) / 2 * w, sy = (1 - this.v.y) / 2 * h, sy2 = (1 - this.v2.y) / 2 * h;
    return { sx, sy, k: Math.abs(sy - sy2) / U };
  }

  // ------------------------------------------------------------------ each frame: draw the room, place the world

  private apply(): void {
    this.restore();
    this.shadeBodies();
    const cam = this.scene.cameras.main;
    cam.setZoom(1); cam.setScroll(0, 0); // (the 3D camera frames the fight; the Phaser camera only shakes / fades)
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene3, this.camera);
    this.scene.textures.get('arena3d-bg').source[0].update(); // (uploaded now: the next render draws over the canvas)
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(this.front3, this.camera);
    this.scene.textures.get('arena3d-fg').source[0].update();
    // the skills' glow in front of the fighters: drawn alone, added over the picture (none drawn when there is none)
    const glow = this.glow3.children.some((o) => o.visible);
    if (glow) { this.renderer.render(this.glow3, this.camera); this.scene.textures.get('arena3d-fx').source[0].update(); }
    this.fxImg.setVisible(glow);
    // every world object: placed where the 3D camera sees its floor point, scaled by its depth
    const sw = this.scene.scale.width;
    const visit = (o: Placed, top: boolean) => {
      if (!o.visible || o === (this.bg as unknown) || o === (this.fg as unknown) || o === (this.fxImg as unknown) || o.scrollFactorX === 0) return;
      if (o instanceof Phaser.GameObjects.Container && o.x === 0 && o.y === 0) { for (const c of o.list as Placed[]) visit(c, false); return; }
      if ((o.displayWidth ?? 0) > sw * 0.6) return; // screen-sized overlays (a darkening, a cut-in band) stay where they are drawn
      if (o instanceof Phaser.GameObjects.Graphics && o.x === 0 && o.y === 0) return; // (drawn in world space: left as is)
      const wy = o.y;
      let floor = top && o.depth > wy - 2 && o.depth - wy < 450 && Math.abs(o.depth) > 1 && o.depth < 60000 ? o.depth : NaN;
      if (Number.isNaN(floor)) { // no floor point of its own (an effect, a number): over the nearest fighter, else on the floor where drawn
        let best: { x: number; y: number } | null = null;
        for (const a of this.anchors) if (!best || Math.abs(a.x - o.x) < Math.abs(best.x - o.x)) best = a;
        floor = best && Math.abs(best.x - o.x) < 700 && wy <= best.y + 30 ? best.y : wy;
      }
      const P = this.project(o.x, floor, floor - wy);
      this.saved.push([o, o.x, o.y, o.scaleX, o.scaleY]);
      o.x = P.sx; o.y = P.sy; o.scaleX *= P.k; o.scaleY *= P.k;
    };
    for (const o of this.scene.children.list as Placed[]) visit(o, true);
  }

  /** The fighters' sun shadows: each body's frame, black and faint, laid on the floor from its feet away from the sun —
   *  a shear (built as a turned, scaled container round a turned image: any 2D linear map is R·S·R). */
  private shadeBodies(): void {
    const seen = new Set<Phaser.GameObjects.Sprite>(), S = this.sunShadow;
    const lit = 1 - 0.75 * this.dimNow;
    for (const { body, foot, z } of this.bodies) {
      if (!body.active || !foot.active) continue;
      seen.add(body);
      let e = this.shades.get(body);
      if (!e) {
        const im = this.scene.add.image(0, 0, body.texture.key, body.frame.name).setTintFill(0x000000);
        const c = this.scene.add.container(0, 0, [im]);
        const dark = this.scene.add.image(0, 0, body.texture.key, body.frame.name).setTintFill(0x000000);
        const lit = this.scene.add.image(0, 0, body.texture.key, body.frame.name).setTintFill(0xffffff).setBlendMode(Phaser.BlendModes.ADD);
        e = { c, im, dark, lit }; this.shades.set(body, e);
      }
      const on = body.visible && foot.visible && body.alpha > 0.05;
      e.c.setVisible(on); if (!on) { e.dark.setVisible(false); e.lit.setVisible(false); continue; }
      // the body takes the room's light: darker when the room darkens, washed in a blow's colour when one flares near it
      const copy = (o: Phaser.GameObjects.Image, depth: number) => o.setTexture(body.texture.key, body.frame.name).setOrigin(body.originX, body.originY).setFlipX(body.flipX)
        .setScale(body.scaleX, body.scaleY).setRotation(body.rotation).setPosition(body.x, body.y).setDepth(depth);
      const dk = 0.42 * this.dimNow * Math.min(1, body.alpha);
      copy(e.dark, body.depth + 0.0003).setAlpha(dk).setVisible(dk > 0.01);
      const bx = this.w3(body.x), by = this.h3(body.depth - body.y + 90), bz = this.d3(body.depth);
      let sum = 0, best = 0, col = 0xffffff;
      for (const h of this.hitLights) {
        if (h.L.intensity <= 0) continue;
        const d = Math.hypot(h.L.position.x - bx, h.L.position.y - by, h.L.position.z - bz), f = Math.max(0, 1 - d / h.L.distance), v = h.L.intensity * f * f;
        sum += v; if (v > best) { best = v; col = h.L.color.getHex(); }
      }
      const la = Math.min(0.32, sum / 80) * Math.min(1, body.alpha);
      copy(e.lit, body.depth + 0.0006).setAlpha(la).setTintFill(col).setVisible(la > 0.01);
      e.im.setTexture(body.texture.key, body.frame.name).setOrigin(body.originX, body.originY).setFlipX(body.flipX).setScale(body.scaleX, body.scaleY);
      // M = [[1, -a], [0, -b]] (a body point h px up lies at (+a·h, +b·h) from the feet) = R(φ)·diag(sx, sy)·R(θ)
      const m00 = 1, m01 = -S.a, m10 = 0, m11 = -S.b;
      const E = (m00 + m11) / 2, F = (m00 - m11) / 2, G = (m10 + m01) / 2, H = (m10 - m01) / 2;
      const Q = Math.hypot(E, H), R = Math.hypot(F, G), a1 = Math.atan2(G, F), a2 = Math.atan2(H, E);
      const th = (a2 - a1) / 2, h = Math.max(0, z), fade = Math.max(0, 1 - h / 320);
      // a body up in the air: its shadow slides away from the sun along the floor (the feet's own point, h px up, laid down)
      e.im.setRotation(th).setPosition(h * Math.sin(th), -h * Math.cos(th));
      e.c.setRotation((a2 + a1) / 2).setScale(Q + R, Q - R)
        .setPosition(foot.x, foot.y).setDepth(foot.depth - 0.02)
        .setAlpha(0.3 * lit * fade * Math.min(1, body.alpha));
    }
    for (const [b, e] of this.shades) if (!seen.has(b)) { e.c.destroy(); e.dark.destroy(); e.lit.destroy(); this.shades.delete(b); }
  }

  private restore(): void {
    for (let i = this.saved.length - 1; i >= 0; i--) { const [o, x, y, sx, sy] = this.saved[i]; o.x = x; o.y = y; o.scaleX = sx; o.scaleY = sy; }
    this.saved.length = 0;
  }

  private destroy(): void {
    this.restore();
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.apply, this);
    this.scene.events.off(Phaser.Scenes.Events.RENDER, this.restore, this);
    for (const b of [this.dustB, this.dustF, this.chipB, this.chipF, this.glowB, this.glowF]) b?.dispose();
    this.fx?.dispose();
    for (const e of this.shades.values()) { e.c.destroy(); e.dark.destroy(); e.lit.destroy(); }
    this.shades.clear();
    if (ImpactFx.screenOf) ImpactFx.screenOf = null;
    ImpactFx.drawnAt = null;
    this.room?.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
