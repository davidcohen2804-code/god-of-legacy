// The free-camera trial's screen: the party's frames, the target's frame, the skill bar, the names over the bodies, the
// damage numbers, the controls (two modes to compare — GPT's direction) and the loading veil. Plain HTML over the 3D.
const CSS = `
.fc-hud { position: fixed; inset: 0; pointer-events: none; font-family: Inter, 'Segoe UI', sans-serif; color: #f3ecdf; user-select: none; }
.fc-panel { background: linear-gradient(180deg, rgba(28,24,34,0.86), rgba(18,16,24,0.86)); border: 1px solid rgba(214,178,104,0.45); border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,0.35); }
.fc-party { position: absolute; left: 18px; top: 18px; display: flex; flex-direction: column; gap: 8px; }
.fc-member { padding: 10px 14px 11px; width: 230px; }
.fc-member .n { font: 700 14px Cinzel, Georgia, serif; letter-spacing: 0.04em; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.fc-member .n small { font: 500 11px Inter, sans-serif; color: #c9bfae; letter-spacing: 0.02em; }
.fc-member.me .n { color: #ffe3a3; }
.fc-bar { position: relative; height: 10px; border-radius: 5px; background: rgba(0,0,0,0.55); margin-top: 7px; overflow: hidden; }
.fc-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 5px; transition: width 0.12s; }
.fc-bar.hp i { background: linear-gradient(180deg, #ff7a6a, #c8323a); }
.fc-bar.mp i { background: linear-gradient(180deg, #7ab8ff, #2f5fc8); }
.fc-bar.boss i { background: linear-gradient(180deg, #d4a2ff, #7a3fd6); }
.fc-bar b { position: absolute; inset: 0; font: 600 9px/10px Inter, sans-serif; text-align: center; color: #fff; text-shadow: 0 1px 2px #000; }
.fc-target { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); padding: 10px 18px 12px; min-width: 300px; text-align: center; }
.fc-target .n { font: 700 16px Cinzel, Georgia, serif; letter-spacing: 0.05em; }
.fc-target .n small { font: 500 12px Inter, sans-serif; color: #c9bfae; margin-left: 8px; }
.fc-target .fc-bar { height: 12px; }
.fc-target .fc-bar b { font-size: 10px; line-height: 12px; }
.fc-skills { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); display: flex; gap: 12px; padding: 12px 16px 10px; }
.fc-slot { width: 66px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.fc-icon { position: relative; width: 58px; height: 58px; border-radius: 9px; overflow: hidden; border: 1px solid rgba(214,178,104,0.6); background: #120f18; }
.fc-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fc-icon .cd { position: absolute; inset: 0; background: conic-gradient(rgba(10,8,14,0.78) var(--cd, 0deg), transparent 0); }
.fc-icon .cdt { position: absolute; inset: 0; display: grid; place-items: center; font: 700 16px Inter, sans-serif; text-shadow: 0 1px 3px #000; }
.fc-icon .k { position: absolute; left: 4px; top: 3px; font: 700 11px Inter, sans-serif; padding: 1px 5px; border-radius: 4px; background: rgba(0,0,0,0.65); }
.fc-icon.on { box-shadow: 0 0 0 2px #ffd27a, 0 0 14px rgba(255,210,122,0.6); }
.fc-slot .nm { font: 600 10px Inter, sans-serif; color: #e6dccb; text-align: center; white-space: nowrap; }
.fc-help { position: absolute; left: 18px; bottom: 20px; padding: 12px 16px; font: 500 12px/1.75 Inter, sans-serif; color: #e6dccb; max-width: 380px; }
.fc-help h4 { margin: 0 0 4px; font: 700 13px Cinzel, Georgia, serif; color: #ffe3a3; letter-spacing: 0.04em; }
.fc-help kbd { display: inline-block; min-width: 14px; padding: 0 6px; margin-right: 4px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.28); background: rgba(255,255,255,0.08); font: 700 11px/18px Inter, sans-serif; text-align: center; color: #fff; }
.fc-modes { position: absolute; right: 18px; top: 18px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; pointer-events: auto; width: 262px; }
.fc-modes .t { font: 700 13px Cinzel, Georgia, serif; color: #ffe3a3; letter-spacing: 0.04em; }
.fc-mode { padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.04); cursor: pointer; font: 600 12px/1.45 Inter, sans-serif; color: #e6dccb; }
.fc-mode b { display: block; font: 700 13px Inter, sans-serif; color: #fff; margin-bottom: 2px; }
.fc-mode.on { border-color: #ffd27a; background: rgba(255,210,122,0.12); }
.fc-mode:hover { border-color: rgba(255,210,122,0.7); }
.fc-plate { position: absolute; transform: translate(-50%, -100%); text-align: center; white-space: nowrap; }
.fc-plate .n { font: 700 12px Cinzel, Georgia, serif; letter-spacing: 0.04em; text-shadow: 0 1px 3px #000, 0 0 2px #000; }
.fc-plate .n small { font: 600 10px Inter, sans-serif; color: #ffe08a; margin-left: 5px; }
.fc-plate.ally .n { color: #9fe0ff; }
.fc-plate.boss .n { font-size: 14px; color: #e4c4ff; }
.fc-plate .fc-bar { width: 74px; height: 6px; margin: 4px auto 0; border: 1px solid rgba(0,0,0,0.6); }
.fc-plate.boss .fc-bar { width: 120px; height: 7px; }
.fc-plate.tg .n { color: #ffd27a; }
.fc-dmg { position: absolute; transform: translate(-50%, -50%); font: 800 24px Inter, sans-serif; color: #ffb648; -webkit-text-stroke: 1px #3a1606; text-shadow: 0 2px 4px rgba(0,0,0,0.6); white-space: nowrap; }
.fc-dmg.crit { font-size: 32px; color: #ffe066; }
.fc-dmg.hurt { color: #ff5a5a; font-size: 22px; }
.fc-dmg.ally { font-size: 18px; color: #ffd8a8; opacity: 0.85; }
.fc-layer { position: absolute; inset: 0; overflow: hidden; }
.fc-toast { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); max-width: min(620px, 64vw); padding: 10px 24px; border-radius: 10px; background: rgba(18,16,24,0.6); font: 700 17px/1.45 Cinzel, Georgia, serif; letter-spacing: 0.04em; color: #ffe3a3; text-shadow: 0 2px 6px #000; opacity: 0; transition: opacity 0.3s; text-align: center; }
.fc-view { position: absolute; left: 50%; bottom: 128px; transform: translateX(-50%); padding: 12px 20px; font: 600 13px/1.7 Inter, sans-serif; display: none; text-align: center; }
.fc-view b { font: 700 14px Cinzel, Georgia, serif; color: #ffe3a3; letter-spacing: 0.04em; }
.fc-view kbd { font: 700 11px Inter, sans-serif; padding: 0 5px; border: 1px solid rgba(255,255,255,0.28); border-radius: 4px; }
.fc-veil { position: fixed; inset: 0; background: radial-gradient(circle at 50% 40%, #2a2233, #120f17); display: grid; place-items: center; z-index: 5; transition: opacity 0.5s; }
.fc-veil .box { width: min(420px, 80vw); text-align: center; }
.fc-veil h2 { font: 700 26px Cinzel, Georgia, serif; color: #ffe3a3; letter-spacing: 0.06em; margin: 0 0 6px; }
.fc-veil p { font: 500 13px Inter, sans-serif; color: #c9bfae; margin: 0 0 18px; }
.fc-veil .fc-bar { height: 8px; }
.fc-veil .fc-bar i { background: linear-gradient(90deg, #ffd27a, #ff9a4a); }
`;

