import { createAgentPetAPI } from './mount';
import type { ConfigureOptions } from './api';

interface ScriptConfig extends ConfigureOptions {
  autoMount: boolean;
}

function readScriptConfig(): ScriptConfig {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[src*="agent-pet"]:last-of-type');
  if (!script) return { autoMount: true };
  return {
    name: script.dataset.name,
    glyph: script.dataset.glyph,
    accent: script.dataset.accent,
    imageUrl: script.dataset.imageUrl,
    storageKey: script.dataset.storageKey,
    // Presence of `data-use-codex-atlas` (with any value other than "false")
    // applies the standard 8×9 Codex layout to imageUrl. Bare attribute
    // (`data-use-codex-atlas`) reads as empty string, treated as truthy.
    useCodexAtlas: 'useCodexAtlas' in script.dataset && script.dataset.useCodexAtlas !== 'false',
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
