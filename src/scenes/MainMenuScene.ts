import Phaser from 'phaser';
import { ASSETS, DESIGN, LOGO } from '../config/layout';
import { MainMenuUI } from '../ui/MainMenuUI';
import { clearPvpFromUrl } from '../pvp/Room';
import { enterPvp } from '../pvp/enterPvp';

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

    new MainMenuUI(this, {
      onStart: () => this.scene.start('CharacterSelectScene'),
      onPvp: () => enterPvp(this),
    });
  }
}
