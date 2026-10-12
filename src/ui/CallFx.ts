// The big calls' presence (the battle HUD's VS / ROUND / FIGHT! / K.O. / PERFECT / result, the arena's VS loading screen):
// a particle layer (sparks streaking out, embers rising, debris tumbling — additive light), shockwave rings, speed lines,
// a band of light behind ROUND, letterbox bars while the round is being called, the call shattering into shards as it goes,
// cracks running across the screen at a K.O. DOM + one 2D canvas (1920 x 1080 design px, scaled with its overlay).

export type Tone = 'fire' | 'gold' | 'blood' | 'steel' | 'ash';
const TONE: Record<Tone, { c: string[]; ring: string; glow: string }> = {
  fire: { c: ['#fffaf0', '#ffe08a', '#ffb13b', '#ff7a1f', '#ff4d12'], ring: '#ffd27a', glow: 'rgba(255,140,40,.85)' },
  gold: { c: ['#fffdf2', '#fff0b8', '#ffd76a', '#f2b445', '#d58d27'], ring: '#ffe7a6', glow: 'rgba(255,200,90,.8)' },
  blood: { c: ['#fff4f0', '#ffc2b2', '#ff6a4a', '#ff3018', '#c01d11'], ring: '#ff8f74', glow: 'rgba(255,50,24,.85)' },
  steel: { c: ['#ffffff', '#eaf4ff', '#b9d6f7', '#86b0e6', '#5d89c6'], ring: '#d6e8ff', glow: 'rgba(120,180,255,.8)' },
  ash: { c: ['#d9d4cc', '#b8b2aa', '#8f8a84', '#6d6964', '#4a4744'], ring: '#b8b2aa', glow: 'rgba(160,150,140,.5)' },
};
const W = 1920, H = 1080;

const CSS = `
.cf-cv{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none}
.cf-ring{position:absolute;left:50%;top:50%;width:160px;height:160px;margin:-80px 0 0 -80px;border-radius:50%;box-sizing:border-box;pointer-events:none}
.cf-lines{position:absolute;left:50%;top:50%;width:2000px;height:2000px;margin:-1000px 0 0 -1000px;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,rgba(255,255,255,0) 0deg 3.2deg,var(--l) 3.6deg 4.1deg,rgba(255,255,255,0) 4.5deg 7.5deg);
  -webkit-mask:radial-gradient(circle,transparent 0 15%,#000 26%,#000 34%,transparent 52%);mask:radial-gradient(circle,transparent 0 15%,#000 26%,#000 34%,transparent 52%)}
.cf-band{position:absolute;left:0;right:0;top:50%;height:230px;margin-top:-115px;pointer-events:none;transform-origin:50% 50%;z-index:-1;
  background:linear-gradient(90deg,rgba(0,0,0,0) 0%,var(--b1) 22%,var(--b2) 50%,var(--b1) 78%,rgba(0,0,0,0) 100%);
  -webkit-mask:linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent);mask:linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)}
.cf-band::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(100deg,rgba(255,255,255,0) 0 60px,rgba(255,255,255,.16) 64px 70px,rgba(255,255,255,0) 74px 140px);animation:cfStripe .9s linear infinite}
.cf-band::after{content:'';position:absolute;left:0;right:0;top:50%;height:3px;margin-top:-1.5px;background:linear-gradient(90deg,rgba(255,255,255,0),#fff 30%,#fff 70%,rgba(255,255,255,0));box-shadow:0 0 18px 4px var(--b2)}
@keyframes cfStripe{to{background-position:140px 0}}
.cf-lb{position:absolute;left:0;right:0;height:0;background:#000;pointer-events:none;z-index:6;transition:height .38s cubic-bezier(.2,.8,.3,1)}
.cf-lb.t{top:0}
.cf-lb.b{bottom:0}
.cf-lb.on{height:86px}
.cf-flash{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none}
.cf-shard{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;will-change:transform,opacity;filter:none!important}
.cf-shard::before,.cf-shard::after{display:none!important}
.cf-crack{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;overflow:visible}
.cf-crack path{fill:none;stroke-linecap:round;stroke-linejoin:round}
@media (prefers-reduced-motion:reduce){.cf-cv,.cf-lines,.cf-ring,.cf-crack{display:none}}`;

interface P { x: number; y: number; vx: number; vy: number; age: number; life: number; c: string; s: number; k: 0 | 1 | 2; g: number; drag: number; rot: number; vr: number }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export class CallFx {
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D | null;
  private ps: P[] = [];
  private raf = 0;
  private last = 0;
  private dot = new Map<string, HTMLCanvasElement>();
  private lb: HTMLDivElement[] = [];
  private emits: { until: number; every: number; next: number; fn: () => void }[] = [];

