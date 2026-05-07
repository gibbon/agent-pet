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
export type PetInteraction = 'idle' | 'hover' | 'drag-right' | 'drag-left' | 'drag-up' | 'drag-down' | 'waiting' | 'working' | 'sending' | 'leaving' | 'excited' | 'failed' | 'greeting' | 'thinking';
export interface PetAdapter {
    map(hostState: string, hostMood?: string): PetInteraction;
}
export interface PetStore {
    load(): Promise<PetConfig | null>;
    save(pet: PetConfig): Promise<void>;
}
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
    fetchList(): Promise<{
        pets: CatalogPet[];
        rootDir?: string;
    }>;
    sync(source?: 'petshare' | 'hatchery' | 'all'): Promise<CatalogSyncResult>;
}
export declare class LocalStoragePetStore implements PetStore {
    private key;
    constructor(key?: string);
    load(): Promise<PetConfig | null>;
    save(pet: PetConfig): Promise<void>;
}
export interface PetLibraryEntry {
    id: string;
    adoptedAt: number;
    custom: PetCustom;
}
export declare class LocalStoragePetLibrary {
    load(): PetLibraryEntry[];
    save(entries: PetLibraryEntry[]): void;
    add(entry: PetLibraryEntry): void;
    remove(id: string): void;
}
export declare class DefaultCatalogClient implements CatalogClient {
    fetchList(): Promise<{
        pets: CatalogPet[];
        rootDir?: string;
    }>;
    sync(): Promise<CatalogSyncResult>;
    private fetchPetshare;
    private fetchHatchery;
}
