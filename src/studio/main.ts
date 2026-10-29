// God of Legacy Studio (?studio=1) — a visual development tool inside the game: Camera Studio, Depth Editor, Character
// Studio, Movement Editor, Live Preview and Save / Load, around one Live Preview that runs on the game's own systems.
// The game itself is not started on this page; nothing here changes the game's data or the way it plays.
import Phaser from 'phaser';
import './studio.css';
import { KeyBlackPipeline } from '../fx/keyBlack';
import { StudioStore } from './model/store';
import { StudioScene } from './engine/StudioScene';
import { buildShell } from './ui/shell';

export function startStudio(): void {
  document.title = 'God of Legacy Studio';
  for (const id of ['game', 'ambient']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  document.body.classList.add('st-body');
  const store = new StudioStore();
  let game: Phaser.Game | null = null;
  const scene = (): StudioScene | null => (game?.scene.getScene('StudioScene') as StudioScene | null) ?? null;
  const shell = buildShell(store, scene);
  document.body.append(shell.root);
  game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: shell.canvasHost,
    transparent: true,
    banner: false,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    pipeline: { KeyBlack: KeyBlackPipeline } as unknown as Phaser.Types.Core.PipelineConfig,
    render: { antialias: true, roundPixels: false },
  });
  game.scene.add('StudioScene', StudioScene, true, { store });
  // the preview's box changes size with the window and the panels: the canvas follows it
  new ResizeObserver(() => game?.scale.refresh()).observe(shell.canvasHost);
  if (store.restoredDraft) store.say('הטיוטה האחרונה נטענה מהדפדפן');
  (window as unknown as { __studio: unknown }).__studio = { store, game, scene };
}
