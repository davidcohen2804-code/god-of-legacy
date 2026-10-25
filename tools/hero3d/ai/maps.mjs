// The Beginner's surfaces (David 25 Oct: "it looks like plastic, like margarine"): the body had a colour map only — a
// smooth shape lit evenly all over, one gloss everywhere. Two maps are added to its material, in the atlas's own layout:
//  - a normal map: the base head's skin, hair and eyes their own (Quaternius' normal maps, CC0 — the head.mjs band
//    copies their colour maps block for block, so theirs go in the same blocks); the body's drawing gets a relief from its
//    own painting (its brightness's slopes: the folds, the seams, the leather's grain);
//  - a roughness map: the skin its own (the base body's), the hair and the eyes theirs; the clothes by their regions
//    (regions.mjs): the linen and the trousers dull, the leather (vest, boots, bracers) with a low sheen, the sash between.
// node maps.mjs IN.glb OUT.glb m|f REGIONS.png QDIR   (REGIONS: bust.mjs's map over the whole atlas — its band's cloth too;
// QDIR: the Quaternius base characters' textures; run where @gltf-transform, meshoptimizer and sharp resolve)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import path from 'path';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [inPath, outPath, sex, regPath, qdir] = process.argv.slice(2);
const doc = await io.read(inPath);
const mat = doc.getRoot().listMeshes()[0].listPrimitives()[0].getMaterial(), base = mat.getBaseColorTexture();
const img = sharp(Buffer.from(base.getImage())), meta = await img.metadata(), W = meta.width, NH = meta.height, TH = W, BAND = W / 2;
const SK = { x: 0, y: TH, s: BAND }, HR = { x: BAND, y: TH, s: (BAND * 3) / 4 }, EY = { x: BAND + (BAND * 3) / 4, y: TH, s: BAND / 4 };
const F = sex === 'f';
const Q = (f) => path.join(qdir, f);
const rgb = await img.removeAlpha().raw().toBuffer();
const reg = await sharp(regPath).greyscale().raw().toBuffer({ resolveWithObject: true }), MW = reg.info.width, MS = W / MW;
const regionAt = (x, y) => Math.round(reg.data[Math.min(reg.info.height - 1, Math.floor(y / MS)) * MW + Math.min(MW - 1, Math.floor(x / MS))] / 32);

