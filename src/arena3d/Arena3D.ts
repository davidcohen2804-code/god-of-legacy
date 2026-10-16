// PVP 3D (a test build, opened from the main menu's PVP 3D button): the arena as a real 3D room — a voxel temple
// courtyard (back wall, a deep plank floor, a railing in front) seen by a perspective camera that follows the fight and
// turns a little with it — while the fighters, skills, effects and the whole combat stay the game's own (Phaser, the
// same world coordinates and rules). The room is drawn by three.js into its own canvas and shown as two Phaser layers
// (everything behind the fighters, and the railing in front of them); every Phaser object of the world is placed for the
// frame where the 3D camera sees its floor point, at the size the depth gives it, and put straight back after the frame
// (like CameraPitch): the game itself never sees the projection.
import Phaser from 'phaser';
import * as THREE from 'three';


/** World px → 3D units: 1 unit = 100 px; the floor's depth stretched (a deep room), heights as drawn. */
const U = 100, HEIGHT_K = 1.0;
/** The camera: pitch below the horizon, field of view, distance (units) — and how much it turns with the fight. */
const CAM = { pitch: 24, fov: 32, dist: 8.4, distPerSpan: 0.3, distMax: 14, yawMax: 9, follow: 0.12, aim: 0.5 };
/** The floor's depth stretch (world px of depth → units). Things drawn without a floor point of their own (effects in
 *  the top layers, numbers) are placed over the fighter nearest to them, so any depth reads right. */
const DEPTH_K = 1.15;
/** Voxel size (units). */
/** The room's render size (a share of the game's): the paintings stay crisp, the cost stays low. */
const RES = 0.85;

type Placed = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Visible
  & { scrollFactorX?: number; scrollFactorY?: number; depth: number; displayWidth?: number };

export interface Floor { x0: number; x1: number; back: number; front: number }

export class Arena3D {
  private renderer: THREE.WebGLRenderer;
  private scene3 = new THREE.Scene();
  private front3 = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private bg: Phaser.GameObjects.Image;
  private fg: Phaser.GameObjects.Image;
  private bgCanvas: HTMLCanvasElement;
  private fgCanvas: HTMLCanvasElement;
  private saved: [Placed, number, number, number, number][] = [];
  private look = new THREE.Vector3();
  private pos = new THREE.Vector3();
  private yaw = 0;
  private dist = CAM.dist;
  private lanterns: THREE.PointLight[] = [];
  private hemi!: THREE.HemisphereLight;
  /** The painted cut-outs' materials (darkened together in a big moment). */
  private cards: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
  /** The hits' light: a small pool of point lights, each placed on a hit and fading (the floor and the ground take it). */
  private hitLights: { L: THREE.PointLight; left: number; ms: number; power: number }[] = [];
  /** The marks a heavy blow leaves on the floor (a soft dark scorch / dust ring, fading). */
  private marks: { m: THREE.Mesh; left: number; ms: number }[] = [];
  private markTex?: THREE.Texture;
  /** How dark the room is (0 = as painted, 1 = night): eased toward `dimWant`, set by the scene in a big moment. */
  private dimNow = 0;
  dimWant = 0;
  private petals?: THREE.Points;
  private loader = new THREE.TextureLoader();
  private t = 0;
  /** The fighters' midpoint and spread (world px), set by the scene each frame. */
  focus = { x: 0, y: 0, z: 0, span: 0 };
  /** A punch-in (1 = none), set by the scene (an ultimate, the K.O.). */
  punch = 1;
  /** The fighters' floor points (world px), set by the scene: what floats without a floor of its own is drawn over the
   *  nearest of them. */
  anchors: { x: number; y: number }[] = [];

