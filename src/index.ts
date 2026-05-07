// Vite extracts this CSS to dist/pet.css; consumers import it via
// `import 'agent-pet/css'` to get the keyframes that drive PetOverlay's
// non-atlas float/bounce/sway animations.
import './react/pet.css';

// ── React components ─────────────────────────────────────────────────
export { PetProvider, usePetContext, PET_CONFIG_CHANGED } from './react/context';
export { PetOverlay } from './react/PetOverlay';
export { PetSpriteFace } from './react/PetSpriteFace';
export { PetSettings } from './react/PetSettings';
export { PetRail } from './react/PetRail';

// ── Core logic, types, atlas helpers, providers ──────────────────────
// (composeCatalogs, codexProvider, hatcheryProvider, defaultProviderRegistry,
//  DefaultCatalogClient, atlas/image helpers, all types — re-exported here.)
export * from './core/index';

// ── PetSettings extension contracts ──────────────────────────────────
export { DEFAULT_PET_MESSAGES, mergeMessages, type PetMessages } from './react/messages';
export { DEFAULT_PET_ICONS, mergeIcons, type PetIcons, type IconComponent, type IconProps } from './react/icon-set';

// ── Widget API types ─────────────────────────────────────────────────
// For non-React frameworks driving window.AgentPet via getAgentPet().
export type {
  AgentPetAPI,
  AgentPetRegistry,
  WidgetState,
  WidgetEventName,
  ConfigureOptions,
  MountOptions,
  PlayOptions,
  SayOptions,
  ObserveOptions,
} from './widget/api';
export { getAgentPet, isAgentPetReady } from './shared/global';
