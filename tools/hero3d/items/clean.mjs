// The Beginner's shirt made clean (David 25 Oct: "why does she look awful?" — the shirt read stained and dirty: the
// drawing's brown smudges baked into it): its texels (the shirt's region, regions.mjs) laid in a clean warm linen, their
// shading kept — the broad light and folds (a blur of its brightness, a little evened out), the fine detail softened,
// the dark specks (the stains) most of all. The other regions are left as they are. Prints the regions' new mean
// brightness (Wear3D's REGIONS: a dye keeps the painting's shading by them).
// node clean.mjs IN.glb REGIONS.png OUT.glb   (run where @gltf-transform, meshoptimizer and sharp resolve)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [inPath, regPath, outPath] = process.argv.slice(2);
const doc = await io.read(inPath);
const tex = doc.getRoot().listMeshes()[0].listPrimitives()[0].getMaterial().getBaseColorTexture();
const img = sharp(Buffer.from(tex.getImage())), meta = await img.metadata(), W = meta.width, H = meta.height, TH = W; // (the atlas W × W; the head's band under it)
const raw = await img.ensureAlpha().raw().toBuffer();
const reg = await sharp(regPath).greyscale().raw().toBuffer({ resolveWithObject: true }); const MW = reg.info.width, MH = reg.info.height, S = W / MW;
const regionAt = (x, y) => Math.round(reg.data[Math.min(MH - 1, Math.floor(y / S)) * MW + Math.min(MW - 1, Math.floor(x / S))] / 32);
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const SHIRT = 1, LINEN = [240, 232, 216], Lc = lum(...LINEN) / 255;
// the shirt's brightness and its mask, blurred together (a blur of the shirt only)
const L = Buffer.alloc(W * TH), M = Buffer.alloc(W * TH); let sum = 0, cnt = 0;
for (let y = 0; y < TH; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (regionAt(x, y) !== SHIRT) continue; const q = 4 * i, l = lum(raw[q], raw[q + 1], raw[q + 2]); L[i] = Math.round(l); M[i] = 255; sum += l / 255; cnt++; }
const mean = sum / cnt, sig = W / 340; // (~6 texels at 2048: the folds kept, the specks gone)
const Lb = await sharp(L, { raw: { width: W, height: TH, channels: 1 } }).blur(sig).extractChannel(0).raw().toBuffer(), Mb = await sharp(M, { raw: { width: W, height: TH, channels: 1 } }).blur(sig).extractChannel(0).raw().toBuffer(); // (one channel: sharp blurs a grey image into three)
let changed = 0;
for (let y = 0; y < TH; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x; if (!M[i]) continue;
  const q = 4 * i, l = L[i] / 255, broad = Mb[i] > 8 ? Lb[i] / Mb[i] : l;
  const b2 = broad + (mean - broad) * 0.3, d = l - broad, d2 = d > 0 ? d * 0.7 : d * 0.35; // (the broad light a little evened, the stains mostly gone)
  const k = Math.max(0.5, Math.min(1.12, (b2 + d2) / Lc));
  for (let c = 0; c < 3; c++) raw[q + c] = Math.round(raw[q + c] + (Math.min(255, LINEN[c] * k) - raw[q + c]) * 0.85);
  changed++;
}
// the regions' mean brightness now (as regions.mjs counts it: their texels in the atlas)
const sums = new Float64Array(7), cnts = new Float64Array(7);
for (let y = 0; y < TH; y++) for (let x = 0; x < W; x++) { const r = regionAt(x, y); if (!r || r > 6) continue; const q = 4 * (y * W + x); sums[r] += lum(raw[q], raw[q + 1], raw[q + 2]) / 255; cnts[r]++; }
console.log(inPath, 'shirt texels cleaned', changed, `— the shirt's mean ${mean.toFixed(4)} → ${(sums[SHIRT] / cnts[SHIRT]).toFixed(4)} (×${(sums[SHIRT] / cnts[SHIRT] / mean).toFixed(4)}: Wear3D's REGIONS shirt mean by it)`);
tex.setImage(await sharp(raw, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90 }).toBuffer()).setMimeType('image/webp');
await io.write(outPath, doc);
const fs = await import('fs'); console.log(outPath, (fs.statSync(outPath).size / 1024).toFixed(0), 'KB');
