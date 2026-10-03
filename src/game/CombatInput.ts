// One combat input layer: keyboard movement intent, directional double-tap run, jump, Space/1–7 (+ HUD clicks),
// mouse world aim and a short action buffer. Movement intent and aim intent are independent.
import Phaser from 'phaser';

export const RUN_RULES = { doubleTapMs: 240, adjacentGraceMs: 180, releaseGraceMs: 110 };
export const BUFFER_MS = 160;
/** Skill presses made during an action stay queued this long (fires at the first legal frame). */
export const SKILL_BUFFER_MS = 600;

type DirKey = 'L' | 'R' | 'U' | 'D';
const VEC: Record<DirKey, [number, number]> = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };

export interface BufferedAction { slot: number; at: number }

export class CombatInput {
  /** Normalised movement intent (−1..1 per axis). */
  moveX = 0;
  moveY = 0;
  /** Run intent (directional double-tap; Shift = QA/accessibility). */
  running = false;
  /** Mouse world position (ground plane) and whether the pointer is over the game. */
  aimX = 0;
  aimY = 0;
  pointerActive = false;
  private lastTap: Partial<Record<DirKey, number>> = {};
  private runDir: DirKey | null = null;
  private runLostAt = -1;
  private held: Record<DirKey, boolean> = { L: false, R: false, U: false, D: false };
  private buffer: BufferedAction | null = null;
  private jumpQueued = -1;
  private now = 0;
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private detach: (() => void)[] = [];

  constructor(readonly scene: Phaser.Scene, onSlot: (slot: number) => void, onJump: () => void, onToggle: (key: 'K' | 'I' | 'O') => void) {
    const kb = scene.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    const map: [string, DirKey][] = [['A', 'L'], ['LEFT', 'L'], ['D', 'R'], ['RIGHT', 'R'], ['W', 'U'], ['UP', 'U'], ['S', 'D'], ['DOWN', 'D']];
    for (const [name, d] of map) {
      const down = (e: KeyboardEvent) => { if (!e.repeat) this.tap(d); };
      kb.on(`keydown-${name}`, down);
      this.detach.push(() => kb.off(`keydown-${name}`, down));
    }
    ['SPACE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'Q', 'R', 'F', 'G', 'C', 'V'].forEach((name, i) => {
      const h = (e: KeyboardEvent) => { if (!e.repeat) onSlot(i); };
      kb.on(`keydown-${name}`, h);
      this.detach.push(() => kb.off(`keydown-${name}`, h));
    });
    const j = (e: KeyboardEvent) => { if (!e.repeat) onJump(); };
    kb.on('keydown-E', j);
    this.detach.push(() => kb.off('keydown-E', j));
    for (const k of ['K', 'I', 'O'] as const) {
      const h = (e: KeyboardEvent) => { if (!e.repeat) onToggle(k); };
      kb.on(`keydown-${k}`, h);
      this.detach.push(() => kb.off(`keydown-${k}`, h));
    }
    // Keyboard-only control: the mouse never aims or steers (pointerActive stays false).
  }

  private setPointer(p: Phaser.Input.Pointer): void {
    const w = this.scene.cameras.main.getWorldPoint(p.x, p.y);
    this.aimX = w.x; this.aimY = w.y;
  }

  /** Direction key press: double-tap the same direction within the window starts a run in that direction. */
  private tap(d: DirKey): void {
    const t = this.now, last = this.lastTap[d];
    if (last !== undefined && t - last <= RUN_RULES.doubleTapMs) { this.runDir = d; this.runLostAt = -1; }
    this.lastTap[d] = t;
  }

  /** Buffer an action (slot) that could not start yet; fires on the first legal frame within BUFFER_MS. */
  bufferAction(slot: number): void { this.buffer = { slot, at: this.now }; }
  takeBuffered(): BufferedAction | null {
    if (this.buffer && this.now - this.buffer.at > SKILL_BUFFER_MS) this.buffer = null;
    return this.buffer;
  }
  consumeBuffer(): void { this.buffer = null; }
  clearBuffer(): void { this.buffer = null; this.jumpQueued = -1; }
  queueJump(): void { this.jumpQueued = this.now; }
  takeJump(): boolean { const ok = this.jumpQueued >= 0 && this.now - this.jumpQueued <= BUFFER_MS; if (ok) this.jumpQueued = -1; return ok; }

  /** Per frame (simulation clock): sample held keys and resolve run intent. */
  update(now: number): void {
    this.now = now;
    const k = this.keys;
    this.held = { L: k.A.isDown || k.LEFT.isDown, R: k.D.isDown || k.RIGHT.isDown, U: k.W.isDown || k.UP.isDown, D: k.S.isDown || k.DOWN.isDown };
    const ix = (this.held.R ? 1 : 0) - (this.held.L ? 1 : 0), iy = (this.held.D ? 1 : 0) - (this.held.U ? 1 : 0);
    const len = Math.hypot(ix, iy) || 1;
    this.moveX = ix / len; this.moveY = iy / len;
    // Run: kept while its direction (or an adjacent one within the grace window) is held; reversal breaks it.
    if (this.runDir) {
      const rv = VEC[this.runDir], dot = ix * rv[0] + iy * rv[1];
      if (dot < -0.7) this.runDir = null; // > 135° reversal
      else if (this.held[this.runDir]) this.runLostAt = -1;
      else if (ix !== 0 || iy !== 0) {
        if (this.runLostAt < 0) this.runLostAt = now;
        if (now - this.runLostAt > RUN_RULES.adjacentGraceMs) this.runDir = null;
        else { const nd = (Object.keys(VEC) as DirKey[]).find((d) => this.held[d] && VEC[d][0] * rv[0] + VEC[d][1] * rv[1] === 0); if (nd) { this.runDir = nd; this.runLostAt = -1; } }
      } else {
        if (this.runLostAt < 0) this.runLostAt = now;
        if (now - this.runLostAt > RUN_RULES.releaseGraceMs) this.runDir = null;
      }
    }
    this.running = (!!this.runDir || k.SHIFT.isDown) && (ix !== 0 || iy !== 0);
    const p = this.scene.input.activePointer;
    if (this.pointerActive) this.setPointer(p);
  }

  /** Space held: the basic chain auto-continues (DFO-style hold attack). */
  get attackHeld(): boolean { return !!this.keys.SPACE?.isDown; }

  get hasMove(): boolean { return this.moveX !== 0 || this.moveY !== 0; }

  /** Clear transient state (focus loss / death / scene exit). */
  reset(): void {
    this.scene.input.keyboard?.resetKeys();
    this.runDir = null; this.buffer = null; this.jumpQueued = -1; this.lastTap = {};
    this.moveX = 0; this.moveY = 0; this.running = false;
  }

  destroy(): void {
    for (const d of this.detach) d();
    this.detach = [];
  }
}
