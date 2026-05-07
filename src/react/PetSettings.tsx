'use client';

// Ported from nexu-io/open-design (Apache-2.0)
// https://github.com/nexu-io/open-design

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CatalogPet, PetConfig, PetCustom, PetLibraryEntry } from '../core/types';
import { LocalStoragePetLibrary } from '../core/types';
import { CUSTOM_PET_ID, defaultCustomPet, FPS_MAX, FPS_MIN, FRAMES_MAX, FRAMES_MIN, resolveActivePet } from '../core/pets';
import { CODEX_ATLAS_COLS, CODEX_ATLAS_ROWS, CODEX_ATLAS_ROWS_DEF, cropAtlasRow, loadAtlasImageFromFile, looksLikeCodexAtlas, prepareCodexAtlas } from '../core/atlas';
import { loadPetImageFromFile } from '../core/image';
import { PetSpriteFace } from './PetSpriteFace';
import { usePetContext } from './context';
import { mergeIcons, type PetIcons } from './icon-set';
import { mergeMessages } from './messages';

const ACCENT_SWATCHES = ['#c96442', '#2348b8', '#1f7a3a', '#6c3aa6', '#d97a26', '#9c2a25', '#74716b', '#0d0c0a'];

const DEFAULT_PET: PetConfig = { adopted: false, enabled: true, petId: CUSTOM_PET_ID, custom: defaultCustomPet() };

type PetSourceTab = 'builtIn' | 'custom' | 'community';

interface AtlasPreview { dataUrl: string; width: number; height: number; }

interface PetSettingsProps {
  /** Override user-facing strings for i18n. Any omitted key falls back to
   *  the English default exported as DEFAULT_PET_MESSAGES. */
  messages?: Partial<import('./messages').PetMessages>;
  /** Override the bundled SVG icons with your own design-system icons.
   *  Any omitted slot falls back to the bundled defaults. */
  icons?: Partial<PetIcons>;
}

