'use client';

// Ported from nexu-io/open-design (Apache-2.0)
// https://github.com/nexu-io/open-design

import { useEffect, useState, type CSSProperties } from 'react';
import type { PetAtlasRowDef } from '../core/types';
import type { ResolvedPet } from '../core/types';

interface Props {
  active: ResolvedPet;
  className?: string;
  size?: number;
  rowId?: string;
}

export function PetSpriteFace({ active, className, size, rowId }: Props) {
  if (!active.imageUrl) {
    const style: CSSProperties | undefined = size
      ? { fontSize: Math.round(size * 0.85), width: size, height: size, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }
      : undefined;
    return <span className={className} aria-hidden style={style}>{active.glyph}</span>;
  }

  if (active.atlas && active.atlas.rowsDef.length > 0) {
    return (
      <AtlasSprite
        imageUrl={active.imageUrl}
        cols={Math.max(1, active.atlas.cols)}
        rows={Math.max(1, active.atlas.rows)}
        rowsDef={active.atlas.rowsDef}
        rowId={rowId}
        className={className}
        size={size}
      />
    );
  }

  const frames = Math.max(1, active.frames ?? 1);
  const fps = Math.max(1, active.fps ?? 6);

  if (frames === 1) {
    return (
      <span
        className={`${className ?? ''} ap-image ap-static`.trim()}
        aria-hidden
        style={{ backgroundImage: `url(${active.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', width: size, height: size, display: 'inline-block' }}
      />
    );
  }

  const durationMs = Math.round((frames / fps) * 1000);
  return (
    <span
      className={`${className ?? ''} ap-image ap-frames`.trim()}
      aria-hidden
      style={{
        backgroundImage: `url(${active.imageUrl})`,
        backgroundSize: `${frames * 100}% 100%`,
        animation: `ap-frames ${durationMs}ms steps(${frames}, jump-none) infinite`,
        width: size,
        height: size,
        display: 'inline-block',
      }}
    />
  );
}

interface AtlasSpriteProps {
  imageUrl: string;
  cols: number;
  rows: number;
  rowsDef: PetAtlasRowDef[];
  rowId?: string;
  className?: string;
  size?: number;
}

function AtlasSprite({ imageUrl, cols, rows, rowsDef, rowId, className, size }: AtlasSpriteProps) {
  const def = rowsDef.find((r) => r.id === rowId) ?? rowsDef.find((r) => r.id === 'idle') ?? rowsDef[0]!;
  const rowFrames = Math.max(1, def.frames);
  const fps = Math.max(1, def.fps);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (rowFrames <= 1) return;
    const intervalMs = Math.max(16, Math.round(1000 / fps));
    const id = window.setInterval(() => setFrame((f) => (f + 1) % rowFrames), intervalMs);
    return () => window.clearInterval(id);
  }, [def.id, def.index, rowFrames, fps]);

  const xPct = cols > 1 ? (frame / (cols - 1)) * 100 : 0;
  const yPct = rows > 1 ? (def.index / (rows - 1)) * 100 : 0;

  return (
    <span
      className={`${className ?? ''} ap-image ap-atlas`.trim()}
      aria-hidden
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${xPct}% ${yPct}%`,
        transition: 'background-position-y 220ms ease',
        width: size,
        height: size,
        display: 'inline-block',
      }}
    />
  );
}
