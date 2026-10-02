// PvP session for one courtyard scene: transport, remote players, outgoing snapshots, incoming events.
// Prototype hit model: the attacker broadcasts its strike; the victim validates and applies damage to itself.
import Phaser from 'phaser';
import { PVP } from '../config/layout';
import { Dir } from '../world/collision';
import { RemoteFx, RemotePlayer } from './RemotePlayer';
import { createTransport, NetMsg, PeerMeta, Transport } from './Transport';

export interface LocalSnapshot { x: number; y: number; dir: Dir; anim: string; hp: number; alive: boolean }

export interface PvpHandlers {
  /** Joined the room: spawn the local player. */
  onJoined(): void;
  onFull(): void;
  onError(): void;
  /** A remote attacker's strike reached its hit moment; the scene validates it against the local player. */
  onStrike(from: string, id: number, x: number, y: number, dir: Dir): void;
  getLocal(): LocalSnapshot | null;
}

export class PvpController {
  readonly transport: Transport;
  readonly remotes = new Map<string, RemotePlayer>();
  private peers = new Map<string, PeerMeta>();
  private pending = new Map<string, Extract<NetMsg, { t: 'state' }>>();
  private sinceSend = Infinity;
  private lastSent = '';
  private lastNet = 0;
  private keepAlive = 0;
  private destroyed = false;
  private readonly onPageHide = () => this.destroy();

  constructor(private scene: Phaser.Scene, readonly room: string, readonly meta: PeerMeta, private h: PvpHandlers, private fx: RemoteFx) {
    this.transport = createTransport(room);
    this.transport.onMessage((m) => this.receive(m));
    this.transport.onPeers((list) => this.syncPeers(list));
    window.addEventListener('pagehide', this.onPageHide);
  }

  async join(): Promise<void> {
    const r = await this.transport.join(this.meta, PVP.maxPlayers);
    if (this.destroyed) return;
    if (r === 'full') { this.h.onFull(); return; }
    if (r === 'error') { this.h.onError(); return; }
    this.h.onJoined();
    this.sendState(true);
    // Keep-alive snapshot on a timer (still runs when this tab's game loop is paused in the background).
    this.keepAlive = window.setInterval(() => this.sendState(false, true), PVP.idleResendMs);
  }

  get connected(): boolean { return this.transport.status === 'connected'; }

  /** Per frame: remote interpolation + outgoing movement at PVP.sendHz when something changed. */
  update(ms: number): void {
    for (const r of this.remotes.values()) r.update(ms);
    this.sinceSend += ms;
    if (this.sinceSend >= 1000 / PVP.sendHz) this.sendState(false);
  }

  private sendState(force: boolean, keepAlive = false): void {
    const s = this.h.getLocal();
    if (!s || !this.connected) return;
    const key = `${Math.round(s.x)},${Math.round(s.y)},${s.dir},${s.anim},${s.hp},${s.alive}`;
    if (!force && !keepAlive && key === this.lastSent) return;
    this.sinceSend = 0;
    this.lastSent = key;
    this.transport.send({ t: 'state', from: this.meta.playerId, x: Math.round(s.x), y: Math.round(s.y), dir: s.dir, anim: s.anim, hp: s.hp, alive: s.alive });
  }

  sendAttack(id: number, dir: Dir, x: number, y: number): void {
    this.transport.send({ t: 'attack', from: this.meta.playerId, id, dir, x: Math.round(x), y: Math.round(y) });
    this.sendState(true);
  }
  sendStrike(id: number, dir: Dir, x: number, y: number): void {
    this.transport.send({ t: 'strike', from: this.meta.playerId, id, dir, x, y });
  }
  sendHp(hp: number, by: string): void { this.transport.send({ t: 'hp', from: this.meta.playerId, hp, by }); }
  sendDeath(by: string): void { this.transport.send({ t: 'death', from: this.meta.playerId, by }); }
  sendRespawn(x: number, y: number, hp: number): void {
    this.transport.send({ t: 'respawn', from: this.meta.playerId, x: Math.round(x), y: Math.round(y), hp });
    this.sendState(true);
  }

  private receive(m: NetMsg): void {
    if (this.destroyed || m.from === this.meta.playerId) return;
    this.lastNet = performance.now();
    if (m.t === 'leave') { this.removeRemote(m.from); this.peers.delete(m.from); return; }
    if (m.t === 'state') {
      const r = this.remotes.get(m.from);
      if (r) r.applyState(m.x, m.y, m.dir, m.anim, m.hp, m.alive);
      else { this.pending.set(m.from, m); this.tryCreate(m.from); }
      return;
    }
    const r = this.remotes.get(m.from);
    if (m.t === 'strike') { if (this.peers.has(m.from)) this.h.onStrike(m.from, m.id, m.x, m.y, m.dir as Dir); return; }
    if (!r) return;
    if (m.t === 'attack') r.startAttack(m.dir);
    else if (m.t === 'hp') r.setHp(m.hp);
    else if (m.t === 'death') r.die();
    else if (m.t === 'respawn') r.revive(m.x, m.y, m.hp);
  }

  private syncPeers(list: PeerMeta[]): void {
    if (this.destroyed) return;
    const ids = new Set(list.map((p) => p.playerId));
    for (const id of [...this.remotes.keys()]) if (!ids.has(id)) this.removeRemote(id);
    for (const id of [...this.peers.keys()]) if (!ids.has(id)) { this.peers.delete(id); this.pending.delete(id); }
    let added = false;
    for (const p of list) {
      if (!this.peers.has(p.playerId)) added = true;
      this.peers.set(p.playerId, p);
      this.tryCreate(p.playerId);
    }
    if (added) this.sendState(true); // newcomers see us immediately
  }

  /** A remote player appears once both its presence (who) and a snapshot (where) are known. */
  private tryCreate(id: string): void {
    const meta = this.peers.get(id), st = this.pending.get(id);
    if (!meta || !st || this.remotes.has(id)) return;
    const r = new RemotePlayer(this.scene, meta, st.x, st.y, this.fx);
    r.applyState(st.x, st.y, st.dir, st.anim, st.hp, st.alive);
    this.remotes.set(id, r);
    this.pending.delete(id);
  }

  private removeRemote(id: string): void {
    this.remotes.get(id)?.destroy();
    this.remotes.delete(id);
    this.pending.delete(id);
  }

  /** QA panel lines. */
  qaInfo(): Record<string, string> {
    return {
      Mode: 'PVP',
      Room: this.room,
      Transport: this.transport.kind,
      Connection: this.transport.status,
      LocalId: this.meta.playerId,
      Players: `${this.connected ? this.remotes.size + 1 : 0} / ${PVP.maxPlayers}`,
      LastNet: this.lastNet ? `${Math.round(performance.now() - this.lastNet)} ms ago` : '—',
    };
  }

  /** Leaves the room and removes every listener, remote object and timer. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('pagehide', this.onPageHide);
    clearInterval(this.keepAlive);
    if (this.connected) this.transport.send({ t: 'leave', from: this.meta.playerId });
    this.transport.close();
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
    this.peers.clear();
    this.pending.clear();
  }
}
