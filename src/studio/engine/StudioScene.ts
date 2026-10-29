// God of Legacy Studio — Live Preview: the Phaser scene in the middle of the Studio. The map, the character, the
// movement and the camera run here on the game's own systems; every setting the panels change reaches it at once.
// Play: the keys move the character (the game's keys) and the camera follows by Camera Studio. Edit: the character
// stands, the camera is free and the map is edited with the mouse (Depth Editor).
import Phaser from 'phaser';
import { CombatInput } from '../../game/CombatInput';
import { preloadCosmetics } from '../../game/ActorView';
import { registerBodies } from '../../game/Body';
import { PHYS } from '../../combat/Combat';
import { pushOutOfBlockers } from '../../world/WorldGeometry';
import type { Change, StudioStore } from '../model/store';
import { CameraRig } from './cameraRig';
import { CharacterRig, kitOf } from './character';
import { Editor, isTyping } from './editor';
import { compileMap, floorBand } from './geometry';
import { MapView } from './mapView';
import { Mover, applyMovement } from './mover';

export class StudioScene extends Phaser.Scene {
  store!: StudioStore;
  private mapView!: MapView;
  private rig!: CharacterRig;
  mover!: Mover;
  private camRig = new CameraRig();
  editor!: Editor;
  private keys: CombatInput | null = null;
  private mapDirty = true;
  private visualsDirty = true;
  private liveAt = 0;
  private fpsAvg = 60;
  private unsub: (() => void) | null = null;

  constructor() { super({ key: 'StudioScene' }); }

  init(data: { store: StudioStore }): void { this.store = data.store; }

  preload(): void {
    preloadCosmetics(this, []); // (the floor shadow under the character)
  }

