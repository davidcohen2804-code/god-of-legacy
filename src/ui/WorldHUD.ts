// Minimal world HUD (DOM overlay): character name + Back to Characters.
import { PVP, WORLD_HUD as H } from '../config/layout';
import { ensureCharacterUIStyles, syncOverlay } from './CharacterSelectUI';

export class WorldHUD {
  private root: HTMLDivElement;
  private lastRect = '';
  private status?: HTMLDivElement;

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, name: string, onBack: () => void, showAttackHint = true, backText = 'BACK TO CHARACTERS') {
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
    label.textContent = backText;
    btn.appendChild(label);
    btn.style.fontSize = `${H.back.size}px`;
    this.box(btn, H.back.x, H.back.y, H.back.w, H.back.h);
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep keyboard focus on the game
    btn.addEventListener('click', onBack);
    this.root.appendChild(btn);

    const hint = document.createElement('div');
    hint.className = 'abs panel';
    this.box(hint, H.hint.centerX - H.hint.w / 2, H.hint.y - H.hint.h / 2, H.hint.w, H.hint.h);
    Object.assign(hint.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${H.hint.size}px`,
      letterSpacing: '2px', color: '#F3E7CF', opacity: '0.9',
    });
    hint.textContent = H.hint.text;
    if (showAttackHint) this.root.appendChild(hint);

    this.layout();
  }

  /** PvP: simple centered status line (CONNECTING… / ROOM FULL); null hides it. */
  setStatus(text: string | null): void {
    if (!text) { this.status?.remove(); this.status = undefined; return; }
    if (!this.status) {
      const S = PVP.hud.status;
      this.status = document.createElement('div');
      this.status.className = 'abs panel';
      this.box(this.status, S.centerX - S.w / 2, S.centerY - S.h / 2, S.w, S.h);
      Object.assign(this.status.style, {
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${S.size}px`,
        fontWeight: '700', letterSpacing: '2px', color: '#E8C77E',
      });
      this.root.appendChild(this.status);
    }
    this.status.textContent = text;
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
