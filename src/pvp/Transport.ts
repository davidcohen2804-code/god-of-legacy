// PvP network transport. Online: a direct peer-to-peer link between the players' browsers (WebRTC data channel —
// no game server in the middle, so the lowest delay a connection can have), found through public Nostr relays
// (signalling only). Supabase Realtime when credentials exist and ?net=supabase. ?net=local: a same-origin
// BroadcastChannel (QA only — tabs of one browser).
// Presence = who is in the room (join/leave). Broadcast = all gameplay messages.
import type { MatchMsg } from './Match';

export interface PeerMeta { playerId: string; characterId: string; classId: string; name: string; gender?: 'male' | 'female'; hero?: boolean; look?: { hair: number; hairColor: number; skin: number; face: number; eyeColor?: number }; hair?: number; /** PvP rank points and the title worn */ rp?: number; title?: string | null }

/** Network messages. Movement state carries ground x/y, height z, support z, aim, animation mode and cosmetics (and a
 *  samurai's Kagemusha doubles: `kg`, their offsets from him). A cast made while the doubles stand is an ambush (`amb`). */
export type NetMsg =
  | { t: 'state'; from: string; x: number; y: number; z: number; sz: number; dir: string; anim: string; mode: string; sp: number; vz: number; ax: number; ay: number; hp: number; alive: boolean; cos?: string; mhp?: number; /** guarded (arena wake-up / BREAK) */ iv?: number; kg?: string; /** ms since the second jump, while in the air */ a2?: number }
  | { t: 'hp'; from: string; hp: number; by: string; castId?: string; skillId?: string; hit?: number; dmg?: number; idx?: number; cid?: number; rx?: string; ends?: boolean; vz?: number; z?: number; /** a book mage's magic reaction on the victim and how long it holds */ mx?: string; mms?: number; /** a counter hit (the victim was attacking) */ cx?: number; /** the mage's PRISM fired on this hit */ pz?: number }
  | { t: 'cast'; from: string; castId: string; skillId: string; stage: number; x: number; y: number; z: number; ax: number; ay: number; px?: number; py?: number; lock?: string | null; fu?: number; dm?: number; rm?: number; rg?: number; sp?: number; amb?: number; mf?: number; pr?: number }
  | { t: 'ctr'; from: string; castId: string; x: number; y: number; z: number; ax: number; ay: number }
  /** Held skill released (Judgment Blade thrown) `at` ms into the cast, with its final aim (x1000). */
  | { t: 'rel'; from: string; castId: string; at: number; ax: number; ay: number }
  | { t: 'death'; from: string; by: string }
  /** Chat line: to everyone in the room, or a whisper (`to` = player id). */
  | { t: 'chat'; from: string; text: string; to?: string; emo?: number; p?: boolean }
  | { t: 'respawn'; from: string; x: number; y: number; hp: number }
  | { t: 'leave'; from: string }
  /** Party: invite / answer (to one player), the leader's member list (leader first), leaving, a shared party buff. */
  | { t: 'pinv'; from: string; to: string }
  | { t: 'pans'; from: string; to: string; ok: boolean }
  | { t: 'party'; from: string; members: string[] }
  | { t: 'pleave'; from: string }
  | { t: 'pbuff'; from: string; skillId: string; ms: number; to: string[] }
  /** Battle mode: the match as the side running it sees it (phase and the ms spent in it, round, round wins, the clock,
   *  the round's result, the match winner). */
  | ({ t: 'match'; from: string } & MatchMsg)
  /** A hit this fighter saw land on `to` (castId's hit `hit`) where it saw `to` standing (x, y, z): the victim takes it
   *  when its own check missed by a small margin or it is already in this attacker's combo (lag: see onClaim). */
  | { t: 'claim'; from: string; to: string; castId: string; hit: number; x: number; y: number; z: number }
  /** Round-trip measure: a ping and its answer (the sender's own clock `ts`, sent back as it came). */
  | { t: 'ping'; from: string; ts: number }
  | { t: 'pong'; from: string; to: string; ts: number }
  /** The arena: this fighter broke out of a combo (BREAK) here. */
  | { t: 'brk'; from: string; x: number; y: number; z: number }
  /** Battle mode: this fighter wants a rematch of match `mid`. */
  | { t: 'rematch'; from: string; mid: string }
  /** The PvP select screen (its own channel): the fighter this player points at and the one locked in. */
  | { t: 'sel'; from: string; name: string; hover: string; pick: string | null };

