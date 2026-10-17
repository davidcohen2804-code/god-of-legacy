// Training's combo trials (the arena's left side, where a match shows the combo guide): the trial in hand — its name,
// where to open it from, its keys in order, each lighting up as it lands — what just broke it (DROPPED, MISSED, HOLD IT),
// and TRIAL CLEAR! across the screen with sparks when the last one lands; then on to the next trial. The arrows go through
// every trial of the class (the dots under them: the cleared ones in gold); RESET puts both fighters back on their marks
// at the trial's opening distance. The keys follow Key Settings.
// DOM inside the HUD overlay (1920x1080 design px, scaled with it).
import { CLASS_NAMES, FONT_FAMILY } from '../config/layout';
import type { GuideRange, GuideRoute, GuideStep } from '../data/comboGuide';
import { iconUrl } from '../skills/FinalKit';
import type { FinalSkill } from '../skills/SkillTypes';
import { clearedOf, markCleared, TrialNote, TrialRun, trialsOf } from '../pvp/Trials';
import { CallFx } from './CallFx';
import { Sound } from '../audio/Sound';
import type { GuideKeys } from './ComboGuide';

const STYLE_ID = 'gol-tr-style';
const DISPLAY = "'Exo 2', 'Segoe UI', sans-serif";
const LABEL = "'Inter', 'Segoe UI', sans-serif";
const GOLD = 'linear-gradient(180deg,#fffdf2 0%,#ffeab2 24%,#f7c75c 47%,#9a580b 50%,#d58d27 68%,#ffe7a1 100%)';
const RANGE: Record<GuideRange, string> = { CLOSE: 'Open from close by', MID: 'Open from a few steps away', FAR: 'Open from far away' };
/** After TRIAL CLEAR!, the next trial comes up (ms). */
const NEXT_MS = 2300;

