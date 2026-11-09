// LEGACY OF SPIRITS — the way into the world (David, 9 Nov: the loading screen still showed the old game's art and
// title; GPT: the opening presentation belongs to the spirit form's stage). The select's night courtyard dimmed, the
// Legacy of Spirits title, the place's name between gold rules, a violet-to-gold bar. It covers the whole game — the
// world being built and the interface over it — until the Samurai himself is there (the world built and his spirit body
// loaded: no empty courtyard, no hero popping in late), then lifts, and the place's own arrival plays. Drawn in the page
// over the canvas (the interface is the page's too). Only behind ?spirits&ghost (the regular game keeps its own).
import Phaser from 'phaser';

const STYLE_ID = 'gol-spirit-way-style';
const RULE = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="460" height="14"><g fill="#d9b46a"><rect x="0" y="6.4" width="214" height="1.2" opacity=".7"/><rect x="246" y="6.4" width="214" height="1.2" opacity=".7"/><path d="M230 0l7 7-7 7-7-7z"/></g></svg>')}`;
const CSS = `
.gol-sp-way{position:absolute;inset:0;z-index:100;background:#07040e;overflow:hidden;pointer-events:auto;transition:opacity .52s ease-in}
.gol-sp-way.off{opacity:0;pointer-events:none}
.gol-sp-way .st{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;overflow:hidden}
.gol-sp-way .bg{position:absolute;inset:-1%;background:url(assets/spirits/select_bg.jpg) center/cover;opacity:.5}
.gol-sp-way .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,4,14,.62) 0%,rgba(7,4,14,0) 26%,rgba(7,4,14,.12) 46%,rgba(7,4,14,.86) 100%)}
.gol-sp-way .glow{position:absolute;left:50%;top:32%;width:1190px;height:460px;transform:translate(-50%,-50%);background:radial-gradient(ellipse at center,rgba(106,60,196,.34),rgba(106,60,196,0) 70%)}
.gol-sp-way .logo{position:absolute;left:50%;top:31%;width:690px;transform:translate(-50%,-50%)}
.gol-sp-way .place{position:absolute;left:50%;top:60%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:22px}
.gol-sp-way .place b{font:700 34px Cinzel,Georgia,serif;letter-spacing:6px;color:#fbf3e2;text-shadow:0 2px 12px #05030a;white-space:nowrap}
.gol-sp-way .place i{display:block;width:460px;height:14px;background:url(${RULE}) center/100% 100% no-repeat}
.gol-sp-way .bar{position:absolute;left:50%;top:84%;width:686px;height:14px;transform:translate(-50%,-50%);box-sizing:border-box;padding:3px;border:1px solid rgba(138,106,54,.9);border-radius:7px;background:rgba(13,8,24,.95)}
.gol-sp-way .fill{position:relative;height:6px;width:0;border-radius:3px;background:linear-gradient(90deg,#7b3fc4 0%,#7b3fc4 55%,#d9b46a 100%)}
.gol-sp-way .spark{position:absolute;right:-23px;top:50%;width:46px;height:46px;margin-top:-23px;border-radius:50%;background:radial-gradient(circle,rgba(201,160,255,.95),rgba(201,160,255,0) 65%);mix-blend-mode:screen}
.gol-sp-way .pct{position:absolute;left:50%;top:calc(84% + 24px);transform:translateX(-50%);font:600 15px Inter,"Segoe UI",Arial,sans-serif;letter-spacing:2px;color:#e6d6b4;text-shadow:0 1px 4px #000}
`;

export interface SpiritCurtain {
  /** How far the way in has come (0..1): the loader's files are its first half, the world and the hero the rest. */
  progress(p: number): void;
  /** He is there: the bar fills, the curtain lifts. */
  lift(): void;
}

/** The way in over the game, from the scene's preload; `onLift` when it starts to lift (the place's arrival plays then). */
export function showSpiritLoading(scene: Phaser.Scene, place: string, onLift?: () => void): SpiritCurtain {
  if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
  const host = scene.game.canvas.parentElement ?? document.body;
  const root = document.createElement('div'); root.className = 'gol-sp-way';
  const st = document.createElement('div'); st.className = 'st'; root.appendChild(st);
  for (const c of ['bg', 'shade', 'glow']) { const d = document.createElement('div'); d.className = c; st.appendChild(d); }
  const logo = document.createElement('img'); logo.className = 'logo'; logo.src = 'assets/spirits/menu_logo.png'; logo.alt = ''; st.appendChild(logo);
  const pl = document.createElement('div'); pl.className = 'place'; pl.appendChild(document.createElement('i'));
  const nm = document.createElement('b'); nm.textContent = place.toUpperCase(); pl.appendChild(nm); pl.appendChild(document.createElement('i')); st.appendChild(pl);
  const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('div'); fill.className = 'fill';
  const spark = document.createElement('div'); spark.className = 'spark'; fill.appendChild(spark); bar.appendChild(fill); st.appendChild(bar);
  const pct = document.createElement('div'); pct.className = 'pct'; st.appendChild(pct);
  host.appendChild(root);
  // laid over the game's picture as the interface is (its 1920 × 1080 scaled onto the canvas)
  const fit = () => { const r = scene.game.canvas.getBoundingClientRect(), h = host.getBoundingClientRect(); st.style.transform = `translate(${r.left - h.left}px, ${r.top - h.top}px) scale(${r.width / 1920})`; };
  fit(); window.addEventListener('resize', fit);

  let want = 0.04, shown = 0, lifting = false, gone = false, last = performance.now(), raf = 0;
  const draw = () => { fill.style.width = `${(shown * 100).toFixed(2)}%`; pct.textContent = `Entering  ${Math.round(shown * 100)}%`; };
  const tick = () => {
    if (gone) return;
    const now = performance.now(), ms = Math.min(100, now - last); last = now;
    // eased toward where the way in is, creeping on a little while a stage takes its time (never stuck, never full early)
    const goal = lifting ? 1 : Math.min(0.97, want + Math.min(0.08, (now - t0) / 60000));
    shown += (goal - shown) * Math.min(1, ms / (lifting ? 160 : 420));
    draw();
    if (lifting && shown > 0.995) { finish(); return; }
    raf = requestAnimationFrame(tick);
  };
  const t0 = performance.now();
  const finish = () => {
    if (gone) return; gone = true; cancelAnimationFrame(raf); window.removeEventListener('resize', fit);
    root.classList.add('off'); window.setTimeout(() => root.remove(), 600);
  };
  const lift = () => { if (lifting || gone) return; lifting = true; onLift?.(); };
  raf = requestAnimationFrame(tick);
  const load = scene.load;
  const onProgress = (p: number) => { want = Math.max(want, 0.04 + 0.46 * p); };
  load.on(Phaser.Loader.Events.PROGRESS, onProgress);
  load.once(Phaser.Loader.Events.COMPLETE, () => { load.off(Phaser.Loader.Events.PROGRESS, onProgress); want = Math.max(want, 0.5); });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { gone = true; cancelAnimationFrame(raf); window.removeEventListener('resize', fit); root.remove(); });
  // (a way in that never ends — a body that failed to load — lifts after a while anyway)
  window.setTimeout(lift, 16000);
  draw();
  return { progress: (p) => { want = Math.max(want, p); }, lift };
}
