// PvP session for one courtyard scene: transport, remote players, outgoing snapshots, incoming events.
// Prototype authority model (unchanged): each client is the authority for its own body. The caster broadcasts a cast
// intent; every victim validates it and resolves the hits against itself, then broadcasts its confirmed HP/reaction.
import Phaser from 'phaser';
import { PVP } from '../config/layout';
import { RemotePlayer } from './RemotePlayer';
import { createTransport, NetMsg, PeerMeta, Transport } from './Transport';
import type { MatchMsg } from './Match';

export interface LocalSnapshot { x: number; y: number; z: number; sz: number; dir: string; anim: string; mode: string; sp: number; vz: number; ax: number; ay: number; hp: number; alive: boolean; cos: string; mhp?: number }

export interface PvpHandlers {
  onJoined(): void;
  onFull(): void;
  onError(): void;
  getLocal(): LocalSnapshot | null;
  onCast(from: string, m: Extract<NetMsg, { t: 'cast' }>): void;
  onCounter(from: string, m: Extract<NetMsg, { t: 'ctr' }>): void;
  onRelease(from: string, m: Extract<NetMsg, { t: 'rel' }>): void;
  /** A victim confirmed (and applied) a hit from a cast. */
  onConfirmed(victim: string, m: Extract<NetMsg, { t: 'hp' }>): void;
  onRemoteLeft(id: string): void;
  onRemoteDeath?(id: string, by: string): void;
  onRemoteJoined?(id: string): void;
  onChat?(from: string, m: Extract<NetMsg, { t: 'chat' }>): void;
  /** Party messages (invite / answer / member list / leave / shared buff). */
  onParty?(m: Extract<NetMsg, { t: 'pinv' | 'pans' | 'party' | 'pleave' | 'pbuff' }>): void;
  /** Battle mode: the match state from the side running it, and rematch requests. */
  onMatch?(from: string, m: Extract<NetMsg, { t: 'match' }>): void;
  onRematch?(from: string, m: Extract<NetMsg, { t: 'rematch' }>): void;
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

  constructor(private scene: Phaser.Scene, readonly room: string, readonly meta: PeerMeta, private h: PvpHandlers) {
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
    this.keepAlive = window.setInterval(() => this.sendState(false, true), PVP.idleResendMs);
  }

  get connected(): boolean { return this.transport.status === 'connected'; }

  update(ms: number): void {
    for (const r of this.remotes.values()) r.update(ms);
    this.sinceSend += ms;
    if (this.sinceSend >= 1000 / 30) this.sendState(false);
  }

  private sendState(force: boolean, keepAlive = false): void {
    const s = this.h.getLocal();
    if (!s || !this.connected) return;
    const msg = {
      t: 'state' as const, from: this.meta.playerId, x: Math.round(s.x), y: Math.round(s.y), z: Math.round(s.z), sz: Math.round(s.sz), dir: s.dir,
      anim: s.anim, mode: s.mode, sp: Math.round(s.sp), vz: Math.round(s.vz), ax: Math.round(s.ax * 100), ay: Math.round(s.ay * 100), hp: s.hp, alive: s.alive, cos: s.cos, ...(s.mhp ? { mhp: s.mhp } : {}),
    };
    const key = `${msg.x},${msg.y},${msg.z},${msg.dir},${msg.mode},${msg.ax},${msg.ay},${msg.hp},${msg.alive},${msg.cos},${s.mhp ?? ''}`;
    if (!force && !keepAlive && key === this.lastSent) return;
    this.sinceSend = 0;
    this.lastSent = key;
    this.transport.send(msg);
  }

  forceState(): void { this.sendState(true); }

