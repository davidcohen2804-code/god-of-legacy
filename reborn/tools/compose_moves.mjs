// GOD OF LEGACY — REBORN: composite moves for the Samurai, laid into samurai.glb (run with Node + gltf-transform
// outside Godot; the output is committed). A composite takes one move's body over a span of its time and another
// move's legs: Air_Chop (M4, GPT's Stage B review — Aerial Pursuit needs a clear airborne windup and body pose) is
// Sword_Heavy_Combo's vertical chop from 2.32 to 2.97 s (the sword raised behind his head, the chop, the follow-through)
// with the legs tucked as in NinjaJump_Idle_Loop. Only the legs differ from the chop, so the hand — and the katana's
// baked path — are the chop's own. The composite's keys lie on a 30 fps grid from its start (the source sampled
// there): Godot's importer resamples every track at 30 fps, so on the grid it keeps exactly these keys and plays the
// same pose the blade baker reads (off the grid it cut the chop's corners: 24 cm at the katana's tip). Re-running
// replaces the composites; the other moves are untouched.
// Usage: node compose_moves.mjs <samurai.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const [GLB] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(GLB);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const LEGS = /^(thigh|calf|foot|ball)_[lr]$/;
const FPS = 30; // Godot's import resampling rate (animation/fps)
const COMPOSITES = [
  { name: 'Air_Chop', body: ['Sword_Heavy_Combo', 2.32, 2.97], legs: ['NinjaJump_Idle_Loop', 0.5] },
];

const slerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = b.map((x) => -x); }
  if (d > 0.9995) { const r = a.map((x, i) => x + (bb[i] - x) * t); const l = Math.hypot(...r); return r.map((x) => x / l); }
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((x, i) => wa * x + wb * bb[i]);
};
const valueAt = (sampler, t) => {
  const inp = sampler.getInput().getArray(), out = sampler.getOutput().getArray();
  const k = out.length / inp.length;
  if (t <= inp[0]) return Array.from(out.slice(0, k));
  if (t >= inp[inp.length - 1]) return Array.from(out.slice((inp.length - 1) * k, inp.length * k));
  let i = 0;
  while (inp[i + 1] < t) i++;
  const f = (t - inp[i]) / (inp[i + 1] - inp[i]);
  const a = Array.from(out.slice(i * k, (i + 1) * k)), b = Array.from(out.slice((i + 1) * k, (i + 2) * k));
  return k === 4 ? slerp(a, b, f) : a.map((x, j) => x + (b[j] - x) * f);
};
const channel = (anim, node, path, times, values) => {
  const acc = (arr, type) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buffer);
  const s = doc.createAnimationSampler().setInput(acc(new Float32Array(times), 'SCALAR'))
    .setOutput(acc(new Float32Array(values), path === 'rotation' ? 'VEC4' : 'VEC3')).setInterpolation('LINEAR');
  anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s));
};

for (const c of COMPOSITES) {
  for (const a of root.listAnimations()) if (a.getName() === c.name) a.dispose();
  const body = root.listAnimations().find((a) => a.getName() === c.body[0]);
  const legs = root.listAnimations().find((a) => a.getName() === c.legs[0]);
  if (!body || !legs) throw new Error(`${c.name}: missing ${c.body[0]} or ${c.legs[0]}`);
  const [t0, t1] = [c.body[1], c.body[2]];
  const out = doc.createAnimation(c.name);
  const legRot = new Map();
  for (const ch of legs.listChannels()) {
    if (ch.getTargetPath() === 'rotation' && LEGS.test(ch.getTargetNode().getName())) legRot.set(ch.getTargetNode(), ch.getSampler());
  }
  let n = 0;
  for (const ch of body.listChannels()) {
    const node = ch.getTargetNode(), path = ch.getTargetPath(), s = ch.getSampler();
    if (path === 'rotation' && legRot.has(node)) continue; // (the legs come from the jump)
    const times = [];
    for (let k = 0; k * (1 / FPS) < t1 - t0 - 1e-4; k++) times.push(t0 + k / FPS);
    times.push(t1);
    channel(out, node, path, times.map((t) => t - t0), times.flatMap((t) => valueAt(s, t)));
    n++;
  }
  for (const [node, s] of legRot) {
    const q = valueAt(s, c.legs[1]);
    channel(out, node, 'rotation', [0, t1 - t0], [...q, ...q]);
    n++;
  }
  console.log(`${c.name}: ${n} channels, ${(t1 - t0).toFixed(2)} s (${c.body[0]} ${t0}–${t1} s, legs of ${c.legs[0]} at ${c.legs[1]} s)`);
}
await io.write(GLB, doc);
console.log('moves:', root.listAnimations().length);
