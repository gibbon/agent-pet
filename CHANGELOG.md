# Changelog

## v0.10.0 — Rich runtime: lazy-loaded addon for fancy pets

Adds an opt-in **rich runtime** that consumers' bundles only download when they actually want it. The base widget stays at ~12 KB gzip; pets that declare `runtime: "rich"` in their manifest trigger a script-tag injection of the separate `agent-pet-rich.iife.js` bundle (~2.5 KB gzip), which registers itself with the base widget and takes over `play()` for any action listed in the manifest's `richActions` map.

Designed so most pets pay nothing for features they don't use. A simple Ryu / Homelander / Patamon stays on the basic atlas-row renderer; a "fancy ultimate move" pet pulls in the addon on first `loadManifest()` of a rich manifest, and the bundle is browser-cached for any subsequent rich pet on the same site.

- **`PetManifest.runtime`** — `'basic'` (default) or `'rich'`. Setting to `'rich'` triggers the lazy import.
- **`PetManifest.richRuntimeUrl`** — optional CDN override; defaults to a sibling of the base bundle.
- **`PetManifest.richActions`** — stage-space named actions invokable via `play(name)` once the addon is loaded.
- **Schema (`core/manifest.ts`)** — `RichAction { tracks: RichTrack[], spawn: RichSpawn[], durationMs }`. Each `RichTrack` has its own atlas row + a keyframe timeline (`{ t, x, y, scaleX, scaleY, rotation, skewX, skewY, alpha, flipH, easing }`). Keyframes interpolate; `easing: "step"` gives discrete per-frame control.
- **Projectile path types** — `straight | parabolic | bezier (quadratic or cubic) | boomerang`. Path eval lives in the addon; control points are stage-space pixels relative to the pet anchor.
- **Particle emitters** — count + lifetime + velocity (with spread cone) + gravity + size/alpha interpolation + optional sprite. v0 uses DOM divs; can swap to canvas-2D if perf becomes an issue.
- **`AgentPet.registerRichRuntime(impl)`** — the contract the lazy-loaded addon uses to register. Consumers don't call this directly.

Bundle sizes:
- `agent-pet-widget.iife.js` 37.9 KB raw / **11.7 KB gzip** (up from 36.5 KB / 11.0 KB — well within the 15 KB ceiling)
- `agent-pet-rich.iife.js` 5.65 KB raw / **2.43 KB gzip** (separate, lazy-loaded only when needed)

Backwards compatible: pets without `runtime: "rich"` are untouched.

## v0.9.0 — Pet manifests: semantic actions + projectiles

Adds a manifest format that bundles a custom atlas with named actions and optional projectile spawns. Pets that ship a manifest can declare moves like `hadouken` (which fires a fireball that flies across the screen) or `shoryuken` (which extends the sprite well above its cell), invokable via `play('hadouken')` rather than being constrained to the original 9 `WidgetState`s and the Codex 8×9 layout.

- **`AgentPet.loadManifest(url|object)`** — fetches/parses a `pet.json`, applies its `imageUrl`, `atlas`, `actions`, and `stateMap` in one call. Manifest schema: `{ id, displayName, accent, spritesheet, atlas, actions, stateMap }`.
- **`actions`** — arbitrary action ids each with `{ row, loops, fps?, expandUp?, expandDown?, spawn?, say? }`. `play(name)` invokes them; `setState(name)` works too if the action is referenced by `stateMap`.
- **`stateMap`** — remaps the original 9 `WidgetState`s (`thinking`, `building`, …) to manifest action ids, so consumer code that does `setState('thinking')` keeps working but plays whatever the manifest defines.
- **`spawn` / projectiles** — each spawn entry creates a fixed-positioned DOM element at the pet's anchor that translates `dx/dy` over `durationMs` while looping its own atlas row, then removes itself. Lives outside the pet's bounding box so it can fly across the whole page.
- **`expandUp` / `expandDown`** — temporarily scale the sprite anchored at bottom-center for moves that extend beyond the cell (e.g. SHORYUKEN). Reverts when the action ends.

Backwards compatible. Pets without a manifest behave exactly as before. `setState`/`play` now accept any `string`, so manifest action names work without the type system having to know about them.

Bundle: IIFE 36.5 KB raw / 11.0 KB gzip (under the 15 KB ceiling).

## v0.8.7 — Fix: sprite invisible on first mount with `data-image-url`

Patch release. Mounting via `<script data-image-url="…" data-use-codex-atlas>` (or any path that supplied `imageUrl` / `atlas` / `useCodexAtlas` to the initial `mount()`) wrote the new config to `localStorage` correctly but the overlay never received it, so `resolveActivePet()` returned `null` and the sprite stayed in `'empty'` mode — the host element mounted but rendered nothing.

