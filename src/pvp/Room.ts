// PvP room id in the URL: ?mode=pvp&room=ABCD (other params such as qa=1 are kept).

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const ROOM_RE = /^[A-Z0-9]{3,12}$/;

export function generateRoomId(len = 4): string {
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  return [...a].map((n) => ALPHABET[n % ALPHABET.length]).join('');
}

/** Room from a ?mode=pvp URL (normalized upper-case), or null when the URL is not a PvP link. */
export function pvpRoomFromUrl(): string | null {
  const q = new URLSearchParams(window.location.search);
  if (q.get('mode') !== 'pvp') return null;
  const r = (q.get('room') ?? '').toUpperCase();
  return ROOM_RE.test(r) ? r : '';
}

export function isPvpUrl(): boolean { return pvpRoomFromUrl() !== null; }

/** Uses the URL room when valid, otherwise creates one; writes ?mode=pvp&room=ID so the link can be shared. */
export function ensurePvpRoomInUrl(): string {
  const room = pvpRoomFromUrl() || generateRoomId();
  const u = new URL(window.location.href);
  u.searchParams.set('mode', 'pvp');
  u.searchParams.set('room', room);
  window.history.replaceState(null, '', u.toString());
  return room;
}

export function clearPvpFromUrl(): void {
  const u = new URL(window.location.href);
  if (!u.searchParams.has('mode') && !u.searchParams.has('room')) return;
  u.searchParams.delete('mode');
  u.searchParams.delete('room');
  window.history.replaceState(null, '', u.toString());
}

export function newPlayerId(): string {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return `p-${a[0].toString(36)}${a[1].toString(36)}`.slice(0, 14);
}
