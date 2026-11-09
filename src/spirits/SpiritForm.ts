// THE SPIRIT FORM (David, 9 Nov evening: "the Samurai must be a fully transparent ghost, not physical — as he levels up
// his light grows stronger and you see him more; his clothes never change; his sword not a sword but a transparent
// blade"; GPT's direction and concept pictures the same night). His modelled body (spirit_samurai.glb) drawn as a
// spirit in GPT's three layers of identity:
//   1. the core read — his silhouette, the face mask, the hair's mass, the scarf and sash, the blade's shape;
//   2. the spirit material — see-through, a violet-white rim along the silhouette (strong at every level), a light inside
//      him that grows with his level; his drawing read as spectral matter (a violet value ramp; the gold trims, the
//      crimson scarf and sash and the white hair kept as accents: the sash and scarf more solid than the body, the hair
//      brighter); only the surface nearest the eye is drawn (a depth pass first: no muddle of layers);
//   3. prestige — a few wisps from the shoulders, sleeves, coat tails and sash, more with his level; cut first on a
//      weaker computer (GPT: "remove decorations before identity").
// The level's tiers (GPT): 1–9 a faint spirit, 10–29 a clearer body, 30–59 an established spirit warrior, 60–99 a
// powerful spectral form, 100 the full awakened form. The spirit blade (GPT's sheet): a clear violet blade, denser at
// the guard, softer toward the tip, a bright edge, a starry core; a gold tsuba with cloud scrolls, a wrapped violet hilt,
// a gold pommel with a violet swirl, a crimson tassel with a violet bead. On the floor: a faint spectral ripple and a
// small soft contact shadow (GPT: both — a ripple alone floats, a shadow alone is physical again).
// Everything is drawn premultiplied (the world's layers and the menus' canvases composite it as such).
import * as THREE from 'three';
import type { Hero3D } from '../arena3d/Hero3D';

/** His level's tier (GPT): 0 faint (1–9), 1 clearer (10–29), 2 established (30–59), 3 powerful (60–99), 4 awakened (100). */
export function spiritTier(level: number): number { return level >= 100 ? 4 : level >= 60 ? 3 : level >= 30 ? 2 : level >= 10 ? 1 : 0; }

/** Each tier's light (GPT's ranges: the fill 0.22 → 0.60, the rim 0.75 → 1.00, the light inside 0.15 → 0.70; the hair,
 *  the eyes, the wisps and the blade's energy grow with them). */
const TIERS = [
  { fill: 0.22, rim: 0.75, glow: 0.15, hair: 0.45, wisps: 2, blade: 0.55, ripple: 0.55, aura: 0.16 },
  { fill: 0.32, rim: 0.80, glow: 0.28, hair: 0.58, wisps: 3, blade: 0.66, ripple: 0.65, aura: 0.24 },
  { fill: 0.42, rim: 0.86, glow: 0.42, hair: 0.70, wisps: 5, blade: 0.78, ripple: 0.75, aura: 0.32 },
  { fill: 0.52, rim: 0.93, glow: 0.56, hair: 0.84, wisps: 6, blade: 0.9, ripple: 0.88, aura: 0.42 },
  { fill: 0.60, rim: 1.00, glow: 0.70, hair: 1.0, wisps: 8, blade: 1.0, ripple: 1.0, aura: 0.52 },
];

/** The presets (GPT): 0 High (everything), 1 Medium (the same spirit, half the wisps), 2 Low (the same silhouette and
 *  level read; no wisps). */
export type SpiritPreset = 0 | 1 | 2;

export interface SpiritFormOptions {
  /** His level (its tier sets his light). */
  level: number;
  /** The preset, read each frame (the world's picture quality); High when none. */
  preset?: () => number;
  /** The floor's height under him (his scene's units): his ripple and contact shadow lie on it. None: no floor marks. */
  ground?: () => number;
  /** How much of the scene's own light (the moon, a brazier near him) colours him (default 0.14). */
  lit?: number;
}

/** Hero3D's own parts (private there: reached as they are). */
interface Parts {
  body: THREE.SkinnedMesh | null; bones: Map<string, THREE.Bone>; model: THREE.Group; root: THREE.Group; scene: THREE.Scene;
  weapons: Map<string, THREE.Group>; shadowMat: THREE.Material | null; shadowMat2: THREE.Material | null;
  swapArm(kind: string, model: THREE.Object3D | null, file?: string, girth?: number): void;
}

const C = (r: number, g: number, b: number) => new THREE.Vector3(r, g, b);

// ------------------------------------------------------------------------------------------------ the spirit material
/** His drawing as spectral matter (a MeshStandardMaterial underneath: the scene's lights still touch him — the moon's
 *  side, a brazier's warmth when he walks by it). */
