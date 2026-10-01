import Phaser from 'phaser';
import { ASSETS, ASSET_MANIFEST, STAGE6 } from '../config/layout';
import { SettingsStore } from '../core/SettingsStore';
import { PlatformAdapter } from '../core/PlatformAdapter';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload(): void {
    for (const a of Object.values(ASSETS)) this.load.image(a.key, a.file);
    for (const [key, file] of Object.entries(ASSET_MANIFEST)) this.load.image(key, file);
    this.load.image(STAGE6.floorFx.key, STAGE6.floorFx.file);
  }

  create(): void {
    const s = SettingsStore.get();
    this.sound.volume = s.masterVolume / 100;
    PlatformAdapter.applyResolution(this.game, s.resolution);
    // Fullscreen needs a user gesture in browsers, so a saved "On" is applied
    // when the player toggles it; keep the stored value in sync with reality.
    if (s.fullscreen && !this.scale.isFullscreen) SettingsStore.set('fullscreen', false);
    this.scene.start('MainMenuScene');
  }
}
