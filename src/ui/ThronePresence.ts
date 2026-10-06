// Character Select / Create: the warrior seated on his throne with the sword of light planted beside him.
// One painted image (GPT) brought to life in render only:
//  - breathing (chest / face) and cape wind (cloth only) via displacement maps baked by tools/hero/throne_maps.py
//  - painted VFX sheets (GPT, on black, additive; tools/hero/fx_sheet.py): a holy aura around the blade, animated
//    electricity crawling on it with bursts, an electric discharge into the dais at the tip, rising light particles
//    and star glints on the pommel / crossguard
//  - the rune ring of the dais breathing with the blade
import Phaser from 'phaser';

const DIR = 'assets/final/heroes/warrior';
/** Painting geometry in source pixels (1024x1536). */
const SRC = { w: 1024, h: 1536, baseV: 1398 / 1536 } as const;
const BLADE = { pommel: [138, 515], top: [138, 690], tip: [124, 1426] } as const;
/** Dais painting (1894x564): the throne's front base line sits at this row of the top surface. */
const DAIS = { w: 1894, h: 564, seatV: 270 / 564, widthPerK: 1508 } as const;
/** VFX sheet frames (see tools/hero/fx_sheet.py output). */
const FX = {
  electric: { w: 256, h: 619, n: 8 },
  discharge: { w: 533, h: 349, n: 8, ox: 264 / 533, oy: 215 / 349 },
  particles: { w: 308, h: 296 },
  aura: { w: 484, h: 2490 },
} as const;
const P_STAR = 1, P_SPARK = 2, P_ORB = 4, P_SPARKLE = 5, P_DUST = 7;

export function preloadThrone(scene: Phaser.Scene): void {
  const I = (k: string, f: string) => { if (!scene.textures.exists(k)) scene.load.image(k, `${DIR}/${f}.png`); };
  const S = (k: string, f: string, w: number, h: number) => { if (!scene.textures.exists(k)) scene.load.spritesheet(k, `${DIR}/${f}.png`, { frameWidth: w, frameHeight: h }); };
  I('throne.hero', 'throne'); I('throne.breath', 'throne_breath'); I('throne.wind_a', 'throne_wind_a'); I('throne.wind_b', 'throne_wind_b');
  I('throne.dais', 'dais'); I('throne.dais_runes', 'dais_runes'); I('throne.fx_aura', 'fx_aura');
  S('throne.fx_electric', 'fx_electric', FX.electric.w, FX.electric.h);
  S('throne.fx_discharge', 'fx_discharge', FX.discharge.w, FX.discharge.h);
  S('throne.fx_particles', 'fx_particles', FX.particles.w, FX.particles.h);
}

function softTex(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const c = scene.textures.createCanvas(key, 128, 128)!, ctx = c.getContext();
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  c.refresh();
}

