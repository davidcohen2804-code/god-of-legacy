// The PvP arena's loading screen (Tekken-style): the two chosen fighters face to face, big — each on its side of a
// burning diagonal in its colours, over the courtyard by night — their names, the VS emblem slammed between them, the
// stage and a slanted loading bar. DOM over the canvas (1920x1080 design px, scaled by syncOverlay); it goes when the
// arena's files are in.
import Phaser from 'phaser';
import '@fontsource/exo-2/800-italic.css';
import '@fontsource/exo-2/900-italic.css';
import { CLASS_NAMES } from '../config/layout';
import { heroArt } from '../pvp/Fighters';
import { syncOverlay } from './CharacterSelectUI';
import { heroFx } from './HeroFx';

/** One side of the loading screen: a fighter's name and class (`you`: yours). */
export interface LoadSide { name: string; cls: string; you?: boolean }

const STYLE_ID = 'gol-al-style';
const DISPLAY = "'Exo 2', 'Segoe UI', sans-serif";
const LABEL = "Inter, 'Segoe UI', sans-serif";
const BACKDROP = 'assets/character_select/pvp_select_bg.webp';
const VS_EMBLEM = 'assets/hud/vs_emblem.webp';
/** The widest a name may be (it shrinks to fit). */
const NAME_W = 700;

