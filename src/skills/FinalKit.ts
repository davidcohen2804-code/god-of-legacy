// Final 4-class kits (03_FINAL_CLASS_SKILL_ROSTER.md): exact ids, slots, timings, damage, cooldowns, air/ground use.
// Shape sub-parameters the roster leaves open (ranges / radii / angles) are fixed here once and reused by the telegraph,
// the hit resolver and the VFX placement, so telegraph == hitbox by construction.
import { FinalSkill, HitEvent, HitShape, PACE, PVP_MULT, Reaction } from './SkillTypes';
import { jobOfSlot } from './Jobs';
import { STYLES, SWITCH, baseStyle, switchId } from './Styles';

const H = (at: number, damage: number, shape: HitShape, reaction: Reaction, extra: Partial<HitEvent> = {}): HitEvent => ({ at, damage, shape, reaction, ...extra });
const LOCK = { startup: 0, active: 0, recovery: 0 };
/** Iai Strike's draws (DFO 23 Oct): `n` crescents of blade light flying down the line 70 ms apart at 1.5 px / ms (`len` long,
 *  `w` wide), each a hit as it passes (a flinch holding the foe in the line), the last the level's blow (`last`, heavy). */
const IAI = (n: number, dmg: number[], len: number, w: number, last: Reaction, up: number): HitEvent[] => Array.from({ length: n }, (_, k) =>
  H(k * 70, dmg[k], { kind: 'projectile', speed: 1500, range: len, radius: w / 2, pierce: true, antiAir: true }, k === n - 1 ? last : { stun: 260, push: 2 }, k === n - 1 ? { reachUp: up, heavy: true } : { reachUp: up }));
const base = { pvpMultiplier: PVP_MULT, pveMultiplier: 1, cancelOnHit: [] as string[], tags: [] as string[] };
const CORE = (ids: string[]) => ids;

/** Unlock levels (11_SKILL_BOOK_PROGRESSION_SPEC.md). */
export const UNLOCK = [1, 2, 4, 6, 9, 12, 16, 20, 3, 5, 8, 10, 14, 18];

function S(s: Omit<FinalSkill, 'pvpMultiplier' | 'pveMultiplier' | 'unlockLevel' | 'tags' | 'cancelOnHit'> & { tags?: string[]; cancelOnHit?: string[] }): FinalSkill {
  return { ...base, ...s, tags: s.tags ?? [], cancelOnHit: s.cancelOnHit ?? [], unlockLevel: jobOfSlot(s.cls, s.slot).level }; // unlocks with the job advancement
}

// ------------------------------------------------------------------ WARRIOR
const warrior: FinalSkill[] = [
  S({
    id: 'warrior_basic', cls: 'warrior', slot: 0, name: 'Iron Chain', roles: ['basic', 'confirm'], targeting: 'aimAssist',
    startup: 200, active: 250, recovery: 200, cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 12, { kind: 'sector', range: 78, angle: 110 }, { stun: 160, push: 4 }, { reachUp: 70 })],
    // MapleStory pace: each swing shows its wind-up, strike and follow-through before the next (~0.43 s a swing when held);
    // the stuns still last until the next swing lands, so the chain keeps the foe held
    chain: {
      resetMs: 700,
      stages: [
        [H(0, 7, { kind: 'sector', range: 84, angle: 120 }, { stun: 480, push: 3 }, { reachUp: 110 })],
        [H(0, 7, { kind: 'sector', range: 86, angle: 120 }, { stun: 470, push: 3 }, { reachUp: 110 })],
        [H(0, 5, { kind: 'sector', range: 88, angle: 130 }, { stun: 470, push: 2 }, { reachUp: 110 }),
          H(170, 6, { kind: 'sector', range: 88, angle: 130 }, { stun: 480, push: 3 }, { reachUp: 110 })],
        [H(0, 10, { kind: 'sector', range: 92, angle: 130 }, { stun: 560, push: 10 }, { reachUp: 110, heavy: true })],
      ],
      timings: [{ startup: 200, active: 250, recovery: 200 }, { startup: 200, active: 250, recovery: 200 }, { startup: 210, active: 380, recovery: 220 }, { startup: 260, active: 260, recovery: 380 }],
    },
    cancelOnHit: ['dash_slash', 'rising_slash', 'ground_breaker', 'whirlwind', 'sanctuary'],
    description: 'Four-strike chain: tap or hold Space. Slash, slash, double cut, then a heavy finishing slash with a long stun — the opening for your skills.',
    relations: ['Hold Space to auto-chain', 'Cancel into any skill on hit'],
  }),
  S({
    id: 'dash_slash', cls: 'warrior', slot: 1, name: 'Dash Slash', roles: ['gapClose', 'opener'], targeting: 'mouseDir',
    startup: 110, active: 150, recovery: 230, cooldown: 1800, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 210 }, through: true, carry: true, // (David 01:07: "if it drags, let it drag" — he rides the dash to its end, in front of the blade)
    hits: [0, 50, 100].map((t, i) => H(t, i === 2 ? 10 : 7, { kind: 'capsule', radius: 32 }, { stun: i === 2 ? 360 : 240, push: i === 2 ? 10 : 2, float: true, juggleCost: 4 }, { reachUp: 90 })), // (the last cut holds 360: Rising Slash, its one link, has 0.2 s to come)
    cancelOnHit: CORE(['rising_slash', 'whirlwind', 'sanctuary', 'warrior_basic', 'blade_storm', 'titans_verdict']),
    telegraph: 'line',
    description: 'Charge up to 210px in the facing direction, slashing through the foe; stops on cover. A confirmed hit can cancel into Rising Slash, Leap Crash or any other skill.',
    relations: ['Opener', 'Cancel → any skill on hit'],
  }),
  S({
    id: 'rising_slash', cls: 'warrior', slot: 2, name: 'Rising Slash', roles: ['launcher', 'antiAir'], targeting: 'mouseCone',
    startup: 140, active: 170, recovery: 270, cooldown: 2200, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 16, { kind: 'sector', range: 96, angle: 100 }, { stun: 420, launch: 150, juggleCost: 30 }, { reachUp: 90 }),
      H(70, 6, { kind: 'sector', range: 100, angle: 110 }, { stun: 300, float: true, juggleCost: 3 }, { reachUp: 190 }),
      H(140, 6, { kind: 'sector', range: 100, angle: 110 }, { stun: 300, float: true, juggleCost: 3 }, { reachUp: 220 })],
    cancelOnHit: ['whirlwind', 'warrior_basic', 'blade_storm', 'ground_breaker'],
    description: 'Upward cut that launches the target ~150px into the air (slightly less when used airborne).',
    relations: ['Launcher', 'Jump chase → Whirlwind'],
  }),
  S({
    id: 'ground_breaker', cls: 'warrior', slot: 3, name: 'Ground Breaker', roles: ['knockdown', 'antiAir'], targeting: 'self',
    startup: 300, active: 260, recovery: 300, cooldown: 3000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 26, { kind: 'circle', radius: 118 }, { stun: 320, push: 4 }, { reachUp: 130, heavy: true }),
      H(200, 14, { kind: 'circle', radius: 140 }, { stun: 300, launch: 110, juggleCost: 10 }, { reachUp: 120 })],
    linger: { at: 'caster', startMs: 300, everyMs: 300, count: 10, radius: 150, maxZ: 130, hit: H(0, 0, { kind: 'circle', radius: 150 }, { stun: 380, pull: 40, float: true }, { reachUp: 130 }) }, // (the quake holds, it does not hurt: its ticks used to fill a fallen foe's floor gauge and stand him up mid-combo)
    cancelOnHit: ['titans_verdict'], telegraph: 'circle',
    description: 'Smash the earth and blast foes up into the air: a living quake follows you for 3s, dragging in and holding any foe it touches while you keep fighting.',
    relations: ['Finisher', 'Anti-air slam'],
  }),
  S({
    id: 'whirlwind', cls: 'warrior', slot: 4, name: 'Whirlwind', roles: ['extender', 'airExtender'], targeting: 'self',
    startup: 130, active: 1570, recovery: 190, cooldown: 7000, ground: true, air: true, cover: 'IGNORES_COVER', move: { startup: 0, active: 0.85, recovery: 0 },
    zoneMs: 2200,
    dash: { distance: 140 }, // (it drives forward: the spin carries the foe back toward the wall, never past him)
    hits: Array.from({ length: 6 }, (_, i) => i * 260).map((t, i) => i < 5 ? H(t, 6, { kind: 'circle', radius: 118 }, { stun: 300, push: 24 }, { reachUp: 150 })
      : H(t, 8, { kind: 'circle', radius: 125 }, { stun: 520, push: 50 }, { reachUp: 160, heavy: true })), // fewer, heavier turns; the last one throws him back
    cancelOnHit: ['ground_breaker', 'warrior_basic', 'blade_storm', 'titans_verdict'],
    description: 'A driving blade cyclone: you spin forward, each heavy turn shoving foes back before you, the last one throwing them toward the wall.',
    relations: ['Air extender', 'Finish with Ground Breaker'],
  }),
  S({
    id: 'sanctuary', cls: 'warrior', slot: 5, name: 'Sanctuary', roles: ['setup', 'zone'], targeting: 'self',
    startup: 350, active: 200, recovery: 260, cooldown: 30000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 350],
    hits: [H(0, 6, { kind: 'circle', radius: 120 }, { stun: 300, push: 10 }, { reachUp: 120 })],
    cancelOnHit: ['warrior_basic', 'rising_slash', 'dash_slash', 'blade_storm', 'thunder_circle', 'sky_breaker', 'ground_breaker'], tags: ['buff'],
    description: 'Trace a half-circle on the ground with your sword: a wall of light rises in front of you for 4s. You and your party behind it take half damage from every hit; the wall stays where it was cast.',
    relations: ['Wall 4s', 'Half damage behind it — party too'],
  }),
  S({
    id: 'blade_storm', cls: 'warrior', slot: 6, name: 'Blade Storm', roles: ['signature', 'extender'], targeting: 'self',
    startup: 300, active: 2600, recovery: 260, cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    armor: [0, 2900],
    hits: [H(0, 8, { kind: 'circle', radius: 170 }, { stun: 300, pull: 14, launch: 110, juggleCost: 4 }, { reachUp: 200 })],
    linger: { at: 'caster', startMs: 400, everyMs: 200, count: 13, radius: 180, maxZ: 300, hit: H(0, 3, { kind: 'circle', radius: 180 }, { stun: 300, pull: 16, float: true }, { reachUp: 300 }) },
    cancelOnHit: ['titans_verdict'], tags: ['signature'],
    description: 'Raise your sword to the sky and hold it there: lightning crackles around you and a storm of light swords erupts from the ground all around you, launching foes and keeping them in the air.',
    relations: ['Signature', 'Air hold', 'Cancel → Titan’s Verdict'],
  }),
  S({
    id: 'titans_verdict', cls: 'warrior', slot: 7, name: "Titan's Verdict", roles: ['ultimate', 'finisher'], targeting: 'mouseCone',
    startup: 770, active: 640, recovery: 600, cooldown: 30000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 2750],
    hits: [H(0, 14, { kind: 'circle', radius: 190, at: 'aimBias', bias: 110 }, { stun: 600, launch: 150, juggleCost: 0 }, { reachUp: 260, heavy: true }),
      ...[90, 160, 230, 300, 370, 440, 510].map((t) => H(t, 6, { kind: 'circle', radius: 200, at: 'aimBias', bias: 110 }, { stun: 420, float: true }, { reachUp: 320 })),
      H(580, 10, { kind: 'circle', radius: 200, at: 'aimBias', bias: 110 }, { stun: 420, knockdown: 'heavy' }, { reachUp: 320, heavy: true })], // the last blow floors him: the Verdict ends the combo (endsCombo)
    // the struck floor stays electrified for ~3.2s: a wide field across the floor's depth that keeps shocking anyone on it
    linger: { at: 'aim', offset: 110, startMs: 760, everyMs: 350, count: 9, radius: 200, maxZ: 60, hit: H(0, 3, { kind: 'circle', radius: 200 }, { stun: 260 }, { reachUp: 60 }) },
    endsCombo: true, tags: ['ultimate'], telegraph: 'cone',
    description: 'Raise your sword with a battle roar: a colossal titan of light rises behind you and drives its giant sword into the floor, and a golden shockwave tears across the arena. The struck floor stays electrified for 3s, shocking anyone who stands on it. Heavy knockdown; ends the combo.',
    relations: ['Ultimate', 'Ends combo', 'Electrified floor 3s'],
  }),
  // ---- extended kit (Q R F G C V)
  S({
    id: 'leap_crash', cls: 'warrior', slot: 8, name: 'Leap Crash', roles: ['gapClose', 'knockdown'], targeting: 'mouseTarget',
    startup: 160, active: 320, recovery: 380, cooldown: 2500, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 210, lift: 80, crash: true },
    hits: [H(140, 10, { kind: 'circle', radius: 90 }, { stun: 300, slam: true }, { reachUp: 160 }),
      H(285, 20, { kind: 'circle', radius: 125 }, { stun: 300, knockdown: 'light' }, { reachUp: 60, heavy: true })], // (the crash floors him: Sky Breaker is the air chase)
    cancelOnHit: ['whirlwind', 'warrior_basic', 'rising_slash', 'blade_storm', 'lance_thrust', 'radiant_blade'], telegraph: 'circle',
    description: 'Leap up to 210px onto the target and crash down: airborne targets are slammed into a bounce, grounded targets are knocked flat.',
    relations: ['Gap close', 'Knockdown'],
  }),
  S({
    id: 'wave_slash', cls: 'warrior', slot: 9, name: 'Wave Slash', roles: ['projectile', 'precision'], targeting: 'mouseProjectile',
    startup: 300, active: 0, recovery: 220, cooldown: 2500, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 18, { kind: 'projectile', speed: 420, range: 520, radius: 22, pierce: true, count: 3, spread: 12 }, { stun: 340, launch: 115, juggleCost: 12 }, { reachUp: 130, heavy: true })], // (David 18 Oct 01:07 + the Warrior chat's Steel Tide: three crescents fanned along the floor; the one that strikes bursts into a column of blades that throws him higher — one hit a foe)
    cancelOnHit: ['dash_slash', 'leap_crash', 'lance_thrust'],
    description: 'Steel Tide: charge the blade for an instant, then release three steel crescents fanned along the floor; they pierce, and where one strikes a foe it bursts into a column of blades that throws him into the air.',
    relations: ['Ranged check', 'Pierces'],
  }),
  S({
    id: 'lance_thrust', cls: 'warrior', slot: 10, name: 'Impaling Rush', roles: ['extender', 'peel'], targeting: 'mouseDir',
    startup: 900, active: 520, recovery: 300, cooldown: 3500, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, // (startup = the longest hold: a tap rushes at 120 ms)
    dash: { distance: 70 }, carry: true, // (he rides the blade: from close the rush walked through him and its thrusts hit nothing — the warrior trials' SKEWER)
    hits: [0, 70, 140, 210, 280, 380].map((t, i) => H(t, i === 5 ? 16 : 4, { kind: 'sector', range: 80, angle: 100 }, i === 5 ? { stun: 420, push: 45 } : { stun: 320 }, { reachUp: 140, heavy: i === 5 })),
    // (David 18 Oct 01:07 + the Warrior chat: hold it in three steps, like Earthsplitter — a tap is the rush as it was; ~0.4 s:
    //  farther (the scene: LANCE_RUSH) and one more thrust; ~0.8 s: the farthest, the last thrust heavy, driving him back)
    charge: { minMs: 120, levels: [
      { at: 0, hits: [0, 70, 140, 210, 280, 380].map((t, i) => H(t, i === 5 ? 16 : 4, { kind: 'sector', range: 80, angle: 100 }, i === 5 ? { stun: 420, push: 45 } : { stun: 320 }, { reachUp: 140, heavy: i === 5 })) },
      { at: 400, hits: [0, 65, 130, 195, 260, 325, 420].map((t, i) => H(t, i === 6 ? 20 : 4, { kind: 'sector', range: 84, angle: 100 }, i === 6 ? { stun: 440, push: 70 } : { stun: 320 }, { reachUp: 140, heavy: i === 6 })) },
      { at: 800, hits: [0, 60, 120, 180, 240, 300, 360, 470].map((t, i) => H(t, i === 7 ? 28 : 5, { kind: 'sector', range: 90, angle: 100 }, i === 7 ? { stun: 480, push: 150 } : { stun: 320 }, { reachUp: 150, heavy: i === 7 })) },
    ] },
    cancelOnHit: ['rising_slash', 'leap_crash', 'blade_storm', 'titans_verdict', 'wave_slash'], // (a finisher that drives him to the wall, not a mid-air link)
    description: 'Skewer the target on your blade and rush it across the arena (into a wall if one is in the way), then rip it upward with a burst of light.',
    relations: ['Extender', 'Carry'],
  }),
  S({
    id: 'war_cry', cls: 'warrior', slot: 11, name: 'War Cry', roles: ['setup', 'pull'], targeting: 'self',
    startup: 360, active: 900, recovery: 240, cooldown: 15000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 360],
    hits: [H(0, 6, { kind: 'circle', radius: 170 }, { stun: 300 }, { reachUp: 140 })],
    cancelOnHit: ['dash_slash', 'leap_crash', 'lance_thrust', 'blade_storm'], tags: ['buff'],
    description: 'Battle roar — also breaks free from stun, hits and knockdowns: for 8s a golden aura and the blade of light — +10% damage, +15% with the blade, your sword strikes reach 40% farther, super armor while attacking. In a party, members near you gain +10% damage.',
    relations: ['Buff 8s', 'Super armor'],
  }),
  S({
    id: 'judgment_blade', cls: 'warrior', slot: 12, name: 'Judgment Blade', roles: ['zone', 'setup'], targeting: 'mouseDir',
    startup: 150, active: 320, recovery: 240, cooldown: 12000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    charges: 3, chargeGap: 120, // (David 01:07: three blades, one a press — the cooldown after the third)
    hits: [H(140, 14, { kind: 'circle', radius: 80, at: 'aimBias', bias: 150, floor: true }, { stun: 420, pin: 400, slam: true }, { reachUp: 280, heavy: true })], // (floor: the blade falls to the floor — thrown from the air it struck only the air above a standing foe)
    linger: { at: 'aim', offset: 150, startMs: 520, everyMs: 500, count: 10, radius: 130, maxZ: 40, hit: H(0, 3, { kind: 'circle', radius: 130 }, { stun: 150, bind: 1100 }, { reachUp: 40 }) }, // (the court holds once a combo: its bind; its other ticks only flinch)
    cancelOnHit: ['warrior_basic', 'rising_slash', 'leap_crash', 'lance_thrust', 'blade_storm'],
    description: 'Leap and hurl a judgment blade (it lands in under half a second; an airborne foe is slammed into a bounce). It stays planted for 5s inside a storm ring: a foe who comes down into it is chained upright once per combo — beat him, then launch him again.',
    relations: ['Zone 5s', 'Root → free combo'],
  }),
  // ---- new kit (Z X B N): the grab, the hook, the air chase, the charged fissure (own timings: not stretched)
  S({
    id: 'thunder_circle', cls: 'warrior', slot: 13, name: 'Thunder Circle', roles: ['zone', 'setup'], targeting: 'self',
    startup: 260, active: 100, recovery: 260, cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // (David 18 Oct 18:19: replaces Iron Grip) he drives his sword into the floor: a wide ring of lightning opens in the ground
    // round it for 5 s and strikes everything in it every half second — it throws no one (a flinch each time)
    hits: [H(0, 10, { kind: 'circle', radius: 170 }, { stun: 360 }, { reachUp: 120, heavy: true })],
    linger: { at: 'origin', startMs: 300, everyMs: 500, count: 10, radius: 170, maxZ: 120, hit: H(0, 4, { kind: 'circle', radius: 170 }, { stun: 240 }, { reachUp: 120 }) },
    cancelOnHit: ['rising_slash', 'leap_crash', 'whirlwind', 'titans_verdict'],
    description: 'Drive your sword into the floor: a wide ring of lightning opens in the ground round it for 5s and strikes everyone in it every half second — it holds them flinching, it throws no one.',
    relations: ['Zone 5s', 'No launch'],
  }),
  S({
    id: 'judgment_hook', cls: 'warrior', slot: 14, name: 'Judgment Hook', roles: ['pull', 'gapClose'], targeting: 'mouseDir',
    startup: 140, active: 340, recovery: 240, cooldown: 7000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(160, 10, { kind: 'line', length: 300, width: 46 }, { stun: 640, grab: true, pullMs: 230 }, { reachUp: 160 })],
    cancelOnHit: ['warrior_basic', 'thunder_circle', 'dash_slash', 'rising_slash', 'whirlwind', 'ground_breaker', 'lance_thrust'],
    description: 'Hurl a chain of golden light up to 380px: it hooks the first foe it reaches and yanks it right in front of you, stunned, ready for your next blow.',
    relations: ['Pull to you', 'Combo starter'],
  }),
  S({
    id: 'sky_breaker', cls: 'warrior', slot: 15, name: 'Sky Breaker', roles: ['airExtender', 'chase'], targeting: 'mouseTarget',
    startup: 110, active: 620, recovery: 300, cooldown: 4500, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 140, lift: 170, crash: true },
    hits: [H(60, 7, { kind: 'circle', radius: 90 }, { stun: 380, launch: 150, juggleCost: 6 }, { reachUp: 240 }), // pops the foe up to rise with him
      H(170, 7, { kind: 'circle', radius: 90 }, { stun: 380, float: true, juggleCost: 4 }, { reachUp: 240 }),
      H(280, 8, { kind: 'circle', radius: 95 }, { stun: 380, float: true, juggleCost: 4 }, { reachUp: 240 }),
      H(560, 18, { kind: 'circle', radius: 120 }, { stun: 420, slam: true }, { reachUp: 260, heavy: true })],
    cancelOnHit: ['leap_crash', 'thunder_circle', 'judgment_hook', 'whirlwind', 'blade_storm'],
    description: 'Spring into the air after your foe: three rising slashes keep it floating, then a crushing downward strike smashes it into the floor so it bounces back up.',
    relations: ['Air chase', 'Slam → bounce'],
  }),
  S({
    id: 'earthsplitter', cls: 'warrior', slot: 16, name: 'Earthsplitter', roles: ['finisher', 'knockdown'], targeting: 'mouseCone',
    startup: 800, active: 320, recovery: 380, cooldown: 10000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1100],
    // hold the key: the sword raised overhead charges (160..800 ms); the level picks how far and wide the fissure tears
    hits: [H(0, 16, { kind: 'sector', range: 200, angle: 70 }, { stun: 420, knockdown: 'heavy' }, { reachUp: 120, depth: 100, heavy: true })],
    // (David 18 Oct 18:19: wider across the field — the fissure reaches ±100 px of depth, its spikes stand in a zigzag band)
    charge: { minMs: 160, levels: [
      { at: 0, hits: [H(0, 16, { kind: 'sector', range: 200, angle: 70 }, { stun: 420, knockdown: 'heavy' }, { reachUp: 120, depth: 100, heavy: true })] },
      { at: 350, hits: [H(0, 22, { kind: 'sector', range: 280, angle: 80 }, { stun: 460, knockdown: 'heavy' }, { reachUp: 140, depth: 100, heavy: true }),
        H(150, 8, { kind: 'sector', range: 300, angle: 90 }, { stun: 380 }, { reachUp: 220, depth: 100 })] },
      { at: 700, hits: [H(0, 28, { kind: 'sector', range: 360, angle: 90 }, { stun: 500, knockdown: 'heavy', grab: true }, { reachUp: 160, depth: 100, heavy: true }), // (full charge: breaks super armor)
        H(150, 8, { kind: 'sector', range: 380, angle: 95 }, { stun: 400 }, { reachUp: 260, depth: 100 }),
        H(300, 8, { kind: 'sector', range: 380, angle: 95 }, { stun: 400 }, { reachUp: 300, depth: 100 })] },
    ] },
    cancelOnHit: ['sky_breaker', 'blade_storm', 'titans_verdict'],
    description: 'Hold the key: you raise your sword overhead as the ground trembles, in three steps. Release: you split the earth — a wide fissure tears across the floor in front of you and pillars of light burst out of it, smashing every foe flat; the longer you held, the farther and wider — a full charge breaks super armor. A punish, not a combo link.',
    relations: ['Hold to charge (3 levels)', 'Wide launcher'],
  }),
  S({
    id: 'shield_charge', cls: 'warrior', slot: 18, name: 'Iron Bastion', roles: ['counter', 'setup'], targeting: 'self',
    startup: 120, active: 1500, recovery: 260, cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1620],
    // (David 18 Oct 01:07 + the Warrior chat's Iron Bastion): he plants the sword and turns to iron for 1.5 s — super armor and
    // half the damage (the scene: BASTION); when it ends every blow he took comes back as one iron counter-slash round him
    // (its damage grows with each: the scene)
    hits: [H(1440, 12, { kind: 'circle', radius: 150 }, { stun: 460, push: 60, launch: 60, juggleCost: 12 }, { reachUp: 160, heavy: true })],
    cancelOnHit: ['thunder_circle', 'warrior_basic', 'rising_slash'],
    description: 'Plant the sword and turn to iron for 1.5s: nothing staggers you and every blow does half its damage. When it ends, every blow you took comes back as one iron counter-slash round you — the more you took, the harder it hits.',
    relations: ['Super armor 1.5s', 'Half damage', 'Counter-slash'],
  }),
  S({
    id: 'lions_maw', cls: 'warrior', slot: 17, name: "Lion's Maw", roles: ['airExtender', 'extender'], targeting: 'mouseTarget',
    startup: 150, active: 520, recovery: 220, cooldown: 12000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    // the warrior roars and his lion of light pounces through the foe: a bite, a raking claw, a dive — and slams it into a bounce
    hits: [H(120, 8, { kind: 'circle', radius: 120, at: 'aimBias', bias: 130 }, { stun: 460, float: true, pull: 40, juggleCost: 4 }, { reachUp: 320 }),
      H(240, 8, { kind: 'circle', radius: 120, at: 'aimBias', bias: 130 }, { stun: 460, float: true, juggleCost: 4 }, { reachUp: 320 }), // (holds him up: it no longer spends a re-launch the chase after it needs)
      H(330, 6, { kind: 'circle', radius: 120, at: 'aimBias', bias: 130 }, { stun: 440, float: true }, { reachUp: 320 }),
      H(450, 16, { kind: 'circle', radius: 140, at: 'aimBias', bias: 130 }, { stun: 520, float: true, pull: 30 }, { reachUp: 320, heavy: true })], // (the lion drags him back and holds him: no launch, no slam)
    // (David 18 Oct 01:07 + the Warrior chat: the lion stays — it lands on the foe's spot and stands roaring 5 s, a roar ring
    //  every 600 ms hurting what it reaches, ~200 px; then it bursts into embers)
    linger: { at: 'aim', offset: 130, startMs: 600, everyMs: 600, count: 8, radius: 200, maxZ: 220,
      hit: H(0, 4, { kind: 'circle', radius: 200 }, { stun: 260, push: 20 }, { reachUp: 220 }),
      last: H(0, 12, { kind: 'circle', radius: 220 }, { stun: 420, launch: 90, juggleCost: 12 }, { reachUp: 240, heavy: true }) },
    cancelOnHit: ['rising_slash', 'sky_breaker', 'thunder_circle', 'lance_thrust', 'ground_breaker', 'blade_storm', 'titans_verdict', 'leap_crash'],
    description: 'Roar, and a lion of light pounces from your side onto the foe in front of you — a bite, a raking claw, a dive — then stands there roaring for 5s: every roar hurts everyone around it, and the last one bursts and throws them. Usable in the air.',
    relations: ['Pull', 'Hold'],
  }),
];

