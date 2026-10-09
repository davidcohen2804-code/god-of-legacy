// Each hero's own effects around them on the PvP screens (the arena's loading screen, the VS, the result): a great sign
// of their kind breathing or turning behind them and their things flying — the gambler's cards, chips and dice out of a
// fan of cards, the archer's arrows and leaves round her emblem, the samurai's petals and cuts over the sakura sigil, the
// mage's runes and pages round his star circle, the warrior's lion of light with golden embers and slashes. All from
// their own skill art (assets/pvp/fx). DOM, CSS animations only (they run on while the game loads); a layer behind the
// hero and a few pieces in front of them; the right side's is mirrored like its hero.

const FX = 'assets/pvp/fx';
const STYLE_ID = 'gol-hfx-style';

type Kind = 'drift' | 'rise' | 'streak' | 'burst' | 'fall' | 'flash';
interface Flyer {
  /** The sprites (one picked per piece); none: a glowing dot (an ember). */
  imgs?: string[];
  n: number;
  /** Width range (design px at k = 1). */
  w: [number, number];
  kind: Kind;
  /** One flight's length range (s). */
  dur: [number, number];
  /** The share of the pieces flying in front of the hero. */
  front?: number;
  /** Turns while flying: up to this many degrees. */
  spin?: number;
  /** Cards: flip over while flying. */
  flip?: boolean;
  /** Petals and leaves: sway side to side. */
  sway?: boolean;
  o?: number;
}
/** The sign behind them: `dx` (outward, away from the foe) and `dy` from their chest, so it shows beside their head. */
interface Emblem { kind: 'spin' | 'breath' | 'fan'; img?: string; w: number; dx?: number; dy?: number; o: number; sec?: number }
interface Theme { color: string; emblem: Emblem; flyers: Flyer[] }

const img = (cls: string, ...names: string[]) => names.map((n) => `${FX}/${cls}/${n}.webp`);

const THEMES: Record<string, Theme> = {
  warrior: {
    color: '#ffb547',
    emblem: { kind: 'breath', img: `${FX}/warrior/lion.webp`, w: 540, dx: -190, dy: -70, o: 0.85 },
    flyers: [
      { n: 26, w: [4, 9], kind: 'rise', dur: [3.2, 5.6], front: 0.3, o: 1 },
      { imgs: img('warrior', 'slash'), n: 3, w: [260, 360], kind: 'flash', dur: [2.2, 3.4], o: 0.95 },
    ],
  },
  samurai: {
    color: '#ff3a4e',
    emblem: { kind: 'spin', img: `${FX}/samurai/sigil_sakura.webp`, w: 640, dy: -40, o: 0.5, sec: 70 },
    flyers: [
      { imgs: img('samurai', 'petal_1', 'petal_2', 'petal_3', 'petal_4'), n: 24, w: [22, 42], kind: 'drift', dur: [5, 9], front: 0.35, spin: 540, sway: true, o: 0.95 },
      { imgs: img('samurai', 'cut_line'), n: 3, w: [420, 580], kind: 'flash', dur: [2.4, 3.6], o: 1 },
    ],
  },
  book_mage: {
    color: '#52b4ff',
    emblem: { kind: 'spin', img: `${FX}/book_mage/sig_star.webp`, w: 660, dy: -40, o: 0.55, sec: 55 },
    flyers: [
      { imgs: img('book_mage', 'rune_blue', 'rune_cyan', 'rune_violet', 'rune_gold'), n: 12, w: [30, 56], kind: 'rise', dur: [4, 7], front: 0.3, spin: 90, o: 0.95 },
      { imgs: img('book_mage', 'page_1', 'page_2', 'page_3'), n: 7, w: [36, 64], kind: 'drift', dur: [7, 11], front: 0.3, spin: 240, sway: true, o: 0.9 },
      { imgs: img('book_mage', 'star_fall'), n: 3, w: [150, 210], kind: 'fall', dur: [2.6, 3.8], o: 1 },
    ],
  },
  archer: {
    color: '#86d957',
    emblem: { kind: 'breath', img: `${FX}/archer/emblem.webp`, w: 470, dx: -110, dy: -60, o: 0.65 },
    flyers: [
      { imgs: img('archer', 'arrow_wind', 'arrow_streak'), n: 7, w: [220, 320], kind: 'streak', dur: [1.6, 2.6], front: 0.3, o: 1 },
      { imgs: img('archer', 'leaf_1', 'leaf_2', 'leaf_3', 'feather'), n: 18, w: [24, 44], kind: 'drift', dur: [5, 8], front: 0.35, spin: 480, sway: true, o: 0.95 },
      { imgs: img('archer', 'arrow_glint'), n: 5, w: [40, 70], kind: 'flash', dur: [1.8, 2.8], o: 1 },
    ],
  },
  gambler: {
    color: '#e45cff',
    emblem: { kind: 'fan', w: 200, dx: -170, dy: -190, o: 0.7 },
    flyers: [
      { imgs: img('gambler', 'card_S', 'card_H', 'card_D', 'card_C', 'card_ace', 'card_joker', 'card_back'), n: 16, w: [52, 84], kind: 'burst', dur: [2.4, 3.8], front: 0.35, spin: 720, flip: true, o: 1 },
      { imgs: img('gambler', 'c_chip', 'c_die_a', 'c_coin_h'), n: 6, w: [44, 70], kind: 'burst', dur: [2.8, 4.2], front: 0.3, spin: 540, o: 1 },
    ],
  },
};

