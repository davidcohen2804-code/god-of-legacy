// Skill presentation (never gameplay authority): telegraphs drawn from the same shape data as the hitbox,
// anticipation → release → impact VFX timelines from the supplied final sheets, projectile sprites with continuous
// aim rotation, traps/zones, confirmed-hit impacts, damage numbers, hit-stop / camera-shake hierarchy.
import Phaser from 'phaser';
import { FinalSkill, HitEvent, HitShape } from './SkillTypes';
import { CastRun, RT_EVENTS, SkillRuntime, Trap } from './SkillRuntime';
import { Projectile, V2, V3, circleCentre } from './HitGeometry';
import { FINAL_SKILLS } from './FinalKit';
import { WORLD_OBJECTS } from '../world/WorldGeometry';

const F = 'assets/final';
/** Skills that borrow another skill's VFX sheet (no art of their own). */
const VFX_ALIAS: Record<string, string> = { wave_slash: 'warrior_basic' };
const vfxKey = (id: string) => `vfx-${VFX_ALIAS[id] ?? id}`;
const isBig = (s: FinalSkill) => s.slot === 6 || s.slot === 7;
const TOP = 100000;
const GROUND = 2;

/** Orientation of each final VFX sheet: 'dir' sheets are drawn pointing right and rotate with the aim. */
/** Upright sheets whose bottom edge is the ground line (drawn standing on the impact point). */
/** Ground-point origin (fraction of the cell height) for sheets drawn standing on the impact point. */
const GROUND_ANCHORED = new Map<string, number>([['titans_verdict', 0.742], ['ground_breaker', 0.8], ['whirlwind', 0.56], ['leap_crash', 0.88], ['war_cry', 0.88]]);
/** Frames played during startup (anticipation) — the next frame is the impact at active start. */
const PRE_FRAMES: Record<string, number> = { titans_verdict: 7 };
const UPRIGHT = new Set(['iron_grip', 'leap_crash', 'war_cry', 'titans_verdict', 'ground_breaker', 'whirlwind', 'shield_slam', 'blade_storm', 'binding_rune', 'astral_burst', 'frost_nova', 'storm_field',
  'time_collapse', 'explosive_arrow', 'vine_trap', 'rain_of_arrows', 'verdant_judgment', 'spin_cut']);
const PROJECTILE_SHEETS: Record<string, { cell: number; frames: number }> = {
  arcane_bolt: { cell: 128, frames: 8 }, lightning_chain: { cell: 192, frames: 8 }, quick_shot: { cell: 128, frames: 8 },
  piercing_arrow: { cell: 160, frames: 8 }, explosive_arrow: { cell: 160, frames: 8 }, sword_wave: { cell: 192, frames: 8 }, wave_slash: { cell: 192, frames: 8 },
};
/** Projectile skills without a dedicated projectile sheet fly with a sibling's arrow (multi shot / skyhunter arrows). */
const PROJ_ALIAS: Record<string, string> = { multi_shot: 'quick_shot', skyhunters_step: 'quick_shot' };
const IMPACT: Record<string, { key: string; path: string; cell: number; frames: number; size: number }> = {
  warrior: { key: 'imp-warrior', path: `${F}/impact/warrior_steel.png`, cell: 256, frames: 6, size: 110 },
  book_mage: { key: 'imp-mage', path: `${F}/skills/book_mage/astral_burst/vfx.png`, cell: 256, frames: 8, size: 92 },
  archer: { key: 'imp-archer', path: `${F}/impact/archer_burst.png`, cell: 160, frames: 1, size: 78 },
  samurai: { key: 'imp-samurai', path: `${F}/impact/samurai_cross.png`, cell: 160, frames: 6, size: 104 },
  dust: { key: 'imp-dust', path: `${F}/impact/dust_pixel.png`, cell: 128, frames: 6, size: 96 },
  star: { key: 'imp-star', path: `${F}/impact/samurai_star.png`, cell: 160, frames: 6, size: 150 },
  moon: { key: 'imp-moon', path: `${F}/impact/samurai_moon.png`, cell: 256, frames: 5, size: 300 },
  explosion: { key: 'imp-explosion', path: `${F}/impact/archer_explosion.png`, cell: 256, frames: 5, size: 190 },
};
export const CLASS_COLOR: Record<string, number> = { warrior: 0xffb04a, book_mage: 0x6fc8ff, archer: 0x9be35a, samurai: 0xff4a5a };

export function preloadSkillFx(scene: Phaser.Scene): void {
  const L = (k: string, p: string, w: number, h = w) => { if (!scene.textures.exists(k)) scene.load.spritesheet(k, p, { frameWidth: w, frameHeight: h }); };
  for (const s of FINAL_SKILLS) { if (VFX_ALIAS[s.id]) continue; const big = isBig(s) ? 384 : 256; L(vfxKey(s.id), `${F}/skills/${s.cls}/${s.id}/vfx.png`, big); }
  for (const [id, p] of Object.entries(PROJECTILE_SHEETS)) { const cls = FINAL_SKILLS.find((s) => s.id === id)!.cls; L(`proj-${id}`, `${F}/projectiles/${cls}/${id}.png`, p.cell); }
  for (const v of Object.values(IMPACT)) L(v.key, v.path, v.cell);
  const I = (k: string, p: string) => { if (!scene.textures.exists(k)) scene.load.image(k, p); };
  I('tg-circle', `${F}/world/telegraph_circle.png`); I('tg-cone', `${F}/world/telegraph_cone.png`);
  I('tg-line', `${F}/world/telegraph_line.png`); I('tg-traj', `${F}/world/telegraph_trajectory.png`);
  I('magic-circle', `${F}/impact/magic_circle.png`);
  if (!scene.textures.exists('storm-ring')) scene.load.spritesheet('storm-ring', `${F}/skills/warrior/judgment_blade/ring.png`, { frameWidth: 256, frameHeight: 256 });
  if (!scene.textures.exists('phantom-blade')) scene.load.spritesheet('phantom-blade', `${F}/skills/warrior/blade_storm/phantom.png`, { frameWidth: 256, frameHeight: 256 }); I('dmg-glow', `${F}/ui/hud/damage_glow.png`);
}

interface Anim { glow?: Phaser.GameObjects.Image; img: Phaser.GameObjects.Image; t: number; total: number; frames: number[]; frameMs: number[]; follow?: () => V3 | null; z?: number; fadeLast?: number; onDone?: () => void; loop?: [number, number]; until?: number }
interface Tele { g: Phaser.GameObjects.Image; run: CastRun; follow?: boolean }

