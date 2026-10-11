# Thief's Den — party sync (request from Maps to PvP)

The Thief's Den (`src/world/Den.ts`) is the party quest inside the Elder Tree: five rooms (`den_1`..`den_5` in the world row,
east of The Elder Hollow), walled off; Bram at the door starts a run, Pip in every room keeps its stage. Solo works today.
For a party, these need to be shared between the members in the den (the leader owns the run, like the arena's host):

1. **The run** — `Den.run = { stage, t0 (sim ms), secret2 (3 of 4), secret3 (3 of 5), lit (Set<number>), hoardAt }`.
   When the leader enters (`Den.enter()`), every party member standing by Bram enters too (`jump('den_1', 180, 500)`) and gets
   the leader's `secret2` / `secret3` and `t0`.
2. **Stage 1 sparks** — each member hands Pip ten Sparks of their own (KPQ-style: everyone must pass). Today Pip takes ten from
   whoever talks; with a party, Pip should count passes per member and clear the stage when all have passed.
3. **Lanterns (stages 2 and 3)** — `Den.use(i, room)` toggles lantern `i`; broadcast the toggle so `run.lit` matches on every
   screen; Pip's check (`keeper`) runs on the leader's screen and broadcasts `clear` or `resetLights`.
4. **Monsters** — the den's monsters are spawned by `Den.spawnRoom(stage)` with ids `den:imp:N`, `den:boss`, `den:coin:N`;
   their HP and deaths need the same sharing the arena uses for remote hits, so the boss dies once for everyone.
5. **Clear / leave** — `Den.clear(stage, exp)` and `Den.leave(reason)`: on the leader's screen, then broadcast; everyone gets the
   stage EXP; `finish()` gives each member the Thief's Box and, on a first clear, the second Sun Ember.
6. **Time / death** — the timer is the leader's `t0`; a fallen member is sent out alone (`leave`), the run goes on for the rest.

Messages suggested (Transport.ts `NetMsg`): `{ t: 'den'; from; op: 'enter' | 'lit' | 'clear' | 'reset' | 'leave'; stage?; i?; secret2?; secret3?; t0? }`.