function ghostMaterial(src: THREE.MeshStandardMaterial, U: Record<string, THREE.IUniform>): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, roughness: 0.75, metalness: 0, transparent: true, premultipliedAlpha: true, depthWrite: false });
  m.toneMapped = false;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSpY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpY = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying float vSpY;
      uniform float uFill, uRim, uGlow, uHair, uTime, uHairY, uNeckY, uLit;
      uniform vec3 uDeep, uMid, uHi, uRimC, uGold, uRed, uWhite, uFlame;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      vec3 spT = diffuseColor.rgb;
      diffuseColor.rgb = vec3( 0.42, 0.38, 0.55 ); // (what the scene's lights see of him: a pale violet)`)
      .replace('#include <opaque_fragment>', `
      float spL = dot( spT, vec3( 0.2126, 0.7152, 0.0722 ) );
      float spMx = max( spT.r, max( spT.g, spT.b ) ), spMn = min( spT.r, min( spT.g, spT.b ) );
      float spV = clamp( pow( spL / 0.35, 0.55 ), 0.0, 1.0 ); // (the drawing's value, opened up)
      // the accents, read from the drawing's own colours
      float mRed = smoothstep( 0.06, 0.16, spT.r ) * smoothstep( 5.0, 8.0, spT.r / max( spT.g, 0.002 ) ) * smoothstep( 2.5, 4.0, spT.r / max( spT.b, 0.002 ) );
      float mGold = smoothstep( 0.12, 0.25, spT.r ) * smoothstep( 1.3, 1.9, spT.g / max( spT.b, 0.004 ) ) * smoothstep( 1.15, 1.45, spT.r / max( spT.g, 0.004 ) ) * ( 1.0 - smoothstep( 3.0, 4.5, spT.r / max( spT.g, 0.004 ) ) );
      float mWhite = smoothstep( 0.16, 0.32, spMn ) * ( 1.0 - smoothstep( 0.35, 0.55, ( spMx - spMn ) / max( spMx, 0.004 ) ) );
      float mFlame = smoothstep( 0.18, 0.45, spT.b ) * smoothstep( 0.15, 0.35, spT.b - spT.g ) * smoothstep( 0.08, 0.25, spT.r );
      float mMask = ( 1.0 - smoothstep( 0.004, 0.03, spL ) ) * smoothstep( uNeckY, uNeckY + 0.02, vSpY ) * ( 1.0 - mWhite ); // (the face's dark mask)
      float spHead = smoothstep( uHairY - 0.03, uHairY, vSpY );
      float spPulse = 0.86 + 0.14 * sin( uTime * 1.7 );
      // the rim: the silhouette's edge, strong at every level
      float spF = 1.0 - clamp( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 0.0, 1.0 );
      float spRim = pow( spF, 2.2 ) * uRim;
      // the spectral matter: the drawing's value on a deep violet ramp (violet glass, not milk)
      float mAcc = clamp( mGold + mRed + mWhite + mMask, 0.0, 1.0 );
      vec3 col = mix( uDeep, uMid, smoothstep( 0.05, 0.7, spV ) );
      col += uMid * uGlow * 0.9 * ( 0.35 + 0.65 * spV ) * spPulse * ( 1.0 - mAcc );           // the light inside him
      col += uFlame * mFlame * ( 0.45 + 1.2 * uGlow ) * spPulse;                                // the drawing's own violet lit from within
      col += outgoingLight * uLit * ( 1.0 - mAcc );                                              // the scene's light on him
      col = mix( col, uGold * ( 0.85 + 0.9 * spL ), mGold );                                     // the gold trims: gold light
      col = mix( col, uRed * ( 0.8 + 1.6 * spT.r ), mRed );
      col = mix( col, uWhite, mWhite );
      col = mix( col, uDeep * 0.3, mMask );
      col = mix( col, uRimC, clamp( spRim * 1.15, 0.0, 1.0 ) );
      float a = uFill * ( 0.6 + 0.6 * spV );
      a = max( a, mRed * ( 0.62 + 0.3 * uFill ) );                  // the scarf and the sash: semi-solid anchors
      a = max( a, mGold * ( 0.5 + 0.45 * uFill ) );                 // the trims: readable at every level
      a = max( a, mWhite * ( 0.4 + 0.5 * uHair ) );                 // the hair (and the eyes): brighter than the body
      a = max( a, mMask * ( 0.55 + 0.3 * uFill ) );                 // the mask: the face reads at every level
      a = max( a, mFlame * ( uFill + 0.2 * uGlow ) );
      a += spRim * 0.9 + uGlow * 0.16 * spV;
      gl_FragColor = vec4( min( col, vec3( 1.0 ) ), clamp( a, 0.0, 1.0 ) );`);
  };
  m.customProgramCacheKey = () => 'spirit-form';
  return m;
}

/** His aura (GPT's third layer, prestige — richer with his level): a soft violet glow behind him, its middle hidden by
 *  his own depth, so it shows round his silhouette and faintly through him. */
function auraSprite(): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i <= 10; i++) { const t = i / 10; gr.addColorStop(t, `rgba(255,255,255,${(Math.exp(-t * t * 4.2) * (1 - t)).toFixed(3)})`); }
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: tex, color: 0x9a62ff, transparent: true, depthWrite: false, opacity: 0.3 }); // (straight alpha: the sprite's shader does not premultiply its colour)
  m.toneMapped = false;
  const s = new THREE.Sprite(m); s.renderOrder = -0.5; s.frustumCulled = false; s.userData.tex = tex;
  return s;
}