const CSS = `
.hfx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.hfx.m{transform:scaleX(-1)}
.hfx .hfx-em{position:absolute;left:0;top:0;display:block;height:auto;transform:translate(-50%,-50%);opacity:var(--o1);filter:drop-shadow(0 0 22px var(--c))}
.hfx .hfx-em.spin{animation:hfxSpin var(--sec) linear infinite}
.hfx .hfx-em.breath{animation:hfxBreath 2.6s ease-in-out infinite alternate}
@keyframes hfxSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes hfxBreath{from{transform:translate(-50%,-50%) scale(.96);opacity:var(--o0)}to{transform:translate(-50%,-50%) scale(1.05);opacity:var(--o1)}}
.hfx .hfx-fan{position:absolute;left:0;top:0;width:0;height:0;animation:hfxBreath 2.6s ease-in-out infinite alternate}
.hfx .hfx-fan img{position:absolute;left:0;bottom:0;display:block;transform-origin:50% 135%;filter:drop-shadow(0 0 16px var(--c)) drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.hfx .hfx-p{position:absolute;left:0;top:0;opacity:0;animation-iteration-count:infinite;animation-timing-function:linear}
.hfx .hfx-p > *{display:block;translate:-50% -50%}
.hfx .hfx-p > img{height:auto}
.hfx .hfx-p > i{border-radius:50%;background:#fff8dc;box-shadow:0 0 8px 3px var(--c)}
.hfx .hfx-p.glow > img{filter:drop-shadow(0 0 10px var(--c))}
.hfx .hfx-p.sway > *{animation:hfxSway var(--sw) ease-in-out infinite alternate}
.hfx .hfx-p.flip > *{animation:hfxFlip var(--sw) linear infinite}
@keyframes hfxSway{from{transform:translateX(-24px)}to{transform:translateX(24px)}}
@keyframes hfxFlip{to{transform:perspective(500px) rotateY(360deg)}}
@keyframes hfxGo{0%{transform:translate(var(--x),var(--y)) rotate(var(--r0));opacity:0}12%{opacity:var(--o)}82%{opacity:var(--o)}
  100%{transform:translate(calc(var(--x) + var(--dx)),calc(var(--y) + var(--dy))) rotate(var(--r1));opacity:0}}
@keyframes hfxDash{0%{transform:translate(var(--x),var(--y)) rotate(var(--r0));opacity:0}5%{opacity:var(--o)}34%{opacity:var(--o)}
  42%,100%{transform:translate(calc(var(--x) + var(--dx)),calc(var(--y) + var(--dy))) rotate(var(--r0));opacity:0}}
@keyframes hfxFlash{0%{transform:translate(var(--x),var(--y)) rotate(var(--r0)) scale(.5);opacity:0}7%{transform:translate(var(--x),var(--y)) rotate(var(--r0)) scale(1.04);opacity:var(--o)}
  24%,100%{transform:translate(var(--x),var(--y)) rotate(var(--r0)) scale(1.14);opacity:0}}`;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(l: T[]) => l[Math.floor(Math.random() * l.length)];

/** The hero's effects as two layers (behind them, in front of them) for a box `W` x `H` (design px): the hero's chest at
 *  (ax, ay), everything `k` times its size; `mirror` for the right side. Null for a hero with no theme. */
