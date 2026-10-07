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
    startup: 90, active: 80, recovery: 120, cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 12, { kind: 'sector', range: 78, angle: 110 }, { stun: 160, push: 4 }, { reachUp: 70 })],
    chain: {
      resetMs: 700,
      stages: [
        [H(0, 7, { kind: 'sector', range: 84, angle: 120 }, { stun: 380, push: 3 }, { reachUp: 110 })],
        [H(0, 7, { kind: 'sector', range: 86, angle: 120 }, { stun: 320, push: 3 }, { reachUp: 110 })],
        [H(0, 5, { kind: 'sector', range: 88, angle: 130 }, { stun: 320, push: 2 }, { reachUp: 110 }),
          H(120, 6, { kind: 'sector', range: 88, angle: 130 }, { stun: 380, push: 3 }, { reachUp: 110 })],
        [H(0, 10, { kind: 'sector', range: 92, angle: 130 }, { stun: 440, push: 10 }, { reachUp: 110, heavy: true })],
      ],
      timings: [{ startup: 100, active: 85, recovery: 195 }, { startup: 100, active: 85, recovery: 195 }, { startup: 110, active: 170, recovery: 215 }, { startup: 140, active: 115, recovery: 320 }],
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
    relations: ['Opener', 'Cancel → Rising Slash'],
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
    hits: [H(0, 6, { kind: 'circle', radius: 120 }, { stun: 300, push: 60 }, { reachUp: 120 })],
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
    startup: 1650, active: 640, recovery: 600, cooldown: 30000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 2750],
    hits: [H(0, 14, { kind: 'circle', radius: 190, at: 'aimBias', bias: 110 }, { stun: 600, launch: 150, juggleCost: 0 }, { reachUp: 260, heavy: true }),
      ...[90, 160, 230, 300, 370, 440, 510, 580].map((t) => H(t, 6, { kind: 'circle', radius: 200, at: 'aimBias', bias: 110 }, { stun: 420, float: true }, { reachUp: 320 }))],
    endsCombo: true, tags: ['ultimate'], telegraph: 'cone',
    description: 'Sword lifted, ground-crack telegraph, overhead impact. Heavy knockdown; ends the combo.',
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
    startup: 1800, active: 160, recovery: 260, cooldown: 20000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK, armor: [0, 2100],
    hits: [H(0, 8, { kind: 'circle', radius: 130 }, { stun: 360, push: 30 }, { reachUp: 140 })],
    cancelOnHit: ['warrior_basic', 'dash_slash', 'rising_slash', 'whirlwind', 'blade_storm'], tags: ['buff'],
    description: 'Your sword becomes a long blade of pure light for 15s: every sword strike reaches 70% farther and deals +15% damage. The transformation releases a light burst around you.',
    relations: ['Buff 15s', 'Range +85%'],
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
    description: 'Battle roar — also breaks free from stun, hits and knockdowns: pulls nearby foes in and grants a golden aura for 8s — +20% damage and super armor while attacking.',
    relations: ['Buff 8s', 'Super armor'],
  }),
  S({
    id: 'judgment_blade', cls: 'warrior', slot: 13, name: 'Judgment Blade', roles: ['zone', 'setup'], targeting: 'mouseDir',
    startup: 2220, active: 320, recovery: 240, cooldown: 9000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    charges: 3, chargeGap: 120,
    hits: [H(180, 14, { kind: 'circle', radius: 80, at: 'aimBias', bias: 150 }, { stun: 420, pin: 400 }, { reachUp: 280, heavy: true })],
    linger: { at: 'aim', offset: 150, startMs: 520, everyMs: 500, count: 10, radius: 130, maxZ: 40, hit: H(0, 3, { kind: 'circle', radius: 130 }, { stun: 560, pin: 480 }, { reachUp: 40 }) },
    cancelOnHit: ['warrior_basic', 'rising_slash', 'leap_crash', 'lance_thrust', 'blade_storm'],
    description: 'Leap once and hurl up to 3 blades in a row from the air: every press of V throws the next blade at once (no wait between throws); if you stop, you float slowly back down. Each blade stays planted for 5s inside a storm ring that shocks and roots anyone standing in it.',
    relations: ['Zone 5s', 'Root → free combo'],
  }),
];

