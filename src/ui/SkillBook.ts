// Skill Book (K): the class's skills by job advancement (tabs) — SKILLS / PASSIVE pages, a still showcase and the
// detail card. No video or replay of a skill: the player discovers what it does by using it.
import { keyLabel, loadBindings, slotKeyLabels } from '../game/KeyBindings';
import type Phaser from 'phaser';
import { CLASS_NAMES, HUD } from '../config/layout';
import { syncOverlay } from './CharacterSelectUI';
import { ICONS, ensureTheme } from './theme';
import type { ClassKey } from '../game/Body';
import { FinalSkill, Role, Targeting } from '../skills/SkillTypes';
import { iconUrl, kitFor } from '../skills/FinalKit';
import { ADV_LABEL, Job, jobsFor } from '../skills/Jobs';
import { PassiveSkill, passiveIconUrl, passivesFor } from '../skills/Passives';

/** A card in the book: an active skill (key) or a passive / movement skill (always on). */
type Entry = FinalSkill | PassiveSkill;
const isPassive = (e: Entry): e is PassiveSkill => 'kind' in e;
const entryIcon = (e: Entry) => (isPassive(e) ? passiveIconUrl(e) : iconUrl(e));

const K = (f: string) => `assets/final/ui/kit/${f}.png`;
/** The window (centred); the cards per page. */
const WIN = { x: 250, y: 150, w: 1420 };
const PER_PAGE = 4;
const HOTKEY = new Proxy([] as string[], { get: (_t, p) => (typeof p === 'string' && /^\d+$/.test(p) ? slotKeyLabels()[+p] : undefined) }); // live: Key Settings
/** The key a skill's own text names (its default key) → the key it is bound to now (Key Settings). */
const keyed = (text: string, slot: number): string => {
  const def = HUD.skills.hotkeys[slot], now = HOTKEY[slot];
  return def && now && def.toUpperCase() !== now ? text.replace(new RegExp(`\\b(hold|press of|press)\\s+${def}\\b`, 'gi'), (_m, w: string) => `${w} ${now}`) : text;
};

const ROLE_LABEL: Partial<Record<Role, string>> = {
  basic: 'Basic', opener: 'Opener', gapClose: 'Gap Close', launcher: 'Launcher', extender: 'Extender', airExtender: 'Air Extender',
  knockdown: 'Knockdown', antiAir: 'Anti-Air', confirm: 'Confirm', peel: 'Peel', setup: 'Setup', hardCC: 'Hard CC', zone: 'Zone',
  pull: 'Pull', projectile: 'Projectile', precision: 'Precision', trap: 'Trap', mobility: 'Mobility', chase: 'Chase', counter: 'Counter',
  escape: 'Escape', finisher: 'Finisher', signature: 'Signature', ultimate: 'Ultimate',
};
/** Where a skill reaches (short: one line in the facts row). */
const TARGETING: Record<Targeting, string> = {
  aimAssist: 'Straight ahead', mouseDir: 'Dash ahead', mouseProjectile: 'Projectile ahead', mouseLine: 'Line ahead', mouseCone: 'Cone ahead',
  mouseGround: 'Ground ahead', mouseTarget: 'First foe ahead', self: 'Around you', selfAim: 'Around you, forward',
};