const CSS = `
.gol-tr{position:absolute;left:18px;top:184px;width:440px;box-sizing:border-box;display:none;flex-direction:column;gap:10px;padding:13px 14px 14px;pointer-events:auto;
  background:linear-gradient(rgba(6,10,18,.86),rgba(6,10,18,.72));border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.45),inset 0 0 0 1px rgba(201,154,69,.5);font-family:${FONT_FAMILY}}
.gol-tr.on{display:flex}
.gol-tr.bad{animation:trBad .42s linear}
@keyframes trBad{0%,100%{transform:none}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}}
.gol-tr .tr-hd{display:flex;align-items:center;justify-content:space-between;padding:0 2px}
.gol-tr .tr-hd span{font:700 12px ${FONT_FAMILY};letter-spacing:2.5px;color:#f3d58a;text-shadow:0 1px 2px #000}
.gol-tr .tr-hd b{font:800 12px ${LABEL};letter-spacing:1px;color:#ffe7a8}
.gol-tr .tr-hd b i{font-style:normal;color:#ffc94a;margin-right:5px}
.gol-tr .tr-nav{display:grid;grid-template-columns:34px 1fr 34px;align-items:center;gap:8px}
.gol-tr .tr-ar{width:34px;height:44px;padding:0;border:1px solid #6a5630;border-radius:7px;background:#0b121b;color:#e9cf8f;font:900 16px/1 ${DISPLAY};cursor:pointer}
.gol-tr .tr-ar:hover{border-color:#c99a45;box-shadow:0 0 10px rgba(232,178,90,.35)}
.gol-tr .tr-tt{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}
.gol-tr .tr-tt small{font:800 10px ${LABEL};letter-spacing:2px;color:#a9b4bf}
.gol-tr .tr-tt small em{font-style:normal;margin-left:8px;padding:1px 5px;border-radius:4px;font-size:9px;letter-spacing:1.2px}
.gol-tr .tr-tt small em.CLOSE{color:#9fb3c8;box-shadow:inset 0 0 0 1px rgba(159,179,200,.5)}
.gol-tr .tr-tt small em.MID{color:#e9c46a;box-shadow:inset 0 0 0 1px rgba(233,196,106,.5)}
.gol-tr .tr-tt small em.FAR{color:#f29b85;box-shadow:inset 0 0 0 1px rgba(242,155,133,.5)}
.gol-tr .tr-tt small em.ok{color:#24180a;background:linear-gradient(180deg,#f2d493,#d2a65a)}
.gol-tr .tr-w{position:relative;display:inline-block;isolation:isolate;white-space:nowrap;font:900 italic 30px/1.1 ${DISPLAY};letter-spacing:.04em;padding:0 .14em}
.gol-tr .tr-w .tr-f{color:transparent;background-image:${GOLD};-webkit-background-clip:text;background-clip:text}
.gol-tr .tr-w::before{content:attr(data-t);position:absolute;left:0;top:0;width:100%;height:100%;padding:inherit;box-sizing:border-box;z-index:-1;color:#2b1404;-webkit-text-stroke:.1em #2b1404;filter:drop-shadow(0 .05em 0 rgba(0,0,0,.6))}
.gol-tr .tr-st{display:flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:6px 4px;padding:4px 0 2px}
.gol-tr .tr-g{display:inline-flex;align-items:center;gap:4px}
.gol-tr .tr-a{font:700 17px/1 ${LABEL};color:#8a7650;padding:0 1px}
.gol-tr .tr-k{position:relative;display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 10px 0 4px;box-sizing:border-box;border-radius:8px;border:1px solid #6a5630;background:#0b121b;white-space:nowrap;transition:background .15s,border-color .15s,box-shadow .15s}
.gol-tr .tr-k img{width:29px;height:29px;border-radius:5px;display:block}
.gol-tr .tr-k b{font:800 15px ${LABEL};color:#ffe7a8;min-width:10px;text-align:center}
.gol-tr .tr-k b.nk{color:#7d8794}
.gol-tr .tr-k b.lg{font-size:11.5px;letter-spacing:.3px}
.gol-tr .tr-k i{font:800 12px ${LABEL};font-style:normal;color:#c9b48a;margin-left:-2px}
.gol-tr .tr-k em{font:800 9px ${LABEL};font-style:normal;letter-spacing:.8px;color:#9ed8ff;border:1px solid rgba(158,216,255,.5);border-radius:4px;padding:2px 3px}
.gol-tr .tr-k.j{padding:0 10px}
.gol-tr .tr-k.j u{text-decoration:none;font:900 17px ${LABEL};color:#9ed8ff}
.gol-tr .tr-k.now{border-color:#f2c45a;animation:trNow .55s ease-in-out infinite alternate}
@keyframes trNow{from{box-shadow:0 0 0 1px rgba(242,196,90,.5),0 0 8px rgba(242,196,90,.35)}to{box-shadow:0 0 0 2px #ffd36a,0 0 16px rgba(255,200,90,.7)}}
.gol-tr .tr-k.ok{border-color:#ffe08a;background:linear-gradient(180deg,#5a4312,#2a1d06);box-shadow:0 0 12px rgba(255,200,90,.55)}
.gol-tr .tr-k.ok::after{content:'✓';position:absolute;right:-6px;top:-7px;width:17px;height:17px;border-radius:50%;background:linear-gradient(180deg,#ffe9a8,#d79a2c);color:#24180a;font:900 11px/17px ${LABEL};text-align:center;box-shadow:0 0 0 1.5px #24180a}
.gol-tr .tr-k.pop{animation:trPop .32s cubic-bezier(.3,1.5,.5,1)}
@keyframes trPop{0%{transform:scale(1.35);filter:brightness(1.8)}100%{transform:none;filter:none}}
.gol-tr .tr-mt{display:flex;justify-content:center;gap:10px;font:700 11.5px ${LABEL};letter-spacing:.6px;color:#bfb08e}
.gol-tr .tr-mt b{color:#fff;font-weight:800}
.gol-tr .tr-msg{min-height:22px;text-align:center;font:700 13.5px/22px ${LABEL};letter-spacing:.4px;color:#cfd7df;padding:0 4px}
.gol-tr .tr-msg.bad{color:#ff8f74;letter-spacing:1px}
.gol-tr .tr-msg.good{color:#ffd36a;letter-spacing:2px;font-weight:900}
.gol-tr .tr-bt{display:flex;justify-content:center}
.gol-tr .tr-bt button{height:32px;padding:0 18px;border-radius:7px;border:1px solid #6a5630;background:#0b121b;color:#c9b48a;font:700 12px ${FONT_FAMILY};letter-spacing:1.4px;cursor:pointer;text-shadow:0 1px 2px #000}
.gol-tr .tr-bt button:hover{border-color:#c99a45;box-shadow:0 0 10px rgba(232,178,90,.35);color:#ffe7a8}
.gol-tr .tr-dots{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;padding:2px 6px 0}
.gol-tr .tr-dots i{width:9px;height:9px;border-radius:2px;transform:rotate(45deg);background:rgba(214,222,240,.22);box-shadow:0 0 0 1px rgba(0,0,0,.6);cursor:pointer}
.gol-tr .tr-dots i.ok{background:#ffc94a;box-shadow:0 0 6px rgba(255,190,70,.7)}
.gol-tr .tr-dots i.at{outline:1.5px solid #fff;outline-offset:2px}
.gol-trc{position:absolute;left:0;top:300px;width:1920px;height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.gol-trc .tr-big{position:relative;display:inline-block;isolation:isolate;white-space:nowrap;font:900 italic 128px/1.1 ${DISPLAY};letter-spacing:.02em;padding:0 .16em;animation:trSlam .42s cubic-bezier(.3,1.35,.5,1) both}
.gol-trc .tr-big .tr-f{color:transparent;background-image:${GOLD};-webkit-background-clip:text;background-clip:text}
.gol-trc .tr-big::before{content:attr(data-t);position:absolute;left:0;top:0;width:100%;height:100%;padding:inherit;box-sizing:border-box;z-index:-1;color:#2b1404;-webkit-text-stroke:.11em #2b1404;filter:drop-shadow(0 .055em 0 rgba(0,0,0,.6)) drop-shadow(0 0 .2em rgba(255,178,64,.55))}
.gol-trc .tr-sub{margin-top:4px;font:900 italic 30px/1 ${DISPLAY};letter-spacing:.32em;padding-left:.32em;color:#ffe9b0;text-shadow:0 3px 0 #2b1404,0 0 18px rgba(255,180,70,.6);animation:trSub .5s ease-out .22s both}
.gol-trc.out{animation:trOut .35s ease-in forwards}
@keyframes trSlam{0%{opacity:0;transform:scale(3)}58%{opacity:1;transform:scale(.92)}100%{opacity:1;transform:scale(1)}}
@keyframes trSub{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:none}}
@keyframes trOut{to{opacity:0;transform:scale(1.12)}}
@media (prefers-reduced-motion:reduce){.gol-tr .tr-k.now,.gol-tr .tr-k.pop,.gol-tr.bad,.gol-trc .tr-big,.gol-trc .tr-sub{animation:none}}`;

