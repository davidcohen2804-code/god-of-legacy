// God of Legacy Studio — the map as the preview draws it. An existing map: its painting, and each prop's outline cut
// from it drawn again at the prop's front edge (whoever walks behind the prop is hidden by it, as in the arena). The
// Studio's own map: a floor slab with its grid, and every level, platform, one-way platform and ramp as a solid seen
// in this view (top and front faces), each drawn at its front edge's depth so the character walks behind and in front
// of it exactly as the game sorts bodies (actorDepth).
import Phaser from 'phaser';
import type { Pt } from '../../world/WorldGeometry';
import { ARENA_VIEW } from '../../world/WorldGeometry';
import type { ObjKind, StudioMap, StudioObject } from '../model/profile';
import { STAGE_CHOICES } from '../model/profile';
import { centroid, corners, footprint, frontY, silhouette, topFace } from './geometry';

interface Palette { top: number; front: number; side: number; line: number }
const PAL: Record<ObjKind, Palette> = {
  level: { top: 0x7c89a2, front: 0x465066, side: 0x394254, line: 0xd8e1f2 },
  platform: { top: 0xb08f62, front: 0x70573a, side: 0x5c472f, line: 0xf3dcb8 },
  oneway: { top: 0x86c9cf, front: 0x3f8088, side: 0x356d74, line: 0xe2fbff },
  ramp: { top: 0x96a3ba, front: 0x535e74, side: 0x454f62, line: 0xe4ebf8 },
  prop: { top: 0x8f8b7c, front: 0x5e5b4f, side: 0x4d4a40, line: 0xeae4cf },
};
export const KIND_COLOR: Record<ObjKind, string> = { level: '#7c89a2', platform: '#b08f62', oneway: '#86c9cf', ramp: '#96a3ba', prop: '#8f8b7c' };
const FLOOR = { fill: 0x2a3241, grid: 0x3b475b, back: 0x7f8ea9, lip: 0x1b212c, lipH: 46 };

export const stageTextureKey = (id: string): string | null => STAGE_CHOICES.find((s) => s.id === id)?.key ?? null;

