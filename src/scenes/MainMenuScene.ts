import Phaser from 'phaser';
import { ASSETS, DESIGN, LOGO } from '../config/layout';
import { MainMenuUI } from '../ui/MainMenuUI';
import { clearPvpFromUrl } from '../pvp/Room';
import { addCapeWind, addGemPulse, addLightSweep, addMotes, addParallax, preloadLife } from '../ui/PresentationLife';

/** Centre of the logo's red gem in logo image pixels (measured on the art). */
const LOGO_GEM = { x: 595.7, y: 325.2, radius: 78 };
/** Hero cape in the background painting (image px) and its colour key. */
const CAPE = { x: 160, y: 450, w: 280, h: 260 };
const isCape = (r: number, g: number, b: number) => r > 60 && r > g * 1.55 && r > b * 1.4;
const TRANSITION_MS = 260;

export class MainMenuScene extends Phaser.Scene {
  private leaving = false;

  constructor() { super('MainMenuScene'); }

  preload(): void { preloadLife(this); }

  create(): void {
    clearPvpFromUrl(); // the menu is never a PvP link
    this.leaving = false;
    // Background: cover-style, aspect preserved, with a few px of bleed for the pointer parallax.
    const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, ASSETS.background.key);
    bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height) * 1.008);
    const cape = addCapeWind(this, ASSETS.background.key, bg, CAPE, isCape);
    const sweep = addLightSweep(this, { x: 900, y: -40, w: 1060, h: 700 }, 0);
    const motes = addMotes(this, { x: 520, y: 420, w: 880, h: 640 }, 16, { depth: 0, size: [10, 22], speed: [7, 15], alpha: 0.75 });

    // Logo: centered, top-anchored, fixed display width.
    const logo = this.add.image(LOGO.centerX, LOGO.top, ASSETS.logo.key).setOrigin(0.5, 0);
    logo.setScale(LOGO.width / logo.width);
    const k = LOGO.width / logo.width;
    const gem = addGemPulse(this, { x: LOGO.centerX + (LOGO_GEM.x - logo.width / 2) * k, y: LOGO.top + LOGO_GEM.y * k }, LOGO_GEM.radius * k);

    const layers: { obj: { x: number; y: number }; px: number }[] = [{ obj: bg, px: 6 }, { obj: sweep, px: 6 }, { obj: motes, px: 4 }, { obj: logo, px: 3 }, { obj: gem, px: 3 }];
    if (cape) layers.push({ obj: cape, px: 6 });
    addParallax(this, layers, { x: DESIGN.width / 2, y: DESIGN.height / 2 });

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