Cause: `mount()` called `api.configure(opts)` to persist the new config, which dispatches `agent-pet:config-changed`. The listener that pulls the config back into the overlay was attached *after* that call, so the very event meant to seed the initial render fired into a void.

Fix: in `mount.ts`, always call `reloadConfigFromStorage()` after the configure path, not only on the no-opts branch. One-line change; no public API impact.

## v0.8.6 — Fix: type declarations resolve under exports map again

Patch release. v0.8.5 shipped `.d.ts` files under `dist/src/**` while `package.json` `exports` declared them at `dist/index.d.ts` and `dist/widget/widget-es.d.ts`. TypeScript consumers got `Could not find a declaration file for module 'agent-pet'` (implicit `any`). Caused by the `vite` 6→8 / `typescript` 5→6 bump in v0.8.5: newer `vite-plugin-dts` started preserving the `src/` source root unless told otherwise.

Fix: pass `entryRoot: 'src'` to `dts(...)` in `vite.config.ts` so emitted `.d.ts` files flatten back to `dist/<area>/*.d.ts`, matching the `exports` map and the v0.7.0 layout. No source or API changes; rebuilding now produces the type tree consumers expect.

## v0.8.5 — Internal cleanup; dev deps bumped to current major lines

No behaviour changes for consumers — internal robustness and code-shape work that fell out of the v0.8.4 review.

- **`PetLibraryEntry.schemaVersion`.** Library entries now follow the same once-per-record migration discipline as `PetConfig`. Fixes a latent bug where a future migration that unconditionally rewrites `custom` would have caused a localStorage write on every page load. Also added an `Array.isArray()` guard so a corrupted library JSON value falls back to an empty list instead of throwing.
- **Bubble re-evaluates anchor on `window.resize`.** Portrait↔landscape rotates and window resizes now flip the bubble side correctly without waiting for the next state change.
- **Static bubble styles lifted to `pet.css`.** Removed ~14 lines of `cssText` rebuilds per `refreshBubble()` call. Accent colour and 20%-alpha box-shadow now derive from `--pet-accent` via `color-mix(in srgb, … 20%, transparent)`. Saves ~250 B in the IIFE bundle.
- **Pointer-drag handlers deduplicated.** Sprite and dock now share a single `attachDraggable()` helper that owns the ref/capture/threshold/clamping/`pointercancel`/multi-touch reentrance logic. Future drag fixes only land in one place.
- **Dev deps updated to current major lines:** `vite` 6 → 8, `@vitejs/plugin-react` 4 → 6, `typescript` 5 → 6. Required adding `src/css.d.ts` for TS 6's stricter side-effect import handling.

Bundle: IIFE 9.8 KB gzipped (no measurable change from 0.8.4 once you account for the helper offsetting the cssText savings).

## v0.8.4 — Security + a11y patch

Security findings from a code review, fixed at the boundary so every downstream interpolation is safe by construction.

- **CSS injection via `imageUrl` in dock** (high) — the dock's `background-image:url(${imageUrl})` interpolated raw; `sprite.ts` already used `JSON.stringify(imageUrl)` for the same job. Fixed to match. A hostile `data-image-url` could otherwise inject CSS into the widget's shadow DOM scope.
- **`javascript:` URL in speech-bubble link** (high) — `say({ link })` set `<a href>` with no scheme allowlist; clicking would execute attacker JS in the consumer's origin. Now validates the URL via `new URL()` and accepts only `http:`, `https:`, `mailto:`. Relative URLs still resolve correctly.
- **CSS injection via `accent`** (medium) — `accent` flows through ~10 cssText interpolations. Now sanitized once at the `setConfig` boundary against an allowlist of color forms (hex, named, rgb/rgba, hsl/hsla); falls back to default if rejected.
- **Pointer-event robustness** (medium) — added `pointercancel` listeners on sprite and dock so OS interruptions release pointer capture and clear drag refs cleanly. Added a reentrance guard so a second touch can't clobber the first finger's in-flight drag. Tap-action (bubble toggle / dock restore) now fires only on real `pointerup`, not on cancel.
- **Chat input a11y** (low) — added `role="search"` + `aria-label` to the chat form and `aria-label` to the input, so screen readers announce the field beyond the placeholder.

Migration: none — all changes are additive sanitization at existing seams. Apps with legitimate `imageUrl` / `accent` / `link` values are unaffected.

## v0.8.3 — Draggable dock + pet thumbnail in dock

