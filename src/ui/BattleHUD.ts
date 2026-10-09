// Battle mode HUD (Tekken-style) for the PvP arena: both fighters' health bars across the top (portrait, name, round wins)
// with the round clock between them; the big calls in metal lettering — VS, ROUND n / FINAL ROUND, FIGHT!, K.O., TIME,
// DOUBLE K.O., DRAW, PERFECT — and the end of the match (VICTORY / DEFEAT / DRAW with REMATCH and EXIT ARENA).
// DOM inside the HUD overlay (1920x1080 design px, scaled with it).
import '@fontsource/cinzel/900.css';
import '@fontsource/exo-2/700-italic.css';
import '@fontsource/exo-2/800-italic.css';
import '@fontsource/exo-2/900-italic.css';
import { PortraitRef } from './hud/HudState';
import { ARENA } from '../combat/Combat';
import { ensureTheme } from './theme';

export type Side = 'l' | 'r';
/** A hero's VS splash art (facing right) and its class colours. */
export interface VsArt { url: string; w: number; h: number; color: string; glow: string; win?: string; card?: boolean }
export interface Fighter { name: string; cls: string; portrait?: PortraitRef; you: boolean; vs?: VsArt }
export type RoundCall = 'ko' | 'double' | 'time' | 'draw';

const STYLE_ID = 'gol-bt-style';
const ARENA_BREAK_MS = ARENA.breakCdMs;
/** VS splash: the widest a fighter's name may be (it shrinks to fit, clear of the VS in the middle). */
const VS_NAME_W = 440;
/** The VS emblem (steel, gold and fire). */
const VS_EMBLEM = 'assets/hud/vs_emblem.webp';
/** The big calls drawn as art in the VS emblem's style (assets/hud/calls/<id>.webp): their height on screen (design px).
 *  A call with no art yet is lettered (word()). */
const CALL_ART: Record<string, number> = { fight: 340, ko: 420, round1: 250, round2: 257, round3: 251, round4: 247, final: 280 };
const callUrl = (id: string) => `assets/hud/calls/${id}.webp`;
/** VS with the heroes' art: the widest a name may be under its hero. */
const VS2_NAME_W = 640;
/** Room around a VS name for its glow (the box clips, for the ellipsis). */
const VS2_PAD = 30;
const TITLE = "Cinzel, Georgia, serif";
/** The fight's own lettering (calls, names, clock): a heavy italic display face, Tekken-style. */
const DISPLAY = "'Exo 2', 'Segoe UI', sans-serif";
/** Small labels (Exo 2's rounded E reads as an "e" under ~16px). */
const LABEL = "'Inter', 'Segoe UI', sans-serif";
/** Metal fills for the lettering: [face gradient, outline, glow]. */
const METAL = {
  gold: ['linear-gradient(180deg,#fffdf2 0%,#ffeab2 24%,#f7c75c 47%,#9a580b 50%,#d58d27 68%,#ffe7a1 100%)', '#2b1404', 'rgba(255,178,64,.55)'],
  fire: ['linear-gradient(180deg,#ffffff 0%,#fff3a6 20%,#ffb52e 46%,#e4500e 50%,#b0230a 72%,#ffad6a 100%)', '#2a0502', 'rgba(255,86,18,.7)'],
  blood: ['linear-gradient(180deg,#fff5ef 0%,#ffb3a2 22%,#f2402e 47%,#880b06 50%,#c01d11 70%,#ff9a78 100%)', '#200101', 'rgba(255,36,18,.68)'],
  steel: ['linear-gradient(180deg,#ffffff 0%,#e8f2ff 24%,#9fc4ef 47%,#2a4c82 50%,#5d89c6 70%,#e0f0ff 100%)', '#07111f', 'rgba(96,164,255,.55)'],
} as const;
type Metal = keyof typeof METAL;

