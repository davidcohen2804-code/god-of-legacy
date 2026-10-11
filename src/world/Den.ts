// The Thief's Den: the party quest inside the Elder Tree (chapter 3, Elderwood Village). Five rooms east of The Elder
// Hollow, walled off from the world (strip.py: a hard join, the entrance wall). Bram the Root Warden at the sealed door
// lets a hero in (level 15+, carrying the Sun Ember); Pip, a glowing sprite, keeps every room. Stages, in order:
//   1 Root Cellar      — Shade Imps drop Sparks: hand Pip ten of them
//   2 Hanging Roots    — four root lanterns: light exactly three, in the one right way (Pip says how many were right)
//   3 Lantern Ledges   — five ledges with 1..5 lanterns: light three, the right three (ten ways; Pip's hints again)
//   4 Magpie's Nest    — Pouncer the Magpie (boss) and his imps
//   5 Treasure Hoard   — a minute of coins and Coin Imps, then Pip sends you out
// 25 minutes for the run; the time up or the hero fallen: back out before the door. Every stage pays EXP; the first clear
// gives the second Sun Ember (the story) and a Thief's Box every time (gold and a few things). Solo works as it is; a
// party shares the run once the PvP chat adds the sync messages (docs/DEN_SYNC.md).
import Phaser from 'phaser';
import { AREAS, MOB_KINDS, toWorld, type AreaNpc } from './Areas';
import { WORLD_OBJECTS, type Pt, type WorldObject } from './WorldGeometry';
import type { Monster } from './Monster';
import { ITEMS } from '../game/Loot';
import { HUD } from '../config/layout';

export const DEN_ROOMS = ['den_1', 'den_2', 'den_3', 'den_4', 'den_5'] as const;
export const DEN_MIN_LEVEL = 15;
export const DEN_MS = 25 * 60 * 1000;
export const DEN_KEY_ITEM = 'sun_ember';
/** Quest flag set on the first clear (world-areas.json quest `into_the_den` waits for it). */
export const DEN_CLEAR_KEY = 'den_clear';
const SPARKS = 10;
const GATE_X = 1672;   // each room's way on: a wall at its right edge until the stage is done (map px)
const GATE_Y: [number, number] = [300, 700];

/** The rooms' fixtures (map px of each room). */
const ROOM = {
  den_1: { keeper: [1420, 560], spawns: [[300, 450], [520, 610], [760, 450], [980, 610], [1150, 450], [1300, 610]], start: [180, 560] },
  // pedestals / ledges: where you stand to use one (in front of it) and where its light is drawn (map px)
  // room 2: the picture is the unlit one; a lit root is its painted light (den/light_<i>.png: tools/world/den/lights.py,
  // 240 × 360, top centre at `light`), drawn over the pedestal's cut-out (front 538)
  den_2: { keeper: [1500, 560], pedestals: [[480, 590], [740, 590], [1010, 590], [1270, 590]], light: [[480, 50], [740, 50], [1010, 50], [1270, 50]], front: 538, start: [160, 560] },
  den_3: { keeper: [1500, 560], pedestals: [[380, 530], [615, 530], [840, 530], [1070, 530], [1290, 530]], light: [[380, 250], [615, 250], [840, 250], [1070, 250], [1290, 250]], start: [140, 560] },
  den_4: { keeper: [1550, 560], boss: [900, 500], spawns: [[700, 440], [1000, 620], [1150, 450]], start: [150, 560] },
  den_5: { keeper: [1500, 560], spawns: [[300, 450], [520, 610], [760, 450], [980, 610], [1150, 450], [1300, 610], [600, 520], [1000, 520]], start: [150, 560] },
} as const;

type Stage = 1 | 2 | 3 | 4 | 5;
export interface DenHooks {
  kin(): { x: number; y: number; z: number };
  level(): number;
  hasItem(id: string): number;
  takeItem(id: string, n: number): boolean;
  giveItem(id: string, n: number): void;
  gold(n: number): void;
  exp(n: number): void;
  chat(text: string): void;
  callout(text: string, color: string): void;
  spawn(kind: string, x: number, y: number, id: string): Monster | null;
  removeMobs(prefix: string): void;
  /** A fade, then the hero stands at (area, x, y). */
  jump(area: string, x: number, y: number, done?: () => void): void;
  /** NPC conversation (the game's dialog). */
  say(n: AreaNpc, lines: string[], choices?: { label: string; main?: boolean; run: () => void }[]): void;
  flag(key: string): boolean;
  setFlag(key: string): void;
}

