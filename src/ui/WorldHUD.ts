// Minimal world HUD (DOM overlay): character name + Back to Characters.
import { WORLD_HUD as H } from '../config/layout';
import { ensureCharacterUIStyles, syncOverlay } from './CharacterSelectUI';

export class WorldHUD {
  private root: HTMLDivElement;
  private lastRect = '';

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, name: string, onBack: () => void) {
    ensureCharacterUIStyles();
    this.root = document.createElement('div');
    this.root.className = 'gol-cs';
    host.appendChild(this.root);

    const panel = document.createElement('div');
    panel.className = 'abs panel';
    this.box(panel, H.name.x, H.name.y, H.name.w, H.name.h);
    Object.assign(panel.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${H.name.size}px`,
      fontWeight: '700', letterSpacing: '1.5px', color: '#E8C77E', whiteSpace: 'nowrap', overflow: 'hidden',
    });
    panel.textContent = name;
    this.root.appendChild(panel);

    const btn = document.createElement('button');
    btn.className = 'btn abs';
    const label = document.createElement('span');
    label.textContent = 'BACK TO CHARACTERS';
    btn.appendChild(label);
    btn.style.fontSize = `${H.back.size}px`;
    this.box(btn, H.back.x, H.back.y, H.back.w, H.back.h);
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep keyboard focus on the game
    btn.addEventListener('click', onBack);
    this.root.appendChild(btn);

    this.layout();
  }

  layout(): void {
    this.lastRect = syncOverlay(this.root, this.host, this.canvas, this.lastRect);
  }

  destroy(): void {
    this.root.remove();
  }

  private box(e: HTMLElement, x: number, y: number, w: number, h: number): void {
    Object.assign(e.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }
}