export class MapView {
  private parts: Phaser.GameObjects.GameObject[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private spawnMark: Phaser.GameObjects.Container | null = null;
  /** The painting's texture is on its way (rebuilt when it lands). */
  waiting = false;

  constructor(private scene: Phaser.Scene) {}

  /** Builds the whole map (after any change to it). */
  build(map: StudioMap, opts: { grid: boolean; labels: boolean; geometry: boolean; edit: boolean; selected: string | null }, onReady: () => void): void {
    this.clear();
    const sc = this.scene, stage = map.backdrop.kind === 'stage' ? STAGE_CHOICES.find((s) => s.id === map.backdrop.stage) : undefined;
    if (stage && !sc.textures.exists(stage.key)) {
      this.waiting = true;
      sc.load.image(stage.key, stage.file);
      sc.load.once(`filecomplete-image-${stage.key}`, () => { this.waiting = false; onReady(); });
      if (!sc.load.isLoading()) sc.load.start();
    }
    const painted = !!stage && sc.textures.exists(stage.key);
    if (painted) this.buildPainting(map, stage!.key);
    else this.buildFloor(map, opts.grid);
    for (const [i, o] of map.objects.entries()) {
      if (o.hidden) continue;
      if (painted && o.kind === 'prop') { if (opts.geometry && opts.edit) this.outline(o, i); continue; }   // the painting draws it
      this.solid(o, i);
    }
    // the names and heights: the Studio's own objects; an existing map's props (often many, close together) when picked
    if (opts.labels && opts.edit) for (const o of map.objects) if (!o.hidden && (o.kind !== 'prop' || o.id === opts.selected)) this.label(o, o.id === opts.selected);
    this.spawnMarker(map, opts.edit);
  }

  private add<T extends Phaser.GameObjects.GameObject>(o: T): T { this.parts.push(o); return o; }

  // ---------------------------------------------------------------- an existing map's painting
  private buildPainting(map: StudioMap, key: string): void {
    const sc = this.scene, s = ARENA_VIEW.scale;
    this.add(sc.add.image(0, 0, key).setOrigin(0, 0).setScale(s).setDepth(-10).setAlpha(map.backdrop.opacity));
    for (const o of map.objects) {
      if (o.hidden || o.kind !== 'prop' || !o.occ || o.occ.length < 3) continue;
      const g = sc.make.graphics({}, false);
      g.fillStyle(0xffffff).fillPoints(o.occ.map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
      this.add(g);
      this.add(sc.add.image(0, 0, key).setOrigin(0, 0).setScale(s).setDepth(frontY(o)).setAlpha(map.backdrop.opacity).setMask(g.createGeometryMask()));
    }
  }

  // ---------------------------------------------------------------- the Studio's own floor
  private buildFloor(map: StudioMap, grid: boolean): void {
    const sc = this.scene, poly = map.floor, P = (p: Pt) => new Phaser.Geom.Point(p[0], p[1]);
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const g = this.add(sc.add.graphics().setDepth(-6));
    // the slab's front side under the floor's front edges (the floor reads as a thick stage, not a sheet): lit at its
    // top, into the dark below
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (Math.abs(b[0] - a[0]) < 1) continue;
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 2];
      if (pointIn(mid, poly)) continue; // (a back edge: the floor lies below it)
      g.fillStyle(FLOOR.lip, 1).fillPoints([P(a), P(b), P([b[0], b[1] + FLOOR.lipH]), P([a[0], a[1] + FLOOR.lipH])], true);
      if (Math.abs(b[1] - a[1]) < 1) g.fillGradientStyle(0x3a465c, 0x3a465c, FLOOR.lip, FLOOR.lip, 1, 1, 0, 0).fillRect(Math.min(a[0], b[0]), a[1], Math.abs(b[0] - a[0]), FLOOR.lipH);
    }
    g.fillStyle(FLOOR.fill, 1).fillPoints(poly.map(P), true);
    const m = sc.make.graphics({}, false); m.fillStyle(0xffffff).fillPoints(poly.map(P), true); this.add(m);
    const gg = this.add(sc.add.graphics().setDepth(-5.9)).setMask(m.createGeometryMask());
    // light from the back of the floor toward its front edge (the far floor paler, as under a sky)
    gg.fillGradientStyle(0x5a6b88, 0x5a6b88, 0x10151f, 0x10151f, 0.35, 0.35, 0.3, 0.3).fillRect(x0, y0, x1 - x0, y1 - y0);
    if (grid) {
      const step = Math.max(20, map.grid * 2);
      gg.lineStyle(1, FLOOR.grid, 0.7);
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) gg.lineBetween(x, y0, x, y1);
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) gg.lineBetween(x0, y, x1, y);
    }
    const e = this.add(sc.add.graphics().setDepth(-5.8));
    e.lineStyle(2, FLOOR.back, 0.55).strokePoints(poly.map(P), true);
  }

  // ---------------------------------------------------------------- a solid (top + sides, back to front)
  private solid(o: StudioObject, i: number): void {
    const sc = this.scene, pal = PAL[o.kind], c = corners(o), P = (x: number, y: number) => new Phaser.Geom.Point(x, y);
    const g = this.add(sc.add.graphics().setDepth(frontY(o) + i * 0.0001));
    const box = o.kind !== 'ramp' && o.kind !== 'prop';   // (an upright box: its faces are rectangles)
    const sh = this.add(sc.add.graphics().setDepth(-4));
    if (o.kind === 'oneway') sh.fillStyle(0x000000, 0.24).fillPoints(footprint(o).map(([x, y]) => P(x, y)), true);   // its shadow on the floor far below
    else if (box) sh.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.4, 0.4, 0, 0).fillRect(o.x - 4, o.y + o.d, o.w + 8, 18);   // where it meets the floor
    const [cx, cy] = centroid(c.map((p) => [p.x, p.y] as Pt));
    const sides = c.map((a, k) => ({ a, b: c[(k + 1) % c.length] })).filter(({ a, b }) => Math.abs(b.x - a.x) > 0.5)
      .sort((s1, s2) => (s1.a.y + s1.b.y) - (s2.a.y + s2.b.y));
    for (const { a, b } of sides) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ny = my - cy, nx = mx - cx, front = ny > Math.abs(nx) * 0.2;
      if (front && box && Math.abs(a.y - b.y) < 0.5 && a.top === b.top) { // a front face: lit under its top edge, darker toward the floor
        const fx = Math.min(a.x, b.x), fy = a.y - a.top, fh = a.top - a.base;
        g.fillGradientStyle(pal.front, pal.front, pal.side, pal.side, 1, 1, 1, 1).fillRect(fx, fy, Math.abs(b.x - a.x), fh);
        g.fillStyle(0xffffff, 0.08).fillRect(fx, fy, Math.abs(b.x - a.x), Math.min(6, fh));
      } else g.fillStyle(front ? pal.front : pal.side, 1).fillPoints([P(a.x, a.y - a.top), P(b.x, b.y - b.top), P(b.x, b.y - b.base), P(a.x, a.y - a.base)], true);
      if (front) g.lineStyle(1.5, 0x000000, 0.4).lineBetween(a.x, a.y - a.base, b.x, b.y - b.base);
    }
    const top = topFace(o).map(([x, y]) => P(x, y));
    if (box) g.fillGradientStyle(lighten(pal.top, 0.12), lighten(pal.top, 0.12), pal.top, pal.top, 1, 1, 1, 1).fillRect(o.x, o.y - o.z, o.w, o.d);
    else g.fillStyle(pal.top, 1).fillPoints(top, true);
    // the top's texture: courses of stone / planks / the ramp's treads
    g.lineStyle(1, 0x000000, 0.13);
    if (o.kind === 'ramp') {
      const n = Math.max(2, Math.round((o.axis === 'x' ? o.w : o.d) / 24));
      for (let k = 1; k < n; k++) {
        const t = k / n;
        if (o.axis === 'x') { const x = o.x + o.w * t, z = o.z0 + (o.z1 - o.z0) * t; g.lineBetween(x, o.y - z, x, o.y + o.d - z); }
        else { const y = o.y + o.d * t, z = o.z0 + (o.z1 - o.z0) * t; g.lineBetween(o.x, y - z, o.x + o.w, y - z); }
      }
    } else if (o.kind !== 'prop') {
      const step = o.kind === 'platform' ? 26 : 40;
      for (let x = o.x + step; x < o.x + o.w - 4; x += step) g.lineBetween(x, o.y - o.z, x, o.y + o.d - o.z);
    }
    g.lineStyle(1.5, pal.line, 0.35).strokePoints(top, true);
    // the top's front edge catches the light
    const fr = c.filter((p) => Math.abs(p.y - Math.max(...c.map((q) => q.y))) < 0.5);
    if (fr.length === 2) g.lineStyle(2, pal.line, 0.75).lineBetween(fr[0].x, fr[0].y - fr[0].top, fr[1].x, fr[1].y - fr[1].top);
  }

  /** An existing map's prop over its painting: only its outline (editing). */
  private outline(o: StudioObject, i: number): void {
    const sc = this.scene, g = this.add(sc.add.graphics().setDepth(900000 + i * 0.001)), P = (x: number, y: number) => new Phaser.Geom.Point(x, y);
    const f = footprint(o);
    g.fillStyle(0xffc85a, 0.12).fillPoints(f.map(([x, y]) => P(x, y)), true).lineStyle(1.5, 0xffc85a, 0.7).strokePoints(f.map(([x, y]) => P(x, y)), true);
    if (o.top !== null && o.top !== undefined) g.lineStyle(1.5, 0x8fe3ff, 0.8).strokePoints(f.map(([x, y]) => P(x, y - (o.top ?? 0))), true);
  }

  /** Its name and height on it (the selected one: under it, clear of its handles). */
  private label(o: StudioObject, selected = false): void {
    let [x, y] = centroid(topFace(o));
    if (selected) { x = centroid(footprint(o))[0]; y = Math.max(...silhouette(o).map((p) => p[1])); }
    const z = o.kind === 'ramp' ? `${Math.round(o.z0)}→${Math.round(o.z1)}` : o.kind === 'prop' ? (o.top !== null && o.top !== undefined ? `${Math.round(o.top)}` : `h ${Math.round(o.h ?? 0)}`) : `${Math.round(o.z)}`;
    // a Hebrew name reads from the right: the name on the right, its height on the left (kept in one piece)
    const he = /[\u0590-\u05FF]/.test(o.name), line = he ? `\u2066${z}\u2069  ·  ${o.name}` : `${o.name}  ·  ${z}`;
    const txt = this.scene.add.text(x, y, line, { fontFamily: 'Inter, Arial, sans-serif', fontSize: '12px', fontStyle: '600', color: '#ffffff', backgroundColor: 'rgba(12,16,24,0.62)', padding: { x: 6, y: 3 }, resolution: 2 })
      .setOrigin(0.5, selected ? -0.45 : 0.5).setDepth(950000);
    this.labels.push(txt); this.parts.push(txt);
  }

  private spawnMarker(map: StudioMap, edit: boolean): void {
    const sc = this.scene, { x, y } = map.spawn;
    const g = sc.add.graphics();
    g.fillStyle(0x000000, 0.25).fillEllipse(0, 0, 54, 20);
    g.lineStyle(2, 0x6fe08a, 0.95).strokeEllipse(0, 0, 54, 20);
    g.lineStyle(2, 0x6fe08a, 0.95).lineBetween(0, 0, 0, -46);
    g.fillStyle(0x6fe08a, 1).fillTriangle(0, -46, 22, -38, 0, -30);
    const t = sc.add.text(-34, 0, 'התחלה', { fontFamily: 'Inter, Arial, sans-serif', fontSize: '12px', fontStyle: '700', color: '#6fe08a', resolution: 2 }).setOrigin(1, 0.5);
    this.spawnMark = sc.add.container(x, y, [g, t]).setDepth(940000).setVisible(edit);
    this.parts.push(this.spawnMark);
  }

  /** The labels and the start mark keep their size on screen whatever the zoom. */
  screenScale(k: number): void {
    for (const t of this.labels) t.setScale(k);
    this.spawnMark?.setScale(k);
  }

  clear(): void {
    for (const p of this.parts) p.destroy();
    this.parts = []; this.labels = []; this.spawnMark = null;
  }
}

/** A colour a share of the way to white. */
function lighten(c: number, k: number): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, f = (v: number) => Math.round(v + (255 - v) * k);
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

function pointIn(p: Pt, poly: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
