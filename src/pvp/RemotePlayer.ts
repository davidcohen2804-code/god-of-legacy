// A remote PvP player: the same ActorView/body art as the local player, driven by network snapshots (interpolated
// ground x/y and height z, support height, aim, animation mode, cosmetics) plus locally-timed skill poses started by
// the caster's cast intent. Name + small HP bar above.
import Phaser from 'phaser';
import { FONT_FAMILY, PVP } from '../config/layout';
import { Dir } from '../world/collision';
import { PeerMeta, NetMsg } from './Transport';
import { DeathFx } from '../game/DeathFx';
import { ActorView, CosSlot, Equipped } from '../game/ActorView';
import { TAG_SCALE } from './FighterTag';
import { ClassKey, HERO_LIFT, cleanLook, loadBaseLook, resolvePose } from '../game/Body';
import { DEFAULT_SKIN, SKIN_TONES } from '../characters/Skin';
import { WornLook, parseWornCode } from '../items/Gear';
import { AnimSnap, Mode, poseQuery } from '../game/PoseState';
import { Afterimages, applyMotion, archerMotion, heroMotion } from '../skills/ArcherMotion';
import { SAMURAI_AFTER, samuraiMotion, samuraiSeen } from '../skills/SamuraiMotion';
import { finalSkill } from '../skills/FinalKit';
import { KAGE, KageMode, KageSeen, decodeKage, kageFeintMotion, kageSnap, kageTargets } from '../skills/Kagemusha';
import type { HitTarget, V3 } from '../skills/HitGeometry';
import type { BaseLook } from '../game/Body';

const asDir = (d: string): Dir => (d === 'left' ? 'left' : 'right'); // side view only
interface Snap { t: number; x: number; y: number; z: number }

export class RemotePlayer {
  readonly view: ActorView;
  private label: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Graphics;
  private snaps: Snap[] = [];
  /** when its second jump began (local clock), -1 = none */
  private air2At = -1;
  dir: Dir = 'right';
  mode: Mode = 'idle';
  private modeT = 0;
  private speed = 0;
  private vz = 0;
  sz = 0;
  aim = { x: 0, y: 1 };
  private afterimg?: Afterimages;
  private skill: { id: string; stage: number; elapsed: number; startup: number; active: number; recovery: number; seed?: number } | null = null;
  private jbAir = false;
  private flashMs = -1;
  private deadMs = -1;
  private deathFx: DeathFx;
  private cosKey = '';
  /** Holds a weapon (what it wears; older builds send nothing: armed). */
  armed = true;
  hp: number = PVP.maxHp;
  /** Max HP the owner reports (party buffs can raise it). */
  maxHp: number = PVP.maxHp;
  alive = true;
  lastSeen = performance.now();
  /** Guarded (arena wake-up / BREAK): drawn see-through, blinking — hits do nothing now. */
  ghost = false;
  /** Shaken by a hit you landed (ms left). */
  private shakeMs = 0;
  /** How far in the past the body is shown (network jitter buffer); 0 = latest snapshot (locally simulated NPC). */
  interpDelay: number = PVP.interpDelayMs;
  x: number; y: number; z = 0;
  /** Kagemusha: this samurai's shadow doubles (from his movement state) — his body, his name and his bar — each where it
   *  is (interpolated like him) and doing what it does (running, standing, a feint, or swinging with him). */
  private kage: (KageView | null)[] = [];
  /** Doubles burst on this screen (a blow from here) while his state still lists them. */
  private kageGone = new Set<number>();
  /** He is hidden among them (his state says so; and right after his cast, until that state comes). */
  kageHidden = false;
  private kageHold = 0;
  /** A double comes / goes / feints (the scene draws it: ink, petals, a cut in the air). */
  onKage?: (at: V3, how: 'appear' | 'burst' | 'fade' | 'feint', face?: number, stage?: number) => void;
  private dress: { look: BaseLook | null; worn: WornLook | null; eq: Equipped } = { look: null, worn: null, eq: {} };

  /** Where the name and bar sit: just over the head (a ready hero is drawn taller than the other bodies). */
  private headTop(): number { return this.meta.hero ? 116 + HERO_LIFT : 116; }

