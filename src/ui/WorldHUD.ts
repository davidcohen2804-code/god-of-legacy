// In-game HUD (DOM overlay, 1920x1080 design pixels scaled to the displayed game rect by syncOverlay).
// Panels: player status, contextual target, 8 action slots, north-up minimap, PvP room chip,
// plus hooks (effects, combat feedback) that stay hidden until the game supplies real data.
import { FONT_FAMILY, HUD as H, PVP } from '../config/layout';
import { ensureCharacterUIStyles, syncOverlay } from './CharacterSelectUI';
import { HudEffect, HudSlot, HudState, PortraitRef } from './hud/HudState';

const A = (f: string) => `${H.path}/${f}.png`;
const P = H.palette;
const STYLE_ID = 'gol-hud-style';
const nine = (file: string, n: number) => `border-style:solid;border-width:${n}px;border-image:url("${A(file)}") ${n} fill / ${n}px stretch`;

const CSS = `
.gol-hud{color:${P.text};font-family:${H.bodyFont}}
.gol-hud .pn{position:absolute;pointer-events:none}
.gol-hud .h{font-family:${FONT_FAMILY};font-weight:700;letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 1px 2px #000}
.gol-hud .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px #000}
.gol-hud .player{${nine('player-frame', 16)}}
.gol-hud .target{${nine('target-frame', 16)}}
.gol-hud .mm{${nine('minimap-frame', 16)}}
.gol-hud .room{${nine('pvp-frame', 16)}}
.gol-hud .tray{${nine('skill-tray', 16)}}
.gol-hud .combat{${nine('combat-frame', 16)}}
.gol-hud .pf{position:absolute;${nine('portrait-frame', 10)}}
.gol-hud .pf .img{position:absolute;inset:-4px;background-repeat:no-repeat;border-radius:2px}
.gol-hud .bar{position:absolute;${nine('bar-track', 5)}}
.gol-hud .bar .fill{position:absolute;left:-2px;top:-2px;bottom:-2px;overflow:hidden;transition:width ${H.barEaseMs}ms ease-out}
.gol-hud .bar .fill img{position:absolute;left:0;top:0;height:100%}
.gol-hud .bar .val{position:absolute;inset:-5px 0 -5px 0;display:flex;align-items:center;justify-content:center;
  font-size:18px;font-weight:600;text-shadow:0 1px 2px #000,0 0 3px #000}
.gol-hud .aslot{position:absolute;padding:0;border:0;background:transparent;background-size:100% 100%;pointer-events:auto;cursor:pointer;
  font:inherit;color:inherit;outline:none}
.gol-hud .aslot:focus-visible{box-shadow:0 0 0 2px ${P.text}}
.gol-hud .aslot[aria-disabled=true]{cursor:default}
.gol-hud .aslot .ic{position:absolute;left:8px;top:8px;width:48px;height:48px}
.gol-hud .aslot.off .ic{opacity:.45;filter:grayscale(1)}
.gol-hud .aslot .cd{position:absolute;inset:6px;border-radius:50%;display:none;align-items:center;justify-content:center;
  font-size:20px;font-weight:700;text-shadow:0 1px 2px #000}
.gol-hud .key{position:absolute;width:64px;text-align:center;font-size:18px;color:${P.secondary};text-shadow:0 1px 2px #000}
.gol-hud .fx{position:absolute;display:flex;gap:6px}
.gol-hud .fx .e{position:relative;${nine('effect-slot', 8)}}
.gol-hud .fx .e img{position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px)}
.gol-hud .fx .e.bad{filter:hue-rotate(-30deg) saturate(1.4)}
.gol-hud .fx .more{font-size:18px;align-self:center}
.gol-hud .mm .view{position:absolute;overflow:hidden}
.gol-hud .mm .view img.bg{position:absolute}
.gol-hud .mm .mk{position:absolute;width:${H.minimap.marker}px;height:${H.minimap.marker}px;margin:-${H.minimap.marker / 2}px 0 0 -${H.minimap.marker / 2}px}
.gol-hud .mm .na{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;color:${P.secondary};opacity:.7}
.gol-hud.compact .room .n2,.gol-hud.compact .combat{display:none!important}
@media (prefers-reduced-motion:reduce){.gol-hud .bar .fill{transition:none}}
.gol-hud .aslot .trim{position:absolute;left:-8px;top:-8px;width:80px;height:80px;pointer-events:none}
.gol-hud .aslot .upulse{position:absolute;left:-48px;top:-48px;width:160px;height:160px;pointer-events:none;mix-blend-mode:screen;
  background:url("assets/final/ui/hud/ultimate_ready_pulse.png") 0 0/1280px 160px;animation:golUlt 0.9s steps(8) infinite;display:none}
.gol-hud .aslot.ult-ready .upulse{display:block}
@keyframes golUlt{to{background-position:-1280px 0}}
.gol-hud .combo{position:absolute;left:1560px;top:480px;width:300px;height:96px;background:url("assets/final/ui/hud/combo_frame.png") 0 0/100% 100%;
  pointer-events:none;transition:opacity .18s}
.gol-hud .combo .n{position:absolute;left:-40px;right:-40px;top:2px;text-align:center;font-family:${FONT_FAMILY};font-weight:700;font-style:italic;font-size:54px;color:#ffe2a0;
  text-shadow:0 2px 0 #3a1406,0 0 12px rgba(255,160,60,.6)}
.gol-hud .combo .n small{font-size:24px;margin-left:8px;color:#f3d9a5}
.gol-hud .combo .l{position:absolute;left:-40px;right:-40px;top:64px;text-align:center;font-size:17px;letter-spacing:2px;color:#9fe8ff;font-weight:700;font-style:italic;text-shadow:0 2px 0 #06141c}
.gol-hud .combo .pulse{position:absolute;left:-40px;top:-16px;width:380px;height:128px;mix-blend-mode:screen;opacity:0;
  background:url("assets/final/ui/hud/combo_pulse.png") 0 0/3040px 128px}
.gol-hud .combo.bump .pulse{animation:golPulse .32s steps(8) 1}
@keyframes golPulse{0%{opacity:1;background-position:0 0}100%{opacity:0;background-position:-3040px 0}}
.gol-hud .banner{position:absolute;left:560px;top:300px;width:800px;height:110px;display:none;align-items:center;justify-content:center;
  font-family:${FONT_FAMILY};font-weight:700;font-size:64px;letter-spacing:10px;color:#f0c27a;text-shadow:0 3px 0 #2a0a04,0 0 24px rgba(200,40,20,.7);
  background:radial-gradient(ellipse at center,rgba(40,6,4,.75) 0%,rgba(40,6,4,0) 70%)}
.gol-hud .banner small{display:block;font-size:22px;letter-spacing:4px;color:#e9d9b8;margin-top:4px}
.gol-hud .menu{position:absolute;left:1700px;top:330px;width:192px;display:flex;flex-direction:column;gap:6px;pointer-events:auto}
.gol-hud .menu button{height:34px;border:1px solid #6d5a33;background:linear-gradient(#1b2230,#0d131b);color:#efddb0;font:600 16px ${FONT_FAMILY};
  letter-spacing:1px;cursor:pointer;border-radius:3px;transition:transform .12s, box-shadow .12s}
.gol-hud .menu button:hover{transform:scale(1.02);box-shadow:0 0 10px rgba(232,180,95,.45)}
.gol-hud .menu button:active{transform:scale(.985)}
.gol-hud .menu button b{color:#e8b45f;margin-right:8px}
`;

