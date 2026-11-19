# GOD OF LEGACY — REBORN

A new, mobile-first 3D combo action RPG. It is a separate project from the game at the repository root (nothing of
the old Phaser / three.js game is used by it), developed on the `reborn` branch.

- **Engine:** Godot 4.7.2, GDScript, Compatibility renderer (WebGL 2 on the web — the only renderer Godot's web export
  runs). Native Android and iOS exports are possible later from the same project.
- **Web build:** single-threaded (no SharedArrayBuffer, so no cross-origin-isolation headers are needed): it runs
  from plain static hosting and on mobile Safari.
- **Play:** https://davidcohen2804-code.github.io/god-of-legacy/reborn/ (`?qa=1` exposes the state for tests).

## Build, test, deploy

Every push to `reborn` that touches `reborn/` runs `.github/workflows/reborn-pages.yml`:

1. downloads the official Godot 4.7.2 editor and web templates (cached),
2. imports the project and runs `tests/run_tests.gd` headless (every script and scene must load; unit tests),
3. exports the Web preset,
4. records the combat demo (Godot's Movie Maker at a fixed 30 fps under Xvfb) → `qa/m3_combat_demo.mp4`, with contact
   sheets of the whole clip and of the three-strike chain (`qa/m3_chain_frames.jpg`, slow motion
   `qa/m3_chain_slow_frames.jpg`),
5. runs `qa/smoke.mjs` in Playwright's Docker image — the real touch interface in Chromium as an Android phone and in
   WebKit as an iPhone (both landscape), the keyboard in Chromium at 1280×720 — and saves screenshots and
   `results.json`,
6. publishes the build (with `qa/`) into `gh-pages/reborn/`.

Testing limits: CI renders in software (no GPU), so its frame rates are not phone frame rates; WebKit on Linux is
close to Safari but is not iOS Safari; no physical phone is in the loop.

## Architecture

| Part | Where | Notes |
|---|---|---|
| Game state | `scripts/game/game.gd` (autoload `Game`) | screen flow, chosen character, settings |
| Character data | `data/characters.json`, `scripts/game/roster.gd` | data-driven roster; locking decided here |
| User interface | `scenes/menu/*`, `scripts/ui/*` | theme, backdrop, settings; no game rules inside |
| QA bridge | `scripts/qa/qa_bridge.gd` (autoload `QA`) | `window.__gol` with `?qa=1` only |
| Input system | `scripts/input/player_input.gd` | touch, keyboard, gamepad → intents; 0.12 s buffer; sprint after 0.25 s at the stick's rim |
| Touch controls | `scripts/ui/touch_controls.gd` | GPT's 1280×720 layout, safe area, ≥ 44 CSS px hit targets, multi-touch by id |
| Player controller | `scripts/player/player_controller.gd` | camera-relative movement; jump, dodge and attack presses from the buffer, each tick before the body moves |
| Body | `scripts/combat/fighter.gd` | walk / run / sprint, jump, dodge (ground only, 120 ms defensive window), gravity, facing; held by a strike (`action_lock`) or hit-stop (`frozen`) |
| Character look and moves | `scripts/characters/character_visual.gd`, `automaton_visual.gd` | the Samurai, his katana on `hand_r`, the moves; the automaton dressed from its measurements (lacquered wood, bronze, stone, a practice sword) |
| Camera controller | `scripts/camera/camera_rig.gd` | exploration / combat / combo, always 30–45° and 7–9 m, damped, drag, wall pull-in |
| Arena | `scenes/arena/arena.gd`, `scripts/world/*` | the Fallen Moon Courtyard; the training dummy (150 HP, a fixed diagnostic target: sways, falls and stands up); the Training Automaton (M4: 150 HP, a humanoid target — flinches, pushes, the chain's capture with diminishing returns, pulls stopped by solid things, launches on an exact arc, the juggle cap, knockdown and getting up; `data/targets.json` says what each target resists; from Stage C a scripted sparring partner — its telegraphed sweep from `data/abilities/automaton.json`, an amber arc on the floor where the cut will pass) |
| HUD | `scripts/ui/combat_hud.gd` | player health, target health with a damage chip, a prompt line; developer notes only with `?qa=1` |
| Combat demo | `scripts/qa/demo_driver.gd` (`-- --demo`) | scripted touches, recorded in CI with Godot's Movie Maker |
| Combat state machine | `scripts/combat/melee_state.gd`, `attack_data.gd` | pure logic on the physics tick — every action from data (`data/abilities/samurai.json`): startup / active / recovery, hit-stop, the three-strike chain (only confirmed hits advance it), other actions (Heavy) from free and off cooldown, timed action events, cancel and interrupt rules |
| Enemy blows, evasion | `scripts/combat/hit_resolver.gd`, `combat_controller.gd` | an enemy's blade swept against the Samurai along his movement through the same tick: hit, avoided (a roll's window) or evaded (GPT's v1.4 rule B: the blade crossing his Shadow Origin inside Shadow Step's 120 ms window — `attack_evaded`, which opens Shadow Counter) |
| Hit detection, targeting | `scripts/combat/sword_sweep.gd`, `combat_controller.gd` | the blade's own path through each active window (baked from its move by `tools/bake_blades.mjs` into `data/abilities/samurai_blades.json`, checked against Godot's pose by a test) swept between ticks against each target's capsule — no tunnelling, once per target per action; target assist (3.6 m, ±60°); drives body, moves, trail and camera from the state machine |
| Blade trail | `scripts/combat/blade_trail.gd` | the swing's ribbon; shows, never decides |
| Combat sound, hit effects | `scripts/audio/combat_sfx.gd`, `scripts/vfx/hit_vfx.gd` | listen to the combat controller's signals (swing on the active window, impact and sparks on a hit, dust on the finisher) |
| Legacy Chain graph, ability definitions | `scripts/combat/legacy_chain.gd`, `data/abilities/` (M4) | data-driven combo graph: captured → Chain Pull, launched → Aerial Pursuit, evaded → Shadow Counter |
| Animation controller, VFX | `scripts/animation/`, `scripts/vfx/` | read combat state, never decide it |
| Enemy AI | `scripts/ai/` (M5) | training enemy, boss |

Assets and their sources: `PROVENANCE.md`.
