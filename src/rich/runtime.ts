// Rich runtime — DOM/CSS implementation. Plays RichActions the base widget
// hands off via AgentPet.registerRichRuntime(). Lazy-loaded as a separate
// IIFE bundle (`agent-pet-rich.iife.js`); the base widget's mount.ts only
// triggers the script-tag injection when a manifest declares
// `runtime: "rich"`.
//
// v0 scope:
//   • per-track sprite renderer (atlas cell stepping + CSS transform)
//   • keyframe interpolation for x/y/scale/rotation/skew/alpha/flipH
//   • parametric projectile paths (straight, parabolic, bezier, boomerang)
//   • simple DOM particle bursts
//
// Out of scope for v0: 3D effects, hit-tested interactions, audio.

import type {
  RichAction, RichTrack, RichKeyframe, RichSpawn, RichPath,
  ParticleEmitter, Easing, SourceFrame,
} from '../core/manifest';
import type { RichRuntime, RichRuntimeContext } from '../widget/api';

// ─── Utilities ───────────────────────────────────────────────────────

function quoteUrl(url: string): string { return JSON.stringify(url); }

function applyEasing(p: number, easing: Easing | undefined): number {
  switch (easing) {
    case 'step': return 0;
    case 'ease-in': return p * p;
    case 'ease-out': return 1 - (1 - p) * (1 - p);
    case 'ease-in-out': return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    case 'linear':
    default: return p;
  }
}

function lerp(a: number | undefined, b: number | undefined, p: number, fallback: number): number {
  if (a === undefined && b === undefined) return fallback;
  if (a === undefined) return b!;
  if (b === undefined) return a;
  return a + (b - a) * p;
}

/** Sample track keyframes at normalised time t [0,1]. Returns the
 *  interpolated transform values, falling through fields the keyframes
 *  don't explicitly set. */
function sampleKeyframes(track: RichTrack, t: number) {
  const kf = track.keyframes;
  if (!kf.length) return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, skewY: 0, alpha: 1, flipH: false };
  // Find the segment containing t
  let i = 0;
  while (i < kf.length - 1 && kf[i + 1].t <= t) i++;
  const a = kf[i];
  const b = i < kf.length - 1 ? kf[i + 1] : a;
  let p = 0;
  if (b !== a) {
    const span = b.t - a.t;
    p = span > 0 ? Math.max(0, Math.min(1, (t - a.t) / span)) : 0;
    p = applyEasing(p, b.easing);
  }
  return {
    x: lerp(a.x, b.x, p, 0),
    y: lerp(a.y, b.y, p, 0),
    scaleX: lerp(a.scaleX, b.scaleX, p, 1),
    scaleY: lerp(a.scaleY, b.scaleY, p, 1),
    rotation: lerp(a.rotation, b.rotation, p, 0),
    skewX: lerp(a.skewX, b.skewX, p, 0),
    skewY: lerp(a.skewY, b.skewY, p, 0),
    alpha: lerp(a.alpha, b.alpha, p, 1),
    flipH: (b.flipH !== undefined ? b.flipH : a.flipH) ?? false,
  };
}

// ─── Source-image dimensions cache ──────────────────────────────────
// Source-frame tracks crop bboxes from the original sprite-rip image. To
// compute the right background-size, we need the source image's natural
// pixel dimensions. Load once per URL and reuse.

const sourceDims = new Map<string, { w: number; h: number } | null>();

function ensureSourceDims(url: string | undefined): Promise<{ w: number; h: number } | null> {
  if (!url) return Promise.resolve(null);
  if (sourceDims.has(url)) return Promise.resolve(sourceDims.get(url)!);
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const dims = { w: im.naturalWidth, h: im.naturalHeight };
      sourceDims.set(url, dims);
      resolve(dims);
    };
    im.onerror = () => {
      sourceDims.set(url, null);
      resolve(null);
    };
    im.src = url;
  });
}

// ─── Sprite element (one per track or projectile) ────────────────────

interface SpriteOpts {
  imageUrl: string;
  cols: number;
  rows: number;
  rowIndex: number;
  rowFrames: number;
  size: number;
  fps: number;
  z: number;
}

