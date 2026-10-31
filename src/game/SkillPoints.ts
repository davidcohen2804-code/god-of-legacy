// Skill points (the rebuild's Phase 6, docs/REBUILD_PLAN.md — David 31 Oct 01:18: "skill points spent by choice, skills
// opening by level"). MapleStory's way: from the 1st job on, 3 points a level (the advancement's own level included);
// each job skill is learned with them, level by level, up to its top level. A skill not learned cannot be used; a
// passive not learned gives nothing. Only what is spent is saved (Character.skills); the points still free are
// counted from the level, like the stats' AP. A skill's level changes only its damage, and only in the regular game:
// the arena (and every test switch) plays every skill open at its full blow — skills stay the same in PvP.
import { BEGINNER_TO, hasJob, jobOfSlot, jobsFor, skillLevel } from '../skills/Jobs';
import type { FinalSkill } from '../skills/SkillTypes';
import { passivesFor, type PassiveSkill } from '../skills/Passives';
import { kitFor } from '../skills/FinalKit';

export const SP_PER_LEVEL = 3;
/** The top level of a job's active skills (MapleStory: 20). */
export const ACTIVE_MAX = 20;
/** Passives are on or off: learned with one point. */
export const PASSIVE_MAX = 1;

type Who = { level: number; job?: string; skills?: Record<string, number> };
type Entry = FinalSkill | PassiveSkill;
const isPassive = (e: Entry): e is PassiveSkill => 'kind' in e;

/** Every point he has earned: 3 a level from the 1st job's level on (none as a Beginner). */
export const totalSp = (c: Who): number => (hasJob(c) ? SP_PER_LEVEL * Math.max(0, c.level - BEGINNER_TO + 1) : 0);
export const spentSp = (c: Who): number => Object.values(c.skills ?? {}).reduce((a, v) => a + Math.max(0, Math.floor(v) || 0), 0);
export const freeSp = (c: Who): number => Math.max(0, totalSp(c) - spentSp(c));
/** A skill's top level (0: the basic attack — always there, never raised). */
export const maxLevelOf = (e: Entry): number => (isPassive(e) ? PASSIVE_MAX : e.slot === 0 ? 0 : ACTIVE_MAX);
export const levelOf = (c: Who | null | undefined, id: string): number => Math.max(0, Math.floor(c?.skills?.[id] ?? 0) || 0);
/** The level his job tier for this skill opens at. */
export const opensAt = (cls: string, e: Entry): number => (isPassive(e) ? jobsFor(cls)[e.job]?.level ?? Infinity : jobOfSlot(cls, e.slot).level);

/** Why a skill cannot take a point now (null: it can). */
export function cannotRaise(cls: string, c: Who, e: Entry): string | null {
  const max = maxLevelOf(e), lv = levelOf(c, e.id);
  if (max === 0) return 'Always known';
  if (e.wip) return 'Coming soon';
  if (opensAt(cls, e) > skillLevel(c)) return !hasJob(c) && c.level >= opensAt(cls, e) ? 'Needs the 1st job (a Master)' : `Opens at Lv ${opensAt(cls, e)}`;
  if (lv >= max) return 'Top level';
  if (e.requires && levelOf(c, e.requires.id) < e.requires.level) return `Needs ${nameOf(cls, e.requires.id)} Lv ${e.requires.level}`;
  if (freeSp(c) <= 0) return 'No skill points left';
  return null;
}

/** A skill's name by id (its class's actives, then passives). */
const nameOf = (cls: string, id: string): string => kitFor(cls as never).find((s) => s.id === id)?.name ?? passivesFor(cls).find((p) => p.id === id)?.name ?? id;

/** The damage a skill does at its level in the regular game: 55 % at level 1, the full blow at its top level. */
export const skillPower = (lv: number, max = ACTIVE_MAX): number => (max <= 1 ? 1 : 0.55 + 0.45 * (Math.max(1, Math.min(lv, max)) - 1) / (max - 1));
