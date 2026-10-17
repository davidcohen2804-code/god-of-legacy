// The 3D world's units, the same as the stage's (Arena3D): 1 unit = 100 world px across and up; the floor's depth
// stretched by 1.15 (a deep room). Area data is in area-picture px (world = local + the area's x).
import * as THREE from 'three';
import type { Pt } from '../../world/WorldGeometry';

export const U = 100;
export const DEPTH_K = 1.15;
/** World px → units (x across, y depth, z height). */
export const ux = (x: number): number => x / U;
export const uz = (y: number): number => (y / U) * DEPTH_K;
export const uy = (z: number): number => z / U;

/** A footprint polygon (area px, plus the area's x) → its box in units: x0..x1 across, z0 (back)..z1 (front). */
export function footBox(foot: Pt[], areaX: number): { x0: number; x1: number; z0: number; z1: number; cx: number; cz: number; w: number; d: number } {
  const xs = foot.map((p) => p[0] + areaX), ys = foot.map((p) => p[1]);
  const x0 = ux(Math.min(...xs)), x1 = ux(Math.max(...xs)), z0 = uz(Math.min(...ys)), z1 = uz(Math.max(...ys));
  return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
}

/** A small seeded random (the same place every load). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A tapered tube (RoomKit.taperTube) — the kit winds it the right way out now (DFO fixed it at the Maps chat's report),
 *  so this passes it through as it is (the calls can go). */
export function tube(g: THREE.BufferGeometry): THREE.BufferGeometry { return g; }

/** Things to free when the place goes. */
export type Disposable = { dispose(): void };
export const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
