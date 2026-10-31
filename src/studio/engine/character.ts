// God of Legacy Studio — Character Studio's character: the game's own body (ActorView + Body: the same frames, the same
// look and clothes as layers, the same poses the game resolves), its size (never smaller on screen than the setting,
// whatever the zoom), its depth perspective, the layers shown, and the animation — the one the movement plays, or any
// one held in a loop to look at (speed, pause, a moment picked).
import Phaser from 'phaser';
import { ActorView } from '../../game/ActorView';
import { BaseLook, ClassKey, GearLook, loadBaseLook, preloadBodies, preloadLayeredBase, registerBodies, resolvePose } from '../../game/Body';
import { AnimSnap, poseQuery } from '../../game/PoseState';
import { kitFor } from '../../skills/FinalKit';
import type { FinalSkill } from '../../skills/SkillTypes';
import type { CharacterSettings, MovementSettings } from '../model/profile';
import type { Mover } from './mover';

/** The body texture a kind needs before it can be drawn (Body.ts's keys). */
const needKey = (s: CharacterSettings): string => (s.kind === 'layered' ? `naked-${s.gender}-idle` : s.kind === 'beginner' ? `hero-beginner_${s.gender}` : `hero-${s.cls}`);
const bodyCls = (s: CharacterSettings): ClassKey => (s.kind === 'hero' ? s.cls : 'warrior');
/** The class whose moves the character plays (the Beginner and the layered base: the warrior's sword). */
export const kitCls = (s: CharacterSettings): string => (s.kind === 'hero' ? s.cls : 'warrior');
export const kitOf = (s: CharacterSettings): FinalSkill[] => kitFor(kitCls(s));

export class CharacterRig {
  view: ActorView | null = null;
  private sig = '';
  private dressSig = '';
  private loading = '';
  /** The preview animation's own clock (ms × its speed). */
  private clock = 0;
  /** Drawn height on screen last frame (px) and the size it was drawn at. */
  screenPx = 0;
  drawnScale = 1;

  constructor(private scene: Phaser.Scene) {}

  get loadingWhat(): string { return this.loading; }

  /** The body the settings ask for: loaded if needed, then built (the old one stays until the new one is ready). */
  private ensure(s: CharacterSettings): void {
    const sig = `${s.kind}:${s.cls}:${s.gender}`;
    if (sig === this.sig && this.view) return;
    const sc = this.scene, key = needKey(s);
    if (!sc.textures.exists(key)) {
      if (this.loading === sig) return;
      this.loading = sig;
      if (s.kind === 'layered') preloadLayeredBase(sc, s.gender);
      else preloadBodies(sc, [s.kind === 'beginner' ? `beginner_${s.gender}` : s.cls], [], true);
      if (!sc.load.isLoading()) sc.load.start();
      return;
    }
    registerBodies(sc);
    this.loading = '';
    const old = this.view;
    let x = 0, y = 0;
    if (old) { x = old.sprite.x; y = old.sprite.y; old.destroy(); }
    this.view = new ActorView(sc, bodyCls(s), x, y);
    this.sig = sig; this.dressSig = '';
    this.view.setName(s.name);
  }

