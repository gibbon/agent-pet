export const BUILTIN_STATES = [
  'idle',
  'thinking',
  'building',
  'delegating',
  'success',
  'error',
  'greeting',
  'waiting',
  'leaving',
];

export function actionRegistry(cfg) {
  const set = new Set(BUILTIN_STATES);
  for (const k of Object.keys(cfg?.actions ?? {})) set.add(k);
  for (const k of Object.keys(cfg?.richActions ?? {})) set.add(k);
  return [...set];
}
