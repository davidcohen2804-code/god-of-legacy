// Skill Book (K): the class's 8 final skills as a tree on the supplied book art — root (Space) at the bottom, branches
// upward, Signature / Ultimate at the branch tips. Hover/select shows the detail card and a live Phaser preview that
// replays the real runtime cast (body sheet pose + SkillRuntime/SkillFx VFX) on a neutral dummy in a 2–3 s loop.
import { slotKeyLabels } from '../game/KeyBindings';
import Phaser from 'phaser';
import COMBAT_ASSETS from '../data/stage5-assets.json';
import { CLASS_NAMES, FONT_FAMILY } from '../config/layout';
import { syncOverlay } from './CharacterSelectUI';
import { PreviewStage, Rect, holeMask } from './PreviewStage';
import { ActorView } from '../game/ActorView';
import { ClassKey, resolvePose } from '../game/Body';
import { AnimSnap, Mode, RECOVER_MS, poseQuery } from '../game/PoseState';
import { FinalSkill, HitShape, Role, Targeting } from '../skills/SkillTypes';
import { iconUrl, kitFor } from '../skills/FinalKit';
import { CastRun, SkillRuntime } from '../skills/SkillRuntime';
import { HitTarget, V3 } from '../skills/HitGeometry';
import { SkillFx } from '../skills/SkillFx';
import { ADV_LABEL, Job, jobsFor } from '../skills/Jobs';

const A = (f: string) => `assets/final/ui/skill_book/${f}.png`;
const K = (f: string) => `assets/final/ui/kit/${f}.png`;
const BG = { x: 160, y: 140, w: 1600, h: 800 };
// zones measured on kit/skillbook_window.png (the window art paints banner, tab strip, 4 card frames, two book pages)
const PREVIEW: Rect = { x: 78, y: 447, w: 815, h: 279 };
const DETAIL: Rect = { x: 1000, y: 449, w: 518, h: 276 };
const TAB_X = [50, 355, 659, 962, 1263], TAB_W = 287, TAB_Y = 149, TAB_H = 52;
const FRAME_CX = [362, 661, 940, 1235], FRAME_Y = 245, FRAME_IN = 150; // painted card frames: inner box FRAME_IN x 135
/** Pre-recorded in-game clips of each skill (exact final visuals); falls back to the live preview when missing. */
const CLIPS = new Set(['warrior_basic', 'dash_slash', 'rising_slash', 'ground_breaker', 'whirlwind', 'sanctuary', 'blade_storm', 'titans_verdict', 'leap_crash', 'wave_slash', 'radiant_blade', 'lance_thrust', 'war_cry', 'judgment_blade']);
const clipUrl = (id: string) => `assets/final/skills/clips/${id}.mp4?v=${__BUILD_COMMIT__}`;
const HOTKEY = new Proxy([] as string[], { get: (_t, p) => (typeof p === 'string' && /^\d+$/.test(p) ? slotKeyLabels()[+p] : undefined) }); // live: Key Settings
const CARD = 112;

const ROLE_LABEL: Partial<Record<Role, string>> = {
  basic: 'Basic', opener: 'Opener', gapClose: 'Gap Close', launcher: 'Launcher', extender: 'Extender', airExtender: 'Air Extender',
  knockdown: 'Knockdown', antiAir: 'Anti-Air', confirm: 'Confirm', peel: 'Peel', setup: 'Setup', hardCC: 'Hard CC', zone: 'Zone',
  pull: 'Pull', projectile: 'Projectile', precision: 'Precision', trap: 'Trap', mobility: 'Mobility', chase: 'Chase', counter: 'Counter',
  escape: 'Escape', finisher: 'Finisher', signature: 'Signature', ultimate: 'Ultimate',
};
const TARGETING: Record<Targeting, string> = {
  aimAssist: 'In the facing direction', mouseDir: 'Dash in the facing direction', mouseProjectile: 'Projectile in the facing direction',
  mouseLine: 'Line in the facing direction', mouseCone: 'Cone in the facing direction', mouseGround: 'Ground point ahead of you',
  mouseTarget: 'Locks the first target ahead', self: 'Around the caster', selfAim: 'Around the caster, biased forward',
};

