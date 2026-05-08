// Vanilla DOM overlay. Replaces the React PetOverlay component for the
// widget builds (IIFE + ES module). Owns the DOM structure, drag handling,
// speech bubble, hover/drag gesture states, ambient choreography, and the
// 45s waiting timer. Receives state from the AgentPetAPI factory via setters.

import type { PetConfig, PetInteraction, ResolvedPet } from '../core/types';
import { ambientLines, pickAmbientRow, preferredRowId, resolveActivePet } from '../core/pets';
import { defaultPetAdapter } from '../core/adapters/default';
import type { WidgetState } from './api';
import { PetSprite } from './sprite';

const WAITING_AFTER_MS = 45000;
const AMBIENT_PLAY_MIN_MS = 1400;
const AMBIENT_PLAY_VARIANCE_MS = 900;
const AMBIENT_REST_MIN_MS = 9000;
const AMBIENT_REST_VARIANCE_MS = 9000;
const AMBIENT_INITIAL_DELAY_MIN_MS = 4000;
const AMBIENT_INITIAL_DELAY_VARIANCE_MS = 3000;
const BUBBLE_INITIAL_OPEN_MS = 4000;

interface Position {
  right: number;
  bottom: number;
}

const DEFAULT_POSITION: Position = { right: 24, bottom: 24 };

function loadPosition(key: string): Position {
  if (typeof window === 'undefined') return DEFAULT_POSITION;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return DEFAULT_POSITION;
    const parsed = JSON.parse(raw) as Partial<Position>;
    return {
      right: typeof parsed.right === 'number' ? parsed.right : DEFAULT_POSITION.right,
      bottom: typeof parsed.bottom === 'number' ? parsed.bottom : DEFAULT_POSITION.bottom,
    };
  } catch {
    return DEFAULT_POSITION;
  }
}

function savePosition(key: string, p: Position): void {
  try { window.localStorage.setItem(key, JSON.stringify(p)); } catch { /* ignore */ }
}

export interface OverlayOptions {
  positionKey: string;
  hiddenKey: string;
  size?: number;
  onDismissSpeech?: () => void;
  onHide?: () => void;
  onUserMessage?: (text: string) => void;
}

function loadHidden(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
}

function saveHidden(key: string, hidden: boolean): void {
  try { window.localStorage.setItem(key, hidden ? '1' : '0'); } catch { /* ignore */ }
}

/**
 * Resolve a speech-bubble link to a safe href, or null if the scheme isn't
 * an allowlisted navigation target. Blocks `javascript:`, `data:`, `vbscript:`
 * etc. — all of which `<a href>` would happily execute on click.
 */
function safeBubbleLink(link: string): string | null {
  try {
    // base = current document so relative URLs ('/results') still work.
    const u = new URL(link, typeof window !== 'undefined' ? window.location.href : 'http://x/');
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate a CSS color before interpolating into cssText. Accepts the common
 * palette syntaxes; rejects anything else so a hostile `accent` like
 * `red;background:url(javascript:0)` can't break out of its property.
 */
const ACCENT_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([0-9.,\s%/]+\)|hsla?\([0-9.,\s%/]+\))$/;
function safeAccent(accent: string | undefined, fallback: string): string {
  if (!accent) return fallback;
  return ACCENT_RE.test(accent.trim()) ? accent.trim() : fallback;
}

/** Drag bookkeeping shared between sprite and dock. */
interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startRight: number;
  startBottom: number;
  moved: boolean;
}

/** Direction is sprite-only; dock drag doesn't animate by direction. */
type DragDirection = 'right' | 'left' | 'up' | 'down';
const DRAG_GESTURE_MIN_PX = 14;
const DRAG_AXIS_BIAS = 1.18;

