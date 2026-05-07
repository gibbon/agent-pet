// codex-pets.net provider. Ships the spritesheet host migration baked in
// — if codex-pets.net rolls their URL pattern again, we update one line
// here rather than hunting through src/ for hardcoded constants.

import type { CatalogPet } from '../types';
import type { PetProvider } from './types';

const ASSETS_BASE = 'https://codex-pets.net/assets/pets';
const API_BASE = 'https://codex-pets.net/api/pets';

interface CodexPetshareEntry {
  id?: string;
  displayName?: string;
  description?: string;
  spritesheetPath?: string;
  spritesheetUrl?: string;
}

export const codexProvider: PetProvider = {
  id: 'codex',
  label: 'Codex Pets',
  attribution: 'codex-pets.net',
  useCodexAtlas: true,

  resolveSpritesheet(petId: string): string {
    return `${ASSETS_BASE}/${encodeURIComponent(petId)}/spritesheet.webp`;
  },

  async fetchPets(opts: { count?: number } = {}): Promise<CatalogPet[]> {
    const count = Math.max(1, Math.min(200, opts.count ?? 50));
    const resp = await fetch(`${API_BASE}?count=${count}`);
    if (!resp.ok) return [];
    const data = (await resp.json()) as { pets?: CodexPetshareEntry[] };
    return (data.pets ?? [])
      .map<CatalogPet>((p) => ({
        id: String(p.id ?? ''),
        displayName: String(p.displayName ?? p.id ?? ''),
        description: p.description,
        spritesheetUrl: p.spritesheetUrl ?? `${ASSETS_BASE}/${p.id}/spritesheet.webp`,
        bundled: false,
      }))
      .filter((p) => p.id && p.spritesheetUrl);
  },
};