const solid = (id: string, foot: Pt[]): WorldObject => ({ id, footprint: foot, height: 4000, cover: 'hard', occluder: [], frontY: Math.max(...foot.map((p) => p[1])) + 1 });
const choose = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

export class Den {
  /** Running: the stage, when it started (sim ms), the secrets. */
  private run: { stage: Stage; t0: number; secret2: number[]; secret3: number[]; lit: Set<number>; hoardAt: number } | null = null;
  private pedestals: { room: string; i: number; x: number; y: number; flame: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Ellipse; count?: Phaser.GameObjects.Text }[] = [];
  private timer?: HTMLElement;
  /** The fade into the den is still on (the hero is not inside yet). */
  private entering = false;
  private now = 0;

  constructor(private scene: Phaser.Scene, private h: DenHooks) {
    this.walls(true);
    this.buildPedestals();
  }

  get active(): boolean { return !!this.run; }
  get stage(): Stage | 0 { return this.run?.stage ?? 0; }
  /** In one of the den's rooms (by x). */
  inside(x: number): boolean { const a = AREAS.den_1, b = AREAS.den_5; return !!a && !!b && x >= a.x && x < b.x + 1672; }

  // ---------------------------------------------------------------- the door (Bram)
  /** Bram, at the Elder Tree's door. */
  door(n: AreaNpc): void {
    const lv = this.h.level();
    if (this.h.hasItem(DEN_KEY_ITEM) < 1) { this.h.say(n, ["This door answers to the sun's warmth, and you carry none. The Keeper of the Sun's shrine lies far to the west, beyond the clouds.", 'Come back with a Sun Ember.']); return; }
    if (lv < DEN_MIN_LEVEL) { this.h.say(n, [`The Ember is warm, but you are not ready. The den is no place for anyone under level ${DEN_MIN_LEVEL}.`]); return; }
    this.h.say(n, ["The Ember at your neck... so the fox gave up its prize. Then the den is open to you.", 'Five chambers, twenty-five minutes, and Pouncer the Magpie at the end, sitting on what he stole. Bring friends if you can.', 'Ready?'],
      [{ label: 'Enter the den', main: true, run: () => this.enter() }, { label: 'Not yet', run: () => undefined }]);
  }

  private enter(): void {
    this.run = { stage: 1, t0: this.now, secret2: this.pick(4, 3), secret3: this.pick(5, 3), lit: new Set(), hoardAt: 0 };
    this.walls(true); this.entering = true;
    this.h.jump('den_1', ROOM.den_1.start[0], ROOM.den_1.start[1], () => {
      this.entering = false;
      this.h.chat("The Thief's Den — stage 1: the Root Cellar. Shade Imps drop Sparks: bring Pip ten of them.");
      this.h.callout('STAGE 1', '#ffe08a');
      this.spawnRoom(1);
    });
  }

  private pick(n: number, k: number): number[] { const all = [...Array(n).keys()]; const out: number[] = []; while (out.length < k) { const i = choose(all); if (!out.includes(i)) out.push(i); } return out.sort(); }

