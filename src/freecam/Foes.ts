// The free-camera trial's foes: jelly slimes (a starter monster that reads from every side: a glossy drop with a face),
// and their king — a big foe with telegraphed blows (GPT's direction: "at least one simple larger enemy with a
// recognizable attack telegraph"): a leap onto a marked circle, a stomp round itself. Positions in room units.
import * as THREE from 'three';

export interface FoeCtx {
  t: number;
  ground(x: number, z: number): number;
  /** May a body stand at (x, z)? */
  free(x: number, z: number): boolean;
  /** The party (hero and allies) alive: who a foe may chase. */
  party: { id: string; x: number; z: number }[];
  /** A blow lands on a party member. */
  strike(id: string, dmg: number, fromX: number, fromZ: number): void;
  /** The king's moments: a telegraph shown, a blow landing (for the effects and the allies' dodge). */
  warn(x: number, z: number, r: number, ms: number): void;
  slam(x: number, z: number, r: number, big: boolean): void;
  pop(x: number, z: number, color: number, big: boolean): void;
}

export interface SlimeKind { name: string; lv: number; hp: number; color: number; deep: number; scale: number }
export const SLIME_KINDS: SlimeKind[] = [
  { name: 'Moss Jelly', lv: 3, hp: 160, color: 0x8fdc6a, deep: 0x3f8f3a, scale: 0.3 },
  { name: 'Brook Jelly', lv: 4, hp: 210, color: 0x78c4ff, deep: 0x2f63c4, scale: 0.32 },
  { name: 'Blossom Jelly', lv: 5, hp: 260, color: 0xffa6cc, deep: 0xc94a86, scale: 0.34 },
];
export const KING: SlimeKind = { name: 'King Jelly', lv: 12, hp: 6000, color: 0xb48cff, deep: 0x5b37b8, scale: 1.05 };

let nextId = 1;

/** A drop of jelly: a soft flat base a little wider at the floor, a round body, the tip of the drop on top (height 1.64,
 *  width 2.2 at the base before its scale). */
function dropGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 48, 32);
  const p = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let { x, y, z } = v;
    if (y < 0) { y *= 0.42; const k = 1 + -y * 0.25; x *= k; z *= k; }
    if (y > 0.55) { const k = (y - 0.55) / 0.45; x *= 1 - 0.3 * k; z *= 1 - 0.3 * k; y += 0.22 * k * k; }
    p.setXYZ(i, x, y + 0.42, z);
  }
  g.computeVertexNormals();
  return g;
}
const DROP = dropGeometry();
const EYE = new THREE.SphereGeometry(1, 20, 14);
const SMILE = new THREE.TorusGeometry(0.11, 0.024, 8, 18, Math.PI);
const BLUSH = new THREE.CircleGeometry(0.1, 20);
const PICK = new THREE.SphereGeometry(1, 10, 8);
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b1424, roughness: 0.18, metalness: 0.05 });
const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const mouthMat = new THREE.MeshStandardMaterial({ color: 0x2a1420, roughness: 0.5 });
const blushMat = new THREE.MeshBasicMaterial({ color: 0xff7aa8, transparent: true, opacity: 0.45, depthWrite: false });
const pickMat = new THREE.MeshBasicMaterial({ visible: false });
const WHITE = new THREE.Color(0xffffff);

