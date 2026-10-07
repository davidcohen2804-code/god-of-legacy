// Skill Book (K): the class's skills by job advancement (tabs) — SKILLS / PASSIVE pages, a still showcase and the
// detail card. No video or replay of a skill: the player discovers what it does by using it.
import { keyLabel, loadBindings, slotKeyLabels } from '../game/KeyBindings';
import type Phaser from 'phaser';
import { CLASS_NAMES, FONT_FAMILY, HUD } from '../config/layout';
import { syncOverlay } from './CharacterSelectUI';
import type { Rect } from './PreviewStage';
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
const BG = { x: 160, y: 140, w: 1600, h: 800 };
// zones measured on kit/skillbook_window.png (the window art paints banner, tab strip, 4 card frames, two framed panels,
// each with a header strip over its body)
const LEFT = { head: { x: 95, y: 452, w: 780, h: 40 }, body: { x: 90, y: 509, w: 790, h: 210 } };
const RIGHT = { head: { x: 1004, y: 444, w: 512, h: 43 }, body: { x: 1000, y: 493, w: 520, h: 231 } };
const TAB_X = [50, 355, 659, 962, 1263], TAB_W = 287, TAB_Y = 149, TAB_H = 52;
const FRAME_CX = [362, 661, 940, 1235], FRAME_Y = 245, FRAME_IN = 150; // painted card frames: inner box FRAME_IN x 136
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
const READ = HUD.bodyFont;
const px = (r: { x: number; y: number; w: number; h: number }) => `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
const CSS = `
.gol-sb{z-index:40;display:none}
.gol-sb.open{display:block}
.gol-sb .bg{position:absolute;left:${BG.x}px;top:${BG.y}px;width:${BG.w}px;height:${BG.h}px;background:url("${K('skillbook_window')}") 0 0/100% 100%;
  pointer-events:auto;animation:golSbIn 220ms ease-out;filter:drop-shadow(0 12px 30px rgba(0,0,0,.55))}