export type JoinResult = 'ok' | 'full' | 'error';
export type TransportKind = 'Supabase' | 'Local' | 'P2P' | 'Offline';

export interface Transport {
  readonly kind: TransportKind;
  /** connecting / connected / room-full / error / closed */
  status: string;
  join(meta: PeerMeta, maxPlayers: number): Promise<JoinResult>;
  send(msg: NetMsg): void;
  onMessage(fn: (m: NetMsg) => void): void;
  /** Full list of other players in the room (self excluded), on every change. */
  onPeers(fn: (peers: PeerMeta[]) => void): void;
  close(): void;
}

const ENV = import.meta.env as Record<string, string | undefined>;

/** `offline`: VS CPU — nobody else is coming (the sparring knight lives in this page), so no network at all. */
export function createTransport(room: string, offline = false): Transport {
  if (offline) return new OfflineTransport();
  const url = ENV.VITE_SUPABASE_URL?.trim(), key = ENV.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const q = new URLSearchParams(window.location.search);
  const net = q.get('net');
  const base: Transport = net === 'local' ? new LocalTransport(room) : net === 'supabase' && url && key ? new SupabaseTransport(room, url, key) : new P2PTransport(room, q.get('relay'));
  const lag = Math.max(0, Math.min(1000, Number(q.get('lag') ?? 0) || 0)), jitter = Math.max(0, Math.min(200, Number(q.get('jitter') ?? 0) || 0));
  return lag > 0 || jitter > 0 ? new LaggedTransport(base, lag, jitter) : base;
}

/** Practice / QA: plays a connection of `lag` ms round trip (± `jitter`) on top of any transport (?lag=150&jitter=20):
 *  every incoming message waits half the round trip (in order, as a real connection delivers). DFO's practice mode has
 *  the same setting so combos can be trained at a real ping. */
class LaggedTransport implements Transport {
  get kind(): TransportKind { return this.base.kind; }
  get status(): string { return this.base.status; }
  set status(v: string) { this.base.status = v; }
  private last = 0;
  constructor(private base: Transport, private lag: number, private jitter: number) {}
  join(meta: PeerMeta, maxPlayers: number): Promise<JoinResult> { return this.base.join(meta, maxPlayers); }
  send(msg: NetMsg): void { this.base.send(msg); }
  onMessage(fn: (m: NetMsg) => void): void {
    this.base.onMessage((m) => {
      const at = Math.max(this.last, performance.now() + this.lag / 2 + (Math.random() * 2 - 1) * this.jitter); // never out of order
      this.last = at;
      window.setTimeout(() => fn(m), Math.max(0, at - performance.now()));
    });
  }
  onPeers(fn: (p: PeerMeta[]) => void): void { this.base.onPeers(fn); }
  close(): void { this.base.close(); }
}

// ---------------------------------------------------------------- Supabase Realtime

class SupabaseTransport implements Transport {
  readonly kind = 'Supabase' as const;
  status = 'connecting';
  private msgFn: (m: NetMsg) => void = () => {};
  private peersFn: (p: PeerMeta[]) => void = () => {};
  private client?: import('@supabase/supabase-js').SupabaseClient;
  private channel?: import('@supabase/supabase-js').RealtimeChannel;
  private me = '';
  private closed = false;

  constructor(private room: string, private url: string, private key: string) {}

