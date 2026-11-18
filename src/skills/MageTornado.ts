/** The Book Mage's Tempest Trio (slot T, `elemental_ascension`): where each of its three tornadoes is, `t` ms after the
 *  cast's release, round the field's centre `c` — the same path for the scene's hits and the room's pictures. Each rises
 *  320 px out at its own side (0°, 120°, 240°), drifts in slowly to the field's ring over 3 s, then wanders round it
 *  (each at its own radius and pace, the ring breathing in and out) until the 10 s are up. */
export const TRIO = { n: 3, ms: 10000, inMs: 3000, far: 320, near: 120 };
export function trioAt(c: { x: number; y: number }, k: number, t: number): { x: number; y: number } {
  const a0 = (k * Math.PI * 2) / TRIO.n + Math.PI / 2, u = Math.max(0, Math.min(1, t / TRIO.inMs)), e = u * u * (3 - 2 * u);
  const w = 0.55 + 0.12 * k, r = TRIO.far + (TRIO.near + 40 * Math.sin(t / 1300 + k * 2.1) - TRIO.far) * e;
  const a = a0 + (t / 1000) * w * (k % 2 ? -1 : 1) * e;
  return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.45 };
}
