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
4. records the movement demo (Godot's Movie Maker at a fixed 30 fps under Xvfb) → `qa/m2_movement_demo.mp4`,
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
| Player controller | `scripts/player/player_controller.gd` | camera-relative movement, jump and dodge from the buffer |
| Body | `scripts/combat/fighter.gd` | walk / run / sprint, jump, dodge (120 ms defensive window), gravity, facing |
| Character look and moves | `scripts/characters/character_visual.gd` | the Samurai, his katana on `hand_r`, the moves |
| Camera controller | `scripts/camera/camera_rig.gd` | exploration / combat / combo, always 30–45° and 7–9 m, damped, drag, wall pull-in |
| Arena | `scenes/arena/arena.gd`, `scripts/world/*` | the Fallen Moon Courtyard, the training target |
| Movement demo | `scripts/qa/demo_driver.gd` (`-- --demo`) | scripted touches, recorded in CI with Godot's Movie Maker |
| Combat state machine, hit detection, targeting | `scripts/combat/` (M3) | rendering- and UI-independent |
| Legacy Chain graph, ability definitions | `scripts/combat/`, `data/abilities/` (M4) | data-driven combo graph |
| Animation controller, VFX | `scripts/animation/`, `scripts/vfx/` | read combat state, never decide it |
| Enemy AI | `scripts/ai/` (M5) | training enemy, boss |

Assets and their sources: `PROVENANCE.md`.
