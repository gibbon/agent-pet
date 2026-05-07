export interface QueueItem {
  id: string;
  text: string;
  link?: string;
  expiresAt: number;
}

const QUEUE_CAP = 5;
const DEDUPE_WINDOW_MS = 1000;
const _recent: Array<{ key: string; ts: number }> = [];

function isDupe(text: string): boolean {
  const now = Date.now();
  while (_recent.length && now - _recent[0]!.ts > DEDUPE_WINDOW_MS) _recent.shift();
  if (_recent.some((r) => r.key === text)) return true;
  _recent.push({ key: text, ts: now });
  return false;
}

type QueueListener = (items: QueueItem[]) => void;

export class SpeechQueue {
  private items: QueueItem[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<QueueListener> = new Set();

  subscribe(fn: QueueListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn([...this.items]);
  }

  push(text: string, opts: { ttl?: number; link?: string } = {}): void {
    if (isDupe(text)) return;
    const ttl = opts.ttl ?? 6000;
    const item: QueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      link: opts.link,
      expiresAt: Date.now() + ttl,
    };
    const next = [...this.items, item];
    this.items = next.length > QUEUE_CAP ? next.slice(-QUEUE_CAP) : next;
    this.notify();
    this.scheduleExpiry();
  }

  dismiss(): void {
    this.items = this.items.slice(1);
    this.notify();
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.scheduleExpiry();
  }

  head(): QueueItem | null {
    return this.items[0] ?? null;
  }

  private scheduleExpiry(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const head = this.items[0];
    if (!head) return;
    const remaining = Math.max(0, head.expiresAt - Date.now());
    this.timer = setTimeout(() => {
      this.items = this.items.slice(1);
      this.notify();
      this.scheduleExpiry();
    }, remaining);
  }
}