@keyframes golSbIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
.gol-sb .hdr{position:absolute;left:482px;top:44px;width:632px;height:62px;text-align:center;pointer-events:none}
.gol-sb .ttl{display:block;margin-top:4px;font:700 25px/30px ${FONT_FAMILY};letter-spacing:4px;color:#f3dcaa;text-shadow:0 2px 6px #000}
.gol-sb .sub{display:block;font:600 12.5px/18px ${READ};letter-spacing:1.6px;color:#b4c2d0;text-transform:uppercase;white-space:nowrap}
.gol-sb .x{position:absolute;left:1522px;top:90px;width:56px;height:56px;border:0;border-radius:50%;background:transparent;cursor:pointer;pointer-events:auto;transition:box-shadow 120ms}
.gol-sb .x:hover{box-shadow:0 0 16px 6px rgba(255,214,130,.45)}
.gol-sb .tab{position:absolute;top:${TAB_Y}px;width:${TAB_W}px;height:${TAB_H}px;cursor:pointer;text-align:left;padding:7px 0 0 62px;border-radius:6px;transition:background 120ms,box-shadow 120ms}
.gol-sb .tab:hover{background:rgba(255,214,130,.08)}
.gol-sb .tab.on{background:rgba(6,12,24,.55);box-shadow:inset 0 -3px 0 #e8b25a,inset 0 0 0 1px rgba(232,178,90,.55)}
.gol-sb .tab.on b{color:#ffe7a8;text-shadow:0 0 8px rgba(255,200,90,.55),0 1px 2px #000}
.gol-sb .tab.on span{color:#dccaa0}
.gol-sb .tab .em{position:absolute;left:8px;top:3px;width:46px;height:46px;background:0 0/100% 100% no-repeat;filter:drop-shadow(0 2px 3px #000)}
.gol-sb .tab .lv{position:absolute;right:8px;top:5px;width:36px;height:42px;background:url("${K('hex_badge')}") center/100% 100% no-repeat;font:700 14px/42px ${FONT_FAMILY};color:#ffe2a0;text-align:center;text-shadow:0 1px 2px #000}
.gol-sb .tab b{display:block;font:700 15px/19px ${FONT_FAMILY};letter-spacing:1px;color:#f3e2bf;white-space:nowrap;text-shadow:0 1px 2px #000}
.gol-sb .tab span{display:block;font:500 12.5px/17px ${READ};letter-spacing:.3px;color:#aab8c6;margin-top:1px;white-space:nowrap}
.gol-sb .tab.lk b{color:#8c939b}
.gol-sb .tab.lk .em{filter:grayscale(.7) brightness(.6)}
.gol-sb .tab.lk .lv{color:#9aa3ab}
.gol-sb .tab.lk:after{content:'';position:absolute;left:34px;top:24px;width:20px;height:27px;background:url("${K('lock')}") center/contain no-repeat;filter:drop-shadow(0 1px 2px #000)}
.gol-sb .row{position:absolute;left:0;top:0;width:${BG.w}px;height:0}
.gol-sb .card{position:absolute;top:${FRAME_Y}px;width:${FRAME_IN}px;height:136px;margin-left:${-FRAME_IN / 2}px;cursor:pointer;border-radius:6px;transition:background 120ms,box-shadow 120ms}
.gol-sb .card:hover{background:rgba(255,214,130,.07)}
.gol-sb .card.sel{background:radial-gradient(ellipse at 50% 40%,rgba(255,200,90,.22),rgba(255,200,90,0) 70%);box-shadow:inset 0 0 0 2px rgba(232,178,90,.85),0 0 16px rgba(232,178,90,.45)}
.gol-sb .card img{position:absolute;left:${(FRAME_IN - 86) / 2}px;top:7px;width:86px;height:86px;border-radius:8px;filter:drop-shadow(0 4px 6px rgba(0,0,0,.6));pointer-events:none;transition:transform 120ms}
.gol-sb .card:hover img,.gol-sb .card.sel img{transform:scale(1.05)}
.gol-sb .card.lk img{filter:grayscale(1) brightness(.4)}
.gol-sb .card.lk:after{content:'';position:absolute;left:${FRAME_IN / 2 - 13}px;top:33px;width:26px;height:36px;background:url("${K('lock')}") center/contain no-repeat;filter:drop-shadow(0 1px 3px #000)}
.gol-sb .card .hk,.gol-sb .card .pt{position:absolute;right:3px;top:3px;min-width:28px;height:26px;padding:0 6px;box-sizing:border-box;border-radius:6px;background:#0b121bee;border:1px solid #c99a45;
  font:700 14px/24px ${FONT_FAMILY};color:#f3dcaa;text-align:center}
.gol-sb .card .pt{border-color:#6f8fb0;color:#bcd6ef}
.gol-sb .card .nm{position:absolute;left:3px;right:3px;top:97px;height:36px;display:flex;align-items:center;justify-content:center;text-align:center;
  font:700 14px/16px ${FONT_FAMILY};color:#f3e2bf;text-shadow:0 1px 3px #000;overflow:hidden}
.gol-sb .card.lk .nm{color:#8c939b}
.gol-sb .card.wip img{filter:grayscale(.35) brightness(.75)}
.gol-sb .card.wip .nm{color:#b9a98a}
.gol-sb .card.none{cursor:default;background:url("${K('slot_empty')}") center 8px/84px 84px no-repeat;opacity:.38}
.gol-sb .card.none:hover{background-color:transparent}
.gol-sb .all{position:absolute;left:58px;top:98px;height:36px;padding:0 16px 0 12px;display:flex;align-items:center;gap:10px;border-radius:8px;cursor:pointer;pointer-events:auto;
  background:#0b121bd9;border:1px solid #6a5630;font:700 12.5px ${READ};letter-spacing:1.4px;color:#cdb98a;transition:box-shadow 120ms,border-color 120ms}
.gol-sb .all:hover{border-color:#c99a45;box-shadow:0 0 12px rgba(232,178,90,.35)}
.gol-sb .all i{width:20px;height:20px;flex:none;background:url("${K('checkbox')}") center/100% 100% no-repeat}
.gol-sb .all.on{color:#ffe7a8;border-color:#e8b25a;box-shadow:0 0 12px rgba(232,178,90,.4)}
.gol-sb .all.on i{background-image:url("${K('checkbox_checked')}")}
.gol-sb .pg{position:absolute;left:62px;width:196px;height:50px;box-sizing:border-box;padding:0 16px 0 18px;display:flex;align-items:center;justify-content:space-between;border-radius:8px;cursor:pointer;pointer-events:auto;
  background:#0b121bd9;border:1px solid #6a5630;font:700 15px ${FONT_FAMILY};letter-spacing:2px;color:#c9b48a;transition:box-shadow 120ms,border-color 120ms}
.gol-sb .pg:hover{border-color:#c99a45;box-shadow:0 0 12px rgba(232,178,90,.3)}
.gol-sb .pg.on{color:#ffe7a8;border-color:#e8b25a;background:rgba(6,12,24,.75);box-shadow:inset 3px 0 0 #e8b25a,0 0 14px rgba(232,178,90,.35)}
.gol-sb .pg b{min-width:28px;height:26px;padding:0 7px;box-sizing:border-box;border-radius:13px;background:#1b2a3a;border:1px solid #3d5a78;color:#bcd6ef;font-size:14px;line-height:24px;text-align:center;letter-spacing:0}
.gol-sb .pg.on b{background:#3a2a10;border-color:#c99a45;color:#ffe2a0}
.gol-sb .pg.l{top:${FRAME_Y + 10}px}.gol-sb .pg.r{top:${FRAME_Y + 72}px}
.gol-sb .pg.off{opacity:.35;pointer-events:none}
.gol-sb .head{position:absolute;display:flex;align-items:center;font:700 15px ${FONT_FAMILY};letter-spacing:3px;color:#f0d9a6;text-shadow:0 1px 3px #000,0 0 8px #000;white-space:nowrap;overflow:hidden;pointer-events:none}
.gol-sb .head.l{${px(LEFT.head)};padding:0 24px}
.gol-sb .head.r{${px(RIGHT.head)};padding:0 22px 0 26px;color:#cdb98a;font-size:14px;letter-spacing:4px;justify-content:space-between}
.gol-sb .head.r .st{display:flex;align-items:center;gap:7px;font:700 12.5px ${READ};letter-spacing:1.4px;color:#9fe08a;text-shadow:0 1px 2px #000}
.gol-sb .head.r .st:before{content:'';width:8px;height:8px;border-radius:50%;background:#7fdc6a;box-shadow:0 0 6px #7fdc6a}
.gol-sb .head.r .st.lock{color:#ffad8a}
.gol-sb .head.r .st.lock:before{width:13px;height:17px;border-radius:0;box-shadow:none;background:url("${K('lock')}") center/contain no-repeat}
.gol-sb .hero{position:absolute;${px(LEFT.body)};pointer-events:none}
.gol-sb .hero > img{position:absolute;left:34px;top:${(LEFT.body.h - 122) / 2}px;width:122px;height:122px;border-radius:12px;filter:drop-shadow(0 0 20px rgba(255,200,90,.28)) drop-shadow(0 6px 10px rgba(0,0,0,.6))}
.gol-sb .hero .tx{position:absolute;left:190px;right:30px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center}
.gol-sb .hero .nm{font:700 26px/32px ${FONT_FAMILY};letter-spacing:1px;color:#f6e6c2;text-shadow:0 2px 4px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-sb .roles{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.gol-sb .roles i{font:600 13px/22px ${READ};font-style:normal;padding:0 12px;border-radius:12px;background:#1b2a3a;border:1px solid #3d5a78;color:#c8def2;letter-spacing:.2px}
.gol-sb .rule{height:1px;margin:16px 0 13px;background:linear-gradient(90deg,rgba(201,154,69,.55),rgba(201,154,69,.12))}
.gol-sb .facts{display:flex}
.gol-sb .facts > div{padding:0 16px;border-left:1px solid rgba(201,154,69,.28);min-width:0}
.gol-sb .facts > div:first-child{padding-left:0;border-left:0}
.gol-sb .cap{display:block;font:600 11px/15px ${READ};letter-spacing:1.6px;color:#b9a27a;text-transform:uppercase;white-space:nowrap}
.gol-sb .facts b{display:flex;align-items:center;height:30px;margin-top:3px;font:600 15.5px/20px ${READ};color:#f3e6c8;white-space:nowrap}
.gol-sb .facts .kc{display:inline-block;min-width:32px;height:30px;padding:0 9px;box-sizing:border-box;background:url("${K('keycap')}") center/100% 100% no-repeat;font:700 15px/30px ${FONT_FAMILY};text-align:center;color:#ffe2a0}
.gol-sb .facts .kc.wide{background-image:url("${K('keycap_wide')}");font-size:12px;letter-spacing:1px;min-width:76px}
.gol-sb .effects ul{margin:5px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}
.gol-sb .effects li{font:600 15px/22px ${READ};color:#f3e6c8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-sb .effects li:before{content:'\\25C6';color:#e8b25a;font-size:10px;margin-right:9px;vertical-align:2px}
.gol-sb .det{position:absolute;${px(RIGHT.body)};box-sizing:border-box;padding:20px 28px 18px;display:flex;flex-direction:column;gap:14px;color:#e6ebf0;font-family:${READ};overflow:hidden}
.gol-sb .det .ds{font-size:15.5px;line-height:1.55}
.gol-sb .det .ds.long{font-size:14.5px;line-height:1.5}
.gol-sb .det .rel{display:flex;flex-direction:column;gap:5px;font:500 14.5px/20px ${READ};color:#f0d9a6}
.gol-sb .det .rel div{display:flex;gap:9px}
.gol-sb .det .rel div:before{content:'\\2192';color:#c99a45}
`;

function ensureStyles(): void {
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
  private bg: HTMLDivElement;
  private tabs: HTMLDivElement[] = [];
  private row: HTMLDivElement;
  private cards: { el: HTMLDivElement; e: Entry }[] = [];
  private page = 0;
  private pager: HTMLDivElement[] = [];
  private hero: HTMLDivElement;
  private det: HTMLDivElement;
  private headL: HTMLDivElement;
  private headR: HTMLDivElement;
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
    this.bg = this.div('bg', this.root);
    const hdr = this.div('hdr', this.bg);
    this.div('ttl', hdr).textContent = `SKILL BOOK — ${(CLASS_NAMES[cls] ?? cls).toUpperCase()}`;
    const cur = this.jobs.filter((j) => level >= j.level).pop() ?? this.jobs[0];
    this.sub = this.div('sub', hdr);
    if (onAllOpen) { // test switch: every skill usable at any level
      const b = document.createElement('button'); b.className = 'all';
      b.addEventListener('click', () => onAllOpen(!this.qaUnlockAll));
      this.bg.appendChild(b); this.allBtn = b;
    }
    this.setSubtitle();
    const x = document.createElement('button'); x.className = 'x'; this.closeBtn = x;
    x.addEventListener('click', () => this.close()); this.bg.appendChild(x);
    this.jobs.forEach((j, k) => {
      const t = this.div('tab', this.bg); t.style.left = `${TAB_X[k]}px`;
      t.innerHTML = '<div class="em"></div><b></b><span></span><div class="lv"></div>';
      (t.children[1] as HTMLElement).textContent = j.name.toUpperCase();
      (t.children[2] as HTMLElement).textContent = ADV_LABEL[k] === j.name ? `Lv ${j.level}–${j.to}` : `${ADV_LABEL[k]} · Lv ${j.level}–${j.to}`;
      (t.children[3] as HTMLElement).textContent = String(j.level);
      t.addEventListener('click', () => { this.job = k; this.page = 0; this.selected = this.entries()[0]; this.buildRow(); this.refresh(); });
      this.tabs.push(t);
    });
    this.row = this.div('row', this.bg);
    this.headL = this.div('head l', this.bg);
    this.hero = this.div('hero', this.bg);
    this.headR = this.div('head r', this.bg);
    this.det = this.div('det', this.bg);
    for (const side of ['l', 'r'] as const) {
      const b = this.div(`pg ${side}`, this.bg); b.innerHTML = `<span>${side === 'l' ? 'SKILLS' : 'PASSIVE'}</span><b></b>`;
      b.addEventListener('click', () => { this.page = side === 'l' ? 0 : 1; this.buildRow(); this.selected = this.cards[0]?.e ?? this.selected; this.refresh(); });
      this.pager.push(b);
    }
    this.job = Math.max(0, this.jobs.indexOf(cur));
    this.selected = this.entries()[0];
    this.buildRow();
    this.refresh();
  }

  private setSubtitle(): void {
    const cur = this.jobs.filter((j) => this.level >= j.level).pop() ?? this.jobs[0];
    this.sub.textContent = this.qaUnlockAll ? `Level ${this.level} · ${cur.name} — all skills open (test)` : `Level ${this.level} · ${cur.name} — skills unlock with each job advancement`;
    if (this.allBtn) { this.allBtn.classList.toggle('on', this.qaUnlockAll); this.allBtn.innerHTML = `<i></i>ALL SKILLS OPEN`; this.allBtn.title = this.qaUnlockAll ? 'Back to level-based unlocks' : 'Open every skill for testing'; }
  }

  /** The "all skills open" switch changed: relock / unlock tabs, cards and details. */
  setUnlockAll(on: boolean): void { this.qaUnlockAll = on; this.setSubtitle(); this.refresh(); }
  /** Level up: jobs / skills / passives that open now. */
  setLevel(level: number): void { this.level = level; this.setSubtitle(); this.refresh(); }

  private div(cls: string, parent: HTMLElement): HTMLDivElement { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }

  private jobOpen(k: number): boolean { return this.qaUnlockAll || this.level >= this.jobs[k].level; }
  private jobIndexOf(s: Entry): number { return isPassive(s) ? s.job : Math.max(0, this.jobs.findIndex((j) => j.slots.includes(s.slot))); }
  unlocked(s: Entry): boolean { return this.jobOpen(this.jobIndexOf(s)); }

  /** Pages of the current job tab: its active skills (4 frames), then its passive / movement skills. */
  private pages(): Entry[][] {
    const act = this.jobs[this.job].slots.map((slot) => this.kit.find((s) => s.slot === slot)).filter((s): s is FinalSkill => !!s);
    const pas = passivesFor(this.cls, this.job);
    return [act.slice(0, FRAME_CX.length), pas.slice(0, FRAME_CX.length)]; // page 0 = skills, page 1 = passive / movement
  }
  private entries(): Entry[] { return this.pages().flat(); }

  private buildRow(): void {
    this.row.innerHTML = ''; this.cards = [];
    const pages = this.pages();
    this.page = Math.max(0, Math.min(this.page, pages.length - 1));
    const list = pages[this.page];
    list.forEach((e, n) => {
      const c = this.div('card', this.row); c.style.left = `${FRAME_CX[n]}px`;
      const img = document.createElement('img'); img.src = entryIcon(e); img.alt = ''; img.draggable = false; c.appendChild(img);
      if (isPassive(e)) { const t = this.div('pt', c); t.textContent = e.kind === 'movement' ? '\u2934' : 'P'; t.title = e.kind === 'movement' ? 'Movement skill' : 'Passive skill'; }
      else this.div('hk', c).textContent = HOTKEY[e.slot];
      this.div('nm', c).textContent = e.name;
      c.addEventListener('mouseenter', () => { this.hover = e; this.refresh(); });
      c.addEventListener('mouseleave', () => { if (this.hover === e) { this.hover = null; this.refresh(); } });
      c.addEventListener('click', () => { this.selected = e; this.refresh(); });
      this.cards.push({ el: c, e });
    });
    for (let n = list.length; n < FRAME_CX.length; n++) { const c = this.div('card none', this.row); c.style.left = `${FRAME_CX[n]}px`; } // an empty frame: an empty socket
    this.pager.forEach((b, k) => { b.classList.toggle('on', this.page === k); b.classList.toggle('off', !pages[k].length); (b.lastChild as HTMLElement).textContent = String(pages[k].length); });
  }

  /** Kept for callers: the book has no character preview (players discover a skill by using it). */
  setEquipped(_e: unknown): void { /* no preview */ }

  private refresh(): void {
    const show = this.hover ?? this.selected;
    this.tabs.forEach((t, k) => { const on = k === this.job; t.classList.toggle('lk', !this.jobOpen(k)); t.classList.toggle('on', on); (t.firstChild as HTMLElement).style.backgroundImage = `url("${K(`job${k}_icon`)}")`; (t.firstChild as HTMLElement).style.filter = on ? 'drop-shadow(0 0 6px rgba(255,200,90,.8))' : ''; });
    for (const c of this.cards) { c.el.classList.toggle('sel', c.e === this.selected); c.el.classList.toggle('lk', !this.unlocked(c.e)); c.el.classList.toggle('wip', !!c.e.wip && this.unlocked(c.e)); } // a template: its icon, dimmed (no lock)
    if (isPassive(show)) { this.refreshPassive(show); return; }
    const s = show, jk = this.jobIndexOf(s), job = this.jobs[jk];
    this.headL.textContent = `${rank(job, jk)} · ${kindOf(s)}`;
    const key = HOTKEY[s.slot] ?? '';
    const tx = this.heroFor(iconUrl(s), s.name, s.roles.map((r) => ROLE_LABEL[r] ?? r));
    const facts = this.div('facts', tx);
    const fact = (label: string): HTMLElement => { const d = this.div('', facts); const c = document.createElement('span'); c.className = 'cap'; c.textContent = label; d.appendChild(c); const b = document.createElement('b'); d.appendChild(b); return b; };
    const k = fact('Key');
    if (key) { const kc = document.createElement('span'); kc.className = key.length > 2 ? 'kc wide' : 'kc'; kc.textContent = key; k.appendChild(kc); } else k.textContent = 'None';
    fact('Cooldown').textContent = s.cooldown > 0 ? `${(s.cooldown / 1000).toFixed(s.cooldown % 1000 ? 1 : 0)} s` : 'None (chain)';
    fact('Use').textContent = s.ground && s.air ? 'Ground and air' : s.air ? 'Air only' : 'Ground only';
    fact('Reach').textContent = TARGETING[s.targeting];
    this.details(keyed(s.description, s.slot), s.relations.slice(0, 2).map((r) => keyed(r, s.slot)), jk, !!s.wip);
  }

  /** Passive / movement card: what it gives (always on). */
  private refreshPassive(p: PassiveSkill): void {
    const move = p.kind === 'movement';
    this.headL.textContent = `${rank(this.jobs[p.job], p.job)} · ${move ? 'MOVEMENT SKILL' : 'PASSIVE SKILL'}`;
    const tx = this.heroFor(passiveIconUrl(p), p.name, [move ? 'Movement' : 'Passive', move ? 'Jump again in mid-air' : 'Always on']);
    const ef = this.div('effects', tx);
    const c = document.createElement('span'); c.className = 'cap'; c.textContent = 'Effects'; ef.appendChild(c);
    const ul = document.createElement('ul'); ef.appendChild(ul);
    for (const e of p.effects) { const li = document.createElement('li'); li.textContent = e; ul.appendChild(li); }
    this.details(p.description, [], p.job, !!p.wip);
  }

  /** The left panel: big icon, name, role chips, a thin rule; returns the text column for what goes under it. */
  private heroFor(icon: string, name: string, roles: string[]): HTMLDivElement {
    this.hero.innerHTML = '';
    const im = document.createElement('img'); im.src = icon; im.alt = ''; im.draggable = false; this.hero.appendChild(im);
    const tx = this.div('tx', this.hero);
    this.div('nm', tx).textContent = name;
    const rl = this.div('roles', tx);
    for (const r of roles) { const i = document.createElement('i'); i.textContent = r; rl.appendChild(i); }
    this.div('rule', tx);
    return tx;
  }

  /** The right panel: what it does and a couple of tips; whether it is open shows in its header. */
  private details(text: string, tips: string[], jk: number, wip = false): void {
    const open = this.jobOpen(jk) && !wip, job = this.jobs[jk];
    this.headR.innerHTML = '<span>DESCRIPTION</span><span class="st"></span>';
    const st = this.headR.lastChild as HTMLElement;
    st.classList.toggle('lock', !open); st.textContent = wip ? 'COMING SOON' : open ? 'UNLOCKED' : `UNLOCKS AT LV ${job.level}`; // a template: not built yet
    st.title = wip ? 'This skill is still being made' : open ? '' : `Unlocks with ${ADV_LABEL[jk]} (${job.name}) · Lv ${job.level}`;
    this.det.innerHTML = '';
    const ds = this.div(text.length > 190 ? 'ds long' : 'ds', this.det); ds.textContent = text;
    if (tips.length) { const rel = this.div('rel', this.det); for (const t of tips) this.div('', rel).textContent = t; }
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
