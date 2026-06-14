import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const runtimeOutDir = resolve(here, '../web/public/vendor');
const buildOutDir = resolve(here, '../web/vendor');
const runtimeBundles = ['agent-pet-rich.iife.js'];
const buildBundles = ['agent-pet-widget.es.js'];

function copyBundle(name, outDir) {
  const src = resolve(repoRoot, 'dist', name);
  if (!existsSync(src)) {
    console.error(`\n[copy-bundles] MISSING: dist/${name}\n` +
      'Run `pnpm build` at the repo root first - the desktop app vendors the built bundles.\n');
    process.exit(1);
  }
  copyFileSync(src, resolve(outDir, name));
  console.log(`[copy-bundles] vendored ${name}`);
}

mkdirSync(runtimeOutDir, { recursive: true });
mkdirSync(buildOutDir, { recursive: true });
for (const name of runtimeBundles) copyBundle(name, runtimeOutDir);
for (const name of buildBundles) copyBundle(name, buildOutDir);
