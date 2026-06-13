/** @typedef {{x:number,y:number,w:number,h:number}} Rect */

/** Union of the pet rect with an optional bubble rect. @returns {Rect} */
export function unionRect(pet, bubble) {
  if (!bubble) return { ...pet };
  const x = Math.min(pet.x, bubble.x);
  const y = Math.min(pet.y, bubble.y);
  const right = Math.max(pet.x + pet.w, bubble.x + bubble.w);
  const bottom = Math.max(pet.y + pet.h, bubble.y + bubble.h);
  return { x, y, w: right - x, h: bottom - y };
}

/** True if any edge of `next` differs from `prev` by more than `threshold` px. */
export function changedBeyond(prev, next, threshold) {
  if (!prev) return true;
  return Math.abs(prev.x - next.x) > threshold ||
    Math.abs(prev.y - next.y) > threshold ||
    Math.abs(prev.w - next.w) > threshold ||
    Math.abs(prev.h - next.h) > threshold;
}

/** Expand a rect by `m` px on every side. @returns {Rect} */
export function withMargin(r, m) {
  return { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
}