// ------------------------------------------------------------------ BOOK MAGE
// The controller (mage spec, 8.10.2026): frost chills / freezes, heavy hits shatter, storm conducts through the chilled
// (Combat.ts), a rune net on the floor, gravity turned over, gates, the paper crane curse, time. Ordered by Jobs.ts.
const FROST = 'frost' as const, STORM = 'storm' as const;
/** Arcane Bolt's three beats (el: the element Attunement gives them). */
function doubleShotStages(): HitEvent[][] {
  return [
    [H(0, 7, { kind: 'projectile', speed: 900, range: 430, radius: 9, antiAir: true }, { stun: 180, push: 2 }), H(70, 7, { kind: 'projectile', speed: 900, range: 430, radius: 9, antiAir: true }, { stun: 200, push: 3 }, { mark: 1 })],
    [H(0, 14, { kind: 'projectile', speed: 1250, range: 470, radius: 14, antiAir: true }, { stun: 320, push: 90 }, { heavy: true })],
  ];
}
function boltStages(el?: 'frost' | 'storm'): HitEvent[][] {
  const e = el ? { el } : {}, sp = el === 'storm' ? 860 : 760;
  return [
    // (magic missiles: they seek a foe in the air in front of her — antiAir — as the archer's arrows do)
    [H(0, 9, { kind: 'projectile', speed: sp, range: 480, radius: 12, antiAir: true }, { stun: 220, push: 4 }, { ...e })],
    [H(0, 9, { kind: 'projectile', speed: sp, range: 480, radius: 12, antiAir: true }, { stun: 240, push: 5 }, { ...e })],
    [H(0, 18, { kind: 'projectile', speed: sp + 140, range: 520, radius: 20, pierce: true, antiAir: true }, { stun: 380, push: 30 }, { heavy: true, ...e })],
  ];
}
const mage: FinalSkill[] = [
  S({
    id: 'arcane_bolt', cls: 'book_mage', slot: 0, name: 'Arcane Bolt', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
    startup: 115, active: 0, recovery: 170, cooldown: 0, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: { startup: 0.8, active: 0.8, recovery: 0.8 },
    hits: boltStages()[0],
    // a three-beat rhythm: two quick bolts, then a heavy arcane lance that pierces, throws the foe back (and shatters the frozen)
    chain: { resetMs: 800, stages: boltStages(), timings: [{ startup: 115, active: 0, recovery: 170 }, { startup: 100, active: 0, recovery: 185 }, { startup: 230, active: 0, recovery: 310 }] }, // (David 18 Oct 01:26: "shoots very fast" — ~1.4× slower)
    cancelOnHit: ['arcane_wave', 'astral_burst', 'blink', 'frost_nova', 'lightning_chain', 'glacial_spikes'],
    description: 'Tap or hold Space: two quick bolts, then a heavy arcane lance that flies through foes and throws them back. You keep walking while you cast (80% speed). From the 2nd job they take the element of your last spell (Attunement): frost bolts chill, storm bolts conduct.',
    relations: ['3-beat chain', 'Lance shatters the frozen'],
  }),
  S({
    id: 'arcane_wave', cls: 'book_mage', slot: 1, name: 'Arcane Wave', roles: ['confirm', 'peel'], targeting: 'mouseLine',
    startup: 150, active: 180, recovery: 180, cooldown: 4000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 24, { kind: 'line', length: 230, width: 110 }, { stun: 260, launch: 90, float: true, juggleCost: 12 }, { reachUp: 170, depth: 90 })], // (David 18 Oct 01:26: a wave with depth — it reaches ±90 px across the lane, as its three crests are drawn)
    cancelOnHit: ['astral_burst', 'lightning_chain', 'blink', 'glacial_spikes'], telegraph: 'line',
    description: 'A wide, short wave across the floor that lifts a foe on the ground into the air, low and in reach of your next spell; a foe already in the air is bounced up again.',
    relations: ['Lifts a grounded foe', 'Bounces one in the air'],
  }),
  S({
    id: 'binding_rune', cls: 'book_mage', slot: 2, name: 'Binding Rune', roles: ['trap', 'setup', 'hardCC'], targeting: 'mouseGround',
    startup: 200, active: 100, recovery: 160, cooldown: 9000, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 300, charges: 2, chargeGap: 260, trap: { radius: 46, lifeMs: 10000 },
    hits: [H(0, 12, { kind: 'placed', radius: 46 }, { hardCC: { kind: 'stun', ms: 3000, long: true }, stun: 120 }, { reachUp: 40 })], // (David 18 Oct 01:26: binds him at least 3 s)
    cancelOnHit: [], telegraph: 'ground',
    description: 'Lay up to 2 runes on the floor (10s each). Stepping on one binds the foe for 3s. Two runes close together join in a beam of light: whoever crosses it is bound and shocked, and the beam breaks.',
    relations: ['Rune net', 'Bind 3s'],
  }),
  S({
    id: 'astral_burst', cls: 'book_mage', slot: 3, name: 'Astral Lift', roles: ['launcher', 'pull'], targeting: 'selfAim',
    startup: 180, active: 140, recovery: 220, cooldown: 6000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 28, { kind: 'circle', radius: 120, at: 'aimBias', bias: 80 }, { stun: 420, pull: 44, launch: 130, juggleCost: 30, slowFall: 1800 }, { reachUp: 130, heavy: true })], // (David 18 Oct 01:26: the tube of light lowers him slowly)
    cancelOnHit: ['lightning_chain', 'arcane_wave', 'blink', 'arcane_bolt'], telegraph: 'circle',
    description: 'A hand of starlight seizes the foe, draws it to you and throws it into the air. A heavy blow: on a frozen foe it SHATTERS the ice.',
    relations: ['Launcher', 'Shatters the frozen'],
  }),
  S({
    id: 'frost_nova', cls: 'book_mage', slot: 4, name: 'Frost Nova', roles: ['zone', 'peel'], targeting: 'self',
    startup: 220, active: 260, recovery: 320, cooldown: 7000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 0, lift: 46 }, // he rises a little on the burst of cold, then drops
    hits: [H(0, 20, { kind: 'circle', radius: 120 }, { stun: 340 }, { reachUp: 120, el: FROST }),
      H(160, 8, { kind: 'circle', radius: 175 }, { stun: 300 }, { reachUp: 140 })],
    cancelOnHit: ['glacial_spikes', 'astral_burst', 'blink', 'arcane_bolt'], telegraph: 'circle',
    description: 'A ring of ice bursts out across the floor around you without moving anyone: it CHILLS every foe it touches (a foe already chilled FREEZES solid) — the cold that opens your element chain.',
    relations: ['Chill', 'Freezes the chilled'],
  }),
  S({
    id: 'lightning_chain', cls: 'book_mage', slot: 5, name: 'Lightning Chain', roles: ['airExtender', 'precision'], targeting: 'mouseTarget',
    startup: 170, active: 420, recovery: 200, cooldown: 5000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [
      H(0, 14, { kind: 'chain', corridor: 380, width: 70, jump: 0 }, { stun: 300, float: true, juggleCost: 14 }, { reachUp: 170, el: STORM, heavy: true }),
      ...[100, 200, 300].map((t) => H(t, 9, { kind: 'chain', corridor: 380, width: 70, jump: 200 }, { stun: 280, float: true, juggleCost: 6 }, { reachUp: 170, el: STORM })),
      H(400, 8, { kind: 'chain', corridor: 380, width: 70, jump: 0 }, { stun: 320, push: 18, float: true, juggleCost: 6 }, { reachUp: 170, el: STORM }),
    ],
    cancelOnHit: ['arcane_wave', 'astral_burst', 'blink', 'storm_field', 'levity_field', 'time_collapse'], telegraph: 'line',
    description: 'Lightning seizes the first foe in front of you and leaps on to 3 more, holding them in the air. Through CHILLED foes it CONDUCTS: a longer shock.',
    relations: ['Air hold', 'Conducts through the chilled'],
  }),
  S({
    id: 'storm_field', cls: 'book_mage', slot: 6, name: 'Storm Field', roles: ['signature', 'zone'], targeting: 'mouseGround',
    startup: 320, active: 1500, recovery: 300, cooldown: 16000, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: { startup: 0, active: 1, recovery: 0 },
    placeRange: 320,
    hits: [0, 480, 960, 1440].map((t, i) => H(t, 10, { kind: 'placed', radius: 130 },
      i === 3 ? { stun: 280, launch: 105, slow: { pct: 0.2, ms: 600 }, juggleCost: 30 } : { stun: 540, pull: 10, slow: { pct: 0.2, ms: 600 }, juggleCost: 6 }, { reachUp: 240, heavy: i === 3, el: STORM })), // (its bolts fall out of the sky: a foe held up in the field is struck too)
    zoneMs: 1500, cancelOnHit: ['time_collapse', 'astral_burst', 'lightning_chain'], tags: ['signature'], telegraph: 'ground',
    description: 'A storm field where you aim: four pulses slow and draw foes toward its centre, the last one throws them up. It conducts through the chilled. You are free to move while it rages.',
    relations: ['Signature', 'Zone'],
  }),
  S({
    id: 'time_collapse', cls: 'book_mage', slot: 7, name: 'Time Collapse', roles: ['ultimate', 'finisher'], targeting: 'mouseGround',
    startup: 900, active: 1300, recovery: 480, cooldown: 36000, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 300,
    hits: [
      H(0, 0, { kind: 'placed', radius: 175 }, { pull: 40 }, { reachUp: 360 }), // (the clock stands over the whole area: it takes a foe juggled high too)
      H(260, 6, { kind: 'placed', radius: 165 }, { pull: 30, hardCC: { kind: 'freeze', ms: 1000, long: true } }, { reachUp: 360 }),
      H(1250, 60, { kind: 'placed', radius: 170 }, { stun: 420, knockdown: 'heavy' }, { reachUp: 360, heavy: true }),
    ],
    endsCombo: true, tags: ['ultimate'], telegraph: 'ground',
    description: 'A giant clock opens over the area and draws foes in, its hands stop and every foe in it is frozen in time — then the clock cracks and collapses in a blast that SHATTERS them. Every rune of your Spell Weave adds 10%. Ends the combo.',
    relations: ['Ultimate', 'Time stop'],
  }),
  // ---- extended kit (Q R F G C V T H Z X)
  S({
    id: 'blink', cls: 'book_mage', slot: 8, name: 'Blink', roles: ['mobility', 'escape'], targeting: 'mouseDir',
    startup: 40, active: 100, recovery: 110, cooldown: 5000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 170 }, through: true, charges: 2, chargeGap: 220,
    hits: [H(0, 0, { kind: 'capsule', radius: 34 }, { stun: 350, juggleCost: 6 }, { reachUp: 90 })],
    description: 'Vanish and reappear a short way off in the direction you hold, in the air too; a foe you pass through is stunned (no damage). Toward a foe in the air it carries you up to it, to go on with the combo there. Two blinks in a row. It cancels the end of any of your spells.',
    relations: ['2 in a row', 'Cancels any spell'],
  }),
  S({
    id: 'glacial_spikes', cls: 'book_mage', slot: 9, name: 'Glacial Spikes', roles: ['launcher', 'zone'], targeting: 'mouseCone',
    startup: 220, active: 200, recovery: 220, cooldown: 6000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 22, { kind: 'projectile', speed: 700, range: 260, radius: 30, count: 3, spread: 30, pierce: true }, { stun: 380, launch: 100, juggleCost: 22 }, { reachUp: 120, el: FROST })],
    // the spikes stand 1.5s as a wall of ice: foes are held back from it
    linger: { at: 'aim', offset: 180, startMs: 260, everyMs: 150, count: 10, radius: 90, maxZ: 60, hit: H(0, 0, { kind: 'circle', radius: 90 }, { push: 24 }, { reachUp: 60 }) },
    cancelOnHit: ['astral_burst', 'lightning_chain', 'blink', 'arcane_bolt'], telegraph: 'cone',
    description: 'Three rows of ice spikes burst from the floor in a fan: each spike throws its foe up and CHILLS it (a chilled foe FREEZES). The spikes stand for 1.5s as a wall of ice no foe can walk through.',
    relations: ['Launcher', 'Ice wall 1.5s'],
  }),
  S({
    id: 'levity_field', cls: 'book_mage', slot: 11, name: 'Levity Field', roles: ['zone', 'hardCC', 'setup'], targeting: 'mouseGround',
    startup: 380, active: 140, recovery: 200, cooldown: 13000, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 320, zoneMs: 2500,
    hits: [H(0, 10, { kind: 'placed', radius: 110 }, { levity: 2500, stun: 160 }, { reachUp: 120 })],
    cancelOnHit: ['lightning_chain', 'storm_field', 'origami_flock', 'frost_nova', 'blink', 'arcane_bolt'], telegraph: 'ground',
    description: 'Gravity turns over where you aim: every foe in the circle floats up — held still for 0.9s, then hovering free until it drops after 2.5s. Your bolts fly twice as fast through it.',
    relations: ['Hold 0.9s', 'Float 2.5s'],
  }),
  S({
    id: 'origami_flock', cls: 'book_mage', slot: 12, name: 'Origami Flock', roles: ['projectile', 'chase'], targeting: 'mouseCone',
    startup: 300, active: 120, recovery: 220, cooldown: 9000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 8, { kind: 'projectile', speed: 460, range: 600, radius: 16, count: 5, spread: 35, homing: 240, antiAir: true }, { stun: 220, push: 6, float: true, juggleCost: 3 }, { reachUp: 160 })], // (homing cranes: they seek him in the air too; a ±70° fan turning 240°/s, 600 px — fanned 70° a crane (±140°) two flew off behind her and ran out before they turned back: UPDRAFT landed 1 crane of 5)
    cancelOnHit: ['levity_field', 'paper_curse', 'blink', 'arcane_bolt'],
    description: 'Five pages tear out of the book and fold into paper cranes. Each crane picks a foe and bends a little toward it — a step aside still slips them. Every torn page of yours lying near folds into one more crane (up to 4 more).',
    relations: ['5 cranes', 'Gently homing'],
  }),
  S({
    id: 'arcane_ward', cls: 'book_mage', slot: 14, name: 'Arcane Ward', roles: ['setup'], targeting: 'self',
    startup: 260, active: 100, recovery: 180, cooldown: 30000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [], tags: ['buff', 'party'],
    description: 'A shell of rune hexagons takes damage for you for 8s, up to 20% of your max HP (party members near you: 10%). When it breaks it bursts in a ring of frost that CHILLS the foes around you.',
    relations: ['Shield 8s', 'Party shield'],
  }),
  S({
    id: 'paper_curse', cls: 'book_mage', slot: 16, name: 'Paper Curse', roles: ['hardCC', 'setup'], targeting: 'mouseTarget',
    startup: 280, active: 100, recovery: 200, cooldown: 16000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 10, { kind: 'chain', corridor: 360, width: 70, jump: 0 }, { curse: 2000 }, { reachUp: 160 })],
    cancelOnHit: ['binding_rune', 'storm_field', 'origami_flock', 'blink'],
    description: 'A SILENCE: pages fold a foe into a paper crane for 1.2s — it walks and jumps freely but cannot attack or use skills. It holds nothing in place, so it does not extend a combo. A heavy blow unfolds it early. A monster turned into a crane takes 30% more damage. Three torn pages fall where it struck and lie 8s.',
    relations: ['Silence 1.2s', 'No attacks or skills'],
  }),
  S({
    id: 'elemental_ascension', cls: 'book_mage', slot: 17, name: 'Elemental Ascension', roles: ['setup'], targeting: 'self',
    startup: 600, active: 160, recovery: 240, cooldown: 90000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 900],
    hits: [H(0, 8, { kind: 'circle', radius: 160 }, { stun: 300, push: 34 }, { reachUp: 150 })],
    tags: ['buff'],
    description: 'Merge with the elements for 20s: every one of your hits both CHILLS and shocks, so magic reactions come from anything you cast, even Arcane Bolt.',
    relations: ['Buff 20s', 'Every hit: frost + storm'],
  }),
  S({
    id: 'rift_gates', cls: 'book_mage', slot: 18, name: 'Rift Gates', roles: ['mobility', 'setup'], targeting: 'self',
    startup: 200, active: 80, recovery: 160, cooldown: 600, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // (David 18 Oct 01:26 + the Book Mage chat's Rift Gates): a press lays a violet rune gate into the floor under her (two at
    // most: a third moves the oldest; each 10 s); pressed while she stands on one, she sinks into it and rises out of the
    // other — 260 ms under, untouchable, then the gates wait 4 s (the scene: RIFT); foes cannot use them
    hits: [], tags: ['buff'],
    cancelOnHit: [],
    description: 'Lay a violet rift gate into the floor under you — two at most, each for 10s. Press it again while standing on one: you sink into it and rise out of the other, untouchable on the way; then the gates rest 4s. Foes cannot use them.',
    relations: ['Two gates (10s)', 'Cross between them'],
  }),
  S({
    id: 'tempest_ride', cls: 'book_mage', slot: 19, name: 'Tempest Ride', roles: ['chase', 'zone'], targeting: 'self',
    startup: 220, active: 2500, recovery: 300, cooldown: 14000, ground: true, air: false, cover: 'IGNORES_COVER', move: { startup: 0, active: 0.85, recovery: 0 }, armor: [0, 2720], follow: true,
    // (David 18 Oct 01:26: "a tornado she can fly inside, hitting as it goes" + the Book Mage chat's Tempest Ride): she calls a
    // tornado round herself and rides it — lifted ~60 px, steered as she walks for 2.5 s (unstaggerable); a foe it touches is
    // caught (a cut every 250 ms holds him up in it), then it bursts outward and throws them
    hits: [H(0, 5, { kind: 'circle', radius: 95 }, { stun: 300, launch: 60, juggleCost: 6 }, { reachUp: 180 }),
      ...Array.from({ length: 9 }, (_, i) => H(250 + i * 250, 4, { kind: 'circle', radius: 95 }, { stun: 280, float: true, juggleCost: 3 }, { reachUp: 220, el: i % 3 === 2 ? STORM : undefined })),
      H(2460, 16, { kind: 'circle', radius: 150 }, { stun: 420, launch: 110, push: 90, juggleCost: 14 }, { reachUp: 240, heavy: true, el: STORM })],
    cancelOnHit: ['time_collapse'],
    description: 'Call a violet-blue tornado round you and ride it for 2.5s — lifted off the floor, steered as you walk, nothing staggers you. A foe it touches is caught and held up in its funnel, then it bursts outward and throws everyone in it.',
    relations: ['Ride 2.5s', 'Catches and throws'],
  }),
];
/** Arcane Bolt as Attunement turns it (the element of the last spell): cast in its place, never on the skill bar. */
const mageBolts: FinalSkill[] = (['frost', 'storm', 'arcane'] as const).map((e) => {
  const b = mage[0], st = boltStages(e === 'arcane' ? undefined : e);
  return { ...b, id: `arcane_bolt_${e}`, name: e === 'frost' ? 'Frost Bolt' : e === 'storm' ? 'Storm Bolt' : 'Arcane Bolt', hits: st[0], chain: { ...b.chain!, stages: st } };
});

