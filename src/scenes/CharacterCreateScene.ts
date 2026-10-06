import Phaser from 'phaser';
import { CHARACTER_CREATE as L, COLORS, DESIGN } from '../config/layout';
import { CharacterCreateUI, CreateLook, FIRST_LOOK } from '../ui/CharacterCreateUI';
import { lookFiles, lookIconLayers, lookIcons, queueLayers } from '../characters/LookArt';
import { toneTexture } from '../characters/Skin';
import MENU_LOOK from '../data/menu-look.json';

/** The new character on the pedestal, dressed as chosen: back hair, the dressed body (starter outfit, sword) in its skin
 *  tone, the face, each piece in its colour, the forehead between the bangs, the hair over the head — one image each,
 *  all on the menu canvas (tools/base/outfit/outfit_layers.py, tools/base/naked_frames.py). The face and hairstyle
 *  buttons are pictures of this same look, redrawn with every choice. */
const FIT = MENU_LOOK as Record<string, { fit: number }>;

// Background, pedestal and the dressed preview; all UI lives in CharacterCreateUI (DOM overlay).
export class CharacterCreateScene extends Phaser.Scene {
  private ui?: CharacterCreateUI;

  constructor() { super('CharacterCreateScene'); }

  preload(): void {
    queueLayers(this, [...lookFiles(FIRST_LOOK), ...lookIconLayers(FIRST_LOOK)]); // the first look shown and its buttons
  }

  create(): void {
    const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, 'characterSelect.background');
    bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height));

    const P = L.preview;
    const g = this.add.graphics();
    g.fillStyle(0x05080d, 0.55).fillEllipse(P.centerX, P.pedestalY, P.rx * 2, P.ry * 2);
    g.lineStyle(2, COLORS.gold, 0.55).strokeEllipse(P.centerX, P.pedestalY, P.rx * 2, P.ry * 2);
    g.lineStyle(1, COLORS.gold, 0.35).strokeEllipse(P.centerX, P.pedestalY, P.rx * 1.45, P.ry * 1.1);

    // The new character: the clean base, dressed in the starter outfit with the chosen face, hair, skin and colours.
    const layers: Phaser.GameObjects.Image[] = [];
    let want: CreateLook = FIRST_LOOK, ver = 0;
    const apply = (v: number) => {
      if (v !== ver) return; // a newer choice is on its way
      const l = want, files = lookFiles(l);
      const keys = files.map(([k, , toned]) => (toned ? toneTexture(this, k, l.skin) : this.textures.exists(k) ? k : null));
      if (keys.some((k) => !k)) return; // the rest still loading
      const s = (P.height * 0.84) / FIT[l.gender].fit; // sized by the figure (the canvas has room above for the hair)
      while (layers.length < keys.length) layers.push(this.add.image(P.centerX, P.top + P.height, '__DEFAULT').setOrigin(0.5, 1));
      layers.forEach((im, i) => { if (i < keys.length) im.setTexture(keys[i]!).setScale(s).setVisible(true); else im.setVisible(false); });
      const icons = lookIcons(this, l);
      if (icons) this.ui?.setIcons(icons);
    };
    const dress = (l: CreateLook) => {
      want = l; const v = ++ver;
      if (!queueLayers(this, [...lookFiles(l), ...lookIconLayers(l)])) { apply(v); return; }
      this.load.once(Phaser.Loader.Events.COMPLETE, () => apply(v));
      if (!this.load.isLoading()) this.load.start();
    };

    this.ui = new CharacterCreateUI(this.game.canvas.parentElement!, this.game.canvas, {
      onBack: () => this.scene.start('CharacterSelectScene'),
      onCreated: () => this.scene.start('CharacterSelectScene'),
      onClassChange: () => { /* the class is chosen; the character shown stays the base body */ },
      onLookChange: dress,
    });
    apply(ver); // the buttons' pictures (the first look was dressed before the panel existed)
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.ui?.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.ui?.destroy();
      this.ui = undefined;
    });
  }
}
