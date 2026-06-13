# agent-pet desktop buddy — design

**Date:** 2026-06-14
**Status:** Draft for review
**Scope:** MVP — a native desktop companion that floats the existing agent-pet widget on the
desktop, driven by a localhost HTTP API. Deliverable: a working buddy plus a Windows installer.
macOS is explicitly deferred.

## 1. Goal & motivation

`agent-pet` today is a web widget: a draggable, animated sprite companion that lives inside a web
page and is driven by a small JS API (`AgentPet.setState`, `AgentPet.say`). This project lifts the
same widget out of the browser and onto the **desktop**, where an external process (an agent, a
build, a CLI hook) can drive it as a live status surface — e.g. `thinking` while an agent works,
`success` when a build passes, a speech bubble when something finishes.

The widget is unusually well-suited to this: it is vanilla DOM in a Shadow DOM, self-contained,
ships as a single IIFE bundle with no backend, and already exposes a clean imperative API. The
desktop app is therefore a thin native shell around code that already exists.

## 2. Non-goals (YAGNI for the MVP)

- **macOS / Linux installers.** Tauri cannot cross-compile a macOS build from Linux, and the
  dev environment is WSL2/Linux. Mac is deferred until Mac hardware/CI exists.
- **`agent-pet` CLI.** Raw HTTP (`curl`) is sufficient to drive the pet for the MVP. A convenience
  CLI can come later as a thin client over the same HTTP API.
- **Full settings UI.** No in-app pet picker / preferences window. Configuration is via launch
  config; the tray offers only show/hide and quit.
- **Autonomous roaming.** The pet stays where the user drags it; it does not walk the screen on
  its own. (This is a direct consequence of the window model below.)
- **Auto-update.** No Tauri updater in the MVP.

## 3. Architecture

A new Tauri application lives in this repo as a monorepo addition under `apps/desktop/`. It does
**not** fork the widget — it consumes the already-built `dist/agent-pet-widget.iife.js` as a file
dependency so the buddy always tracks the library.

```
external process ──HTTP POST──▶ Rust control server ──Tauri event──▶ webview JS bridge ──▶ AgentPet API ──▶ sprite
                                        │                                     │
                                        └──────── window resize ◀── content bounds (JS → Rust)
```

The Rust side owns the native window, the tray, and the localhost server. The webview is the
existing widget on a transparent host page plus a small bridge script. Almost no new JS.

### Components

1. **Tauri shell (Rust)** — creates the transparent, dynamic-bounding-box window and a minimal
   tray (show/hide, quit). Owns the control server. Exposes a tightly-scoped command set to the
   webview: `report_bounds`, `start_drag`, `quit`.
2. **Pet host page** — a minimal `index.html` that loads the built widget IIFE into a transparent
   fullscreen-of-window container and applies launch config.
3. **Bridge JS (~30–50 lines)** — listens for Tauri events emitted by the control server and calls
   `AgentPet.setState(state)` / `AgentPet.say(text, opts)`; observes the pet's (and any active
   bubble's) content bounds and reports them to Rust via `report_bounds` so the window can be
   resized to match.
4. **Control server (Rust, `axum`)** — listens on `127.0.0.1:PORT`. Endpoints in §5.
5. **CI packaging** — a `windows-latest` GitHub Action runs Tauri's NSIS bundler and uploads the
   `.exe` installer as an artifact.

## 4. Window model — dynamic bounding box

The window is **transparent, undecorated, always-on-top, `skip_taskbar`**, and sized to hug the
pet rather than cover the screen. Click-through is achieved structurally, not via cursor polling:
clicks inside the window hit the pet; clicks outside it go to the desktop because it is not the
window.

The wrinkle is that transparent pixels *inside* the window still capture clicks. The bridge solves
this by keeping the window tightly matched to content:

- JS measures the pet sprite's bounding rect (and, when a speech bubble is showing, the union of
  pet + bubble rects) and reports it to Rust.
- Rust resizes and repositions the window to that rect (plus a small constant margin), so the
  window is only ever as large as the visible content. When a bubble appears the window grows;
  when it dismisses, the window shrinks back.
- Dragging the pet uses Tauri's `window.startDragging()` (move the OS window) rather than the
  widget's in-DOM drag. Position persists across launches.

Trade-off accepted: because the window hugs the pet, the pet cannot autonomously roam the whole
desktop. This is an acceptable loss for the MVP and removes the only component without prior art
(the Rust hit-test/cursor-poll loop a fullscreen overlay would require).

**Build-and-verify-first:** the JS→Rust bounds-reporting + window-resize loop is the only piece
without precedent in this codebase. It is implemented and verified before the rest of the shell to
de-risk the design.

## 5. Control server & API

`axum` on `127.0.0.1` (never `0.0.0.0`). Default port with fallback if taken.

