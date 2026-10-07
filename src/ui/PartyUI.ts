// Party UI (DOM, 1920x1080 design px inside the HUD overlay): the member frame on the right (names + HP),
// the PARTY window (P) with members and the players in the room, and the invite pop-up (ACCEPT / DECLINE).
import { FONT_FAMILY, HUD } from '../config/layout';

const K = (f: string) => `assets/final/ui/kit/${f}.png`;
const STYLE_ID = 'gol-party-style';
const F = { x: 1668, y: 600, w: 232 };
const W = { w: 560, x: (1920 - 560) / 2, y: 230 };

const CSS = `
.gol-pf{position:absolute;left:${F.x}px;top:${F.y}px;width:${F.w}px;display:none;flex-direction:column;gap:6px;padding:12px 14px 14px;box-sizing:border-box;pointer-events:auto;
  background:linear-gradient(rgba(6,10,18,.8),rgba(6,10,18,.62));border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.45),inset 0 0 0 1px rgba(201,154,69,.45);font-family:${HUD.bodyFont}}
.gol-pf.on{display:flex}
.gol-pf .hd{font:700 12px ${FONT_FAMILY};letter-spacing:2px;color:#f3d58a;text-shadow:0 1px 2px #000;margin-bottom:2px;cursor:pointer}
.gol-pf .m{display:flex;flex-direction:column;gap:3px}
.gol-pf .n{display:flex;align-items:center;gap:6px;font:700 13px ${FONT_FAMILY};color:#efddb0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px #000}
.gol-pf .n .cr{color:#ffd34a;font-size:12px}
.gol-pf .n .me{color:#9fb0c0;font-size:11px;font-weight:400}
.gol-pf .hb{height:8px;border-radius:4px;background:#1a0f12;box-shadow:inset 0 0 0 1px rgba(0,0,0,.6);overflow:hidden}
.gol-pf .hb i{display:block;height:100%;background:linear-gradient(#ff6a5a,#c8231e);transition:width 150ms}
.gol-pf .m.dead .n{color:#8c939b}
.gol-pw{position:absolute;left:${W.x}px;top:${W.y}px;width:${W.w}px;display:none;flex-direction:column;gap:14px;padding:22px 28px 26px;box-sizing:border-box;pointer-events:auto;
  background:linear-gradient(rgba(8,13,24,.99),rgba(8,13,24,.98));border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.6),inset 0 0 0 1px rgba(201,154,69,.6),inset 0 0 0 4px rgba(8,13,24,.9),inset 0 0 0 5px rgba(201,154,69,.25);
  font-family:${HUD.bodyFont};color:#e8e2d2}
.gol-pw.open{display:flex}
.gol-pw .ttl{text-align:center;font:700 20px ${FONT_FAMILY};letter-spacing:4px;color:#f3d58a;text-shadow:0 2px 4px #000}
.gol-pw .x{position:absolute;right:14px;top:12px;width:30px;height:30px;border:0;padding:0;background:url("${K('btn_close_sm')}") center/100% 100% no-repeat;cursor:pointer}
.gol-pw .x:hover{background-image:url("${K('btn_close_sm_hover')}")}
.gol-pw .sec{font:700 11px ${FONT_FAMILY};letter-spacing:2px;color:#c9b48a;border-bottom:1px solid rgba(201,154,69,.3);padding-bottom:6px}
.gol-pw .list{display:flex;flex-direction:column;gap:6px}
.gol-pw .row{display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;border-radius:8px;background:rgba(255,255,255,.035);box-shadow:inset 0 0 0 1px rgba(201,154,69,.18)}
.gol-pw .row .nm{flex:1;font:700 14px ${FONT_FAMILY};color:#efddb0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gol-pw .row .cl{font-size:12px;color:#9fb0c0;text-transform:capitalize}
.gol-pw .row .cr{color:#ffd34a;margin-right:4px}
.gol-pw .none{font-size:13px;color:#a99f86;font-style:italic;text-align:center;padding:6px 0}
.gol-pw button.b,.gol-pi button{min-width:96px;height:32px;padding:0 14px;border-radius:7px;border:1px solid #c99a45;background:linear-gradient(#3a2a10,#22180a);
  font:700 12px ${FONT_FAMILY};letter-spacing:1.5px;color:#ffe7a8;cursor:pointer;text-shadow:0 1px 2px #000}
.gol-pw button.b:hover,.gol-pi button:hover{box-shadow:0 0 10px rgba(232,178,90,.45)}
.gol-pw button.b.alt,.gol-pi button.alt{border-color:#6a5630;background:#0b121b;color:#c9b48a}
.gol-pw button.b:disabled{opacity:.4;cursor:default;box-shadow:none}
.gol-pw .hint{font-size:12px;color:#9fb0c0;text-align:center}
.gol-pi{position:absolute;left:${(1920 - 520) / 2}px;top:150px;width:520px;display:none;align-items:center;gap:14px;padding:16px 20px 16px 24px;box-sizing:border-box;pointer-events:auto;
  background:linear-gradient(rgba(8,13,24,.96),rgba(8,13,24,.9));border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.55),inset 0 0 0 1px rgba(232,178,90,.7);font:700 15px ${FONT_FAMILY};color:#efddb0}
.gol-pi.on{display:flex}
.gol-pi span{flex:1;line-height:20px}
.gol-pi span b{color:#ffd76e}
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
    if (!document.getElementById(STYLE_ID)) { const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st); }
    this.frame = this.el('gol-pf', host); this.frame.title = 'Party (P)';
    this.win = this.el('gol-pw', host);
    this.pop = this.el('gol-pi', host);
    for (const e of [this.frame, this.win, this.pop]) e.addEventListener('mousedown', (ev) => ev.stopPropagation());
  }

  private el(cls: string, parent: HTMLElement, tag = 'div'): HTMLDivElement { const d = document.createElement(tag) as HTMLDivElement; d.className = cls; parent.appendChild(d); return d; }

  toggle(): void { if (this.isOpen) this.close(); else this.open(); }
  open(): void { this.isOpen = true; this.win.classList.add('open'); this.last = ''; if (this.view) this.render(this.view); this.act.onOpen(true); }
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
      const hd = this.el('hd', this.frame); hd.textContent = `PARTY  ${v.members.length} / 6`; hd.addEventListener('click', () => this.toggle());
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
      const ok = this.el('', this.pop, 'button') as unknown as HTMLButtonElement; ok.textContent = 'ACCEPT'; ok.onclick = () => this.act.answer(true);
      const no = this.el('', this.pop, 'button') as unknown as HTMLButtonElement; no.className = 'alt'; no.textContent = 'DECLINE'; no.onclick = () => this.act.answer(false);
    }
    if (!this.isOpen) return;
    // PARTY window
    this.win.innerHTML = '';
    const x = this.el('x', this.win, 'button') as unknown as HTMLButtonElement; x.title = 'Close (P / Esc)'; x.onclick = () => this.close();
    this.el('ttl', this.win).textContent = 'PARTY';
    this.el('sec', this.win).textContent = v.inParty ? `MEMBERS  ${v.members.length} / 6` : 'MEMBERS';
    const ml = this.el('list', this.win);
    if (!v.inParty) this.el('none', ml).textContent = 'You are not in a party. Invite a player below.';
    for (const m of v.members) {
      const r = this.el('row', ml);
      const nm = this.el('nm', r);
      if (m.leader) { const c = this.el('cr', nm, 'span'); c.textContent = '♛'; }
      nm.appendChild(document.createTextNode(m.me ? `${m.name} (you)` : m.name));
      if (m.me) { const b = this.btn(r, 'LEAVE', () => this.act.leave()); b.classList.add('alt'); }
      else if (v.isLeader) { const b = this.btn(r, 'REMOVE', () => this.act.kick(m.id)); b.classList.add('alt'); }
    }
    this.el('sec', this.win).textContent = 'PLAYERS HERE';
    const rl = this.el('list', this.win);
    const others = v.room.filter((p) => !p.inMine);
    if (!others.length) this.el('none', rl).textContent = 'No other players in this room.';
    for (const p of others) {
      const r = this.el('row', rl);
      const nm = this.el('nm', r); nm.textContent = p.name;
      this.el('cl', r, 'span').textContent = p.classId.replace('_', ' ');
      const b = this.btn(r, 'INVITE', () => this.act.invite(p.id)); b.disabled = !p.canInvite;
    }
    this.el('hint', this.win).textContent = 'Party buffs (War Cry, Iron Oath, Legacy Banner) reach every member near the caster.';
  }

  private btn(parent: HTMLElement, label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'b'; b.textContent = label; b.onclick = fn; parent.appendChild(b); return b;
  }

  destroy(): void { this.frame.remove(); this.win.remove(); this.pop.remove(); }
}
