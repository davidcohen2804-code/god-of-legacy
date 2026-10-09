// Skill presentation (never gameplay authority): telegraphs drawn from the same shape data as the hitbox,
// anticipation → release → impact VFX timelines from the supplied final sheets, projectile sprites with continuous
// aim rotation, traps/zones, confirmed-hit impacts, damage numbers, hit-stop / camera-shake hierarchy.
import { GamblerFx } from './GamblerFx';
import type { Card, HandValue } from './Gamble';
import Phaser from 'phaser';
import { FinalSkill, HitEvent, HitShape } from './SkillTypes';
import { CastRun, RT_EVENTS, SkillRuntime, Trap } from './SkillRuntime';
import { Projectile, V2, V3, circleCentre } from './HitGeometry';
import { FINAL_SKILLS } from './FinalKit';
import DIGITS from '../data/damage-digits.json';
import { SamuraiFx, KIT, KIT_URL } from './SamuraiFx';
import { MageFx, MAGE_KIT, MAGE_KIT_URL } from './MageFx';
import { ArcherFx, ARCHER_KIT, ARCHER_KIT_URL } from './ArcherFx';
import { SKILL_BLOCKERS, WORLD_OBJECTS, clearLine } from '../world/WorldGeometry';

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
const ARCHER_OWN = new Set(['vine_trap', 'rain_of_arrows', 'rising_arrow', 'leaping_arrow', 'retreat_kick', 'bow_haste', 'hunters_roar', 'spirit_hawk', 'tree_of_life', 'hunters_spirit', 'arrow_storm', 'sky_rain', 'eagle_arrow', 'piercing_arrow']);
/** Ultimate cut-in art per skill. */
const CUTIN: Record<string, string> = { titans_verdict: 'titan-cutin', sky_rain: 'archer-cutin', dragon_eclipse: 'samurai-cutin', time_collapse: 'mage-cutin' };
/** Orientation of each final VFX sheet: 'dir' sheets are drawn pointing right and rotate with the aim. */
/** Upright sheets whose bottom edge is the ground line (drawn standing on the impact point). */
/** Ground-point origin (fraction of the cell height) for sheets drawn standing on the impact point. */
const GROUND_ANCHORED = new Map<string, number>([['titans_verdict', 0.97], ['rising_slash', 0.84], ['ground_breaker', 0.8], ['whirlwind', 0.56], ['leap_crash', 0.88], ['war_cry', 0.88], ['sky_breaker', 0.84], ['earthsplitter', 0.8]]);
/** Frames played during startup (anticipation) — the next frame is the impact at active start. */
const PRE_FRAMES: Record<string, number> = { titans_verdict: 4 };
/** Sheets whose frame count differs from the slot default. */
const VFX_FRAMES: Record<string, number> = { titans_verdict: 12 };
const UPRIGHT = new Set(['rising_slash', 'iron_grip', 'sky_breaker', 'earthsplitter', 'leap_crash', 'war_cry', 'titans_verdict', 'ground_breaker', 'whirlwind', 'shield_slam', 'blade_storm', 'binding_rune', 'astral_burst', 'frost_nova', 'storm_field',
  'time_collapse', 'explosive_arrow', 'vine_trap', 'rain_of_arrows', 'spin_cut']);
const PROJECTILE_SHEETS: Record<string, { cell: number; frames: number; ext?: string }> = {
  arcane_bolt: { cell: 128, frames: 8 }, lightning_chain: { cell: 192, frames: 8 }, quick_shot: { cell: 128, frames: 8 },
  piercing_arrow: { cell: 160, frames: 8 }, explosive_arrow: { cell: 160, frames: 8 }, wave_slash: { cell: 192, frames: 8 },
};
/** Projectile skills without a dedicated projectile sheet fly with a sibling's arrow (multi shot / skyhunter arrows). */
const PROJ_ALIAS: Record<string, string> = { multi_shot: 'quick_shot', skyhunters_step: 'quick_shot' };
const IMPACT: Record<string, { key: string; path: string; cell: number; frames: number; size: number }> = {
  warrior: { key: 'imp-warrior', path: `${F}/impact/warrior_steel.png`, cell: 256, frames: 6, size: 110 },
  book_mage: { key: 'imp-mage', path: `${F}/skills/book_mage/astral_burst/vfx.png`, cell: 256, frames: 8, size: 92 },
  archer: { key: 'imp-archer', path: `${F}/impact/archer_burst.png`, cell: 160, frames: 1, size: 78 },
  dust: { key: 'imp-dust', path: `${F}/impact/dust_pixel.png`, cell: 128, frames: 6, size: 96 },
  explosion: { key: 'imp-explosion', path: `${F}/impact/archer_explosion.png`, cell: 256, frames: 5, size: 190 },
};
export const CLASS_COLOR: Record<string, number> = { warrior: 0xffb04a, book_mage: 0x6fc8ff, archer: 0x9be35a, samurai: 0xff4a5a, gambler: 0xff2bd6 };

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

/** Archer art drawn in code: a glowing arrow (white core, tinted per skill), a soft glow, a light streak, a mote,
 *  an arrow stuck in the floor. White/grey so one texture serves every colour through tint. */
export function ensureArcherArt(scene: Phaser.Scene): void {
  const tx = scene.textures;
  if (!tx.exists('arch-arrow')) {
    const W = 200, H = 40, c = tx.createCanvas('arch-arrow', W, H)!, g = c.getContext(), cy = H / 2;
    const glow = g.createLinearGradient(0, 0, W, 0); glow.addColorStop(0, 'rgba(255,255,255,0)'); glow.addColorStop(0.45, 'rgba(255,255,255,0.35)'); glow.addColorStop(1, 'rgba(255,255,255,0.75)');
    g.fillStyle = glow; g.beginPath(); g.ellipse(W * 0.55, cy, W * 0.46, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(30, cy - 2, W - 64, 4); // shaft
    g.beginPath(); g.moveTo(W - 2, cy); g.lineTo(W - 40, cy - 11); g.lineTo(W - 32, cy); g.lineTo(W - 40, cy + 11); g.closePath(); g.fill(); // head
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(34, cy); g.lineTo(14, cy + sgn * 12); g.lineTo(4, cy + sgn * 12); g.lineTo(24, cy); g.closePath(); g.fill(); } // fletching
    c.refresh();
  }
  if (!tx.exists('arch-glow')) {
    const S = 128, c = tx.createCanvas('arch-glow', S, S)!, g = c.getContext(), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S); c.refresh();
  }
  if (!tx.exists('arch-streak')) {
    const W = 256, H = 24, c = tx.createCanvas('arch-streak', W, H)!, g = c.getContext();
    for (let x = 0; x < W; x++) { const a = Math.pow(x / W, 1.6); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, 0, 1, H); }
    c.refresh();
  }
  if (!tx.exists('arch-stuck')) { // an arrow stuck at an angle in the floor (feet of the image = the point in the ground)
    const W = 30, H = 64, c = tx.createCanvas('arch-stuck', W, H)!, g = c.getContext();
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(15, H - 4); g.lineTo(15, 12); g.stroke();
    g.fillStyle = '#b8f070'; for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(15, 18); g.lineTo(15 + sgn * 9, 6); g.lineTo(15 + sgn * 9, 0); g.lineTo(15, 10); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(15, H - 3, 9, 3, 0, 0, Math.PI * 2); g.fill();
    c.refresh();
  }
}

/** Floor perspective for top-down sheets laid on the ground (screen height per world unit of depth). */
const FLOOR_SQUASH = 0.72;
/** On-screen angle (deg) of something travelling along the floor: depth is foreshortened, so diagonal shots read flat. */
const screenAng = (dx: number, dy: number) => Math.atan2(dy * 0.5, dx) * (180 / Math.PI);
/** Per-skill arrow colour (outer glow tint). */
/** Side-view art (facing right) aimed along (dx, dy), level on screen; facing left = mirrored, never upside down. */
const level = (dx: number, dy: number): { ang: number; flip: boolean } => dx < -0.01 ? { flip: true, ang: Math.atan2(-dy * 0.5, -dx) * (180 / Math.PI) } : { flip: false, ang: Math.atan2(dy * 0.5, dx) * (180 / Math.PI) };
/** Archer effect sizes against the samurai's standard (a normal hit ~86px, a heavy one ~140, effects about the body's
 *  size): every archer piece drawn through play() is scaled by this. Gameplay-sized marks (mine, target, aim band,
 *  roots band, roar ring, the ultimate's field) keep their true size. */
const ARCHER_SIZE: Record<string, number> = {
  'afx-muzzle': 0.72, 'afx-fire': 0.72, 'afx-boot': 0.68, 'afx-kick': 0.7, 'afx-dive': 0.8, 'afx-heavy': 0.72, 'afx-rainfall': 0.72,
  'afx-rise': 0.9, 'afx-strike': 0.78, 'afx-tree2': 0.9, 'afx-volley': 0.68, 'afx-burst': 0.68, 'afx-gold': 0.9, 'afx-garrow': 0.8,
  'jb-bolt': 0.72, 'afx-bolt': 0.75,
};
const ARROW_TINT: Record<string, number> = { arrow_storm: 0xa8f04a, quick_shot: 0x7ee35a, multi_shot: 0xa8f04a, skyhunters_step: 0x9cffc8, piercing_arrow: 0x7ee35a, explosive_arrow: 0xffa040, extra: 0x9cf27a };
/** Per-skill arrow display length (px). */
const ARROW_LEN: Record<string, number> = { quick_shot: 120, multi_shot: 128, skyhunters_step: 120, piercing_arrow: 190, explosive_arrow: 150 };
/** Charge-up at the bow before release: [glow size, colour, camera shake on release]. */
const CHARGE: Record<string, [number, number, number]> = {
  multi_shot: [80, 0xa8f04a, 0], explosive_arrow: [100, 0xffa040, 0.003], piercing_arrow: [110, 0x7ee35a, 0], rising_arrow: [80, 0x7ee35a, 0],
  leaping_arrow: [150, 0x7ee35a, 0.004], eagle_arrow: [220, 0xffe27a, 0.008], arrow_storm: [90, 0xa8f04a, 0], skyhunters_step: [70, 0x9cffc8, 0],
  hunters_spirit: [110, 0xffe27a, 0], spirit_hawk: [100, 0xffe27a, 0], hunters_roar: [130, 0x7ee35a, 0], rain_of_arrows: [160, 0x5cd6ff, 0.004],
};

/** Skill effects of the given classes (all classes when omitted: the PvP arena can hold any class); shared sheets always. */
export function preloadSkillFx(scene: Phaser.Scene, classes?: readonly string[]): void {
  const want = (cls: string) => !classes || classes.includes(cls);
  const L = (k: string, p: string, w: number, h = w) => { if (!scene.textures.exists(k)) scene.load.spritesheet(k, p, { frameWidth: w, frameHeight: h }); };
  // (templates — wip skills — have no art loaded yet)
  for (const s of FINAL_SKILLS) { if (VFX_ALIAS[s.id] || s.wip || s.cls === 'samurai' || s.cls === 'book_mage' || s.cls === 'gambler' || !want(s.cls)) continue; const big = isBig(s) ? 384 : 256, c = VFX_CELL[s.id]; L(vfxKey(s.id), `${F}/skills/${s.cls}/${s.id}/vfx.png`, c?.[0] ?? big, c?.[1] ?? big); } // (the samurai: pieces, SamuraiFx)
  for (const [id, p] of Object.entries(PROJECTILE_SHEETS)) { const cls = FINAL_SKILLS.find((s) => s.id === id)!.cls; if (want(cls)) L(`proj-${id}`, `${F}/projectiles/${cls}/${id}.${p.ext ?? 'png'}`, p.cell); }
  for (const v of Object.values(IMPACT)) L(v.key, v.path, v.cell);
  const I = (k: string, p: string) => { if (!scene.textures.exists(k)) scene.load.image(k, p); };
  I('tg-circle', `${F}/world/telegraph_circle.png`); I('tg-cone', `${F}/world/telegraph_cone.png`);
  I('tg-line', `${F}/world/telegraph_line.png`); I('tg-traj', `${F}/world/telegraph_trajectory.png`);
  I('magic-circle', `${F}/impact/magic_circle.png`); I('dmg-glow', `${F}/ui/hud/damage_glow.png`);
  scene.load.on('loaderror', (f: { key: string }) => { if (/^afx-/.test(f.key) && scene.textures.exists(f.key)) scene.textures.remove(f.key); }); // a missing optional archer sheet stays absent
  L('dmg-n', `${F}/ui/hud/dmg_normal.png`, DIGITS.cell[0], DIGITS.cell[1]); L('dmg-c', `${F}/ui/hud/dmg_crit.png`, DIGITS.cell[0], DIGITS.cell[1]); // MapleStory damage digits (tools/ui/damage_digits.py)
  // passive-skill sheets shared by the warrior and the archer (heal sparkle, stance ring, chains, target mark)
  if (want('warrior') || want('archer') || want('samurai')) for (const k of ['heal_sparkle', 'stance_ring', 'chains_break', 'target_mark']) if (!scene.textures.exists(`pas-${k}`)) scene.load.spritesheet(`pas-${k}`, `${F}/skills/warrior/passives/${k}.png`, { frameWidth: 256, frameHeight: 256 });
  if (want('gambler')) for (const n of ['card_back', 'card_face', 'card_S', 'card_H', 'card_D', 'card_C', 'card_ace', 'card_joker', 'k_streak', 'k_charge', 'k_pop', 'k_blast', 'k_ring', 'k_beam', 'k_vortex', 'k_arcs', 's_swing', 's_heavy', 's_disc', 's_thrust', 's_rise', 's_vault', 's_homerun', 's_crack', 'c_wheel', 'c_ball', 'c_die_a', 'c_die_b', 'c_coin_h', 'c_coin_t', 'c_chip', 'c_stack', 'j_slot', 'j_cherry', 'j_bell', 'j_star', 'j_clover', 'j_ring', 'j_fountain', 'j_jackpot', 'x_lance', 'x_comet', 'x_grip', 'x_seal', 'x_erupt', 'x_aura', 'x_tornado', 'x_cross']) I(`gbk-${n}`, `${F}/skills/gambler/kit/${n}.png`); // the gambler's painted cards (tools/skills/gambler_kit.py)
  if (want('archer')) {
    ensureArcherArt(scene);
    L('vfx-wind_leap', `${F}/skills/archer/wind_leap/vfx.png`, 256);
    const AF = `${F}/skills/archer/fx`; // shared archer layers (impact / charge / blast) and the top-down floor sheets
    L('afx-impact', `${AF}/arrow_impact.png`, 256); L('afx-impact-b', `${AF}/arrow_impact_b.png`, 256); L('afx-charge', `${AF}/bow_charge.png`, 256);
    L('afx-blast', `${AF}/wild_blast.png`, 320); L('afx-sigil', `${AF}/ground_sigil.png`, 320);
    L('afx-fireball', `${AF}/fireball.png`, 512, 256); L('afx-field', `${AF}/storm_field.png`, 320);
    for (const [k, f, w, h] of [['afx-leaves', 'binding_leaves', 512, 256], ['afx-emblem', 'bow_emblem', 320, 320], ['afx-tide', 'verdant_tide', 768, 512]] as const) if (!scene.textures.exists(k)) scene.load.spritesheet(k, `${AF}/${f}.png`, { frameWidth: w, frameHeight: h }); // later sheets: skipped quietly while missing
    for (const [k, f, w, h] of [['afx-finale', 'rain_finale', 600, 300], ['afx-arrow', 'leaf_arrow', 512, 128], ['afx-hit', 'leaf_hit', 320, 320], ['afx-bolt', 'sky_bolt', 320, 640], ['afx-mine', 'vine_mine', 384, 384],
      ['afx-burst', 'vine_burst', 360, 540], ['afx-hawk', 'hawk_fly', 320, 320], ['afx-dive', 'hawk_dive', 384, 384], ['afx-eagle2', 'eagle_side', 600, 300], ['afx-kick', 'kick_wind', 384, 384], ['afx-muzzle', 'muzzle', 320, 320],
      ['afx-gold', 'gold_aura', 300, 450], ['afx-haste', 'haste_rune', 512, 256], ['afx-volley', 'air_volley', 512, 256],
      ['afx-boot', 'boot_kick', 384, 384], ['afx-garrow', 'ground_arrow', 360, 540], ['afx-pit', 'mine_pit', 512, 256], ['afx-resolve', 'resolve_aura', 320, 480], ['afx-vines', 'vine_grow', 640, 160],
      ['afx-sbow', 'spirit_bow', 384, 384], ['afx-target', 'target_mark', 512, 256], ['afx-rainfall', 'arrow_rainfall', 320, 480], ['afx-band', 'aim_band', 512, 128],
      ['afx-fire', 'fire_burst', 320, 320], ['afx-rootband', 'roots_band', 640, 160], ['afx-tree2', 'tree_light', 360, 540], ['afx-heavy', 'heavy_arrow', 320, 480], ['afx-raura', 'rain_aura', 300, 450],
      ['afx-strike', 'floor_strike', 512, 256], ['afx-roar', 'roar_ring', 512, 256], ['afx-bcharge', 'bolt_charge', 320, 320], ['afx-rise', 'rise_thin', 240, 480]] as const) if (!scene.textures.exists(k)) scene.load.spritesheet(k, `${AF}/${f}.png`, { frameWidth: w, frameHeight: h }); // the painted round-3 set
    if (!scene.textures.exists('jb-bolt')) scene.load.spritesheet('jb-bolt', `${F}/skills/warrior/judgment_blade/bolt.png`, { frameWidth: 256, frameHeight: 512 }); // Thunder Rain: the warrior's blue lightning
    I('afx-apple', `${AF}/apple.png`); for (let i = 1; i < 4; i++) I(`afx-apple-${i}`, `${AF}/apple_${i}.png`); I('afx-roots', `${AF}/roots.png`);
    L('afx-fan', `${AF}/release_fan.png`, 512, 256); L('afx-triple', `${AF}/triple_trail.png`, 512, 256); L('afx-storm', `${AF}/storm_top.png`, 512, 256); L('afx-eagle', `${AF}/eagle_top.png`, 512, 256); L('vfx-evasion', `${F}/skills/archer/evasion/vfx.png`, 256);
    I('archer-cutin', `${F}/skills/archer/sky_rain/cutin.png`);
    if (!scene.textures.exists(ARCHER_KIT)) scene.load.multiatlas(ARCHER_KIT, `${ARCHER_KIT_URL}kit.json`, ARCHER_KIT_URL); // every archer effect is built from its pieces (ArcherFx)
  }
  if (want('book_mage')) { // every book mage effect is built from its pieces (MageFx)
    I('mage-cutin', `${F}/skills/book_mage/time_collapse/cutin.png`);
    if (!scene.textures.exists(MAGE_KIT)) scene.load.multiatlas(MAGE_KIT, `${MAGE_KIT_URL}kit.json`, MAGE_KIT_URL);
  }
  if (want('samurai')) {
    I('samurai-cutin', `${F}/skills/samurai/dragon_eclipse/cutin.png`);
    if (!scene.textures.exists(KIT)) scene.load.multiatlas(KIT, `${KIT_URL}kit.json`, KIT_URL); // every samurai effect is built from these pieces (SamuraiFx)
  }
  if (!want('warrior')) return;
  if (!scene.textures.exists('jb-bolt')) scene.load.spritesheet('jb-bolt', `${F}/skills/warrior/judgment_blade/bolt.png`, { frameWidth: 256, frameHeight: 512 });
  if (!scene.textures.exists('storm-ring')) scene.load.spritesheet('storm-ring', `${F}/skills/warrior/judgment_blade/ring.png`, { frameWidth: 256, frameHeight: 256 });
  if (!scene.textures.exists('sanctuary-wall')) scene.load.spritesheet('sanctuary-wall', `${F}/skills/warrior/sanctuary/wall.png`, { frameWidth: 256, frameHeight: 512 });
  if (!scene.textures.exists('cry-lion')) scene.load.spritesheet('cry-lion', `${F}/skills/warrior/war_cry/lion.png`, { frameWidth: 256, frameHeight: 256 }); // War Cry: the lion spirit roaring up out of the floor
  if (!scene.textures.exists('cry-shield')) scene.load.spritesheet('cry-shield', `${F}/skills/warrior/war_cry/shield.png`, { frameWidth: 300, frameHeight: 300 });
  if (!scene.textures.exists('bs-storm')) scene.load.spritesheet('bs-storm', `${F}/skills/warrior/blade_storm/storm.png`, { frameWidth: 280, frameHeight: 440 });
  if (!scene.textures.exists('bs-erupt')) scene.load.spritesheet('bs-erupt', `${F}/skills/warrior/blade_storm/erupt_a.png`, { frameWidth: 250, frameHeight: 667 });
  if (!scene.textures.exists('titan-dragon')) scene.load.spritesheet('titan-dragon', `${F}/skills/warrior/titans_verdict/dragon.png`, { frameWidth: 280, frameHeight: 440 });
  if (!scene.textures.exists('titan-tear')) scene.load.spritesheet('titan-tear', `${F}/skills/warrior/titans_verdict/tear.png`, { frameWidth: 640, frameHeight: 360 });
  if (!scene.textures.exists('banner-rally')) scene.load.spritesheet('banner-rally', `${F}/skills/warrior/legacy_banner/rally.png`, { frameWidth: 512, frameHeight: 512 }); // Legacy Banner: the lion of light that roars behind it
  if (!scene.textures.exists('titan-field')) scene.load.spritesheet('titan-field', `${F}/skills/warrior/titans_verdict/field.png`, { frameWidth: 512, frameHeight: 256 }); // the electrified floor it leaves
  if (!scene.textures.exists('titan-cutin')) scene.load.image('titan-cutin', `${F}/skills/warrior/titans_verdict/cutin.png`);
  if (!scene.textures.exists('holy-aura')) scene.load.spritesheet('holy-aura', `${F}/skills/warrior/radiant_blade/aura.png`, { frameWidth: 250, frameHeight: 667 });
  if (!scene.textures.exists('holy-bolt')) scene.load.spritesheet('holy-bolt', `${F}/skills/warrior/radiant_blade/bolt.png`, { frameWidth: 250, frameHeight: 500 });
  if (!scene.textures.exists('radiant-slash')) scene.load.spritesheet('radiant-slash', `${F}/skills/warrior/radiant_blade/slash_trail.jpg`, { frameWidth: 288, frameHeight: 288 }); // the blade of light's slash trail (GPT, on black: additive)
  if (!scene.textures.exists('radiant-blade')) scene.load.spritesheet('radiant-blade', `${F}/skills/warrior/radiant_blade/blade_small.png`, { frameWidth: 256, frameHeight: 81 });
  for (const k of ['war_leap_burst', 'final_slash', 'combo_orb', 'heal_sparkle', 'stance_ring', 'chains_break', 'target_mark', 'iron_oath_cast', 'banner_plant', 'banner_wave']) if (!scene.textures.exists(`pas-${k}`)) scene.load.spritesheet(`pas-${k}`, `${F}/skills/warrior/passives/${k}.png`, { frameWidth: k === 'banner_wave' ? 512 : 256, frameHeight: k === 'banner_wave' ? 512 : 256 }); // passive skills (the waving banner: drawn at 512)
  if (!scene.textures.exists('phantom-blade')) scene.load.spritesheet('phantom-blade', `${F}/skills/warrior/blade_storm/phantom.png`, { frameWidth: 256, frameHeight: 256 });
}

