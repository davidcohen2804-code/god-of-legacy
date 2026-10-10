// The camera's pitch in the arena, by the player (the camera panel's two buttons, Insert / Delete; Home resets): how high
// on its arc — the half moon from eye level (0°) to straight down (90°) — the camera looks at the floor from. The
// paintings are drawn at about 45°; another pitch is shown without bending anything that stands on the floor: the map
// (the painting, its living layers and its props' cut-outs) is squashed (a lower camera) or stretched (a higher one) in
// depth as the floor would be, and everything else — fighters, effects, names — keeps its own shape and size and only
// moves with the floor point it stands on. Drawn that way and put straight back: the game itself never sees it.
import Phaser from 'phaser';

/** The paintings' own pitch (degrees below eye level), the player's range and one step. */
export const PITCH_BASE = 45;
const MIN = 30, MAX = 70, STEP = 5;
/** The pitch the camera is at: kept while the game runs (match to match); Home resets it. */
let pitch = PITCH_BASE;

/** The map's own objects (squashed with the floor; their masks with them) and its top edge in the world. */
export interface PitchMap { parts: Phaser.GameObjects.GameObject[]; top: number }

type Placed = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Visible & { scrollFactorY?: number; depth: number; mask?: unknown };
/** How far below an object its floor point can be (its depth is its feet's y while it is up in the air). */
const AIR = 450;

export class CameraPitch {
  private saved: [Placed, number, number][] = [];

  constructor(private scene: Phaser.Scene, private cam: Phaser.Cameras.Scene2D.Camera, private map: () => PitchMap | null, private onChange?: (deg: number) => void) {
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.apply, this);
    scene.events.on(Phaser.Scenes.Events.RENDER, this.restore, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  get deg(): number { return pitch; }
  /** One step higher (+1: toward straight down) or lower (-1: toward eye level). */
  step(dir: 1 | -1): void { this.set(pitch + dir * STEP); }
  reset(): void { this.set(PITCH_BASE); }
  private set(d: number): void { pitch = Phaser.Math.Clamp(Math.round(d), MIN, MAX); this.onChange?.(pitch); }

  /** Just before the frame is drawn: the floor squashed or stretched about the view's middle, the rest moved with it. */
  private apply(): void {
    this.restore();
    if (pitch === PITCH_BASE) return;
    const m = this.map();
    if (!m) return;
    const q = Math.sin(Phaser.Math.DegToRad(pitch)) / Math.sin(Phaser.Math.DegToRad(PITCH_BASE));
    const cam = this.cam, mid = cam.scrollY + cam.height / 2, half = cam.height / cam.zoom / 2;
    // the line that stays put: the view's middle (lower: never so low that the map's top edge comes down into view)
    const a = q < 1 ? Math.min(mid, (mid - half - q * m.top) / (1 - q)) : mid;
    const keep = (o: Placed) => this.saved.push([o, o.y, o.scaleY]);
    const done = new Set<unknown>();
    const squash = (o: Placed) => { if (done.has(o)) return; done.add(o); keep(o); o.y = a + q * (o.y - a); o.scaleY *= q; };
    const parts = new Set<unknown>(m.parts);
    for (const o of m.parts as Placed[]) {
      squash(o);
      const g = (o.mask as { geometryMask?: Placed } | undefined)?.geometryMask;
      if (g) squash(g);
    }
    // everything else: moved with its floor point, its shape kept (a shadow or a ring on the floor flattens with it)
    const visit = (o: Placed, py: number, ps: number, top: boolean) => {
      if (!o.visible || parts.has(o) || o.scrollFactorY === 0) return;
      const wy = py + o.y * ps;   // where it is in the world
      if (o instanceof Phaser.GameObjects.Container && o.rotation === 0 && o.scaleX === o.scaleY) {
        if (o.x === 0 && o.y === 0) { for (const c of o.list as Placed[]) visit(c, wy, ps * o.scaleY, false); return; }
      }
      if (o instanceof Phaser.GameObjects.Graphics && o.x === 0 && o.y === 0) {   // drawn in world space: a floor layer
        if (top && o.depth <= 2) { keep(o); o.y = (a + q * (py - a) - py) / ps; o.scaleY *= q; }
        return;
      }
      const floor = top && o.depth > wy - 2 && o.depth - wy < AIR && Math.abs(o.depth) > 1 ? o.depth : wy;
      keep(o);
      o.y += (q - 1) * (floor - a) / ps;
      if (o instanceof Phaser.GameObjects.Ellipse || (o as { texture?: { key: string } }).texture?.key === 'contact-shadow') o.scaleY *= q;
    };
    for (const o of this.scene.children.list as Placed[]) visit(o, 0, 1, true);
  }

  /** Right after the frame: everything back where the game put it. */
  private restore(): void {
    for (let i = this.saved.length - 1; i >= 0; i--) { const [o, y, sy] = this.saved[i]; o.y = y; o.scaleY = sy; }
    this.saved.length = 0;
  }

  destroy(): void {
    this.restore();
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.apply, this);
    this.scene.events.off(Phaser.Scenes.Events.RENDER, this.restore, this);
  }
}
