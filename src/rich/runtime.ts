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
  ParticleEmitter, Easing,
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

// ─── Stage (one absolute-positioned overlay anchored to the pet) ────

function ensureStage(ctx: RichRuntimeContext): HTMLElement {
  // Re-use a stage element on the anchor between actions so we don't
  // create/destroy a layer for every play() call.
  let stage = ctx.anchor.querySelector<HTMLElement>(':scope > [data-rich-stage]');
  if (stage) return stage;
  stage = document.createElement('div');
  stage.dataset.richStage = '';
  stage.style.cssText = [
    'position:fixed',
    'top:0', 'left:0',
    'width:0', 'height:0',
    'pointer-events:none',
    'z-index:9999',
  ].join(';');
  ctx.anchor.appendChild(stage);
  return stage;
}

/** Anchor the stage at the pet's current screen-space position. The pet
 *  may move between actions — re-read getBoundingClientRect each play. */
function positionStage(stage: HTMLElement, anchor: HTMLElement): void {
  const r = anchor.getBoundingClientRect();
  // Anchor: bottom-center of the pet sprite. The anchor host is fixed-size
  // 0×0 with the sprite as a positioned child; use the sprite's rect if
  // it's the immediate child, otherwise fall back to the anchor.
  const sprite = anchor.shadowRoot?.querySelector('[class*=ap-sprite]') as HTMLElement | null;
  const rect = sprite?.getBoundingClientRect() ?? r;
  stage.style.left = `${rect.left + rect.width / 2}px`;
  stage.style.top = `${rect.top + rect.height / 2}px`;
}

// ─── Track renderer ─────────────────────────────────────────────────

function createTrackRenderer(
  track: RichTrack,
  action: RichAction,
  ctx: RichRuntimeContext,
  stage: HTMLElement,
) {
  const rowDef = ctx.atlas.rowsDef.find((r) => r.id === track.row);
  if (!rowDef) {
    console.warn(`[agent-pet rich] track row "${track.row}" not in atlas`);
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
      // loops:0 = play once and hold last frame.
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

// ─── Spawn handlers (projectiles + particles) ───────────────────────

function spawnProjectile(spawn: RichSpawn, ctx: RichRuntimeContext, stage: HTMLElement) {
  if (!spawn.row || !spawn.path || !spawn.durationMs) return;
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

export function createRichRuntime(): RichRuntime {
  return {
    playAction(name, action, ctx) {
      const stage = ensureStage(ctx);
      positionStage(stage, ctx.anchor);
      const startMs = performance.now();
      const renderers = action.tracks.map((t) => createTrackRenderer(t, action, ctx, stage));
      const pendingSpawns = (action.spawn ?? []).slice().sort((a, b) => a.t - b.t);
      return new Promise<void>((resolve) => {
        const tick = () => {
          const now = performance.now();
          const elapsed = now - startMs;
          const t = elapsed / action.durationMs;
          // Fire spawns that have come due
          while (pendingSpawns.length && pendingSpawns[0].t <= Math.min(1, t)) {
            const sp = pendingSpawns.shift()!;
            if (sp.type === 'projectile') spawnProjectile(sp, ctx, stage);
            else if (sp.type === 'particles') spawnParticles(sp, ctx, stage);
          }
          if (t >= 1) {
            for (const r of renderers) r.cleanup();
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