const CSS = `
.gol-bt{position:absolute;left:0;top:0;width:1920px;height:1080px;pointer-events:none;z-index:12;color:#f3e3bd;font-family:var(--gl-body)}
.gol-bt .b-top{position:absolute;left:0;top:0;width:1920px;height:150px;opacity:0;transform:translateY(-26px);transition:opacity .35s ease,transform .35s ease}
.gol-bt.on .b-top{opacity:1;transform:none}
.gol-bt.on.res .b-top{opacity:0;transform:translateY(-26px)}
.gol-hud:has(> .gol-bt.res) > .fx{visibility:hidden} /* (your buffs, under your bar: gone with it) */
/* a fighter (Tekken-style: sharp, slanted, metal-edged): portrait, health bar, name, round wins; --c = the class colour */
.gol-bt .b-sd{position:absolute;top:14px;width:900px;height:140px;--c:#f0cc80}
.gol-bt .b-sd.l{left:22px}
.gol-bt .b-sd.r{right:22px}
.gol-bt .b-pf{position:absolute;top:0;width:108px;height:108px;filter:drop-shadow(0 6px 12px rgba(0,0,0,.7)) drop-shadow(0 0 7px var(--c))}
.gol-bt .b-sd.l .b-pf{left:0}
.gol-bt .b-sd.r .b-pf{right:0}
.gol-bt .b-pfr,.gol-bt .b-pin{position:absolute}
.gol-bt .b-pfr{inset:0;background:linear-gradient(155deg,#ffffff 0%,var(--c) 30%,#161b26 62%,var(--c) 100%)}
.gol-bt .b-pin{inset:3px;overflow:hidden;background:radial-gradient(ellipse at 50% 40%,#232b3c,#090c14)}
.gol-bt .b-sd.l .b-pfr,.gol-bt .b-sd.l .b-pin{clip-path:polygon(0 0,100% 0,82% 100%,0 100%)}
.gol-bt .b-sd.r .b-pfr,.gol-bt .b-sd.r .b-pin{clip-path:polygon(0 0,100% 0,100% 100%,18% 100%)}
.gol-bt .b-pin .b-img{position:absolute;inset:0;background-repeat:no-repeat}
.gol-bt .b-hb{position:absolute;top:24px;width:770px;height:38px;filter:drop-shadow(0 5px 10px rgba(0,0,0,.7))}
.gol-bt .b-sd.l .b-hb{left:116px}
.gol-bt .b-sd.r .b-hb{right:116px}
.gol-bt .b-hb .b-fr,.gol-bt .b-hb .b-tk{position:absolute;inset:0}
.gol-bt .b-hb .b-fr{background:linear-gradient(180deg,#ffffff 0%,#aab3c6 26%,#3b4252 58%,#20252f 74%,#d7ae58 100%)}
.gol-bt .b-hb .b-tk{inset:3px;overflow:hidden;background:linear-gradient(180deg,#05070c,#141823)}
.gol-bt .b-sd.l .b-hb .b-fr{clip-path:polygon(16px 0,100% 0,calc(100% - 28px) 100%,0 100%)}
.gol-bt .b-sd.l .b-hb .b-tk{clip-path:polygon(15px 0,100% 0,calc(100% - 26px) 100%,0 100%)}
.gol-bt .b-sd.r .b-hb .b-fr{clip-path:polygon(0 0,calc(100% - 16px) 0,100% 100%,28px 100%)}
.gol-bt .b-sd.r .b-hb .b-tk{clip-path:polygon(0 0,calc(100% - 15px) 0,100% 100%,26px 100%)}
.gol-bt .b-hb .b-tr,.gol-bt .b-hb .b-fl{position:absolute;top:0;bottom:0;width:100%}
.gol-bt .b-sd.l .b-hb .b-tr,.gol-bt .b-sd.l .b-hb .b-fl{left:0}
.gol-bt .b-sd.r .b-hb .b-tr,.gol-bt .b-sd.r .b-hb .b-fl{right:0}
.gol-bt .b-hb .b-tr{background:linear-gradient(180deg,#ffc6b8,#f2402a 55%,#9a130a);transition:width .55s cubic-bezier(.4,0,.6,1) .45s}
.gol-bt .b-hb .b-fl{background:linear-gradient(180deg,#fffef0 0%,#fff27c 18%,#ffd21f 48%,#f6980c 78%,#c66506 100%);transition:width 90ms linear,filter .12s}
.gol-bt .b-hb .b-fl::after{content:'';position:absolute;left:0;right:0;top:2px;height:30%;background:linear-gradient(rgba(255,255,255,.75),rgba(255,255,255,0))}
.gol-bt .b-hb .b-tk::after{content:'';position:absolute;top:0;bottom:0;width:120px;left:-140px;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.38),rgba(255,255,255,0));animation:golGleam 4.5s ease-in-out infinite}
@keyframes golGleam{0%,72%{left:-140px}100%{left:110%}}
.gol-bt .b-hb.low .b-fl{background:linear-gradient(180deg,#ffd6ca 0%,#ff7d55 28%,#e23b1c 68%,#a3180a 100%);animation:golLow .6s ease-in-out infinite alternate}
@keyframes golLow{to{filter:brightness(1.4)}}
.gol-bt .b-hb.snap .b-tr,.gol-bt .b-hb.snap .b-fl{transition:none}
.gol-bt .b-hb.hit .b-fl{filter:brightness(1.9)}
.gol-bt .b-nm{position:absolute;top:66px;display:flex;align-items:baseline;gap:12px;height:40px;white-space:nowrap;max-width:620px}
.gol-bt .b-sd.l .b-nm{left:122px}
.gol-bt .b-sd.r .b-nm{right:122px;flex-direction:row-reverse}
.gol-bt .b-nm b{font:800 italic 31px/40px ${DISPLAY};letter-spacing:.5px;color:#ffffff;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;padding:0 6px 0 2px;
  text-shadow:0 2px 0 #000,0 0 14px rgba(0,0,0,.85)}
.gol-bt .b-nm i{flex:none;align-self:center;height:20px;padding:0 12px;clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);background:var(--c);
  font:700 italic 12px/20px ${LABEL};letter-spacing:1.8px;color:#0b0d12;text-transform:uppercase}
.gol-bt .b-nm .b-you{flex:none;align-self:center;height:20px;padding:0 10px;clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);background:linear-gradient(180deg,#ffffff,#c3ccdb);
  font:700 italic 12px/20px ${LABEL};letter-spacing:1.6px;color:#0b0d12;text-shadow:none}
.gol-bt .b-wins{position:absolute;top:76px;display:flex;gap:9px}
.gol-bt .b-sd.l .b-wins{right:46px}
.gol-bt .b-sd.r .b-wins{left:46px}
.gol-bt .b-wn{width:30px;height:12px;transform:skewX(-24deg);border:1.5px solid rgba(214,222,240,.55);background:rgba(6,8,14,.9);box-shadow:0 2px 6px rgba(0,0,0,.6)}
.gol-bt .b-sd.r .b-wn{transform:skewX(24deg)}
.gol-bt .b-wn.on{border-color:#fff7cf;background:linear-gradient(180deg,#fffbe2,#ffd34c 50%,#e08a10);box-shadow:0 0 14px rgba(255,196,70,.95);animation:golWin .5s cubic-bezier(.2,1.4,.4,1)}
@keyframes golWin{0%{scale:2.4;opacity:0}100%{scale:1;opacity:1}}
/* BREAK: under each portrait — ready, now! (bright, pulsing: you are being comboed and can break out), cooling down */
.gol-bt .b-brk{position:absolute;top:114px;width:122px;height:28px;box-sizing:border-box;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:7px;
  clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);background:linear-gradient(180deg,rgba(28,34,48,.95),rgba(8,11,18,.95));
  font:700 italic 13px/1 ${LABEL};letter-spacing:1.6px;color:#eef2ff;box-shadow:inset 0 0 0 1px rgba(220,226,240,.35)}
.gol-bt .b-sd.l .b-brk{left:-6px}
.gol-bt .b-sd.r .b-brk{right:-6px}
.gol-bt .b-brk .b-bk{min-width:20px;height:18px;padding:0 5px;box-sizing:border-box;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.4);font:700 11.5px/16px ${LABEL};letter-spacing:0;text-align:center;color:#fff}
.gol-bt .b-brk .b-bfill{position:absolute;left:0;top:0;bottom:0;background:rgba(255,255,255,.12)}
.gol-bt .b-brk b,.gol-bt .b-brk .b-bk{position:relative}
.gol-bt .b-brk.cd{color:#8d93a0}
.gol-bt .b-brk.cd .b-bk{opacity:.45}
.gol-bt .b-brk.live{color:#fff;background:linear-gradient(180deg,#5aa8ff,#1d4fb0);animation:golBrk .5s ease-in-out infinite alternate}
.gol-bt .b-brk.live .b-bk{background:#fff;color:#123;border-color:#fff}
@keyframes golBrk{to{filter:brightness(1.45)}}
/* the round clock: a hexagonal metal plate */
.gol-bt .b-clk{position:absolute;left:888px;top:8px;width:144px;height:116px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.75))}
.gol-bt .b-clk .b-sh,.gol-bt .b-clk .b-in{position:absolute;inset:0;clip-path:polygon(17% 0,83% 0,100% 42%,83% 100%,17% 100%,0 42%)}
.gol-bt .b-clk .b-sh{background:linear-gradient(180deg,#ffffff 0%,#aab3c6 28%,#3b4252 60%,#d7ae58 100%)}
.gol-bt .b-clk .b-in{inset:3px;background:radial-gradient(ellipse at 50% 28%,#232b3d,#06080e 78%)}
.gol-bt .b-clk .b-n{position:absolute;left:0;right:0;top:13px;text-align:center;font:800 italic 66px/1 ${DISPLAY};letter-spacing:0;font-variant-numeric:tabular-nums;padding-right:6px;
  background:linear-gradient(180deg,#ffffff 0%,#f4f6ff 44%,#a3adc6 56%,#ffffff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 0 rgba(0,0,0,.85))}
.gol-bt .b-clk.urgent .b-n{background:linear-gradient(180deg,#fff2ee 0%,#ff9a82 42%,#e3271a 58%,#ffc3b5 100%);-webkit-background-clip:text;background-clip:text;animation:golTick 1s ease-out infinite}
@keyframes golTick{0%{transform:scale(1.2)}35%{transform:scale(1)}}
.gol-bt .b-clk .b-rd{position:absolute;left:0;right:0;top:84px;text-align:center;font:700 italic 13px/16px ${LABEL};letter-spacing:2.8px;color:#e8c46a}
/* the big calls */
.gol-bt .b-calls{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden}
.gol-bt .b-call{position:absolute;left:0;top:250px;width:1920px;height:440px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.gol-bt .b-call.out{animation:golOut .32s ease-in forwards}
@keyframes golOut{to{opacity:0;transform:scale(1.16)}}
.gol-bt .b-w{position:relative;display:inline-block;isolation:isolate;white-space:nowrap;font-family:${DISPLAY};font-weight:900;font-style:italic;line-height:1.1;letter-spacing:.02em;padding:0 .16em}
.gol-bt .b-w .b-f{color:transparent;background-image:var(--g);-webkit-background-clip:text;background-clip:text}
.gol-bt .b-w::before,.gol-bt .b-w::after{content:attr(data-t);position:absolute;left:0;top:0;width:100%;height:100%;padding:inherit;box-sizing:border-box}
.gol-bt .b-w::before{z-index:-1;color:var(--o);-webkit-text-stroke:.11em var(--o);filter:drop-shadow(0 .055em 0 rgba(0,0,0,.6)) drop-shadow(0 0 .2em var(--gl))}
.gol-bt .b-w::after{color:transparent;background-image:linear-gradient(100deg,rgba(255,255,255,0) 42%,rgba(255,255,255,.95) 50%,rgba(255,255,255,0) 58%);
  background-size:320% 100%;background-repeat:no-repeat;background-position:160% 0;-webkit-background-clip:text;background-clip:text;animation:golShine .9s ease-out .28s forwards}
@keyframes golShine{to{background-position:-60% 0}}
.gol-bt .b-call.in .b-w{animation:golIn .45s cubic-bezier(.2,.9,.25,1.12) both}
.gol-bt .b-call.slam .b-w{animation:golSlam .4s cubic-bezier(.3,1.35,.5,1) both}
.gol-bt .b-ca{position:relative;flex:none;filter:drop-shadow(0 14px 26px rgba(0,0,0,.65))}
.gol-bt .b-ca img{display:block;height:100%;width:auto}
.gol-bt .b-ca::after{content:'';position:absolute;inset:0;-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat;
  background:linear-gradient(100deg,rgba(255,255,255,0) 42%,rgba(255,255,255,.75) 50%,rgba(255,255,255,0) 58%) no-repeat;background-size:320% 100%;background-position:160% 0;
  mix-blend-mode:screen;animation:golShine .9s ease-out .3s forwards}
.gol-bt .b-call.in .b-ca{animation:golIn .45s cubic-bezier(.2,.9,.25,1.12) both}
.gol-bt .b-call.slam .b-ca{animation:golSlam .4s cubic-bezier(.3,1.35,.5,1) both}
.gol-bt .b-sub .b-ca{animation:none}
.gol-bt .b-call.fight .b-w{transform:skewX(-8deg)}
.gol-bt .b-call.fight.slam .b-w{animation-name:golSlamSkew}
@keyframes golIn{0%{opacity:0;transform:scale(1.9)}100%{opacity:1;transform:scale(1)}}
@keyframes golSlam{0%{opacity:0;transform:scale(3.3)}58%{opacity:1;transform:scale(.9)}100%{opacity:1;transform:scale(1)}}
@keyframes golSlamSkew{0%{opacity:0;transform:scale(3.3) skewX(-8deg)}58%{opacity:1;transform:scale(.9) skewX(-8deg)}100%{opacity:1;transform:scale(1) skewX(-8deg)}}
.gol-bt .b-sub{margin-top:6px;font:900 italic 38px/1 ${DISPLAY};letter-spacing:.42em;padding-left:.42em;color:#ffe9b0;text-shadow:0 3px 0 #2b1404,0 0 18px rgba(255,180,70,.6);animation:golSub .5s ease-out .25s both}
@keyframes golSub{0%{opacity:0;transform:translateY(16px);letter-spacing:.8em}100%{opacity:1;transform:none}}
.gol-bt .b-streak{position:absolute;left:0;right:0;top:50%;height:6px;margin-top:-3px;transform:scaleX(0);
  background:linear-gradient(90deg,rgba(255,220,140,0),rgba(255,236,186,.95) 34%,#fff 50%,rgba(255,236,186,.95) 66%,rgba(255,220,140,0));
  box-shadow:0 0 26px 6px rgba(255,190,80,.5);animation:golStreak .75s ease-out forwards}
@keyframes golStreak{0%{transform:scaleX(0);opacity:1}45%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}
.gol-bt .b-burst{position:absolute;left:50%;top:50%;width:1200px;height:1200px;margin:-600px 0 0 -600px;border-radius:50%;
  background:radial-gradient(circle,var(--b1) 0%,var(--b2) 20%,rgba(0,0,0,0) 56%);animation:golBurst .65s ease-out forwards}
@keyframes golBurst{0%{transform:scale(.12);opacity:1}100%{transform:scale(1.45);opacity:0}}
.gol-bt .b-sp{position:absolute;left:50%;top:50%;width:7px;height:64px;margin:-32px 0 0 -3.5px;border-radius:4px;
  background:linear-gradient(180deg,#fff,var(--sc) 45%,rgba(255,120,40,0));transform:rotate(var(--a)) translateY(-60px);animation:golSpark .7s cubic-bezier(.15,.8,.3,1) forwards}
@keyframes golSpark{to{transform:rotate(var(--a)) translateY(calc(-1 * var(--d)));opacity:0}}
.gol-bt .b-flash{position:absolute;inset:0;background:#fff;animation:golFlash .55s ease-out forwards}
@keyframes golFlash{0%{opacity:.82}100%{opacity:0}}
.gol-bt .b-calls.shake{animation:golShake .45s linear}
@keyframes golShake{0%,100%{transform:none}14%{transform:translate(-16px,7px)}28%{transform:translate(13px,-9px)}42%{transform:translate(-10px,6px)}57%{transform:translate(8px,-4px)}71%{transform:translate(-4px,2px)}85%{transform:translate(2px,-1px)}}
/* VS */
.gol-bt .b-vs{position:absolute;left:0;top:300px;width:1920px;height:380px}
.gol-bt .b-vs .b-pl{position:absolute;top:40px;height:300px;width:1010px;display:flex;align-items:center;gap:34px;box-sizing:border-box;
  background:linear-gradient(180deg,rgba(9,14,24,.94),rgba(14,20,34,.94));box-shadow:inset 0 2px 0 rgba(240,204,128,.55),inset 0 -2px 0 rgba(240,204,128,.55)}
.gol-bt .b-vs .b-pl.l{left:0;padding-left:150px;clip-path:polygon(0 0,100% 0,calc(100% - 150px) 100%,0 100%);animation:golVsL .4s cubic-bezier(.2,.9,.3,1) both}
.gol-bt .b-vs .b-pl.r{right:0;padding-right:150px;flex-direction:row-reverse;clip-path:polygon(150px 0,100% 0,100% 100%,0 100%);animation:golVsR .4s cubic-bezier(.2,.9,.3,1) both}
@keyframes golVsL{0%{transform:translateX(-105%)}100%{transform:none}}
@keyframes golVsR{0%{transform:translateX(105%)}100%{transform:none}}
.gol-bt .b-vs .b-pp{flex:none;width:190px;height:190px;border-radius:50%;overflow:hidden;position:relative;background:#0b1220;box-shadow:0 0 0 3px rgba(240,204,128,.9),0 0 0 9px rgba(9,13,22,.9),0 10px 26px rgba(0,0,0,.6)}
.gol-bt .b-vs .b-pp .b-img{position:absolute;inset:0;background-repeat:no-repeat}
.gol-bt .b-vs .b-tx{display:flex;flex-direction:column;gap:10px;min-width:0}
.gol-bt .b-vs .b-pl.r .b-tx{align-items:flex-end}
.gol-bt .b-vs .b-tx b{font:900 66px/1.1 ${TITLE};letter-spacing:.06em;color:#f8e8c4;text-transform:uppercase;white-space:nowrap;max-width:${VS_NAME_W}px;overflow:hidden;text-overflow:ellipsis;padding-bottom:4px;text-shadow:0 4px 0 rgba(0,0,0,.6)}
.gol-bt .b-vs .b-tx i{font:700 18px var(--gl-body);font-style:normal;letter-spacing:4px;color:#d9c48f;text-transform:uppercase}
.gol-bt .b-vs .b-mid{position:absolute;left:0;top:0;width:1920px;height:380px;display:flex;align-items:center;justify-content:center}
.gol-bt .b-vs.out{animation:golFadeOut .35s ease-in forwards}
@keyframes golFadeOut{to{opacity:0}}
/* VS with both heroes' battle-stance art: two halves in their class colours sweep in, split by a diagonal of light */
.gol-bt .b-vs2{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden}
.gol-bt .b-vs2 .b-dim{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,rgba(6,9,18,.6),rgba(3,5,10,.94));animation:golFade .25s ease-out both}
.gol-bt .b-vs2 .b-half{position:absolute;top:0;width:1100px;height:1080px;overflow:hidden}
.gol-bt .b-vs2 .b-half.l{left:0;clip-path:polygon(0 0,100% 0,calc(100% - 280px) 100%,0 100%);background:linear-gradient(100deg,rgba(0,0,0,0) 10%,var(--g) 100%),#070a12;animation:golVs2L .5s cubic-bezier(.2,.9,.25,1) both}
.gol-bt .b-vs2 .b-half.r{right:0;clip-path:polygon(280px 0,100% 0,100% 100%,0 100%);background:linear-gradient(260deg,rgba(0,0,0,0) 10%,var(--g) 100%),#070a12;animation:golVs2R .5s cubic-bezier(.2,.9,.25,1) both}
@keyframes golVs2L{from{transform:translateX(-100%)}}
@keyframes golVs2R{from{transform:translateX(100%)}}
.gol-bt .b-vs2 .b-half::after{content:'';position:absolute;left:0;right:0;bottom:0;height:320px;z-index:2;background:linear-gradient(180deg,rgba(4,6,12,0),rgba(4,6,12,.9))}
.gol-bt .b-vs2 .b-rays{position:absolute;inset:-200px;background:repeating-linear-gradient(104deg,rgba(255,255,255,0) 0 44px,rgba(255,255,255,.07) 46px 48px,rgba(255,255,255,0) 50px 96px);animation:golRays .5s linear infinite}
.gol-bt .b-vs2 .b-half.r .b-rays{animation-direction:reverse}
@keyframes golRays{to{transform:translateX(99px)}}
.gol-bt .b-vs2 .b-glow{position:absolute;bottom:-160px;width:1060px;height:1060px;border-radius:50%;background:radial-gradient(circle,var(--g) 0%,rgba(0,0,0,0) 62%)}
.gol-bt .b-vs2 .b-half.l .b-glow{left:-60px}
.gol-bt .b-vs2 .b-half.r .b-glow{right:-60px}
.gol-bt .b-vs2 .b-art{position:absolute;bottom:-30px;width:707px;height:1060px;z-index:1;transform-origin:50% 100%}
.gol-bt .b-vs2 .b-art img{display:block;width:100%;height:100%;filter:drop-shadow(0 0 2px rgba(255,255,255,.55)) drop-shadow(0 0 22px var(--c))}
.gol-bt .b-vs2 .b-half.l .b-art{left:150px;animation:golArtL 2.4s cubic-bezier(.12,.85,.2,1) both}
.gol-bt .b-vs2 .b-half.r .b-art{right:150px;animation:golArtR 2.4s cubic-bezier(.12,.85,.2,1) both}
.gol-bt .b-vs2 .b-half.r .b-art img{transform:scaleX(-1)}
/* a hero with no splash yet: its card, standing on the same line at the splash heroes' height */
.gol-bt .b-vs2 .b-art.card img,.gol-bt .b-res .b-rart.card img{position:absolute;left:0;bottom:5%;height:88%;object-fit:contain;object-position:50% 100%}
@keyframes golArtL{0%{transform:translateX(-520px);filter:blur(10px);opacity:0}20%{transform:translateX(16px);filter:none;opacity:1}100%{transform:translateX(-12px) scale(1.035)}}
@keyframes golArtR{0%{transform:translateX(520px);filter:blur(10px);opacity:0}20%{transform:translateX(-16px);filter:none;opacity:1}100%{transform:translateX(12px) scale(1.035)}}
.gol-bt .b-vs2 .b-plate{position:absolute;bottom:72px;z-index:3;display:flex;flex-direction:column;gap:10px;animation:golPlate .5s ease-out .3s both}
.gol-bt .b-vs2 .b-half.l .b-plate{left:96px;align-items:flex-start}
.gol-bt .b-vs2 .b-half.r .b-plate{right:96px;align-items:flex-end}
@keyframes golPlate{from{opacity:0;transform:translateY(24px)}}
.gol-bt .b-vs2 .b-plate b{font:900 italic 86px/1.04 ${DISPLAY};letter-spacing:.01em;color:#fff3d6;text-transform:uppercase;white-space:nowrap;max-width:${VS2_NAME_W}px;overflow:hidden;text-overflow:ellipsis;box-sizing:content-box;padding:22px ${VS2_PAD}px 26px;margin:-22px -${VS2_PAD}px -22px;text-shadow:0 4px 0 rgba(0,0,0,.7),0 0 26px var(--g)}
.gol-bt .b-vs2 .b-plate i{font:800 italic 21px/34px ${DISPLAY};letter-spacing:4px;color:#0b0d12;text-transform:uppercase;padding:0 26px;background:var(--c);clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);text-shadow:none}
.gol-bt .b-vs2 .b-stage{position:absolute;left:0;right:0;bottom:22px;z-index:5;text-align:center;font:700 italic 15px/20px ${LABEL};letter-spacing:6px;color:rgba(232,220,190,.8);text-shadow:0 2px 4px #000;animation:golPlate .5s ease-out .5s both}
.gol-bt .b-vs2 .b-stage b{color:#ffe7a6;font-weight:800}
.gol-bt .b-vs2 .b-seam{position:absolute;left:957px;top:-20px;width:6px;height:1120px;z-index:4;transform:rotate(14.53deg);opacity:.55;
  background:linear-gradient(180deg,rgba(255,236,190,0),#fff 18%,#fff 82%,rgba(255,236,190,0));box-shadow:0 0 18px 4px rgba(255,214,140,.7);animation:golFade .5s ease-out both}
.gol-bt .b-vs2 .b-seam.lit{animation:golSeam .7s ease-out both}
@keyframes golSeam{0%{opacity:1;box-shadow:0 0 60px 22px rgba(255,236,190,.95)}100%{opacity:.6;box-shadow:0 0 18px 4px rgba(255,214,140,.7)}}
.gol-bt .b-vs2 .b-mid{top:320px;z-index:5}
.gol-bt .b-vs2 .b-vsem{position:relative;width:560px;height:auto;filter:drop-shadow(0 12px 28px rgba(0,0,0,.7));animation:golSlam .42s cubic-bezier(.3,1.35,.5,1) both}
.gol-bt .b-vs2.out .b-half.l{animation:golVs2OutL .38s ease-in forwards}
.gol-bt .b-vs2.out .b-half.r{animation:golVs2OutR .38s ease-in forwards}
@keyframes golVs2OutL{to{transform:translateX(-100%)}}
@keyframes golVs2OutR{to{transform:translateX(100%)}}
.gol-bt .b-vs2.out .b-dim,.gol-bt .b-vs2.out .b-seam,.gol-bt .b-vs2.out .b-mid,.gol-bt .b-vs2.out .b-stage{animation:golFadeOut .35s ease-in forwards}
.gol-bt .b-pf .b-img.m{transform:scaleX(-1)}
/* the battle: your combo count in the fight's lettering — big italic metal digits, HITS, the route's name on a chip */
.gol-hud.battle .combo .n{border-radius:0;border:0;box-shadow:none;padding:0 16px;gap:10px;font:900 italic 78px/1 ${DISPLAY};
  background:linear-gradient(180deg,#ffffff 0%,#fff6d0 40%,#ffc93a 56%,#f08a0a 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 3px 0 #2b1404) drop-shadow(0 0 16px rgba(255,170,40,.5))}
.gol-hud.battle .combo .n small{font:800 italic 28px/1 ${DISPLAY};letter-spacing:2px;color:transparent}
.gol-hud.battle .combo .l{font:700 italic 13px/24px ${LABEL};letter-spacing:2px;text-transform:uppercase;color:#0b0d12;background:#ffd34c;padding:0 16px;
  clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);text-shadow:none}
.gol-hud.battle .combo .l:empty{display:none}
/* the battle: the combo guide and the sparring panel in the fight's look (slanted dark metal edged in gold, the display face) */
.gol-hud.battle .gol-cg,.gol-hud.battle .gol-spar,.gol-hud.battle .gol-hitlog{border-radius:0;clip-path:polygon(0 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%);
  background:linear-gradient(180deg,rgba(18,23,35,.9),rgba(5,7,12,.86));box-shadow:inset 0 2px 0 rgba(240,204,128,.7),inset 0 -2px 0 rgba(240,204,128,.3)}
.gol-hud.battle .gol-cg .cg-hd span,.gol-hud.battle .gol-spar .hd{font:800 italic 16px/1.2 ${DISPLAY};letter-spacing:1.5px;color:#ffffff;text-transform:uppercase}
.gol-hud.battle .gol-cg .cg-sub{font:500 italic 11px/15px ${LABEL};color:#aab3c2}
.gol-hud.battle .gol-cg .cg-t{border:0;border-radius:0;clip-path:polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%);background:rgba(255,255,255,.1);color:#fff;font:800 italic 15px/1 ${DISPLAY}}
.gol-hud.battle .gol-cg .cg-t:hover{background:rgba(255,255,255,.2);box-shadow:none}
.gol-hud.battle .gol-cg .cg-r{border-radius:0;clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);background:rgba(255,255,255,.055)}
.gol-hud.battle .gol-cg .cg-n{font:800 italic 13.5px/1.1 ${DISPLAY};letter-spacing:.6px;color:#f3e3bd}
.gol-hud.battle .gol-cg .cg-n small{font:700 italic 8.5px/1 ${LABEL};letter-spacing:1.2px}
.gol-hud.battle .gol-cg .cg-k{border-radius:3px}
.gol-hud.battle .gol-cg .cg-h b{font:900 italic 18px/1 ${DISPLAY};color:#ffffff}
.gol-hud.battle .gol-cg .cg-h small{font:700 italic 8px/1 ${LABEL};letter-spacing:1.4px;margin-top:2px}
.gol-hud.battle .gol-spar button{border:0;border-radius:0;clip-path:polygon(7px 0,100% 0,calc(100% - 7px) 100%,0 100%);background:rgba(255,255,255,.07);color:#e6dcc4;
  font:800 italic 13px ${DISPLAY};letter-spacing:1.4px;text-shadow:none;box-shadow:none}
.gol-hud.battle .gol-spar button:hover{background:rgba(255,255,255,.15);color:#ffffff;box-shadow:none}
.gol-hud.battle .gol-spar button.on,.gol-hud.battle .gol-spar .act .cmb{background:linear-gradient(180deg,#f2d493,#d2a65a);color:#24180a}
.gol-hud.battle .gol-spar .act button{font-size:16px;letter-spacing:2px}
.gol-hud.battle .gol-spar .act .stop.on{background:linear-gradient(180deg,#ff7a5c,#b8301c);color:#ffffff}
.gol-hud.battle .gol-spar .spd span{font:700 italic 11px ${LABEL};letter-spacing:1.6px;color:#c9c2b0}
/* the battle: the skill dock as a plate of dark metal with cut corners and a gold edge */
.gol-hud.battle .dock.gl-panel{border:0;border-radius:0;clip-path:polygon(22px 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%,0 22px);
  background:linear-gradient(180deg,rgba(18,23,35,.93),rgba(5,7,12,.9));box-shadow:inset 0 2px 0 rgba(240,204,128,.7)}
.gol-hud.battle .dock .pas .lab{font:800 italic 12px/14px ${DISPLAY};letter-spacing:1.8px;color:#f3e3bd}
/* the end of the match */
.gol-bt .b-res{position:absolute;left:0;top:0;width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;pointer-events:auto;
  background:radial-gradient(ellipse at 50% 46%,rgba(4,7,14,.2),rgba(4,7,14,.74));animation:golFade .45s ease-out both}
.gol-bt .b-res.art{background:linear-gradient(90deg,rgba(3,5,10,.5),rgba(3,5,10,.78) 46%,rgba(3,5,10,.86))}
@keyframes golFade{from{opacity:0}}
.gol-bt .b-res .b-call{position:relative;top:auto;height:auto;width:auto}
.gol-bt .b-res.art{align-items:flex-end;padding-right:190px;box-sizing:border-box}
.gol-bt .b-res > .b-call,.gol-bt .b-res > .b-card{position:relative;z-index:1}
.gol-bt .b-res .b-rart{position:absolute;left:40px;bottom:-40px;width:760px;height:1140px;z-index:0;animation:golArtL 1.2s cubic-bezier(.12,.85,.2,1) both}
.gol-bt .b-res .b-rart::before{content:'';position:absolute;left:-180px;bottom:-60px;width:1120px;height:1120px;border-radius:50%;background:radial-gradient(circle,var(--g) 0%,rgba(0,0,0,0) 62%)}
.gol-bt .b-res .b-rart img{position:relative;display:block;width:100%;height:100%;filter:drop-shadow(0 0 2px rgba(255,255,255,.45)) drop-shadow(0 0 18px var(--g))}
.gol-bt .b-res .b-card{display:flex;flex-direction:column;align-items:center;gap:22px;padding:28px 40px 30px;min-width:620px;box-sizing:border-box;animation:golRise .45s ease-out .35s both}
@keyframes golRise{from{opacity:0;transform:translateY(18px)}}
.gol-bt .b-res .b-sc{display:flex;align-items:center;gap:26px}
.gol-bt .b-res .b-who{display:flex;flex-direction:column;align-items:center;gap:6px;width:280px}
.gol-bt .b-res .b-who b{font:800 italic 24px ${DISPLAY};letter-spacing:2px;color:#f3e3bd;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}
.gol-bt .b-res .b-who i{font:600 12px var(--gl-body);font-style:normal;letter-spacing:1.6px;color:var(--gl-text2);text-transform:uppercase}
.gol-bt .b-res .b-num{font:900 italic 68px/1 ${DISPLAY};letter-spacing:6px;color:#ffe7a6;text-shadow:0 3px 0 #2b1404,0 0 18px rgba(255,180,70,.45);font-variant-numeric:tabular-nums}
.gol-bt .b-res .b-bt{display:flex;gap:14px}
.gol-bt .b-res .b-bt .gl-btn{min-width:200px}
/* Tekken-style: a slanted dark plate edged in gold, slanted buttons in the display face */
.gol-bt .b-res .b-card.gl-panel{border:0;border-radius:0;padding:28px 56px 30px;clip-path:polygon(26px 0,100% 0,calc(100% - 26px) 100%,0 100%);
  background:linear-gradient(180deg,rgba(20,25,38,.97),rgba(6,8,14,.97));box-shadow:inset 0 2px 0 rgba(240,204,128,.75),inset 0 -2px 0 rgba(240,204,128,.75)}
.gol-bt .b-res .b-bt .gl-btn{border:0;border-radius:0;clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);font:800 italic 20px ${DISPLAY};letter-spacing:2px;box-shadow:none}
.gol-bt .b-res .b-bt .gl-btn.ghost{background:rgba(255,255,255,.07);color:#e6dcc4}
.gol-bt .b-res .b-bt .gl-btn.ghost:hover:not(:disabled){background:rgba(255,255,255,.14);color:#fff}
.gol-bt .b-res .b-st{font:500 15px/20px var(--gl-body);color:var(--gl-text2);letter-spacing:.3px}
.gol-bt .b-res .b-st:empty{display:none}
.gol-bt .b-res .b-st.hot{color:#ffd78a}
@media (prefers-reduced-motion:reduce){.gol-bt *{animation-duration:1ms!important;transition:none!important}}
`;

