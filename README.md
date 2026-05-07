# agent-pet

Animated companion-pet widget for any web app. Self-hosted, no backend, ~14 KB gzip. Drop a script tag, get a draggable pet you can drive with `AgentPet.setState('thinking')` / `AgentPet.say(...)` calls.

Live demo: **https://agent-pet.pages.dev**

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

## Three integration paths

### 1. CDN script tag (auto-mount)

**Minimal** — emoji-glyph pet, zero config:

```html
<script src="https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js"
        data-name="Rex" data-glyph="🦖" data-accent="#e74c3c"></script>
```

**Animated pet from [codex-pets.net](https://codex-pets.net/)** — just the pet id, the script resolves the spritesheet URL:

```html
<script src="https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js"
        data-codex-pet="homelander"></script>
```

Browse [codex-pets.net](https://codex-pets.net/) and pick any pet — the URL slug after `/pets/` is its id. Some examples: `homelander`, `guga`, `furina`, `patamon`, `clippy`, `totoro`.

**Any Codex-format spritesheet** — point at a URL:

```html
<script src="https://agent-pet.pages.dev/v0.1/agent-pet-widget.iife.js"
        data-image-url="https://your-cdn.example/sprite.webp"
        data-use-codex-atlas></script>
```

We don't bake a default spritesheet into the bundle — they're 80-150KB each and belong to their creators. Roll your own following the [Codex Atlas Format](#codex-atlas-format) below.

Drive the pet from JavaScript:

```html
<script>
  AgentPet.setState('thinking');
  AgentPet.say('Build done!', { link: '/results', ttl: 5000 });
</script>
```

The path is **versioned** — pin to `/v0.1/` (or whatever the latest stable version is) for stable URLs that won't break on a future release. The bare path `https://agent-pet.pages.dev/agent-pet-widget.iife.js` is "latest" and may include breaking changes. See [Versioning](#versioning) below.

For production, also pin the bundle to a SHA-384 hash so a compromised CDN can't ship altered code (see [Subresource Integrity](#subresource-integrity-sri) below).

### 2. Self-hosted

The bundle is pure static JS — download it, serve it from your own host:

```bash
curl -O https://agent-pet.pages.dev/agent-pet-widget.iife.js
```

```html
<script src="/static/agent-pet-widget.iife.js" data-auto-mount="false"></script>
<script>
  AgentPet.mount({ target: document.getElementById('sidebar') });
  AgentPet.on('stateChange', (s) => console.log('→', s));
</script>
```

The bundle makes **no calls to any origin** — catalog fetches (community pets) are opt-in via the `PetSettings` panel only.

### 3. npm package (React/Preact apps)

```bash
pnpm add agent-pet
```

```tsx
import { PetProvider, PetOverlay } from 'agent-pet';
import 'agent-pet/css';

<PetProvider>
  <PetOverlay hostState={appState} />
</PetProvider>
```

## API

```ts
AgentPet.setState(state)    // change which atlas row plays
AgentPet.say(text, opts?)   // open speech bubble; opts: { ttl?, link? }
AgentPet.configure(opts)    // change name/glyph/accent/imageUrl/atlas
AgentPet.mount(opts?)       // mount into DOM (auto-called unless data-auto-mount="false")
AgentPet.unmount()          // remove from DOM
AgentPet.on(event, handler) // subscribe: 'click' | 'stateChange'
AgentPet.off(event, handler)
AgentPet.mounted            // boolean — is it currently in the DOM?
```

### States

Each state maps to a distinct atlas row in the sprite sheet:

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

Aliases: `hello`, `welcome` → `greeting`; `away` → `leaving`; `done`, `completed` → `success`.

### Configure options

```ts
AgentPet.configure({
  name: 'Rex',
  glyph: '🦖',                    // emoji shown if no imageUrl
  accent: '#e74c3c',              // theme color
  imageUrl: '/sprites/rex.webp',  // optional spritesheet
  useCodexAtlas: true,            // applies the standard 8×9 Codex layout
  storageKey: 'my-pet',           // localStorage key (defaults to 'agent-pet:config')
});
```

The Codex atlas is an 8×9 spritesheet (1536×1872 px) where each row is one animation. Spritesheets from the [Codex Hatchery](https://j20.nz/hatchery/) and [open-design](https://github.com/nexu-io/open-design) follow this layout. See [Codex Atlas Format](#codex-atlas-format) below.

### `mount()` options

```ts
AgentPet.mount({
  target: document.getElementById('sidebar'),  // defaults to document.body
  ...configureOptions
});
```

Calling `mount()` twice is idempotent — it unmounts the previous instance first.

### Auto-mount

By default, including the script tag auto-boots the widget. To take full control, disable it:

```html
<script src=".../agent-pet-widget.iife.js" data-auto-mount="false"></script>
<script>
  AgentPet.on('stateChange', s => analytics.track('pet_state', s));
  document.addEventListener('app-ready', () => AgentPet.mount());
</script>
```

## Versioning

The CDN ships the bundle at two paths:

| Path | Cache | Stability |
|---|---|---|
| `/agent-pet-widget.iife.js` | 5 min | "latest" — may break on breaking releases |
| `/v0.1/agent-pet-widget.iife.js` | 1 year, immutable | Pinned to v0.1, never breaks |

Pin to a versioned path in production. Pre-1.0, every minor release (`0.1` → `0.2`) may be breaking; once the API stabilizes at 1.0, the version bucket becomes major-only (`/v1/`, `/v2/`).

To discover what "latest" currently resolves to:

```bash
curl -s https://agent-pet.pages.dev/version.json
# {"version":"0.1.0","bucket":"v0.1","latestPath":"/"}
```

## Subresource Integrity (SRI)

Pin the bundle to a hash so browsers reject substituted code:

```html
<script src="https://agent-pet.pages.dev/agent-pet-widget.iife.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

Each release publishes `dist/SRI.json`:

```json
{
  "agent-pet-widget.iife.js": { "integrity": "sha384-...", "bytes": 36916 }
}
```

Generate locally: `pnpm build` runs `scripts/sri.mjs` and writes the hash file.

## Codex Atlas Format

Standard 8×9 sprite grid (1536×1872 px). Each row is one named animation. Rows in fixed order:

| Index | Row id | Frames | FPS |
|---|---|---|---|
| 0 | idle | 6 | 6 |
| 1 | running-right | 8 | 8 |
| 2 | running-left | 8 | 8 |
| 3 | waving | 4 | 6 |
| 4 | jumping | 5 | 7 |
| 5 | failed | 8 | 7 |
| 6 | waiting | 6 | 6 |
| 7 | running | 6 | 8 |
| 8 | review | 6 | 6 |

Set `useCodexAtlas: true` to apply this layout to any spritesheet that follows it.

## Browser support

Chrome/Edge 89+, Firefox 87+, Safari 14+. Uses Shadow DOM, ES2020, and `localStorage`. The IIFE bundle is self-contained — no peer dependencies.

## Development

```bash
pnpm install
pnpm build       # produces dist/agent-pet.js (ES) + dist/agent-pet-widget.iife.js + SRI.json
pnpm test        # vitest — speech queue unit tests
pnpm typecheck
```

Try the examples locally:

```bash
npx serve . -p 5174
# open http://localhost:5174/examples/auto-mount.html
```

## Deploying your own copy

The repo ships a Cloudflare Pages config (`public/_headers`, `public/index.html`):

```bash
pnpm build:pages
# produces public/ with: index.html, _headers, agent-pet-widget.iife.js, agent-pet.js, pet.css
```

Connect any fork to Cloudflare Pages:
- **Framework preset:** None
- **Build command:** `pnpm install && pnpm build:pages`
- **Build output:** `public`

Or any static host — Netlify, GitHub Pages, S3 + CloudFront, your own nginx.

## License

[Apache-2.0](LICENSE).

Animations and atlas helpers ported from [nexu-io/open-design](https://github.com/nexu-io/open-design); sample pets from [j20.nz/hatchery/](https://j20.nz/hatchery/) — both Apache-2.0.
