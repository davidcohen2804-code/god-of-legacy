// Archer body motion layer (presentation only, every client draws it the same from the cast timeline):
// the four drawn attack poses get real movement on top — wind-up lean, release recoil, back-flips, leaps, the roar's
// stretch — plus afterimages on the fast moves. Gameplay never reads any of this.
import Phaser from 'phaser';

export interface Motion {
  /** Screen offset (px) of the body. */
  dx: number; dy: number;
  /** Rotation (deg, Phaser: + = clockwise) around a pivot `pivot` px above the feet. */
  ang: number; pivot: number;
  /** Scale multipliers (squash / stretch around the feet). */
  sx: number; sy: number;
  /** Leave afterimages this frame. */
  after: boolean;
  /** Face the other way this frame (a spin seen from the side). */
  flip?: boolean;
  /** Body opacity this frame (a vanishing step), 0..1. */
  alpha?: number;
}

export interface Timeline { startup: number; active: number; recovery: number }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));
/** Damped kick: 1 at t=0 falling to 0 by `len` ms. */
const kick = (t: number, len: number) => (t < 0 || t > len ? 0 : Math.pow(1 - t / len, 2));
const M = (o: Partial<Motion> = {}): Motion => ({ dx: 0, dy: 0, ang: 0, pivot: 60, sx: 1, sy: 1, after: false, ...o });

/** Heavy draw shots: lean back while drawing, snap forward recoil on release. `power` 0..1 scales everything. */
function shot(e: number, T: Timeline, face: number, power: number): Motion {
  const draw = clamp01(e / Math.max(1, T.startup)), r = e - T.startup;
  if (r < 0) return M({ dx: -face * 4 * power * easeOut(draw), ang: -face * 5 * power * easeOut(draw), sx: 1 + 0.03 * power * draw, sy: 1 - 0.03 * power * draw });
  const k = kick(r, 260);
  return M({ dx: -face * (4 * power + 14 * power * k), ang: -face * (5 * power * (1 - clamp01(r / 220)) - 3 * power * k), sx: 1 + 0.05 * power * k, sy: 1 - 0.05 * power * k });
}