  /** Its look and clothes (the layered base), with the layers switched off left out. */
  private dress(s: CharacterSettings): void {
    const v = this.view; if (!v) return;
    const sig = JSON.stringify([s.kind, s.gender, s.look, s.gear, s.layers, s.name]);
    if (sig === this.dressSig) return;
    this.dressSig = sig;
    v.setName(s.name);
    if (s.kind !== 'layered') { v.setBaseLook(null, s.gender); v.setGear(null, s.gender); return; }
    const L = s.layers, l = s.look, g = s.gear;
    const look: BaseLook = { hair: L.hair ? l.hair : -1, hairColor: l.hairColor, skin: l.skin, face: L.face ? l.face : 0, eyeColor: L.face ? l.eyeColor : 0 };
    const suit = L.top && L.pants && g.suit ? g.suit : undefined, boots = L.shoes && g.boots ? g.boots : undefined;
    const gear: GearLook = {
      weapon: L.weapon && g.weapon, top: suit ? 0 : L.top ? g.top : -1, pants: suit ? 0 : L.pants ? g.pants : -1, shoes: boots ? 0 : L.shoes ? g.shoes : -1,
      ...(g.sword && L.weapon ? { sword: g.sword } : {}), ...(L.helm && g.helm ? { helm: g.helm } : {}), ...(suit ? { suit } : {}), ...(boots ? { boots } : {}),
    };
    loadBaseLook(this.scene, s.gender, look, true);
    v.setBaseLook(look, s.gender);
    v.setGear(gear, s.gender);   // (loads its strips itself)
  }

  /** The animation shown this frame: the movement's (live) or the one picked, looped on its own clock. */
  private snap(s: CharacterSettings, mv: Mover, m: MovementSettings, ms: number): AnimSnap {
    const a = s.anim, k = mv.k;
    if (a.mode === 'live') {
      const c = mv.cast;
      switch (mv.mode) {
        case 'walk': case 'run': return { mode: mv.mode, t: mv.loopT, speed: Math.hypot(k.vx, k.vy), vz: k.vz };
        case 'takeoff': return { mode: 'takeoff', t: mv.modeT, speed: 0, vz: k.vz };
        case 'air': return { mode: 'air', t: mv.modeT, speed: 0, vz: k.vz };
        case 'land': return { mode: 'land', t: mv.modeT, speed: 0, vz: 0 };
        case 'runstop': return { mode: 'runstop', t: mv.modeT, speed: 0, vz: 0, ms: 120 };
        case 'skill': if (c) return { mode: 'skill', t: c.elapsed, speed: 0, vz: k.vz, skill: { id: c.skill.id, stage: c.stage, elapsed: c.elapsed, startup: c.startup, active: c.active, recovery: c.recovery, seed: c.seed } };
          return { mode: 'idle', t: mv.loopT, speed: 0, vz: 0 };
        default: return { mode: 'idle', t: mv.loopT, speed: 0, vz: 0 };
      }
    }
    if (!a.paused) this.clock += ms * a.speed;
    const len = this.cycle(s, m);
    const t = a.paused ? a.time * len : this.clock % len;
    switch (a.mode) {
      case 'idle': case 'alert': case 'stunned': case 'win': return { mode: a.mode, t, speed: 0, vz: 0 };
      case 'intro': return { mode: 'intro', t, speed: 0, vz: 0, ms: len };
      case 'walk': return { mode: 'walk', t, speed: m.walk, vz: 0 };
      case 'run': return { mode: 'run', t, speed: m.run, vz: 0 };
      case 'jump': {
        if (t < 70) return { mode: 'takeoff', t, speed: 0, vz: m.jumpVz };
        const air = (2 * m.jumpVz / m.gravity) * 1000;
        if (t < 70 + air) { const ta = (t - 70) / 1000; return { mode: 'air', t: t - 70, speed: 0, vz: m.jumpVz - m.gravity * ta }; }
        return { mode: 'land', t: t - 70 - air, speed: 0, vz: 0 };
      }
      case 'land': return { mode: 'land', t: Math.min(t, 89), speed: 0, vz: 0 };
      case 'runstop': return { mode: 'runstop', t, speed: 0, vz: 0, ms: len };
      case 'hurt': return { mode: 'hurt', t, speed: 0, vz: 0, stunMs: len };
      case 'launched': return { mode: 'launched', t, speed: 0, vz: 420 - (t / len) * 840 };
      case 'down': case 'getup': return { mode: a.mode, t, speed: 0, vz: 0 };
      case 'attack': case 'skill': {
        const sk = this.previewSkill(s);
        if (!sk) return { mode: 'idle', t, speed: 0, vz: 0 };
        const tm = sk.chain?.timings?.[a.stage] ?? { startup: sk.startup, active: sk.active, recovery: sk.recovery };
        const total = tm.startup + tm.active + tm.recovery, e = Math.min(total, t);
        return { mode: 'skill', t: e, speed: 0, vz: 0, skill: { id: sk.id, stage: a.mode === 'attack' ? a.stage : 0, elapsed: e, ...tm, seed: a.stage } };
      }
    }
    return { mode: 'idle', t, speed: 0, vz: 0 };
  }