export interface TrialHandlers {
  /** Both fighters back on their marks, `range` apart (the trial's opener), every skill ready. */
  reset(range: GuideRange, route?: GuideRoute): void;
}

const hitsOf = (s: FinalSkill) => [...s.hits, ...(s.chain?.stages.flat() ?? []), ...(s.charge?.levels.flatMap((l) => l.hits) ?? [])];

export class TrialUI {
  /** This class has trials. */
  static has(cls: string): boolean { return trialsOf(cls).length > 0; }

  private readonly root: HTMLDivElement;
  private readonly hd: HTMLElement;
  private readonly tt: { n: HTMLElement; w: HTMLElement; rg: HTMLElement; ok: HTMLElement };
  private readonly steps: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly msg: HTMLElement;
  private readonly dots: HTMLElement[] = [];
  private readonly cf: CallFx;
  private readonly routes: GuideRoute[];
  private readonly done: Set<string>;
  private readonly slotOf: Map<string, number>;
  private chips: HTMLElement[] = [];
  /** Every key letter shown (slot index, or -1 for the jump key): relabelled when Key Settings change. */
  private keyEls: { el: HTMLElement; slot: number }[] = [];
  private keys: GuideKeys;
  private at = 0;
  private run: TrialRun;
  private on = false;
  private call: HTMLElement | null = null;
  private timers: number[] = [];

