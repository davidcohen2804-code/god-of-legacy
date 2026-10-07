// Skill presentation (never gameplay authority): telegraphs drawn from the same shape data as the hitbox,
// anticipation → release → impact VFX timelines from the supplied final sheets, projectile sprites with continuous
// aim rotation, traps/zones, confirmed-hit impacts, damage numbers, hit-stop / camera-shake hierarchy.
import Phaser from 'phaser';
import { FinalSkill, HitEvent, HitShape } from './SkillTypes';
import { CastRun, RT_EVENTS, SkillRuntime, Trap } from './SkillRuntime';
import { Projectile, V2, V3, circleCentre } from './HitGeometry';
import { FINAL_SKILLS } from './FinalKit';
import DIGITS from '../data/damage-digits.json';
import { SKILL_BLOCKERS, WORLD_OBJECTS } from '../world/WorldGeometry';

const F = 'assets/final';
/** Skills that borrow another skill's VFX sheet (no art of their own). */
const VFX_ALIAS: Record<string, string> = { wave_slash: 'warrior_basic', radiant_blade: 'war_cry', sanctuary: 'war_cry', iron_oath: 'war_cry', legacy_banner: 'war_cry' };
const vfxKey = (id: string) => `vfx-${VFX_ALIAS[id] ?? id}`;
const isBig = (s: FinalSkill) => s.slot === 6 || s.slot === 7;
const TOP = 100000;
/** Damage numbers, as the MapleStory client draws them: a number appears at once (no pop), rises at one steady speed
 *  (0.25 px every 8 ms step there), stays solid for 250 ms, then fades out over 500 ms. The lines of a column sit one row
 *  apart (30 px after a normal line, 36 after a critical one there): normal lines never touch, a bigger critical may. The
 *  first digit is drawn bigger than the rest and the rest step 2 px down / up in turn (its two digit sets). Sizes here: the
 *  same proportions to our digits (a normal digit DMG_SCALE of the sheet, ~34 px tall). */
const DMG_SCALE = 0.45, DMG_RISE = 39, DMG_SOLID = 250, DMG_LIFE = 750, DMG_ROW = 38, DMG_ROW_CRIT = 46, DMG_ZIG = 2.5;
/** A new number takes the lowest row whose number is gone or already fading (that one then fades out within DMG_GIVE_UP ms),
 *  so a column holds one attack's lines and never climbs away; at most DMG_ROWS rows. */
const DMG_GIVE_UP = 120, DMG_ROWS = 8;
/** One damage line on screen: rises from y; `quick` = it gave its row up (fading out from that age, from that alpha). */
interface DmgLine { t: Phaser.GameObjects.Container; age: number; x: number; y: number; crit: boolean; done?: boolean; quick?: { at: number; a: number } }
const dmgAlpha = (d: DmgLine): number => d.age < DMG_SOLID ? 1 : Math.max(0, 1 - (d.age - DMG_SOLID) / (DMG_LIFE - DMG_SOLID));
const GROUND = 2;

/** Archer sheets whose frame size differs from the slot default (w, h). */
const VFX_CELL: Record<string, [number, number]> = {
  hunters_roar: [512, 340], tree_of_life: [420, 560], hunters_spirit: [300, 300], arrow_storm: [512, 256], eagle_arrow: [512, 352], sky_rain: [768, 256],
};
/** Archer sheets drawn for a figure facing right: ground line as a fraction of the cell height. */
const ARCHER_GROUND: Record<string, number> = { rising_arrow: 0.94, leaping_arrow: 0.89, bow_haste: 0.89, wind_leap: 0.91, hunters_spirit: 0.84, tree_of_life: 0.955 };
/** Archer skills whose effect is played by its own timeline (not the generic cast sprite). */
const ARCHER_OWN = new Set(['rising_arrow', 'leaping_arrow', 'retreat_kick', 'bow_haste', 'hunters_roar', 'spirit_hawk', 'tree_of_life', 'hunters_spirit', 'arrow_storm', 'sky_rain', 'eagle_arrow']);
/** Ultimate cut-in art per skill. */
const CUTIN: Record<string, string> = { titans_verdict: 'titan-cutin', sky_rain: 'archer-cutin' };

/** Orientation of each final VFX sheet: 'dir' sheets are drawn pointing right and rotate with the aim. */
/** Upright sheets whose bottom edge is the ground line (drawn standing on the impact point). */
/** Ground-point origin (fraction of the cell height) for sheets drawn standing on the impact point. */
const GROUND_ANCHORED = new Map<string, number>([['titans_verdict', 0.97], ['rising_slash', 0.84], ['ground_breaker', 0.8], ['whirlwind', 0.56], ['leap_crash', 0.88], ['war_cry', 0.88]]);
/** Frames played during startup (anticipation) — the next frame is the impact at active start. */
const PRE_FRAMES: Record<string, number> = { titans_verdict: 4 };
/** Sheets whose frame count differs from the slot default. */
const VFX_FRAMES: Record<string, number> = { titans_verdict: 12 };
const UPRIGHT = new Set(['rising_slash', 'iron_grip', 'leap_crash', 'war_cry', 'titans_verdict', 'ground_breaker', 'whirlwind', 'shield_slam', 'blade_storm', 'binding_rune', 'astral_burst', 'frost_nova', 'storm_field',
  'time_collapse', 'explosive_arrow', 'vine_trap', 'rain_of_arrows', 'spin_cut']);
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

