# agent-pet Desktop Buddy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing agent-pet web widget in a Tauri (Rust) desktop app — a transparent, always-on-top floating pet driven by a localhost HTTP API — and ship a Windows installer.

**Architecture:** A Tauri shell owns a transparent, undecorated, dynamic-bounding-box window plus a localhost `axum` HTTP server. External processes POST to the server; Rust validates and emits Tauri events; a small bridge in the webview re-validates and calls the existing `AgentPet` API. The webview is the already-built widget IIFE on a transparent host page. The window resizes to hug the pet (bounds reported JS→Rust), giving free click-through without cursor polling.

**Tech Stack:** Tauri v2, Rust (`axum`, `tokio`, `constant_time_eq`, `rand`), the existing widget IIFE (`dist/agent-pet-widget.iife.js`) + rich runtime (`dist/agent-pet-rich.iife.js`), pnpm/vite build, GitHub Actions (`windows-latest`, NSIS bundle).

**Spec:** `docs/superpowers/specs/2026-06-14-desktop-buddy-design.md` — read it before starting. Section numbers below reference it.

**Conventions:**
- Tauri **v2** APIs throughout (`tauri = "2"`, capabilities in `apps/desktop/src-tauri/capabilities/`, CSP in `tauri.conf.json` → `app.security.csp`, events via `AppHandle::emit` / JS `@tauri-apps/api/event`).
- All Rust commands and HTTP handlers live under `apps/desktop/src-tauri/src/`. Run Rust tests with `cargo test` from `apps/desktop/src-tauri/`.
- Bridge JS is plain ES modules bundled by vite into `apps/desktop/web/`; tested with the repo's existing `vitest` from the repo root. These are **pure-node** unit tests (the repo has no jsdom configured and the helpers don't touch the DOM). If a test ever needs `document`/`ResizeObserver`, add a `// @vitest-environment jsdom` docblock to that file and add `jsdom` to devDependencies — otherwise don't.
- Commit after every task. Use conventional-commit prefixes (`feat(desktop):`, `test(desktop):`, `chore(desktop):`).

---

## File Structure

```
apps/desktop/
  src-tauri/
    src/
      main.rs            # thin bin: calls agent_pet_desktop::run()
      lib.rs             # run(): build app, window, tray, spawn server; declares pub mod's
      window.rs          # create/configure the transparent bounding-box window
      commands.rs        # IPC commands: report_bounds, start_drag, quit, report_registry
      server/
        mod.rs           # axum router + bind 127.0.0.1 + port-file lifecycle
        auth.rs          # header + Sec-Fetch-Site/Origin middleware, token, rate limit
        handlers.rs      # /state /play /say /actions /health handlers + validation
        state.rs         # shared AppState: token, action registry, AppHandle, limiter
      pet.rs             # WidgetState set (9) + action-name syntactic floor
      portfile.rs        # atomic, owner-only port+token file (Windows ACL / Unix 0600)
    capabilities/
      default.json       # minimal capability allowlist (the 4 commands only)
    icons/               # app + tray icons
    tauri.conf.json      # window flags, full CSP, NSIS bundle config
    Cargo.toml
    build.rs
  web/
    index.html           # transparent host page, loads widget IIFE + bridge
    bridge.js            # Tauri events <-> AgentPet API (validated) + bounds + registry report
    bridge.test.ts       # headless tests for payload validation + bounds math
    launch-config.js     # default pet config (name, imageUrl, manifest, richRuntimeUrl=local)
  vite.desktop.config.ts # builds web/ into src-tauri's frontendDist
  package.json           # desktop-local scripts (build copies bundles, fail-fast)
  README.md
.github/workflows/
  desktop-windows.yml    # windows-latest: build widget -> bundle -> installer artifact
```

Each Rust module has one responsibility; `server/` is split so auth/middleware, routing, and handler logic stay independently testable. `pet.rs` is the single source of truth for the 9 states and the action-name floor, imported by both handlers and tests.

---

## Task 0: Scaffold the Tauri app + monorepo build wiring

**Files:**
- Create: `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/build.rs`, `apps/desktop/src-tauri/src/main.rs`, `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/web/index.html`, `apps/desktop/web/launch-config.js`, `apps/desktop/vite.desktop.config.ts`, `apps/desktop/package.json`
- Create: `apps/desktop/scripts/copy-bundles.mjs`
- Modify: root `pnpm-workspace.yaml` (create if absent) to include `apps/*`

- [ ] **Step 1: Install the Tauri CLI** (toolchain prep, not a test)

Run: `cargo install tauri-cli --version "^2" --locked`
Expected: `cargo tauri --version` prints a 2.x version. (On Linux/WSL also ensure `webkit2gtk-4.1`, `libgtk-3-dev`, `librsvg2-dev`, `libayatana-appindicator3-dev` are installed — `cargo tauri build` will name any missing one.)

- [ ] **Step 2: Write the bundle-copy script with a fail-fast check**

`apps/desktop/scripts/copy-bundles.mjs`:
```js
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const outDir = resolve(here, '../web/vendor');
const bundles = ['agent-pet-widget.iife.js', 'agent-pet-rich.iife.js'];

mkdirSync(outDir, { recursive: true });
for (const name of bundles) {
  const src = resolve(repoRoot, 'dist', name);
  if (!existsSync(src)) {
    console.error(`\n[copy-bundles] MISSING: dist/${name}\n` +
      `Run \`pnpm build\` at the repo root first — the desktop app vendors the built bundles.\n`);
    process.exit(1);
  }
  copyFileSync(src, resolve(outDir, name));
  console.log(`[copy-bundles] vendored ${name}`);
}
```

- [ ] **Step 3: Write `apps/desktop/package.json`**

```json
{
  "name": "agent-pet-desktop",
  "private": true,
  "type": "module",
  "scripts": {
    "vendor": "node scripts/copy-bundles.mjs",
    "build:web": "pnpm vendor && vite build --config vite.desktop.config.ts",
    "dev": "pnpm vendor && cargo tauri dev",
    "build": "pnpm build:web && cargo tauri build"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@tauri-apps/api": "^2",
    "vite": "^8.0.11"
  }
}
```

- [ ] **Step 4: Write the transparent host page**

`apps/desktop/web/index.html` — transparent body, a full-window mount container, the vendored widget IIFE, then the bridge as a module. (Bridge + launch-config filled in later tasks; stub them now so the page loads.)
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
    #pet-root { position: fixed; inset: 0; }
  </style>
</head>
<body>
  <div id="pet-root"></div>
  <script src="./vendor/agent-pet-widget.iife.js"></script>
  <script type="module" src="./launch-config.js"></script>
  <script type="module" src="./bridge.js"></script>
</body>
</html>
```
Stub `web/launch-config.js`: `export const launchConfig = { name: 'Buddy', glyph: '🐾' };`
Stub `web/bridge.js`: `console.log('bridge loaded');`

