// GOD OF LEGACY — REBORN: builds the Samurai's game files from the repository's own assets (run with Node, outside
// Godot; the outputs are committed). Inputs (public/assets/hero3d, see its PROVENANCE.md):
//   spirit_samurai_ns_lite.glb — the new Spectral Samurai's gameplay body (David's approved illustration, rigged on
//     the 65-bone standard skeleton), moves_1..4.glb — Quaternius Universal Animation Library 1 + 2 (CC0),
//   w_katana.glb — the katana made from GPT drawings.
// Outputs (reborn/assets/characters/samurai): samurai.glb — the body with the chosen moves laid onto its own bones by
// name (rotations; the pelvis's travel scaled to its height), the right hand closed on the grip in every move, plain
// float attributes and no textures (Godot's importer then needs no extensions); samurai_albedo.png (raw, resized
// later); katana.glb + katana_albedo.png; grip.json — where the katana sits in hand_r's space.
// Usage: node build_samurai.mjs <hero3d dir> <out dir>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, prune } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';

const [SRC, OUT] = process.argv.slice(2);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const KEEP = new Set(['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Roll', 'Hit_Chest', 'Hit_Head', 'Death01',
  'Sword_Attack', 'Sword_Idle', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Hit_Knockback', 'Idle_Shield_Break', 'LayToIdle',
  'Melee_Hook', 'NinjaJump_Idle_Loop', 'NinjaJump_Land', 'NinjaJump_Start', 'OverhandThrow', 'Sword_Block',
  'Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Regular_Combo', 'Spell_Simple_Enter',
  'Spell_Simple_Shoot', 'Spell_Simple_Exit', 'Punch_Cross', 'Punch_Jab', 'Sword_Heavy_Combo', 'Sword_Dash', 'Slide_Start',
  'Idle_FoldArms_Loop']);
const FIST = /^(thumb|index|middle|ring|pinky)_0[123]_r$/;

const body = await io.read(SRC + '/spirit_samurai_ns_lite.glb');
const root = body.getRoot();
const buffer = root.listBuffers()[0];
const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
const pelvis = byName.get('pelvis');
const rest = pelvis.getTranslation();

// the body's texture, saved apart; then no images in the file
const tex = root.listTextures()[0];
fs.writeFileSync(OUT + '/samurai_albedo_src.' + (tex.getMimeType() === 'image/webp' ? 'webp' : 'png'), Buffer.from(tex.getImage()));
for (const m of root.listMaterials()) { m.setBaseColorTexture(null); m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setEmissiveTexture(null); m.setOcclusionTexture(null); }
for (const t of root.listTextures()) t.dispose();