const STYLE_ID = 'gol-skillbook-style';
const CSS = `
.gol-sb{z-index:40;display:none}
.gol-sb.open{display:block}
.gol-sb .win{left:${WIN.x}px;top:${WIN.y}px;width:${WIN.w}px;display:flex;flex-direction:column}
.gol-sb .gl-head .all{height:36px;padding:0 14px;font-size:13px;gap:8px}
.gol-sb .gl-head .all i{width:16px;height:16px;border-radius:5px;border:1.5px solid var(--gl-text3);box-sizing:border-box;display:grid;place-items:center}
.gol-sb .gl-head .all.on{border-color:rgba(231,196,124,.6);color:var(--gl-gold2)}
.gol-sb .gl-head .all.on i{border-color:var(--gl-gold);background:var(--gl-gold)}
.gol-sb .gl-head .all.on i::before{content:'';width:11px;height:11px;background:#24180a;-webkit-mask:${ICONS.check} center/contain no-repeat;mask:${ICONS.check} center/contain no-repeat}
/* the job advancements */
.gol-sb .jobs{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:20px 28px 0}
.gol-sb .job{position:relative;display:flex;align-items:center;gap:12px;height:66px;padding:0 14px 0 12px;border-radius:14px;cursor:pointer;
  background:rgba(255,255,255,.025);border:1px solid var(--gl-line);transition:background 120ms,border-color 120ms}
.gol-sb .job:hover{background:rgba(255,255,255,.05)}
.gol-sb .job.on{background:#1d2a41;border-color:rgba(231,196,124,.6);box-shadow:0 0 0 3px rgba(231,196,124,.1)}
.gol-sb .job .em{flex:none;width:40px;height:40px;background:center/contain no-repeat}
.gol-sb .job .tx{flex:1;min-width:0}
.gol-sb .job b{display:block;font:700 14.5px/1.25 var(--gl-body);color:var(--gl-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-sb .job span{display:block;font:500 12px/1.4 var(--gl-body);color:var(--gl-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-sb .job.on b{color:var(--gl-gold2)}
.gol-sb .job .gl-badge{flex:none;min-width:0}
.gol-sb .job.lk .em{filter:grayscale(.85) brightness(.55)}
.gol-sb .job.lk b{color:var(--gl-text2)}
.gol-sb .job.lk .em::after{content:'';position:absolute;left:24px;top:36px;width:16px;height:16px;border-radius:50%;background:#0f1828;box-shadow:0 0 0 2px #0f1828}
.gol-sb .job.lk .em::before{content:'';position:absolute;left:27px;top:39px;width:10px;height:10px;z-index:1;background:var(--gl-text2);-webkit-mask:${ICONS.lock} center/contain no-repeat;mask:${ICONS.lock} center/contain no-repeat}
/* pages and the cards */
.gol-sb .mid{display:flex;flex-direction:column;align-items:flex-start;gap:16px;padding:22px 28px 0}
.gol-sb .mid .gl-seg b{margin-left:8px;min-width:22px;height:20px;padding:0 6px;border-radius:999px;background:rgba(255,255,255,.07);font:700 11.5px/20px var(--gl-body);color:var(--gl-text2);display:inline-block;text-align:center}
.gol-sb .mid .gl-seg button.on b{background:var(--gl-goldsoft);color:var(--gl-gold2)}
.gol-sb .mid .gl-seg button.off{opacity:.35;pointer-events:none}
.gol-sb .row{display:flex;gap:14px;min-height:172px}
.gol-sb .card{position:relative;flex:none;width:156px;height:172px;border-radius:14px;cursor:pointer;background:var(--gl-inset);border:1px solid rgba(255,255,255,.07);
  box-shadow:inset 0 2px 6px rgba(0,0,0,.3);transition:border-color 120ms,box-shadow 120ms,transform 120ms}
.gol-sb .card:hover{border-color:rgba(231,196,124,.45);transform:translateY(-2px)}
.gol-sb .card.sel{border-color:var(--gl-gold);box-shadow:0 0 0 3px rgba(231,196,124,.16),inset 0 2px 6px rgba(0,0,0,.3)}
.gol-sb .card img{position:absolute;left:32px;top:18px;width:92px;height:92px;border-radius:12px;pointer-events:none}
.gol-sb .card .hk{position:absolute;right:8px;top:8px;z-index:1}
.gol-sb .card .pt{position:absolute;right:8px;top:8px;z-index:1}
.gol-sb .card .nm{position:absolute;left:10px;right:10px;top:116px;height:46px;display:flex;align-items:center;justify-content:center;text-align:center;
  font:600 13.5px/1.3 var(--gl-body);color:var(--gl-text)}
.gol-sb .card.lk img{filter:grayscale(1) brightness(.42)}
.gol-sb .card.lk .nm{color:var(--gl-text2)}
.gol-sb .card.lk::after{content:'';position:absolute;left:66px;top:52px;width:24px;height:24px;background:rgba(236,232,222,.85);
  -webkit-mask:${ICONS.lock} center/contain no-repeat;mask:${ICONS.lock} center/contain no-repeat}
.gol-sb .card.wip img{filter:grayscale(.35) brightness(.7)}
.gol-sb .card.wip .nm{color:var(--gl-text2)}
.gol-sb .card.none{cursor:default;background:transparent;border:1px dashed rgba(255,255,255,.1);box-shadow:none;transform:none}
/* the chosen skill */
.gol-sb .det{display:grid;grid-template-columns:1.25fr 1fr;gap:18px;padding:22px 28px 28px}
.gol-sb .hero{position:relative;padding:22px 26px;display:flex;gap:24px;align-items:center;min-height:224px}
.gol-sb .hero > img{flex:none;width:112px;height:112px;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,.45)}
.gol-sb .hero .kind{position:absolute;left:26px;top:20px}
.gol-sb .hero .tx{flex:1;min-width:0;padding-top:18px}
.gol-sb .hero .nm{font:700 24px/1.25 var(--gl-title);letter-spacing:1px;color:#f3e3bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-sb .roles{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.gol-sb .rule{height:1px;margin:16px 0 14px;background:var(--gl-line)}
.gol-sb .facts{display:grid;grid-template-columns:repeat(4,auto);justify-content:start;column-gap:28px}
.gol-sb .facts .gl-cap{font-size:10.5px;display:block}
.gol-sb .facts b{display:flex;align-items:center;height:28px;margin-top:6px;font:600 15px var(--gl-body);color:var(--gl-text);white-space:nowrap}
.gol-sb .facts .gl-key{height:26px;min-width:30px;font-size:12.5px;line-height:23px}
.gol-sb .effects ul{margin:8px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:6px 22px}
.gol-sb .effects li{display:flex;align-items:center;gap:9px;font:500 14.5px/1.4 var(--gl-body);color:var(--gl-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-sb .effects li::before{content:'';flex:none;width:6px;height:6px;border-radius:50%;background:var(--gl-gold)}
.gol-sb .desc{padding:22px 26px;display:flex;flex-direction:column;gap:14px;min-height:224px}
.gol-sb .desc .top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.gol-sb .desc .ds{font:400 15.5px/1.6 var(--gl-body);color:#e4e1d9}
.gol-sb .desc .ds.long{font-size:14.5px;line-height:1.55}
.gol-sb .desc .rel{display:flex;flex-direction:column;gap:6px;font:500 14px/1.45 var(--gl-body);color:#e9d6a7}
.gol-sb .desc .rel div{display:flex;gap:9px}
.gol-sb .desc .rel div::before{content:'\\2192';color:var(--gl-gold3)}
`;

