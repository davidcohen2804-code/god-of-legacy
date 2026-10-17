// Incense: a bronze censer on its three legs, a thread of smoke rising from it — slow, curling, thinning as it climbs,
// bent by the breeze and torn sideways by a gust; a tiny ember glow in the bowl.
import * as THREE from 'three';
import { Life, Wind, Puffs, rng, tex, smokeCanvas, dotCanvas } from './kit';

export interface CenserAt { x: number; y: number; z: number }

export function incense(scene: THREE.Scene, at: CenserAt[], opts: { wind: Wind; seed?: number; rate?: number; color?: number; soft?: boolean }): Life {
  const R = rng(opts.seed ?? 53), rate = opts.rate ?? 7;
  const bronze = new THREE.MeshStandardMaterial({ color: 0x7a5a30, metalness: 0.85, roughness: 0.38 });
  const ember = new THREE.MeshStandardMaterial({ color: 0x3a2018, emissive: 0xff5a1a, emissiveIntensity: 1.2, roughness: 0.9 });
  const bowl = new THREE.LatheGeometry([[0.02, 0], [0.09, 0], [0.13, 0.03], [0.15, 0.1], [0.14, 0.17], [0.16, 0.19], [0.15, 0.21], [0.12, 0.21], [0.13, 0.19], [0.12, 0.17], [0.11, 0.1]].map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h)), 20);
  const lid = new THREE.LatheGeometry([[0.0001, 0.3], [0.03, 0.3], [0.04, 0.27], [0.1, 0.24], [0.13, 0.21], [0.0001, 0.21]].map(([r, h]) => new THREE.Vector2(r, h)), 20);
  const leg = new THREE.CylinderGeometry(0.014, 0.02, 0.07, 8), coal = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12);
  const glowTex = tex(dotCanvas(0.2));
  const meshes: THREE.Object3D[] = [];
  for (const p of at) {
    const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); scene.add(g); meshes.push(g);
    const b = new THREE.Mesh(bowl, bronze); b.position.y = 0.06; b.castShadow = true; g.add(b);
    const l = new THREE.Mesh(lid, bronze); l.position.y = 0.06; l.castShadow = true; g.add(l);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const m = new THREE.Mesh(leg, bronze); m.position.set(Math.cos(a) * 0.09, 0.035, Math.sin(a) * 0.09); g.add(m); }
    const c = new THREE.Mesh(coal, ember); c.position.y = 0.18; g.add(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7030, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.position.y = 0.24; s.scale.set(0.35, 0.35, 1); g.add(s);
  }
  const puffs = new Puffs(opts.soft ? 70 : 160, tex(smokeCanvas()), false); scene.add(puffs.pts);
  let acc = 0;
  const colour = opts.color ?? 0xd9dde4;
  const update = (ms: number, t: number) => {
    const dt = Math.min(0.05, ms / 1000), w = opts.wind;
    acc += dt * rate * at.length;
    while (acc >= 1) {
      acc -= 1;
      const p = at[(R() * at.length) | 0];
      puffs.emit(p.x + (R() - 0.5) * 0.03, p.y + 0.3, p.z + (R() - 0.5) * 0.03, (R() - 0.5) * 0.04, 0.16 + R() * 0.08, (R() - 0.5) * 0.04, colour, 0.05 + R() * 0.03, 5200 + R() * 2200, { a: 0.1 + R() * 0.06, grow: 0.075, drag: 0.6 });
    }
    puffs.push((w.x * 0.12 + w.gust * w.dir * 1.2) * dt, 0, w.z * 0.12 * dt);
    puffs.step(ms, 0.05, t);
  };
  return {
    update,
    dispose: () => { for (const m of meshes) scene.remove(m); scene.remove(puffs.pts); puffs.dispose(); bronze.dispose(); ember.dispose(); bowl.dispose(); lid.dispose(); leg.dispose(); coal.dispose(); glowTex.dispose(); },
  };
}
