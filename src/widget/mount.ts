// Vanilla DOM widget factory. Replaces the prior React-based mount.tsx —
// no JSX, no React, no Preact. createAgentPetAPI() returns a fully-typed
// AgentPetAPI backed by a PetOverlayElement DOM tree in a shadow root.

import { CODEX_ATLAS_LAYOUT, CODEX_ATLAS_ROWS_DEF } from '../core/atlas';
import { defaultPetAdapter } from '../core/adapters/default';
import { DEFAULT_PET_CONFIG, defaultCustomPet, preferredRowId } from '../core/pets';
import { parsePetManifest, type PetManifest } from '../core/manifest';
import { migratePetConfig, type PetConfig } from '../core/types';
import type {
  AgentPetAPI, ConfigureOptions, MountOptions, ObserveOptions,
  PetActionName, PlayOptions, RichRuntime, SayOptions, WidgetEventName, WidgetState,
} from './api';
import { PetOverlayElement } from './overlay';
import { SpeechQueue } from './queue';
import { attachObservers } from './observer';
import { spawnProjectile } from './projectile';

// pet.css contents inlined at build time. Shadow DOM doesn't inherit
// document.head styles, so we manually inject this <style> into each
// shadow root we create. Vite handles the ?inline transform; the type
// declaration lives in src/css.d.ts.
import petCss from '../react/pet.css?inline';

const CONFIG_CHANGED_EVENT = 'agent-pet:config-changed';

// ─── Rich runtime singleton ──────────────────────────────────────────
// Module-level so a single addon load serves every pet on the page. The
// addon (a separate bundle) calls AgentPet.registerRichRuntime(impl) on
// script execution, which forwards to setRichRuntime() below. Concurrent
// loadManifest() calls share one in-flight promise so we never inject
// the script tag twice.

let richRuntime: RichRuntime | null = null;
let richLoadPromise: Promise<RichRuntime> | null = null;
let richLoadedFromUrl: string | null = null;

/** Called by the registry's registerRichRuntime() — the rich addon's
 *  entry point ultimately reaches here. */
export function setRichRuntime(impl: RichRuntime): void {
  richRuntime = impl;
}

function defaultRichRuntimeUrl(): string {
  // Best-effort default: the rich bundle ships next to the base IIFE on
  // the same CDN bucket. If the consumer didn't specify richRuntimeUrl
  // and we can find the base bundle's <script> tag, swap the filename.
  if (typeof document === 'undefined') return '';
  const base = document.querySelector<HTMLScriptElement>('script[src*="agent-pet-widget"]');
  if (base?.src) return base.src.replace(/agent-pet-widget(\.iife)?\.js/, 'agent-pet-rich$1.js');
  return '';
}

function ensureRichRuntime(url: string | undefined): Promise<RichRuntime> {
  if (richRuntime) return Promise.resolve(richRuntime);
  const resolved = url || defaultRichRuntimeUrl();
  if (!resolved) return Promise.reject(new Error('No rich runtime URL — pass richRuntimeUrl in the manifest'));
  if (richLoadPromise && richLoadedFromUrl === resolved) return richLoadPromise;
  richLoadedFromUrl = resolved;
  richLoadPromise = new Promise<RichRuntime>((resolve, reject) => {
    if (typeof document === 'undefined') { reject(new Error('No document')); return; }
    const s = document.createElement('script');
    s.src = resolved;
    s.async = true;
    s.onload = () => {
      // If the addon ran but didn't register, surface a clear error.
      if (richRuntime) resolve(richRuntime);
      else reject(new Error(`Rich runtime at ${resolved} loaded but did not register`));
    };
    s.onerror = () => reject(new Error(`Failed to load rich runtime: ${resolved}`));
    document.head.appendChild(s);
  });
  return richLoadPromise;
}

function loadConfig(key: string): PetConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_PET_CONFIG };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_PET_CONFIG };
    const { cfg, changed } = migratePetConfig(JSON.parse(raw) as PetConfig);
    if (changed) {
      try { window.localStorage.setItem(key, JSON.stringify(cfg)); } catch { /* ignore */ }
    }
    return cfg;
  } catch {
    return { ...DEFAULT_PET_CONFIG };
  }
}

