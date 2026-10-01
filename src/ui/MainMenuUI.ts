import Phaser from 'phaser';
import {
  ASSETS, BUTTON_FX, ButtonLayout, COLORS, DESIGN, EXIT_PANEL as E, FONT_FAMILY, MENU_BUTTONS, VERSION,
} from '../config/layout';
import { SettingsModal, createModalBase, createTextButton } from './SettingsModal';
import { SettingsStore } from '../core/SettingsStore';
import { PlatformAdapter } from '../core/PlatformAdapter';

export interface MainMenuHandlers { onStart: () => void }

export class MainMenuUI {
  private settings: SettingsModal;
  private exitModal?: Phaser.GameObjects.Container;
  private readonly onEscExit = () => this.closeExit();

  constructor(private scene: Phaser.Scene, handlers: MainMenuHandlers) {
    this.settings = new SettingsModal(scene);

    this.imageButton(ASSETS.start.key, MENU_BUTTONS.start, handlers.onStart);
    this.imageButton(ASSETS.settings.key, MENU_BUTTONS.settings, () => this.settings.open());
    this.imageButton(ASSETS.exit.key, MENU_BUTTONS.exit, () => this.openExit());

    scene.add.text(DESIGN.width - VERSION.right, DESIGN.height - VERSION.bottom, VERSION.text, {
      fontFamily: FONT_FAMILY, fontSize: `${VERSION.size}px`, color: VERSION.color,
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, fill: true },
    }).setOrigin(1, 1);

    // Keep the stored fullscreen flag true to reality (browser Esc / F11 exit).
    const sync = () => { SettingsStore.set('fullscreen', scene.scale.isFullscreen); this.settings.syncFullscreen(); };
    scene.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, sync);
    scene.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, sync);
      scene.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
      this.settings.close();
      this.closeExit();
    });
  }

  /** One supplied PNG per button; hover/pressed states are produced in code. */
  private imageButton(key: string, L: ButtonLayout, onClick: () => void): void {
    const s = this.scene;
    const img = s.add.image(L.x, L.y, key);
    const base = Math.min(L.w / img.width, L.h / img.height);
    img.setScale(base);
    img.setInteractive({ pixelPerfect: true, alphaTolerance: 1, useHandCursor: true });

    const fx = img.preFX!;
    fx.padding = 18;
    const color = fx.addColorMatrix();
    const glow = fx.addGlow(BUTTON_FX.hoverGlowColor, 0, 0, false, 0.1, 14);
    const st = { scale: 1, bright: 1, glow: 0 };
    const render = () => { img.setScale(base * st.scale); color.brightness(st.bright); glow.outerStrength = st.glow; };
    render();

    const go = (scale: number, bright: number, g: number, duration: number) => {
      s.tweens.killTweensOf(st);
      if (duration === 0) { Object.assign(st, { scale, bright, glow: g }); render(); return; }
      s.tweens.add({ targets: st, scale, bright, glow: g, duration, ease: 'Sine.easeOut', onUpdate: render });
    };
    const hoverState = (d: number) => go(BUTTON_FX.hoverScale, BUTTON_FX.hoverBrightness, BUTTON_FX.hoverGlowStrength, d);

    let hover = false, down = false;
    img.on('pointerover', () => { hover = true; hoverState(BUTTON_FX.hoverDuration); });
    img.on('pointerout', () => { hover = false; down = false; img.y = L.y; go(1, 1, 0, BUTTON_FX.hoverDuration); });
    img.on('pointerdown', () => {
      down = true; img.y = L.y + BUTTON_FX.pressedOffsetY;
      go(BUTTON_FX.pressedScale, BUTTON_FX.pressedBrightness, BUTTON_FX.hoverGlowStrength * 0.5, 0);
    });
    img.on('pointerup', () => {
      if (!down) return;
      down = false; img.y = L.y;
      if (hover) hoverState(0); else go(1, 1, 0, 0);
      onClick();
    });
  }

  /** 'confirm' = Exit God Of Legacy? (EXIT / CANCEL); 'blocked' = web build could not close the tab. */
  private openExit(mode: 'confirm' | 'blocked' = 'confirm'): void {
    if (this.exitModal) return;
    const s = this.scene;
    const cx = DESIGN.width / 2, cy = DESIGN.height / 2;
    const m = createModalBase(s, E.w, E.h);
    const title = mode === 'confirm' ? 'Exit God Of Legacy?' : 'Close this browser tab to exit.';
    m.add(s.add.text(cx, cy - E.h / 2 + E.titleOffsetY, title, {
      fontFamily: FONT_FAMILY, fontSize: `${E.titleSize}px`, color: COLORS.text,
    }).setOrigin(0.5));
    const by = cy + E.h / 2 - E.buttonsOffsetY;
    if (mode === 'confirm') {
      m.add(createTextButton(s, cx - E.buttonGap, by, E.button.w, E.button.h, 'EXIT', () => { void this.confirmExit(); }));
      m.add(createTextButton(s, cx + E.buttonGap, by, E.button.w, E.button.h, 'CANCEL', () => this.closeExit()));
    } else {
      m.add(createTextButton(s, cx, by, E.button.w, E.button.h, 'OK', () => this.closeExit()));
    }
    this.exitModal = m;
    s.input.keyboard?.on('keydown-ESC', this.onEscExit);
  }

  private async confirmExit(): Promise<void> {
    const result = await PlatformAdapter.exitGame();
    if (result === 'blocked' && this.scene.sys.isActive()) {
      this.closeExit();
      this.openExit('blocked');
    }
  }

  private closeExit(): void {
    if (!this.exitModal) return;
    this.scene.input.keyboard?.off('keydown-ESC', this.onEscExit);
    this.exitModal.destroy();
    this.exitModal = undefined;
  }
}