export type ModeId = 'A' | 'B';
export interface SlotView { key: string; name: string; icon: string; left: number; total: number; on: boolean }
export interface PlateView { id: string; x: number; y: number; name: string; lv?: number; hp: number; max: number; kind: 'foe' | 'boss' | 'ally'; target: boolean; bar: boolean }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); e.className = cls; if (html !== undefined) e.innerHTML = html; parent?.appendChild(e); return e;
}

export class Hud {
  readonly root: HTMLDivElement;
  private partyBox: HTMLDivElement; private members = new Map<string, { box: HTMLDivElement; hp: HTMLElement; hpT: HTMLElement }>();
  private targetBox: HTMLDivElement; private tName: HTMLDivElement; private tBar: HTMLElement; private tText: HTMLElement; private tWrap: HTMLElement;
  private slots: { icon: HTMLDivElement; cd: HTMLDivElement; cdt: HTMLDivElement }[] = [];
  private skillBox: HTMLDivElement;
  private help: HTMLDivElement;
  private modeEls = new Map<ModeId, HTMLDivElement>();
  private plates = new Map<string, { e: HTMLDivElement; bar: HTMLElement; n: HTMLElement; key: string }>();
  private dmgs: { e: HTMLDivElement; x: number; y: number; z: number; t: number; ms: number; dx: number }[] = [];
  private toastEl: HTMLDivElement; private toastT = 0;
  /** The names over the bodies and the numbers: under the panels. */
  private layer: HTMLDivElement;
  private viewEl: HTMLDivElement;
  private veil: HTMLDivElement; private veilBar: HTMLElement; private veilText: HTMLElement;
  onMode?: (m: ModeId) => void;