// ------------------------------------------------------------------------------------------------ the spirit blade
/** A canvas texture (drawn once). */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** The tsuba's face: gold, cloud scrolls engraved round it, a violet inlay ring, the blade's slot. */
function tsubaFace(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    const c = 128, gr = g.createRadialGradient(c, c, 10, c, c, 128); gr.addColorStop(0, '#f2cf7a'); gr.addColorStop(0.7, '#c99a3e'); gr.addColorStop(1, '#7d5a1c');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, 128, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6a4a14'; g.lineWidth = 5; g.beginPath(); g.arc(c, c, 118, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#7a3cff'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, 104, 0, Math.PI * 2); g.stroke(); // (the violet inlay)
    g.strokeStyle = '#5c3e0e'; g.lineWidth = 6; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) { // the cloud scrolls: a spiral and its tail in each quarter
      const a0 = (k / 4) * Math.PI * 2 + 0.4, cx = c + Math.cos(a0) * 70, cy = c + Math.sin(a0) * 70;
      g.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40, r = 4 + t * 20, a = a0 + t * 4.4; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
      g.beginPath(); g.arc(c, c, 86, a0 + 0.35, a0 + 1.2); g.stroke();
    }
    g.fillStyle = '#1a1022'; g.beginPath(); g.ellipse(c, c, 30, 12, 0, 0, Math.PI * 2); g.fill(); // (the slot round the blade)
  });
}
/** The hilt's wrap: violet silk crossing over pale ray skin in diamonds, two gold ornaments. */
function hiltWrap(): THREE.CanvasTexture {
  return canvasTex(128, 256, (g) => {
    g.fillStyle = '#d9cdf2'; g.fillRect(0, 0, 128, 256); // (the ray skin)
    for (let y = -64; y < 320; y += 32) { // the silk: two bands crossing, one diamond each turn
      g.fillStyle = '#3a2270';
      g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 16); g.lineTo(64, y + 30); g.lineTo(0, y + 14); g.fill();
      g.beginPath(); g.moveTo(128, y); g.lineTo(64, y + 16); g.lineTo(64, y + 30); g.lineTo(128, y + 14); g.fill();
      g.strokeStyle = '#7b5bd0'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y + 2); g.lineTo(64, y + 18); g.lineTo(128, y + 2); g.stroke();
    }
    for (const x of [32, 96]) { g.fillStyle = '#e2b24c'; g.beginPath(); g.ellipse(x, 128, 14, 34, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#8a6418'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, 128, 8, 24, 0, 0, Math.PI * 2); g.stroke(); }
  });
}
/** The pommel's end: gold, the violet swirl. */
function pommelFace(): THREE.CanvasTexture {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#d8a94a'; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7c3cff';
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; g.beginPath(); g.arc(64 + Math.cos(a) * 18, 64 + Math.sin(a) * 18, 18, a, a + Math.PI * 1.1); g.arc(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 8, a + Math.PI * 1.1, a + Math.PI * 2.1); g.fill(); }
    g.fillStyle = '#e8d6ff'; g.beginPath(); g.arc(64, 64, 7, 0, Math.PI * 2); g.fill();
  });
}

/** The blade's line (in the weapon's own frame: y along it from the grip, the edge toward +x, the spine −x, as the
 *  game's katana): its middle bows back toward the spine to the tip. */
const BLADE = { y0: 0.072, y1: 0.8, w: 0.042, sori: 0.07 };
const bladeAt = (t: number): { x: number; y: number; hw: number; tipShift: number } => {
  const k = 0.86, s = t > k ? (t - k) / (1 - k) : 0;
  const hw = (BLADE.w / 2) * (1 - 0.18 * t) * (s > 0 ? Math.sqrt(Math.max(0, 1 - s * s)) : 1);
  return { x: -BLADE.sori * t * t, y: BLADE.y0 + (BLADE.y1 - BLADE.y0) * t, hw, tipShift: -0.3 * s * (BLADE.w / 2) };
};