interface SourceSpriteOpts {
  size: number;
  z: number;
}

/** Source-frame sprite — crops the original sprite-rip image at a bbox.
 *  Caller passes `scale` per-frame so the same scale can be applied across
 *  every frame in a track (preserves the source's relative sizes — a
 *  tucked pose with a smaller bbox stays smaller on screen instead of
 *  zooming up to fill the same display size as wider frames). */
function createSourceSprite(
  parent: HTMLElement,
  ctx: RichRuntimeContext,
  opts: SourceSpriteOpts,
): { el: HTMLDivElement; setFrame: (frame: SourceFrame, scale: number) => void } {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute',
    'left:0', 'top:0',
    'background-repeat:no-repeat',
    'image-rendering:pixelated',
    'pointer-events:none',
    `z-index:${opts.z}`,
    'transform-origin:center center',
    'will-change:transform,opacity',
  ].join(';');
  parent.appendChild(el);
  const dims = ctx.sourceImage ? sourceDims.get(ctx.sourceImage) : null;
  const setFrame = (frame: SourceFrame, scale: number) => {
    if (!ctx.sprites || !dims || !ctx.sourceImage) return;
    const bbox = ctx.sprites.get(`${frame.band}.${frame.idx}`);
    if (!bbox) return;
    const [x0, y0, x1, y1] = bbox;
    const yEnd = frame.ymax != null ? Math.min(y1, y0 + frame.ymax) : y1;
    const bboxW = x1 - x0;
    const bboxH = yEnd - y0;
    const dispW = bboxW * scale;
    const dispH = bboxH * scale;
    el.style.width = `${dispW}px`;
    el.style.height = `${dispH}px`;
    el.style.backgroundImage = `url(${quoteUrl(ctx.sourceImage)})`;
    el.style.backgroundPosition = `-${x0 * scale}px -${y0 * scale}px`;
    el.style.backgroundSize = `${dims.w * scale}px ${dims.h * scale}px`;
  };
  return { el, setFrame };
}

/** Compute a track/projectile-level scale factor from the largest bbox
 *  dimension across the supplied frames. All frames in the same track
 *  use this same factor → their relative sizes are preserved. */
function computeFrameSetScale(
  frames: SourceFrame[],
  ctx: RichRuntimeContext,
  targetSize: number,
): number {
  if (!ctx.sprites) return 1;
  let maxDim = 0;
  for (const f of frames) {
    const bbox = ctx.sprites.get(`${f.band}.${f.idx}`);
    if (!bbox) continue;
    const [x0, y0, x1, y1] = bbox;
    const yEnd = f.ymax != null ? Math.min(y1, y0 + f.ymax) : y1;
    maxDim = Math.max(maxDim, x1 - x0, yEnd - y0);
  }
  return maxDim > 0 ? targetSize / maxDim : 1;
}

function createSprite(parent: HTMLElement, opts: SpriteOpts): { el: HTMLDivElement; setFrame: (n: number) => void } {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute',
    'left:0', 'top:0',
    `width:${opts.size}px`, `height:${opts.size}px`,
    `background-image:url(${quoteUrl(opts.imageUrl)})`,
    `background-size:${opts.cols * 100}% ${opts.rows * 100}%`,
    'background-repeat:no-repeat',
    'image-rendering:pixelated',
    'pointer-events:none',
    `z-index:${opts.z}`,
    'transform-origin:center center',
    'will-change:transform,opacity',
  ].join(';');
  parent.appendChild(el);
  const setFrame = (n: number) => {
    const xPct = opts.cols > 1 ? (n / (opts.cols - 1)) * 100 : 0;
    const yPct = opts.rows > 1 ? (opts.rowIndex / (opts.rows - 1)) * 100 : 0;
    el.style.backgroundPosition = `${xPct}% ${yPct}%`;
  };
  return { el, setFrame };
}

// ─── Path evaluation ────────────────────────────────────────────────