  async join(meta: PeerMeta, maxPlayers: number): Promise<JoinResult> {
    this.me = meta.playerId;
    try {
      const { createClient } = await import('@supabase/supabase-js');
      if (this.closed) return 'error';
      // Publishable key only (client side). Never a secret key.
      this.client = createClient(this.url, this.key, { realtime: { params: { eventsPerSecond: 40 } } });
      const ch = this.client.channel(`gol-pvp-${this.room}`, { config: { broadcast: { self: false, ack: false }, presence: { key: meta.playerId } } });
      this.channel = ch;
      ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (!this.closed) this.msgFn(payload as NetMsg); });
      let synced: () => void = () => {};
      const firstSync = new Promise<void>((r) => { synced = r; });
      ch.on('presence', { event: 'sync' }, () => { synced(); if (!this.closed) this.peersFn(this.others()); });
      const sub = await new Promise<string>((resolve) => {
        ch.subscribe((s) => { if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') resolve(s); else if (s === 'CLOSED' && !this.closed) this.status = 'closed'; });
      });
      if (sub !== 'SUBSCRIBED') { this.status = 'error'; return 'error'; }
      await Promise.race([firstSync, new Promise((r) => setTimeout(r, 1500))]);
      if (this.others().length >= maxPlayers) { this.status = 'room-full'; this.close(); return 'full'; }
      await ch.track(meta);
      this.status = 'connected';
      return 'ok';
    } catch (e) {
      console.error('[pvp] supabase join failed', e);
      this.status = 'error';
      return 'error';
    }
  }

  private others(): PeerMeta[] {
    const st = this.channel?.presenceState<PeerMeta>() ?? {};
    const out: PeerMeta[] = [];
    for (const [k, list] of Object.entries(st)) if (k !== this.me && list[0]) out.push(list[0] as unknown as PeerMeta);
    return out;
  }

  send(msg: NetMsg): void {
    if (this.status !== 'connected' || !this.channel) return;
    void this.channel.send({ type: 'broadcast', event: 'm', payload: msg });
  }

  onMessage(fn: (m: NetMsg) => void): void { this.msgFn = fn; }
  onPeers(fn: (p: PeerMeta[]) => void): void { this.peersFn = fn; }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.status !== 'room-full') this.status = 'closed';
    const ch = this.channel, client = this.client;
    this.channel = undefined;
    if (ch) { void ch.untrack().catch(() => {}); void client?.removeChannel(ch); }
    void client?.realtime.disconnect();
  }
}

// ---------------------------------------------------------------- Peer to peer (WebRTC, signalled over Nostr)

/** Public Nostr relays for finding each other (with the first of trystero's own tested list) (signalling only; the game itself flows browser to browser). Many, so one
 *  being down never matters: two players meet as soon as they share any one. */
const RELAYS = ['relay.damus.io', 'nos.lol', 'relay.primal.net', 'relay.snort.social', 'offchain.pub', 'nostr.mom', 'relay.nostr.net', 'nostr.oxtr.dev'].map((h) => 'wss://' + h);
/** STUN (each browser learns its public address); a TURN relay can be added through VITE_TURN_URL / _USER / _PASS for
 *  the rare networks that block a direct link. */
const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
const APP_ID = 'god-of-legacy-pvp-v1';
/** How long a joiner listens for who is already in the room before it counts the room full or not. */
const DISCOVER_MS = 1800;

class P2PTransport implements Transport {
  readonly kind = 'P2P' as const;
  status = 'connecting';
  private msgFn: (m: NetMsg) => void = () => {};
  private peersFn: (p: PeerMeta[]) => void = () => {};
  private room?: import('trystero').Room;
  private sendMsg?: (m: NetMsg) => void;
  private sendMeta?: (m: PeerMeta, to?: string) => void;
  private peers = new Map<string, PeerMeta>(); // trystero peer id → that player
  private meta?: PeerMeta;
  private max = 2;
  private closed = false;

