// The Warrior's rock spikes — continuity (David 14:35: what the fight leaves behind becomes the power of a later skill;
// DFO's idea, 17 Oct). Earthsplitter's fissure leaves rock spikes standing along it for a while; a foe thrown into one
// bounces off it like a wall; Leap Crash landing onto them bursts them all into a rain of stone that throws the foe up
// again. Every spike comes from the cast (origin, aim, the hold's level), so both screens raise the same ones.
// This file: the spikes (where, whose, until when), their look (painted in the arena and the world, DFO's real 3D rock
// spikes in PVP 3D) and the burst's look. The bounce and the burst's throw are the runtime's (DFO's numbers and hook):
// `near()` answers which spike a flying foe meets, `burst()` how many Leap Crash broke.
import Phaser from 'phaser';
import type { CastRun } from './SkillRuntime';
import type { V3 } from './HitGeometry';
import type { Fx3D } from '../arena3d/Fx3D';
import { ARENA3D } from '../arena3d/flag';

/** DFO's numbers (BALANCE_LOG 17 Oct): a spike stands 3 s; as a wall it is 40 px round; a foe thrown into a spike not his
 *  own (knocked back faster than `thrown` px/ms, or flying, under `top` px) bounces back off it at half his speed, takes
 *  `wallDmg` and a `wallStun` ms stun, and the spike breaks; Leap Crash landing within 170 px of his spikes bursts them all:
 *  once, `burstDmg` + `burstPer` a spike, thrown up (`burstLaunch`, stun, juggle cost), reaching `burstReach` px up. */
export const SPIKES = { lifeMs: 5000, r: 40, burstR: 170, top: 100, thrown: 0.35, bounce: 0.5, wallDmg: 8, wallStun: 300, burstDmg: 6, burstPer: 4, burstLaunch: 90, burstStun: 380, burstJuggle: 12, burstReach: 200 } as const;

export interface Spike { key: string; owner: string; x: number; y: number; until: number; img?: Phaser.GameObjects.Image }

export interface SpikeHost {
  now(): number;
  scene(): Phaser.Scene;
  vfxKey(id: string): string;
  fx3d(): Fx3D | undefined;
}

export class WarriorSpikes {
  private spikes: Spike[] = [];
  constructor(private h: SpikeHost) {}

  /** Earthsplitter released (its active phase): spikes stand along the fissure — more and farther the longer the hold. */
  raise(r: CastRun): void {
    if (r.skill.id !== 'earthsplitter') return;
    const lv = Math.max(0, Math.min(2, r.chargeLevel ?? 0)), range = [200, 280, 360][lv], n = [3, 4, 5][lv], a = r.aim, now = this.h.now();
    for (let i = 1; i <= n; i++) {
      const d = range * (0.2 + 0.85 * (i / n)), x = r.origin.x + a.x * d, y = r.origin.y + a.y * d * 0.6, delay = i * 55;
      const s: Spike = { key: `${r.castId}:s${i}`, owner: r.attackerId, x, y, until: now + delay + SPIKES.lifeMs };
      this.spikes.push(s);
      this.h.scene().time.delayedCall(delay, () => { if (this.spikes.includes(s)) this.draw(s); });
    }
  }

  /** The spike a fighter at (x, y) meets, if any (the runtime's wall test: DFO's bounce). */
  near(x: number, y: number, r: number = SPIKES.r): Spike | null {
    for (const s of this.spikes) if (Math.hypot(x - s.x, (y - s.y) * 1.6) < r) return s;
    return null;
  }