interface SideEls { pf: HTMLDivElement; img: HTMLDivElement; hb: HTMLDivElement; fl: HTMLDivElement; tr: HTMLDivElement; name: HTMLElement; cls: HTMLElement; you: HTMLElement; wins: HTMLDivElement; frac: number;
  brk: HTMLDivElement; brkKey: HTMLElement; brkText: HTMLElement; brkFill: HTMLDivElement }

export class BattleHUD {
  private root: HTMLDivElement;
  private sides: Record<Side, SideEls>;
  private clock: HTMLDivElement;
  private clockN: HTMLDivElement;
  private clockRd: HTMLDivElement;
  private calls: HTMLDivElement;
  private res?: HTMLDivElement;
  private resState?: HTMLDivElement;
  private resBtn?: HTMLButtonElement;
  private timers: number[] = [];
  private cache = new Map<string, string>();

  constructor(host: HTMLElement, private h: { rematch(): void; exit(): void }) {
    ensureTheme();
    void document.fonts?.load(`900 66px ${TITLE}`).catch(() => undefined); // the lettering's weight: ready before the first VS
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.root = this.el('div', 'gol-bt', host);
    const top = this.el('div', 'b-top', this.root);
    this.sides = { l: this.side(top, 'l'), r: this.side(top, 'r') };
    this.clock = this.el('div', 'b-clk', top);
    this.el('div', 'b-sh', this.clock); this.el('div', 'b-in', this.clock);
    this.clockN = this.el('div', 'b-n', this.clock);
    this.clockRd = this.el('div', 'b-rd', this.clock);
    this.calls = this.el('div', 'b-calls', this.root);
  }

