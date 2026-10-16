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
const CAM = { pitch: 26, fov: 32, dist: 9.5, distPerSpan: 0.3, distMax: 15, yawMax: 9, follow: 0.12, aim: 0.5 };
/** The floor's depth stretch (world px of depth → units). Things drawn without a floor point of their own (effects in
 *  the top layers, numbers) are placed over the fighter nearest to them, so any depth reads right. */
const DEPTH_K = 1.15;
/** Voxel size (units). */
const V = 0.25;
/** The room's render size (a share of the game's): the blocky room reads the same a little softer, and costs much less. */
const RES = 0.6;

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
  private petals?: THREE.Points;
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
    this.renderer.shadowMap.enabled = !soft; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
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
    const S = this.scene3, F = this.floor;
    const x0 = this.w3(F.x0) - 1.5, x1 = this.w3(F.x1) + 1.5, zBack = this.d3(F.back) - 0.4, zFront = this.d3(F.front) + 0.4;
    S.background = new THREE.Color(0x2a1b2e);
    S.fog = new THREE.Fog(0x3a2238, 30, 90);
    // light: a low sunset sun from behind-left, a cool sky fill, warm lanterns
    S.add(new THREE.HemisphereLight(0xffc9a8, 0x2a2440, 1.1));
    const sun = new THREE.DirectionalLight(0xffa86a, 2.2);
    sun.position.set(x0 - 10, 18, zBack - 14); sun.target.position.set((x0 + x1) / 2, 0, (zBack + zFront) / 2);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
    S.add(sun, sun.target);

    const vox: { p: THREE.Vector3; c: THREE.Color; s?: THREE.Vector3 }[] = [];
    const col = (hex: number, j = 0.06) => { const c = new THREE.Color(hex); const k = 1 + (Math.random() - 0.5) * j * 2; return c.multiplyScalar(k); };
    const box = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, hex: number, j = 0.06, step = V) => {
      for (let x = ax; x < bx - 1e-6; x += step) for (let y = ay; y < by - 1e-6; y += step) for (let z = az; z < bz - 1e-6; z += step) {
        // hollow inside (only the shell shows)
        const edge = x - ax < step || bx - x <= step * 1.01 || y - ay < step || by - y <= step * 1.01 || z - az < step || bz - z <= step * 1.01;
        if (edge) vox.push({ p: new THREE.Vector3(x + step / 2, y + step / 2, z + step / 2), c: col(hex, j), s: step !== V ? new THREE.Vector3(step, step, step) : undefined });
      }
    };

    // the fighting floor: dark planks (long boards along x), a stone border
    const boards: { x: number; z: number; len: number; c: THREE.Color }[] = [];
    for (let z = zBack; z < zFront; z += 0.33) {
      let x = x0 - Math.random() * 1.5;
      while (x < x1) { const len = Math.min(x1 - x, 0.9 + Math.random() * 1.1); if (len > 0.2) boards.push({ x: Math.max(x, x0), z, len: len - Math.max(0, x0 - x), c: col(0x6b3f2a, 0.14) }); x += len; }
    }
    { // one instanced mesh: each board its own length and tone, a hair of a gap between them
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.12 }), boards.length), m = new THREE.Matrix4();
      boards.forEach((b, i) => { m.makeScale(Math.max(0.1, b.len - 0.04), 0.2, 0.31).setPosition(b.x + b.len / 2, -0.1, b.z + 0.165); mesh.setMatrixAt(i, m); mesh.setColorAt(i, b.c); });
      mesh.receiveShadow = true; S.add(mesh);
    }
    box(x0 - 0.5, -1.2, zBack - 0.5, x1 + 0.5, -0.2, zFront + 0.5, 0x7d7368, 0.08, 0.5); // stone base under the boards (its top just under them: no flicker)

    // the back wall: a red temple — stone plinth, red pillars, white panels, a dark curved roof
    const wz = zBack - 1.6;
    box(x0 - 2, 0, wz - 2, x1 + 2, 1, wz + 1.2, 0x8a8075);               // plinth
    box((x0 + x1) / 2 - 2, 0, wz + 1.2, (x0 + x1) / 2 + 2, 0.5, zBack - 0.5, 0x8a8075); // steps down to the floor
    for (let x = x0 - 1; x <= x1 + 1; x += 3.5) box(x, 1, wz, x + 0.75, 6, wz + 0.75, 0xa0201e, 0.05);   // pillars
    box(x0 - 1, 1, wz + 0.25, x1 + 1.5, 5.5, wz + 0.5, 0xe9dcc2, 0.04);                                  // white wall panels
    box(x0 - 1, 5.25, wz - 0.25, x1 + 1.5, 6, wz + 1, 0x7a1414, 0.05);                                 // red beam
    for (let i = 0; i < 4; i++) box(x0 - 2.5 + i * 0.25, 6 + i * 0.5, wz - 1 + i * 0.25, x1 + 3 - i * 0.25, 6.5 + i * 0.5, wz + 2 - i * 0.5, 0x2a2430, 0.05); // stepped roof
    box(x0 - 3, 6, wz + 1.5, x0 - 1.5, 6.5, wz + 2.3, 0x2a2430); box(x1 + 2, 6, wz + 1.5, x1 + 3.5, 6.5, wz + 2.3, 0x2a2430); // upturned eaves
    // lanterns on the temple and along the floor's back edge
    const lantern = (x: number, y: number, z: number, glowY: number, light = true) => { // (few real lights: each one costs every pixel)
      box(x - 0.25, y, z - 0.25, x + 0.25, y + 0.75, z + 0.25, 0xffd08a, 0.02);
      if (!light) return;
      const L = new THREE.PointLight(0xff9a40, 9, 10, 1.6); L.position.set(x, glowY, z + 0.4); S.add(L); this.lanterns.push(L);
    };
    for (let x = x0; x <= x1; x += (x1 - x0) / 3) lantern(x, 4, wz + 0.75, 4.4);
    // stone lanterns at the floor's back corners
    for (const x of [x0 - 2.75, x1 + 2.75]) for (const zc of [zBack + 1, (zBack + zFront) / 2, zFront - 1]) { // stone lanterns down both sides, past the fences
      box(x - 0.5, 0, zc - 0.5, x + 0.5, 0.5, zc + 0.5, 0x8d8579); box(x - 0.25, 0.5, zc - 0.25, x + 0.25, 1.5, zc + 0.25, 0x8d8579); box(x - 0.5, 1.5, zc - 0.5, x + 0.5, 2.25, zc + 0.5, 0x8d8579);
      lantern(x, 1.6, zc, 1.9, false);
    }

    // cherry trees behind the corners: trunks and pink blossom clouds
    const tree = (x: number, z: number, s: number) => {
      box(x - 0.25, 0, z - 0.25, x + 0.25, 3 * s, z + 0.25, 0x3b2418);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 2.2 * s;
        const cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r * 0.7, cy = 3 * s + Math.random() * 1.8 * s;
        box(Math.round(cx / V) * V, Math.round(cy / V) * V, Math.round(cz / V) * V, Math.round(cx / V) * V + 0.75, Math.round(cy / V) * V + 0.5, Math.round(cz / V) * V + 0.75, i % 3 ? 0xf2a0c0 : 0xffc6da, 0.05);
      }
    };
    tree(x0 - 2.5, zBack - 1.5, 1.2); tree(x1 + 2.5, zBack - 1.5, 1.2); tree(x0 + 2, wz - 4, 1.4); tree(x1 - 2, wz - 4, 1.4);
    // side walls (low stone fences) so the room reads closed
    box(x0 - 1.25, 0, zBack - 0.5, x0 - 0.75, 1.25, zFront + 0.5, 0x8a8075); box(x1 + 0.75, 0, zBack - 0.5, x1 + 1.25, 1.25, zFront + 0.5, 0x8a8075);
    // far hills and a pagoda against the sunset
    for (let i = 0; i < 9; i++) { const x = x0 - 20 + i * ((x1 - x0 + 40) / 8); box(x, 0, wz - 25, x + 6, 3 + Math.random() * 6, wz - 19, 0x3d2a40, 0.05, 1); }
    box((x0 + x1) / 2 + 9, 8, wz - 22, (x0 + x1) / 2 + 12, 16, wz - 19, 0x5a2a30, 0.04, 0.5);

    // the koi pond in front of the floor (seen past the railing)
    const pond = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 30, 14), new THREE.MeshStandardMaterial({ color: 0x14303a, roughness: 0.08, metalness: 0.6 }));
    pond.rotation.x = -Math.PI / 2; pond.position.set((x0 + x1) / 2, -0.7, zFront + 7.5); S.add(pond);

    this.addVoxels(S, vox);
    // the railing in front (its own scene: drawn over the fighters) — low wooden posts and rails, lanterns on posts
    const rv: typeof vox = [];
    const rbox = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, hex: number) => {
      for (let x = ax; x < bx - 1e-6; x += V) for (let y = ay; y < by - 1e-6; y += V) for (let z = az; z < bz - 1e-6; z += V) rv.push({ p: new THREE.Vector3(x + V / 2, y + V / 2, z + V / 2), c: col(hex, 0.06) });
    };
    const rz = zFront + 1.4;
    for (let x = x0 - 1; x <= x1 + 1; x += 2.5) rbox(x, -0.5, rz, x + 0.5, 1.25, rz + 0.5, 0x5a2a1a);
    rbox(x0 - 1, 0.75, rz + 0.125, x1 + 1.5, 1.0, rz + 0.375, 0x7a3a22);
    rbox(x0 - 1, 0.25, rz + 0.125, x1 + 1.5, 0.5, rz + 0.375, 0x7a3a22);
    this.front3.add(new THREE.HemisphereLight(0xffc9a8, 0x2a2440, 1.3));
    const fsun = new THREE.DirectionalLight(0xffa86a, 1.6); fsun.position.copy(sun.position); this.front3.add(fsun);
    this.addVoxels(this.front3, rv, false);
    for (let x = x0 + 1.5; x <= x1; x += 7.5) { const L = new THREE.PointLight(0xff9a40, 5, 7, 1.6); L.position.set(x, 1.4, rz - 0.6); this.front3.add(L); } // (the rail's warm light, no block of a lamp in the way)
    this.addVoxels(this.front3, rv.splice(0), false);

    // drifting petals
    const n = 260, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = x0 - 5 + Math.random() * (x1 - x0 + 10); pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = wz - 4 + Math.random() * (zFront - wz + 8); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.petals = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffb3cf, size: 0.12, transparent: true, opacity: 0.85, depthWrite: false }));
    S.add(this.petals);
  }

  private addVoxels(S: THREE.Scene, list: { p: THREE.Vector3; c: THREE.Color; s?: THREE.Vector3 }[], shadow = true): void {
    if (!list.length) return;
    const geo = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.02 });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4();
    list.forEach((v, i) => { const s = v.s?.x ?? V; m.makeScale(s, s, s).setPosition(v.p); mesh.setMatrixAt(i, m); mesh.setColorAt(i, v.c); });
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    S.add(mesh);
  }

  // ------------------------------------------------------------------ the camera

  /** Follow the fight: the fighters' midpoint ahead, pulled back as they part, turned a little as it slides. */
  step(ms: number): void {
    this.t += ms;
    const f = this.focus, F = this.floor, k = Math.min(1, (ms / 16) * CAM.follow);
    const want = new THREE.Vector3(this.w3(f.x), this.h3(Math.min(160, f.z * 0.4)) + CAM.aim, this.d3(f.y));
    this.look.lerp(want, this.look.lengthSq() ? k : 1);
    const cx = (F.x0 + F.x1) / 2, half = Math.max(1, (F.x1 - F.x0) / 2);
    this.yaw += ((-Phaser.Math.Clamp((f.x - cx) / half, -1, 1) * CAM.yawMax) - this.yaw) * k;
    this.dist += (Math.min(CAM.distMax, CAM.dist + this.w3(f.span) * CAM.distPerSpan) / this.punch - this.dist) * k;
    this.place(false);
    for (const [i, L] of this.lanterns.entries()) L.intensity = 8 + Math.sin(this.t / 140 + i * 1.7) * 0.9 + Math.sin(this.t / 53 + i) * 0.4; // flicker
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