/** The archer's motion for a skill at `e` ms into the cast (null = no motion). */
export function archerMotion(id: string, e: number, T: Timeline, face: number): Motion | null {
  const A = T.startup + T.active, end = A + T.recovery;
  if (e < 0 || e > end) return null;
  switch (id) {
    case 'quick_shot': return shot(e, T, face, 0.35);
    case 'multi_shot': return shot(e, T, face, 0.6);
    case 'explosive_arrow': return shot(e, T, face, 0.95);
    case 'eagle_arrow': case 'leaping_arrow': { // long charge: sink low and tremble harder and harder, then the huge release
      const big = id === 'eagle_arrow' ? 1.4 : 1, r = e - T.startup, p = clamp01(e / T.startup);
      if (r < 0) { const j = Math.sin(e * 1.1) * (0.6 + 2.6 * p) * big; return M({ sy: 1 - 0.12 * easeOut(clamp01(p * 3)), sx: 1 + 0.07 * easeOut(clamp01(p * 3)), dx: j - face * 6 * p, ang: -face * 6 * p }); }
      const k = kick(r, 380);
      return M({ dx: -face * 26 * big * k, ang: -face * 9 * big * k, sx: 1 + 0.06 * k, sy: 1 - 0.06 * k, after: r < 220 });
    }
    case 'piercing_arrow': { // the emblem lights up behind her: rise and stand tall
      const r = e - T.startup;
      if (r < 0) return M({ sy: 1 - 0.07 * clamp01(e / T.startup) });
      return M({ dy: -12 * Math.sin(Math.PI * clamp01(r / (T.active + 240))), sy: 1.05, sx: 0.98 });
    }
    case 'rain_of_arrows': { // crouch, spring into the air (the real height is the leap), tilt down at the floor and recoil on each lightning arrow
      const r = e - T.startup;
      if (r < 0) return M({ sy: 1 - 0.12 * easeOut(clamp01(e / T.startup)), sx: 1.06 });
      if (e < A) { const k = Math.max(kick(r - 310, 160), kick(r - 590, 160), kick(r - 870, 200)); return M({ ang: face * (16 * clamp01(r / 300) - 10 * k), dx: -face * 10 * k, after: k > 0.3 || r < 300 }); }
      return null;
    }
    case 'rising_arrow': { // crouch, spring up as the column erupts
      const big = 1, p = clamp01(e / T.startup), r = e - T.startup;
      if (r < 0) return M({ sy: 1 - 0.1 * big * easeOut(p), sx: 1 + 0.06 * big * easeOut(p), dx: -face * 3 * p });
      const up = Math.sin(Math.PI * clamp01(r / (T.active + 120)));
      return M({ dy: -18 * big * up, sy: 1 + 0.07 * big * kick(r, 200), sx: 1 - 0.04 * big * kick(r, 200), ang: -face * 6 * big * up, dx: -face * 10 * kick(r, 300), after: r < 160 });
    }
    case 'retreat_kick': { // crouch → high kick → back-flip away → crouched landing
      const r = e - T.startup;
      if (r < 0) return M({ sy: 0.9, sx: 1.06 });
      const p = clamp01(r / T.active);
      if (p < 0.28) return M({ ang: -face * 22 * (p / 0.28), after: true }); // the kick leans back
      const f = easeInOut(clamp01((p - 0.28) / 0.72));
      if (e < A) return M({ ang: -face * (22 + 338 * f), pivot: 56, after: true });
      return M({ sy: 1 - 0.12 * kick(e - A, 220), sx: 1 + 0.08 * kick(e - A, 220) }); // landing squash
    }
    case 'skyhunters_step': { // airborne volley: tilted down at the foes, recoil on every shot
      const r = e - T.startup;
      if (r < 0) return M({ sy: 1 - 0.08 * clamp01(e / T.startup), after: false });
      if (e < A) { const shotK = kick(r % 150, 120); return M({ ang: face * (18 - 8 * shotK), dx: -face * 8 * shotK, after: true }); }
      return null;
    }
    case 'hunters_roar': { // gather (crouch) → roar (stretch tall, trembling)
      const r = e - T.startup;
      if (r < 0) return M({ sy: 1 - 0.12 * easeOut(clamp01(e / T.startup)), sx: 1 + 0.08 * easeOut(clamp01(e / T.startup)) });
      if (e < A + 120) { const j = Math.sin(e * 0.9) * 2.2; return M({ sy: 1.1, sx: 0.95, dx: j, ang: -face * 7 }); }
      return M({ sy: 1 + 0.1 * (1 - clamp01((e - A - 120) / 200)) });
    }
    case 'bow_haste': case 'hunters_spirit': case 'spirit_hawk': { // gather, rise on the toes as the power answers
      const r = e - T.startup;
      if (r < 0) return M({ sy: 1 - 0.06 * clamp01(e / T.startup), dy: 0 });
      return M({ dy: -10 * Math.sin(Math.PI * clamp01(r / (T.active + 200))), sy: 1.04, sx: 0.98 });
    }
    case 'tree_of_life': { // kneel and plant the seed, rise as the tree grows
      const r = e - T.startup;
      if (r < 0) return M({ sy: 1 - 0.14 * easeOut(clamp01(e / T.startup)), sx: 1.06 });
      return M({ sy: 1 - 0.14 * (1 - clamp01(r / 260)) });
    }
    case 'arrow_storm': { // planted wide, trembling under the rapid fire
      const r = e - T.startup;
      if (r < 0) return M({ sy: 1 - 0.1 * easeOut(clamp01(e / T.startup)), sx: 1.06 });
      if (e < A) { const k = kick(r % 150, 120); return M({ dx: -face * (3 + 5 * k) + Math.sin(e * 1.3) * 1.2, ang: -face * (2 + 2 * k), sx: 1.02, sy: 0.98 }); }
      return null;
    }
    case 'sky_rain': { // crouch → leap high → hang drawing at the sky → the release → drop back
      const p = clamp01(e / T.startup), r = e - T.startup;
      if (p < 0.25) return M({ sy: 1 - 0.16 * easeOut(p / 0.25), sx: 1.08 });
      if (r < 0) { const up = easeOut(clamp01((p - 0.25) / 0.35)); return M({ dy: -95 * up, ang: -face * 14 * up, after: p < 0.6 }); }
      if (e < A) return M({ dy: -95 + 6 * Math.sin(r / 90), ang: -face * (14 + 6 * kick(r % 220, 160)) });
      const d = clamp01((e - A) / T.recovery);
      return M({ dy: -95 * (1 - d * d), sy: d > 0.85 ? 0.9 : 1, after: d < 0.7 });
    }
  }
  return null;
}

/** Wind Leap: a forward somersault over `ms` after the second jump. */
export function leapMotion(t: number, face: number, ms = 420): Motion | null {
  if (t < 0 || t > ms) return null;
  return M({ ang: face * 360 * easeInOut(t / ms), pivot: 52, after: true });
}

/** Apply a motion to a body sprite (and its cross-fade ghost); null resets it. Pivot rotation keeps the body centred. */
export function applyMotion(sprites: Phaser.GameObjects.Sprite[], m: Motion | null): void {
  for (const s of sprites) {
    if (!m) { s.setAngle(0); continue; }
    const th = (m.ang * Math.PI) / 180, hp = m.pivot * Math.abs(s.scaleY);
    s.setScale(s.scaleX * m.sx, s.scaleY * m.sy).setAngle(m.ang)
      .setPosition(s.x + m.dx - hp * Math.sin(th), s.y + m.dy - hp + hp * Math.cos(th));
    if (m.flip) s.setFlipX(!s.flipX);
    if (m.alpha !== undefined) s.setAlpha(s.alpha * m.alpha);
  }
}

/** Afterimages: green-tinted copies of the body left behind, fading fast. */
export class Afterimages {
  private last = -Infinity;
  constructor(private scene: Phaser.Scene, private tint = 0x9be35a) {}
  step(now: number, body: Phaser.GameObjects.Sprite, on: boolean, every = 45): void {
    if (!on || !body.visible || now - this.last < every) return;
    this.last = now;
    const g = this.scene.add.sprite(body.x, body.y, body.texture.key, body.frame.name).setOrigin(body.originX, body.originY)
      .setScale(body.scaleX, body.scaleY).setAngle(body.angle).setFlipX(body.flipX).setDepth(body.depth - 0.3)
      .setTintFill(this.tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
  }
}