// ------------------------------------------------------------------ ARCHER
const archer: FinalSkill[] = [
  // ---- Beginner / every job: the bow's basic attack
  S({
    id: 'quick_shot', cls: 'archer', arenaDmg: 0.6, slot: 0, name: 'Double Shot', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
    startup: 85, active: 70, recovery: 110, cooldown: 350, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: { startup: 0.85, active: 0.85, recovery: 0.85 },
    hits: doubleShotStages()[0],
    // a two-beat rhythm: the two fast arrows, then a charged arrow that throws the foe back (her chain's end) — numbers: DFO PvP arena dynamics
    chain: { resetMs: 600, stages: doubleShotStages(), timings: [{ startup: 85, active: 70, recovery: 110 }, { startup: 170, active: 0, recovery: 220 }] },
    cancelOnHit: ['rising_arrow', 'multi_shot', 'explosive_arrow', 'retreat_kick', 'piercing_arrow', 'vine_trap', 'rain_of_arrows'],
    description: 'Tap or hold Space: two fast arrows, then a charged arrow that throws the foe back; usable while moving at 85% speed. A foe up in the air in front is shot where he is: keep him up with it.',
    relations: ['Poke', 'Air follow-up', '2-beat chain'],
  }),
  // ---- 1st job (Archer)
  S({
    id: 'rising_arrow', cls: 'archer', slot: 1, name: 'Rising Arrow', roles: ['launcher', 'antiAir'], targeting: 'mouseCone',
    startup: 180, active: 220, recovery: 220, cooldown: 3000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 18, { kind: 'circle', radius: 62, at: 'aimBias', bias: 95 }, { stun: 440, launch: 150, juggleCost: 30 }, { reachUp: 120, useMark: 'launch' }),
      H(80, 5, { kind: 'circle', radius: 62, at: 'aimBias', bias: 95 }, { stun: 300, float: true, juggleCost: 3 }, { reachUp: 240 })],
    cancelOnHit: ['quick_shot', 'skyhunters_step', 'multi_shot', 'leaping_arrow', 'eagle_arrow', 'retreat_kick'], telegraph: 'circle',
    description: 'An arrow strikes the ground in front of you and a column of wind throws the target high into the air.',
    relations: ['Launcher', 'Jump → Double Shot'],
  }),
  S({
    id: 'bow_haste', cls: 'archer', slot: 2, name: 'Wind Step', roles: ['escape', 'projectile'], targeting: 'mouseDir',
    startup: 60, active: 380, recovery: 160, cooldown: 4500, ground: false, air: true, cover: 'IGNORES_COVER', move: LOCK, // her escape in the air only (on the floor: Backstep Shot)
    dash: { distance: -190, lift: 70 },
    hits: [H(340, 16, { kind: 'circle', radius: 85, at: 'aimBias', bias: 200, floor: true }, { stun: 420, launch: 140, juggleCost: 22 }, { reachUp: 220, mark: 1 })],
    description: 'A gust throws you back out of reach; mid-leap you shoot an arrow into the ground in front of you — it bursts and throws the foe there into the air (and leaves a Hunter\'s Mark).',
    relations: ['Escape', 'Marks'],
  }),
  // ---- 2nd job (Hunter)
  S({
    id: 'multi_shot', cls: 'archer', arenaDmg: 0.85, slot: 3, name: 'Triple Arrow', roles: ['confirm', 'projectile'], targeting: 'mouseCone',
    startup: 280, active: 150, recovery: 220, cooldown: 2800, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 22, { kind: 'projectile', speed: 640, range: 420, radius: 12, count: 5, spread: 24, antiAir: true }, { stun: 240, push: 10, float: true, juggleCost: 12 }, { mark: 1 })],
    cancelOnHit: ['explosive_arrow', 'piercing_arrow', 'quick_shot', 'skyhunters_step', 'retreat_kick'], telegraph: 'cone',
    description: 'A steady draw, then five arrows fan out — green spirit arrows and iron ones between them; one damage event per target.',
    relations: ['Confirm', 'Cancel → Explosive Arrow'],
  }),
  S({
    id: 'explosive_arrow', cls: 'archer', slot: 4, name: 'Fireball Arrow', roles: ['projectile', 'launcher'], targeting: 'mouseProjectile',
    startup: 220, active: 0, recovery: 220, cooldown: 6000, ground: true, air: true, cover: 'EXPLODES_ON_COVER', move: LOCK, tags: ['farLaunch'], // her launcher from afar (keeps its lift past the poke range)
    hits: [H(0, 30, { kind: 'projectile', speed: 620, range: 520, radius: 16, explodeRadius: 80, antiAir: true }, { stun: 360, launch: 140, push: 10, juggleCost: 25 }, { useMark: 'blast' })],
    cancelOnHit: ['quick_shot', 'rain_of_arrows', 'skyhunters_step'],
    description: 'A burning arrow wrapped in a fireball; it bursts into a blast of fire at the target, a wall or its full range.',
    relations: ['Pop', 'Jump → Double Shot'],
  }),
  S({
    id: 'backstep_shot', cls: 'archer', slot: 18, name: 'Backstep Shot', roles: ['escape', 'projectile'], targeting: 'mouseProjectile',
    startup: 70, active: 260, recovery: 160, cooldown: 5000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, // her escape on the floor
    dash: { distance: -150, lift: 60 },
    hits: [H(120, 12, { kind: 'projectile', speed: 1000, range: 300, radius: 11, antiAir: true }, { stun: 220, push: 8, pin: 450 }, { mark: 1 })], // (the arrow pins a launched foe up there for her follow-up from range)
    // (David 18 Oct 01:33 + the Archer chat's Leaf Decoy): a decoy of leaves stays where she stood for 1 s — a foe who strikes it or
    // touches it bursts it into thorned leaves that root him 0.8 s (each foe once)
    linger: { at: 'origin', startMs: 0, everyMs: 100, count: 10, radius: 60, maxZ: 130, once: true, hit: H(0, 4, { kind: 'circle', radius: 60 }, { stun: 200, hardCC: { kind: 'root', ms: 800 } }, { reachUp: 130 }) },
    cancelOnHit: ['quick_shot', 'hunters_spirit', 'rising_arrow', 'explosive_arrow'],
    description: 'Leaf Decoy: a back flip out of reach, leaving a decoy of leaves where you stood — a foe who strikes or touches it within a second is snared by thorned leaves. At the top of the flip one spirit arrow pins a foe in the air.',
    relations: ['Keep distance', 'From the basic / Kick'],
  }),
  S({
    id: 'retreat_kick', cls: 'archer', slot: 5, name: 'Retreat Kick', roles: ['launcher'], targeting: 'mouseCone',
    startup: 110, active: 420, recovery: 200, cooldown: 4000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 200], // her answer up close
    dash: { distance: -60, lift: 40 }, // (a short hop: the launcher up close, not an escape)
    hits: [H(0, 16, { kind: 'sector', range: 110, angle: 110 }, { stun: 460, launch: 150, juggleCost: 28 }, { reachUp: 120 })], // (a ground kick: it scoops a bounce, not a foe in the air)
    cancelOnHit: ['quick_shot', 'multi_shot', 'piercing_arrow', 'skyhunters_step', 'eagle_arrow', 'leaping_arrow'],
    description: 'A rising kick of wind launches the foe into the air while you flip backward out of reach — then shoot him down.',
    relations: ['Launcher', 'Escape'],
  }),
  S({
    id: 'vine_trap', cls: 'archer', slot: 8, name: 'Vine Mine', roles: ['trap', 'setup', 'launcher'], targeting: 'mouseGround',
    startup: 220, active: 280, recovery: 160, cooldown: 7000, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    dash: { distance: -130, lift: 38 }, // plants the mine and hops back away from it
    placeRange: 260, trap: { radius: 90, lifeMs: 4000, fuseMs: 2000 },
    hits: [H(0, 0, { kind: 'placed', radius: 90 }, { hardCC: { kind: 'root', ms: 2000, long: true }, stun: 450, catch: true }), // (held: 0.45 s — a root alone still lets him swing)
      H(0, 32, { kind: 'placed', radius: 110 }, { stun: 700, launch: 150, juggleCost: 30 }, { reachUp: 200, heavy: true })],
    cancelOnHit: [], telegraph: 'ground',
    description: 'A vine mine buried in the floor. Whoever steps on it — a player or a whole pack of monsters — is held, and 2s later it explodes and throws them all very high; untouched, it goes off by itself after 4s.',
    relations: ['Setup', 'High launcher'],
  }),
  // ---- 3rd job (Ranger)
  S({
    id: 'skyhunters_step', cls: 'archer', arenaDmg: 0.85, slot: 6, name: 'Air Volley', roles: ['signature', 'mobility', 'chase'], targeting: 'mouseDir',
    startup: 320, active: 1500, recovery: 340, cooldown: 16000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 320, lift: 170 },
    hits: [160, 445, 730, 1015, 1300].map((t, i) => H(t, [8, 8, 9, 9, 10][i], { kind: 'projectile', speed: 760, range: 420, radius: 9, rows: 3, rowGap: 52, antiAir: true }, { stun: 300, float: true, juggleCost: 12 }, { mark: i === 4 ? 1 : 0 })),
    cancelOnHit: ['sky_rain'], tags: ['signature'], telegraph: 'trajectory',
    description: 'Acrobatic leap in the facing direction while firing five shots from the air — keeps a launched foe up.',
    relations: ['Signature', 'Air combo'],
  }),
  S({
    id: 'rain_of_arrows', cls: 'archer', arenaDmg: 0.85, slot: 9, name: 'Thunder Rain', roles: ['zone', 'extender'], targeting: 'mouseDir',
    startup: 300, active: 1200, recovery: 300, cooldown: 12000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [300, 900],
    dash: { distance: 0, lift: 150, hang: true },
    linger: { at: 'aim', offset: 300, startMs: 1000, everyMs: 80, count: 26, radius: 210, maxZ: 50, once: true, hit: H(0, 6, { kind: 'circle', radius: 210 }, { stun: 320, launch: 110, juggleCost: 10, slow: { pct: 30, ms: 500 } }, { reachUp: 50 }) }, // the charged floor throws whoever lands on it back up (once each)
    hits: [600, 750, 900].map((t, i) => H(t, i === 2 ? 16 : 12, { kind: 'circle', radius: 110, at: 'aimBias', bias: [60, 140, 220][i], floor: true }, { stun: 320, float: true, juggleCost: 10, slow: { pct: 30, ms: 800 } }, { reachUp: 320, heavy: i === 2, useMark: i === 2 ? 'stun' as const : undefined })),
    cancelOnHit: ['quick_shot', 'skyhunters_step'], telegraph: 'line',
    description: 'Leap, hang in the air charging, then loose three lightning arrows close in front of and above you — her answer to a foe in the air over her; the floor they strike stays charged.',
    relations: ['Anti-air', 'Keeps foes up'],
  }),
  S({
    id: 'piercing_arrow', cls: 'archer', slot: 10, name: 'Spirit Bow', roles: ['finisher', 'projectile'], targeting: 'mouseDir',
    startup: 420, active: 200, recovery: 300, cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 46, { kind: 'projectile', speed: 1500, range: 760, radius: 18, pierce: true, antiAir: true }, { stun: 520, push: 160, knockdown: 'heavy' }, { heavy: true, mark: 1 })],
    description: 'The great spirit bow draws once: a single piercing arrow tears through every foe in its line and throws them down — the end of her combo. The direction you hold aims it to a side, up at an angle or straight up.',
    relations: ['Combo finisher', 'Pierces'],
  }),
  S({
    id: 'hunters_roar', cls: 'archer', slot: 11, name: "Hunter's Roar", roles: ['peel', 'knockdown'], targeting: 'self',
    startup: 260, active: 200, recovery: 260, cooldown: 12000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 460],
    hits: [H(0, 14, { kind: 'circle', radius: 260 }, { stun: 380, push: 190, juggleCost: 20 }, { reachUp: 180, heavy: true, useMark: 'roar' })],
    cancelOnHit: ['quick_shot', 'multi_shot', 'rain_of_arrows', 'arrow_storm'],
    description: 'The wolf spirit roars: a huge shockwave throws every foe around you far back and hurts them — clear space, then gather the monsters and shoot.',
    relations: ['Push-back', 'Mobbing'],
  }),
  S({
    id: 'leaping_arrow', cls: 'archer', slot: 12, name: 'Binding Leaves', roles: ['hardCC', 'setup'], targeting: 'mouseLine',
    startup: 450, active: 300, recovery: 260, cooldown: 14000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, armor: [0, 750],
    hits: [H(120, 12, { kind: 'line', length: 600, width: 260 }, { hardCC: { kind: 'root', ms: 1600, long: true }, stun: 200 }, { reachUp: 60 })],
    linger: { at: 'origin', startMs: 260, everyMs: 80, count: 40, radius: 0, maxZ: 50, once: true, line: { length: 600, width: 260 }, hit: H(0, 6, { kind: 'circle', radius: 40 }, { hardCC: { kind: 'root', ms: 1200, long: true }, stun: 300, catch: true }, { reachUp: 50 }) }, // the leaves stay on the floor ~3s: whoever lands on them is caught
    cancelOnHit: ['quick_shot', 'multi_shot', 'rain_of_arrows'], telegraph: 'line',
    description: 'Charge briefly, then send a wide band of leaves and vines across the floor: every player and monster on it is bound in place for 1.6s, and the leaves stay on the floor about 3s more — a foe that falls onto them is caught on landing and held 1.2s.',
    relations: ['Quick charge', 'Bind 1.6s'],
  }),
  S({
    id: 'spirit_hawk', cls: 'archer', slot: 13, name: 'Spirit Hawk', roles: ['setup', 'extender'], targeting: 'self',
    startup: 300, active: 100, recovery: 200, cooldown: 30000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 3, { kind: 'circle', radius: 90 }, { stun: 160, push: 10 }, { reachUp: 120 })],
    linger: { at: 'caster', startMs: 1200, everyMs: 2200, count: 10, radius: 360, maxZ: 320, hit: H(0, 16, { kind: 'circle', radius: 40 }, { stun: 300, push: 6, slam: true, juggleCost: 4 }, { reachUp: 320 }) }, // a foe up in the air is slammed onto the floor and bounces back up
    tags: ['buff'],
    description: 'Summons a spirit hawk that roams the sky around you for 20s and every few seconds dives on a foe by itself — its first dive comes soon after the call, its cry and its shadow warn of each strike.',
    relations: ['Summon 20s', 'Attacks alone'],
  }),
  // ---- 4th job (Bowmaster)
  S({
    id: 'sky_rain', cls: 'archer', slot: 7, name: 'Sky Rain', roles: ['ultimate', 'finisher'], targeting: 'self',
    startup: 800, active: 1600, recovery: 400, cooldown: 45000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [
      ...[200, 400, 600, 800, 1000, 1200].map((t) => H(t, 10, { kind: 'circle', radius: 600 }, { stun: 280, float: true, juggleCost: 4 }, { reachUp: 420 })),
      H(1420, 40, { kind: 'circle', radius: 600 }, { stun: 420, knockdown: 'heavy' }, { reachUp: 420, heavy: true }),
    ],
    endsCombo: true, tags: ['ultimate'],
    description: 'The archer races across the screen, then the whole sky pours arrows on every foe in sight; the last wave knocks them all down. Ends the combo.',
    relations: ['Ultimate', 'Whole screen'],
  }),
  S({
    id: 'tree_of_life', cls: 'archer', slot: 14, name: 'Tree of Life', roles: ['setup', 'zone'], targeting: 'self',
    startup: 500, active: 200, recovery: 300, cooldown: 40000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1000],
    hits: [H(0, 4, { kind: 'circle', radius: 140 }, { stun: 260, push: 24 }, { reachUp: 140 })],
    tags: ['buff', 'party'],
    description: 'Plants a great tree of light for 20s. Its aura heals you and every party member standing near it by 1% max HP every second.',
    relations: ['Heal zone 20s', 'Party heal'],
  }),
  S({
    id: 'hunters_spirit', cls: 'archer', slot: 15, name: 'Vine Lash', roles: ['projectile', 'setup'], targeting: 'mouseProjectile', // (the old Hunter's Spirit buff is now her passive: +15% critical rate)
    startup: 160, active: 120, recovery: 200, cooldown: 7000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK, tags: ['farPull'], // her opener from afar: the pull into her traps
    hits: [H(0, 10, { kind: 'projectile', speed: 1100, range: 520, radius: 14, antiAir: true }, { stun: 520, yank: 50, float: true, juggleCost: 6 }, { mark: 1 })],
    cancelOnHit: ['quick_shot', 'rising_arrow', 'retreat_kick', 'multi_shot', 'explosive_arrow', 'bow_haste', 'leaping_arrow', 'arrow_storm'],
    description: 'A thorned vine arrow: it snags the first foe it reaches — even up in the air — and yanks him right back in front of you, held a moment. Bring a foe that flew away back into your traps.',
    relations: ['Pull', 'Air too'],
  }),
  S({
    id: 'arrow_storm', cls: 'archer', arenaDmg: 0.75, slot: 17, name: "Hunter's Rain", roles: ['zone', 'extender'], targeting: 'mouseGround',
    startup: 550, active: 5000, recovery: 300, cooldown: 14000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 550],
    placeRange: 420, // a zone that holds a foe far from her
    hits: Array.from({ length: 25 }, (_, i) => i === 24 ? H(i * 200, 12, { kind: 'placed', radius: 115 }, { stun: 360, launch: 120, juggleCost: 20, slow: { pct: 30, ms: 500 } }, { reachUp: 180, heavy: true, mark: 1 }) // the last volley throws him up
      : H(i * 200, i % 5 === 4 ? 10 : 7, { kind: 'placed', radius: 115 }, { stun: i % 5 === 4 ? 320 : 240, float: true, juggleCost: 4, slow: { pct: 30, ms: 500 } }, { reachUp: 180, ...(i % 5 === 4 ? { mark: 1 } : {}) })), // (every 5th volley hits harder and marks him: the rain has a beat — cut it short and the marks and the throw are lost)
    cancelOnHit: ['quick_shot', 'sky_rain'],
    description: 'Fire dozens of arrows into the sky: for 5s they rain down on a marked spot on the floor (its key again ends the rain), and the direction you hold steers the mark anywhere around you while you stand your ground. The rain has a beat — every 5th volley is a great arrow that marks the foe, and the last one throws him up (cut it short and the beat is lost).',
    relations: ['Rooted', 'Steer the rain'],
  }),
  S({
    id: 'eagle_arrow', cls: 'archer', slot: 16, name: 'Eagle Tide', roles: ['finisher', 'peel'], targeting: 'mouseLine',
    startup: 1200, active: 700, recovery: 400, cooldown: 25000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1900], // the held direction turns it while charging
    hits: [0, 230, 460].map((t, i) => H(t, i === 2 ? 30 : 16, { kind: 'line', length: 1920, width: 320 }, i === 2 ? { stun: 460, launch: 160, push: 90, juggleCost: 30 } : { stun: 300, push: 40, float: true, juggleCost: 8 }, { reachUp: 260, heavy: i === 2 })),
    cancelOnHit: ['sky_rain'], telegraph: 'line', tags: ['wide'], // (the arena: its whole band hits, as wide as the eagles are drawn)
    description: 'Charge, then release a gigantic spirit-eagle tide that sweeps half the map in front of you, tearing through everything in its path.',
    relations: ['Charge 3s', 'Half the map'],
  }),
];
// ------------------------------------------------------------------ SAMURAI
// Ordered like the MapleStory Hayato line (Jobs.ts): crimson steel, cherry blossoms, afterimages and the drawing cut.
const samurai: FinalSkill[] = [
  S({
    id: 'quick_slash', cls: 'samurai', slot: 0, name: 'Quick Slash', roles: ['basic', 'confirm'], targeting: 'aimAssist',
    startup: 75, active: 70, recovery: 100, cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 10, { kind: 'sector', range: 100, angle: 110 }, { stun: 150, push: 3 }, { reachUp: 70 })],
    chain: {
      resetMs: 600,
      stages: [
        [H(0, 9, { kind: 'sector', range: 100, angle: 110 }, { stun: 300, push: 3 }, { reachUp: 70 })],
        [H(0, 9, { kind: 'sector', range: 100, angle: 110 }, { stun: 300, push: 3 }, { reachUp: 70 })],
        [H(0, 6, { kind: 'sector', range: 104, angle: 120 }, { stun: 320, push: 2 }, { reachUp: 80 }),
          H(60, 6, { kind: 'sector', range: 104, angle: 120 }, { stun: 320, push: 4 }, { reachUp: 80 })],
        [H(0, 14, { kind: 'sector', range: 110, angle: 130 }, { stun: 420, launch: 70, juggleCost: 12 }, { reachUp: 110, heavy: true })],
      ],
      timings: [{ startup: 75, active: 70, recovery: 100 }, { startup: 70, active: 70, recovery: 100 }, { startup: 80, active: 120, recovery: 110 }, { startup: 95, active: 90, recovery: 190 }],
    },
    cancelOnHit: ['shadow_step', 'sheathe', 'iai_strike', 'sword_wave'],
    description: 'Four quick cuts: tap or hold Space. Slash, backhand, a cross cut, then a rising cut that lifts the foe — the opening for your skills.',
    relations: ['Hold Space to chain', 'Cancel into skills on hit'],
  }),
  S({
    id: 'shadow_step', cls: 'samurai', slot: 1, name: 'Shadow Step', roles: ['opener', 'chase', 'gapClose'], targeting: 'mouseDir',
    startup: 100, active: 150, recovery: 150, cooldown: 3500, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 200 }, through: true, charges: 2, chargeGap: 200, // (the opener: through a foe at the distance fights open at, ~177 px)
    hits: [H(0, 22, { kind: 'capsule', radius: 28 }, { stun: 300, push: 8 }, { reachUp: 120 })], // (a level cut at chest height: it takes a foe lifted a little, not one two heights up) (the cut as he passes through; then Quick Slash / Swallow Cut / Iai, turned back toward him)
    cancelOnHit: ['quick_slash', 'swallow_cut', 'iai_strike', 'sheathe', 'blossom_storm', 'dragon_eclipse'], telegraph: 'line',
    description: 'Step through the foe in a blink, cutting as you pass, and land behind it facing it — your opener from the distance fights start at. Two steps in a row, then the cooldown.',
    relations: ['Opener: through the foe', 'Cancel → Quick Slash · Swallow · Iai'],
  }),
  S({
    id: 'sheathe', cls: 'samurai', slot: 2, name: 'Sheathe', roles: ['setup'], targeting: 'self',
    startup: 3000, active: 90, recovery: 20, cooldown: 3000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    // a 150 ms stance (its last 10 ms already open to the next cut: no frame of a bare blade between), cancelled into from any hit: the blade snaps home in its sheath with a click — and for 0.6 s after
    // it the next Iai Strike or Quick Slash leaves the sheath at once (SkillRuntime: primes), the Iai one charge level higher
    hits: [], primes: { ids: ['iai_strike', 'quick_slash'], windowMs: 600, chargeUp: 1 },
    // (David 18 Oct 01:15 + the Samurai chat's "the substitute"): held up to 3 s it is his guard — a blow landing on him in it
    // hits a doll in his place and he vanishes (the scene: SUBSTITUTE); a tap is the click as before (startup = the longest hold)
    charge: { minMs: 40, levels: [{ at: 0, hits: [] }] },
    cancelOnHit: ['iai_strike', 'quick_slash'],
    description: 'Tap it: snap the blade home in its sheath with a click — a 150 ms stance you can cancel into from any hit. For 0.6s after it, your next Iai Strike or Quick Slash leaves the sheath at once — no wind-up — and the Iai Strike one charge level higher. Hold it: your guard, up to 3 s — a blow that lands on you in it splits a straw doll in your place, and you vanish in ink for 1.5 s, back when the time runs out or you strike.',
    relations: ['Cancel from any hit', 'Next Iai / Quick Slash: instant', 'Held: a doll takes the blow'],
  }),
  S({
    id: 'iai_strike', cls: 'samurai', slot: 3, name: 'Iai Strike', roles: ['precision', 'finisher'], targeting: 'mouseLine',
    startup: 900, active: 80, recovery: 260, cooldown: 5500, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    tags: ['farDraw'], // (the draw from afar is its design: its shots are no arena poke — they keep their stun / knockdown, as its line did)
    // hold the key: the drawing stance charges (startup = how long it was held, 130..900 ms); the level picks the draw.
    // (DFO 23 Oct, the Samurai chat's ask — David 18 Oct 22:56: "he releases 4 such nice shots": each level shoots 2 / 3 / 4
    //  crescents of blade light 70 ms apart at 1.5 px / ms down the line, each a hit as it passes the foe (a flinch that holds
    //  him in the line), the last the level's blow (its stun / knockdown and push); the level's damage split over them, its
    //  reach the line's: as long, as wide (radius = half the width), up to a foe in the air in front (antiAir); the lock as it was)
    hits: IAI(4, [16, 16, 16, 16], 320, 48, { stun: 460, knockdown: 'heavy', push: 18 }, 140),
    charge: { minMs: 130, levels: [
      { at: 0, hits: IAI(2, [15, 15], 200, 36, { stun: 380, push: 12 }, 120) }, // (the draw from afar: his opener)
      { at: 340, hits: IAI(3, [15, 15, 14], 230, 40, { stun: 420, knockdown: 'light', push: 14 }, 130) },
      { at: 680, hits: IAI(4, [16, 16, 16, 16], 320, 48, { stun: 460, knockdown: 'heavy', push: 18 }, 140) },
    ] },
    cancelOnHit: ['shadow_step', 'sword_wave', 'blossom_storm', 'dragon_eclipse'], // (its reach is drawn by its own charge picture, SkillFx.iai; the draw from afar → Shadow Step through him)
    description: 'Hold the key: your hand on the sheath, your light drawn into it — a glint runs down it at each of three steps. Release: a lightning draw — crescents of blade light shot down the line, two, three or four by how long you held, the cut arriving on the foe in a burst of petals and ink. The longer you held, the farther and harder it cuts; fully charged, every foe in the line crumples to the floor.',
    relations: ['Hold to charge (3 levels)', 'Knockdown'],
  }),
  S({
    id: 'sword_wave', cls: 'samurai', slot: 4, name: 'Sword Wave', roles: ['projectile'], targeting: 'mouseProjectile',
    startup: 150, active: 0, recovery: 180, cooldown: 6000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 26, { kind: 'projectile', speed: 800, range: 380, radius: 18 }, { stun: 230, push: 12, float: true, juggleCost: 15 })],
    // (David 18 Oct 01:15 + the Samurai chat's "the crescent and its shadow"): at its range it turns to ink and its shadow flies
    // back along the line to where he threw it, cutting again and dragging whoever it meets back to him (the scene sets the
    // pull) — a zone of its own 700 ms after the throw, so he is free to go on meanwhile
    linger: { at: 'origin', startMs: 700, everyMs: 1000, count: 1, radius: 0, maxZ: 170, line: { length: 380, width: 56 },
      hit: H(0, 14, { kind: 'line', length: 380, width: 56 }, { stun: 460, pullMs: 300, juggleCost: 8 }, { reachUp: 170 }) },
    cancelOnHit: ['shadow_step', 'blossom_storm'],
    description: 'Fling a crescent of blade light that flies fast and level, petals torn off in its wake, and cuts the foe it meets (a foe in the air is held where it meets him). Where it ends it slows and turns round: a moment later it flies back along the same line to your hand, cutting again and dragging whoever it meets back to your blade. Walls stop it.',
    relations: ['Out and back to your hand', 'Drags him back to you'],
  }),
  S({
    id: 'mirage', cls: 'samurai', slot: 5, name: 'Mirage Counter', roles: ['counter', 'escape'], targeting: 'mouseDir',
    startup: 120, active: 420, recovery: 260, cooldown: 7000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    counter: { window: 260, sidestep: 46, behind: 62 },
    hits: [H(0, 24, { kind: 'sector', range: 96, angle: 140 }, { stun: 320, push: 20, launch: 55, juggleCost: 20 }, { reachUp: 90, heavy: true })],
    cancelOnHit: ['quick_slash', 'shadow_step', 'blossom_storm', 'dragon_eclipse'],
    description: 'Take the counter stance for a moment: a blow that reaches you hits only a mirage — it shatters into ink and petals — and you reappear behind the attacker (if he is close; from afar you only sidestep) with a cut that throws him up. If no blow comes, you are open.',
    relations: ['Counter', 'Launch on counter'],
  }),
  S({
    id: 'blossom_storm', cls: 'samurai', arenaLaunch: 0.6, slot: 6, name: 'Blossom Storm', roles: ['signature', 'chase'], targeting: 'mouseTarget',
    startup: 300, active: 700, recovery: 320, cooldown: 16000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 150 },
    hits: [0, 140, 280, 420, 600].map((t, i) => H(t, [9, 9, 9, 9, 10][i], { kind: 'circle', radius: 92 },
      i === 4 ? { stun: 300, launch: 110, juggleCost: 30 } : { stun: 220, float: true, juggleCost: 8 }, { reachUp: 230, heavy: i === 4 })),
    cancelOnHit: ['dragon_eclipse', 'iai_strike'], tags: ['signature'], telegraph: 'circle', // (the fall → a draw-cut on the fallen foe)
    description: 'Chase the foe as a storm of cherry blossoms and afterimages: five cuts, the last one throws it high into the air.',
    relations: ['Signature', 'Cancel → Dragon Eclipse'],
  }),
  S({
    id: 'dragon_eclipse', cls: 'samurai', slot: 7, name: 'Dragon Eclipse', roles: ['ultimate', 'finisher'], targeting: 'mouseTarget',
    startup: 1350, active: 420, recovery: 520, cooldown: 45000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 120 },
    // eight cuts out of the dark from eight directions hold the foe where it is, then the dragon's colossal cut (62 in all, as before)
    hits: [...Array.from({ length: 8 }, (_, i) => H(i * 34, 4, { kind: 'line', length: 260, width: 90 }, { stun: 300, float: true, juggleCost: 2 }, { reachUp: 240 })),
      H(330, 30, { kind: 'line', length: 190, width: 64 }, { stun: 420, knockdown: 'heavy', push: 26 }, { reachUp: 240, heavy: true })],
    endsCombo: true, tags: ['ultimate'], telegraph: 'line',
    description: 'The world goes dark and a black sun rises. You vanish: eight cuts out of the dark from eight directions — then one colossal cut of the crimson dragon. Heavy knockdown; ends the combo.',
    relations: ['Ultimate', 'Ends combo'],
  }),
  // ---- extended kit (Q R F G C V T H Z X)
  S({
    id: 'swallow_cut', cls: 'samurai', arenaLaunch: 0.5, slot: 8, name: 'Swallow Cut', roles: ['launcher', 'antiAir'], targeting: 'mouseCone',
    startup: 120, active: 220, recovery: 200, cooldown: 3000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 15, { kind: 'sector', range: 104, angle: 110 }, { stun: 420, launch: 150, juggleCost: 30 }, { reachUp: 220 }),
      H(130, 10, { kind: 'sector', range: 108, angle: 120 }, { stun: 340, float: true, juggleCost: 6 }, { reachUp: 240 })],
    cancelOnHit: ['quick_slash', 'shadow_step', 'iai_strike', 'sheathe', 'hundred_cuts', 'falcon_dive', 'tornado_blade'],
    description: 'The blade rises in a crescent that throws the foe into the air, then turns back like a swallow for a second cut while it hangs there.',
    relations: ['Launcher', 'Jump → Hundred Cuts'],
  }),
  S({
    id: 'hundred_cuts', cls: 'samurai', arenaLaunch: 0.6, slot: 9, name: 'Hundred Cuts', roles: ['extender', 'airExtender'], targeting: 'mouseCone',
    startup: 130, active: 1040, recovery: 220, cooldown: 7000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 130], // (armor in the wind-up only)
    hits: [...Array.from({ length: 12 }, (_, i) => H(i * 80, 3, { kind: 'sector', range: 110, angle: 130 }, { stun: 300, float: true, juggleCost: 2 }, { reachUp: 200 })),
      H(1000, 12, { kind: 'sector', range: 118, angle: 140 }, { stun: 420, push: 34, launch: 70, juggleCost: 10 }, { reachUp: 200, heavy: true })],
    cancelOnHit: ['swallow_cut', 'iai_strike', 'sword_wave', 'falcon_dive', 'blossom_storm', 'dragon_eclipse'],
    description: 'A storm of rapid cuts in front of you: twelve strikes in one second hold the foe where it is, in the air too, and the last one blasts it away.',
    relations: ['Air hold', 'Finish → Falcon Dive'],
  }),
  S({
    id: 'kagemusha', cls: 'samurai', slot: 10, name: 'Kagemusha', roles: ['setup'], targeting: 'self',
    startup: 220, active: 80, recovery: 160, cooldown: 18000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 3, { kind: 'circle', radius: 110 }, { stun: 240, push: 16, drop: true }, { reachUp: 120 })], tags: ['buff'], // (a buff: no juggle link — a foe in the air keeps falling)
    description: 'Vanish in a burst of ink and petals: a ring of five shadow doubles stands round the spot, then they scatter and move on their own — running, stopping, closing in on the foe and feinting at it — while you stay hidden among them for 3s (after 1.5s the foe catches a faint flicker of you). Strike and you step out of hiding, the doubles swinging with you (no damage; 30% against monsters). Monsters go after the doubles; a double that is struck bursts into petals. Your first real hit is an AMBUSH: a sure critical and a short stun, and the doubles vanish. If you are struck, they vanish at once.',
    relations: ['5 doubles · hidden 3s', 'Ambush: sure critical + stun'],
  }),
  S({
    id: 'tornado_blade', cls: 'samurai', slot: 11, name: 'Tornado Blade', roles: ['antiAir', 'airExtender'], targeting: 'self',
    startup: 80, active: 330, recovery: 200, cooldown: 0, ground: false, air: true, cover: 'IGNORES_COVER', move: LOCK, // (David 18 Oct 01:15: spam it while jumping, no cooldown)
    // in the air only: he spins into a whirlwind of blades round himself — it meets a foe jumping at him: two cuts hold him
    // there, the third smashes him down to the floor (no pull: it takes only who is there)
    hits: [H(0, 10, { kind: 'circle', radius: 100 }, { stun: 320, float: true, juggleCost: 6 }, { reachUp: 130 }),
      H(110, 10, { kind: 'circle', radius: 100 }, { stun: 320, float: true, juggleCost: 6 }, { reachUp: 130 }),
      H(230, 16, { kind: 'circle', radius: 110 }, { stun: 420, slam: true }, { reachUp: 140, heavy: true })],
    cancelOnHit: ['quick_slash', 'swallow_cut', 'hundred_cuts', 'iai_strike'], telegraph: 'circle',
    description: 'In the air only, no cooldown — spin it as often as your jumps allow: a whirlwind of blades around you. It meets a foe jumping at you — two cuts hold him there, the third smashes him down to the floor.',
    relations: ['Air to air', 'Smash down'],
  }),
  S({
    id: 'falcon_dive', cls: 'samurai', slot: 12, name: 'Falcon Dive', roles: ['gapClose', 'knockdown'], targeting: 'mouseTarget',
    startup: 130, active: 340, recovery: 300, cooldown: 5000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 230, lift: 120, crash: true },
    hits: [H(150, 10, { kind: 'circle', radius: 90 }, { stun: 300, slam: true }, { reachUp: 200 }),
      H(300, 24, { kind: 'circle', radius: 135 }, { stun: 380, launch: 100, juggleCost: 25 }, { reachUp: 220, heavy: true })],
    cancelOnHit: ['quick_slash', 'swallow_cut', 'hundred_cuts', 'tornado_blade', 'blossom_storm', 'sakura_bind'], telegraph: 'circle', // (the slam → the blossoms catch him as he comes down)
    description: 'Leap high and dive like a falcon onto the target: the crimson impact slams airborne foes into the floor and blasts grounded ones up.',
    relations: ['Gap close', 'Pop-up → air chase'],
  }),
  S({
    id: 'rising_sun', cls: 'samurai', slot: 13, name: 'Rising Sun', roles: ['escape'], targeting: 'self',
    startup: 700, active: 200, recovery: 280, cooldown: 60000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // his defensive ultimate: nothing touches him while the sun rises (LegacyCourtyardScene: untouchable from the cast to the
    // end of the burst), and its light throws every foe around him back and holds them a moment (room, a reset)
    hits: [H(0, 8, { kind: 'circle', radius: 170 }, { stun: 420, push: 150, drop: true }, { reachUp: 200 })],
    cancelOnHit: ['quick_slash', 'shadow_step', 'iai_strike', 'sheathe'],
    description: 'Your defensive ultimate: raise the banner of the Rising Sun. While the sun rises behind you nothing can touch you, and its light throws every foe around you back and holds them a moment. Its banner then stays planted where it rose for 25 s: come down on its pole from a jump — anywhere in the ring of light round its foot — and it springs you far back.',
    relations: ['Untouchable while it rises', 'Throws foes back', 'The banner springs you back'],
  }),
  S({
    id: 'phantom_blades', cls: 'samurai', slot: 14, name: 'Phantom Blades', roles: ['zone'], targeting: 'mouseCone',
    startup: 420, active: 640, recovery: 340, cooldown: 18000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 420],
    hits: [...[0, 80, 160, 240, 320, 400, 480].map((t) => H(t, 7, { kind: 'circle', radius: 140, at: 'aimBias', bias: 150 }, { stun: 400, float: true, juggleCost: 3 }, { reachUp: 160 })),
      H(600, 22, { kind: 'circle', radius: 146, at: 'aimBias', bias: 150 }, { stun: 420, float: true, juggleCost: 4 }, { reachUp: 160, heavy: true })], // (a zone: no lift at the end — not a combo's finisher)
    cancelOnHit: ['blossom_storm', 'dragon_eclipse'], telegraph: 'circle',
    description: 'Draw once, and phantom blades fill the field in front of you: eight cuts on every foe who stands in it — ground to hold, not a finisher.',
    relations: ['Zone', 'Cancel → Blossom Storm'],
  }),
  S({
    id: 'god_of_blades', cls: 'samurai', slot: 15, name: 'God of Blades', roles: ['setup', 'zone'], targeting: 'self',
    startup: 600, active: 200, recovery: 260, cooldown: 60000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1060],
    hits: [H(0, 10, { kind: 'circle', radius: 170 }, { stun: 360, push: 40 }, { reachUp: 160 })],
    // every second two of the halo's blades fly at the nearest foes, each one spent (eight in all; LegacyCourtyardScene: bladeStrikes)
    linger: { at: 'caster', startMs: 600, everyMs: 1000, count: 30, radius: 220, maxZ: 220, hit: H(0, 6, { kind: 'circle', radius: 220 }, { stun: 300, float: true }, { reachUp: 220 }) },
    cancelOnHit: ['quick_slash', 'blossom_storm', 'dragon_eclipse'], tags: ['buff', 'party'],
    description: 'Eight spectral katanas rise behind you for 30s: +15% damage, and every second two of them fly at the nearest foes on their own — each one that flies is spent, eight strikes in all. In a party, every party member near you shares the +15% — the mark of the halo turns over their heads while it lasts.',
    relations: ['Buff 30s · party', 'Blades strike on their own'],
  }),
  S({
    id: 'sakura_bind', cls: 'samurai', slot: 16, name: 'Sakura Bind', roles: ['hardCC', 'pull', 'setup'], targeting: 'mouseGround',
    startup: 240, active: 160, recovery: 220, cooldown: 12000, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 90, snapPlace: true, // (opened just in front of him, on his line: the arena places it ahead, never under the foe — in a combo the foe is that close)
    // (David 18 Oct 18:29: "the moment he touches it the pink leaves attack him and lock him inside for a few seconds") the
    // ring locks whoever it catches 2.5 s — a full hold — when it opens, and as a trap after
    hits: [H(0, 8, { kind: 'circle', at: 'place', radius: 125, floor: true }, { stun: 400, pull: 70, catch: true, hardCC: { kind: 'stun', ms: 2500, long: true } }, { reachUp: 60 })], // (on the floor only — the arena's reach no longer lifts it into the air: a foe up there falls into the blossoms instead and is caught as he lands)
    // the trap (DFO): the blossoms stay on the floor 6 s — the first foe to touch them (walking in, or coming down into them
    // from a slam, a fall) is pulled to the centre and locked 2.5 s; one catch a foe, and not one the opening already held
    linger: { at: 'place', startMs: 60, everyMs: 60, count: 100, radius: 125, maxZ: 50, once: true, fresh: true,
      hit: H(0, 6, { kind: 'circle', radius: 125 }, { stun: 420, pull: 70, catch: true, hardCC: { kind: 'stun', ms: 2500, long: true } }, { reachUp: 50 }) },
    cancelOnHit: ['quick_slash', 'shadow_step', 'hundred_cuts', 'tornado_blade', 'iai_strike', 'dragon_ascension', 'swallow_cut'], telegraph: 'ground',
    description: 'A ring of cherry blossoms opens on the floor just in front of you: every foe in it is pulled to its centre and locked in a whirl of pink leaves for 2.5s. The ring stays on the floor 6s as a trap: the first foe to touch it — walking in, or falling into it — is pulled in and locked too. Ready for your cuts.',
    relations: ['Pull + lock 2.5s', 'A trap for 6s'],
  }),
  S({
    id: 'dragon_ascension', cls: 'samurai', slot: 17, name: 'Dragon Ascension', roles: ['antiAir'], targeting: 'self',
    startup: 260, active: 600, recovery: 300, cooldown: 14000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 260],
    // the anti-air from the floor: the dragon rising from his blade strikes a foe jumping at him out of the air — smashed
    // down, a fall and a bounce to cut him on; a foe on the floor only reels (it lifts no one: Swallow Cut is the launcher)
    hits: [H(0, 26, { kind: 'circle', radius: 120 }, { stun: 460, slam: true }, { reachUp: 300, heavy: true })],
    cancelOnHit: ['quick_slash', 'swallow_cut', 'hundred_cuts', 'iai_strike', 'dragon_eclipse'], telegraph: 'circle',
    description: 'The anti-air: a golden dragon spirals up from your blade and strikes a foe jumping at you out of the air — he crashes to the floor and bounces, open to your cuts. A foe on the floor only reels.',
    relations: ['Anti-air', 'Smash down'],
  }),
];

