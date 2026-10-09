// Combo guide (the PvP arena, left side): per class, routes that keep the foe locked from the first hit to the last — no
// moment to move, attack or get up in between (BREAK is the one way out). Every route was played in the arena by the hero
// of its class (as the fighter select gives it) against a foe that does nothing: each key pressed right after the last hit
// of the one before, and also 0.1 and 0.2 s later, from 20 px nearer and 25 px farther, at 30 to 144 frames a second, and
// between two players over a 100 ms connection; each ends on the combo's share (~30%), its hit limit, its time or its
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
export interface GuideRoute { name: string; range: GuideRange; hits: number; steps: GuideStep[] }

export const COMBO_GUIDE: Partial<Record<ClassId, GuideRoute[]>> = {
  samurai: [
    { name: 'BASIC', range: 'CLOSE', hits: 18, steps: [{ id: 'quick_slash', n: 4 }, { id: 'hundred_cuts' }] },
    { name: 'LAUNCH', range: 'CLOSE', hits: 16, steps: [{ id: 'quick_slash' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }] },
    { name: 'AIR', range: 'CLOSE', hits: 15, steps: [{ id: 'swallow_cut' }, {}, { id: 'hundred_cuts' }] },
    { name: 'SPIN', range: 'CLOSE', hits: 15, steps: [{ id: 'spin_cut' }, { id: 'hundred_cuts' }] },
    { name: 'FINISH', range: 'CLOSE', hits: 15, steps: [{ id: 'quick_slash' }, { id: 'hundred_cuts' }, { id: 'iai_strike', hold: true }] },
    { name: 'BURST', range: 'CLOSE', hits: 3, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'iai_strike' }] },
    { name: 'DASH', range: 'MID', hits: 16, steps: [{ id: 'shadow_step' }, { id: 'hundred_cuts' }, { id: 'spin_cut' }] },
    { name: 'WAVE', range: 'CLOSE', hits: 14, steps: [{ id: 'sword_wave' }, { id: 'hundred_cuts' }] },
    { name: 'PHANTOM', range: 'MID', hits: 10, steps: [{ id: 'phantom_blades' }, { id: 'falcon_dive' }] },
    { name: 'FALCON', range: 'FAR', hits: 23, steps: [{ id: 'falcon_dive' }, { id: 'hundred_cuts' }, { id: 'tornado_blade' }] },
    { name: 'ULTIMATE', range: 'FAR', hits: 11, steps: [{ id: 'blossom_storm' }, { id: 'dragon_eclipse' }] },
    // longer strings (5–7 skills): single cuts that keep him reeling, a lift, then the finisher
    { name: 'CYCLONE', range: 'CLOSE', hits: 18, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'spin_cut' }, { id: 'sword_wave' }, { id: 'tornado_blade' }] },
    { name: 'REAPER', range: 'CLOSE', hits: 15, steps: [{ id: 'quick_slash' }, { id: 'spin_cut' }, { id: 'swallow_cut' }, { id: 'phantom_blades' }, { id: 'falcon_dive' }] },
    { name: 'SPECTER', range: 'MID', hits: 14, steps: [{ id: 'shadow_step' }, { id: 'sword_wave' }, { id: 'spin_cut' }, { id: 'swallow_cut' }, { id: 'phantom_blades' }] },
    { name: 'ECLIPSE', range: 'FAR', hits: 15, steps: [{ id: 'falcon_dive' }, { id: 'shadow_step' }, { id: 'spin_cut' }, { id: 'swallow_cut' }, { id: 'dragon_eclipse' }] },
    { name: 'STEEL', range: 'CLOSE', hits: 19, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'iai_strike' }, { id: 'sword_wave' }, { id: 'spin_cut' }, { id: 'hundred_cuts' }] },
    { name: 'WRAITH', range: 'MID', hits: 15, steps: [{ id: 'shadow_step' }, { id: 'quick_slash' }, { id: 'spin_cut' }, { id: 'sword_wave' }, { id: 'swallow_cut' }, { id: 'phantom_blades' }] },
    { name: 'DRAGON', range: 'CLOSE', hits: 16, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'spin_cut' }, { id: 'sword_wave' }, { id: 'swallow_cut' }, { id: 'dragon_eclipse' }] },
    { name: 'MASTER', range: 'CLOSE', hits: 21, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'iai_strike' }, { id: 'sword_wave' }, { id: 'spin_cut' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }] },
    { name: 'TEMPEST', range: 'CLOSE', hits: 18, steps: [{ id: 'quick_slash' }, { id: 'shadow_step' }, { id: 'iai_strike' }, { id: 'sword_wave' }, { id: 'spin_cut' }, { id: 'swallow_cut' }, { id: 'tornado_blade' }] },
    // more variations: the storm, the swallow and the spin into a finisher that holds him to the last hit
    { name: 'SAKURA', range: 'MID', hits: 18, steps: [{ id: 'blossom_storm' }, { id: 'tornado_blade' }] },
    { name: 'TYPHOON', range: 'CLOSE', hits: 16, steps: [{ id: 'spin_cut' }, { id: 'tornado_blade' }] },
    { name: 'OBORO', range: 'MID', hits: 19, steps: [{ id: 'blossom_storm' }, { id: 'shadow_step' }, { id: 'tornado_blade' }] },
    { name: 'IAIDO', range: 'MID', hits: 18, steps: [{ id: 'blossom_storm' }, { id: 'iai_strike' }, { id: 'tornado_blade' }] },
    { name: 'SHOGUN', range: 'CLOSE', hits: 15, steps: [{ id: 'blossom_storm' }, { id: 'shadow_step' }, { id: 'dragon_eclipse' }] },
    { name: 'RONIN', range: 'CLOSE', hits: 17, steps: [{ id: 'swallow_cut' }, { id: 'spin_cut' }, { id: 'hundred_cuts' }] },
  ],
  // the Warrior: a launcher or a charge (and the War Cry's pull), then the Blade Storm; its other locked strings need hit-
  // confirm cancels that a 100 ms connection makes too late, so only these stand online too
  warrior: [
    { name: 'SKYBREAK', range: 'CLOSE', hits: 15, steps: [{ id: 'rising_slash' }, { id: 'blade_storm' }] },
    { name: 'QUAKE', range: 'MID', hits: 21, steps: [{ id: 'ground_breaker' }, { id: 'blade_storm' }] },
    { name: 'IMPALER', range: 'FAR', hits: 15, steps: [{ id: 'lance_thrust' }, { id: 'blade_storm' }] },
    { name: 'COMET', range: 'CLOSE', hits: 15, steps: [{ id: 'rising_slash' }, { id: 'leap_crash' }, { id: 'blade_storm' }] },
    { name: 'BATTLECRY', range: 'MID', hits: 7, steps: [{ id: 'wave_slash' }, { id: 'war_cry' }, { id: 'warrior_basic', n: 2 }, { id: 'rising_slash' }] },
  ],
  // the Book Mage: ice spikes or a lightning chain, the starlight lift, then the storm field, the cranes or the clock
  book_mage: [
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
  ],
  // the Archer: the rising arrow or a fireball, then the hawk, the vine mine, the rain or the sky
  archer: [
    { name: 'INFERNO', range: 'FAR', hits: 13, steps: [{ id: 'explosive_arrow' }, { id: 'arrow_storm' }] },
    { name: 'SKYFALL', range: 'CLOSE', hits: 9, steps: [{ id: 'rising_arrow' }, { id: 'sky_rain' }] },
    { name: 'MONSOON', range: 'CLOSE', hits: 11, steps: [{ id: 'rising_arrow' }, { id: 'arrow_storm' }] },
    { name: 'RAPTOR', range: 'CLOSE', hits: 12, steps: [{ id: 'rising_arrow' }, { id: 'spirit_hawk' }, { id: 'arrow_storm' }] },
  ],
};
