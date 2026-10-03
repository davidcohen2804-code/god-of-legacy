// Final 4-class kits (03_FINAL_CLASS_SKILL_ROSTER.md): exact ids, slots, timings, damage, cooldowns, air/ground use.
// Shape sub-parameters the roster leaves open (ranges / radii / angles) are fixed here once and reused by the telegraph,
// the hit resolver and the VFX placement, so telegraph == hitbox by construction.
import { FinalSkill, HitEvent, HitShape, PVP_MULT, Reaction } from './SkillTypes';

const H = (at: number, damage: number, shape: HitShape, reaction: Reaction, extra: Partial<HitEvent> = {}): HitEvent => ({ at, damage, shape, reaction, ...extra });
const LOCK = { startup: 0, active: 0, recovery: 0 };
const base = { pvpMultiplier: PVP_MULT, pveMultiplier: 1, cancelOnHit: [] as string[], tags: [] as string[] };
const CORE = (ids: string[]) => ids;

/** Unlock levels (11_SKILL_BOOK_PROGRESSION_SPEC.md). */
export const UNLOCK = [1, 2, 4, 6, 9, 12, 16, 20];

function S(s: Omit<FinalSkill, 'pvpMultiplier' | 'pveMultiplier' | 'unlockLevel' | 'tags' | 'cancelOnHit'> & { tags?: string[]; cancelOnHit?: string[] }): FinalSkill {
  return { ...base, ...s, tags: s.tags ?? [], cancelOnHit: s.cancelOnHit ?? [], unlockLevel: UNLOCK[s.slot] };
}