  // ---------------------------------------------------------------- Pip (each room's keeper)
  keeper(n: AreaNpc, room: string): void {
    const r = this.run;
    if (!r) { this.h.say(n, ['Psst. The den is closed. Bram at the door opens it.']); return; }
    const stage = DEN_ROOMS.indexOf(room as typeof DEN_ROOMS[number]) + 1;
    if (stage !== r.stage) { this.h.say(n, [stage < r.stage ? 'This chamber is done. On you go, east!' : 'How did you get in here? Back to your chamber!']); return; }
    switch (r.stage) {
      case 1: {
        const have = this.h.hasItem('spark');
        if (have >= SPARKS) { this.h.takeItem('spark', SPARKS); this.h.say(n, [`Ten Sparks! Oh, they tickle. The roots will let you through now.`], [{ label: 'Onward', main: true, run: () => this.clear(1, 150) }]); }
        else this.h.say(n, [`Sparks, Sparks! The Shade Imps keep them in their pockets. Ten for me, please — you have ${have}.`]);
        return;
      }
      case 2: case 3: {
        const secret = r.stage === 2 ? r.secret2 : r.secret3, lit = [...r.lit].sort();
        if (lit.length !== 3) { this.h.say(n, [`Light exactly three of the ${r.stage === 2 ? 'root lanterns' : 'ledges'}. Press the key by one to light it or put it out.`]); return; }
        const right = lit.filter((i) => secret.includes(i)).length;
        if (right === 3) { this.h.say(n, ['Yes! That is the pattern. Hear the roots move?'], [{ label: 'Onward', main: true, run: () => this.clear(r.stage, r.stage === 2 ? 200 : 250) }]); return; }
        this.h.say(n, [right === 0 ? 'None of those. Hmm. Try again!' : `Close — ${right === 1 ? 'one' : 'two'} of those ${right === 1 ? 'was' : 'were'} right. Try again!`], [{ label: 'Try again', main: true, run: () => this.resetLights() }]);
        return;
      }
      case 4: {
        this.h.say(n, ['Pouncer! He is the one who took the Ember. Knock the shine out of him and the way opens.']);
        return;
      }
      case 5: {
        this.h.say(n, ['Grab what you can! When you are done, I will show you out.'], [{ label: 'Leave the den', main: true, run: () => this.finish() }, { label: 'A little longer', run: () => undefined }]);
        return;
      }
    }
  }

  /** A pedestal's key press (the one nearest the hero): lit / put out. */
  use(i: number, room: string): void {
    const r = this.run; if (!r) return;
    const stage = DEN_ROOMS.indexOf(room as typeof DEN_ROOMS[number]) + 1; if (stage !== r.stage) return;
    if (r.lit.has(i)) r.lit.delete(i); else r.lit.add(i);
    this.drawLights();
  }
  private resetLights(): void { if (this.run) this.run.lit.clear(); this.drawLights(); }

  /** The pedestal in reach of (x, y) in the current room, if any. */
  nearPedestal(x: number, y: number): { i: number; room: string; x: number; y: number } | null {
    const r = this.run; if (!r || (r.stage !== 2 && r.stage !== 3)) return null;
    const room = DEN_ROOMS[r.stage - 1];
    let best: typeof this.pedestals[number] | null = null, bd = 70;
    for (const p of this.pedestals) { if (p.room !== room) continue; const d = Math.hypot(x - p.x, (y - p.y) * 1.4); if (d < bd) { bd = d; best = p; } }
    return best ? { i: best.i, room, x: best.x, y: best.y } : null;
  }

  // ---------------------------------------------------------------- stages
  private spawnRoom(stage: Stage): void {
    this.h.removeMobs('den:');
    const room = DEN_ROOMS[stage - 1];
    if (stage === 1) ROOM.den_1.spawns.forEach(([x, y], i) => { const p = toWorld(room, [x, y]); this.h.spawn('shade_imp', p.x, p.y, `den:imp:${i}`); });
    if (stage === 4) { const b = toWorld(room, ROOM.den_4.boss as unknown as [number, number]); this.h.spawn('pouncer', b.x, b.y, 'den:boss'); ROOM.den_4.spawns.forEach(([x, y], i) => { const p = toWorld(room, [x, y]); this.h.spawn('shade_imp', p.x, p.y, `den:imp:${i}`); }); }
    if (stage === 5) ROOM.den_5.spawns.forEach(([x, y], i) => { const p = toWorld(room, [x, y]); this.h.spawn('coin_imp', p.x, p.y, `den:coin:${i}`); });
  }

  /** A monster of the den fell. */
  killed(m: Monster): void {
    const r = this.run; if (!r) return;
    if (m.id === 'den:boss' && r.stage === 4) {
      this.h.chat('Pouncer squawks and flaps off into the dark. The way to his hoard is open!');
      this.clear(4, 500);
    }
  }

