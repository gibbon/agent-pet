// Compose multiple CatalogClient implementations into one. Useful when an
// app wants to merge pet sources — e.g. a daemon scanning ~/.codex/pets/
// PLUS the community catalog from codex-pets.net PLUS a private hosted
// catalog. Each backing client is queried in parallel; pets from earlier
// clients in the list win on id collisions.
//
//   const merged = composeCatalogs([
//     daemonCatalog,        // local pets — highest priority
//     privateCatalog,       // org-private hosted catalog
//     new DefaultCatalogClient(), // public community fallback
//   ]);
//   <PetProvider catalog={merged}>...</PetProvider>

import type { CatalogClient, CatalogPet, CatalogSyncResult } from './types';

export function composeCatalogs(clients: readonly CatalogClient[]): CatalogClient {
  return {
    async fetchList() {
      const results = await Promise.allSettled(clients.map((c) => c.fetchList()));
      const seen = new Set<string>();
      const pets: CatalogPet[] = [];
      let rootDir: string | undefined;
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        rootDir = rootDir ?? r.value.rootDir;
        for (const p of r.value.pets) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          pets.push(p);
        }
      }
      return { pets, rootDir };
    },

    async sync(source) {
      // Each client gets the same `source` argument; the caller decides
      // semantics. Aggregate `wrote`/`total` and return the first error.
      const results = await Promise.allSettled(clients.map((c) => c.sync(source)));
      let wrote = 0;
      let total = 0;
      let error: string | undefined;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          wrote += r.value.wrote;
          total += r.value.total;
          if (!error && r.value.error) error = r.value.error;
        } else {
          if (!error) error = r.reason instanceof Error ? r.reason.message : String(r.reason);
        }
      }
      const result: CatalogSyncResult = { wrote, total };
      if (error) result.error = error;
      return result;
    },
  };
}
