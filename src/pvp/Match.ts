// Battle mode for the PvP arena (Tekken-style): a 1v1 match in rounds — VS, ROUND n, FIGHT!, K.O. / TIME, first to two
// round wins, VICTORY / DEFEAT, rematch. One side runs the match: the lower player id of the two (or this client against
// the sparring knight); it sends its state on every change and once a second, the other side follows it. Each client
// stays the authority for its own body and HP: a K.O. is a fighter's own death message, TIME compares the HP each reports.
import { PVP } from '../config/layout';

export type MatchPhase = 'idle' | 'vs' | 'intro' | 'fight' | 'ko' | 'over';
/** How a round ended: a K.O., both fighters down at once, the clock with a winner, the clock with equal HP. */
export type RoundEnd = 'ko' | 'double' | 'time' | 'draw';

/** The match on the wire (the 'match' message without its type and sender). */
export interface MatchMsg {
  mid: string; ph: MatchPhase; rd: number; w: [number, number]; left: number; at: number; host: string; guest: string;
  win?: string | null; why?: RoundEnd; pf?: boolean; champ?: string | null;
}

export interface MatchHooks {
  /** The phase changed (on both sides): place the fighters, lock / free the input, show the calls. */
  onPhase(m: Match, prev: MatchPhase): void;
  /** The side running the match: send its state to the other side (never called against the sparring knight). */
  send(msg: MatchMsg): void;
  /** A fighter's HP right now, as a fraction of its maximum (TIME decision, PERFECT). */
  hpFrac(id: string): number;
}

const B = PVP.battle;

export class Match {
  mid = '';
  phase: MatchPhase = 'idle';
  round = 0;
  /** Round wins: [left (the side running the match), right]. */
  wins: [number, number] = [0, 0];
  /** The fight clock: ms left in this round. */
  left: number = B.roundMs;
  /** ms spent in the current phase. */
  t = 0;
  host = '';
  guest = '';
  /** The last round: its winner (null: nobody), how it ended, won without a scratch. */
  winner: string | null = null;
  why: RoundEnd = 'ko';
  perfect = false;
  /** The match winner once it is over (null: a draw). */
  champ: string | null = null;
  /** A second fall within this many ms of the first is a DOUBLE K.O. (0 against the sparring knight: one client). */
  koWindow: number = B.koWindowMs;
  /** Who fell this round (id → ms into the fight). */
  private down = new Map<string, number>();
  private want = new Set<string>();
  private sinceSend = 0;

  constructor(readonly me: string, private hooks: MatchHooks) {}

  get active(): boolean { return this.phase !== 'idle'; }
  get isHost(): boolean { return this.host === this.me; }
  get opponent(): string { return this.host === this.me ? this.guest : this.host; }
  /** The side running the match stands on the left. */
  sideOf(id: string): 'l' | 'r' { return id === this.host ? 'l' : 'r'; }
  /** Input is free only while the fight is on (or with no match at all). */
  get locked(): boolean { return this.phase !== 'idle' && this.phase !== 'fight'; }
  /** Hits count only during the fight. */
  get live(): boolean { return this.phase === 'fight'; }
  /** Both fighters one win away (or the last round allowed): FINAL ROUND. */
  get finalRound(): boolean { return (this.wins[0] === B.winsNeeded - 1 && this.wins[1] === B.winsNeeded - 1) || this.round >= B.maxRounds; }
  wants(id: string): boolean { return this.want.has(id); }

  /** This side starts a new match against `guest` (it runs it). */
  start(guest: string): void {
    this.mid = `${this.me}.${Date.now().toString(36)}`;
    this.host = this.me; this.guest = guest;
    this.wins = [0, 0]; this.round = 0; this.champ = null; this.winner = null; this.want.clear(); this.down.clear();
    this.left = B.roundMs;
    this.go('vs');
  }

  /** The match ends without a result (the opponent left, a third player came in). */
  abort(): void {
    if (this.phase === 'idle') return;
    const prev = this.phase;
    this.phase = 'idle'; this.mid = ''; this.t = 0; this.down.clear(); this.want.clear();
    this.hooks.onPhase(this, prev);
  }

  /** A fighter fell (its own death message, or the sparring knight's last HP). */
  death(id: string): void {
    if (this.phase !== 'fight' || (id !== this.host && id !== this.guest) || this.down.has(id)) return;
    this.down.set(id, this.t);
  }

