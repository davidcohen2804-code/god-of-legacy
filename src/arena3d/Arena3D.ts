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
/** The camera: pitch / fov (deg), distance (3D units) and how it widens as the fighters part, the yaw it turns as the
 *  fight slides, how fast it follows, the look point's height; `liftK` / `liftMax`: how much of a jump's height the look
 *  point follows (px) — over the floor the focus stands on (`focus.floorZ`, followed fully: a world's upper floors). */
const CAM_ARENA = { pitch: 24, fov: 32, dist: 8.4, distPerSpan: 0.3, distMax: 14, yawMax: 11, follow: 0.12, aim: 0.5, liftK: 0.4, liftMax: 160 };
export type Cam3D = typeof CAM_ARENA;
/** A 3D place's content (the arena's courtyard, or a world map): built into the scene behind the fighters and the one in
 *  front of them, on the walkable floor given in units. Returns the same handles as the courtyard (its sun, its sky
 *  light, the lights that burn on in the dark, the floor's height, the petals' answers, its frame's work). */
export type BuildPlace = (scene: THREE.Scene, front: THREE.Scene, renderer: THREE.WebGLRenderer, F: { x0: number; x1: number; zB: number; zF: number }, soft: boolean) => Room;
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
  /** 3D layers of their own (the 3D hero test, ?hero3d=1): each drawn alone into its own picture, which is sorted
   *  among the 2D bodies at its depth (as a painted fighter is), under the railing. */
  private extra: { scene: THREE.Scene; key: string; img: Phaser.GameObjects.Image; before?: () => void }[] = [];
  /** The skills in the room's 3D: pillars, cracks and chunks, waves, domes, crystals, lightning, trails, slash arcs. */
  fx!: Fx3D;
  /** The blow felt on the whole picture (set by the scene: its ImpactFx). */
  onImpact?: (at: { x: number; y: number; z: number }, big: 0 | 1 | 2) => void;
  /** The place's life's moments, for their sound (PvP): 'birds' when the courtyard's flock is startled into the air, `at` in world px. */
  onLife?: (what: 'birds', at: { x: number; y: number; z: number }) => void;
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
  /** The camera (the arena's by default; a world map passes its own: e.g. nearer, following one player). */
  private CAM: Cam3D;
  private dist: number;
  /** The modelled courtyard (its light, its petals, its wind). */
  private room!: Room;
  /** The room's picture with a soft bloom (the lanterns, the doors, the blows' light glow into the air). */
  private composer?: EffectComposer;
  private sunBase = 0; private hemiBase = 0;
  /** The hits' light: a small pool of point lights, each placed on a hit and fading (the floor and the ground take it). */
  private hitLights: { L: THREE.PointLight; F: THREE.PointLight; left: number; ms: number; power: number; wash: number; /** its share on the planks (see flare) */ cut: number; /** where the blow is (its light is lifted over it) */ at: THREE.Vector3; /** its strength now, before the cut (the bodies' wash reads it) */ now: number }[] = [];
  /** The marks a heavy blow leaves on the floor (a soft dark scorch / dust ring, fading). */
  private marks: { m: THREE.Mesh; left: number; ms: number }[] = [];
  private markTex?: THREE.Texture;
  /** How dark the room is (0 = as painted, 1 = night): eased toward `dimWant`, set by the scene in a big moment. */
  private dimNow = 0;
  dimWant = 0;
  /** The room's answer to a blow: dust and wood chips (behind / in front of the fighters), embers (glowing, the same). */
  private dustB!: Bits; private dustF!: Bits; private chipB!: Bits; private chipF!: Bits; private glowB!: Bits; private glowF!: Bits;
  /** Rings of light running over the planks from a heavy blow / a body slammed down. */
  private rings: { m: THREE.Mesh; m2: THREE.Mesh; left: number; ms: number; r0: number; r1: number; a: number }[] = [];
  private ringTex?: THREE.Texture;
  /** A small push-in of the camera on a heavy blow (fades by itself). */
  private kick = 0;
  /** A jolt of the camera across the view on a heavy blow (units; the picture jumps the way the blow goes), springing back. */
  private nudge = 0;
  /** The fighters' feet last frame (world px) and the way run since the last puff: running and being driven back
   *  along the planks kick up dust (more, and wood grit, the faster). */
  private feet: { x: number; y: number; run: number; line?: number }[] = [];
  private t = 0;
  /** The fighters' midpoint and spread (world px), set by the scene each frame. */
  focus: { x: number; y: number; z: number; span: number; floorZ?: number } = { x: 0, y: 0, z: 0, span: 0 };
  /** A punch-in (1 = none), set by the scene (an ultimate, the K.O.). */
  punch = 1;
  /** A cinematic turn (deg round the fight, set by the scene): an ultimate's wind-up swings the camera round to face its
   *  caster; the K.O. drifts it slowly round the fallen. 0 = none. */
  swing = 0;
  private swingNow = 0;
  /** The fighters' floor points (world px), set by the scene: what floats without a floor of its own is drawn over the
   *  nearest of them. */
  anchors: { x: number; y: number; z?: number }[] = [];

  /** `opts.build`: the place to build (default: the arena's temple courtyard); `opts.cam`: camera settings over the arena's.
   *  The rest — the picture (bloom, shadows, the glow layer), placing the 2D world where this camera sees it, the fighters'
   *  sun shadows and light, the skills' 3D pieces, the blows' answers — is the same for any 3D place. */
  constructor(private scene: Phaser.Scene, private floor: Floor, opts: { build?: BuildPlace; cam?: Partial<Cam3D> } = {}) {
    this.CAM = { ...CAM_ARENA, ...opts.cam }; this.dist = this.CAM.dist; this.buildPlace = opts.build ?? buildRoom;
    const soft = !!(navigator as { webdriver?: boolean }).webdriver; // (test browsers render on the CPU: half size, no shadows)
    const res = soft ? 0.4 : RES, w = Math.round(scene.scale.width * res), h = Math.round(scene.scale.height * res);
    // one three.js canvas: the room is drawn into it, handed to Phaser (a GPU copy), then the railing, handed over too
    this.bgCanvas = document.createElement('canvas');
    this.fgCanvas = this.bgCanvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.bgCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true; // (the skills' pieces split round the fighters: behind them in the room, in front over them)
    this.camera = new THREE.PerspectiveCamera(this.CAM.fov, w / h, 0.5, 400);
    this.build(soft);
    this.soft = soft;
    this.makeComposer(w, h, soft ? 0 : 4); // (multisampled: the room's edges stay smooth)
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

  /** A 3D layer of its own (the 3D hero test): `sc` drawn alone each frame with the room's camera into its own picture,
   *  sorted among the 2D bodies by the returned image's depth (set it each frame), lit like the room (its sun, sky and
   *  the hits' lights mirrored, a soft fill from the camera's side). Returns the image and the sun's direction (world,
   *  towards the sun) for a cast shadow. */
  addLayer(key: string, sc: THREE.Scene): { img: Phaser.GameObjects.Image; sunDir: THREE.Vector3 } {
    const W = this.scene.scale.width, H = this.scene.scale.height;
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.textures.addImage(key, this.bgCanvas as unknown as HTMLImageElement);
    const img = this.scene.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDisplaySize(W, H);
    const sun = new THREE.DirectionalLight(), sunT = new THREE.Object3D(); sun.target = sunT;
    const hemi = new THREE.HemisphereLight();
    const fill = new THREE.DirectionalLight(0xffeedd, 1.1), fillT = new THREE.Object3D(); fill.target = fillT; // (a painted fighter reads lit from the front: so does this one, the low sun being behind the courtyard)
    const pts = this.hitLights.map(() => new THREE.PointLight(0xffffff, 0, 1, 1.6));
    sc.add(sun, sunT, hemi, fill, fillT, ...pts);
    sc.environment = this.scene3.environment; (sc as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.32;
    const sunDir = new THREE.Vector3(0, 1, 0);
    this.extra.push({ scene: sc, key, img, before: () => {
      const R = this.room;
      sun.color.copy(R.sun.color); sun.intensity = R.sun.intensity; sun.position.copy(R.sun.position); sunT.position.copy(R.sun.target.position); sunT.updateMatrixWorld();
      sunDir.copy(R.sun.position).sub(R.sun.target.position).normalize();
      hemi.color.copy(R.hemi.color); hemi.groundColor.copy(R.hemi.groundColor); hemi.intensity = R.hemi.intensity;
      fill.position.copy(this.camera.position).add(new THREE.Vector3(-3, 4, 0)); fillT.position.copy(this.look); fillT.updateMatrixWorld(); fill.intensity = 1.1 * (1 - 0.6 * this.dimNow);
      this.hitLights.forEach((h, i) => { const p = pts[i]; p.color.copy(h.L.color); p.intensity = h.L.intensity; p.distance = h.L.distance; p.decay = h.L.decay; p.position.copy(h.L.position); });
    } });
    return { img, sunDir };
  }

  /** The room's picture with a soft bloom, at w × h (the render's size) with `samples` of multisampling. */
  private makeComposer(w: number, h: number, samples: number): void {
    this.composer?.dispose();
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples }));
    this.composer.addPass(new RenderPass(this.scene3, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(Math.round(w / 2), Math.round(h / 2)), 0.5, 0.55, 0.86));
    this.composer.addPass(new OutputPass());
    const ps = h / (2 * Math.tan(THREE.MathUtils.degToRad(this.CAM.fov / 2))); // (a particle's size in units → px at 1 unit away)
    for (const b of [this.dustB, this.dustF, this.chipB, this.chipF, this.glowB, this.glowF]) b.setScale(ps);
  }

  private buildPlace: BuildPlace;
  /** Test browsers (CPU drawing): a smaller picture, no multisampling. */
  private soft = false;
  /** The frame time watched over the first fights: a slow computer gets a lighter room (smaller render, no
   *  multisampling; then no shadows) so the fight stays smooth. */
  private quality = { level: 0, ema: 16, t: 0 };
  private watchFrames(ms: number): void {
    const Q = this.quality;
    if (this.soft || Q.level >= 2 || ms <= 0 || ms > 250) return;
    Q.ema += (ms - Q.ema) * 0.04; Q.t += ms;
    if (Q.t < 4000 || Q.ema <= 21.5) return;
    Q.level++; Q.t = 0; Q.ema = 16;
    const res = Q.level === 1 ? 0.7 : 0.58, W = this.scene.scale.width, H = this.scene.scale.height, w = Math.round(W * res), h = Math.round(H * res);
    this.renderer.setSize(w, h, false);
    this.makeComposer(w, h, 0);
    if (Q.level === 2) this.renderer.shadowMap.enabled = false;
    for (const [k, img] of [['arena3d-bg', this.bg], ['arena3d-fg', this.fg], ['arena3d-fx', this.fxImg], ...this.extra.map((l) => [l.key, l.img] as const)] as const) {
      this.scene.textures.remove(k); this.scene.textures.addImage(k, this.bgCanvas as unknown as HTMLImageElement); img.setTexture(k).setDisplaySize(W, H);
    }
    console.info(`[PVP 3D] lighter room (level ${Q.level}): render ${w}×${h}`);
  }

  // ------------------------------------------------------------------ the room

  private w3 = (x: number) => x / U;
  private d3 = (y: number) => (y / U) * DEPTH_K;
  private h3 = (z: number) => (z / U) * HEIGHT_K;

  private build(soft: boolean): void {
    const F = this.floor;
    this.room = this.buildPlace(this.scene3, this.front3, this.renderer, { x0: this.w3(F.x0), x1: this.w3(F.x1), zB: this.d3(F.back), zF: this.d3(F.front) }, soft);
    this.room.onLife = (what, at) => this.onLife?.(what, at);
    this.sunBase = this.room.sun.intensity; this.hemiBase = this.room.hemi.intensity;
    { // the sun's shadow: per unit of height, how far it lies on the floor (x, toward the camera) — and how that looks
      const d = this.room.sun.position.clone().sub(this.room.sun.target.position).normalize(), up = Math.max(0.2, d.y);
      const fx = -d.x / up, fz = -d.z / up, p = Phaser.Math.DegToRad(this.CAM.pitch);
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
      this.scene3.add(L); this.front3.add(F); this.hitLights.push({ L, F, left: 0, ms: 1, power: 0, wash: 1, cut: 1, at: new THREE.Vector3(), now: 0 });
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
      texture: (key) => this.gameTexture(key),
    });
  }

  /** One of the game's loaded pictures as a 3D texture (the skills' real pieces: the Gambler's cards), cached. */
  private gameTex = new Map<string, THREE.Texture>();
  private gameTexture(key: string): THREE.Texture | null {
    const had = this.gameTex.get(key); if (had) return had;
    if (!this.scene.textures.exists(key)) return null;
    const img = this.scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
    this.gameTex.set(key, t); return t;
  }

  /** A flare of light at a point (units) from the hit lights' pool; `wash`: how much it washes the fighters' bodies in its
   *  colour (1: a blow's flash on the struck one; a skill's own light much less — a buff's halo washed the samurai flat
   *  gold, so in front of it he read as a hole: the Samurai chat). */
  private flare(hx: number, hy: number, hz: number, color: number, power: number, dist: number, ms: number, wash = 0.35): void {
    if (!Number.isFinite(hx) || !Number.isFinite(hy) || !Number.isFinite(hz) || !Number.isFinite(power)) return; // (a light at NaN poisons every lit pixel, and the bloom spreads it: a black frame)
    // (DFO 19 Oct: one blow lit three lights at one spot — the room's, its impact's, its cracks' — low over the glossy planks:
    //  together they burnt a white hot spot and a white sheen streak into the red floor, the blow's own colour clipped to
    //  white under every big hit. One light a blow now: a flare inside a stronger one still burning adds nothing, a stronger
    //  one takes its place. And it is lifted over the blow, its share on the planks capped: the floor takes its colour in a
    //  pool that never clips, a heavier blow's pool wider, not whiter; the bodies' wash still reads its full strength.)
    const near = this.hitLights.find((h) => h.left > 0 && Math.hypot(h.at.x - hx, h.at.z - hz) < 1.6);
    if (near && near.now >= power) { near.wash = Math.max(near.wash, wash); return; }
    const slot = near ?? this.hitLights.reduce((a, b) => (b.left < a.left ? b : a));
    const up = Math.max(hy, 1.3), cap = 2.6 + power * 0.06, hsl = { h: 0, s: 0, l: 0 }, c = new THREE.Color(color);
    c.getHSL(hsl, THREE.SRGBColorSpace); c.setHSL(hsl.h, Math.min(1, hsl.s * 1.15 + 0.05), Math.min(0.55, hsl.l), THREE.SRGBColorSpace); // (its colour, not its white: what the planks show)
    for (const L of [slot.L, slot.F]) { L.color.copy(c); L.distance = dist * 1.15; L.position.set(hx, up, hz); }
    slot.at.set(hx, hy, hz); slot.cut = Math.min(1, cap / (power / Math.pow(up, 1.6)));
    slot.left = ms; slot.ms = ms; slot.power = power; slot.wash = near ? Math.max(near.wash, wash) : wash; slot.now = power;
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
    this.flare(this.w3(x), this.h3(Math.max(40, z)) + 0.35, this.d3(y) + 0.25, color, P.power, P.dist, P.ms, 1);
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
    if (big === 2) this.ring(hx, hz, mix(color, 0xffffff, 0.35), 2.6, 260, 0.45); // (its inner ring in its own colour, lighter: a white one painted a white plate on the planks)
    this.blowPetals(hx, hy, hz, big === 2 ? 5 : 3.2, big === 2 ? 5.5 : 3.2);
    this.kick = Math.max(this.kick, big === 2 ? 0.07 : 0.035);
    // the picture jumps the way the blow goes (from the other fighter to the struck one)
    let foe: { x: number } | null = null, near = Infinity;
    for (const a of this.anchors) { const d = Math.hypot(a.x - x, a.y - y); if (d > 40 && d < near) { near = d; foe = a; } }
    if (foe) this.nudge = -Math.sign(x - foe.x || 1) * (big === 2 ? 0.09 : 0.05);
    this.room.gust(big === 2 ? 1 : 0.3, foe ? Math.sign(x - foe.x || 1) : 1); // (the courtyard feels it: the crowns bend, petals stream)
  }

  /** A gust through the courtyard (the K.O.'s last blow): the crowns bend and shed their petals. */
  gust(strength: number, dir: number): void { this.room.gust(strength, dir); this.kick = Math.max(this.kick, 0.05); }

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
      (Math.sin(a) > 0 ? this.dustF : this.dustB).emit(hx + Math.cos(a) * 0.2, 0.12 + r() * 0.12, hz + Math.sin(a) * 0.15, Math.cos(a) * out, 0.12 + r() * 0.25, Math.sin(a) * out * 0.75, [0x9a7c68, 0x8c705e, 0xa68a74][i % 3], (0.4 + r() * 0.3) * k, 600 + r() * 500, { a: 0.14 + r() * 0.08, grow: (1 + r() * 0.9) * k, drag: 0.3 }); // (the planks' own wood dust, darker than it was: the pale puffs bloomed into a white haze over the foe — the Gambler chat's report)
    }
  }

  /** A ring of light running out over the planks (units): from a little round the point to `r1`, fading. */
  private ring(hx: number, hz: number, color: number, r1: number, ms: number, a: number): void {
    if (!this.ringTex) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 63);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, 'rgba(255,255,255,0)'); gr.addColorStop(0.93, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); // (a crisp band: a broad one read as a big translucent disc over the planks)
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); this.ringTex = new THREE.CanvasTexture(c);
    }
    // (DFO 18 Oct, David 20:49 "not professional": an added ring went white on the red planks — painted in its colour now,
    //  a thin added light along its crest)
    const hsl = { h: 0, s: 0, l: 0 }, vivid = new THREE.Color(color); vivid.getHSL(hsl); vivid.setHSL(hsl.h, Math.min(1, hsl.s * 1.2 + 0.1), Math.min(0.62, Math.max(0.45, hsl.l)));
    const mat = new THREE.MeshBasicMaterial({ map: this.ringTex, transparent: true, depthWrite: false, color: vivid, opacity: a, fog: false });
    const mat2 = new THREE.MeshBasicMaterial({ map: this.ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(mix(color, 0xffffff, 0.4)), opacity: a * 0.35, fog: false });
    const geo = new THREE.PlaneGeometry(1, 1), m = new THREE.Mesh(geo, mat), m2 = new THREE.Mesh(geo, mat2);
    for (const x of [m, m2]) { x.rotation.x = -Math.PI / 2; x.position.set(hx, x === m ? 0.02 : 0.021, hz); this.scene3.add(x); }
    this.rings.push({ m, m2, left: ms, ms, r0: 0.3, r1, a });
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
      if (h.left <= 0) { h.L.intensity = h.F.intensity = h.now = 0; continue; }
      h.left -= ms; const k = Math.max(0, h.left / h.ms);
      h.now = h.power * (k * k * (3 - 2 * k)); h.L.intensity = h.F.intensity = h.now * h.cut; // (a fast flare, a soft fade)
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
      const op = g.a * (1 - k) * (1 - k * 0.3);
      g.m.scale.set(s * 2, s * 2, 1); g.m2.scale.set(s * 2, s * 2, 1); (g.m.material as THREE.MeshBasicMaterial).opacity = op * 0.85; (g.m2.material as THREE.MeshBasicMaterial).opacity = op * 0.35;
      if (g.left <= 0) { this.scene3.remove(g.m, g.m2); g.m.geometry.dispose(); (g.m.material as THREE.Material).dispose(); (g.m2.material as THREE.Material).dispose(); this.rings.splice(i, 1); }
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
    this.watchFrames(ms);
    this.stepFx(fxMs);
    this.fx.update(fxMs, this.flying);
    const f = this.focus, F = this.floor, k = Math.min(1, (ms / 16) * this.CAM.follow);
    const fz = f.floorZ ?? 0, want = new THREE.Vector3(this.w3(f.x), this.h3(fz + Math.min(this.CAM.liftMax, Math.max(0, f.z - fz) * this.CAM.liftK)) + this.CAM.aim, this.d3(f.y));
    this.look.lerp(want, this.look.lengthSq() ? k : 1);
    const cx = (F.x0 + F.x1) / 2, half = Math.max(1, (F.x1 - F.x0) / 2);
    this.yaw += ((-Phaser.Math.Clamp((f.x - cx) / half, -1, 1) * this.CAM.yawMax) - this.yaw) * k;
    this.swingNow += (this.swing - this.swingNow) * Math.min(1, ms / (Math.abs(this.swing) > Math.abs(this.swingNow) ? 260 : 180)); // (swings in, snaps back on the release)
    this.dist += (Math.min(this.CAM.distMax, this.CAM.dist + this.w3(f.span) * this.CAM.distPerSpan) / this.punch - this.dist) * k;
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
      const px = f.x, py = f.y, d = Math.hypot(a.x - f.x, a.y - f.y), v = (d * 1000) / ms; f.x = a.x; f.y = a.y;
      if (d > 140 || (a.z ?? 0) > 3 || v < 330) { f.run = 0; return; } // (a teleport, in the air, or walking)
      if (v > 700 && d > 2) { // a dash: white speed lines on the floor behind him (David's reference, the hammer girl's dash)
        const ux = (a.x - px) / d, uy = (a.y - py) / d, side = (Math.random() - 0.5) * 26;
        if ((f.line = (f.line ?? 0) + d) > 26) { f.line = 0; const L = Math.min(150, 60 + v * 0.08); this.fx.floorStreak(a.x - ux * L - uy * side, a.y - uy * L * 0.6 + ux * side * 0.4, a.x - ux * 18 - uy * side, a.y - uy * 18 * 0.6 + ux * side * 0.4, 0xffffff, { w: 5 + Math.random() * 4, ms: 150 + Math.random() * 60 }); }
      }
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

  /** Straight onto the focus (no glide): a world's arrival, a new map — `dist` (3D units) to start wider or closer than
   *  the camera's own (it eases back to its own as it follows). */
  snap(dist?: number): void {
    const f = this.focus, fz = f.floorZ ?? 0;
    this.dist = dist ?? Math.min(this.CAM.distMax, this.CAM.dist + this.w3(f.span) * this.CAM.distPerSpan);
    this.look.set(this.w3(f.x), this.h3(fz + Math.min(this.CAM.liftMax, Math.max(0, f.z - fz) * this.CAM.liftK)) + this.CAM.aim, this.d3(f.y));
    this.place(false);
  }

  private place(snap: boolean): void {
    if (snap) { const f = this.focus; this.look.set(this.w3(f.x), this.CAM.aim, this.d3(f.y)); }
    const p = Phaser.Math.DegToRad(this.CAM.pitch - Math.abs(this.swingNow) * 0.25), y = Phaser.Math.DegToRad(this.yaw + this.swingNow), d = this.dist / (1 + this.kick);
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
    for (const l of this.extra) { l.before?.(); this.renderer.setClearColor(0x000000, 0); this.renderer.render(l.scene, this.camera); this.scene.textures.get(l.key).source[0].update(); }
    // every world object: placed where the 3D camera sees its floor point, scaled by its depth
    const sw = this.scene.scale.width;
    const visit = (o: Placed, top: boolean) => {
      if (!o.visible || o === (this.bg as unknown) || o === (this.fg as unknown) || o === (this.fxImg as unknown) || o.scrollFactorX === 0) return;
      if (o instanceof Phaser.GameObjects.Container && o.x === 0 && o.y === 0) { for (const c of o.list as Placed[]) visit(c, false); return; }
      if ((o.displayWidth ?? 0) > sw * 0.6) return; // screen-sized overlays (a darkening, a cut-in band) stay where they are drawn
      if (o instanceof Phaser.GameObjects.Graphics && o.x === 0 && o.y === 0) return; // (drawn in world space: left as is)
      const wy = o.y;
      let floor = top && o.depth > wy - 2 && o.depth - wy < 450 && Math.abs(o.depth) > 1 && o.depth < 60000 ? o.depth : NaN;
      // the ground layer (depth 2–10: the skills' floor marks, rings, craters, mines, roots): it lies on the floor where it
      // is drawn — anchored over the nearest fighter, a mine lying behind him rose into the air (the Archer chat's report)
      if (Number.isNaN(floor) && o.depth >= 2 && o.depth <= 10) floor = wy;
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
        if (h.now <= 0) continue;
        const d = Math.hypot(h.at.x - bx, h.at.y - by, h.at.z - bz), f = Math.max(0, 1 - d / (h.L.distance / 1.15)), v = h.now * f * f * h.wash;
        sum += v; if (v > best) { best = v; col = h.L.color.getHex(); }
      }
      const la = Math.min(0.26, sum / 80) * Math.min(1, body.alpha);
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

  /** Tear the place down now (a world crossing builds the next one): its 3D, its three layers on the scene, its hooks. */
  dispose(): void {
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.destroy();
    for (const img of [this.bg, this.fg, this.fxImg]) img?.destroy();
    for (const k of ['arena3d-bg', 'arena3d-fg', 'arena3d-fx', ...this.extra.map((l) => l.key)]) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    for (const l of this.extra) l.img.destroy();
  }

  private disposed = false;
  private destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.restore();
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.apply, this);
    this.scene.events.off(Phaser.Scenes.Events.RENDER, this.restore, this);
    for (const b of [this.dustB, this.dustF, this.chipB, this.chipF, this.glowB, this.glowF]) b?.dispose();
    this.fx?.dispose();
    for (const t of this.gameTex.values()) t.dispose();
    this.gameTex.clear();
    for (const e of this.shades.values()) { e.c.destroy(); e.dark.destroy(); e.lit.destroy(); }
    this.shades.clear();
    if (ImpactFx.screenOf) ImpactFx.screenOf = null;
    ImpactFx.drawnAt = null;
    this.room?.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // (the WebGL context goes with the stage: a browser keeps ~16 — a world of map crossings, or a night of fights, would lose the game's own)
  }
}
