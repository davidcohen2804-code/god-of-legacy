import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';
const [src, png, out] = process.argv.slice(2);
const io = new NodeIO(); const doc = await io.read(src);
const tex = doc.createTexture('BeginnerColor').setImage(fs.readFileSync(png)).setMimeType('image/png');
const mat = doc.createMaterial('Beginner').setBaseColorTexture(tex).setRoughnessFactor(0.85).setMetallicFactor(0);
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) p.setMaterial(mat);
await io.write(out, doc); console.log('wrote', out);