export class Slime {
  readonly id = nextId++;
  readonly root = new THREE.Group();
  /** The ray's target (a generous invisible ball round the body). */
  readonly pick: THREE.Mesh;
  readonly kind: SlimeKind;
  readonly boss: boolean;
  hp: number; maxHp: number; alive = true;
  x: number; z: number; y = 0;
  /** Its reach for a blow (units) and its height (the name over it). */
  readonly radius: number; readonly height: number;
  yaw = Math.random() * Math.PI * 2;
  /** Struck lately (ms): its plate stays shown. */
  shownFor = 0;
  /** Who it hunts (a party member's id) once struck. */
  aggro: string | null = null;
  protected body: THREE.Mesh; protected mat: THREE.MeshPhysicalMaterial; protected face = new THREE.Group();
  protected shell = new THREE.Group();
  protected flash = 0;
  protected hop: { t: number; ms: number; fx: number; fz: number; tx: number; tz: number; h: number } | null = null;
  protected wait = 600 + Math.random() * 2400;
  protected deadMs = 0; protected spawnK = 1;
  protected bumpCd = 0;
  protected knock = { x: 0, z: 0 };
  constructor(kind: SlimeKind, readonly home: { x: number; z: number }, boss = false) {
    this.kind = kind; this.boss = boss; this.maxHp = this.hp = kind.hp;
    this.x = home.x; this.z = home.z;
    const s = kind.scale;
    this.radius = 1.0 * s + 0.12; this.height = 1.7 * s;
    this.mat = new THREE.MeshPhysicalMaterial({ color: kind.color, roughness: 0.24, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.6, sheenColor: new THREE.Color(kind.color).lerp(new THREE.Color(0xffffff), 0.5), sheenRoughness: 0.4, emissive: new THREE.Color(kind.deep), emissiveIntensity: 0.18, envMapIntensity: 0.9 });
    this.body = new THREE.Mesh(DROP, this.mat); this.body.castShadow = true;
    // the face, on the front of the drop (+z): two big glossy eyes with their shine, a small smile, a blush
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(EYE, eyeMat); e.scale.set(0.13, 0.19, 0.08); e.position.set(side * 0.3, 0.86, 0.86); e.lookAt(side * 0.6, 0.86, 2); this.face.add(e);
      const sh = new THREE.Mesh(EYE, shineMat); sh.scale.setScalar(0.045); sh.position.set(side * 0.3 + 0.04, 0.94, 0.93); this.face.add(sh);
      const sh2 = new THREE.Mesh(EYE, shineMat); sh2.scale.setScalar(0.022); sh2.position.set(side * 0.3 - 0.035, 0.8, 0.935); this.face.add(sh2);
      const b = new THREE.Mesh(BLUSH, blushMat); b.position.set(side * 0.52, 0.66, 0.81); b.lookAt(side * 1.4, 0.66, 2.4); this.face.add(b);
    }
    const m = new THREE.Mesh(SMILE, mouthMat); m.rotation.z = Math.PI; m.position.set(0, 0.7, 0.96); m.rotation.x = -0.25; this.face.add(m);
    this.shell.add(this.body, this.face);
    this.shell.scale.setScalar(s);
    this.root.add(this.shell);
    this.pick = new THREE.Mesh(PICK, pickMat); this.pick.scale.setScalar(this.radius + 0.15); this.pick.position.y = this.height * 0.5; this.root.add(this.pick);
    this.pick.userData.foe = this;
  }

  get center(): THREE.Vector3 { return new THREE.Vector3(this.x, this.y + this.height * 0.5, this.z); }

  /** Seen through (0..1 of its body): the king between the camera and the hero. */
  seeThrough(k: number): void {
    const o = 1 - 0.6 * k;
    if (Math.abs(this.mat.opacity - o) < 0.01) return;
    this.mat.transparent = true; this.mat.opacity = o; this.mat.depthWrite = o > 0.98;
  }

  /** A blow taken: its flash and squash, a small push away, the hunt begins. True when it falls. */
  hurt(dmg: number, fromX: number, fromZ: number, by: string): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - dmg); this.flash = 1; this.shownFor = 6000;
    if (!this.aggro) this.aggro = by;
    const dx = this.x - fromX, dz = this.z - fromZ, d = Math.hypot(dx, dz) || 1, k = this.boss ? 0.02 : 0.22;
    this.knock.x += (dx / d) * k; this.knock.z += (dz / d) * k;
    if (this.hp <= 0) { this.alive = false; this.deadMs = 0; this.hop = null; return true; }
    return false;
  }

  update(ms: number, c: FoeCtx): void {
    const dt = ms / 1000, s = this.kind.scale;
    this.shownFor = Math.max(0, this.shownFor - ms);
    this.flash = Math.max(0, this.flash - dt * (this.boss ? 10 : 6)); // (the king takes many blows a second: a short, soft flash)
    this.mat.emissive.setHex(this.kind.deep).lerp(WHITE, this.flash * (this.boss ? 0.22 : 0.85)); this.mat.emissiveIntensity = 0.18 + this.flash * (this.boss ? 0.25 : 0.9);
    if (!this.alive) { this.dying(ms, c); return; }
    if (this.spawnK < 1) this.spawnK = Math.min(1, this.spawnK + dt * 2.5);
    // a push taken slides out
    if (Math.abs(this.knock.x) + Math.abs(this.knock.z) > 0.001) {
      const nx = this.x + this.knock.x * Math.min(1, dt * 8), nz = this.z + this.knock.z * Math.min(1, dt * 8);
      if (c.free(nx, nz)) { this.x = nx; this.z = nz; }
      this.knock.x *= Math.max(0, 1 - dt * 8); this.knock.z *= Math.max(0, 1 - dt * 8);
    }
    this.bumpCd = Math.max(0, this.bumpCd - ms);
    this.think(ms, c);
    // the hop: a crouch, up and along, a squash on landing; standing: a slow wobble
    let sy = 1 + Math.sin(c.t * 3.6 + this.id) * 0.045, lift = 0;
    if (this.hop) {
      const h = this.hop; h.t += ms;
      const k = Math.min(1, h.t / h.ms);
      if (k < 0.18) sy = 1 - 0.22 * (k / 0.18);
      else if (k < 0.88) { const a = (k - 0.18) / 0.7; lift = Math.sin(a * Math.PI) * h.h; sy = 0.95 + 0.2 * Math.sin(a * Math.PI) - 0.1 * a; const nx = h.fx + (h.tx - h.fx) * a, nz = h.fz + (h.tz - h.fz) * a; if (c.free(nx, nz)) { this.x = nx; this.z = nz; } }
      else sy = 0.8 + 0.2 * ((k - 0.88) / 0.12);
      if (k >= 1) this.hop = null;
    }
    const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
    this.shell.scale.set(s * sxz * this.spawnK, s * sy * this.spawnK, s * sxz * this.spawnK);
    this.y = c.ground(this.x, this.z);
    this.root.position.set(this.x, this.y + lift, this.z);
    this.root.rotation.y += Math.atan2(Math.sin(this.yaw - this.root.rotation.y), Math.cos(this.yaw - this.root.rotation.y)) * Math.min(1, dt * 8);
    this.root.visible = true;
  }

  /** What it does: hunts who struck it (a hop toward, a bump at reach), else wanders round its home. */
  protected think(ms: number, c: FoeCtx): void {
    const prey = this.aggro ? c.party.find((p) => p.id === this.aggro) : undefined;
    if (this.aggro && !prey) this.aggro = null;
    if (this.hop) return;
    if (prey) {
      const dx = prey.x - this.x, dz = prey.z - this.z, d = Math.hypot(dx, dz);
      this.yaw = Math.atan2(dx, dz);
      if (d > 0.62 + this.radius * 0.5) { const step = Math.min(d - 0.5, 0.9); this.jump(this.x + (dx / d) * step, this.z + (dz / d) * step, 420, 0.2); }
      else if (this.bumpCd <= 0) { this.bumpCd = 1500; this.jump(this.x + (dx / d) * 0.15, this.z + (dz / d) * 0.15, 300, 0.12); c.strike(prey.id, 10 + Math.round(Math.random() * 6) + this.kind.lv, this.x, this.z); }
      return;
    }
    this.wait -= ms;
    if (this.wait > 0) return;
    this.wait = 1400 + Math.random() * 2600;
    const a = Math.random() * Math.PI * 2, r = Math.random() * 1.8, tx = this.home.x + Math.cos(a) * r, tz = this.home.z + Math.sin(a) * r;
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (d < 0.2) return;
    this.yaw = Math.atan2(dx, dz);
    const step = Math.min(d, 0.7); this.jump(this.x + (dx / d) * step, this.z + (dz / d) * step, 520, 0.18);
  }

  protected jump(tx: number, tz: number, ms: number, h: number): void { this.hop = { t: 0, ms, fx: this.x, fz: this.z, tx, tz, h }; }

  /** Down: it splashes flat and fades; back a while later near its home, popping up. */
  protected dying(ms: number, c: FoeCtx): void {
    this.deadMs += ms;
    const s = this.kind.scale, k = Math.min(1, this.deadMs / 320);
    if (this.deadMs - ms <= 0) c.pop(this.x, this.z, this.kind.color, this.boss);
    this.shell.scale.set(s * (1 + k * 0.5), s * Math.max(0.02, 1 - k), s * (1 + k * 0.5));
    this.root.visible = k < 1;
    if (this.deadMs > (this.boss ? 12000 : 6000)) this.respawn();
  }
  protected respawn(): void {
    const a = Math.random() * Math.PI * 2, r = this.boss ? 0 : Math.random() * 1.5;
    this.x = this.home.x + Math.cos(a) * r; this.z = this.home.z + Math.sin(a) * r;
    this.hp = this.maxHp; this.alive = true; this.aggro = null; this.spawnK = 0.05; this.flash = 0.6; this.wait = 1500;
  }
}

