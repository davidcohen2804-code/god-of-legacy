import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

/** WebP twins of the big PNGs (David 18 Oct 18:10: the PVP training loaded ~80 MB, 59 of them PNG sheets): at build time
 *  every PNG over 200 KB in public/ gets a WebP copy beside it (`x.png.webp`: quality 90, its alpha exact) when that is at
 *  least a quarter smaller, and the game's loader takes the twin instead (main.ts). Cached by content hash in
 *  .cache/webp-twins (the deploy keeps it). NO_WEBP=1 skips it (the QA screenshot build). */
function webpTwins(): Plugin {
  let build = false;
  const twins = new Map<string, Buffer>();
  return {
    name: 'webp-twins',
    configResolved(c) { build = c.command === 'build' && !process.env.NO_WEBP; },
    async buildStart() {
      if (!build) return;
      const sharp = (await import('sharp')).default;
      const hashes = assetHashes(), dir = '.cache/webp-twins';
      mkdirSync(dir, { recursive: true });
      const todo = Object.keys(hashes).filter((p) => p.endsWith('.png') && statSync(join('public', p)).size > 200_000);
      let i = 0, made = 0;
      const work = async () => {
        while (i < todo.length) {
          const p = todo[i++], size = statSync(join('public', p)).size, cf = join(dir, `${hashes[p]}.webp`);
          let buf: Buffer;
          if (existsSync(cf)) buf = readFileSync(cf);
          else { buf = await sharp(join('public', p), { limitInputPixels: false }).webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true }).toBuffer(); writeFileSync(cf, buf); made++; }
          if (buf.length <= size * 0.75) twins.set(p, buf);
        }
      };
      await Promise.all([work(), work(), work()]);
      console.log(`webp twins: ${twins.size} of ${todo.length} big PNGs (${made} converted now)`);
    },
    resolveId(id) { return id === 'virtual:webp-twins' ? '\0webp-twins' : null; },
    load(id) { return id === '\0webp-twins' ? `export default ${JSON.stringify([...twins.keys()])};` : null; },
    generateBundle() { for (const [p, buf] of twins) this.emitFile({ type: 'asset', fileName: `${p}.webp`, source: buf }); },
  };
}

export default defineConfig({
  plugins: [webpTwins(), { // version.json next to index.html: open pages poll it and reload themselves on a new deploy
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
