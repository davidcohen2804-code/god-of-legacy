import Phaser from 'phaser';
import { ASSETS, ASSET_MANIFEST } from '../config/layout';
import { SettingsStore } from '../core/SettingsStore';
import { PlatformAdapter } from '../core/PlatformAdapter';
import { isPvpUrl } from '../pvp/Room';
import { enterPvp } from '../pvp/enterPvp';
import { LOADING_KIT } from '../ui/LoadingScreen';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload(): void {
    for (const a of Object.values(ASSETS)) this.load.image(a.key, a.file);
    for (const [key, file] of Object.entries(ASSET_MANIFEST)) this.load.image(key, file);
    // GPT UI kit pieces used by the Phaser-drawn menus (settings / exit dialogs)
    for (const f of ['modal_window', 'dialog_window', 'menu_btn', 'menu_btn_hover', 'menu_btn_pressed', 'toggle_on', 'toggle_off',
      'slider_track', 'slider_knob', 'dropdown', 'dropdown_open', 'ico_sound', 'ico_music', 'ico_display', 'ico_controls', 'player_plate', 'bubble_light', 'tail_light', ...LOADING_KIT]) this.load.image(`kit.${f}`, `assets/final/ui/kit/${f}.png`);
  }

  create(): void {
    const s = SettingsStore.get();
    this.sound.volume = s.masterVolume / 100;
    PlatformAdapter.applyResolution(this.game, s.resolution);
    // Fullscreen needs a user gesture in browsers, so a saved "On" is applied
    // when the player toggles it; keep the stored value in sync with reality.
    if (s.fullscreen && !this.scale.isFullscreen) SettingsStore.set('fullscreen', false);
    if (isPvpUrl()) enterPvp(this); // shared ?mode=pvp&room=ID link opens the arena directly
    else this.scene.start('MainMenuScene');
  }
}
