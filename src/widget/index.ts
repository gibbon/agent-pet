import { createAgentPetAPI } from './mount';
import type { ConfigureOptions } from './api';

interface ScriptConfig extends ConfigureOptions {
  autoMount: boolean;
}

// codex-pets.net storage path — `data-codex-pet="<id>"` resolves to
// `<CODEX_STORAGE>/<id>/spritesheet.webp` and auto-applies the Codex atlas.
const CODEX_STORAGE = 'https://ihzwckyzfcuktrljwpha.supabase.co/storage/v1/object/public/pets';

function readScriptConfig(): ScriptConfig {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[src*="agent-pet"]:last-of-type');
  if (!script) return { autoMount: true };

  // data-codex-pet: shorthand for an animated codex-pets.net pet. Resolves
  // the spritesheet URL + auto-applies useCodexAtlas. data-image-url and
  // data-use-codex-atlas can still be set explicitly to override.
  const codexPetId = script.dataset.codexPet;
  const explicitImageUrl = script.dataset.imageUrl;
  const explicitUseAtlas = 'useCodexAtlas' in script.dataset && script.dataset.useCodexAtlas !== 'false';

  return {
    name: script.dataset.name ?? codexPetId,
    glyph: script.dataset.glyph,
    accent: script.dataset.accent,
    imageUrl: explicitImageUrl ?? (codexPetId ? `${CODEX_STORAGE}/${codexPetId}/spritesheet.webp` : undefined),
    storageKey: script.dataset.storageKey,
    useCodexAtlas: explicitUseAtlas || Boolean(codexPetId),
    autoMount: script.dataset.autoMount !== 'false',
  };
}

function boot(): void {
  if (typeof window === 'undefined') return;
  const win = window as unknown as Record<string, unknown>;
  if (win.AgentPet) return;

  const api = createAgentPetAPI();
  win.AgentPet = api;

  const config = readScriptConfig();
  if (config.autoMount) {
    const { autoMount: _omit, ...mountOpts } = config;
    api.mount(mountOpts);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
