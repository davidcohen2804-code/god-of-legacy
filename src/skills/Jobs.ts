// Job advancement path (MapleStory-style): a Beginner stage then 4 advancements. Skills unlock with the job — no points.
export interface Job { name: string; level: number; to: number; slots: number[] }

/** Per class: Beginner (1–19, basic attack only) → 1st (19–29) → 2nd (29–40) → 3rd (40–80) → 4th (80–150). `slots` = skill slots it unlocks. */
const PATH: Record<string, Job[]> = {
  warrior: [
    { name: 'Beginner', level: 1, to: 19, slots: [0] },                 // basic attack only
    { name: 'Swordsman', level: 19, to: 29, slots: [1, 2, 3, 9] },      // Dash Slash, Rising Slash, Ground Breaker, Wave Slash
    { name: 'Knight', level: 29, to: 40, slots: [8, 4, 11] },           // Leap Crash, Whirlwind, Impaling Rush
    { name: 'Holy Knight', level: 40, to: 80, slots: [12, 10, 5, 13] }, // War Cry, Radiant Blade, Sanctuary, Judgment Blade
    { name: 'Legacy Paragon', level: 80, to: 150, slots: [6, 7] },      // Blade Storm, Titan's Verdict
  ],
  book_mage: [
    { name: 'Beginner', level: 1, to: 19, slots: [0] }, { name: 'Arcanist', level: 19, to: 29, slots: [1, 2, 3, 9] },
    { name: 'Spellbinder', level: 29, to: 40, slots: [8, 4, 11] }, { name: 'Archmage', level: 40, to: 80, slots: [12, 10, 5, 13] },
    { name: 'Codex Sovereign', level: 80, to: 150, slots: [6, 7] },
  ],
  archer: [
    { name: 'Beginner', level: 1, to: 19, slots: [0] }, { name: 'Ranger', level: 19, to: 29, slots: [1, 2, 3, 9] },
    { name: 'Windrunner', level: 29, to: 40, slots: [8, 4, 11] }, { name: 'Sky Hunter', level: 40, to: 80, slots: [12, 10, 5, 13] },
    { name: 'Verdant Sovereign', level: 80, to: 150, slots: [6, 7] },
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