interface Bar { root: HTMLDivElement; fill: HTMLDivElement; img: HTMLImageElement; val?: HTMLSpanElement; w: number; last: string }
interface SlotEl { btn: HTMLButtonElement; icon: HTMLImageElement; cd: HTMLDivElement; trim: HTMLImageElement; last: string; slot?: HudSlot }

export interface WorldHUDOptions {
  returnLabel: string;
  onReturn: () => void;
  /** Click on a slot: the same action handler as its hotkey (scene validates; never a second Space attack). */
  onSlot: (index: number) => void;
  /** Skill Book (K) / Inventory (I) / Cosmetic Shop (O) toggles. */
  onMenu?: (key: 'K' | 'I' | 'O') => void;
}

export class WorldHUD {
  private root: HTMLDivElement;
  private lastRect = '';
  private status?: HTMLDivElement;
  private els: Record<string, HTMLElement> = {};
  private hp!: Bar;
  private res!: Bar;
  private thp!: Bar;
  private slots: SlotEl[] = [];
  private tGauge: HTMLElement[] = [];
  private markers = new Map<string, HTMLImageElement>();
  private mmRect?: { x: number; y: number; w: number; h: number };
  private mmImage = '';
  private sinceMarkers = Infinity;
  private lastNow = 0;
  private cache = new Map<string, string>();

