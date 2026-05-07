// Typed accessor for the IIFE-installed `window.AgentPet`. Any framework
// (Svelte, Vue, Solid, Angular, vanilla) can call this to get a fully-typed
// AgentPetAPI without resorting to `(window as any).AgentPet`.

import type { AgentPetAPI } from '../widget/api';

declare global {
  interface Window {
    AgentPet?: AgentPetAPI;
  }
}

/**
 * Returns the AgentPet singleton attached to the window by the IIFE bundle.
 * Throws if the script tag hasn't loaded yet, or if running in SSR.
 */
export function getAgentPet(): AgentPetAPI {
  if (typeof window === 'undefined') {
    throw new Error('agent-pet: not available in server-side rendering');
  }
  if (!window.AgentPet) {
    throw new Error(
      'agent-pet: window.AgentPet is not loaded — include the agent-pet-widget.iife.js script tag before calling getAgentPet()',
    );
  }
  return window.AgentPet;
}

/** Non-throwing readiness check — useful in SSR-aware code. */
export function isAgentPetReady(): boolean {
  return typeof window !== 'undefined' && Boolean(window.AgentPet);
}