export type HitTier = 'basic' | 'core' | 'signature' | 'ultimate';
export const tierOf = (s: FinalSkill, hit?: HitEvent): HitTier => (s.slot === 7 ? 'ultimate' : s.slot === 6 ? (hit?.heavy ? 'signature' : 'core') : s.slot === 0 ? 'basic' : 'core');
const HITSTOP: Record<HitTier, number> = { basic: 45, core: 70, signature: 95, ultimate: 140 };
/** Presentation scale of the main skill VFX per class (DFO-style: effects dwarf the character). */
const VFX_MULT: Record<string, number> = { warrior: 1.5 };
/** Warrior skills that get a ground shockwave ring at their impact. */
const SHOCK: Record<string, { r: number; c: number }> = {
  ground_breaker: { r: 170, c: 0xffc070 }, shield_slam: { r: 110, c: 0xfff0c0 }, titans_verdict: { r: 260, c: 0xffd27a },
  blade_storm: { r: 180, c: 0xffb04a }, rising_slash: { r: 90, c: 0xfff0c0 }, whirlwind: { r: 150, c: 0xffe0a0 },
};
const SHAKE: Record<HitTier, [number, number]> = { basic: [50, 0.0012], core: [80, 0.002], signature: [110, 0.003], ultimate: [170, 0.0048] };

export class SkillFx {
  private anims: Anim[] = [];
  private teles: Tele[] = [];
  private projs = new Map<Projectile, Phaser.GameObjects.Image>();
  private traps = new Map<Trap, Phaser.GameObjects.Image[]>();
  private texts: { t: Phaser.GameObjects.Container; age: number; x: number; y: number }[] = [];
  private dark?: Phaser.GameObjects.Rectangle;
  private darkLeft = 0;
  private dmgSeq = 0;
  /** Local presentation freeze (ms) requested by confirmed hits (scene applies it to the local actor + VFX only). */
  hitStopLeft = 0;

  constructor(private scene: Phaser.Scene, rt: SkillRuntime, private casterPos: (id: string) => V3 | null, private cam?: Phaser.Cameras.Scene2D.Camera) {
    rt.events.on(RT_EVENTS.cast, (r: CastRun) => this.onCast(r));
    rt.events.on(RT_EVENTS.active, (r: CastRun) => this.onActive(r));
    rt.events.on(RT_EVENTS.hit, (r: CastRun, i: number, o: V3) => this.onHitFired(r, i, o));
    rt.events.on(RT_EVENTS.projectile, (p: Projectile, r: CastRun) => this.onProjectile(p, r));
    rt.events.on(RT_EVENTS.projectileEnd, (p: Projectile) => this.onProjectileEnd(p));
    rt.events.on(RT_EVENTS.trap, (t: Trap) => this.onTrap(t));
    rt.events.on(RT_EVENTS.trapTrigger, (t: Trap, fired: boolean) => this.onTrapEnd(t, fired));
    rt.events.on(RT_EVENTS.chain, (r: CastRun, _i: number, o: V3, target: { x: number; y: number; z: number } | null) => this.onChain(r, o, target));
    rt.events.on(RT_EVENTS.counter, (r: CastRun) => this.onCounter(r));
    rt.events.on(RT_EVENTS.cancelled, (r: CastRun) => this.dropTele(r));
    rt.events.on(RT_EVENTS.end, (r: CastRun) => this.dropTele(r));
  }

  get count(): number { return this.anims.length + this.projs.size; }

  // ------------------------------------------------------------------ cast timeline

  private firstShape(s: FinalSkill): HitShape { return (s.chain ? s.chain.stages[0] : s.hits).find((h) => h.damage > 0)?.shape ?? s.hits[0].shape; }

  private onCast(r: CastRun): void {
    const s = r.skill;
    if (s.telegraph || isBig(s)) this.telegraph(r);
    // Anticipation frames 0..k during startup at the cast point, release frame exactly at the active start.
    const shape = this.firstShape(s);
    if (shape.kind === 'projectile' || shape.kind === 'chain') { this.castFlare(r); return; }
    if (s.id === 'judgment_blade') this.judgment(r);
    else if (s.id === 'guard_counter') this.aegis(r);
    else if (s.id !== 'leap_crash') this.castVfx(r);
    else this.aura(r);
    if (s.slot === 7) this.ultimateStage(r);
  }

