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
const DRAG_GESTURE_MIN_PX = 14;
const DRAG_AXIS_BIAS = 1.18;
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
  size?: number;
  onDismissSpeech?: () => void;
}

export class PetOverlayElement {
  private root: HTMLElement;
  private bubble: HTMLElement;
  private bubbleNameEl: HTMLElement;
  private bubbleTextEl: HTMLElement;
  private bubbleActions: HTMLElement;
  private spriteWrapper: HTMLElement;
  private sprite: PetSprite;
  private size: number;
  private position: Position;
  private positionKey: string;
  private onDismissSpeech?: () => void;

  // State
  private active: ResolvedPet | null = null;
  private hostState: WidgetState = 'idle';
  private gestureInteraction: PetInteraction | null = null;
  private currentSpeech: { text: string; link?: string } | null = null;
  private bubbleOpen = false;
  private hovered = false;
  private ambientIdx = 0;
  private ambientRowId: string | null = null;

  // Timers / refs
  private waitingTimer: ReturnType<typeof setTimeout> | null = null;
  private bubbleAutoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private ambientPlayTimer: ReturnType<typeof setTimeout> | null = null;
  private ambientRestTimer: ReturnType<typeof setTimeout> | null = null;
  private ambientLastPlayedId: string | undefined;
  private dragRef: {
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
    moved: boolean;
    direction: 'right' | 'left' | 'up' | 'down' | null;
  } | null = null;

  constructor(parent: ParentNode, opts: OverlayOptions) {
    this.size = opts.size ?? 96;
    this.positionKey = opts.positionKey;
    this.onDismissSpeech = opts.onDismissSpeech;
    this.position = loadPosition(this.positionKey);

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
    this.spriteWrapper.addEventListener('pointerdown', this.onPointerDown);
    this.spriteWrapper.addEventListener('pointermove', this.onPointerMove);
    this.spriteWrapper.addEventListener('pointerup', this.onPointerUp);
    this.spriteWrapper.addEventListener('pointerenter', this.onPointerEnter);
    this.spriteWrapper.addEventListener('pointerleave', this.onPointerLeave);

    this.armWaitingTimer();
  }

  // ── Public setters ────────────────────────────────────────────────

  setConfig(pet: PetConfig): void {
    const next = resolveActivePet(pet);
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

  setHostState(state: WidgetState): void {
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

  setSpeech(speech: { text: string; link?: string } | null): void {
    this.currentSpeech = speech;
    if (speech) this.openBubble();
    this.refreshBubble();
  }

  destroy(): void {
    if (this.waitingTimer) clearTimeout(this.waitingTimer);
    if (this.bubbleAutoCloseTimer) clearTimeout(this.bubbleAutoCloseTimer);
    this.clearAmbient();
    this.spriteWrapper.removeEventListener('pointerdown', this.onPointerDown);
    this.spriteWrapper.removeEventListener('pointermove', this.onPointerMove);
    this.spriteWrapper.removeEventListener('pointerup', this.onPointerUp);
    this.spriteWrapper.removeEventListener('pointerenter', this.onPointerEnter);
    this.spriteWrapper.removeEventListener('pointerleave', this.onPointerLeave);
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

  private activeRowId(): string {
    return this.ambientRowId ?? preferredRowId(this.computedInteraction());
  }

  private applyInteractionToSprite(): void {
    if (!this.active) return;
    this.sprite.setRow(this.activeRowId());
    this.spriteWrapper.dataset.petState = this.computedInteraction();
    if (this.ambientRowId) this.spriteWrapper.dataset.petAmbient = this.ambientRowId;
    else delete this.spriteWrapper.dataset.petAmbient;
  }

  // ── Pointer / drag handling ───────────────────────────────────────

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.dragRef = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startRight: this.position.right,
      startBottom: this.position.bottom,
      moved: false,
      direction: null,
    };
    this.armWaitingTimer();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.dragRef;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    this.position = {
      right: Math.max(8, Math.min(window.innerWidth - this.size - 24, drag.startRight - dx)),
      bottom: Math.max(8, Math.min(window.innerHeight - this.size - 24, drag.startBottom - dy)),
    };
    this.applyOverlayStyles();
    savePosition(this.positionKey, this.position);
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < DRAG_GESTURE_MIN_PX && absY < DRAG_GESTURE_MIN_PX) return;
    let dir: 'right' | 'left' | 'up' | 'down' | null = null;
    if (absX >= absY * DRAG_AXIS_BIAS) dir = dx > 0 ? 'right' : 'left';
    else if (absY >= absX * DRAG_AXIS_BIAS) dir = dy < 0 ? 'up' : 'down';
    if (dir && dir !== drag.direction) {
      drag.direction = dir;
      this.setGestureInteraction(
        dir === 'right' ? 'drag-right' :
        dir === 'left' ? 'drag-left' :
        dir === 'up' ? 'drag-up' : 'drag-down',
      );
    }
    this.armWaitingTimer();
  };

  private onPointerUp = (e: PointerEvent): void => {
    const drag = this.dragRef;
    this.dragRef = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (drag && !drag.moved) {
      this.bubbleOpen = !this.bubbleOpen;
      if (this.bubbleOpen) this.ambientIdx = (this.ambientIdx + 1) % Math.max(1, this.ambientLineCount());
      this.refreshBubble();
    }
    this.setGestureInteraction(this.hovered ? 'hover' : null);
    this.armWaitingTimer();
  };

  private onPointerEnter = (): void => {
    this.hovered = true;
    if (!this.dragRef) this.setGestureInteraction('hover');
    this.armWaitingTimer();
  };

  private onPointerLeave = (): void => {
    this.hovered = false;
    if (!this.dragRef) this.setGestureInteraction(null);
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
    this.bubble.style.cssText = [
      'background:var(--ap-bubble-bg, #1a1a1a)',
      `border:1.5px solid ${this.active.accent}`,
      'border-radius:10px',
      'padding:8px 10px',
      'max-width:240px',
      'font-size:12px',
      'color:var(--ap-bubble-text, #e8e8e8)',
      `box-shadow:0 2px 12px ${this.active.accent}33`,
    ].join(';');

    this.bubbleNameEl.textContent = this.active.name;
    this.bubbleNameEl.style.color = this.active.accent;

    this.bubbleTextEl.textContent = this.currentSpeech ? this.currentSpeech.text : this.visibleAmbientLine();

    // Re-render actions row
    this.bubbleActions.innerHTML = '';
    if (this.currentSpeech?.link) {
      const a = document.createElement('a');
      a.href = this.currentSpeech.link;
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
  }

  // ── Style helpers ─────────────────────────────────────────────────

  private applyOverlayStyles(): void {
    this.root.style.cssText = [
      'position:fixed',
      `right:${this.position.right}px`,
      `bottom:${this.position.bottom}px`,
      'z-index:9999',
      'display:flex',
      'flex-direction:column',
      'align-items:flex-end',
      'gap:8px',
      this.active ? `--pet-accent:${this.active.accent}` : '',
    ].filter(Boolean).join(';');
  }

  private applySpriteWrapperStyles(): void {
    const a = this.active;
    const animation = a && !a.atlas ? `ap-${a.animation} 3s ease-in-out infinite` : 'none';
    this.spriteWrapper.style.cssText = [
      `width:${this.size}px`,
      `height:${this.size}px`,
      'cursor:grab',
      'user-select:none',
      'border-radius:50%',
      `animation:${animation}`,
      'display:flex',
      'align-items:center',
      'justify-content:center',
      `font-size:${Math.round(this.size * 0.55)}px`,
    ].join(';');
  }
}
