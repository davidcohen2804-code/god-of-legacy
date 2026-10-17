// Every 3D map's cost against the spec's budget (§3.2: ≤ 250 draws, ≤ 600 k triangles; the point lights the kit
// allows): teleports to each map's middle and counts what the place holds. Usage: node tools/world3d/budget.mjs
import { readFileSync } from 'node:fs';
import { open, W } from './harness.mjs';
const LAY = JSON.parse(readFileSync(new URL('../../src/data/world-strip.json', import.meta.url), 'utf8')).areas;
const MAPS_3D = (readFileSync(new URL('../../src/world3d/flag.ts', import.meta.url), 'utf8').match(/MAPS_3D = \[([^\]]*)\]/) ?? [, ''])[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter((s) => s && s !== 'sky');
const { b, p, errors, tele, settleCam, openGate, info, up } = await open({ settle: 3000 });
await openGate();
const rows = [], over = [];
for (const id of MAPS_3D) { const L = LAY[id]; await tele((L.span[0] + L.span[1]) / 2, 500); await settleCam(); await W(p, 1500); const i = await info(); rows.push([id, i]); if (i.draws > 250 || i.tris > 600000 || i.lights > 8) over.push(id); console.log(id.padEnd(18), `draws ${String(i.draws).padStart(4)}  tris ${String(i.tris).padStart(7)}  point lights ${i.lights}  textures ${i.tex}`); }
await up(4500, 40, 680, 'sky-0'); await settleCam(); await W(p, 1500); { const i = await info(); console.log('sky'.padEnd(18), `draws ${String(i.draws).padStart(4)}  tris ${String(i.tris).padStart(7)}  point lights ${i.lights}  textures ${i.tex}`); if (i.draws > 250 || i.tris > 600000) over.push('sky'); }
console.log(over.length ? `OVER BUDGET: ${over.join(', ')}` : 'all within budget', '· errors', errors.length);
await b.close();