  constructor(private roomId: string, private relay: string | null) {}

  async join(meta: PeerMeta, maxPlayers: number): Promise<JoinResult> {
    this.meta = meta; this.max = maxPlayers;
    try {
      const { joinRoom, defaultRelayUrls } = await import('trystero');
      if (this.closed) return 'error';
      const turn = ENV.VITE_TURN_URL?.trim();
      const ice = turn ? [...ICE, { urls: turn.split(','), username: ENV.VITE_TURN_USER, credential: ENV.VITE_TURN_PASS }] : ICE;
      const room = joinRoom( // (?relay=: a test relay on this machine — no STUN needed)
        { appId: APP_ID, relayConfig: { urls: this.relay ? [this.relay] : [...new Set([...RELAYS, ...defaultRelayUrls.slice(0, 8)])], warnOnRelayFailure: false }, rtcConfig: { iceServers: this.relay ? [] : ice } }, `gol-pvp-${this.roomId}`,
        { onJoinError: (d) => console.warn('[pvp] p2p peer could not connect', d?.error ?? d), handshakeTimeoutMs: 20000 }); // (a slow device: more time to shake hands)
      this.room = room;
      type Wire = import('trystero').DataPayload;
      const m = room.makeAction('m'), who = room.makeAction('who');
      this.sendMsg = (x) => { void m.send(x as unknown as Wire).catch(() => {}); };
      this.sendMeta = (x, to) => { void who.send(x as unknown as Wire, to ? { target: to } : undefined).catch(() => {}); };
      m.onMessage = (x, { peerId }) => { if (!this.closed && this.peers.has(peerId)) this.msgFn(x as unknown as NetMsg); };
      who.onMessage = (d, { peerId }) => {
        const x = d as unknown as PeerMeta;
        if (this.closed) return;
        if (!this.peers.has(peerId) && this.peers.size >= this.max) return; // (a room already full: an extra is not one of us)
        this.peers.set(peerId, x); this.emitPeers();
      };
      room.onPeerJoin = (peerId) => { if (!this.closed && this.meta) this.sendMeta?.(this.meta, peerId); };
      room.onPeerLeave = (peerId) => { if (this.peers.delete(peerId) && !this.closed) this.emitPeers(); };
      this.status = 'connected'; // (it hears the room from now on; who is already there answers within moments)
      const t0 = performance.now();
      while (!this.closed && this.peers.size === 0 && performance.now() - t0 < DISCOVER_MS) await new Promise((r) => setTimeout(r, 100));
      if (this.closed) return 'error';
      if (this.peers.size >= maxPlayers) { this.status = 'room-full'; this.close(); return 'full'; }
      return 'ok';
    } catch (e) {
      console.error('[pvp] p2p join failed', e);
      this.status = 'error';
      return 'error';
    }
  }

  private emitPeers(): void { this.peersFn([...this.peers.values()]); }

  send(msg: NetMsg): void { if (this.status === 'connected' && this.peers.size) this.sendMsg?.(msg); }
  onMessage(fn: (m: NetMsg) => void): void { this.msgFn = fn; }
  onPeers(fn: (p: PeerMeta[]) => void): void { this.peersFn = fn; }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.status !== 'room-full') this.status = 'closed';
    this.peers.clear();
    void this.room?.leave().catch(() => {});
    this.room = undefined;
  }
}

// ---------------------------------------------------------------- Offline (VS CPU)

/** A room of one: joined at once, nothing sent, nobody heard — no relay, no peer connection, no server. */
class OfflineTransport implements Transport {
  readonly kind = 'Offline' as const;
  status = 'connecting';
  join(): Promise<JoinResult> {
    if (this.status !== 'connecting') return Promise.resolve('error');
    this.status = 'connected';
    return Promise.resolve('ok');
  }
  send(): void { /* nobody to tell */ }
  onMessage(): void { /* nobody to hear */ }
  onPeers(): void { /* nobody comes */ }
  close(): void { this.status = 'closed'; }
}

