/* Shared starter rich-action presets — loaded by both /rich-editor.html
 * and /pet-tester.html so they stay in sync. Attached to window so a
 * plain <script> tag suffices (no module loader needed).
 *
 * Each preset is { slug, label, ripSlug, accent, description, actions }
 * — the `actions` block is the same shape that goes into
 * manifest.richActions. Frame indices are GLOBAL within the rip's
 * sprites.json (sprites sorted band-then-idx; see /rips/<slug>/<slug>.json).
 *
 * Best-guess band mappings for non-Ryu rips — refine after loading via
 * the editor. */
(function () {
  function _t(band, idxs, opts) {
    return {
      fps: opts?.fps ?? 6,
      loops: opts?.loops ?? 0,
      z: opts?.z ?? 0,
      frames: idxs.map((idx) => ({ band, idx, ...(opts?.flipH ? { flipH: true } : {}) })),
      keyframes: opts?.keyframes ?? [
        { t: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1 },
      ],
    };
  }
  function _a(band, idxs, opts) {
    return {
      durationMs: opts?.durationMs ?? 1000,
      tracks: [_t(band, idxs, opts)],
      spawn: opts?.spawn ?? [],
    };
  }
  function _walk(band, idxs, flipH, distance) {
    const dx = (flipH ? -1 : 1) * (distance ?? 30);
    return {
      durationMs: 800,
      tracks: [{
        fps: 8, loops: 0, z: 0,
        frames: idxs.map((idx) => ({ band, idx, ...(flipH ? { flipH: true } : {}) })),
        keyframes: [
          { t: 0, x: -dx / 2, y: 0, scaleX: 1, scaleY: 1, alpha: 1 },
          { t: 1, x:  dx / 2, y: 0, scaleX: 1, scaleY: 1, alpha: 1 },
        ],
      }],
      spawn: [],
    };
  }

  const STARTER_PRESETS = [
    {
      slug: 'ryu-classic',
      label: 'Ryu — SF2 (classic moveset)',
      ripSlug: 'ryu',
      accent: '#e74c3c',
      description: 'Hand-tuned actions matching the existing /ryu.json picks. Includes 3-layer fire explosion at the peak of shoryuken.',
      actions: {
        'idle':       _a(0, [0,1,2,3,2,1],         { durationMs: 1200, fps: 6 }),
        'walk-right': _walk(0, [4,5,6,7,8,9], false, 30),
        'walk-left':  _walk(0, [4,5,6,7,8,9], true,  30),
        'taunt':      _a(1, [45,46,47,46],         { durationMs: 800,  fps: 6 }),
        'kick':       _a(2, [50,53,54,55,56,57,58],{ durationMs: 700,  fps: 8 }),
        'hadouken':   _a(5, [123,124,125,126],     { durationMs: 600,  fps: 7 }),
        'shoryuken':  {
          durationMs: 1200,
          tracks: [_t(4, [107,108,109,110,111,112,113], { fps: 8 })],
          spawn: [
            { type: 'particles', t: 0.5, origin: { x: 0, y: -70 },
              emitter: { count: 32, lifetimeMs: 500, color: '#ffd24a',
                velocity: { x: 0, y: -150, spreadDeg: 360 },
                gravity: 200, sizeStart: 10, sizeEnd: 0,
                alphaStart: 1, alphaEnd: 0 } },
            { type: 'particles', t: 0.5, origin: { x: 0, y: -70 },
              emitter: { count: 24, lifetimeMs: 700, color: '#ff7a18',
                velocity: { x: 0, y: -90, spreadDeg: 120 },
                gravity: -120, sizeStart: 14, sizeEnd: 2,
                alphaStart: 1, alphaEnd: 0 } },
            { type: 'particles', t: 0.5, origin: { x: 0, y: -70 },
              emitter: { count: 16, lifetimeMs: 900, color: '#ffffff',
                velocity: { x: 0, y: -40, spreadDeg: 80 },
                gravity: 60, sizeStart: 4, sizeEnd: 1,
                alphaStart: 1, alphaEnd: 0 } },
          ],
        },
        'knockdown':  _a(6, [158,159,160,161,162,163,164,165], { durationMs: 1200, fps: 7 }),
        'wait':       _a(1, [27,28,29,30,29,28],   { durationMs: 1500, fps: 6 }),
        'spinkick':   _a(4, [114,115,116,117,118,119,120,121], { durationMs: 800, fps: 12 }),
      },
    },
    {
      slug: 'guile-snes',
      label: 'Guile — SF2 SNES (starter)',
      ripSlug: 'guile-snes',
      accent: '#3498db',
      description: 'Best-guess band mapping; tweak after loading.',
      actions: {
        'idle':       _a(0, [0,1,2,3,2,1],          { durationMs: 1200, fps: 6 }),
        'walk-right': _walk(0, [4,5,6,7,8,9], false, 32),
        'walk-left':  _walk(0, [4,5,6,7,8,9], true,  32),
        'wait':       _a(0, [0,1,2,1],              { durationMs: 1600, fps: 5 }),
        'taunt':      _a(2, [25,26,27,28,27,26],    { durationMs: 900, fps: 6 }),
        'kick':       _a(4, [46,47,48,49,50,51,46], { durationMs: 700, fps: 9 }),
        'hadouken':   _a(9, [109,110,111,112,113],  { durationMs: 600, fps: 8 }),
        'shoryuken':  _a(15,[153,154,155,156,157,158], { durationMs: 900, fps: 9 }),
        'knockdown':  _a(7, [65,66,67,68,69,70,71,72], { durationMs: 1200, fps: 7 }),
      },
    },
    {
      slug: 'chun-li-snes',
      label: 'Chun-Li — SF2 SNES (starter)',
      ripSlug: 'chun-li-snes',
      accent: '#1abc9c',
      description: 'Best-guess band mapping; tweak after loading.',
      actions: {
        'idle':       _a(1, [0,1,2,3,2,1],          { durationMs: 1200, fps: 6 }),
        'walk-right': _walk(1, [4,5,6,7,8,9], false, 32),
        'walk-left':  _walk(1, [4,5,6,7,8,9], true,  32),
        'wait':       _a(1, [0,1,2,1],              { durationMs: 1600, fps: 5 }),
        'taunt':      _a(3, [34,35,36,37,36,35],    { durationMs: 900, fps: 6 }),
        'kick':       _a(8, [87,88,89,90,91,92,93], { durationMs: 700, fps: 9 }),
        'hadouken':   _a(11,[115,116,117,118,119], { durationMs: 600, fps: 8 }),
        'shoryuken':  _a(12,[135,136,137,138,139,140], { durationMs: 900, fps: 9 }),
        'knockdown':  _a(5, [80,81,82,83,84,85,86], { durationMs: 1200, fps: 7 }),
        'lightning-kick': _a(14, [153,154,155,156,153,154,155,156], { durationMs: 600, fps: 12, loops: 2 }),
      },
    },
  ];

  /** Pull any per-slug override files written via POST /api/presets/<slug>
   *  on top of the inline defaults above. Each override is the same shape
   *  as a STARTER_PRESETS entry. Matching slugs replace the inline preset;
   *  new slugs are appended.
   *
   *  Awaiting is optional — the inline defaults render immediately and the
   *  merge happens once the round-trip resolves. Pages that want the
   *  override-aware list should `await window.presetsReady` before painting
   *  their pickers. */
  async function loadPresetOverrides() {
    let idx;
    try {
      const r = await fetch('/presets/index.json', { cache: 'no-store' });
      if (!r.ok) return;
      idx = await r.json();
      if (!Array.isArray(idx)) return;
    } catch { return; }
    for (const meta of idx) {
      if (!meta?.slug) continue;
      try {
        const r = await fetch(`/presets/${encodeURIComponent(meta.slug)}.json`, { cache: 'no-store' });
        if (!r.ok) continue;
        const blob = await r.json();
        if (!blob || !blob.actions) continue;
        const i = STARTER_PRESETS.findIndex((p) => p.slug === blob.slug);
        const merged = {
          slug: blob.slug,
          label: blob.label,
          ripSlug: blob.ripSlug,
          accent: blob.accent,
          description: blob.description ?? '',
          actions: blob.actions,
        };
        if (i >= 0) STARTER_PRESETS[i] = merged;
        else STARTER_PRESETS.push(merged);
      } catch {}
    }
  }
  window.presetsReady = loadPresetOverrides();

  /** Resolve a preset to a complete manifest ready for AgentPet.loadManifest.
   *  Fetches the rip's sprites.json (band/idx → bbox) and embeds it as
   *  manifest.sprites so the rich runtime can crop frames without an
   *  extra network round-trip at play time. */
  async function resolvePresetManifest(preset) {
    const m = {
      id: preset.ripSlug,
      displayName: preset.label,
      accent: preset.accent ?? '#e74c3c',
      runtime: 'rich',
      richActions: JSON.parse(JSON.stringify(preset.actions)),
      sourceImage: `/rips/${preset.ripSlug}/${preset.ripSlug}.png`,
      // The widget's parsePetManifest() rejects manifests without a
      // spritesheet + atlas, so source-frame-only presets need stubs.
      // The rich runtime never reads them (every track here is
      // source-frame). spritesheet points at a 1×1 transparent PNG so
      // the widget's fallback static-image sprite is invisible — only
      // the rich runtime's sprites are visible. data: URLs are blocked
      // by SAFE_SCHEMES, so we ship blank-1x1.png in /deploy/.
      spritesheet: '/blank-1x1.png',
      atlas: { cols: 1, rows: 1, rowsDef: [] },
    };
    try {
      const list = await fetch(`/rips/${preset.ripSlug}/${preset.ripSlug}.json`).then((r) => r.json());
      m.sprites = list;
    } catch (e) {
      console.warn(`[presets] failed to load sprites for ${preset.ripSlug}:`, e);
    }
    return m;
  }

  window.STARTER_PRESETS = STARTER_PRESETS;
  window.resolvePresetManifest = resolvePresetManifest;
})();