const acc = (arr, type) => body.createAccessor().setArray(arr).setType(type).setBuffer(buffer);
let fistKeys = null; // Map bone -> [x,y,z,w] (Sword_Idle at 0)
const added = [];
for (const f of ['moves_1.glb', 'moves_2.glb', 'moves_3.glb', 'moves_4.glb']) {
  const lib = await io.read(SRC + '/' + f);
  const lnodes = new Map(lib.getRoot().listNodes().map((n) => [n.getName(), n]));
  const L = lnodes.get('pelvis')?.getTranslation() ?? [0, 0.0501, 0.9167];
  const k = rest[2] / Math.max(0.1, L[2]);
  for (const a of lib.getRoot().listAnimations()) {
    if (!KEEP.has(a.getName())) continue;
    const out = body.createAnimation(a.getName());
    let dur = 0;
    for (const ch of a.listChannels()) {
      const name = ch.getTargetNode()?.getName(), path = ch.getTargetPath(), s = ch.getSampler();
      const target = byName.get(name);
      if (!target || !s) continue;
      const input = s.getInput().getArray().slice(), output = s.getOutput().getArray().slice();
      dur = Math.max(dur, input[input.length - 1]);
      if (path === 'translation') {
        if (name !== 'pelvis') continue;
        for (let i = 0; i < output.length; i += 3) for (let j = 0; j < 3; j++) output[i + j] = rest[j] + (output[i + j] - L[j]) * k;
      } else if (path !== 'rotation') continue;
      if (path === 'rotation' && FIST.test(name)) {
        if (a.getName() === 'Sword_Idle') (fistKeys ??= new Map()).set(name, Array.from(output.slice(0, 4)));
        continue; // (laid as the fist below)
      }
      const sampler = body.createAnimationSampler().setInput(acc(input, 'SCALAR')).setOutput(acc(output, path === 'rotation' ? 'VEC4' : 'VEC3')).setInterpolation(s.getInterpolation());
      out.addSampler(sampler).addChannel(body.createAnimationChannel().setTargetNode(target).setTargetPath(path).setSampler(sampler));
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
body.getRoot().listExtensionsUsed().forEach((e) => e.dispose());
await io.write(OUT + '/samurai.glb', body);
console.log('samurai.glb:', added.length, 'moves', added.map(([a, d]) => `${a.getName()}:${d.toFixed(2)}`).join(' '));

// the grip: in hand_r's space, the grip's axis runs across the knuckles (pinky -> index), the blade beyond the
// index; its centre a little toward the palm (the thumb's side) from the knuckles' middle
const v = (n) => byName.get(n).getTranslation();
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), len = (a) => Math.sqrt(dot(a, a)), norm = (a) => mul(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const idx = v('index_01_r'), pky = v('pinky_01_r'), thb = v('thumb_01_r'), mid = mul(add(idx, pky), 0.5);
const d = norm(sub(idx, pky)), kw = len(sub(idx, pky));
const f = norm(sub(v('middle_01_r'), [0, 0, 0]));
let p = norm(cross(f, d)); if (dot(p, sub(thb, mid)) < 0) p = mul(p, -1);
const center = add(add(mid, mul(p, 0.32 * kw)), mul(f, -0.08 * kw));

// the katana: its length along +y; find its guard (widest in z) and its edge side (the tip bends toward the spine)
const kat = await io.read(SRC + '/w_katana.glb');
const kr = kat.getRoot();
const kt = kr.listTextures()[0];
fs.writeFileSync(OUT + '/katana_albedo_src.' + (kt.getMimeType() === 'image/webp' ? 'webp' : 'png'), Buffer.from(kt.getImage()));
for (const m of kr.listMaterials()) { m.setBaseColorTexture(null); m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setEmissiveTexture(null); m.setOcclusionTexture(null); }
for (const t of kr.listTextures()) t.dispose();
await kat.transform(dequantize(), prune({ keepAttributes: true }));
kat.getRoot().listExtensionsUsed().forEach((e) => e.dispose());
const kn = kr.listNodes().find((n) => n.getMesh());
const km = kn.getMatrix();
const kp = kn.getMesh().listPrimitives()[0].getAttribute('POSITION');
const pts = [];
for (let i = 0; i < kp.getCount(); i++) {
  const e = kp.getElement(i, []);
  pts.push([km[0] * e[0] + km[4] * e[1] + km[8] * e[2] + km[12], km[1] * e[0] + km[5] * e[1] + km[9] * e[2] + km[13], km[2] * e[0] + km[6] * e[1] + km[10] * e[2] + km[14]]);
}
const ys = pts.map((q) => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
const bins = 40, wz = new Array(bins).fill(0);
for (const q of pts) { const b = Math.min(bins - 1, Math.floor(((q[1] - y0) / (y1 - y0)) * bins)); wz[b] = Math.max(wz[b], Math.abs(q[2])); }
const gb = wz.indexOf(Math.max(...wz)), guardY = y0 + ((gb + 0.5) / bins) * (y1 - y0);
const meanX = (lo, hi) => { const s = pts.filter((q) => q[1] >= lo && q[1] <= hi); return s.reduce((t, q) => t + q[0], 0) / Math.max(1, s.length); };
const tipX = meanX(y1 - 0.08 * (y1 - y0), y1), baseX = meanX(guardY + 0.05, guardY + 0.2);
const edge = tipX > baseX ? -1 : 1; // the edge on the side away from the tip's bend
await io.write(OUT + '/katana.glb', kat);
const holdY = Math.max(y0 + 0.04, guardY - 0.07); // where the fist closes: just below the guard
// the edge faces where the knuckles point (f, made square to the grip's axis)
const e = norm(sub(f, mul(d, dot(f, d))));
const X = mul(e, edge), Y = d, Z = cross(X, Y);
const grip = { position: sub(center, mul(Y, holdY)), basis: { x: X, y: Y, z: Z }, guardY, y0, y1, holdY, tipX, baseX };
fs.writeFileSync(OUT + '/grip.json', JSON.stringify(grip, null, 1));
console.log('grip', JSON.stringify(grip));
