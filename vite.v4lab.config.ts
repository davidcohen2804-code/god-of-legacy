// Build of the isolated V4 rig lab only (src/v4/lab/main.ts → dist-v4lab/assets/lab.js). It does not touch the game's
// build: different entry, different output folder, no public/ assets.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist-v4lab',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      input: 'src/v4/lab/main.ts',
      output: { entryFileNames: 'assets/lab.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' },
    },
  },
});