  create(): void {
    const st = this.store;
    this.cameras.main.setRoundPixels(false);
    this.load.on(Phaser.Loader.Events.COMPLETE, () => registerBodies(this));
    this.mapView = new MapView(this);
    this.rig = new CharacterRig(this);
    applyMovement(st.profile.movement);
    compileMap(st.profile.map, st.profile.movement);
    this.mover = new Mover(st.profile.map.spawn.x, st.profile.map.spawn.y, st.profile.character.facing);
    this.editor = new Editor(this, st);
    this.keys = new CombatInput(this, (slot) => this.onSlot(slot), () => this.keys?.queueJump(), () => undefined);
    this.unsub = st.on((c) => this.onChange(c));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.unsub?.(); this.keys?.destroy(); });
    // typing in a panel: the game's keys let go of the keyboard (and take it back after)
    const kb = this.input.keyboard!;
    const typing = () => { if (isTyping()) { kb.enabled = false; kb.disableGlobalCapture(); kb.resetKeys(); this.keys?.reset(); } };
    const back = () => { setTimeout(() => { if (!isTyping()) { kb.enabled = true; kb.enableGlobalCapture(); } }, 0); };
    document.addEventListener('focusin', typing); document.addEventListener('focusout', back);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { document.removeEventListener('focusin', typing); document.removeEventListener('focusout', back); });
    this.frameMap();
    this.camRig.snap(this.cameras.main, st.profile.camera, this.camTarget(), st.profile.map);
    (window as unknown as { __studioScene: StudioScene }).__studioScene = this;
  }

  /** The attack key plays the basic chain's next step; a skill key that skill's moves (the body only). */
  private onSlot(slot: number): void {
    if (this.store.mode !== 'play' || this.store.paused) return;
    const kit = kitOf(this.store.profile.character);
    if (slot === 0) { this.mover.attack(kit.find((s) => s.slot === 0)); return; }
    const sk = kit.find((s) => s.slot === slot);
    if (sk && !this.mover.cast) this.mover.startCast(sk);
  }

  private onChange(c: Change): void {
    const p = this.store.profile;
    if (c.kind === 'profile') {
      const path = c.path;
      if (path === '' || path.startsWith('movement')) { applyMovement(p.movement); this.mapDirty = true; }
      if (path === '' || path.startsWith('map')) this.mapDirty = true;
      if (path === '' || path === 'character.facing') this.mover.dir = p.character.facing;
      if (path === '') this.mover.place(p.map.spawn.x, p.map.spawn.y, p.character.facing);
      if (path === 'map.backdrop.stage' || path === 'map.backdrop.kind') this.frameMap();
    }
    if (c.kind === 'mode') {
      this.keys?.reset();
      if (this.store.mode === 'edit') this.editor.takeOver(); else this.camRig.takeOver(this.cameras.main);
      this.visualsDirty = true;
    }
    if (c.kind === 'view' || c.kind === 'selection') this.visualsDirty = true;
  }

  /** The start mark: the character back there. */
  respawn(): void { const s = this.store.profile.map.spawn; this.mover.place(s.x, s.y, this.store.profile.character.facing); this.camRig.snap(this.cameras.main, this.store.profile.camera, this.camTarget(), this.store.profile.map); }
  /** The free camera framed on the whole map / on the character. */
  frameMap(): void { const m = this.store.profile.map; this.editor?.frame(0, 0, m.w, m.h); }
  frameCharacter(): void { const k = this.mover.k; this.editor.frame(k.x - 260, k.y - k.z - 260, 520, 360); if (this.store.mode !== 'edit') this.store.setMode('edit'); }
  /** The character placed where the start mark is set from (Character Studio's position). */
  moveCharacter(x: number, y: number): void { this.mover.place(x, y); }

  private camTarget() {
    const k = this.mover.k, mv = this.store.profile.movement, sp = Math.hypot(k.vx, k.vy);
    return { x: k.x, y: k.y, z: k.z, supportZ: k.supportZ, facing: (this.mover.dir === 'left' ? -1 : 1) as 1 | -1, run: Math.max(0, Math.min(1, (sp - mv.walk) / Math.max(1, mv.run - mv.walk))) };
  }

  /** The last frame's time (real ms): the simulation follows real time even when frames come slowly (a slow machine), in
   *  steps of at most 1/30 s (the game's own movement code is made for small steps). */
  private lastT = 0;
  update(time: number, delta: number): void {
    const st = this.store, p = st.profile, playing = st.mode === 'play';
    const real = Math.min(250, this.lastT ? Math.max(0, time - this.lastT) : delta); this.lastT = time;
    const ms = st.paused ? 0 : real * st.timeScale;
    if (this.mapDirty) {
      this.mapDirty = false; this.visualsDirty = true;
      compileMap(p.map, p.movement);
      this.mover.check(p.map.spawn);
      pushOutOfBlockers(this.mover.k, PHYS.footR);
    }
    if (this.visualsDirty) {
      this.visualsDirty = false;
      this.mapView.build(p.map, { grid: st.view.grid, labels: st.view.labels, geometry: st.view.geometry, edit: !playing, selected: st.selection }, () => { this.visualsDirty = true; this.frameMap(); });
    }
    const keys = playing && !isTyping() ? this.keys : null, n = Math.max(1, Math.ceil(ms / 33));
    for (let i = 0; i < n; i++) this.mover.step(ms / n, keys, p.movement);
    const cam = this.cameras.main;
    if (playing) this.camRig.step(cam, p.camera, this.camTarget(), real, p.map);
    else this.editor.applyCamera();
    this.rig.render(ms, p.character, this.mover, p.movement, cam.zoom, floorBand(p.map), playing);
    this.mapView.screenScale(1 / cam.zoom);
    const k = this.mover.k, f = this.camRig.frame;
    this.editor.draw({ foot: { x: k.x, y: k.y, z: k.z, r: PHYS.footR }, cam: { x: this.camRig.x, y: this.camRig.y, deadW: f.deadW, deadH: f.deadH, leash: f.leash, lookX: f.lookX, lookY: f.lookY } });
    // what the status bar shows (a few times a second)
    this.fpsAvg += ((1000 / Math.max(1, delta)) - this.fpsAvg) * 0.1;
    this.liveAt += real;
    if (this.liveAt >= 120) {
      this.liveAt = 0;
      Object.assign(st.live, {
        x: Math.round(k.x), y: Math.round(k.y), z: Math.round(k.z), vx: Math.round(k.vx), vy: Math.round(k.vy), vz: Math.round(k.vz), grounded: k.grounded,
        support: k.supportId ? k.supportId.replace(/^st-/, '') : '', state: this.mover.mode, facing: this.mover.dir,
        zoom: Math.round(cam.zoom * 100) / 100, fps: Math.round(this.fpsAvg), camX: Math.round(cam.midPoint.x), camY: Math.round(cam.midPoint.y),
        charPx: Math.round(this.rig.screenPx), loading: this.rig.loadingWhat || (this.mapView.waiting ? 'map' : ''),
      });
      st.emit({ kind: 'live' });
    }
  }
}
