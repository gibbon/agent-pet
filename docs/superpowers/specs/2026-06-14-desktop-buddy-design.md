# agent-pet desktop buddy — design

**Date:** 2026-06-14
**Status:** Draft for review (revised after spec + security review)
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

- **macOS installer.** Tauri cannot cross-compile a macOS build from Linux, and the dev
  environment is WSL2/Linux. Mac is deferred until Mac hardware/CI exists.
- **Linux installer.** Linux/WSL is the **development + manual-test** platform only (webkit2gtk);
  no Linux installer is produced. The only shipped artifact is the Windows installer.
- **`agent-pet` CLI.** Raw HTTP (`curl`) is sufficient to drive the pet for the MVP. A convenience
  CLI can come later as a thin client over the same HTTP API.
- **Custom/manifest actions over HTTP.** The widget's API surface is wider than the 9 built-in
  states — `PetActionName = WidgetState | (string & {})` with `play(name)` for manifest actions
  (`api.ts:64`). The MVP control server accepts **only the 9 built-in states**; `play()` / custom
  actions are deferred.
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
existing widget on a transparent host page plus a small bridge script.

### Components

1. **Tauri shell (Rust)** — creates the transparent, dynamic-bounding-box window and a minimal
   tray (show/hide, quit). Owns the control server. Exposes a tightly-scoped command set to the
   webview: `report_bounds`, `start_drag`, `quit` (all three validate their inputs, §7).
2. **Pet host page** — a minimal `index.html` that loads the built widget IIFE into a transparent
   fullscreen-of-window container and applies launch config.
3. **Bridge JS (~30–50 lines)** — listens for Tauri events emitted by the control server,
   **re-validates each payload as untrusted** (§7), and calls `AgentPet.setState(state)` /
   `AgentPet.say(text, opts)`. It also observes content bounds and reports them to Rust (§4). It
   never constructs DOM from a payload — all rendering goes through the widget's existing
   `textContent` + `safeBubbleLink` enforcement points.
4. **Control server (Rust, `axum`)** — listens on `127.0.0.1:PORT`. Endpoints in §5.
5. **CI packaging** — a `windows-latest` GitHub Action builds the widget first, then runs Tauri's
   NSIS bundler and uploads the `.exe` installer as an artifact (§9).

### Bridge ↔ Rust event contract

Rust emits these Tauri events; the bridge listens for exactly these and ignores all else. Payload
fields not listed are dropped by the bridge before it calls the `AgentPet` API.

| Event       | Payload                                  | Bridge action |
|-------------|------------------------------------------|---------------|
| `pet:state` | `{ state: WidgetState }`                 | validate `state ∈` 9 states → `AgentPet.setState(state)` |
| `pet:say`   | `{ text: string, ttl?: number, link?: string }` | cap `text`, bound `ttl`, absolute-URL `link` only → `AgentPet.say(text, {ttl, link})` |

## 4. Window model — dynamic bounding box

The window is **transparent, undecorated, always-on-top, `skip_taskbar`**, sized to hug the pet
rather than cover the screen. Click-through is structural: clicks inside the window hit the pet;
clicks outside go to the desktop because it is not the window. Transparent pixels *inside* the
window still capture clicks, so the bridge keeps the window tightly matched to content.

**Bounds-reporting (the one component without prior art — built and verified first):**

- The bridge measures content bounds with a `ResizeObserver` on the pet sprite element plus a hook
  on bubble show/hide — **not** a per-frame loop. Sprite animation changes pixels every frame but
  not the layout box; reporting is driven by *layout transitions* (state change, bubble
  appear/dismiss, drag end), not animation FPS.
- Reported rect is the union of pet + active bubble, in **window-local coordinates** (immune to
  the window being moved), plus a small constant margin (`WINDOW_MARGIN_PX`, e.g. 8).
- A change threshold suppresses churn: only report when the union rect changes by > `N` px
  (e.g. 2) on any edge. This breaks the resize→reposition→re-measure feedback loop.
- Rust validates/clamps the incoming rect (§7) and resizes+repositions the window to match.
- Dragging the pet uses Tauri's `window.startDragging()` (move the OS window), not the widget's
  in-DOM drag.

**Position persistence:** window position is stored via the Tauri store plugin in a file alongside
`~/.agent-pet/` and written on **drag end** and on clean quit; restored on launch. (The widget's
own localStorage position memory is bypassed, since drag moves the OS window, not the DOM.)

Trade-off accepted: the pet cannot autonomously roam, which removes the fullscreen-overlay
hit-test/cursor-poll loop entirely.

## 5. Control server & API

`axum` on `127.0.0.1` (never `0.0.0.0`). Default port with fallback if taken. **A body-size-limit
middleware sits ahead of the JSON extractor** so an oversized/chunked request is rejected before
allocation. **The auth/origin middleware (§7) runs first of all**, before any handler.

