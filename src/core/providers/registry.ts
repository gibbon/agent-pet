// Provider registry — manages registered PetProviders and exposes
// lookup helpers. The IIFE entry calls `defaultProviderRegistry.register()`
// for built-ins (codex, hatchery) on boot. Consumers call .register() to
// add their own.

import type { CatalogPet, CatalogClient, CatalogSyncResult } from '../types';
import type { PetProvider, PetProviderRegistry } from './types';

export class DefaultProviderRegistry implements PetProviderRegistry {
  private providers = new Map<string, PetProvider>();

  register(provider: PetProvider): void {
    if (!/^[a-z][a-z0-9-]*$/.test(provider.id)) {
      throw new Error(
        `agent-pet: provider id must match /^[a-z][a-z0-9-]*$/ to work as a data-<id>-pet attribute (got: ${provider.id})`,
      );
    }
    this.providers.set(provider.id, provider);
  }

  unregister(id: string): boolean {
    return this.providers.delete(id);
  }

  get(id: string): PetProvider | undefined {
    return this.providers.get(id);
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  list(): PetProvider[] {
    return [...this.providers.values()];
  }
}

/** Module-singleton registry used by the IIFE + ES widget builds. */
export const defaultProviderRegistry: DefaultProviderRegistry = new DefaultProviderRegistry();

/**
 * Build a CatalogClient that aggregates pets from every provider in the
 * registry that implements fetchPets(). Pets from earlier-registered
 * providers win on id collision.
 */
export function providerCatalogClient(registry: PetProviderRegistry): CatalogClient {
  return {
    async fetchList() {
      const providers = registry.list().filter((p) => typeof p.fetchPets === 'function');
      const results = await Promise.allSettled(
        providers.map((p) => p.fetchPets!()),
      );
      const seen = new Set<string>();
      const pets: CatalogPet[] = [];
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const pet of r.value) {
          if (seen.has(pet.id)) continue;
          seen.add(pet.id);
          pets.push(pet);
        }
      }
      return { pets };
    },

    async sync(): Promise<CatalogSyncResult> {
      // No server-side sync semantics for client-only providers; refreshing
      // the list is what callers want here.
      try {
        const { pets } = await this.fetchList();
        return { wrote: 0, total: pets.length };
      } catch (err) {
        return { wrote: 0, total: 0, error: err instanceof Error ? err.message : 'Sync failed' };
      }
    },
  };
}
