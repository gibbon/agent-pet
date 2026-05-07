import { PetAtlasLayout } from './types';
export declare const CODEX_ATLAS_COLS = 8;
export declare const CODEX_ATLAS_ROWS = 9;
export declare const CODEX_CELL_WIDTH = 192;
export declare const CODEX_CELL_HEIGHT = 208;
export declare const CODEX_ATLAS_WIDTH: number;
export declare const CODEX_ATLAS_HEIGHT: number;
export declare const CODEX_ATLAS_ASPECT: number;
export interface CodexAtlasRow {
    index: number;
    id: 'idle' | 'running-right' | 'running-left' | 'waving' | 'jumping' | 'failed' | 'waiting' | 'running' | 'review';
    frames: number;
    fps: number;
}
export declare const CODEX_ATLAS_ROWS_DEF: CodexAtlasRow[];
export declare const CODEX_ATLAS_LAYOUT: PetAtlasLayout;
export declare function looksLikeCodexAtlas(width: number, height: number): boolean;
export interface RawAtlasImage {
    dataUrl: string;
    width: number;
    height: number;
}
export declare function loadAtlasImageFromFile(file: File): Promise<RawAtlasImage>;
export interface CropAtlasOptions {
    rowIndex: number;
    cols?: number;
    rows?: number;
    frames?: number;
    maxCellHeight?: number | null;
}
export interface CroppedAtlasRow {
    dataUrl: string;
    width: number;
    height: number;
    frames: number;
}
export declare function cropAtlasRow(dataUrl: string, options: CropAtlasOptions): Promise<CroppedAtlasRow>;
export interface PreparedAtlas {
    dataUrl: string;
    width: number;
    height: number;
    layout: PetAtlasLayout;
}
export declare function prepareCodexAtlas(sourceDataUrl: string, options?: {
    maxCellHeight?: number | null;
}): Promise<PreparedAtlas>;
