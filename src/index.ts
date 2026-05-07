// CSS (injected by Vite's vite-plugin-css-injected-by-js in widget mode)
import './react/pet.css';

// React components + context
export { PetProvider, usePetContext, PET_CONFIG_CHANGED } from './react/context';
export { PetOverlay } from './react/PetOverlay';
export { PetSpriteFace } from './react/PetSpriteFace';
export { PetSettings } from './react/PetSettings';
export { PetRail } from './react/PetRail';

// Core logic and types
export * from './core/index';

// Widget API types — for non-React frameworks driving window.AgentPet via getAgentPet().
export type {
  AgentPetAPI,
  WidgetState,
  WidgetEventName,
  ConfigureOptions,
  MountOptions,
  PlayOptions,
  SayOptions,
} from './widget/api';
export { getAgentPet, isAgentPetReady } from './shared/global';
