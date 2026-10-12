// PvP fighter select (Tekken style): the roster of fighters along the bottom, your fighter large on the left, the opponent
// on the right, the stage under the mode tabs. VS CPU: pick yours, then pick the one you fight; the stage (or RANDOM) can
// be changed at any time meanwhile (its arrows, ↑ / ↓). TRAINING: the same two picks (yours, then your training partner)
// and a stage — no match, the combo trials. VS PLAYER: an invite link; the other player picks on their own screen and each sees
// the other's cursor and choice as it happens (the stage comes from the room, the same on both screens). Both locked in:
// GET READY — then the arena.
// DOM overlay (1920x1080 design px, scaled to the canvas by syncOverlay); the two big fighters are drawn by the scene
// (FighterArt, under this overlay), told what to show through the handlers.
import '@fontsource/cinzel/900.css';
import '@fontsource/exo-2/700-italic.css';
import '@fontsource/exo-2/800-italic.css';
import '@fontsource/exo-2/900-italic.css';
import { CLASS_NAMES } from '../config/layout';
import { ROSTER, fighterFor, heroArt } from '../pvp/Fighters';
import { heroFxUrls } from './HeroFx';
import { STAGES } from '../world/Stages';
import { BOT_NAMES } from '../pvp/SparringBot';
import { syncOverlay } from './CharacterSelectUI';
import type { ArtState } from './FighterArt';
import { ensureTheme } from './theme';
import { Sound } from '../audio/Sound';
import { warmClip } from './HeroClip';
import { rankLine, rankPlate } from './RankUI';

export type VsMode = 'cpu' | 'player' | 'training';
export interface RemoteView { name: string; hover: string; pick: string | null; /** their PvP rank */ rank?: { rp: number; title: string | null } }
export interface PvpSelectHandlers {
  back(): void;
  /** Switched VS CPU / VS PLAYER / TRAINING. */
  mode(m: VsMode): void;
  /** VS PLAYER: my cursor / lock-in changed (for the other screen). */
  local(hover: string, pick: string | null): void;
  /** Both locked in (after GET READY); VS CPU: the stage picked (an id; RANDOM already drawn). */
  start(p1: string, p2: string, mode: VsMode, stage?: string): void;
  copyLink(): Promise<boolean>;
  /** A side's big fighter: which hero (null: none) and how it stands. */
  art(side: 'l' | 'r', cls: string | null, state: ArtState): void;
  /** A side's fighter was just locked in (the flash). */
  lock(side: 'l' | 'r'): void;
  /** The stage behind the whole screen: the one chosen (VS CPU; at GET READY the one RANDOM drew), null: none. */
  stage?(id: string | null): void;
}

const STYLE_ID = 'gol-ps-style';
const TITLE = 'Cinzel, Georgia, serif';
/** The fight's lettering (as the arena's calls): a heavy italic display face. */
const DISPLAY = "'Exo 2', 'Segoe UI', sans-serif";
/** Small labels (Exo 2's rounded E reads as an "e" under ~16px). */
const LABEL = "'Inter', 'Segoe UI', sans-serif";
const TILE = { w: 150, h: 190, gap: 14, top: 840 };
const TILES_X = 960 - (ROSTER.length * TILE.w + (ROSTER.length - 1) * TILE.gap) / 2;
/** The stage panel under the mode tabs (16:9, between the two fighters' heads), its arrows either side; the choices are
 *  the stages, then RANDOM. */
const STP = { w: 256, h: 144, top: 196 };
const CARDS = STAGES.length + 1;
const GOLD = 'linear-gradient(180deg,#fffdf2 0%,#ffeab2 24%,#f7c75c 47%,#9a580b 50%,#d58d27 68%,#ffe7a1 100%)';
const STEEL = 'linear-gradient(180deg,#ffffff 0%,#e8f2ff 24%,#9fc4ef 47%,#2a4c82 50%,#5d89c6 70%,#e0f0ff 100%)';