  constructor(private parent: HTMLElement, private cls: string, private kit: FinalSkill[], keys: GuideKeys, private h: TrialHandlers) {
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.keys = keys;
    this.routes = trialsOf(cls);
    this.done = clearedOf(cls);
    this.slotOf = new Map(kit.map((s, i) => [s.id, i]));
    const root = this.root = this.el('div', 'gol-tr', parent);
    root.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    const hd = this.el('div', 'tr-hd', root);
    this.el('span', '', hd).textContent = 'COMBO TRIALS';
    this.hd = this.el('b', '', hd);
    const nav = this.el('div', 'tr-nav', root);
    const arrow = (d: number, t: string, label: string) => { const b = this.el('button', 'tr-ar', nav) as HTMLButtonElement; b.type = 'button'; b.textContent = t; b.title = label; b.addEventListener('click', () => this.pick(this.at + d)); return b; };
    arrow(-1, '◀', 'The trial before');
    const tt = this.el('div', 'tr-tt', nav), n = this.el('small', '', tt), w = this.el('span', 'tr-w', tt); // (the title between the arrows)
    arrow(1, '▶', 'The next trial');
    this.tt = { n, w, rg: document.createElement('em'), ok: document.createElement('em') };
    this.steps = this.el('div', 'tr-st', root);
    this.meta = this.el('div', 'tr-mt', root);
    this.msg = this.el('div', 'tr-msg', root);
    const bt = this.el('div', 'tr-bt', root), rs = this.el('button', '', bt) as HTMLButtonElement;
    rs.type = 'button'; rs.textContent = 'RESET'; rs.title = 'Both fighters back on their marks, at this trial’s opening distance';
    rs.addEventListener('click', () => { this.run.reset(); this.paint(); this.say(this.idleText()); this.h.reset(this.route.range, this.route); });
    const dots = this.el('div', 'tr-dots', root);
    this.routes.forEach((r, i) => { const d = this.el('i', '', dots); d.title = r.name; d.addEventListener('click', () => this.pick(i)); this.dots.push(d); });
    this.cf = new CallFx(parent, null);
    this.at = Math.max(0, this.routes.findIndex((r) => !this.done.has(r.name))); // (the first one not cleared yet)
    this.run = this.newRun();
    this.build();
  }

  private get route(): GuideRoute { return this.routes[this.at]; }

  // ---------------------------------------------------------------- what the arena tells it

  /** You pressed a skill (`air`: off the floor). */
  cast(id: string, castId: string, air: boolean, now: number): void { if (this.on) this.run.cast(id, castId, air, now); }
  /** Your hit landed on the partner (its cast, the combo it is in; a held skill: fully drawn or not). */
  hit(castId: string, comboId: number, full: boolean): void { if (this.on) this.run.hit(castId, comboId, full); }
  /** Every frame: the partner held in your combo, you off the floor. */
  update(now: number, held: boolean, air: boolean): void { if (this.on) this.run.update(now, held, air); }

  /** Both fighters on their marks for the trial in hand (the partner just came in). */
  place(): void { this.run.reset(); this.paint(); this.h.reset(this.route.range, this.route); }

  /** The keys of Key Settings (unbound: a dash). */
  setKeys(keys: GuideKeys): void {
    this.keys = keys;
    for (const k of this.keyEls) {
      const label = k.slot === -1 ? keys.jump : keys.slots[k.slot] ?? '';
      k.el.textContent = label || '—';
      k.el.classList.toggle('nk', !label);
      k.el.classList.toggle('lg', label.length > 2);
    }
  }

