import Phaser from 'phaser';
import { addClothWind } from '../ui/VisualLife';
import { CHARACTER_CREATE as L, CHARACTER_PREVIEWS, COLORS, DESIGN } from '../config/layout';
import { CharacterCreateUI } from '../ui/CharacterCreateUI';
import { ThroneHero, preloadThrone } from '../ui/ThronePresence';

// Background, pedestal and Warrior preview; all UI lives in CharacterCreateUI (DOM overlay).
export class CharacterCreateScene extends Phaser.Scene {
  private ui?: CharacterCreateUI;

  constructor() { super('CharacterCreateScene'); }

  preload(): void { preloadThrone(this); }

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
    addClothWind(this, hero); // subtle cloak wind (render only)
    // Warrior: seated on his throne with the sword of light (animated painting) instead of the standing preview.
    const throne = this.textures.exists('throne.hero') ? new ThroneHero(this, { x: P.centerX, y: 900 }, 700, 2) : null;
    // The new character is the clean base (male / female): he / she stands on the pedestal whatever the class.
    const showBase = (gender: 'male' | 'female') => {
      const pv = CHARACTER_PREVIEWS[`base/${gender}`];
      if (!pv) return;
      throne?.setVisible(false); hero.setVisible(true); g.setVisible(true);
      hero.setTexture(pv.key).setData('calm', true);
      hero.setScale((P.height * 0.84) / hero.height); // the bare figure fills its image: a little smaller than the class paintings
    };
    showBase('male');

    this.ui = new CharacterCreateUI(this.game.canvas.parentElement!, this.game.canvas, {
      onBack: () => this.scene.start('CharacterSelectScene'),
      onCreated: () => this.scene.start('CharacterSelectScene'),
      onClassChange: () => { /* the class is chosen; the character shown stays the base body */ },
      onGenderChange: showBase,
    });
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.ui?.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.ui?.destroy();
      this.ui = undefined;
    });
  }
}
