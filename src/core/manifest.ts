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
//
// ── Runtime tiers ──
// `runtime: "basic"` (default, ~37 KB widget) — atlas-row playback, simple
// linear projectiles, jump arc, scale.
// `runtime: "rich"` — opt-in, lazy-loaded addon. Adds:
//   • per-frame keyframed transforms (position/scale/rotation/skew/crop/alpha)
//   • parametric projectile paths (straight/parabolic/bezier/boomerang)
//   • particle emitters
//   • multi-track actions (one action plays N sprites in parallel)
// The base widget triggers a dynamic import of the rich runtime when it
// encounters `runtime: "rich"`. Codex / simple pets never download the
// rich bundle.

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
  /** Translate the sprite upward in a parabolic arc — the pet actually
   *  leaves the ground for `peak` px and lands again over the action's
   *  duration. Used by moves like SHORYUKEN where the sprite frames
   *  show Ryu rising. Mutually exclusive with `expandUp` — pick one. */
  jumpHeight?: number;
  /** Scale the sprite container upward, anchored at bottom-center, so the
   *  sprite extends above its cell without leaving the ground. Use when
   *  the move is "tall" but the character isn't actually jumping. */
  expandUp?: number;
  /** Same scale concept, downward. Rare. */
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
  /** Which runtime to render this pet with. 'basic' (default) uses the
   *  built-in atlas renderer. 'rich' triggers a lazy import of the rich
   *  runtime addon — required when this manifest uses richActions, paths,
   *  or particles. */
  runtime?: 'basic' | 'rich';
  /** Override URL the base widget uses to lazy-load the rich runtime. By
   *  default the widget loads it from the same /vX.Y/ bucket the base
   *  bundle was served from. Set this for self-hosted / pinned setups. */
  richRuntimeUrl?: string;
  /** Stage-space named actions for the rich runtime. Each action defines
   *  N tracks (sprites animating in parallel) plus optional spawns and
   *  particle emitters. The base runtime ignores these — they only apply
   *  when `runtime: "rich"`. */
  richActions?: Record<string, RichAction>;
  /** URL of the original sprite-rip image (e.g. /ryu.png). Required when
   *  any rich track uses `frames` (source-frame mode) instead of `row`.
   *  The rich runtime crops sprites directly from this image. Resolved
   *  relative to the manifest URL if not absolute. */
  sourceImage?: string;
  /** Source-sprite bbox metadata, indexed by (band, idx). Embed inline so
   *  the manifest is self-contained. ~10 KB JSON for ~200 sprites; gzips
   *  to ~2 KB. Generated by the alpha-segmentation tooling. */
  sprites?: SpriteData[];
}

// ─── Rich runtime types ──────────────────────────────────────────────
// These types are emitted by the editor's rich-mode and consumed by the
// rich runtime addon. Schema is deliberately keyframe-based (rather than
// per-frame) because actions can be 24+ frames long — describing every
// frame would be tedious. Frames between keyframes are interpolated.

/** A 2D point in stage-space pixels. The pet anchor (default sprite
 *  position on screen) is the origin. */
export interface StagePoint {
  x: number;
  y: number;
}

/** Easing curve names supported between keyframes. */
export type Easing =
  | 'linear'        // straight interpolation
  | 'step'          // hold value until next keyframe (no interpolation)
  | 'ease-in'       // quadratic ease-in
  | 'ease-out'      // quadratic ease-out
  | 'ease-in-out'   // quadratic both
  | 'bezier';       // user-supplied control points

/** A single keyframe on a track's timeline. `t` is in [0, 1] — fraction of
 *  the action's total duration. Any field is optional; missing fields
 *  inherit from the previous keyframe (or the track's default). */