  /** `root`: the overlay (1920 x 1080 design px); the canvas goes in just before `before` (under the calls' lettering). */
  constructor(private root: HTMLElement, before: HTMLElement | null) {
    if (!document.getElementById('gol-cf-style')) { const st = document.createElement('style'); st.id = 'gol-cf-style'; st.textContent = CSS; document.head.appendChild(st); }
    this.cv = document.createElement('canvas'); this.cv.className = 'cf-cv'; this.cv.width = W; this.cv.height = H;
    root.insertBefore(this.cv, before);
    this.g = this.cv.getContext('2d');
  }

  // ------------------------------------------------------------------ particles

  /** Sparks streaking out from (x, y): `n` of them, `speed` x their usual speed, `spread` (rad) round `dir` (rad; omitted: all round). */
  sparks(x: number, y: number, tone: Tone, n = 60, speed = 1, dir?: number, spread = Math.PI * 2): void {
    const t = TONE[tone];
    for (let i = 0; i < n; i++) {
      const a = dir === undefined ? Math.random() * Math.PI * 2 : dir + (Math.random() - 0.5) * spread, v = rnd(520, 1500) * speed;
      this.add({ x: x + rnd(-14, 14), y: y + rnd(-10, 10), vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rnd(0.32, 0.8), c: pick(t.c), s: rnd(2, 4.2), k: 0, g: 900, drag: 2.6, rot: 0, vr: 0 });
    }
    this.run();
  }

  /** Embers drifting up over a box (cx, cy, w, h). */
  embers(cx: number, cy: number, w: number, h: number, tone: Tone, n = 30, up = 1): void {
    const t = TONE[tone];
    for (let i = 0; i < n; i++) this.add({ x: cx + rnd(-w / 2, w / 2), y: cy + rnd(-h / 2, h / 2), vx: rnd(-50, 50), vy: -rnd(60, 190) * up, age: 0, life: rnd(1.1, 2.4), c: pick(t.c), s: rnd(2.2, 5.5), k: 1, g: -30 * up, drag: 0.5, rot: 0, vr: 0 });
    this.run();
  }

