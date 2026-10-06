import Phaser from 'phaser';
import { BUTTON_FX, COLORS, DESIGN, FONT_FAMILY, RESOLUTIONS, Resolution, SETTINGS_PANEL as P } from '../config/layout';
import { SettingsStore } from '../core/SettingsStore';
import { PlatformAdapter } from '../core/PlatformAdapter';

const CX = DESIGN.width / 2;
const CY = DESIGN.height / 2;

// ---------- Shared modal building blocks (also used by the exit confirmation) ----------

/** Kit window art: 'modal' = window with a header strip (settings), 'dialog' = small confirm window. */
export function createModalBase(scene: Phaser.Scene, w: number, h: number, kind: 'modal' | 'dialog' = 'dialog'): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(1000);
  const overlay = scene.add.rectangle(CX, CY, DESIGN.width, DESIGN.height, 0x000000, COLORS.overlayAlpha)
    .setInteractive(); // swallows clicks to the menu underneath
  const key = `kit.${kind}_window`;
  let frame: Phaser.GameObjects.GameObject;
  if (scene.textures.exists(key)) frame = scene.add.image(CX, CY, key).setDisplaySize(w, h);
  else {
    const g = scene.add.graphics(), x = CX - w / 2, y = CY - h / 2;
    g.fillStyle(COLORS.panelBg, COLORS.panelAlpha).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, COLORS.gold, 1).strokeRoundedRect(x, y, w, h, 10);
    frame = g;
  }
  const block = scene.add.zone(CX, CY, w, h).setInteractive(); // panel body blocks overlay
  c.add([overlay, frame, block]);
  return c;
}

export function createTextButton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  // kit plate: the art's text area is ~40% of its height, so the image is drawn taller than the hit box
  const plate = scene.add.image(0, 0, 'kit.menu_btn').setDisplaySize(w * 1.22, h * 1.95);
  const draw = (hover: boolean, pressed: boolean) => {
    plate.setTexture(pressed ? 'kit.menu_btn_pressed' : hover ? 'kit.menu_btn_hover' : 'kit.menu_btn').setDisplaySize(w * 1.22, h * 1.95);
  };
  draw(false, false);
  const t = scene.add.text(0, 0, label, {
    fontFamily: FONT_FAMILY, fontSize: '22px', fontStyle: 'bold', color: '#f3e2bf',
    shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 3, fill: true },
  }).setOrigin(0.5);
  c.add([plate, t]);
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
    this.root = createModalBase(s, P.w, P.h, 'modal');
    this.root.add(s.add.text(CX, top + P.headerOffsetY, 'SETTINGS', {
      fontFamily: FONT_FAMILY, fontSize: `${P.headerSize}px`, fontStyle: 'bold', color: COLORS.goldCss,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5));

    const rowY = (i: number) => top + P.firstRowOffsetY + i * P.rowGap;
    const st = SettingsStore.get();
    this.slider(rowY(0), 'Master Volume', st.masterVolume, (v) => { SettingsStore.set('masterVolume', v); s.sound.volume = v / 100; }, 'ico_sound');
    this.slider(rowY(1), 'Music Volume', st.musicVolume, (v) => SettingsStore.set('musicVolume', v), 'ico_music');
    this.slider(rowY(2), 'SFX Volume', st.sfxVolume, (v) => SettingsStore.set('sfxVolume', v), 'ico_controls');
    this.toggle(rowY(3), 'Fullscreen', 'ico_display');
    this.dropdown(rowY(4), 'Resolution', st.resolution, 'ico_display');

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

  private label(y: number, text: string, icon?: string): void {
    if (icon && this.scene.textures.exists(`kit.${icon}`)) this.root!.add(this.scene.add.image(P.iconX, y, `kit.${icon}`).setDisplaySize(40, 40));
    this.root!.add(this.scene.add.text(P.labelX, y, text, {
      fontFamily: FONT_FAMILY, fontSize: `${P.labelSize}px`, color: COLORS.text,
      shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 2, fill: true },
    }).setOrigin(0, 0.5));
  }

  private valueText(y: number, text: string): Phaser.GameObjects.Text {
    const t = this.scene.add.text(P.valueRightX, y, text, {
      fontFamily: FONT_FAMILY, fontSize: `${P.labelSize}px`, color: COLORS.text,
    }).setOrigin(1, 0.5);
    this.root!.add(t);
    return t;
  }

  private slider(y: number, label: string, initial: number, onChange: (v: number) => void, icon?: string): void {
    const s = this.scene;
    this.label(y, label, icon);
    const x0 = P.controlX, w = P.controlW;
    const track = s.add.image(x0 + w / 2, y, 'kit.slider_track').setDisplaySize(w + 36, 34);
    const g = s.add.graphics();
    const knob = s.add.image(x0, y, 'kit.slider_knob').setDisplaySize(30, 30);
    const val = this.valueText(y, String(initial));
    let value = initial;
    const draw = () => {
      const kx = x0 + (w * value) / 100;
      g.clear();
      g.fillStyle(0xe8b25a, 0.9).fillRoundedRect(x0, y - 2, Math.max(4, kx - x0), 4, 2);
      knob.setX(kx);
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
    this.root!.add([track, g, knob, hit]);
  }

  private toggle(y: number, label: string, icon?: string): void {
    const s = this.scene;
    this.label(y, label, icon);
    const x0 = P.controlX, w = 104, h = 38;
    const sw = s.add.image(x0 + w / 2, y, 'kit.toggle_off').setDisplaySize(w, h);
    const g = sw;
    const val = this.valueText(y, '');
    const draw = () => {
      const on = SettingsStore.get().fullscreen;
      sw.setTexture(on ? 'kit.toggle_on' : 'kit.toggle_off').setDisplaySize(w, h);
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

  private dropdown(y: number, label: string, initial: Resolution, icon?: string): void {
    const s = this.scene;
    this.label(y, label, icon);
    const x0 = P.controlX, w = P.controlW, h = 40;
    const box = s.add.image(x0 + w / 2, y, 'kit.dropdown').setDisplaySize(w + 24, h + 20);
    const drawBox = (hover: boolean) => { box.setTexture(hover ? 'kit.dropdown_open' : 'kit.dropdown').setDisplaySize(w + 24, h + 20); };
    drawBox(false);
    const txt = s.add.text(x0 + 22, y, initial, { fontFamily: FONT_FAMILY, fontSize: '20px', color: COLORS.text }).setOrigin(0, 0.5);
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
        g.fillStyle(hover ? 0x22324a : 0x0b1424, 0.98).fillRect(x0 + 6, iy, w - 12, ih);
        g.lineStyle(1, 0xc99a45, hover ? 0.95 : 0.55).strokeRect(x0 + 6, iy, w - 12, ih);
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

