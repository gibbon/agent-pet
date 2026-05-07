// Ported from nexu-io/open-design (Apache-2.0)
// https://github.com/nexu-io/open-design

import type { PetAtlasLayout, PetAtlasRowDef, PetConfig, PetCustom, PetInteraction, ResolvedPet } from './types';

export const CUSTOM_PET_ID = 'custom';
export const FRAMES_MIN = 1;
export const FRAMES_MAX = 24;
export const FPS_MIN = 1;
export const FPS_MAX = 30;

export const DEFAULT_PET_CONFIG: PetConfig = {
  adopted: false,
  enabled: true,
  petId: CUSTOM_PET_ID,
  custom: defaultCustomPet(),
};

export function defaultCustomPet(): PetCustom {
  return { name: 'Buddy', glyph: '🦄', accent: '#c96442', greeting: 'Hi! I am here whenever you need me.' };
}

export function resolveActivePet(pet: PetConfig | undefined): ResolvedPet | null {
  if (!pet?.adopted) return null;
  return resolveCustomPet(pet.custom);
}

function resolveCustomPet(c: PetCustom): ResolvedPet {
  return {
    id: CUSTOM_PET_ID,
    name: c.name?.trim() || 'Buddy',
    glyph: c.glyph?.trim() || '🦄',
    accent: c.accent?.trim() || '#c96442',
    greeting: c.greeting?.trim() || 'Hi! I am here whenever you need me.',
    animation: 'float',
    imageUrl: c.imageUrl,
    frames: clampFrames(c.frames),
    fps: clampFps(c.fps),
    atlas: sanitizeAtlas(c.atlas),
  };
}

function clampFrames(value: number | undefined): number {
  if (!Number.isFinite(value as number)) return 1;
  return Math.max(FRAMES_MIN, Math.min(FRAMES_MAX, Math.round(value as number)));
}

function clampFps(value: number | undefined): number {
  if (!Number.isFinite(value as number)) return 6;
  return Math.max(FPS_MIN, Math.min(FPS_MAX, Math.round(value as number)));
}

function sanitizeAtlas(input: PetAtlasLayout | undefined): PetAtlasLayout | undefined {
  if (!input) return undefined;
  const cols = Math.max(1, Math.floor(input.cols));
  const rows = Math.max(1, Math.floor(input.rows));
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return undefined;
  const seen = new Set<number>();
  const rowsDef: PetAtlasRowDef[] = [];
  for (const row of input.rowsDef ?? []) {
    if (!row || typeof row.id !== 'string' || !row.id.trim()) continue;
    const index = Math.floor(row.index);
    if (!Number.isFinite(index) || index < 0 || index >= rows || seen.has(index)) continue;
    seen.add(index);
    rowsDef.push({ index, id: row.id.trim(), frames: Math.max(1, Math.min(cols, Math.floor(row.frames) || 1)), fps: Math.max(FPS_MIN, Math.min(FPS_MAX, Math.floor(row.fps) || 6)) });
  }
  if (rowsDef.length === 0) return undefined;
  return { cols, rows, rowsDef: rowsDef.sort((a, b) => a.index - b.index) };
}

const INTERACTION_ROW_ID: Record<PetInteraction, string> = {
  // Gesture / pointer states
  idle:         'idle',
  hover:        'waving',
  'drag-right': 'running-right',
  'drag-left':  'running-left',
  'drag-up':    'jumping',
  'drag-down':  'waving',
  waiting:      'waiting',
  // Named host-state mappings → specific atlas rows
  working:      'running',
  sending:      'running-right',
  excited:      'jumping',
  failed:       'failed',
  thinking:     'review',
};

const ROW_FALLBACK_ORDER: readonly string[] = ['idle', 'waiting', 'waving', 'running', 'running-right'];

export function preferredRowId(state: PetInteraction): string {
  return INTERACTION_ROW_ID[state];
}

export function pickAtlasRow(layout: PetAtlasLayout | undefined, preferred: string): PetAtlasRowDef | undefined {
  if (!layout || layout.rowsDef.length === 0) return undefined;
  const direct = layout.rowsDef.find((r) => r.id === preferred);
  if (direct) return direct;
  for (const id of ROW_FALLBACK_ORDER) {
    const fallback = layout.rowsDef.find((r) => r.id === id);
    if (fallback) return fallback;
  }
  return layout.rowsDef[0];
}

const AMBIENT_ROW_POOL: readonly string[] = ['waving', 'review', 'jumping', 'running', 'running-right', 'running-left'];

export function pickAmbientRow(layout: PetAtlasLayout | undefined, avoidId?: string): PetAtlasRowDef | null {
  if (!layout || layout.rowsDef.length === 0) return null;
  const pool = layout.rowsDef.filter((r) => AMBIENT_ROW_POOL.includes(r.id));
  if (pool.length === 0) return null;
  const candidates = pool.length > 1 && avoidId ? pool.filter((r) => r.id !== avoidId) : pool;
  const choices = candidates.length > 0 ? candidates : pool;
  return choices[Math.floor(Math.random() * choices.length)] ?? null;
}

export function ambientLines(name: string): string[] {
  return [
    `${name}: nudge me when you want a fresh idea.`,
    `${name}: I will keep you company while it runs.`,
    `${name}: take a breath — it will be ready soon.`,
    `${name}: small tweaks compound. Keep going!`,
  ];
}
