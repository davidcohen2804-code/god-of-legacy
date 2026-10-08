// PvP session score (as Tekken's select screen counts it): your wins, the draws and the other side's wins — against the
// CPU, or against one player (by room). In memory for this visit (a reload starts at 0 – 0 – 0).
export interface Tally { w: number; d: number; l: number }
const tally = new Map<string, Tally>();

export const scoreKey = (vs: 'cpu' | 'player', room?: string | null): string => (vs === 'cpu' ? 'cpu' : `room:${room ?? ''}`);
export function score(key: string): Tally { return { ...(tally.get(key) ?? { w: 0, d: 0, l: 0 }) }; }
export function addResult(key: string, r: keyof Tally): void { const t = score(key); t[r]++; tally.set(key, t); }