const BLADE_VS = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
const BLADE_FS = `
  uniform float uTime, uEnergy; uniform vec3 uDeep, uCore, uEdge;
  varying vec2 vUv;
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  void main() {
    float u = vUv.x, t = vUv.y;
    float edgeL = smoothstep( 0.7, 0.95, u );                        // the cutting edge, white-hot
    float spine = 1.0 - smoothstep( 0.0, 0.1, u );                   // the spine, fainter
    float ridge = exp( -pow( ( u - 0.42 ) / 0.08, 2.0 ) ) * 0.55;    // the ridge line
    float dens = mix( 0.95, 0.45, t );                               // denser at the guard, softer to the tip
    vec2 g = vec2( u * 5.0, t * 56.0 - uTime * 1.4 ), id = floor( g ), f = fract( g ) - 0.5;
    float h = hash( id ), star = step( 0.8, h ) * smoothstep( 0.2, 0.0, length( f ) ) * ( 0.55 + 0.45 * sin( uTime * 4.0 + h * 40.0 ) );
    float sw = 0.5 + 0.5 * sin( t * 20.0 - uTime * 2.0 + sin( u * 6.0 + uTime ) * 1.4 );  // a slow swirl inside
    vec3 col = mix( uDeep, uCore, 0.45 + 0.45 * sw * uEnergy ) + uCore * star * 2.0 * uEnergy;
    col = mix( col, uEdge, clamp( edgeL * 1.1 + spine * 0.5 + ridge, 0.0, 1.0 ) );
    float a = dens * ( 0.5 + 0.28 * uEnergy ) + edgeL + spine * 0.55 + ridge * 0.45 + star * 0.6 * uEnergy;
    a = clamp( a, 0.0, 1.0 );
    gl_FragColor = vec4( linearToOutputTexel( vec4( min( col, vec3( 1.0 ) ), 1.0 ) ).rgb * a, a );
  }`;
/** A soft glow round a line, turned to the eye wherever it is seen from (the blade's aura, the wisps, the tassel). */
const RIBBON_VS = `
  attribute vec3 aTan; attribute float aSide; attribute float aT; attribute float aW;
  uniform float uWidth;
  varying float vS; varying float vT; varying float vFace;
  void main() {
    vec3 wp = ( modelMatrix * vec4( position, 1.0 ) ).xyz, wt = normalize( mat3( modelMatrix ) * aTan );
    vec3 vd = normalize( cameraPosition - wp ), sd = cross( wt, vd );
    float l = length( sd ); sd = l > 1e-4 ? sd / l : vec3( 0.0, 1.0, 0.0 );
    wp += sd * aSide * uWidth * aW;
    vS = aSide; vT = aT; vFace = smoothstep( 0.1, 0.35, l );
    gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
  }`;
const RIBBON_FS = `
  uniform vec3 uColor; uniform float uAlpha, uSoft, uFall;
  varying float vS; varying float vT; varying float vFace;
  void main() {
    float a = exp( -vS * vS * uSoft ) * uAlpha * pow( 1.0 - vT, uFall ) * smoothstep( 0.0, 0.06, vT + 0.02 ) * vFace;
    gl_FragColor = vec4( linearToOutputTexel( vec4( uColor, 1.0 ) ).rgb * a, a );
  }`;
/** A ribbon along `n` points (filled each frame by its owner): positions, tangents, its sides, its share along. */
function ribbon(n: number, mat: THREE.ShaderMaterial, width: (t: number) => number): { mesh: THREE.Mesh; pos: Float32Array; tan: Float32Array; set(pts: THREE.Vector3[]): void } {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3), tan = new Float32Array(n * 2 * 3), side = new Float32Array(n * 2), at = new Float32Array(n * 2), w = new Float32Array(n * 2), ix: number[] = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); side[i * 2] = -1; side[i * 2 + 1] = 1; at[i * 2] = at[i * 2 + 1] = t; w[i * 2] = w[i * 2 + 1] = width(t); if (i < n - 1) ix.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aTan', new THREE.BufferAttribute(tan, 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1)); g.setAttribute('aT', new THREE.BufferAttribute(at, 1)); g.setAttribute('aW', new THREE.BufferAttribute(w, 1)); g.setIndex(ix);
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false;
  const T = new THREE.Vector3();
  return { mesh, pos, tan, set(pts) {
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; T.subVectors(b, a); if (T.lengthSq() < 1e-12) T.set(0, 1, 0); T.normalize();
      for (const k of [0, 1]) { pos.set([p.x, p.y, p.z], (i * 2 + k) * 3); tan.set([T.x, T.y, T.z], (i * 2 + k) * 3); }
    }
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true; (g.attributes.aTan as THREE.BufferAttribute).needsUpdate = true;
  } };
}
const ribbonMat = (color: number, alpha: number, width: number, soft = 3, fall = 1.4): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha }, uWidth: { value: width }, uSoft: { value: soft }, uFall: { value: fall } },
  vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS, transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide,
});

/** The spirit katana, in the game's katana frame (the grip at 0, the guard just above, the pommel just below the fist).
 *  Its hilt is a one-hand length: the fist covers it, the pommel shows just past the little finger (GPT: fix the grip —
 *  the long hilt ran up the forearm). */
