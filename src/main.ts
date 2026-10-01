import Phaser from 'phaser';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import { DESIGN } from './config/layout';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { CharacterCreateScene } from './scenes/CharacterCreateScene';
import { LegacyCourtyardScene } from './scenes/LegacyCourtyardScene';
import { ErrorCapture } from './qa/ErrorCapture';
import { isQAMode, startQAPanel } from './qa/QAPanel';

ErrorCapture.installGlobal();

// Phaser draws text once, so Cinzel must be loaded before any scene creates text (Georgia stays as fallback).
async function loadFonts(): Promise<void> {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('400 24px Cinzel'), document.fonts.load('700 24px Cinzel')]),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch { /* fall back to Georgia */ }
}

loadFonts().then(() => {
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: DESIGN.width,
    height: DESIGN.height,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MainMenuScene, CharacterSelectScene, CharacterCreateScene, LegacyCourtyardScene],
  });

  ErrorCapture.attachGame(game);
  if (isQAMode()) startQAPanel(game);

  (window as unknown as { __game: Phaser.Game }).__game = game;
});