- [ ] **Step 5: Write `vite.desktop.config.ts`** so `web/` builds into a dir Tauri serves.
```ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  root: resolve(__dirname, 'web'),
  build: { outDir: resolve(__dirname, 'web-dist'), emptyOutDir: true },
});
```

- [ ] **Step 6: Write `Cargo.toml`, `build.rs`, minimal `main.rs`, and `tauri.conf.json`**

`Cargo.toml` — **declare the package** so `cargo test` and `-p` work:
```toml
[package]
name = "agent-pet-desktop"
version = "0.1.0"
edition = "2021"

[lib]
name = "agent_pet_desktop"
path = "src/lib.rs"   # so unit tests in modules are reachable; main.rs is a thin bin

[build-dependencies]
tauri-build = { version = "2" }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-store = "2"
tauri-plugin-single-instance = "2"
axum = "0.7"
tower-http = { version = "0.5", features = ["limit"] }
http = "1"                 # must match axum 0.7's re-exported http major (1.x)
tokio = { version = "1", features = ["rt-multi-thread", "macros", "net"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
constant_time_eq = "0.3"
rand = "0.8"
url = "2"
dirs = "5"

[target.'cfg(windows)'.dependencies]
whoami = "1"               # resolve the literal username for the icacls fallback

[dev-dependencies]
tempfile = "3"
```
Tests run from `apps/desktop/src-tauri/` with plain `cargo test` (no `-p` needed); where the plan writes `cargo test -p agent-pet <module>` below, read it as `cargo test <module>`. `build.rs`: `fn main() { tauri_build::build(); }`. Split `main.rs` into a thin binary that calls `agent_pet_desktop::run()`, with all modules under `src/lib.rs` (`pub mod ...`) so `#[cfg(test)]` modules compile.

