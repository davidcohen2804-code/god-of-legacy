import Phaser from 'phaser';
import { CHARACTER_CREATE as L, CHARACTER_PREVIEWS, COLORS, DESIGN } from '../config/layout';
import { CharacterCreateUI } from '../ui/CharacterCreateUI';

// Background, pedestal and Warrior preview; all UI lives in CharacterCreateUI (DOM overlay).
export class CharacterCreateScene extends Phaser.Scene {
  private ui?: CharacterCreateUI;

  constructor() { super('CharacterCreateScene'); }

  create(): void {
    const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, 'characterSelect.background');
    bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height));

    const P = L.preview;
    const g = this.add.graphics();
    g.fillStyle(0x05080d, 0.55).fillEllipse(P.centerX, P.pedestalY, P.rx * 2, P.ry * 2);
    g.lineStyle(2, COLORS.gold, 0.55).strokeEllipse(P.centerX, P.pedestalY, P.rx * 2, P.ry * 2);
    g.lineStyle(1, COLORS.gold, 0.35).strokeEllipse(P.centerX, P.pedestalY, P.rx * 1.45, P.ry * 1.1);

    // Selected class preview: aspect ratio preserved, fixed display height, feet on the pedestal.
    const hero = this.add.image(P.centerX, P.top + P.height, 'characterCreate.warriorPreview').setOrigin(0.5, 1);
    const showPreview = (classId: string, appearanceId: string) => {
      const pv = CHARACTER_PREVIEWS[`${classId}/${appearanceId}`];
      if (!pv) return;
      hero.setTexture(pv.key);
      hero.setScale(P.height / hero.height);
    };

    this.ui = new CharacterCreateUI(this.game.canvas.parentElement!, this.game.canvas, {
      onBack: () => this.scene.start('CharacterSelectScene'),
      onCreated: () => this.scene.start('CharacterSelectScene'),
      onClassChange: showPreview,
    });
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.ui?.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.ui?.destroy();
      this.ui = undefined;
    });
  }
}