const CSS = `
.gol-al{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;overflow:hidden;z-index:40;pointer-events:none;background:#03050a;font-family:${DISPLAY};color:#fff;user-select:none}
.gol-al.out{animation:alOut .45s ease-in forwards}
@keyframes alOut{to{opacity:0}}
.gol-al .al-in{position:absolute;inset:0;animation:alShake .5s linear .42s}
@keyframes alShake{0%,100%{transform:none}14%{transform:translate(-18px,8px)}28%{transform:translate(15px,-10px)}42%{transform:translate(-11px,7px)}57%{transform:translate(9px,-5px)}71%{transform:translate(-5px,3px)}85%{transform:translate(2px,-1px)}}
.gol-al .al-bg{position:absolute;inset:-30px;background:url("${BACKDROP}") center/cover;filter:blur(6px) brightness(.42) saturate(1.15);transform:scale(1.04);animation:alBg 9s linear both}
@keyframes alBg{to{transform:scale(1.12)}}
/* the two halves: each fighter's colour, split by a diagonal */
.gol-al .al-h{position:absolute;top:0;width:1100px;height:1080px;overflow:hidden}
.gol-al .al-h.l{left:0;clip-path:polygon(0 0,100% 0,calc(100% - 280px) 100%,0 100%);animation:alInL .5s cubic-bezier(.2,.9,.25,1) both}
.gol-al .al-h.r{right:0;clip-path:polygon(280px 0,100% 0,100% 100%,0 100%);animation:alInR .5s cubic-bezier(.2,.9,.25,1) both}
@keyframes alInL{from{transform:translateX(-100%)}}
@keyframes alInR{from{transform:translateX(100%)}}
.gol-al .al-h.l{background:linear-gradient(100deg,rgba(3,5,10,.82) 0%,rgba(3,5,10,.35) 55%,var(--g) 120%)}
.gol-al .al-h.r{background:linear-gradient(260deg,rgba(3,5,10,.82) 0%,rgba(3,5,10,.35) 55%,var(--g) 120%)}
.gol-al .al-rays{position:absolute;inset:-240px;background:repeating-linear-gradient(104deg,rgba(255,255,255,0) 0 52px,rgba(255,255,255,.06) 54px 57px,rgba(255,255,255,0) 59px 112px);animation:alRays .7s linear infinite}
.gol-al .al-h.r .al-rays{animation-direction:reverse}
@keyframes alRays{to{transform:translateX(115px)}}
.gol-al .al-glow{position:absolute;top:120px;width:1100px;height:1100px;border-radius:50%;background:radial-gradient(circle,var(--g) 0%,rgba(0,0,0,0) 60%);animation:alGlow 2.2s ease-in-out infinite alternate}
.gol-al .al-h.l .al-glow{left:-160px}
.gol-al .al-h.r .al-glow{right:-160px}
@keyframes alGlow{from{opacity:.55}to{opacity:1}}
/* the fighters, big: head to thighs */
.gol-al .al-art{position:absolute;top:-40px;width:1160px;height:1740px;transform-origin:50% 12%} /* (the slow push grows from the face: the head stays in frame) */
.gol-al .al-h.l .al-art{left:-10px;animation:alArtL .7s cubic-bezier(.12,.85,.2,1) .08s both,alPush 9s linear .8s both}
.gol-al .al-h.r .al-art{right:-10px;animation:alArtR .7s cubic-bezier(.12,.85,.2,1) .08s both,alPush 9s linear .8s both}
.gol-al .al-art img{display:block;width:100%;height:100%;filter:drop-shadow(0 0 3px rgba(255,255,255,.5)) drop-shadow(0 0 30px var(--c))}
.gol-al .al-h.r .al-art img{transform:scaleX(-1)}
.gol-al .al-art.card img{width:auto;height:72%;margin:16% auto 0;object-fit:contain}
@keyframes alArtL{0%{transform:translateX(-460px);filter:blur(12px);opacity:0}100%{transform:none;filter:none;opacity:1}}
@keyframes alArtR{0%{transform:translateX(460px);filter:blur(12px);opacity:0}100%{transform:none;filter:none;opacity:1}}
@keyframes alPush{from{scale:1}to{scale:1.07}}
.gol-al .al-h::after{content:'';position:absolute;left:0;right:0;bottom:0;height:420px;background:linear-gradient(180deg,rgba(3,5,10,0),rgba(3,5,10,.92) 78%)}
/* the seam of light between them */
.gol-al .al-seam{position:absolute;left:957px;top:-30px;width:6px;height:1140px;transform:rotate(14.53deg);
  background:linear-gradient(180deg,rgba(255,236,190,0),#fff 16%,#fff 66%,rgba(255,236,190,0) 84%);box-shadow:0 0 22px 6px rgba(255,200,110,.75);animation:alSeam 1.6s ease-in-out .4s infinite alternate;
  -webkit-mask:linear-gradient(180deg,#000 70%,transparent 86%);mask:linear-gradient(180deg,#000 70%,transparent 86%)} /* (fades out above the stage line) */
@keyframes alSeam{from{opacity:.55}to{opacity:1;box-shadow:0 0 44px 14px rgba(255,214,140,.9)}}
/* embers rising from the floor */
.gol-al .al-em{position:absolute;bottom:-20px;border-radius:50%;background:#fff;box-shadow:0 0 8px 3px var(--e);animation:alEm linear infinite}
@keyframes alEm{0%{transform:translate(0,0);opacity:0}12%{opacity:1}100%{transform:translate(var(--dx),-1150px);opacity:0}}
/* names */
.gol-al .al-nm{position:absolute;bottom:170px;display:flex;flex-direction:column;gap:12px;animation:alNm .5s ease-out .35s both}
.gol-al .al-nm.l{left:92px;align-items:flex-start}
.gol-al .al-nm.r{right:92px;align-items:flex-end}
@keyframes alNm{from{opacity:0;transform:translateY(26px)}}
.gol-al .al-nm b{font:900 italic 96px/1.02 ${DISPLAY};text-transform:uppercase;white-space:nowrap;color:#fff6dc;max-width:${NAME_W}px;padding:0 6px;
  text-shadow:0 5px 0 rgba(0,0,0,.75),0 0 30px var(--g)}
.gol-al .al-nm i{font:800 italic 22px/36px ${DISPLAY};font-style:italic;letter-spacing:4px;text-transform:uppercase;color:#0b0d12;padding:0 28px;background:var(--c);clip-path:polygon(13px 0,100% 0,calc(100% - 13px) 100%,0 100%)}
/* the VS emblem between them */
.gol-al .al-vs{position:absolute;left:50%;top:300px;width:470px;margin-left:-235px;filter:drop-shadow(0 14px 30px rgba(0,0,0,.75));animation:alVs .45s cubic-bezier(.3,1.35,.5,1) .38s both,alVsGlow 1.6s ease-in-out .9s infinite alternate}
@keyframes alVs{0%{opacity:0;transform:scale(3.2)}60%{opacity:1;transform:scale(.92)}100%{opacity:1;transform:scale(1)}}
@keyframes alVsGlow{to{filter:drop-shadow(0 14px 30px rgba(0,0,0,.75)) drop-shadow(0 0 26px rgba(255,150,40,.65))}}
.gol-al .al-flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 44%,rgba(255,240,210,.95),rgba(255,160,60,.35) 30%,rgba(0,0,0,0) 60%);opacity:0;animation:alFlash .6s ease-out .4s both}
@keyframes alFlash{0%{opacity:0}15%{opacity:1}100%{opacity:0}}
/* the stage and the loading bar */
.gol-al .al-ft{position:absolute;left:0;right:0;bottom:46px;display:flex;flex-direction:column;align-items:center;gap:12px;animation:alNm .5s ease-out .5s both}
.gol-al .al-st{font:700 italic 15px/20px ${LABEL};letter-spacing:6px;color:rgba(232,220,190,.85);text-shadow:0 2px 4px #000}
.gol-al .al-st b{color:#ffe7a6;font-weight:800}
.gol-al .al-bar{position:relative;width:660px;height:16px;clip-path:polygon(9px 0,100% 0,calc(100% - 9px) 100%,0 100%);background:linear-gradient(180deg,#ffffff,#9aa3b8 40%,#2a303d 70%,#d7ae58);padding:2px;box-sizing:border-box}
.gol-al .al-tk{position:relative;width:100%;height:100%;clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);background:#05070c;overflow:hidden}
.gol-al .al-fl{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(180deg,#fffef0 0%,#fff27c 22%,#ffd21f 50%,#f6980c 80%,#c66506 100%);transition:width .25s ease-out}
.gol-al .al-fl::after{content:'';position:absolute;top:0;bottom:0;right:0;width:60px;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.85));filter:blur(2px)}
.gol-al .al-pc{display:flex;align-items:baseline;gap:12px;font:700 italic 13px/1 ${LABEL};letter-spacing:5px;color:#d8cfb8;text-shadow:0 2px 4px #000}
.gol-al .al-pc b{font:900 italic 26px/1 ${DISPLAY};letter-spacing:1px;color:#fff;min-width:64px;text-align:left}
.gol-al .al-pc b.rd{min-width:0;letter-spacing:4px;color:#ffe9a8;text-shadow:0 0 18px rgba(255,190,80,.7);animation:alRd .7s ease-in-out infinite alternate}
@keyframes alRd{to{color:#ffffff;text-shadow:0 0 28px rgba(255,210,120,1)}}`;

