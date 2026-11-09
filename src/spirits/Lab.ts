// The Spectral Samurai's look bench (?spiritlab, for the art review — Legacy of Spirits gate 1): one of the game's 3D
// places drawn as the world draws it (its own light, the world camera: 17° pitch, 34° lens, the hero 1 unit under the
// look point and the lead ahead of him), the spirit body standing in it drawn over the place as the world draws its
// hero (its own layer, the place's sun and sky light mirrored, a soft fill from the camera's side). URL: area (a map
// id), frac (the hero's share of the screen's height) or dist (units), face (r / l), move (idle, walk, run, slash),
// x (px along the map), noglow, pitch (degrees); form&lv=…&preset=… (the spirit form). The game itself is untouched.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { MAPS } from '../world3d/maps';
import { AREAS } from '../world/Areas';
import { Hero3D } from '../arena3d/Hero3D';
import type { Room } from '../arena3d/Room';
import { makeSpirit, makeSpiritFinish } from './SpiritBody';
import { makeSpiritForm } from './SpiritForm';
import { SPIRIT_BODY } from './flag';

const Q = new URLSearchParams(location.search);
const U = 100, DK = 1.15;

function floorOf(id: string): { x0: number; x1: number; back: number; front: number } {
  const a = AREAS[id], xs = a.walk.map((p) => p[0]), ys = a.walk.map((p) => p[1]);
  const left = Math.min(...xs), backPts = a.walk.filter((p) => p[0] <= left + 1).map((p) => p[1]);
  return { x0: a.x + left, x1: a.x + Math.max(...xs), back: backPts.length ? Math.min(...backPts) : Math.min(...ys), front: Math.max(...ys) };
}

