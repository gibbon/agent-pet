import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeechQueue } from './queue';

describe('SpeechQueue', () => {
  beforeEach(() => vi.useFakeTimers());

  it('starts empty', () => {
    const q = new SpeechQueue();
    expect(q.head()).toBeNull();
  });

  it('push adds item and notifies', () => {
    const q = new SpeechQueue();
    const fn = vi.fn();
    q.subscribe(fn);
    q.push('hello');
    expect(q.head()?.text).toBe('hello');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('dismiss removes head and notifies', () => {
    const q = new SpeechQueue();
    const fn = vi.fn();
    q.push('first');
    q.push('second');
    q.subscribe(fn);
    q.dismiss();
    expect(q.head()?.text).toBe('second');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('item expires after ttl', () => {
    const q = new SpeechQueue();
    q.push('ephemeral', { ttl: 1000 });
    expect(q.head()).not.toBeNull();
    vi.advanceTimersByTime(1001);
    expect(q.head()).toBeNull();
  });

  it('dedupes identical text within 1s window', () => {
    const q = new SpeechQueue();
    q.push('same');
    q.push('same');
    let count = 0;
    const unsub = q.subscribe(() => count++);
    q.push('same');
    expect(count).toBe(0);
    unsub();
  });

  it('preserves link on item', () => {
    const q = new SpeechQueue();
    q.push('msg', { link: '/chat?session=abc' });
    expect(q.head()?.link).toBe('/chat?session=abc');
  });
});
