import { describe, expect, it, vi } from 'vitest';
import { handlePlayEvent, handleSayEvent, handleStateEvent } from './bridge-handlers.js';

describe('bridge event handlers', () => {
  it('forwards a valid state', () => {
    const api = { setState: vi.fn() };
    handleStateEvent({ state: 'thinking' }, api);
    expect(api.setState).toHaveBeenCalledWith('thinking');
  });

  it('drops an unknown state', () => {
    const api = { setState: vi.fn() };
    handleStateEvent({ state: '<script>' }, api);
    expect(api.setState).not.toHaveBeenCalled();
  });

  it('forwards a registered play action with bounded options', () => {
    const api = { play: vi.fn() };
    handlePlayEvent({ action: 'hadouken', loops: 200, durationMs: 70000 }, api, new Set(['hadouken']));
    expect(api.play).toHaveBeenCalledWith('hadouken', { loops: 100, durationMs: 60000 });
  });

  it('drops unknown play actions', () => {
    const api = { play: vi.fn() };
    handlePlayEvent({ action: 'unknown' }, api, new Set(['idle']));
    expect(api.play).not.toHaveBeenCalled();
  });

  it('forwards safe say payloads and drops extra fields', () => {
    const api = { say: vi.fn() };
    handleSayEvent({ text: 'done', ttl: 1000, link: 'https://example.com/x', html: '<b>x</b>' }, api);
    expect(api.say).toHaveBeenCalledWith('done', { ttl: 1000, link: 'https://example.com/x' });
  });

  it('drops unsafe say links but keeps text', () => {
    const api = { say: vi.fn() };
    handleSayEvent({ text: 'done', link: 'javascript:alert(1)' }, api);
    expect(api.say).toHaveBeenCalledWith('done', {});
  });
});
