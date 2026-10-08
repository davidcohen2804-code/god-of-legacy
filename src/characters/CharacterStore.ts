// Load / validate / save / delete / selected slot. Independent from Phaser.
import schema from '../data/CharacterSelect_DataSchema.json';
import { Character, CharacterSelectData, CharacterSlot, QuestState, SlotId } from './CharacterTypes';
import { GearState, cleanGear, starterGear } from '../items/Gear';
import { cleanStats } from '../game/Stats';
import { DEFAULT_QUICK, ITEMS, STARTER_BAG, cleanBag, cleanGold, cleanQuick } from '../game/Loot';

const KEY = 'godoflegacy.characters';
const MAX_SLOTS = 4;

const isSlotId = (v: unknown): v is SlotId => v === 1 || v === 2 || v === 3 || v === 4;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNonEmpty = (v: unknown): v is string => isStr(v) && v.trim().length > 0;

function validCharacter(c: unknown): c is Character {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return isStr(o.id) && isNonEmpty(o.name) && isNonEmpty(o.classId)
    && Number.isInteger(o.level) && (o.level as number) >= 1
    && isStr(o.createdAt)
    && (o.lastPlayedAt === null || isStr(o.lastPlayedAt))
    && (o.appearanceId === null || isStr(o.appearanceId));
}

function defaults(): CharacterSelectData {
  return {
    version: schema.version,
    maxSlots: MAX_SLOTS,
    selectedSlotId: null,
    slots: schema.slots.slice(0, MAX_SLOTS).map((s) => ({ slotId: s.slotId as SlotId, character: null })),
  };
}

/** Malformed data never throws: bad slots become empty, bad structure becomes defaults. */
function sanitize(raw: unknown): CharacterSelectData {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Record<string, unknown>;
  if (o.version !== schema.version || !Array.isArray(o.slots) || o.slots.length > MAX_SLOTS) return d;
  for (const s of o.slots as unknown[]) {
    if (!s || typeof s !== 'object') continue;
    const so = s as Record<string, unknown>;
    if (!isSlotId(so.slotId)) continue;
    const target = d.slots.find((x) => x.slotId === so.slotId)!;
    if (validCharacter(so.character)) {
      const c = so.character;
      target.character = {
        id: c.id, name: c.name, classId: c.classId, level: c.level,
        createdAt: c.createdAt, lastPlayedAt: c.lastPlayedAt, appearanceId: c.appearanceId,
      };
      const ex = (c as unknown as { exp?: unknown }).exp;
      if (typeof ex === 'number' && Number.isFinite(ex) && ex >= 0) target.character.exp = ex;
      const jb = (c as unknown as { job?: unknown; trial?: unknown });
      if (isNonEmpty(jb.job)) target.character.job = jb.job;
      if (isNonEmpty(jb.trial)) target.character.trial = jb.trial;
      const sts = (c as unknown as { stats?: unknown }).stats;
      if (sts && typeof sts === 'object') target.character.stats = cleanStats(sts, c.level);
      const lt = c as unknown as { gold?: unknown; bag?: unknown; quick?: unknown };
      target.character.gold = cleanGold(lt.gold);
      target.character.bag = lt.bag && typeof lt.bag === 'object' ? cleanBag(lt.bag) : { ...STARTER_BAG };
      target.character.quick = cleanQuick(lt.quick);
      const sn = (c as unknown as { seen?: unknown }).seen;
      target.character.seen = Array.isArray(sn) ? sn.filter((x): x is string => typeof x === 'string' && x in ITEMS) : Object.keys(target.character.bag);
      const gd = (c as unknown as { gender?: unknown }).gender;
      if (gd === 'male' || gd === 'female') target.character.gender = gd;
      const lk = (c as unknown as { look?: Record<string, unknown> }).look;
      const ix = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 10 ? v : null);
      if (lk && typeof lk === 'object' && ['hair', 'top', 'pants', 'shoes'].every((k) => ix(lk[k]) !== null)) {
        target.character.look = { hair: lk.hair as number, top: lk.top as number, pants: lk.pants as number, shoes: lk.shoes as number };
        for (const k of ['hairColor', 'skin', 'face', 'eyeColor'] as const) { const v = ix(lk[k]); if (v !== null) target.character.look[k] = v; } // added later: older characters lack them
      }
      // equipment: as stored, or the starter set (in the creation colours) for characters stored before it existed
      target.character.gear = cleanGear((c as unknown as { gear?: unknown }).gear) ?? starterGear(target.character.look);
      const cos = (c as unknown as { cosmetics?: { owned?: unknown; equipped?: unknown } }).cosmetics;
      if (cos && Array.isArray(cos.owned) && cos.equipped && typeof cos.equipped === 'object') {
        target.character.cosmetics = {
          owned: (cos.owned as unknown[]).filter(isStr),
          equipped: Object.fromEntries(Object.entries(cos.equipped as Record<string, unknown>).filter(([, v]) => isStr(v))) as Record<string, string>,
        };
      }
      const qs = (c as unknown as { quests?: Record<string, { state?: unknown; progress?: unknown }> }).quests;
      if (qs && typeof qs === 'object') {
        const ok = Object.entries(qs).filter(([, q]) => q && (q.state === 'active' || q.state === 'done') && Array.isArray(q.progress) && (q.progress as unknown[]).every((v) => Number.isInteger(v) && (v as number) >= 0));
        if (ok.length) target.character.quests = Object.fromEntries(ok.map(([id, q]) => [id, { state: q.state as QuestState['state'], progress: [...(q.progress as number[])] }]));
      }
    }
  }
  d.selectedSlotId = isSlotId(o.selectedSlotId) ? o.selectedSlotId : null;
  return d;
}

