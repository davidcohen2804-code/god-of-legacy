// Job advancement path (MapleStory-style): a Beginner stage then 4 advancements. Skills unlock with the job — no points.
export interface Job { name: string; level: number; to: number; slots: number[] }

/** Per class: Beginner (1–19) → 1st (19–29) → 2nd (29–40) → 3rd (40–80) → 4th (80–150). `slots` = skill slots it unlocks. */
const PATH: Record<string, Job[]> = {
  warrior: [
    { name: 'Recruit', level: 1, to: 19, slots: [0, 1, 2] },            // Iron Chain, Dash Slash, Rising Slash
    { name: 'Swordsman', level: 19, to: 29, slots: [3, 9, 8] },         // Ground Breaker, Wave Slash, Leap Crash
    { name: 'Knight', level: 29, to: 40, slots: [4, 11, 12] },          // Whirlwind, Impaling Rush, War Cry
    { name: 'Holy Knight', level: 40, to: 80, slots: [10, 5, 13] },     // Radiant Blade, Sanctuary, Judgment Blade
    { name: 'Legacy Paragon', level: 80, to: 150, slots: [6, 7] },      // Blade Storm, Titan's Verdict
  ],
  book_mage: [
    { name: 'Apprentice', level: 1, to: 19, slots: [0, 1, 2] }, { name: 'Arcanist', level: 19, to: 29, slots: [3, 9, 8] },
    { name: 'Spellbinder', level: 29, to: 40, slots: [4, 11, 12] }, { name: 'Archmage', level: 40, to: 80, slots: [10, 5, 13] },
    { name: 'Codex Sovereign', level: 80, to: 150, slots: [6, 7] },
  ],
  archer: [
    { name: 'Scout', level: 1, to: 19, slots: [0, 1, 2] }, { name: 'Ranger', level: 19, to: 29, slots: [3, 9, 8] },
    { name: 'Windrunner', level: 29, to: 40, slots: [4, 11, 12] }, { name: 'Sky Hunter', level: 40, to: 80, slots: [10, 5, 13] },
    { name: 'Verdant Sovereign', level: 80, to: 150, slots: [6, 7] },
  ],
  samurai: [
    { name: 'Ronin', level: 1, to: 19, slots: [0, 1, 2] }, { name: 'Blade Initiate', level: 19, to: 29, slots: [3, 9, 8] },
    { name: 'Kensei', level: 29, to: 40, slots: [4, 11, 12] }, { name: 'Shogun', level: 40, to: 80, slots: [10, 5, 13] },
    { name: 'Dragon Sword Saint', level: 80, to: 150, slots: [6, 7] },
  ],
};
export const jobsFor = (cls: string): Job[] => PATH[cls] ?? PATH.warrior;
export const jobOfSlot = (cls: string, slot: number): Job => jobsFor(cls).find((j) => j.slots.includes(slot)) ?? jobsFor(cls)[0];
export const ADV_LABEL = ['Beginner', '1st Job', '2nd Job', '3rd Job', '4th Job'];
