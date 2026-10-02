import Phaser from 'phaser';
import { CHARACTER_SELECT as L, CHARACTER_SELECT_PREVIEW as PV, COLORS, DESIGN, SELECT_HALO } from '../config/layout';
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

    // Contact shadow + one soft golden halo under the boots, concentric with the pedestal ellipse, slow pulse.
    const HL = SELECT_HALO;
    if (!this.textures.exists('select-halo')) {
      const c = this.textures.createCanvas('select-halo', 256, 256)!, ctx = c.getContext();
      const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,214,140,0.95)'); gr.addColorStop(0.45, 'rgba(232,180,95,0.55)');
      gr.addColorStop(0.78, 'rgba(201,154,69,0.22)'); gr.addColorStop(1, 'rgba(201,154,69,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 256);
      c.refresh();
    }
    const shadow = this.add.ellipse(HL.shadow.x, HL.shadow.y, HL.shadow.rx * 2, HL.shadow.ry * 2, 0x000000, HL.shadow.alpha).setVisible(false);
    const halo = this.add.image(HL.centerX, HL.centerY, 'select-halo').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    const hx = (HL.rx * 2) / 256, hy = (HL.ry * 2) / 256;
    const pulse = { t: 0 };
    const applyPulse = () => {
      const k = HL.scale[0] + (HL.scale[1] - HL.scale[0]) * pulse.t;
      halo.setAlpha(HL.alpha[0] + (HL.alpha[1] - HL.alpha[0]) * pulse.t).setScale(hx * k, hy * k);
    };
    applyPulse();
    this.tweens.add({ targets: pulse, t: 1, duration: HL.pulseMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', onUpdate: applyPulse });

    // Selected character's full-body preview, feet on the platform (hidden when no character is selected).
    const hero = this.add.image(PV.centerX, PV.feetY, 'characterCreate.warriorPreview').setOrigin(0.5, 1).setVisible(false);
    hero.setScale(PV.height / hero.height);

    this.ui = new CharacterSelectUI(this.game.canvas.parentElement!, this.game.canvas, {
      onBack: () => this.scene.start('MainMenuScene'),
      onCreate: () => this.scene.start('CharacterCreateScene'),
      onEnterWorld: () => this.scene.start('LegacyCourtyardScene'),
      onPreview: (key) => { if (key) { hero.setTexture(key); hero.setScale(PV.height / hero.height); } hero.setVisible(!!key); halo.setVisible(!!key); shadow.setVisible(!!key); },
    });
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.ui?.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.ui?.destroy();
      this.ui = undefined;
    });
  }
}
