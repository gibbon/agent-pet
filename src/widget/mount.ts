// Vanilla DOM widget factory. Replaces the prior React-based mount.tsx —
// no JSX, no React, no Preact. createAgentPetAPI() returns a fully-typed
// AgentPetAPI backed by a PetOverlayElement DOM tree in a shadow root.

import { CODEX_ATLAS_LAYOUT, CODEX_ATLAS_ROWS_DEF } from '../core/atlas';
import { defaultPetAdapter } from '../core/adapters/default';
import { DEFAULT_PET_CONFIG, defaultCustomPet, preferredRowId } from '../core/pets';
import { migratePetConfig, type PetConfig } from '../core/types';
import type { AgentPetAPI, ConfigureOptions, MountOptions, ObserveOptions, PlayOptions, SayOptions, WidgetEventName, WidgetState } from './api';
import { PetOverlayElement } from './overlay';
import { SpeechQueue } from './queue';
import { attachObservers } from './observer';

// pet.css contents inlined at build time. Shadow DOM doesn't inherit
// document.head styles, so we manually inject this <style> into each
// shadow root we create. Vite handles the ?inline transform; the type
// declaration lives in src/css.d.ts.
import petCss from '../react/pet.css?inline';

const CONFIG_CHANGED_EVENT = 'agent-pet:config-changed';

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
  let hostState: WidgetState = 'idle';
  let persistentState: WidgetState = 'idle';
  let playRevertTimer: ReturnType<typeof setTimeout> | null = null;

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

  const applyState = (state: WidgetState): void => {
    hostState = state;
    overlay?.setHostState(state);
    const fns = listeners.get('stateChange');
    if (fns) for (const fn of fns) fn(state);
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
    overlay?.destroy();
    overlay = null;
    if (host?.parentNode) host.parentNode.removeChild(host);
    host = null;
    shadow = null;
  };

  // ── Public API ────────────────────────────────────────────────

  const api: AgentPetAPI = {
    setState(state: WidgetState) {
      if (playRevertTimer) { clearTimeout(playRevertTimer); playRevertTimer = null; }
      persistentState = state;
      applyState(state);
    },
    play(action: WidgetState, opts?: PlayOptions) {
      if (playRevertTimer) clearTimeout(playRevertTimer);
      const loops = Math.max(1, opts?.loops ?? 1);
      const durationMs = opts?.durationMs ?? estimateLoopMs(action) * loops;
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
