# agent-pet

Animated companion pet widget. Three integration paths:

## 1. npm (React/Preact apps)

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

## 2. Script tag (CDN — auto-mount)

```html
<script src="https://cdn.example.com/agent-pet-widget.iife.js"
        data-name="Rex" data-glyph="🦖"></script>
<script>AgentPet.setState('thinking');</script>
```

## 3. Self-hosted (programmatic — full control)

Download `agent-pet-widget.iife.js` and serve from your own host. The bundle
makes no calls back to any origin (catalog fetches are opt-in via the
Community tab in PetSettings only).

```html
<script src="/static/agent-pet-widget.iife.js" data-auto-mount="false"></script>
<script>
  AgentPet.mount({ target: document.getElementById('sidebar') });
  AgentPet.on('stateChange', (s) => console.log('→', s));
</script>
```

## API

- `AgentPet.setState('idle' | 'thinking' | 'building' | 'delegating' | 'success' | 'error')`
- `AgentPet.say(text, { ttl?, link? })`
- `AgentPet.configure({ name?, glyph?, accent?, imageUrl? })`
- `AgentPet.mount({ target?, ...config })` / `AgentPet.unmount()` / `AgentPet.mounted`
- `AgentPet.on(event, handler)` / `AgentPet.off(event, handler)`

## Examples

See `examples/` for working HTML pages demonstrating each integration path:
- `examples/auto-mount.html` — script tag with data-* attributes
- `examples/programmatic-mount.html` — manual `AgentPet.mount()`
- `examples/self-hosted/index.html` — vendored bundle, no remote requests

Serve locally: `npx serve . -p 5174` then open the example URLs.

## Build

```bash
pnpm install
pnpm build       # produces dist/agent-pet.js (ES) + dist/agent-pet-widget.iife.js (IIFE)
pnpm test        # vitest
```

## License

Apache-2.0. Ported from [nexu-io/open-design](https://github.com/nexu-io/open-design).
