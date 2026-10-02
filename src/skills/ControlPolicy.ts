// Minimal hard-control policy (stun + knockback), one state per target shared across ALL attackers.
// PvP: cap 350ms, diminishing returns [1, .5, .25, 0] in a 2000ms window, 450ms post-control immunity,
// no extension while controlled. PvE: cap 600ms, never adds durations, honors control immunity.
import { CONTROL_POLICY, SkillDef } from './SkillRegistry';

export interface ControlResult { durationMs: number; knockbackDistance: number; knockbackMs: number }

const NONE: ControlResult = { durationMs: 0, knockbackDistance: 0, knockbackMs: 0 };

export class ControlState {
  private tier = 0;
  private lastAccepted = -Infinity;
  /** Hard control ends at this authority time. */
  end = -Infinity;
  private immuneUntil = -Infinity;

  /** True while hard-controlled (cannot cast or move intentionally). */
  controlled(now: number): boolean { return now < this.end; }

  /**
   * Requested control from a confirmed, non-lethal hit. Knockback counts as hard control:
   * requested = max(stun, knockback duration) — never summed.
   */
  apply(s: SkillDef, targetKind: 'player' | 'enemy', now: number, controlImmune = false): ControlResult {
    const kbDist = s.knockback.distance > 0 ? s.knockback.distance * (targetKind === 'player' ? s.knockback.pvpMultiplier : 1) : 0;
    const requested = Math.max(s.hitStunMs, kbDist > 0 ? s.knockback.durationMs : 0);
    if (requested <= 0) return NONE;

    if (targetKind === 'enemy') {
      const P = CONTROL_POLICY.pve;
      if (controlImmune && P.respectTargetControlImmunity) return NONE;
      const dur = Math.floor(Math.min(requested, P.maxSingleControlMs) * P.durationMultiplier);
      this.end = Math.max(this.end, now + dur); // simultaneous control never adds durations
      return { durationMs: dur, knockbackDistance: kbDist, knockbackMs: s.knockback.durationMs };
    }

    const P = CONTROL_POLICY.pvp;
    if (now < this.end || now < this.immuneUntil) return NONE; // no extension, no queued control; damage still applies
    if (now - this.lastAccepted > P.diminishingWindowMs) this.tier = 0;
    const mult = P.durationMultipliers[Math.min(this.tier, P.durationMultipliers.length - 1)];
    const dur = Math.floor(Math.min(requested, P.maxSingleControlMs) * mult);
    if (dur <= 0) return NONE; // ignored control does not refresh the DR window
    this.tier++;
    this.lastAccepted = now;
    this.end = now + dur;
    this.immuneUntil = this.end + P.postControlImmunityMs;
    return { durationMs: dur, knockbackDistance: kbDist, knockbackMs: s.knockback.durationMs };
  }

  /** For QA: current DR tier and immunity end. */
  debug(): { tier: number; end: number; immuneUntil: number } { return { tier: this.tier, end: this.end, immuneUntil: this.immuneUntil }; }

  reset(): void { this.tier = 0; this.lastAccepted = -Infinity; this.end = -Infinity; this.immuneUntil = -Infinity; }
}
