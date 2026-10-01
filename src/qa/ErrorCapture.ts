// Always-on error capture: logs clearly to the console and keeps the latest errors for QA mode.
import Phaser from 'phaser';

export type ErrorKind = 'window' | 'promise' | 'phaser' | 'asset';
export interface CapturedError { kind: ErrorKind; message: string; time: string }

const MAX = 20;
const errors: CapturedError[] = [];
const assets = { loaded: 0, failed: 0 };

function record(kind: ErrorKind, message: string, detail?: unknown): void {
  const e = { kind, message, time: new Date().toISOString() };
  errors.push(e);
  if (errors.length > MAX) errors.shift();
  console.error(`[GodOfLegacy:${kind}] ${message}`, detail ?? '');
}

export const ErrorCapture = {
  getErrors: (): readonly CapturedError[] => errors,
  getLast: (): CapturedError | undefined => errors[errors.length - 1],
  getAssetCounts: () => ({ ...assets }),

  /** Window errors, resource errors and unhandled promise rejections. Call before the game starts. */
  installGlobal(): void {
    window.addEventListener('error', (ev) => {
      const t = ev.target as HTMLElement | null;
      if (t && t !== (window as unknown) && (t as HTMLImageElement).src !== undefined && !(ev instanceof ErrorEvent)) {
        assets.failed++;
        record('asset', `Failed to load ${(t as HTMLImageElement).src || (t as HTMLLinkElement).href}`);
        return;
      }
      const e = ev as ErrorEvent;
      const where = e.filename ? ` (${e.filename}:${e.lineno}:${e.colno})` : '';
      const isPhaser = /phaser/i.test(e.error?.stack ?? '') || /phaser/i.test(e.filename ?? '');
      record(isPhaser ? 'phaser' : 'window', `${e.message}${where}`, e.error);
    }, true);
    window.addEventListener('unhandledrejection', (ev) => {
      const r = ev.reason;
      record('promise', r instanceof Error ? r.message : String(r), r);
    });
  },

  /** Phaser-specific hooks: loader results in every scene and WebGL context loss. */
  attachGame(game: Phaser.Game): void {
    const hookScene = (scene: Phaser.Scene) => {
      const load = (scene.sys as unknown as { load?: Phaser.Loader.LoaderPlugin }).load;
      if (!load || (load as unknown as { __golQA?: boolean }).__golQA) return;
      (load as unknown as { __golQA?: boolean }).__golQA = true;
      load.on(Phaser.Loader.Events.FILE_COMPLETE, () => { assets.loaded++; });
      load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
        assets.failed++;
        record('asset', `Phaser failed to load "${file.key}" from ${String(file.url)}`);
      });
    };
    game.events.once(Phaser.Core.Events.READY, () => {
      game.scene.scenes.forEach(hookScene);
      const r = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
      r.on?.(Phaser.Renderer.Events.LOSE_WEBGL, () => record('phaser', 'WebGL context lost'));
      r.on?.(Phaser.Renderer.Events.RESTORE_WEBGL, () => console.warn('[GodOfLegacy:phaser] WebGL context restored'));
    });
  },
};
