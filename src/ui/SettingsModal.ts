import Phaser from 'phaser';
import { BUTTON_FX, COLORS, DESIGN, FONT_FAMILY, RESOLUTIONS, Resolution, SETTINGS_PANEL as P } from '../config/layout';
import { SettingsStore } from '../core/SettingsStore';
import { PlatformAdapter } from '../core/PlatformAdapter';

const CX = DESIGN.width / 2;
const CY = DESIGN.height / 2;

// ---------- Shared modal building blocks (also used by the exit confirmation) ----------

export function createModalBase(scene: Phaser.Scene, w: number, h: number): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(1000);
  const overlay = scene.add.rectangle(CX, CY, DESIGN.width, DESIGN.height, 0x000000, COLORS.overlayAlpha)
    .setInteractive(); // swallows clicks to the menu underneath
  const g = scene.add.graphics();
  const x = CX - w / 2, y = CY - h / 2;
  g.fillStyle(COLORS.panelBg, COLORS.panelAlpha).fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(2, COLORS.gold, 1).strokeRoundedRect(x, y, w, h, 10);
  g.lineStyle(1, COLORS.gold, 0.35).strokeRoundedRect(x + 7, y + 7, w - 14, h - 14, 7);
  const block = scene.add.zone(CX, CY, w, h).setInteractive(); // panel body blocks overlay
  c.add([overlay, g, block]);
  return c;
}

