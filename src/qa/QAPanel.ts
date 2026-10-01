// QA mode (?qa=1 only): read-only debug panel toggled with F9. Never changes gameplay.
import Phaser from 'phaser';
import { BuildInfo } from './BuildInfo';
import { ErrorCapture } from './ErrorCapture';
import { CharacterStore } from '../characters/CharacterStore';

export const isQAMode = (): boolean => new URLSearchParams(window.location.search).get('qa') === '1';

const STATE_BY_SCENE: Record<string, string> = {
  BootScene: 'booting',
  MainMenuScene: 'main-menu',
  CharacterSelectScene: 'character-select',
  CharacterCreateScene: 'character-create (placeholder)',
  WorldScenePlaceholder: 'world (placeholder)',
};

const fmt = (n: number) => Math.round(n);

export function startQAPanel(game: Phaser.Game): void {
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', left: '8px', top: '8px', zIndex: '99999', pointerEvents: 'none',
    font: '11px/1.45 ui-monospace,Consolas,monospace', color: '#e9f1e9', whiteSpace: 'pre',
    background: 'rgba(0,0,0,.72)', border: '1px solid rgba(201,154,69,.6)', borderRadius: '4px',
    padding: '6px 8px', maxWidth: '360px', overflow: 'hidden',
  } as CSSStyleDeclaration);
  document.body.appendChild(panel);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F9') { e.preventDefault(); panel.style.display = panel.style.display === 'none' ? '' : 'none'; }
  });

  const update = () => {
    if (panel.style.display === 'none') return;
    const active = game.scene.getScenes(true) as Phaser.Scene[];
    const top = active[active.length - 1];
    const key = top?.scene.key ?? '—';
    const cam = top?.cameras?.main;
    const player = (top as unknown as { player?: { x: number; y: number } } | undefined)?.player;
    const canvas = game.canvas.getBoundingClientRect();
    const a = ErrorCapture.getAssetCounts();
    const last = ErrorCapture.getLast();
    const modal = document.querySelector('.gol-cs .modal') ? ' + modal' : '';
    panel.textContent = [
      'QA MODE  (F9 hide/show)',
      `Build     ${BuildInfo.version}  ${BuildInfo.commit}`,
      `Built     ${BuildInfo.builtAt.replace('T', ' ').slice(0, 19)} UTC`,
      `Stage     ${BuildInfo.stage}`,
      `Scene     ${active.map((s) => s.scene.key).join(', ') || '—'}`,
      `State     ${(STATE_BY_SCENE[key] ?? key) + modal}`,
      `FPS       ${game.loop.actualFps.toFixed(0)}`,
      `Viewport  ${window.innerWidth}x${window.innerHeight}`,
      `Game      ${game.scale.width}x${game.scale.height} → ${fmt(canvas.width)}x${fmt(canvas.height)}`,
      `Player    ${player ? `${fmt(player.x)}, ${fmt(player.y)}` : '—'}`,
      `Camera    ${cam ? `${fmt(cam.scrollX)}, ${fmt(cam.scrollY)} zoom ${cam.zoom}` : '—'}`,
      `Slot      ${CharacterStore.getSelectedId() ?? '—'}`,
      `Assets    ${a.loaded} loaded / ${a.failed} failed`,
      `Errors    ${ErrorCapture.getErrors().length}`,
      `Last err  ${last ? `[${last.kind}] ${last.message}`.slice(0, 160) : '—'}`,
    ].join('\n');
  };
  update();
  window.setInterval(update, 250);
  (window as unknown as { __qa: unknown }).__qa = { build: BuildInfo, errors: ErrorCapture.getErrors, assets: ErrorCapture.getAssetCounts };
  console.info('[GodOfLegacy:qa] QA mode active', BuildInfo);
}