function evalPath(path: RichPath, t: number): { x: number; y: number } {
  switch (path.type) {
    case 'straight': {
      return { x: path.to.x * t, y: path.to.y * t };
    }
    case 'parabolic': {
      // Linear horizontal/depth + sine arc vertically peaking at peakHeight.
      return {
        x: path.to.x * t,
        y: path.to.y * t - Math.sin(t * Math.PI) * path.peakHeight,
      };
    }
    case 'bezier': {
      const cps = path.controlPoints;
      if (cps.length === 2) {
        // Quadratic with implicit start at (0,0)
        const [c1, p2] = cps;
        const u = 1 - t;
        return {
          x: 2 * u * t * c1.x + t * t * p2.x,
          y: 2 * u * t * c1.y + t * t * p2.y,
        };
      }
      if (cps.length === 3) {
        // Cubic with implicit start at (0,0)
        const [c1, c2, p3] = cps;
        const u = 1 - t;
        return {
          x: 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
          y: 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
        };
      }
      // Fallback: lerp to last point
      const last = cps[cps.length - 1] ?? { x: 0, y: 0 };
      return { x: last.x * t, y: last.y * t };
    }
    case 'boomerang': {
      // Out and back: 2-phase. First half: travel to `to`. Second half: return.
      const arc = path.arcHeight ?? 60;
      const phase = t < 0.5 ? t * 2 : (1 - t) * 2;
      return {
        x: path.to.x * phase,
        y: path.to.y * phase - Math.sin(phase * Math.PI) * arc,
      };
    }
  }
}

// ─── Stage (one absolute-positioned overlay attached to body) ──────
// We attach the stage to <body> rather than the pet's shadow DOM because:
//   1. Fixed-positioned elements escape shadow DOM stacking contexts cleanly,
//   2. Projectiles fly across the whole page, well outside the pet's bounds,
//   3. CSS transforms work the same regardless of parent.
// One stage per page; reused across actions.

const STAGE_ID = '__agent_pet_rich_stage__';

function ensureStage(): HTMLElement {
  let stage = document.getElementById(STAGE_ID);
  if (stage) return stage;
  stage = document.createElement('div');
  stage.id = STAGE_ID;
  stage.style.cssText = [
    'position:fixed',
    'top:0', 'left:0',
    'width:0', 'height:0',
    'pointer-events:none',
    'z-index:9999',
  ].join(';');
  document.body.appendChild(stage);
  return stage;
}

/** Move the stage to the pet's current viewport-space center. Called once at
 *  action start; for v0 we don't track the pet during the action. */
function positionStage(stage: HTMLElement, ctx: RichRuntimeContext): void {
  const { x, y } = ctx.getAnchorPos();
  stage.style.left = `${x}px`;
  stage.style.top = `${y}px`;
}

// ─── Track renderer ─────────────────────────────────────────────────

function createTrackRenderer(
  track: RichTrack,
  action: RichAction,
  ctx: RichRuntimeContext,
  stage: HTMLElement,
) {
  // Source-frame mode: track lists explicit (band, idx) frames cropped from
  // the original sprite-rip image. No atlas required.
  if (track.frames && track.frames.length > 0) {
    return createSourceFrameTrackRenderer(track, action, ctx, stage);
  }
  // Atlas-row mode (existing behaviour).
  const rowDef = ctx.atlas.rowsDef.find((r) => r.id === track.row);
  if (!rowDef) {
    console.warn(`[agent-pet rich] track row "${track.row}" not in atlas (and no .frames either)`);
    return { update() {}, cleanup() {} };
  }
  const rowFps = track.fps ?? rowDef.fps;
  const loops = track.loops ?? 1;
  const sprite = createSprite(stage, {
    imageUrl: ctx.imageUrl,
    cols: ctx.atlas.cols,
    rows: ctx.atlas.rows,
    rowIndex: rowDef.index,
    rowFrames: rowDef.frames,
    size: ctx.size,
    fps: rowFps,
    z: track.z ?? 0,
  });
  return {
    update(t: number, nowMs: number, startMs: number) {
      const elapsedMs = nowMs - startMs;
      const totalFramesPlayed = Math.floor((elapsedMs / 1000) * rowFps);
      let frame: number;
      if (loops === 0) {
        frame = Math.min(rowDef.frames - 1, totalFramesPlayed);
      } else {
        const totalFrames = rowDef.frames * loops;
        const capped = Math.min(totalFrames - 1, totalFramesPlayed);
        frame = capped % rowDef.frames;
      }
      sprite.setFrame(frame);
      const k = sampleKeyframes(track, t);
      const flipScaleX = (k.flipH ? -1 : 1) * k.scaleX;
      sprite.el.style.transform = [
        `translate(calc(-50% + ${k.x}px), calc(-50% + ${k.y}px))`,
        `rotate(${k.rotation}deg)`,
        `skew(${k.skewX}deg, ${k.skewY}deg)`,
        `scale(${flipScaleX}, ${k.scaleY})`,
      ].join(' ');
      sprite.el.style.opacity = String(k.alpha);
    },
    cleanup() {
      sprite.el.remove();
    },
  };
}

