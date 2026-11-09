// LEGACY OF SPIRITS — the Spectral Samurai on a menu screen (the character select; GPT, 9 Nov: "use the actual 3D
// Spectral Samurai for the primary character preview, not merely a beautiful painted picture that misrepresents the
// model"): his real body and spirit finish (SpiritBody) drawn by a small three.js renderer straight into a Phaser
// texture (a GPU copy each frame, as the world's stage does), standing in his idle with a slow sway; moonlight from the
// front left, a violet rim behind, a little warm lantern light from the right. Also his portrait (head and shoulders),
// drawn once, and its dark silhouette (the sealed heroes in the list).
import Phaser from 'phaser';
import * as THREE from 'three';
import { Hero3D } from '../arena3d/Hero3D';
import { SPIRIT_BODY } from './flag';
import { makeSpiritFinish } from './SpiritBody';

/** The menus' night light on him: the moon from the front left, a violet rim behind him, the lanterns' warmth low from
 *  the right, and a soft frontal fill at face height (GPT, 9 Nov: the face read too dark — keep its silhouette and the
 *  eyes' glow, never a human, lit face). */
export function spiritLights(sc: THREE.Scene): void {
  sc.add(new THREE.HemisphereLight(0x8f8ad0, 0x1a1026, 0.9));
  const moon = new THREE.DirectionalLight(0xdcdcff, 1.9); moon.position.set(-2.4, 3.4, 3.2); sc.add(moon);
  const rim = new THREE.DirectionalLight(0x9a6bff, 2.4); rim.position.set(1.8, 2.2, -3.2); sc.add(rim);
  const rim2 = new THREE.DirectionalLight(0x9a6bff, 1.2); rim2.position.set(-2.2, 1.6, -2.6); sc.add(rim2);
  const warm = new THREE.DirectionalLight(0xffb070, 0.35); warm.position.set(3, 0.8, 1.5); sc.add(warm);
  const face = new THREE.DirectionalLight(0xd6d0ff, 0.55); face.position.set(0.3, 1.6, 4); face.target.position.set(0, 1.4, 0); sc.add(face, face.target);
}

export class SpiritPreview {
  /** Drawn at this many times its size on screen (the menus show him large: the face and the hair stay sharp). */
  static readonly RES = 2;
  readonly image: Phaser.GameObjects.Image;
  private renderer: THREE.WebGLRenderer;
  private cam = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  private t = 0;
  private dead = false;
  private frame = Hero3D.HEIGHT * 1.08;

  private constructor(private scene: Phaser.Scene, private hero: Hero3D, private key: string, private w: number, private h: number) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); this.renderer.setSize(w * SpiritPreview.RES, h * SpiritPreview.RES, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x000000, 0);
    spiritLights(hero.scene);
    this.cam.aspect = w / h; this.frameTo(this.frame);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addImage(key, this.renderer.domElement as unknown as HTMLImageElement);
    this.image = scene.add.image(0, 0, key).setOrigin(0.5, 0.97).setScale(1 / SpiritPreview.RES); // (his feet: placed by the screen)
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.step, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** The Spectral Samurai, katana in hand, `w`×`h` design px. */
  static async create(scene: Phaser.Scene, o: { w?: number; h?: number; key?: string } = {}): Promise<SpiritPreview> {
    const hero = await Hero3D.load({ female: false, body: SPIRIT_BODY });
    makeSpiritFinish(hero);
    hero.flatToView = true; // (the blade's flat to the viewer, not its edge)
    hero.setWeapon('katana');
    return new SpiritPreview(scene, hero, o.key ?? 'spirit-preview', o.w ?? 520, o.h ?? 760);
  }

  private frameTo(H: number): void {
    const dist = (H / 2) / Math.tan((24 / 2) * Math.PI / 180) * 1.02;
    this.cam.position.set(0, H * 0.52, dist); this.cam.lookAt(0, H * 0.5, 0);
  }

  private pose(ms: number, yaw = 0.3 * Math.sin(this.t / 2800)): void {
    // standing in his idle, facing the viewer, a slow sway of the turn (never his back)
    this.hero.drive({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true, face: 1, yaw, mode: 'idle', cast: null }, ms);
  }

  private step(_t: number, ms: number): void {
    if (this.dead) return;
    this.t += ms;
    this.pose(ms);
    const want = Math.max(Hero3D.HEIGHT * 1.08, this.hero.topY() * 1.04);
    if (Math.abs(want - this.frame) > 1e-3) { this.frame += (want - this.frame) * Math.min(1, ms / 250); this.frameTo(this.frame); }
    this.renderer.render(this.hero.scene, this.cam);
    this.scene.textures.get(this.key).source[0].update(); // (a GPU copy of his picture)
  }

  /** His head and shoulders, `size` px square (round, as the list's portraits): drawn once into a canvas texture, and
   *  its dark silhouette beside it (`${key}-dark`). */
  portrait(key: string, size: number): void {
    const R = this.renderer, S = Math.round(size * SpiritPreview.RES);
    this.pose(16, 0.28); // (a little turned: three quarters)
    // framed on his head (its bone; the hair rises over it), down to the shoulders
    this.hero.root.updateMatrixWorld(true);
    const head = (this.hero as unknown as { bones: Map<string, THREE.Bone> }).bones.get('Head');
    const hy = head ? head.getWorldPosition(new THREE.Vector3()).y : Hero3D.HEIGHT * 0.9;
    const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 50), span = 0.54, cy = hy + 0.09, d = (span / 2) / Math.tan((22 / 2) * Math.PI / 180);
    cam.position.set(0.04, cy + 0.04, d); cam.lookAt(0, cy, 0);
    R.setSize(S, S, false); R.render(this.hero.scene, cam);
    const draw = (k: string, dark: boolean) => {
      if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
      const t = this.scene.textures.createCanvas(k, S, S)!, x = t.getContext();
      x.save(); x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); x.clip();
      x.drawImage(R.domElement, 0, 0, S, S);
      if (dark) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#0b0817'; x.fillRect(0, 0, S, S); }
      x.restore(); t.refresh();
    };
    draw(key, false); draw(`${key}-dark`, true);
    R.setSize(this.w * SpiritPreview.RES, this.h * SpiritPreview.RES, false);
  }

  destroy(): void {
    if (this.dead) return; this.dead = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.step, this);
    this.hero.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
    this.image.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}