export function createAgentPetAPI(): AgentPetAPI {
  const queue = new SpeechQueue();
  const listeners = new Map<WidgetEventName, Set<(...args: unknown[]) => void>>();

  // Mount lifecycle state
  let host: HTMLElement | null = null;
  let shadow: ShadowRoot | null = null;
  let overlay: PetOverlayElement | null = null;
  let storageKey = 'agent-pet:config';
  let positionKey = 'agent-pet:position';
  let hiddenKey = 'agent-pet:hidden';
  let configChangedHandler: (() => void) | null = null;
  let detachObservers: (() => void) | null = null;
  let chatEnabled = false;
  let chatPlaceholder: string | undefined;

  const fireUserMessage = (text: string): void => {
    const fns = listeners.get('userMessage');
    if (fns) for (const fn of fns) fn(text);
  };
  const fireVisibility = (visible: boolean): void => {
    const fns = listeners.get('visibility');
    if (fns) for (const fn of fns) fn({ visible });
  };

  // Per-instance state
  let hostState: string = 'idle';
  let persistentState: string = 'idle';
  let playRevertTimer: ReturnType<typeof setTimeout> | null = null;
  let actionSpawnTimers: Array<ReturnType<typeof setTimeout>> = [];

  // ── Speech queue → overlay ─────────────────────────────────────
  queue.subscribe(() => {
    const head = queue.head();
    overlay?.setSpeech(head ? { text: head.text, link: head.link } : null);
  });

  // ── Helpers ────────────────────────────────────────────────────

  const reloadConfigFromStorage = (): void => {
    if (!overlay) return;
    overlay.setConfig(loadConfig(storageKey));
  };

  const applyState = (state: string): void => {
    hostState = state;
    overlay?.setHostState(state);
    const fns = listeners.get('stateChange');
    if (fns) for (const fn of fns) fn(state);
  };

  const clearActionSpawnTimers = (): void => {
    for (const t of actionSpawnTimers) clearTimeout(t);
    actionSpawnTimers = [];
  };

  const estimateLoopMs = (action: WidgetState): number => {
    const rowId = preferredRowId(defaultPetAdapter.map(action));
    try {
      const raw = localStorage.getItem(storageKey);
      const cfg: PetConfig | null = raw ? JSON.parse(raw) : null;
      const customRow = cfg?.custom?.atlas?.rowsDef.find((r) => r.id === rowId);
      if (customRow) return Math.round((customRow.frames / customRow.fps) * 1000);
    } catch { /* ignore */ }
    const codexRow = CODEX_ATLAS_ROWS_DEF.find((r) => r.id === rowId);
    if (codexRow) return Math.round((codexRow.frames / codexRow.fps) * 1000);
    return 1500;
  };

  const doMount = (opts: MountOptions): void => {
    if (host) doUnmount();
    if (opts.storageKey) {
      storageKey = opts.storageKey;
      positionKey = `${opts.storageKey}:position`;
      hiddenKey = `${opts.storageKey}:hidden`;
    }
    if (opts.chat !== undefined) chatEnabled = opts.chat;
    if (opts.chatPlaceholder !== undefined) chatPlaceholder = opts.chatPlaceholder;
    const target = opts.target ?? document.body;
    host = document.createElement('div');
    host.setAttribute('data-agent-pet-host', '');
    host.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;top:0;left:0;width:0;height:0';
    target.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });

    // Inject pet.css into the shadow root.
    const styleEl = document.createElement('style');
    styleEl.textContent = petCss as string;
    shadow.appendChild(styleEl);

    overlay = new PetOverlayElement(shadow, {
      positionKey,
      hiddenKey,
      onDismissSpeech: () => queue.dismiss(),
      onHide: () => fireVisibility(false),
      onUserMessage: (text) => fireUserMessage(text),
    });

    // Apply any new config in opts (these write through to localStorage too).
    // Always pull into the overlay afterwards: configure() dispatches a
    // config-changed event but the listener is attached below, so on initial
    // mount the dispatched event has no listener yet — pull explicitly.
    if (opts.name || opts.glyph || opts.accent || opts.imageUrl || opts.atlas || opts.useCodexAtlas || opts.storageKey) {
      api.configure(opts);
    }
    reloadConfigFromStorage();
    overlay.setHostState(hostState);
    overlay.setChat(chatEnabled, chatPlaceholder);

    configChangedHandler = () => reloadConfigFromStorage();
    window.addEventListener(CONFIG_CHANGED_EVENT, configChangedHandler);
  };

  const doUnmount = (): void => {
    if (configChangedHandler) {
      window.removeEventListener(CONFIG_CHANGED_EVENT, configChangedHandler);
      configChangedHandler = null;
    }
    if (detachObservers) { detachObservers(); detachObservers = null; }
    if (playRevertTimer) { clearTimeout(playRevertTimer); playRevertTimer = null; }
    clearActionSpawnTimers();
    overlay?.destroy();
    overlay = null;
    if (host?.parentNode) host.parentNode.removeChild(host);
    host = null;
    shadow = null;
  };

  // ── Public API ────────────────────────────────────────────────

  const api: AgentPetAPI = {
    setState(state: PetActionName) {
      if (playRevertTimer) { clearTimeout(playRevertTimer); playRevertTimer = null; }
      clearActionSpawnTimers();
      overlay?.endAction();
      persistentState = state;
      applyState(state);
    },
    play(action: PetActionName, opts?: PlayOptions) {
      if (playRevertTimer) clearTimeout(playRevertTimer);
      clearActionSpawnTimers();
      overlay?.endAction();
      const cfg = loadConfig(storageKey);
      // Rich-runtime path: the action is in richActions and the addon has
      // registered itself. Kick off async playback and return immediately —
      // the rich runtime owns its own state machine and revert.
      const richSpec = cfg.custom.richActions?.[action];
      if (richSpec && richRuntime && overlay && cfg.custom.imageUrl && cfg.custom.atlas) {
        const ctx = {
          anchor: overlay.getRoot(),
          imageUrl: cfg.custom.imageUrl,
          atlas: cfg.custom.atlas,
          size: 96,
        };
        const fns = listeners.get('stateChange');
        if (fns) for (const fn of fns) fn(action);
        if (richSpec.say) queue.push(richSpec.say, {});
        Promise.resolve(richRuntime.playAction(action, richSpec, ctx)).catch((err) => {
          // Rich runtime errors shouldn't crash the host page; log and revert.
          console.warn('[agent-pet] rich action failed:', err);
        });
        return;
      }
      // Look up a manifest action: if found, drive the row + spawns + expand
      // directly. Otherwise fall back to the WidgetState code path.
      const actionSpec = cfg.custom.actions?.[action];
      if (actionSpec && overlay) {
        const fps = actionSpec.fps ?? overlay.rowFps(actionSpec.row) ?? 6;
        const frames = overlay.rowFrames(actionSpec.row) ?? 1;
        const loops = Math.max(1, actionSpec.loops ?? opts?.loops ?? 1);
        const durationMs = opts?.durationMs ?? Math.round((frames * loops * 1000) / fps);
        overlay.beginAction(actionSpec.row, {
          expandUp: actionSpec.expandUp,
          expandDown: actionSpec.expandDown,
          jumpHeight: actionSpec.jumpHeight,
          durationMs,
        });
        const fns = listeners.get('stateChange');
        if (fns) for (const fn of fns) fn(action);
        if (actionSpec.say) queue.push(actionSpec.say, {});
        // Schedule projectile spawns relative to the action's frame timing.
        if (actionSpec.spawn) {
          for (const proj of actionSpec.spawn) {
            const delay = Math.max(0, Math.round((proj.atFrame * 1000) / fps));
            actionSpawnTimers.push(setTimeout(() => {
              spawnProjectile(overlay!, proj, cfg.custom.atlas, cfg.custom.imageUrl);
            }, delay));
          }
        }
        playRevertTimer = setTimeout(() => {
          playRevertTimer = null;
          // Symmetric cleanup: if the consumer passed a shorter durationMs
          // than the natural action duration, late-frame spawns would
          // otherwise still fire after revert.
          clearActionSpawnTimers();
          overlay?.endAction();
          applyState(persistentState);
        }, durationMs);
        return;
      }
      // Built-in WidgetState path
      const loops = Math.max(1, opts?.loops ?? 1);
      const durationMs = opts?.durationMs ?? estimateLoopMs(action as WidgetState) * loops;
      applyState(action);
      playRevertTimer = setTimeout(() => {
        playRevertTimer = null;
        if (hostState === action) applyState(persistentState);
      }, durationMs);
    },
    say(text: string, opts?: SayOptions) {
      queue.push(text, opts ?? {});
    },
    configure(opts: ConfigureOptions) {
      const key = opts.storageKey ?? storageKey;
      try {
        const raw = localStorage.getItem(key);
        const current: PetConfig = raw ? JSON.parse(raw) : { ...DEFAULT_PET_CONFIG };
        const customPatch: Record<string, unknown> = {
          name: opts.name, glyph: opts.glyph, accent: opts.accent, imageUrl: opts.imageUrl,
          actions: opts.actions, stateMap: opts.stateMap,
          runtime: opts.runtime, richRuntimeUrl: opts.richRuntimeUrl, richActions: opts.richActions,
        };
        if (opts.atlas) customPatch.atlas = opts.atlas;
        else if (opts.useCodexAtlas) customPatch.atlas = CODEX_ATLAS_LAYOUT;
        const custom = { ...defaultCustomPet(), ...(current.custom ?? {}) };
        for (const [k, v] of Object.entries(customPatch)) {
          if (v !== undefined) (custom as Record<string, unknown>)[k] = v;
        }
        const next = { ...current, adopted: true, enabled: true, custom };
        localStorage.setItem(key, JSON.stringify(next));
        if (opts.storageKey) {
          storageKey = opts.storageKey;
          positionKey = `${opts.storageKey}:position`;
          hiddenKey = `${opts.storageKey}:hidden`;
        }
        window.dispatchEvent(new CustomEvent(CONFIG_CHANGED_EVENT));
      } catch { /* localStorage unavailable */ }
      if (opts.chat !== undefined) {
        chatEnabled = opts.chat;
        overlay?.setChat(chatEnabled, opts.chatPlaceholder ?? chatPlaceholder);
      }
      if (opts.chatPlaceholder !== undefined) {
        chatPlaceholder = opts.chatPlaceholder;
        overlay?.setChat(chatEnabled, chatPlaceholder);
      }
    },
    async loadManifest(source: PetManifest | string) {
      let manifest: PetManifest;
      let baseUrl: string | undefined;
      if (typeof source === 'string') {
        baseUrl = source;
        const resp = await fetch(source);
        if (!resp.ok) throw new Error(`Failed to load manifest from ${source}: HTTP ${resp.status}`);
        manifest = parsePetManifest(await resp.json());
      } else {
        manifest = parsePetManifest(source);
      }
      // Resolve spritesheet URL relative to the manifest URL.
      const spritesheet = baseUrl
        ? new URL(manifest.spritesheet, new URL(baseUrl, typeof window !== 'undefined' ? window.location.href : 'http://x/')).toString()
        : manifest.spritesheet;
      api.configure({
        name: manifest.displayName ?? manifest.id,
        accent: manifest.accent,
        imageUrl: spritesheet,
        atlas: manifest.atlas,
        actions: manifest.actions,
        stateMap: manifest.stateMap,
        runtime: manifest.runtime,
        richRuntimeUrl: manifest.richRuntimeUrl,
        richActions: manifest.richActions,
      });
      // If this manifest opts into the rich runtime, kick off the lazy
      // load now so awaiting loadManifest is enough — the caller doesn't
      // have to chase a separate "ready" event before invoking play().
      if (manifest.runtime === 'rich') {
        await ensureRichRuntime(manifest.richRuntimeUrl);
      }
    },
    observe(opts: ObserveOptions) {
      if (detachObservers) { detachObservers(); detachObservers = null; }
      detachObservers = attachObservers(api, opts);
    },
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },
    mount(opts: MountOptions = {}) { doMount(opts); },
    unmount() { doUnmount(); },
    get mounted() { return host !== null; },
    hide() {
      overlay?.setHidden(true);
      fireVisibility(false);
    },
    show() {
      overlay?.setHidden(false);
      fireVisibility(true);
    },
    toggle() {
      const next = !(overlay?.isHidden() ?? false);
      overlay?.setHidden(next);
      fireVisibility(!next);
    },
    get hidden() { return overlay?.isHidden() ?? false; },
  };

  return api;
}
