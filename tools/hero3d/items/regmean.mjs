// Each region's mean brightness over the body's own faces' texels (what is drawn): node regmean.mjs BODY.glb REGIONS.png
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const [inPath, regPath] = process.argv.slice(2);
const doc = await io.read(inPath); await doc.transform(dequantize());
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0], UV = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices().getArray();
const img = sharp(Buffer.from(prim.getMaterial().getBaseColorTexture().getImage())), meta = await img.metadata(), TW = meta.width, NH = meta.height, TH = TW;
const raw = await img.ensureAlpha().raw().toBuffer();
const reg = await sharp(regPath).greyscale().raw().toBuffer({ resolveWithObject: true }), MW = reg.info.width, MH = reg.info.height;
const cover = (MH * TW) / MW > TH + 1 ? NH : TH; // (the texture's rows the map covers)
const regionAt = (x, y) => Math.round(reg.data[Math.min(MH - 1, Math.floor((y * MH) / cover)) * MW + Math.min(MW - 1, Math.floor((x * MW) / TW))] / 32);
const seen = new Uint8Array(TW * TH), sum = new Float64Array(8), cnt = new Float64Array(8), uv = [0, 0];
for (let t = 0; t < I.length; t += 3) {
  const P2 = []; let top = true; for (let c = 0; c < 3; c++) { UV.getElement(I[t + c], uv); if (uv[1] >= TH / NH - 1e-4) top = false; P2.push([uv[0] * TW, uv[1] * NH]); } if (!top) continue;
  const [A, B, C] = P2, den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
  for (let y = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))); y <= Math.min(TH - 1, Math.ceil(Math.max(A[1], B[1], C[1]))); y++) for (let x = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))); x <= Math.min(TW - 1, Math.ceil(Math.max(A[0], B[0], C[0]))); x++) {
    const X = x + 0.5, Y = y + 0.5, l1 = ((B[1] - C[1]) * (X - C[0]) + (C[0] - B[0]) * (Y - C[1])) / den, l2 = ((C[1] - A[1]) * (X - C[0]) + (A[0] - C[0]) * (Y - C[1])) / den;
    if (l1 < 0 || l2 < 0 || 1 - l1 - l2 < 0) continue; const i = y * TW + x; if (seen[i]) continue; seen[i] = 1;
    const r = regionAt(x, y), q = 4 * i; sum[r] += (0.299 * raw[q] + 0.587 * raw[q + 1] + 0.114 * raw[q + 2]) / 255; cnt[r]++;
  }
}
console.log(JSON.stringify([...sum].slice(0, 7).map((s, i) => (cnt[i] ? +(s / cnt[i]).toFixed(4) : 0))), JSON.stringify([...cnt].slice(0, 7)));
