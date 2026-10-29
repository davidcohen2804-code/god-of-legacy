// God of Legacy Studio — the one source of truth the interface and the preview share: the profile being edited, the
// editor's state (mode, tool, selection, overlays), undo / redo, the draft kept on this device and the named saves.
import { StudioProfile, defaultProfile, sanitizeProfile } from './profile';

export type Mode = 'edit' | 'play';
export type Tool = 'select' | 'pan' | 'level' | 'platform' | 'oneway' | 'ramp' | 'spawn';
export interface ViewToggles { grid: boolean; collisions: boolean; cameraFrame: boolean; labels: boolean; geometry: boolean }
/** What the preview reports every few frames (the status bar, the panels' read-outs). */
export interface LiveInfo {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; grounded: boolean; support: string; state: string; facing: string;
  zoom: number; fps: number; camX: number; camY: number; charPx: number; loading: string;
}
export type Change =
  | { kind: 'profile'; path: string }
  | { kind: 'mode' | 'tool' | 'selection' | 'view' | 'live' | 'saved' | 'message' | 'history' | 'sim' };

const DRAFT_KEY = 'gol-studio-draft';
const SAVES_KEY = 'gol-studio-saves';
const HISTORY_MAX = 120;

export function getPath(o: unknown, path: string): unknown {
  let v = o as Record<string, unknown> | undefined;
  for (const k of path.split('.')) { if (!v || typeof v !== 'object') return undefined; v = v[k] as Record<string, unknown> | undefined; }
  return v;
}
function setPath(o: Record<string, unknown>, path: string, value: unknown): void {
  const ks = path.split('.');
  let v = o;
  for (let i = 0; i < ks.length - 1; i++) { if (typeof v[ks[i]] !== 'object' || v[ks[i]] === null) v[ks[i]] = {}; v = v[ks[i]] as Record<string, unknown>; }
  v[ks[ks.length - 1]] = value;
}

