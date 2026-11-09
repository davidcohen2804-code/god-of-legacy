// LEGACY OF SPIRITS — a 3D body behind a stone block is hidden by it (GPT, 9 Nov: "correctly occluded when genuinely
// behind an object"). The world draws each 3D body as its own picture laid over the place's, so a block never covered
// anyone standing behind it: the place's blocks are given to the stage as boxes drawn into depth alone before each 3D
// body's picture (Arena3D.occluders) — the parts of him behind a block stay out of it — and his floor ring and contact
// shadow (drawn flat over the place) are hidden while a block stands between the camera and his feet.
import Phaser from 'phaser';
import * as THREE from 'three';
import type { Arena3D } from '../arena3d/Arena3D';
import { AREAS } from '../world/Areas';
import { footBox, ux, uy, uz } from '../world3d/kit/units';

/** The place's stone blocks as boxes (units), as the place builds them (world3d/maps/islandTerrace: footBox(p.foot)). */
function blockBoxes(areaId: string): THREE.Box3[] {
  const A = AREAS[areaId]; if (!A) return [];
  return A.props.filter((q) => q.id.startsWith('block')).map((p) => {
    const b = footBox(p.foot, A.x);
    return new THREE.Box3(new THREE.Vector3(b.x0, 0, b.z0), new THREE.Vector3(b.x1, uy(p.h), b.z1));
  });
}

type Shown = { setVisible(v: boolean): unknown };

/** Give the stage the place's blocks as occluders and hide `marks` (the hero's floor ring, his contact shadow) while
 *  his feet (world px; z = the floor he stands on) are behind one. Returns a teardown. */
export function attachOcclusion(scene: Phaser.Scene, a3: Arena3D, areaId: string, feet: () => { x: number; y: number; z: number }, marks: () => Shown[]): () => void {
  const boxes = blockBoxes(areaId);
  if (!boxes.length) { a3.occluders = null; return () => {}; }
  const sc = new THREE.Scene(), mat = new THREE.MeshBasicMaterial({ colorWrite: false }), geos: THREE.BufferGeometry[] = [];
  for (const b of boxes) { // (a hair inside the block's faces and under its top: a body standing on it or against it is never cut)
    const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const g = new THREE.BoxGeometry(s.x - 0.01, s.y - 0.015, s.z - 0.01); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.set(c.x, c.y - 0.0075, c.z); m.matrixAutoUpdate = false; m.updateMatrix(); sc.add(m);
  }
  a3.occluders = sc;
  const cam = (a3 as unknown as { camera: THREE.PerspectiveCamera }).camera;
  const ray = new THREE.Ray(), P = new THREE.Vector3(), hit = new THREE.Vector3();
  const tick = () => {
    if (a3.occluders !== sc) return;
    const f = feet(); P.set(ux(f.x), uy(f.z) + 0.02, uz(f.y));
    ray.origin.copy(cam.position); ray.direction.copy(P).sub(cam.position);
    const d = ray.direction.length(); if (d < 1e-6) return; ray.direction.divideScalar(d);
    if (boxes.some((b) => !b.containsPoint(P) && ray.intersectBox(b, hit) !== null && hit.distanceTo(cam.position) < d - 0.02)) for (const o of marks()) o.setVisible(false);
  };
  let done = false;
  const off = () => {
    if (done) return; done = true;
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, tick);
    if (a3.occluders === sc) a3.occluders = null;
    mat.dispose(); for (const g of geos) g.dispose();
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  return off;
}
