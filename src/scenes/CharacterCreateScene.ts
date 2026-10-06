import Phaser from 'phaser';
import { CHARACTER_CREATE as L, COLORS, DESIGN } from '../config/layout';
import { CharacterCreateUI, CreateLook } from '../ui/CharacterCreateUI';

/** The new character on the pedestal, dressed as chosen: back hair, the dressed body (starter outfit, sword), each piece in
 *  its colour, the hair over the head — one image each, the same size as the menu figure (tools/base/outfit/outfit_layers.py). */
const G_ = (g: CreateLook['gender']) => (g === 'male' ? 'Male' : 'Female');
const lookFiles = (l: CreateLook): [string, string][] => {
  const G = G_(l.gender), B = 'assets/characters/base';
  return [
    [`cc.${G}.hair${l.hair}b`, `${B}/hair/${G}_${l.hair}_back.png`],
    [`cc.${G}.body`, `${B}/outfit/${G}_body.png`],
    [`cc.${G}.pants${l.pants}`, `${B}/outfit/${G}_pants_${l.pants}.png`],
    [`cc.${G}.shoes${l.shoes}`, `${B}/outfit/${G}_shoes_${l.shoes}.png`],
    [`cc.${G}.top${l.top}`, `${B}/outfit/${G}_top_${l.top}.png`],
    [`cc.${G}.hair${l.hair}f`, `${B}/hair/${G}_${l.hair}_front.png`],
  ];
};
const FIRST: CreateLook = { gender: 'male', hair: 0, top: 0, pants: 0, shoes: 0 };

// Background, pedestal and the dressed preview; all UI lives in CharacterCreateUI (DOM overlay).
export class CharacterCreateScene extends Phaser.Scene {
  private ui?: CharacterCreateUI;

  constructor() { super('CharacterCreateScene'); }

  preload(): void {
    for (const [k, f] of lookFiles(FIRST)) if (!this.textures.exists(k)) this.load.image(k, f); // the first look shown
  }

  create(): void {
    const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, 'characterSelect.background');
    bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height));

    const P = L.preview;
    const g = this.add.graphics();
    g.fillStyle(0x05080d, 0.55).fillEllipse(P.centerX, P.pedestalY, P.rx * 2, P.ry * 2);
    g.lineStyle(2, COLORS.gold, 0.55).strokeEllipse(P.centerX, P.pedestalY, P.rx * 2, P.ry * 2);
    g.lineStyle(1, COLORS.gold, 0.35).strokeEllipse(P.centerX, P.pedestalY, P.rx * 1.45, P.ry * 1.1);

    // The new character: the clean base, dressed in the starter outfit with the chosen hair and colours.
    const layers = Array.from({ length: 6 }, () => this.add.image(P.centerX, P.top + P.height, '__DEFAULT').setOrigin(0.5, 1).setVisible(false));
    let want: CreateLook = FIRST;
    const apply = () => {
      const files = lookFiles(want);
      if (!files.every(([k]) => this.textures.exists(k))) return; // the rest still loading
      const body = this.textures.get(files[1][0]).getSourceImage() as HTMLImageElement;
      const s = (P.height * 0.84) / body.height; // the bare figure fills its image: a little smaller than the class paintings
      files.forEach(([k], i) => layers[i].setTexture(k).setScale(s).setVisible(true));
    };
    const dress = (l: CreateLook) => {
      want = l;
      const missing = lookFiles(l).filter(([k]) => !this.textures.exists(k));
      if (!missing.length) { apply(); return; }
      for (const [k, f] of missing) this.load.image(k, f);
      this.load.once(Phaser.Loader.Events.COMPLETE, apply);
      if (!this.load.isLoading()) this.load.start();
    };
    dress(FIRST);

    this.ui = new CharacterCreateUI(this.game.canvas.parentElement!, this.game.canvas, {
      onBack: () => this.scene.start('CharacterSelectScene'),
      onCreated: () => this.scene.start('CharacterSelectScene'),
      onClassChange: () => { /* the class is chosen; the character shown stays the base body */ },
      onLookChange: dress,
    });
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.ui?.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.ui?.destroy();
      this.ui = undefined;
    });
  }
}
