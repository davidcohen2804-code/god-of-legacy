// Placeholder art: flat two-tone shapes drawn by script into one atlas canvas. Coordinates are in B units relative to
// the part's pivot (its bone origin), drawn as the part looks in the rest pose, facing right. Line widths are in
// master px (B = 768), so the 256 px and 512 px atlases look the same, only sharper.

export interface Sty { f: string; s?: string; l?: string | null; lw?: number }

const LIGHT: [number, number] = [0.011, -0.013]; // the lit side: front and up (the shade stays back and down)
export const LINE = '#3a2622';
const MASTER_B = 768;

type Op = (ctx: CanvasRenderingContext2D, k: number) => void;

/** Records shapes (and their bounds) for one part, then replays them at any scale. */
export class Painter {
  readonly ops: Op[] = [];
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;

  private grow(x0: number, y0: number, x1: number, y1: number, pad: number): void {
    this.x0 = Math.min(this.x0, x0 - pad); this.y0 = Math.min(this.y0, y0 - pad);
    this.x1 = Math.max(this.x1, x1 + pad); this.y1 = Math.max(this.y1, y1 + pad);
  }

  private shape(path: (ctx: CanvasRenderingContext2D, k: number, dx: number, dy: number) => void, st: Sty): void {
    const lw = (st.lw ?? 8) / MASTER_B;
    this.ops.push((ctx, k) => {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (st.s) {
        ctx.beginPath(); path(ctx, k, 0, 0); ctx.fillStyle = st.s; ctx.fill();
        ctx.save(); ctx.beginPath(); path(ctx, k, 0, 0); ctx.clip();
        ctx.beginPath(); path(ctx, k, LIGHT[0], LIGHT[1]); ctx.fillStyle = st.f; ctx.fill();
        ctx.restore();
      } else { ctx.beginPath(); path(ctx, k, 0, 0); ctx.fillStyle = st.f; ctx.fill(); }
      if (st.l !== null) { ctx.beginPath(); path(ctx, k, 0, 0); ctx.strokeStyle = st.l ?? LINE; ctx.lineWidth = lw * k; ctx.stroke(); }
    });
  }

  ell(cx: number, cy: number, rx: number, ry: number, st: Sty, rot = 0): this {
    const r = Math.max(rx, ry);
    this.grow(cx - r, cy - r, cx + r, cy + r, (st.lw ?? 8) / MASTER_B);
    this.shape((ctx, k, dx, dy) => ctx.ellipse((cx + dx) * k, (cy + dy) * k, rx * k, ry * k, rot, 0, Math.PI * 2), st);
    return this;
  }

  /** Closed polygon through flat [x, y, x, y…]; `round` softens the corners with quadratic curves. */
  poly(pts: number[], st: Sty, round = true): this {
    for (let i = 0; i < pts.length; i += 2) this.grow(pts[i], pts[i + 1], pts[i], pts[i + 1], (st.lw ?? 8) / MASTER_B);
    this.shape((ctx, k, dx, dy) => {
      const n = pts.length / 2, P = (i: number): [number, number] => [(pts[(i % n) * 2] + dx) * k, (pts[(i % n) * 2 + 1] + dy) * k];
      if (!round) { ctx.moveTo(...P(0)); for (let i = 1; i < n; i++) ctx.lineTo(...P(i)); ctx.closePath(); return; }
      const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      ctx.moveTo(...mid(P(n - 1), P(0)));
      for (let i = 0; i < n; i++) { const c = P(i), m = mid(c, P(i + 1)); ctx.quadraticCurveTo(c[0], c[1], m[0], m[1]); }
      ctx.closePath();
    }, st);
    return this;
  }