// ------------------------------------------------------------------ GAMBLER
// The card-sharp of the casino (Jobs.ts): a battle staff and playing cards charged with kinetic energy. `stick`: charged
// cards a hit leaves in the foe (they burst a beat later); `fuse`: a staff blow that sets them off at once (Gamble.ts).
// Every skill that lands deals a card to his Hand; Showdown plays the Hand (its rank decides the blow).
const gambler: FinalSkill[] = [
  S({
    id: 'cut_the_deck', cls: 'gambler', slot: 0, name: 'Cut the Deck', roles: ['basic', 'confirm'], targeting: 'aimAssist',
    startup: 80, active: 80, recovery: 110, cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 10, { kind: 'sector', range: 96, angle: 90 }, { stun: 300, push: 4 }, { reachUp: 70, fuse: true })],
    chain: {
      resetMs: 650,
      stages: [
        [H(0, 9, { kind: 'line', length: 120, width: 40 }, { stun: 300, push: 4 }, { reachUp: 70, fuse: true })],              // the jab
        [H(0, 9, { kind: 'sector', range: 100, angle: 130 }, { stun: 300, push: 3 }, { reachUp: 80, fuse: true })],            // the back swing
        [H(0, 4, { kind: 'projectile', speed: 760, range: 300, radius: 12, count: 2, spread: 8 }, { stun: 320, push: 2 }, { reachUp: 80, stick: 1 })], // two cards
        [H(0, 14, { kind: 'sector', range: 104, angle: 120 }, { stun: 420, launch: 72, juggleCost: 12 }, { reachUp: 110, heavy: true, fuse: true })], // the rising swing
      ],
      timings: [{ startup: 80, active: 80, recovery: 110 }, { startup: 80, active: 90, recovery: 110 }, { startup: 70, active: 60, recovery: 110 }, { startup: 100, active: 100, recovery: 200 }],
    },
    cancelOnHit: ['staff_vault', 'fuse_slam', 'charged_deal'],
    description: 'Four quick moves: tap or hold Space. A staff jab, a back swing, two charged cards flicked forward, then a rising swing that lifts the foe. Every staff blow sets off the cards stuck in it.',
    relations: ['Hold Space to chain', 'Staff sets off stuck cards'],
  }),
  S({
    id: 'charged_deal', cls: 'gambler', slot: 1, name: 'Charged Deal', roles: ['opener', 'projectile'], targeting: 'mouseCone',
    startup: 520, active: 120, recovery: 200, cooldown: 2600, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK, // (startup = the longest hold: a tap still throws at 120 ms)
    hits: [H(0, 12, { kind: 'projectile', speed: 540, range: 560, radius: 13, count: 3, spread: 7, rows: 3, rowGap: 22 }, { stun: 300, push: 6 }, { reachUp: 90, stick: 1 })], // (David 18 Oct 01:42: "fast" — the cards fly 540 px/s, were 720)
    charge: { minMs: 120, levels: [
      { at: 0, hits: [H(0, 12, { kind: 'projectile', speed: 720, range: 560, radius: 13, count: 3, spread: 7, rows: 3, rowGap: 22 }, { stun: 300, push: 6 }, { reachUp: 90, stick: 1 })] },
      { at: 520, hits: [H(0, 12, { kind: 'projectile', speed: 760, range: 600, radius: 13, count: 5, spread: 6, rows: 3, rowGap: 22 }, { stun: 320, push: 8 }, { reachUp: 90, stick: 3 })] }, // (the max bet: a fan counts once on a foe — the full hold sticks three)
    ] },
    cancelOnHit: ['staff_vault', 'grand_slam', 'staff_flurry'], telegraph: 'cone',
    description: 'A fan of three charged cards across the whole floor — one sticks in the foe; hold the key for five, and three stick. Stuck cards wait: your next staff blow sets them off, or All In throws him up by their number (alone they fizzle out).',
    relations: ['Cards stick', 'Hold: 5 cards, 3 stick'],
  }),
  S({
    id: 'staff_vault', cls: 'gambler', arenaDmg: 1.15, slot: 2, name: 'Staff Vault', roles: ['gapClose', 'launcher', 'escape'], targeting: 'mouseTarget', // locks the foe ahead: the vault comes down on him, not past him
    startup: 120, active: 340, recovery: 200, cooldown: 4000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 220, lift: 110, crash: true },
    hits: [H(40, 6, { kind: 'capsule', radius: 30 }, { stun: 340, push: 2 }, { reachUp: 150 }), // (balance: the staff catches whoever it vaults through — the opener lands from the distance fights open at)
      H(220, 8, { kind: 'circle', radius: 80 }, { stun: 300, push: 6 }, { reachUp: 150, fuse: true }),
      H(300, 14, { kind: 'circle', radius: 90 }, { stun: 420, launch: 95, juggleCost: 16 }, { reachUp: 160, heavy: true, fuse: true })],
    cancelOnHit: ['rotor_staff', 'showdown', 'riffle_shuffle', 'staff_flurry'], telegraph: 'line',
    description: 'Plant the staff and vault over in a long arc, landing in a double kick that lifts the foe. Aim backwards to vault away.',
    relations: ['Gap close / escape', 'Launcher'],
  }),
  S({
    id: 'fuse_slam', cls: 'gambler', arenaDmg: 1.15, slot: 3, name: 'Fuse Slam', roles: ['knockdown', 'setup', 'launcher'], targeting: 'mouseCone',
    startup: 260, active: 120, recovery: 260, cooldown: 5500, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 16, { kind: 'circle', radius: 100, at: 'aimBias', bias: 70 }, { stun: 420, slam: true, push: 6 }, { reachUp: 140, heavy: true, fuse: true })],
    // the charged floor erupts 0.8s later under whoever stands on it
    linger: { at: 'aim', offset: 70, startMs: 800, everyMs: 1000, count: 1, radius: 115, maxZ: 40, hit: H(0, 18, { kind: 'circle', radius: 115 }, { stun: 460, launch: 120, juggleCost: 20 }, { reachUp: 60, heavy: true }) },
    cancelOnHit: ['staff_flurry', 'grand_slam'], telegraph: 'circle',
    description: 'Slam the staff into the floor: a foe in the air is smashed down, and the floor stays charged — 0.8s later it erupts and throws up whoever stands on it.',
    relations: ['Smash down', 'Floor erupts 0.8s later'],
  }),
  S({
    id: 'riffle_shuffle', cls: 'gambler', slot: 4, name: 'Riffle Shuffle', roles: ['pull', 'zone', 'extender'], targeting: 'self',
    startup: 160, active: 900, recovery: 220, cooldown: 7000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 900],
    hits: [...Array.from({ length: 7 }, (_, i) => H(i * 110, 4, { kind: 'circle', radius: 150 }, { stun: 320, pull: 26, float: true, juggleCost: 3 }, { reachUp: 160 })),
      H(820, 12, { kind: 'circle', radius: 170 }, { stun: 400, push: 10 }, { reachUp: 170, heavy: true, stick: 2 })],
    cancelOnHit: ['showdown', 'grand_slam'],
    description: 'A ring of cards shuffles round you like a deck in a dealer\'s hands: it pulls nearby foes in and cuts them again and again, then the cards spread out and stick in everyone around.',
    relations: ['Pull', 'Sticks 2 cards'],
  }),
  S({
    id: 'rotor_staff', cls: 'gambler', arenaDmg: 1.15, slot: 5, name: 'Rotor Staff', roles: ['extender', 'airExtender'], targeting: 'mouseCone',
    startup: 120, active: 1500, recovery: 220, cooldown: 7500, ground: true, air: true, cover: 'IGNORES_COVER', move: { startup: 0, active: 0.5, recovery: 0 },
    // the spinning staff throws charged cards out of its circle nonstop: every second blow sticks one more card in the foe;
    // the last blow (a staff thrust) drives one more in — All In sets them off
    hits: [...Array.from({ length: 14 }, (_, i) => H(i * 100, 3, { kind: 'sector', range: 150, angle: 80 }, { stun: 300, float: true, juggleCost: 2 }, { reachUp: 190, stick: i % 2 ? 1 : undefined })),
      H(1440, 14, { kind: 'sector', range: 130, angle: 120 }, { stun: 420, push: 15, juggleCost: 10 }, { reachUp: 190, heavy: true, stick: 1 })],
    cancelOnHit: ['grand_slam', 'riffle_shuffle'],
    description: 'Spin the staff in front of you like a propeller for 1.5s while you walk on: its circle throws charged cards nonstop, holding the foe where it is (in the air too) and sticking card after card in it — then the last blow, a staff thrust, drives one more in and throws it away. All In sets them all off.',
    relations: ['Cards nonstop', 'Fills him with cards (5)'],
  }),
  S({
    id: 'showdown', cls: 'gambler', arenaDmg: 1.15, slot: 6, name: 'Showdown', roles: ['signature', 'finisher'], targeting: 'mouseLine',
    startup: 360, active: 520, recovery: 300, cooldown: 9000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 880],
    // five cards turn over in a row and burst one by one (Gamble.ts: the Hand's rank sets the damage and the bonus)
    hits: [0, 100, 200, 300, 400].map((t, i) => H(t, i === 4 ? 16 : 8, { kind: 'line', length: 330, width: 80 }, { stun: 420, float: i < 4, launch: i === 4 ? 60 : undefined, juggleCost: i === 4 ? 14 : 4 }, { reachUp: 160, heavy: i === 4 })),
    cancelOnHit: ['grand_slam'], telegraph: 'line', endsCombo: false,
    description: 'Show your Hand: the cards fly from your shoulder, stand in a row before the foe and turn over one by one, each one bursting. The better the Hand, the harder it hits — a Pair, a Flush, a Full House... a Royal Flush. At least 2 cards.',
    relations: ['Plays the Hand', 'Royal Flush ×3.2'],
  }),
  S({
    id: 'coin_flip', cls: 'gambler', slot: 8, name: 'Coin Flip', roles: ['setup'], targeting: 'self',
    startup: 420, active: 120, recovery: 200, cooldown: 25000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [], tags: ['buff', 'party'],
    cancelOnHit: [],
    description: 'Flip a gold coin. Heads: +20% critical rate for 15s. Tails: your next skill comes with no cooldown, and +15% attack speed for 15s. It always deals a heart to your Hand. In a party, members near you share it.',
    relations: ['Heads: +20% crit', 'Tails: next skill free'],
  }),
  S({
    id: 'roulette_wheel', cls: 'gambler', slot: 9, name: 'Roulette Wheel', roles: ['zone', 'hardCC'], targeting: 'mouseGround',
    startup: 260, active: 2100, recovery: 260, cooldown: 14000, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 320,
    // the ball spins 2s (foes in the wheel are slowed); then red: a blast that lifts, black: a 2s bind (Gamble.ts picks it)
    hits: [...[0, 500, 1000, 1500].map((t) => H(t, 3, { kind: 'placed', radius: 150 }, { stun: 200, slow: { pct: 40, ms: 600 } }, { reachUp: 60 })),
      H(2000, 30, { kind: 'placed', radius: 160 }, { stun: 460, launch: 130, juggleCost: 20 }, { reachUp: 80, heavy: true })],
    cancelOnHit: ['staff_vault'], telegraph: 'ground',
    description: 'A BET ON THE REACTION — A giant roulette wheel opens on the floor where you aim; the ball spins for 2s and every foe in the wheel is slowed. Where it stops: RED — a great blast throws them all up; BLACK — everyone in it is bound for 2s. DOUBLE OR NOTHING: press again within 0.4 s to throw again — but if the new throw is worse, you are stunned 0.6 s.',
    relations: ['Slow 2s', 'Red: launch · Black: bind'],
  }),
  S({
    id: 'dice_bomb', cls: 'gambler', slot: 10, name: 'Dice Bomb', roles: ['zone', 'projectile'], targeting: 'mouseDir',
    startup: 300, active: 700, recovery: 220, cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // two dice roll along the floor and burst; the sum sets the size (Gamble.ts), a double bursts twice and stuns
    hits: [H(560, 14, { kind: 'circle', radius: 120, at: 'aimBias', bias: 140 }, { stun: 400, push: 40 }, { reachUp: 90, heavy: true }),
      H(640, 14, { kind: 'circle', radius: 120, at: 'aimBias', bias: 195 }, { stun: 400, push: 40, launch: 50 }, { reachUp: 90, heavy: true })],
    cancelOnHit: ['staff_vault'], telegraph: 'line',
    description: 'A BET ON DAMAGE — Roll two glowing dice along the floor: they tumble forward and burst. The higher the roll (2 to 12), the harder the blast hits (×0.64 to ×1.36); the reaction never changes. DOUBLE OR NOTHING: press again within 0.4 s to throw again — but if the new throw is worse, you are stunned 0.6 s.',
    relations: ['Damage by the roll', 'Double or Nothing'],
  }),
  S({
    id: 'light_staff', cls: 'gambler', slot: 11, name: 'Light Staff', roles: ['setup'], targeting: 'self',
    startup: 250, active: 60, recovery: 150, cooldown: 35000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, // (DFO 23 Oct: lit 25 s — David 18 Oct 23:01 — so its cooldown 20 → 35 s: lit about 70% of the fight, never always)
    // (David 18 Oct 01:42; the Gambler chat's shape): a thin violet blade of light slides out of the cane's tip — for 25 s every
    // staff blow reaches ×1.7 (the scene's reachMul: LIGHT_STAFF) and Staff Flurry opens; no hit of its own
    hits: [], tags: ['buff'],
    cancelOnHit: [],
    description: 'Run your palm along the cane: a thin violet blade of light slides out of its tip. For 25s every staff blow reaches 70% further — the staff strikes of Cut the Deck, Staff Vault, Rotor Staff, Grand Slam, Staff Flurry — and Staff Flurry opens.',
    relations: ['Staff reach ×1.7 (25s)', 'Opens Staff Flurry'],
  }),
  S({
    id: 'ace_in_the_hole', cls: 'gambler', slot: 12, name: 'Ace in the Hole', roles: ['precision', 'projectile'], targeting: 'mouseProjectile',
    startup: 300, active: 0, recovery: 220, cooldown: 7000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, // (balance: 420 → 300, a usable opener)
    hits: [H(0, 34, { kind: 'projectile', speed: 1100, range: 700, radius: 22, pierce: true }, { stun: 460, push: 30 }, { reachUp: 100, heavy: true, stick: 2 })],
    // where its flight ends, the ace stops, spins and blows up (0.64s of flight + its spin)
    linger: { at: 'aim', offset: 700, startMs: 750, everyMs: 1000, count: 1, radius: 130, maxZ: 140, hit: H(0, 26, { kind: 'circle', radius: 130 }, { stun: 460, launch: 110, juggleCost: 18 }, { reachUp: 140, heavy: true }) },
    cancelOnHit: ['rotor_staff', 'showdown'], telegraph: 'line',
    description: 'One great ace, charged between two fingers and thrown like a lance: it tears straight through every foe in the line, sticking in each with a double charge — then stops dead at the end of its flight, spins and blows up, throwing everyone there into the air. It always deals an Ace to your Hand.',
    relations: ['Pierces', 'Always an Ace'],
  }),
  S({
    id: 'long_guard', cls: 'gambler', slot: 13, name: 'Long Guard', roles: ['counter', 'escape'], targeting: 'self',
    startup: 120, active: 2600, recovery: 260, cooldown: 9000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // (David 18 Oct 01:42; the Gambler chat's shape): held — he stands in a guard while the key is held (up to 2.5 s); a blow
    // that reaches him in it is caught: the cards snap out along the line to the striker and stun him 1.2 s (no damage to him);
    // the guard ends on release, at its longest, or after the catch (the scene: LONG_GUARD)
    counter: { window: 2500, sidestep: 0, behind: 0 },
    hits: [H(0, 6, { kind: 'line', length: 420, width: 70 }, { hardCC: { kind: 'stun', ms: 1200, long: true }, stun: 300 }, { reachUp: 180, heavy: true })],
    cancelOnHit: ['grand_slam', 'staff_vault', 'charged_deal'],
    description: 'Hold the key: you stand in a long guard, cane across your body, cards fanned in your other hand. A blow that reaches you in it is caught — the cards snap out to the striker and stun him for 1.2s; the guard ends when you let go, after 2.5s, or after the catch.',
    relations: ['Held guard (2.5s)', 'Stuns the striker 1.2s'],
  }),
  S({
    id: 'pickup_52', cls: 'gambler', slot: 14, name: '52 Pickup', roles: ['zone', 'finisher'], targeting: 'mouseCone',
    startup: 380, active: 900, recovery: 300, cooldown: 16000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1280],
    hits: [H(0, 6, { kind: 'sector', range: 420, angle: 70 }, { stun: 360, float: true, juggleCost: 4 }, { reachUp: 160 }),
      // the cards stuck in the floor go off in a wave, near to far; the last one lifts
      ...[250, 400, 550, 700].map((t, i) => H(t, i === 3 ? 18 : 9, { kind: 'circle', radius: 120, at: 'aimBias', bias: 90 + i * 95 }, { stun: 400, float: i < 3, knockdown: i === 3 ? 'heavy' : undefined, juggleCost: i === 3 ? 18 : 5 }, { reachUp: 150, heavy: i === 3 }))],
    cancelOnHit: ['showdown', 'grand_slam'], telegraph: 'cone',
    description: 'THE DETONATION FINISHER — every card stuck in the foes goes off in the last wave: its damage grows with each card (no card in them: a small wave). Sweep the deck along the floor in a cone ahead, then the wave runs from near to far.',
    relations: ['Wide zone', 'Sets off all cards'],
  }),
  S({
    id: 'grand_slam', cls: 'gambler', slot: 15, name: 'Grand Slam', roles: ['finisher', 'knockdown'], targeting: 'mouseCone',
    startup: 420, active: 140, recovery: 320, cooldown: 11000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 560],
    // (David 18 Oct 18:40: "like a golfer's stroke — a blow that sends him into the air, backwards") a drive: he flies high
    // (~185 px at the top) and far (440 px) before he crashes down
    hits: [H(0, 46, { kind: 'sector', range: 150, angle: 120 }, { stun: 520, push: 300, launch: 40, knockdown: 'heavy', fly: { vz: 640, dist: 440 }, juggleCost: 30 }, { reachUp: 200, heavy: true, fuse: true })],
    cancelOnHit: ['staff_flurry'], telegraph: 'cone',
    description: 'THE WALL FINISHER — The staff grows to twice its length and you swing it like a bat: you drive the foe like a golf ball: he flies high and far back on a comet\'s tail and crashes into the floor or a wall. It sets off every card stuck in it at once.',
    relations: ['Sends far', 'Sets off all cards'],
  }),
  S({
    id: 'staff_flurry', cls: 'gambler', slot: 16, name: 'Staff Flurry', roles: ['extender', 'finisher'], targeting: 'mouseCone',
    startup: 160, active: 3000, recovery: 320, cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 600],
    // (David 18 Oct 01:42; the Gambler chat's shape): only while Light Staff is on (the scene's gate) — 3 s of staff blows, one
    // every 110 ms holding him where he is, every 5th heavier, the last a big rising swing that throws him
    hits: [...Array.from({ length: 26 }, (_, i) => H(i * 110, i % 5 === 4 ? 5 : 2, { kind: 'sector', range: 110, angle: 100 }, { stun: 300, float: true, juggleCost: 2 }, { reachUp: 170, heavy: i % 5 === 4, fuse: i % 5 === 4 })),
      H(2860, 12, { kind: 'sector', range: 120, angle: 120 }, { stun: 420, launch: 110, juggleCost: 14 }, { reachUp: 190, heavy: true, fuse: true })],
    cancelOnHit: ['grand_slam', 'jackpot'], telegraph: 'cone',
    description: 'Only while Light Staff is on: spin and jab the lengthened cane in front of you nonstop for 3s — a blow every tenth of a second holds the foe where he is, every fifth one lands heavier and sets off his cards — then a great rising swing throws him.',
    relations: ['Needs Light Staff', '3s flurry'],
  }),
  S({
    id: 'card_swap', cls: 'gambler', slot: 17, name: 'Card Swap', roles: ['mobility', 'escape', 'trap'], targeting: 'mouseDir',
    startup: 60, active: 90, recovery: 120, cooldown: 6000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 210 }, charges: 2, chargeGap: 260,
    hits: [],
    // the card he leaves where he stood: a charged bomb that goes off 0.45s later
    linger: { at: 'origin', startMs: 450, everyMs: 1000, count: 1, radius: 110, maxZ: 120, hit: H(0, 16, { kind: 'circle', radius: 110 }, { stun: 400, launch: 80, juggleCost: 14 }, { reachUp: 120, heavy: true }) },
    cancelOnHit: ['staff_vault'],
    description: 'Flick a card and swap places with it in a flash — up to 210 px, any direction, in the air too; twice in a row. The card left where you stood is charged: 0.45s later it blows up whoever chased you there. When the bomb catches a foe, Staff Vault comes out at once on him: the way back into a combo.',
    relations: ['2 swaps in a row', 'Leaves a card bomb'],
  }),
  S({
    id: 'call_the_deck', cls: 'gambler', slot: 18, name: 'Call the Deck', roles: ['launcher', 'projectile', 'extender'], targeting: 'mouseProjectile',
    startup: 420, active: 200, recovery: 300, cooldown: 9000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    // (the gather is the startup: his cards on the floor within 700 px fly back into his hand — the scene counts them at the
    // press and sets the hold's turns: 2 + one per card, at most 15 — they fuse into one big card thrown like a saw blade)
    hits: [H(0, 10, { kind: 'projectile', speed: 950, range: 640, radius: 18, antiAir: true, pierce: true }, { stun: 420, launch: 110, juggleCost: 14 }, { heavy: true })],
    // the big card dives under the first foe it cut and keeps spinning there, following him, holding him up; then back to the hand
    linger: { at: 'target', startMs: 160, everyMs: 300, count: 10, radius: 60, maxZ: 400, // (David 18 Oct 01:42: the card spins under him at least 3 s, juggling him on it)
      hit: H(0, 3, { kind: 'circle', radius: 60 }, { stun: 300, float: true, holdZ: 140, juggleCost: 3 }), // (David 18:40: held well above the card, not on it)
      last: H(0, 8, { kind: 'circle', radius: 60 }, { stun: 420, launch: 70, juggleCost: 10 }, { heavy: true }) },
    cancelOnHit: ['grand_slam'], telegraph: 'line',
    description: 'Call your deck home: every card of yours lying on the floor within 700 px flies back into your hand and they fuse into one big charged card. Throw it like a saw blade — it cuts through every foe in its line and pops them up — then it dives under the first one and spins there, holding him up: two turns, and one more for every card you gathered (15 at most). Charged Deal, Cut the Deck\'s flick, Rotor Staff, Riffle Shuffle and 52 Pickup leave cards on the floor.',
    relations: ['Gathers the floor deck', '+1 turn per card'],
  }),
  S({
    id: 'jackpot', cls: 'gambler', slot: 7, name: 'Jackpot', roles: ['ultimate', 'finisher'], targeting: 'self',
    startup: 900, active: 1300, recovery: 400, cooldown: 60000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 2600],
    // a slot machine stops on 7 · 7 · 7: coins and chips burst in eight blasts round you, the last one smashes them down
    hits: [...Array.from({ length: 7 }, (_, i) => H(i * 150, 12, { kind: 'circle', radius: 300 }, { stun: 460, float: true, juggleCost: 4 }, { reachUp: 320 })),
      H(1150, 60, { kind: 'circle', radius: 330 }, { stun: 600, knockdown: 'heavy', slam: true }, { reachUp: 320, heavy: true })],
    cancelOnHit: ['grand_slam', 'staff_flurry'], endsCombo: true, telegraph: 'circle',
    description: 'Call the JACKPOT: your picture crosses the screen, the world goes dark and a giant slot machine spins behind the foes — 7 · 7 · 7. Coins and chips burst in eight blasts all round you, the last one smashing everyone down.',
    relations: ['Ultimate', 'Always 7 · 7 · 7'],
  }),
];

