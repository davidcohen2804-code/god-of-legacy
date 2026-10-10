# God Of Legacy — working rules

- Source of truth: `main` branch of davidcohen2804-code/god-of-legacy. No separate project copies.
- After every approved change: commit and push to `main`. The workflow `.github/workflows/deploy.yml` builds and publishes to the `gh-pages` branch (GitHub Pages).
- Public URLs (must stay the same):
  - https://davidcohen2804-code.github.io/god-of-legacy/
  - https://davidcohen2804-code.github.io/god-of-legacy/?qa=1
- Implement only what each stage spec asks. Do not add features, guess missing details, or change approved decisions without approval.
- No QA summary documents unless explicitly requested.
- Update `CURRENT_STAGE` in `src/config/layout.ts` when a new stage is approved.
- QA screenshots of every screen are generated automatically by CI on each push (`scripts/qa-screenshots.mjs`) and published to the `gh-pages` branch under `qa/`.

## Parallel chats (each owns its area — do not change another chat's area)
- Several chats push to `main` at the same time. Always `git pull --rebase` before starting and before every push; on a conflict keep the other chat's work and redo yours on top (generated files such as `src/data/hero-atlas.json` / hero `body.png`: take theirs, re-run the generator).
- Areas: Movements (hero body moves: idle, walk, run, jumps, hit/launch/down/get-up, the Beginner and character creation) · one chat per class for its skills (Warrior, Samurai, Archer, Book Mage, Gambler) · Maps · PvP · DFO PvP arena dynamics.
- Before touching a shared file outside your area, check `git log` for recent work on it and change only what your task needs.
