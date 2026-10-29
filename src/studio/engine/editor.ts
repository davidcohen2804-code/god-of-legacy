// God of Legacy Studio — Depth Editor in the preview: pick and drag. Levels, platforms, one-way platforms and ramps are
// drawn on the floor (drag a rectangle), moved by their top, sized by the handles on their edges and raised by the
// height handle (a ramp: one at each end); the floor's and a prop's corners are dragged (+ on an edge adds one, Alt-click
// takes one away); the start mark is dragged too. The camera while editing is free: drag with the right / middle button
// (or the hand, or Space held), the wheel zooms where the pointer is.
import Phaser from 'phaser';
import type { Pt } from '../../world/WorldGeometry';
import type { ObjKind, StudioObject } from '../model/profile';
import { newObjectId } from '../model/profile';
import type { StudioStore, Tool } from '../model/store';
import { SLAB, centroid, footprint, frontY, inPoly, silhouette, topFace } from './geometry';

type HandleId = 'w0' | 'w1' | 'd0' | 'd1' | 'z' | 'z0' | 'z1' | `v${number}` | `m${number}`;
interface Handle { id: HandleId; x: number; y: number; kind: 'edge' | 'height' | 'vertex' | 'insert' }
type Hit = { kind: 'handle'; target: string; h: Handle } | { kind: 'object'; id: string } | { kind: 'spawn' } | { kind: 'floor' };
interface Drag {
  what: 'move' | 'handle' | 'spawn' | 'create' | 'pan';
  target?: string; h?: Handle;
  sx: number; sy: number;          // pointer start (world)
  px: number; py: number;          // pointer start (screen)
  orig?: StudioObject; origPts?: Pt[]; origSpawn?: { x: number; y: number };
  camX?: number; camY?: number;
  kind?: ObjKind; cx?: number; cy?: number;
  moved: boolean;
}
const CREATE_Z: Record<string, number> = { level: 120, platform: 60, oneway: 180, ramp: 100 };
const NAMES: Record<string, string> = { level: 'מפלס', platform: 'פלטפורמה', oneway: 'צפה', ramp: 'רמפה' };

export class Editor {
  readonly g: Phaser.GameObjects.Graphics;
  private drag: Drag | null = null;
  private hover: Hit | null = null;
  private space = false;
  /** The free camera while editing (its middle, its zoom). */
  cam = { x: 0, y: 0, zoom: 1 };