// (Warrior skills once ran stretched outside the arena — slower — and at base pace inside it. A skill is the same
// everywhere now: the base pace in the open game and in PvP alike.)
/** The combat pace and reach of every skill — in the open game and in PvP alike (a skill is the same everywhere), the same rules for every class (the duel is about how many skills you string,
 *  so every class strings them at the same rhythm):
 *  - the one pace (David 2 Nov: "the skills run very fast"): every class skill's wind-up, strike, hit spacing and recovery
 *    run PACE× its kit numbers — the basic chain, buffs, traps and counters too; a held charge's wind-up keeps its length
 *    (the hold is the player's), and so do the actives David timed himself (OWN_LENGTH). A multi-hit skill plays its whole
 *    length (until 2 Nov the arena squeezed one of 4+ hits into 700 ms, down to half its length: Air Volley, slowed for
 *    David on 18 Oct, ran faster than before it);
 *  - a combo skill cancelled into from a confirmed hit strikes within ARENA_FLOW.startup × PACE ms (an ultimate within
 *    ARENA_FLOW.ultStartup × PACE); from neutral a skill keeps its own wind-up, so big moves stay readable;
 *  - (no blanket height: each hit reaches as high as its own attack does — its `reachUp` over the caster's feet, a
 *    projectile rises to a foe in the air only when its shape is antiAir. David: a foe high above a horizontal swing
 *    must not be hit by it. Until 17 Oct every hit reached 240 px and every shot rose to an airborne foe). */
export const ARENA_FLOW = { startup: 160, ultStartup: 400,
  /** DFO's neutral (PvP engine audit): an attack hits only within `depth` px of its own line on the floor (+ the target's
   *  radius), so a step up / down out of its line dodges it; ultimates, zones, traps and ground-placed skills keep their area.
   *  (The effects stay as wide as they are drawn.) */
  depth: 34,
  /** A committed skill that misses leaves its caster open this much longer (and can be cancelled only from a hit). */
  whiffMs: Math.round(150 * PACE),
  /** A shot that lands from farther than this (px; not a combo follow-up) is a poke: a short flinch, no lift, no cancel —
   *  DFO: a poke from afar is a guess with a small reward, the combo starts up close. */
  pokeRange: 150, pokeStun: 140 };
/** Keeps its full area in the arena: ultimates, traps, ground-placed skills, big area bursts (radius ≥ 150). (A chain finds
 *  its first foe only near its line.) */
export const arenaWide = (s: FinalSkill): boolean => s.slot === 7 || !!s.trap || s.tags.includes('wide')
  || s.hits.some((h) => h.shape.kind === 'placed' || (h.shape.kind === 'circle' && (h.shape.at === 'place' || h.shape.radius >= 150)));
/** A committed attack: missing it is punished in the arena (not the basic chain, projectiles, counters, zones, set-ups, escapes). */
export const arenaCommits = (s: FinalSkill): boolean => s.slot > 0 && !s.chain && !s.counter && !arenaWide(s) && !s.hits.some((h) => h.shape.kind === 'projectile')
  && !s.roles.some((r) => r === 'setup' || r === 'mobility' || r === 'escape') && s.hits.some((h) => h.damage > 0);
const isArenaBuff = (s: FinalSkill): boolean => s.tags.includes('buff') || (s.slot !== 7 && s.cooldown >= 20000 && s.roles.every((r) => ['setup', 'zone', 'mobility', 'escape', 'pull'].includes(r)));
/** A hit's place in its skill's list (-1: none). The arena runs re-timed copies of a skill's hits (SkillRuntime.start), so
 *  a copy is matched to its original by its time — at the arena's pace or its own — and its damage. */
export function hitIndex(s: FinalSkill, hit: HitEvent): number {
  const i = s.hits.indexOf(hit);
  if (i >= 0) return i;
  const k = arenaTimeScale(s)?.at ?? 1;
  let found = -1;
  s.hits.forEach((h, j) => { if (h.damage === hit.damage && (Math.abs(Math.round(h.at * k) - hit.at) <= 1 || h.at === hit.at)) found = j; });
  return found;
}
/** The last blow of a burst (a skill of more than three hits, not a chain): the main hit of the feel rules. */
export const lastOfBurst = (s: FinalSkill, hit: HitEvent): boolean => !s.chain && s.hits.length > 3 && hitIndex(s, hit) === s.hits.length - 1;

export function arenaTimeScale(s: FinalSkill, followUp = false): { startup: number; active: number; recovery: number; at: number; reach?: number; antiAir?: boolean; depth?: number } | null {
  const own = OWN_LENGTH.has(s.id);
  const w = { startup: s.charge ? 1 : PACE, active: own ? 1 : PACE, recovery: PACE, at: own ? 1 : PACE };
  const dmg = s.hits.filter((h) => h.damage > 0);
  const combat = !s.chain && !s.charge && !s.counter && !s.trap && !isArenaBuff(s) && dmg.length > 0;
  let fs = 1;
  if (combat && !own && followUp) {
    const cap = s.slot === 7 ? ARENA_FLOW.ultStartup : ARENA_FLOW.startup;
    if (s.startup > cap) fs = cap / s.startup; // (a skill opened from neutral keeps its own wind-up — an ultimate too: readable, the foe can step out of it; cancelled into from a hit, it comes out at once)
  }
  const hitsAny = s.chain ? s.chain.stages.flat() : s.charge ? s.charge.levels.flatMap((l) => l.hits) : s.hits;
  const reach = !isArenaBuff(s) && !s.trap && hitsAny.some((h) => h.damage > 0) && !arenaWide(s) ? { depth: ARENA_FLOW.depth } : {}; // (charged / counter skills too; the height each hit reaches is its own)
  if (fs === 1 && w.startup === 1 && w.active === 1 && w.recovery === 1 && w.at === 1 && !('depth' in reach)) return null;
  return { startup: w.startup * fs, active: w.active, recovery: w.recovery, at: w.at, ...reach };
}
/** A moment of a skill's own timeline (ms from its cast, as the kit gives it) at the pace it plays (cast from neutral):
 *  where its super armor ends, say. */
export function paceTime(s: FinalSkill, t: number): number {
  const k = arenaTimeScale(s);
  if (!k) return t;
  return t <= s.startup ? t * k.startup : s.startup * k.startup + (t - s.startup) * k.active;
}
/** The end of a skill's super armor (or shot armor) window, ms from its cast, at its pace. */
export const armorEnd = (s: FinalSkill, end: number): number => paceTime(s, end);
/** Kept at their own length (only their wind-up and recovery take the pace): the actives David timed himself. */
const OWN_LENGTH = new Set([
  // the Roulette keeps its whole 2 s spin (its colour lights 1 s in: the foe gets a second to react — PvP audit)
  'roulette_wheel',
  // David 18 Oct (01:33 / 01:42): Hunter's Rain rains its whole 5 s, the Staff Flurry its whole 3 s, the held Double Shot
  // streams while held (up to 4 s), Tempest Ride rides 2.5 s
  'arrow_storm', 'staff_flurry', 'quick_shot_stream', 'tempest_ride',
  // Long Guard: held up to 2.5 s (David 18 Oct 01:42)
  'long_guard',
]);
// Warrior links (PvP re-audit: a ~6-skill combo): each skill leads to 2–3 others only, one route per job —
//   open (regular attack / Dash Slash / Iron Grip / the hook / Wave Slash) → launch (Rising Slash) → the air (Sky Breaker /
//   Ground Breaker) → the court or the lion (Judgment Blade / Lion's Maw) → the finish (Impaling Rush → the Verdict). Buffs and Sanctuary lead nowhere (a list is never empty: an empty one would mean free cancel).
const WARRIOR_LINKS: Record<string, string[]> = { // three ways (the combo trials, 17 Oct): IRON HAND — hook ↔ grip, the crash, the chain on the floor; SKYBREAKER — launch, chase, spike, crash on the bounce; JUDGMENT — the quake, the court, the sentence
  warrior_basic: ['rising_slash'], dash_slash: ['rising_slash'], thunder_circle: ['rising_slash', 'leap_crash', 'whirlwind', 'titans_verdict'],
  judgment_hook: ['rising_slash', 'thunder_circle'], wave_slash: ['rising_slash'], shield_charge: ['thunder_circle', 'warrior_basic'],
  earthsplitter: ['warrior_basic'], // (the charged punish: no combo link out of it)
  rising_slash: ['sky_breaker', 'ground_breaker'],
  sky_breaker: ['judgment_blade', 'lions_maw', 'leap_crash'], ground_breaker: ['judgment_blade', 'lions_maw'], leap_crash: ['judgment_blade', 'lions_maw', 'judgment_hook'],
  judgment_blade: ['lance_thrust', 'titans_verdict', 'thunder_circle'], lions_maw: ['lance_thrust', 'titans_verdict'],
  lance_thrust: ['titans_verdict'], whirlwind: ['titans_verdict'], blade_storm: ['titans_verdict'],
  war_cry: ['warrior_basic'], sanctuary: ['warrior_basic'],
};
for (const w of warrior) if (WARRIOR_LINKS[w.id]) w.cancelOnHit = [...WARRIOR_LINKS[w.id]];
// Archer: a dense combo graph (PvP engine audit) — every combo skill leads on to several others, the signature and the
// ultimate, so her strings run as long as the other classes' (before: most of her skills were dead ends).
const ARCHER_LINKS: Record<string, string[]> = {
  quick_shot: ['backstep_shot', 'hunters_spirit', 'skyhunters_step', 'leaping_arrow', 'eagle_arrow', 'arrow_storm'],
  rising_arrow: ['explosive_arrow', 'rain_of_arrows', 'arrow_storm', 'sky_rain', 'backstep_shot'],
  multi_shot: ['piercing_arrow', 'hunters_spirit', 'rising_arrow', 'rain_of_arrows', 'leaping_arrow', 'eagle_arrow', 'sky_rain'],
  explosive_arrow: ['piercing_arrow', 'hunters_spirit', 'multi_shot', 'rising_arrow', 'retreat_kick', 'eagle_arrow', 'arrow_storm', 'sky_rain'],
  retreat_kick: ['backstep_shot', 'hunters_spirit', 'explosive_arrow', 'rain_of_arrows', 'arrow_storm', 'sky_rain'],
  skyhunters_step: ['hunters_spirit', 'quick_shot', 'eagle_arrow', 'rain_of_arrows'],
  rain_of_arrows: ['piercing_arrow', 'hunters_spirit', 'multi_shot', 'explosive_arrow', 'rising_arrow', 'eagle_arrow', 'sky_rain'],
  leaping_arrow: ['explosive_arrow', 'skyhunters_step', 'eagle_arrow', 'sky_rain'],
  eagle_arrow: ['skyhunters_step'],
  arrow_storm: ['piercing_arrow', 'hunters_spirit', 'multi_shot', 'explosive_arrow', 'skyhunters_step', 'eagle_arrow'],
  hunters_roar: ['sky_rain'],
  bow_haste: ['quick_shot', 'hunters_spirit', 'explosive_arrow'],
  backstep_shot: ['quick_shot', 'hunters_spirit', 'rising_arrow', 'explosive_arrow'],
  piercing_arrow: ['hunters_roar'], // (the knockdown finisher: only the roar spends its marks — an empty list cancelled into anything)
};
for (const a of archer) for (const id of ARCHER_LINKS[a.id] ?? []) if (!a.cancelOnHit.includes(id)) a.cancelOnHit.push(id);
// Samurai extended kit: every core skill (and the basic chain) can cancel into the new cuts on a confirmed hit.
for (const m of samurai) if (m.slot <= 5 && !m.primes) for (const id of ['swallow_cut', 'hundred_cuts', 'falcon_dive', 'tornado_blade']) if (!m.cancelOnHit.includes(id)) m.cancelOnHit.push(id);
// Sheathe: cancelled into from any hit of his (the ultimate's cut is its own end).
for (const m of samurai) if (!m.primes && m.slot !== 7 && m.cancelOnHit.length && !m.cancelOnHit.includes('sheathe')) m.cancelOnHit.push('sheathe');
/** The mage's effects that are no skill of their own (slot 99: never on the bar, never in the Spell Weave): the frost rune
 *  Blink Mastery leaves, the Arcane Ward's burst, a broken rune beam, a conducted arc, the shards of a shatter. */
const hidden = (id: string, name: string, hit: HitEvent): FinalSkill => ({ ...mage[0], id, name, slot: 99, hits: [hit], move: LOCK, cooldown: 0, cancelOnHit: [], tags: [], relations: [], description: '', roles: ['setup'] });
export const MAGE_HIDDEN = {
  frostRune: hidden('frost_rune', 'Frost Rune', H(0, 4, { kind: 'placed', radius: 40 }, { stun: 120 }, { el: 'frost' })),
  wardBurst: hidden('ward_burst', 'Arcane Ward', H(0, 8, { kind: 'circle', radius: 150 }, { stun: 220, push: 26 }, { reachUp: 120, el: 'frost' })),
  runeLink: hidden('rune_link', 'Rune Beam', H(0, 10, { kind: 'placed', radius: 30 }, { hardCC: { kind: 'root', ms: 1000, long: true }, stun: 240 }, { reachUp: 60, el: 'storm' })),
  conductArc: hidden('conduct_arc', 'Conducted Arc', H(0, 6, { kind: 'circle', radius: 30 }, { stun: 320 }, { reachUp: 200 })),
  shards: hidden('shatter_shards', 'Ice Shards', H(0, 4, { kind: 'circle', radius: 160 }, { stun: 120 }, { reachUp: 120, el: 'frost' })),
};

/** The Archer's held Double Shot (David 18 Oct 01:33 + the Archer chat's shape): held past the first shot, a turning spirit
 *  circle before her bow streams arrows along the aim while Space is held (up to 4 s) — one every 110 ms, every 5th a heavier
 *  gold one. Not a slot: the scene starts it from the held basic and ends it on release (ARCHER_STREAM there). */