export async function startSpiritLab(): Promise<void> {
  const parent = document.getElementById('game') ?? document.body; parent.innerHTML = '';
  document.getElementById('ambient')?.remove();
  const soft = !!(navigator as { webdriver?: boolean }).webdriver && !Q.has('hq');
  const W = window.innerWidth, H = window.innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.localClippingEnabled = true;
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';
  parent.appendChild(renderer.domElement);
  const area = Q.get('area') ?? 'courtyard', fl = floorOf(area);
  const scene3 = new THREE.Scene(), front3 = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(34, W / H, 0.5, 400);
  const x = Number(Q.get('x') ?? (fl.x0 + fl.x1) / 2), y = Number(Q.get('y') ?? fl.front - 90);
  const focus = { x: x / U, z: (y / U) * DK };
  const room: Room = MAPS[area](focus)(scene3, front3, renderer, { x0: fl.x0 / U, x1: fl.x1 / U, zB: (fl.back / U) * DK, zF: (fl.front / U) * DK }, soft);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: soft ? 0 : 4 }));
  composer.addPass(new RenderPass(scene3, cam)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.5, 0.55, 0.86)); composer.addPass(new OutputPass());
  // the hero, on his own layer, lit as the world lights its hero
  const h = await Hero3D.load({ body: Q.get('body') ?? SPIRIT_BODY });
  h.setWeapon('katana');
  const sc = h.scene;
  const sun = new THREE.DirectionalLight(), sunT = new THREE.Object3D(); sun.target = sunT; const hemi = new THREE.HemisphereLight();
  const fill = new THREE.DirectionalLight(0xffeedd, 1.1), fillT = new THREE.Object3D(); fill.target = fillT;
  sc.add(sun, sunT, hemi, fill, fillT); sc.environment = scene3.environment; (sc as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.32;
  const sunDir = new THREE.Vector3(); h.makeShadow(sunDir);
  if (Q.has('neutral')) { // (the body's shape alone: grey, no drawing, no light of its own — for the art review)
    const body = (h as unknown as { body: THREE.SkinnedMesh | null }).body;
    if (body) body.material = new THREE.MeshStandardMaterial({ color: 0xb4b0bc, roughness: 0.8, metalness: 0 });
  } else if (Q.has('form')) makeSpiritForm(h, { level: Number(Q.get('lv') ?? 100), preset: () => Number(Q.get('preset') ?? 0), ground: () => room.groundY(h.root.position.x, h.root.position.z) }); // (the spirit form: &form&lv=1…100&preset=0…2)
  else if (!Q.has('plain') && !Q.has('addons')) makeSpiritFinish(h);
  const spirit = Q.has('addons') ? makeSpirit(h) : null; // (gate 1's dressed Beginner: &body=beginner_m.glb&addons)
  if (spirit && Q.has('bare')) for (const s of (spirit as unknown as { strands: { mesh: THREE.Mesh }[] }).strands) s.mesh.removeFromParent(); // (the body alone: its own painting)
  if (spirit && Q.has('noline')) (spirit as unknown as { outline: THREE.Object3D }).outline.removeFromParent();
  const face = Q.get('face') === 'l' ? -1 : 1, move = Q.get('move') ?? 'idle';
  const hx = x, hy = y;
  let t = 0, last = performance.now(), dist = Number(Q.get('dist') ?? 9);
  const wantFrac = Q.has('frac') ? Number(Q.get('frac')) : null;
  const lead = 90 * face;
  const place = () => {
    const look = new THREE.Vector3((hx + lead) / U, 1.0, (hy / U) * DK), p = THREE.MathUtils.degToRad(Number(Q.get('pitch') ?? 17)); // (&pitch: the camera's tilt, for the map pass)
    cam.position.set(look.x, look.y + Math.sin(p) * dist, look.z + Math.cos(p) * dist); cam.lookAt(look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  };
  const frac = (): number => { // the hero's share of the picture's height: his feet to the top of his head and hair
    const hd = (h as unknown as { bones: Map<string, THREE.Bone> }).bones.get('Head')!; hd.updateWorldMatrix(true, false);
    const top = hd.getWorldPosition(new THREE.Vector3()); top.y += 0.3;
    const feet = h.root.getWorldPosition(new THREE.Vector3());
    return (top.project(cam).y - feet.project(cam).y) / 2;
  };
  const frame = () => {
    const now = performance.now(), ms = Math.min(50, now - last); last = now; t += ms;
    // what he does
    const run = move === 'run', walk = move === 'walk', slash = move === 'slash';
    const sp = run ? 300 : walk ? 120 : 0;
    const per = 650, el = t % per;
    // (any other body mode as it is: land, air, launched, down, hurt… — the air ones a little above the floor)
    const air = move === 'air' || move === 'launched', mode = slash ? 'skill' : run ? 'run' : walk ? 'walk' : move === 'idle' ? 'idle' : move;
    h.drive({ x: hx, y: hy, z: room.groundY(hx / U, (hy / U) * DK) * U + (air ? 70 : 0), vx: sp * face + (air ? 120 * face : 0), vy: 0, vz: air ? (move === 'launched' ? 260 : 60) : 0, grounded: !air, face, mode,
      cast: slash ? { id: 'quick_slash', stage: Math.floor(t / per) % 3, elapsed: el, startup: 120, active: 160, recovery: 300, dash: false, air: false } : null }, ms);
    place();
    if (wantFrac !== null) { for (let i = 0; i < 6; i++) { const f = frac(); dist *= f / wantFrac; place(); } }
    room.update(ms, t / 1000, 0);
    const R = room; sun.color.copy(R.sun.color); sun.intensity = R.sun.intensity; sun.position.copy(R.sun.position); sunT.position.copy(R.sun.target.position); sunT.updateMatrixWorld();
    sunDir.copy(R.sun.position).sub(R.sun.target.position).normalize();
    hemi.color.copy(R.hemi.color); hemi.groundColor.copy(R.hemi.groundColor); hemi.intensity = R.hemi.intensity;
    fill.position.copy(cam.position).add(new THREE.Vector3(-3, 4, 0)); fillT.position.set((hx + lead) / U, 1, (hy / U) * DK); fillT.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = true;
    renderer.autoClear = true; composer.render();
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(sc, cam);
    renderer.clearDepth(); renderer.render(front3, cam);
    (window as unknown as { __lab: unknown }).__lab = { frac: frac(), dist, t, scene3, front3 }; // (the place's scenes: the map checks — tools/spirits/zfight.cjs)
  };
  renderer.setAnimationLoop(frame);
}
