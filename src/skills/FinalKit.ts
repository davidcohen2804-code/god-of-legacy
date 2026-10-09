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
    startup: 110, active: 150, recovery: 230, cooldown: 2500, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 210 }, through: true,
    hits: [0, 50, 100].map((t, i) => H(t, i === 2 ? 10 : 7, { kind: 'capsule', radius: 32 }, { stun: 240, push: i === 2 ? 10 : 2, float: true, juggleCost: 4 }, { reachUp: 90 })),
    cancelOnHit: CORE(['rising_slash', 'whirlwind', 'sanctuary', 'warrior_basic', 'blade_storm', 'titans_verdict']),
    telegraph: 'line',
    description: 'Charge up to 180px in the facing direction; stops on cover. A confirmed hit can cancel into Rising Slash, Leap Crash or any other skill.',
    relations: ['Opener', 'Cancel → any skill on hit'],
  }),
  S({
    id: 'rising_slash', cls: 'warrior', slot: 2, name: 'Rising Slash', roles: ['launcher', 'antiAir'], targeting: 'mouseCone',
    startup: 140, active: 170, recovery: 270, cooldown: 3000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 16, { kind: 'sector', range: 96, angle: 100 }, { stun: 420, launch: 150, juggleCost: 30 }, { reachUp: 90 }),
      H(70, 6, { kind: 'sector', range: 100, angle: 110 }, { stun: 300, float: true, juggleCost: 3 }, { reachUp: 190 }),
      H(140, 6, { kind: 'sector', range: 100, angle: 110 }, { stun: 300, float: true, juggleCost: 3 }, { reachUp: 220 })],
    cancelOnHit: ['whirlwind', 'warrior_basic', 'blade_storm', 'ground_breaker'],
    description: 'Upward cut that launches the target ~150px into the air (slightly less when used airborne).',
    relations: ['Launcher', 'Jump chase → Whirlwind'],
  }),
  S({
    id: 'ground_breaker', cls: 'warrior', slot: 3, name: 'Ground Breaker', roles: ['knockdown', 'antiAir'], targeting: 'self',
    startup: 300, active: 260, recovery: 300, cooldown: 4000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 26, { kind: 'circle', radius: 118 }, { stun: 320, push: 4 }, { reachUp: 130, heavy: true }),
      H(200, 14, { kind: 'circle', radius: 150 }, { stun: 300, launch: 110, juggleCost: 10 }, { reachUp: 120 })],
    linger: { at: 'caster', startMs: 300, everyMs: 300, count: 10, radius: 150, maxZ: 130, hit: H(0, 3, { kind: 'circle', radius: 150 }, { stun: 380, pull: 40, float: true }, { reachUp: 130 }) },
    cancelOnHit: ['titans_verdict'], telegraph: 'circle',
    description: 'Smash the earth and blast foes up into the air: a living quake follows you for 3s, dragging in and holding any foe it touches while you keep fighting.',
    relations: ['Finisher', 'Anti-air slam'],
  }),
  S({
    id: 'whirlwind', cls: 'warrior', slot: 4, name: 'Whirlwind', roles: ['extender', 'airExtender'], targeting: 'self',
    startup: 130, active: 1570, recovery: 190, cooldown: 7000, ground: true, air: true, cover: 'IGNORES_COVER', move: { startup: 0, active: 0.85, recovery: 0 },
    zoneMs: 2200,
    hits: Array.from({ length: 12 }, (_, i) => i * 130).map((t) => H(t, 3, { kind: 'circle', radius: 108 }, { stun: 200, pull: 6, float: true, juggleCost: 6 }, { reachUp: 140 })),
    cancelOnHit: ['ground_breaker', 'warrior_basic', 'blade_storm', 'titans_verdict'],
    description: 'A 2-second steerable blade cyclone: walk while you spin, sucking foes in and keeping them afloat with a hit every 0.18s.',
    relations: ['Air extender', 'Finish with Ground Breaker'],
  }),
  S({
    id: 'sanctuary', cls: 'warrior', slot: 5, name: 'Sanctuary', roles: ['setup', 'zone'], targeting: 'self',
    startup: 520, active: 200, recovery: 260, cooldown: 30000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 980],
    hits: [H(0, 6, { kind: 'circle', radius: 120 }, { stun: 400, pull: 30 }, { reachUp: 120 })],
    cancelOnHit: ['warrior_basic', 'rising_slash', 'dash_slash', 'blade_storm'], tags: ['buff'],
    description: 'Trace a half-circle on the ground with your sword: a translucent dome of light rises where you stand for 15s. While you are inside it you take no damage at all. The dome stays where it was cast.',
    relations: ['Zone 15s', 'Full damage immunity inside'],
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
      ...[90, 160, 230, 300, 370, 440, 510, 580].map((t) => H(t, 6, { kind: 'circle', radius: 200, at: 'aimBias', bias: 110 }, { stun: 420, float: true }, { reachUp: 320 }))],
    endsCombo: true, tags: ['ultimate'], telegraph: 'cone',
    description: 'Raise your sword with a battle roar: a colossal titan of light rises behind you and drives its giant sword into the floor, and a golden shockwave tears across the arena. Heavy knockdown; ends the combo.',
    relations: ['Ultimate', 'Ends combo'],
  }),
  // ---- extended kit (Q R F G C V)
  S({
    id: 'leap_crash', cls: 'warrior', slot: 8, name: 'Leap Crash', roles: ['gapClose', 'knockdown'], targeting: 'mouseTarget',
    startup: 160, active: 320, recovery: 380, cooldown: 3500, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 210, lift: 80, crash: true },
    hits: [H(140, 10, { kind: 'circle', radius: 90 }, { stun: 300, slam: true }, { reachUp: 160 }),
      H(285, 20, { kind: 'circle', radius: 125 }, { stun: 300, launch: 95, juggleCost: 25 }, { reachUp: 60, heavy: true })],
    cancelOnHit: ['whirlwind', 'warrior_basic', 'rising_slash', 'blade_storm', 'lance_thrust', 'radiant_blade'], telegraph: 'circle',
    description: 'Leap up to 210px onto the target and crash down: airborne targets are slammed into a bounce, grounded targets are popped up.',
    relations: ['Gap close', 'Pop-up → air chase'],
  }),
  S({
    id: 'wave_slash', cls: 'warrior', slot: 9, name: 'Wave Slash', roles: ['projectile', 'precision'], targeting: 'mouseProjectile',
    startup: 700, active: 0, recovery: 220, cooldown: 2500, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 18, { kind: 'projectile', speed: 400, range: 520, radius: 22, pierce: true, count: 3, spread: 28 }, { stun: 320, launch: 80, juggleCost: 10 }, { reachUp: 120 })],
    cancelOnHit: ['dash_slash', 'leap_crash', 'lance_thrust'],
    description: 'Charge the blade for a second, then release three crescent shockwaves in a fan; they pierce, and any target they catch is popped into the air.',
    relations: ['Ranged check', 'Pierces'],
  }),
  S({
    id: 'radiant_blade', cls: 'warrior', slot: 10, name: 'Radiant Blade', roles: ['setup', 'extender'], targeting: 'self',
    startup: 400, active: 160, recovery: 260, cooldown: 20000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 2100],
    hits: [H(0, 8, { kind: 'circle', radius: 130 }, { stun: 360, push: 30 }, { reachUp: 140 })],
    cancelOnHit: ['warrior_basic', 'dash_slash', 'rising_slash', 'whirlwind', 'blade_storm'], tags: ['buff'],
    description: 'Your sword becomes a long blade of pure light for 15s: every sword strike reaches 85% farther and deals +15% damage. The transformation releases a light burst around you.',
    relations: ['Buff 15s', 'Range +85%'],
  }),
  S({
    id: 'iron_oath', cls: 'warrior', slot: 14, name: 'Iron Oath', roles: ['setup'], targeting: 'self',
    startup: 420, active: 200, recovery: 260, cooldown: 30000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 880],
    hits: [H(0, 4, { kind: 'circle', radius: 120 }, { stun: 400, pull: 30 }, { reachUp: 140 })],
    cancelOnHit: ['dash_slash', 'rising_slash', 'leap_crash'], tags: ['buff', 'party'],
    description: 'Swear the iron oath: Max HP +30% for 60s; its flash of light pulls foes around you in. In a party it also strengthens every party member near you.',
    relations: ['Buff 60s', 'Party buff'],
  }),
  S({
    id: 'legacy_banner', cls: 'warrior', slot: 15, name: 'Legacy Banner', roles: ['setup'], targeting: 'self',
    startup: 900, active: 200, recovery: 300, cooldown: 60000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1400],
    hits: [H(0, 10, { kind: 'circle', radius: 160 }, { stun: 400, pull: 30 }, { reachUp: 140 })],
    cancelOnHit: ['warrior_basic', 'dash_slash', 'blade_storm', 'titans_verdict'], tags: ['buff', 'party'],
    description: 'Plant a banner of light: +10% damage and 10% less damage taken for 90s; the impact pulls foes around you in. In a party every party member near you shares it.',
    relations: ['Buff 90s', 'Party buff'],
  }),
  S({
    id: 'lance_thrust', cls: 'warrior', slot: 11, name: 'Impaling Rush', roles: ['extender', 'peel'], targeting: 'mouseDir',
    startup: 160, active: 420, recovery: 300, cooldown: 4500, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 260 }, carry: true,
    hits: [0, 70, 140, 210, 280, 380].map((t, i) => H(t, i === 5 ? 16 : 4, { kind: 'sector', range: 80, angle: 100 }, i === 5 ? { stun: 420, launch: 110, juggleCost: 20 } : { stun: 320 }, { reachUp: 140, heavy: i === 5 })),
    cancelOnHit: ['rising_slash', 'leap_crash', 'blade_storm', 'titans_verdict', 'wave_slash'],
    description: 'Skewer the target on your blade and rush it across the arena (into a wall if one is in the way), then rip it upward with a burst of light.',
    relations: ['Extender', 'Carry'],
  }),
  S({
    id: 'war_cry', cls: 'warrior', slot: 12, name: 'War Cry', roles: ['setup', 'pull'], targeting: 'self',
    startup: 360, active: 900, recovery: 240, cooldown: 15000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1500],
    hits: [H(0, 6, { kind: 'circle', radius: 170 }, { stun: 420, pull: 34 }, { reachUp: 140 })],
    cancelOnHit: ['dash_slash', 'leap_crash', 'lance_thrust', 'blade_storm'], tags: ['buff'],
    description: 'Battle roar — also breaks free from stun, hits and knockdowns: pulls nearby foes in and grants a golden aura for 8s — +20% damage and super armor while attacking. In a party, members near you gain +10% damage.',
    relations: ['Buff 8s', 'Super armor'],
  }),
  S({
    id: 'judgment_blade', cls: 'warrior', slot: 13, name: 'Judgment Blade', roles: ['zone', 'setup'], targeting: 'mouseDir',
    startup: 150, active: 320, recovery: 240, cooldown: 9000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    charges: 3, chargeGap: 120,
    hits: [H(140, 14, { kind: 'circle', radius: 80, at: 'aimBias', bias: 150 }, { stun: 420, pin: 400, slam: true }, { reachUp: 280, heavy: true })],
    linger: { at: 'aim', offset: 150, startMs: 520, everyMs: 500, count: 10, radius: 130, maxZ: 40, hit: H(0, 3, { kind: 'circle', radius: 130 }, { stun: 560, pin: 480 }, { reachUp: 40 }) },
    cancelOnHit: ['warrior_basic', 'rising_slash', 'leap_crash', 'lance_thrust', 'blade_storm'],
    description: 'Leap and hurl the first blade at once (it lands in under half a second; an airborne foe is slammed into a bounce), then up to 2 more: every press of V throws the next blade at once (no wait between throws); if you stop, you float slowly back down. Each blade stays planted for 5s inside a storm ring that shocks and roots anyone standing in it.',
    relations: ['Zone 5s', 'Root → free combo'],
  }),
  // ---- new kit (Z X B N): the grab, the hook, the air chase, the charged fissure (own timings: not stretched)
  S({
    id: 'iron_grip', cls: 'warrior', slot: 16, name: 'Iron Grip', roles: ['opener', 'extender'], targeting: 'mouseDir',
    startup: 160, active: 560, recovery: 300, cooldown: 6000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, armor: [0, 720],
    hits: [H(0, 8, { kind: 'sector', range: 78, angle: 90 }, { stun: 800, grab: true }, { reachUp: 140 }),
      H(440, 24, { kind: 'circle', radius: 110, at: 'aimBias', bias: 60 }, { stun: 440, launch: 100, juggleCost: 20 }, { reachUp: 220, heavy: true })],
    cancelOnHit: ['rising_slash', 'leap_crash', 'sky_breaker', 'wave_slash', 'whirlwind'],
    description: 'Seize the foe in front of you with a hand of golden light, hoist it high over your head and smash it into the floor before you; it bounces up, open for the next strike.',
    relations: ['Grab', 'Bounce → combo'],
  }),
  S({
    id: 'judgment_hook', cls: 'warrior', slot: 17, name: 'Judgment Hook', roles: ['pull', 'gapClose'], targeting: 'mouseDir',
    startup: 140, active: 260, recovery: 240, cooldown: 7000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(90, 10, { kind: 'line', length: 380, width: 46 }, { stun: 560, grab: true }, { reachUp: 160 })],
    cancelOnHit: ['warrior_basic', 'iron_grip', 'dash_slash', 'rising_slash', 'whirlwind', 'ground_breaker', 'lance_thrust'],
    description: 'Hurl a chain of golden light up to 380px: it hooks the first foe it reaches and yanks it right in front of you, stunned, ready for your next blow.',
    relations: ['Pull to you', 'Combo starter'],
  }),
  S({
    id: 'sky_breaker', cls: 'warrior', slot: 18, name: 'Sky Breaker', roles: ['airExtender', 'chase'], targeting: 'mouseTarget',
    startup: 110, active: 620, recovery: 300, cooldown: 6000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 140, lift: 170, crash: true },
    hits: [H(60, 7, { kind: 'circle', radius: 90 }, { stun: 380, float: true, juggleCost: 4 }, { reachUp: 240 }),
      H(170, 7, { kind: 'circle', radius: 90 }, { stun: 380, float: true, juggleCost: 4 }, { reachUp: 240 }),
      H(280, 8, { kind: 'circle', radius: 95 }, { stun: 380, float: true, juggleCost: 4 }, { reachUp: 240 }),
      H(560, 18, { kind: 'circle', radius: 120 }, { stun: 420, slam: true }, { reachUp: 260, heavy: true })],
    cancelOnHit: ['leap_crash', 'iron_grip', 'judgment_hook', 'whirlwind', 'blade_storm'],
    description: 'Spring into the air after your foe: three rising slashes keep it floating, then a crushing downward strike smashes it into the floor so it bounces back up.',
    relations: ['Air chase', 'Slam → bounce'],
  }),
  S({
    id: 'earthsplitter', cls: 'warrior', slot: 19, name: 'Earthsplitter', roles: ['finisher', 'launcher'], targeting: 'mouseCone',
    startup: 1200, active: 320, recovery: 380, cooldown: 14000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1500],
    // hold the key: the sword raised overhead charges (160..1200 ms); the level picks how far and wide the fissure tears
    hits: [H(0, 22, { kind: 'sector', range: 200, angle: 70 }, { stun: 420, launch: 90, juggleCost: 15 }, { reachUp: 120, heavy: true })],
    charge: { minMs: 160, levels: [
      { at: 0, hits: [H(0, 22, { kind: 'sector', range: 200, angle: 70 }, { stun: 420, launch: 90, juggleCost: 15 }, { reachUp: 120, heavy: true })] },
      { at: 500, hits: [H(0, 34, { kind: 'sector', range: 280, angle: 80 }, { stun: 460, launch: 130, juggleCost: 15 }, { reachUp: 140, heavy: true }),
        H(150, 10, { kind: 'sector', range: 300, angle: 90 }, { stun: 380, float: true }, { reachUp: 220 })] },
      { at: 1000, hits: [H(0, 48, { kind: 'sector', range: 360, angle: 90 }, { stun: 500, launch: 170, juggleCost: 10 }, { reachUp: 160, heavy: true }),
        H(150, 12, { kind: 'sector', range: 380, angle: 95 }, { stun: 400, float: true }, { reachUp: 260 }),
        H(300, 12, { kind: 'sector', range: 380, angle: 95 }, { stun: 400, float: true }, { reachUp: 300 })] },
    ] },
    cancelOnHit: ['sky_breaker', 'blade_storm', 'titans_verdict'],
    description: 'Hold the key: you raise your sword overhead as the ground trembles, in three steps. Release: you split the earth — a wide fissure tears across the floor in front of you and pillars of light burst out of it, launching every foe; the longer you held, the farther, wider and higher.',
    relations: ['Hold to charge (3 levels)', 'Wide launcher'],
  }),
];