// ------------------------------------------------------------------ WARRIOR
const warrior: FinalSkill[] = [
  S({
    id: 'warrior_basic', cls: 'warrior', slot: 0, name: 'Iron Chain', roles: ['basic', 'confirm'], targeting: 'aimAssist',
    startup: 90, active: 80, recovery: 120, cooldown: 0, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 12, { kind: 'sector', range: 78, angle: 110 }, { stun: 160, push: 4 }, { reachUp: 70 })],
    chain: {
      resetMs: 650,
      stages: [
        [H(0, 12, { kind: 'sector', range: 78, angle: 110 }, { stun: 160, push: 4 }, { reachUp: 70 })],
        [H(0, 12, { kind: 'sector', range: 80, angle: 110 }, { stun: 170, push: 6 }, { reachUp: 70 })],
        [H(0, 18, { kind: 'sector', range: 86, angle: 120 }, { stun: 220, push: 34, juggleCost: 15 }, { reachUp: 70, heavy: true })],
      ],
      timings: [{ startup: 90, active: 80, recovery: 120 }, { startup: 80, active: 80, recovery: 120 }, { startup: 120, active: 90, recovery: 190 }],
    },
    cancelOnHit: ['dash_slash', 'rising_slash', 'ground_breaker', 'whirlwind', 'shield_slam'],
    description: 'Three-strike sword chain. Repeated Space continues the chain; the third strike knocks back.',
    relations: ['Confirm into Rising Slash', 'Chain resets after 0.65s'],
  }),
  S({
    id: 'dash_slash', cls: 'warrior', slot: 1, name: 'Dash Slash', roles: ['gapClose', 'opener'], targeting: 'mouseDir',
    startup: 110, active: 150, recovery: 170, cooldown: 3000, ground: true, air: false, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 180 },
    hits: [H(0, 24, { kind: 'capsule', radius: 30 }, { stun: 220, push: 10 }, { reachUp: 70 })],
    cancelOnHit: CORE(['rising_slash', 'whirlwind', 'shield_slam', 'warrior_basic', 'blade_storm', 'titans_verdict']),
    telegraph: 'line',
    description: 'Charge up to 180px toward the cursor; stops on cover. A confirmed hit can cancel into Rising Slash, Whirlwind or Shield Slam.',
    relations: ['Opener', 'Cancel → Rising Slash'],
  }),
  S({
    id: 'rising_slash', cls: 'warrior', slot: 2, name: 'Rising Slash', roles: ['launcher', 'antiAir'], targeting: 'mouseCone',
    startup: 130, active: 110, recovery: 190, cooldown: 5000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 28, { kind: 'sector', range: 96, angle: 100 }, { stun: 420, launch: 150, juggleCost: 35 }, { reachUp: 90 })],
    cancelOnHit: ['whirlwind', 'warrior_basic', 'blade_storm', 'ground_breaker'],
    description: 'Upward cut that launches the target ~150px into the air (slightly less when used airborne).',
    relations: ['Launcher', 'Jump chase → Whirlwind'],
  }),
  S({
    id: 'ground_breaker', cls: 'warrior', slot: 3, name: 'Ground Breaker', roles: ['knockdown', 'antiAir'], targeting: 'self',
    startup: 220, active: 100, recovery: 260, cooldown: 7500, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 38, { kind: 'circle', radius: 118 }, { stun: 280, slam: true, knockdown: 'light', push: 24 }, { reachUp: 110, heavy: true })],
    cancelOnHit: ['titans_verdict'], telegraph: 'circle',
    description: 'Heavy ground impact. Airborne targets are slammed down; grounded targets are knocked down.',
    relations: ['Finisher', 'Anti-air slam'],
  }),
  S({
    id: 'whirlwind', cls: 'warrior', slot: 4, name: 'Whirlwind', roles: ['extender', 'airExtender'], targeting: 'self',
    startup: 130, active: 320, recovery: 190, cooldown: 5500, ground: true, air: true, cover: 'IGNORES_COVER', move: { startup: 0, active: 0.35, recovery: 0 },
    hits: [0, 107, 214].map((t) => H(t, 10, { kind: 'circle', radius: 104 }, { stun: 200, pull: 8, float: true, juggleCost: 18 }, { reachUp: 100 })),
    cancelOnHit: ['ground_breaker', 'warrior_basic', 'blade_storm', 'titans_verdict'],
    description: 'Three spinning cuts with a light inward vacuum. Keeps a nearby airborne target afloat (consumes juggle budget).',
    relations: ['Air extender', 'Finish with Ground Breaker'],
  }),
  S({
    id: 'shield_slam', cls: 'warrior', slot: 5, name: 'Shield Slam', roles: ['confirm', 'peel'], targeting: 'mouseCone',
    startup: 110, active: 90, recovery: 230, cooldown: 6000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    armor: [60, 200],
    hits: [H(0, 22, { kind: 'sector', range: 82, angle: 80 }, { stun: 320, push: 36 }, { reachUp: 70 })],
    cancelOnHit: ['warrior_basic', 'rising_slash', 'dash_slash', 'blade_storm'],
    description: 'Armored frontal bash (armor during late startup/active). Strong short push; punishable on whiff.',
    relations: ['Armored confirm / peel', 'Cancel → Dash Slash or Rising Slash'],
  }),
  S({
    id: 'blade_storm', cls: 'warrior', slot: 6, name: 'Blade Storm', roles: ['signature', 'extender'], targeting: 'selfAim',
    startup: 280, active: 650, recovery: 330, cooldown: 16000, ground: true, air: true, cover: 'IGNORES_COVER', move: { startup: 0, active: 0.25, recovery: 0 },
    armor: [200, 930],
    hits: [0, 150, 300, 450, 620].map((t, i) => H(t, i === 4 ? 12 : 9, { kind: 'circle', radius: 128, at: 'aimBias', bias: 22 },
      i === 4 ? { stun: 300, launch: 110, juggleCost: 30 } : { stun: 220, pull: 10, float: true, juggleCost: 8 }, { reachUp: 120, heavy: i === 4 })),
    cancelOnHit: ['titans_verdict'], tags: ['signature'], telegraph: 'circle',
    description: 'Armored sword storm: five readable cuts with an inward pull; the final cut relaunches if the juggle budget allows.',
    relations: ['Signature', 'Final cut relaunch', 'Cancel → Titan’s Verdict'],
  }),
  S({
    id: 'titans_verdict', cls: 'warrior', slot: 7, name: "Titan's Verdict", roles: ['ultimate', 'finisher'], targeting: 'mouseCone',
    startup: 520, active: 140, recovery: 500, cooldown: 45000, ground: true, air: false, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 62, { kind: 'sector', range: 158, angle: 70 }, { stun: 400, knockdown: 'heavy', push: 30 }, { reachUp: 110, heavy: true })],
    endsCombo: true, tags: ['ultimate'], telegraph: 'cone',
    description: 'Sword lifted, ground-crack telegraph, overhead impact. Heavy knockdown; ends the combo.',
    relations: ['Ultimate', 'Ends combo'],
  }),
];

