import { open, W, OUT } from './harness.mjs';
const hard = process.env.HARD === '1';
const { b, p, errors, state, shot, tele, settleCam, openGate, info } = await open({ hard, settle: hard ? 12000 : 7000 });
await openGate();
const X = { dusk_1: 23730, dusk_village: 25312, dusk_2: 26894, dusk_bridge: 28476, dusk_wood: 30058, dusk_3: 31640 };
const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(X);
for (const id of only) {
  const x0 = X[id];
  for (const [k, dx, y] of [['a', 836, 500], ...(process.env.FULL ? [['w', 300, 420], ['e', 1400, 600]] : [])]) {
    await tele(x0 + dx, y); await W(p, 1500); await settleCam(); await W(p, hard ? 9000 : 6000);
    console.log(id, k, JSON.stringify(await state()), JSON.stringify(await info()));
    await shot(`${OUT}/d_${id}_${k}${hard ? '_hard' : ''}.jpg`);
  }
}
console.log('errors', errors.length, errors.slice(0, 12).join('\n'));
await b.close();
