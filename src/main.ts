import Phaser from 'phaser';
import { DESIGN } from './config/layout';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { CharacterCreateScene } from './scenes/CharacterCreateScene';
import { WorldScenePlaceholder } from './scenes/WorldScenePlaceholder';
import { ErrorCapture } from './qa/ErrorCapture';
import { isQAMode, startQAPanel } from './qa/QAPanel';

ErrorCapture.installGlobal();

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: DESIGN.width,
  height: DESIGN.height,
  backgroundColor: '#000000',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MainMenuScene, CharacterSelectScene, CharacterCreateScene, WorldScenePlaceholder],
});

ErrorCapture.attachGame(game);
if (isQAMode()) startQAPanel(game);

(window as unknown as { __game: Phaser.Game }).__game = game;
