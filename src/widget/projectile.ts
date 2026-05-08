// Projectile spawn system. Manifest actions can declare `spawn` entries
// that fire at specific frames during the action — each spawn creates a
// short-lived DOM element that flies across the page (translateX/Y) while
// looping its own atlas-row animation, then removes itself.
//
// Projectiles attach to the same shadow root as the pet so styling stays
// scoped, but they're fixed-positioned in viewport coords so they can
// escape the pet's bounding box and fly across the whole page.

import type { ProjectileSpec } from '../core/manifest';
import type { PetAtlasLayout } from '../core/types';
import type { PetOverlayElement } from './overlay';

const DEFAULT_PROJECTILE_SIZE = 48;
const DEFAULT_Z_INDEX = 9999;

export function spawnProjectile(
  overlay: PetOverlayElement,
  spec: ProjectileSpec,
  atlas: PetAtlasLayout | undefined,
  imageUrl: string | undefined,
): void {
  if (!atlas || !imageUrl) return;
  const row = atlas.rowsDef.find((r) => r.id === spec.row);
  if (!row) return;

  const anchor = overlay.spriteCenter();
  const size = spec.size ?? DEFAULT_PROJECTILE_SIZE;
  const fps = spec.fps ?? row.fps;
  const frames = Math.max(1, row.frames);
  const offsetX = spec.offsetX ?? 0;
  const offsetY = spec.offsetY ?? 0;

  const startX = anchor.x + offsetX;
  const startY = anchor.y + offsetY;

  // Append directly to body — avoids overflow:hidden on shadow-DOM ancestors
  // and lets the projectile cross the whole viewport. CSS background-image
  // works regardless of DOM parent, so we don't lose pixelated rendering.
  const el = document.createElement('div');
  // JSON.stringify quotes the URL — same defensive pattern as sprite.ts.
  const startStyles: string[] = [
    'position:fixed',
    `left:${startX - size / 2}px`,
    `top:${startY - size / 2}px`,
    `width:${size}px`,
    `height:${size}px`,
    `z-index:${spec.zIndex ?? DEFAULT_Z_INDEX}`,
    'pointer-events:none',
    `background-image:url(${JSON.stringify(imageUrl)})`,
    `background-size:${atlas.cols * 100}% ${atlas.rows * 100}%`,
    'image-rendering:pixelated',
    'transition:transform var(--ap-flight-dur,800ms) linear',
    'transform:translate3d(0,0,0)',
  ];
  el.style.cssText = startStyles.join(';');
  document.body.appendChild(el);

  // Atlas frame timer — loops through the row's frames while the
  // projectile is in flight.
  let currentFrame = 0;
  const cols = Math.max(1, atlas.cols);
  const rows = Math.max(1, atlas.rows);
  const setFrame = (f: number): void => {
    const xPct = cols > 1 ? (f / (cols - 1)) * 100 : 0;
    const yPct = rows > 1 ? (row.index / (rows - 1)) * 100 : 0;
    el.style.backgroundPosition = `${xPct}% ${yPct}%`;
  };
  setFrame(0);
  const intervalMs = Math.max(16, Math.round(1000 / Math.max(1, fps)));
  const frameTimer = window.setInterval(() => {
    currentFrame = (currentFrame + 1) % frames;
    setFrame(currentFrame);
  }, intervalMs);

  // Flight: kick off the transform on the next frame so the transition runs.
  el.style.setProperty('--ap-flight-dur', `${spec.durationMs}ms`);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transform = `translate3d(${spec.dx}px, ${spec.dy ?? 0}px, 0)`;
    });
  });

  // Cleanup after the flight completes.
  window.setTimeout(() => {
    window.clearInterval(frameTimer);
    el.remove();
  }, spec.durationMs + 50);
}
