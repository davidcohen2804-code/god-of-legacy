// The fighting styles' own mechanics (GPT's designs, scratchpad styles/*_styles.md; David 4 Nov 14:59): their numbers and
// the small rules every screen shares. Which strikes feed or spend them is the kit's (FinalKit: a hit's `pol` / `tack`, a
// skill's `earns` / `spends` / `charged` / `stakes`); the scene keeps their state and judges them (LegacyCourtyardScene:
// styleHit on the screen that judges a hit, styleConfirm on the attacker's, styleSpend at a cast's start).
import { PACE } from './SkillTypes';
import type { HitEvent, HitShape } from './SkillTypes';

const D = (ms: number) => Math.round(ms / PACE);

/** The Fulminant Conductor's Polarity: every strike + or −. A + hit marks the foe (one mark, 3 s); a − hit snaps it — the
 *  Arc Snap: 40 ms more hold inside that same hit and a foe in the air caught (no extra hit, no extra juggle); once a foe
 *  per 1.2 s; a blocked or missed strike never marks; his marks go when he leaves the style. */
export const POLARITY = { markMs: 3000, snapStun: D(40), everyMs: 1200 };

/** The Sailwright's Tack: some of his hits leave a pale-mint chevron on the foe (2 at most, 3.5 s). Luff Step, Cut Across
 *  and Slipwake with Up / Down held spend one for a new angle: 24 px across the floor's depth in the wind-up and 10 px more
 *  depth to the cut either side — no teleport, no pull, no tracking; spent on a miss too; gone when he leaves the style. */
export const TACK = { max: 2, ms: 3500, drift: 24, depth: 10 };

/** The Radiant Duelist's House Edge: up to 3 Odds Facets (gold, beside him — the foe sees them). A Clean Read earns one —
 *  a staff hit with the foe in the outer quarter of its reach, or a Read the Room counter — one a cast, no farming. All In
 *  stakes them all at its start (its `stakes`); 2–3 staked and nothing lands: 120 ms more recovery. Kept, unused, in the
 *  card style. */
export const HOUSE = { max: 3, sweet: 0.75, whiffMs: 120 };

/** The Siege Warden's Gate Pressure: up to 2 charges (6 s) — one for a Threshold Check that lands, one for a Sentry Catch
 *  that catches; Lion's Clamp, Rivet Drive and Royal Portcullis spend one for their better effect (`charged`) and work
 *  without. */
export const GATE = { max: 2, ms: 6000 };

/** What the mechanics did on one hit, as the screen that judged it tells the attacker's (its HP report, `sm`). */
export const SM = { mark: 1, snap: 2, tack: 4, read: 8, tip: 16 } as const;

/** How far a hit's shape reaches along its aim (a line: its length; a sector: its range); 0 for the others. */
export function reachOf(shape: HitShape): number { return shape.kind === 'line' ? shape.length : shape.kind === 'sector' ? shape.range : 0; }

/** A Clean Read: the foe in the outer quarter of the hit's reach (`along`: his centre's distance along its aim). */
export function cleanRead(hit: HitEvent, along: number): boolean { const L = reachOf(hit.shape); return L > 0 && along >= HOUSE.sweet * L; }
