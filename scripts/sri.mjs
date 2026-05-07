#!/usr/bin/env node
// Generate SHA-384 SRI hashes for every file in dist/. Used so consumers
// loading the widget from a CDN can pin the hash via:
//   <script src="..." integrity="sha384-..." crossorigin="anonymous">
//
// Output: dist/SRI.json (one entry per file) plus a console table.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const distDir = new URL('../dist', import.meta.url).pathname;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const result = {};
for (const file of walk(distDir)) {
  if (!/\.(js|css)$/.test(file)) continue;
  const buf = readFileSync(file);
  const h = createHash('sha384').update(buf).digest('base64');
  const rel = relative(distDir, file);
  result[rel] = { integrity: `sha384-${h}`, bytes: buf.byteLength };
}

writeFileSync(join(distDir, 'SRI.json'), JSON.stringify(result, null, 2) + '\n');

console.log('SRI hashes (sha384):');
for (const [name, { integrity, bytes }] of Object.entries(result)) {
  console.log(`  ${name.padEnd(36)} ${integrity}  (${(bytes / 1024).toFixed(1)} KB)`);
}
