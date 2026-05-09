import type { PetAtlasLayout } from '../core/types';
import type { ActionSpec, PetManifest, RichAction, StateMap } from '../core/manifest';

export type { PetAtlasLayout, PetAtlasRowDef } from '../core/types';
export type {
  ActionSpec, ProjectileSpec, PetManifest, StateMap,
  RichAction, RichTrack, RichKeyframe, RichSpawn, RichPath,
  ParticleEmitter, StagePoint, Easing,
  SourceFrame, SpriteData,
} from '../core/manifest';

/** What the lazy-loaded rich runtime registers with the base widget. The
 *  base widget calls `playAction` when consumers invoke `play(name)` and
 *  `name` is in the manifest's `richActions`. `anchor` is a stable DOM
 *  element the rich renderer can use to position its overlay relative to
 *  the pet's on-screen location. */
export interface RichRuntime {
  /** Play a named rich action. Returns a promise that resolves when the
   *  action's animation has completed (so the base widget can revert
   *  state afterward). */
  playAction(name: string, action: RichAction, ctx: RichRuntimeContext): Promise<void>;
  /** Optional: stop all in-flight actions immediately. Called on unmount. */
  destroy?(): void;
}

/** Information passed to the rich runtime when it plays an action. */
export interface RichRuntimeContext {
  /** Current pet sprite center in viewport coordinates. The rich runtime
   *  reads this on action start (and whenever it needs to re-anchor). The
   *  base widget computes it from the on-screen sprite's bounding rect. */
  getAnchorPos(): { x: number; y: number };
  /** The pet's spritesheet URL — same texture the rich runtime samples. */
  imageUrl: string;
  /** The pet's atlas layout — needed to compute UVs for atlas-row sprites. */
  atlas: PetAtlasLayout;
  /** Pet's display size in pixels. */
  size: number;
  /** Original sprite-rip image URL — used by source-frame tracks/spawns
   *  that bypass the atlas. Optional; only required when the action
   *  references frames by (band, idx). */
  sourceImage?: string;
  /** Source-sprite bbox metadata. Map: `${band}.${idx}` → [x0, y0, x1, y1]. */
  sprites?: Map<string, [number, number, number, number]>;
}

/** Standard widget states (the original 9). Pets without a manifest use only
 *  these. Pets with a manifest can also accept any action name registered
 *  in the manifest's `actions` map. */
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

/** A state name accepted by setState/play. Either a built-in WidgetState or
 *  any string — manifests validate at runtime. The string fallback lets
 *  TypeScript users invoke `play('hadouken')` without the type system
 *  knowing about manifest contents. */
export type PetActionName = WidgetState | (string & {});

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
  /** Manifest-driven semantic actions. Action keys are arbitrary names
   *  ('hadouken', 'shoryuken') that consumers invoke via play(name). Each
   *  action declares its row, optional projectile spawns, and optional
   *  vertical expansion when the move extends beyond the cell bounds. */
  actions?: Record<string, ActionSpec>;
  /** Remap the 9 default WidgetStates to action ids in the actions map.
   *  Lets a manifest re-route the standard states without consumers
   *  changing their setState() calls. */
  stateMap?: StateMap;
  /** Switch to the rich runtime for this pet. Triggers a lazy import of
   *  the rich runtime bundle on next configure(). */
  runtime?: 'basic' | 'rich';
  /** URL of the rich runtime bundle (defaults to a sibling of the base
   *  widget). Consumers can pin to a specific version for self-hosted
   *  setups. */
  richRuntimeUrl?: string;
  /** Stage-space rich actions invokable via play(name). Played by the
   *  rich runtime when present. Ignored when `runtime !== 'rich'`. */
  richActions?: Record<string, RichAction>;
  /** Source-image URL — required when rich tracks reference frames by
   *  (band, idx) instead of by atlas row. */
  sourceImage?: string;
  /** Inline source-sprite bbox metadata used by source-frame rich tracks. */
  sprites?: import('../core/manifest').SpriteData[];
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
  setState(state: PetActionName): void;
  /** Play a one-shot action, then return to the previous persistent state.
   *  Use for transient feedback (e.g. wave on submit, jump on success) that
   *  shouldn't replace the pet's underlying mood. Action can be either a
   *  built-in WidgetState or any name registered in a loaded manifest. */
  play(action: PetActionName, opts?: PlayOptions): void;
  say(text: string, opts?: SayOptions): void;
  configure(opts: ConfigureOptions): void;
  /** Load a pet manifest (URL or inline object) — applies the manifest's
   *  imageUrl, atlas, actions and stateMap in one call. The recommended
   *  way to bundle a custom pet with semantic actions.
   *
   *  Mounting order: this method only persists the config and dispatches
   *  the change event. If the pet hasn't been mounted yet, call mount()
   *  afterward and the overlay will pick the manifest up via loadConfig.
   *  Calling order matters less in practice — both `mount(); loadManifest(url)`
   *  and `loadManifest(url); mount()` produce the same end state.
   *
   *  Rich runtime: if the manifest has `runtime: "rich"`, this method
   *  triggers a one-time lazy import of the rich runtime bundle. The
   *  promise resolves only after the rich runtime has registered itself,
   *  so awaiting loadManifest is enough to guarantee rich actions are
   *  ready to play. The first rich pet pays a network round-trip; cached
   *  for every subsequent rich pet on the page. */
  loadManifest(source: PetManifest | string): Promise<void>;
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

/** Registry-style API attached to `window.AgentPet`. Singleton-shaped for
 *  back-compat (setState/play/say etc forward to a default 'main' pet) plus
 *  multi-pet management (`create`/`get`/`list`/`remove`) and the rich
 *  runtime registration hook. */
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
  /** Called by the lazy-loaded rich runtime addon on script execution.
   *  Consumers don't call this directly — it's the contract between the
   *  rich addon bundle and the base widget. Once registered, any pet
   *  whose manifest declares `runtime: "rich"` routes its play() calls
   *  for `richActions` through the addon. */
  registerRichRuntime(impl: RichRuntime): void;
}