  /** Leap Crash landed at `at`: the caster's spikes within reach burst into a rain of stone. Returns how many burst. */
  burst(r: CastRun, at: V3): number {
    if (r.skill.id !== 'leap_crash') return 0;
    const hit = this.spikes.filter((s) => s.owner === r.attackerId && Math.hypot(at.x - s.x, (at.y - s.y) * 1.6) < SPIKES.burstR);
    if (!hit.length) return 0;
    const f3 = this.h.fx3d(), sc = this.h.scene();
    for (const s of hit) {
      this.remove(s, true);
      if (f3) { f3.debris(s.x, s.y, 14, { up: 2.6, speed: 0.9, size: 1.6 }); f3.later(220, () => f3.debris(s.x, s.y, 8, { up: 0.4, speed: 0.4 })); } // thrown up, then raining back down
      else { // the painted arena: chunks thrown up and falling back
        for (let k = 0; k < 6; k++) {
          const im = sc.add.image(s.x, s.y - 20, this.h.vfxKey('earthsplitter'), 5).setDisplaySize(26, 26).setDepth(s.y + 2);
          const dx = (Math.random() - 0.5) * 120, up = 90 + Math.random() * 80;
          sc.tweens.add({ targets: im, x: s.x + dx, duration: 520, ease: 'Linear' });
          sc.tweens.add({ targets: im, y: s.y - up, duration: 240, ease: 'Quad.easeOut', yoyo: true, onComplete: () => im.destroy() });
        }
      }
    }
    return hit.length;
  }

  /** A thrown foe broke this spike (DFO's wall): it bursts at once. */
  shatter(s: Spike): void {
    if (!this.spikes.includes(s)) return;
    this.remove(s, true);
    this.h.fx3d()?.debris(s.x, s.y, 8, { up: 1.6, speed: 0.8, size: 1.3 });
  }

  step(): void {
    const now = this.h.now();
    for (const s of [...this.spikes]) if (now >= s.until) this.remove(s, false);
  }

  clear(): void { for (const s of [...this.spikes]) this.remove(s, false); }

  private draw(s: Spike): void {
    const left = s.until - this.h.now();
    const f3 = this.h.fx3d();
    if (f3) {
      f3.crystals(s.x, s.y, { n: 2, r: 18, h: 95, ms: Math.max(300, left), stone: true, key: s.key, color: 0xff6a1a }); // (real rock spikes standing in the planks, an ember glow at their heart; named, to break early)
      // boiling rock (David 01:07: "like lava"): a molten pool cracked open at their foot, heat and sparks rising, magma spitting (no smoke puffs: the room's dust hazed the spikes cream)
      for (const [dx, dy] of [[-34, -8], [30, -10], [-26, 9], [34, 7]]) f3.floorStreak(s.x, s.y, s.x + dx, s.y + dy, 0xff5a12, { w: 15, ms: Math.max(600, left), a: 1 }); // (glowing molten cracks at their foot — floor lines, not crack(): its dust hazed them cream)
      for (let t = 200; t < left - 200; t += 260) f3.later(t, () => { if (!this.spikes.includes(s)) return; f3.host.embers(f3.host.w3(s.x + (Math.random() - 0.5) * 30), 0.15 + Math.random() * 0.5, f3.host.d3(s.y), t % 780 < 260 ? 0xffb040 : 0xff5a1a, 2, 0.9); });
    }
    if (ARENA3D.on) return;
    const sc = this.h.scene(), own = sc.textures.exists('w-spikes'), key = own ? 'w-spikes' : this.h.vfxKey('earthsplitter');
    if (!sc.textures.exists(key)) return;
    const v = [...s.key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 4; // (one of four clusters, the same on every screen)
    s.img = sc.add.image(s.x, s.y + 4, key, own ? v : 4).setOrigin(0.5, own ? 0.97 : 0.95).setDepth(s.y).setDisplaySize(own ? 130 : 120, 10).setAlpha(1); s.img.setData('v', v); // the painted spikes (GPT), thrust up
    sc.tweens.add({ targets: s.img, displayHeight: own ? 130 : 80, duration: 140, ease: 'Back.easeOut' });
  }

  private remove(s: Spike, burst: boolean): void {
    this.spikes = this.spikes.filter((x) => x !== s);
    if (burst) this.h.fx3d()?.crystalsDrop(s.key); // (the 3D rock spikes go with it)
    const im = s.img; if (!im) return;
    s.img = undefined;
    if (im.texture.key === 'w-spikes') im.setFrame(4 + (im.getData('v') ?? 0)); // (its crumbling frame)
    im.scene.tweens.add({ targets: im, alpha: 0, displayHeight: burst ? 20 : im.displayHeight * 0.6, duration: burst ? 120 : 400, onComplete: () => im.destroy() });
  }
}