function ensureStyles(): void {
  ensureTheme();
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
}

/** "2ND JOB · KNIGHT" — the Beginner job is its own advancement: just "BEGINNER". */
const rank = (job: Job, adv: number) => (ADV_LABEL[adv] === job.name ? job.name : `${ADV_LABEL[adv]} · ${job.name}`).toUpperCase();
const kindOf = (s: FinalSkill) => (s.slot === 7 ? 'ULTIMATE' : s.slot === 6 ? 'SIGNATURE' : s.slot === 0 ? 'BASIC ATTACK' : 'SKILL');

// ----------------------------------------------------------------------------------------------- book

export class SkillBook {
  open = false;
  private root: HTMLDivElement;
  private win: HTMLDivElement;
  private tabs: HTMLDivElement[] = [];
  private row: HTMLDivElement;
  private cards: { el: HTMLDivElement; e: Entry }[] = [];
  private page = 0;
  private pager: HTMLButtonElement[] = [];
  private hero: HTMLDivElement;
  private desc: HTMLDivElement;
  private lastRect = '';
  private kit: FinalSkill[];
  private jobs: Job[];
  private job = 0;
  private selected!: Entry;
  private hover: Entry | null = null;

  private sub!: HTMLDivElement;
  private closeBtn!: HTMLButtonElement;
  private allBtn?: HTMLButtonElement;

