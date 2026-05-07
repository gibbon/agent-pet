# Changelog

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

**Use case:** open-design (and similar deeply-integrated apps) can now plug their daemon-discovered pets, proprietary sync, and i18n into agent-pet's PetSettings rather than maintain their own ~1000-LOC UI. Estimated migration cost from custom-built to agent-pet wrapper: ~200 LOC of adapter code.

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
