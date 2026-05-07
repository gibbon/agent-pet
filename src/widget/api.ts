export type WidgetState = 'idle' | 'thinking' | 'building' | 'delegating' | 'success' | 'error';

export type WidgetEventName = 'click' | 'stateChange';

export interface SayOptions {
  ttl?: number;
  link?: string;
}

export interface ConfigureOptions {
  name?: string;
  glyph?: string;
  accent?: string;
  imageUrl?: string;
  storageKey?: string;
}

export interface MountOptions extends ConfigureOptions {
  /** Target element to attach the shadow DOM host to. Defaults to document.body. */
  target?: HTMLElement;
}

export interface AgentPetAPI {
  setState(state: WidgetState): void;
  say(text: string, opts?: SayOptions): void;
  configure(opts: ConfigureOptions): void;
  on(event: WidgetEventName, handler: (...args: unknown[]) => void): void;
  off(event: WidgetEventName, handler: (...args: unknown[]) => void): void;
  /** Mount programmatically. Idempotent — calling twice unmounts the previous instance first. */
  mount(opts?: MountOptions): void;
  unmount(): void;
  readonly mounted: boolean;
}