interface DraggableConfig {
  target: HTMLElement;
  /** How far the position is from each viewport edge before the drag starts.
   *  Used to clamp inside [8, viewport - size - 24]. */
  size: number;
  /** Read the current `{right, bottom}` position. */
  getPosition: () => Position;
  /** Apply a new position (caller is responsible for re-rendering). */
  setPosition: (p: Position) => void;
  /** Fired before drag starts. */
  onPointerDown?: () => void;
  /** Fired on every move tick after the 4px threshold; the direction is
   *  recomputed only when the dominant axis flips so consumers can debounce. */
  onDragDirection?: (dir: DragDirection) => void;
  /** Fired on `pointerup` (not `pointercancel`) when the user didn't drag. */
  onTap?: (e: PointerEvent) => void;
  /** Fired on every pointerup AND pointercancel — for cursor reset etc. */
  onEnd?: (didMove: boolean) => void;
}

/** Wires pointer-event drag listeners on `target` and returns a detach fn.
 *  Centralises the ref/capture/threshold/clamping logic so sprite and dock
 *  share the same robustness fixes (pointercancel, multi-touch reentrance). */
function attachDraggable(opts: DraggableConfig): () => void {
  let state: DragState | null = null;
  let direction: DragDirection | null = null;

  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    if (state) return; // multi-touch reentrance guard
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pos = opts.getPosition();
    state = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startRight: pos.right,
      startBottom: pos.bottom,
      moved: false,
    };
    direction = null;
    opts.onPointerDown?.();
  };

  const onMove = (e: PointerEvent): void => {
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    state.moved = true;
    opts.setPosition({
      right: Math.max(8, Math.min(window.innerWidth - opts.size - 24, state.startRight - dx)),
      bottom: Math.max(8, Math.min(window.innerHeight - opts.size - 24, state.startBottom - dy)),
    });
    if (opts.onDragDirection) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < DRAG_GESTURE_MIN_PX && absY < DRAG_GESTURE_MIN_PX) return;
      let next: DragDirection | null = null;
      if (absX >= absY * DRAG_AXIS_BIAS) next = dx > 0 ? 'right' : 'left';
      else if (absY >= absX * DRAG_AXIS_BIAS) next = dy < 0 ? 'up' : 'down';
      if (next && next !== direction) {
        direction = next;
        opts.onDragDirection(next);
      }
    }
  };

  const onUp = (e: PointerEvent): void => {
    const drag = state;
    state = null;
    direction = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (e.type === 'pointerup' && drag && !drag.moved) opts.onTap?.(e);
    opts.onEnd?.(drag?.moved ?? false);
  };

  opts.target.addEventListener('pointerdown', onDown);
  opts.target.addEventListener('pointermove', onMove);
  opts.target.addEventListener('pointerup', onUp);
  opts.target.addEventListener('pointercancel', onUp);

  return () => {
    opts.target.removeEventListener('pointerdown', onDown);
    opts.target.removeEventListener('pointermove', onMove);
    opts.target.removeEventListener('pointerup', onUp);
    opts.target.removeEventListener('pointercancel', onUp);
  };
}

export class PetOverlayElement {
  private root: HTMLElement;
  private bubble: HTMLElement;
  private bubbleNameEl: HTMLElement;
  private bubbleTextEl: HTMLElement;
  private bubbleActions: HTMLElement;
  private chatForm: HTMLFormElement | null = null;
  private chatInput: HTMLInputElement | null = null;
  private spriteWrapper: HTMLElement;
  private dock: HTMLButtonElement | null = null;
  private sprite: PetSprite;
  private size: number;
  private position: Position;
  private positionKey: string;
  private hiddenKey: string;
  private onDismissSpeech?: () => void;
  private onHide?: () => void;
  private onUserMessage?: (text: string) => void;
  private hidden = false;
  private chatEnabled = false;
  private chatPlaceholder = 'Ask…';

  // State
  private active: ResolvedPet | null = null;
  private hostState: string = 'idle';
  private gestureInteraction: PetInteraction | null = null;
  private currentSpeech: { text: string; link?: string } | null = null;
  private bubbleOpen = false;
  private hovered = false;
  private ambientIdx = 0;
  private ambientRowId: string | null = null;
  /** Set by beginAction() to override the row resolution while a manifest
   *  action is playing. Cleared by endAction(). */
  private actionMode: { rowId: string; expandUp?: number; expandDown?: number } | null = null;

