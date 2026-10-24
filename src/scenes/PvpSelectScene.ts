// PvP fighter select (Tekken style) before the arena: VS CPU (you pick your fighter, then the one you fight), VS PLAYER
// (an invite link; the other player picks on their own screen, both see each other's choice) or TRAINING (yours, then your
// training partner: the arena without a match, the combo trials). Background: the arena itself,
// under a light of each side's colour; the two fighters alive on it (FighterArt) and the select overlay (DOM) on top.
import Phaser from 'phaser';
import { DESIGN } from '../config/layout';
import ATLAS from '../data/asset-manifest.json';
import { CharacterStore } from '../characters/CharacterStore';
import { ROSTER, fighterFor, heroArt, heroCard } from '../pvp/Fighters';
import { PvpLobby } from '../pvp/PvpLobby';
import { clearPvpFromUrl, ensurePvpRoomInUrl, generateRoomId } from '../pvp/Room';
import { PvpSelectUI, VsMode } from '../ui/PvpSelectUI';
import type { BotLevel } from '../pvp/SparringBot';
import { score, scoreKey } from '../pvp/Score';
import { addMotes, preloadLife } from '../ui/PresentationLife';
import { FighterArt } from '../ui/FighterArt';
import { stageById } from '../world/Stages';
import { Sound, loadMenuSound } from '../audio/Sound';
import { ARENA3D } from '../arena3d/flag';

/** The select screen's backdrop: PVP 3D — the 3D temple courtyard the fight is in, the room itself rendered empty in a
 *  wide shot before the temple (tools/pvp/backdrop3d.mjs); the painted arena — its courtyard by night (and the stage
 *  chosen over it). */
const selectBg = (): { key: string; file: string } => ARENA3D.on
  ? { key: 'pvp-select-3d', file: 'assets/character_select/pvp_select_3d.webp' }
  : { key: 'pvp-select-bg', file: 'assets/character_select/pvp_select_bg.webp' };

export interface PvpSelectData { mode?: VsMode; p1?: string; p2?: string }

export class PvpSelectScene extends Phaser.Scene {
  private ui?: PvpSelectUI;
  /** The backdrop: the courtyard by night, or the stage chosen (its painting, the arena's own texture: loaded once). */
  private bg?: Phaser.GameObjects.Image;
  private bgKey = '';
  private bgWant = '';
  private lobby?: PvpLobby;
  private hover = 'samurai';
  private arts?: Record<'l' | 'r', FighterArt>;

  constructor() { super('PvpSelectScene'); }

  preload(): void {
    const T = ATLAS.textures;
    if (!this.textures.exists(T.map.key)) this.load.image(T.map.key, T.map.file);
    const bg = selectBg(); if (!this.textures.exists(bg.key)) this.load.image(bg.key, bg.file); // the 3D courtyard (the painted arena: the courtyard by night)
    for (const c of ROSTER) { const a = heroArt(c), file = a?.still ? a.url : heroCard(c)?.file; if (file && !this.textures.exists(`hero-card-${c}`)) this.load.image(`hero-card-${c}`, file); } // the heroes' cards (the 3D heroes: their rendered splash)
    preloadLife(this); // (the embers)
    loadMenuSound(this); // (the menu's cues; the music streams in after)
  }

