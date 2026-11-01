// Build of the isolated V4 character studio only (src/v4/studio/main.ts → dist-v4studio/assets/studio.js). It does not
// touch the game's build or the rig lab's: different entry, different output folder, no public/ assets.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist-v4studio',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: 'src/v4/studio/main.ts',
      output: { entryFileNames: 'assets/studio.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' },
    },
  },
});
