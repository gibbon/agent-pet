import { BUILTIN_STATES } from './registry.js';

const TEXT_CAP = 4096;
const MAX_TTL = 60000;
const MAX_LOOPS = 100;
const MAX_DURATION = 60000;

function finiteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function clampInt(v, min, max) {
  if (!finiteNumber(v)) return undefined;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

export function safeLink(link) {
  if (typeof link !== 'string') return undefined;
  try {
    const u = new URL(link);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export function handleStateEvent(payload, api) {
  if (!payload || !BUILTIN_STATES.includes(payload.state)) return;
  api.setState(payload.state);
}

export function handlePlayEvent(payload, api, registry) {
  if (!payload || typeof payload.action !== 'string' || !registry.has(payload.action)) return;
  const opts = {};
  const loops = clampInt(payload.loops, 1, MAX_LOOPS);
  const durationMs = clampInt(payload.durationMs, 0, MAX_DURATION);
  if (loops !== undefined) opts.loops = loops;
  if (durationMs !== undefined) opts.durationMs = durationMs;
  api.play(payload.action, opts);
}

export function handleSayEvent(payload, api) {
  if (!payload || typeof payload.text !== 'string') return;
  const opts = {};
  const ttl = clampInt(payload.ttl, 0, MAX_TTL);
  const link = safeLink(payload.link);
  if (ttl !== undefined) opts.ttl = ttl;
  if (link) opts.link = link;
  api.say(payload.text.slice(0, TEXT_CAP), opts);
}
