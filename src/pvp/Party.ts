// Party (MapleStory-style): up to 6 players in the same room. The leader (first in the list) owns the member list and
// broadcasts it; everyone else follows it. Invites go to one player, who accepts or declines.
import type { NetMsg } from './Transport';

export const PARTY_MAX = 6;

type PartyMsg = Extract<NetMsg, { t: 'pinv' | 'pans' | 'party' | 'pleave' | 'pbuff' }>;
type Out = Omit<Extract<NetMsg, { t: 'pinv' }>, 'from'> | Omit<Extract<NetMsg, { t: 'pans' }>, 'from'> | Omit<Extract<NetMsg, { t: 'party' }>, 'from'>
  | Omit<Extract<NetMsg, { t: 'pleave' }>, 'from'> | Omit<Extract<NetMsg, { t: 'pbuff' }>, 'from'>;

export interface PartyHooks {
  send(m: Out): void;
  nameOf(id: string): string;
  /** System line in the chat. */
  notice(text: string): void;
  /** Someone invites me: show ACCEPT / DECLINE. */
  invited(from: string): void;
  /** A party member shared a buff with me. */
  buff(from: string, skillId: string, ms: number): void;
  changed(): void;
}

export class Party {
  /** Members incl. me, leader first; empty = not in a party. */
  members: string[] = [];
  /** Invites I sent and still wait for. */
  private asked = new Set<string>();
  /** The invite on screen (one at a time). */
  pendingFrom: string | null = null;

  constructor(readonly me: string, private h: PartyHooks) {}

  get inParty(): boolean { return this.members.length > 1; }
  get leader(): string | null { return this.members[0] ?? null; }
  get isLeader(): boolean { return this.leader === this.me; }
  has(id: string): boolean { return this.members.includes(id); }
  /** Can I invite this player now? */
  canInvite(id: string): boolean { return id !== this.me && !this.has(id) && !this.asked.has(id) && (!this.inParty || this.isLeader) && this.members.length < PARTY_MAX; }

  invite(id: string): void {
    if (!this.canInvite(id)) return;
    this.asked.add(id);
    this.h.send({ t: 'pinv', to: id });
    this.h.notice(`Party invite sent to ${this.h.nameOf(id)}.`);
    this.h.changed();
  }

  answer(ok: boolean): void {
    const from = this.pendingFrom; if (!from) return;
    this.pendingFrom = null;
    this.h.send({ t: 'pans', to: from, ok });
    this.h.changed();
  }

  leave(): void {
    if (!this.inParty) return;
    this.h.send({ t: 'pleave' });
    this.h.notice('You left the party.');
    this.members = []; this.asked.clear();
    this.h.changed();
  }

  kick(id: string): void {
    if (!this.isLeader || !this.has(id) || id === this.me) return;
    this.setMembers(this.members.filter((m) => m !== id));
    this.h.notice(`${this.h.nameOf(id)} was removed from the party.`);
  }

  /** Share a party buff with the members near me (`near` = their ids). */
  shareBuff(skillId: string, ms: number, near: string[]): void {
    const to = near.filter((id) => this.has(id) && id !== this.me);
    if (to.length) this.h.send({ t: 'pbuff', skillId, ms, to });
  }

  /** A player left the room: same as leaving the party. */
  dropped(id: string): void { this.asked.delete(id); if (this.pendingFrom === id) this.pendingFrom = null; if (this.has(id)) this.removeMember(id); else this.h.changed(); }

  receive(m: PartyMsg): void {
    switch (m.t) {
      case 'pinv':
        if (m.to !== this.me) return;
        if (this.inParty || this.pendingFrom) { this.h.send({ t: 'pans', to: m.from, ok: false }); return; } // busy: auto-decline
        this.pendingFrom = m.from; this.h.invited(m.from); this.h.changed();
        return;
      case 'pans':
        if (m.to !== this.me || !this.asked.delete(m.from)) return;
        if (!m.ok) { this.h.notice(`${this.h.nameOf(m.from)} declined the party invite.`); this.h.changed(); return; }
        if ((this.inParty && !this.isLeader) || this.members.length >= PARTY_MAX) { this.h.changed(); return; }
        this.setMembers([...(this.members.length ? this.members : [this.me]), m.from]);
        this.h.notice(`${this.h.nameOf(m.from)} joined the party.`);
        return;
      case 'party': {
        if (m.members[0] !== m.from) return; // only a leader publishes the list
        const mine = m.members.includes(this.me);
        if (mine) {
          const joined = !this.inParty;
          this.members = [...m.members];
          if (joined) this.h.notice(`You joined ${this.h.nameOf(m.from)}'s party.`);
        } else if (this.has(m.from)) { this.members = []; this.h.notice('You are no longer in the party.'); } // removed by the leader / disbanded
        else return;
        this.h.changed();
        return;
      }
      case 'pleave':
        if (this.has(m.from)) { this.h.notice(`${this.h.nameOf(m.from)} left the party.`); this.removeMember(m.from); }
        return;
      case 'pbuff':
        if (this.has(m.from) && m.to.includes(this.me)) this.h.buff(m.from, m.skillId, m.ms);
        return;
    }
  }

  /** Remove a member; the next in line leads if the leader left. The (new) leader republishes; one left = no party. */
  private removeMember(id: string): void {
    const rest = this.members.filter((m) => m !== id);
    if (rest.length <= 1) { if (this.inParty) this.h.notice('The party was disbanded.'); this.members = []; this.h.changed(); return; }
    this.members = rest;
    if (this.isLeader) this.h.send({ t: 'party', members: rest });
    this.h.changed();
  }

  private setMembers(list: string[]): void {
    if (list.length <= 1) { this.h.send({ t: 'party', members: [this.me] }); this.members = []; this.h.changed(); return; }
    this.members = list;
    this.h.send({ t: 'party', members: list });
    this.h.changed();
  }
}