// ------------------------------------------------------------------ BOOK MAGE
const mage: FinalSkill[] = [
  S({
    id: 'arcane_bolt', cls: 'book_mage', slot: 0, name: 'Arcane Bolt', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
    startup: 90, active: 0, recovery: 130, cooldown: 450, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: { startup: 0.8, active: 0.8, recovery: 0.8 },
    hits: [H(0, 11, { kind: 'projectile', speed: 720, range: 480, radius: 10 }, { stun: 140, push: 4 })],
    cancelOnHit: ['arcane_wave', 'binding_rune', 'astral_burst', 'frost_nova', 'lightning_chain'],
    description: 'Mobile arcane projectile fired in the facing direction (you can keep moving at 80%).',
    relations: ['Poke', 'Confirm → Arcane Wave'],
  }),
  S({
    id: 'arcane_wave', cls: 'book_mage', slot: 1, name: 'Arcane Wave', roles: ['confirm', 'peel'], targeting: 'mouseLine',
    startup: 150, active: 180, recovery: 180, cooldown: 3500, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 24, { kind: 'line', length: 230, width: 74 }, { stun: 240, push: 30, float: true, juggleCost: 15 }, { reachUp: 170 })],
    cancelOnHit: ['astral_burst', 'storm_field', 'lightning_chain', 'binding_rune', 'time_collapse'], telegraph: 'line',
    description: 'Wide short wave in the facing direction. Pushes grounded targets, stabilises airborne ones for a follow-up.',
    relations: ['Confirm', 'Air stabiliser'],
  }),
  S({
    id: 'binding_rune', cls: 'book_mage', slot: 2, name: 'Binding Rune', roles: ['setup', 'hardCC'], targeting: 'mouseGround',
    startup: 240, active: 120, recovery: 210, cooldown: 6500, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 280,
    hits: [H(0, 16, { kind: 'placed', radius: 68 }, { hardCC: { kind: 'root', ms: 350 }, stun: 120 })],
    cancelOnHit: ['astral_burst', 'lightning_chain', 'arcane_wave', 'frost_nova'], telegraph: 'ground',
    description: 'Rune at the facing direction (clear circle telegraph). Roots for 350ms (shared diminishing returns).',
    relations: ['Setup', 'Rune → Astral Lift'],
  }),
  S({
    id: 'astral_burst', cls: 'book_mage', slot: 3, name: 'Astral Lift', roles: ['launcher', 'pull'], targeting: 'selfAim',
    startup: 180, active: 140, recovery: 220, cooldown: 8000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 30, { kind: 'circle', radius: 104, at: 'aimBias', bias: 60 }, { stun: 420, pull: 26, launch: 100, juggleCost: 35 }, { reachUp: 120 })],
    cancelOnHit: ['lightning_chain', 'arcane_wave', 'storm_field', 'arcane_bolt'], telegraph: 'circle',
    description: 'Short inward pull, then lifts the target ~82px. Ideal starter after Binding Rune.',
    relations: ['Launcher', 'Air → Lightning Chain'],
  }),
  S({
    id: 'frost_nova', cls: 'book_mage', slot: 4, name: 'Frost Nova', roles: ['zone', 'peel'], targeting: 'self',
    startup: 170, active: 160, recovery: 220, cooldown: 6000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 22, { kind: 'circle', radius: 135 }, { stun: 140, slow: { pct: 0.3, ms: 900 }, push: 14 }, { reachUp: 100 })],
    cancelOnHit: ['arcane_bolt', 'binding_rune', 'arcane_wave'], telegraph: 'circle',
    description: 'Defensive ring: 30% slow for 0.9s plus a small hit-stun. The slow is not hard control.',
    relations: ['Peel', 'Reset spacing'],
  }),
  S({
    id: 'lightning_chain', cls: 'book_mage', slot: 5, name: 'Lightning Chain', roles: ['airExtender', 'precision'], targeting: 'mouseTarget',
    startup: 130, active: 240, recovery: 190, cooldown: 5500, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [
      H(0, 14, { kind: 'chain', corridor: 360, width: 56, jump: 0 }, { stun: 200, float: true, juggleCost: 18 }, { reachUp: 140 }),
      H(120, 12, { kind: 'chain', corridor: 360, width: 56, jump: 150 }, { stun: 180, float: true, juggleCost: 10 }, { reachUp: 140 }),
    ],
    cancelOnHit: ['arcane_wave', 'storm_field', 'arcane_bolt', 'time_collapse'], telegraph: 'line',
    description: 'Snaps to the first legal target in the aim corridor, then arcs to one nearby target. Extra vertical reach versus airborne targets.',
    relations: ['Air extender', 'Chain → Arcane Wave'],
  }),
  S({
    id: 'storm_field', cls: 'book_mage', slot: 6, name: 'Storm Field', roles: ['signature', 'zone'], targeting: 'mouseGround',
    startup: 320, active: 1500, recovery: 300, cooldown: 16000, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: { startup: 0, active: 1, recovery: 0 },
    placeRange: 320,
    hits: [0, 480, 960, 1440].map((t, i) => H(t, 10, { kind: 'placed', radius: 124 },
      i === 3 ? { stun: 280, launch: 105, slow: { pct: 0.2, ms: 600 }, juggleCost: 30 } : { stun: 180, pull: 10, slow: { pct: 0.2, ms: 600 }, juggleCost: 6 }, { reachUp: 160, heavy: i === 3 })),
    zoneMs: 1500, cancelOnHit: ['time_collapse', 'astral_burst', 'lightning_chain'], tags: ['signature'], telegraph: 'ground',
    description: 'Persistent electrical field: four readable ticks with a 20% slow and a tiny centre pull; the final tick pops the target upward if budget allows. The mage is free to move while it rages.',
    relations: ['Signature', 'Final pop → Astral Lift'],
  }),
  S({
    id: 'time_collapse', cls: 'book_mage', slot: 7, name: 'Time Collapse', roles: ['ultimate', 'finisher'], targeting: 'mouseGround',
    startup: 650, active: 420, recovery: 480, cooldown: 45000, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 300,
    hits: [
      H(0, 0, { kind: 'placed', radius: 158 }, { pull: 34 }),
      H(200, 0, { kind: 'placed', radius: 150 }, { pull: 30, hardCC: { kind: 'freeze', ms: 260 } }),
      H(400, 58, { kind: 'placed', radius: 150 }, { stun: 400, knockdown: 'heavy' }, { reachUp: 180, heavy: true }),
    ],
    endsCombo: true, tags: ['ultimate'], telegraph: 'ground',
    description: 'Large warning circle, gradual inward pull, DR-aware freeze at collapse, then detonation with a heavy knockdown. Ends the combo.',
    relations: ['Ultimate', 'Ends combo'],
  }),
];

