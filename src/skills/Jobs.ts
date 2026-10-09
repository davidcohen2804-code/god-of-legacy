// Job advancement path (MapleStory-style): a Beginner stage then 4 advancements. Skills unlock with the job — no points.
export interface Job { name: string; level: number; to: number; slots: number[] }

/** Per class: Beginner (1–19, basic attack only) → 1st (19–29) → 2nd (29–40) → 3rd (40–80) → 4th (80–150). `slots` = skill slots it unlocks. */
const PATH: Record<string, Job[]> = {
  warrior: [
    { name: 'Beginner', level: 1, to: 10, slots: [0] },                 // basic attack only
    // Ordered like the MapleStory Hero: 1st job = the core moves (charge, launcher, dive), 2nd = area + first buff,
    // 3rd = holy power (rush, light blade, dome), 4th = the big finishers.
    { name: 'Swordsman', level: 10, to: 29, slots: [1, 2, 8, 16] },      // Dash Slash, Rising Slash, Leap Crash, Iron Grip
    { name: 'Knight', level: 29, to: 40, slots: [3, 4, 9, 12, 18] },     // Ground Breaker, Whirlwind, Wave Slash, War Cry, Sky Breaker
    { name: 'Holy Knight', level: 40, to: 80, slots: [11, 10, 5, 14, 17] },  // Impaling Rush, Radiant Blade, Sanctuary, Iron Oath (party), Judgment Hook
    { name: 'Legacy Paragon', level: 80, to: 150, slots: [13, 6, 7, 15, 19] }, // Judgment Blade, Blade Storm, Titan's Verdict, Legacy Banner (party), Earthsplitter
  ],
  book_mage: [
    { name: 'Beginner', level: 1, to: 10, slots: [0] },
    // The mage spec: 1st = the blink, the wave and the launcher; 2nd = frost and the rune net (+ the party haste);
    // 3rd = lightning, levity, paper, time and the ward; 4th = gates, the curse, the storm, the elements and the ultimate.
    { name: 'Arcanist', level: 10, to: 29, slots: [8, 1, 3] },                       // Blink, Arcane Wave, Astral Lift
    { name: 'Spellbinder', level: 29, to: 40, slots: [2, 4, 9, 10] },                // Binding Rune, Frost Nova, Glacial Spikes, Chrono Haste (party)
    { name: 'Archmage', level: 40, to: 80, slots: [5, 11, 12, 13, 14] },             // Lightning Chain, Levity Field, Origami Flock, Chrono Sigil, Arcane Ward (party)
    { name: 'Codex Sovereign', level: 80, to: 150, slots: [15, 16, 6, 17, 7] },      // Arcane Gate, Paper Curse, Storm Field, Elemental Ascension, Time Collapse
  ],
  archer: [
    { name: 'Beginner', level: 1, to: 10, slots: [0] },
    // Ordered like the MapleStory Bowman line: 1st = launcher + speed buff, 2nd = the core shots + trap + kick,
    // 3rd = area, line, roar, high launcher, hawk, air volley; 4th = tree, party crits, storm, eagle, the ultimate.
    { name: 'Archer', level: 10, to: 29, slots: [1, 2] },                       // Rising Arrow, Bow Haste
    { name: 'Hunter', level: 29, to: 40, slots: [3, 4, 5, 8] },                  // Triple Arrow, Explosive Arrow, Retreat Kick, Vine Trap
    { name: 'Ranger', level: 40, to: 80, slots: [9, 10, 11, 12, 13, 6] },        // Rain, Piercing, Roar, Leaping Arrow, Spirit Hawk, Air Volley
    { name: 'Bowmaster', level: 80, to: 150, slots: [14, 15, 16, 17, 7] },       // Tree of Life, Hunter's Spirit, Arrow Storm, Eagle Arrow, Sky Rain
  ],
  samurai: [
    { name: 'Beginner', level: 1, to: 10, slots: [0] },
    // Ordered like the MapleStory Hayato line: 1st = the step, the launcher and the draw cut; 2nd = the spin, the wave, the
    // flurry and the shadow doubles; 3rd = the counter, the tornado, the dive, the bind and the party banner; 4th = the
    // dragon, the phantom blades, the halo, the signature and the ultimate.
    { name: 'Blade Initiate', level: 10, to: 29, slots: [1, 8, 3] },              // Shadow Step, Swallow Cut, Iai Strike
    { name: 'Kensei', level: 29, to: 40, slots: [2, 4, 9, 10] },                   // Spin Cut, Sword Wave, Hundred Cuts, Kagemusha
    { name: 'Shogun', level: 40, to: 80, slots: [5, 11, 12, 16, 13] },             // Mirage Counter, Tornado Blade, Falcon Dive, Sakura Bind, Rising Sun (party)
    { name: 'Dragon Sword Saint', level: 80, to: 150, slots: [17, 14, 15, 6, 7] }, // Dragon Ascension, Phantom Blades, God of Blades, Blossom Storm, Dragon Eclipse
  ],
  gambler: [
    { name: 'Beginner', level: 1, to: 10, slots: [0] },
    // The gambler spec: 1st = the card fan, the vault and the slam; 2nd = the shuffle, the rotor, the coin and the Showdown;
    // 3rd = the roulette, the dice, the grab, the ace and the party luck; 4th = the deck, the home run, the overload, the joker, the jackpot.
    { name: 'Cardslinger', level: 10, to: 29, slots: [1, 2, 3, 17] },             // Charged Deal, Staff Vault, Fuse Slam, Card Swap
    { name: 'Trickster', level: 29, to: 40, slots: [4, 5, 8, 6] },                // Riffle Shuffle, Rotor Staff, Coin Flip, Showdown
    { name: 'High Roller', level: 40, to: 80, slots: [9, 10, 11, 12, 13] },       // Roulette Wheel, Dice Bomb, Kinetic Grab, Ace in the Hole, Lady Luck (party)
    { name: 'Ace of Fate', level: 80, to: 150, slots: [14, 15, 16, 7] },          // 52 Pickup, Grand Slam, Kinetic Overload, Jackpot (the joker: Ace of Fate passive)
  ],
};
export const jobsFor = (cls: string): Job[] => PATH[cls] ?? PATH.warrior;
export const jobOfSlot = (cls: string, slot: number): Job => jobsFor(cls).find((j) => j.slots.includes(slot)) ?? jobsFor(cls)[0];
export const ADV_LABEL = ['Beginner', '1st Job', '2nd Job', '3rd Job', '4th Job'];
/** Level of the 1st job advancement: below it every character is the shared sword-only Beginner. */
export const BEGINNER_TO = 10;
/** TESTING (the Masters' job advancement): every character plays from at least this level. Set to 1 to turn it off. */
export const TEST_MIN_LEVEL = 10;
/** The old 1st-job level: characters made before the Masters, past it, keep the class they were made with. */
const LEGACY_JOB_LEVEL = 19;
/** Classes played in their own art from level 1 (their Beginner uses their own basic attack). Others start as the sword Beginner. */
export const OWN_BEGINNER = new Set(['archer']);
/** The class actually played: the shared sword Beginner below the 1st job, except classes in OWN_BEGINNER. */
export const playedClass = (c: { classId: string; level: number; job?: string }): string => (c.job ?? (OWN_BEGINNER.has(c.classId) || c.level >= LEGACY_JOB_LEVEL ? c.classId : 'warrior'));
/** Past the Beginner: a Master gave him his job (or an older character already past the old 1st-job level). */
export const hasJob = (c: { level: number; job?: string }): boolean => !!c.job || c.level >= LEGACY_JOB_LEVEL;
/** The level his skills and passives open by: a Beginner stays below the 1st job until a Master gives it. */
export const skillLevel = (c: { level: number; job?: string }): number => (hasJob(c) ? c.level : Math.min(c.level, BEGINNER_TO - 1));
/** Jobs a Master can give now (their player art exists). */
export const JOBS_OPEN = new Set(['warrior', 'archer', 'book_mage']);
