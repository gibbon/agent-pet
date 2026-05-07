import { ReactNode } from 'react';
import { PetAdapter, PetConfig, PetStore, CatalogClient } from '../core/types';
export declare const PET_CONFIG_CHANGED = "agent-pet:config-changed";
interface PetContextValue {
    pet: PetConfig;
    setPet: (pet: PetConfig) => void;
    store: PetStore;
    catalog: CatalogClient;
    adapter: PetAdapter;
}
interface PetProviderProps {
    children: ReactNode;
    store?: PetStore;
    catalog?: CatalogClient;
    adapter?: PetAdapter;
    storageKey?: string;
}
export declare function PetProvider({ children, store, catalog, adapter, storageKey }: PetProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function usePetContext(): PetContextValue;
export {};