const CSS = `
.gol-ps{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;overflow:hidden;pointer-events:auto;font-family:var(--gl-body);color:#f3e3bd;user-select:none}
/* metal lettering (as the arena's calls) */
.gol-ps .ps-w{position:relative;display:inline-block;isolation:isolate;white-space:nowrap;font-family:${DISPLAY};font-weight:900;font-style:italic;line-height:1.1;letter-spacing:.02em;padding:0 .14em}
.gol-ps .ps-w .ps-f{color:transparent;background-image:var(--g);-webkit-background-clip:text;background-clip:text}
.gol-ps .ps-w::before{content:attr(data-t);position:absolute;left:0;top:0;width:100%;height:100%;padding:inherit;box-sizing:border-box;z-index:-1;color:var(--o);-webkit-text-stroke:.1em var(--o);filter:drop-shadow(0 .05em 0 rgba(0,0,0,.6)) drop-shadow(0 0 .2em var(--gl))}
.gol-ps .ps-w.gold{--g:${GOLD};--o:#2b1404;--gl:rgba(255,178,64,.5)}
.gol-ps .ps-w.steel{--g:${STEEL};--o:#07111f;--gl:rgba(96,164,255,.5)}
.gol-ps .ps-score{position:absolute;left:50%;top:26px;transform:translateX(-50%);display:flex;gap:14px;pointer-events:none}
.gol-ps .ps-score div{width:168px;height:80px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:6px;
  background:linear-gradient(180deg,rgba(14,18,28,.94),rgba(4,6,12,.94));transform:skewX(-8deg)}
.gol-ps .ps-score div.w1{box-shadow:inset 0 0 0 2px #e8442c,0 0 18px rgba(232,68,44,.45)}
.gol-ps .ps-score div.dr{width:136px;box-shadow:inset 0 0 0 2px #e8b84a,0 0 14px rgba(232,184,74,.35)}
.gol-ps .ps-score div.w2{box-shadow:inset 0 0 0 2px #3f8ff2,0 0 18px rgba(63,143,242,.45)}
.gol-ps .ps-score b{font:900 italic 46px/1 ${DISPLAY}}
.gol-ps .ps-score .w1 b{color:#ff5a3a;text-shadow:0 0 12px rgba(255,90,58,.6)}
.gol-ps .ps-score .dr b{color:#ffd25a;text-shadow:0 0 12px rgba(255,210,90,.5)}
.gol-ps .ps-score .w2 b{color:#4aa3ff;text-shadow:0 0 12px rgba(74,163,255,.6)}
.gol-ps .ps-score small{margin-top:5px;font:700 italic 13px/1 ${LABEL};letter-spacing:1.5px;color:#d9cdb2}
.gol-ps .ps-tabs{position:absolute;left:50%;top:124px;transform:translateX(-50%);display:flex;gap:10px;padding:6px 18px;background:rgba(6,10,18,.78);clip-path:polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%);box-shadow:inset 0 1px 0 rgba(201,154,69,.6),inset 0 -2px 0 rgba(201,154,69,.6)}
.gol-ps .ps-tabs button{width:196px;height:44px;border-radius:0;clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);border:1px solid transparent;background:transparent;color:#bfae86;font:800 italic 17px ${DISPLAY};letter-spacing:2.5px;cursor:pointer}
.gol-ps .ps-tabs button:hover{color:#f3dca2;background:rgba(255,255,255,.05)}
.gol-ps .ps-tabs button.on{color:#24180a;background:linear-gradient(180deg,#f2d493,#d2a65a);border-color:#f6dc9f}
.gol-ps .ps-back{position:absolute;left:28px;top:28px;width:150px;height:44px;padding:0 16px;border:0;border-radius:0;clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);
  background:linear-gradient(180deg,rgba(32,38,54,.96),rgba(8,11,18,.96));box-shadow:inset 0 1px 0 rgba(240,204,128,.55),inset 0 -2px 0 rgba(240,204,128,.85);color:#f3e3bd;font:800 italic 19px ${DISPLAY};letter-spacing:2px}
.gol-ps .ps-back:hover:not(:disabled){color:#24180a;background:linear-gradient(180deg,#f2d493,#d2a65a)}
/* name plates */
.gol-ps .ps-rkw{position:absolute;left:64px;top:850px;z-index:2}
.gol-ps .ps-pl{position:absolute;top:610px;width:600px;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.gol-ps .ps-pl.l{left:64px;align-items:flex-start}
.gol-ps .ps-pl.r{right:64px;align-items:flex-end}
.gol-ps .ps-bd{display:flex;gap:8px}
.gol-ps .ps-bd i{font:700 italic 14px/1 ${LABEL};letter-spacing:2px;padding:7px 12px 6px;border-radius:8px;color:#fff}
.gol-ps .ps-pl.l .ps-bd i.side{background:linear-gradient(180deg,#e8642c,#a8300f);box-shadow:0 0 14px rgba(232,100,44,.5)}
.gol-ps .ps-pl.r .ps-bd i.side{background:linear-gradient(180deg,#4c8fe8,#1f4f9c);box-shadow:0 0 14px rgba(76,143,232,.5)}
.gol-ps .ps-bd i.you{background:rgba(6,10,18,.8);color:#f3dca2;box-shadow:inset 0 0 0 1px rgba(240,204,128,.6)}
.gol-ps .ps-bd i.ok{background:linear-gradient(180deg,#f2d493,#d2a65a);color:#24180a}
.gol-ps .ps-pl .ps-cls{font-size:84px}
/* the player's name: a slanted plate of dark metal, white lettering, a line in the side's colour (1P orange / 2P blue) */
.gol-ps .ps-pl .ps-nm{position:relative;max-width:560px;box-sizing:border-box;padding:8px 32px 10px;margin-top:4px;
  font:900 italic 32px/1.15 ${DISPLAY};letter-spacing:1.5px;color:#ffffff;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 2px 0 #000,0 0 12px rgba(0,0,0,.7);background:linear-gradient(180deg,rgba(30,36,52,.95),rgba(6,8,14,.95));
  clip-path:polygon(15px 0,100% 0,calc(100% - 15px) 100%,0 100%);box-shadow:inset 0 2px 0 rgba(255,255,255,.16),inset 0 -4px 0 var(--sc)}
.gol-ps .ps-pl.l .ps-nm{--sc:#e8642c}
.gol-ps .ps-pl.r .ps-nm{--sc:#4c8fe8}
.gol-ps .ps-pl .ps-rk{margin-top:6px}
/* the middle: VS, what to do now */
.gol-ps .ps-vs{position:absolute;left:0;right:0;top:372px;text-align:center;opacity:.96;pointer-events:none}
.gol-ps .ps-vs img{width:300px;height:auto;filter:drop-shadow(0 10px 22px rgba(0,0,0,.7))}
.gol-ps .ps-vs.go{animation:psPulse .7s ease-in-out infinite alternate}
@keyframes psPulse{to{transform:scale(1.12);filter:brightness(1.35)}}
.gol-ps .ps-st{position:absolute;left:560px;right:560px;top:772px;text-align:center;font:900 italic 28px/1.2 ${DISPLAY};letter-spacing:.16em;color:#ffe9b0;text-shadow:0 3px 0 #2b1404,0 0 18px rgba(255,180,70,.55);pointer-events:none}
.gol-ps .ps-st.go{color:#fff;animation:psPulse .45s ease-in-out infinite alternate}
/* the roster */
.gol-ps .ps-tile{position:absolute;top:${TILE.top}px;width:${TILE.w}px;height:${TILE.h}px;border-radius:3px;overflow:hidden;cursor:pointer;background:radial-gradient(ellipse at 50% 30%,#2a3346,#080b12) no-repeat;
  box-shadow:0 0 0 2px rgba(214,222,240,.55),0 0 0 3px rgba(0,0,0,.8),0 10px 24px rgba(0,0,0,.6)}
.gol-ps .ps-tile::before{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,0) 22%);pointer-events:none}
.gol-ps .ps-tile::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(4,6,12,.92) 100%)}
.gol-ps .ps-tile span{position:absolute;left:0;right:0;bottom:11px;z-index:1;text-align:center;font:900 italic 16px ${DISPLAY};letter-spacing:1.5px;color:#ffffff;text-shadow:0 2px 4px #000}
.gol-ps .ps-tile.off{filter:saturate(.4) brightness(.6)}
.gol-ps .ps-cur{position:absolute;top:${TILE.top}px;width:${TILE.w}px;height:${TILE.h}px;border-radius:3px;pointer-events:none;transition:left .12s cubic-bezier(.3,.8,.3,1)}
.gol-ps .ps-cur.p1{box-shadow:0 0 0 4px #ff9a3c,0 0 22px 4px rgba(255,140,50,.75)}
.gol-ps .ps-cur.p2{box-shadow:0 0 0 4px #5aa8ff,0 0 22px 4px rgba(80,160,255,.75)}
.gol-ps .ps-cur.p1.p2s{box-shadow:0 0 0 4px #ff9a3c,0 0 0 8px #5aa8ff,0 0 26px 6px rgba(160,150,255,.6)}
.gol-ps .ps-cur:not(.lock){animation:psBlink .7s ease-in-out infinite alternate}
@keyframes psBlink{to{filter:brightness(1.45)}}
.gol-ps .ps-cur b{position:absolute;top:-30px;font:700 italic 14px/1 ${LABEL};letter-spacing:1.5px;color:#fff;padding:5px 12px 4px;clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)}
.gol-ps .ps-cur.p1 b{left:-4px;background:linear-gradient(180deg,#e8642c,#a8300f)}
.gol-ps .ps-cur.p2 b{right:-4px;background:linear-gradient(180deg,#4c8fe8,#1f4f9c)}
.gol-ps .ps-cur.hide{display:none}
.gol-ps .ps-hint{position:absolute;left:0;right:0;top:1046px;text-align:center;font:600 14px var(--gl-body);letter-spacing:1.5px;color:#a9b4bf;pointer-events:none}
.gol-ps .ps-hint b{color:#f3dca2;font-weight:800;padding:0 4px}
/* VS PLAYER: the invite (until the other player is in) */
.gol-ps .ps-inv{position:absolute;left:1220px;top:300px;width:600px;box-sizing:border-box;padding:26px 30px 28px;border-radius:16px;display:flex;flex-direction:column;align-items:center;gap:14px;
  background:linear-gradient(rgba(6,10,18,.9),rgba(6,10,18,.8));box-shadow:0 10px 30px rgba(0,0,0,.55),inset 0 0 0 1px rgba(90,168,255,.55)}
.gol-ps .ps-inv h3{margin:0;font:900 italic 24px ${DISPLAY};letter-spacing:3px;color:#cfe4ff}
.gol-ps .ps-inv .code{font:900 italic 58px/1 ${DISPLAY};letter-spacing:.3em;padding-left:.3em;color:#fff;text-shadow:0 0 18px rgba(90,168,255,.7)}
.gol-ps .ps-inv .lnk{max-width:540px;font:600 13px var(--gl-body);color:#9fb3c8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-ps .ps-inv .wait{font:700 15px var(--gl-body);letter-spacing:1px;color:#e9dcc0}
.gol-ps .ps-inv .wait::after{content:'';display:inline-block;width:1.2em;text-align:left;animation:psDots 1.2s steps(4) infinite}
@keyframes psDots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
.gol-ps .ps-inv .note{font:500 12.5px/1.4 var(--gl-body);color:#8d99a6;text-align:center}
.gol-ps .ps-inv.bad{box-shadow:0 10px 30px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,120,100,.6)}
.gol-ps .ps-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
.gol-ps .ps-flash.on{animation:psFlash .5s ease-out forwards}
@keyframes psFlash{0%{opacity:0}30%{opacity:.9}100%{opacity:1}}
/* the stage panel (VS CPU): the chosen stage under the mode tabs, arrows either side, a dot per choice under it */
.gol-ps .ps-stp{position:absolute;left:${960 - STP.w / 2}px;top:${STP.top}px;width:${STP.w}px;height:${STP.h}px;border-radius:4px;overflow:hidden;background:radial-gradient(ellipse at 50% 35%,#2a3346,#080b12) center/cover no-repeat;
  box-shadow:0 0 0 2.5px #ffc94a,0 0 0 4px rgba(0,0,0,.85),0 12px 28px rgba(0,0,0,.65),0 0 22px 2px rgba(255,190,70,.35);pointer-events:none}
.gol-ps .ps-stp::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 46%,rgba(4,6,12,.9) 100%)}
.gol-ps .ps-stp b{position:absolute;left:0;top:0;z-index:2;padding:4px 12px 3px 8px;font:700 italic 11px/1 ${LABEL};letter-spacing:1.5px;color:#24180a;background:linear-gradient(180deg,#f2d493,#d2a65a);clip-path:polygon(0 0,100% 0,calc(100% - 7px) 100%,0 100%)}
.gol-ps .ps-stp .q{position:absolute;left:0;right:0;top:26px;text-align:center;font:900 italic 64px/1 ${DISPLAY};color:#f3dca2;text-shadow:0 0 18px rgba(255,190,90,.5)}
.gol-ps .ps-stp .nm{position:absolute;left:0;right:0;bottom:8px;z-index:1;text-align:center;font-size:20px}
.gol-ps .ps-sa{position:absolute;top:${STP.top + STP.h / 2 - 26}px;width:40px;height:52px;padding:0;border:0;border-radius:0;cursor:pointer;color:#f3dca2;font:900 20px/52px ${DISPLAY};
  background:linear-gradient(180deg,rgba(32,38,54,.96),rgba(8,11,18,.96));box-shadow:inset 0 1px 0 rgba(240,204,128,.55),inset 0 -2px 0 rgba(240,204,128,.85)}
.gol-ps .ps-sa:hover{color:#24180a;background:linear-gradient(180deg,#f2d493,#d2a65a)}
.gol-ps .ps-sa.l{left:${960 - STP.w / 2 - 54}px;clip-path:polygon(10px 0,100% 0,100% 100%,10px 100%,0 50%)}
.gol-ps .ps-sa.r{left:${960 + STP.w / 2 + 14}px;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 100%,0 100%)}
.gol-ps .ps-sd{position:absolute;left:0;right:0;top:${STP.top + STP.h + 12}px;display:flex;justify-content:center;gap:8px;pointer-events:none}
.gol-ps .ps-sd i{width:7px;height:7px;transform:rotate(45deg);background:rgba(214,222,240,.35);box-shadow:0 0 0 1px rgba(0,0,0,.6)}
.gol-ps .ps-sd i.on{background:#ffc94a;box-shadow:0 0 8px rgba(255,190,70,.8)}
.gol-ps.vsp .ps-stp,.gol-ps.vsp .ps-sa,.gol-ps.vsp .ps-sd{display:none}
/* TRAINING: no count on top (nothing is won there) */
.gol-ps.trn .ps-score{display:none}`;