  constructor(private scene: Phaser.Scene, private store: StudioStore) {
    this.g = scene.add.graphics().setDepth(2_000_000);
    const inp = scene.input;
    inp.mouse?.disableContextMenu();
    inp.on('pointerdown', (p: Phaser.Input.Pointer) => this.down(p));
    inp.on('pointermove', (p: Phaser.Input.Pointer) => this.move(p));
    inp.on('pointerup', (p: Phaser.Input.Pointer) => this.up(p));
    inp.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.up(p));
    inp.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.wheel(p, dy));
    window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !isTyping()) this.space = true; });
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') this.space = false; });
  }

  private get map() { return this.store.profile.map; }
  private get editing(): boolean { return this.store.mode === 'edit'; }
  private snap(v: number): number { const m = this.map; return m.snap ? Math.round(v / m.grid) * m.grid : Math.round(v); }
  private snapZ(v: number): number { return this.map.snap ? Math.round(v / 5) * 5 : Math.round(v); }
  private obj(id: string | undefined): StudioObject | undefined { return this.map.objects.find((o) => o.id === id); }
  private world(p: Phaser.Input.Pointer): { x: number; y: number } { const w = this.scene.cameras.main.getWorldPoint(p.x, p.y); return { x: w.x, y: w.y }; }
  private get hs(): number { return 7 / this.scene.cameras.main.zoom; }

  /** The free camera starts where the view is. */
  takeOver(): void { const c = this.scene.cameras.main; this.cam = { x: c.midPoint.x, y: c.midPoint.y, zoom: c.zoom }; }
  applyCamera(): void {
    const c = this.scene.cameras.main;
    c.setRotation(0); c.setZoom(this.cam.zoom); c.centerOn(this.cam.x, this.cam.y);
  }
  /** Frames a rectangle of the world (the whole map, or the character). */
  frame(x: number, y: number, w: number, h: number): void {
    const c = this.scene.cameras.main;
    this.cam.zoom = Phaser.Math.Clamp(Math.min(c.width / Math.max(1, w), c.height / Math.max(1, h)) * 0.92, 0.15, 4);
    this.cam.x = x + w / 2; this.cam.y = y + h / 2;
  }

  // ---------------------------------------------------------------- handles and picking
  handlesOf(id: string): Handle[] {
    if (id === 'floor') return this.polyHandles(this.map.floor);
    const o = this.obj(id); if (!o) return [];
    if (o.kind === 'prop') {
      const hs = this.polyHandles(o.poly ?? []);
      const [cx, cy] = centroid(o.poly ?? []), top = o.top ?? o.h ?? 0;
      hs.push({ id: 'z', x: cx, y: cy - top - 28 / this.scene.cameras.main.zoom, kind: 'height' });
      return hs;
    }
    const zl = o.kind === 'ramp' ? (o.axis === 'x' ? o.z0 : (o.z0 + o.z1) / 2) : o.z, zr = o.kind === 'ramp' ? (o.axis === 'x' ? o.z1 : (o.z0 + o.z1) / 2) : o.z;
    const zb = o.kind === 'ramp' ? (o.axis === 'y' ? o.z0 : (o.z0 + o.z1) / 2) : o.z, zf = o.kind === 'ramp' ? (o.axis === 'y' ? o.z1 : (o.z0 + o.z1) / 2) : o.z;
    const zm = (zl + zr) / 2, up = 30 / this.scene.cameras.main.zoom;
    const hs: Handle[] = [
      { id: 'w0', x: o.x, y: o.y + o.d / 2 - zl, kind: 'edge' }, { id: 'w1', x: o.x + o.w, y: o.y + o.d / 2 - zr, kind: 'edge' },
      { id: 'd0', x: o.x + o.w / 2, y: o.y - zb, kind: 'edge' }, { id: 'd1', x: o.x + o.w / 2, y: o.y + o.d - zf, kind: 'edge' },
    ];
    if (o.kind === 'ramp') {
      if (o.axis === 'x') hs.push({ id: 'z0', x: o.x + 14 / this.scene.cameras.main.zoom, y: o.y + o.d / 2 - o.z0 - up, kind: 'height' }, { id: 'z1', x: o.x + o.w - 14 / this.scene.cameras.main.zoom, y: o.y + o.d / 2 - o.z1 - up, kind: 'height' });
      else hs.push({ id: 'z0', x: o.x + o.w / 2, y: o.y - o.z0 - up, kind: 'height' }, { id: 'z1', x: o.x + o.w / 2 + 30 / this.scene.cameras.main.zoom, y: o.y + o.d - o.z1 - up, kind: 'height' });
    } else hs.push({ id: 'z', x: o.x + o.w / 2, y: o.y + o.d / 2 - zm - up, kind: 'height' });
    return hs;
  }
  private polyHandles(pts: Pt[]): Handle[] {
    const hs: Handle[] = pts.map((p, i) => ({ id: `v${i}` as HandleId, x: p[0], y: p[1], kind: 'vertex' as const }));
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; hs.push({ id: `m${i}`, x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, kind: 'insert' }); });
    return hs;
  }

  private pick(x: number, y: number): Hit | null {
    const sel = this.store.selection, r = this.hs * 1.6;
    if (sel && sel !== 'spawn') for (const h of this.handlesOf(sel)) if (Math.hypot(h.x - x, h.y - y) <= r) return { kind: 'handle', target: sel, h };
    const sp = this.map.spawn, zoom = this.scene.cameras.main.zoom;
    if (Math.hypot(sp.x - x, (sp.y - y) * 2) < 30 / zoom || (Math.abs(sp.x + 8 / zoom - x) < 14 / zoom && y < sp.y && y > sp.y - 50 / zoom)) return { kind: 'spawn' };
    const painted = this.map.backdrop.kind === 'stage';
    const objs = this.map.objects.filter((o) => !o.hidden).sort((a, b) => frontY(b) - frontY(a));
    for (const o of objs) {
      const area = painted && o.kind === 'prop' ? [...footprint(o)] : silhouette(o);
      if (inPoly(x, y, area) || (painted && o.kind === 'prop' && o.top !== null && o.top !== undefined && inPoly(x, y, footprint(o).map(([px, py]) => [px, py - (o.top ?? 0)] as Pt)))) return { kind: 'object', id: o.id };
    }
    if (inPoly(x, y, this.map.floor)) return { kind: 'floor' };
    return null;
  }

  // ---------------------------------------------------------------- the pointer
  private down(p: Phaser.Input.Pointer): void {
    if (!this.editing) return;
    const w = this.world(p);
    const panBtn = p.rightButtonDown() || p.middleButtonDown() || this.space || this.store.tool === 'pan';
    if (panBtn) { this.drag = { what: 'pan', sx: w.x, sy: w.y, px: p.x, py: p.y, camX: this.cam.x, camY: this.cam.y, moved: false }; return; }
    const tool: Tool = this.store.tool;
    if (tool === 'spawn') {
      this.map.spawn = { x: this.snap(w.x), y: this.snap(w.y) }; this.store.select('spawn'); this.store.touchMap(true);
      this.store.setTool('select'); return;
    }
    if (tool === 'level' || tool === 'platform' || tool === 'oneway' || tool === 'ramp') {
      this.drag = { what: 'create', kind: tool, sx: this.snap(w.x), sy: this.snap(w.y), cx: this.snap(w.x), cy: this.snap(w.y), px: p.x, py: p.y, moved: false }; return;
    }
    const hit = this.pick(w.x, w.y);
    if (!hit) { this.store.select(null); return; }
    if (hit.kind === 'handle') {
      const t = hit.target, h = hit.h;
      const pts = t === 'floor' ? this.map.floor : this.obj(t)?.poly;
      if (h.kind === 'vertex' && p.event && (p.event as MouseEvent).altKey && pts && pts.length > 3) { // Alt-click: a corner taken away
        pts.splice(Number(h.id.slice(1)), 1); this.store.touchMap(true); return;
      }
      if (h.kind === 'insert' && pts) { // + on an edge: a new corner there, dragged at once
        const i = Number(h.id.slice(1)) + 1;
        pts.splice(i, 0, [Math.round(h.x), Math.round(h.y)]);
        this.drag = { what: 'handle', target: t, h: { id: `v${i}`, x: h.x, y: h.y, kind: 'vertex' }, sx: w.x, sy: w.y, px: p.x, py: p.y, origPts: pts.map((q) => [q[0], q[1]] as Pt), orig: clone(this.obj(t)), moved: true };
        this.store.touchMap(false); return;
      }
      this.drag = { what: 'handle', target: t, h, sx: w.x, sy: w.y, px: p.x, py: p.y, orig: clone(this.obj(t)), origPts: pts?.map((q) => [q[0], q[1]] as Pt), moved: false };
      return;
    }
    if (hit.kind === 'spawn') { this.store.select('spawn'); this.drag = { what: 'spawn', sx: w.x, sy: w.y, px: p.x, py: p.y, origSpawn: { ...this.map.spawn }, moved: false }; return; }
    if (hit.kind === 'floor') { this.store.select('floor'); return; }
    this.store.select(hit.id);
    const o = this.obj(hit.id);
    this.drag = { what: 'move', target: hit.id, sx: w.x, sy: w.y, px: p.x, py: p.y, orig: clone(o), origPts: o?.poly?.map((q) => [q[0], q[1]] as Pt), moved: false };
  }

  private move(p: Phaser.Input.Pointer): void {
    if (!this.editing) { this.hover = null; return; }
    const w = this.world(p), d = this.drag;
    if (!d) { this.hover = this.pick(w.x, w.y); this.scene.game.canvas.style.cursor = this.cursorFor(this.hover); return; }
    if (Math.hypot(p.x - d.px, p.y - d.py) > 2) d.moved = true;
    if (!d.moved) return;
    const dx = w.x - d.sx, dy = w.y - d.sy;
    if (d.what === 'pan') { const z = this.cam.zoom; this.cam.x = (d.camX ?? 0) - (p.x - d.px) / z; this.cam.y = (d.camY ?? 0) - (p.y - d.py) / z; return; }
    if (d.what === 'create') { d.cx = this.snap(w.x); d.cy = this.snap(w.y); return; }
    if (d.what === 'spawn' && d.origSpawn) { this.map.spawn = { x: this.snap(d.origSpawn.x + dx), y: this.snap(d.origSpawn.y + dy) }; this.store.touchMap(false); return; }
    const o = this.obj(d.target), a = d.orig;
    if (d.what === 'move' && o && a) {
      if (o.kind === 'prop' && d.origPts) { const sx = this.snap(dx), sy = this.snap(dy); o.poly = d.origPts.map(([x, y]) => [x + sx, y + sy] as Pt); const xs = o.poly.map((q) => q[0]), ys = o.poly.map((q) => q[1]); o.x = Math.min(...xs); o.y = Math.min(...ys); }
      else { o.x = this.snap(a.x + dx); o.y = this.snap(a.y + dy); }
      this.store.touchMap(false); return;
    }
    if (d.what === 'handle' && d.h) {
      const id = d.h.id;
      if (id.startsWith('v')) {
        const i = Number(id.slice(1)), pts = d.target === 'floor' ? this.map.floor : o?.poly, orig = d.origPts;
        if (pts && orig && orig[i]) { pts[i] = [this.snap(orig[i][0] + dx), this.snap(orig[i][1] + dy)]; if (o && o.poly) { const xs = o.poly.map((q) => q[0]), ys = o.poly.map((q) => q[1]); o.x = Math.min(...xs); o.y = Math.min(...ys); o.w = Math.max(...xs) - o.x; o.d = Math.max(...ys) - o.y; } this.store.touchMap(false); }
        return;
      }
      if (!o || !a) return;
      const MIN = 10;
      if (id === 'w0') { const x = Math.min(this.snap(a.x + dx), a.x + a.w - MIN); o.w = a.w - (x - a.x); o.x = x; }
      else if (id === 'w1') o.w = Math.max(MIN, this.snap(a.x + a.w + dx) - a.x);
      else if (id === 'd0') { const y = Math.min(this.snap(a.y + dy), a.y + a.d - MIN); o.d = a.d - (y - a.y); o.y = y; }
      else if (id === 'd1') o.d = Math.max(MIN, this.snap(a.y + a.d + dy) - a.y);
      else if (id === 'z') {
        if (o.kind === 'prop') { if (o.top !== null && o.top !== undefined) { o.top = Math.max(0, this.snapZ((a.top ?? 0) - dy)); o.h = Math.max(o.h ?? 0, o.top); } else o.h = Math.max(0, this.snapZ((a.h ?? 0) - dy)); }
        else o.z = Math.max(o.kind === 'oneway' ? SLAB + 6 : 0, this.snapZ(a.z - dy));
      }
      else if (id === 'z0') o.z0 = Math.max(0, this.snapZ(a.z0 - dy));
      else if (id === 'z1') o.z1 = Math.max(0, this.snapZ(a.z1 - dy));
      this.store.touchMap(false);
    }
  }

  private up(_p: Phaser.Input.Pointer): void {
    const d = this.drag; this.drag = null;
    if (!d || !this.editing) return;
    if (d.what === 'create' && d.kind) {
      let x = Math.min(d.sx, d.cx ?? d.sx), y = Math.min(d.sy, d.cy ?? d.sy), w = Math.abs((d.cx ?? d.sx) - d.sx), dd = Math.abs((d.cy ?? d.sy) - d.sy);
      if (w < 20 || dd < 10) { w = d.kind === 'level' ? 400 : d.kind === 'ramp' ? 240 : d.kind === 'oneway' ? 200 : 120; dd = d.kind === 'level' ? 160 : d.kind === 'oneway' ? 60 : 90; x = d.sx - w / 2; y = d.sy - dd / 2; }
      const m = this.map, id = newObjectId(m), z = CREATE_Z[d.kind] ?? 60;
      const n = m.objects.filter((o) => o.kind === d.kind).length + 1;
      m.objects.push({ id, name: `${NAMES[d.kind]} ${n}`, kind: d.kind, x: this.snap(x), y: this.snap(y), w: Math.max(10, this.snap(w)), d: Math.max(10, this.snap(dd)), z, axis: 'x', z0: 0, z1: z });
      this.store.select(id);
      this.store.touchMap(true);
      this.store.setTool('select');
      return;
    }
    if (d.what !== 'pan' && d.moved) this.store.commit();
  }

  private wheel(p: Phaser.Input.Pointer, dy: number): void {
    const f = dy > 0 ? 1 / 1.12 : 1.12;
    if (this.editing) { // zoom where the pointer is
      const c = this.scene.cameras.main, before = c.getWorldPoint(p.x, p.y);
      this.cam.zoom = Phaser.Math.Clamp(this.cam.zoom * f, 0.12, 5);
      this.applyCamera();
      const after = c.getWorldPoint(p.x, p.y);
      this.cam.x += before.x - after.x; this.cam.y += before.y - after.y;
      this.applyCamera();
      return;
    }
    // playing: the wheel is Camera Studio's zoom
    const z = Phaser.Math.Clamp(Math.round(this.store.profile.camera.zoom * f * 100) / 100, 0.3, 3);
    this.store.set('camera.zoom', z);
    clearTimeout(this.wheelCommit); this.wheelCommit = window.setTimeout(() => this.store.commit(), 500);
  }
  private wheelCommit = 0;

  private cursorFor(h: Hit | null): string {
    const t = this.store.tool;
    if (this.space || t === 'pan') return 'grab';
    if (t !== 'select') return 'crosshair';
    if (!h) return 'default';
    if (h.kind === 'handle') return h.h.kind === 'height' ? 'ns-resize' : h.h.kind === 'edge' ? (h.h.id.startsWith('w') ? 'ew-resize' : 'ns-resize') : h.h.kind === 'insert' ? 'copy' : 'move';
    return h.kind === 'floor' ? 'pointer' : 'move';
  }

  // ---------------------------------------------------------------- editing from the keyboard / the panels
  deleteSelection(): void {
    const s = this.store.selection; if (!s || s === 'floor' || s === 'spawn') return;
    const m = this.map, i = m.objects.findIndex((o) => o.id === s); if (i < 0) return;
    m.objects.splice(i, 1); this.store.select(null); this.store.touchMap(true);
  }
  duplicate(): void {
    const o = this.obj(this.store.selection ?? undefined); if (!o) return;
    const m = this.map, c = clone(o)!, off = Math.max(20, m.grid * 2);
    c.id = newObjectId(m); c.name = `${o.name} copy`; c.x += off; c.y += off;
    if (c.poly) c.poly = c.poly.map(([x, y]) => [x + off, y + off] as Pt);
    m.objects.push(c); this.store.select(c.id); this.store.touchMap(true);
  }
  nudge(dx: number, dy: number): void {
    const s = this.store.selection, m = this.map;
    if (s === 'spawn') { m.spawn = { x: m.spawn.x + dx, y: m.spawn.y + dy }; this.store.touchMap(true); return; }
    const o = this.obj(s ?? undefined); if (!o) return;
    o.x += dx; o.y += dy; if (o.poly) o.poly = o.poly.map(([x, y]) => [x + dx, y + dy] as Pt);
    this.store.touchMap(true);
  }

  // ---------------------------------------------------------------- the overlay (every frame)
  draw(info: { foot?: { x: number; y: number; z: number; r: number }; cam?: { x: number; y: number; deadW: number; deadH: number; leash: number; lookX: number; lookY: number } }): void {
    const g = this.g, z = this.scene.cameras.main.zoom, lw = 1.5 / z, edit = this.editing, v = this.store.view, m = this.map;
    g.clear();
    const P = (p: Pt) => new Phaser.Geom.Point(p[0], p[1]);
    if (v.collisions) { // what the movement collides with: every footprint on the floor, every top
      g.lineStyle(lw, 0x58e1ff, 0.9).strokePoints(m.floor.map(P), true);
      for (const o of m.objects) {
        if (o.hidden) continue;
        g.lineStyle(lw, 0xff7a59, 0.85).strokePoints(footprint(o).map(P), true);
        if (o.kind !== 'prop' || (o.top !== null && o.top !== undefined)) g.lineStyle(lw, 0x58e1ff, 0.85).strokePoints(topFace(o).map(P), true);
      }
      if (info.foot) { const f = info.foot; g.lineStyle(lw, 0xffffff, 1).strokeCircle(f.x, f.y, f.r).lineBetween(f.x, f.y, f.x, f.y - f.z); g.fillStyle(0xffffff, 1).fillCircle(f.x, f.y - f.z, 2.5 / z); }
    }
    if (v.cameraFrame && info.cam && !edit) { // Camera Studio's frame: the dead zone, the distance, the look point
      const c = info.cam;
      g.lineStyle(lw, 0xffd36a, 0.9).strokeRect(c.x - c.deadW / 2, c.y - c.deadH / 2, c.deadW, c.deadH);
      g.lineStyle(lw, 0xffd36a, 0.35).strokeRect(c.x - c.leash, c.y - c.leash, c.leash * 2, c.leash * 2);
      g.lineStyle(lw * 1.4, 0xff5f6d, 1).lineBetween(c.lookX - 9 / z, c.lookY, c.lookX + 9 / z, c.lookY).lineBetween(c.lookX, c.lookY - 9 / z, c.lookX, c.lookY + 9 / z);
    }
    if (!edit) return;
    // the floor's edge, the hovered and the selected objects, the handles, a rectangle being drawn
    if (v.geometry) g.lineStyle(lw, 0x9fb6d8, 0.55).strokePoints(m.floor.map(P), true);
    const sel = this.store.selection, hov = this.hover?.kind === 'object' ? this.hover.id : null;
    for (const o of m.objects) {
      if (o.hidden || (o.id !== sel && o.id !== hov)) continue;
      const area = o.kind === 'prop' && m.backdrop.kind === 'stage' ? footprint(o) : silhouette(o);
      g.lineStyle(o.id === sel ? 2.5 / z : lw, o.id === sel ? 0xffc94d : 0xffffff, o.id === sel ? 1 : 0.6).strokePoints(area.map(P), true);
    }
    if (sel === 'floor') g.lineStyle(2.5 / z, 0xffc94d, 1).strokePoints(m.floor.map(P), true);
    if (sel && sel !== 'spawn') for (const h of this.handlesOf(sel)) {
      const r = this.hs * (h.kind === 'insert' ? 0.7 : 1);
      if (h.kind === 'height') {
        g.fillStyle(0x1b2230, 1).fillCircle(h.x, h.y, r * 1.35).lineStyle(2 / z, 0x8fe3ff, 1).strokeCircle(h.x, h.y, r * 1.35);
        g.lineStyle(2 / z, 0x8fe3ff, 1).lineBetween(h.x, h.y - r * 0.8, h.x, h.y + r * 0.8);
        g.fillStyle(0x8fe3ff, 1).fillTriangle(h.x - r * 0.45, h.y - r * 0.45, h.x + r * 0.45, h.y - r * 0.45, h.x, h.y - r * 0.95).fillTriangle(h.x - r * 0.45, h.y + r * 0.45, h.x + r * 0.45, h.y + r * 0.45, h.x, h.y + r * 0.95);
      } else if (h.kind === 'insert') {
        g.fillStyle(0x1b2230, 0.9).fillCircle(h.x, h.y, r).lineStyle(1.5 / z, 0xffc94d, 0.9).strokeCircle(h.x, h.y, r);
        g.lineStyle(1.5 / z, 0xffc94d, 1).lineBetween(h.x - r * 0.5, h.y, h.x + r * 0.5, h.y).lineBetween(h.x, h.y - r * 0.5, h.x, h.y + r * 0.5);
      } else g.fillStyle(0xffc94d, 1).fillRect(h.x - r, h.y - r, r * 2, r * 2).lineStyle(1.5 / z, 0x1b2230, 1).strokeRect(h.x - r, h.y - r, r * 2, r * 2);
    }
    if (sel === 'spawn') { const s = m.spawn; g.lineStyle(2.5 / z, 0xffc94d, 1).strokeEllipse(s.x, s.y, 64, 26); }
    const d = this.drag;
    if (d?.what === 'create' && d.moved) {
      const x = Math.min(d.sx, d.cx ?? d.sx), y = Math.min(d.sy, d.cy ?? d.sy), w = Math.abs((d.cx ?? d.sx) - d.sx), h = Math.abs((d.cy ?? d.sy) - d.sy);
      g.fillStyle(0xffc94d, 0.15).fillRect(x, y, w, h).lineStyle(2 / z, 0xffc94d, 1).strokeRect(x, y, w, h);
    }
  }
}

const clone = <T>(o: T): T => (o === undefined ? o : JSON.parse(JSON.stringify(o)) as T);
export const isTyping = (): boolean => {
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
};
