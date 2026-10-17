# Balance log (DFO PvP arena dynamics chat)

Every balance change to any class's skills, newest first. Class chats: read this after every `git pull`; if a change
needs new visuals / motion (an effect sized to a new hitbox, an animation timed to a new startup), do that part.
Values apply to the whole game (only damage may differ in PvP: arenaDmg / the arena's scaling).

## 2026-10-17 — Origami Flock's cranes rise to a foe in the air (`antiAir`)
- Homing paper cranes flew level under the per-attack reach: in UPDRAFT (the Levity Field floats him, the flock follows) 2 of its hits landed instead of 6. They seek him wherever he is now, the one homing shot in the game.
- The fan: 70° between cranes put the outer two behind her (±140°) — they ran out of range turning back; one crane of five landed in UPDRAFT (found in the game, crane by crane). Now 35° a crane (±70°), they turn 240°/s (150) and fly 600 px (520): all five curve in on him.

## 2026-10-17 — Five reaches matched to their looks (the class chats' reviews of looks vs reach)
- **Samurai** (level strokes at chest height reached a foe two heights up): Shadow Step 200 → 120; Iai Strike 200 / 210 / 220 → 120 / 130 / 140; Phantom Blades 280 → 160.
- **Book Mage** (looks taller than their reach): Time Collapse 360 on all three hits (its pull and freeze had none: 80 — "every foe in it" — the clock stands over the whole area; the blast 200); Storm Field 160 → 240 (its bolts fall out of the sky onto a foe held up in it).

## 2026-10-17 — The lifting dashes land where their arc ends (feel)
- A dash with a lift (the archer's Backstep Shot, Retreat Kick, Wind Step, Vine Mine's hop, Air Volley; the mage's Frost Nova) rose along its arc but was held at its top on the way down (~0.8 px a frame), so a back flip landed ~0.3 s late and floated after its move. Now it follows its arc down and lands as it ends (cast in the air: back to the height it left, then it falls on). Found by the archer combo pass; every archer and mage trial played again under it.

## 2026-10-17 — Samurai, Gambler, Book Mage: their unused skills get trials; two cancel rules fixed
- Trials (played by DFO in the game): the Samurai's MIKAZUKI (SKY's expert: Sword Wave thrown level with a foe in the air), the Gambler's CHANCE style (LOADED: Dice Bomb; REDBLACK: Roulette Wheel), the Book Mage's SNARE (ARCANE's expert: Binding Rune as the net under a falling foe). SWITCH (+ Riffle Shuffle: the vault threw him above Showdown's reach), JACKPOT (a jump before Fuse Slam: All In's five-card snap throws him past its reach from the floor), SPARK (no Blink: its chase stopped 34 px from him and the bolts flew level under him) and AVALANCHE (two bolts, then Astral Burst draws him back into Frost Nova's ring) rebuilt under the per-attack reach.
- **Roulette Wheel links only once its ball has dropped:** an early vault cancelled it on its first spin and skipped the bet (the colour never showed).
- **Arcane Bolt's chain:** the next bolt can no longer cut the current one 20 ms before it fires (its stages have no active time) — fast taps lost bolts (RIME's damage halved in the sim).

## 2026-10-17 — After a dash through the foe, the next attack turns back to him (every class)
- Only the samurai's next cut turned back to a foe he had stepped through; the warrior's Dash Slash (`through`) left him facing away, so Rising Slash, its one link, cut the air (GALE and SKEWER failed in the game: the foe 53–99 px behind him, free). Now any attack within the through-dash's window (its active + recovery + 0.45 s) soft-locks a foe behind as well as in front (260 px); a mobility / escape skill keeps your heading (an escape stays an escape), except the samurai's own steps, as before.

