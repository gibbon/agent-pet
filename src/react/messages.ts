// User-facing strings used by PetSettings + PetRail. Consumers in i18n-aware
// apps (e.g. open-design's `useT()` flow, FroeMic's framework wrappers, any
// site that ships in multiple languages) override individual keys via the
// `messages` prop on PetSettings / PetRail.
//
// Keys mirror the JSX label they appear next to so they're easy to map:
//   <button>{m.adopt}</button>           // 'Adopt'
//   <h3>{m.companionPet}</h3>            // 'Companion Pet'
//
// Defaults are in English. To translate, pass a partial overrides object —
// any key omitted falls back to the English default.

export interface PetMessages {
  // Tabs
  builtInTab: string;
  customTab: string;
  communityTab: string;
  // Sections
  companionPet: string;
  myPets: string;
  yourPet: string;
  customizePet: string;
  hatchWithAI: string;
  importCodexAtlas: string;
  communityCatalog: string;
  // Form labels
  name: string;
  glyph: string;
  greeting: string;
  accentColour: string;
  frames: string;
  fps: string;
  playbackSpeed: string;
  concept: string;
  // Buttons / actions
  adopt: string;
  active: string;
  switch: string;
  remove: string;
  cancel: string;
  refresh: string;
  useThisRow: string;
  useFullAtlas: string;
  download: string;
  upload: string;
  copy: string;
  copied: string;
  preview: string;
  // Hints / placeholders
  defaultName: string;          // placeholder "Buddy"
  defaultGlyph: string;         // placeholder "🦄"
  defaultGreeting: string;      // placeholder "Hi! I am here whenever you need me."
  emptyCatalogHint: string;
  // ARIA / titles
  petSourceLabel: string;
  animationRowsLabel: string;
  removeFromCollection: string;
  importAtlasTitle: string;
  useAllRowsTitle: string;
  cropRowTitle: string;
  atlasRowPicker: string;
  horizontalCellsHint: string;
}

export const DEFAULT_PET_MESSAGES: PetMessages = {
  builtInTab: 'Built-in',
  customTab: 'Custom',
  communityTab: 'Community',
  companionPet: 'Companion Pet',
  myPets: 'My pets',
  yourPet: 'Your pet',
  customizePet: 'Customize pet',
  hatchWithAI: 'Hatch with AI',
  importCodexAtlas: 'Import Codex atlas',
  communityCatalog: 'Community catalog',
  name: 'Name',
  glyph: 'Glyph',
  greeting: 'Greeting',
  accentColour: 'Accent colour',
  frames: 'Frames',
  fps: 'FPS',
  playbackSpeed: 'Playback speed',
  concept: 'Concept',
  adopt: 'Adopt',
  active: 'Active',
  switch: 'Switch',
  remove: 'Remove',
  cancel: 'Cancel',
  refresh: 'Refresh',
  useThisRow: 'Use this row',
  useFullAtlas: 'Use full atlas',
  download: 'Download',
  upload: 'Upload',
  copy: 'Copy',
  copied: 'Copied!',
  preview: 'Preview',
  defaultName: 'Buddy',
  defaultGlyph: '🦄',
  defaultGreeting: 'Hi! I am here whenever you need me.',
  emptyCatalogHint: 'No pets yet — adopt one to start.',
  petSourceLabel: 'Pet source',
  animationRowsLabel: 'Animation rows',
  removeFromCollection: 'Remove from collection',
  importAtlasTitle: 'Import a Codex 8×9 sprite atlas',
  useAllRowsTitle: 'Keep all 9 rows for interactive animations',
  cropRowTitle: 'Crop and use just this row',
  atlasRowPicker: 'Atlas row picker',
  horizontalCellsHint: 'Horizontal cells in the sprite strip',
};

/** Merge a partial override into the default messages. Any missing key
 *  falls back to the English default so consumers can translate one or
 *  two strings at a time without pulling in the full set. */
export function mergeMessages(overrides?: Partial<PetMessages>): PetMessages {
  if (!overrides) return DEFAULT_PET_MESSAGES;
  return { ...DEFAULT_PET_MESSAGES, ...overrides };
}