function spiritBlade(U: { uTime: THREE.IUniform; uEnergy: THREE.IUniform }): { root: THREE.Group; halo: THREE.ShaderMaterial; pommel: THREE.Object3D; dispose(): void } {
  const root = new THREE.Group(); root.name = 'spirit-blade';
  const own: { dispose(): void }[] = [];
  // the blade: rows of three (spine, ridge, edge) up to the tip
  const N = 48, P: number[] = [], UV: number[] = [], I: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, b = bladeAt(t);
    for (const [u, s] of [[0, -1], [0.4, -0.2], [1, 1]] as [number, number][]) { P.push(b.x + s * b.hw + b.tipShift * (1 - Math.abs(s)), b.y, 0); UV.push(u, t); }
    if (i < N) for (let j = 0; j < 2; j++) { const a = i * 3 + j; I.push(a, a + 1, a + 3, a + 1, a + 4, a + 3); }
  }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); bg.setIndex(I); bg.computeVertexNormals();
  const bm = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uEnergy: U.uEnergy, uDeep: { value: new THREE.Color(0x4512b0) }, uCore: { value: new THREE.Color(0xa87cff) }, uEdge: { value: new THREE.Color(0xfbf6ff) } },
    vertexShader: BLADE_VS, fragmentShader: BLADE_FS, transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide });
  const blade = new THREE.Mesh(bg, bm); blade.renderOrder = 2; root.add(blade); own.push(bg, bm);
  // its aura: a soft violet glow round the blade's line, seen from any side (its share grows with his level)
  const halo = ribbonMat(0x9a66ff, 0.5, 0.062, 2.0, 0.6);
  const hr = ribbon(24, halo, (t) => (1 - 0.35 * t) * (t > 0.9 ? Math.max(0.15, (1 - t) / 0.1) : 1));
  hr.set(Array.from({ length: 24 }, (_, i) => { const b = bladeAt(i / 23); return new THREE.Vector3(b.x, b.y, 0); }));
  hr.mesh.renderOrder = 3; root.add(hr.mesh); own.push(hr.mesh.geometry, halo);
  // the fittings: gold, a touch of their own light
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a84a, metalness: 0.85, roughness: 0.32, emissive: 0x3a2408, emissiveIntensity: 1 });
  const face = tsubaFace(), faceM = new THREE.MeshStandardMaterial({ map: face, metalness: 0.75, roughness: 0.35, emissive: 0x2a1a06 });
  const ts = new THREE.CylinderGeometry(0.047, 0.047, 0.008, 32); ts.translate(0, 0.057, 0);
  const tsuba = new THREE.Mesh(ts, [gold, faceM, faceM]); root.add(tsuba);
  const hb = new THREE.BoxGeometry(0.046, 0.026, 0.012); hb.translate(-0.002, 0.074, 0); root.add(new THREE.Mesh(hb, gold)); // (the habaki)
  const fu = new THREE.CylinderGeometry(0.021, 0.02, 0.012, 20); fu.translate(0, 0.047, 0); root.add(new THREE.Mesh(fu, gold)); // (the fuchi)
  const wrap = hiltWrap(); wrap.wrapS = wrap.wrapT = THREE.RepeatWrapping;
  const wm = new THREE.MeshStandardMaterial({ map: wrap, roughness: 0.7, metalness: 0.05, emissive: 0x140828 });
  const tk = new THREE.CylinderGeometry(0.0185, 0.0195, 0.125, 18, 1, true); tk.translate(0, -0.021, 0); root.add(new THREE.Mesh(tk, wm)); // (the tsuka: −0.083 … 0.041)
  const ka = new THREE.CylinderGeometry(0.02, 0.021, 0.016, 20); ka.translate(0, -0.091, 0); root.add(new THREE.Mesh(ka, gold)); // (the kashira)
  const pf = pommelFace(), pm = new THREE.MeshStandardMaterial({ map: pf, metalness: 0.6, roughness: 0.35, emissive: 0xffffff, emissiveMap: pf, emissiveIntensity: 0.35 });
  const pc = new THREE.CircleGeometry(0.0195, 24); pc.rotateX(Math.PI / 2); pc.translate(0, -0.0995, 0);
  const pommel = new THREE.Mesh(pc, pm); root.add(pommel);
  for (const m of [tsuba, ...root.children.filter((o) => o !== blade && o !== hr.mesh)]) (m as THREE.Mesh).renderOrder = -2; // (drawn before his body: seen through his fingers)
  own.push(ts, hb, fu, tk, ka, pc, gold, faceM, face, wrap, wm, pf, pm);
  return { root, halo, pommel, dispose: () => own.forEach((o) => o.dispose()) };
}

// ------------------------------------------------------------------------------------------------ the form
/** The wisps' roots, in the order they come with his level: the shoulders, the sash, the coat's tails, the sleeves, the
 *  back (bone, offset in his own frame: x his left, y up, z ahead; the drift's turn). */
const WISPS: { bone: string; at: [number, number, number]; ph: number }[] = [
  { bone: 'upperarm_l', at: [0.05, 0.06, -0.04], ph: 0 }, { bone: 'upperarm_r', at: [-0.05, 0.06, -0.04], ph: 1.3 },
  { bone: 'pelvis', at: [0.03, -0.02, 0.1], ph: 2.1 },
  { bone: 'calf_l', at: [0.05, 0.12, -0.08], ph: 3.4 }, { bone: 'calf_r', at: [-0.05, 0.12, -0.08], ph: 4.2 },
  { bone: 'lowerarm_l', at: [0.03, 0, -0.03], ph: 5.1 }, { bone: 'lowerarm_r', at: [-0.03, 0, -0.03], ph: 0.7 },
  { bone: 'spine_03', at: [0, 0.05, -0.12], ph: 2.8 },
];
const WN = 14;
/** A wisp's length in time (s): its points are where its root was up to this long ago, risen with their age. */
const WAGE = 0.6;

