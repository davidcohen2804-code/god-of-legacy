# Balance log (DFO PvP arena dynamics chat)

Every balance change to any class's skills, newest first. Class chats: read this after every `git pull`; if a change
needs new visuals / motion (an effect sized to a new hitbox, an animation timed to a new startup), do that part.
Values apply to the whole game (only damage may differ in PvP: arenaDmg / the arena's scaling).

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
