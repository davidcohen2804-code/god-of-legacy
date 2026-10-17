// Kit B — what the Twilight Gardens' terraces carry (docs/WORLD_3D_SPEC.md §2.4, M20–M25): Wisteria Walk's pergola and
// lantern cords, Elderwood Village grown into the Elder Tree's roots, the Lantern Steps' stepped wall, Moonfall Bridge
// over its gorge under three great falls, the Elderwood Path's forest bank and brook, the Elder Hollow before the sealed
// door. The terrace builder (islandTerrace, `dusk`) gives the dusk light, the violet stone, the wisteria, the fireflies;
// these add the places' own models and their warm lights.
import * as THREE from 'three';
import { box, cyl, lathe, taperTube, canvasTex } from '../../arena3d/RoomKit';
import { wallRun, balustrade, ivyRun, ivyCanvas } from '../kit/terrain';
import { ux, uz, uy, footBox } from '../kit/units';
import { post, lanternCord, warmLight, halo, boulder, log, stump, glowcaps, roots, chimneySmoke, waterfall, water, ferns } from '../kit/props';
import { paperLanterns } from '../life/lanterns';
import { pond } from '../life/pond';
import type { Dressing } from './dressing';

// ------------------------------------------------------------------ M20 · Wisteria Walk

/** A pergola the length of the back edge (posts and beams hung with wisteria curtains), paper lanterns on cords between
 *  its posts, Lumen's lamp-pole and ladder at his spot, the urns planted with lavender. */
export const wisteriaWalk: Dressing = (c) => {
  const { P, zWall, xW0, xW1, R } = c;
  const H = 2.6, zA = zWall + 0.5, zB = zWall + 2.0, posts: number[] = [];
  for (let x = xW0 + 1; x < xW1; x += 3.2) posts.push(x);
  for (const x of posts) { post(c, x, 0, zA, H, 0.18); post(c, x, 0, zB, H, 0.18); P.add('wood', box(0.3, 0.3, zB - zA + 0.5, x, H, (zA + zB) / 2, 0.6)); }
  P.add('wood', box(xW1 - xW0 + 1, 0.22, 0.26, (xW0 + xW1) / 2, H + 0.3, zA, 0.6), box(xW1 - xW0 + 1, 0.22, 0.26, (xW0 + xW1) / 2, H + 0.3, zB, 0.6));
  for (let x = xW0 + 0.4; x < xW1; x += 0.8) P.add('wood', box(0.08, 0.14, zB - zA + 0.9, x, H + 0.52, (zA + zB) / 2, 0.6)); // the lattice
  // the wisteria curtains: racemes hanging thick from the beams and the lattice, swaying
  { const wt = canvasTex(ivyCanvas(['#8a6ab8', '#a98ad8', '#c4a8ee', '#6a4a98', '#b89ae0', '#5a7a4a'], 9)); c.disposables.push(wt);
    const spots: { x: number; y: number; z: number; drop: number; s: number }[] = [];
    for (let x = xW0 + 0.3; x < xW1; x += 0.55) for (const z of [zA + 0.15, (zA + zB) / 2, zB - 0.15]) if (R() < 0.8) spots.push({ x: x + (R() - 0.5) * 0.4, y: H + 0.5, z: z + (R() - 0.5) * 0.3, drop: 0.7 + R() * 0.9, s: 0.7 + R() * 0.5 });
    const run = ivyRun(c.scene, wt, spots, R); c.disposables.push(run); c.sway.push((t, w) => run.update(t, w)); }
  // lantern cords between the front posts, three lit
  for (let i = 0; i + 1 < posts.length; i++) lanternCord(c, new THREE.Vector3(posts[i], H - 0.05, zA + 0.1), new THREE.Vector3(posts[i + 1], H - 0.05, zA + 0.1), [0.3, 0.7], { lit: i % 2 === 1 && i < 7 ? 1 : 0, seed: 41 + i });
  // Lumen's lamp-pole with its hook and his ladder against the pergola
  const lumen = (c.A.npcs ?? []).find((n) => n.id === 'lumen'); const lx = lumen ? ux(lumen.x + c.ax) : c.F.x0 + 3, lz = lumen ? uz(lumen.y) : c.F.zB;
  P.add('dark', cyl(0.04, 0.04, 2.2, lx + 1.1, 0, lz - 0.5, 8)); { const g = new THREE.TorusGeometry(0.16, 0.025, 6, 12, Math.PI); g.rotateZ(Math.PI); g.translate(lx + 1.1, 2.3, lz - 0.5); P.add('dark', g); }
  c.life.push(paperLanterns(c.scene, [{ x: lx + 1.26, y: 2.3, z: lz - 0.5 }], { wind: c.air, seed: 5, drop: 0.1, color: 0xf2d8a8, glow: 0xffb060 })); warmLight(c, lx + 1.26, 1.9, lz - 0.5, 1.8, 6);
  { const g = box(0.5, 2.6, 0.06, 0, 0, 0, 0.5); g.rotateX(-0.3); g.translate(lx - 1.4, 0, zA + 0.75); P.add('wood', g); for (let k = 0; k < 7; k++) { const r = box(0.44, 0.05, 0.05, 0, 0, 0, 0.5); r.rotateX(-0.3); r.translate(lx - 1.4, 0.34 * (k + 1), zA + 0.75 - 0.31 * 0.34 * (k + 1) / 1.02); P.add('wood', r); } }
  // the glowcaps' spore dust: a soft blue halo at a few spots along the walk's back
  for (const s of c.A.mobs?.spawns ?? []) if (R() < 0.6) halo(c, ux(s[0] + c.ax), 0.3, uz(s[1]) - 0.3, 1.4, 0x8aa0ff, 0.18);
};