export function heroFx(cls: string, o: { W: number; H: number; ax: number; ay: number; k?: number; mirror?: boolean }): { back: HTMLDivElement; front: HTMLDivElement } | null {
  const t = THEMES[cls];
  if (!t) return null;
  if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
  const k = o.k ?? 1, { W, H, ax, ay } = o;
  const layer = () => {
    const d = document.createElement('div'); d.className = o.mirror ? 'hfx m' : 'hfx';
    d.style.setProperty('--c', t.color); return d;
  };
  const back = layer(), front = layer();
  // the sign behind them
  const e = t.emblem, ex = ax + (e.dx ?? 0) * k, ey = ay + (e.dy ?? 0) * k;
  if (e.kind === 'fan') { // a fanned hand of cards
    const fan = document.createElement('div'); fan.className = 'hfx-fan';
    Object.assign(fan.style, { left: `${ex}px`, top: `${ey + e.w * 0.7 * k}px` });
    fan.style.setProperty('--o0', String(e.o * 0.75)); fan.style.setProperty('--o1', String(e.o));
    const cards = ['card_C', 'card_D', 'card_ace', 'card_H', 'card_S'];
    cards.forEach((n, i) => {
      const c = document.createElement('img'); c.src = `${FX}/gambler/${n}.webp`; c.alt = ''; c.draggable = false;
      c.style.width = `${e.w * k}px`; c.style.marginLeft = `${(-e.w * k) / 2}px`;
      c.style.transform = `rotate(${(i - 2) * 17}deg)`; c.style.zIndex = String(i === 2 ? 5 : 5 - Math.abs(i - 2));
      fan.appendChild(c);
    });
    back.appendChild(fan);
  } else {
    const em = document.createElement('img'); em.className = `hfx-em ${e.kind}`; em.src = e.img!; em.alt = ''; em.draggable = false;
    Object.assign(em.style, { left: `${ex}px`, top: `${ey}px`, width: `${e.w * k}px` });
    em.style.setProperty('--o0', String(e.o * 0.7)); em.style.setProperty('--o1', String(e.o)); if (e.sec) em.style.setProperty('--sec', `${e.sec}s`);
    back.appendChild(em);
  }
  // their things flying
  for (const f of t.flyers) {
    for (let i = 0; i < f.n; i++) {
      const p = document.createElement('div'), w = rnd(f.w[0], f.w[1]) * k, dur = rnd(f.dur[0], f.dur[1]);
      p.className = `hfx-p${f.imgs ? ' glow' : ''}${f.sway ? ' sway' : ''}${f.flip ? ' flip' : ''}`;
      let x = 0, y = 0, dx = 0, dy = 0, r0 = rnd(-180, 180), r1 = r0 + (f.spin ? rnd(-f.spin, f.spin) : 0), anim = 'hfxGo';
      switch (f.kind) {
        case 'drift': x = rnd(ax - 620 * k, ax + 260 * k); y = -80; dx = rnd(160, 460) * k; dy = H + 160; break; // down and across
        case 'rise': x = rnd(ax - 380 * k, ax + 380 * k); y = rnd(H - 120, H + 30); dx = rnd(-70, 70) * k; dy = -rnd(0.65, 1) * H; r1 = r0 + (f.spin ? rnd(-f.spin, f.spin) : 0); if (!f.imgs) r0 = r1 = 0; break;
        case 'streak': { x = -360; y = rnd(ay - 330 * k, ay + 280 * k); dx = W + 720; dy = rnd(-90, 90); r0 = r1 = (Math.atan2(dy, dx) * 180) / Math.PI; anim = 'hfxDash'; break; } // straight across, fast
        case 'fall': x = rnd(ax - 100 * k, ax + 520 * k); y = -260; dx = -rnd(300, 420) * k; dy = H * 0.9; r0 = r1 = 0; anim = 'hfxDash'; break; // a falling star (drawn on its slant)
        case 'burst': { // out from behind them, every way
          const a = rnd(0, Math.PI * 2), d = rnd(420, 820) * k;
          x = ax + rnd(-50, 50) * k; y = ay + rnd(-70, 50) * k; dx = Math.cos(a) * d; dy = Math.sin(a) * d - rnd(0, 120) * k; break;
        }
        case 'flash': x = ax + rnd(-300, 300) * k; y = ay + rnd(-260, 220) * k; r0 = r1 = rnd(-40, 40) + (Math.random() < 0.5 ? 0 : 180); anim = 'hfxFlash'; break;
      }
      Object.assign(p.style, { animationName: anim, animationDuration: `${dur.toFixed(2)}s`, animationDelay: `${(-Math.random() * dur).toFixed(2)}s` });
      for (const [n, v] of [['--x', `${x}px`], ['--y', `${y}px`], ['--dx', `${dx}px`], ['--dy', `${dy}px`], ['--r0', `${r0}deg`], ['--r1', `${r1}deg`], ['--o', String(f.o ?? 1)], ['--sw', `${rnd(1.4, 2.4).toFixed(2)}s`]] as const) p.style.setProperty(n, v);
      if (f.imgs) {
        const m = document.createElement('img'); m.src = pick(f.imgs); m.alt = ''; m.draggable = false; m.style.width = `${w}px`; p.appendChild(m);
      } else { const d = document.createElement('i'); d.style.width = d.style.height = `${w}px`; p.appendChild(d); }
      (Math.random() < (f.front ?? 0) ? front : back).appendChild(p);
    }
  }
  return { back, front };
}

/** The effects' sprites for a hero (to load ahead). */
export function heroFxUrls(cls: string): string[] {
  const t = THEMES[cls];
  if (!t) return [];
  const u = new Set<string>(t.flyers.flatMap((f) => f.imgs ?? []));
  if (t.emblem.img) u.add(t.emblem.img);
  if (t.emblem.kind === 'fan') for (const n of ['card_C', 'card_D', 'card_ace', 'card_H', 'card_S']) u.add(`${FX}/gambler/${n}.webp`);
  return [...u];
}
