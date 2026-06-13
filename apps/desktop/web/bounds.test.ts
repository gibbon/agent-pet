import { describe, it, expect } from 'vitest';
import { unionRect, changedBeyond, withMargin } from './bounds.js';

describe('unionRect', () => {
  it('returns the pet rect when no bubble', () => {
    expect(unionRect({ x: 10, y: 10, w: 50, h: 50 }, null))
      .toEqual({ x: 10, y: 10, w: 50, h: 50 });
  });

  it('unions pet + bubble into the bounding box', () => {
    const pet = { x: 100, y: 100, w: 40, h: 40 };
    const bubble = { x: 60, y: 60, w: 120, h: 30 };
    expect(unionRect(pet, bubble)).toEqual({ x: 60, y: 60, w: 120, h: 80 });
  });
});

describe('changedBeyond', () => {
  it('false when within threshold on every edge', () => {
    expect(changedBeyond({ x: 0, y: 0, w: 50, h: 50 }, { x: 1, y: 1, w: 51, h: 49 }, 2)).toBe(false);
  });

  it('true when any edge moves past threshold', () => {
    expect(changedBeyond({ x: 0, y: 0, w: 50, h: 50 }, { x: 0, y: 0, w: 55, h: 50 }, 2)).toBe(true);
  });

  it('true when previous is null', () => {
    expect(changedBeyond(null, { x: 0, y: 0, w: 1, h: 1 }, 2)).toBe(true);
  });
});

describe('withMargin', () => {
  it('expands the rect by the margin on all sides', () => {
    expect(withMargin({ x: 10, y: 10, w: 30, h: 30 }, 8))
      .toEqual({ x: 2, y: 2, w: 46, h: 46 });
  });
});