// ------------------------------------------------------------------ M21 · Elderwood Village

/** Three round-doored houses grown into the Elder Tree's roots along the back, the well, Hazel's stall under a lantern-lit
 *  awning, Wren's range, the Waystone's little shrine, the crates and the boulder, the Elder Tree's trunk rising behind. */
export const elderwoodVillage: Dressing = (c) => {
  const { P, zWall, cx, R } = c;
  const npc = (id: string) => (c.A.npcs ?? []).find((n) => n.id === id);
  // the Elder Tree behind everything: a trunk out of frame and its outer roots crossing the back ground
  P.add('bark', lathe([[5.2, -0.5], [4.2, 1.5], [3.6, 5], [3.3, 12], [3.2, 20]], cx + 2, 0, zWall - 7.5, 22, 1.2));
  roots(c, [{ x: cx - 1, z: zWall - 2.2, len: 7, dir: -1, r: 0.55, lift: 1.1 }, { x: cx + 4, z: zWall - 2.0, len: 8, dir: 1, r: 0.6, lift: 1.3 }, { x: cx - 8, z: zWall - 0.6, len: 5, dir: -1, r: 0.4, lift: 0.7 }, { x: cx + 10, z: zWall - 0.8, len: 5, dir: 1, r: 0.42, lift: 0.8 }]);
  // the houses: a root-bank body, a round door, a lit round window, a moss roof, a chimney
  const win = c.std({ color: 0xffd090, emissive: 0xffa040, emissiveIntensity: 1.4, roughness: 0.6 }); c.M.window = win;
  const chimneys: { x: number; y: number; z: number }[] = [];
  for (const [i, dx] of [-7.2, -1.0, 6.4].entries()) {
    const x = cx + dx, z = zWall - 1.2, w = 3.2 + (i % 2) * 0.6, h = 2.4 + (i % 2) * 0.3;
    { const g = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(w / 2, h, 1.6); g.translate(x, 0, z); P.add('bark', g); }
    { const g = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.6); g.scale(w / 2 + 0.25, h * 0.55, 1.85); g.translate(x, h * 0.5, z); P.add(c.M.moss ? 'moss' : 'balustrade', g); } // the moss roof
    { const d = new THREE.CircleGeometry(0.55, 20); d.translate(x - 0.3, 0.6, z + 1.62); P.add('wood', d); const f = new THREE.TorusGeometry(0.55, 0.07, 8, 20); f.translate(x - 0.3, 0.6, z + 1.63); P.add('bark', f); P.add('gold', lathe([[0.001, 0], [0.04, 0.01], [0.04, 0.05], [0.001, 0.06]], x - 0.05, 0.6, z + 1.68, 8)); } // the round door
    { const d = new THREE.CircleGeometry(0.3, 16); d.translate(x + 0.95, 1.1, z + 1.45); P.add('window', d); const f = new THREE.TorusGeometry(0.3, 0.05, 8, 16); f.translate(x + 0.95, 1.1, z + 1.46); P.add('bark', f); halo(c, x + 0.95, 1.1, z + 1.55, 1.8, 0xffa050, 0.4); }
    P.add('wall', box(0.4, 0.9, 0.4, x + 0.6, h * 0.9, z - 0.3, 1, 0.02)); chimneys.push({ x: x + 0.6, y: h * 0.9 + 0.95, z: z - 0.3 });
    warmLight(c, x + 0.95, 1.1, z + 1.9, 1.6, 6);
  }
  chimneySmoke(c, chimneys);
  // the well (the prop: walkable at its height): a stone drum, two posts and a little roof, the bucket on its rope
  for (const p of c.A.props.filter((q) => q.id === 'well')) { const b = footBox(p.foot, c.ax), h = uy(p.h || 85), r = Math.min(b.w, b.d) / 2;
    P.add('wall', lathe([[r * 0.8, 0], [r, 0.04], [r, h - 0.08], [r * 1.08, h - 0.08], [r * 1.08, h], [r * 0.72, h], [r * 0.72, h - 0.3]], b.cx, 0, b.cz, 20, 1.1));
    P.add('dark', cyl(r * 0.72, r * 0.72, 0.02, b.cx, h - 0.3, b.cz, 20)); // the water, dark
    for (const dx of [-r * 0.9, r * 0.9]) post(c, b.cx + dx, h - 0.1, b.cz, 1.5, 0.12);
    P.add('wood', box(r * 1.8 + 0.3, 0.1, 0.1, b.cx, h + 1.3, b.cz, 0.5)); P.add('dark', cyl(0.05, 0.05, r * 1.8, 0, 0, 0, 8)); // (the windlass is the beam)
    { const g = box(r * 2.4, 0.08, 1.4, 0, 0, 0, 1); g.rotateX(0.35); g.translate(b.cx, h + 1.75, b.cz - 0.3); P.add('roof', g); const g2 = box(r * 2.4, 0.08, 1.4, 0, 0, 0, 1); g2.rotateX(-0.35); g2.translate(b.cx, h + 1.75, b.cz + 0.3); P.add('roof', g2); }
    P.add('wood', lathe([[0.1, 0], [0.16, 0.02], [0.17, 0.22], [0.15, 0.25]], b.cx + r * 0.2, h + 0.5, b.cz, 10)); P.add('dark', cyl(0.01, 0.01, 0.55, b.cx + r * 0.2, h + 0.75, b.cz, 4));
  }
  // the crates and the boulder as they stand (walkable at their heights)
  for (const p of c.A.props.filter((q) => q.id === 'crates')) { const b = footBox(p.foot, c.ax), h = uy(p.h || 70); P.add('wood', box(b.w * 0.55, h, b.d, b.x0 + b.w * 0.275, 0, b.cz, 0.6, 0.02), box(b.w * 0.42, h * 0.7, b.d * 0.8, b.x1 - b.w * 0.21, 0, b.cz, 0.6, 0.02), box(b.w * 0.3, h * 0.3, b.d * 0.5, b.x1 - b.w * 0.25, h * 0.7, b.cz, 0.6, 0.02)); for (let k = 0; k < 3; k++) P.add('dark', box(b.w * 0.55 + 0.02, 0.03, 0.03, b.x0 + b.w * 0.275, h * (0.3 + k * 0.3), b.z1, 1)); }
  for (const p of c.A.props.filter((q) => q.id === 'boulder')) { const b = footBox(p.foot, c.ax); boulder(c, b.cx, b.cz, b.w, b.d, uy(p.h || 67)); }
  // Hazel's stall: a counter, posts, an awning with a lantern, jars and bolts of cloth
  { const hz = npc('hazel'); const x = hz ? ux(hz.x + c.ax) : cx + 3, z = zWall + 0.9;
    P.add('wood', box(2.6, 0.9, 0.7, x, 0, z, 0.6, 0.02)); for (const [dx, dz] of [[-1.25, -0.3], [1.25, -0.3], [-1.25, 0.4], [1.25, 0.4]]) post(c, x + dx, 0, z + dz, 2.3 - (dz > 0 ? 0.3 : 0), 0.12);
    { const g = box(2.9, 0.06, 1.3, 0, 0, 0, 1); g.rotateX(0.18); g.translate(x, 2.15, z + 0.05); P.add('terracotta', g); }
    for (let k = 0; k < 4; k++) P.add('gold', lathe([[0.001, 0], [0.07, 0.02], [0.08, 0.1], [0.04, 0.14], [0.001, 0.15]], x - 0.7 + k * 0.45, 0.9, z - 0.05, 8));
    for (let k = 0; k < 3; k++) { const g = cyl(0.09, 0.09, 0.6, 0, 0, 0, 8); g.rotateZ(Math.PI / 2); g.translate(x + 0.6, 0.99 + k * 0.1, z + (k - 1) * 0.15); P.add(k === 1 ? 'terracotta' : 'moulding', g); }
    c.life.push(paperLanterns(c.scene, [{ x: x - 0.9, y: 2.0, z: z + 0.55 }], { wind: c.air, seed: 7, drop: 0.1, color: 0xf2d8a8, glow: 0xffb060 })); warmLight(c, x - 0.9, 1.6, z + 0.6, 1.8, 6);
  }
  // Wren's range: three straw targets on hay bales at the back-left and a rack of bows
  { const wx = (npc('wren') ? ux(npc('wren')!.x + c.ax) : cx + 2) - 2.6, z = zWall + 0.7;
    for (let k = 0; k < 3; k++) { const x = wx + k * 1.0; P.add('terracotta', box(0.7, 0.5, 0.5, x, 0, z, 0.6, 0.02)); const d = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 20); d.rotateX(Math.PI / 2); d.translate(x, 0.85, z + 0.2); P.add('moulding', d); const ring = new THREE.TorusGeometry(0.18, 0.03, 6, 20); ring.translate(x, 0.85, z + 0.25); P.add('dark', ring); }
    P.add('wood', box(1.4, 0.08, 0.08, wx + 3.4, 1.1, z, 0.5), box(0.1, 1.2, 0.1, wx + 2.8, 0, z, 0.5), box(0.1, 1.2, 0.1, wx + 4.0, 0, z, 0.5));
    for (let k = 0; k < 3; k++) { const g = new THREE.TorusGeometry(0.4, 0.02, 6, 16, Math.PI); g.rotateZ(-Math.PI / 2); g.translate(wx + 2.95 + k * 0.45, 0.75, z - 0.02); P.add('wood', g); }
  }
  // the Waystone's shrine: two posts and a mossy roof over it, a cool glow at the stone
  { const ws = (c.A.npcs ?? []).find((n) => n.id.startsWith('waystone')); const x = ws ? ux(ws.x + c.ax) : c.F.x0 + 3, z = ws ? uz(ws.y) - 0.5 : c.F.zB;
    for (const dx of [-0.9, 0.9]) { post(c, x + dx, 0, z - 0.5, 2.3, 0.14); post(c, x + dx, 0, z + 0.4, 2.1, 0.14); }
    { const g = box(2.4, 0.1, 1.6, 0, 0, 0, 1); g.rotateX(0.2); g.translate(x, 2.35, z - 0.1); P.add(c.M.moss ? 'moss' : 'roof', g); }
    halo(c, x, 1.0, z + 0.3, 2.2, 0x9ab0ff, 0.3);
  }
  // the stream under a plank bridge at the east exit
  water(c, c.F.x1 + 0.2, (zWall + c.zFront) / 2, 1.3, c.zFront - zWall + 2, -0.5, 2);
  P.add('wood', box(1.7, 0.08, c.zFront - zWall + 0.4, c.F.x1 + 0.2, 0, (zWall + c.zFront) / 2, 0.6)); for (let z = zWall; z < c.zFront; z += 0.34) P.add('dark', box(1.7, 0.012, 0.02, c.F.x1 + 0.2, 0.08, z, 1));
  for (const dz of [zWall + 0.2, c.zFront - 0.2]) P.add('wood', box(1.9, 0.08, 0.08, c.F.x1 + 0.2, 0.75, dz, 0.5), box(0.08, 0.8, 0.08, c.F.x1 - 0.6, 0, dz, 0.5), box(0.08, 0.8, 0.08, c.F.x1 + 1.0, 0, dz, 0.5));
  void R;
};

