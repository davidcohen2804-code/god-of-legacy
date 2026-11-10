// LEGACY OF SPIRITS — the Spectral Samurai in a window (GPT, 9 Nov, step 4B: "the inventory must show the actual Samurai
// 3D preview … no wall / scene leaking into the preview"): his real body and spirit finish drawn by a small three.js
// renderer of its own into a canvas laid in the window's stage, only while the window is open (the window's update drives
// it); the window's own controls (the animation, the turn, rotate) move him as they moved the old 2D preview.
import * as THREE from 'three';
import { Hero3D } from '../arena3d/Hero3D';
import { SPIRIT_BODY, SPIRIT_BODY_NS, SPIRITS } from './flag';
import { makeSpiritFinish } from './SpiritBody';
import { makeSpiritForm } from './SpiritForm';
import { spiritLights } from './SpiritPreview';

/** What the window's preview is doing (its own state machine: idle, walk, run, the jump's beats, the basic attack's
 *  stages, a hit, the fall). */
export interface StagePose {
  mode: string; speed: number; vz: number; z: number; dir: string;
  skill?: { id: string; stage: number; elapsed: number; startup: number; active: number; recovery: number };
}

export class SpiritStage {
  /** Drawn at this many times its size in design px (sharp at 1920×1080, a little supersampled smaller). */
  static readonly RES = 1.5;
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private cam = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  private yaw = 0.5;
  private dead = false;

  private constructor(private hero: Hero3D, w: number, h: number) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: SPIRITS.ns, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); this.renderer.setSize(Math.round(w * SpiritStage.RES), Math.round(h * SpiritStage.RES), false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    Object.assign(this.canvas.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', borderRadius: 'inherit' });
    spiritLights(hero.scene);
    // his whole body, room over the head for the jump, the feet low (where the old preview stood him)
    const H = Hero3D.HEIGHT * 1.46, c = H * 0.38, d = (H / 2) / Math.tan((24 / 2) * Math.PI / 180);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    this.cam.position.set(0, c + 0.06, d); this.cam.lookAt(0, c, 0);
  }

  /** The Spectral Samurai, the spirit blade in hand, for a `w`×`h` (design px) stage, his light at `level`'s tier. */
  static async create(w: number, h: number, level = 1): Promise<SpiritStage> {
    const hero = await Hero3D.load({ female: false, body: SPIRITS.ns ? SPIRIT_BODY_NS : SPIRIT_BODY });
    if (SPIRITS.ns) await (await import('./Spectral')).makeSpectral(hero, { level: SPIRITS.lv ?? level, lit: 0.3, ground: () => 0 }); // (&ns: the new Spectral Samurai)
    else if (SPIRITS.ghost) makeSpiritForm(hero, { level: SPIRITS.lv ?? level, lit: 0.1, ground: () => 0 }); else makeSpiritFinish(hero);
    hero.flatToView = true; // (the blade's flat to the viewer, not its edge)
    hero.setWeapon('katana');
    return new SpiritStage(hero, w, h);
  }

  /** One frame: his move as the window's preview calls it, turned three quarters to his side (a turn eases round). */
  drive(p: StagePose, ms: number): void {
    if (this.dead) return;
    const want = p.dir === 'left' ? -0.5 : 0.5;
    this.yaw += (want - this.yaw) * Math.min(1, ms / 260);
    this.hero.drive({
      x: 0, y: 0, z: p.z * 0.3, vx: p.speed, vy: 0, vz: p.vz, grounded: p.z <= 0, face: p.dir === 'left' ? -1 : 1, yaw: this.yaw,
      mode: p.mode === 'recover' ? 'alert' : p.mode, cast: p.skill ? { ...p.skill, dash: false, air: false } : null,
    }, ms);
    this.renderer.render(this.hero.scene, this.cam);
  }

  dispose(): void {
    if (this.dead) return; this.dead = true;
    this.canvas.remove(); this.hero.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
