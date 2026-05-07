import type { PetAtlasLayout } from '../core/types';

export type { PetAtlasLayout, PetAtlasRowDef } from '../core/types';

export type WidgetState =
  | 'idle'        // idle row
  | 'thinking'    // review row
  | 'building'    // running row
  | 'delegating'  // running-right row
  | 'success'     // jumping row
  | 'error'       // failed row
  | 'greeting'    // waving row — hello / welcome
  | 'waiting'     // waiting row — explicit pause / awaiting input
  | 'leaving';    // running-left row — going away / wrapping up

export type WidgetEventName = 'stateChange';

export interface SayOptions {
  ttl?: number;
  link?: string;
}

export interface PlayOptions {
  /** Number of times to play the action's animation loop. Default 1. */
  loops?: number;
  /** Override duration explicitly (ms). When set, takes precedence over loops. */
  durationMs?: number;
}

export interface ConfigureOptions {
  name?: string;
  glyph?: string;
  accent?: string;
  imageUrl?: string;
  storageKey?: string;
  /** Apply the standard 8×9 Codex atlas layout. Use with `imageUrl` pointing
   *  at a spritesheet from the Codex Hatchery (j20.nz) or one produced by
   *  the Codex hatch-pet skill. Mutually exclusive with `atlas` — if both
   *  are set, `atlas` wins. */
  useCodexAtlas?: boolean;
  /** Custom atlas layout for spritesheets that don't follow the Codex 8×9
   *  format. Each `rowsDef` entry maps a row index to a named row id (e.g.
   *  'idle', 'walking') with its frame count and FPS. */
  atlas?: PetAtlasLayout;
}

export interface MountOptions extends ConfigureOptions {
  /** Target element to attach the shadow DOM host to. Defaults to document.body. */
  target?: HTMLElement;
}

export interface AgentPetAPI {
  setState(state: WidgetState): void;
  /** Play a one-shot action, then return to the previous persistent state.
   *  Use for transient feedback (e.g. wave on submit, jump on success) that
   *  shouldn't replace the pet's underlying mood. */
  play(action: WidgetState, opts?: PlayOptions): void;
  say(text: string, opts?: SayOptions): void;
  configure(opts: ConfigureOptions): void;
  on(event: WidgetEventName, handler: (...args: unknown[]) => void): void;
  off(event: WidgetEventName, handler: (...args: unknown[]) => void): void;
  /** Mount programmatically. Idempotent — calling twice unmounts the previous instance first. */
  mount(opts?: MountOptions): void;
  unmount(): void;
  readonly mounted: boolean;
}