const ADD = Phaser.BlendModes.ADD;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class ThroneHero {
  readonly root: Phaser.GameObjects.Container;
  private img: Phaser.GameObjects.Image;
  private runes?: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private aura2: Phaser.GameObjects.Image;
  private elec: Phaser.GameObjects.Image;
  private dis: Phaser.GameObjects.Image;
  private tipGlow: Phaser.GameObjects.Image;
  private glints: Phaser.GameObjects.Image[] = [];
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private breath?: Phaser.FX.Displacement;
  private windA?: Phaser.FX.Displacement;
  private windB?: Phaser.FX.Displacement;
  private readonly k: number;
  private readonly eScale: number;
  private readonly aScale: number;
  /** Side of the square preFX render target (displacement uv spans it). */
  private fxSide = 1;
  private t = 0;
  private elecT = 0;
  private elecFrame = 0;
  private burst = 0;
  private nextBurst = 1600;
  private disT = -1;
  private glintT: number[] = [];

  /** `base` = screen point where the throne's front base meets the dais; `height` = throne height on screen. */
  constructor(private scene: Phaser.Scene, base: { x: number; y: number }, height: number, depth = 2) {
    this.k = height / (SRC.h * SRC.baseV - 10);
    const k = this.k;
    softTex(scene, 'throne.soft');
    this.root = scene.add.container(0, 0).setDepth(depth);

    // Dais (painted) + its rune ring as an additive layer that pulses; contact shadow under the throne.
    const ds = (DAIS.widthPerK * k) / DAIS.w;
    this.root.add(scene.add.image(base.x, base.y, 'throne.dais').setOrigin(0.5, DAIS.seatV).setScale(ds));
    if (scene.textures.exists('throne.dais_runes')) {
      this.runes = scene.add.image(base.x, base.y, 'throne.dais_runes').setOrigin(0.5, DAIS.seatV).setScale(ds).setBlendMode(ADD);
      this.root.add(this.runes);
    }
    this.root.add(scene.add.ellipse(base.x + 10 * k, base.y - 18 * k, 980 * k, 120 * k, 0x000000, 0.45));

    // The painting with breathing + cloth wind (R channel of each map drives the displacement).
    this.img = scene.add.image(base.x, base.y, 'throne.hero').setOrigin(0.5, SRC.baseV).setScale(k);
    this.root.add(this.img);
    const fx = this.img.preFX;
    if (fx) {
      fx.padding = 6;
      this.breath = fx.addDisplacement(this.fxMap('throne.breath'), 0, 0);
      this.windA = fx.addDisplacement(this.fxMap('throne.wind_a'), 0, 0);
      this.windB = fx.addDisplacement(this.fxMap('throne.wind_b'), 0, 0);
    }

    // Blade frame of reference.
    const top = this.at(BLADE.top[0], BLADE.top[1]), tip = this.at(BLADE.tip[0], BLADE.tip[1]);
    const len = Math.hypot(tip.x - top.x, tip.y - top.y);
    const ang = Math.atan2(tip.y - top.y, tip.x - top.x) - Math.PI / 2;
    const mid = { x: (top.x + tip.x) / 2, y: (top.y + tip.y) / 2 };

    // Holy aura (two copies, mirrored, breathing out of phase so the flame shape keeps changing).
    this.aScale = (len * 1.12) / FX.aura.h;
    this.aura = scene.add.image(mid.x, mid.y, 'throne.fx_aura').setBlendMode(ADD).setRotation(ang).setScale(this.aScale);
    this.aura2 = scene.add.image(mid.x, mid.y, 'throne.fx_aura').setBlendMode(ADD).setRotation(ang).setScale(this.aScale).setFlipX(true);

    // Electricity crawling on the blade.
    this.eScale = (len * 1.04) / FX.electric.h;
    this.elec = scene.add.image(mid.x, mid.y, 'throne.fx_electric', 0).setBlendMode(ADD).setRotation(ang).setScale(this.eScale);

    // Tip glow + discharge into the dais at the tip.
    this.tipGlow = scene.add.image(tip.x, tip.y - 6 * k, 'throne.soft').setTint(0xbfe8ff).setBlendMode(ADD).setDisplaySize(170 * k, 60 * k);
    this.dis = scene.add.image(tip.x, tip.y - 4 * k, 'throne.fx_discharge', 0).setOrigin(FX.discharge.ox, FX.discharge.oy)
      .setBlendMode(ADD).setVisible(false);

    // Light rising off the blade: star glints, small sparks, soft orbs (painted particles).
    this.motes = scene.add.particles(0, 0, 'throne.fx_particles', {
      frame: [P_STAR, P_SPARK, P_ORB, P_SPARKLE, P_ORB],
      emitZone: { type: 'random', source: new Phaser.Geom.Line(top.x, top.y + 30 * k, tip.x, tip.y - 40 * k), quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 1800, max: 3400 }, speedY: { min: -26, max: -10 }, speedX: { min: -7, max: 7 },
      scale: { start: 0.11, end: 0.03 }, alpha: { values: [0, 1, 0.8, 0] }, rotate: { min: -20, max: 20 },
      frequency: 190, blendMode: ADD,
    });
    // Gold dust kicked up by the discharge.
    this.dust = scene.add.particles(0, 0, 'throne.fx_particles', {
      frame: P_DUST, lifespan: { min: 700, max: 1200 }, speed: { min: 20, max: 70 }, angle: { min: 200, max: 340 },
      scale: { start: 0.18, end: 0.32 }, alpha: { start: 0.55, end: 0 }, blendMode: ADD, emitting: false,
    });

    // Star glints on the pommel and the crossguard tips.
    for (const p of [BLADE.pommel, [72, 662], [206, 668]] as const) {
      const at = this.at(p[0], p[1]);
      this.glints.push(scene.add.image(at.x, at.y, 'throne.fx_particles', P_STAR).setBlendMode(ADD).setScale(0).setAlpha(0));
      this.glintT.push(rnd(400, 2600));
    }

    this.root.add([this.aura, this.aura2, this.elec, this.tipGlow, this.dis, this.motes, this.dust, ...this.glints]);
    const tick = (_t: number, dt: number) => this.update(dt);
    scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
  }

  /**
   * Phaser's preFX runs the displacement over a SQUARE render target (side = max(w, h) + 2·padding snapped up to 32 px)
   * centred on the sprite — not over the sprite's own rect. The maps are painted in sprite space, so they are
   * re-projected into that square (neutral grey around), otherwise the mask lands on the throne instead of the cloth.
   */
  private fxMap(key: string): string {
    const img = this.img, p = img.preFX?.padding ?? 0, bw = img.displayWidth, bh = img.displayHeight;
    const S = this.fxSide = Math.ceil(Math.max(bw + 2 * p, bh + 2 * p) / 32) * 32;
    const out = `${key}.rt${S}x${Math.round(bw)}`;
    if (!this.scene.textures.exists(out)) {
      const c = this.scene.textures.createCanvas(out, S, S)!, ctx = c.getContext();
      ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, S, S);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.scene.textures.get(key).getSourceImage() as CanvasImageSource, (S - bw) / 2, (S - bh) / 2, bw, bh);
      c.refresh();
    }
    return out;
  }

  setVisible(v: boolean): void { this.root.setVisible(v); this.motes.emitting = v; }
  get visible(): boolean { return this.root.visible; }

  /** Painting pixel → screen. */
  private at(px: number, py: number): { x: number; y: number } {
    const i = this.img ?? { x: 0, y: 0 };
    return { x: i.x + (px - SRC.w / 2) * this.k, y: i.y + (py - SRC.h * SRC.baseV) * this.k };
  }

  private update(dt: number): void {
    if (!this.root.visible) return;
    this.t += dt;
    const t = this.t, k = this.k;

    // Breathing: slow inhale, quicker exhale (~4.4 s); chest lifts ~1.7 px, face follows.
    const ph = (t % 4400) / 4400, br = ph < 0.55 ? Math.sin((ph / 0.55) * Math.PI / 2) : Math.cos(((ph - 0.55) / 0.45) * Math.PI / 2);
    if (this.breath) { this.breath.x = 0; this.breath.y = (2 * 1.7 * br) / this.fxSide; }
    // Cloth wind: travelling sway with slow gusts (~2.6 px at the hems); throne / armour never move (map is zero there).
    const gust = 0.7 + 0.3 * Math.sin((t / 5600) * Math.PI * 2), w = (t / 1900) * Math.PI * 2, amp = (2 * 2.6) / this.fxSide;
    if (this.windA && this.windB) { this.windA.x = amp * gust * Math.cos(w); this.windA.y = 0; this.windB.x = amp * gust * Math.sin(w); this.windB.y = 0; }

    // Aura: two mirrored copies breathing out of phase.
    const a1 = 0.5 + 0.5 * Math.sin((t / 1500) * Math.PI * 2), a2 = 0.5 + 0.5 * Math.sin((t / 2100) * Math.PI * 2 + 2);
    this.aura.setAlpha(0.22 + 0.14 * a1 + 0.25 * this.burst).setScale(this.aScale * (0.96 + 0.06 * a1), this.aScale);
    this.aura2.setAlpha(0.12 + 0.1 * a2 + 0.15 * this.burst).setScale(this.aScale * (0.92 + 0.1 * a2), this.aScale);
    if (this.runes) this.runes.setAlpha(0.2 + 0.25 * (0.5 + 0.5 * Math.sin((t / 2600) * Math.PI * 2)) + 0.35 * this.burst);

    // Electricity: a new painted frame every 55–90 ms (never the same twice), random mirror; bursts every 1.5–3.5 s.
    this.elecT -= dt;
    if (this.elecT <= 0) {
      this.elecT = rnd(55, 90);
      let f = Math.floor(Math.random() * FX.electric.n);
      if (f === this.elecFrame) f = (f + 1 + Math.floor(Math.random() * (FX.electric.n - 1))) % FX.electric.n;
      this.elecFrame = f;
      this.elec.setFrame(f).setFlipX(Math.random() < 0.5);
    }
    this.nextBurst -= dt;
    if (this.nextBurst <= 0) {
      this.nextBurst = rnd(1500, 3500);
      this.burst = 1;
      if (this.disT < 0 && Math.random() < 0.6) this.discharge();
    }
    this.burst = Math.max(0, this.burst - dt / 420);
    const flick = Math.random() < 0.08 ? 0.45 : 1;
    this.elec.setAlpha((0.42 + 0.5 * this.burst) * flick).setScale(this.eScale * (1 + 0.14 * this.burst), this.eScale);
    this.tipGlow.setAlpha(0.2 + 0.15 * a1 + 0.6 * this.burst);

    // Discharge into the dais (8 painted frames, ~0.45 s).
    if (this.disT >= 0) {
      this.disT += dt;
      const f = Math.floor(this.disT / 56);
      if (f >= FX.discharge.n) { this.disT = -1; this.dis.setVisible(false); }
      else this.dis.setFrame(f).setAlpha(f < 5 ? 1 : 1 - (f - 4) / 4);
    }

    // Star glints: a short twinkle on the pommel / crossguard tips every few seconds.
    this.glints.forEach((g, i) => {
      this.glintT[i] -= dt;
      if (this.glintT[i] <= 0 && this.glintT[i] > -560) {
        const q = -this.glintT[i] / 560, s = Math.sin(q * Math.PI);
        g.setAlpha(s).setScale((i === 0 ? 0.42 : 0.3) * k * 2 * s).setRotation(q * 0.5);
      } else if (this.glintT[i] <= -560) { this.glintT[i] = rnd(2200, 5200); g.setAlpha(0).setScale(0); }
    });
  }

  private discharge(): void {
    const k = this.k, tip = this.at(BLADE.tip[0], BLADE.tip[1]);
    this.disT = 0;
    this.dis.setVisible(true).setFrame(0).setFlipX(Math.random() < 0.5).setScale(0.6 * k * 2 * 0.62, 0.6 * k * 2 * 0.5);
    this.dust.emitParticleAt(tip.x, tip.y - 6 * k, 6);
  }
}