// ------------------------------------------------------------------ M22 · Lantern Steps

/** The back line rising east in three broad steps (a stepped wall with lantern posts climbing it), lantern cords zig-zagging
 *  overhead between tall posts, a stone stair at the back-left up to a closed garden gate. */
export const lanternSteps: Dressing = (c) => {
  const { P, zWall, xW0, xW1 } = c;
  const thirds = [xW0 - 4, c.F.x0 + (c.F.x1 - c.F.x0) / 3, c.F.x0 + (2 * (c.F.x1 - c.F.x0)) / 3, xW1 + 4];
  const tall: THREE.Vector3[] = [], postLanterns: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 3; i++) { const h = 1.6 + i * 0.9, x0 = thirds[i], x1 = thirds[i + 1];
    wallRun(P, x0, x1, 0, h, zWall, { thick: 0.9, pilasterEvery: 3.6 });
    balustrade(P, x0, x1, h, zWall - 0.6, { post: 1.6, h: 0.8 });
    for (let x = x0 + 1.2; x < x1 - 0.5; x += 2.6) { P.add('dark', cyl(0.05, 0.04, 1.3, x, h, zWall - 0.25, 8)); P.add('dark', cyl(0.14, 0.1, 0.08, x, h + 1.3, zWall - 0.25, 8)); postLanterns.push({ x, y: h + 1.24, z: zWall - 0.25 }); }
    if (i < 2) P.add('moulding', box(0.3, 0.9 + 0.2, 1.1, x1, h, zWall - 0.45, 1, 0.02)); // the riser between the steps
  }
  c.life.push(paperLanterns(c.scene, postLanterns, { wind: c.air, seed: 60, drop: 0.06, color: 0xf2d8a8, glow: 0xffb060 })); // (the posts' lanterns as one set: five draws)
  // tall posts along the terrace's back and the cords zig-zagging between them, the moths' home
  for (let k = 0; k < 6; k++) { const x = c.F.x0 + 0.8 + k * ((c.F.x1 - c.F.x0 - 1.6) / 5), z = zWall + (k % 2 ? 0.7 : 2.2); post(c, x, 0, z, 3.4, 0.18); P.add('dark', cyl(0.12, 0.08, 0.1, x, 3.4, z, 8)); tall.push(new THREE.Vector3(x, 3.3, z)); }
  for (let k = 0; k + 1 < tall.length; k++) lanternCord(c, tall[k], tall[k + 1], [0.25, 0.5, 0.75], { sag: 0.5, lit: k === 1 || k === 3 ? 1 : 0, seed: 70 + k });
  // the stair at the back-left up to a closed garden gate (scenery)
  { const sx = c.F.x0 + 2.4, steps = 6, h0 = 1.6; for (let k = 0; k < steps; k++) P.add('balustrade', box(1.6, (h0 / steps) * (k + 1), 0.32, sx, 0, zWall + 0.16 + (steps - 1 - k) * 0.32, 1.1, 0.02));
    P.add('wall', box(0.4, 2.6, 0.4, sx - 1.0, h0, zWall - 0.9, 1.3, 0.02), box(0.4, 2.6, 0.4, sx + 1.0, h0, zWall - 0.9, 1.3, 0.02)); P.add('moulding', box(2.6, 0.3, 0.5, sx, h0 + 2.6, zWall - 0.9, 1, 0.03));
    for (let i = -3; i <= 3; i++) P.add('dark', box(0.06, 2.4, 0.06, sx + i * 0.26, h0, zWall - 0.9, 0.5)); P.add('dark', box(1.7, 0.06, 0.06, sx, h0 + 1.1, zWall - 0.9), box(1.7, 0.06, 0.06, sx, h0 + 2.2, zWall - 0.9)); }
};

