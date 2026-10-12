// The PvP rank on screen: the tier's painted emblem (assets/hud/ranks/<tier>.webp), its name and division in the fight's
// lettering, the RP bar, the win streak and the title worn — on the select screen (your plate; click the title to change
// it), under your name on the VS screen, and on the result (the RP bar filling or draining, PROMOTED!, new titles).
// DOM inside the 1920 x 1080 overlays.
import { RankChange, RankRecord, TITLES, myRank, rankOf, titleName, wearTitle } from '../pvp/Rank';

const DISPLAY = "'Exo 2', 'Segoe UI', sans-serif";
const LABEL = "Inter, 'Segoe UI', sans-serif";
export const emblemUrl = (rp: number): string => `assets/hud/ranks/${rankOf(rp).tier.id}.webp`;

const CSS = `
.gol-rk{display:flex;align-items:center;gap:16px;color:#fff;font-family:${DISPLAY};pointer-events:auto;user-select:none}
.gol-rk .rk-em{flex:none;width:96px;height:96px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.6)) drop-shadow(0 0 12px var(--tc))}
.gol-rk .rk-tx{display:flex;flex-direction:column;gap:7px;min-width:0}
.gol-rk .rk-tier{font:900 italic 30px/1 ${DISPLAY};letter-spacing:1px;color:var(--tc);text-shadow:0 2px 0 #000,0 0 14px rgba(0,0,0,.8);white-space:nowrap}
.gol-rk .rk-bar{position:relative;width:240px;height:12px;clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);background:linear-gradient(180deg,#ffffff,#8f98ab 40%,#2a303d 70%,#d7ae58);padding:2px;box-sizing:border-box}
.gol-rk .rk-tk{position:relative;width:100%;height:100%;clip-path:polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%);background:#05070c;overflow:hidden}
.gol-rk .rk-fl{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(180deg,#fffbe8,var(--tc) 55%,#6b4a12);transition:width .9s cubic-bezier(.3,.8,.3,1)}
.gol-rk .rk-rp{font:700 italic 12px/1 ${LABEL};letter-spacing:1.6px;color:#c9c2b0;white-space:nowrap}
.gol-rk .rk-rp b{color:#fff;font-weight:800}
.gol-rk .rk-row{display:flex;align-items:center;gap:10px;white-space:nowrap}
.gol-rk .rk-st{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 10px 0 8px;clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);
  background:linear-gradient(180deg,#ff9a3c,#c2380e);font:800 italic 12px/22px ${LABEL};letter-spacing:1.4px;color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.4)}
.gol-rk .rk-st::before{content:'';width:10px;height:13px;background:radial-gradient(ellipse at 50% 80%,#fff6c8 0 25%,#ffd36a 40%,rgba(255,120,30,0) 72%);border-radius:50% 50% 45% 45%/60% 60% 40% 40%}
.gol-rk .rk-ti{align-self:flex-start;text-align:left;font:700 italic 15px/1 ${LABEL};letter-spacing:.6px;color:#ffe7a6;text-shadow:0 2px 3px #000;cursor:pointer;border:0;background:none;padding:4px 0}
.gol-rk .rk-ti:hover{color:#fff}
.gol-rk .rk-ti::after{content:' ▾';font-size:11px;color:#c9a65a}
.gol-rk.ro .rk-ti{cursor:default}
.gol-rk.ro .rk-ti::after{content:''}
.gol-rk .rk-ti.none{color:#8d96a6;font-weight:600}
/* the title picker */
.gol-rkp{position:absolute;z-index:30;width:430px;max-height:470px;overflow:auto;padding:16px 18px 18px;box-sizing:border-box;pointer-events:auto;
  clip-path:polygon(0 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%);background:linear-gradient(180deg,rgba(20,25,38,.98),rgba(6,8,14,.98));
  box-shadow:inset 0 2px 0 rgba(240,204,128,.75),inset 0 -2px 0 rgba(240,204,128,.35);font-family:${LABEL};color:#e6dcc4}
.gol-rkp h4{margin:0 0 12px;font:800 italic 17px/1 ${DISPLAY};letter-spacing:2px;color:#fff}
.gol-rkp button{display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%;margin:0 0 6px;padding:9px 14px;border:0;text-align:left;cursor:pointer;
  clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%);background:rgba(255,255,255,.06);color:#f3e3bd;font:800 italic 16px/1.1 ${DISPLAY}}
.gol-rkp button small{font:500 12px/1.3 ${LABEL};color:#9aa3b2;letter-spacing:.2px}
.gol-rkp button:hover:not(:disabled){background:rgba(255,255,255,.14)}
.gol-rkp button.on{background:linear-gradient(180deg,#f2d493,#d2a65a);color:#24180a}
.gol-rkp button.on small{color:#4b3613}
.gol-rkp button:disabled{cursor:default;color:#6f7686;background:rgba(255,255,255,.025)}
/* under a name on the VS screen */
.gol-rkl{display:flex;align-items:center;gap:10px;font:800 italic 20px/1 ${DISPLAY};letter-spacing:1px;color:var(--tc);text-shadow:0 2px 0 #000,0 0 12px rgba(0,0,0,.8);white-space:nowrap}
.gol-rkl img{width:58px;height:58px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.6)) drop-shadow(0 0 10px var(--tc))}
.gol-rkl .rk-tt{font:700 italic 17px/1 ${LABEL};letter-spacing:.6px;color:#ffe7a6;text-transform:none}
/* on the result */
.gol-rkr{display:flex;align-items:center;gap:18px;padding:14px 22px 6px;border-top:1px solid rgba(240,204,128,.25);position:relative}
.gol-rkr .rk-em{width:108px;height:108px}
.gol-rkr .rk-em.up{animation:rkUp 1.1s cubic-bezier(.2,1.3,.4,1) .9s both}
@keyframes rkUp{0%{transform:scale(1);filter:brightness(1)}35%{transform:scale(1.35);filter:brightness(2.4) drop-shadow(0 0 30px #fff)}100%{transform:scale(1);filter:brightness(1)}}
.gol-rkr .rk-dl{font:900 italic 30px/1 ${DISPLAY};letter-spacing:1px;color:#8fe38a;text-shadow:0 2px 0 #000;font-variant-numeric:tabular-nums}
.gol-rkr .rk-dl.neg{color:#ff8f74}
.gol-rkr .rk-dl.zero{color:#c9c2b0}
.gol-rkr .rk-promo{position:absolute;right:16px;top:-6px;font:900 italic 26px/1 ${DISPLAY};letter-spacing:2px;color:#fff3c4;text-shadow:0 2px 0 #3a2000,0 0 18px rgba(255,200,80,.9);
  animation:rkPromo .6s cubic-bezier(.3,1.5,.5,1) 1.4s both}
@keyframes rkPromo{from{opacity:0;transform:scale(2.4) rotate(-6deg)}to{opacity:1;transform:rotate(-6deg)}}
.gol-rkr .rk-new{font:700 italic 14px/1.3 ${LABEL};color:#ffe7a6;letter-spacing:.4px;animation:rkNew .5s ease-out 1.8s both}
.gol-rkr .rk-new b{color:#fff;font-weight:800}
@keyframes rkNew{from{opacity:0;transform:translateY(8px)}}`;