/** Skill effects of the given classes (all classes when omitted: the PvP arena can hold any class); shared sheets always. */
export function preloadSkillFx(scene: Phaser.Scene, classes?: readonly string[]): void {
  const want = (cls: string) => !classes || classes.includes(cls);
  const L = (k: string, p: string, w: number, h = w) => { if (!scene.textures.exists(k)) scene.load.spritesheet(k, p, { frameWidth: w, frameHeight: h }); };
  for (const s of FINAL_SKILLS) { if (VFX_ALIAS[s.id] || !want(s.cls)) continue; const big = isBig(s) ? 384 : 256, c = VFX_CELL[s.id]; L(vfxKey(s.id), `${F}/skills/${s.cls}/${s.id}/vfx.png`, c?.[0] ?? big, c?.[1] ?? big); }
  for (const [id, p] of Object.entries(PROJECTILE_SHEETS)) { const cls = FINAL_SKILLS.find((s) => s.id === id)!.cls; if (want(cls)) L(`proj-${id}`, `${F}/projectiles/${cls}/${id}.png`, p.cell); }
  for (const v of Object.values(IMPACT)) L(v.key, v.path, v.cell);
  const I = (k: string, p: string) => { if (!scene.textures.exists(k)) scene.load.image(k, p); };
  I('tg-circle', `${F}/world/telegraph_circle.png`); I('tg-cone', `${F}/world/telegraph_cone.png`);
  I('tg-line', `${F}/world/telegraph_line.png`); I('tg-traj', `${F}/world/telegraph_trajectory.png`);
  I('magic-circle', `${F}/impact/magic_circle.png`); I('dmg-glow', `${F}/ui/hud/damage_glow.png`);
  L('dmg-n', `${F}/ui/hud/dmg_normal.png`, DIGITS.cell[0], DIGITS.cell[1]); L('dmg-c', `${F}/ui/hud/dmg_crit.png`, DIGITS.cell[0], DIGITS.cell[1]); // MapleStory damage digits (tools/ui/damage_digits.py)
  // passive-skill sheets shared by the warrior and the archer (heal sparkle, stance ring, chains, target mark)
  if (want('warrior') || want('archer')) for (const k of ['heal_sparkle', 'stance_ring', 'chains_break', 'target_mark']) if (!scene.textures.exists(`pas-${k}`)) scene.load.spritesheet(`pas-${k}`, `${F}/skills/warrior/passives/${k}.png`, { frameWidth: 256, frameHeight: 256 });
  if (want('archer')) {
    L('vfx-wind_leap', `${F}/skills/archer/wind_leap/vfx.png`, 256); L('vfx-evasion', `${F}/skills/archer/evasion/vfx.png`, 256);
    I('archer-cutin', `${F}/skills/archer/sky_rain/cutin.png`);
  }
  if (!want('warrior')) return;
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
  for (const k of ['war_leap_burst', 'final_slash', 'combo_orb', 'heal_sparkle', 'stance_ring', 'chains_break', 'target_mark', 'iron_oath_cast', 'banner_plant', 'banner_wave']) if (!scene.textures.exists(`pas-${k}`)) scene.load.spritesheet(`pas-${k}`, `${F}/skills/warrior/passives/${k}.png`, { frameWidth: 256, frameHeight: 256 }); // passive skills
  if (!scene.textures.exists('phantom-blade')) scene.load.spritesheet('phantom-blade', `${F}/skills/warrior/blade_storm/phantom.png`, { frameWidth: 256, frameHeight: 256 });
}

