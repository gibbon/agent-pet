// Ported from nexu-io/open-design (Apache-2.0)
// https://github.com/nexu-io/open-design

// ── Atlas types ────────────────────────────────────────────────────────

export interface PetAtlasRowDef {
  index: number;
  id: string;
  frames: number;
  fps: number;
}

export interface PetAtlasLayout {
  cols: number;
  rows: number;
  rowsDef: PetAtlasRowDef[];
}

// ── Pet config ─────────────────────────────────────────────────────────

export interface PetCustom {
  name: string;
  glyph: string;
  accent: string;
  greeting: string;
  imageUrl?: string;
  frames?: number;
  fps?: number;
  atlas?: PetAtlasLayout;
}

export interface PetConfig {
  adopted: boolean;
  enabled: boolean;
  petId: string;
  custom: PetCustom;
}

export interface ResolvedPet {
  id: string;
  name: string;
  glyph: string;
  accent: string;
  greeting: string;
  animation: 'bounce' | 'sway' | 'float' | 'wiggle';
  imageUrl?: string;
  frames?: number;
  fps?: number;
  atlas?: PetAtlasLayout;
}

// ── Interaction states ─────────────────────────────────────────────────

export type PetInteraction =
  // Gesture / pointer states
  | 'idle'
  | 'hover'
  | 'drag-right'
  | 'drag-left'
  | 'drag-up'
  | 'drag-down'
  | 'waiting'
  // Named atlas-row states — map host state to these for richer animations
  | 'working'   // running row   — busy doing something
  | 'sending'   // running-right — delegating / dispatching
  | 'leaving'   // running-left  — going away / wrapping up
  | 'excited'   // jumping       — success / celebration
  | 'failed'    // failed row    — error state
  | 'greeting'  // waving row    — hello / welcome
  | 'thinking'; // review row    — deliberating / LLM thinking

// ── Adapter interface ──────────────────────────────────────────────────
// Maps any host state string to a PetInteraction. Implement this to wire
// the pet to your application's state model.

export interface PetAdapter {
  map(hostState: string, hostMood?: string): PetInteraction;
}

// ── Storage interface ──────────────────────────────────────────────────

export interface PetStore {
  load(): Promise<PetConfig | null>;
  save(pet: PetConfig): Promise<void>;
}

// ── Catalog interfaces ─────────────────────────────────────────────────

export interface CatalogPet {
  id: string;
  displayName: string;
  description?: string;
  spritesheetUrl: string;
  bundled?: boolean;
  tags?: string[];
}

export interface CatalogSyncResult {
  wrote: number;
  total: number;
  error?: string;
}

export interface CatalogClient {
  fetchList(): Promise<{ pets: CatalogPet[]; rootDir?: string }>;
  sync(source?: 'petshare' | 'hatchery' | 'all'): Promise<CatalogSyncResult>;
}

// ── Default implementations ────────────────────────────────────────────

const STORAGE_KEY = 'agent-pet:config';

export class LocalStoragePetStore implements PetStore {
  constructor(private key = STORAGE_KEY) {}

  async load(): Promise<PetConfig | null> {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw) as PetConfig;
    } catch {
      return null;
    }
  }

  async save(pet: PetConfig): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(this.key, JSON.stringify(pet));
    } catch {
      // localStorage unavailable
    }
  }
}

// ── Pet library ────────────────────────────────────────────────────────
// Tracks every pet the user has adopted (catalog or uploaded). Separate
// from PetConfig so switching between pets doesn't overwrite prior data.

export interface PetLibraryEntry {
  id: string;        // catalog ID or 'custom:<timestamp>' for uploaded pets
  adoptedAt: number;
  custom: PetCustom; // full config including imageUrl / atlas data
}

const LIBRARY_KEY = 'agent-pet:library';

export class LocalStoragePetLibrary {
  load(): PetLibraryEntry[] {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(window.localStorage.getItem(LIBRARY_KEY) ?? '[]') as PetLibraryEntry[]; }
    catch { return []; }
  }
  save(entries: PetLibraryEntry[]): void {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries)); } catch {}
  }
  add(entry: PetLibraryEntry): void {
    const lib = this.load();
    const idx = lib.findIndex(e => e.id === entry.id);
    if (idx >= 0) lib[idx] = entry; else lib.push(entry);
    this.save(lib);
  }
  remove(id: string): void { this.save(this.load().filter(e => e.id !== id)); }
}

// DefaultCatalogClient — back-compat alias that delegates to the provider
// registry. New code should import { providerCatalogClient } from
// './providers/registry' for the same behaviour with explicit registry
// passing.
import { defaultProviderRegistry, providerCatalogClient } from './providers/registry';
import { codexProvider } from './providers/codex';
import { hatcheryProvider } from './providers/hatchery';

// Pre-register built-in providers on first import.
if (!defaultProviderRegistry.has('codex')) defaultProviderRegistry.register(codexProvider);
if (!defaultProviderRegistry.has('hatchery')) defaultProviderRegistry.register(hatcheryProvider);

export class DefaultCatalogClient implements CatalogClient {
  private inner = providerCatalogClient(defaultProviderRegistry);
  async fetchList() { return this.inner.fetchList(); }
  async sync(source?: 'petshare' | 'hatchery' | 'all') { return this.inner.sync(source); }
}
