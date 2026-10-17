// Combo guide (the PvP arena, left side): per class, routes that keep the foe locked from the first hit to the last — no
// moment to move, attack or get up in between (BREAK is the one way out). Every route was played in the arena by the hero
// of its class (as the fighter select gives it) against a foe that does nothing: each key pressed right after the last hit
// of the one before, and also 0.1 and 0.2 s later, from 20 px nearer and 25 px farther, at 30 to 144 frames a second, and
// between two players over a 100 ms connection; each ends on the target's combo gauges (DFO-style) or its
// finisher. The routes came out of a search over every string of 2–6 skills (with and without a jump) of each class.
// The guide lists them shortest first.
import type { ClassId } from '../skills/SkillTypes';

export interface GuideStep {
  /** The skill (absent: a jump). */
  id?: string;
  /** Presses in a row (the basic chain). */
  n?: number;
  /** Hold the key until the skill is fully charged. */
  hold?: boolean;
}
/** How far away the opener reaches the foe: CLOSE up to ~120 px, MID up to ~150–180, FAR up to ~250. */
export type GuideRange = 'CLOSE' | 'MID' | 'FAR';
export interface GuideRoute {
  name: string; range: GuideRange; hits: number; steps: GuideStep[];
  /** The class's way of fighting this route plays (e.g. GRAPPLE, AERIAL, FROST): shown beside the range. */
  style?: string;
  /** What it teaches, in one line (shown under the keys until the first press). */
  tip?: string;
  /** Its level: the trials are played beginner → mid → expert. */
  tier?: GuideTier;
  /** A counter trial: the partner swings its regular attack once, this long (ms) after the reset — the blow to counter. */
  foeSwings?: number;
}
export type GuideTier = 'BEGINNER' | 'MID' | 'EXPERT';

