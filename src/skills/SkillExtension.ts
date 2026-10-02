// Four-class extension (src/data/skills-extension.json): Warrior/Book Mage slots 4–7 and the full Archer/Samurai kits,
// converted into the existing SkillDef shape so the SAME Skill Engine, resolver, control policy and events handle them.
// Values (damage, range, cooldown, cast/active/recovery, hit-stun, knockback, multipliers) are used exactly as given.
// The extension JSON names a shape but not all of its sub-parameters; the implementation choices below fill those gaps.
import EXT from '../data/skills-extension.json';
import type { SkillDef, SkillGeometry } from './SkillRegistry';

type Raw = (typeof EXT.newOrProvisionalSkills)[number];

/** Implementation choices for shape parameters the extension JSON does not define (visual/geometry details only). */
const SECTOR_ANGLE = 100; // same cone as the V1 sector skill (Rising Slash)
const CONE_ANGLE = 60; // multi-shot spread
const LINE_WIDTH = 40; // Iai Strike line
const DASH_RADIUS = 28; // same capsule radius as V1 Dash Slash
const PROJECTILE_RADIUS = 10; // same as V1 Arcane Bolt
const GROUND_RADIUS: Record<string, number> = { vine_trap: 66, meteor: 90, time_warp: 100, rain_of_arrows: 110 };
const EXPLODE_RADIUS = 70; // Explosive Arrow burst on impact

function geometry(r: Raw): { g: SkillGeometry; detached: boolean } {
  const range = r.range;
  switch (r.geometry) {
    case 'circle':
    case 'area': return { g: { kind: 'circle', maxTargets: null }, detached: false };
    case 'sector': return { g: { kind: 'sector', angleDegrees: SECTOR_ANGLE, maxTargets: null }, detached: false };
    case 'cone': return { g: { kind: 'sector', angleDegrees: CONE_ANGLE, maxTargets: null }, detached: false };
    case 'line': return { g: { kind: 'forwardRectangle', width: LINE_WIDTH, length: range, maxTargets: null }, detached: false };
    case 'dash':
    case 'dashCross': return { g: { kind: 'sweptCapsule', travelDistance: range, radius: DASH_RADIUS, speed: (range * 1000) / r.activeMs, maxTargets: null }, detached: false };
    case 'groundCircle':
    case 'groundArea': return { g: { kind: 'groundCircle', radius: GROUND_RADIUS[r.id] ?? 66, maxTargets: null }, detached: false };
    case 'projectile':
    case 'projectileAoE': {
      // Projectile reaches its max range exactly at the end of its active window (speed = range / activeMs).
      const pierce = r.id === 'piercing_arrow';
      return {
        g: {
          kind: 'projectile', speed: (range * 1000) / r.activeMs, radius: PROJECTILE_RADIUS, maxTargets: pierce ? null : 1,
          maxDistance: range, ttlMs: r.activeMs, pierce, explodeRadius: r.geometry === 'projectileAoE' ? EXPLODE_RADIUS : undefined,
        },
        detached: true,
      };
    }
    default: return { g: { kind: 'circle', maxTargets: null }, detached: false };
  }
}

function toDef(r: Raw): SkillDef {
  const { g, detached } = geometry(r);
  return {
    id: r.id, class: r.class, slot: r.slot, hotkey: r.hotkey,
    damage: r.damage, range: r.range, cooldownMs: r.cooldownMs, castMs: r.castMs, activeMs: r.activeMs, recoveryMs: r.recoveryMs,
    hitStunMs: r.hitStunMs,
    knockback: { distance: r.knockback, durationMs: 100, direction: 'awayFromCastOrigin', pvpMultiplier: 0.5 },
    launch: { heightPx: 0, durationMs: 0, visualOnly: true, pvpHeightMultiplier: 0 },
    maxHits: 1, canHitPlayers: r.canHitPlayers, canHitEnemies: r.canHitEnemies,
    pvpMultiplier: r.pvpMultiplier, pveMultiplier: r.pveMultiplier,
    comboTags: [], canChainInto: [], // combo-ready events only; no runtime chaining
    resourceCost: 0, icon: r.icon, vfx: r.id, geometry: g,
    moveDuringCast: false, moveDuringRecovery: true,
    actionLockMs: detached ? r.castMs + r.recoveryMs : r.castMs + r.activeMs + r.recoveryMs,
    detachedActive: detached || undefined,
  };
}

export const EXTENSION_SKILLS: SkillDef[] = EXT.newOrProvisionalSkills.map(toDef);

/** VFX sheet path per extension skill id (8 frames x 256, one row, 24 FPS). */
export const EXTENSION_VFX: { id: string; path: string; ground: boolean }[] = EXT.newOrProvisionalSkills.map((r) => ({
  id: r.id, path: r.vfx, ground: ['circle', 'area', 'groundCircle', 'groundArea'].includes(r.geometry),
}));
