import { describe, it, expect } from 'vitest';
import { actionRegistry, BUILTIN_STATES } from './registry.js';

describe('actionRegistry', () => {
  it('is the 9 states with no manifest', () => {
    expect(actionRegistry(null).sort()).toEqual([...BUILTIN_STATES].sort());
  });

  it('adds manifest actions + richActions keys, deduped', () => {
    const cfg = { actions: { hadouken: {}, wave: {} }, richActions: { wave: {}, spin: {} } };
    const reg = actionRegistry(cfg);
    expect(reg).toContain('hadouken');
    expect(reg).toContain('spin');
    expect(reg.filter((a) => a === 'wave')).toHaveLength(1);
    expect(reg).toContain('idle');
  });
});