/** The loading screen still up (the arena loaded, the match not yet past its VS): the match can take it over as its VS. */
let curtain: { out(): void; taken: boolean } | null = null;
/** The match takes the loading screen over as its VS (it stays up until out()); null when it is gone already. */
export function takeArenaLoading(): { out(): void } | null {
  const c = curtain; if (!c) return null;
  c.taken = true; return c;
}

/** Shows the loading screen for the arena's preload; false when there is nothing to load (or no art), so the caller
 *  can fall back to the plain one. Loaded, it reads READY and stays a moment: the match's start takes it over as its VS
 *  (takeArenaLoading), else it goes by itself. */
export function showArenaLoading(scene: Phaser.Scene, l: LoadSide, r: LoadSide): boolean {
  const load = scene.load, canvas = scene.game.canvas, host = canvas.parentElement;
  const al = heroArt(l.cls), ar = heroArt(r.cls);
  if (load.list.size === 0 || !host || !al || !ar) return false;
  if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); return e;
  };
  const root = el('div', 'gol-al', host);
  el('div', 'al-bg', root);
  const box = el('div', 'al-in', root); // (everything but the backdrop: shaken by the VS slam)
  const sides: [string, LoadSide, NonNullable<typeof al>][] = [['l', l, al], ['r', r, ar]];
  for (const [s, f, a] of sides) {
    const h = el('div', `al-h ${s}`, box);
    h.style.setProperty('--c', a.color); h.style.setProperty('--g', a.glow);
    el('div', 'al-rays', h); el('div', 'al-glow', h);
    const fx = heroFx(f.cls, { W: 1100, H: 1080, ax: 560, ay: 430, k: 1.3, mirror: s === 'r' }); // their own things flying round them
    if (fx) h.appendChild(fx.back);
    const img = el('img', '', el('div', a.card ? 'al-art card' : 'al-art', h));
    img.src = a.url; img.alt = ''; img.draggable = false;
    if (fx) h.appendChild(fx.front);
  }
  el('div', 'al-seam', box);
  for (const [s, f, a] of sides) {
    const n = el('div', `al-nm ${s}`, box), b = el('b', '', n);
    n.style.setProperty('--c', a.color); n.style.setProperty('--g', a.glow);
    b.textContent = f.name;
    const cls = (CLASS_NAMES[f.cls] ?? f.cls).toUpperCase();
    el('i', '', n).textContent = f.you ? `${cls}  ·  YOU` : cls;
    const fit = () => { // a long name: smaller until it fits
      b.style.fontSize = '';
      for (let px = 96, i = 0; b.scrollWidth > NAME_W && i < 6 && px > 40; i++) { px = Math.max(40, Math.floor((px * NAME_W) / b.scrollWidth) - 1); b.style.fontSize = `${px}px`; }
    };
    fit(); void document.fonts?.load(`italic 900 96px ${DISPLAY}`).then(() => { if (b.isConnected) fit(); }).catch(() => undefined);
  }
  el('div', 'al-flash', box);
  const vs = el('img', 'al-vs', box); vs.src = VS_EMBLEM; vs.alt = 'VS'; vs.draggable = false;
  const ft = el('div', 'al-ft', box), st = el('div', 'al-st', ft);
  st.append('STAGE  ·  '); el('b', '', st).textContent = 'LEGACY COURTYARD';
  const fill = el('div', 'al-fl', el('div', 'al-tk', el('div', 'al-bar', ft)));
  const pc = el('div', 'al-pc', ft); pc.append('LOADING'); const pct = el('b', '', pc); pct.textContent = '0%';

  let rect = '', alive = true;
  const fitRoot = () => { if (!alive) return; rect = syncOverlay(root, host, canvas, rect); requestAnimationFrame(fitRoot); };
  fitRoot();
  const onProgress = (p: number) => { fill.style.width = `${Math.round(p * 100)}%`; pct.textContent = `${Math.round(p * 100)}%`; };
  const out = () => {
    if (curtain === me) curtain = null;
    if (!alive || root.classList.contains('out')) return;
    root.classList.add('out');
    window.setTimeout(() => { alive = false; root.remove(); }, 480);
  };
  const me = { out, taken: false };
  const done = () => {
    load.off(Phaser.Loader.Events.PROGRESS, onProgress);
    fill.style.width = '100%';
    pc.replaceChildren(); el('b', 'rd', pc).textContent = 'GET READY';
    curtain = me;
    window.setTimeout(() => { if (!me.taken) out(); }, 1500); // (no scene took it over: it goes by itself)
  };
  load.on(Phaser.Loader.Events.PROGRESS, onProgress);
  load.once(Phaser.Loader.Events.COMPLETE, done);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { alive = false; root.remove(); if (curtain === me) curtain = null; });
  return true;
}
