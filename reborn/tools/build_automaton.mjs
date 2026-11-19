// GOD OF LEGACY — REBORN: builds the Training Automaton's body (M4, GPT's v1.2 decision: a humanoid sparring
// automaton on a compatible skeleton, from appropriately licensed Quaternius geometry — not the Samurai's mesh). Run
// with Node + gltf-transform outside Godot; the outputs are committed.
// Inputs: Quaternius' Universal Base Characters, Superhero_Male_FullBody.gltf + .bin (CC0-1.0, the 65 standard bones;
// its textures are not used), and the moves the Samurai uses, from Quaternius' Universal Animation Library
// (moves_1..4.glb in public/assets/hero3d, CC0) — the same standard bones, so they are laid on as they are.
// Output (reborn/assets/characters/automaton): automaton.glb — the body only (no eyes, brows or textures; the game
// dresses it: lacquered wood, bronze fittings, a stone-and-bronze face), the moves, the right hand closed on a grip in
// every move; grip.json — where a practice sword sits in hand_r's space (as for the Samurai's katana).
// Usage: node build_automaton.mjs <Superhero_Male_FullBody.gltf> <hero3d dir> <out dir>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const [BODY, MOVES, OUT] = process.argv.slice(2);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const KEEP = new Set(['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Roll', 'Hit_Chest', 'Hit_Head', 'Death01', 'Sword_Attack',
  'Sword_Idle', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Hit_Knockback', 'Idle_Shield_Break', 'LayToIdle', 'Sword_Block',
  'Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Punch_Cross', 'Punch_Jab', 'Sword_Dash']);
const FIST = /^(thumb|index|middle|ring|pinky)_0[123]_r$/;

// the body without its textures (the gltf names external images we do not use)
const g = JSON.parse(fs.readFileSync(BODY, 'utf8'));
for (const k of ['images', 'textures', 'samplers']) delete g[k];
for (const m of g.materials || []) {
  for (const k of Object.keys(m.pbrMetallicRoughness || {})) if (k.endsWith('Texture')) delete m.pbrMetallicRoughness[k];
  for (const k of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) delete m[k];
}
const tmp = path.join(path.dirname(BODY), '_automaton_body.gltf');
fs.writeFileSync(tmp, JSON.stringify(g));
const body = await io.read(tmp);
fs.unlinkSync(tmp);
const root = body.getRoot();
// only the body's skin mesh: the eyes and brows go (the automaton wears a face of stone and bronze)
for (const n of root.listNodes()) {
  const m = n.getMesh();
  if (m && !m.listPrimitives().some((p) => p.getMaterial()?.getName() === 'MI_Superhero_Male')) { n.setMesh(null); n.dispose(); }
}
for (const m of root.listMaterials()) m.setName(m.getName() === 'MI_Superhero_Male' ? 'Automaton' : m.getName());
const buffer = root.listBuffers()[0];
const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const rest = byName.get('pelvis').getTranslation();
const acc = (arr, type) => body.createAccessor().setArray(arr).setType(type).setBuffer(buffer);

let fistKeys = null;
const added = [];
for (const f of ['moves_1.glb', 'moves_2.glb', 'moves_3.glb', 'moves_4.glb']) {
  const lib = await io.read(MOVES + '/' + f);
  const lnodes = new Map(lib.getRoot().listNodes().map((n) => [n.getName(), n]));
  const L = lnodes.get('pelvis')?.getTranslation() ?? [0, 0.0501, 0.9167];
  const k = rest[2] / Math.max(0.1, L[2]);
  for (const a of lib.getRoot().listAnimations()) {
    if (!KEEP.has(a.getName()) || added.some(([x]) => x.getName() === a.getName())) continue;
    const out = body.createAnimation(a.getName());
    let dur = 0;
    for (const ch of a.listChannels()) {
      const name = ch.getTargetNode()?.getName(), p = ch.getTargetPath(), s = ch.getSampler();
      const target = byName.get(name);
      if (!target || !s) continue;
      const input = s.getInput().getArray().slice(), output = s.getOutput().getArray().slice();
      dur = Math.max(dur, input[input.length - 1]);
      if (p === 'translation') {
        if (name !== 'pelvis') continue;
        for (let i = 0; i < output.length; i += 3) for (let j = 0; j < 3; j++) output[i + j] = rest[j] + (output[i + j] - L[j]) * k;
      } else if (p !== 'rotation') continue;
      if (p === 'rotation' && FIST.test(name)) {
        if (a.getName() === 'Sword_Idle') (fistKeys ??= new Map()).set(name, Array.from(output.slice(0, 4)));
        continue;
      }
      const sampler = body.createAnimationSampler().setInput(acc(input, 'SCALAR')).setOutput(acc(output, p === 'rotation' ? 'VEC4' : 'VEC3')).setInterpolation(s.getInterpolation());
      out.addSampler(sampler).addChannel(body.createAnimationChannel().setTargetNode(target).setTargetPath(p).setSampler(sampler));
    }
    added.push([out, Math.max(dur, 1 / 30)]);
  }
}
if (!fistKeys) throw new Error('no Sword_Idle fist');
for (const [out, dur] of added) {
  for (const [bone, q] of fistKeys) {
    const target = byName.get(bone);
    if (!target) continue;
    const sampler = body.createAnimationSampler().setInput(acc(new Float32Array([0, dur]), 'SCALAR')).setOutput(acc(new Float32Array([...q, ...q]), 'VEC4')).setInterpolation('LINEAR');
    out.addSampler(sampler).addChannel(body.createAnimationChannel().setTargetNode(target).setTargetPath('rotation').setSampler(sampler));
  }
}
await body.transform(dequantize(), prune({ keepAttributes: true }));
root.listExtensionsUsed().forEach((e) => e.dispose());
fs.mkdirSync(OUT, { recursive: true });
await io.write(OUT + '/automaton.glb', body);
console.log('automaton.glb:', added.length, 'moves', added.map(([a, d]) => `${a.getName()}:${d.toFixed(2)}`).join(' '));

