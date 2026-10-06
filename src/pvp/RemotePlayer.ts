// A remote PvP player: the same ActorView/body art as the local player, driven by network snapshots (interpolated
// ground x/y and height z, support height, aim, animation mode, cosmetics) plus locally-timed skill poses started by
// the caster's cast intent. Name + small HP bar above.
import Phaser from 'phaser';
import { FONT_FAMILY, PVP } from '../config/layout';
import { Dir } from '../world/collision';
import { PeerMeta, NetMsg } from './Transport';
import { DeathFx } from '../game/DeathFx';
import { ActorView, CosSlot, Equipped } from '../game/ActorView';
import { ClassKey, resolvePose } from '../game/Body';
import { AnimSnap, Mode, poseQuery } from '../game/PoseState';
import { finalSkill } from '../skills/FinalKit';

const asDir = (d: string): Dir => (d === 'left' ? 'left' : 'right'); // side view only
interface Snap { t: number; x: number; y: number; z: number }

export class RemotePlayer {
  readonly view: ActorView;
  private label: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Graphics;
  private snaps: Snap[] = [];
  dir: Dir = 'right';
  mode: Mode = 'idle';
  private modeT = 0;
  private speed = 0;
  private vz = 0;
  sz = 0;
  aim = { x: 0, y: 1 };
  private skill: { id: string; stage: number; elapsed: number; startup: number; active: number; recovery: number } | null = null;
  private flashMs = -1;
  private deadMs = -1;
  private deathFx: DeathFx;
  private cosKey = '';
  hp: number = PVP.maxHp;
  alive = true;
  lastSeen = performance.now();
  /** How far in the past the body is shown (network jitter buffer); 0 = latest snapshot (locally simulated NPC). */
  interpDelay: number = PVP.interpDelayMs;
  x: number; y: number; z = 0;

  constructor(private scene: Phaser.Scene, readonly meta: PeerMeta, x: number, y: number) {
    const L = PVP.remoteLabel;
    this.x = x; this.y = y;
    this.view = new ActorView(scene, meta.classId as ClassKey, x, y);
    this.deathFx = new DeathFx(scene);
    this.label = scene.add.text(x, y, meta.name, {
      fontFamily: FONT_FAMILY, fontSize: `${L.size}px`, fontStyle: 'bold', color: L.color, stroke: '#000000', strokeThickness: 3, resolution: 2,
    }).setOrigin(0.5, 1).setDepth(PVP.labelDepth);
    this.bar = scene.add.graphics().setDepth(PVP.labelDepth);
    this.snaps = [{ t: performance.now(), x, y, z: 0 }];
    this.drawBar();
  }

  get sprite(): Phaser.GameObjects.Sprite { return this.view.sprite; }

  applyState(m: Extract<NetMsg, { t: 'state' }>): void {
    this.lastSeen = performance.now();
    this.snaps.push({ t: this.lastSeen, x: m.x, y: m.y, z: m.z ?? 0 });
    if (this.snaps.length > 30) this.snaps.shift();
    this.dir = asDir(m.dir);
    this.sz = m.sz ?? 0; this.speed = m.sp ?? 0; this.vz = m.vz ?? 0;
    this.aim = { x: (m.ax ?? 0) / 100, y: (m.ay ?? 100) / 100 };
    const mode = (m.mode ?? m.anim) as Mode;
    if (mode !== this.mode && !(this.skill && mode === 'skill')) { this.mode = mode; this.modeT = 0; }
    if (m.hp !== this.hp) { this.hp = m.hp; this.drawBar(); }
    if (m.cos !== undefined && m.cos !== this.cosKey) {
      this.cosKey = m.cos;
      const e: Equipped = {};
      for (const part of m.cos.split(',').filter(Boolean)) { const [s, id] = part.split(':'); e[s as CosSlot] = id; }
      this.view.setEquipped(e);
    }
    if (m.alive && !this.alive) this.revive(m.x, m.y, m.hp);
    else if (!m.alive && this.alive) this.die();
  }

  /** Cast intent from this player: show the same body animation locally (timing from the cast moment). */
  startSkill(id: string, stage: number, dir: Dir, aim: { x: number; y: number }): void {
    const s = finalSkill(id);
    if (!s || !this.alive) return;
    const t = s.chain?.timings?.[stage] ?? s;
    this.skill = { id: s.id, stage, elapsed: 0, startup: t.startup, active: t.active, recovery: t.recovery };
    this.dir = dir; this.aim = aim; this.mode = 'skill'; this.modeT = 0;
  }