export class SpiritForm {
  private parts: Parts;
  private U: Record<string, THREE.IUniform>;
  private bladeU = { uTime: { value: 0 }, uEnergy: { value: 1 } };
  private pre: THREE.SkinnedMesh | null = null;
  private aura: THREE.Sprite | null = null;
  private blade: ReturnType<typeof spiritBlade> | null = null;
  private wisps: { def: (typeof WISPS)[number]; pts: THREE.Vector3[]; hist: { t: number; x: number; y: number; z: number }[]; r: ReturnType<typeof ribbon>; mat: THREE.ShaderMaterial; warm: boolean }[] = [];
  private tassel: { pts: THREE.Vector3[]; old: THREE.Vector3[]; r: ReturnType<typeof ribbon>; bead: THREE.Mesh } | null = null;
  private floor: { shadow: THREE.Mesh; ripple: THREE.Mesh; rU: Record<string, THREE.IUniform> } | null = null;
  private own: { dispose(): void }[] = [];
  private tier = 0;
  private last = performance.now();
  private t = 0;
  private dead = false;

  constructor(hero: Hero3D, private o: SpiritFormOptions) {
    const P = this.parts = hero as unknown as Parts;
    this.U = {
      uFill: { value: 0 }, uRim: { value: 0 }, uGlow: { value: 0 }, uHair: { value: 0 }, uTime: { value: 0 }, uHairY: { value: 0 }, uNeckY: { value: 0 }, uLit: { value: o.lit ?? 0.14 },
      uDeep: { value: C(0.05, 0.016, 0.17) }, uMid: { value: C(0.3, 0.09, 0.95) }, uHi: { value: C(0.8, 0.7, 1.0) }, uRimC: { value: C(0.86, 0.72, 1.0) },
      uGold: { value: C(1.0, 0.66, 0.26) }, uRed: { value: C(0.62, 0.02, 0.06) }, uWhite: { value: C(0.92, 0.86, 1.0) }, uFlame: { value: C(0.55, 0.22, 1.0) },
    };
    const body = P.body;
    if (body) {
      body.geometry.computeBoundingBox(); const bb = body.geometry.boundingBox!, H = bb.max.y - bb.min.y;
      this.U.uHairY.value = bb.min.y + H * 0.915; this.U.uNeckY.value = bb.min.y + H * 0.8;
      body.material = ghostMaterial(body.material as THREE.MeshStandardMaterial, this.U); this.own.push(body.material as THREE.Material);
      // only his nearest surface: his depth first, drawn before everything of his (his fittings excepted)
      const pm = new THREE.MeshBasicMaterial({ colorWrite: false }); this.own.push(pm);
      const pre = new THREE.SkinnedMesh(body.geometry, pm); pre.bind(body.skeleton, body.bindMatrix);
      pre.frustumCulled = false; pre.renderOrder = -1; pre.userData.worn = true; pre.userData.shadow = true;
      body.parent?.add(pre); this.pre = pre;
      // his aura round him
      const aura = this.aura = auraSprite(); P.scene.add(aura); this.own.push(aura.material, aura.userData.tex as THREE.Texture);
    }
    // his cast shadow (a physical body's) is no longer his: a small soft one and the ripple instead
    for (const m of [P.shadowMat, P.shadowMat2]) if (m) m.visible = false;
    // the spirit blade in the katana's place (the fist refitted round its hilt)
    if (P.weapons.has('katana')) {
      const b = this.blade = spiritBlade(this.bladeU);
      P.swapArm('katana', b.root, 'spirit-blade', 1);
      this.tasselMake();
    }
    for (let i = 0; i < WISPS.length; i++) {
      const mat = ribbonMat(i % 3 === 2 ? 0xc8a4ff : 0xb08cff, 0.32, 0.034, 2.2); this.own.push(mat);
      const r = ribbon(WN, mat, (t) => 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.1)));
      r.mesh.renderOrder = 4; P.scene.add(r.mesh); this.own.push(r.mesh.geometry); // (shown at first: its shader compiled with the rest — each picture then shows the tier's own)
      this.wisps.push({ def: WISPS[i], pts: Array.from({ length: WN }, () => new THREE.Vector3()), hist: [], r, mat, warm: false });
    }
    if (o.ground) this.floorMake();
    this.setLevel(o.level);
    const prev = P.scene.onBeforeRender;
    P.scene.onBeforeRender = (r, s, c, g, m, gr) => { this.cam = (c as THREE.Camera).getWorldPosition(this.camAt); this.step(); prev?.call(P.scene, r, s, c, g, m, gr); };
  }

  /** His level now (a level up: the next tier's light at once). */
  setLevel(level: number): void {
    this.tier = spiritTier(level);
    const T = TIERS[this.tier];
    this.U.uFill.value = T.fill; this.U.uRim.value = T.rim; this.U.uGlow.value = T.glow; this.U.uHair.value = T.hair;
    this.bladeU.uEnergy.value = T.blade;
    if (this.blade) this.blade.halo.uniforms.uAlpha.value = 0.3 + 0.35 * T.blade;
    if (this.floor) this.floor.rU.uStrength.value = T.ripple;
  }

  private tasselMake(): void {
    const mat = ribbonMat(0xc8102e, 0.95, 0.007, 1.2); this.own.push(mat);
    const r = ribbon(6, mat, (t) => 0.6 + 0.6 * t); r.mesh.renderOrder = 3; this.parts.scene.add(r.mesh); this.own.push(r.mesh.geometry);
    const bg = new THREE.SphereGeometry(0.0085, 12, 8), bm = new THREE.MeshStandardMaterial({ color: 0x6a2cff, emissive: 0x7c3cff, emissiveIntensity: 1.2, roughness: 0.3 });
    const bead = new THREE.Mesh(bg, bm); this.parts.scene.add(bead); this.own.push(bg, bm);
    this.tassel = { pts: Array.from({ length: 6 }, () => new THREE.Vector3()), old: Array.from({ length: 6 }, () => new THREE.Vector3()), r, bead };
    this.tasselNew = true;
  }
  private tasselNew = false;

  private floorMake(): void {
    // (drawn among his opaque things, first: the blocks in front still hide them, his own body does not — he is seen
    // over them; blended all the same)
    const sm = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0.3 } }, transparent: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
      fragmentShader: 'uniform float uA; varying vec2 vUv; void main() { float d = length( vUv - 0.5 ) * 2.0; float a = uA * pow( max( 0.0, 1.0 - d ), 1.8 ); gl_FragColor = vec4( vec3( 0.02, 0.0, 0.05 ) * a, a ); }',
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    const rU = { uTime: this.U.uTime, uStrength: { value: 1 } };
    const rm = new THREE.ShaderMaterial({ uniforms: rU, transparent: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
      fragmentShader: `uniform float uTime, uStrength; varying vec2 vUv;
        void main() {
          float d = length( vUv - 0.5 ) * 2.0, a = 0.0;
          for ( int i = 0; i < 3; i++ ) { float r = fract( uTime * 0.28 + float( i ) / 3.0 ); a += exp( -pow( ( d - r ) / 0.035, 2.0 ) ) * ( 1.0 - r ) * 0.55; } // (rings rising out from his feet)
          a += exp( -pow( ( d - 0.22 ) / 0.05, 2.0 ) ) * 0.35;  // (a still ring close round him)
          a *= uStrength * smoothstep( 1.0, 0.85, d ) * 0.8;
          gl_FragColor = vec4( linearToOutputTexel( vec4( 0.62, 0.42, 1.0, 1.0 ) ).rgb * a, a );
        }`,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    const g1 = new THREE.PlaneGeometry(0.7, 0.42), g2 = new THREE.PlaneGeometry(1.25, 0.85);
    g1.rotateX(-Math.PI / 2); g2.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(g1, sm), ripple = new THREE.Mesh(g2, rm);
    shadow.renderOrder = -3; ripple.renderOrder = -3; shadow.frustumCulled = ripple.frustumCulled = false;
    this.parts.scene.add(shadow, ripple); this.own.push(g1, g2, sm, rm);
    this.floor = { shadow, ripple, rU };
  }

  private V = new THREE.Vector3(); private W = new THREE.Vector3(); private Q = new THREE.Quaternion(); private F = new THREE.Vector3();
  private camAt = new THREE.Vector3(); private cam: THREE.Vector3 | null = null;
  /** Each picture: his clock, his wisps, the tassel, the floor marks. */
  private step(): void {
    if (this.dead) return;
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.t += dt; this.U.uTime.value = this.t; this.bladeU.uTime.value = this.t;
    const P = this.parts, preset = Math.max(0, Math.min(2, Math.round(this.o.preset?.() ?? 0)));
    if (this.pre && P.body) this.pre.visible = P.body.visible; // (his depth only where he is drawn)
    const au = this.aura, chest = P.bones.get('spine_03');
    if (au && P.body && chest) { // (behind his chest, a little away from the eye; Low: no aura — the extras go first)
      au.visible = P.body.visible && P.model.visible && preset < 2;
      if (au.visible) {
        chest.getWorldPosition(au.position); const cam = this.cam;
        if (cam) au.position.addScaledVector(this.V.copy(au.position).sub(cam).normalize(), 0.3);
        const h = 1.3 * P.root.scale.y; au.scale.set(h * 1.05, h * 1.55, 1); // (his standing height is the 3D hero's, 1.3)
        (au.material as THREE.SpriteMaterial).opacity = TIERS[this.tier].aura * (preset === 1 ? 0.6 : 1) * (0.9 + 0.1 * Math.sin(this.t * 2.1));
      }
    }
    P.root.getWorldQuaternion(this.Q); const fwd = this.F.set(0, 0, 1).applyQuaternion(this.Q);
    // the wisps: the tier's count (half on Medium, none on Low), each a chain rising and trailing from its root
    const n = preset === 2 ? 0 : preset === 1 ? Math.ceil(TIERS[this.tier].wisps / 2) : TIERS[this.tier].wisps;
    const k = P.model.scale.x;
    this.wisps.forEach((w, i) => {
      const on = i < n && !!P.body?.visible && P.model.visible; w.r.mesh.visible = on; if (!on) { w.warm = false; return; }
      const b = P.bones.get(w.def.bone); if (!b) { w.r.mesh.visible = false; return; }
      const head = b.getWorldPosition(this.V).add(this.W.set(w.def.at[0] * k, w.def.at[1] * k, w.def.at[2] * k).applyQuaternion(this.Q));
      if (!w.warm) { w.hist.length = 0; w.warm = true; }
      w.hist.push({ t: this.t, x: head.x, y: head.y, z: head.z }); while (w.hist.length > 2 && w.hist[1].t < this.t - WAGE) w.hist.shift();
      const H = w.hist;
      for (let j = 0, h = H.length - 1; j < WN; j++) {
        const age = (j / (WN - 1)) * WAGE, at = this.t - age;
        while (h > 0 && H[h].t > at) h--;
        const a = H[h], c = H[Math.min(H.length - 1, h + 1)], f = c.t > a.t ? Math.max(0, Math.min(1, (at - a.t) / (c.t - a.t))) : 0;
        const sway = Math.sin(this.t * 1.7 + w.def.ph - age * 5) * age * 0.07;
        w.pts[j].set(a.x + (c.x - a.x) * f + sway - fwd.x * age * 0.06, a.y + (c.y - a.y) * f + age * 0.42, a.z + (c.z - a.z) * f - fwd.z * age * 0.06); // (risen, swaying, drifting back off him)
      }
      const pts = w.pts;
      w.mat.uniforms.uAlpha.value = (0.24 + 0.07 * this.tier) * (preset === 1 ? 0.8 : 1);
      w.r.set(pts);
    });
    // the tassel: a short cord hanging from the pommel, swinging (a chain with its own weight)
    const ts = this.tassel, bl = this.blade;
    if (ts && bl) {
      const shown = (() => { for (let p: THREE.Object3D | null = bl.root; p; p = p.parent) if (!p.visible) return false; return true; })();
      ts.r.mesh.visible = shown; ts.bead.visible = shown;
      if (shown) {
        const top = bl.pommel.getWorldPosition(this.V).clone(), seg = 0.018 * k / 0.72;
        if (this.tasselNew) { ts.pts.forEach((p, j) => p.copy(top).add(new THREE.Vector3(0, -seg * j, 0))); ts.old.forEach((p, j) => p.copy(ts.pts[j])); this.tasselNew = false; }
        ts.pts[0].copy(top); ts.old[0].copy(top);
        for (let j = 1; j < ts.pts.length; j++) { const p = ts.pts[j], v = p.clone().sub(ts.old[j]).multiplyScalar(0.9); ts.old[j].copy(p); p.add(v); p.y -= 9.8 * dt * dt; }
        for (let it = 0; it < 3; it++) for (let j = 1; j < ts.pts.length; j++) { const a = ts.pts[j - 1], b = ts.pts[j], d = b.clone().sub(a), L = d.length() || 1e-6; b.copy(a).addScaledVector(d, seg / L); }
        ts.r.set(ts.pts); ts.bead.position.copy(ts.pts[1]); ts.bead.scale.setScalar(k / 0.72);
      }
    }
    // the floor marks under him: the contact shadow fading as he rises, the ripple
    const fl = this.floor;
    if (fl && this.o.ground) {
      const gy = this.o.ground(), r = P.root.position, up = Math.max(0, r.y - gy), on = P.model.visible;
      fl.shadow.visible = fl.ripple.visible = on;
      fl.shadow.position.set(r.x, gy + 0.006, r.z); fl.ripple.position.set(r.x, gy + 0.007, r.z);
      (fl.shadow.material as THREE.ShaderMaterial).uniforms.uA.value = 0.32 * Math.max(0, 1 - up / 1.2);
      const s = 1 - Math.min(0.5, up / 2.4); fl.shadow.scale.setScalar(s);
      fl.rU.uStrength.value = TIERS[this.tier].ripple * Math.max(0, 1 - up / 0.9);
    }
  }

  dispose(): void {
    if (this.dead) return; this.dead = true;
    this.pre?.removeFromParent(); this.aura?.removeFromParent(); this.blade?.dispose();
    for (const w of this.wisps) w.r.mesh.removeFromParent();
    this.tassel?.r.mesh.removeFromParent(); this.tassel?.bead.removeFromParent();
    this.floor?.shadow.removeFromParent(); this.floor?.ripple.removeFromParent();
    for (const o of this.own) o.dispose();
  }
}

/** The Spectral Samurai as a spirit (the world, the select, the inventory): see SpiritForm. */
export function makeSpiritForm(hero: Hero3D, o: SpiritFormOptions): SpiritForm { return new SpiritForm(hero, o); }
