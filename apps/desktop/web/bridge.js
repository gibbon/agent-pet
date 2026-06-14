import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createAgentPetAPI } from './vendor/agent-pet-widget.es.js';
import { launchConfig } from './launch-config.js';
import { unionRect, changedBeyond, withMargin } from './bounds.js';
import { actionRegistry } from './registry.js';
import { handlePlayEvent, handleSayEvent, handleStateEvent } from './bridge-handlers.js';

const MARGIN = 8;
const THRESHOLD = 2;
let lastBounds = null;
let registry = new Set(actionRegistry(launchConfig.manifest ?? launchConfig));
let widgetApi = null;
let widgetDragTarget = null;
const diagnostics = [];

function diagnose(message, detail) {
  const suffix = detail === undefined ? '' : `: ${String(detail).slice(0, 180)}`;
  const line = `${new Date().toLocaleTimeString()} ${message}${suffix}`;
  diagnostics.push(line);
  while (diagnostics.length > 8) diagnostics.shift();
  const el = document.getElementById('desktop-diagnostics');
  if (el && launchConfig.desktopDiagnostics) {
    el.textContent = diagnostics.join('\n');
    el.dataset.open = '1';
  }
  console.info(`[agent-pet desktop] ${message}`, detail ?? '');
}

function seedDesktopConfig() {
  if (launchConfig.desktopDebugFrame) {
    document.documentElement.dataset.debugFrame = '1';
  }
  if (launchConfig.desktopDiagnostics) {
    document.getElementById('desktop-diagnostics')?.setAttribute('data-open', '1');
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
    diagnose('storage: seeded');
  } catch (err) {
    diagnose('storage: unavailable', err?.message ?? err);
    // localStorage can be unavailable in hardened webview modes; mount() still
    // receives the same config object as an in-memory fallback.
  }
}

function root() {
  return document.getElementById('pet-root');
}

function fallbackPet() {
  return document.getElementById('desktop-fallback-pet');
}

function fallbackSpeech() {
  return document.getElementById('desktop-fallback-speech');
}

function widgetShadow() {
  return root()?.firstElementChild?.shadowRoot ?? null;
}

function widgetSprite() {
  return widgetShadow()?.querySelector('.ap-image, [data-agent-pet-sprite], img') ?? null;
}

function widgetSpriteHandle() {
  return widgetShadow()?.querySelector('.ap-sprite') ?? null;
}

function hasRealWidgetSprite() {
  const sprite = widgetSprite();
  if (!sprite) return false;
  const r = sprite.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const style = getComputedStyle(sprite);
  return style.backgroundImage !== 'none' || sprite.tagName === 'IMG';
}

function startWindowDrag(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  invoke('start_drag').catch(() => {});
}

function wireWidgetDrag() {
  const handle = widgetSpriteHandle();
  if (!handle || handle === widgetDragTarget) return;
  if (widgetDragTarget) {
    widgetDragTarget.removeEventListener('pointerdown', startWindowDrag, { capture: true });
  }
  widgetDragTarget = handle;
  widgetDragTarget.addEventListener('pointerdown', startWindowDrag, { capture: true });
}

function syncFallbackVisibility() {
  const el = fallbackPet();
  if (!el) return;
  el.hidden = hasRealWidgetSprite();
}

function hideWidgetStartupBubble() {
  const shadow = widgetShadow();
  const candidates = shadow?.querySelectorAll('[class*="bubble"]') ?? [];
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      el.style.display = 'none';
    }
  }
}

function resolveWidgetApi() {
  let api = null;
  try {
    api = createAgentPetAPI();
  } catch (err) {
    diagnose('AgentPet: factory failed', err?.message ?? err);
    return null;
  }
  if (!api) {
    diagnose('AgentPet: factory returned empty');
    return null;
  }
  const methods = ['mount', 'show', 'say', 'setState', 'play'];
  const missing = methods.filter((name) => typeof api[name] !== 'function');
  if (missing.length) {
    diagnose('AgentPet: incomplete', missing.join(','));
    return null;
  }
  diagnose('AgentPet: ESM loaded');
  return api;
}