  constructor(private host: HTMLElement, private canvas: HTMLCanvasElement, private opts: WorldHUDOptions) {
    ensureCharacterUIStyles();
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement('style');
      st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
    }
    this.root = this.div('gol-cs gol-hud');
    host.appendChild(this.root);
    this.buildPlayer();
    this.buildTarget();
    this.buildMinimap();
    this.buildRoom();
    this.buildSkills();
    this.buildCombat();

    const btn = document.createElement('button');
    btn.className = 'btn abs';
    btn.type = 'button';
    btn.setAttribute('aria-label', opts.returnLabel);
    const label = document.createElement('span');
    label.textContent = opts.returnLabel;
    btn.appendChild(label);
    btn.style.fontSize = `${H.back.size}px`;
    this.box(btn, H.back);
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep keyboard focus on the game
    btn.addEventListener('keyup', (e) => { if (e.key === ' ') e.preventDefault(); }); // Space belongs to the game, not this button
    btn.addEventListener('click', () => opts.onReturn());
    this.root.appendChild(btn);
    this.layout();
  }

  // ------------------------------------------------------------------ build

  private buildPlayer(): void {
    const p = this.panel('player', H.player);
    const pf = this.div('pf', p); this.at(pf, 0, 8, 84, 96);
    this.els.portrait = this.div('img', pf);
    const name = this.div('h', p); this.at(name, 94, 4, 230, 34); name.style.fontSize = '26px';
    this.els.pName = name;
    const lv = this.div('t', p); this.at(lv, 324, 10, 66, 26); Object.assign(lv.style, { fontSize: '18px', textAlign: 'right', color: P.secondary });
    this.els.pLevel = lv;
    this.hp = this.bar(p, 94, 48, 300, 26, 'bar-hp', true);
    this.res = this.bar(p, 94, 84, 300, 26, 'bar-energy', true);
    this.res.root.style.display = 'none';
    this.els.pFx = this.div('fx', this.root); this.at(this.els.pFx, H.buffs.x, H.buffs.y, H.buffs.w, H.buffs.h);
  }

  private buildTarget(): void {
    const t = this.panel('target', H.target);
    t.style.display = 'none';
    const pf = this.div('pf', t); this.at(pf, 0, 0, H.target.icon, H.target.icon); pf.style.borderWidth = '6px';
    this.els.tIconWrap = pf;
    this.els.tIcon = this.div('img', pf);
    this.els.tName = this.div('h', t); this.els.tName.style.fontSize = '24px';
    this.els.tType = this.div('t', t); Object.assign(this.els.tType.style, { fontSize: '18px', color: P.secondary });
    this.thp = this.bar(t, 0, 52, H.target.w - 32, 22, 'bar-hp', false);
    // Combat state chip + three combo-protection gauges (standing / air / down) under the HP bar.
    const chip = this.div('chip', t); Object.assign(chip.style, { position: 'absolute', right: '6px', top: '-4px', fontSize: '16px', fontWeight: '700', fontStyle: 'italic', letterSpacing: '1px', textShadow: '0 2px 0 #000' });
    this.els.tChip = chip;
    const gw = (H.target.w - 32 - 8) / 3;
    this.tGauge = (['#ff5a4a', '#5ab8ff', '#ffd25a'] as const).map((c, i) => {
      const bg = this.div('g', t); this.at(bg, i * (gw + 4), 78, gw, 6); Object.assign(bg.style, { background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.18)' });
      const f = this.div('gf', bg); Object.assign(f.style, { position: 'absolute', left: '0', top: '0', bottom: '0', width: '0%', background: c, boxShadow: `0 0 6px ${c}` });
      return f;
    });
    this.els.tFx = this.div('fx', this.root); this.at(this.els.tFx, H.target.x, H.target.y + H.target.effectsY, H.target.w, H.target.effectIcon);
  }

  private buildMinimap(): void {
    const m = this.panel('mm', H.minimap);
    const [l, t, r, b] = H.minimap.inset;
    const view = this.div('view', m); this.at(view, l - 16, t - 16, H.minimap.w - l - r, H.minimap.h - t - b);
    this.els.mmView = view;
    const label = this.div('h', m); this.at(label, -10, H.minimap.h - b - 12, H.minimap.w - 12, b - 8);
    // Georgia (manifest heading font) fits the full location name at the 12px minimum.
    Object.assign(label.style, { fontSize: '18px', textAlign: 'center', lineHeight: `${b - 8}px`, fontFamily: 'Georgia, serif', letterSpacing: '0.5px', fontWeight: '400' });
    this.els.mmLabel = label;
  }

  private buildRoom(): void {
    const r = this.panel('room', H.pvp);
    r.style.display = 'none';
    const n1 = this.div('t', r); this.at(n1, -4, -9, H.pvp.w - 24, 20); Object.assign(n1.style, { fontSize: '18px', fontWeight: '600', lineHeight: '20px' });
    const n2 = this.div('t n2', r); this.at(n2, -4, 10, H.pvp.w - 24, 20); Object.assign(n2.style, { fontSize: '18px', color: P.secondary, lineHeight: '20px' });
    this.els.roomLabel = n1; this.els.roomCount = n2;
  }

  private buildSkills(): void {
    const tray = this.panel('tray', H.skills);
    const S = H.skills;
    S.hotkeys.forEach((key, i) => {
      const x = S.inner[0] - 16 + i * (S.slot + S.gap), y = S.inner[1] - 16;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aslot';
      this.at(btn, x, y, S.slot, S.slot);
      const icon = document.createElement('img'); icon.className = 'ic'; icon.alt = ''; icon.draggable = false;
      const cd = this.div('cd', btn);
      btn.insertBefore(icon, cd);
      const trim = document.createElement('img'); trim.className = 'trim'; trim.alt = ''; trim.style.display = 'none'; btn.insertBefore(trim, icon);
      this.div('upulse', btn);
      btn.addEventListener('mousedown', (e) => e.preventDefault()); // no focus steal from the game
      btn.addEventListener('keyup', (e) => { if (e.key === ' ') e.preventDefault(); }); // Phaser owns Space: block the button's own Space click (no 2nd attack)
      const el: SlotEl = { btn, icon, cd, trim, last: '' };
      btn.addEventListener('click', () => { if (el.slot?.assigned && el.slot.enabled && !el.slot.busy) this.opts.onSlot(i); });
      tray.appendChild(btn);
      const k = this.div('key', tray); this.at(k, x, y + S.slot + 2, S.slot, 22); k.textContent = key === 'Space' ? 'SPACE' : key;
      this.slots.push(el);
    });
  }

  private buildCombat(): void {
    const c = this.panel('combat', H.combat);
    c.style.display = 'none';
    c.remove();
    const combo = this.div('combo', this.root); combo.style.display = 'none';
    const n = this.div('n', combo), l = this.div('l', combo);
    this.div('pulse', combo);
    this.els.combat = combo; this.els.cN = n; this.els.cL = l;
    const ban = this.div('banner', this.root); this.els.banner = ban;
    if (this.opts.onMenu) {
      const m = this.div('menu', this.root);
      for (const [k, label] of [['K', 'SKILL BOOK'], ['I', 'INVENTORY'], ['O', 'COSMETIC SHOP']] as const) {
        const b = document.createElement('button'); b.type = 'button';
        b.innerHTML = `<b>${k}</b>${label}`;
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => this.opts.onMenu?.(k));
        m.appendChild(b);
      }
    }
  }

  // ------------------------------------------------------------------ update

  /** `now` = adapter clock in ms (used for cooldown/feedback expiry). Writes the DOM only on change. */
  update(s: HudState, now: number, ms: number): void {
    this.lastNow = now;
    // Player
    const pl = s.player;
    this.text(this.els.pName, pl.name, 'pName');
    this.text(this.els.pLevel, `LV ${pl.level}`, 'pLevel');
    this.portrait(this.els.portrait, pl.portrait, 'pPortrait', 72);
    this.setBar(this.hp, pl.hp, pl.maxHp);
    if (pl.resource) { this.res.root.style.display = ''; this.res.img.src = A(pl.resource.kind === 'mp' ? 'bar-energy' : 'bar-energy'); this.setBar(this.res, pl.resource.value, pl.resource.max); }
    else this.res.root.style.display = 'none';
    this.effects(this.els.pFx, pl.effects, H.buffs.icon, now, 'pFx');

    // Target
    const t = s.target, tp = this.els.target;
    this.show(tp, !!t);
    if (t) {
      const hasIcon = !!t.portrait;
      this.show(this.els.tIconWrap, hasIcon);
      if (hasIcon) this.portrait(this.els.tIcon, t.portrait, 'tPortrait', 36);
      const lx = hasIcon ? H.target.icon + 10 : 2, lw = H.target.w - 32 - lx;
      if (this.changed('tLayout', String(lx))) { this.at(this.els.tName, lx, -6, lw, 32); this.at(this.els.tType, lx, 24, lw, 24); }
      this.text(this.els.tName, t.name, 'tName');
      this.text(this.els.tType, t.type, 'tType');
      this.setBar(this.thp, t.hp, t.maxHp);
      const st = t.state ?? '';
      if (this.changed('tChip', st)) { this.els.tChip.textContent = st; this.els.tChip.style.color = st === 'AERIAL' ? '#7fd0ff' : st === 'DOWN' ? '#ffd25a' : '#ff8a6a'; }
      const g = t.gauges;
      this.tGauge.forEach((f, i) => { const v = g ? [g.stand, g.air, g.down][i] : 0; f.style.width = `${Math.min(100, v * 100)}%`; f.style.opacity = v >= 1 ? '1' : '0.75'; });
      this.effects(this.els.tFx, t.effects, H.target.effectIcon, now, 'tFx');
    } else this.effects(this.els.tFx, [], H.target.effectIcon, now, 'tFx');

    // Slots
    s.slots.slice(0, this.slots.length).forEach((sl, i) => this.renderSlot(this.slots[i], sl, now));

    // Minimap (markers ~10Hz)
    this.sinceMarkers += ms;
    this.renderMinimap(s, this.sinceMarkers >= H.minimap.updateMs);
    if (this.sinceMarkers >= H.minimap.updateMs) this.sinceMarkers = 0;

    // PvP room chip
    this.show(this.els.room, !!s.room);
    if (s.room) {
      this.text(this.els.roomLabel, s.room.label, 'roomLabel');
      this.text(this.els.roomCount, `${s.room.playerCount}${s.room.maxPlayers ? ` / ${s.room.maxPlayers}` : ''} PLAYERS`, 'roomCount');
    }

    // Combo counter: confirmed hits only (shown from the 2nd hit, persists ~850ms after the last one).
    const f = s.combatFeedback && Number.isFinite(s.combatFeedback.expiresAtMs) && s.combatFeedback.expiresAtMs > now ? s.combatFeedback : null;
    this.show(this.els.combat, !!f);
    if (f) {
      if (this.changed('cN', String(f.count))) {
        this.els.cN.innerHTML = `${f.count}<small>HIT COMBO</small>`;
        this.els.combat.classList.remove('bump'); void this.els.combat.offsetWidth; this.els.combat.classList.add('bump');
      }
      this.text(this.els.cL, f.chain ?? '', 'cL');
      this.els.combat.style.opacity = String(Math.min(1, (f.expiresAtMs - now) / 180));
    } else this.changed('cN', '');
    if (this.bannerLeft > 0) { this.bannerLeft -= ms; if (this.bannerLeft <= 0) this.show(this.els.banner, false); else this.els.banner.querySelector('small')!.textContent = this.bannerSub(); }
  }

  private bannerLeft = 0;
  private bannerTotal = 0;
  private bannerSub(): string { return this.bannerTotal > 900 ? `RESPAWN IN ${Math.ceil(this.bannerLeft / 1000)}` : ''; }

  /** Short centre banner (defeat / KO); `ms` = how long it stays (respawn countdown shown when long enough). */
  banner(text: string, ms: number): void {
    this.bannerLeft = ms; this.bannerTotal = ms;
    this.els.banner.innerHTML = `<div style="text-align:center">${text}<small></small></div>`;
    this.els.banner.style.display = 'flex';
  }

  private renderSlot(el: SlotEl, s: HudSlot, now: number): void {
    el.slot = s;
    let rem = 0;
    const cd = s.cooldown;
    if (cd && Number.isFinite(cd.endTimeMs) && cd.durationMs > 0) rem = Math.min(cd.durationMs, Math.max(0, cd.endTimeMs - now));
    const disabled = !s.assigned || !s.enabled;
    const state = disabled ? 'disabled' : rem > 0 ? 'cooldown' : s.pressed ? 'pressed' : 'ready'; // manifest precedence
    const icon = s.iconUrl ?? (s.assigned ? A('icon-attack') : A('icon-lock'));
    const label = s.assigned ? s.label : 'Unassigned';
    const busy = !disabled && !!s.busy; // action lock / control: looks ready or cooling, but cannot execute
    const key = `${state}|${icon}|${label}|${s.hotkey}|${busy}|${s.tier ?? ''}`;
    if (key !== el.last) {
      el.trim.style.display = s.tier ? '' : 'none';
      if (s.tier) el.trim.src = `assets/final/ui/hud/${s.tier === 'ultimate' ? 'ultimate' : 'signature'}_slot_frame.png`;
      el.btn.classList.toggle('ult-ready', s.tier === 'ultimate' && state === 'ready');
      el.last = key;
      el.btn.style.backgroundImage = `url("${A(`slot-${state}`)}")`;
      el.btn.classList.toggle('off', disabled);
      el.icon.src = icon;
      el.btn.setAttribute('aria-disabled', String(disabled || busy));
      el.btn.setAttribute('aria-label', `${label} (${s.hotkey})${busy ? ' — Busy' : ''}`);
      el.btn.title = busy ? `${label} — Busy` : `${label} — ${s.hotkey}`;
    }
    if (rem > 0) {
      const pct = (rem / cd!.durationMs) * 100;
      el.cd.style.display = 'flex';
      el.cd.style.background = `conic-gradient(rgba(0,0,0,.62) 0 ${pct}%, transparent ${pct}% 100%)`;
      el.cd.textContent = String(Math.ceil(rem / 1000)); // ceil(seconds); 0 => ready
    } else if (el.cd.style.display !== 'none') el.cd.style.display = 'none';
  }

  private renderMinimap(s: HudState, markersDue: boolean): void {
    const m = s.minimap, view = this.els.mmView;
    this.text(this.els.mmLabel, m?.label ?? '', 'mmLabel');
    const [l, t, r, b] = H.minimap.inset;
    const vw = H.minimap.w - l - r, vh = H.minimap.h - t - b;
    if (!m || !(m.bounds.width > 0 && m.bounds.height > 0)) { this.mapUnavailable(); return; }
    if (m.imageUrl !== this.mmImage) {
      this.mmImage = m.imageUrl ?? '';
      view.replaceChildren(); this.markers.clear();
      // Same contain transform for background and markers.
      const k = Math.min(vw / m.bounds.width, vh / m.bounds.height);
      const w = m.bounds.width * k, h = m.bounds.height * k;
      this.mmRect = { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
      if (m.imageUrl) {
        const img = document.createElement('img');
        img.className = 'bg'; img.alt = ''; img.draggable = false;
        img.onerror = () => this.mapUnavailable();
        img.src = m.imageUrl;
        this.at(img, this.mmRect.x, this.mmRect.y, w, h);
        view.appendChild(img);
      }
    }
    if (!markersDue || !this.mmRect) return;
    const R = this.mmRect, seen = new Set<string>();
    for (const mk of m.markers) {
      if (!Number.isFinite(mk.x) || !Number.isFinite(mk.y)) continue;
      const u = (mk.x - m.bounds.minX) / m.bounds.width, v = (mk.y - m.bounds.minY) / m.bounds.height;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue; // out of bounds: hidden
      seen.add(mk.id);
      let el = this.markers.get(mk.id);
      if (!el) {
        el = document.createElement('img');
        el.className = 'mk'; el.alt = ''; el.draggable = false;
        el.src = A(`marker-${mk.kind}`);
        el.style.zIndex = mk.kind === 'player' ? '3' : '2';
        view.appendChild(el);
        this.markers.set(mk.id, el);
      }
      el.style.left = `${(R.x + u * R.w).toFixed(1)}px`;
      el.style.top = `${(R.y + v * R.h).toFixed(1)}px`;
    }
    for (const [id, el] of this.markers) if (!seen.has(id)) { el.remove(); this.markers.delete(id); }
  }

  private mapUnavailable(): void {
    const view = this.els.mmView;
    if (view.querySelector('.na')) return;
    view.replaceChildren(); this.markers.clear(); this.mmRect = undefined;
    this.div('na', view).textContent = 'Map unavailable';
  }

  private effects(row: HTMLElement, list: HudEffect[], size: number, now: number, id: string): void {
    const live = list.filter((e) => e.expiresAtMs === undefined || e.expiresAtMs > now);
    const key = live.map((e) => `${e.id}:${e.iconUrl}:${e.harmful}`).join(',');
    if (!this.changed(id, key)) return;
    row.replaceChildren();
    row.style.display = live.length ? 'flex' : 'none';
    live.slice(0, H.buffs.max).forEach((e) => {
      const d = this.div(`e${e.harmful ? ' bad' : ''}`, row);
      Object.assign(d.style, { width: `${size}px`, height: `${size}px` });
      d.title = e.label; d.setAttribute('aria-label', e.label);
      const img = document.createElement('img'); img.alt = ''; img.src = e.iconUrl; d.appendChild(img);
    });
    if (live.length > H.buffs.max) {
      const more = this.div('more', row);
      more.textContent = `+${live.length - H.buffs.max}`;
      more.title = live.slice(H.buffs.max).map((e) => e.label).join(', ');
    }
  }

  private portrait(el: HTMLElement, p: PortraitRef | undefined, id: string, w: number): void {
    const key = p ? `${p.url}|${p.crop ? Object.values(p.crop).join(',') : ''}` : '';
    if (!this.changed(id, key)) return;
    const fallback = () => Object.assign(el.style, { backgroundImage: `url("${A('icon-portrait-fallback')}")`, backgroundSize: '60%', backgroundPosition: 'center' });
    if (!p) { fallback(); return; }
    const probe = new Image();
    probe.onerror = fallback; // safe fallback on a missing portrait file
    probe.src = p.url;
    if (p.crop) {
      const k = w / p.crop.w;
      Object.assign(el.style, { backgroundImage: `url("${p.url}")`, backgroundSize: `${p.crop.imgW * k}px ${p.crop.imgH * k}px`, backgroundPosition: `${-p.crop.x * k}px ${-p.crop.y * k}px` });
    } else Object.assign(el.style, { backgroundImage: `url("${p.url}")`, backgroundSize: 'cover', backgroundPosition: 'center top' });
  }

  private setBar(b: Bar, value: number, max: number): void {
    const ok = Number.isFinite(value) && Number.isFinite(max) && max > 0;
    const ratio = ok ? Math.min(1, Math.max(0, value / max)) : 0;
    const key = ok ? `${value}/${max}` : '';
    if (key === b.last) return;
    b.last = key;
    b.fill.style.width = `${(b.w + 4) * ratio}px`;
    if (b.val) b.val.textContent = ok ? `${Math.max(0, Math.round(value))} / ${Math.round(max)}` : '';
    b.root.setAttribute('aria-label', ok ? `HP ${Math.round(value)} of ${Math.round(max)}` : 'unknown');
  }

  private bar(parent: HTMLElement, x: number, y: number, w: number, h: number, fillFile: string, withValue: boolean): Bar {
    const root = this.div('bar', parent); this.at(root, x, y, w, h);
    root.setAttribute('role', 'meter');
    const fill = this.div('fill', root);
    const img = document.createElement('img'); img.alt = ''; img.src = A(fillFile); img.style.width = `${w - 10 + 4}px`; fill.appendChild(img);
    const b: Bar = { root, fill, img, w: w - 10, last: '' };
    if (withValue) { b.val = document.createElement('span'); b.val.className = 'val'; root.appendChild(b.val); }
    return b;
  }

  // ------------------------------------------------------------------ misc

  /** PvP: simple centered status line (CONNECTING… / ROOM FULL); null hides it. */
  setStatus(text: string | null): void {
    if (!text) { this.status?.remove(); this.status = undefined; return; }
    if (!this.status) {
      const S = PVP.hud.status;
      this.status = document.createElement('div');
      this.status.className = 'abs panel';
      this.box(this.status, { x: S.centerX - S.w / 2, y: S.centerY - S.h / 2, w: S.w, h: S.h });
      Object.assign(this.status.style, {
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${S.size}px`,
        fontWeight: '700', letterSpacing: '2px', color: '#E8C77E', fontFamily: FONT_FAMILY,
      });
      this.root.appendChild(this.status);
    }
    this.status.textContent = text;
  }

  layout(): void {
    this.lastRect = syncOverlay(this.root, this.host, this.canvas, this.lastRect);
    const scale = this.canvas.getBoundingClientRect().width / 1920;
    this.root.classList.toggle('compact', scale < 1279 / 1920); // below 1280x720: hide optional detail
  }

  destroy(): void {
    this.root.remove();
    this.markers.clear();
    this.cache.clear();
  }

  private panel(cls: string, r: { x: number; y: number; w: number; h: number }): HTMLDivElement {
    const p = this.div(`pn ${cls}`, this.root);
    this.box(p, r);
    this.els[cls === 'mm' ? 'mm' : cls] = p;
    return p;
  }

  private show(el: HTMLElement, on: boolean): void { const d = on ? '' : 'none'; if (el.style.display !== d) el.style.display = d; }
  private changed(id: string, v: string): boolean { if (this.cache.get(id) === v) return false; this.cache.set(id, v); return true; }
  private text(el: HTMLElement, v: string, id: string): void { if (this.changed(id, v)) { el.textContent = v; el.title = v; } }

  private div(cls: string, parent?: HTMLElement): HTMLDivElement {
    const d = document.createElement('div');
    d.className = cls;
    parent?.appendChild(d);
    if (cls.split(' ').some((c) => ['h', 't', 'key', 'fx', 'view', 'na'].includes(c))) d.style.position = d.style.position || 'absolute';
    return d;
  }

  /** Position inside a nine-slice panel (coordinates relative to the padding box: panel border = 16px). */
  private at(e: HTMLElement, x: number, y: number, w: number, h: number): void {
    Object.assign(e.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }

  private box(e: HTMLElement, r: { x: number; y: number; w: number; h: number }): void {
    Object.assign(e.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  }
}