interface Anim { glow?: Phaser.GameObjects.Image; img: Phaser.GameObjects.Image; /** next frame dissolving in over the current one */ mix?: Phaser.GameObjects.Image; t: number; total: number; frames: number[]; frameMs: number[]; follow?: () => V3 | null; z?: number; fadeLast?: number; onDone?: () => void; loop?: [number, number]; until?: number; /** ms per looped frame (default 70) */ loopMs?: number }
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
  private texts: DmgLine[] = [];
  private dark?: Phaser.GameObjects.Rectangle;
  private darkLeft = 0;
  private dmgSeq = 0;
  /** Per target, the rows above its head: the number in each (MapleStory: a new attack's number starts above the head). */
  private dmgCols: { x: number; y: number; last: number; rows: (DmgLine | null)[] }[] = [];
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

  /** The caster fights bare-handed (no weapon worn): the basic attack is a punch, no blade trail. */
  unarmed: ((casterId: string) => boolean) | null = null;

  private onCast(r: CastRun): void {
    const s = r.skill;
    if (s.id === 'warrior_basic') return; // MapleStory: a regular attack has no effect of its own — the sword leaves its afterimage (ActorView)
    if (ARCHER_OWN.has(s.id)) { // archer skills with their own art timeline
      if (s.telegraph && s.slot !== 7) this.telegraph(r);
      this.archerCast(r);
      if (s.slot === 7) this.ultimateStage(r);
      return;
    }
    if ((s.telegraph || isBig(s)) && s.cls !== 'warrior') this.telegraph(r); // warrior skills read through their own art: no red ground markers
    // Anticipation frames 0..k during startup at the cast point, release frame exactly at the active start.
    const shape = this.firstShape(s);
    if (s.id === 'wave_slash') { this.chargeUp(r); return; }
    if (shape.kind === 'projectile' || shape.kind === 'chain') { this.castFlare(r); return; }
    if (s.id === 'judgment_blade') this.judgment(r);
    else if (s.id === 'guard_counter') this.aegis(r);
    else if (s.id === 'war_cry') this.roar(r);
    else if (s.id === 'iron_oath') this.oathSigil(r);
    else if (s.id === 'legacy_banner') { // planted in front of the caster where the sword comes down (every client sees it)
      const side = r.aim.x < 0 ? -1 : 1, bx = r.origin.x + side * 70, by = r.origin.y;
      this.scene.time.delayedCall(Math.round(r.timings.startup * 0.7), () => this.bannerPlant(bx, by, 8000));
    }
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

  /** Iron Oath: the heart-and-sword sigil rises around the caster and pulses out (follows the caster). */
  private oathSigil(r: CastRun): void {
    if (!this.scene.textures.exists('pas-iron_oath_cast')) return;
    const c = () => this.casterPos(r.attackerId);
    const p = c(); if (!p) return;
    const img = this.scene.add.image(p.x, p.y - p.z, 'pas-iron_oath_cast', 0).setOrigin(0.5, 0.96).setDisplaySize(250, 250).setDepth(p.y - 1);
    const total = r.timings.startup + r.timings.active + r.timings.recovery, fms = [0.1, 0.1, 0.12, 0.14, 0.14, 0.14, 0.13, 0.13].map((f) => Math.round(f * total));
    this.anims.push({ img, t: 0, total: fms.reduce((a, b) => a + b, 0), frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: fms, fadeLast: 160,
      follow: () => { const q = c(); if (q) img.setDepth(q.y - 1); return q ? { x: q.x, y: q.y + 4, z: q.z } : null; } });
  }

  /** Legacy Banner: a banner of light falls and plants beside the caster, then waves in place for `holdMs`. */
  bannerPlant(x: number, y: number, holdMs: number): void {
    if (!this.scene.textures.exists('pas-banner_plant')) return;
    const SINK = 16;
    const img = this.scene.add.image(x, y + 4, 'pas-banner_plant', 0).setOrigin(0.5, 1).setDisplaySize(230, 230).setDepth(y);
    const mix = this.scene.add.image(x, y + 4, 'pas-banner_plant', 1).setOrigin(0.5, 1).setDisplaySize(230, 230).setDepth(y + 0.001).setAlpha(0);
    const dissolve = (key: string, next: number, f: number) => { const k = f * f * (3 - 2 * f); if (mix.texture.key !== key) mix.setTexture(key).setDisplaySize(230, 230); mix.setFrame(next).setAlpha(img.alpha * k); };
    const plant = [50, 50, 60, 80, 90, 100, 110, 120];
    let i = 0, t = 0, phase: 'plant' | 'wave' | 'fade' = 'plant', waveT = 0; // eslint-disable-line prefer-const
    this.spark(IMPACT.warrior.key, x, y - 20, IMPACT.warrior.frames, 170, 0.9, 0);
    const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      t += 16;
      if (phase === 'plant') {
        while (i < 7 && t >= plant[i]) { t -= plant[i]; i++; img.setFrame(i); if (i === 2) { this.shockwave(x, y, 150, 0xffd27a); this.dust(x, y, 90, 0.8); } }
        if (i >= 7 && t >= plant[7]) { phase = 'wave'; t = 0; img.setTexture('pas-banner_wave', 0).setDisplaySize(230, 230).setY(y + 4 + SINK); mix.setY(y + 4 + SINK); } // the waving art ends at the spear tip: sink it into the floor
        else if (i < 7) dissolve('pas-banner_plant', i + 1, Math.min(1, t / plant[i])); else { mix.setY(y + 4 + SINK); dissolve('pas-banner_wave', 0, Math.min(1, t / plant[7])); }
      } else if (phase === 'wave') {
        waveT += 16; const q = waveT / 160, wi = Math.floor(q) % 8; img.setFrame(wi); dissolve('pas-banner_wave', (wi + 1) % 8, q - Math.floor(q));
        if (waveT >= holdMs) { phase = 'fade'; this.scene.tweens.add({ targets: [img, mix], alpha: 0, duration: 500, onComplete: () => { ev.remove(); img.destroy(); mix.destroy(); } }); }
      }
    } });
  }

  /** One passive-skill sheet (8 frames, 256 cells) played once; `follow` keeps it on a moving body. */
  passiveFx(key: 'heal_sparkle' | 'stance_ring' | 'chains_break' | 'target_mark', at: V3, size: number, opts: { originY?: number; depth?: number; follow?: () => V3 | null; ms?: number[]; normal?: boolean; tint?: number } = {}): void {
    if (!this.scene.textures.exists(`pas-${key}`)) return;
    const img = this.scene.add.image(at.x, at.y - at.z, `pas-${key}`, 0).setOrigin(0.5, opts.originY ?? 0.5).setBlendMode(opts.normal ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD).setDisplaySize(size, size).setDepth(opts.depth ?? at.y + 2);
    if (opts.tint !== undefined) img.setTint(opts.tint);
    const fms = opts.ms ?? [50, 50, 60, 70, 70, 80, 90, 100];
    this.anims.push({ img, t: 0, total: fms.reduce((p, q) => p + q, 0), frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: fms, fadeLast: 100, follow: opts.follow, z: 0 });
  }

  /** Final Attack: an extra crescent slash of light across the target (sheet slashes top-left → bottom-right). `big` = Advanced. */
  finalSlash(at: V3, dir: number, big = false): void {
    const x = at.x, y = at.y - at.z - 40;
    if (this.scene.textures.exists('pas-final_slash')) {
      const img = this.scene.add.image(x, y, 'pas-final_slash', 0).setDepth(TOP + 5).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(big ? 120 : 96, big ? 120 : 96).setFlipX(dir < 0).setAlpha(0.7).setData('a0', 0.7); // (delicate, as a regular attack's)
      const fms = [30, 30, 40, 50, 50, 50, 60, 70];
      this.anims.push({ img, t: 0, total: fms.reduce((p, q) => p + q, 0), frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: fms, fadeLast: 70 });
    }
  }

  /** War Leap: burst of wind under the feet (sheet faces right; streaks blow behind). */
  leapBurst(x: number, y: number, dir: number): void {
    if (!this.scene.textures.exists('pas-war_leap_burst')) { this.shockwave(x, y, 46, 0xdff4ff); return; }
    const img = this.scene.add.image(x - dir * 10, y, 'pas-war_leap_burst', 0).setOrigin(0.5, 0.55).setDepth(y + 1).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(200, 200).setFlipX(dir < 0);
    const fms = [35, 35, 45, 50, 55, 60, 70, 80];
    this.anims.push({ img, t: 0, total: fms.reduce((p, q) => p + q, 0), frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: fms, fadeLast: 80 });
  }

  /** DFO-style callout above a target (COUNTER!! / BACK ATTACK!!). */
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
    const cutKey = CUTIN[r.skill.id];
    if (cutKey && this.scene.textures.exists(cutKey)) {
      const v = cam.worldView, w = v.width * 0.9, cy = v.y + v.height * 0.42;
      const img = this.scene.add.image(v.x - w / 2, cy, cutKey).setDepth(TOP + 50); // slides in from the left
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
    if (r.skill.id === 'titans_verdict' && this.scene.textures.exists('titan-tear')) this.scene.time.delayedCall(1240, () => {
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
    if (p.skill.id === 'eagle_arrow' && this.scene.textures.exists('vfx-eagle_arrow')) { // the spirit eagle itself flies (looping wing beat)
      const img = this.scene.add.image(p.x, p.y - p.z, 'vfx-eagle_arrow', 0).setDepth(p.y).setBlendMode(Phaser.BlendModes.ADD).setOrigin(p.dx < -0.01 ? 0.14 : 0.86, 0.55)
        .setDisplaySize(250, 172).setFlipX(p.dx < -0.01);
      this.projs.set(p, img);
      return;
    }
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
  confirmed(s: FinalSkill, hit: HitEvent, at: V3, damage: number, reaction: string, local: boolean, combo: number, crit = false): void {
    const tier = tierOf(s, hit);
    const k = IMPACT[s.cls] ?? IMPACT.warrior;
    const im = s.cls === 'warrior' ? 0.8 : 1; // MapleStory: a small, quick hit spark on the target (no flash over the body)
    if (s.id !== 'warrior_basic') this.spark(k.key, at.x, at.y - at.z - 38, k.frames, k.size * im * (tier === 'ultimate' ? 1.4 : hit.heavy ? 1.15 : 1), 0.8); // (a regular attack: none, as in MapleStory)
    // Ground dust only where the skill has no ground impact art of its own (kept subtle).
    if (tier !== 'ultimate' && reaction === 'launch') this.spark(IMPACT.dust.key, at.x, at.y + 4, 6, 90, 0.5);
    if (tier !== 'ultimate' && (reaction === 'knockdown' || reaction === 'slam')) this.spark(IMPACT.dust.key, at.x, at.y + 6, 6, 110, 0.55);
    if (damage > 0) this.damageNumber(at, damage, hit.heavy || tier === 'ultimate' || tier === 'signature', combo, local, crit);
    if (local) {
      const multi = (s.chain ? 1 : s.hits.length) > 3 && !hit.heavy; // rapid multi-hits: lighter per-hit freeze
      this.hitStopLeft = Math.max(this.hitStopLeft, HITSTOP[tier] * (multi ? 0.45 : 1) + (hit.heavy && tier === 'core' ? 20 : 0));
      const [d, i] = SHAKE[tier];
      if (tier !== 'basic' || hit.heavy) this.scene.cameras.main.shake(d, i);
    }
  }

  /** MapleStory damage: each hit of a burst stacks one line higher above the target; chubby, puffy digits — orange for a
   *  normal hit; a critical one bigger, pink-red, with the critical star at its left (no "CRITICAL" text). */
  damageNumber(at: V3, dmg: number, heavy: boolean, combo: number, local = false, crit = false): void {
    // The target's column: the lowest row free (its number gone, or already fading: that one gives the row up) — a burst's
    // lines stack up one row each, a new attack starts again just above the head; a row sits one line above the row
    // below, where that line is now (they all rise at one speed: the spacing stays).
    const now = this.scene.time.now, hy = at.y - at.z;
    this.dmgCols = this.dmgCols.filter((d) => now - d.last < 1500);
    let col = this.dmgCols.find((d) => Math.abs(d.x - at.x) < 160 && Math.abs(d.y - hy) < 120);
    if (!col) { col = { x: at.x, y: hy, last: now, rows: [] }; this.dmgCols.push(col); }
    col.last = now;
    const live = (d: DmgLine | null | undefined): d is DmgLine => !!d && !d.done && !d.quick;
    let line = 0;
    while (line < DMG_ROWS - 1 && live(col.rows[line]) && col.rows[line]!.age < DMG_SOLID) line++;
    const old = col.rows[line];
    if (live(old)) old.quick = { at: old.age, a: dmgAlpha(old) };
    const below = line > 0 ? col.rows[line - 1] : null;
    const x = col.x, y = live(below) ? below.y - (DMG_RISE * below.age) / 1000 - (below.crit ? DMG_ROW_CRIT : DMG_ROW) : hy - 96;
    const column = { put: (d: DmgLine) => { col!.rows[line] = d; } };
    const c = this.scene.add.container(x, y).setDepth(TOP + 20 + line * 0.01);
    const sk = local ? this.damageSkin : null;
    void heavy;
    if (sk && this.scene.textures.exists(sk.key)) { // cash-shop damage skin: painted digits (its own critical mark)
      const H = crit ? 74 : 60, sc = H / sk.cell[1], digits = String(dmg).split('').map(Number);
      const adv = digits.map((d) => sk.widths[d] * sc * 0.86), total = adv.reduce((a, b) => a + b, 0);
      if (crit) c.add(this.scene.add.image(-total / 2 - H * 0.35, -4, sk.key, 10).setScale(sc * 1.05));
      let xx = -total / 2;
      digits.forEach((d, i) => { c.add(this.scene.add.image(xx + adv[i] / 2, (i % 2 ? 2 : -2), sk.key, d).setScale(sc)); xx += adv[i]; });
      const rec: DmgLine = { t: c, age: 0, x, y, crit }; this.texts.push(rec); column.put(rec);   // (appears at once, like the digits below)
      return;
    }
    const dk = crit ? 'dmg-c' : 'dmg-n';
    if (this.scene.textures.exists(dk)) { // chubby, puffy digits: every outline first, then the fills (one piece, like Maple)
      // MapleStory's proportions: a critical's digits x1.18 a normal one, the first digit bigger (x1.1, a critical's x1.36)
      const ds = String(dmg).split('').map(Number), sc0 = DMG_SCALE * (crit ? 1.18 : 1);
      const scs = ds.map((_, i) => (i === 0 ? sc0 * (crit ? 1.36 / 1.18 : 1.1) : sc0)), xs: number[] = [];
      let xx = 0; ds.forEach((d, i) => { xs.push(xx); xx += DIGITS.widths[d] * (1 - DIGITS.overlap) * scs[i]; });
      const total = xs[xs.length - 1] + DIGITS.widths[ds[ds.length - 1]] * scs[ds.length - 1];
      const cx = (i: number) => xs[i] + (DIGITS.widths[ds[i]] * scs[i]) / 2 - total / 2, cy = (i: number) => (i === 0 ? 0 : i % 2 ? DMG_ZIG : -DMG_ZIG);
      if (crit) c.add(this.scene.add.image(-total / 2 + 2, -4, this.critMark()).setDisplaySize(76, 76).setBlendMode(Phaser.BlendModes.ADD)); // the critical star, behind the first digit
      ds.forEach((d, i) => c.add(this.scene.add.image(cx(i), cy(i), dk, 10 + d).setScale(scs[i])));
      ds.forEach((d, i) => c.add(this.scene.add.image(cx(i), cy(i), dk, d).setScale(scs[i])));
    } else {
      const txt = this.scene.add.text(0, 0, String(dmg), {
        fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: crit ? '42px' : '32px',
        color: '#ffffff', stroke: crit ? '#4a0626' : '#3a1a00', strokeThickness: crit ? 7 : 6, resolution: 2,
      }).setOrigin(0.5);
      const g = txt.context.createLinearGradient(0, 0, 0, txt.height);
      if (crit) { g.addColorStop(0, '#ffe8f3'); g.addColorStop(0.42, '#ff78b6'); g.addColorStop(1, '#e2145f'); } // critical: pink-red
      else { g.addColorStop(0, '#ffe9b0'); g.addColorStop(0.5, '#ffab3a'); g.addColorStop(1, '#ff7a1a'); }          // normal: orange
      txt.setFill(g);
      txt.setShadow(0, 3, '#000000', 4, true, true);
      if (crit) c.add(this.scene.add.image(-txt.width / 2 - 2, -4, this.critMark()).setDisplaySize(62, 62).setBlendMode(Phaser.BlendModes.ADD));
      c.add(txt);
    }
    const rec: DmgLine = { t: c, age: 0, x, y, crit }; this.texts.push(rec); column.put(rec);   // appears at once (no pop)
    void combo;
  }

  /** The critical star (MapleStory): a white-gold four-point burst with short rays between, in a soft glow. */
  private critMark(): string {
    const key = 'dmg-crit-star';
    if (this.scene.textures.exists(key)) return key;
    const S = 128, h = S / 2, t = this.scene.textures.createCanvas(key, S, S);
    if (!t) return '__DEFAULT';
    const ctx = t.getContext();
    const glow = ctx.createRadialGradient(h, h, 0, h, h, h);
    glow.addColorStop(0, 'rgba(255,250,215,0.9)'); glow.addColorStop(0.3, 'rgba(255,214,110,0.45)'); glow.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S);
    const fill = ctx.createRadialGradient(h, h, 0, h, h, h * 0.95);
    fill.addColorStop(0, '#ffffff'); fill.addColorStop(0.35, '#fff6c2'); fill.addColorStop(1, '#ffb52a');
    const star = (r0: number, r1: number, rot: number) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? r1 : r0, a = rot + (i * Math.PI) / 4; ctx.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r); }
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    };
    star(h * 0.62, h * 0.12, Math.PI / 4 - Math.PI / 2); // the short rays (diagonals)
    star(h * 0.98, h * 0.14, -Math.PI / 2);             // the long rays (up, down, left, right)
    t.refresh();
    return key;
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
    this.stepHawks(ms);
    if (this.hitStopLeft > 0) this.hitStopLeft = Math.max(0, this.hitStopLeft - ms);
    this.anims = this.anims.filter((a) => {
      a.t += step;
      let tt = a.t, idx = a.frames.length - 1;
      if (a.loop && a.until !== undefined && a.t < a.until) {
        const pre = a.frameMs.slice(0, a.frames.indexOf(a.loop[0])).reduce((x, y) => x + y, 0);
        if (a.t >= pre) { const span = a.loop[1] - a.loop[0] + 1, q = (a.t - pre) / (a.loopMs ?? 70), i = Math.floor(q) % span; a.img.setFrame(a.loop[0] + i); this.place(a); this.blend(a, a.loop[0] + ((i + 1) % span), q - Math.floor(q)); return true; }
      } else if (a.loop && a.until !== undefined) tt = a.total - a.frameMs[a.frameMs.length - 1] + (a.t - a.until);
      if (tt >= a.total) { a.img.destroy(); a.glow?.destroy(); a.mix?.destroy(); a.onDone?.(); return false; }
      let acc = 0, start = 0;
      for (let i = 0; i < a.frames.length; i++) { acc += a.frameMs[i]; if (tt < acc) { idx = i; start = acc - a.frameMs[i]; break; } }
      a.img.setFrame(a.frames[idx]); if (idx > 0 && !a.img.visible) a.img.setVisible(true);
      if (a.fadeLast && tt > a.total - a.fadeLast) a.img.setAlpha(Math.max(0, (a.total - tt) / a.fadeLast) * (a.img.getData('a0') ?? 1));
      this.place(a);
      if (a.glow) a.glow.setFrame(a.frames[idx]).setPosition(a.img.x, a.img.y).setScale(a.img.scaleX * 1.12, a.img.scaleY * 1.12).setAlpha(a.img.alpha * 0.45);
      this.blend(a, idx + 1 < a.frames.length ? a.frames[idx + 1] : null, (tt - start) / Math.max(1, a.frameMs[idx]));
      return true;
    });
    for (const t of this.teles) if (t.follow) { const c = this.casterPos(t.run.attackerId); if (c) t.g.setPosition(c.x, c.y); }
    for (const p of projectiles) {
      const img = this.projs.get(p);
      if (!img) continue;
      img.setPosition(p.x, p.y - p.z).setDepth(projDepth(p));
      if (p.skill.id === 'eagle_arrow') { img.setFrame(Math.floor(p.ageMs / 60) % 8); continue; } // flipped, never rotated: the eagle flies level
      const id = PROJ_ALIAS[p.skill.id] ?? p.skill.id;
      img.setFrame(Math.floor((p.ageMs * 24) / 1000) % (PROJECTILE_SHEETS[id]?.frames ?? 8));
    }
    this.texts = this.texts.filter((d) => { // damage numbers rise at one speed: solid, then fading out
      d.age += ms;
      d.t.setPosition(d.x, d.y - (DMG_RISE * d.age) / 1000);
      const a = d.quick ? d.quick.a * Math.max(0, 1 - (d.age - d.quick.at) / DMG_GIVE_UP) : dmgAlpha(d);
      d.t.setAlpha(a);
      if (d.age >= DMG_LIFE || (d.quick && d.age - d.quick.at >= DMG_GIVE_UP)) { d.t.destroy(); d.done = true; return false; }
      return true;
    });
    if (this.dark && this.darkLeft > 0) {
      this.darkLeft -= ms;
      if (this.darkLeft <= 0) this.scene.tweens.add({ targets: this.dark, fillAlpha: 0, duration: 200 });
    }
  }

  /** Smooth frame changes: the next frame dissolves in over the current one (no hard frame-to-frame cuts). */
  private blend(a: Anim, next: number | string | null, f: number): void {
    const im = a.img;
    if (next === null || !im.visible || f <= 0.02 || String(next) === String(im.frame.name)) { a.mix?.setVisible(false); return; }
    if (!a.mix) a.mix = this.scene.add.image(im.x, im.y, im.texture.key, next).setBlendMode(im.blendMode);
    const m = a.mix, k = Math.min(1, f) * Math.min(1, f) * (3 - 2 * Math.min(1, f)); // smoothstep
    if (m.texture.key !== im.texture.key) m.setTexture(im.texture.key);
    m.setFrame(next).setOrigin(im.originX, im.originY).setScale(im.scaleX, im.scaleY).setFlip(im.flipX, im.flipY).setRotation(im.rotation)
      .setPosition(im.x, im.y).setDepth(im.depth + 0.001).setAlpha(im.alpha * k).setVisible(true);
    if (im.isTinted) m.setTint(im.tintTopLeft); else m.clearTint();
  }

  private place(a: Anim): void {
    if (!a.follow) return;
    const p = a.follow();
    if (p) a.img.setPosition(p.x, p.y - p.z);
  }

  // ------------------------------------------------------------------ archer

  /** Spirit hawks by caster: hovers above / behind its archer, flaps in a loop, dives at a foe on every attack. */
  private hawks = new Map<string, { img: Phaser.GameObjects.Image; until: number; t: number; lastX: number; face: number; dive: { to: V3; t: number } | null }>();

  /** One archer sheet timeline (any cell size). */
  private play(key: string, x: number, y: number, w: number, h: number, fms: number[], o: { ox?: number; oy?: number; flip?: boolean; depth?: number; blend?: number; follow?: () => V3 | null; z?: number; frames?: number[]; loop?: [number, number]; until?: number; fadeLast?: number; alpha?: number; loopMs?: number } = {}): Phaser.GameObjects.Image | null {
    if (!this.scene.textures.exists(key)) return null;
    const img = this.scene.add.image(x, y, key, 0).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setDisplaySize(w, h).setFlipX(!!o.flip).setDepth(o.depth ?? y)
      .setBlendMode(o.blend ?? Phaser.BlendModes.SCREEN).setAlpha(o.alpha ?? 1); // screen: bright art never blows out the sunny floor
    if (o.alpha !== undefined) img.setData('a0', o.alpha);
    const frames = o.frames ?? fms.map((_, i) => i);
    this.anims.push({ img, t: 0, total: fms.reduce((a, b) => a + b, 0), frames, frameMs: fms, follow: o.follow, z: o.z, fadeLast: o.fadeLast ?? 120, loop: o.loop, until: o.until, loopMs: o.loopMs });
    return img;
  }

  private archerCast(r: CastRun): void {
    const s = r.skill, o = r.origin, a = r.aim, T = r.timings, left = a.x < -0.01, side = left ? -1 : 1, key = vfxKey(s.id);
    const me = () => this.casterPos(r.attackerId);
    const at = (dx: number, dz = 0) => { const p = me(); return p ? { x: p.x + side * dx, y: p.y, z: p.z + dz } : null; };
    const spread = (n: number, total: number, w = [1, 1, 1.1, 1.2, 1.2, 1.3, 1.4, 1.6]) => { const sum = w.slice(0, n).reduce((p, q) => p + q, 0); return w.slice(0, n).map((q) => Math.round((q / sum) * total)); };
    switch (s.id) {
      case 'rising_arrow': case 'leaping_arrow': { // erupts from the ground point in front of the archer
        const sh = s.hits[0].shape as { bias?: number; radius: number }, bx = o.x + a.x * (sh.bias ?? 90), by = o.y + a.y * (sh.bias ?? 90);
        const size = s.id === 'leaping_arrow' ? 330 : 280;
        const pre = [T.startup * 0.5, T.startup * 0.5], rest = spread(6, T.active + 260, [1, 1, 1.1, 1.3, 1.5, 1.8]);
        this.play(key, bx, by - o.z, size, size, [...pre, ...rest], { oy: ARCHER_GROUND[s.id], flip: left, depth: by + 1, blend: Phaser.BlendModes.SCREEN });
        this.scene.time.delayedCall(T.startup, () => { this.shockwave(bx, by, s.id === 'leaping_arrow' ? 130 : 90, 0x9be35a); this.dust(bx, by, 90, 0.7); });
        break;
      }
      case 'retreat_kick': { // a rising crescent in front of the kick (then the archer flips away)
        const kx = o.x + a.x * 50, ky = o.y + a.y * 20;
        this.play(key, kx, ky - o.z - 40, 240, 240, [T.startup / 2, T.startup / 2, ...spread(6, T.active + 120)], { flip: left, depth: TOP });
        break;
      }
      case 'bow_haste': case 'hunters_spirit': { // around the caster, standing on the floor
        const sz = s.id === 'hunters_spirit' ? 300 : 240, p = me() ?? o;
        this.play(key, p.x, p.y - p.z, sz, sz, spread(8, T.startup + T.active + T.recovery + 200), { oy: ARCHER_GROUND[s.id], depth: p.y + 1, follow: () => { const q = me(); return q ? { x: q.x, y: q.y + 1, z: q.z } : null; } });
        break;
      }
      case 'hunters_roar': { // the wolf spirit roars over the archer; the wave reaches both sides
        const p = me() ?? o;
        this.play(key, p.x, p.y - p.z - 96, 560, 372, [T.startup * 0.4, T.startup * 0.6, 90, 130, 140, 150, 170, 200], { flip: left, depth: p.y - 2, alpha: 0.92, follow: () => { const q = me(); return q ? { x: q.x, y: q.y, z: q.z + 96 } : null; } }); // the wolf spirit stands behind the archer
        this.scene.time.delayedCall(T.startup, () => { const q = me() ?? o; this.shockwave(q.x, q.y, 320, 0x9be35a); this.scene.time.delayedCall(90, () => this.shockwave(q.x, q.y, 420, 0xffe27a)); (this.cam ?? this.scene.cameras.main).shake(220, 0.006); });
        break;
      }
      case 'spirit_hawk': {
        const p = me() ?? o;
        this.spark(IMPACT.archer.key, p.x, p.y - p.z - 90, IMPACT.archer.frames, 120, 0.9);
        const old = this.hawks.get(r.attackerId); old?.img.destroy();
        const img = this.scene.add.image(p.x, p.y - p.z - 110, key, 0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(130, 130).setAlpha(0);
        this.scene.tweens.add({ targets: img, alpha: 1, duration: 300 });
        const L = s.linger!;
        this.hawks.set(r.attackerId, { img, until: this.scene.time.now + L.startMs + L.everyMs * L.count, t: 0, lastX: p.x, face: side, dive: null });
        break;
      }
      case 'tree_of_life': { // grows beside the archer, sways while it heals, then fades
        const tx = o.x - side * 70, ty = o.y - 18, life = 12000, grow = [T.startup * 0.2, T.startup * 0.2, T.startup * 0.3, T.startup * 0.3, 160];
        this.play(key, tx, ty, 300, 400, [...grow, 420, 420, 700], { oy: ARCHER_GROUND.tree_of_life, depth: ty - 1, loop: [5, 6], loopMs: 900, until: T.startup + life, fadeLast: 650, blend: Phaser.BlendModes.NORMAL });
        const ring = this.scene.add.image(tx, ty, 'magic-circle').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9be35a).setAlpha(0).setDepth(GROUND + 1);
        ring.setDisplaySize(2 * 260, 2 * 260 * 0.42);
        this.scene.tweens.add({ targets: ring, alpha: 0.7, delay: T.startup, duration: 300 });
        this.scene.tweens.add({ targets: ring, angle: 90, delay: T.startup, duration: life });
        this.scene.tweens.add({ targets: ring, alpha: 0, delay: T.startup + life - 500, duration: 500, onComplete: () => ring.destroy() });
        this.scene.time.delayedCall(T.startup, () => { this.shockwave(tx, ty, 200, 0xb8ff9a); this.dust(tx, ty, 110, 0.6); });
        // the trunk is solid from the moment it grows (every client): walk around it or stand behind it, never on it
        this.scene.time.delayedCall(Math.round(T.startup * 0.6), () => SKILL_BLOCKERS.set(r.castId, { x: tx, y: ty, rx: 34, ry: 15 }));
        this.scene.time.delayedCall(T.startup + life, () => SKILL_BLOCKERS.delete(r.castId));
        break;
      }
      case 'arrow_storm': { // the stream pours from the bow for as long as the storm runs
        const img = this.play(key, 0, 0, 520, 260, [T.startup / 2, T.startup / 2, 70, 70, 70, 70, 70, 70], { ox: 0.03, oy: 0.5, flip: left, depth: TOP, loop: [2, 7], until: T.startup + T.active, fadeLast: 160,
          follow: () => { const q = me(); return q && r.phase !== 'done' ? { x: q.x + side * 30, y: q.y, z: q.z + 46 } : null; } });
        if (img) { // ends with the run (released key / cancelled): fade out at once
          const ev = this.scene.time.addEvent({ delay: 30, loop: true, callback: () => {
            if (!img.active) { ev.remove(); return; }
            if (r.phase === 'recovery' || r.phase === 'done') { ev.remove(); this.anims = this.anims.filter((x) => { if (x.img !== img) return true; x.mix?.destroy(); return false; }); this.scene.tweens.add({ targets: img, alpha: 0, duration: 140, onComplete: () => img.destroy() }); }
          } });
        }
        break;
      }
      case 'eagle_arrow': { const p = me() ?? o; this.spark(IMPACT.archer.key, p.x + side * 30, p.y - p.z - 44, IMPACT.archer.frames, 110, 0.9); break; }
      case 'sky_rain': this.skyRain(r); break;
    }
  }

  /** Sky Rain: after the cut-in the whole screen fills with arrows; the last wave flashes and shakes. */
  private skyRain(r: CastRun): void {
    const cam = this.cam ?? this.scene.cameras.main, T = r.timings;
    this.scene.time.delayedCall(T.startup, () => {
      const v = cam.worldView, h = v.height * 0.98, w = h * 3; // uniform scale: wider than the screen, never stretched
      const view = () => ({ x: cam.worldView.centerX, y: cam.worldView.bottom - cam.worldView.height * 0.02, z: 0 });
      this.play('vfx-sky_rain', v.centerX, v.bottom, w, h, [170, 170, 190, 210, 250, 240, 210, 230], { oy: 1, depth: TOP - 5, follow: view, fadeLast: 260 });
      this.scene.time.delayedCall(1400, () => {
        const f = this.scene.add.rectangle(0, 0, cam.width, cam.height, 0xd8ffc0, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(TOP + 45).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: f, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
        cam.shake(420, 0.012);
      });
    });
  }

  /** Wind Leap: a burst of wind and leaves under the feet (sheet faces right). */
  windLeap(x: number, y: number, dir: number): void { this.play('vfx-wind_leap', x - dir * 8, y, 190, 190, [35, 35, 45, 50, 55, 60, 70, 80], { oy: ARCHER_GROUND.wind_leap, flip: dir < 0, depth: y + 1 }); }

  /** Evasion: a rush of wind as the archer slips aside (sheet streams to the right). */
  evadeDash(x: number, y: number, dir: number): void { this.play('vfx-evasion', x, y - 50, 200, 200, [30, 35, 40, 45, 50, 55, 60, 70], { flip: dir < 0, depth: TOP }); }

  /** Extra Shot: a second arrow of wind streaks from the archer to the target. */
  extraArrow(from: V3, to: V3): void {
    const key = this.scene.textures.exists('proj-quick_shot') ? 'proj-quick_shot' : null;
    const ax = from.x, ay = from.y - from.z, bx = to.x, by = to.y - to.z;
    if (key) {
      const img = this.scene.add.image(ax, ay, key, 0).setDepth(TOP + 4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xb8ff9a).setDisplaySize(92, 92).setAngle(Math.atan2(by - ay, bx - ax) * (180 / Math.PI));
      this.scene.tweens.add({ targets: img, x: bx, y: by, duration: 120, onComplete: () => { img.destroy(); this.spark(IMPACT.archer.key, bx, by, IMPACT.archer.frames, 80, 0.9); } });
    } else this.spark(IMPACT.archer.key, bx, by, IMPACT.archer.frames, 80, 0.9);
  }

  /** Spirit Hawk dive: the hawk swoops onto the foe and back. */
  hawkDive(attackerId: string, to: V3): void { const h = this.hawks.get(attackerId); if (h) h.dive = { to, t: 0 }; }

  private stepHawks(ms: number): void {
    const now = this.scene.time.now;
    for (const [id, h] of this.hawks) {
      const c = this.casterPos(id);
      if (!c || now >= h.until) { this.hawks.delete(id); this.scene.tweens.add({ targets: h.img, alpha: 0, duration: 300, onComplete: () => h.img.destroy() }); continue; }
      h.t += ms;
      if (Math.abs(c.x - h.lastX) > 0.5) h.face = c.x > h.lastX ? 1 : -1;
      h.lastX = c.x;
      const homeX = c.x - h.face * 46, homeY = c.y - c.z - 112 + Math.sin(h.t / 260) * 6;
      let x = homeX, y = homeY, face = h.face;
      if (h.dive) { // 180 ms out, 220 ms back
        h.dive.t += ms;
        const tx = h.dive.to.x, ty = h.dive.to.y - h.dive.to.z, out = Math.min(1, h.dive.t / 180), back = Math.max(0, (h.dive.t - 180) / 220);
        face = tx >= homeX ? 1 : -1;
        if (back <= 0) { x = homeX + (tx - homeX) * out; y = homeY + (ty - homeY) * out; }
        else { x = tx + (homeX - tx) * back; y = ty + (homeY - ty) * back; face = -face; }
        if (h.dive.t >= 180 && h.dive.t - ms < 180) this.spark(IMPACT.archer.key, tx, ty, IMPACT.archer.frames, 100, 0.95);
        if (back >= 1) h.dive = null;
      }
      h.img.setPosition(x, y).setFlipX(face < 0).setDepth(c.y + 3).setFrame(Math.floor(h.t / 80) % 8);
    }
  }

  destroy(): void {
    SKILL_BLOCKERS.clear();
    for (const h of this.hawks.values()) h.img.destroy();
    this.hawks.clear();
    for (const a of this.anims) { a.img.destroy(); a.glow?.destroy(); a.mix?.destroy(); }
    for (const t of this.teles) t.g.destroy();
    for (const i of this.projs.values()) i.destroy();
    for (const l of this.traps.values()) for (const i of l) i.destroy();
    for (const d of this.texts) d.t.destroy();
    this.dark?.destroy();
    this.anims = []; this.teles = []; this.projs.clear(); this.traps.clear(); this.texts = []; this.dmgCols = [];
  }
}

/** Projectiles sort by ground y, but fly in front of a prop once higher than it. */
function projDepth(p: Projectile): number {
  for (const o of WORLD_OBJECTS) if (p.z >= o.height && p.y <= o.frontY) return Math.max(p.y, o.frontY + 1);
  return p.y;
}
