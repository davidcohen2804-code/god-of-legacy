// The arena camera as the player sets it (gear menu > CAMERA, or the mouse wheel over the arena): how close it is (x the
// view that fits the whole arena) and its angle (the view moved down to look more from above, up to look more from
// below). Live while you play; SAVE keeps it for the next time (this browser).
const KEY = 'godoflegacy.camera';

export const CAM = {
  /** x the fitting view: 0.8 = farther (the arena's surroundings show), 1.35 = closer. One mouse-wheel notch = x1.06. */
  zoom: { min: 0.8, max: 1.35, def: 1, notch: 1.06 },
  /** -1 = most from below (more of the back and the sky), 1 = most from above (more of the floor in front): the view
   *  moves as far as you stay in full view. */
  angle: { min: -1, max: 1, def: 0 },
} as const;

export interface CamPrefs { zoom: number; angle: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fix = (p: Partial<CamPrefs> | null | undefined, base: CamPrefs): CamPrefs => ({
  zoom: clamp(Number.isFinite(p?.zoom) ? Number(p!.zoom) : base.zoom, CAM.zoom.min, CAM.zoom.max),
  angle: clamp(Number.isFinite(p?.angle) ? Number(p!.angle) : base.angle, CAM.angle.min, CAM.angle.max),
});
const DEF: CamPrefs = { zoom: CAM.zoom.def, angle: CAM.angle.def };

function load(): CamPrefs {
  try { return fix(JSON.parse(localStorage.getItem(KEY) ?? 'null'), DEF); } catch { return { ...DEF }; }
}

let live: CamPrefs = load();

/** The camera now (saved or not). */
export function camPrefs(): CamPrefs { return live; }
/** Change it now (not kept until SAVE). */
export function setCam(p: Partial<CamPrefs>): CamPrefs { live = fix(p, live); return live; }
/** Back to the default view (not kept until SAVE). */
export function resetCam(): CamPrefs { live = { ...DEF }; return live; }
/** Keep it for the next time. */
export function saveCam(): boolean { try { localStorage.setItem(KEY, JSON.stringify(live)); return true; } catch { return false; } }
/** Is what you see the saved camera? */
export function camSaved(): boolean { const s = load(); return Math.abs(s.zoom - live.zoom) < 1e-3 && Math.abs(s.angle - live.angle) < 1e-3; }