  /** The picked animation's length in one loop (ms; a move: its whole time and a breath after it). */
  cycle(s: CharacterSettings, m: MovementSettings): number {
    switch (s.anim.mode) {
      case 'jump': return 70 + (2 * m.jumpVz / m.gravity) * 1000 + 160;
      case 'walk': return 800;
      case 'run': return 615;
      case 'land': return 300;
      case 'runstop': return 400;
      case 'hurt': return 700;
      case 'launched': return 1000;
      case 'down': case 'getup': return 520;
      case 'intro': return 1500;
      case 'attack': case 'skill': {
        const sk = this.previewSkill(s); if (!sk) return 1000;
        const tm = sk.chain?.timings?.[s.anim.stage] ?? { startup: sk.startup, active: sk.active, recovery: sk.recovery };
        return tm.startup + tm.active + tm.recovery + 350;
      }
      default: return 2400;
    }
  }

  /** The skill whose moves are shown (attack: the class's basic chain; skill: the one picked). */
  previewSkill(s: CharacterSettings): FinalSkill | undefined {
    const kit = kitOf(s);
    if (s.anim.mode === 'attack') return kit.find((k) => k.slot === 0);
    return kit.find((k) => k.id === s.anim.skill) ?? kit.find((k) => k.slot > 0);
  }

  /** One frame of the character at the mover's place. */
  render(ms: number, s: CharacterSettings, mv: Mover, m: MovementSettings, camZoom: number, band: { back: number; front: number }, playing: boolean): void {
    this.ensure(s);
    const v = this.view; if (!v) return;
    this.dress(s);
    const q = (globalThis as { __studioPose?: ReturnType<typeof poseQuery> }).__studioPose ?? poseQuery(this.snap(s, mv, m, ms)); // (a test can hold any pose)
    const pose = s.kind === 'layered' ? resolvePose('warrior', mv.dir, q, true, s.gender, false, true)
      : s.kind === 'beginner' ? resolvePose('warrior', mv.dir, q, true, s.gender, false)
      : resolvePose(s.cls, mv.dir, q, false, undefined, true);
    // the size: the setting × the depth perspective, never under the smallest size on screen
    const k = mv.k, depth = s.perspective ? s.backScale + (s.frontScale - s.backScale) * Phaser.Math.Clamp((k.y - band.back) / Math.max(1, band.front - band.back), 0, 1) : 1;
    const bodyH = v.headHeight > 20 ? v.headHeight : 120;
    let scale = s.scale * depth;
    if (playing && bodyH * scale * camZoom < s.minScreenPx) scale = s.minScreenPx / (bodyH * camZoom);   // (editing: the true size, to judge the map by)
    v.presentScale = scale;
    v.render(ms, pose, k.x, k.y, k.z, k.supportZ, mv.dir);
    this.drawnScale = scale; this.screenPx = bodyH * scale * camZoom;
    // the layers switched off
    const L = s.layers;
    if (!L.body) v.sprite.setVisible(false);
    if (!L.shadow) v.shadow.setVisible(false);
    if (!L.ring) v.ring.setVisible(false);
    const named = v as unknown as { nameText?: Phaser.GameObjects.Text | null; nameFrame?: Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice | null };
    if (!L.name) { named.nameText?.setVisible(false); named.nameFrame?.setVisible(false); }
  }

  destroy(): void { this.view?.destroy(); this.view = null; this.sig = ''; }
}