  /** Chunks of debris thrown out and tumbling down. */
  debris(x: number, y: number, tone: Tone, n = 24, speed = 1): void {
    const t = TONE[tone];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(380, 980) * speed;
      this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 260, age: 0, life: rnd(0.8, 1.4), c: pick(t.c), s: rnd(7, 16), k: 2, g: 1700, drag: 1.1, rot: rnd(0, 6.3), vr: rnd(-14, 14) });
    }
    this.run();
  }

  /** Keeps calling `fn` every `every` ms for `ms` (a steady rain of embers, glitter…). */
  emit(fn: () => void, every: number, ms: number): void {
    const now = performance.now();
    this.emits.push({ until: now + ms, every, next: now, fn });
    this.run();
  }

  private add(p: P): void { if (this.ps.length < 900) this.ps.push(p); }

  private run(): void {
    if (this.raf || !this.g) return;
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      for (const e of this.emits) while (e.next <= now && e.next <= e.until) { e.fn(); e.next += e.every; }
      this.emits = this.emits.filter((e) => e.next <= e.until);
      this.step(dt);
      if (this.ps.length || this.emits.length) this.raf = requestAnimationFrame(tick);
      else { this.raf = 0; this.g!.clearRect(0, 0, W, H); }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private glowDot(c: string): HTMLCanvasElement {
    let d = this.dot.get(c);
    if (d) return d;
    d = document.createElement('canvas'); d.width = d.height = 64;
    const x = d.getContext('2d')!, gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, c); gr.addColorStop(0.5, c + '55'); gr.addColorStop(1, c + '00');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.dot.set(c, d); return d;
  }

  private step(dt: number): void {
    const g = this.g!;
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const keep: P[] = [];
    for (const p of this.ps) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const f = Math.exp(-p.drag * dt);
      p.vx *= f; p.vy = p.vy * f + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const k = 1 - p.age / p.life;
      if (p.k === 0) { // a streak along its flight
        const L = 0.028 + 0.02 * k;
        g.strokeStyle = p.c; g.globalAlpha = Math.min(1, k * 1.6); g.lineWidth = p.s * (0.5 + 0.5 * k); g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * L, p.y - p.vy * L); g.stroke();
      } else if (p.k === 1) { // a glowing ember (flickering)
        const s = p.s * 5 * (0.7 + 0.3 * Math.sin(p.age * 19 + p.x));
        g.globalAlpha = Math.min(1, k * 1.4, p.age * 4); g.drawImage(this.glowDot(p.c), p.x - s / 2, p.y - s / 2, s, s);
      } else { // a tumbling chip (not additive: solid)
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, k * 2);
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c;
        g.beginPath(); g.moveTo(-p.s * 0.6, -p.s * 0.3); g.lineTo(p.s * 0.5, -p.s * 0.45); g.lineTo(p.s * 0.2, p.s * 0.5); g.closePath(); g.fill();
        g.restore(); g.globalCompositeOperation = 'lighter';
      }
      keep.push(p);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    this.ps = keep;
  }

  // ------------------------------------------------------------------ DOM pieces

  /** A shockwave ring racing out from the middle of `parent`. */
  ring(parent: HTMLElement, tone: Tone, scale = 9, ms = 620, delay = 0): void {
    const r = this.el('div', 'cf-ring', parent), t = TONE[tone];
    r.style.border = `14px solid ${t.ring}`; r.style.boxShadow = `0 0 40px 10px ${t.glow}, inset 0 0 30px 6px ${t.glow}`;
    const a = r.animate([{ transform: 'scale(.15)', opacity: 1, borderWidth: '22px' }, { transform: `scale(${scale})`, opacity: 0, borderWidth: '2px' }],
      { duration: ms, delay, easing: 'cubic-bezier(.12,.75,.35,1)', fill: 'both' });
    a.onfinish = () => r.remove();
  }

  /** Speed lines bursting out round the middle of `parent`. */
  lines(parent: HTMLElement, tone: Tone, ms = 700): void {
    const l = this.el('div', 'cf-lines', parent);
    l.style.setProperty('--l', tone === 'steel' ? 'rgba(220,236,255,.3)' : tone === 'blood' ? 'rgba(255,190,170,.3)' : 'rgba(255,236,190,.32)');
    const a = l.animate([{ transform: 'scale(.55) rotate(0deg)', opacity: 0 }, { transform: 'scale(.9) rotate(4deg)', opacity: 1, offset: 0.18 }, { transform: 'scale(1.45) rotate(9deg)', opacity: 0 }],
      { duration: ms, easing: 'ease-out', fill: 'both' });
    a.onfinish = () => l.remove();
  }

  /** A band of light right across the screen behind the call (ROUND n). */
  band(parent: HTMLElement, tone: Tone): HTMLElement {
    const b = this.el('div', 'cf-band', parent);
    const [b1, b2] = tone === 'steel' ? ['rgba(90,140,220,.42)', 'rgba(200,226,255,.62)'] : tone === 'blood' ? ['rgba(200,30,20,.42)', 'rgba(255,150,120,.6)'] : ['rgba(214,140,40,.4)', 'rgba(255,226,150,.62)'];
    b.style.setProperty('--b1', b1); b.style.setProperty('--b2', b2);
    b.animate([{ transform: 'scaleY(0)', opacity: 0 }, { transform: 'scaleY(1.25)', opacity: 1, offset: 0.55 }, { transform: 'scaleY(1)', opacity: 1 }], { duration: 300, easing: 'ease-out', fill: 'both' });
    return b;
  }

  /** Letterbox bars while a round is being called (in), gone when the fight starts (out). */
  letterbox(on: boolean): void {
    if (!this.lb.length) for (const s of ['t', 'b']) this.lb.push(this.el('div', `cf-lb ${s}`, this.root));
    void this.lb[0].offsetHeight; // (so a fresh bar slides in)
    for (const b of this.lb) b.classList.toggle('on', on);
  }

  /** A full-screen flash of colour. */
  flash(parent: HTMLElement, color: string, peak = 0.85, ms = 520, under?: Element | null): void {
    const f = this.el('div', 'cf-flash', parent);
    if (under) parent.insertBefore(f, under); // (under the call: the lettering stays crisp on the light)
    f.style.background = color;
    const a = f.animate([{ opacity: peak }, { opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'both' });
    a.onfinish = () => f.remove();
  }

  /** `el` breaks into shards that fly apart and fade (it is hidden; the shards are copies cut out of it). */
  shatter(el: HTMLElement, ms = 420): void {
    const host = el.parentElement;
    if (!host) return;
    const box = document.createElement('div');
    box.style.cssText = 'position:relative;flex:none;pointer-events:none';
    host.insertBefore(box, el); box.appendChild(el);
    const N = 7, pts: [number, number][] = [];
    for (let i = 0; i < N; i++) { // points round the edge of the box, clockwise (percent)
      const a = (i / N) * Math.PI * 2 + rnd(-0.18, 0.18), c = Math.cos(a), s = Math.sin(a), k = 0.5 / Math.max(Math.abs(c), Math.abs(s));
      pts.push([50 + c * k * 100, 50 + s * k * 100]);
    }
    const cx = rnd(44, 56), cy = rnd(42, 58);
    for (let i = 0; i < N; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % N], mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const mid: [number, number] = [cx + (mx - cx) * rnd(0.35, 0.6), cy + (my - cy) * rnd(0.35, 0.6)];
      for (const poly of [[[cx, cy], [x0, y0], mid], [mid, [x0, y0], [x1, y1]], [[cx, cy], mid, [x1, y1]]] as [number, number][][]) {
        const sh = el.cloneNode(true) as HTMLElement;
        sh.classList.add('cf-shard'); sh.style.position = 'absolute'; sh.style.left = '0'; sh.style.top = '0'; sh.style.animation = 'none';
        sh.style.clipPath = `polygon(${poly.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(',')})`;
        box.appendChild(sh);
        const gx = poly.reduce((s, p) => s + p[0], 0) / 3 - 50, gy = poly.reduce((s, p) => s + p[1], 0) / 3 - 50, d = Math.hypot(gx, gy) || 1;
        const far = rnd(260, 520), dx = (gx / d) * far + rnd(-40, 40), dy = (gy / d) * far * 0.8 + rnd(40, 140), rot = rnd(-70, 70);
        sh.animate([{ transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${rnd(0.75, 1.05)})`, opacity: 0 }],
          { duration: ms * rnd(0.8, 1.15), easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' });
      }
    }
    el.style.visibility = 'hidden';
  }

  /** The screen itself cracks round (x, y): straight radial cracks with a spider web between them and small chips
   *  off their sides, drawn in a flash, holding a moment, then fading. */
  cracks(parent: HTMLElement, x: number, y: number, tone: Tone): void {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'cf-crack'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const line = (pts: [number, number][], w: number) => {
      const d = 'M' + pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' L');
      for (const [c, ww] of [['rgba(10,4,2,.5)', w + 2.5], [w > 2.5 ? '#ffffff' : TONE[tone].c[0], w]] as [string, number][]) {
        const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); p.setAttribute('stroke', c); p.setAttribute('stroke-width', String(ww)); svg.appendChild(p);
      }
    };
    const K = 10 + Math.floor(Math.random() * 3), rays: [number, number][][] = [];
    for (let i = 0; i < K; i++) { // the main cracks: nearly straight, a kink or two, each its own length
      const a0 = (i / K) * Math.PI * 2 + rnd(-0.2, 0.2), L = rnd(300, 600), pts: [number, number][] = [[x, y]];
      let a = a0, r = 0;
      while (r < L) { r += rnd(40, 110); a = a0 + rnd(-0.07, 0.07); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.92]); }
      rays.push(pts); line(pts, 3.4);
      for (let k = 2; k < pts.length - 1; k++) if (Math.random() < 0.45) { // chips off the side
        const [px, py] = pts[k], b = a0 + (Math.random() < 0.5 ? 1 : -1) * rnd(0.5, 1.1), l = rnd(18, 60);
        line([[px, py], [px + Math.cos(b) * l * 0.5 + rnd(-4, 4), py + Math.sin(b) * l * 0.5 + rnd(-4, 4)], [px + Math.cos(b) * l, py + Math.sin(b) * l]], 1.4);
      }
    }
    for (const R of [rnd(70, 100), rnd(160, 210), rnd(270, 330)]) // the web: rings of short straight links between neighbouring cracks
      for (let i = 0; i < K; i++) {
        if (Math.random() < 0.22) continue;
        const at = (pts: [number, number][]) => { let best = pts[0], bd = 1e9; for (const p of pts) { const d = Math.abs(Math.hypot(p[0] - x, p[1] - y) - R); if (d < bd) { bd = d; best = p; } } return best; };
        const p0 = at(rays[i]), p1 = at(rays[(i + 1) % K]), m: [number, number] = [(p0[0] + p1[0]) / 2 + rnd(-8, 8), (p0[1] + p1[1]) / 2 + rnd(-8, 8)];
        if (Math.hypot(p0[0] - x, p0[1] - y) > R * 1.4 || Math.hypot(p1[0] - x, p1[1] - y) > R * 1.4) continue; // (a ray that ended short)
        line([p0, m, p1], 1.8);
      }
    parent.appendChild(svg); // (one reveal for the whole web — racing out from the impact — then it holds and fades)
    const cx = (x / W) * 100, cy = (y / H) * 100;
    svg.animate([{ clipPath: `circle(0% at ${cx}% ${cy}%)` }, { clipPath: `circle(75% at ${cx}% ${cy}%)` }], { duration: 170, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
    svg.animate([{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { duration: 1150, easing: 'ease-in', fill: 'both' }).onfinish = () => svg.remove();
  }

  clear(): void { this.ps = []; this.emits = []; this.g?.clearRect(0, 0, W, H); }

  destroy(): void { cancelAnimationFrame(this.raf); this.raf = 0; this.clear(); this.cv.remove(); for (const b of this.lb) b.remove(); this.lb = []; }

  private el(tag: string, cls: string, parent: HTMLElement): HTMLDivElement {
    const e = document.createElement(tag) as HTMLDivElement; e.className = cls; parent.appendChild(e); return e;
  }
}
