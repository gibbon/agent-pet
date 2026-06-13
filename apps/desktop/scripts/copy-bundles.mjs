import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const outDir = resolve(here, '../web/public/vendor');
const bundles = ['agent-pet-widget.iife.js', 'agent-pet-rich.iife.js'];

mkdirSync(outDir, { recursive: true });
for (const name of bundles) {
  const src = resolve(repoRoot, 'dist', name);
  if (!existsSync(src)) {
    console.error(`\n[copy-bundles] MISSING: dist/${name}\n` +
      'Run `pnpm build` at the repo root first - the desktop app vendors the built bundles.\n');
    process.exit(1);
  }
  copyFileSync(src, resolve(outDir, name));
  console.log(`[copy-bundles] vendored ${name}`);
}
