// Skill System V1 — data registry. Source of truth: src/data/skills.json (+ the existing Warrior basic adapter).
import SKILLS from '../data/skills.json';
import COMBAT from '../data/training-combat.json';
import { EXTENSION_SKILLS } from './SkillExtension';

export type GeometryKind = 'sweptCapsule' | 'sector' | 'circle' | 'projectile' | 'forwardRectangle' | 'groundCircle' | 'basicSector';

export interface SkillGeometry {
  kind: GeometryKind;
  travelDistance?: number; radius?: number; speed?: number; maxTargets?: number | null;
  angleDegrees?: number; center?: string; maxDistance?: number; ttlMs?: number;
  width?: number; length?: number; persistMs?: number; placement?: string; spawn?: string;
  /** Extension: projectile passes through targets (each hit once). */
  pierce?: boolean;
  /** Extension: projectile bursts on termination (circle radius around the impact point). */
  explodeRadius?: number;
}

export interface SkillDef {
  id: string;
  class: string;
  slot: number;
  hotkey: string;
  damage: number;
  range: number;
  cooldownMs: number;
  castMs: number;
  activeMs: number;
  recoveryMs: number;
  hitStunMs: number;
  knockback: { distance: number; durationMs: number; direction: string; pvpMultiplier: number };
  launch: { heightPx: number; durationMs: number; visualOnly: boolean; pvpHeightMultiplier: number };
  maxHits: number;
  canHitPlayers: boolean;
  canHitEnemies: boolean;
  pvpMultiplier: number;
  pveMultiplier: number;
  comboTags: string[];
  canChainInto: string[]; // metadata only in V1 (no cancels / auto-combos)
  resourceCost: number;
  icon: string;
  vfx: string | null;
  geometry: SkillGeometry;
  moveDuringCast: boolean;
  moveDuringRecovery: boolean;
  actionLockMs: number;
  detachedActive?: boolean;
  /** Warrior basic: adapter around the existing Stage 5 attack (handled by the scene's existing code path). */
  adapter?: 'warriorBasic';
}

const A = COMBAT.attack;
const [windup, strike, follow, recovery] = A.phaseDurationMs;

/** Existing Warrior basic wrapped as a skill definition: same damage/geometry/timings/cooldown, no new multipliers. */
const WARRIOR_BASIC: SkillDef = {
  id: SKILLS.existingWarriorBasic.id, class: 'warrior', slot: 0, hotkey: 'Space',
  damage: A.damage, range: A.range, cooldownMs: A.cooldownMs,
  castMs: windup, activeMs: strike + follow, recoveryMs: recovery, hitStunMs: 0,
  knockback: { distance: 0, durationMs: 0, direction: 'awayFromCastOrigin', pvpMultiplier: 1 },
  launch: { heightPx: 0, durationMs: 0, visualOnly: true, pvpHeightMultiplier: 0 },
  maxHits: A.maxHitsPerTargetPerAttack, canHitPlayers: true, canHitEnemies: true,
  pvpMultiplier: 1, pveMultiplier: 1, comboTags: [], canChainInto: [], resourceCost: 0,
  icon: SKILLS.existingWarriorBasic.icon, vfx: null,
  geometry: { kind: 'basicSector', maxTargets: null },
  moveDuringCast: false, moveDuringRecovery: false, actionLockMs: A.totalDurationMs, adapter: 'warriorBasic',
};

const BY_ID = new Map<string, SkillDef>();
for (const s of SKILLS.skills as unknown as SkillDef[]) BY_ID.set(s.id, s);
BY_ID.set(WARRIOR_BASIC.id, WARRIOR_BASIC);
const EXTENSION_IDS = new Set<string>();
for (const s of EXTENSION_SKILLS) if (!BY_ID.has(s.id)) { BY_ID.set(s.id, s); EXTENSION_IDS.add(s.id); } // never overrides V1

export const SLOT_COUNT = 8;
export const DISABLED_SLOTS: readonly number[] = SKILLS.disabledSlots;
export const CONTROL_POLICY = SKILLS.controlPolicy;
export const COMBO_POLICY = SKILLS.comboPolicy;
export const UNASSIGNED_ICON = 'assets/skills/icons/unassigned.png';

export function getSkill(id: string): SkillDef | undefined { return BY_ID.get(id); }

/** Slot index 0..7 -> skill for a class (Space = slot 0). Unassigned / disabled slots are null. */
export function slotsForClass(classId: string): (SkillDef | null)[] {
  const out: (SkillDef | null)[] = Array(SLOT_COUNT).fill(null);
  if (classId === 'warrior') out[0] = WARRIOR_BASIC;
  for (const s of BY_ID.values()) {
    if (s.class !== classId || s.adapter) continue;
    if (EXTENSION_IDS.has(s.id) ? out[s.slot] === null : !DISABLED_SLOTS.includes(s.slot)) out[s.slot] = s; // V1 slots win; extension fills 4–7 / new classes
  }
  return out;
}

/** floor(baseDamage * targetKindMultiplier), minimum 1 for positive base damage. */
export function damageFor(s: SkillDef, targetKind: 'player' | 'enemy'): number {
  if (s.damage <= 0) return 0;
  return Math.max(1, Math.floor(s.damage * (targetKind === 'player' ? s.pvpMultiplier : s.pveMultiplier)));
}
