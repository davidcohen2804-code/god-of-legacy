import Phaser from 'phaser';
import { COLORS, DESIGN, FONT_FAMILY, PLACEHOLDER } from '../config/layout';
import { createTextButton } from '../ui/SettingsModal';

/** Shared minimal placeholder: dark background, centered text, BACK to Character Select. */
export abstract class PlaceholderScene extends Phaser.Scene {
  protected abstract readonly label: string;

  create(): void {
    this.cameras.main.setBackgroundColor('#05080d');
    this.add.text(DESIGN.width / 2, DESIGN.height / 2, this.label, {
      fontFamily: FONT_FAMILY, fontSize: `${PLACEHOLDER.textSize}px`, color: COLORS.text,
    }).setOrigin(0.5);
    const B = PLACEHOLDER.back;
    createTextButton(this, DESIGN.width / 2, B.y, B.w, B.h, 'BACK',
      () => this.scene.start('CharacterSelectScene'));
  }
}