  private clear(stage: Stage, exp: number): void {
    const r = this.run; if (!r || r.stage !== stage) return;
    this.h.exp(exp); this.h.callout('STAGE CLEAR', '#9dff9a');
    this.openGate(stage);
    r.stage = (stage + 1) as Stage; r.lit.clear(); this.drawLights();
    const next = ['', 'the Root Cellar', 'the Hanging Roots: light exactly three root lanterns, the right three', 'the Lantern Ledges: three of the five, the right three', "the Magpie's Nest", 'the Treasure Hoard: a minute of coins!'][r.stage];
    this.h.chat(`Stage ${r.stage}: ${next}. Walk on east.`);
    if (r.stage === 4) this.h.callout('BOSS AHEAD', '#ffb07a');
    if (r.stage === 5) r.hoardAt = this.now;
    this.spawnRoom(r.stage);
  }

  private finish(): void {
    const r = this.run; if (!r) return;
    const first = !this.h.flag(DEN_CLEAR_KEY);
    const gold = 400 + Math.floor(Math.random() * 300);
    this.h.gold(gold); this.h.exp(300);
    const pool = ['red_potion', 'blue_potion', 'cake', 'orange', 'elixir', 'swift_potion', 'warrior_potion', 'moth_dust'];
    const got: string[] = [];
    for (let i = 0; i < 3; i++) { const id = choose(pool); const n = id === 'elixir' || id.endsWith('_potion') && id !== 'red_potion' && id !== 'blue_potion' ? 1 : 3 + Math.floor(Math.random() * 5); this.h.giveItem(id, n); got.push(`${ITEMS[id].name} ×${n}`); }
    this.h.chat(`Pip hands you a Thief's Box: ${gold} gold, ${got.join(', ')}.`);
    if (first) { this.h.giveItem('sun_ember_2', 1); this.h.setFlag(DEN_CLEAR_KEY); this.h.chat('Among the stolen things, a second Sun Ember glows. Two pieces of the Heart — tell Wren.'); }
    this.leave();
  }

  /** Out of the den (done, out of time, fallen): before the Elder Tree's door, the run over. */
  leave(reason?: string): void {
    if (!this.run) return;
    this.run = null; this.entering = false; this.h.removeMobs('den:'); this.walls(true); this.drawLights();
    while (this.h.hasItem('spark') > 0) this.h.takeItem('spark', this.h.hasItem('spark'));
    if (reason) this.h.chat(reason);
    this.h.jump('dusk_3', 1050, 520);
  }

  update(simMs: number, alive: boolean): void {
    this.now = simMs;
    const r = this.run;
    if (!r) { this.timer?.remove(); this.timer = undefined; return; }
    const left = DEN_MS - (simMs - r.t0);
    if (left <= 0) { this.leave('Time is up. The roots close, and Pip waves you out.'); return; }
    if (!alive) { this.leave('You fell. The roots carry you gently back out of the den.'); return; }
    if (!this.entering && !this.inside(this.h.kin().x)) { this.leave(); return; }
    this.showTimer(r.stage, left);
    for (const p of this.pedestals) {
      p.glow.setAlpha((p.room === 'den_2' ? 0.2 : 0.3) + Math.sin(simMs / 300 + p.i) * 0.1);
      // the painted lights breathe (they sit on their bowls: no scaling); the ledge lanterns flicker in size
      if (p.room === 'den_2') p.flame.setAlpha(0.9 + Math.sin(simMs / 190 + p.i * 2) * 0.06 + Math.sin(simMs / 310 + p.i) * 0.04);
      else p.flame.setScale(1 + Math.sin(simMs / 170 + p.i * 2) * 0.03, 1 + Math.sin(simMs / 230 + p.i) * 0.05);
    }
  }

