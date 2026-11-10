// THE SPECTRAL SAMURAI — the new body as a spirit (GPT, 10 Nov, after the rig: "proceed to the spirit materials, sword and
// gameplay LOD … follow David's illustration, not the earlier overexposed ghost prototype"). His modelled body
// (spirit_samurai_ns.glb, its lighter gameplay twin spirit_samurai_ns_lite.glb) drawn with controlled transparency:
//   - his drawing kept: the ornate armour and its gold, the crimson scarf, sash and tie as strong colour anchors, the
//     white-lavender hair with its strands (never a white glowing block), the dark mask;
//   - a dark, detailed interior and luminous spectral edges: his cloth unified toward violet glass with its own values
//     kept, a violet-white light along his real silhouette and each piece's edges (not a uniformly bright lavender);
//   - see-through as a spirit: most solid at his chest and head, fading toward his feet (David's illustration);
//   - his eyes glowing beneath the bangs; thin energy veins rising through his cloth;
//   - his level changes the intensity, never the contrast: more of him seen, a stronger edge, eyes and veins;
//   - one surface only (his depth first: no muddle of inner layers), one blended pass — the core ghost material first on
//     a weaker computer (GPT: no bloom, no particles, no extra transparency passes for him).
// The spirit katana (SpiritForm's) in the real katana's place: its bright edge flares with the cast's own timing — it
// gathers through the wind-up, burns at the contact and fades through the follow-through; a very short streak of the
// edge's own path on every preset (GPT 10 Nov; never apart from the blade — the old large crescent is off behind
// ?spirits&ns). His level at GPT's four milestones (1, 30, 60, 100), eased between them. The regions his drawing alone cannot tell (the hair, the eyes, the face under
// the hair) come from a small mask in his atlas's own layout (tools/spirits/ns/nsmask.py).
import * as THREE from 'three';
import type { Hero3D, HeroDrive } from '../arena3d/Hero3D';
import { makeSecondary, type Secondary } from './Secondary';
import { floorMarks, ribbon, ribbonMat, spiritBlade, type SpiritFormOptions } from './SpiritForm';

/** The new Samurai's region mask (R the hair, G the eyes, B the face under the hair), in his atlas's own layout. */
export const SPECTRAL_MASK = 'spirit_samurai_ns_mask.png';
const DIR = 'assets/hero3d/';
/** His standing height on the screen (px) where he counts as far (the game's camera) and as near (the select, a close-up). */
const FAR_PX: [number, number] = [260, 620];

/** His light at GPT's four milestones (10 Nov: 1 an emerging spirit, 30 awakened, 60 powerful, 100 fully awakened — growing
 *  spiritual power, not merely another opacity); the levels between them eased from one to the next. `fill` his cloth's
 *  opacity at the chest, `foot` the share of it left at his feet, `rim` the edge light, `glow` his light inside, `vein` the
 *  energy currents (`veinK`: more of them, livelier), `eye` the eyes, `blade` the blade's energy, `ripple` the floor's,
 *  `aura` a subtle aura round him (from 60; no particle cloud). */
