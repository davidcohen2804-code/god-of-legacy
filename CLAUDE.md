# God Of Legacy — working rules

- Source of truth: `main` branch of davidcohen2804-code/god-of-legacy. No separate project copies.
- After every approved change: commit and push to `main`. The workflow `.github/workflows/deploy.yml` builds and publishes to the `gh-pages` branch (GitHub Pages).
- Public URLs (must stay the same):
  - https://davidcohen2804-code.github.io/god-of-legacy/
  - https://davidcohen2804-code.github.io/god-of-legacy/?qa=1
- Implement only what each stage spec asks. Do not add features, guess missing details, or change approved decisions without approval.
- No QA summary documents unless explicitly requested.
- Update `CURRENT_STAGE` in `src/config/layout.ts` when a new stage is approved.
