// PVP 3D — the Archer, rebuilt by DFO (David 18 Oct 18:33: "go over her yourself, surgically, characterise her down to the
// last detail and improve her significantly — the effects, what she does, the idea").
// One idea for the whole class, taken from her own card: the RANGER OF THE WILD WOOD — forest green and leaf gold, her
// quiver's real arrows (a dark shaft, a gold broad head, white fletching), the leaves of her cloak, the wind that carries
// them, the thorned vines of the wood, and the wood's spirit beasts (hawk, wolf, eagle) in pale spirit light. Every arrow
// she looses is a real arrow flying in the room's 3D (and sticks in the planks where it falls); every blow scatters leaves.
// Her two elemental arrows keep their own light: FIRE (Fireball Arrow) and STORM (Thunder Rain).
// The painted layer (ArcherFx) keeps what is painted best — her spirit beasts, her decoy — and steps aside for the rest.
// The pieces: ../Fx3D.ts and ./pieces.ts (arrow, arrowFall, spray, vine, wreath, funnel, star, ribbon …).
import type { Recipe, Fx3D, V3 } from '../Fx3D';
import type { CastRun } from '../../skills/SkillRuntime';
import { me, side, placeOf, T } from './kit';
import { arrow, arrowFall, spray, vine, wreath, funnel, ribbon, hover, surge, lifeTree } from './pieces';
import { hitIndex } from '../../skills/FinalKit';

/** The palette (her card): forest green, leaf green, leaf gold; the wind's pale green; the spirit beasts' pale light. */
export const RANGER = { forest: 0x3f8f34, leaf: 0x7fd65a, gold: 0xffd27a, wind: 0xd8ffd0, spirit: 0x9dffc8, fire: 0xff7a2a, storm: 0x9fe4ff };
const { forest: FOREST, leaf: LEAF, gold: GOLD, wind: WIND, spirit: SPIRIT, fire: FIRE, storm: STORM } = RANGER;
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
/** Thunder Rain's three arrows waiting over her shoulder (by cast), loosed one a beat. */
const HELD = new Map<string, ReturnType<typeof hover>[]>();
/** Vine Lash's archer (the room's hit carries no caster): who loosed the last one, and when. */
let LASH: { id: string; t: number } | null = null;
/** Her bow (the hand that holds it), world px. */
const bow = (f: Fx3D, r: CastRun): V3 => { const c = me(f, r); return { x: c.x + side(r) * 34, y: c.y, z: c.z + 74 }; };
/** A flash at the bow as an arrow leaves it: light, a puff of wind, a leaf or two. */
const loose = (f: Fx3D, o: V3, color: number, k = 1): void => {
  const P = f.unit({ x: o.x, y: o.y, z: Math.max(40, o.z) }); f.host.flare(P.x, P.y, P.z + 0.2, color, 8 * k, 4, 160);
  if (k > 1.2) spray(f, { x: o.x, y: o.y, z: Math.max(40, o.z) }, { n: Math.round(2 * k), speed: 0.6, up: 0.6, ms: 600, size: 14 });
};
/** Leaves thrown where a blow lands, a ring of its colour on the floor under it. */
const leafHit = (f: Fx3D, at: V3, color: number, n = 6): void => { spray(f, { x: at.x, y: at.y, z: (at.z ?? 0) + 55 }, { n, speed: 0.9, up: 0.9, ms: 800, size: 16 }); f.host.ring(f.host.w3(at.x), f.host.d3(at.y), color, 0.8, 240, 0.6); };