// ------------------------------------------------------------------ M23 · Moonfall Bridge

/** The floor a stone bridge over a gorge: a parapet behind (the front one the kit's), three arches under the deck, the
 *  cliff behind with three great falls pouring moonlit into the river that runs under the bridge toward the camera and
 *  falls again in front; the blocks as parapet piers with lanterns; the moon over the falls. */
export const moonfallBridge: Dressing = (c) => {
  const { P, zWall, cx, xW0, xW1 } = c;
  balustrade(P, xW0 - 4, xW1 + 4, 0, zWall + 0.3, { post: 1.6, h: 0.95 });
  // the arches under the deck's front and back faces, the piers between
  for (const dx of [-7, 0, 7]) { for (const z of [c.zFront + 0.02, zWall - 0.3]) { const g = new THREE.TorusGeometry(2.6, 0.45, 10, 22, Math.PI); g.translate(cx + dx, -3.0, z); P.add('wall', g); } P.add('wall', box(1.4, 3.2, c.zFront - zWall + 1.0, cx + dx + 3.5, -3.2, (zWall + c.zFront) / 2, 1.3)); P.add('wall', box(1.4, 3.2, c.zFront - zWall + 1.0, cx + dx - 3.5, -3.2, (zWall + c.zFront) / 2, 1.3)); }
  // the cliff behind and its three great falls, the river
  P.add('wall', box(xW1 - xW0 + 30, 16, 6, cx, -6, zWall - 7, 1.6)); P.add('wall', box(xW1 - xW0 + 34, 4, 8, cx, -6, zWall - 12, 1.6));
  for (const [dx, w] of [[-7.5, 1.7], [0.5, 2.3], [7.6, 1.4]] as [number, number][]) { P.add('moulding', box(w + 0.6, 0.4, 1.2, cx + dx, 9.6, zWall - 4.1, 1, 0.03)); waterfall(c, cx + dx, 9.8, -5.6, zWall - 3.8, w); }
  for (let x = xW0 - 8; x < xW1 + 8; x += 2.3) P.add('wall', box(1.1 + c.R() * 0.8, 3 + c.R() * 7, 0.6 + c.R() * 0.5, x + (c.R() - 0.5) * 0.8, 2 + c.R() * 3, zWall - 4.0, 1.6, 0.05)); // the cliff's broken face
  water(c, cx, zWall - 2.5, xW1 - xW0 + 30, 4.6, -5.6, 0); water(c, cx, c.zFront + 2.6, xW1 - xW0 + 30, 4.6, -5.6, 0);
  for (const [dx, w] of [[-4, 1.6], [3.2, 1.8], [8.6, 1.4]] as [number, number][]) waterfall(c, cx + dx, -5.6, -14, c.zFront + 4.8, w); // the falls below the bridge in front
  // the piers' lanterns (on the blocks' tops) and a lamp on each parapet end
  for (const p of c.A.props.filter((q) => q.id.startsWith('block'))) { const b = footBox(p.foot, c.ax), h = uy(p.h || 70); P.add('dark', cyl(0.05, 0.04, 1.1, b.cx, h, b.cz, 8), cyl(0.13, 0.1, 0.08, b.cx, h + 1.1, b.cz, 8)); c.life.push(paperLanterns(c.scene, [{ x: b.cx, y: h + 1.04, z: b.cz }], { wind: c.air, seed: 80 + Math.round(b.cx), drop: 0.06, color: 0xf2d8a8, glow: 0xffb060 })); if (b.cz < (zWall + c.zFront) / 2) warmLight(c, b.cx, h + 0.7, b.cz, 2.0, 8); }
  // the moon over the falls
  halo(c, cx + 3, 16, zWall - 30, 9, 0xd8e4ff, 0.55); { const d = new THREE.CircleGeometry(1.7, 32); d.translate(cx + 3, 16, zWall - 31); const m = c.std({ color: 0xf4f6ff, emissive: 0xe8eeff, emissiveIntensity: 1.0, fog: false }); const mesh = new THREE.Mesh(d, m); c.scene.add(mesh); c.disposables.push(d); }
};

