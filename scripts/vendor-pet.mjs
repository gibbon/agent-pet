#!/usr/bin/env node
// Download a Codex pet spritesheet from codex-pets.net into public/sprites/<id>.webp
// so a deployed instance can serve it locally — useful for self-hosted
// installs that don't want a runtime dep on codex-pets.net storage.
//
// Usage:
//   node scripts/vendor-pet.mjs homelander
//   node scripts/vendor-pet.mjs homelander guga totoro
//
// After running, reference via data-image-url:
//   <script src=".../agent-pet-widget.iife.js"
//           data-image-url="/sprites/homelander.webp"
//           data-use-codex-atlas></script>

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const STORAGE_BASE = 'https://ihzwckyzfcuktrljwpha.supabase.co/storage/v1/object/public/pets';

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('Usage: node scripts/vendor-pet.mjs <id> [<id> ...]');
  process.exit(1);
}

const outDir = 'public/sprites';
mkdirSync(outDir, { recursive: true });

let failed = 0;
for (const id of ids) {
  const url = `${STORAGE_BASE}/${encodeURIComponent(id)}/spritesheet.webp`;
  process.stdout.write(`vendoring ${id} ... `);
  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.error(`HTTP ${r.status}`);
      failed++;
      continue;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const path = join(outDir, `${id}.webp`);
    writeFileSync(path, buf);
    console.log(`${(buf.byteLength / 1024).toFixed(1)} KB → ${path}`);
  } catch (err) {
    console.error(err.message);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${ids.length} failed.`);
  process.exit(1);
}
console.log(`\nDone. Reference via data-image-url="/sprites/<id>.webp" data-use-codex-atlas.`);
