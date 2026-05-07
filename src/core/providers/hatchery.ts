// j20.nz/hatchery/ provider. The hatchery's spritesheet URLs are
// per-pet Firebase Storage links embedded in their list response —
// they don't follow a predictable id-based pattern, so this provider
// can't resolve sync (no resolveSpritesheet implementation). For
// scripts that want to pick a hatchery pet by id, fetch the catalog
// first and then call AgentPet.configure({ imageUrl, useCodexAtlas: true }).

import type { CatalogPet } from '../types';
import type { PetProvider } from './types';

const HATCHERY_LIST = 'https://j20.nz/hatchery/api/pets.json';

interface HatcheryEntry {
  id?: string;
  petManifestId?: string;
  displayName?: string;
  description?: string;
  spritesheetUrl?: string;
}

export const hatcheryProvider: PetProvider = {
  id: 'hatchery',
  label: 'j20 Hatchery',
  attribution: 'j20.nz/hatchery',
  useCodexAtlas: true,

  // No resolveSpritesheet — j20 URLs come from the list response, not from id.

  async fetchPets(): Promise<CatalogPet[]> {
    const resp = await fetch(HATCHERY_LIST);
    if (!resp.ok) return [];
    const data = (await resp.json()) as { pets?: HatcheryEntry[] };
    return (data.pets ?? [])
      .map<CatalogPet>((p) => ({
        id: String(p.petManifestId ?? p.id ?? ''),
        displayName: String(p.displayName ?? p.id ?? ''),
        description: p.description,
        spritesheetUrl: String(p.spritesheetUrl ?? ''),
        bundled: false,
      }))
      .filter((p) => p.id && p.spritesheetUrl);
  },
};
