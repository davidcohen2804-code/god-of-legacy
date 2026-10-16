// Final 4-class kits (03_FINAL_CLASS_SKILL_ROSTER.md): exact ids, slots, timings, damage, cooldowns, air/ground use.
// Shape sub-parameters the roster leaves open (ranges / radii / angles) are fixed here once and reused by the telegraph,
// the hit resolver and the VFX placement, so telegraph == hitbox by construction.
import { FinalSkill, HitEvent, HitShape, PVP_MULT, Reaction } from './SkillTypes';
import { jobOfSlot } from './Jobs';

const H = (at: number, damage: number, shape: HitShape, reaction: Reaction, extra: Partial<HitEvent> = {}): HitEvent => ({ at, damage, shape, reaction, ...extra });
const LOCK = { startup: 0, active: 0, recovery: 0 };
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
    dash: { distance: 210 }, through: true,
    hits: [0, 50, 100].map((t, i) => H(t, i === 2 ? 10 : 7, { kind: 'capsule', radius: 32 }, { stun: 240, push: i === 2 ? 10 : 2, float: true, juggleCost: 4 }, { reachUp: 90 })),
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
    cancelOnHit: ['warrior_basic', 'rising_slash', 'dash_slash', 'blade_storm', 'iron_grip', 'sky_breaker', 'ground_breaker'], tags: ['buff'],
    description: 'Trace a half-circle on the ground with your sword: a wall of light rises in front of you for 4s. While you stand behind it every hit deals half damage to you; the wall stays where it was cast.',
    relations: ['Wall 4s', 'Half damage behind it'],
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
    hits: [H(0, 18, { kind: 'projectile', speed: 400, range: 520, radius: 22, pierce: true, count: 1, spread: 0 }, { stun: 320, launch: 80, juggleCost: 10 }, { reachUp: 120 })],
    cancelOnHit: ['dash_slash', 'leap_crash', 'lance_thrust'],
    description: 'Charge the blade for an instant, then release a crescent shockwave along your line; it pierces, and any target it catches is popped into the air.',
    relations: ['Ranged check', 'Pierces'],
  }),
  S({
    id: 'lance_thrust', cls: 'warrior', slot: 10, name: 'Impaling Rush', roles: ['extender', 'peel'], targeting: 'mouseDir',
    startup: 160, active: 420, recovery: 300, cooldown: 3500, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 70 },
    hits: [0, 70, 140, 210, 280, 380].map((t, i) => H(t, i === 5 ? 16 : 4, { kind: 'sector', range: 80, angle: 100 }, i === 5 ? { stun: 420, push: 45 } : { stun: 320 }, { reachUp: 140, heavy: i === 5 })),
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
    startup: 150, active: 320, recovery: 240, cooldown: 9000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    charges: 1, chargeGap: 120,
    hits: [H(140, 14, { kind: 'circle', radius: 80, at: 'aimBias', bias: 150 }, { stun: 420, pin: 400, slam: true }, { reachUp: 280, heavy: true })],
    linger: { at: 'aim', offset: 150, startMs: 520, everyMs: 500, count: 10, radius: 130, maxZ: 40, hit: H(0, 3, { kind: 'circle', radius: 130 }, { stun: 150, bind: 1100 }, { reachUp: 40 }) }, // (the court holds once a combo: its bind; its other ticks only flinch)
    cancelOnHit: ['warrior_basic', 'rising_slash', 'leap_crash', 'lance_thrust', 'blade_storm'],
    description: 'Leap and hurl a judgment blade (it lands in under half a second; an airborne foe is slammed into a bounce). It stays planted for 5s inside a storm ring: a foe who comes down into it is chained upright once per combo — beat him, then launch him again.',
    relations: ['Zone 5s', 'Root → free combo'],
  }),
  // ---- new kit (Z X B N): the grab, the hook, the air chase, the charged fissure (own timings: not stretched)
  S({
    id: 'iron_grip', cls: 'warrior', slot: 13, name: 'Iron Grip', roles: ['opener', 'extender'], targeting: 'mouseDir',
    startup: 120, active: 420, recovery: 300, cooldown: 4000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, armor: [0, 540],
    hits: [H(0, 6, { kind: 'sector', range: 110, angle: 90 }, { stun: 800, grab: true }, { reachUp: 140 }),
      H(330, 16, { kind: 'circle', radius: 110, at: 'aimBias', bias: 60 }, { stun: 440, launch: 100, juggleCost: 20 }, { reachUp: 220, heavy: true })],
    cancelOnHit: ['rising_slash', 'leap_crash', 'sky_breaker', 'wave_slash', 'whirlwind'],
    description: 'Seize the foe in front of you with a hand of golden light, hoist it high over your head and smash it into the floor before you; it bounces up, open for the next strike.',
    relations: ['Grab', 'Bounce → combo'],
  }),
  S({
    id: 'judgment_hook', cls: 'warrior', slot: 14, name: 'Judgment Hook', roles: ['pull', 'gapClose'], targeting: 'mouseDir',
    startup: 140, active: 260, recovery: 240, cooldown: 7000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(90, 10, { kind: 'line', length: 300, width: 46 }, { stun: 560, grab: true }, { reachUp: 160 })],
    cancelOnHit: ['warrior_basic', 'iron_grip', 'dash_slash', 'rising_slash', 'whirlwind', 'ground_breaker', 'lance_thrust'],
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
    cancelOnHit: ['leap_crash', 'iron_grip', 'judgment_hook', 'whirlwind', 'blade_storm'],
    description: 'Spring into the air after your foe: three rising slashes keep it floating, then a crushing downward strike smashes it into the floor so it bounces back up.',
    relations: ['Air chase', 'Slam → bounce'],
  }),
  S({
    id: 'earthsplitter', cls: 'warrior', slot: 16, name: 'Earthsplitter', roles: ['finisher', 'knockdown'], targeting: 'mouseCone',
    startup: 800, active: 320, recovery: 380, cooldown: 10000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1100],
    // hold the key: the sword raised overhead charges (160..800 ms); the level picks how far and wide the fissure tears
    hits: [H(0, 16, { kind: 'sector', range: 200, angle: 70 }, { stun: 420, knockdown: 'heavy' }, { reachUp: 120, heavy: true })],
    charge: { minMs: 160, levels: [
      { at: 0, hits: [H(0, 16, { kind: 'sector', range: 200, angle: 70 }, { stun: 420, knockdown: 'heavy' }, { reachUp: 120, heavy: true })] },
      { at: 350, hits: [H(0, 22, { kind: 'sector', range: 280, angle: 80 }, { stun: 460, knockdown: 'heavy' }, { reachUp: 140, heavy: true }),
        H(150, 8, { kind: 'sector', range: 300, angle: 90 }, { stun: 380 }, { reachUp: 220 })] },
      { at: 700, hits: [H(0, 28, { kind: 'sector', range: 360, angle: 90 }, { stun: 500, knockdown: 'heavy', grab: true }, { reachUp: 160, heavy: true }), // (full charge: breaks super armor)
        H(150, 8, { kind: 'sector', range: 380, angle: 95 }, { stun: 400 }, { reachUp: 260 }),
        H(300, 8, { kind: 'sector', range: 380, angle: 95 }, { stun: 400 }, { reachUp: 300 })] },
    ] },
    cancelOnHit: ['sky_breaker', 'blade_storm', 'titans_verdict'],
    description: 'Hold the key: you raise your sword overhead as the ground trembles, in three steps. Release: you split the earth — a wide fissure tears across the floor in front of you and pillars of light burst out of it, smashing every foe flat; the longer you held, the farther and wider — a full charge breaks super armor. A punish, not a combo link.',
    relations: ['Hold to charge (3 levels)', 'Wide launcher'],
  }),
  S({
    // the answer to shots from afar: a barrier of light raised before him, he charges in behind it — shots break on it, a blade
    // still lands (shotArmor); no damage, the grab or the regular attack right at the end of the run
    id: 'shield_charge', cls: 'warrior', slot: 18, name: 'Shield Charge', roles: ['gapClose', 'mobility'], targeting: 'mouseDir',
    startup: 60, active: 260, recovery: 200, cooldown: 6000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 160 }, shotArmor: [0, 180],
    hits: [],
    cancelOnHit: ['iron_grip', 'warrior_basic'],
    description: 'Raise a barrier of light before you and charge 160px forward behind it: for a moment shots break on it (a blade still lands). No damage — the run ends right in grab range: Iron Grip or a regular attack follow at once.',
    relations: ['Gap close', 'Breaks shots'],
  }),
  S({
    id: 'lions_maw', cls: 'warrior', slot: 17, name: "Lion's Maw", roles: ['airExtender', 'extender'], targeting: 'mouseTarget',
    startup: 150, active: 520, recovery: 220, cooldown: 9000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    // the warrior roars and his lion of light pounces through the foe: a bite, a raking claw, a dive — and slams it into a bounce
    hits: [H(120, 8, { kind: 'circle', radius: 120, at: 'aimBias', bias: 130 }, { stun: 460, float: true, pull: 40, juggleCost: 4 }, { reachUp: 320 }),
      H(240, 8, { kind: 'circle', radius: 120, at: 'aimBias', bias: 130 }, { stun: 460, float: true, juggleCost: 4 }, { reachUp: 320 }), // (holds him up: it no longer spends a re-launch the chase after it needs)
      H(330, 6, { kind: 'circle', radius: 120, at: 'aimBias', bias: 130 }, { stun: 440, float: true }, { reachUp: 320 }),
      H(450, 16, { kind: 'circle', radius: 140, at: 'aimBias', bias: 130 }, { stun: 520, float: true, pull: 30 }, { reachUp: 320, heavy: true })], // (the lion drags him back and holds him: no launch, no slam)
    cancelOnHit: ['rising_slash', 'sky_breaker', 'iron_grip', 'lance_thrust', 'ground_breaker', 'blade_storm', 'titans_verdict', 'leap_crash'],
    description: 'Roar, and a lion of golden light pounces from your side through the foe in front of you — a bite, a raking claw, a dive — dragging it back toward you and holding it where it is. Usable in the air.',
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
    [H(0, 9, { kind: 'projectile', speed: sp, range: 480, radius: 12 }, { stun: 220, push: 4 }, { ...e })],
    [H(0, 9, { kind: 'projectile', speed: sp, range: 480, radius: 12 }, { stun: 240, push: 5 }, { ...e })],
    [H(0, 18, { kind: 'projectile', speed: sp + 140, range: 520, radius: 20, pierce: true }, { stun: 380, push: 30 }, { heavy: true, ...e })],
  ];
}
const mage: FinalSkill[] = [
  S({
    id: 'arcane_bolt', cls: 'book_mage', slot: 0, name: 'Arcane Bolt', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
    startup: 80, active: 0, recovery: 120, cooldown: 0, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: { startup: 0.8, active: 0.8, recovery: 0.8 },
    hits: boltStages()[0],
    // a three-beat rhythm: two quick bolts, then a heavy arcane lance that pierces, throws the foe back (and shatters the frozen)
    chain: { resetMs: 650, stages: boltStages(), timings: [{ startup: 80, active: 0, recovery: 120 }, { startup: 70, active: 0, recovery: 130 }, { startup: 170, active: 0, recovery: 230 }] },
    cancelOnHit: ['arcane_wave', 'astral_burst', 'blink', 'frost_nova', 'lightning_chain', 'glacial_spikes'],
    description: 'Tap or hold Space: two quick bolts, then a heavy arcane lance that flies through foes and throws them back. You keep walking while you cast (80% speed). From the 2nd job they take the element of your last spell (Attunement): frost bolts chill, storm bolts conduct.',
    relations: ['3-beat chain', 'Lance shatters the frozen'],
  }),
  S({
    id: 'arcane_wave', cls: 'book_mage', slot: 1, name: 'Arcane Wave', roles: ['confirm', 'peel'], targeting: 'mouseLine',
    startup: 150, active: 180, recovery: 180, cooldown: 4000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 24, { kind: 'line', length: 230, width: 110 }, { stun: 260, launch: 90, float: true, juggleCost: 12 }, { reachUp: 170 })],
    cancelOnHit: ['astral_burst', 'lightning_chain', 'blink', 'glacial_spikes'], telegraph: 'line',
    description: 'A wide, short wave across the floor that lifts a foe on the ground into the air, low and in reach of your next spell; a foe already in the air is bounced up again.',
    relations: ['Lifts a grounded foe', 'Bounces one in the air'],
  }),
  S({
    id: 'binding_rune', cls: 'book_mage', slot: 2, name: 'Binding Rune', roles: ['trap', 'setup', 'hardCC'], targeting: 'mouseGround',
    startup: 200, active: 100, recovery: 160, cooldown: 9000, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 300, charges: 2, chargeGap: 260, trap: { radius: 46, lifeMs: 10000 },
    hits: [H(0, 12, { kind: 'placed', radius: 46 }, { hardCC: { kind: 'stun', ms: 500, long: true }, stun: 120 }, { reachUp: 40 })],
    cancelOnHit: [], telegraph: 'ground',
    description: 'Lay up to 2 runes on the floor (10s each). Stepping on one stuns the foe for 0.5s. Two runes close together join in a beam of light: whoever crosses it is bound and shocked, and the beam breaks.',
    relations: ['Rune net', 'Stun 0.5s'],
  }),
  S({
    id: 'astral_burst', cls: 'book_mage', slot: 3, name: 'Astral Lift', roles: ['launcher', 'pull'], targeting: 'selfAim',
    startup: 180, active: 140, recovery: 220, cooldown: 6000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 28, { kind: 'circle', radius: 120, at: 'aimBias', bias: 80 }, { stun: 420, pull: 44, launch: 130, juggleCost: 30 }, { reachUp: 130, heavy: true })],
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
      i === 3 ? { stun: 280, launch: 105, slow: { pct: 0.2, ms: 600 }, juggleCost: 30 } : { stun: 540, pull: 10, slow: { pct: 0.2, ms: 600 }, juggleCost: 6 }, { reachUp: 160, heavy: i === 3, el: STORM })),
    zoneMs: 1500, cancelOnHit: ['time_collapse', 'astral_burst', 'lightning_chain'], tags: ['signature'], telegraph: 'ground',
    description: 'A storm field where you aim: four pulses slow and draw foes toward its centre, the last one throws them up. It conducts through the chilled. You are free to move while it rages.',
    relations: ['Signature', 'Zone'],
  }),
  S({
    id: 'time_collapse', cls: 'book_mage', slot: 7, name: 'Time Collapse', roles: ['ultimate', 'finisher'], targeting: 'mouseGround',
    startup: 900, active: 1300, recovery: 480, cooldown: 36000, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 300,
    hits: [
      H(0, 0, { kind: 'placed', radius: 175 }, { pull: 40 }),
      H(260, 6, { kind: 'placed', radius: 165 }, { pull: 30, hardCC: { kind: 'freeze', ms: 1000, long: true } }),
      H(1250, 60, { kind: 'placed', radius: 170 }, { stun: 420, knockdown: 'heavy' }, { reachUp: 200, heavy: true }),
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
    hits: [H(0, 8, { kind: 'projectile', speed: 460, range: 520, radius: 16, count: 5, spread: 70, homing: 150 }, { stun: 220, push: 6, float: true, juggleCost: 3 }, { reachUp: 160 })],
    cancelOnHit: ['levity_field', 'paper_curse', 'blink', 'arcane_bolt'],
    description: 'Five pages tear out of the book and fold into paper cranes. Each crane picks a foe and bends a little toward it — a step aside still slips them.',
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
    description: 'A SILENCE: pages fold a foe into a paper crane for 1.2s — it walks and jumps freely but cannot attack or use skills. It holds nothing in place, so it does not extend a combo. A heavy blow unfolds it early. A monster turned into a crane takes 30% more damage.',
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
    id: 'page_bind', cls: 'book_mage', slot: 18, name: 'Page Bind', roles: ['confirm', 'setup'], targeting: 'mouseDir',
    startup: 140, active: 100, recovery: 180, cooldown: 7000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 16, { kind: 'sector', range: 120, angle: 100 }, { stun: 380, push: 4, juggleCost: 10 }, { reachUp: 100, el: FROST })],
    cancelOnHit: ['blink', 'arcane_bolt', 'lightning_chain', 'glacial_spikes'], telegraph: 'cone',
    description: 'The book slams shut on a foe in front of you: frozen pages stick to it, and your next two spells CHILL it. Then you spring back out of reach. A miss leaves you open for a moment.',
    relations: ['Next 2 spells chill', 'Springs back'],
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
    hits: [H(120, 12, { kind: 'projectile', speed: 1000, range: 300, radius: 11, antiAir: true }, { stun: 220, push: 8 }, { mark: 1 })],
    cancelOnHit: ['quick_shot', 'hunters_spirit', 'rising_arrow', 'explosive_arrow'],
    description: 'A back flip out of reach — at the top of it she looses one arrow at the foe, leaves trailing behind her. Keep your distance.',
    relations: ['Keep distance', 'From the basic / Kick'],
  }),
  S({
    id: 'retreat_kick', cls: 'archer', slot: 5, name: 'Retreat Kick', roles: ['launcher'], targeting: 'mouseCone',
    startup: 110, active: 420, recovery: 200, cooldown: 4000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 200], // her answer up close
    dash: { distance: -60, lift: 40 }, // (a short hop: the launcher up close, not an escape)
    hits: [H(0, 16, { kind: 'sector', range: 110, angle: 110 }, { stun: 460, launch: 150, juggleCost: 28 }, { reachUp: 100 })],
    cancelOnHit: ['quick_shot', 'multi_shot', 'piercing_arrow', 'skyhunters_step', 'eagle_arrow', 'leaping_arrow'],
    description: 'A rising kick of wind launches the foe into the air while you flip backward out of reach — then shoot him down.',
    relations: ['Launcher', 'Escape'],
  }),
  S({
    id: 'vine_trap', cls: 'archer', slot: 8, name: 'Vine Mine', roles: ['trap', 'setup', 'launcher'], targeting: 'mouseGround',
    startup: 220, active: 280, recovery: 160, cooldown: 7000, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    dash: { distance: -130, lift: 38 }, // plants the mine and hops back away from it
    placeRange: 260, trap: { radius: 90, lifeMs: 4000, fuseMs: 2000 },
    hits: [H(0, 0, { kind: 'placed', radius: 90 }, { hardCC: { kind: 'root', ms: 2000, long: true }, stun: 120, catch: true }),
      H(0, 32, { kind: 'placed', radius: 110 }, { stun: 700, launch: 150, juggleCost: 30 }, { reachUp: 200, heavy: true })],
    cancelOnHit: [], telegraph: 'ground',
    description: 'A vine mine buried in the floor. Whoever steps on it — a player or a whole pack of monsters — is held, and 2s later it explodes and throws them all very high; untouched, it goes off by itself after 4s.',
    relations: ['Setup', 'High launcher'],
  }),
  // ---- 3rd job (Ranger)
  S({
    id: 'skyhunters_step', cls: 'archer', arenaDmg: 0.85, slot: 6, name: 'Air Volley', roles: ['signature', 'mobility', 'chase'], targeting: 'mouseDir',
    startup: 260, active: 1150, recovery: 300, cooldown: 16000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 320, lift: 170 },
    hits: [120, 340, 560, 780, 1000].map((t, i) => H(t, [8, 8, 9, 9, 10][i], { kind: 'projectile', speed: 760, range: 420, radius: 9, rows: 3, rowGap: 52 }, { stun: 300, float: true, juggleCost: 12 }, { mark: i === 4 ? 1 : 0 })),
    cancelOnHit: ['sky_rain'], tags: ['signature'], telegraph: 'trajectory',
    description: 'Acrobatic leap in the facing direction while firing five shots from the air — keeps a launched foe up.',
    relations: ['Signature', 'Air combo'],
  }),
  S({
    id: 'rain_of_arrows', cls: 'archer', arenaDmg: 0.85, slot: 9, name: 'Thunder Rain', roles: ['zone', 'extender'], targeting: 'mouseDir',
    startup: 300, active: 1200, recovery: 300, cooldown: 12000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [300, 900],
    dash: { distance: 0, lift: 150, hang: true },
    linger: { at: 'aim', offset: 300, startMs: 1000, everyMs: 80, count: 26, radius: 210, maxZ: 50, once: true, hit: H(0, 6, { kind: 'circle', radius: 210 }, { stun: 320, launch: 110, juggleCost: 10, slow: { pct: 30, ms: 500 } }, { reachUp: 50 }) }, // the charged floor throws whoever lands on it back up (once each)
    hits: [600, 750, 900].map((t, i) => H(t, i === 2 ? 16 : 12, { kind: 'circle', radius: 110, at: 'aimBias', bias: [60, 140, 220][i] }, { stun: 320, float: true, juggleCost: 10, slow: { pct: 30, ms: 800 } }, { reachUp: 320, heavy: i === 2, useMark: i === 2 ? 'stun' as const : undefined })),
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
    description: 'Summons a spirit hawk that roams the sky around you for 20s and every few seconds dives on a foe by itself.',
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
    startup: 550, active: 3000, recovery: 300, cooldown: 14000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 550],
    placeRange: 420, // a zone that holds a foe far from her
    hits: Array.from({ length: 15 }, (_, i) => H(i * 200, 7, { kind: 'placed', radius: 115 }, { stun: 240, float: true, juggleCost: 4, slow: { pct: 30, ms: 500 } }, { reachUp: 180 })),
    cancelOnHit: ['quick_shot', 'sky_rain'],
    description: 'Fire dozens of arrows into the sky: for 3s they rain down on a marked spot on the floor, and the direction you hold steers the mark anywhere around you while you stand your ground.',
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
    hits: [H(0, 22, { kind: 'capsule', radius: 28 }, { stun: 300, push: 8 }, { reachUp: 200 })], // (the cut as he passes through; then Quick Slash / Swallow Cut / Iai, turned back toward him)
    cancelOnHit: ['quick_slash', 'swallow_cut', 'iai_strike', 'sheathe', 'blossom_storm', 'dragon_eclipse'], telegraph: 'line',
    description: 'Step through the foe in a blink, cutting as you pass, and land behind it facing it — your opener from the distance fights start at. Two steps in a row, then the cooldown.',
    relations: ['Opener: through the foe', 'Cancel → Quick Slash · Swallow · Iai'],
  }),
  S({
    id: 'sheathe', cls: 'samurai', slot: 2, name: 'Sheathe', roles: ['setup'], targeting: 'self',
    startup: 40, active: 90, recovery: 20, cooldown: 3000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    // a 150 ms stance (its last 10 ms already open to the next cut: no frame of a bare blade between), cancelled into from any hit: the blade snaps home in its sheath with a click — and for 0.6 s after
    // it the next Iai Strike or Quick Slash leaves the sheath at once (SkillRuntime: primes), the Iai one charge level higher
    hits: [], primes: { ids: ['iai_strike', 'quick_slash'], windowMs: 600, chargeUp: 1 },
    cancelOnHit: ['iai_strike', 'quick_slash'],
    description: 'Snap the blade home in its sheath with a click: a 150 ms stance you can cancel into from any hit. For 0.6s after it, your next Iai Strike or Quick Slash leaves the sheath at once — no wind-up — and the Iai Strike one charge level higher.',
    relations: ['Cancel from any hit', 'Next Iai / Quick Slash: instant'],
  }),
  S({
    id: 'iai_strike', cls: 'samurai', slot: 3, name: 'Iai Strike', roles: ['precision', 'finisher'], targeting: 'mouseLine',
    startup: 900, active: 80, recovery: 260, cooldown: 5500, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // hold the key: the drawing stance charges (startup = how long it was held, 130..900 ms); the level picks the cut
    hits: [H(0, 30, { kind: 'line', length: 200, width: 36 }, { stun: 380, push: 12 }, { reachUp: 200, heavy: true })],
    charge: { minMs: 130, levels: [
      { at: 0, hits: [H(0, 30, { kind: 'line', length: 200, width: 36 }, { stun: 380, push: 12 }, { reachUp: 200, heavy: true })] }, // (the draw from afar: his opener)
      { at: 340, hits: [H(0, 44, { kind: 'line', length: 230, width: 40 }, { stun: 420, knockdown: 'light', push: 14 }, { reachUp: 210, heavy: true })] },
      { at: 680, hits: [H(0, 64, { kind: 'line', length: 320, width: 48 }, { stun: 460, knockdown: 'heavy', push: 18 }, { reachUp: 220, heavy: true })] },
    ] },
    cancelOnHit: ['shadow_step', 'sword_wave', 'blossom_storm', 'dragon_eclipse'], // (its reach is drawn by its own charge picture, SkillFx.iai; the draw from afar → Shadow Step through him)
    description: 'Hold the key: your hand on the sheath, a glint grows in three steps. Release: a lightning draw-cut along a line — the longer you held, the farther and harder it cuts; fully charged, every foe in the line crumples to the floor.',
    relations: ['Hold to charge (3 levels)', 'Knockdown'],
  }),
  S({
    id: 'sword_wave', cls: 'samurai', slot: 4, name: 'Sword Wave', roles: ['projectile'], targeting: 'mouseProjectile',
    startup: 150, active: 0, recovery: 180, cooldown: 6000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 26, { kind: 'projectile', speed: 800, range: 380, radius: 18 }, { stun: 230, push: 12, float: true, juggleCost: 15 })],
    cancelOnHit: ['shadow_step', 'blossom_storm'],
    description: 'Fling a crimson crescent of steel that flies fast and pops the foe up — one at a time (once in a combo). Walls stop it.',
    relations: ['One at a time', 'Pop-up'],
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
    startup: 80, active: 330, recovery: 200, cooldown: 9000, ground: false, air: true, cover: 'IGNORES_COVER', move: LOCK,
    // in the air only: he spins into a whirlwind of blades round himself — it meets a foe jumping at him: two cuts hold him
    // there, the third smashes him down to the floor (no pull: it takes only who is there)
    hits: [H(0, 10, { kind: 'circle', radius: 100 }, { stun: 320, float: true, juggleCost: 6 }, { reachUp: 130 }),
      H(110, 10, { kind: 'circle', radius: 100 }, { stun: 320, float: true, juggleCost: 6 }, { reachUp: 130 }),
      H(230, 16, { kind: 'circle', radius: 110 }, { stun: 420, slam: true }, { reachUp: 140, heavy: true })],
    cancelOnHit: ['quick_slash', 'swallow_cut', 'hundred_cuts', 'iai_strike'], telegraph: 'circle',
    description: 'In the air only: spin into a whirlwind of blades around you. It meets a foe jumping at you — two cuts hold him there, the third smashes him down to the floor.',
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
    description: 'Your defensive ultimate: raise the banner of the Rising Sun. While the sun rises behind you nothing can touch you, and its light throws every foe around you back and holds them a moment.',
    relations: ['Untouchable while it rises', 'Throws foes back'],
  }),
  S({
    id: 'phantom_blades', cls: 'samurai', slot: 14, name: 'Phantom Blades', roles: ['zone'], targeting: 'mouseCone',
    startup: 420, active: 640, recovery: 340, cooldown: 18000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 420],
    hits: [...[0, 80, 160, 240, 320, 400, 480].map((t) => H(t, 7, { kind: 'circle', radius: 140, at: 'aimBias', bias: 150 }, { stun: 400, float: true, juggleCost: 3 }, { reachUp: 280 })),
      H(600, 22, { kind: 'circle', radius: 146, at: 'aimBias', bias: 150 }, { stun: 420, float: true, juggleCost: 4 }, { reachUp: 280, heavy: true })], // (a zone: no lift at the end — not a combo's finisher)
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
    description: 'Eight spectral katanas rise behind you for 30s: +15% damage, and every second two of them fly at the nearest foes on their own — each one that flies is spent, eight strikes in all. In a party, every party member near you shares the +15%.',
    relations: ['Buff 30s · party', 'Blades strike on their own'],
  }),
  S({
    id: 'sakura_bind', cls: 'samurai', slot: 16, name: 'Sakura Bind', roles: ['hardCC', 'pull', 'setup'], targeting: 'mouseGround',
    startup: 240, active: 160, recovery: 220, cooldown: 12000, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 90, snapPlace: true, // (opened just in front of him, on his line: the arena places it ahead, never under the foe — in a combo the foe is that close)
    hits: [H(0, 8, { kind: 'placed', radius: 125 }, { stun: 400, pull: 70, catch: true, hardCC: { kind: 'root', ms: 900 } }, { reachUp: 60 })],
    // the combo's catch (DFO): the blossoms stay on the floor ~1.2s — a foe that comes down into them (from a slam, a fall)
    // is caught on landing, stood up and held by the branches: the string goes on (a launch from the floor)
    linger: { at: 'place', startMs: 60, everyMs: 60, count: 20, radius: 125, maxZ: 50, once: true, fresh: true,
      hit: H(0, 6, { kind: 'circle', radius: 125 }, { stun: 420, pull: 70, catch: true, hardCC: { kind: 'root', ms: 900, long: true } }, { reachUp: 50 }) },
    cancelOnHit: ['quick_slash', 'shadow_step', 'hundred_cuts', 'tornado_blade', 'iai_strike', 'dragon_ascension', 'swallow_cut'], telegraph: 'ground',
    description: 'A ring of cherry blossoms opens on the floor just in front of you: every foe in it is pulled to its centre and held by blossoming branches for 0.9s — and the blossoms stay on the floor a moment: a foe that comes down into them is caught on landing and held. Ready for your cuts.',
    relations: ['Pull + bind 0.9s', 'Catches a falling foe'],
  }),
  S({
    id: 'dragon_ascension', cls: 'samurai', slot: 17, name: 'Dragon Ascension', roles: ['antiAir'], targeting: 'self',
    startup: 260, active: 600, recovery: 300, cooldown: 14000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 260],
    // the anti-air from the floor: the dragon rising from his blade strikes a foe jumping at him out of the air — smashed
    // down, a fall and a bounce to cut him on; a foe on the floor only reels (it lifts no one: Swallow Cut is the launcher)
    hits: [H(0, 26, { kind: 'circle', radius: 120 }, { stun: 460, slam: true }, { reachUp: 300, heavy: true })],
    cancelOnHit: ['quick_slash', 'swallow_cut', 'hundred_cuts', 'iai_strike', 'dragon_eclipse'], telegraph: 'circle',
    description: 'The anti-air: a crimson dragon spirals up from your blade and strikes a foe jumping at you out of the air — he crashes to the floor and bounces, open to your cuts. A foe on the floor only reels.',
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
    startup: 250, active: 120, recovery: 200, cooldown: 2600, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 12, { kind: 'projectile', speed: 720, range: 560, radius: 13, count: 3, spread: 7, rows: 3, rowGap: 22 }, { stun: 300, push: 6 }, { reachUp: 90, stick: 1 })],
    charge: { minMs: 120, levels: [
      { at: 0, hits: [H(0, 12, { kind: 'projectile', speed: 720, range: 560, radius: 13, count: 3, spread: 7, rows: 3, rowGap: 22 }, { stun: 300, push: 6 }, { reachUp: 90, stick: 1 })] },
      { at: 520, hits: [H(0, 12, { kind: 'projectile', speed: 760, range: 600, radius: 13, count: 5, spread: 6, rows: 3, rowGap: 22 }, { stun: 320, push: 8 }, { reachUp: 90, stick: 1 })] },
    ] },
    cancelOnHit: ['staff_vault', 'kinetic_grab'], telegraph: 'cone',
    description: 'A fan of three charged cards across the whole floor; hold the key for five. Every card that hits sticks in the foe and bursts 0.6s later — or at once, when your staff strikes it.',
    relations: ['Cards stick and burst', 'Hold: 5 cards'],
  }),
  S({
    id: 'staff_vault', cls: 'gambler', arenaDmg: 1.15, slot: 2, name: 'Staff Vault', roles: ['gapClose', 'launcher', 'escape'], targeting: 'mouseTarget', // locks the foe ahead: the vault comes down on him, not past him
    startup: 120, active: 340, recovery: 200, cooldown: 4000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 220, lift: 110, crash: true },
    hits: [H(40, 6, { kind: 'capsule', radius: 30 }, { stun: 340, push: 2 }, { reachUp: 150 }), // (balance: the staff catches whoever it vaults through — the opener lands from the distance fights open at)
      H(220, 8, { kind: 'circle', radius: 80 }, { stun: 300, push: 6 }, { reachUp: 150, fuse: true }),
      H(300, 14, { kind: 'circle', radius: 90 }, { stun: 420, launch: 95, juggleCost: 16 }, { reachUp: 160, heavy: true, fuse: true })],
    cancelOnHit: ['rotor_staff', 'showdown', 'riffle_shuffle'], telegraph: 'line',
    description: 'Plant the staff and vault over in a long arc, landing in a double kick that lifts the foe. Aim backwards to vault away.',
    relations: ['Gap close / escape', 'Launcher'],
  }),
  S({
    id: 'fuse_slam', cls: 'gambler', arenaDmg: 1.15, slot: 3, name: 'Fuse Slam', roles: ['knockdown', 'setup', 'launcher'], targeting: 'mouseCone',
    startup: 260, active: 120, recovery: 260, cooldown: 5500, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 16, { kind: 'circle', radius: 100, at: 'aimBias', bias: 70 }, { stun: 420, slam: true, push: 6 }, { reachUp: 140, heavy: true, fuse: true })],
    // the charged floor erupts 0.8s later under whoever stands on it
    linger: { at: 'aim', offset: 70, startMs: 800, everyMs: 1000, count: 1, radius: 115, maxZ: 40, hit: H(0, 18, { kind: 'circle', radius: 115 }, { stun: 460, launch: 120, juggleCost: 20 }, { reachUp: 60, heavy: true }) },
    cancelOnHit: ['triple_down', 'grand_slam'], telegraph: 'circle',
    description: 'Slam the staff into the floor: a foe in the air is smashed down, and the floor stays charged — 0.8s later it erupts and throws up whoever stands on it.',
    relations: ['Smash down', 'Floor erupts 0.8s later'],
  }),
  S({
    id: 'riffle_shuffle', cls: 'gambler', slot: 4, name: 'Riffle Shuffle', roles: ['pull', 'zone', 'extender'], targeting: 'self',
    startup: 160, active: 900, recovery: 220, cooldown: 7000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 900],
    hits: [...Array.from({ length: 7 }, (_, i) => H(i * 110, 4, { kind: 'circle', radius: 150 }, { stun: 320, pull: 26, float: true, juggleCost: 3 }, { reachUp: 160 })),
      H(820, 12, { kind: 'circle', radius: 170 }, { stun: 400, push: 10 }, { reachUp: 170, heavy: true, stick: 2 })],
    cancelOnHit: ['all_in', 'showdown'],
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
    cancelOnHit: ['all_in', 'grand_slam', 'riffle_shuffle'],
    description: 'Spin the staff in front of you like a propeller for 1.5s while you walk on: its circle throws charged cards nonstop, holding the foe where it is (in the air too) and sticking card after card in it — then the last blow sets them all off at once and throws it away.',
    relations: ['Cards nonstop', 'Last blow: chain burst'],
  }),
  S({
    id: 'showdown', cls: 'gambler', arenaDmg: 1.15, slot: 6, name: 'Showdown', roles: ['signature', 'finisher'], targeting: 'mouseLine',
    startup: 360, active: 520, recovery: 300, cooldown: 9000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 880],
    // five cards turn over in a row and burst one by one (Gamble.ts: the Hand's rank sets the damage and the bonus)
    hits: [0, 100, 200, 300, 400].map((t, i) => H(t, i === 4 ? 16 : 8, { kind: 'line', length: 330, width: 80 }, { stun: 420, float: i < 4, launch: i === 4 ? 60 : undefined, juggleCost: i === 4 ? 14 : 4 }, { reachUp: 160, heavy: i === 4 })),
    cancelOnHit: ['all_in', 'grand_slam'], telegraph: 'line', endsCombo: false,
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
    cancelOnHit: ['kinetic_grab', 'staff_vault'], telegraph: 'ground',
    description: 'A BET ON THE REACTION — A giant roulette wheel opens on the floor where you aim; the ball spins for 2s and every foe in the wheel is slowed. Where it stops: RED — a great blast throws them all up; BLACK — everyone in it is bound for 2s. DOUBLE OR NOTHING: press again within 0.4 s to throw again — but if the new throw is worse, you are stunned 0.6 s.',
    relations: ['Slow 2s', 'Red: launch · Black: bind'],
  }),
  S({
    id: 'dice_bomb', cls: 'gambler', slot: 10, name: 'Dice Bomb', roles: ['zone', 'projectile'], targeting: 'mouseDir',
    startup: 300, active: 700, recovery: 220, cooldown: 8000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // two dice roll along the floor and burst; the sum sets the size (Gamble.ts), a double bursts twice and stuns
    hits: [H(560, 14, { kind: 'circle', radius: 120, at: 'aimBias', bias: 140 }, { stun: 400, push: 40 }, { reachUp: 90, heavy: true }),
      H(640, 14, { kind: 'circle', radius: 120, at: 'aimBias', bias: 195 }, { stun: 400, push: 40, launch: 50 }, { reachUp: 90, heavy: true })],
    cancelOnHit: ['kinetic_grab', 'staff_vault'], telegraph: 'line',
    description: 'A BET ON DAMAGE — Roll two glowing dice along the floor: they tumble forward and burst. The higher the roll (2 to 12), the harder the blast hits (×0.64 to ×1.36); the reaction never changes. DOUBLE OR NOTHING: press again within 0.4 s to throw again — but if the new throw is worse, you are stunned 0.6 s.',
    relations: ['Damage by the roll', 'Double or Nothing'],
  }),
  S({
    id: 'kinetic_grab', cls: 'gambler', slot: 11, name: 'Kinetic Grab', roles: ['hardCC', 'confirm'], targeting: 'mouseCone',
    startup: 160, active: 620, recovery: 260, cooldown: 9000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 8, { kind: 'sector', range: 84, angle: 70 }, { stun: 700, pin: 520, grab: true }, { reachUp: 90 }),
      H(480, 26, { kind: 'sector', range: 96, angle: 80 }, { stun: 480, push: 200, launch: 60, knockdown: 'heavy', grab: true, juggleCost: 18 }, { reachUp: 100, heavy: true })],
    // the thrown foe is a bomb: where it lands it bursts and hits everyone around it
    linger: { at: 'aim', offset: 230, startMs: 820, everyMs: 1000, count: 1, radius: 130, maxZ: 120, hit: H(0, 18, { kind: 'circle', radius: 130 }, { stun: 420, push: 40, launch: 40 }, { reachUp: 120, heavy: true }) },
    cancelOnHit: ['all_in', 'rotor_staff', 'pickup_52'],
    description: 'Seize the foe by the collar, charge its whole body with kinetic power and throw it: it becomes a bomb, and where it lands it bursts on everyone around. A grab — combo protection does not stop it.',
    relations: ['Grab', 'The foe becomes a bomb'],
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
    id: 'all_in', cls: 'gambler', slot: 13, name: 'All In', roles: ['launcher', 'extender'], targeting: 'self',
    startup: 240, active: 120, recovery: 240, cooldown: 10000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    // a snap of the fingers: every charged card stuck in a foe near him goes off at once and blows him up into the air —
    // the more cards, the harder and higher (Gamble.ts / the scene: gambleHit); a foe with no card in him is not touched at all (a whiff to punish)
    hits: [H(80, 8, { kind: 'circle', radius: 220 }, { stun: 420, launch: 70, juggleCost: 10 }, { reachUp: 240, heavy: true })],
    cancelOnHit: ['fuse_slam', 'grand_slam'],
    description: 'Snap your fingers: every charged card stuck in a foe near you detonates at once and blasts him up into the air. Each card adds damage and height — a foe full of cards flies; a foe with none is not even touched — a miss your foe can punish.',
    relations: ['Detonates stuck cards', 'Re-launch'],
  }),
  S({
    id: 'pickup_52', cls: 'gambler', slot: 14, name: '52 Pickup', roles: ['zone', 'finisher'], targeting: 'mouseCone',
    startup: 380, active: 900, recovery: 300, cooldown: 16000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1280],
    hits: [H(0, 6, { kind: 'sector', range: 420, angle: 70 }, { stun: 360, float: true, juggleCost: 4 }, { reachUp: 160 }),
      // the cards stuck in the floor go off in a wave, near to far; the last one lifts
      ...[250, 400, 550, 700].map((t, i) => H(t, i === 3 ? 18 : 9, { kind: 'circle', radius: 120, at: 'aimBias', bias: 90 + i * 95 }, { stun: 400, float: i < 3, knockdown: i === 3 ? 'heavy' : undefined, juggleCost: i === 3 ? 18 : 5 }, { reachUp: 150, heavy: i === 3 }))],
    cancelOnHit: ['showdown', 'grand_slam'], telegraph: 'cone',
    description: 'THE DETONATION FINISHER — every card stuck in the foes goes off in the last wave: its damage grows with each card (no card in them: a small wave). Sweep the deck along the floor in a cone ahead, then the wave runs from near to far.',
    relations: ['Wide zone', 'Sticks 2 cards'],
  }),
  S({
    id: 'grand_slam', cls: 'gambler', slot: 15, name: 'Grand Slam', roles: ['finisher', 'knockdown'], targeting: 'mouseCone',
    startup: 420, active: 140, recovery: 320, cooldown: 11000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 560],
    hits: [H(0, 46, { kind: 'sector', range: 150, angle: 120 }, { stun: 520, push: 300, launch: 40, knockdown: 'heavy', juggleCost: 30 }, { reachUp: 200, heavy: true, fuse: true })],
    cancelOnHit: ['triple_down', 'jackpot'], telegraph: 'cone',
    description: 'THE WALL FINISHER — The staff grows to twice its length and you swing it like a bat: the foe flies far away on a comet\'s tail and crashes into the floor or a wall. It sets off every card stuck in it at once.',
    relations: ['Sends far', 'Sets off all cards'],
  }),
  S({
    id: 'triple_down', cls: 'gambler', slot: 16, name: 'Triple Down', roles: ['knockdown', 'finisher'], targeting: 'mouseCone',
    startup: 200, active: 760, recovery: 300, cooldown: 9000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 960],
    // the staff grows into a pillar of light and hammers the floor ahead three times — each blow on a foe lying there keeps
    // him down and sets off the cards in him; the third, the heaviest, bounces him off the floor (one more link)
    hits: [H(0, 12, { kind: 'circle', radius: 95, at: 'aimBias', bias: 85, floor: true }, { stun: 420, juggleCost: 6 }, { reachUp: 60, heavy: true, fuse: true }),
      H(300, 14, { kind: 'circle', radius: 100, at: 'aimBias', bias: 85, floor: true }, { stun: 420, juggleCost: 6 }, { reachUp: 60, heavy: true, fuse: true }),
      H(700, 24, { kind: 'circle', radius: 125, at: 'aimBias', bias: 85, floor: true }, { stun: 520, launch: 70, juggleCost: 14 }, { reachUp: 70, heavy: true, fuse: true })],
    cancelOnHit: ['grand_slam', 'jackpot'], telegraph: 'circle',
    description: 'Your staff grows into a pillar of light and you hammer the floor ahead three times — it only hits a foe lying on the floor. Every blow lands on him — keeping him down and setting off the cards stuck in him — and the third, the heaviest, bounces him off the floor.',
    relations: ['Hits the fallen', 'Sets off all cards'],
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
    id: 'jackpot', cls: 'gambler', slot: 7, name: 'Jackpot', roles: ['ultimate', 'finisher'], targeting: 'self',
    startup: 900, active: 1300, recovery: 400, cooldown: 60000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 2600],
    // a slot machine stops on 7 · 7 · 7: coins and chips burst in eight blasts round you, the last one smashes them down
    hits: [...Array.from({ length: 7 }, (_, i) => H(i * 150, 12, { kind: 'circle', radius: 300 }, { stun: 460, float: true, juggleCost: 4 }, { reachUp: 320 })),
      H(1150, 60, { kind: 'circle', radius: 330 }, { stun: 600, knockdown: 'heavy', slam: true }, { reachUp: 320, heavy: true })],
    cancelOnHit: ['grand_slam', 'triple_down'], endsCombo: true, telegraph: 'circle',
    description: 'Call the JACKPOT: your picture crosses the screen, the world goes dark and a giant slot machine spins behind the foes — 7 · 7 · 7. Coins and chips burst in eight blasts all round you, the last one smashing everyone down.',
    relations: ['Ultimate', 'Always 7 · 7 · 7'],
  }),
];

