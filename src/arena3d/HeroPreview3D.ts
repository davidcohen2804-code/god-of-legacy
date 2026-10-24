// The 3D Beginner on a menu's pedestal (the character's creation, the character select): drawn by its own small
// three.js renderer into a canvas the scene shows as an image, standing in its idle, turning slowly to show itself,
// lit like a stage. (In a 3D place the hero is drawn by the place itself: Arena3D's layers, Hero3D.)
import Phaser from 'phaser';
import * as THREE from 'three';
import { Hero3D, type WeaponId } from './Hero3D';

export class HeroPreview3D {
  readonly image: Phaser.GameObjects.Image;
  private renderer: THREE.WebGLRenderer;
  private cam: THREE.PerspectiveCamera;
  private tex: Phaser.Textures.CanvasTexture;
  private t = 0;
  private dead = false;

  private constructor(private scene: Phaser.Scene, private hero: Hero3D, private key: string, private w: number, private h: number) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);
    // the stage's light: a warm key from the front left, a cool rim behind, the sky above
    const sc = hero.scene;
    sc.add(new THREE.HemisphereLight(0xfff4e6, 0x3a2c22, 1.25));
    const key0 = new THREE.DirectionalLight(0xffe2c0, 2.1); key0.position.set(-2.2, 3.2, 3.5); sc.add(key0);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 1.4); rim.position.set(2.5, 2.4, -3); sc.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(2, 1, 3); sc.add(fill);
    // framed head to boots with a little room (the hero is Hero3D.HEIGHT tall, its feet at the origin)
    const H = Hero3D.HEIGHT * 1.08;
    this.cam = new THREE.PerspectiveCamera(24, w / h, 0.1, 50);
    const dist = (H / 2) / Math.tan((24 / 2) * Math.PI / 180) * 1.02;
    this.cam.position.set(0, H * 0.52, dist); this.cam.lookAt(0, H * 0.5, 0);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.tex = scene.textures.createCanvas(key, w, h)!;
    this.image = scene.add.image(0, 0, key).setOrigin(0.5, 0.99); // (its feet: placed by the scene)
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.step, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** A preview of the Beginner (man or woman) with a weapon in hand, `w`×`h` px. */
  static async create(scene: Phaser.Scene, o: { female: boolean; weapon?: WeaponId; w?: number; h?: number; key?: string }): Promise<HeroPreview3D> {
    const hero = await Hero3D.load({ female: o.female });
    hero.flatToView = true; // (a sword's flat to the viewer, not its edge)
    if (o.weapon) hero.setWeapon(o.weapon);
    return new HeroPreview3D(scene, hero, o.key ?? 'hero-preview-3d', o.w ?? 420, o.h ?? 640);
  }

  /** Another weapon in hand. */
  setWeapon(w: WeaponId): void { this.hero.setWeapon(w); }

  private step(_t: number, ms: number): void {
    if (this.dead) return;
    this.t += ms;
    // standing in its idle, facing the viewer, a slow sway of the turn (never its back)
    this.hero.drive({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true, face: 1, yaw: 0.35 * Math.sin(this.t / 2600), mode: 'idle', cast: null }, ms);
    this.renderer.render(this.hero.scene, this.cam);
    const ctx = this.tex.getContext(); ctx.clearRect(0, 0, this.w, this.h); ctx.drawImage(this.renderer.domElement, 0, 0); this.tex.refresh();
  }

  destroy(): void {
    if (this.dead) return; this.dead = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.step, this);
    this.hero.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
    this.image.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}
