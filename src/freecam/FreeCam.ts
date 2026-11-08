// THE FREE-CAMERA TRIAL (David 8 Nov 23:38: "build a small trial and let's see" — the game as a 3D MMO with a camera
// like Dekaron's and play with the mouse). GPT's direction (8 Nov): two control modes to compare on the same map and
// hero — A: click the ground to run, click a foe to target it and keep attacking, skills on 1–3; B: W A S D and direct
// aim with the mouse — one big foe whose blows are marked on the floor first, two allies beside the hero, and the hero
// seen from every side with an outfit swap. The camera: behind and above the hero (5.5 × his height, 35°), turned with
// the right mouse button all the way round, zoomed with the wheel (3–9 × his height, 22°–60°), never turning by itself;
// the wheel's click (or C) brings it behind him. Its own page (?freecam): the game itself is untouched.
// The place is the Temple Road's 3D place (the game's own: src/world3d/maps/temple.ts) with the Sun Seal Plaza below it;
// the bodies are the game's 3D Beginners (Hero3D) — a stand-in for the camera and the controls, not the final look.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { MAPS } from '../world3d/maps';
import { AREAS, ARENA, WORLD_FLOOR, worldObjects } from '../world/Areas';
import { setWorldGeometry, footAllowed } from '../world/WorldGeometry';
import { Hero3D, type WeaponId } from '../arena3d/Hero3D';
import { Fx3D, type FxHost, type V3 } from '../arena3d/Fx3D';
import type { Room } from '../arena3d/Room';
import type { Equip3D } from '../arena3d/items3d';
import { finalSkill, iconUrl } from '../skills/FinalKit';
import type { FinalSkill, HitEvent } from '../skills/SkillTypes';
import type { Projectile } from '../skills/HitGeometry';
import { Slime, KingSlime, SLIME_KINDS, type FoeCtx } from './Foes';
import { Hud, type ModeId, type PlateView } from './Hud';
import { Flares, Rings, Sparks } from './RoomFx';

const U = 100, DK = 1.15;
const H = Hero3D.HEIGHT;
/** GPT's camera (8 Nov): distance and zoom in the hero's heights, pitch in degrees. */
const CAM = { dist: 5.5 * H, min: 3 * H, max: 9 * H, pitch: 35, pitchMin: 22, pitchMax: 60, fov: 42 };
const RUN = 3.1; // units / s
const AREA = 'temple';

type Who = 'hero' | 'kael' | 'lyra';
interface Skill { key: string; id: string; name: string; cd: number; left: number; range: number }
interface Cast { skill: Skill; anim: string; elapsed: number; startup: number; active: number; recovery: number; stage: number; fired: number; target: Slime | null; aim: THREE.Vector3; hitIds: Set<number> }
interface Body {
  id: Who; name: string; sub: string; hero: Hero3D; x: number; z: number; y: number; yaw: number; vx: number; vz: number;
  hp: number; max: number; cast: Cast | null; hurtMs: number; downMs: number; lastHit: number;
}
interface Shot { p: Projectile; pos: THREE.Vector3; vel: THREE.Vector3; target: Slime | null; skill: FinalSkill; fire: boolean; dmg: [number, number]; travelled: number; range: number; mesh: THREE.Object3D; done: boolean; cast: Cast }
interface Zone { x: number; z: number; r: number; left: number; next: number; ticks: number; skill: FinalSkill }

const OUTFITS: { name: string; e: Equip3D }[] = [
  { name: 'Sylvan Ranger', e: { weapon: 'a_sylvan_wing', hat: 'a_cap', cloak: 'a_leafcloak', top: 'a_jerkin', bottom: 'a_leggings', shoes: 'a_boots' } },
  { name: 'Beginner', e: {} },
  { name: 'Starfall Traveller', e: { weapon: 'a_sylvan_wing', hat: 'm_hat', cloak: 'm_cloak', top: 'm_robe', bottom: 'm_trousers', shoes: 'm_boots' } },
  { name: 'High Roller', e: { weapon: 'a_sylvan_wing', hat: 'g_tophat', cloak: 'g_cape', top: 'g_vest', bottom: 'g_trousers', shoes: 'g_shoes' } },
];
const KAEL: Equip3D = { weapon: 'w_dragonfang', hat: 'w_helm', cloak: 'w_cape', top: 'w_tunic', bottom: 'w_breeches', shoes: 'w_boots' };
const LYRA: Equip3D = { weapon: 'm_astral_staff', hat: 'm_hat', cloak: 'm_cloak', top: 'm_robe', bottom: 'm_trousers', shoes: 'm_boots' };
const FIRE = 0xff7a2a, SUN = 0xffd27a, ARCANE = 0x9a7bff, STEEL = 0xffb04a;

function floorOf(id: string): { x0: number; x1: number; back: number; front: number } {
  const a = AREAS[id], xs = a.walk.map((p) => p[0]), ys = a.walk.map((p) => p[1]);
  const left = Math.min(...xs), backPts = a.walk.filter((p) => p[0] <= left + 1).map((p) => p[1]);
  return { x0: a.x + left, x1: a.x + Math.max(...xs), back: backPts.length ? Math.min(...backPts) : Math.min(...ys), front: Math.max(...ys) };
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** An arrow: a wooden shaft, a steel head, three fletchings (built along +z); the fire arrow glows. */
function arrowMesh(fire: boolean): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.62, 6), new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.7 }));
  shaft.rotation.x = Math.PI / 2; g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 8), new THREE.MeshStandardMaterial({ color: fire ? 0xffb060 : 0xd8dde4, metalness: 0.7, roughness: 0.3, emissive: fire ? 0xff5a10 : 0x000000, emissiveIntensity: fire ? 1.2 : 0 }));
  head.rotation.x = Math.PI / 2; head.position.z = 0.35; g.add(head);
  const fm = new THREE.MeshStandardMaterial({ color: fire ? 0xff8a3a : 0x7fbf4a, side: THREE.DoubleSide, roughness: 0.8 });
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.13), fm); f.position.z = -0.25; f.rotation.set(Math.PI / 2, (i * Math.PI * 2) / 3, 0); f.translateX(0.025); g.add(f); }
  if (fire) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.35, 'rgba(255,140,40,0.9)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.scale.setScalar(0.55); sp.position.z = 0.3; g.add(sp);
  }
  return g;
}

