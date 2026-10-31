// Composite renderer (proposal 5.4): every visible character is drawn into its own cell of one shared texture, with
// an optional silhouette outline (the character's parts stamped in the outline colour at 8 offsets underneath), and
// shown on screen as ONE image per character.
import Phaser from 'phaser';
import type { RigCharacter } from './RigCharacter';

const OFFS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71]];

export class Composite {
  readonly rt: Phaser.Textures.DynamicTexture;
  readonly cols: number;
  readonly rows: number;
  /** The root (feet) point inside a cell. */
  readonly rootX: number;
  readonly rootY: number;
  private readonly freeCells: number[] = [];

  constructor(scene: Phaser.Scene, readonly key: string, count: number, readonly cellW: number, readonly cellH: number, maxTex: number) {
    this.cols = Math.max(1, Math.min(count, Math.floor(maxTex / cellW), Math.ceil(Math.sqrt((count * cellH) / cellW))));
    this.rows = Math.ceil(count / this.cols);
    if (this.rows * cellH > maxTex) throw new Error(`composite ${count} × ${cellW}×${cellH} does not fit a ${maxTex} texture`);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.rt = scene.textures.addDynamicTexture(key, this.cols * cellW, this.rows * cellH)!;
    this.rootX = Math.round(cellW / 2);
    this.rootY = Math.round(cellH * 0.86);
    for (let i = 0; i < count; i++) {
      const f = this.rt.add(`c${i}`, 0, (i % this.cols) * cellW, Math.floor(i / this.cols) * cellH, cellW, cellH)!;
      f.customPivot = true; f.pivotX = this.rootX / cellW; f.pivotY = this.rootY / cellH;
      this.freeCells.push(count - 1 - i);
    }
  }

  get width(): number { return this.cols * this.cellW; }
  get height(): number { return this.rows * this.cellH; }

  alloc(): number { return this.freeCells.pop() ?? -1; }
  release(cell: number): void { if (cell >= 0) this.freeCells.push(cell); }

  cellOrigin(cell: number): [number, number] {
    return [(cell % this.cols) * this.cellW + this.rootX, Math.floor(cell / this.cols) * this.cellH + this.rootY];
  }

  /** Redraw every character's cell. `outline`: colour and width in texture px, or null. */
  draw(chars: readonly RigCharacter[], outline: { color: number; px: number } | null): void {
    const rt = this.rt;
    rt.clear();
    rt.beginDraw();
    for (const ch of chars) {
      if (ch.cell < 0 || !ch.drawn.length) continue;
      const [cx, cy] = this.cellOrigin(ch.cell);
      if (outline) {
        ch.tintAll(outline.color);
        for (const [dx, dy] of OFFS) rt.batchDraw(ch.container, cx + dx * outline.px, cy + dy * outline.px);
        ch.clearTint();
      }
      rt.batchDraw(ch.container, cx, cy);
    }
    rt.endDraw();
  }

  destroy(scene: Phaser.Scene): void { if (scene.textures.exists(this.key)) scene.textures.remove(this.key); }
}
