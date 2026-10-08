import Phaser from 'phaser';
import { BUTTON_FX, COLORS, DESIGN, FONT_FAMILY, HUD, RESOLUTIONS, Resolution, SETTINGS_PANEL as P } from '../config/layout';
import { SettingsStore } from '../core/SettingsStore';
import { PlatformAdapter } from '../core/PlatformAdapter';

const CX = DESIGN.width / 2;
const CY = DESIGN.height / 2;

// ---------- Shared modal building blocks (also used by the exit confirmation) ----------

/** The game's window (theme.ts language) drawn in the scene: a rounded deep-blue panel, a fine gold edge and a light top
 *  line. 'modal' (settings) adds a divider under its title. Everything behind it dims and takes no clicks. */
export function createModalBase(scene: Phaser.Scene, w: number, h: number, kind: 'modal' | 'dialog' = 'dialog'): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(1000);
  const overlay = scene.add.rectangle(CX, CY, DESIGN.width, DESIGN.height, 0x04070e, 0.6)
    .setInteractive(); // swallows clicks to the menu underneath
  const g = scene.add.graphics(), x = CX - w / 2, y = CY - h / 2, r = 18;
  g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 2, y + 14, w - 4, h, r);           // its shadow
  g.fillStyle(0x121c2f, 1).fillRoundedRect(x, y, w, h, r);
  g.fillStyle(0x16213a, 1).fillRoundedRect(x, y, w, Math.min(h, 120), { tl: r, tr: r, bl: 0, br: 0 });
  g.fillStyle(0x121c2f, 1).fillRect(x, y + 60, w, Math.min(h, 120) - 60);           // a soft lighter top fading into the body
  g.lineStyle(1, 0xe7c47c, 0.3).strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  g.lineStyle(1, 0xf4d896, 0.75).lineBetween(CX - w * 0.3, y + 0.5, CX + w * 0.3, y + 0.5);
  if (kind === 'modal') g.lineStyle(1, 0xffffff, 0.08).lineBetween(x + 1, y + 84, x + w - 1, y + 84);
  const block = scene.add.zone(CX, CY, w, h).setInteractive(); // panel body blocks overlay
  c.add([overlay, g, block]);
  return c;
}

