// Job advancement path (MapleStory-style): a Beginner stage then 4 advancements. Skills unlock with the job — no points.
export interface Job { name: string; level: number; to: number; slots: number[] }

/** Per class: Beginner (1–19, basic attack only) → 1st (19–29) → 2nd (29–40) → 3rd (40–80) → 4th (80–150). `slots` = skill slots it unlocks. */
const PATH: Record<string, Job[]> = {
  warrior: [
    { name: 'Beginner', level: 1, to: 19, slots: [0] },                 // basic attack only
    // Ordered like the MapleStory Hero: 1st job = the core moves (charge, launcher, dive), 2nd = area + first buff,
    // 3rd = holy power (rush, light blade, dome), 4th = the big finishers.
    { name: 'Swordsman', level: 19, to: 29, slots: [1, 2, 8] },          // Dash Slash, Rising Slash, Leap Crash
    { name: 'Knight', level: 29, to: 40, slots: [3, 4, 9, 12] },         // Ground Breaker, Whirlwind, Wave Slash, War Cry
    { name: 'Holy Knight', level: 40, to: 80, slots: [11, 10, 5, 14] },  // Impaling Rush, Radiant Blade, Sanctuary, Iron Oath (party)
    { name: 'Legacy Paragon', level: 80, to: 150, slots: [13, 6, 7, 15] }, // Judgment Blade, Blade Storm, Titan's Verdict, Legacy Banner (party)
  ],
  book_mage: [
    { name: 'Beginner', level: 1, to: 19, slots: [0] }, { name: 'Arcanist', level: 19, to: 29, slots: [1, 2, 3, 9] },
    { name: 'Spellbinder', level: 29, to: 40, slots: [8, 4, 11] }, { name: 'Archmage', level: 40, to: 80, slots: [12, 10, 5, 13] },
    { name: 'Codex Sovereign', level: 80, to: 150, slots: [6, 7] },
  ],
  archer: [
    { name: 'Beginner', level: 1, to: 19, slots: [0] },
    // Ordered like the MapleStory Bowman line: 1st = launcher + speed buff, 2nd = the core shots + trap + kick,
    // 3rd = area, line, roar, high launcher, hawk, air volley; 4th = tree, party crits, storm, eagle, the ultimate.
    { name: 'Archer', level: 19, to: 29, slots: [1, 2] },                       // Rising Arrow, Bow Haste
    { name: 'Hunter', level: 29, to: 40, slots: [3, 4, 5, 8] },                  // Triple Arrow, Explosive Arrow, Retreat Kick, Vine Trap
    { name: 'Ranger', level: 40, to: 80, slots: [9, 10, 11, 12, 13, 6] },        // Rain, Piercing, Roar, Leaping Arrow, Spirit Hawk, Air Volley
    { name: 'Bowmaster', level: 80, to: 150, slots: [14, 15, 16, 17, 7] },       // Tree of Life, Hunter's Spirit, Arrow Storm, Eagle Arrow, Sky Rain
  ],
  samurai: [
    { name: 'Beginner', level: 1, to: 19, slots: [0] }, { name: 'Blade Initiate', level: 19, to: 29, slots: [1, 2, 3, 9] },
    { name: 'Kensei', level: 29, to: 40, slots: [8, 4, 11] }, { name: 'Shogun', level: 40, to: 80, slots: [12, 10, 5, 13] },
    { name: 'Dragon Sword Saint', level: 80, to: 150, slots: [6, 7] },
  ],
};
export const jobsFor = (cls: string): Job[] => PATH[cls] ?? PATH.warrior;
export const jobOfSlot = (cls: string, slot: number): Job => jobsFor(cls).find((j) => j.slots.includes(slot)) ?? jobsFor(cls)[0];
export const ADV_LABEL = ['Beginner', '1st Job', '2nd Job', '3rd Job', '4th Job'];
/** Level of the 1st job advancement: below it every character is the shared sword-only Beginner. */
export const BEGINNER_TO = 19;
/** Classes played in their own art from level 1 (their Beginner uses their own basic attack). Others start as the sword Beginner. */
export const OWN_BEGINNER = new Set(['archer']);
/** The class actually played: the shared sword Beginner below the 1st job, except classes in OWN_BEGINNER. */
export const playedClass = (c: { classId: string; level: number }): string => (OWN_BEGINNER.has(c.classId) || c.level >= BEGINNER_TO ? c.classId : 'warrior');
