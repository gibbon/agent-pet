import { describe, it, expect } from 'vitest';
import { CONFIG_SCHEMA_VERSION, migratePetConfig, migratePetCustom } from './types';
import type { PetConfig, PetCustom } from './types';

const baseCustom: PetCustom = {
  name: 'Guga', glyph: '🐾', accent: '#7eb8da', greeting: 'hi',
};

const supabaseGugaUrl =
  'https://ihzwckyzfcuktrljwpha.supabase.co/storage/v1/object/public/pets/guga/spritesheet.webp';
const codexGugaUrl = 'https://codex-pets.net/assets/pets/guga/spritesheet.webp';

describe('migratePetCustom', () => {
  it('rewrites dead supabase host to codex-pets.net', () => {
    const out = migratePetCustom({ ...baseCustom, imageUrl: supabaseGugaUrl });
    expect(out.imageUrl).toBe(codexGugaUrl);
  });

  it('leaves codex-pets.net urls untouched', () => {
    const input = { ...baseCustom, imageUrl: codexGugaUrl };
    expect(migratePetCustom(input).imageUrl).toBe(codexGugaUrl);
  });

  it('leaves unrelated hosts alone', () => {
    const url = 'https://example.com/sprites/foo.webp';
    expect(migratePetCustom({ ...baseCustom, imageUrl: url }).imageUrl).toBe(url);
  });

  it('handles missing imageUrl', () => {
    expect(migratePetCustom(baseCustom).imageUrl).toBeUndefined();
  });

  it('skips already-migrated customs by version', () => {
    // fromVersion >= CONFIG_SCHEMA_VERSION ⇒ no change even with stale URL
    const out = migratePetCustom({ ...baseCustom, imageUrl: supabaseGugaUrl }, CONFIG_SCHEMA_VERSION);
    expect(out.imageUrl).toBe(supabaseGugaUrl);
  });
});

describe('migratePetConfig', () => {
  const baseConfig: PetConfig = {
    adopted: true, enabled: true, petId: 'guga',
    custom: { ...baseCustom, imageUrl: supabaseGugaUrl },
  };

  it('migrates v1 (missing schemaVersion) and stamps current version', () => {
    const { cfg, changed } = migratePetConfig(baseConfig);
    expect(changed).toBe(true);
    expect(cfg.schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    expect(cfg.custom.imageUrl).toBe(codexGugaUrl);
  });

  it('returns unchanged on already-current schemaVersion', () => {
    const current: PetConfig = { ...baseConfig, schemaVersion: CONFIG_SCHEMA_VERSION };
    const { cfg, changed } = migratePetConfig(current);
    expect(changed).toBe(false);
    expect(cfg).toBe(current);
  });
});