// ------------------------------------------------------------------ BOOK MAGE
const mage: FinalSkill[] = [
  S({
    id: 'arcane_bolt', cls: 'book_mage', slot: 0, name: 'Arcane Bolt', roles: ['basic', 'projectile'], targeting: 'mouseProjectile',
    startup: 90, active: 0, recovery: 130, cooldown: 450, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: { startup: 0.8, active: 0.8, recovery: 0.8 },
    hits: [H(0, 11, { kind: 'projectile', speed: 720, range: 480, radius: 10 }, { stun: 140, push: 4 })],
    cancelOnHit: ['arcane_wave', 'binding_rune', 'astral_burst', 'frost_nova', 'lightning_chain'],
    description: 'Mobile arcane projectile fired toward the cursor (you can keep moving at 80%).',
    relations: ['Poke', 'Confirm → Arcane Wave'],
  }),
  S({
    id: 'arcane_wave', cls: 'book_mage', slot: 1, name: 'Arcane Wave', roles: ['confirm', 'peel'], targeting: 'mouseLine',
    startup: 150, active: 180, recovery: 180, cooldown: 3500, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    hits: [H(0, 24, { kind: 'line', length: 230, width: 74 }, { stun: 240, push: 30, float: true, juggleCost: 15 })],
    cancelOnHit: ['astral_burst', 'storm_field', 'lightning_chain', 'binding_rune', 'time_collapse'], telegraph: 'line',
    description: 'Wide short wave toward the cursor. Pushes grounded targets, stabilises airborne ones for a follow-up.',
    relations: ['Confirm', 'Air stabiliser'],
  }),
  S({
    id: 'binding_rune', cls: 'book_mage', slot: 2, name: 'Binding Rune', roles: ['setup', 'hardCC'], targeting: 'mouseGround',
    startup: 240, active: 120, recovery: 210, cooldown: 6500, ground: true, air: false, cover: 'ARCS_OVER_LOW_COVER', move: LOCK,
    placeRange: 280,
    hits: [H(0, 16, { kind: 'placed', radius: 68 }, { hardCC: { kind: 'root', ms: 350 }, stun: 120 })],
    cancelOnHit: ['astral_burst', 'lightning_chain', 'arcane_wave', 'frost_nova'], telegraph: 'ground',
    description: 'Rune at the cursor (clear circle telegraph). Roots for 350ms (shared diminishing returns).',
    relations: ['Setup', 'Rune → Astral Lift'],
  }),
  S({
    id: 'astral_burst', cls: 'book_mage', slot: 3, name: 'Astral Lift', roles: ['launcher', 'pull'], targeting: 'selfAim',
    startup: 180, active: 140, recovery: 220, cooldown: 8000, ground: true, air: true, cover: 'IGNORES_COVER', move: LOCK,
    hits: [H(0, 30, { kind: 'circle', radius: 104, at: 'aimBias', bias: 60 }, { stun: 420, pull: 26, launch: 150, juggleCost: 35 }, { reachUp: 120 })],
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
    description: 'Fast bow shot toward the cursor; usable while moving at 85% speed.',
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
    hits: [H(0, 30, { kind: 'projectile', speed: 760, range: 460, radius: 10, explodeRadius: 72 }, { stun: 300, launch: 80, push: 18, juggleCost: 25 })],
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
    description: 'Visible trap at the cursor; persists 4s or until triggered. Roots for 300ms (shared diminishing returns).',
    relations: ['Setup', 'Trap → Multi Shot'],
  }),
  S({
    id: 'rain_of_arrows', cls: 'archer', slot: 5, name: 'Rain of Arrows', roles: ['zone', 'extender'], targeting: 'mouseGround',
    startup: 260, active: 900, recovery: 240, cooldown: 8500, ground: true, air: true, cover: 'ARCS_OVER_LOW_COVER', move: { startup: 0, active: 0.6, recovery: 0 },
    placeRange: 360,
    hits: [0, 380, 760].map((t) => H(t, 12, { kind: 'placed', radius: 112 }, { stun: 110, float: true, juggleCost: 10 }, { reachUp: 160 })),
    zoneMs: 900, cancelOnHit: ['quick_shot', 'skyhunters_step'], telegraph: 'ground',
    description: 'Three waves of arrows on the cursor area. Low hit-stun: keeps pressure without locking forever.',
    relations: ['Area control', 'Keeps juggles alive'],
  }),
  S({
    id: 'skyhunters_step', cls: 'archer', slot: 6, name: "Skyhunter's Step", roles: ['signature', 'mobility', 'chase'], targeting: 'mouseDir',
    startup: 200, active: 720, recovery: 280, cooldown: 16000, ground: true, air: true, cover: 'BLOCKED_BY_COVER', move: LOCK,
    dash: { distance: 220, lift: 46 },
    hits: [80, 230, 380, 530, 680].map((t, i) => H(t, [8, 8, 9, 9, 10][i], { kind: 'projectile', speed: 980, range: 420, radius: 9 }, { stun: 200, float: true, juggleCost: 12 })),
    cancelOnHit: ['verdant_judgment'], tags: ['signature'], telegraph: 'trajectory',
    description: 'Acrobatic leap toward the cursor while firing five aimed shots. Collision and cover still apply; no invulnerability.',
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
    description: 'Fast step through the cursor direction (no invulnerability). A confirmed hit cancels into Spin Cut or Iai Strike.',
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
    description: 'Fast crescent projectile toward the cursor; hard cover blocks it.',
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
