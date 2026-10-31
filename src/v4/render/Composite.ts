// Composite renderer (proposal 5.4): every visible character is drawn into its own cell of ONE shared texture, with
// an optional silhouette outline (the character's parts stamped in the outline colour at 8 offsets underneath), and
// shown on screen as one image per character. One texture for everything (crowd and wardrobe preview alike), because
// Phaser reallocates its shared capture target whenever two dynamic textures of different sizes are drawn in a frame.
import Phaser from 'phaser';
import type { RigCharacter } from './RigCharacter';

const OFFS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71]];

/** A cell: its size and where the character's root (feet) sits inside it, in texture px. */
export interface CellSpec { w: number; h: number; rootX: number; rootY: number }
interface Cell extends CellSpec { x: number; y: number }

export class Composite {
  readonly rt: Phaser.Textures.DynamicTexture;
  readonly cells: Cell[] = [];
  readonly width: number;
  readonly height: number;

  constructor(scene: Phaser.Scene, readonly key: string, specs: CellSpec[], maxTex: number) {
    // shelf packing, rows about as wide as the square root of the total area
    const area = specs.reduce((a, s) => a + s.w * s.h, 0), widest = Math.max(...specs.map((s) => s.w));
    const rowW = Math.min(maxTex, Math.max(widest, Math.ceil(Math.sqrt(area) * 1.05)));
    let x = 0, y = 0, rowH = 0, W = 0;
    for (const s of specs) {
      if (x + s.w > rowW) { x = 0; y += rowH; rowH = 0; }
      this.cells.push({ ...s, x, y });
      x += s.w; rowH = Math.max(rowH, s.h); W = Math.max(W, x);
    }
    this.width = W; this.height = y + rowH;
    if (this.height > maxTex) throw new Error(`composite ${this.width}×${this.height} does not fit a ${maxTex} texture`);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.rt = scene.textures.addDynamicTexture(key, this.width, this.height)!;
    this.cells.forEach((c, i) => {
      const f = this.rt.add(`c${i}`, 0, c.x, c.y, c.w, c.h)!;
      f.customPivot = true; f.pivotX = c.rootX / c.w; f.pivotY = c.rootY / c.h;
    });
  }

  cellOrigin(cell: number): [number, number] { const c = this.cells[cell]; return [c.x + c.rootX, c.y + c.rootY]; }

  /** Redraw the given characters' cells in one pass. `outline`: colour, or null; each character's width is its `outlinePx`. */
  draw(chars: readonly RigCharacter[], outline: number | null): void {
    const rt = this.rt;
    rt.clear();
    rt.beginDraw();
    for (const ch of chars) {
      if (ch.cell < 0 || !ch.drawn.length) continue;
      const [cx, cy] = this.cellOrigin(ch.cell);
      if (outline !== null) {
        ch.tintAll(outline);
        for (const [dx, dy] of OFFS) rt.batchDraw(ch.container, cx + dx * ch.outlinePx, cy + dy * ch.outlinePx);
        ch.clearTint();
      }
      rt.batchDraw(ch.container, cx, cy);
    }
    rt.endDraw();
  }

  destroy(scene: Phaser.Scene): void { if (scene.textures.exists(this.key)) scene.textures.remove(this.key); }
}