| Method | Path     | Auth | Body                                   | Effect |
|--------|----------|------|----------------------------------------|--------|
| POST   | `/state` | yes  | `{ "state": "thinking" }`              | Validate against the 9 states → emit `pet:state`. |
| POST   | `/say`   | yes  | `{ "text": "...", "ttl"?, "link"? }`   | Cap text; bound ttl; **absolute** http/https/mailto link only, re-validated in Rust → emit `pet:say`. |
| GET    | `/health`| no   | —                                      | Bare `200 {"ok":true}` liveness only — **no version disclosed**. |

Valid states (the existing `WidgetState` union): `idle`, `thinking`, `building`, `delegating`,
`success`, `error`, `greeting`, `waiting`, `leaving`.

**Port discovery & lifecycle:** on startup the server writes the bound port and the session token
(§7) to `~/.agent-pet/port`. The file is created **atomically** (`O_CREAT|O_EXCL`, restrictive
perms at creation — see §7.9 for the Windows reality), regenerated every launch, and removed on
clean shutdown. Because a crashed instance can leave a stale file, **clients use `GET /health` as
the liveness check** after reading the file: stale port → connection refused → "buddy not running."

**Single instance:** a startup lock ensures only one buddy runs; a second launch raises the
existing window and exits `0`.

## 6. Data flow & error handling

- Missing/incorrect auth header or cross-origin signal → `403` in middleware, before any work.
- Unknown state → `400`, no event emitted.
- `text` over the cap (a few KB) or body over the request cap → `413`/`400`, rejected before parse.
- `link` re-validated server-side: **absolute** http/https/mailto only (relative URLs rejected —
  there is no meaningful page origin to resolve against in the desktop shell). A rejected link is
  dropped; the text still shows.
- Port in use → try the next port, record the chosen one in the port file.
- Second instance → raise existing window, exit `0`.
- Bridge receives a malformed/extra-field event → drops unknown fields, validates the known ones,
  silently ignores anything it can't validate.

## 7. Security requirements

Moving from "inside one web page" to "a native app with a localhost server" expands the attack
surface. The widget's JS layer is already hardened — speech text is inserted via `textContent`
(`overlay.ts:646`) and links are scheme-allowlisted with a regression test
(`overlay-sanitize.test.ts`). The following are **additional, native-shell** requirements.

### Threat model

- A malicious web page in the user's normal browser firing drive-by requests at `127.0.0.1:PORT`.
- An unrelated local process (same user) or another user on a shared machine.
- Malicious/oversized payloads to the HTTP endpoints.
- Content injection via speech text, links, or image URLs leading to webview XSS / IPC escalation.

### Hard requirements (MVP)

1. **Cross-origin defense — the custom header is the real control, not `Content-Type`.** Reject any
   request lacking an exact `X-Agent-Pet: <expected>` header **first, in middleware, with `403`**,
   before any other work. Do **not** rely on `Content-Type: application/json` as a security control
   — `text/plain`/`form`/`multipart` are CORS-"simple" and skip preflight, so a drive-by page could
   send a body with no preflight. Additionally enforce request provenance: reject any request whose
   `Sec-Fetch-Site` is not `none`/`same-origin`, and reject any request carrying an `Origin` header
   that is not the webview's own origin. (`Sec-Fetch-Site` is browser-attached and not spoofable
   from JS; legitimate `curl`/agent clients send neither `Origin` nor a cross-site fetch signal.)
   The custom-header requirement does force a preflight for genuine browser CORS, which we also
   deny — but provenance + the header are the mechanism, not the content type.
2. **Bind 127.0.0.1 only**, never `0.0.0.0`. Cap request body via a middleware layer ahead of the
   parser (small absolute byte cap; chunked/no-Content-Length requests bounded too).
3. **Rate limiting & connection bounds.** Token-bucket rate limit on `/state` and `/say` (tens of
   req/s), a cap on concurrent in-flight requests, and an independent bound on the
   bounds-report→resize loop so an event flood cannot drive unbounded native window resizes.
4. **Session token.** A ≥128-bit token from a CSPRNG (`OsRng`/`getrandom`), required on `/state`
   and `/say`, compared in **constant time** (`constant_time_eq`/`subtle`) — a loopback server is
   a near-ideal timing oracle. Regenerated each launch. **Scope of this control (do not overstate):
   it raises the bar against *other users* on a shared box and against processes sandboxed away
   from `$HOME`; it does NOT defend against same-user code that can read `~/.agent-pet/` — on a
   single-user desktop that is generally unsolvable without a peer-credential transport (named pipe
   with client-PID/SID checks). For the MVP we accept the residual rather than change transport.**