// the normal map
const nrm = Buffer.alloc(W * NH * 3); for (let i = 0; i < W * NH; i++) { nrm[3 * i] = 128; nrm[3 * i + 1] = 128; nrm[3 * i + 2] = 255; }
{ // the drawing's relief (its brightness, a little softened, its slopes)
  const L = Buffer.alloc(W * TH); for (let i = 0; i < W * TH; i++) L[i] = Math.round(0.3 * rgb[3 * i] + 0.59 * rgb[3 * i + 1] + 0.11 * rgb[3 * i + 2]);
  const Ls = await sharp(L, { raw: { width: W, height: TH, channels: 1 } }).blur(+(process.env.RELIEF_BLUR ?? 1.0)).extractChannel(0).raw().toBuffer(); // (one channel: sharp blurs a grey image into three)
  const l = (x, y) => Ls[Math.min(TH - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))] / 255;
  for (let y = 0; y < TH; y++) for (let x = 0; x < W; x++) {
    const r = regionAt(x, y), q0 = 3 * (y * W + x), cr = rgb[q0], cg = rgb[q0 + 1], cb = rgb[q0 + 2];
    const skin = !r && cr > 140 && cr - cb > 0.3 * cr && cr > cg + 15 && 0.3 * cr + 0.59 * cg + 0.11 * cb > 105 && !(cr > 1.8 * cg); // (bare skin: smooth)
    const s = skin ? 0 : (r === 2 || r === 5 || r === 6 ? 1.4 : r ? 0.9 : 0.8) * +(process.env.RELIEF ?? 1); // (the leather a little deeper, the linen light)
    if (!s) continue;
    const dx = l(x + 1, y - 1) + 2 * l(x + 1, y) + l(x + 1, y + 1) - (l(x - 1, y - 1) + 2 * l(x - 1, y) + l(x - 1, y + 1));
    const dy = l(x - 1, y + 1) + 2 * l(x, y + 1) + l(x + 1, y + 1) - (l(x - 1, y - 1) + 2 * l(x, y - 1) + l(x + 1, y - 1));
    let nx = -dx * s, ny = dy * s, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const q = 3 * (y * W + x); nrm[q] = Math.round((nx * 0.5 + 0.5) * 255); nrm[q + 1] = Math.round((ny * 0.5 + 0.5) * 255); nrm[q + 2] = Math.round((nz * 0.5 + 0.5) * 255);
  }
}
const paste = async (file, blk, buf, ch, pick) => {
  const r = await sharp(Q(file)).resize(blk.s, blk.s, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  for (let y = 0; y < blk.s; y++) for (let x = 0; x < blk.s; x++) { const s = 3 * (y * blk.s + x), d = ch * ((blk.y + y) * W + blk.x + x); const v = pick(r[s], r[s + 1], r[s + 2]); for (let c = 0; c < ch; c++) buf[d + c] = v[c]; }
};
await paste(F ? 'T_Superhero_Female_Normal.png' : 'T_Superhero_Male_Normal.png', SK, nrm, 3, (r, g, b) => [r, g, b]);
await paste(F ? 'T_Hair_2_Normal.png' : 'T_Hair_1_Normal.png', HR, nrm, 3, (r, g, b) => [r, g, b]);
await paste('T_Eye_Normal_png.png', EY, nrm, 3, (r, g, b) => [r, g, b]);

// the roughness map (glTF: green the roughness, blue the metalness — none)
const mr = Buffer.alloc(W * NH * 3); const R = (v) => Math.round(v * 255);
const byRegion = [0.86, 0.92, 0.62, 0.8, 0.9, 0.58, 0.6]; // (none, shirt, vest, sash, trousers, boots, bracers)
for (let y = 0; y < NH; y++) for (let x = 0; x < W; x++) { const q = 3 * (y * W + x); mr[q] = 255; mr[q + 1] = R(y < TH ? byRegion[regionAt(x, y)] ?? 0.86 : 0.8); mr[q + 2] = 0; }
await paste(F ? 'T_Superhero_Female_Roughness.png' : 'T_Superhero_Male_Roughness.png', SK, mr, 3, (r, g) => [255, Math.round(80 + g * 0.62), 0]); // (the skin a little softer than its map: ~0.55–0.95)
for (let y = 0; y < HR.s; y++) for (let x = 0; x < HR.s; x++) { const q = 3 * ((HR.y + y) * W + HR.x + x); mr[q + 1] = R(F ? 0.68 : 0.78); }
for (let y = 0; y < EY.s; y++) for (let x = 0; x < EY.s; x++) { const q = 3 * ((EY.y + y) * W + EY.x + x); mr[q + 1] = R(0.3); }

// the band's cloth (bust.mjs: the new part's shirt round the sides and the back, the regions' map over the whole atlas):
// its region's roughness, no skin relief
if (reg.info.height * MS > TH + 1) for (let y = TH; y < NH; y++) for (let x = 0; x < W; x++) { const r = regionAt(x, y); if (!r) continue; const q = 3 * (y * W + x); nrm[q] = 128; nrm[q + 1] = 128; nrm[q + 2] = 255; mr[q + 1] = R(byRegion[r] ?? 0.86); }
const tex = (buf, name) => doc.createTexture(name).setMimeType('image/webp');
const nT = tex(null, 'normal').setImage(await sharp(nrm, { raw: { width: W, height: NH, channels: 3 } }).webp({ quality: 92 }).toBuffer());
const mT = tex(null, 'roughness').setImage(await sharp(mr, { raw: { width: W, height: NH, channels: 3 } }).webp({ quality: 90 }).toBuffer());
mat.setNormalTexture(nT).setNormalScale(1).setMetallicRoughnessTexture(mT).setRoughnessFactor(1).setMetallicFactor(0);
// (the same sampler and uv as the colour map)
const bi = mat.getBaseColorTextureInfo(), ni = mat.getNormalTextureInfo(), mi = mat.getMetallicRoughnessTextureInfo();
for (const t of [ni, mi]) { t.setTexCoord(bi.getTexCoord()); t.setMagFilter(bi.getMagFilter()); t.setMinFilter(bi.getMinFilter()); t.setWrapS(bi.getWrapS()); t.setWrapT(bi.getWrapT()); }
await io.write(outPath, doc);
const fs = await import('fs'); console.log(outPath, (fs.statSync(outPath).size / 1024).toFixed(0), 'KB');
