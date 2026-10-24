// The Universal Animation Library 1's moves the first pack lacked (the Godot build: its DEF-* bones are the 65 standard
// bones renamed — every rest identical), renamed onto the standard bones: spells, punches, crouch, aim, kneel, dance...
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { defToStd } from './defmap.mjs';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [src, out] = process.argv.slice(2);
const KEEP = ['Spell_Simple_Enter', 'Spell_Simple_Idle_Loop', 'Spell_Simple_Shoot', 'Spell_Simple_Exit', 'Punch_Enter', 'Punch_Jab', 'Punch_Cross', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Shoot', 'Fixing_Kneeling', 'PickUp_Table', 'Dance_Loop', 'Idle_Talking_Loop', 'Sword_Attack_RM', 'Roll_RM', 'Push_Loop'];
const doc = await io.read(src); const root = doc.getRoot();
for (const a of root.listAnimations()) if (!KEEP.includes(a.getName())) { for (const c of a.listChannels()) c.dispose(); for (const s of a.listSamplers()) s.dispose(); a.dispose(); } // (its samplers too: their keys would stay in the file)
for (const n of root.listNodes()) { if (n.getMesh()) { n.getMesh().dispose(); n.setMesh(null); n.setSkin(null); } const s = defToStd(n.getName()); if (s) n.setName(s); }
for (const s of root.listSkins()) s.dispose();
for (const m of root.listMaterials()) m.dispose(); for (const t of root.listTextures()) t.dispose();
// only the turns and the hips' travel are used (Hero3D keeps those): drop the rest's tracks
for (const a of root.listAnimations()) for (const c of a.listChannels()) { const p = c.getTargetPath(), n = c.getTargetNode()?.getName(); if (p === 'scale' || (p === 'translation' && n !== 'pelvis')) { c.getSampler()?.dispose(); c.dispose(); } }
await doc.transform(prune(), dedup(), resample(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);
console.log(out, root.listAnimations().map((a) => a.getName()).join(', '));