  private side(top: HTMLElement, s: Side): SideEls {
    const sd = this.el('div', `b-sd ${s}`, top);
    const pf = this.el('div', 'b-pf', sd); this.el('div', 'b-pfr', pf); // a slanted metal frame (the class colour), the face inside it
    const img = this.el('div', 'b-img', this.el('div', 'b-pin', pf));
    const hb = this.el('div', 'b-hb', sd);
    this.el('div', 'b-fr', hb);
    const tk = this.el('div', 'b-tk', hb), tr = this.el('div', 'b-tr', tk), fl = this.el('div', 'b-fl', tk);
    const nm = this.el('div', 'b-nm', sd), name = this.el('b', '', nm), cls = this.el('i', '', nm), you = this.el('i', 'b-you', nm);
    you.textContent = 'YOU';
    const wins = this.el('div', 'b-wins', sd);
    const brk = this.el('div', 'b-brk', sd), brkFill = this.el('div', 'b-bfill', brk), brkKey = this.el('span', 'b-bk', brk), brkText = this.el('b', '', brk);
    brk.title = 'BREAK: being comboed (from its 3rd hit), press jump to break free — then it recharges';
    return { pf, img, hb, fl, tr, name, cls, you, wins, frac: 1, brk, brkKey, brkText, brkFill };
  }