export const ARCHER_STREAM: FinalSkill = S({
  id: 'quick_shot_stream', cls: 'archer', arenaDmg: 0.6, slot: 0, name: 'Double Shot', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
  startup: 60, active: 4000, recovery: 160, cooldown: 0, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
  hits: Array.from({ length: 36 }, (_, i) => i % 5 === 4
    ? H(i * 110, 9, { kind: 'projectile', speed: 1150, range: 460, radius: 12, antiAir: true }, { stun: 260, push: 6 }, { heavy: true, mark: 1 })
    : H(i * 110, 4, { kind: 'projectile', speed: 950, range: 450, radius: 9, antiAir: true }, { stun: 200, push: 2 })),
  cancelOnHit: ['rising_arrow', 'multi_shot', 'explosive_arrow', 'retreat_kick', 'piercing_arrow', 'vine_trap', 'rain_of_arrows'],
  description: 'Hold Space past the first shot: a spirit circle turns before your bow and arrows stream out of it without a break while you hold — every fifth a heavier gold one.',
  relations: ['Held stream', 'Every 5th: gold'],
});
// ------------------------------------------------------------------ ARCHER — DEADEYE SNIPER (a style of her own)
// David 4 Nov 04:27–05:45 (the styles page): she switches style mid-fight — the bow folds away, a long rifle forms in her
// hands. GPT's design (scratchpad styles/archer_styles.md): precision and punishment, 250–650 px, weak inside 100; fast
// positioning, short bursts, one very satisfying heavy shot; the rifle butt, recoil steps, the anti-air for room. Its
// vertical slice first: the four-beat basic chain, the poke, the recoil step, the long punish, the signature, the anti-air;
// the rest of its kit stands on the bar as templates. GPT gives its times at the fight's pace (D: back to kit numbers).
const D = (ms: number) => Math.round(ms / PACE);
const SNIPER_SHOT = (range: number, radius = 8, speed = 2100) => ({ kind: 'projectile' as const, speed, range, radius, antiAir: true });
const sniper: FinalSkill[] = [
  S({
    id: 'sn_four_beat', cls: 'archer', style: 'sniper', arenaDmg: 0.6, slot: 0, name: 'Four-Beat Precision', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
    startup: D(110), active: D(45), recovery: D(145), cooldown: 0, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: { startup: 0.7, active: 0.7, recovery: 0.85 },
    hits: [H(0, 7, SNIPER_SHOT(380), { stun: D(240), push: 4 })],
    // a tap, the butt, the chamber, the verdict — and the last beat throws him up for the rifle's air game
    chain: { resetMs: 650, stages: [
      [H(0, 7, SNIPER_SHOT(380), { stun: D(240), push: 4 })], // Quick Tap: a snap shot from the hip
      [H(0, 8, { kind: 'sector', range: 92, angle: 100 }, { stun: D(300), push: 50 }, { reachUp: 100 })], // Stock Check: the rifle butt driven into him
      [H(0, 10, SNIPER_SHOT(430, 9), { stun: D(320), push: 90 }, { mark: 1 })], // Chamber Shot: a round chambered, the heavier shot pushes him off
      [H(0, 12, SNIPER_SHOT(310, 10), { stun: D(520), launch: 120, juggleCost: 24 }, { reachUp: 150, heavy: true })], // Rising Verdict: fired up from a dip — he goes up
    ], timings: [{ startup: D(110), active: D(45), recovery: D(145) }, { startup: D(120), active: D(50), recovery: D(170) }, { startup: D(150), active: D(50), recovery: D(190) }, { startup: D(170), active: D(60), recovery: D(260) }] },
    cancelOnHit: ['sn_needlemark', 'sn_recoil_slip', 'sn_throughline', 'sn_four_bells', 'sn_skyline'],
    description: 'Tap or hold Space: a snap shot from the hip, the rifle butt, a chambered round that pushes him off, then a shot fired up that throws him into the air. Weak up close — keep him at the end of the barrel.',
    relations: ['4-beat chain', 'Last beat launches'],
  }),
  S({
    id: 'sn_needlemark', cls: 'archer', style: 'sniper', slot: 1, name: 'Needlemark', roles: ['opener', 'precision', 'projectile'], targeting: 'mouseProjectile',
    startup: D(140), active: D(50), recovery: D(220), cooldown: 3000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 12, SNIPER_SHOT(470, 7, 2400), { stun: D(300), push: 6 }, { mark: 1 })],
    cancelOnHit: ['sn_throughline', 'sn_skyline'],
    description: 'One needle-thin shot down the line from far away: it stuns him for a moment and marks him (Hunter\'s Mark) — your opening.',
    relations: ['Long poke', 'Opener', 'Marks'],
  }),
  S({ id: 'sn_stockbreaker', cls: 'archer', style: 'sniper', slot: 2, name: 'Stockbreaker', roles: ['peel'], targeting: 'aimAssist', wip: true,
    startup: D(120), active: D(60), recovery: D(200), cooldown: 5000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a hard rifle-butt strike for a foe who gets too close.', relations: ['Close defence'] }),
  S({
    id: 'sn_recoil_slip', cls: 'archer', style: 'sniper', slot: 3, name: 'Recoil Slip', roles: ['escape', 'projectile'], targeting: 'mouseProjectile',
    startup: D(110), active: D(220), recovery: D(170), cooldown: 5000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: -110, lift: 26 }, // (the shot's kick slides her back out of his reach)
    hits: [H(0, 9, SNIPER_SHOT(220, 9), { stun: D(260), push: 30 })],
    cancelOnHit: ['sn_needlemark', 'sn_four_beat'],
    description: 'Fires point-blank and lets the recoil carry her back out of reach — the room the rifle needs.',
    relations: ['Escape', 'Makes range'],
  }),
  S({
    id: 'sn_throughline', cls: 'archer', style: 'sniper', slot: 4, name: 'Throughline', roles: ['finisher', 'projectile', 'precision'], targeting: 'mouseDir',
    startup: D(230), active: D(60), recovery: D(300), cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 22, { kind: 'projectile', speed: 2600, range: 620, radius: 10, pierce: true, antiAir: true }, { stun: D(420), push: 120 }, { heavy: true, mark: 1 })],
    cancelOnHit: ['sn_four_bells', 'sn_skyline'],
    description: 'Braced, she sends one round straight through everything in its line — every foe on it is thrown back and marked. The long punish.',
    relations: ['Pierces', 'Long punish', 'Marks'],
  }),
  S({ id: 'sn_kneecap', cls: 'archer', style: 'sniper', slot: 5, name: 'Kneecap Round', roles: ['precision'], targeting: 'mouseProjectile', wip: true,
    startup: D(150), active: D(50), recovery: D(220), cooldown: 7000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a low shot that stops a foe running in at her.', relations: ['Stops an advance'] }),
  S({
    id: 'sn_four_bells', cls: 'archer', style: 'sniper', slot: 6, name: 'Deadeye: Four Bells', roles: ['signature', 'projectile', 'precision'], targeting: 'mouseDir',
    startup: D(220), active: D(200), recovery: D(420), cooldown: 22000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // four sight notches settle on him, four timed shots ring out like bells — the last throws him up, higher on a marked foe
    hits: [
      H(0, 8, SNIPER_SHOT(620, 9, 2600), { stun: D(360), push: 6 }),
      H(D(65), 8, SNIPER_SHOT(620, 9, 2600), { stun: D(360), push: 6 }),
      H(D(130), 8, SNIPER_SHOT(620, 9, 2600), { stun: D(360), push: 6 }),
      H(D(200), 18, { kind: 'projectile', speed: 2800, range: 620, radius: 12, antiAir: true }, { stun: D(560), launch: 110, juggleCost: 26 }, { heavy: true, useMark: 'launch' }),
    ],
    cancelOnHit: ['sn_last_horizon'], tags: ['signature', 'farLaunch'], // (the arena: made to launch from afar — its fourth bell keeps its lift past the poke range)
    description: 'Her signature: four sight notches settle on him, then four timed shots ring out like bells — the fourth throws him up (higher on a marked foe).',
    relations: ['Signature', 'Spends marks'],
  }),
  S({
    id: 'sn_last_horizon', cls: 'archer', style: 'sniper', slot: 7, name: 'Last Horizon', roles: ['ultimate', 'projectile', 'finisher'], targeting: 'mouseDir',
    startup: D(440), active: D(160), recovery: D(650), cooldown: 65000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // on one knee, braced: three sight planes converge on the line, then one committed luminous round to the horizon (GPT)
    hits: [H(0, 56, { kind: 'projectile', speed: 3200, range: 700, radius: 24, pierce: true, antiAir: true }, { stun: D(800), push: 160, knockdown: 'heavy' }, { heavy: true })], // (±24 across the lane; a strong knockback: thrown far)
    cancelOnHit: [], endsCombo: true, tags: ['ultimate', 'farLaunch'], // (the arena: made to throw him down from afar — past the poke range too)
    description: 'Her ultimate: down on one knee, three sight planes close on one line — then a single luminous round goes through everything to the horizon and throws it far.',
    relations: ['Ultimate', 'Pierces', 'Knockback'],
  }),
  S({ id: 'sn_steady_chamber', cls: 'archer', style: 'sniper', slot: 8, name: 'Steady Chamber', roles: ['setup'], targeting: 'self', wip: true,
    startup: D(120), active: D(40), recovery: D(160), cooldown: 9000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a round chambered with care — the next rifle hit marks him and comes out faster.', relations: ['Set-up'] }),
  S({ id: 'sn_false_sight', cls: 'archer', style: 'sniper', slot: 9, name: 'False Sight', roles: ['precision'], targeting: 'mouseProjectile', wip: true,
    startup: D(260), active: D(50), recovery: D(220), cooldown: 9000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a feint of aim, then a sudden shot that stuns.', relations: ['Bait'] }),
  S({ id: 'sn_perch_pivot', cls: 'archer', style: 'sniper', slot: 10, name: 'Perch Pivot', roles: ['launcher', 'mobility'], targeting: 'mouseDir', wip: true,
    startup: D(140), active: D(220), recovery: D(200), cooldown: 7000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a hop across the lane and a downward shot that launches.', relations: ['Reposition', 'Launcher'] }),
  S({
    id: 'sn_glass_round', cls: 'archer', style: 'sniper', slot: 11, name: 'Glass Round', roles: ['finisher', 'projectile'], targeting: 'mouseDir',
    startup: D(1000), active: D(60), recovery: D(320), cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, // (startup = the longest hold: a tap fires at D(200))
    hits: [H(0, 14, SNIPER_SHOT(560, 10, 2800), { stun: D(420), push: 130 }, { heavy: true })],
    // David 4 Nov 14:59: she holds the key and lets one shot go that throws him into the wall. Held in three steps on one
    // knee, the round glowing hotter: a tap — a heavy shot that shoves him back; ~0.45 s — he is thrown across the floor;
    // full — thrown far across the arena (into the wall if one is in the way), marked for the rifle's next shots
    charge: { minMs: D(200), levels: [
      { at: 0, hits: [H(0, 14, SNIPER_SHOT(560, 10, 2800), { stun: D(420), push: 130 }, { heavy: true })] },
      { at: D(450), hits: [H(0, 20, { kind: 'projectile', speed: 3000, range: 620, radius: 11, pierce: true, antiAir: true }, { stun: D(520), knockdown: 'heavy', fly: { vz: 280, dist: 360 }, juggleCost: 24 }, { heavy: true, mark: 1 })] },
      { at: D(900), hits: [H(0, 28, { kind: 'projectile', speed: 3200, range: 700, radius: 12, pierce: true, antiAir: true }, { stun: D(600), knockdown: 'heavy', fly: { vz: 320, dist: 620 }, juggleCost: 30 }, { heavy: true, mark: 1 })] },
    ] },
    cancelOnHit: ['sn_needlemark', 'sn_throughline', 'sn_skyline'], tags: ['farLaunch'], // (made to throw him from afar: past the poke range too)
    description: 'Hold the key: on one knee, the round glows hotter; let go to fire. A tap shoves him back, half a second throws him across the floor, a full hold throws him far across the arena — into the wall if one is in the way — and marks him for your next shots.',
    relations: ['Hold to charge', 'Throws into the wall', 'Marks'],
  }),
  S({
    id: 'sn_skyline', cls: 'archer', style: 'sniper', slot: 12, name: 'Skyline Intercept', roles: ['antiAir', 'airExtender', 'projectile'], targeting: 'mouseProjectile',
    startup: D(150), active: D(50), recovery: D(230), cooldown: 6000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 14, SNIPER_SHOT(320, 12, 2300), { stun: D(700), launch: 70, juggleCost: 18 }, { reachUp: 190 })],
    cancelOnHit: ['sn_throughline', 'sn_four_bells'], tags: ['farLaunch'], // (the arena: an anti-air from afar — it lifts a foe jumping in past the poke range)
    description: 'A shot up into the sky: it meets a foe in the air (or jumping at her) and lifts him higher — keep the juggle going, or switch style under him.',
    relations: ['Anti-air', 'Juggle extender'],
  }),
];

// ------------------------------------------------------------------ ARCHER — RECOIL CANNONEER (her third style)
// David 4 Nov 14:59: the styles are a chain of different tools — after the sniper's shot into the wall she switches to the
// cannon and throws bombs onto the floor, or fires one huge missile into it. GPT's design (scratchpad
// styles/archer_styles.md): impact and momentum, 90–380 px, heavy shots, recoil steps, low-to-high launches, close
// counters; the cannon is physical in every attack. Live: the four-beat chain, the opener, the floor mortar, the escape,
// the anti-air smash, the rolling bomb, the signature, the missile ultimate, the main launcher; four templates.
const SHELL = (range: number, radius = 14, speed = 1500) => ({ kind: 'projectile' as const, speed, range, radius, antiAir: true });
const cannon: FinalSkill[] = [
  S({
    id: 'cn_four_beat', cls: 'archer', style: 'cannon', arenaDmg: 0.6, slot: 0, name: 'Four-Beat Breacher', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
    startup: D(100), active: D(45), recovery: D(150), cooldown: 0, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: { startup: 0.65, active: 0.65, recovery: 0.8 },
    hits: [H(0, 7, { kind: 'sector', range: 96, angle: 80 }, { stun: D(240), push: 10 }, { reachUp: 90 })],
    // jab — bang — bounce — THOOM: the barrel driven into him, a shell point-blank, one skipped off the floor that throws
    // him up, then the braced heavy shot that sends him flying
    chain: { resetMs: 700, stages: [
      [H(0, 7, { kind: 'sector', range: 96, angle: 80 }, { stun: D(240), push: 10 }, { reachUp: 90 })], // Breech Jab: the barrel's end into him
      [H(0, 9, SHELL(160, 16), { stun: D(280), push: 55 }, { mark: 1 })], // Pocket Blast: a shell from the hip, point-blank
      [H(0, 10, SHELL(220, 16, 1300), { stun: D(520), launch: 90, juggleCost: 18 }, { reachUp: 120, mark: 1 })], // Floor Skipper: skipped off the floor up into him
      [H(0, 14, SHELL(275, 18, 1700), { stun: D(460), push: 140 }, { reachUp: 150, heavy: true })], // Breakshot: braced — THOOM, he flies back
    ], timings: [{ startup: D(100), active: D(45), recovery: D(150) }, { startup: D(130), active: D(50), recovery: D(180) }, { startup: D(150), active: D(60), recovery: D(210) }, { startup: D(200), active: D(60), recovery: D(300) }] },
    cancelOnHit: ['cn_breach_burst', 'cn_arc_mortar', 'cn_kickback', 'cn_crater_catch', 'cn_rolling_iron', 'cn_battery', 'cn_piston_lift'],
    description: 'Tap or hold Space: the barrel jabbed into him, a shell point-blank, one skipped off the floor that throws him up, then a braced heavy shot that sends him flying.',
    relations: ['4-beat chain', 'Third beat launches'],
  }),
  S({
    id: 'cn_breach_burst', cls: 'archer', style: 'cannon', slot: 1, name: 'Breach Burst', roles: ['opener'], targeting: 'mouseDir',
    startup: D(140), active: D(60), recovery: D(220), cooldown: 5000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 12, { kind: 'sector', range: 170, angle: 64 }, { stun: D(280), push: 65 }, { reachUp: 110, mark: 1 })],
    cancelOnHit: ['cn_piston_lift', 'cn_arc_mortar', 'cn_rolling_iron'],
    description: 'A cone of blast out of the muzzle up close: everyone in it is stunned and shoved back — your opening.',
    relations: ['Opener', 'Cone'],
  }),
  S({
    id: 'cn_arc_mortar', cls: 'archer', style: 'cannon', slot: 2, name: 'Arc Mortar', roles: ['launcher', 'zone'], targeting: 'mouseGround',
    startup: D(200), active: D(340), recovery: D(240), cooldown: 8000, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 380, seekFoe: true, // (it comes down on him: the nearest foe in front inside its reach)
    hits: [H(D(320), 16, { kind: 'placed', radius: 52 }, { stun: D(620), launch: 105, juggleCost: 22 }, { reachUp: 90, heavy: true, mark: 1 })],
    cancelOnHit: ['cn_crater_catch', 'cn_piston_lift', 'cn_battery'], tags: ['farLaunch'], telegraph: 'ground', // (a shell lobbed onto him: made to launch from afar)
    description: 'A shell lobbed high in an arc: it lands on the floor where you aim and bursts, throwing everyone on it into the air.',
    relations: ['Floor bomb', 'Ranged launcher'],
  }),
  S({
    id: 'cn_kickback', cls: 'archer', style: 'cannon', slot: 3, name: 'Kickback Step', roles: ['escape', 'projectile'], targeting: 'mouseProjectile',
    startup: D(110), active: D(220), recovery: D(170), cooldown: 5000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: -120, lift: 18 }, // (the cannon's kick throws her back out of reach)
    hits: [H(0, 9, SHELL(210, 16), { stun: D(260), push: 40 })],
    cancelOnHit: ['cn_arc_mortar', 'cn_four_beat'],
    description: 'Fires point-blank and lets the cannon\'s kick throw her back out of reach.',
    relations: ['Escape', 'Makes room'],
  }),
  S({
    id: 'cn_crater_catch', cls: 'archer', style: 'cannon', slot: 4, name: 'Crater Catch', roles: ['antiAir', 'knockdown'], targeting: 'mouseProjectile',
    startup: D(150), active: D(60), recovery: D(260), cooldown: 7000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 30, lift: 70 }, // (a hop up to meet him, the blast driven down)
    hits: [H(0, 16, SHELL(240, 20, 1600), { stun: D(550), slam: true, knockdown: 'light', juggleCost: 14 }, { reachUp: 200, heavy: true })],
    cancelOnHit: ['cn_battery', 'cn_rolling_iron'], tags: ['farLaunch'],
    description: 'She hops up and blasts a foe in the air straight down into the floor — he bounces once, right into your next shot. On the floor it knocks him down.',
    relations: ['Anti-air', 'Ground bounce'],
  }),
  S({
    id: 'cn_rolling_iron', cls: 'archer', style: 'cannon', slot: 5, name: 'Rolling Iron', roles: ['zone', 'projectile'], targeting: 'mouseDir',
    startup: D(160), active: D(420), recovery: D(220), cooldown: 9000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 14, { kind: 'projectile', speed: 560, range: 350, radius: 20, explodeRadius: 60 }, { stun: D(420), knockdown: 'light' }, { heavy: true })],
    cancelOnHit: ['cn_battery'],
    description: 'A heavy shell bowled along the floor: it rolls into him and bursts, knocking down everyone round it.',
    relations: ['Floor bomb', 'Knockdown'],
  }),
  S({
    id: 'cn_battery', cls: 'archer', style: 'cannon', slot: 6, name: 'Three-Beat Battery', roles: ['signature', 'projectile'], targeting: 'mouseDir',
    startup: D(200), active: D(300), recovery: D(400), cooldown: 22000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // three shots in rhythm, each across the floor's depth — the third throws him up (higher with pressure in the chamber)
    hits: [
      H(0, 10, { kind: 'projectile', speed: 1700, range: 330, radius: 22 }, { stun: D(380), push: 20 }),
      H(D(110), 10, { kind: 'projectile', speed: 1700, range: 330, radius: 22 }, { stun: D(380), push: 20 }),
      H(D(230), 20, { kind: 'projectile', speed: 1900, range: 330, radius: 26, antiAir: true }, { stun: D(560), launch: 105, juggleCost: 26 }, { heavy: true, useMark: 'launch' }),
    ],
    cancelOnHit: ['cn_broadside'], tags: ['signature', 'farLaunch'],
    description: 'Her signature: three shots in rhythm, boom — boom — BOOM; the third throws him up, higher with pressure in the chamber.',
    relations: ['Signature', 'Spends pressure'],
  }),
  S({
    id: 'cn_broadside', cls: 'archer', style: 'cannon', slot: 7, name: 'Queen\'s Broadside', roles: ['ultimate'], targeting: 'mouseGround',
    startup: D(420), active: D(700), recovery: D(600), cooldown: 65000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, D(1100)],
    placeRange: 450, seekFoe: true, // (onto him: the nearest foe in front inside its reach)
    // braced on the spot: four heavy shells into the floor round him, then one huge missile straight down onto him
    hits: [
      ...[0, 90, 180, 270].map((t, i) => H(D(t), 12, { kind: 'placed', radius: 70 }, { stun: D(420), push: 10 }, { reachUp: 120, mark: i === 3 ? 1 : 0 })),
      H(D(600), 44, { kind: 'placed', radius: 150 }, { stun: D(700), knockdown: 'heavy' }, { reachUp: 260, heavy: true }),
    ],
    cancelOnHit: [], endsCombo: true, tags: ['ultimate', 'farLaunch'], telegraph: 'ground',
    description: 'Her ultimate: braced on the spot, four heavy shells burst on the floor round him, then one huge missile comes straight down on him — the whole floor shakes.',
    relations: ['Ultimate', 'Floor bombs'],
  }),
  S({ id: 'cn_fuse_knuckle', cls: 'archer', style: 'cannon', slot: 8, name: 'Fuse Knuckle', roles: ['peel'], targeting: 'aimAssist', wip: true,
    startup: D(110), active: D(60), recovery: D(200), cooldown: 6000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the back of the breech driven into him up close — a short stun.', relations: ['Close defence'] }),
  S({ id: 'cn_muzzle_guard', cls: 'archer', style: 'cannon', slot: 9, name: 'Muzzle Guard', roles: ['counter'], targeting: 'self', wip: true,
    startup: D(60), active: D(180), recovery: D(240), cooldown: 10000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a braced guard behind the cannon — struck, it blasts back and launches him.', relations: ['Counter'] }),
  S({
    id: 'cn_piston_lift', cls: 'archer', style: 'cannon', slot: 10, name: 'Piston Lift', roles: ['launcher'], targeting: 'mouseDir',
    startup: D(160), active: D(70), recovery: D(280), cooldown: 7000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 16, { kind: 'sector', range: 195, angle: 80 }, { stun: D(680), launch: 140, juggleCost: 26 }, { reachUp: 130, heavy: true, mark: 1 })],
    cancelOnHit: ['cn_crater_catch', 'cn_battery', 'cn_arc_mortar'],
    description: 'A blast fired steeply up from the hip: it throws him high into the air — her main launcher.',
    relations: ['Launcher'],
  }),
  S({ id: 'cn_depth_bank', cls: 'archer', style: 'cannon', slot: 11, name: 'Depth Bank', roles: ['projectile'], targeting: 'mouseDir', wip: true,
    startup: D(170), active: D(80), recovery: D(240), cooldown: 8000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a shell that skips off into the next lane of the floor.', relations: ['Depth punish'] }),
  S({ id: 'cn_twin_traverse', cls: 'archer', style: 'cannon', slot: 12, name: 'Twin Traverse', roles: ['projectile'], targeting: 'mouseDir', wip: true,
    startup: D(180), active: D(80), recovery: D(240), cooldown: 9000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: two shots into two lanes that pull them to the middle.', relations: ['Pull'] }),
];

// ------------------------------------------------------------------ SAMURAI — SHURIKEN ASSASSIN (his second style)
// David 4 Nov 14:59: the styles are a chain of different tools, each a different fighter running in — the katana samurai
// tags out, the masked shinobi tags in. GPT's design (scratchpad styles/samurai_styles.md): a weapon-trajectory master, not
// a second swordmaster and not a shadow-clone summoner — 80–430 px, fast and reversible (throw, reposition, recall); the big
// four-point star is a real object out of his hand and home again (Return Edge, SkillRuntime: it cuts going out and coming
// back, 40% and a flinch on its own way home). Live: the four-beat chain, Redline Recall, Piercing Quarter, the signature
// Four-Point Eclipse, Crowstep Rise, Returning Moon (the katana → assassin combo: Swallow Cut, the switch, Crowstep Rise,
// Returning Moon, Four-Point Eclipse); seven templates. GPT gives its times at the fight's pace (D); the damage is DFO's.
const NEEDLE = (range: number, rows = 1) => ({ kind: 'projectile' as const, speed: 1700, range, radius: 10, antiAir: true, ...(rows > 1 ? { rows, rowGap: 38 } : {}) });
/** The big star: out, a wait at the end of its flight, home at 1500 px / s cutting again (40%, a flinch). */
const STAR = (range: number, speed: number, park = D(420), radius = 24) => ({ kind: 'projectile' as const, speed, range, radius, pierce: true, antiAir: true, edge: { park, speed: 1500, back: 0.4, stun: D(100) } });
const RLINE = (length: number, depth: number): HitShape => ({ kind: 'line', length, width: depth * 2 });
const shuriken: FinalSkill[] = [
  S({
    id: 'as_four_beat', cls: 'samurai', style: 'shuriken', arenaDmg: 0.6, slot: 0, name: 'Four-Beat Reaver', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
    startup: D(90), active: D(50), recovery: D(145), cooldown: 0, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: { startup: 0.7, active: 0.7, recovery: 0.85 },
    hits: [H(0, 6, NEEDLE(300), { stun: D(240), push: 4, juggleCost: 4 })],
    // tik — tik-tik — WHIRR — CHAK!: a star flicked off the wrist, two into the near lanes, the big star thrown, then called
    // home on an upward curve through him (it launches)
    chain: { resetMs: 700, stages: [
      [H(0, 6, NEEDLE(300), { stun: D(240), push: 4, juggleCost: 4 })], // Needle Flick
      [H(0, 7, NEEDLE(320, 2), { stun: D(280), push: 6, juggleCost: 7 })], // Cross Needles: two stars into the near lanes
      [H(0, 9, STAR(360, 1250), { stun: D(350), push: 60, juggleCost: 10 }, { reachUp: 120 })], // Four-Point Cast: the big star out
      [H(0, 12, STAR(360, 1250), { stun: D(650), launch: 90, juggleCost: 18 }, { reachUp: 160, recall: { speed: 1700, loft: 40 } })], // Rising Return: home through him
    ], timings: [{ startup: D(90), active: D(50), recovery: D(145) }, { startup: D(105), active: D(75), recovery: D(175) }, { startup: D(145), active: D(115), recovery: D(200) }, { startup: D(175), active: D(125), recovery: D(265) }] },
    cancelOnHit: ['as_redline_recall', 'as_crowstep_rise', 'as_returning_moon', 'as_four_point_eclipse'], tags: ['farLaunch'], // (the star coming home launches from where it is)
    description: 'Tap or hold Space: a star flicked off the wrist, two more into the lanes beside it, the big star thrown — it waits at the end of its flight — then called home on a rising curve straight through him, throwing him up.',
    relations: ['4-beat chain', 'The star comes home through him'],
  }),
  S({ id: 'as_needle_fan', cls: 'samurai', style: 'shuriken', slot: 1, name: 'Needle Fan', roles: ['opener', 'projectile'], targeting: 'mouseProjectile', wip: true,
    startup: D(100), active: D(100), recovery: D(190), cooldown: 4000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: three stars off the forearms across three lanes — your opener.', relations: ['Opener'] }),
  S({ id: 'as_heel_sweep', cls: 'samurai', style: 'shuriken', slot: 2, name: 'Heel Sweep', roles: ['launcher'], targeting: 'aimAssist', wip: true,
    startup: D(110), active: D(80), recovery: D(240), cooldown: 6000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a low sweep and a rising heel up close that lifts him.', relations: ['Close launcher'] }),
  S({
    id: 'as_redline_recall', cls: 'samurai', style: 'shuriken', slot: 3, name: 'Redline Recall', roles: ['pull', 'launcher'], targeting: 'mouseProjectile',
    startup: D(120), active: D(150), recovery: D(260), cooldown: 7000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 13, STAR(430, 1500, 0), { stun: D(540), pull: 55, launch: 60, juggleCost: 13 }, { reachUp: 150, recall: { speed: 2000 } })],
    cancelOnHit: ['as_crowstep_rise', 'as_returning_moon', 'as_four_point_eclipse'], tags: ['farLaunch', 'farPull'], // (made to drag him in from where the star is)
    description: 'Snaps the big star straight back to your hand along a thin red line: whoever stands in its way is dragged toward you and lifted. With the star in your hand, it is thrown and called back at once.',
    relations: ['Recall', 'Drags him in'],
  }),
  S({ id: 'as_silk_shift', cls: 'samurai', style: 'shuriken', slot: 4, name: 'Silk Shift', roles: ['mobility', 'projectile'], targeting: 'mouseDir', wip: true,
    startup: D(135), active: D(90), recovery: D(230), cooldown: 8000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a low sidestep into the next lane with a star down it — it changes the star\'s way home.', relations: ['Reposition'] }),
  S({
    id: 'as_piercing_quarter', cls: 'samurai', style: 'shuriken', slot: 5, name: 'Piercing Quarter', roles: ['projectile', 'finisher'], targeting: 'mouseProjectile',
    startup: D(240), active: D(80), recovery: D(330), cooldown: 9000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 16, STAR(510, 1700, D(260), 18), { stun: D(360), push: 85, juggleCost: 16 }, { heavy: true, reachUp: 120 })],
    cancelOnHit: ['as_redline_recall', 'as_four_point_eclipse'],
    description: 'A committed overhand throw: the big star flies far and flat, cutting through everyone in its line and shoving them back; it waits at the end of its flight, then comes home, cutting again.',
    relations: ['Long line', 'Cuts twice'],
  }),
  S({
    id: 'as_four_point_eclipse', cls: 'samurai', style: 'shuriken', slot: 6, name: 'Four-Point Eclipse', roles: ['signature'], targeting: 'mouseGround',
    startup: D(230), active: D(290), recovery: D(420), cooldown: 24000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    placeRange: 360, seekFoe: true, takesStar: true, // (round him: the nearest foe in front inside its reach, in the arena too; the big star is its own)
    // the star flies to him and changes direction four times — four crossing cuts that hold him there — then rises through him
    hits: [
      ...[0, 55, 110, 165].map((t) => H(D(t), 6, { kind: 'placed', radius: 64 }, { stun: D(360), float: true, juggleCost: 3 }, { reachUp: 230 })),
      H(D(250), 14, { kind: 'placed', radius: 70 }, { stun: D(620), launch: 95, juggleCost: 15 }, { reachUp: 240, heavy: true }),
    ],
    tags: ['signature', 'farLaunch'], telegraph: 'ground',
    description: 'His signature: the big star flies to the foe and turns four times round him — four crossing cuts that hold him there — then rises straight up through him and throws him high, and comes home.',
    relations: ['Signature', 'Four crossing cuts'],
  }),
  S({
    id: 'as_fivefold_night', cls: 'samurai', style: 'shuriken', slot: 7, name: 'Fivefold Night', roles: ['ultimate', 'finisher'], targeting: 'mouseTarget',
    startup: D(430), active: D(420), recovery: D(640), cooldown: 70000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // unseal — spread — reverse — converge — catch (GPT): the four stars on his back join the one in his hand, fly out in five
    // lanes, turn, and close on him in one five-point crossing strike, then come home (500 X ± 65 across the lanes)
    hits: [
      H(D(60), 10, RLINE(500, 65), { stun: D(600), juggleCost: 5 }, { reachUp: 200 }), // the spread: the five lanes pass through him
      H(D(180), 10, RLINE(500, 65), { stun: D(600), pull: 30, juggleCost: 5 }, { reachUp: 200 }), // the reverse: turned back through him
      H(D(300), 40, RLINE(500, 65), { stun: D(700), slam: true, knockdown: 'heavy', juggleCost: 30 }, { reachUp: 300, heavy: true }), // the converge: in the air, slammed down, one bounce; standing, thrown down
    ],
    cancelOnHit: [], endsCombo: true, tags: ['ultimate'],
    description: 'His ultimate: the four stars on his back unseal and join the one in his hand — five lanes out, turned, and closed on the foe in one five-point crossing strike, then all five come home.',
    relations: ['Ultimate', 'Five lanes', 'Ground bounce'],
  }),
  S({
    id: 'as_crowstep_rise', cls: 'samurai', style: 'shuriken', slot: 8, name: 'Crowstep Rise', roles: ['launcher', 'antiAir'], targeting: 'mouseTarget',
    startup: D(155), active: D(90), recovery: D(250), cooldown: 9000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 120, lift: 40, gap: 62 }, // (a step into the knee — up to the foe it locks on, never under him: 220 px of reach with the cut; it stops where the knee meets him — at the 34 px body to body the knee was inside him and he came down on top of you)
    hits: [H(D(60), 16, { kind: 'sector', range: 104, angle: 90 }, { stun: D(700), launch: 105, juggleCost: 19 }, { reachUp: 190, heavy: true })], // (the knee lands as the step ends)
    cancelOnHit: ['as_returning_moon', 'as_four_point_eclipse'],
    description: 'A step into a flying knee with a rising cut of the star: it meets a foe up to two heights over you and throws him high — the bridge out of the katana.',
    relations: ['Launcher', 'Anti-air'],
  }),
  S({ id: 'as_crosslane_split', cls: 'samurai', style: 'shuriken', slot: 9, name: 'Crosslane Split', roles: ['pull', 'projectile'], targeting: 'mouseProjectile', wip: true,
    startup: D(175), active: D(130), recovery: D(250), cooldown: 9000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: two stars in two lanes curve in and meet, drawing the foes between them to the middle.', relations: ['Pull'] }),
  S({ id: 'as_falling_talon', cls: 'samurai', style: 'shuriken', slot: 10, name: 'Falling Talon', roles: ['knockdown'], targeting: 'aimAssist', wip: true,
    startup: D(145), active: D(110), recovery: D(310), cooldown: 11000, ground: false, air: true, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: from the air, a heel drop and a cut — a foe in the air bounces off the floor once.', relations: ['Ground bounce'] }),
  S({ id: 'as_iron_palm', cls: 'samurai', style: 'shuriken', slot: 11, name: 'Iron Palm Deflect', roles: ['counter'], targeting: 'self', wip: true,
    startup: D(65), active: D(180), recovery: D(290), cooldown: 13000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a parry on the left forearm — a blow caught in it answers with a star that stuns.', relations: ['Counter'] }),
  S({
    id: 'as_returning_moon', cls: 'samurai', style: 'shuriken', slot: 12, name: 'Returning Moon', roles: ['airExtender', 'launcher'], targeting: 'mouseProjectile',
    startup: D(175), active: D(130), recovery: D(260), cooldown: 10000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 14, STAR(340, 1400, 0), { stun: D(620), launch: 75, juggleCost: 17 }, { reachUp: 230, recall: { speed: 1500, loft: 120 } })],
    cancelOnHit: ['as_four_point_eclipse'], tags: ['farLaunch'],
    description: 'The flying star is turned onto a steep arc home over his head — it comes down through a foe in the air and lifts him again. With the star in your hand, it is thrown a short way and comes home the same way, through him.',
    relations: ['Recall', 'Air extender'],
  }),
];

// ======================================================================= the Warrior's Siege Warden (Styles.ts)
// GPT's design (scratchpad styles/warrior_styles.md, David 4 Nov 14:59): the Lion Knight of the Iron Gate — a towering
// double-winged shield on his forearm that opens into two iron wings and shuts on the foe like a lion's jaws; catch →
// crush, iron and leverage (no holy fire, no lightning, no light swords: those stay the longsword's). GPT's times (at the
// fight's pace, D) and juggle costs; DFO's damage. The vertical slice: the four-beat chain, Threshold Check, Lion's Clamp,
// Drawbridge Lift, Anvil Drop, Royal Portcullis, the longsword's Rising Slash → the switch route; the rest templates.
/** A thrust's or a swing's reach as GPT gives it: X ahead of him, ± depth across the lane (a line X long, 2 × depth wide). */
const siege: FinalSkill[] = [
  S({
    id: 'ws_four_beat', cls: 'warrior', style: 'siege', slot: 0, name: 'Four-Beat Portcullis', roles: ['basic', 'confirm'], targeting: 'aimAssist',
    startup: D(95), active: D(55), recovery: D(140), cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 7, { kind: 'sector', range: 85, angle: 100 }, { stun: D(250), push: 4, juggleCost: 4 }, { reachUp: 100 })],
    // THUNK — KLANG — KRR-CHAK — KADUNK: the forearm behind the shield, the elbow over it, the gates swung open upward, the
    // gate slammed shut through him
    chain: { resetMs: 700, stages: [
      [H(0, 7, { kind: 'sector', range: 85, angle: 100 }, { stun: D(250), push: 4, juggleCost: 4 }, { reachUp: 100 })], // Iron Knuckle
      [H(0, 8, { kind: 'sector', range: 100, angle: 100 }, { stun: D(310), push: 30, juggleCost: 6 }, { reachUp: 100 })], // Gate Elbow
      [H(0, 9, { kind: 'sector', range: 125, angle: 130 }, { stun: D(480), launch: 60, juggleCost: 11 }, { reachUp: 130 })], // Open the Gates: the wings swing apart upward, lifting him
      [H(0, 12, { kind: 'sector', range: 110, angle: 120 }, { stun: D(350), push: 75, juggleCost: 16 }, { reachUp: 130, heavy: true })], // Portcullis Close: the gate crashes shut
    ], timings: [{ startup: D(95), active: D(55), recovery: D(140) }, { startup: D(115), active: D(65), recovery: D(165) }, { startup: D(145), active: D(90), recovery: D(210) }, { startup: D(180), active: D(105), recovery: D(270) }] },
    cancelOnHit: ['ws_threshold_check', 'ws_lions_clamp', 'ws_drawbridge_lift', 'ws_anvil_drop', 'ws_royal_portcullis'],
    description: 'Tap or hold Space: a forearm blow behind the shield, an elbow over it, the two iron wings swung open upward under him — then the gate slammed shut through him.',
    relations: ['4-beat chain', 'Cancel into any skill on hit'],
  }),
  S({
    id: 'ws_threshold_check', cls: 'warrior', style: 'siege', slot: 1, name: 'Threshold Check', roles: ['opener', 'gapClose'], targeting: 'mouseTarget',
    startup: D(105), active: D(65), recovery: D(190), cooldown: 4000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 70, gap: 66 }, // (a shoulder-first lunge behind the closed gate: it stops where the shield meets him)
    hits: [H(D(30), 9, { kind: 'sector', range: 90, angle: 100 }, { stun: D(330), push: 30, juggleCost: 8 }, { reachUp: 90 })],
    cancelOnHit: ['ws_lions_clamp', 'ws_drawbridge_lift'],
    description: 'A body check behind the closed shield: he lunges in shoulder-first and the gate hits him flat, staggering him back.',
    relations: ['Opener', 'Into the clamp or the lift'],
  }),
  S({ id: 'ws_sentry_catch', cls: 'warrior', style: 'siege', slot: 2, name: 'Sentry Catch', roles: ['counter'], targeting: 'self', wip: true,
    startup: D(75), active: D(160), recovery: D(300), cooldown: 11000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the gate opens into a V and catches a blow between its wings, then snaps shut on the attacker.', relations: ['Counter'] }),
  S({
    id: 'ws_lions_clamp', cls: 'warrior', style: 'siege', slot: 3, name: "Lion's Clamp", roles: ['pull', 'confirm'], targeting: 'aimAssist',
    startup: D(125), active: D(105), recovery: D(245), cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(50), 11, { kind: 'sector', range: 110, angle: 110 }, { stun: D(420), pull: 35, pin: D(180), juggleCost: 12 }, { reachUp: 150 })], // (the wings close round him: on the floor or low in the air, held a beat)
    cancelOnHit: ['ws_drawbridge_lift', 'ws_anvil_drop', 'ws_royal_portcullis'],
    description: 'The two wings swing out round him and bite shut like a lion\'s jaws: he is dragged in and held a beat — on the floor or low in the air.',
    relations: ['Catch', 'Holds him a beat'],
  }),
  S({
    id: 'ws_drawbridge_lift', cls: 'warrior', style: 'siege', slot: 4, name: 'Drawbridge Lift', roles: ['launcher', 'antiAir'], targeting: 'aimAssist',
    startup: D(155), active: D(95), recovery: D(270), cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(30), 13, { kind: 'sector', range: 140, angle: 120 }, { stun: D(700), launch: 105, juggleCost: 18 }, { reachUp: 170, heavy: true })],
    cancelOnHit: ['ws_anvil_drop', 'ws_royal_portcullis'],
    description: 'Both wings swing up like a drawbridge and lever him into the air — it meets a foe up to two heights over you: the bridge out of the longsword.',
    relations: ['Launcher', 'Anti-air'],
  }),
  S({ id: 'ws_rivet_drive', cls: 'warrior', style: 'siege', slot: 5, name: 'Rivet Drive', roles: ['peel'], targeting: 'mouseDir', wip: true,
    startup: D(175), active: D(110), recovery: D(350), cooldown: 10000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the gate locked, a braced shove that drives him back across the floor — into a wall, he bounces off it.', relations: ['Push'] }),
  S({
    id: 'ws_royal_portcullis', cls: 'warrior', style: 'siege', slot: 6, name: 'Royal Portcullis', roles: ['signature'], targeting: 'mouseTarget',
    startup: D(240), active: D(240), recovery: D(420), cooldown: 23000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 110, gap: 74 }, // (he advances with the wings open, stopping where they close round him)
    hits: [
      H(D(70), 8, { kind: 'sector', range: 130, angle: 130 }, { stun: D(520), pull: 30, pin: D(240), juggleCost: 8 }, { reachUp: 180 }), // the gate snaps shut on him
      H(D(200), 18, { kind: 'sector', range: 120, angle: 120 }, { stun: D(650), launch: 90, juggleCost: 19 }, { reachUp: 200, heavy: true }), // and drives up, locked
    ],
    tags: ['signature'],
    description: 'His signature: the gate opens wide, he advances, it snaps shut on the foe like a portcullis — then the locked gate is driven straight up, throwing him high.',
    relations: ['Signature', 'Shut, then up'],
  }),
  S({
    id: 'ws_last_drawbridge', cls: 'warrior', style: 'siege', slot: 7, name: 'The Last Drawbridge', roles: ['ultimate', 'finisher'], targeting: 'aimAssist',
    startup: D(390), active: D(360), recovery: D(620), cooldown: 70000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // unfold — catch — catapult — sentence (GPT): anchored, the gate opened to its widest span; its jaws shut on what is in
    // front of him, the whole body levers it up, and the locked gate is raised overhead and slammed down on it
    hits: [
      H(D(80), 14, RLINE(220, 48), { stun: D(700), pull: 40, juggleCost: 10 }, { reachUp: 170 }), // the catch: drawn into the jaws
      H(D(150), 22, RLINE(160, 48), { stun: D(900), launch: 155, juggleCost: 15 }, { reachUp: 220, heavy: true }), // the catapult
      H(D(300), 40, RLINE(200, 48), { stun: D(700), slam: true, knockdown: 'heavy', juggleCost: 15 }, { reachUp: 340, heavy: true }), // the sentence: in the air, slammed down, one bounce; standing, thrown down
    ],
    cancelOnHit: [], endsCombo: true, tags: ['ultimate'],
    description: 'His ultimate: anchored, the gate opened to its widest span — what it catches in its jaws is catapulted up with his whole body, then the locked gate is raised overhead and slammed down on it. No magic: iron, leverage and weight.',
    relations: ['Ultimate', 'Catch', 'Ground bounce'],
  }),
  S({ id: 'ws_rearguard_step', cls: 'warrior', style: 'siege', slot: 8, name: 'Rearguard Step', roles: ['mobility'], targeting: 'mouseDir', wip: true,
    startup: D(115), active: D(90), recovery: D(230), cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a step back with one wing turned in front of him, its edge striking.', relations: ['Reposition'] }),
  S({ id: 'ws_crenel_upper', cls: 'warrior', style: 'siege', slot: 9, name: 'Crenel Upper', roles: ['antiAir'], targeting: 'aimAssist', wip: true,
    startup: D(145), active: D(95), recovery: D(255), cooldown: 9000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the shield\'s spine driven up two-handed into a foe overhead.', relations: ['Anti-air'] }),
  S({
    id: 'ws_anvil_drop', cls: 'warrior', style: 'siege', slot: 10, name: 'Anvil Drop', roles: ['knockdown', 'extender'], targeting: 'mouseTarget',
    startup: D(160), active: D(110), recovery: D(300), cooldown: 11000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 70, lift: 70, crash: true, gap: 60 }, // (a short powered hop onto him, the folded gate brought down with it)
    hits: [H(D(80), 15, { kind: 'sector', range: 110, angle: 120 }, { stun: D(540), slam: true, knockdown: 'light', juggleCost: 23 }, { reachUp: 210, heavy: true })], // (in the air: slammed into the floor, one bounce; standing: knocked down)
    cancelOnHit: ['ws_royal_portcullis'],
    description: 'A short powered hop and the whole folded gate comes down like an anvil: a foe in the air is slammed into the floor and bounces once; a standing one is knocked flat.',
    relations: ['Ground bounce', 'Knockdown'],
  }),
  S({ id: 'ws_false_gate', cls: 'warrior', style: 'siege', slot: 11, name: 'False Gate', roles: ['setup'], targeting: 'aimAssist', wip: true,
    startup: D(115), active: D(85), recovery: D(280), cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the gate starts to open as if to guard — one wing folds and its edge strikes instead.', relations: ['Feint'] }),
  S({ id: 'ws_crossbar_sweep', cls: 'warrior', style: 'siege', slot: 12, name: 'Crossbar Sweep', roles: ['pull'], targeting: 'aimAssist', wip: true,
    startup: D(155), active: D(110), recovery: D(260), cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the wings spread flat and sweep a wide slice of the floor, drawing the foes to his lane.', relations: ['Sweep'] }),
];

// The Gambler's second style (David 4 Nov 14:59: a chain of different tools, a different fighter running in): the Radiant
// Duelist (GPT's design, scratchpad styles/gambler_styles.md) — the cane unfolded into the Crown Staff, a two-handed staff of
// solid violet-white light: a stage fencer's thrusts, pivots and pole vaults, one dominant trail per strike. Mid range (105–190).
// His numbers are GPT's (startup / active / recovery, the reach X and its depth ±), the live ones its "Gentleman's Lesson"
// (jab → thrust → Crown Raise → Royal Turn → Collect the Debt → Curtain Call) and his signature; the House Edge (the gold
// facets a sweet-spot hit earns, staked on All In) is still to come — All In plays its unstaked "Probe" for now.
const radiant: FinalSkill[] = [
  S({
    id: 'rd_four_beat', cls: 'gambler', style: 'radiant', slot: 0, name: 'Four-Beat Flourish', roles: ['basic', 'confirm'], targeting: 'aimAssist',
    startup: D(125), active: D(45), recovery: D(155), cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 6, RLINE(115, 20), { stun: D(250), push: 6, juggleCost: 6 }, { reachUp: 100 })],
    // jab — thrust — rotate — finish: the ferrule punched out, the crown driven straight in, the staff spun round the hips,
    // the rising overhead lever strike that lifts him
    chain: { resetMs: 700, stages: [
      [H(0, 6, RLINE(115, 20), { stun: D(250), push: 6, juggleCost: 6 }, { reachUp: 100 })], // Knock: the short ferrule jab
      [H(0, 7, RLINE(145, 20), { stun: D(290), push: 14, juggleCost: 7 }, { reachUp: 100 })], // Measure: the crown thrust
      [H(0, 8, RLINE(120, 31), { stun: D(330), push: 10, juggleCost: 8 }, { reachUp: 110 })], // Spindle: the hip-level rotation
      [H(0, 11, RLINE(175, 28), { stun: D(520), launch: 65, juggleCost: 12 }, { reachUp: 140, heavy: true })], // Bow: the rising overhead lever strike
    ], timings: [{ startup: D(125), active: D(45), recovery: D(155) }, { startup: D(145), active: D(50), recovery: D(170) }, { startup: D(165), active: D(80), recovery: D(190) }, { startup: D(210), active: D(65), recovery: D(260) }] },
    cancelOnHit: ['rd_opening_bid', 'rd_crown_raise', 'rd_royal_turn'],
    description: 'Tap or hold Space: a quick jab of the gold ferrule, the crown thrust straight in, the staff spun round his hips — then a rising overhead strike that lifts him.',
    relations: ['4-beat chain', 'Cancel into a skill on hit'],
  }),
  S({
    id: 'rd_opening_bid', cls: 'gambler', style: 'radiant', slot: 1, name: 'Opening Bid', roles: ['opener', 'precision'], targeting: 'aimAssist',
    startup: D(160), active: D(65), recovery: D(210), cooldown: 5000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(20), 8, RLINE(160, 20), { stun: D(320), push: 18, juggleCost: 8 }, { reachUp: 100 })], // (a foot slide, the crown snapped straight at the chest)
    cancelOnHit: ['rd_crown_raise'],
    description: 'A foot slide and the spade crown snaps straight out at his chest — a long, exact poke: your opener.',
    relations: ['Opener', 'Into Crown Raise'],
  }),
  S({
    id: 'rd_crown_raise', cls: 'gambler', style: 'radiant', slot: 2, name: 'Crown Raise', roles: ['launcher', 'antiAir'], targeting: 'aimAssist',
    startup: D(185), active: D(80), recovery: D(280), cooldown: 9000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(20), 12, RLINE(120, 28), { stun: D(700), launch: 105, juggleCost: 18 }, { reachUp: 170, heavy: true })], // (the staff across his body, the ferrule ripped up diagonally: ~420 ms in the air)
    cancelOnHit: ['rd_royal_turn', 'rd_all_in'],
    description: 'The staff across his body, its lower end ripped up on a diagonal: he goes up — it meets a foe over you too. The launcher.',
    relations: ['Launcher', 'Anti-air'],
  }),
  S({ id: 'rd_under_the_table', cls: 'gambler', style: 'radiant', slot: 3, name: 'Under the Table', roles: ['knockdown'], targeting: 'aimAssist', wip: true,
    startup: D(195), active: D(90), recovery: D(260), cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the lower half of the staff swept along the floor at ankle height — he trips and goes down.', relations: ['Trip'] }),
  S({
    id: 'rd_royal_turn', cls: 'gambler', style: 'radiant', slot: 4, name: 'Royal Turn', roles: ['extender', 'pull', 'airExtender'], targeting: 'aimAssist',
    startup: D(165), active: D(125), recovery: D(270), cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(40), 10, RLINE(135, 39), { stun: D(420), pull: 30, float: true, juggleCost: 12 }, { reachUp: 170 })], // (a 270° pivot on the lead foot, the staff braced across him: drawn to his line, floated ~340 ms)
    cancelOnHit: ['rd_crown_raise', 'rd_collect_debt', 'rd_all_in'],
    description: 'A three-quarter pivot on his lead foot with the staff braced across him: one turning blow that draws the foe to his line and holds him up a beat.',
    relations: ['Pull', 'Float'],
  }),
  S({
    id: 'rd_collect_debt', cls: 'gambler', style: 'radiant', slot: 5, name: 'Collect the Debt', roles: ['knockdown', 'extender'], targeting: 'mouseTarget',
    startup: D(235), active: D(65), recovery: D(330), cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 60, lift: 80, crash: true, gap: 70 }, // (the ferrule planted, his body levered up the staff — the crown driven down two-handed)
    hits: [H(D(15), 14, RLINE(170, 30), { stun: D(520), slam: true, knockdown: 'light', juggleCost: 22 }, { reachUp: 210, heavy: true })], // (in the air: slammed into the floor, one bounce; standing: he crumples)
    cancelOnHit: ['rd_curtain_call'],
    description: 'He plants the staff, levers himself up it like a pole vaulter and drives the crown down two-handed: a foe in the air is slammed into the floor and bounces once; a standing one crumples.',
    relations: ['Ground bounce', 'Crumple'],
  }),
  S({
    id: 'rd_all_in', cls: 'gambler', style: 'radiant', slot: 6, name: 'All In: Called Crown', roles: ['signature', 'precision'], targeting: 'aimAssist',
    startup: D(280), active: D(65), recovery: D(385), cooldown: 18000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 17, RLINE(190, 22), { stun: D(650), push: 70, juggleCost: 16 }, { reachUp: 120, heavy: true })], // (the unstaked bet — "Probe": a strong stagger; the House Edge's facets are to come)
    cancelOnHit: ['rd_curtain_call'],
    tags: ['signature'],
    description: 'His signature: the staff level, the grip turned slowly through his palms, a confident nod — then one extraordinarily straight crown thrust. He has told you exactly what is coming.',
    relations: ['Signature', 'Telegraphed thrust'],
  }),
  S({
    id: 'rd_final_ovation', cls: 'gambler', style: 'radiant', slot: 7, name: 'The Final Ovation', roles: ['ultimate', 'finisher'], targeting: 'mouseTarget',
    startup: D(500), active: D(180), recovery: D(590), cooldown: 70000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 90, lift: 90, crash: true, gap: 90 }, // (the Impossible Vault: up and over his planted staff toward him)
    // the Invitation — the Impossible Vault — the Crown Descends — the Impact (GPT): one heavy blow, a hard knockdown, no bounce
    hits: [H(D(10), 48, RLINE(260, 36), { stun: D(800), knockdown: 'heavy', juggleCost: 30 }, { reachUp: 260, heavy: true })],
    cancelOnHit: [], endsCombo: true, tags: ['ultimate'],
    description: 'His ultimate: the staff planted upright like a performer taking his applause — an impossible vault round it — and the crown, swelled into a solid faceted head of light, brought down in one diagonal blow. He straightens his hat.',
    relations: ['Ultimate', 'Hard knockdown'],
  }),
  S({ id: 'rd_read_the_room', cls: 'gambler', style: 'radiant', slot: 8, name: 'Read the Room', roles: ['counter'], targeting: 'self', wip: true,
    startup: D(95), active: D(110), recovery: D(310), cooldown: 13000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the staff held diagonally — a frontal blow is turned aside and answered with a swift ferrule counter.', relations: ['Parry'] }),
  S({ id: 'rd_long_odds', cls: 'gambler', style: 'radiant', slot: 9, name: 'Long Odds', roles: ['projectile'], targeting: 'mouseProjectile', wip: true,
    startup: D(250), active: D(85), recovery: D(305), cooldown: 11000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a thrust from the hip that lets go one compact diamond of light, flying straight and far.', relations: ['Projectile'] }),
  S({ id: 'rd_high_stakes', cls: 'gambler', style: 'radiant', slot: 10, name: 'High-Stakes Vault', roles: ['gapClose'], targeting: 'mouseTarget', wip: true,
    startup: D(185), active: D(95), recovery: D(290), cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the staff planted and a pole vault forward over it, striking with its other end.', relations: ['Gap close'] }),
  S({ id: 'rd_side_bet', cls: 'gambler', style: 'radiant', slot: 11, name: 'Side Bet', roles: ['pull'], targeting: 'mouseDir', wip: true,
    startup: D(190), active: D(75), recovery: D(285), cooldown: 10000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a diagonal step across the floor, the staff guided round his hip into a hooked thrust that pulls.', relations: ['Pull'] }),
  S({
    id: 'rd_curtain_call', cls: 'gambler', style: 'radiant', slot: 12, name: 'Curtain Call', roles: ['finisher', 'knockdown'], targeting: 'aimAssist',
    startup: D(220), active: D(75), recovery: D(360), cooldown: 14000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(20), 15, RLINE(165, 32), { stun: D(600), knockdown: 'heavy', juggleCost: 16 }, { reachUp: 190, heavy: true })], // (the upper end swelled into a thick faceted head, a full two-handed body turn: a hard knockdown — out of the air driven down, no bounce)
    description: 'The staff swung from behind his shoulder in a full two-handed body turn, its crown swelled into a thick faceted head: he is spiked down hard. His hat never moves.',
    relations: ['Finisher', 'Hard knockdown'],
  }),
];

// The Book Mage's second style (David 4 Nov 14:59): the Sailwright, the Wind (GPT's design, scratchpad
// styles/mage_styles.md) — the book unfolded into the Aether Sail, a monumental seven-rib war fan: folded, one long spike for
// thrusts; opened, one strong triangular sail for cuts. "Wind is controlled force, not weather": thin pressure edges, no
// tornado, no storm, no lasting zone. Mid range (90–205), a depth game. His numbers are GPT's (startup / active / recovery,
// the reach X and its depth ±, the juggle costs), the live ones its close launch (Fan Prick → Wane Backhand → Updraft Hook →
// Sail Edge → Cut Across → Keel Drop → Windward Spike); the Tack (the chevron marks a few hits leave, spent for a new angle)
// is still to come. The book's spells stay with the book: his fan's hits carry no element and weave no rune.
const wind: FinalSkill[] = [
  S({
    id: 'mw_four_beat', cls: 'book_mage', style: 'wind', slot: 0, name: 'Four-Beat Airfoil', roles: ['basic', 'confirm'], targeting: 'aimAssist',
    startup: D(120), active: D(60), recovery: D(145), cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 6, RLINE(120, 18), { stun: D(240), push: 6, juggleCost: 4 }, { reachUp: 100 })],
    // point — reverse point — opening fan — upward closing snap: the folded fan's tip pricked in, its back edge whipped
    // across, the fan flared open upward through him, snapped shut on the way up
    chain: { resetMs: 700, stages: [
      [H(0, 6, RLINE(120, 18), { stun: D(240), push: 6, juggleCost: 4 }, { reachUp: 100 })], // Fan Prick: the folded tip pricked straight in (his painted fan reaches 146 px)
      [H(0, 7, RLINE(115, 22), { stun: D(280), push: 12, juggleCost: 5 }, { reachUp: 110 })], // Wane Backhand: the reverse edge
      [H(0, 8, RLINE(130, 28), { stun: D(330), push: 10, juggleCost: 7 }, { reachUp: 130 })], // Rib Rake: the fan flared open, swept upward
      [H(0, 11, RLINE(145, 24), { stun: D(500), launch: 60, juggleCost: 12 }, { reachUp: 150, heavy: true })], // Keel Flick: snapped shut on the way up, a short hop-launch
    ], timings: [{ startup: D(120), active: D(60), recovery: D(145) }, { startup: D(125), active: D(65), recovery: D(150) }, { startup: D(145), active: D(75), recovery: D(165) }, { startup: D(180), active: D(70), recovery: D(220) }] },
    cancelOnHit: ['mw_sail_edge', 'mw_updraft_hook', 'mw_windward_spike'],
    description: 'Tap or hold Space: the folded fan pricked in, its back edge whipped across, the fan flared open upward through the foe — then snapped shut on the way up, lifting him.',
    relations: ['4-beat chain', 'Cancel into a skill on hit'],
  }),
  S({
    id: 'mw_sail_edge', cls: 'book_mage', style: 'wind', slot: 1, name: 'Sail Edge', roles: ['confirm', 'airExtender'], targeting: 'aimAssist',
    startup: D(155), active: D(85), recovery: D(210), cooldown: 3500, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(25), 9, RLINE(155, 22), { stun: D(330), push: 20, juggleCost: 8 }, { reachUp: 150 })], // (one pale pressure blade flung off the open fan's rim: a stagger, a foe in the air carried on)
    cancelOnHit: ['mw_updraft_hook', 'mw_cut_across'],
    description: 'The fan flicked open: one thin pressure blade leaves its rim — the foe staggers, and one in the air is carried on.',
    relations: ['Confirm', 'Air carry'],
  }),
  S({ id: 'mw_luff_step', cls: 'book_mage', style: 'wind', slot: 2, name: 'Luff Step', roles: ['mobility'], targeting: 'mouseDir', wip: true,
    startup: D(145), active: D(70), recovery: D(185), cooldown: 5000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a sidestep across the lane and one diagonal cut as he goes — a new angle.', relations: ['Sidestep'] }),
  S({
    id: 'mw_updraft_hook', cls: 'book_mage', style: 'wind', slot: 3, name: 'Updraft Hook', roles: ['launcher', 'antiAir'], targeting: 'aimAssist',
    startup: D(180), active: D(75), recovery: D(235), cooldown: 7000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(15), 12, RLINE(125, 26), { stun: D(700), launch: 105, juggleCost: 18 }, { reachUp: 170, heavy: true })], // (the folded fan hooked up from below: one rising crescent of air takes him up)
    cancelOnHit: ['mw_sail_edge', 'mw_windward_spike', 'mw_cut_across'],
    description: 'The folded fan hooked up from below him: one rising crescent of air throws the foe up. The launcher.',
    relations: ['Launcher', 'Anti-air'],
  }),
  S({ id: 'mw_skimming_edge', cls: 'book_mage', style: 'wind', slot: 4, name: 'Skimming Edge', roles: ['projectile'], targeting: 'mouseProjectile', wip: true,
    startup: D(190), active: D(95), recovery: D(265), cooldown: 7000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: one low, thin slice of air sent skimming along the floor, far.', relations: ['Low projectile'] }),
  S({ id: 'mw_mastguard', cls: 'book_mage', style: 'wind', slot: 5, name: 'Mastguard', roles: ['counter'], targeting: 'self', wip: true,
    startup: D(65), active: D(180), recovery: D(255), cooldown: 11000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the fan opened before him as a tight sail — one blow or shot glances off it, and he pushes back.', relations: ['Guard', 'Counter'] }),
  S({
    id: 'mw_cut_across', cls: 'book_mage', style: 'wind', slot: 6, name: 'Cut Across', roles: ['signature', 'airExtender'], targeting: 'aimAssist',
    startup: D(245), active: D(110), recovery: D(300), cooldown: 14000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(30), 17, RLINE(205, 34), { stun: D(650), launch: 60, push: 45, juggleCost: 18 }, { reachUp: 190, heavy: true })], // (one huge diagonal sail cut, an S of air: the foe popped up and carried across)
    cancelOnHit: ['mw_keel_drop', 'mw_windward_spike'],
    tags: ['signature'],
    description: 'His signature: the open fan swept through one huge diagonal cut, an S of pale air — the foe is popped up and carried across the lane.',
    relations: ['Signature', 'Air pop', 'Carry'],
  }),
  S({
    id: 'mw_sky_loom', cls: 'book_mage', style: 'wind', slot: 7, name: 'Sky Loom', roles: ['ultimate', 'finisher'], targeting: 'aimAssist',
    startup: D(440), active: D(180), recovery: D(690), cooldown: 85000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // the sail opened overhead, then driven down across him: one gigantic kite-shaped blade of air far down the lane (GPT)
    hits: [H(D(40), 50, RLINE(335, 36), { stun: D(800), push: 60, knockdown: 'heavy', juggleCost: 30 }, { reachUp: 280, heavy: true })], // (a knockdown on the ground, the air's ender)
    cancelOnHit: [], endsCombo: true, tags: ['ultimate'],
    description: 'His ultimate: the fan opened overhead into its full sail, then driven down — one gigantic kite-shaped blade of air goes far down the lane and throws whatever it meets to the floor.',
    relations: ['Ultimate', 'Long reach', 'Knockdown'],
  }),
  S({
    id: 'mw_windward_spike', cls: 'book_mage', style: 'wind', slot: 8, name: 'Windward Spike', roles: ['antiAir', 'extender'], targeting: 'aimAssist',
    startup: D(165), active: D(80), recovery: D(230), cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(10), 10, RLINE(100, 30), { stun: D(450), launch: 55, juggleCost: 12 }, { reachUp: 200 })], // (the folded fan in a reverse grip spiked straight up: a foe above is caught and lifted a little)
    cancelOnHit: ['mw_cut_across', 'mw_keel_drop'],
    description: 'The folded fan turned in a reverse grip and spiked straight up: it meets a foe over him and lifts him a little.',
    relations: ['Anti-air', 'Small lift'],
  }),
  S({ id: 'mw_kite_needle', cls: 'book_mage', style: 'wind', slot: 9, name: 'Kite Needle', roles: ['projectile', 'precision'], targeting: 'mouseProjectile', wip: true,
    startup: D(215), active: D(90), recovery: D(285), cooldown: 9000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: one small, fast kite-shaped dart of air off the fan\'s tip, flying straight and far.', relations: ['Projectile'] }),
  S({ id: 'mw_tackline_draw', cls: 'book_mage', style: 'wind', slot: 10, name: 'Tackline Draw', roles: ['pull'], targeting: 'aimAssist', wip: true,
    startup: D(205), active: D(85), recovery: D(265), cooldown: 10000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a taut line of air hooks the foe and draws him in toward the fan.', relations: ['Pull'] }),
  S({
    id: 'mw_keel_drop', cls: 'book_mage', style: 'wind', slot: 11, name: 'Keel Drop', roles: ['knockdown', 'finisher'], targeting: 'aimAssist',
    startup: D(215), active: D(100), recovery: D(325), cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(20), 14, RLINE(150, 28), { stun: D(520), slam: true, knockdown: 'light', juggleCost: 22 }, { reachUp: 190, heavy: true })], // (the folded fan brought down like a heavy keel: in the air, slammed into the floor, one bounce; standing: he crumples)
    cancelOnHit: ['mw_windward_spike'],
    description: 'The folded fan brought down like a heavy keel: a foe in the air is slammed into the floor and bounces once; a standing one crumples.',
    relations: ['Ground bounce', 'Crumple'],
  }),
  S({ id: 'mw_slipwake', cls: 'book_mage', style: 'wind', slot: 12, name: 'Slipwake', roles: ['escape'], targeting: 'self', wip: true,
    startup: D(135), active: D(75), recovery: D(225), cooldown: 10000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a slide backward, one compressed edge of air swept forward ahead of him.', relations: ['Retreat'] }),
];

// The Book Mage's third style (David 4 Nov 14:59): the Fulminant Conductor, the Lightning (GPT's design, scratchpad
// styles/mage_styles.md) — the book closed, compressed into a dark metal spine and drawn out into the Fulminant Fork, a tall
// conductor staff crowned by two silver prongs: "he no longer summons lightning — he becomes the circuit". A weapon fighter:
// fast contacts, narrow and precise depth, burst combos; no chain lightning, no storm field. Range 90–205 (the needle 300).
// His numbers are GPT's (startup / active / recovery, the reach X, the juggle costs), the live ones its "Polarity execution"
// (tap → contact → Riser Prong → Probe Jab → Closing Stroke → Arc Clamp → Earth Pin → Return Spark); the Polarity (every
// strike + or −: a + hit marks, a − hit snaps the mark for a longer hold) is still to come. The book's spells stay with the book.
const lightning: FinalSkill[] = [
  S({
    id: 'ml_four_beat', cls: 'book_mage', style: 'lightning', slot: 0, name: 'Four-Beat Circuit', roles: ['basic', 'confirm'], targeting: 'aimAssist',
    startup: D(95), active: D(55), recovery: D(130), cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 5, RLINE(120, 16), { stun: D(220), push: 4, juggleCost: 3 }, { reachUp: 100 })],
    // tap — return — thrust — break: a prong tapped in, the fork swung back across, the staff driven straight in, both prongs
    // through him in one flat stroke; faster than the Wind
    chain: { resetMs: 650, stages: [
      [H(0, 5, RLINE(120, 16), { stun: D(220), push: 4, juggleCost: 3 }, { reachUp: 100 })], // Prong Tap (+): one prong tapped in (his painted fork reaches 138 px)
      [H(0, 6, RLINE(115, 20), { stun: D(260), push: 10, juggleCost: 4 }, { reachUp: 110 })], // Cross Contact (−): the fork swung back across
      [H(0, 7, RLINE(140, 16), { stun: D(300), push: 16, juggleCost: 6 }, { reachUp: 110 })], // Rail Jab (+): the straight two-handed thrust
      [H(0, 10, RLINE(170, 20), { stun: D(480), push: 50, launch: 35, juggleCost: 12 }, { reachUp: 140, heavy: true })], // Break Stroke (−): both prongs in one flat stroke — knocked back, a pop off the floor
    ], timings: [{ startup: D(95), active: D(55), recovery: D(130) }, { startup: D(105), active: D(55), recovery: D(140) }, { startup: D(115), active: D(60), recovery: D(155) }, { startup: D(165), active: D(70), recovery: D(205) }] },
    cancelOnHit: ['ml_probe_jab', 'ml_riser_prong', 'ml_return_spark'],
    description: 'Tap or hold Space: a prong tapped in, the fork swung back across, the staff driven straight through — then both prongs in one flat breaking stroke that knocks the foe back.',
    relations: ['4-beat chain', 'Cancel into a skill on hit'],
  }),
  S({
    id: 'ml_probe_jab', cls: 'book_mage', style: 'lightning', slot: 1, name: 'Probe Jab', roles: ['opener', 'precision'], targeting: 'aimAssist',
    startup: D(105), active: D(55), recovery: D(180), cooldown: 3000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(10), 8, RLINE(175, 12), { stun: D(320), push: 12, juggleCost: 7 }, { reachUp: 160 })], // (+: the needle-thin stab, one-handed at full length)
    cancelOnHit: ['ml_closing_stroke', 'ml_riser_prong'],
    description: 'The staff thrust out one-handed at full length: a needle-thin stab of its two prong tips — long, fast, exact.',
    relations: ['Opener', 'Long poke'],
  }),
  S({
    id: 'ml_closing_stroke', cls: 'book_mage', style: 'lightning', slot: 2, name: 'Closing Stroke', roles: ['confirm', 'airExtender'], targeting: 'aimAssist',
    startup: D(145), active: D(70), recovery: D(205), cooldown: 5000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(20), 9, RLINE(150, 20), { stun: D(360), push: 14, juggleCost: 9 }, { reachUp: 160 })], // (−: the fork's U scooped sideways through him: the circuit closes)
    cancelOnHit: ['ml_arc_clamp', 'ml_earth_pin'],
    description: 'The fork turned on its side and scooped sideways through the foe: the U of its prongs closes the circuit.',
    relations: ['Confirm', 'Air follow-up'],
  }),
  S({
    id: 'ml_riser_prong', cls: 'book_mage', style: 'lightning', slot: 3, name: 'Riser Prong', roles: ['launcher', 'antiAir'], targeting: 'aimAssist',
    startup: D(165), active: D(70), recovery: D(245), cooldown: 7000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(15), 12, RLINE(120, 22), { stun: D(700), launch: 105, juggleCost: 18 }, { reachUp: 170, heavy: true })], // (+: out of a crouch, the twin prongs driven straight up through him)
    cancelOnHit: ['ml_probe_jab', 'ml_return_spark', 'ml_arc_clamp'],
    description: 'Out of a crouch, both hands drive the twin prongs straight up through the foe: he goes up. The launcher.',
    relations: ['Launcher', 'Anti-air'],
  }),
  S({ id: 'ml_blue_needle', cls: 'book_mage', style: 'lightning', slot: 4, name: 'Blue Needle', roles: ['projectile', 'precision'], targeting: 'mouseProjectile', wip: true,
    startup: D(200), active: D(70), recovery: D(250), cooldown: 7000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, hits: [],
    description: 'Coming soon: one fast, perfectly straight electric needle from the joined prong tips, far down the lane.', relations: ['Projectile'] }),
  S({ id: 'ml_faraday_fold', cls: 'book_mage', style: 'lightning', slot: 5, name: 'Faraday Fold', roles: ['counter'], targeting: 'self', wip: true,
    startup: D(75), active: D(160), recovery: D(245), cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: the prongs folded into a V before him — one blow or shot is turned aside and answered with a stab.', relations: ['Guard', 'Counter'] }),
  S({
    id: 'ml_arc_clamp', cls: 'book_mage', style: 'lightning', slot: 6, name: 'Arc Clamp', roles: ['signature', 'airExtender'], targeting: 'aimAssist',
    startup: D(225), active: D(85), recovery: D(310), cooldown: 15000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(25), 16, RLINE(205, 24), { stun: D(620), launch: 45, juggleCost: 17 }, { reachUp: 190, heavy: true })], // (+: the two prongs close round one foe like a clamp: a stagger and a soft loft — one strike)
    cancelOnHit: ['ml_earth_pin', 'ml_return_spark'],
    tags: ['signature'],
    description: 'His signature: the staff driven out with both hands and the two prongs closing round one foe like a clamp — one brief spark where they meet, and he is lifted softly.',
    relations: ['Signature', 'Soft loft'],
  }),
  S({
    id: 'ml_zero_interval', cls: 'book_mage', style: 'lightning', slot: 7, name: 'Zero Interval', roles: ['ultimate', 'finisher'], targeting: 'aimAssist',
    startup: D(415), active: D(160), recovery: D(700), cooldown: 85000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // braced, the rear foot planted — then one huge straight conductor thrust: a single brilliant rail of current (GPT)
    hits: [H(D(20), 50, RLINE(340, 28), { stun: D(800), push: 50, knockdown: 'light', juggleCost: 30 }, { reachUp: 220, heavy: true })], // (standing: he crumples; in the air: driven down)
    cancelOnHit: [], endsCombo: true, tags: ['ultimate'],
    description: 'His ultimate: the rear foot planted, then one huge straight thrust of the forked staff — a single brilliant rail of current runs far down the lane for a fraction of a second.',
    relations: ['Ultimate', 'Long reach', 'Crumple'],
  }),
  S({
    id: 'ml_return_spark', cls: 'book_mage', style: 'lightning', slot: 8, name: 'Return Spark', roles: ['antiAir', 'extender'], targeting: 'aimAssist',
    startup: D(140), active: D(70), recovery: D(210), cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(10), 10, RLINE(115, 24), { stun: D(450), launch: 50, juggleCost: 11 }, { reachUp: 200 })], // (−: the rising V counter-cut: a foe above is caught and popped a little)
    cancelOnHit: ['ml_arc_clamp', 'ml_earth_pin'],
    description: 'The staff swung up from low behind him in a rising V: it meets a foe over him and pops him a little.',
    relations: ['Anti-air', 'Small pop'],
  }),
  S({ id: 'ml_rail_slide', cls: 'book_mage', style: 'lightning', slot: 9, name: 'Rail Slide', roles: ['gapClose'], targeting: 'mouseDir', wip: true,
    startup: D(170), active: D(70), recovery: D(230), cooldown: 9000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a slide forward with the staff held level like an electric lance.', relations: ['Gap close'] }),
  S({ id: 'ml_insulator_split', cls: 'book_mage', style: 'lightning', slot: 10, name: 'Insulator Split', roles: ['projectile'], targeting: 'aimAssist', wip: true,
    startup: D(185), active: D(90), recovery: D(265), cooldown: 9000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: one angular two-prong pressure strike projected forward off the fork.', relations: ['Mid range'] }),
  S({
    id: 'ml_earth_pin', cls: 'book_mage', style: 'lightning', slot: 11, name: 'Earth Pin', roles: ['knockdown', 'finisher'], targeting: 'aimAssist',
    startup: D(225), active: D(80), recovery: D(320), cooldown: 12000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(D(20), 14, RLINE(150, 24), { stun: D(520), slam: true, knockdown: 'light', juggleCost: 23 }, { reachUp: 190, heavy: true })], // (−: the fork driven down to pin the floor: in the air, slammed down, one bounce; standing: he crumples)
    cancelOnHit: ['ml_return_spark'],
    description: 'The staff driven down two-handed so the fork pins the floor: a foe in the air is slammed into it and bounces once; a standing one crumples.',
    relations: ['Ground bounce', 'Crumple'],
  }),
  S({ id: 'ml_capacitor_kick', cls: 'book_mage', style: 'lightning', slot: 12, name: 'Capacitor Kick', roles: ['escape'], targeting: 'aimAssist', wip: true,
    startup: D(155), active: D(80), recovery: D(260), cooldown: 10000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, hits: [],
    description: 'Coming soon: a close heel kick braced on the staff, and a step back out of reach.', relations: ['Retreat'] }),
];

export const FINAL_SKILLS: FinalSkill[] = [...warrior, ...siege, ...mage, ...wind, ...lightning, ...archer, ...sniper, ...cannon, ...samurai, ...shuriken, ...gambler, ...radiant];
/** The switches into the styles (Styles.ts): a hidden cast each, never on the bar. 150 ms to the change, 240 ms in all, on
 *  the clock (its kit numbers are the fight's pace undone); no hits; she keeps her momentum. */
export const STYLE_SWITCHES: FinalSkill[] = Object.entries(STYLES).flatMap(([cls, list]) => list.map((st) => S({
  id: switchId(cls, st.id), cls: cls as FinalSkill['cls'], slot: -1, name: st.name, roles: ['mobility'], targeting: 'self',
  startup: D(SWITCH.commitMs), active: 0, recovery: D(SWITCH.totalMs - SWITCH.commitMs), cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER',
  move: { startup: 0.5, active: 0.5, recovery: 0.8 }, hits: [], description: `Switch to ${st.name}.`, relations: [],
})));
// the blow that ends each skill (the foe is sent back on it: Combat, THROWN)
for (const s of [...FINAL_SKILLS, ...mageBolts, ARCHER_STREAM]) {
  const list = s.chain ? s.chain.stages[s.chain.stages.length - 1] : s.hits, last = list?.[list.length - 1];
  if (last) last.lastBlow = true;
}
const BY_ID = new Map([...FINAL_SKILLS, ...mageBolts, ...Object.values(MAGE_HIDDEN), ARCHER_STREAM, ...STYLE_SWITCHES].map((s) => [s.id, s]));
/** Old ids from earlier builds (save-data / QA migration only; never shown in the HUD/tree). */
export const LEGACY_ALIASES: Record<string, string> = {
  iron_grip: 'thunder_circle', kinetic_grab: 'light_staff', all_in: 'long_guard', triple_down: 'staff_flurry', page_bind: 'rift_gates', // (David 18 Oct 01:42 / 01:26: replaced)
  final_strike: 'titans_verdict', meteor: 'storm_field', time_warp: 'time_collapse', wind_step: 'skyhunters_step',
  natures_wrath: 'sky_rain', verdant_judgment: 'sky_rain', dragon_slash: 'dragon_eclipse',
};

export function finalSkill(id: string): FinalSkill | undefined { return BY_ID.get(id) ?? BY_ID.get(LEGACY_ALIASES[id] ?? ''); }
/** A class's kit in one of its styles (Styles.ts; none / its first: the class's own kit), in slot order. */
export function kitFor(cls: string, style?: string): FinalSkill[] {
  const st = style && style !== baseStyle(cls) ? style : undefined;
  return FINAL_SKILLS.filter((s) => s.cls === cls && s.style === st).sort((a, b) => a.slot - b.slot);
}
export const isSignature = (s: FinalSkill) => s.slot === 6;
export const isUltimate = (s: FinalSkill) => s.slot === 7;
export function iconUrl(s: FinalSkill): string { return `assets/final/skills/${s.cls}/${s.id}/icon.png`; }
export function totalDamage(s: FinalSkill): number { return s.hits.reduce((a, h) => a + h.damage, 0); }
export function lockMs(s: FinalSkill, stage = 0): number {
  const t = s.chain?.timings?.[stage] ?? s;
  return t.startup + t.active + t.recovery;
}
