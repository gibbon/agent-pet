// Ported from nexu-io/open-design (Apache-2.0)
// https://github.com/nexu-io/open-design
//
// Codex hatch-pet atlas helpers. The hatch-pet skill produces a fixed-shape
// spritesheet: 1536×1872 px, 8×9 grid of 192×208 cells, each row an animation.

import type { PetAtlasLayout, PetAtlasRowDef } from './types';

export const CODEX_ATLAS_COLS = 8;
export const CODEX_ATLAS_ROWS = 9;
export const CODEX_CELL_WIDTH = 192;
export const CODEX_CELL_HEIGHT = 208;
export const CODEX_ATLAS_WIDTH = CODEX_ATLAS_COLS * CODEX_CELL_WIDTH;
export const CODEX_ATLAS_HEIGHT = CODEX_ATLAS_ROWS * CODEX_CELL_HEIGHT;
export const CODEX_ATLAS_ASPECT = CODEX_ATLAS_WIDTH / CODEX_ATLAS_HEIGHT;

export interface CodexAtlasRow {
  index: number;
  id: 'idle' | 'running-right' | 'running-left' | 'waving' | 'jumping' | 'failed' | 'waiting' | 'running' | 'review';
  frames: number;
  fps: number;
}

export const CODEX_ATLAS_ROWS_DEF: CodexAtlasRow[] = [
  { index: 0, id: 'idle', frames: 6, fps: 6 },
  { index: 1, id: 'running-right', frames: 8, fps: 8 },
  { index: 2, id: 'running-left', frames: 8, fps: 8 },
  { index: 3, id: 'waving', frames: 4, fps: 6 },
  { index: 4, id: 'jumping', frames: 5, fps: 7 },
  { index: 5, id: 'failed', frames: 8, fps: 7 },
  { index: 6, id: 'waiting', frames: 6, fps: 6 },
  { index: 7, id: 'running', frames: 6, fps: 8 },
  { index: 8, id: 'review', frames: 6, fps: 6 },
];

export const CODEX_ATLAS_LAYOUT: PetAtlasLayout = {
  cols: CODEX_ATLAS_COLS,
  rows: CODEX_ATLAS_ROWS,
  rowsDef: CODEX_ATLAS_ROWS_DEF.map((row): PetAtlasRowDef => ({
    index: row.index,
    id: row.id,
    frames: row.frames,
    fps: row.fps,
  })),
};

export function looksLikeCodexAtlas(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  if (width <= 0 || height <= 0) return false;
  return Math.abs(width / height - CODEX_ATLAS_ASPECT) < 0.06;
}

export interface RawAtlasImage {
  dataUrl: string;
  width: number;
  height: number;
}

const ACCEPTED_TYPES = new Set(['image/png', 'image/webp', 'image/jpeg', 'image/gif']);

export async function loadAtlasImageFromFile(file: File): Promise<RawAtlasImage> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are supported.');
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error('Use a PNG, WebP, JPEG, or GIF spritesheet.');
  const dataUrl = await readFileAsDataUrl(file);
  const dims = await measureImage(dataUrl);
  return { dataUrl, width: dims.width, height: dims.height };
}

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

const DEFAULT_MAX_CELL_HEIGHT = 96;

export async function cropAtlasRow(dataUrl: string, options: CropAtlasOptions): Promise<CroppedAtlasRow> {
  const cols = Math.max(1, Math.floor(options.cols ?? CODEX_ATLAS_COLS));
  const rows = Math.max(1, Math.floor(options.rows ?? CODEX_ATLAS_ROWS));
  const rowIndex = Math.max(0, Math.min(rows - 1, Math.floor(options.rowIndex)));
  const def = CODEX_ATLAS_ROWS_DEF.find((r) => r.index === rowIndex);
  const frames = Math.max(1, Math.min(cols, Math.floor(options.frames ?? def?.frames ?? cols)));
  const maxCellHeight = options.maxCellHeight === null ? null : options.maxCellHeight ?? DEFAULT_MAX_CELL_HEIGHT;

  const img = await loadImage(dataUrl);
  const cellWidth = Math.floor(img.naturalWidth / cols);
  const cellHeight = Math.floor(img.naturalHeight / rows);
  if (cellWidth <= 0 || cellHeight <= 0) throw new Error('Atlas image is too small to crop.');

  const targetCellHeight = maxCellHeight && cellHeight > maxCellHeight ? maxCellHeight : cellHeight;
  const scale = targetCellHeight / cellHeight;
  const targetCellWidth = Math.max(1, Math.round(cellWidth * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetCellWidth * frames;
  canvas.height = targetCellHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable in this browser.');
  ctx.imageSmoothingEnabled = false;
  for (let f = 0; f < frames; f++) {
    ctx.drawImage(img, f * cellWidth, rowIndex * cellHeight, cellWidth, cellHeight, f * targetCellWidth, 0, targetCellWidth, targetCellHeight);
  }
  return { dataUrl: canvas.toDataURL('image/png'), width: targetCellWidth * frames, height: targetCellHeight, frames };
}

export interface PreparedAtlas {
  dataUrl: string;
  width: number;
  height: number;
  layout: PetAtlasLayout;
}

const DEFAULT_FULL_ATLAS_MAX_CELL = 80;

export async function prepareCodexAtlas(sourceDataUrl: string, options?: { maxCellHeight?: number | null }): Promise<PreparedAtlas> {
  const maxCellHeight = options?.maxCellHeight === null ? null : options?.maxCellHeight ?? DEFAULT_FULL_ATLAS_MAX_CELL;
  const img = await loadImage(sourceDataUrl);
  const cellWidth = Math.floor(img.naturalWidth / CODEX_ATLAS_COLS);
  const cellHeight = Math.floor(img.naturalHeight / CODEX_ATLAS_ROWS);
  if (cellWidth <= 0 || cellHeight <= 0) throw new Error('Atlas image is too small to slice.');

  const targetCellHeight = maxCellHeight && cellHeight > maxCellHeight ? maxCellHeight : cellHeight;
  const scale = targetCellHeight / cellHeight;
  const targetCellWidth = Math.max(1, Math.round(cellWidth * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetCellWidth * CODEX_ATLAS_COLS;
  canvas.height = targetCellHeight * CODEX_ATLAS_ROWS;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable in this browser.');
  ctx.imageSmoothingEnabled = false;
  for (let r = 0; r < CODEX_ATLAS_ROWS; r++) {
    for (let c = 0; c < CODEX_ATLAS_COLS; c++) {
      ctx.drawImage(img, c * cellWidth, r * cellHeight, cellWidth, cellHeight, c * targetCellWidth, r * targetCellHeight, targetCellWidth, targetCellHeight);
    }
  }
  return { dataUrl: canvas.toDataURL('image/png'), width: targetCellWidth * CODEX_ATLAS_COLS, height: targetCellHeight * CODEX_ATLAS_ROWS, layout: CODEX_ATLAS_LAYOUT };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') { reject(new Error('Could not decode the image.')); return; }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not load that image.'));
    img.src = dataUrl;
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load that image.'));
    img.src = dataUrl;
  });
}