// ------------------------------------------------------------------ ARCHER
const archer: FinalSkill[] = [
  S({
    id: 'quick_shot', cls: 'archer', slot: 0, name: 'Quick Shot', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
    startup: 85, active: 0, recovery: 110, cooldown: 350, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: { startup: 0.85, active: 0.85, recovery: 0.85 },
    hits: [H(0, 12, { kind: 'projectile', speed: 900, range: 430, radius: 9 }, { stun: 120, push: 3 })],
    cancelOnHit: ['multi_shot', 'piercing_arrow', 'explosive_arrow', 'vine_trap', 'rain_of_arrows'],
    description: 'Fast bow shot in the facing direction; usable while moving at 85% speed.',
    relations: ['Poke', 'Air follow-up'],
  }),
  S({
    id: 'multi_shot', cls: 'archer', slot: 1, name: 'Multi Shot', roles: ['confirm', 'projectile'], targeting: 'mouseCone',
    startup: 130, active: 150, recovery: 160, cooldown: 2800, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 22, { kind: 'projectile', speed: 820, range: 380, radius: 10, count: 3, spread: 14 }, { stun: 220, push: 10, float: true, juggleCost: 12 })],
    cancelOnHit: ['explosive_arrow', 'piercing_arrow', 'quick_shot', 'skyhunters_step'], telegraph: 'cone',
    description: 'Three-arrow fan; one damage event per target. Strong close-mid confirm.',
    relations: ['Confirm', 'Cancel → Explosive Arrow'],
  }),
  S({
    id: 'piercing_arrow', cls: 'archer', slot: 2, name: 'Piercing Arrow', roles: ['precision', 'projectile'], targeting: 'mouseLine',
    startup: 180, active: 0, recovery: 180, cooldown: 4200, ground: true, air: true, cover: 'PIERCES_ACTORS', move: LOCK,
    hits: [H(0, 26, { kind: 'projectile', speed: 1000, range: 520, radius: 10, pierce: true }, { stun: 220, push: 15 })],
    cancelOnHit: ['skyhunters_step', 'multi_shot', 'quick_shot'], telegraph: 'trajectory',
    description: 'Precision arrow that pierces actors but not hard cover; small knockback.',
    relations: ['Precision', 'Confirm → Skyhunter’s Step'],
  }),
  S({
    id: 'explosive_arrow', cls: 'archer', slot: 3, name: 'Explosive Arrow', roles: ['projectile', 'launcher'], targeting: 'mouseProjectile',
    startup: 190, active: 0, recovery: 200, cooldown: 6000, ground: true, air: true, cover: 'EXPLODES_ON_COVER', move: LOCK,
    hits: [H(0, 30, { kind: 'projectile', speed: 760, range: 460, radius: 10, explodeRadius: 72 }, { stun: 300, launch: 55, push: 18, juggleCost: 25 })],
    cancelOnHit: ['quick_shot', 'rain_of_arrows', 'skyhunters_step'],
    description: 'Visible arrow that bursts at the target, cover or max range. A direct hit pops the target up modestly.',
    relations: ['Pop', 'Jump → Quick Shot'],
  }),
  S({
    id: 'vine_trap', cls: 'archer', slot: 4, name: 'Vine Trap', roles: ['trap', 'setup', 'hardCC'], targeting: 'mouseGround',
    startup: 220, active: 60, recovery: 190, cooldown: 6500, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 260, trap: { radius: 42, lifeMs: 4000 },
    hits: [H(0, 14, { kind: 'placed', radius: 42 }, { hardCC: { kind: 'root', ms: 300 }, stun: 120 })],
    cancelOnHit: [], telegraph: 'ground',
    description: 'Visible trap at the facing direction; persists 4s or until triggered. Roots for 300ms (shared diminishing returns).',
    relations: ['Setup', 'Trap → Multi Shot'],
  }),
  S({
    id: 'rain_of_arrows', cls: 'archer', slot: 5, name: 'Rain of Arrows', roles: ['zone', 'extender'], targeting: 'mouseGround',
    startup: 260, active: 900, recovery: 240, cooldown: 8500, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: { startup: 0, active: 0.6, recovery: 0 },
    placeRange: 360,
    hits: [0, 380, 760].map((t) => H(t, 12, { kind: 'placed', radius: 112 }, { stun: 110, float: true, juggleCost: 10 }, { reachUp: 160 })),
    zoneMs: 900, cancelOnHit: ['quick_shot', 'skyhunters_step'], telegraph: 'ground',
    description: 'Three waves of arrows on the facing direction area. Low hit-stun: keeps pressure without locking forever.',
    relations: ['Area control', 'Keeps juggles alive'],
  }),
  S({
    id: 'skyhunters_step', cls: 'archer', slot: 6, name: "Skyhunter's Step", roles: ['signature', 'mobility', 'chase'], targeting: 'mouseDir',
    startup: 200, active: 720, recovery: 280, cooldown: 16000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 220, lift: 46 },
    hits: [80, 230, 380, 530, 680].map((t, i) => H(t, [8, 8, 9, 9, 10][i], { kind: 'projectile', speed: 980, range: 420, radius: 9 }, { stun: 200, float: true, juggleCost: 12 })),
    cancelOnHit: ['verdant_judgment'], tags: ['signature'], telegraph: 'trajectory',
    description: 'Acrobatic leap in the facing direction while firing five aimed shots. Collision and cover still apply; no invulnerability.',
    relations: ['Signature', 'Chases a launch'],
  }),
  S({
    id: 'verdant_judgment', cls: 'archer', slot: 7, name: 'Verdant Judgment', roles: ['ultimate', 'finisher'], targeting: 'mouseGround',
    startup: 620, active: 500, recovery: 480, cooldown: 45000, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 380,
    hits: [
      H(0, 0, { kind: 'placed', radius: 118 }, { hardCC: { kind: 'root', ms: 300 } }),
      H(380, 58, { kind: 'placed', radius: 118 }, { stun: 400, knockdown: 'heavy' }, { reachUp: 180, heavy: true }),
    ],
    endsCombo: true, tags: ['ultimate'], telegraph: 'ground',
    description: 'Root-vine telegraph, then a spectral great-bow arrow descends: heavy knockdown. Ends the combo.',
    relations: ['Ultimate', 'Ends combo'],
  }),
];

