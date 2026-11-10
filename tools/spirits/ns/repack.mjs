// One atlas for the new Samurai (test only): the model's three textures (the body's, the bust's, the locks' strip) laid
// out again by xatlas; TEXCOORD_0 the new atlas, TEXCOORD_1 the old uvs (rebake.py carries the colours over).
//   node repack.mjs IN.glb OUT.glb [resolution]
import { NodeIO, Document } from '@gltf-transform/core';
import { Api } from 'xatlasjs/dist/node/api.mjs';
import createXAtlasModule from 'xatlasjs/dist/node/xatlas.js';
const [inF, outF, res = '2048'] = process.argv.slice(2);
const io = new NodeIO(); const doc = await io.read(inF);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION').getArray(), UV = prim.getAttribute('TEXCOORD_0').getArray(), I = prim.getIndices().getArray();
console.log('in verts', P.length / 3, 'tris', I.length / 3);
const XA = Api(createXAtlasModule);
const xa = await new Promise((r) => { const a = new XA(() => r(a), (p, d) => (p === 'xatlas.wasm' ? new URL('./node_modules/xatlasjs/dist/node/xatlas.wasm', import.meta.url).pathname : d + p), () => {}); });
xa.createAtlas();
xa.addMesh(new Uint16Array(I), new Float32Array(P), null, new Float32Array(UV), 'm', false, false, 1);
const atlas = xa.generateAtlas({ maxIterations: 2, maxCost: 2 }, { resolution: +res, padding: 6, bilinear: true, rotateCharts: true }, true);
const m = atlas.meshes[0];
console.log('atlas', atlas.width, atlas.height, 'pages', atlas.atlasCount, 'verts', m.vertexCount, 'tris', m.index.length / 3);
const NUV = new Float32Array(m.vertex.coords1); let umx = 0; for (const v of NUV) umx = Math.max(umx, v); if (umx > 1.5) for (let i = 0; i < NUV.length; i += 2) { NUV[i] /= atlas.width; NUV[i + 1] /= atlas.height; }
const od = new Document(); const buf = od.createBuffer();
const pr = od.createPrimitive()
  .setAttribute('POSITION', od.createAccessor().setType('VEC3').setArray(new Float32Array(m.vertex.vertices)).setBuffer(buf))
  .setAttribute('TEXCOORD_0', od.createAccessor().setType('VEC2').setArray(NUV).setBuffer(buf))
  .setAttribute('TEXCOORD_1', od.createAccessor().setType('VEC2').setArray(new Float32Array(m.vertex.coords)).setBuffer(buf))
  .setIndices(od.createAccessor().setType('SCALAR').setArray(new Uint32Array(m.index)).setBuffer(buf));
od.createScene().addChild(od.createNode('NS').setMesh(od.createMesh('NS').addPrimitive(pr)));
await new NodeIO().write(outF, od); console.log('wrote', outF);
