// Paper lanterns hanging from the eaves: each swings on its cord in the wind — a lazy pendulum, a little out of step
// with its neighbours, flung wide by a gust and settling again — its warm glow swinging with it. Built here (not merged
// with the room) so they can move: a cord, two dark caps, the lit paper body, a tassel.
import * as THREE from 'three';
import { Life, Wind, rng, tex, dotCanvas } from './kit';

export interface LanternAt { x: number; y: number; z: number }

export function paperLanterns(scene: THREE.Scene, at: LanternAt[], opts: { wind: Wind; seed?: number; drop?: number; color?: number; glow?: number }): Life {
  const R = rng(opts.seed ?? 41), drop = opts.drop ?? 0.4;
  const paper = new THREE.MeshStandardMaterial({ color: opts.color ?? 0xd8442c, emissive: opts.glow ?? 0xff6a2a, emissiveIntensity: 1.6, roughness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.7 });
  const cord = new THREE.MeshStandardMaterial({ color: 0x2a1e18, roughness: 0.9 });
  const tassel = new THREE.MeshStandardMaterial({ color: 0xc8a040, roughness: 0.9 });
  const glowTex = tex(dotCanvas(0.18, 128));
  const body = new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.2, 0.08], [0.22, 0.22], [0.2, 0.38], [0.12, 0.46], [0, 0.46]].map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h)), 18);
  const cap = new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), line = new THREE.CylinderGeometry(0.012, 0.012, drop, 6), tas = new THREE.CylinderGeometry(0.012, 0.03, 0.12, 8);
  const groups: { g: THREE.Group; ph: number; L: number; a: number; b: number; va: number; vb: number }[] = [];
  const disposables: { dispose(): void }[] = [paper, wood, cord, tassel, glowTex, body, cap, line, tas];
  for (const p of at) {
    // the pivot at the hanging point; the lantern hangs `drop` below it
    const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); scene.add(g);
    const c = new THREE.Mesh(line, cord); c.position.y = -drop / 2; g.add(c);
    const top = new THREE.Mesh(cap, wood); top.position.y = -drop - 0.025; g.add(top);
    const b = new THREE.Mesh(body, paper); b.position.y = -drop - 0.5; g.add(b);
    const bot = new THREE.Mesh(cap, wood); bot.position.y = -drop - 0.5 - 0.025; g.add(bot);
    const t = new THREE.Mesh(tas, tassel); t.position.y = -drop - 0.5 - 0.11; g.add(t);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7a3a, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.position.y = -drop - 0.27; s.scale.set(1.3, 1.3, 1); g.add(s); disposables.push(s.material);
    groups.push({ g, ph: R() * 6.28, L: drop + 0.27, a: 0, b: 0, va: 0, vb: 0 });
  }
  const update = (ms: number, t: number) => {
    const dt = Math.min(0.05, ms / 1000), w = opts.wind;
    for (const l of groups) {
      // a damped pendulum driven by the wind (steady: a small lean and sway; a gust: a shove downwind)
      const g0 = 9.8 / l.L;
      const push = (w.x * 0.08 + Math.sin(t * 0.9 + l.ph) * 0.05 + w.gust * w.dir * 0.9) * g0;
      l.va += (-g0 * Math.sin(l.a) + push - l.va * 0.5) * dt; l.a += l.va * dt;
      l.vb += (-g0 * Math.sin(l.b) + (w.z * 0.08 + Math.cos(t * 0.7 + l.ph) * 0.04) * g0 - l.vb * 0.5) * dt; l.b += l.vb * dt;
      l.g.rotation.set(-l.b, 0, l.a); // (a turn of +a about z carries the hanging body to +x; of -b about x, to +z)
    }
  };
  return { update, dispose: () => { for (const l of groups) scene.remove(l.g); for (const d of disposables) d.dispose(); } };
}
