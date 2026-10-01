import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

function gitCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return 'unknown'; }
}

export default defineConfig({
  base: './', // works at any sub-path (GitHub Pages project URL)
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_COMMIT__: JSON.stringify(gitCommit()),
  },
  build: {
    // QA build ships source maps; set NO_SOURCEMAP=1 for a production build later.
    sourcemap: !process.env.NO_SOURCEMAP,
    chunkSizeWarningLimit: 2000,
  },
});
