'use client';

// Ported from nexu-io/open-design (Apache-2.0)
// https://github.com/nexu-io/open-design

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PetConfig, PetInteraction } from '../core/types';
import { ambientLines, pickAmbientRow, preferredRowId, resolveActivePet } from '../core/pets';
import { PetSpriteFace } from './PetSpriteFace';
import { IconSettings, IconClose } from './icons';
import { usePetContext } from './context';

interface Props {
  pet?: PetConfig;
  onOpenSettings?: () => void;
  onDismissSpeech?: () => void;
  size?: number;
  storageKey?: string;
  hostState?: string;
  /** Speech item pushed from the host's bus queue. Takes priority over ambient text. */
  currentSpeech?: { text: string; link?: string } | null;
}

const WAITING_AFTER_MS = 45000;
const AMBIENT_PLAY_MIN_MS = 1400;
const AMBIENT_PLAY_VARIANCE_MS = 900;
const AMBIENT_REST_MIN_MS = 9000;
const AMBIENT_REST_VARIANCE_MS = 9000;
const AMBIENT_INITIAL_DELAY_MIN_MS = 4000;
const AMBIENT_INITIAL_DELAY_VARIANCE_MS = 3000;
const DRAG_GESTURE_MIN_PX = 14;
const DRAG_AXIS_BIAS = 1.18;

interface Position { right: number; bottom: number; }
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
  } catch { return DEFAULT_POSITION; }
}

function savePosition(key: string, p: Position) {
  try { window.localStorage.setItem(key, JSON.stringify(p)); } catch { /* ignore */ }
}

