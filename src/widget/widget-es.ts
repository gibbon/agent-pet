// ES-module entry for non-React framework consumers (Svelte, Vue, Solid,
// Angular, vanilla JS). Bundled by Vite with Preact aliased internally, so
// importing this gives you a working pet factory with NO React peer dep —
// just call createAgentPetAPI() and mount it where you want.
//
//   import { createAgentPetAPI } from 'agent-pet/widget';
//   const pet = createAgentPetAPI();
//   pet.mount({ name: 'Rex', imageUrl: '...', useCodexAtlas: true });
//   pet.setState('thinking');

export { createAgentPetAPI } from './mount';
export type {
  AgentPetAPI,
  WidgetState,
  WidgetEventName,
  ConfigureOptions,
  MountOptions,
  PlayOptions,
  SayOptions,
  PetAtlasLayout,
  PetAtlasRowDef,
} from './api';
