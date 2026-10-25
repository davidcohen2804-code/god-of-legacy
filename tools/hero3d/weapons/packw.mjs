// A weapon GLB packed as the game's: its drawing as WebP (at most 512 × 1024), meshopt-compressed.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, textureCompress, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const [inp, out] = process.argv.slice(2);
const d = await io.read(inp);
await d.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 86, resize: [512, 1024] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, d);
const fs = await import('fs'); console.log(out, (fs.statSync(out).size / 1024).toFixed(1), 'KB');