export interface RichKeyframe {
  /** Normalised time within the action, [0, 1]. */
  t: number;
  /** Stage-space position relative to the pet anchor. */
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  /** Rotation in degrees, clockwise. */
  rotation?: number;
  /** Skew (degrees) — rare but supports leans / motion smears. */
  skewX?: number;
  skewY?: number;
  /** Crop a portion of the source frame off the rendered sprite (px). */
  cropTop?: number;
  cropBottom?: number;
  cropLeft?: number;
  cropRight?: number;
  /** Mirror the sprite horizontally for this keyframe. */
  flipH?: boolean;
  /** Opacity, [0, 1]. */
  alpha?: number;
  /** Easing into THIS keyframe (i.e., from the previous one). */
  easing?: Easing;
  /** Bezier control points if `easing: "bezier"`. Unit-cube coordinates,
   *  same as CSS cubic-bezier(x1, y1, x2, y2). */
  bezier?: [number, number, number, number];
}

/** Reference to a single source sprite in the original sprite-rip image.
 *  `band` + `idx` indexes into the manifest's `sprites` array (the same
 *  scheme produced by the alpha-segmentation tooling). Optional `ymax` and
 *  `flipH` apply per-frame just like the atlas-pick editor uses them.
 *
 *  `offsetX` / `offsetY` (display pixels) shift the sprite from its default
 *  bbox-centred position — used to anchor each frame to a common point
 *  (typically the feet) so the character doesn't visibly hop between
 *  frames with different bbox dimensions. */
export interface SourceFrame {
  band: number;
  idx: number;
  ymax?: number;
  flipH?: boolean;
  offsetX?: number;
  offsetY?: number;
  /** Per-frame scale multiplier. Defaults to 1. Applied on TOP of the
   *  track-uniform scale, so a value of 1.2 makes this single frame 20%
   *  bigger than the rest of the track. Useful when a source rip drew
   *  one pose at a different scale than the rest. */
  scale?: number;
}

/** Source sprite metadata embedded in the manifest. `bbox` is `[x0, y0, x1, y1]`
 *  in source-image pixel space — the rich runtime crops the source image at
 *  this bbox to render each frame. */
export interface SpriteData {
  band: number;
  idx: number;
  bbox: [number, number, number, number];
}

/** A track is one sprite layer in an action — its own keyframe timeline plus
 *  either an atlas row to source frames from (pre-packed) OR a list of source
 *  frames pulled directly from the sprite-rip image (no atlas required).
 *  Source-frame tracks let an action use any sprite from the rip without
 *  having to bake it into a row first. */
export interface RichTrack {
  /** Atlas row id whose frames are sourced. Mutually exclusive with `frames`
   *  — if both are set, `frames` wins. */
  row?: string;
  /** Direct list of source sprites to play through. Use this to compose an
   *  ad-hoc animation from any frames in the source rip — bypasses the atlas
   *  entirely. The runtime cycles through them at `fps` (defaulting to a
   *  rate that fills the action's duration once). */
  frames?: SourceFrame[];
  /** Frame rate. Required for source-frame tracks unless you want the
   *  default (one full pass over `frames` matching the action duration). */
  fps?: number;
  /** How many times the row/frames loop within the action. Default 1.
   *  Use `loops: 0` to hold the last frame after one play. */
  loops?: number;
  /** Track keyframes, time-ordered. */
  keyframes: RichKeyframe[];
  /** z-index within the action — higher renders in front. Default 0. */
  z?: number;
}

/** Path types for projectile spawns. */
export type RichPath =
  | { type: 'straight'; to: StagePoint }
  | { type: 'parabolic'; to: StagePoint; peakHeight: number }
  | { type: 'bezier'; controlPoints: StagePoint[] }   // 2 = quadratic, 3 = cubic
  | { type: 'boomerang'; to: StagePoint; arcHeight?: number }; // out and back

/** A spawn event fires at a specific time within the action — projectile,
 *  burst of particles, or sound (sound TBD). */
