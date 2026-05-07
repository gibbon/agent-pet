'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PetAdapter, PetConfig, PetStore, CatalogClient } from '../core/types';
import { LocalStoragePetStore, DefaultCatalogClient } from '../core/types';
import { DEFAULT_PET_CONFIG } from '../core/pets';
import { defaultPetAdapter } from '../core/adapters/default';

// Fired whenever any PetProvider saves, so sibling providers (e.g. the
// overlay in rdan-avatar vs the settings panel on /avatar) stay in sync.
export const PET_CONFIG_CHANGED = 'agent-pet:config-changed';

interface PetContextValue {
  pet: PetConfig;
  setPet: (pet: PetConfig) => void;
  store: PetStore;
  catalog: CatalogClient;
  adapter: PetAdapter;
}

const PetContext = createContext<PetContextValue | null>(null);

interface PetProviderProps {
  children: ReactNode;
  store?: PetStore;
  catalog?: CatalogClient;
  adapter?: PetAdapter;
  storageKey?: string;
}

export function PetProvider({ children, store, catalog, adapter, storageKey }: PetProviderProps) {
  // Stable instances — avoid recreating on every render.
  const resolvedStore = useMemo(() => store ?? new LocalStoragePetStore(storageKey), [store, storageKey]);
  const resolvedCatalog = useMemo(() => catalog ?? new DefaultCatalogClient(), [catalog]);
  const resolvedAdapter = useMemo(() => adapter ?? defaultPetAdapter, [adapter]);

  const [pet, setPetState] = useState<PetConfig>(DEFAULT_PET_CONFIG);

  useEffect(() => {
    void resolvedStore.load().then((saved) => {
      if (saved) setPetState(saved);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard: skip the reload triggered by our own dispatch.
  const selfWriteRef = useRef(false);

  // Re-read when any other PetProvider in the same tab saves a change.
  useEffect(() => {
    const reload = () => {
      if (selfWriteRef.current) { selfWriteRef.current = false; return; }
      void resolvedStore.load().then((saved) => { if (saved) setPetState(saved); });
    };
    window.addEventListener(PET_CONFIG_CHANGED, reload);
    return () => window.removeEventListener(PET_CONFIG_CHANGED, reload);
  }, [resolvedStore]);

  const setPet = useCallback((next: PetConfig) => {
    selfWriteRef.current = true;
    setPetState(next);
    void resolvedStore.save(next);
    window.dispatchEvent(new CustomEvent(PET_CONFIG_CHANGED));
  }, [resolvedStore]);

  return (
    <PetContext.Provider value={{ pet, setPet, store: resolvedStore, catalog: resolvedCatalog, adapter: resolvedAdapter }}>
      {children}
    </PetContext.Provider>
  );
}

export function usePetContext(): PetContextValue {
  const ctx = useContext(PetContext);
  if (!ctx) throw new Error('usePetContext must be used inside PetProvider');
  return ctx;
}
