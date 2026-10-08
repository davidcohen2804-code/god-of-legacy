// Battle mode HUD (Tekken-style) for the PvP arena: both fighters' health bars across the top (portrait, name, round wins)
// with the round clock between them; the big calls in metal lettering — VS, ROUND n / FINAL ROUND, FIGHT!, K.O., TIME,
// DOUBLE K.O., DRAW, PERFECT — and the end of the match (VICTORY / DEFEAT / DRAW with REMATCH and EXIT ARENA).
// DOM inside the HUD overlay (1920x1080 design px, scaled with it).
import '@fontsource/cinzel/900.css';
import { PortraitRef } from './hud/HudState';
import { ensureTheme } from './theme';

export type Side = 'l' | 'r';
export interface Fighter { name: string; cls: string; portrait?: PortraitRef; you: boolean }
export type RoundCall = 'ko' | 'double' | 'time' | 'draw';

const STYLE_ID = 'gol-bt-style';
/** VS splash: the widest a fighter's name may be (it shrinks to fit, clear of the VS in the middle). */
const VS_NAME_W = 440;
const TITLE = "Cinzel, Georgia, serif";
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
/* a fighter: portrait, health bar, name, round wins */
.gol-bt .b-sd{position:absolute;top:16px;width:852px;height:124px}
.gol-bt .b-sd.l{left:26px}
.gol-bt .b-sd.r{right:26px}
.gol-bt .b-pf{position:absolute;top:0;width:92px;height:92px;border-radius:50%;overflow:hidden;background:#0b1220;
  box-shadow:0 0 0 2px rgba(240,204,128,.9),0 0 0 6px rgba(9,13,22,.94),0 8px 18px rgba(0,0,0,.6)}
