export interface QueueItem {
    id: string;
    text: string;
    link?: string;
    expiresAt: number;
}
type QueueListener = (items: QueueItem[]) => void;
export declare class SpeechQueue {
    private items;
    private timer;
    private listeners;
    subscribe(fn: QueueListener): () => void;
    private notify;
    push(text: string, opts?: {
        ttl?: number;
        link?: string;
    }): void;
    dismiss(): void;
    head(): QueueItem | null;
    private scheduleExpiry;
}
export {};