  constructor(_scene: Phaser.Scene, private host: HTMLElement, private canvas: HTMLCanvasElement, private cls: ClassKey, private level: number, private qaUnlockAll: boolean, private onAllOpen?: (on: boolean) => void) {
    ensureStyles();
    this.kit = kitFor(cls);
    this.jobs = jobsFor(cls);
    this.root = document.createElement('div');
    this.root.className = 'gol-cs gol-sb';
    host.appendChild(this.root);
    this.win = this.div('win gl-win pop', this.root);
    const hd = this.div('gl-head', this.win);
    this.div('gl-title', hd).textContent = `SKILL BOOK — ${(CLASS_NAMES[cls] ?? cls).toUpperCase()}`;
    this.sub = this.div('gl-sub', hd);
    this.div('gl-sp', hd);
    if (onAllOpen) { // test switch: every skill usable at any level
      const b = document.createElement('button'); b.type = 'button'; b.className = 'gl-btn all';
      b.addEventListener('click', () => onAllOpen(!this.qaUnlockAll));
      hd.appendChild(b); this.allBtn = b;
    }
    const x = document.createElement('button'); x.type = 'button'; x.className = 'gl-x'; x.setAttribute('aria-label', 'Close'); this.closeBtn = x;
    x.addEventListener('click', () => this.close()); hd.appendChild(x);
    this.setSubtitle();
    const jobs = this.div('jobs', this.win);
    this.jobs.forEach((j, k) => {
      const t = this.div('job', jobs);
      t.innerHTML = '<div class="em"></div><div class="tx"><b></b><span></span></div><div class="gl-badge"></div>';
      t.querySelector('b')!.textContent = j.name;
      t.querySelector('span')!.textContent = ADV_LABEL[k] === j.name ? `Lv ${j.level}–${j.to}` : `${ADV_LABEL[k]} · Lv ${j.level}–${j.to}`;
      t.querySelector('.gl-badge')!.textContent = `Lv ${j.level}`;
      t.title = `${j.name} — from level ${j.level}`;
      t.addEventListener('click', () => { this.job = k; this.page = 0; this.selected = this.entries()[0]; this.buildRow(); this.refresh(); });
      this.tabs.push(t);
    });
    const mid = this.div('mid', this.win);
    const seg = this.div('gl-seg', mid);
    for (const [k, label] of [[0, 'Skills'], [1, 'Passive'], [2, 'More']] as const) {
      const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `${label}<b></b>`;
      b.addEventListener('click', () => { this.page = k; this.buildRow(); this.selected = this.cards[0]?.e ?? this.selected; this.refresh(); });
      seg.appendChild(b); this.pager.push(b);
    }
    this.row = this.div('row', mid);
    const det = this.div('det', this.win);
    this.hero = this.div('hero gl-sec', det);
    this.desc = this.div('desc gl-sec', det);
    const cur = this.jobs.filter((j) => level >= j.level).pop() ?? this.jobs[0];
    this.job = Math.max(0, this.jobs.indexOf(cur));
    this.selected = this.entries()[0];
    this.buildRow();
    this.refresh();
  }

  private setSubtitle(): void {
    const cur = this.jobs.filter((j) => this.level >= j.level).pop() ?? this.jobs[0];
    this.sub.textContent = this.qaUnlockAll ? `Level ${this.level} · ${cur.name} — every skill open (test)` : `Level ${this.level} · ${cur.name} — new skills open with each job advancement`;
    if (this.allBtn) { this.allBtn.classList.toggle('on', this.qaUnlockAll); this.allBtn.innerHTML = '<i></i>All skills open'; this.allBtn.title = this.qaUnlockAll ? 'Back to level-based unlocks' : 'Open every skill for testing'; }
  }

  /** The "all skills open" switch changed: relock / unlock tabs, cards and details. */
  setUnlockAll(on: boolean): void { this.qaUnlockAll = on; this.setSubtitle(); this.refresh(); }
  /** Level up: jobs / skills / passives that open now. */
  setLevel(level: number): void { this.level = level; this.setSubtitle(); this.refresh(); }

  private div(cls: string, parent: HTMLElement): HTMLDivElement { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }

  private jobOpen(k: number): boolean { return this.qaUnlockAll || this.level >= this.jobs[k].level; }
  private jobIndexOf(s: Entry): number { return isPassive(s) ? s.job : Math.max(0, this.jobs.findIndex((j) => j.slots.includes(s.slot))); }
  unlocked(s: Entry): boolean { return this.jobOpen(this.jobIndexOf(s)); }