## 2026-10-17 — A hit that roots also staggers (the binders' hold holds)
- A root holds only the feet — a rooted fighter can still swing. Every rooting hit carries a stun for that (Vine Mine 450, Binding Leaves 200 / 300, Sakura Bind 400 / 420, Rune Beam 240, the gambler's bet 420), but on a fresh root the rule skipped it (`receive`: no stun when a hard CC landed), so a standing foe caught in a mine could hit back at once. Now the stun applies with a root (a freeze or a hard stun still replaces it). Found by the archer combo pass.

## 2026-10-17 — Archer: four new trials give Thunder Rain, Hunter's Rain, Backstep Shot and Spirit Hawk a combo role
- **Hunter's Rain** gets a beat: every 5th volley 10 damage (7), 320 ms hold (240) and a mark; the 15th throws him up (12 damage, heavy, a mark, 120 launch). Before: 15 even volleys, a hold with nothing to read. Total 116 (105). Visuals / description: Archer chat (the 5th, 10th and last volley read bigger).
- **Rising Arrow** links into **Backstep Shot** (her escape from under a foe she launched); Backstep's arrow **pins** (450 ms) — from 250 px every follow-up takes ≥0.4 s to arrive and the 220 ms hold let him drop under it. Long-range pokes still strip it; on a free foe within 150 px it holds 0.45 s.
- **Air Volley's shots rise** (`antiAir`): "keeps a launched foe up" — under the per-attack reach its shots passed under him (STARFALL failed when the volley came at once).
- **Retreat Kick** reaches 120 up (100): it missed a bounce at 101–105 px; still a ground kick (the launchers' band is 190–260).
- The trials: TAILWIND, TALON (SKY), DOWNPOUR, THUNDERHEAD (TRAPPER) — archer 12.

## 2026-10-17 — Warrior: four new trials give Dash Slash, Whirlwind, Blade Storm and Impaling Rush a combo role (David: every skill serves a combo)
- **Impaling Rush** carries the foe (`carry: true`, as before c91865a7): from close the rush walked through him and its thrusts hit nothing (2–4 of 6 landed after Lion's Maw, the hook or a full Whirlwind) — now he rides the blade for all six (its 70 px step unchanged). Visuals: none.
- **Dash Slash**: its last cut holds 360 ms (240): Rising Slash, its one link, gets 0.2 s to come. Visuals: none.
- The trials: STORMCHAIN (IRON HAND's expert: the storm holds him, then chain, grip, crash), GALE · CYCLONE · SKEWER (STEEL, a new 4th style: the charge through him, the cyclone in the air, the skewer on the bounce).

## 2026-10-17 — Every hit reaches only as high as its own attack (David: a foe high above a swing was still hit)
- **Everyone**: the arena's blanket height is gone — every damaging hit reached 240 px above the caster's feet and every projectile rose to a foe in the air. Now each hit reaches its own `reachUp` (as each skill was designed: a horizontal cut ~70–140 px — the legs of a foe lifted a little —, a rising cut / launcher ~190–260, the big aerial skills ~300), from the caster's own height (an attack thrown while jumping reaches the air), and a projectile rises to an airborne foe only when its shape is `antiAir` (the archer's arrows; now the mage's Arcane Bolt too — magic missiles that seek). Juggles now ask for the right attack: after a launch a rising / aerial / anti-air hit, or wait for the fall into a ground hit. Visuals: a class chat whose skill's look reaches higher or lower than its hit — tell DFO the height it should reach.

## 2026-10-17 — Blows thrown down from the air reach the floor (PvP's report)
- **Warrior — Judgment Blade** and **Archer — Thunder Rain**: their circles strike the floor (`floor: true`, as Wind Step's arrow). A hit's height band starts at the caster's height, and both are thrown while hanging in the air (the warrior ~185 px up after a chase, the archer ~150 px up): the blade's pin + slam and the three bolts struck only the air above a standing foe (only the court's ticks / the charged floor's launch landed). Now they land on him there, up to their own reach (280 / 320 px). Thunder Rain's third bolt spends the marks (a hard stun) — that spend was dead before. Visuals: none (both already fall to the floor).

## 2026-10-17 — Archer: the combo trials rebuilt (MARKED / SKY / TRAPPER) — the mine holds, Spirit Bow's one link
- **Vine Mine**: stepping on it holds 0.45 s (stun 120 → 450; the 2 s root stays) — a root alone still lets him swing, so the mine held 120 ms and the trap never caught (the description says "is held"). Played in the game: Rising Arrow › Vine Mine › Vine Lash › Fireball leaves him 0 ms free (217–250 ms only rooted before). Visuals: none (the catch is the mine's own).
- **Spirit Bow** → Hunter's Roar only (its list was empty, which cancels into anything): the knockdown finisher's one follow-up is the roar that spends its marks (PREDATOR). Visuals: none.
- The trials: EMBER, QUARRY, PREDATOR (MARKED: stack, then spend on the Fireball or the roar), KESTREL, STARFALL, HAWKEYE (SKY), BRAMBLE, PITFALL (TRAPPER) — each played in the game with real key presses: 0 ms free. Out of the trials: Backstep Shot (90–130 ms holes in a string), Hunter's Rain (15 identical ticks), Spirit Hawk (dives on its own clock), Tree of Life (a heal).

## 2026-10-17 — The combo trials rebuilt (every class: three styles, every step meaningful) — the engine fixes and links they need
- **Everyone — a pull never drags a foe through the puller** (Combat.receive: pull ≤ distance − 30 px). Ground Breaker's quake, Lion's Maw, the fields pulled a close foe to the attacker's back, so the next blow in front whiffed.
- **Everyone — long holds' diminishing returns wear off** after the DR window, as the short holds' do (they never did: within a round the 4th freeze / Levity / rune / vine hold held 0 ms).
- **Warrior** (links): Judgment Hook → Iron Grip (a grab into a grab: REEL), Iron Grip → Leap Crash, Leap Crash → Judgment Hook (the chain off the floor: SHACKLE), Sky Breaker → Leap Crash (crash on the bounce). Visuals: none.
- **Samurai**: Sakura Bind's ring is a floor ring (circle at its place, floor: true) — the arena's 240 px reach lifted it into the air, struck the airborne foe and so kept its blossoms from catching him on landing; now he falls into them and is caught (held 0.9 s), as its description says.
- **Book Mage**: the Attunement bolts (frost / storm / arcane) are her Arcane Bolt for every link and for the trials (the six "→ Arcane Bolt" links were refused after a spell); her fields (Storm Field, Time Collapse, Levity, the rune) pull toward their own middle, not toward her; a finisher that shatters (Time Collapse's blast) still ends the combo (its knockdown stays).
- **Gambler**: Charged Deal's hold reachable — startup 250 → 520 (the longest hold; a tap still throws at 120 ms) and the full hold's five-card fan sticks 3 (a fan counts once on a foe); Triple Down's first hammer catches a bouncing / fallen foe (catch: all three hammers land, the third launches); Kinetic Grab's throw launches (no heavy knockdown: he flies as the bomb and its burst catches him in the air); Grand Slam no longer cancels into the Jackpot (on a downed foe it wasted most of its blasts — it comes after Triple Down's bounce). Visuals: Charged Deal's description (the hold, three cards), Rotor / 52 Pickup / Triple Down texts — see the board.
## 2026-10-17 — Archer: Double Shot's finishing arrow (the Archer chat's 2-beat chain)
- quick_shot, stage 2 (the charged arrow): numbers set as proposed — 14 dmg (the two fast arrows' 7 + 7 again), projectile 1250 px/s, range 470, radius 14, stun 320, push 90, heavy; startup 170, recovery 220. The chain deals 28 over ~655 ms (≈ 43 / s), beside the Book Mage's three-beat bolts (36 over ~800 ms, ≈ 45 / s); its push ends the chain at range, as an archer's should (the mage's lance pushes 30).
## 2026-10-11 — Gambler: openers that land (240-match audit: 27% wins, Staff Vault landing 58%, Ace 40%)
- staff_vault: a new first hit along the whole vault (capsule r30, at 40 ms, stun 340): it catches whoever it vaults through, from the distance fights open at (lands from 100 to 210 px in the arena). Visuals: the staff's arc can flash where it passes the foe.
- ace_in_the_hole: startup 420 → 300; the ace 22 px wide (was 18: the floor-depth band); its blow-up 870 → 750 ms (still at the end of its flight). Visuals: the charge-up is 120 ms shorter.
- Result (192 matches with the gambler): 53% wins (was 27%).
## 2026-10-11 — Arena HP on
- PVP.hpLocked false: hits in the arena take HP; a K.O. ends the round (checked: fight › K.O. › round 2, the win counted).

## 2026-10-12 — No MP in PvP
- The arena never uses MP: skills cost nothing there and the MP bar is hidden (cooldowns are the only limit). The regular game keeps its MP rules (MP_FREE test flag unchanged).

## 2026-10-12 — Class arena damage (PvP only; skills unchanged everywhere)
- The match sim now applies each skill's super armor / shot armor / the ultimate's invulnerability like the game does (it ignored them: the warrior, the armored Judge, looked far weaker than he is).
- 240 matches (10 class pairs × 24), before: warrior 21 %, samurai 70 %, mage 43 %, archer 61 %, gambler 55 %.
- New `ARENA.clsDmg` (Combat.ts), arena damage per class: warrior ×1.2, samurai ×0.95, book mage ×1.1.
- After (3 seeds × 240 matches, average): warrior 45 %, samurai 54 %, mage 48 %, archer 56 %, gambler 48 % — every class inside 40–60 %.