class Store {
  private data: CharacterSelectData;

  constructor() {
    let raw: unknown = null;
    try { const s = localStorage.getItem(KEY); if (s) raw = JSON.parse(s); } catch { raw = null; }
    this.data = sanitize(raw);
  }

  getSlots(): readonly CharacterSlot[] { return this.data.slots; }
  getSlot(id: SlotId): CharacterSlot { return this.data.slots.find((s) => s.slotId === id)!; }
  getSelectedId(): SlotId | null { return this.data.selectedSlotId; }
  /** START HERO: the ready hero being played (not stored; every setter by id leaves it alone). */
  private hero: Character | null = null;
  startHero(classId: string, name: string, level: number): void {
    this.hero = {
      id: `hero-${classId}`, name, classId, job: classId, level, exp: 0, hero: true,
      createdAt: new Date().toISOString(), lastPlayedAt: null, appearanceId: null, gender: 'male',
      gear: starterGear(undefined), gold: 0, bag: { ...STARTER_BAG }, quick: [...DEFAULT_QUICK], seen: Object.keys(STARTER_BAG),
    };
  }
  endHero(): void { this.hero = null; }

  getSelectedCharacter(): Character | null {
    if (this.hero) return this.hero;
    const id = this.data.selectedSlotId;
    return id ? this.getSlot(id).character : null;
  }

  select(id: SlotId): void { this.data.selectedSlotId = id; this.save(); }

  deleteCharacter(id: SlotId): void { this.getSlot(id).character = null; this.save(); }

  /** Creates a character in an EMPTY slot only; returns false (and changes nothing) otherwise. */
  createCharacter(slotId: SlotId, name: string, classId: string, appearanceId: string, gender: 'male' | 'female' = 'male', look?: Character['look'], level = 1): boolean {
    const slot = this.getSlot(slotId);
    const clean = name.trim();
    if (slot.character || !clean || !classId) return false;
    slot.character = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `c${Date.now()}`,
      name: clean, classId, level: Math.max(1, Math.floor(level)),
      createdAt: new Date().toISOString(), lastPlayedAt: null, appearanceId, gender, ...(look ? { look: { ...look } } : {}),
      gear: starterGear(look), // the starter set, worn, in the chosen colours
      gold: 0, bag: { ...STARTER_BAG }, quick: [...DEFAULT_QUICK], seen: Object.keys(STARTER_BAG),
    };
    this.save();
    return true;
  }

  /** Cosmetics of a stored character (ownership API kept abstract for a later backend). */
  getCosmetics(charId: string): { owned: string[]; equipped: Record<string, string> } {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    return c?.cosmetics ? { owned: [...c.cosmetics.owned], equipped: { ...c.cosmetics.equipped } } : { owned: [], equipped: {} };
  }

  setCosmetics(charId: string, v: { owned: string[]; equipped: Record<string, string> }): void {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    if (!c) return;
    c.cosmetics = { owned: [...new Set(v.owned)], equipped: { ...v.equipped } };
    this.save();
  }

  /** Level + EXP of a stored character. */
  /** Job advancement (a Master): the job, the class played, and the Master's pending trial (null = none). */
  setJob(charId: string, job: string, trial: string | null): void {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    if (!c) return;
    c.job = job; c.classId = job;
    if (trial) c.trial = trial; else delete c.trial;
    this.save();
  }

  /** The stats as placed (AP). */
  setStats(charId: string, s: { str: number; dex: number; int: number; luk: number }): void {
    const c = this.data.slots.find((x) => x.character?.id === charId)?.character;
    if (!c) return;
    c.stats = cleanStats(s, c.level);
    this.save();
  }

  /** The Master's trial is over (won). */
  clearTrial(charId: string): void {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    if (!c) return;
    delete c.trial;
    this.save();
  }

  /** Gold and potions carried. */
  setLoot(charId: string, gold: number, bag: Record<string, number>, quick?: [string, string], seen?: string[]): void {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    if (!c) return;
    c.gold = cleanGold(gold); c.bag = cleanBag(bag); if (quick) c.quick = cleanQuick(quick); if (seen) c.seen = seen.filter((x) => x in ITEMS);
    this.save();
  }

  setProgress(charId: string, level: number, exp: number): void {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    if (!c) return;
    c.level = level; c.exp = exp;
    this.save();
  }

  /** Quest states of a stored character (none for a new one). */
  getQuests(charId: string): Record<string, QuestState> {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    return Object.fromEntries(Object.entries(c?.quests ?? {}).map(([id, q]) => [id, { state: q.state, progress: [...q.progress] }]));
  }

  setQuests(charId: string, q: Record<string, QuestState>): void {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    if (!c) return;
    c.quests = Object.fromEntries(Object.entries(q).map(([id, v]) => [id, { state: v.state, progress: [...v.progress] }]));
    this.save();
  }

  /** Equipment of a stored character. */
  getGear(charId: string): GearState | null {
    const g = this.data.slots.find((s) => s.character?.id === charId)?.character?.gear;
    return g ? { items: g.items.map((i) => ({ ...i })), worn: { ...g.worn } } : null;
  }

  setGear(charId: string, g: GearState): void {
    const c = this.data.slots.find((s) => s.character?.id === charId)?.character;
    if (!c) return;
    c.gear = cleanGear(g) ?? c.gear;
    this.save();
  }

  private save(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ }
  }
}

export const CharacterStore = new Store();