  /** Capsule (rounded limb) from (x0, y0) to (x1, y1), radius r. */
  cap(x0: number, y0: number, x1: number, y1: number, r: number, st: Sty): this {
    this.grow(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, (st.lw ?? 8) / MASTER_B);
    const a = Math.atan2(y1 - y0, x1 - x0);
    this.shape((ctx, k, dx, dy) => {
      ctx.arc((x0 + dx) * k, (y0 + dy) * k, r * k, a + Math.PI / 2, a - Math.PI / 2);
      ctx.arc((x1 + dx) * k, (y1 + dy) * k, r * k, a - Math.PI / 2, a + Math.PI / 2);
      ctx.closePath();
    }, st);
    return this;
  }

  rr(x: number, y: number, w: number, h: number, r: number, st: Sty): this {
    this.grow(x, y, x + w, y + h, (st.lw ?? 8) / MASTER_B);
    this.shape((ctx, k, dx, dy) => ctx.roundRect((x + dx) * k, (y + dy) * k, w * k, h * k, r * k), st);
    return this;
  }

  /** An open line (detail strokes: folds, lids, seams). */
  line(pts: number[], color: string, lw = 6): this {
    for (let i = 0; i < pts.length; i += 2) this.grow(pts[i], pts[i + 1], pts[i], pts[i + 1], lw / MASTER_B);
    this.ops.push((ctx, k) => {
      ctx.beginPath(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.moveTo(pts[0] * k, pts[1] * k);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * k, pts[i + 1] * k);
      ctx.strokeStyle = color; ctx.lineWidth = (lw / MASTER_B) * k; ctx.stroke();
    });
    return this;
  }

  dot(cx: number, cy: number, r: number, color: string): this {
    this.grow(cx - r, cy - r, cx + r, cy + r, 0);
    this.ops.push((ctx, k) => { ctx.beginPath(); ctx.arc(cx * k, cy * k, r * k, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
    return this;
  }

  /** Replay at `k` canvas px per B, with the pivot at (ox, oy). */
  paint(ctx: CanvasRenderingContext2D, k: number, ox: number, oy: number): void {
    ctx.save(); ctx.translate(ox, oy);
    for (const op of this.ops) op(ctx, k);
    ctx.restore();
  }
}

export interface PackedFrame { name: string; x: number; y: number; w: number; h: number; px: number; py: number }

/** Paints every part into one atlas canvas (shelf packing, 2 px gaps). Returns the canvas and its frames, each with the
 *  pivot as its origin (0..1). */
export function buildAtlas(parts: Map<string, Painter>, k: number, maxW = 2048): { canvas: HTMLCanvasElement; frames: PackedFrame[] } {
  const items = [...parts.entries()].map(([name, p]) => {
    const pad = 2;
    const w = Math.ceil((p.x1 - p.x0) * k) + pad * 2, h = Math.ceil((p.y1 - p.y0) * k) + pad * 2;
    return { name, p, w, h, ox: -p.x0 * k + pad, oy: -p.y0 * k + pad };
  }).sort((a, b) => b.h - a.h);
  let x = 0, y = 0, rowH = 0, W = 0;
  const placed: { it: (typeof items)[number]; x: number; y: number }[] = [];
  for (const it of items) {
    if (x + it.w > maxW) { x = 0; y += rowH + 2; rowH = 0; }
    placed.push({ it, x, y }); x += it.w + 2; rowH = Math.max(rowH, it.h); W = Math.max(W, x);
  }
  const H = y + rowH;
  const pow2 = (v: number) => 2 ** Math.ceil(Math.log2(Math.max(1, v)));
  const canvas = document.createElement('canvas');
  canvas.width = pow2(W); canvas.height = pow2(H);
  const ctx = canvas.getContext('2d')!;
  const frames: PackedFrame[] = [];
  for (const { it, x: px, y: py } of placed) {
    it.p.paint(ctx, k, px + it.ox, py + it.oy);
    frames.push({ name: it.name, x: px, y: py, w: it.w, h: it.h, px: it.ox / it.w, py: it.oy / it.h });
  }
  return { canvas, frames };
}
