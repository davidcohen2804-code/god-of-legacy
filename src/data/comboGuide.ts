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
    { name: 'SAYA', tier: 'BEGINNER', style: 'IAIDO', range: 'CLOSE', hits: 6, steps: [{ id: 'quick_slash', n: 4 }, { id: 'sheathe' }, { id: 'iai_strike' }],
      tip: 'The 4th cut lifts him — sheathe at once: the click makes the draw instant and a level higher' },
    { name: 'DUELIST', tier: 'MID', style: 'IAIDO', range: 'MID', hits: 17, steps: [{ id: 'iai_strike' }, { id: 'shadow_step' }, { id: 'swallow_cut' }, { id: 'hundred_cuts' }],
      tip: 'Let the Iai go early: it reaches him from two steps — step through him, turn back with the Swallow, hold him with the cuts' },
    { name: 'SAKURA', tier: 'EXPERT', style: 'IAIDO', range: 'CLOSE', hits: 6, steps: [{ id: 'swallow_cut' }, { id: 'falcon_dive' }, { id: 'sakura_bind' }, { id: 'iai_strike', hold: true }],
      tip: 'Open the blossoms while he is still up: he falls into them and is held — then the full draw on the bound foe' },
    // SKY — launch, spin, slam
    { name: 'TSUBAME', tier: 'BEGINNER', style: 'SKY', range: 'CLOSE', hits: 5, steps: [{ id: 'swallow_cut' }, {}, { id: 'tornado_blade' }],
      tip: 'Launch him, jump after him: the air spin cuts him twice and slams him down' },
    { name: 'RYUJIN', tier: 'MID', style: 'SKY', range: 'CLOSE', hits: 9, steps: [{ id: 'quick_slash', n: 4 }, {}, { id: 'tornado_blade' }, { id: 'dragon_ascension' }],
      tip: 'Read the bounce: the golden dragon only smashes a foe in the air — strike as he bounces off the slam' },
    { name: 'MIKAZUKI', tier: 'EXPERT', style: 'SKY', range: 'CLOSE', hits: 22, steps: [{ id: 'swallow_cut' }, {}, { id: 'sword_wave' }, { id: 'tornado_blade' }, { id: 'hundred_cuts' }, { id: 'falcon_dive' }],
      tip: 'From the floor the crescent flies under a foe in the air: jump with him and fling it a beat later, level with him — then spin him down, cut him off the bounce, dive on him' },
    // PHANTOM — illusions and blossoms
    { name: 'FUBUKI', tier: 'BEGINNER', style: 'PHANTOM', range: 'MID', hits: 11, steps: [{ id: 'phantom_blades' }, { id: 'blossom_storm' }],
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
    { name: 'SHACKLE', tier: 'MID', style: 'IRON HAND', range: 'CLOSE', hits: 8, steps: [{ id: 'iron_grip' }, { id: 'leap_crash' }, { id: 'judgment_hook' }, { id: 'rising_slash' }],
      tip: 'Crash down on him out of the grip\'s pop, chain him off the floor (a grab costs no down gauge), rip him back up before he rises' },
    { name: 'STORMCHAIN', tier: 'EXPERT', style: 'IRON HAND', range: 'MID', hits: 19, steps: [{ id: 'blade_storm' }, { id: 'judgment_hook' }, { id: 'iron_grip' }, { id: 'leap_crash' }],
      tip: 'Raise the storm two steps away — armored, its swords hold him up: press nothing till they stop, then chain him out of the air, seize him, crash' },
    // SKYBREAKER — launch, chase, spike, crash on the bounce
    { name: 'SKYWARD', tier: 'BEGINNER', style: 'SKYBREAKER', range: 'CLOSE', hits: 8, steps: [{ id: 'warrior_basic' }, { id: 'rising_slash' }, { id: 'sky_breaker' }],
      tip: 'Confirm with a strike, launch him, chase him up and spike him into a bounce' },
    { name: 'REBOUND', tier: 'MID', style: 'SKYBREAKER', range: 'CLOSE', hits: 7, steps: [{ id: 'wave_slash' }, { id: 'sky_breaker' }, { id: 'leap_crash' }],
      tip: 'Pop him with the wave from close by, chase and spike him — then crash onto his one bounce' },
    { name: 'LIONHEART', tier: 'EXPERT', style: 'SKYBREAKER', range: 'CLOSE', hits: 17, steps: [{ id: 'rising_slash' }, {}, { id: 'lions_maw' }, { id: 'sky_breaker' }, { id: 'leap_crash' }],
      tip: 'Jump out of the launch: the lion holds him and drags him back in front of you — spike him, crash on the bounce' },
    // JUDGMENT — the quake, the court, the sentence
    { name: 'QUAKE', tier: 'BEGINNER', style: 'JUDGMENT', range: 'CLOSE', hits: 11, steps: [{ id: 'ground_breaker' }, { id: 'earthsplitter', hold: true }],
      tip: 'The quake holds him for free — charge the full fissure while it does' },
    { name: 'COURT', tier: 'MID', style: 'JUDGMENT', range: 'CLOSE', hits: 8, steps: [{ id: 'wave_slash' }, { id: 'judgment_blade' }, { id: 'iron_grip' }],
      tip: 'Pop him low; the blade pins him and the court chains him as he falls — land, then seize him in chains' },
    { name: 'VERDICT', tier: 'EXPERT', style: 'JUDGMENT', range: 'FAR', hits: 22, steps: [{ id: 'judgment_hook' }, { id: 'rising_slash' }, { id: 'sky_breaker' }, { id: 'judgment_blade' }, { id: 'iron_grip' }, { id: 'titans_verdict' }],
      tip: 'Throw the blade on the spike and press nothing until you land; grip him in chains — the grip\'s slam keeps him up for the Verdict' },
    // STEEL — the blade's own work: the charge through him, the cyclone, the skewer
    { name: 'GALE', tier: 'BEGINNER', style: 'STEEL', range: 'MID', hits: 6, steps: [{ id: 'dash_slash' }, { id: 'rising_slash' }],
      tip: 'Charge from two steps away and launch him right behind it — the charge holds him only an instant (late, you are past him: turn back)' },
    { name: 'CYCLONE', tier: 'MID', style: 'STEEL', range: 'CLOSE', hits: 10, steps: [{ id: 'iron_grip' }, {}, { id: 'whirlwind' }, { id: 'leap_crash' }],
      tip: 'Jump as the slam throws him up and spin in the air — the cyclone holds him and carries you under him: turn back toward him to crash' },
    { name: 'SKEWER', tier: 'EXPERT', style: 'STEEL', range: 'MID', hits: 16, steps: [{ id: 'dash_slash' }, { id: 'rising_slash' }, { id: 'sky_breaker' }, { id: 'lance_thrust' }],
      tip: 'Charge in and launch at once, chase and spike him — then run him through on his low bounce: he rides your blade to the end' },
  ],
  // the Book Mage (rebuilt 17 Oct): frost chills → freezes → a heavy hit shatters; storm conducts through the cold; arcane control
  book_mage: [
    // FROST — chill, freeze, shatter
    { name: 'RIME', tier: 'BEGINNER', style: 'FROST', range: 'CLOSE', hits: 4, steps: [{ id: 'glacial_spikes' }, { id: 'arcane_bolt', n: 3 }],
      tip: 'The spikes chill him and lift him; the first frost bolt freezes him; the lance shatters him' },
    { name: 'SHATTER', tier: 'MID', style: 'FROST', range: 'CLOSE', hits: 4, steps: [{ id: 'frost_nova' }, { id: 'glacial_spikes' }, { id: 'astral_burst' }],
      tip: 'The ring chills him (spikes on its first ring), the spikes freeze him, the starlight hand shatters him' },
    { name: 'AVALANCHE', tier: 'EXPERT', style: 'FROST', range: 'CLOSE', hits: 14, steps: [{ id: 'glacial_spikes' }, { id: 'arcane_bolt', n: 2 }, { id: 'astral_burst' }, { id: 'frost_nova' }, { id: 'arcane_bolt', n: 3 }, { id: 'lightning_chain' }],
      tip: 'Two shatters: the first bolts freeze him, the starlight hand breaks the ice and draws him back to you — burst the frost ring as he comes down into it, freeze him again, the lance breaks it' },
    // STORM — one chill, then every storm hit conducts
    { name: 'CONDUIT', tier: 'BEGINNER', style: 'STORM', range: 'CLOSE', hits: 6, steps: [{ id: 'arcane_wave' }, { id: 'lightning_chain' }],
      tip: 'The wave lifts him low and in reach; the lightning seizes him up there and holds him' },
    { name: 'SPARK', tier: 'MID', style: 'STORM', range: 'CLOSE', hits: 10, steps: [{ id: 'glacial_spikes' }, { id: 'lightning_chain' }, { id: 'arcane_bolt', n: 3 }],
      tip: 'The spikes chill him and throw him up, the chain conducts through the cold; your bolts are storm now — they seek him in the air and keep conducting' },
    { name: 'TEMPEST', tier: 'EXPERT', style: 'STORM', range: 'MID', hits: 15, steps: [{ id: 'arcane_wave' }, { id: 'glacial_spikes' }, { id: 'lightning_chain' }, { id: 'storm_field' }, { id: 'time_collapse' }],
      tip: 'Nothing froze him before: the clock\'s own freeze holds in full and its blast shatters him' },
    // ARCANE — gravity, paper, the blink
    { name: 'UPDRAFT', tier: 'BEGINNER', style: 'ARCANE', range: 'FAR', hits: 4, steps: [{ id: 'levity_field' }, { id: 'origami_flock' }],
      tip: 'The field opens under him from far away; the cranes home in while he hangs there' },
    { name: 'PAPERCUT', tier: 'MID', style: 'ARCANE', range: 'MID', hits: 4, steps: [{ id: 'arcane_wave' }, { id: 'astral_burst' }, { id: 'blink' }, { id: 'paper_curse' }],
      tip: 'Lift him, draw him back and throw him higher, blink to his height and fold him — he lands silenced' },
    { name: 'SNARE', tier: 'EXPERT', style: 'ARCANE', range: 'MID', hits: 7, steps: [{ id: 'arcane_wave' }, { id: 'binding_rune' }, { id: 'astral_burst' }, { id: 'lightning_chain' }],
      tip: 'From a few steps: lift him, lay the rune under him and wait — he falls into the net, bounces and is held; the starlight hand tears him out and throws him, the chain holds him up there' },
  ],
  // the Archer: the rising arrow, the hawk or a fireball, then the storm, the sky, the rain or the hunter's leap
  archer: [
    // MARKED — her arrows mark him (up to three); the Fireball and the wolf's roar spend them all for a bigger blow
    { name: 'EMBER', tier: 'BEGINNER', style: 'MARKED', range: 'CLOSE', hits: 3, steps: [{ id: 'quick_shot' }, { id: 'explosive_arrow' }],
      tip: "Double Shot's second arrow marks him — the Fireball burns the mark for a bigger blast that throws him up" },
    { name: 'QUARRY', tier: 'MID', style: 'MARKED', range: 'CLOSE', hits: 6, steps: [{ id: 'quick_shot', n: 2 }, { id: 'multi_shot' }, { id: 'hunters_spirit' }, { id: 'explosive_arrow' }],
      tip: 'Stack three marks — both Double Shot beats (the charged arrow bridges), Triple Arrow, Vine Lash — then the Fireball hits twice as hard' },
    { name: 'PREDATOR', tier: 'EXPERT', style: 'MARKED', range: 'CLOSE', hits: 5, steps: [{ id: 'multi_shot' }, { id: 'quick_shot' }, { id: 'piercing_arrow' }, { id: 'hunters_roar' }],
      tip: "The Spirit Bow floors him with the third mark — the wolf's roar spends all three on the fallen prey" },
    // SKY — throw him up and hunt him in the air
    { name: 'KESTREL', tier: 'BEGINNER', style: 'SKY', range: 'CLOSE', hits: 3, steps: [{ id: 'retreat_kick' }, {}, { id: 'quick_shot' }],
      tip: 'The kick throws him up as you flip away — jump and shoot him out of the air' },
    { name: 'STARFALL', tier: 'MID', style: 'SKY', range: 'FAR', hits: 14, steps: [{ id: 'eagle_arrow' }, { id: 'skyhunters_step' }, { id: 'sky_rain' }],
      tip: 'The eagles sweep him from across the arena, the volley chases him up, then the sky falls on him' },
    { name: 'HAWKEYE', tier: 'EXPERT', style: 'SKY', range: 'CLOSE', hits: 5, steps: [{ id: 'rising_arrow' }, {}, { id: 'hunters_spirit' }, { id: 'bow_haste' }, { id: 'explosive_arrow' }],
      tip: 'Up, then in the air: lash him back, Wind Step off him (its burst throws him again and marks him), burn both marks' },
    { name: 'TAILWIND', tier: 'MID', style: 'SKY', range: 'CLOSE', hits: 7, steps: [{ id: 'rising_arrow' }, { id: 'backstep_shot' }, { id: 'explosive_arrow' }, { id: 'skyhunters_step' }],
      tip: 'Let both gusts throw him, then Backstep before you recover: its arrow pins him up there — Fireball him from range, the volley leaps the gap (up close it overshoots him)' },
    { name: 'TALON', tier: 'EXPERT', style: 'SKY', range: 'MID', hits: 7, steps: [{ id: 'spirit_hawk' }, { id: 'explosive_arrow' }, { id: 'hunters_spirit' }, { id: 'retreat_kick' }, {}, { id: 'quick_shot' }],
      tip: 'The hawk strikes 1.7 s after you call it and slams him into a bounce — Fireball him, lash him only once it has struck, kick the bounce back up, jump and shoot' },
    // TRAPPER — reel him in, bind him, let him fall into the vines, the rain, the charged floor
    { name: 'BRAMBLE', tier: 'MID', style: 'TRAPPER', range: 'FAR', hits: 4, steps: [{ id: 'hunters_spirit' }, { id: 'leaping_arrow' }, { id: 'explosive_arrow' }],
      tip: 'From afar a plain arrow is only a poke: lash him in, bind him in the leaves, burn the mark' },
    { name: 'PITFALL', tier: 'EXPERT', style: 'TRAPPER', range: 'CLOSE', hits: 5, steps: [{ id: 'rising_arrow' }, { id: 'vine_trap' }, { id: 'hunters_spirit' }, { id: 'explosive_arrow' }],
      tip: 'Throw him up and lay the mine where he falls — it holds him as he lands; then lash and burn' },
    { name: 'DOWNPOUR', tier: 'BEGINNER', style: 'TRAPPER', range: 'CLOSE', hits: 16, steps: [{ id: 'rising_arrow' }, { id: 'arrow_storm' }, { id: 'explosive_arrow' }],
      tip: 'Open the rain where he hangs and let it pour out: every 5th volley marks him and the last throws him up — burn the marks with the Fireball' },
    { name: 'THUNDERHEAD', tier: 'MID', style: 'TRAPPER', range: 'CLOSE', hits: 9, steps: [{ id: 'rising_arrow' }, { id: 'rain_of_arrows' }, { id: 'eagle_arrow' }],
      tip: 'Hang in the storm: its three bolts strike him high, and as he lands the floor they charged throws him back up — the eagles take him there' },
  ],
  // the Gambler (new 17 Oct): cards planted and snapped, the staff's hammer, the house's grab
  gambler: [
    // SHORT FUSE — plant cards, then set them off (every staff blow does; the bat sets off all of them)
    { name: 'SNAP', tier: 'BEGINNER', style: 'SHORT FUSE', range: 'MID', hits: 9, steps: [{ id: 'riffle_shuffle' }, { id: 'grand_slam' }],
      tip: 'The shuffle pulls him in and its last flourish sticks two cards — the bat sets them off and sends him flying' },
    { name: 'ACEHIGH', tier: 'MID', style: 'SHORT FUSE', range: 'CLOSE', hits: 7, steps: [{ id: 'ace_in_the_hole' }, { id: 'showdown' }, { id: 'grand_slam' }],
      tip: 'The Ace sticks two cards and joins your hand; Showdown plays it without touching the cards; the bat sets them off' },
    // STAFF — spike, hammer, bat
    { name: 'HOMERUN', tier: 'BEGINNER', style: 'STAFF', range: 'CLOSE', hits: 7, steps: [{ id: 'cut_the_deck', n: 4 }, { id: 'fuse_slam' }, { id: 'grand_slam' }],
      tip: 'The rising swing lifts him, Fuse Slam spikes him into a bounce, then the home run' },
    { name: 'AFTERSHOCK', tier: 'MID', style: 'STAFF', range: 'CLOSE', hits: 29, steps: [{ id: 'light_staff' }, { id: 'fuse_slam' }, { id: 'staff_flurry' }],
      tip: 'Light the cane, spike him on the floor and flurry him there while it erupts under him — let the flurry run out: its last swing throws him' },
    { name: 'JACKPOT', tier: 'EXPERT', style: 'STAFF', range: 'MID', hits: 38, steps: [{ id: 'light_staff' }, { id: 'staff_vault' }, { id: 'staff_flurry' }, { id: 'jackpot' }],
      tip: 'Light the cane, vault in — the kick lifts him into the flurry, three seconds of the long cane hold him up, its last swing throws him — then the slot machine' },
    // HOUSE — the light cane, the bet, the switch
    { name: 'COLLAR', tier: 'BEGINNER', style: 'HOUSE', range: 'CLOSE', hits: 2, steps: [{ id: 'charged_deal' }, { id: 'grand_slam' }],
      tip: 'Plant a card in him, then the bat at once: it sets the card off and sends him flying' },
    { name: 'SWITCH', tier: 'MID', style: 'HOUSE', range: 'CLOSE', hits: 18, steps: [{ id: 'card_swap' }, { id: 'staff_vault' }, { id: 'riffle_shuffle' }, { id: 'showdown' }, { id: 'grand_slam' }],
      tip: 'Hold away from him and swap — the card bomb left behind pops him up; hold back toward him and vault in: it throws him high — let him fall, shuffle as he drops back into reach, then Showdown and the bat' },
    { name: 'HIGHROLLER', tier: 'EXPERT', style: 'HOUSE', range: 'CLOSE', hits: 29, steps: [{ id: 'light_staff' }, { id: 'charged_deal', hold: true }, { id: 'staff_flurry' }, { id: 'grand_slam' }],
      tip: 'The max bet: light the cane, hold for the five-card fan (three stick), the flurry sets them off blow by blow — then the bat' },
    // DECK — the cards on the floor are his deck: spread it, call it home, the spinning card holds him, then the snap
    { name: 'RECALL', tier: 'MID', style: 'DECK', range: 'CLOSE', hits: 16, steps: [{ id: 'riffle_shuffle' }, { id: 'call_the_deck' }, { id: 'grand_slam' }],
      tip: 'The shuffle spreads four cards round you and sticks two in him; call the deck home — the spinning card holds him up — then the bat sets the two in him off' },
    // CHANCE — the dice and the wheel: luck sets the damage or the hold, never the route
    { name: 'LOADED', tier: 'MID', style: 'CHANCE', range: 'CLOSE', hits: 9, steps: [{ id: 'dice_bomb' }, { id: 'staff_vault' }, { id: 'riffle_shuffle' }, { id: 'grand_slam' }],
      tip: 'Roll the dice and let both burst (the roll only sets the damage) — the second throws him up: vault onto him, shuffle two cards into him, the bat sets them off' },
    { name: 'REDBLACK', tier: 'EXPERT', style: 'CHANCE', range: 'MID', hits: 12, steps: [{ id: 'roulette_wheel' }, { id: 'staff_vault' }, { id: 'rotor_staff' }, { id: 'grand_slam' }],
      tip: 'Lay the wheel under him and let the ball drop (2 s): RED throws him up, BLACK binds him — the vault takes him either way; spin the rotor, then the bat sets off its cards' },
  ],
};
