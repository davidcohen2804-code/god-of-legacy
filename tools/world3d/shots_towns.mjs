// The class towns on the 3D stage: a shot of each Sakura / Ironhold map. Usage: node tools/world3d/shots_towns.mjs
// (vite preview on :4173); ONLY=sakura_1,ironhold_2 narrows it.
import { open, W, OUT } from './harness.mjs';
const hard = process.env.HARD === '1';
const { b, p, errors, state, shot, tele, settleCam, openGate, info } = await open({ hard, settle: hard ? 12000 : 7000 });
await openGate();
const X = { sakura_village: [41672, 480], sakura_1: [43254, 480], sakura_2: [44836, 480], sakura_3: [46418, 470], ironhold_village: [48090, 490], ironhold_1: [49672, 470], ironhold_2: [51254, 480], ironhold_3: [52836, 490] };
const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(X);
for (const id of only) {
  const [x0, y] = X[id];
  await tele(x0 + 836, y); await settleCam(); await W(p, hard ? 9000 : 6000);
  console.log(id, JSON.stringify(await state()), JSON.stringify(await info()));
  await shot(`${OUT}/t_${id}${hard ? '_hard' : ''}.jpg`);
}
console.log('errors', errors.length, errors.slice(0, 12).join('\n'));
await b.close();
