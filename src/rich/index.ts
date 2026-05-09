// Rich runtime IIFE entry. Lazy-loaded by the base widget when a manifest
// declares `runtime: "rich"`. On script execution, registers itself with
// `window.AgentPet.registerRichRuntime(...)` so subsequent play() calls
// route through this module.

import { createRichRuntime } from './runtime';

if (typeof window !== 'undefined') {
  // window.AgentPet is the base widget's registry. If the base widget
  // hasn't loaded yet (rare — the base script-tag injects this), we wait
  // for the next microtask which is enough for the base IIFE to settle.
  const win = window as unknown as { AgentPet?: { registerRichRuntime?: (impl: unknown) => void } };
  const tryRegister = () => {
    if (win.AgentPet?.registerRichRuntime) {
      win.AgentPet.registerRichRuntime(createRichRuntime());
      return true;
    }
    return false;
  };
  if (!tryRegister()) {
    // One frame later — gives the base widget a chance to mount.
    requestAnimationFrame(() => {
      if (!tryRegister()) {
        console.warn('[agent-pet] rich runtime loaded but window.AgentPet not found');
      }
    });
  }
}