export class FreeCam {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private front = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private room!: Room;
  private fx!: Fx3D;
  private flares: Flares; private rings: Rings; private glow: Sparks; private dust: Sparks;
  private hud: Hud;
  private soft = !!(navigator as { webdriver?: boolean }).webdriver;
  private focus = { x: 0, z: 0 };
  private zFront = 0;
  private bodies: Body[] = [];
  private me!: Body;
  private foes: Slime[] = [];
  private king!: KingSlime;
  private shots: Shot[] = [];
  private zones: Zone[] = [];
  private t = 0; private last = 0;
  private mode: ModeId = 'A';
  // the camera
  yaw = 0; pitch = CAM.pitch; private dist = CAM.dist; private wantDist = CAM.dist; private camDist = CAM.dist;
  private look = new THREE.Vector3(); private kick = 0; private recenter: number | null = null;
  private view: { yaw0: number; t: number } | null = null; private outfit = 0;
  // input
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, left: false, right: false, lastX: 0, lastY: 0, inside: false };
  private ndc = new THREE.Vector2(); private ray = new THREE.Raycaster();
  private moveTo: THREE.Vector3 | null = null; private holdMove = false;
  private target: Slime | null = null; private attacking = false; private queued: Skill | null = null; private shooting = false;
  private hover: Slime | null = null;
  private skills: Skill[] = [];
  private tgRing: THREE.Mesh; private tele: { base: THREE.Mesh; fill: THREE.Mesh; edge: THREE.Mesh };
  private allyBrain = new Map<Who, { home: THREE.Vector3; angle: number; cd: number; stage: number }>();

  constructor(parent: HTMLElement) {
    parent.innerHTML = '';
    document.getElementById('ambient')?.remove();
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: this.soft });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;outline:none;touch-action:none;';
    parent.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.1, 500);
    this.flares = new Flares(this.scene); this.rings = new Rings(this.scene);
    this.glow = new Sparks(220, 0.6, true); this.dust = new Sparks(160, 0.12, false); this.scene.add(this.glow.pts, this.dust.pts);
    this.hud = new Hud(document.body);
    this.hud.onMode = (m) => this.setMode(m);
    // the target's ring and the king's mark on the floor
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    this.tgRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48, 1), ringMat); this.tgRing.rotation.x = -Math.PI / 2; this.tgRing.renderOrder = 4; this.tgRing.visible = false; this.scene.add(this.tgRing);
    const tmat = (o: number) => new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.tele = { base: new THREE.Mesh(new THREE.CircleGeometry(1, 64), tmat(0.16)), fill: new THREE.Mesh(new THREE.CircleGeometry(1, 64), tmat(0.26)), edge: new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 64, 1), tmat(0.9)) };
    for (const m of Object.values(this.tele)) { m.rotation.x = -Math.PI / 2; m.renderOrder = 4; m.visible = false; this.scene.add(m); }
    this.resize();
    window.addEventListener('resize', () => this.resize());
    void this.start();
  }

  // ------------------------------------------------------------------ setting up

  private async start(): Promise<void> {
    try {
      const fl = floorOf(AREA);
      const F = { x0: fl.x0 / U, x1: fl.x1 / U, zB: (fl.back / U) * DK, zF: (fl.front / U) * DK };
      this.zFront = F.zF;
      setWorldGeometry(WORLD_FLOOR, worldObjects());
      this.focus = { x: 225.8, z: 21.6 };
      this.room = MAPS[AREA](this.focus)(this.scene, this.front, this.renderer, F, this.soft);
      this.front.fog = this.scene.fog; // (the front layer's pieces are drawn after the room, with the room's depth: one picture)
      this.makeComposer();
      this.fx = new Fx3D(this.host());
      this.hud.loading(0.08, 'Loading the party…');
      const prog = [0, 0, 0], tick = (i: number) => (k: number) => { prog[i] = k; this.hud.loading(0.08 + 0.8 * ((prog[0] + prog[1] + prog[2]) / 3)); };
      const [h, k, l] = await Promise.all([Hero3D.load({}, tick(0)), Hero3D.load({}, tick(1)), Hero3D.load({ female: true }, tick(2))]);
      this.me = this.addBody('hero', 'Archer', 'You · Lv.10', h, 225.8, 21.6, Math.PI, 'bow', 820);
      this.addBody('kael', 'Kael', 'Warrior · ally', k, 222.2, 19.4, Math.PI * 0.8, 'sword', 1400);
      this.addBody('lyra', 'Lyra', 'Mage · ally', l, 228.6, 19.8, -Math.PI * 0.8, 'staff', 1000);
      this.allyBrain.set('kael', { home: new THREE.Vector3(222.2, 0, 19.4), angle: -2.4, cd: 600, stage: 0 });
      this.allyBrain.set('lyra', { home: new THREE.Vector3(228.6, 0, 19.8), angle: 2.2, cd: 900, stage: 0 });
      this.hud.loading(0.92, 'Dressing the party…');
      await Promise.all([h.equipAll(OUTFITS[0].e), k.equipAll(KAEL), l.equipAll(LYRA)]);
      h.setWeapon('bow'); k.setWeapon('sword'); l.setWeapon('staff');
      // the foes: jellies round the plaza, their king on the sun seal
      const homes: [number, number][] = [[219.4, 13.2], [222.4, 12.4], [230.6, 13.4], [233.8, 15.6], [216.6, 17.6], [233.2, 20.6], [218.8, 21.6], [226.6, 13.6]];
      homes.forEach(([x, z], i) => this.addFoe(new Slime(SLIME_KINDS[i % 3], { x, z })));
      this.king = new KingSlime({ x: 225.0, z: 16.6 }); this.addFoe(this.king);
      // the skills: the game's own archer (names, icons, timings)
      const S = (key: string, id: string, cd: number, range: number): Skill => ({ key, id, name: finalSkill(id)?.name ?? id, cd, left: 0, range });
      this.skills = [S('LMB', 'quick_shot', 0, 8.5), S('1', 'multi_shot', 2800, 8.5), S('2', 'explosive_arrow', 6000, 9.5), S('3', 'arrow_storm', 12000, 8.5)];
      this.hud.skills(this.skills.map((s) => ({ key: s.key, name: s.name, icon: iconUrl(finalSkill(s.id)!), left: 0, total: 1, on: false })));
      this.yaw = 0; this.look.set(this.me.x, this.me.y + 1.15, this.me.z);
      this.fx.warm(this.renderer);
      this.bindInput();
      this.setMode('A');
      this.hud.loading(1);
      this.last = performance.now();
      this.renderer.setAnimationLoop(() => this.frame());
      this.hud.ready();
      setTimeout(() => this.hud.toast('The King Jelly waits on the sun seal — strike it to start the fight', 4200), 700);
      (window as unknown as { __freecam: FreeCam }).__freecam = this;
    } catch (e) {
      console.error(e);
      this.hud.fail(`Could not start: ${(e as Error).message}`);
    }
  }

  private addBody(id: Who, name: string, sub: string, hero: Hero3D, x: number, z: number, yaw: number, weapon: WeaponId, max: number): Body {
    hero.setWeapon(weapon);
    this.scene.add(hero.scene);
    const b: Body = { id, name, sub, hero, x, z, y: 0, yaw, vx: 0, vz: 0, hp: max, max, cast: null, hurtMs: 0, downMs: 0, lastHit: -1e9 };
    this.bodies.push(b);
    return b;
  }
  private addFoe(f: Slime): void { this.foes.push(f); this.scene.add(f.root); }

  private makeComposer(): void {
    const w = this.renderer.domElement.width, h = this.renderer.domElement.height;
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.soft ? 0 : 4 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const fp = new RenderPass(this.front, this.camera); fp.clear = false; this.composer.addPass(fp);
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(Math.round(w / 2), Math.round(h / 2)), 0.5, 0.55, 0.86));
    this.composer.addPass(new OutputPass());
  }

  private resize(): void {
    const k = this.soft ? 0.5 : Math.min(window.devicePixelRatio || 1, 1.25);
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(k); this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100vw'; this.renderer.domElement.style.height = '100vh';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const Hh = Math.round(h * k);
    this.composer?.setSize(Math.round(w * k), Hh);
    const s = Hh / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)));
    this.glow.setScale(s); this.dust.setScale(s);
  }

  /** What the game's 3D skill pieces are lent: this scene, this camera, the units, the room's answers. */
  private host(): FxHost {
    return {
      back: this.scene, solid: this.front, glow: this.front, camera: this.camera,
      w3: (x) => x / U, d3: (y) => (y / U) * DK, h3: (z) => z / U,
      flare: (hx, hy, hz, color, power, dist, ms) => this.flares.flare(hx, hy, hz, color, power, dist, ms),
      dust: (hx, hz, n, k) => { for (let i = 0; i < n; i++) this.dust.emit(hx + rnd(-0.2, 0.2), this.ground(hx, hz) + 0.05, hz + rnd(-0.2, 0.2), rnd(-0.6, 0.6) * k, rnd(0.2, 0.6) * k, rnd(-0.6, 0.6) * k, 0xcdb39c, rnd(0.25, 0.45) * k, rnd(500, 900), { a: 0.22, grow: 0.9, drag: 0.4 }); },
      embers: (hx, hy, hz, color, n, speed) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, up = 0.3 + Math.random() * 0.7, sp = speed * (0.5 + Math.random() * 0.8); this.glow.emit(hx, hy, hz, Math.cos(a) * sp * (1 - up * 0.5), up * sp, Math.sin(a) * sp * (1 - up * 0.5), color, 0.06 + Math.random() * 0.07, 380 + Math.random() * 500, { grav: 7, drag: 0.55 }); } },
      ring: (hx, hz, color, r1, ms, a) => this.rings.ring(hx, this.ground(hx, hz), hz, color, r1, ms, a),
      blow: (hx, hy, hz, R, s) => this.room.blow(hx, hy, hz, R, s),
      kick: (a) => { this.kick = Math.max(this.kick, a); },
      casterPos: () => (this.me ? { x: this.me.x * U, y: (this.me.z / DK) * U, z: 0 } : null),
      impact: () => { /* (the picture's own bend: the game's PvP screen pass — not in this trial) */ },
    };
  }

  // ------------------------------------------------------------------ the floor

  /** The ground's height (units) at (x, z): the plaza and the causeway down to it lie at the road's height. */
  ground(x: number, z: number): number {
    const px0 = ARENA.x / U, px1 = (ARENA.x + ARENA.w) / U, pz0 = (ARENA.y / U) * DK, pz1 = ((ARENA.y + ARENA.h) / U) * DK;
    if (x > px0 - 0.4 && x < px1 + 0.4 && z > pz0 - 0.3 && z < pz1 + 0.4) return 0;
    if (x > ARENA.stairs[0] / U - 0.3 && x < ARENA.stairs[1] / U + 0.3 && z > this.zFront - 0.3 && z <= pz0) return 0;
    return this.room.groundY(x, z);
  }
  /** May a body stand at (x, z)? (the game's own floor and props) */
  free(x: number, z: number, r = 16): boolean { return footAllowed(x * U, (z / DK) * U, 0, r); }

  /** Where the mouse points on the ground (the ray walked until it meets the floor), or null. */
  private groundAt(cx: number, cy: number): THREE.Vector3 | null {
    this.ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction, p = new THREE.Vector3();
    let prev = 0;
    for (let t = 0.3; t < 140; t += t < 20 ? 0.12 : 0.4) {
      p.copy(o).addScaledVector(d, t);
      const g = this.ground(p.x, p.z);
      if (p.y <= g && g > -5) {
        let a = prev, b = t;
        for (let i = 0; i < 8; i++) { const m = (a + b) / 2; p.copy(o).addScaledVector(d, m); if (p.y <= this.ground(p.x, p.z)) b = m; else a = m; }
        p.copy(o).addScaledVector(d, b); p.y = this.ground(p.x, p.z);
        return p;
      }
      prev = t;
    }
    return null;
  }
  private foeAt(cx: number, cy: number): Slime | null {
    this.ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hits = this.ray.intersectObjects(this.foes.filter((f) => f.alive).map((f) => f.pick), false);
    return hits.length ? (hits[0].object.userData.foe as Slime) : null;
  }

  // ------------------------------------------------------------------ input

  private bindInput(): void {
    const cv = this.renderer.domElement;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.lastX = e.clientX; this.mouse.lastY = e.clientY;
      if (e.button === 2) { this.mouse.right = true; return; }
      if (e.button === 1) { e.preventDefault(); this.recenter = this.me.yaw + Math.PI; return; }
      if (e.button !== 0) return;
      this.mouse.left = true;
      if (this.view) this.endView();
      if (this.mode === 'A') {
        const f = this.foeAt(e.clientX, e.clientY);
        if (f) { this.target = f; this.attacking = true; this.moveTo = null; this.holdMove = false; return; }
        const g = this.groundAt(e.clientX, e.clientY);
        if (g) { this.moveTo = g; this.holdMove = true; this.attacking = false; this.queued = null; this.rings.ring(g.x, g.y, g.z, 0x9be35a, 0.42, 420, 0.95); }
      } else this.shooting = true;
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.mouse.right) {
        const dx = e.clientX - this.mouse.lastX, dy = e.clientY - this.mouse.lastY;
        this.yaw -= dx * 0.0055; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.22, CAM.pitchMin, CAM.pitchMax); this.recenter = null;
      }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.lastX = e.clientX; this.mouse.lastY = e.clientY; this.mouse.inside = true;
    });
    const up = (e: PointerEvent) => {
      if (e.button === 2) this.mouse.right = false;
      if (e.button === 0) { this.mouse.left = false; this.holdMove = false; this.shooting = false; }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.wantDist = THREE.MathUtils.clamp(this.wantDist * Math.exp(e.deltaY * 0.0012), CAM.min, CAM.max); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'tab' || k === ' ') e.preventDefault();
      this.keys.add(k);
      if (e.repeat) return;
      if (k === '1' || k === '2' || k === '3') this.useSkill(this.skills[Number(k)]);
      else if (k === 'escape') { this.target = null; this.attacking = false; this.queued = null; }
      else if (k === 'tab') this.nextTarget();
      else if (k === 'c') this.recenter = this.me.yaw + Math.PI;
      else if (k === 'm') this.setMode(this.mode === 'A' ? 'B' : 'A');
      else if (k === 'v') { if (this.view) this.endView(); else this.startView(); }
      else if (k === 'o') void this.nextOutfit();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; this.holdMove = false; this.shooting = false; });
  }

  private setMode(m: ModeId): void {
    this.mode = m; this.hud.setMode(m);
    this.moveTo = null; this.holdMove = false; this.shooting = false; this.queued = null;
    if (m === 'B') { this.attacking = false; this.target = null; }
    this.hud.toast(m === 'A' ? 'Mode A · click to move and target' : 'Mode B · W A S D and aim with the mouse', 1500);
  }

  private nextTarget(): void {
    const dist = (f: Slime) => Math.hypot(f.x - this.me.x, f.z - this.me.z);
    const live = this.foes.filter((f) => f.alive && dist(f) < 14).sort((a, b) => dist(a) - dist(b));
    if (!live.length) return;
    const i = this.target ? live.indexOf(this.target) : -1;
    this.target = live[(i + 1) % live.length];
  }

  // ------------------------------------------------------------------ the character view and the outfits

  private startView(): void { this.view = { yaw0: this.me.yaw, t: 0 }; this.moveTo = null; this.attacking = false; this.hud.view(true, OUTFITS[this.outfit].name); }
  private endView(): void { this.view = null; this.hud.view(false, ''); }
  private async nextOutfit(): Promise<void> {
    this.outfit = (this.outfit + 1) % OUTFITS.length;
    await this.me.hero.equipAll(OUTFITS[this.outfit].e);
    this.me.hero.setWeapon('bow');
    this.hud.toast(`Outfit: ${OUTFITS[this.outfit].name}`, 1300);
    if (this.view) this.hud.view(true, OUTFITS[this.outfit].name);
  }

  // ------------------------------------------------------------------ skills

  private useSkill(s: Skill | undefined): void {
    if (!s || !this.me || this.me.downMs > 0) return;
    if (this.view) this.endView();
    if (s.left > 0) return;
    if (this.mode === 'A') {
      let t = this.target && this.target.alive ? this.target : null;
      if (!t) { t = this.nearestFoe(10); if (t) this.target = t; }
      if (t && Math.hypot(t.x - this.me.x, t.z - this.me.z) > s.range) { this.queued = s; this.attacking = true; return; }
      this.startCast(s, t, t ? t.center : this.ahead(6));
    } else this.startCast(s, this.hover, this.aimPoint());
  }
  private nearestFoe(r: number): Slime | null {
    let best: Slime | null = null, bd = r;
    const fx = Math.sin(this.me.yaw), fz = Math.cos(this.me.yaw);
    for (const f of this.foes) {
      if (!f.alive) continue;
      const dx = f.x - this.me.x, dz = f.z - this.me.z, d = Math.hypot(dx, dz), front = (dx * fx + dz * fz) / (d || 1);
      const score = d * (front > 0.2 ? 1 : 1.6);
      if (score < bd) { bd = score; best = f; }
    }
    return best;
  }
  private ahead(d: number): THREE.Vector3 { return new THREE.Vector3(this.me.x + Math.sin(this.me.yaw) * d, this.me.y + 1.0, this.me.z + Math.cos(this.me.yaw) * d); }
  /** Mode B's aim: the foe under the mouse, else the ground there (at chest height), else ahead. */
  private aimPoint(): THREE.Vector3 {
    if (this.hover && this.hover.alive) return this.hover.center;
    const g = this.groundAt(this.mouse.x, this.mouse.y);
    if (!g) return this.ahead(6);
    g.y += 0.75; return g;
  }

  private startCast(s: Skill, target: Slime | null, aim: THREE.Vector3): void {
    const b = this.me;
    if (b.cast && b.cast.elapsed < b.cast.startup + b.cast.active && !(b.cast.skill.id === 'quick_shot' && s.id !== 'quick_shot')) return;
    const k = finalSkill(s.id)!;
    const tm = s.id === 'arrow_storm' ? { startup: 550, active: 0, recovery: 420 } : (k.chain?.timings?.[0] ?? k);
    b.cast = { skill: s, anim: s.id, elapsed: 0, startup: tm.startup, active: tm.active, recovery: tm.recovery, stage: 0, fired: 0, target, aim: aim.clone(), hitIds: new Set() };
    s.left = s.cd || (this.mode === 'A' ? 760 : 430);
    if (s.id !== 'quick_shot') this.queued = null;
    if (this.mode === 'A') this.moveTo = null;
  }

  /** The cast's arrows leave the bow (at its release, and the double shot's second 90 ms later). */
  private fireCast(b: Body, c: Cast): void {
    const fwd = new THREE.Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw));
    const from = new THREE.Vector3(b.x, b.y + 1.05, b.z).addScaledVector(fwd, 0.4);
    const aim = c.target && c.target.alive ? c.target.center : c.aim;
    const dir = aim.clone().sub(from); if (dir.lengthSq() < 0.01) dir.copy(fwd); dir.normalize();
    const id = c.skill.id, sk = finalSkill(id)!;
    if (id === 'quick_shot') { this.shoot(from, dir, c.target, sk, [15, 21], false, c, 10); return; }
    if (id === 'multi_shot') {
      for (let i = -2; i <= 2; i++) this.shoot(from, dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.17), i === 0 ? c.target : null, sk, [16, 22], false, c, 9.5);
      return;
    }
    if (id === 'explosive_arrow') { this.shoot(from, dir, c.target, sk, [52, 66], true, c, 10); return; }
    if (id === 'arrow_storm') {
      const p = aim.clone(), dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
      if (d > c.skill.range) { p.x = b.x + (dx / d) * c.skill.range; p.z = b.z + (dz / d) * c.skill.range; }
      this.fx.streak({ x: b.x * U, y: (b.z / DK) * U, z: 120 }, { x: b.x * U + (dx / (d || 1)) * 60, y: (b.z / DK) * U + (dz / (d || 1)) * 50, z: 900 }, SUN, { w: 9, ms: 260, draw: 120 });
      this.zones.push({ x: p.x, z: p.z, r: 2.1, left: 2600, next: 380, ticks: 0, skill: sk });
      this.rings.ring(p.x, this.ground(p.x, p.z), p.z, SUN, 2.1, 520, 0.8);
    }
  }

  private shoot(from: THREE.Vector3, dir: THREE.Vector3, target: Slime | null, skill: FinalSkill, dmg: [number, number], fire: boolean, cast: Cast, range: number): void {
    const mesh = arrowMesh(fire); mesh.position.copy(from); this.scene.add(mesh);
    const speed = fire ? 17 : 24;
    const p = { castId: `fc${Math.random()}`, hitIndex: 0, skill, attackerId: 'hero', x: 0, y: 0, z: 0, dx: dir.x, dy: dir.z / DK, speed: speed * U, range: range * U, radius: 12, travelled: 0, ageMs: 0, pierce: false, explodeRadius: 0, cover: 'IGNORES_COVER', done: false, dropPerPx: 0 } as unknown as Projectile;
    this.shots.push({ p, pos: from.clone(), vel: dir.clone().multiplyScalar(speed), target, skill, fire, dmg, travelled: 0, range, mesh, done: false, cast });
  }

  /** A foe struck: the number, the game's hit piece (the hero's blows), its flash. */
  private strikeFoe(f: Slime, dmg: [number, number], skill: FinalSkill, at: THREE.Vector3, big: 0 | 1 = 0, by: Who = 'hero'): void {
    const crit = by === 'hero' && Math.random() < 0.16, v = Math.round(rnd(dmg[0], dmg[1]) * (crit ? 1.7 : 1));
    const from = this.bodies.find((b) => b.id === by) ?? this.me;
    const died = f.hurt(v, from.x, from.z, by);
    this.hud.damage(at.x, at.y + 0.35, at.z, v, by !== 'hero' ? 'ally' : crit ? 'crit' : 'hit');
    const px: V3 = { x: at.x * U, y: (at.z / DK) * U, z: Math.max(0, at.y - this.ground(at.x, at.z)) * U };
    if (by === 'hero') this.fx.hit(skill, skill.hits[0] as HitEvent, px, true, '', big);
    if (died && this.target === f) { this.target = null; this.attacking = false; }
    if (f === this.king && died) this.hud.toast('The King Jelly falls!', 2600);
  }

  // ------------------------------------------------------------------ each frame

  private frame(): void {
    const now = performance.now(), ms = Math.min(50, Math.max(1, now - this.last)); this.last = now;
    const dt = ms / 1000; this.t += dt;
    if (this.mouse.inside && !this.mouse.right) this.hover = this.foeAt(this.mouse.x, this.mouse.y);
    this.renderer.domElement.style.cursor = this.mouse.right ? 'grabbing' : this.hover ? 'crosshair' : 'default';
    for (const s of this.skills) s.left = Math.max(0, s.left - ms);
    this.heroThink(ms);
    this.alliesThink(ms);
    const ctx = this.foeCtx();
    for (const f of this.foes) f.update(ms, ctx);
    this.stepShots(ms);
    this.stepZones(ms);
    for (const b of this.bodies) this.driveBody(b, ms);
    this.stepCamera(ms);
    // the place: its life, its sun following the hero (the shadows: every frame — the bodies move)
    this.focus.x = this.me.x; this.focus.z = this.me.z;
    this.room.update(ms, this.t, 0);
    this.fx.update(ms, this.shots.filter((s) => !s.done).map((s) => s.p));
    this.flares.step(ms); this.rings.step(ms);
    const gr = (x: number, z: number) => this.ground(x, z);
    this.glow.step(ms, gr); this.dust.step(ms, gr);
    this.stepMarks();
    this.renderer.shadowMap.needsUpdate = true;
    this.composer.render();
    this.stepHud(ms);
  }

  private foeCtx(): FoeCtx {
    return {
      t: this.t, ground: (x, z) => this.ground(x, z), free: (x, z) => this.free(x, z, 12),
      party: this.bodies.filter((b) => b.downMs <= 0).map((b) => ({ id: b.id, x: b.x, z: b.z })),
      strike: (id, dmg, fx, fz) => { const b = this.bodies.find((x) => x.id === id); if (b) this.hurtBody(b, dmg, fx, fz); },
      warn: () => { if (this.king.warning?.kind === 'leap') this.hud.toast('Leap! Get out of the red circle', 1100); },
      slam: (x, z, r, big) => this.slam(x, z, r, big),
      pop: (x, z, color, big) => {
        this.fx.impact({ x: x * U, y: (z / DK) * U, z: 20 }, color, { r: big ? 120 : 46, embers: big ? 24 : 8, cracks: false });
        this.host().embers(x, this.ground(x, z) + 0.2, z, color, big ? 30 : 10, big ? 3 : 1.6);
      },
    };
  }

  /** The king's blow lands: every one of the party inside its circle is struck; the floor answers. */
  private slam(x: number, z: number, r: number, leap: boolean): void {
    for (const b of this.bodies) if (b.downMs <= 0 && Math.hypot(b.x - x, b.z - z) < r + 0.2) this.hurtBody(b, leap ? 230 : 170, x, z);
    const px: V3 = { x: x * U, y: (z / DK) * U, z: 0 };
    this.fx.impact(px, 0xc49aff, { r: 130, embers: 26 });
    this.fx.crack(px.x, px.y, 0xb48cff, { r: r * U * 0.55, chunks: 16, up: 1.3 });
    this.rings.ring(x, this.ground(x, z), z, 0xd8b8ff, r * 1.25, 520, 0.9);
    this.host().dust(x, z, 14, 1.6);
    this.room.gust(0.7, x < this.me.x ? 1 : -1);
    const d = Math.hypot(this.me.x - x, this.me.z - z); this.kick = Math.max(this.kick, d < 6 ? 0.07 : 0.03);
  }

  private hurtBody(b: Body, dmg: number, fx: number, fz: number): void {
    if (b.downMs > 0) return;
    b.hp -= dmg; b.lastHit = this.t; b.hurtMs = b.cast ? 0 : 300;
    this.hud.damage(b.x, b.y + 1.7, b.z, dmg, 'hurt');
    const dx = b.x - fx, dz = b.z - fz, d = Math.hypot(dx, dz) || 1, nx = b.x + (dx / d) * 0.25, nz = b.z + (dz / d) * 0.25;
    if (this.free(nx, nz)) { b.x = nx; b.z = nz; }
    if (b.id !== 'hero') { b.hp = Math.max(1, b.hp); return; } // (the allies are stand-ins: they stay up)
    if (b.hp <= 0) { b.hp = 0; b.downMs = 2600; b.cast = null; this.moveTo = null; this.attacking = false; this.hud.toast('You are down — back in a moment', 2000); }
  }

  /** The hero: the mode's controls turned into a run, a target followed, a cast. */
  private heroThink(ms: number): void {
    const b = this.me, dt = ms / 1000;
    b.hurtMs = Math.max(0, b.hurtMs - ms);
    if (b.downMs > 0) {
      b.downMs -= ms; b.vx = b.vz = 0;
      if (b.downMs <= 0) { b.hp = b.max; b.hurtMs = 0; }
      return;
    }
    if (this.t - b.lastHit > 4) b.hp = Math.min(b.max, b.hp + 22 * dt);
    // the cast in hand
    if (b.cast) {
      const c = b.cast; c.elapsed += ms;
      if (c.fired === 0 && c.elapsed >= c.startup) { c.fired = 1; this.fireCast(b, c); }
      if (c.skill.id === 'quick_shot' && c.fired === 1 && c.elapsed >= c.startup + 90) { c.fired = 2; this.fireCast(b, c); }
      if (c.elapsed >= c.startup + c.active + c.recovery) b.cast = null;
    }
    const locked = !!b.cast && b.cast.elapsed < b.cast.startup + b.cast.active + (this.mode === 'A' ? b.cast.recovery * 0.6 : 0) && !(this.mode === 'B' && b.cast.skill.id === 'quick_shot');
    // the run wanted: W A S D (the camera's way), the click's point, the target out of reach
    let wx = 0, wz = 0;
    const kf = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0), kr = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    if (kf || kr) {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      wx = fx * kf + rx * kr; wz = fz * kf + rz * kr; const n = Math.hypot(wx, wz); wx /= n; wz /= n;
      this.moveTo = null; this.holdMove = false; this.attacking = false; this.queued = null;
      if (this.view) this.endView();
    } else {
      if (this.mode === 'A' && this.holdMove && this.mouse.left) { const g = this.groundAt(this.mouse.x, this.mouse.y); if (g) this.moveTo = g; }
      if (this.mode === 'A' && this.attacking && this.target && this.target.alive) {
        const want = this.queued?.range ?? this.skills[0].range, d = Math.hypot(this.target.x - b.x, this.target.z - b.z);
        if (d > want) this.moveTo = new THREE.Vector3(this.target.x, 0, this.target.z);
        else {
          this.moveTo = null;
          if (this.queued && this.queued.left <= 0) this.startCast(this.queued, this.target, this.target.center);
          else if (!b.cast && this.skills[0].left <= 0) this.startCast(this.skills[0], this.target, this.target.center);
        }
      }
      if (this.mode === 'B' && this.shooting && this.skills[0].left <= 0) this.startCast(this.skills[0], this.hover, this.aimPoint());
      if (this.moveTo) {
        const dx = this.moveTo.x - b.x, dz = this.moveTo.z - b.z, d = Math.hypot(dx, dz);
        if (d > 0.1) { wx = dx / d; wz = dz / d; if (d < RUN * dt) { wx *= d / (RUN * dt); wz *= d / (RUN * dt); } }
        else if (!this.holdMove) this.moveTo = null;
      }
    }
    if (locked) { wx = 0; wz = 0; }
    const sp = RUN * (b.cast && !locked ? 0.85 : 1);
    let nx = b.x + wx * sp * dt, nz = b.z + wz * sp * dt;
    if ((wx || wz) && !this.free(nx, nz)) {
      if (this.free(nx, b.z)) nz = b.z; else if (this.free(b.x, nz)) nx = b.x; else { nx = b.x; nz = b.z; if (this.moveTo && !this.holdMove) this.moveTo = null; }
    }
    b.vx = (nx - b.x) / Math.max(dt, 1e-3); b.vz = (nz - b.z) / Math.max(dt, 1e-3);
    b.x = nx; b.z = nz;
    // facing: the cast's aim, else the way he runs
    if (b.cast) { const a = b.cast.target && b.cast.target.alive ? b.cast.target.center : b.cast.aim; b.yaw += angDiff(b.yaw, Math.atan2(a.x - b.x, a.z - b.z)) * Math.min(1, dt * 18); }
    else if (Math.hypot(b.vx, b.vz) > 0.3) b.yaw += angDiff(b.yaw, Math.atan2(b.vx, b.vz)) * Math.min(1, dt * 14);
  }

  /** The two allies: they wait by the king; once the fight starts they take their places round it (the warrior near,
   *  the mage far), strike in their rhythm, and run out of a marked circle before it lands. */
  private alliesThink(ms: number): void {
    const dt = ms / 1000, k = this.king, live = k.alive && !!k.aggro;
    for (const b of this.bodies) {
      if (b.id === 'hero') continue;
      const br = this.allyBrain.get(b.id)!;
      b.hurtMs = Math.max(0, b.hurtMs - ms);
      if (this.t - b.lastHit > 3) b.hp = Math.min(b.max, b.hp + 40 * dt);
      if (b.cast) {
        const c = b.cast; c.elapsed += ms;
        if (c.fired === 0 && c.elapsed >= c.startup) { c.fired = 1; this.allyBlow(b); }
        if (c.elapsed >= c.startup + c.active + c.recovery) b.cast = null;
      }
      br.cd -= ms;
      let goal: THREE.Vector3;
      const w = k.warning, inMark = !!w && Math.hypot(b.x - w.x, b.z - w.z) < w.r + 0.7;
      if (live && w && inMark) {
        const dx = b.x - w.x, dz = b.z - w.z, d = Math.hypot(dx, dz) || 1;
        goal = new THREE.Vector3(w.x + (dx / d) * (w.r + 1.3), 0, w.z + (dz / d) * (w.r + 1.3));
      } else if (live) {
        const R = b.id === 'kael' ? k.radius + 0.9 : 5.2, a = Math.atan2(this.me.x - k.x, this.me.z - k.z) + br.angle;
        goal = new THREE.Vector3(k.x + Math.sin(a) * R, 0, k.z + Math.cos(a) * R);
      } else goal = br.home;
      const dx = goal.x - b.x, dz = goal.z - b.z, d = Math.hypot(dx, dz);
      const busy = !!b.cast && b.cast.elapsed < b.cast.startup + b.cast.active;
      let vx = 0, vz = 0;
      if (d > 0.25 && !busy) { const s = Math.min(RUN * (w ? 1.15 : 0.95), d / dt); vx = (dx / d) * s; vz = (dz / d) * s; }
      const nx = b.x + vx * dt, nz = b.z + vz * dt;
      if (this.free(nx, nz)) { b.x = nx; b.z = nz; } else { vx = vz = 0; }
      b.vx = vx; b.vz = vz;
      if (live && d < 0.6 && !b.cast && br.cd <= 0 && !inMark) {
        const id = b.id === 'kael' ? 'warrior_basic' : 'arcane_bolt', sk = finalSkill(id)!, n = sk.chain?.timings?.length ?? 1, tm = sk.chain?.timings?.[br.stage % n] ?? sk;
        b.cast = { skill: { key: '', id, name: sk.name, cd: 0, left: 0, range: 0 }, anim: id, elapsed: 0, startup: tm.startup, active: tm.active, recovery: tm.recovery, stage: br.stage % n, fired: 0, target: k, aim: k.center, hitIds: new Set() };
        br.stage++; br.cd = (b.id === 'kael' ? 520 : 900) + Math.random() * 300;
      }
      const moving = Math.hypot(vx, vz) > 0.3;
      const face = moving && !b.cast ? Math.atan2(vx, vz) : live || b.cast ? Math.atan2(k.x - b.x, k.z - b.z) : b.yaw;
      b.yaw += angDiff(b.yaw, face) * Math.min(1, dt * 10);
    }
  }
  private allyBlow(b: Body): void {
    const k = this.king; if (!k.alive) return;
    const at = k.center, to: V3 = { x: at.x * U, y: (at.z / DK) * U, z: (at.y - this.ground(at.x, at.z)) * U };
    if (b.id === 'kael') {
      this.fx.slash(to, Math.sin(b.yaw) >= 0 ? 1 : -1, STEEL, { r: 70, w: 16, ms: 220 });
      this.strikeFoe(k, [26, 36], finalSkill('warrior_basic')!, at, 0, 'kael');
    } else {
      const from: V3 = { x: b.x * U + Math.sin(b.yaw) * 40, y: (b.z / DK) * U + (Math.cos(b.yaw) * 40) / DK, z: 150 };
      this.fx.bolt(from, to, ARCANE, { ms: 220, w: 8, forks: 2, hue: true });
      this.fx.later(90, () => { if (k.alive) this.fx.impact(to, ARCANE, { r: 44, embers: 8, cracks: false }); });
      this.strikeFoe(k, [38, 50], finalSkill('arcane_bolt')!, at, 0, 'lyra');
    }
  }

  private stepShots(ms: number): void {
    const dt = ms / 1000;
    for (const s of this.shots) {
      if (s.done) continue;
      if (s.target && s.target.alive) { const want = s.target.center.sub(s.pos).normalize().multiplyScalar(s.vel.length()); s.vel.lerp(want, Math.min(1, dt * 12)); }
      s.pos.addScaledVector(s.vel, dt); s.travelled += s.vel.length() * dt;
      s.mesh.position.copy(s.pos); s.mesh.lookAt(s.pos.clone().add(s.vel));
      s.p.x = s.pos.x * U; s.p.y = (s.pos.z / DK) * U; s.p.z = (s.pos.y - 0.62) * U; s.p.dx = s.vel.x; s.p.dy = s.vel.z / DK;
      let hit: Slime | null = null;
      for (const f of this.foes) { if (!f.alive || s.cast.hitIds.has(f.id)) continue; if (f.center.distanceTo(s.pos) < f.radius * 0.95 + 0.14) { hit = f; break; } }
      const end = s.travelled > s.range || s.pos.y < this.ground(s.pos.x, s.pos.z);
      if (hit || end) {
        s.done = true; s.p.done = true; this.scene.remove(s.mesh);
        if (s.fire) this.explode(s.pos.clone(), s.skill, s.cast);
        else if (hit) { if (s.cast.skill.id === 'multi_shot') s.cast.hitIds.add(hit.id); this.strikeFoe(hit, s.dmg, s.skill, s.pos.clone()); }
      }
    }
    this.shots = this.shots.filter((s) => !s.done);
  }
  private explode(at: THREE.Vector3, skill: FinalSkill, c: Cast): void {
    const px: V3 = { x: at.x * U, y: (at.z / DK) * U, z: Math.max(0, at.y - this.ground(at.x, at.z)) * U };
    this.fx.impact(px, FIRE, { r: 92, embers: 18 });
    this.fx.hit(skill, skill.hits[0] as HitEvent, { ...px, z: 0 }, false, '', 1);
    this.rings.ring(at.x, this.ground(at.x, at.z), at.z, FIRE, 1.9, 420, 0.8);
    this.kick = Math.max(this.kick, 0.035);
    for (const f of this.foes) if (f.alive && !c.hitIds.has(f.id) && Math.hypot(f.x - at.x, f.z - at.z) < 1.6 + f.radius * 0.5) { c.hitIds.add(f.id); this.strikeFoe(f, [52, 66], skill, f.center, 1); }
  }
  private stepZones(ms: number): void {
    for (const z of this.zones) {
      z.left -= ms; z.next -= ms;
      if (z.next <= 0 && z.left > 0) {
        z.next += 200; z.ticks++;
        const big = z.ticks % 5 === 0;
        this.fx.rain(z.x * U, (z.z / DK) * U, z.r * U * 0.85, SUN, { n: big ? 9 : 6, ms: 200, h: 760 });
        if (big) this.rings.ring(z.x, this.ground(z.x, z.z), z.z, SUN, z.r * 1.05, 300, 0.55);
        for (const f of this.foes) if (f.alive && Math.hypot(f.x - z.x, f.z - z.z) < z.r + f.radius * 0.5) this.strikeFoe(f, big ? [16, 22] : [9, 13], z.skill, f.center);
      }
    }
    this.zones = this.zones.filter((z) => z.left > 0);
  }

  /** Each body's 3D figure: where it stands, its way, its move. */
  private driveBody(b: Body, ms: number): void {
    b.y = this.ground(b.x, b.z);
    const sp = Math.hypot(b.vx, b.vz) * U;
    let mode = 'idle';
    if (b.downMs > 0) mode = b.downMs < 700 ? 'getup' : 'down';
    else if (b.cast) mode = 'skill';
    else if (b.hurtMs > 0) mode = 'hurt';
    else if (sp > 30) mode = 'run';
    const c = b.cast;
    b.hero.drive({
      x: b.x * U, y: (b.z / DK) * U, z: b.y * U, vx: b.vx * U, vy: (b.vz / DK) * U, vz: 0, grounded: true, face: 1, yaw: b.yaw, mode,
      cast: c ? { id: c.anim, stage: c.stage, elapsed: c.elapsed, startup: c.startup, active: c.active, recovery: c.recovery, dash: false, air: false } : null,
    }, ms);
  }

  /** The camera: behind and above the hero where the player turned it, at the wheel's distance, kept out of the ground
   *  and the terrace's wall (it comes in front of them), a short shake on a heavy blow. */
  private stepCamera(ms: number): void {
    const dt = ms / 1000, b = this.me;
    if (this.recenter !== null) { const d = angDiff(this.yaw, this.recenter); this.yaw += d * Math.min(1, dt * 9); if (Math.abs(d) < 0.01) this.recenter = null; }
    let pitch = this.pitch, dist = this.wantDist, lookY = 1.15;
    if (this.view) { // the character view: close, low, slowly round him (front, side, back)
      this.view.t += dt;
      this.yaw += angDiff(this.yaw, this.view.yaw0 + this.view.t * 0.55) * Math.min(1, dt * 4);
      pitch = 9; dist = 3.0; lookY = 0.85;
    }
    this.camDist += (dist - this.camDist) * Math.min(1, dt * 8);
    this.look.lerp(new THREE.Vector3(b.x, b.y + lookY, b.z), Math.min(1, dt * 14));
    const p = THREE.MathUtils.degToRad(pitch);
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(p), Math.sin(p), Math.cos(this.yaw) * Math.cos(p));
    let d = this.camDist;
    for (let i = 1; i <= 16; i++) {
      const s = (i / 16) * this.camDist, q = this.look.clone().addScaledVector(off, s), g = this.ground(q.x, q.z);
      if (g > -5 && q.y < g + 0.35) { d = Math.max(1.2, s - 0.3); break; }
    }
    this.dist += (d - this.dist) * Math.min(1, dt * (d < this.dist ? 18 : 5));
    const pos = this.look.clone().addScaledVector(off, this.dist);
    if (this.kick > 0.001) { pos.x += (Math.random() - 0.5) * this.kick * 2; pos.y += (Math.random() - 0.5) * this.kick * 2; this.kick *= Math.max(0, 1 - dt * 10); }
    this.camera.position.copy(pos);
    this.camera.lookAt(this.look);
  }

  /** The target's ring under it, the king's mark filling on the floor. */
  private stepMarks(): void {
    const tg = this.target && this.target.alive ? this.target : null;
    this.tgRing.visible = !!tg;
    if (tg) {
      const s = tg.radius * 1.3 + Math.sin(this.t * 6) * 0.03;
      this.tgRing.position.set(tg.x, this.ground(tg.x, tg.z) + 0.03, tg.z); this.tgRing.scale.set(s, s, 1); this.tgRing.rotation.z = this.t * 0.8;
    }
    const w = this.king?.alive ? this.king.warning : null;
    for (const m of Object.values(this.tele)) m.visible = !!w;
    if (w) {
      const k = 1 - Math.max(0, w.left) / w.ms, y = this.ground(w.x, w.z) + 0.035;
      for (const m of Object.values(this.tele)) m.position.set(w.x, y, w.z);
      this.tele.base.scale.set(w.r, w.r, 1); this.tele.edge.scale.set(w.r, w.r, 1);
      this.tele.fill.scale.set(Math.max(0.01, w.r * k), Math.max(0.01, w.r * k), 1); this.tele.fill.position.y = y + 0.002;
      (this.tele.edge.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(this.t * 18) * 0.25;
    }
  }

  private stepHud(ms: number): void {
    const proj = new THREE.Vector3(), W = window.innerWidth, Hh = window.innerHeight;
    const project = (x: number, y: number, z: number) => {
      proj.set(x, y, z).project(this.camera);
      return { x: ((proj.x + 1) / 2) * W, y: ((1 - proj.y) / 2) * Hh, on: proj.z < 1 && proj.z > -1 && Math.abs(proj.x) < 1.2 && Math.abs(proj.y) < 1.2 };
    };
    this.hud.party(this.bodies.map((b) => ({ id: b.id, name: b.name, sub: b.sub, hp: b.hp, max: b.max, me: b.id === 'hero' })));
    const tg = this.target && this.target.alive ? this.target : null;
    this.hud.target(tg ? { name: tg.kind.name, lv: tg.kind.lv, hp: tg.hp, max: tg.maxHp, boss: tg.boss } : null);
    const cast = this.me.cast;
    this.hud.skills(this.skills.map((s) => ({ key: s.key, name: s.name, icon: '', left: s.left, total: s.cd || 1, on: !!cast && cast.skill === s })));
    const plates: PlateView[] = [];
    for (const f of this.foes) {
      if (!f.alive || this.camera.position.distanceTo(f.center) > 24) continue;
      const p = project(f.x, f.y + f.height + (f.boss ? 0.55 : 0.28), f.z); if (!p.on) continue;
      plates.push({ id: `f${f.id}`, x: p.x, y: p.y, name: f.kind.name, lv: f.kind.lv, hp: f.hp, max: f.maxHp, kind: f.boss ? 'boss' : 'foe', target: f === tg, bar: f.boss || f.shownFor > 0 || f === tg || f === this.hover });
    }
    for (const b of this.bodies) {
      if (b.id === 'hero') continue;
      const p = project(b.x, b.y + H + 0.45, b.z); if (!p.on) continue;
      plates.push({ id: b.id, x: p.x, y: p.y, name: b.name, hp: b.hp, max: b.max, kind: 'ally', target: false, bar: true });
    }
    this.hud.plate(plates);
    this.hud.update(ms, project);
  }
}

export function startFreeCam(): void {
  new FreeCam(document.getElementById('game') ?? document.body);
}
