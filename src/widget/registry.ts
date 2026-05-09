// Multi-pet registry. Wraps createAgentPetAPI() so window.AgentPet behaves
// like a single AgentPetAPI for backward compatibility (setState/play/say
// etc operate on a 'main' pet) AND exposes create/get/list/remove for
// managing multiple named pets on one page.

import { createAgentPetAPI, setRichRuntime } from './mount';
import { defaultProviderRegistry } from '../core/providers/registry';
import type {
  AgentPetAPI,
  AgentPetRegistry,
  ConfigureOptions,
  MountOptions,
  ObserveOptions,
  PetActionName,
  PetManifest,
  PlayOptions,
  RichRuntime,
  SayOptions,
  WidgetEventName,
} from './api';

/** Per-id default storageKey. The 'main' pet uses the legacy unsuffixed key
 *  for back-compat with existing localStorage entries. Named pets get a
 *  suffix so they don't collide. */
function defaultStorageKeyFor(id: string): string {
  return id === 'main' ? 'agent-pet:config' : `agent-pet:config:${id}`;
}

export function createRegistry(): AgentPetRegistry {
  const pets = new Map<string, AgentPetAPI>();

  // Lazy-initialise the main pet on first access. This way merely importing
  // the IIFE doesn't allocate an unused pet — it boots when the user calls
  // setState() / mount() / etc.
  function ensureMain(): AgentPetAPI {
    let p = pets.get('main');
    if (!p) {
      p = createAgentPetAPI();
      pets.set('main', p);
    }
    return p;
  }

  const registry: AgentPetRegistry = {
    // ── Singleton convenience: forward to 'main' ─────────────────
    setState: (s: PetActionName) => ensureMain().setState(s),
    play: (a: PetActionName, o?: PlayOptions) => ensureMain().play(a, o),
    say: (t: string, o?: SayOptions) => ensureMain().say(t, o),
    configure: (o: ConfigureOptions) => ensureMain().configure(o),
    loadManifest: (s: PetManifest | string) => ensureMain().loadManifest(s),
    observe: (o: ObserveOptions) => ensureMain().observe(o),
    on: (e: WidgetEventName, h: (...args: unknown[]) => void) => ensureMain().on(e, h),
    off: (e: WidgetEventName, h: (...args: unknown[]) => void) => ensureMain().off(e, h),
    mount: (o?: MountOptions) => ensureMain().mount(o),
    unmount: () => pets.get('main')?.unmount(),
    get mounted() {
      return pets.get('main')?.mounted ?? false;
    },
    hide: () => ensureMain().hide(),
    show: () => ensureMain().show(),
    toggle: () => ensureMain().toggle(),
    get hidden() {
      return pets.get('main')?.hidden ?? false;
    },

    // ── Multi-pet API ────────────────────────────────────────────
    create(id: string, opts?: MountOptions): AgentPetAPI {
      const existing = pets.get(id);
      if (existing) return existing;
      const p = createAgentPetAPI();
      pets.set(id, p);
      const finalOpts: MountOptions = {
        ...opts,
        storageKey: opts?.storageKey ?? defaultStorageKeyFor(id),
      };
      p.mount(finalOpts);
      return p;
    },
    get(id: string): AgentPetAPI | undefined {
      return pets.get(id);
    },
    has(id: string): boolean {
      return pets.has(id);
    },
    list(): string[] {
      return [...pets.keys()];
    },
    remove(id: string): void {
      const p = pets.get(id);
      if (p) {
        p.unmount();
        pets.delete(id);
      }
    },
    // Pet source providers (codex-pets.net, j20 hatchery, custom).
    providers: defaultProviderRegistry,

    // ── Rich runtime registration ──────────────────────────────
    // Called by the lazy-loaded rich addon's IIFE entry. The addon
    // bundle runs as a top-level script and grabs window.AgentPet to
    // call this. Once set, any pet whose manifest declares richActions
    // routes its play(name) calls through the registered impl.
    registerRichRuntime: (impl: RichRuntime) => setRichRuntime(impl),
  };

  return registry;
}
