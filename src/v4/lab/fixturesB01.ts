// R15's renders (the art director's visual regression, before 500+ items): an item worn alone on BASE-01, in the
// master's reference pose and the review motion poses, drawn by the game's own runtime as a map of which piece shows at
// each pixel (B = 300 px). Compared against the approved maps (tools/v4/base01/r15.py), a map tells a changed silhouette,
// a change in the bare body showing and a moved boundary between pieces apart, pixel by pixel.
import type { AnimDef } from '../rig/types';
import type { WardrobeSlot } from '../wardrobe/types';
import { RigCharacter } from '../render/RigCharacter';
import type { LabScene } from './LabScene';
import { Harness, idColor, idOf } from './tests';

/** The poses: the master's own (no animation) and the review motions at fixed times (seconds), each played into from
 *  0.25 s before at 60 Hz so a cloth's follow-through is as in play. */
export const R15_POSES: [string, string | null, number][] = [
  ['rest', null, 0], ['idle', 'idle', 1.2], ['run_near_knee', 'run', 0.13], ['run_far_knee', 'run', 0.38],
  ['jump_tuck', 'jump', 0.3], ['landing', 'jump', 0.77], ['light_attack', 'attack', 0.17], ['heavy_attack', 'attack_heavy', 0.28],
];
const REST: AnimDef = { name: 'rest', dur: 1, loop: true, bones: {} };
const BS = 300, RW = 780, RH = 690;

/** Each pose's map as a PNG (data URL; red = the piece's slot index + 1, 254 = an edge blending two pieces, 0 = none),
 *  and the slot names by index. */
export async function idMapsB01(scene: LabScene, itemId: string): Promise<{ slots: string[]; size: [number, number]; poses: { name: string; png: string }[] }> {
  const A = scene.assets, pose = A.pose, U = pose.rig.B, s = BS / U;
  const it = A.catalog.items.get(itemId);
  if (!it) throw new Error(`no item ${itemId}`);
  const equipped: Partial<Record<WardrobeSlot, string>> = { [it.wslot]: itemId };
  const av = A.wardrobe.resolve({ body: 'male_std', look: { ...A.baseLook }, gearLooks: {}, cosmetics: { equipped, hidden: [] }, family: 'sword' });
  const kit = (it as { motion?: string }).motion;
  const set = (it.wslot === 'weapon' ? A.animsByKit?.[kit ?? 'sword_1h'] ?? A.anims : A.animsBare ?? A.anims) as Record<string, AnimDef>;
  const ch = new RigCharacter(scene, pose, A.atlas512, false);
  ch.setAvatar(av);
  const hz = new Harness(scene, 'v4r15', RW, RH);
  const canvas = document.createElement('canvas'); canvas.width = RW; canvas.height = RH;
  const ctx = canvas.getContext('2d')!;
  const out: { name: string; png: string }[] = [];
  for (const [name, an, t] of R15_POSES) {
    const anim = an ? set[an] : REST;
    ch.resetFollow(); ch.chain.reset();
    for (let k = 15; k >= 0; k--) {
      const tt = t - k / 60;
      ch.evaluate(anim, anim.loop ? ((tt % anim.dur) + anim.dur) % anim.dur : Math.max(0, tt));
      ch.layout(s);
    }
    ch.layout(s, false); ch.tintBySlot(idColor);
    hz.rt.clear(); hz.rt.draw(ch.container, Math.round(RW / 2), Math.round(RH * 0.93));
    ch.clearTint();
    const px = hz.read(0, 0, RW, RH);
    const img = ctx.createImageData(RW, RH);
    for (let q = 0; q < RW * RH; q++) {
      let v = 0;
      if (px[q * 4 + 3] >= 128) { const i = idOf(px[q * 4], px[q * 4 + 1], px[q * 4 + 2]); v = i >= 0 ? i + 1 : 254; }
      img.data[q * 4] = v; img.data[q * 4 + 1] = v; img.data[q * 4 + 2] = v; img.data[q * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    out.push({ name, png: canvas.toDataURL('image/png') });
  }
  ch.destroy(); hz.dispose();
  return { slots: pose.rig.slots.map((sl) => sl.name), size: [RW, RH], poses: out };
}