  /** Pages of the current job tab: its active skills, then its passive / movement skills, then any further skills. */
  private pages(): Entry[][] {
    const act = this.jobs[this.job].slots.map((slot) => this.kit.find((s) => s.slot === slot)).filter((s): s is FinalSkill => !!s);
    const pas = passivesFor(this.cls, this.job);
    return [act.slice(0, PER_PAGE), pas.slice(0, PER_PAGE), act.slice(PER_PAGE, PER_PAGE * 2)]; // 0 = skills, 1 = passive / movement, 2 = more skills
  }
  private entries(): Entry[] { return this.pages().flat(); }

  private buildRow(): void {
    this.row.innerHTML = ''; this.cards = [];
    const pages = this.pages();
    this.page = Math.max(0, Math.min(this.page, pages.length - 1));
    const list = pages[this.page];
    list.forEach((e) => {
      const c = this.div('card', this.row);
      const img = document.createElement('img'); img.src = entryIcon(e); img.alt = ''; img.draggable = false; c.appendChild(img);
      if (isPassive(e)) { const t = this.div('pt gl-chip', c); t.textContent = e.kind === 'movement' ? 'Move' : 'Passive'; t.title = e.kind === 'movement' ? 'Movement skill' : 'Passive skill'; }
      else { const k = HOTKEY[e.slot]; if (k) this.div('hk gl-key', c).textContent = k; }
      this.div('nm', c).textContent = e.name;
      c.addEventListener('mouseenter', () => { this.hover = e; this.refresh(); });
      c.addEventListener('mouseleave', () => { if (this.hover === e) { this.hover = null; this.refresh(); } });
      c.addEventListener('click', () => { this.selected = e; this.refresh(); });
      this.cards.push({ el: c, e });
    });
    for (let n = list.length; n < PER_PAGE; n++) this.div('card none', this.row); // room for the skills still to come
    this.pager.forEach((b, k) => { b.classList.toggle('on', this.page === k); b.classList.toggle('off', !pages[k].length); b.style.display = k === 2 && !pages[k].length ? 'none' : ''; (b.lastChild as HTMLElement).textContent = String(pages[k].length); });
  }

  /** Kept for callers: the book has no character preview (players discover a skill by using it). */
  setEquipped(_e: unknown): void { /* no preview */ }

  private refresh(): void {
    const show = this.hover ?? this.selected;
    this.tabs.forEach((t, k) => { t.classList.toggle('lk', !this.jobOpen(k)); t.classList.toggle('on', k === this.job); (t.firstChild as HTMLElement).style.backgroundImage = `url("${K(`job${k}_icon`)}")`; });
    for (const c of this.cards) { c.el.classList.toggle('sel', c.e === this.selected); c.el.classList.toggle('lk', !this.unlocked(c.e)); c.el.classList.toggle('wip', !!c.e.wip && this.unlocked(c.e)); } // a template: its icon, dimmed (no lock)
    if (isPassive(show)) { this.refreshPassive(show); return; }
    const s = show, jk = this.jobIndexOf(s), job = this.jobs[jk];
    const key = HOTKEY[s.slot] ?? '';
    const tx = this.heroFor(iconUrl(s), s.name, s.roles.map((r) => ROLE_LABEL[r] ?? r), `${rank(job, jk)} · ${kindOf(s)}`);
    const facts = this.div('facts', tx);
    const fact = (label: string): HTMLElement => { const d = this.div('', facts); const c = document.createElement('span'); c.className = 'gl-cap'; c.textContent = label; d.appendChild(c); const b = document.createElement('b'); d.appendChild(b); return b; };
    const k = fact('Key');
    if (key) { const kc = document.createElement('span'); kc.className = 'gl-key'; kc.textContent = key; k.appendChild(kc); } else k.textContent = 'None';
    fact('Cooldown').textContent = s.cooldown > 0 ? `${(s.cooldown / 1000).toFixed(s.cooldown % 1000 ? 1 : 0)} s` : 'None (chain)';
    fact('Use').textContent = s.ground && s.air ? 'Ground and air' : s.air ? 'Air only' : 'Ground only';
    fact('Reach').textContent = TARGETING[s.targeting];
    this.details(keyed(s.description, s.slot), s.relations.slice(0, 2).map((r) => keyed(r, s.slot)), jk, !!s.wip);
  }