// ------------------------------------------------------------------ SAMURAI
const samurai: FinalSkill[] = [
  S({
    id: 'quick_slash', cls: 'samurai', slot: 0, name: 'Quick Slash', roles: ['basic', 'confirm'], targeting: 'aimAssist',
    startup: 75, active: 70, recovery: 100, cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 10, { kind: 'sector', range: 80, angle: 110 }, { stun: 150, push: 3 }, { reachUp: 70 })],
    chain: {
      resetMs: 600,
      stages: [
        [H(0, 10, { kind: 'sector', range: 80, angle: 110 }, { stun: 150, push: 3 }, { reachUp: 70 })],
        [H(0, 10, { kind: 'sector', range: 80, angle: 110 }, { stun: 160, push: 4 }, { reachUp: 70 })],
        [H(0, 16, { kind: 'sector', range: 88, angle: 120 }, { stun: 210, push: 28, juggleCost: 15 }, { reachUp: 70, heavy: true })],
      ],
      timings: [{ startup: 75, active: 70, recovery: 100 }, { startup: 70, active: 70, recovery: 100 }, { startup: 100, active: 80, recovery: 160 }],
    },
    cancelOnHit: ['shadow_step', 'spin_cut', 'iai_strike', 'sword_wave'],
    description: 'Three-stage slash chain; the third cut knocks back. Chain resets after 0.6s.',
    relations: ['Fast confirm', 'Cancel → Shadow Step'],
  }),
  S({
    id: 'shadow_step', cls: 'samurai', slot: 1, name: 'Shadow Step', roles: ['chase', 'gapClose'], targeting: 'mouseDir',
    startup: 100, active: 150, recovery: 150, cooldown: 3000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 160 },
    hits: [H(0, 22, { kind: 'capsule', radius: 28 }, { stun: 220, push: 8 }, { reachUp: 90 })],
    cancelOnHit: ['spin_cut', 'iai_strike', 'quick_slash', 'blossom_storm', 'dragon_eclipse'], telegraph: 'line',
    description: 'Fast step through the facing direction direction (no invulnerability). A confirmed hit cancels into Spin Cut or Iai Strike.',
    relations: ['Chase', 'Cancel → Spin Cut'],
  }),
  S({
    id: 'spin_cut', cls: 'samurai', slot: 2, name: 'Spin Cut', roles: ['extender', 'airExtender'], targeting: 'self',
    startup: 110, active: 220, recovery: 170, cooldown: 4000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [0, 110].map((t) => H(t, 14, { kind: 'circle', radius: 96 }, { stun: 220, float: true, juggleCost: 15 }, { reachUp: 110 })),
    cancelOnHit: ['iai_strike', 'quick_slash', 'sword_wave', 'blossom_storm', 'dragon_eclipse'], telegraph: 'circle',
    description: 'Two-hit rotation; keeps a nearby airborne target in the air without relaunching it.',
    relations: ['Extender', 'Cancel → Iai Strike'],
  }),
  S({
    id: 'iai_strike', cls: 'samurai', slot: 3, name: 'Iai Strike', roles: ['precision', 'finisher'], targeting: 'mouseLine',
    startup: 240, active: 80, recovery: 260, cooldown: 5500, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 36, { kind: 'line', length: 152, width: 36 }, { stun: 420, knockdown: 'light', push: 12 }, { reachUp: 90, heavy: true })],
    cancelOnHit: ['sword_wave', 'blossom_storm', 'dragon_eclipse'], telegraph: 'line',
    description: 'Narrow drawing cut; brief crumple on hit. Very punishable on whiff (no cancel).',
    relations: ['Punish', 'Whiff = punishable'],
  }),
  S({
    id: 'sword_wave', cls: 'samurai', slot: 4, name: 'Sword Wave', roles: ['projectile'], targeting: 'mouseProjectile',
    startup: 150, active: 0, recovery: 180, cooldown: 5000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 26, { kind: 'projectile', speed: 800, range: 380, radius: 18 }, { stun: 230, push: 12, float: true, juggleCost: 15 })],
    cancelOnHit: ['shadow_step', 'blossom_storm'],
    description: 'Fast crescent projectile in the facing direction; hard cover blocks it.',
    relations: ['Ranged check', 'Air follow-up'],
  }),
  S({
    id: 'mirage', cls: 'samurai', slot: 5, name: 'Mirage Counter', roles: ['counter', 'escape'], targeting: 'mouseDir',
    startup: 120, active: 420, recovery: 260, cooldown: 7000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    counter: { window: 420, sidestep: 46 },
    hits: [H(0, 24, { kind: 'sector', range: 96, angle: 140 }, { stun: 320, push: 20, launch: 55, juggleCost: 20 }, { reachUp: 90, heavy: true })],
    cancelOnHit: ['quick_slash', 'shadow_step', 'blossom_storm', 'dragon_eclipse'],
    description: 'Counter stance for 420ms. A legal strike that crosses your body triggers a sidestep and a reappearing slash. No trigger = long recovery.',
    relations: ['Counter', 'Confirm → Quick Slash'],
  }),
  S({
    id: 'blossom_storm', cls: 'samurai', slot: 6, name: 'Blossom Storm', roles: ['signature', 'chase'], targeting: 'mouseTarget',
    startup: 300, active: 700, recovery: 320, cooldown: 16000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 150 },
    hits: [0, 140, 280, 420, 600].map((t, i) => H(t, [9, 9, 9, 9, 10][i], { kind: 'circle', radius: 92 },
      i === 4 ? { stun: 300, launch: 110, juggleCost: 30 } : { stun: 220, float: true, juggleCost: 8 }, { reachUp: 130, heavy: i === 4 })),
    cancelOnHit: ['dragon_eclipse'], tags: ['signature'], telegraph: 'circle',
    description: 'Afterimage chase with five discrete cuts; the final cut may relaunch once if the budget permits.',
    relations: ['Signature', 'Cancel → Dragon Eclipse'],
  }),
  S({
    id: 'dragon_eclipse', cls: 'samurai', slot: 7, name: 'Dragon Eclipse', roles: ['ultimate', 'finisher'], targeting: 'mouseTarget',
    startup: 480, active: 260, recovery: 520, cooldown: 45000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    dash: { distance: 120 },
    hits: [H(120, 62, { kind: 'line', length: 190, width: 64 }, { stun: 420, knockdown: 'heavy', push: 26 }, { reachUp: 160, heavy: true })],
    endsCombo: true, tags: ['ultimate'], telegraph: 'line',
    description: 'Brief disappearance, eye/blade glint, then one huge readable slash tied to the real hit. Heavy knockdown; ends the combo.',
    relations: ['Ultimate', 'Ends combo'],
  }),
];