interface Anim { glow?: Phaser.GameObjects.Image; img: Phaser.GameObjects.Image; /** next frame dissolving in over the current one */ mix?: Phaser.GameObjects.Image; t: number; total: number; frames: number[]; frameMs: number[]; follow?: () => V3 | null; z?: number; fadeLast?: number; onDone?: () => void; loop?: [number, number]; until?: number; /** ms per looped frame (default 70) */ loopMs?: number;
  /** only the frame's part below this fraction of its height is shown (the near half of a ring, drawn over the actors) */ crop?: number;
  /** while following: the depth kept this far from the followed point's floor y */ dz?: number }
interface Tele { g: Phaser.GameObjects.Image; run: CastRun; follow?: boolean }
/** One sheet timeline's placement (SkillFx.play). */
interface PlayOpts { ox?: number; oy?: number; flip?: boolean; flipY?: boolean; angle?: number; depth?: number; blend?: number; follow?: () => V3 | null; z?: number; frames?: number[];
  loop?: [number, number]; until?: number; fadeLast?: number; alpha?: number; loopMs?: number; crop?: number; dz?: number }

export type HitTier = 'basic' | 'core' | 'signature' | 'ultimate';
export const tierOf = (s: FinalSkill, hit?: HitEvent): HitTier => (s.slot === 7 ? 'ultimate' : s.slot === 6 ? (hit?.heavy ? 'signature' : 'core') : s.slot === 0 ? 'basic' : 'core');
const HITSTOP: Record<HitTier, number> = { basic: 45, core: 70, signature: 95, ultimate: 140 };
/** Presentation scale of the main skill VFX per class (DFO-style: effects dwarf the character). */
const VFX_MULT: Record<string, number> = { warrior: 1.5, samurai: 1.25 };
/** Warrior skills that get a ground shockwave ring at their impact. */
const SHOCK: Record<string, { r: number; c: number }> = {
  ground_breaker: { r: 200, c: 0xffb050 }, shield_slam: { r: 110, c: 0xfff0c0 }, titans_verdict: { r: 260, c: 0xffd27a },
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
  /** Where a samurai's Kagemusha doubles stand (they swing with him), set by the scene. */
  ghosts?: (id: string) => { k: number; x: number; y: number; z: number }[];
  /** Where a fighter or monster is now (a cast's locked-on target), set by the scene. */
  targetPos?: (id: string) => (V3 & { h?: number }) | null;
  /** A caster's body as drawn this moment (Phantom Blades' phantoms of him), set by the scene. */
  bodyOf?: (id: string) => { key: string; frame: string | number; flipX: boolean; ox: number; oy: number; sx: number; sy: number; a?: number; face?: number } | null;
  /** Whether a fighter is alive (a buff's picture goes when he falls), set by the scene. */
  aliveOf?: (id: string) => boolean;
  /** Damage numbers and calls this much higher (the fighters are ready heroes, drawn taller), set by the scene. */
  lift = 0;
  /** Local player's damage-number skin (cash shop). */
  damageSkin: { key: string; widths: number[]; cell: number[] } | null = null;

  /** The samurai's effects (built from its pieces). */
  private sam: SamuraiFx;
  /** The book mage's effects (built from its pieces). */
  private mage: MageFx;
  private arch: ArcherFx;
  /** The gambler's effects (drawn in code). */
  private gamb: GamblerFx;

  constructor(private scene: Phaser.Scene, rt: SkillRuntime, private casterPos: (id: string) => V3 | null, private cam?: Phaser.Cameras.Scene2D.Camera) {
    this.sam = new SamuraiFx({
      scene, casterPos: (id) => this.casterPos(id), cam: () => this.cam ?? this.scene.cameras.main, hand: (id) => this.handPos?.(id) ?? null,
      callout: (at, text, color, row) => this.callout(at, text, color, row), punch: (a, ms) => this.punch(a, ms), darken: (ms, a) => this.darken(ms, a), ultimateStage: (r) => this.ultimateStage(r),
      ghosts: (id) => this.ghosts?.(id) ?? [], body: (id) => this.bodyOf?.(id) ?? null, targetPos: (id) => this.targetPos?.(id) ?? null,
      freeze: (ms) => { this.hitStopLeft = Math.max(this.hitStopLeft, ms); }, alive: (id) => this.aliveOf?.(id) ?? true,
    });
    this.arch = new ArcherFx({
      scene, casterPos: (id) => this.casterPos(id), cam: () => this.cam ?? this.scene.cameras.main,
      punch: (a, ms) => this.punch(a, ms), ultimateStage: (r) => this.ultimateStage(r), targetPos: (id) => this.targetPos?.(id) ?? null,
    });
    this.mage = new MageFx({
      scene, casterPos: (id) => this.casterPos(id), cam: () => this.cam ?? this.scene.cameras.main, hand: (id) => this.handPos?.(id) ?? null,
      punch: (a, ms) => this.punch(a, ms), darken: (ms, a) => this.darken(ms, a), ultimateStage: (r) => this.ultimateStage(r), targetPos: (id) => this.targetPos?.(id) ?? null,
      shake: (ms, i) => (this.cam ?? this.scene.cameras.main).shake(ms, i), hitStop: (ms) => { this.hitStopLeft = Math.max(this.hitStopLeft, ms); }, flash: (c, a, ms) => this.screenFlash(c, a, ms),
    });
    this.gamb = new GamblerFx({
      scene, casterPos: (id) => this.casterPos(id), cam: () => this.cam ?? this.scene.cameras.main, hand: (id) => this.handPos?.(id) ?? null,
      targetPos: (id) => this.targetPos?.(id) ?? null, callout: (at, text, color, row) => this.callout(at, text, color, row), punch: (a, ms) => this.punch(a, ms),
      darken: (ms, a) => this.darken(ms, a), shockwave: (x, y, r, c) => this.shockwave(x, y, r, c), crack: (x, y, r) => this.crack(x, y, r), dust: (x, y, sz, a) => this.dust(x, y, sz, a),
      freeze: (ms) => { this.hitStopLeft = Math.max(this.hitStopLeft, ms); }, flash: (c, a, ms) => this.screenFlash(c, a, ms),
    });
    rt.events.on(RT_EVENTS.cast, (r: CastRun) => this.onCast(r));
    rt.events.on(RT_EVENTS.active, (r: CastRun) => this.onActive(r));
    rt.events.on(RT_EVENTS.hit, (r: CastRun, i: number, o: V3) => this.onHitFired(r, i, o));
    rt.events.on(RT_EVENTS.projectile, (p: Projectile, r: CastRun) => this.onProjectile(p, r));
    rt.events.on(RT_EVENTS.projectileEnd, (p: Projectile) => this.onProjectileEnd(p));
    rt.events.on(RT_EVENTS.trap, (t: Trap) => this.onTrap(t));
    rt.events.on(RT_EVENTS.trapTrigger, (t: Trap, fired: boolean) => this.onTrapEnd(t, fired));
    rt.events.on(RT_EVENTS.trapArm, (t: Trap) => this.onTrapArm(t));
    rt.events.on(RT_EVENTS.chain, (r: CastRun, _i: number, o: V3, target: { x: number; y: number; z: number } | null) => this.onChain(r, o, target));
    rt.events.on(RT_EVENTS.counter, (r: CastRun) => this.onCounter(r));
    rt.events.on(RT_EVENTS.cancelled, (r: CastRun) => this.dropTele(r));
    rt.events.on(RT_EVENTS.end, (r: CastRun) => this.dropTele(r));
  }

  get count(): number { return this.anims.length + this.projs.size; }

  // ------------------------------------------------------------------ cast timeline

  private firstShape(s: FinalSkill): HitShape { return (s.chain ? s.chain.stages[0] : s.hits).find((h) => h.damage > 0)?.shape ?? s.hits[0]?.shape ?? { kind: 'placed', radius: 40 }; }

  /** The caster fights bare-handed (no weapon worn): the basic attack is a punch, no blade trail. */
  unarmed: ((casterId: string) => boolean) | null = null;

  private onCast(r: CastRun): void {
    const s = r.skill;
    if (s.id === 'warrior_basic') return; // MapleStory: a regular attack has no effect of its own — the sword leaves its afterimage (ActorView)
    if (s.cls === 'archer' && this.arch.ready) { // the archer: every effect built from its pieces (ArcherFx)
      if (s.telegraph && s.slot !== 7 && s.id !== 'eagle_arrow' && s.id !== 'arrow_storm') this.telegraph(r);
      this.arch.cast(r);
      return;
    }
    if (s.cls === 'archer' && CHARGE[s.id]) this.archerCharge(r);
    if (s.id === 'skyhunters_step' && this.scene.textures.exists('afx-volley')) { // from the air: a volley of leaf arrows rains down at an angle
      const left = r.aim.x < -0.01, T = r.timings;
      for (const d of [0, Math.round(T.active * 0.5)]) this.scene.time.delayedCall(T.startup + d, () => {
        const c = this.casterPos(r.attackerId); if (!c) return;
        this.play('afx-volley', c.x + (left ? -20 : 20), c.y - c.z - 60, 460, 230, [35, 40, 45, 50, 60, 70, 80, 100], { ox: left ? 0.86 : 0.14, oy: 0.2, flip: left, depth: TOP + 2 })?.setAngle(left ? 18 : -18); // tilted toward level: the volley sweeps across the floor
      });
    }
    if (s.cls === 'book_mage') { // the book mage: every effect built from its pieces (MageFx)
      if (s.telegraph && s.slot !== 7 && s.hits.length) this.telegraph(r);
      this.mage.cast(r);
      return;
    }
    if (s.cls === 'samurai') { // the samurai: every effect built from its pieces (SamuraiFx)
      if (s.telegraph) this.telegraph(r);
      this.sam.cast(r);
      return;
    }
    if (s.cls === 'gambler') { // the gambler: drawn in code (GamblerFx)
      if (s.telegraph && s.slot !== 7 && s.id !== 'dice_bomb' && s.id !== 'roulette_wheel') this.telegraph(r); // the dice and the wheel mark their own ground (GamblerFx)
      this.gamb.cast(r);
      return;
    }
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
    if (shape.kind === 'projectile' || shape.kind === 'chain') { if (s.cls !== 'archer') this.castFlare(r); else if (!CHARGE[s.id]) this.bowFlash(r, 0.6); return; }
    if (s.id === 'judgment_blade') this.judgment(r);
    else if (s.id === 'guard_counter') this.aegis(r);
    else if (s.id === 'war_cry') this.roar(r);
    else if (s.id === 'judgment_hook') this.hookChain(r);
    else if (s.id === 'sky_breaker') this.skyBreaker(r);
    else if (s.id === 'leap_crash') { this.aura(r); this.scene.time.delayedCall(r.timings.startup, () => { const c = this.casterPos(r.attackerId) ?? r.origin; this.leapBurst(c.x, c.y - c.z, r.aim.x < 0 ? -1 : 1); }); } // the take-off: a burst of light at his feet, the crater comes on the landing
    else if (s.id === 'earthsplitter') this.aura(r); // (the charge: his aura while the key is held; the split itself plays on the release, onActive)
    else if (s.id === 'iron_oath') this.oathSigil(r);
    else if (s.id === 'legacy_banner') { // planted in front of the caster where the sword comes down (every client sees it)
      const side = r.aim.x < 0 ? -1 : 1, bx = r.origin.x - side * 46, by = r.origin.y - 16; // planted just behind his shoulder (a step back in depth): it never hides the fight in front
      this.scene.time.delayedCall(Math.round(r.timings.startup * 0.7), () => this.bannerPlant(bx, by, 10000));
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
    if (r.skill.cls === 'samurai') this.sam.active(r);
    if (r.skill.cls === 'book_mage') this.mage.active(r);
    if (r.skill.id === 'earthsplitter') this.earthsplit(r);
    if (r.skill.cls === 'gambler') this.gamb.active(r);
    this.dropTele(r, true); // VFX timelines are pre-scheduled from the cast; telegraphs end here
    const sh = SHOCK[r.skill.id];
    if (sh) {
      const shape = this.firstShape(r.skill), o = r.origin, a = r.aim;
      const off = shape.kind === 'sector' ? shape.range * 0.6 : 0;
      this.shockwave(o.x + a.x * off, o.y + a.y * off, sh.r, sh.c);
    }
    if (r.skill.id === 'shield_slam') (this.cam ?? this.scene.cameras.main).shake(120, 0.004);
    if (r.skill.id === 'ground_breaker') { // the earth answers: heavy quake shake, double ring, dust burst
      (this.cam ?? this.scene.cameras.main).shake(150, 0.0045);
      for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; this.dust(r.origin.x + Math.cos(t) * 90, r.origin.y + Math.sin(t) * 38, 70, 0.55); } // the earth heaves: dust ring (the SHOCK ring is the one wave)
      this.spark(IMPACT.warrior.key, r.origin.x, r.origin.y - 24, IMPACT.warrior.frames, 170, 0.6);
      // the living quake: one golden rune ring that slowly turns on the floor around the warrior and fades away over 3s
      const ring = this.scene.add.image(0, 0, 'magic-circle').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc070).setDisplaySize(360, 360);
      const plane = this.scene.add.container(r.origin.x, r.origin.y, [ring]).setScale(1, 0.42).setDepth(GROUND + 2).setAlpha(0); // floor perspective
      this.scene.tweens.add({ targets: plane, alpha: 0.5, duration: 260 });
      this.scene.tweens.add({ targets: ring, angle: 140, duration: 3100 });
      this.scene.tweens.add({ targets: plane, alpha: 0, delay: 800, duration: 2300, ease: 'Sine.easeIn', onComplete: () => plane.destroy() }); // stays where it was created
    }
    if (r.skill.slot === 7 && r.skill.cls === 'warrior') (this.cam ?? this.scene.cameras.main).flash(160, 255, 226, 170, false);
  }

  /** Ground shockwave: an expanding additive ellipse on the floor plane + a thin bright rim. */
  shockwave(x: number, y: number, radius: number, color: number, keep = false): void {
    for (const [w, a, d] of [[10, 0.85, 320], [26, 0.35, 420]] as const) {
      const g = this.scene.add.ellipse(x, y, radius * 0.4, radius * 0.4 * 0.42).setStrokeStyle(keep ? w * 0.7 : w, color, keep ? a * 0.8 : a).setDepth(GROUND + 2).setBlendMode(keep ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD); // keep: the colour stays (green / blue never wash to yellow on the floor)
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

  /** Judgment Hook: the chain of light shoots out from his hand along the aim, bites at the hit, snaps back. */
  private hookChain(r: CastRun): void {
    const T = r.timings, a = r.aim, ang = Math.atan2(a.y, a.x) * (180 / Math.PI), key = vfxKey('judgment_hook');
    const len = 392, hitAt = r.skill.hits[0]?.at ?? 90; // (the sheet: the chain drawn from the cell's left edge, 248 of 256 px = 380 px of reach)
    const out = Math.max(20, hitAt / 3), back = Math.max(50, (T.active - hitAt + T.recovery) / 3);
    this.scene.time.delayedCall(Math.max(0, T.startup - 50), () => {
      if (r.phase === 'done' && r.elapsed < T.startup) return; // (cancelled before the throw)
      const c = this.casterPos(r.attackerId) ?? r.origin;
      this.play(key, c.x + a.x * 18, c.y + a.y * 18 - c.z - 44, len, len, [50, out, out, out, 110, back, back, back],
        { ox: 0, oy: 0.5, angle: ang, flipY: a.x < 0, depth: TOP - 5, blend: Phaser.BlendModes.ADD, fadeLast: 90, follow: () => { const p = this.casterPos(r.attackerId); return p ? { x: p.x + a.x * 18, y: p.y + a.y * 18, z: p.z + 44 } : null; } });
    });
  }

  /** Sky Breaker: three rising crescents ride up with him in the air, the light-blade strikes down, the ring bursts where he lands. */
  private skyBreaker(r: CastRun): void {
    const T = r.timings, key = vfxKey('sky_breaker'), flip = r.aim.x < 0, H = r.skill.hits;
    const h3 = H[2]?.at ?? 280, slam = H[H.length - 1]?.at ?? 560, size = 300;
    const air = () => { const p = this.casterPos(r.attackerId); return p ? { x: p.x, y: p.y, z: p.z } : null; };
    this.scene.time.delayedCall(T.startup, () => {
      if (r.phase === 'done' && r.elapsed < T.startup) return;
      const c = this.casterPos(r.attackerId) ?? r.origin;
      const step = Math.max(50, h3 / 3), down = Math.max(60, slam - h3 - 40);
      this.play(key, c.x, c.y - c.z, size, size, [50, step, step, step * 1.3, down], { oy: 0.9, flip, depth: TOP - 5, blend: Phaser.BlendModes.ADD, fadeLast: 60, follow: air });
    });
    this.scene.time.delayedCall(T.startup + slam - 30, () => { // the landing: the ring on the floor where he comes down
      const c = this.casterPos(r.attackerId) ?? r.origin;
      this.play(key, c.x, c.y + 6, size * 1.15, size * 1.15, [120, 150, 200], { frames: [5, 6, 7], oy: 0.9, flip, depth: c.y + 2, blend: Phaser.BlendModes.ADD, fadeLast: 160 });
      (this.cam ?? this.scene.cameras.main).shake(160, 0.007);
    });
  }

  /** Earthsplitter's release: the earth splits in front of him — as far and wide as the level the hold reached. */
  private earthsplit(r: CastRun): void {
    const key = vfxKey('earthsplitter'), T = r.timings, lv = r.chargeLevel ?? 0, c = this.casterPos(r.attackerId) ?? r.origin;
    const range = [200, 280, 360][lv] ?? 200, a = r.aim, w = range * 1.25, h = w * (256 / 384);
    const x = c.x + a.x * range * 0.55, y = c.y + a.y * range * 0.55;
    const d = Math.max(60, (T.active + T.recovery) / 8);
    this.play(key, x, y + 10, w, h, [d * 0.6, d * 0.7, d, d, d * 1.3, d * 1.2, d * 1.2, d * 1.4], { oy: 0.98, flip: a.x < 0, depth: y + 4, blend: Phaser.BlendModes.ADD, fadeLast: 200 });
    (this.cam ?? this.scene.cameras.main).shake(180 + lv * 120, 0.006 + lv * 0.004);
    this.shockwave(x, y, range * 0.9, 0xffc060);
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
      { const step = Math.max(70, Math.round((T.active + 260) / 8)); // the golden lion roars up out of the floor at his feet, its rings flat on the floor
        this.play('cry-lion', c.x, c.y + 8, 330, 330, [step * 0.6, step * 0.8, step, step * 1.4, step * 1.2, step, step, step * 1.2], { oy: 0.97, depth: c.y + 2, blend: Phaser.BlendModes.ADD, fadeLast: 160, follow: () => this.casterPos(r.attackerId) }); }
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
      const col = this.scene.add.image(c.x, c.y + 4, 'dmg-glow').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb040).setDepth(c.y + 2).setDisplaySize(60, 24).setAlpha(0.55);
      this.scene.tweens.add({ targets: col, displayHeight: 210, displayWidth: 70, duration: 140, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: col, alpha: 0, delay: 120, duration: 320, onComplete: () => col.destroy() }); // (one slim column: stacked bright layers burned the hero and the foe to white)
    });
  }

  private bannerMarks = new Map<string, Phaser.GameObjects.Container>();
  /** Legacy Banner's buff: a slowly turning golden crest ring at the feet of whoever carries it (hidden when off). */
  bannerMark(id: string, at: V3 | null, depth: number): void {
    let c = this.bannerMarks.get(id);
    if (!at) { if (c) c.setVisible(false); return; }
    if (!c) {
      const glow = this.scene.add.image(0, 0, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb040).setDisplaySize(150, 150).setAlpha(0.55);
      const core = this.scene.add.image(0, 0, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0c0).setDisplaySize(70, 70).setAlpha(0.35);
      c = this.scene.add.container(0, 0, [glow, core]).setScale(1, 0.38); this.bannerMarks.set(id, c); // a soft golden glow underfoot — no drawn ring
      this.scene.tweens.add({ targets: [glow, core], alpha: '-=0.25', duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    c.setVisible(true).setPosition(at.x, at.y - at.z + 2).setDepth(depth);
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
  /** Titan's Verdict: the struck floor stays electrified — a wide oval across the floor's depth, golden lightning crawling
   *  over it and arcing up, fading at the end (the hits are the skill's linger). */
  private titanField(x: number, y: number, ms: number): void {
    if (!this.scene.textures.exists('titan-field')) return;
    const W = 660, img = this.scene.add.image(x, y, 'titan-field', 0).setOrigin(0.5, 0.52).setBlendMode(Phaser.BlendModes.ADD).setDepth(GROUND + 1.6).setDisplaySize(W, W / 2).setAlpha(0);
    const mix = this.scene.add.image(x, y, 'titan-field', 1).setOrigin(0.5, 0.52).setBlendMode(Phaser.BlendModes.ADD).setDepth(GROUND + 1.61).setDisplaySize(W, W / 2).setAlpha(0);
    let t = 0;
    const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => { // the painted loop, each frame dissolving into the next
      t += 16; if (t >= ms) { ev.remove(); img.destroy(); mix.destroy(); return; }
      const k = Math.min(1, t / 220) * Math.min(1, (ms - t) / 600), q = t / 95, f = Math.floor(q) % 8, u = q - Math.floor(q);
      img.setFrame(f).setAlpha(k * (1 - u * 0.85)); mix.setFrame((f + 1) % 8).setAlpha(k * u);
    } });
  }

  private dragon(r: CastRun): void {
    const T = r.timings, a = r.aim, at = { x: r.origin.x + a.x * 110, y: r.origin.y + a.y * 110 };
    const pre = 480, dive = Math.max(0, T.startup - pre); // the titan of light rises after the cut-in and the tear: frames 0-5 rise and lift the sword, frame 6 = the sword driven into the floor on the active start
    const img = this.scene.add.image(at.x, at.y + 10, 'titan-dragon', 0).setOrigin(0.5, 0.97).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(470, 740).setDepth(TOP + 2);
    const fr = [12, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // 12 = empty frame while the cut-in plays (sim-timed)
    const fms = [dive, pre * 0.14, pre * 0.14, pre * 0.16, pre * 0.16, pre * 0.18, pre * 0.22, 150, 170, 180, 190, 210, 260];
    this.anims.push({ img, t: 0, total: fms.reduce((x, y) => x + y, 0), frames: fr, frameMs: fms, fadeLast: 240 });
    this.scene.time.delayedCall(T.startup + 160, () => this.titanField(at.x, at.y, (r.skill.linger?.startMs ?? 760) - 160 + (r.skill.linger?.everyMs ?? 350) * (r.skill.linger?.count ?? 9))); // the struck floor stays electrified
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
    if (!this.scene.textures.exists(vfxKey('ground_breaker'))) { this.groundScar(x, y, radius); return; }
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
    const SINK = 24, SZ = 390; // (a war banner taller than the hero: it reads from across the arena)
    const img = this.scene.add.image(x, y + 4, 'pas-banner_plant', 0).setOrigin(0.5, 1).setDisplaySize(SZ, SZ).setDepth(y);
    const mix = this.scene.add.image(x, y + 4, 'pas-banner_plant', 1).setOrigin(0.5, 1).setDisplaySize(SZ, SZ).setDepth(y + 0.001).setAlpha(0);
    const dissolve = (key: string, next: number, f: number) => { const k = f * f * (3 - 2 * f); if (mix.texture.key !== key) mix.setTexture(key).setDisplaySize(SZ, SZ); mix.setFrame(next).setAlpha(img.alpha * k); };
    if (this.scene.textures.exists('holy-bolt')) { // a pillar of holy light drives the banner into the floor
      const bolt = this.scene.add.image(x, y + 6, 'holy-bolt', 1).setOrigin(0.5, 0.79).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 1).setDisplaySize(200, 400).setAlpha(0.9);
      let bf = 1; const bev = this.scene.time.addEvent({ delay: 60, repeat: 6, callback: () => { bf++; if (bf < 8) bolt.setFrame(bf); else { bev.remove(); bolt.destroy(); } } });
    }
    let pulseT = 0;
    const plant = [50, 50, 60, 80, 90, 100, 110, 120];
    let i = 0, t = 0, phase: 'plant' | 'wave' | 'fade' = 'plant', waveT = 0; // eslint-disable-line prefer-const
    this.spark(IMPACT.warrior.key, x, y - 20, IMPACT.warrior.frames, 170, 0.9, 0);
    const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      t += 16;
      if (phase === 'plant') {
        while (i < 7 && t >= plant[i]) { t -= plant[i]; i++; img.setFrame(i); if (i === 2) { // planted: the rally wave rolls out over the floor
          this.shockwave(x, y, 230, 0xffd27a); this.scene.time.delayedCall(110, () => this.shockwave(x, y, 330, 0xffe9b0)); this.dust(x, y, 110, 0.8);
          this.play('banner-rally', x, y + 6, 460, 460, [70, 80, 90, 110, 170, 190, 160, 150, 170, 220], { oy: 508 / 512, depth: y - 1, blend: Phaser.BlendModes.ADD, fadeLast: 220 }); // the rally: a lion of light rises behind the banner and roars
          (this.cam ?? this.scene.cameras.main).shake(140, 0.004);
        } }
        if (i >= 7 && t >= plant[7]) { phase = 'wave'; t = 0; img.setTexture('pas-banner_wave', 0).setDisplaySize(SZ, SZ).setY(y + 4 + SINK); mix.setY(y + 4 + SINK); } // the waving art ends at the spear tip: sink it into the floor
        else if (i < 7) dissolve('pas-banner_plant', i + 1, Math.min(1, t / plant[i])); else { mix.setY(y + 4 + SINK); dissolve('pas-banner_wave', 0, Math.min(1, t / plant[7])); }
      } else if (phase === 'wave') {
        waveT += 16; const q = waveT / 160, wi = Math.floor(q) % 8; img.setFrame(wi); dissolve('pas-banner_wave', (wi + 1) % 8, q - Math.floor(q));
        pulseT += 16; if (pulseT >= 1400) { pulseT = 0; this.shockwave(x, y, 170, 0xffc860); } // while it stands it keeps calling: a soft golden ring every 1.4s
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
  leapBurst(x: number, y: number, dir: number, tint?: number): void {
    if (!this.scene.textures.exists('pas-war_leap_burst')) { this.shockwave(x, y, 46, tint ?? 0xdff4ff); return; }
    const img = this.scene.add.image(x - dir * 10, y, 'pas-war_leap_burst', 0).setOrigin(0.5, 0.55).setDepth(y + 1).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(200, 200).setFlipX(dir < 0);
    if (tint !== undefined) img.setTint(tint);
    const fms = [35, 35, 45, 50, 55, 60, 70, 80];
    this.anims.push({ img, t: 0, total: fms.reduce((p, q) => p + q, 0), frames: [0, 1, 2, 3, 4, 5, 6, 7], frameMs: fms, fadeLast: 80 });
  }

  /** DFO-style callout above a target (COUNTER!! / BACK ATTACK!!). */
  callout(at: V3, text: string, color: string, row = 0): void {
    const t = this.scene.add.text(at.x, at.y - at.z - 120 - this.lift - row * 30, text, {
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
    if (s.cls === 'archer') img.setBlendMode(Phaser.BlendModes.NORMAL); // archer sheets are re-toned to keep their green on the sunny floor
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
    const glow = VFX_MULT[s.cls] && s.cls !== 'archer' ? this.scene.add.image(img.x, img.y, key, 0).setOrigin(img.originX, img.originY).setBlendMode(Phaser.BlendModes.ADD)
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
    if (s.id === 'eagle_arrow') { g.setTint(0x52cf3e).setAlpha(1).setBlendMode(Phaser.BlendModes.ADD); if (this.scene.textures.exists('afx-band')) g.setVisible(false); } // a green band shows where the tide will go (the painted band when present)
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
    const arch = r.skill.cls === 'archer';
    this.darkLeft = arch ? r.timings.startup + 260 : r.timings.startup + r.timings.active + 160; // archer: the dark lifts as the rain lands (the storm is seen in full colour)
    this.scene.tweens.add({ targets: this.dark, fillAlpha: 0.55, duration: Math.min(220, r.timings.startup) });
    // Anime cut-in: the roaring hero slides across the screen during the wind-up (MapleStory 5th-job style).
    const cutKey = CUTIN[r.skill.id];
    if (cutKey && this.scene.textures.exists(cutKey)) {
      const v = cam.worldView, w = v.width * 0.9, cy = v.y + v.height * 0.42;
      const img = this.scene.add.image(v.x - w / 2, cy, cutKey).setDepth(TOP + 50); // slides in from the left
      img.setDisplaySize(w, w / 3);
      const band = this.scene.add.rectangle(v.centerX, cy, v.width, w / 3 + 16, 0x000000, 0.55).setDepth(TOP + 49).setScale(1, 0);
      this.scene.tweens.add({ targets: band, scaleY: 1, duration: 120, ease: 'Cubic.easeOut' });
      const out = r.skill.cls === 'samurai' ? Math.max(600, r.timings.startup - 300) : r.skill.id === 'titans_verdict' ? Math.max(420, Math.round(r.timings.startup * 0.51)) : 1100; // (Titan: paced to its short wind-up) // (samurai: gone before the eight cuts out of the dark)
      this.scene.tweens.add({ targets: img, x: v.centerX - w * 0.04, duration: 300, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: img, x: v.centerX + w * 0.03, delay: 300, duration: out - 300 }); // slow drift while holding (a real beat)
      this.scene.tweens.add({ targets: img, x: v.right + w / 2, alpha: 0, delay: out, duration: 200, ease: 'Cubic.easeIn', onComplete: () => img.destroy() });
      this.scene.tweens.add({ targets: band, scaleY: 0, delay: out + 20, duration: 160, onComplete: () => band.destroy() });
      if (r.skill.id === 'sky_rain' && this.scene.textures.exists('afx-eagle2')) { // a great spirit eagle sweeps across the cut-in
        const ew = v.width * 0.55, eg = this.scene.add.image(v.x - ew, cy - w / 3 * 0.35, 'afx-eagle2', 0).setDepth(TOP + 51).setDisplaySize(ew, ew / 2);
        let et = 0; const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => { et += 16; const k = et / 1150; if (k >= 1 || !eg.active) { ev.remove(); eg.destroy(); return; } eg.setFrame(Math.floor(et / 60) % 8).setPosition(v.x - ew + (v.width + ew * 2) * k, cy - w / 3 * 0.35 + Math.sin(k * Math.PI) * 40).setAlpha(k > 0.85 ? (1 - k) / 0.15 : 1); } });
      }
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
    if (r.skill.id === 'titans_verdict' && this.scene.textures.exists('titan-tear')) this.scene.time.delayedCall(Math.round(r.timings.startup * 0.58), () => { // (cut-in → tear → dragon dive → impact, paced to the wind-up)
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
      if (!arch && r.skill.cls !== 'samurai') { // (archer: no white-out — the arrows themselves are the payoff; samurai: the white comes with the great cut, after the eight in the dark)
        const f = this.scene.add.rectangle(0, 0, W, H, 0xfff4d8, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(TOP + 45).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: f, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
      }
      cam.shake(420, 0.014);
    });
  }

  // ------------------------------------------------------------------ hit-timed visuals

  private onHitFired(r: CastRun, i: number, o: V3): void {
    const s = r.skill, h = r.hits[i];
    if (s.cls === 'samurai') { this.sam.hit(r, i, o); return; }
    if (s.cls === 'gambler') { this.gamb.hit(r, i, o); return; }
    if (s.cls === 'book_mage') { this.mage.hit(r, i, o); return; }
    if (s.cls === 'archer' && this.arch.ready) { this.arch.hit(r, i, o); return; }
    // Multi-hit area skills: a short pulse per tick so every discrete hit reads (VFX timeline already running).
    if (i > 0 && s.cls !== 'archer' && (h.shape.kind === 'circle' || h.shape.kind === 'placed')) { // (archer areas carry their own art: no area-sized flash)
      const c = h.shape.kind === 'placed' ? (r.place ?? o) : circleCentre(h.shape, o, r.aim, r.place);
      const k = IMPACT.warrior;
      this.spark(k.key, c.x, c.y - (h.shape.kind === 'placed' ? 30 : o.z + 40), k.frames, (h.shape.kind === 'placed' ? h.shape.radius : (h.shape as { radius: number }).radius) * 1.2, 0.8);
    }
    if (s.id === 'leap_crash') { // crater at the landing point
      // lies flat on the floor under the actors (never painted over the warrior)
      const img = this.scene.add.image(o.x, o.y, vfxKey(s.id), 0).setOrigin(0.5, 0.62).setDepth(GROUND + 1).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(360, 150);
      const fr = [0, 1, 2, 3, 4, 5, 6, 7], fms = [40, 60, 80, 110, 120, 140, 170, 300];
      this.anims.push({ img, t: 0, total: fms.reduce((a, b) => a + b, 0), frames: fr, frameMs: fms, fadeLast: 320 });
      (this.cam ?? this.scene.cameras.main).shake(160, 0.005);
      this.shockwave(o.x, o.y, 200, 0xffc070);
    }
  }

  private onCounter(r: CastRun): void {
    const c = this.casterPos(r.attackerId); if (!c) return;
    if (r.skill.cls === 'warrior') { this.spark(vfxKey('guard_counter'), c.x + r.aim.x * 50, c.y + r.aim.y * 50 - c.z - 40, 8, 260, 1, 2); this.shockwave(c.x, c.y, 120, 0x9ed8ff); return; }
    if (r.skill.cls === 'samurai') { this.sam.counter(r); return; }
    this.spark(vfxKey('mirage'), c.x + r.aim.x * 40, c.y + r.aim.y * 40 - c.z - 40, 8, 200, 1, 2);
  }

  private onProjectile(p: Projectile, r: CastRun): void {
    if (p.skill.cls === 'samurai') { this.sam.projectile(p); return; }
    if (p.skill.cls === 'gambler') { this.gamb.projectile(p); return; }
    if (p.skill.cls === 'book_mage') { this.mage.projectile(p, r); return; }
    if (p.skill.cls === 'archer' && this.arch.ready) { this.arch.projectile(p); return; }
    if (p.skill.id === 'eagle_arrow' && this.scene.textures.exists('afx-eagle')) { // the spirit eagle (drawn from above) flies toward the aim
      const img = this.scene.add.image(p.x, p.y - p.z, 'afx-eagle', 0).setDepth(p.y).setBlendMode(Phaser.BlendModes.NORMAL).setOrigin(488 / 512, 0.5)
        .setDisplaySize(420, 210).setAngle(Math.atan2(p.dy, p.dx) * (180 / Math.PI));
      this.projs.set(p, img);
      return;
    }
    if (p.skill.id === 'explosive_arrow' && this.scene.textures.exists('afx-fireball')) { // a burning arrow in a fireball, level on screen
      const img = this.scene.add.image(p.x, p.y - p.z, 'afx-fireball', 0).setOrigin(470 / 512, 0.5).setDisplaySize(260, 130).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y).setAngle(screenAng(p.dx, p.dy));
      this.projs.set(p, img);
      return;
    }
    if (p.skill.id === 'piercing_arrow' && this.scene.textures.exists('afx-muzzle')) { const lv = level(p.dx, p.dy); this.play('afx-muzzle', p.x, p.y - p.z, 120, 120, [30, 30, 35, 40, 45, 50, 55, 60], { ox: lv.flip ? 0.86 : 0.14, flip: lv.flip, depth: p.y + 1 })?.setAngle(lv.ang); }
    if (p.skill.cls === 'archer' && this.scene.textures.exists('arch-arrow')) { this.archerArrow(p); return; }
    const id = PROJ_ALIAS[p.skill.id] ?? p.skill.id, sheet = PROJECTILE_SHEETS[id];
    if (!sheet) return;
    const img = this.scene.add.image(p.x, p.y - p.z, `proj-${id}`, 0).setDepth(p.y).setAngle(Math.atan2(p.dy, p.dx) * (180 / Math.PI));
    const size = id === 'wave_slash' ? 150 : id === 'arcane_bolt' ? 64 : id === 'lightning_chain' ? 120 : 92;
    img.setDisplaySize(size, size).setFlipY(p.dx < -0.01);
    if (r.skill.slot === 6) img.setTint(0xd8ffe0).setBlendMode(Phaser.BlendModes.ADD);
    this.projs.set(p, img);
  }

  private onProjectileEnd(p: Projectile): void {
    if (p.skill.cls === 'samurai') { this.sam.projectileEnd(p); return; }
    if (p.skill.cls === 'gambler') { this.gamb.projectileEnd(p); return; }
    if (p.skill.cls === 'book_mage') { this.mage.projectileEnd(p); return; }
    if (p.skill.cls === 'archer' && this.arch.ready) { this.arch.projectileEnd(p); return; }
    const img = this.projs.get(p);
    img?.destroy(); this.projs.delete(p);
    const fx = this.arrowFx.get(p);
    if (fx) { this.arrowFx.delete(p); for (const o of fx.parts) this.scene.tweens.add({ targets: o, alpha: 0, duration: 120, onComplete: () => o.destroy() }); fx.em.stop(); this.scene.time.delayedCall(600, () => fx.em.destroy()); }
    const end = p.end ?? { x: p.x, y: p.y, reason: 'range' };
    if (p.skill.cls === 'archer' && p.explodeRadius > 0) { this.archerBlast(end.x, end.y, p.z, p.explodeRadius); return; }
    if (p.skill.id === 'skyhunters_step') { // the arrow strikes the floor: a short streak of green light carries the blow on along the ground
      const d = { x: p.dx, y: p.dy }, L = Math.hypot(d.x, d.y) || 1;
      if (this.scene.textures.exists('afx-strike')) { const lv = level(d.x / L, d.y / L); this.play('afx-strike', end.x, end.y, 220, 110, [40, 50, 60, 70, 80, 90, 110, 140], { ox: lv.flip ? 0.9 : 0.1, oy: 0.85, flip: lv.flip, depth: end.y + 1 }); }
      else if (this.scene.textures.exists('afx-band')) this.floorFx('afx-band', end.x, end.y, { x: d.x / L, y: d.y / L }, 170, [30, 40, 50, 60, 70, 80, 90, 110], { ox: 0.02, aspect: 3.2, depth: GROUND + 2, alpha: 0.9 });
      const f = this.scene.add.image(end.x, end.y - 4, 'arch-glow').setTint(0x7ee35a).setBlendMode(Phaser.BlendModes.ADD).setDepth(end.y + 1).setDisplaySize(60, 24);
      this.scene.tweens.add({ targets: f, alpha: 0, scaleX: f.scaleX * 2, duration: 260, onComplete: () => f.destroy() });
    }
    if (p.skill.cls === 'archer' && end.reason === 'cover') this.stuckArrow(end.x, end.y, p.dx < 0 ? -1 : 1, ARROW_TINT[p.skill.id] ?? 0xb8ff7a);
    if (p.explodeRadius > 0) this.spark(IMPACT.explosion.key, end.x, end.y - p.z + 10, 5, p.explodeRadius * 2.6, 1);
    else if (end.reason === 'cover') this.spark(IMPACT.dust.key, end.x, end.y - p.z + 20, 6, 70, 0.9);
  }

  private onChain(r: CastRun, o: V3, target: { x: number; y: number; z: number } | null): void {
    if (r.skill.cls === 'book_mage') { this.mage.chain(r, o, target, null); return; }
    const a = { x: o.x + r.aim.x * 20, y: o.y + r.aim.y * 20 - o.z - 44 };
    const b = target ? { x: target.x, y: target.y - target.z - 44 } : { x: o.x + r.aim.x * 300, y: o.y + r.aim.y * 300 - o.z - 44 };
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const img = this.scene.add.image((a.x + b.x) / 2, (a.y + b.y) / 2, 'proj-lightning_chain', 0).setDepth(TOP).setBlendMode(Phaser.BlendModes.ADD);
    img.setDisplaySize(len, 90).setAngle(Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI));
    const fr = [0, 2, 4, 6, 7], fms = [50, 50, 50, 50, 60];
    this.anims.push({ img, t: 0, total: 260, frames: fr, frameMs: fms, fadeLast: 60 });
  }

  private onTrap(t: Trap): void {
    if (t.run.skill.cls === 'book_mage') { this.mage.trap(t); return; }
    if (t.run.skill.cls === 'archer' && this.arch.ready) { this.arch.trap(t); return; }
    const R0 = t.radius, sig = this.scene.textures.exists('afx-sigil');
    const mine = this.scene.textures.exists('afx-mine'), pitArt = this.scene.textures.exists('afx-pit');
    if (mine && !pitArt) { // the mine sits IN the floor: a dark, scorched pit with a faint glow seeping out of it
      const pit = this.scene.add.ellipse(t.x, t.y, 2.2 * R0, 2.2 * R0 * FLOOR_SQUASH * 0.9, 0x1c1408, 0.5).setDepth(GROUND + 0.4);
      const seep = this.scene.add.image(t.x, t.y, 'arch-glow').setTint(0x52cf3e).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(1.6 * R0, 1.6 * R0 * FLOOR_SQUASH).setAlpha(0.35).setDepth(GROUND + 0.45);
      this.scene.tweens.add({ targets: seep, alpha: { from: 0.2, to: 0.5 }, duration: 500, yoyo: true, repeat: -1 });
      const kill = this.scene.time.addEvent({ delay: 100, loop: true, callback: () => { if (!this.traps.has(t)) { kill.remove(); this.scene.tweens.killTweensOf(seep); pit.destroy(); seep.destroy(); } } });
    }
    const ring = pitArt ? this.scene.add.image(t.x, t.y, 'afx-pit', 0).setDepth(GROUND + 0.6).setDisplaySize(2.7 * R0, 1.35 * R0).setAlpha(0.72) : mine ? this.scene.add.image(t.x, t.y, 'afx-mine', 0).setDepth(GROUND + 0.6).setDisplaySize(2.5 * R0, 2.5 * R0 * FLOOR_SQUASH) : this.scene.add.image(t.x, t.y, sig ? 'afx-sigil' : 'magic-circle', sig ? 5 : 0).setDepth(GROUND + 0.5).setBlendMode(sig ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD).setAlpha(0.95).setDisplaySize(2.3 * R0, 2.3 * R0 * FLOOR_SQUASH);
    if (!sig) ring.setTint(0x9be35a);
    const vines = this.scene.add.image(t.x, t.y, vfxKey('vine_trap'), 2).setDepth(GROUND + 0.6).setBlendMode(Phaser.BlendModes.NORMAL).setAlpha(0.7).setDisplaySize(R0 * 2.4, R0 * 2.4).setOrigin(0.5, 0.62);
    const rim = this.scene.add.ellipse(t.x, t.y, 2 * R0, 2 * R0 * FLOOR_SQUASH, 0x3fae34, 0.16).setStrokeStyle(4, 0x6fe04a, 0.95).setDepth(GROUND + 0.7); // a clear green circle on the floor
    this.scene.tweens.add({ targets: [vines, rim], alpha: { from: 0.65, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    if (pitArt) rim.setVisible(false); // the painted pit is part of the soil: no outline floating over it
    if (pitArt) { // the mine lies still in the soil; only its cracks glow softly, and leaves and motes of light drift up from it (it is alive)
      ring.setFrame(0); vines.setVisible(false); // a still trap in the soil (the soil half see-through); only the flower's heart lives
      const glow = this.scene.add.image(t.x, t.y - 4, 'arch-glow').setTint(0x6fe04a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(1.5 * R0, 0.7 * R0).setAlpha(0.25).setDepth(GROUND + 0.7);
      this.scene.tweens.add({ targets: glow, alpha: { from: 0.15, to: 0.35 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const motes = this.scene.add.particles(t.x, t.y, 'arch-glow', {
        emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 1.9 * R0, 0.8 * R0), quantity: 1 } as never,
        speedY: { min: -38, max: -16 }, speedX: { min: -8, max: 8 }, lifespan: { min: 900, max: 1500 }, scale: { start: 0.09, end: 0 }, alpha: { start: 0.9, end: 0 },
        tint: [0x9cf27a, 0xd8ff8a, 0xffe27a], blendMode: 'ADD', frequency: 90, quantity: 1,
      }).setDepth(t.y + 1);
      const leaves = this.scene.add.particles(t.x, t.y, 'arch-glow', {
        emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 1.6 * R0, 0.6 * R0), quantity: 1 } as never,
        speedY: { min: -30, max: -12 }, speedX: { min: -14, max: 14 }, rotate: { min: 0, max: 360 }, lifespan: { min: 1200, max: 1800 }, scaleX: { start: 0.18, end: 0.05 }, scaleY: { start: 0.07, end: 0.02 }, alpha: { start: 0.95, end: 0 },
        tint: [0x4cc23a, 0x7ee35a], blendMode: 'NORMAL', frequency: 260, quantity: 1,
      }).setDepth(t.y + 1);
      const kill = this.scene.time.addEvent({ delay: 100, loop: true, callback: () => { if (!this.traps.has(t)) { kill.remove(); this.scene.tweens.killTweensOf(glow); glow.destroy(); motes.stop(); leaves.stop(); this.scene.time.delayedCall(1800, () => { motes.destroy(); leaves.destroy(); }); } } });
    } else if (mine) { let f = 0; const ev = this.scene.time.addEvent({ delay: 110, loop: true, callback: () => { if (!ring.active) { ev.remove(); return; } ring.setFrame(++f % 8); } }); vines.setVisible(false); }
    else this.scene.tweens.add({ targets: ring, angle: 360, duration: 8000, repeat: -1 });
    this.traps.set(t, [ring, vines, rim as unknown as Phaser.GameObjects.Image]);
  }

  /** Mine armed (someone stepped on it): vines grab, the ring burns red-gold and ticks faster for the 2s fuse. */
  private onTrapArm(t: Trap): void {
    if (t.run.skill.cls === 'book_mage') return;
    if (t.run.skill.cls === 'archer' && this.arch.ready) { this.arch.trapArm(t); return; }
    const list = this.traps.get(t) ?? [];
    for (const i of list) { this.scene.tweens.killTweensOf(i); if (i instanceof Phaser.GameObjects.Image && i.texture.key !== 'afx-mine' && i.texture.key !== 'afx-pit') i.setTint(0xffb050); }
    const m = list[0];
    if (m?.texture.key === 'afx-pit') { // armed: nothing moves — only the flower's heart blinks, faster and faster, until it bursts
      const heart = this.scene.add.image(t.x, t.y - 0.08 * t.radius, 'arch-glow').setTint(0xc8ff6a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(0.75 * t.radius, 0.55 * t.radius).setDepth(GROUND + 0.8).setAlpha(0);
      list.push(heart); let ht = 0;
      const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => { if (!heart.active) { ev.remove(); return; } ht += 16; const rate = 4 + ht / 160; heart.setAlpha(0.15 + 0.85 * Math.max(0, Math.sin((ht / 1000) * rate * Math.PI))); } });
    }
    else if (m?.texture.key === 'afx-mine') this.scene.tweens.add({ targets: m, scaleX: m.scaleX * 1.12, scaleY: m.scaleY * 1.12, duration: 140, yoyo: true, repeat: 6 });
    if (m?.texture.key !== 'afx-pit') {
      const rim = list[2] as unknown as Phaser.GameObjects.Ellipse | undefined;
      rim?.setStrokeStyle(4, 0xffb050, 1);
      if (rim) this.scene.tweens.add({ targets: rim, alpha: { from: 1, to: 0.3 }, duration: 160, yoyo: true, repeat: 5 });
    }
  }

  private onTrapEnd(t: Trap, fired: boolean): void {
    if (t.run.skill.cls === 'book_mage') { this.mage.trapEnd(t, fired); return; }
    if (t.run.skill.cls === 'archer' && this.arch.ready) { this.arch.trapEnd(t, fired); return; }
    const list = this.traps.get(t); this.traps.delete(t);
    for (const i of list ?? []) { this.scene.tweens.killTweensOf(i); i.destroy(); }
    if (fired && t.run.skill.trap?.fuseMs) { // the mine bursts: a pillar of green fire throws everyone in it high into the air
      const burst = this.scene.textures.exists('afx-burst') ? 'afx-burst' : vfxKey('rising_arrow'), bw = burst === 'afx-burst' ? 2 / 3 : 1, oy = burst === 'afx-burst' ? 0.97 : ARCHER_GROUND.rising_arrow;
      this.play(burst, t.x, t.y, 520 * bw, 520, [50, 60, 70, 90, 110, 130, 160, 200], { oy, depth: t.y + 1 });
      for (const dx of [-0.6, 0.6]) this.play(burst, t.x + dx * t.radius, t.y + 4, 330 * bw, 330, [90, 60, 70, 90, 110, 130, 160, 200], { oy, depth: t.y + 2, flip: dx < 0 });
      this.shockwave(t.x, t.y, t.radius * 2.6, 0x52cf3e, true); // a green burst of vines (no fire, and no stain left behind)
      (this.cam ?? this.scene.cameras.main).shake(260, 0.008);
    } else if (fired) this.spark(vfxKey('vine_trap'), t.x, t.y - 20, 8, 140, 1, 3);
  }

  // ------------------------------------------------------------------ confirmed hits

  /** Confirmed hit feedback at the target: class impact, damage number, hit-stop + shake by tier. */
  confirmed(s: FinalSkill, hit: HitEvent, at: V3, damage: number, reaction: string, local: boolean, combo: number, crit = false, from?: { x: number; y: number }): void {
    const tier = tierOf(s, hit);
    const k = IMPACT[s.cls] ?? IMPACT.warrior;
    const im = s.cls === 'warrior' ? 0.8 : 1; // MapleStory: a small, quick hit spark on the target (no flash over the body)
    if (s.cls === 'archer' && this.arch.ready) this.arch.confirmed(s, hit, at, !!hit.heavy || tier === 'signature' || tier === 'ultimate', crit); // (ArcherFx)
    else if (s.cls === 'archer' && (this.scene.textures.exists('afx-hit') || this.scene.textures.exists('afx-impact'))) { // painted arrow impact (two variants, alternating)
      const rapid = s.hits.length > 3 && !hit.heavy; // storms / volleys: small sparks, never a white-out
      const sz = rapid ? 64 : tier === 'ultimate' || hit.heavy ? 140 : 86, key = this.scene.textures.exists('afx-hit') ? 'afx-hit' : (this.impactFlip = !this.impactFlip) ? 'afx-impact' : 'afx-impact-b';
      this.play(key, at.x, at.y - at.z - 38, sz, sz, [20, 22, 24, 26, 28, 30, 34, 40], { depth: TOP + 2, fadeLast: 60 }); // the samurai's hit sizes
    } else if (s.cls === 'book_mage') this.mage.confirmed(s, hit, at, !!hit.heavy || tier === 'signature' || tier === 'ultimate', crit);
    else if (s.cls === 'gambler') this.gamb.confirmed(s, hit, at, !!hit.heavy || tier === 'signature' || tier === 'ultimate', crit);
    else if (s.cls === 'samurai') this.sam.confirmed(s, hit, at, reaction, !!hit.heavy || tier === 'signature' || tier === 'ultimate', crit, from, local); // (the cut of the blade on the foe and the marks of what happened to it)
    else if (s.id !== 'warrior_basic') this.spark(k.key, at.x, at.y - at.z - 38, k.frames, k.size * im * (tier === 'ultimate' ? 1.4 : hit.heavy ? 1.15 : 1), 0.8); // (a regular attack: none, as in MapleStory)
    // Ground dust only where the skill has no ground impact art of its own (kept subtle).
    if (s.cls !== 'samurai' && tier !== 'ultimate' && reaction === 'launch') this.spark(IMPACT.dust.key, at.x, at.y + 4, 6, 90, 0.5);
    if (s.cls !== 'samurai' && tier !== 'ultimate' && (reaction === 'knockdown' || reaction === 'slam')) this.spark(IMPACT.dust.key, at.x, at.y + 6, 6, 110, 0.55);
    if (s.id === 'leaping_arrow' && this.scene.textures.exists('afx-vines')) { // Binding Leaves: vines climb round the caught foe's legs for the hold
      const hold = hit.reaction.hardCC?.ms ?? 3000;
      for (const dx of [-14, 14]) this.play('afx-vines', at.x + dx, at.y + 2, 90, 46, [60, 70, 90, 120, 600, 600, 900, 300], { oy: 0.85, flip: dx < 0, depth: at.y + 1, loop: [4, 6], until: hold - 300, loopMs: 260, fadeLast: 300 });
    }
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
    const x = col.x, y = live(below) ? below.y - (DMG_RISE * below.age) / 1000 - (below.crit ? DMG_ROW_CRIT : DMG_ROW) : hy - 96 - this.lift;
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
  spark(key: string, x: number, y: number, frames: number, size: number, alpha: number, start = 0, depth = TOP + 2): void {
    const img = this.scene.add.image(x, y, key, start).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setAlpha(alpha);
    img.setDisplaySize(size, size);
    const fr: number[] = [], fms: number[] = [];
    for (let i = start; i < frames; i++) { fr.push(i); fms.push(42); }
    if (fr.length === 1) { fms[0] = 160; this.scene.tweens.add({ targets: img, scale: img.scale * 1.3, duration: 160 }); }
    this.anims.push({ img, t: 0, total: fms.reduce((a, b) => a + b, 0), frames: fr, frameMs: fms, fadeLast: 60 });
  }

  /** Landing / footstep dust at the support plane. `depth`: an actor's own dust sorts with him (behind a block that hides
   *  his feet, it is hidden too); by default it is drawn over everything. */
  dust(x: number, y: number, size: number, alpha = 0.85, depth?: number): void { this.spark(IMPACT.dust.key, x, y - size * 0.25, 6, size, alpha, 0, depth); }

  update(ms: number, projectiles: Projectile[]): void {
    const step = this.hitStopLeft > 0 ? 0 : ms;
    this.stepHawks(ms);
    this.sam.update(step);
    this.mage.update(step, performance.now());
    this.arch.update(step);
    this.gamb.update(step);
    if (this.hitStopLeft > 0) this.hitStopLeft = Math.max(0, this.hitStopLeft - ms);
    this.anims = this.anims.filter((a) => {
      a.t += step;
      let tt = a.t, idx = a.frames.length - 1;
      if (a.loop && a.until !== undefined && a.t < a.until) {
        const pre = a.frameMs.slice(0, a.frames.indexOf(a.loop[0])).reduce((x, y) => x + y, 0);
        if (a.t >= pre) { const span = a.loop[1] - a.loop[0] + 1, q = (a.t - pre) / (a.loopMs ?? 70), i = Math.floor(q) % span; a.img.setFrame(a.loop[0] + i); this.place(a); this.blend(a, a.loop[0] + ((i + 1) % span), q - Math.floor(q)); return true; }
      } else if (a.loop && a.until !== undefined) tt = a.frameMs.slice(0, a.frames.indexOf(a.loop[1]) + 1).reduce((x, y) => x + y, 0) + (a.t - a.until); // then the frames after the loop, in order
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
    for (const t of this.teles) {
      if (t.follow) { const c = this.casterPos(t.run.attackerId); if (c) t.g.setPosition(c.x, c.y); }
      if (t.run.skill.id === 'eagle_arrow') t.g.setAngle(Math.atan2(t.run.aim.y, t.run.aim.x) * (180 / Math.PI)); // Eagle Tide: the green band turns with the aim while charging
    }
    for (const p of projectiles) {
      const fx = this.arrowFx.get(p);
      if (fx) { // drawn archer arrow: head on the arrow, the streak stretches with the distance flown
        let x = p.x, y = p.y - p.z; const d = projDepth(p), len = Math.min(fx.trail, 30 + p.ageMs * 0.9);
        if (p.skill.id === 'skyhunters_step') { // Air Volley: the arrows dive from the air down onto the floor at an angle
          const life = 430, k = Math.min(1, p.ageMs / life), z0 = (p as unknown as { z0?: number }).z0 ?? ((p as unknown as { z0?: number }).z0 = p.z);
          y += z0 * k; const lv = p.dx < -0.01, ang = Math.atan2(p.dy * 0.5 * 980 + z0 / life * 1000, Math.abs(p.dx) * 980 + 1) * (180 / Math.PI);
          fx.parts[0].setAngle(lv ? -ang : ang); fx.parts[1].setAngle(lv ? 180 - ang : ang);
        }
        if (p.skill.id === 'piercing_arrow' && p.dy < -0.3) { // Spirit Bow aimed up: the arrow arcs high and falls back down onto the floor ahead
          const life = 620, k = Math.min(1, p.ageMs / life), H = Math.abs(p.dx) < 0.1 ? 320 : 170, lift = 4 * H * k * (1 - k), slope = 4 * H * (1 - 2 * k) / life * 1000;
          y -= lift; const sp = 900, lv = p.dx < -0.01, ang = Math.atan2(p.dy * sp * 0.5 - slope, Math.abs(p.dx) * sp + 1) * (180 / Math.PI);
          fx.parts[0].setAngle(lv ? -ang : ang); fx.parts[1].setAngle(lv ? 180 - ang : ang);
        }
        const lead = Math.min(46, p.ageMs * 0.6), vis = p.ageMs > 25; // drawn from the muzzle flash in front of the body
        if (p.ageMs < 80 && p.skill.id !== 'arrow_storm') { x += p.dx * lead; y += p.dy * lead * 0.5; }
        for (const o of fx.parts) o.setVisible(vis);
        const grow = Math.min(1, 0.15 + p.ageMs / 90); fx.parts[0].setPosition(x, y).setDepth(d + 0.02).setScale(Math.abs(fx.base) * grow * Math.sign(fx.parts[0].scaleX || 1), fx.parts[0].scaleY); fx.parts[2].setAlpha(0.8 * grow); if (fx.parts[0].texture.key === 'afx-arrow') fx.parts[0].setFrame(Math.floor(p.ageMs / 70) % 8);
        fx.parts[1].setPosition(x, y).setDepth(d + 0.01).setDisplaySize(len, fx.parts[1].displayHeight);
        fx.parts[2].setPosition(x, y).setDepth(d).setDisplaySize(fx.glow * (0.9 + 0.2 * Math.random()), fx.glow * (0.9 + 0.2 * Math.random()));
        continue;
      }
      const img = this.projs.get(p);
      if (!img) continue;
      img.setPosition(p.x, p.y - p.z).setDepth(projDepth(p));
      if (p.skill.id === 'explosive_arrow' && img.texture.key === 'afx-fireball') { img.setFrame(Math.floor(p.ageMs / 55) % 8); continue; }
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
    if (!a.mix) { a.mix = this.scene.add.image(im.x, im.y, im.texture.key, next).setBlendMode(im.blendMode); if (a.crop !== undefined) a.mix.setCrop(0, a.mix.frame.height * a.crop, a.mix.frame.width, a.mix.frame.height * (1 - a.crop)); }
    const m = a.mix, k = Math.min(1, f) * Math.min(1, f) * (3 - 2 * Math.min(1, f)); // smoothstep
    if (m.texture.key !== im.texture.key) m.setTexture(im.texture.key);
    m.setFrame(next).setOrigin(im.originX, im.originY).setScale(im.scaleX, im.scaleY).setFlip(im.flipX, im.flipY).setRotation(im.rotation)
      .setPosition(im.x, im.y).setDepth(im.depth + 0.001).setAlpha(im.alpha * k).setVisible(true);
    if (im.isTinted) m.setTint(im.tintTopLeft); else m.clearTint();
  }

  private place(a: Anim): void {
    if (!a.follow) return;
    const p = a.follow();
    if (!p) return;
    a.img.setPosition(p.x, p.y - p.z);
    if (a.dz !== undefined) a.img.setDepth(p.y + a.dz);
  }

  // ------------------------------------------------------------------ archer

  /** A top-down floor sheet laid on the ground in the aim direction (any of the 8 directions): rotated to the aim,
   *  then flattened into the floor's perspective. `ox` = the sheet's start point (fraction of its width). */
  private floorFx(key: string, x: number, y: number, aim: V2, len: number, fms: number[], o: { ox?: number; depth?: number; loop?: [number, number]; until?: () => boolean; alpha?: number; follow?: () => { x: number; y: number } | null; aspect?: number } = {}): void {
    if (!this.scene.textures.exists(key)) return;
    const img = this.scene.add.image(0, 0, key, 0).setOrigin(o.ox ?? 0.07, 0.5).setDisplaySize(len, len / (o.aspect ?? 2)).setBlendMode(Phaser.BlendModes.NORMAL).setAlpha(o.alpha ?? 1)
      .setAngle(Math.atan2(aim.y, aim.x) * (180 / Math.PI));
    const plane = this.scene.add.container(x, y, [img]).setScale(1, FLOOR_SQUASH).setDepth(o.depth ?? GROUND + 3);
    let t = 0, i = 0;
    const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      if (!plane.active) { ev.remove(); return; }
      t += 16; const f = o.follow?.(); if (f) plane.setPosition(f.x, f.y);
      const looping = o.loop && o.until && !o.until();
      while (t >= fms[i] && (i < fms.length - 1 || looping)) { t -= fms[i]; i++; if (looping && i > o.loop![1]) i = o.loop![0]; }
      if (i >= fms.length - 1 && t >= fms[fms.length - 1]) { ev.remove(); this.scene.tweens.add({ targets: plane, alpha: 0, duration: 140, onComplete: () => plane.destroy() }); return; }
      img.setFrame(Math.min(7, i));
    } });
  }

  private impactFlip = false;
  /** Bow Haste ring by caster (ends with the buff or on death). */
  private hasteRing = new Map<string, Phaser.GameObjects.Image>();
  /** Archer arrows in flight: [arrow, streak, glow] + a mote trail; `trail` = streak length at full speed. */
  private arrowFx = new Map<Projectile, { parts: Phaser.GameObjects.Image[]; em: Phaser.GameObjects.Particles.ParticleEmitter; trail: number; glow: number; base: number }>();

  /** A glowing arrow with a light streak and a trail of motes (every archer projectile). */
  private archerArrow(p: Projectile): void {
    const id = p.skill.id, tint = ARROW_TINT[id] ?? 0x7ee35a, len = ARROW_LEN[id] ?? 120, ang = screenAng(p.dx, p.dy);
    const x = p.x, y = p.y - p.z, big = id === 'explosive_arrow' ? 1.2 : 1;
    const leaf = this.scene.textures.exists('afx-arrow') && id !== 'explosive_arrow', lv = level(p.dx, p.dy);
    const arrow = leaf // the painted leaf arrow (level on screen, mirrored to the left)
      ? this.scene.add.image(x, y, 'afx-arrow', 0).setOrigin(lv.flip ? 0.02 : 0.98, 0.5).setFlipX(lv.flip).setAngle(lv.ang).setDisplaySize(len * 1.45, len * 1.45 / 4)
      : this.scene.add.image(x, y, 'arch-arrow').setOrigin(0.97, 0.5).setAngle(ang).setDisplaySize(len, 24 * big).setTint(0xffffff, 0xffffff, tint, tint).setBlendMode(Phaser.BlendModes.NORMAL);
    const streak = this.scene.add.image(x, y, 'arch-streak').setOrigin(1, 0.5).setAngle(ang).setDisplaySize(40, 16 * big).setTint(tint).setBlendMode(Phaser.BlendModes.NORMAL).setAlpha(0.9);
    const glow = this.scene.add.image(x, y, 'arch-glow').setDisplaySize(56 * big, 56 * big).setTint(tint).setBlendMode(Phaser.BlendModes.NORMAL).setAlpha(0.8);
    const em = this.scene.add.particles(0, 0, 'arch-glow', {
      follow: arrow, lifespan: { min: 200, max: 360 }, speed: { min: 6, max: 26 }, scale: { start: 0.16 * big, end: 0 }, alpha: { start: 0.85, end: 0 },
      tint: [tint, 0xffffff], blendMode: 'ADD', frequency: id === 'piercing_arrow' ? 10 : 18, quantity: 1,
    }).setDepth(p.y);
    this.arrowFx.set(p, { parts: [arrow, streak, glow], em, trail: id === 'piercing_arrow' ? 420 : 240, glow: 56 * big, base: arrow.scaleX }); arrow.setScale(arrow.scaleX * 0.15, arrow.scaleY);
  }

  /** Light gathering at the bow during the wind-up, then the release flash (+ shake for heavy shots). */
  private archerCharge(r: CastRun): void {
    const [size, tint, shake] = CHARGE[r.skill.id], T = r.timings, a = r.aim;
    const bow = () => { const c = this.casterPos(r.attackerId); return c ? { x: c.x + a.x * 30, y: c.y - c.z - 56 + a.y * 14 } : null; };
    const p0 = bow(); if (!p0) return;
    const painted = this.scene.textures.exists('afx-charge');
    const glow = this.scene.add.image(p0.x, p0.y, painted ? 'afx-charge' : 'arch-glow', 0).setBlendMode(painted ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD).setDisplaySize(8, 8).setDepth(TOP + 1).setAlpha(0.95);
    if (!painted) glow.setTint(tint);
    const core = this.scene.add.image(p0.x, p0.y, 'arch-glow').setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(4, 4).setDepth(TOP + 2);
    const em = this.scene.add.particles(0, 0, 'arch-glow', { // motes sucked into the bow
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, size * 0.9), quantity: 1 } as never,
      moveToX: 0, moveToY: 0, lifespan: Math.max(140, Math.min(380, T.startup * 0.8)), scale: { start: 0.14, end: 0.04 }, alpha: { start: 0, end: 1 },
      tint: [tint, 0xffffff], blendMode: 'ADD', frequency: 14, quantity: 2,
    }).setDepth(TOP + 1);
    const t0 = this.scene.time.now, ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      const q = bow(), k = Math.min(1, (this.scene.time.now - t0) / Math.max(1, T.startup));
      if (!q || r.phase === 'done' || k >= 1) {
        ev.remove(); em.stop(); this.scene.time.delayedCall(400, () => em.destroy()); glow.destroy(); core.destroy();
        if (q && k >= 1) this.bowFlash(r, Math.min(1.6, size / 90), tint, shake);
        return;
      }
      em.setPosition(q.x, q.y);
      const pulse = 1 + 0.12 * Math.sin(this.scene.time.now / 40), big = painted ? 1.7 : 1;
      glow.setPosition(q.x, q.y).setDisplaySize(size * big * k * pulse, size * big * k * pulse);
      if (painted) glow.setFrame(Math.floor((this.scene.time.now - t0) / 55) % 8);
      core.setPosition(q.x, q.y).setDisplaySize(size * 0.35 * k, size * 0.35 * k);
    } });
  }

  /** Release: a white-hot burst at the bow, a ring of light along the aim, a short shake. */
  private bowFlash(r: CastRun, power: number, tint = ARROW_TINT[r.skill.id] ?? 0x7ee35a, shake = 0): void {
    const c = this.casterPos(r.attackerId); if (!c) return;
    const side = r.aim.x < -0.01 ? -1 : 1, x = c.x + r.aim.x * 38, y = c.y - c.z - 56 + r.aim.y * 14;
    if (r.skill.id === 'multi_shot') { /* the three arrows come out of the muzzle flash on their own */ }
    else if (r.skill.id !== 'arrow_storm' && r.hits.some((h) => h.shape.kind === 'projectile')) this.floorFx('afx-fan', c.x + r.aim.x * 20, c.y + r.aim.y * 20, r.aim, 200 + 160 * Math.min(1.5, power), [30, 35, 45, 60, 70, 80, 90, 110], { ox: 40 / 512 });
    if (this.scene.textures.exists('afx-muzzle')) { const lv = level(r.aim.x, r.aim.y), m = r.skill.id === 'multi_shot' ? 110 : 90 + 60 * power; this.play('afx-muzzle', x, y, m, m, [30, 35, 40, 45, 50, 55, 60, 70], { ox: lv.flip ? 0.86 : 0.14, flip: lv.flip, depth: TOP + 3 })?.setAngle(lv.ang); }
    const f = this.scene.add.image(x, y, 'arch-glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 3).setDisplaySize(40 * power, 40 * power);
    this.scene.tweens.add({ targets: f, scale: f.scale * 1.8, alpha: 0, duration: 160, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
    void side; void tint;
    if (shake > 0 && r.own) (this.cam ?? this.scene.cameras.main).shake(110, shake);
  }

  /** Explosive Arrow: fireball, shock ring, debris, smoke, shake. */
  private archerBlast(x: number, y: number, z: number, radius: number): void {
    if (this.scene.textures.exists('afx-fire')) this.play('afx-fire', x, y - z - 30, radius * 3, radius * 3, [40, 50, 60, 80, 100, 120, 150, 180], { depth: y + 2, fadeLast: 200 });
    else if (this.scene.textures.exists('afx-blast')) this.play('afx-blast', x, y - z + 4, radius * 3.2, radius * 3.2, [40, 50, 60, 80, 100, 120, 150, 180], { oy: 0.88, depth: y + 2, blend: Phaser.BlendModes.NORMAL, fadeLast: 220 });
    else this.spark(IMPACT.explosion.key, x, y - z + 6, 5, radius * 3.6, 1);
    const fl = this.scene.add.image(x, y - z - 20, 'arch-glow').setTint(0xffb050).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 2).setDisplaySize(radius * 1.6, radius * 1.6).setAlpha(0.7);
    this.scene.tweens.add({ targets: fl, alpha: 0, scale: fl.scale * 1.5, duration: 320, onComplete: () => fl.destroy() });

    (this.cam ?? this.scene.cameras.main).shake(160, 0.004);
  }

  /** A scorched, glowing scar on the floor that cools down over a few seconds (archer launchers). */
  groundScar(x: number, y: number, radius: number, tint = 0x52cf3e): void {
    const dark = this.scene.add.ellipse(x, y, radius * 1.6, radius * 0.55, 0x2a1a08, 0.45).setDepth(GROUND + 1);
    const glow = this.scene.add.image(x, y, this.scene.textures.exists('arch-glow') ? 'arch-glow' : 'dmg-glow').setTint(tint).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(GROUND + 1.1).setDisplaySize(radius * 1.8, radius * 0.6).setAlpha(0.8);
    this.scene.tweens.add({ targets: glow, alpha: 0, delay: 300, duration: 1600 });
    this.scene.tweens.add({ targets: dark, alpha: 0, delay: 2200, duration: 900, onComplete: () => { dark.destroy(); glow.destroy(); } });
    this.dust(x, y, 70, 0.5);
  }

  /** An arrow stuck in the floor where it landed (fades after a while). */
  stuckArrow(x: number, y: number, side: number, tint = 0x7ee35a, lifeMs = 2600): void {
    if (!this.scene.textures.exists('arch-stuck')) return;
    const a = this.scene.add.image(x, y + 2, 'arch-stuck').setOrigin(0.5, 0.95).setAngle(side * (18 + Math.random() * 14)).setDepth(y).setScale(0.9 + Math.random() * 0.3);
    a.setTint(0xffffff, 0xffffff, 0xffffff, 0xffffff);
    const g = this.scene.add.image(x, y - 26, 'arch-glow').setTint(tint).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(y + 0.1).setDisplaySize(26, 26).setAlpha(0.5);
    this.scene.tweens.add({ targets: [a, g], alpha: 0, delay: lifeMs, duration: 500, onComplete: () => { a.destroy(); g.destroy(); } });
  }

  /** Falling arrows of light over a ground area (Rain of Arrows / Sky Rain waves); each leaves an arrow in the floor. */
  arrowShower(cx: number, cy: number, rx: number, ry: number, n: number, spreadMs: number, tint = 0x7ee35a, stuck = 0.4, k = 1): void {
    for (let i = 0; i < n; i++) {
      const tx = cx + (Math.random() * 2 - 1) * rx, ty = cy + (Math.random() * 2 - 1) * ry, delay = Math.random() * spreadMs, slant = 0.32;
      this.scene.time.delayedCall(delay, () => {
        const h = 420, sx = tx - h * slant, sy = ty - h;
        const a = this.scene.add.image(sx, sy, 'arch-arrow').setOrigin(0.97, 0.5).setAngle(Math.atan2(h, h * slant) * (180 / Math.PI)).setDisplaySize(130 * k, 26 * k).setTint(0xffffff, tint, tint, tint).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(ty + 1);
        const st = this.scene.add.image(sx, sy, 'arch-streak').setOrigin(1, 0.5).setAngle(a.angle).setDisplaySize(160, 18).setTint(tint).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(ty + 1).setAlpha(0.55);
        this.scene.tweens.add({ targets: [a, st], x: tx, y: ty, duration: 170, ease: 'Quad.easeIn', onComplete: () => {
          a.destroy(); st.destroy();
          const f = this.scene.add.image(tx, ty - 6, 'arch-glow').setTint(tint).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(ty + 1).setDisplaySize(46, 22);
          this.scene.tweens.add({ targets: f, alpha: 0, scaleX: f.scaleX * 1.8, duration: 200, onComplete: () => f.destroy() });
          if (Math.random() < stuck) this.stuckArrow(tx, ty, 1, tint, 1800 + Math.random() * 1200);
        } });
      });
    }
  }

  /** Camera punch: a quick zoom in and back (big skills). */
  punch(amount = 0.05, ms = 260): void {
    const cam = this.cam ?? this.scene.cameras.main, z0 = cam.zoom;
    this.scene.tweens.add({ targets: cam, zoom: z0 * (1 + amount), duration: ms * 0.35, ease: 'Quad.easeOut', yoyo: true, hold: ms * 0.2, onComplete: () => cam.setZoom(z0) });
  }

  /** Spirit hawks by caster: hovers above / behind its archer, flaps in a loop, dives at a foe on every attack. */
  private hawks = new Map<string, { img: Phaser.GameObjects.Image; until: number; t: number; lastX: number; face: number; dive: { to: V3; t: number } | null }>();

  /** One archer sheet timeline (any cell size). */
  private play(key: string, x: number, y: number, w: number, h: number, fms: number[], o: PlayOpts = {}): Phaser.GameObjects.Image | null {
    if (!this.scene.textures.exists(key)) return null;
    const sk = ARCHER_SIZE[key] ?? 1; w *= sk; h *= sk; // archer pieces at the samurai's scale
    const frames = o.frames ?? fms.map((_, i) => i);
    const img = this.scene.add.image(x, y, key, frames[0]).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setDisplaySize(w, h).setFlipX(!!o.flip).setFlipY(!!o.flipY).setAngle(o.angle ?? 0).setDepth(o.depth ?? y)
      .setBlendMode(o.blend ?? Phaser.BlendModes.NORMAL).setAlpha(o.alpha ?? 1); // the archer sheets are re-toned (tools/skills/tone.py): normal blend keeps their colour on the sunny floor (the samurai's pass their blend)
    if (o.alpha !== undefined) img.setData('a0', o.alpha);
    if (o.crop !== undefined) img.setCrop(0, img.frame.height * o.crop, img.frame.width, img.frame.height * (1 - o.crop));
    const a: Anim = { img, t: 0, total: fms.reduce((p, q) => p + q, 0), frames, frameMs: fms, follow: o.follow, z: o.z, fadeLast: o.fadeLast ?? 120, loop: o.loop, until: o.until, loopMs: o.loopMs, crop: o.crop, dz: o.dz };
    this.anims.push(a);
    this.place(a);
    return img;
  }

  /** A sheet drawn around an actor (a ring on the floor, a dome, a coil): the whole picture behind him and its near part —
   *  below `front` of the frame height — again over him, so he stands inside it. Returns [behind, in front]. */
  private playAround(key: string, x: number, y: number, w: number, h: number, fms: number[], front: number, o: PlayOpts & { floorY: number }, near: PlayOpts = {}): (Phaser.GameObjects.Image | null)[] {
    const back = this.play(key, x, y, w, h, fms, { ...o, depth: o.floorY - 3, dz: o.follow ? -3 : undefined });
    const fr = this.play(key, x, y, w, h, fms, { ...o, depth: o.floorY + 3, dz: o.follow ? 3 : undefined, crop: front, ...near });
    return [back, fr];
  }

  private archerCast(r: CastRun): void {
    const s = r.skill, o = r.origin, a = r.aim, T = r.timings, left = a.x < -0.01, side = left ? -1 : 1, key = vfxKey(s.id);
    const me = () => this.casterPos(r.attackerId);
    void a;
    const at = (dx: number, dz = 0) => { const p = me(); return p ? { x: p.x + side * dx, y: p.y, z: p.z + dz } : null; };
    const spread = (n: number, total: number, w = [1, 1, 1.1, 1.2, 1.2, 1.3, 1.4, 1.6]) => { const sum = w.slice(0, n).reduce((p, q) => p + q, 0); return w.slice(0, n).map((q) => Math.round((q / sum) * total)); };
    switch (s.id) {
      case 'rising_arrow': { // the ground cracks, then the arrow bursts UP out of the earth and throws the foe
        const sh = s.hits[0].shape as { bias?: number; radius: number }, bx = o.x + a.x * (sh.bias ?? 90), by = o.y + a.y * (sh.bias ?? 90);
        if (this.scene.textures.exists('afx-rise')) this.play('afx-rise', bx, by - o.z + 4, 130, 260, [T.startup * 0.5, T.startup * 0.5, ...spread(6, T.active + 520, [1, 1, 1.1, 1.3, 1.6, 2.1])], { oy: 0.94, depth: by + 1 });
        else if (this.scene.textures.exists('afx-garrow')) this.play('afx-garrow', bx, by - o.z + 6, 150, 225, [T.startup * 0.5, T.startup * 0.5, ...spread(6, T.active + 620, [1, 1, 1.1, 1.3, 1.6, 2.1])], { oy: 0.97, depth: by + 1 }); // the earth cracks and a great arrow of light bursts up out of it
        else this.play(key, bx, by - o.z, 360, 360, [T.startup * 0.5, T.startup * 0.5, ...spread(6, T.active + 520, [1, 1, 1.1, 1.3, 1.6, 2.1])], { oy: ARCHER_GROUND[s.id], flip: left, depth: by + 1 });
        this.scene.time.delayedCall(T.startup, () => {
          this.shockwave(bx, by, 80, 0x52cf3e, true); this.dust(bx, by, 80, 0.5); // a clean pop, not a blast
          if (r.own) (this.cam ?? this.scene.cameras.main).shake(90, 0.0018);
        });
        break;
      }
      case 'leaping_arrow': { // Binding Leaves: after the long charge a wide band of leaves and vines races across the floor
        const sx = o.x + a.x * 26, sy = o.y + a.y * 26, len = 600;
        this.scene.time.delayedCall(T.startup, () => {
          if (this.scene.textures.exists('afx-rootband')) { // roots creep out of the soil all along the band, hold the caught, then sink back
            this.floorFx('afx-rootband', sx, sy, a, len, [90, 110, 130, 150, 900, 900, 1200, 400], { ox: 0.02, aspect: 3.4, depth: GROUND + 2 });
          } else if (this.scene.textures.exists('afx-vines')) { // vines sprout out of the soil one patch after another, racing along the band, hold, then wither
            const lv = level(a.x, a.y), px = -a.y, py = a.x;
            // a net of leaves creeps over the floor from the archer outwards: many small tufts, staggered and scattered (never one block)
            for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) {
              const d = 40 + i * 46 + (Math.random() - 0.5) * 30, w = (j - 1) * 52 + (Math.random() - 0.5) * 34, sc = 0.55 + Math.random() * 0.35;
              const vx = sx + a.x * d + px * w, vy = sy + (a.y * d + py * w) * FLOOR_SQUASH, view = (this.cam ?? this.scene.cameras.main).worldView;
              if (!view.contains(vx, vy) || !clearLine(sx + px * w, sy + py * w * FLOOR_SQUASH, vx, vy, 30)) continue; // never off screen, never through a stone block (its sides stay open)
              this.scene.time.delayedCall(i * 75 + Math.random() * 60, () => this.play('afx-vines', vx, vy, 170 * sc, 42 * sc, [60, 70, 80, 100, 900, 900, 1700, 450], { oy: 0.8, flip: Math.random() < 0.5 ? lv.flip : !lv.flip, depth: vy, loop: [4, 6], until: 3600 - i * 75, loopMs: 300, fadeLast: 450 })?.setAngle(lv.ang * 0.6 + (Math.random() - 0.5) * 16));
            }
          } else {
            if (this.scene.textures.exists('afx-leaves')) this.floorFx('afx-leaves', sx, sy, a, len, [60, 70, 80, 110, 220, 220, 220, 220], { ox: 0.04, loop: [4, 7], until: () => r.phase === 'done' || r.elapsed > T.startup + 4000 });
            this.leafBand(sx, sy, a, len, 170);
          }
          if (r.own) { (this.cam ?? this.scene.cameras.main).shake(220, 0.005); this.punch(0.03, 220); }
        });
        break;
      }
      case 'retreat_kick': { // a green burst of wind erupts from the ground under the kick and throws the foe up
        const kx = o.x + a.x * 70, ky = o.y + a.y * 30;
        this.scene.time.delayedCall(Math.max(0, T.startup - 40), () => {
          this.groundScar(kx, ky, 54);
          const bootImg = this.scene.textures.exists('afx-boot') ? this.play('afx-boot', kx, ky - o.z - 150, 300, 300, spread(8, T.active + 420), { oy: 0.5, flip: left, depth: ky + 1 }) : null;
          if (bootImg) { // stays on the spot and whirls round in a full circle: a spinning kick, its ghosts drawing the circle behind it
            const spin = { a: 0 };
            this.scene.tweens.add({ targets: spin, a: -side * 360, duration: T.active + 380, ease: 'Cubic.easeOut', onUpdate: () => {
              if (!bootImg.active) return; bootImg.setAngle(spin.a);
              const g = this.scene.add.image(bootImg.x, bootImg.y, 'afx-boot', bootImg.frame.name).setOrigin(0.5, 0.5).setFlipX(bootImg.flipX).setAngle(spin.a).setDisplaySize(bootImg.displayWidth, bootImg.displayHeight).setDepth(bootImg.depth - 0.1).setAlpha(0.25);
              this.scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
            } });
          }
          else if (this.scene.textures.exists('afx-kick')) this.play('afx-kick', kx, ky - o.z + 8, 300, 300, spread(8, T.active + 320), { oy: 0.95, flip: left, depth: ky + 1 }); // the green wind kicks up out of the ground
          else this.play(key, kx, ky - o.z - 70, 260, 260, spread(8, T.active + 200), { flip: left, depth: TOP, alpha: 0.8 });
          this.shockwave(kx, ky, 110, 0x7ee35a, true); this.dust(kx, ky, 90, 0.7);
          if (r.own) (this.cam ?? this.scene.cameras.main).shake(120, 0.003);
        });
        break;
      }
      case 'bow_haste': { // a light, quick gust of green wind spirals round the archer (no burst: the buff aura carries on)
        const q = me() ?? o;
        if (this.scene.textures.exists('afx-haste')) { // a soft green ring of wind and leaves round the feet while the buff lasts
          this.hasteRing.get(r.attackerId)?.destroy();
          const ring = this.play('afx-haste', q.x, q.y + 4, 170, 56, [T.startup, 90, 90, 90, 90, 90, 90, 90], { depth: q.y - 1, alpha: 1, loop: [1, 7], until: T.startup + 120000, loopMs: 95, fadeLast: 400, follow: () => { const c = me(); return c ? { x: c.x, y: c.y - 1, z: -4 } : null; } }); // lies on the floor under the feet (stays on the ground when she jumps)
          if (ring) { this.hasteRing.set(r.attackerId, ring); ring.once('destroy', () => { if (this.hasteRing.get(r.attackerId) === ring) this.hasteRing.delete(r.attackerId); }); }
        }
        this.scene.time.delayedCall(T.startup, () => this.shockwave(q.x, q.y, 70, 0x7ee35a, true));
        break;
      }
      case 'hunters_spirit': {
        const sz = 400, p = me() ?? o;
        this.scene.time.delayedCall(T.startup, () => { const q = me() ?? o; this.shockwave(q.x, q.y, 110, 0xffe27a, true); });
        if (this.scene.textures.exists('afx-gold')) { // the golden arch rises round the body (its ring sits under the feet), glows a moment, then fades: sized to the archer
          const fr = [0, 1, 2, 3, 4, 5, 4, 5, 4, 5, 6, 7], ms = [90, 90, 100, 110, 140, 160, 160, 160, 160, 160, 200, 260];
          this.play('afx-gold', p.x, p.y - p.z, 150, 225, ms, { frames: fr, oy: 378 / 450, depth: p.y + 0.5, fadeLast: 300, follow: () => { const q = me(); return q ? { x: q.x, y: q.y + 0.5, z: q.z } : null; } });
        }
        else this.play(key, p.x, p.y - p.z, sz, sz, spread(8, T.startup + T.active + T.recovery + 200), { oy: ARCHER_GROUND[s.id], depth: p.y + 1, alpha: 0.8, follow: () => { const q = me(); return q ? { x: q.x, y: q.y + 1, z: q.z } : null; } });
        break;
      }
      case 'piercing_arrow': { // Hunter's Resolve: the emblem of a bow and arrow lights up behind the archer (the scene keeps it for 15s)
        this.scene.time.delayedCall(T.startup, () => { const q = me() ?? o; this.shockwave(q.x, q.y, 140, 0x7ee35a, true); this.spiritBow(r); });
        break;
      }
      case 'hunters_roar': { // the wolf spirit roars over the archer; the wave reaches both sides
        const p = me() ?? o;
        this.play(key, p.x, p.y - p.z - 70, 320, 213, [T.startup * 0.4, T.startup * 0.6, 110, 150, 170, 190, 220, 260], { flip: left, depth: p.y - 2, alpha: 0.95, follow: () => { const q = me(); return q ? { x: q.x, y: q.y, z: q.z + 96 } : null; } }); // the wolf spirit stands behind the archer
        this.scene.time.delayedCall(T.startup, () => {
          const q = me() ?? o; this.shockwave(q.x, q.y, 300, 0x52cf3e, true); this.scene.time.delayedCall(140, () => this.shockwave(q.x, q.y, 480, 0x9cf27a, true));
          for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; this.dust(q.x + Math.cos(a) * 170, q.y + Math.sin(a) * 60, 100, 0.55); }
          for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + Math.random() * 0.2; this.scene.time.delayedCall(i * 18, () => this.zigBolt(q.x + Math.cos(a) * 40, q.y + Math.sin(a) * 18, q.x + Math.cos(a) * 250, q.y + Math.sin(a) * 250 * FLOOR_SQUASH, i % 2 ? 0x7fe0ff : 0x9cf27a, 3)); } // lightning bursts out all round (360°)
          if (this.scene.textures.exists('afx-roar')) this.play('afx-roar', q.x, q.y, 620, 310, [50, 60, 70, 80, 90, 100, 120, 150], { depth: GROUND + 2 });
          else this.scene.time.delayedCall(70, () => this.shockwave(q.x, q.y, 380, 0x7fe0ff, true));
          if (r.own) { (this.cam ?? this.scene.cameras.main).shake(320, 0.009); this.punch(0.07, 320); }
        });
        break;
      }
      case 'spirit_hawk': {
        const p = me() ?? o;
        this.spark(IMPACT.archer.key, p.x, p.y - p.z - 90, IMPACT.archer.frames, 120, 0.9);
        const old = this.hawks.get(r.attackerId); old?.img.destroy();
        const hk = this.scene.textures.exists('afx-hawk') ? 'afx-hawk' : key, img = this.scene.add.image(p.x, p.y - p.z - 110, hk, 0).setBlendMode(Phaser.BlendModes.NORMAL).setDisplaySize(170, 170).setAlpha(0);
        for (let i = 0; i < 14; i++) { // a burst of light feathers as the hawk appears
          const f = this.scene.add.image(p.x, p.y - p.z - 110, 'arch-glow').setTint(i % 2 ? 0xffe27a : 0x7ee35a).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(16, 7).setDepth(TOP).setAngle(Math.random() * 360);
          const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
          this.scene.tweens.add({ targets: f, x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d * 0.7 + 30, alpha: 0, angle: f.angle + 200, duration: 600 + Math.random() * 300, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
        }
        this.scene.tweens.add({ targets: img, alpha: 1, duration: 300 });
        const L = s.linger!;
        this.hawks.set(r.attackerId, { img, until: this.scene.time.now + L.startMs + L.everyMs * L.count, t: 0, lastX: p.x, face: side, dive: null });
        break;
      }
      case 'tree_of_life': { // grows beside the archer, sways while it heals, then fades
        const tx = o.x, ty = o.y - 46, life = 20000, grow = [T.startup * 0.2, T.startup * 0.2, T.startup * 0.3, T.startup * 0.3, 160];
        const t2 = this.scene.textures.exists('afx-tree2'), tree = t2 ? this.play('afx-tree2', tx, ty, 260, 390, [...grow.slice(0, 4), life - 900, 300, 300, 300], { oy: 0.94, depth: ty - 1, fadeLast: 300, alpha: 0.88 }) // a slim tree of light: grows, stands still, then breaks into drifting leaves
          : this.play(key, tx, ty, 340, 455, [...grow.slice(0, 4), life + grow[4]], { oy: ARCHER_GROUND.tree_of_life, depth: ty - 1, fadeLast: 1200, blend: Phaser.BlendModes.NORMAL, alpha: 0.95 });
        if (!t2) this.scene.time.delayedCall(T.startup + life - 1200, () => { // as it fades, its leaves drift away
          for (let i = 0; i < 26; i++) { const lf = this.scene.add.image(tx + (Math.random() - 0.5) * 220, ty - 120 - Math.random() * 280, 'arch-glow').setTint(i % 3 ? 0x7ee35a : 0xffe27a).setDisplaySize(14, 6).setDepth(ty).setAngle(Math.random() * 360);
            this.scene.tweens.add({ targets: lf, y: lf.y + 80 + Math.random() * 120, x: lf.x + (Math.random() - 0.3) * 120, angle: lf.angle + 240, alpha: 0, duration: 1200 + Math.random() * 800, delay: Math.random() * 500, onComplete: () => lf.destroy() }); }
        });
        if (tree) { this.trees.add(tree); tree.once('destroy', () => this.trees.delete(tree)); }
        if (this.scene.textures.exists('afx-roots')) { // roots break through the floor round the trunk
          const roots = this.scene.add.image(tx, ty, 'afx-roots').setDepth(GROUND + 1.2).setAlpha(0).setDisplaySize(330, 330 * FLOOR_SQUASH); roots.setScale(0.2 * 330 / roots.width, 0.2 * 330 * FLOOR_SQUASH / roots.height);
          this.scene.tweens.add({ targets: roots, alpha: 0.85, scaleX: 330 / roots.width, scaleY: (330 * FLOOR_SQUASH) / roots.height, delay: T.startup * 0.3, duration: T.startup * 0.7, ease: 'Back.easeOut' });
          this.scene.tweens.add({ targets: roots, alpha: 0, delay: T.startup + life - 600, duration: 600, onComplete: () => roots.destroy() });
        }
        // the heal range: a true circle around the tree (round, not a floor ellipse) — rune ring + soft glow + rim
        const R0 = 260, ring = this.scene.add.image(tx, ty, 'magic-circle').setBlendMode(Phaser.BlendModes.NORMAL).setTint(0x52cf3e).setAlpha(0).setDepth(GROUND + 1).setDisplaySize(2 * R0, 2 * R0);
        const fill = this.scene.add.image(tx, ty, 'arch-glow').setBlendMode(Phaser.BlendModes.NORMAL).setTint(0x4cc23a).setAlpha(0).setDepth(GROUND + 0.9).setDisplaySize(2 * R0, 2 * R0); // softly lit ground, no hard band
        const rim = this.scene.add.circle(tx, ty, R0).setStrokeStyle(3, 0x9cf27a, 0.9).setBlendMode(Phaser.BlendModes.NORMAL).setAlpha(0).setDepth(GROUND + 1.1);
        ring.setVisible(false); rim.setVisible(false); // (no band round the tree: the tree itself is the zone)
        fill.setVisible(false); // (a flat green disc read as a murky stain on the floor: the ring and rim mark the range)
        this.scene.tweens.add({ targets: rim, alpha: { from: 0.85, to: 0.45 }, delay: T.startup + 300, duration: 900, yoyo: true, repeat: Math.floor(life / 1800) });
        this.scene.tweens.add({ targets: ring, angle: 90, delay: T.startup, duration: life });
        this.scene.tweens.add({ targets: [ring, fill, rim], alpha: 0, delay: T.startup + life - 500, duration: 500, onComplete: () => { ring.destroy(); fill.destroy(); rim.destroy(); } });
        this.scene.time.delayedCall(T.startup, () => { this.shockwave(tx, ty, 200, 0x86ec6a, true); this.dust(tx, ty, 110, 0.6); });
        // the trunk is solid from the moment it grows (every client): walk around it or stand behind it, never on it
        this.scene.time.delayedCall(Math.round(T.startup * 0.6), () => SKILL_BLOCKERS.set(r.castId, { x: tx, y: ty, rx: 46, ry: 19 }));
        this.scene.time.delayedCall(T.startup + life, () => SKILL_BLOCKERS.delete(r.castId));
        break;
      }
      case 'arrow_storm': { // Hunter's Rain: dozens of arrows loosed into the sky, then they pour down on the mark (which the archer steers)
        this.scene.time.delayedCall(Math.round(T.startup * 0.55), () => { const q = me() ?? o; for (let k = 0; k < 3; k++) this.scene.time.delayedCall(k * 70, () => this.risingArrows(q.x + side * 14, q.y - q.z - 50, 6, 0x52cf3e, 1.5)); this.shockwave(q.x, q.y, 90, 0xa8f04a, true); });
        { // on the archer while the rain lasts: a ring of runes under the feet and light streaming up from the bow
          const q0 = me() ?? o, rr = this.scene.textures.exists('afx-raura') ? this.play('afx-raura', q0.x, q0.y + 6, 130, 195, [T.startup * 0.5, 90, 90, 90, 90, 90, 90, 90], { oy: 0.93, depth: q0.y - 0.5, alpha: 0.6, loop: [2, 6], until: T.startup + T.active, loopMs: 90, fadeLast: 300, follow: () => { const c = me(); return c ? { x: c.x, y: c.y + 0.5, z: c.z - 6 } : null; } }) : this.scene.textures.exists('afx-haste') ? this.play('afx-haste', q0.x, q0.y + 4, 170, 52, [T.startup * 0.5, 90, 90, 90, 90, 90, 90, 90], { depth: q0.y - 1, loop: [1, 7], until: T.startup + T.active, loopMs: 80, fadeLast: 300, follow: () => { const c = me(); return c ? { x: c.x, y: c.y - 1, z: -4 } : null; } }) : null;
          void rr;
          const up = this.scene.add.particles(0, 0, 'arch-glow', { speedY: { min: -520, max: -380 }, speedX: { min: -30, max: 30 }, lifespan: 420, scaleX: { start: 0.05, end: 0.02 }, scaleY: { start: 0.5, end: 0.2 }, alpha: { start: 0.95, end: 0 }, tint: [0x7ee35a, 0xd8ff8a], blendMode: 'ADD', frequency: 45, quantity: 1, emitting: false });
          const ev2 = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => { const c = me(); if (!c || r.phase === 'done' || r.phase === 'recovery') { ev2.remove(); up.stop(); this.scene.time.delayedCall(500, () => up.destroy()); return; } up.emitting = !rr && r.elapsed > T.startup * 0.6; up.setPosition(c.x + side * 16, c.y - c.z - 70).setDepth(c.y + 2); } });
        }
        const mark = this.scene.add.image(0, 0, this.scene.textures.exists('afx-target') ? 'afx-target' : this.scene.textures.exists('afx-haste') ? 'afx-haste' : 'magic-circle', 0).setDisplaySize(270, 135).setAlpha(0).setDepth(GROUND + 1);
        this.scene.tweens.add({ targets: mark, alpha: 0.95, delay: T.startup * 0.5, duration: 200 });
        let mt = 0;
        const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
          mt += 16; const c = r.place;
          if (!c || r.phase === 'done' || r.phase === 'recovery') { ev.remove(); this.scene.tweens.add({ targets: mark, alpha: 0, duration: 250, onComplete: () => mark.destroy() }); return; }
          mark.setPosition(c.x, c.y).setFrame(Math.floor(mt / 90) % 8);
        } });
        for (const h of r.hits) this.scene.time.delayedCall(T.startup + h.at - 150, () => { // each wave falls where the mark is now
          const c = r.place; if (!c || r.phase === 'done') return;
          if (this.scene.textures.exists('afx-heavy') && h.at % 600 === 0) { const hx = c.x + (Math.random() - 0.5) * 80, hy = c.y + (Math.random() - 0.5) * 30; this.play('afx-heavy', hx, hy + 8, 200, 300, [60, 50, 60, 70, 90, 110, 140, 200], { oy: 0.9, depth: hy + 2, fadeLast: 180 }); this.scene.time.delayedCall(60, () => { if (r.own) (this.cam ?? this.scene.cameras.main).shake(120, 0.004); }); } // every 3rd wave a great arrow slams down
          if (this.scene.textures.exists('afx-rainfall')) for (let k = 0; k < 3; k++) { const fx = c.x + (Math.random() - 0.5) * 170, fy = c.y + (Math.random() - 0.5) * 60; this.scene.time.delayedCall(k * 60, () => { this.play('afx-rainfall', fx, fy + 10, 220, 330, [40, 40, 50, 65, 80, 90, 110, 140], { oy: 0.88, depth: fy + 1, fadeLast: 140 }); this.scene.time.delayedCall(90, () => this.shockwave(fx, fy, 90, 0x52cf3e, true)); }); }
          if (r.own) (this.cam ?? this.scene.cameras.main).shake(80, 0.002);
          else this.arrowShower(c.x, c.y, 95, 42, 7, 150, Math.random() < 0.5 ? 0x7ee35a : 0xa8f04a, 0.12, 1.1);
        });
        break;
      }
      case 'rain_of_arrows': { // Thunder Rain: hanging in the air, the archer fires three lightning arrows down onto the floor (warrior-style blue lightning)
        { // the leap, then 3s of lightning gathering at the bow: a growing orb, crackling bolts, sparks sucked in
          const first = T.startup + r.hits[0].at, orb = this.scene.add.image(0, 0, 'arch-glow').setTint(0x7fe0ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(TOP + 2);
          const core = this.scene.add.image(0, 0, 'arch-glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(TOP + 2.1);
          const bc = this.scene.textures.exists('afx-bcharge') ? this.scene.add.image(0, 0, 'afx-bcharge', 0).setDepth(TOP + 2.3) : null;
          const bolt0 = !bc && this.scene.textures.exists('jb-bolt') ? this.scene.add.image(0, 0, 'jb-bolt', 6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(TOP + 2.2) : null; // the very lightning arrow it will loose, gathering at the bow
          const em = this.scene.add.particles(0, 0, 'arch-glow', { emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 110), quantity: 1 } as never, moveToX: 0, moveToY: 0, lifespan: 380, scale: { start: 0.12, end: 0.03 }, alpha: { start: 0, end: 1 }, tint: [0x7fe0ff, 0xffffff], blendMode: 'ADD', frequency: 22, quantity: 2, emitting: false }).setDepth(TOP + 2);
          let lastBolt = 0;
          const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
            const q = me(), e = r.elapsed;
            if (!q || r.phase === 'done' || e >= first) { ev.remove(); em.stop(); this.scene.time.delayedCall(400, () => em.destroy()); this.scene.tweens.add({ targets: [orb, core], alpha: 0, scale: 0.01, duration: 120, onComplete: () => { orb.destroy(); core.destroy(); } }); bolt0?.destroy(); bc?.destroy(); return; }
            const k = Math.max(0, Math.min(1, (e - T.startup) / (first - T.startup))), bx = q.x + side * 70, by = q.y - q.z - 58, pul = 1 + 0.15 * Math.sin(e / 35);
            if (e < T.startup + 150) return;
            em.emitting = true; em.setPosition(bx, by);
            orb.setPosition(bx, by).setAlpha(bc ? 0.3 : 0.7).setDisplaySize((30 + 90 * k) * pul, (30 + 90 * k) * pul);
            if (bc) { const tx = o.x + a.x * 150, ty = o.y + a.y * 150, sz = (50 + 80 * k) * pul; bc.setPosition(bx, by).setRotation(Math.atan2(ty - by, tx - bx)).setFrame(k < 0.9 ? Math.floor(k / 0.9 * 4) : 4 + (Math.floor(e / 70) % 4)).setDisplaySize(sz, sz); }
            if (bolt0) { const tx = o.x + a.x * 150, ty = o.y + a.y * 150, rot = Math.atan2(ty - by, tx - bx) + Math.PI / 2; bolt0.setPosition(bx, by).setRotation(rot).setAlpha(0.6 + 0.4 * Math.random()).setDisplaySize((30 + 60 * k) * pul, (80 + 170 * k) * pul); } core.setPosition(bx, by).setAlpha(1).setDisplaySize((14 + 40 * k) * pul, (14 + 40 * k) * pul);
            if (e - lastBolt > 140 - 80 * k) { lastBolt = e; const an = Math.random() * Math.PI * 2, rr = 30 + 60 * k; this.zigBolt(bx, by, bx + Math.cos(an) * rr, by + Math.sin(an) * rr, 0x7fe0ff, 2); }
            if (r.own && k > 0.7 && Math.random() < 0.08) (this.cam ?? this.scene.cameras.main).shake(60, 0.0015 * k);
          } });
        }
        for (let i = 0; i < r.hits.length; i++) {
          const h = r.hits[i], sh = h.shape as { bias?: number }, cx = o.x + a.x * (sh.bias ?? 200), cy = o.y + a.y * (sh.bias ?? 200);
          this.scene.time.delayedCall(Math.max(0, T.startup + h.at - 110), () => {
            const q = me(); if (!q) return;
            const sx = q.x + side * 24, sy = q.y - q.z - 56, rot = Math.atan2(cy - sy, cx - sx) + Math.PI / 2;
            if (this.scene.textures.exists('jb-bolt')) { // the lightning arrow flies from the bow down to its point
              const fly = this.scene.add.image(sx, sy, 'jb-bolt', 6).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(90, 230).setRotation(rot).setDepth(TOP);
              this.scene.tweens.add({ targets: fly, x: cx, y: cy - 30, duration: 110, ease: 'Quad.easeIn', onComplete: () => fly.destroy() });
            } else this.zigBolt(sx, sy, cx, cy, 0xc8f4ff, 4);
            this.scene.time.delayedCall(110, () => { // the strike: lightning bursts from the floor, the ground crackles a moment
              if (this.scene.textures.exists('jb-bolt')) this.play('jb-bolt', cx, cy + 6, 230, 460, [50, 70, 80, 90, 110, 140], { frames: [7, 8, 9, 10, 11, 11], oy: 0.95, depth: cy + 2, blend: Phaser.BlendModes.ADD });
              else if (this.scene.textures.exists('afx-bolt')) this.play('afx-bolt', cx, cy, 200, 400, [40, 40, 60, 70, 80, 90, 110, 140], { oy: 0.97, depth: cy + 2 });
              if (this.scene.textures.exists('afx-field')) this.floorFx('afx-field', cx, cy, { x: 1, y: 0 }, 260, [40, 50, 70, 90, 110, 130, 150, 180], { ox: 0.5, depth: GROUND + 2 });
              this.shockwave(cx, cy, 130, 0x5cd6ff, true);
              for (let k = 0; k < 3; k++) { const an = Math.random() * Math.PI * 2, rr = 50 + Math.random() * 60; this.zigBolt(cx, cy, cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.45, 0x9ae8ff, 2); }
              if (r.own) (this.cam ?? this.scene.cameras.main).shake(i === 2 ? 220 : 120, i === 2 ? 0.007 : 0.004);
            });
          });
        }
        break;
      }
      case 'eagle_arrow': { // Eagle Tide: after a 3s charge a gigantic spirit eagle sweeps half the map in front of the archer (aim turned while charging)
        if (this.scene.textures.exists('afx-band')) { // while charging: a painted band of flowing arrows on the floor shows the way; it turns with the aim and grows stronger
          const band = this.scene.add.image(0, 0, 'afx-band', 0).setOrigin(0.02, 0.5).setDisplaySize(960, 300).setAlpha(0);
          const plane = this.scene.add.container(o.x, o.y, [band]).setScale(1, FLOOR_SQUASH).setDepth(GROUND + 2);
          this.scene.tweens.add({ targets: band, alpha: 0.9, duration: 250 });
          const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
            const c = me();
            if (!c || r.phase !== 'startup') { ev.remove(); this.scene.tweens.add({ targets: plane, alpha: 0, duration: 160, onComplete: () => plane.destroy() }); return; }
            const k = Math.min(1, r.elapsed / T.startup), f = Math.min(6, Math.floor(k * 6)) + (Math.floor(r.elapsed / 120) % 2 && k > 0.85 ? 1 : 0);
            plane.setPosition(c.x + r.aim.x * 30, c.y + r.aim.y * 30); band.setAngle(Math.atan2(r.aim.y, r.aim.x) * (180 / Math.PI)).setFrame(Math.min(6, f));
          } });
        }
        this.scene.time.delayedCall(T.startup, () => {
          const a = r.aim, sx = o.x + a.x * 30, sy = o.y + a.y * 30, len = 980;
          if (this.scene.textures.exists('afx-tide')) this.floorFx('afx-tide', sx, sy, a, len, [70, 80, 90, 100, 110, 130, 150, 190], { ox: 0.01, depth: TOP - 6, aspect: 1.05, alpha: 0.8 }); // a wide tide over the floor (the hit is 320 wide)
          this.floorFx('afx-fan', sx, sy, a, 620, [30, 40, 50, 60, 80, 100, 120, 160], { ox: 40 / 512, aspect: 1.3 });
          if (this.scene.textures.exists('afx-muzzle')) { const lv = level(a.x, a.y); this.play('afx-muzzle', sx, sy - 56, 380, 380, [30, 40, 50, 60, 70, 80, 90, 110], { ox: lv.flip ? 0.86 : 0.14, flip: lv.flip, depth: TOP + 3 })?.setAngle(lv.ang); }
          const px = -a.y, py = a.x; // three eagles burst out of the release and spread across the floor's depth as they fly
          for (const [k, d] of [[0, 0], [-1, 70], [1, 140]] as const) this.scene.time.delayedCall(d, () => this.eagleSweep(sx, sy - 56, a, len, T.active + 200 - d, k * 130 * px, k * 130 * py * FLOOR_SQUASH, k === 0 ? 0.8 : 0.58));
          if (r.own) { (this.cam ?? this.scene.cameras.main).shake(500, 0.012); this.punch(0.07, 360); }
        });
        break;
      }
      case 'vine_trap': break; // the mine itself is the effect (onTrap)
      case 'sky_rain': this.skyRain(r); break;
    }
  }

  /** Sky Rain: after the cut-in the whole screen fills with arrows; the last wave flashes and shakes. */
  private skyRain(r: CastRun): void {
    const cam = this.cam ?? this.scene.cameras.main, T = r.timings;
    this.scene.time.delayedCall(T.startup, () => {
      const v = cam.worldView, h = v.height * 0.98, w = h * 3; // uniform scale: wider than the screen, never stretched
      const view = () => ({ x: cam.worldView.centerX, y: cam.worldView.bottom - cam.worldView.height * 0.02, z: 0 });
      void v; void w; void h; void view; // (the painted full-screen sheet looked blurry when stretched: crisp drawn arrows only)
      const g = cam.worldView; // a real storm: dense waves of sharp arrows land all over the visible floor and stay stuck
      const fin = this.scene.textures.exists('afx-finale');
      for (let i = 0; i < (fin ? 3 : 6); i++) this.scene.time.delayedCall(i * 220, () => this.arrowShower(g.centerX, g.y + g.height * 0.62, g.width * 0.52, g.height * 0.22, fin ? 20 : 32, 220, i % 2 ? 0xa8f04a : 0x7ee35a, 0.06, 1.35));
      if (fin) for (let k = -1; k <= 1; k++) for (const row of [0.56, 0.8]) { // the storm lands: whole fields of arrows bite into the floor across the screen
        const fx = g.centerX + k * g.width * 0.34 + (row > 0.6 ? g.width * 0.12 : 0), fy = g.y + g.height * row;
        this.scene.time.delayedCall(260 + (k + 1) * 90 + (row > 0.6 ? 160 : 0), () => this.play('afx-finale', fx, fy, 640, 320, [90, 110, 130, 150, 180, 220, 300, 420], { oy: 0.72, depth: fy + 1, fadeLast: 400 }));
      }
      cam.shake(1400, 0.004);
      this.scene.time.delayedCall(1400, () => {
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
      const img = this.scene.add.image(ax, ay, key, 0).setDepth(TOP + 4).setBlendMode(Phaser.BlendModes.ADD).setTint(0x86ec6a).setDisplaySize(92, 92).setAngle(Math.atan2(by - ay, bx - ax) * (180 / Math.PI));
      this.scene.tweens.add({ targets: img, x: bx, y: by, duration: 120, onComplete: () => { img.destroy(); this.spark(IMPACT.archer.key, bx, by, IMPACT.archer.frames, 80, 0.9); } });
    } else this.spark(IMPACT.archer.key, bx, by, IMPACT.archer.frames, 80, 0.9);
  }

  /** Arrows bursting UP out of the earth at a point (rising arrow, mine), leaving a glowing crack. */
  risingArrows(x: number, y: number, n: number, tint: number, k = 1): void {
    for (let i = 0; i < n; i++) {
      const dx = (i - (n - 1) / 2) * 14 * k, a = this.scene.add.image(x + dx, y + 6, 'arch-arrow').setOrigin(0.97, 0.5).setAngle(-90 + (i - (n - 1) / 2) * 7).setDisplaySize(120 * k, 24 * k)
        .setTint(0xffffff, tint, tint, tint).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(y + 2).setAlpha(0);
      const st = this.scene.add.image(x + dx, y + 6, 'arch-streak').setOrigin(1, 0.5).setAngle(a.angle).setDisplaySize(170 * k, 18 * k).setTint(tint).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(y + 1.9).setAlpha(0);
      this.scene.tweens.add({ targets: [a, st], alpha: 1, duration: 40, delay: i * 30 });
      this.scene.tweens.add({ targets: [a, st], y: y - (230 + Math.random() * 60) * k, x: `+=${dx * 0.6}`, delay: i * 30, duration: 300, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: [a, st], alpha: 0, delay: i * 30 + 220, duration: 160, onComplete: () => { a.destroy(); st.destroy(); } });
    }
  }

  /** A jagged bolt of light between two screen points (lightning skills). */
  zigBolt(x0: number, y0: number, x1: number, y1: number, color: number, w = 3): void {
    const g = this.scene.add.graphics().setDepth(TOP + 1).setBlendMode(Phaser.BlendModes.ADD), n = 7;
    for (const [lw, al, c] of [[w * 3, 0.35, color], [w, 1, 0xffffff]] as const) {
      g.lineStyle(lw, c, al); g.beginPath(); g.moveTo(x0, y0);
      for (let i = 1; i < n; i++) { const t = i / n; g.lineTo(x0 + (x1 - x0) * t + (Math.random() - 0.5) * 22, y0 + (y1 - y0) * t + (Math.random() - 0.5) * 22); }
      g.lineTo(x1, y1); g.strokePath();
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  /** A band of swirling leaves along the floor in the aim direction (Binding Leaves). */
  private leafBand(x: number, y: number, a: V2, len: number, width: number, count = 44): void {
    const px = -a.y, py = a.x;
    for (let i = 0; i < count; i++) {
      const t = Math.random(), w = (Math.random() - 0.5) * width, tx = x + a.x * len * t + px * w, ty = y + (a.y * len * t + py * w) * FLOOR_SQUASH;
      const lf = this.scene.add.image(x, y, 'arch-glow').setTint(i % 3 ? 0x4cc23a : 0xa8f04a).setBlendMode(Phaser.BlendModes.NORMAL).setDisplaySize(18, 8).setDepth(ty + 1).setAngle(Math.random() * 360).setAlpha(0.95);
      this.scene.tweens.add({ targets: lf, x: tx, y: ty - 10, angle: lf.angle + 300, duration: 200 + t * 260, ease: 'Quad.easeOut' });
      this.scene.tweens.add({ targets: lf, alpha: 0, delay: 900 + Math.random() * 2600, duration: 500, onComplete: () => lf.destroy() });
    }
  }

  /** Eagle Tide: the spirit eagle (drawn from above) races across half the map with a wake of light. */
  private eagleSweep(x: number, y: number, a: V2, len: number, ms: number, spreadX = 0, spreadY = 0, k = 1): void {
    const side = this.scene.textures.exists('afx-eagle2'), ek = side ? 'afx-eagle2' : 'afx-eagle';
    if (!this.scene.textures.exists(ek)) return;
    const lv = level(a.x, a.y), ox = side ? 0.92 : 488 / 512;
    const img = this.scene.add.image(x, y, ek, 0).setOrigin(lv.flip && side ? 1 - ox : ox, 0.5).setDisplaySize((side ? 760 : 640) * k, (side ? 380 : 320) * k).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(TOP - 4).setAngle(side ? lv.ang : screenAng(a.x, a.y)).setFlipX(side && lv.flip).setAlpha(0.95);
    let t = 0;
    const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      t += 16; const k = Math.min(1, t / ms), e = 1 - (1 - k) * (1 - k);
      const sp = Math.min(1, e * 2.5); img.setPosition(x + a.x * len * e + spreadX * sp, y + a.y * len * e * 0.5 + spreadY * sp).setScale(img.scaleX, img.scaleY).setFrame(Math.floor(t / 55) % 8).setAlpha(k > 0.8 ? (1 - k) / 0.2 : 1);
      if (Math.floor(t / 48) !== Math.floor((t - 16) / 48)) { const g = this.scene.add.image(img.x, img.y, ek, img.frame.name).setOrigin(img.originX, 0.5).setDisplaySize(img.displayWidth, img.displayHeight).setAngle(img.angle).setFlipX(img.flipX).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(TOP - 5).setAlpha(0.3); this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() }); }
      if (k >= 1) { ev.remove(); img.destroy(); }
    } });
  }

  /** Bow Haste: a gentle, fast green gust spiralling round the archer. */
  windSwirl(attackerId: string, ms: number): void {
    const parts = Array.from({ length: 6 }, (_, i) => this.scene.add.image(0, 0, 'arch-streak').setTint(i % 2 ? 0x4cc23a : 0x9cf27a).setBlendMode(Phaser.BlendModes.NORMAL).setDisplaySize(90, 12).setAlpha(0));
    let t = 0;
    const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      t += 16; const c = this.casterPos(attackerId), k = t / ms;
      if (!c || k >= 1) { ev.remove(); for (const p of parts) p.destroy(); return; }
      parts.forEach((p, i) => {
        const an = t / 90 + (i * Math.PI) / 3, h = 20 + 80 * ((k * 1.4 + i / 6) % 1), front = Math.sin(an) > 0;
        p.setPosition(c.x + Math.cos(an) * 34, c.y - c.z - h + Math.sin(an) * 9).setAngle((an * 180) / Math.PI + 90).setDepth(c.y + (front ? 2 : -2)).setAlpha(0.9 * Math.sin(Math.PI * k));
      });
    } });
  }

  /** Spirit Bow: a great green bow of light floats beside the archer, turned to the aim, drawing and loosing on its own while it lasts. */
  private spiritBow(r: CastRun): void {
    const painted = this.scene.textures.exists('afx-sbow'), key = painted ? 'afx-sbow' : this.scene.textures.exists('afx-emblem') ? 'afx-emblem' : 'afx-charge';
    const img = this.scene.add.image(0, 0, key, 0).setDisplaySize(180, 180).setAlpha(0).setScale(0.01);
    const halo = this.scene.add.image(0, 0, 'arch-glow').setTint(0x52cf3e).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(200, 200).setAlpha(0);
    this.scene.tweens.add({ targets: img, alpha: 1, scaleX: 180 / img.width, scaleY: 180 / img.height, duration: 260, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: halo, alpha: 0.35, duration: 260 });
    const motes = this.scene.add.particles(0, 0, 'arch-glow', { speed: { min: 10, max: 40 }, lifespan: { min: 400, max: 700 }, scale: { start: 0.1, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0x9cf27a, 0xffe27a], blendMode: 'ADD', frequency: 40, emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 70), quantity: 1 } as never });
    let t = 0;
    const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      t += 16; const c = this.casterPos(r.attackerId);
      if (!c || r.phase === 'done' || r.phase === 'recovery') { ev.remove(); motes.stop(); this.scene.tweens.add({ targets: [img, halo], alpha: 0, duration: 300, onComplete: () => { img.destroy(); halo.destroy(); motes.destroy(); } }); return; }
      const a = r.aim, up = a.y < -0.3, lv = level(a.x, a.y), side = a.x < -0.01 ? -1 : 1;
      const x = c.x + side * 60, y = c.y - c.z - 70 + Math.sin(t / 260) * 5; // floats at the shoulder on the aim side
      void lv; const vert = up && Math.abs(a.x) < 0.1, aimDeg = vert ? -90 : up ? (side > 0 ? -45 : -135) : side > 0 ? 0 : 180, ang = painted ? (vert ? -90 : up ? -45 * side : 0) : aimDeg + 90, draw = 1 - 0.08 * Math.max(0, Math.sin((t % 250) / 250 * Math.PI)); // the painted bow points up: turned so its arrow points along the aim (level, or up at an angle)
      img.setPosition(x, y).setAngle(ang).setFlipX(painted && side < 0).setDepth(c.y + 3).setFrame(painted ? (Math.floor(((t % 250) / 250) * 8) + 3) % 8 : Math.floor(t / 90) % 8) // the bow draws and looses in time with every shot.setScale(180 / img.width, (180 / img.height) * draw);
      halo.setPosition(x, y).setDepth(c.y + 2.9); motes.setPosition(x, y).setDepth(c.y + 3.1);
    } });
  }

  /** Hunter's Resolve: the bow-and-arrow emblem stands behind the archer while it lasts. */
  bowEmblem(attackerId: string, ms: number): void {
    if (this.scene.textures.exists('afx-resolve')) { // a spirit armour of leaves: wings, a bow of light over the head, a shield of light
      const img = this.scene.add.image(0, 0, 'afx-resolve', 0).setOrigin(0.5, 0.95).setDisplaySize(170, 255).setAlpha(0);
      this.scene.tweens.add({ targets: img, alpha: 0.9, duration: 300 });
      let t = 0;
      const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
        t += 16; const c = this.casterPos(attackerId);
        if (!c || t >= ms) { ev.remove(); this.scene.tweens.add({ targets: img, alpha: 0, duration: 400, onComplete: () => img.destroy() }); return; }
        img.setPosition(c.x, c.y - c.z + 8).setDepth(c.y + 0.5).setFrame(Math.floor(t / 110) % 8);
        if (ms - t < 1500) img.setAlpha(0.9 * (0.5 + 0.5 * Math.sin(t / 60)));
      } });
      return;
    }
    const painted = this.scene.textures.exists('afx-emblem');
    const img = this.scene.add.image(0, 0, painted ? 'afx-emblem' : 'afx-charge', 0).setBlendMode(painted ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD).setDisplaySize(painted ? 270 : 190, painted ? 270 : 190).setAlpha(0);
    const halo = this.scene.add.image(0, 0, 'arch-glow').setTint(0x52cf3e).setDisplaySize(240, 240).setAlpha(0);
    this.scene.tweens.add({ targets: halo, alpha: 0.35, duration: 300 });
    if (!painted) img.setTint(0x7ee35a);
    this.scene.tweens.add({ targets: img, alpha: 0.85, duration: 300 });
    let t = 0;
    const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      t += 16; const c = this.casterPos(attackerId);
      if (!c || t >= ms) { ev.remove(); this.scene.tweens.add({ targets: [img, halo], alpha: 0, duration: 400, onComplete: () => { img.destroy(); halo.destroy(); } }); return; }
      img.setPosition(c.x, c.y - c.z - 70).setDepth(c.y - 4).setFrame(Math.floor(t / 90) % 8); halo.setPosition(c.x, c.y - c.z - 70).setDepth(c.y - 4.1);
      if (ms - t < 1500) img.setAlpha(0.85 * (0.5 + 0.5 * Math.sin(t / 60))); // about to end: blinks
    } });
  }

  /** Trees of Life on the floor (for the see-through when someone walks behind one). */
  private trees = new Set<Phaser.GameObjects.Image>();
  treeFade(px: number, py: number): void {
    for (const t of this.arch.trees) { // the archer's tree of light: see-through while someone stands behind it
      const behind = py < t.y - 30 && py > t.y - 260 && Math.abs(px - t.x) < 90, want = behind ? 0.45 : 1, f = (t.getData('fade') as number | undefined) ?? 1;
      t.setData('fade', f + (want - f) * 0.2);
    }
    for (const t of this.trees) {
      const behind = py < t.y - 12 && py > t.y - 240 && Math.abs(px - t.x) < 120, want = behind ? 0.5 : 1; // only when the body is hidden by the tree
      t.setData('a0', (t.getData('a0') ?? 1) + (want - (t.getData('a0') ?? 1)) * 0.2);
      t.setAlpha(t.getData('a0') as number);
    }
  }

  /** Tree of Life: an apple drops from the canopy and rolls to the healed player; `onLand` heals. */
  appleDrop(tree: { x: number; y: number }, to: () => V3 | null, onLand: () => void): void {
    const n = Math.floor(Math.random() * 4), tex = n && this.scene.textures.exists(`afx-apple-${n}`) ? `afx-apple-${n}` : this.scene.textures.exists('afx-apple') ? 'afx-apple' : 'arch-glow';
    const sx = tree.x + (Math.random() - 0.5) * 160, sy = tree.y - 300 - Math.random() * 120;
    const ap = this.scene.add.image(sx, sy, tex).setDisplaySize(34, 34).setDepth(TOP - 2);
    if (tex === 'arch-glow') ap.setTint(0xe84a3a);
    let t = 0;
    const ev = this.scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      t += 16; const p = to(), k = Math.min(1, t / 520);
      if (!p) { ev.remove(); ap.destroy(); return; }
      const ex = p.x, ey = p.y - p.z - 40, arc = -110 * Math.sin(Math.PI * k);
      ap.setPosition(sx + (ex - sx) * k, sy + (ey - sy) * k * k + arc * 0.3).setAngle(t * 0.6);
      if (k >= 1) { ev.remove(); onLand(); this.scene.tweens.add({ targets: ap, scale: ap.scale * 1.8, alpha: 0, duration: 200, onComplete: () => ap.destroy() }); }
    } });
  }

  /** Spirit Hawk dive: the hawk swoops onto the foe and back. */
  hawkDive(attackerId: string, to: V3): void { if (this.arch.ready) { this.arch.hawkDive(attackerId, to); return; } const h = this.hawks.get(attackerId); if (h) h.dive = { to, t: 0 }; }
  /** Hunter's Mark: leaves over a foe's head / spent in a burst (ArcherFx). */
  /** Gambler: charged cards stuck in a target / set off by a staff blow / the Hand over his shoulder / his buffs. */
  gambleStick(id: string, n: number, double = false): void { this.gamb.stick(id, n, double); }
  gambleDetonate(id: string, n: number, hot: boolean): void { this.gamb.detonate(id, n, hot); }
  gambleHand(cards: Card[], value: HandValue | null, counting: boolean): void { this.gamb.showHand(cards, value, counting); }
  gamblePlaceHand(at: { x: number; y: number } | null, face: number): void { this.gamb.placeHand(at, face); }
  gambleDealt(from: V3 | null, to: { x: number; y: number } | null, c: Card): void { this.gamb.dealt(from, to, c); }
  gambleShowdown(castId: string, cards: Card[], value: HandValue | null, at: V3): void { this.gamb.showdownHand(castId, cards, value, at); }
  gambleOverload(id: string, ms: number): void { this.gamb.overload(id, ms); }
  gambleLuck(id: string, ms: number): void { this.gamb.luck(id, ms); }
  gambleClear(id: string): void { this.gamb.clearBuffs(id); }
  cardStep(x: number, y: number, dir: number): void { this.gamb.cardStep(x, y, dir); }
  gambleZone(id: string, x: number, y: number, r: number): void { this.gamb.zone(id, x, y, r); }
  gambleFollow(skill: string, id: string, hit: number, by?: string): void { this.gamb.follow(skill, id, hit, by); }
  cheatDeath(x: number, y: number): void { this.gamb.cheatDeath(x, y); }
  archerMark(id: string, n: number, ms: number): void { this.arch.mark(id, n, ms, () => this.targetPos?.(id) ?? null); }
  archerMarkSpend(id: string, n: number, _kind: string): void { this.arch.markSpend(id, n, () => this.targetPos?.(id) ?? null); }

  private stepHawks(ms: number): void {
    const now = this.scene.time.now;
    for (const [id, h] of this.hawks) {
      const c = this.casterPos(id);
      if (!c || now >= h.until) { this.hawks.delete(id); this.scene.tweens.add({ targets: h.img, alpha: 0, duration: 300, onComplete: () => h.img.destroy() }); continue; }
      h.t += ms;
      h.lastX = c.x;
      // roams the sky round the archer: a wide, lazy figure-eight, banking as it turns (never parked on the body)
      // flies like a bird: picks a new spot round the archer every so often and steers to it (eases, overshoots, banks), with a gentle bob
      const W = h as unknown as { wx?: number; wy?: number; vx?: number; vy?: number; px?: number; py?: number; next?: number };
      if (W.px === undefined) { W.px = c.x; W.py = c.y - c.z - 110; W.vx = 0; W.vy = 0; W.next = 0; }
      if ((W.next ?? 0) <= h.t || Math.hypot((W.wx ?? 0) - c.x, (W.wy ?? 0) - (c.y - c.z)) > 260) {
        const an = Math.random() * Math.PI * 2, rr = 70 + Math.random() * 120; W.wx = c.x + Math.cos(an) * rr; W.wy = c.y - c.z - 95 - Math.abs(Math.sin(an)) * 70 - Math.random() * 30; W.next = h.t + 900 + Math.random() * 1400;
      }
      const dt = ms / 1000, ax = ((W.wx ?? c.x) - W.px!) * 6 - W.vx! * 3.2, ay = ((W.wy ?? c.y) - W.py!) * 6 - W.vy! * 3.2;
      W.vx! += ax * dt; W.vy! += ay * dt; W.px! += W.vx! * dt; W.py! += W.vy! * dt;
      const homeX = W.px!, homeY = W.py! + Math.sin(h.t / 140) * 3;
      if (Math.abs(W.vx!) > 12) h.face = W.vx! > 0 ? 1 : -1;
      h.img.setAngle(Math.max(-18, Math.min(18, W.vy! * 0.12)) * h.face); // banks with its climb / dive
      let x = homeX, y = homeY, face = h.face;
      if (h.dive) { // 180 ms out, 220 ms back
        h.dive.t += ms;
        const tx = h.dive.to.x, ty = h.dive.to.y - h.dive.to.z, out = Math.min(1, h.dive.t / 180), back = Math.max(0, (h.dive.t - 180) / 220);
        face = tx >= homeX ? 1 : -1;
        if (back <= 0) { x = homeX + (tx - homeX) * out; y = homeY + (ty - homeY) * out; }
        else { x = tx + (homeX - tx) * back; y = ty + (homeY - ty) * back; face = -face; }
        if (h.dive.t >= 180 && h.dive.t - ms < 180) { if (this.scene.textures.exists('afx-dive')) this.play('afx-dive', tx, ty - 30, 150, 150, [70, 90, 120], { frames: [5, 6, 7], flip: face < 0, depth: h.dive.to.y + 3 }); else this.spark(IMPACT.archer.key, tx, ty, IMPACT.archer.frames, 100, 0.95); } // the dive bursts into feathers on the foe
        if (back >= 1) h.dive = null;
      }
      const diving = !!h.dive && h.dive.t < 180 && this.scene.textures.exists('afx-dive'), fly = this.scene.textures.exists('afx-hawk') ? 'afx-hawk' : h.img.texture.key;
      if (diving) h.img.setTexture('afx-dive', Math.min(4, Math.floor((h.dive!.t / 180) * 5))).setDisplaySize(120, 120); // swoops down onto the foe
      else h.img.setTexture(fly, Math.floor(h.t / 80) % 8).setDisplaySize(105, 105);
      if (h.dive) h.img.setAngle(0);
      h.img.setPosition(x, y).setFlipX(face < 0).setDepth(h.dive ? c.y + 3 : y + 140 < c.y - c.z ? c.y - 3 : c.y + 3);
      if (h.dive && h.dive.t < 400 && Math.floor(h.dive.t / 40) !== Math.floor((h.dive.t - ms) / 40)) { // afterimages on the dive
        const g = this.scene.add.image(x, y, h.img.texture.key, h.img.frame.name).setFlipX(face < 0).setDisplaySize(h.img.displayWidth, h.img.displayHeight).setBlendMode(Phaser.BlendModes.NORMAL).setAlpha(0.45).setDepth(c.y + 2);
        this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
      }
    }
  }

  // ------------------------------------------------------------------ samurai (SamuraiFx: every effect built from its pieces)

  /** Shinsoku (the samurai's mid-air dash). */
  shinsoku(x: number, y: number, dir: number): void { this.sam.shinsoku(x, y, dir); }
  /** Willow Dodge: where he slipped aside. */
  mirageDodge(x: number, y: number, dir: number): void { this.sam.willowDodge(x, y, dir); }
  /** Final Cut: the ghost blade that follows a hit. */
  ghostCut(at: V3, dir: number, big = false): void { this.sam.finalCut(at, dir, big); }
  /** God of Blades: a blade of the halo flies at a foe. */
  bladeStrike(attackerId: string, to: V3, targetId?: string): void { this.sam.bladeStrike(attackerId, to, targetId); }
  /** God of Blades: its halo is gone (the buff ended, its samurai fell or left). */
  clearHalo(attackerId: string, now = false): void { this.sam.clearHalo(attackerId, now); }
  /** Rising Sun's light on him ends (he fell, his buffs end). */
  clearSun(attackerId: string): void { this.sam.clearSun(attackerId); }
  /** Stunned by a samurai's AMBUSH: a crown of petals over the head for the stun. */
  samStun(id: string, ms: number): void { this.sam.stunCrown(id, ms); }
  // ---- the book mage's lasting effects and reactions (MageFx)
  weave(id: string, n: number, lost: boolean): void { this.mage.weave(id, n, lost); }
  grandWeave(id: string): void { this.mage.grandWeave(id); }
  rewind(id: string, from: V3, to: V3): void { this.mage.rewind(id, from, to); }
  levitate(id: string, at: () => V3 | null): void { this.mage.levitate(id, at); }
  gates(id: string, a: V2, b: V2, ms: number): void { this.mage.gates(id, a, b, ms); }
  gatePass(from: V2, to: V2, z: number): void { this.mage.gatePass(from, to, z); }
  barrier(at: V3, from: { x: number; y: number }): void { this.mage.barrier(at, from); }
  wardHit(id: string, broken: boolean, expired = false): void { this.mage.wardHit(id, broken, expired); }
  mageWard(id: string, ms: number): void { this.mage.ward(id, ms); }
  mageAura(id: string, kind: 'haste' | 'ascension', ms: number): void { this.mage.aura(id, kind, ms); }
  clearMage(id: string): void { this.mage.clear(id); }
  conductArc(a: V3, b: V3): void { this.mage.conductArc(a, b); }
  runeBeam(A: Trap, B: Trap, g: Phaser.GameObjects.Graphics, now: number): void { this.mage.runeBeam(A, B, g, now); }
  runeBeamBreak(A: Trap, B: Trap, at: V3): void { this.mage.runeBeamBreak(A, B, at); }
  /** A magic reaction on a foe (chill, freeze, shatter, conduct, curse, levity); the foe's id: it follows him for `ms`. */
  mageReaction(rx: string, at: V3, id?: string, ms = 0): void { this.mage.reaction(rx, at, id ? () => this.targetPos?.(id) ?? null : undefined, ms); }
  /** Kagemusha: he vanishes; one of the three steps out of the ink; a double bursts into petals / melts into ink. */
  kageVanish(at: V3): void { this.sam.kageVanish(at); }
  kageAppear(at: V3): void { this.sam.kageAppear(at); }
  kageBurst(at: V3): void { this.sam.kageBurst(at); }
  kageFade(at: V3): void { this.sam.kageFade(at); }
  kageFeint(at: V3, face: number, stage: number): void { this.sam.kageFeint(at, face, stage); }
  /** A samurai's foe hits the floor / skids back: dust the colour of the ground. */
  samLanding(x: number, y: number): void { this.sam.landing(x, y); }
  samSkid(x: number, y: number): void { this.sam.skid(x, y); }

  /** The world darkens round the fight for `ms` (big skills). */
  /** A soft additive flash of light over the whole view. */
  screenFlash(color: number, alpha: number, ms: number): void {
    const cam = this.cam ?? this.scene.cameras.main, v = cam.worldView;
    const f = this.scene.add.rectangle(v.x - 100, v.y - 100, v.width + 200, v.height + 200, color, alpha).setOrigin(0, 0).setDepth(TOP + 40).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: f, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
  }
  darken(ms: number, alpha: number): void {
    const cam = this.cam ?? this.scene.cameras.main;
    if (!this.dark) this.dark = this.scene.add.rectangle(0, 0, 4000, 3000, 0x05030a, 0).setOrigin(0, 0).setDepth(TOP - 10);
    this.dark.setPosition(cam.worldView.x - 200, cam.worldView.y - 200);
    this.darkLeft = Math.max(this.darkLeft, ms);
    this.scene.tweens.add({ targets: this.dark, fillAlpha: alpha, duration: 200 });
  }

  destroy(): void {
    SKILL_BLOCKERS.clear();
    for (const f of this.arrowFx.values()) { for (const o of f.parts) o.destroy(); f.em.destroy(); }
    this.arrowFx.clear();
    for (const h of this.hawks.values()) h.img.destroy();
    this.hawks.clear();
    this.sam.destroy();
    this.mage.destroy();
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
