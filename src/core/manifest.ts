// Pet manifest format — bundles a custom atlas with named actions and
// optional projectile effects so a pet can do more than the 9 default
// states. A manifest is an external JSON file that loadManifest() reads
// and applies via configure().
//
// Manifest is opt-in: pets that don't ship one keep working as before
// with the 9 default states. When a manifest is loaded, its actions
// override the default state→row mapping for any state listed in
// stateMap, and play(actionName) becomes available for every key in
// the actions map.

import type { PetAtlasLayout } from './types';

export interface ProjectileSpec {
  /** Frame index within the action's row that triggers the spawn (0-based). */
  atFrame: number;
  /** Atlas row id to use for the projectile sprite. The row's frame count
   *  drives the projectile's flip-book; the projectile element loops
   *  through them while travelling. */
  row: string;
  /** Horizontal travel in pixels. Positive = right, negative = left. */
  dx: number;
  /** Vertical travel in pixels. Positive = down (CSS coordinate system). */
  dy?: number;
  /** Total flight duration in milliseconds. */
  durationMs: number;
  /** Initial offset from the pet's anchor when the projectile spawns. */
  offsetX?: number;
  offsetY?: number;
  /** Display size of the projectile sprite (px). Defaults to ~half the pet's
   *  display size. */
  size?: number;
  /** Projectile-row playback rate (frames/sec). Defaults to the row's own
   *  fps from the atlas. */
  fps?: number;
  /** Z-index for the projectile element. Default 9999, matching the host. */
  zIndex?: number;
}

export interface ActionSpec {
  /** Atlas row id whose frames play during this action. */
  row: string;
  /** Number of times the row's frame loop repeats before the action ends.
   *  Default 1. */
  loops?: number;
  /** Override the row's playback fps for this action. */
  fps?: number;
  /** Pixels the sprite container can grow upward during this action — used
   *  for moves like SHORYUKEN where the sprite extends well above the cell.
   *  Reverts when the action ends. */
  expandUp?: number;
  /** Same, downward (rare). */
  expandDown?: number;
  /** Projectiles spawned at specific frames during the action. */
  spawn?: ProjectileSpec[];
  /** Optional speech bubble that appears when the action starts. */
  say?: string;
}

/** Maps the 9 default WidgetStates ('idle', 'thinking', etc.) to action ids
 *  in this manifest. Lets a manifest re-route the standard states without
 *  changing the consumer's setState() calls. */
export type StateMap = Record<string, string>;

export interface PetManifest {
  /** Stable identifier — used as the localStorage suffix when multiple
   *  manifest pets coexist on a page. */
  id: string;
  displayName?: string;
  description?: string;
  accent?: string;
  /** URL to the spritesheet image. Resolved relative to the manifest URL
   *  if not absolute. */
  spritesheet: string;
  /** Custom atlas layout. Required — manifests are the recommended escape
   *  hatch from the default Codex 8x9 layout. */
  atlas: PetAtlasLayout;
  /** Named actions invokable via play(actionName). */
  actions?: Record<string, ActionSpec>;
  /** Remap the 9 default states to action ids in this manifest. */
  stateMap?: StateMap;
}

/** Parse and validate a raw JSON object as a PetManifest. Throws on invalid
 *  shape. Returns a typed manifest with defaults applied. */
export function parsePetManifest(raw: unknown): PetManifest {
  if (!raw || typeof raw !== 'object') throw new Error('Manifest must be a JSON object');
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== 'string' || !m.id.trim()) throw new Error('Manifest.id must be a non-empty string');
  if (typeof m.spritesheet !== 'string' || !m.spritesheet.trim()) throw new Error('Manifest.spritesheet must be a non-empty string');
  if (!m.atlas || typeof m.atlas !== 'object') throw new Error('Manifest.atlas is required');
  return raw as PetManifest;
}
