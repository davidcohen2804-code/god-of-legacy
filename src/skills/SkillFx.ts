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
const VFX_ALIAS: Record<string, string> = { wave_slash: 'warrior_basic', radiant_blade: 'war_cry', sanctuary: 'war_cry' };
const vfxKey = (id: string) => `vfx-${VFX_ALIAS[id] ?? id}`;
const isBig = (s: FinalSkill) => s.slot === 6 || s.slot === 7;
const TOP = 100000;
const GROUND = 2;

/** Orientation of each final VFX sheet: 'dir' sheets are drawn pointing right and rotate with the aim. */
/** Upright sheets whose bottom edge is the ground line (drawn standing on the impact point). */
/** Ground-point origin (fraction of the cell height) for sheets drawn standing on the impact point. */
const GROUND_ANCHORED = new Map<string, number>([['titans_verdict', 0.97], ['rising_slash', 0.84], ['ground_breaker', 0.8], ['whirlwind', 0.56], ['leap_crash', 0.88], ['war_cry', 0.88]]);
/** Frames played during startup (anticipation) — the next frame is the impact at active start. */
const PRE_FRAMES: Record<string, number> = { titans_verdict: 4 };
/** Sheets whose frame count differs from the slot default. */
const VFX_FRAMES: Record<string, number> = { titans_verdict: 12 };
const UPRIGHT = new Set(['rising_slash', 'iron_grip', 'leap_crash', 'war_cry', 'titans_verdict', 'ground_breaker', 'whirlwind', 'shield_slam', 'blade_storm', 'binding_rune', 'astral_burst', 'frost_nova', 'storm_field',
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

/** Procedural blade-of-light texture (hilt at x=0, tapering tip at the right end). */
export function ensureLightBeam(scene: Phaser.Scene): void {
  if (scene.textures.exists('light-beam')) return;
  const W = 256, H = 32, c = scene.textures.createCanvas('light-beam', W, H)!, g = c.getContext();
  for (let x = 0; x < W; x++) {
    const t = x / W, fade = t < 0.06 ? t / 0.06 : t > 0.86 ? Math.max(0, (1 - t) / 0.14) : 1;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(255,200,90,0)'); grad.addColorStop(0.3, `rgba(255,220,130,${0.55 * fade})`);
    grad.addColorStop(0.5, `rgba(255,255,255,${fade})`); grad.addColorStop(0.7, `rgba(255,220,130,${0.55 * fade})`); grad.addColorStop(1, 'rgba(255,200,90,0)');
    g.fillStyle = grad; g.fillRect(x, 0, 1, H);
  }
  c.refresh();
}

export function preloadSkillFx(scene: Phaser.Scene): void {
  const L = (k: string, p: string, w: number, h = w) => { if (!scene.textures.exists(k)) scene.load.spritesheet(k, p, { frameWidth: w, frameHeight: h }); };
  for (const s of FINAL_SKILLS) { if (VFX_ALIAS[s.id]) continue; const big = isBig(s) ? 384 : 256; L(vfxKey(s.id), `${F}/skills/${s.cls}/${s.id}/vfx.png`, big); }
  for (const [id, p] of Object.entries(PROJECTILE_SHEETS)) { const cls = FINAL_SKILLS.find((s) => s.id === id)!.cls; L(`proj-${id}`, `${F}/projectiles/${cls}/${id}.png`, p.cell); }
  for (const v of Object.values(IMPACT)) L(v.key, v.path, v.cell);
  const I = (k: string, p: string) => { if (!scene.textures.exists(k)) scene.load.image(k, p); };
  I('tg-circle', `${F}/world/telegraph_circle.png`); I('tg-cone', `${F}/world/telegraph_cone.png`);
  I('tg-line', `${F}/world/telegraph_line.png`); I('tg-traj', `${F}/world/telegraph_trajectory.png`);
  I('magic-circle', `${F}/impact/magic_circle.png`);
  if (!scene.textures.exists('jb-bolt')) scene.load.spritesheet('jb-bolt', `${F}/skills/warrior/judgment_blade/bolt.png`, { frameWidth: 256, frameHeight: 512 });
  if (!scene.textures.exists('storm-ring')) scene.load.spritesheet('storm-ring', `${F}/skills/warrior/judgment_blade/ring.png`, { frameWidth: 256, frameHeight: 256 });
  if (!scene.textures.exists('sanctuary-wall')) scene.load.spritesheet('sanctuary-wall', `${F}/skills/warrior/sanctuary/wall.png`, { frameWidth: 256, frameHeight: 512 });
  if (!scene.textures.exists('cry-shield')) scene.load.spritesheet('cry-shield', `${F}/skills/warrior/war_cry/shield.png`, { frameWidth: 300, frameHeight: 300 });
  if (!scene.textures.exists('bs-storm')) scene.load.spritesheet('bs-storm', `${F}/skills/warrior/blade_storm/storm.png`, { frameWidth: 280, frameHeight: 440 });
  if (!scene.textures.exists('bs-erupt')) scene.load.spritesheet('bs-erupt', `${F}/skills/warrior/blade_storm/erupt_a.png`, { frameWidth: 250, frameHeight: 667 });
  if (!scene.textures.exists('titan-dragon')) scene.load.spritesheet('titan-dragon', `${F}/skills/warrior/titans_verdict/dragon.png`, { frameWidth: 280, frameHeight: 440 });
  if (!scene.textures.exists('titan-tear')) scene.load.spritesheet('titan-tear', `${F}/skills/warrior/titans_verdict/tear.png`, { frameWidth: 640, frameHeight: 360 });
  if (!scene.textures.exists('titan-cutin')) scene.load.image('titan-cutin', `${F}/skills/warrior/titans_verdict/cutin.png`);
  if (!scene.textures.exists('holy-aura')) scene.load.spritesheet('holy-aura', `${F}/skills/warrior/radiant_blade/aura.png`, { frameWidth: 250, frameHeight: 667 });
  if (!scene.textures.exists('holy-bolt')) scene.load.spritesheet('holy-bolt', `${F}/skills/warrior/radiant_blade/bolt.png`, { frameWidth: 250, frameHeight: 500 });
  if (!scene.textures.exists('radiant-blade')) scene.load.spritesheet('radiant-blade', `${F}/skills/warrior/radiant_blade/blade_small.png`, { frameWidth: 256, frameHeight: 81 });
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
  private dmgStacks: { x: number; y: number; line: number; last: number }[] = [];
  /** Local presentation freeze (ms) requested by confirmed hits (scene applies it to the local actor + VFX only). */
  hitStopLeft = 0;
  /** Where the caster's raised hand is right now (set by the scene from the body pose). */
  handPos?: (id: string) => { x: number; y: number } | null;
  /** Local player's damage-number skin (cash shop). */
  damageSkin: { key: string; widths: number[]; cell: number[] } | null = null;

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
    if ((s.telegraph || isBig(s)) && s.cls !== 'warrior') this.telegraph(r); // warrior skills read through their own art: no red ground markers
    // Anticipation frames 0..k during startup at the cast point, release frame exactly at the active start.
    const shape = this.firstShape(s);
    if (s.id === 'wave_slash') { this.chargeUp(r); return; }
    if (shape.kind === 'projectile' || shape.kind === 'chain') { this.castFlare(r); return; }
    if (s.id === 'judgment_blade') this.judgment(r);
    else if (s.id === 'guard_counter') this.aegis(r);
    else if (s.id === 'war_cry') this.roar(r);
    else if (s.id === 'radiant_blade') { /* lightning fired by the scene at the real sword tip */ }
    else if (s.id === 'sanctuary') { /* the wall itself is the effect: no ring on the floor */ }
    else if (s.id === 'blade_storm' && this.scene.textures.exists('bs-storm')) this.lightningStorm(r);
    else if (s.id === 'titans_verdict' && this.scene.textures.exists('titan-dragon')) this.dragon(r);
    else if (s.id === 'ground_breaker') this.quakeBurst(r);
    else if (s.id !== 'leap_crash' && s.id !== 'blade_storm' && !(s.id === 'titans_verdict' && this.scene.textures.exists('titan-dragon'))) this.castVfx(r);
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
    if (r.skill.id === 'shield_slam') (this.cam ?? this.scene.cameras.main).shake(120, 0.004);
    if (r.skill.id === 'ground_breaker') { // the earth answers: heavy quake shake, double ring, dust burst
      (this.cam ?? this.scene.cameras.main).shake(220, 0.007);
      this.scene.time.delayedCall(90, () => this.shockwave(r.origin.x, r.origin.y, 240, 0xff9a40));
      for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; this.dust(r.origin.x + Math.cos(t) * 80, r.origin.y + Math.sin(t) * 34, 70, 0.7); }
      // one burst of sparks at the impact, fading out gradually
      this.spark(IMPACT.warrior.key, r.origin.x, r.origin.y - 30, IMPACT.warrior.frames, 220, 0.9);
      // the living quake: one golden rune ring that slowly turns on the floor around the warrior and fades away over 3s
      const ring = this.scene.add.image(0, 0, 'magic-circle').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc070).setDisplaySize(360, 360);
      const plane = this.scene.add.container(r.origin.x, r.origin.y, [ring]).setScale(1, 0.42).setDepth(GROUND + 2).setAlpha(0); // floor perspective
      this.scene.tweens.add({ targets: plane, alpha: 0.85, duration: 220 });
      this.scene.tweens.add({ targets: ring, angle: 140, duration: 3100 });
      this.scene.tweens.add({ targets: plane, alpha: 0, delay: 800, duration: 2300, ease: 'Sine.easeIn', onComplete: () => plane.destroy() }); // stays where it was created
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

  /** Charged release (Wave Slash): power gathers into the blade for the whole wind-up, then a bright flash on release. */
  private chargeUp(r: CastRun): void {
    const T = r.timings, col = CLASS_COLOR[r.skill.cls], a = r.aim;
    const at = () => { const c = this.casterPos(r.attackerId); return c ? { x: c.x + a.x * 36, y: c.y + a.y * 10 - c.z - 44, d: c.y + 1 } : null; }; // gathers at the sword, out to the attacking side
    const p0 = at(); if (!p0) return;
    const core = this.scene.add.image(p0.x, p0.y, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setDepth(p0.d).setDisplaySize(20, 20).setAlpha(0.2);
    const halo = this.scene.add.image(p0.x, p0.y + 30, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setDepth(p0.d - 2).setDisplaySize(120, 150).setAlpha(0);
    this.scene.tweens.add({ targets: core, displayWidth: 110, displayHeight: 110, alpha: 1, duration: T.startup, ease: 'Quad.easeIn' });
    this.scene.tweens.add({ targets: halo, alpha: 0.55, displayWidth: 200, displayHeight: 240, duration: T.startup, ease: 'Quad.easeIn' });
    let t = 0;
    const tick = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      t += 16; const p = at(); if (!p) return;
      core.setPosition(p.x, p.y).setDepth(p.d); halo.setPosition(p.x, p.y + 30).setDepth(p.d - 2);
      core.setScale(core.scaleX * (1 + 0.04 * Math.sin(t / 40)), core.scaleY * (1 + 0.04 * Math.sin(t / 40)));
      if (t < T.startup - 80 && t % 48 < 16) { // sparks drawn into the blade
        const ang = Math.random() * Math.PI * 2, d = 70 + Math.random() * 50;
        const sp = this.scene.add.image(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d * 0.7, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff2c0).setDepth(p.d + 1).setDisplaySize(14, 14);
        this.scene.tweens.add({ targets: sp, x: p.x, y: p.y, displayWidth: 4, displayHeight: 4, duration: 220, ease: 'Quad.easeIn', onComplete: () => sp.destroy() });
      }
      if (t >= T.startup) { // release flash
        tick.remove();
        const f = this.scene.add.image(p.x + a.x * 50, p.y + a.y * 50, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setDepth(TOP).setDisplaySize(90, 90);
        this.scene.tweens.add({ targets: f, displayWidth: 260, displayHeight: 260, alpha: 0, duration: 220, ease: 'Cubic.easeOut', onComplete: () => f.destroy() });
        this.scene.tweens.add({ targets: [core, halo], alpha: 0, duration: 160, onComplete: () => { core.destroy(); halo.destroy(); } });
        (this.cam ?? this.scene.cameras.main).shake(110, 0.004);
      }
    } });
  }

  /** War Cry: power gathers, then the roar bursts out as a golden light pillar and floor shockwaves (no fire). */
  /** Radiant Blade: a lightning bolt strikes down from the sky onto the sword tip (clean finish, no rings). */
  lightningAt(tx: number, ty: number, small = false): void {
    if (!small && this.scene.textures.exists('holy-bolt')) { // painted holy lightning strike onto the sword tip
      const img = this.scene.add.image(tx, ty, 'holy-bolt', 0).setOrigin(0.5, 0.79).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 4).setDisplaySize(260, 520);
      const fr = [0, 1, 2, 3, 2, 3, 4, 3, 2, 3, 4, 3, 4, 5, 6, 7], fms = [60, 60, 90, 90, 80, 90, 90, 80, 80, 90, 90, 90, 100, 110, 130, 180]; // a sustained surge of power
      this.anims.push({ img, t: 0, total: fms.reduce((a, b) => a + b, 0), frames: fr, frameMs: fms, fadeLast: 180 });
      this.scene.time.delayedCall(100, () => (this.cam ?? this.scene.cameras.main).shake(180, 0.008));
      return;
    }
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 4);
    const pts: [number, number][] = []; const off = (Math.random() < 0.5 ? -1 : 1) * 40;
    for (let i = 0; i <= 10; i++) { const y = ty - 560 + (560 * i) / 10, f = 1 - i / 10; pts.push([i === 10 ? tx : tx + off * f + (Math.random() - 0.5) * 60 * f, y]); }
    for (const [w, col, a] of [[16, 0xffd27a, 0.3], [6, 0xfff4d0, 0.9], [2, 0xffffff, 1]] as const) { g.lineStyle(w, col, a).beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.strokePath(); }
    const flash = this.scene.add.image(tx, ty, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0b0).setDepth(TOP + 5).setDisplaySize(90, 90);
    this.scene.tweens.add({ targets: flash, displayWidth: 220, displayHeight: 220, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 280, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
    if (!small) (this.cam ?? this.scene.cameras.main).shake(140, 0.006);
  }

  private roar(r: CastRun): void {
    const T = r.timings, c0 = this.casterPos(r.attackerId); if (!c0) return;
    const glow = this.scene.add.image(c0.x, c0.y - c0.z - 46, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36a).setDepth(c0.y - 1).setDisplaySize(60, 80).setAlpha(0);
    this.scene.tweens.add({ targets: glow, alpha: 0.8, displayWidth: 170, displayHeight: 210, duration: T.startup, ease: 'Quad.easeIn' });
    this.scene.time.delayedCall(T.startup, () => {
      const c = this.casterPos(r.attackerId) ?? c0;
      glow.destroy();
      const pillar = this.scene.add.image(c.x, c.y - c.z - 10, 'dmg-glow').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff1b8).setDepth(c.y + 1).setDisplaySize(110, 60);
      this.scene.tweens.add({ targets: pillar, displayHeight: 420, displayWidth: 70, duration: 160, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: pillar, alpha: 0, delay: 160, duration: 420, onComplete: () => pillar.destroy() });
      const flash = this.scene.add.image(c.x, c.y - c.z - 50, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setDepth(TOP).setDisplaySize(120, 120);
      this.scene.tweens.add({ targets: flash, displayWidth: 380, displayHeight: 380, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
      const waves = Math.max(3, Math.round(T.active / 150)); // the roar keeps ringing out for the whole active window
      for (let i = 0; i < waves; i++) this.scene.time.delayedCall(i * 150, () => { const p = this.casterPos(r.attackerId) ?? c; this.shockwave(p.x, p.y, 200 + (i % 3) * 70, i % 3 === 1 ? 0xffffff : 0xffd36a); });
      const hold = this.scene.add.image(c.x, c.y - c.z - 50, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36a).setDepth(c.y - 1).setDisplaySize(190, 230).setAlpha(0.75);
      this.scene.tweens.add({ targets: hold, scaleX: hold.scaleX * 1.12, scaleY: hold.scaleY * 1.12, yoyo: true, repeat: -1, duration: 110 });
      this.scene.tweens.add({ targets: hold, alpha: 0, delay: T.active, duration: 300, onComplete: () => { this.scene.tweens.killTweensOf(hold); hold.destroy(); } });
      (this.cam ?? this.scene.cameras.main).shake(T.active, 0.006);
    });
  }

  /** Ground Breaker: a column of golden light erupts straight up from the smash point. */
  private quakeBurst(r: CastRun): void {
    const T = r.timings, c = r.origin;
    this.scene.time.delayedCall(T.startup, () => {
      const col = this.scene.add.image(c.x, c.y + 4, 'dmg-glow').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc870).setDepth(c.y + 2).setDisplaySize(90, 30);
      this.scene.tweens.add({ targets: col, displayHeight: 300, displayWidth: 120, duration: 160, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: col, alpha: 0, delay: 160, duration: 420, onComplete: () => col.destroy() });
      this.spark(IMPACT.warrior.key, c.x, c.y - 40, IMPACT.warrior.frames, 220, 0.9);
    });
  }

  /** Ground Breaker heal: a yellow "HP" glyph rises softly out of the ground. */
  hpGlyph(x: number, y: number): void {
    const t = this.scene.add.text(x, y, 'HP', { fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: '12px', color: '#fff2a0', stroke: '#5a3a00', strokeThickness: 2, resolution: 2 })
      .setOrigin(0.5).setDepth(y + 300).setAlpha(0).setScale(0.7);
    this.scene.tweens.add({ targets: t, alpha: 0.55, scale: 1, duration: 200, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: t, y: y - 70, duration: 1100, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 450, onComplete: () => t.destroy() });
  }

  /** Blade Storm: the painted lightning storm crashes down onto the raised sword and rages for the whole hold. */
  private lightningStorm(r: CastRun): void {
    const T = r.timings, c = this.casterPos(r.attackerId) ?? r.origin;
    const img = this.scene.add.image(c.x, c.y + 6, 'bs-storm', 12).setOrigin(0.5, 342 / 440).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(360, 570).setDepth(c.y - 1).setAlpha(0.72);
    const fr = [12, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11], up = T.startup;
    const fms = [up * 0.55, up * 0.15, up * 0.15, up * 0.15, 90, 90, 90, 70, 70, 70, 70, 70, 70, 260];
    img.setData('a0', 0.72);
    this.anims.push({ img, t: 0, total: fms.reduce((x, y) => x + y, 0), frames: fr, frameMs: fms, fadeLast: 260, loop: [6, 11], until: T.startup + T.active,
      follow: () => { const p = this.casterPos(r.attackerId); return p ? { x: p.x, y: p.y + 6, z: 0 } : null; } });
    this.scene.time.delayedCall(Math.round(up * 0.85), () => (this.cam ?? this.scene.cameras.main).shake(220, 0.007));
  }

  /** Titan's Verdict: a colossal lightning dragon dives from the sky onto the target zone (after the cut-in and screen split). */
  private dragon(r: CastRun): void {
    const T = r.timings, a = r.aim, at = { x: r.origin.x + a.x * 110, y: r.origin.y + a.y * 110 };
    const pre = 420, dive = T.startup - pre; // the dragon dives after the cut-in and the tear // frames 0-3 dive in, frame 4 = impact on the active start
    const img = this.scene.add.image(at.x, at.y + 10, 'titan-dragon', 0).setOrigin(0.5, 0.97).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(470, 740).setDepth(TOP + 2);
    const fr = [12, 0, 1, 2, 3, 4, 5, 5, 6, 7, 8, 9, 10, 11]; // 12 = empty frame while the cut-in plays (sim-timed)
    const fms = [dive, pre * 0.25, pre * 0.25, pre * 0.25, pre * 0.25, 130, 160, 140, 170, 170, 170, 180, 200, 240];
    this.anims.push({ img, t: 0, total: fms.reduce((x, y) => x + y, 0), frames: fr, frameMs: fms, fadeLast: 240 });
    this.scene.time.delayedCall(T.startup, () => { // impact flash rings
      this.shockwave(at.x, at.y, 320, 0xfff0b0); this.scene.time.delayedCall(90, () => this.shockwave(at.x, at.y, 420, 0xffc860));
      (this.cam ?? this.scene.cameras.main).shake(420, 0.014);
    });
  }

  /** Sanctuary: the sword tip traces a glowing half-circle on the floor during the wind-up. */
  private traceArc(r: CastRun): void {
    const c = this.casterPos(r.attackerId) ?? r.origin, T = r.timings, rx = 120, ry = 56;
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(GROUND + 2).setPosition(c.x, c.y);
    const st = { p: 0 };
    this.scene.tweens.add({ targets: st, p: 1, duration: T.startup * 0.9, ease: 'Sine.easeInOut', onUpdate: () => {
      g.clear(); g.lineStyle(6, 0xffe08a, 0.9).beginPath();
      const n = Math.max(2, Math.round(40 * st.p));
      for (let j = 0; j <= n; j++) { const th = Math.PI + Math.PI * (j / 40); const px = rx * Math.cos(th), py = -ry * Math.sin(th) * -1; if (j === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.strokePath();
    } });
    this.scene.tweens.add({ targets: g, alpha: 0, delay: T.startup + 200, duration: 400, onComplete: () => g.destroy() });
  }

  /** Judgment Blade: the light-sword is hurled forward on an arc, plants itself, and a storm ring crackles around it for 5s. */
  private judgment(r: CastRun): void {
    const key = vfxKey('judgment_blade'), T = r.timings;
    let a = r.aim, land = { x: r.origin.x + a.x * 150, y: r.origin.y + a.y * 150 };
    const aimNow = () => { a = r.aim; const c = this.casterPos(r.attackerId) ?? r.origin; land = { x: c.x + a.x * 150, y: c.y + a.y * 150 }; };
    // Charge-up in the air: a cyan Zeus thunderbolt crackles in the raised fist, gripped through its middle.
    const BW = 125, BH = 250; // on-screen size of the bolt (256x512 art)
    const charge = this.scene.add.image(0, 0, 'jb-bolt', 0).setOrigin(0.5, 0.475).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(BW * 0.6, BH * 0.6).setAlpha(0);
    const mark = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(GROUND + 3);
    const drawMark = (t: number) => {
      const p = 0.5 + 0.5 * Math.sin(t / 120); mark.clear();
      mark.fillStyle(0x6fe0ff, 0.18 + 0.12 * p).fillEllipse(land.x, land.y, 70, 30);
      mark.lineStyle(3, 0x9ff0ff, 0.9).strokeEllipse(land.x, land.y, 70, 30);
      mark.fillStyle(0xdfffff, 0.95).fillEllipse(land.x, land.y, 10, 5);
    };
    const st0 = { k: 0.6 };
    const halo = this.scene.add.image(0, 0, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6fe0ff).setAlpha(0);
    const arcs = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const zig = (g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, segs: number, amp: number) => {
      const pts = [[x0, y0]]; const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1;
      for (let i = 1; i < segs; i++) { const t = i / segs, o = (Math.random() - 0.5) * 2 * amp; pts.push([x0 + (x1 - x0) * t + (nx / l) * o, y0 + (y1 - y0) * t + (ny / l) * o]); }
      pts.push([x1, y1]);
      for (const [w, col, al] of [[6, 0x2aa8ff, 0.35], [3, 0x9ff0ff, 0.9], [1.2, 0xffffff, 1]] as const) { g.lineStyle(w, col, al).beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.strokePath(); }
    };
    this.scene.tweens.add({ targets: [charge, halo], alpha: { from: 0, to: 1 }, duration: 120 });
    this.scene.tweens.add({ targets: st0, k: 1, duration: 420, ease: 'Back.easeOut' }); // the whole thunder-sword is in hand almost at once
    let released = false;
    const tick = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      if (!released && (r.phase !== 'startup' || r.elapsed >= r.timings.startup)) { released = true; release(); return; } // timer ran out, or V pressed again
      const c = this.casterPos(r.attackerId); if (!c) return; aimNow();
      const ang = Math.atan2(land.y - (c.y - c.z), land.x - c.x) - Math.PI / 2; // follows the player's aim while hovering
      const h = this.handPos?.(r.attackerId) ?? { x: c.x - a.x * 6, y: c.y - c.z - 105 }; // forms in the raised hand
      drawMark(this.scene.time.now);
      const now = this.scene.time.now, pulse = 1 + 0.05 * Math.sin(now / 45), rot = (Math.abs(a.x) > 0.3 ? Math.sign(a.x) * 0.62 : 0) + 0 * ang;
      charge.setPosition(h.x, h.y).setDepth(TOP).setRotation(rot) // slanted forward like Zeus' bolt
        .setDisplaySize(BW * st0.k * pulse, BH * st0.k * pulse).setFrame(Math.floor(now / 70) % 6);
      halo.setPosition(h.x, h.y).setDepth(TOP - 1).setDisplaySize(150 * st0.k * pulse, 150 * st0.k * pulse).setAlpha(0.55 + 0.25 * Math.sin(now / 60));
      arcs.clear().setDepth(TOP);
      if (Math.floor(now / 50) % 2 === 0) for (let i = 0; i < 2; i++) { // electricity jumping off the bolt
        const t = (Math.random() - 0.5) * BH * 0.8 * st0.k, bx = h.x - Math.sin(rot) * t, by = h.y + Math.cos(rot) * t, ang2 = Math.random() * Math.PI * 2, len = 30 + Math.random() * 40;
        zig(arcs, bx, by, bx + Math.cos(ang2) * len, by + Math.sin(ang2) * len, 5, 7);
      }
    } });
    this.spark(IMPACT.warrior.key, r.origin.x, r.origin.y - 110, IMPACT.warrior.frames, 80, 0.8);
    const release = () => {
      tick.remove(); this.scene.tweens.add({ targets: mark, alpha: 0, duration: 300, onComplete: () => mark.destroy() });
      aimNow();
      const c = this.casterPos(r.attackerId) ?? r.origin, cam = this.cam ?? this.scene.cameras.main;
      const h = this.handPos?.(r.attackerId) ?? { x: c.x, y: c.y - c.z - 95 };
      const to = { x: land.x, y: land.y - BH * 0.3 }, ang = Math.atan2(to.y - h.y, to.x - h.x), rot = ang - Math.PI / 2;
      // 1) wind-up: the bolt snaps back behind the shoulder, energy flares
      this.scene.tweens.add({ targets: charge, x: h.x - Math.cos(ang) * 22, y: h.y - Math.sin(ang) * 22 - 6, rotation: rot, displayWidth: BW * 1.12, displayHeight: BH * 1.12, duration: 70, ease: 'Quad.easeOut' });
      this.scene.tweens.add({ targets: halo, displayWidth: 260, displayHeight: 260, alpha: 1, duration: 70 });
      this.scene.time.delayedCall(80, () => {
        charge.destroy(); arcs.destroy();
        this.scene.tweens.add({ targets: halo, alpha: 0, displayWidth: 340, displayHeight: 340, duration: 160, onComplete: () => halo.destroy() });
        cam.shake(90, 0.006);
        // 2) the throw: very fast dart with afterimages
        const from = { x: h.x - Math.cos(ang) * 22, y: h.y - Math.sin(ang) * 22 - 6 };
        const fly = this.scene.add.image(from.x, from.y, 'jb-bolt', 6).setOrigin(0.5, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(BW * 1.1, BH * 1.25).setDepth(TOP).setRotation(rot);
        const st = { p: 0 };
        this.scene.tweens.add({ targets: st, p: 1, duration: 130, ease: 'Quad.easeIn', onUpdate: () => {
          const x = from.x + (to.x - from.x) * st.p, y = from.y + (to.y - from.y) * st.p; fly.setPosition(x, y);
          const ghost = this.scene.add.image(x, y, 'jb-bolt', 6).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(BW, BH * 1.2).setRotation(rot).setDepth(TOP - 1).setAlpha(0.45).setTint(0x6fc8ff);
          this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 150, onComplete: () => ghost.destroy() });
        }, onComplete: () => {
          fly.destroy();
          // 3) impact: a lightning strike from the sky, screen flash, heavy shake, double shockwave
          const bolt = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP);
          zig(bolt, land.x + (Math.random() - 0.5) * 40, land.y - 520, land.x, land.y, 12, 16); zig(bolt, from.x, from.y, land.x, land.y - 10, 8, 10);
          this.scene.tweens.add({ targets: bolt, alpha: 0, duration: 220, onComplete: () => bolt.destroy() });
          const burst = this.scene.add.image(land.x, land.y - 20, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xbff4ff).setDepth(TOP).setDisplaySize(120, 90);
          this.scene.tweens.add({ targets: burst, displayWidth: 420, displayHeight: 260, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => burst.destroy() });
          const img = this.scene.add.image(land.x, land.y + 6, 'jb-bolt', 7).setOrigin(0.5, 0.95).setDepth(land.y + 1).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(BW * 1.25, BH * 1.25);
          const fms = [90, 110, 110, 110, 280];
          this.anims.push({ img, t: 0, total: fms.reduce((x, y) => x + y, 0), frames: [7, 8, 9, 10, 11], frameMs: fms, fadeLast: 280, loop: [1, 3], until: 5000 });
          this.shockwave(land.x, land.y, 170, 0xffffff); this.scene.time.delayedCall(70, () => this.shockwave(land.x, land.y, 280, 0x6fe0ff));
          this.spark(IMPACT.warrior.key, land.x, land.y - 30, IMPACT.warrior.frames, 200, 1);
          cam.flash(90, 150, 225, 255); cam.shake(240, 0.013);
          this.stormRing(land.x, land.y, 5000);
        } });
      });
    };
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

  /** Blade field: a painted sword of light erupts from the ground, stands, then shatters into shards. */
  risingBlade(x: number, y: number, delay = 0): void {
    this.scene.time.delayedCall(delay, () => {
      if (!this.scene.textures.exists('bs-erupt')) return;
      const s = 0.8 + Math.random() * 0.4;
      const img = this.scene.add.image(x, y, 'bs-erupt', 0).setOrigin(0.5, 560 / 667).setDisplaySize(125 * s, 335 * s).setDepth(y + 1); // solid painted sword (readable on any floor)
      const glow = this.scene.add.image(x, y, 'bs-erupt', 0).setOrigin(0.5, 560 / 667).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(125 * s, 335 * s).setDepth(y + 1.01).setAlpha(0.45);
      glow.setData('a0', 0.45);
      const fms = [50, 50, 60, 90, 110, 110, 120, 140];
      this.anims.push({ img, glow, t: 0, total: fms.reduce((p, q) => p + q, 0), frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: fms, fadeLast: 140 });
    });
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
    const s = r.skill, shape = r.hits.find((h) => h.damage > 0)?.shape ?? this.firstShape(s); // run hits: includes Radiant Blade reach
    const big = isBig(s), frames = VFX_FRAMES[s.id] ?? (s.slot === 7 ? 14 : s.slot === 6 ? 12 : 8);
    const preFrames = PRE_FRAMES[s.id] ?? (s.slot === 7 ? 4 : 3);
    const o = r.origin, aim = r.aim, upright = UPRIGHT.has(s.id);
    let pos: V3 = { ...o }, size = 200, follow: (() => V3 | null) | undefined;
    switch (shape.kind) {
      case 'sector': pos = { x: o.x + aim.x * shape.range * 0.5, y: o.y + aim.y * shape.range * 0.5, z: o.z + 40 }; size = shape.range * 2.2;
        if (s.dash) follow = () => { const c = this.casterPos(r.attackerId); return c ? { x: c.x + aim.x * shape.range * 0.5, y: c.y + aim.y * shape.range * 0.5, z: c.z + 40 } : null; };
        break;
      case 'line': pos = { x: o.x + aim.x * shape.length * 0.5, y: o.y + aim.y * shape.length * 0.5, z: o.z + 34 }; size = shape.length * 1.25; break;
      case 'capsule': follow = () => { const c = this.casterPos(r.attackerId); return c ? { x: c.x, y: c.y, z: c.z + 40 } : null; }; size = 190; break;
      case 'circle': { const c = circleCentre(shape, o, aim, r.place); pos = { x: c.x, y: c.y, z: o.z + (upright ? 0 : 40) }; size = shape.radius * 2.5; if (shape.at !== 'place' && (s.move.active > 0 || s.dash )) follow = () => { const p = this.casterPos(r.attackerId); return p ? { x: p.x + aim.x * (shape.bias ?? 0), y: p.y + aim.y * (shape.bias ?? 0), z: p.z } : null; }; break; }
      case 'placed': pos = { x: r.place?.x ?? o.x, y: r.place?.y ?? o.y, z: 0 }; size = shape.radius * 2.5; break;
    }
    if (big) size *= 1.15;
    if (s.id === 'titans_verdict') size *= 1.35; // the giant of light towers over the arena
    size *= s.slot === 0 ? 0.75 : VFX_MULT[s.cls] ?? 1; // the basic chain stays a compact, proportional slash
    const basic = !!s.chain, st = r.stage ?? 0;
    if (basic && st === 3) size *= 1.3; // finisher: a bigger, heavier arc
    if (GROUND_ANCHORED.has(s.id)) pos = { ...pos, z: o.z };
    const key = vfxKey(s.id);
    const img = this.scene.add.image(pos.x, pos.y - pos.z, key, 0).setOrigin(0.5, GROUND_ANCHORED.get(s.id) ?? (upright && shape.kind !== 'sector' ? 0.62 : 0.5));
    img.setDisplaySize(size, size);
    if (!upright) {
      // Basic chain: each strike cuts a different line (forehand, backhand, rising diagonal, heavy overhead).
      const tilt = basic ? [0, 0, -28, 22][st] * (aim.x < -0.01 ? -1 : 1) : 0;
      const ang = Math.atan2(aim.y, aim.x) * (180 / Math.PI) + tilt; img.setAngle(ang); img.setFlipY((aim.x < -0.01) !== (basic && st % 2 === 1));
    }
    else img.setFlipX(aim.x < -0.01);
    img.setDepth(upright && (shape.kind === 'placed') ? GROUND + 1 : TOP).setBlendMode(Phaser.BlendModes.SCREEN);
    if (shape.kind === 'placed' || (upright && shape.kind === 'circle')) img.setDepth(Math.max(GROUND + 1, pos.y - 2)).setBlendMode(Phaser.BlendModes.ADD);
    const T = r.timings, active = Math.max(T.active, 60);
    const fms: number[] = [], fr: number[] = [];
    if (basic) { // crisp: nothing during the wind-up, the arc snaps out exactly on the swing, short trail
      fr.push(0); fms.push(T.startup); img.setVisible(false);
      const per = Math.max(28, (active + 0.3 * T.recovery) / (frames - 3));
      for (let i = 2; i < frames - 1; i++) { fr.push(i); fms.push(per); }
      fr.push(frames - 1); fms.push(90);
    } else {
      for (let i = 0; i < preFrames; i++) { fr.push(i); fms.push(T.startup / preFrames); }
      const rest = frames - preFrames - 1;
      const per = Math.max(34, (active + (s.cls === 'warrior' ? 0.6 * T.recovery : 0)) / rest); // warrior: the swing plays out through the follow-through
      for (let i = 0; i < rest; i++) { fr.push(preFrames + i); fms.push(per); }
      fr.push(frames - 1); fms.push(s.cls === 'warrior' ? 280 : 120); // the effect lingers on screen
    }
    const zone = s.zoneMs && s.zoneMs > 600;
    const glow = VFX_MULT[s.cls] ? this.scene.add.image(img.x, img.y, key, 0).setOrigin(img.originX, img.originY).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(img.depth - 0.01).setAngle(img.angle).setFlipX(img.flipX).setFlipY(img.flipY).setAlpha(0.45).setTint(CLASS_COLOR[s.cls]) : undefined;
    glow?.setData('a0', 0.45);
    if (basic) glow?.setVisible(false);
    this.anims.push({ img, glow, t: Math.min(r.elapsed, T.startup), total: fms.reduce((a, b) => a + b, 0), frames: fr, frameMs: fms, follow, z: pos.z, fadeLast: basic ? 110 : s.cls === 'warrior' ? 260 : 140,
      loop: zone ? [preFrames + 1, frames - 2] : undefined, until: zone ? T.startup + (s.zoneMs ?? 0) : undefined });
    if (s.cls === 'warrior' && !basic) this.aura(r);
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
    this.scene.tweens.add({ targets: this.dark, fillAlpha: 0.55, duration: Math.min(220, r.timings.startup) });
    // Anime cut-in: the roaring hero slides across the screen during the wind-up (MapleStory 5th-job style).
    if (r.skill.id === 'titans_verdict' && this.scene.textures.exists('titan-cutin')) {
      const v = cam.worldView, w = v.width * 0.9, cy = v.y + v.height * 0.42;
      const img = this.scene.add.image(v.x - w / 2, cy, 'titan-cutin').setDepth(TOP + 50); // slides in from the left
      img.setDisplaySize(w, w / 3);
      const band = this.scene.add.rectangle(v.centerX, cy, v.width, w / 3 + 16, 0x000000, 0.55).setDepth(TOP + 49).setScale(1, 0);
      this.scene.tweens.add({ targets: band, scaleY: 1, duration: 120, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: img, x: v.centerX - w * 0.04, duration: 300, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: img, x: v.centerX + w * 0.03, delay: 300, duration: 800 }); // slow drift while holding (a real beat)
      this.scene.tweens.add({ targets: img, x: v.right + w / 2, alpha: 0, delay: 1100, duration: 200, ease: 'Cubic.easeIn', onComplete: () => img.destroy() });
      this.scene.tweens.add({ targets: band, scaleY: 0, delay: 1120, duration: 160, onComplete: () => band.destroy() });
    }
    // Cinematic cut-in (screen space): two golden slash bars cross the screen, then a white flash at the impact.
    const W = cam.width, H = cam.height;
    const mk = (y: number, ang: number, delay: number) => {
      const bar = this.scene.add.rectangle(W / 2, y, W * 1.6, 10, 0xffe6a0, 1).setScrollFactor(0).setDepth(TOP + 40).setAngle(ang).setBlendMode(Phaser.BlendModes.ADD).setScale(0, 1);
      const glow = this.scene.add.rectangle(W / 2, y, W * 1.6, 46, 0xffb030, 0.45).setScrollFactor(0).setDepth(TOP + 39).setAngle(ang).setBlendMode(Phaser.BlendModes.ADD).setScale(0, 1);
      this.scene.tweens.add({ targets: [bar, glow], scaleX: 1, delay, duration: 120, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: [bar, glow], scaleY: 0, alpha: 0, delay: delay + 260, duration: 220, onComplete: () => { bar.destroy(); glow.destroy(); } });
    };
    void mk;
    // The screen rips open like paper right after the cut-in, light pouring through the tear.
    if (this.scene.textures.exists('titan-tear')) this.scene.time.delayedCall(1240, () => {
      const v = cam.worldView;
      // golden sparks burst out along the rip (top-left → bottom-right diagonal)
      for (let i = 0; i < 46; i++) {
        const t = Math.random(), px = v.x + v.width * (0.12 + 0.76 * t), py = v.y + v.height * (0.18 + 0.64 * t) + (Math.random() - 0.5) * 30;
        const sp = this.scene.add.image(px, py, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(Math.random() < 0.5 ? 0xffe9a0 : 0xffb040).setDepth(TOP + 49).setDisplaySize(8 + Math.random() * 10, 8 + Math.random() * 10);
        const side = Math.random() < 0.5 ? -1 : 1, d = 60 + Math.random() * 180;
        this.scene.tweens.add({ targets: sp, x: px + side * d * 0.55, y: py - side * d * 0.85 + 60, alpha: 0, scale: sp.scale * 0.3, duration: 380 + Math.random() * 420, ease: 'Quad.easeOut', delay: Math.random() * 120, onComplete: () => sp.destroy() });
      }
      const tear = this.scene.add.image(v.centerX, v.centerY, 'titan-tear', 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 48).setDisplaySize(v.width * 1.05, v.height * 1.05);
      const fms = [70, 110, 230, 200];
      this.anims.push({ img: tear, t: 0, total: fms.reduce((a, b) => a + b, 0), frames: [0, 1, 2, 3], frameMs: fms, fadeLast: 200 });
      cam.shake(200, 0.006);
    });
    this.scene.time.delayedCall(r.timings.startup, () => {
      const f = this.scene.add.rectangle(0, 0, W, H, 0xfff4d8, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(TOP + 45).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: f, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
      cam.shake(420, 0.014);
    });
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
      // lies flat on the floor under the actors (never painted over the warrior)
      const img = this.scene.add.image(o.x, o.y, vfxKey(s.id), 0).setOrigin(0.5, 0.62).setDepth(GROUND + 1).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(360, 150);
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
    const im = s.cls === 'warrior' ? 1.9 : 1;
    this.spark(k.key, at.x, at.y - at.z - 38, k.frames, k.size * im * (tier === 'ultimate' ? 1.6 : hit.heavy ? 1.25 : 1), 1);
    if (s.cls === 'warrior') { // white core flash on every confirmed hit
      const f = this.scene.add.image(at.x, at.y - at.z - 38, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 3).setDisplaySize(hit.heavy ? 150 : 96, hit.heavy ? 150 : 96).setAlpha(0.8);
      this.scene.tweens.add({ targets: f, alpha: 0, scale: f.scale * 1.4, duration: 140, onComplete: () => f.destroy() });
    }
    // Ground dust only where the skill has no ground impact art of its own (kept subtle).
    if (tier !== 'ultimate' && reaction === 'launch') this.spark(IMPACT.dust.key, at.x, at.y + 4, 6, 90, 0.5);
    if (tier !== 'ultimate' && (reaction === 'knockdown' || reaction === 'slam')) this.spark(IMPACT.dust.key, at.x, at.y + 6, 6, 110, 0.55);
    if (damage > 0) this.damageNumber(at, damage, hit.heavy || tier === 'ultimate' || tier === 'signature', combo, local);
    if (local) {
      const multi = (s.chain ? 1 : s.hits.length) > 3 && !hit.heavy; // rapid multi-hits: lighter per-hit freeze
      this.hitStopLeft = Math.max(this.hitStopLeft, HITSTOP[tier] * (multi ? 0.45 : 1) + (hit.heavy && tier === 'core' ? 20 : 0));
      const [d, i] = SHAKE[tier];
      if (tier !== 'basic' || hit.heavy) this.scene.cameras.main.shake(d, i);
    }
  }

  /** MapleStory-style damage: each hit of a burst stacks one line higher above the target; big bold gradient digits. */
  damageNumber(at: V3, dmg: number, heavy: boolean, combo: number, local = false): void {
    // One column per target: a new hit within 700ms near the last column stacks on top of it (same x, next line up).
    const now = this.scene.time.now;
    let st = this.dmgStacks.find((d) => now - d.last < 700 && Math.abs(d.x - at.x) < 160 && Math.abs(d.y - at.y) < 120);
    if (st) { st.line = (st.line + 1) % 10; st.last = now; } else { st = { x: at.x, y: at.y - at.z, line: 0, last: now }; this.dmgStacks.push(st); }
    this.dmgStacks = this.dmgStacks.filter((d) => now - d.last < 1500);
    const line = st.line, x = st.x, y = st.y - 96 - line * 30;
    const c = this.scene.add.container(x, y).setDepth(TOP + 20 + line * 0.01);
    if (heavy) c.add(this.scene.add.image(0, 0, 'dmg-glow').setDisplaySize(130, 70).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD));
    const sk = local ? this.damageSkin : null;
    if (sk && this.scene.textures.exists(sk.key)) { // cash-shop damage skin: painted digits
      const H = heavy ? 74 : 60, sc = H / sk.cell[1], digits = String(dmg).split('').map(Number);
      const adv = digits.map((d) => sk.widths[d] * sc * 0.86), total = adv.reduce((a, b) => a + b, 0);
      if (heavy) c.add(this.scene.add.image(-total / 2 - H * 0.35, -4, sk.key, 10).setScale(sc * 1.05));
      let xx = -total / 2;
      digits.forEach((d, i) => { c.add(this.scene.add.image(xx + adv[i] / 2, (i % 2 ? 2 : -2), sk.key, d).setScale(sc)); xx += adv[i]; });
      c.setScale(1.6).setAlpha(0);
      this.scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 90, ease: 'Back.easeOut' });
      this.texts.push({ t: c, age: 0, x, y });
      return;
    }
    const txt = this.scene.add.text(0, 0, String(dmg), {
      fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: heavy ? '40px' : '32px',
      color: '#ffffff', stroke: heavy ? '#4a1200' : '#3a1a00', strokeThickness: heavy ? 7 : 6, resolution: 2,
    }).setOrigin(0.5);
    const g = txt.context.createLinearGradient(0, 0, 0, txt.height); // orange→gold like the Maple crit skin
    if (heavy) { g.addColorStop(0, '#fff6c8'); g.addColorStop(0.45, '#ffc93a'); g.addColorStop(1, '#ff6a12'); }
    else { g.addColorStop(0, '#ffe9b0'); g.addColorStop(0.5, '#ffab3a'); g.addColorStop(1, '#ff7a1a'); }
    txt.setFill(g);
    txt.setShadow(0, 3, '#000000', 4, true, true);
    c.add(txt);
    c.setScale(1.6).setAlpha(0);
    this.scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 90, ease: 'Back.easeOut' });
    this.texts.push({ t: c, age: 0, x, y });
    void combo;
  }

  /** Green heal number rising from the player. */
  healNumber(at: V3, hp: number): void {
    const x = at.x + (Math.random() - 0.5) * 20, y = at.y - at.z - 90;
    const t = this.scene.add.text(x, y, `+${hp}`, { fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: '24px', color: '#7dff8a', stroke: '#0b3a12', strokeThickness: 5, resolution: 2 }).setOrigin(0.5).setDepth(TOP + 20);
    this.scene.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
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
      a.img.setFrame(a.frames[idx]); if (idx > 0 && !a.img.visible) a.img.setVisible(true);
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
      const k = Math.min(1, d.age / 900);
      d.t.setPosition(d.x, d.y - 18 * (1 - (1 - k) * (1 - k)));
      if (d.age > 90) d.t.setAlpha(d.age > 680 ? Math.max(0, 1 - (d.age - 680) / 220) : 1);
      if (d.age >= 900) { d.t.destroy(); return false; }
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