// ------------------------------------------------------------------ BOOK MAGE
// The controller (mage spec, 8.10.2026): frost chills / freezes, heavy hits shatter, storm conducts through the chilled
// (Combat.ts), a rune net on the floor, gravity turned over, gates, the paper crane curse, time. Ordered by Jobs.ts.
const FROST = 'frost' as const, STORM = 'storm' as const;
/** Arcane Bolt's three beats (el: the element Attunement gives them). */
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
    hits: [H(0, 24, { kind: 'line', length: 230, width: 110 }, { stun: 260, push: 34, float: true, juggleCost: 12 }, { reachUp: 170 })],
    cancelOnHit: ['astral_burst', 'lightning_chain', 'blink', 'glacial_spikes'], telegraph: 'line',
    description: 'A wide, short wave across the floor: a foe on the ground is thrown back, a foe in the air is held where it is for your next spell.',
    relations: ['Push back', 'Holds in the air'],
  }),
  S({
    id: 'binding_rune', cls: 'book_mage', slot: 2, name: 'Binding Rune', roles: ['trap', 'setup', 'hardCC'], targeting: 'mouseGround',
    startup: 200, active: 100, recovery: 160, cooldown: 9000, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 300, charges: 3, chargeGap: 260, trap: { radius: 46, lifeMs: 10000 },
    hits: [H(0, 12, { kind: 'placed', radius: 46 }, { hardCC: { kind: 'stun', ms: 700, long: true }, stun: 120 }, { reachUp: 40 })],
    cancelOnHit: [], telegraph: 'ground',
    description: 'Lay up to 3 runes on the floor (10s each). Stepping on one stuns the foe for 0.7s. Two runes close together join in a beam of light: whoever crosses it is bound and shocked, and the beam breaks. Three runes make a cage.',
    relations: ['Rune net', 'Stun 0.7s'],
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
    startup: 220, active: 260, recovery: 240, cooldown: 7000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 0, lift: 46 }, // he rises a little on the burst of cold, then drops
    hits: [H(0, 20, { kind: 'circle', radius: 150 }, { stun: 340, push: 6 }, { reachUp: 120, el: FROST }),
      H(160, 8, { kind: 'circle', radius: 175 }, { stun: 300, push: 4 }, { reachUp: 140 })],
    cancelOnHit: ['glacial_spikes', 'astral_burst', 'blink', 'arcane_bolt'], telegraph: 'circle',
    description: 'A ring of ice bursts out across the floor around you. It CHILLS every foe it touches; a foe already chilled FREEZES solid.',
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
    cancelOnHit: ['arcane_wave', 'blink', 'storm_field', 'levity_field', 'time_collapse'], telegraph: 'line',
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
    startup: 900, active: 1300, recovery: 480, cooldown: 45000, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
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
    hits: [H(0, 10, { kind: 'capsule', radius: 34 }, { stun: 350, juggleCost: 6 }, { reachUp: 90 })],
    description: 'Vanish and reappear a short way off in the direction you hold, in the air too; a foe you pass through is struck and stunned. Two blinks in a row. It cancels the end of any of your spells.',
    relations: ['2 in a row', 'Cancels any spell'],
  }),
  S({
    id: 'glacial_spikes', cls: 'book_mage', slot: 9, name: 'Glacial Spikes', roles: ['launcher', 'zone'], targeting: 'mouseCone',
    startup: 220, active: 200, recovery: 220, cooldown: 6000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 22, { kind: 'projectile', speed: 700, range: 260, radius: 30, count: 3, spread: 30, pierce: true }, { stun: 380, launch: 100, juggleCost: 22 }, { reachUp: 120, el: FROST })],
    // the spikes stand 3s as a wall of ice: foes are held back from it
    linger: { at: 'aim', offset: 180, startMs: 260, everyMs: 150, count: 20, radius: 90, maxZ: 60, hit: H(0, 0, { kind: 'circle', radius: 90 }, { push: 24 }, { reachUp: 60 }) },
    cancelOnHit: ['astral_burst', 'lightning_chain', 'blink', 'arcane_bolt'], telegraph: 'cone',
    description: 'Three rows of ice spikes burst from the floor in a fan: each spike throws its foe up and CHILLS it (a chilled foe FREEZES). The spikes stand for 3s as a wall of ice no foe can walk through.',
    relations: ['Launcher', 'Ice wall 3s'],
  }),
  S({
    id: 'chrono_haste', cls: 'book_mage', slot: 10, name: 'Chrono Haste', roles: ['setup'], targeting: 'self',
    startup: 320, active: 120, recovery: 180, cooldown: 30000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 3, { kind: 'circle', radius: 110 }, { stun: 180, push: 12 }, { reachUp: 120 })],
    tags: ['buff', 'party'],
    description: 'Speed up time around you for 120s: +10% movement speed, +10% attack speed and skills ready 10% sooner. In a party every party member near you shares it.',
    relations: ['Buff 120s', 'Party buff'],
  }),
  S({
    id: 'levity_field', cls: 'book_mage', slot: 11, name: 'Levity Field', roles: ['zone', 'hardCC', 'setup'], targeting: 'mouseGround',
    startup: 260, active: 140, recovery: 200, cooldown: 13000, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 320, zoneMs: 2500,
    hits: [H(0, 10, { kind: 'placed', radius: 150 }, { levity: 2500, stun: 160 }, { reachUp: 120 })],
    cancelOnHit: ['lightning_chain', 'storm_field', 'origami_flock', 'frost_nova', 'blink', 'arcane_bolt'], telegraph: 'ground',
    description: 'Gravity turns over where you aim: every foe in the circle floats up and hangs there for 2.5s, unable to move, then drops. Your bolts fly twice as fast through it.',
    relations: ['Float 2.5s', 'Bolts x2 inside'],
  }),
  S({
    id: 'origami_flock', cls: 'book_mage', slot: 12, name: 'Origami Flock', roles: ['projectile', 'chase'], targeting: 'mouseCone',
    startup: 300, active: 120, recovery: 220, cooldown: 9000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 8, { kind: 'projectile', speed: 460, range: 720, radius: 16, count: 7, spread: 70, homing: 420 }, { stun: 220, push: 6, float: true, juggleCost: 3 }, { reachUp: 160 })],
    cancelOnHit: ['levity_field', 'paper_curse', 'blink', 'arcane_bolt'],
    description: 'Seven pages tear out of the book and fold into paper cranes. Each crane picks a foe and flies after it, turning when it dodges.',
    relations: ['7 homing cranes', 'Hard to dodge'],
  }),
  S({
    id: 'chrono_sigil', cls: 'book_mage', slot: 13, name: 'Chrono Sigil', roles: ['escape', 'setup'], targeting: 'self',
    startup: 180, active: 80, recovery: 140, cooldown: 18000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [], tags: ['buff'],
    description: 'Lay a clock sigil under your feet. Within 5s, press again to snap back to it in time, getting back half of the HP you lost since.',
    relations: ['Rewind 5s', 'Half the HP back'],
  }),
  S({
    id: 'arcane_ward', cls: 'book_mage', slot: 14, name: 'Arcane Ward', roles: ['setup'], targeting: 'self',
    startup: 260, active: 100, recovery: 180, cooldown: 30000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [], tags: ['buff', 'party'],
    description: 'A shell of rune hexagons takes damage for you for 8s, up to 20% of your max HP (party members near you: 10%). When it breaks it bursts in a ring of frost that CHILLS the foes around you.',
    relations: ['Shield 8s', 'Party shield'],
  }),
  S({
    id: 'arcane_gate', cls: 'book_mage', slot: 15, name: 'Arcane Gate', roles: ['mobility', 'setup'], targeting: 'mouseGround',
    startup: 260, active: 100, recovery: 200, cooldown: 20000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    placeRange: 420, hits: [], telegraph: 'ground',
    description: 'Open two gates for 12s: one beside you and one where you aim. Walk into one and step out of the other; every bolt or crane you send into one flies out of the other.',
    relations: ['Two gates 12s', 'Spells pass through'],
  }),
  S({
    id: 'paper_curse', cls: 'book_mage', slot: 16, name: 'Paper Curse', roles: ['hardCC', 'setup'], targeting: 'mouseTarget',
    startup: 280, active: 100, recovery: 200, cooldown: 16000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 10, { kind: 'chain', corridor: 360, width: 70, jump: 0 }, { curse: 2000, stun: 120 }, { reachUp: 160 })],
    cancelOnHit: ['binding_rune', 'storm_field', 'origami_flock', 'blink'],
    description: 'Pages wrap a foe and fold it into a paper crane for 2s: it can still walk, slowly, but cannot attack or use skills (for its first 0.6s it cannot move at all). A heavy blow unfolds it early. A monster turned into a crane takes 30% more damage.',
    relations: ['Crane 2s', 'No attacks'],
  }),
  S({
    id: 'elemental_ascension', cls: 'book_mage', slot: 17, name: 'Elemental Ascension', roles: ['setup'], targeting: 'self',
    startup: 600, active: 160, recovery: 240, cooldown: 90000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 900],
    hits: [H(0, 8, { kind: 'circle', radius: 160 }, { stun: 300, push: 34 }, { reachUp: 150 })],
    tags: ['buff'],
    description: 'Merge with the elements for 20s: every one of your hits both CHILLS and shocks, so magic reactions come from anything you cast, even Arcane Bolt.',
    relations: ['Buff 20s', 'Every hit: frost + storm'],
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
    id: 'quick_shot', cls: 'archer', slot: 0, name: 'Double Shot', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
    startup: 85, active: 70, recovery: 110, cooldown: 350, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: { startup: 0.85, active: 0.85, recovery: 0.85 },
    hits: [H(0, 7, { kind: 'projectile', speed: 900, range: 430, radius: 9 }, { stun: 140, push: 2 }), H(70, 7, { kind: 'projectile', speed: 900, range: 430, radius: 9 }, { stun: 160, push: 3 }, { mark: 1 })],
    cancelOnHit: ['rising_arrow', 'multi_shot', 'explosive_arrow', 'retreat_kick', 'piercing_arrow', 'vine_trap', 'rain_of_arrows'],
    description: 'Two fast arrows in the facing direction; usable while moving at 85% speed.',
    relations: ['Poke', 'Air follow-up'],
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
    startup: 60, active: 380, recovery: 160, cooldown: 4500, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: -190, lift: 70 },
    hits: [H(340, 16, { kind: 'circle', radius: 85, at: 'aimBias', bias: 200, floor: true }, { stun: 420, launch: 140, juggleCost: 22 }, { reachUp: 120, mark: 1 })],
    description: 'A gust throws you back out of reach; mid-leap you shoot an arrow into the ground in front of you — it bursts and throws the foe there into the air (and leaves a Hunter\'s Mark).',
    relations: ['Escape', 'Marks'],
  }),
  // ---- 2nd job (Hunter)
  S({
    id: 'multi_shot', cls: 'archer', slot: 3, name: 'Triple Arrow', roles: ['confirm', 'projectile'], targeting: 'mouseCone',
    startup: 280, active: 150, recovery: 220, cooldown: 2800, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 22, { kind: 'projectile', speed: 640, range: 620, radius: 12, count: 5, spread: 17 }, { stun: 240, push: 10, float: true, juggleCost: 12 }, { mark: 1 })],
    cancelOnHit: ['explosive_arrow', 'piercing_arrow', 'quick_shot', 'skyhunters_step', 'retreat_kick'], telegraph: 'cone',
    description: 'A steady draw, then three arrows fan out in three directions; one damage event per target.',
    relations: ['Confirm', 'Cancel → Explosive Arrow'],
  }),
  S({
    id: 'explosive_arrow', cls: 'archer', slot: 4, name: 'Fireball Arrow', roles: ['projectile', 'launcher'], targeting: 'mouseProjectile',
    startup: 280, active: 0, recovery: 220, cooldown: 6000, ground: true, air: true, cover: 'EXPLODES_ON_COVER', move: LOCK,
    hits: [H(0, 30, { kind: 'projectile', speed: 620, range: 460, radius: 16, explodeRadius: 80 }, { stun: 320, launch: 70, push: 20, juggleCost: 25 }, { useMark: 'blast' })],
    cancelOnHit: ['quick_shot', 'rain_of_arrows', 'skyhunters_step'],
    description: 'A burning arrow wrapped in a fireball; it bursts into a blast of fire at the target, a wall or its full range.',
    relations: ['Pop', 'Jump → Double Shot'],
  }),
  S({
    id: 'retreat_kick', cls: 'archer', slot: 5, name: 'Retreat Kick', roles: ['launcher', 'escape'], targeting: 'mouseCone',
    startup: 200, active: 420, recovery: 200, cooldown: 4000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: -170, lift: 70 },
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
    hits: [H(0, 0, { kind: 'placed', radius: 90 }, { hardCC: { kind: 'root', ms: 2000, long: true }, stun: 120 }),
      H(0, 32, { kind: 'placed', radius: 110 }, { stun: 700, launch: 150, juggleCost: 30 }, { reachUp: 200, heavy: true })],
    cancelOnHit: [], telegraph: 'ground',
    description: 'A vine mine buried in the floor. Whoever steps on it — a player or a whole pack of monsters — is held, and 2s later it explodes and throws them all very high; untouched, it goes off by itself after 4s.',
    relations: ['Setup', 'High launcher'],
  }),
  // ---- 3rd job (Ranger)
  S({
    id: 'skyhunters_step', cls: 'archer', slot: 6, name: 'Air Volley', roles: ['signature', 'mobility', 'chase'], targeting: 'mouseDir',
    startup: 260, active: 1150, recovery: 300, cooldown: 16000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 320, lift: 170 },
    hits: [120, 340, 560, 780, 1000].map((t, i) => H(t, [8, 8, 9, 9, 10][i], { kind: 'projectile', speed: 760, range: 420, radius: 9, rows: 3, rowGap: 52 }, { stun: 300, float: true, juggleCost: 12 }, { mark: i === 4 ? 1 : 0 })),
    cancelOnHit: ['sky_rain'], tags: ['signature'], telegraph: 'trajectory',
    description: 'Acrobatic leap in the facing direction while firing five shots from the air — keeps a launched foe up.',
    relations: ['Signature', 'Air combo'],
  }),
  S({
    id: 'rain_of_arrows', cls: 'archer', slot: 9, name: 'Thunder Rain', roles: ['zone', 'extender'], targeting: 'mouseDir',
    startup: 300, active: 1200, recovery: 300, cooldown: 12000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [300, 900],
    dash: { distance: 0, lift: 150, hang: true },
    linger: { at: 'aim', offset: 300, startMs: 1000, everyMs: 400, count: 4, radius: 210, maxZ: 60, hit: H(0, 4, { kind: 'circle', radius: 210 }, { stun: 320, float: true, juggleCost: 4, slow: { pct: 30, ms: 500 } }, { reachUp: 60 }) },
    hits: [600, 750, 900].map((t, i) => H(t, i === 2 ? 16 : 12, { kind: 'circle', radius: 100, at: 'aimBias', bias: [150, 300, 450][i], floor: true }, { stun: 320, float: true, juggleCost: 10, slow: { pct: 30, ms: 800 } }, { reachUp: 200, heavy: i === 2, useMark: i === 2 ? 'stun' as const : undefined })),
    cancelOnHit: ['quick_shot', 'skyhunters_step'], telegraph: 'line',
    description: 'Leap, hang in the air charging a lightning arrow, then loose three lightning arrows that strike the floor near, middle and far in front of you.',
    relations: ['Zone 2s', 'Keeps foes up'],
  }),
  S({
    id: 'piercing_arrow', cls: 'archer', slot: 10, name: 'Spirit Bow', roles: ['projectile', 'zone'], targeting: 'mouseDir',
    startup: 350, active: 5000, recovery: 200, cooldown: 22000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: Array.from({ length: 40 }, (_, i) => H(i * 125, 4, { kind: 'projectile', speed: 900, range: 560, radius: 11 }, { stun: 320, push: 6, float: true, juggleCost: 3 }, { mark: i % 3 === 0 ? 1 : 0 })),
    description: 'Stand your ground: a great green spirit bow fires on its own for 5s. It looses a stream of small arrows; the direction you hold aims it — to a side, up at an angle or straight up; arrows shot up arc high and fall back onto the floor.',
    relations: ['Auto-fire 5s', 'Rooted, aim it'],
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
    startup: 600, active: 300, recovery: 260, cooldown: 14000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK, armor: [0, 900],
    hits: [H(120, 12, { kind: 'line', length: 600, width: 260 }, { hardCC: { kind: 'root', ms: 4000, long: true }, stun: 200 }, { reachUp: 60 })],
    cancelOnHit: ['quick_shot', 'multi_shot', 'rain_of_arrows'], telegraph: 'line',
    description: 'Charge briefly, then send a wide band of leaves and vines across the floor: every player and monster on it is bound in place for 4s.',
    relations: ['Charge 2s', 'Bind 4s'],
  }),
  S({
    id: 'spirit_hawk', cls: 'archer', slot: 13, name: 'Spirit Hawk', roles: ['setup', 'extender'], targeting: 'self',
    startup: 300, active: 100, recovery: 200, cooldown: 30000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 3, { kind: 'circle', radius: 90 }, { stun: 160, push: 10 }, { reachUp: 120 })],
    linger: { at: 'caster', startMs: 1200, everyMs: 2200, count: 10, radius: 360, maxZ: 320, hit: H(0, 16, { kind: 'circle', radius: 40 }, { stun: 260, push: 10, float: true, juggleCost: 4 }, { reachUp: 320 }) },
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
    description: 'Plants a great tree of light for 20s. Its aura heals you and every party member standing near it by 4% max HP every second.',
    relations: ['Heal zone 20s', 'Party heal'],
  }),
  S({
    id: 'hunters_spirit', cls: 'archer', slot: 15, name: "Hunter's Spirit", roles: ['setup'], targeting: 'self',
    startup: 360, active: 160, recovery: 240, cooldown: 60000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 760],
    hits: [H(0, 4, { kind: 'circle', radius: 130 }, { stun: 240, push: 18 }, { reachUp: 140 })],
    tags: ['buff', 'party'],
    description: 'The hawk-eye sigil sharpens every eye: critical rate +15% for 120s. In a party every party member near you shares it.',
    relations: ['Buff 120s', 'Party buff'],
  }),
  S({
    id: 'arrow_storm', cls: 'archer', slot: 17, name: "Hunter's Rain", roles: ['zone', 'extender'], targeting: 'mouseGround',
    startup: 550, active: 3000, recovery: 300, cooldown: 14000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 3550],
    placeRange: 260,
    hits: Array.from({ length: 15 }, (_, i) => H(i * 200, 7, { kind: 'placed', radius: 115 }, { stun: 240, float: true, juggleCost: 4, slow: { pct: 30, ms: 500 } }, { reachUp: 180 })),
    cancelOnHit: ['quick_shot', 'sky_rain'],
    description: 'Fire dozens of arrows into the sky: for 3s they rain down on a marked spot on the floor, and the direction you hold steers the mark anywhere around you while you stand your ground.',
    relations: ['Rooted', 'Steer the rain'],
  }),
  S({
    id: 'eagle_arrow', cls: 'archer', slot: 16, name: 'Eagle Tide', roles: ['finisher', 'peel'], targeting: 'mouseLine',
    startup: 1200, active: 700, recovery: 400, cooldown: 25000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1900], // the held direction turns it while charging
    hits: [0, 230, 460].map((t, i) => H(t, i === 2 ? 30 : 16, { kind: 'line', length: 1920, width: 320 }, i === 2 ? { stun: 460, launch: 160, push: 90, juggleCost: 30 } : { stun: 300, push: 40, float: true, juggleCost: 8 }, { reachUp: 260, heavy: i === 2 })),
    cancelOnHit: ['sky_rain'], telegraph: 'line',
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
    hits: [H(0, 10, { kind: 'sector', range: 80, angle: 110 }, { stun: 150, push: 3 }, { reachUp: 70 })],
    chain: {
      resetMs: 600,
      stages: [
        [H(0, 9, { kind: 'sector', range: 80, angle: 110 }, { stun: 300, push: 3 }, { reachUp: 70 })],
        [H(0, 9, { kind: 'sector', range: 80, angle: 110 }, { stun: 300, push: 3 }, { reachUp: 70 })],
        [H(0, 6, { kind: 'sector', range: 84, angle: 120 }, { stun: 320, push: 2 }, { reachUp: 80 }),
          H(60, 6, { kind: 'sector', range: 84, angle: 120 }, { stun: 320, push: 4 }, { reachUp: 80 })],
        [H(0, 14, { kind: 'sector', range: 90, angle: 130 }, { stun: 420, launch: 70, juggleCost: 12 }, { reachUp: 110, heavy: true })],
      ],
      timings: [{ startup: 75, active: 70, recovery: 100 }, { startup: 70, active: 70, recovery: 100 }, { startup: 80, active: 120, recovery: 110 }, { startup: 95, active: 90, recovery: 190 }],
    },
    cancelOnHit: ['shadow_step', 'spin_cut', 'iai_strike', 'sword_wave'],
    description: 'Four quick cuts: tap or hold Space. Slash, backhand, a cross cut, then a rising cut that lifts the foe — the opening for your skills.',
    relations: ['Hold Space to chain', 'Cancel into skills on hit'],
  }),
  S({
    id: 'shadow_step', cls: 'samurai', slot: 1, name: 'Shadow Step', roles: ['chase', 'gapClose'], targeting: 'mouseDir',
    startup: 100, active: 150, recovery: 150, cooldown: 3500, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 160 }, through: true, charges: 2, chargeGap: 200,
    hits: [H(0, 22, { kind: 'capsule', radius: 28 }, { stun: 220, push: 8 }, { reachUp: 90 })],
    cancelOnHit: ['spin_cut', 'iai_strike', 'quick_slash', 'blossom_storm', 'dragon_eclipse'], telegraph: 'line',
    description: 'Step through the foe in a blink, cutting as you pass, and land behind it facing it. Two steps in a row, then the cooldown.',
    relations: ['2 steps in a row', 'Cancel → Swallow Cut'],
  }),
  S({
    id: 'spin_cut', cls: 'samurai', slot: 2, name: 'Spin Cut', roles: ['extender', 'airExtender'], targeting: 'self',
    startup: 110, active: 260, recovery: 170, cooldown: 4000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 24, lift: 70 }, // he rises with the spin (and with the foe it lifts)
    hits: [H(0, 12, { kind: 'circle', radius: 96 }, { stun: 320, launch: 60, juggleCost: 12 }, { reachUp: 120 }),
      H(130, 12, { kind: 'circle', radius: 100 }, { stun: 320, float: true, juggleCost: 6 }, { reachUp: 200 })],
    cancelOnHit: ['iai_strike', 'quick_slash', 'sword_wave', 'blossom_storm', 'dragon_eclipse'], telegraph: 'circle',
    description: 'Spin with the blade out and rise with it: two cuts all around you lift the foe and keep it in the air with you.',
    relations: ['Rises with the foe', 'Cancel → Iai Strike'],
  }),
  S({
    id: 'iai_strike', cls: 'samurai', slot: 3, name: 'Iai Strike', roles: ['precision', 'finisher'], targeting: 'mouseLine',
    startup: 900, active: 80, recovery: 260, cooldown: 5500, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    // hold the key: the drawing stance charges (startup = how long it was held, 160..900 ms); the level picks the cut
    hits: [H(0, 30, { kind: 'line', length: 160, width: 36 }, { stun: 380, push: 12 }, { reachUp: 90, heavy: true })],
    charge: { minMs: 160, levels: [
      { at: 0, hits: [H(0, 30, { kind: 'line', length: 160, width: 36 }, { stun: 380, push: 12 }, { reachUp: 90, heavy: true })] },
      { at: 340, hits: [H(0, 44, { kind: 'line', length: 230, width: 40 }, { stun: 420, knockdown: 'light', push: 14 }, { reachUp: 100, heavy: true })] },
      { at: 680, hits: [H(0, 64, { kind: 'line', length: 320, width: 48 }, { stun: 460, knockdown: 'heavy', push: 18 }, { reachUp: 120, heavy: true })] },
    ] },
    cancelOnHit: ['sword_wave', 'blossom_storm', 'dragon_eclipse'], // (its reach is drawn by its own charge picture, SkillFx.iai)
    description: 'Hold the key: your hand on the sheath, a glint grows in three steps. Release: a lightning draw-cut along a line — the longer you held, the farther and harder it cuts; fully charged, every foe in the line crumples to the floor.',
    relations: ['Hold to charge (3 levels)', 'Knockdown'],
  }),
  S({
    id: 'sword_wave', cls: 'samurai', slot: 4, name: 'Sword Wave', roles: ['projectile'], targeting: 'mouseProjectile',
    startup: 150, active: 0, recovery: 180, cooldown: 6000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    charges: 3, chargeGap: 150,
    hits: [H(0, 26, { kind: 'projectile', speed: 800, range: 380, radius: 18 }, { stun: 230, push: 12, float: true, juggleCost: 15 })],
    cancelOnHit: ['shadow_step', 'blossom_storm'],
    description: 'Fling a crimson crescent of steel that flies fast and pops the foe up. Press again or hold the key to throw up to three in a row. Walls stop it.',
    relations: ['Up to 3 in a row', 'Pop-up'],
  }),
  S({
    id: 'mirage', cls: 'samurai', slot: 5, name: 'Mirage Counter', roles: ['counter', 'escape'], targeting: 'mouseDir',
    startup: 120, active: 420, recovery: 260, cooldown: 7000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    counter: { window: 420, sidestep: 46, behind: 62 },
    hits: [H(0, 24, { kind: 'sector', range: 96, angle: 140 }, { stun: 320, push: 20, launch: 55, juggleCost: 20 }, { reachUp: 90, heavy: true })],
    cancelOnHit: ['quick_slash', 'shadow_step', 'blossom_storm', 'dragon_eclipse'],
    description: 'Take the counter stance for a moment: a blow that reaches you hits only a mirage — it shatters into ink and petals — and you reappear behind the attacker with a cut that throws him up. If no blow comes, you are open.',
    relations: ['Counter', 'Launch on counter'],
  }),
  S({
    id: 'blossom_storm', cls: 'samurai', slot: 6, name: 'Blossom Storm', roles: ['signature', 'chase'], targeting: 'mouseTarget',
    startup: 300, active: 700, recovery: 320, cooldown: 16000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 150 },
    hits: [0, 140, 280, 420, 600].map((t, i) => H(t, [9, 9, 9, 9, 10][i], { kind: 'circle', radius: 92 },
      i === 4 ? { stun: 300, launch: 110, juggleCost: 30 } : { stun: 220, float: true, juggleCost: 8 }, { reachUp: 130, heavy: i === 4 })),
    cancelOnHit: ['dragon_eclipse'], tags: ['signature'], telegraph: 'circle',
    description: 'Chase the foe as a storm of cherry blossoms and afterimages: five cuts, the last one throws it high into the air.',
    relations: ['Signature', 'Cancel → Dragon Eclipse'],
  }),
  S({
    id: 'dragon_eclipse', cls: 'samurai', slot: 7, name: 'Dragon Eclipse', roles: ['ultimate', 'finisher'], targeting: 'mouseTarget',
    startup: 1350, active: 420, recovery: 520, cooldown: 45000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 120 },
    // eight cuts out of the dark from eight directions hold the foe where it is, then the dragon's colossal cut (62 in all, as before)
    hits: [...Array.from({ length: 8 }, (_, i) => H(i * 34, 4, { kind: 'line', length: 260, width: 90 }, { stun: 300, float: true, juggleCost: 2 }, { reachUp: 160 })),
      H(330, 30, { kind: 'line', length: 190, width: 64 }, { stun: 420, knockdown: 'heavy', push: 26 }, { reachUp: 160, heavy: true })],
    endsCombo: true, tags: ['ultimate'], telegraph: 'line',
    description: 'The world goes dark and a black sun rises. You vanish: eight cuts out of the dark from eight directions — then one colossal cut of the crimson dragon. Heavy knockdown; ends the combo.',
    relations: ['Ultimate', 'Ends combo'],
  }),
  // ---- extended kit (Q R F G C V T H Z X)
  S({
    id: 'swallow_cut', cls: 'samurai', slot: 8, name: 'Swallow Cut', roles: ['launcher', 'antiAir'], targeting: 'mouseCone',
    startup: 120, active: 220, recovery: 240, cooldown: 3000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 15, { kind: 'sector', range: 104, angle: 110 }, { stun: 420, launch: 150, juggleCost: 30 }, { reachUp: 110 }),
      H(130, 10, { kind: 'sector', range: 108, angle: 120 }, { stun: 340, float: true, juggleCost: 6 }, { reachUp: 240 })],
    cancelOnHit: ['quick_slash', 'shadow_step', 'iai_strike', 'spin_cut', 'hundred_cuts', 'falcon_dive', 'tornado_blade', 'phantom_blades'],
    description: 'The blade rises in a crescent that throws the foe into the air, then turns back like a swallow for a second cut while it hangs there.',
    relations: ['Launcher', 'Jump → Hundred Cuts'],
  }),
  S({
    id: 'hundred_cuts', cls: 'samurai', slot: 9, name: 'Hundred Cuts', roles: ['extender', 'airExtender'], targeting: 'mouseCone',
    startup: 130, active: 1040, recovery: 220, cooldown: 7000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1170],
    hits: [...Array.from({ length: 12 }, (_, i) => H(i * 80, 3, { kind: 'sector', range: 110, angle: 130 }, { stun: 300, float: true, juggleCost: 2 }, { reachUp: 200 })),
      H(1000, 12, { kind: 'sector', range: 118, angle: 140 }, { stun: 420, push: 34, launch: 70, juggleCost: 10 }, { reachUp: 200, heavy: true })],
    cancelOnHit: ['swallow_cut', 'iai_strike', 'sword_wave', 'falcon_dive', 'phantom_blades', 'blossom_storm', 'dragon_eclipse'],
    description: 'A storm of rapid cuts in front of you: twelve strikes in one second hold the foe where it is, in the air too, and the last one blasts it away.',
    relations: ['Air hold', 'Finish → Falcon Dive'],
  }),
  S({
    id: 'kagemusha', cls: 'samurai', slot: 10, name: 'Kagemusha', roles: ['setup'], targeting: 'self',
    startup: 220, active: 80, recovery: 160, cooldown: 18000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 3, { kind: 'circle', radius: 110 }, { stun: 240, push: 16 }, { reachUp: 120 })], tags: ['buff'],
    description: 'Vanish in a burst of ink and petals: a ring of five shadow doubles stands round the spot, then they scatter and move on their own — running, stopping, closing in on the foe and feinting at it — while you stay hidden among them for 6s. Strike and you step out of hiding, the doubles swinging with you (no damage; 30% against monsters). Monsters go after the doubles; a double that is struck bursts into petals. Your first real hit is an AMBUSH: a sure critical and a short stun, and the doubles vanish. If you are struck, they vanish at once.',
    relations: ['5 doubles · hidden 6s', 'Ambush: sure critical + stun'],
  }),
  S({
    id: 'tornado_blade', cls: 'samurai', slot: 11, name: 'Tornado Blade', roles: ['zone', 'pull'], targeting: 'mouseDir',
    startup: 260, active: 160, recovery: 260, cooldown: 9000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 12, { kind: 'circle', radius: 100, at: 'aimBias', bias: 90 }, { stun: 360, launch: 90, juggleCost: 12 }, { reachUp: 160 })],
    // rolls forward one step per strike (SamuraiMotion.TORNADO / tornadoPath: the hits and the picture follow one path)
    linger: { at: 'aim', offset: 90, startMs: 120, everyMs: 150, count: 14, radius: 100, maxZ: 220, hit: H(0, 4, { kind: 'circle', radius: 100 }, { stun: 320, pull: 22, float: true }, { reachUp: 220 }) },
    cancelOnHit: ['quick_slash', 'shadow_step', 'swallow_cut', 'hundred_cuts', 'falcon_dive', 'phantom_blades'], telegraph: 'line',
    description: 'Cut a crimson whirlwind of blades loose: it rolls forward for 2s, dragging foes in and keeping them in the air while you keep fighting.',
    relations: ['Rolling zone 2s', 'Air hold'],
  }),
  S({
    id: 'falcon_dive', cls: 'samurai', slot: 12, name: 'Falcon Dive', roles: ['gapClose', 'knockdown'], targeting: 'mouseTarget',
    startup: 180, active: 340, recovery: 360, cooldown: 5000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 230, lift: 120, crash: true },
    hits: [H(150, 10, { kind: 'circle', radius: 90 }, { stun: 300, slam: true }, { reachUp: 200 }),
      H(300, 24, { kind: 'circle', radius: 135 }, { stun: 380, launch: 100, juggleCost: 25 }, { reachUp: 70, heavy: true })],
    cancelOnHit: ['quick_slash', 'swallow_cut', 'hundred_cuts', 'tornado_blade', 'phantom_blades', 'blossom_storm'], telegraph: 'circle',
    description: 'Leap high and dive like a falcon onto the target: the crimson impact slams airborne foes into the floor and blasts grounded ones up.',
    relations: ['Gap close', 'Pop-up → air chase'],
  }),
  S({
    id: 'rising_sun', cls: 'samurai', slot: 13, name: 'Rising Sun', roles: ['setup'], targeting: 'self',
    startup: 700, active: 200, recovery: 280, cooldown: 60000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1180],
    hits: [H(0, 8, { kind: 'circle', radius: 160 }, { stun: 340, push: 30 }, { reachUp: 150 })],
    cancelOnHit: ['quick_slash', 'shadow_step', 'blossom_storm', 'dragon_eclipse'], tags: ['buff', 'party'],
    description: 'Raise the banner of the Rising Sun: +10% damage and critical hits 20% stronger for 90s; its light staggers foes around you. In a party, every party member near you shares it.',
    relations: ['Buff 90s', 'Party buff'],
  }),
  S({
    id: 'phantom_blades', cls: 'samurai', slot: 14, name: 'Phantom Blades', roles: ['finisher', 'zone'], targeting: 'mouseCone',
    startup: 420, active: 640, recovery: 340, cooldown: 18000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1100],
    hits: [...[0, 80, 160, 240, 320, 400, 480].map((t) => H(t, 7, { kind: 'circle', radius: 220, at: 'aimBias', bias: 150 }, { stun: 400, float: true, juggleCost: 3 }, { reachUp: 280 })),
      H(600, 22, { kind: 'circle', radius: 230, at: 'aimBias', bias: 150 }, { stun: 500, launch: 130, juggleCost: 20 }, { reachUp: 280, heavy: true })],
    cancelOnHit: ['blossom_storm', 'dragon_eclipse', 'god_of_blades'], telegraph: 'circle',
    description: 'Draw once, and a thousand phantom blades cut the whole field in front of you: seven cuts on every foe in it, the last one throws them all into the air.',
    relations: ['Wide area', 'Cancel → Blossom Storm'],
  }),
  S({
    id: 'god_of_blades', cls: 'samurai', slot: 15, name: 'God of Blades', roles: ['setup', 'zone'], targeting: 'self',
    startup: 600, active: 200, recovery: 260, cooldown: 60000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 1060],
    hits: [H(0, 10, { kind: 'circle', radius: 170 }, { stun: 360, push: 40 }, { reachUp: 160 })],
    // every second two of the halo's blades fly at the nearest foes, each one spent (eight in all; LegacyCourtyardScene: bladeStrikes)
    linger: { at: 'caster', startMs: 600, everyMs: 1000, count: 30, radius: 220, maxZ: 220, hit: H(0, 6, { kind: 'circle', radius: 220 }, { stun: 300, float: true }, { reachUp: 220 }) },
    cancelOnHit: ['quick_slash', 'phantom_blades', 'blossom_storm', 'dragon_eclipse'], tags: ['buff'],
    description: 'Eight spectral katanas rise behind you for 30s: +15% damage, and every second two of them fly at the nearest foes on their own — each one that flies is spent, eight strikes in all.',
    relations: ['Buff 30s', 'Blades strike on their own'],
  }),
  S({
    id: 'sakura_bind', cls: 'samurai', slot: 16, name: 'Sakura Bind', roles: ['hardCC', 'pull', 'setup'], targeting: 'mouseGround',
    startup: 240, active: 160, recovery: 220, cooldown: 12000, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 300,
    hits: [H(0, 8, { kind: 'placed', radius: 125 }, { stun: 400, pull: 70, hardCC: { kind: 'root', ms: 2000 } }, { reachUp: 60 })],
    cancelOnHit: ['quick_slash', 'shadow_step', 'hundred_cuts', 'phantom_blades', 'tornado_blade', 'iai_strike'], telegraph: 'ground',
    description: 'A ring of cherry blossoms opens where you aim: every foe in it is pulled to its centre and held by blossoming branches for 2s — ready for your cuts.',
    relations: ['Pull + bind 2s', 'Setup → Hundred Cuts'],
  }),
  S({
    id: 'dragon_ascension', cls: 'samurai', slot: 17, name: 'Dragon Ascension', roles: ['launcher', 'extender'], targeting: 'self',
    startup: 260, active: 600, recovery: 300, cooldown: 14000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 900],
    hits: [H(0, 18, { kind: 'circle', radius: 150 }, { stun: 460, launch: 145, juggleCost: 30 }, { reachUp: 140, heavy: true }), // (lifts ~190 px: the follow-ups reach it at once)
      ...[160, 320, 480].map((t) => H(t, 7, { kind: 'circle', radius: 160 }, { stun: 380, float: true, juggleCost: 4 }, { reachUp: 380 }))],
    cancelOnHit: ['falcon_dive', 'hundred_cuts', 'phantom_blades', 'blossom_storm', 'dragon_eclipse'], telegraph: 'circle',
    description: 'A crimson dragon spirals up from your blade and carries every foe around you high into the air, cutting them as it rises.',
    relations: ['Big launcher', 'Air chase → Falcon Dive'],
  }),
];

