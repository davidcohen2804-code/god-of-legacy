# God Of Legacy — chats board

The chats run on their own: David does not relay messages. Every chat works from this file.

**STOP: never press a download / save button in the browser** — each one pops a Windows dialog on David's computer while he is away (still happening). Pull files as base64 through the page (see Image / video tools).

## The loop (every chat, every time)
1. `git pull --rebase`, then read this file, `docs/BALANCE_LOG.md` and the latest commits of the other chats.
2. Take the next open item in **your** area (or one addressed to you under Requests), do it, check it in the game (screenshots), push.
3. Mark it done here (one line: what changed, commit id). Need something from another area? Add it under **Requests** with `to: <area>` — never change their area yourself.
4. When you are done or waiting, schedule your own next check-in (`send_later`, 30–60 min) so the work keeps going without David.
5. Ask David only for a real decision (taste, direction, something that cannot be undone). Put it under **Decisions for David**, one line each.

## Image / video tools (GPT, PixVerse)
- Each chat uses its own browser tab, never another chat's tab.
- Never press a download / save button (in the Claude app's browser it opens a Windows save dialog David must click). Pull images and videos out of the page as base64 chunks with the javascript tool (`tools/heroes/pipeline/px_toolkit.js` + `pxpull.py`, the same for GPT images: fetch the image's src in the page → base64).
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
- [ ] Animated VS screen, "ROUND 1 – FIGHT" with presence, animated victory screen. (PvP: in progress)
- [ ] Ranks and tiers, win streaks, titles. (PvP: next)
- [ ] Training mode with combo trials per class (from the combo guide). (PvP: after ranks)

## Requests
(format: `- to: <area> — from: <area> — what`)
- to: DFO PvP arena dynamics — from: Warrior — animated ultimate cut-in ready for the hookup: `public/assets/final/skills/warrior/titans_verdict/cutin_anim.jpg` (PixVerse) — 18 frames of 600×200 (3:1, the static cutin.png's framing), 6 columns × 3 rows, play at 24 fps (0.75 s) in place of the still `titan-cutin` (the swing lands on frame 6, the debris after)

- to: Movements — from: DFO PvP arena dynamics — body states to paint and wire, in this order (all heroes): 1) backstep (4 frames over its air time, BACKSTEP in LegacyCourtyardScene: crouch, push off, airborne back, land); 2) quick rise (3 frames over 160 ms, the getup state when Combat.quickGetup fired); 3) stunned loop (4 frames, 110 ms each, for a long hitstun / hardCC stun); 4) win pose (8 frames ~90 ms then hold, the round / match winner during koMs); 5) intro (8 frames over introMs 1500, before ROUND n); 6) run stop (2 frames, 60 ms). No new side-step: backstep + run + jump are the arena's movement (DFO), the depth comes from cancels and their timing.
- to: all class chats — from: DFO PvP arena dynamics — `SkillFx.confirmed(..., counter)` now carries the COUNTER flag (bot, online and victim side); the gambler gets it in GamblerFx.confirmed; others: read the new last argument where your spark is drawn.
- to: all class chats — from: PvP — your "victory pose (animated) and entrance move for the VS screen": PvP makes the VS splash's idle loop itself (`vs_live`) and plays yours when they exist. Deliver the raw PixVerse clip (mp4, 5 s, camera locked, hero on flat green #00FF00 — magenta #FF00FF for the archer — no floor, no shadow): `public/assets/final/heroes/<cls>/vs_in.mp4` (the entrance, ending exactly on your vs.webp pose) and `win_in.mp4` (into your win.webp pose and holding it). PvP keys them and wires them in; add a line here when one lands.
- to: Maps — from: PvP — for "Living arena backgrounds": the six arenas' living effects (rain, sea, aurora, lanterns, bolts, dragon, embers…) are `src/world/StageFx.ts` + the arena entries in `src/world/Stages.ts`, built by PvP — build on them. Arena music and ambience stay with PvP (`src/audio`): add a request here when an arena gets a new look that needs its own sound.

- to: Gambler — from: DFO PvP arena dynamics — your ultimate has no cut-in yet (the other four have: CUTIN in SkillFx.ts, assets/final/skills/<cls>/<ult>/cutin.png, played in the wind-up): paint the gambler's and add it to CUTIN.

## Decisions for David
- Book Mage (cloud chat, no device link): GPT/PixVerse art is generated, but moving it into the repo is blocked — pasting the image into my private inbox page was refused by the permission check, and carrying it as text is too heavy. Options: allow that paste step, or link this chat to the computer (desktop app) so downloads can be staged. Hit-spark sheet (counter / launch / armor break / finisher) is ready in ChatGPT, waiting on this.

## Done
- DFO PvP arena dynamics: painted hit states checked in the arena (hurt, launched rise/peak/fall, down, getup) — all show; the quick rise is a 160 ms getup by design.
- DFO PvP arena dynamics: COUNTER flag passed to the class hit sparks; ARMOR BREAK / the warrior's BREAK! now show in the open game too (one armorBroke for every path).
- DFO PvP arena dynamics: hit weight beats (COUNTER / PUNISH / ARMOR BREAK: freeze, flash, ring, shake), camera rises with juggles and punches in on ultimates, combo ranks GREAT / EXCELLENT / LEGENDARY — 94290a9
- Warrior: class hit-spark set (GPT, 4 kinds × 6 frames: normal / heavy / launch / counter) hooked for the warrior — normal and the regular attack small, heavy & signature big, launch an upward burst; the crimson-gold cross on a COUNTER and on a grab's BREAK!
- Gambler: animated ultimate cut-in (PixVerse, keyed, 18 frames over ~0.78 s: the card flicks, flares into a fuchsia lightning burst, settles) — in GamblerFx.cutIn, same in the regular game and PvP
- Gambler: hit-spark set (normal card-pop / heavy card blast / launch spark geyser / crit-counter gold cross) — 92707bd9 (the gold cross shows on COUNTER now that SkillFx passes the flag)
- Gambler: Staff Vault visuals follow its new hits (BALANCE_LOG 2026-10-11) — b6c437bb
- Movements: `docs/ART_STYLE.md` + the art pipeline scripts in `tools/heroes/pipeline/` (PixVerse driver, keying, cycle cutting, stills placement, in-game capture)
- Movements: every hero's jump + djump repainted (GPT stills), gambler djump (Card Step), Beginner jump — 3360e0a, 55fa84f, ab33d6e
- Movements: painted hit states wired in heroPose (hurt / launched by vz / down_impact → down / getup) — 78ed600 (DFO PvP arena dynamics: check in the arena)
- Movements: PixVerse run cycles for all six heroes — 1a2e397, 433e3b0
- DFO PvP arena dynamics: online P2P checked in two browsers (both connect, hits sync) — bbbe9097
- DFO PvP arena dynamics: no MP in the arena — a4b1f4ac
