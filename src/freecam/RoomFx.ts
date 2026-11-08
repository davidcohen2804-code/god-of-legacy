// The free-camera trial's answers for the game's 3D skill pieces (Fx3D): the blows' lights, sparks and dust, rings on the
// floor — what the 3D arena lends them (Arena3D), in one scene: with a free camera everything is sorted by its own depth.
import * as THREE from 'three';
import { mix } from '../arena3d/Fx3D';

function dotTexture(core: number): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(core, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Soft particles (sparks, dust): each its colour, size and fade, falling under its gravity, bouncing off the ground. */
export class Sparks {
  readonly pts: THREE.Points;
  private pos: Float32Array; private vel: Float32Array; private col: Float32Array; private size: Float32Array; private alpha: Float32Array;
  private life: Float32Array; private max: Float32Array; private a0: Float32Array; private grow: Float32Array; private grav: Float32Array; private drag: Float32Array;
  private next = 0;
  private mat: THREE.ShaderMaterial;
  constructor(private n: number, core: number, additive: boolean) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1);
    this.a0 = new Float32Array(n); this.grow = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dotTexture(core) }, scale: { value: 400 } },
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
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, size: number, ms: number, o: { a?: number; grow?: number; grav?: number; drag?: number } = {}): void {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.col.set([((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], i * 3);
    this.size[i] = size; this.life[i] = ms; this.max[i] = ms; this.a0[i] = o.a ?? 1; this.alpha[i] = this.a0[i];
    this.grow[i] = o.grow ?? 0; this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 0;
  }
  step(ms: number, ground: (x: number, z: number) => number): void {
    const dt = ms / 1000;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= ms;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const j = i * 3, d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[j + 1] -= this.grav[i] * dt;
      this.vel[j] *= d; this.vel[j + 1] *= d; this.vel[j + 2] *= d;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      const gy = ground(this.pos[j], this.pos[j + 2]) + 0.02;
      if (this.pos[j + 1] < gy && gy > -5) { this.pos[j + 1] = gy; this.vel[j + 1] = Math.abs(this.vel[j + 1]) * 0.3; this.vel[j] *= 0.6; this.vel[j + 2] *= 0.6; }
      this.size[i] *= 1 + this.grow[i] * dt;
      this.alpha[i] = this.a0[i] * (k < 0.5 ? k * 2 : 1);
    }
    const g = this.pts.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true; (g.attributes.pcolor as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.psize as THREE.BufferAttribute).needsUpdate = true; (g.attributes.palpha as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** The blows' lights (always in the scene: a light switched on or off recompiles every material), dark when idle. */
export class Flares {
  private L: { l: THREE.PointLight; left: number; ms: number; power: number; at: THREE.Vector3 }[] = [];
  constructor(scene: THREE.Scene) {
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 6, 1.6); scene.add(l); this.L.push({ l, left: 0, ms: 1, power: 0, at: new THREE.Vector3() }); }
  }
  flare(hx: number, hy: number, hz: number, color: number, power: number, dist: number, ms: number): void {
    if (![hx, hy, hz, power].every(Number.isFinite)) return;
    const near = this.L.find((h) => h.left > 0 && Math.hypot(h.at.x - hx, h.at.z - hz) < 1.6);
    if (near && near.power * (near.left / near.ms) >= power) return;
    const s = near ?? this.L.reduce((a, b) => (b.left < a.left ? b : a));
    const hsl = { h: 0, s: 0, l: 0 }, c = new THREE.Color(color); c.getHSL(hsl); c.setHSL(hsl.h, Math.min(1, hsl.s * 1.15 + 0.05), Math.min(0.55, hsl.l));
    s.l.color.copy(c); s.l.distance = dist * 1.15; s.l.position.set(hx, Math.max(hy, 1.3), hz); s.at.set(hx, hy, hz);
    s.left = ms; s.ms = ms; s.power = Math.min(power, 40);
  }
  step(ms: number): void {
    for (const h of this.L) {
      if (h.left <= 0) { h.l.intensity = 0; continue; }
      h.left -= ms; const k = Math.max(0, h.left / h.ms);
      h.l.intensity = h.power * (k * k * (3 - 2 * k)) * 0.6;
    }
  }
}

/** Rings on the ground: a crisp band in its colour (and a thin added light along it), growing out and fading. */
export class Rings {
  private tex: THREE.Texture;
  private list: { m: THREE.Mesh; m2: THREE.Mesh; left: number; ms: number; r0: number; r1: number; a: number }[] = [];
  private geo = new THREE.PlaneGeometry(1, 1);
  constructor(private scene: THREE.Scene) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 63);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.8, 'rgba(255,255,255,0)'); gr.addColorStop(0.93, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); this.tex = new THREE.CanvasTexture(c);
  }
  ring(hx: number, hy: number, hz: number, color: number, r1: number, ms: number, a: number): void {
    const hsl = { h: 0, s: 0, l: 0 }, vivid = new THREE.Color(color); vivid.getHSL(hsl); vivid.setHSL(hsl.h, Math.min(1, hsl.s * 1.2 + 0.1), Math.min(0.62, Math.max(0.45, hsl.l)));
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, color: vivid, opacity: a, fog: false });
    const mat2 = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(mix(color, 0xffffff, 0.4)), opacity: a * 0.35, fog: false });
    const m = new THREE.Mesh(this.geo, mat), m2 = new THREE.Mesh(this.geo, mat2);
    for (const x of [m, m2]) { x.rotation.x = -Math.PI / 2; x.position.set(hx, hy + (x === m ? 0.02 : 0.021), hz); x.renderOrder = 3; this.scene.add(x); }
    this.list.push({ m, m2, left: ms, ms, r0: 0.3, r1, a });
  }
  step(ms: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i]; r.left -= ms;
      const k = 1 - Math.max(0, r.left / r.ms), e = 1 - Math.pow(1 - k, 3), s = (r.r0 + (r.r1 - r.r0) * e) * 2;
      for (const x of [r.m, r.m2]) x.scale.set(s, s, 1);
      (r.m.material as THREE.MeshBasicMaterial).opacity = r.a * (1 - k);
      (r.m2.material as THREE.MeshBasicMaterial).opacity = r.a * 0.35 * (1 - k);
      if (r.left <= 0) { for (const x of [r.m, r.m2]) { this.scene.remove(x); (x.material as THREE.Material).dispose(); } this.list.splice(i, 1); }
    }
  }
}
