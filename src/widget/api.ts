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

export type WidgetEventName = 'stateChange' | 'userMessage' | 'visibility';

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
  /** Show a chat input under the speech bubble. On Enter, the input fires a
   *  `userMessage` event with the typed text. Consumers wire this to their
   *  own backend (LLM, helpdesk, custom) and call `say(reply)` to display
   *  the response. The pet ships no UI for message history — that's
   *  consumer territory. */
  chat?: boolean;
  /** Placeholder text for the chat input. Default: "Ask…". */
  chatPlaceholder?: string;
}

export interface MountOptions extends ConfigureOptions {
  /** Target element to attach the shadow DOM host to. Defaults to document.body. */
  target?: HTMLElement;
}

export interface ObserveOptions {
  /** Pet state to play when any <form> on the page is submitted. */
  formSubmit?: WidgetState | false;
  /** Pet state to play when a form field's `invalid` event fires (HTML5 validation). */
  formError?: WidgetState | false;
  /** Pet state to play once on initial DOMContentLoaded. */
  pageLoad?: WidgetState | false;
  /** Pet state to set just before the page unloads. */
  pageLeave?: WidgetState | false;
  /** Pet state to play when the user clicks a cross-origin link or target="_blank". */
  externalLink?: WidgetState | false;
}

export interface AgentPetAPI {
  setState(state: WidgetState): void;
  /** Play a one-shot action, then return to the previous persistent state.
   *  Use for transient feedback (e.g. wave on submit, jump on success) that
   *  shouldn't replace the pet's underlying mood. */
  play(action: WidgetState, opts?: PlayOptions): void;
  say(text: string, opts?: SayOptions): void;
  configure(opts: ConfigureOptions): void;
  /** Wire DOM events (form submit, page load, external links, etc.) to pet
   *  state changes. Replaces any previous observe() call — pass {} to disable
   *  all observers, or omit individual fields to disable just those. */
  observe(opts: ObserveOptions): void;
  on(event: WidgetEventName, handler: (...args: unknown[]) => void): void;
  off(event: WidgetEventName, handler: (...args: unknown[]) => void): void;
  /** Mount programmatically. Idempotent — calling twice unmounts the previous instance first. */
  mount(opts?: MountOptions): void;
  unmount(): void;
  readonly mounted: boolean;
  /** Hide the pet, replacing it with a small minimized dock the user can
   *  click to bring the pet back. State persists in localStorage so the
   *  pet stays hidden across reloads. Fires a `visibility` event with
   *  `{ visible: false }`. */
  hide(): void;
  /** Show the pet, removing the minimized dock. Fires `visibility` with
   *  `{ visible: true }`. */
  show(): void;
  /** Toggle hidden ↔ visible. */
  toggle(): void;
  /** True when the pet is in the minimized-dock state. */
  readonly hidden: boolean;
}

/**
 * Registry-style API attached to `window.AgentPet`. Behaves like a single
 * AgentPetAPI for backward compatibility (setState, play, say, etc. operate
 * on a default 'main' pet), but adds methods for managing multiple named
 * pets on one page.
 */
export interface AgentPetRegistry extends AgentPetAPI {
  /** Create a new pet with the given id, mount it, and return its API.
   *  Each pet has its own storageKey (defaults to `agent-pet:config:<id>`)
   *  and position memory. Calling create() with an existing id returns the
   *  existing pet without remounting. */
  create(id: string, opts?: MountOptions): AgentPetAPI;
  /** Look up a registered pet by id, or undefined if not found. */
  get(id: string): AgentPetAPI | undefined;
  /** Whether a pet with the given id exists in the registry. */
  has(id: string): boolean;
  /** All registered pet ids. The default pet is 'main'. */
  list(): string[];
  /** Unmount and forget a pet. */
  remove(id: string): void;
  /** Pet *source* providers (codex-pets.net, j20 hatchery, custom). Distinct
   *  from the multi-pet registry above — these manage URL resolution and
   *  catalog fetching for `data-<id>-pet="..."` and the community tab. */
  readonly providers: import('../core/providers/types').PetProviderRegistry;
}
