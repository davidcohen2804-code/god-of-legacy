import { open, W, OUT } from './harness.mjs';

const hard = process.env.HARD === '1';
const { b, p, errors, state, shot, up, settleCam } = await open({ hard, settle: hard ? 12000 : 7000 });
for (const [name, x, y, z, id] of [['path', 4500, 40, 680, 'sky-0'], ['haven', 7500, 20, 800, 'cloud_haven'], ['grumble', 9300, 20, 800, 'cloud_haven'], ['sunfall', 10300, 60, 800, 'sunfall_pass'], ['afterglow', 11900, 20, 800, 'afterglow']]) {
  await up(x, y, z, id); await W(p, 1500); await settleCam(); await W(p, hard ? 9000 : 6000);
  console.log(name, JSON.stringify(await state()));
  await shot(`${OUT}/s_${name}${hard ? '_hard' : ''}.jpg`);
}
console.log('errors', errors.length, errors.slice(0, 12).join('\n'));
await b.close();
