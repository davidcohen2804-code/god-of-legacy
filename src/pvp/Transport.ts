// PvP network transport: Supabase Realtime when credentials exist, otherwise a same-origin BroadcastChannel
// (local QA fallback only — works between tabs of one browser, never between computers).
// Presence = who is in the room (join/leave). Broadcast = all gameplay messages.

export interface PeerMeta { playerId: string; characterId: string; classId: string; name: string }

/** Network messages. Movement state carries ground x/y, height z, support z, aim, animation mode and cosmetics. */
export type NetMsg =
  | { t: 'state'; from: string; x: number; y: number; z: number; sz: number; dir: string; anim: string; mode: string; sp: number; vz: number; ax: number; ay: number; hp: number; alive: boolean; cos?: string }
  | { t: 'hp'; from: string; hp: number; by: string; castId?: string; skillId?: string; hit?: number; dmg?: number; idx?: number; cid?: number; rx?: string; ends?: boolean; vz?: number; z?: number }
  | { t: 'cast'; from: string; castId: string; skillId: string; stage: number; x: number; y: number; z: number; ax: number; ay: number; px?: number; py?: number; lock?: string | null; dm?: number; rm?: number }
  | { t: 'ctr'; from: string; castId: string; x: number; y: number; z: number; ax: number; ay: number }
  /** Held skill released (Judgment Blade thrown) `at` ms into the cast, with its final aim (x1000). */
  | { t: 'rel'; from: string; castId: string; at: number; ax: number; ay: number }
  | { t: 'death'; from: string; by: string }
  | { t: 'respawn'; from: string; x: number; y: number; hp: number }
  | { t: 'leave'; from: string };

export type JoinResult = 'ok' | 'full' | 'error';
export type TransportKind = 'Supabase' | 'Local';

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

export function createTransport(room: string): Transport {
  const url = ENV.VITE_SUPABASE_URL?.trim(), key = ENV.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? new SupabaseTransport(room, url, key) : new LocalTransport(room);
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
