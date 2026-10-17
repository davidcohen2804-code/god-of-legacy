// M04–M07 · The sky (docs/WORLD_3D_SPEC.md §2.1): the Sky Path's chain of clouds from Ivy Summit, Cloud Haven's wide
// cloud meadow (Nimbus's hollow, the cloud blocks, Big Grumble's dark cloud wall at its end), Sunfall Pass — a narrow
// cloud bridge toward the huge low sun — and Afterglow Rest with the Sun Shrine, all one place high over the island
// (the terraces a dim relief far below, the mountains behind). The clouds are volumes of soft puffs round a flat lit top,
// the walkable surface the game already knows (world-clouds.json, world-heights.json).
import * as THREE from 'three';
import type { Room } from '../../arena3d/Room';
import { Parts, box, cyl, lathe, canvasTex, glowCanvas } from '../../arena3d/RoomKit';
import { CLOUDS, HEIGHTS, SKY, AREAS } from '../../world/Areas';
import { rng, ux, uz, uy, type Disposable } from '../kit/units';
import { skyAndLight } from '../kit/sky';
import { farMountains } from '../kit/terrain';
import { type Life, type Wind, stillAir, tex as lifeTex, cloudCanvas } from '../life/kit';
import { birds } from '../life/birds';
import { clouds as farClouds } from '../life/clouds';
import { spectators } from '../life/spectators';
import type { PlaceState } from './islandTerrace';

/** The sky's reach along the world (px): from the first cloud to Afterglow Rest's end. */
export const SKY_X0 = CLOUDS[0].x0, SKY_X1 = Math.max(...HEIGHTS.filter((h) => h.cloud).map((h) => h.x + h.w));
export const SKY_FLOOR = { x0: SKY_X0 - 200, x1: SKY_X1 + 200, back: -108, front: 126 };

interface Puff { s: THREE.Sprite; x0: number; ph: number; k: number }