/** A button in the game's style: a rounded pill, light edge (gold on hover), the label in Inter. */
export function createTextButton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, onClick: () => void, primary = false,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (hover: boolean, pressed: boolean) => {
    g.clear();
    const r = 12;
    if (primary) {
      g.fillStyle(pressed ? 0xc99a52 : hover ? 0xf4d89c : 0xe8c27c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.lineStyle(1, 0xf6dc9f, 1).strokeRoundedRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, r);
    } else {
      g.fillStyle(pressed ? 0x0f1726 : hover ? 0x1c283f : 0x172235, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.lineStyle(1, hover ? 0xe7c47c : 0xffffff, hover ? 0.55 : 0.16).strokeRoundedRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, r);
    }
  };
  draw(false, false);
  const pretty = label.length > 2 && label === label.toUpperCase() ? label.charAt(0) + label.slice(1).toLowerCase() : label;
  const t = scene.add.text(0, 0, pretty, {
    fontFamily: HUD.bodyFont, fontSize: '17px', fontStyle: '600', color: primary ? '#24180a' : '#eee8da', resolution: 2,
  }).setOrigin(0.5);
  c.add([g, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  let hover = false, down = false;
  c.on('pointerover', () => { hover = true; draw(true, false); });
  c.on('pointerout', () => { hover = false; down = false; c.y = y; draw(false, false); });
  c.on('pointerdown', () => { down = true; c.y = y + 1; draw(true, true); });
  c.on('pointerup', () => {
    if (!down) return;
    down = false; c.y = y; draw(hover, false);
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
      fontFamily: FONT_FAMILY, fontSize: `${P.headerSize}px`, fontStyle: 'bold', color: '#f3e3bd', resolution: 2,
    }).setOrigin(0.5).setLetterSpacing(3));

    const rowY = (i: number) => top + P.firstRowOffsetY + i * P.rowGap;
    const st = SettingsStore.get();
    this.slider(rowY(0), 'Master Volume', st.masterVolume, (v) => { SettingsStore.set('masterVolume', v); s.sound.volume = v / 100; }, 'ico_sound');
    this.slider(rowY(1), 'Music Volume', st.musicVolume, (v) => SettingsStore.set('musicVolume', v), 'ico_music');
    this.slider(rowY(2), 'SFX Volume', st.sfxVolume, (v) => SettingsStore.set('sfxVolume', v), 'ico_controls');
    this.toggle(rowY(3), 'Fullscreen', 'ico_display');
    this.dropdown(rowY(4), 'Resolution', st.resolution, 'ico_display');

    this.root.add(createTextButton(s, CX, CY + P.h / 2 - P.back.offsetY, P.back.w, P.back.h, 'Back', () => this.close()));
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

  private label(y: number, text: string, _icon?: string): void {
    this.root!.add(this.scene.add.text(P.labelX, y, text, {
      fontFamily: HUD.bodyFont, fontSize: `${P.labelSize}px`, fontStyle: '500', color: '#d9d4c8', resolution: 2,
    }).setOrigin(0, 0.5));
  }

  private valueText(y: number, text: string): Phaser.GameObjects.Text {
    const t = this.scene.add.text(P.valueRightX, y, text, {
      fontFamily: HUD.bodyFont, fontSize: `${P.labelSize}px`, fontStyle: '600', color: '#eee8da', resolution: 2,
    }).setOrigin(1, 0.5);
    this.root!.add(t);
    return t;
  }

  private slider(y: number, label: string, initial: number, onChange: (v: number) => void, icon?: string): void {
    const s = this.scene;
    this.label(y, label, icon);
    const x0 = P.controlX, w = P.controlW;
    const track = s.add.graphics();
    track.fillStyle(0x0a101c, 1).fillRoundedRect(x0, y - 4, w, 8, 4);
    track.lineStyle(1, 0xffffff, 0.1).strokeRoundedRect(x0, y - 4, w, 8, 4);
    const g = s.add.graphics();
    const knob = s.add.graphics();
    const val = this.valueText(y, String(initial));
    let value = initial;
    const draw = () => {
      const kx = x0 + (w * value) / 100;
      g.clear();
      g.fillStyle(0xe7c47c, 1).fillRoundedRect(x0, y - 4, Math.max(8, kx - x0), 8, 4);
      knob.clear();
      knob.fillStyle(0x000000, 0.35).fillCircle(kx, y + 2, 11);
      knob.fillStyle(0xf6ecd4, 1).fillCircle(kx, y, 10);
      knob.lineStyle(2, 0xe7c47c, 1).strokeCircle(kx, y, 10);
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
    const x0 = P.controlX, w = 56, h = 30;
    const g = s.add.graphics();
    const val = this.valueText(y, '');
    const draw = () => {
      const on = SettingsStore.get().fullscreen;
      g.clear();
      g.fillStyle(on ? 0xe7c47c : 0x0a101c, 1).fillRoundedRect(x0, y - h / 2, w, h, h / 2);
      g.lineStyle(1, on ? 0xf6dc9f : 0xffffff, on ? 1 : 0.16).strokeRoundedRect(x0, y - h / 2, w, h, h / 2);
      g.fillStyle(on ? 0x24180a : 0xaeb6c3, 1).fillCircle(on ? x0 + w - h / 2 : x0 + h / 2, y, h / 2 - 5);
      val.setText(on ? 'On' : 'Off');
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
    const box = s.add.graphics();
    const drawBox = (hover: boolean) => {
      box.clear();
      box.fillStyle(0x0a101c, 1).fillRoundedRect(x0, y - h / 2, w, h, 10);
      box.lineStyle(1, hover ? 0xe7c47c : 0xffffff, hover ? 0.6 : 0.16).strokeRoundedRect(x0 + 0.5, y - h / 2 + 0.5, w - 1, h - 1, 10);
      box.lineStyle(2, 0xaeb6c3, 1).beginPath(); box.moveTo(x0 + w - 26, y - 3); box.lineTo(x0 + w - 20, y + 3); box.lineTo(x0 + w - 14, y - 3); box.strokePath();
    };
    drawBox(false);
    const txt = s.add.text(x0 + 16, y, initial, { fontFamily: HUD.bodyFont, fontSize: '16px', fontStyle: '500', color: '#eee8da', resolution: 2 }).setOrigin(0, 0.5);
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
      const iy = top + 6 + i * ih;
      const g = s.add.graphics();
      const draw = (hover: boolean) => {
        g.clear();
        const first = i === 0, last = i === RESOLUTIONS.length - 1;
        g.fillStyle(hover ? 0x1f2c44 : 0x111a2b, 1).fillRoundedRect(x0, iy, w, ih, { tl: first ? 10 : 0, tr: first ? 10 : 0, bl: last ? 10 : 0, br: last ? 10 : 0 });
        if (!last) g.lineStyle(1, 0xffffff, 0.06).lineBetween(x0 + 8, iy + ih, x0 + w - 8, iy + ih);
      };
      draw(false);
      const t = s.add.text(x0 + 16, iy + ih / 2, r, {
        fontFamily: HUD.bodyFont, fontSize: '16px', fontStyle: r === current ? '700' : '500', color: r === current ? '#f4d896' : '#eee8da', resolution: 2,
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

