// Kagemusha's shadow doubles as 3D bodies (David 24 Oct: the heroes in 3D — the painted bodies go): each double is the
// samurai's own 3D body again — a twin sharing its shape, weapons and moves (Hero3D.clone) — running round the foe,
// standing on guard, feinting a cut, swinging with him. They stand round the fighter they surround, so they are drawn
// in two layers of the room: the ones behind that fighter, and the ones in front of him.
import * as THREE from 'three';
import type Phaser from 'phaser';
import type { Arena3D } from './Arena3D';
import type { Hero3D, HeroDrive } from './Hero3D';
import type { Motion } from '../skills/ArcherMotion';

/** One double this frame: where its feet are (game px), how its body moves, its motion layer, its afterimages. */
export interface Double3D { x: number; y: number; z: number; drive: HeroDrive; motion: Motion | null; trail: boolean }

export class Doubles3D {
  private twins: Hero3D[] = [];
  private layers: { img: Phaser.GameObjects.Image; sc: THREE.Scene; sun: THREE.Vector3 }[];

  constructor(a3: Arena3D, private src: Hero3D, key: string) {
    this.layers = [0, 1].map((i) => {
      const sc = new THREE.Scene(), { img, sunDir } = a3.addLayer(`${key}-${i}`, sc);
      img.setVisible(false);
      return { img, sc, sun: sunDir };
    });
  }

  /** Each frame: the doubles standing now (none: all hidden). `depth`: a body's draw depth at its feet; `foe`: the draw
   *  depth of the fighter they surround (null: none near — all drawn as one, over the nearest of them); `trail`: their
   *  afterimages' colour. */
  drive(ds: Double3D[], ms: number, now: number, depth: (x: number, y: number, z: number) => number, foe: number | null, alpha: number, trail: number): void {
    while (this.twins.length < ds.length) {
      const t = this.src.clone();
      t.makeShadow(this.layers[0].sun);
      this.layers[0].sc.add(t.root);
      this.twins.push(t);
    }
    const shown = [false, false];
    let top = -Infinity;
    this.twins.forEach((t, i) => {
      const d = ds[i];
      if (!d) { t.root.visible = false; return; }
      const dd = depth(d.x, d.y, d.z), L = foe !== null && dd < foe ? 0 : 1;
      if (t.root.parent !== this.layers[L].sc) this.layers[L].sc.add(t.root);
      t.root.visible = true; shown[L] = true; top = Math.max(top, dd);
      if (t.weapon !== this.src.weapon) t.setWeapon(this.src.weapon);
      t.drive(d.drive, ms);
      t.motion(d.motion);
      t.ghost(now, d.trail, trail);
    });
    const at = foe ?? top;
    this.layers.forEach((l, i) => l.img.setVisible(shown[i]).setDepth(at + (i === 0 ? -0.5 : 0.5)).setAlpha(alpha));
  }

  /** Gone (the illusion ended, the scene closes): their layers hidden, the twins kept for the next time. */
  hide(): void { for (const l of this.layers) l.img.setVisible(false); for (const t of this.twins) { t.root.visible = false; t.clearGhosts(); } }

  dispose(): void { for (const t of this.twins) t.dispose(); this.twins.length = 0; this.hide(); }
}
