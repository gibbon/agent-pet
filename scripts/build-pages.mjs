#!/usr/bin/env node
// Lay out the Cloudflare Pages publish dir.
//
//   public/                            ← root: always latest, may break
//   public/v0.1/                       ← pinned to current major.minor
//   public/version.json                ← {"version":"0.1.0","bucket":"v0.1"}
//
// Pre-1.0 versioning: each minor is a potential breaking change, so the
// bucket is `v0.<minor>` (e.g. v0.1, v0.2). Post-1.0, the bucket is `v<major>`.
//
// Consumers pinning the path get immutable, long-cache-safe URLs:
//   <script src="https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js">

import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [major, minor] = pkg.version.split('.');
const bucket = major === '0' ? `v0.${minor}` : `v${major}`;

// 1. Latest at the root of public/
cpSync('dist', 'public', { recursive: true });

// 2. Versioned copy
const versionedDir = join('public', bucket);
mkdirSync(versionedDir, { recursive: true });
cpSync('dist', versionedDir, { recursive: true });

// 3. Manifest so consumers can discover what 'latest' resolves to
writeFileSync(
  join('public', 'version.json'),
  JSON.stringify({ version: pkg.version, bucket, latestPath: '/' }, null, 2) + '\n'
);

console.log(`✓ Pages output:`);
console.log(`    public/                  → latest (${pkg.version})`);
console.log(`    public/${bucket}/${' '.repeat(Math.max(0, 16 - bucket.length))}→ pinned to ${bucket}`);
console.log(`    public/version.json      → version manifest`);