  constructor(parent: HTMLElement) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.root = el('div', 'fc-hud', parent);
    this.layer = el('div', 'fc-layer', this.root);
    this.partyBox = el('div', 'fc-party', this.root);
    this.targetBox = el('div', 'fc-target fc-panel', this.root); this.targetBox.style.display = 'none';
    this.tName = el('div', 'n', this.targetBox);
    this.tWrap = el('div', 'fc-bar hp', this.targetBox); this.tBar = el('i', '', this.tWrap); this.tText = el('b', '', this.tWrap);
    this.skillBox = el('div', 'fc-skills fc-panel', this.root);
    this.help = el('div', 'fc-help fc-panel', this.root);
    const modes = el('div', 'fc-modes fc-panel', this.root);
    el('div', 't', modes, 'CONTROLS <span style="font:500 11px Inter;color:#c9bfae;letter-spacing:0">· M to switch</span>');
    const A = el('div', 'fc-mode', modes, '<b>A · Click to move & target</b>Click the ground to run there, click a foe to attack it (the hero keeps shooting). Skills hit your target.');
    const B = el('div', 'fc-mode', modes, '<b>B · Direct action</b>W A S D to run, left click shoots where the mouse points. Skills fly where you aim.');
    this.modeEls.set('A', A); this.modeEls.set('B', B);
    A.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.onMode?.('A'); });
    B.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.onMode?.('B'); });
    this.toastEl = el('div', 'fc-toast', this.root);
    this.viewEl = el('div', 'fc-view fc-panel', this.root);
    this.veil = el('div', 'fc-veil', parent);
    const box = el('div', 'box', this.veil);
    el('h2', '', box, 'Free Camera Trial');
    this.veilText = el('p', '', box, 'Loading the Sun Seal Plaza and the party…');
    const vb = el('div', 'fc-bar', box); this.veilBar = el('i', '', vb); this.veilBar.style.width = '0%';
  }

  loading(k: number, text?: string): void { this.veilBar.style.width = `${Math.round(k * 100)}%`; if (text) this.veilText.textContent = text; }
  ready(): void { this.veil.style.opacity = '0'; setTimeout(() => this.veil.remove(), 600); }
  fail(msg: string): void { this.veilText.textContent = msg; this.veilText.style.color = '#ff9a8a'; }

  setMode(m: ModeId): void {
    for (const [k, e] of this.modeEls) e.classList.toggle('on', k === m);
    const cam = '<kbd>Right drag</kbd> turn the camera · <kbd>Wheel</kbd> zoom<br><kbd>Wheel click</kbd> or <kbd>C</kbd> camera behind the hero<br><kbd>V</kbd> see the hero from every side · <kbd>O</kbd> change outfit';
    this.help.innerHTML = m === 'A'
      ? `<h4>Mode A · Click to move & target</h4><kbd>Left click</kbd> ground: run there (hold: keep running)<br><kbd>Left click</kbd> a foe: attack it · <kbd>Tab</kbd> next foe · <kbd>Esc</kbd> clear<br><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> skills on the target · <kbd>W A S D</kbd> also run<br>${cam}`
      : `<h4>Mode B · Direct action</h4><kbd>W A S D</kbd> run (the way the camera looks)<br><kbd>Left click</kbd> shoot where the mouse points (hold: keep shooting)<br><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> skills where you aim<br>${cam}`;
  }

  party(list: { id: string; name: string; sub: string; hp: number; max: number; me: boolean }[]): void {
    for (const m of list) {
      let v = this.members.get(m.id);
      if (!v) {
        const box = el('div', `fc-member fc-panel${m.me ? ' me' : ''}`, this.partyBox);
        el('div', 'n', box, `${m.name}<small>${m.sub}</small>`);
        const w = el('div', 'fc-bar hp', box), hp = el('i', '', w), hpT = el('b', '', w);
        v = { box, hp, hpT };
        if (m.me) { const w2 = el('div', 'fc-bar mp', box), mp = el('i', '', w2); mp.style.width = '100%'; el('b', '', w2, 'MP'); }
        this.members.set(m.id, v);
      }
      v.hp.style.width = `${(100 * Math.max(0, m.hp)) / m.max}%`; v.hpT.textContent = `${Math.max(0, Math.round(m.hp))} / ${m.max}`;
    }
  }

  target(t: { name: string; lv: number; hp: number; max: number; boss: boolean } | null): void {
    if (!t) { this.targetBox.style.display = 'none'; return; }
    this.targetBox.style.display = '';
    const html = `${t.name}<small>Lv.${t.lv}</small>`; if (this.tName.innerHTML !== html) this.tName.innerHTML = html;
    this.tWrap.className = `fc-bar ${t.boss ? 'boss' : 'hp'}`;
    this.tBar.style.width = `${(100 * Math.max(0, t.hp)) / t.max}%`; this.tText.textContent = `${Math.max(0, Math.round(t.hp))} / ${t.max}`;
  }

  skills(list: SlotView[]): void {
    if (!this.slots.length) for (const s of list) {
      const slot = el('div', 'fc-slot', this.skillBox), icon = el('div', 'fc-icon', slot);
      const img = el('img', '', icon); img.src = s.icon; img.alt = s.name; img.draggable = false;
      const cd = el('div', 'cd', icon), cdt = el('div', 'cdt', icon); el('div', 'k', icon, s.key); el('div', 'nm', slot, s.name);
      this.slots.push({ icon, cd, cdt });
    }
    list.forEach((s, i) => {
      const v = this.slots[i]; if (!v) return;
      const k = s.total > 0 ? Math.max(0, s.left) / s.total : 0;
      v.cd.style.setProperty('--cd', `${k * 360}deg`);
      v.cdt.textContent = s.left > 0 && s.total > 1000 ? (s.left / 1000).toFixed(s.left < 1000 ? 1 : 0) : '';
      v.icon.classList.toggle('on', s.on);
    });
  }

  /** The names over the bodies (screen px; hidden: off screen). */
  plate(list: PlateView[]): void {
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      let v = this.plates.get(p.id);
      const cls = `fc-plate ${p.kind}${p.target ? ' tg' : ''}`;
      if (!v) { const e = el('div', cls, this.layer), n = el('div', 'n', e), w = el('div', 'fc-bar hp', e), bar = el('i', '', w); v = { e, bar, n, key: '' }; this.plates.set(p.id, v); }
      if (v.e.className !== cls) v.e.className = cls;
      const key = `${p.name}|${p.lv ?? ''}`; if (v.key !== key) { v.n.innerHTML = p.lv ? `${p.name}<small>Lv.${p.lv}</small>` : p.name; v.key = key; }
      (v.bar.parentElement as HTMLElement).style.display = p.bar ? '' : 'none';
      v.bar.style.width = `${(100 * Math.max(0, p.hp)) / p.max}%`;
      v.e.style.left = `${p.x}px`; v.e.style.top = `${p.y}px`; v.e.style.display = '';
    }
    for (const [id, v] of this.plates) if (!seen.has(id)) v.e.style.display = 'none';
  }

  /** A number rising from a point in the room (units); `update` places it each frame. */
  damage(x: number, y: number, z: number, value: number, kind: 'hit' | 'crit' | 'hurt' | 'ally'): void {
    const e = el('div', `fc-dmg${kind === 'hit' ? '' : ' ' + kind}`, this.layer, String(Math.round(value)));
    this.dmgs.push({ e, x, y, z, t: 0, ms: kind === 'crit' ? 1100 : 850, dx: (Math.random() - 0.5) * 30 });
    if (this.dmgs.length > 40) { const d = this.dmgs.shift()!; d.e.remove(); }
  }

  toast(text: string, ms = 1800): void { this.toastEl.textContent = text; this.toastEl.style.opacity = '1'; this.toastT = ms; }

  view(on: boolean, outfit: string): void {
    this.viewEl.style.display = on ? 'block' : 'none';
    if (on) this.viewEl.innerHTML = `<b>Character view</b> — front · side · back<br><span style="color:#c9bfae">Outfit: ${outfit} · <kbd>O</kbd> change · <kbd>V</kbd> back to play</span>`;
  }

  update(ms: number, project: (x: number, y: number, z: number) => { x: number; y: number; on: boolean }): void {
    for (let i = this.dmgs.length - 1; i >= 0; i--) {
      const d = this.dmgs[i]; d.t += ms;
      const k = d.t / d.ms, p = project(d.x, d.y, d.z);
      if (k >= 1) { d.e.remove(); this.dmgs.splice(i, 1); continue; }
      if (!p.on) { d.e.style.display = 'none'; continue; }
      d.e.style.display = '';
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.6);
      d.e.style.left = `${p.x + d.dx * k}px`; d.e.style.top = `${p.y - 70 * k}px`;
      d.e.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3); d.e.style.transform = `translate(-50%, -50%) scale(${pop})`;
    }
    if (this.toastT > 0) { this.toastT -= ms; if (this.toastT <= 0) this.toastEl.style.opacity = '0'; }
  }
}