// Warrior skills: longer, weightier presence (free cancel keeps the flow): stretch timings and hit spacing.
// (The PvP arena runs them at their base timings again: arenaTimeScale.)
const WARRIOR_STRETCH = { startup: 1.3, active: 1.4, recovery: 1.15, at: 1.4 };
const warriorStretched = (s: FinalSkill): boolean => s.cls === 'warrior' && s.slot >= 1 && s.slot <= 15 && s.id !== 'war_cry' && s.id !== 'guard_counter' && s.id !== 'radiant_blade';
for (const w of warrior) if (warriorStretched(w)) {
  w.startup = Math.round(w.startup * WARRIOR_STRETCH.startup); w.active = Math.round(w.active * WARRIOR_STRETCH.active); w.recovery = Math.round(w.recovery * WARRIOR_STRETCH.recovery);
  for (const h of w.hits) h.at = Math.round(h.at * WARRIOR_STRETCH.at);
}
/** The PvP arena: the warrior's stretched skills at their base pace (fast, explosive duels); null = as they are. */
export function arenaTimeScale(s: FinalSkill): { startup: number; active: number; recovery: number; at: number } | null {
  return warriorStretched(s) ? { startup: 1 / WARRIOR_STRETCH.startup, active: 1 / WARRIOR_STRETCH.active, recovery: 1 / WARRIOR_STRETCH.recovery, at: 1 / WARRIOR_STRETCH.at } : null;
}
// Warrior extended kit: every core skill (and the basic chain) can cancel into the new extenders on a confirmed hit.
for (const w of warrior) if (w.slot <= 5) for (const id of ['leap_crash', 'wave_slash', 'lance_thrust']) if (!w.cancelOnHit.includes(id) && id !== w.id) w.cancelOnHit.push(id);
// Samurai extended kit: every core skill (and the basic chain) can cancel into the new cuts on a confirmed hit.
for (const m of samurai) if (m.slot <= 5) for (const id of ['swallow_cut', 'hundred_cuts', 'falcon_dive', 'tornado_blade']) if (!m.cancelOnHit.includes(id)) m.cancelOnHit.push(id);
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

export const FINAL_SKILLS: FinalSkill[] = [...warrior, ...mage, ...archer, ...samurai];
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
