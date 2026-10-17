import { open, W, OUT } from './harness.mjs';
const { b, p, errors, state, shot, tele, up, settleCam, openGate } = await open({ settle: 7000 });
await settleCam(); await W(p, 3000); console.log('courtyard', JSON.stringify(await state())); await shot(`${OUT}/q_courtyard.jpg`);
await openGate(); await up(4500, 40, 680, 'sky-0'); await settleCam(); await W(p, 4000); console.log('sky', JSON.stringify(await state())); await shot(`${OUT}/q_sky.jpg`);
await tele(23730 + 836, 500); await settleCam(); await W(p, 4000); console.log('temple', JSON.stringify(await state())); await shot(`${OUT}/q_temple.jpg`);
console.log('errors', errors.length, errors.slice(0, 8).join('\n'));
await b.close();
