import { createRegistry } from './registry';
import { parseObserveAttr, type ObserveOptions } from './observer';
import { defaultProviderRegistry } from '../core/providers/registry';
import { codexProvider } from '../core/providers/codex';
import { hatcheryProvider } from '../core/providers/hatchery';
import type { ConfigureOptions } from './api';

// Built-in providers — pre-registered so `data-codex-pet="..."` and
// `data-hatchery-pet="..."` work out of the box. Consumers register
// custom ones via `AgentPet.providers.register({...})`.
if (!defaultProviderRegistry.has('codex')) defaultProviderRegistry.register(codexProvider);
if (!defaultProviderRegistry.has('hatchery')) defaultProviderRegistry.register(hatcheryProvider);

interface ScriptConfig extends ConfigureOptions {
  autoMount: boolean;
  observe?: ObserveOptions;
}

/**
 * Scan the script tag's data-* attributes for any `data-<id>-pet="<petId>"`
 * where `<id>` is a registered provider. Returns the first match's
 * resolved URL + atlas mode, or null if no provider attribute is set.
 */
function readProviderAttr(script: HTMLScriptElement): { imageUrl: string; useCodexAtlas: boolean; petId: string } | null {
  for (const provider of defaultProviderRegistry.list()) {
    const datasetKey = `${provider.id}Pet`; // 'codex' → 'codexPet', 'mycorp' → 'mycorpPet'
    const petId = script.dataset[datasetKey];
    if (petId && provider.resolveSpritesheet) {
      return {
        imageUrl: provider.resolveSpritesheet(petId),
        useCodexAtlas: provider.useCodexAtlas ?? false,
        petId,
      };
    }
  }
  return null;
}

function readScriptConfig(): ScriptConfig {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[src*="agent-pet"]:last-of-type');
  if (!script) return { autoMount: true };

  const provider = readProviderAttr(script);
  const explicitImageUrl = script.dataset.imageUrl;
  const explicitUseAtlas = 'useCodexAtlas' in script.dataset && script.dataset.useCodexAtlas !== 'false';

  const observe = parseObserveAttr(script.dataset.observe);

  return {
    name: script.dataset.name ?? provider?.petId,
    glyph: script.dataset.glyph,
    accent: script.dataset.accent,
    imageUrl: explicitImageUrl ?? provider?.imageUrl,
    storageKey: script.dataset.storageKey,
    useCodexAtlas: explicitUseAtlas || (provider?.useCodexAtlas ?? false),
    autoMount: script.dataset.autoMount !== 'false',
    observe: Object.keys(observe).length > 0 ? observe : undefined,
  };
}

function boot(): void {
  if (typeof window === 'undefined') return;
  const win = window as unknown as Record<string, unknown>;
  if (win.AgentPet) return;

  const registry = createRegistry();
  win.AgentPet = registry;

  const config = readScriptConfig();
  if (config.autoMount) {
    const { autoMount: _omit, observe, ...mountOpts } = config;
    registry.mount(mountOpts);
    if (observe) registry.observe(observe);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