| Method | Path     | Body                                   | Effect |
|--------|----------|----------------------------------------|--------|
| POST   | `/state` | `{ "state": "thinking" }`              | Validates against the 9 known states, emits a Tauri event → `AgentPet.setState`. |
| POST   | `/say`   | `{ "text": "...", "ttl"?, "link"? }`   | Length-capped text; link re-validated server-side; emits event → `AgentPet.say`. |
| GET    | `/health`| —                                      | `200 {"ok":true,"version":...}` for liveness/discovery. |

Valid states (the existing `WidgetState` union): `idle`, `thinking`, `building`, `delegating`,
`success`, `error`, `greeting`, `waiting`, `leaving`.

**Port discovery:** on startup the server writes the bound port (and the session token, §7) to
`~/.agent-pet/port` (mode `0600`) so clients can discover it when the default is taken.

**Single instance:** a startup lock ensures only one buddy runs; a second launch surfaces/raises the
existing window and exits.

## 6. Data flow & error handling

- Unknown state → `400`, no event emitted.
- `text` over the cap (a few KB) or body over the request cap → `413`/`400`, rejected before
  processing.
- `link` re-validated server-side against the same http/https/mailto allowlist the widget enforces
  (`safeBubbleLink`); a rejected link is dropped, the text still shows.
- Port in use → try the next port, record the chosen one in the port file.
- Second instance → raise existing window, exit `0`.

## 7. Security requirements

Moving from "inside one web page" to "a native app with a localhost server" expands the attack
surface. The widget's JS layer is already hardened — speech text is inserted via `textContent`
(no HTML injection, `overlay.ts:646`) and links are scheme-allowlisted with a regression test
(`overlay-sanitize.test.ts`). The following are **additional, native-shell** requirements.

### Hard requirements (MVP)

1. **Localhost exposure.** Bind `127.0.0.1` only. Reject cross-origin requests: require
   `Content-Type: application/json` and a custom header (e.g. `X-Agent-Pet: 1`) so any browser
   cross-origin attempt must preflight; deny the preflight. This blocks the "drive-by localhost"
   class (a malicious web page POSTing to `127.0.0.1:PORT`). Cap request body size (a few KB).
2. **Session token.** Generate a random token at startup, write it to `~/.agent-pet/port` (`0600`),
   and require it as a header on `/state` and `/say`. `/health` is unauthenticated. This closes
   same-machine control by unrelated local processes.
3. **Webview privilege containment.** An XSS in a Tauri webview can reach the Rust IPC bridge, so:
   - Ship a strict CSP: `script-src 'self'`, no inline/remote script, `connect-src 'self'`.
   - Expose only the minimum Tauri capabilities (`report_bounds`, `start_drag`, `quit`). The
     `shell`, `fs`, and `http` plugins are not reachable from the webview.
4. **Server-side link re-validation.** Do not trust the JS layer alone; re-run the http/https/mailto
   allowlist on `/say` `link` in Rust before emitting the event.

### Policy decisions

5. **Spritesheet sources.** The control server **cannot** set the image URL — pet image is
   launch-config only, set by the user, never by a `POST`. CSP `img-src` is restricted to an
   allowlist (bundled assets + the known codex-pets/hatchery CDNs). This prevents attacker-driven
   content loads (tracking beacons, huge-image memory DoS) via the network surface.

### Known / deferred

6. **Unsigned installer.** The Windows installer is unsigned initially → SmartScreen warnings. This
   is a distribution-trust issue, not a vulnerability; code-signing is deferred.
7. **Dependency hygiene.** Keep Tauri and the system WebView updated for CVE coverage.

## 8. Testing strategy

- **Rust unit tests** on the control-server handlers: state validation, body/text caps, link
  re-validation, auth/origin rejection, event mapping.
- **Widget JS tests** (existing) cover sprite/bubble behavior and sanitization — unchanged.
- **Bridge** smoke: a manual/automated check that an event in → correct `AgentPet` call out, and
  that bounds-reporting resizes the window.
- **Manual smoke on Linux/WSL** during development (webkit2gtk).
- **Installer smoke** on the Windows CI artifact: launch, drive via `curl`, observe the pet.

## 9. Repo layout (proposed)

```
apps/desktop/
  src-tauri/          # Rust: window, tray, control server, commands
    src/
    tauri.conf.json   # transparent window, CSP, capability allowlist, NSIS bundle
    Cargo.toml
  web/
    index.html        # transparent host page
    bridge.js         # Tauri events ↔ AgentPet API + bounds reporting
  README.md
.github/workflows/
  desktop-windows.yml # windows-latest → NSIS installer artifact
```

The desktop app references the repo's built `dist/agent-pet-widget.iife.js`; the build wires it in
(copy/symlink at build time) rather than vendoring a stale copy.