The minimized dock is now draggable (touch + mouse), the same way as the main sprite. Tapping the dock still restores the pet; only a drag-then-release moves it. Position is saved to the same `${storageKey}:position` slot as the sprite, so when the pet returns it appears wherever the dock was last placed.

The dock also shows the active pet's first sprite cell instead of a generic 🐧 — same first-cell-of-spritesheet crop the catalog buttons use, so visitors can see at a glance which pet is hidden. Falls back to the pet's emoji glyph if no image is configured.

## v0.8.2 — Make pet draggable on mobile

The drag implementation already used pointer events (which support touch in spec), but mobile browsers were consuming the touch as a scroll gesture before our handlers saw it. Adding `touch-action: none` (plus `-webkit-touch-callout: none` to suppress the long-press preview on iOS) to the sprite restores drag on touch devices. Scope is limited to the sprite — the rest of the page scrolls and zooms normally.

## v0.8.1 — Bubble anchors to opposite side when pet is in left half

The overlay was a flex column with `align-items: flex-end`, so the speech bubble always extended leftward from the sprite's right edge. When the pet was dragged to the left side of the viewport, the bubble would overflow off-screen left and visually swallow the sprite — the sprite hadn't moved, but it appeared "under the left side of the dialog" because most of the bubble was off-screen.

Fix: pull the bubble out of the flex flow with `position: absolute` and flip its horizontal anchor based on which half of the viewport the sprite is in. Sprite stays put; bubble extends toward the side with more room.

## v0.8.0 — Hide/show + opt-in chat input

**Hide → minimized dock.** Users can now collapse the pet to a small clickable circle that survives reloads (state in `${storageKey}:hidden`). New "Hide" button next to "Dismiss" in the speech bubble. New API: `AgentPet.hide()`, `AgentPet.show()`, `AgentPet.toggle()`, `AgentPet.hidden`. New `visibility` event fires `{ visible: boolean }` on every transition.

**Opt-in chat input.** Adds a single-line input under the speech bubble that fires a `userMessage` event on Enter. The widget ships no chat UI beyond the input — message history, markdown, threading, etc. are consumer territory. Wire to any backend (LLM, helpdesk, custom) and call `say(reply)` to display responses.

```html
<script src=".../agent-pet-widget.iife.js" data-chat="true"></script>
<script>
  AgentPet.on('userMessage', async (text) => {
    const reply = await fetch('/api/chat', { method: 'POST', body: text }).then(r => r.text());
    AgentPet.say(reply);
  });
</script>
```

Or programmatically: `AgentPet.configure({ chat: true, chatPlaceholder: 'Ask me anything…' })`.

Bundle: IIFE +1.1 KB gzipped (8.4 → 9.5).

## v0.7.1 — localStorage migration for v0.6.1 supabase URL fix

The v0.6.1 source fix didn't help returning visitors: their `agent-pet:config` localStorage still held a `custom.imageUrl` pointing at the dead supabase host, and the demo page only seeds a fresh URL when localStorage is empty.

This release adds a one-shot migration that runs on every config/library load: if `imageUrl` contains `ihzwckyzfcuktrljwpha.supabase.co/storage/v1/object/public/pets`, it is rewritten to `codex-pets.net/assets/pets` and the migrated record is saved back. A new `schemaVersion` field on `PetConfig` (currently `2`) ensures the migration runs at most once per config.

Migration is applied in `LocalStoragePetStore.load()`, `LocalStoragePetLibrary.load()`, and the IIFE widget's internal `loadConfig()`. New exports from `agent-pet`: `migratePetConfig`, `migratePetCustom`, `CONFIG_SCHEMA_VERSION`.

## v0.7.0 — Pluggable pet source providers

codex-pets.net is no longer hardcoded. Pet sources are now registered providers, so the next time codex-pets.net rolls their URL pattern (or any other catalog moves), the fix is configuration, not a release.

**New `PetProvider` interface:**

```ts
interface PetProvider {
  id: string;                                              // 'codex', 'hatchery', 'mycorp', ...
  label?: string;                                          // shown in PetSettings
  resolveSpritesheet?(petId: string): string;              // sync URL — enables data-<id>-pet="..."
  fetchPets?(opts?: { count?: number }): Promise<CatalogPet[]>; // async catalog browsing
  useCodexAtlas?: boolean;
}
```

