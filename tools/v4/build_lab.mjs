// Builds the lab and writes two pages next to the bundle: page.html (the content-only page published as a private
// artifact) and index.html (the same content in a full document, for local headless runs).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build --config vite.v4lab.config.ts', { stdio: 'inherit' });
const page = readFileSync('src/v4/lab/page.html', 'utf8');
writeFileSync('dist-v4lab/page.html', page);
writeFileSync('dist-v4lab/index.html', `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${page}\n</body>\n</html>\n`);
console.log('lab built: dist-v4lab/page.html, dist-v4lab/index.html, dist-v4lab/assets/lab.js');
