// Pet source provider interface. A provider knows how to resolve a pet by
// id (synchronously, for `data-<id>-pet="<petId>"` script-tag shorthand)
// and/or how to list its catalog of pets (asynchronously, for the
// community tab in PetSettings).
//
// Providers replace what was previously a hardcoded codex-pets.net URL.
// Built-ins (`codex`, `hatchery`) ship with the package; consumers can
// register custom providers — e.g. an internal company pet host — and
// they're picked up automatically by the script-tag attribute parser
// and the PetSettings community tab.

import type { CatalogPet } from '../types';

export interface PetProvider {
  /** Lowercase identifier used in `data-<id>-pet="..."` attributes.
   *  Must match `[a-z][a-z0-9-]*` for HTML attribute compatibility. */
  id: string;

  /** Human-readable label for catalog UIs (PetSettings community tab). */
  label?: string;

  /** Optional credit/attribution shown alongside pets from this source. */
  attribution?: string;

  /** Synchronously resolve a pet id to a spritesheet URL. Required for
   *  `data-<id>-pet="..."` script-tag shorthand to work. Providers whose
   *  URLs require an async lookup (e.g. j20 hatchery, where each pet's
   *  url is in their list response) should omit this and rely on
   *  fetchPets() instead. */
  resolveSpritesheet?(petId: string): string;

  /** Default atlas mode for pets from this provider. Most use the
   *  standard Codex 8×9 layout. */
  useCodexAtlas?: boolean;

  /** Asynchronously list pets in the provider's catalog for browsing. */
  fetchPets?(opts?: { count?: number }): Promise<CatalogPet[]>;
}

/** Registry contract — manages a set of providers + lookups. */
export interface PetProviderRegistry {
  register(provider: PetProvider): void;
  unregister(id: string): boolean;
  get(id: string): PetProvider | undefined;
  has(id: string): boolean;
  list(): PetProvider[];
}
