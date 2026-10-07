// Non-attack skills (MapleStory-style passives + the War Leap air jump). They unlock with the job advancement like the
// active kit; no key, always on. Gameplay numbers live here only.
import { jobsFor } from './Jobs';

export interface PassiveSkill {
  id: string;
  cls: string;
  /** Job advancement index (1 = 1st job … 4 = 4th job). */
  job: number;
  name: string;
  kind: 'passive' | 'movement';
  description: string;
  /** Short effect lines for the skill book. */
  effects: string[];
}

export const PASSIVES: PassiveSkill[] = [
  { id: 'war_leap', cls: 'warrior', job: 1, name: 'War Leap', kind: 'movement', description: 'Press Jump again in mid-air to leap even farther forward with a burst of wind.', effects: ['Second jump in the air', 'Forward burst of speed', 'Once per jump'] },
  { id: 'warrior_mastery', cls: 'warrior', job: 1, name: 'Warrior Mastery', kind: 'passive', description: 'Trains the warrior basics: faster on foot, higher jumps, more HP and a chance to stand firm against knockback.', effects: ['Movement speed +10%', 'Jump power +10%', 'Max HP +20%', 'Knockback resist 30%'] },
  { id: 'iron_body', cls: 'warrior', job: 1, name: 'Iron Body', kind: 'passive', description: 'Hardens the body: more HP and less damage taken from every hit.', effects: ['Damage taken −10%', 'Max HP +10%'] },
  { id: 'sword_mastery', cls: 'warrior', job: 2, name: 'Sword Mastery', kind: 'passive', description: 'Mastery of the blade: every sword strike lands harder and finds weak spots more often.', effects: ['Damage +10%', 'Critical rate +5%'] },
  { id: 'final_attack', cls: 'warrior', job: 2, name: 'Final Attack', kind: 'passive', description: 'After a skill connects, a chance to follow up at once with an extra slash of light (against monsters and the sparring knight).', effects: ['25% chance per hit', 'Extra slash: 35% of the hit', 'Not against players'] },
  { id: 'combo_force', cls: 'warrior', job: 3, name: 'Combo Force', kind: 'passive', description: 'Every skill that lands charges a combo orb that orbits you. Each orb adds damage; the orbs fade 4 s after your last hit.', effects: ['1 orb per skill that hits', 'Up to 5 orbs', 'Damage +3% per orb', 'Fade 4 s after the last hit'] },
  { id: 'self_recovery', cls: 'warrior', job: 3, name: 'Self Recovery', kind: 'passive', description: 'The warrior\'s body mends itself over time, even in battle.', effects: ['Heals 2% of max HP every 5 s'] },
  { id: 'endure', cls: 'warrior', job: 3, name: 'Endure', kind: 'passive', description: 'Stubborn will: stuns, roots, freezes and slows wear off sooner.', effects: ['Stun / root / freeze −30%', 'Slow duration −30%'] },
  { id: 'chance_attack', cls: 'warrior', job: 3, name: 'Chance Attack', kind: 'passive', description: 'Strike the helpless harder: more damage to foes that are stunned, hit-stunned or knocked down.', effects: ['Damage +20% vs stunned / downed foes', 'Not against players'] },
  { id: 'power_stance', cls: 'warrior', job: 4, name: 'Power Stance', kind: 'passive', description: 'An unshakable stance: most blows can no longer push you back.', effects: ['Knockback resist 70%'] },
  { id: 'combat_mastery', cls: 'warrior', job: 4, name: 'Combat Mastery', kind: 'passive', description: 'A veteran\'s precision: more critical hits, and critical hits cut deeper.', effects: ['Critical rate +10%', 'Critical hits 150% → 170%'] },
  { id: 'advanced_final_attack', cls: 'warrior', job: 4, name: 'Advanced Final Attack', kind: 'passive', description: 'Final Attack evolves: it triggers far more often and strikes harder.', effects: ['Final Attack chance 45%', 'Extra slash: 55% of the hit', 'Not against players'] },
  // ---- Archer (Bowman line)
  { id: 'wind_leap', cls: 'archer', job: 1, name: 'Wind Leap', kind: 'movement', description: 'Press Jump again in mid-air to spring higher and farther on a burst of wind and leaves.', effects: ['Second jump in the air', 'Forward burst of speed', 'Once per jump'] },
  { id: 'bow_mastery', cls: 'archer', job: 1, name: 'Bow Mastery', kind: 'passive', description: 'Mastery of the bow: every arrow lands harder and finds weak spots more often.', effects: ['Damage +10%', 'Critical rate +5%'] },
  { id: 'light_body', cls: 'archer', job: 1, name: 'Light Body', kind: 'passive', description: 'Light on the feet: faster on foot and harder to hit.', effects: ['Movement speed +10%', 'Evasion +5%'] },
  { id: 'extra_shot', cls: 'archer', job: 2, name: 'Extra Shot', kind: 'passive', description: 'After a skill connects, a chance to loose a second arrow of wind at once (against monsters and the sparring knight).', effects: ['25% chance per hit', 'Extra arrow: 35% of the hit', 'Not against players'] },
  { id: 'keen_eye', cls: 'archer', job: 2, name: 'Keen Eye', kind: 'passive', description: 'A hunter\'s eye: critical hits come far more often.', effects: ['Critical rate +10%'] },
  { id: 'physical_training', cls: 'archer', job: 2, name: 'Physical Training', kind: 'passive', description: 'Long hunts harden the body: more HP.', effects: ['Max HP +20%'] },
  { id: 'evasion', cls: 'archer', job: 3, name: 'Evasion', kind: 'passive', description: 'A chance to slip aside from a blow in a rush of wind — the attack misses completely.', effects: ['Evasion +15%', 'Dodged hits deal no damage'] },
  { id: 'focus', cls: 'archer', job: 3, name: 'Focus', kind: 'passive', description: 'Perfect focus: critical hits cut much deeper.', effects: ['Critical hits 150% → 170%'] },
  { id: 'ranger_mastery', cls: 'archer', job: 3, name: 'Ranger Mastery', kind: 'passive', description: 'A ranger\'s rhythm: more damage and quicker draws.', effects: ['Damage +10%', 'Attack speed +10%'] },
  { id: 'steadfast', cls: 'archer', job: 4, name: 'Steadfast', kind: 'passive', description: 'Rooted like an old tree: most blows can no longer push you back.', effects: ['Knockback resist 60%'] },
  { id: 'supreme_mastery', cls: 'archer', job: 4, name: 'Supreme Mastery', kind: 'passive', description: 'The legendary bow answers its master: more damage, deadlier crits.', effects: ['Damage +15%', 'Critical hits +10% more'] },
  { id: 'eagle_eyes', cls: 'archer', job: 4, name: 'Eagle Eyes', kind: 'passive', description: 'Sees like an eagle: every arrow flies farther.', effects: ['Arrow range +20%'] },
];