**Built-in providers (auto-registered):**
- `codexProvider` — codex-pets.net (sync URL + catalog API)
- `hatcheryProvider` — j20.nz/hatchery (catalog API only — j20 URLs aren't predictable from id)

**Custom providers:**

```js
AgentPet.providers.register({
  id: 'mycorp',
  label: 'Internal Pets',
  resolveSpritesheet: (id) => `https://my-cdn.example/pets/${id}.webp`,
  useCodexAtlas: true,
  async fetchPets() { /* return CatalogPet[] */ },
});
```

Once registered, `<script src="..." data-mycorp-pet="dragon">` works. The community tab in PetSettings auto-merges pets from every provider with `fetchPets()`.

**Migration off the hardcoded URL** that previously sat at three sites in the codebase. Now any provider URL change is a one-line update inside `src/core/providers/<id>.ts`, not a frantic search-and-replace across `src/widget/index.ts`, `src/core/types.ts`, and demo HTML.

**Public API additions** (npm consumers):
- `agent-pet/widget` exports `codexProvider`, `hatcheryProvider`, `defaultProviderRegistry`
- `agent-pet` (React subpath) re-exports the same plus `DefaultProviderRegistry`, `providerCatalogClient`, `PetProvider`, `PetProviderRegistry`

`DefaultCatalogClient` still exists as a thin alias over the registry — back-compat for v0.6 consumers, no behaviour change.

CDN: `/v0.7/agent-pet-widget.iife.js`. Older paths immutable.

## v0.6.1 — Fix: codex-pets.net storage migration

codex-pets.net moved their spritesheet storage and API away from Supabase to their own domain on 2026-05-08. The old supabase host stopped resolving, breaking `data-codex-pet="<id>"` and the petshare catalog fetch in every previously-shipped version of agent-pet.

**Fixed paths:**
- `data-codex-pet` resolver: `https://codex-pets.net/assets/pets/<id>/spritesheet.webp` (was `ihzwckyzfcuktrljwpha.supabase.co/storage/v1/object/public/pets/<id>/spritesheet.webp`)
- `DefaultCatalogClient` API: `https://codex-pets.net/api/pets?count=50` (was `…/petshare/list?page=1&pageSize=50`)
- Demo landing page + multi-pet example: same migration

Plus stale-metadata cleanup:
- Description in `package.json` now says ~7 KB gzip (was ~14 — left over from before the Preact→vanilla rewrite in v0.2)
- Keywords drop `preact`, add `vanilla-dom`

If you're pinned to `/v0.1/` through `/v0.6/` on the CDN, **you'll need to bump to `/v0.6.1/`** — the older immutable bundles still try to load from the dead Supabase host.

## v0.6.0 — Complete pluggability (full i18n + icons + CSS variables)

Closes the v0.5 plug-in story so deeply-integrated apps (e.g. apps with their own i18n, design system, and pet sources) can adopt agent-pet's PetSettings as their settings UI without forking.

**Complete `messages` coverage:**

Every user-facing string in `PetSettings` and `PetRail` now flows through the `PetMessages` contract — placeholders, tooltips, ARIA labels, hints, the lot. ~45 keys total. Missing keys still fall back to English defaults so consumers can translate at their own pace.

**`icons` prop override:**

```tsx
import { PetSettings, type PetIcons } from 'agent-pet';
import { Check, X, Download, Upload, Sparkle } from '@your-design/icons';

<PetSettings icons={{
  Check, Close: X, Download, Upload, Sparkles: Sparkle,
}} />
```

`PetIcons` covers all 12 icon slots used by PetSettings + PetRail. Drop in your own React components matching `(props: { size?: number, style?: CSSProperties }) => JSX`. Defaults exported as `DEFAULT_PET_ICONS`.

**CSS custom properties for theming:**

PetSettings inline styles now flow through CSS variables with sensible dark-theme defaults. Override in your stylesheet:

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

**Outcome:** apps with deep i18n / design-system / pet-source customisation (e.g. ones already maintaining their own complex PetSettings UI) can wrap agent-pet's PetSettings in ~150 LOC of adapter glue rather than forking the whole thing.

CDN: `/v0.6/agent-pet-widget.iife.js`. Older paths immutable.

## v0.5.0 — Pluggable PetSettings (i18n + catalog compose)

Extension points so app-integrators can replace agent-pet's PetSettings UI surface via configuration rather than copy-pasting the source.

**i18n via `messages` prop:**
```tsx
import { type PetMessages } from 'agent-pet';

<PetSettings messages={{ adopt: t('pet.adopt'), customizePet: t('pet.customize') }} />
```

`PetMessages` covers all user-facing strings in PetSettings + PetRail. Any omitted key falls back to the English default — translate one string at a time, no need to ship a full locale.

