// God of Legacy Studio — Movement Editor's character: the game's own kinematics (src/combat/Combat.ts — steering, the
// jump, gravity, collisions with the floor's edges and every prop, landing on tops, ramps) driven by the game's own
// keys (CombatInput: the arrows / WASD, double-tap to run, the jump key), tuned by the Movement settings. Side view
// only: the character faces right or left, up / down slide him in depth with his facing kept.
import { Kin, PHYS, jump, newKin, settleOnBlocks, steer, stepKin } from '../../combat/Combat';
import { footAllowed, supportAt } from '../../world/WorldGeometry';
import type { CombatInput } from '../../game/CombatInput';
import type { Dir } from '../../world/collision';
import type { FinalSkill } from '../../skills/SkillTypes';
import type { MovementSettings } from '../model/profile';

export type MoveMode = 'idle' | 'walk' | 'run' | 'takeoff' | 'air' | 'land' | 'runstop' | 'skill';
export interface Cast { skill: FinalSkill; stage: number; elapsed: number; startup: number; active: number; recovery: number; seed: number }

/** The game's movement numbers taken from the Movement settings (the game's own object: steering, the jump, gravity and
 *  collisions read it). Only in the Studio's page: the game itself never runs here. */
export function applyMovement(m: MovementSettings): void {
  Object.assign(PHYS, {
    stroll: m.walk, run: m.run, walk: (m.walk + m.run) / 2, accel: m.accel, decel: m.decel, turnMult: m.turn, airAccel: m.air,
    takeoffKeep: m.keep, jumpVz: m.jumpVz, gravity: m.gravity, landMs: m.landMs, footR: m.footR, mantle: m.mantle,
  });
}

export class Mover {
  k: Kin;
  mode: MoveMode = 'idle';
  modeT = 0;
  loopT = 0;
  dir: Dir = 'right';
  cast: Cast | null = null;
  private airUsed = 0;
  private chain = { stage: -1, endAt: -Infinity };
  private now = 0;

  constructor(x: number, y: number, facing: 'right' | 'left') { this.k = newKin(x, y); this.dir = facing; this.settle(); }

  /** Back to a point (the start mark), standing on whatever is highest there. */
  place(x: number, y: number, facing?: 'right' | 'left'): void {
    this.k = newKin(x, y); if (facing) this.dir = facing;
    this.settle(); this.cast = null; this.setMode('idle');
  }
  private settle(): void {
    const s = supportAt(this.k.x, this.k.y, 1e6);
    this.k.z = s.z; this.k.supportZ = s.z; this.k.supportId = s.id; this.k.grounded = true;
  }
  /** After the map changed: still somewhere he can be? Else back to the start mark. */
  check(spawn: { x: number; y: number }): void {
    const k = this.k;
    if (!footAllowed(k.x, k.y, k.z + 0.5, PHYS.footR * 0.5)) this.place(spawn.x, spawn.y);
  }
  private setMode(m: MoveMode): void { if (m !== this.mode) { this.mode = m; this.modeT = 0; } }

  /** A body move played once (the attack key: the chain's next step; a skill key: that skill's moves). */
  startCast(skill: FinalSkill, stage = 0): void {
    const t = skill.chain?.timings?.[stage] ?? { startup: skill.startup, active: skill.active, recovery: skill.recovery };
    this.cast = { skill, stage, elapsed: 0, ...t, seed: Math.floor(Math.random() * 1e9) };
    this.setMode('skill');
  }
  /** The attack key: the basic chain's next step if pressed soon enough after the last, else its first. */
  attack(basic: FinalSkill | undefined): void {
    if (!basic || this.cast) return;
    const n = basic.chain?.stages.length ?? 1;
    const stage = this.now - this.chain.endAt < (basic.chain?.resetMs ?? 600) ? (this.chain.stage + 1) % n : 0;
    this.chain.stage = stage;
    this.startCast(basic, stage);
  }

  /** One frame. `inp`: the keys (null while editing: he stands where he is). */
  step(ms: number, inp: CombatInput | null, m: MovementSettings): void {
    const k = this.k;
    this.now += ms; this.modeT += ms; this.loopT += ms;
    if (this.cast) {
      this.cast.elapsed += ms;
      if (this.cast.elapsed >= this.cast.startup + this.cast.active + this.cast.recovery) { this.cast = null; this.chain.endAt = this.now; this.setMode(k.grounded ? 'idle' : 'air'); }
    }
    let mx = 0, my = 0, running = false, jumped = false;
    if (inp) {
      inp.update(this.now);
      mx = inp.moveX; my = m.allowDepth ? inp.moveY : 0; running = inp.running;
      jumped = inp.takeJump();
    }
    if (mx !== 0 && !this.cast) this.dir = mx > 0 ? 'right' : 'left';   // side view only: up / down keep the facing
    const slow = this.cast ? 0.15 : 1, speed = (running ? m.run : m.walk) * slow;
    steer(k, mx * speed, my * speed * m.depth, ms);
    if (jumped && !this.cast) {
      if (k.grounded) { jump(k, m.jumpVz); this.airUsed = 0; this.setMode('takeoff'); }
      else if (this.airUsed < m.airJumps) { this.airUsed++; k.vz = m.airJumpVz; k.vx *= 0.9; this.mode = 'takeoff'; this.modeT = 0; }
    }
    const r = stepKin(k, ms, 1, undefined, !this.cast);
    settleOnBlocks(k, ms, my, true);
    if (r.landed) { this.airUsed = 0; if (!this.cast) this.setMode('land'); }
    if (this.cast) { this.setMode('skill'); return; }
    if (!k.grounded) { if (this.mode !== 'takeoff' || this.modeT > PHYS.takeoffMs) this.setMode('air'); return; }
    if (this.mode === 'land' && this.modeT < m.landMs && !mx && !my) return;
    const sp = Math.hypot(k.vx, k.vy);
    if (sp > 12) {
      const want: MoveMode = running && sp > PHYS.walk + 20 ? 'run' : 'walk';
      if (want !== this.mode) { if (this.mode !== 'walk' && this.mode !== 'run') this.loopT = 0; this.setMode(want); }
    } else if (this.mode === 'run') this.setMode('runstop');
    else if (this.mode === 'runstop' && this.modeT < 120) return;
    else this.setMode('idle');
  }
}
