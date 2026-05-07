// User-facing strings used by PetSettings + PetRail. Consumers in i18n-aware
// apps (e.g. open-design's `useT()` flow, FroeMic's framework wrappers, any
// site that ships in multiple languages) override individual keys via the
// `messages` prop on PetSettings / PetRail.
//
// Keys mirror the JSX label they appear next to so they're easy to map.
// Defaults are in English. Missing keys fall back to the English default —
// translate one string at a time, no need to ship the full set.

export interface PetMessages {
  // ── Tabs ───────────────────────────────────────────────────────
  builtInTab: string;
  customTab: string;
  communityTab: string;
  petSourceLabel: string;          // ARIA on the tablist

  // ── Section headers ────────────────────────────────────────────
  companionPet: string;
  companionTagline: string;        // "An animated companion that reacts to your agent's state."
  myPets: string;
  myPetsHint: string;              // "Your downloaded collection — click Switch to activate."
  yourPet: string;
  customizeTagline: string;        // "Upload a sprite, set the name and accent colour."
  hatchWithAI: string;
  hatchHint: string;               // "Describe a pet concept and paste the generated prompt into your AI chat."
  importCodexAtlas: string;
  communityCatalog: string;
  communityHint: string;           // "Pets from Codex Pet Share and j20 Hatchery."
  customizePet: string;
  atlasRowPicker: string;
  atlasPickerHint: string;         // "Choose one row or adopt the full atlas for interactive animations."

  // ── Form labels & hints ───────────────────────────────────────
  name: string;
  glyph: string;
  glyphHint: string;               // "Emoji or short text shown when no sprite is uploaded"
  greeting: string;
  accentColour: string;
  customColourLabel: string;       // ARIA for the <input type="color">
  frames: string;
  framesHint: string;              // "Horizontal cells in the sprite strip"
  fps: string;
  fpsHint: string;                 // "Playback speed"
  concept: string;

  // ── Buttons / actions ─────────────────────────────────────────
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
  atlasActiveNote: string;         // "Full atlas active — 9 animation rows."

  // ── Toggle / wake / dismiss ───────────────────────────────────
  wakePet: string;                 // toggle title when off
  dismissPet: string;              // toggle title when on

  // ── Placeholders ──────────────────────────────────────────────
  placeholderName: string;         // "Buddy"
  placeholderGlyph: string;        // "🦄"
  placeholderGreeting: string;     // "Hi! I am here whenever you need me."
  placeholderConcept: string;      // "a sleepy capybara in a top hat"

  // ── ARIA / titles ─────────────────────────────────────────────
  animationRowsLabel: string;      // ARIA on the row radiogroup
  removeFromCollection: string;    // hover title
  importAtlasTitle: string;
  useAllRowsTitle: string;
  cropRowTitle: string;
  syncTitle: string;               // "Download latest pets from the community catalogs"
  emptyCatalogHint: string;
}

export const DEFAULT_PET_MESSAGES: PetMessages = {
  builtInTab: 'Built-in',
  customTab: 'Custom',
  communityTab: 'Community',
  petSourceLabel: 'Pet source',

  companionPet: 'Companion Pet',
  companionTagline: "An animated companion that reacts to your agent's state.",
  myPets: 'My pets',
  myPetsHint: 'Your downloaded collection — click Switch to activate.',
  yourPet: 'Your pet',
  customizeTagline: 'Upload a sprite, set the name and accent colour.',
  hatchWithAI: 'Hatch with AI',
  hatchHint: 'Describe a pet concept and paste the generated prompt into your AI chat.',
  importCodexAtlas: 'Import Codex atlas',
  communityCatalog: 'Community catalog',
  communityHint: 'Pets from Codex Pet Share and j20 Hatchery.',
  customizePet: 'Customize pet',
  atlasRowPicker: 'Atlas row picker',
  atlasPickerHint: 'Choose one row or adopt the full atlas for interactive animations.',

  name: 'Name',
  glyph: 'Glyph',
  glyphHint: 'Emoji or short text shown when no sprite is uploaded',
  greeting: 'Greeting',
  accentColour: 'Accent colour',
  customColourLabel: 'Custom colour',
  frames: 'Frames',
  framesHint: 'Horizontal cells in the sprite strip',
  fps: 'FPS',
  fpsHint: 'Playback speed',
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
  atlasActiveNote: 'Full atlas active — 9 animation rows.',

  wakePet: 'Wake pet',
  dismissPet: 'Dismiss pet',

  placeholderName: 'Buddy',
  placeholderGlyph: '🦄',
  placeholderGreeting: 'Hi! I am here whenever you need me.',
  placeholderConcept: 'a sleepy capybara in a top hat',

  animationRowsLabel: 'Animation rows',
  removeFromCollection: 'Remove from collection',
  importAtlasTitle: 'Import a Codex 8×9 sprite atlas',
  useAllRowsTitle: 'Keep all 9 rows for interactive animations',
  cropRowTitle: 'Crop and use just this row',
  syncTitle: 'Download latest pets from the community catalogs',
  emptyCatalogHint: 'No pets yet — adopt one to start.',
};

/** Merge a partial override into the default messages. Any missing key
 *  falls back to the English default so consumers can translate one or
 *  two strings at a time without pulling in the full set. */
export function mergeMessages(overrides?: Partial<PetMessages>): PetMessages {
  if (!overrides) return DEFAULT_PET_MESSAGES;
  return { ...DEFAULT_PET_MESSAGES, ...overrides };
}
