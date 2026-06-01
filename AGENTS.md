# AGENTS.md

Guide for humans and AI coding agents working in this repo. If you're an LLM, read this top-to-bottom before touching code — it will save you (and the reviewer) round-trips.

For end-user / integrator docs, read the [README](./README.md). For release/PR mechanics, read [CONTRIBUTING.md](./CONTRIBUTING.md). This file covers the parts that aren't obvious from those.

---

## What this is

`agent-pet` is a tiny animated companion-pet widget. It ships in three forms from one source tree:

| Bundle | Entry | Where it's used |
|---|---|---|
| IIFE (`dist/agent-pet-widget.iife.js`) | `src/widget/index.ts` | CDN `<script>` tag — sets `window.AgentPet` |
| Widget ESM (`dist/agent-pet-widget.es.js`) | `src/widget/widget-es.ts` | `import { createAgentPetAPI } from 'agent-pet/widget'` for non-React frameworks |
| React ESM (`dist/agent-pet.js`) | `src/index.ts` | `import { PetProvider, PetOverlay } from 'agent-pet'` |

Hard constraints — keep these in mind on every change:

- **IIFE bundle ≤ 15 KB gzip.** CI fails above that (`.github/workflows/ci.yml`). Vanilla DOM only — no React, no Preact, no framework runtime in the widget code path.
- **No baked spritesheets.** Spritesheets live on a CDN or in the host site's `public/`. The bundle ships zero pet image data.
- **No backend.** The widget makes no network calls beyond the spritesheet `<img src>` you point it at.
- **`/v0.X/` paths on the CDN are immutable.** Once shipped they don't change. New versions get a new bucket. See `CONTRIBUTING.md` for release flow.

## Repo layout

```
src/
  core/                  framework-agnostic logic
    atlas.ts             Codex 8×9 atlas spec + custom-atlas plumbing
    pets.ts, types.ts    public types (PetState, PetMessages, PetIcons, ...)
    image.ts             sprite loading + sizing
    providers/           pet-source providers (codex, hatchery, registry, types)
    adapters/default.ts  state → atlas-row mapping
  widget/                vanilla-DOM widget — the IIFE/ESM target
    api.ts               createAgentPetAPI() — public surface
    mount.ts overlay.ts sprite.ts queue.ts observer.ts
    registry.ts          multi-pet registry (window.AgentPet.create(id, ...))
    index.ts             IIFE entry — boots from <script> data-* attrs
    widget-es.ts         ESM entry — exports factories, no auto-boot
  react/                 React components (PetOverlay, PetSettings, PetRail, ...)
  shared/global.ts       window.AgentPet typing
scripts/
  vendor-pet.mjs         download a codex-pets.net spritesheet to public/sprites/
  build-pages.mjs        compose Cloudflare Pages output
  sri.mjs                emit dist/SRI.json with sha384 hashes
  screenshot.mjs         hero screenshot for README
public/                  Cloudflare Pages site (demo + versioned bundles)
examples/                hand-authored HTML demos — also referenced from the README
docs/                    README assets (hero.png etc) — not user-facing docs
```

If you're adding a new file, ask yourself which bucket it belongs in *before* creating it — `core` for logic that should be reusable from React or vanilla, `widget` for things that touch DOM directly, `react` for JSX. Don't import React from anywhere under `core/` or `widget/`.

## Dev loop

```bash
pnpm install
pnpm typecheck       # tsc --noEmit
pnpm test            # vitest run
pnpm build           # all three bundles + dist/SRI.json
```

Try the examples locally:

```bash
npx serve . -p 5174
# http://localhost:5174/examples/auto-mount.html
# http://localhost:5174/examples/multi-pet.html
# http://localhost:5174/examples/observe.html
# http://localhost:5174/examples/self-hosted/index.html
```

For UI work, **actually load an example in a browser and exercise the change** before claiming the task is done. Type-checks and unit tests verify code correctness, not feature correctness — if you can't verify a UI change visually, say so explicitly in the PR.

Node ≥ 20, pnpm ≥ 9. macOS / Linux / WSL2.

## Sprites: getting them, generating them, shipping them

There are four legitimate ways to get a sprite onto a page — pick whichever matches the task.

### 1. By codex-pets.net id (zero setup)

```html
<script src="https://agent-pet.pages.dev/v0.8/agent-pet-widget.iife.js"
        data-codex-pet="homelander"></script>
```