  show(on: boolean): void {
    if (on === this.on) return;
    this.on = on; this.root.classList.toggle('on', on);
    if (!on) this.run.reset();
  }

  destroy(): void { for (const t of this.timers) window.clearTimeout(t); this.timers = []; this.call?.remove(); this.cf.destroy(); this.root.remove(); }

  // ---------------------------------------------------------------- the trial in hand

  private newRun(): TrialRun {
    return new TrialRun(this.route, (id) => { const s = this.kit.find((x) => x.id === id); return !s || (!s.tags.includes('buff') && hitsOf(s).some((h) => h.damage > 0)); }, (n, i) => this.onNote(n, i)); // (a buff — Kagemusha's doubles — counts as soon as it is pressed, like a stance)
  }

  /** Another trial (wraps round): its keys, both fighters back on their marks. */
  private pick(i: number): void {
    const n = this.routes.length;
    this.at = ((i % n) + n) % n;
    for (const t of this.timers) window.clearTimeout(t); this.timers = [];
    this.dropCall();
    this.run = this.newRun();
    this.build();
    Sound.ui('swipe');
    this.h.reset(this.route.range, this.route);
  }

  private build(): void {
    const r = this.route;
    this.tt.n.textContent = `TRIAL ${this.at + 1} / ${this.routes.length}`;
    this.tt.rg.className = r.range; this.tt.rg.textContent = r.range;
    this.tt.ok.className = 'ok'; this.tt.ok.textContent = 'CLEARED';
    this.tt.n.append(this.tt.rg);
    if (this.done.has(r.name)) this.tt.n.append(this.tt.ok); else this.tt.ok.remove();
    this.tt.w.dataset.t = r.name; this.tt.w.innerHTML = ''; this.el('span', 'tr-f', this.tt.w).textContent = r.name;
    this.steps.innerHTML = ''; this.chips = []; this.keyEls = [];
    r.steps.forEach((st, n) => {
      const g = this.el('span', 'tr-g', this.steps);
      if (n) this.el('span', 'tr-a', g).textContent = '›';
      const c = this.chip(st); g.appendChild(c); this.chips.push(c);
    });
    this.meta.innerHTML = '';
    const hb = this.el('span', '', this.meta); this.el('b', '', hb).textContent = String(r.hits); hb.append(' HITS');
    this.el('span', '', this.meta).textContent = '·';
    this.el('span', '', this.meta).textContent = RANGE[r.range];
    if (r.style) { this.el('span', '', this.meta).textContent = '·'; this.el('b', '', this.meta).textContent = r.style; }
    if (r.tier) { this.el('span', '', this.meta).textContent = '·'; this.el('span', '', this.meta).textContent = r.tier; }
    this.setKeys(this.keys);
    this.counts();
    this.paint();
    this.say(this.idleText());
  }

  private chip(st: GuideStep): HTMLElement {
    const c = document.createElement('span'); c.className = 'tr-k';
    const key = document.createElement('b');
    if (!st.id) { // a jump
      c.classList.add('j');
      const u = document.createElement('u'); u.textContent = '↑';
      c.append(u, key); c.title = 'Jump';
      this.keyEls.push({ el: key, slot: -1 });
      return c;
    }
    const slot = this.slotOf.get(st.id) ?? -2, s = this.kit[slot];
    if (s) { const img = document.createElement('img'); img.src = iconUrl(s); img.alt = ''; img.draggable = false; c.appendChild(img); }
    c.appendChild(key);
    if (st.n && st.n > 1) { const x = document.createElement('i'); x.textContent = `×${st.n}`; c.appendChild(x); }
    if (st.hold) { const e = document.createElement('em'); e.textContent = 'HOLD'; c.appendChild(e); }
    c.title = `${s?.name ?? st.id}${st.n && st.n > 1 ? ` ×${st.n}` : ''}${st.hold ? ' — hold the key until it is fully drawn' : ''}`;
    this.keyEls.push({ el: key, slot });
    return c;
  }

