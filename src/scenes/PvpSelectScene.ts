// PvP fighter select (Tekken style) before the arena: VS CPU (you pick your fighter, then the one you fight) or VS PLAYER
// (an invite link; the other player picks on their own screen, both see each other's choice). Background: the arena itself,
// under a light of each side's colour; the two fighters alive on it (FighterArt) and the select overlay (DOM) on top.
import Phaser from 'phaser';
import { DESIGN } from '../config/layout';
import ATLAS from '../data/asset-manifest.json';
import { CharacterStore } from '../characters/CharacterStore';
import { ROSTER, fighterFor, heroCard } from '../pvp/Fighters';
import { PvpLobby } from '../pvp/PvpLobby';
import { clearPvpFromUrl, ensurePvpRoomInUrl, generateRoomId } from '../pvp/Room';
import { PvpSelectUI, VsMode } from '../ui/PvpSelectUI';
import { score, scoreKey } from '../pvp/Score';
import { addMotes, preloadLife } from '../ui/PresentationLife';
import { FighterArt } from '../ui/FighterArt';

/** The select screen's backdrop: the arena's courtyard by night. */
const SELECT_BG = 'pvp-select-bg';

export interface PvpSelectData { mode?: VsMode; p1?: string; p2?: string }

export class PvpSelectScene extends Phaser.Scene {
  private ui?: PvpSelectUI;
  private lobby?: PvpLobby;
  private hover = 'samurai';
  private arts?: Record<'l' | 'r', FighterArt>;

  constructor() { super('PvpSelectScene'); }

  preload(): void {
    const T = ATLAS.textures;
    if (!this.textures.exists(T.map.key)) this.load.image(T.map.key, T.map.file);
    if (!this.textures.exists(SELECT_BG)) this.load.image(SELECT_BG, 'assets/character_select/pvp_select_bg.webp'); // the courtyard by night
    for (const c of ROSTER) { const hc = heroCard(c); if (hc && !this.textures.exists(`hero-card-${c}`)) this.load.image(`hero-card-${c}`, hc.file); } // the heroes' cards
    preloadLife(this); // (the embers)
  }

  create(data?: PvpSelectData): void {
    const mode: VsMode = data?.mode ?? 'cpu';
    this.cameras.main.fadeIn(240, 0, 0, 0);
    const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, this.textures.exists(SELECT_BG) ? SELECT_BG : ATLAS.textures.map.key);
    bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height));
    this.add.image(0, 0, washTex(this)).setOrigin(0).setDisplaySize(DESIGN.width, DESIGN.height).setDepth(1);
    this.arts = { l: new FighterArt(this, 'l'), r: new FighterArt(this, 'r') };
    const sel = CharacterStore.getSelectedCharacter();
    this.hover = data?.p1 ?? (sel && (ROSTER as readonly string[]).includes(sel.classId) ? sel.classId : 'samurai');
    this.ui = new PvpSelectUI(this.game.canvas.parentElement!, this.game.canvas, {
      back: () => this.leave(() => { clearPvpFromUrl(); this.scene.start('MainMenuScene'); }),
      mode: (m) => { if (m === 'player') this.openLobby(); else this.closeLobby(); this.ui?.setScore(score(scoreKey(m, this.lobby?.room))); },
      local: (hover, pick) => { this.hover = hover; this.lobby?.set(hover, pick, fighterFor(hover).name); },
      start: (p1, p2, m) => this.start(p1, p2, m),
      copyLink: async () => { try { await navigator.clipboard.writeText(window.location.href); return true; } catch { return false; } },
      art: (s, cls, state) => this.arts?.[s].set(cls, state),
      lock: (s) => this.arts?.[s].lock(),
    }, { mode, p1: this.hover, p2: data?.p2 });
    if (mode === 'player') this.openLobby(); else clearPvpFromUrl();
    this.ui.setScore(score(scoreKey(mode, this.lobby?.room)));
    addMotes(this, { x: 0, y: 80, w: DESIGN.width, h: 900 }, 26, { depth: 3, size: [8, 20], speed: [10, 22], alpha: 0.55 }); // embers drifting over the arena (and the fighters)
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.layout, this);
      this.ui?.destroy(); this.ui = undefined; this.arts = undefined;
      this.lobby?.close(); this.lobby = undefined; // (the link stays in the address bar: the arena is that room)
    });
  }

  private layout(): void { this.ui?.layout(); }

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
    this.ui.setNet({ status: l.status, room: l.room, link: window.location.href, local: l.kind === 'Local' }, o ? { name: o.name, hover: o.hover, pick: o.pick } : null);
  }

  /** Both locked in: into the arena — against the CPU in a room of your own, or with the other player in the shared one. */
  private start(p1: string, p2: string, mode: VsMode): void {
    const fighter = fighterFor(p1);
    if (mode === 'cpu') this.scene.start('LegacyCourtyardScene', { pvpRoom: generateRoomId(6), fighter, botCls: p2, vs: 'cpu' });
    else this.scene.start('LegacyCourtyardScene', { pvpRoom: this.lobby?.room ?? ensurePvpRoomInUrl(), fighter, vs: 'player' });
  }

  private leave(go: () => void): void {
    const cam = this.cameras.main;
    cam.fadeOut(220, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
  }
}

/** The light over the arena behind the fighters: warm on your side, cold on theirs, darker at the top and the bottom
 *  (where the score and the roster sit). Drawn once at a quarter size (smooth gradients), stretched to the screen. */
function washTex(scene: Phaser.Scene): string {
  const key = 'ps-wash';
  if (scene.textures.exists(key)) return key;
  const W = 480, H = 270, q = W / DESIGN.width, c = scene.textures.createCanvas(key, W, H)!, ctx = c.getContext();
  const lin = ctx.createLinearGradient(0, 0, 0, H);
  lin.addColorStop(0, 'rgba(3,5,10,.66)'); lin.addColorStop(0.3, 'rgba(3,5,10,.28)'); lin.addColorStop(0.62, 'rgba(3,5,10,.38)'); lin.addColorStop(1, 'rgba(3,5,10,.9)');
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
