import Phaser from 'phaser';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { DESIGN } from './config/layout';
import { WORLD_OBJECTS, supportAt, pointInPoly, footAllowed } from './world/WorldGeometry';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { CharacterCreateScene } from './scenes/CharacterCreateScene';
import { LegacyCourtyardScene } from './scenes/LegacyCourtyardScene';
import { PvpSelectScene } from './scenes/PvpSelectScene';
import { ErrorCapture } from './qa/ErrorCapture';
import { isQAMode, startQAPanel } from './qa/QAPanel';
import ASSET_HASH from 'virtual:asset-hashes';

ErrorCapture.installGlobal();

// Cache-bust every game asset by its content hash (computed at build time): same file names (e.g. run.png) never stay
// stale after an update, and a deploy only re-downloads the files that really changed. Unknown files: per build.
{
  const LP = Phaser.Loader.LoaderPlugin.prototype as unknown as { addFile(f: unknown): void };
  const orig = LP.addFile;
  LP.addFile = function (this: unknown, file: unknown) {
    const list = Array.isArray(file) ? file : [file];
    for (const f of list as { url?: unknown }[]) {
      if (typeof f.url !== 'string' || f.url.startsWith('data:') || f.url.startsWith('blob:') || f.url.includes('?v=')) continue;
      const v = ASSET_HASH[f.url.replace(/^\.?\//, '').split('?')[0]] ?? __BUILD_COMMIT__;
      f.url += (f.url.includes('?') ? '&' : '?') + 'v=' + v;
    }
    return orig.call(this, file);
  };
}

// Auto-update: when a newer build is deployed, reload onto a fresh URL (bypasses the CDN/browser cache).
function watchForUpdates(): void {
  const check = async () => {
    try {
      const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return;
      const { commit } = await r.json() as { commit: string };
      if (commit && commit !== __BUILD_COMMIT__ && commit !== 'unknown') {
        const u = new URL(location.href); u.searchParams.set('v', commit); location.replace(u.toString());
      }
    } catch { /* offline: try again later */ }
  };
  // a browser-cached page (Pages sends max-age=600) corrects itself right after loading, then every 15 s
  setTimeout(check, 1500);
  setInterval(check, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}
if (!location.hostname.includes('localhost')) watchForUpdates();

// Phaser draws text once, so the fonts must be loaded before any scene creates text: Cinzel (titles, names, buttons) and
// Inter (everything you read: descriptions, values, labels, chat) — Georgia / Segoe UI stay as fallbacks.
async function loadFonts(): Promise<void> {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('400 24px Cinzel'), document.fonts.load('700 24px Cinzel'), ...[400, 500, 600, 700].map((w) => document.fonts.load(`${w} 16px Inter`))]),
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
    scene: [BootScene, MainMenuScene, CharacterSelectScene, CharacterCreateScene, PvpSelectScene, LegacyCourtyardScene],
  });

  ErrorCapture.attachGame(game);
  if (isQAMode()) startQAPanel(game);

  (window as unknown as { __game: Phaser.Game }).__game = game;
  (window as unknown as { __geo: unknown }).__geo = { WORLD_OBJECTS, supportAt, pointInPoly, footAllowed };   // the automated movement tests
});
