#!/usr/bin/env node
// Capture a hero screenshot of the live demo for the README.
//
// Usage: node scripts/screenshot.mjs [output-path]
//   - Defaults to docs/hero.png
//   - Requires google-chrome on PATH (no extra dependencies).
//
// The widget mounts on DOMContentLoaded and animates after that — the
// virtual-time-budget below gives it ~4s of simulated time to load the
// spritesheet, settle the sprite, and run the initial waving animation.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'docs/hero.png');
const url = process.env.AGENT_PET_URL ?? 'https://agent-pet.pages.dev/';

execFileSync('google-chrome', [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--window-size=1280,800',
  '--virtual-time-budget=4000',
  `--screenshot=${out}`,
  url,
], { stdio: 'inherit' });

console.log(`hero saved → ${out}`);