5. **Webview privilege containment.** An XSS in a Tauri webview can reach the Rust IPC bridge, so
   ship a **full, concrete CSP** (not "strict CSP"):
   `default-src 'none'; script-src 'self'; connect-src 'self' <tauri-ipc-origin>; img-src 'self' https://codex-pets.net https://j20.nz; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
   `style-src 'unsafe-inline'` is a **known, accepted residual** — the widget builds heavily from
   inline `style.cssText`/`<style>` (`sprite.ts`, `overlay.ts`); the `safeAccent`/`JSON.stringify`
   guards exist precisely because inline CSS is attacker-reachable, and remain the mitigation.
6. **Minimal Tauri capabilities.** Expose only `report_bounds`, `start_drag`, `quit`. The `shell`,
   `fs`, and `http` plugins are **not** reachable from the webview. Each command validates its
   args in Rust — `report_bounds` clamps to finite, non-negative values within the virtual-screen
   bounds and a sane max size, so a buggy/hijacked bridge cannot grief the window manager.
7. **Untrusted-input trust boundary, both directions.** (a) The bridge JS treats every Tauri event
   payload as untrusted: accept only `state ∈` 9 states and `{text:string(capped), link?:string,
   ttl?:number(bounded)}`, ignore all other fields, never build DOM from the payload. (b) Rust
   re-runs the http/https/mailto allowlist on `/say` `link` and rejects relative URLs (§6) — the
   JS layer is defense-in-depth, not the only check.
8. **Spritesheet / image sources.** The control server **cannot** set the image URL — it is
   launch-config only, validated in Rust at load (`https:` + bundled-asset scheme only; reject
   `file:`/`data:`/`http:`). CSP `img-src` (above) is the backstop, pinned to the actual hosts the
   providers use — `codex-pets.net` (`codex.ts:8`) and `j20.nz` (`hatchery.ts:11`); confirm
   hatchery's catalog-resolved image hosts fall under `j20.nz` before shipping.
9. **Port-file permissions are a Windows-ACL problem, not `0600`.** The MVP ships on **Windows**,
   where `0600` is a no-op and the file inherits NTFS ACLs. Create `~/.agent-pet/port` with
   explicit restrictive ACLs (owner-only) at creation time, atomically; on Unix use
   `O_CREAT|O_EXCL` + mode `0600` set at open (never chmod-after-write — that leaves a
   world-readable TOCTOU window). This control is weakest on Windows, which compounds requirement 4
   — state that plainly.
10. **Untrusted-input logging.** If `text`/`link`/`state` are logged, log them length-capped and
    control-character-stripped, never into an HTML sink.

### Known / deferred

11. **Unsigned installer.** The Windows installer is unsigned initially → SmartScreen warnings —
    a distribution-trust issue, not a vulnerability. Code-signing is deferred.
12. **Dependency hygiene.** Keep Tauri and the system WebView updated for CVE coverage.

## 8. Testing strategy

- **Rust unit tests** on the control-server handlers and middleware: state validation, body/text
  caps, link re-validation (absolute-only), auth-header + `Sec-Fetch-Site`/`Origin` rejection,
  constant-time compare, rate-limit behavior, `report_bounds` clamping, event mapping.
- **Bridge unit tests (headless JS)** for the two genuinely risky pieces: (a) event payload →
  correct/validated `AgentPet` call (and rejection of malformed/extra-field payloads); (b) a given
  content rect produces the expected window size/position request — assertable without a real
  compositor.
- **Widget JS tests** (existing) cover sprite/bubble behavior and sanitization — unchanged.
- **Manual smoke on Linux/WSL** during development (webkit2gtk).
- **Installer smoke** on the Windows CI artifact: launch, drive via `curl`, observe the pet,
  confirm drive-by rejection (a request without the header is `403`).

## 9. Repo layout & build (proposed)

```
apps/desktop/
  src-tauri/          # Rust: window, tray, control server, commands, middleware
    src/
    tauri.conf.json   # transparent window, full CSP (§7.5), capability allowlist, NSIS bundle
    Cargo.toml
  web/
    index.html        # transparent host page
    bridge.js         # Tauri events ↔ AgentPet API (validated) + bounds reporting
  README.md
.github/workflows/
  desktop-windows.yml # windows-latest: build widget → Tauri NSIS bundle → upload installer
```

**Build dependency:** `dist/agent-pet-widget.iife.js` is a build artifact, not committed. The
desktop build must run the widget build first (`pnpm install && pnpm build`) and copy/symlink the
IIFE into `apps/desktop/web/` at build time, with a **fail-fast check** that errors clearly if the
bundle is missing — never vendor a stale copy. The CI workflow encodes this ordering explicitly.
