import Phaser from 'phaser';
import { Resolution } from '../config/layout';

// The only place that knows about the host platform (browser now, desktop wrapper later).
// A future desktop wrapper exposes `window.godOfLegacyDesktop` with these methods.
interface DesktopBridge {
  exit(): void;
  setFullscreen?(on: boolean): void;
  setResolution?(w: number, h: number): void;
}

const desktop = (): DesktopBridge | undefined =>
  (window as unknown as { godOfLegacyDesktop?: DesktopBridge }).godOfLegacyDesktop;

export const PlatformAdapter = {
  /** Resolves 'closed' when the game was exited, 'blocked' when the browser refused to close the tab. */
  async exitGame(): Promise<'closed' | 'blocked'> {
    const d = desktop();
    if (d) { d.exit(); return 'closed'; }
    window.close(); // Browser: only works if the tab was opened by script.
    await new Promise((r) => setTimeout(r, 300));
    return window.closed ? 'closed' : 'blocked';
  },

  setFullscreen(game: Phaser.Game, on: boolean): void {
    const d = desktop();
    if (d?.setFullscreen) { d.setFullscreen(on); return; }
    if (on && !game.scale.isFullscreen) game.scale.startFullscreen();
    else if (!on && game.scale.isFullscreen) game.scale.stopFullscreen();
  },

  applyResolution(game: Phaser.Game, res: Resolution): void {
    const [w, h] = res.split('x').map(Number);
    const d = desktop();
    if (d?.setResolution) { d.setResolution(w, h); return; }
    // Browser: the selected resolution is the maximum window-mode display size.
    const parent = game.scale.parent as HTMLElement;
    parent.style.maxWidth = `${w}px`;
    parent.style.maxHeight = `${h}px`;
    game.scale.getParentBounds();
    game.scale.refresh();
  },
};
