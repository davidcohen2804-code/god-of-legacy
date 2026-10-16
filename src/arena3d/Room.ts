// PVP 3D: the temple courtyard as a real 3D scene — every piece modelled (no painted cut-outs): a raised plank floor
// with a stone curb, the stone paving round it, the temple behind it (a stone platform, a stair between stone cheeks
// with lacquered rails, a colonnade of red pillars, glowing lattice doors, beams, brackets, rafters and a curved tiled
// roof), covered corridors either side, stone lanterns (kasuga-dōrō) lit from inside, old cherry trees with real
// branches and blossom that sways in the wind, petals falling from them and settling on the floor, a waist-high
// railing in front; a dusk sun with soft shadows, lantern and door light, fog and a sky. Only the fighters stay drawn.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Parts, box, cyl, lathe, taperTube, worldUV, rng, canvasTex, noiseCanvas, petalCanvas, glowCanvas, shadowCanvas } from './RoomKit';

/** The fighting floor in room units (x across, z toward the camera). */
export interface RoomFloor { x0: number; x1: number; zB: number; zF: number }

export interface Room {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Lights that keep burning when the room darkens (lanterns, the temple's doors). */
  warm: THREE.PointLight[];
  /** Height of the walkable surface at (x, z) (the deck, the ground). */
  groundY(x: number, z: number): number;
  /** A blow at (x, y, z): petals (falling and lying) within R are thrown away from it. */
  blow(x: number, y: number, z: number, R: number, strength: number): void;
  /** Each frame (ms since the last, the time in s); `dim` 0..1 darkens the sky. */
  update(ms: number, t: number, dim: number): void;
  /** Shadows to redraw (after the textures load). */
  shadowsDirty(): void;
  dispose(): void;
}

const A = 'assets/arena3d/temple/';
/** The courtyard ground's height (the deck's top is 0). */
const G = -0.25;

export function buildRoom(scene: THREE.Scene, front: THREE.Scene, renderer: THREE.WebGLRenderer, F: RoomFloor, soft: boolean): Room {
  const R = rng(20261017);
  const loader = new THREE.TextureLoader(), aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const disposables: { dispose(): void }[] = [];
  let shadowDirty = true;
  const tex = (file: string, colour = true): THREE.Texture => {
    const t = loader.load(file, () => { shadowDirty = true; });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; if (colour) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    disposables.push(t); return t;
  };

  // ------------------------------------------------------------------ light, sky, air
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const pmrem = new THREE.PMREMGenerator(renderer); const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
  scene.environment = envTex; (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.32; disposables.push(envTex);
  front.environment = envTex; (front as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.32;
  scene.background = new THREE.Color(0x5a3f5a);
  scene.fog = new THREE.Fog(0x8d6274, 22, 75);

  const cx = (F.x0 + F.x1) / 2, W = F.x1 - F.x0;
  const deck = { x0: F.x0 - 0.6, x1: F.x1 + 0.6, z0: F.zB - 0.35, z1: F.zF + 0.35 };
  const zMid = (deck.z0 + deck.z1) / 2;

  const sun = new THREE.DirectionalLight(0xffb784, 3.0);
  sun.position.set(cx - 10, 12, deck.z0 - 7); sun.target.position.set(cx, 0, zMid);
  sun.castShadow = true; sun.shadow.mapSize.set(soft ? 1024 : 2048, soft ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -W / 2 - 10; sc.right = W / 2 + 10; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 60;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffd8c4, 0x3c2733, 0.9); scene.add(hemi);
  // the front scene (the railing over the fighters) takes the same light
  const sunF = new THREE.DirectionalLight(0xffb784, 3.0); sunF.position.copy(sun.position); sunF.target.position.copy(sun.target.position); front.add(sunF, sunF.target);
  const hemiF = new THREE.HemisphereLight(0xffd8c4, 0x3c2733, 0.9); front.add(hemiF);

  // the sky: a dome from gold at the horizon through rose to violet, with a slow band of cloud
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(0x2e2348) }, uMid: { value: new THREE.Color(0xb05e78) }, uLow: { value: new THREE.Color(0xf4ae6c) }, uDim: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; uniform float uDim; uniform float uTime; varying vec3 vP;\n'
      + 'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n'
      + 'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }\n'
      + 'void main(){ float y = clamp(vP.y, -0.2, 1.0); vec3 c = y < 0.12 ? mix(uLow * 1.08, uMid, smoothstep(-0.05, 0.12, y)) : mix(uMid, uTop, smoothstep(0.12, 0.62, y));\n'
      + ' vec2 q = vec2(atan(vP.x, vP.z) * 3.0 + uTime * 0.004, y * 9.0); float cl = n(q * vec2(2.0, 1.0)) * 0.6 + n(q * 4.1) * 0.4; cl = smoothstep(0.55, 0.85, cl) * smoothstep(0.02, 0.18, y) * (1.0 - smoothstep(0.3, 0.55, y));\n'
      + ' c = mix(c, vec3(1.0, 0.72, 0.6), cl * 0.45); gl_FragColor = vec4(c * (1.0 - uDim * 0.55), 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), skyMat); sky.position.set(cx, 0, zMid); scene.add(sky);
  disposables.push(sky.geometry, skyMat);
  const skyPano = new THREE.MeshBasicMaterial({ map: tex(A + 'sky.webp'), side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false, color: 0xd8d0d8 }); disposables.push(skyPano);
  { const arc = 2.4, r = 125, g = new THREE.CylinderGeometry(r, r, (r * arc) / 3, 48, 1, true, Math.PI - arc / 2, arc); const m = new THREE.Mesh(g, skyPano); m.position.set(cx, (r * arc) / 6 - 14, zMid); m.renderOrder = -1; scene.add(m); disposables.push(g); }

  // ------------------------------------------------------------------ materials
  const std = (o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial(o); disposables.push(m); return m; };
  const ropeTex = canvasTex(noiseCanvas(128, [214, 178, 106], 0.35, 3, 16)); disposables.push(ropeTex);
  const M: Record<string, THREE.Material> = {
    stone: std({ map: tex(A + 'stone.webp'), normalMap: tex(A + 'stone_n.webp', false), normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.94, color: 0xe6e0d6 }),
    stoneDark: std({ map: tex(A + 'stone.webp'), normalMap: tex(A + 'stone_n.webp', false), roughness: 0.95, color: 0xb4aca2 }),
    lacquer: std({ map: tex(A + 'lacquer.webp'), normalMap: tex(A + 'lacquer_n.webp', false), normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.34, color: 0xf2f2f2 }),
    wood: std({ map: tex(A + 'lacquer.webp'), roughness: 0.55, color: 0x4a3a34, side: THREE.DoubleSide }),
    gold: std({ color: 0xe0ab4c, metalness: 1, roughness: 0.3 }),
    plaster: std({ map: tex(A + 'plaster.webp'), roughness: 0.96, color: 0xf4eee6 }),
    roof: std({ map: tex(A + 'roof.webp'), normalMap: tex(A + 'roof_n.webp', false), normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.5, metalness: 0.15, color: 0xd2d6de, side: THREE.DoubleSide }),
    door: std({ map: tex(A + 'door.webp'), emissiveMap: tex(A + 'door_glow.webp'), emissive: 0xffa850, emissiveIntensity: 1.5, roughness: 0.6 }),
    window: std({ map: tex(A + 'door.webp'), emissiveMap: tex(A + 'door_glow.webp'), emissive: 0xffa850, emissiveIntensity: 1.1, roughness: 0.6 }),
    paper: std({ color: 0xd8442c, emissive: 0xff6a2a, emissiveIntensity: 1.6, roughness: 0.8 }),
    lamp: std({ color: 0xffc27a, emissive: 0xff9038, emissiveIntensity: 1.5, roughness: 0.7 }),
    rope: std({ map: ropeTex, roughness: 0.95 }),
    shide: std({ color: 0xf6f2ea, roughness: 0.9, side: THREE.DoubleSide }),
    bark: std({ map: tex(A + 'bark.webp'), normalMap: tex(A + 'bark_n.webp', false), normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.95, color: 0xd8d0cc }),
    deck: std({ map: tex(A + 'planks.webp'), normalMap: tex(A + 'planks_n.webp', false), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.5, metalness: 0.03, color: 0xf0e4dc }),
    stoneClean: std({ map: tex(A + 'stone_clean.webp'), normalMap: tex(A + 'stone_n.webp', false), normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92, color: 0xe2dcd2 }),
  };
  // the window panels show only the lattice half of the door painting
  (M.window as THREE.MeshStandardMaterial).map = (M.door as THREE.MeshStandardMaterial).map;

  const P = new Parts(), PF = new Parts();

  // ------------------------------------------------------------------ the ground and the fighting floor
  const groundTex = tex(A + 'paving.webp'), groundN = tex(A + 'paving_n.webp', false);
  groundTex.repeat.set(90 / 3.6, 72 / 3.6); groundN.repeat.set(90 / 3.6, 72 / 3.6);
  const groundMat = std({ map: groundTex, normalMap: groundN, normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.9, color: 0xf2eae4 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 72), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, G, zMid - 8); ground.receiveShadow = true; scene.add(ground); disposables.push(ground.geometry);
  // the deck: planks on top, its edge a dark beam, a stone curb round it at the ground
  {
    const w = deck.x1 - deck.x0, d = deck.z1 - deck.z0, g = new THREE.BoxGeometry(w, -G, d);
    g.translate((deck.x0 + deck.x1) / 2, G / 2, (deck.z0 + deck.z1) / 2); worldUV(g, 2.6);
    const m = new THREE.Mesh(g, M.deck); m.receiveShadow = true; m.castShadow = true; scene.add(m); disposables.push(g);
    const cw = 0.28, ch = 0.1;
    P.add('stone', box(w + cw * 2, ch, cw, (deck.x0 + deck.x1) / 2, G, deck.z0 - cw / 2, 1, 0.03), box(w + cw * 2, ch, cw, (deck.x0 + deck.x1) / 2, G, deck.z1 + cw / 2, 1, 0.03),
      box(cw, ch, d, deck.x0 - cw / 2, G, (deck.z0 + deck.z1) / 2, 1, 0.03), box(cw, ch, d, deck.x1 + cw / 2, G, (deck.z0 + deck.z1) / 2, 1, 0.03));
    for (const x of [deck.x0, deck.x1]) for (const z of [deck.z0, deck.z1]) P.add('gold', box(0.16, 0.05, 0.16, x, -0.03, z, 1, 0.02)); // (gilt corner plates)
  }

  // ------------------------------------------------------------------ the temple
  const TW = THREE.MathUtils.clamp(W * 0.78, 12, 17), TD = 6.4, PH = 1.15, yT = G + PH;
  const NS = 7, rise = PH / NS, tread = 0.27, SW = 4.2;
  const zP = deck.z0 - 0.2 - NS * tread;           // the platform's front face (the stair runs from it to the deck)
  const zC = zP - 0.45, zWall = zP - 1.6;           // the colonnade, the hall's front wall
  // the platform and its coping
  P.add('stoneDark', box(TW, PH, TD, cx, G, zP - TD / 2, 1.3));
  P.add('stoneClean', box(TW + 0.18, 0.1, TD + 0.18, cx, yT - 0.1, zP - TD / 2, 1.3, 0.03));
  // the stair, step by step, and its stone cheeks
  for (let k = 1; k <= NS; k++) P.add('stoneClean', box(SW, k * rise, (NS - k + 1) * tread, cx, G, zP + (NS - k + 1) * tread / 2, 1.1, 0.02));
  const cheekShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(NS * tread + 0.14, 0), new THREE.Vector2(NS * tread + 0.14, 0.44), new THREE.Vector2(0.02, PH + 0.44), new THREE.Vector2(-0.3, PH + 0.44), new THREE.Vector2(-0.3, 0)]);
  for (const side of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(cheekShape, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1 });
    g.rotateY(-Math.PI / 2); g.translate(cx + side * (SW / 2 + 0.19) + 0.19, G, zP); worldUV(g, 1.1); P.add('stone', g);
    // the stair's lacquered rail: a post at each end with a gilt cap, the rail along the slope
    const xR = cx + side * (SW / 2 + 0.19), zLo = zP + NS * tread + 0.02, yLo = G + 0.44, zHi = zP + 0.06, yHi = yT + 0.44;
    P.add('lacquer', cyl(0.07, 0.065, 0.62, xR, yLo, zLo, 12, 0.5), cyl(0.07, 0.065, 0.62, xR, yHi, zHi, 12, 0.5));
    P.add('gold', ...[[zLo, yLo], [zHi, yHi]].map(([z, y]) => lathe([[0, 0], [0.085, 0], [0.1, 0.06], [0.085, 0.13], [0.035, 0.2], [0.016, 0.27], [0, 0.29]], xR, y + 0.62, z, 14)));
    P.add('lacquer', taperTube(new THREE.LineCurve3(new THREE.Vector3(xR, yLo + 0.56, zLo), new THREE.Vector3(xR, yHi + 0.56, zHi)), 0.045, 0.045, 2, 10, 0.5));
    P.add('lacquer', taperTube(new THREE.LineCurve3(new THREE.Vector3(xR, yLo + 0.3, zLo), new THREE.Vector3(xR, yHi + 0.3, zHi)), 0.03, 0.03, 2, 8, 0.5));
    // the balustrade along the platform's edge, from the stair to the corner
    const xs: number[] = []; const xa = cx + side * (SW / 2 + 0.45), xb = cx + side * (TW / 2 - 0.12);
    const n = Math.max(2, Math.round(Math.abs(xb - xa) / 1.05)); for (let i = 0; i <= n; i++) xs.push(xa + (xb - xa) * (i / n));
    P.addAt('lacquer', cyl(0.06, 0.055, 0.5, 0, 0, 0, 10, 0.5), xs.map((x) => [x, yT, zP + 0.1]));
    P.addAt('gold', lathe([[0, 0], [0.07, 0], [0.085, 0.05], [0.07, 0.11], [0.03, 0.17], [0.012, 0.22], [0, 0.24]], 0, 0, 0, 12), [[xa, yT + 0.5, zP + 0.1], [xb, yT + 0.5, zP + 0.1]]);
    P.add('lacquer', box(Math.abs(xb - xa), 0.07, 0.07, (xa + xb) / 2, yT + 0.43, zP + 0.1, 0.5, 0.02), box(Math.abs(xb - xa), 0.05, 0.05, (xa + xb) / 2, yT + 0.2, zP + 0.1, 0.5, 0.015));
  }
  // the colonnade (red pillars on stone bases, gilt rings) and the hall's front wall behind it
  const NP = 8, px: number[] = []; for (let i = 0; i < NP; i++) px.push(cx - TW / 2 + 0.5 + i * (TW - 1) / (NP - 1));
  const PHt = 2.95, bay = (TW - 1) / (NP - 1);
  for (const z of [zC, zWall]) for (const x of px) {
    P.add('stone', lathe([[0, 0], [0.3, 0], [0.3, 0.06], [0.24, 0.11], [0.21, 0.17], [0, 0.17]], x, yT, z, 16));
    P.add('lacquer', cyl(0.175, 0.16, PHt, x, yT + 0.17, z, 18, 0.55));
    P.add('gold', cyl(0.185, 0.185, 0.05, x, yT + 0.17, z, 18), cyl(0.17, 0.17, 0.05, x, yT + 0.17 + PHt - 0.32, z, 18));
  }
  for (let i = 0; i < NP - 1; i++) {
    const x = (px[i] + px[i + 1]) / 2, w = bay - 0.36;
    const doorBay = i >= 2 && i <= 4;
    if (doorBay) { // the great doors (the painting is the pair of them), a lintel and a plaster transom above
      const g = new THREE.PlaneGeometry(w, 2.45); g.translate(x, yT + 0.12 + 1.225, zWall + 0.03); P.add('door', g);
      P.add('wood', box(w + 0.1, 0.14, 0.16, x, yT + 2.57, zWall + 0.02, 0.6, 0.02));
      P.add('plaster', box(w, PHt - 2.55, 0.12, x, yT + 2.71, zWall, 1.6));
      P.add('wood', box(w + 0.06, 0.1, 0.14, x, yT + 0.08, zWall + 0.02, 0.6, 0.02)); // (the threshold)
    } else { // a plaster wall below, a lattice window lit from inside, plaster above
      P.add('plaster', box(w, 0.95, 0.14, x, yT + 0.08, zWall, 1.6));
      P.add('wood', box(w + 0.04, 0.1, 0.18, x, yT + 1.0, zWall + 0.01, 0.6, 0.02), box(w + 0.04, 0.1, 0.18, x, yT + 2.25, zWall + 0.01, 0.6, 0.02));
      const g = new THREE.PlaneGeometry(w, 1.18); const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, 0.06 + uv.getX(k) * 0.4, 0.42 + uv.getY(k) * 0.5); // (one leaf's lattice)
      g.translate(x, yT + 1.1 + 0.59, zWall + 0.02); P.add('window', g);
      P.add('plaster', box(w, PHt - 2.35, 0.12, x, yT + 2.35, zWall, 1.6));
    }
  }
  // the beams over the colonnade, the frieze with gilt medallions, the tie beams back to the wall
  const yB = yT + 0.17 + PHt;
  P.add('lacquer', box(TW - 0.5, 0.24, 0.26, cx, yB - 0.24, zC, 0.6, 0.02));
  P.add('wood', box(TW - 0.3, 0.32, 0.22, cx, yB, zC - 0.04, 0.6, 0.02));
  for (let i = 0; i < NP - 1; i++) { const g = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16); g.rotateX(Math.PI / 2); g.translate((px[i] + px[i + 1]) / 2, yB + 0.16, zC + 0.08); P.add('gold', g); }
  for (const x of px) { P.add('lacquer', box(0.2, 0.22, zC - zWall, x, yB - 0.24, (zC + zWall) / 2, 0.6)); }
  // brackets (stacked blocks widening upward) over each pillar and between them, gilt tips
  const bracket = (x: number, k: number) => {
    let y = yB + 0.32;
    for (const [w, d] of [[0.36, 0.36], [0.56, 0.48], [0.82, 0.6]]) { P.add('wood', box(w * k, 0.12, d, x, y, zC + 0.02, 0.5, 0.015)); P.add('gold', box(0.08, 0.08, 0.04, x - (w * k) / 2 + 0.04, y + 0.02, zC + d / 2 + 0.03), box(0.08, 0.08, 0.04, x + (w * k) / 2 - 0.04, y + 0.02, zC + d / 2 + 0.03)); y += 0.13; }
  };
  for (const x of px) bracket(x, 1);
  for (let i = 0; i < NP - 1; i++) bracket((px[i] + px[i + 1]) / 2, 0.7);
  // the eaves: a run of rafters with gilt end caps, the fascia
  const yE = yB + 0.75, zE = zC + 1.05, eHalf = TW / 2 + 1.45, sori = 0.5;
  const eaveY = (x: number) => yE + sori * Math.pow(Math.min(1, Math.abs(x - cx) / eHalf), 3);
  for (let x = cx - eHalf + 0.15; x <= cx + eHalf - 0.15; x += 0.24) {
    const y = eaveY(x) - 0.14, g = new THREE.BoxGeometry(0.075, 0.075, 1.4); g.rotateX(-0.12); g.translate(x, y, zE - 0.62); worldUV(g, 0.5); P.add('wood', g);
    P.add('gold', box(0.08, 0.08, 0.03, x, y - 0.12 - 0.04, zE + 0.07));
  }
  const eavePts: THREE.Vector3[] = []; for (let i = 0; i <= 40; i++) { const x = cx - eHalf + (2 * eHalf * i) / 40; eavePts.push(new THREE.Vector3(x, eaveY(x) - 0.02, zE)); }
  P.add('wood', taperTube(new THREE.CatmullRomCurve3(eavePts), 0.09, 0.09, 60, 8, 0.6));
  P.add('gold', taperTube(new THREE.CatmullRomCurve3(eavePts.map((p) => p.clone().add(new THREE.Vector3(0, -0.11, 0.03)))), 0.025, 0.025, 60, 6, 0.6));
  // the roof: a curved slope (flat at the eaves, steep near the ridge; the corners swept up), its hipped sides, the ridge
  const yR = yT + 7.2, zR = zP - TD / 2, rHalf = TW / 2 - 1.6, zEb = zP - TD - 1.05;
  const roofSurf = (fn: (u: number, v: number) => THREE.Vector3, nu: number, nv: number, o: { wind?: boolean; uz?: boolean } = {}) => {
    const g = new THREE.BufferGeometry(), pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = fn(i / nu, j / nv); pos.push(p.x, p.y, p.z); }
    // UVs: across by x (or z on the sides), up by the length run along the slope
    for (let i = 0; i <= nu; i++) { let len = 0; for (let j = 0; j <= nv; j++) { const k = j * (nu + 1) + i; if (j > 0) { const q = (j - 1) * (nu + 1) + i; len += Math.hypot(pos[k * 3] - pos[q * 3], pos[k * 3 + 1] - pos[q * 3 + 1], pos[k * 3 + 2] - pos[q * 3 + 2]); } uv[k * 2] = (o.uz ? pos[k * 3 + 2] : pos[k * 3]) / 1.25; uv[k * 2 + 1] = len / 1.25; } }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + nu + 1; if (o.wind) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const prof = (v: number) => Math.pow(v, 1.7);
  P.add('roof', roofSurf((u, v) => { const half = eHalf + (rHalf - eHalf) * Math.pow(v, 0.9), s = 2 * u - 1, x = cx + s * half; const lift = sori * Math.pow(Math.abs(s), 3) * (1 - v) * (1 - v); return new THREE.Vector3(x, yE + (yR - yE) * prof(v) + lift, zE + (zR - zE) * v); }, 48, 18, { wind: true }));
  // the eaves' underside: dark boards over the rafters (seen from below the eave line)
  P.add('wood', roofSurf((u, v) => { const vv = v * 0.32, half = eHalf + (rHalf - eHalf) * Math.pow(vv, 0.9), s = 2 * u - 1; const lift = sori * Math.pow(Math.abs(s), 3) * (1 - vv) * (1 - vv); return new THREE.Vector3(cx + s * half, yE + (yR - yE) * prof(vv) + lift - 0.12, zE + (zR - zE) * vv); }, 48, 4));
  for (const side of [-1, 1]) {
    P.add('roof', roofSurf((u, v) => { const zEdge = zE + (zEb - zE) * u, x0e = cx + side * eHalf, zr = zR + (u - 0.5) * 0.4; const x = x0e + (cx + side * rHalf - x0e) * Math.pow(v, 0.9); const lift = sori * (1 - v) * (1 - v) * (1 - Math.sin(Math.PI * u) * 0.8); return new THREE.Vector3(x, yE + (yR - yE) * prof(v) + lift, zEdge + (zr - zEdge) * v); }, 16, 18, { wind: side > 0, uz: true }));
  }
  P.add('roof', box(2 * rHalf + 0.6, 0.34, 0.42, cx, yR - 0.1, zR, 1, 0.05));
  P.add('gold', box(2 * rHalf + 0.7, 0.06, 0.46, cx, yR + 0.22, zR, 1, 0.02));
  for (const side of [-1, 1]) { // the ridge's gilt ornaments, swept up like fins
    const b = new THREE.Vector3(cx + side * (rHalf + 0.2), yR + 0.2, zR);
    P.add('gold', taperTube(new THREE.CatmullRomCurve3([b, b.clone().add(new THREE.Vector3(side * 0.12, 0.35, 0)), b.clone().add(new THREE.Vector3(side * 0.02, 0.7, 0)), b.clone().add(new THREE.Vector3(-side * 0.18, 0.85, 0))]), 0.13, 0.03, 12, 10));
  }
  // paper lanterns under the eaves, a rope with paper streamers across the middle bay
  const lanternsUnder = [px[1] + bay / 2, px[2] + bay / 2, px[4] + bay / 2, px[5] + bay / 2];
  for (const x of lanternsUnder) {
    P.add('paper', lathe([[0.0, 0], [0.12, 0.0], [0.2, 0.08], [0.22, 0.22], [0.2, 0.38], [0.12, 0.46], [0, 0.46]], x, yB - 0.92, zC + 0.15, 16));
    P.add('wood', cyl(0.13, 0.13, 0.05, x, yB - 0.95, zC + 0.15, 12), cyl(0.13, 0.13, 0.05, x, yB - 0.47, zC + 0.15, 12), cyl(0.012, 0.012, 0.38, x, yB - 0.42, zC + 0.15, 6));
  }
  {
    const a = px[3], b = px[4], y = yB - 0.45, pts = [0, 0.25, 0.5, 0.75, 1].map((t) => new THREE.Vector3(a + (b - a) * t, y - Math.sin(Math.PI * t) * 0.32, zC + 0.2));
    P.add('rope', taperTube(new THREE.CatmullRomCurve3(pts), 0.085, 0.085, 24, 10, 0.25));
    for (const t of [0.22, 0.4, 0.6, 0.78]) { const p = new THREE.CatmullRomCurve3(pts).getPointAt(t); const g = new THREE.PlaneGeometry(0.1, 0.36); g.translate(p.x, p.y - 0.24, p.z + 0.02); P.add('shide', g); }
  }

  // ------------------------------------------------------------------ the covered corridors either side of the temple
  for (const side of [-1, 1]) {
    const xa = cx + side * (TW / 2 + 0.1), xb = cx + side * (TW / 2 + 12), xm = (xa + xb) / 2, len = Math.abs(xb - xa);
    const zf = zP - 0.5, zb = zP - 2.4, base = G + 0.3;
    P.add('stoneDark', box(len, 0.3, zf - zb + 0.4, xm, G, (zf + zb) / 2, 1.3));
    const n = Math.round(len / 1.5), xs: number[] = []; for (let i = 0; i <= n; i++) xs.push(xa + (xb - xa) * (i / n));
    P.addAt('lacquer', cyl(0.11, 0.1, 2.25, 0, 0, 0, 12, 0.5), xs.map((x) => [x, base, zf]));
    P.add('lacquer', box(len, 0.18, 0.2, xm, base + 2.1, zf, 0.6, 0.02));
    P.add('plaster', box(len, 2.3, 0.14, xm, base, zb, 1.6));
    for (let i = 0; i < n; i += 2) { const x = (xs[i] + xs[i + 1]) / 2, g = new THREE.PlaneGeometry(1.0, 0.9); const uv = g.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < uv.count; k++) uv.setXY(k, 0.06 + uv.getX(k) * 0.4, 0.42 + uv.getY(k) * 0.5); g.translate(x, base + 1.2, zb + 0.08); P.add('window', g); }
    P.add('wood', box(len, 0.1, 0.18, xm, base + 0.7, zb + 0.02, 0.6));
    P.add('roof', roofSurf((u, v) => new THREE.Vector3(xa + (xb - xa) * u, base + 2.35 + v * 1.0, zf + 0.75 + (zb - 0.2 - (zf + 0.75)) * v), 24, 4, { wind: side > 0 }));
    P.add('roof', box(len, 0.2, 0.3, xm, base + 3.3, zb - 0.2, 1, 0.03));
  }

  // ------------------------------------------------------------------ the stone lanterns (kasuga-dōrō)
  const lanternAt: [number, number, number][] = [];
  for (const x of [deck.x0 - 1.1, deck.x1 + 1.1]) for (const z of [deck.z0 + 0.35, zMid, deck.z1 - 0.35]) lanternAt.push([x, G, z]);
  for (const s of [-1, 1]) lanternAt.push([cx + s * (SW / 2 + 1.15), G, zP + 1.15]);
  const stoneLantern: THREE.BufferGeometry[] = [
    lathe([[0, 0], [0.36, 0], [0.36, 0.1], [0.28, 0.16], [0.25, 0.22], [0, 0.22]], 0, 0, 0, 6),
    cyl(0.105, 0.088, 0.74, 0, 0.22, 0, 14), cyl(0.118, 0.118, 0.05, 0, 0.55, 0, 14),
    lathe([[0, 0], [0.13, 0], [0.27, 0.08], [0.29, 0.14], [0.21, 0.19], [0, 0.19]], 0, 0.96, 0, 6),
  ];
  // the fire box: six stone posts round the lit paper
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; stoneLantern.push(box(0.07, 0.36, 0.07, Math.cos(a) * 0.19, 1.15, Math.sin(a) * 0.19, 0.4)); }
  stoneLantern.push(lathe([[0, 0], [0.24, 0], [0.24, 0.035], [0, 0.035]], 0, 1.13, 0, 6));
  stoneLantern.push(lathe([[0, -0.02], [0.37, -0.02], [0.42, 0.0], [0.4, 0.06], [0.31, 0.13], [0.08, 0.34], [0, 0.37]], 0, 1.53, 0, 6));
  stoneLantern.push(lathe([[0, 0], [0.07, 0], [0.09, 0.035], [0.105, 0.09], [0.085, 0.15], [0.035, 0.21], [0, 0.24]], 0, 1.89, 0, 14));
  for (const g of stoneLantern) { g.computeVertexNormals(); }
  for (const [x, y, z] of lanternAt) for (const g of stoneLantern) { const c = g.clone(); c.translate(x, y, z); worldUV(c, 0.7); P.add('stone', c); }
  P.addAt('lamp', new THREE.CylinderGeometry(0.15, 0.15, 0.32, 6, 1), lanternAt.map(([x, y, z]) => [x, y + 1.33, z]));
  for (const g of stoneLantern) g.dispose();

  // ------------------------------------------------------------------ the railing in front (over the fighters)
  {
    const zr = deck.z1 + 0.85, xa = deck.x0 - 3, xb = deck.x1 + 3, n = Math.round((xb - xa) / 1.3), xs: number[] = [];
    for (let i = 0; i <= n; i++) xs.push(xa + (xb - xa) * (i / n));
    PF.addAt('lacquer', cyl(0.06, 0.055, 0.86, 0, 0, 0, 12, 0.5), xs.map((x) => [x, G, zr]));
    PF.addAt('gold', lathe([[0, 0], [0.075, 0], [0.09, 0.05], [0.075, 0.11], [0.03, 0.17], [0.012, 0.22], [0, 0.24]], 0, 0, 0, 12), xs.map((x) => [x, G + 0.86, zr]));
    PF.add('lacquer', box(xb - xa, 0.08, 0.08, (xa + xb) / 2, G + 0.74, zr, 0.5, 0.02), box(xb - xa, 0.06, 0.06, (xa + xb) / 2, G + 0.38, zr, 0.5, 0.02));
    PF.add('stone', box(xb - xa + 0.5, 0.12, 0.3, (xa + xb) / 2, G, zr, 1, 0.03));
  }

  // ------------------------------------------------------------------ the far scenery: a pagoda and the hills in the haze
  {
    const bx = cx - TW / 2 - 9, bz = zP - 26; let y = G, w = 3.2;
    for (let k = 0; k < 5; k++) {
      P.add('lacquer', box(w * 0.62, 1.15, w * 0.62, bx, y, bz, 0.8));
      const r = new THREE.ConeGeometry(w * 0.82, 0.75, 4, 1, true); r.rotateY(Math.PI / 4); r.translate(bx, y + 1.15 + 0.3, bz); worldUV(r, 1.25); P.add('roof', r);
      y += 1.5; w *= 0.84;
    }
    P.add('gold', cyl(0.06, 0.03, 2.2, bx, y, bz, 8));
  }
  const hillMat = std({ color: 0x5a4060, roughness: 1, fog: true });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.ConeGeometry(9 + R() * 10, 7 + R() * 9, 7, 1); const m = new THREE.Mesh(g, hillMat);
    m.position.set(cx - 70 + i * 17 + R() * 6, G + 2, zP - 55 - R() * 20); m.rotation.y = R() * 3; scene.add(m); disposables.push(g);
  }

  // ------------------------------------------------------------------ the cherry trees
  const blossomAt: { p: THREE.Vector3; s: number }[] = [];
  const barkParts: THREE.BufferGeometry[] = [];
  const grow = (base: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, depth: number) => {
    // a branch: a gently bent curve, drooping a little toward its tip; children from its upper part
    const pts = [base.clone()], seg = 3; let p = base.clone(), d = dir.clone().normalize();
    for (let i = 1; i <= seg; i++) {
      d.add(new THREE.Vector3((R() - 0.5) * 0.5, (R() - 0.5) * 0.25 - (depth > 0 ? 0.08 : 0), (R() - 0.5) * 0.5)).normalize();
      p = p.clone().addScaledVector(d, len / seg); pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts), r1 = r0 * (depth >= 2 ? 0.35 : 0.55);
    barkParts.push(taperTube(curve, r0, r1, depth === 0 ? 10 : 6, depth === 0 ? 10 : 7, 0.55));
    if (depth >= 3) { blossomAt.push({ p: p.clone(), s: 0.7 + R() * 0.45 }); return; }
    const kids = depth === 0 ? 4 : 2 + Math.round(R());
    for (let k = 0; k < kids; k++) {
      const t = depth === 0 ? 0.92 : 0.45 + R() * 0.5, at = curve.getPointAt(t), tan = curve.getTangentAt(t);
      const yaw = (k / kids) * Math.PI * 2 + R() * 1.2, out = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw) * 0.75);
      const nd = tan.clone().multiplyScalar(0.45).add(out.multiplyScalar(0.8)).add(new THREE.Vector3(0, depth === 0 ? 0.55 : 0.2, 0));
      grow(at, nd, len * (0.62 + R() * 0.18), r0 * r1 / r0 * (depth === 0 ? 0.62 : 0.78), depth + 1);
    }
    for (let k = 0; k < (depth >= 1 ? 3 : 0); k++) { const at = curve.getPointAt(0.35 + R() * 0.6); blossomAt.push({ p: at.add(new THREE.Vector3((R() - 0.5) * 0.3, 0.1 + R() * 0.2, (R() - 0.5) * 0.3)), s: 0.55 + R() * 0.4 }); }
  };
  const trees: { x: number; z: number; h: number; lean: number }[] = [
    { x: deck.x0 - 2.3, z: deck.z0 - 0.5, h: 2.3, lean: 0.45 }, { x: deck.x1 + 2.5, z: deck.z0 - 0.9, h: 2.5, lean: -0.5 },
    { x: cx - TW / 2 - 3.2, z: zP - 3.4, h: 3.0, lean: 0.3 }, { x: cx + TW / 2 + 3.6, z: zP - 3.8, h: 3.1, lean: -0.3 },
    { x: deck.x0 - 4.6, z: deck.z1 + 1.4, h: 2.4, lean: 0.35 }, { x: deck.x1 + 4.8, z: deck.z1 + 1.0, h: 2.4, lean: -0.35 },
  ];
  for (const t of trees) {
    // the trunk (flared at the roots), leaning, then the crown's limbs
    const base = new THREE.Vector3(t.x, G - 0.05, t.z);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + R(); barkParts.push(taperTube(new THREE.CatmullRomCurve3([base.clone().add(new THREE.Vector3(0, 0.35, 0)), base.clone().add(new THREE.Vector3(Math.cos(a) * 0.45, 0.06, Math.sin(a) * 0.45)), base.clone().add(new THREE.Vector3(Math.cos(a) * 0.8, -0.04, Math.sin(a) * 0.8))]), 0.16, 0.04, 6, 6, 0.55)); }
    const top = base.clone().add(new THREE.Vector3(t.lean * 0.8, t.h, (R() - 0.5) * 0.3));
    const trunk = new THREE.CatmullRomCurve3([base, base.clone().add(new THREE.Vector3(t.lean * 0.15, t.h * 0.4, 0.05)), base.clone().add(new THREE.Vector3(t.lean * 0.55, t.h * 0.75, -0.05)), top]);
    barkParts.push(taperTube(trunk, 0.36, 0.22, 12, 12, 0.55));
    for (let k = 0; k < 4; k++) {
      const yaw = (k / 4) * Math.PI * 2 + R() * 0.8 + 0.3, out = new THREE.Vector3(Math.cos(yaw) * (1 + Math.abs(t.lean)), 0.7 + R() * 0.4, Math.sin(yaw) * 0.6);
      grow(top.clone(), out, 1.5 + R() * 0.6, 0.18, 1);
    }
  }
  P.add('bark', ...barkParts);

  // ------------------------------------------------------------------ build the merged pieces
  P.build(M, scene); PF.build(M, front, false);
  // contact shade where things meet the ground (pillar feet, lanterns, trunks, the stair's foot, the platform's base)
  {
    const aoParts: THREE.BufferGeometry[] = [];
    const ao = (x: number, y: number, z: number, sx: number, sz: number) => { const g = new THREE.PlaneGeometry(sx, sz); g.rotateX(-Math.PI / 2); g.translate(x, y + 0.004, z); aoParts.push(g); };
    for (const z of [zC, zWall]) for (const x of px) ao(x, yT, z, 0.95, 0.95);
    for (const [x, y, z] of lanternAt) ao(x, y, z, 1.35, 1.35);
    for (const t of trees) ao(t.x + t.lean * 0.1, G, t.z, 2.4, 2.1);
    ao(cx, G, zP + NS * tread + 0.2, SW + 1.4, 0.8);
    for (let x = cx - TW / 2; x < cx + TW / 2; x += 1.2) ao(x + 0.6, G, zP + 0.18, 1.6, 0.7);
    const aoTex = canvasTex(shadowCanvas()); disposables.push(aoTex);
    const aoGeo = mergeGeometries(aoParts, false)!; aoParts.forEach((g) => g.dispose()); disposables.push(aoGeo);
    const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }); disposables.push(aoMat);
    const aoMesh = new THREE.Mesh(aoGeo, aoMat); aoMesh.renderOrder = 1; scene.add(aoMesh);
  }

  // the blossom: one instanced card per clump (four painted clumps in the atlas), lit as a soft round crown, swaying
  const blossomTex = tex(A + 'blossom.webp');
  const bMat = new THREE.MeshStandardMaterial({ map: blossomTex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.85, emissive: 0x4a1a2a, emissiveIntensity: 0.55 });
  const uTime = { value: 0 }, uWind = { value: 1 };
  bMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind;
    sh.vertexShader = 'attribute vec2 uvOff;\nattribute vec3 aCrown;\nuniform float uTime;\nuniform float uWind;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vMapUv * 0.5 + uvOff;\n#endif')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = aCrown;\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
      .replace('#include <project_vertex>', 'vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\nmvPosition = instanceMatrix * mvPosition;\n#endif\n'
        + 'float sw = sin(uTime * 1.15 + mvPosition.x * 0.9 + mvPosition.z * 0.7) * 0.055 + sin(uTime * 2.4 + mvPosition.y * 2.1 + mvPosition.x) * 0.022;\n'
        + 'mvPosition.x += sw * uWind; mvPosition.y += sw * 0.35 * uWind; mvPosition.z += sw * 0.4 * uWind;\nmvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );');
  };
  disposables.push(bMat);
  const nB = blossomAt.length, bGeo = new THREE.PlaneGeometry(1, 1), blossom = new THREE.InstancedMesh(bGeo, bMat, nB);
  const uvOff = new Float32Array(nB * 2), crown = new Float32Array(nB * 3), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  // each tree's crown centre: the mean of its clumps nearby (the normals point out of it)
  for (let i = 0; i < nB; i++) {
    const b = blossomAt[i];
    let best = trees[0], bd = Infinity; for (const t of trees) { const d = Math.hypot(t.x - b.p.x, t.z - b.p.z); if (d < bd) { bd = d; best = t; } }
    const centre = new THREE.Vector3(best.x + best.lean * 0.8, G + best.h + 0.9, best.z);
    e.set((R() - 0.5) * 1.6, R() * Math.PI * 2, (R() - 0.5) * 1.2); q.setFromEuler(e);
    const s = b.s * 1.05; m4.compose(b.p, q, new THREE.Vector3(s, s, s)); blossom.setMatrixAt(i, m4);
    const v = (R() * 4) | 0; uvOff[i * 2] = (v % 2) * 0.5; uvOff[i * 2 + 1] = (v >> 1) * 0.5;
    const nW = b.p.clone().sub(centre).normalize().add(new THREE.Vector3(0, 0.35, 0)).normalize(); nW.applyQuaternion(q.clone().invert());
    crown.set([nW.x, nW.y, nW.z], i * 3);
  }
  bGeo.setAttribute('uvOff', new THREE.InstancedBufferAttribute(uvOff, 2)); bGeo.setAttribute('aCrown', new THREE.InstancedBufferAttribute(crown, 3));
  blossom.castShadow = true; blossom.receiveShadow = false;
  blossom.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blossomTex, alphaTest: 0.42 });
  blossom.computeBoundingSphere(); scene.add(blossom); disposables.push(bGeo, blossom.customDepthMaterial);

  // ------------------------------------------------------------------ petals: lying on the ground, and falling from the crowns
  const petalTex = canvasTex(petalCanvas()); disposables.push(petalTex);
  const pMat = new THREE.MeshStandardMaterial({ map: petalTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, emissive: 0x3a1420, emissiveIntensity: 0.6 }); disposables.push(pMat);
  const pGeo = new THREE.PlaneGeometry(0.085, 0.07); disposables.push(pGeo);
  const groundY = (x: number, z: number): number => (x >= deck.x0 && x <= deck.x1 && z >= deck.z0 && z <= deck.z1 ? 0 : G);
  { // a carpet of fallen petals: thick under the trees, a scatter elsewhere
    const n = soft ? 900 : 2400, lying = new THREE.InstancedMesh(pGeo, pMat, n), col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      let x: number, z: number;
      if (i % 3) { const t = trees[(R() * trees.length) | 0], r = Math.sqrt(-2 * Math.log(R() + 1e-6)) * 1.5, a = R() * Math.PI * 2; x = t.x + Math.cos(a) * r * 1.3; z = t.z + Math.sin(a) * r; }
      else { x = deck.x0 - 3 + R() * (deck.x1 - deck.x0 + 6); z = deck.z0 - 1 + R() * (deck.z1 - deck.z0 + 2.5); if (groundY(x, z) === 0 && R() < 0.75) { z = R() < 0.5 ? deck.z0 - 0.4 - R() * 1.2 : deck.z1 + 0.4 + R() * 1.5; } }
      e.set(-Math.PI / 2 + (R() - 0.5) * 0.3, 0, R() * Math.PI * 2); q.setFromEuler(e);
      const s = 0.7 + R() * 0.6; m4.compose(new THREE.Vector3(x, groundY(x, z) + 0.004 + R() * 0.003, z), q, new THREE.Vector3(s, s, s)); lying.setMatrixAt(i, m4);
      col.setHSL(0.94 + R() * 0.04, 0.62 + R() * 0.3, 0.7 + R() * 0.14); lying.setColorAt(i, col);
    }
    lying.receiveShadow = true; scene.add(lying);
  }
  const NF = soft ? 160 : 420, falling = new THREE.InstancedMesh(pGeo, pMat, NF);
  falling.instanceMatrix.setUsage(THREE.DynamicDrawUsage); falling.frustumCulled = false; scene.add(falling);
  const fp = new Float32Array(NF * 3), fv = new Float32Array(NF * 3), fr = new Float32Array(NF * 3), fs = new Float32Array(NF * 3), fl = new Float32Array(NF), fk = new Uint8Array(NF), fph = new Float32Array(NF);
  const spawn = (i: number, anywhere: boolean) => {
    const b = blossomAt[(R() * nB) | 0].p;
    fp[i * 3] = b.x + (R() - 0.5) * 0.6; fp[i * 3 + 1] = anywhere ? G + 0.2 + R() * (b.y - G) : b.y - 0.1; fp[i * 3 + 2] = b.z + (R() - 0.5) * 0.6;
    fv[i * 3] = 0; fv[i * 3 + 1] = -0.15; fv[i * 3 + 2] = 0;
    fr[i * 3] = R() * 6; fr[i * 3 + 1] = R() * 6; fr[i * 3 + 2] = R() * 6;
    fs[i * 3] = 1 + R() * 3; fs[i * 3 + 1] = 0.5 + R() * 2; fs[i * 3 + 2] = 1 + R() * 2.5;
    fk[i] = 0; fl[i] = 0; fph[i] = R() * 10;
  };
  for (let i = 0; i < NF; i++) spawn(i, true);

  // ------------------------------------------------------------------ lights that live in the room
  const warm: THREE.PointLight[] = [];
  const glowTex = canvasTex(glowCanvas()); disposables.push(glowTex);
  const glow = (x: number, y: number, z: number, size: number, color: number, op = 0.85) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.position.set(x, y, z); s.scale.set(size, size, 1); scene.add(s); disposables.push(s.material); return s;
  };
  for (const [x, y, z] of lanternAt) glow(x, y + 1.34, z, 1.1, 0xffa45a, 0.75);
  for (const x of lanternsUnder) glow(x, yB - 0.7, zC + 0.15, 1.3, 0xff7a3a, 0.7);
  for (let i = 2; i <= 4; i++) glow((px[i] + px[i + 1]) / 2, yT + 1.3, zWall + 0.25, 2.6, 0xffb066, 0.32);
  const lightAt: [number, number, number][] = [[cx - SW / 2 - 1.15, G + 1.35, zP + 1.15 + 0.3], [cx + SW / 2 + 1.15, G + 1.35, zP + 1.15 + 0.3]];
  for (const [x, y, z] of lightAt) { const L = new THREE.PointLight(0xff9440, 3.2, 6, 2); L.position.set(x, y, z); scene.add(L); warm.push(L); }
  { const L = new THREE.PointLight(0xffaa5a, 10, 11, 2); L.position.set(cx, yT + 1.5, zWall + 1.2); scene.add(L); warm.push(L); }

  // ------------------------------------------------------------------ the air: motes in the sun, shafts of light
  const NM = soft ? 60 : 160, motePos = new Float32Array(NM * 3), moteBase = new Float32Array(NM * 3);
  for (let i = 0; i < NM; i++) { moteBase.set([deck.x0 - 2 + R() * (deck.x1 - deck.x0 + 4), 0.3 + R() * 3.2, deck.z0 - 2 + R() * (deck.z1 - deck.z0 + 3)], i * 3); }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ map: glowTex, color: 0xffd6a0, size: 0.05, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }); disposables.push(moteGeo, moteMat);
  const motes = new THREE.Points(moteGeo, moteMat); motes.frustumCulled = false; scene.add(motes);
  const shaftTex = canvasTex((() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d')!; const gx = g.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gx; g.fillRect(0, 0, 64, 256); g.globalCompositeOperation = 'destination-in'; const gy = g.createLinearGradient(0, 0, 0, 256); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.25, 'rgba(0,0,0,1)'); gy.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gy; g.fillRect(0, 0, 64, 256); return c; })()); disposables.push(shaftTex);
  const shafts: THREE.Mesh[] = [];
  const sunDir = sun.position.clone().sub(sun.target.position).normalize();
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + R() * 1.4, 9), new THREE.MeshBasicMaterial({ map: shaftTex, color: 0xffc890, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    const x = deck.x0 + (i + 0.5) * (deck.x1 - deck.x0) / 6 + (R() - 0.5) * 1.5, z = deck.z0 - 0.6 + R() * 1.2;
    m.position.set(x, 3.6, z).addScaledVector(sunDir, 0.5); m.lookAt(m.position.clone().add(new THREE.Vector3(0, 0, 1)));
    m.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sunDir)); m.userData.ph = R() * 10; m.userData.a = 0.05 + R() * 0.06;
    scene.add(m); shafts.push(m); disposables.push(m.geometry, m.material as THREE.Material);
  }

  // ------------------------------------------------------------------ the frame's work
  const wind = { x: 0.32, z: 0.06 };
  const dummy = new THREE.Object3D();
  const update = (ms: number, t: number, dim: number) => {
    const dt = Math.min(0.05, ms / 1000);
    uTime.value = t; skyMat.uniforms.uTime.value = t; skyMat.uniforms.uDim.value = dim;
    const gust = 1 + Math.sin(t * 0.37) * 0.35 + Math.sin(t * 1.3) * 0.12; uWind.value = gust;
    for (let i = 0; i < NM; i++) { const j = i * 3; motePos[j] = moteBase[j] + Math.sin(t * 0.21 + i) * 0.5 + ((t * 0.06 * (0.5 + (i % 5) * 0.2)) % 3); motePos[j + 1] = moteBase[j + 1] + Math.sin(t * 0.33 + i * 1.7) * 0.25; motePos[j + 2] = moteBase[j + 2] + Math.cos(t * 0.17 + i * 0.7) * 0.4; }
    moteGeo.attributes.position.needsUpdate = true; moteMat.opacity = 0.75 * (1 - dim * 0.8);
    for (const m of shafts) (m.material as THREE.MeshBasicMaterial).opacity = m.userData.a * (0.75 + Math.sin(t * 0.5 + m.userData.ph) * 0.25) * (1 - dim);
    for (let i = 0; i < NF; i++) {
      const j = i * 3;
      if (fk[i] === 0) { // falling: drifting with the wind, fluttering, spinning
        fph[i] += dt;
        const flutter = Math.sin(fph[i] * 2.2 + i) * 0.28;
        fv[j] += ((wind.x * gust + flutter) - fv[j]) * Math.min(1, dt * 1.6);
        fv[j + 1] += (-0.32 - fv[j + 1]) * Math.min(1, dt * 1.2);
        fv[j + 2] += ((wind.z + Math.cos(fph[i] * 1.7 + i) * 0.12) - fv[j + 2]) * Math.min(1, dt * 1.6);
        fp[j] += fv[j] * dt; fp[j + 1] += fv[j + 1] * dt; fp[j + 2] += fv[j + 2] * dt;
        fr[j] += fs[j] * dt; fr[j + 1] += fs[j + 1] * dt; fr[j + 2] += fs[j + 2] * dt;
        const gy = groundY(fp[j], fp[j + 2]);
        if (fp[j + 1] <= gy + 0.006) { fk[i] = 1; fp[j + 1] = gy + 0.005; fl[i] = 4 + R() * 5; fr[j] = -Math.PI / 2; fr[j + 1] = 0; }
        if (Math.abs(fp[j] - cx) > W / 2 + 14) spawn(i, false);
      } else { // lying: still, until it shrinks away and a new one leaves a crown
        fl[i] -= dt;
        if (Math.abs(fv[j]) + Math.abs(fv[j + 1]) + Math.abs(fv[j + 2]) > 0.05) { fk[i] = 0; continue; }
        if (fl[i] <= 0) spawn(i, false);
      }
      const k = fk[i] === 1 ? Math.min(1, fl[i] / 1.2) : 1;
      dummy.position.set(fp[j], fp[j + 1], fp[j + 2]); dummy.rotation.set(fr[j], fr[j + 1], fr[j + 2]); dummy.scale.setScalar(k);
      dummy.updateMatrix(); falling.setMatrixAt(i, dummy.matrix);
    }
    falling.instanceMatrix.needsUpdate = true;
  };
  const blow = (x: number, y: number, z: number, Rr: number, strength: number) => {
    for (let i = 0; i < NF; i++) {
      const j = i * 3, dx = fp[j] - x, dz = fp[j + 2] - z, dy = fp[j + 1] - y, d = Math.hypot(dx, dz, dy * 0.6);
      if (d > Rr || d < 1e-3) continue;
      const f = strength * (1 - d / Rr);
      fv[j] += (dx / d) * f; fv[j + 1] += f * 0.7 + R() * 0.5; fv[j + 2] += (dz / d) * f * 0.8; fk[i] = 0; fp[j + 1] += 0.01;
    }
  };

  return {
    sun, hemi, warm, groundY, blow,
    update: (ms, t, dim) => {
      update(ms, t, dim);
      sunF.intensity = sun.intensity; hemiF.intensity = hemi.intensity;
      if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    },
    shadowsDirty: () => { shadowDirty = true; },
    dispose: () => { for (const d of disposables) d.dispose(); scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); },
  };
}