// ------------------------------------------------------------------ M24 · Elderwood Path

/** The terrace become forest: a bank of mossy roots and trunks along the back, a brook with lily pads along the front
 *  edge, the log across the path, the stump and the boulder, glowcaps under the roots, ferns. */
export const elderwoodPath: Dressing = (c) => {
  const { P, zWall, cx, xW0, xW1, R } = c;
  // the bank: a long mossy mound behind the walk line, roots over it, trunks rising out of frame
  { const g = new THREE.BoxGeometry(xW1 - xW0 + 12, 1.6, 4.5, 12, 1, 3); const pos = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) + (R() - 0.5) * 0.5); g.computeVertexNormals(); g.translate(cx, 0, zWall - 1.6); P.add(c.M.moss ? 'moss' : 'balustrade', g); }
  roots(c, [{ x: cx - 9, z: zWall - 0.6, len: 6, dir: 1, r: 0.5, lift: 1.4 }, { x: cx - 2, z: zWall - 0.8, len: 7, dir: 1, r: 0.6, lift: 1.7 }, { x: cx + 5, z: zWall - 0.5, len: 6, dir: 1, r: 0.5, lift: 1.3 }, { x: cx + 10, z: zWall - 0.9, len: 5, dir: -1, r: 0.45, lift: 1.1 }]);
  for (const [dx, r] of [[-8, 0.9], [-3, 1.3], [2.5, 1.0], [8, 1.5], [13, 1.1]] as [number, number][]) P.add('bark', lathe([[r * 1.6, -0.3], [r * 1.1, 0.8], [r, 3], [r * 0.9, 9], [r * 0.85, 18]], cx + dx, 0, zWall - 3.2 - R() * 1.5, 14, 1.2));
  // the brook along the front edge: a mossy bank and the water with lily pads
  P.add(c.M.moss ? 'moss' : 'balustrade', box(xW1 - xW0 + 10, 0.25, 0.6, cx, -0.2, c.zFront + 0.1, 1.2, 0.04));
  water(c, cx, c.zFront + 1.4, xW1 - xW0 + 10, 2.0, -0.3, 10);
  // the props: the log across the path (walkable), the stump, the boulder
  for (const p of c.A.props.filter((q) => q.id === 'log')) { const b = footBox(p.foot, c.ax); log(c, b.x0, b.x1, b.cz, uy(p.h || 55)); }
  for (const p of c.A.props.filter((q) => q.id === 'stump')) { const b = footBox(p.foot, c.ax); stump(c, b.cx, b.cz, Math.min(b.w, b.d), uy(p.h || 95)); }
  for (const p of c.A.props.filter((q) => q.id === 'boulder')) { const b = footBox(p.foot, c.ax); boulder(c, b.cx, b.cz, b.w, b.d, uy(p.h || 90)); }
  // glowcaps and ferns under the roots, their light
  const caps: { x: number; z: number }[] = []; for (let x = c.F.x0 + 1; x < c.F.x1; x += 2.8) caps.push({ x: x + (R() - 0.5) * 1.2, z: zWall + 0.3 + R() * 0.5 });
  glowcaps(c, caps); for (const [i, s] of caps.entries()) if (i % 3 === 1) warmLight(c, s.x, 0.5, s.z + 0.3, 1.2, 5, 0x6a8aff);
  const fs: { x: number; z: number }[] = []; for (let x = xW0; x < xW1; x += 1.3) fs.push({ x: x + (R() - 0.5) * 0.8, z: zWall + 0.1 + R() * 0.4 });
  ferns(c, fs);
};