  constructor(private scene: Phaser.Scene, private floor: Floor) {
    const soft = !!(navigator as { webdriver?: boolean }).webdriver; // (test browsers render on the CPU: half size, no shadows)
    const res = soft ? 0.4 : RES, w = Math.round(scene.scale.width * res), h = Math.round(scene.scale.height * res);
    // one three.js canvas: the room is drawn into it, handed to Phaser (a GPU copy), then the railing, handed over too
    this.bgCanvas = document.createElement('canvas');
    this.fgCanvas = this.bgCanvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.bgCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = false; void soft; // (painted cut-outs carry their own shadows)
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(CAM.fov, w / h, 0.5, 400);
    this.build();
    this.focus = { x: (floor.x0 + floor.x1) / 2, y: (floor.back + floor.front) / 2, z: 0, span: 0 };
    this.place(true);
    // the two layers: the room behind everything, the railing (front3) over the fighters
    for (const k of ['arena3d-bg', 'arena3d-fg']) if (scene.textures.exists(k)) scene.textures.remove(k);
    scene.textures.addImage('arena3d-bg', this.bgCanvas as unknown as HTMLImageElement);
    scene.textures.addImage('arena3d-fg', this.fgCanvas as unknown as HTMLImageElement);
    this.bg = scene.add.image(0, 0, 'arena3d-bg').setOrigin(0, 0).setScrollFactor(0).setDepth(-1e6).setDisplaySize(scene.scale.width, scene.scale.height);
    this.fg = scene.add.image(0, 0, 'arena3d-fg').setOrigin(0, 0).setScrollFactor(0).setDepth(90000).setDisplaySize(scene.scale.width, scene.scale.height);
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.apply, this);
    scene.events.on(Phaser.Scenes.Events.RENDER, this.restore, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // ------------------------------------------------------------------ the room

  private w3 = (x: number) => x / U;
  private d3 = (y: number) => (y / U) * DEPTH_K;
  private h3 = (z: number) => (z / U) * HEIGHT_K;

  private build(): void {
    const S = this.scene3, F = this.floor, A = 'assets/arena3d/sakura/';
    const x0 = this.w3(F.x0) - 0.6, x1 = this.w3(F.x1) + 0.6, zBack = this.d3(F.back) - 0.3, zFront = this.d3(F.front) + 0.3;
    const cx = (x0 + x1) / 2, W = x1 - x0;
    S.background = new THREE.Color(0x3a2440);
    S.fog = new THREE.Fog(0x8a5a6a, 26, 70);
    // light: the paintings carry their own light (unlit cards); the floor takes a warm dusk light and the lanterns' glow
    this.hemi = new THREE.HemisphereLight(0xfff0e6, 0x5a3a40, 1.55); S.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffb27a, 1.4); sun.position.set(cx - 12, 14, zBack - 10); sun.target.position.set(cx, 0, (zBack + zFront) / 2); S.add(sun, sun.target);
    const tex = (file: string, onLoad?: (t: THREE.Texture) => void): THREE.Texture => {
      const t = this.loader.load(A + file, (tt) => { onLoad?.(tt); });
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      return t;
    };
    /** A painted cut-out standing in the room: its bottom centre at (x, y, z), h units tall (its width from the painting). */
    const card = (target: THREE.Scene, file: string, x: number, y: number, z: number, h: number, opts: { flip?: boolean; fog?: boolean; tint?: number } = {}) => {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08, depthWrite: true, fog: opts.fog ?? true, color: opts.tint ?? 0xffffff });
      this.cards.push({ mat, base: new THREE.Color(opts.tint ?? 0xffffff) });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.visible = false; target.add(m);
      mat.map = tex(file, (t) => { const img = t.image as { width: number; height: number }; const w = h * img.width / img.height; m.scale.set(opts.flip ? -w : w, h, 1); m.position.set(x, y + h / 2, z); m.visible = true; mat.needsUpdate = true; });
      return m;
    };

    // the fighting floor: the painted planks, tiled (a plank about a quarter of a hero's height), lit by the room
    const floorTex = tex('floor.webp'); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(W / 3.2, (zFront - zBack) / 3.2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, zFront - zBack), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42, metalness: 0.08 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, (zBack + zFront) / 2); S.add(floor);
    // a dark stone rim round the planks and the ground beyond (stone paving when painted, else dusk earth)
    const rim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.18, zFront - zBack + 0.5), new THREE.MeshStandardMaterial({ color: 0x3a2e2c, roughness: 0.9 }));
    rim.position.set(cx, -0.1, (zBack + zFront) / 2); S.add(rim);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a3a3a, roughness: 0.95 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 60, 60), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.2, zBack + 5); S.add(ground);
    this.loader.load(A + 'ground.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((W + 60) / 4, 60 / 4); groundMat.map = t; groundMat.color.set(0xffffff); groundMat.needsUpdate = true; }, undefined, () => { /* (no paving painted yet) */ });

    // the far sky (no fog: it is the light itself), then the temple right behind the floor, cherry trees round it
    card(S, 'sky.webp', cx, -6, zBack - 42, 36, { fog: false });
    card(S, 'facade.webp', cx, -0.05, zBack - 0.35, 8.2);
    card(S, 'tree.webp', x0 - 2.2, -0.05, zBack - 1.4, 7.5);
    card(S, 'tree.webp', x1 + 2.2, -0.05, zBack - 1.4, 7.5, { flip: true });
    card(S, 'tree.webp', x0 + 1.5, -0.05, zBack - 7, 9, { flip: true, tint: 0xe8d0dc });
    card(S, 'tree.webp', x1 - 1.0, -0.05, zBack - 8, 9.5, { tint: 0xe8d0dc });
    card(S, 'tree.webp', x0 - 5.5, -0.05, zBack + 3, 8, { tint: 0xf0e0e6 });
    card(S, 'tree.webp', x1 + 5.5, -0.05, zBack + 3.5, 8, { flip: true, tint: 0xf0e0e6 });
    // stone lanterns down both sides of the floor (their glow on the planks)
    for (const [i, zc] of [zBack + 0.6, (zBack + zFront) / 2, zFront - 0.6].entries()) for (const side of [-1, 1]) {
      const x = side < 0 ? x0 - 0.9 : x1 + 0.9;
      card(S, 'lantern.webp', x, -0.05, zc, 2.3);
      if (i !== 1) continue;
      const L = new THREE.PointLight(0xffa04a, 6, 7, 1.7); L.position.set(x - side * 0.6, 1.5, zc + 0.3); S.add(L); this.lanterns.push(L);
    }
    { const L = new THREE.PointLight(0xffb060, 10, 9, 1.6); L.position.set(cx, 1.8, zBack + 0.4); S.add(L); this.lanterns.push(L); } // the temple's open doors light the back of the floor

    // the railing in front (its own scene: drawn over the fighters), tiled across; dark wood bars if not painted yet
    const rz = zFront + 0.9;
    this.loader.load(A + 'railing.webp', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      const img = t.image as { width: number; height: number }, h = 0.62, w = h * img.width / img.height; // (waist-high)
      for (let x = x0 - 2; x < x1 + 2; x += w * 0.955) { // (each piece's first post over the last one's)
        const rm = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.08 }); this.cards.push({ mat: rm, base: new THREE.Color(0xffffff) });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), rm);
        m.position.set(x + w / 2, h / 2 - 0.1, rz); this.front3.add(m);
      }
    }, undefined, () => { /* (not painted yet: no railing) */ });

    // drifting petals (a soft pink petal sprite)
    const pc = document.createElement('canvas'); pc.width = pc.height = 32;
    { const g = pc.getContext('2d')!; g.translate(16, 16); g.rotate(0.6); const gr = g.createRadialGradient(0, 0, 1, 0, 0, 12); gr.addColorStop(0, '#ffe6f0'); gr.addColorStop(1, 'rgba(255,150,190,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); g.fill(); }
    const n = 220, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = x0 - 4 + Math.random() * (W + 8); pos[i * 3 + 1] = Math.random() * 7; pos[i * 3 + 2] = zBack - 3 + Math.random() * (zFront - zBack + 5); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.petals = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(pc), size: 0.16, transparent: true, depthWrite: false, color: 0xffd0e0 }));
    S.add(this.petals);
    for (let i = 0; i < 6; i++) { const L = new THREE.PointLight(0xffffff, 0, 6, 1.6); L.visible = false; S.add(L); this.hitLights.push({ L, left: 0, ms: 1, power: 0 }); }
  }

  // ------------------------------------------------------------------ the skills in the room

  /** A blow lands at a world point (x, depth y, height z px): its light flares on the floor around it in the skill's
   *  colour and fades (heavier blows: brighter, wider, longer); a heavy one leaves a mark on the floor. */
  hit(x: number, y: number, z: number, color: number, weight: 'light' | 'heavy' | 'ultimate'): void {
    const slot = this.hitLights.reduce((a, b) => (b.left < a.left ? b : a));
    const P = weight === 'ultimate' ? { power: 34, dist: 11, ms: 520 } : weight === 'heavy' ? { power: 20, dist: 8, ms: 340 } : { power: 9, dist: 5, ms: 200 };
    slot.L.color.set(color); slot.L.distance = P.dist; slot.L.position.set(this.w3(x), this.h3(Math.max(40, z)) + 0.35, this.d3(y) + 0.25);
    slot.L.visible = true; slot.left = P.ms; slot.ms = P.ms; slot.power = P.power;
    if (weight !== 'light') this.mark(x, y, weight === 'ultimate' ? 2.4 : 1.4, color);
  }

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
      if (h.left <= 0) { h.L.visible = false; continue; }
      h.left -= ms; const k = Math.max(0, h.left / h.ms);
      h.L.intensity = h.power * (k * k * (3 - 2 * k)); // (a fast flare, a soft fade)
    }
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mk = this.marks[i]; mk.left -= ms;
      (mk.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, mk.left / 900);
      if (mk.left <= 0) { this.scene3.remove(mk.m); mk.m.geometry.dispose(); (mk.m.material as THREE.Material).dispose(); this.marks.splice(i, 1); }
    }
    this.dimNow += (this.dimWant - this.dimNow) * Math.min(1, ms / (this.dimWant > this.dimNow ? 120 : 380));
    const lit = 1 - 0.62 * this.dimNow;
    if (this.hemi) this.hemi.intensity = 1.55 * lit;
    for (const c of this.cards) c.mat.color.copy(c.base).multiplyScalar(lit);
    for (const L of this.lanterns) L.visible = this.dimNow < 0.85;
  }

  // ------------------------------------------------------------------ the camera

  /** Follow the fight: the fighters' midpoint ahead, pulled back as they part, turned a little as it slides. */
  step(ms: number): void {
    this.t += ms;
    this.stepFx(ms);
    const f = this.focus, F = this.floor, k = Math.min(1, (ms / 16) * CAM.follow);
    const want = new THREE.Vector3(this.w3(f.x), this.h3(Math.min(160, f.z * 0.4)) + CAM.aim, this.d3(f.y));
    this.look.lerp(want, this.look.lengthSq() ? k : 1);
    const cx = (F.x0 + F.x1) / 2, half = Math.max(1, (F.x1 - F.x0) / 2);
    this.yaw += ((-Phaser.Math.Clamp((f.x - cx) / half, -1, 1) * CAM.yawMax) - this.yaw) * k;
    this.dist += (Math.min(CAM.distMax, CAM.dist + this.w3(f.span) * CAM.distPerSpan) / this.punch - this.dist) * k;
    this.place(false);
    for (const [i, L] of this.lanterns.entries()) { const b = (L.userData.base ??= L.intensity) as number; L.intensity = b * (1 + Math.sin(this.t / 140 + i * 1.7) * 0.08 + Math.sin(this.t / 53 + i) * 0.04); } // flicker
    if (this.petals) { const a = this.petals.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - ms * 0.0006; if (y < 0) y = 9; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(this.t / 900 + i) * ms * 0.0004); } a.needsUpdate = true; }
  }

  private place(snap: boolean): void {
    if (snap) { const f = this.focus; this.look.set(this.w3(f.x), CAM.aim, this.d3(f.y)); }
    const p = Phaser.Math.DegToRad(CAM.pitch), y = Phaser.Math.DegToRad(this.yaw);
    this.pos.set(this.look.x + Math.sin(y) * Math.cos(p) * this.dist, this.look.y + Math.sin(p) * this.dist, this.look.z + Math.cos(y) * Math.cos(p) * this.dist);
    this.camera.position.copy(this.pos); this.camera.lookAt(this.look); this.camera.updateMatrixWorld(); this.camera.updateProjectionMatrix();
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
    const cam = this.scene.cameras.main;
    cam.setZoom(1); cam.setScroll(0, 0); // (the 3D camera frames the fight; the Phaser camera only shakes / fades)
    this.renderer.render(this.scene3, this.camera);
    this.scene.textures.get('arena3d-bg').source[0].update(); // (uploaded now: the next render draws over the canvas)
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(this.front3, this.camera);
    this.scene.textures.get('arena3d-fg').source[0].update();
    // every world object: placed where the 3D camera sees its floor point, scaled by its depth
    const sw = this.scene.scale.width;
    const visit = (o: Placed, top: boolean) => {
      if (!o.visible || o === (this.bg as unknown) || o === (this.fg as unknown) || o.scrollFactorX === 0) return;
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

  private restore(): void {
    for (let i = this.saved.length - 1; i >= 0; i--) { const [o, x, y, sx, sy] = this.saved[i]; o.x = x; o.y = y; o.scaleX = sx; o.scaleY = sy; }
    this.saved.length = 0;
  }

  private destroy(): void {
    this.restore();
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.apply, this);
    this.scene.events.off(Phaser.Scenes.Events.RENDER, this.restore, this);
    this.renderer.dispose();
  }
}
