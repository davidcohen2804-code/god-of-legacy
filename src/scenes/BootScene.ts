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
    // UI kit pieces still drawn as pictures (the speech bubbles); the menus and the loading screen draw themselves
    for (const f of ['bubble_light', 'tail_light', ...LOADING_KIT]) this.load.image(`kit.${f}`, `assets/final/ui/kit/${f}.png`);
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