  sendHp(hp: number, by: string, extra?: Omit<Extract<NetMsg, { t: 'hp' }>, 't' | 'from' | 'hp' | 'by'>): void {
    this.transport.send({ t: 'hp', from: this.meta.playerId, hp, by, ...extra });
    this.sendState(true);
  }
  sendCast(m: Omit<Extract<NetMsg, { t: 'cast' }>, 't' | 'from'>): void {
    this.transport.send({ t: 'cast', from: this.meta.playerId, ...m });
    this.sendState(true);
  }
  sendCounter(m: Omit<Extract<NetMsg, { t: 'ctr' }>, 't' | 'from'>): void { this.transport.send({ t: 'ctr', from: this.meta.playerId, ...m }); }
  sendRelease(m: Omit<Extract<NetMsg, { t: 'rel' }>, 't' | 'from'>): void { this.transport.send({ t: 'rel', from: this.meta.playerId, ...m }); }
  sendChat(text: string, to?: string, emo?: number, party = false): void { this.transport.send({ t: 'chat', from: this.meta.playerId, text, ...(to ? { to } : {}), ...(emo !== undefined ? { emo } : {}), ...(party ? { p: true } : {}) }); }
  /** Party message (the transport broadcasts; receivers filter by `to` / membership). */
  sendParty(m: Omit<Extract<NetMsg, { t: 'pinv' }>, 'from'> | Omit<Extract<NetMsg, { t: 'pans' }>, 'from'> | Omit<Extract<NetMsg, { t: 'party' }>, 'from'> | Omit<Extract<NetMsg, { t: 'pleave' }>, 'from'> | Omit<Extract<NetMsg, { t: 'pbuff' }>, 'from'>): void {
    this.transport.send({ ...m, from: this.meta.playerId } as NetMsg);
  }
  /** Name of a player in the room (party UI). */
  nameOf(id: string): string { return this.peers.get(id)?.name ?? this.remotes.get(id)?.meta.name ?? 'Player'; }
  /** Everyone else in the room (party invite list). */
  roomPlayers(): { id: string; name: string; classId: string }[] { return [...this.peers.values()].map((p) => ({ id: p.playerId, name: p.name, classId: p.classId })); }
  sendDeath(by: string): void { this.transport.send({ t: 'death', from: this.meta.playerId, by }); }
  /** Battle mode: the match state (sent by the side running the match). */
  sendMatch(m: MatchMsg): void { this.transport.send({ t: 'match', from: this.meta.playerId, ...m }); }
  sendRematch(mid: string): void { this.transport.send({ t: 'rematch', from: this.meta.playerId, mid }); }
  sendRespawn(x: number, y: number, hp: number): void {
    this.transport.send({ t: 'respawn', from: this.meta.playerId, x: Math.round(x), y: Math.round(y), hp });
    this.sendState(true);
  }

  private receive(m: NetMsg): void {
    if (this.destroyed || m.from === this.meta.playerId) return;
    this.lastNet = performance.now();
    if (m.t === 'leave') { this.removeRemote(m.from); this.peers.delete(m.from); return; }
    if (m.t === 'pinv' || m.t === 'pans' || m.t === 'party' || m.t === 'pleave' || m.t === 'pbuff') { this.h.onParty?.(m); return; }
    if (m.t === 'state') {
      const r = this.remotes.get(m.from);
      if (r) r.applyState(m);
      else { this.pending.set(m.from, m); this.tryCreate(m.from); }
      return;
    }
    const r = this.remotes.get(m.from);
    if (!r) return;
    if (m.t === 'cast') this.h.onCast(m.from, m);
    else if (m.t === 'ctr') this.h.onCounter(m.from, m);
    else if (m.t === 'rel') this.h.onRelease(m.from, m);
    else if (m.t === 'chat') this.h.onChat?.(m.from, m);
    else if (m.t === 'hp') { r.setHp(m.hp, m); if (m.castId) this.h.onConfirmed(m.from, m); }
    else if (m.t === 'death') { r.die(); this.h.onRemoteDeath?.(m.from, m.by); }
    else if (m.t === 'respawn') r.revive(m.x, m.y, m.hp);
    else if (m.t === 'match') this.h.onMatch?.(m.from, m);
    else if (m.t === 'rematch') this.h.onRematch?.(m.from, m);
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
    if (added) this.sendState(true);
  }

  private tryCreate(id: string): void {
    const meta = this.peers.get(id), st = this.pending.get(id);
    if (!meta || !st || this.remotes.has(id)) return;
    const r = new RemotePlayer(this.scene, meta, st.x, st.y);
    r.applyState(st);
    this.remotes.set(id, r);
    this.pending.delete(id);
    this.h.onRemoteJoined?.(id);
  }

  private removeRemote(id: string): void {
    if (this.remotes.has(id)) this.h.onRemoteLeft(id);
    this.remotes.get(id)?.destroy();
    this.remotes.delete(id);
    this.pending.delete(id);
  }

  qaInfo(): Record<string, string> {
    return {
      Mode: 'PVP', Room: this.room, Transport: this.transport.kind, Connection: this.transport.status, LocalId: this.meta.playerId,
      Players: `${this.connected ? this.remotes.size + 1 : 0} / ${PVP.maxPlayers}`,
      LastNet: this.lastNet ? `${Math.round(performance.now() - this.lastNet)} ms ago` : '—',
    };
  }

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