/** The king: a big drop with a crown. Struck, it fights the party: it hops after its prey and every few seconds marks
 *  a blow on the floor first — a leap onto a circle under its prey, or a stomp round itself — and the blow lands
 *  when the mark has filled. */
export class KingSlime extends Slime {
  /** The blow marked now: where, its reach, how long until it lands (ms) and how long it was shown. */
  warning: { kind: 'leap' | 'stomp'; x: number; z: number; r: number; left: number; ms: number } | null = null;
  private nextBlow = 3500;
  private crown = new THREE.Group();
  constructor(home: { x: number; z: number }) {
    super(KING, home, true);
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.85, roughness: 0.28, emissive: 0x6a4a10, emissiveIntensity: 0.25, side: THREE.DoubleSide });
    const gem = new THREE.MeshStandardMaterial({ color: 0xff3d6e, metalness: 0.2, roughness: 0.1, emissive: 0x801030, emissiveIntensity: 0.6 });
    this.crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.18, 28, 1, true), gold));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 10), gold); sp.position.set(Math.sin(a) * 0.43, 0.2, Math.cos(a) * 0.43); this.crown.add(sp);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), gem); b.position.set(Math.sin(a) * 0.43, 0.35, Math.cos(a) * 0.43); this.crown.add(b);
    }
    const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), gem); g.position.set(0, 0.02, 0.47); this.crown.add(g);
    this.crown.position.set(0, 1.42, -0.04); this.crown.rotation.x = -0.12;
    this.crown.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
    this.shell.add(this.crown);
  }
  protected think(ms: number, c: FoeCtx): void {
    const prey = this.aggro ? c.party.find((p) => p.id === this.aggro) ?? c.party[0] : undefined;
    if (!prey) { this.aggro = null; this.warning = null; return; }
    if (this.warning) {
      const w = this.warning; w.left -= ms;
      if (w.kind === 'leap' && w.left <= 520 && !this.hop) { this.jump(w.x, w.z, 520, 2.2); this.hop!.t = 520 - Math.max(0, w.left); } // (in the air the last 520 ms, coming down on the mark)
      if (w.left <= 0) { c.slam(w.x, w.z, w.r, w.kind === 'leap'); if (w.kind === 'leap') { this.x = w.x; this.z = w.z; } this.warning = null; this.nextBlow = 4200 + Math.random() * 1800; }
      return;
    }
    if (this.hop) return;
    this.nextBlow -= ms;
    const dx = prey.x - this.x, dz = prey.z - this.z, d = Math.hypot(dx, dz);
    this.yaw = Math.atan2(dx, dz);
    if (this.nextBlow <= 0) {
      const near = c.party.filter((p) => Math.hypot(p.x - this.x, p.z - this.z) < 3.2).length;
      // a stomp when the party crowds it, else a leap onto one of them (the hero most often: he must see it coming)
      const pick = Math.random() < 0.55 ? c.party.find((p) => p.id === 'hero') ?? prey : c.party[Math.floor(Math.random() * c.party.length)];
      if (near >= 2 && Math.random() < 0.6) this.warning = { kind: 'stomp', x: this.x, z: this.z, r: 3.4, left: 1300, ms: 1300 };
      else this.warning = { kind: 'leap', x: pick.x, z: pick.z, r: 2.4, left: 1500, ms: 1500 };
      c.warn(this.warning.x, this.warning.z, this.warning.r, this.warning.ms);
      return;
    }
    if (d > 2.0) { const step = Math.min(d - 1.6, 1.1); this.jump(this.x + (dx / d) * step, this.z + (dz / d) * step, 700, 0.35); }
    else if (this.bumpCd <= 0) { this.bumpCd = 1800; c.strike(prey.id, 16 + Math.round(Math.random() * 8), this.x, this.z); this.jump(this.x + (dx / d) * 0.2, this.z + (dz / d) * 0.2, 360, 0.2); }
  }
  update(ms: number, c: FoeCtx): void {
    super.update(ms, c);
    // the crouch before a blow: it gathers itself as the mark fills
    if (this.alive && this.warning && !this.hop) {
      const k = 1 - this.warning.left / this.warning.ms, s = this.kind.scale, sy = 1 - 0.18 * Math.min(1, k * 1.4), sxz = 1 / Math.sqrt(sy);
      this.shell.scale.set(s * sxz, s * sy, s * sxz);
    }
  }
  protected respawn(): void { super.respawn(); this.warning = null; this.nextBlow = 3500; }
}
