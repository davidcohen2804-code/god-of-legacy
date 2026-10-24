// The 3D heroes' moves (Quaternius CC0: Universal Animation Library 1 + 2) on the 65-bone skeleton, no mesh. (The
// Beginner and its weapons are made by tools/hero3d/ai and tools/hero3d/weapons: tools/hero3d/README.md.)
// Sources (public/assets/hero3d/PROVENANCE.md) unpacked into Q; needs @gltf-transform/{core,extensions,functions},
// meshoptimizer and sharp:   node tools/hero3d/build.mjs   (Q=<sources dir>)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const Q = process.env.Q ?? 'hero3d-src', OUT = new URL('../../public/assets/hero3d', import.meta.url).pathname;
const tex = [
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], slots: /^baseColor/, quality: 86 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], slots: /^(normal|occlusion|metallicRoughness)/, quality: 82 }),
];
async function pack(src, out, edit, opts = {}) {
  const doc = await io.read(`${Q}/${src}`);
  if (edit) await edit(doc);
  await doc.transform(prune(), dedup(), resample(), ...(opts.noTex ? [] : tex), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(`${OUT}/${out}`, doc);
  console.log(out, doc.getRoot().listMeshes().map((m) => m.getName()).join(','), '|', doc.getRoot().listAnimations().length, 'clips');
}
// the base: the head (and neck) cut off the body as its own piece (an outfit covers the rest; the bare body stays as
// a piece too, under nothing)
async function splitHead(doc) {
  const root = doc.getRoot();
  const body = root.listMeshes().find((m) => m.getName().startsWith('Sphere'));
  const node = root.listNodes().find((n) => n.getMesh() === body);
  const joints = node.getSkin().listJoints().map((j) => j.getName());
  const H = new Set(['Head', 'neck_01'].map((n) => joints.indexOf(n)));
  const headMesh = doc.createMesh('Head');
  for (const prim of body.listPrimitives()) {
    const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), P = prim.getAttribute('POSITION'), I = prim.getIndices();
    const n = P.getCount(), hw = new Float32Array(n), j = [0, 0, 0, 0], w = [0, 0, 0, 0];
    for (let v = 0; v < n; v++) { J.getElement(v, j); W.getElement(v, w); let s = 0; for (let k = 0; k < 4; k++) if (H.has(j[k])) s += w[k]; hw[v] = s; }
    const head = [], rest = [];
    for (let t = 0; t < I.getCount(); t += 3) {
      const a = I.getScalar(t), b = I.getScalar(t + 1), c = I.getScalar(t + 2);
      ((hw[a] + hw[b] + hw[c]) / 3 > 0.5 ? head : rest).push(a, b, c);
    }
    const hp = prim.clone();
    hp.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(head)).setBuffer(root.listBuffers()[0]));
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(rest)).setBuffer(root.listBuffers()[0]));
    headMesh.addPrimitive(hp);
    console.log('  head tris', head.length / 3, 'body tris', rest.length / 3);
  }
  body.setName('BaseBody'); node.setName('BaseBody');
  headMesh.setName('HeadSkin');
  const hn = doc.createNode('HeadSkin').setMesh(headMesh).setSkin(node.getSkin());
  for (const p of node.listParents()) if (p.propertyType === 'Node' || p.propertyType === 'Scene') p.addChild(hn);
  // (no piece may share a bone's name: a move's track finds its bone by name)
  for (const n of root.listNodes()) { const m = n.getMesh(); if (!m) continue; if (m.getName() === 'Face') { m.setName('Eyebrows'); n.setName('Eyebrows'); } else if (m.getName() === 'Face.001') { m.setName('Eyes'); n.setName('Eyes'); } }
}
// (the test's stand-in body, outfits and hair are gone — the Beginner replaced them, tools/hero3d/README.md; splitHead
// stays for the next base body)
void splitHead;
// the moves: the clips the test plays, no mesh (they drive the bones by name)
const KEEP1 = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Roll', 'Hit_Chest', 'Hit_Head', 'Death01', 'Sword_Attack', 'Sword_Idle', 'Punch_Jab', 'Punch_Cross', 'Spell_Simple_Shoot', 'Dance_Loop'];
const KEEP2 = ['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Regular_Combo', 'Sword_Dash_RM', 'Sword_Block', 'Hit_Knockback', 'LayToIdle', 'NinjaJump_Start', 'NinjaJump_Idle_Loop', 'NinjaJump_Land', 'OverhandThrow', 'Melee_Hook', 'Idle_Shield_Break'];
const anims = (keep) => async (doc) => {
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!keep.includes(a.getName())) a.dispose();
  for (const n of root.listNodes()) if (n.getMesh()) { n.getMesh().dispose(); n.setMesh(null); n.setSkin(null); }
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
};
await pack('UAL1_from_kgt.glb', 'moves_1.glb', anims(KEEP1), { noTex: true }); // (the Godot build of UAL1 drives Rigify's DEF bones: this one, from Kiikurage/game-test's CC0 import, drives the 65 standard bones)
await pack('UAL2_Standard.glb', 'moves_2.glb', anims(KEEP2), { noTex: true });
