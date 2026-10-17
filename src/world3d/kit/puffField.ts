// A field of soft puffs (cloud volumes, mist banks) drawn as one points cloud per texture instead of a sprite each: a
// sky of three hundred puffs was three hundred draws. Each puff keeps its place, size (world units, shrinking with
// distance like a sprite), tint, alpha and its own slow drift; a gust shoves them all one way.
import * as THREE from 'three';
import type { Disposable } from './units';

export class PuffField implements Disposable {
  private sets: { tex: THREE.Texture; pos: number[]; size: number[]; col: number[]; alpha: number[]; ph: number[]; k: number[] }[];
  private points: THREE.Points[] = [];
  private mats: THREE.ShaderMaterial[] = [];
  private n = 0;
  private v2 = new THREE.Vector2();
  constructor(private scene: THREE.Scene, textures: THREE.Texture[], private fog = true) {
    this.sets = textures.map((tex) => ({ tex, pos: [], size: [], col: [], alpha: [], ph: [], k: [] }));
  }
  /** A puff at (x, y, z): `size` across (units), its tint and alpha, `k` its drift rate (0 = still). */
  add(x: number, y: number, z: number, size: number, color: THREE.Color | number, alpha = 0.8, k = 0.7, ph = Math.random() * 10): void {
    const s = this.sets[this.n++ % this.sets.length], c = color instanceof THREE.Color ? color : new THREE.Color(color);
    s.pos.push(x, y, z); s.size.push(size); s.col.push(c.r, c.g, c.b); s.alpha.push(alpha); s.ph.push(ph); s.k.push(k);
  }
  /** The field made (once everything is added). */
  build(): this {
    for (const s of this.sets) {
      if (!s.size.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
      g.setAttribute('psize', new THREE.Float32BufferAttribute(s.size, 1));
      g.setAttribute('pcolor', new THREE.Float32BufferAttribute(s.col, 3));
      g.setAttribute('palpha', new THREE.Float32BufferAttribute(s.alpha, 1));
      g.setAttribute('pph', new THREE.Float32BufferAttribute(s.ph, 1));
      g.setAttribute('pk', new THREE.Float32BufferAttribute(s.k, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: s.tex }, vh: { value: 900 }, uTime: { value: 0 }, uGust: { value: 0 }, fogColor: { value: new THREE.Color(0xffffff) }, fogNear: { value: 1 }, fogFar: { value: 1000 } },
        vertexShader: 'attribute float psize; attribute float palpha; attribute vec3 pcolor; attribute float pph; attribute float pk; uniform float vh; uniform float uTime; uniform float uGust; varying float vA; varying vec3 vC; varying float vFog;\n'
          + 'void main() { vA = palpha; vC = pcolor; vec3 p = position; p.x += sin(uTime * 0.11 * pk + pph) * 0.12 + uGust * 0.6 * pk; p.y += sin(uTime * 0.5 + pph) * 0.02 * pk;\n'
          + ' vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = psize * projectionMatrix[1][1] * vh * 0.5 / max(0.2, -mv.z); gl_Position = projectionMatrix * mv; vFog = -mv.z; }',
        fragmentShader: 'uniform sampler2D map; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying float vA; varying vec3 vC; varying float vFog;\n'
          + 'void main() { vec4 t = texture2D(map, gl_PointCoord); float a = t.a * vA; if (a < 0.004) discard; vec3 c = vC * t.rgb;'
          + (this.fog ? ' float f = smoothstep(fogNear, fogFar, vFog); c = mix(c, fogColor, f);' : '')
          + ' gl_FragColor = vec4(c, a); }',
        transparent: true, depthWrite: false, depthTest: true,
      });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
      pts.onBeforeRender = (renderer, scene) => { mat.uniforms.vh.value = renderer.getDrawingBufferSize(this.v2).y; const fog = (scene as THREE.Scene).fog as THREE.Fog | null; if (fog) { mat.uniforms.fogColor.value.copy(fog.color); mat.uniforms.fogNear.value = fog.near; mat.uniforms.fogFar.value = fog.far; } };
      this.scene.add(pts); this.points.push(pts); this.mats.push(mat);
    }
    return this;
  }
  /** Each frame: the time and the gust (signed: its strength the way it blows). */
  update(t: number, gust: number): void { for (const m of this.mats) { m.uniforms.uTime.value = t; m.uniforms.uGust.value = gust; } }
  /** Everything to keep out of a pond's mirror (the puffs draw over the water otherwise). */
  get objects(): THREE.Object3D[] { return this.points; }
  dispose(): void { for (const p of this.points) { this.scene.remove(p); p.geometry.dispose(); } for (const m of this.mats) m.dispose(); }
}
