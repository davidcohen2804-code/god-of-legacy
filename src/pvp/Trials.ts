// Combo trials (Training): the combo guide's routes as trials, one at a time — its keys in order, every one landing on the
// training partner inside one combo (the combo the hit counter counts: it ends when the partner can act again — gets up,
// breaks out, or takes a finisher). A step pressed n times counts its n-th press; a HOLD step counts only fully drawn; a
// jump step counts once you leave the floor after the step before it landed (or cast the next one in the air). Anything
// else in between starts the trial over. Cleared trials are kept in this browser, per class.
import { COMBO_GUIDE, GuideRoute } from '../data/comboGuide';
import type { ClassId } from '../skills/SkillTypes';

/** A class's trials: beginner → mid → expert, the shortest first within a level (fewest keys, then fewest presses). */
export function trialsOf(cls: string): GuideRoute[] {
  const presses = (r: GuideRoute) => r.steps.reduce((a, st) => a + (st.n ?? 1), 0);
  const tier = (r: GuideRoute) => (r.tier ? ['BEGINNER', 'MID', 'EXPERT'].indexOf(r.tier) : 1);
  return [...(COMBO_GUIDE[cls as ClassId] ?? [])].sort((a, b) => tier(a) - tier(b) || a.steps.length - b.steps.length || presses(a) - presses(b));
}

const KEY = 'gol-trials';
function load(): Record<string, string[]> { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { return {}; } }
/** The trials of `cls` cleared so far (by route name). */
export function clearedOf(cls: string): Set<string> { return new Set(load()[cls] ?? []); }
export function markCleared(cls: string, name: string): void {
  const a = load(), l = new Set(a[cls] ?? []);
  if (l.has(name)) return;
  l.add(name); a[cls] = [...l];
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage unavailable: this visit only */ }
}

/** What just happened in the trial: a step lit (step i), a press of a repeated step counted, the string broken (dropped:
 *  the partner got free; missed: another key or an opener that never landed; hold: a HOLD step let go early), cleared. */
export type TrialNote = 'step' | 'press' | 'drop' | 'miss' | 'hold' | 'clear';

/** One trial being played. */
export class TrialRun {
  /** Each step: landed (lit). */
  readonly ok: boolean[];
  /** The next step to press, and its presses so far (a step pressed n times). */
  next = 0;
  presses = 0;
  cleared = false;
  /** The attempt's casts → the step each one lands (-1: an early press of a repeated step: it only has to keep the combo). */
  private casts = new Map<string, number>();
  private comboId = -1;
  private startedAt = 0;

  /** `damaging(id)`: the skill hits (a stance such as Sheathe counts as soon as it is pressed). */
  constructor(readonly route: GuideRoute, private damaging: (id: string) => boolean, private note: (n: TrialNote, step: number) => void) {
    this.ok = route.steps.map(() => false);
  }

  get started(): boolean { return this.next > 0 || this.presses > 0; }

  /** Back to the first step (quietly). */
  reset(): void { this.ok.fill(false); this.next = 0; this.presses = 0; this.casts.clear(); this.comboId = -1; }

  /** You pressed a skill (`air`: off the floor). */
  cast(id: string, castId: string, air: boolean, now: number): void {
    if (this.cleared) return;
    const steps = this.route.steps;
    if (this.started && steps[this.next] && !steps[this.next].id && air) this.land(this.next++); // (the jump before it)
    if (steps[this.next]?.id === id) { this.take(id, castId, now); return; }
    if (this.started) this.fail('miss');
    if (steps[0].id === id) this.take(id, castId, now); // (it may open the trial again)
  }

  /** Your hit on the partner: its cast, the combo it is in, and whether a held skill was fully drawn. */
  hit(castId: string, comboId: number, full: boolean): void {
    if (this.cleared) return;
    const i = this.casts.get(castId);
    if (i === undefined) return;
    if (this.comboId < 0) this.comboId = comboId;
    else if (comboId !== this.comboId) { this.fail('drop'); return; }
    if (i < 0 || this.ok[i]) return;
    if (this.route.steps[i].hold && !full) { this.fail('hold'); return; }
    this.land(i);
  }

  /** Every frame: the partner still held in your combo; you off the floor. */
  update(now: number, held: boolean, air: boolean): void {
    if (this.cleared || !this.started) return;
    const st = this.route.steps[this.next];
    if (st && !st.id && air && this.ok[this.next - 1]) this.land(this.next++); // you jumped after the step before it landed
    if (this.comboId >= 0 && !held) this.fail('drop');
    else if (this.comboId < 0 && now - this.startedAt > 2500) this.fail('miss'); // the opener never landed
  }

  private take(id: string, castId: string, now: number): void {
    const i = this.next, st = this.route.steps[i];
    if (!this.started) this.startedAt = now;
    this.presses++;
    const last = this.presses >= (st.n ?? 1);
    this.casts.set(castId, last ? i : -1);
    if (!last) { this.note('press', i); return; }
    this.next++; this.presses = 0;
    if (!this.damaging(id)) this.land(i);
  }

  private land(i: number): void {
    this.ok[i] = true;
    this.note('step', i);
    if (this.ok.every(Boolean)) { this.cleared = true; this.note('clear', i); }
  }

  /** The string broke: back to the start (said only when something had landed already). */
  private fail(n: TrialNote): void {
    const lost = this.ok.some(Boolean) || this.comboId >= 0;
    this.reset();
    if (lost) this.note(n, 0);
  }
}