const STYLE_ID = 'gol-skillbook-style';
const CSS = `
.gol-sb{z-index:40;display:none}
.gol-sb.open{display:block}
.gol-sb .bg{position:absolute;left:${BG.x}px;top:${BG.y}px;width:${BG.w}px;height:${BG.h}px;background:url("${K('skillbook_window')}") 0 0/100% 100%;
  pointer-events:auto;animation:golSbIn 220ms ease-out}
@keyframes golSbIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
.gol-sb .hdr{position:absolute;left:482px;top:44px;width:632px;height:62px;text-align:center;pointer-events:none}
.gol-sb .ttl{display:block;margin-top:6px;font:700 22px/26px ${FONT_FAMILY};letter-spacing:4px;color:#f0d9a6;text-shadow:0 2px 6px #000}
.gol-sb .sub{display:block;font-size:11px;line-height:14px;letter-spacing:2px;color:#9fb0c0;text-transform:uppercase;white-space:nowrap}
.gol-sb .x{position:absolute;left:1522px;top:90px;width:56px;height:56px;border:0;border-radius:50%;background:transparent;cursor:pointer;pointer-events:auto;transition:box-shadow 120ms}
.gol-sb .x:hover{box-shadow:0 0 16px 6px rgba(255,214,130,.45)}
.gol-sb .tab{position:absolute;top:${TAB_Y}px;width:${TAB_W}px;height:${TAB_H}px;cursor:pointer;text-align:left;padding:7px 0 0 60px;border-radius:6px;transition:background 120ms,box-shadow 120ms}
.gol-sb .tab:hover{background:rgba(255,214,130,.08)}
.gol-sb .tab.on{background:rgba(6,12,24,.55);box-shadow:inset 0 -3px 0 #e8b25a,inset 0 0 0 1px rgba(232,178,90,.55)}
.gol-sb .tab.on b{color:#ffe7a8;text-shadow:0 0 8px rgba(255,200,90,.55),0 1px 2px #000}
.gol-sb .tab.on span{color:#d9c49a}
.gol-sb .tab .em{position:absolute;left:6px;top:1px;width:50px;height:50px;background:0 0/100% 100% no-repeat;filter:drop-shadow(0 2px 3px #000)}
.gol-sb .tab .lv{position:absolute;right:8px;top:6px;width:34px;height:40px;background:url("${K('hex_badge')}") center/100% 100% no-repeat;font:700 12px/40px ${FONT_FAMILY};color:#ffe2a0;text-align:center;text-shadow:0 1px 2px #000}
.gol-sb .tab b{display:block;font:700 13px ${FONT_FAMILY};letter-spacing:1px;color:#f3e2bf;white-space:nowrap}
.gol-sb .tab span{display:block;font-size:11px;letter-spacing:1px;color:#9fb0c0;margin-top:2px;white-space:nowrap}
.gol-sb .tab.lk b{color:#8c939b}
.gol-sb .tab.lk .em{filter:grayscale(.7) brightness(.6)}
.gol-sb .tab.lk .lv{color:#9aa3ab}
.gol-sb .tab.lk:after{content:'';position:absolute;right:48px;top:10px;width:22px;height:30px;background:url("${K('lock')}") center/contain no-repeat;filter:drop-shadow(0 1px 2px #000)}
.gol-sb .row{position:absolute;left:0;top:0;width:${BG.w}px;height:0}
.gol-sb .card{position:absolute;top:${FRAME_Y}px;width:${FRAME_IN}px;height:136px;margin-left:${-FRAME_IN / 2}px;cursor:pointer;border-radius:6px;transition:background 120ms,box-shadow 120ms}
.gol-sb .card:hover{background:rgba(255,214,130,.07)}
.gol-sb .card.sel{background:radial-gradient(ellipse at 50% 40%,rgba(255,200,90,.22),rgba(255,200,90,0) 70%);box-shadow:inset 0 0 0 2px rgba(232,178,90,.85),0 0 16px rgba(232,178,90,.45)}
.gol-sb .card img{position:absolute;left:${(FRAME_IN - 84) / 2}px;top:10px;width:84px;height:84px;border-radius:8px;box-shadow:0 0 0 1px #6a5630,0 4px 10px rgba(0,0,0,.6);pointer-events:none;transition:transform 120ms}
.gol-sb .card:hover img,.gol-sb .card.sel img{transform:scale(1.05)}
.gol-sb .card.lk img{filter:grayscale(1) brightness(.4)}
.gol-sb .card.lk:after{content:'';position:absolute;left:${FRAME_IN / 2 - 13}px;top:34px;width:26px;height:36px;background:url("${K('lock')}") center/contain no-repeat;filter:drop-shadow(0 1px 3px #000)}
.gol-sb .card .hk{position:absolute;right:4px;top:4px;min-width:24px;height:22px;padding:0 5px;border-radius:5px;background:#0b121bee;border:1px solid #c99a45;
  font:700 12px/20px ${FONT_FAMILY};color:#f0d9a6;text-align:center}
.gol-sb .card .nm{position:absolute;left:4px;right:4px;top:102px;text-align:center;font:700 13px/16px ${FONT_FAMILY};color:#f3e2bf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px #000}
.gol-sb .card.lk .nm{color:#8c939b}
.gol-sb .pv{position:absolute;left:${PREVIEW.x}px;top:${PREVIEW.y}px;width:${PREVIEW.w}px;height:${PREVIEW.h}px;overflow:hidden;background:#0a1018;border-radius:4px}
.gol-sb .pv video{width:100%;height:100%;object-fit:cover;object-position:50% 62%;display:block}
.gol-sb .pcap{position:absolute;left:${BG.x + PREVIEW.x + 18}px;top:${BG.y + PREVIEW.y + 13}px;width:${PREVIEW.w - 36}px;font:700 12px ${FONT_FAMILY};letter-spacing:2.5px;color:#f0d9a6;text-shadow:0 1px 3px #000,0 0 8px #000;pointer-events:none;z-index:2}
.gol-sb .det{position:absolute;left:${DETAIL.x}px;top:${DETAIL.y}px;width:${DETAIL.w}px;height:${DETAIL.h}px;color:#dfe6ee;font-family:Georgia,serif;overflow:hidden}
.gol-sb .det .hd{display:flex;gap:12px;align-items:center;height:40px;padding:0 26px}
.gol-sb .det .hd img{width:34px;height:34px;border-radius:6px;box-shadow:0 0 0 1px #c99a45}
.gol-sb .det .nm{font:700 17px/19px ${FONT_FAMILY};color:#f3e2bf;white-space:nowrap}
.gol-sb .det .tier{font:700 9.5px/12px ${FONT_FAMILY};letter-spacing:2px;color:#e8b25a;white-space:nowrap}
.gol-sb .det .body{position:absolute;left:30px;right:30px;top:54px;bottom:16px;display:flex;flex-direction:column;gap:7px}
.gol-sb .det .roles{display:flex;gap:6px;flex-wrap:wrap}
.gol-sb .det .roles i{font-style:normal;font-size:11.5px;padding:2px 9px;border-radius:10px;background:#1b2a3a;border:1px solid #3d5a78;color:#bcd6ef}
.gol-sb .det .ds{font-size:13.5px;line-height:1.42;color:#e4e9ef}
.gol-sb .det table{border-collapse:collapse;width:100%;font-size:13px}
.gol-sb .det td{padding:2px 0;vertical-align:top;border-bottom:1px solid rgba(201,154,69,.14)}
.gol-sb .det td:first-child{width:110px;color:#9fb0c0}
.gol-sb .det .rel{font-size:13px;color:#f0d9a6;display:flex;flex-direction:column;gap:2px}
.gol-sb .det .rel div:before{content:'\\2192  ';color:#c99a45}
.gol-sb .det .lock{color:#ff9a7a}
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
}

const tierName = (s: FinalSkill, job?: Job, adv?: number) => `${job ? `${ADV_LABEL[adv ?? 0].toUpperCase()} · ${job.name.toUpperCase()}` : ''}${s.slot === 7 ? ' · ULTIMATE' : s.slot === 6 ? ' · SIGNATURE' : s.slot === 0 ? ' · BASIC ATTACK' : ''}`;

// ----------------------------------------------------------------------------------------------- live preview

/** Distance caster → dummy that shows the skill's real reach. */
function previewDistance(s: FinalSkill): number {
  if (s.dash) return Math.min(250, s.dash.distance * 0.8 + 30);
  const sh: HitShape = (s.chain ? s.chain.stages[0] : s.hits).find((h) => h.damage > 0)?.shape ?? s.hits[0].shape;
  switch (sh.kind) {
    case 'sector': return Math.max(56, sh.range * 0.72);
    case 'circle': return sh.at === 'place' ? 200 : sh.at === 'aimBias' ? Math.max(60, sh.bias ?? 60) : Math.max(56, sh.radius * 0.6);
    case 'line': return Math.min(240, sh.length * 0.65);
    case 'capsule': return 90;
    case 'projectile': return 240;
    case 'chain': return 220;
    case 'placed': return 210;
  }
}

class SkillPreview {
  private rt: SkillRuntime;
  private fx: SkillFx;
  private view: ActorView;
  private dummy: Phaser.GameObjects.Image;
  private now = 0;
  private t = 0;
  private skill: FinalSkill | null = null;
  private stage = 0;
  private run: CastRun | null = null;
  private runAt = 0;
  private mode: Mode = 'idle';
  private modeT = 0;
  private caster: V3 = { x: 0, y: 0, z: 0 };
  private dashFrom = 0;
  private home = { cx: 0, dx: 0 };
  private dum = { x: 0, z: 0, vz: 0, flash: -1, shake: 0 };
  private seq = 0;

  constructor(scene: Phaser.Scene, private stageArea: PreviewStage, readonly cls: ClassKey) {
    const ox = stageArea.ox, oy = stageArea.oy;
    this.view = new ActorView(scene, cls, ox, oy);
    const D = COMBAT_ASSETS.textures.dummy;
    this.dummy = scene.add.image(ox, oy, D.key).setOrigin(D.origin.x, D.origin.y).setScale(D.displayHeight / D.height).setTint(0x9aa3ad);
    this.rt = new SkillRuntime({
      now: () => this.now,
      targets: () => [this.target()],
      onHit: (r, h, _i, _t, at) => {
        const dmg = Math.round(h.damage * r.skill.pvpMultiplier);
        this.fx.confirmed(r.skill, h, { x: this.dum.x, y: oy + 40, z: this.dum.z }, dmg, h.reaction.launch ? 'launch' : h.reaction.knockdown ? 'knockdown' : 'hit', false, 1);
        void at;
        this.dum.flash = 0; this.dum.shake = 120;
        if (h.reaction.launch) this.dum.vz = Math.sqrt(2 * 1100 * Math.min(110, h.reaction.launch));
        if (h.reaction.push) this.dum.x += Math.sign(this.dum.x - this.caster.x || 1) * Math.min(24, h.reaction.push * 0.4);
      },
      casterPos: () => this.caster,
    });
    this.fx = new SkillFx(scene, this.rt, () => this.caster, stageArea.cam);
  }

  private target(): HitTarget {
    return { id: 'pv-dummy', kind: 'enemy', x: this.dum.x, y: this.stageArea.oy + 40, z: this.dum.z, radius: 22, height: 96, alive: true };
  }

  setEquipped(e: Parameters<ActorView['setEquipped']>[0]): void { this.view.setEquipped(e); }

  show(s: FinalSkill): void {
    if (this.skill?.id === s.id) return;
    this.skill = s;
    this.restart();
  }

  private restart(): void {
    this.rt.cancelAttacker('pv');
    const s = this.skill!, d = previewDistance(s), oy = this.stageArea.oy + 40;
    this.home = { cx: this.stageArea.ox - d / 2 - 10, dx: this.stageArea.ox + d / 2 + 10 };
    this.caster = { x: this.home.cx, y: oy, z: 0 };
    this.dum = { x: this.home.dx, z: 0, vz: 0, flash: -1, shake: 0 };
    this.t = 0; this.stage = 0; this.run = null; this.mode = 'idle'; this.modeT = 0;
  }

  private cast(): void {
    const s = this.skill!;
    this.run = this.rt.start({
      castId: `pv-${this.seq++}`, skill: s, stage: this.stage, attackerId: 'pv', own: false,
      origin: { ...this.caster }, aim: { x: 1, y: 0 }, place: { x: this.dum.x, y: this.stageArea.oy + 40 }, lock: 'pv-dummy',
    });
    this.runAt = this.t; this.dashFrom = this.caster.x;
    this.mode = 'skill'; this.modeT = 0;
  }

  update(ms: number): void {
    if (!this.skill) return;
    const s = this.skill, step = this.fx.hitStopLeft > 0 ? 0 : ms;
    this.now += step; this.t += step; this.modeT += step;
    // Loop script: idle → cast (chain stages back to back) → recovery → idle; total 2.6–3 s.
    if (!this.run && this.mode !== 'skill' && this.t >= 420 && this.t < 450 + 30) this.cast();
    const r = this.run;
    if (r) {
      const T = r.timings, el = this.t - this.runAt;
      if (s.counter && !r.counterTriggered && el >= T.startup + 90) this.rt.triggerCounter(r, { x: 1, y: 0 }, { ...this.caster });
      if (s.dash && el >= T.startup && el <= T.startup + T.active) {
        const k = Math.min(1, (el - T.startup) / Math.max(1, T.active));
        const stop = this.dum.x - 46;
        this.caster.x = Math.min(stop, this.dashFrom + s.dash.distance * k);
        this.caster.z = (s.dash.lift ?? 0) * Math.sin(Math.PI * k);
      }
      if (el >= T.startup + T.active + T.recovery) {
        this.caster.z = 0;
        if (s.chain && this.stage < s.chain.stages.length - 1) { this.stage++; this.cast(); }
        else { this.run = null; this.mode = 'recover'; this.modeT = 0; }
      }
    } else if (this.mode === 'recover' && this.modeT >= RECOVER_MS) { this.mode = 'idle'; this.modeT = 0; }
    const loopMs = Math.max(2600, this.runAt + 1300);
    if (!this.run && this.t > loopMs) this.restart();
    this.rt.update(step);
    this.fx.update(ms, this.rt.projectiles.map((e) => e.p));
    // Dummy reaction (preview only).
    const D = this.dum;
    if (D.z > 0 || D.vz > 0) { D.vz -= 1100 * step / 1000; D.z = Math.max(0, D.z + D.vz * step / 1000); if (D.z === 0) D.vz = 0; }
    if (D.flash >= 0) { D.flash += ms; if (D.flash > 140) D.flash = -1; }
    D.shake = Math.max(0, D.shake - ms);
    const jig = D.shake > 0 ? Math.sin(D.shake / 12) * 3 : 0;
    const oy = this.stageArea.oy + 40;
    this.dummy.setPosition(D.x + jig, oy - D.z).setDepth(oy + 0.5);
    if (D.flash >= 0 && D.flash < 60) this.dummy.setTintFill(0xffffff); else if (D.flash >= 0) this.dummy.setTint(0xff8a7a); else this.dummy.setTint(0x9aa3ad);
    const el = r ? this.t - this.runAt : 0;
    const snap: AnimSnap = {
      mode: this.mode, t: this.modeT, speed: 0, vz: 0,
      skill: r ? { id: s.id, stage: r.stage, elapsed: el, startup: r.timings.startup, active: r.timings.active, recovery: r.timings.recovery } : undefined,
    };
    const pose = resolvePose(this.cls, 'right', poseQuery(snap), this.view.wantsBase);
    this.view.render(ms, pose, this.caster.x, this.caster.y, this.caster.z, 0, 'right');
  }

  setVisible(v: boolean): void { this.view.setVisible(v); this.dummy.setVisible(v); if (!v) this.rt.cancelAttacker('pv'); else if (this.skill) this.restart(); }

  destroy(): void { this.rt.destroy(); this.fx.destroy(); this.view.destroy(); this.dummy.destroy(); }
}

// ----------------------------------------------------------------------------------------------- book

export class SkillBook {
  open = false;
  private root: HTMLDivElement;
  private bg: HTMLDivElement;
  private tabs: HTMLDivElement[] = [];
  private row: HTMLDivElement;
  private cards: { el: HTMLDivElement; i: number }[] = [];
  private det: HTMLDivElement;
  private cap: HTMLDivElement;
  private pv: HTMLDivElement;
  private video: HTMLVideoElement;
  private lastRect = '';
  private kit: FinalSkill[];
  private jobs: Job[];
  private job = 0;
  private selected = 0;
  private hover = -1;
  private stage: PreviewStage;
  private preview: SkillPreview;
  private shownClip = '';
  private badClips = new Set<string>();

  constructor(scene: Phaser.Scene, private host: HTMLElement, private canvas: HTMLCanvasElement, private cls: ClassKey, private level: number, private qaUnlockAll: boolean) {
    ensureStyles();
    this.kit = kitFor(cls);
    this.jobs = jobsFor(cls);
    this.root = document.createElement('div');
    this.root.className = 'gol-cs gol-sb';
    host.appendChild(this.root);
    this.bg = this.div('bg', this.root);
    const hdr = this.div('hdr', this.bg);
    this.div('ttl', hdr).textContent = `SKILL BOOK — ${(CLASS_NAMES[cls] ?? cls).toUpperCase()}`;
    const cur = this.jobs.filter((j) => qaUnlockAll || level >= j.level).pop() ?? this.jobs[0];
    this.div('sub', hdr).textContent = qaUnlockAll ? `QA build · all job advancements unlocked · level ${level}` : `Level ${level} · ${cur.name} — skills unlock with each job advancement`;
    const x = document.createElement('button'); x.className = 'x'; x.title = 'Close (K / Esc)';
    x.addEventListener('click', () => this.close()); this.bg.appendChild(x);
    this.jobs.forEach((j, k) => {
      const t = this.div('tab', this.bg); t.style.left = `${TAB_X[k]}px`;
      t.innerHTML = '<div class="em"></div><b></b><span></span><div class="lv"></div>';
      (t.children[1] as HTMLElement).textContent = j.name.toUpperCase();
      (t.children[2] as HTMLElement).textContent = `${ADV_LABEL[k]} · Lv ${j.level}–${j.to}`;
      (t.children[3] as HTMLElement).textContent = String(j.level);
      if (!this.jobOpen(k)) t.classList.add('lk');
      t.addEventListener('click', () => { this.job = k; this.selected = Math.max(0, this.kit.findIndex((s) => s.slot === j.slots[0])); this.buildRow(); this.refresh(); });
      this.tabs.push(t);
    });
    this.row = this.div('row', this.bg);
    this.cap = this.div('pcap', this.root); // outside .bg: the window has a hole over the live preview
    this.pv = this.div('pv', this.bg);
    this.video = document.createElement('video');
    this.video.muted = true; this.video.loop = true; this.video.playsInline = true; this.video.autoplay = true;
    this.pv.appendChild(this.video);
    this.det = this.div('det', this.bg);
    this.stage = new PreviewStage(scene, { x: BG.x + PREVIEW.x, y: BG.y + PREVIEW.y, w: PREVIEW.w, h: PREVIEW.h }, -30000, 30000, 0.88, 'ui-sb-preview');
    this.preview = new SkillPreview(scene, this.stage, cls);
    this.preview.setVisible(false);
    this.job = Math.max(0, this.jobs.indexOf(cur));
    this.selected = Math.max(0, this.kit.findIndex((s) => s.slot === this.jobs[this.job].slots[0]));
    this.buildRow();
    this.refresh();
  }

  private div(cls: string, parent: HTMLElement): HTMLDivElement { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }

  private jobOpen(k: number): boolean { return this.qaUnlockAll || this.level >= this.jobs[k].level; }
  private jobIndexOf(s: FinalSkill): number { return Math.max(0, this.jobs.findIndex((j) => j.slots.includes(s.slot))); }
  unlocked(s: FinalSkill): boolean { return this.jobOpen(this.jobIndexOf(s)); }

  private buildRow(): void {
    this.row.innerHTML = ''; this.cards = [];
    this.jobs[this.job].slots.forEach((slot, n) => {
      const i = this.kit.findIndex((s) => s.slot === slot); if (i < 0 || n >= FRAME_CX.length) return;
      const s = this.kit[i], c = this.div('card', this.row); c.style.left = `${FRAME_CX[n]}px`;
      const img = document.createElement('img'); img.src = iconUrl(s); img.alt = ''; img.draggable = false; c.appendChild(img);
      this.div('hk', c).textContent = HOTKEY[s.slot];
      this.div('nm', c).textContent = s.name;
      c.addEventListener('mouseenter', () => { this.hover = i; this.refresh(); });
      c.addEventListener('mouseleave', () => { if (this.hover === i) { this.hover = -1; this.refresh(); } });
      c.addEventListener('click', () => { this.selected = i; this.refresh(); });
      this.cards.push({ el: c, i });
    });
  }

  /** Equip the preview body with the character's cosmetics (book preview = this character). */
  setEquipped(e: Parameters<ActorView['setEquipped']>[0]): void { this.preview.setEquipped(e); }

  private refresh(): void {
    const show = this.hover >= 0 ? this.hover : this.selected;
    this.tabs.forEach((t, k) => { const on = k === this.job; t.classList.toggle('on', on); (t.firstChild as HTMLElement).style.backgroundImage = `url("${K(`job${k}_icon`)}")`; (t.firstChild as HTMLElement).style.filter = on ? 'drop-shadow(0 0 6px rgba(255,200,90,.8))' : ''; });
    for (const c of this.cards) { c.el.classList.toggle('sel', c.i === this.selected); c.el.classList.toggle('lk', !this.unlocked(this.kit[c.i])); }
    const s = this.kit[show], jk = this.jobIndexOf(s), job = this.jobs[jk];
    this.cap.textContent = `SKILL PREVIEW — ${s.name.toUpperCase()}`;
    const roles = s.roles.map((r) => ROLE_LABEL[r] ?? r);
    const use = s.ground && s.air ? 'Ground and air' : s.air ? 'Air only' : 'Ground only';
    const cd = s.cooldown > 0 ? `${(s.cooldown / 1000).toFixed(s.cooldown % 1000 ? 1 : 0)} s` : 'None (chain)';
    const lock = this.unlocked(s) ? `Unlocked · key ${HOTKEY[s.slot]}` : `<span class="lock">Unlocks with ${ADV_LABEL[jk]} (${job.name}) · Lv ${job.level}</span>`;
    this.det.innerHTML = `<div class="hd"><img alt=""><div><div class="tier"></div><div class="nm"></div></div></div>
      <div class="body"><div class="roles"></div><div class="ds"></div>
      <table><tr><td>Targeting</td><td class="tg"></td></tr><tr><td>Cooldown</td><td class="cd"></td></tr>
      <tr><td>Use</td><td class="us"></td></tr><tr><td>Unlock</td><td class="ul"></td></tr></table><div class="rel"></div></div>`;
    const q = (c: string) => this.det.querySelector(c) as HTMLElement;
    (q('img') as HTMLImageElement).src = iconUrl(s);
    q('.tier').textContent = tierName(s, job, jk); q('.nm').textContent = s.name;
    q('.roles').innerHTML = roles.map(() => '<i></i>').join('');
    q('.roles').querySelectorAll('i').forEach((el, i) => { el.textContent = roles[i]; });
    q('.ds').textContent = s.description;
    q('.tg').textContent = TARGETING[s.targeting]; q('.cd').textContent = cd; q('.us').textContent = use; q('.ul').innerHTML = lock;
    const rel = q('.rel');
    for (const r of s.relations.slice(0, 2)) { const d = document.createElement('div'); d.textContent = r; rel.appendChild(d); }
    if (this.open) this.showPreview(s);
  }

  private showPreview(s: FinalSkill): void {
    const clip = this.cls === 'warrior' && CLIPS.has(s.id) && !this.badClips.has(s.id);
    this.pv.style.display = clip ? 'block' : 'none';
    this.stage.setVisible(!clip); this.preview.setVisible(!clip);
    // the live Phaser preview renders under the DOM window, so the window art gets a hole for it; the <video> lives
    // inside the window and would be masked by that hole, so the hole only exists while the live preview is shown
    if (clip) { for (const pre of ['', '-webkit-']) this.bg.style.removeProperty(`${pre}mask-image`); } else holeMask(this.bg, PREVIEW);
    if (clip) {
      if (this.shownClip !== s.id) {
        this.shownClip = s.id; this.video.src = clipUrl(s.id); void this.video.play().catch(() => undefined);
        // a missing / broken clip falls back to the live preview instead of a black box
        this.video.onerror = () => { if (this.shownClip === s.id) { this.badClips.add(s.id); this.showPreview(s); } };
      }
    } else { this.shownClip = ''; this.video.onerror = null; this.video.removeAttribute('src'); this.preview.show(s); }
  }

  toggle(): void { if (this.open) this.close(); else this.show(); }

  private show(): void {
    this.open = true;
    this.root.classList.add('open');
    this.hover = -1; this.refresh();
    this.layout();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('open');
    this.stage.setVisible(false); this.preview.setVisible(false); this.video.pause(); this.shownClip = '';
  }

  layout(): void { if (this.open) this.lastRect = syncOverlay(this.root, this.host, this.canvas, this.lastRect); }

  update(ms: number): void { if (this.open && !this.shownClip) this.preview.update(ms); }

  /** QA: which skill the preview / detail currently shows. */
  get shownSkill(): string { return this.kit[this.hover >= 0 ? this.hover : this.selected].id; }
  select(slot: number): void { const i = this.kit.findIndex((s) => s.slot === slot); if (i >= 0) { this.job = this.jobIndexOf(this.kit[i]); this.selected = i; this.buildRow(); this.refresh(); } }

  destroy(): void { this.preview.destroy(); this.stage.destroy(); this.root.remove(); }
}
