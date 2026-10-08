// Party UI (DOM, 1920x1080 design px inside the HUD overlay): the member frame on the right (names + HP),
// the PARTY window (P) with members and the players in the room, and the invite pop-up (ACCEPT / DECLINE).
import { ensureTheme } from './theme';

const STYLE_ID = 'gol-party-style';
/** Member frame (right side, under the panels' buttons) and the PARTY window (centred). */
const F = { x: 1664, y: 572, w: 240 };
const W = { w: 660, x: (1920 - 660) / 2, y: 200 };

const CSS = `
.gol-pf{position:absolute;left:${F.x}px;top:${F.y}px;width:${F.w}px;display:none;flex-direction:column;gap:8px;padding:12px 14px 14px;pointer-events:auto;font-family:var(--gl-body)}
.gol-pf.on{display:flex}
.gol-pf .hd{display:flex;align-items:center;justify-content:space-between;font:700 11.5px var(--gl-body);letter-spacing:1.6px;color:#c9ae78;text-transform:uppercase;cursor:pointer}
.gol-pf .m{display:flex;flex-direction:column;gap:4px}
.gol-pf .n{display:flex;align-items:center;gap:6px;font:600 14px var(--gl-body);color:var(--gl-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-pf .n .cr{color:var(--gl-gold2);font-size:13px}
.gol-pf .n .me{color:var(--gl-text3);font-size:12.5px;font-weight:500}
.gol-pf .hb{height:8px;border-radius:999px;background:#0a101c;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);overflow:hidden}
.gol-pf .hb i{display:block;height:100%;border-radius:999px;background:linear-gradient(#f0685b,#c13a30);transition:width 150ms}
.gol-pf .m.dead .n{color:var(--gl-text3)}
.gol-pw{left:${W.x}px;top:${W.y}px;width:${W.w}px;display:none;flex-direction:column}
.gol-pw.open{display:flex}
.gol-pw .bd{display:flex;flex-direction:column;gap:14px;padding:20px 28px 26px}
.gol-pw .list{display:flex;flex-direction:column;gap:8px}
.gol-pw .row{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 12px 0 18px}
.gol-pw .row .nm{flex:1;font:600 16px var(--gl-body);color:var(--gl-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-pw .row .cl{font:500 13.5px var(--gl-body);color:var(--gl-text2);text-transform:capitalize}
.gol-pw .row .cr{color:var(--gl-gold2);margin-right:6px}
.gol-pw .none{font:500 14.5px/1.5 var(--gl-body);color:var(--gl-text2);text-align:center;padding:14px 0}
.gol-pw .hint{font:500 13.5px/1.5 var(--gl-body);color:var(--gl-text3);text-align:center;padding-top:4px}
.gol-pw .gl-btn{height:36px;padding:0 16px;font-size:13.5px}
.gol-pi{position:absolute;left:${(1920 - 600) / 2}px;top:150px;width:600px;display:none;align-items:center;gap:12px;padding:14px 16px 14px 22px;pointer-events:auto;font:500 16px var(--gl-body);color:var(--gl-text)}
.gol-pi.on{display:flex}
.gol-pi span{flex:1;line-height:22px}
.gol-pi span b{color:var(--gl-gold2);font-weight:700}
`;

export interface PartyView {
  members: { id: string; name: string; leader: boolean; me: boolean; hp: number; maxHp: number; alive: boolean }[];
  /** Other players in the room (invite list). */
  room: { id: string; name: string; classId: string; canInvite: boolean; inMine: boolean }[];
  isLeader: boolean;
  inParty: boolean;
  inviteFrom: string | null;
}

export interface PartyActions { invite(id: string): void; kick(id: string): void; leave(): void; answer(ok: boolean): void; onOpen(open: boolean): void }

export class PartyUI {
  private frame: HTMLDivElement;
  private win: HTMLDivElement;
  private pop: HTMLDivElement;
  private last = '';
  isOpen = false;
  private view: PartyView | null = null;

  constructor(host: HTMLElement, private act: PartyActions) {
    ensureTheme();
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.frame = this.el('gol-pf gl-panel', host); this.frame.title = 'Party (P)';
    this.win = this.el('gol-pw gl-win pop', host);
    this.pop = this.el('gol-pi gl-panel', host);
    for (const e of [this.frame, this.win, this.pop]) e.addEventListener('mousedown', (ev) => ev.stopPropagation());
  }

  private el(cls: string, parent: HTMLElement, tag = 'div'): HTMLDivElement { const d = document.createElement(tag) as HTMLDivElement; d.className = cls; parent.appendChild(d); return d; }

  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
  open(): void { this.isOpen = true; this.win.classList.add('open'); this.last = ''; this.render(this.view ?? { members: [], room: [], isLeader: false, inParty: false, inviteFrom: null }); this.act.onOpen(true); }
  close(): void { if (!this.isOpen) return; this.isOpen = false; this.win.classList.remove('open'); this.act.onOpen(false); }