/** Source-frame variant of createTrackRenderer — cycles through track.frames
 *  using bbox crops of ctx.sourceImage instead of atlas-cell stepping. */
function createSourceFrameTrackRenderer(
  track: RichTrack,
  action: RichAction,
  ctx: RichRuntimeContext,
  stage: HTMLElement,
) {
  const frames = track.frames!;
  // Default fps: one full pass over `frames` matching the action's duration.
  const fps = track.fps ?? Math.max(1, Math.round((frames.length * 1000) / action.durationMs));
  const loops = track.loops ?? 1;
  const sprite = createSourceSprite(stage, ctx, { size: ctx.size, z: track.z ?? 0 });
  // Track-uniform scale — every frame renders at this same factor so
  // their bbox sizes stay proportional to one another.
  const trackScale = computeFrameSetScale(frames, ctx, ctx.size);
  return {
    update(t: number, nowMs: number, startMs: number) {
      const elapsedMs = nowMs - startMs;
      const totalFramesPlayed = Math.floor((elapsedMs / 1000) * fps);
      let frameIdx: number;
      if (loops === 0) {
        frameIdx = Math.min(frames.length - 1, totalFramesPlayed);
      } else {
        const totalFrames = frames.length * loops;
        const capped = Math.min(totalFrames - 1, totalFramesPlayed);
        frameIdx = capped % frames.length;
      }
      const frame = frames[frameIdx];
      // Per-frame scale multiplier on top of the track-uniform scale —
      // lets the user upscale a single tucked/oddly-drawn frame.
      sprite.setFrame(frame, trackScale * (frame.scale ?? 1));
      const k = sampleKeyframes(track, t);
      const flipped = !!k.flipH !== !!frame.flipH;
      const flipScaleX = (flipped ? -1 : 1) * k.scaleX;
      // Per-frame offset is added to the keyframe's x/y so each frame can
      // be anchored to a common point (e.g. the feet) without the keyframe
      // values having to absorb per-sprite drift. Frame.flipH is mirrored,
      // but the per-frame offset is NOT mirrored — it applies in the
      // sprite's own (post-flip) coordinate space; the renderer flips by
      // negating scaleX so positive offsetX still means "right" visually.
      const offX = (frame.offsetX || 0) * (flipped ? -1 : 1);
      const offY = frame.offsetY || 0;
      sprite.el.style.transform = [
        `translate(calc(-50% + ${k.x + offX}px), calc(-50% + ${k.y + offY}px))`,
        `rotate(${k.rotation}deg)`,
        `skew(${k.skewX}deg, ${k.skewY}deg)`,
        `scale(${flipScaleX}, ${k.scaleY})`,
      ].join(' ');
      sprite.el.style.opacity = String(k.alpha);
    },
    cleanup() {
      sprite.el.remove();
    },
  };
}

// ─── Spawn handlers (projectiles + particles) ───────────────────────

