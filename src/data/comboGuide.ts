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
  // the Samurai (rebuilt 17 Oct — David: every combo its own style, every step meaning something): three ways of the blade
  samurai: [
    // IAIDO — the quick-draw: the sheathe's click, the held draw, the step through him
    { name: 'SAYA', tier: 'BEGINNER', style: 'IAIDO', range: 'CLOSE', hits: 7, steps: [{ id: 'quick_slash', n: 4 }, { id: 'sheathe' }, { id: 'iai_strike' }],
      tip: 'The 4th cut lifts him — sheathe at once: the click makes the draw instant and a level higher' },
    { name: 'DUELIST', tier: 'MID', style: 'IAIDO', range: 'MID', hits: 17, steps: [{ id: 'iai_strike' }, { id: 'shadow_step' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }],
      tip: 'Let the Iai go early: it reaches him from two steps — step through him, turn back with the Swallow, hold him with the cuts' },
    { name: 'SAKURA', tier: 'EXPERT', style: 'IAIDO', range: 'CLOSE', hits: 6, steps: [{ id: 'swallow_cut' }, { id: 'falcon_dive' }, { id: 'sakura_bind' }, { id: 'iai_strike', hold: true }],
      tip: 'Open the blossoms while he is still up: he falls into them and is held — then the full draw on the bound foe' },
    // SKY — launch, spin, slam
    { name: 'TSUBAME', tier: 'BEGINNER', style: 'SKY', range: 'CLOSE', hits: 5, steps: [{ id: 'swallow_cut' }, {}, { id: 'tornado_blade' }],
      tip: 'Launch him, jump after him: the air spin cuts him twice and slams him down' },
    { name: 'RYUJIN', tier: 'MID', style: 'SKY', range: 'CLOSE', hits: 8, steps: [{ id: 'quick_slash', n: 4 }, {}, { id: 'tornado_blade' }, { id: 'dragon_ascension' }],
      tip: 'Read the bounce: the golden dragon only smashes a foe in the air — strike as he bounces off the slam' },
    // PHANTOM — illusions and blossoms
    { name: 'FUBUKI', tier: 'BEGINNER', style: 'PHANTOM', range: 'MID', hits: 13, steps: [{ id: 'phantom_blades' }, { id: 'blossom_storm' }],
      tip: 'The phantom blades hold him where he stands (you are armored through them); the storm chases in and throws him' },
    { name: 'MIRAGE', tier: 'MID', style: 'PHANTOM', range: 'CLOSE', hits: 16, foeSwings: 900, steps: [{ id: 'mirage' }, { id: 'hundred_cuts' }, { id: 'falcon_dive' }],
      tip: 'Wait for his swing — counter it: you reappear behind him; hold him with the cuts, dive on him' },
    { name: 'KAGEMUSHA', tier: 'EXPERT', style: 'PHANTOM', range: 'MID', hits: 15, steps: [{ id: 'kagemusha' }, { id: 'shadow_step' }, { id: 'blossom_storm' }, { id: 'dragon_eclipse' }],
      tip: 'Raise the doubles and wait for the ring to stand (half a second): your first strike is their ambush — then the storm and the eclipse' },
  ],
  // the Warrior (rebuilt 17 Oct — David: every combo its own style, every step meaning something): the Judge's three ways
  warrior: [
    // IRON HAND — grabs: no armor stops them, no gauge counts them
    { name: 'REEL', tier: 'BEGINNER', style: 'IRON HAND', range: 'FAR', hits: 3, steps: [{ id: 'judgment_hook' }, { id: 'iron_grip' }],
      tip: 'Reel him in from far with the chain, then seize him and slam him up — two grabs: no armor stops them' },
    { name: 'SHACKLE', tier: 'MID', style: 'IRON HAND', range: 'CLOSE', hits: 7, steps: [{ id: 'iron_grip' }, { id: 'leap_crash' }, { id: 'judgment_hook' }, { id: 'rising_slash' }],
      tip: 'Crash down on him out of the grip\'s pop, chain him off the floor (a grab costs no down gauge), rip him back up before he rises' },
    // SKYBREAKER — launch, chase, spike, crash on the bounce
    { name: 'SKYWARD', tier: 'BEGINNER', style: 'SKYBREAKER', range: 'CLOSE', hits: 8, steps: [{ id: 'warrior_basic' }, { id: 'rising_slash' }, { id: 'sky_breaker' }],
      tip: 'Confirm with a strike, launch him, chase him up and spike him into a bounce' },
    { name: 'REBOUND', tier: 'MID', style: 'SKYBREAKER', range: 'CLOSE', hits: 7, steps: [{ id: 'wave_slash' }, { id: 'sky_breaker' }, { id: 'leap_crash' }],
      tip: 'Pop him with the wave from close by, chase and spike him — then crash onto his one bounce' },
    { name: 'LIONHEART', tier: 'EXPERT', style: 'SKYBREAKER', range: 'CLOSE', hits: 13, steps: [{ id: 'rising_slash' }, {}, { id: 'lions_maw' }, { id: 'sky_breaker' }, { id: 'leap_crash' }],
      tip: 'Jump out of the launch: the lion holds him and drags him back in front of you — spike him, crash on the bounce' },
    // JUDGMENT — the quake, the court, the sentence
    { name: 'QUAKE', tier: 'BEGINNER', style: 'JUDGMENT', range: 'CLOSE', hits: 4, steps: [{ id: 'ground_breaker' }, { id: 'earthsplitter', hold: true }],
      tip: 'The quake holds him for free — charge the full fissure while it does' },
    { name: 'COURT', tier: 'MID', style: 'JUDGMENT', range: 'CLOSE', hits: 4, steps: [{ id: 'wave_slash' }, { id: 'judgment_blade' }, { id: 'iron_grip' }],
      tip: 'Pop him low; the blade pins him and the court chains him as he falls — land, then seize him in chains' },
    { name: 'VERDICT', tier: 'EXPERT', style: 'JUDGMENT', range: 'FAR', hits: 22, steps: [{ id: 'judgment_hook' }, { id: 'rising_slash' }, { id: 'sky_breaker' }, { id: 'judgment_blade' }, { id: 'iron_grip' }, { id: 'titans_verdict' }],
      tip: 'Throw the blade on the spike and press nothing until you land; grip him in chains — the grip\'s slam keeps him up for the Verdict' },
  ],
  // the Book Mage (rebuilt 17 Oct): frost chills → freezes → a heavy hit shatters; storm conducts through the cold; arcane control
  book_mage: [
    // FROST — chill, freeze, shatter
    { name: 'RIME', tier: 'BEGINNER', style: 'FROST', range: 'CLOSE', hits: 4, steps: [{ id: 'glacial_spikes' }, { id: 'arcane_bolt', n: 3 }],
      tip: 'The spikes chill him and lift him; the first frost bolt freezes him; the lance shatters him' },
    { name: 'SHATTER', tier: 'MID', style: 'FROST', range: 'CLOSE', hits: 4, steps: [{ id: 'frost_nova' }, { id: 'glacial_spikes' }, { id: 'astral_burst' }],
      tip: 'The ring chills him (spikes on its first ring), the spikes freeze him, the starlight hand shatters him' },
    { name: 'AVALANCHE', tier: 'EXPERT', style: 'FROST', range: 'CLOSE', hits: 14, steps: [{ id: 'glacial_spikes' }, { id: 'arcane_bolt', n: 3 }, { id: 'frost_nova' }, { id: 'arcane_bolt', n: 3 }, { id: 'lightning_chain' }],
      tip: 'Two shatters: keep the beat — the second ice takes only once the first has thawed; the chain\'s first arc shatters it' },
    // STORM — one chill, then every storm hit conducts
    { name: 'CONDUIT', tier: 'BEGINNER', style: 'STORM', range: 'CLOSE', hits: 6, steps: [{ id: 'page_bind' }, { id: 'lightning_chain' }],
      tip: 'Page Bind chills him: every arc of the chain conducts through the cold and holds him longer' },
    { name: 'SPARK', tier: 'MID', style: 'STORM', range: 'CLOSE', hits: 9, steps: [{ id: 'glacial_spikes' }, { id: 'lightning_chain' }, { id: 'blink' }, { id: 'arcane_bolt', n: 3 }],
      tip: 'Blink cuts the chain\'s end and carries you to him; your bolts are storm now and keep conducting' },
    { name: 'TEMPEST', tier: 'EXPERT', style: 'STORM', range: 'MID', hits: 12, steps: [{ id: 'arcane_wave' }, { id: 'glacial_spikes' }, { id: 'lightning_chain' }, { id: 'storm_field' }, { id: 'time_collapse' }],
      tip: 'Nothing froze him before: the clock\'s own freeze holds in full and its blast shatters him' },
    // ARCANE — gravity, paper, the blink
    { name: 'UPDRAFT', tier: 'BEGINNER', style: 'ARCANE', range: 'FAR', hits: 6, steps: [{ id: 'levity_field' }, { id: 'origami_flock' }],
      tip: 'The field opens under him from far away; the cranes home in while he hangs there' },
    { name: 'PAPERCUT', tier: 'MID', style: 'ARCANE', range: 'MID', hits: 3, steps: [{ id: 'arcane_wave' }, { id: 'astral_burst' }, { id: 'blink' }, { id: 'paper_curse' }],
      tip: 'Lift him, draw him back and throw him higher, blink to his height and fold him — he lands silenced' },
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
  // the Gambler (new 17 Oct): cards planted and snapped, the staff's hammer, the house's grab
  gambler: [
    // SHORT FUSE — plant cards, then snap them (All In throws him up by how many are stuck)
    { name: 'SNAP', tier: 'BEGINNER', style: 'SHORT FUSE', range: 'MID', hits: 9, steps: [{ id: 'riffle_shuffle' }, { id: 'all_in' }],
      tip: 'The shuffle pulls him in and its last flourish sticks two cards — snap them after it (no cards: All In whiffs)' },
    { name: 'ACEHIGH', tier: 'MID', style: 'SHORT FUSE', range: 'CLOSE', hits: 8, steps: [{ id: 'ace_in_the_hole' }, { id: 'showdown' }, { id: 'all_in' }, { id: 'grand_slam' }],
      tip: 'The Ace sticks two cards and joins your hand; Showdown plays it without touching the cards; snap them, then the bat' },
    // STAFF — spike, hammer, bat
    { name: 'HOMERUN', tier: 'BEGINNER', style: 'STAFF', range: 'CLOSE', hits: 6, steps: [{ id: 'cut_the_deck', n: 4 }, { id: 'fuse_slam' }, { id: 'grand_slam' }],
      tip: 'The rising swing lifts him, Fuse Slam spikes him into a bounce, then the home run' },
    { name: 'AFTERSHOCK', tier: 'MID', style: 'STAFF', range: 'CLOSE', hits: 6, steps: [{ id: 'fuse_slam' }, { id: 'triple_down' }, { id: 'grand_slam' }],
      tip: 'Hammer him on the charged floor at once: it erupts under the hammers and the third throws him up — then the bat' },
    { name: 'JACKPOT', tier: 'EXPERT', style: 'STAFF', range: 'MID', hits: 32, steps: [{ id: 'staff_vault' }, { id: 'rotor_staff' }, { id: 'all_in' }, { id: 'fuse_slam' }, { id: 'triple_down' }, { id: 'jackpot' }],
      tip: 'Let the rotor spin out (five cards: the biggest snap), spike him, three hammers — and the slot machine' },
    // HOUSE — grab, bomb, switch
    { name: 'COLLAR', tier: 'BEGINNER', style: 'HOUSE', range: 'CLOSE', hits: 5, steps: [{ id: 'charged_deal' }, { id: 'kinetic_grab' }, { id: 'all_in' }],
      tip: 'Plant a card first; the grab keeps it on him; the snap throws him up' },
    { name: 'SWITCH', tier: 'MID', style: 'HOUSE', range: 'CLOSE', hits: 10, steps: [{ id: 'card_swap' }, { id: 'staff_vault' }, { id: 'showdown' }, { id: 'grand_slam' }],
      tip: 'Swap away from him: the card bomb you leave pops him up — vault back in, Showdown, the bat' },
    { name: 'HIGHROLLER', tier: 'EXPERT', style: 'HOUSE', range: 'CLOSE', hits: 6, steps: [{ id: 'charged_deal', hold: true }, { id: 'kinetic_grab' }, { id: 'all_in' }, { id: 'grand_slam' }],
      tip: 'The max bet: hold for the five-card fan (three stick), grab him, a three-card snap twice as high — then the bat' },
  ],
};