type Look = { fill: number; foot: number; rim: number; glow: number; vein: number; veinK: number; eye: number; blade: number; ripple: number; aura: number };
const KEYS: [number, Look][] = [
  [1, { fill: 0.70, foot: 0.42, rim: 0.40, glow: 0.03, vein: 0.14, veinK: 0, eye: 0.60, blade: 0.60, ripple: 0.50, aura: 0 }],
  [30, { fill: 0.80, foot: 0.50, rim: 0.62, glow: 0.16, vein: 0.42, veinK: 0.35, eye: 0.85, blade: 0.76, ripple: 0.65, aura: 0 }],
  [60, { fill: 0.86, foot: 0.57, rim: 0.82, glow: 0.30, vein: 0.68, veinK: 0.70, eye: 1.05, blade: 0.88, ripple: 0.80, aura: 0.10 }],
  [100, { fill: 0.92, foot: 0.64, rim: 1.00, glow: 0.44, vein: 0.95, veinK: 1, eye: 1.30, blade: 1.00, ripple: 1.00, aura: 0.17 }],
];
/** His look at a level (between two milestones: eased). */
function lookAt(level: number): Look {
  const L = Math.max(1, Math.min(100, level));
  let k = 0; while (k < KEYS.length - 2 && L > KEYS[k + 1][0]) k++;
  const [l0, a] = KEYS[k], [l1, b] = KEYS[k + 1], t0 = (L - l0) / (l1 - l0), t = t0 * t0 * (3 - 2 * t0);
  const out = { ...a }; for (const key of Object.keys(a) as (keyof Look)[]) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

/** Hero3D's own parts (private there: reached as they are). */
interface Parts {
  body: THREE.SkinnedMesh | null; bones: Map<string, THREE.Bone>; model: THREE.Group; root: THREE.Group; scene: THREE.Scene;
  weapons: Map<string, THREE.Group>; shadowMat: THREE.Material | null; shadowMat2: THREE.Material | null;
  swapArm(kind: string, model: THREE.Object3D | null, file?: string, girth?: number): void;
}

const lin = (r: number, g: number, b: number) => new THREE.Vector3(r, g, b);

/** His drawing as controlled spectral matter (a MeshStandardMaterial underneath: the scene's lights still model him). */
function spectralMaterial(src: THREE.MeshStandardMaterial, mask: THREE.Texture, U: Record<string, THREE.IUniform>): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: src.map, roughness: 0.8, metalness: 0, transparent: true, premultipliedAlpha: true, depthWrite: false });
  m.toneMapped = false;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uMask: { value: mask } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uQ0; uniform float uQS;\nvarying vec3 vSpP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpP = ( position - uQ0 ) * uQS; // (his rest pose, in his heights: 0 at his feet, 1 at the top of his hair)');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vSpP;
      uniform sampler2D uMask;
      uniform float uFill, uFoot, uRim, uGlow, uVein, uVeinK, uEye, uTime, uLit, uFar;
      uniform vec3 uViolet, uDeep, uRimC, uVeinC, uEyeC;
      float spH( vec3 p ) { return fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 ); }
      float spN( vec3 p ) { vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( mix( spH( i ), spH( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( spH( i + vec3( 0.0, 1.0, 0.0 ) ), spH( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
                    mix( mix( spH( i + vec3( 0.0, 0.0, 1.0 ) ), spH( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( spH( i + vec3( 0.0, 1.0, 1.0 ) ), spH( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z ); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      vec3 spT = diffuseColor.rgb; // (his drawing; the scene's lights see it as it is)`)
      .replace('#include <opaque_fragment>', `
      vec4 spM = texture2D( uMask, vMapUv );
      float hair = spM.r, eye = spM.g, face = spM.b;
      float spL = dot( spT, vec3( 0.2126, 0.7152, 0.0722 ) );
      // the drawing's own accents: the crimson (the scarf, the sash, the tie) and the gold (the armour's trims)
      float red = smoothstep( 0.05, 0.13, spT.r ) * smoothstep( 4.0, 7.0, spT.r / max( spT.g, 0.002 ) ) * smoothstep( 1.8, 3.0, spT.r / max( spT.b, 0.002 ) ) * ( 1.0 - hair ) * ( 1.0 - face );
      float gold = smoothstep( 0.10, 0.22, spT.r ) * smoothstep( 1.4, 2.0, spT.g / max( spT.b, 0.004 ) ) * smoothstep( 1.1, 1.35, spT.r / max( spT.g, 0.004 ) ) * ( 1.0 - smoothstep( 3.0, 4.5, spT.r / max( spT.g, 0.004 ) ) ) * ( 1.0 - hair ) * ( 1.0 - face );
      float cloth = clamp( 1.0 - hair - face - red - gold, 0.0, 1.0 );
      // most solid at his chest and head, fading toward his feet
      float up = smoothstep( 0.04, 0.62, vSpP.y );
      // (small on the screen — the game's camera — his interior must still read: a little more of him seen, and his
      // edge light narrower; up close, the see-through and the wide edge of the illustration)
      float fillN = min( 1.0, uFill * ( 1.0 + 0.16 * uFar ) ), fade = mix( min( 1.0, uFoot * ( 1.0 + 0.5 * uFar ) ), 1.0, up );
      // his core — the upper legs, the torso, the shoulders (GPT: dark, detailed armour inside a luminous spirit): darker
      // and a little more solid, most at the game's camera
      float core = smoothstep( 0.28, 0.40, vSpP.y ) * ( 1.0 - smoothstep( 0.80, 0.87, vSpP.y ) );
      // the edge: his silhouette and each piece's own edges
      float spF = 1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 );
      float rim = smoothstep( mix( 0.32, 0.55, uFar ), 1.0, spF ) * mix( 1.0, 0.75, uFar );
      // the energy veins: thin lines where a slow noise crosses its middle, rising through his cloth
      vec3 vp = vSpP * mix( 8.0, 11.0, uVeinK );                                  // (more currents as his power grows, livelier)
      float vt = uTime * mix( 0.14, 0.32, uVeinK );
      float vn = spN( vp + vec3( 0.0, -vt, 0.0 ) ) * 0.68 + spN( vp * 2.3 + vec3( 1.7, -vt * 1.7, 0.4 ) ) * 0.32;
      float vein = pow( 1.0 - abs( vn * 2.0 - 1.0 ), mix( 13.0, 9.0, uVeinK ) );
      float pulse = 0.88 + 0.12 * sin( uTime * 1.7 );
      // his colour: his drawing's own light (a dim interior, a little brighter with his level) and the scene's light
      // modelling it (his form: a lit side and a dark one)
      vec3 spLit = min( outgoingLight - totalEmissiveRadiance, spT * 1.7 + 0.02 ); // (a brazier close by warms him, never washes him out)
      vec3 col = spT * ( 0.27 + 0.22 * uGlow ) + spLit * uLit;
      float cl = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      col = mix( col, uViolet * cl * 2.2, 0.36 * cloth );                         // the cloth: rich violet glass, its values kept
      col *= 1.0 - ( 0.10 + 0.14 * uFar ) * core * cloth;                         // (the core darker: its armour's detail reads)
      col = mix( col, uDeep + spT * 0.07, face );                                 // the mask: distinctly dark, never a lit face
      col = mix( col, pow( col, vec3( 1.45 ) ) * 1.15, hair );                    // the hair: its strands drawn apart (no white block)
      col *= mix( vec3( 1.0 ), vec3( 0.90, 0.83, 1.0 ), hair );                   // (its lavender shading kept)
      // how much of him is seen
      float a = min( 1.0, fillN * fade + ( 0.04 + 0.06 * uFar ) * core ) * cloth
              + mix( 0.88, 0.98, uFill ) * mix( 0.85, 1.0, up ) * gold            // the gold: more solid than the spirit round it
              + mix( 0.90, 0.98, uFill ) * red                                    // the crimson: a strong anchor
              + mix( 0.82, 0.94, uFill ) * hair                                   // the hair: its strands, not a glow
              + 0.97 * face;
      // his own light, added over what is behind him (in the picture's own values: a small light stays small)
      vec3 spAdd = uRimC * rim * uRim * 0.55 * ( 1.0 - 0.7 * face - 0.65 * hair - 0.5 * gold - 0.5 * red ); // (never over the armour's detail)
      spAdd += uVeinC * vein * uVein * 0.85 * cloth * ( 1.0 - 0.5 * up ) * pulse;
      spAdd += uEyeC * eye * uEye * pulse;
      spAdd += sqrt( spT ) * ( gold * 0.16 + red * 0.10 ) * uGlow;
      spAdd += sqrt( totalEmissiveRadiance );                                     // (a hit's flash)
      a = clamp( a + rim * uRim * 0.4 + eye * 0.7, 0.0, 1.0 );
      gl_FragColor = vec4( min( col, vec3( 1.0 ) ), a );`)
      .replace('#include <premultiplied_alpha_fragment>', `gl_FragColor.rgb = gl_FragColor.rgb * gl_FragColor.a + spAdd; // (premultiplied, his own light added)`);
  };
  m.customProgramCacheKey = () => 'spirit-spectral';
  return m;
}

/** A soft round light (the eyes' glow). */
function glowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** The blade's strike: how much its edge burns at this moment of the cast (0 … 1) — gathering through the wind-up's
 *  last half, full from the contact through the active time, fading through the first part of the follow-through. */
function strike(c: HeroDrive['cast'] | null | undefined): number {
  if (!c) return 0;
  const e = c.elapsed, s = Math.max(1, c.startup), a = Math.max(1, c.active), r = Math.max(60, c.recovery * 0.45);
  const sm = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  return sm((e - s * 0.5) / (s * 0.5)) * (1 - sm((e - s - a) / r));
}

export class Spectral {
  private parts: Parts;
  private U: Record<string, THREE.IUniform>;
  private bladeU = { uTime: { value: 0 }, uEnergy: { value: 1 }, uFlash: { value: 0 } };
  private pre: THREE.SkinnedMesh | null = null;
  private blade: ReturnType<typeof spiritBlade> | null = null;
  private tassel: { pts: THREE.Vector3[]; old: THREE.Vector3[]; r: ReturnType<typeof ribbon>; bead: THREE.Mesh; fresh: boolean } | null = null;
  private streak: { r: ReturnType<typeof ribbon>; mat: THREE.ShaderMaterial; hist: { t: number; p: THREE.Vector3 }[]; pts: THREE.Vector3[] } | null = null;
  private floor: ReturnType<typeof floorMarks> | null = null;
  private eyes: THREE.Sprite[] = [];
  /** His ponytail, his skirt's panels, his sash's tails (Secondary.ts); `manual`: stepped by its owner instead. */
  readonly secondary: Secondary | null;
  manual = false;
  private own: { dispose(): void }[] = [];
  private cast: HeroDrive['cast'] | null = null;
  private last = performance.now();
  private t = 0;
  private dead = false;
  private hero: Hero3D;

  private constructor(hero: Hero3D, private o: SpiritFormOptions, mask: THREE.Texture) {
    this.hero = hero;
    const P = this.parts = hero as unknown as Parts;
    this.secondary = makeSecondary(P.bones, P.body?.skeleton);
    this.U = {
      uFill: { value: 0.5 }, uFoot: { value: 0.4 }, uRim: { value: 0.7 }, uGlow: { value: 0.1 }, uVein: { value: 0.3 }, uEye: { value: 1 }, uTime: { value: 0 }, uLit: { value: o.lit ?? 0.32 }, uFar: { value: 0 }, uVeinK: { value: 0 },
      uQ0: { value: new THREE.Vector3() }, uQS: { value: 1 },
      uViolet: { value: lin(0.42, 0.22, 1.0) }, uDeep: { value: lin(0.02, 0.008, 0.05) },
      // (the added lights, in the picture's own values)
      uRimC: { value: lin(0.70, 0.50, 1.0) }, uVeinC: { value: lin(0.66, 0.45, 1.0) }, uEyeC: { value: lin(0.80, 0.58, 1.0) },
    };
    const body = P.body;
    if (body) {
      // his rest pose in his own heights (the quantized body's box: its feet at 0, the top of his hair at 1)
      body.geometry.computeBoundingBox(); const bb = body.geometry.boundingBox!, H = Math.max(1e-6, bb.max.y - bb.min.y);
      (this.U.uQ0.value as THREE.Vector3).set((bb.min.x + bb.max.x) / 2, bb.min.y, (bb.min.z + bb.max.z) / 2); this.U.uQS.value = 1 / H;
      const old = body.material as THREE.MeshStandardMaterial;
      body.material = spectralMaterial(old, mask, this.U); this.own.push(body.material as THREE.Material, mask);
      // only his nearest surface: his depth first, drawn before everything of his (his fittings excepted)
      const pm = new THREE.MeshBasicMaterial({ colorWrite: false }); this.own.push(pm);
      const pre = new THREE.SkinnedMesh(body.geometry, pm); pre.bind(body.skeleton, body.bindMatrix);
      pre.frustumCulled = false; pre.renderOrder = -1; pre.userData.worn = true; pre.userData.shadow = true;
      body.parent?.add(pre); this.pre = pre;
    }
    // his cast shadow (a physical body's) is no longer his: the small soft one and the ripple instead
    for (const m of [P.shadowMat, P.shadowMat2]) if (m) m.visible = false;
    // the spirit blade in the katana's place (the fist refitted round its hilt), its tassel, the streak of its edge
    if (P.weapons.has('katana')) {
      const b = this.blade = spiritBlade(this.bladeU);
      P.swapArm('katana', b.root, 'spirit-blade', 1);
      this.tasselMake(); this.streakMake();
      // (facing left his sword arm is the far one: where his own see-through body stands in front of the blade and its
      // streak, a dimmer copy of each is drawn — the cut still reads through the spirit; only while the blade is behind him)
      const xm = (b.blade.material as THREE.ShaderMaterial).clone();
      Object.assign(xm.uniforms, { uTime: this.bladeU.uTime, uEnergy: this.bladeU.uEnergy, uFlash: this.bladeU.uFlash, uSeen: { value: 0.5 } });
      xm.depthFunc = THREE.GreaterDepth; this.own.push(xm);
      const bx = this.bladeX = new THREE.Mesh(b.blade.geometry, xm); bx.renderOrder = 2.5; bx.visible = false; b.blade.add(bx);
      if (this.streak) {
        const sm = ribbonMat(0xe6d8ff, 0.0, 0.016, 1.6, 0.9); sm.depthFunc = THREE.GreaterDepth; this.own.push(sm);
        const sx = new THREE.Mesh(this.streak.r.mesh.geometry, sm); sx.renderOrder = 3.5; sx.frustumCulled = false; sx.visible = false; P.scene.add(sx);
        this.streakX = { mesh: sx, mat: sm };
      }
    }
    if (o.ground) { this.floor = floorMarks(P.scene, this.U.uTime); this.own.push(this.floor); }
    this.eyesMake(mask);
    this.auraMake();
    this.setLevel(o.level);
    // the cast as the game drives it (the blade's strike follows its own timing)
    const drive = hero.drive.bind(hero);
    (hero as { drive: Hero3D['drive'] }).drive = (d, ms) => { this.cast = d.mode === 'skill' ? d.cast ?? null : null; drive(d, ms); };
    const prev = P.scene.onBeforeRender;
    P.scene.onBeforeRender = (r, s, c, g, m, gr) => { this.frame(); this.sizeOn(r, c); prev?.call(P.scene, r, s, c, g, m, gr); };
  }

  /** The Spectral Samurai on his body (the mask loaded first: no picture without it). */
  static async create(hero: Hero3D, o: SpiritFormOptions): Promise<Spectral> {
    const mask = await new THREE.TextureLoader().loadAsync(DIR + SPECTRAL_MASK);
    mask.colorSpace = THREE.NoColorSpace; mask.flipY = false; // (glTF's own UV layout)
    return new Spectral(hero, o, mask);
  }

  /** His level now (a level up: his light grows at once). */
  setLevel(level: number): void {
    const T = this.look = lookAt(level), U = this.U;
    U.uFill.value = T.fill; U.uFoot.value = T.foot; U.uRim.value = T.rim; U.uGlow.value = T.glow; U.uVein.value = T.vein; U.uVeinK.value = T.veinK; U.uEye.value = T.eye;
    this.bladeU.uEnergy.value = T.blade;
    if (this.floor) this.floor.rU.uStrength.value = T.ripple;
    for (const e of this.eyes) (e.material as THREE.SpriteMaterial).opacity = 0.5 * T.eye;
  }
  private look: Look = KEYS[0][1];

  /** His eyes' glow beneath the bangs (GPT): a small soft light on each, on the head — found where the mask marks the
   *  eyes, in front of them by a hair's breadth (the bangs in front still hide them). */
  private eyesMake(mask: THREE.Texture): void {
    const P = this.parts, body = P.body, head = P.bones.get('Head'), img = mask.image as CanvasImageSource & { width: number; height: number } | undefined;
    if (!body || !head || !img?.width) return;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d', { willReadFrequently: true }); if (!g) return;
    g.drawImage(img, 0, 0); const px = g.getImageData(0, 0, cv.width, cv.height).data;
    const uv = body.geometry.attributes.uv as THREE.BufferAttribute, n = uv.count, ids: number[] = [];
    for (let i = 0; i < n; i++) { const x = Math.min(cv.width - 1, Math.floor(uv.getX(i) * cv.width)), y = Math.min(cv.height - 1, Math.floor(uv.getY(i) * cv.height)); if (px[(y * cv.width + x) * 4 + 1] > 150) ids.push(i); }
    if (ids.length < 4) return;
    P.root.updateMatrixWorld(true);
    const pts = ids.map((i) => body.localToWorld(body.getVertexPosition(i, new THREE.Vector3())));
    const mid = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const side = new THREE.Vector3(1, 0, 0).transformDirection(body.matrixWorld), fwd = new THREE.Vector3(0, 0, 1).transformDirection(body.matrixWorld);
    const k = body.getWorldScale(new THREE.Vector3()).x, hk = head.getWorldScale(new THREE.Vector3()).x;
    const tex = glowTex(); this.own.push(tex);
    for (const sd of [-1, 1]) {
      const mine = pts.filter((p) => p.clone().sub(mid).dot(side) * sd > 0); if (!mine.length) continue;
      const c = mine.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / mine.length).addScaledVector(fwd, 0.012 * k);
      const m = new THREE.SpriteMaterial({ map: tex, color: 0xb98cff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 });
      m.toneMapped = false; this.own.push(m);
      const sp = new THREE.Sprite(m); sp.position.copy(head.worldToLocal(c)); this.eyeS = (0.026 * k) / hk; sp.scale.setScalar(this.eyeS); sp.renderOrder = 5;
      head.add(sp); this.eyes.push(sp);
    }
  }

  private eyeS = 0.026;

  /** His aura (from level 60, GPT: subtle — no particle cloud; off on Low): a soft violet glow behind his chest, its middle
   *  hidden by his own depth, so it shows round his silhouette. */
  private auraMake(): void {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (let i = 0; i <= 10; i++) { const t = i / 10; gr.addColorStop(t, `rgba(255,255,255,${(Math.exp(-t * t * 4.2) * (1 - t)).toFixed(3)})`); }
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c), m = new THREE.SpriteMaterial({ map: tex, color: 0x8c5cff, transparent: true, depthWrite: false, opacity: 0 }); // (straight alpha: a sprite's shader does not premultiply)
    m.toneMapped = false; this.own.push(tex, m);
    const a = this.aura = new THREE.Sprite(m); a.renderOrder = -0.5; a.frustumCulled = false; a.visible = false; this.parts.scene.add(a);
  }
  private aura: THREE.Sprite | null = null;
  private bladeX: THREE.Mesh | null = null;
  private streakX: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } | null = null;
  private behind = false;

  private tasselMake(): void {
    const mat = ribbonMat(0xc8102e, 0.95, 0.007, 1.2); this.own.push(mat);
    const r = ribbon(6, mat, (t) => 0.6 + 0.6 * t); r.mesh.renderOrder = 3; this.parts.scene.add(r.mesh); this.own.push(r.mesh.geometry);
    const bg = new THREE.SphereGeometry(0.0085, 12, 8), bm = new THREE.MeshStandardMaterial({ color: 0x6a2cff, emissive: 0x7c3cff, emissiveIntensity: 1.2, roughness: 0.3 });
    const bead = new THREE.Mesh(bg, bm); this.parts.scene.add(bead); this.own.push(bg, bm);
    this.tassel = { pts: Array.from({ length: 6 }, () => new THREE.Vector3()), old: Array.from({ length: 6 }, () => new THREE.Vector3()), r, bead, fresh: true };
  }

  /** The edge's streak (every preset — GPT 10 Nov; High a little longer): its tip's own path over the last few hundredths
   *  of a second, while it strikes — always on the blade, never apart from it. */
  private streakMake(): void {
    const mat = ribbonMat(0xe6d8ff, 0.0, 0.016, 1.6, 0.9); this.own.push(mat);
    const r = ribbon(8, mat, (t) => 1 - 0.7 * t); r.mesh.renderOrder = 3; r.mesh.visible = false; this.parts.scene.add(r.mesh); this.own.push(r.mesh.geometry);
    this.streak = { r, mat, hist: [], pts: Array.from({ length: 8 }, () => new THREE.Vector3()) };
  }

  private V = new THREE.Vector3(); private TIP = new THREE.Vector3(-0.068, 0.79, 0); // (the blade's point, in the katana's frame: its curve bows back)
  /** How small he is in this picture (uFar: 1 at the game's camera, 0 up close): his standing height in pixels. */
  private sizeOn(r: THREE.WebGLRenderer, c: THREE.Camera): void {
    const cam = c as THREE.PerspectiveCamera; if (!cam.isPerspectiveCamera) return;
    const d = cam.getWorldPosition(this.V).distanceTo(this.parts.root.getWorldPosition(this.W2)); if (d < 1e-3) return;
    const h = r.getDrawingBufferSize(this.S2).y, px = ((1.3 * this.parts.root.scale.y) / (2 * d * Math.tan((cam.fov * Math.PI) / 360))) * h * cam.zoom;
    const t = Math.max(0, Math.min(1, (FAR_PX[1] - px) / (FAR_PX[1] - FAR_PX[0]))), far = this.U.uFar.value = t * t * (3 - 2 * t);
    for (const e of this.eyes) e.scale.setScalar(this.eyeS * (1 + 0.9 * far)); // (both eyes still read beneath the bangs at the game's camera)
    // the blade behind his body (seen from this camera): its dimmer copies on
    const pel = this.parts.bones.get('pelvis'), bl = this.blade;
    if (pel && bl) {
      const dB = bl.root.getWorldPosition(this.W2).distanceTo(this.V), dP = pel.getWorldPosition(this.W2).distanceTo(this.V);
      this.behind = dB > dP + 0.01;
      if (this.bladeX) this.bladeX.visible = this.behind;
    }
    // the aura: behind his chest, a little away from the eye (Low: none — the extras go first)
    const au = this.aura, chest = this.parts.bones.get('spine_03'), preset = Math.round(this.o.preset?.() ?? 0), P = this.parts;
    if (au && chest) {
      au.visible = this.look.aura > 0.005 && preset < 2 && !!P.body?.visible && P.model.visible;
      if (au.visible) {
        chest.getWorldPosition(au.position); au.position.addScaledVector(this.W2.copy(au.position).sub(this.V).normalize(), 0.3);
        const hh = 1.3 * P.root.scale.y; au.scale.set(hh * 1.0, hh * 1.5, 1);
        (au.material as THREE.SpriteMaterial).opacity = this.look.aura * (0.9 + 0.1 * Math.sin(this.t * 2.1));
      }
    }
  }
  private W2 = new THREE.Vector3(); private S2 = new THREE.Vector2();

  /** Each picture (unless its owner steps him: `manual`). */
  private frame(): void {
    if (this.dead || this.manual) return;
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.tick(dt);
  }

  /** `dt` seconds on: his clock, his secondary motion, the blade's strike, the tassel, the floor marks. */
  tick(dt: number): void {
    if (this.dead) return;
    this.t += dt; this.U.uTime.value = this.t; this.bladeU.uTime.value = this.t;
    this.secondary?.update(dt);
    const P = this.parts, preset = Math.max(0, Math.min(2, Math.round(this.o.preset?.() ?? 0)));
    if (this.pre && P.body) this.pre.visible = P.body.visible; // (his depth only where he is drawn)
    for (const e of this.eyes) e.visible = !!P.body?.visible;
    const k = P.model.scale.x;
    // the blade's strike: its edge burns with the cast's own timing
    const bl = this.blade, shown = (() => { if (!bl) return false; for (let p: THREE.Object3D | null = bl.root; p; p = p.parent) if (!p.visible) return false; return true; })();
    const fl = shown ? strike(this.cast) : 0;
    this.bladeU.uFlash.value = fl;
    if (bl) bl.halo.uniforms.uAlpha.value = 0.3 + 0.35 * this.look.blade + 0.35 * fl;
    const sk = this.streak;
    if (sk && bl) {
      const tip = bl.root.localToWorld(this.V.copy(this.TIP)), H = sk.hist;
      const life = preset === 0 ? 0.09 : 0.06;
      H.push({ t: this.t, p: tip.clone() }); while (H.length > 2 && H[1].t < this.t - life) H.shift();
      const on = shown && fl > 0.05 && H.length > 2;
      sk.r.mesh.visible = on;
      if (this.streakX) this.streakX.mesh.visible = on && this.behind;
      if (on) {
        for (let j = 0; j < sk.pts.length; j++) { const f = (j / (sk.pts.length - 1)) * (H.length - 1), i = Math.floor(f), w = f - i, a = H[H.length - 1 - i].p, b = H[Math.max(0, H.length - 2 - i)].p; sk.pts[j].copy(a).lerp(b, w); }
        const far = this.U.uFar.value as number; // (small on the screen: wider and brighter, so the cut reads at the game's camera)
        sk.mat.uniforms.uAlpha.value = (0.55 + 0.25 * far) * fl; sk.mat.uniforms.uWidth.value = (0.016 * (1 + 1.4 * far) * k) / 0.72;
        if (this.streakX) { this.streakX.mat.uniforms.uAlpha.value = sk.mat.uniforms.uAlpha.value * 0.55; this.streakX.mat.uniforms.uWidth.value = sk.mat.uniforms.uWidth.value; }
        sk.r.set(sk.pts);
      }
    }
    // the tassel: a short cord hanging from the pommel, swinging (a chain with its own weight)
    const ts = this.tassel;
    if (ts && bl) {
      ts.r.mesh.visible = shown; ts.bead.visible = shown;
      if (shown) {
        const top = bl.pommel.getWorldPosition(this.V).clone(), seg = 0.018 * k / 0.72;
        if (ts.fresh) { ts.pts.forEach((p, j) => p.copy(top).add(new THREE.Vector3(0, -seg * j, 0))); ts.old.forEach((p, j) => p.copy(ts.pts[j])); ts.fresh = false; }
        ts.pts[0].copy(top); ts.old[0].copy(top);
        for (let j = 1; j < ts.pts.length; j++) { const p = ts.pts[j], v = p.clone().sub(ts.old[j]).multiplyScalar(0.9); ts.old[j].copy(p); p.add(v); p.y -= 9.8 * dt * dt; }
        for (let it = 0; it < 3; it++) for (let j = 1; j < ts.pts.length; j++) { const a = ts.pts[j - 1], b = ts.pts[j], d = b.clone().sub(a), L = d.length() || 1e-6; b.copy(a).addScaledVector(d, seg / L); }
        ts.r.set(ts.pts); ts.bead.position.copy(ts.pts[1]); ts.bead.scale.setScalar(k / 0.72);
      }
    }
    // the floor marks under him: the contact shadow fading as he rises, the ripple (not on Low)
    const f = this.floor;
    if (f && this.o.ground) {
      const gy = this.o.ground(), r = P.root.position, rise = Math.max(0, r.y - gy), on = P.model.visible;
      f.shadow.visible = on; f.ripple.visible = on && preset < 2;
      f.shadow.position.set(r.x, gy + 0.006, r.z); f.ripple.position.set(r.x, gy + 0.007, r.z);
      (f.shadow.material as THREE.ShaderMaterial).uniforms.uA.value = 0.32 * Math.max(0, 1 - rise / 1.2);
      f.shadow.scale.setScalar(1 - Math.min(0.5, rise / 2.4));
      f.rU.uStrength.value = this.look.ripple * Math.max(0, 1 - rise / 0.9);
    }
  }

  dispose(): void {
    if (this.dead) return; this.dead = true;
    delete (this.hero as { drive?: unknown }).drive; // (the class's own again)
    this.pre?.removeFromParent(); this.blade?.dispose();
    this.tassel?.r.mesh.removeFromParent(); this.tassel?.bead.removeFromParent(); this.streak?.r.mesh.removeFromParent();
    for (const e of this.eyes) e.removeFromParent();
    this.aura?.removeFromParent(); this.streakX?.mesh.removeFromParent();
    for (const o of this.own) o.dispose();
  }
}

/** The new Spectral Samurai as a spirit (the world, the select, the windows, the bench): see Spectral. */
export function makeSpectral(hero: Hero3D, o: SpiritFormOptions): Promise<Spectral> { return Spectral.create(hero, o); }