interface Side { hover: number; pick: number | null }
/** The stage row's choice: the stages, then RANDOM (index STAGES.length) — kept from one visit of this screen to the next. */
const RANDOM = STAGES.length;
let lastStage = RANDOM;

export class PvpSelectUI {
  private readonly root: HTMLDivElement;
  private readonly tabs: Record<VsMode, HTMLButtonElement>;
  private readonly score: Record<'w' | 'd' | 'l', HTMLElement>;
  private readonly plate: Record<'l' | 'r', { side: HTMLElement; tag: HTMLElement; cls: HTMLElement; nm: HTMLElement; box: HTMLElement; rk: HTMLElement }>;
  private readonly tiles: HTMLDivElement[] = [];
  private readonly cur: Record<'p1' | 'p2', HTMLDivElement>;
  private readonly vs: HTMLElement;
  private readonly st: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly inv: { box: HTMLDivElement; code: HTMLElement; lnk: HTMLElement; wait: HTMLElement; note: HTMLElement; copy: HTMLButtonElement };
  private readonly stp: { box: HTMLDivElement; q: HTMLElement; nm: HTMLElement; dots: HTMLElement[] };
  /** VS CPU: the stage (index into STAGES, RANDOM: drawn at GET READY), changed at any time before GET READY. */
  private stage = lastStage;
  private lastRect = '';
  private mode: VsMode;
  private p1: Side;
  private p2: Side;
  /** VS CPU: whose cursor the keys move. */
  private active: 'p1' | 'p2' = 'p1';
  private remote: RemoteView | null = null;
  private net: { status: string; room: string; link: string; local: boolean } = { status: 'connecting', room: '', link: '', local: false };
  private going = false;
  /** GET READY: the stage the match is on (RANDOM drawn). */
  private drawn = -1;
  private timer = 0;
  private readonly onKey = (e: KeyboardEvent) => this.key(e);

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, private h: PvpSelectHandlers, init: { mode: VsMode; p1?: string; p2?: string }) {
    ensureTheme();
    if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
    this.mode = init.mode;
    const at = (c?: string, d = 0) => Math.max(0, ROSTER.indexOf((c ?? ROSTER[d]) as typeof ROSTER[number]));
    this.p1 = { hover: at(init.p1, 1), pick: null };
    this.p2 = { hover: at(init.p2, 0), pick: null };
    const root = this.root = this.el('div', 'gol-ps', host);
    const sc = this.el('div', 'ps-score', root);
    const box = (c: string, label: string) => { const d = this.el('div', c, sc); const n = this.el('b', '', d); n.textContent = '0'; this.el('small', '', d).textContent = label; return n; };
    this.score = { w: box('w1', 'WINS'), d: box('dr', 'DRAWS'), l: box('w2', 'WINS') };
    const tabs = this.el('div', 'ps-tabs', root);
    const tab = (m: VsMode, label: string) => { const b = this.el('button', '', tabs) as HTMLButtonElement; b.type = 'button'; b.textContent = label; b.addEventListener('click', () => this.setMode(m)); return b; };
    this.tabs = { cpu: tab('cpu', 'VS CPU'), player: tab('player', 'VS PLAYER'), training: tab('training', 'TRAINING') };
    const back = this.el('button', 'gl-btn ps-back', root) as HTMLButtonElement; back.type = 'button'; back.textContent = 'BACK'; back.addEventListener('click', () => this.back());
    const mkPlate = (s: 'l' | 'r') => {
      const box = this.el('div', `ps-pl ${s}`, root), bd = this.el('div', 'ps-bd', box);
      const side = this.el('i', 'side', bd), tag = this.el('i', 'you', bd);
      const cls = this.el('div', 'ps-cls', box), nm = this.el('div', 'ps-nm', box), rk = this.el('div', 'ps-rk', box);
      return { side, tag, cls, nm, box, rk };
    };
    this.plate = { l: mkPlate('l'), r: mkPlate('r') };
    rankPlate(this.el('div', 'ps-rkw', root), root); // (your rank: tier, RP, streak, the title you wear)
    this.vs = this.el('div', 'ps-vs', root);
    const em = this.el('img', '', this.vs) as HTMLImageElement; em.src = 'assets/hud/vs_emblem.webp'; em.alt = 'VS'; em.draggable = false; // (the arena's VS screen slams the same emblem in)
    this.st = this.el('div', 'ps-st', root);
    ROSTER.forEach((c, i) => {
      const t = this.el('div', 'ps-tile', root) as HTMLDivElement;
      t.style.left = `${TILES_X + i * (TILE.w + TILE.gap)}px`;
      const a = heroArt(c);
      if (a) { // the hero's head and shoulders, from its battle-stance art (or its card, until it has one)
        const w = a.face.s * 1.9, k = TILE.w / w, x = a.face.x + a.face.s / 2 - w / 2, y = a.face.y - a.face.s * 0.28;
        Object.assign(t.style, { backgroundImage: `url("${a.url}"), radial-gradient(ellipse at 50% 30%,${a.color}55,#080b12 70%)`, backgroundSize: `${a.w * k}px ${a.h * k}px, 100% 100%`, backgroundPosition: `${-x * k}px ${-y * k}px, 0 0` });
      }
      this.el('span', '', t).textContent = (CLASS_NAMES[c] ?? c).toUpperCase();
      t.addEventListener('mouseenter', () => this.point(i));
      t.addEventListener('click', () => { this.point(i); this.confirm(); });
      this.tiles.push(t);
    });
    const mkCur = (p: 'p1' | 'p2') => { const d = this.el('div', `ps-cur ${p}`, root) as HTMLDivElement; this.el('b', '', d); return d; };
    this.cur = { p1: mkCur('p1'), p2: mkCur('p2') };
    const inv = this.el('div', 'ps-inv', root) as HTMLDivElement;
    this.el('h3', '', inv).textContent = 'INVITE A PLAYER';
    const code = this.el('div', 'code', inv), lnk = this.el('div', 'lnk', inv);
    const copy = this.el('button', 'gl-btn pri lg', inv) as HTMLButtonElement; copy.type = 'button'; copy.textContent = 'COPY INVITE LINK';
    copy.addEventListener('click', () => { void this.h.copyLink().then((ok) => { copy.textContent = ok ? 'LINK COPIED' : 'COPY INVITE LINK'; window.setTimeout(() => { copy.textContent = 'COPY INVITE LINK'; }, 1600); }); });
    const wait = this.el('div', 'wait', inv), note = this.el('div', 'note', inv);
    this.inv = { box: inv, code, lnk, wait, note, copy };
    // the stage panel (VS CPU)
    const stp = this.el('div', 'ps-stp', root) as HTMLDivElement;
    this.el('b', '', stp).textContent = 'STAGE';
    const q = this.el('div', 'q', stp); q.textContent = '?';
    const nm = this.el('div', 'nm', stp);
    for (const [c, d, t] of [['l', -1, '◀'], ['r', 1, '▶']] as const) {
      const a = this.el('button', `ps-sa ${c}`, root) as HTMLButtonElement; a.type = 'button'; a.textContent = t; a.setAttribute('aria-label', d < 0 ? 'Previous stage' : 'Next stage');
      a.addEventListener('click', () => this.setStage(this.stage + d));
    }
    const sd = this.el('div', 'ps-sd', root);
    this.stp = { box: stp, q, nm, dots: Array.from({ length: CARDS }, () => this.el('i', '', sd)) };
    this.hint = this.el('div', 'ps-hint', root);
    this.el('div', 'ps-flash', root);
    root.addEventListener('mousedown', (e) => { if (!(e.target as HTMLElement).closest('button')) e.preventDefault(); });
    window.addEventListener('keydown', this.onKey);
    this.render();
    this.layout();
    this.h.stage?.(this.local ? this.stageId() : null);
  }

  /** Both picks made on this screen, and a stage (VS CPU, TRAINING); VS PLAYER: the other player picks on theirs. */
  private get local(): boolean { return this.mode !== 'player'; }

  /** The chosen stage's id (null: RANDOM). */
  private stageId(): string | null { return this.stage === RANDOM ? null : STAGES[this.stage].id; }

  /** Keep the overlay on the canvas (every frame; cheap). */
  layout(): void { this.lastRect = syncOverlay(this.root, this.host, this.canvas, this.lastRect); }

  /** VS PLAYER: the room and the other player (null: not in yet). */
  setNet(n: { status: string; room: string; link: string; local: boolean }, remote: RemoteView | null): void {
    this.net = n;
    const was = this.remote;
    this.remote = remote;
    if (remote && was?.pick !== remote.pick && remote.pick) this.flashArt('r');
    this.render();
    this.maybeGo();
  }

  /** The session's count on top: your wins, the draws, theirs. */
  setScore(t: { w: number; d: number; l: number }): void { this.score.w.textContent = String(t.w); this.score.d.textContent = String(t.d); this.score.l.textContent = String(t.l); }

  destroy(): void { window.clearTimeout(this.timer); window.removeEventListener('keydown', this.onKey); this.root.remove(); }

  // ---------------------------------------------------------------- behaviour

  private setMode(m: VsMode): void {
    if (this.going || m === this.mode) return;
    this.mode = m; this.active = 'p1'; this.p1.pick = null; this.p2.pick = null; this.remote = null;
    Sound.ui('select');
    this.h.mode(m);
    this.h.stage?.(m !== 'player' ? this.stageId() : null);
    this.sendLocal();
    this.render();
  }

  /** The cursor the keys move: yours, or the CPU's once yours is locked in. */
  private side(): Side | null {
    if (this.going) return null;
    if (this.mode === 'player') return this.p1.pick === null ? this.p1 : null;
    return this.active === 'p1' ? this.p1 : this.p2.pick === null ? this.p2 : null;
  }
  /** VS CPU / TRAINING: the stage, chosen at any time before GET READY (the row's cards, or ↑ / ↓). */
  private setStage(i: number): void {
    if (this.going || !this.local) return;
    this.stage = lastStage = (i + CARDS) % CARDS;
    Sound.ui('swipe');
    this.render();
    this.h.stage?.(this.stageId());
  }

  private point(i: number): void { const s = this.side(); if (!s || s.hover === i) return; s.hover = i; Sound.ui('move'); this.sendLocal(); this.render(); }
  private move(d: number): void { const s = this.side(); if (!s) return; s.hover = (s.hover + d + ROSTER.length) % ROSTER.length; Sound.ui('move'); this.sendLocal(); this.render(); }

  private confirm(): void {
    if (this.going) return;
    if (this.mode === 'player') {
      if (this.p1.pick !== null) return;
      this.p1.pick = this.p1.hover; this.flashArt('l');
    } else if (this.active === 'p1') {
      this.p1.pick = this.p1.hover; this.flashArt('l'); this.active = 'p2';
    } else if (this.p2.pick === null) {
      this.p2.pick = this.p2.hover; this.flashArt('r');
    }
    this.sendLocal();
    this.render();
    this.maybeGo();
  }

  private back(): void {
    if (this.going) return;
    if (this.local && this.active === 'p2') { // undo: back to your own pick
      if (this.p2.pick !== null) this.p2.pick = null; else { this.active = 'p1'; this.p1.pick = null; }
    } else if (this.p1.pick !== null) this.p1.pick = null;
    else { Sound.ui('back'); this.h.back(); return; }
    Sound.ui('back');
    this.sendLocal();
    this.render();
  }

  private key(e: KeyboardEvent): void {
    if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); this.move(-1); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); this.move(1); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); this.setStage(this.stage - 1); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); this.setStage(this.stage + 1); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); this.confirm(); }
    else if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); this.back(); }
  }

  private sendLocal(): void { if (this.mode === 'player') this.h.local(ROSTER[this.p1.hover], this.p1.pick === null ? null : ROSTER[this.p1.pick]); }

  /** Both locked in: GET READY, a white flash, the arena. */
  private maybeGo(): void {
    if (this.going) return;
    const p1 = this.p1.pick === null ? null : ROSTER[this.p1.pick];
    const p2 = this.local ? (this.p2.pick === null ? null : ROSTER[this.p2.pick]) : this.remote?.pick ?? null;
    if (!p1 || !p2) return;
    let stage: string | undefined;
    if (this.local) { // the stage chosen, or RANDOM drawn now (the row shows which before the arena)
      const k = this.stage === RANDOM ? Math.floor(Math.random() * STAGES.length) : this.stage;
      this.drawn = k; stage = STAGES[k].id;
      this.h.stage?.(stage);   // (RANDOM: the stage it drew comes up behind GET READY)
    }
    this.going = true;
    Sound.getReady();
    this.render();
    this.timer = window.setTimeout(() => {
      this.root.querySelector('.ps-flash')?.classList.add('on');
      this.timer = window.setTimeout(() => this.h.start(p1, p2, this.mode, stage), 420);
    }, 1200);
  }

  // ---------------------------------------------------------------- drawing

  private render(): void {
    const m = this.mode, cpu = m !== 'player', trn = m === 'training', rem = this.remote, net = this.net; // (cpu: both picks here — VS CPU or TRAINING)
    for (const k of Object.keys(this.tabs) as VsMode[]) this.tabs[k].classList.toggle('on', k === m);
    this.root.classList.toggle('trn', trn);
    // left: you
    const lc = ROSTER[this.p1.pick ?? this.p1.hover];
    this.showArt('l', lc, this.p1.pick !== null ? '' : 'live');
    this.fillPlate('l', '1P', 'YOU', lc, fighterFor(lc).name, this.p1.pick !== null);
    // right: the CPU (picked by you once yours is in) / the other player
    let rc: string | null = null, rName = '', rLocked = false, rState: 'live' | 'shade' | '' = '';
    if (cpu) { rc = ROSTER[this.p2.pick ?? this.p2.hover]; rLocked = this.p2.pick !== null; rState = this.active === 'p1' ? 'shade' : rLocked ? '' : 'live'; rName = this.active === 'p1' ? '???' : BOT_NAMES[rc] ?? 'Sparring partner'; }
    else if (rem) { rc = rem.pick ?? rem.hover; rLocked = !!rem.pick; rState = rLocked ? '' : 'live'; rName = rem.name; }
    this.showArt('r', rc, rState);
    this.plate.r.box.style.display = rc ? '' : 'none';
    if (rc) this.fillPlate('r', cpu ? 'CPU' : '2P', trn ? 'PARTNER' : cpu ? 'OPPONENT' : 'PLAYER 2', rState === 'shade' ? '' : rc, rName, rLocked);
    this.showRank(!cpu ? rem?.rank ?? null : null); // (VS PLAYER: the other player's rank under the name)
    // the roster cursors
    const place = (el: HTMLDivElement, i: number | null, label: string, lock: boolean) => {
      el.classList.toggle('hide', i === null);
      if (i === null) return;
      el.style.left = `${TILES_X + i * (TILE.w + TILE.gap)}px`;
      el.classList.toggle('lock', lock);
      el.querySelector('b')!.textContent = label;
    };
    place(this.cur.p1, this.p1.pick ?? this.p1.hover, '1P', this.p1.pick !== null);
    const p2i = cpu ? (this.active === 'p1' ? null : this.p2.pick ?? this.p2.hover) : rem ? ROSTER.indexOf((rem.pick ?? rem.hover) as typeof ROSTER[number]) : null;
    place(this.cur.p2, p2i !== null && p2i >= 0 ? p2i : null, cpu ? 'CPU' : '2P', cpu ? this.p2.pick !== null : !!rem?.pick);
    this.cur.p1.classList.toggle('p2s', !this.cur.p2.classList.contains('hide') && this.cur.p1.style.left === this.cur.p2.style.left);
    // the invite (VS PLAYER until the other one is in)
    const inv = !cpu && !rem;
    this.inv.box.style.display = inv ? '' : 'none';
    if (inv) {
      const bad = net.status === 'full' || net.status === 'error';
      this.inv.box.classList.toggle('bad', bad);
      this.inv.code.textContent = net.room || '····';
      this.inv.lnk.textContent = net.link;
      this.inv.copy.style.display = bad ? 'none' : '';
      this.inv.wait.textContent = net.status === 'full' ? 'This room already has two players' : net.status === 'error' ? 'Could not reach the server' : net.status === 'connecting' ? 'Opening the room' : 'Waiting for a player to join';
      this.inv.wait.style.setProperty('display', 'block');
      this.inv.note.textContent = net.local ? 'Test mode: open the link in another tab of this browser (online play between computers needs the server key).' : 'Send the link: whoever opens it lands here, on the other side.';
    }
    // the stage panel (VS CPU)
    this.root.classList.toggle('vsp', !cpu);
    const on = this.going && this.drawn >= 0 ? this.drawn : this.stage, rand = on === RANDOM;
    this.stp.box.style.backgroundImage = rand ? '' : `url("${STAGES[on].preview}")`;
    this.stp.q.style.display = rand ? '' : 'none';
    const sl = rand ? 'RANDOM' : STAGES[on].name;
    if (this.stp.nm.dataset.t !== sl) { this.stp.nm.innerHTML = ''; this.metal(this.stp.nm, sl, 'gold'); this.stp.nm.dataset.t = sl; }
    this.stp.dots.forEach((d, k) => d.classList.toggle('on', k === on));
    this.hint.innerHTML = `<b>← →</b> CHOOSE &nbsp;·&nbsp; ${cpu ? '<b>↑ ↓</b> STAGE &nbsp;·&nbsp; ' : ''}<b>ENTER</b> CONFIRM &nbsp;·&nbsp; <b>ESC</b> BACK`;
    // the middle
    const st = this.going ? 'GET READY!' : cpu ? (this.active === 'p1' ? 'CHOOSE YOUR FIGHTER' : trn ? 'CHOOSE YOUR PARTNER' : 'CHOOSE YOUR OPPONENT')
      : !rem ? (this.p1.pick === null ? 'CHOOSE YOUR FIGHTER' : 'READY — WAITING FOR A PLAYER')
      : this.p1.pick === null ? 'CHOOSE YOUR FIGHTER' : `WAITING FOR ${rem.name.toUpperCase()}`;
    this.st.textContent = st;
    this.st.classList.toggle('go', this.going);
    this.vs.classList.toggle('go', this.going);
    this.vs.style.display = (cpu && !trn) || rem ? '' : 'none'; // (TRAINING: no VS)
    for (const t of this.tiles) t.classList.toggle('off', this.going);
  }

  /** The other player's rank line on the right plate (none: empty). */
  private showRank(r: { rp: number; title: string | null } | null): void {
    const box = this.plate.r.rk, key = r ? `${r.rp}|${r.title ?? ''}` : '';
    if (box.dataset.k === key) return;
    box.dataset.k = key; box.innerHTML = '';
    if (r) rankLine(box, r);
  }

  private showArt(s: 'l' | 'r', cls: string | null, state: 'live' | 'shade' | ''): void {
    this.h.art(s, cls, state === '' ? 'locked' : state);
    if (cls && state !== 'shade') this.warmFx(cls);
  }
  /** The heroes' effects (the arena's loading screen, VS, result) loaded ahead for each hero shown here. */
  private warmed = new Set<string>();
  private warmImgs: HTMLImageElement[] = [];
  private warmFx(cls: string): void {
    if (!this.warmed.size) for (const st of STAGES) { const i = new Image(); i.src = st.preview; this.warmImgs.push(i); } // (the stages' backdrops for the loading screen)
    if (this.warmed.has(cls)) return;
    this.warmed.add(cls);
    for (const u of heroFxUrls(cls)) { const i = new Image(); i.src = u; this.warmImgs.push(i); }
  }

  private flashArt(s: 'l' | 'r'): void {
    const cls = s === 'l' ? (this.p1.pick === null ? null : ROSTER[this.p1.pick]) : this.local ? (this.p2.pick === null ? null : ROSTER[this.p2.pick]) : this.remote?.pick ?? null;
    Sound.lockIn(cls ?? undefined); this.h.lock(s);
    warmClip(cls ?? undefined, 'vs'); warmClip(cls ?? undefined, 'win'); // (its entrance and victory clips on their way before the VS screen)
  }

  private fillPlate(s: 'l' | 'r', side: string, tag: string, cls: string, name: string, locked: boolean): void {
    const p = this.plate[s];
    p.side.textContent = side;
    p.tag.textContent = locked ? 'READY' : tag;
    p.tag.className = locked ? 'ok' : 'you';
    const label = cls ? (CLASS_NAMES[cls] ?? cls).toUpperCase() : '?';
    if (p.cls.dataset.t !== label) { p.cls.innerHTML = ''; this.metal(p.cls, label, s === 'l' ? 'gold' : 'steel'); p.cls.dataset.t = label; }
    p.nm.textContent = name;
  }

  private metal(parent: HTMLElement, text: string, kind: 'gold' | 'steel'): void {
    const w = this.el('span', `ps-w ${kind}`, parent); w.dataset.t = text;
    this.el('span', 'ps-f', w).textContent = text;
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag); if (cls) e.className = cls; parent?.appendChild(e); return e;
  }
}
