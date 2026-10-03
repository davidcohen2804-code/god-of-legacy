// Skill Book (K): the class's 8 final skills as a tree on the supplied book art — root (Space) at the bottom, branches
// upward, Signature / Ultimate at the branch tips. Hover/select shows the detail card and a live Phaser preview that
// replays the real runtime cast (body sheet pose + SkillRuntime/SkillFx VFX) on a neutral dummy in a 2–3 s loop.
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

const A = (f: string) => `assets/final/ui/skill_book/${f}.png`;
const BG = { x: 210, y: 90, w: 1500, h: 900 };
/** Supplied background branch lines (bg px): root and the three tips. */
const ROOT = { x: 750, y: 842 }, TIPS = { l: { x: 350, y: 180 }, c: { x: 750, y: 180 }, r: { x: 1150, y: 180 } };
const along = (tip: { x: number; y: number }, t: number) => ({ x: ROOT.x + (tip.x - ROOT.x) * t, y: ROOT.y + (tip.y - ROOT.y) * t });
/** Node centres per slot (0 = Space root … 6 = Signature tip, 7 = Ultimate tip). */
const NODE: { x: number; y: number }[] = [
  along(TIPS.c, 0.07), along(TIPS.l, 0.36), along(TIPS.r, 0.36), along(TIPS.l, 0.68),
  along(TIPS.c, 0.5), along(TIPS.r, 0.68), along(TIPS.l, 1), along(TIPS.r, 1),
];
/** Prerequisite edges (drawn along the book's branches). */
const EDGES: [number, number][] = [[0, 1], [0, 2], [0, 4], [1, 3], [3, 6], [2, 5], [5, 7]];
const PREVIEW: Rect = { x: 40, y: 512, w: 440, h: 280 };
const DETAIL: Rect = { x: 1036, y: 490, w: 430, h: 384 };
const HOTKEY = ['SPACE', '1', '2', '3', '4', '5', '6', '7'];
const NODE_SIZE = 96;

const ROLE_LABEL: Partial<Record<Role, string>> = {
  basic: 'Basic', opener: 'Opener', gapClose: 'Gap Close', launcher: 'Launcher', extender: 'Extender', airExtender: 'Air Extender',
  knockdown: 'Knockdown', antiAir: 'Anti-Air', confirm: 'Confirm', peel: 'Peel', setup: 'Setup', hardCC: 'Hard CC', zone: 'Zone',
  pull: 'Pull', projectile: 'Projectile', precision: 'Precision', trap: 'Trap', mobility: 'Mobility', chase: 'Chase', counter: 'Counter',
  escape: 'Escape', finisher: 'Finisher', signature: 'Signature', ultimate: 'Ultimate',
};
const TARGETING: Record<Targeting, string> = {
  aimAssist: 'Facing snaps toward the mouse', mouseDir: 'Dash toward the mouse', mouseProjectile: 'Projectile along the mouse angle',
  mouseLine: 'Line toward the mouse', mouseCone: 'Cone toward the mouse', mouseGround: 'Ground point at the mouse',
  mouseTarget: 'First target along the mouse line', self: 'Around the caster', selfAim: 'Around the caster, biased to the mouse',
};