The widget resolves the URL through `src/core/providers/codex.ts` and applies the standard 8×9 Codex atlas layout. Slugs come from the URL path on [codex-pets.net](https://codex-pets.net/) (e.g. `/pets/homelander`).

### 2. Vendored locally (zero external requests at runtime)

```bash
pnpm vendor-pet homelander guga totoro
# → public/sprites/<id>.webp
```

Then point the widget at the local path:

```html
<script src="/agent-pet-widget.iife.js"
        data-image-url="/sprites/homelander.webp"
        data-use-codex-atlas></script>
```

`scripts/vendor-pet.mjs` is intentionally dumb: a `fetch` of `https://codex-pets.net/assets/pets/<id>/spritesheet.webp` written to `public/sprites/`. Don't commit downloaded sprites to this repo — they belong to their creators.

### 3. From the `codex-pets` CLI (locally installed pets)

The official [`codex-pets`](https://www.npmjs.com/package/codex-pets) CLI installs to `~/.codex/pets/<id>/`. Point any static server at that directory and register a provider — see the *Using pets installed via `codex-pets` CLI* section of the README for the full pattern. The integration is host-side glue, not changes to this widget.

### 4. Generating a *new* sprite from scratch

Use OpenAI Codex's [hatch-pet skill](https://github.com/openai/skills/tree/main/skills/.curated/hatch-pet) to generate the spritesheet image + atlas metadata from a text prompt, then load it through the widget the same way as any other custom atlas:

```js
AgentPet.configure({
  imageUrl: '/sprites/my-new-pet.webp',
  atlas: {
    cols: 4, rows: 3,
    rowsDef: [
      { index: 0, id: 'idle',    frames: 4, fps: 6 },
      { index: 1, id: 'running', frames: 4, fps: 8 },
      { index: 2, id: 'jumping', frames: 3, fps: 7 },
    ],
  },
});
```

Use the standard Codex row ids (`idle`, `running`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `review`) when you want the built-in `setState('thinking' | 'building' | ...)` mappings to work without an adapter. See the *Codex Atlas Format* section of the README for the canonical 8×9 spec (1536×1872 px, frame counts, FPS).

If you're generating a sprite as part of a PR demo, host it externally (codex-pets.net, your own CDN) and link to it in the PR description rather than committing the binary.

## Conventions you must keep

These are the gotchas that have already burned a contributor or a release. Not following them will get caught in review.

- **Trust boundaries:** any value that came from `data-*` attributes, `localStorage`, `configure({...})`, or `say()` callsites is **untrusted**. `imageUrl`, `link`, and `accent` are the canonical danger fields. They're sanitized at the widget boundary; do not bypass that. If you add a new user-supplied field, sanitize on the way in. (See commit `67a5a57`.)
- **All user-facing strings go through `PetMessages`** — never hardcode English. Add the new key to the `PetMessages` interface, default it in `DEFAULT_PET_MESSAGES`, and call `messages.<key>` from the component.
- **All user-facing icons go through `PetIcons`** — never import lucide/feather/etc. directly into a component. Add the slot to `PetIcons`, default it in `DEFAULT_PET_ICONS`, consume via the icons prop / context.
- **`core/` and `widget/` must not import React.** The IIFE bundle has to stay framework-free. If you find yourself wanting to share JSX, the answer is "lift the logic into `core/` as plain TS and re-shape it from React separately."
- **No new peer dependencies.** React 18+ is the only one. Adding another peer is a major design decision — open an issue first.
- **Use `setState` for persistent moods, `play` for one-shots.** They're not interchangeable. `play()` auto-reverts to whatever the last `setState` was; `setState()` while a `play` is in flight cancels the auto-revert. Don't paper over this with timeouts.
- **Multi-pet code path matters.** `window.AgentPet` is a registry that forwards singleton calls (`setState`, `say`, `configure`, ...) to a `'main'` pet. When adding a new singleton method, also wire it through the registry — see existing methods in `src/widget/registry.ts` for the pattern.
- **`PetSettings` is the i18n + custom-catalog seam.** Don't fork the component to add a translation or a new pet source. Use `messages`, `icons`, and `composeCatalogs([...])` instead. See README *Pluggable PetSettings* for the contract.

## Where to add things

| Adding... | Goes in | Notes |
|---|---|---|
| New `PetState` value | `src/core/types.ts` + `src/core/adapters/default.ts` | Map to an atlas row. Update README state table. |
| New pet source provider | `src/core/providers/<name>.ts` | Implement the `PetProvider` shape; keep dependencies zero. ~50 LOC. |
| New script-tag attribute | `src/widget/index.ts` (parsing) + README *Script-tag attributes* | Sanitize values. Document the default. |
| New React component | `src/react/` | Don't touch `core/` or `widget/`. Forward `messages`/`icons`/CSS-vars props. |
| New unit test | colocate as `*.test.ts` next to the code it tests | vitest, no separate `__tests__/` folder. |

## PR / commit style

- Conventional-commits prefix: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `security`. Scope optional but useful (`fix(security):`, `fix(types):`).
- One-line subject ≤ 72 chars; body explains *why*, not *what*. Example: `fix(security): sanitize imageUrl/link/accent at trust boundaries (v0.8.4)`.
- Pre-PR checklist (also in `CONTRIBUTING.md`):
  - `pnpm typecheck` passes
  - `pnpm test` passes
  - `pnpm build` produces all three artifacts without warnings
  - IIFE gzip still under 15 KB (CI checks this — `gzip -c dist/agent-pet-widget.iife.js | wc -c`)
  - Public-API change → `agent-pet` and `agent-pet/widget` exports both updated
  - User-facing strings → `PetMessages`. User-facing icons → `PetIcons`.
  - `CHANGELOG.md` entry added under an unreleased heading or the next version

## Out of scope

Things that look reasonable but aren't:

- Adding a default spritesheet to the bundle.
- Adding a build step that fetches sprites at install time.
- Adding analytics, scroll-tracking, or keystroke logging to the observers.
- Replacing the vanilla-DOM widget with a tiny framework runtime "just for this".
- Mutating `/v0.X/` CDN paths after release. Cut a new version instead.

When in doubt, [open an issue](https://github.com/gibbon/agent-pet/issues) before writing code — see the *What to contribute* table in `CONTRIBUTING.md`.
