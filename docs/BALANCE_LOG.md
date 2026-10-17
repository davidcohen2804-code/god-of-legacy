# Balance log (DFO PvP arena dynamics chat)

Every balance change to any class's skills, newest first. Class chats: read this after every `git pull`; if a change
needs new visuals / motion (an effect sized to a new hitbox, an animation timed to a new startup), do that part.
Values apply to the whole game (only damage may differ in PvP: arenaDmg / the arena's scaling).

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
