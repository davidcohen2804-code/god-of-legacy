// A hero's painting brought to life on the PvP screens (VS, result): the painting itself — crisp at any size — moved by
// a small motion atlas: the motion of a short AI clip of that very painting, measured as optical flow, with the face,
// hands and weapon held rigid (they ride the body's sway, never bend) and the feet planted. Capes, cloth and hair flow in
// the wind, the body breathes. It plays forth and back (easing at both ends) in a WebGL canvas laid over the <img>,
// which stays underneath as the fallback (no WebGL, no atlas yet, reduced motion).

/** The heroes whose art has a motion atlas: assets/final/heroes/<cls>/<kind>_flow.webp. */
const LIVE: Record<LiveKind, ReadonlySet<string>> = { vs: new Set(['warrior', 'samurai', 'book_mage', 'archer', 'gambler']), win: new Set() };
export type LiveKind = 'vs' | 'win';
/** The atlas: `frames` flows at `fps`, `cw` x `ch` each, `cols` to a row; R = x, G = y (128 = still, ±127 = ±range px of the art). */
const ATLAS = { frames: 61, fps: 12, cols: 8, cw: 128, ch: 192, range: 80 };
/** One pass (forth or back) takes this much longer than the clip did (a calmer sway). */
const SLOW = 1.25;
/** Drawn at most this often (ms). */
const FRAME_MS = 32;
/** A software renderer (no graphics card: SwiftShader, llvmpipe…) — warping a big painting every frame would choke it. */
function softGl(gl: WebGLRenderingContext): boolean {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(r);
}

export const hasLife = (cls: string | undefined, kind: LiveKind): boolean => !!cls && LIVE[kind].has(cls);

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v;
uniform sampler2D art, flow;
uniform vec2 cell, inset, artPx;
uniform vec4 fr;
uniform float mixv, range;
vec2 at(vec2 cr) { vec2 q = cr * cell + clamp(v * cell, inset, cell - inset); vec2 c = texture2D(flow, q).rg; return (c * 255.0 - 128.0) / 127.0 * range; }
void main() { vec2 d = mix(at(fr.xy), at(fr.zw), mixv) / artPx; gl_FragColor = texture2D(art, v + d); }`;

const reduced = (): boolean => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const loaded = (src: string): Promise<HTMLImageElement> => new Promise((ok, no) => {
  const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => no(new Error(src)); i.src = src;
});

/** Brings `img` (a hero's VS splash or victory pose, already in the page) to life, if that art has motion. */
export function liven(img: HTMLImageElement, cls: string | undefined, kind: LiveKind): void {
  if (!hasLife(cls, kind) || reduced()) return;
  const cv = document.createElement('canvas');
  cv.className = 'gol-live';
  Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', visibility: 'hidden', pointerEvents: 'none' });
  img.insertAdjacentElement('afterend', cv);
  void Promise.all([loaded(img.currentSrc || img.src), loaded(`assets/final/heroes/${cls}/${kind}_flow.webp`)])
    .then(([a, f]) => { if (cv.isConnected) run(cv, img, a, f); else cv.remove(); })
    .catch(() => cv.remove());
}

function run(cv: HTMLCanvasElement, img: HTMLImageElement, art: HTMLImageElement, flow: HTMLImageElement): void {
  cv.width = art.naturalWidth; cv.height = art.naturalHeight;
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: true });
  if (!gl || softGl(gl)) { gl?.getExtension('WEBGL_lose_context')?.loseContext(); cv.remove(); return; } // (no graphics card: the painting stays still)
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.remove(); return; }
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = (unit: number, im: HTMLImageElement, premul: boolean) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premul);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, premul ? gl.BROWSER_DEFAULT_WEBGL : gl.NONE); // (the flow is data, not colour)
    gl.texImage2D(gl.TEXTURE_2D, 0, premul ? gl.RGBA : gl.RGB, premul ? gl.RGBA : gl.RGB, gl.UNSIGNED_BYTE, im);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  };
  tex(0, art, true); tex(1, flow, false);
  const u = (n: string) => gl.getUniformLocation(pr, n);
  gl.uniform1i(u('art'), 0); gl.uniform1i(u('flow'), 1);
  const AW = flow.naturalWidth, AH = flow.naturalHeight;
  gl.uniform2f(u('cell'), ATLAS.cw / AW, ATLAS.ch / AH);
  gl.uniform2f(u('inset'), 0.5 / AW, 0.5 / AH);
  gl.uniform2f(u('artPx'), art.naturalWidth, art.naturalHeight);
  gl.uniform1f(u('range'), ATLAS.range);
  const uFr = u('fr'), uMix = u('mixv');
  gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0);
  // the canvas wears the picture's own look (its glow, its mirror on the right-hand side)
  const cs = getComputedStyle(img);
  cv.style.filter = cs.filter; cv.style.transform = cs.transform === 'none' ? '' : cs.transform;
  const last = ATLAS.frames - 1, cr = (i: number): [number, number] => [i % ATLAS.cols, Math.floor(i / ATLAS.cols)];
  const draw = (f: number) => {
    const i0 = Math.min(last, Math.floor(f)), i1 = Math.min(last, i0 + 1), [c0, r0] = cr(i0), [c1, r1] = cr(i1);
    gl.uniform4f(uFr, c0, r0, c1, r1); gl.uniform1f(uMix, f - i0);
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  draw(0);
  cv.style.visibility = ''; img.style.visibility = 'hidden'; // (frame 0 is the painting itself: no jump)
  const pass = (last / ATLAS.fps) * SLOW * 1000, t0 = performance.now();
  let drawn = 0;
  const tick = (now: number) => {
    if (!cv.isConnected) { gl.getExtension('WEBGL_lose_context')?.loseContext(); return; }
    if (now - drawn >= FRAME_MS) { // (the motion is 12 fps under it: 30 drawn a second are plenty)
      drawn = now;
      const ph = (((now - t0) / pass) % 2 + 2) % 2; // forth (0..1), back (1..2), eased at both ends
      draw((last * (1 - Math.cos(Math.PI * ph))) / 2);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
