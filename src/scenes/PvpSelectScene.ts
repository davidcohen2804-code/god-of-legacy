// PvP fighter select (Tekken style) before the arena: VS CPU (you pick your fighter, then the one you fight) or VS PLAYER
// (an invite link; the other player picks on their own screen, both see each other's choice). Background: the arena itself.
import Phaser from 'phaser';
import { DESIGN } from '../config/layout';
import ATLAS from '../data/asset-manifest.json';
import { CharacterStore } from '../characters/CharacterStore';
import { ROSTER, fighterFor, previewOf } from '../pvp/Fighters';
import { PvpLobby } from '../pvp/PvpLobby';
import { clearPvpFromUrl, ensurePvpRoomInUrl, generateRoomId } from '../pvp/Room';
import { PvpSelectUI, VsMode } from '../ui/PvpSelectUI';
import { score, scoreKey } from '../pvp/Score';
import { addMotes } from '../ui/PresentationLife';

export interface PvpSelectData { mode?: VsMode; p1?: string; p2?: string }

export class PvpSelectScene extends Phaser.Scene {
  private ui?: PvpSelectUI;
  private lobby?: PvpLobby;
  private hover = 'samurai';

  constructor() { super('PvpSelectScene'); }

  preload(): void {
    const T = ATLAS.textures;
    if (!this.textures.exists(T.map.key)) this.load.image(T.map.key, T.map.file);
    for (const c of ROSTER) { const pv = previewOf(c); if (pv && !this.textures.exists(pv.key)) this.load.image(pv.key, pv.file); } // (warms the pictures the screen shows)
  }

  create(data?: PvpSelectData): void {
    const mode: VsMode = data?.mode ?? 'cpu';
    this.cameras.main.fadeIn(240, 0, 0, 0);
    const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, ATLAS.textures.map.key);
    bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height));
    const sel = CharacterStore.getSelectedCharacter();
    this.hover = data?.p1 ?? (sel && (ROSTER as readonly string[]).includes(sel.classId) ? sel.classId : 'samurai');
    this.ui = new PvpSelectUI(this.game.canvas.parentElement!, this.game.canvas, {
      back: () => this.leave(() => { clearPvpFromUrl(); this.scene.start('MainMenuScene'); }),
      mode: (m) => { if (m === 'player') this.openLobby(); else this.closeLobby(); this.ui?.setScore(score(scoreKey(m, this.lobby?.room))); },
      local: (hover, pick) => { this.hover = hover; this.lobby?.set(hover, pick, fighterFor(hover).name); },
      start: (p1, p2, m) => this.start(p1, p2, m),
      copyLink: async () => { try { await navigator.clipboard.writeText(window.location.href); return true; } catch { return false; } },
    }, { mode, p1: this.hover, p2: data?.p2 });
    if (mode === 'player') this.openLobby(); else clearPvpFromUrl();
    this.ui.setScore(score(scoreKey(mode, this.lobby?.room)));
    addMotes(this, { x: 0, y: 80, w: DESIGN.width, h: 900 }, 26, { depth: 2, size: [8, 20], speed: [10, 22], alpha: 0.7 }); // embers drifting over the arena
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.layout, this);
      this.ui?.destroy(); this.ui = undefined;
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
