import { createContext, useContext, useEffect, useState } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { PetProvider } from '../react/context';
import { PetOverlay } from '../react/PetOverlay';
import { defaultPetAdapter } from '../core/adapters/default';
import { DEFAULT_PET_CONFIG, defaultCustomPet } from '../core/pets';
import type { WidgetState, AgentPetAPI, ConfigureOptions, SayOptions, MountOptions } from './api';
import { SpeechQueue } from './queue';

interface WidgetBridgeState {
  hostState: WidgetState;
  currentSpeech: { text: string; link?: string } | null;
}
const WidgetBridgeCtx = createContext<{
  state: WidgetBridgeState;
  onDismiss: () => void;
}>({ state: { hostState: 'idle', currentSpeech: null }, onDismiss: () => {} });

function WidgetRoot({ bridge }: { bridge: { getState: () => WidgetBridgeState; onDismiss: () => void; subscribe: (fn: () => void) => () => void } }) {
  const [s, setS] = useState<WidgetBridgeState>(bridge.getState);
  useEffect(() => bridge.subscribe(() => setS(bridge.getState())), [bridge]);
  return (
    <WidgetBridgeCtx.Provider value={{ state: s, onDismiss: bridge.onDismiss }}>
      <PetProvider adapter={defaultPetAdapter} storageKey="agent-pet:config">
        <WidgetOverlay />
      </PetProvider>
    </WidgetBridgeCtx.Provider>
  );
}

function WidgetOverlay() {
  const { state, onDismiss } = useContext(WidgetBridgeCtx);
  return (
    <PetOverlay
      storageKey="agent-pet:position"
      hostState={state.hostState}
      currentSpeech={state.currentSpeech}
      onDismissSpeech={onDismiss}
    />
  );
}

export function createAgentPetAPI(): AgentPetAPI {
  const queue = new SpeechQueue();
  let hostState: WidgetState = 'idle';
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  let latestState: WidgetBridgeState = { hostState: 'idle', currentSpeech: null };
  const bridgeListeners = new Set<() => void>();
  const notifyBridge = () => { for (const fn of bridgeListeners) fn(); };

  queue.subscribe(() => {
    const head = queue.head();
    latestState = { ...latestState, currentSpeech: head ? { text: head.text, link: head.link } : null };
    notifyBridge();
  });

  const bridge = {
    getState: () => latestState,
    onDismiss: () => queue.dismiss(),
    subscribe: (fn: () => void) => { bridgeListeners.add(fn); return () => bridgeListeners.delete(fn); },
  };

  let host: HTMLElement | null = null;
  let root: Root | null = null;

  const doMount = (opts: MountOptions) => {
    if (host) doUnmount();
    const target = opts.target ?? document.body;
    host = document.createElement('div');
    host.setAttribute('data-agent-pet-host', '');
    host.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;top:0;left:0;width:0;height:0';
    target.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadow.appendChild(container);
    root = createRoot(container);
    root.render(<WidgetRoot bridge={bridge} />);
    if (opts.name || opts.glyph || opts.accent || opts.imageUrl || opts.storageKey) {
      api.configure(opts);
    }
  };

  const doUnmount = () => {
    if (root) { root.unmount(); root = null; }
    if (host?.parentNode) host.parentNode.removeChild(host);
    host = null;
  };

  const api: AgentPetAPI = {
    setState(state: WidgetState) {
      hostState = state;
      latestState = { ...latestState, hostState };
      notifyBridge();
      const fns = listeners.get('stateChange');
      if (fns) for (const fn of fns) fn(state);
    },
    say(text: string, opts?: SayOptions) {
      queue.push(text, opts ?? {});
    },
    configure(opts: ConfigureOptions) {
      const key = opts.storageKey ?? 'agent-pet:config';
      try {
        const raw = localStorage.getItem(key);
        const current: typeof DEFAULT_PET_CONFIG = raw ? JSON.parse(raw) : { ...DEFAULT_PET_CONFIG };
        const customPatch = { name: opts.name, glyph: opts.glyph, accent: opts.accent, imageUrl: opts.imageUrl };
        const custom = { ...defaultCustomPet(), ...(current.custom ?? {}) };
        for (const [k, v] of Object.entries(customPatch)) {
          if (v !== undefined) (custom as Record<string, unknown>)[k] = v;
        }
        const next = { ...current, adopted: true, enabled: true, custom };
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('agent-pet:config-changed'));
      } catch { /* localStorage unavailable */ }
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
  };

  return api;
}
