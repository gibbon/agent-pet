import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { launchConfig } from './launch-config.js';
import { unionRect, changedBeyond, withMargin } from './bounds.js';
import { actionRegistry } from './registry.js';
import { handlePlayEvent, handleSayEvent, handleStateEvent } from './bridge-handlers.js';

const MARGIN = 8;
const THRESHOLD = 2;
let lastBounds = null;
let registry = new Set(actionRegistry(launchConfig.manifest ?? launchConfig));

function seedDesktopConfig() {
  if (launchConfig.desktopDebugFrame) {
    document.documentElement.dataset.debugFrame = '1';
  }

  try {
    const raw = localStorage.getItem(launchConfig.storageKey);
    const current = raw ? JSON.parse(raw) : {};
    localStorage.setItem(launchConfig.storageKey, JSON.stringify({
      ...current,
      adopted: true,
      enabled: true,
      petId: 'custom',
      custom: {
        ...(current.custom ?? {}),
        name: launchConfig.name,
        glyph: launchConfig.glyph,
        accent: launchConfig.accent,
        imageUrl: launchConfig.imageUrl,
        atlas: launchConfig.atlas,
        richRuntimeUrl: launchConfig.richRuntimeUrl,
      },
    }));
    localStorage.setItem(`${launchConfig.storageKey}:position`, JSON.stringify({ right: 0, bottom: 0 }));
    localStorage.removeItem(`${launchConfig.storageKey}:hidden`);
  } catch {
    // localStorage can be unavailable in hardened webview modes; mount() still
    // receives the same config object as an in-memory fallback.
  }
}

function root() {
  return document.getElementById('pet-root');
}

function localRect(el) {
  if (!el) return null;
  const rr = root().getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height };
}

function findPetElement() {
  const host = root().firstElementChild;
  return host?.shadowRoot?.querySelector('[class*="sprite"], [data-agent-pet-sprite], img') ?? host;
}

function findBubbleElement() {
  const host = root().firstElementChild;
  const candidates = host?.shadowRoot?.querySelectorAll('[class*="bubble"], a, output') ?? [];
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function reportNow(petRect = localRect(findPetElement()), bubbleRect = localRect(findBubbleElement())) {
  if (!petRect) return;
  const u = withMargin(unionRect(petRect, bubbleRect), MARGIN);
  if (!changedBeyond(lastBounds, u, THRESHOLD)) return;
  lastBounds = u;
  invoke('report_bounds', { w: u.w, h: u.h }).catch(() => {});
}

function observeBounds() {
  const ro = new ResizeObserver(() => reportNow());
  ro.observe(root());
  const pet = findPetElement();
  if (pet) ro.observe(pet);
  const mo = new MutationObserver(() => queueMicrotask(() => reportNow()));
  mo.observe(root(), { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  window.addEventListener('resize', () => reportNow());
  setTimeout(() => reportNow(), 0);
}

async function applyConfigAndReport() {
  if (launchConfig.manifest) {
    await AgentPet.loadManifest(launchConfig.manifest);
  }
  registry = new Set(actionRegistry(launchConfig.manifest ?? launchConfig));
  await invoke('report_registry', { actions: [...registry] }).catch(() => {});
  reportNow();
}

function wireDrag() {
  root().addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    invoke('start_drag').catch(() => {});
  });
}

seedDesktopConfig();
AgentPet.mount({ target: root(), ...launchConfig });
AgentPet.show();
observeBounds();
wireDrag();
applyConfigAndReport().catch((err) => console.warn('[agent-pet desktop] launch config failed', err));
setTimeout(() => {
  AgentPet.say('agent-pet is running', { ttl: 3500 });
  reportNow();
}, 250);

listen('pet:state', (event) => handleStateEvent(event.payload, AgentPet));
listen('pet:play', (event) => handlePlayEvent(event.payload, AgentPet, registry));
listen('pet:say', (event) => {
  handleSayEvent(event.payload, AgentPet);
  setTimeout(() => reportNow(), 0);
});