export interface RichSpawn {
  /** Normalised time within the action, [0, 1]. */
  t: number;
  type: 'projectile' | 'particles';
  /** Stage-space spawn origin relative to pet anchor. */
  origin?: StagePoint;
  /** For type: 'projectile' — atlas row for the projectile sprite. Mutually
   *  exclusive with `frames`. */
  row?: string;
  /** For type: 'projectile' — source-frame list for the projectile sprite,
   *  bypassing the atlas. The runtime cycles through these at `fps` while
   *  the projectile travels its path. */
  frames?: SourceFrame[];
  /** Override frame rate when using `frames`. */
  fps?: number;
  /** Total flight time in ms. */
  durationMs?: number;
  /** Path definition. */
  path?: RichPath;
  /** Sprite size at flight start. */
  size?: number;
  /** Optional terminal scale — the projectile grows or shrinks during flight. */
  endSize?: number;
  /** For type: 'particles' — emitter spec. */
  emitter?: ParticleEmitter;
}

/** A particle emitter that fires N short-lived sprites with random
 *  velocities, sizes, and lifetimes. Particles render in 2D stage-space. */
export interface ParticleEmitter {
  /** Number of particles to emit at the spawn moment. Use a small range
   *  for varied bursts. */
  count: number;
  /** Particle lifetime, ms. */
  lifetimeMs: number;
  /** Velocity per particle: a base direction with optional spread cone. */
  velocity: { x: number; y: number; spreadDeg?: number };
  /** Constant gravity applied to particle velocity over its lifetime
   *  (px/s²). Useful for "sparks" that fall. */
  gravity?: number;
  /** Starting and ending size (px). Linearly interpolated. */
  sizeStart: number;
  sizeEnd?: number;
  /** Starting and ending alpha. Linearly interpolated. */
  alphaStart?: number;
  alphaEnd?: number;
  /** A solid color (hex) or a sprite to render each particle as. If both,
   *  sprite wins; the color tints. */
  color?: string;
  spriteRow?: string;
}

/** A rich action — N tracks playing in parallel, plus optional spawns. */
export interface RichAction {
  /** Total action duration, ms. Tracks' keyframes' `t` values map into
   *  this duration. */
  durationMs: number;
  /** Optional speech bubble shown while the action plays. */
  say?: string;
  /** Sprite tracks animating in parallel. */
  tracks: RichTrack[];
  /** Spawns (projectiles + particle bursts) timed within the action. */
  spawn?: RichSpawn[];
}

/** Acceptable schemes for `spritesheet`. Excludes `javascript:`, `data:`,
 *  `vbscript:` etc. Same allowlist style as the speech-bubble link sanitizer
 *  in overlay.ts. Relative URLs (no scheme at all) pass through. */
const SAFE_SCHEMES = /^(https?|file):/i;

/** Parse and validate a raw JSON object as a PetManifest. Throws on invalid
 *  shape. Sanitizes string fields at the boundary so downstream cssText
 *  interpolations are safe by construction — accent goes through
 *  safeAccent() in setConfig but we drop obvious garbage here. */
export function parsePetManifest(raw: unknown): PetManifest {
  if (!raw || typeof raw !== 'object') throw new Error('Manifest must be a JSON object');
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== 'string' || !m.id.trim()) throw new Error('Manifest.id must be a non-empty string');
  if (typeof m.spritesheet !== 'string' || !m.spritesheet.trim()) throw new Error('Manifest.spritesheet must be a non-empty string');
  // Reject non-relative URLs that aren't http/https/file. data: and
  // javascript: are blocked because they can carry arbitrary payloads
  // even when used in background-image: url(...).
  if (m.spritesheet.includes(':') && !SAFE_SCHEMES.test(m.spritesheet)) {
    throw new Error(`Manifest.spritesheet scheme not allowed: ${m.spritesheet.split(':')[0]}:`);
  }
  if (!m.atlas || typeof m.atlas !== 'object') throw new Error('Manifest.atlas is required');
  if (m.actions !== undefined) {
    if (typeof m.actions !== 'object' || m.actions === null) throw new Error('Manifest.actions must be an object');
    for (const [name, spec] of Object.entries(m.actions as Record<string, unknown>)) {
      if (!spec || typeof spec !== 'object') throw new Error(`Action "${name}" must be an object`);
      if (typeof (spec as Record<string, unknown>).row !== 'string') {
        throw new Error(`Action "${name}".row must be a string`);
      }
    }
  }
  return raw as PetManifest;
}