export function PetSettings({ messages: messageOverrides, icons: iconOverrides }: PetSettingsProps = {}) {
  const { pet, setPet, catalog } = usePetContext();
  const m = mergeMessages(messageOverrides);
  const I = mergeIcons(iconOverrides);
  const glyphId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const atlasInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [atlasPreview, setAtlasPreview] = useState<AtlasPreview | null>(null);
  const [atlasRowIndex, setAtlasRowIndex] = useState(0);
  const [atlasBusy, setAtlasBusy] = useState(false);
  const [hatchConcept, setHatchConcept] = useState('');
  const [hatchCopied, setHatchCopied] = useState(false);
  const [catalogPets, setCatalogPets] = useState<CatalogPet[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogAdopting, setCatalogAdopting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ kind: 'done'; wrote: number; total: number } | { kind: 'error'; error: string } | null>(null);
  const petLibrary = useMemo(() => new LocalStoragePetLibrary(), []);
  const [library, setLibrary] = useState<PetLibraryEntry[]>(() => typeof window !== 'undefined' ? petLibrary.load() : []);
  const refreshLibrary = useCallback(() => setLibrary(petLibrary.load()), [petLibrary]);

  const initialTab: PetSourceTab = pet.petId === CUSTOM_PET_ID && pet.custom.imageUrl && !pet.custom.atlas ? 'custom' : 'builtIn';
  const [activeTab, setActiveTab] = useState<PetSourceTab>(initialTab);

  useEffect(() => { if (atlasPreview) setActiveTab('custom'); }, [atlasPreview]);

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const result = await catalog.fetchList();
      setCatalogPets(result.pets);
    } finally {
      setCatalogLoading(false);
    }
  }, [catalog]);

  useEffect(() => { if (activeTab === 'community') void refreshCatalog(); }, [activeTab, refreshCatalog]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const result = await catalog.sync('all');
      setSyncStatus(result.error ? { kind: 'error', error: result.error } : { kind: 'done', wrote: result.wrote, total: result.total });
      await refreshCatalog();
    } catch (err) {
      setSyncStatus({ kind: 'error', error: err instanceof Error ? err.message : 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  }, [catalog, refreshCatalog]);

  const update = (patch: Partial<PetConfig>) => {
    const prev = pet ?? DEFAULT_PET;
    setPet({ ...prev, ...patch, custom: { ...prev.custom, ...(patch.custom ?? {}) } });
  };

  const adopt = (petId: string) => update({ adopted: true, enabled: true, petId });

  const patchCustom = (patch: Partial<PetCustom>, options?: { focusCustom?: boolean }) => {
    const prev = pet ?? DEFAULT_PET;
    const nextCustom: PetCustom = { ...prev.custom, ...patch };
    const shouldFocus = options?.focusCustom && nextCustom.imageUrl;
    setPet({ ...prev, adopted: shouldFocus ? true : prev.adopted, enabled: shouldFocus ? true : prev.enabled, petId: shouldFocus ? CUSTOM_PET_ID : prev.petId, custom: nextCustom });
  };

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const probe = await probeImageDimensions(file);
      if (probe && looksLikeCodexAtlas(probe.width, probe.height)) {
        setAtlasPreview(await loadAtlasImageFromFile(file));
        setAtlasRowIndex(0);
        return;
      }
      const result = await loadPetImageFromFile(file);
      const aspectGuess = result.width / Math.max(1, result.height) >= 1.6 ? Math.min(FRAMES_MAX, Math.max(2, Math.round(result.width / result.height))) : 1;
      patchCustom({ imageUrl: result.dataUrl, frames: aspectGuess, fps: pet.custom.fps ?? 6 }, { focusCustom: true });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not load that image.');
    } finally {
      setUploading(false);
    }
  }

  async function handleAtlasFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setAtlasBusy(true);
    try {
      setAtlasPreview(await loadAtlasImageFromFile(file));
      setAtlasRowIndex(0);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not load that atlas.');
    } finally {
      setAtlasBusy(false);
    }
  }

  async function commitAtlasRow() {
    if (!atlasPreview) return;
    const def = CODEX_ATLAS_ROWS_DEF.find((r) => r.index === atlasRowIndex);
    setAtlasBusy(true);
    try {
      const cropped = await cropAtlasRow(atlasPreview.dataUrl, { rowIndex: atlasRowIndex, cols: CODEX_ATLAS_COLS, rows: CODEX_ATLAS_ROWS });
      patchCustom({ imageUrl: cropped.dataUrl, frames: cropped.frames, fps: def?.fps ?? pet.custom.fps ?? 6, atlas: undefined }, { focusCustom: true });
      setAtlasPreview(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not crop that row.');
    } finally {
      setAtlasBusy(false);
    }
  }

  async function commitFullAtlas() {
    if (!atlasPreview) return;
    setAtlasBusy(true);
    try {
      const prepared = await prepareCodexAtlas(atlasPreview.dataUrl);
      patchCustom({ imageUrl: prepared.dataUrl, atlas: prepared.layout, frames: 1, fps: prepared.layout.rowsDef[0]?.fps ?? pet.custom.fps ?? 6 }, { focusCustom: true });
      setAtlasPreview(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not import that atlas.');
    } finally {
      setAtlasBusy(false);
    }
  }

  async function adoptCatalogPet(p: CatalogPet) {
    setCatalogAdopting(p.id);
    setUploadError(null);
    try {
      const resp = await fetch(p.spritesheetUrl);
      if (!resp.ok) throw new Error('Could not download that pet.');
      const blob = await resp.blob();
      const dataUrl = await blobToDataUrl(blob);
      const prepared = await prepareCodexAtlas(dataUrl);
      const newCustom: PetCustom = {
        name: p.displayName || p.id,
        glyph: pet.custom.glyph || '🐾',
        accent: pet.custom.accent || '#c96442',
        greeting: p.description || `Hi! I am ${p.displayName}.`,
        imageUrl: prepared.dataUrl,
        frames: 1,
        fps: prepared.layout.rowsDef[0]?.fps ?? 6,
        atlas: prepared.layout,
      };
      petLibrary.add({ id: p.id, adoptedAt: Date.now(), custom: newCustom });
      refreshLibrary();
      patchCustom(newCustom, { focusCustom: true });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not adopt that pet.');
    } finally {
      setCatalogAdopting(null);
    }
  }

  function switchToLibraryPet(entry: PetLibraryEntry) {
    update({ adopted: true, enabled: true, petId: entry.id, custom: entry.custom });
  }

  function removeFromLibrary(id: string) {
    petLibrary.remove(id);
    refreshLibrary();
  }

  const hatchPrompt = useMemo(() => {
    const concept = hatchConcept.trim();
    const intro = concept ? `Hatch a Codex-compatible animated pet for me. Concept: ${concept}.` : 'Hatch a Codex-compatible animated pet for me.';
    return [intro, '', 'Use the @hatch-pet skill end-to-end:', '1. Generate the base look with $imagegen.', '2. Generate every row strip (idle, running-right, waving, jumping, failed, waiting, running, review).', '3. Mirror running-left from running-right only when the design is symmetric.', '4. Run the deterministic scripts (extract / compose / validate / contact-sheet / videos).', '5. Package the result with pet.json + spritesheet.webp.', '', 'When the spritesheet is saved, tell me the path so I can import it via Settings → Pets → Import Codex sprite.'].join('\n');
  }, [hatchConcept]);

  async function copyHatchPrompt() {
    try { await navigator.clipboard.writeText(hatchPrompt); setHatchCopied(true); window.setTimeout(() => setHatchCopied(false), 1800); }
    catch { setHatchCopied(false); }
  }

  const customPreview = resolveActivePet({ ...pet, adopted: true, petId: CUSTOM_PET_ID })!;
  const bundledPets = useMemo(() => catalogPets.filter((p) => p.bundled), [catalogPets]);
  const communityPets = useMemo(() => catalogPets.filter((p) => !p.bundled), [catalogPets]);

  const tabHints: Record<PetSourceTab, string> = {
    builtIn: 'Curated pets — click to adopt',
    custom: 'Upload your own sprite or atlas',
    community: 'Sync pets from the community catalog',
  };

  const s = styles;

  function renderCatalogCard(p: CatalogPet) {
    const adopting = catalogAdopting === p.id;
    const libraryEntry = library.find(e => e.id === p.id);
    const inLibrary = !!libraryEntry;
    const isActive = inLibrary && pet.adopted && !!libraryEntry?.custom.imageUrl && libraryEntry.custom.imageUrl === pet.custom.imageUrl;
    return (
      <div key={p.id} style={{ ...s.card, ...(isActive ? s.cardActive : {}) }}>
        <div style={{ ...s.cardThumb, backgroundImage: `url(${p.spritesheetUrl})`, backgroundSize: '800% 900%', backgroundPosition: '0% 0%' }} aria-hidden />
        <div style={s.cardMeta}>
          <strong style={{ fontSize: 12 }}>{p.displayName}</strong>
          {p.description && <span style={{ fontSize: 11, opacity: 0.7 }}>{p.description}</span>}
        </div>
        {isActive ? (
          <button type="button" style={{ ...s.btn, ...s.btnActive }} disabled aria-pressed>
            <I.Check size={11} /><span>{m.active}</span>
          </button>
        ) : inLibrary ? (
          <button type="button" style={s.btn} onClick={() => switchToLibraryPet(libraryEntry!)} disabled={catalogAdopting !== null}>
            <I.Sparkles size={11} /><span>{m.switch}</span>
          </button>
        ) : (
          <button type="button" style={s.btn} onClick={() => void adoptCatalogPet(p)} disabled={adopting || catalogAdopting !== null}>
            {adopting ? <I.Spinner size={11} /> : <I.Download size={11} />}
            <span>{adopting ? 'Downloading…' : 'Adopt'}</span>
          </button>
        )}
      </div>
    );
  }

  function renderLibraryCard(entry: PetLibraryEntry) {
    const isActive = pet.adopted && !!entry.custom.imageUrl && entry.custom.imageUrl === pet.custom.imageUrl;
    const thumb = entry.custom.imageUrl;
    return (
      <div key={entry.id} style={{ ...s.card, ...(isActive ? s.cardActive : {}) }}>
        <div style={{ ...s.cardThumb, ...(thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: entry.custom.atlas ? '800% 900%' : `${entry.custom.frames ?? 1}00% 100%`, backgroundPosition: '0% 0%' } : { background: (entry.custom.accent ?? '#c96442') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }) }} aria-hidden>
          {!thumb && <span>{entry.custom.glyph || '🐾'}</span>}
        </div>
        <div style={s.cardMeta}>
          <strong style={{ fontSize: 12 }}>{entry.custom.name}</strong>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {isActive ? (
            <button type="button" style={{ ...s.btn, ...s.btnActive, flex: 1 }} disabled>
              <I.Check size={11} /><span>{m.active}</span>
            </button>
          ) : (
            <button type="button" style={{ ...s.btn, flex: 1 }} onClick={() => switchToLibraryPet(entry)}>
              <I.Sparkles size={11} /><span>{m.switch}</span>
            </button>
          )}
          <button type="button" style={{ ...s.btn, ...s.btnGhost, padding: '4px 7px' }} onClick={() => removeFromLibrary(entry.id)} title={m.removeFromCollection}>
            <I.Close size={11} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section style={s.section}>
      {/* Header */}
      <div style={s.sectionHead}>
        <div>
          <h3 style={s.h3}>{m.companionPet}</h3>
          <p style={s.hint}>{m.companionTagline}</p>
        </div>
        <button type="button" style={{ ...s.btn, ...(pet.enabled ? s.btnActive : {}) }} onClick={() => update({ enabled: !pet.enabled, adopted: pet.adopted || pet.petId !== '' })} disabled={!pet.adopted} title={pet.enabled ? m.dismissPet : m.wakePet}>
          {pet.enabled ? <I.Eye size={13} /> : <I.Sparkles size={13} />}
          <span>{pet.enabled ? 'Dismiss' : 'Wake'}</span>
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={s.tabList} role="tablist" aria-label={m.petSourceLabel}>
          {(['builtIn', 'custom', 'community'] as PetSourceTab[]).map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} style={{ ...s.tab, ...(activeTab === tab ? s.tabActive : {}) }} onClick={() => setActiveTab(tab)}>
              {tab === 'builtIn' ? m.builtInTab : tab === 'custom' ? m.customTab : m.communityTab}
            </button>
          ))}
        </div>
        <p style={s.hint}>{tabHints[activeTab]}</p>
      </div>

      {/* Built-in tab */}
      {activeTab === 'builtIn' && (
        <div>
          {bundledPets.length === 0 ? (
            <p style={s.hint}>{catalogLoading ? 'Loading…' : 'No bundled pets available. Sync from the Community tab to fetch some.'}</p>
          ) : (
            <div style={s.grid}>{bundledPets.map(renderCatalogCard)}</div>
          )}
          {uploadError && <p style={{ ...s.hint, color: '#e05555' }}>{uploadError}</p>}
        </div>
      )}

      {/* Custom tab */}
      {activeTab === 'custom' && (
        <div>
          {/* Custom head */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <strong style={{ fontSize: 13 }}>{m.yourPet}</strong>
              <p style={s.hint}>{m.customizeTagline}</p>
            </div>
            <button type="button" style={{ ...s.btn, ...(pet.adopted && pet.petId === CUSTOM_PET_ID ? s.btnActive : {}) }} onClick={() => adopt(CUSTOM_PET_ID)}>
              {pet.adopted && pet.petId === CUSTOM_PET_ID ? <I.Check size={11} /> : <I.Sparkles size={11} />}
              <span>{pet.adopted && pet.petId === CUSTOM_PET_ID ? 'Active' : 'Use this pet'}</span>
            </button>
          </div>

          {/* Live preview */}
          <div style={{ ...s.preview, borderColor: pet.custom.accent }}>
            <span style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PetSpriteFace active={customPreview} size={48} />
            </span>
            <div style={{ marginLeft: 10 }}>
              <strong style={{ fontSize: 13, color: pet.custom.accent }}>{pet.custom.name || 'Buddy'}</strong>
              <p style={{ ...s.hint, marginTop: 2 }}>{pet.custom.greeting || 'Hi! I am here whenever you need me.'}</p>
            </div>
          </div>

          {/* Image upload */}
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" style={{ display: 'none' }} onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={atlasInputRef} type="file" accept="image/png,image/webp,image/jpeg,image/gif" style={{ display: 'none' }} onChange={(e) => { void handleAtlasFile(e.target.files?.[0]); e.target.value = ''; }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <button type="button" style={s.btn} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <I.Spinner size={11} /> : <I.Upload size={11} />}
              <span>{pet.custom.imageUrl ? m.upload + ' (replace)' : m.upload}</span>
            </button>
            <button type="button" style={{ ...s.btn, ...s.btnGhost }} onClick={() => atlasInputRef.current?.click()} disabled={atlasBusy} title={m.importAtlasTitle}>
              {atlasBusy ? <I.Spinner size={11} /> : <I.Sparkles size={11} />}
              <span>{m.importCodexAtlas}</span>
            </button>
            {pet.custom.imageUrl && (
              <button type="button" style={{ ...s.btn, ...s.btnGhost }} onClick={() => patchCustom({ imageUrl: undefined, frames: 1, atlas: undefined })}>
                <I.Close size={11} /><span>{m.remove}</span>
              </button>
            )}
          </div>
          {pet.custom.imageUrl && pet.custom.atlas && <p style={{ ...s.hint, color: '#4ec9e0' }}>{m.atlasActiveNote}</p>}
          {pet.custom.imageUrl && !pet.custom.atlas && (
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              <label style={s.field}>
                <span style={s.fieldLabel}>{m.frames}</span>
                <input type="number" min={FRAMES_MIN} max={FRAMES_MAX} step={1} value={pet.custom.frames ?? 1} onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) patchCustom({ frames: n }); }} style={s.input} />
                <p style={s.hint}>{m.framesHint}</p>
              </label>
              <label style={s.field}>
                <span style={s.fieldLabel}>{m.fps}</span>
                <input type="number" min={FPS_MIN} max={FPS_MAX} step={1} value={pet.custom.fps ?? 6} onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) patchCustom({ fps: n }); }} style={s.input} />
                <p style={s.hint}>{m.fpsHint}</p>
              </label>
            </div>
          )}
          {uploadError && <p style={{ ...s.hint, color: '#e05555', marginTop: 4 }}>{uploadError}</p>}

          {/* Atlas row picker */}
          {atlasPreview && (
            <div style={s.atlasPicker}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <strong style={{ fontSize: 13 }}>{m.atlasRowPicker}</strong>
                  <p style={s.hint}>{m.atlasPickerHint}</p>
                </div>
                <button type="button" style={{ ...s.btn, ...s.btnGhost }} onClick={() => setAtlasPreview(null)} disabled={atlasBusy}>
                  <I.Close size={11} /><span>{m.cancel}</span>
                </button>
              </div>
              <div style={{ width: '100%', height: 80, backgroundImage: `url(${atlasPreview.dataUrl})`, backgroundSize: '100% auto', backgroundRepeat: 'no-repeat', borderRadius: 6, marginBottom: 8 }} aria-hidden />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} role="radiogroup" aria-label={m.animationRowsLabel}>
                {CODEX_ATLAS_ROWS_DEF.map((row) => {
                  const isActive = row.index === atlasRowIndex;
                  return (
                    <button key={row.id} type="button" role="radio" aria-checked={isActive} style={{ ...s.atlasRow, ...(isActive ? s.atlasRowActive : {}) }} onClick={() => setAtlasRowIndex(row.index)} disabled={atlasBusy}>
                      <span style={{ flex: 1, textAlign: 'left', textTransform: 'capitalize' }}>{row.id.replace(/-/g, ' ')}</span>
                      <span style={{ opacity: 0.6, fontSize: 11 }}>{row.frames} frames · {row.fps} fps</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button type="button" style={s.btn} onClick={() => void commitFullAtlas()} disabled={atlasBusy} title={m.useAllRowsTitle}>
                  {atlasBusy ? <I.Spinner size={11} /> : <I.Sparkles size={11} />}
                  <span>{m.useFullAtlas}</span>
                </button>
                <button type="button" style={{ ...s.btn, ...s.btnGhost }} onClick={() => void commitAtlasRow()} disabled={atlasBusy} title={m.cropRowTitle}>
                  {atlasBusy ? <I.Spinner size={11} /> : <I.Check size={11} />}
                  <span>{m.useThisRow}</span>
                </button>
              </div>
            </div>
          )}

          {/* Text fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            <label style={s.field}>
              <span style={s.fieldLabel}>{m.name}</span>
              <input type="text" maxLength={32} value={pet.custom.name} placeholder={m.placeholderName} onChange={(e) => update({ custom: { ...pet.custom, name: e.target.value } })} style={s.input} />
            </label>
            <label style={s.field} htmlFor={glyphId}>
              <span style={s.fieldLabel}>{m.glyph}</span>
              <input id={glyphId} type="text" maxLength={4} value={pet.custom.glyph} placeholder={m.placeholderGlyph} onChange={(e) => update({ custom: { ...pet.custom, glyph: e.target.value } })} style={{ ...s.input, width: 60 }} />
              <p style={s.hint}>{m.glyphHint}</p>
            </label>
            <label style={s.field}>
              <span style={s.fieldLabel}>{m.greeting}</span>
              <input type="text" maxLength={120} value={pet.custom.greeting} placeholder={m.placeholderGreeting} onChange={(e) => update({ custom: { ...pet.custom, greeting: e.target.value } })} style={s.input} />
            </label>
            <div style={s.field}>
              <span style={s.fieldLabel}>{m.accentColour}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} role="radiogroup" aria-label={m.accentColour}>
                {ACCENT_SWATCHES.map((color) => {
                  const isActive = pet.custom.accent.toLowerCase() === color.toLowerCase();
                  return (
                    <button key={color} type="button" role="radio" aria-checked={isActive} style={{ width: 22, height: 22, borderRadius: '50%', background: color, border: isActive ? `2px solid white` : '2px solid transparent', cursor: 'pointer', outline: isActive ? `2px solid ${color}` : 'none', outlineOffset: 1 }} onClick={() => update({ custom: { ...pet.custom, accent: color } })} title={color} />
                  );
                })}
                <input type="color" aria-label={m.customColourLabel} value={pet.custom.accent} onChange={(e) => update({ custom: { ...pet.custom, accent: e.target.value } })} style={{ width: 28, height: 22, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Community tab */}
      {activeTab === 'community' && (
        <div>
          {/* My Pets — downloaded collection */}
          {library.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <strong style={{ fontSize: 13 }}>{m.myPets}</strong>
              <p style={{ ...s.hint, marginBottom: 8 }}>{m.myPetsHint}</p>
              <div style={s.grid}>{library.map(renderLibraryCard)}</div>
            </div>
          )}

          {/* Catalog sync */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <strong style={{ fontSize: 13 }}>{m.communityCatalog}</strong>
                <p style={s.hint}>{m.communityHint}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={s.btn} onClick={() => void handleSync()} disabled={syncing} title={m.syncTitle}>
                  {syncing ? <I.Spinner size={11} /> : <I.Download size={11} />}
                  <span>{syncing ? 'Syncing…' : 'Sync catalog'}</span>
                </button>
                <button type="button" style={{ ...s.btn, ...s.btnGhost }} onClick={() => void refreshCatalog()} disabled={catalogLoading}>
                  {catalogLoading ? <I.Spinner size={11} /> : <I.Refresh size={11} />}
                  <span>{m.refresh}</span>
                </button>
              </div>
            </div>
            {syncStatus && (
              <p style={{ ...s.hint, color: syncStatus.kind === 'error' ? '#e05555' : '#4ec9b0' }} role="status">
                {syncStatus.kind === 'done' ? `Synced ${syncStatus.wrote} new pets (${syncStatus.total} total).` : `Sync failed: ${syncStatus.error}`}
              </p>
            )}
            {communityPets.length === 0 ? (
              <p style={s.hint}>{catalogLoading ? 'Loading…' : 'No community pets yet. Click "Sync catalog" to fetch some.'}</p>
            ) : (
              <div style={s.grid}>{communityPets.map(renderCatalogCard)}</div>
            )}
          </div>

          {/* Hatch with AI */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
            <strong style={{ fontSize: 13 }}>{m.hatchWithAI}</strong>
            <p style={s.hint}>{m.hatchHint}</p>
            <label style={{ ...s.field, marginTop: 8 }}>
              <span style={s.fieldLabel}>{m.concept}</span>
              <input type="text" maxLength={140} value={hatchConcept} placeholder={m.placeholderConcept} onChange={(e) => setHatchConcept(e.target.value)} style={s.input} />
            </label>
            <pre style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '10px 12px', fontSize: 11, lineHeight: 1.5, overflowX: 'auto', marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} aria-live="polite">{hatchPrompt}</pre>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" style={s.btn} onClick={() => void copyHatchPrompt()}>
                {hatchCopied ? <I.Check size={11} /> : <I.Copy size={11} />}
                <span>{hatchCopied ? 'Copied!' : 'Copy prompt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Inline styles ──────────────────────────────────────────────────────
//
// Theming contract — all surface colors flow through CSS custom properties
// with sensible dark-theme defaults. Override via your own stylesheet to
// match your design system:
//
//   :root, .my-app {
//     --ap-bg-soft:   rgba(0,0,0,0.04);
//     --ap-bg-medium: rgba(0,0,0,0.08);
//     --ap-bg-strong: rgba(0,0,0,0.18);
//     --ap-border:    rgba(0,0,0,0.15);
//     --ap-border-strong: rgba(0,0,0,0.3);
//   }

const styles = {
  section: { display: 'flex', flexDirection: 'column', gap: 12 } as React.CSSProperties,
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } as React.CSSProperties,
  h3: { margin: 0, fontSize: 14, fontWeight: 600 } as React.CSSProperties,
  hint: { margin: 0, fontSize: 11, opacity: 0.6, lineHeight: 1.4 } as React.CSSProperties,
  tabList: { display: 'flex', gap: 2, background: 'var(--ap-bg-soft, rgba(255,255,255,0.06))', borderRadius: 8, padding: 2, marginBottom: 6, width: 'fit-content' } as React.CSSProperties,
  tab: { padding: '4px 12px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'inherit', opacity: 0.7 } as React.CSSProperties,
  tabActive: { background: 'var(--ap-bg-medium, rgba(255,255,255,0.12))', opacity: 1 } as React.CSSProperties,
  btn: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--ap-border, rgba(255,255,255,0.15))', background: 'var(--ap-bg-medium, rgba(255,255,255,0.08))', cursor: 'pointer', fontSize: 12, color: 'inherit', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  btnActive: { background: 'var(--ap-bg-strong, rgba(255,255,255,0.18))', borderColor: 'var(--ap-border-strong, rgba(255,255,255,0.3))' } as React.CSSProperties,
  btnGhost: { background: 'transparent', borderColor: 'var(--ap-border-soft, rgba(255,255,255,0.1))' } as React.CSSProperties,
  field: { display: 'flex', flexDirection: 'column', gap: 4 } as React.CSSProperties,
  fieldLabel: { fontSize: 11, opacity: 0.7, fontWeight: 500 } as React.CSSProperties,
  input: { padding: '5px 8px', borderRadius: 5, border: '1px solid var(--ap-border, rgba(255,255,255,0.15))', background: 'var(--ap-bg-soft, rgba(255,255,255,0.06))', color: 'inherit', fontSize: 12, width: '100%', boxSizing: 'border-box' as const } as React.CSSProperties,
  preview: { display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: 8, border: '1.5px solid', background: 'var(--ap-bg-soft, rgba(255,255,255,0.04))', marginBottom: 12 } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 } as React.CSSProperties,
  card: { display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 8, border: '1px solid var(--ap-border-soft, rgba(255,255,255,0.1))', background: 'var(--ap-bg-soft, rgba(255,255,255,0.04))', cursor: 'default' } as React.CSSProperties,
  cardActive: { borderColor: 'var(--ap-border-strong, rgba(255,255,255,0.3))', background: 'var(--ap-bg-medium, rgba(255,255,255,0.08))' } as React.CSSProperties,
  cardThumb: { width: '100%', aspectRatio: '1', borderRadius: 6, backgroundRepeat: 'no-repeat' } as React.CSSProperties,
  cardMeta: { display: 'flex', flexDirection: 'column', gap: 2 } as React.CSSProperties,
  atlasPicker: { background: 'var(--ap-bg-soft, rgba(255,255,255,0.04))', borderRadius: 8, border: '1px solid var(--ap-border-soft, rgba(255,255,255,0.1))', padding: 12, marginTop: 10 } as React.CSSProperties,
  atlasRow: { display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--ap-border-soft, rgba(255,255,255,0.08))', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'inherit', gap: 8 } as React.CSSProperties,
  atlasRowActive: { background: 'var(--ap-bg-medium, rgba(255,255,255,0.12))', borderColor: 'var(--ap-border, rgba(255,255,255,0.25))' } as React.CSSProperties,
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') { reject(new Error('Could not read pet sprite.')); return; }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

async function probeImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('probe failed'));
        img.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  } catch { return null; }
}