  // Timers / refs
  private waitingTimer: ReturnType<typeof setTimeout> | null = null;
  private bubbleAutoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private ambientPlayTimer: ReturnType<typeof setTimeout> | null = null;
  private ambientRestTimer: ReturnType<typeof setTimeout> | null = null;
  private ambientLastPlayedId: string | undefined;
  private detachSpriteDrag: (() => void) | null = null;
  private detachDockDrag: (() => void) | null = null;
  private spriteDragInFlight = false;
  private dockDragInFlight = false;

  constructor(parent: ParentNode, opts: OverlayOptions) {
    this.size = opts.size ?? 96;
    this.positionKey = opts.positionKey;
    this.hiddenKey = opts.hiddenKey;
    this.onDismissSpeech = opts.onDismissSpeech;
    this.onHide = opts.onHide;
    this.onUserMessage = opts.onUserMessage;
    this.position = loadPosition(this.positionKey);
    this.hidden = loadHidden(this.hiddenKey);

    // ── Root overlay ────────────────────────────────────────────────
    this.root = document.createElement('div');
    this.root.className = 'ap-overlay';
    this.root.setAttribute('role', 'complementary');
    this.applyOverlayStyles();
    parent.appendChild(this.root);

    // ── Speech bubble ───────────────────────────────────────────────
    this.bubble = document.createElement('div');
    this.bubble.className = 'ap-bubble';
    this.bubble.setAttribute('role', 'status');
    this.bubble.style.display = 'none';

    this.bubbleNameEl = document.createElement('div');
    this.bubbleNameEl.style.cssText = 'font-weight:600;margin-bottom:2px';
    this.bubble.appendChild(this.bubbleNameEl);

    this.bubbleTextEl = document.createElement('div');
    this.bubbleTextEl.style.cssText = 'line-height:1.4';
    this.bubble.appendChild(this.bubbleTextEl);

    this.bubbleActions = document.createElement('div');
    this.bubbleActions.style.cssText = 'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap';
    this.bubble.appendChild(this.bubbleActions);

    this.root.appendChild(this.bubble);

    // ── Sprite wrapper (the draggable thing) ────────────────────────
    this.spriteWrapper = document.createElement('div');
    this.spriteWrapper.className = 'ap-sprite';
    this.applySpriteWrapperStyles();
    this.root.appendChild(this.spriteWrapper);

    this.sprite = new PetSprite(this.spriteWrapper, this.size);

    // ── Event listeners ─────────────────────────────────────────────
    this.detachSpriteDrag = attachDraggable({
      target: this.spriteWrapper,
      size: this.size,
      getPosition: () => this.position,
      setPosition: (p) => {
        this.position = p;
        this.applyOverlayStyles();
        savePosition(this.positionKey, this.position);
      },
      onPointerDown: () => {
        this.spriteDragInFlight = true;
        this.armWaitingTimer();
      },
      onDragDirection: (dir) => {
        this.setGestureInteraction(
          dir === 'right' ? 'drag-right' :
          dir === 'left'  ? 'drag-left'  :
          dir === 'up'    ? 'drag-up'    : 'drag-down',
        );
        this.armWaitingTimer();
      },
      onTap: () => {
        this.bubbleOpen = !this.bubbleOpen;
        if (this.bubbleOpen) this.ambientIdx = (this.ambientIdx + 1) % Math.max(1, this.ambientLineCount());
        this.refreshBubble();
      },
      onEnd: () => {
        this.spriteDragInFlight = false;
        this.setGestureInteraction(this.hovered ? 'hover' : null);
        this.armWaitingTimer();
      },
    });
    this.spriteWrapper.addEventListener('pointerenter', this.onPointerEnter);
    this.spriteWrapper.addEventListener('pointerleave', this.onPointerLeave);

    if (this.hidden) this.applyHiddenState();
    this.armWaitingTimer();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize);
    }
  }

  // Re-flip the bubble's anchor side when the viewport changes — without this,
  // a portrait→landscape rotate or window resize can leave the bubble running
  // off the wrong edge until the next state change.
  private onWindowResize = (): void => {
    if (this.bubbleOpen) this.refreshBubble();
  };

  // ── Public setters ────────────────────────────────────────────────

  setConfig(pet: PetConfig): void {
    const next = resolveActivePet(pet);
    // Sanitize accent at the boundary so every downstream cssText
    // interpolation is safe by construction. Falls back to the default if
    // the user-supplied value isn't an allowlisted color form.
    if (next) next.accent = safeAccent(next.accent, '#7eb8da');
    const isNewPet = !this.active || (next && this.active.id !== next.id);
    this.active = next;
    if (next) {
      this.root.setAttribute('aria-label', `${next.name} companion`);
      this.spriteWrapper.title = next.name;
      this.spriteWrapper.setAttribute('aria-label', `${next.name} pet`);
      this.root.style.setProperty('--pet-accent', next.accent);
      this.applySpriteWrapperStyles();
    } else {
      this.root.style.display = 'none';
      return;
    }
    this.root.style.display = '';
    this.sprite.setActive(next, this.activeRowId());
    this.refreshBubble();
    this.startAmbient();
    if (isNewPet) {
      this.openBubbleTransiently();
    }
  }

  setHostState(state: string): void {
    if (this.hostState === state) return;
    const wasIdle = this.computedInteraction() === 'idle';
    this.hostState = state;
    // Clear 'waiting' gesture override when we leave idle.
    if (this.computedInteraction() !== 'idle' && this.gestureInteraction === 'waiting') {
      this.gestureInteraction = null;
    }
    this.applyInteractionToSprite();
    // If non-idle, stop ambient choreography (matches React effect's behaviour).
    if (wasIdle && this.computedInteraction() !== 'idle') {
      this.clearAmbient();
    } else if (!wasIdle && this.computedInteraction() === 'idle') {
      this.startAmbient();
    }
  }

  /** Override the row currently being played, used by play() when a manifest
   *  action wants a specific row (and optional vertical expansion) regardless
   *  of the standard interaction-→-row mapping. Pair with endAction() to revert. */
  beginAction(rowId: string, opts: { expandUp?: number; expandDown?: number } = {}): void {
    this.actionMode = { rowId, expandUp: opts.expandUp, expandDown: opts.expandDown };
    this.clearAmbient();
    this.applySpriteWrapperStyles();
    this.applyInteractionToSprite();
  }

  endAction(): void {
    if (!this.actionMode) return;
    this.actionMode = null;
    this.applySpriteWrapperStyles();
    this.applyInteractionToSprite();
    if (this.computedInteraction() === 'idle') this.startAmbient();
  }

  /** Return the playback fps for a given row id from the active atlas, or
   *  undefined if the row isn't defined. Used by play() to time projectile
   *  spawns relative to the action's row frame rate. */
  rowFps(rowId: string): number | undefined {
    return this.active?.atlas?.rowsDef.find((r) => r.id === rowId)?.fps;
  }

  /** Return the row's frame count from the active atlas, or undefined. */
  rowFrames(rowId: string): number | undefined {
    return this.active?.atlas?.rowsDef.find((r) => r.id === rowId)?.frames;
  }

  /** Center of the sprite in viewport coordinates — used as the projectile
   *  spawn anchor. */
  spriteCenter(): { x: number; y: number } {
    const rect = this.spriteWrapper.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  /** The shadow root the overlay was attached to. Projectiles attach here
   *  so they share the pet's CSS scope. */
  getRoot(): HTMLElement {
    return this.root;
  }

  setSpeech(speech: { text: string; link?: string } | null): void {
    this.currentSpeech = speech;
    if (speech) this.openBubble();
    this.refreshBubble();
  }

  setChat(enabled: boolean, placeholder?: string): void {
    this.chatEnabled = enabled;
    if (placeholder) this.chatPlaceholder = placeholder;
    if (!enabled) this.removeChatInput();
    this.refreshBubble();
  }

  setHidden(hidden: boolean): void {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    saveHidden(this.hiddenKey, hidden);
    this.applyHiddenState();
  }

  isHidden(): boolean {
    return this.hidden;
  }

  destroy(): void {
    if (this.waitingTimer) clearTimeout(this.waitingTimer);
    if (this.bubbleAutoCloseTimer) clearTimeout(this.bubbleAutoCloseTimer);
    this.clearAmbient();
    this.detachSpriteDrag?.();
    this.detachSpriteDrag = null;
    this.detachDockDrag?.();
    this.detachDockDrag = null;
    this.spriteWrapper.removeEventListener('pointerenter', this.onPointerEnter);
    this.spriteWrapper.removeEventListener('pointerleave', this.onPointerLeave);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResize);
    }
    this.sprite.destroy();
    this.root.remove();
  }

  // ── Interaction state computation ─────────────────────────────────

  private baseInteraction(): PetInteraction {
    return defaultPetAdapter.map(this.hostState);
  }

  private computedInteraction(): PetInteraction {
    return this.gestureInteraction ?? this.baseInteraction();
  }

  /** Resolve the current row to render. Order:
   *   1. Active manifest action (set by beginAction)
   *   2. Ambient choreography
   *   3. Manifest stateMap routing the host state to a manifest action
   *   4. The host state itself if it directly matches an action id
   *   5. Fallback to preferredRowId for the standard interaction mapping
   */
  private activeRowId(): string {
    if (this.actionMode) return this.actionMode.rowId;
    if (this.ambientRowId) return this.ambientRowId;
    const actions = this.active?.actions;
    const sm = this.active?.stateMap;
    if (sm && actions) {
      const mapped = sm[this.hostState];
      if (mapped && actions[mapped]) return actions[mapped].row;
    }
    if (actions && actions[this.hostState]) return actions[this.hostState].row;
    return preferredRowId(this.computedInteraction());
  }

  private applyInteractionToSprite(): void {
    if (!this.active) return;
    this.sprite.setRow(this.activeRowId());
    this.spriteWrapper.dataset.petState = this.computedInteraction();
    if (this.ambientRowId) this.spriteWrapper.dataset.petAmbient = this.ambientRowId;
    else delete this.spriteWrapper.dataset.petAmbient;
  }

  // ── Pointer / drag handling ───────────────────────────────────────

  private onPointerEnter = (): void => {
    this.hovered = true;
    if (!this.spriteDragInFlight) this.setGestureInteraction('hover');
    this.armWaitingTimer();
  };

  private onPointerLeave = (): void => {
    this.hovered = false;
    if (!this.spriteDragInFlight) this.setGestureInteraction(null);
    this.armWaitingTimer();
  };

  private setGestureInteraction(g: PetInteraction | null): void {
    if (this.gestureInteraction === g) return;
    this.gestureInteraction = g;
    this.applyInteractionToSprite();
    if (this.computedInteraction() !== 'idle') this.clearAmbient();
    else this.startAmbient();
  }

  // ── Waiting + ambient ─────────────────────────────────────────────

  private armWaitingTimer(): void {
    if (this.waitingTimer) clearTimeout(this.waitingTimer);
    this.waitingTimer = setTimeout(() => {
      this.waitingTimer = null;
      if (this.gestureInteraction !== null) return;
      if (this.baseInteraction() !== 'idle') return;
      this.gestureInteraction = 'waiting';
      this.applyInteractionToSprite();
    }, WAITING_AFTER_MS);
  }

  private startAmbient(): void {
    this.clearAmbient();
    if (this.computedInteraction() !== 'idle') return;
    const atlas = this.active?.atlas;
    if (!atlas || atlas.rowsDef.length === 0) return;
    const initial = AMBIENT_INITIAL_DELAY_MIN_MS + Math.floor(Math.random() * AMBIENT_INITIAL_DELAY_VARIANCE_MS);
    this.ambientRestTimer = setTimeout(() => this.playAmbientBeat(), initial);
  }

  private playAmbientBeat = (): void => {
    const atlas = this.active?.atlas;
    if (!atlas) return;
    const def = pickAmbientRow(atlas, this.ambientLastPlayedId);
    if (!def) return;
    this.ambientLastPlayedId = def.id;
    this.ambientRowId = def.id;
    this.applyInteractionToSprite();
    const playMs = AMBIENT_PLAY_MIN_MS + Math.floor(Math.random() * AMBIENT_PLAY_VARIANCE_MS);
    this.ambientPlayTimer = setTimeout(() => {
      this.ambientRowId = null;
      this.applyInteractionToSprite();
      const restMs = AMBIENT_REST_MIN_MS + Math.floor(Math.random() * AMBIENT_REST_VARIANCE_MS);
      this.ambientRestTimer = setTimeout(this.playAmbientBeat, restMs);
    }, playMs);
  };

  private clearAmbient(): void {
    if (this.ambientPlayTimer) { clearTimeout(this.ambientPlayTimer); this.ambientPlayTimer = null; }
    if (this.ambientRestTimer) { clearTimeout(this.ambientRestTimer); this.ambientRestTimer = null; }
    if (this.ambientRowId !== null) {
      this.ambientRowId = null;
      this.applyInteractionToSprite();
    }
  }

  // ── Bubble ────────────────────────────────────────────────────────

  private openBubble(): void {
    this.bubbleOpen = true;
    if (this.bubbleAutoCloseTimer) clearTimeout(this.bubbleAutoCloseTimer);
    this.bubbleAutoCloseTimer = null;
  }

  private openBubbleTransiently(): void {
    this.bubbleOpen = true;
    this.refreshBubble();
    if (this.bubbleAutoCloseTimer) clearTimeout(this.bubbleAutoCloseTimer);
    this.bubbleAutoCloseTimer = setTimeout(() => {
      this.bubbleOpen = false;
      this.refreshBubble();
    }, BUBBLE_INITIAL_OPEN_MS);
  }

  private ambientLineCount(): number {
    return this.active ? 1 + ambientLines(this.active.name).length : 0;
  }

  private visibleAmbientLine(): string {
    if (!this.active) return '';
    const lines = [this.active.greeting, ...ambientLines(this.active.name)];
    return lines[this.ambientIdx % lines.length] ?? '';
  }

  private refreshBubble(): void {
    if (!this.active) return;
    if (!this.bubbleOpen) {
      this.bubble.style.display = 'none';
      return;
    }
    this.bubble.style.display = '';
    // Static styles live in pet.css under .ap-bubble; only the side-flip
    // class is dynamic. Accent-driven colours come from --pet-accent on
    // the overlay root, set in applyOverlayStyles().
    const anchorLeft = this.bubbleAnchorsLeft();
    this.bubble.classList.toggle('ap-bubble--left', anchorLeft);
    this.bubble.classList.toggle('ap-bubble--right', !anchorLeft);

    this.bubbleNameEl.textContent = this.active.name;
    this.bubbleNameEl.style.color = this.active.accent;

    this.bubbleTextEl.textContent = this.currentSpeech ? this.currentSpeech.text : this.visibleAmbientLine();

    // Re-render actions row
    this.bubbleActions.innerHTML = '';
    const safeLink = this.currentSpeech?.link ? safeBubbleLink(this.currentSpeech.link) : null;
    if (safeLink) {
      const a = document.createElement('a');
      a.href = safeLink;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Open →';
      a.style.cssText = [
        'display:flex', 'align-items:center', 'gap:3px', 'font-size:11px',
        `color:${this.active.accent}`, 'text-decoration:none',
        `border:1px solid ${this.active.accent}66`, 'border-radius:4px',
        'padding:2px 6px', 'font-weight:600',
      ].join(';');
      this.bubbleActions.appendChild(a);
    }
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = '✕ Dismiss';
    dismiss.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:11px;background:transparent;border:none;cursor:pointer;color:inherit;padding:0;opacity:0.7';
    dismiss.addEventListener('click', () => {
      this.bubbleOpen = false;
      if (this.currentSpeech) this.onDismissSpeech?.();
      this.refreshBubble();
    });
    this.bubbleActions.appendChild(dismiss);

    const hide = document.createElement('button');
    hide.type = 'button';
    hide.textContent = '⤓ Hide';
    hide.title = 'Minimize to dock';
    hide.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:11px;background:transparent;border:none;cursor:pointer;color:inherit;padding:0;opacity:0.7';
    hide.addEventListener('click', () => {
      this.setHidden(true);
      this.onHide?.();
    });
    this.bubbleActions.appendChild(hide);

    if (this.chatEnabled) this.renderChatInput();
    else this.removeChatInput();
  }

  // ── Style helpers ─────────────────────────────────────────────────

  private applyOverlayStyles(): void {
    this.root.style.cssText = [
      'position:fixed',
      `right:${this.position.right}px`,
      `bottom:${this.position.bottom}px`,
      'z-index:9999',
      // No flex layout — the bubble is position:absolute so it doesn't push
      // the sprite around when it opens. The sprite is the anchor; the
      // bubble's side flips in refreshBubble() based on screen position.
      this.active ? `--pet-accent:${this.active.accent}` : '',
    ].filter(Boolean).join(';');
  }

  private bubbleAnchorsLeft(): boolean {
    // Bubble anchors to the sprite's LEFT edge (extends rightward) when the
    // pet is in the left half of the viewport — otherwise the 240 px bubble
    // would clip off-screen to the left. Falls back to right-anchor if we
    // can't read viewport width (SSR / no window).
    if (typeof window === 'undefined') return false;
    const spriteLeft = window.innerWidth - this.position.right - this.size;
    return spriteLeft < window.innerWidth / 2;
  }

  private applySpriteWrapperStyles(): void {
    const a = this.active;
    const animation = a && !a.atlas ? `ap-${a.animation} 3s ease-in-out infinite` : 'none';
    // Manifest actions can request the sprite extend beyond its normal
    // bounding box (e.g. SHORYUKEN extends well above the cell). Apply
    // a uniform CSS scale anchored at the bottom-center so the feet stay
    // pinned to the cell baseline while the head and fist grow upward.
    const expandUp = this.actionMode?.expandUp ?? 0;
    const expandDown = this.actionMode?.expandDown ?? 0;
    const expandScale = expandUp || expandDown
      ? 1 + Math.max(expandUp, expandDown) / this.size
      : 1;
    this.spriteWrapper.style.cssText = [
      `width:${this.size}px`,
      `height:${this.size}px`,
      'cursor:grab',
      'user-select:none',
      // Disable native touch gestures (scroll, zoom, double-tap) on the
      // sprite so pointerdown/move/up fire on touch. Without this, mobile
      // browsers consume the touch as a scroll and never deliver pointer
      // events, making the pet undraggable. Restricted to the sprite —
      // outside it, the page scrolls/zooms normally.
      'touch-action:none',
      '-webkit-user-select:none',
      '-webkit-touch-callout:none',
      'border-radius:50%',
      `animation:${animation}`,
      'display:flex',
      'align-items:center',
      'justify-content:center',
      `font-size:${Math.round(this.size * 0.55)}px`,
      // Scale anchored at bottom-center so an enlarged action extends above
      // the cell (toward the page) rather than down off-screen. transition
      // softens the begin/end so the move doesn't snap.
      `transform:scale(${expandScale})`,
      `transform-origin:bottom center`,
      `transition:transform 180ms cubic-bezier(.2,.6,.3,1)`,
    ].join(';');
  }

  // ── Hidden / dock ─────────────────────────────────────────────────

  private applyHiddenState(): void {
    if (this.hidden) {
      this.bubbleOpen = false;
      this.bubble.style.display = 'none';
      this.spriteWrapper.style.display = 'none';
      this.clearAmbient();
      if (this.waitingTimer) { clearTimeout(this.waitingTimer); this.waitingTimer = null; }
      this.renderDock();
    } else {
      this.spriteWrapper.style.display = '';
      this.removeDock();
      this.armWaitingTimer();
      if (this.computedInteraction() === 'idle') this.startAmbient();
    }
  }

  private renderDock(): void {
    if (this.dock) return;
    const accent = this.active?.accent ?? '#7eb8da';
    const dockSize = Math.max(36, Math.round(this.size * 0.45));
    const imageUrl = this.active?.imageUrl;
    const atlas = this.active?.atlas;

    // Use the pet's sprite thumbnail when we have one — same first-cell crop
    // technique as the catalog buttons. Falls back to the pet's glyph (or 🐾)
    // when the active pet has no image configured.
    const bgStyles: string[] = [];
    let textGlyph = '';
    // JSON.stringify quotes the URL inside url(...) — same defensive pattern
    // sprite.ts uses to prevent CSS injection via attacker-supplied imageUrl.
    if (imageUrl && atlas) {
      bgStyles.push(
        `background-image:url(${JSON.stringify(imageUrl)})`,
        `background-size:${atlas.cols * 100}% ${atlas.rows * 100}%`,
        'background-position:0% 0%',
        'background-repeat:no-repeat',
        'image-rendering:pixelated',
      );
    } else if (imageUrl) {
      bgStyles.push(
        `background-image:url(${JSON.stringify(imageUrl)})`,
        'background-size:cover',
        'background-position:center',
        'background-repeat:no-repeat',
      );
    } else {
      textGlyph = this.active?.glyph ?? '🐾';
    }

    const dock = document.createElement('button');
    dock.type = 'button';
    dock.className = 'ap-dock';
    dock.setAttribute('aria-label', this.active ? `Show ${this.active.name}` : 'Show pet');
    dock.title = this.active ? `Show ${this.active.name}` : 'Show pet';
    if (textGlyph) dock.textContent = textGlyph;
    dock.style.cssText = [
      `width:${dockSize}px`,
      `height:${dockSize}px`,
      'border-radius:50%',
      'background-color:var(--ap-bubble-bg, #1a1a1a)',
      ...bgStyles,
      `border:1.5px solid ${accent}`,
      'color:inherit',
      `font-size:${Math.round(dockSize * 0.5)}px`,
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'cursor:grab',
      'pointer-events:auto',
      'padding:0',
      `box-shadow:0 2px 12px ${accent}33`,
      'transition:transform 120ms ease',
      'touch-action:none',
      'user-select:none',
      '-webkit-user-select:none',
      '-webkit-touch-callout:none',
    ].join(';');
    this.detachDockDrag?.();
    this.detachDockDrag = attachDraggable({
      target: dock,
      size: this.size,
      getPosition: () => this.position,
      setPosition: (p) => {
        this.position = p;
        this.applyOverlayStyles();
        savePosition(this.positionKey, this.position);
        dock.style.cursor = 'grabbing';
      },
      onPointerDown: () => { this.dockDragInFlight = true; },
      onTap: () => this.setHidden(false),
      onEnd: () => {
        this.dockDragInFlight = false;
        dock.style.cursor = 'grab';
      },
    });
    dock.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') dock.style.transform = 'scale(1.08)';
    });
    dock.addEventListener('pointerleave', () => { dock.style.transform = ''; });
    this.root.appendChild(dock);
    this.dock = dock;
  }

  private removeDock(): void {
    if (!this.dock) return;
    this.detachDockDrag?.();
    this.detachDockDrag = null;
    this.dock.remove();
    this.dock = null;
  }

  // ── Chat input ────────────────────────────────────────────────────

  private renderChatInput(): void {
    if (!this.active) return;
    if (this.chatForm) {
      const input = this.chatInput;
      if (input) input.placeholder = this.chatPlaceholder;
      return;
    }
    const form = document.createElement('form');
    form.className = 'ap-chat';
    form.setAttribute('role', 'search');
    form.setAttribute('aria-label', this.active ? `Send a message to ${this.active.name}` : 'Send a message');
    form.style.cssText = 'display:flex;gap:4px;margin-top:6px';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = this.chatPlaceholder;
    input.setAttribute('aria-label', this.chatPlaceholder);
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.cssText = [
      'flex:1', 'min-width:0', 'background:transparent',
      `border:1px solid ${this.active.accent}66`, 'border-radius:4px',
      'padding:3px 6px', 'font-size:11px', 'color:inherit', 'font:inherit',
      'outline:none',
    ].join(';');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; input.blur(); e.preventDefault(); }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      this.onUserMessage?.(text);
    });
    form.appendChild(input);
    this.bubble.appendChild(form);
    this.chatForm = form;
    this.chatInput = input;
  }

  private removeChatInput(): void {
    if (!this.chatForm) return;
    this.chatForm.remove();
    this.chatForm = null;
    this.chatInput = null;
  }
}