// Warrior skills: longer, weightier presence (free cancel keeps the flow): stretch timings and hit spacing.
for (const w of warrior) if (w.slot >= 1 && w.id !== 'war_cry' && w.id !== 'guard_counter' && w.id !== 'radiant_blade') {
  w.startup = Math.round(w.startup * 1.3); w.active = Math.round(w.active * 1.4); w.recovery = Math.round(w.recovery * 1.15);
  for (const h of w.hits) h.at = Math.round(h.at * 1.4);
}
// Warrior extended kit: every core skill (and the basic chain) can cancel into the new extenders on a confirmed hit.
for (const w of warrior) if (w.slot <= 5) for (const id of ['leap_crash', 'wave_slash', 'lance_thrust']) if (!w.cancelOnHit.includes(id) && id !== w.id) w.cancelOnHit.push(id);
export const FINAL_SKILLS: FinalSkill[] = [...warrior, ...mage, ...archer, ...samurai];
const BY_ID = new Map(FINAL_SKILLS.map((s) => [s.id, s]));
/** Old ids from earlier builds (save-data / QA migration only; never shown in the HUD/tree). */
export const LEGACY_ALIASES: Record<string, string> = {
  final_strike: 'titans_verdict', meteor: 'storm_field', time_warp: 'time_collapse', wind_step: 'skyhunters_step',
  natures_wrath: 'verdant_judgment', dragon_slash: 'dragon_eclipse',
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
