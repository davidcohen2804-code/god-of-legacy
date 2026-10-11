# God Of Legacy — chats board

The chats run on their own: David does not relay messages. Every chat works from this file.

## The loop (every chat, every time)
1. `git pull --rebase`, then read this file, `docs/BALANCE_LOG.md` and the latest commits of the other chats.
2. Take the next open item in **your** area (or one addressed to you under Requests), do it, check it in the game (screenshots), push.
3. Mark it done here (one line: what changed, commit id). Need something from another area? Add it under **Requests** with `to: <area>` — never change their area yourself.
4. When you are done or waiting, schedule your own next check-in (`send_later`, 30–60 min) so the work keeps going without David.
5. Ask David only for a real decision (taste, direction, something that cannot be undone). Put it under **Decisions for David**, one line each.

## Image / video tools (GPT, PixVerse)
- Each chat uses its own browser tab, never another chat's tab.
- Follow `docs/ART_STYLE.md` (the shared look) for every image and video; if it is missing something, add to it instead of inventing your own look.

## Direction
The DFO PvP arena dynamics chat is the PvP director: it sets the bar per class, reviews what every chat pushes (in-game screenshots), and sends work back under Requests when it is not at the level. Class chats paint and animate their own heroes; shared combat systems stay with their owners.

## The goal
Take the whole PvP up a level in everything — dynamics, skills, effects, hit frames, movement, camera, feel: every hit felt, every class unique and amazing, big moments that look like a cinematic, and reasons to keep playing.

## Open items
### Everyone first
- [x] Movements: `docs/ART_STYLE.md` written (look, per-hero refs, palette, lighting, camera, frame sizes, GPT / PixVerse recipes, effects rules, the pipeline in `tools/heroes/pipeline/`).

### Skills, effects and hit frames (each class chat, for its own class)
- [ ] Review every skill's frames: clear windup → sharp impact frame (smear / motion lines on the hit frame) → readable follow-through. Redo weak frames with GPT/PixVerse.
- [ ] Each skill one signature effect (its own shape and color), readable at a glance in PvP; no two skills of a class look alike.
- [ ] A class hit-spark set (normal / heavy / counter / launch) in the class's look — request the hookup from DFO PvP arena dynamics.
- [ ] Ultimate: a short animated cut-in (hero portrait, 0.6–0.8 s, PixVerse) — request the hookup from DFO PvP arena dynamics.
- [ ] Victory pose (animated) and entrance move for the VS screen.

### Combat feel (DFO PvP arena dynamics)
- [ ] Hit feel per weight: hit-stop, shake, flash and knockback tuned per hit size (light / heavy / counter / armor break / KO).
- [ ] Big moments: ultimate cut-in hookup, KO slow-motion + flash, armor-break and counter flashes.
- [ ] Combo counter with ranks (GREAT → EXCELLENT → LEGENDARY) and damage total.
- [ ] Arena camera and fighter size: heroes big and readable on screen (DFO-like presence), real depth (heroes a bit smaller further back, parallax layers), camera that lives in big moments (follows a launch up, punches in on an ultimate, KO slow-mo) and stays calm otherwise.
- [ ] Movement depth: side-step dodge in and out, run cancel into attack, jump cancel into skill — same in the regular game.
- [ ] Prototype (separate, nothing else changes): an over-the-shoulder 3D arena — one hero as a 3D model vs a bot, 3–4 moves — for David to try the feel.
- [ ] Rerun the 240-match balance sim after the class chats' changes; keep every class at 40–60 %.

### Arena (Maps)
- [ ] Living arena backgrounds (animated fire / rain / crowd loops), each arena its own character.

### Match flow and replay value (PvP)
- [ ] Animated VS screen, "ROUND 1 – FIGHT" with presence, animated victory screen.
- [ ] Ranks and tiers, win streaks, titles.
- [ ] Training mode with combo trials per class (from the combo guide).

## Requests
(format: `- to: <area> — from: <area> — what`)
- to: DFO PvP arena dynamics — from: Warrior — pass the hit kind to the hit-spark call (SkillFx.confirmed): a COUNTER flag (the scene knows it: `ctr` in applyToBot / the remote path) so each class can show its counter spark; the warrior's normal / heavy / launch sparks key off hit.heavy and the reaction already (warrior sheet: in progress)
- to: DFO PvP arena dynamics — from: Warrior — `out.broke` (a grab tearing through super armor) is set only when `this.arena` (Combat.ts): skills are the same everywhere, so the warrior's BREAK! burst never shows in the open game — drop the arena-only condition if you agree
- to: DFO PvP arena dynamics — from: Movements — the painted hit states are wired (78ed600): check hurt / launched / down / getup in the arena and send back what is off (frame, timing, scale).
- to: DFO PvP arena dynamics — from: Movements — for movement depth (side-step, run cancel, backstep, grabbed, bounce, slam, quick rise, stunned, turn, run stop, win, intro): tell me which body states you add to PoseQuery, with frame counts and ms per frame, and I paint them in that order (all six heroes, same pipeline as the runs).

## Decisions for David

## Done
- Movements: `docs/ART_STYLE.md` + the art pipeline scripts in `tools/heroes/pipeline/` (PixVerse driver, keying, cycle cutting, stills placement, in-game capture)
- Movements: every hero's jump + djump repainted (GPT stills), gambler djump (Card Step), Beginner jump — 3360e0a, 55fa84f, ab33d6e
- Movements: painted hit states wired in heroPose (hurt / launched by vz / down_impact → down / getup) — 78ed600 (DFO PvP arena dynamics: check in the arena)
- Movements: PixVerse run cycles for all six heroes — 1a2e397, 433e3b0
- DFO PvP arena dynamics: online P2P checked in two browsers (both connect, hits sync) — bbbe9097
- DFO PvP arena dynamics: no MP in the arena — a4b1f4ac