  /** Battle: his tag over the head (FighterTag) in place of the name and bar — the battle HUD shows both; his doubles
   *  wear the very same one. null: the name and bar again. */
  private tagKey: string | null = null;
  setTag(key: string | null): void {
    this.tagKey = key;
    this.wearTag(this.view, this.label, this.bar);
    for (const d of this.kage) if (d) this.wearTag(d.view, d.label, d.bar);
  }
  get hasTag(): boolean { return !!this.tagKey; }
  private wearTag(v: ActorView, label: Phaser.GameObjects.Text, bar: Phaser.GameObjects.Graphics): void {
    label.setVisible(!this.tagKey); bar.setVisible(!this.tagKey);
    v.setTag(this.tagKey, this.headTop() + PVP.remoteLabel.gap - PVP.hpBar.h, PVP.labelDepth, TAG_SCALE); // (its tip where the bar's foot was)
  }

  constructor(private scene: Phaser.Scene, readonly meta: PeerMeta, x: number, y: number) {
    const L = PVP.remoteLabel;
    this.x = x; this.y = y;
    this.view = new ActorView(scene, meta.classId as ClassKey, x, y);
    const g = meta.gender === 'female' ? 'female' : 'male';
    const look = cleanLook(g, meta.look ?? (typeof meta.hair === 'number' ? { hair: meta.hair } : null), DEFAULT_SKIN, SKIN_TONES.length); // (older builds sent the hairstyle only)
    loadBaseLook(scene, g, look, true); // bald until its layers arrive
    this.view.setBaseLook(look, g);
    this.dress.look = look;
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
    if (m.mhp) this.maxHp = m.mhp;
    this.ghost = !!m.iv;
    this.lastSeen = performance.now();
    this.snaps.push({ t: this.lastSeen, x: m.x, y: m.y, z: m.z ?? 0 });
    if (this.snaps.length > 30) this.snaps.shift();
    this.dir = asDir(m.dir);
    this.sz = m.sz ?? 0; this.speed = m.sp ?? 0; this.vz = m.vz ?? 0;
    this.air2At = m.a2 !== undefined ? this.lastSeen - m.a2 : -1;
    this.aim = { x: (m.ax ?? 0) / 100, y: (m.ay ?? 100) / 100 };
    const mode = (m.mode ?? m.anim) as Mode;
    if (mode !== this.mode && !(this.skill && mode === 'skill')) { this.mode = mode; this.modeT = 0; }
    if (m.hp !== this.hp) { this.hp = m.hp; this.drawBar(); }
    if (m.cos !== undefined && m.cos !== this.cosKey) {
      this.cosKey = m.cos;
      const e: Equipped = {};
      let worn: WornLook | null = null;
      for (const part of m.cos.split(',').filter(Boolean)) { const [s, id] = part.split(':'); if (s === 'gear') worn = parseWornCode(id); else e[s as CosSlot] = id; }
      this.view.setEquipped(e);
      this.view.setGear(worn, this.meta.gender === 'female' ? 'female' : 'male'); // what this player wears
      this.armed = worn ? worn.weapon : true;
      this.dress.worn = worn; this.dress.eq = e;
    }
    this.setKage(decodeKage(m.kg));
    if (m.alive && !this.alive) this.revive(m.x, m.y, m.hp);
    else if (!m.alive && this.alive) this.die();
  }

  /** Cast intent from this player: show the same body animation locally (timing from the cast moment). */
  startSkill(id: string, stage: number, dir: Dir, aim: { x: number; y: number }, seed = 0): void {
    const s = finalSkill(id);
    if (!s || !this.alive) return;
    const t = s.chain?.timings?.[stage] ?? s;
    this.skill = { id: s.id, stage, elapsed: 0, startup: t.startup, active: t.active, recovery: t.recovery, seed };
    this.dir = dir; this.aim = aim; this.mode = 'skill'; this.modeT = 0;
    if (s.id === 'kagemusha') this.kageHold = performance.now() + t.startup + t.active + t.recovery + 700; // gone until his state says where the doubles are
  }