export const passiveIconUrl = (p: PassiveSkill) => `assets/final/skills/${p.cls}/${p.id}/icon.png`;
export const passivesFor = (cls: string, job?: number) => PASSIVES.filter((p) => p.cls === cls && (job === undefined || p.job === job));

export interface PassiveStats {
  dmg: number; critAdd: number; critDmgAdd: number; takenMul: number; hpMul: number; moveMul: number; jumpMul: number;
  kbResist: number; ccResist: number; regen: boolean; fa: { chance: number; mul: number } | null; orbs: boolean; chanceAttack: number; airLeap: boolean;
  /** Archer: chance to dodge a hit entirely, projectile range multiplier, attack-speed multiplier (startup / recovery divided by it). */
  evade: number; rangeMul: number; atkSpeed: number;
}

export const NO_PASSIVES: PassiveStats = { dmg: 1, critAdd: 0, critDmgAdd: 0, takenMul: 1, hpMul: 1, moveMul: 1, jumpMul: 1, kbResist: 0, ccResist: 0, regen: false, fa: null, orbs: false, chanceAttack: 1, airLeap: false, evade: 0, rangeMul: 1, atkSpeed: 1 };

/** Passives owned at this level (all = arena / QA: every job open). */
export function ownedPassives(cls: string, level: number, all: boolean): Set<string> {
  const jobs = jobsFor(cls);
  return new Set(passivesFor(cls).filter((p) => all || level >= (jobs[p.job]?.level ?? Infinity)).map((p) => p.id));
}

export function passiveStats(owned: Set<string>): PassiveStats {
  const s: PassiveStats = { ...NO_PASSIVES };
  const has = (id: string) => owned.has(id);
  if (has('war_leap')) s.airLeap = true;
  if (has('warrior_mastery')) { s.moveMul *= 1.1; s.jumpMul *= 1.1; s.hpMul += 0.2; s.kbResist = 0.3; }
  if (has('iron_body')) { s.takenMul *= 0.9; s.hpMul += 0.1; }
  if (has('sword_mastery')) { s.dmg *= 1.1; s.critAdd += 0.05; }
  if (has('final_attack')) s.fa = { chance: 0.25, mul: 0.35 };
  if (has('combo_force')) s.orbs = true;
  if (has('self_recovery')) s.regen = true;
  if (has('endure')) s.ccResist = 0.3;
  if (has('chance_attack')) s.chanceAttack = 1.2;
  if (has('power_stance')) s.kbResist = 0.7;
  if (has('combat_mastery')) { s.critAdd += 0.1; s.critDmgAdd += 0.2; }
  if (has('advanced_final_attack')) s.fa = { chance: 0.45, mul: 0.55 };
  // Archer
  if (has('wind_leap')) s.airLeap = true;
  if (has('bow_mastery')) { s.dmg *= 1.1; s.critAdd += 0.05; }
  if (has('light_body')) { s.moveMul *= 1.1; s.evade += 0.05; }
  if (has('extra_shot')) s.fa = { chance: 0.25, mul: 0.35 };
  if (has('keen_eye')) s.critAdd += 0.1;
  if (has('physical_training')) s.hpMul += 0.2;
  if (has('evasion')) s.evade += 0.15;
  if (has('focus')) s.critDmgAdd += 0.2;
  if (has('ranger_mastery')) { s.dmg *= 1.1; s.atkSpeed *= 1.1; }
  if (has('steadfast')) s.kbResist = 0.6;
  if (has('supreme_mastery')) { s.dmg *= 1.15; s.critDmgAdd += 0.1; }
  if (has('eagle_eyes')) s.rangeMul = 1.2;
  return s;
}

/** War Leap tuning (px/s). */
export const WAR_LEAP = { vz: 380, forward: 430 };
/** Combo Force orbs. */
export const ORBS = { max: 5, perOrb: 0.03, fadeMs: 4000 };
/** Self Recovery: fraction of max HP every period. */
export const REGEN = { frac: 0.02, everyMs: 5000 };