// ------------------------------------------------------------------ M25 · The Elder Hollow

/** The Elder Tree's trunk filling the back with the sealed sun-rune door set in it, Bram's root step beside it, buttress
 *  roots fanning out, the boulders, the root arch and the log as they stand, the pond at the front-left with its stone
 *  rim, the Hollow Gate — a rough stone arch across the east end — where the fox lurks; lanterns on the roots. */
export const elderHollow: Dressing = (c) => {
  const { P, zWall, cx, xW0, xW1, R } = c;
  const bram = (c.A.npcs ?? []).find((n) => n.id === 'bram'); const dx = bram ? ux(bram.x + c.ax) + 1.6 : cx, tz = zWall - 2.2;
  // the trunk (6 units wide at the base) and the buttress roots
  P.add('bark', lathe([[4.6, -0.5], [3.6, 1.2], [3.1, 4], [2.9, 10], [2.8, 22]], dx, 0, tz, 26, 1.3));
  for (let k = 0; k < 7; k++) { const a = Math.PI * 0.15 + (k / 6) * Math.PI * 0.7, r0 = 3.2, len = 3.5 + R() * 2.5; const pts = [new THREE.Vector3(dx + Math.cos(a) * r0, 2.2 + R(), tz + Math.sin(a) * r0 * 0.7), new THREE.Vector3(dx + Math.cos(a) * (r0 + len * 0.5), 0.7, tz + Math.sin(a) * (r0 * 0.7 + len * 0.4)), new THREE.Vector3(dx + Math.cos(a) * (r0 + len), -0.4, tz + Math.sin(a) * (r0 * 0.7 + len * 0.8))]; P.add('bark', taperTube(new THREE.CatmullRomCurve3(pts), 0.6, 0.25, 10, 8, 0.6)); }
  // the sealed door: two dark leaves in a bark frame, the sun rune gilt on them, a faint warm light in its grooves
  const doorMat = c.std({ color: 0x3a2a26, roughness: 0.8 }); c.M.door = doorMat;
  { const dz = tz + 3.15, dw = 1.1, dh = 2.6; for (const s of [-1, 1]) P.add('door', box(dw, dh, 0.14, dx + s * dw / 2, 0, dz, 1, 0.02));
    { const f = new THREE.TorusGeometry(dw + 0.1, 0.16, 8, 24, Math.PI); f.translate(dx, dh - 0.1, dz); P.add('bark', f); } P.add('bark', box(0.3, dh, 0.4, dx - dw - 0.15, 0, dz, 1, 0.02), box(0.3, dh, 0.4, dx + dw + 0.15, 0, dz, 1, 0.02));
    { const d = new THREE.CylinderGeometry(0.46, 0.46, 0.04, 24); d.rotateX(Math.PI / 2); d.translate(dx, 1.5, dz + 0.09); P.add('gold', d); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const g = box(0.06, 0.28, 0.03, 0, 0, 0, 1); g.translate(0, 0.52, 0); g.rotateZ(a); g.translate(dx, 1.5, dz + 0.09); P.add('gold', g); } }
    halo(c, dx, 1.5, dz + 0.2, 2.6, 0xffb060, 0.22); warmLight(c, dx, 1.6, dz + 0.6, 1.4, 6);
  }
  // Bram's root step beside the door
  P.add('bark', lathe([[0.9, 0], [1.0, 0.1], [0.85, 0.35], [0.5, 0.42], [0.001, 0.42]], dx - 2.4, 0, tz + 2.6, 14, 1));
  // the props as they stand
  for (const p of c.A.props.filter((q) => q.id.startsWith('boulder'))) { const b = footBox(p.foot, c.ax); boulder(c, b.cx, b.cz, b.w, b.d, uy(p.h || 90)); }
  for (const p of c.A.props.filter((q) => q.id === 'log')) { const b = footBox(p.foot, c.ax); log(c, b.x0, b.x1, b.cz, uy(p.h || 70)); }
  for (const p of c.A.props.filter((q) => q.id === 'root-arch')) { const b = footBox(p.foot, c.ax), h = uy(p.h || 95); const pts = [new THREE.Vector3(b.x0, -0.3, b.cz), new THREE.Vector3(b.x0 + b.w * 0.25, h * 0.9, b.cz - 0.1), new THREE.Vector3(b.x1 - b.w * 0.25, h, b.cz + 0.1), new THREE.Vector3(b.x1, -0.3, b.cz)]; P.add('bark', taperTube(new THREE.CatmullRomCurve3(pts), 0.45, 0.4, 12, 8, 0.6)); }
  // the pond at the front-left (mirrored), the stream from it to the front edge
  c.life.push(pond(c.scene, { x: c.F.x0 + 3.6, z: c.zFront + 1.3, w: 3.8, d: 1.8, y: 0 }, { wind: c.air, stone: c.M.balustrade, mirror: !c.soft, sunDir: c.sunDir, sunColor: new THREE.Color(0xa8bcff), skyLow: new THREE.Color(0xe8a898), skyMid: new THREE.Color(0x9a5a84), koi: 0, pads: 4, seed: 19 }));
  water(c, c.F.x0 + 5.8, c.zFront + 2.6, 1.0, 1.6, -0.1, 0);
  P.add(c.M.moss ? 'moss' : 'balustrade', box(xW1 - xW0 + 10, 0.2, 0.5, cx, -0.1, c.zFront + 0.2, 1.2, 0.04)); // the mossy lip
  // the Hollow Gate at the east end: a rough stone arch across the walk
  { const gx = c.F.x1 - 1.0; for (const z of [zWall - 0.2, c.zFront + 0.2]) P.add('wall', box(0.9, 3.0, 0.9, gx, 0, z, 1.3, 0.04)); const g = new THREE.TorusGeometry((c.zFront - zWall + 0.4) / 2, 0.42, 10, 22, Math.PI); g.rotateY(Math.PI / 2); g.translate(gx, 3.0, (zWall + c.zFront) / 2); P.add('wall', g); }
  // lanterns on the roots, glowcaps in the shade
  for (const [i, [lx, lz]] of [[dx - 4.6, tz + 2.8], [dx + 4.4, tz + 2.9], [c.F.x0 + 3, zWall + 0.4]].entries()) { P.add('dark', cyl(0.04, 0.03, 1.4, lx, 0, lz, 8)); c.life.push(paperLanterns(c.scene, [{ x: lx, y: 1.36, z: lz }], { wind: c.air, seed: 90 + i, drop: 0.06, color: 0xf2d8a8, glow: 0xffb060 })); if (i < 2) warmLight(c, lx, 1.0, lz + 0.3, 1.8, 7); }
  glowcaps(c, [{ x: dx - 6, z: zWall + 0.2 }, { x: dx + 6.4, z: zWall + 0.3 }, { x: c.F.x1 - 4, z: zWall + 0.5 }]);
  ferns(c, [{ x: dx - 5.5, z: zWall - 0.1 }, { x: dx + 5.8, z: zWall }, { x: c.F.x0 + 1, z: zWall + 0.2 }, { x: c.F.x1 - 3, z: zWall + 0.1 }]);
};