  /** A held skill's startup became known (Judgment Blade: the blade left the hand): the body throws then. */
  setSkillStartup(id: string, startup: number): void { if (this.skill && this.skill.id === id) this.skill.startup = Math.max(this.skill.elapsed, startup); }

  setHp(hp: number, m?: Extract<NetMsg, { t: 'hp' }>): void {
    const hit = hp < this.hp;
    this.hp = hp;
    this.drawBar();
    if (hit && this.alive) { this.flashMs = 0; if (m?.rx && m.rx !== 'armor') this.skill = null; }
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false; this.hp = 0; this.skill = null; this.deadMs = 0; this.mode = 'dead'; this.modeT = 0;
    this.deathFx.start(this.x, this.y, this.z - this.sz, this.dir === 'left');
    this.drawBar();
  }

  revive(x: number, y: number, hp: number = PVP.maxHp): void {
    this.alive = true; this.hp = hp; this.deadMs = -1; this.flashMs = -1; this.mode = 'idle'; this.modeT = 0; this.skill = null; this.deathFx.stop();
    this.snaps = [{ t: performance.now(), x, y, z: 0 }];
    this.x = x; this.y = y; this.z = 0;
    this.drawBar();
  }

  update(ms: number): void {
    const rt = performance.now() - this.interpDelay, s = this.snaps;
    let x = s[s.length - 1].x, y = s[s.length - 1].y, z = s[s.length - 1].z;
    if (this.interpDelay <= 0) s.splice(0, s.length - 1);
    else for (let i = s.length - 1; i > 0; i--) {
      if (s[i - 1].t <= rt) {
        const a = s[i - 1], b = s[i], k = Phaser.Math.Clamp((rt - a.t) / Math.max(1, b.t - a.t), 0, 1);
        x = a.x + (b.x - a.x) * k; y = a.y + (b.y - a.y) * k; z = a.z + (b.z - a.z) * k;
        break;
      }
      if (i === 1) { x = s[0].x; y = s[0].y; z = s[0].z; }
    }
    while (s.length > 2 && s[1].t <= rt) s.shift();
    this.x = x; this.y = y; this.z = z;
    this.modeT += ms;
    if (this.skill) {
      this.skill.elapsed += ms;
      if (this.skill.elapsed >= this.skill.startup + this.skill.active + this.skill.recovery || !this.alive) { this.skill = null; if (this.mode === 'skill') { this.mode = 'recover'; this.modeT = 0; } }
    }
    let tint: number | null = null, fill = false, alpha = 1;
    if (this.flashMs >= 0) { this.flashMs += ms; if (this.flashMs < 60) { tint = 0xffffff; fill = true; } else if (this.flashMs < 140) tint = 0xff6a6a; else this.flashMs = -1; }
    if (this.deadMs >= 0) { this.deadMs += ms; alpha = 1 - Math.min(1, this.deadMs / 450); this.deathFx.update(ms); }
    const snap: AnimSnap = { mode: this.skill ? 'skill' : this.mode, t: this.modeT, speed: this.speed, vz: this.vz, skill: this.skill ?? undefined, stunMs: 200 };
    const pose = resolvePose(this.meta.classId as ClassKey, this.dir, poseQuery(snap), this.view.wantsBase);
    this.view.render(ms, pose, x, y, z, this.sz, this.dir, alpha, tint, fill);
    const top = y - z - 116 - PVP.remoteLabel.gap;
    this.label.setPosition(Math.round(x), Math.round(top - PVP.hpBar.h - 3));
    this.bar.setPosition(Math.round(x), Math.round(top));
  }

  private drawBar(): void {
    const g = this.bar, H = PVP.hpBar;
    g.clear();
    if (!this.alive) return;
    const col = (s: string) => Phaser.Display.Color.HexStringToColor(s).color;
    g.fillStyle(col(H.background), 1).fillRect(-H.w / 2, 0, H.w, H.h);
    g.fillStyle(col(H.fill), 1).fillRect(-H.w / 2, 0, (H.w * Math.max(0, this.hp)) / PVP.maxHp, H.h);
    g.lineStyle(1, col(H.border), 1).strokeRect(-H.w / 2, 0, H.w, H.h);
  }

  destroy(): void { this.view.destroy(); this.label.destroy(); this.bar.destroy(); this.deathFx.destroy(); }
}
