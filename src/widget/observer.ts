// Opt-in page event observers. Each observer wires a DOM event to a
// pet state change so the widget can react to common app activity
// (form submit, page navigation, external links) without the host
// having to write any JavaScript glue.
//
// Off by default — caller passes a config to AgentPet.observe(...) to
// enable specific reactions. Pass false to disable an observer that's
// already on.

import type { AgentPetAPI, WidgetState } from './api';

export interface ObserveOptions {
  /** Pet state to play when any <form> on the page is submitted. */
  formSubmit?: WidgetState | false;
  /** Pet state to play when a form field's `invalid` event fires (HTML5 validation). */
  formError?: WidgetState | false;
  /** Pet state to play once on initial DOMContentLoaded (or immediately if already loaded). */
  pageLoad?: WidgetState | false;
  /** Pet state to set just before the page unloads. */
  pageLeave?: WidgetState | false;
  /** Pet state to play when the user clicks a cross-origin link or target="_blank". */
  externalLink?: WidgetState | false;
}

/** Defaults applied when `data-observe="forms,nav"` is set on the script tag. */
export const OBSERVE_DEFAULTS: Required<{
  [K in keyof ObserveOptions]: WidgetState;
}> = {
  formSubmit: 'thinking',
  formError: 'error',
  pageLoad: 'greeting',
  pageLeave: 'leaving',
  externalLink: 'leaving',
};

/**
 * Parse the `data-observe` attribute value into an ObserveOptions.
 * Keywords (comma- or space-separated):
 *   - 'forms'      → formSubmit + formError
 *   - 'nav'        → pageLoad + pageLeave + externalLink
 *   - 'all'        → every observer
 *   - 'page-load', 'page-leave', 'external-link', 'form-submit', 'form-error' — individual
 */
export function parseObserveAttr(value: string | undefined): ObserveOptions {
  if (!value) return {};
  const tokens = value.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const opts: ObserveOptions = {};
  const has = (...keys: string[]): boolean => tokens.some((t) => keys.includes(t));
  const all = has('all');
  if (all || has('forms', 'form')) {
    opts.formSubmit = OBSERVE_DEFAULTS.formSubmit;
    opts.formError = OBSERVE_DEFAULTS.formError;
  }
  if (all || has('nav', 'navigation')) {
    opts.pageLoad = OBSERVE_DEFAULTS.pageLoad;
    opts.pageLeave = OBSERVE_DEFAULTS.pageLeave;
    opts.externalLink = OBSERVE_DEFAULTS.externalLink;
  }
  if (has('form-submit')) opts.formSubmit = OBSERVE_DEFAULTS.formSubmit;
  if (has('form-error')) opts.formError = OBSERVE_DEFAULTS.formError;
  if (has('page-load')) opts.pageLoad = OBSERVE_DEFAULTS.pageLoad;
  if (has('page-leave')) opts.pageLeave = OBSERVE_DEFAULTS.pageLeave;
  if (has('external-link')) opts.externalLink = OBSERVE_DEFAULTS.externalLink;
  return opts;
}

/**
 * Attach the requested observers. Returns a function that detaches them
 * all — call on unmount or when re-configuring.
 */
export function attachObservers(pet: AgentPetAPI, opts: ObserveOptions): () => void {
  if (typeof window === 'undefined') return () => {};
  const cleanups: Array<() => void> = [];

  if (opts.formSubmit) {
    const state = opts.formSubmit;
    const onSubmit = () => pet.play(state);
    document.addEventListener('submit', onSubmit, true);
    cleanups.push(() => document.removeEventListener('submit', onSubmit, true));
  }

  if (opts.formError) {
    const state = opts.formError;
    const onInvalid = () => pet.play(state);
    document.addEventListener('invalid', onInvalid, true);
    cleanups.push(() => document.removeEventListener('invalid', onInvalid, true));
  }

  if (opts.pageLoad) {
    const state = opts.pageLoad;
    if (document.readyState === 'loading') {
      const onLoad = () => pet.play(state);
      document.addEventListener('DOMContentLoaded', onLoad, { once: true });
      cleanups.push(() => document.removeEventListener('DOMContentLoaded', onLoad));
    } else {
      // Already loaded — fire on next microtask so the pet has time to mount.
      queueMicrotask(() => pet.play(state));
    }
  }

  if (opts.pageLeave) {
    const state = opts.pageLeave;
    const onLeave = () => pet.setState(state);
    window.addEventListener('beforeunload', onLeave);
    cleanups.push(() => window.removeEventListener('beforeunload', onLeave));
  }

  if (opts.externalLink) {
    const state = opts.externalLink;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest?.('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href) return;
      let isExternal = link.target === '_blank';
      if (!isExternal) {
        try {
          const url = new URL(href, window.location.href);
          isExternal = url.origin !== window.location.origin;
        } catch { /* invalid URL — treat as same-origin (no-op) */ }
      }
      if (isExternal) pet.play(state);
    };
    document.addEventListener('click', onClick, true);
    cleanups.push(() => document.removeEventListener('click', onClick, true));
  }

  return () => {
    for (const c of cleanups) c();
  };
}