  /** Called a few times a second; writes the DOM only on change. */
  render(v: PartyView): void {
    this.view = v;
    const key = JSON.stringify([v.members.map((m) => [m.id, m.name, m.leader, Math.round((m.hp / Math.max(1, m.maxHp)) * 100), m.alive]), v.room, v.isLeader, v.inviteFrom, this.isOpen]);
    if (key === this.last) return;
    this.last = key;
    // member frame (right side)
    this.frame.classList.toggle('on', v.inParty);
    this.frame.innerHTML = '';
    if (v.inParty) {
      const hd = this.el('hd', this.frame); hd.innerHTML = `<span>Party</span><span class="gl-badge"></span>`; (hd.lastChild as HTMLElement).textContent = `${v.members.length} / 6`; hd.addEventListener('click', () => this.toggle());
      for (const m of v.members) {
        const r = this.el(`m${m.alive ? '' : ' dead'}`, this.frame);
        const n = this.el('n', r);
        if (m.leader) { const c = this.el('cr', n, 'span'); c.textContent = '♛'; c.title = 'Party leader'; }
        const t = this.el('', n, 'span'); t.textContent = m.name;
        if (m.me) { const me = this.el('me', n, 'span'); me.textContent = '(you)'; }
        const hb = this.el('hb', r), fill = document.createElement('i');
        fill.style.width = `${Math.max(0, Math.min(100, (m.hp / Math.max(1, m.maxHp)) * 100))}%`; hb.appendChild(fill);
        hb.title = `${Math.max(0, Math.round(m.hp))} / ${Math.round(m.maxHp)} HP`;
      }
    }
    // invite pop-up
    this.pop.classList.toggle('on', !!v.inviteFrom);
    if (v.inviteFrom) {
      this.pop.innerHTML = '';
      const s = this.el('', this.pop, 'span'); s.innerHTML = '<b></b> invites you to a party.'; (s.firstChild as HTMLElement).textContent = v.inviteFrom;
      const no = this.el('gl-btn', this.pop, 'button') as unknown as HTMLButtonElement; no.textContent = 'Decline'; no.onclick = () => this.act.answer(false);
      const ok = this.el('gl-btn pri', this.pop, 'button') as unknown as HTMLButtonElement; ok.textContent = 'Accept'; ok.onclick = () => this.act.answer(true);
    }
    if (!this.isOpen) return;
    // PARTY window
    this.win.innerHTML = '';
    const head = this.el('gl-head', this.win);
    this.el('gl-title', head).textContent = 'PARTY'; this.el('gl-sp', head);
    const x = this.el('gl-x', head, 'button') as unknown as HTMLButtonElement; x.title = 'Close (P / Esc)'; x.setAttribute('aria-label', 'Close'); x.onclick = () => this.close();
    const body = this.el('bd', this.win);
    this.el('gl-cap', body).textContent = v.inParty ? `Members · ${v.members.length} / 6` : 'Members';
    const ml = this.el('list', body);
    if (!v.inParty) this.el('none', ml).textContent = 'You are not in a party. Invite a player below.';
    for (const m of v.members) {
      const r = this.el('row gl-sec', ml);
      const nm = this.el('nm', r);
      if (m.leader) { const c = this.el('cr', nm, 'span'); c.textContent = '♛'; }
      nm.appendChild(document.createTextNode(m.me ? `${m.name} (you)` : m.name));
      if (m.me) this.btn(r, 'Leave', () => this.act.leave());
      else if (v.isLeader) this.btn(r, 'Remove', () => this.act.kick(m.id));
    }
    this.el('gl-cap', body).textContent = 'Players here';
    const rl = this.el('list', body);
    const others = v.room.filter((p) => !p.inMine);
    if (!others.length) this.el('none', rl).textContent = 'No other players in this room.';
    for (const p of others) {
      const r = this.el('row gl-sec', rl);
      const nm = this.el('nm', r); nm.textContent = p.name;
      this.el('cl', r, 'span').textContent = p.classId.replace('_', ' ');
      const b = this.btn(r, 'Invite', () => this.act.invite(p.id)); b.classList.add('pri'); b.disabled = !p.canInvite;
    }
    this.el('hint', body).textContent = 'Party buffs (War Cry, Iron Oath, Legacy Banner) reach every member near the caster.';
  }

  private btn(parent: HTMLElement, label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gl-btn'; b.textContent = label; b.onclick = fn; parent.appendChild(b); return b;
  }

  destroy(): void { this.frame.remove(); this.win.remove(); this.pop.remove(); }
}
