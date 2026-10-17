// The Thief's Den's five rooms on the 3D stage: a shot of each (the run forced to its stage, lanterns lit in rooms 2–3,
// the gate of room 4 parted from room 5's stage). Usage: node tools/world3d/shots_den.mjs  (vite preview on :4173)
import { open, W, OUT } from './harness.mjs';
const hard = process.env.HARD === '1';
const { b, p, errors, state, shot, tele, settleCam, openGate, info } = await open({ hard, settle: hard ? 12000 : 7000 });
await openGate();
const X = { den_1: 33312, den_2: 34984, den_3: 36656, den_4: 38328, den_5: 40000 };
const den = (js) => p.evaluate((js) => { const s = window.__game.scene.getScene('LegacyCourtyardScene'); const d = s.den; if (!d.run) d.run = { stage: 1, t0: s.simMs, secret2: [0, 1, 2], secret3: [0, 1, 2], lit: new Set(), hoardAt: 0 }; return new Function('d', 's', js)(d, s); }, js);
const views = [
  ['den_1', 836, 500, 'd.run.stage = 1;'],
  ['den_2', 836, 560, 'd.run.stage = 2; d.run.lit = new Set([0, 2]);'],
  ['den_3', 836, 560, 'd.run.stage = 3; d.run.lit = new Set([1, 3, 4]);'],
  ['den_4', 836, 520, 'd.run.stage = 4;'],
  ['den_5', 836, 520, 'd.run.stage = 5;'],
  ['den_4e', 1450, 520, 'd.run.stage = 5;', 'den_4'],
];
for (const [name, dx, y, js, room] of views) {
  await den(js); await tele(X[room ?? name] + dx, y); await settleCam(); await W(p, hard ? 9000 : 6000);
  console.log(name, JSON.stringify(await state()), JSON.stringify(await info()));
  await shot(`${OUT}/den_${name}${hard ? '_hard' : ''}.jpg`);
}
console.log('errors', errors.length, errors.slice(0, 12).join('\n'));
await b.close();
