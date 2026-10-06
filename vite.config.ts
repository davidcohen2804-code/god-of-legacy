import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function gitCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return 'unknown'; }
}

const COMMIT = gitCommit();

/** Content hash of every file in public/ ("assets/x/y.png" -> 10 hex chars). The game appends it to each asset URL,
 *  so a deploy only invalidates the files that really changed (the rest stay in the browser cache). */
function assetHashes(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative('public', p).split(sep).join('/')] = createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 10);
    }
  };
  walk('public');
  return out;
}

export default defineConfig({
  plugins: [{ // version.json next to index.html: open pages poll it and reload themselves on a new deploy
    name: 'version-file',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ commit: COMMIT }) }); },
  }, {
    name: 'asset-hashes',
    resolveId(id) { return id === 'virtual:asset-hashes' ? '\0asset-hashes' : null; },
    load(id) { return id === '\0asset-hashes' ? `export default ${JSON.stringify(assetHashes())};` : null; },
  }],
  base: './', // works at any sub-path (GitHub Pages project URL)
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_COMMIT__: JSON.stringify(COMMIT),
  },
  build: {
    // QA build ships source maps; set NO_SOURCEMAP=1 for a production build later.
    sourcemap: !process.env.NO_SOURCEMAP,
    chunkSizeWarningLimit: 2000,
  },
});