  private onActive(r: CastRun): void {
    this.dropTele(r, true); // VFX timelines are pre-scheduled from the cast; telegraphs end here
    const sh = SHOCK[r.skill.id];
    if (sh) {
      const shape = this.firstShape(r.skill), o = r.origin, a = r.aim;
      const off = shape.kind === 'sector' ? shape.range * 0.6 : 0;
      this.shockwave(o.x + a.x * off, o.y + a.y * off, sh.r, sh.c);
    }
    if (r.skill.id === 'blade_storm') { // summoning circle stays under the phantom blades for the whole storm
      const c = { x: r.origin.x + r.aim.x * 90, y: r.origin.y + r.aim.y * 90 };
      const mc = this.scene.add.image(c.x, c.y, 'magic-circle').setDisplaySize(260, 260 * 0.42).setDepth(GROUND + 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a).setAlpha(0);
      this.scene.tweens.add({ targets: mc, alpha: 0.85, duration: 200 });
      this.scene.tweens.add({ targets: mc, angle: 90, duration: 3300 });
      this.scene.tweens.add({ targets: mc, alpha: 0, delay: 3100, duration: 300, onComplete: () => mc.destroy() });
    }
    if (r.skill.id === 'shield_slam') (this.cam ?? this.scene.cameras.main).shake(120, 0.004);
    if (r.skill.id === 'war_cry') { // the roar: burst of flame, gold flash, double shock ring
      const c = this.casterPos(r.attackerId) ?? r.origin;
      const img = this.scene.add.image(c.x, c.y + 4, vfxKey('war_cry'), 0).setOrigin(0.5, 0.88).setDepth(c.y + 3).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(340, 340);
      const fms = [40, 50, 60, 90, 110, 120, 130, 220];
      this.anims.push({ img, t: 0, total: fms.reduce((a, b) => a + b, 0), frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: fms, fadeLast: 240 });
      const cam = this.cam ?? this.scene.cameras.main; cam.flash(140, 255, 170, 60, false); cam.shake(200, 0.006);
      this.shockwave(c.x, c.y, 220, 0xffb040); this.scene.time.delayedCall(120, () => this.shockwave(c.x, c.y, 300, 0xff7a20));
    }
    if (r.skill.id === 'ground_breaker') { // the earth answers: heavy quake shake, double ring, dust burst
      (this.cam ?? this.scene.cameras.main).shake(220, 0.007);
      this.scene.time.delayedCall(90, () => this.shockwave(r.origin.x, r.origin.y, 240, 0xff9a40));
      for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; this.dust(r.origin.x + Math.cos(t) * 80, r.origin.y + Math.sin(t) * 34, 70, 0.7); }
      // the living quake: a glowing crack field that travels under the warrior for 3s
      const q = this.scene.add.image(r.origin.x, r.origin.y, vfxKey('ground_breaker'), 6).setOrigin(0.5, 0.8).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(360, 360).setAlpha(0);
      this.scene.tweens.add({ targets: q, alpha: 0.75, duration: 200 });
      const tick = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => { const c = this.casterPos(r.attackerId); if (c) q.setPosition(c.x, c.y).setDepth(GROUND + 2).setFrame(5 + (Math.floor(this.scene.time.now / 110) % 3)); } });
      this.scene.tweens.add({ targets: q, alpha: 0, delay: 3100, duration: 300, onComplete: () => { tick.remove(); q.destroy(); } });
    }
    if (r.skill.slot === 7 && r.skill.cls === 'warrior') (this.cam ?? this.scene.cameras.main).flash(160, 255, 226, 170, false);
  }

  /** Ground shockwave: an expanding additive ellipse on the floor plane + a thin bright rim. */
  shockwave(x: number, y: number, radius: number, color: number): void {
    for (const [w, a, d] of [[10, 0.85, 320], [26, 0.35, 420]] as const) {
      const g = this.scene.add.ellipse(x, y, radius * 0.4, radius * 0.4 * 0.42).setStrokeStyle(w, color, a).setDepth(GROUND + 2).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: g, scaleX: 5, scaleY: 5, alpha: 0, duration: d, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
    }
  }

  /** Class aura around the caster for the cast (stronger on signature / ultimate). */
  private aura(r: CastRun): void {
    const s = r.skill, T = r.timings, lvl = s.slot === 7 ? 1 : s.slot === 6 ? 0.8 : s.slot === 0 ? 0 : 0.5;
    if (lvl <= 0) return;
    const c0 = this.casterPos(r.attackerId); if (!c0) return;
    const img = this.scene.add.image(c0.x, c0.y - c0.z - 40, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(CLASS_COLOR[s.cls]).setDepth(c0.y - 1).setAlpha(0);
    img.setDisplaySize(150 + 90 * lvl, 190 + 110 * lvl);
    const life = T.startup + T.active + T.recovery * 0.5;
    this.scene.tweens.add({ targets: img, alpha: 0.5 + 0.4 * lvl, duration: Math.min(160, T.startup) });
    const tick = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => { const c = this.casterPos(r.attackerId); if (c) img.setPosition(c.x, c.y - c.z - 40).setDepth(c.y - 1); } });
    this.scene.tweens.add({ targets: img, alpha: 0, delay: life - 180, duration: 180, onComplete: () => { tick.remove(); img.destroy(); } });
  }

  /** Judgment Blade: the light-sword is hurled forward on an arc, plants itself, and a storm ring crackles around it for 5s. */
  private judgment(r: CastRun): void {
    const a = r.aim, key = vfxKey('judgment_blade'), T = r.timings;
    const land = { x: r.origin.x + a.x * 150, y: r.origin.y + a.y * 150 };
    // Charge-up in the air: the light-sword materialises above the raised hand, crackling, growing.
    const charge = this.scene.add.image(0, 0, key, 3).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(40, 40).setAlpha(0);
    const st0 = { k: 0.25 };
    this.scene.tweens.add({ targets: charge, alpha: 1, duration: 120 });
    this.scene.tweens.add({ targets: st0, k: 1, duration: T.startup, ease: 'Cubic.easeOut' });
    const tick = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      const c = this.casterPos(r.attackerId); if (!c) return;
      const ang = Math.atan2(land.y - (c.y - c.z), land.x - c.x) - Math.PI / 2; // already aimed at the landing point
      charge.setPosition(c.x - a.x * 6, c.y - c.z - 95).setDepth(TOP).setRotation(ang * st0.k).setDisplaySize(150 * st0.k, 150 * st0.k)
        .setFrame(3 + (Math.floor(this.scene.time.now / 70) % 3));
    } });
    this.scene.time.delayedCall(T.startup, () => { tick.remove(); charge.destroy(); });
    this.spark(IMPACT.warrior.key, r.origin.x, r.origin.y - 110, IMPACT.warrior.frames, 80, 0.8);
    this.scene.time.delayedCall(T.startup, () => {
      const c = this.casterPos(r.attackerId) ?? r.origin;
      const fly = this.scene.add.image(c.x, c.y - c.z - 70, key, 0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(150, 150).setDepth(TOP);
      const from = { x: c.x, y: c.y - c.z - 95 }, to = { x: land.x, y: land.y - 40 };
      const st = { p: 0 };
      fly.setRotation(Math.atan2(to.y - from.y, to.x - from.x) - Math.PI / 2); // straight dart: tip points along the line
      this.scene.tweens.add({ targets: st, p: 1, duration: 150, ease: 'Quad.easeIn', onUpdate: () => {
        fly.setPosition(from.x + (to.x - from.x) * st.p, from.y + (to.y - from.y) * st.p);
      }, onComplete: () => {
        fly.destroy();
        const img = this.scene.add.image(land.x, land.y + 4, key, 1).setOrigin(0.5, 0.97).setDepth(land.y + 1).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(190, 190);
        const fms = [90, 100, 100, 100, 100, 120, 260];
        this.anims.push({ img, t: 0, total: fms.reduce((x, y) => x + y, 0), frames: [1, 2, 3, 4, 5, 6, 7], frameMs: fms, fadeLast: 260, loop: [2, 4], until: 5000 });
        this.shockwave(land.x, land.y, 150, 0x6fe0ff); (this.cam ?? this.scene.cameras.main).shake(150, 0.005);
        this.stormRing(land.x, land.y, 5000);
      } });
    });
  }

  /** Electric circle on the floor: double ring + jumping lightning (sheet-free). */
  stormRing(x: number, y: number, ms: number): void {
    if (this.scene.textures.exists('storm-ring')) {
      const img = this.scene.add.image(x, y, 'storm-ring', 0).setOrigin(0.5, 0.6).setDepth(GROUND + 1.5).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(310, 310).setAlpha(0);
      this.scene.tweens.add({ targets: img, alpha: 1, duration: 150 });
      const ev = this.scene.time.addEvent({ delay: 80, loop: true, callback: () => img.setFrame((Number(img.frame.name) + 1) % 8) });
      this.scene.tweens.add({ targets: img, alpha: 0, delay: ms - 250, duration: 250, onComplete: () => { ev.remove(); img.destroy(); } });
      return;
    }
    const g = this.scene.add.graphics().setDepth(GROUND + 1.5).setBlendMode(Phaser.BlendModes.ADD);
    const W = 140, H = 56;
    const draw = () => {
      g.clear();
      const fl = 0.75 + Math.random() * 0.25;
      g.lineStyle(5, 0x6fe0ff, 0.85 * fl).strokeEllipse(x, y, W * 2, H * 2);
      g.lineStyle(2, 0xffffff, 0.9 * fl).strokeEllipse(x, y, W * 2 - 6, H * 2 - 4);
      g.lineStyle(3, 0x3a8cff, 0.7).strokeEllipse(x, y, W * 1.35, H * 1.35);
      for (let i = 0; i < 6; i++) { // lightning bolts between the rings
        const t = Math.random() * Math.PI * 2, r0 = 0.66, r1 = 1;
        let px = x + Math.cos(t) * W * r0, py = y + Math.sin(t) * H * r0;
        g.lineStyle(2, i % 2 ? 0xffffff : 0x9ee8ff, 0.95);
        g.beginPath(); g.moveTo(px, py);
        for (let k = 1; k <= 4; k++) { const rr = r0 + ((r1 - r0) * k) / 4, tt = t + (Math.random() - 0.5) * 0.25; px = x + Math.cos(tt) * W * rr + (Math.random() - 0.5) * 6; py = y + Math.sin(tt) * H * rr + (Math.random() - 0.5) * 4; g.lineTo(px, py); }
        g.strokePath();
      }
    };
    draw();
    const ev = this.scene.time.addEvent({ delay: 70, loop: true, callback: draw });
    g.setAlpha(0); this.scene.tweens.add({ targets: g, alpha: 1, duration: 150 });
    this.scene.tweens.add({ targets: g, alpha: 0, delay: ms - 250, duration: 250, onComplete: () => { ev.remove(); g.destroy(); } });
  }

  /** Aegis Burst: the hex barrier holds in front of the caster, then bursts into the crescent wave. */
  private aegis(r: CastRun): void {
    const a = r.aim, key = vfxKey('guard_counter'), ang = Math.atan2(a.y, a.x) * (180 / Math.PI);
    const st = { off: 44, k: 0.6 };
    const img = this.scene.add.image(0, 0, key, 0).setBlendMode(Phaser.BlendModes.ADD).setAngle(ang).setFlipY(a.x < -0.01);
    // barrier grows in, breathes softly while it holds, then the burst sweeps forward
    const fr = [0, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7], fms = [70, 90, 100, 100, 100, 100, 70, 50, 50, 60, 80, 100, 240];
    const follow = () => { const c = this.casterPos(r.attackerId); if (!c) return null; img.setDisplaySize(230 * st.k, 230 * st.k); return { x: c.x + a.x * st.off, y: c.y + a.y * st.off, z: c.z + 40 }; };
    const p = follow(); if (p) img.setPosition(p.x, p.y - p.z).setDepth(p.y + 2);
    this.anims.push({ img, t: 0, total: fms.reduce((x, y) => x + y, 0), frames: fr, frameMs: fms, follow, fadeLast: 260 });
    this.scene.tweens.add({ targets: st, k: 1, duration: 160, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: st, k: 1.06, duration: 220, delay: 160, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    this.scene.time.delayedCall(630, () => {
      this.scene.tweens.add({ targets: st, off: 130, k: 1.35, duration: 260, ease: 'Cubic.easeOut' });
      const c = this.casterPos(r.attackerId);
      if (c) { this.shockwave(c.x + a.x * 70, c.y + a.y * 70, 140, 0x9ed8ff); (this.cam ?? this.scene.cameras.main).shake(110, 0.004); }
    });
  }

  /** Blade Storm summon: one phantom blade drops and stabs (dedicated sheet when present, else the storm sheet). */
  phantomBlade(x: number, y: number): void {
    if (this.scene.textures.exists('phantom-blade')) {
      const img = this.scene.add.image(x, y, 'phantom-blade', 0).setOrigin(0.5, 0.92).setDepth(y + 1).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(170, 170);
      const fms = [40, 40, 60, 60, 40, 60, 70, 80];
      this.anims.push({ img, t: 0, total: fms.reduce((a, b) => a + b, 0), frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: fms, fadeLast: 80 });
    } else this.spark(vfxKey('blade_storm'), x, y - 60, 12, 200, 0.9, 5);
    this.spark(IMPACT.warrior.key, x, y - 30, IMPACT.warrior.frames, 90, 0.9);
  }

  /** Ground Breaker aftershock: glowing crack pulse + dust on the floor. */
  crack(x: number, y: number, radius: number): void {
    const img = this.scene.add.image(x, y, vfxKey('ground_breaker'), 6).setOrigin(0.5, 0.8).setDepth(GROUND + 2).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(radius * 2.4, radius * 2.4).setAlpha(0.7);
    this.anims.push({ img, t: 0, total: 300, frames: [5, 6, 7], frameMs: [100, 100, 100], fadeLast: 120 });
    this.dust(x + (Math.random() - 0.5) * radius, y + (Math.random() - 0.5) * radius * 0.4, 60, 0.5);
  }

  /** DFO-style callout above a target (COUNTER!! / BACK ATTACK!! / CRITICAL!!). */
  callout(at: V3, text: string, color: string, row = 0): void {
    const t = this.scene.add.text(at.x, at.y - at.z - 120 - row * 30, text, {
      fontFamily: 'Cinzel, Georgia, serif', fontStyle: 'bold italic', fontSize: '30px', color, stroke: '#1a0602', strokeThickness: 6, resolution: 2,
    }).setOrigin(0.5).setDepth(TOP + 30).setScale(1.6).setAlpha(0);
    this.scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 110, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, y: t.y - 26, alpha: 0, delay: 520, duration: 260, onComplete: () => t.destroy() });
  }

  /** Main VFX sprite for a melee / area cast, placed from the authoritative shape. */
  private castVfx(r: CastRun): void {
    const s = r.skill, shape = this.firstShape(s);
    const big = isBig(s), frames = s.slot === 7 ? 14 : s.slot === 6 ? 12 : 8;
    const preFrames = PRE_FRAMES[s.id] ?? (s.slot === 7 ? 4 : 3);
    const o = r.origin, aim = r.aim, upright = UPRIGHT.has(s.id);
    let pos: V3 = { ...o }, size = 200, follow: (() => V3 | null) | undefined;
    switch (shape.kind) {
      case 'sector': pos = { x: o.x + aim.x * shape.range * 0.5, y: o.y + aim.y * shape.range * 0.5, z: o.z + 40 }; size = shape.range * 2.2;
        if (s.dash) follow = () => { const c = this.casterPos(r.attackerId); return c ? { x: c.x + aim.x * shape.range * 0.5, y: c.y + aim.y * shape.range * 0.5, z: c.z + 40 } : null; };
        break;
      case 'line': pos = { x: o.x + aim.x * shape.length * 0.5, y: o.y + aim.y * shape.length * 0.5, z: o.z + 34 }; size = shape.length * 1.25; break;
      case 'capsule': follow = () => { const c = this.casterPos(r.attackerId); return c ? { x: c.x, y: c.y, z: c.z + 40 } : null; }; size = 190; break;
      case 'circle': { const c = circleCentre(shape, o, aim, r.place); pos = { x: c.x, y: c.y, z: o.z + (upright ? 0 : 40) }; size = shape.radius * 2.5; if (shape.at !== 'place' && (s.move.active > 0 || s.dash)) follow = () => { const p = this.casterPos(r.attackerId); return p ? { x: p.x + aim.x * (shape.bias ?? 0), y: p.y + aim.y * (shape.bias ?? 0), z: p.z } : null; }; break; }
      case 'placed': pos = { x: r.place?.x ?? o.x, y: r.place?.y ?? o.y, z: 0 }; size = shape.radius * 2.5; break;
    }
    if (big) size *= 1.15;
    size *= s.slot === 0 ? 0.75 : VFX_MULT[s.cls] ?? 1; // the basic chain stays a compact, proportional slash
    if (GROUND_ANCHORED.has(s.id)) pos = { ...pos, z: o.z };
    const key = vfxKey(s.id);
    const img = this.scene.add.image(pos.x, pos.y - pos.z, key, 0).setOrigin(0.5, GROUND_ANCHORED.get(s.id) ?? (upright && shape.kind !== 'sector' ? 0.62 : 0.5));
    img.setDisplaySize(size, size);
    if (!upright) { const ang = Math.atan2(aim.y, aim.x) * (180 / Math.PI); img.setAngle(ang); img.setFlipY(aim.x < -0.01); }
    else img.setFlipX(aim.x < -0.01);
    img.setDepth(upright && (shape.kind === 'placed') ? GROUND + 1 : TOP).setBlendMode(Phaser.BlendModes.SCREEN);
    if (shape.kind === 'placed' || (upright && shape.kind === 'circle')) img.setDepth(Math.max(GROUND + 1, pos.y - 2)).setBlendMode(Phaser.BlendModes.ADD);
    const T = r.timings, active = Math.max(T.active, 60);
    const fms: number[] = [], fr: number[] = [];
    for (let i = 0; i < preFrames; i++) { fr.push(i); fms.push(T.startup / preFrames); }
    const rest = frames - preFrames - 1;
    const per = Math.max(34, (active + (s.cls === 'warrior' ? 0.6 * T.recovery : 0)) / rest); // warrior: the swing plays out through the follow-through
    for (let i = 0; i < rest; i++) { fr.push(preFrames + i); fms.push(per); }
    fr.push(frames - 1); fms.push(s.cls === 'warrior' ? 280 : 120); // the effect lingers on screen
    const zone = s.zoneMs && s.zoneMs > 600;
    const glow = VFX_MULT[s.cls] ? this.scene.add.image(img.x, img.y, key, 0).setOrigin(img.originX, img.originY).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(img.depth - 0.01).setAngle(img.angle).setFlipX(img.flipX).setFlipY(img.flipY).setAlpha(0.45).setTint(CLASS_COLOR[s.cls]) : undefined;
    glow?.setData('a0', 0.45);
    this.anims.push({ img, glow, t: Math.min(r.elapsed, T.startup), total: fms.reduce((a, b) => a + b, 0), frames: fr, frameMs: fms, follow, z: pos.z, fadeLast: s.cls === 'warrior' ? 260 : 140,
      loop: zone ? [preFrames + 1, frames - 2] : undefined, until: zone ? T.startup + (s.zoneMs ?? 0) : undefined });
    if (s.cls === 'warrior') this.aura(r);
    // Anticipation scale-in (never starts at full size).
    img.setScale(img.scaleX * 0.55, img.scaleY * 0.55);
    const sx = (size / img.width) * (img.flipX ? 1 : 1), sy = size / img.height;
    this.scene.tweens.add({ targets: img, scaleX: sx, scaleY: sy, duration: Math.max(60, T.startup), ease: 'Cubic.easeOut' });
    if (s.id === 'storm_field' || s.id === 'time_collapse' || s.id === 'binding_rune') this.magicCircle(r, pos, size * 0.8, s.id === 'time_collapse' ? 0x9d7bff : s.id === 'storm_field' ? 0xfff07a : 0xc88cff);
  }

  /** Muzzle flare at the hand for projectile/chain skills (frames 0–3 of the skill sheet, small, aimed). */
  private castFlare(r: CastRun): void {
    const s = r.skill, o = r.origin, aim = r.aim;
    const img = this.scene.add.image(o.x + aim.x * 26, o.y + aim.y * 26 - o.z - 40, vfxKey(s.id), 0).setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
    const size = isBig(s) ? 170 : 110;
    img.setDisplaySize(size, size).setAngle(Math.atan2(aim.y, aim.x) * (180 / Math.PI)).setFlipY(aim.x < -0.01).setAlpha(0.85);
    const T = r.timings, n = s.slot === 6 ? 12 : 8;
    const fr = [0, 1, 2, 3, 4, n - 1], fms = [T.startup / 3, T.startup / 3, T.startup / 3, 60, 60, 80];
    this.anims.push({ img, t: Math.min(r.elapsed, T.startup), total: fms.reduce((a, b) => a + b, 0), frames: fr, frameMs: fms, follow: () => { const c = this.casterPos(r.attackerId); return c ? { x: c.x + aim.x * 26, y: c.y + aim.y * 26, z: c.z + 40 } : null; }, fadeLast: 80 });
  }

  /** Telegraph from the authoritative hit shape (visible to everyone during startup). */
  private telegraph(r: CastRun): void {
    const s = r.skill, sh = this.firstShape(s), o = r.origin, a = r.aim;
    const col = CLASS_COLOR[s.cls];
    let g: Phaser.GameObjects.Image | null = null, follow = false;
    const ang = Math.atan2(a.y, a.x) * (180 / Math.PI);
    if (sh.kind === 'placed' || sh.kind === 'circle') {
      const c = sh.kind === 'placed' ? (r.place ?? o) : circleCentre(sh, o, a, r.place);
      const rad = sh.radius;
      g = this.scene.add.image(c.x, c.y, 'tg-circle').setDisplaySize(1, 1);
      g.setScale((2 * rad) / 393, (2 * rad) / 153);
      follow = sh.kind === 'circle' && !!(s.dash || s.move.active);
    } else if (sh.kind === 'sector') {
      g = this.scene.add.image(o.x, o.y, 'tg-cone').setOrigin(0.5, 0.5).setAngle(ang);
      const half = (sh.angle / 2) * (Math.PI / 180);
      g.setScale(sh.range / 255, Math.max(0.2, (Math.tan(Math.min(half, 1.3)) * sh.range) / 163));
    } else if (sh.kind === 'line' || sh.kind === 'capsule' || sh.kind === 'chain') {
      const len = sh.kind === 'line' ? sh.length : sh.kind === 'chain' ? sh.corridor : (s.dash?.distance ?? 160);
      const w = sh.kind === 'line' ? sh.width : sh.kind === 'chain' ? sh.width : sh.radius * 2;
      g = this.scene.add.image(o.x, o.y, 'tg-line').setOrigin(8 / 512, 0.5).setAngle(ang).setScale(len / 497, w / 45);
    } else if (sh.kind === 'projectile') {
      g = this.scene.add.image(o.x, o.y, 'tg-traj').setOrigin(13 / 512, 0.5).setAngle(ang).setScale(sh.range / 468, 0.5);
    }
    if (!g) return;
    g.setDepth(GROUND).setTint(col).setAlpha(s.slot === 7 ? 0.95 : 0.7);
    this.scene.tweens.add({ targets: g, alpha: { from: g.alpha * 0.45, to: g.alpha }, duration: 160, yoyo: true, repeat: -1 });
    this.teles.push({ g, run: r, follow });
  }

  private dropTele(r: CastRun, keepZone = false): void {
    this.teles = this.teles.filter((t) => {
      if (t.run !== r) return true;
      if (keepZone && (r.skill.zoneMs ?? 0) > 0) return true;
      this.scene.tweens.killTweensOf(t.g); t.g.destroy(); return false;
    });
  }

  private magicCircle(r: CastRun, pos: V3, size: number, tint: number): void {
    const img = this.scene.add.image(pos.x, pos.y, 'magic-circle').setDepth(GROUND + 0.5).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0);
    img.setDisplaySize(size, size * 0.62);
    const life = r.timings.startup + Math.max(r.timings.active, r.skill.zoneMs ?? 0) + 200;
    this.scene.tweens.add({ targets: img, alpha: 0.9, duration: Math.min(260, r.timings.startup) });
    this.scene.tweens.add({ targets: img, alpha: 0, delay: life - 200, duration: 200, onComplete: () => img.destroy() });
  }

  /** Ultimate staging: brief local darkening around the caster (never the whole UI), class glint. */
  private ultimateStage(r: CastRun): void {
    const cam = this.cam ?? this.scene.cameras.main;
    if (!this.dark) this.dark = this.scene.add.rectangle(0, 0, 4000, 3000, 0x05030a, 0).setOrigin(0, 0).setDepth(TOP - 10).setScrollFactor(1);
    this.dark.setPosition(cam.worldView.x - 200, cam.worldView.y - 200);
    this.darkLeft = r.timings.startup + r.timings.active + 160;
    this.scene.tweens.add({ targets: this.dark, fillAlpha: 0.38, duration: Math.min(220, r.timings.startup) });
  }

  // ------------------------------------------------------------------ hit-timed visuals

  private onHitFired(r: CastRun, i: number, o: V3): void {
    const s = r.skill, h = r.hits[i];
    // Multi-hit area skills: a short pulse per tick so every discrete hit reads (VFX timeline already running).
    if (i > 0 && (h.shape.kind === 'circle' || h.shape.kind === 'placed')) {
      const c = h.shape.kind === 'placed' ? (r.place ?? o) : circleCentre(h.shape, o, r.aim, r.place);
      const k = IMPACT[s.cls === 'book_mage' ? 'book_mage' : s.cls === 'samurai' ? 'star' : s.cls === 'archer' ? 'archer' : 'warrior'];
      this.spark(k.key, c.x, c.y - (h.shape.kind === 'placed' ? 30 : o.z + 40), k.frames, (h.shape.kind === 'placed' ? h.shape.radius : (h.shape as { radius: number }).radius) * 1.2, 0.8);
    }
    if (s.id === 'dragon_eclipse') this.eclipseSlash(r, o);
    if (s.id === 'leap_crash') { // crater at the landing point
      const img = this.scene.add.image(o.x, o.y, vfxKey(s.id), 0).setOrigin(0.5, 0.88).setDepth(o.y + 2).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(330, 330);
      const fr = [0, 1, 2, 3, 4, 5, 6, 7], fms = [40, 60, 80, 110, 120, 140, 170, 300];
      this.anims.push({ img, t: 0, total: fms.reduce((a, b) => a + b, 0), frames: fr, frameMs: fms, fadeLast: 320 });
      (this.cam ?? this.scene.cameras.main).shake(160, 0.005);
      this.shockwave(o.x, o.y, 200, 0xffc070);
    }
    if (s.id === 'verdant_judgment' && i === 1) this.spark(IMPACT.explosion.key, r.place?.x ?? o.x, (r.place?.y ?? o.y) - 50, 5, 260, 1);
  }

  private eclipseSlash(r: CastRun, o: V3): void {
    // One huge readable blade line tied to the real hit + the blood-moon payoff.
    const len = 260, a = r.aim;
    const line = this.scene.add.rectangle(o.x + a.x * len * 0.45, o.y + a.y * len * 0.45 - o.z - 44, len, 6, 0xffffff, 1).setAngle(Math.atan2(a.y, a.x) * (180 / Math.PI)).setDepth(TOP + 5).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: line, scaleY: 0.1, alpha: 0, duration: 260, ease: 'Cubic.easeIn', onComplete: () => line.destroy() });
    this.spark(IMPACT.moon.key, o.x + a.x * 110, o.y + a.y * 110 - 70, 5, 280, 1);
  }

  private onCounter(r: CastRun): void {
    const c = this.casterPos(r.attackerId); if (!c) return;
    if (r.skill.cls === 'warrior') { this.spark(vfxKey('guard_counter'), c.x + r.aim.x * 50, c.y + r.aim.y * 50 - c.z - 40, 8, 260, 1, 2); this.shockwave(c.x, c.y, 120, 0x9ed8ff); return; }
    this.spark(vfxKey('mirage'), c.x + r.aim.x * 40, c.y + r.aim.y * 40 - c.z - 40, 8, 200, 1, 2);
  }

  private onProjectile(p: Projectile, r: CastRun): void {
    const id = PROJ_ALIAS[p.skill.id] ?? p.skill.id, sheet = PROJECTILE_SHEETS[id];
    if (!sheet) return;
    const img = this.scene.add.image(p.x, p.y - p.z, `proj-${id}`, 0).setDepth(p.y).setAngle(Math.atan2(p.dy, p.dx) * (180 / Math.PI));
    const size = id === 'wave_slash' ? 150 : id === 'sword_wave' ? 120 : id === 'arcane_bolt' ? 64 : id === 'lightning_chain' ? 120 : 92;
    img.setDisplaySize(size, size).setFlipY(p.dx < -0.01);
    if (r.skill.slot === 6) img.setTint(0xd8ffe0).setBlendMode(Phaser.BlendModes.ADD);
    this.projs.set(p, img);
  }

  private onProjectileEnd(p: Projectile): void {
    const img = this.projs.get(p);
    img?.destroy(); this.projs.delete(p);
    const end = p.end ?? { x: p.x, y: p.y, reason: 'range' };
    if (p.explodeRadius > 0) this.spark(IMPACT.explosion.key, end.x, end.y - p.z + 10, 5, p.explodeRadius * 2.6, 1);
    else if (end.reason === 'cover') this.spark(IMPACT.dust.key, end.x, end.y - p.z + 20, 6, 70, 0.9);
  }

  private onChain(r: CastRun, o: V3, target: { x: number; y: number; z: number } | null): void {
    const a = { x: o.x + r.aim.x * 20, y: o.y + r.aim.y * 20 - o.z - 44 };
    const b = target ? { x: target.x, y: target.y - target.z - 44 } : { x: o.x + r.aim.x * 300, y: o.y + r.aim.y * 300 - o.z - 44 };
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const img = this.scene.add.image((a.x + b.x) / 2, (a.y + b.y) / 2, 'proj-lightning_chain', 0).setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
    img.setDisplaySize(len, 90).setAngle(Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI));
    const fr = [0, 2, 4, 6, 7], fms = [50, 50, 50, 50, 60];
    this.anims.push({ img, t: 0, total: 260, frames: fr, frameMs: fms, fadeLast: 60 });
  }

  private onTrap(t: Trap): void {
    const img = this.scene.add.image(t.x, t.y, vfxKey('vine_trap'), 2).setDepth(GROUND + 0.6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.75);
    img.setDisplaySize(t.radius * 3.2, t.radius * 3.2).setOrigin(0.5, 0.6);
    const ring = this.scene.add.image(t.x, t.y, 'tg-circle').setDepth(GROUND).setTint(CLASS_COLOR.archer).setAlpha(0.6);
    ring.setScale((2 * t.radius) / 393, (2 * t.radius) / 153);
    this.scene.tweens.add({ targets: img, alpha: { from: 0.45, to: 0.85 }, duration: 600, yoyo: true, repeat: -1 });
    this.traps.set(t, [img, ring]);
  }

  private onTrapEnd(t: Trap, fired: boolean): void {
    const list = this.traps.get(t); this.traps.delete(t);
    for (const i of list ?? []) { this.scene.tweens.killTweensOf(i); i.destroy(); }
    if (fired) this.spark(vfxKey('vine_trap'), t.x, t.y - 20, 8, 140, 1, 3);
  }

  // ------------------------------------------------------------------ confirmed hits

  /** Confirmed hit feedback at the target: class impact, damage number, hit-stop + shake by tier. */
  confirmed(s: FinalSkill, hit: HitEvent, at: V3, damage: number, reaction: string, local: boolean, combo: number): void {
    const tier = tierOf(s, hit);
    const k = IMPACT[s.cls] ?? IMPACT.warrior;
    const im = s.cls === 'warrior' ? 1.45 : 1;
    this.spark(k.key, at.x, at.y - at.z - 38, k.frames, k.size * im * (tier === 'ultimate' ? 1.6 : hit.heavy ? 1.25 : 1), 1);
    if (s.cls === 'warrior') { // white core flash on every confirmed hit
      const f = this.scene.add.image(at.x, at.y - at.z - 38, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 3).setDisplaySize(hit.heavy ? 100 : 64, hit.heavy ? 100 : 64).setAlpha(0.75);
      this.scene.tweens.add({ targets: f, alpha: 0, scale: f.scale * 1.4, duration: 140, onComplete: () => f.destroy() });
    }
    // Ground dust only where the skill has no ground impact art of its own (kept subtle).
    if (tier !== 'ultimate' && reaction === 'launch') this.spark(IMPACT.dust.key, at.x, at.y + 4, 6, 90, 0.5);
    if (tier !== 'ultimate' && (reaction === 'knockdown' || reaction === 'slam')) this.spark(IMPACT.dust.key, at.x, at.y + 6, 6, 110, 0.55);
    if (damage > 0) this.damageNumber(at, damage, hit.heavy || tier === 'ultimate' || tier === 'signature', combo);
    if (local) {
      const multi = (s.chain ? 1 : s.hits.length) > 3 && !hit.heavy; // rapid multi-hits: lighter per-hit freeze
      this.hitStopLeft = Math.max(this.hitStopLeft, HITSTOP[tier] * (multi ? 0.45 : 1) + (hit.heavy && tier === 'core' ? 20 : 0));
      const [d, i] = SHAKE[tier];
      if (tier !== 'basic' || hit.heavy) this.scene.cameras.main.shake(d, i);
    }
  }

  /** Damage number: rises 28px over 520ms, scale 0.82 → 1.08 in 70ms, fades the last 180ms. */
  damageNumber(at: V3, dmg: number, heavy: boolean, combo: number): void {
    const off = [0, 10, -10, 6, -6][this.dmgSeq++ % 5];
    const x = at.x + off, y = at.y - at.z - 84;
    const c = this.scene.add.container(x, y).setDepth(TOP + 20);
    if (heavy) c.add(this.scene.add.image(0, 0, 'dmg-glow').setDisplaySize(84, 84).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD));
    const txt = this.scene.add.text(0, 0, String(dmg), {
      fontFamily: 'Cinzel, Georgia, serif', fontStyle: 'bold', fontSize: heavy ? '30px' : '22px',
      color: heavy ? '#ffd27a' : '#fff1d0', stroke: '#2a0e05', strokeThickness: heavy ? 5 : 4, resolution: 2,
    }).setOrigin(0.5);
    c.add(txt);
    c.setScale(0.82);
    this.scene.tweens.add({ targets: c, scale: 1.08, duration: 70, ease: 'Quad.easeOut', yoyo: false, onComplete: () => this.scene.tweens.add({ targets: c, scale: 1, duration: 120 }) });
    this.texts.push({ t: c, age: 0, x, y });
    void combo;
  }

  /** One-shot animated sprite (impacts, bursts). */
  spark(key: string, x: number, y: number, frames: number, size: number, alpha: number, start = 0): void {
    const img = this.scene.add.image(x, y, key, start).setDepth(TOP + 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha);
    img.setDisplaySize(size, size);
    const fr: number[] = [], fms: number[] = [];
    for (let i = start; i < frames; i++) { fr.push(i); fms.push(42); }
    if (fr.length === 1) { fms[0] = 160; this.scene.tweens.add({ targets: img, scale: img.scale * 1.3, duration: 160 }); }
    this.anims.push({ img, t: 0, total: fms.reduce((a, b) => a + b, 0), frames: fr, frameMs: fms, fadeLast: 60 });
  }

  /** Landing / footstep dust at the support plane. */
  dust(x: number, y: number, size: number, alpha = 0.85): void { this.spark(IMPACT.dust.key, x, y - size * 0.25, 6, size, alpha); }

  update(ms: number, projectiles: Projectile[]): void {
    const step = this.hitStopLeft > 0 ? 0 : ms;
    if (this.hitStopLeft > 0) this.hitStopLeft = Math.max(0, this.hitStopLeft - ms);
    this.anims = this.anims.filter((a) => {
      a.t += step;
      let tt = a.t, idx = a.frames.length - 1;
      if (a.loop && a.until !== undefined && a.t < a.until) {
        const pre = a.frameMs.slice(0, a.frames.indexOf(a.loop[0])).reduce((x, y) => x + y, 0);
        if (a.t >= pre) { const span = a.loop[1] - a.loop[0] + 1; a.img.setFrame(a.loop[0] + (Math.floor((a.t - pre) / 70) % span)); this.place(a); return true; }
      } else if (a.loop && a.until !== undefined) tt = a.total - a.frameMs[a.frameMs.length - 1] + (a.t - a.until);
      if (tt >= a.total) { a.img.destroy(); a.glow?.destroy(); a.onDone?.(); return false; }
      let acc = 0;
      for (let i = 0; i < a.frames.length; i++) { acc += a.frameMs[i]; if (tt < acc) { idx = i; break; } }
      a.img.setFrame(a.frames[idx]);
      if (a.fadeLast && tt > a.total - a.fadeLast) a.img.setAlpha(Math.max(0, (a.total - tt) / a.fadeLast) * (a.img.getData('a0') ?? 1));
      this.place(a);
      if (a.glow) a.glow.setFrame(a.frames[idx]).setPosition(a.img.x, a.img.y).setScale(a.img.scaleX * 1.12, a.img.scaleY * 1.12).setAlpha(a.img.alpha * 0.45);
      return true;
    });
    for (const t of this.teles) if (t.follow) { const c = this.casterPos(t.run.attackerId); if (c) t.g.setPosition(c.x, c.y); }
    for (const p of projectiles) {
      const img = this.projs.get(p);
      if (!img) continue;
      img.setPosition(p.x, p.y - p.z).setDepth(projDepth(p));
      const id = PROJ_ALIAS[p.skill.id] ?? p.skill.id;
      img.setFrame(Math.floor((p.ageMs * 24) / 1000) % (PROJECTILE_SHEETS[id]?.frames ?? 8));
    }
    this.texts = this.texts.filter((d) => {
      d.age += ms;
      const k = Math.min(1, d.age / 520);
      d.t.setPosition(d.x, d.y - 28 * (1 - (1 - k) * (1 - k)));
      d.t.setAlpha(d.age > 340 ? Math.max(0, 1 - (d.age - 340) / 180) : 1);
      if (d.age >= 520) { d.t.destroy(); return false; }
      return true;
    });
    if (this.dark && this.darkLeft > 0) {
      this.darkLeft -= ms;
      if (this.darkLeft <= 0) this.scene.tweens.add({ targets: this.dark, fillAlpha: 0, duration: 200 });
    }
  }

  private place(a: Anim): void {
    if (!a.follow) return;
    const p = a.follow();
    if (p) a.img.setPosition(p.x, p.y - p.z);
  }

  destroy(): void {
    for (const a of this.anims) { a.img.destroy(); a.glow?.destroy(); }
    for (const t of this.teles) t.g.destroy();
    for (const i of this.projs.values()) i.destroy();
    for (const l of this.traps.values()) for (const i of l) i.destroy();
    for (const d of this.texts) d.t.destroy();
    this.dark?.destroy();
    this.anims = []; this.teles = []; this.projs.clear(); this.traps.clear(); this.texts = [];
  }
}

/** Projectiles sort by ground y, but fly in front of a prop once higher than it. */
function projDepth(p: Projectile): number {
  for (const o of WORLD_OBJECTS) if (p.z >= o.height && p.y <= o.frontY) return Math.max(p.y, o.frontY + 1);
  return p.y;
}