function inspectWidget(label) {
  const host = root()?.firstElementChild;
  const shadow = widgetShadow();
  const sprite = widgetSprite() ?? shadow?.querySelector('span');
  const overlay = shadow?.querySelector('.ap-overlay');
  const spriteRect = sprite?.getBoundingClientRect();
  const overlayRect = overlay?.getBoundingClientRect();
  diagnose(`${label}: host`, host ? `${host.tagName}${shadow ? ' shadow' : ' no-shadow'}` : 'missing');
  diagnose(`${label}: overlay`, overlayRect ? `${Math.round(overlayRect.width)}x${Math.round(overlayRect.height)}` : 'missing');
  diagnose(`${label}: sprite`, spriteRect ? `${Math.round(spriteRect.width)}x${Math.round(spriteRect.height)} "${sprite.textContent ?? ''}"` : 'missing');
}

function setFallbackState(state) {
  const el = fallbackPet();
  if (el) el.dataset.state = state;
}

function setFallbackSpeech(text) {
  const bubble = fallbackSpeech();
  if (!bubble) return;
  const value = typeof text === 'string' ? text.slice(0, 240) : '';
  bubble.textContent = value;
  bubble.dataset.open = value ? '1' : '0';
  if (value) {
    setTimeout(() => {
      if (bubble.textContent === value) {
        bubble.textContent = '';
        bubble.dataset.open = '0';
        reportNow();
      }
    }, 4200);
  }
}

function localRect(el) {
  if (!el) return null;
  const rr = root().getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height };
}

function findPetElement() {
  const host = root().firstElementChild;
  const widgetPet = widgetSprite();
  if (widgetPet) {
    const r = widgetPet.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return widgetPet;
  }
  return fallbackPet() ?? host;
}

function findBubbleElement() {
  const candidates = widgetShadow()?.querySelectorAll('[class*="bubble"], a, output') ?? [];
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  const fallback = fallbackSpeech();
  if (fallback?.dataset.open === '1') return fallback;
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
  const mo = new MutationObserver(() => queueMicrotask(() => {
    wireWidgetDrag();
    syncFallbackVisibility();
    reportNow();
  }));
  mo.observe(root(), { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  window.addEventListener('resize', () => reportNow());
  setTimeout(() => {
    wireWidgetDrag();
    syncFallbackVisibility();
    reportNow();
  }, 0);
}

async function applyConfigAndReport() {
  if (widgetApi && launchConfig.manifest) {
    await widgetApi.loadManifest(launchConfig.manifest);
  }
  registry = new Set(actionRegistry(launchConfig.manifest ?? launchConfig));
  await invoke('report_registry', { actions: [...registry] }).catch(() => {});
  diagnose('registry: reported', registry.size);
  hideWidgetStartupBubble();
  wireWidgetDrag();
  syncFallbackVisibility();
  reportNow();
}

function wireDrag() {
  root().addEventListener('pointerdown', startWindowDrag);
  wireWidgetDrag();
}

seedDesktopConfig();
widgetApi = resolveWidgetApi();
if (widgetApi) {
  try {
    widgetApi.mount({ target: root(), ...launchConfig });
    diagnose('mount: called');
    widgetApi.show();
    diagnose('show: called');
  } catch (err) {
    diagnose('mount: failed', err?.stack ?? err?.message ?? err);
    widgetApi = null;
  }
} else {
  diagnose('mount: skipped');
}
inspectWidget('after mount');
observeBounds();
wireDrag();
applyConfigAndReport().catch((err) => console.warn('[agent-pet desktop] launch config failed', err));
setTimeout(() => {
  hideWidgetStartupBubble();
  syncFallbackVisibility();
  inspectWidget('after settle');
  reportNow();
}, 250);

listen('pet:state', (event) => {
  if (widgetApi) handleStateEvent(event.payload, widgetApi);
  setFallbackState(event.payload?.state);
});
listen('pet:play', (event) => {
  if (widgetApi) handlePlayEvent(event.payload, widgetApi, registry);
  setFallbackState(event.payload?.action);
});
listen('pet:say', (event) => {
  if (widgetApi) handleSayEvent(event.payload, widgetApi);
  setFallbackSpeech(event.payload?.text);
  syncFallbackVisibility();
  setTimeout(() => reportNow(), 0);
});
