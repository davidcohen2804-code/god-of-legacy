// Final skill model (PvP V1 roster, 03_FINAL_CLASS_SKILL_ROSTER.md). Gameplay data only — art never drives damage.

export type ClassId = 'warrior' | 'book_mage' | 'archer' | 'samurai';
export type Targeting =
  | 'aimAssist' // basic: facing snapped toward the mouse when it is near
  | 'mouseDir' // dash / directional action toward the mouse
  | 'mouseProjectile'
  | 'mouseLine'
  | 'mouseCone'
  | 'mouseGround'
  | 'mouseTarget' // first legal target in an aim corridor
  | 'self'
  | 'selfAim'; // self-centred, biased toward the aim
export type Role =
  | 'basic' | 'opener' | 'gapClose' | 'launcher' | 'extender' | 'airExtender' | 'knockdown' | 'antiAir' | 'confirm' | 'peel'
  | 'setup' | 'hardCC' | 'zone' | 'pull' | 'projectile' | 'precision' | 'trap' | 'mobility' | 'chase' | 'counter' | 'escape'
  | 'finisher' | 'signature' | 'ultimate';
export type CoverMode = 'BLOCKED_BY_COVER' | 'EXPLODES_ON_COVER' | 'PIERCES_ACTORS' | 'ARCS_OVER_LOW_COVER' | 'IGNORES_COVER';

/** Shape of one hit, evaluated relative to the cast origin/aim (or a placed point). World units = map px. */
export type HitShape =
  | { kind: 'sector'; range: number; angle: number; offset?: number }
  | { kind: 'circle'; radius: number; at?: 'self' | 'place' | 'aimBias'; bias?: number; /** strikes the floor below an airborne caster */ floor?: boolean }
  | { kind: 'line'; length: number; width: number }
  | { kind: 'capsule'; radius: number } // swept along the caster's dash path
  | { kind: 'projectile'; speed: number; range: number; radius: number; count?: number; spread?: number; /** parallel rows across the floor's depth */ rows?: number; rowGap?: number; pierce?: boolean; explodeRadius?: number; arc?: number }
  | { kind: 'chain'; corridor: number; width: number; jump: number }
  | { kind: 'placed'; radius: number }; // ground point (rune / trap / zone)

export interface Reaction {
  /** Ordinary combo hit-stun (soft, repeatable, scaled by combo index). */
  stun?: number;
  /** Knockback distance (world px, away from the hit origin). */
  push?: number;
  /** Pull toward the hit centre (px). */
  pull?: number;
  /** Launch apex above the victim's current height (px). */
  launch?: number;
  /** Airborne victim: slam down (ground breaker) / stabilise for follow-ups. */
  slam?: boolean;
  float?: boolean;
  knockdown?: 'light' | 'heavy';
  /** Hard crowd control (shared DR policy). */
  hardCC?: { kind: 'root' | 'freeze' | 'stun'; ms: number };
  slow?: { pct: number; ms: number };
  juggleCost?: number;
  /** Pin the victim in place (no gravity, no drift) for this long (ms). */
  pin?: number;
  /** Grab: ignores the combo-protection gauges. */
  grab?: boolean;
}

export interface HitEvent {
  /** ms after the active start. */
  at: number;
  damage: number;
  shape: HitShape;
  reaction: Reaction;
  /** Vertical reach above the attacker's feet (melee), px. */
  reachUp?: number;
  heavy?: boolean;
}

export interface FinalSkill {
  id: string;
  cls: ClassId;
  slot: number; // 0 = Space
  name: string;
  roles: Role[];
  targeting: Targeting;
  startup: number;
  active: number;
  recovery: number;
  cooldown: number;
  ground: boolean;
  air: boolean;
  hits: HitEvent[];
  /** Basic chains: stage list (Space repeats cycle stages; reset after `chainResetMs`). */
  chain?: { stages: HitEvent[][]; resetMs: number; timings?: { startup: number; active: number; recovery: number }[] };
  cover: CoverMode;
  /** Locomotion scalar while the action runs (0 = locked). */
  move: { startup: number; active: number; recovery: number };
  /** Dash / leap of the caster during active (px, toward aim). */
  dash?: { distance: number; lift?: number; /** rise fast, hold at the top, drop at the end (shots from the apex) */ hang?: boolean; stopOnHit?: boolean; /** arc back down to the ground by the end of active (leap attacks) */ crash?: boolean };
  /** Ranged placement limit for ground target skills. */
  placeRange?: number;
  /** Persistent zone / trap lifetime after active (ms). */
  zoneMs?: number;
  /** Detached lingering hits (cracks / summons): keep striking after the caster moves on or cancels. */
  linger?: { at: 'origin' | 'aim' | 'caster'; offset?: number; startMs: number; everyMs: number; count: number; radius: number; maxZ: number; hit: HitEvent };
  /** Dash passes through bodies and turns to face the target behind. */
  through?: boolean;
  /** Uses in a row before the full cooldown. */
  charges?: number;
  /** Minimum gap between two charges (ms, from cast to cast); default 350. */
  chargeGap?: number;
  /** Hold-to-charge: the key held keeps the startup going (up to `startup`, at least minMs); at the release the level whose
   *  `at` the startup reached picks the hits (both sides pick it from the startup: the release is sent to the others). */
  charge?: { minMs: number; levels: { at: number; hits: HitEvent[] }[] };
  /** Dash carries the first confirmed target along on the blade. */
  carry?: boolean;
  /** fuseMs: stepping on it arms it (hits[0] at once), then it explodes after fuseMs (hits[1] on everyone in it). */
  trap?: { radius: number; lifeMs: number; fuseMs?: number };
  armor?: [number, number]; // elapsed window (ms from cast) with armor
  /** Counter stance: its window (ms); where he reappears: `behind` px past the attacker (falls back to a `sidestep`). */
  counter?: { window: number; sidestep: number; behind?: number };
  /** Tags of skills this one may cancel into on a confirmed hit. */
  cancelOnHit: string[];
  tags: string[];
  endsCombo?: boolean;
  /** Visual: telegraph shown to everyone during startup. */
  telegraph?: 'circle' | 'cone' | 'line' | 'trajectory' | 'ground';
  pvpMultiplier: number;
  pveMultiplier: number;
  description: string;
  unlockLevel: number;
  relations: string[];
  /** A template only (not built yet): listed in the skill book and on the skill bar as "coming soon", cannot be used. */
  wip?: boolean;
}

export const PVP_MULT = 0.7;
