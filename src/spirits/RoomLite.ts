import * as THREE from 'three';

/** GPT's P4A experiment M1 (`?spirits&m1` / `&m1b` only): the room's rough, non-metal pieces lit by a cheaper model.
 *  Their PBR material (MeshStandardMaterial: the room pass was half the GPU frame on David's Intel UHD) is swapped for a
 *  Lambert one with the same maps, colours, glow and transparency. Kept as they are: shiny or metal surfaces (roughness
 *  < 0.6 or metalness > 0.3), whose highlights need the PBR model, and any material with its own shader hook (terrain,
 *  trees, water, cloth).
 *  Lambert ignores the scene's environment map, which lights the room's PBR pieces evenly (the RoomEnvironment fill), so
 *  plain M1 darkens them. With a renderer (`&m1b`), that fill is given back as an even light map: its strength measured
 *  once from the same environment (a white rough sphere drawn by it alone, averaged), times the scene's own strength.
 *  `floorOnly` (`&m1c`): only the floor-like pieces (the paving and terraces), the walls, blocks and railings left as
 *  they are. Returns how many materials were swapped, of how many PBR ones, on how many meshes, and the fill. */
export function roomLite(renderer: THREE.WebGLRenderer | null, o: { floorOnly?: boolean }, ...scenes: THREE.Scene[]): { swapped: number; pbr: number; fill: number; meshes: number } {
  const made = new Map<THREE.Material, THREE.Material>(); let pbr = 0;
  const env = scenes.find((s) => s.environment)?.environment ?? null;
  const envI = (scenes.find((s) => s.environment) as (THREE.Scene & { environmentIntensity?: number }) | undefined)?.environmentIntensity ?? 1;
  const fill = renderer && env ? +(Math.PI * envWhite(renderer, env) * envI).toFixed(3) : 0;
  const white = fill > 0 ? new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) : null;
  if (white) white.needsUpdate = true;
  const swap = (m: THREE.Material): THREE.Material => {
    const p = m as THREE.MeshStandardMaterial;
    if (!p.isMeshStandardMaterial) return m;
    const known = made.get(m); if (known) return known;
    pbr++;
    if (p.roughness < 0.6 || p.metalness > 0.3 || p.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || p.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) { made.set(m, m); return m; }
    const l = new THREE.MeshLambertMaterial();
    l.color.copy(p.color); l.emissive.copy(p.emissive); l.emissiveIntensity = p.emissiveIntensity; l.normalScale.copy(p.normalScale);
    Object.assign(l, {
      map: p.map, emissiveMap: p.emissiveMap, normalMap: p.normalMap, aoMap: p.aoMap, aoMapIntensity: p.aoMapIntensity, alphaMap: p.alphaMap,
      transparent: p.transparent, opacity: p.opacity, alphaTest: p.alphaTest, side: p.side, vertexColors: p.vertexColors,
      flatShading: p.flatShading, fog: p.fog, depthWrite: p.depthWrite, depthTest: p.depthTest, toneMapped: p.toneMapped,
      polygonOffset: p.polygonOffset, polygonOffsetFactor: p.polygonOffsetFactor, polygonOffsetUnits: p.polygonOffsetUnits,
    });
    if (white && !p.envMap) { l.lightMap = white; l.lightMapIntensity = fill; } // (the scene environment's even fill, as the PBR piece had it — its strength is the scene's)
    l.name = p.name; l.userData = { ...p.userData, m1: true }; l.clippingPlanes = p.clippingPlanes; l.stencilWrite = p.stencilWrite;
    made.set(m, l); return l;
  };
  let meshes = 0;
  for (const sc of scenes) sc.traverse((ob) => {
    const mesh = ob as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material || (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (o.floorOnly && !floorLike(mesh)) return; // (M1c: only the large, flat, level pieces — the paving and the terraces)
    const before = mesh.material;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    if (mesh.material !== before) meshes++;
  });
  let swapped = 0; for (const [a, b] of made) if (a !== b) swapped++;
  return { swapped, pbr, fill, meshes };
}

/** M1c (GPT's P4B): a floor-like piece — flat and level (its height under 0.2 units) and large (over 4 square units). */
function floorLike(m: THREE.Mesh): boolean {
  const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
  m.updateWorldMatrix(true, false); const b = g.boundingBox!.clone().applyMatrix4(m.matrixWorld);
  const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
  return sy < 0.2 && sx * sz > 4;
}

/** The light a white, fully rough PBR surface gets from an environment map alone (strength 1), averaged over a sphere
 *  (every direction it faces toward the viewer): drawn once into a small target and read back. */
function envWhite(renderer: THREE.WebGLRenderer, env: THREE.Texture): number {
  const N = 32, rt = new THREE.WebGLRenderTarget(N, N);
  const sc = new THREE.Scene(); sc.environment = env;
  const geo = new THREE.SphereGeometry(1, 32, 16), mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  sc.add(new THREE.Mesh(geo, mat));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0);
  const prev = renderer.getRenderTarget(), tm = renderer.toneMapping, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  const px = new Uint8Array(N * N * 4);
  try {
    renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, N, N, px);
  } finally { renderer.setRenderTarget(prev); renderer.toneMapping = tm; renderer.setClearColor(cc, ca); rt.dispose(); geo.dispose(); mat.dispose(); }
  let sum = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 0) { sum += (px[i] + px[i + 1] + px[i + 2]) / (3 * 255); n++; }
  return n ? sum / n : 0;
}
