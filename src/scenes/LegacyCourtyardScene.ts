// Legacy Courtyard — PvE training ground and PvP V1 arena on one combat foundation:
// CombatInput (double-tap run, jump, Space/1–7, mouse aim, buffer) → real x/y/z kinematics with the stone pedestal as a
// platform → combat state (hit-stun / launch / knockdown / getup / hard CC with DR) → final 4-class kits on the shared
// SkillRuntime with hit-confirm cancels, combo scaling and juggle budget → confirmed-hit feedback (damage numbers, combo
// counter, hit-stop / shake hierarchy) → HUD, Skill Book (K), Inventory (I) and Cosmetic Shop (O).
import Phaser from 'phaser';
import WORLD from '../data/legacy-courtyard.json';
import ATLAS from '../data/asset-manifest.json';
import COMBAT_ASSETS from '../data/stage5-assets.json';
import S6 from '../data/stage6-combat.json';
import TRAINING from '../data/training-combat.json';
import { CHARACTER_PREVIEWS, CLASS_NAMES, FONT_FAMILY, HUD, PVP, STAGE6 } from '../config/layout';
import { CharacterStore } from '../characters/CharacterStore';
import { GearState, GearStats, JOB_SET, attackMul, gearStats, giveItem, starterGear, takenMul, wornCode, wornLook } from '../items/Gear';
import { WorldHUD } from '../ui/WorldHUD';
import { HudEffect, HudMarker, HudSlot, HudState, PortraitRef } from '../ui/hud/HudState';
import { Character } from '../characters/CharacterTypes';
import { Dir } from '../world/collision';
import type { CursedSwordsman } from '../world/CursedSwordsman';
import { showLoading } from '../ui/LoadingScreen';
import { CHAT_MAX_LEN, ChatBox, ChatKind, EMOTES } from '../ui/ChatBox';
import { SpeechBubbles } from '../ui/SpeechBubbles';
import { QuestLog, QuestTracker } from '../ui/HudExtras';
import { KeySettings } from '../ui/KeySettings';
import { BindAction, SLOT_COUNT, keyLabel, loadBindings, slotKeyLabels } from '../game/KeyBindings';
import { CourtyardAmbience } from '../world/Ambience';
import { allSkillsOpen, setAllSkillsOpen } from '../skills/Unlock';
import { Party } from '../pvp/Party';
import { PartyUI, PartyView } from '../ui/PartyUI';
import { addExp, expToNext } from '../game/Progression';
import { passiveIconUrl, passivesFor } from '../skills/Passives';
import { LEVITATE, NO_PASSIVES, ORBS, PassiveStats, REGEN, SHINSOKU, WAR_LEAP, WEAVE, ownedPassives, passiveStats } from '../skills/Passives';
import { SKILL_BLOCKERS, WORLD_OBJECTS, actorDepth, supportAt, footAllowed, insideArena, placementOk, pushOutOfBlockers, useArenaGeometry } from '../world/WorldGeometry';
import { OpenWorld, preloadOpenWorld } from '../world/OpenWorld';
import { AreaNpc, IDLE_LINES, MOB_KINDS, QUESTS, QuestDef, START, TOWERS, type Tower, toWorld } from '../world/Areas';
import type { Monster } from '../world/Monster';
import { AreaTitle, DialogChoice, NpcDialog } from '../ui/WorldUI';
import { QuestState } from '../characters/CharacterTypes';
import { isQAMode } from '../qa/QAPanel';
import { PvpController } from '../pvp/PvpController';
import { Match, MatchPhase } from '../pvp/Match';
import { BattleHUD, Fighter } from '../ui/BattleHUD';
import { ComboGuide } from '../ui/ComboGuide';
import { addResult, scoreKey } from '../pvp/Score';
import { clearPvpFromUrl, newPlayerId } from '../pvp/Room';
import { NetMsg, PeerMeta } from '../pvp/Transport';
import { genderOf, headLookOf, previewKeyOf } from '../characters/Look';
import { buildLook, preloadLooks } from '../characters/LookArt';
import { BOT_ID, BOT_NAME, BOT_NAMES, SparringBot } from '../pvp/SparringBot';
import { RARITY, BAG_MAX, DEFAULT_QUICK, GOLD_BIG, GOLD_ICON, GOLD_MAX, ITEMS, ITEM_IDS, POTION_DELAY, STARTER_BAG, cleanBag, cleanQuick, fmtGold, rollDrops, usable, type Drop } from '../game/Loot';
import { AP_PER_LEVEL, BASE_STAT, STAT_KEYS, Derived, StatKey, Stats, autoAssign, baseStats, cleanStats, derive, freeAp, mainStats } from '../game/Stats';
import { ShopWindow } from '../ui/ShopWindow';
import { StatsWindow } from '../ui/StatsWindow';
import { ARENA as PLAZA, AREAS as WORLD_AREAS } from '../world/Areas';
import { jobsFor } from '../skills/Jobs';
import { CombatInput } from '../game/CombatInput';
import { ActorView, Equipped, preloadCosmetics, skinColor, grayKey, damageSkin, wantsWeaponMasks } from '../game/ActorView';
import { ensureLightBeam } from '../skills/SkillFx';
import HANDS from '../data/judgment-hands.json';
import { baseLoop, ClassKey, dirOf, HERO_LIFT, heroPortrait, loadBaseLook, loadGear, preloadBodies, registerBodies, resolvePose, PoseFrame, sideAim } from '../game/Body';
import { AnimSnap, LAND_MS, Mode, RECOVER_MS, castSeed, poseQuery } from '../game/PoseState';
import { ARENA, CombatBody, GAUGE, HitOutcome, Kin, MAGE, PHYS, jump, newKin, settleOnBlocks, steer, stepKin } from '../combat/Combat';
import { FinalSkill, HitEvent } from '../skills/SkillTypes';
import { MAGE_HIDDEN, arenaTimeScale, finalSkill, iconUrl, kitFor } from '../skills/FinalKit';
import { CastRun, RT_EVENTS, SkillRuntime, Trap } from '../skills/SkillRuntime';
import type { Projectile } from '../skills/HitGeometry';
import { Afterimages, applyMotion, archerMotion, heroMotion, leapMotion } from '../skills/ArcherMotion';
import { SAMURAI_AFTER, TORNADO, samuraiMotion, samuraiSeen, shinsokuMotion, tornadoPath } from '../skills/SamuraiMotion';
import { KAGE, KageLocal, kageTarget } from '../skills/Kagemusha';
import { HitTarget, V2, V3, clampAim, clampPlace, shapeContains, unit } from '../skills/HitGeometry';
import { SkillFx, preloadSkillFx } from '../skills/SkillFx';
import { BEGINNER_TO, JOBS_OPEN, TEST_MIN_LEVEL, hasJob, jobOfSlot, playedClass, skillLevel } from '../skills/Jobs';
import { DeathFx, preloadDeathFx } from '../game/DeathFx';
import { SkillBook } from '../ui/SkillBook';
import { CosmeticPanel } from '../ui/CosmeticPanel';
import { preloadPanelArt } from '../ui/PreviewStage';
import { addMotes, preloadLife } from '../ui/PresentationLife';
/** The panels' keys (Key Settings) for the HUD's menu pills and gear menu. */
const menuKeys = (b: Record<BindAction, string>) => ({ K: keyLabel(b.book), I: keyLabel(b.bag), O: keyLabel(b.shop), J: keyLabel(b.quests), P: keyLabel(b.party), U: keyLabel(b.stats) });

const D = TRAINING.dummy;
const R = PHYS.footR;
const P6 = STAGE6.player;
const TOP_DEPTH = 100000;
/** A Master's HP in his trial (the Sun Seal Plaza). */
const TRIAL_HP = 200; // (the world's own scale, not the arena's)
/** Hit in the world (a monster, a Master's trial): untouchable this long (ms), blinking all the while (MapleStory-style). */
const HIT_IFRAMES = 2000, HIT_BLINK = 90;
/** Radiant Blade: the warrior's attacks this many times faster while the blade of light is on. */
const RADIANT_SPEED = 3;
/** God of Blades: the halo's katanas (each one that flies is spent). */
const GOD_BLADES = 8;
/** World damage roll: from this fraction of the maximum up to it (MapleStory's mastery). */
const STAT_MASTERY = 0.8;
/** MP (MapleStory-style): every skill but the regular attack spends it; it refills over time (a share of the max a second). */
/** Testing: skills cost no MP for now (turn back to false to spend MP again). */
const MP_FREE = true;
const MP_REGEN = 0.03, MP_ARENA = 220;
const MP_CLASS: Record<string, number> = { warrior: 0.8, samurai: 0.9, archer: 1, book_mage: 1.6 };
/** A skill's MP: none for the regular attack and passives / buffs' own cost by cooldown (the big ones cost more). */
interface LootDrop { kind: 'gold' | 'item'; id?: string; amount: number; img: Phaser.GameObjects.Image; sh: Phaser.GameObjects.Ellipse; glow: Phaser.GameObjects.Image; beam?: Phaser.GameObjects.Image; sz: number; bounced: boolean; seed: number; nextGlint: number;
  x: number; y: number; z: number; vx: number; vz: number; landed: boolean; base: number; born: number; taken: number; done?: boolean; /** a treasure waiting on a perch: never fades */ keep?: boolean }
const mpCost = (s: FinalSkill): number => (s.slot === 0 ? 0 : Math.min(60, Math.round(6 + (s.cooldown / 1000) * 2.2)));
/** The slash-trail art (radiant_blade/slash_trail.jpg, 288 cells): its arc's circle (centre as a fraction of the cell, radius px) and the angle of its bright head (deg, y down). */
const SLASH = { cx: 189 / 288, cy: 81 / 288, r: 122, head: 190 };
const FACE: Record<Dir, V2> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
/** PvP victim-side sanity checks for a remote cast intent (network jitter tolerances). */
const CAST_COOLDOWN_TOLERANCE_MS = 250;
/** Judgment Blade pacing: earliest throw after the leap starts, auto-throw of a follow-up blade, earliest follow-up throw. */
const JB = { firstMin: 250, follow: 90, followMin: 40 } as const;
const CAST_ORIGIN_TOLERANCE_PX = 140;
const COMBO_SHOW_MS = 1400;
/** Screen px at the bottom covered by the skill tray / EXP bar (arena camera keeps the floor above it). */
const ARENA_HUD_PX = 280;

function portraitOf(previewKey: string): PortraitRef | undefined {
  const pv = CHARACTER_PREVIEWS[previewKey];
  if (!pv) return undefined;
  return pv.portrait ? { url: pv.portrait } : { url: pv.file, crop: { x: pv.crop.x, y: pv.crop.y, w: pv.crop.w, imgW: pv.width, imgH: pv.height } };
}

interface DummyState { hp: number; alive: boolean; flash: number; respawn: number; body: CombatBody; kin: Kin }

/** The Cursed Swordsman's strike expressed as a skill for the shared reaction path (PvE only). */
const ENEMY_SKILL: FinalSkill = {
  id: 'enemy_strike', cls: 'warrior', slot: 0, name: 'Cursed Strike', roles: ['basic'], targeting: 'aimAssist', startup: 180, active: 120, recovery: 260,
  cooldown: 900, ground: true, air: false, hits: [], cover: 'IGNORES_COVER', move: { startup: 0, active: 0, recovery: 0 }, cancelOnHit: [], tags: [],
  pvpMultiplier: 1, pveMultiplier: 1, description: '', unlockLevel: 1, relations: [],
};

/** How long he keeps the combat stance after an attack / a hit while standing still (MapleStory: a few seconds). */
const ALERT_MS = 4000;
/** Tree of Life heal aura radius (px around the tree). */
const TREE_RADIUS = 260; // = the drawn circle around the tree

/** Skills whose aim the held direction keeps turning while they run (sent to the other players). */
const AIM_STEER = new Set(['piercing_arrow', 'eagle_arrow']);

export class LegacyCourtyardScene extends Phaser.Scene {
  // ---- local actor (read by QA)
  kin!: Kin;
  /** Class actually played: the class, or the shared Beginner (warrior base body) before the 1st job. */
  cls: ClassKey = 'warrior';
  private deathFx?: DeathFx;
  body!: CombatBody;
  view?: ActorView;
  ci?: CombatInput;
  playerHP = S6.player.maxHp;
  dir: Dir = 'right';
  aim: V2 = { x: 0, y: 1 };
  mode: Mode = 'idle';
  modeT = 0;
  private loopT = 0;
  dead = -1; // >= 0: ms since death
  private flash = -1;
  chain = { stage: -1, lastEnd: -Infinity, skill: '' };
  private equipped: Equipped = {};
  private lastFootFrame = -1;
  // ---- world
  enemy?: CursedSwordsman;
  dummy?: Phaser.GameObjects.Image;
  private dummyBar?: Phaser.GameObjects.Graphics;
  dummyState?: DummyState;
  private ambience?: CourtyardAmbience;
  private occluders: Phaser.GameObjects.Image[] = [];
  // ---- combat
  rt?: SkillRuntime;
  fx?: SkillFx;
  kit: FinalSkill[] = [];
  simMs = 0;
  private castSeq = 0;
  localId = 'local';
  /** Attacker-side combo display (from confirmed hits only). */
  /** War Cry buff (+20% damage, super armor while attacking) and its looping aura. */
  warCryUntil = -1;
  /** Passive skills (job advancements): stat bonuses, War Leap, Final Attack, Combo Force orbs, Self Recovery. */
  passives: PassiveStats = NO_PASSIVES;
  /** What the worn equipment gives (attack scales the damage dealt, defence cuts the damage taken). */
  gearSt: GearStats = { att: 0, def: 0, armed: false };
  /** What is worn, as sent to other players (Gear wornCode). */
  private gearCode = '';
  private leapUsed = false;
  /** Landed on a stone block holding a way (left / right, forward / back): that way is ignored until it is let go, so
   *  you stay on the block (it is small: holding on would walk you straight off its far edge). */
  private blockHold = { x: 0, y: 0 };
  private leapUntil = -1;
  private leapAt = -Infinity;
  private afterimg?: Afterimages;
  orbs = { n: 0, lastAt: -Infinity, cast: '' };
  private orbImgs: Phaser.GameObjects.Image[] = [];
  private regenAt = 0;
  private seenStance = -Infinity;
  /** Party buffs (Iron Oath: Max HP +30%; Legacy Banner: +10% damage, -10% damage taken). */
  oathUntil = -1;
  /** War Cry shared by a party member: +10% damage. */
  allyCryUntil = -1;
  party?: Party;
  partyUi?: PartyUI;
  private partyTick = 0;
  bannerUntil = -1;
  private hpMaxSeen = 0;
  private seenEndure = -Infinity;
  private markAt = new Map<string, number>();
  /** Party buffs waiting for the cast's release. */
  private shares: { at: number; id: string; ms: number }[] = [];
  /** PvP arena scene (fixed HP for everyone). */
  private arena = false;
  /** Hit in the world: untouchable and blinking until this time (sim ms). */
  private hitBlinkUntil = -1;
  /** STR / DEX / INT / LUK (world only; the arena ignores them) and what they give. */
  private stats: Stats = baseStats();
  private statD: Derived = derive(baseStats(), 'warrior', 1);
  private statsWin?: StatsWindow;
  /** MP now (max: maxMpNow). */
  private mp = 0;
  private noMpAt = -Infinity;
  /** Radiant Blade: the sword is a long blade of light until this time. */
  radiantUntil = -1;
  /** The light blade's swing: its angle last frame, where this swing began, its turning sign, a trail drawn for it. */
  private sweep = { last: NaN, start: NaN, sign: 0, done: false };
  /** Archer buffs: Bow Haste (+20% attack speed), Hunter's Spirit (+15% critical rate, also shared by a party member). */
  hasteUntil = -1;
  /** Samurai buffs: Rising Sun (party: damage + critical damage), God of Blades (damage + the halo). */
  sunUntil = -1;
  godUntil = -1;
  spiritUntil = -1;
  /** Archer Tree of Life: where it stands, until when, next heal pulse (sim ms). */
  private tree: { x: number; y: number; until: number; next: number } | null = null;
  /** Arrow Storm: the slot it was started from and whether its key was held (release ends the storm). */
  private storm: null = null;
  /** Hunter's Resolve: blows cannot stun or push the archer until this time. */
  resolveUntil = -1;
  /** Sanctuary dome (fixed in the world): full damage immunity while the player stands inside. */
  private domeAt = -1;
  private dome: { x: number; y: number; rx: number; ry: number; until: number; t0: number; img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; wx: number; side: number; vis?: number } | null = null;
  private beam?: Phaser.GameObjects.Image;
  private beamGlow?: Phaser.GameObjects.Image;
  private eyes?: Phaser.GameObjects.Image;
  private holyAura?: Phaser.GameObjects.Image;
  private cryShields: Phaser.GameObjects.Image[] = [];
  private boltDone = true;
  private radiantFrom = -1;
  private lastHand: { x: number; y: number } | null = null;
  /** Judgment Blade air sequence: hover altitude + time since the last throw ended (up to 3 throws, then a slow descent). */
  private jb: { z: number; idle: number } | null = null;
  /** Judgment Blade: extra presses of V waiting to become blades (each press = one more blade, thrown at once). */
  private jbWant = 0;
  /** Impaling Rush that hit you: you ride its blade while it dashes. */
  private carriedBy: CastRun | null = null;
  /** Startup lunge toward the target / post-hit momentum following the push (px still to travel, ms left). */
  private lunge: { x: number; y: number; left: number } | null = null;
  private momentum: { x: number; y: number; left: number } | null = null;
  /** Iron Grip: the foe is held in the fist between the seize and the slam. */
  private gripHeld = false;
  /** Detached lingering strikes (Ground Breaker cracks, Blade Storm phantom blades) of own casts. */
  private lingers: { run: CastRun; x: number; y: number; next: number; left: number }[] = [];
  private cryAura?: Phaser.GameObjects.Image;
  private cryFire?: Phaser.GameObjects.Particles.ParticleEmitter[];
  private cryBody?: Phaser.GameObjects.Sprite;
  private emberT = 0;
  combo = { count: 0, at: -Infinity, comboId: -1, target: '', label: '', dmg: 0, max: 1 };
  confirmedLog: { skill: string; target: string; damage: number; idx: number; reaction: string; at: number; z: number }[] = [];
  private remoteCasts = new Map<string, number[]>();
  private seenCasts = new Set<string>();
  pvpReady = false;
  pvp?: PvpController;
  /** PvP sparring NPC: present while you are alone in the arena room (local only, endless HP). */
  private bot?: SparringBot;
  private botAwayMs = 0;
  /** Arena camera follow point (vertical only). */
  private camTarget = new Phaser.Math.Vector2();
  /** The arena's camera, by the player: zoom (wheel / the camera buttons) and height (PageUp / PageDown), Home resets. */
  private arenaZoom = 1;
  private arenaLift = 0;
  private arenaCam(what: 'in' | 'out' | 'up' | 'down' | 'reset'): void {
    if (what === 'in' || what === 'out') this.arenaZoom = Phaser.Math.Clamp(this.arenaZoom * (what === 'out' ? 0.93 : 1 / 0.93), Math.max(0.8, this.cameras.main.width / (WORLD.coordinateSpace.width * this.baseZoom)), 1.5)   // never wider than the arena's picture;
    else if (what === 'up' || what === 'down') this.arenaLift = Phaser.Math.Clamp(this.arenaLift + (what === 'up' ? 30 : -30), -180, 180);
    else { this.arenaZoom = 1; this.arenaLift = 0; }
    if (this.koT < 0) this.cameras.main.zoomTo(this.baseZoom * this.arenaZoom, 160, 'Sine.easeOut', true);
  }
  private botCls = 'warrior';
  /** Came from the PvP fighter select: against the CPU / another player. */
  private vs: 'cpu' | 'player' | null = null;
  /** VS PLAYER: still waiting for the other player (the sparring partner only comes if they never do). */
  private waitFoe = false;
  private botPaused = false;
  /** Sparring test switch: your skills have no cooldown (only while the sparring partner is there). */
  private noCd = false;
  /** Arena analysis: simulation speed (1, 0.5, 0.25) and the hit log. */
  private slowMo = 1;
  private logEl?: HTMLDivElement;
  private logSum = { out: { hits: 0, dmg: 0, combo: -1 }, in: { hits: 0, dmg: 0, combo: -1 } };
  private sparUi?: { root: HTMLDivElement; clsBtns: { id: string; b: HTMLButtonElement }[]; stop: HTMLButtonElement; combo: HTMLButtonElement; speedBtns: { v: number; b: HTMLButtonElement }[]; log: HTMLButtonElement; nocd: HTMLButtonElement };
  private botSeq = 0;
  /** Battle mode (the arena's 1v1): the match in rounds and its HUD; the K.O. slow motion (real ms since the K.O., -1 =
   *  none) and the camera's own zoom (the K.O. punches in from it). */
  private match?: Match;
  private battleHud?: BattleHUD;
  /** The arena: the class's combo routes on the left. */
  private comboGuide?: ComboGuide;
  private koT = -1;
  private koZoomBack = false;
  /** When the side running the match was last heard from (real ms). */
  private matchHeard = 0;
  /** The knight's BREAK, due at this sim time (0: none); when the other fighter last used BREAK (their HUD chip). */
  private botBreakAt = 0;
  private oppBreakAt = -Infinity;
  /** Hit by the other fighter: your body shudders until this time (fighting-game hit feel). */
  private selfShakeUntil = -1;
  private baseZoom = 1;
  private hud?: WorldHUD;
  private character?: Character;
  skillBook?: SkillBook;
  cosPanel?: CosmeticPanel;
  chat?: ChatBox;
  private bubbles?: SpeechBubbles;
  private questsUi?: QuestTracker;
  /** Dims the world behind the big windows. */
  private veil?: Phaser.GameObjects.Rectangle;
  questLog?: QuestLog;
  keySettings?: KeySettings;
  // ---- open world (PvE): areas, monsters, NPCs, potions, gold
  world?: OpenWorld;
  private npcDialog?: NpcDialog;
  private areaTitle?: AreaTitle;
  /** Quests taken / finished (saved with the character). */
  quests: Record<string, QuestState> = {};
  /** After a glide into a new area he walks on to its entry until you steer (or he arrives). */
  /** Iron Grip: the monster held in the fist between the seize and the slam. */
  private gripFoe: Monster | null = null;
  /** Where the seized monster stood (its slam lands it back on its own floor). */
  private gripFrom: { x: number; y: number } | null = null;
  /** Touching monsters: not again before this (sim ms). */
  private touchUntil = -1;
  private motes?: Phaser.GameObjects.Container;
  /** Gold and potions carried; drops lying on the floor. */
  gold = 0;
  bag: Record<string, number> = { ...STARTER_BAG };
  /** The items on the two item hotkeys. */
  quick: [string, string] = [...DEFAULT_QUICK];
  /** Items found at least once. */
  private seen = new Set<string>();
  private potionAt = [-Infinity, -Infinity];
  /** Buff potions running (sim clock). */
  private itemDmgUntil = -1;
  private itemSpeedUntil = -1;
  private useAt: Record<string, number> = {};
  private drops: LootDrop[] = [];
  /** The cube perches' treasures (stepTreasures). */
  private treasures?: { t: Tower; next: number; drop: LootDrop | null }[];
  shop?: ShopWindow;
  /** The area's name last shown (one title for an area of several maps). */
  private areaName = '';
  private bindings: Record<BindAction, string> = loadBindings();

  constructor() { super('LegacyCourtyardScene'); }

  /** QA / legacy accessors. */
  get player(): Phaser.GameObjects.Sprite | undefined { return this.view?.sprite; }
  get skills(): SkillRuntime | undefined { return this.rt; }

  preload(): void {
    const T = ATLAS.textures, CT = COMBAT_ASSETS.textures;
    // The world holds only your own class; the PvP arena can hold any class (other players, the sparring knight).
    const sd = this.sys.settings.data as { pvpRoom?: string; fighter?: Character } | undefined;
    const pvp = !!sd?.pvpRoom;
    const me = sd?.fighter ?? CharacterStore.getSelectedCharacter(); // (the PvP select's fighter)
    const cls = me ? playedClass(me) : undefined; // the class actually played (Beginner = warrior base)
    const classes = pvp || !cls ? undefined : [cls];
    // Weapon masks only when your own look already needs them (others load on first need).
    const masks = me && cls && wantsWeaponMasks(cls, CharacterStore.getCosmetics(me.id).equipped as Equipped) ? [cls] : [];
    if (pvp) { if (!this.textures.exists(T.map.key)) this.load.image(T.map.key, T.map.file); } // the arena map
    else preloadOpenWorld(this); // the open world: the start area and its neighbours (the rest streams in)
    if (!this.textures.exists(CT.dummy.key)) this.load.image(CT.dummy.key, CT.dummy.file);
    preloadBodies(this, classes, masks);
    if (me) loadBaseLook(this, genderOf(me), headLookOf(me)); // your hair, face and skin: layers on every base frame
    if (me) loadGear(this, genderOf(me), wornLook(me.gear)); // what you wear: the clothes and the sword on every base frame
    if (me) preloadLooks(this, [me]); // your full style for the portrait
    preloadSkillFx(this, classes);
    preloadDeathFx(this);
    preloadCosmetics(this, classes && me ? [...new Set([...classes, me.classId])] : classes); // a Beginner still owns its class's items
    preloadPanelArt(this);
    preloadLife(this);
    for (const [k, f] of [...ITEM_IDS.map((id) => [`loot.${id}`, ITEMS[id].icon]), ['loot.gold_small', GOLD_ICON.small], ['loot.gold_big', GOLD_ICON.big]]) if (!this.textures.exists(k)) this.load.image(k, f);
    if (!this.textures.exists('loot.beam')) this.load.image('loot.beam', 'assets/final/ui/kit/drop_beam.png');
    if (!this.textures.exists('loot.coin')) this.load.spritesheet('loot.coin', 'assets/final/items/coin_spin.png', { frameWidth: 128, frameHeight: 128 });
    for (let n = 0; n < EMOTES; n++) if (!this.textures.exists(`kit.emote_${n}`)) this.load.image(`kit.emote_${n}`, `assets/final/ui/kit/emote_${n}.png`);
    showLoading(this, pvp ? 'PVP ARENA' : 'GOD OF LEGACY');
  }

