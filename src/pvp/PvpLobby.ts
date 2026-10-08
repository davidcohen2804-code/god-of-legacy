// The PvP select screen between two players (VS PLAYER): who else is in the room, the fighter each one points at and the
// one each locked in. Its own channel next to the arena's (room + '-SEL') on the arena's transport (Supabase online, or this
// browser's tabs for a local test). Two players at most.
import { createTransport, NetMsg, PeerMeta, Transport } from './Transport';
import { newPlayerId } from './Room';

export interface LobbyPeer { id: string; name: string; hover: string; pick: string | null }

export class PvpLobby {
  readonly me = newPlayerId();
  status: 'connecting' | 'ok' | 'full' | 'error' = 'connecting';
  private readonly t: Transport;
  private peer: LobbyPeer | null = null;
  private mine: { hover: string; pick: string | null } = { hover: '', pick: null };
  private beat = 0;
  private closed = false;

  constructor(readonly room: string, private name: string, private onChange: () => void) {
    this.t = createTransport(`${room}-SEL`);
    this.t.onMessage((m) => this.receive(m));
    this.t.onPeers((list) => this.peers(list));
  }

  get kind(): 'Supabase' | 'Local' { return this.t.kind; }
  get other(): LobbyPeer | null { return this.peer; }

  async join(hover: string): Promise<void> {
    this.mine.hover = hover;
    const meta: PeerMeta = { playerId: this.me, characterId: this.me, classId: hover, name: this.name };
    const r = await this.t.join(meta, 2);
    if (this.closed) return;
    this.status = r === 'ok' ? 'ok' : r === 'full' ? 'full' : 'error';
    if (r === 'ok') { this.send(); this.beat = window.setInterval(() => this.send(), 1000); } // late joiners hear where the cursor is
    this.onChange();
  }

  /** Where my cursor is, what I locked in and my name as that fighter (sent at once). */
  set(hover: string, pick: string | null, name = this.name): void {
    if (hover === this.mine.hover && pick === this.mine.pick && name === this.name) return;
    this.mine = { hover, pick }; this.name = name;
    this.send();
  }

  private send(): void { if (this.status === 'ok') this.t.send({ t: 'sel', from: this.me, name: this.name, hover: this.mine.hover, pick: this.mine.pick }); }

  private receive(m: NetMsg): void {
    if (this.closed || m.t !== 'sel' || m.from === this.me) return;
    if (this.peer && this.peer.id !== m.from) return; // (a third one: not in this 1v1)
    const p = { id: m.from, name: m.name || 'Player', hover: m.hover, pick: m.pick };
    if (this.peer && this.peer.hover === p.hover && this.peer.pick === p.pick && this.peer.name === p.name) return;
    this.peer = p;
    this.onChange();
  }

  private peers(list: PeerMeta[]): void {
    if (this.closed) return;
    if (this.peer && !list.some((p) => p.playerId === this.peer!.id)) { this.peer = null; this.onChange(); } // gone
    if (!this.peer && list[0]) { this.peer = { id: list[0].playerId, name: list[0].name, hover: list[0].classId, pick: null }; this.send(); this.onChange(); }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.beat);
    this.t.close();
  }
}
