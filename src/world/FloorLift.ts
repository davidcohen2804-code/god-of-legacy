import Phaser from 'phaser';
import { WORLD_OBJECTS, supportAt } from './WorldGeometry';

/** Skill effects drawn on the floor (rings, cracks, fields, dust — the FX modules' GROUND layer, depth 2..8) are placed at
 *  the floor point (x, y) only: up on a cloud or a map above they showed on the terrace far below. This lifts each one to
 *  the floor its nearest actor stands on (the caster, or the foe it lands on): drawn up by that floor's height and over
 *  that floor's picture, under whoever stands on it. An effect that keeps moving (follows someone) is lifted every frame. */
const LO = 1.9, HI = 8.2;

type Obj = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject;
interface State { depth0: number; set: number; base: number; lift: number; depth: number }

export class FloorLift {
  private state = new Map<Obj, State>();
  private onPost = () => this.step();

  /** What was in the world before any skill (its pictures, props): never touched. */
  private static_ = new WeakSet<Phaser.GameObjects.GameObject>();

  constructor(private scene: Phaser.Scene, private actors: () => { x: number; y: number; z: number }[], private casting: () => boolean) {
    for (const go of scene.children.list) this.static_.add(go);
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.onPost);
  }

  /** The floor under the actor nearest (x, y) — an effect at the floor point (lift: that floor's height) or one already
   *  drawn up at the actor's height (lift 0): that floor's height and the depth its picture is drawn at. */
  private floorNear(x: number, y: number): { z: number; depth: number } | null {
    let best: { x: number; y: number; z: number } | null = null, bd = 520, up = false;
    for (const a of this.actors()) {
      const d = Math.abs(a.x - x) + Math.abs(a.y - y) * 1.5, du = Math.abs(a.x - x) + Math.abs(a.y - a.z - y) * 1.5;
      if (d < bd) { bd = d; best = a; up = false; }
      if (a.z > 0 && du < bd) { bd = du; best = a; up = true; }
    }
    if (!best) return null;
    const s = supportAt(best.x, best.y, best.z + 1);
    if (s.z <= 0 || !s.id) return null;
    const o = WORLD_OBJECTS.find((w) => w.id === s.id);
    return { z: up ? 0 : s.z, depth: (o?.frontY ?? best.y) + 0.2 };
  }

  /** Every frame: the floor-layer effects shown (new ones, and pooled ones shown again) and the lifted ones moved by their
   *  own code are placed on their floor anew. */
  private step(): void {
    for (const [g, st] of this.state) if (!g.active || !g.visible) { if (g.active) g.setDepth(st.depth0); this.state.delete(g); }   // (hidden: back as it was, for its next use)
    for (const go of this.scene.children.list) {
      const g = go as Obj, st = this.state.get(g);
      if (this.static_.has(go)) continue;
      if (!g.visible || typeof g.depth !== 'number' || typeof g.y !== 'number') continue;
      if (st) {
        const moved = Math.abs(g.y - st.set) > 0.01;
        if (Math.abs(g.depth - st.depth) > 0.01) { this.state.delete(g); if ((g.depth < LO || g.depth > HI) && Math.abs(g.depth - g.y) > 40) continue; }   // its own code re-set its depth
        else if (!moved) continue;
        else {
          // moved by its own code: set anew from the floor point (a follow: far from where we left it) or nudged from where we
          // left it (drifting motes, a shake: the nudge kept, already up there)
          const dy = g.y - st.set;
          if (Math.abs(dy) < st.lift * 0.5) { st.base += dy; st.set = g.y; } else { st.base = g.y; g.y = st.base - st.lift; st.set = g.y; }
          continue;
        }
      }
      // the floor layer, or (while a skill is on) drawn at its floor point and sorted by it (depth = its y)
      const band = g.depth >= LO && g.depth <= HI, byY = !band && g.depth > HI && Math.abs(g.depth - g.y) <= 40 && this.casting() && ((g as unknown as { displayWidth?: number }).displayWidth ?? 0) < 900;   // (never the world's own pictures)
      if (!band && !byY) continue;
      const f = this.floorNear(g.x, g.y);
      if (!f) continue;
      const depth = band ? f.depth + (g.depth - LO) * 0.04 : f.depth + 0.5 + Math.max(-40, Math.min(40, g.depth - g.y)) * 0.004;
      this.state.set(g, { depth0: g.depth, base: g.y, lift: f.z, depth, set: g.y - f.z });
      g.y -= f.z; g.setDepth(depth);
    }
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.onPost);
    this.state.clear();
  }
}
