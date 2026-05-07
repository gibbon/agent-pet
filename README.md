# agent-pet

> A tiny animated companion-pet widget for any web app. Self-hostable, no backend, ~14 KB gzip.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Bundle size](https://img.shields.io/badge/gzip-~14_KB-success)](#)
[![Live demo](https://img.shields.io/badge/demo-agent--pet.pages.dev-7eb8da)](https://agent-pet.pages.dev)

Drop a single `<script>` tag, get a draggable animated pet bottom-right of any page. Drive it from your app:

```js
AgentPet.setState('thinking');
AgentPet.say('Build done!', { link: '/results' });
AgentPet.configure({ name: 'Rex', imageUrl: '...', useCodexAtlas: true });
```

[**▸ Live demo**](https://agent-pet.pages.dev)

---

## Quick start

The fastest path — pick a pet from [codex-pets.net](https://codex-pets.net/) and reference it by id:

```html
<script src="https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js"
        data-codex-pet="homelander"></script>
```

The script resolves the spritesheet URL automatically and applies the standard 8×9 Codex atlas layout. Try `homelander`, `guga`, `furina`, `patamon`, `clippy`, `totoro` — the slug after `/pets/` in any codex-pets.net URL works as the id.

### Try it in a sandbox

Open a blank [CodePen](https://codepen.io/pen/), [JSFiddle](https://jsfiddle.net/), or [JS Bin](https://jsbin.com/), and paste this into the HTML pane:

```html
<!DOCTYPE html>
<html>
<body style="background:#111;color:#eee;font-family:monospace;padding:2rem;">
  <button onclick="AgentPet.setState('thinking')">thinking</button>
  <button onclick="AgentPet.setState('building')">building</button>
  <button onclick="AgentPet.setState('success')">success</button>
  <button onclick="AgentPet.say('hello!', {ttl:4000})">say hello</button>
  <script src="https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js"
          data-codex-pet="homelander"></script>
</body>
</html>
```

Save / Run — the pet appears bottom-right and reacts to the buttons. Or save it as `try.html` locally, double-click to open in a browser; no server needed.

There's also a hosted [**playground page**](https://agent-pet.pages.dev/playground.html) — the same minimal example, hosted live. Right-click → "View Source" to copy the working HTML into your editor.

## Features

- **Zero backend** — pure static JS. The widget makes no network calls beyond the one you point it at.
- **Self-contained** — no peer dependencies. Bundles its own tiny Preact runtime; ~14 KB gzip total.
- **Shadow DOM isolation** — won't conflict with host page styles.
- **Draggable + persistent** — position and pet selection persist via `localStorage`.
- **9 distinct animations** — drives all rows of the Codex atlas spec (idle, thinking, building, delegating, leaving, greeting, waiting, success, error).
- **Speech bubbles** — `AgentPet.say(text, { link })` for inline status with optional click-through.
- **Versioned URLs** — pin to `/v0.1/` for stability; immutable + 1-year cache.
- **SRI-pinnable** — SHA-384 hashes published per release.
- **Versatile mounting** — auto-mount or programmatic; mount into any element via `target`.

---

## Integration paths

### 1. CDN script tag (recommended for most sites)

**Minimal — emoji glyph, zero config:**

```html
<script src="https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js"
        data-name="Rex" data-glyph="🦖" data-accent="#e74c3c"></script>
```

**Animated pet from codex-pets.net by id:**

```html
<script src="https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js"
        data-codex-pet="homelander"></script>
```

**Your own Codex-format spritesheet:**

```html
<script src="https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js"
        data-image-url="https://your-cdn.example/your-sprite.webp"
        data-use-codex-atlas></script>
```

We don't bake a default spritesheet into the bundle — they're 80–150 KB each and belong to their creators. Roll your own following the [Codex Atlas Format](#codex-atlas-format), or browse [codex-pets.net](https://codex-pets.net/) and [j20.nz/hatchery/](https://j20.nz/hatchery/).

### 2. Self-hosted

The bundle is plain static JS — download it, serve it from your own host:

```bash
curl -O https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js
```

Serve via your CDN, nginx, S3, GitHub Pages — anywhere. Then:

```html
<script src="/static/agent-pet-widget.iife.js"
        data-codex-pet="totoro"></script>
```

The bundle makes no calls back to any origin. The only outgoing request from `data-codex-pet` is the spritesheet `<img src>` to codex-pets.net's storage; for zero external requests, vendor the spritesheet locally:

```bash
# In a checkout of this repo
pnpm vendor-pet homelander
# → public/sprites/homelander.webp

# Then in your HTML
<script src="/static/agent-pet-widget.iife.js"
        data-image-url="/sprites/homelander.webp"
        data-use-codex-atlas></script>
```

Vendor multiple at once: `pnpm vendor-pet homelander guga totoro`.

### 3. npm package (React apps)

> Not yet published to npm. For now, install via tarball: `pnpm pack` in this repo, then `pnpm add /path/to/agent-pet-0.1.0.tgz` in your app.

```tsx
import { PetProvider, PetOverlay } from 'agent-pet';
import 'agent-pet/css';

function App({ appState }) {
  return (
    <PetProvider>
      <PetOverlay hostState={appState} />
    </PetProvider>
  );
}
```

The npm package exports the underlying React components plus all core types and atlas helpers. React 18+ is a peer dependency.

---

## Script-tag attributes

| Attribute | Type | Default | Purpose |
|---|---|---|---|
| `data-codex-pet` | string | – | Pet id at codex-pets.net (auto-resolves URL + atlas) |
| `data-name` | string | `"Buddy"` | Display name in speech bubble |
| `data-glyph` | string (emoji) | `"🐶"` | Emoji shown when no `imageUrl` set |
| `data-accent` | CSS color | `"#7eb8da"` | Theme color (border, links) |
| `data-image-url` | URL | – | Spritesheet URL |
| `data-use-codex-atlas` | flag | – | Apply standard 8×9 Codex atlas layout |
| `data-storage-key` | string | `"agent-pet:config"` | localStorage key (multi-instance) |
| `data-auto-mount` | `"false"` | auto-mount | Set `"false"` to mount programmatically |

Bare attributes like `data-use-codex-atlas` (no value) read as truthy.

## API

```ts
AgentPet.setState(state)             // persistent mood — pet stays in this state
AgentPet.play(action, opts?)         // one-shot action — auto-reverts to setState
AgentPet.say(text, opts?)            // open speech bubble; opts: { ttl?, link? }
AgentPet.configure(opts)             // change name/glyph/accent/imageUrl/atlas
AgentPet.mount(opts?)                // mount into DOM (auto-called unless data-auto-mount="false")
AgentPet.unmount()                   // remove from DOM
AgentPet.on('stateChange', handler)
AgentPet.off('stateChange', handler)
AgentPet.mounted                     // boolean — currently in the DOM?
```

### `setState` vs `play`

Use **`setState()`** for the pet's persistent mood — it holds until you change it:

```ts
AgentPet.setState('thinking');   // stays in 'thinking' until next setState
```

Use **`play()`** for transient feedback — the pet plays the action once, then reverts to whatever `setState` was last:

```ts
AgentPet.setState('idle');
AgentPet.play('greeting');       // wave once, then back to idle
AgentPet.play('success', { loops: 2 });   // celebrate twice
AgentPet.play('jumping', { durationMs: 800 });  // explicit duration
```

Calling `setState()` while a `play()` is in flight cancels the auto-revert — explicit state takes precedence.

### States

Each state maps to a distinct row of the Codex atlas:

| State | Atlas row | Suggested use |
|---|---|---|
| `idle` | idle | Default ambient state |
| `thinking` | review | Awaiting LLM / processing input |
| `building` | running | Long-running task in progress |
| `delegating` | running-right | Forwarding to subsystem |
| `leaving` | running-left | Wrapping up / going away |
| `greeting` | waving | Hello / welcome / first appearance |
| `waiting` | waiting | Awaiting user input |
| `success` | jumping | Operation completed successfully |
| `error` | failed | Operation failed |

The atlas row name also works directly as a `setState()` argument, e.g. `setState('running-right')` is equivalent to `setState('delegating')`. Useful when you're driving from raw Codex vocabulary.

Aliases: `hello`/`welcome` → `greeting`; `away` → `leaving`; `done`/`completed` → `success`.

### `configure()` options

```ts
AgentPet.configure({
  name: 'Rex',
  glyph: '🦖',                    // emoji shown if no imageUrl
  accent: '#e74c3c',              // theme color (border, links)
  imageUrl: '/sprites/rex.webp',  // spritesheet URL
  useCodexAtlas: true,            // applies the standard 8×9 Codex layout
  storageKey: 'my-pet',           // localStorage key (for multi-instance pages)
});
```

`configure()` patches localStorage and dispatches an `agent-pet:config-changed` window event so multiple consumers stay in sync.

### `mount()` options

```ts
AgentPet.mount({
  target: document.getElementById('sidebar'),  // defaults to document.body
  ...configureOptions
});
```

Calling `mount()` twice is idempotent — it unmounts the previous instance first.

### Programmatic mount

By default the script auto-boots on `DOMContentLoaded`. Disable to take full control:

```html
<script src=".../agent-pet-widget.iife.js" data-auto-mount="false"></script>
<script>
  // API is available immediately; only the DOM mount is deferred.
  AgentPet.on('stateChange', (s) => analytics.track('pet_state', s));
  document.addEventListener('app-ready', () => AgentPet.mount());
</script>
```

---

## Versioning

The CDN ships the bundle at two paths:

| Path | Cache | Stability |
|---|---|---|
| `/agent-pet-widget.iife.js` | 5 minutes | "Latest" — may break on new releases |
| `/v0.1/agent-pet-widget.iife.js` | 1 year, immutable | Pinned to v0.1, never breaks |

**Pin to a versioned path in production.** Pre-1.0, every minor release (`0.1` → `0.2`) may include breaking changes; once the API stabilizes at 1.0, the version bucket becomes major-only (`/v1/`, `/v2/`).

To discover what "latest" currently resolves to:

```bash
curl -s https://agent-pet.pages.dev/version.json
# {"version":"0.1.0","bucket":"v0.1","latestPath":"/"}
```

## Subresource Integrity (SRI)

Pin the bundle to a hash so browsers reject substituted code if the CDN is compromised:

```html
<script src="https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

Each release publishes hashes at `/v0.1/SRI.json`:

```json
{
  "agent-pet-widget.iife.js": { "integrity": "sha384-...", "bytes": 36916 }
}
```

Local builds also produce `dist/SRI.json` via `pnpm build`.

---

## Codex Atlas Format

A spritesheet packed as an 8×9 grid (1536×1872 px standard). Each row is one named animation:

| Row | Frames | FPS |
|---|---|---|
| `idle` | 6 | 6 |
| `running-right` | 8 | 8 |
| `running-left` | 8 | 8 |
| `waving` | 4 | 6 |
| `jumping` | 5 | 7 |
| `failed` | 8 | 7 |
| `waiting` | 6 | 6 |
| `running` | 6 | 8 |
| `review` | 6 | 6 |

Set `useCodexAtlas: true` (or `data-use-codex-atlas`) to apply this layout to any spritesheet that follows it.

### Custom atlas layouts

For spritesheets that don't follow the Codex 8×9 format, pass an `atlas` object describing your grid:

```js
AgentPet.configure({
  imageUrl: 'https://example.com/my-pet.png',
  atlas: {
    cols: 4,
    rows: 3,
    rowsDef: [
      { index: 0, id: 'idle',     frames: 4, fps: 6 },
      { index: 1, id: 'walking',  frames: 4, fps: 8 },
      { index: 2, id: 'jumping',  frames: 3, fps: 7 },
    ],
  },
});
```

`rowsDef` maps row indices (0-based, top to bottom) to row ids that `setState()` can target. The standard ids the widget already understands are `idle`, `running`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, and `review` — using these makes the built-in state mappings work. You can include arbitrary ids and call `setState('walking')` directly via the default adapter's pass-through behavior.

When both `atlas` and `useCodexAtlas` are set, `atlas` wins.

---

## Browser support

Evergreen browsers (last 2 major versions of Chrome, Edge, Firefox, Safari).

Uses Shadow DOM v1, ES2020+, `localStorage`, and modern CSS animations. The IIFE bundle is fully self-contained — no peer dependencies.

## Development

```bash
pnpm install
pnpm build       # → dist/agent-pet.js (ES) + dist/agent-pet-widget.iife.js (IIFE) + SRI.json
pnpm test        # vitest — speech queue unit tests
pnpm typecheck
```

Try the bundled examples locally:

```bash
npx serve . -p 5174
```

Then open:
- `http://localhost:5174/examples/auto-mount.html`
- `http://localhost:5174/examples/programmatic-mount.html`
- `http://localhost:5174/examples/self-hosted/index.html`

## Deploying your own copy

The repo ships a Cloudflare Pages config (`public/_headers`, `public/index.html`, version layout):

```bash
pnpm build:pages
# → public/{index.html, _headers, ...} + public/v<x.y>/{bundle, SRI.json}
```

Connect a fork to Cloudflare Pages with:
- **Framework preset:** None
- **Build command:** `pnpm install && pnpm build:pages`
- **Build output:** `public`
- **NODE_VERSION env var:** `20`

Or any static host — Netlify, GitHub Pages, S3 + CloudFront, your own nginx.

## Related projects

The Codex Pets ecosystem is small but growing — a few neighbours worth knowing:

- **[codex-pets.net](https://codex-pets.net/)** — the public catalog of community-uploaded Codex pets, plus a "Petshare" API for browsing and downloading them. The `data-codex-pet="<id>"` attribute in this widget pulls directly from their storage.
- **[j20.nz/hatchery/](https://j20.nz/hatchery/)** — an earlier catalog of Codex-format pets. Pre-dates codex-pets.net; both follow the same atlas spec.
- **[openai/skills/.../hatch-pet](https://github.com/openai/skills/tree/main/skills/.curated/hatch-pet)** — the official OpenAI Codex skill that *generates* a new pet (image + atlas) from a text prompt, on demand. Pair this with agent-pet to bring AI-generated companions onto your site.
- **[FroeMic/codex-pets-web](https://github.com/FroeMic/codex-pets-web)** — a sibling library (MIT, 2026-05-06) targeting the same Codex pet format. Different shape: ships as multiple npm packages with first-class wrappers for React, Vue, Svelte, Solid, and Angular. If you want tight framework integration over a one-line script tag, look there.
- **[nexu-io/open-design](https://github.com/nexu-io/open-design)** — Apache-2.0. The reference UI implementation that agent-pet's animations and atlas helpers are ported from.
- **[stevenjoezhang/live2d-widget](https://github.com/stevenjoezhang/live2d-widget)** — different format (Live2D parametric models, not sprite atlas) but the dominant "anime mascot on your website" widget. ~10k stars. Worth knowing if Live2D is what you actually want.

## Contributing

Issues and pull requests welcome at [github.com/gibbon/agent-pet](https://github.com/gibbon/agent-pet). Please run `pnpm test` and `pnpm typecheck` before submitting.

## License

[Apache-2.0](LICENSE).

The animation system, atlas helpers, and React components are ported from [nexu-io/open-design](https://github.com/nexu-io/open-design) (Apache-2.0). Sample pets demonstrated in the live demo come from [codex-pets.net](https://codex-pets.net/) and [j20.nz/hatchery/](https://j20.nz/hatchery/) — the demo loads them via their public APIs and we do not redistribute their assets.
