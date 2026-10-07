import Phaser from 'phaser';
import { ASSETS, DESIGN, LOGO } from '../config/layout';
import { MainMenuUI } from '../ui/MainMenuUI';
import { clearPvpFromUrl } from '../pvp/Room';
import { addCapeWind, addGemLife, addGemPulse, addMotes, addSkyAndMist, addSunLight, addWaterGlints, preloadLife } from '../ui/PresentationLife';

/** Centre of the logo's red gem in logo image pixels (measured on the art). */
const LOGO_GEM = { x: 595.7, y: 325.2, radius: 78 };
/** Hero cape in the background painting (image px) and its colour key. */
const CAPE = { x: 160, y: 450, w: 280, h: 260 };
const isCape = (r: number, g: number, b: number) => r > 60 && r > g * 1.55 && r > b * 1.4;
const TRANSITION_MS = 260;
/** Sun in the painting (image px). */
const SUN = { x: 1592, y: 207 };

export class MainMenuScene extends Phaser.Scene {
  private leaving = false;

  constructor() { super('MainMenuScene'); }

  preload(): void { preloadLife(this); }

  create(): void {
    clearPvpFromUrl(); // the menu is never a PvP link
    this.leaving = false;
    // Background: cover-style, aspect preserved. The picture itself stays still (no pointer parallax, no ripple over it):
    // only small touches live on it — the sun, the lake's glitter, a few motes, the hero's cape, the logo's gem.
    const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, ASSETS.background.key);
    bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height));
    const k0 = bg.scaleX, ox = bg.x - bg.displayWidth / 2, oy = bg.y - bg.displayHeight / 2; // painting px -> screen
    addSkyAndMist(this, 1); // faint cloud wisps drifting high in the sky
    addSunLight(this, { x: ox + SUN.x * k0, y: oy + SUN.y * k0 }, 1);
    addWaterGlints(this, { x: ox + 1470 * k0, y: oy + 300 * k0, w: 240 * k0, h: 95 * k0 }, 14, 2);
    addCapeWind(this, ASSETS.background.key, bg, CAPE, isCape);
    addMotes(this, { x: 520, y: 420, w: 880, h: 640 }, 16, { depth: 0, size: [10, 22], speed: [7, 15], alpha: 0.75 });

    // Logo: centered, top-anchored, fixed display width.
    const logo = this.add.image(LOGO.centerX, LOGO.top, ASSETS.logo.key).setOrigin(0.5, 0).setDepth(5); // over the living sky
    logo.setScale(LOGO.width / logo.width);
    const k = LOGO.width / logo.width;
    const gemAt = { x: LOGO.centerX + (LOGO_GEM.x - logo.width / 2) * k, y: LOGO.top + LOGO_GEM.y * k };
    addGemPulse(this, gemAt, LOGO_GEM.radius * k);
    addGemLife(this, gemAt, LOGO_GEM.radius * k * 0.55);

    this.cameras.main.fadeIn(220, 0, 0, 0);
    new MainMenuUI(this, {
      onStart: () => this.leave(() => this.scene.start('CharacterSelectScene')),
    });
  }

  /** 260 ms fade + slight zoom into the next scene (never an abrupt cut). */
  private leave(go: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main;
    cam.zoomTo(1.025, TRANSITION_MS, 'Sine.easeIn');
    cam.fadeOut(TRANSITION_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
  }
}