export function PetOverlay({ onOpenSettings, onDismissSpeech, size = 96, storageKey = 'agent-pet:position', hostState, currentSpeech }: Props) {
  const { pet: ctxPet, adapter } = usePetContext();
  const active = useMemo(() => resolveActivePet(ctxPet), [ctxPet]);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [ambientIdx, setAmbientIdx] = useState(0);
  const [position, setPosition] = useState<Position>(() => loadPosition(storageKey));
  // gestureInteraction: pointer/drag override; null = fall through to baseInteraction
  const [gestureInteraction, setGestureInteraction] = useState<PetInteraction | null>(null);
  const baseInteraction = useMemo(() => adapter.map(hostState ?? 'idle'), [adapter, hostState]);
  const baseInteractionRef = useRef<PetInteraction>(baseInteraction);
  useEffect(() => { baseInteractionRef.current = baseInteraction; }, [baseInteraction]);
  // Clear 'waiting' gesture when agent becomes non-idle so agent state wins
  useEffect(() => {
    if (baseInteraction !== 'idle') setGestureInteraction((prev) => (prev === 'waiting' ? null : prev));
  }, [baseInteraction]);
  const interaction: PetInteraction = gestureInteraction ?? baseInteraction;
  const [ambientRowId, setAmbientRowId] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startRight: number; startBottom: number; moved: boolean; direction: 'right' | 'left' | 'up' | 'down' | null } | null>(null);
  const waitingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    setBubbleOpen(true);
    const id = window.setTimeout(() => setBubbleOpen(false), 4000);
    return () => window.clearTimeout(id);
  }, [active?.id]);

  // Open the bubble whenever the host pushes a new speech item.
  useEffect(() => {
    if (currentSpeech) setBubbleOpen(true);
  }, [currentSpeech]);

  useEffect(() => { savePosition(storageKey, position); }, [storageKey, position]);

  const lines = useMemo(() => active ? [active.greeting, ...ambientLines(active.name)] : [], [active]);
  const visibleLine = lines.length > 0 ? lines[ambientIdx % lines.length] : '';

  const armWaitingTimer = useCallback(() => {
    if (waitingTimerRef.current != null) window.clearTimeout(waitingTimerRef.current);
    waitingTimerRef.current = window.setTimeout(() => {
      setGestureInteraction((prev) => {
        if (prev !== null) return prev;
        if (baseInteractionRef.current !== 'idle') return null;
        return 'waiting';
      });
      waitingTimerRef.current = null;
    }, WAITING_AFTER_MS);
  }, []);

  useEffect(() => {
    if (!active) return;
    armWaitingTimer();
    return () => { if (waitingTimerRef.current != null) { window.clearTimeout(waitingTimerRef.current); waitingTimerRef.current = null; } };
  }, [active?.id, armWaitingTimer]);

  useEffect(() => {
    if (interaction !== 'idle') { setAmbientRowId(null); return; }
    const atlas = active?.atlas;
    if (!atlas || atlas.rowsDef.length === 0) return;
    let playTimer: number | undefined;
    let restTimer: number | undefined;
    let lastPlayedId: string | undefined;
    const playBeat = () => {
      const def = pickAmbientRow(atlas, lastPlayedId);
      if (!def) return;
      lastPlayedId = def.id;
      setAmbientRowId(def.id);
      const playMs = AMBIENT_PLAY_MIN_MS + Math.floor(Math.random() * AMBIENT_PLAY_VARIANCE_MS);
      playTimer = window.setTimeout(() => {
        setAmbientRowId(null);
        const restMs = AMBIENT_REST_MIN_MS + Math.floor(Math.random() * AMBIENT_REST_VARIANCE_MS);
        restTimer = window.setTimeout(playBeat, restMs);
      }, playMs);
    };
    const initialDelay = AMBIENT_INITIAL_DELAY_MIN_MS + Math.floor(Math.random() * AMBIENT_INITIAL_DELAY_VARIANCE_MS);
    restTimer = window.setTimeout(playBeat, initialDelay);
    return () => {
      if (playTimer != null) window.clearTimeout(playTimer);
      if (restTimer != null) window.clearTimeout(restTimer);
      setAmbientRowId(null);
    };
  }, [interaction, active?.id, active?.atlas]);

  if (!active) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startRight: position.right, startBottom: position.bottom, moved: false, direction: null };
    armWaitingTimer();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    setPosition({
      right: Math.max(8, Math.min(window.innerWidth - size - 24, drag.startRight - dx)),
      bottom: Math.max(8, Math.min(window.innerHeight - size - 24, drag.startBottom - dy)),
    });
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (absX < DRAG_GESTURE_MIN_PX && absY < DRAG_GESTURE_MIN_PX) return;
    let dir: 'right' | 'left' | 'up' | 'down' | null = null;
    if (absX >= absY * DRAG_AXIS_BIAS) dir = dx > 0 ? 'right' : 'left';
    else if (absY >= absX * DRAG_AXIS_BIAS) dir = dy < 0 ? 'up' : 'down';
    if (dir && dir !== drag.direction) {
      drag.direction = dir;
      setGestureInteraction(dir === 'right' ? 'drag-right' : dir === 'left' ? 'drag-left' : dir === 'up' ? 'drag-up' : 'drag-down');
    }
    armWaitingTimer();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (drag && !drag.moved) {
      setBubbleOpen((open) => {
        const next = !open;
        if (next) setAmbientIdx((i) => (i + 1) % Math.max(1, lines.length));
        return next;
      });
    }
    setGestureInteraction(hovered ? 'hover' : null);
    armWaitingTimer();
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    right: position.right,
    bottom: position.bottom,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
    // @ts-expect-error CSS custom property
    '--pet-accent': active.accent,
  };

  const spriteStyle: React.CSSProperties = {
    width: size,
    height: size,
    cursor: 'grab',
    userSelect: 'none',
    borderRadius: '50%',
    // Direct keyframe reference — `var()` for animation-name has uneven
    // support inside shadow DOM, so resolve the keyframe name eagerly.
    animation: active.atlas ? 'none' : `ap-${active.animation} 3s ease-in-out infinite`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.round(size * 0.55),
  };

  return (
    <div className="ap-overlay" style={overlayStyle} role="complementary" aria-label={`${active.name} companion`}>
      {bubbleOpen && (
        <div className="ap-bubble" role="status" style={{ background: 'var(--ap-bubble-bg, #1a1a1a)', border: `1.5px solid ${active.accent}`, borderRadius: 10, padding: '8px 10px', maxWidth: 240, fontSize: 12, color: 'var(--ap-bubble-text, #e8e8e8)', boxShadow: `0 2px 12px ${active.accent}33` }}>
          <div style={{ fontWeight: 600, marginBottom: 2, color: active.accent }}>{active.name}</div>
          <div style={{ lineHeight: 1.4 }}>{currentSpeech ? currentSpeech.text : visibleLine}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {currentSpeech?.link && (
              <a
                href={currentSpeech.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 3, fontSize: 11,
                  color: active.accent, textDecoration: 'none',
                  border: `1px solid ${active.accent}66`, borderRadius: 4,
                  padding: '2px 6px', fontWeight: 600,
                }}
              >
                Open →
              </a>
            )}
            {onOpenSettings && (
              <button type="button" onClick={onOpenSettings} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, opacity: 0.7 }}>
                <IconSettings size={11} /><span>Change pet</span>
              </button>
            )}
            <button type="button" onClick={() => { setBubbleOpen(false); if (currentSpeech) onDismissSpeech?.(); }} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, opacity: 0.7 }}>
              <IconClose size={11} /><span>Dismiss</span>
            </button>
          </div>
        </div>
      )}
      <div
        className="ap-sprite"
        style={spriteStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerEnter={() => { setHovered(true); if (!dragRef.current) setGestureInteraction('hover'); armWaitingTimer(); }}
        onPointerLeave={() => { setHovered(false); if (!dragRef.current) setGestureInteraction(null); armWaitingTimer(); }}
        title={active.name}
        aria-label={`${active.name} pet`}
        data-pet-state={interaction}
        data-pet-ambient={ambientRowId ?? undefined}
      >
        <PetSpriteFace
          active={active}
          className="ap-sprite-face"
          size={size}
          rowId={ambientRowId ?? preferredRowId(interaction)}
        />
      </div>
    </div>
  );
}