// the body's measurements for dressing it (fit.json): for each bone, the box around the vertices it mostly moves, in
// the model's own space at rest (+Y up, +Z forward), and the bone's rest position — so the face, plates and joint rings
// are placed on the body, not guessed
{
  const meshNode = root.listNodes().find((n) => n.getMesh());
  const prim = meshNode.getMesh().listPrimitives()[0];
  const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
  const joints = meshNode.getSkin().listJoints();
  const M = meshNode.getWorldMatrix();
  const xf = (e) => [M[0] * e[0] + M[4] * e[1] + M[8] * e[2] + M[12], M[1] * e[0] + M[5] * e[1] + M[9] * e[2] + M[13], M[2] * e[0] + M[6] * e[1] + M[10] * e[2] + M[14]];
  const boxes = new Map();
  for (let i = 0; i < P.getCount(); i++) {
    const w = W.getElement(i, []), j = J.getElement(i, []);
    let best = 0; for (let k = 1; k < 4; k++) if (w[k] > w[best]) best = k;
    const name = joints[j[best]].getName();
    const q = xf(P.getElement(i, []));
    const b = boxes.get(name) ?? { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], n: 0 };
    for (let k = 0; k < 3; k++) { b.min[k] = Math.min(b.min[k], q[k]); b.max[k] = Math.max(b.max[k], q[k]); }
    b.n++;
    boxes.set(name, b);
  }
  const r3 = (a) => a.map((x) => Math.round(x * 1000) / 1000);
  const fit = { _doc: 'Generated by tools/build_automaton.mjs: per bone, the box (model space at rest, metres) around the vertices it mostly moves, and the bone position.', bones: {} };
  const want = ['Head', 'neck_01', 'spine_01', 'spine_02', 'spine_03', 'pelvis', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r'];
  for (const name of want) {
    const b = boxes.get(name);
    if (b) fit.bones[name] = { min: r3(b.min), max: r3(b.max), verts: b.n };
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(OUT + '/fit.json', JSON.stringify(fit, null, 1).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2, $3]') + '\n');
  for (const name of ['Head', 'spine_03', 'pelvis', 'lowerarm_r', 'calf_l']) if (fit.bones[name]) console.log('fit', name, JSON.stringify(fit.bones[name]));
}

// the grip in hand_r's space (as tools/build_samurai.mjs finds the katana's): across the closed fist, the blade
// beyond the index, its edge toward the knuckles; a practice sword's length along +y
const v = (n) => byName.get(n).getTranslation();
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), len = (a) => Math.sqrt(dot(a, a)), norm = (a) => mul(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const idx = v('index_01_r'), pky = v('pinky_01_r'), thb = v('thumb_01_r'), mid = mul(add(idx, pky), 0.5);
const d = norm(sub(idx, pky)), kw = len(sub(idx, pky));
const f = norm(v('middle_01_r'));
let p = norm(cross(f, d)); if (dot(p, sub(thb, mid)) < 0) p = mul(p, -1);
const center = add(add(mid, mul(p, 0.32 * kw)), mul(f, -0.08 * kw));
const e = norm(sub(f, mul(d, dot(f, d))));
const X = e, Y = d, Z = cross(X, Y);
const holdY = -0.04;
const grip = { position: sub(center, mul(Y, holdY)), basis: { x: X, y: Y, z: Z }, holdY, note: 'practice sword along +y from the fist' };
fs.writeFileSync(OUT + '/grip.json', JSON.stringify(grip, null, 1));
console.log('grip', JSON.stringify(grip));