function spawnProjectile(spawn: RichSpawn, ctx: RichRuntimeContext, stage: HTMLElement) {
  if (!spawn.path || !spawn.durationMs) return;
  // Source-frame projectile: bbox-crop renderer.
  if (spawn.frames && spawn.frames.length) {
    return spawnSourceFrameProjectile(spawn, ctx, stage);
  }
  // Atlas-row projectile (existing).
  if (!spawn.row) return;
  const rowDef = ctx.atlas.rowsDef.find((r) => r.id === spawn.row);
  if (!rowDef) return;
  const size = spawn.size ?? Math.round(ctx.size * 0.6);
  const sprite = createSprite(stage, {
    imageUrl: ctx.imageUrl,
    cols: ctx.atlas.cols,
    rows: ctx.atlas.rows,
    rowIndex: rowDef.index,
    rowFrames: rowDef.frames,
    size,
    fps: rowDef.fps,
    z: 1,
  });
  const startMs = performance.now();
  const path = spawn.path;
  const origin = spawn.origin ?? { x: 0, y: 0 };
  const sizeStart = size;
  const sizeEnd = spawn.endSize ?? size;
  const tick = () => {
    const elapsed = performance.now() - startMs;
    const t = elapsed / spawn.durationMs!;
    if (t >= 1) { sprite.el.remove(); return; }
    const pos = evalPath(path, t);
    const f = Math.floor((elapsed / 1000) * rowDef.fps) % rowDef.frames;
    sprite.setFrame(f);
    const s = sizeStart + (sizeEnd - sizeStart) * t;
    sprite.el.style.transform = [
      `translate(calc(-50% + ${origin.x + pos.x}px), calc(-50% + ${origin.y + pos.y}px))`,
      `scale(${s / size})`,
    ].join(' ');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function spawnSourceFrameProjectile(spawn: RichSpawn, ctx: RichRuntimeContext, stage: HTMLElement) {
  if (!spawn.path || !spawn.durationMs || !spawn.frames?.length) return;
  const size = spawn.size ?? Math.round(ctx.size * 0.6);
  const sprite = createSourceSprite(stage, ctx, { size, z: 1 });
  const fps = spawn.fps ?? Math.max(4, Math.round((spawn.frames.length * 1000) / spawn.durationMs));
  const startMs = performance.now();
  const path = spawn.path;
  const origin = spawn.origin ?? { x: 0, y: 0 };
  const sizeStart = size;
  const sizeEnd = spawn.endSize ?? size;
  const tick = () => {
    const elapsed = performance.now() - startMs;
    const t = elapsed / spawn.durationMs!;
    if (t >= 1) { sprite.el.remove(); return; }
    const pos = evalPath(path, t);
    const fIdx = Math.floor((elapsed / 1000) * fps) % spawn.frames!.length;
    const frame = spawn.frames![fIdx];
    const s = sizeStart + (sizeEnd - sizeStart) * t;
    // Track-uniform scale so all projectile frames stay proportional;
    // animated by the projectile's growing/shrinking size over the flight.
    const projScale = computeFrameSetScale(spawn.frames!, ctx, s) * (frame.scale ?? 1);
    sprite.setFrame(frame, projScale);
    const offX = (frame.offsetX || 0) * (frame.flipH ? -1 : 1);
    const offY = frame.offsetY || 0;
    sprite.el.style.transform = [
      `translate(calc(-50% + ${origin.x + pos.x + offX}px), calc(-50% + ${origin.y + pos.y + offY}px))`,
      `scale(${frame.flipH ? -1 : 1}, 1)`,
    ].join(' ');
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function spawnParticles(spawn: RichSpawn, ctx: RichRuntimeContext, stage: HTMLElement) {
  const e = spawn.emitter;
  if (!e) return;
  const origin = spawn.origin ?? { x: 0, y: 0 };
  for (let i = 0; i < e.count; i++) {
    const p = document.createElement('div');
    const angle = ((Math.random() - 0.5) * (e.velocity.spreadDeg ?? 0)) * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const vx = e.velocity.x * cos - e.velocity.y * sin;
    const vy = e.velocity.x * sin + e.velocity.y * cos;
    const startMs = performance.now();
    const sizeStart = e.sizeStart;
    const sizeEnd = e.sizeEnd ?? e.sizeStart * 0.2;
    const aStart = e.alphaStart ?? 1;
    const aEnd = e.alphaEnd ?? 0;
    p.style.cssText = [
      'position:absolute',
      'left:0', 'top:0',
      `background:${e.color ?? '#fff'}`,
      'border-radius:50%',
      'pointer-events:none',
      'will-change:transform,opacity',
    ].join(';');
    stage.appendChild(p);
    const tick = () => {
      const elapsed = performance.now() - startMs;
      const t = elapsed / e.lifetimeMs;
      if (t >= 1) { p.remove(); return; }
      const gravityY = (e.gravity ?? 0) * (elapsed / 1000) * (elapsed / 1000) * 0.5;
      const x = origin.x + vx * (elapsed / 1000);
      const y = origin.y + vy * (elapsed / 1000) + gravityY;
      const s = sizeStart + (sizeEnd - sizeStart) * t;
      p.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      p.style.width = `${s}px`;
      p.style.height = `${s}px`;
      p.style.opacity = String(aStart + (aEnd - aStart) * t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// ─── Public RichRuntime impl ────────────────────────────────────────

/** True if any track or spawn in this action references source frames (and
 *  therefore needs ctx.sourceImage's natural dimensions before rendering). */
function actionUsesSourceFrames(action: RichAction): boolean {
  if (action.tracks?.some((t) => t.frames?.length)) return true;
  if (action.spawn?.some((s) => s.frames?.length)) return true;
  return false;
}

export function createRichRuntime(): RichRuntime {
  // The runtime serves a single pet at a time. Track the current action
  // so a fresh playAction() can cancel any in-flight one — otherwise an
  // ambient idle loop and a user-triggered click visibly layer on top of
  // each other (the previous action's track sprites stay in the stage
  // until ITS durationMs expires). Spawns (projectiles + particles) are
  // intentionally NOT cancelled — they finish their own lifetime so an
  // interrupted hadouken's fireball still reaches the screen edge.
  let cancelActive: (() => void) | null = null;
  return {
    async playAction(name, action, ctx) {
      // Cancel any previous action's tick + tear down its track sprites
      // before starting the new one.
      if (cancelActive) {
        cancelActive();
        cancelActive = null;
      }
      // Preload source-image dims if any track or spawn uses bbox-crop
      // rendering. One round-trip the first time we see a given URL; the
      // result is cached in the module-level sourceDims map.
      if (actionUsesSourceFrames(action)) {
        await ensureSourceDims(ctx.sourceImage);
      }
      // The action might have already been cancelled while awaiting the
      // image preload — bail without staging anything.
      let cancelled = false;
      const stage = ensureStage();
      positionStage(stage, ctx);
      const startMs = performance.now();
      // Re-position the stage every animation frame so the action's
      // sprites follow the pet's anchor as the user drags it. Without
      // this, a 1+ second idle action snapshots the start position and
      // lags behind the drag (sprites visibly snap to a new spot every
      // time the action loops). Cheap — two style writes per frame.
      const renderers = action.tracks.map((t) => createTrackRenderer(t, action, ctx, stage));
      const pendingSpawns = (action.spawn ?? []).slice().sort((a, b) => a.t - b.t);
      // Expose a cancel function on the closure so the next playAction
      // can tear this one down. Tick loop also checks `cancelled` each
      // frame so a mid-tick cancel stops cleanly.
      cancelActive = () => {
        cancelled = true;
        for (const r of renderers) r.cleanup();
      };
      const myCancel = cancelActive;
      return new Promise<void>((resolve) => {
        const tick = () => {
          if (cancelled) { resolve(); return; }
          // Track the pet's current anchor each frame (drag-friendly).
          positionStage(stage, ctx);
          const now = performance.now();
          const elapsed = now - startMs;
          const t = elapsed / action.durationMs;
          while (pendingSpawns.length && pendingSpawns[0].t <= Math.min(1, t)) {
            const sp = pendingSpawns.shift()!;
            if (sp.type === 'projectile') spawnProjectile(sp, ctx, stage);
            else if (sp.type === 'particles') spawnParticles(sp, ctx, stage);
          }
          if (t >= 1) {
            for (const r of renderers) r.cleanup();
            // Only clear the module reference if it's still us — a later
            // action may have already overwritten it.
            if (cancelActive === myCancel) cancelActive = null;
            resolve();
            return;
          }
          for (const r of renderers) r.update(Math.min(1, t), now, startMs);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
  };
}