  /** The top HUD (bars, clock) in / out. */
  setOn(on: boolean): void { this.root.classList.toggle('on', on); }

  /** The VS art and emblem decoded ahead (the VS screen shows them the moment it opens). */
  private warm: HTMLImageElement[] = [];
  private prewarm(urls: string[]): void {
    for (const u of urls) { if (this.warm.some((i) => i.src.endsWith(u))) continue; const i = new Image(); i.src = u; void i.decode?.().catch(() => undefined); this.warm.push(i); }
  }

  setFighters(l: Fighter, r: Fighter): void {
    this.prewarm([VS_EMBLEM, ...Object.keys(CALL_ART).map(callUrl), ...[l, r].flatMap((f) => (f.vs ? [f.vs.url, ...(f.vs.win ? [f.vs.win] : [])] : []))]);
    for (const [s, f] of [['l', l], ['r', r]] as const) {
      const e = this.sides[s];
      e.name.textContent = f.name; e.name.title = f.name; e.cls.textContent = f.cls;
      e.you.style.display = f.you ? '' : 'none';
      this.portrait(e.img, f.portrait, `pf${s}`, 102);
      e.pf.parentElement?.style.setProperty('--c', f.vs?.color ?? '#f0cc80');
      e.img.classList.toggle('m', s === 'r' && !!f.vs); // a hero's battle face looks right: the one on the right turns to face its foe
    }
  }