`src/lib.rs` (minimal — just open the page; window/server/modules added in later tasks) and a thin `src/main.rs`. Both must exist from Task 0 because `Cargo.toml` declares `[lib] path = "src/lib.rs"`:
```rust
// src/lib.rs
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
```rust
// src/main.rs
#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]
fn main() { agent_pet_desktop::run() }
```

`tauri.conf.json` (key fields — window hardening + CSP land in Tasks 1 & 9; start permissive-enough to load):
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "agent-pet",
  "identifier": "net.agent-pet.desktop",
  "build": {
    "frontendDist": "../web-dist",
    "beforeBuildCommand": "pnpm build:web",
    "beforeDevCommand": "pnpm build:web"
  },
  "app": {
    "windows": [{ "title": "agent-pet", "width": 240, "height": 240 }],
    "security": { "csp": null }
  },
  "bundle": { "active": true, "targets": ["nsis"], "icon": ["icons/icon.ico"] }
}
```
(Generate placeholder icons with `cargo tauri icon` against any 512×512 PNG, e.g. the repo's `ryu.png`.)

- [ ] **Step 7: Verify the app launches and shows the stub page**

Run (from `apps/desktop/`): `pnpm build:web && cargo tauri dev`
Expected: a 240×240 window opens; devtools console shows `bridge loaded`. The `vendor` step fails loudly if `dist/*.iife.js` is missing (run repo-root `pnpm build` first). Close the window.

- [ ] **Step 8: Commit**
```bash
git add apps/desktop pnpm-workspace.yaml
git commit -m "feat(desktop): scaffold Tauri app + vendored-bundle build wiring"
```

---

## Task 1: Transparent dynamic-bounding-box window + bounds math (DE-RISK FIRST)

This is the only component without prior art in the repo (spec §4) — build and verify it before anything else. The window math is pure and unit-testable in JS; the native resize is wired after.

**Files:**
- Create: `apps/desktop/src-tauri/src/window.rs`, `apps/desktop/src-tauri/src/commands.rs`
- Create: `apps/desktop/web/bounds.js` (pure bounds helpers), `apps/desktop/web/bounds.test.ts`
- Modify: `apps/desktop/src-tauri/src/main.rs`, `apps/desktop/web/bridge.js`

- [ ] **Step 1: Write the failing test for the bounds helper** (pure function, no DOM)

`apps/desktop/web/bounds.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { unionRect, changedBeyond, withMargin } from './bounds.js';

describe('unionRect', () => {
  it('returns the pet rect when no bubble', () => {
    expect(unionRect({ x: 10, y: 10, w: 50, h: 50 }, null))
      .toEqual({ x: 10, y: 10, w: 50, h: 50 });
  });
  it('unions pet + bubble into the bounding box', () => {
    const pet = { x: 100, y: 100, w: 40, h: 40 };
    const bubble = { x: 60, y: 60, w: 120, h: 30 };
    expect(unionRect(pet, bubble)).toEqual({ x: 60, y: 60, w: 120, h: 80 });
  });
});

describe('changedBeyond', () => {
  it('false when within threshold on every edge', () => {
    expect(changedBeyond({ x: 0, y: 0, w: 50, h: 50 }, { x: 1, y: 1, w: 51, h: 49 }, 2)).toBe(false);
  });
  it('true when any edge moves past threshold', () => {
    expect(changedBeyond({ x: 0, y: 0, w: 50, h: 50 }, { x: 0, y: 0, w: 55, h: 50 }, 2)).toBe(true);
  });
  it('true when previous is null', () => {
    expect(changedBeyond(null, { x: 0, y: 0, w: 1, h: 1 }, 2)).toBe(true);
  });
});

describe('withMargin', () => {
  it('expands the rect by the margin on all sides', () => {
    expect(withMargin({ x: 10, y: 10, w: 30, h: 30 }, 8))
      .toEqual({ x: 2, y: 2, w: 46, h: 46 });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run (repo root): `pnpm vitest run apps/desktop/web/bounds.test.ts`
Expected: FAIL — cannot resolve `./bounds.js`.

- [ ] **Step 3: Implement `apps/desktop/web/bounds.js`**
```js
/** @typedef {{x:number,y:number,w:number,h:number}} Rect */

/** Union of the pet rect with an optional bubble rect. @returns {Rect} */
export function unionRect(pet, bubble) {
  if (!bubble) return { ...pet };
  const x = Math.min(pet.x, bubble.x);
  const y = Math.min(pet.y, bubble.y);
  const right = Math.max(pet.x + pet.w, bubble.x + bubble.w);
  const bottom = Math.max(pet.y + pet.h, bubble.y + bubble.h);
  return { x, y, w: right - x, h: bottom - y };
}

/** True if any edge of `next` differs from `prev` by more than `threshold` px. */
export function changedBeyond(prev, next, threshold) {
  if (!prev) return true;
  return Math.abs(prev.x - next.x) > threshold ||
         Math.abs(prev.y - next.y) > threshold ||
         Math.abs(prev.w - next.w) > threshold ||
         Math.abs(prev.h - next.h) > threshold;
}

/** Expand a rect by `m` px on every side. @returns {Rect} */
export function withMargin(r, m) {
  return { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm vitest run apps/desktop/web/bounds.test.ts`
Expected: PASS (8 assertions).

- [ ] **Step 5: Implement the `report_bounds` command (Rust) — resize-and-pin to a STORED anchor (no live-origin feedback loop)**

The drift trap (called out in review): if `report_bounds` reads the window's *current* origin and adds the pet's local offset each call, then because the window is repositioned every call, the origin it reads is last call's moved value → the window walks across the screen, and shrinking the window also moves the pet within the viewport, which re-fires the observer. Break the loop two ways: (a) **pin the pet to the window's bottom-left in CSS** (Step 6) so the content origin is independent of window size; (b) compute position from a **stored screen anchor that changes only on user drag**, never from the live origin.

The bridge reports only the union's **width and height** (the pet is pinned bottom-left, so the union's local origin is always ~0,0 and the box grows up/right for bubbles). Rust keeps the pet's bottom-left screen point fixed:

`commands.rs`:
```rust
use tauri::{command, Manager, PhysicalPosition, PhysicalSize};
use crate::state::AppState;

const MAX_DIM: u32 = 4096;

#[command]
pub fn report_bounds(app: tauri::AppHandle, state: tauri::State<AppState>, w: f64, h: f64) {
    if !w.is_finite() || !h.is_finite() { return; }
    let Some(win) = app.get_webview_window("main") else { return; };
    let nw = (w.max(1.0) as u32).min(MAX_DIM);
    let nh = (h.max(1.0) as u32).min(MAX_DIM);
    // anchor = the screen point where the pet's bottom-left must stay (stored;
    // updated only on drag-end / launch — never read from the live window).
    let (ax, ay_bottom) = state.anchor();
    let _ = win.set_size(PhysicalSize::new(nw, nh));
    // top-left = anchor_x , anchor_bottom - height  → window grows upward, pet stays put.
    let _ = win.set_position(PhysicalPosition::new(ax, ay_bottom - nh as i32));
}
```
`AppState` gains `anchor() -> (i32,i32)` and `set_anchor(x, y_bottom)` over a `Mutex<(i32,i32)>` (added with the rest of `AppState` in Task 4; for this task, stub a module-level `OnceLock<Mutex<(i32,i32)>>` initialised to the launch position so Task 1 stands alone, then fold it into `AppState` in Task 4). The anchor is set at launch (default bottom-right of the work area) and updated on drag-end in Task 8.

- [ ] **Step 6: Implement `window.rs` to apply the transparent bounding-box flags at startup**
```rust
use tauri::{WebviewWindow};

pub fn harden(win: &WebviewWindow) {
    let _ = win.set_decorations(false);
    let _ = win.set_always_on_top(true);
    let _ = win.set_skip_taskbar(true);
    let _ = win.set_resizable(false);
}
```
In `tauri.conf.json` set the window `"transparent": true`, `"decorations": false`, `"alwaysOnTop": true`, `"skipTaskbar": true`, `"shadow": false`. The builder lives in `lib.rs::run()` (Task 0 split; `src/main.rs` is just `fn main() { agent_pet_desktop::run() }`). Call `harden` in `.setup(...)` and register the command:
```rust
// src/lib.rs
pub mod commands;
pub mod window;
// ...other pub mod declarations added in later tasks...

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::report_bounds])
        .setup(|app| {
            let win = app.get_webview_window("main").unwrap();
            window::harden(&win);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 7: Wire the bridge to report bounds on layout transitions**

In `web/bridge.js`, after the widget mounts, observe the pet element and report on transitions only (spec §4 — `ResizeObserver` + bubble show/hook, **not** per-frame), debounced via `changedBeyond`. The bridge sends only **width/height** (Rust pins the bottom-left via the stored anchor, Step 5):
```js
import { unionRect, changedBeyond, withMargin } from './bounds.js';
import { invoke } from '@tauri-apps/api/core';

const MARGIN = 8, THRESHOLD = 2;
let last = null;

export function reportNow(petRect, bubbleRect) {
  if (!petRect) return;
  const u = withMargin(unionRect(petRect, bubbleRect), MARGIN);
  if (!changedBeyond(last, u, THRESHOLD)) return;
  last = u;
  invoke('report_bounds', { w: u.w, h: u.h }); // size only; position is anchor-pinned in Rust
}
// A ResizeObserver on the pet host + the bubble-visibility hook (Task 5) call reportNow().
```
**Pin the pet bottom-left:** the host page anchors the mount container to the window's bottom-left and the desktop launch disables the widget's own drag/position persistence (OS drag replaces it, Task 8), so the pet's on-screen position is independent of window size — the whole reason Step 5 can resize without moving the pet. Exact CSS/measurement is tuned during the Step 8 verify; if the widget's bubble renders in a direction that clips, adjust the anchor corner there.

- [ ] **Step 8: Manual verify the resize loop on Linux/WSL**

Run (from `apps/desktop/`): `cargo tauri dev`
Expected: window opens transparent with the pet; resizing/animating the pet does **not** cause continuous resize churn (only transitions trigger it). Note CPU stays low. This de-risks the core mechanism.

- [ ] **Step 9: Commit**
```bash
git add apps/desktop
git commit -m "feat(desktop): transparent bounding-box window + bounds-report loop"
```

---

## Task 2: Launch config + bridge mounts the widget and reports its action registry

**Files:**
- Modify: `apps/desktop/web/launch-config.js`, `apps/desktop/web/bridge.js`
- Create: `apps/desktop/web/registry.js`, `apps/desktop/web/registry.test.ts`
- Modify: `apps/desktop/src-tauri/src/commands.rs` (add `report_registry`)

- [ ] **Step 1: Write the failing test for registry extraction**

`registry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { actionRegistry, BUILTIN_STATES } from './registry.js';

describe('actionRegistry', () => {
  it('is the 9 states with no manifest', () => {
    expect(actionRegistry(null).sort()).toEqual([...BUILTIN_STATES].sort());
  });
  it('adds manifest actions + richActions keys, deduped', () => {
    const cfg = { actions: { hadouken: {}, wave: {} }, richActions: { wave: {}, spin: {} } };
    const reg = actionRegistry(cfg);
    expect(reg).toContain('hadouken');
    expect(reg).toContain('spin');
    expect(reg.filter(a => a === 'wave')).toHaveLength(1); // deduped
    expect(reg).toContain('idle'); // built-ins still present
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`pnpm vitest run apps/desktop/web/registry.test.ts`).

- [ ] **Step 3: Implement `registry.js`**
```js
export const BUILTIN_STATES = ['idle','thinking','building','delegating','success','error','greeting','waiting','leaving'];

/** Valid /play action names = 9 states + manifest action keys (deduped). */
export function actionRegistry(cfg) {
  const set = new Set(BUILTIN_STATES);
  for (const k of Object.keys(cfg?.actions ?? {})) set.add(k);
  for (const k of Object.keys(cfg?.richActions ?? {})) set.add(k);
  return [...set];
}
```

- [ ] **Step 4: Run the test — expect PASS.**

- [ ] **Step 5: Fill in `launch-config.js`** with a default pet, pinning `richRuntimeUrl` to the **local** vendored rich bundle (spec §7.8a):
```js
export const launchConfig = {
  name: 'Buddy',
  // Default to an emoji glyph; a real spritesheet/manifest can replace this.
  glyph: '🐾',
  accent: '#7eb8da',
  richRuntimeUrl: new URL('./vendor/agent-pet-rich.iife.js', import.meta.url).href,
};
```

- [ ] **Step 6: Implement the `report_registry` command** in `commands.rs` with the syntactic floor (spec §7.7c):
```rust
use crate::state::AppState;

#[command]
pub fn report_registry(state: tauri::State<AppState>, actions: Vec<String>) {
    let re_ok = |s: &str| s.len() <= 48 && !s.is_empty()
        && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    let clean: std::collections::HashSet<String> =
        actions.into_iter().filter(|a| re_ok(a)).collect();
    state.set_registry(clean);
}
```
(`AppState`/`set_registry` are introduced in Task 4; if doing strict TDD order, stub the command body to `let _ = (state, actions);` here and connect in Task 6. Register the command in the `generate_handler!` list.)

- [ ] **Step 7: Wire the bridge to mount the widget and report the registry**

In `bridge.js`. **Important (verified against `src/widget/mount.ts`): a bare `mount()` with a glyph config does not register rich actions, and `mount()`'s config gate ignores `richActions`/`runtime`.** So the registry must be reported *after config is fully applied*, and rich/manifest pets must come through `loadManifest` (which triggers the rich-runtime lazy import and applies `actions`/`atlas`/`imageUrl`). The default pet is a glyph pet → its registry is just the 9 states; a manifest pet awaits `loadManifest` before the pet can actually `play()` its actions:
```js
import { launchConfig } from './launch-config.js';
import { actionRegistry } from './registry.js';
import { invoke } from '@tauri-apps/api/core';

// window.AgentPet is provided by the vendored IIFE.
AgentPet.mount({ target: document.getElementById('pet-root'), ...launchConfig });

async function applyConfigAndReport() {
  // If the launch config carries a manifest (custom/rich actions), load it so
  // the actions are actually playable — bare mount() would 200 then no-op.
  if (launchConfig.manifest) {
    await AgentPet.loadManifest(launchConfig.manifest); // rich runtime lazy-imports here
  }
  invoke('report_registry', { actions: actionRegistry(launchConfig.manifest ?? launchConfig) });
}
applyConfigAndReport();
```
For the MVP default (glyph pet, no manifest) only the 9 states are reported — correct, since it has no custom actions.

- [ ] **Step 8: Manual verify** the pet renders and (later, once the server exists) `/actions` reflects this set. For now, `cargo tauri dev` shows the pet mounted. 

- [ ] **Step 9: Commit**
```bash
git add apps/desktop
git commit -m "feat(desktop): mount widget from launch config + report action registry"
```

---

## Task 3: HTTP server skeleton — bind 127.0.0.1, /health, single instance, port file

**Files:**
- Create: `apps/desktop/src-tauri/src/server/mod.rs`, `apps/desktop/src-tauri/src/portfile.rs`, `apps/desktop/src-tauri/src/pet.rs`
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Write the failing test for the port file (atomic, owner-only)**

`portfile.rs` test module:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn writes_and_reads_back_port_and_token() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("port");
        write_port_file(&path, 51247, "tok_abc").unwrap();
        let (port, token) = read_port_file(&path).unwrap();
        assert_eq!(port, 51247);
        assert_eq!(token, "tok_abc");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600, "must be owner-only");
        }
    }
}
```
(Add `tempfile = "3"` to `[dev-dependencies]`.)

- [ ] **Step 2: Run — expect FAIL** (`cargo test -p agent-pet portfile`).

- [ ] **Step 3: Implement `portfile.rs`** — write to a temp file then atomic-rename; set perms at creation (Unix `0600` via `OpenOptions.mode`; Windows owner-only ACL, spec §7.9). Format: two lines `PORT\nTOKEN`.
```rust
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

pub fn port_file_path() -> PathBuf {
    let mut p = dirs::home_dir().expect("home dir");
    p.push(".agent-pet");
    std::fs::create_dir_all(&p).ok();
    p.push("port");
    p
}

pub fn write_port_file(path: &Path, port: u16, token: &str) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    let mut opts = OpenOptions::new();
    opts.write(true).create(true).truncate(true);
    #[cfg(unix)]
    { use std::os::unix::fs::OpenOptionsExt; opts.mode(0o600); }
    let mut f = opts.open(&tmp)?;
    write!(f, "{port}\n{token}")?;
    f.sync_all()?;
    drop(f);
    #[cfg(windows)]
    restrict_acl_owner_only(&tmp)?; // see note
    std::fs::rename(&tmp, path)?;
    Ok(())
}

pub fn read_port_file(path: &Path) -> std::io::Result<(u16, String)> {
    let s = std::fs::read_to_string(path)?;
    let mut lines = s.lines();
    let port = lines.next().unwrap_or("").trim().parse()
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "bad port"))?;
    let token = lines.next().unwrap_or("").trim().to_string();
    Ok((port, token))
}
```
**Windows ACL note:** implement `restrict_acl_owner_only` using the `windows` crate (`SetNamedSecurityInfo` granting only the current user SID) or shell out to `icacls`. If shelling out, resolve the username with the `whoami` crate (`whoami::username()`) and pass the **literal** name — `%USERNAME%` does **not** expand under Rust's `Command` (it isn't run through cmd): `Command::new("icacls").args([path, "/inheritance:r", "/grant:r", &format!("{user}:F")])`. This is the real permission control on the shipping platform — `0600` is a no-op there (spec §7.9). Cover with a `#[cfg(windows)]` manual check in CI smoke (Task 11), since unit-testing ACLs is environment-bound.

- [ ] **Step 4: Run — expect PASS** (`cargo test -p agent-pet portfile`).

- [ ] **Step 5: Write `pet.rs`** — the 9 states as the single source of truth:
```rust
pub const STATES: [&str; 9] = ["idle","thinking","building","delegating","success","error","greeting","waiting","leaving"];
pub fn is_state(s: &str) -> bool { STATES.contains(&s) }
pub fn action_name_ok(s: &str) -> bool {
    !s.is_empty() && s.len() <= 48 && s.chars().all(|c| c.is_ascii_alphanumeric() || c=='_' || c=='-')
}
```

- [ ] **Step 6a: Wire single-instance via the official plugin** (spec §5 — "a second launch raises the existing window and exits 0"). In the Tauri builder, register `tauri_plugin_single_instance::init(|app, _argv, _cwd| { if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); } })` **first**, before other plugins. The plugin guarantees only one process owns the app; the callback fires in the running instance to raise its window. No hand-rolled lock port.

- [ ] **Step 6b: Implement `server/mod.rs`** — bind `127.0.0.1:0` (OS picks a free port → no in-use race), get the bound port, write the port file, serve `/health`. Keep `/health` unauthenticated and **versionless** (spec §5):
```rust
use axum::{routing::get, Router, Json};
use std::net::SocketAddr;

pub async fn serve(app: tauri::AppHandle, state: crate::state::AppState) {
    let router = Router::new()
        .route("/health", get(|| async { Json(serde_json::json!({ "ok": true })) }))
        .with_state(state.clone());
    let listener = tokio::net::TcpListener::bind(SocketAddr::from(([127,0,0,1], 0))).await.unwrap();
    let port = listener.local_addr().unwrap().port();
    crate::portfile::write_port_file(&crate::portfile::port_file_path(), port, &state.token).unwrap();
    axum::serve(listener, router).await.unwrap();
}
```

- [ ] **Step 7: Spawn the server from `main.rs` setup** on Tauri's async runtime; remove the port file on exit (`on_window_event` Destroyed / `RunEvent::Exit`). Manual: `cargo tauri dev`, then `curl 127.0.0.1:$(head -1 ~/.agent-pet/port)/health` → `{"ok":true}`.

- [ ] **Step 8: Commit**
```bash
git add apps/desktop
git commit -m "feat(desktop): localhost server skeleton + atomic port file + /health"
```

---

## Task 4: Security middleware — token, header/provenance, body limit, rate limit

**Files:**
- Create: `apps/desktop/src-tauri/src/server/auth.rs`, `apps/desktop/src-tauri/src/server/state.rs`
- Modify: `apps/desktop/src-tauri/src/server/mod.rs`

- [ ] **Step 1: Write failing tests for the auth predicate** (pure decision function, easy to unit-test)

`auth.rs` test module — encode spec §7.1 exactly: reject when the custom header is missing/wrong; reject when `Origin` present and not our own; reject when `Sec-Fetch-Site` is `cross-site`/`same-site`; constant-time token mismatch rejected.
```rust
#[cfg(test)]
mod tests {
    use super::*;
    fn h(pairs: &[(&str,&str)]) -> http::HeaderMap {
        let mut m = http::HeaderMap::new();
        for (k,v) in pairs { m.insert(*k, v.parse().unwrap()); }
        m
    }
    const TOK: &str = "secrettoken";
    #[test] fn accepts_valid_curl_like_request() {
        assert!(authorize(&h(&[("x-agent-pet","1"),("authorization","Bearer secrettoken")]), TOK).is_ok());
    }
    #[test] fn rejects_missing_custom_header() {
        assert!(authorize(&h(&[("authorization","Bearer secrettoken")]), TOK).is_err());
    }
    #[test] fn rejects_bad_token() {
        assert!(authorize(&h(&[("x-agent-pet","1"),("authorization","Bearer nope")]), TOK).is_err());
    }
    #[test] fn rejects_cross_site_fetch() {
        assert!(authorize(&h(&[("x-agent-pet","1"),("authorization","Bearer secrettoken"),("sec-fetch-site","cross-site")]), TOK).is_err());
    }
    #[test] fn rejects_foreign_origin() {
        assert!(authorize(&h(&[("x-agent-pet","1"),("authorization","Bearer secrettoken"),("origin","https://evil.test")]), TOK).is_err());
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (`cargo test -p agent-pet auth`).

- [ ] **Step 3: Implement `state.rs`** — `AppState { token: String, registry: Arc<RwLock<HashSet<String>>>, app: AppHandle, limiter: ... }`, with `set_registry`, `registry_contains`. Generate the token with `OsRng` (≥128 bits, hex/base64).
```rust
use std::collections::HashSet;
use std::sync::{Arc, RwLock};

#[derive(Clone)]
pub struct AppState {
    pub token: String,
    pub registry: Arc<RwLock<HashSet<String>>>,
    pub app: tauri::AppHandle,
}
impl AppState {
    pub fn new(app: tauri::AppHandle) -> Self {
        use rand::RngCore;
        let mut b = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut b);
        let token = b.iter().map(|x| format!("{x:02x}")).collect();
        Self { token, registry: Arc::new(RwLock::new(crate::pet::STATES.iter().map(|s| s.to_string()).collect())), app }
    }
    pub fn set_registry(&self, set: HashSet<String>) {
        let mut g = self.registry.write().unwrap();
        *g = crate::pet::STATES.iter().map(|s| s.to_string()).chain(set).collect();
    }
    pub fn registry_contains(&self, a: &str) -> bool { self.registry.read().unwrap().contains(a) }
}
```

- [ ] **Step 4: Implement `authorize` in `auth.rs`** — constant-time compare (`constant_time_eq`), header + provenance checks per spec §7.1:
**Verify the webview origin per platform first (do not guess):** the Tauri v2 webview origin differs by OS — `https://tauri.localhost` on **Windows** (the shipping target), `tauri://localhost` on Linux/macOS. In `cargo tauri dev` on each target, log `headers.get("origin")` on an IPC-triggered request and use the observed value. Key the CSP `connect-src` (Task 9) off the same constant. Define it `#[cfg(windows)]`/`#[cfg(not(windows))]`:
```rust
use constant_time_eq::constant_time_eq;
use http::HeaderMap;

#[cfg(windows)]
pub const OWN_ORIGIN: &str = "https://tauri.localhost";
#[cfg(not(windows))]
pub const OWN_ORIGIN: &str = "tauri://localhost";

pub fn authorize(h: &HeaderMap, token: &str) -> Result<(), ()> {
    if h.get("x-agent-pet").and_then(|v| v.to_str().ok()) != Some("1") { return Err(()); }
    if let Some(o) = h.get("origin").and_then(|v| v.to_str().ok()) {
        if o != OWN_ORIGIN { return Err(()); }
    }
    if let Some(s) = h.get("sec-fetch-site").and_then(|v| v.to_str().ok()) {
        if s != "none" && s != "same-origin" { return Err(()); }
    }
    let bearer = h.get("authorization").and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "));
    match bearer {
        Some(t) if constant_time_eq(t.as_bytes(), token.as_bytes()) => Ok(()),
        _ => Err(()),
    }
}
```

- [ ] **Step 5: Run — expect PASS** (`cargo test -p agent-pet auth`).

- [ ] **Step 6: Add the middleware layers** in `mod.rs`: a `tower_http::limit::RequestBodyLimitLayer` (small cap, e.g. 8 KB) ahead of extraction, a simple in-memory token-bucket rate limit on the mutating routes (tens of req/s; a `governor`-backed layer or a hand-rolled `Arc<Mutex<...>>` bucket), and an `axum::middleware::from_fn` that calls `authorize` for `/state` `/play` `/say` `/actions` (not `/health`). Reject → `403`.

- [ ] **Step 7: Commit**
```bash
git add apps/desktop
git commit -m "feat(desktop): auth/provenance middleware, token, body + rate limits"
```

---

## Task 5: `/state` endpoint → `pet:state` event → bridge `setState`

**Files:**
- Create: `apps/desktop/src-tauri/src/server/handlers.rs`
- Modify: `apps/desktop/src-tauri/src/server/mod.rs`, `apps/desktop/web/bridge.js`, `apps/desktop/web/bridge.test.ts`

- [ ] **Step 1: Write the failing Rust test for `/state` validation + event payload**

In `handlers.rs` test module, assert: known state → `200` and an emitted `pet:state` payload `{state}`; unknown state → `400`. Use a thin `validate_state(&str) -> Result<&str,StatusCode>` pure helper so the decision is unit-testable without a running Tauri app:
```rust
#[test] fn accepts_known_state() { assert!(validate_state("thinking").is_ok()); }
#[test] fn rejects_unknown_state() { assert!(validate_state("dancing").is_err()); }
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `validate_state` + the `/state` handler** (emits via `state.app.emit("pet:state", json!({"state": s}))`), and add the route in `mod.rs`.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Write the failing bridge test** (`bridge.test.ts`, jsdom) — feed a `pet:state` payload to the bridge's handler and assert it validates and calls `AgentPet.setState` only for valid states. Factor the bridge's event handling into a pure `handleStateEvent(payload, api)` so it's testable without Tauri:
```ts
import { handleStateEvent } from './bridge-handlers.js';
it('forwards a valid state', () => {
  const api = { setState: vi.fn() };
  handleStateEvent({ state: 'thinking' }, api);
  expect(api.setState).toHaveBeenCalledWith('thinking');
});
it('drops an unknown state', () => {
  const api = { setState: vi.fn() };
  handleStateEvent({ state: '<script>' }, api);
  expect(api.setState).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run — expect FAIL**, then implement `bridge-handlers.js` (`handleStateEvent` validates against `BUILTIN_STATES`), wire it in `bridge.js` via `listen('pet:state', e => handleStateEvent(e.payload, AgentPet))`. Also hook bubble-visibility → `reportNow` here. Run — expect PASS.

- [ ] **Step 7: Manual verify** end-to-end: `cargo tauri dev`, then
`curl -X POST 127.0.0.1:$PORT/state -H 'x-agent-pet:1' -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"state":"thinking"}'`
→ pet switches to the thinking animation. A request without the header → `403`.

- [ ] **Step 8: Commit**
```bash
git add apps/desktop
git commit -m "feat(desktop): POST /state drives setState end-to-end"
```

---

## Task 6: `/play` + `/actions` (custom actions) → `pet:play` event → bridge `play`

**Files:**
- Modify: `handlers.rs`, `mod.rs`, `bridge-handlers.js`, `bridge.js`, `bridge.test.ts`, `commands.rs` (connect `report_registry` to `AppState`)

- [ ] **Step 1: Write failing Rust tests** — `/play` action in registry → `200` + `pet:play` payload `{action, loops, durationMs}`; action not in registry → `400`; `loops`/`durationMs` clamped to bounds (e.g. `loops ∈ [1,100]`, `durationMs ∈ [0, 60000]`). Pre-config registry = the 9 states only. Pure helpers: `validate_action(&AppState,&str)`, `clamp_play_opts(loops, durationMs)`.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `validate_action` (uses `state.registry_contains`), `clamp_play_opts`, the `/play` handler (emit `pet:play`), the `/actions` handler (return the live registry as JSON, **authed**), and connect `report_registry` (Task 2 stub) to `state.set_registry`. Add routes.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Write failing bridge test** for `handlePlayEvent(payload, api)` — forwards valid action to `AgentPet.play(action,{loops,durationMs})`, drops unknown/oversized. Run — FAIL.

- [ ] **Step 6: Implement `handlePlayEvent`** (validate `action` against the JS-side registry from `actionRegistry(launchConfig)`; bound opts), wire `listen('pet:play', ...)`. Run — expect PASS.

- [ ] **Step 7: Manual verify** — configure a manifest pet with an action (or test with a built-in via `/play`), `curl .../play -d '{"action":"success"}'` → one-shot plays then returns to prior state. `curl .../actions` lists the set.

- [ ] **Step 8: Commit**
```bash
git add apps/desktop
git commit -m "feat(desktop): POST /play + GET /actions for custom manifest actions"
```

---

## Task 7: `/say` endpoint → `pet:say` event → bridge `say` (with link re-validation)

**Files:** Modify `handlers.rs`, `mod.rs`, `bridge-handlers.js`, `bridge.js`, `bridge.test.ts`

- [ ] **Step 1: Write failing Rust tests** for `safe_link(&str) -> Option<String>` mirroring the widget's allowlist (spec §6): http/https/mailto **absolute** only; reject relative, `javascript:`, `data:`, `vbscript:`, malformed. Plus `cap_text(&str)` truncates to the cap.
```rust
#[test] fn allows_https() { assert!(safe_link("https://x.test/a").is_some()); }
#[test] fn rejects_relative() { assert!(safe_link("/results").is_none()); }
#[test] fn rejects_javascript() { assert!(safe_link("javascript:alert(1)").is_none()); }
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `safe_link` (parse with the `url` crate; require a scheme; allowlist `http`/`https`/`mailto`), `cap_text`, and the `/say` handler — drop a rejected link but keep the text; emit `pet:say` `{text, ttl, link}`. Bound `ttl`. Add route. Add `url = "2"` to deps.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Write + implement the bridge `handleSayEvent`** — accept only `{text, ttl?, link?}`, ignore extra fields, never build DOM (calls `AgentPet.say`, which keeps `textContent`+`safeBubbleLink`). Test that extra fields are dropped and only `text`/`ttl`/`link` pass through. Run tests — expect PASS.

- [ ] **Step 6: Manual verify** — `curl .../say -d '{"text":"build done","link":"https://example.com"}'` → bubble appears; the window grows to include the bubble then shrinks on dismiss (validates the bounds union path). `link:"javascript:..."` → bubble shows, no link action.

- [ ] **Step 7: Commit**
```bash
git add apps/desktop
git commit -m "feat(desktop): POST /say with server-side link re-validation"
```

---

## Task 8: Tray (show/hide/quit), drag, position persistence

**Files:** Create `apps/desktop/src-tauri/src/tray.rs`; modify `main.rs`, `commands.rs`, `bridge.js`

- [ ] **Step 1: Implement the tray** (`tray.rs`) with menu items Show/Hide and Quit (spec §3) — Quit removes the port file and exits; Show/Hide toggle window visibility. Register in setup. Use the Tauri v2 import paths (highest native-drift risk — verify against `cargo tauri` for the installed minor):
```rust
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
// in setup:
//   let show = MenuItem::with_id(app, "show", "Show/Hide", true, None::<&str>)?;
//   let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
//   let menu = Menu::with_items(app, &[&show, &quit])?;
//   TrayIconBuilder::new().menu(&menu).on_menu_event(|app, e| match e.id().as_ref() {
//       "quit" => { /* remove port file */ app.exit(0); }
//       "show" => { /* toggle main window visibility */ }
//       _ => {}
//   }).build(app)?;
```
(`tray-icon` feature is already enabled in Task 0; the `menu` module is available by default in v2.)

- [ ] **Step 2: Implement `start_drag` and `quit` commands** in `commands.rs` (`win.start_dragging()`, `app.exit(0)`); register them. In `bridge.js`, attach `start_drag` to pointer-down on the pet host so dragging moves the OS window (spec §4).

- [ ] **Step 3: Implement position persistence** with `tauri-plugin-store` — write window position on drag-end (`on_window_event` Moved, debounced) and on quit; restore on setup before showing (spec §4). Store file alongside `~/.agent-pet/`.

- [ ] **Step 4: Manual verify** — drag the pet; quit via tray; relaunch → pet reappears at the last position; port file is gone after a clean quit.

- [ ] **Step 5: Commit**
```bash
git add apps/desktop
git commit -m "feat(desktop): tray (show/hide/quit), drag-to-move, position persistence"
```

---

## Task 9: Security hardening pass — CSP, capabilities, image-url validation

**Files:** Modify `tauri.conf.json`, `apps/desktop/src-tauri/capabilities/default.json`, add image-url validation where launch config is consumed

- [ ] **Step 1: Set the full concrete CSP** in `tauri.conf.json` → `app.security.csp` exactly as spec §7.5:
`default-src 'none'; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost; img-src 'self' https://codex-pets.net https://j20.nz; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
(Adjust the `connect-src` IPC origin to whatever the Tauri v2 webview actually uses; verify `report_bounds`/`report_registry` still invoke after setting it.)

- [ ] **Step 2: Write `capabilities/default.json`** granting only `core:event:default`, `core:window:allow-*` needed for drag/visibility, and the four custom commands — nothing for `shell`/`fs`/`http` (spec §7.6).

- [ ] **Step 3: Add image-url validation in Rust** (spec §7.8 — "launch-config only, validated in Rust at load"; keep the check on the trusted side). At config load, validate any `imageUrl` scheme: allow `https:` or the bundled `./vendor/...` relative path only; reject `file:`/`data:`/`http:`. Add a unit test for the scheme predicate (`image_url_ok`).

- [ ] **Step 4: Manual verify** — with CSP on, the pet still mounts, IPC commands work, a manifest pet's rich runtime loads from the **local** vendor path (no network script), and an off-allowlist `imageUrl` is rejected. Confirm devtools shows no CSP violations in normal use.

- [ ] **Step 5: Commit**
```bash
git add apps/desktop
git commit -m "chore(desktop): lock CSP, minimal capabilities, validate image-url scheme"
```

---

## Task 10: Windows installer CI

**Files:** Create `.github/workflows/desktop-windows.yml`

- [ ] **Step 1: Write the workflow** — `runs-on: windows-latest`; checkout; setup pnpm + node + Rust (`dtolnay/rust-toolchain@stable`); `pnpm install --frozen-lockfile`; `pnpm build` at repo root (produces `dist/*.iife.js`); then in `apps/desktop`: `pnpm install` and `pnpm build` (which runs `vendor` → fails fast if bundles missing → `cargo tauri build`); upload `apps/desktop/src-tauri/target/release/bundle/nsis/*.exe` via `actions/upload-artifact@v4`. Trigger on `workflow_dispatch` + PRs touching `apps/desktop/**`.

- [ ] **Step 2: Verify** — push the branch, open the PR, confirm the workflow produces an `.exe` artifact. (This is the first real Windows build; expect to fix Tauri/Windows config issues here, e.g. icon format must be a real `.ico`.)

- [ ] **Step 3: Commit**
```bash
git add .github/workflows/desktop-windows.yml
git commit -m "ci(desktop): windows-latest NSIS installer build"
```

---

## Task 11: README + manual smoke checklist + final review

**Files:** Create `apps/desktop/README.md`

- [ ] **Step 1: Write the README** — what it is, how to run dev on Linux/WSL (and the system deps), how to drive it (`curl` examples for `/state`, `/play`, `/say`, `/actions`, reading port+token from `~/.agent-pet/port`), the security model summary (token + provenance, scope caveat from spec §7.4), and how the Windows installer is produced.

- [ ] **Step 2: Run the full smoke checklist** and record results in the PR:
  - Drive-by rejection: a POST without `x-agent-pet` header → `403`.
  - Token rejection: wrong Bearer → `403`.
  - State / play / say all animate the pet; bubble grows then shrinks the window.
  - Custom manifest action plays via `/play`; `/actions` lists it.
  - `/health` returns no version.
  - Clean quit removes the port file; Windows: confirm port-file ACL is owner-only (`icacls %USERPROFILE%\.agent-pet\port`).

- [ ] **Step 3: Run the full test suite**: repo root `pnpm test` (bridge + bounds + registry) and `apps/desktop/src-tauri` `cargo test`. All green.

- [ ] **Step 4: Commit**
```bash
git add apps/desktop/README.md
git commit -m "docs(desktop): README + smoke checklist"
```

---

## Notes for the implementer

- **TDD where it pays:** the pure decision functions (`authorize`, `validate_state`, `validate_action`, `safe_link`, `clamp_play_opts`, the JS bounds/registry/handler helpers) are the high-value units — test those first per task. The native window/tray glue is verified manually (no compositor in CI).
- **Build-and-verify-first:** Task 1 exists specifically to de-risk the bounds→resize loop before investing in the server. If it jitters or fights itself, revisit the threshold/coordinate-space approach (spec §4) before proceeding.
- **Tauri v2 specifics drift:** exact command-permission names and the IPC origin string for CSP may differ by Tauri minor version — verify against `cargo tauri` output when wiring capabilities (Task 9) and `connect-src` (Task 9).
- **macOS deferred:** do not add macOS targets; the window flags and ACL code are written cross-platform but only Windows + Linux-dev are validated here.
