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
4. runs `qa/smoke.mjs` — Playwright drives the real touch interface in Chromium as an Android phone and in WebKit
   as an iPhone, both landscape, and saves screenshots and `results.json`,
5. publishes the build (with `qa/`) into `gh-pages/reborn/`.

Testing limits: CI renders in software (no GPU), so its frame rates are not phone frame rates; WebKit on Linux is
close to Safari but is not iOS Safari; no physical phone is in the loop.

## Architecture

| Part | Where | Notes |
|---|---|---|
| Game state | `scripts/game/game.gd` (autoload `Game`) | screen flow, chosen character, settings |
| Character data | `data/characters.json`, `scripts/game/roster.gd` | data-driven roster; locking decided here |
| User interface | `scenes/menu/*`, `scripts/ui/*` | theme, backdrop, settings; no game rules inside |
| QA bridge | `scripts/qa/qa_bridge.gd` (autoload `QA`) | `window.__gol` with `?qa=1` only |
| Input system | `scripts/input/` (M2) | touch joystick and buttons, keyboard, gamepad → intents |
| Player controller | `scripts/player/` (M2) | movement from intents |
| Camera controller | `scripts/camera/` (M2) | exploration / combat / combo modes, touch drag |
| Combat state machine, hit detection, targeting | `scripts/combat/` (M3) | rendering- and UI-independent |
| Legacy Chain graph, ability definitions | `scripts/combat/`, `data/abilities/` (M4) | data-driven combo graph |
| Animation controller, VFX | `scripts/animation/`, `scripts/vfx/` | read combat state, never decide it |
| Enemy AI | `scripts/ai/` (M5) | training enemy, boss |

Assets and their sources: `PROVENANCE.md`.