Defaults exported as `DEFAULT_PET_MESSAGES`. Helper: `mergeMessages(overrides)`.

**`composeCatalogs([...])` helper:**
```ts
import { composeCatalogs, DefaultCatalogClient } from 'agent-pet';

const merged = composeCatalogs([
  daemonCatalog,                     // local pets — highest priority
  privateOrgCatalog,                 // org-private hosted catalog
  new DefaultCatalogClient(),        // public community fallback
]);
<PetProvider catalog={merged}>...</PetProvider>
```

Pets from earlier clients win on id collision; both `fetchList()` and `sync()` aggregate across sources.

**Use case:** apps that already maintain their own daemon-discovered pets, proprietary sync, or i18n setup can wire those into agent-pet's PetSettings via these plug-points. ~200 LOC of adapter glue covers the typical i18n + multi-source case.

CDN: `/v0.5/agent-pet-widget.iife.js`. Older paths immutable.

## v0.4.0 — Page event observers

Opt-in DOM event listeners that wire common page activity to pet state changes — no host JavaScript required.

**New API:**
- `AgentPet.observe({ formSubmit, formError, pageLoad, pageLeave, externalLink })`
- Each observer accepts a `WidgetState` (e.g. `'thinking'`, `'success'`) or `false` to disable.
- Pass `{}` to clear all observers.

**Script-tag shorthand:**
```html
<script src="..." data-observe="forms,nav"></script>
```

Keywords: `forms`, `nav`, `all`, plus individual observer names (`form-submit`, `page-load`, etc.).

**Privacy stance:** observers only fire on events the user actively triggers (submit, click, navigate). No keystroke logging, scroll tracking, or analytics-style observation.

CDN: `/v0.4/agent-pet-widget.iife.js`. Old paths immutable.

## v0.3.0 — Multi-pet by id

Added a registry layer to `window.AgentPet` for managing multiple named pets on one page. Backward compatible — singleton methods (`setState`, `say`, `configure`, etc.) keep working and forward to a default `'main'` pet.

**New API:**
- `AgentPet.create(id, opts?)` — create + mount a named pet, returns its `AgentPetAPI`
- `AgentPet.get(id)` — look up a pet
- `AgentPet.has(id)` / `AgentPet.list()` — introspection
- `AgentPet.remove(id)` — unmount + forget

**Per-pet state isolation:**
- Each pet has its own `localStorage` entry (default key `agent-pet:config:<id>`)
- Each pet remembers its own dragged position
- Multiple pets can be mounted into different `target` elements

**ES module subpath** also exports `createRegistry()` for non-IIFE consumers.

CDN: pinned at `/v0.3/agent-pet-widget.iife.js`. Old `/v0.1/` and `/v0.2/` paths remain immutable.

## v0.2.0 — Vanilla DOM rewrite

Dropped React/Preact entirely from the widget builds. The renderer is now pure vanilla DOM — no framework runtime in the bundle.

**Bundle size win:**

| Build | Before | After |
|---|---|---|
| IIFE (raw) | 38 KB | **22 KB** |
| IIFE (gzip) | 14.5 KB | **6.7 KB** |
| ES module (gzip) | 16.3 KB | **7.7 KB** |

**Public API unchanged** — `setState`, `play`, `say`, `configure`, `mount`, `unmount`, `on`, `off`, `mounted`. No code changes required for existing consumers.

**Internals:**
- `src/widget/sprite.ts` — vanilla atlas frame stepper
- `src/widget/overlay.ts` — vanilla draggable overlay with speech bubble + ambient choreography
- `src/widget/mount.ts` — factory replacing the React-based `mount.tsx`
- vite.config.ts: widget builds drop `@vitejs/plugin-react` and the preact/compat alias

The npm React subpath (`agent-pet`) is untouched — `PetProvider`, `PetOverlay`, `PetSpriteFace`, `PetSettings`, `PetRail` still ship for React app consumers.

## v0.1.0 — Initial release

- IIFE bundle with `window.AgentPet` API (Preact-bundled internally)
- ES module subpaths for npm consumers (React + widget)
- 9 atlas-row states (`idle`, `thinking`, `building`, `delegating`, `leaving`, `greeting`, `waiting`, `success`, `error`)
- `data-codex-pet="<id>"` shorthand for codex-pets.net pets
- Speech bubbles with TTL queue + clickable links
- Draggable position with `localStorage` persistence
- Shadow DOM isolation
- SHA-384 SRI hashes published per release
- Versioned CDN paths (immutable + long cache)
- Custom atlas layouts via `configure({ atlas })`
- `pnpm vendor-pet` script for offline self-hosting
