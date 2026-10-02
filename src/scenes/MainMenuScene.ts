import Phaser from 'phaser';
import { ASSETS, DESIGN, LOGO } from '../config/layout';
import { MainMenuUI } from '../ui/MainMenuUI';
import { clearPvpFromUrl } from '../pvp/Room';
import { enterPvp } from '../pvp/enterPvp';
import { addLogoGlow } from '../ui/VisualLife';

/** Centre of the logo's red gem in logo image pixels (measured on the art). */
const LOGO_GEM = { x: 595.7, y: 325.2, radius: 78 };

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }

  create(): void {
    clearPvpFromUrl(); // the menu is never a PvP link
    // Background: cover-style, aspect preserved.
    const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, ASSETS.background.key);
    bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height));

    // Logo: centered, top-anchored, fixed display width.
    const logo = this.add.image(LOGO.centerX, LOGO.top, ASSETS.logo.key).setOrigin(0.5, 0);
    logo.setScale(LOGO.width / logo.width);
    const k = LOGO.width / logo.width;
    addLogoGlow(this, { x: LOGO.centerX + (LOGO_GEM.x - logo.width / 2) * k, y: LOGO.top + LOGO_GEM.y * k }, LOGO_GEM.radius * k);

    new MainMenuUI(this, {
      onStart: () => this.scene.start('CharacterSelectScene'),
      onPvp: () => enterPvp(this),
    });
  }
}
