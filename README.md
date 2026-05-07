# agent-pet

> A tiny animated companion-pet widget for any web app. Self-hostable, no backend, ~7 KB gzip. Vanilla DOM — no React, no Preact, no framework runtime.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Bundle size](https://img.shields.io/badge/gzip-~7_KB-success)](#)
[![Live demo](https://img.shields.io/badge/demo-agent--pet.pages.dev-7eb8da)](https://agent-pet.pages.dev)
[![npm](https://img.shields.io/badge/npm-agent--pet-cb3837)](https://www.npmjs.com/package/agent-pet)

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
<script src="https://agent-pet.pages.dev/v0.7/agent-pet-widget.iife.js"
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
  <script src="https://agent-pet.pages.dev/v0.7/agent-pet-widget.iife.js"
          data-codex-pet="homelander"></script>
</body>
</html>
```

Save / Run — the pet appears bottom-right and reacts to the buttons. Or save it as `try.html` locally, double-click to open in a browser; no server needed.

There's also a hosted [**playground page**](https://agent-pet.pages.dev/playground.html) — the same minimal example, hosted live. Right-click → "View Source" to copy the working HTML into your editor.

## Features

- **Zero backend** — pure static JS. The widget makes no network calls beyond the one you point it at.
- **Self-contained** — no peer dependencies, no framework runtime. Pure vanilla DOM; ~7 KB gzip total.
- **Shadow DOM isolation** — won't conflict with host page styles.
- **Draggable + persistent** — position and pet selection persist via `localStorage`.
- **9 distinct animations** — drives all rows of the Codex atlas spec (idle, thinking, building, delegating, leaving, greeting, waiting, success, error).
- **Speech bubbles** — `AgentPet.say(text, { link })` for inline status with optional click-through.
- **Versioned URLs** — pin to `/v0.7/` for stability; immutable + 1-year cache.
- **SRI-pinnable** — SHA-384 hashes published per release.
- **Versatile mounting** — auto-mount or programmatic; mount into any element via `target`.

---

## Integration paths

### 1. CDN script tag (recommended for most sites)

**Minimal — emoji glyph, zero config:**

```html
<script src="https://agent-pet.pages.dev/v0.7/agent-pet-widget.iife.js"
        data-name="Rex" data-glyph="🦖" data-accent="#e74c3c"></script>
```

**Animated pet from codex-pets.net by id:**

```html
<script src="https://agent-pet.pages.dev/v0.7/agent-pet-widget.iife.js"
        data-codex-pet="homelander"></script>
```

**Your own Codex-format spritesheet:**

```html
<script src="https://agent-pet.pages.dev/v0.7/agent-pet-widget.iife.js"
        data-image-url="https://your-cdn.example/your-sprite.webp"
        data-use-codex-atlas></script>
```

We don't bake a default spritesheet into the bundle — they're 80–150 KB each and belong to their creators. Roll your own following the [Codex Atlas Format](#codex-atlas-format), or browse [codex-pets.net](https://codex-pets.net/) and [j20.nz/hatchery/](https://j20.nz/hatchery/).

### 2. Self-hosted

The bundle is plain static JS — download it, serve it from your own host:

```bash
curl -O https://agent-pet.pages.dev/v0.7/agent-pet-widget.iife.js
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

### 3. npm package (offline / SDK use)

Install once from npm. Works fully offline — no CDN, no manual file copying.

```bash
pnpm add agent-pet
```

The package exposes three subpath entries; pick the one that fits your app:

| Subpath | Use case | React peer dep? |
|---|---|---|
| `agent-pet` | React apps — import the React components | **Yes** (React 18+) |
| `agent-pet/widget` | Svelte / Vue / Solid / Angular / vanilla — self-contained ES module factory, vanilla DOM, no framework runtime | No |
| `agent-pet/iife` | Direct path to the IIFE bundle if you want a script-tag dist | No |

#### React apps — `agent-pet`

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

#### Any other framework — `agent-pet/widget`

A self-contained ES module that exports `createAgentPetAPI()` plus `createRegistry()` for multi-pet apps. Pure vanilla DOM (~7.7 KB gzip), no framework runtime. Your bundler (Vite/webpack/Rollup) tree-shakes and inlines it like any other dep — no manual copy step.

```ts
import { createAgentPetAPI } from 'agent-pet/widget';

const pet = createAgentPetAPI();
pet.mount({ name: 'Rex', imageUrl: '...', useCodexAtlas: true });
pet.setState('thinking');
```

##### Framework-specific snippets

**Svelte 5:**
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createAgentPetAPI, type AgentPetAPI } from 'agent-pet/widget';

  let pet: AgentPetAPI;
  let working = $state(false);

  onMount(() => {
    pet = createAgentPetAPI();
    pet.mount({ name: 'Buddy' });
  });
  onDestroy(() => pet?.unmount());
  $effect(() => pet?.setState(working ? 'thinking' : 'idle'));
</script>
```

**Vue 3:**
```ts
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { createAgentPetAPI, type AgentPetAPI } from 'agent-pet/widget';

const pet = ref<AgentPetAPI>();
const working = ref(false);

onMounted(() => { pet.value = createAgentPetAPI(); pet.value.mount({ name: 'Buddy' }); });
onUnmounted(() => pet.value?.unmount());
watch(working, v => pet.value?.setState(v ? 'thinking' : 'idle'));
```

**Solid:**
```tsx
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { createAgentPetAPI } from 'agent-pet/widget';

const pet = createAgentPetAPI();
pet.mount({ name: 'Buddy' });
onCleanup(() => pet.unmount());

const [working, setWorking] = createSignal(false);
createEffect(() => pet.setState(working() ? 'thinking' : 'idle'));
```

**Angular:**
```ts
import { Component, OnDestroy, effect, signal } from '@angular/core';
import { createAgentPetAPI, type AgentPetAPI } from 'agent-pet/widget';

@Component({ /* ... */ })
export class App implements OnDestroy {
  pet: AgentPetAPI = createAgentPetAPI();
  working = signal(false);
  constructor() {
    this.pet.mount({ name: 'Buddy' });
    effect(() => this.pet.setState(this.working() ? 'thinking' : 'idle'));
  }
  ngOnDestroy() { this.pet.unmount(); }
}
```

The `agent-pet/widget` entry is one ES module — your bundler treats it like any other npm dep. No script tags, no `window.AgentPet` global, no manual file copying. SSR-safe (the API gates DOM access internally).

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
| `data-observe` | keywords | – | Opt into page event observers (`forms`, `nav`, `all`) |

Bare attributes like `data-use-codex-atlas` (no value) read as truthy.

## API

```ts
AgentPet.setState(state)             // persistent mood — pet stays in this state
AgentPet.play(action, opts?)         // one-shot action — auto-reverts to setState
AgentPet.say(text, opts?)            // open speech bubble; opts: { ttl?, link? }
AgentPet.configure(opts)             // change name/glyph/accent/imageUrl/atlas
AgentPet.observe(opts)               // wire DOM events (form submit, nav, etc.) to states
AgentPet.mount(opts?)                // mount into DOM (auto-called unless data-auto-mount="false")
AgentPet.unmount()                   // remove from DOM
AgentPet.on('stateChange', handler)
AgentPet.off('stateChange', handler)
AgentPet.mounted                     // boolean — currently in the DOM?

// Multi-pet registry (window.AgentPet only)
AgentPet.create(id, opts?)           // create + mount a named pet
AgentPet.get(id) / has(id) / list()  // lookup
AgentPet.remove(id)                  // unmount + forget
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

### Page event observers (opt-in)

Wire the widget to common page events so it reacts automatically — no JS glue:

```js
AgentPet.observe({
  formSubmit:   'thinking',   // any <form> submit fires the event
  formError:    'error',      // HTML5 invalid event on a field
  pageLoad:     'greeting',   // once on initial load
  pageLeave:    'leaving',    // beforeunload
  externalLink: 'leaving',    // cross-origin or target="_blank" link click
});
```

Pass `false` to disable an individual observer; pass `{}` to remove all observers.

Or via the script tag:

```html
<script src=".../agent-pet-widget.iife.js"
        data-codex-pet="homelander"
        data-observe="forms,nav"></script>
```

`data-observe` keywords:
- `forms` — formSubmit + formError
- `nav` — pageLoad + pageLeave + externalLink
- `all` — every observer
- Individual: `form-submit`, `form-error`, `page-load`, `page-leave`, `external-link`

Default off. Observers don't watch input field contents — only events that fire when the user actively does something (submit, click, navigate). No analytics, no scroll-tracking, no field-keystroke logging.

See [`examples/observe.html`](examples/observe.html) for a working demo.

### Pluggable PetSettings — i18n + custom catalogs

Apps with their own state model, i18n, or pet-source backends can wire all of it through `PetSettings` props rather than building a custom settings UI. This is the integration path for projects like [open-design](https://github.com/nexu-io/open-design) that have a daemon-scanned local pet folder, a proprietary community sync, and multi-language support.

**`messages` prop for i18n:**

```tsx
import { PetSettings, type PetMessages } from 'agent-pet';

<PetSettings messages={{
  adopt: t('pet.adopt'),
  switch: t('pet.switch'),
  customizePet: t('pet.customize'),
  // ...any subset; missing keys fall back to the English defaults
}} />
```

The full `PetMessages` interface is exported; `DEFAULT_PET_MESSAGES` is the English default if you want to derive translations.

**`icons` prop — bring your own design-system icons:**

```tsx
import { PetSettings, type PetIcons } from 'agent-pet';
import { Check, X, Download, Upload, Sparkle } from '@your-design/icons';

<PetSettings icons={{ Check, Close: X, Download, Upload, Sparkles: Sparkle }} />
```

`PetIcons` covers all 12 icon slots used by `PetSettings` + `PetRail`. Each is a `(props: { size?: number; style?: CSSProperties }) => JSX` component. Defaults exported as `DEFAULT_PET_ICONS`.

**CSS custom properties — match your design tokens:**

PetSettings inline styles flow through CSS variables with sensible dark-theme defaults. Override in your own stylesheet:

```css
:root {
  --ap-bg-soft:        rgba(0,0,0,0.04);
  --ap-bg-medium:      rgba(0,0,0,0.08);
  --ap-bg-strong:      rgba(0,0,0,0.18);
  --ap-border:         rgba(0,0,0,0.15);
  --ap-border-soft:    rgba(0,0,0,0.1);
  --ap-border-strong:  rgba(0,0,0,0.3);
}
```

The pet's `accent` color always wins for active states, borders, and link CTAs — those come from the user's chosen pet, not the host theme.

**`composeCatalogs([...])` for multiple pet sources:**

```ts
import { composeCatalogs, DefaultCatalogClient, type CatalogClient } from 'agent-pet';

const daemonCatalog: CatalogClient = {
  async fetchList() {
    const local = await fetch('/api/codex-pets').then(r => r.json());
    return { pets: local.pets, rootDir: '~/.codex/pets/' };
  },
  async sync() {
    const r = await fetch('/api/codex-pets/sync', { method: 'POST' });
    return await r.json();
  },
};

const merged = composeCatalogs([
  daemonCatalog,                     // local pets — highest priority
  new DefaultCatalogClient(),        // codex-pets.net + j20.nz fallback
]);

<PetProvider catalog={merged}>
  <PetSettings />
</PetProvider>
```

Pets from earlier catalogs in the list win on id collisions. Both `fetchList()` and `sync()` aggregate across sources, so a single Refresh button hits everything.

### Multiple pets on one page

`window.AgentPet` is a registry — `setState`/`say`/`configure`/etc operate on a default `'main'` pet, and you can spawn additional named pets with `create(id, opts)`:

```js
// One pet for the chat sidebar, another for the build status bar
AgentPet.create('chat',  { name: 'Chat',  imageUrl: '...', useCodexAtlas: true });
AgentPet.create('build', { name: 'Build', imageUrl: '...', useCodexAtlas: true });

AgentPet.get('chat').setState('thinking');
AgentPet.get('build').setState('building');

AgentPet.say('hi from main pet');     // default pet still works
AgentPet.list();                      // ['main', 'chat', 'build']
AgentPet.remove('build');             // unmount + forget
```

Each pet has its own `localStorage` entry (default key: `agent-pet:config:<id>`) and remembers its own dragged position. Override per-pet with `storageKey`:

```js
AgentPet.create('chat', {
  imageUrl: 'https://...spritesheet.webp',
  useCodexAtlas: true,
  storageKey: 'my-app:chat-pet',  // custom localStorage key
  target: document.getElementById('sidebar'),  // optional mount point
});
```

`AgentPet.has(id)` and `AgentPet.list()` for introspection. Backward-compatible — single-pet code keeps working unchanged because the singleton methods forward to `'main'`.

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

The CDN ships the bundle at multiple paths so old pins keep working forever:

| Path | Cache | Stability |
|---|---|---|
| `/agent-pet-widget.iife.js` | 5 minutes | "Latest" — may break on new releases |
| `/v0.7/agent-pet-widget.iife.js` | 1 year, immutable | Pluggable provider registry, current pin |
| `/v0.6/agent-pet-widget.iife.js` | 1 year, immutable | Hardcoded codex-pets.net URL — broken since their 2026-05-08 storage migration |
| `/v0.3/agent-pet-widget.iife.js` | 1 year, immutable | First multi-pet registry build |
| `/v0.2/agent-pet-widget.iife.js` | 1 year, immutable | First vanilla-DOM build (no multi-pet API) |
| `/v0.1/agent-pet-widget.iife.js` | 1 year, immutable | Original Preact-bundled build |

**Pin to `/v0.7/` in production.** Pre-1.0, every minor release (`0.1` → `0.2`) may include breaking changes; once the API stabilizes at 1.0 the version bucket becomes major-only (`/v1/`, `/v2/`).

Breaking-change history:
- **v0.7** — pluggable provider registry; `data-codex-pet` is now resolved via the registered codex provider. Hardcoded URL removed.
- **v0.6.1** — fix for codex-pets.net storage migration (paper-over before v0.7).
- **v0.3** — multi-pet registry API (additive but `window.AgentPet`'s shape changed for TypeScript users).
- **v0.2** — vanilla DOM rewrite. Public API identical to v0.1; bundle internals changed entirely (Preact removed).

To discover what "latest" currently resolves to:

```bash
curl -s https://agent-pet.pages.dev/version.json
# {"version":"0.7.0","bucket":"v0.7","latestPath":"/"}
```

## Subresource Integrity (SRI)

Pin the bundle to a hash so browsers reject substituted code if the CDN is compromised:

```html
<script src="https://agent-pet.pages.dev/v0.7/agent-pet-widget.iife.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

Each release publishes hashes at `/v0.7/SRI.json`:

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