export const COMBO_GUIDE: Partial<Record<ClassId, GuideRoute[]>> = {
  samurai: [
    { name: 'BASIC', range: 'CLOSE', hits: 18, steps: [{ id: 'quick_slash', n: 4 }, { id: 'hundred_cuts' }] },
    { name: 'LAUNCH', range: 'CLOSE', hits: 16, steps: [{ id: 'quick_slash' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }] },
    { name: 'AIR', range: 'CLOSE', hits: 15, steps: [{ id: 'swallow_cut' }, {}, { id: 'hundred_cuts' }] },
    { name: 'QUICKDRAW', range: 'CLOSE', hits: 3, steps: [{ id: 'swallow_cut' }, { id: 'sheathe' }, { id: 'iai_strike' }] },
    { name: 'FINISH', range: 'CLOSE', hits: 15, steps: [{ id: 'quick_slash' }, { id: 'hundred_cuts' }, { id: 'iai_strike', hold: true }] },
    { name: 'BURST', range: 'CLOSE', hits: 3, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'iai_strike' }] },
    { name: 'DASH', range: 'MID', hits: 15, steps: [{ id: 'shadow_step' }, { id: 'hundred_cuts' }, { id: 'sheathe' }, { id: 'iai_strike' }] },
    { name: 'WAVE', range: 'CLOSE', hits: 14, steps: [{ id: 'sword_wave' }, { id: 'hundred_cuts' }] },
    { name: 'FALCON', range: 'FAR', hits: 19, steps: [{ id: 'falcon_dive' }, { id: 'hundred_cuts' }, { id: 'blossom_storm' }] },
    { name: 'ULTIMATE', range: 'FAR', hits: 11, steps: [{ id: 'blossom_storm' }, { id: 'dragon_eclipse' }] },
    { name: 'DUELIST', range: 'MID', hits: 17, steps: [{ id: 'iai_strike' }, { id: 'shadow_step' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }] },
    // longer strings (5–7 skills): single cuts that keep him reeling, a lift, then the finisher
    { name: 'CYCLONE', range: 'CLOSE', hits: 18, steps: [{ id: 'quick_slash' }, { id: 'sword_wave' }, { id: 'shadow_step' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }] },
    { name: 'REAPER', range: 'CLOSE', hits: 18, steps: [{ id: 'quick_slash' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }, { id: 'falcon_dive' }] },
    { name: 'SPECTER', range: 'MID', hits: 17, steps: [{ id: 'shadow_step' }, { id: 'quick_slash' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }] },
    { name: 'ECLIPSE', range: 'FAR', hits: 11, steps: [{ id: 'falcon_dive' }, { id: 'shadow_step' }, { id: 'dragon_eclipse' }] },
    { name: 'STEEL', range: 'CLOSE', hits: 17, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'iai_strike' }, { id: 'sword_wave' }, { id: 'hundred_cuts' }] },
    { name: 'WRAITH', range: 'MID', hits: 18, steps: [{ id: 'shadow_step' }, { id: 'quick_slash' }, { id: 'sword_wave' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }] },
    { name: 'DRAGON', range: 'CLOSE', hits: 6, steps: [{ id: 'quick_slash' }, { id: 'sword_wave' }, { id: 'shadow_step' }, { id: 'swallow_cut' }, { id: 'dragon_eclipse' }] },
    { name: 'MASTER', range: 'CLOSE', hits: 19, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'iai_strike' }, { id: 'sword_wave' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }] },
    { name: 'TEMPEST', range: 'CLOSE', hits: 9, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'iai_strike' }, { id: 'sword_wave' }, { id: 'swallow_cut' }, {}, { id: 'tornado_blade' }] },
    // more variations: the chase, the swallow, the sheathe, and the air spin after a jump
    { name: 'SAKURA', range: 'MID', hits: 6, steps: [{ id: 'blossom_storm' }, {}, { id: 'tornado_blade' }] },
    { name: 'TYPHOON', range: 'CLOSE', hits: 5, steps: [{ id: 'swallow_cut' }, {}, { id: 'tornado_blade' }] },
    { name: 'OBORO', range: 'MID', hits: 19, steps: [{ id: 'shadow_step' }, { id: 'hundred_cuts' }, { id: 'blossom_storm' }] },
    { name: 'IAIDO', range: 'MID', hits: 4, steps: [{ id: 'blossom_storm' }, { id: 'sheathe' }, { id: 'iai_strike' }] },
    { name: 'SHOGUN', range: 'CLOSE', hits: 15, steps: [{ id: 'blossom_storm' }, { id: 'shadow_step' }, { id: 'dragon_eclipse' }] },
    { name: 'RONIN', range: 'CLOSE', hits: 16, steps: [{ id: 'swallow_cut' }, { id: 'sheathe' }, { id: 'quick_slash' }, { id: 'hundred_cuts' }] },
    // the hundred cuts, the tornado, the storm and the phantoms in other orders
    { name: 'KATANA', range: 'CLOSE', hits: 14, steps: [{ id: 'hundred_cuts' }, { id: 'sheathe' }, { id: 'iai_strike' }] },
    { name: 'GHOST', range: 'FAR', hits: 15, steps: [{ id: 'falcon_dive' }, { id: 'hundred_cuts' }, { id: 'sheathe' }, { id: 'iai_strike' }] },
    { name: 'PETAL', range: 'CLOSE', hits: 18, steps: [{ id: 'blossom_storm' }, { id: 'hundred_cuts' }] },
    { name: 'SWALLOW', range: 'CLOSE', hits: 20, steps: [{ id: 'swallow_cut' }, { id: 'hundred_cuts' }, { id: 'blossom_storm' }] },
    { name: 'HANAMI', range: 'CLOSE', hits: 19, steps: [{ id: 'hundred_cuts' }, { id: 'quick_slash' }, { id: 'blossom_storm' }] },
    { name: 'HAYABUSA', range: 'CLOSE', hits: 17, steps: [{ id: 'swallow_cut' }, { id: 'falcon_dive' }, { id: 'hundred_cuts' }] },
    { name: 'SPIRAL', range: 'CLOSE', hits: 6, steps: [{ id: 'swallow_cut' }, { id: 'sheathe' }, { id: 'quick_slash' }, {}, { id: 'tornado_blade' }] },
    { name: 'MIRAGE', range: 'CLOSE', hits: 15, steps: [{ id: 'hundred_cuts' }, { id: 'quick_slash' }, { id: 'sheathe' }, { id: 'iai_strike' }] },
    { name: 'KENSEI', range: 'CLOSE', hits: 8, steps: [{ id: 'blossom_storm' }, { id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'iai_strike' }] },
  ],
  // the Warrior: a launcher, a charge, a leap or the sanctuary (the War Cry's pull, the Iron Oath), then the Blade Storm,
  // the Verdict or the Ground Breaker; strings that need hit-confirm cancels miss over a 100 ms connection and are left out
  warrior: [
    // the PvP balance pass: each skill leads to 2–3 others — open, grab, launch, chase or spin, the court, the beating, the
    // Verdict (measured in the arena against a foe that does nothing: every skill lands while he cannot act)
    { name: 'JUDGMENT', range: 'CLOSE', hits: 22, steps: [{ id: 'warrior_basic' }, { id: 'rising_slash' }, { id: 'sky_breaker' }, { id: 'judgment_blade' }, { id: 'lance_thrust' }, { id: 'titans_verdict' }] },
    { name: 'IRONCLAD', range: 'CLOSE', hits: 22, steps: [{ id: 'iron_grip' }, { id: 'rising_slash' }, { id: 'ground_breaker' }, { id: 'judgment_blade' }, { id: 'lance_thrust' }, { id: 'titans_verdict' }] },
    { name: 'HOOKSHOT', range: 'FAR', hits: 24, steps: [{ id: 'judgment_hook' }, { id: 'rising_slash' }, { id: 'ground_breaker' }, { id: 'lions_maw' }, { id: 'lance_thrust' }, { id: 'titans_verdict' }] },
    { name: 'SHIELDWALL', range: 'MID', hits: 22, steps: [{ id: 'shield_charge' }, { id: 'iron_grip' }, { id: 'rising_slash' }, { id: 'sky_breaker' }, { id: 'lions_maw' }, { id: 'titans_verdict' }] },
  ],
  // the Book Mage: ice spikes, a lightning chain or the storm field, the starlight lift or a blink, then the storm field, the
  // chain, the cranes or the clock
  book_mage: [
    { name: 'BOOKBIND', range: 'CLOSE', hits: 10, steps: [{ id: 'page_bind' }, { id: 'lightning_chain' }, { id: 'storm_field' }] },
    { name: 'GLACIER', range: 'MID', hits: 8, steps: [{ id: 'glacial_spikes' }, { id: 'storm_field' }] },
    { name: 'EPOCH', range: 'MID', hits: 8, steps: [{ id: 'glacial_spikes' }, { id: 'time_collapse' }] },
    { name: 'ORIGAMI', range: 'MID', hits: 11, steps: [{ id: 'glacial_spikes' }, { id: 'origami_flock' }] },
    { name: 'STARFALL', range: 'MID', hits: 6, steps: [{ id: 'astral_burst' }, { id: 'glacial_spikes' }] },
    { name: 'STATIC', range: 'MID', hits: 6, steps: [{ id: 'lightning_chain' }, { id: 'arcane_wave' }] },
    { name: 'HEX', range: 'MID', hits: 10, steps: [{ id: 'glacial_spikes' }, { id: 'paper_curse' }, { id: 'storm_field' }] },
    { name: 'THUNDER', range: 'MID', hits: 9, steps: [{ id: 'lightning_chain' }, { id: 'astral_burst' }, { id: 'storm_field' }] },
    { name: 'BLIZZARD', range: 'MID', hits: 6, steps: [{ id: 'frost_nova' }, { id: 'astral_burst' }, { id: 'storm_field' }] },
    { name: 'SNOWBIRD', range: 'MID', hits: 10, steps: [{ id: 'frost_nova' }, { id: 'astral_burst' }, { id: 'origami_flock' }] },
    { name: 'PRISM', range: 'MID', hits: 10, steps: [{ id: 'lightning_chain' }, { id: 'astral_burst' }, { id: 'glacial_spikes' }] },
    { name: 'CODEX', range: 'MID', hits: 13, steps: [{ id: 'lightning_chain' }, { id: 'astral_burst' }, { id: 'origami_flock' }] },
    { name: 'SUPERCELL', range: 'MID', hits: 11, steps: [{ id: 'lightning_chain' }, { id: 'astral_burst' }, { id: 'arcane_wave' }, { id: 'storm_field' }] },
    { name: 'AURORA', range: 'MID', hits: 8, steps: [{ id: 'frost_nova' }, { id: 'astral_burst' }, { id: 'arcane_wave' }, { id: 'storm_field' }] },
    { name: 'ZENITH', range: 'MID', hits: 14, steps: [{ id: 'lightning_chain' }, { id: 'astral_burst' }, { id: 'arcane_wave' }, {}, { id: 'origami_flock' }] },
    { name: 'LEVITY', range: 'MID', hits: 11, steps: [{ id: 'glacial_spikes' }, { id: 'paper_curse' }, {}, { id: 'levity_field' }, { id: 'origami_flock' }] },
    { name: 'FROSTWING', range: 'MID', hits: 11, steps: [{ id: 'frost_nova' }, { id: 'astral_burst' }, { id: 'arcane_wave' }, {}, { id: 'origami_flock' }] },
    { name: 'GRIMOIRE', range: 'MID', hits: 10, steps: [{ id: 'astral_burst' }, { id: 'arcane_wave' }, { id: 'paper_curse' }, {}, { id: 'origami_flock' }] },
    { name: 'NOVA', range: 'MID', hits: 10, steps: [{ id: 'astral_burst' }, { id: 'arcane_wave' }, { id: 'frost_nova' }, {}, { id: 'origami_flock' }] },
    { name: 'PARADOX', range: 'MID', hits: 10, steps: [{ id: 'glacial_spikes' }, {}, { id: 'paper_curse' }, { id: 'levity_field' }, { id: 'arcane_wave' }, { id: 'lightning_chain' }] },
    { name: 'VOLTAGE', range: 'FAR', hits: 9, steps: [{ id: 'storm_field' }, { id: 'lightning_chain' }] },
    { name: 'ICEBOLT', range: 'CLOSE', hits: 11, steps: [{ id: 'glacial_spikes' }, { id: 'lightning_chain' }] },
    { name: 'NEBULA', range: 'MID', hits: 5, steps: [{ id: 'storm_field' }, { id: 'astral_burst' }] },
    { name: 'CHRONO', range: 'FAR', hits: 5, steps: [{ id: 'storm_field' }, { id: 'time_collapse' }] },
    { name: 'SIGIL', range: 'MID', hits: 8, steps: [{ id: 'glacial_spikes' }, { id: 'paper_curse' }] },
    { name: 'CRANE', range: 'MID', hits: 11, steps: [{ id: 'origami_flock' }, { id: 'storm_field' }] },
    { name: 'SQUALL', range: 'MID', hits: 10, steps: [{ id: 'glacial_spikes' }, { id: 'arcane_wave' }, { id: 'storm_field' }] },
    { name: 'PLASMA', range: 'MID', hits: 9, steps: [{ id: 'storm_field' }, { id: 'astral_burst' }, { id: 'lightning_chain' }] },
  ],
  // the Archer: the rising arrow, the hawk or a fireball, then the storm, the sky, the rain or the hunter's leap
  archer: [
    { name: 'INFERNO', range: 'FAR', hits: 13, steps: [{ id: 'explosive_arrow' }, { id: 'arrow_storm' }] },
    { name: 'SKYFALL', range: 'CLOSE', hits: 9, steps: [{ id: 'rising_arrow' }, { id: 'sky_rain' }] },
    { name: 'MONSOON', range: 'CLOSE', hits: 11, steps: [{ id: 'rising_arrow' }, { id: 'arrow_storm' }] },
    { name: 'RAPTOR', range: 'CLOSE', hits: 12, steps: [{ id: 'rising_arrow' }, { id: 'spirit_hawk' }, { id: 'arrow_storm' }] },
    { name: 'TALON', range: 'MID', hits: 14, steps: [{ id: 'spirit_hawk' }, { id: 'arrow_storm' }] },
    { name: 'FIREFALL', range: 'MID', hits: 8, steps: [{ id: 'explosive_arrow' }, { id: 'sky_rain' }] },
    { name: 'PHOENIX', range: 'MID', hits: 14, steps: [{ id: 'spirit_hawk' }, { id: 'explosive_arrow' }, { id: 'arrow_storm' }] },
    { name: 'HUNTSMAN', range: 'MID', hits: 6, steps: [{ id: 'explosive_arrow' }, { id: 'vine_trap' }, { id: 'rain_of_arrows' }, { id: 'skyhunters_step' }] },
  ],
};
