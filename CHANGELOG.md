# Changelog

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