  /** `ms` real time (the phases), `clockMs` game time (the fight clock: slow motion slows it too). */
  update(ms: number, clockMs: number): void {
    if (this.phase === 'idle') return;
    this.t += ms;
    if (this.phase === 'fight') this.left = Math.max(0, this.left - clockMs);
    if (!this.isHost) return; // the other side follows the messages (its clock runs on between them)
    if (this.phase === 'vs' && this.t >= B.vsMs) this.nextRound();
    else if (this.phase === 'intro' && this.t >= B.introMs) this.go('fight');
    else if (this.phase === 'fight') {
      if (this.down.size) { const first = Math.min(...this.down.values()); if (this.down.size >= 2 || this.t - first >= this.koWindow) this.decideKo(); }
      else if (this.left <= 0) this.decideTime();
    } else if (this.phase === 'ko' && this.t >= B.koMs) {
      if (this.wins[0] >= B.winsNeeded || this.wins[1] >= B.winsNeeded || this.round >= B.maxRounds) this.finish();
      else this.nextRound();
    }
    this.sinceSend += ms;
    if (this.sinceSend >= 1000) this.broadcast();
  }

  /** The other side: the state from the side running the match. */
  apply(from: string, m: MatchMsg): void {
    if (m.guest !== this.me || m.host !== from) return; // not a match of mine
    const fresh = m.mid !== this.mid;
    if (fresh) { this.mid = m.mid; this.host = m.host; this.guest = m.guest; this.want.clear(); this.champ = null; }
    this.round = m.rd; this.wins = [m.w[0], m.w[1]];
    this.winner = m.win ?? null; this.why = m.why ?? 'ko'; this.perfect = !!m.pf; this.champ = m.champ ?? null;
    if (m.ph === 'fight' || m.ph === 'intro' || m.ph === 'vs') this.left = m.ph === 'fight' ? m.left : B.roundMs;
    if (!fresh && m.ph === this.phase) return;
    if (m.ph === 'fight' && this.phase !== 'intro') this.go('intro', 0); // the round's start was missed: set it up first
    this.go(m.ph, m.at);
  }

  /** Over: `id` wants a rematch. The side running the match starts a new one once both do. */
  rematch(id: string, mid = this.mid): void {
    if (this.phase !== 'over' || mid !== this.mid || (id !== this.host && id !== this.guest)) return;
    this.want.add(id);
    if (this.isHost && this.want.has(this.host) && this.want.has(this.guest)) this.start(this.guest);
  }

  // ------------------------------------------------------------------ the side running the match

  private nextRound(): void {
    this.round++; this.down.clear(); this.left = B.roundMs; this.winner = null; this.perfect = false;
    this.go('intro');
  }

  private decideKo(): void {
    const fell = [...this.down.keys()];
    if (fell.length >= 2) { this.winner = null; this.why = 'double'; this.perfect = false; }
    else {
      this.winner = fell[0] === this.host ? this.guest : this.host; this.why = 'ko';
      this.perfect = this.hooks.hpFrac(this.winner) >= 0.999;
      this.wins[this.winner === this.host ? 0 : 1]++;
    }
    this.go('ko');
  }

  private decideTime(): void {
    const a = this.hooks.hpFrac(this.host), b = this.hooks.hpFrac(this.guest);
    this.perfect = false;
    if (Math.abs(a - b) < 0.005) { this.winner = null; this.why = 'draw'; }
    else { this.winner = a > b ? this.host : this.guest; this.why = 'time'; this.wins[a > b ? 0 : 1]++; }
    this.go('ko');
  }

  private finish(): void {
    this.champ = this.wins[0] > this.wins[1] ? this.host : this.wins[1] > this.wins[0] ? this.guest : null;
    this.want.clear();
    this.go('over');
  }

  private go(ph: MatchPhase, at = 0): void {
    const prev = this.phase;
    this.phase = ph; this.t = at;
    if (this.isHost) this.broadcast();
    this.hooks.onPhase(this, prev);
  }

  private broadcast(): void {
    this.sinceSend = 0;
    this.hooks.send({ mid: this.mid, ph: this.phase, rd: this.round, w: [this.wins[0], this.wins[1]], left: Math.round(this.left), at: Math.round(this.t), host: this.host, guest: this.guest,
      ...(this.phase === 'ko' ? { win: this.winner, why: this.why, pf: this.perfect } : {}), ...(this.phase === 'over' ? { champ: this.champ } : {}) });
  }
}
