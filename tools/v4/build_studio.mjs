// Builds the character studio and writes two pages next to the bundle: page.html (content only, for a private artifact)
// and index.html (a full document, for local headless runs).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build --config vite.v4studio.config.ts', { stdio: 'inherit' });
const page = readFileSync('src/v4/studio/page.html', 'utf8');
writeFileSync('dist-v4studio/page.html', page);
writeFileSync('dist-v4studio/index.html', `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${page}\n</body>\n</html>\n`);
console.log('studio built: dist-v4studio/page.html, dist-v4studio/index.html, dist-v4studio/assets/studio.js');
