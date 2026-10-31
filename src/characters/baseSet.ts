// Which base character the game draws: the rebuild's (David 31 Oct 2026, docs/REBUILD_PLAN.md — the approved character,
// tools/base/sheets/v3_male.json → body/v3, characters/v3, data/v3-*.json) for the genders it has, or the older clean base.
// The new one is the default (David 31 Oct 01:29: the base approved, the rebuild end to end); ?base=old shows the older one.
import V3_LIST from '../data/v3-anims.json';

const param = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('base') : null;
/** The rebuild's base is on. */
export const BASE_V3 = param !== 'old';
/** This gender is drawn on the rebuild's base. */
export const isV3 = (g: string): boolean => BASE_V3 && g in (V3_LIST as object);