export class StudioStore {
  profile: StudioProfile;
  mode: Mode = 'play';
  tool: Tool = 'select';
  selection: string | null = null;
  view: ViewToggles = { grid: true, collisions: false, cameraFrame: false, labels: true, geometry: true };
  /** The simulation's pace (slow motion) and pause. */
  timeScale = 1;
  paused = false;
  live: LiveInfo = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true, support: '', state: 'idle', facing: 'right', zoom: 1, fps: 0, camX: 0, camY: 0, charPx: 0, loading: '' };
  message = '';
  /** The profile differs from the last save (named or file). */
  dirty = false;
  restoredDraft = false;
  private listeners = new Set<(c: Change) => void>();
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private committed: string;
  private draftTimer = 0;

  constructor() {
    let p = defaultProfile();
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) { p = sanitizeProfile(JSON.parse(raw)); this.restoredDraft = true; }
    } catch { /* no storage: the defaults */ }
    this.profile = p;
    this.committed = JSON.stringify(p);
  }

  on(fn: (c: Change) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(c: Change): void { for (const fn of [...this.listeners]) { try { fn(c); } catch (e) { console.error('[studio]', e); } } }

  get(path: string): unknown { return getPath(this.profile, path); }
  /** A profile value changed (live: sliders while dragging). Commit to make it one undo step. */
  set(path: string, value: unknown): void {
    if (getPath(this.profile, path) === value) return;
    setPath(this.profile as unknown as Record<string, unknown>, path, value);
    this.dirty = true;
    this.emit({ kind: 'profile', path });
    this.scheduleDraft();
  }
  /** Several values at once (a preset), one undo step. */
  setMany(values: Record<string, unknown>): void {
    for (const [p, v] of Object.entries(values)) setPath(this.profile as unknown as Record<string, unknown>, p, v);
    this.dirty = true;
    for (const p of Object.keys(values)) this.emit({ kind: 'profile', path: p });
    this.commit();
  }
  /** Changes the map in place (an edit in the preview); emit + commit by the caller's choice. */
  touchMap(commit = true): void {
    this.dirty = true;
    this.emit({ kind: 'profile', path: 'map' });
    if (commit) this.commit(); else this.scheduleDraft();
  }

  /** Ends an edit: what changed since the last commit becomes one undo step. */
  commit(): void {
    const now = JSON.stringify(this.profile);
    if (now === this.committed) return;
    this.undoStack.push(this.committed);
    if (this.undoStack.length > HISTORY_MAX) this.undoStack.shift();
    this.redoStack.length = 0;
    this.committed = now;
    this.emit({ kind: 'history' });
    this.saveDraft();
  }
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  undo(): void {
    this.commit();
    const prev = this.undoStack.pop(); if (!prev) return;
    this.redoStack.push(this.committed);
    this.load(prev);
  }
  redo(): void {
    const next = this.redoStack.pop(); if (!next) return;
    this.undoStack.push(this.committed);
    this.load(next);
  }
  private load(json: string): void {
    this.profile = sanitizeProfile(JSON.parse(json));
    this.committed = JSON.stringify(this.profile);
    if (this.selection && this.selection !== 'floor' && this.selection !== 'spawn' && !this.profile.map.objects.some((o) => o.id === this.selection)) this.selection = null;
    this.dirty = true;
    this.emit({ kind: 'profile', path: '' });
    this.emit({ kind: 'history' });
    this.emit({ kind: 'selection' });
    this.saveDraft();
  }
  /** A whole new profile (load, import, reset): one undo step back to the one before. */
  replace(p: StudioProfile, dirty = true): void {
    this.commit();
    this.undoStack.push(this.committed);
    this.redoStack.length = 0;
    this.profile = sanitizeProfile(JSON.parse(JSON.stringify(p)));
    this.committed = JSON.stringify(this.profile);
    this.selection = null;
    this.dirty = dirty;
    this.emit({ kind: 'profile', path: '' });
    this.emit({ kind: 'history' });
    this.emit({ kind: 'selection' });
    this.saveDraft();
  }

  setMode(m: Mode): void { if (m !== this.mode) { this.mode = m; this.emit({ kind: 'mode' }); } }
  setTool(t: Tool): void { if (t !== this.tool) { this.tool = t; this.emit({ kind: 'tool' }); } if (this.mode !== 'edit') this.setMode('edit'); }
  select(id: string | null): void { if (id !== this.selection) { this.selection = id; this.emit({ kind: 'selection' }); } }
  setView<K extends keyof ViewToggles>(k: K, v: ViewToggles[K]): void { this.view[k] = v; this.emit({ kind: 'view' }); }
  setSim(timeScale: number, paused: boolean): void { this.timeScale = timeScale; this.paused = paused; this.emit({ kind: 'sim' }); }
  say(msg: string): void { this.message = msg; this.emit({ kind: 'message' }); }

  // ---------------------------------------------------------------- the draft (kept on this device) and named saves
  private scheduleDraft(): void {
    clearTimeout(this.draftTimer);
    this.draftTimer = window.setTimeout(() => this.saveDraft(), 600);
  }
  private saveDraft(): void {
    clearTimeout(this.draftTimer);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(this.profile)); } catch { /* full or blocked: the session keeps it */ }
  }
  savedList(): { name: string; savedAt: string }[] {
    return Object.values(this.saves()).map((p) => ({ name: p.name, savedAt: p.savedAt })).sort((a, b) => (b.savedAt > a.savedAt ? 1 : -1));
  }
  private saves(): Record<string, StudioProfile> {
    try { const v = JSON.parse(localStorage.getItem(SAVES_KEY) ?? '{}') as unknown; return v && typeof v === 'object' ? v as Record<string, StudioProfile> : {}; } catch { return {}; }
  }
  /** Saves the profile under its name (or a new name) on this device. */
  saveNamed(name = this.profile.name): boolean {
    const n = name.trim().slice(0, 80) || 'ההגדרות שלי';
    this.profile.name = n;
    this.profile.savedAt = new Date().toISOString();
    const all = this.saves(); all[n] = JSON.parse(JSON.stringify(this.profile)) as StudioProfile;
    try { localStorage.setItem(SAVES_KEY, JSON.stringify(all)); } catch { this.say('השמירה נכשלה: אין מקום בדפדפן'); return false; }
    this.commit();
    this.dirty = false;
    this.emit({ kind: 'profile', path: 'name' });
    this.emit({ kind: 'saved' });
    this.saveDraft();
    return true;
  }
  loadNamed(name: string): boolean {
    const p = this.saves()[name]; if (!p) return false;
    this.replace(p, false);
    this.emit({ kind: 'saved' });
    return true;
  }
  deleteNamed(name: string): void {
    const all = this.saves(); delete all[name];
    try { localStorage.setItem(SAVES_KEY, JSON.stringify(all)); } catch { /* blocked */ }
    this.emit({ kind: 'saved' });
  }
  /** The profile as a file's text. */
  toJSON(): string { return JSON.stringify({ ...this.profile, savedAt: new Date().toISOString() }, null, 2); }
  /** A profile from a file's text: null when it is not one. */
  fromJSON(text: string): boolean {
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return false; }
    if (!raw || typeof raw !== 'object') return false;
    this.replace(sanitizeProfile(raw));
    return true;
  }
  markSaved(): void { this.dirty = false; this.emit({ kind: 'saved' }); }
}