  // ---------------------------------------------------------------- the rooms' solids and lights
  private walls(all: boolean): void {
    for (let i = WORLD_OBJECTS.length - 1; i >= 0; i--) if (WORLD_OBJECTS[i].id.startsWith('den-gate')) WORLD_OBJECTS.splice(i, 1);
    if (!all) return;
    for (const room of DEN_ROOMS.slice(0, 4)) { const a = AREAS[room]; if (!a) continue; const x = a.x + GATE_X; WORLD_OBJECTS.push(solid(`den-gate-${room}`, [[x - 40, GATE_Y[0]], [x + 40, GATE_Y[0]], [x + 40, GATE_Y[1]], [x - 40, GATE_Y[1]]])); }
  }
  private openGate(stage: Stage): void {
    const id = `den-gate-${DEN_ROOMS[stage - 1]}`;
    for (let i = WORLD_OBJECTS.length - 1; i >= 0; i--) if (WORLD_OBJECTS[i].id === id) WORLD_OBJECTS.splice(i, 1);
    const a = AREAS[DEN_ROOMS[stage - 1]]; if (!a) return;
    const x = a.x + GATE_X, y = 500;
    const flash = this.scene.add.ellipse(x, y - 120, 160, 300, 0xd8ffe8, 0).setDepth(y + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: flash, alpha: { from: 0, to: 0.7 }, duration: 400, yoyo: true, onComplete: () => flash.destroy() });
  }

  private buildPedestals(): void {
    const sc = this.scene;
    const keys: [string, string][] = [['den-flame', 'assets/world/den/flame.png'], ...[0, 1, 2, 3].map((i): [string, string] => [`den-light-${i}`, `assets/world/den/light_${i}.png`])];
    const make = () => {
      if (this.pedestals.length || keys.some(([k]) => !sc.textures.exists(k))) return;
      for (const [room, n] of [['den_2', 4], ['den_3', 5]] as const) {
        const a = AREAS[room]; if (!a) continue;
        const R = ROOM[room] as { pedestals: readonly (readonly number[])[]; light: readonly (readonly number[])[]; front?: number };
        R.pedestals.forEach(([x, y], i) => {
          const p = toWorld(room, [x, y]), l = toWorld(room, R.light[i] as [number, number]);
          // room 2: the root's painted light (its glowing tip, the light on the bark, the bowl's rim) over the pedestal's
          // cut-out; room 3: the lantern over the ledge. Shown while lit.
          const painted = n === 4;
          const flame = sc.add.image(l.x, l.y, painted ? `den-light-${i}` : 'den-flame').setOrigin(0.5, 0).setDepth(painted ? toWorld(room, [x, R.front ?? y]).y + 0.5 : p.y - 200).setVisible(false);
          const glow = sc.add.ellipse(l.x, painted ? l.y + 290 : l.y + 70, 150, 90, 0xffc878, painted ? 0.22 : 0.35).setDepth(p.y - 200.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
          const count = n === 5 ? sc.add.text(l.x, l.y + 118, '●'.repeat(i + 1), { fontFamily: HUD.bodyFont, fontSize: '13px', color: '#ffe3a0', stroke: '#1a0e02', strokeThickness: 3, resolution: 2 }).setOrigin(0.5).setDepth(p.y + 1.1) : undefined;
          this.pedestals.push({ room, i, x: p.x, y: p.y, flame, glow, count });
        });
      }
    };
    const missing = keys.filter(([k]) => !sc.textures.exists(k));
    if (missing.length) { for (const [k, url] of missing) sc.load.image(k, url); sc.load.once(Phaser.Loader.Events.COMPLETE, make); if (!sc.load.isLoading()) sc.load.start(); } else make();
  }
  private drawLights(): void {
    const r = this.run;
    for (const p of this.pedestals) {
      const on = !!r && DEN_ROOMS[r.stage - 1] === p.room && r.lit.has(p.i);
      p.glow.setVisible(on); p.flame.setVisible(on);
    }
  }

  private showTimer(stage: Stage, left: number): void {
    if (!this.timer) {
      const d = document.createElement('div');
      Object.assign(d.style, { position: 'fixed', left: '50%', top: '92px', transform: 'translateX(-50%)', zIndex: '9000', pointerEvents: 'none',
        font: `600 14px ${HUD.bodyFont}`, letterSpacing: '1.5px', color: '#f6e7c4', background: 'rgba(9,14,24,.72)', border: '1px solid rgba(201,154,69,.55)', borderRadius: '999px', padding: '6px 18px', whiteSpace: 'nowrap' } as CSSStyleDeclaration);
      document.body.appendChild(d); this.timer = d;
    }
    const s = Math.ceil(left / 1000), mm = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0');
    this.timer.textContent = `THIEF'S DEN  ·  STAGE ${stage} / 5  ·  ${mm}:${ss}`;
    this.timer.style.color = s < 60 ? '#ffb3a0' : '#f6e7c4';
  }

  destroy(): void { this.timer?.remove(); this.walls(false); for (const p of this.pedestals) { p.flame.destroy(); p.glow.destroy(); p.count?.destroy(); } this.pedestals = []; }
}