const STYLE_ID = 'gol-skillbook-style';
const CSS = `
.gol-sb{z-index:40;display:none}
.gol-sb.open{display:block}
.gol-sb .bg{position:absolute;left:${BG.x}px;top:${BG.y}px;width:${BG.w}px;height:${BG.h}px;background:url("${A('skillbook_background')}") 0 0/100% 100%;
  pointer-events:auto;animation:golSbIn 220ms ease-out}
@keyframes golSbIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
.gol-sb .ttl{position:absolute;left:46px;top:30px;font-size:34px;font-weight:700;letter-spacing:3px;color:#f0d9a6;text-shadow:0 2px 6px #000}
.gol-sb .sub{position:absolute;left:48px;top:78px;font-size:16px;letter-spacing:1px;color:#b9c6d3}
.gol-sb .x{position:absolute;right:28px;top:24px;width:44px;height:44px;border-radius:8px;border:2px solid #c99a45;background:#0d151f;color:#f0d9a6;
  font:700 22px ${FONT_FAMILY};cursor:pointer;pointer-events:auto;transition:transform 120ms,filter 120ms}
.gol-sb .x:hover{filter:brightness(1.3);transform:scale(1.04)}
.gol-sb .br{position:absolute;height:10px;transform-origin:0 50%;background:url("${A('branch_locked')}") 0 50%/100% 100%;pointer-events:none}
.gol-sb .br.on{background-image:url("${A('branch_unlocked')}");filter:drop-shadow(0 0 6px rgba(240,190,90,.65))}
.gol-sb .node{position:absolute;width:${NODE_SIZE}px;height:${NODE_SIZE}px;background:url("${A('node_locked')}") 0 0/100% 100%;cursor:pointer;
  transition:transform 120ms ease-out,filter 120ms ease-out}
.gol-sb .node.un{background-image:url("${A('node_unlocked')}")}
.gol-sb .node.sel{background-image:url("${A('node_selected')}");transform:scale(1.06);filter:drop-shadow(0 0 12px rgba(110,190,255,.7))}
.gol-sb .node:hover{transform:scale(1.04);filter:brightness(1.18)}
.gol-sb .node img{position:absolute;left:18px;top:18px;width:60px;height:60px;border-radius:8px;pointer-events:none}
.gol-sb .node:not(.un) img{filter:grayscale(1) brightness(.45)}
.gol-sb .node .lock{position:absolute;left:0;right:0;top:34px;text-align:center;font-size:20px;color:#c8ccd2;text-shadow:0 1px 3px #000}
.gol-sb .node .hk{position:absolute;right:-6px;top:-6px;min-width:26px;height:22px;padding:0 5px;border-radius:5px;background:#0b121b;border:1px solid #c99a45;
  font:700 12px/20px ${FONT_FAMILY};color:#f0d9a6;text-align:center}
.gol-sb .node.ult .hk,.gol-sb .node.sig .hk{border-color:#e8b25a;background:#2a1606}
.gol-sb .lbl{position:absolute;width:200px;margin-left:-100px;text-align:center;pointer-events:none;text-shadow:0 1px 3px #000,0 0 6px #000}
.gol-sb .lbl b{display:block;font-size:16px;color:#f3e2bf;letter-spacing:.5px;white-space:nowrap}
.gol-sb .lbl span{display:block;font-size:12px;color:#9fb0c0;letter-spacing:.5px;white-space:nowrap}
.gol-sb .lbl.lk b{color:#8c939b}
.gol-sb .pcap{position:absolute;left:${PREVIEW.x}px;top:${PREVIEW.y - 30}px;width:${PREVIEW.w}px;font-size:13px;letter-spacing:2px;color:#9fc6e8}
.gol-sb .det{position:absolute;left:${DETAIL.x}px;top:${DETAIL.y}px;width:${DETAIL.w}px;height:${DETAIL.h}px;background:url("${A('tooltip_panel')}") 0 0/100% 100%;
  padding:22px 26px;color:#dfe6ee;font-family:Georgia,serif}
.gol-sb .det .hd{display:flex;gap:14px;align-items:center}
.gol-sb .det .hd img{width:64px;height:64px;border-radius:8px;border:1px solid #6a5630}
.gol-sb .det .nm{font:700 22px ${FONT_FAMILY};color:#f3e2bf}
.gol-sb .det .tier{font:700 12px ${FONT_FAMILY};letter-spacing:2px;color:#e8b25a}
.gol-sb .det .roles{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap}
.gol-sb .det .roles i{font-style:normal;font-size:12px;padding:2px 8px;border-radius:10px;background:#1b2a3a;border:1px solid #3d5a78;color:#bcd6ef}
.gol-sb .det .ds{margin-top:10px;font-size:15px;line-height:1.35;color:#e4e9ef;min-height:40px}
.gol-sb .det table{margin-top:8px;border-collapse:collapse;width:100%;font-size:14px}
.gol-sb .det td{padding:3px 0;vertical-align:top}
.gol-sb .det td:first-child{width:118px;color:#9fb0c0}
.gol-sb .det .rel{margin-top:6px;font-size:14px;color:#f0d9a6}
.gol-sb .det .rel div:before{content:'\\2192  ';color:#c99a45}
.gol-sb .det .lock{color:#ff9a7a}
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
}

const tierName = (s: FinalSkill) => (s.slot === 7 ? 'ULTIMATE' : s.slot === 6 ? 'SIGNATURE' : s.slot === 0 ? 'BASIC ATTACK' : 'CORE SKILL');

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
    const pose = resolvePose(this.cls, 'right', poseQuery(snap));
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
  private nodes: HTMLDivElement[] = [];
  private branches: HTMLDivElement[] = [];
  private det: HTMLDivElement;
  private cap: HTMLDivElement;
  private lastRect = '';
  private kit: FinalSkill[];
  private selected = 0;
  private hover = -1;
  private stage: PreviewStage;
  private preview: SkillPreview;

  constructor(scene: Phaser.Scene, private host: HTMLElement, private canvas: HTMLCanvasElement, cls: ClassKey, private level: number, private qaUnlockAll: boolean) {
    ensureStyles();
    this.kit = kitFor(cls);
    this.root = document.createElement('div');
    this.root.className = 'gol-cs gol-sb';
    host.appendChild(this.root);
    this.bg = this.div('bg', this.root);
    holeMask(this.bg, PREVIEW);
    this.div('ttl', this.bg).textContent = `SKILL BOOK — ${(CLASS_NAMES[cls] ?? cls).toUpperCase()}`;
    this.div('sub', this.bg).textContent = qaUnlockAll ? `QA build · all skills unlocked · level ${level}` : `Level ${level} · all 8 skills equipped on SPACE / 1–7`;
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.title = 'Close (K / Esc)';
    x.addEventListener('click', () => this.close()); this.bg.appendChild(x);
    for (const [a, b] of EDGES) {
      const el = this.div('br', this.bg), p = NODE[a], q = NODE[b];
      const r = NODE_SIZE / 2 - 4, dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
      el.style.left = `${p.x + (dx / len) * r}px`; el.style.top = `${p.y + (dy / len) * r - 5}px`;
      el.style.width = `${len - 2 * r}px`; el.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      el.dataset.a = String(a); el.dataset.b = String(b);
      this.branches.push(el);
    }
    this.kit.forEach((s, i) => {
      const p = NODE[s.slot];
      const n = this.div('node', this.bg);
      n.style.left = `${p.x - NODE_SIZE / 2}px`; n.style.top = `${p.y - NODE_SIZE / 2}px`;
      if (s.slot === 6) n.classList.add('sig'); if (s.slot === 7) n.classList.add('ult');
      const img = document.createElement('img'); img.src = iconUrl(s); img.alt = ''; img.draggable = false; n.appendChild(img);
      const hk = this.div('hk', n); hk.textContent = HOTKEY[s.slot];
      if (!this.unlocked(s)) this.div('lock', n).textContent = '🔒';
      n.addEventListener('mouseenter', () => { this.hover = i; this.refresh(); });
      n.addEventListener('mouseleave', () => { if (this.hover === i) { this.hover = -1; this.refresh(); } });
      n.addEventListener('click', () => { this.selected = i; this.refresh(); });
      this.nodes.push(n);
      const lbl = this.div('lbl', this.bg);
      lbl.style.left = `${p.x}px`; lbl.style.top = `${p.y + NODE_SIZE / 2 + 4}px`;
      const role = ROLE_LABEL[s.roles.find((r) => r !== 'basic' && r !== 'signature' && r !== 'ultimate') ?? s.roles[0]] ?? '';
      lbl.innerHTML = `<b></b><span></span>`;
      (lbl.firstChild as HTMLElement).textContent = s.name;
      (lbl.lastChild as HTMLElement).textContent = `${role} · Lv ${s.unlockLevel}`;
      if (!this.unlocked(s)) lbl.classList.add('lk');
    });
    this.cap = this.div('pcap', this.bg);
    this.det = this.div('det', this.bg);
    // Preview viewport in design px == game px (Scale.FIT with a 1920×1080 game).
    this.stage = new PreviewStage(scene, { x: BG.x + PREVIEW.x, y: BG.y + PREVIEW.y, w: PREVIEW.w, h: PREVIEW.h }, -30000, 30000, 1.18, 'ui-sb-preview');
    this.preview = new SkillPreview(scene, this.stage, cls);
    this.preview.setVisible(false);
    this.refresh();
  }

  private div(cls: string, parent: HTMLElement): HTMLDivElement { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; }

  unlocked(s: FinalSkill): boolean { return this.qaUnlockAll || this.level >= s.unlockLevel; }

  /** Equip the preview body with the character's cosmetics (book preview = this character). */
  setEquipped(e: Parameters<ActorView['setEquipped']>[0]): void { this.preview.setEquipped(e); }

  private refresh(): void {
    const show = this.hover >= 0 ? this.hover : this.selected;
    this.nodes.forEach((n, i) => {
      n.classList.toggle('un', this.unlocked(this.kit[i]));
      n.classList.toggle('sel', i === this.selected);
    });
    for (const b of this.branches) {
      const a = this.kit.find((s) => s.slot === Number(b.dataset.a)), c = this.kit.find((s) => s.slot === Number(b.dataset.b));
      b.classList.toggle('on', !!a && !!c && this.unlocked(a) && this.unlocked(c));
    }
    const s = this.kit[show];
    this.cap.textContent = `LIVE PREVIEW — ${s.name.toUpperCase()}`;
    const roles = s.roles.map((r) => ROLE_LABEL[r] ?? r);
    const use = s.ground && s.air ? 'Ground and air' : s.air ? 'Air only' : 'Ground only';
    const cd = s.cooldown > 0 ? `${(s.cooldown / 1000).toFixed(s.cooldown % 1000 ? 1 : 0)} s` : 'None (chain)';
    const lock = this.unlocked(s) ? `Unlocked · key ${HOTKEY[s.slot]}` : `<span class="lock">Unlocks at level ${s.unlockLevel}</span>`;
    this.det.innerHTML = `<div class="hd"><img alt=""><div><div class="tier"></div><div class="nm"></div></div></div>
      <div class="roles"></div><div class="ds"></div>
      <table><tr><td>Targeting</td><td class="tg"></td></tr><tr><td>Cooldown</td><td class="cd"></td></tr>
      <tr><td>Use</td><td class="us"></td></tr><tr><td>Unlock</td><td class="ul"></td></tr></table><div class="rel"></div>`;
    const q = (c: string) => this.det.querySelector(c) as HTMLElement;
    (q('img') as HTMLImageElement).src = iconUrl(s);
    q('.tier').textContent = tierName(s); q('.nm').textContent = s.name;
    q('.roles').innerHTML = roles.map(() => '<i></i>').join('');
    q('.roles').querySelectorAll('i').forEach((el, i) => { el.textContent = roles[i]; });
    q('.ds').textContent = s.description;
    q('.tg').textContent = TARGETING[s.targeting]; q('.cd').textContent = cd; q('.us').textContent = use; q('.ul').innerHTML = lock;
    const rel = q('.rel');
    for (const r of s.relations.slice(0, 4)) { const d = document.createElement('div'); d.textContent = r; rel.appendChild(d); }
    if (this.open) this.preview.show(s);
  }

  toggle(): void { if (this.open) this.close(); else this.show(); }

  private show(): void {
    this.open = true;
    this.root.classList.add('open');
    this.stage.setVisible(true); this.preview.setVisible(true);
    this.hover = -1; this.refresh();
    this.layout();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('open');
    this.stage.setVisible(false); this.preview.setVisible(false);
  }

  layout(): void { if (this.open) this.lastRect = syncOverlay(this.root, this.host, this.canvas, this.lastRect); }

  update(ms: number): void { if (this.open) this.preview.update(ms); }

  /** QA: which skill the preview / detail currently shows. */
  get shownSkill(): string { return this.kit[this.hover >= 0 ? this.hover : this.selected].id; }
  select(slot: number): void { const i = this.kit.findIndex((s) => s.slot === slot); if (i >= 0) { this.selected = i; this.refresh(); } }

  destroy(): void { this.preview.destroy(); this.stage.destroy(); this.root.remove(); }
}