const style = () => { if (!document.getElementById('gol-rk-style')) { const s = document.createElement('style'); s.id = 'gol-rk-style'; s.textContent = CSS; document.head.appendChild(s); } };
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; parent.appendChild(e); return e;
};

/** The RP bar's fill (0..1) and its caption for `rp`. */
function barOf(rp: number): { f: number; cap: string } {
  const v = rankOf(rp);
  if (v.tier.id === 'legend') return { f: 1, cap: `<b>${Math.floor(rp)}</b> RP` };
  return { f: Math.max(0, Math.min(1, v.into / v.span)), cap: `<b>${Math.floor(v.into)}</b> / ${v.span} RP` };
}

/** Your rank plate (select screen): emblem, tier, RP bar, streak, title (click: choose another). */
export function rankPlate(parent: HTMLElement, host: HTMLElement): { el: HTMLDivElement; refresh(): void } {
  style();
  const box = el('div', 'gol-rk', parent), em = el('img', 'rk-em', box), tx = el('div', 'rk-tx', box);
  em.alt = ''; em.draggable = false;
  const tier = el('div', 'rk-tier', tx), bar = el('div', 'rk-bar', tx), fl = el('div', 'rk-fl', el('div', 'rk-tk', bar));
  const row = el('div', 'rk-row', tx), rp = el('span', 'rk-rp', row), st = el('span', 'rk-st', row);
  const ti = el('button', 'rk-ti', tx) as HTMLButtonElement; ti.type = 'button';
  let pick: HTMLDivElement | null = null;
  const close = () => { pick?.remove(); pick = null; };
  const refresh = () => {
    const r = myRank(), v = rankOf(r.rp), b = barOf(r.rp);
    box.style.setProperty('--tc', v.tier.color); em.src = emblemUrl(r.rp);
    tier.textContent = v.label; fl.style.width = `${(b.f * 100).toFixed(1)}%`; rp.innerHTML = b.cap;
    st.textContent = `${r.streak} WIN STREAK`; st.style.display = r.streak >= 2 ? '' : 'none';
    const name = titleName(r.title); ti.textContent = name ? `“${name}”` : r.titles.length ? 'Choose a title' : 'No title yet';
    ti.classList.toggle('none', !name);
  };
  ti.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pick) { close(); return; }
    const r = myRank();
    pick = el('div', 'gol-rkp', host);
    const pr = box.getBoundingClientRect(), hr = host.getBoundingClientRect(), k = hr.width / 1920 || 1; // (the overlay is scaled: back to design px)
    Object.assign(pick.style, { left: `${(pr.left - hr.left) / k}px`, bottom: `${(hr.bottom - pr.top) / k + 12}px` });
    el('h4', '', pick).textContent = 'TITLES';
    const opt = (id: string | null, name: string, how: string, got: boolean) => {
      const b = el('button', r.title === id ? 'on' : '', pick!) as HTMLButtonElement; b.type = 'button'; b.disabled = !got;
      b.append(name); el('small', '', b).textContent = got ? how : `Locked — ${how}`;
      b.addEventListener('click', () => { wearTitle(id); close(); refresh(); });
    };
    opt(null, 'No title', 'Show none', true);
    for (const t of TITLES) opt(t.id, t.name, t.how, r.titles.includes(t.id));
  });
  host.addEventListener('mousedown', (e) => { if (pick && !pick.contains(e.target as Node) && e.target !== ti) close(); });
  refresh();
  return { el: box, refresh };
}

