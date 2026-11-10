import * as THREE from 'three';

/** GPT's P4A experiment M1 (`?spirits&m1` only): the room's rough, non-metal pieces lit by a cheaper model. Their PBR
 *  material (MeshStandardMaterial: the room pass was half the GPU frame on David's Intel UHD) is swapped for a Lambert one
 *  with the same maps, colours, glow and transparency. Kept as they are: shiny or metal surfaces (roughness < 0.6 or
 *  metalness > 0.3), whose highlights need the PBR model, and any material with its own shader hook (terrain, trees,
 *  water, cloth). Returns how many materials were swapped, and of how many PBR ones. */
export function roomLite(...scenes: THREE.Object3D[]): { swapped: number; pbr: number } {
  const made = new Map<THREE.Material, THREE.Material>(); let pbr = 0;
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
    l.name = p.name; l.userData = { ...p.userData, m1: true }; l.clippingPlanes = p.clippingPlanes; l.stencilWrite = p.stencilWrite;
    made.set(m, l); return l;
  };
  for (const sc of scenes) sc.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material || (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
  let swapped = 0; for (const [a, b] of made) if (a !== b) swapped++;
  return { swapped, pbr };
}
