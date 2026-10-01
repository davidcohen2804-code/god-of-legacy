import Phaser from 'phaser';
import { CHARACTER_SELECT as L, COLORS, DESIGN } from '../config/layout';
import { CharacterSelectUI } from '../ui/CharacterSelectUI';

// Background/world presentation only; all UI lives in CharacterSelectUI (DOM overlay).
export class CharacterSelectScene extends Phaser.Scene {
  private ui?: CharacterSelectUI;

  constructor() { super('CharacterSelectScene'); }

  create(): void {
    const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, 'characterSelect.background');
    bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height));

    // Subtle pedestal / rune for the future character preview (no figure).
    const P = L.preview, cx = (P.x0 + P.x1) / 2, cy = P.pedestalY;
    const g = this.add.graphics();
    g.fillStyle(0x05080d, 0.55).fillEllipse(cx, cy, P.rx * 2, P.ry * 2);
    g.lineStyle(2, COLORS.gold, 0.55).strokeEllipse(cx, cy, P.rx * 2, P.ry * 2);
    g.lineStyle(1, COLORS.gold, 0.35).strokeEllipse(cx, cy, P.rx * 1.45, P.ry * 1.1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = cx + Math.cos(a) * P.rx * 0.86, y = cy + Math.sin(a) * P.ry * 0.86;
      g.fillStyle(COLORS.gold, 0.4).fillCircle(x, y, 2);
    }

    this.ui = new CharacterSelectUI(this.game.canvas.parentElement!, this.game.canvas, {
      onBack: () => this.scene.start('MainMenuScene'),
      onCreate: () => this.scene.start('CharacterCreateScene'),
      onEnterWorld: () => this.scene.start('LegacyCourtyardScene'),
    });
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.ui?.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.ui?.destroy();
      this.ui = undefined;
    });
  }
}