/** A fighter's rank under their name on the VS screen (emblem, tier, title); `rec` null: none. */
export function rankLine(parent: HTMLElement, rec: Pick<RankRecord, 'rp' | 'title'> | null): HTMLElement | null {
  if (!rec) return null;
  style();
  const v = rankOf(rec.rp), l = el('div', 'gol-rkl', parent), img = el('img', '', l);
  l.style.setProperty('--tc', v.tier.color); img.src = emblemUrl(rec.rp); img.alt = ''; img.draggable = false;
  l.append(v.label);
  const t = titleName(rec.title);
  if (t) el('span', 'rk-tt', l).textContent = `“${t}”`;
  return l;
}

/** The match's effect on your rank, on the result: the bar runs from where it was to where it is, the RP counts, the
 *  emblem flares on a promotion (PROMOTED!), new titles are named. */
export function rankResult(parent: HTMLElement, c: RankChange): HTMLElement {
  style();
  const b0 = barOf(c.before.rp), v1 = rankOf(c.after.rp), b1 = barOf(c.after.rp);
  const box = el('div', 'gol-rk gol-rkr ro', parent);
  box.style.setProperty('--tc', v1.tier.color);
  const em = el('img', `rk-em${c.up ? ' up' : ''}`, box); em.src = emblemUrl(c.up ? c.before.rp : c.after.rp); em.alt = ''; em.draggable = false;
  const tx = el('div', 'rk-tx', box), tier = el('div', 'rk-tier', tx);
  tier.textContent = rankOf(c.up ? c.before.rp : c.after.rp).label;
  const bar = el('div', 'rk-bar', tx), fl = el('div', 'rk-fl', el('div', 'rk-tk', bar));
  const row = el('div', 'rk-row', tx), rp = el('span', 'rk-rp', row);
  fl.style.transition = 'none'; fl.style.width = `${(b0.f * 100).toFixed(1)}%`; rp.innerHTML = b0.cap;
  if (c.after.streak >= 2) el('span', 'rk-st', row).textContent = `${c.after.streak} WIN STREAK`;
  const dl = el('div', `rk-dl${c.delta < 0 ? ' neg' : c.delta === 0 ? ' zero' : ''}`, box);
  dl.textContent = `${c.delta > 0 ? '+' : ''}${c.delta} RP`;
  window.setTimeout(() => { if (box.isConnected) { fl.style.transition = ''; fl.style.width = `${(b1.f * 100).toFixed(1)}%`; rp.innerHTML = b1.cap; } }, 900); // (the bar runs once the result has settled in)
  if (c.up) window.setTimeout(() => { if (box.isConnected) { em.src = emblemUrl(c.after.rp); tier.textContent = v1.label; } }, 1280); // (the emblem changes at its flare's height)
  if (c.up) el('div', 'rk-promo', box).textContent = 'PROMOTED!';
  if (c.titles.length) { const n = el('div', 'rk-new', tx); n.append('New title: '); el('b', '', n).textContent = c.titles.map((t) => t.name).join(', '); }
  return box;
}