// (Warrior skills once ran stretched outside the arena — slower — and at base pace inside it. A skill is the same
// everywhere now: the base pace in the open game and in PvP alike.)
/** The combat pace and reach of every skill — in the open game and in PvP alike (a skill is the same everywhere), the same rules for every class (the duel is about how many skills you string,
 *  so every class strings them at the same rhythm):
 *  - a combo skill cancelled into from a confirmed hit strikes within ARENA_FLOW.startup ms (an ultimate within
 *    ARENA_FLOW.ultStartup); from neutral a skill keeps its own wind-up, so big moves stay readable; multi-hit
 *    skills squeezed so their hits run in at most ARENA_FLOW.active ms (never below half their length) — the same hits, faster;
 *  - every hit reaches a foe up to ARENA_FLOW.reach px above the caster's feet (launches stay within the follow-ups'
 *    reach) and projectiles rise to a foe in the air in front of them (every damaging skill but traps and buffs);
 *  - per-skill exceptions: ARENA_PACE. Not for the basic chain, charged / counter / trap skills or buffs. */
export const ARENA_FLOW = { startup: 160, ultStartup: 400, active: 700, minSqueeze: 0.5, reach: 240,
  /** DFO's neutral (PvP engine audit): an attack hits only within `depth` px of its own line on the floor (+ the target's
   *  radius), so a step up / down out of its line dodges it; ultimates, zones, traps and ground-placed skills keep their area.
   *  (The effects stay as wide as they are drawn.) */
  depth: 34,
  /** A committed skill that misses leaves its caster open this much longer (and can be cancelled only from a hit). */
  whiffMs: 150,
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
export function arenaTimeScale(s: FinalSkill, followUp = false): { startup: number; active: number; recovery: number; at: number; reach?: number; antiAir?: boolean; depth?: number } | null {
  const w = { startup: 1, active: 1, recovery: 1, at: 1 };
  const p = ARENA_PACE[s.id];
  const dmg = s.hits.filter((h) => h.damage > 0);
  const combat = !s.chain && !s.charge && !s.counter && !s.trap && !isArenaBuff(s) && dmg.length > 0;
  let fs = 1, sq = 1;
  if (p) { fs = p.startup ? p.startup / s.startup : 1; sq = p.squeeze ?? 1; }
  else if (combat) {
    const base = s.startup * w.startup, cap = s.slot === 7 ? ARENA_FLOW.ultStartup : ARENA_FLOW.startup;
    if (base > cap && followUp) fs = cap / base; // (a skill opened from neutral keeps its own wind-up — an ultimate too: readable, the foe can step out of it; cancelled into from a hit, it comes out at once)
    const act = s.active * w.active;
    if (s.slot !== 7 && dmg.length >= 4 && act > ARENA_FLOW.active) sq = Math.max(ARENA_FLOW.minSqueeze, ARENA_FLOW.active / act);
  }
  const hitsAny = s.chain ? s.chain.stages.flat() : s.charge ? s.charge.levels.flatMap((l) => l.hits) : s.hits;
  const reach = !isArenaBuff(s) && !s.trap && hitsAny.some((h) => h.damage > 0) ? { reach: ARENA_FLOW.reach, antiAir: true, ...(arenaWide(s) ? {} : { depth: ARENA_FLOW.depth }) } : {}; // (charged / counter skills too)
  if (fs === 1 && sq === 1 && w.startup === 1 && !('reach' in reach)) return null;
  return { startup: w.startup * fs, active: w.active * sq, recovery: w.recovery, at: w.at * sq, ...reach };
}
/** Super armor length multiplier of a skill's armor window (its pace: the same in and out of the arena). */
export function armorMul(s: FinalSkill, _arena?: boolean): number { return arenaTimeScale(s)?.active ?? 1; }
/** Per-skill exceptions to ARENA_FLOW (arena startup in ms; squeeze: active and hit-spacing factor). */
const ARENA_PACE: Record<string, { startup?: number; squeeze?: number }> = {};
// the Roulette keeps its whole 2 s spin (its colour lights 1 s in: the foe gets a second to react — PvP audit)
ARENA_PACE.roulette_wheel = { squeeze: 1 };
// Warrior links (PvP re-audit: a ~6-skill combo): each skill leads to 2–3 others only, one route per job —
//   open (regular attack / Dash Slash / Iron Grip / the hook / Wave Slash) → launch (Rising Slash) → the air (Sky Breaker /
//   Ground Breaker) → the court or the lion (Judgment Blade / Lion's Maw) → the finish (Impaling Rush → the Verdict). Buffs and Sanctuary lead nowhere (a list is never empty: an empty one would mean free cancel).
const WARRIOR_LINKS: Record<string, string[]> = { // a one-way ladder: open → launch → air → finish (never back down it)
  warrior_basic: ['rising_slash'], dash_slash: ['rising_slash'], iron_grip: ['rising_slash'],
  judgment_hook: ['rising_slash'], wave_slash: ['rising_slash'], shield_charge: ['iron_grip', 'warrior_basic'],
  earthsplitter: ['warrior_basic'], // (the charged punish: no combo link out of it)
  rising_slash: ['sky_breaker', 'ground_breaker'],
  sky_breaker: ['judgment_blade', 'lions_maw'], ground_breaker: ['judgment_blade', 'lions_maw'], leap_crash: ['judgment_blade', 'lions_maw'],
  judgment_blade: ['lance_thrust', 'titans_verdict'], lions_maw: ['lance_thrust', 'titans_verdict'],
  lance_thrust: ['titans_verdict'], whirlwind: ['titans_verdict'], blade_storm: ['titans_verdict'],
  war_cry: ['warrior_basic'], sanctuary: ['warrior_basic'],
};
for (const w of warrior) if (WARRIOR_LINKS[w.id]) w.cancelOnHit = [...WARRIOR_LINKS[w.id]];
// Archer: a dense combo graph (PvP engine audit) — every combo skill leads on to several others, the signature and the
// ultimate, so her strings run as long as the other classes' (before: most of her skills were dead ends).
const ARCHER_LINKS: Record<string, string[]> = {
  quick_shot: ['backstep_shot', 'hunters_spirit', 'skyhunters_step', 'leaping_arrow', 'eagle_arrow', 'arrow_storm'],
  rising_arrow: ['explosive_arrow', 'rain_of_arrows', 'arrow_storm', 'sky_rain'],
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

export const FINAL_SKILLS: FinalSkill[] = [...warrior, ...mage, ...archer, ...samurai, ...gambler];
const BY_ID = new Map([...FINAL_SKILLS, ...mageBolts, ...Object.values(MAGE_HIDDEN)].map((s) => [s.id, s]));
/** Old ids from earlier builds (save-data / QA migration only; never shown in the HUD/tree). */
export const LEGACY_ALIASES: Record<string, string> = {
  final_strike: 'titans_verdict', meteor: 'storm_field', time_warp: 'time_collapse', wind_step: 'skyhunters_step',
  natures_wrath: 'sky_rain', verdant_judgment: 'sky_rain', dragon_slash: 'dragon_eclipse',
};

export function finalSkill(id: string): FinalSkill | undefined { return BY_ID.get(id) ?? BY_ID.get(LEGACY_ALIASES[id] ?? ''); }
export function kitFor(cls: string): FinalSkill[] { return FINAL_SKILLS.filter((s) => s.cls === cls).sort((a, b) => a.slot - b.slot); }
export const isSignature = (s: FinalSkill) => s.slot === 6;
export const isUltimate = (s: FinalSkill) => s.slot === 7;
export function iconUrl(s: FinalSkill): string { return `assets/final/skills/${s.cls}/${s.id}/icon.png`; }
export function totalDamage(s: FinalSkill): number { return s.hits.reduce((a, h) => a + h.damage, 0); }
export function lockMs(s: FinalSkill, stage = 0): number {
  const t = s.chain?.timings?.[stage] ?? s;
  return t.startup + t.active + t.recovery;
}