// ---------------------------------------------------------------- Local QA fallback (BroadcastChannel)

type LocalCtl =
  | { c: 'probe'; from: string }
  | { c: 'here' | 'hello' | 'beat'; from: string; meta: PeerMeta }
  | { c: 'bye'; from: string };

const BEAT_MS = 1000, PEER_TIMEOUT_MS = 3500, PROBE_MS = 400;

class LocalTransport implements Transport {
  readonly kind = 'Local' as const;
  status = 'connecting';
  private bc: BroadcastChannel;
  private msgFn: (m: NetMsg) => void = () => {};
  private peersFn: (p: PeerMeta[]) => void = () => {};
  private peers = new Map<string, { meta: PeerMeta; seen: number }>();
  private meta?: PeerMeta;
  private joined = false;
  private timers: number[] = [];

  constructor(room: string) {
    this.bc = new BroadcastChannel(`gol-pvp-${room}`);
    this.bc.onmessage = (e) => this.receive(e.data);
  }

  async join(meta: PeerMeta, maxPlayers: number): Promise<JoinResult> {
    this.meta = meta;
    this.post({ c: 'probe', from: meta.playerId });
    await new Promise((r) => setTimeout(r, PROBE_MS));
    if (this.status === 'closed') return 'error';
    if (this.peers.size >= maxPlayers) { this.status = 'room-full'; this.close(); return 'full'; }
    this.joined = true;
    this.status = 'connected';
    this.post({ c: 'hello', from: meta.playerId, meta });
    this.timers.push(window.setInterval(() => this.post({ c: 'beat', from: meta.playerId, meta }), BEAT_MS));
    this.timers.push(window.setInterval(() => this.prune(), 500));
    this.emitPeers();
    return 'ok';
  }

  private receive(d: { ctl?: LocalCtl; msg?: NetMsg }): void {
    if (this.status === 'closed' || this.status === 'room-full') return;
    if (d.msg) { if (this.joined && this.peers.has(d.msg.from)) this.msgFn(d.msg); return; }
    const c = d.ctl;
    if (!c || c.from === this.meta?.playerId) return;
    if (c.c === 'probe') { if (this.joined && this.meta) this.post({ c: 'here', from: this.meta.playerId, meta: this.meta }); return; }
    if (c.c === 'bye') { if (this.peers.delete(c.from)) this.emitPeers(); return; }
    const isNew = !this.peers.has(c.from);
    this.peers.set(c.from, { meta: c.meta, seen: performance.now() });
    if (isNew && this.joined) this.emitPeers();
  }

  private prune(): void {
    const now = performance.now();
    let changed = false;
    for (const [id, p] of this.peers) if (now - p.seen > PEER_TIMEOUT_MS) { this.peers.delete(id); changed = true; }
    if (changed) this.emitPeers();
  }

  private emitPeers(): void { this.peersFn([...this.peers.values()].map((p) => p.meta)); }
  private post(ctl: LocalCtl): void { try { this.bc.postMessage({ ctl }); } catch { /* closed */ } }

  send(msg: NetMsg): void {
    if (!this.joined || this.status !== 'connected') return;
    try { this.bc.postMessage({ msg }); } catch { /* closed */ }
  }

  onMessage(fn: (m: NetMsg) => void): void { this.msgFn = fn; }
  onPeers(fn: (p: PeerMeta[]) => void): void { this.peersFn = fn; }

  close(): void {
    if (this.status === 'closed') return;
    if (this.joined && this.meta) this.post({ c: 'bye', from: this.meta.playerId });
    if (this.status !== 'room-full') this.status = 'closed';
    this.joined = false;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    this.peers.clear();
    this.bc.onmessage = null;
    this.bc.close();
  }
}
