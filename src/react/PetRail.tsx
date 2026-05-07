'use client';

// Ported from nexu-io/open-design (Apache-2.0)
// https://github.com/nexu-io/open-design

import { useEffect, useState } from 'react';
import { CUSTOM_PET_ID, defaultCustomPet, resolveActivePet } from '../core/pets';
import type { PetConfig } from '../core/types';
import { PetSpriteFace } from './PetSpriteFace';
import { usePetContext } from './context';
import { IconChevronLeft, IconChevronRight, IconClose } from './icons';

interface Props {
  onOpenPetSettings?: () => void;
  onHide?: () => void;
}

const COLLAPSED_KEY = 'agent-pet:rail-collapsed';

function loadCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}

export function PetRail({ onOpenPetSettings, onHide }: Props) {
  const { pet, setPet } = usePetContext();
  const [collapsed, setCollapsed] = useState<boolean>(() => loadCollapsed());

  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  const activeId = pet.adopted ? pet.petId : null;
  const customPet: PetConfig = { ...pet, custom: pet.custom ?? defaultCustomPet() };

  const adopt = (petId: string) => setPet({ ...pet, adopted: true, enabled: true, petId });
  const toggleEnabled = () => setPet({ ...pet, enabled: !pet.enabled });

  const s: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255,255,255,0.03)',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    transition: 'width 0.2s ease',
    width: collapsed ? 40 : 180,
    minWidth: collapsed ? 40 : 180,
    overflow: 'hidden',
    flexShrink: 0,
  };

  if (collapsed) {
    return (
      <aside style={s} aria-label="Pet companions">
        <button type="button" onClick={() => setCollapsed(false)} title="Expand pet rail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '12px 0', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', width: '100%' }}>
          <span aria-hidden>🐾</span>
          <IconChevronLeft size={12} />
        </button>
      </aside>
    );
  }

  return (
    <aside style={s} aria-label="Pet companions">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
          <span aria-hidden>🐾</span>
          <span>Pets</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" onClick={() => setCollapsed(true)} title="Collapse" style={iconBtn}>
            <IconChevronRight size={12} />
          </button>
          {onHide && (
            <button type="button" onClick={onHide} title="Hide rail" style={iconBtn}>
              <IconClose size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {pet.adopted ? (
          <button type="button" onClick={toggleEnabled} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, opacity: 0.75 }}>
            <span>{pet.enabled ? '👁 Dismiss' : '✨ Wake'}</span>
          </button>
        ) : (
          <span style={{ fontSize: 11, opacity: 0.5 }}>Adopt a pet to get started</span>
        )}
      </div>

      {/* Custom pet entry */}
      <button type="button" onClick={() => adopt(CUSTOM_PET_ID)} aria-pressed={activeId === CUSTOM_PET_ID} style={{ ...railItem, ...(activeId === CUSTOM_PET_ID ? railItemActive : {}), borderColor: customPet.custom.accent }}>
        <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <PetSpriteFace active={resolveActivePet({ ...customPet, adopted: true, petId: CUSTOM_PET_ID })!} size={24} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{customPet.custom.name || 'Custom'}</span>
          <span style={{ fontSize: 10, opacity: 0.5 }}>Your pet</span>
        </span>
      </button>

      {/* Customize link */}
      {onOpenPetSettings && (
        <button type="button" onClick={onOpenPetSettings} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 10px', marginTop: 'auto', background: 'transparent', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 11, color: 'inherit', opacity: 0.7, width: '100%' }}>
          <span>✨</span><span>Customize pet</span>
        </button>
      )}
    </aside>
  );
}

const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 3, display: 'flex', alignItems: 'center', opacity: 0.6, borderRadius: 4 };
const railItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', color: 'inherit', width: '100%', textAlign: 'left' };
const railItemActive: React.CSSProperties = { background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.12)' };
