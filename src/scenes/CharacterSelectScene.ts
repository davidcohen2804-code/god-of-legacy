import Phaser from 'phaser';
import { CHARACTER_SELECT as L, CHARACTER_SELECT_PREVIEW as PV, COLORS, DESIGN, STAGE6 } from '../config/layout';
import S6 from '../data/stage6-combat.json';
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

    // Stage 6: soft pulsing floor effect under the selected character only (below the hero, centered on the feet).
    const FX = STAGE6.floorFx;
    const floor = this.add.image(FX.centerX, FX.centerY, FX.key).setVisible(false);
    const base = FX.displayWidth / floor.width;
    const [a0, a1] = S6.fx.characterSelectFloorAlpha, [s0, s1] = S6.fx.characterSelectFloorScale;
    const pulse = { t: 0 };
    floor.setAlpha(a0).setScale(base * s0);
    this.tweens.add({
      targets: pulse, t: 1, duration: S6.fx.characterSelectFloorPulseMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: () => floor.setAlpha(a0 + (a1 - a0) * pulse.t).setScale(base * (s0 + (s1 - s0) * pulse.t)),
    });

    // Selected character's full-body preview, feet on the platform (hidden when no character is selected).
    const hero = this.add.image(PV.centerX, PV.feetY, 'characterCreate.warriorPreview').setOrigin(0.5, 1).setVisible(false);
    hero.setScale(PV.height / hero.height);

    this.ui = new CharacterSelectUI(this.game.canvas.parentElement!, this.game.canvas, {
      onBack: () => this.scene.start('MainMenuScene'),
      onCreate: () => this.scene.start('CharacterCreateScene'),
      onEnterWorld: () => this.scene.start('LegacyCourtyardScene'),
      onPreview: (key) => { if (key) hero.setTexture(key); hero.setVisible(!!key); floor.setVisible(!!key); },
    });
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.ui?.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.ui?.destroy();
      this.ui = undefined;
    });
  }
}