  /** The chips as the run stands: landed (lit), the next to press (pulsing), the rest; a repeated step's presses. */
  private paint(): void {
    const run = this.run;
    this.chips.forEach((c, i) => {
      c.classList.toggle('ok', run.ok[i]);
      c.classList.toggle('now', !run.cleared && !run.ok[i] && i === run.next);
      const st = this.route.steps[i], x = c.querySelector('i');
      if (x && st.n && st.n > 1) x.textContent = i === run.next && run.presses > 0 ? `${run.presses}/${st.n}` : `×${st.n}`;
    });
  }

  private counts(): void {
    this.hd.innerHTML = '';
    const i = this.el('i', '', this.hd); i.textContent = '★';
    this.hd.append(`${this.done.size} / ${this.routes.length} CLEARED`);
    this.dots.forEach((d, k) => { d.classList.toggle('ok', this.done.has(this.routes[k].name)); d.classList.toggle('at', k === this.at); });
  }

  private idleText(): string { return this.route.tip ?? 'Each key right after the last hit of the one before'; }
  private say(text: string, kind: '' | 'bad' | 'good' = ''): void { this.msg.textContent = text; this.msg.className = `tr-msg${kind ? ' ' + kind : ''}`; }

  private onNote(n: TrialNote, i: number): void {
    if (n === 'step') {
      this.paint();
      const c = this.chips[i]; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
      if (!this.run.cleared) { Sound.ui('move'); this.say(`${this.run.ok.filter(Boolean).length} / ${this.route.steps.length}`); }
      return;
    }
    if (n === 'press') { this.paint(); return; }
    if (n === 'clear') { this.clear(); return; }
    this.paint(); // (the string broke: back to the first key)
    this.say(n === 'drop' ? 'DROPPED — the partner got free. Again!' : n === 'hold' ? 'HOLD IT — let it draw fully. Again!' : 'MISSED — keep to the order. Again!', 'bad');
    this.root.classList.remove('bad'); void this.root.offsetWidth; this.root.classList.add('bad');
    Sound.ui('back');
  }

  /** The last key landed: TRIAL CLEAR! across the screen, the trial counted, then the next one. */
  private clear(): void {
    const r = this.route, first = !this.done.has(r.name);
    this.done.add(r.name); markCleared(this.cls, r.name);
    this.paint(); this.counts(); this.tt.n.append(this.tt.ok);
    this.say('CLEAR!', 'good');
    Sound.sfx('perfect_shine'); Sound.ui('lock');
    this.dropCall();
    const call = this.call = this.el('div', 'gol-trc', this.parent);
    const all = first && this.done.size === this.routes.length; // (the last of the class's trials)
    const big = this.el('div', 'tr-big', call); big.dataset.t = all ? 'ALL CLEAR!' : 'TRIAL CLEAR!';
    this.el('span', 'tr-f', big).textContent = big.dataset.t;
    this.el('div', 'tr-sub', call).textContent = all ? `EVERY ${(CLASS_NAMES[this.cls] ?? this.cls).toUpperCase()} TRIAL` : r.name;
    this.timers.push(window.setTimeout(() => { this.cf.ring(call, 'gold', 8); this.cf.sparks(960, 440, 'gold', 80, 1.1); this.cf.embers(960, 470, 900, 220, 'gold', 36); }, 140));
    this.timers.push(window.setTimeout(() => { call.classList.add('out'); }, NEXT_MS - 380));
    this.timers.push(window.setTimeout(() => { // on to the next trial not cleared yet (or simply the next)
      const n = this.routes.length;
      let k = 1; while (k < n && this.done.has(this.routes[(this.at + k) % n].name)) k++;
      this.pick(k < n ? this.at + k : this.at + 1);
    }, NEXT_MS));
  }

  private dropCall(): void { this.call?.remove(); this.call = null; }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag); if (cls) e.className = cls; parent?.appendChild(e); return e;
  }
}
