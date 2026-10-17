// Clouds: banks of cloud far behind the place, drifting slowly across the sky in the dusk's colours, darkening with it.
import * as THREE from 'three';
import { Life, rng, tex, cloudCanvas } from './kit';

export interface CloudsAt {
  /** The sky's middle (x), how far the clouds lie behind (z) and how high; how far they drift each way before coming round. */
  cx: number; z: number; y: number; spread: number;
}

export function clouds(scene: THREE.Scene, at: CloudsAt, opts: { n?: number; seed?: number; speed?: number; tint?: number }): Life {
  const R = rng(opts.seed ?? 61), n = opts.n ?? 8;
  const maps = [1, 2, 3].map((k) => tex(cloudCanvas(k * 7)));
  const items: { s: THREE.Sprite; v: number; base: number }[] = [];
  const tint = new THREE.Color(opts.tint ?? 0xffe4dc);
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: maps[i % 3], color: tint.clone(), transparent: true, opacity: 0.55 + R() * 0.3, depthWrite: false, fog: false });
    const s = new THREE.Sprite(m);
    const w = 9 + R() * 14;
    s.scale.set(w, w * 0.5, 1); s.position.set(at.cx + (R() - 0.5) * at.spread * 2, at.y + (R() - 0.5) * 6, at.z - R() * 18);
    s.renderOrder = -0.5; scene.add(s); items.push({ s, v: (opts.speed ?? 0.09) * (0.6 + R() * 0.8), base: m.opacity });
  }
  const update = (ms: number, _t: number, dim: number) => {
    const dt = Math.min(0.1, ms / 1000);
    for (const c of items) {
      c.s.position.x += c.v * dt;
      if (c.s.position.x > at.cx + at.spread) c.s.position.x -= at.spread * 2;
      (c.s.material as THREE.SpriteMaterial).opacity = c.base * (1 - 0.45 * dim);
      (c.s.material as THREE.SpriteMaterial).color.copy(tint).multiplyScalar(1 - 0.5 * dim);
    }
  };
  return { update, dispose: () => { for (const c of items) { scene.remove(c.s); c.s.material.dispose(); } for (const m of maps) m.dispose(); } };
}
