# agent-pet desktop buddy

Native desktop shell for the `agent-pet` widget. It runs a transparent, always-on-top Tauri window and exposes a localhost HTTP API for external agents or scripts.

## Development

Build the web bundles first, then run the desktop app:

```bash
pnpm install
pnpm build
cd apps/desktop
pnpm install
pnpm dev
```

Linux/WSL development needs the Tauri system packages, including WebKitGTK 4.1, GTK 3, librsvg, and libayatana-appindicator.

## Driving the pet

The app writes the chosen port and per-launch token to `~/.agent-pet/port`:

```bash
PORT=$(sed -n '1p' ~/.agent-pet/port)
TOKEN=$(sed -n '2p' ~/.agent-pet/port)
curl "127.0.0.1:$PORT/health"
curl -X POST "127.0.0.1:$PORT/state" -H 'x-agent-pet:1' -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"state":"thinking"}'
curl -X POST "127.0.0.1:$PORT/play" -H 'x-agent-pet:1' -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"action":"success"}'
curl -X POST "127.0.0.1:$PORT/say" -H 'x-agent-pet:1' -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"text":"build done","link":"https://example.com"}'
curl "127.0.0.1:$PORT/actions" -H 'x-agent-pet:1' -H "authorization: Bearer $TOKEN"
```

## Agent runner

The desktop app also exposes an experimental allowlisted agent runner. It does not execute arbitrary shell commands. The first supported tool is `rdan`, resolved from `AGENT_PET_RDAN_DIR`, `../r.dan`, `../../r.dan`, or `~/projects/r.dan`.

```bash
curl "127.0.0.1:$PORT/agent/tools" -H 'x-agent-pet:1' -H "authorization: Bearer $TOKEN"
curl "127.0.0.1:$PORT/agent/status" -H 'x-agent-pet:1' -H "authorization: Bearer $TOKEN"
curl "127.0.0.1:$PORT/agent/log" -H 'x-agent-pet:1' -H "authorization: Bearer $TOKEN"
curl -X POST "127.0.0.1:$PORT/agent/start" -H 'x-agent-pet:1' -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"tool":"rdan"}'
curl -X POST "127.0.0.1:$PORT/agent/stop" -H 'x-agent-pet:1' -H "authorization: Bearer $TOKEN"
```

## Security model

The server binds only `127.0.0.1`. Mutating endpoints require `X-Agent-Pet: 1` and `Authorization: Bearer <token>`, reject cross-site browser provenance signals, cap body size, and rate limit requests. The token is regenerated each launch and compared in constant time.

The token protects against drive-by browser requests and raises the bar against unrelated local users or sandboxed processes. It does not protect against same-user code that can read `~/.agent-pet/port`.

## Windows installer

The `Desktop Windows Installer` workflow builds the widget bundles, vendors them into the Tauri app, runs the NSIS bundler on `windows-latest`, and uploads the `.exe` artifact.

## Smoke checklist

- POST without `x-agent-pet` returns `403`.
- Wrong bearer token returns `403`.
- `/state`, `/play`, and `/say` animate the pet.
- Speech bubble grows and shrinks the native window.
- `/actions` lists built-ins and custom manifest actions.
- `/health` returns only `{"ok":true}`.
- `/agent/tools` lists only allowlisted tools; `/agent/start` rejects unknown tools.
- Clean quit removes `~/.agent-pet/port`.
- Windows: `icacls %USERPROFILE%\.agent-pet\port` shows owner-only access.