  create(data?: PvpSelectData): void {
    const mode: VsMode = data?.mode ?? 'cpu';
    this.cameras.main.fadeIn(240, 0, 0, 0);
    Sound.music(this, 'select', 700); // (on from the menu, or back from the arena: it crossfades from the stage's)
    Sound.choose();                   // CHOOSE YOUR FIGHTER
    this.bg = undefined; this.bgKey = ''; this.bgWant = '';
    this.swapBg(this.textures.exists(selectBg().key) ? selectBg().key : ATLAS.textures.map.key, false);
    this.add.image(0, 0, washTex(this, ARENA3D.on)).setOrigin(0).setDisplaySize(DESIGN.width, DESIGN.height).setDepth(1);
    this.arts = { l: new FighterArt(this, 'l'), r: new FighterArt(this, 'r') };
    const sel = CharacterStore.getSelectedCharacter();
    this.hover = data?.p1 ?? (sel && (ROSTER as readonly string[]).includes(sel.classId) ? sel.classId : 'samurai');
    this.ui = new PvpSelectUI(this.game.canvas.parentElement!, this.game.canvas, {
      back: () => { Sound.music(this, null, 500); this.leave(() => { clearPvpFromUrl(); this.scene.start('MainMenuScene'); }); },
      mode: (m) => { if (m === 'player') this.openLobby(); else this.closeLobby(); if (m !== 'training') this.ui?.setScore(score(scoreKey(m, this.lobby?.room))); },
      local: (hover, pick) => { this.hover = hover; this.lobby?.set(hover, pick, fighterFor(hover).name); },
      start: (p1, p2, m, stage, level) => this.start(p1, p2, m, stage, level),
      copyLink: async () => { try { await navigator.clipboard.writeText(window.location.href); return true; } catch { return false; } },
      art: (s, cls, state) => this.arts?.[s].set(cls, state),
      lock: (s) => this.arts?.[s].lock(),
      stage: (id) => this.backdrop(id),
    }, { mode, p1: this.hover, p2: data?.p2 });
    if (mode === 'player') this.openLobby(); else clearPvpFromUrl();
    if (mode !== 'training') this.ui.setScore(score(scoreKey(mode, this.lobby?.room)));
    if (ARENA3D.on) addPetals(this, 34); // PVP 3D: the courtyard's cherry petals drifting down, behind the fighters and a few in front
    else addMotes(this, { x: 0, y: 80, w: DESIGN.width, h: 900 }, 26, { depth: 3, size: [8, 20], speed: [10, 22], alpha: 0.55 }); // embers drifting over the arena (and the fighters)
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.layout, this);
      this.ui?.destroy(); this.ui = undefined; this.arts = undefined;
      this.lobby?.close(); this.lobby = undefined; // (the link stays in the address bar: the arena is that room)
    });
  }

  private layout(): void { this.ui?.layout(); }

  /** The stage behind the whole screen (null: the courtyard by night): its painting, loaded the first time it is shown.
   *  PVP 3D: always the 3D courtyard (its one stage). */
  private backdrop(id: string | null): void {
    const st = id && !ARENA3D.on ? stageById(id) : undefined, key = st ? (st.poster ? `${st.key}-poster` : st.key) : selectBg().key;
    this.bgWant = key;
    if (this.textures.exists(key)) { this.swapBg(key); return; }
    if (!st) return;
    this.load.image(key, st.poster ?? st.file);
    this.load.once(`filecomplete-image-${key}`, () => { if (this.sys.isActive() && this.bgWant === key) this.swapBg(key); });
    this.load.start();
  }

  /** The new backdrop fades in over the old one (a stage's painting a little darker: the fighters and the panels stay in front). */
  private swapBg(key: string, fade = true): void {
    if (key === this.bgKey) return;
    const old = this.bg, img = this.add.image(DESIGN.width / 2, DESIGN.height / 2, key).setDepth(0);
    img.setScale(Math.max(DESIGN.width / img.width, DESIGN.height / img.height));
    if (key !== selectBg().key && key !== ATLAS.textures.map.key) img.setTint(0x9c9c9c);
    this.bg = img; this.bgKey = key;
    if (!old) return;
    if (!fade) { old.destroy(); return; }
    img.setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, duration: 320, ease: 'Sine.easeOut', onComplete: () => old.destroy() });
  }

  /** VS PLAYER: the room of the link (or a new one, written into the link) and its select-screen channel. */
  private openLobby(): void {
    if (this.lobby) return;
    const room = ensurePvpRoomInUrl();
    const lobby = this.lobby = new PvpLobby(room, fighterFor(this.hover).name, () => this.syncNet());
    this.syncNet();
    void lobby.join(this.hover);
  }

  private closeLobby(): void {
    this.lobby?.close(); this.lobby = undefined;
    clearPvpFromUrl();
  }

  private syncNet(): void {
    const l = this.lobby; if (!l || !this.ui) return;
    const o = l.other;
    this.ui.setNet({ status: l.status, room: l.room, link: window.location.href, local: l.kind === 'Local' }, o ? { name: o.name, hover: o.hover, pick: o.pick, rank: o.rank } : null);
  }

  /** Both locked in: into the arena — against the CPU (or with your training partner) in a room of your own on the stage
   *  you picked, or with the other player in the shared one (its stage comes from the room, the same on both screens). */
  private start(p1: string, p2: string, mode: VsMode, stage?: string, level?: BotLevel): void {
    const fighter = fighterFor(p1);
    if (mode !== 'player') this.scene.start('LegacyCourtyardScene', { pvpRoom: generateRoomId(6), fighter, botCls: p2, botLevel: level, vs: mode, stage });
    else this.scene.start('LegacyCourtyardScene', { pvpRoom: this.lobby?.room ?? ensurePvpRoomInUrl(), fighter, vs: 'player', foe: { cls: p2, name: this.lobby?.other?.name || 'Player 2', rank: this.lobby?.other?.rank } }); // (foe: for the loading screen — with their rank)
  }

  private leave(go: () => void): void {
    const cam = this.cameras.main;
    cam.fadeOut(220, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
  }
}