export const sky = (focus: PlaceState) => (scene: THREE.Scene, front: THREE.Scene, renderer: THREE.WebGLRenderer, F: { x0: number; x1: number; zB: number; zF: number }, soft: boolean): Room => {
  const R = rng(20261040);
  const disposables: Disposable[] = [];
  let shadowDirty = true;
  const cx = (F.x0 + F.x1) / 2, zMid = (F.zB + F.zF) / 2;

  // ------------------------------------------------------------------ light: the low sun ahead in the east, a gold sky
  const light = skyAndLight(scene, front, renderer, {
    cx, cz: zMid, soft, sunFrom: new THREE.Vector3(0.65, 0.55, -0.35), sunColor: 0xffd090, sunIntensity: 3.2, hemiSky: 0xfff0dc, hemiGround: 0xd8a0b0, hemiIntensity: 0.9, // (the sun ahead in the east, high enough that the bodies' shadows stay short on the cloud tops)
    top: 0x5a6ab0, mid: 0xe89a84, low: 0xffc868, background: 0xf0bc90, fog: { color: 0xf4c8a0, near: 30, far: 130 }, exposure: 0.98, shadowReach: 10,
  });
  disposables.push(...light.disposables);

  const std = (o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial(o); disposables.push(m); return m; };
  const M: Record<string, THREE.Material> = {
    cloudTop: std({ color: 0xfff6ee, roughness: 1, transparent: true, opacity: 0.92 }),
    gold: std({ color: 0xe0ab4c, metalness: 1, roughness: 0.3 }),
    white: std({ color: 0xfaf4ea, roughness: 0.6 }),
    grey: std({ color: 0x6a6070, roughness: 1 }),
    dark: std({ color: 0x3a2a30, roughness: 0.9 }),
  };
  const P = new Parts();
  const puffTex = [1, 2, 3].map((k) => lifeTex(cloudCanvas(k * 11))); disposables.push(...puffTex);
  const glowTex = canvasTex(glowCanvas()); disposables.push(glowTex);
  const puffs: Puff[] = [];
  /** A cloud: a flat lit top you stand on, puffs heaped round and under it (brighter on top, rose below). */
  const cloud = (x0: number, x1: number, zB: number, zF: number, yTop: number, dense = 1, tint = 1) => {
    const w = x1 - x0, d = zF - zB, mx = (x0 + x1) / 2, mz = (zB + zF) / 2;
    const g = new THREE.CircleGeometry(1, 28); g.rotateX(-Math.PI / 2); g.scale(w / 2 + 0.3, 1, d / 2 + 0.3); g.translate(mx, yTop - 0.01, mz); disposables.push(g); // (a flat disc: no rim to show as a grey sliver along the front edge)
    const top = new THREE.Mesh(g, M.cloudTop); top.receiveShadow = true; scene.add(top);
    const n = Math.round((w + 3) * 2.2 * dense * (soft ? 0.5 : 1));
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = 0.6 + R() * 0.5, px = mx + Math.cos(a) * (w / 2) * r, pz = mz + Math.sin(a) * (d / 2 + 0.4) * r;
      const under = R() < 0.55, py = yTop - (under ? 0.5 + R() * 1.2 : 0.1 + R() * 0.3), size = (under ? 1.6 : 1.1) + R() * 1.2;
      const m = new THREE.SpriteMaterial({ map: puffTex[i % 3], color: new THREE.Color().setHSL(0.95, 0.5, under ? 0.78 : 0.95).multiplyScalar(tint), transparent: true, opacity: 0.75 + R() * 0.2, depthWrite: false, fog: true }); disposables.push(m);
      const s = new THREE.Sprite(m); s.position.set(px, py, pz); s.scale.set(size * 1.3, size * 0.8, 1); scene.add(s); puffs.push({ s, x0: px, ph: R() * 10, k: 0.5 + R() });
    }
  };

  // ------------------------------------------------------------------ the Sky Path's clouds, Cloud Haven, Sunfall Pass, Afterglow Rest
  for (const c of CLOUDS) cloud(ux(c.x0), ux(c.x1), uz(SKY.band[0]), uz(SKY.band[1]), uy(c.z), 1.2);
  for (const h of HEIGHTS.filter((q) => q.cloud)) {
    cloud(ux(h.x), ux(h.x + h.w), uz(h.back), uz(h.front), uy(h.H), h.id === 'sunfall_pass' ? 0.7 : 0.9);
    for (const b of h.blocks ?? []) cloud(ux(b.x0) - 0.2, ux(b.x1) + 0.2, uz(b.front - b.depth) - 0.2, uz(b.front) + 0.2, uy(h.H + b.h), 2.0); // (a cloud mound to jump on)
  }
  const haven = HEIGHTS.find((h) => h.id === 'cloud_haven')!, after = HEIGHTS.find((h) => h.id === 'afterglow')!;
  // Big Grumble's wall: a dark cloud cliff at Cloud Haven's east end
  for (let i = 0; i < (soft ? 12 : 26); i++) {
    const m = new THREE.SpriteMaterial({ map: puffTex[i % 3], color: 0x7a6a7c, transparent: true, opacity: 0.85, depthWrite: false, fog: true }); disposables.push(m);
    const s = new THREE.Sprite(m); s.position.set(ux(haven.x + haven.w) + 0.4 + R() * 1.6, uy(haven.H) + R() * 3.4, zMid + (R() - 0.5) * 3); const k = 1.6 + R() * 1.4; s.scale.set(k * 1.3, k, 1); scene.add(s); puffs.push({ s, x0: s.position.x, ph: R() * 10, k: 0.3 });
  }
  // Nimbus's hollow: a ring of puffs round his cushion
  { const nimbus = (AREAS.training_2.npcs ?? []).find((n) => n.id === 'nimbus'); const nx = nimbus ? ux(nimbus.x + AREAS.training_2.x) : ux(haven.x) + 8, nz = nimbus ? uz(nimbus.y) : zMid;
    P.add('white', lathe([[0.001, 0], [0.5, 0.02], [0.56, 0.18], [0.44, 0.28], [0.001, 0.3]], nx, uy(haven.H), nz, 14));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const m = new THREE.SpriteMaterial({ map: puffTex[i % 3], color: 0xfff2ea, transparent: true, opacity: 0.8, depthWrite: false, fog: true }); disposables.push(m); const s = new THREE.Sprite(m); s.position.set(nx + Math.cos(a) * 1.4, uy(haven.H) + 0.25, nz + Math.sin(a) * 0.9); s.scale.set(1.0, 0.7, 1); scene.add(s); puffs.push({ s, x0: s.position.x, ph: R() * 10, k: 0.4 }); } }
  // the sun over Sunfall Pass: a huge disc low ahead, a halo, rays
  const pass = HEIGHTS.find((h) => h.id === 'sunfall_pass')!;
  const sunX = ux(pass.x + pass.w) + 6, sunY = uy(pass.H) + 4.5, sunZ = zMid - 34;
  { const disc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 48), new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false })); disc.position.set(sunX, sunY, sunZ); scene.add(disc); disposables.push(disc.geometry, disc.material as THREE.Material);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.position.set(sunX, sunY, sunZ + 0.5); halo.scale.set(26, 26, 1); scene.add(halo); disposables.push(halo.material);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + (i % 3) * 0.5, 22), new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.08 + (i % 2) * 0.05, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide })); ray.position.set(sunX + Math.cos(a) * 11, sunY + Math.sin(a) * 11, sunZ + 1); ray.rotation.z = a - Math.PI / 2; scene.add(ray); disposables.push(ray.geometry, ray.material as THREE.Material); } }
  // the Sun Shrine at Afterglow Rest: six gilt pillars, a dome, the empty pedestal; the reward's bowl; the cloud stair down at the end
  { const sol = (AREAS.orchard_1.npcs ?? []).find((n) => n.id === 'solenne'); const sx = sol ? ux(sol.x + AREAS.orchard_1.x) + 1.6 : ux(after.x) + 12, sz = sol ? uz(sol.y) - 0.5 : zMid, y = uy(after.H);
    P.add('white', lathe([[0.001, 0], [2.4, 0.02], [2.5, 0.16], [2.3, 0.26], [0.001, 0.26]], sx, y, sz, 24));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3, px = sx + Math.cos(a) * 1.9, pz = sz + Math.sin(a) * 1.3; P.add('white', lathe([[0, 0], [0.26, 0], [0.26, 0.06], [0.2, 0.1], [0, 0.1]], px, y + 0.26, pz, 12)); P.add('gold', cyl(0.13, 0.12, 2.6, px, y + 0.36, pz, 12)); }
    P.add('gold', lathe([[2.3, 0], [2.4, 0.2], [2.2, 0.3], [0.001, 0.3]], sx, y + 2.96, sz, 24));
    { const g = new THREE.SphereGeometry(2.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.75, 0.7); g.translate(sx, y + 3.26, sz); P.add('gold', g); }
    P.add('white', lathe([[0.001, 0], [0.42, 0.02], [0.3, 0.1], [0.3, 0.8], [0.5, 0.9], [0.52, 1.0], [0.1, 1.0], [0.001, 1.0]], sx, y + 0.26, sz, 16)); // the empty pedestal (its hollow dark)
    P.add('dark', cyl(0.22, 0.22, 0.03, sx, y + 1.25, sz, 16));
    if (after.reward) P.add('gold', lathe([[0.001, 0], [0.2, 0.02], [0.3, 0.14], [0.24, 0.2], [0.001, 0.2]], ux((after.reward.x0 + after.reward.x1) / 2), y, zMid, 12));
    for (let i = 0; i < 7; i++) cloud(ux(after.x + after.w) + 0.3 + i * 1.3, ux(after.x + after.w) + 1.6 + i * 1.3, zMid - 0.8, zMid + 0.8, y - 0.9 * (i + 1), 1.4, 1 - i * 0.04); // the cloud stair down (scenery: the drop is the game's)
  }
  P.build(M, scene);

  // ------------------------------------------------------------------ the island far below, the mountains behind, far clouds
  { const m = std({ color: 0xc8a888, roughness: 1 }); const g = new THREE.BoxGeometry(F.x1 - F.x0 + 60, 2, 6); g.translate(cx, -8.5, zMid + 1); disposables.push(g); const terr = new THREE.Mesh(g, m); scene.add(terr);
    for (let x = F.x0 - 10; x < F.x1 + 10; x += 16.7) { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 5, 10), m); t.position.set(x, -5, zMid - 2); scene.add(t); disposables.push(t.geometry); } }
  disposables.push(farMountains(scene, cx, zMid - 90, R, { ranges: 3, color: 0x7a5a78, span: 320, yBase: -9, hScale: 0.55 })); // (seen from above: a low far range under the horizon, not a wall)
  for (let i = 0; i < (soft ? 30 : 70); i++) { // a sea of cloud under the island's edge
    const m = new THREE.SpriteMaterial({ map: puffTex[i % 3], color: 0xf4d0c8, transparent: true, opacity: 0.5 + R() * 0.3, depthWrite: false, fog: true }); disposables.push(m);
    const s = new THREE.Sprite(m); s.position.set(F.x0 - 20 + R() * (F.x1 - F.x0 + 40), -3 - R() * 4, zMid + 3 + R() * 10); const k = 5 + R() * 7; s.scale.set(k * 1.4, k * 0.6, 1); scene.add(s); puffs.push({ s, x0: s.position.x, ph: R() * 10, k: 1.2 });
  }

  // ------------------------------------------------------------------ the life
  const air: Wind = stillAir(); air.x = 0.4; air.z = 0.05;
  const life: Life[] = [];
  life.push(farClouds(scene, { cx, z: zMid - 50, y: 14, spread: 120 }, { n: soft ? 5 : 10, seed: 44, tint: 0xfff0e6 }));
  life.push(birds(scene, { cx: ux(haven.x) + 16, cz: zMid + 4, rx: 22, rz: 8, y: uy(haven.H) - 2.5, perches: [] }, { n: soft ? 5 : 8, wind: air, seed: 45, color: 0x3a2a30 }));
  void spectators;

  // ------------------------------------------------------------------ the frame's work
  let boost = 0, boostDir = 1;
  const groundY = (x: number, z: number): number => { let y = -8; for (const c of CLOUDS) if (x >= ux(c.x0) && x <= ux(c.x1)) y = uy(c.z); for (const h of HEIGHTS.filter((q) => q.cloud)) if (x >= ux(h.x) && x <= ux(h.x + h.w) && z <= uz(h.front) + 0.3) y = uy(h.H); return y; };
  const update = (ms: number, t: number, dim: number) => {
    const dt = Math.min(0.05, ms / 1000);
    boost = Math.max(0, boost - dt * 0.75); air.gust = boost; air.dir = boostDir;
    for (const p of puffs) { p.s.position.x = p.x0 + Math.sin(t * 0.11 * p.k + p.ph) * 0.12 + boost * boostDir * 0.6; p.s.position.y += Math.sin(t * 0.5 + p.ph) * 0.0006; }
    for (const l of life) l.update(ms, t, dim);
    light.update(t, dim, focus.x, focus.z);
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
  };
  return {
    sun: light.sun, hemi: light.hemi, warm: [], groundY,
    blow: () => undefined,
    gust: (st, dir) => { boost = Math.max(boost, st); boostDir = dir < 0 ? -1 : 1; },
    update,
    shadowsDirty: () => { shadowDirty = true; },
    dispose: () => { for (const l of life) l.dispose(); for (const d of disposables) d.dispose(); scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); },
  };
};
