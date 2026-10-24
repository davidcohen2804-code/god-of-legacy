// More of the Quaternius libraries' moves (CC0) for the skills' own moves: the heavy combo, the thrusting dash, the
// low lunging cut, the guard stance, the overhead chop, a bend to drive the blade into the floor, a kneel low, the blade
// held upright before the chest, a slide —
// from UAL1 (Kiikurage's standard-bone import), UAL2 (standard) and UAL1's Godot build (its DEF-* bones renamed), one file.
//   node tools/hero3d/moves4.mjs <UAL1_from_kgt.glb> <UAL2_Standard.glb> <AnimationLibrary_Godot_Standard.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, meshopt, mergeDocuments } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { defToStd } from './defmap.mjs';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [u1, u2, gd, out] = process.argv.slice(2);
const PICK = [
  [u1, ['Sword_Heavy_Combo', 'Sword_Dash', 'Shield_Dash', 'Idle_Shield_Loop']],
  [u2, ['TreeChopping_Loop', 'Farm_Harvest', 'Farm_PlantSeed', 'Idle_FoldArms_Loop', 'Slide_Start']],
  [gd, []],
];
const docs = [];
for (const [src, keep] of PICK) {
  const doc = await io.read(src), root = doc.getRoot();
  for (const a of root.listAnimations()) if (!keep.includes(a.getName())) { for (const c of a.listChannels()) c.dispose(); for (const sm of a.listSamplers()) sm.dispose(); a.dispose(); } // (its samplers too: their keys would stay in the file)
  for (const n of root.listNodes()) { if (n.getMesh()) { n.getMesh().dispose(); n.setMesh(null); n.setSkin(null); } const s = defToStd(n.getName()); if (s) n.setName(s); }
  for (const s of root.listSkins()) s.dispose();
  for (const m of root.listMaterials()) m.dispose(); for (const t of root.listTextures()) t.dispose();
  // only the turns and the hips' travel are used (Hero3D keeps those)
  for (const a of root.listAnimations()) for (const c of a.listChannels()) { const p = c.getTargetPath(), n = c.getTargetNode()?.getName(); if (p === 'scale' || (p === 'translation' && n !== 'pelvis')) { c.getSampler()?.dispose(); c.dispose(); } }
  await doc.transform(prune());
  docs.push(doc);
}
const [base, ...rest] = docs;
const mine = new Set(base.getRoot().listNodes()), byName = new Map(base.getRoot().listNodes().map((n) => [n.getName(), n]));
for (const d of rest) mergeDocuments(base, d);
// one skeleton: every move drives the first file's bones (three.js renames a second bone of the same name, and a move
// on it would drive nothing)
for (const a of base.getRoot().listAnimations()) for (const c of a.listChannels()) {
  const n = c.getTargetNode(); if (!n || mine.has(n)) continue;
  const to = byName.get(n.getName()); if (to) c.setTargetNode(to); else { c.getSampler()?.dispose(); c.dispose(); }
}
const keepScene = base.getRoot().listScenes()[0];
for (const sc of base.getRoot().listScenes()) if (sc !== keepScene) sc.dispose();
for (const n of base.getRoot().listNodes()) if (!mine.has(n)) n.dispose();
// one buffer
const buf = base.getRoot().listBuffers()[0];
for (const a of base.getRoot().listAccessors()) a.setBuffer(buf);
for (const b of base.getRoot().listBuffers()) if (b !== buf) b.dispose();
await base.transform(prune(), dedup(), resample({ tolerance: 2e-4 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(out, base);
console.log(out, base.getRoot().listAnimations().map((a) => a.getName()).join(', '));
