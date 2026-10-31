// 50-character rendering benchmark: the same crowd drawn by the direct renderer, the composite renderer, and the
// composite renderer with its silhouette outline pass. Frame time is measured between rendered frames; "update" is the
// CPU time of the lab's own work per frame (rig, layout, composite drawing calls).
import type { LabScene, RenderMode } from './LabScene';

export interface BenchResult {
  mode: RenderMode; frames: number; seconds: number;
  frameMean: number; frameP95: number; fps: number;
  updateMean: number; updateP95: number;
  /** CPU time of the composite pass alone (0 for direct). */
  compMean: number; compP95: number;
  drawCallsMean: number; drawCallsMax: number;
  textureMiB: number; textureNote: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stats = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b), mean = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  return { mean, p95: s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0, max: s.length ? s[s.length - 1] : 0 };
};

export async function bench(scene: LabScene, seconds = 4, progress: (m: string) => void = () => {}): Promise<BenchResult[]> {
  const prev = { mode: scene.renderMode, npcs: scene.npcs.length, preview: scene.previewOn };
  scene.previewOn = false;
  scene.setStress(49); // + the player = 50 characters
  const out: BenchResult[] = [];
  for (const mode of ['direct', 'composite', 'composite-outline'] as RenderMode[]) {
    progress(`benchmark: ${mode}`);
    scene.renderMode = mode;
    scene.applyView();
    await wait(1000);
    scene.frameTimes.length = 0; scene.updateTimes.length = 0; scene.drawSamples.length = 0; scene.compTimes.length = 0;
    const t0 = performance.now();
    await wait(seconds * 1000);
    const dt = (performance.now() - t0) / 1000;
    const f = stats(scene.frameTimes), u = stats(scene.updateTimes), d = stats(scene.drawSamples), c = stats(scene.compTimes);
    const a256 = scene.textures.get('v4atlas256').source[0];
    let mib = (a256.width * a256.height * 4) / 2 ** 20, note = `part atlas ${a256.width}×${a256.height}`;
    if (scene.comp) {
      const w = scene.comp.width, h = scene.comp.height;
      mib += (2 * w * h * 4) / 2 ** 20;
      note += ` + composite ${w}×${h} ×2 (Phaser draws it through a capture target of the same size, then copies it)`;
    }
    out.push({ mode, frames: scene.frameTimes.length, seconds: dt, frameMean: f.mean, frameP95: f.p95, fps: f.mean ? 1000 / f.mean : 0,
      updateMean: u.mean, updateP95: u.p95, compMean: mode === 'direct' ? 0 : c.mean, compP95: mode === 'direct' ? 0 : c.p95, drawCallsMean: d.mean, drawCallsMax: d.max, textureMiB: mib, textureNote: note });
  }
  scene.renderMode = prev.mode; scene.previewOn = prev.preview;
  scene.setStress(prev.npcs);
  scene.applyView();
  progress('benchmark done');
  return out;
}