/** PVP 3D: cherry petals drifting down over the 3D courtyard on the wind (its trees shed them in the fight too) — most
 *  behind the fighters, one in four in front of them, each turning and flipping as it falls. */
function addPetals(scene: Phaser.Scene, count: number): void {
  const key = petalTex(scene), W = DESIGN.width, H = DESIGN.height;
  type Petal = { img: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; rot: number; spin: number; ph: number; s: number };
  const spawn = (img: Phaser.GameObjects.Image | null, first: boolean, front: boolean): Petal => {
    const im = img ?? scene.add.image(0, 0, key).setDepth(front ? 3 : 1.5).setAlpha(front ? 0.9 : 0.62);
    return { img: im, x: -120 + Math.random() * (W + 160), y: first ? Math.random() * H : -30 - Math.random() * 260, vx: 22 + Math.random() * 34,
      vy: (front ? 72 : 44) + Math.random() * 36, rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 3.2, ph: Math.random() * 6.28, s: (front ? 1 : 0.55) + Math.random() * 0.45 };
  };
  const all: Petal[] = [];
  for (let i = 0; i < count; i++) all.push(spawn(null, true, i % 4 === 0));
  const tick = (_t: number, dt: number) => {
    const k = Math.min(dt, 50) / 1000;
    all.forEach((p, i) => {
      p.x += (p.vx + Math.sin(p.y / 95 + p.ph) * 28) * k; p.y += p.vy * k; p.rot += p.spin * k;
      if (p.y > H + 30 || p.x > W + 60) { all[i] = spawn(p.img, false, p.img.depth === 3); return; }
      p.img.setPosition(p.x, p.y).setRotation(p.rot).setScale(p.s, p.s * (0.3 + 0.7 * Math.abs(Math.cos(p.y / 70 + p.ph)))); // (flipping: edge-on, then flat)
    });
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
}

/** A cherry petal: a soft teardrop, notched at its tip, pale pink to white. */
function petalTex(scene: Phaser.Scene): string {
  const key = 'ps-petal';
  if (scene.textures.exists(key)) return key;
  const W = 30, H = 20, c = scene.textures.createCanvas(key, W, H)!, ctx = c.getContext();
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#f2a6bf'); g.addColorStop(0.65, '#ffdbe7'); g.addColorStop(1, '#fff5f8');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(1, H / 2);
  ctx.bezierCurveTo(W * 0.35, -1, W * 0.86, 1, W - 1, H * 0.36);
  ctx.lineTo(W * 0.84, H / 2); ctx.lineTo(W - 1, H * 0.64); // (the notch)
  ctx.bezierCurveTo(W * 0.86, H - 1, W * 0.35, H + 1, 1, H / 2);
  ctx.fill(); c.refresh();
  return key;
}

/** The light over the arena behind the fighters: warm on your side, cold on theirs, darker at the top and the bottom
 *  (where the score and the roster sit). Drawn once at a quarter size (smooth gradients), stretched to the screen.
 *  `light` (PVP 3D): lighter through the middle, so the 3D courtyard reads behind the fighters. */
function washTex(scene: Phaser.Scene, light = false): string {
  const key = light ? 'ps-wash-3d' : 'ps-wash';
  if (scene.textures.exists(key)) return key;
  const W = 480, H = 270, q = W / DESIGN.width, c = scene.textures.createCanvas(key, W, H)!, ctx = c.getContext();
  const lin = ctx.createLinearGradient(0, 0, 0, H), a = light ? [0.56, 0.14, 0.26, 0.88] : [0.66, 0.28, 0.38, 0.9];
  lin.addColorStop(0, `rgba(3,5,10,${a[0]})`); lin.addColorStop(0.3, `rgba(3,5,10,${a[1]})`); lin.addColorStop(0.62, `rgba(3,5,10,${a[2]})`); lin.addColorStop(1, `rgba(3,5,10,${a[3]})`);
  ctx.fillStyle = lin; ctx.fillRect(0, 0, W, H);
  const glow = (x: number, rgb: string, a: number) => { // an ellipse 760 x 900 at (x, 640), fading out by 70% of it
    ctx.save(); ctx.translate(x * q, 640 * q); ctx.scale(760 / 900, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 900 * q);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.7, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(-1300 * q, -1000 * q, 2600 * q, 2000 * q); ctx.restore();
  };
  glow(1540, '56,128,232', 0.32); glow(380, '214,92,40', 0.34);
  c.refresh();
  return key;
}
