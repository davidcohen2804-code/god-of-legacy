import * as THREE from 'three';

/** GPT's P4B (`?spirits&glow`): the brazier's warm halo without the picture-wide bloom — one small additive sprite at
 *  each of the room's warm lights (a soft round falloff, drawn in the room's own pass: one small quad each, no extra
 *  full-picture pass). Meant for the pictures without bloom (`&nobloom`, and Auto's lighter levels). */
export function brazierGlow(room: THREE.Scene, warm: THREE.PointLight[]): number {
  if (!warm.length) return 0;
  const N = 64, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const cx = cv.getContext('2d')!, gr = cx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, N, N);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, color: 0xff9a4a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const v = new THREE.Vector3();
  for (const L of warm) {
    const s = new THREE.Sprite(mat); L.getWorldPosition(v); s.position.copy(v);
    s.scale.setScalar(Math.min(2.4, Math.max(1.0, 0.25 * (L.distance || 6)))); // (its size from the light's reach: ~1.5 units for the courtyard's brazier)
    s.renderOrder = 3; s.userData.glowLite = true; room.add(s);
  }
  return warm.length;
}