export const ARCHER: Record<string, Recipe> = {
  // DOUBLE SHOT — two real arrows, a thin leaf-green trail each; the charged third (her chain's end) a gold arrow, bigger,
  // leaves torn off the bow as it leaves, a gold streak along its line
  quick_shot: { tone: LEAF, own: true, trail: { c: LEAF, w: 5, len: 9, i: 1.3 },
    fired: (f, r, _i, o) => loose(f, o, r.stage === 1 ? GOLD : LEAF, r.stage === 1 ? 2 : 1),
    shot: (f, p) => { const charged = p.radius >= 14; arrow(f, p, charged ? GOLD : LEAF, { len: charged ? 108 : 74, glow: charged ? 1.5 : 1 }); if (charged) f.trail(p, GOLD, 10, 12, 2); }, // (the charged arrow: radius 14, the two quick ones 9)
    hit: (f, _s, h, at, main) => { if (main) leafHit(f, at, h.heavy ? GOLD : LEAF, h.heavy ? 10 : 4); },
  },
  // DOUBLE SHOT held (David 01:33: "a green circle turning, arrows out of it without a stop"): a wreath of leaves turns
  // upright before her bow while she holds; every arrow out of it a real one, every fifth a gold one with a gold trail
  quick_shot_stream: { tone: LEAF, own: true, trail: false,
    cast: (f, r) => { const id = r.attackerId, sd = side(r); wreath(f, () => { if (r.phase === 'done') return null; const c = f.host.casterPos(id); return c ? { x: c.x + sd * 58, y: c.y, z: c.z + 74 } : null; }, LEAF, { up: true, r: 46, n: 12, ms: 60000, rps: 1.4, size: 22 }); },
    fired: (f, _r, i, o) => loose(f, o, i % 5 === 4 ? GOLD : LEAF, i % 5 === 4 ? 1.6 : 0.8),
    shot: (f, p) => { const big = p.hitIndex % 5 === 4; arrow(f, p, big ? GOLD : LEAF, { len: big ? 90 : 66 }); f.trail(p, big ? GOLD : LEAF, big ? 9 : 5, big ? 12 : 9, big ? 2 : 1.4); },
    hit: (f, _s, _h, at, main) => { if (main) leafHit(f, at, LEAF, 3); },
  },
  // RISING ARROW — she looses an arrow into the floor before the foe; it drives in, and a twisting geyser of wind and
  // leaves bursts up out of the planks there and throws him high
  rising_arrow: { tone: WIND, own: true,
    cast: (f, r) => { const b = bow(f, r), sh = r.hits[0]?.shape as { bias?: number } | undefined, d = sh?.bias ?? 95, to = { x: r.origin.x + (r.aim.x || side(r)) * d, y: r.origin.y + r.aim.y * d * 0.6, z: 0 }; f.later(Math.max(0, T(r).startup - 130), () => { loose(f, b, LEAF, 1.2); arrowFall(f, bow(f, r), to, LEAF, { ms: 130, stick: 600, len: 84, arc: 18 }); }); },
    fired: (f, r, i) => {
      if (i !== 0) return;
      const sh = r.hits[0]?.shape as { bias?: number } | undefined, d = sh?.bias ?? 95, at = { x: r.origin.x + (r.aim.x || side(r)) * d, y: r.origin.y + r.aim.y * d * 0.6, z: 0 };
      let on = true; f.later(520, () => { on = false; });
      funnel(f, () => (on ? at : null), WIND, { ms: 520, h: 460, r0: 26, r1: 74, rps: 2.6, sway: 14, color2: LEAF, layers: 2, a: 0.85, dark: 0x2c6a26 });
      spray(f, { x: at.x, y: at.y, z: 10 }, { n: 16, speed: 0.5, up: 2.6, ms: 1000, size: 16 });
      f.host.ring(f.host.w3(at.x), f.host.d3(at.y), WIND, 1.3, 320, 0.7); f.host.dust(f.host.w3(at.x), f.host.d3(at.y), 6, 0.8);
    },
  },
  // WIND STEP (in the air) — a gust throws her back: a ribbon of wind along her leap; mid-leap she drives an arrow into the
  // floor before her: it bursts in leaves and wind and throws the foe there up
  bow_haste: { tone: WIND, own: true,
    active: (f, r) => { const a0 = me(f, r); f.later(T(r).active * 0.85, () => { const b = me(f, r); ribbon(f, (k) => ({ x: a0.x + (b.x - a0.x) * k, y: a0.y, z: a0.z + 70 + (b.z - a0.z) * k + Math.sin(Math.PI * k) * 40 }), WIND, { w: 18, ms: 420, draw: 80 }); }); },
    fired: (f, r) => { const sh = r.hits[0]?.shape as { bias?: number } | undefined, d = sh?.bias ?? 200, to = { x: r.origin.x + (r.aim.x || side(r)) * d, y: r.origin.y, z: 0 }; arrowFall(f, bow(f, r), to, LEAF, { ms: 110, stick: 500, len: 84 }); f.later(110, () => { spray(f, { x: to.x, y: to.y, z: 10 }, { n: 14, speed: 0.8, up: 2, ms: 900, size: 16 }); f.host.ring(f.host.w3(to.x), f.host.d3(to.y), LEAF, 1.5, 320, 0.7); }); },
  },
  // TRIPLE ARROW — five real arrows fanning out (green spirit arrows and iron ones between them)
  multi_shot: { tone: WIND, own: true, trail: { c: WIND, w: 5, len: 9, i: 1.4 },
    fired: (f, _r, _i, o) => loose(f, o, LEAF, 1.4),
    shot: (f, p) => arrow(f, p, p.hitIndex % 2 ? GOLD : LEAF, { len: 72 }),
    hit: (f, _s, _h, at, main) => { if (main) leafHit(f, at, LEAF, 4); },
  },
  // FIREBALL ARROW — a burning arrow (a real arrow wrapped in fire, a trail of flame and embers); a blast of fire where it
  // strikes: a shell of flame, the planks torn, embers raining
  explosive_arrow: { tone: FIRE, own: true, trail: { c: FIRE, w: 14, len: 14, i: 2.2 },
    shot: (f, p) => arrow(f, p, FIRE, { len: 86, glow: 1.6 }),
    hit: (f, _s, _h, at) => { // (its own blow: the room's shared one steps aside) the blast, and a column of fire bursting up under him that throws him
      f.impact({ x: at.x, y: at.y, z: Math.max(30, at.z ?? 0) }, FIRE, { r: 80, embers: 22, paint: true });
      let on = true; f.later(380, () => { on = false; });
      funnel(f, () => (on ? { x: at.x, y: at.y, z: 0 } : null), FIRE, { ms: 380, h: 340, r0: 34, r1: 96, rps: 2.2, sway: 10, color2: 0xffd27a, layers: 2, a: 0.85, dark: 0x5a1606 });
    },
  },
  // RETREAT KICK — a rising crescent of wind sweeps up with her boot (the painted boot turned toward the blow carries the
  // kick), leaves torn up off the floor into it; a ring where it strikes
  retreat_kick: { tone: WIND, own: true,
    active: (f, r) => { const c = me(f, r), sd = side(r); f.slash({ x: c.x + sd * 46, y: c.y, z: c.z }, sd, WIND, { r: 140, w: 34, tilt: 72, a0: 200, a1: 6, ms: 240, y0: 34, ink: 0x1f3a1c }); spray(f, { x: c.x + sd * 70, y: c.y, z: 20 }, { n: 10, speed: 0.6, up: 2.2, ms: 800, size: 15, dir: sd }); f.host.ring(f.host.w3(c.x + sd * 70), f.host.d3(c.y), WIND, 1.3, 280, 0.6); },
    hit: (f, _s, _h, at, main) => { if (main) leafHit(f, at, WIND, 6); },
  },
  // AIR VOLLEY (the signature) — she leaps: a ribbon of wind drawn behind her along the whole arc; five volleys of real
  // arrows loosed from the air, the fifth (the mark) a gold one
  skyhunters_step: { tone: WIND, own: true, trail: { c: WIND, w: 5, len: 9, i: 1.4 },
    cast: (f, r) => { const c = me(f, r); f.later(T(r).startup * 0.8, () => { f.host.ring(f.host.w3(c.x), f.host.d3(c.y), WIND, 1.5, 320, 0.6); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 8, 0.8); spray(f, { x: c.x, y: c.y, z: 6 }, { n: 10, speed: 0.7, up: 1.6, ms: 800, size: 15 }); }); },
    active: (f, r) => { const pts: V3[] = []; const n = Math.ceil(T(r).active / 50); for (let k = 0; k <= n; k++) f.later(k * 50, () => { if (r.phase === 'done') return; const c = me(f, r); pts.push({ x: c.x - side(r) * 20, y: c.y, z: c.z + 70 }); if (pts.length === 4 || k === n) { const seg = pts.splice(0, pts.length - 1); if (seg.length > 1) ribbon(f, (u) => { const q = u * (seg.length - 1), i = Math.min(seg.length - 2, Math.floor(q)), w = q - i; return { x: seg[i].x + (seg[i + 1].x - seg[i].x) * w, y: seg[i].y, z: seg[i].z + (seg[i + 1].z - seg[i].z) * w }; }, WIND, { w: 14, ms: 520, draw: 40 }); } }); },
    fired: (f, r, i, o) => loose(f, o, i === r.hits.length - 1 ? GOLD : WIND, i === r.hits.length - 1 ? 1.8 : 1),
    shot: (f, p) => arrow(f, p, p.hitIndex === p.skill.hits.length - 1 ? GOLD : LEAF, { len: 70 }),
  },
  // SKY RAIN (the ultimate; David 01:33: "the big green circle and what lies on the floor don't feel professional" — no
  // circle on the floor, nothing left lying) — her portrait races across; she looses a volley up into the sky (her arrows
  // climbing out of the frame); then the sky pours real arrows at a slant over the whole field, each sticking a moment in
  // the planks and sinking away (quiet: dust only — dozens of their lights summed whited the floor); on every wave a few
  // strike the foe himself; the last wave one great gold arrow out of the sky onto the main foe through a beam
  sky_rain: { tone: GOLD, own: true,
    cast: (f, r) => { f.later(T(r).startup * 0.45, () => { const b = bow(f, r), sd = side(r); loose(f, b, GOLD, 2); for (let k = 0; k < 7; k++) f.later(k * 35, () => f.streak({ x: b.x, y: b.y, z: b.z }, { x: b.x + sd * (140 + k * 34), y: b.y + rnd(-30, 30), z: 1300 }, k % 3 ? LEAF : GOLD, { w: 6, ms: 280, draw: 120 })); }); },
    active: (f, r) => {
      const p = { ...me(f, r) }, ms = Math.max(1500, T(r).active), sd = side(r), cx = p.x + sd * 260;
      for (let t = 0; t < ms - 150; t += 40) f.later(t, () => { for (let k = 0; k < 2; k++) { const x = cx + rnd(-420, 420), y = p.y + rnd(-90, 90); arrowFall(f, { x: x - 240 * sd, y, z: 900 }, { x, y, z: 0 }, Math.random() < 0.2 ? GOLD : LEAF, { ms: 210, stick: 420, len: 88, trail: 4, quiet: true, delay: k * 20 }); } });
    },
    hit: (f, _s, h, at, main) => {
      if (main && h.heavy) { arrowFall(f, { x: at.x - 140, y: at.y, z: 1000 }, { x: at.x, y: at.y, z: 0 }, GOLD, { ms: 200, stick: 900, len: 260, trail: 22 }); f.later(200, () => { f.skyBeam(at, GOLD, { w: 16, ms: 420 }); spray(f, { x: at.x, y: at.y, z: 20 }, { n: 24, speed: 1.4, up: 1.8, ms: 1100, size: 18 }); f.host.kick(0.06); }); return; }
      for (let k = 0; k < 2; k++) { const x = at.x + rnd(-26, 26), y = at.y + rnd(-12, 12); arrowFall(f, { x: x - 150, y, z: 560 }, { x, y, z: 0 }, k ? LEAF : GOLD, { ms: 90, stick: 380, len: 96, trail: 6, delay: k * 40 }); }
      spray(f, { x: at.x, y: at.y, z: (at.z ?? 0) + 50 }, { n: 4, speed: 0.8, up: 0.8, ms: 700, size: 15 });
    },
  },
  // VINE MINE — a seed sown in the floor (a wreath of leaves turning flat there while it waits); whoever steps on it:
  // thorned vines burst up out of the planks and coil round him (held); 2 s later the mine explodes in a geyser of
  // leaves and throws them all high
  vine_trap: { tone: FOREST, own: true,
    hit: (f, s, h, at) => { // (the hold is no 'main' blow — it throws no one — but it is half the skill)
      if (hitIndex(s, h) === 0) { // held: six vines coiling up round him
        for (let k = 0; k < 6; k++) { const a0 = (k / 6) * Math.PI * 2, z1 = 90 + (k % 3) * 25; vine(f, (u) => { const a = a0 + u * Math.PI * 1.4, rr = 46 * (1 - u * 0.45); return { x: at.x + Math.cos(a) * rr, y: at.y + Math.sin(a) * rr * 0.6, z: u * z1 }; }, FOREST, { ms: 2000, grow: 260, w: 14 }); }
        spray(f, { x: at.x, y: at.y, z: 8 }, { n: 10, speed: 0.6, up: 1.2, ms: 900, size: 15 });
      } else { // the blast
        let on = true; f.later(600, () => { on = false; });
        funnel(f, () => (on ? { x: at.x, y: at.y, z: 0 } : null), LEAF, { ms: 600, h: 520, r0: 40, r1: 110, rps: 2.4, sway: 18, color2: GOLD, layers: 2, dark: 0x2c6a26 });
        spray(f, { x: at.x, y: at.y, z: 10 }, { n: 34, speed: 1.3, up: 2.8, ms: 1300, size: 18 });
        f.crack(at.x, at.y, FOREST, { r: 120, chunks: 12 }); f.host.kick(0.04);
      }
    },
  },
  // THUNDER RAIN (David 01:33: "terrible! a significant 3D improvement — change it however you think right") — she leaps
  // and hangs charging: lightning runs into her bow from all round, faster and faster, while three real arrows of
  // lightning appear one after another in a fan over her shoulder, crackling, each bigger than the last; at each beat one
  // is loosed: a jagged bolt (keeping its blue) strikes from it to its point on the floor and the arrow rides it down and
  // sticks there, a shell of storm light and the planks torn; the third the greatest, two bolts out of the sky beside it.
  // The floor it struck stays charged (whoever lands there is thrown back up): blue arcs crawl over the planks there until
  // it runs out — no glyph (an added glyph and its flare whited the planks)
  rain_of_arrows: { tone: STORM, own: true,
    cast: (f, r) => {
      const st = T(r).startup, t1 = st + (r.hits[0]?.at ?? 600), sd = side(r), id = r.attackerId;
      for (let k = 0; k < 12; k++) { const t0 = t1 * (1 - Math.pow(1 - k / 12, 1.5)); f.later(t0, () => { const b = bow(f, r), an = Math.random() * Math.PI * 2, rr = 40 + Math.random() * 46; f.bolt({ x: b.x + Math.cos(an) * rr, y: b.y, z: b.z + 20 + Math.sin(an) * rr }, { x: b.x, y: b.y, z: b.z + 20 }, STORM, { ms: 110, w: 3 + k * 0.4, forks: 1, front: true, hue: true }); }); }
      const held = r.hits.map((h, i) => {
        const b = (h.shape as { bias?: number }).bias ?? 200, to = { x: r.origin.x + (r.aim.x || sd) * b, y: r.origin.y + r.aim.y * b, z: 0 };
        const spot = (): V3 | null => { const c = f.host.casterPos(id); return c ? { x: c.x - sd * (18 + i * 16), y: c.y, z: c.z + 150 + i * 26 } : null; };
        const A = hover(f, spot, to, STORM, { len: [100, 116, 146][i] ?? 110, grow: 180, delay: st * 0.4 + i * 130 });
        for (let k = 0; k < 6; k++) f.later(st * 0.4 + i * 130 + 120 + k * 70, () => { const p = A.pos(); if (p && r.phase !== 'done') f.bolt({ x: p.x + rnd(-40, 40), y: p.y, z: p.z + rnd(-30, 30) }, { x: p.x + rnd(-30, 30), y: p.y, z: p.z + rnd(-24, 24) }, STORM, { ms: 90, w: 3, forks: 0, front: true }); });
        return A;
      });
      HELD.set(r.castId, held); f.later(st + T(r).active + 400, () => { for (const A of HELD.get(r.castId) ?? []) A.drop(); HELD.delete(r.castId); });
    },
    active: (f, r) => { // the charged floor: arcs crawling over the planks for its life
      const L = r.skill.linger; if (!L) return; const p = placeOf(f, r, L.offset ?? 300), R = L.radius ?? 210, life = L.everyMs * L.count;
      for (let t = 0; t < life; t += 110) f.later(Math.max(0, L.startMs - T(r).startup) + t, () => {
        for (let k = 0; k < 2; k++) { const an = Math.random() * Math.PI * 2, rr = R * Math.sqrt(Math.random()) * 0.9, x0 = p.x + Math.cos(an) * rr, y0 = p.y + Math.sin(an) * rr * 0.5, a2 = Math.random() * Math.PI * 2, d = rnd(50, 130);
          f.bolt({ x: x0, y: y0, z: 4 }, { x: x0 + Math.cos(a2) * d, y: y0 + Math.sin(a2) * d * 0.4, z: 4 }, STORM, { ms: 160, w: 4, forks: 1, hue: true }); }
      });
    },
    fired: (f, r, i) => {
      const sh = r.hits[i]?.shape as { bias?: number } | undefined, b = sh?.bias ?? 200, big = i === r.hits.length - 1, A = HELD.get(r.castId)?.[i];
      const at = { x: r.origin.x + (r.aim.x || side(r)) * b, y: r.origin.y + r.aim.y * b, z: 0 }, from = A?.pos() ?? bow(f, r);
      f.bolt(from, { x: at.x, y: at.y, z: 6 }, STORM, { ms: big ? 340 : 230, w: big ? 11 : 7, forks: big ? 3 : 2, front: true, hue: true });
      if (A) A.loose(at, { ms: 70, stick: big ? 1100 : 700, trail: big ? 14 : 8 }); else arrowFall(f, from, at, STORM, { ms: 70, stick: big ? 1100 : 700, len: big ? 146 : 104, trail: big ? 14 : 8 });
      f.later(70, () => { f.dome(at.x, at.y, STORM, { r: big ? 120 : 76, ms: 260, a: 0.5, paint: true }); f.crack(at.x, at.y, STORM, { r: big ? 120 : 76, chunks: big ? 10 : 4, ms: 1000, quiet: true }); f.host.ring(f.host.w3(at.x), f.host.d3(at.y), STORM, big ? 2.4 : 1.5, big ? 420 : 300, 0.7); if (big) f.host.kick(0.05); });
      if (big) for (const dx of [-120, 120]) f.later(90, () => f.bolt({ x: at.x + dx * 0.6, y: at.y, z: 950 }, { x: at.x + dx, y: at.y, z: 6 }, STORM, { ms: 280, w: 9, forks: 2, hue: true }));
    },
  },
  // SPIRIT BOW (the finisher) — a great bow of spirit light stands before her and is drawn, its string pulled back for the
  // whole wind-up; one great arrow of spirit light tears down the line (a wide trail, a ring thrown off its head at the
  // release); the foe thrown down tears the floor
  piercing_arrow: { tone: SPIRIT, own: true, trail: { c: SPIRIT, w: 20, len: 18, i: 2.4 },
    cast: (f, r) => {
      const t0 = T(r).startup, sd = side(r), id = r.attackerId, H = 120; // (the bow: two limbs of light, its string drawn back over the wind-up)
      const at = () => { const c = f.host.casterPos(id); return c ? { x: c.x + sd * 58, y: c.y, z: c.z + 78 } : null; };
      const c0 = at(); if (!c0) return;
      ribbon(f, (k) => { const a = (k - 0.5) * Math.PI * 0.9, c = at() ?? c0; return { x: c.x + sd * Math.cos(a) * 26, y: c.y, z: c.z + Math.sin(a) * H * 0.62 }; }, SPIRIT, { w: 10, ms: t0 + 160, draw: 120, keep: true });
      ribbon(f, (k) => { const c = at() ?? c0, pull = Math.min(1, k < 0.5 ? k * 2 : (1 - k) * 2); return { x: c.x + sd * (Math.cos(Math.PI * 0.45) * 26 - pull * 40), y: c.y, z: c.z + (k - 0.5) * 2 * H * 0.62 * Math.sin(Math.PI * 0.45) }; }, GOLD, { w: 3, ms: t0 + 60, draw: t0 * 0.8, keep: true });
      wreath(f, () => (r.phase === 'done' || r.phase === 'recovery' ? null : at()), SPIRIT, { up: true, r: 30, n: 8, ms: t0 + 200, rps: 2.2, size: 16 });
    },
    active: (f, r) => { const c = me(f, r); f.host.ring(f.host.w3(c.x + side(r) * 60), f.host.d3(c.y), SPIRIT, 1.6, 300, 0.7); f.host.kick(0.03); },
    shot: (f, p) => arrow(f, p, SPIRIT, { len: 170, glow: 2 }),
    hit: (f, _s, _h, at, main) => { if (main) { f.crack(at.x, at.y, SPIRIT, { r: 110, chunks: 10 }); spray(f, { x: at.x, y: at.y, z: 40 }, { n: 16, speed: 1.4, up: 1.2, ms: 1000, size: 17 }); } },
  },
  // HUNTER'S ROAR — the wolf spirit's roar (painted) blows out round her: rings of wind, the air bent, a gale of leaves
  // thrown out over the floor
  hunters_roar: { tone: SPIRIT, own: true,
    active: (f, r) => { const c = me(f, r); for (const d of [1, -1]) surge(f, c.x + d * 30, c.y, d, 0, SPIRIT, { len: 300, ms: 420, h: 120, w: 150 }); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), SPIRIT, 2.6, 420, 0.4); f.host.dust(f.host.w3(c.x), f.host.d3(c.y), 8, 1); f.host.impact({ x: c.x, y: c.y, z: 100 }, 1); spray(f, { x: c.x, y: c.y, z: 30 }, { n: 34, speed: 2.4, up: 0.6, ms: 1100, size: 17 }); }, // (the roar rolls out both ways along the floor: two painted crests of spirit wind)
  },
  // BINDING LEAVES — a band of leaves and thorned vines sweeps across the floor; every foe on it is bound: vines coil up
  // round him; the leaves lie on the floor a while (whoever falls onto them is caught)
  leaping_arrow: { tone: FOREST, own: true,
    active: (f, r) => {
      const c = me(f, r), ax = r.aim.x || side(r), ay = r.aim.y;
      for (let k = 0; k < 9; k++) f.later(k * 30, () => { const d = 60 + k * 62; spray(f, { x: c.x + ax * d, y: c.y + ay * d * 0.6 + rnd(-90, 90), z: 4 }, { n: 5, speed: 0.4, up: 0.5, ms: 3200, size: 17, spread: 0.6 }); });
      for (const dy of [-80, 0, 80]) vine(f, (u) => ({ x: c.x + ax * (40 + u * 560), y: c.y + dy + Math.sin(u * 9 + dy) * 18, z: 4 + Math.abs(Math.sin(u * 14)) * 10 }), FOREST, { ms: 3000, grow: 300, w: 16, link: 40 });
    },
    hit: (f, _s, h, at) => { if (!h.reaction.hardCC) return; for (let k = 0; k < 4; k++) { const a0 = (k / 4) * Math.PI * 2; vine(f, (u) => { const a = a0 + u * Math.PI * 1.3, rr = 40 * (1 - u * 0.4); return { x: at.x + Math.cos(a) * rr, y: at.y + Math.sin(a) * rr * 0.6, z: u * 100 }; }, FOREST, { ms: 1600, grow: 220, w: 13 }); } },
  },
  // SPIRIT HAWK — the painted hawk; the room adds its dive: a thin line out of the sky onto the foe, the floor torn, feathers
  spirit_hawk: { tone: SPIRIT, own: true,
    hit: (f, _s, _h, at, main, react) => { if (!(main || react === 'slam')) return; f.streak({ x: at.x - 60, y: at.y, z: 560 }, { x: at.x, y: at.y, z: 70 }, SPIRIT, { w: 9, ms: 200, draw: 70, front: true }); f.later(80, () => { f.crack(at.x, at.y, SPIRIT, { r: 100, chunks: 8 }); f.dome(at.x, at.y, SPIRIT, { r: 60, ms: 200, a: 0.45, paint: true }); spray(f, { x: at.x, y: at.y, z: 60 }, { n: 8, speed: 1, up: 1, ms: 900, size: 15 }); f.host.kick(0.03); }); },
  },
  // TREE OF LIFE — a tree of light grows out of the planks where she stood (just behind her, where the game's tree heals —
  // its apples fall from its crown): roots of light run out over the floor, a dark trunk rises twisting, gold veins of
  // life running up its bark, six branches spread and a crown of her leaves opens over them and sways for its 20 s, gold
  // motes rising round it; at its end the leaves fall and it sinks back into the floor. A real tree in the room (the
  // painted one stood in front of the fight and hid it)
  tree_of_life: { tone: SPIRIT, own: true,
    cast: (f, r) => {
      const c = { ...me(f, r) }, x = c.x, y = c.y - 46, life = 20000, t0 = T(r).startup * 0.3;
      f.later(t0, () => {
        lifeTree(f, x, y, { ms: life + T(r).startup - t0, h: 260, grow: 900 });
        for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + rnd(-0.2, 0.2), L = rnd(110, 170); vine(f, (u) => ({ x: x + Math.cos(a) * L * u, y: y + Math.sin(a) * L * u * 0.6, z: 2 }), LEAF, { ms: life, grow: 600, w: 12, link: 30, i: 1.1, back: true }); }
        spray(f, { x, y, z: 6 }, { n: 12, speed: 0.6, up: 1.4, ms: 900, size: 16 });
        f.host.ring(f.host.w3(x), f.host.d3(y), LEAF, 1.6, 420, 0.45);
      });
      f.later(T(r).startup + 400, () => f.swirl(() => ({ x, y, z: 0 }), {}, { n: 18, r0: 70, r1: 50, h: 380, ms: life - 400, rps: 0.1, rise: 0.25, size: 0.45, color: GOLD }));
    },
  },
  // VINE LASH — a thorned vine arrow: the vine pays out behind the arrow from her bow; it snags the foe (even in the air) —
  // leaves burst off it — and the vine, taut from her bow to him, hauls him back in front of her, then snaps loose
  hunters_spirit: { tone: FOREST, own: true, trail: false,
    shot: (f, p) => {
      LASH = { id: p.attackerId, t: f.now };
      arrow(f, p, FOREST, { len: 80 }); const c = f.host.casterPos(p.attackerId); if (!c) return; const b0 = { x: c.x, y: c.y, z: c.z + 74 };
      vine(f, (u) => (p.done ? b0 : { x: b0.x + (p.x - b0.x) * u, y: b0.y + (p.y - b0.y) * u, z: b0.z + (p.z + 62 - b0.z) * u }), FOREST, { ms: 520, grow: 40, w: 13 });
    },
    hit: (f, _s, _h, at) => {
      spray(f, { x: at.x, y: at.y, z: (at.z ?? 0) + 60 }, { n: 8, speed: 0.8, up: 0.8, ms: 800, size: 15 }); f.later(30, () => f.host.ring(f.host.w3(at.x), f.host.d3(at.y), FOREST, 1.0, 260, 0.6));
      const L = LASH && f.now - LASH.t < 1500 ? LASH : null; if (!L) return;
      const t0 = f.now, z0 = (at.z ?? 0) + 40; // (the haul: the vine taut from her bow to him as he comes — ~240 ms — then it snaps)
      vine(f, (u) => {
        const c = f.host.casterPos(L.id); if (!c) return { x: at.x, y: at.y, z: z0 };
        const sd = Math.sign(at.x - c.x) || 1, k = 1 - Math.pow(1 - Math.min(1, (f.now - t0) / 240), 3), ex = at.x + (c.x + sd * 60 - at.x) * k, ey = at.y + (c.y - at.y) * k, b = { x: c.x + sd * 30, y: c.y, z: c.z + 74 };
        return { x: b.x + (ex - b.x) * u, y: b.y + (ey - b.y) * u, z: b.z + (z0 - b.z) * u };
      }, FOREST, { ms: 440, grow: 10, w: 15 });
      f.later(440, () => { const c = f.host.casterPos(L.id); if (c) spray(f, { x: c.x + (Math.sign(at.x - c.x) || 1) * 50, y: c.y, z: c.z + 70 }, { n: 7, speed: 0.7, up: 0.7, ms: 700, size: 14 }); });
    },
  },
  // EAGLE TIDE — the great spirit eagle (painted) sweeps half the field; the room adds the gale it rides: a great crest of
  // spirit wind the length of the field, a streak over it, feathers and leaves torn along its path
  eagle_arrow: { tone: SPIRIT, own: true,
    active: (f, r) => { const c = me(f, r), ax = r.aim.x || side(r); f.wave(c.x, c.y, ax, r.aim.y, SPIRIT, { len: 760, ms: 360, h: 150, w: 150 }); f.streak({ x: c.x, y: c.y, z: 90 }, { x: c.x + ax * 780, y: c.y + r.aim.y * 400, z: 90 }, SPIRIT, { w: 26, ms: 420, draw: 90 }); for (let k = 0; k < 8; k++) f.later(k * 40, () => spray(f, { x: c.x + ax * (80 + k * 90), y: c.y + rnd(-60, 60), z: 60 }, { n: 5, speed: 1.2, up: 0.8, ms: 900, size: 16, dir: ax })); },
  },
  // HUNTER'S RAIN — a wreath of gold leaves turns flat on the mark; every volley real arrows fall out of the sky onto it and
  // stick in the planks; every fifth (the beat) one great gold arrow, the last the greatest
  arrow_storm: { tone: GOLD, own: true,
    active: (f, r) => { const p0 = placeOf(f, r, 260); wreath(f, () => (r.phase === 'done' || r.phase === 'recovery' ? null : (r.place ? { x: r.place.x, y: r.place.y, z: 0 } : p0)), GOLD, { r: 110, n: 16, ms: Math.max(1500, T(r).active), rps: 0.25, size: 24 }); }, // (it follows the mark she steers)
    fired: (f, r, i, o) => {
      const last = i === r.hits.length - 1, big = i % 5 === 4 || last;
      if (big) { arrowFall(f, { x: o.x - 120, y: o.y, z: 1000 }, { x: o.x, y: o.y, z: 0 }, GOLD, { ms: 200, stick: last ? 1400 : 900, len: last ? 220 : 160, trail: last ? 18 : 12 }); f.later(200, () => { f.impact({ x: o.x, y: o.y, z: 20 }, GOLD, { r: last ? 80 : 55, embers: last ? 16 : 8 }); spray(f, { x: o.x, y: o.y, z: 20 }, { n: last ? 22 : 12, speed: 1.2, up: 1.6, ms: 1000, size: 17 }); }); }
      else for (let k = 0; k < 3; k++) { const x = o.x + rnd(-80, 80), y = o.y + rnd(-30, 30); arrowFall(f, { x: x - 110, y, z: 950 }, { x, y, z: 0 }, LEAF, { ms: 210, stick: 520, len: 84, delay: k * 50, trail: 4, quiet: k > 0 }); } // (one lit a volley: 75 lights summed whited the mark)
    },
  },
  // LEAF DECOY (Backstep Shot) — she flips back out of reach; the decoy of leaves she leaves is painted, the room adds the
  // leaves torn off her as she goes; at the flip's top one heavy spirit arrow
  backstep_shot: { tone: SPIRIT, own: true, trail: { c: SPIRIT, w: 12, len: 14, i: 2 },
    cast: (f, r) => { const c = me(f, r); spray(f, { x: c.x, y: c.y, z: 60 }, { n: 16, speed: 0.6, up: 1, ms: 1100, size: 16 }); f.host.ring(f.host.w3(c.x), f.host.d3(c.y), FOREST, 1.2, 320, 0.5); },
    fired: (f, _r, _i, o) => loose(f, o, SPIRIT, 1.8),
    shot: (f, p) => arrow(f, p, SPIRIT, { len: 96, glow: 1.4 }),
  },
};
for (const rc of Object.values(ARCHER)) rc.paint = true; // (her blows land in her colours: the shell of the room's impact painted)