.gol-bt .b-sd.l .b-pf{left:0}
.gol-bt .b-sd.r .b-pf{right:0}
.gol-bt .b-pf .b-img{position:absolute;inset:0;background-repeat:no-repeat}
.gol-bt .b-hb{position:absolute;top:22px;width:734px;height:42px;filter:drop-shadow(0 5px 10px rgba(0,0,0,.6))}
.gol-bt .b-sd.l .b-hb{left:106px}
.gol-bt .b-sd.r .b-hb{right:106px}
.gol-bt .b-hb .b-fr,.gol-bt .b-hb .b-tk{position:absolute;inset:0}
.gol-bt .b-hb .b-tk{inset:3px;overflow:hidden;background:linear-gradient(180deg,#120a08,#2a1511)}
.gol-bt .b-sd.l .b-hb .b-fr{clip-path:polygon(0 0,100% 0,calc(100% - 24px) 100%,0 100%)}
.gol-bt .b-sd.l .b-hb .b-tk{clip-path:polygon(0 0,100% 0,calc(100% - 22px) 100%,0 100%)}
.gol-bt .b-sd.r .b-hb .b-fr{clip-path:polygon(0 0,100% 0,100% 100%,24px 100%)}
.gol-bt .b-sd.r .b-hb .b-tk{clip-path:polygon(0 0,100% 0,100% 100%,22px 100%)}
.gol-bt .b-hb .b-fr{background:linear-gradient(180deg,#fbe3a6,#b98a36 52%,#6b4513)}
.gol-bt .b-hb .b-tr,.gol-bt .b-hb .b-fl{position:absolute;top:0;bottom:0;width:100%}
.gol-bt .b-sd.l .b-hb .b-tr,.gol-bt .b-sd.l .b-hb .b-fl{left:0}
.gol-bt .b-sd.r .b-hb .b-tr,.gol-bt .b-sd.r .b-hb .b-fl{right:0}
.gol-bt .b-hb .b-tr{background:linear-gradient(180deg,#ffb0a2,#e2321e 58%,#98150b);transition:width .55s cubic-bezier(.4,0,.6,1) .45s}
.gol-bt .b-hb .b-fl{background:linear-gradient(180deg,#fff7c8 0%,#ffe068 22%,#f8b62c 55%,#d4850f 80%,#a9620a 100%);transition:width 90ms linear,filter .12s}
.gol-bt .b-hb .b-fl::after{content:'';position:absolute;left:0;right:0;top:3px;height:32%;background:linear-gradient(rgba(255,255,255,.6),rgba(255,255,255,0))}
.gol-bt .b-hb.low .b-fl{background:linear-gradient(180deg,#ffd6ca 0%,#ff7d55 28%,#e23b1c 68%,#a3180a 100%);animation:golLow .6s ease-in-out infinite alternate}
@keyframes golLow{to{filter:brightness(1.4)}}
.gol-bt .b-hb.snap .b-tr,.gol-bt .b-hb.snap .b-fl{transition:none}
.gol-bt .b-hb.hit .b-fl{filter:brightness(1.9)}
.gol-bt .b-nm{position:absolute;top:72px;display:flex;align-items:center;gap:12px;height:32px;white-space:nowrap;max-width:600px}
.gol-bt .b-sd.l .b-nm{left:116px}
.gol-bt .b-sd.r .b-nm{right:116px;flex-direction:row-reverse}
.gol-bt .b-nm b{font:700 25px/32px ${TITLE};letter-spacing:2.6px;color:#f7e7c2;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 2px 0 rgba(0,0,0,.65),0 0 12px rgba(0,0,0,.7)}
.gol-bt .b-nm i{font:600 13px/20px var(--gl-body);font-style:normal;letter-spacing:1.5px;color:#d3c195;text-transform:uppercase;text-shadow:0 1px 2px #000}
.gol-bt .b-nm .b-you{flex:none;height:22px;padding:0 9px;border-radius:999px;background:rgba(231,196,124,.2);border:1px solid rgba(240,204,128,.6);
  font:700 11.5px/20px var(--gl-body);letter-spacing:1.4px;color:#ffe6a8;font-style:normal;text-shadow:none}
.gol-bt .b-wins{position:absolute;top:80px;display:flex;gap:14px}
.gol-bt .b-sd.l .b-wins{right:30px}
.gol-bt .b-sd.r .b-wins{left:30px}
.gol-bt .b-wn{width:15px;height:15px;transform:rotate(45deg);border:2px solid rgba(231,196,124,.7);background:rgba(12,10,8,.88);box-shadow:0 2px 6px rgba(0,0,0,.6)}
.gol-bt .b-wn.on{border-color:#fff0bf;background:radial-gradient(circle,#fffbe2 0%,#ffd75c 45%,#c27b10 100%);box-shadow:0 0 14px rgba(255,196,70,.95);animation:golWin .5s cubic-bezier(.2,1.4,.4,1)}
@keyframes golWin{0%{transform:rotate(45deg) scale(2.6);opacity:0}100%{transform:rotate(45deg) scale(1);opacity:1}}
/* the round clock */
.gol-bt .b-clk{position:absolute;left:894px;top:10px;width:132px;height:118px;filter:drop-shadow(0 6px 12px rgba(0,0,0,.6))}
.gol-bt .b-clk .b-sh,.gol-bt .b-clk .b-in{position:absolute;inset:0;clip-path:polygon(0 0,100% 0,100% 64%,50% 100%,0 64%)}
.gol-bt .b-clk .b-sh{background:linear-gradient(180deg,#fbe3a6,#ad7f2f 58%,#5e3d12)}
.gol-bt .b-clk .b-in{inset:4px 4px 5px;background:radial-gradient(ellipse at 50% 30%,#22304a,#0a101b 75%)}
.gol-bt .b-clk .b-n{position:absolute;left:0;right:0;top:12px;text-align:center;font:900 58px/1 ${TITLE};letter-spacing:1px;font-variant-numeric:tabular-nums;
  background:linear-gradient(180deg,#ffffff 0%,#fff0bf 42%,#e2ac46 58%,#fff1c4 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 0 rgba(0,0,0,.75))}
.gol-bt .b-clk.urgent .b-n{background:linear-gradient(180deg,#fff2ee 0%,#ff9a82 42%,#e3271a 58%,#ffc3b5 100%);-webkit-background-clip:text;background-clip:text;animation:golTick 1s ease-out infinite}
@keyframes golTick{0%{transform:scale(1.2)}35%{transform:scale(1)}}
.gol-bt .b-clk .b-rd{position:absolute;left:0;right:0;top:76px;text-align:center;font:700 11px/14px var(--gl-body);letter-spacing:2.4px;color:#d8c48f}
/* the big calls */
.gol-bt .b-calls{position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:hidden}
.gol-bt .b-call{position:absolute;left:0;top:250px;width:1920px;height:440px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.gol-bt .b-call.out{animation:golOut .32s ease-in forwards}
@keyframes golOut{to{opacity:0;transform:scale(1.16)}}
.gol-bt .b-w{position:relative;display:inline-block;isolation:isolate;white-space:nowrap;font-family:${TITLE};font-weight:900;line-height:1.08;letter-spacing:.05em;padding:0 .12em}
.gol-bt .b-w .b-f{color:transparent;background-image:var(--g);-webkit-background-clip:text;background-clip:text}
.gol-bt .b-w::before,.gol-bt .b-w::after{content:attr(data-t);position:absolute;left:0;top:0;width:100%;height:100%;padding:inherit;box-sizing:border-box}
.gol-bt .b-w::before{z-index:-1;color:var(--o);-webkit-text-stroke:.11em var(--o);filter:drop-shadow(0 .055em 0 rgba(0,0,0,.6)) drop-shadow(0 0 .2em var(--gl))}
.gol-bt .b-w::after{color:transparent;background-image:linear-gradient(100deg,rgba(255,255,255,0) 42%,rgba(255,255,255,.95) 50%,rgba(255,255,255,0) 58%);
  background-size:320% 100%;background-repeat:no-repeat;background-position:160% 0;-webkit-background-clip:text;background-clip:text;animation:golShine .9s ease-out .28s forwards}
@keyframes golShine{to{background-position:-60% 0}}
.gol-bt .b-call.in .b-w{animation:golIn .45s cubic-bezier(.2,.9,.25,1.12) both}
.gol-bt .b-call.slam .b-w{animation:golSlam .4s cubic-bezier(.3,1.35,.5,1) both}
.gol-bt .b-call.fight .b-w{transform:skewX(-8deg)}
.gol-bt .b-call.fight.slam .b-w{animation-name:golSlamSkew}
@keyframes golIn{0%{opacity:0;transform:scale(1.9)}100%{opacity:1;transform:scale(1)}}
@keyframes golSlam{0%{opacity:0;transform:scale(3.3)}58%{opacity:1;transform:scale(.9)}100%{opacity:1;transform:scale(1)}}
@keyframes golSlamSkew{0%{opacity:0;transform:scale(3.3) skewX(-8deg)}58%{opacity:1;transform:scale(.9) skewX(-8deg)}100%{opacity:1;transform:scale(1) skewX(-8deg)}}
.gol-bt .b-sub{margin-top:6px;font:900 34px/1 ${TITLE};letter-spacing:.42em;padding-left:.42em;color:#ffe9b0;text-shadow:0 3px 0 #2b1404,0 0 18px rgba(255,180,70,.6);animation:golSub .5s ease-out .25s both}
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
/* the end of the match */
.gol-bt .b-res{position:absolute;left:0;top:0;width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;pointer-events:auto;
  background:radial-gradient(ellipse at 50% 46%,rgba(4,7,14,.2),rgba(4,7,14,.74));animation:golFade .45s ease-out both}
@keyframes golFade{from{opacity:0}}
.gol-bt .b-res .b-call{position:relative;top:auto;height:auto;width:auto}
.gol-bt .b-res .b-card{display:flex;flex-direction:column;align-items:center;gap:22px;padding:28px 40px 30px;min-width:620px;box-sizing:border-box;animation:golRise .45s ease-out .35s both}
@keyframes golRise{from{opacity:0;transform:translateY(18px)}}
.gol-bt .b-res .b-sc{display:flex;align-items:center;gap:26px}
.gol-bt .b-res .b-who{display:flex;flex-direction:column;align-items:center;gap:6px;width:250px}
.gol-bt .b-res .b-who b{font:700 21px ${TITLE};letter-spacing:2px;color:#f3e3bd;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:250px}
.gol-bt .b-res .b-who i{font:600 12px var(--gl-body);font-style:normal;letter-spacing:1.6px;color:var(--gl-text2);text-transform:uppercase}
.gol-bt .b-res .b-num{font:900 64px/1 ${TITLE};letter-spacing:6px;color:#ffe7a6;text-shadow:0 3px 0 #2b1404,0 0 18px rgba(255,180,70,.45);font-variant-numeric:tabular-nums}
.gol-bt .b-res .b-bt{display:flex;gap:14px}
.gol-bt .b-res .b-bt .gl-btn{min-width:200px}
.gol-bt .b-res .b-st{font:500 15px/20px var(--gl-body);color:var(--gl-text2);letter-spacing:.3px}
.gol-bt .b-res .b-st:empty{display:none}
.gol-bt .b-res .b-st.hot{color:#ffd78a}
@media (prefers-reduced-motion:reduce){.gol-bt *{animation-duration:1ms!important;transition:none!important}}
`;

interface SideEls { pf: HTMLDivElement; img: HTMLDivElement; hb: HTMLDivElement; fl: HTMLDivElement; tr: HTMLDivElement; name: HTMLElement; cls: HTMLElement; you: HTMLElement; wins: HTMLDivElement; frac: number }

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
    const pf = this.el('div', 'b-pf', sd), img = this.el('div', 'b-img', pf);
    const hb = this.el('div', 'b-hb', sd);
    this.el('div', 'b-fr', hb);
    const tk = this.el('div', 'b-tk', hb), tr = this.el('div', 'b-tr', tk), fl = this.el('div', 'b-fl', tk);
    const nm = this.el('div', 'b-nm', sd), name = this.el('b', '', nm), cls = this.el('i', '', nm), you = this.el('i', 'b-you', nm);
    you.textContent = 'YOU';
    const wins = this.el('div', 'b-wins', sd);
    return { pf, img, hb, fl, tr, name, cls, you, wins, frac: 1 };
  }

  /** The top HUD (bars, clock) in / out. */
  setOn(on: boolean): void { this.root.classList.toggle('on', on); }

  setFighters(l: Fighter, r: Fighter): void {
    for (const [s, f] of [['l', l], ['r', r]] as const) {
      const e = this.sides[s];
      e.name.textContent = f.name; e.name.title = f.name; e.cls.textContent = f.cls;
      e.you.style.display = f.you ? '' : 'none';
      this.portrait(e.img, f.portrait, `pf${s}`, 92);
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

  /** Match start: both fighters slide in, VS between them. */
  vs(l: Fighter, r: Fighter, ms: number): void {
    this.clearCalls();
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

  /** ROUND n (or FINAL ROUND) with a streak of light. */
  round(n: number, final: boolean, ms: number): void {
    this.clearCalls();
    const c = this.el('div', 'b-call in', this.calls);
    this.el('div', 'b-streak', c);
    this.word(c, final ? 'FINAL ROUND' : `ROUND ${n}`, 'gold', final ? 128 : 150);
    this.later(() => c.classList.add('out'), Math.max(300, ms - 320));
    this.later(() => c.remove(), ms);
  }

  /** FIGHT!: slams in on fire, a burst, sparks and a shake. */
  fight(): void {
    this.clearCalls();
    const c = this.el('div', 'b-call slam fight', this.calls);
    this.burst(c, 'fire'); this.sparks(c, '#ffb43a', 14);
    this.word(c, 'FIGHT!', 'fire', 220);
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
    this.word(c, text, metal, size);
    if (perfect) this.el('div', 'b-sub', c).textContent = 'PERFECT';
    this.later(() => c.classList.add('out'), Math.max(400, hold - 330));
    this.later(() => c.remove(), hold);
  }

  /** The end of the match: VICTORY / DEFEAT / DRAW, the score, REMATCH and EXIT ARENA. */
  result(o: { title: 'VICTORY' | 'DEFEAT' | 'DRAW'; me: Fighter; them: Fighter; mine: number; theirs: number }): void {
    this.clearCalls(); this.hideResult();
    const r = this.el('div', 'b-res', this.root);
    r.addEventListener('mousedown', (e) => e.stopPropagation());
    const c = this.el('div', 'b-call slam', r);
    this.word(c, o.title, o.title === 'VICTORY' ? 'gold' : o.title === 'DEFEAT' ? 'blood' : 'steel', 168);
    if (o.title === 'VICTORY') this.sparks(c, '#ffd25a', 12);
    const card = this.el('div', 'b-card gl-panel', r);
    const sc = this.el('div', 'b-sc', card);
    const who = (f: Fighter) => { const w = this.el('div', 'b-who', sc); this.el('b', '', w).textContent = f.name; this.el('i', '', w).textContent = f.you ? 'YOU' : f.cls; };
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
    this.res = r; this.resBtn = again;
  }

  /** Rematch: asked by me (waiting) / by the opponent (an invitation). */
  rematchState(mine: boolean, theirs: boolean, them: string): void {
    if (!this.res || !this.resBtn || !this.resState) return;
    this.resBtn.disabled = mine;
    this.resBtn.textContent = mine ? 'WAITING…' : 'REMATCH';
    this.resState.textContent = mine ? `Waiting for ${them}…` : theirs ? `${them} wants a rematch!` : '';
    this.resState.classList.toggle('hot', theirs && !mine);
  }

  hideResult(): void { this.res?.remove(); this.res = undefined; this.resBtn = undefined; this.resState = undefined; }

  clearCalls(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.calls.replaceChildren();
    this.calls.classList.remove('shake');
  }

  destroy(): void { this.clearCalls(); this.root.remove(); this.cache.clear(); }

  // ------------------------------------------------------------------ pieces

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
