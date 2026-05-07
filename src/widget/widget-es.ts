// ES-module entry for non-React framework consumers (Svelte, Vue, Solid,
// Angular, vanilla JS). Vanilla DOM renderer, no framework runtime —
// importing this gives you a working pet factory with NO React peer dep.
//
//   import { createAgentPetAPI } from 'agent-pet/widget';
//   const pet = createAgentPetAPI();
//   pet.mount({ name: 'Rex', imageUrl: '...', useCodexAtlas: true });
//   pet.setState('thinking');
//
// For multi-pet apps:
//   import { createRegistry } from 'agent-pet/widget';
//   const registry = createRegistry();
//   registry.create('chat', { name: 'Chat' });

// ── Factories ────────────────────────────────────────────────────────
export { createAgentPetAPI } from './mount';
export { createRegistry } from './registry';

// ── Page event observer (data-observe="forms,nav" support) ───────────
export { attachObservers, parseObserveAttr, OBSERVE_DEFAULTS } from './observer';
export type { ObserveOptions } from './api';

// ── Pet source providers ─────────────────────────────────────────────
export type { PetProvider, PetProviderRegistry } from '../core/providers/types';
export { codexProvider } from '../core/providers/codex';
export { hatcheryProvider } from '../core/providers/hatchery';
export { defaultProviderRegistry, providerCatalogClient } from '../core/providers/registry';
export { composeCatalogs } from '../core/compose-catalogs';

// ── Widget API types ─────────────────────────────────────────────────
export type {
  AgentPetAPI,
  AgentPetRegistry,
  WidgetState,
  WidgetEventName,
  ConfigureOptions,
  MountOptions,
  PlayOptions,
  SayOptions,
  PetAtlasLayout,
  PetAtlasRowDef,
} from './api';
