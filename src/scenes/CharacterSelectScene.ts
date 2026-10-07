import Phaser from 'phaser';
import { addClothWind } from '../ui/VisualLife';
import { CHARACTER_PREVIEWS, CHARACTER_SELECT as L, CHARACTER_SELECT_PREVIEW as PV, COLORS, DESIGN, SELECT_HALO } from '../config/layout';
import { CharacterSelectUI } from '../ui/CharacterSelectUI';
import { CharacterStore } from '../characters/CharacterStore';
import { previewKeyOf } from '../characters/Look';
import { buildLook, preloadLooks } from '../characters/LookArt';
import { clearPvpFromUrl } from '../pvp/Room';
import { enterPvp } from '../pvp/enterPvp';
import { ClassPresence, preloadLife } from '../ui/PresentationLife';
import { ThroneHero, preloadThrone } from '../ui/ThronePresence';

const classOfKey = (key: string): string | null => {
  const e = Object.entries(CHARACTER_PREVIEWS).find(([, v]) => v.key === key);
  return e ? e[0].split('/')[0] : null;
};
/** The height a preview picture is sized by (a full-style picture has room above the figure for the hair). */
const fitOfKey = (key: string): number | undefined => Object.values(CHARACTER_PREVIEWS).find((v) => v.key === key)?.fit;

// Background/world presentation only; all UI lives in CharacterSelectUI (DOM overlay).
export class CharacterSelectScene extends Phaser.Scene {
  private ui?: CharacterSelectUI;

  constructor() { super('CharacterSelectScene'); }

  preload(): void {
    preloadLife(this); preloadThrone(this);
    const chars = CharacterStore.getSlots().map((s) => s.character);
    preloadLooks(this, chars); // each character's full style (hair, outfit, colours): its layers load here
    for (const c of chars) { // without a chosen look: the bare base picture
      const pv = c && !c.look ? CHARACTER_PREVIEWS[previewKeyOf(c)] : undefined;
      if (pv && !this.textures.exists(pv.key)) this.load.image(pv.key, pv.file);
    }
  }

  create(): void {
    for (const s of CharacterStore.getSlots()) buildLook(this, s.character); // one picture per look: stage + slot portraits
    this.cameras.main.fadeIn(240, 0, 0, 0);
    const bg = this.add.image(DESIGN.width / 2, DESIGN.height / 2, 'characterSelect.background');
    bg.setScale(Math.max(DESIGN.width / bg.width, DESIGN.height / bg.height));

    // Subtle pedestal / rune for the character preview.
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

    // Contact shadow + one soft class-coloured halo under the boots, concentric with the pedestal ellipse, slow pulse.
    const HL = SELECT_HALO;
    if (!this.textures.exists('select-halo')) {
      const c = this.textures.createCanvas('select-halo', 256, 256)!, ctx = c.getContext();
      const gr = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)');
      gr.addColorStop(0.78, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 256);
      c.refresh();
    }
    const shadow = this.add.ellipse(HL.shadow.x, HL.shadow.y, HL.shadow.rx * 2, HL.shadow.ry * 2, 0x000000, HL.shadow.alpha).setVisible(false);
    const halo = this.add.image(HL.centerX, HL.centerY, 'select-halo').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setTint(0xffc070);
    const hx = (HL.rx * 2) / 256, hy = (HL.ry * 2) / 256;
    const pulse = { t: 0 };
    const applyPulse = () => {
      const k = HL.scale[0] + (HL.scale[1] - HL.scale[0]) * pulse.t;
      halo.setAlpha(HL.alpha[0] + (HL.alpha[1] - HL.alpha[0]) * pulse.t).setScale(hx * k, hy * k);
    };
    applyPulse();
    this.tweens.add({ targets: pulse, t: 1, duration: HL.pulseMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', onUpdate: applyPulse });

    // Selected character's full-body preview, feet on the platform (hidden when no character is selected).
    // No whole-image motion: only the cloak edges deform (local displacement), plus per-class presence around it.
    const hero = this.add.image(PV.centerX, PV.feetY, 'characterCreate.warriorPreview').setOrigin(0.5, 1).setVisible(false).setDepth(2);
    hero.setScale(PV.height / hero.height);
    addClothWind(this, hero);
    const presence = new ClassPresence(this, hero, halo, { x: HL.centerX, y: HL.centerY });
    // Warrior: seated on his throne with the sword of light (animated painting) instead of the standing preview.
    const throne = this.textures.exists('throne.hero') ? new ThroneHero(this, { x: PV.centerX, y: 900 }, 700, 2) : null;
    throne?.setVisible(false);
    let lastKey: string | null = null, selectedCls: string | null = null;

    this.ui = new CharacterSelectUI(this.game.canvas.parentElement!, this.game.canvas, {
      onBack: () => this.scene.start('MainMenuScene'),
      onCreate: () => this.scene.start('CharacterCreateScene'),
      onEnterWorld: () => { clearPvpFromUrl(); this.scene.start('LegacyCourtyardScene', { pvpRoom: null }); }, // always the world, never the arena (PvP has its own button)
      onPvp: () => enterPvp(this),
      onPreview: (key) => {
        const cls = key ? classOfKey(key) : null, onThrone = !!throne && cls === 'warrior';
        if (key && !onThrone) { const base = key.startsWith('base.'); hero.setTexture(key).setData('calm', base); hero.setScale((PV.height * (base ? 0.84 : 1)) / (fitOfKey(key) ?? hero.height)); } // the base body: no cloth to sway, fills its image
        const stand = !!key && !onThrone;
        hero.setVisible(stand); halo.setVisible(stand); shadow.setVisible(stand); g.setVisible(!onThrone);
        throne?.setVisible(onThrone);
        if (key !== lastKey) {
          selectedCls = cls;
          presence.setClass(onThrone ? null : selectedCls);
          if (stand && lastKey !== null) presence.pop();
          lastKey = key;
        }
      },
      onHover: (cls) => presence.setHover(!!cls && cls === selectedCls),
    });
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.ui?.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE);
      this.ui?.destroy();
      this.ui = undefined;
    });
  }
}