  /** Passive / movement card: what it gives (always on). */
  private refreshPassive(p: PassiveSkill): void {
    const move = p.kind === 'movement';
    const tx = this.heroFor(passiveIconUrl(p), p.name, [move ? 'Movement' : 'Passive', move ? 'Jump again in mid-air' : 'Always on'], `${rank(this.jobs[p.job], p.job)} · ${move ? 'MOVEMENT SKILL' : 'PASSIVE SKILL'}`);
    const ef = this.div('effects', tx);
    const c = document.createElement('span'); c.className = 'gl-cap'; c.textContent = 'Effects'; ef.appendChild(c);
    const ul = document.createElement('ul'); ef.appendChild(ul);
    for (const e of p.effects) { const li = document.createElement('li'); li.textContent = e; ul.appendChild(li); }
    this.details(p.description, [], p.job, !!p.wip);
  }

  /** The left panel: what kind of skill, the big icon, name, role chips, a thin rule; returns the text column for what goes under it. */
  private heroFor(icon: string, name: string, roles: string[], kind: string): HTMLDivElement {
    this.hero.innerHTML = '';
    this.div('kind gl-cap', this.hero).textContent = kind;
    const im = document.createElement('img'); im.src = icon; im.alt = ''; im.draggable = false; this.hero.appendChild(im);
    const tx = this.div('tx', this.hero);
    this.div('nm', tx).textContent = name;
    const rl = this.div('roles', tx);
    for (const r of roles) { const i = document.createElement('span'); i.className = 'gl-chip'; i.textContent = r; rl.appendChild(i); }
    this.div('rule', tx);
    return tx;
  }

  /** The right panel: what it does and a couple of tips; whether it is open shows in its header. */
  private details(text: string, tips: string[], jk: number, wip = false): void {
    const open = this.jobOpen(jk) && !wip, job = this.jobs[jk];
    this.desc.innerHTML = '';
    const top = this.div('top', this.desc);
    this.div('gl-cap', top).textContent = 'Description';
    const st = document.createElement('span'); st.className = `gl-chip ${wip ? 'gold' : open ? 'ok' : 'no'}`; top.appendChild(st);
    st.textContent = wip ? 'Coming soon' : open ? 'Unlocked' : `Unlocks at Lv ${job.level}`; // a template: not built yet
    st.title = wip ? 'This skill is still being made' : open ? '' : `Unlocks with ${ADV_LABEL[jk]} (${job.name}) · Lv ${job.level}`;
    const ds = this.div(text.length > 190 ? 'ds long' : 'ds', this.desc); ds.textContent = text;
    if (tips.length) { const rel = this.div('rel', this.desc); for (const t of tips) this.div('', rel).textContent = t; }
  }

  toggle(): void { if (this.open) this.close(); else this.show(); }

  private show(): void {
    this.open = true;
    const book = keyLabel(loadBindings().book);
    this.closeBtn.title = `Close (${book ? `${book} / ` : ''}Esc)`;
    this.buildRow(); // the keys on the cards as they are now (Key Settings)
    this.root.classList.add('open');
    this.hover = null; this.refresh();
    this.layout();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('open');
  }

  layout(): void { if (this.open) this.lastRect = syncOverlay(this.root, this.host, this.canvas, this.lastRect); }

  update(_ms: number): void { /* static book */ }

  /** QA: which skill the preview / detail currently shows. */
  get shownSkill(): string { return (this.hover ?? this.selected).id; }
  select(slot: number): void { const s = this.kit.find((x) => x.slot === slot); if (s) { this.job = this.jobIndexOf(s); this.page = this.pages().findIndex((pg) => pg.includes(s)); this.selected = s; this.buildRow(); this.refresh(); } }
  /** QA: open a passive / movement card by id. */
  selectPassive(id: string): void { const p = passivesFor(this.cls).find((x) => x.id === id); if (p) { this.job = p.job; this.page = this.pages().findIndex((pg) => pg.includes(p)); this.selected = p; this.buildRow(); this.refresh(); } }

  destroy(): void { this.root.remove(); }
}