  /** A fighter's health (0..1): the bar drops at once, the red trail follows after a beat; refills snap. */
  setHp(s: Side, frac: number): void {
    const e = this.sides[s], f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - e.frac) < 0.0005) return;
    const up = f > e.frac;
    if (up) e.hb.classList.add('snap');
    e.fl.style.width = `${(f * 100).toFixed(2)}%`;
    if (up) { e.tr.style.width = e.fl.style.width; void e.hb.offsetWidth; e.hb.classList.remove('snap'); }
    else {
      e.tr.style.width = e.fl.style.width; // (its transition waits a beat, then drains)
      e.hb.classList.add('hit'); window.setTimeout(() => e.hb.classList.remove('hit'), 110);
    }
    e.hb.classList.toggle('low', f > 0 && f <= 0.25);
    e.frac = f;
  }

  /** A fighter's BREAK: ready / usable right now (live) / recharging (leftMs); `key` only on your own (the jump key). */
  setBreak(s: Side, o: { leftMs: number; live: boolean; key?: string }): void {
    const e = this.sides[s], left = Math.max(0, o.leftMs), cd = left > 0;
    const state = o.live ? 'live' : cd ? `cd${Math.ceil(left / 1000)}` : 'ready';
    if (!this.changed(`brk${s}`, `${state}|${o.key ?? ''}`)) { if (cd) e.brkFill.style.width = `${(1 - left / ARENA_BREAK_MS) * 100}%`; return; }
    e.brk.classList.toggle('live', o.live); e.brk.classList.toggle('cd', cd && !o.live);
    e.brkKey.textContent = o.key ?? ''; e.brkKey.style.display = o.key ? '' : 'none';
    e.brkText.textContent = cd && !o.live ? `BREAK ${Math.ceil(left / 1000)}` : 'BREAK';
    e.brkFill.style.width = cd ? `${(1 - left / ARENA_BREAK_MS) * 100}%` : '0%';
  }

  /** The round clock (ms left) and the round number under it. */
  setClock(ms: number, round: number): void {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    if (this.changed('clk', String(sec))) { this.clockN.textContent = String(sec); this.clock.classList.toggle('urgent', sec <= 10 && sec > 0); }
    if (this.changed('rd', String(round))) this.clockRd.textContent = round > 0 ? `ROUND ${round}` : '';
  }

  /** Round wins: one diamond per win needed, lit for each round won. */
  setWins(l: number, r: number, need: number): void {
    for (const [s, n] of [['l', l], ['r', r]] as const) {
      if (!this.changed(`w${s}`, `${n}/${need}`)) continue;
      const box = this.sides[s].wins, had = box.querySelectorAll('.b-wn.on').length;
      box.replaceChildren();
      for (let i = 0; i < need; i++) {
        const d = this.el('div', `b-wn${i < n ? ' on' : ''}`, box);
        if (i < had) d.style.animation = 'none'; // only the new win flares
      }
      if (s === 'r') box.style.flexDirection = 'row-reverse';
    }
  }

  // ------------------------------------------------------------------ the big calls

  /** Match start: both fighters slide in, VS between them (heroes: their battle-stance art in two halves of their colours). */
  vs(l: Fighter, r: Fighter, ms: number): void {
    this.clearCalls();
    if (l.vs && r.vs) { this.vsArt(l, r, ms); return; }
    const v = this.el('div', 'b-vs', this.calls);
    for (const [s, f] of [['l', l], ['r', r]] as const) {
      const pl = this.el('div', `b-pl ${s}`, v);
      const pp = this.el('div', 'b-pp', pl), img = this.el('div', 'b-img', pp);
      this.portrait(img, f.portrait, '', 190);
      const tx = this.el('div', 'b-tx', pl), nm = this.el('b', '', tx);
      nm.textContent = f.name;
      this.el('i', '', tx).textContent = f.you ? `${f.cls}  ·  YOU` : f.cls;
      const fit = () => { // a long name: smaller until it fits, never under the VS (again once the lettering's font is in)
        nm.style.fontSize = '';
        for (let px = 66, i = 0; nm.scrollWidth > VS_NAME_W && i < 6 && px > 30; i++) { px = Math.max(30, Math.floor((px * VS_NAME_W) / nm.scrollWidth) - 1); nm.style.fontSize = `${px}px`; }
      };
      fit();
      void document.fonts?.load(`900 66px ${TITLE}`).then(() => { if (nm.isConnected) fit(); }).catch(() => undefined);
    }
    const mid = this.el('div', 'b-mid b-call slam', v);
    this.later(() => { this.word(mid, 'VS', 'fire', 210); this.burst(mid, 'fire'); this.shake(); }, 260);
    this.later(() => v.classList.add('out'), Math.max(600, ms - 350));
    this.later(() => v.remove(), ms);
  }

  private vsArt(l: Fighter, r: Fighter, ms: number): void {
    const v = this.el('div', 'b-vs2', this.calls);
    this.el('div', 'b-dim', v);
    for (const [s, f] of [['l', l], ['r', r]] as const) {
      const a = f.vs!, half = this.el('div', `b-half ${s}`, v);
      half.style.setProperty('--c', a.color); half.style.setProperty('--g', a.glow);
      this.el('div', 'b-rays', half); this.el('div', 'b-glow', half);
      const img = this.el('img', '', this.el('div', a.card ? 'b-art card' : 'b-art', half));
      img.src = a.url; img.alt = ''; img.draggable = false;
      const plate = this.el('div', 'b-plate', half), nm = this.el('b', '', plate);
      nm.textContent = f.name;
      this.el('i', '', plate).textContent = f.you ? `${f.cls}  ·  YOU` : f.cls; // a slanted bar in the class colour
      const fit = () => { // a long name: smaller until it fits under its hero
        nm.style.fontSize = '';
        for (let px = 86, i = 0, w = nm.scrollWidth - 2 * VS2_PAD; w > VS2_NAME_W && i < 6 && px > 34; i++, w = nm.scrollWidth - 2 * VS2_PAD) { px = Math.max(34, Math.floor((px * VS2_NAME_W) / w) - 1); nm.style.fontSize = `${px}px`; }
      };
      fit();
      void document.fonts?.load(`italic 900 86px ${DISPLAY}`).then(() => { if (nm.isConnected) fit(); }).catch(() => undefined);
    }
    const stage = this.el('div', 'b-stage', v); stage.append('STAGE  ·  '); this.el('b', '', stage).textContent = 'LEGACY COURTYARD';
    const seam = this.el('div', 'b-seam', v), mid = this.el('div', 'b-mid b-call slam', v);
    this.later(() => { // the VS emblem slams in on the seam
      const em = this.el('img', 'b-vsem', mid); em.src = VS_EMBLEM; em.alt = 'VS'; em.draggable = false;
      this.burst(mid, 'fire'); this.sparks(mid, '#ffc04a', 14); seam.classList.add('lit'); this.shake();
    }, 380);
    this.later(() => v.classList.add('out'), Math.max(700, ms - 380));
    this.later(() => v.remove(), ms);
  }

  /** ROUND n (or FINAL ROUND) with a streak of light. */
  round(n: number, final: boolean, ms: number): void {
    this.clearCalls();
    const c = this.el('div', 'b-call in', this.calls);
    this.el('div', 'b-streak', c);
    if (!this.art(c, final ? 'final' : `round${n}`)) this.word(c, final ? 'FINAL ROUND' : `ROUND ${n}`, 'gold', final ? 128 : 150);
    this.later(() => c.classList.add('out'), Math.max(300, ms - 320));
    this.later(() => c.remove(), ms);
  }

  /** FIGHT!: slams in on fire, a burst, sparks and a shake. */
  fight(): void {
    this.clearCalls();
    const c = this.el('div', 'b-call slam fight', this.calls);
    this.burst(c, 'fire'); this.sparks(c, '#ffb43a', 14);
    if (!this.art(c, 'fight')) this.word(c, 'FIGHT!', 'fire', 220);
    this.shake();
    this.later(() => c.classList.add('out'), 820);
    this.later(() => c.remove(), 1150);
  }

  /** The round's end: K.O. (a white flash, blood-red metal), DOUBLE K.O., TIME or DRAW; PERFECT under a flawless K.O. */
  ko(kind: RoundCall, perfect: boolean, hold: number): void {
    this.clearCalls();
    const big = kind === 'ko', c = this.el('div', `b-call ${big ? 'slam' : 'in'}`, this.calls);
    if (big || kind === 'double') { const f = this.el('div', 'b-flash', this.calls); this.later(() => f.remove(), 600); }
    if (big) { this.burst(c, 'blood'); this.sparks(c, '#ff5a3a', 16); this.shake(); }
    else this.el('div', 'b-streak', c);
    const [text, metal, size]: [string, Metal, number] = kind === 'ko' ? ['K.O.', 'blood', 260] : kind === 'double' ? ['DOUBLE K.O.', 'blood', 150] : kind === 'time' ? ['TIME', 'steel', 210] : ['DRAW', 'steel', 210];
    if (!this.art(c, kind)) this.word(c, text, metal, size);
    if (perfect) { const p = this.el('div', 'b-sub', c); if (!this.art(p, 'perfect')) p.textContent = 'PERFECT'; }
    this.later(() => c.classList.add('out'), Math.max(400, hold - 330));
    this.later(() => c.remove(), hold);
  }

  /** The end of the match: VICTORY / DEFEAT / DRAW, the score, REMATCH and EXIT ARENA. */
  result(o: { title: 'VICTORY' | 'DEFEAT' | 'DRAW'; me: Fighter; them: Fighter; mine: number; theirs: number }): void {
    this.clearCalls(); this.hideResult();
    const r = this.el('div', 'b-res', this.root);
    r.addEventListener('mousedown', (e) => e.stopPropagation());
    const winner = o.title === 'VICTORY' ? o.me : o.title === 'DEFEAT' ? o.them : null;
    if (winner?.vs) { // the winner stands at the left in their victory pose (else their battle stance), the score at the right
      r.classList.add('art');
      const art = this.el('div', winner.vs.card ? 'b-rart card' : 'b-rart', r), img = this.el('img', '', art);
      art.style.setProperty('--c', winner.vs.color); art.style.setProperty('--g', winner.vs.glow);
      img.src = winner.vs.win ?? winner.vs.url; img.alt = ''; img.draggable = false;
    }
    const c = this.el('div', 'b-call slam', r);
    if (!this.art(c, o.title.toLowerCase())) this.word(c, o.title, o.title === 'VICTORY' ? 'gold' : o.title === 'DEFEAT' ? 'blood' : 'steel', 168);
    if (o.title === 'VICTORY') this.sparks(c, '#ffd25a', 12);
    const card = this.el('div', 'b-card gl-panel', r);
    const sc = this.el('div', 'b-sc', card);
    const who = (f: Fighter) => {
      const w = this.el('div', 'b-who', sc), nm = this.el('b', '', w); nm.textContent = f.name; this.el('i', '', w).textContent = f.you ? 'YOU' : f.cls;
      const fit = () => { nm.style.fontSize = ''; for (let px = 24, i = 0; nm.scrollWidth > nm.clientWidth + 1 && i < 4 && px > 15; i++) { px = Math.max(15, Math.floor((px * nm.clientWidth) / nm.scrollWidth)); nm.style.fontSize = `${px}px`; } };
      requestAnimationFrame(fit); // (once it is laid out)
    };
    who(o.me);
    this.el('div', 'b-num', sc).textContent = `${o.mine} – ${o.theirs}`;
    who(o.them);
    const bt = this.el('div', 'b-bt', card);
    const again = this.el('button', 'gl-btn pri lg', bt) as HTMLButtonElement;
    again.type = 'button'; again.textContent = 'REMATCH';
    again.addEventListener('click', () => this.h.rematch());
    const out = this.el('button', 'gl-btn ghost lg', bt) as HTMLButtonElement;
    out.type = 'button'; out.textContent = 'EXIT ARENA';
    out.addEventListener('click', () => this.h.exit());
    this.resState = this.el('div', 'b-st', card);
    this.res = r; this.resBtn = again; this.root.classList.add('res'); // (the fight's HUD steps aside)
  }

  /** Rematch: asked by me (waiting) / by the opponent (an invitation). */
  rematchState(mine: boolean, theirs: boolean, them: string): void {
    if (!this.res || !this.resBtn || !this.resState) return;
    this.resBtn.disabled = mine;
    this.resBtn.textContent = mine ? 'WAITING…' : 'REMATCH';
    this.resState.textContent = mine ? `Waiting for ${them}…` : theirs ? `${them} wants a rematch!` : '';
    this.resState.classList.toggle('hot', theirs && !mine);
  }

  hideResult(): void { this.res?.remove(); this.res = undefined; this.resBtn = undefined; this.resState = undefined; this.root.classList.remove('res'); }

  clearCalls(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.calls.replaceChildren();
    this.calls.classList.remove('shake');
  }

  destroy(): void { this.clearCalls(); this.root.remove(); this.cache.clear(); }

  // ------------------------------------------------------------------ pieces

  /** A call drawn as art (CALL_ART), with a sweep of light across its letters; false: it has none yet. */
  private art(parent: HTMLElement, id: string): boolean {
    const h = CALL_ART[id];
    if (!h) return false;
    const a = this.el('div', 'b-ca', parent), img = this.el('img', '', a) as HTMLImageElement;
    a.style.height = `${h}px`; a.style.setProperty('--m', `url("${callUrl(id)}")`);
    img.src = callUrl(id); img.alt = id.toUpperCase(); img.draggable = false;
    return true;
  }

  /** A word in metal lettering (fill gradient, thick dark outline, glow, a sweep of light). */
  private word(parent: HTMLElement, text: string, metal: Metal, px: number): HTMLElement {
    const [g, o, gl] = METAL[metal];
    const w = this.el('div', 'b-w', parent);
    this.el('span', 'b-f', w).textContent = text; w.dataset.t = text; // the outline (::before) under the metal face, the shine (::after) over it
    Object.assign(w.style, { fontSize: `${px}px` });
    w.style.setProperty('--g', g); w.style.setProperty('--o', o); w.style.setProperty('--gl', gl);
    return w;
  }

  private burst(parent: HTMLElement, metal: 'fire' | 'blood'): void {
    const b = this.el('div', 'b-burst', parent);
    b.style.setProperty('--b1', metal === 'fire' ? 'rgba(255,244,210,.95)' : 'rgba(255,236,226,.95)');
    b.style.setProperty('--b2', metal === 'fire' ? 'rgba(255,150,40,.5)' : 'rgba(230,30,20,.5)');
    if (parent.firstChild !== b) parent.insertBefore(b, parent.firstChild);
    this.later(() => b.remove(), 700);
  }

  private sparks(parent: HTMLElement, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const s = this.el('div', 'b-sp', parent);
      s.style.setProperty('--a', `${Math.round((360 / n) * i + (Math.random() - 0.5) * 16)}deg`);
      s.style.setProperty('--d', `${Math.round(320 + Math.random() * 260)}px`);
      s.style.setProperty('--sc', color);
      s.style.animationDelay = `${Math.round(Math.random() * 60)}ms`;
      if (parent.firstChild !== s) parent.insertBefore(s, parent.firstChild);
      this.later(() => s.remove(), 900);
    }
  }

  private shake(): void {
    const c = this.calls;
    c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
  }

  private portrait(el: HTMLElement, p: PortraitRef | undefined, id: string, w: number): void {
    const key = p ? `${p.url}|${p.crop ? Object.values(p.crop).join(',') : ''}` : '';
    if (id && !this.changed(id, key)) return;
    if (!p) { Object.assign(el.style, { backgroundImage: 'url("assets/hud/icon-portrait-fallback.png")', backgroundSize: '70%', backgroundPosition: 'center' }); return; }
    if (p.crop) {
      const k = w / p.crop.w;
      Object.assign(el.style, { backgroundImage: `url("${p.url}")`, backgroundSize: `${p.crop.imgW * k}px ${p.crop.imgH * k}px`, backgroundPosition: `${-p.crop.x * k}px ${-p.crop.y * k}px` });
    } else Object.assign(el.style, { backgroundImage: `url("${p.url}")`, backgroundSize: 'cover', backgroundPosition: 'center top' });
  }

  private later(fn: () => void, ms: number): void { this.timers.push(window.setTimeout(fn, ms)); }
  private changed(id: string, v: string): boolean { if (this.cache.get(id) === v) return false; this.cache.set(id, v); return true; }
  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag); if (cls) e.className = cls; parent?.appendChild(e); return e;
  }
}
