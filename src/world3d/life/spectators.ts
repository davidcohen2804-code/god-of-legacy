// Onlookers: the game's painted people (the NPC sheets of the open world) standing in the 3D place like the fighters —
// upright painted figures at their own size, lit by the place's light and casting its sun's shadow — blinking through
// their idle frames, breathing, flinching at a heavy blow.
import * as THREE from 'three';
import NPC_ART from '../../data/npc-sprites.json';
import { Life, Wind, rng, lerp } from './kit';

const ART = NPC_ART as Record<string, { w: number; h: number; n: number; ox: number; oy: number; q: number }>;
/** World px per unit (the room's scale). */
const U = 100;

export interface SpectatorAt {
  /** The NPC sheet (`assets/world/npc/<id>.png`), where the feet stand, which way to face (-1 left, 1 right). */
  id: string; x: number; y: number; z: number; face: -1 | 1;
}

export function spectators(scene: THREE.Scene, at: SpectatorAt[], opts: { wind: Wind; seed?: number; onLoaded?: () => void; anisotropy?: number }): Life {
  const R = rng(opts.seed ?? 71), loader = new THREE.TextureLoader();
  const items: { m: THREE.Mesh; map: THREE.Texture; n: number; frame: number; wait: number; ph: number; y0: number; hop: number }[] = [];
  const disposables: { dispose(): void }[] = [];
  for (const s of at) {
    const a = ART[s.id]; if (!a) continue;
    const map = loader.load(`assets/world/npc/${s.id}.png`, () => opts.onLoaded?.());
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = opts.anisotropy ?? 4; map.repeat.set(1 / a.n, 1); map.minFilter = THREE.LinearMipmapLinearFilter;
    const w = a.w / a.q / U, h = a.h / a.q / U;
    const g = new THREE.PlaneGeometry(w, h); g.translate((0.5 - a.ox) * w, (a.oy - 0.5) * h, 0); // (the feet at the origin)
    const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
    const m = new THREE.Mesh(g, mat); m.position.set(s.x, s.y, s.z); m.scale.x = s.face; m.castShadow = true; m.receiveShadow = false;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
    scene.add(m); items.push({ m, map, n: a.n, frame: 0, wait: R() * 2, ph: R() * 6.28, y0: s.y, hop: 0 });
    disposables.push(g, mat, map, m.customDepthMaterial);
  }
  let gustSeen = 0;
  const update = (ms: number, t: number) => {
    const dt = Math.min(0.05, ms / 1000);
    const startle = opts.wind.gust > 0.8 && gustSeen <= 0; if (startle) gustSeen = 1.2; gustSeen -= dt;
    for (const it of items) {
      it.wait -= dt;
      if (it.wait <= 0) { it.frame = (it.frame + 1) % it.n; it.wait = it.frame === 0 ? 1.2 + R() * 2.4 : 0.12 + R() * 0.2; it.map.offset.x = it.frame / it.n; } // (a blink: the frames run quickly, then the long open look)
      if (startle) it.hop = 1;
      it.hop = Math.max(0, it.hop - dt * 3.2);
      const hopY = Math.sin(Math.min(1, it.hop) * Math.PI) * 0.06;
      it.m.position.y = it.y0 + hopY;
      it.m.scale.y = lerp(1, 1.006, 0.5 + 0.5 * Math.sin(t * 1.3 + it.ph));
    }
  };
  return { update, dispose: () => { for (const it of items) scene.remove(it.m); for (const d of disposables) d.dispose(); } };
}