  create(data?: { pvpRoom?: string; at?: { x: number; y: number }; fighter?: Character; botCls?: string; vs?: 'cpu' | 'player' }): void {
    const at = !data?.pvpRoom && data?.at ? data.at : null; // a restart in place (a new job): you stay where you were
    const character = (data?.pvpRoom && data.fighter) || CharacterStore.getSelectedCharacter(); // the PvP select's fighter (a copy, never saved)
    this.vs = data?.pvpRoom ? data.vs ?? null : null;
    if (data?.pvpRoom && data.botCls) this.botCls = data.botCls; // VS CPU: the opponent you picked
    this.waitFoe = this.vs === 'player'; // VS PLAYER: the other player is on the way (no sparring partner meanwhile)
    if (!character) { this.scene.start('CharacterSelectScene'); return; }
    const pvpRoom = data?.pvpRoom ?? null;
    this.arena = !!pvpRoom;
    this.character = character;
    buildLook(this, character); // portrait = the full style
    registerBodies(this);
    this.pvp = undefined; this.pvpReady = !pvpRoom;
    const playerId = newPlayerId();
    this.localId = pvpRoom ? playerId : 'local';
    // Beginner (below the 1st job advancement): every class plays the same sword-only beginner with the basic attack.
    if (character.level < TEST_MIN_LEVEL) { character.level = TEST_MIN_LEVEL; character.exp = 0; CharacterStore.setProgress(character.id, TEST_MIN_LEVEL, 0); } // TESTING: start at the job advancement
    this.cls = playedClass(character) as ClassKey;
    this.stats = cleanStats(character.stats, character.level); this.statD = derive(this.stats, this.cls, character.level);
    this.kit = kitFor(this.cls);
    this.gold = character.gold ?? 0; this.bag = cleanBag(character.bag ?? STARTER_BAG); this.quick = cleanQuick(character.quick); this.seen = new Set(character.seen ?? Object.keys(this.bag)); this.potionAt = [-Infinity, -Infinity]; this.drops = []; this.treasures = undefined; this.itemDmgUntil = -1; this.itemSpeedUntil = -1; this.useAt = {};
    this.simMs = 0; this.castSeq = 0; this.dead = -1; this.flash = -1; this.hitBlinkUntil = -1; this.mode = 'idle'; this.modeT = 0; this.loopT = 0;
    // timers of the previous visit run on the old clock: clear every buff / passive bookkeeping value
    this.warCryUntil = -1; this.radiantUntil = -1; this.oathUntil = -1; this.bannerUntil = -1; this.allyCryUntil = -1; this.leapUntil = -1;
    this.hasteUntil = -1; this.spiritUntil = -1; this.tree = null; this.storm = null; this.resolveUntil = -1; this.hasteFx = undefined; this.spiritFx = undefined; this.afterimg = undefined;
    this.sunUntil = -1; this.godUntil = -1; this.kage?.clear(); this.kage = undefined; this.ambushIn.clear();
    this.mageReset(); this.gates.clear(); this.levityZones = []; this.brokenLinks.clear(); this.linkGfx = undefined;
    this.hpMaxSeen = 0; this.seenStance = -Infinity; this.seenEndure = -Infinity; this.markAt.clear(); this.partyTick = 0; this.shares = []; this.slowMo = 1; this.time.timeScale = 1; this.tweens.timeScale = 1;
    this.chain = { stage: -1, lastEnd: -Infinity, skill: '' };
    this.combo = { count: 0, at: -Infinity, comboId: -1, target: '', label: '', dmg: 0, max: 1 };
    this.confirmedLog = [];
    this.remoteCasts = new Map(); this.seenCasts = new Set(); this.jb = null; this.jbWant = 0; this.carriedBy = null;
    this.playerHP = pvpRoom ? PVP.maxHp : S6.player.maxHp;
    this.dir = 'right'; this.aim = { x: 1, y: 0 };

    // Map + camera (contain: one area fills the screen), crisp pixels.
    const T = ATLAS.textures;
    const cam = this.cameras.main;
    cam.setZoom(Math.min(cam.width / WORLD.camera.worldWidth, cam.height / WORLD.camera.worldHeight));
    cam.setRoundPixels(true);
    this.baseZoom = cam.zoom; this.koT = -1;
    // Very low density warm dust drifting in the sun (never over telegraphs: faint, small, sparse).
    this.motes = addMotes(this, { x: 60, y: 220, w: WORLD.coordinateSpace.width - 120, h: WORLD.coordinateSpace.height - 260 }, 7,
      { depth: 1500, tint: 0xffd9a0, size: [5, 9], speed: [3, 8], drift: 10, alpha: 0.32 });
    this.quests = CharacterStore.getQuests(character.id);
    if (pvpRoom) {
      useArenaGeometry();
      this.add.image(0, 0, T.map.key).setOrigin(0, 0).setDepth(-1);
      // The skill tray covers the bottom of the screen: the camera follows you up / down so the whole floor stays
      // playable above it; below the map the floor is mirrored and darkened (only ever seen under the HUD).
      const W = WORLD.coordinateSpace.width, H = WORLD.coordinateSpace.height, extra = Math.ceil(ARENA_HUD_PX / cam.zoom);
      this.add.image(0, H, T.map.key).setOrigin(0, 0).setFlipY(true).setDepth(-1.1);
      this.add.rectangle(0, H, W, extra, 0x05080e, 0.45).setOrigin(0, 0).setDepth(-1.05);
      cam.setBounds(0, 0, W, H + extra);
      this.camTarget.set(W / 2, this.kin ? this.kin.y : H / 2);
      cam.startFollow(this.camTarget, true, 0, 0.09);
      cam.centerOn(W / 2, H / 2);
      this.arenaZoom = 1; this.arenaLift = 0;
      this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.arenaCam(dy > 0 ? 'out' : 'in'));
      this.input.keyboard?.on('keydown-PAGE_UP', () => this.arenaCam('up')); this.input.keyboard?.on('keydown-PAGE_DOWN', () => this.arenaCam('down'));
      this.input.keyboard?.on('keydown-HOME', () => this.arenaCam('reset'));
      this.ambience = new CourtyardAmbience(this, WORLD.coordinateSpace.width, WORLD.coordinateSpace.height);
      // Baked-map occlusion: each prop silhouette is redrawn from the map at its footprint depth (no floor crop).
      this.occluders = WORLD_OBJECTS.map((o) => {
        const g = this.make.graphics({}, false);
        g.fillStyle(0xffffff).fillPoints(o.occluder.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
        return this.add.image(0, 0, T.map.key).setOrigin(0, 0).setDepth(o.frontY).setMask(g.createGeometryMask());
      });
    } else {
      // The open world: one long world left to right, the camera following you along it.
      this.world = new OpenWorld(this, { onArea: (a) => { if (a.name !== this.areaName) { this.areaName = a.name; this.areaTitle?.show(a.name); } } }, at ?? toWorld(START.area, [START.x, START.y]));
      this.world.onNpcClick = (n) => this.talkTo(n);
    }

    if (!pvpRoom) {
      const CT = COMBAT_ASSETS.textures;
      this.dummy = this.add.image(D.x, D.y, CT.dummy.key).setOrigin(CT.dummy.origin.x, CT.dummy.origin.y);
      this.dummy.setScale(CT.dummy.displayHeight / CT.dummy.height).setDepth(D.y);
      this.dummyBar = this.add.graphics().setDepth(TOP_DEPTH);
      const dk = newKin(D.x, D.y);
      this.dummyState = { hp: D.maxHp, alive: true, flash: 0, respawn: 0, kin: dk, body: Object.assign(new CombatBody(dk, false), { maxHp: D.maxHp }) };
      this.dummyState.alive = false; this.dummy.setVisible(false); this.dummyBar.setVisible(false);
      // No hostile NPC in the world (ENTER WORLD): fighting happens in the PvP arena (sparring knight).
    }

    const { x, y } = this.world ? at ?? toWorld(START.area, [START.x, START.y]) : WORLD.spawn;
    this.kin = newKin(x, y);
    this.body = new CombatBody(this.kin, !!pvpRoom);
    this.body.arena = !!pvpRoom; // the arena's duel rules: combo budget, BREAK, guarded wake-up
    this.gearSt = gearStats(CharacterStore.getGear(character.id)); this.gearCode = wornCode(wornLook(character.gear));
    this.applyPassives();
    this.orbs = { n: 0, lastAt: -Infinity, cast: '' }; this.leapUsed = false; this.regenAt = 0; this.orbImgs = [];
    this.playerHP = this.maxHpNow(); this.mp = this.maxMpNow();
    this.body.maxHp = this.maxHpNow();
    this.view = new ActorView(this, this.cls, x, y);
    this.view.setBaseLook(headLookOf(character), genderOf(character));
    this.view.setGear(wornLook(character.gear), genderOf(character));
    this.view.setName(character.name);
    this.loadCosmetics();

    this.rt = new SkillRuntime({
      now: () => this.simMs,
      targets: (r) => this.targetsFor(r),
      onHit: (r, h, i, t, at) => this.onSkillHit(r, h, i, t, at),
      casterPos: (id) => this.casterPos(id),
      dashPos: (r) => (r.attackerId === BOT_ID ? null : this.remoteDashPos(r)), // (the knight is simulated here: its body is where it is)
      cooldownMul: (req) => this.cdMul(req.skill),
      timeScale: (req) => (this.arena ? arenaTimeScale(req.skill) : null), // the arena: the warrior at his base pace
      onPhase: (r, ph) => this.onRunPhase(r, ph),
      reachMul: (req) => (req.own ? (req.skill.cls === 'warrior' && this.simMs < this.radiantUntil ? 1.85 : 1) : (req.reach ?? 1)),
      rangeMul: (req) => (req.own ? this.ownRangeMul(req.skill) : (req.range ?? 1)),
      speedMul: (req) => (req.own ? this.ownSpeedMul(req.skill) : (req.speed ?? 1)),
      projectileHook: (p, r) => this.mageProjectile(p, r),
    });
    this.fx = new SkillFx(this, this.rt, (id) => this.casterPos(id));
    this.deathFx = new DeathFx(this);
    this.fx.damageSkin = damageSkin(this.equipped.damage);
    this.fx.lift = character.hero ? HERO_LIFT : 0; // a ready hero stands taller: its numbers and calls go up with its head
    this.fx.handPos = (id) => (id === this.localId ? this.lastHand : null);
    this.fx.ghosts = (id) => this.ghostsOf(id);
    this.fx.targetPos = (id) => {
      const c = this.casterPos(id);
      if (c) { const v = id === this.localId ? this.view : id === BOT_ID ? this.bot?.view.view : this.pvp?.remotes.get(id)?.view; return { ...c, h: v?.headHeight || undefined }; }
      const t = this.targetsFor({ own: true, attackerId: this.localId } as CastRun).find((x) => x.id === id);
      return t ? { x: t.x, y: t.y, z: t.z, h: t.height } : null;
    };
    this.fx.bodyOf = (id) => {
      const sp = id === this.localId ? this.view?.sprite : id === BOT_ID ? this.bot?.view.sprite : this.pvp?.remotes.get(id)?.sprite;
      const dir = id === this.localId ? this.dir : id === BOT_ID ? this.bot?.view.dir : this.pvp?.remotes.get(id)?.dir;
      return sp ? { key: sp.texture.key, frame: sp.frame.name, flipX: sp.flipX, ox: sp.originX, oy: sp.originY, sx: Math.abs(sp.scaleX), sy: Math.abs(sp.scaleY), a: sp.visible ? sp.alpha : 0, face: dir === 'left' ? -1 : 1 } : null;
    };
    this.fx.aliveOf = (id) => (id === this.localId ? this.dead < 0 : id === BOT_ID ? !!this.bot && !this.bot.defeated : this.pvp?.remotes.get(id)?.alive !== false);
    this.rt.events.on(RT_EVENTS.hit, (r: CastRun, i: number, o: V3) => this.kageSwing(r, i, o));
    this.fx.unarmed = (id) => (id === this.localId ? !this.gearSt.armed : this.pvp?.remotes.get(id)?.armed === false);
    this.renderPlayer(0);
    if (pvpRoom) this.view.setVisible(false);
    if (isQAMode()) (window as unknown as { __combatQA: unknown }).__combatQA = { finalSkill, kitFor, WORLD_OBJECTS, footAllowed, placementOk };

    this.bindings = loadBindings();
    this.ci = new CombatInput(this, (i) => this.useSlot(i), () => this.onJumpKey(), (k) => this.togglePanel(k), this.bindings, () => this.onTalk(), (i) => this.usePotion(i));
    const stop = () => { this.ci?.reset(); };
    this.game.events.on(Phaser.Core.Events.BLUR, stop);
    this.game.events.on(Phaser.Core.Events.HIDDEN, stop);

    const exitArena = () => { // back to the fighter select (it opens the same room again for VS PLAYER), or the menu
      if (this.vs) this.scene.start('PvpSelectScene', { mode: this.vs, p1: this.cls, p2: this.botCls });
      else { clearPvpFromUrl(); this.scene.start('MainMenuScene'); }
    };
    this.hud = new WorldHUD(this.game.canvas.parentElement!, this.game.canvas, {
      returnLabel: pvpRoom ? PVP.hud.exitText : 'BACK TO CHARACTERS',
      onReturn: pvpRoom ? exitArena : () => this.scene.start('CharacterSelectScene'),
      onSlot: (i) => this.useSlot(i),
      onPotion: (i) => this.usePotion(i),
      onCam: (w) => (this.world ? this.world.camStep(w) : this.arenaCam(w)),
      onMenu: (k) => this.togglePanel(k),
      onKeys: () => { this.skillBook?.close(); this.cosPanel?.close(); this.questLog?.close(); this.keySettings?.open(loadBindings()); },
    });
    this.hud.setKeyLabels(slotKeyLabels());
    this.hud.setMenuKeys(menuKeys(this.bindings));
    this.refreshPassiveStrip();
    const host = this.game.canvas.parentElement!;
    this.skillBook = new SkillBook(this, host, this.game.canvas, this.cls, skillLevel(character), this.allOpen(), pvpRoom || isQAMode() ? undefined : (on) => this.setAllOpen(on)); // arena / QA: all skills open
    this.cosPanel = new CosmeticPanel(this, host, this.game.canvas, character, () => this.equipped, (e) => this.setEquipped(e), (g) => this.onGearChange(g));
    this.skillBook.setEquipped(this.equipped);
    this.cosPanel.itemActions = { use: (id) => this.useItem(id), setQuick: (i, id) => this.setQuick(i, id), quick: () => this.quick, keys: () => [keyLabel(this.bindings.hpPot), keyLabel(this.bindings.mpPot)] };
    // Behind the big windows (skill book, inventory, shop) the world fades back (the HUD steps aside; the previews stay clear).
    this.veil = this.add.rectangle(-480, -480, 1920 + 960, 1080 + 960, 0x04070e, 0.5).setOrigin(0, 0).setScrollFactor(0).setDepth(1e7).setVisible(false);
    this.cosPanel.keepOutOfPreviews(this.veil);
    // Chat (Enter), speech bubbles, quest tracker and quest log (J).
    const ov = this.hud.overlay;
    this.chat = new ChatBox(ov, (text, kind) => this.sendChat(text, kind), (on) => this.chatTyping(on), (n) => { this.bubbles?.emote(this.localId, n, this.simMs); this.pvp?.sendChat('', undefined, n); });
    this.bubbles = new SpeechBubbles(this);
    this.questsUi = new QuestTracker(ov);
    this.questLog = new QuestLog(ov, () => this.ci?.reset());
    this.partyUi = new PartyUI(ov, {
      invite: (id) => this.party?.invite(id), kick: (id) => this.party?.kick(id), leave: () => this.party?.leave(),
      answer: (ok) => this.party?.answer(ok), onOpen: () => this.ci?.reset(),
    });
    this.statsWin = new StatsWindow(ov, { add: (k) => this.addStat(k), sub: (k) => this.subStat(k), auto: () => this.autoStats(), reset: () => this.resetStats(), onOpen: (o) => { if (o) this.refreshStats(); this.chatTyping(o); if (!o) this.ci?.reset(); } });
    this.shop = new ShopWindow(ov, { buy: (id, n) => this.buy(id, n), sell: (id, n) => this.sell(id, n), state: () => ({ gold: this.gold, bag: this.bag }), onOpen: (o) => { this.chatTyping(o); if (!o) this.ci?.reset(); } });
    this.keySettings = new KeySettings(ov, Array.from({ length: SLOT_COUNT }, (_, i) => ({ name: this.kit[i]?.name ?? '', icon: this.kit[i] ? iconUrl(this.kit[i]) : '' })),
      (b) => this.applyKeys(b), (open) => this.chatTyping(open));
    this.chat.add({ kind: 'system', text: pvpRoom ? 'Welcome to the PvP Arena! Press Enter to chat.' : 'Welcome to God Of Legacy! Press Enter to chat.' });
    if (this.world) {
      this.areaTitle = new AreaTitle(ov);
      this.areaTitle.show(this.world.area.name); this.areaName = this.world.area.name;
      this.npcDialog = new NpcDialog(ov, () => this.ci?.reset());
      this.npcDialog.talkKey = keyLabel(this.bindings.talk);
      this.world.setTalkKey(keyLabel(this.bindings.talk));
      this.refreshQuests();
      this.chat.add({ kind: 'system', text: `Walk on to explore the world. Talk to people with ${keyLabel(this.bindings.talk) || 'the talk key'}.` });
      this.chat.add({ kind: 'system', text: 'Camera: mouse wheel to zoom · PageUp / PageDown (or Shift + wheel) for height · Home to reset.' });
    }
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, (_t: number, d: number) => {
      if (!this.hud) return;
      this.hud.layout(); this.skillBook?.layout(); this.cosPanel?.layout();
      const big = !!(this.skillBook?.open || this.cosPanel?.open);
      const small = !!(this.questLog?.isOpen || this.partyUi?.isOpen || this.keySettings?.isOpen || this.npcDialog?.isOpen || this.shop?.isOpen);
      this.hud.setModal(big ? 'bare' : small ? 'dim' : 'none');
      if (this.veil && this.veil.visible !== big) this.veil.setVisible(big);
      if (this.view) this.hud.update(this.hudState(), this.simMs, d);
    });
    const kb = this.input.keyboard!;
    const esc = () => {
      if (this.npcDialog?.isOpen) { this.npcDialog.close(); return; }
      if (this.skillBook?.open || this.cosPanel?.open || this.questLog?.isOpen || this.partyUi?.isOpen) { this.skillBook?.close(); this.cosPanel?.close(); this.questLog?.close(); this.partyUi?.close(); } else if (pvpRoom) exitArena();
    };
    kb.on('keydown-ESC', esc);
    if (pvpRoom) this.buildSparUi();
    if (pvpRoom) {
      this.battleHud = new BattleHUD(ov, { rematch: () => this.askRematch(), exit: exitArena });
      if (ComboGuide.has(this.cls)) this.comboGuide = new ComboGuide(ov, this.cls, this.kit, this.guideKeys());
      this.match = new Match(this.localId, {
        onPhase: (m, prev) => this.onMatchPhase(m, prev),
        send: (msg) => { if (this.match?.opponent !== BOT_ID) this.pvp?.sendMatch(msg); },
        hpFrac: (id) => this.hpFracOf(id),
      });
    }
    if (pvpRoom) this.startPvp(pvpRoom, { playerId, characterId: character.id, classId: this.cls, name: character.name, gender: genderOf(character), ...(character.hero ? { hero: true } : {}), ...(headLookOf(character) ? { look: headLookOf(character)! } : {}) });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.game.events.off(Phaser.Core.Events.BLUR, stop);
      this.game.events.off(Phaser.Core.Events.HIDDEN, stop);
      kb.off('keydown-ESC', esc);
      this.rt?.cancelOwn('sceneExit');
      this.kage?.clear(); this.kage = undefined;
      this.fx?.destroy(); this.fx = undefined;
      this.deathFx?.destroy(); this.deathFx = undefined;
      this.rt?.destroy(); this.rt = undefined;
      this.ci?.reset();
      this.ci?.destroy(); this.ci = undefined;
      kb.removeAllKeys(true);
      this.pvp?.destroy(); this.pvp = undefined; this.pvpReady = false;
      this.enemy?.destroy(); this.enemy = undefined;
      this.bot?.destroy(); this.bot = undefined; this.sparUi?.root.remove(); this.sparUi = undefined; this.logEl?.remove(); this.logEl = undefined;
      this.battleHud?.destroy(); this.battleHud = undefined; this.match = undefined; this.koT = -1;
      this.comboGuide?.destroy(); this.comboGuide = undefined;
      this.slowMo = 1; this.time.timeScale = 1; this.tweens.timeScale = 1;
      this.ambience?.destroy(); this.ambience = undefined;
      for (const o of this.occluders) { o.clearMask(true); o.destroy(); }
      this.occluders = [];
      this.hud?.destroy(); this.hud = undefined;
      this.skillBook?.destroy(); this.skillBook = undefined;
      this.cosPanel?.destroy(); this.cosPanel = undefined;
      this.chat?.destroy(); this.chat = undefined;
      this.bubbles?.destroy(); this.bubbles = undefined;
      this.questsUi?.destroy(); this.questsUi = undefined;
      this.questLog?.destroy(); this.questLog = undefined;
      this.partyUi?.destroy(); this.partyUi = undefined; this.party = undefined;
      this.keySettings?.destroy(); this.keySettings = undefined;
      this.statsWin?.destroy(); this.statsWin = undefined;
      this.shop?.destroy(); this.shop = undefined;
      this.world?.destroy(); this.world = undefined;
      this.npcDialog?.destroy(); this.npcDialog = undefined;
      this.areaTitle?.destroy(); this.areaTitle = undefined;
      this.gripFoe = null;
      this.view?.destroy(); this.view = undefined;
      this.character = undefined;
      this.dummy = undefined; this.dummyBar = undefined; this.dummyState = undefined;
    });
  }

  // ======================================================================= frame

  update(_time: number, delta: number): void {
    if (!this.view || !this.rt || !this.fx || !this.ci) return;
    const real = Math.min(delta, 50);
    const ms = real * this.slowMo * this.koFactor(real); // arena analysis: slow motion; a K.O.: a beat of slow motion
    this.ambience?.update(ms);
    this.pvp?.update(ms);
    this.skillBook?.update(ms);
    this.cosPanel?.update(ms);
    if (!this.pvpReady) return;
    // Hit-stop: in PvE the local simulation freezes briefly; in PvP only local presentation does
    // (remote simulation and networking never freeze).
    if (this.fx.hitStopLeft > 0 && !this.pvp) {
      this.fx.update(ms, []);
      const j = () => (Math.random() - 0.5) * 7; // impact shake of the victims (DFO hit feel)
      if (this.enemy?.alive && this.simMs - this.enemy.body.lastHitAt < 200) this.enemy.shake(j(), j() * 0.4);
      for (const m of this.world?.mobs ?? []) if (m.alive && this.simMs - m.body.lastHitAt < 200) m.shake(j(), j() * 0.4);
      if (this.dummy && this.dummyState && this.simMs - this.dummyState.body.lastHitAt < 200) this.dummy.setPosition(D.x + j(), D.y - this.dummyState.kin.z);
      return;
    }
    this.simMs += ms;
    if (this.dead < 0) this.mp = Math.min(this.maxMpNow(), this.mp + this.maxMpNow() * MP_REGEN * ms / 1000);
    const now = this.simMs;
    this.ci.update(now);
    this.stepPlayer(ms, now);
    if (this.world) { this.stepMonsters(ms, now); this.stepTreasures(); this.stepLoot(ms, now); }
    this.rt.update(ms);
    this.stepLingers(now);
    this.stepStorm();
    this.stepTree(now);
    this.stepMage(ms, now);
    if (now < this.resolveUntil && this.dead < 0) this.body.armorUntil = Math.max(this.body.armorUntil, now + 120); // Hunter's Resolve: unstoppable
    if (SKILL_BLOCKERS.size) { pushOutOfBlockers(this.kin, R); for (const m of this.world?.mobs ?? []) if (m.alive) pushOutOfBlockers(m.kin, 14); }
    this.stepPassives(ms, now);
    if (this.kage?.any) { // Kagemusha: the doubles roam round the nearest foe; while he swings they swing with him
      const run = this.rt.ownRun, sw = run && run.skill.cls === 'samurai' && run.skill.id !== 'kagemusha' ? { side: run.aim.x < 0 ? -1 : 1 } : null;
      if (this.dead >= 0) this.kage.clear(); else this.kage.step(ms, now, this.kin, this.kageFoe(), sw);
    }
    for (const r of this.pvp?.remotes.values() ?? []) r.onKage ??= (at, how, face, stage) => (how === 'appear' ? this.fx?.kageAppear(at) : how === 'burst' ? this.fx?.kageBurst(at) : how === 'feint' ? this.fx?.kageFeint(at, face ?? 1, stage ?? 0) : this.fx?.kageFade(at));
    this.refreshParty(ms);
    this.fx.update(ms, this.rt.projectiles.map((e) => e.p));
    this.updateDummy(ms);
    const ed = this.enemy ? this.kage?.decoyFor(this.enemy) : null; // Kagemusha: it goes after a double
    this.enemy?.update(ms, {
      player: ed ? { x: ed.x, y: ed.y, z: this.kin.z - this.kin.supportZ, alive: true } : { x: this.kin.x, y: this.kin.y, z: this.kin.z - this.kin.supportZ, alive: this.dead < 0 },
      now,
      blocked: (x, y) => (this.dead < 0 && Math.hypot(x - this.kin.x, y - this.kin.y) < STAGE6.enemy.collisionRadius + R && this.kin.z < 40)
        || (!!this.dummyState?.alive && Math.hypot(x - D.x, y - D.y) < D.collisionRadius + STAGE6.enemy.footRadius),
      onStrikePlayer: (dmg, from) => { if (ed) this.kage?.pop(ed.k); else this.enemyStrike(dmg, from); },
    });
    this.updateBot(ms, now);
    this.updateMatch(real, ms);
    this.reactionFx(ms);
    if (this.pvp || this.arena) this.camTarget.set(WORLD.coordinateSpace.width / 2, this.kin.y + 70 - this.arenaLift); // keep yourself above the tray
    this.renderPlayer(this.fx.hitStopLeft > 0 ? 0 : ms);
    this.updateWorldUi(ms);
    this.bubbles?.update(now, (id) => {
      if (id === this.localId) return this.dead < 0 && this.view ? { x: this.kin.x, y: this.kin.y, z: this.kin.z, head: this.view.headHeight } : null;
      const r = this.pvp?.remotes.get(id); return r && r.alive ? { x: r.x, y: r.y, z: r.z, head: r.headHeight } : null;
    });
  }

  // ======================================================================= local player

  busy(): boolean { return this.dead >= 0 || !this.body.canAct(this.simMs) || this.rt?.locked() === true; }

  /** Combat stance until (sim ms): set by attacks and hits, shown while standing still. */
  private alertUntil = -1;
  private setMode(m: Mode): void { if (m !== this.mode) { this.mode = m; this.modeT = 0; } }

  /** The side the player last faced (left / right): decides the side of an up / down input. */
  private faceSide = 1;
  private stepPlayer(ms: number, now: number): void {
    const k = this.kin, b = this.body, inp = this.ci!;
    this.modeT += ms; this.loopT += ms;
    if (this.flash >= 0) { this.flash += ms; if (this.flash >= P6.hitFlashRedMs) this.flash = -1; }
    // Aim: keyboard only — the held movement direction (8-way), else the last one.
    if (inp.hasMove) this.aim = unit(inp.moveX, inp.moveY, this.aim.x, this.aim.y);
    if (inp.moveX !== 0) this.faceSide = inp.moveX < 0 ? -1 : 1;

    if (this.dead >= 0) { this.dead += ms; this.setMode('dead'); k.vx = 0; k.vy = 0; stepKin(k, ms); this.deathFx?.update(ms); this.updateDeath(); return; }

    const run = this.rt!.ownRun;
    const reacting = b.state !== 'free';
    const ccLocked = b.hard.active(now) && b.hard.kind !== 'root';
    if (reacting || ccLocked) {
      if (run && b.state !== 'free') this.rt!.cancelOwn('hit');
      this.rideBlade();
      if (b.state === 'hitstun' && k.grounded && !b.push) { k.vx *= 0.8; k.vy *= 0.8; }
      const jumped = inp.takeJump();
      if (jumped && b.canBreak(now)) this.breakFree(now); // the arena: BREAK out of the combo
      else if (jumped && b.state === 'launched' && b.tryAirTech(now, inp.moveX || -this.aim.x, inp.moveY || -this.aim.y)) this.fx!.dust(k.x, k.y - k.z, 60, 0.6, this.dustDepth(k));
      else if ((jumped || inp.hasMove) && b.quickGetup(now)) this.setMode('getup'); // the arena: down a moment, a key stands you up
      if (ccLocked && b.state === 'free') { k.vx = 0; k.vy = 0; if (run) this.rt!.cancelOwn('hit'); }
    } else if (run) {
      this.stepCast(run, ms, now);
    } else if (this.jb && !k.grounded) { // between Judgment throws: hang a moment, then fall normally
      this.jb.idle += ms; k.vx = 0; k.vy = 0;
      if (this.jb.idle < 450) { k.z = this.jb.z; k.vz = 0; } // brief window for the next throw, then a normal fall
      if (inp.hasMove) this.dir = dirOf(inp.moveX, inp.moveY, this.dir);
      this.setMode('air');
    } else {
      this.stepLocomotion(ms, now);
    }
    if (this.jb && (reacting || (k.grounded && !(run && run.skill.id === 'judgment_blade')))) { // sequence over: full cooldown from now
      const jbs = this.kit.find((x) => x.id === 'judgment_blade'); if (jbs) this.rt!.closeCharges({ id: jbs.id, cooldown: jbs.cooldown * this.cdMul(jbs) });
      this.jb = null; this.jbWant = 0;
    }
    const floating = now < this.mage.floatUntil && !k.grounded && b.state === 'free'; // Levitate: a slow float
    if (floating) k.vz = Math.max(k.vz, -40);
    const r = stepKin(k, ms, floating ? LEVITATE.gravity : b.gravityScale(now), (x, y, z) => this.blockedByActors(x, y, z, !!this.rt!.ownRun), b.state === 'free' && !b.push && !this.rt!.ownRun);
    if (this.world) settleOnBlocks(k, ms, this.blockHold.y ? 0 : this.ci?.moveY ?? 0, b.state === 'free');
    const ev = b.update(now, ms, r.landed, r.impactVz);
    if (r.landed) {
      // onto a block: you keep going the way you hold (MapleStory) — no freeze on landing; the drift in the air was already
      // held so that you come down on its top
      if (r.impactVz > 180) this.fx!.dust(k.x, k.y - k.z, 48 + Math.min(70, r.impactVz / 8), 0.75, this.dustDepth(k));
      if (b.state === 'free' && !this.rt!.ownRun) this.setMode('land');
    }
    if (ev === 'kdImpact') this.fx!.dust(k.x, k.y - k.z, 120, 0.9, this.dustDepth(k));
    if (b.state === 'hitstun') this.setMode('hurt');
    else if (b.state === 'launched') this.setMode('launched');
    else if (b.state === 'knockdown') this.setMode(k.grounded ? 'down' : 'launched');
    else if (b.state === 'getup') this.setMode('getup');
    else if (this.mode === 'hurt' || this.mode === 'launched' || this.mode === 'down' || this.mode === 'getup') this.setMode(k.grounded ? 'idle' : 'air');
    // Buffered action fires on the first legal frame (within the buffer window).
    const buf = this.ci!.takeBuffered();
    if (buf && this.tryStartSlot(buf.slot)) this.ci!.consumeBuffer();
    else if (!buf && this.ci!.attackHeld && this.cls === 'archer' && this.kit[0]?.id === 'quick_shot') { // archer: hold to keep shooting at a steady rhythm
      const run = this.rt!.ownRun;
      if (!run || (run.skill.id === 'quick_shot' && run.phase === 'recovery')) this.tryStartSlot(0);
    }
    else if (!buf && this.ci!.attackHeld && this.kit[0]?.chain) { // hold Space: chain continues on its own
      const run = this.rt!.ownRun;
      if (!run || (run.skill.id === this.mageVariant(this.kit[0])!.id && run.elapsed >= run.timings.startup + run.timings.active)) this.tryStartSlot(0);
    }
  }

  /** Free locomotion: walk / double-tap run, jump take-off, air control, landing settle, idle breathing. */
  private stepLocomotion(ms: number, now: number): void {
    const k = this.kin, inp = this.ci!, b = this.body;
    const rooted = (b.hard.active(now) && b.hard.kind === 'root') || now < b.levityUntil; // (a Levity Field: floating, unable to move)
    const locked = this.inputLocked(); // talking to an NPC: he stands still
    const hold = this.blockHold; // let go (or off the block): that way is free again
    if (hold.x && (Math.sign(inp.moveX) !== hold.x || !k.grounded)) hold.x = 0;
    if (hold.y && (Math.sign(inp.moveY) !== hold.y || !k.grounded)) hold.y = 0;
    const mx = locked || hold.x ? 0 : inp.moveX, my = locked || hold.y ? 0 : inp.moveY;
    const speed = (inp.running && !locked ? PHYS.run : PHYS.stroll) * b.moveScale(now) * this.passives.moveMul * (now < this.itemSpeedUntil ? 1.1 : 1) * (now < this.mage.hasteUntil ? 1.1 : 1);
    steer(k, rooted ? 0 : mx * speed, rooted ? 0 : my * speed, ms, now < this.leapUntil ? 0.12 : 1); // War Leap keeps its burst
    if ((mx || my) && !rooted) this.dir = dirOf(mx, my, this.dir); // side view only: up/down keeps the facing
    const jumpKey = inp.takeJump() && !locked; // a jump pressed while talking is dropped
    if (k.grounded) { this.leapUsed = false; if (!rooted && jumpKey) { jump(k, PHYS.jumpVz * this.passives.jumpMul); this.setMode('takeoff'); } }
    else if (this.passives.airLeap && !this.leapUsed && !rooted && !(this.mode === 'takeoff' && this.modeT <= PHYS.takeoffMs) && jumpKey) this.warLeap(now);
    else if (this.passives.mage.levitate && !this.leapUsed && !rooted && !(this.mode === 'takeoff' && this.modeT <= PHYS.takeoffMs) && jumpKey) this.levitate(now);
    const sp = Math.hypot(k.vx, k.vy);
    if (!k.grounded) { if (this.mode !== 'takeoff' || this.modeT > PHYS.takeoffMs) this.setMode('air'); return; }
    if (this.mode === 'land' && this.modeT < LAND_MS && !mx && !my) return;
    if (this.mode === 'recover' && this.modeT < RECOVER_MS && !mx && !my) return;
    if (sp > 12) {
      const m: Mode = inp.running && !locked && sp > PHYS.walk + 20 ? 'run' : 'walk';
      if (m !== this.mode) { if (this.mode !== 'walk' && this.mode !== 'run') this.loopT = 0; this.setMode(m); } // every walk starts on its first step (walk↔run keep the stride)
      this.footDust(sp);
    } else if (this.mode !== 'idle') this.setMode('idle');
  }

  /** Dust only on run foot-contact frames (cadence follows speed). */
  private footDust(sp: number): void {
    if (this.mode !== 'run') { this.lastFootFrame = -1; return; }
    const sheet = this.cls === 'warrior' || this.cls === 'book_mage';
    const base = this.cls === 'warrior' && (this.view!.wantsBase || !hasJob(this.character!)) ? baseLoop('run', sp) : null;
    const fps = base ? base.fps : (sheet ? 13 : 10) * Math.max(0.75, Math.min(1.15, sp / 270)), n = base ? base.n : sheet ? 8 : 5;
    const f = Math.floor((this.loopT * fps) / 1000) % n;
    const contact = base ? base.contact : sheet ? [0, 4] : [0, 3];
    if (f !== this.lastFootFrame && contact.includes(f)) this.fx!.dust(this.kin.x - (this.kin.vx / sp) * 10, this.kin.y - this.kin.z, 34, 0.55, this.dustDepth(this.kin));
    this.lastFootFrame = f;
  }

  /** Own cast: locomotion scalar per phase, dash / leap motion, air momentum, recovery movement cancel. */
  private stepCast(run: CastRun, ms: number, now: number): void {
    const k = this.kin, inp = this.ci!, s = run.skill, T = run.timings;
    this.setMode('skill');
    this.dir = dirOf(run.aim.x, run.aim.y, this.dir);
    const phase = run.phase === 'startup' ? 'startup' : run.phase === 'active' ? 'active' : 'recovery';
    const scale = s.move[phase];
    if (s.dash && run.phase === 'active') { this.dashMotion(run); if (s.carry) this.carryTarget(run); return; }
    const held = this.gripFoe?.alive ? this.gripFoe : this.enemy?.alive ? this.enemy : null;
    if (s.id === 'iron_grip' && this.gripHeld && held) { // the seized foe rides the fist up overhead until the slam
      const en = held, h1 = s.hits[1]?.at ?? 400, p = Math.max(0, Math.min(1, (run.elapsed - T.startup) / Math.max(1, h1)));
      const lift = 1 - Math.pow(1 - Math.min(1, p / 0.8), 3);
      const reach = 30 - 18 * lift;
      en.kin.x = k.x + run.aim.x * reach; en.kin.y = k.y + run.aim.y * reach + 1; en.kin.z = k.z + 40 + 120 * lift;
      en.kin.vz = 0; en.kin.vx = 0; en.kin.vy = 0; en.kin.grounded = false;
    }
    if (s.charge && run.phase === 'startup' && !run.chargeDone) { // hold-to-charge (Iai Strike): let go = draw now (never before minMs)
      const slot = this.kit.indexOf(s), minS = s.charge.minMs * (run.chargeScale ?? 1);
      if (!this.ci?.slotHeld(slot) && run.elapsed >= minS) {
        run.chargeDone = true; run.timings.startup = Math.max(run.elapsed, minS);
        this.pvp?.sendRelease({ castId: run.castId, at: Math.round(run.timings.startup), ax: Math.round(run.aim.x * 1000), ay: Math.round(run.aim.y * 1000) });
      }
    }
    if (s.id === 'sword_wave' && run.phase === 'recovery' && !run.slid && this.ci?.slotHeld(this.kit.indexOf(s)) && this.rt!.cooldownRemaining(s.id) <= 0) { // held: the next wave as soon as it is ready (up to its charges)
      run.slid = true;
      this.rt!.cancelForFollowUp(run); this.endRun(run, false); this.tryStartSlot(this.kit.indexOf(s)); return;
    }
    if (s.id === 'dash_slash' && run.phase === 'recovery' && !run.slid) { run.slid = true; this.momentum = { x: run.aim.x * 46, y: run.aim.y * 46, left: Math.max(120, T.recovery * 0.7) }; } // skid to a stop instead of freezing
    if (s.id === 'judgment_blade') { // leap high, hang at the apex while the light-blade charges, throw, then drop
      if (!run.jbInit) { run.jbInit = true; run.jbApex = this.jb ? 0 : run.origin.z > 5 ? 80 : 185; if (this.jb) { run.timings.startup = run.jbQuick ? JB.followMin : JB.follow; run.origin = { ...run.origin, z: this.jb.z }; } } // follow-up throw: no new leap, no charge
      const e = run.elapsed, rise = Math.min(1, e / 380), apex = run.jbApex ?? 0; // from a jump: a shorter extra rise
      if (run.phase === 'startup' && inp.hasMove) { const u = unit(inp.moveX, inp.moveY); run.aim = sideAim(u.x, u.y, this.dir === 'left' ? -1 : 1); this.aim = run.aim; } // aim the throw while hovering (side / corner)
      // Every extra press of V is one more blade, at once: the blade in hand flies as soon as it has formed…
      if (run.phase === 'startup' && this.jbWant > 0 && e < T.startup && e >= (apex ? JB.firstMin : JB.followMin)) { run.timings.startup = e; this.jbWant--; }
      k.grounded = false; k.z = run.origin.z + apex * (1 - (1 - rise) * (1 - rise)); k.vz = 0; k.vx = 0; k.vy = 0;
      if (e >= T.startup) {
        this.jb = { z: k.z, idle: 0 }; // stays up for the next throw
        if (!run.jbOut) { run.jbOut = true; this.pvp?.sendRelease({ castId: run.castId, at: Math.round(T.startup), ax: Math.round(run.aim.x * 1000), ay: Math.round(run.aim.y * 1000) }); }
      }
      // …and the next one right after this one strikes (no recovery wait between throws).
      if (this.jbWant > 0 && run.phase !== 'startup' && e >= T.startup + (s.hits[0]?.at ?? 0)) {
        const i = this.kit.findIndex((x) => x.id === 'judgment_blade');
        this.jbWant--;
        if (i >= 0 && this.rt!.cooldownRemaining(s.id) <= 0) { this.rt!.cancelForFollowUp(run); this.endRun(run, false); if (!this.tryStartSlot(i)) this.jbWant = 0; else { const nr = this.rt!.ownRun; if (nr) nr.jbQuick = true; } }
        else this.jbWant = 0; // every blade is out
      }
      return;
    }
    for (const key of ['lunge', 'momentum'] as const) { // glide toward the target / along the push
      const m = this[key]; if (!m) continue;
      const f = Math.min(1, ms / Math.max(1, m.left)), nx = k.x + m.x * f, ny = k.y + m.y * f;
      if (footAllowed(nx, ny, k.z, R) && !this.blockedByActors(nx, ny, k.z)) { k.x = nx; k.y = ny; }
      m.x -= m.x * f; m.y -= m.y * f; m.left -= ms; if (m.left <= 0) this[key] = null;
    }
    if (s.through && run.phase === 'recovery' && !run.turned && run.elapsed >= T.startup + T.active + 0.75 * T.recovery) { // crossed the target: after the skid, turn to face it
      run.turned = true;
      const t = this.targetsFor(run).filter((x) => x.alive && x.id !== this.localId).sort((a, b) => Math.hypot(a.x - k.x, a.y - k.y) - Math.hypot(b.x - k.x, b.y - k.y))[0];
      if (t && Math.hypot(t.x - k.x, t.y - k.y) < 200 && (t.x - k.x) * run.aim.x + (t.y - k.y) * run.aim.y < 0) { this.aim = unit(t.x - k.x, t.y - k.y); this.dir = dirOf(this.aim.x, this.aim.y, this.dir); }
    }
    if (k.grounded) {
      if (scale > 0) steer(k, inp.moveX * PHYS.walk * scale * this.body.moveScale(now), inp.moveY * PHYS.walk * scale * this.body.moveScale(now), ms);
      else { k.vx *= 0.7; k.vy *= 0.7; }
    } else if (scale > 0) steer(k, inp.moveX * PHYS.walk * scale, inp.moveY * PHYS.walk * scale, ms, 0.6);
    else { k.vx *= 0.97; k.vy *= 0.97; } // air skill keeps most of its momentum
    // Movement cancel from recovery after 35% (whiffed counters stay committed).
    if (run.phase === 'recovery' && inp.hasMove && !s.counter && run.elapsed >= T.startup + T.active + 0.35 * T.recovery) {
      this.rt!.cancelForFollowUp(run);
      this.endRun(run, true);
      return;
    }
    // Jump cancel from recovery: after a confirmed hit (chase), or after 35% of recovery; never the Ultimate / a whiffed counter.
    const jumpOk = run.phase === 'recovery' && k.grounded && !s.counter && s.slot !== 7
      && (run.confirmedAt >= 0 || run.elapsed >= T.startup + T.active + 0.35 * T.recovery);
    if (jumpOk && inp.takeJump()) {
      this.rt!.cancelForFollowUp(run);
      this.endRun(run, true);
      jump(k, PHYS.jumpVz * this.passives.jumpMul); this.setMode('takeoff');
    }
  }

  /** War Leap: a second, farther jump in mid-air (once per airtime) with a burst of wind. */
  private warLeap(now: number): void {
    const k = this.kin, inp = this.ci!;
    const d = inp.hasMove ? unit(inp.moveX, inp.moveY) : FACE[this.dir], L = this.cls === 'samurai' ? SHINSOKU : WAR_LEAP; // Shinsoku: flatter, faster
    k.vz = Math.max(k.vz, L.vz); k.vx = d.x * L.forward; k.vy = d.y * L.forward * 0.6;
    this.leapUsed = true; this.leapUntil = now + 320; this.leapAt = now;
    this.setMode('takeoff');
    this.fx!.dust(k.x - d.x * 18, k.y - k.z, 70, 0.7, this.dustDepth(k));
    const side = d.x < 0 || (d.x === 0 && this.dir === 'left') ? -1 : 1;
    if (this.cls === 'archer') this.fx!.windLeap(k.x, k.y - k.z, side); else if (this.cls === 'samurai') this.fx!.shinsoku(k.x, k.y - k.z - 4, side); else this.fx!.leapBurst(k.x, k.y - k.z - 4, side);
  }

  /** Every skill open: QA build, PvP arena, or the Skill Book's "all skills" test switch. */
  private allOpen(): boolean { return isQAMode() || this.arena || allSkillsOpen(); }

  /** Passives owned now (level / all-open) → stats + body resistances; keeps the HP fraction when max HP changes. */
  private applyPassives(): void {
    const lvl = this.character ? skillLevel(this.character) : 1, all = this.allOpen(), before = this.body.maxHp || 1, frac = this.playerHP / before;
    this.passives = passivesFor(this.cls).length && (all || lvl >= BEGINNER_TO) ? passiveStats(ownedPassives(this.cls, lvl, all)) : NO_PASSIVES;
    this.body.ccResist = this.passives.ccResist; this.body.kbResist = this.passives.kbResist;
    this.body.maxHp = this.maxHpNow();
    this.hpMaxSeen = this.body.maxHp; // already rescaled here (stepPassives must not scale again)
    this.refreshPassiveStrip();
    if (this.dead < 0 && Number.isFinite(frac)) this.playerHP = Math.max(1, Math.round(frac * this.body.maxHp));
  }

  /** Passive icons above the skill tray (owned bright, locked dimmed). */
  private refreshPassiveStrip(): void {
    if (!this.hud || !passivesFor(this.cls).length) { this.hud?.setPassives([]); return; }
    const all = this.allOpen(), lvl = this.character ? skillLevel(this.character) : 1, own = ownedPassives(this.cls, lvl, all);
    const open = all || lvl >= BEGINNER_TO;
    this.hud.setPassives(passivesFor(this.cls).map((p) => ({ id: p.id, name: p.name, iconUrl: passiveIconUrl(p), owned: open && own.has(p.id), info: p.effects.join(' · ') })));
  }

  // ======================================================================= loot (gold, potions)

  /** Soft light under a drop and the little star that glints on it (made once). */
  private lootTextures(): void {
    if (!this.textures.exists('loot.glow')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      for (let r = 32; r > 0; r -= 2) { g.fillStyle(0xfff2c0, 0.05 + (1 - r / 32) * 0.1); g.fillEllipse(32, 16, r * 2, r); }
      g.generateTexture('loot.glow', 64, 32); g.destroy();
    }
    if (!this.textures.exists('loot.glint')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false); g.fillStyle(0xffffff, 1);
      g.fillPoints([{ x: 12, y: 0 }, { x: 14, y: 10 }, { x: 24, y: 12 }, { x: 14, y: 14 }, { x: 12, y: 24 }, { x: 10, y: 14 }, { x: 0, y: 12 }, { x: 10, y: 10 }], true);
      g.generateTexture('loot.glint', 24, 24); g.destroy();
    }
    if (!this.anims.exists('loot.coin.spin') && this.textures.exists('loot.coin')) this.anims.create({ key: 'loot.coin.spin', frames: this.anims.generateFrameNumbers('loot.coin', {}), frameRate: 12, repeat: -1 });
  }

  /** A defeated monster's drops pop out of it in an arc, bounce once and settle around where it fell. */
  private dropLoot(m: Monster): void {
    if (this.arena || !this.character) return;
    this.lootTextures();
    const list = rollDrops(Object.entries(MOB_KINDS).find(([, k]) => k === m.kind)?.[0], m.kind.exp ?? Math.round(m.kind.hp / 5));
    this.spawnDrops(list, m.kin, supportAt(m.kin.x, m.kin.y, m.kin.z + 1).z);
  }

  /** Drops thrown up from a spot (x, y, height z), landing on the floor at `base`. */
  private spawnDrops(list: Drop[], at: { x: number; y: number; z: number }, base: number, toss = 1): LootDrop[] {
    const made: LootDrop[] = [];
    list.forEach((d, i) => {
      const gold = d.kind === 'gold', big = gold && d.amount >= GOLD_BIG;
      const sz = gold ? (big ? 34 : 28) : 36;
      const x = at.x, y = at.y + (Math.random() - 0.5) * 12;
      const img = gold ? this.add.sprite(x, y, 'loot.coin', 0).play({ key: 'loot.coin.spin', startFrame: Math.floor(Math.random() * 8) }) : this.add.image(x, y, `loot.${d.id}`);
      img.setOrigin(0.5, 0.9).setDisplaySize(sz, sz);
      if (big) img.setTint(0xfff0c0);
      const glow = this.add.image(x, y, 'loot.glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      const rar = d.id ? ITEMS[d.id].rarity : 'common';
      glow.setTint(RARITY[rar].glow);
      const beam = rar === 'rare' ? this.add.image(x, y, 'loot.beam').setOrigin(0.5, 0.92).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDisplaySize(46, 150) : undefined;
      const sh = this.add.ellipse(x, y, sz * 0.7, sz * 0.2, 0x000000, 0.3);
      const spread = (i - (list.length - 1) / 2) * 30;
      const drop: LootDrop = { ...d, img, sh, glow, sz, x, y, z: Math.max(base + 14, at.z + 34), vx: (spread * 2.4 + (Math.random() - 0.5) * 120) * toss, vz: (360 + Math.random() * 60) * (0.5 + 0.5 * toss),
        beam, base, landed: false, bounced: false, born: this.simMs, taken: -1, seed: Math.random() * 6.28, nextGlint: this.simMs + 600 + Math.random() * 1400 };
      this.drops.push(drop); made.push(drop);
    });
    return made;
  }

  /** The treasures on the tops of the cube perches (Areas.TOWERS reward): one waits up there; taken (or faded), another
   *  comes back after its time. */
  private stepTreasures(): void {
    if (this.arena || !this.character || !this.world) return;
    if (!this.treasures) this.treasures = TOWERS.filter((t) => t.reward && ITEMS[t.reward.item]).map((t) => ({ t, next: 0, drop: null as LootDrop | null }));
    for (const q of this.treasures) {
      if (q.drop && !q.drop.done && q.drop.taken < 0 && this.drops.includes(q.drop)) continue;
      if (q.drop) { q.drop = null; q.next = this.simMs + q.t.reward!.every * 1000; }
      if (this.simMs < q.next) continue;
      this.lootTextures();
      const top = q.t.base + q.t.h, x = (q.t.x0 + q.t.x1) / 2, y = q.t.front - q.t.depth / 2;
      q.drop = this.spawnDrops([{ kind: 'item', id: q.t.reward!.item, amount: 1 }], { x, y, z: top }, top, 0)[0] ?? null;
      if (q.drop) q.drop.keep = true;
    }
  }

  /** Drops fly, bounce, bob gently with a soft light under them and a glint now and then; walked over: they swoop into
   *  you; after a minute they fade. */
  private stepLoot(ms: number, now: number): void {
    const k = this.kin, dt = ms / 1000, alive = this.dead < 0;
    for (const d of this.drops) {
      let sq = 1;
      if (d.taken >= 0) {
        const t = Math.min(1, (now - d.taken) / 220), e = t * t;
        d.x += (k.x - d.x) * e; d.y += (k.y - d.y) * e; d.z = d.z + (k.z + 56 - d.z) * e + Math.sin(t * Math.PI) * 6;
        d.img.setAlpha(1 - Math.max(0, t - 0.6) / 0.4); d.sh.setAlpha(0); d.glow.setAlpha(0); sq = 1 - t * 0.5;
        if (t >= 1) d.done = true;
      } else if (!d.landed) {
        d.vz -= 1400 * dt; d.z += d.vz * dt; d.x += d.vx * dt;
        if (!footAllowed(d.x, d.y, d.base, 8) || supportAt(d.x, d.y, d.base + 1).z !== d.base) { d.x -= d.vx * dt; d.vx = 0; }   // stays on the floor it fell on
        if (d.z <= d.base && d.vz < 0) {
          d.z = d.base;
          if (!d.bounced) { d.bounced = true; d.vz = -d.vz * 0.32; d.vx *= 0.4; }
          else { d.landed = true; d.born = now; }
        }
        sq = d.z < d.base + 4 && d.bounced ? 0.85 : 1;
      } else {
        const age = now - d.born;
        d.z = d.base + 4 + Math.sin(age / 320 + d.seed) * 3.5;
        d.glow.setAlpha(Math.min(1, age / 300) * (0.55 + Math.sin(age / 420 + d.seed) * 0.2));
        d.beam?.setAlpha(Math.min(1, age / 400) * (0.75 + Math.sin(age / 300) * 0.2));
        if (now >= d.nextGlint) { d.nextGlint = now + 1400 + Math.random() * 1800; this.lootGlint(d); }
        if (age > 60_000 && !d.keep) { const f = Math.max(0, 1 - (age - 60_000) / 3000); d.img.setAlpha(f); d.glow.setAlpha(d.glow.alpha * f); if (age > 63_000) d.done = true; }
        if (alive && age > 250 && Math.abs(d.x - k.x) < 40 && Math.abs(d.y - k.y) < 24 && Math.abs(k.z - d.base) < 50) this.takeDrop(d, now);
      }
      d.img.setPosition(d.x, d.y - d.z).setDepth(actorDepth(d.x, d.y, d.z) - 0.2).setDisplaySize(d.sz * (2 - sq), d.sz * sq);
      d.glow.setPosition(d.x, d.y - d.base - 2).setDepth(actorDepth(d.x, d.y, d.base) - 0.7).setDisplaySize(d.sz * 1.9, d.sz * 0.75);
      if (d.beam) { d.beam.setPosition(d.x, d.y - d.base).setDepth(actorDepth(d.x, d.y, d.base) - 0.5); if (d.taken >= 0) d.beam.setAlpha(0); }
      d.sh.setPosition(d.x, d.y - d.base - 1).setDepth(actorDepth(d.x, d.y, d.base) - 0.6).setScale(Math.max(0.5, 1 - (d.z - d.base) / 120));
    }
    if (this.drops.some((d) => d.done)) this.drops = this.drops.filter((d) => { if (d.done) { d.img.destroy(); d.sh.destroy(); d.glow.destroy(); d.beam?.destroy(); } return !d.done; });
  }

  private lootGlint(d: LootDrop): void {
    const g = this.add.image(d.x + (Math.random() - 0.5) * d.sz * 0.5, d.y - d.z - d.sz * (0.3 + Math.random() * 0.4), 'loot.glint')
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(actorDepth(d.x, d.y, d.z) + 0.1).setScale(0).setAngle(Math.random() * 45);
    this.tweens.add({ targets: g, scale: 0.55, angle: g.angle + 60, duration: 220, yoyo: true, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
  }

  private takeDrop(d: LootDrop, now: number): void {
    if (d.kind === 'item' && d.id && (this.bag[d.id] ?? 0) >= BAG_MAX) return; // full: it stays on the floor
    d.taken = now;
    for (let i = 0; i < 2; i++) this.time.delayedCall(i * 90, () => this.lootGlint(d));
    if (d.kind === 'gold') { this.gold = Math.min(GOLD_MAX, this.gold + d.amount); this.hud?.lootFeed(GOLD_ICON.small, `+${fmtGold(d.amount)} Gold`, '#f3d58c'); }
    else if (d.id) { this.giveItem(d.id, d.amount, false); this.hud?.lootFeed(ITEMS[d.id].icon, `${ITEMS[d.id].name} ×${d.amount}`, RARITY[ITEMS[d.id].rarity].color); }
    this.saveLoot();
  }

  private saveLoot(): void { if (this.character) { this.character.gold = this.gold; this.character.bag = { ...this.bag }; this.character.seen = [...this.seen]; CharacterStore.setLoot(this.character.id, this.gold, this.bag, this.quick, this.character.seen); } this.cosPanel?.refreshBag(); this.shop?.refresh(); if (this.world) this.refreshQuests(); }

  /** Items into the bag (quest rewards, purchases, pickups). */
  giveItem(id: string, n: number, save = true): void {
    const d = ITEMS[id]; if (!d || n <= 0) return;
    this.bag[id] = Math.min(BAG_MAX, (this.bag[id] ?? 0) + n);
    if (!this.seen.has(id)) { // first find: its story
      this.seen.add(id); save = true;
      this.hud?.newItem(d.icon, d.name, RARITY[d.rarity].color, RARITY[d.rarity].label, d.lore);
      this.chat?.add({ kind: 'system', text: `New item — ${d.name}: ${d.lore}` });
    }
    if (save) this.saveLoot();
  }
  /** Items out of the bag (false: not enough). */
  takeItem(id: string, n: number): boolean { if ((this.bag[id] ?? 0) < n) return false; this.bag[id] -= n; if (this.bag[id] <= 0) delete this.bag[id]; this.saveLoot(); return true; }

  /** An item hotkey (0: key 8, 1: key 9): uses the item set on it. */
  usePotion(i: 0 | 1): void { if (this.simMs - this.potionAt[i] < POTION_DELAY) return; this.potionAt[i] = this.simMs; this.useItem(this.quick[i], true); }
  /** Sets an item on an item hotkey. */
  setQuick(i: 0 | 1, id: string): void { if (!usable(id)) return; this.quick[i] = id; this.saveLoot(); }

  /** Uses one item from the bag: recovery (not when already full), a buff potion, the Return Scroll. */
  useItem(id: string, fromKey = false): void {
    const it = ITEMS[id], now = this.simMs, k = this.kin;
    if (!it || !usable(id) || this.dead >= 0 || !this.character || this.arena) return; // the arena: fixed HP, no items (a battle round can't be healed through)
    if (now - (this.useAt[id] ?? -Infinity) < POTION_DELAY && !fromKey) return;
    if ((this.bag[id] ?? 0) <= 0) { this.fx?.callout({ x: k.x, y: k.y, z: k.z + 70 }, `NO ${it.name.toUpperCase()}`, '#c9ced8', 0); return; }
    if (it.kind === 'scroll') {
      if (this.warping || this.rt?.ownRun || !this.world) return;
      this.useAt[id] = now; this.takeItem(id, 1); this.usePortal(); return;
    }
    if (it.kind === 'buff' && it.buff) {
      if (it.buff.stat === 'dmg') this.itemDmgUntil = now + it.buff.ms; else { this.itemSpeedUntil = now + it.buff.ms; }
      this.useAt[id] = now; this.takeItem(id, 1);
      this.fx?.callout({ x: k.x, y: k.y, z: k.z + 60 }, it.buff.stat === 'dmg' ? 'DAMAGE UP' : 'SPEED UP', '#ffd27a', 0);
      this.fx?.shockwave(k.x, k.y, 90, it.buff.stat === 'dmg' ? 0xff9a5a : 0x8aff9a);
      return;
    }
    const mh = this.maxHpNow(), mm = this.maxMpNow();
    const hp = it.kind === 'pct' ? Math.round(mh * (it.pct ?? 0)) : it.hp ?? 0, mp = it.kind === 'pct' ? Math.round(mm * (it.pct ?? 0)) : it.mp ?? 0;
    const addH = Math.min(hp, mh - this.playerHP), addM = Math.min(mp, mm - this.mp);
    if (addH <= 0 && addM <= 0) return; // already full
    this.playerHP += Math.max(0, addH); this.mp += Math.max(0, addM);
    this.useAt[id] = now; this.takeItem(id, 1);
    if (addH > 0) this.fx?.callout({ x: k.x, y: k.y, z: k.z + 46 }, `+${Math.round(addH)}`, '#8ff09a', 1);
    if (addM > 0) this.fx?.callout({ x: k.x + 18, y: k.y, z: k.z + 30 }, `+${Math.round(addM)}`, '#8fc4ff', 1);
  }

  /** Mira's shop: null = done, else why not. */
  private buy(id: string, n: number): string | null {
    const d = ITEMS[id]; if (!d?.price || n <= 0) return 'Not for sale.';
    const cost = d.price * n; if (cost > this.gold) return 'Not enough gold.';
    if ((this.bag[id] ?? 0) + n > BAG_MAX) return 'Your bag cannot hold that many.';
    this.gold -= cost; this.giveItem(id, n); return null;
  }
  private sell(id: string, n: number): string | null {
    const d = ITEMS[id]; if (!d || n <= 0 || !this.takeItem(id, n)) return 'You do not have that many.';
    this.gold = Math.min(GOLD_MAX, this.gold + d.sell * n); this.saveLoot(); return null;
  }

  /** EXP from a defeated monster: floating +EXP, level ups (full heal, LEVEL UP effect), saved on the character. */
  private gainExp(n: number, at: V3): void {
    const ch = this.character;
    if (!ch || this.arena || n <= 0) return;
    const r = addExp(ch.level, ch.exp ?? 0, n);
    this.fx!.callout({ x: at.x, y: at.y, z: at.z + 30 }, `+${n} EXP`, '#ffe27a', 2);
    const was = ch.level;
    ch.level = r.level; ch.exp = r.exp;
    CharacterStore.setProgress(ch.id, r.level, r.exp);
    if (!r.ups) return;
    const k = this.kin;
    this.fx!.callout({ x: k.x, y: k.y, z: k.z + 60 }, 'LEVEL UP!', '#ffd34a', 0);
    this.fx!.shockwave(k.x, k.y, 160, 0xffd27a);
    this.time.delayedCall(90, () => this.fx!.shockwave(k.x, k.y, 240, 0xfff1c2));
    this.hud?.banner(`LEVEL ${r.level}`, 1600, false);
    this.applyPassives();
    this.playerHP = this.maxHpNow();
    this.skillBook?.setLevel(skillLevel(ch));
    this.statD = derive(this.stats, this.cls, ch.level); this.applyPassives(); this.playerHP = this.maxHpNow(); this.mp = this.maxMpNow();
    this.chat?.add({ kind: 'system', text: `+${r.ups * AP_PER_LEVEL} AP — press ${keyLabel(this.bindings.stats) || 'U'} to place them.` }); this.refreshStats();
    if (playedClass({ ...ch, level: was }) !== playedClass(ch)) this.time.delayedCall(1700, () => this.scene.restart({ pvpRoom: null, at: { x: this.kin.x, y: this.kin.y } })); // an older character past the old 1st-job level: becomes his own class
    if (was < BEGINNER_TO && r.level >= BEGINNER_TO && !hasJob(ch)) this.chat?.add({ kind: 'system', text: 'Level 10! The Masters of the four paths await you on the Temple Road.' });
  }

  /** Skill Book switch: open / close every skill for testing at any level. */
  private setAllOpen(on: boolean): void { setAllSkillsOpen(on); this.applyPassives(); this.skillBook?.setUnlockAll(this.allOpen()); }

  /** Max HP: fixed in the PvP arena (fair fights), raised by passives in the world. */
  /** Max MP: the job, the level and INT (the arena: the same for everyone). */
  maxMpNow(): number { const lv = this.character?.level ?? 1; return this.arena ? MP_ARENA : Math.round((60 + 6 * lv + 1.5 * (this.stats.int - BASE_STAT)) * (MP_CLASS[this.cls] ?? 1)); }

  maxHpNow(): number { return Math.round((this.arena ? PVP.maxHp : S6.player.maxHp * this.passives.hpMul * this.statD.hpMul) * (this.simMs < this.oathUntil ? 1.3 : 1)); }

  /** Own damage multiplier from stats: the worn weapon's attack (bare hands hit weakly) × Sword Mastery × Combo Force orbs. */
  private passiveDmgMul(): number { return attackMul(this.gearSt) * this.passives.dmg * (1 + ORBS.perOrb * this.orbs.n) * (this.arena ? 1 : this.statD.dmgMul); }

  /** Chance Attack: helpless target (hit-stun / down / hard CC). */
  private chanceMul(b: CombatBody | undefined): number {
    if (!b || this.passives.chanceAttack === 1) return 1;
    return b.state === 'hitstun' || b.state === 'knockdown' || b.hard.active(this.simMs) ? this.passives.chanceAttack : 1;
  }

  /** Chance Attack landed: target sigil over the foe (at most every 0.5 s per target). */
  private chanceMark(id: string, at: V3): void {
    if ((this.markAt.get(id) ?? -Infinity) > this.simMs - 500) return;
    this.markAt.set(id, this.simMs);
    this.fx!.passiveFx('target_mark', { x: at.x, y: at.y, z: at.z }, 120, { depth: 100000, ms: [40, 40, 50, 60, 60, 70, 80, 90] });
  }

  /** Final Attack: a chance for an extra slash right after an own hit lands on a PvE target / the sparring knight. */
  private finalAttack(run: CastRun, target: string, at: V3, dmg: number): void {
    const fa = this.passives.fa;
    if (!fa || dmg <= 0 || run.attackerId !== this.localId || Math.random() >= fa.chance) return;
    const extra = Math.max(1, Math.round(dmg * fa.mul)), side = run.aim.x < 0 ? -1 : 1;
    this.time.delayedCall(90, () => {
      if (target === 'enemy') { if (!this.enemy?.alive) return; this.enemy.damage(extra); }
      else if (target === 'dummy') { if (!this.dummyState?.alive) return; this.damageDummy(extra); }
      else if (target === BOT_ID) {
        const b = this.bot; if (!b || b.defeated || (this.match?.active && !this.match.live)) return;
        b.extra(extra);
        if (b.defeated && this.match) { this.rt?.cancelAttacker(BOT_ID); b.knockOut(); this.match.death(BOT_ID); } // a battle round: the extra slash ends it
      }
      else if (target.startsWith('mob:')) {
        const m = this.mobById(target); if (!m?.alive) return;
        if (m.damage(extra, this.simMs)) { this.questKill(m); this.gainExp(m.kind.exp ?? Math.round(m.kind.hp / 5), { x: m.kin.x, y: m.kin.y, z: m.kin.z }); this.dropLoot(m); if (this.gripFoe === m) { this.gripFoe = null; this.gripHeld = false; } }
      }
      else return;
      const big = fa.mul >= 0.5; // Advanced Final Attack: a bigger triple cut
      if (run.skill.cls === 'archer') { this.fx!.extraArrow({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 40 }, at); this.fx!.damageNumber(at, extra, false, 0, true); return; } // Extra Shot: a second arrow of wind
      if (run.skill.cls === 'samurai') { // Final Cut: a ghost blade (Advanced: two)
        this.fx!.ghostCut(at, side, big); if (big) this.time.delayedCall(70, () => this.fx!.ghostCut({ x: at.x, y: at.y, z: at.z + 18 }, -side, true));
        this.fx!.damageNumber(at, extra, false, 0, true); return;
      }
      this.fx!.finalSlash(at, side, big);
      if (big) for (const [d, dx, dz] of [[60, 18, 14], [120, -16, -12]] as const) this.time.delayedCall(d, () => this.fx!.finalSlash({ x: at.x + dx, y: at.y, z: at.z + dz }, side, true));
      this.fx!.damageNumber(at, extra, false, 0, true);
    });
  }

  /** Self Recovery tick, Combo Force orb decay + orbit render. */
  private stepPassives(ms: number, now: number): void {
    if (this.shares.length) { const due = this.shares.filter((x) => now >= x.at); this.shares = this.shares.filter((x) => now < x.at); if (this.dead < 0) for (const x of due) this.shareWithParty(x.id, x.ms); }
    const P = this.passives;
    if (P.regen && this.dead < 0 && !this.arena) { // (the arena: no passive regeneration — a round's HP only comes back with the next round)
      this.regenAt += ms;
      if (this.regenAt >= REGEN.everyMs) {
        this.regenAt = 0;
        const max = this.maxHpNow(), before = this.playerHP;
        this.playerHP = Math.min(max, this.playerHP + Math.max(1, Math.round(max * REGEN.frac)));
        if (this.playerHP > before) {
          this.fx!.healNumber({ x: this.kin.x, y: this.kin.y, z: this.kin.z }, this.playerHP - before);
          this.fx!.passiveFx('heal_sparkle', { x: this.kin.x, y: this.kin.y, z: this.kin.z }, 220, { originY: 0.8, normal: true, depth: 100000 - 1, ms: [70, 80, 100, 120, 130, 140, 150, 160], follow: () => (this.dead < 0 ? { x: this.kin.x, y: this.kin.y, z: this.kin.z } : null) });
        }
      }
    }
    const mx = this.maxHpNow();
    if (this.hpMaxSeen && mx !== this.hpMaxSeen && this.dead < 0) this.playerHP = Math.max(1, Math.min(mx, Math.round(this.playerHP * mx / this.hpMaxSeen)));
    this.hpMaxSeen = mx; this.body.maxHp = mx;
    const b = this.body, kn = this.kin;
    if (b.stanceAt > this.seenStance) { // Power Stance / Warrior Mastery held the ground
      this.seenStance = b.stanceAt;
      this.fx!.passiveFx('stance_ring', { x: kn.x, y: kn.y, z: kn.z }, 230, { originY: 0.66, depth: kn.y - 1, normal: true });
    }
    if (b.endureAt > this.seenEndure) { // Endure shortened the stun / slow
      this.seenEndure = b.endureAt;
      this.fx!.passiveFx('chains_break', { x: kn.x, y: kn.y, z: kn.z + 46 }, 150, { depth: kn.y + 3, follow: () => ({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 46 }) });
    }
    if (this.orbs.n > 0 && (now - this.orbs.lastAt > ORBS.fadeMs || this.dead >= 0)) this.orbs.n = 0;
    if (!P.orbs) return;
    const show = this.orbs.n > 0 && this.dead < 0 && !!this.view?.visible && this.textures.exists('pas-combo_orb');
    while (this.orbImgs.length < ORBS.max) this.orbImgs.push(this.add.image(0, 0, 'pas-combo_orb', 0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(34, 34).setVisible(false));
    const k = this.kin, cy = k.y - k.z - 62, t = now / 1000;
    this.orbImgs.forEach((img, i) => {
      if (!show || i >= this.orbs.n) { img.setVisible(false); return; }
      const a = t * 2.4 + (i * Math.PI * 2) / this.orbs.n, front = Math.sin(a) > 0; // orbit in front of / behind the body
      img.setVisible(true).setPosition(k.x + Math.cos(a) * 36, cy + Math.sin(a) * 12).setFrame((Math.floor(now / 70) + i * 3) % 8)
        .setDepth(k.y + (front ? 2 : -2)).setAlpha(Math.min(1, (ORBS.fadeMs - (now - this.orbs.lastAt)) / 600));
    });
  }

  /** Dash / leap: swept along the aim (or toward the locked target), stopped by cover and bodies; never through walls. */
  private dashMotion(run: CastRun): void {
    const k = this.kin, s = run.skill, d = s.dash!;
    const p = Math.min(1, (run.elapsed - run.timings.startup) / Math.max(1, run.timings.active));
    const ease = 1 - (1 - p) * (1 - p);
    let dist = d.distance;
    if (run.lock) {
      const t = this.targetsFor(run).find((x) => x.id === run.lock);
      if (t) dist = Math.min(d.distance, Math.max(0, Math.hypot(t.x - run.origin.x, t.y - run.origin.y) - 34));
    }
    const want = { x: run.origin.x + run.aim.x * dist * ease, y: run.origin.y + run.aim.y * dist * ease };
    const steps = Math.ceil(Math.hypot(want.x - k.x, want.y - k.y) / 2);
    for (let i = 0; i < steps; i++) {
      const nx = k.x + (want.x - k.x) / (steps - i), ny = k.y + (want.y - k.y) / (steps - i);
      if (!footAllowed(nx, ny, k.z, R) || (!s.through && !s.carry && this.blockedByActors(nx, ny, k.z))) break;
      k.x = nx; k.y = ny;
    }
    k.vx = 0; k.vy = 0;
    if (d.lift) { // acrobatic leap: real height (shots fire from it), lands by gravity afterwards
      k.grounded = false;
      const hang = d.hang ? (p < 0.1 ? Math.sin((Math.PI / 2) * (p / 0.1)) : p > 0.86 ? Math.cos((Math.PI / 2) * ((p - 0.86) / 0.14)) : 1) : 0;
      k.z = d.hang ? run.origin.z + d.lift * hang : d.crash ? run.origin.z + d.lift * Math.sin(Math.PI * Math.min(1, p * 1.06)) : Math.max(k.z, run.origin.z + d.lift * Math.sin(Math.PI * p));
      k.vz = p < 0.5 ? 40 : -40;
    }
  }

  /** Where another player's dash has carried them by now, worked out from the cast itself the way their own client moves
   *  them (dashMotion): along the aim, eased, up to the locked target, stopped by walls and props. Their drawn body runs
   *  ~100 ms (and the network delay) behind — hit tests along it came too late and too short. */
  private remoteDashPos(run: CastRun): V3 | null {
    const d = run.skill.dash;
    if (!d) return null;
    const T = run.timings, o = run.origin;
    const p = Math.max(0, Math.min(1, (run.elapsed - T.startup) / Math.max(1, T.active))), ease = 1 - (1 - p) * (1 - p);
    let dist = d.distance;
    if (run.lock && run.lock === this.localId) dist = Math.min(d.distance, Math.max(0, Math.hypot(this.kin.x - o.x, this.kin.y - o.y) - 34));
    const wx = o.x + run.aim.x * dist * ease, wy = o.y + run.aim.y * dist * ease, n = Math.ceil(Math.hypot(wx - o.x, wy - o.y) / 3);
    let x = o.x, y = o.y;
    for (let i = 1; i <= n; i++) { const nx = o.x + ((wx - o.x) * i) / n, ny = o.y + ((wy - o.y) * i) / n; if (!footAllowed(nx, ny, o.z, R)) break; x = nx; y = ny; }
    const z = d.lift ? o.z + d.lift * Math.sin(Math.PI * (d.crash ? Math.min(1, p * 1.06) : p)) : o.z;
    return { x, y, z };
  }

  /** Impaling Rush: the confirmed target (enemy or sparring knight) rides on the blade in front of the dashing warrior; a wall stops it hard. */
  private carryTarget(run: CastRun): void {
    const mob = (this.world?.mobs ?? []).filter((m) => m.alive && this.simMs - m.body.lastHitAt < 400).sort((a, b) => b.body.lastHitAt - a.body.lastHitAt)[0];
    const k = this.kin, e = mob ?? (this.enemy?.alive ? this.enemy : this.bot && this.simMs - this.bot.body.lastHitAt < 400 ? this.bot : null);
    if (!e || run.confirmedAt < 0) return;
    if (Math.hypot(e.kin.x - k.x, e.kin.y - k.y) > 110) return;
    const nx = k.x + run.aim.x * 46, ny = k.y + run.aim.y * 46;
    if (footAllowed(nx, ny, e.kin.z, 12)) { e.kin.x = nx; e.kin.y = ny; e.body.push = null; e.kin.vx = 0; e.kin.vy = 0; }
    else if (!run.turned) { run.turned = true; e.body.state = 'hitstun'; e.body.stateEnd = this.simMs + 900; this.fx!.callout({ x: e.kin.x, y: e.kin.y, z: e.kin.z + 40 }, 'WALL CRASH!!', '#9ed8ff', 0); this.fx!.shockwave(e.kin.x, e.kin.y, 100, 0x9ed8ff); this.cameras.main.shake(140, 0.005); }
  }

  /** Hit by another player's / the knight's Impaling Rush: carried in front of the blade while it dashes; a wall stops you hard. */
  private rideBlade(): void {
    const run = this.carriedBy, k = this.kin, b = this.body;
    if (!run) return;
    const c = this.casterPos(run.attackerId);
    if (run.phase !== 'active' || !c || this.dead >= 0 || Math.hypot(c.x - k.x, c.y - k.y) > 110) { this.carriedBy = null; return; }
    const nx = c.x + run.aim.x * 46, ny = c.y + run.aim.y * 46;
    if (footAllowed(nx, ny, k.z, 12)) { k.x = nx; k.y = ny; b.push = null; k.vx = 0; k.vy = 0; return; }
    this.carriedBy = null; b.state = 'hitstun'; b.stateEnd = this.simMs + 900;
    this.fx!.callout({ x: k.x, y: k.y, z: k.z + 40 }, 'WALL CRASH!!', '#9ed8ff', 0); this.fx!.shockwave(k.x, k.y, 100, 0x9ed8ff); this.cameras.main.shake(140, 0.005);
  }

  /** Physical reaction feedback on the enemy: knockback skid dust, heavy landing slam, bounce puff. */
  private skidT = 0;
  /** Depth of an actor's own dust: just over him, so whatever hides his feet (a block in front) hides it too. */
  private dustDepth(k: Kin): number { return actorDepth(k.x, k.y, k.z) + 0.3; }
  private reactionFx(ms: number): void {
    this.skidT -= ms;
    for (const e of [this.enemy, ...(this.world?.mobs ?? [])]) {
      if (!e?.alive) continue;
      const k = e.kin, sp = Math.hypot(k.vx, k.vy);
      const sam = this.cls === 'samurai'; // (a samurai's foes: dust the colour of the ground, never a white flash)
      if (k.grounded && e.body.push && sp > 140 && this.skidT <= 0) { if (sam) this.fx!.samSkid(k.x - (k.vx / sp) * 14, k.y); else this.fx!.dust(k.x - (k.vx / sp) * 14, k.y - k.z, 46, 0.7, this.dustDepth(k)); this.skidT = 55; }
      if (e.lastEv === 'kdImpact') { if (sam) this.fx!.samLanding(k.x, k.y); else { this.fx!.dust(k.x, k.y - k.z, 130, 0.95, this.dustDepth(k)); this.fx!.shockwave(k.x, k.y - k.z, 70, 0xd8c8a8); } this.cameras.main.shake(90, 0.004); }
    }
  }

  /** Nearest live enemy within `range` whose direction is within the facing half-plane (dot > minDot). */
  private softTarget(range: number, minDot: number): HitTarget | null {
    const k = this.kin, f = FACE[this.dir];
    let best: HitTarget | null = null, bd = range;
    for (const t of this.targetsFor({ own: true, attackerId: this.localId } as CastRun)) {
      if (!t.alive || t.id === this.localId || this.pvp?.remotes.get(t.id)?.kageHidden) continue; // (a hidden samurai: no aim snaps to him)
      const dx = t.x - k.x, dy = t.y - k.y, d = Math.hypot(dx, dy);
      const dot = d > 1 ? (dx * (this.ci?.hasMove ? this.aim.x : f.x) + dy * (this.ci?.hasMove ? this.aim.y : f.y)) / d : 1;
      if (d < bd && dot > minDot) { bd = d; best = t; }
    }
    return best;
  }

  /** Spirit Hawk tick: the hawk dives at the nearest foe within its range (one target per dive). */
  private hawkDive(l: { run: CastRun; x: number; y: number }, L: NonNullable<FinalSkill['linger']>): void {
    let best: HitTarget | null = null, bd = Infinity;
    for (const t of this.targetsFor(l.run)) {
      if (!t.alive || t.invulnerable || t.id === l.run.attackerId || t.z > L.maxZ || (l.run.own && this.party?.has(t.id))) continue;
      const d = Math.hypot(t.x - l.x, t.y - l.y);
      if (d <= L.radius + t.radius && d < bd) { bd = d; best = t; }
    }
    if (!best) return;
    const at = { x: best.x, y: best.y, z: best.z + 40 }, zr = { ...l.run, origin: { x: best.x - (best.x >= l.x ? 30 : -30), y: best.y, z: 0 } } as CastRun;
    this.fx!.hawkDive(l.run.attackerId, at);
    const t = best;
    this.time.delayedCall(180, () => { // the hit lands when the hawk reaches the foe
      if (!t.alive) return;
      if (l.run.own) { if (t.kind === 'enemy') this.applyToPve(zr, L.hit, t, at); else if (t.id === BOT_ID) this.applyToBot(zr, L.hit, t, at); }
      else if (t.id === this.localId) this.applyRemoteHitToSelf(zr, L.hit, 0, at);
    });
  }

  /** God of Blades tick: two blades of the halo fly at the two nearest foes in reach (the hits land as they arrive); each
   *  blade that flies is spent — the halo has eight. */
  private bladeStrikes(l: { run: CastRun; x: number; y: number; blades?: number }, L: NonNullable<FinalSkill['linger']>): void {
    const left = (l.blades ??= GOD_BLADES);
    if (left <= 0) return;
    const near = this.targetsFor(l.run).filter((t) => t.alive && !t.invulnerable && t.id !== l.run.attackerId && t.z <= L.maxZ && !(l.run.own && this.party?.has(t.id)) && Math.hypot(t.x - l.x, t.y - l.y) <= L.radius + t.radius)
      .sort((p, q) => Math.hypot(p.x - l.x, p.y - l.y) - Math.hypot(q.x - l.x, q.y - l.y)).slice(0, Math.min(2, left));
    l.blades = left - near.length;
    near.forEach((t, n) => this.time.delayedCall(n * 90, () => {
      if (!t.alive) return;
      const at = { x: t.x, y: t.y, z: t.z + 40 }, zr = { ...l.run, origin: { x: t.x - (t.x >= l.x ? 30 : -30), y: t.y, z: 0 } } as CastRun;
      this.fx!.bladeStrike(l.run.attackerId, at, t.id);
      this.time.delayedCall(150, () => { // the blade reaches the foe
        if (!t.alive) return;
        if (l.run.own) { if (t.kind === 'enemy') this.applyToPve(zr, L.hit, t, at); else if (t.id === BOT_ID) this.applyToBot(zr, L.hit, t, at); }
        else if (t.id === this.localId) this.applyRemoteHitToSelf(zr, L.hit, 0, at);
      });
    }));
  }

  private stepLingers(now: number): void {
    for (const l of this.lingers) {
      const L = l.run.skill.linger!;
      while (l.left > 0 && now >= l.next) {
        l.left--; l.next += L.everyMs;
        if (L.at === 'caster') { const c = this.casterPos(l.run.attackerId); if (c) { l.x = c.x; l.y = c.y; } } // the quake travels with you
        if (l.run.skill.id === 'spirit_hawk') { this.hawkDive(l, L); continue; }
        if (l.run.skill.id === 'god_of_blades') { if (l.run.own && this.dead >= 0) { l.left = 0; break; } this.bladeStrikes(l, L); continue; }
        if (l.run.skill.id === 'tornado_blade') { const path = (l as { path?: { x: number; y: number }[] }).path ??= tornadoPath(l.run.origin, l.run.aim), q = path[Math.min(path.length - 1, TORNADO.count - 1 - l.left)]; l.x = q.x; l.y = q.y; } // rolls forward one step per strike (the picture takes the same path)
        if (l.run.skill.id === 'blade_storm') { // swords erupt all around the caster + lightning crackles
          for (let n = 0; n < 2; n++) { const a = (l.left * 2.4 + n * Math.PI) + (Math.random() - 0.5) * 0.9, rr = 70 + Math.random() * (L.radius - 40); this.fx!.risingBlade(l.x + Math.cos(a) * rr, l.y + Math.sin(a) * rr * 0.6, n * 90); }
        }
        else if (l.run.skill.id !== 'ground_breaker' && l.run.skill.id !== 'tornado_blade' && l.run.skill.id !== 'rain_of_arrows') this.fx!.crack(l.x, l.y, L.radius); // (Thunder Rain: the charged floor is drawn by ArcherFx) // the quake has one steady rotating ring instead of per-tick sparks; the tornado is its own picture
        if (l.run.skill.id === 'ground_breaker' && l.run.own && this.dead < 0) { // the quake mends the warrior: +2 HP per pulse
          const max = this.maxHpNow(), before = this.playerHP;
          this.playerHP = Math.min(max, this.playerHP + 2);
          if (this.playerHP > before) this.fx!.healNumber({ x: this.kin.x, y: this.kin.y, z: this.kin.z }, this.playerHP - before);
          for (let n = 0; n < 1; n++) this.fx!.hpGlyph(this.kin.x + (Math.random() - 0.5) * 90, this.kin.y + (Math.random() - 0.5) * 30);
        }
        const zr = { ...l.run, origin: { x: l.x, y: l.y, z: 0 }, zone: true } as CastRun; // hits come from the zone, not the caster
        for (const t of this.targetsFor(l.run)) {
          if (!t.alive || t.invulnerable || t.id === l.run.attackerId) continue;
          if (Math.hypot(t.x - l.x, t.y - l.y) > L.radius + t.radius || t.z > L.maxZ) continue;
          const at = { x: t.x, y: t.y, z: t.z + 40 };
          if (l.run.own) { if (t.kind === 'enemy') this.applyToPve(zr, L.hit, t, at); else if (t.id === BOT_ID) this.applyToBot(zr, L.hit, t, at); } // remote players resolve your zone on their side
          else if (t.id === this.localId) this.applyRemoteHitToSelf(zr, L.hit, 0, at); // another player's / the knight's zone on you
        }
      }
    }
    this.lingers = this.lingers.filter((l) => l.left > 0);
  }

  /** mobs: the open world's monsters count too (skill glides stop at them; walking passes through them, MapleStory-style). */
  private blockedByActors(x: number, y: number, z: number, mobs = true): boolean {
    const e = this.enemy;
    if (e && e.alive && Math.abs(e.z - z) < 50 && Math.hypot(x - e.x, y - e.y) < STAGE6.enemy.collisionRadius + R) return true;
    if (this.dummyState?.alive && z < 40 && Math.hypot(x - D.x, y - D.y) < D.collisionRadius + R) return true;
    if (mobs) for (const m of this.world?.mobs ?? []) if (m.alive && Math.abs(m.z - z) < 50 && Math.hypot(x - m.x, y - m.y) < STAGE6.enemy.collisionRadius * m.kind.scale + R) return true;
    return false;
  }

  private renderPlayer(ms: number): void {
    const v = this.view!, k = this.kin, run = this.rt?.ownRun;
    // MapleStory: after an attack or a hit he keeps the combat stance a few seconds while standing still
    if (this.mode === 'skill' || this.mode === 'recover' || this.mode === 'hurt' || this.mode === 'launched' || this.mode === 'down' || this.mode === 'getup') this.alertUntil = this.simMs + ALERT_MS;
    const mode = this.mode === 'idle' && this.simMs < this.alertUntil ? 'alert' : this.mode;
    const snap: AnimSnap = {
      mode, t: this.mode === 'walk' || this.mode === 'run' || this.mode === 'idle' ? this.loopT : this.modeT,
      speed: Math.hypot(k.vx, k.vy), vz: k.vz, stunMs: 220, air2: this.air2(),
      skill: run ? { id: run.skill.id, stage: run.stage, elapsed: run.elapsed, ...run.timings, seed: castSeed(run.castId) } : undefined,
    };
    const dir = this.dir; // Whirlwind spins inside its own 360° body loop
    const pose = resolvePose(this.cls, dir, poseQuery(snap), v.wantsBase || !hasJob(this.character!), genderOf(this.character), !!this.character!.hero);
    let tint: number | null = null, fill = false, alpha = 1;
    if (this.flash >= 0) { const iron = this.passives.takenMul < 1; tint = iron ? 0xc8d4e6 : 0xff9a9a; } // struck: a soft tint (MapleStory: no white flash over the body); Iron Body: steel sheen
    else if (this.body.hard.active(this.simMs)) tint = this.body.hard.kind === 'freeze' ? 0x9fd8ff : 0xb6ffb0;
    else if (run && run.skill.armor && run.skill.id !== 'blade_storm' && run.elapsed >= run.skill.armor[0] && run.elapsed < run.skill.armor[1] + 220) { // the storm itself lights him: no tint
      // armor glow fades in/out smoothly (a hard on/off read as a flicker at the end of the move)
      const a0 = run.skill.armor[0], a1 = run.skill.armor[1], e = run.elapsed;
      const w = Math.max(0, Math.min(1, (e - a0) / 120, e < a1 ? 1 : 1 - (e - a1) / 220));
      const c = (lo: number, hi: number) => Math.round(255 - (255 - lo) * w * (hi / 255));
      tint = (255 << 16) | (c(0xe0, 255) << 8) | c(0xa0, 255);
    }
    if (this.simMs < this.hitBlinkUntil && this.dead < 0) alpha = Math.floor((this.hitBlinkUntil - this.simMs) / HIT_BLINK) % 2 ? 0.3 : 1; // hit: blinking while untouchable
    if (this.arena && this.dead < 0 && this.body.ghost(this.simMs)) alpha = Math.floor(this.simMs / 70) % 2 ? 0.4 : 0.75; // the arena: guarded (wake-up / BREAK), see-through blinking
    const jx = this.simMs < this.selfShakeUntil ? (Math.random() - 0.5) * 6 : 0; // hit: the body shudders
    if (this.dead >= 0) { alpha = 1 - (1 - P6.deathAlpha) * Math.min(1, this.dead / P6.deathFadeMs); tint = null; fill = false; } // the body just fades; the ghost rises (DeathFx)
    v.swordOff = !!this.jb; // Judgment Blade: no sword from the leap until he lands (the cast's own poses are bare too)
    if (this.cls === 'samurai' && run && this.dead < 0) alpha *= Math.max(0.25, samuraiSeen(run.skill.id, run.elapsed, run.timings)); // vanished (others see nothing; you, a shade)
    if (this.kage?.hidden && this.dead < 0 && !(run && run.skill.id === 'kagemusha')) alpha *= KAGE.shade;
    if (this.simMs < this.body.curseUntil && this.dead < 0) alpha = 0; // Paper Curse: folded into the crane (drawn by the effect) // Kagemusha: hidden among the doubles (you, a shade)
    v.render(ms, pose, k.x + jx, k.y, k.z, k.supportZ, dir, alpha, tint, fill);
    if (this.kage?.hidden && this.dead < 0) v.ring.setAlpha(0.9); // hidden among the doubles: your ring still shows you where you are (your screen only)
    if (this.cls === 'archer') { // archer body motion: lean, recoil, flips, leaps + afterimages
      const face = this.aim.x < -0.01 ? -1 : 1;
      const hero = !!this.character?.hero, lm = this.dead < 0 ? leapMotion(this.simMs - this.leapAt, this.dir === 'left' ? -1 : 1) : null;
      // a START HERO keeps the Wind Leap's somersault: her tucked frame turns round its middle
      const m = (run && this.dead < 0 ? heroMotion(archerMotion(run.skill.id, run.elapsed, run.timings, face), hero) : null) ?? (lm && hero ? { ...lm, pivot: 62 } : lm);
      applyMotion(v.motionSprites, m);
      (this.afterimg ??= new Afterimages(this)).step(this.simMs, v.sprite, !!m?.after);
      this.renderArcherBuffs();
    } else if (this.cls === 'samurai') { // samurai body motion: the step into a cut, the spring, the spin, the dive + crimson afterimages
      const face = this.aim.x < -0.01 ? -1 : 1;
      const m = heroMotion((run && this.dead < 0 ? samuraiMotion(run.skill.id, run.elapsed, run.timings, face, run.stage) : null) ?? (this.dead < 0 ? shinsokuMotion(this.simMs - this.leapAt, this.dir === 'left' ? -1 : 1) : null), !!this.character?.hero);
      applyMotion(v.motionSprites, m);
      (this.afterimg ??= new Afterimages(this, SAMURAI_AFTER)).step(this.simMs, v.sprite, !!m?.after);
      this.kage?.render(ms, { pose, dir, motion: m }, 1, this.simMs); // the doubles: each its own way (his pose and motion while he swings)
    }
    this.fx?.treeFade(k.x, k.y); // a tree in front of the player turns see-through
    this.renderRadiant(pose, dir);
    this.renderEyes(pose, dir);
    this.renderHolyAura();
    this.renderCryShields();
    if (pose.anchor) { const sp = v.sprite, a = pose.anchor, f = dir === 'left' ? -1 : dir === 'right' ? 1 : 0; this.lastHand = { x: sp.x + a[0] + f * 12, y: sp.y + a[1] - 14 }; }
    if (run?.skill.id === 'judgment_blade' && typeof pose.frame === 'number') { // the light-sword forms in the raised palm
      const row = { down: 0, right: 1, left: 2, up: 3 }[dir], col = pose.frame % 8, h = (HANDS as number[][][])[row]?.[col];
      if (h) this.lastHand = { x: v.sprite.x + h[0] * pose.scale, y: v.sprite.y + h[1] * pose.scale };
    }
    this.renderDome();
    // War Cry: a golden battle-spirit aura (no fire): rim light on the body, light streaks rising from a floor sigil, ripples.
    const cry = this.simMs < this.warCryUntil && this.dead < 0;
    if (cry && !this.cryFire) {
      if (!this.textures.exists('flame-dot')) {
        const g = this.make.graphics({}, false);
        for (let i = 12; i > 0; i--) g.fillStyle(0xffffff, 0.09 + (12 - i) * 0.03).fillCircle(16, 16, i * 1.3);
        g.generateTexture('flame-dot', 32, 32); g.destroy();
      }
      const zone = (w: number, h: number) => ({ type: 'random' as const, source: new Phaser.Geom.Ellipse(0, 0, w, h), quantity: 1 });
      const streaks = (front: boolean) => this.add.particles(0, 0, 'flame-dot', {
        speedY: { min: -170, max: -90 }, speedX: { min: -6, max: 6 }, lifespan: { min: 520, max: 820 },
        scaleX: { start: 0.22, end: 0.05 }, scaleY: { start: front ? 1.1 : 1.5, end: 0.3 }, alpha: { start: front ? 0.55 : 0.8, end: 0 },
        tint: [0xffffff, 0xfff1b8, 0xffd36a], blendMode: 'ADD', frequency: front ? 70 : 45, quantity: 1,
        emitZone: zone(front ? 52 : 70, front ? 14 : 22), emitting: false,
      });
      const motes = this.add.particles(0, 0, 'flame-dot', {
        speedY: { min: -60, max: -25 }, speedX: { min: -14, max: 14 }, lifespan: { min: 700, max: 1100 },
        scale: { start: 0.28, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xffffff, 0xffe28a], blendMode: 'ADD',
        frequency: 60, emitZone: zone(60, 110), emitting: false,
      });
      this.cryFire = [streaks(false), streaks(true), motes];
    }
    if (this.cryFire) {
      const [back, front, motes] = this.cryFire, d = actorDepth(k.x, k.y, k.z), on = cry && v.visible;
      back.setPosition(k.x, k.y - k.z - 4).setDepth(d - 0.2); front.setPosition(k.x, k.y - k.z + 2).setDepth(d + 0.06);
      motes.setPosition(k.x, k.y - k.z - 50).setDepth(d + 0.07);
      for (const em of this.cryFire) em.emitting = on;
    }
    if (cry && !this.cryBody) {
      this.cryBody = this.add.sprite(0, 0, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD);
      this.cryAura = this.add.image(0, 0, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36a);
    }
    if (this.cryBody && this.cryAura) {
      this.cryBody.setVisible(cry && v.visible); this.cryAura.setVisible(cry && v.visible);
      if (cry) {
        const left = this.warCryUntil - this.simMs, fade = Math.min(1, left / 400), d = actorDepth(k.x, k.y, k.z);
        const sp = v.sprite;
        if (this.cryBody.texture.key !== sp.texture.key || this.cryBody.frame.name !== sp.frame.name) this.cryBody.setTexture(sp.texture.key, sp.frame.name);
        this.cryBody.setOrigin(sp.originX, sp.originY).setScale(sp.scaleX * 1.03, sp.scaleY * 1.03).setPosition(sp.x, sp.y).setDepth(d + 0.04)
          .setTint(0xffe9a8).setAlpha((0.2 + 0.08 * Math.sin(this.simMs / 260)) * fade);
        this.cryAura.setPosition(k.x, k.y - k.z - 48).setDepth(d - 0.25).setDisplaySize(150, 200).setAlpha((0.3 + 0.08 * Math.sin(this.simMs / 300)) * fade);
      }
    }
  }

  /** War Cry: three spectral shields of light orbit the warrior for the whole buff. */
  private renderCryShields(): void {
    const on = this.simMs < this.warCryUntil && this.dead < 0 && this.view!.visible && this.textures.exists('cry-shield');
    if (!on) { for (const s of this.cryShields) s.setVisible(false); return; }
    if (!this.cryShields.length) for (let i = 0; i < 3; i++) this.cryShields.push(this.add.image(0, 0, 'cry-shield', 0).setBlendMode(Phaser.BlendModes.ADD));
    const k = this.kin, d = actorDepth(k.x, k.y, k.z), left = this.warCryUntil - this.simMs, fade = Math.min(1, left / 500);
    const rise = Math.min(1, (this.simMs - (this.warCryUntil - 8000 - 320)) / 400); // spread out from the body on cast
    this.cryShields.forEach((img, i) => {
      const th = this.simMs / 650 + (i * Math.PI * 2) / 3, sn = Math.sin(th), R = 78 * rise;
      const f = ((Math.round(((th + Math.PI / 2) / (Math.PI * 2)) * 8) % 8) + 8) % 8; // the shield turns as it travels round
      img.setVisible(true).setFrame(f).setPosition(k.x + Math.cos(th) * R, k.y - k.z - 52 + sn * R * 0.38)
        .setDisplaySize(64, 64).setDepth(d + (sn > 0 ? 0.08 : -0.3)).setAlpha(fade * (sn > 0 ? 0.95 : 0.55));
    });
  }

  /** Radiant Blade: painted holy aura (flames of light + floor circle) around the player for the whole buff. */
  private renderHolyAura(): void {
    const on = this.simMs >= this.radiantFrom && this.simMs < this.radiantUntil && this.dead < 0 && this.view!.visible && this.textures.exists('holy-aura');
    if (!on) { this.holyAura?.setVisible(false); return; }
    if (!this.holyAura) this.holyAura = this.add.image(0, 0, 'holy-aura', 0).setOrigin(0.5, 515 / 667).setBlendMode(Phaser.BlendModes.ADD);
    const k = this.kin, left = this.radiantUntil - this.simMs, age = this.simMs - this.radiantFrom;
    const a = Math.min(1, age / 400, left / 600);
    this.holyAura.setVisible(true).setFrame(Math.floor(this.simMs / 90) % 8).setPosition(k.x, k.y - k.z + 4)
      .setDisplaySize(125, 333).setDepth(actorDepth(k.x, k.y, k.z) - 0.2).setAlpha(0.85 * a);
  }

  /** Glowing eyes while Radiant Blade or War Cry is active. */
  private renderEyes(pose: PoseFrame, dir: Dir): void {
    const on = (this.simMs < this.radiantUntil || this.simMs < this.warCryUntil) && this.dead < 0 && this.view!.visible && !!pose.anchor && dir !== 'up';
    if (!on) { this.eyes?.setVisible(false); return; }
    if (!this.eyes) this.eyes = this.add.image(0, 0, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0a0);
    const sp = this.view!.sprite, a = pose.anchor!, ex = sp.x + a[2] + (dir === 'right' ? 4 : dir === 'left' ? -4 : 0), ey = sp.y + a[3] + 3;
    this.eyes.setVisible(true).setPosition(ex, ey).setDisplaySize(dir === 'down' ? 22 : 14, 7).setDepth(sp.depth + 0.05).setAlpha(0.8 + 0.2 * Math.sin(this.simMs / 160));
  }

  /** Radiant Blade: a long blade of pure light extends from the real hilt along the sword of the current frame. */
  private renderRadiant(pose: PoseFrame, dir: Dir): void {
    const on = this.simMs >= this.radiantFrom && this.simMs < this.radiantUntil && this.dead < 0 && this.view!.visible && !!pose.blade && this.rt?.ownRun?.skill.id !== 'judgment_blade' && !this.jb; // V: no sword at all (until he lands)
    if (on && !this.beam) {
      this.beam = this.add.image(0, 0, 'radiant-blade', 0).setOrigin(17.6 / 256, 0.5).setBlendMode(Phaser.BlendModes.ADD);
      this.beamGlow = this.add.image(0, 0, 'radiant-blade', 0).setOrigin(17.6 / 256, 0.5).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a);
    }
    if (!this.beam || !this.beamGlow) return;
    this.beam.setVisible(on); this.beamGlow.setVisible(false); // no extra glow layer: the blade art only
    if (!on) { this.sweep.last = NaN; this.sweep.sign = 0; return; }
    const skinC = skinColor(this.equipped.weapon), bkey = skinC !== null ? grayKey(this, 'radiant-blade', 1.7) ?? 'radiant-blade' : 'radiant-blade'; // light blade takes the sword skin's colour
    if (this.beam.texture.key !== bkey) this.beam.setTexture(bkey, 0);
    if (skinC !== null) this.beam.setTint(skinC); else this.beam.clearTint();
    const b = pose.blade!, sp = this.view!.sprite, k = this.kin;

    if (!this.boltDone && b[3] < b[1] - 10) { // strike once the blade points up: the bolt lands on its tip
      this.boltDone = true; this.fx!.lightningAt(sp.x + b[2], sp.y + b[3]); // onto the real sword tip; the light blade then grows from it
    }
    const hx = sp.x + b[0], hy = sp.y + b[1], dx = b[2] - b[0], dy = b[3] - b[1], len = Math.hypot(dx, dy) * 2.7 * Math.max(0.05, Math.min(1, (this.simMs - this.radiantFrom) / 1000)), ang = Math.atan2(dy, dx) * (180 / Math.PI);
    const left = this.radiantUntil - this.simMs, fade = Math.min(1, left / 500), f = Math.floor(this.simMs / 90) % 4;
    const sx = len / 238, sy = sx * 1.1; // broad translucent blade of light (pre-downscaled smooth art, additive)
    const d = actorDepth(k.x, k.y, k.z) + (dir === 'up' ? -0.05 : 0.05);
    this.beam.setFrame(f).setPosition(hx, hy).setAngle(ang).setScale(sx, sy).setDepth(d + 0.01).setAlpha(fade);
    // the swing: when the light blade turns far enough one way, its trail of light follows it
    const W = this.sweep; let dA = Number.isNaN(W.last) ? 0 : ang - W.last; if (dA > 180) dA -= 360; if (dA < -180) dA += 360;
    if (Math.abs(dA) > 2.5) {
      const sg = Math.sign(dA);
      if (sg !== W.sign) { W.sign = sg; W.start = W.last; W.done = false; }
      let span = ang - W.start; if (span > 180) span -= 360; if (span < -180) span += 360;
      if (!W.done && Math.abs(span) >= 35) { W.done = true; this.slashTrail(hx, hy, ang - span, ang, len * 0.92, d + 0.008); }
    } else if (W.sign !== 0 && Math.abs(dA) < 0.5) { W.sign = 0; W.done = false; }
    W.last = ang;

    this.beamGlow.setFrame(f).setPosition(hx, hy).setAngle(ang).setScale(sx * 1.02, sy * 1.25).setDepth(d + 0.02).setAlpha(0.12 * fade * (0.85 + 0.15 * Math.sin(this.simMs / 90)));
  }

  /** Radiant Blade: the drawn arc of light (6 frames, additive) laid on the light blade's own sweep — pivot at the hilt,
   *  radius = the blade, its bright head where the blade is now, its tail where the swing began, turned the way it swung. */
  private slashTrail(hx: number, hy: number, from: number, to: number, len: number, depth: number): void {
    if (!this.textures.exists('radiant-slash')) return;
    if (!this.anims.exists('radiant-slash')) this.anims.create({ key: 'radiant-slash', frames: this.anims.generateFrameNumbers('radiant-slash', { start: 0, end: 5 }), frameRate: 28, repeat: 0 });
    const cw = to > from;                                   // clockwise on screen (y down): as drawn; else mirrored
    const sp = this.add.sprite(hx, hy, 'radiant-slash', 0).setBlendMode(Phaser.BlendModes.ADD)
      .setOrigin(SLASH.cx, cw ? SLASH.cy : 1 - SLASH.cy).setFlipY(!cw).setScale(len / SLASH.r)
      .setAngle(to - (cw ? SLASH.head : -SLASH.head)).setDepth(depth);
    sp.play('radiant-slash'); sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sp.destroy());
  }

  private inDome(): boolean {
    const d = this.dome; if (!d || this.simMs >= d.until) return false;
    // behind the wall across its whole depth: up to 280px back, ±180 along the floor depth (the wall's full span)
    // follows the wall's curve: the shell bows out ~150px at its middle, so the protected side ends exactly at the glass
    const k = this.kin, dy = (k.y - d.y) / 185, bulge = 150 * Math.max(0, 1 - dy * dy);
    const past = d.side * (k.x - d.wx) - bulge; // > 0 once the feet cross the wall surface
    return past < -6 && d.side * (d.wx - k.x) < 280 && Math.abs(k.y - d.y) < 180;
  }

  private domeBlock(from: { x: number; y: number }): void {
    const k = this.kin;
    this.fx!.callout({ x: k.x, y: k.y, z: k.z + 40 }, 'IMMUNE', '#ffe7a0', 0);
    const d = this.dome!, ang = Math.atan2(from.y - d.y, from.x - d.x);
    const sx = d.x + Math.cos(ang) * d.rx, sy = d.y + Math.sin(ang) * d.ry - 40;
    const f = this.add.image(sx, sy, 'dmg-glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0b0).setDepth(sy + 400).setDisplaySize(70, 90);
    this.tweens.add({ targets: f, alpha: 0, scale: f.scale * 1.6, duration: 260, onComplete: () => f.destroy() });
  }

  /** A tall curved wall of light rises in front of the caster (toward the facing side) and stays put for 15s.
   *  Everyone standing behind it — on the caster's side, across its whole depth — takes no damage. */
  private raiseDome(): void {
    if (this.dead >= 0) return;
    this.dome?.img.destroy(); this.dome?.glow.destroy();
    const k = this.kin, side = this.aim.x < -0.01 ? -1 : 1, S = 1.15;
    const wx = k.x + side * 80; // the wall stands clearly in front of the caster (he is never swallowed by it)
    // One steady frame (no flickering loop), anchored at the near end of its base and stretched UPWARD: a towering wall.
    const img = this.add.image(wx, k.y + 186, 'sanctuary-wall', 11).setOrigin(70 / 256, 414 / 512).setBlendMode(Phaser.BlendModes.ADD).setFlipX(side < 0);
    img.setScale(S, 0.05);
    const glow = this.add.image(wx, k.y + 186, 'sanctuary-wall', 11).setOrigin(70 / 256, 414 / 512).setBlendMode(Phaser.BlendModes.ADD).setFlipX(side < 0).setTint(0xffd27a);
    glow.setScale(S * 1.06, 0.05);
    // protected zone: an ellipse behind the wall covering its full depth
    this.dome = { x: wx - side * 200, y: k.y, rx: 240, ry: 175, until: this.simMs + 15000, t0: this.simMs, img, glow, wx, side };
    this.cameras.main.shake(180, 0.006);
  }

  private renderDome(): void {
    if (this.domeAt >= 0 && this.simMs >= this.domeAt) { this.domeAt = -1; if (this.rt?.ownRun?.skill.id === 'sanctuary') this.raiseDome(); }
    const d = this.dome; if (!d) return;
    const left = d.until - this.simMs, age = this.simMs - d.t0;
    if (left <= 0) { d.img.destroy(); d.glow.destroy(); this.dome = null; return; }
    // The wall wraps around the player: whoever stands on the protected side is always drawn cleanly ON TOP of it
    // (never washed out underneath); anyone on the far side is seen through the glass.
    // The wall is drawn OVER whoever stands behind it, as see-through glass: the player is hidden behind the light
    // but stays readable (lighter glass where it overlaps him instead of a washed-out white sheet).
    const k = this.kin, over = Math.abs(k.x - d.wx) < 200 && Math.abs(k.y - d.y) < 200, prot = this.inDome();
    d.vis = (d.vis ?? 1) + ((prot || !over ? 1 : 0.22) - (d.vis ?? 1)) * 0.15; // crossed to the open side: the wall fades (no protection)
    const fade = Math.min(1, left / 600) * (over && prot ? 0.62 : 0.9) * d.vis, dep = actorDepth(d.x, d.y + 200, 0) + 1; // in front of everything along its whole span (its near end reaches y+186)
    d.glow.setAlpha(fade * (0.18 + 0.1 * Math.sin(age / 700))).setDepth(dep - 0.01); // soft breathing glow, no frame flicker
    const g = 1 - Math.pow(1 - Math.min(1, age / 380), 3), sy = 1.15 * 1.4 * Math.max(0.05, g); // rises from the floor (sim clock)
    d.img.setScale(1.15, sy).setAlpha(fade).setDepth(dep);
    d.glow.setScale(1.15 * 1.06, sy * 1.04);
  }

  // ======================================================================= actions

  /** Space / 1–7 and HUD clicks share this handler: start now, cancel on a confirmed hit, or buffer. */
  useSlot(i: number): void {
    if (!this.view || !this.pvpReady || this.dead >= 0) return;
    if (this.skillBook?.open || this.cosPanel?.open || this.inputLocked()) return;
    const own = this.rt?.ownRun;
    if (own && own.skill.id === 'judgment_blade' && this.kit[i]?.id === 'judgment_blade') { // V again during the sequence: one more blade, at once
      this.jbWant = Math.min(3, this.jbWant + 1);
      return;
    }
    if (!this.tryStartSlot(i)) this.ci?.bufferAction(i);
  }

  private onJumpKey(): void { if (this.pvpReady && this.dead < 0 && !this.inputLocked()) this.ci?.queueJump(); }

  /** Own damage buffs right now: War Cry +20%, Radiant Blade +15% (same as against monsters). */
  private ownDamageMul(s?: FinalSkill): number { return this.weaveMul() * this.skillMul(s) * (this.simMs < this.warCryUntil ? 1.2 : this.simMs < this.allyCryUntil ? 1.1 : 1) * (this.simMs < this.radiantUntil ? 1.15 : 1) * (this.simMs < this.bannerUntil ? 1.1 : 1) * (this.simMs < this.sunUntil ? 1.1 : 1) * (this.simMs < this.godUntil ? 1.15 : 1) * (this.simMs < this.itemDmgUntil ? 1.1 : 1) * this.passiveDmgMul(); }

  private hasteFx?: Phaser.GameObjects.Particles.ParticleEmitter;
  private spiritFx?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Archer buffs stay visible while they last: Bow Haste = green wind streaks rising, Hunter's Spirit = gold motes. */
  private renderArcherBuffs(): void {
    if (!this.textures.exists('arch-glow')) return;
    const k = this.kin, d = actorDepth(k.x, k.y, k.z), vis = !!this.view?.visible && this.dead < 0;
    this.hasteFx ??= this.add.particles(0, 0, 'arch-glow', {
      emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 70, 20), quantity: 1 } as never,
      speedY: { min: -150, max: -80 }, speedX: { min: -10, max: 10 }, lifespan: { min: 380, max: 620 },
      scaleX: { start: 0.07, end: 0.02 }, scaleY: { start: 0.45, end: 0.1 }, alpha: { start: 0.85, end: 0 }, tint: [0x4cc23a, 0x7ee35a, 0xb8f59a], blendMode: 'NORMAL', frequency: 55, emitting: false, // green wisps (normal blend: green, never washed to white)
    });
    this.spiritFx ??= this.add.particles(0, 0, 'arch-glow', {
      emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 60, 90), quantity: 1 } as never,
      speedY: { min: -40, max: -15 }, lifespan: { min: 600, max: 1000 }, scale: { start: 0.12, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xffe27a, 0xffffff], blendMode: 'ADD', frequency: 110, emitting: false,
    });
    this.hasteFx.setPosition(k.x, k.y - k.z - 6).setDepth(d + 0.05); this.hasteFx.emitting = false; // (Bow Haste reads from its ring on the floor only)
    this.spiritFx.setPosition(k.x, k.y - k.z - 60).setDepth(d + 0.06); this.spiritFx.emitting = vis && this.simMs < this.spiritUntil;
  }

  // ======================================================================= Book Mage (the mage spec)

  private mage = { el: null as 'frost' | 'storm' | 'arcane' | null, weave: 0, weaveLast: '', weaveCast: '', weaveAt: -Infinity, grand: false,
    hasteUntil: -1, ascUntil: -1, wardHp: 0, wardUntil: -1, barrierAt: -Infinity, recoverAt: -Infinity, floatUntil: -1, gateAt: -Infinity };
  /** Chrono Sigil: where it lies, the HP when it was laid, until when it can be snapped back to. */
  private sigil: { x: number; y: number; z: number; hp: number; until: number } | null = null;
  /** Arcane Gates of every caster (the gate by him, the gate where he aimed). */
  private gates = new Map<string, { a: V2; b: V2; until: number }>();
  /** Levity Fields standing now (bolts of their caster fly twice as fast through them). */
  private levityZones: { owner: string; x: number; y: number; r: number; until: number }[] = [];
  /** Rune beams already broken (`castA|castB`). */
  private brokenLinks = new Set<string>();
  private linkGfx?: Phaser.GameObjects.Graphics;

  private mageReset(): void {
    const M = this.mage;
    M.el = null; M.weave = 0; M.weaveLast = ''; M.weaveCast = ''; M.grand = false; M.hasteUntil = -1; M.ascUntil = -1; M.wardHp = 0; M.wardUntil = -1; M.floatUntil = -1;
    this.sigil = null; this.gates.delete(this.localId);
  }

  /** Arcane Bolt as Attunement turns it: the element of the last spell. */
  private mageVariant(s: FinalSkill | undefined): FinalSkill | undefined {
    if (!s || s.id !== 'arcane_bolt' || !this.passives.mage.attune || !this.mage.el) return s;
    return finalSkill(`arcane_bolt_${this.mage.el}`) ?? s;
  }
  /** The caster's state carried by his casts: 1 Elemental Ascension, 2 Conductor, 4 Shatter Mastery. */
  private mageFlags(): number { const M = this.passives.mage; return (this.simMs < this.mage.ascUntil ? 1 : 0) | (M.conductor ? 2 : 0) | (M.shatter ? 4 : 0); }
  /** A mage hit as its caster's state makes it: every damaging hit both elements under Elemental Ascension; his passives. */
  private mageHit(run: CastRun, hit: HitEvent): HitEvent {
    if (run.skill.cls !== 'book_mage') return hit;
    const f = run.own ? this.mageFlags() : (run.mf ?? 0);
    if (!f) return hit;
    return { ...hit, ...(f & 1 && hit.damage > 0 ? { el: 'both' as const } : {}), ...(f & 2 ? { conductor: true } : {}), ...(f & 4 ? { shatterMul: 2 } : {}) };
  }
  private weaveMul(): number { return this.cls === 'book_mage' && this.passives.mage.weave ? 1 + WEAVE.per * this.mage.weave : 1; }
  /** Time Collapse reads the woven runes: +10% each. */
  private skillMul(s?: FinalSkill): number { return s?.id === 'time_collapse' && this.passives.mage.weave ? 1 + 0.1 * this.mage.weave : 1; }
  private static readonly MAGE_EL: Record<string, 'frost' | 'storm' | 'arcane'> = { frost_nova: 'frost', glacial_spikes: 'frost', lightning_chain: 'storm', storm_field: 'storm' };

  /** Spell Weave: a spell that hits and is not the one before weaves a rune; the same one twice unravels them. */
  private weaveHit(run: CastRun): void {
    const M = this.mage, s = run.skill;
    M.weaveAt = this.simMs;
    if (!this.passives.mage.weave || s.slot === 0 || s.slot === 99 || M.weaveCast === run.castId) return;
    M.weaveCast = run.castId;
    const was = M.weave;
    M.weave = s.id === M.weaveLast ? 0 : Math.min(WEAVE.max, M.weave + 1);
    M.weaveLast = s.id;
    if (M.weave === WEAVE.max && was < WEAVE.max && this.passives.mage.grand) M.grand = true; // Grand Weave: the next spell is instant
    this.fx?.weave(this.localId, M.weave, M.weave === 0 && was > 0);
  }

  /** Own mage casts: buffs, the sigil, Blink's escape (timers on the sim clock, from the run's real startup). */
  private mageCast(s: FinalSkill, run: CastRun): void {
    const now = this.simMs, k = this.kin, M = this.mage;
    if (s.slot !== 0 && s.slot !== 8) M.el = LegacyCourtyardScene.MAGE_EL[s.id] ?? 'arcane'; // Attunement: the element of the last spell
    if (M.grand && s.slot !== 0 && s.slot !== 8 && s.slot !== 7) { M.grand = false; run.timings.startup = Math.min(run.timings.startup, 30); this.fx?.grandWeave(this.localId); }
    const up = run.timings.startup, say = (text: string, color: string) => this.time.delayedCall(up, () => this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, text, color, 0));
    switch (s.id) {
      case 'arcane_bolt': case 'arcane_bolt_frost': case 'arcane_bolt_storm': case 'arcane_bolt_arcane':
        if (run.stage === 2) this.time.delayedCall(up, () => { this.momentum = { x: -run.aim.x * 46, y: -run.aim.y * 20, left: 180 }; }); // the lance's recoil: a slide back
        break;
      case 'blink': this.body.invulnUntil = Math.max(this.body.invulnUntil, now + up + s.active); if (this.passives.mage.blinkRune) this.frostRune(k.x, k.y); break;
      case 'chrono_haste': M.hasteUntil = now + up + 120000; this.shares.push({ at: now + up, id: s.id, ms: 120000 }); say('CHRONO HASTE', '#c9b6ff'); break;
      case 'arcane_ward': M.wardHp = Math.round(this.maxHpNow() * 0.2); M.wardUntil = now + up + 8000; this.shares.push({ at: now + up, id: s.id, ms: 8000 }); say('ARCANE WARD', '#9fdcff'); break;
      case 'elemental_ascension': M.ascUntil = now + up + 20000; say('ELEMENTAL ASCENSION', '#cff6ff'); break;
      case 'chrono_sigil': this.sigil = { x: k.x, y: k.y, z: k.z, hp: this.playerHP, until: now + up + 5000 }; break;
    }
  }

  /** Chrono Sigil pressed again: back to the sigil in time, with half the HP lost since. */
  private sigilRecall(): void {
    const sg = this.sigil!, k = this.kin, from = { x: k.x, y: k.y, z: k.z };
    const own = this.rt?.ownRun; if (own) { this.rt!.cancelForFollowUp(own); this.endRun(own, true); }
    this.sigil = null;
    k.x = sg.x; k.y = sg.y; k.z = sg.z; k.vx = 0; k.vy = 0; k.vz = 0; k.grounded = sg.z <= k.supportZ + 1;
    this.body.push = null; this.body.invulnUntil = Math.max(this.body.invulnUntil, this.simMs + 300);
    const back = Math.max(0, Math.round((sg.hp - this.playerHP) / 2));
    if (back > 0) { this.playerHP = Math.min(this.maxHpNow(), this.playerHP + back); this.fx?.healNumber({ x: k.x, y: k.y, z: k.z }, back); }
    this.fx?.rewind(this.localId, from, { x: sg.x, y: sg.y, z: sg.z });
    this.pvp?.forceState();
  }

  /** ms since the second jump while it shapes the body (in the air; Levitate: while floating), else undefined. */
  private air2(): number | undefined {
    if (this.kin.grounded || !this.leapUsed || this.dead >= 0) return undefined;
    if (this.cls === 'book_mage' && this.simMs >= this.mage.floatUntil) return undefined;
    return this.simMs - this.leapAt;
  }

  /** Levitate: the second jump is a slow float you can cast from. */
  private levitate(now: number): void {
    const k = this.kin, inp = this.ci!;
    const d = inp.hasMove ? unit(inp.moveX, inp.moveY) : FACE[this.dir];
    this.leapUsed = true; this.mage.floatUntil = now + LEVITATE.ms; this.leapAt = now;
    k.vz = Math.max(k.vz, 60); k.vx = d.x * LEVITATE.forward; k.vy = d.y * LEVITATE.forward * 0.6;
    this.fx?.levitate(this.localId, () => (this.simMs < this.mage.floatUntil && !this.kin.grounded ? { x: this.kin.x, y: this.kin.y, z: this.kin.z } : null));
  }

  /** A gate / Levity Field opened (any caster): kept here for the passing bolts and walkers. */
  private mageZone(run: CastRun): void {
    const now = this.simMs;
    if (run.skill.id === 'arcane_gate' && run.place) {
      let a = { x: run.origin.x - Math.sign(run.aim.x || 1) * 64, y: run.origin.y }; // the near gate stands just behind him (not in his way)
      if (!footAllowed(a.x, a.y, 0, 10)) a = { x: run.origin.x, y: run.origin.y };
      this.gates.set(run.attackerId, { a, b: { ...run.place }, until: now + 12000 });
      this.fx?.gates(run.attackerId, a, run.place, 12000);
    }
    if (run.skill.id === 'levity_field' && run.place) this.levityZones.push({ owner: run.attackerId, x: run.place.x, y: run.place.y, r: 150, until: now + 2500 });
  }

  /** Every projectile after its step: gates carry the caster's bolts across, Levity Fields hurry them on. */
  private mageProjectile(p: Projectile, run: CastRun): void {
    if (run.skill.cls !== 'book_mage') return;
    const now = this.simMs, g = this.gates.get(p.attackerId);
    if (g && now < g.until && now - (p.portedAt ?? -Infinity) > 400) {
      for (const [from, to] of [[g.a, g.b], [g.b, g.a]] as const) if (Math.hypot(p.x - from.x, p.y - from.y) < 34) {
        this.fx?.gatePass(from, to, p.z);
        p.x = to.x + p.dx * 36; p.y = to.y + p.dy * 36; p.portedAt = now; p.range += 220; // flies on out of the other gate
        break;
      }
    }
    const q = p as Projectile & { boosted?: boolean };
    if (!q.boosted) for (const z of this.levityZones) if (z.owner === p.attackerId && now < z.until && Math.hypot(p.x - z.x, p.y - z.y) < z.r) { q.boosted = true; p.speed *= 2; p.range += 160; }
  }

  /** A pretend cast of one of the mage's hidden effects (its hits go through the usual authority paths). */
  private pseudoRun(skill: FinalSkill, x: number, y: number, z = 0): CastRun {
    return { castId: `${this.localId}:${skill.id}${++this.castSeq}`, skill, stage: 0, attackerId: this.localId, own: true, origin: { x, y, z }, aim: { x: 1, y: 0 }, place: { x, y },
      elapsed: 0, phase: 'done', fired: new Set(), hitKeys: new Set(), confirmedAt: -1, pathStart: { x, y }, counterTriggered: false, extraRecovery: 0,
      timings: { startup: 0, active: 0, recovery: 0 }, hits: skill.hits, zone: true } as CastRun;
  }
  /** Own hidden effect on the monsters / the sparring knight around a point. */
  private mageBurst(skill: FinalSkill, x: number, y: number, r: number, skip?: string): void {
    const run = this.pseudoRun(skill, x, y), hit = skill.hits[0];
    for (const t of this.targetsFor(run)) if (t.alive && !t.invulnerable && t.id !== skip && (t.kind === 'enemy' || t.id === BOT_ID) && Math.hypot(t.x - x, t.y - y) <= r + t.radius)
      this.onSkillHit(run, hit, 0, t, { x: t.x, y: t.y, z: t.z + 40 });
  }
  /** Blink Mastery: a rune of frost where he vanished (5s; whoever walks over it is chilled). */
  private frostRune(x: number, y: number): void {
    const s = MAGE_HIDDEN.frostRune, run = this.pseudoRun(s, x, y);
    const t: Trap = { run, hit: s.hits[0], x, y, until: this.simMs + 5000, radius: 40 };
    this.rt?.traps.push(t); this.rt?.events.emit(RT_EVENTS.trap, t);
  }

  /** The PvE body near a point (Cold Blood: who struck you up close). */
  private pveBodyNear(at: { x: number; y: number }): CombatBody | undefined {
    let best: CombatBody | undefined, bd = 90;
    const see = (b: CombatBody | undefined, x: number, y: number) => { const d = Math.hypot(x - at.x, y - at.y); if (b && d < bd) { bd = d; best = b; } };
    for (const m of this.world?.mobs ?? []) if (m.alive) see(m.body, m.kin.x, m.kin.y);
    if (this.enemy?.alive) see(this.enemy.body, this.enemy.kin.x, this.enemy.kin.y);
    if (this.bot) see(this.bot.body, this.bot.x, this.bot.y);
    return best;
  }
  /** Cold Blood (chills who strikes you up close) and Mana Barrier (a heavy blow stopped, every 20s). True: blocked. */
  private mageGuard(hit: HitEvent, from: { x: number; y: number }, attacker?: CombatBody): boolean {
    const M = this.passives.mage, now = this.simMs, k = this.kin;
    if (this.cls !== 'book_mage' || this.dead >= 0) return false;
    if (M.coldBlood && attacker && hit.shape.kind !== 'projectile' && Math.hypot(from.x - k.x, from.y - k.y) < 140) {
      attacker.chillUntil = now + MAGE.chillMs; attacker.slowPct = Math.max(attacker.slowPct, MAGE.chillSlow); attacker.slowUntil = Math.max(attacker.slowUntil, now + MAGE.chillMs);
      this.fx?.mageReaction('chill', { x: attacker.kin.x, y: attacker.kin.y, z: attacker.kin.z + 40 });
    }
    if (M.barrier && now >= this.mage.barrierAt && (hit.heavy || hit.damage >= this.maxHpNow() * 0.08)) {
      this.mage.barrierAt = now + 20000;
      this.fx?.barrier({ x: k.x, y: k.y, z: k.z }, from);
      return true;
    }
    return false;
  }
  /** Arcane Ward takes the damage first; broken, it bursts in frost. Returns what is left for the HP. */
  private wardAbsorb(dmg: number): number {
    const M = this.mage;
    if (M.wardHp <= 0) return dmg;
    if (this.simMs >= M.wardUntil) { M.wardHp = 0; return dmg; }
    const a = Math.min(M.wardHp, dmg); M.wardHp -= a;
    const k = this.kin;
    this.fx?.wardHit(this.localId, M.wardHp <= 0);
    if (M.wardHp <= 0) { M.wardUntil = -1; this.mageBurst(MAGE_HIDDEN.wardBurst, k.x, k.y, 150); }
    return dmg - a;
  }

  /** A magic reaction caused by your hit: Arcane Recovery, Shatter Mastery's shards, Time Lord, the conducted arcs. */
  private mageReact(run: CastRun, out: HitOutcome, targetId: string, at: V3): void {
    if (!out.rx) return;
    this.fx?.mageReaction(out.rx, at, targetId, out.rxMs);
    if (!run.own || run.attackerId !== this.localId) return;
    const M = this.passives.mage, now = this.simMs;
    if (M.recovery && out.rx !== 'chill' && now - this.mage.recoverAt > 250) {
      this.mage.recoverAt = now;
      const before = this.playerHP; this.playerHP = Math.min(this.maxHpNow(), this.playerHP + Math.max(1, Math.round(this.maxHpNow() * 0.03)));
      if (this.playerHP > before) this.fx?.healNumber({ x: this.kin.x, y: this.kin.y, z: this.kin.z }, this.playerHP - before);
    }
    if (out.rx === 'shatter') {
      if (M.timeLord) { const e = this.rt?.cooldownEnd.get('time_collapse'); if (e && e > now) this.rt!.cooldownEnd.set('time_collapse', Math.max(now, e - 1000)); }
      if (M.shatter && run.skill.id !== 'shatter_shards') this.mageBurst(MAGE_HIDDEN.shards, at.x, at.y, 160, targetId);
    }
    if (out.rx === 'conduct' && run.skill.id !== 'conduct_arc') { // the lightning leaps through every chilled foe near
      const arc = MAGE_HIDDEN.conductArc, pr = this.pseudoRun(arc, at.x, at.y);
      let n = 0;
      for (const t of this.targetsFor(pr)) {
        if (n >= 4 || !t.alive || t.invulnerable || t.id === targetId || !(t.kind === 'enemy' || t.id === BOT_ID)) continue;
        const b = t.id === BOT_ID ? this.bot?.body : t.id === 'enemy' ? this.enemy?.body : this.mobById(t.id)?.body;
        if (!b || !(b.chilled(now) || (M.conductor && b.frozen(now))) || Math.hypot(t.x - at.x, t.y - at.y) > 240) continue;
        n++; this.fx?.conductArc(at, { x: t.x, y: t.y, z: t.z + 40 });
        this.onSkillHit(pr, arc.hits[0], 0, t, { x: t.x, y: t.y, z: t.z + 40 });
      }
    }
  }

  /** Every frame: the weave fades, buffs run out, the gates carry you across, the rune beams watch the floor. */
  private stepMage(_ms: number, now: number): void {
    const M = this.mage;
    if (M.weave > 0 && now - M.weaveAt > WEAVE.fadeMs) { M.weave = 0; this.fx?.weave(this.localId, 0, true); }
    if (M.wardHp > 0 && now >= M.wardUntil) { M.wardHp = 0; this.fx?.wardHit(this.localId, false, true); }
    if (this.sigil && now >= this.sigil.until) this.sigil = null;
    for (const [id, g] of this.gates) if (now >= g.until) this.gates.delete(id);
    this.levityZones = this.levityZones.filter((z) => now < z.until);
    const g = this.gates.get(this.localId), k = this.kin;
    if (g && this.dead < 0 && now - M.gateAt > 700 && k.z - k.supportZ < 30) {
      for (const [from, to] of [[g.a, g.b], [g.b, g.a]] as const) if (Math.hypot(k.x - from.x, k.y - from.y) < 26) {
        const sp = Math.hypot(k.vx, k.vy), d = sp > 10 ? { x: k.vx / sp, y: k.vy / sp } : FACE[this.dir];
        const nx = to.x + d.x * 40, ny = to.y + d.y * 22;
        if (!footAllowed(nx, ny, k.z, R)) continue;
        this.fx?.gatePass(from, to, k.z + 40);
        k.x = nx; k.y = ny; M.gateAt = now; this.pvp?.forceState();
        break;
      }
    }
    this.stepRuneLinks(now);
    for (const m of this.world?.mobs ?? []) { // Paper Curse: the folded monster is the crane (its own sprite hidden)
      const paper = m.alive && now < m.body.curseUntil;
      if (paper) { m.sprite.setAlpha(0); this.paperMobs.add(m); } else if (this.paperMobs.delete(m) && m.alive) m.sprite.setAlpha(1);
    }
    if (this.bot && now < this.bot.body.curseUntil) this.bot.view.paper(this.bot.body.curseUntil - now);
  }
  private paperMobs = new Set<Monster>();

  /** Binding Rune: two runes of one caster close together are joined by a beam; who crosses it is bound and shocked
   *  (each client judges its own: you judge the monsters and the knight for your runes, and yourself for the others'). */
  private stepRuneLinks(now: number): void {
    const by = new Map<string, Trap[]>();
    for (const t of this.rt?.traps ?? []) if (t.run.skill.id === 'binding_rune') { const l = by.get(t.run.attackerId) ?? []; l.push(t); by.set(t.run.attackerId, l); }
    const gfx = this.linkGfx ??= this.add.graphics().setDepth(1);
    gfx.clear();
    const beams: [Trap, Trap][] = [];
    for (const [, ts] of by) for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
      const A = ts[i], B = ts[j];
      if (Math.hypot(A.x - B.x, A.y - B.y) > 320 || this.brokenLinks.has(`${A.run.castId}|${B.run.castId}`)) continue;
      beams.push([A, B]);
    }
    for (const [A, B] of beams) {
      const own = A.run.attackerId === this.localId, key = `${A.run.castId}|${B.run.castId}`;
      this.fx?.runeBeam(A, B, gfx, now);
      const victims: HitTarget[] = own ? this.targetsFor(A.run).filter((t) => t.kind === 'enemy' || t.id === BOT_ID)
        : this.party?.has(A.run.attackerId) || this.dead >= 0 ? [] : [{ id: this.localId, kind: 'player', x: this.kin.x, y: this.kin.y, z: this.kin.z, radius: R + 4, height: 74, alive: true, invulnerable: this.simMs < this.body.invulnUntil }];
      for (const t of victims) {
        if (!t.alive || t.invulnerable || t.z > 30) continue;
        const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((t.x - A.x) * dx + (t.y - A.y) * dy) / L2));
        if (u <= 0.02 || u >= 0.98 || Math.hypot(t.x - (A.x + dx * u), t.y - (A.y + dy * u)) > t.radius + 6) continue;
        this.brokenLinks.add(key);
        const at = { x: t.x, y: t.y, z: t.z + 30 }, hit = MAGE_HIDDEN.runeLink.hits[0];
        this.fx?.runeBeamBreak(A, B, at);
        if (own) this.onSkillHit(A.run, hit, 9, t, at); else this.applyRemoteHitToSelf(A.run, hit, 9, at);
        break;
      }
    }
  }

  // ======================================================================= Kagemusha (samurai): the shadow doubles

  /** His doubles (made on first use): a view dressed like him, their effects. */
  private kage?: KageLocal;
  /** Ambush casts of other samurai (the first of their hits on you: a sure critical and a stun). */
  private ambushIn = new Set<string>();
  private kageOf(): KageLocal {
    return this.kage ??= new KageLocal(this, {
      makeView: () => {
        const ch = this.character!, g = genderOf(ch), v = new ActorView(this, this.cls, this.kin.x, this.kin.y);
        v.setBaseLook(headLookOf(ch), g); v.setGear(wornLook(CharacterStore.getGear(ch.id) ?? ch.gear), g); v.setName(ch.name); v.setEquipped(this.equipped);
        return v;
      },
      pose: (snap, dir) => resolvePose(this.cls, dir, poseQuery(snap), this.view!.wantsBase || !hasJob(this.character!), genderOf(this.character), !!this.character!.hero),
      appear: (at) => this.fx?.kageAppear(at), burst: (at) => this.fx?.kageBurst(at), fade: (at) => this.fx?.kageFade(at),
      feint: (at, face, stage) => this.fx?.kageFeint(at, face, stage),
    });
  }
  /** The foe the doubles close in on: the nearest other fighter or monster (none near: they roam round the ring). */
  private kageFoe(): V2 | null {
    const k = this.kin;
    let best: V2 | null = null, bd = 560;
    const see = (x: number, y: number) => { const d = Math.hypot(x - k.x, y - k.y); if (d < bd) { bd = d; best = { x, y }; } };
    for (const r of this.pvp?.remotes.values() ?? []) if (r.alive && !this.party?.has(r.meta.playerId)) see(r.x, r.y);
    if (this.bot) see(this.bot.x, this.bot.y);
    if (this.enemy?.alive) see(this.enemy.x, this.enemy.y);
    for (const m of this.world?.mobs ?? []) if (m.alive) see(m.x, m.y);
    return best;
  }
  /** Kagemusha's burst (its active start): he vanishes (hidden from now on); the ring of doubles stands at its end. */
  private kageStart(run: CastRun): void {
    if (this.dead >= 0) return;
    const k = this.kin, at = { x: k.x, y: k.y, z: k.z };
    this.fx?.callout({ x: at.x, y: at.y, z: at.z + 50 }, 'KAGEMUSHA', '#ffb0b8', 0);
    this.kageOf().start(run.castId, at, this.simMs, run.timings.active + run.timings.recovery);
  }
  /** A blow landed on a double (`kage:<his id>:<k>`): yours bursts into petals; another samurai's screen judges his own
   *  (they move: his screen knows where they really are), and his state tells everyone when one bursts. */
  private kageStruck(id: string): void {
    const t = kageTarget(id); if (!t) return;
    if (t.owner === this.localId) this.kage?.pop(t.k);
  }
  /** Where a caster's doubles stand (`<id>#<k>`: one of them). */
  private ghostsOf(id: string): { k: number; x: number; y: number; z: number }[] { return id === this.localId ? (this.kage?.ghosts() ?? []) : (this.pvp?.remotes.get(id)?.kageGhosts() ?? []); }
  private ghostPos(id: string): V3 | null {
    const i = id.lastIndexOf('#'), owner = id.slice(0, i), k = Number(id.slice(i + 1));
    return owner === this.localId ? (this.kage?.pos(k) ?? null) : (this.pvp?.remotes.get(owner)?.kagePos(k) ?? null);
  }
  /** The doubles swing with him: against monsters their cuts land too, for a share of his damage. */
  private kageSwing(r: CastRun, i: number, o: V3): void {
    if (!r.own || r.skill.cls !== 'samurai' || r.skill.id === 'kagemusha' || !this.kage?.up) return;
    const h = r.hits[i];
    if (!h || h.damage <= 0 || h.shape.kind === 'projectile' || h.shape.kind === 'chain' || r.skill.trap) return;
    const k = this.kin, gh = { ...h, damage: h.damage * KAGE.monsterMul };
    for (const g of this.kage.ghosts()) {
      const dx = g.x - k.x, dy = g.y - k.y, from = { x: o.x + dx, y: o.y + dy, z: o.z }, place = r.place ? { x: r.place.x + dx, y: r.place.y + dy } : null;
      const path: [V2, V2] = [{ x: r.pathStart.x + dx, y: r.pathStart.y + dy }, { x: from.x, y: from.y }];
      const gr = Object.create(r) as CastRun; gr.attackerId = `${this.localId}#${g.k}`; gr.castId = `${r.castId}#${g.k}`; gr.origin = from;
      for (const t of this.targetsFor(r)) if (t.kind === 'enemy' && t.alive && !t.invulnerable && shapeContains(gh, from, r.aim, place, path, t)) this.applyToPve(gr, gh, t, { x: t.x, y: t.y, z: t.z + 40 });
    }
  }
  /** The AMBUSH landed: the doubles burst into petals; the foe is stunned (a crown of petals over its head). */
  private kageAmbush(at: V3, target: string): void {
    this.fx?.callout(at, 'AMBUSH!!', '#ff5a6a', 0);
    this.fx?.samStun(target, KAGE.ambushStun);
    if (this.fx) this.fx.hitStopLeft = Math.max(this.fx.hitStopLeft, 90);
    this.cameras.main.shake(160, 0.006);
    this.kage?.end('burst');
  }

  /** Archer: Eagle Eyes arrow range. */
  private ownRangeMul(s: FinalSkill): number { return s.cls === 'archer' ? this.passives.rangeMul : 1; }
  /** Archer: Bow Haste (+20%) × Ranger Mastery attack speed (startup / recovery shortened). */
  private ownSpeedMul(s: FinalSkill): number { return (this.simMs < this.mage.hasteUntil ? 1.1 : 1) * this.classSpeedMul(s); }
  private classSpeedMul(s: FinalSkill): number { return s.cls === 'warrior' && this.simMs >= this.radiantFrom && this.simMs < this.radiantUntil && s.id !== 'radiant_blade' ? RADIANT_SPEED : s.cls === 'archer' ? this.passives.atkSpeed * (this.simMs < this.hasteUntil ? 1.2 : 1) : s.cls === 'samurai' ? this.passives.atkSpeed : 1; }
  /** Own critical rate bonus: passives + Hunter's Spirit (+15%). */
  private critAddNow(): number { return this.passives.critAdd + (this.arena ? 0 : this.statD.critAdd) + (this.simMs < this.spiritUntil ? 0.15 : 0); }
  /** Own extra critical damage: passives + Rising Sun (+20%). */
  private critDmgNow(): number { return this.passives.critDmgAdd + (this.simMs < this.sunUntil ? 0.2 : 0); }

  /** Evasion (archer): a chance to dodge a hit entirely — MISS, a rush of wind, a short sidestep. */
  private tryEvade(from: { x: number; y: number }): boolean {
    const ev = this.passives.evade + (this.arena ? 0 : this.statD.evadeAdd);
    if (ev <= 0 || this.simMs < this.body.invulnUntil || Math.random() >= ev) return false;
    const k = this.kin, away = unit(k.x - from.x, k.y - from.y), side = away.x < 0 ? -1 : 1;
    for (let d = 40; d > 0; d -= 4) { const nx = k.x + away.x * d, ny = k.y + away.y * d; if (footAllowed(nx, ny, k.z, R)) { k.x = nx; k.y = ny; break; } }
    if (this.cls === 'samurai') { // Willow Dodge: a mirage left where he stood, petals, a crimson streak
      const v = this.view!, ghost = new Afterimages(this, SAMURAI_AFTER); // (its own: the body motion's afterimages keep their pace)
      ghost.step(0, v.sprite, true, 0); // the body is still drawn where he stood: the mirage stays there
      for (let i = 1; i < 3; i++) this.time.delayedCall(i * 40, () => ghost.step(i * 1000, v.sprite, true, 0));
      this.fx!.mirageDodge(k.x, k.y - k.z, side);
      this.fx!.callout({ x: k.x, y: k.y, z: k.z + 30 }, 'MISS', '#ffc8d4', 0);
      return true;
    }
    this.fx!.evadeDash(k.x, k.y - k.z, side);
    this.fx!.callout({ x: k.x, y: k.y, z: k.z + 30 }, 'MISS', '#c8ffb0', 0);
    return true;
  }

  /** Tree of Life: heals the caster near the tree and shares a pulse with party members near it, every second. */
  private stepTree(now: number): void {
    const t = this.tree;
    if (!t) return;
    if (now >= t.until || this.dead >= 0) { this.tree = null; return; }
    if (now < t.next) return;
    t.next += 1000;
    const k = this.kin;
    if (Math.hypot(k.x - t.x, k.y - t.y) <= TREE_RADIUS) this.fx!.appleDrop({ x: t.x, y: t.y }, () => (this.dead < 0 ? { x: this.kin.x, y: this.kin.y, z: this.kin.z } : null), () => this.treeHeal()); // an apple falls from the tree; the heal lands with it
    const p = this.party, pvp = this.pvp;
    if (p?.inParty && pvp) p.shareBuff('tree_of_life', 1000, p.members.filter((id) => { const r = pvp.remotes.get(id); return !!r && r.alive && Math.hypot(r.x - t.x, r.y - t.y) <= TREE_RADIUS; }));
  }
  private treeHeal(): void {
    if (this.dead >= 0) return;
    const max = this.maxHpNow(), before = this.playerHP;
    this.playerHP = Math.min(max, this.playerHP + Math.max(1, Math.round(max * (this.arena ? 0.02 : 0.04)))); // (the arena: half — a duel round is not healed through)
    if (this.playerHP > before) this.fx!.healNumber({ x: this.kin.x, y: this.kin.y, z: this.kin.z }, this.playerHP - before);
    this.fx!.passiveFx('heal_sparkle', { x: this.kin.x, y: this.kin.y, z: this.kin.z }, 170, { originY: 0.8, normal: true, depth: 100000 - 1, ms: [70, 80, 100, 120, 130, 140, 150, 160], follow: () => (this.dead < 0 ? { x: this.kin.x, y: this.kin.y, z: this.kin.z } : null) });
  }

  /** Party buffs: the caster always gets them; in a party every member within 420px of the caster gets them too. */
  private partyMembersNear(): string[] {
    const p = this.party, k = this.kin;
    if (!p?.inParty || !this.pvp) return [];
    return p.members.filter((id) => { const r = this.pvp!.remotes.get(id); return !!r && r.alive && Math.hypot(r.x - k.x, r.y - k.y) <= 420; });
  }
  private shareWithParty(skillId: string, ms: number): void { this.party?.shareBuff(skillId, ms, this.partyMembersNear()); }

  /** A party member near me cast a party buff. */
  private receivePartyBuff(from: string, id: string, ms: number): void {
    if (this.dead >= 0) return;
    const now = this.simMs, k = this.kin, name = this.pvp?.nameOf(from) ?? 'Party';
    if (id === 'war_cry') this.allyCryUntil = Math.max(this.allyCryUntil, now + ms);
    else if (id === 'iron_oath') this.oathUntil = Math.max(this.oathUntil, now + ms);
    else if (id === 'legacy_banner') this.bannerUntil = Math.max(this.bannerUntil, now + ms);
    else if (id === 'hunters_spirit') this.spiritUntil = Math.max(this.spiritUntil, now + ms);
    else if (id === 'rising_sun') this.sunUntil = Math.max(this.sunUntil, now + ms);
    else if (id === 'chrono_haste') { this.mage.hasteUntil = Math.max(this.mage.hasteUntil, now + ms); this.fx?.mageAura(this.localId, 'haste', ms); }
    else if (id === 'arcane_ward') { this.mage.wardHp = Math.max(this.mage.wardHp, Math.round(this.maxHpNow() * 0.1)); this.mage.wardUntil = Math.max(this.mage.wardUntil, now + ms); this.fx?.mageWard(this.localId, ms); }
    else if (id === 'tree_of_life') { this.treeHeal(); return; } // one heal pulse from a party member's tree (sent every second while you stand near it)
    else return;
    const label = id === 'chrono_haste' ? 'CHRONO HASTE' : id === 'arcane_ward' ? 'ARCANE WARD' : id === 'war_cry' ? 'WAR CRY' : id === 'iron_oath' ? 'IRON OATH' : id === 'hunters_spirit' ? "HUNTER'S SPIRIT" : id === 'rising_sun' ? 'RISING SUN' : 'LEGACY BANNER';
    this.fx?.callout({ x: k.x, y: k.y, z: k.z + 50 }, `+${label}`, '#ffd27a', 0);
    this.fx?.shockwave(k.x, k.y, 90, 0xffd27a);
    this.chat?.add({ kind: 'system', text: `${name} gave you ${label.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}.` });
  }

  /** Party frame / window / invite pop-up (refreshed a few times a second). */
  private refreshParty(ms: number): void {
    if (!this.partyUi) return;
    this.partyTick += ms; if (this.partyTick < 200) return; this.partyTick = 0;
    const p = this.party, pvp = this.pvp, me = this.localId;
    const members = (p?.members ?? []).map((id) => {
      const r = pvp?.remotes.get(id), self = id === me;
      return { id, name: self ? (this.character?.name ?? 'You') : pvp?.nameOf(id) ?? 'Player', leader: p!.leader === id, me: self,
        hp: self ? this.playerHP : r?.hp ?? 0, maxHp: self ? this.maxHpNow() : r?.maxHp ?? PVP.maxHp, alive: self ? this.dead < 0 : !!r?.alive };
    });
    const view: PartyView = {
      members, isLeader: !!p?.isLeader, inParty: !!p?.inParty, inviteFrom: p?.pendingFrom ? pvp?.nameOf(p.pendingFrom) ?? 'Player' : null,
      room: (pvp?.roomPlayers() ?? []).map((r) => ({ ...r, canInvite: !!p?.canInvite(r.id), inMine: !!p?.has(r.id) })),
    };
    this.partyUi.render(view);
  }

  /** Skills open with the job advancements; in the PvP arena every skill is open (testing the combat). */
  private skillOpen(s: FinalSkill): boolean {
    return this.allOpen() || this.localId !== 'local' || jobOfSlot(this.cls, s.slot).level <= (this.character ? skillLevel(this.character) : 1);
  }

  /** Start a slot now if legal (incl. hit-confirm cancel / chain continuation from the current action). */
  tryStartSlot(i: number): boolean {
    const s = this.mageVariant(this.kit[i]); // (Arcane Bolt: the element Attunement gives it)
    if (!s || !this.rt || this.dead >= 0) return false;
    if (this.inputLocked()) return false; // talking / a battle's VS, ROUND n, K.O.: no attacks (buffered ones too)
    if (!this.skillOpen(s)) return false; // skills open with the job advancements (all open in the arena)
    if (s.wip) return false; // a template: not built yet
    const now = this.simMs, k = this.kin, b = this.body;
    // War Cry breaks free: usable while stunned / hit / launched / knocked down (cooldown permitting) — clears all CC.
    if (s.id === 'war_cry' && (b.state !== 'free' || b.hard.active(now)) && this.rt.cooldownRemaining(s.id) <= 0) {
      b.hard.reset(); b.combos.clear(); b.push = null; b.pinUntil = -1; b.state = 'free'; b.stateEnd = 0; b.invulnUntil = now + 600;
      if (!k.grounded) { k.vz = Math.min(k.vz, 0); }
      this.fx!.callout({ x: k.x, y: k.y, z: k.z + 40 }, 'BREAK FREE!!', '#ffe7a0', 0);
    }
    if (b.state !== 'free') return false;
    if (b.hard.active(now) && b.hard.kind !== 'root') return false;
    if (now < b.curseUntil) return false; // a paper crane cannot cast
    if (s.id === 'chrono_sigil' && this.sigil && now < this.sigil.until) { this.sigilRecall(); return true; } // the sigil laid: back to it in time
    if (!(k.grounded ? s.ground : s.air)) return false;
    if (s.dash && b.hard.active(now)) return false; // rooted: no dashes
    if (this.mode === 'takeoff' && this.modeT < PHYS.takeoffMs) return false;
    const run = this.rt.ownRun;
    if (run && !this.cancelAllowed(run, s)) return false;
    if (this.rt.cooldownRemaining(s.id) > 0) return false;
    if (!MP_FREE && (this.localId === 'local' || this.arena)) { const c = mpCost(s), chainNext = run && run.skill.id === s.id; // MP: a chain's later strikes are paid with its first
      if (c > 0 && !chainNext && this.mp < c) { if (this.simMs - this.noMpAt > 900) { this.noMpAt = this.simMs; this.fx?.callout({ x: k.x, y: k.y, z: k.z + 70 }, 'NOT ENOUGH MP', '#7fb6ff', 0); } return false; } }
    let stage = 0;
    if (s.chain) {
      const mid = run && run.skill.id === s.id;
      const cont = this.chain.skill === s.id && now - this.chain.lastEnd <= s.chain.resetMs && this.chain.stage < s.chain.stages.length - 1;
      stage = mid ? Math.min(s.chain.stages.length - 1, run!.stage + 1) : cont ? this.chain.stage + 1 : 0;
      if (mid && run!.stage >= s.chain.stages.length - 1) return false;
    }
    const target = this.resolveCast(s);
    if (!target) return false;
    if (run) { this.rt.cancelForFollowUp(run); this.endRun(run, true); }
    this.startCast(s, stage, target.aim, target.place, target.lock);
    return true;
  }

  /** Hit-confirm cancel windows (and the basic chain): only after a confirmed hit, until 70% of recovery. */
  private cancelAllowed(run: CastRun, next: FinalSkill): boolean {
    const s = run.skill, T = run.timings, e = run.elapsed;
    if (s.id === next.id && s.chain) return e >= T.startup + T.active - 20;
    if (s.slot === 7) return false; // Ultimate cannot be cancelled
    if (next.id === 'blink' && s.id !== 'blink' && e >= T.startup + T.active) return true; // Blink cancels the end of any spell
    if (next.id === s.id) return !!s.charges && e >= T.startup + T.active; // charged skill: throw again right away
    if (s.id === 'whirlwind' && e >= T.startup + 200) return true; // channelled spin: break out into any skill at will
    // Free cancel (DFO-style): after a confirmed hit any other skill can cancel this one until it ends;
    // a whiff can only be cancelled late in its recovery.
    if (run.confirmedAt >= 0) return e >= run.confirmedAt;
    return e >= T.startup + T.active + 0.5 * T.recovery;
  }

  /** Aim / placement / lock-on for a cast. Null = rejected (illegal placement): no cooldown is spent. */
  private resolveCast(s: FinalSkill): { aim: V2; place: V2 | null; lock: string | null } | null {
    const k = this.kin, inp = this.ci!;
    // Soft lock (DFO-style tracking): snap the aim to the nearest enemy roughly in front, so attacks never whiff on a near-miss angle.
    const lockT = this.softTarget(260, 0.05);
    if (lockT) this.aim = unit(lockT.x - k.x, lockT.y - k.y, this.aim.x, this.aim.y);
    const reach = s.id === 'arcane_gate' ? 360 : s.targeting === 'mouseGround' ? Math.min(180, s.placeRange ?? 180) : 160; // (the far gate: well ahead of him)
    const mouse = { x: k.x + this.aim.x * reach, y: k.y + this.aim.y * reach };
    let aim = unit(mouse.x - k.x, mouse.y - k.y, FACE[this.dir].x, FACE[this.dir].y);
    let place: V2 | null = null, lock: string | null = null;
    if (s.targeting === 'mouseGround') {
      place = clampPlace(k, mouse, s.placeRange ?? 260);
      if (!placementOk(place.x, place.y)) return null;
    }
    if (s.targeting === 'mouseTarget') {
      let best: HitTarget | null = null, bd = Infinity;
      for (const t of this.targetsFor({ own: true, attackerId: this.localId } as CastRun)) {
        if (!t.alive || t.id === this.localId || this.pvp?.remotes.get(t.id)?.kageHidden) continue;
        const vx = t.x - k.x, vy = t.y - k.y, along = vx * aim.x + vy * aim.y, lat = Math.abs(-vx * aim.y + vy * aim.x);
        if (along < -10 || along > 320 || lat > 110) continue;
        if (along < bd) { bd = along; best = t; }
      }
      if (best) { lock = best.id; aim = unit(best.x - k.x, best.y - k.y, aim.x, aim.y); }
    }
    aim = sideAim(aim.x, aim.y, this.dir === 'left' ? -1 : 1); // to the side or a corner, never straight up / down
    return { aim, place, lock };
  }

  private startCast(s: FinalSkill, stage: number, aim: V2, place: V2 | null, lock: string | null): void {
    const k = this.kin;
    const ct = this.castTimes(s, stage); // (the arena's warrior: his base pace, as the runtime plays it)
    if (stage === 0 && !MP_FREE) this.mp = Math.max(0, this.mp - mpCost(s));
    // Lunge-in: melee skills step toward a soft-locked target that is just out of reach.
    this.lunge = null;
    const shape = (s.chain ? s.chain.stages[stage] : s.hits)[0]?.shape;
    const want = shape && (shape.kind === 'sector' ? shape.range * 0.75 : shape.kind === 'line' ? shape.length * 0.6 : shape.kind === 'circle' && !shape.at ? shape.radius * 0.7 : 0);
    const t = want && !s.dash ? this.softTarget(want + 70, 0.3) : null;
    if (t) { const d = Math.hypot(t.x - k.x, t.y - k.y) - want; if (d > 4) this.lunge = { x: aim.x * Math.min(70, d), y: aim.y * Math.min(70, d), left: Math.max(60, ct.startup) }; }
    // The cut is measured from where the lunge takes you (the step in is done by the time it strikes) — here and for the others.
    const from = { x: k.x + (this.lunge?.x ?? 0), y: k.y + (this.lunge?.y ?? 0), z: k.z };
    const castId = `${this.localId}:${++this.castSeq}`;
    this.aim = aim; this.dir = dirOf(aim.x, aim.y, this.dir);
    this.body.armorUntil = -1;
    if (s.id === 'war_cry') { this.warCryUntil = this.simMs + s.startup + 8000; this.shares.push({ at: this.simMs + s.startup, id: s.id, ms: 8000 }); /* shared at the release (sim clock), like the caster's own */ }
    if (s.id === 'iron_oath') { this.oathUntil = this.simMs + ct.startup + 60000; this.shares.push({ at: this.simMs + ct.startup, id: s.id, ms: 60000 }); /* shared at the release (sim clock), like the caster's own */ this.time.delayedCall(ct.startup, () => this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, 'IRON OATH', '#ffd27a', 0)); }
    if (s.id === 'legacy_banner') { this.bannerUntil = this.simMs + ct.startup + 90000; this.shares.push({ at: this.simMs + ct.startup, id: s.id, ms: 90000 }); /* shared at the release (sim clock), like the caster's own */ this.time.delayedCall(Math.round(ct.startup * 0.7), () => this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, 'LEGACY BANNER', '#ffe7a0', 0)); }
    if (s.cls === 'archer') this.archerCast(s, stage);
    if (s.cls === 'samurai') this.samuraiCast(s, stage);
    if (s.id === 'blade_storm') this.radiantUntil = Math.max(this.radiantUntil, this.simMs + ct.startup + ct.active + 15000); // the storm leaves the blade of light in your hand (15s, as Radiant Blade)
    if (s.id === 'sanctuary') this.domeAt = this.simMs + Math.round(ct.startup * 0.95); // sim clock (hit-stop/fast-step safe)
    if (s.id === 'radiant_blade') { this.boltDone = false; this.radiantFrom = this.simMs + Math.round(s.startup * 0.4); } // light appears when the sword is raised
    if (s.id === 'radiant_blade') this.radiantUntil = this.simMs + s.startup + 15000;
    if (s.id === 'guard_counter') this.body.invulnUntil = this.simMs + s.startup + 600; // Aegis barrier
    if (s.armor) this.body.armorUntil = Math.max(this.body.armorUntil, this.simMs + s.armor[1]); // super armor from the first frame (never interrupted mid-windup)
    if (s.slot === 7) this.body.invulnUntil = this.simMs + ct.startup + ct.active; // ultimate: untouchable while it plays
    else if (this.simMs < this.warCryUntil) this.body.armorUntil = this.simMs + ct.startup + ct.active; // War Cry: super armor while attacking
    this.kage?.arm(castId, s.id, { x: k.x, y: k.y, z: k.z }); // he strikes: out of hiding; a cast while the doubles stand: its first hit that lands is the AMBUSH
    const mf = s.cls === 'book_mage' ? this.mageFlags() : 0;
    const run = this.rt!.start({ castId, skill: s, stage, attackerId: this.localId, own: true, origin: from, aim, place, lock, ...(mf ? { mf } : {}) });
    if (s.cls === 'book_mage') this.mageCast(s, run);
    if (s.chain) this.chain = { stage, lastEnd: Infinity, skill: s.id };
    this.setMode('skill');
    const dm = this.ownDamageMul(s), rm = s.cls === 'warrior' && this.simMs < this.radiantUntil ? 1.85 : 1; // buffs travel with the cast (victim-side damage / reach)
    this.pvp?.sendCast({ castId, skillId: s.id, stage, x: Math.round(from.x), y: Math.round(from.y), z: Math.round(k.z), ax: Math.round(aim.x * 1000), ay: Math.round(aim.y * 1000), ...(place ? { px: Math.round(place.x), py: Math.round(place.y) } : {}), lock, ...(dm !== 1 ? { dm: Math.round(dm * 100) } : {}), ...(rm !== 1 ? { rm: Math.round(rm * 100) } : {}), ...(this.ownRangeMul(s) !== 1 ? { rg: Math.round(this.ownRangeMul(s) * 100) } : {}), ...(this.ownSpeedMul(s) !== 1 ? { sp: Math.round(this.ownSpeedMul(s) * 100) } : {}), ...(this.kage?.isAmbush(castId) ? { amb: 1 } : {}), ...(mf ? { mf } : {}) });
  }

  /** Archer casts: buffs, the tree, the channelled storm (timers on the sim clock, from the run's real startup). */
  private archerCast(s: FinalSkill, stage: number): void {
    const T = s.chain?.timings?.[stage] ?? s, up = Math.round(T.startup / this.ownSpeedMul(s)), k = this.kin, now = this.simMs;
    if (s.id === 'hunters_spirit') { this.spiritUntil = now + up + 120000; this.shares.push({ at: now + up, id: s.id, ms: 120000 }); this.time.delayedCall(up, () => this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, "HUNTER'S SPIRIT", '#ffe27a', 0)); }
    if (s.id === 'tree_of_life') { const side = this.aim.x < 0 ? -1 : 1; void side; this.tree = { x: k.x, y: k.y - 46, until: now + up + 20000, next: now + up + 1000 }; this.time.delayedCall(up, () => this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, 'TREE OF LIFE', '#b8ff9a', 0)); }
    if (s.id === 'piercing_arrow') this.time.delayedCall(up, () => this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, 'SPIRIT BOW', '#c8ffb0', 0));
  }

  /** Samurai casts: the buffs (timers on the sim clock, from the run's real startup) and their callouts. */
  private samuraiCast(s: FinalSkill, stage: number): void {
    const T = s.chain?.timings?.[stage] ?? s, up = Math.round(T.startup / this.ownSpeedMul(s)), now = this.simMs;
    const say = (text: string, color: string) => this.time.delayedCall(up, () => this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, text, color, 0));
    if (s.id === 'rising_sun') { this.sunUntil = now + up + 90000; this.shares.push({ at: now + up, id: s.id, ms: 90000 }); say('RISING SUN', '#ffd27a'); }
    if (s.id === 'god_of_blades') { this.godUntil = now + up + 30000; say('GOD OF BLADES', '#ffc8d4'); }
  }

  /** Volley Stance: the archer stands rooted, but the held direction aims the stream (side or corner); other players follow. */
  private stepStorm(): void {
    const run = this.rt?.ownRun, inp = this.ci;
    if (run && run.skill.id === 'arrow_storm' && run.phase !== 'done' && run.place && inp?.hasMove) { // Hunter's Rain: the held direction steers the mark of the rain over the floor
      const u = unit(inp.moveX, inp.moveY), sp = 360 * (this.game.loop.delta / 1000), k = this.kin;
      let nx = run.place.x + u.x * sp, ny = run.place.y + u.y * sp * 0.75;
      const d = Math.hypot(nx - k.x, ny - k.y), R = 520; if (d > R) { nx = k.x + ((nx - k.x) / d) * R; ny = k.y + ((ny - k.y) / d) * R; }
      if (placementOk(nx, ny)) { run.place = { x: nx, y: ny }; this.pvp?.sendRelease({ castId: run.castId, at: -2, ax: Math.round(nx), ay: Math.round(ny) }); }
      return;
    }
    if (!run || !AIM_STEER.has(run.skill.id) || run.phase === 'done' || !inp?.hasMove) return;
    if (run.skill.id === 'eagle_arrow' && run.phase !== 'startup') return; // Eagle Tide: turned while charging, fixed once released
    const u = unit(inp.moveX, inp.moveY), face = this.dir === 'left' || run.aim.x < -0.01 ? -1 : 1;
    // Spirit Bow: level to a side, up at 45°, or straight up (never down)
    const a = run.skill.id === 'piercing_arrow' ? (u.y < -0.3 ? (Math.abs(u.x) > 0.38 ? unit(Math.sign(u.x), -1) : unit(face * 0.05, -1)) : { x: Math.abs(u.x) > 0.2 ? Math.sign(u.x) : face, y: 0 }) : sideAim(u.x, u.y, face); // Spirit Bow: to a side, up at 45° or straight up
    if (Math.abs(a.x - run.aim.x) < 1e-3 && Math.abs(a.y - run.aim.y) < 1e-3) return;
    run.aim = a; this.aim = a; if (Math.abs(a.x) > 0.01) this.dir = dirOf(a.x, 0, this.dir);
    this.pvp?.sendRelease({ castId: run.castId, at: -1, ax: Math.round(a.x * 1000), ay: Math.round(a.y * 1000) });
  }

  /** A run ended (finished or cancelled into a follow-up): chain bookkeeping + recovery → breathing transition. */
  private endRun(run: CastRun, toMove: boolean): void {
    if (!run.own) return;
    if (run.skill.id === 'iron_grip') this.gripHeld = false;
    if (run.skill.chain) this.chain = { stage: run.stage, lastEnd: this.simMs, skill: run.skill.id };
    this.body.armorUntil = -1;
    // Warrior skill sheets end in their own battle stance: go straight to idle (the old recovery frames popped and froze the body).
    if (!toMove && this.kin.grounded) this.setMode(this.cls === 'warrior' ? 'idle' : 'recover');
    else if (!this.kin.grounded) this.setMode('air');
  }

  private onRunPhase(run: CastRun, phase: string): void {
    if (phase === 'active' && run.skill.cls === 'book_mage') this.mageZone(run);
    const L = run.skill.linger;
    if (phase === 'active' && L) { // every caster's lingering zone (yours, other players', the sparring knight's)
      const off = L.at === 'aim' ? (L.offset ?? 0) : 0;
      this.lingers.push({ run, x: run.origin.x + run.aim.x * off, y: run.origin.y + run.aim.y * off, next: this.simMs + L.startMs, left: L.count });
    }
    if (run.own) {
      if (phase === 'active' && run.skill.armor) this.body.armorUntil = this.simMs + Math.max(0, run.skill.armor[1] - run.timings.startup);
      if (phase === 'active' && run.skill.id === 'kagemusha') this.kageStart(run);
      if (phase === 'done') this.endRun(run, false);
      return;
    }
    if (phase === 'startup') (run.attackerId === BOT_ID ? this.bot?.view : this.pvp?.remotes.get(run.attackerId))?.startSkill(run.skill.id, run.stage, dirOf(run.aim.x, run.aim.y, 'right'), run.aim, castSeed(run.castId));
  }

  private togglePanel(k: 'K' | 'I' | 'O' | 'J' | 'P' | 'U'): void {
    if (k === 'U') { if (this.arena) return; this.skillBook?.close(); this.cosPanel?.close(); this.questLog?.close(); this.partyUi?.close(); this.refreshStats(); this.statsWin?.toggle(); this.ci?.reset(); return; }
    if (k === 'P') { this.skillBook?.close(); this.cosPanel?.close(); this.questLog?.close(); this.partyUi?.toggle(); this.ci?.reset(); return; }
    this.partyUi?.close();
    if (k === 'J') { this.skillBook?.close(); this.cosPanel?.close(); this.questLog?.toggle(); }
    else if (k === 'K') { this.cosPanel?.close(); this.questLog?.close(); this.skillBook?.toggle(); }
    else { this.skillBook?.close(); this.questLog?.close(); this.cosPanel?.toggle(k === 'I' ? 'inventory' : 'shop'); }
    this.ci?.reset();
  }

  /** Key Settings saved: the input layer is rebuilt on the new keys; tray and skill book show them. */
  private applyKeys(b: Record<BindAction, string>): void {
    this.ci?.destroy();
    this.bindings = b;
    this.ci = new CombatInput(this, (i) => this.useSlot(i), () => this.onJumpKey(), (k) => this.togglePanel(k), b, () => this.onTalk(), (i) => this.usePotion(i));
    this.hud?.setKeyLabels(slotKeyLabels(b));
    this.hud?.setMenuKeys(menuKeys(b));
    this.comboGuide?.setKeys(this.guideKeys());
    this.world?.setTalkKey(keyLabel(b.talk)); if (this.npcDialog) this.npcDialog.talkKey = keyLabel(b.talk);
  }

  // ======================================================================= chat

  /** While the chat's typing row has the keyboard, the game ignores keys (and forgets held ones). */
  private chatTyping(on: boolean): void {
    this.ci?.reset();
    const kb = this.input.keyboard;
    if (kb) { kb.enabled = !on; if (!on) kb.resetKeys(); }
  }

  private nameOf(id: string): string {
    if (id === this.localId) return this.character?.name ?? 'You';
    if (id === BOT_ID) return this.botName();
    return this.pvp?.remotes.get(id)?.meta.name ?? 'Someone';
  }

  /** Your line: everyone in the room (bubble over your head), a whisper (/w Name text), or a note when it can't go out. */
  private sendChat(raw: string, kind: ChatKind): void {
    const me = this.character?.name ?? 'You';
    const w = /^\/w\s+(\S+)\s+(.+)$/i.exec(raw);
    if (w || kind === 'whisper') {
      if (!w) { this.chat?.add({ kind: 'system', text: 'Whisper: /w Name message' }); return; }
      const to = [...(this.pvp?.remotes.values() ?? [])].find((r) => r.meta.name.toLowerCase() === w[1].toLowerCase());
      if (!to) { this.chat?.add({ kind: 'system', text: `${w[1]} is not here.` }); return; }
      this.pvp?.sendChat(w[2], to.meta.playerId);
      this.chat?.add({ kind: 'whisper', name: me, me: true, to: to.meta.name, text: w[2] });
      return;
    }
    if (kind === 'party') {
      if (!this.party?.inParty) { this.chat?.add({ kind: 'system', text: 'You are not in a party.' }); return; }
      this.pvp?.sendChat(raw, undefined, undefined, true);
      this.chat?.add({ kind: 'party', name: me, me: true, text: raw });
      return;
    }
    this.chat?.add({ kind: 'all', name: me, me: true, text: raw });
    this.bubbles?.say(this.localId, raw, this.simMs);
    this.pvp?.sendChat(raw);
  }

  private receiveChat(from: string, m: Extract<NetMsg, { t: 'chat' }>): void {
    const r = this.pvp?.remotes.get(from);
    if (!r || typeof m.text !== 'string') return;
    if (typeof m.emo === 'number') { if (m.emo >= 0 && m.emo < EMOTES && Number.isInteger(m.emo)) this.bubbles?.emote(from, m.emo, this.simMs); return; }
    const text = m.text.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, CHAT_MAX_LEN);
    if (!text) return;
    if (m.to) { if (m.to === this.localId) this.chat?.add({ kind: 'whisper', name: r.meta.name, text }); return; }
    if (m.p) { if (this.party?.has(from)) this.chat?.add({ kind: 'party', name: r.meta.name, text }); return; } // party chat: members only
    this.chat?.add({ kind: 'all', name: r.meta.name, text });
    this.bubbles?.say(from, text, this.simMs);
  }

  // ======================================================================= targets / hits

  casterPos(id: string): V3 | null {
    if (id.includes('#')) return this.ghostPos(id); // a Kagemusha double (its swings follow it)
    if (id === this.localId) return this.view ? { x: this.kin.x, y: this.kin.y, z: this.kin.z } : null;
    if (id === BOT_ID) return this.bot ? { x: this.bot.x, y: this.bot.y, z: this.bot.z } : null;
    const r = this.pvp?.remotes.get(id);
    return r ? { x: r.x, y: r.y, z: r.z } : null;
  }

  /** Own casts test PvE entities (local authority) + remote players (prediction only); remote casts test the local player. */
  private targetsFor(run: CastRun): HitTarget[] {
    const out: HitTarget[] = [];
    if (run.own) {
      if (this.enemy) out.push(this.enemy.target());
      for (const m of this.world?.mobs ?? []) out.push(m.target());
      if (this.dummy && this.dummyState) out.push({ id: 'dummy', kind: 'enemy', x: D.x, y: D.y, z: this.dummyState.kin.z, radius: D.collisionRadius, height: 80, alive: this.dummyState.alive, invulnerable: this.simMs < this.dummyState.body.invulnUntil });
      if (this.bot) out.push(this.bot.target(this.simMs));
    } else if (this.view && (this.pvpReady || (run.attackerId === BOT_ID && !!this.bot?.trial))) { // the arena, or a Master's trial
      out.push({ id: this.localId, kind: 'player', x: this.kin.x, y: this.kin.y, z: this.kin.z, radius: R + 4, height: 74, alive: this.dead < 0, invulnerable: this.simMs < this.body.invulnUntil || this.body.ghost(this.simMs) });
      if (this.kage?.up) out.push(...this.kage.targets(this.localId, R + 4)); // your doubles: a blow on one bursts it
    }
    for (const r of this.pvp?.remotes.values() ?? []) if (r.meta.playerId !== run.attackerId && !(run.own && this.party?.has(r.meta.playerId))) out.push( // party members never hit each other
      { id: r.meta.playerId, kind: 'player', x: r.x, y: r.y, z: r.z, radius: R + 4, height: 74, alive: r.alive, invulnerable: r.ghost }, ...(run.own ? r.kageTargets(R + 4) : []));
    return out;
  }

  /** Where a hit comes from (it pushes away from there, pulls toward there): the caster — or, for a samurai's rolling zone
   *  or ring on the floor (Tornado Blade, Sakura Bind), its centre, so the foes are drawn into it, as it shows. */
  private hitFrom(run: CastRun, hit: HitEvent): { x: number; y: number } {
    if (run.skill.cls === 'samurai') {
      if (run.zone) return run.origin;
      if (hit.shape.kind === 'placed' && run.place) return run.place;
    }
    return this.casterPos(run.attackerId) ?? run.origin;
  }

  private onSkillHit(run: CastRun, hit: HitEvent, hi: number, t: HitTarget, at: V3): void {
    if (t.id.startsWith('kage:')) { this.kageStruck(t.id); return; } // a Kagemusha double: the blow is wasted on it
    if (run.skill.id === 'judgment_hook') { const f = this.hitFrom(run, hit), d = Math.hypot(at.x - f.x, at.y - f.y); hit = { ...hit, reaction: { ...hit.reaction, pull: Math.max(0, Math.min(340, d - 58)) } }; } // the chain yanks it to just in front of him
    if (!run.own) { if (t.id === this.localId) this.applyRemoteHitToSelf(run, hit, hi, at); return; }
    if (t.kind === 'enemy') { this.applyToPve(run, hit, t, at); return; }
    if (t.id === BOT_ID) { this.applyToBot(run, hit, t, at); return; }
    if (run.confirmedAt < 0 && !t.invulnerable) run.confirmedAt = run.elapsed; // predicted contact on a remote player (their client is authority; a guarded one: no contact)
  }

  /** PvE authority: combat body reaction on the enemy/dummy, damage, confirmed-hit feedback. */
  private applyToPve(run: CastRun, hit: HitEvent, t: HitTarget, at: V3): void {
    const now = this.simMs, s = run.skill;
    hit = this.mageHit(run, hit); hit = this.markHit(run, hit, t.id);
    const amb = run.own && hit.damage > 0 && !!this.kage?.isAmbush(run.castId); // Kagemusha's AMBUSH: a sure critical and a stun
    if (amb) hit = { ...hit, reaction: { ...hit.reaction, stun: Math.max(hit.reaction.stun ?? 0, KAGE.ambushStun) } };
    let out: HitOutcome | null = null, crit = false; // (a critical: its own number, MapleStory — no CRITICAL text)
    if (t.id === 'dummy' && this.dummyState?.alive) {
      const ds = this.dummyState;
      const ch = run.attackerId === this.localId ? this.chanceMul(ds.body) : 1;
      out = ds.body.receive(run.attackerId, s, hit, run.origin, now);
      if (run.attackerId === this.localId) out.damage = Math.round(out.damage * this.ownDamageMul(s) * ch * (ds.body.curseUntil > now ? 1.3 : 1)); // same buffs as against monsters
      ds.body.push = null; ds.kin.vx = 0; ds.kin.vy = 0; // anchored post: launches / knockdowns are vertical only (juggle practice)
      this.damageDummy(out.damage);
      if (ch > 1 && out.damage > 0) this.chanceMark(t.id, at);
    } else if (t.id === 'enemy' && this.enemy?.alive) {
      const en = this.enemy, from = this.hitFrom(run, hit);
      const counter = en.ai === 'attack' && en.body.state === 'free';
      const f = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[en.facing];
      const back = en.body.state === 'free' && (from.x - en.kin.x) * f[0] + (from.y - en.kin.y) * f[1] < -12;
      const ch = run.attackerId === this.localId ? this.chanceMul(en.body) : 1;
      out = en.body.receive(run.attackerId, s, hit, from, now);
      if (out.damage > 0) { en.hitFromX = from.x; en.faceToward(from.x, from.y); }
      if (run.attackerId === this.localId && (out.pushX || out.pushY) && s.id !== 'shield_slam') this.momentum = { x: out.pushX * 0.7, y: out.pushY * 0.7, left: 120 };
      if (s.id === 'iron_grip' && hit === s.hits[0]) { // seized: hoisted into the air, held in the energy hands
        en.kin.grounded = false; en.kin.z = Math.max(en.kin.z, 40); en.kin.vz = 0; en.body.state = 'launched'; en.body.push = null;
        this.gripHeld = true; this.fx!.hitStopLeft = Math.max(this.fx!.hitStopLeft, 70);
        this.fx!.callout(at, 'GRAB!!', '#ffd27a', 0);
      }
      if (s.id === 'iron_grip' && hit === s.hits[1]) { // swung over your head and smashed down behind you
        this.gripHeld = false;
        const nx = from.x + run.aim.x * 62, ny = from.y + run.aim.y * 62; // smashed into the floor right in front of you
        if (footAllowed(nx, ny, 0, 10)) { en.kin.x = nx; en.kin.y = ny; }
        en.kin.z = Math.min(en.kin.z, 30);
        this.fx!.crack(en.kin.x, en.kin.y, 120); this.fx!.shockwave(en.kin.x, en.kin.y, 200, 0xffc070);
        this.time.delayedCall(70, () => this.fx!.shockwave(en.kin.x, en.kin.y, 280, 0xff8a30));
        this.fx!.callout(at, 'SLAM!!', '#ff9a4a', 1); this.fx!.hitStopLeft = Math.max(this.fx!.hitStopLeft, 120); this.cameras.main.shake(220, 0.011);
      }
      if (s.id === 'shield_slam' && hit === s.hits[1]) { // driven into a wall / prop: extra stun
        const dx = en.kin.x - from.x, dy = en.kin.y - from.y, d = Math.hypot(dx, dy) || 1;
        if (!footAllowed(en.kin.x + (dx / d) * 150, en.kin.y + (dy / d) * 150, en.kin.z, 14)) {
          en.body.state = 'hitstun'; en.body.stateEnd = now + 900; this.fx!.callout(at, 'WALL CRASH!!', '#9ed8ff', 0); this.fx!.shockwave(en.kin.x, en.kin.y, 90, 0x9ed8ff);
        }
      }
      const own = run.attackerId === this.localId;
      crit = amb || (hit.damage > 0 && s.slot !== 0 && Math.random() < 0.12 + (own ? this.critAddNow() : 0)); // attack skills only: a regular attack never crits
      const mult = (counter ? 1.25 : 1) * (back ? 1.15 : 1) * (crit ? 1.5 + (own ? this.critDmgNow() : 0) : 1) * (own ? this.ownDamageMul(s) * ch * this.dmgRoll() * (en.body.curseUntil > now ? 1.3 : 1) : 1);
      out.damage = Math.round(out.damage * mult);
      en.damage(out.damage);
      // (MapleStory: only the damage shows — no COUNTER / BACK ATTACK labels; their bonus damage stays)
      if (crit && own && this.critDmgNow() > 0) { this.fx!.shockwave(at.x, at.y, 110, this.cls === 'archer' ? 0x9be35a : this.cls === 'samurai' ? 0xff4a5a : 0xff8a5a); this.fx!.hitStopLeft = Math.max(this.fx!.hitStopLeft, 40); } // Combat Mastery: heavier crits
      if (ch > 1 && out.damage > 0) this.chanceMark(t.id, at);
    }
    else if (t.id.startsWith('mob:')) {
      const m = this.mobById(t.id); if (!m?.alive) return;
      const from = this.hitFrom(run, hit);
      const counter = m.ai === 'attack' && m.body.state === 'free';
      const back = m.body.state === 'free' && (from.x - m.kin.x) * (m.facing === 'left' ? -1 : 1) < -12;
      const own = run.attackerId === this.localId, ch = own ? this.chanceMul(m.body) : 1;
      out = m.body.receive(run.attackerId, s, hit, from, now);
      if (out.damage > 0) { m.hitFromX = from.x; m.faceToward(from.x); }
      if (run.attackerId === this.localId && (out.pushX || out.pushY) && s.id !== 'shield_slam') this.momentum = { x: out.pushX * 0.7, y: out.pushY * 0.7, left: 120 };
      if (s.id === 'iron_grip' && hit === s.hits[0]) { m.kin.grounded = false; m.kin.z = Math.max(m.kin.z, 40); m.kin.vz = 0; m.body.state = 'launched'; m.body.push = null; this.gripHeld = true; this.gripFoe = m; this.gripFrom = { x: m.kin.x, y: m.kin.y }; this.fx!.hitStopLeft = Math.max(this.fx!.hitStopLeft, 70); this.fx!.callout(at, 'GRAB!!', '#ffd27a', 0); }
      if (s.id === 'iron_grip' && hit === s.hits[1]) {
        this.gripHeld = false; this.gripFoe = null;
        const nx = from.x + run.aim.x * 62, ny = from.y + run.aim.y * 62;
        // down on its own floor (a map above: up there), never inside a block or another monster
        const free = (x: number, y: number) => footAllowed(x, y, m.homeZ, 10) && supportAt(x, y, m.homeZ + 1).z === m.homeZ && !(this.world?.mobs ?? []).some((o) => o !== m && o.alive && Math.hypot(o.x - x, o.y - y) < 30);
        const to = [{ x: nx, y: ny }, { x: from.x, y: from.y }, this.gripFrom ?? m.home].find((q) => free(q.x, q.y)) ?? m.home;
        m.kin.x = to.x; m.kin.y = to.y; this.gripFrom = null;
        m.kin.z = Math.min(m.kin.z, m.homeZ + 30);
        this.fx!.crack(m.kin.x, m.kin.y, 120); this.fx!.shockwave(m.kin.x, m.kin.y, 200, 0xffc070); this.fx!.callout(at, 'SLAM!!', '#ff9a4a', 1); this.fx!.hitStopLeft = Math.max(this.fx!.hitStopLeft, 120); this.cameras.main.shake(220, 0.011);
      }
      crit = amb || (hit.damage > 0 && s.slot !== 0 && Math.random() < 0.12 + (own ? this.critAddNow() : 0)); // attack skills only: a regular attack never crits
      const mult = (counter ? 1.25 : 1) * (back ? 1.15 : 1) * (crit ? 1.5 + (own ? this.critDmgNow() : 0) : 1) * (own ? this.ownDamageMul(s) * ch * this.dmgRoll() * (m.body.curseUntil > now ? 1.3 : 1) : 1);
      out.damage = Math.round(out.damage * mult);
      const killed = m.damage(out.damage, now);
      // (MapleStory: only the damage shows — no COUNTER / BACK ATTACK labels; their bonus damage stays)
      if (crit && own && this.critDmgNow() > 0) { this.fx!.shockwave(at.x, at.y, 110, this.cls === 'archer' ? 0x9be35a : this.cls === 'samurai' ? 0xff4a5a : 0xff8a5a); this.fx!.hitStopLeft = Math.max(this.fx!.hitStopLeft, 40); } // Combat Mastery: heavier crits
      if (ch > 1 && out.damage > 0) this.chanceMark(t.id, at);
      if (killed) { // defeated: counts for the quests that ask for it
        this.questKill(m);
        this.gainExp(m.kind.exp ?? Math.round(m.kind.hp / 5), { x: m.kin.x, y: m.kin.y, z: m.kin.z });
        this.dropLoot(m);
        if (this.gripFoe === m) { this.gripFoe = null; this.gripHeld = false; }
      }
    }
    if (!out) return;
    this.mageReact(run, out, t.id, at);
    this.confirm(run, hit, t.id, at, out.damage, out.hitIndex, out.comboId, out.reaction, !!s.endsCombo, t.z, crit);
    if (out.reaction !== 'armor') this.finalAttack(run, t.id, at, out.damage);
  }

  private mobById(id: string): Monster | undefined { return this.world?.mobs.find((m) => m.id === id); }

  /** Attacker-side confirmed hit (PvE immediate; PvP from the victim's confirmation). */
  private confirm(run: CastRun | null, hit: HitEvent, target: string, at: V3, damage: number, idx: number, comboId: number, reaction: string, ends: boolean, tz: number, crit = false): void {
    const s = run?.skill;
    if (!s) return;
    if (run && run.confirmedAt < 0) run.confirmedAt = run.elapsed;
    if (run && run.own && this.passives.orbs && damage > 0) { // Combo Force: one orb per skill that connects
      if (this.orbs.cast !== run.castId) { this.orbs.cast = run.castId; this.orbs.n = Math.min(ORBS.max, this.orbs.n + 1); }
      this.orbs.lastAt = this.simMs;
    }
    if (run?.own && s.cls === 'book_mage' && damage > 0) this.weaveHit(run);
    this.fx!.confirmed(s, hit, at, damage, reaction, true, idx, crit, run ? this.hitFrom(run, hit) : undefined);
    if (damage > 0) { // your hit on another fighter: it shudders through the hit-stop (fighting-game feel)
      const sh = Math.max(90, Math.min(220, this.fx!.hitStopLeft + 60));
      if (target === BOT_ID) this.bot?.view.shake(sh); else this.pvp?.remotes.get(target)?.shake(sh);
    }
    if (run?.own && damage > 0 && this.kage?.isAmbush(run.castId)) this.kageAmbush(at, target);
    const same = this.combo.comboId === comboId && this.combo.target === target;
    const mob = target.startsWith('mob:') ? this.mobById(target) : undefined;
    const max = mob ? mob.maxHp : target === 'enemy' ? (this.enemy?.maxHp ?? 1) : target === 'dummy' ? D.maxHp : target === BOT_ID ? (this.bot?.body.maxHp ?? PVP.maxHp) : (this.pvp?.remotes.get(target)?.maxHp ?? PVP.maxHp);
    const tb = mob ? mob.body : target === 'enemy' ? this.enemy?.body : target === 'dummy' ? this.dummyState?.body : target === BOT_ID ? this.bot?.body : undefined;
    const state = ends ? 'FINISHER' : tb?.state === 'knockdown' && tb.kdPhase !== 'fall' ? 'DOWN' : tz > 8 || reaction === 'launch' || reaction === 'float' || tb?.state === 'launched' ? 'AERIAL' : 'STAND';
    this.combo = { count: idx, at: this.simMs, comboId, target, label: state, dmg: (same ? this.combo.dmg : 0) + damage, max };
    this.confirmedLog.push({ skill: s.id, target, damage, idx, reaction, at: this.simMs, z: Math.round(tz) });
    if (this.confirmedLog.length > 300) this.confirmedLog.shift();
  }

  /** Enemy (PvE) strike on the local player: Mirage counter first, then the usual reaction rules. */
  private enemyStrike(dmg: number, from: { x: number; y: number }, push = 14): void {
    if (this.dead >= 0 || this.simMs < this.hitBlinkUntil) return; // just hit: untouchable (blinking)
    if (this.inDome()) { this.domeBlock(from); return; }
    if (this.tryCounter(from)) return;
    if (this.tryEvade(from)) return;
    const hit: HitEvent = { at: 0, damage: dmg, shape: { kind: 'sector', range: 58, angle: 120 }, reaction: { stun: 220, push } };
    if (this.mageGuard(hit, from, this.pveBodyNear(from))) return;
    const out = this.body.receive('enemy', ENEMY_SKILL, hit, from, this.simMs);
    if (out.reaction === 'armor' && this.simMs < this.body.invulnUntil) { this.fx!.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 40 }, 'BLOCK!!', '#9ed8ff', 0); this.fx!.shockwave(this.kin.x, this.kin.y, 70, 0x9ed8ff); }
    out.damage = this.takeDamage(out.damage);
    if (out.damage > 0) this.hitBlinkUntil = this.simMs + HIT_IFRAMES;
    this.fx!.confirmed(ENEMY_SKILL, hit, { x: this.kin.x, y: this.kin.y, z: this.kin.z + 30 }, out.damage, out.reaction, false, out.hitIndex);
  }

  /** Mirage counter: a legal strike crossing the body during the window → sidestep + reappearing slash. */
  private tryCounter(from: { x: number; y: number }): boolean {
    const run = this.rt!.counterOpen(this.localId);
    if (!run) return false;
    const k = this.kin, c = run.skill.counter!;
    const away = unit(k.x - from.x, k.y - from.y), side = { x: -away.y, y: away.x };
    let moved = false;
    for (let d = c.behind ?? 0; d >= 26 && !moved; d -= 6) { // the mirage takes the blow: he reappears behind the attacker
      const nx = from.x - away.x * d, ny = from.y - away.y * d;
      if (footAllowed(nx, ny, k.z, R)) { k.x = nx; k.y = ny; moved = true; }
    }
    if (!moved) for (let d = c.sidestep; d > 0; d -= 4) { const nx = k.x + side.x * d, ny = k.y + side.y * d; if (footAllowed(nx, ny, k.z, R)) { k.x = nx; k.y = ny; break; } }
    const u = unit(from.x - k.x, from.y - k.y), aim = sideAim(u.x, u.y, this.dir === 'left' ? -1 : 1); // (side / corner)
    this.aim = aim; this.dir = dirOf(aim.x, aim.y, this.dir);
    this.rt!.triggerCounter(run, aim, { x: k.x, y: k.y, z: k.z });
    this.pvp?.sendCounter({ castId: run.castId, x: Math.round(k.x), y: Math.round(k.y), z: Math.round(k.z), ax: Math.round(aim.x * 1000), ay: Math.round(aim.y * 1000) });
    return true;
  }

  /** PvP victim authority: this client resolved a remote cast against its own body. */
  /** Archer's Hunter's Mark: leaf marks (max 3, 6s) per archer on each foe; some skills spend them for their bonus. Every
   *  client keeps the marks of the hits it is authority for (its own hits on monsters / the bot, others' hits on itself). */
  private marks = new Map<string, { n: number; until: number }>();
  private markHit(run: CastRun, hit: HitEvent, targetId: string): HitEvent {
    if (run.skill.cls !== 'archer' || (!hit.mark && !hit.useMark)) return hit;
    const now = this.simMs, key = `${run.attackerId}>${targetId}`, m = this.marks.get(key), n = m && m.until > now ? m.n : 0;
    let out = hit;
    if (hit.useMark && n > 0) {
      this.marks.delete(key);
      const R = { ...hit.reaction };
      if (hit.useMark === 'launch') R.launch = Math.round((R.launch ?? 0) * (1 + 0.1 * n));
      R.stun = (R.stun ?? 0) + 100 * n; // spent marks hold the foe longer, so the small shots link into the launchers
      if (hit.useMark === 'stun') R.hardCC = { kind: 'stun', ms: 500 + 300 * n, long: true };
      const dm = hit.useMark === 'blast' ? 1 + 0.35 * n : hit.useMark === 'roar' ? 1 + 0.4 * n : 1;
      out = { ...hit, damage: Math.round(hit.damage * dm), reaction: R };
      this.fx?.archerMarkSpend(targetId, n, hit.useMark);
    } else if (hit.mark) {
      const k = Math.min(3, n + hit.mark);
      this.marks.set(key, { n: k, until: now + 6000 });
      this.fx?.archerMark(targetId, k, 6000);
    }
    return out;
  }

  private applyRemoteHitToSelf(run: CastRun, hit: HitEvent, hi: number, at: V3): void {
    if (this.dead >= 0 || this.party?.has(run.attackerId)) return; // party members never hit each other
    if (this.match?.active && !this.match.live) return; // a battle: only the fight counts (not VS / ROUND n / after the K.O.)
    const trial = run.attackerId === BOT_ID && !!this.bot?.trial;   // a Master's trial is the world: hits leave you blinking, untouchable
    if (trial && this.simMs < this.hitBlinkUntil) return;
    if (this.inDome()) { this.domeBlock(this.casterPos(run.attackerId) ?? run.origin); this.pvp?.sendHp(this.playerHP, run.attackerId, { castId: run.castId, skillId: run.skill.id, hit: hi, dmg: 0, rx: 'armor' }); return; }
    const s = run.skill;
    hit = this.mageHit(run, hit); hit = this.markHit(run, hit, this.localId);
    if (hit.damage > 0 && this.mageGuard(hit, this.casterPos(run.attackerId) ?? run.origin, run.attackerId === BOT_ID ? this.bot?.body : undefined)) { this.pvp?.sendHp(this.playerHP, run.attackerId, { castId: run.castId, skillId: s.id, hit: hi, dmg: 0, rx: 'armor' }); return; }
    if (hit.shape.kind !== 'placed' && hit.damage > 0 && this.tryCounter(this.casterPos(run.attackerId) ?? run.origin)) {
      this.pvp?.sendHp(this.playerHP, run.attackerId, { castId: run.castId, skillId: s.id, hit: hi, dmg: 0, rx: 'countered' });
      return;
    }
    if (hit.damage > 0 && this.tryEvade(this.casterPos(run.attackerId) ?? run.origin)) { this.pvp?.sendHp(this.playerHP, run.attackerId, { castId: run.castId, skillId: s.id, hit: hi, dmg: 0, rx: 'armor' }); return; }
    let h = run.dmgMul && run.dmgMul !== 1 ? { ...hit, damage: hit.damage * run.dmgMul } : hit; // caster's War Cry / Radiant Blade
    if (hit.damage > 0 && this.ambushIn.delete(run.castId)) { // a samurai's AMBUSH (Kagemusha): a sure critical and a stun; his doubles burst
      h = { ...h, damage: h.damage * KAGE.ambushMul, reaction: { ...h.reaction, stun: Math.max(h.reaction.stun ?? 0, KAGE.ambushStun) } };
      this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, 'AMBUSH!!', '#ff5a6a', 0);
      this.fx?.samStun(this.localId, KAGE.ambushStun);
      this.pvp?.remotes.get(run.attackerId)?.burstDoubles();
    }
    const out = this.body.receive(run.attackerId, s, h, this.hitFrom(run, hit), this.simMs, run.castId);
    out.damage = this.takeDamage(out.damage);
    if (trial && out.damage > 0) this.hitBlinkUntil = this.simMs + HIT_IFRAMES;
    if (run.attackerId === BOT_ID) this.logHit(false, s, out, this.body, this.kin.z);
    if (out.rx) this.fx?.mageReaction(out.rx, { x: this.kin.x, y: this.kin.y, z: this.kin.z + 40 }, this.localId, out.rxMs);
    this.fx!.confirmed(s, hit, at, out.damage, out.reaction, false, out.hitIndex, false, this.hitFrom(run, hit));
    if (this.arena && out.damage > 0) { // the arena: a hit lands on you — a beat of hit-stop, your body shudders, heavy ones shake the screen
      const heavy = !!hit.heavy || out.reaction === 'launch' || out.reaction === 'knockdown' || s.slot === 7;
      this.fx!.hitStopLeft = Math.max(this.fx!.hitStopLeft, heavy ? 110 : 60);
      this.selfShakeUntil = this.simMs + (heavy ? 170 : 110);
      if (heavy) this.cameras.main.shake(150, 0.005);
    }
    if (s.carry && out.reaction !== 'armor' && out.damage > 0) this.carriedBy = run; // Impaling Rush: ride the blade
    this.pvp?.sendHp(this.playerHP, run.attackerId, {
      castId: run.castId, skillId: s.id, hit: hi, dmg: out.damage, idx: out.hitIndex, cid: out.comboId, rx: out.reaction, ends: out.endsCombo, vz: Math.round(this.kin.vz), z: Math.round(this.kin.z),
      ...(out.rx ? { mx: out.rx, mms: Math.round(out.rxMs ?? 0) } : {}),
    });
    if (this.playerHP === 0) this.pvp?.sendDeath(run.attackerId);
  }

  /** World damage varies like MapleStory's: between the stats' minimum (mastery) and maximum. */
  private dmgRoll(): number { return this.arena ? 1 : STAT_MASTERY + (1 - STAT_MASTERY) * Math.random(); }

  private saveStats(): void {
    const ch = this.character; if (!ch) return;
    ch.stats = { ...this.stats }; CharacterStore.setStats(ch.id, this.stats);
    this.statD = derive(this.stats, this.cls, ch.level); this.applyPassives(); this.refreshStats();
  }
  private addStat(k: StatKey): void { const ch = this.character; if (!ch || freeAp(this.stats, ch.level) <= 0) return; this.stats[k]++; this.saveStats(); }
  private autoStats(): void { const ch = this.character; if (!ch) return; this.stats = autoAssign(this.stats, this.cls, ch.level); this.saveStats(); }
  private subStat(k: StatKey): void { if (this.stats[k] <= BASE_STAT) return; this.stats[k]--; this.saveStats(); } // free: points move at will
  private resetStats(): void { if (!this.character) return; this.stats = baseStats(); this.saveStats(); }

  /** The stat window's numbers, from what the character is right now. */
  /** His job's name now (Beginner until a Master gives one). */
  private jobTitle(): string { const ch = this.character; return ch && hasJob(ch) ? (jobsFor(this.cls).filter((j) => skillLevel(ch) >= j.level).pop()?.name ?? 'Beginner') : 'Beginner'; }

  private refreshStats(): void {
    const ch = this.character; if (!ch || !this.statsWin) return;
    const basic = this.kit[0], hits = basic ? (basic.chain ? basic.chain.stages[0] : basic.hits) : [];
    const base = hits.reduce((n, h) => n + h.damage, 0) * this.ownDamageMul();
    const hp = this.maxHpNow(), pct = (v: number) => `${Math.round(v * 100)}%`;
    const crit = 0.12 + this.critAddNow(), ev = this.passives.evade + this.statD.evadeAdd;
    const job = this.jobTitle();
    const spd = this.passives.moveMul * (this.simMs < this.hasteUntil ? 1.2 : 1) * (this.simMs < this.itemSpeedUntil ? 1.1 : 1), jmp = this.passives.jumpMul;
    this.statsWin.render({
      name: ch.name, job, level: ch.level, expPct: Number.isFinite(expToNext(ch.level)) ? Math.min(100, ((ch.exp ?? 0) / expToNext(ch.level)) * 100) : undefined, stats: this.stats, ap: freeAp(this.stats, ch.level), main: mainStats(this.cls)[0], canReset: STAT_KEYS.some((s) => this.stats[s] > BASE_STAT),
      combat: [
        ['Attack Range', `${Math.max(1, Math.round(base * STAT_MASTERY))} ~ ${Math.max(1, Math.round(base))}`],
        ['Max HP', `${Math.round(Math.min(this.playerHP, hp))} / ${hp}`],
        ['Max MP', `${Math.round(this.mp)} / ${this.maxMpNow()}`],
        ['Weapon Attack', String(this.gearSt.att)],
        ['Defense', `${this.gearSt.def}  (−${Math.round((1 - takenMul(this.gearSt)) * 100)}% damage)`],
        ['Stat Power', `${this.statD.statValue}  (×${this.statD.dmgMul.toFixed(2)})`],
        ['Critical Rate', `${pct(crit)}  (skills)`],
        ['Critical Damage', `${Math.round((1.5 + this.critDmgNow()) * 100)}%`],
        ['Attack Speed', `${Math.round(this.ownSpeedMul(basic) * 100)}%`, this.ownSpeedMul(basic) > 1],
        ['Evasion', pct(ev)],
        ['Speed', `${Math.round(spd * 100)}%`, spd > 1],
        ['Jump', `${Math.round(jmp * 100)}%`, jmp > 1],
      ],
    });
  }

  /** Equipment changed (inventory): its stats, the pieces drawn on the character, what other players see. */
  private onGearChange(g: GearState): void {
    this.gearSt = gearStats(g); this.gearCode = wornCode(wornLook(g));
    this.view?.setGear(wornLook(g), genderOf(this.character));
    this.refreshStats();
    buildLook(this, this.character); // the portrait in what is worn now
    this.pvp?.forceState();
  }

  /** Returns the damage actually taken (the worn equipment's defence and Iron Body cut it). */
  private takeDamage(raw: number): number {
    if (this.dead >= 0 || raw <= 0) return 0;
    let dmg = Math.max(1, Math.round(raw * this.passives.takenMul * takenMul(this.gearSt) * (this.simMs < this.bannerUntil ? 0.9 : 1)));
    dmg = this.wardAbsorb(dmg); if (dmg <= 0) return 0;
    if (!(this.arena && PVP.hpLocked)) this.playerHP = Math.max(0, this.playerHP - dmg); // (testing: the arena's HP stays)
    this.flash = 0;
    this.kage?.end('fade'); // struck: the doubles vanish at once
    if (this.playerHP === 0) this.killPlayer();
    return dmg;
  }

  /** Buffs end (death, a new battle round). */
  private endBuffs(): void {
    this.oathUntil = -1; this.bannerUntil = -1; this.allyCryUntil = -1; this.spiritUntil = -1; this.hasteUntil = -1; this.tree = null; this.storm = null; this.resolveUntil = -1;
    this.sunUntil = -1; this.godUntil = -1; this.fx?.clearHalo(this.localId); this.fx?.clearSun(this.localId); this.kage?.clear(); this.mageReset(); this.fx?.clearMage(this.localId);
  }

  private killPlayer(): void {
    this.endBuffs(); // buffs end on death
    this.rt?.cancelOwn('death');
    if (this.jb) { const jbs = this.kit.find((x) => x.id === 'judgment_blade'); if (jbs) this.rt?.closeCharges({ id: jbs.id, cooldown: jbs.cooldown * this.cdMul(jbs) }); this.jb = null; this.jbWant = 0; }
    this.ci?.reset();
    this.kin.vx = 0; this.kin.vy = 0;
    this.dead = 0;
    this.body.state = 'dead';
    this.setMode('dead');
    this.deathFx?.start(this.kin.x, this.kin.y, this.kin.z - this.kin.supportZ, this.dir === 'left');
    if (this.match?.active) { this.match.death(this.localId); return; } // a battle round: K.O. (no respawn: the next round stands you up)
    this.hud?.banner('DEFEATED', this.pvp ? PVP.respawnMs : P6.deathFadeMs + P6.deathPauseMs);
  }

  private updateDeath(): void {
    if (this.pvp) { if (this.match?.active) return; if (this.dead >= PVP.respawnMs) this.respawnPvp(); return; } // battle: down until the next round
    if (this.dead >= P6.deathFadeMs + P6.deathPauseMs) {
      if (this.world) { // the open world: you wake up in town
        if (this.dead < 1e8) { this.dead = 1e9; this.world.jumpTo(START.area, START.x, START.y, this.kin, () => { const p = this.kin; this.respawnAt(p.x, p.y, this.maxHpNow()); }); }
        return;
      }
      this.respawnAt(WORLD.spawn.x, WORLD.spawn.y, this.maxHpNow());
      if (this.enemy?.alive) this.enemy.reset();
    }
  }

  private respawnAt(x: number, y: number, hp: number): void {
    const k = this.kin;
    k.x = x; k.y = y; k.z = 0; k.vx = 0; k.vy = 0; k.vz = 0; k.grounded = true; k.supportZ = 0;
    this.body.reset(); this.mp = this.maxMpNow();
    this.playerHP = hp; this.dead = -1; this.flash = -1; this.hitBlinkUntil = -1; this.setMode('idle'); this.deathFx?.stop();
    this.ci?.reset();
  }

  private respawnPvp(): void {
    const sp = this.freeSpawnPoint();
    this.respawnAt(sp.x, sp.y, PVP.maxHp);
    this.pvp?.sendRespawn(sp.x, sp.y, this.playerHP);
  }

  // ======================================================================= PvP sparring NPC

  /** The sparring knight joins when you are alone in the room and leaves as soon as a real player is there. */
  private updateBot(ms: number, now: number): void {
    if (!this.pvp || !this.pvpReady) { this.updateTrial(ms, now); return; }
    if (this.pvp.remotes.size > 0) {
      if (this.bot) { this.rt?.cancelAttacker(BOT_ID); this.bot.destroy(); this.bot = undefined; this.refreshSparUi(); this.chat?.add({ kind: 'system', text: `${this.botName()} left the arena.` }); }
      this.botAwayMs = 0; this.waitFoe = false;
      return;
    }
    if (!this.bot) {
      this.botAwayMs += ms;
      if (this.botAwayMs < (this.waitFoe ? PVP.foeWaitMs : 1200)) return;
      this.waitFoe = false;
      const k = this.kin, pts = PVP.spawnPoints.filter((p) => footAllowed(p.x, p.y, 0, R));
      const sp = pts.reduce((best, p) => (Math.hypot(p.x - k.x, p.y - k.y) > Math.hypot(best.x - k.x, best.y - k.y) && Math.hypot(p.x - k.x, p.y - k.y) < 700 ? p : best), pts[0]);
      this.spawnBot(sp.x, sp.y, now);
      this.chat?.add({ kind: 'system', text: `${this.botName()} entered the arena (sparring partner while you are alone).` });
    }
    const bot = this.bot!;
    if (this.sparUi) this.sparUi.combo.disabled = bot.comboRunning || this.dead >= 0;
    if (this.botBreakAt > 0 && now >= this.botBreakAt) { this.botBreakAt = 0; if (bot.body.canBreak(now)) this.botBreak(); }
    const bd = this.kage?.decoyFor(bot); // Kagemusha: the knight goes after a double
    bot.update(ms, { now, player: bd ? { x: bd.x, y: bd.y, z: this.kin.z - this.kin.supportZ, alive: true } : { x: this.kin.x, y: this.kin.y, z: this.kin.z - this.kin.supportZ, alive: this.dead < 0, guard: this.body.ghost(now) } });
  }

  private botName(): string { return this.bot?.trial?.name ?? BOT_NAMES[this.botCls] ?? BOT_NAME; }

  // ======================================================================= the Masters' trial (1st job)

  /** A Master's trial is pending: he waits in the Sun Seal Plaza and fights you there (only while you are down in it);
   *  you fall: he is whole again for your next try; you beat him: the trial is passed. */
  private updateTrial(ms: number, now: number): void {
    const ch = this.character;
    if (!this.world || !ch?.trial || this.arena) return;
    if (!this.bot) {
      if (!this.rt) return;
      const m = Object.values(WORLD_AREAS).flatMap((a) => a.npcs ?? []).find((n) => n.job === ch.trial);
      const c = { x: PLAZA.x + PLAZA.w * 0.5, y: PLAZA.y + PLAZA.h * 0.42 };
      this.bot = new SparringBot(this, c.x, c.y, {
        cast: (skill, stage, origin, aim, place, lock) => { this.rt?.start({ castId: `${BOT_ID}-${++this.botSeq}`, skill, stage, attackerId: BOT_ID, own: false, origin, aim, place, lock: lock ? this.localId : null }); },
        cancel: () => { for (const r of this.rt?.runs ?? []) if (r.attackerId === BOT_ID && (r.phase === 'startup' || r.phase === 'active')) r.phase = 'done'; },
      }, now, ch.trial, { name: m?.name ?? 'Master', hp: TRIAL_HP, centre: c });
      this.chat?.add({ kind: 'system', text: `${this.botName()} awaits you in the Sun Seal Plaza, down the great stairs. Defeat him to complete your trial.` });
    }
    const bot = this.bot;
    const inPlaza = this.kin.y >= PLAZA.y - 40 && this.dead < 0;
    if (this.dead >= 0 && bot.hp < TRIAL_HP) { bot.hp = TRIAL_HP; bot.view.setHp(TRIAL_HP); } // you fell: he is whole again
    bot.paused = !inPlaza;
    if (!inPlaza) this.rt?.cancelAttacker(BOT_ID);
    const bd = this.kage?.decoyFor(bot); // Kagemusha: the knight goes after a double
    bot.update(ms, { now, player: bd ? { x: bd.x, y: bd.y, z: this.kin.z - this.kin.supportZ, alive: true } : { x: this.kin.x, y: this.kin.y, z: this.kin.z - this.kin.supportZ, alive: this.dead < 0 } });
    if (bot.defeated) this.winTrial();
  }

  private winTrial(): void {
    const ch = this.character, bot = this.bot; if (!ch || !bot) return;
    const name = this.botName(), job = jobsFor(ch.trial ?? ch.classId)[1]?.name ?? 'Adventurer';
    this.fx?.callout({ x: bot.x, y: bot.y, z: 90 }, 'TRIAL COMPLETE', '#ffd34a', 0);
    this.fx?.shockwave(bot.x, bot.y, 220, 0xffd27a);
    this.rt?.cancelAttacker(BOT_ID); bot.destroy(); this.bot = undefined;
    const set = JOB_SET[ch.trial ?? ''] ?? [];   // the Master's reward: his job's set, worn at once
    this.giveItem('red_potion', 30); this.giveItem('blue_potion', 15); this.chat?.add({ kind: 'system', text: 'Received: Red Potion ×30, Blue Potion ×15' });
    if (set.length) { let g = CharacterStore.getGear(ch.id) ?? starterGear(ch.look); for (const id of set) g = giveItem(g, id, true); CharacterStore.setGear(ch.id, g); ch.gear = CharacterStore.getGear(ch.id) ?? g; this.onGearChange(ch.gear); }
    CharacterStore.clearTrial(ch.id); delete ch.trial;
    this.hud?.banner(job.toUpperCase(), 2200, false);
    this.chat?.add({ kind: 'system', text: `${name}: "Well fought. You are a true ${job} now. Take my gear — it is yours."` });
  }

  /** A Master: from level 10 he gives a Beginner his job (and his trial below in the plaza). */
  private masterTalk(n: AreaNpc, say: (lines: string[], choices?: DialogChoice[]) => void): void {
    const ch = this.character, job = n.job!;
    const jobName = jobsFor(job)[1]?.name ?? job;
    if (!ch) { say(n.lines ?? IDLE_LINES); return; }
    if (hasJob(ch)) {
      if (ch.trial === job) say(['Your trial awaits in the Sun Seal Plaza, down the great stairs.', 'Come — show me what you have learned.']);
      else if (playedClass(ch) === job) say(['You walk my path well.', 'Keep growing stronger.']);
      else say(n.lines?.length ? n.lines : IDLE_LINES);
      return;
    }
    if (!JOBS_OPEN.has(job)) { say([...(n.lines ?? []).slice(0, 1), 'My path is not open to new students yet.']); return; }
    if (ch.level < BEGINNER_TO) { say([...(n.lines ?? []).slice(0, 1), `You are not ready yet. Reach level ${BEGINNER_TO}, then come back to me.`]); return; }
    say([...(n.lines ?? []).slice(0, 1), `You have grown strong. I can teach you the path of the ${jobName}.`, 'Take my path, and face me in the Sun Seal Plaza below. Defeat me, and my gear is yours. Will you?'],
      [{ label: `BECOME A ${jobName.toUpperCase()}`, main: true, run: () => this.takeJob(n) }, { label: 'NOT YET', run: () => undefined }]);
  }

  private takeJob(n: AreaNpc): void {
    const ch = this.character; if (!ch || !n.job) return;
    const jobName = jobsFor(n.job)[1]?.name ?? n.job;
    CharacterStore.setJob(ch.id, n.job, n.job);
    ch.job = n.job; ch.classId = n.job; ch.trial = n.job;
    const k = this.kin;
    this.fx?.callout({ x: k.x, y: k.y, z: k.z + 60 }, `1ST JOB: ${jobName.toUpperCase()}`, '#ffd34a', 0);
    this.fx?.shockwave(k.x, k.y, 200, 0xffd27a);
    this.chat?.add({ kind: 'system', text: `You are now a ${jobName}. Your 1st job skills are open.` });
    this.time.delayedCall(1600, () => this.scene.restart({ pvpRoom: null, at: { x: this.kin.x, y: this.kin.y } })); // plays as his new class, right where he stands
  }

  /** Sparring partner of the chosen class (keeps STOP when it is swapped). */
  private spawnBot(x: number, y: number, now: number): void {
    const paused = this.bot?.paused ?? this.botPaused;
    if (this.match?.opponent === BOT_ID) this.match.abort(); // a new opponent: a new match
    if (this.bot) { this.rt?.cancelAttacker(BOT_ID); this.bot.destroy(); }
    this.bot = new SparringBot(this, x, y, {
      cast: (skill, stage, origin, aim, place, lock) => { this.rt?.start({ castId: `${BOT_ID}-${++this.botSeq}`, skill, stage, attackerId: BOT_ID, own: false, origin, aim, place, lock: lock ? this.localId : null }); },
      cancel: () => { for (const r of this.rt?.runs ?? []) if (r.attackerId === BOT_ID && (r.phase === 'startup' || r.phase === 'active')) r.phase = 'done'; },
    }, now, this.botCls);
    this.bot.paused = paused;
    this.bot.duel = true; // battle mode: the knight can be knocked out (its entrance is the battle's VS)
    this.bot.body.arena = true; // the same duel rules as the players
    this.refreshSparUi();
  }

  /** Arena sparring controls: opponent class, STOP / RESUME, COMBO (it performs its combo on you). */
  private buildSparUi(): void {
    const host = this.hud?.overlay; if (!host || this.sparUi) return;
    if (!document.getElementById('gol-spar-style')) {
      const st = document.createElement('style'); st.id = 'gol-spar-style';
      st.textContent = `
.gol-spar{position:absolute;left:1602px;top:184px;width:300px;display:none;flex-direction:column;gap:10px;padding:14px 16px 16px;box-sizing:border-box;pointer-events:auto;
  background:linear-gradient(rgba(6,10,18,.84),rgba(6,10,18,.7));border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.45),inset 0 0 0 1px rgba(201,154,69,.5);font-family:${FONT_FAMILY}}
.gol-spar.on{display:flex}
.gol-spar .hd{font:700 12px ${FONT_FAMILY};letter-spacing:2.5px;color:#f3d58a;text-shadow:0 1px 2px #000}
.gol-spar .cl{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.gol-spar button{height:32px;border-radius:7px;border:1px solid #6a5630;background:#0b121b;color:#c9b48a;font:700 12px ${FONT_FAMILY};letter-spacing:1.2px;cursor:pointer;text-shadow:0 1px 2px #000}
.gol-spar button:hover{border-color:#c99a45;box-shadow:0 0 10px rgba(232,178,90,.35)}
.gol-spar button.on{border-color:#e8b25a;background:linear-gradient(#3a2a10,#22180a);color:#ffe7a8}
.gol-spar .act{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gol-spar .act button{height:40px;font-size:14px;letter-spacing:2px}
.gol-spar .act .stop.on{border-color:#d9583f;background:linear-gradient(#4a1410,#2a0a08);color:#ffd2c4}
.gol-spar .act .cmb{border-color:#c99a45;background:linear-gradient(#3a2a10,#22180a);color:#ffe7a8}
.gol-spar .act .cmb:disabled{opacity:.45;cursor:default;box-shadow:none}
.gol-spar .spd{display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:6px;align-items:center}
.gol-spar .spd span{font:700 11px ${FONT_FAMILY};letter-spacing:2px;color:#bfb08e;padding-right:4px}
.gol-spar .spd button{height:28px}
.gol-spar .tg{display:grid;grid-template-columns:2fr 3fr;gap:8px}
.gol-spar .tog{height:30px;padding:0 10px;letter-spacing:1px;white-space:nowrap}
.gol-hitlog{position:absolute;left:1602px;top:484px;width:300px;max-height:420px;overflow:hidden;display:none;flex-direction:column;gap:4px;padding:10px 10px 12px;box-sizing:border-box;pointer-events:none;
  background:linear-gradient(rgba(6,10,18,.82),rgba(6,10,18,.62));border-radius:12px;box-shadow:inset 0 0 0 1px rgba(201,154,69,.35);font-family:${FONT_FAMILY}}
.gol-hitlog.on{display:flex}
.gol-hitlog .ln{display:grid;grid-template-columns:auto 1fr auto;column-gap:8px;row-gap:1px;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,.04);font-size:12px;line-height:15px}
.gol-hitlog .ln.o{box-shadow:inset 3px 0 0 #e8b25a}
.gol-hitlog .ln.i{box-shadow:inset 3px 0 0 #e0503c}
.gol-hitlog .ln b{font-weight:700;color:#f3d58a;white-space:nowrap}
.gol-hitlog .ln.i b{color:#ff9a86}
.gol-hitlog .ln .sk{color:#efddb0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-hitlog .ln .dm{font-weight:700;color:#fff;text-align:right}
.gol-hitlog .ln .rx{grid-column:1/4;font-weight:700;letter-spacing:1px;color:#9ed8ff;font-size:11px}
.gol-hitlog .ln .sub{grid-column:1/4;color:#a9b4bf;font-size:10.5px;line-height:13px}`;
      document.head.appendChild(st);
    }
    const root = document.createElement('div'); root.className = 'gol-spar'; host.appendChild(root);
    root.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    const hd = document.createElement('div'); hd.className = 'hd'; hd.textContent = 'SPARRING OPPONENT'; root.appendChild(hd);
    const cl = document.createElement('div'); cl.className = 'cl'; root.appendChild(cl);
    const classes: [string, string][] = [['warrior', 'WARRIOR'], ['samurai', 'SAMURAI'], ['book_mage', 'MAGE'], ['archer', 'ARCHER']];
    const clsBtns = classes.map(([id, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => { if (this.botCls === id) return; this.botCls = id; const bt = this.bot; if (bt) this.spawnBot(bt.x, bt.y, this.simMs); this.refreshSparUi(); });
      cl.appendChild(b); return { id, b };
    });
    const act = document.createElement('div'); act.className = 'act'; root.appendChild(act);
    const stop = document.createElement('button'); stop.type = 'button'; stop.className = 'stop';
    stop.addEventListener('click', () => { this.botPaused = !this.botPaused; if (this.bot) { this.bot.paused = this.botPaused; if (this.botPaused) this.rt?.cancelAttacker(BOT_ID); } this.refreshSparUi(); });
    const combo = document.createElement('button'); combo.type = 'button'; combo.className = 'cmb'; combo.textContent = 'COMBO'; // not '.combo': the HUD uses that class
    combo.title = 'The opponent performs its full combo on you';
    combo.addEventListener('click', () => { if (this.bot?.startCombo()) this.fx?.callout({ x: this.bot.x, y: this.bot.y, z: 70 }, 'COMBO!', '#ffd27a', 0); this.refreshSparUi(); });
    act.append(stop, combo);
    const spd = document.createElement('div'); spd.className = 'spd'; root.appendChild(spd);
    const sl = document.createElement('span'); sl.textContent = 'SPEED'; spd.appendChild(sl);
    const speedBtns = ([[1, '×1'], [0.5, '×½'], [0.25, '×¼']] as const).map(([v, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = 'Slow motion to study the hits and reactions';
      b.addEventListener('click', () => { this.slowMo = v; this.time.timeScale = v; this.tweens.timeScale = v; this.refreshSparUi(); });
      spd.appendChild(b); return { v, b };
    });
    const tg = document.createElement('div'); tg.className = 'tg'; root.appendChild(tg);
    const log = document.createElement('button'); log.type = 'button'; log.className = 'tog'; log.textContent = 'HIT LOG';
    log.title = 'Every hit: skill, damage, reaction, stun, launch, combo and combo-protection gauges';
    log.addEventListener('click', () => { this.logEl?.classList.toggle('on'); this.refreshSparUi(); });
    const nocd = document.createElement('button'); nocd.type = 'button'; nocd.className = 'tog'; nocd.textContent = 'NO COOLDOWN';
    nocd.title = 'Your skills have no cooldown (sparring only)';
    nocd.addEventListener('click', () => { this.noCd = !this.noCd; if (this.noCd) this.rt?.resetCooldowns(); this.refreshSparUi(); });
    tg.append(log, nocd);
    this.logEl = document.createElement('div'); this.logEl.className = 'gol-hitlog'; host.appendChild(this.logEl);
    this.sparUi = { root, clsBtns, stop, combo, speedBtns, log, nocd };
    this.refreshSparUi();
  }

  /** Hit log line: who hit whom with what, and exactly how the victim's body reacted. */
  private logHit(mine: boolean, s: FinalSkill, out: HitOutcome, vb: CombatBody, z: number): void {
    const el = this.logEl; if (!el) return;
    const sum = mine ? this.logSum.out : this.logSum.in;
    if (sum.combo !== out.comboId) { sum.combo = out.comboId; sum.hits = 0; sum.dmg = 0; }
    sum.hits++; sum.dmg += out.damage;
    const g = vb.gauge, pct = (v: number) => `${Math.round(v * 100)}%`;
    const rx: Record<string, string> = { hit: 'HIT-STUN', launch: 'LAUNCH', knockdown: 'KNOCKDOWN', cc: 'HARD CC', armor: 'BLOCKED', slam: 'SLAM', float: 'AIR HOLD' };
    const row = document.createElement('div'); row.className = `ln ${mine ? 'o' : 'i'}`;
    const extra = [out.stunMs ? `stun ${out.stunMs}ms` : '', out.ccMs ? `cc ${out.ccMs}ms` : '', out.launchVz > 0 ? `up ${Math.round(out.launchVz)}` : '', z > 8 ? `air ${Math.round(z)}px` : '', out.endsCombo ? 'ENDS' : ''].filter(Boolean).join(' · ');
    row.innerHTML = '<b></b><span class="sk"></span><span class="dm"></span><span class="rx"></span><div class="sub"></div>';
    (row.children[0] as HTMLElement).textContent = `${mine ? 'YOU ▶' : '◀ ' + this.botName().split(' ')[1]?.toUpperCase()} #${out.hitIndex}`;
    (row.children[1] as HTMLElement).textContent = s.name;
    (row.children[2] as HTMLElement).textContent = `${out.damage}`;
    (row.children[3] as HTMLElement).textContent = rx[out.reaction] ?? out.reaction;
    (row.children[4] as HTMLElement).textContent = `${extra ? extra + '  |  ' : ''}combo ${sum.hits} hits · ${sum.dmg} dmg  |  gauge S ${pct(g.stand)} A ${pct(g.air)} D ${pct(g.down)}`;
    el.prepend(row);
    while (el.childElementCount > 40) el.lastElementChild?.remove();
  }

  private refreshSparUi(): void {
    const u = this.sparUi; if (!u) return;
    u.root.classList.toggle('on', !!this.bot);
    for (const c of u.clsBtns) c.b.classList.toggle('on', c.id === this.botCls);
    u.stop.textContent = this.botPaused ? 'RESUME' : 'STOP';
    for (const sb of u.speedBtns) sb.b.classList.toggle('on', sb.v === this.slowMo);
    u.log.classList.toggle('on', !!this.logEl?.classList.contains('on'));
    u.nocd.classList.toggle('on', this.noCd);
    if (!this.bot) this.logEl?.classList.remove('on');
    u.stop.classList.toggle('on', this.botPaused);
    u.stop.title = this.botPaused ? 'The opponent fights again' : 'The opponent stands still (it still takes hits)';
  }

  /** The local player's confirmed hit on the sparring NPC (this client is its authority; PvP reaction rules). */
  private applyToBot(run: CastRun, hit: HitEvent, t: HitTarget, at: V3): void {
    const b = this.bot;
    if (!b || b.defeated || (this.match?.active && !this.match.live)) return;
    hit = this.mageHit(run, hit); hit = this.markHit(run, hit, t.id);
    const chB = run.attackerId === this.localId ? this.chanceMul(b.body) : 1;
    const m = run.attackerId === this.localId ? this.ownDamageMul(run.skill) * chB : 1, h = m !== 1 ? { ...hit, damage: hit.damage * m } : hit;
    const out = b.receive(run.attackerId, run.skill, h, this.hitFrom(run, h), this.simMs, run.castId);
    this.logHit(true, run.skill, out, b.body, b.kin.z);
    this.mageReact(run, out, BOT_ID, at);
    if (chB > 1 && out.damage > 0) this.chanceMark(BOT_ID, at);
    if (b.refilled) this.fx!.healNumber({ x: b.x, y: b.y, z: b.z }, b.refilled);
    this.confirm(run, hit, BOT_ID, at, out.damage, out.hitIndex, out.comboId, out.reaction, !!run.skill.endsCombo, t.z);
    if (out.reaction !== 'armor') this.finalAttack(run, BOT_ID, at, out.damage);
    if (b.defeated) { this.rt?.cancelAttacker(BOT_ID); b.knockOut(); this.match?.death(BOT_ID); } // a battle round: the knight is down
    else if (!this.botBreakAt && b.duel && b.body.canBreak(this.simMs) && (b.body.combos.live(this.simMs)?.hits ?? 0) >= 4 && Math.random() < 0.3)
      this.botBreakAt = this.simMs + 160 + Math.random() * 220; // the knight breaks out of your combo now and then
  }

  // ======================================================================= PvP

  private startPvp(room: string, meta: PeerMeta): void {
    this.hud?.setStatus('CONNECTING…');
    const pvp = new PvpController(this, room, meta, {
      onJoined: () => {
        const sp = this.freeSpawnPoint();
        this.kin.x = sp.x; this.kin.y = sp.y;
        this.view!.setVisible(true);
        this.pvpReady = true;
        this.hud?.setStatus(null);
      },
      onFull: () => this.hud?.setStatus('ROOM FULL'),
      onError: () => this.hud?.setStatus('CONNECTION FAILED'),
      onCast: (from, m) => this.receiveCast(from, m),
      onCounter: (from, m) => {
        const r = this.rt?.runs.find((x) => x.castId === m.castId && x.attackerId === from);
        if (r) { this.pvp?.remotes.get(from)?.teleport(m.x, m.y, m.z); this.rt!.triggerCounter(r, { x: m.ax / 1000, y: m.ay / 1000 }, { x: m.x, y: m.y, z: m.z }); } // (he reappears there at once)
      },
      onRelease: (from, m) => { // Judgment Blade thrown: final aim + the moment it left the hand
        const r = this.rt?.runs.find((x) => x.castId === m.castId && x.attackerId === from);
        if (r && r.skill.id === 'arrow_storm' && m.at === -2) { r.place = { x: m.ax, y: m.ay }; return; } // Hunter's Rain: the caster moved the mark
        if (r && AIM_STEER.has(r.skill.id) && m.at === -1) { r.aim = r.skill.id === 'piercing_arrow' ? unit(m.ax, m.ay) : sideAim(m.ax / 1000, m.ay / 1000, m.ax < 0 ? -1 : 1); return; } // Volley Stance / Spirit Bow / Eagle Tide: the caster turned the aim
        if (r && r.phase === 'startup') { r.aim = clampAim(unit(m.ax, m.ay)); r.timings.startup = Math.max(r.elapsed, m.at); }
        this.pvp?.remotes.get(from)?.setSkillStartup(r?.skill.id ?? '', r ? r.timings.startup : m.at);
      },
      onConfirmed: (victim, m) => {
        if (m.by !== this.localId || !m.skillId || m.dmg === undefined || m.rx === 'countered') return;
        const s = finalSkill(m.skillId);
        if (!s) return;
        const hits = s.chain ? s.chain.stages.flat() : s.hits;
        const run = this.rt?.runs.find((r) => r.castId === m.castId) ?? ({ skill: s, confirmedAt: 0, elapsed: 0 } as unknown as CastRun);
        const r = this.pvp?.remotes.get(victim);
        const at = r ? { x: r.x, y: r.y, z: (m.z ?? r.z) + 40 } : { x: 0, y: 0, z: 0 };
        this.confirm(run, hits[m.hit ?? 0] ?? hits[0], victim, at, m.dmg, m.idx ?? 1, m.cid ?? 0, m.rx ?? 'hit', !!m.ends, m.z ?? 0);
        if (m.mx) { this.fx?.mageReaction(m.mx, at, victim, m.mms ?? 0); if (m.mx === 'curse') r?.paper(m.mms ?? 0); }
      },
      onRemoteLeft: (id) => { this.party?.dropped(id); this.rt?.cancelAttacker(id); this.bubbles?.clear(id); this.chat?.add({ kind: 'system', text: `${this.nameOf(id)} left the arena.` }); },
      onRemoteJoined: (id) => this.chat?.add({ kind: 'system', text: `${this.nameOf(id)} entered the arena.` }),
      onRemoteDeath: (id, by) => { this.match?.death(id); this.chat?.add({ kind: 'system', text: `${this.nameOf(id)} was defeated by ${this.nameOf(by)}.` }); },
      onMatch: (from, m) => { if (this.duelOpponent() === from) { this.matchHeard = performance.now(); this.match?.apply(from, m); } },
      onRematch: (from, m) => { this.match?.rematch(from, m.mid); this.refreshRematch(); },
      onBreak: (from, m) => { this.breakFx(m.x, m.y, m.z); this.oppBreakAt = this.simMs; if (this.combo.target === from) this.combo.at = -Infinity; },
      onChat: (from, m) => this.receiveChat(from, m),
      onParty: (m) => this.party?.receive(m),
      getLocal: () => {
        if (!this.view || !this.pvpReady) return null;
        const k = this.kin, dead = this.dead >= 0;
        const cos = [...Object.entries(this.equipped).filter(([, v]) => v).map(([s, v]) => `${s}:${v}`), `gear:${this.gearCode}`].join(','); // + what is worn
        return { x: k.x, y: k.y, z: k.z, sz: k.supportZ, dir: this.dir, anim: dead ? 'dead' : this.mode, mode: this.mode, sp: Math.hypot(k.vx, k.vy), vz: k.vz, ax: this.aim.x, ay: this.aim.y, hp: this.playerHP, alive: !dead, cos, mhp: this.maxHpNow(), iv: this.body.ghost(this.simMs), kg: this.kage?.code(k), a2: this.air2() };
      },
    });
    this.pvp = pvp;
    this.party = new Party(meta.playerId, {
      send: (m) => pvp.sendParty(m), nameOf: (id) => pvp.nameOf(id),
      notice: (text) => this.chat?.add({ kind: 'system', text }),
      invited: (from) => this.chat?.add({ kind: 'system', text: `${pvp.nameOf(from)} invites you to a party.` }),
      buff: (from, id, ms) => this.receivePartyBuff(from, id, ms),
      changed: () => { this.partyTick = 1e9; },
    });
    void pvp.join();
  }

  /** Remote cast intent: validated (class, cooldown, origin near the caster, legal placement), then simulated here. */
  private receiveCast(from: string, m: Extract<NetMsg, { t: 'cast' }>): void {
    const r = this.pvp?.remotes.get(from), s = finalSkill(m.skillId);
    if (!r || !r.alive || !s || s.cls !== r.meta.classId || this.seenCasts.has(m.castId)) return;
    // Cooldown check: at most `charges` casts (1 for most skills) inside one cooldown window.
    const key = `${from}:${s.id}`, recent = (this.remoteCasts.get(key) ?? []).filter((t) => this.simMs - t < s.cooldown - CAST_COOLDOWN_TOLERANCE_MS);
    if (s.cooldown > 0 && recent.length >= (s.charges ?? 1)) return;
    const last = r.latest; // (the drawn body is ~100 ms behind: right after a dash it can trail the caster by more than the tolerance)
    if (Math.min(Math.hypot(m.x - r.x, m.y - r.y), Math.hypot(m.x - last.x, m.y - last.y)) > CAST_ORIGIN_TOLERANCE_PX) return;
    let place: V2 | null = null;
    if (s.targeting === 'mouseGround') {
      if (m.px === undefined || m.py === undefined) return;
      place = { x: m.px, y: m.py };
      if (Math.hypot(place.x - m.x, place.y - m.y) > (s.placeRange ?? 260) + 2 || !placementOk(place.x, place.y)) return;
    }
    this.seenCasts.add(m.castId);
    this.remoteCasts.set(key, [...recent, this.simMs]);
    if (m.amb && s.cls === 'samurai' && r.kageGhosts().length) this.ambushIn.add(m.castId); // made while his doubles stand: an ambush
    const run = this.rt?.start({ castId: m.castId, skill: s, stage: Math.max(0, Math.min(2, m.stage ?? 0)), attackerId: from, own: false, origin: { x: m.x, y: m.y, z: m.z ?? 0 }, aim: unit(m.ax, m.ay), place, lock: m.lock ?? null,
      dmgMul: Math.max(0.3, Math.min(1.4, (m.dm ?? 100) / 100)), reach: Math.max(1, Math.min(1.85, (m.rm ?? 100) / 100)),
      range: Math.max(1, Math.min(1.2, (m.rg ?? 100) / 100)), speed: Math.max(1, Math.min(1.35, (m.sp ?? 100) / 100)), ...(m.mf ? { mf: m.mf } : {}) });
    if (run && s.id === 'judgment_blade') { // the blade leaves the caster's hand when its release message arrives (fallback: a little after the full charge)
      run.timings.startup = s.startup + 600; r.setSkillStartup(s.id, run.timings.startup);
    }
  }

  private freeSpawnPoint(): { x: number; y: number } {
    const others = [...(this.pvp?.remotes.values() ?? [])].filter((r) => r.alive).map((r) => ({ x: r.x, y: r.y }));
    if (this.bot) others.push({ x: this.bot.x, y: this.bot.y });
    const pts = PVP.spawnPoints.filter((s) => footAllowed(s.x, s.y, 0, R));
    const clearance = (s: { x: number; y: number }) => Math.min(Infinity, ...others.map((o) => Math.hypot(o.x - s.x, o.y - s.y)));
    const free = pts.filter((s) => clearance(s) >= PVP.spawnClearRadius);
    if (free.length) return free[Math.floor(Math.random() * free.length)];
    return pts.reduce((best, s) => (clearance(s) > clearance(best) ? s : best), pts[0]);
  }

  // ======================================================================= battle mode (arena 1v1)

  /** The combo guide's keys: every slot's and the jump's (Key Settings). */
  private guideKeys(): { slots: string[]; jump: string } { return { slots: slotKeyLabels(this.bindings), jump: keyLabel(this.bindings.jump) }; }

  /** A cast's own timeline as the runtime plays it (the arena's warrior at his base pace), before attack speed. */
  private castTimes(s: FinalSkill, stage: number): { startup: number; active: number; recovery: number } {
    const t = s.chain?.timings?.[stage] ?? { startup: s.startup, active: s.active, recovery: s.recovery }, k = this.arena ? arenaTimeScale(s) : null;
    return k ? { startup: Math.round(t.startup * k.startup), active: Math.round(t.active * k.active), recovery: Math.round(t.recovery * k.recovery) } : t;
  }

  /** Skill cooldown multiplier: longer in the arena (more spacing, fewer strings of skills); the basic attack never waits. */
  private cdMul(s: FinalSkill): number { if (this.noCd && this.pvp && this.bot) return 0; // sparring test switch (never against a player)
    return (this.arena && s.slot !== 0 ? ARENA.cdMul : 1) * (s.cls === 'book_mage' ? this.passives.cdMul : 1) * (this.simMs < this.mage.hasteUntil ? 0.9 : 1); }

  /** BREAK (the arena): out of the combo — a hop back from the attacker, a burst of light, untouchable a moment. */
  private breakFree(now: number): void {
    const b = this.body, k = this.kin, opp = this.duelOpponent() ?? '', from = opp ? this.casterPos(opp) : null;
    b.doBreak(now);
    this.rt?.cancelOwn('hit');
    this.carriedBy = null; this.lunge = null; this.momentum = null; this.gripHeld = false;
    const away = from ? unit(k.x - from.x, k.y - from.y, -this.faceSide, 0) : { x: -this.faceSide, y: 0 };
    b.push = { vx: (away.x * ARENA.breakHop) / 180, vy: (away.y * ARENA.breakHop * 0.4) / 180, left: 180 };
    if (!k.grounded) k.vz = Math.min(k.vz, -140); // in the air: down to the floor
    this.setMode(k.grounded ? 'idle' : 'air');
    this.breakFx(k.x, k.y, k.z);
    this.cameras.main.shake(140, 0.004);
    this.pvp?.sendBreak(k.x, k.y, k.z);
  }

  /** The BREAK burst (yours, the other player's, the knight's): a ring of light, the word. */
  private breakFx(x: number, y: number, z: number): void {
    this.fx?.shockwave(x, y, 170, 0x9ed8ff); this.fx?.shockwave(x, y, 110, 0xffffff);
    this.fx?.callout({ x, y, z: z - 70 }, 'BREAK!', '#bfe6ff', 0); // in the burst, at the body (the broken combo's numbers stay above)
  }

  /** The knight breaks out of your combo now and then (it is a fair sparring partner: it has the same way out). */
  private botBreak(): void {
    const b = this.bot; if (!b || b.defeated) return;
    b.breakOut(this.simMs, { x: this.kin.x, y: this.kin.y });
    this.rt?.cancelAttacker(BOT_ID);
    this.breakFx(b.x, b.y, b.z);
    this.combo.at = -Infinity; // your combo is over
  }

  /** Your opponent in the arena: the one other player in the room, or the sparring knight when you are alone; none with
   *  three or more (a free fight). */
  private duelOpponent(): string | null {
    if (!this.arena || !this.pvp) return null;
    const n = this.pvp.remotes.size;
    if (n === 1) return this.pvp.remotes.keys().next().value ?? null;
    return n === 0 && this.bot && !this.bot.trial ? BOT_ID : null;
  }

  /** Starts / ends the match as opponents come and go, runs it, and feeds the fight's HUD. */
  private updateMatch(real: number, ms: number): void {
    const m = this.match, B = this.battleHud;
    if (!m || !B || !this.pvpReady) return;
    const opp = this.duelOpponent();
    if (m.active && m.opponent !== opp) m.abort(); // the opponent left / a third player came in
    else if (m.active && !m.isHost && performance.now() - this.matchHeard > 5000) m.abort(); // the side running it went silent (its window hidden / gone): a free fight until it is back
    if (!m.active && opp) { // the lower id runs a match between two players; against the knight it is always you
      if (opp === BOT_ID) { m.koWindow = 0; m.start(BOT_ID); }
      else if (this.localId < opp) { m.koWindow = PVP.battle.koWindowMs; m.start(opp); }
    }
    m.update(real, ms);
    this.comboGuide?.show(!m.active || (m.phase !== 'vs' && m.phase !== 'over')); // (not over the VS splash or the result)
    if (!m.active) return;
    B.setHp('l', this.hpFracOf(m.host)); B.setHp('r', this.hpFracOf(m.guest));
    B.setClock(m.phase === 'vs' || m.phase === 'intro' ? PVP.battle.roundMs : m.left, m.round);
    B.setWins(m.wins[0], m.wins[1], PVP.battle.winsNeeded);
    const now = this.simMs, mine = m.sideOf(this.localId);
    const oppLeft = m.opponent === BOT_ID ? (this.bot ? this.bot.body.breakReadyAt - now : 0) : this.oppBreakAt + ARENA.breakCdMs - now;
    B.setBreak(mine, { leftMs: this.body.breakReadyAt - now, live: this.body.canBreak(now), key: keyLabel(this.bindings.jump) });
    B.setBreak(mine === 'l' ? 'r' : 'l', { leftMs: oppLeft, live: false });
  }

  private onMatchPhase(m: Match, prev: MatchPhase): void {
    const B = this.battleHud, T = PVP.battle;
    if (!B) return;
    if (m.phase === 'idle') { // no match any more: back to the free arena
      B.clearCalls(); B.hideResult(); B.setOn(false); this.hud?.setBattle(false);
      if (this.bot) this.bot.hold = false;
      this.endKoMoment();
      if (this.dead >= 0) this.dead = Math.max(this.dead, PVP.respawnMs - 500); // down in the last round: up again in a moment
      return;
    }
    if (prev === 'idle') { this.hud?.setBattle(true, m.sideOf(this.localId)); B.setOn(true); }
    if (prev === 'idle' || m.phase === 'vs') B.setFighters(this.fighterOf(m.host), this.fighterOf(m.guest));
    switch (m.phase) {
      case 'vs': B.hideResult(); this.placeForRound(m); B.vs(this.fighterOf(m.host), this.fighterOf(m.guest), T.vsMs); break;
      case 'intro': B.hideResult(); this.placeForRound(m); B.round(m.round, m.finalRound, T.introMs); break;
      case 'fight': B.hideResult(); this.ci?.clearBuffer(); B.fight(); if (this.bot) this.bot.hold = false; break;
      case 'ko':
        if (this.bot) this.bot.hold = true;
        B.ko(m.why, m.perfect, T.koMs - 500);
        if (m.why === 'ko' || m.why === 'double') this.koMoment();
        break;
      case 'over': if (this.bot) this.bot.hold = true; this.showResult(m); break;
    }
  }

  /** Every round (and the VS before the first): both fighters on their marks, facing each other, whole again. */
  private placeForRound(m: Match): void {
    const S = PVP.battle.start, left = m.sideOf(this.localId) === 'l';
    this.roundReset(left ? S.left : S.right, S.y, left ? 1 : -1);
    this.rt?.cancelAttacker(m.opponent);
    this.remoteCasts.clear(); // a new round: the opponent's skills are all ready again too (its earlier casts no longer count against it)
    this.botBreakAt = 0; this.oppBreakAt = -Infinity; this.selfShakeUntil = -1; // and both BREAKs are ready again
    const b = this.bot;
    if (m.opponent === BOT_ID && b) { b.duel = true; b.resetAt(left ? S.right : S.left, S.y, this.simMs, left ? 'left' : 'right'); b.hold = true; }
    this.endKoMoment();
  }

  /** A new round for you: on your mark, full HP, every buff gone, every skill ready, nothing still flying. */
  private roundReset(x: number, y: number, face: 1 | -1): void {
    this.rt?.cancelOwn('death');
    this.lingers = []; this.shares = [];
    this.endBuffs();
    this.warCryUntil = -1; this.radiantUntil = -1; this.radiantFrom = -1; this.domeAt = -1;
    if (this.dome) this.dome.until = this.simMs;
    this.jb = null; this.jbWant = 0; this.carriedBy = null; this.lunge = null; this.momentum = null; this.gripHeld = false; this.leapUsed = false; this.leapUntil = -1;
    this.rt?.resetCooldowns();
    this.respawnAt(x, y, PVP.maxHp);
    this.body.maxHp = this.maxHpNow();
    this.dir = face > 0 ? 'right' : 'left'; this.aim = { x: face, y: 0 }; this.faceSide = face;
    this.blockHold = { x: 0, y: 0 };
    this.chain = { stage: -1, lastEnd: -Infinity, skill: '' };
    this.combo = { count: 0, at: -Infinity, comboId: -1, target: '', label: '', dmg: 0, max: 1 };
    this.orbs = { n: 0, lastAt: -Infinity, cast: '' };
    this.pvp?.sendRespawn(x, y, this.playerHP); // the other side sees you on your mark at once (no slide across the floor)
  }

  /** A fighter's HP as a fraction of its maximum (0 when down). */
  private hpFracOf(id: string): number {
    if (id === this.localId) return this.dead >= 0 ? 0 : this.playerHP / Math.max(1, this.maxHpNow());
    if (id === BOT_ID) { const b = this.bot; return b && !b.defeated ? b.hp / Math.max(1, b.body.maxHp) : 0; }
    const r = this.pvp?.remotes.get(id);
    return r && r.alive ? r.hp / Math.max(1, r.maxHp) : 0;
  }

  /** START HERO: the sparring partner is a ready hero too (its body and face). */
  private botHero(): boolean { return !!this.character?.hero; }
  /** Name, class and portrait of a fighter for the battle HUD. */
  private fighterOf(id: string): Fighter {
    if (id === this.localId) { const ch = this.character!; return { name: ch.name, cls: CLASS_NAMES[this.cls] ?? this.cls, portrait: ch.hero ? heroPortrait(this.cls) : portraitOf(previewKeyOf(ch)), you: true }; }
    if (id === BOT_ID) { const c = this.botCls; return { name: this.botName(), cls: CLASS_NAMES[c] ?? c, portrait: this.botHero() ? heroPortrait(c) : portraitOf(c === 'warrior' ? 'base/male' : `${c}/${c}_default`), you: false }; }
    const r = this.pvp?.remotes.get(id), c = r?.meta.classId ?? 'warrior';
    return { name: r?.meta.name ?? this.nameOf(id), cls: CLASS_NAMES[c] ?? c, portrait: r?.meta.hero ? heroPortrait(c) : portraitOf(c === 'warrior' ? `base/${r?.meta.gender ?? 'male'}` : `${c}/${c}_default`), you: false };
  }

  private showResult(m: Match): void {
    const me = this.localId, left = m.sideOf(me) === 'l';
    if (this.vs) addResult(scoreKey(this.vs, this.pvp?.room), m.champ === null ? 'd' : m.champ === me ? 'w' : 'l'); // the fighter select's count
    this.battleHud?.result({ title: m.champ === null ? 'DRAW' : m.champ === me ? 'VICTORY' : 'DEFEAT', me: this.fighterOf(me), them: this.fighterOf(m.opponent), mine: m.wins[left ? 0 : 1], theirs: m.wins[left ? 1 : 0] });
    this.refreshRematch();
  }

  private refreshRematch(): void {
    const m = this.match;
    if (m?.phase === 'over') this.battleHud?.rematchState(m.wants(this.localId), m.wants(m.opponent), this.fighterOf(m.opponent).name);
  }

  /** REMATCH: against the knight at once; against a player once both ask. */
  private askRematch(): void {
    const m = this.match;
    if (!m || m.phase !== 'over') return;
    const mid = m.mid, opp = m.opponent;
    m.rematch(this.localId);
    if (opp === BOT_ID) m.rematch(BOT_ID);
    else this.pvp?.sendRematch(mid);
    this.refreshRematch();
  }

  /** K.O.: the world slows to a quarter for a beat while the camera punches in, then eases back. */
  private koMoment(): void {
    this.koT = 0; this.koZoomBack = false;
    const cam = this.cameras.main;
    cam.shake(340, 0.011);
    cam.zoomTo(this.baseZoom * this.arenaZoom * 1.08, 220, 'Quad.easeOut', true);
  }

  private endKoMoment(): void {
    if (this.koT < 0 && !this.koZoomBack) return;
    this.koT = -1; this.koZoomBack = false;
    this.time.timeScale = this.slowMo; this.tweens.timeScale = this.slowMo;
    this.cameras.main.zoomTo(this.baseZoom * this.arenaZoom, 1, 'Linear', true);
  }

  /** The K.O. slow motion this frame (real ms since the K.O.): a quarter speed, then back to full by 1.4 s. */
  private koFactor(real: number): number {
    if (this.koT < 0) return 1;
    this.koT += real;
    const t = this.koT, f = t < 700 ? 0.25 : t < 1400 ? 0.25 + 0.75 * ((t - 700) / 700) : 1;
    if (t >= 950 && !this.koZoomBack) { this.koZoomBack = true; this.cameras.main.zoomTo(this.baseZoom * this.arenaZoom, 650, 'Sine.easeInOut', true); }
    if (t >= 1400) { this.koT = -1; this.koZoomBack = false; }
    this.time.timeScale = this.slowMo * f; this.tweens.timeScale = this.slowMo * f;
    return f;
  }

  // ======================================================================= cosmetics

  private loadCosmetics(): void { this.setEquipped(CharacterStore.getCosmetics(this.character!.id).equipped as Equipped, false); }

  setEquipped(e: Equipped, save = true): void {
    this.equipped = { ...e };
    this.view?.setEquipped(this.equipped);
    if (this.fx) this.fx.damageSkin = damageSkin(this.equipped.damage);
    this.skillBook?.setEquipped(this.equipped);
    if (save && this.character) {
      const c = CharacterStore.getCosmetics(this.character.id);
      CharacterStore.setCosmetics(this.character.id, { owned: c.owned, equipped: this.equipped as Record<string, string> });
    }
    this.pvp?.forceState();
  }

  get equippedItems(): Equipped { return this.equipped; }

  // ======================================================================= open world

  /** Talking to an NPC: the hero stands and listens (no moving, attacking or jumping). */
  private inputLocked(): boolean { return this.warping || !!this.npcDialog?.isOpen || !!this.match?.locked; }
  /** Carried by the Temple portal's light (a moment of fade): no input. */
  private warping = false;

  /** The monsters of the whole world (each keeps to its own home spot). */
  private stepMonsters(ms: number, now: number): void {
    const mobs = this.world!.mobs, k = this.kin;
    for (const m of mobs) {
      const dc = m.alive ? this.kage?.decoyFor(m) : null; // Kagemusha: monsters go after the doubles (a blow bursts one)
      m.update(ms, {
        player: dc ? { x: dc.x, y: dc.y, z: k.z - k.supportZ, alive: true, level: dc.sz } : { x: k.x, y: k.y, z: k.z - k.supportZ, alive: this.dead < 0, level: k.supportZ },
        now,
        blocked: (self, x, y) => mobs.some((o) => { if (o === self || !o.alive) return false; const d = Math.hypot(x - o.x, y - o.y); return d < 26 * Math.max(o.kind.scale, self.kind.scale) && d < Math.hypot(self.x - o.x, self.y - o.y); }),   // moving apart: always
        onStrikePlayer: (m, dmg) => { if (dc) this.kage?.pop(dc.k); else this.enemyStrike(dmg, { x: m.x, y: m.y }); },
      });
    }
    // MapleStory: touching a monster hurts a little and knocks you back, then you blink and can walk through it
    if (this.dead < 0 && now >= this.hitBlinkUntil && now >= this.touchUntil && !this.rt?.ownRun) for (const m of mobs) {
      if (!m.alive || m.body.state === 'knockdown' || m.body.state === 'launched' || Math.abs(m.z - k.z) > 40 || Math.hypot(m.x - k.x, (m.y - k.y) * 1.6) > STAGE6.enemy.collisionRadius * m.kind.scale + R * 0.6) continue;
      this.touchUntil = now + 600;   // a touch blocked (guard, ward, dodge) still counts: never every frame
      this.enemyStrike(Math.max(1, Math.round(m.kind.damage * 0.5)), { x: m.x, y: m.y }, 34); break;
    }
  }

  /** The camera along the world, NPC prompts, the portal (every frame). */
  private updateWorldUi(ms: number): void {
    if (!this.world) return;
    this.world.update(ms, { x: this.kin.x, y: this.kin.y, z: this.kin.z - this.kin.supportZ, supportZ: this.kin.supportZ, absZ: this.kin.z, grounded: this.kin.grounded, alive: this.dead < 0 });
    this.motes?.setPosition(this.world.viewLeft, 0); // the dust hangs in the air in front of you
  }

  /** Talk key: next line in a conversation, else talk to the NPC in reach, else step into the portal in reach. */
  private onTalk(): void {
    if (!this.world || !this.pvpReady) return;
    if (this.npcDialog?.isOpen) { this.npcDialog.advance(); return; }
    if (this.dead >= 0 || this.warping || this.rt?.ownRun || this.body.state !== 'free') return;
    const n = this.world.near;
    if (n?.kind === 'npc') this.talkTo(n.npc);
    else if (n?.kind === 'portal') this.usePortal();
  }

  /** An NPC's conversation: a quest to offer, the one running, the one to hand in — or just his lines. */
  private talkTo(n: AreaNpc): void {
    if (!this.npcDialog || !this.world || this.dead >= 0) return;
    const np = this.world.npcPos(n);
    if (Math.hypot(this.kin.x - np.x, this.kin.y - np.y) > 260) return; // walk up to them first
    this.skillBook?.close(); this.cosPanel?.close(); this.questLog?.close();
    this.ci?.reset();
    if (Math.abs(np.x - this.kin.x) > 4) this.dir = np.x < this.kin.x ? 'left' : 'right'; // turns to face them
    const say = (lines: string[], choices?: DialogChoice[]) => this.npcDialog!.open({ name: n.name, title: n.title, portrait: `assets/world/npc/${n.art}_face.png`, lines, choices });
    if (n.job) { this.masterTalk(n, say); return; }
    const mine = QUESTS.filter((q) => q.giver === n.id);
    const ready = QUESTS.find((q) => this.turnIn(q) === n.id && this.quests[q.id]?.state === 'active' && this.questReady(q)); // handed in where its last goal says
    if (ready) { say(ready.done, [{ label: ready.complete, main: true, run: () => this.finishQuest(ready) }]); return; }
    const running = mine.find((q) => this.quests[q.id]?.state === 'active' && !(this.questReady(q) && this.turnIn(q) !== n.id)) ?? mine.find((q) => this.quests[q.id]?.state === 'active');
    if (running) { say(running.progress); return; }
    const offer = mine.find((q) => this.questOpen(q));
    if (offer) { say(offer.offer, [{ label: offer.accept, main: true, run: () => this.takeQuest(offer) }, { label: offer.decline, run: () => undefined }]); return; }
    if (n.role === 'shop') {
      const unlocked = !mine.length || mine.every((q) => this.quests[q.id]?.state === 'done');
      if (unlocked) { say(n.lines?.length ? n.lines : IDLE_LINES, [{ label: "Let's trade", main: true, run: () => this.openShop() }, { label: 'Goodbye', run: () => undefined }]); return; }
    }
    say(n.lines?.length ? n.lines : IDLE_LINES);
  }

  private openShop(): void { this.skillBook?.close(); this.cosPanel?.close(); this.questLog?.close(); this.statsWin?.close(); this.shop?.open(); }

  // ---- quests (the NPC's first missions)
  /** Can be offered now: not taken yet, the quest before it done. */
  /** Who it is handed in to: the NPC of its last talk goal (else its giver). */
  private turnIn(q: QuestDef): string { return [...q.objectives].reverse().find((o) => o.kind === 'talk')?.npc ?? q.giver; }
  private questOpen(q: QuestDef): boolean { return !this.quests[q.id] && (!q.after || this.quests[q.after]?.state === 'done'); }
  /** Progress of one goal: kills counted, items in the bag, the level reached. */
  private goalHave(q: QuestDef, i: number): number {
    const o = q.objectives[i], st = this.quests[q.id];
    if (o.kind === 'collect') return Math.min(o.count ?? 1, this.bag[o.item ?? ''] ?? 0);
    if (o.kind === 'level') return Math.min(o.level ?? 1, this.character?.level ?? 1);
    return st?.progress[i] ?? 0;
  }
  private goalNeed(o: QuestDef['objectives'][number]): number { return o.kind === 'level' ? o.level ?? 1 : o.count ?? 1; }
  private questReady(q: QuestDef): boolean {
    const st = this.quests[q.id]; if (!st) return false;
    return q.objectives.every((o, i) => o.kind === 'talk' || this.goalHave(q, i) >= this.goalNeed(o));
  }

  private takeQuest(q: QuestDef): void {
    this.quests[q.id] = { state: 'active', progress: q.objectives.map(() => 0) };
    this.saveQuests();
    this.chat?.add({ kind: 'system', text: `New quest: ${q.title}. Press ${keyLabel(this.bindings.quests) || 'J'} for the quest log.` });
    this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, 'NEW QUEST', '#ffe08a', 0);
  }

  private finishQuest(q: QuestDef): void {
    const st = this.quests[q.id]; if (!st || st.state === 'done' || !this.questReady(q)) return; // once
    for (const o of q.objectives) if (o.kind === 'collect' && o.item) this.takeItem(o.item, o.count ?? 1); // handed over
    st.state = 'done'; st.progress = q.objectives.map((o) => this.goalNeed(o));
    this.saveQuests();
    const r = q.reward;
    if (r) {
      const got: string[] = [];
      if (r.exp) { this.gainExp(r.exp, { x: this.kin.x, y: this.kin.y, z: this.kin.z }); got.push(`${r.exp} EXP`); }
      if (r.gold) { this.gold = Math.min(GOLD_MAX, this.gold + r.gold); got.push(`${fmtGold(r.gold)} Gold`); this.hud?.lootFeed(GOLD_ICON.small, `+${fmtGold(r.gold)} Gold`, '#f3d58c'); }
      for (const [id, n] of Object.entries(r.items ?? {})) if (ITEMS[id]) { this.giveItem(id, n, false); got.push(`${ITEMS[id].name} ×${n}`); this.hud?.lootFeed(ITEMS[id].icon, `${ITEMS[id].name} ×${n}`, '#ece5d3'); }
      this.saveLoot();
      if (got.length) this.chat?.add({ kind: 'system', text: `Received: ${got.join(', ')}` });
    }
    this.chat?.add({ kind: 'system', text: `Quest complete: ${q.title}` });
    this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, 'QUEST COMPLETE', '#9dff9a', 0);
    this.fx?.shockwave(this.kin.x, this.kin.y, 110, 0xffe2a0);
  }

  /** A monster fell: kill goals of running quests that ask for its kind move on. */
  private questKill(m: Monster): void {
    const kind = Object.entries(MOB_KINDS).find(([, k]) => k === m.kind)?.[0];
    for (const q of QUESTS) {
      const st = this.quests[q.id]; if (st?.state !== 'active') continue;
      q.objectives.forEach((o, i) => {
        if (o.kind !== 'kill' || o.mob !== kind) return;
        const need = o.count ?? 1, before = st.progress[i] ?? 0; if (before >= need) return;
        st.progress[i] = before + 1;
        this.chat?.add({ kind: 'system', text: `${m.name}: ${st.progress[i]} / ${need}` });
        if (st.progress[i] >= need) this.fx?.callout({ x: this.kin.x, y: this.kin.y, z: this.kin.z + 50 }, 'GOAL DONE', '#ffe08a', 0);
      });
      this.saveQuests();
    }
  }

  private saveQuests(): void { if (this.character) CharacterStore.setQuests(this.character.id, this.quests); this.refreshQuests(); }

  /** Tracker (left side), quest log (J) and the markers over the quest givers. */
  private refreshQuests(): void {
    const rows = QUESTS.filter((q) => this.quests[q.id]).map((q) => {
      const st = this.quests[q.id], done = st.state === 'done', ready = !done && this.questReady(q);
      return {
        id: q.id, title: q.title, summary: q.summary, done,
        objectives: q.objectives.map((o, i) => ({
          text: o.kind === 'talk' ? o.text : `${o.text}  ${done ? this.goalNeed(o) : this.goalHave(q, i)}/${this.goalNeed(o)}`,
          done: done || (o.kind !== 'talk' && this.goalHave(q, i) >= this.goalNeed(o)),
        })).filter((o, i) => q.objectives[i].kind !== 'talk' || ready || done),
      };
    });
    this.questsUi?.set(rows.filter((r) => !r.done));
    this.questLog?.setQuests(rows);
    for (const a of new Set(QUESTS.flatMap((q) => [q.giver, this.turnIn(q)]))) {
      const mine = QUESTS.filter((q) => q.giver === a);
      const ready = QUESTS.some((q) => this.turnIn(q) === a && this.quests[q.id]?.state === 'active' && this.questReady(q));
      const running = mine.some((q) => this.quests[q.id]?.state === 'active' && this.turnIn(q) === a);
      const open = mine.some((q) => this.questOpen(q));
      this.world?.setNpcMark(a, ready ? 'ready' : running ? 'progress' : open ? 'available' : null);
    }
  }

  /** The Temple gate's portal: a flash of light, then the Legacy Courtyard. */
  private usePortal(): void {
    const w = this.world; if (!w) return;
    this.ci?.reset();
    this.fx?.shockwave(this.kin.x, this.kin.y, 120, 0xffe2a0);
    this.warping = true; // no input while the light carries you
    w.jumpTo(START.area, START.x, START.y, this.kin, () => { this.warping = false; this.setMode('idle'); });
  }

  // ======================================================================= HUD

  /** The arena's minimap: a square of the courtyard around you (its full height). */
  private arenaMinimap(markers: HudMarker[]): HudState['minimap'] {
    const W = WORLD.coordinateSpace.width, H = WORLD.coordinateSpace.height, side = H;
    const minX = Phaser.Math.Clamp(this.kin.x - side / 2, 0, Math.max(0, W - side));
    return { label: WORLD.name, imageUrl: ATLAS.textures.map.file, image: { x: 0, y: 0, w: W, h: H }, markers, bounds: { minX, minY: 0, width: side, height: side } };
  }

  private hudState(): HudState {
    const ch = this.character!, now = this.simMs, k = this.kin;
    const alive = this.dead < 0, pvp = this.pvp;
    const markers: HudMarker[] = [];
    if (this.pvpReady) markers.push({ id: 'local', kind: 'player', x: k.x, y: k.y });
    for (const r of pvp?.remotes.values() ?? []) if (r.alive && !r.kageHidden) markers.push({ id: r.meta.playerId, kind: 'remote', x: r.x, y: r.y });
    if (this.bot) markers.push({ id: BOT_ID, kind: 'enemy', x: this.bot.x, y: this.bot.y });
    if (this.enemy?.alive) markers.push({ id: 'enemy', kind: 'enemy', x: this.enemy.x, y: this.enemy.y });
    const busy = this.busy();
    const slots: HudSlot[] = HUD.skills.hotkeys.map((hk, i) => {
      const s = this.kit[i], hotkey = this.hud ? this.hud.labels[i] ?? '' : hk; // Key Settings label ('' = on no key)
      if (!s || !this.skillOpen(s)) return { id: `slot-${hotkey}`, hotkey, label: s ? 'Locked' : 'Unassigned', assigned: false, enabled: false, pressed: false, cooldown: null }; // opens with its job
      if (s.wip) return { id: s.id, hotkey, label: `${s.name} (coming soon)`, iconUrl: iconUrl(s), assigned: true, enabled: false, pressed: false, cooldown: null }; // a template: shown, greyed
      const rem = this.rt?.cooldownRemaining(s.id) ?? 0;
      const airBlocked = !k.grounded && !s.air;
      return {
        id: s.id, hotkey, label: s.name, iconUrl: iconUrl(s), assigned: true, enabled: alive && this.pvpReady && !airBlocked, busy,
        pressed: false, cooldown: rem > 0 ? { endTimeMs: now + rem, durationMs: s.cooldown * this.cdMul(s) } : null, tier: s.slot === 7 ? 'ultimate' : s.slot === 6 ? 'signature' : undefined,
      };
    });
    const showCombo = now - this.combo.at <= COMBO_SHOW_MS && this.combo.count >= 2;
    return {
      mode: pvp ? 'pvp' : 'pve',
      player: {
        id: pvp?.meta.playerId ?? ch.id, name: ch.name, level: ch.level, portrait: ch.hero ? heroPortrait(this.cls) : portraitOf(previewKeyOf(ch)),
        hp: this.playerHP, maxHp: this.maxHpNow(), resource: { kind: 'mp', value: Math.round(this.mp), max: this.maxMpNow() }, effects: [...this.buffEffects(), ...this.statusEffects(this.body, now)],
        exp: Number.isFinite(expToNext(ch.level)) ? { value: ch.exp ?? 0, max: expToNext(ch.level) } : undefined,
        job: pvp ? undefined : this.jobTitle(), gold: pvp ? undefined : this.gold,
        potions: pvp ? undefined : this.quick.map((id, i) => ({ id, name: ITEMS[id].name, iconUrl: ITEMS[id].icon, count: this.bag[id] ?? 0, hotkey: keyLabel(this.bindings[i ? 'mpPot' : 'hpPot']) })),
      },
      target: alive && this.pvpReady ? this.hudTarget() : null,
      slots,
      minimap: this.world ? this.world.minimap({ x: k.x, y: k.y, z: k.z, floor: k.supportZ }) : this.arenaMinimap(markers),
      room: pvp ? { label: `ROOM ${pvp.room}`, playerCount: pvp.connected ? pvp.remotes.size + 1 : 0, maxPlayers: PVP.maxPlayers } : null,
      combatFeedback: showCombo ? { count: this.combo.count, chain: `${this.combo.label}  ·  TOTAL ${Math.min(999, Math.round((this.combo.dmg / this.combo.max) * 100))}%`, expiresAtMs: this.combo.at + COMBO_SHOW_MS } : null,
    };
  }

  /** Own active buffs with their timers (HUD buff row). */
  private buffEffects(): HudEffect[] {
    const out: HudEffect[] = [], now = this.simMs, ic = (id: string) => { const f = finalSkill(id); return f ? iconUrl(f) : `assets/final/skills/warrior/${id}/icon.png`; };
    for (const [id, label, until] of [['war_cry', 'War Cry', Math.max(this.warCryUntil, this.allyCryUntil)], ['radiant_blade', 'Radiant Blade', this.radiantUntil], ['iron_oath', 'Iron Oath', this.oathUntil], ['legacy_banner', 'Legacy Banner', this.bannerUntil],
      ['hunters_spirit', "Hunter's Spirit", this.spiritUntil], ['tree_of_life', 'Tree of Life', this.tree?.until ?? -1],
      ['kagemusha', 'Kagemusha', this.kage?.up ? this.kage.until : -1], ['rising_sun', 'Rising Sun', this.sunUntil], ['god_of_blades', 'God of Blades', this.godUntil],
      ['chrono_haste', 'Chrono Haste', this.mage.hasteUntil], ['arcane_ward', 'Arcane Ward', this.mage.wardHp > 0 ? this.mage.wardUntil : -1], ['elemental_ascension', 'Elemental Ascension', this.mage.ascUntil], ['chrono_sigil', 'Chrono Sigil', this.sigil?.until ?? -1]] as const)
      if (now < until) out.push({ id, label, iconUrl: ic(id), harmful: false, expiresAtMs: until });
    if (this.mage.weave > 0) out.push({ id: 'spell_weave', label: `Spell Weave ×${this.mage.weave}`, iconUrl: 'assets/final/skills/book_mage/spell_weave/icon.png', harmful: false, expiresAtMs: this.mage.weaveAt + WEAVE.fadeMs });
    if (now < this.itemDmgUntil) out.push({ id: 'warrior_potion', label: 'Warrior Potion', iconUrl: ITEMS.warrior_potion.icon, harmful: false, expiresAtMs: this.itemDmgUntil });
    if (now < this.itemSpeedUntil) out.push({ id: 'swift_potion', label: 'Swift Potion', iconUrl: ITEMS.swift_potion.icon, harmful: false, expiresAtMs: this.itemSpeedUntil });
    return out;
  }

  /** Small status icons, only when meaningful: hard CC, launched, knockdown. */
  private statusEffects(b: CombatBody, now: number): HudEffect[] {
    const out: HudEffect[] = [], U = 'assets/final/ui/hud';
    if (b.hard.active(now)) out.push({ id: 'cc', label: b.hard.kind === 'root' ? 'Rooted' : b.hard.kind === 'freeze' ? 'Frozen' : 'Stunned', iconUrl: `${U}/${b.hard.kind === 'root' ? 'status_root' : 'status_hard_cc'}.png`, harmful: true });
    if (b.state === 'launched') out.push({ id: 'air', label: 'Launched', iconUrl: `${U}/status_launch.png`, harmful: true });
    if (b.state === 'knockdown' || b.state === 'getup') out.push({ id: 'kd', label: 'Knocked down', iconUrl: `${U}/status_knockdown.png`, harmful: true });
    return out;
  }

  private hudTarget(): HudState['target'] {
    const k = this.kin, now = this.simMs;
    let best: HudState['target'] = null, bestD: number = HUD.targetRadius;
    const consider = (d: number, t: NonNullable<HudState['target']>) => { if (d <= bestD) { bestD = d; best = t; } };
    const e = this.enemy;
    const combat = (b: CombatBody, z: number) => ({
      state: b.state === 'launched' || z > 8 ? 'AERIAL' : b.state === 'knockdown' || b.state === 'getup' ? 'DOWN' : b.state === 'hitstun' ? 'STAND' : '',
      gauges: { stand: b.gauge.stand / GAUGE.stand, air: b.gauge.air / GAUGE.air, down: b.gauge.down / GAUGE.down },
    });
    if (e?.alive) consider(Math.hypot(e.x - k.x, e.y - k.y), { id: 'enemy', name: 'Cursed Swordsman', type: 'Enemy', hp: e.hp, maxHp: S6.enemy.maxHp, effects: this.statusEffects(e.body, now), ...combat(e.body, e.kin.z) });
    for (const m of this.world?.mobs ?? []) if (m.alive) consider(Math.hypot(m.x - k.x, m.y - k.y), { id: m.id, name: m.name, type: m.kind.level ? `Lv ${m.kind.level} Monster` : 'Monster', hp: Math.round(m.hp), maxHp: m.maxHp, effects: this.statusEffects(m.body, now), ...combat(m.body, m.kin.z) });
    if (this.dummy && this.dummyState?.alive) consider(Math.hypot(D.x - k.x, D.y - k.y), { id: 'dummy', name: 'Training Dummy', type: 'Training Target', hp: this.dummyState.hp, maxHp: D.maxHp, effects: [], ...combat(this.dummyState.body, this.dummyState.kin.z) });
    const bt = this.bot;
    if (bt) consider(Math.hypot(bt.x - k.x, bt.y - k.y), {
      id: BOT_ID, name: this.botName(), type: bt.trial ? 'Master · Job Trial' : 'NPC · PvP sparring', portrait: !bt.trial && this.botHero() ? heroPortrait(this.botCls) : portraitOf((bt.trial ? bt.cls : this.botCls) === 'warrior' ? 'base/male' : `${bt.trial ? bt.cls : this.botCls}/${bt.trial ? bt.cls : this.botCls}_default`), hp: bt.hp, maxHp: bt.trial ? TRIAL_HP : PVP.maxHp,
      effects: this.statusEffects(bt.body, now), ...combat(bt.body, bt.kin.z),
    });
    for (const r of this.pvp?.remotes.values() ?? []) {
      if (!r.alive || r.kageHidden) continue; // (a hidden samurai is not shown)
      const eff: HudEffect[] = [];
      if (r.mode === 'launched') eff.push({ id: 'air', label: 'Launched', iconUrl: 'assets/final/ui/hud/status_launch.png', harmful: true });
      if (r.mode === 'down' || r.mode === 'getup') eff.push({ id: 'kd', label: 'Knocked down', iconUrl: 'assets/final/ui/hud/status_knockdown.png', harmful: true });
      consider(Math.hypot(r.x - k.x, r.y - k.y), {
        id: r.meta.playerId, name: r.meta.name, type: `Player · ${CLASS_NAMES[r.meta.classId] ?? r.meta.classId}`,
        portrait: r.meta.hero ? heroPortrait(r.meta.classId) : portraitOf(r.meta.classId === 'warrior' ? `base/${r.meta.gender ?? 'male'}` : `${r.meta.classId}/${r.meta.classId}_default`), hp: r.hp, maxHp: r.maxHp, effects: eff,
      });
    }
    return best;
  }

  // ======================================================================= dummy

  private damageDummy(dmg: number): void {
    const ds = this.dummyState!;
    ds.hp = Math.max(0, ds.hp - dmg);
    ds.flash = D.hitFlashMs; // (MapleStory: no white flash over the body)
    if (ds.hp === 0) { ds.alive = false; this.dummy!.setVisible(false); ds.respawn = 0; }
    this.drawDummyBar();
  }

  private updateDummy(ms: number): void {
    const ds = this.dummyState;
    if (!this.dummy || !ds) return;
    if (ds.flash > 0) { ds.flash -= ms; if (ds.flash <= 0) this.dummy.clearTint(); }
    if (ds.alive) { // juggle physics on the anchored post (z only), tilt while knocked down
      const now = this.simMs, k = ds.kin;
      k.vx = 0; k.vy = 0; ds.body.push = null;
      const r = stepKin(k, ms, ds.body.gravityScale(now));
      k.x = D.x; k.y = D.y;
      ds.body.update(now, ms, r.landed, r.impactVz);
      if (r.landed && r.impactVz > 220) this.fx?.dust(D.x, D.y, 70, 0.8);
      const down = ds.body.state === 'knockdown' && ds.body.kdPhase !== 'fall' ? 1 : 0;
      const tilt = ds.body.state === 'launched' ? Math.max(-0.5, Math.min(0.5, -k.vz / 900)) : down * 0.35;
      this.dummy.setPosition(D.x, D.y - k.z).setRotation(tilt).setDepth(actorDepth(D.x, D.y, k.z));
      if (k.z > 0 || ds.body.state !== 'free') this.drawDummyBar();
    }
    if (!ds.alive && ds.respawn > 0) { // the training dummy is removed (never respawns)
      ds.respawn -= ms;
      if (ds.respawn <= 0 && !(Math.hypot(this.kin.x - D.x, this.kin.y - D.y) < D.collisionRadius + D.playerFootRadius)) {
        ds.hp = D.maxHp; ds.alive = true; ds.body.reset(); ds.kin.z = 0; ds.kin.vz = 0; ds.kin.grounded = true;
        this.dummy.clearTint().setVisible(true);
        this.drawDummyBar();
      }
    }
  }

  private drawDummyBar(): void {
    const g = this.dummyBar!, ds = this.dummyState!;
    g.clear();
    if (!ds.alive) return;
    const h = D.healthBar, bx = D.x - h.width / 2, by = D.y + h.offsetY - ds.kin.z;
    const col = (s: string) => Phaser.Display.Color.HexStringToColor(s).color;
    g.fillStyle(col(h.background), 1).fillRect(bx, by, h.width, h.height);
    g.fillStyle(col(h.fill), 1).fillRect(bx, by, (h.width * ds.hp) / D.maxHp, h.height);
    g.lineStyle(1, col(h.border), 1).strokeRect(bx, by, h.width, h.height);
  }

  /** QA helpers. */
  qaLegal(x: number, y: number): boolean { return insideArena(x, y, R); }
  qaDepth(x: number, y: number, z: number): number { return actorDepth(x, y, z); }
}
