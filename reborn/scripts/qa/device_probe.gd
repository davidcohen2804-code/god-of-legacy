class_name DeviceProbe
extends RefCounted
## (Device test, web) What the page itself knows, gathered in the page (GPT's v1.7) and read a few times a second, never
## every frame: the browser's user agent, the CSS viewport and device pixel ratio, the canvas's size, the GPU as WebGL
## names it (null — shown "Unavailable" — when the browser will not say), the build (version.json), whether fullscreen
## can be asked for; JavaScript errors and unhandled promise rejections (counted, the last three kept), WebGL context
## losses on the game's canvas, and the tab hidden or shown. It stays on the device: nothing is sent anywhere.

const INSTALL := """(() => {
  if (window.__golDev) return;
  const d = { js: 0, jsLast: [], lost: 0, restored: 0, flips: 0, gpu: null, build: null };
  const keep = (m) => { d.js++; d.jsLast.push(String(m).slice(0, 160)); if (d.jsLast.length > 3) d.jsLast.shift(); };
  window.addEventListener('error', (e) => keep(e.message || 'error'));
  window.addEventListener('unhandledrejection', (e) => keep('promise: ' + ((e.reason && e.reason.message) || e.reason)));
  document.addEventListener('visibilitychange', () => { d.flips++; });
  const canvas = document.getElementById('canvas') || document.querySelector('canvas');
  if (canvas) {
    canvas.addEventListener('webglcontextlost', () => { d.lost++; });
    canvas.addEventListener('webglcontextrestored', () => { d.restored++; });
  }
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2') || c.getContext('webgl');
    const x = g && g.getExtension('WEBGL_debug_renderer_info');
    if (x) d.gpu = String(g.getParameter(x.UNMASKED_RENDERER_WEBGL)) + ' / ' + String(g.getParameter(x.UNMASKED_VENDOR_WEBGL));
    const lose = g && g.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (e) { /* (left Unavailable) */ }
  fetch('version.json', { cache: 'no-store' }).then((r) => r.json())
    .then((j) => { d.build = String(j.commit) + ' (' + String(j.built) + ')'; }).catch(() => {});
  d.now = () => ({
    ua: navigator.userAgent, vw: window.innerWidth, vh: window.innerHeight, dpr: window.devicePixelRatio,
    cw: canvas ? canvas.width : 0, ch: canvas ? canvas.height : 0, gpu: d.gpu, build: d.build,
    fs: !!(document.fullscreenEnabled && document.documentElement.requestFullscreen), full: !!document.fullscreenElement,
    js: d.js, jsLast: d.jsLast, lost: d.lost, restored: d.restored, hidden: document.hidden, flips: d.flips,
  });
  window.__golDev = d;
})()"""


static func install() -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval(INSTALL, true)


## The page's report now ({} outside the web, or before it is installed).
static func read() -> Dictionary:
	if not OS.has_feature("web"):
		return {}
	var s: Variant = JavaScriptBridge.eval("JSON.stringify(window.__golDev ? window.__golDev.now() : null)", true)
	if typeof(s) != TYPE_STRING:
		return {}
	var d: Variant = JSON.parse_string(String(s))
	return d if d is Dictionary else {}


## Fullscreen on or off (from a tap: the browser allows it only right after one; where it cannot, nothing happens).
static func toggle_fullscreen() -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("""(() => {
			if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
			const el = document.documentElement;
			if (document.fullscreenEnabled && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
		})()""", true)
