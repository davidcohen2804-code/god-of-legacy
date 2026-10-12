// The heroes' own clips on the PvP screens, made by each class chat (an entrance that ends in the VS stance, a victory
// move that ends in the win pose) and keyed here to see-through WebM. The entrance plays over the VS loading screen's
// painting and hands over to it at the end (a short crossfade: the clip's last frame lies on the painting); the victory
// move plays on the result screen and hands over the same way — or holds its last frame where that frame is not the
// painting. Where each clip's frame lies on its painting (percent of the painting's box) was measured on its last frame.
// No clip (Safari: WebM without its alpha, reduced motion, slow to arrive): the painting stays, as before.

export type ClipKind = 'vs' | 'win';
/** l, t, w, h: the clip's frame on the painting's box (%); hand: its last frame is the painting (hand over at the end). */
interface Fit { l: number; t: number; w: number; h: number; hand: boolean }
const CLIPS: Record<string, Partial<Record<ClipKind, Fit>>> = {
  gambler: { vs: { l: -0.42, t: -0.13, w: 100.15, h: 100.15, hand: true }, win: { l: 0, t: 0, w: 100, h: 100, hand: false } },
  samurai: { vs: { l: -0.02, t: 0.09, w: 99.6, h: 99.6, hand: true }, win: { l: -0.34, t: -0.26, w: 100.32, h: 100.32, hand: true } },
  warrior: { vs: { l: -6.14, t: 0.21, w: 111.81, h: 99.27, hand: true }, win: { l: -5.94, t: 0.11, w: 111.86, h: 99.32, hand: true } },
};
/** How long a clip may take to be ready before the painting simply stays (ms). */
const START_MS = 2500;
const FADE = 'opacity .32s ease';

const reduced = (): boolean => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
/** A see-through WebM plays as one here (Safari shows it on black: no clips there). */
function alphaWebm(): boolean {
  const ua = navigator.userAgent, safari = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox|FxiOS|CriOS/.test(ua);
  return !safari && !!document.createElement('video').canPlayType('video/webm; codecs="vp9"');
}

export const hasClip = (cls: string | undefined, kind: ClipKind): boolean => !!cls && !!CLIPS[cls]?.[kind];
const url = (cls: string, kind: ClipKind) => `assets/final/heroes/${cls}/${kind}_in.webm`;
const warmed = new Set<string>();
/** Fetches a clip ahead (into the browser's cache) — at the select screen's lock-in, at the match start for the victory
 *  clips — so it is there, ready, when its screen comes (the arena's own loading would otherwise crowd it out). */
export function warmClip(cls: string | undefined, kind: ClipKind): void {
  if (!cls || !hasClip(cls, kind) || reduced() || !alphaWebm()) return;
  const u = url(cls, kind);
  if (warmed.has(u)) return;
  warmed.add(u);
  void fetch(u, { priority: 'low' } as RequestInit).then((r) => r.blob()).catch(() => warmed.delete(u));
}

/** Plays `cls`'s `kind` clip over `img` (the painting, in its own box, with its living canvas if any); false: none here. */
export function playClip(img: HTMLImageElement, cls: string | undefined, kind: ClipKind, rate = 1): boolean {
  const fit = cls ? CLIPS[cls]?.[kind] : undefined, box = img.parentElement;
  if (!fit || !box || reduced() || !alphaWebm()) return false;
  const cs = getComputedStyle(img), mirror = /^matrix\(-1/.test(cs.transform);
  const v = document.createElement('video');
  v.className = 'gol-clip'; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.disablePictureInPicture = true;
  Object.assign(v.style, {
    position: 'absolute', left: `${mirror ? 100 - fit.l - fit.w : fit.l}%`, top: `${fit.t}%`, width: `${fit.w}%`, height: `${fit.h}%`, objectFit: 'fill',
    pointerEvents: 'none', filter: cs.filter, transform: mirror ? 'scaleX(-1)' : '', opacity: '0', transition: FADE,
  });
  v.src = url(cls!, kind);
  box.appendChild(v);
  const art = () => [...box.children].filter((e): e is HTMLElement => e !== v && (e.tagName === 'IMG' || e.tagName === 'CANVAS'));
  const show = (on: boolean) => { for (const e of art()) { e.style.transition = FADE; e.style.opacity = on ? '' : '0'; } };
  const drop = () => { v.pause(); v.remove(); show(true); };
  let ready = false;
  const late = window.setTimeout(() => { if (!ready) drop(); }, START_MS); // (not ready in time: the painting stays)
  v.addEventListener('canplaythrough', () => { // (it starts only once it can play to the end: never a stall mid-move)
    if (ready || !v.isConnected) return;
    ready = true; window.clearTimeout(late); v.playbackRate = rate;
    void v.play().catch(drop);
  });
  v.addEventListener('playing', () => { v.style.opacity = '1'; show(false); }, { once: true }); // (a crossfade: painting out, clip in)
  v.addEventListener('ended', () => { if (!fit.hand) return; show(true); v.style.opacity = '0'; window.setTimeout(() => v.remove(), 400); }, { once: true });
  v.addEventListener('error', () => { window.clearTimeout(late); drop(); }, { once: true });
  v.load();
  return true;
}