export function createTextButton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (hover: boolean, pressed: boolean) => {
    g.clear();
    const fill = pressed ? COLORS.panelBg : hover ? COLORS.buttonBgHover : COLORS.buttonBg;
    g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(2, COLORS.gold, hover ? 1 : 0.85).strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  };
  draw(false, false);
  const t = scene.add.text(0, 0, label, { fontFamily: FONT_FAMILY, fontSize: '26px', color: COLORS.text }).setOrigin(0.5);
  c.add([g, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  let hover = false, down = false;
  const tweenTo = (s: number) => {
    scene.tweens.killTweensOf(c);
    scene.tweens.add({ targets: c, scale: s, duration: BUTTON_FX.hoverDuration, ease: 'Sine.easeOut' });
  };
  c.on('pointerover', () => { hover = true; draw(true, false); tweenTo(BUTTON_FX.hoverScale); });
  c.on('pointerout', () => { hover = false; down = false; c.y = y; draw(false, false); tweenTo(1); });
  c.on('pointerdown', () => {
    down = true; scene.tweens.killTweensOf(c);
    c.setScale(BUTTON_FX.pressedScale); c.y = y + BUTTON_FX.pressedOffsetY; draw(true, true);
  });
  c.on('pointerup', () => {
    if (!down) return;
    down = false; c.y = y; c.setScale(hover ? BUTTON_FX.hoverScale : 1); draw(hover, false);
    onClick();
  });
  return c;
}

// ---------- Settings modal ----------

export class SettingsModal {
  private root?: Phaser.GameObjects.Container;
  private dropdownList?: Phaser.GameObjects.Container;
  private refreshFullscreen?: () => void;
  /** Scene-level input listeners owned by this modal (removed individually on close). */
  private inputListeners: [string, (...args: never[]) => void][] = [];
  private readonly onEsc = () => (this.dropdownList ? this.closeDropdown() : this.close());

  constructor(private scene: Phaser.Scene) {}

  get isOpen(): boolean { return !!this.root; }

  open(): void {
    if (this.root) return;
    const s = this.scene;
    const top = CY - P.h / 2;
    this.root = createModalBase(s, P.w, P.h);
    this.root.add(s.add.text(CX, top + P.headerOffsetY, 'SETTINGS', {
      fontFamily: FONT_FAMILY, fontSize: `${P.headerSize}px`, color: COLORS.goldCss,
    }).setOrigin(0.5));

    const rowY = (i: number) => top + P.firstRowOffsetY + i * P.rowGap;
    const st = SettingsStore.get();
    this.slider(rowY(0), 'Master Volume', st.masterVolume, (v) => { SettingsStore.set('masterVolume', v); s.sound.volume = v / 100; });
    this.slider(rowY(1), 'Music Volume', st.musicVolume, (v) => SettingsStore.set('musicVolume', v));
    this.slider(rowY(2), 'SFX Volume', st.sfxVolume, (v) => SettingsStore.set('sfxVolume', v));
    this.toggle(rowY(3), 'Fullscreen');
    this.dropdown(rowY(4), 'Resolution', st.resolution);

    this.root.add(createTextButton(s, CX, CY + P.h / 2 - P.back.offsetY, P.back.w, P.back.h, 'BACK', () => this.close()));
    s.input.keyboard?.on('keydown-ESC', this.onEsc);
  }

  close(): void {
    if (!this.root) return;
    this.closeDropdown();
    this.scene.input.keyboard?.off('keydown-ESC', this.onEsc);
    for (const [evt, fn] of this.inputListeners) this.scene.input.off(evt, fn);
    this.inputListeners = [];
    this.root.destroy();
    this.root = undefined;
    this.refreshFullscreen = undefined;
  }

  /** Called when fullscreen changes outside the toggle (e.g. browser Esc). */
  syncFullscreen(): void { this.refreshFullscreen?.(); }

  private listen(evt: string, fn: (...args: never[]) => void): void {
    this.scene.input.on(evt, fn);
    this.inputListeners.push([evt, fn]);
  }

  private label(y: number, text: string): void {
    this.root!.add(this.scene.add.text(P.labelX, y, text, {
      fontFamily: FONT_FAMILY, fontSize: `${P.labelSize}px`, color: COLORS.text,
    }).setOrigin(0, 0.5));
  }

  private valueText(y: number, text: string): Phaser.GameObjects.Text {
    const t = this.scene.add.text(P.valueRightX, y, text, {
      fontFamily: FONT_FAMILY, fontSize: `${P.labelSize}px`, color: COLORS.text,
    }).setOrigin(1, 0.5);
    this.root!.add(t);
    return t;
  }

  private slider(y: number, label: string, initial: number, onChange: (v: number) => void): void {
    const s = this.scene;
    this.label(y, label);
    const x0 = P.controlX, w = P.controlW;
    const g = s.add.graphics();
    const val = this.valueText(y, String(initial));
    let value = initial;
    const draw = () => {
      const kx = x0 + (w * value) / 100;
      g.clear();
      g.fillStyle(COLORS.track, 1).fillRoundedRect(x0, y - 3, w, 6, 3);
      g.fillStyle(COLORS.crimson, 1).fillRoundedRect(x0, y - 3, Math.max(6, kx - x0), 6, 3);
      g.fillStyle(COLORS.gold, 1).fillCircle(kx, y, 11);
      g.lineStyle(2, COLORS.panelBg, 1).strokeCircle(kx, y, 11);
      val.setText(String(value));
    };
    draw();
    const setFrom = (px: number) => {
      const v = Phaser.Math.Clamp(Math.round(((px - x0) / w) * 100), 0, 100);
      if (v !== value) { value = v; draw(); onChange(v); }
    };
    const hit = s.add.zone(x0 + w / 2, y, w + 24, 32).setInteractive({ useHandCursor: true });
    let dragging = false;
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; setFrom(p.x); });
    this.listen('pointermove', (p: Phaser.Input.Pointer) => { if (dragging) setFrom(p.x); });
    this.listen('pointerup', () => { dragging = false; });
    this.root!.add([g, hit]);
  }

  private toggle(y: number, label: string): void {
    const s = this.scene;
    this.label(y, label);
    const x0 = P.controlX, w = 64, h = 30;
    const g = s.add.graphics();
    const val = this.valueText(y, '');
    const draw = () => {
      const on = SettingsStore.get().fullscreen;
      g.clear();
      g.fillStyle(on ? COLORS.crimson : COLORS.track, 1).fillRoundedRect(x0, y - h / 2, w, h, h / 2);
      g.lineStyle(1.5, COLORS.gold, 0.8).strokeRoundedRect(x0, y - h / 2, w, h, h / 2);
      g.fillStyle(COLORS.gold, 1).fillCircle(on ? x0 + w - h / 2 : x0 + h / 2, y, h / 2 - 4);
      val.setText(on ? 'ON' : 'OFF');
    };
    draw();
    this.refreshFullscreen = draw;
    const hit = s.add.zone(x0 + w / 2, y, w + 10, h + 10).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      const on = !SettingsStore.get().fullscreen;
      SettingsStore.set('fullscreen', on);
      PlatformAdapter.setFullscreen(s.game, on);
      draw();
    });
    this.root!.add([g, hit]);
  }

  private dropdown(y: number, label: string, initial: Resolution): void {
    const s = this.scene;
    this.label(y, label);
    const x0 = P.controlX, w = P.controlW, h = 40;
    const box = s.add.graphics();
    const drawBox = (hover: boolean) => {
      box.clear();
      box.fillStyle(hover ? COLORS.buttonBgHover : COLORS.buttonBg, 1).fillRoundedRect(x0, y - h / 2, w, h, 5);
      box.lineStyle(1.5, COLORS.gold, 0.9).strokeRoundedRect(x0, y - h / 2, w, h, 5);
      box.fillStyle(COLORS.gold, 1).fillTriangle(x0 + w - 30, y - 4, x0 + w - 16, y - 4, x0 + w - 23, y + 5);
    };
    drawBox(false);
    const txt = s.add.text(x0 + 16, y, initial, { fontFamily: FONT_FAMILY, fontSize: '22px', color: COLORS.text }).setOrigin(0, 0.5);
    const hit = s.add.zone(x0 + w / 2, y, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => drawBox(true));
    hit.on('pointerout', () => drawBox(false));
    hit.on('pointerup', () => (this.dropdownList ? this.closeDropdown() : this.openDropdown(x0, y + h / 2, w, (r) => {
      txt.setText(r);
      SettingsStore.set('resolution', r);
      PlatformAdapter.applyResolution(s.game, r);
    })));
    this.root!.add([box, txt, hit]);
  }

  private openDropdown(x0: number, top: number, w: number, onPick: (r: Resolution) => void): void {
    const s = this.scene;
    const ih = 40;
    const list = s.add.container(0, 0).setDepth(1001);
    const catcher = s.add.zone(CX, CY, DESIGN.width, DESIGN.height).setInteractive();
    catcher.on('pointerup', () => this.closeDropdown());
    list.add(catcher);
    const current = SettingsStore.get().resolution;
    RESOLUTIONS.forEach((r, i) => {
      const iy = top + 4 + i * ih;
      const g = s.add.graphics();
      const draw = (hover: boolean) => {
        g.clear();
        g.fillStyle(hover ? COLORS.buttonBgHover : COLORS.panelBg, 1).fillRect(x0, iy, w, ih);
        g.lineStyle(1, COLORS.gold, 0.6).strokeRect(x0, iy, w, ih);
      };
      draw(false);
      const t = s.add.text(x0 + 16, iy + ih / 2, r, {
        fontFamily: FONT_FAMILY, fontSize: '22px', color: r === current ? COLORS.goldCss : COLORS.text,
      }).setOrigin(0, 0.5);
      const z = s.add.zone(x0 + w / 2, iy + ih / 2, w, ih).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => draw(true));
      z.on('pointerout', () => draw(false));
      z.on('pointerup', () => { onPick(r); this.closeDropdown(); });
      list.add([g, t, z]);
    });
    this.dropdownList = list;
  }

  private closeDropdown(): void {
    this.dropdownList?.destroy();
    this.dropdownList = undefined;
  }
}