  /** Where its owner said it is in the latest snapshot (the drawn body runs a little behind, interpolated). */
  get latest(): { x: number; y: number } { const s = this.snaps[this.snaps.length - 1]; return { x: s.x, y: s.y }; }

  /** A hit you landed on it: it shudders for the hit-stop (fighting-game feel; its owner's client moves the body). */
  shake(ms: number): void { this.shakeMs = Math.max(this.shakeMs, ms); }
  /** Paper Curse: hidden for `ms` (the crane is drawn in its place). */
  private paperUntil = 0;
  paper(ms: number): void { this.paperUntil = Math.max(this.paperUntil, performance.now() + ms); }

  /** Where its speech bubble sits above the feet (world px): over its name and bar, which sit over its head. */
  get headHeight(): number { return Math.max(this.view.headHeight || 100, this.headTop() + PVP.remoteLabel.gap + PVP.hpBar.h + 3 + PVP.remoteLabel.size + 6); }

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
    this.kage.forEach((d, k) => { if (d) this.dropDouble(k, 'fade'); }); this.kageHidden = false; this.kageHold = 0;
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
    if (this.flashMs >= 0) { this.flashMs += ms; if (this.flashMs < 140) tint = 0xff9a9a; else this.flashMs = -1; } // struck: a soft tint (no white flash)
    if (this.deadMs >= 0) { this.deadMs += ms; alpha = 1 - Math.min(1, this.deadMs / 450); this.deathFx.update(ms); }
    else if (this.ghost) alpha = Math.floor(performance.now() / 70) % 2 ? 0.4 : 0.75; // guarded: blinking see-through
    if (performance.now() < this.paperUntil) alpha = 0; // a book mage's Paper Curse: folded into a crane (the effect draws it)
    let jx = 0, jz = 0;
    if (this.shakeMs > 0) { this.shakeMs -= ms; const f = Math.min(1, this.shakeMs / 60); jx = (Math.random() - 0.5) * 7 * f; jz = Math.random() * 2.5 * f; }
    const hid = this.alive && (this.kageHidden || (!this.skill && performance.now() < this.kageHold)); // Kagemusha: hidden among his doubles
    const seen = hid ? 0 : this.meta.classId === 'samurai' && this.skill && this.alive ? samuraiSeen(this.skill.id, this.skill.elapsed, this.skill) : 1; // he vanishes (Shadow Step, Kagemusha, Dragon Eclipse)
    alpha *= seen;
    const snap: AnimSnap = { mode: this.skill ? 'skill' : this.mode, t: this.modeT, speed: this.speed, vz: this.vz, skill: this.skill ?? undefined, stunMs: 200, air2: this.air2At >= 0 ? performance.now() - this.air2At : undefined };
    const pose = resolvePose(this.meta.classId as ClassKey, this.dir, poseQuery(snap), this.view.wantsBase, this.meta.gender === 'female' ? 'female' : 'male', !!this.meta.hero);
    this.jbAir = this.skill?.id === 'judgment_blade' || (this.jbAir && this.alive && z - this.sz > 2); // Judgment Blade: no sword until the landing
    this.view.swordOff = this.jbAir;
    this.view.tagAlpha = this.deadMs >= 0 ? alpha : seen; // (as his name: it stays while he blinks or is a crane)
    this.view.render(ms, pose, x + jx, y, z + jz, this.sz, this.dir, alpha, tint, fill);
    if (this.meta.classId === 'archer') { // the same body motion the caster sees
      const m = heroMotion(this.skill && this.alive ? archerMotion(this.skill.id, this.skill.elapsed, this.skill, this.dir === 'left' ? -1 : 1) : null, !!this.meta.hero);
      applyMotion(this.view.motionSprites, m);
      (this.afterimg ??= new Afterimages(this.scene)).step(this.scene.time.now, this.view.sprite, !!m?.after);
    } else if (this.meta.classId === 'samurai') {
      const m = heroMotion(this.skill && this.alive ? samuraiMotion(this.skill.id, this.skill.elapsed, this.skill, this.dir === 'left' ? -1 : 1, this.skill.stage) : null, !!this.meta.hero);
      applyMotion(this.view.motionSprites, m);
      (this.afterimg ??= new Afterimages(this.scene, SAMURAI_AFTER)).step(this.scene.time.now, this.view.sprite, !!m?.after);
      const g = this.meta.gender === 'female' ? 'female' : 'male';
      for (const d of this.kage) { // his doubles: each its own body (or his very pose and motion while he swings), name and bar
        if (!d) continue;
        const p = interp(d.snaps, rt, this.interpDelay); d.x = p.x; d.y = p.y; d.z = p.z;
        d.mt += ms;
        const mirror = d.mode === 'm' && !!this.skill, dir: Dir = mirror ? this.dir : d.face < 0 ? 'left' : 'right';
        const dp = mirror ? pose : resolvePose(this.meta.classId as ClassKey, dir, poseQuery(kageSnap(d.mode, d.mt, d.feint, d.seed)), d.view.wantsBase, g, !!this.meta.hero);
        d.view.render(ms, dp, p.x, p.y, p.z, p.z, dir, 1, null, false);
        const dm = mirror ? m : d.mode === 'f' ? kageFeintMotion(d.mt, d.feint, d.face) : null;
        applyMotion(d.view.motionSprites, dm);
        d.after.step(this.scene.time.now, d.view.sprite, !!dm?.after);
        const t2 = p.y - p.z - this.headTop() - PVP.remoteLabel.gap;
        d.label.setPosition(Math.round(p.x), Math.round(t2 - PVP.hpBar.h - 3));
        d.bar.setPosition(Math.round(p.x), Math.round(t2));
      }
    }
    const top = y - z - this.headTop() - PVP.remoteLabel.gap;
    this.label.setPosition(Math.round(x), Math.round(top - PVP.hpBar.h - 3)).setAlpha((this.deadMs >= 0 ? alpha : 1) * (this.deadMs >= 0 ? 1 : seen)); // down: the name fades with the body (hidden: none)
    this.bar.setPosition(Math.round(x), Math.round(top)).setAlpha(seen);
  }

  /** His doubles from his movement state (null: none): a double missing from the list burst (struck); the list gone, they
   *  melted away (time, or he was struck). */
  private setKage(dk: { hidden: boolean; ds: (KageSeen | null)[] } | null): void {
    if (!dk) {
      this.kageGone.clear(); this.kageHidden = false;
      this.kage.forEach((d, k) => { if (d) this.dropDouble(k, 'fade'); });
      return;
    }
    const me = this.snaps[this.snaps.length - 1], t = this.lastSeen;
    if (this.kageHidden && !dk.hidden) this.onKage?.({ x: me.x, y: me.y, z: me.z }, 'appear'); // he steps out of hiding
    this.kageHidden = dk.hidden; this.kageHold = 0;
    for (let k = 0; k < KAGE.count; k++) {
      const o = dk.ds[k] ?? null, d = this.kage[k];
      if (!o) { if (d) this.dropDouble(k, 'burst'); continue; }
      const at = { t, x: me.x + o.dx, y: me.y + o.dy, z: me.z + o.dz };
      if (d) {
        d.snaps.push(at); if (d.snaps.length > 30) d.snaps.shift();
        if (o.mode !== d.mode) { d.mode = o.mode; d.mt = 0; if (o.mode === 'f') this.onKage?.({ x: at.x, y: at.y, z: at.z }, 'feint', o.face, o.feint % 3); }
        d.face = o.face; d.feint = o.feint;
        continue;
      }
      if (this.kageGone.has(k) || !this.alive) continue;
      const g = this.meta.gender === 'female' ? 'female' : 'male', L = PVP.remoteLabel;
      const view = new ActorView(this.scene, this.meta.classId as ClassKey, at.x, at.y);
      view.setBaseLook(this.dress.look, g); view.setGear(this.dress.worn, g); view.setEquipped(this.dress.eq);
      const label = this.scene.add.text(at.x, at.y, this.meta.name, {
        fontFamily: FONT_FAMILY, fontSize: `${L.size}px`, fontStyle: 'bold', color: L.color, stroke: '#000000', strokeThickness: 3, resolution: 2,
      }).setOrigin(0.5, 1).setDepth(PVP.labelDepth);
      const bar = this.scene.add.graphics().setDepth(PVP.labelDepth);
      this.kage[k] = { view, label, bar, after: new Afterimages(this.scene, SAMURAI_AFTER), snaps: [at], x: at.x, y: at.y, z: at.z, face: o.face, mode: o.mode, mt: 0, feint: o.feint, seed: k * 97 };
      this.wearTag(view, label, bar);
      this.paintBar(bar);
      this.onKage?.({ x: at.x, y: at.y, z: at.z }, 'appear');
    }
  }
  private dropDouble(k: number, how: 'burst' | 'fade'): void {
    const d = this.kage[k]; if (!d) return;
    this.onKage?.({ x: d.x, y: d.y, z: d.z }, how);
    d.view.destroy(); d.label.destroy(); d.bar.destroy();
    this.kage[k] = null;
  }
  /** A blow from this screen burst one of his doubles (his own screen judges it too). */
  popDouble(k: number): void { if (this.kage[k]) { this.kageGone.add(k); this.dropDouble(k, 'burst'); } }
  /** The AMBUSH landed on this screen's player: his doubles burst, and he is out of hiding. */
  burstDoubles(): void { for (let k = 0; k < this.kage.length; k++) this.popDouble(k); this.kageHidden = false; }
  /** Where his doubles are (his swings are drawn there too). */
  kageGhosts(): { k: number; x: number; y: number; z: number }[] { return this.kage.flatMap((d, k) => (d ? [{ k, x: d.x, y: d.y, z: d.z }] : [])); }
  kagePos(k: number): V3 | null { const d = this.kage[k]; return d ? { x: d.x, y: d.y, z: d.z } : null; }
  kageTargets(radius: number): HitTarget[] { return kageTargets(this.meta.playerId, this.kageGhosts(), radius); }

  /** Mirage Counter: he reappears somewhere else at once (no sliding through the gap). */
  teleport(x: number, y: number, z: number): void { this.snaps = [{ t: performance.now(), x, y, z }]; this.x = x; this.y = y; this.z = z; }

  private drawBar(): void {
    this.paintBar(this.bar);
    for (const d of this.kage) if (d) this.paintBar(d.bar);
  }
  private paintBar(g: Phaser.GameObjects.Graphics): void {
    const H = PVP.hpBar;
    g.clear();
    if (!this.alive) return;
    const col = (s: string) => Phaser.Display.Color.HexStringToColor(s).color;
    g.fillStyle(col(H.background), 1).fillRect(-H.w / 2, 0, H.w, H.h);
    g.fillStyle(col(H.fill), 1).fillRect(-H.w / 2, 0, H.w * Math.min(1, Math.max(0, this.hp) / this.maxHp), H.h);
    g.lineStyle(1, col(H.border), 1).strokeRect(-H.w / 2, 0, H.w, H.h);
  }

  destroy(): void {
    for (const d of this.kage) if (d) { d.view.destroy(); d.label.destroy(); d.bar.destroy(); }
    this.kage = [];
    this.view.destroy(); this.label.destroy(); this.bar.destroy(); this.deathFx.destroy();
  }
}

interface KageView {
  view: ActorView; label: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics; after: Afterimages;
  snaps: Snap[]; x: number; y: number; z: number; face: 1 | -1; mode: KageMode; mt: number; feint: number; seed: number;
}
/** Where a body is shown now: `delay` ms in the past, between the snapshots around it (the latest one with no delay). */
function interp(s: Snap[], rt: number, delay: number): { x: number; y: number; z: number } {
  const last = s[s.length - 1];
  if (delay <= 0 || s.length < 2) return { x: last.x, y: last.y, z: last.z };
  for (let i = s.length - 1; i > 0; i--) {
    if (s[i - 1].t <= rt) {
      const a = s[i - 1], b = s[i], k = Phaser.Math.Clamp((rt - a.t) / Math.max(1, b.t - a.t), 0, 1);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
    }
  }
  while (s.length > 2 && s[1].t <= rt) s.shift();
  return { x: s[0].x, y: s[0].y, z: s[0].z };
}
