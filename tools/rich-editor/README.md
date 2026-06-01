# Rich editor

Authoring tool for the agent-pet widget's *rich* runtime — a stand-alone
HTML+JS app that loads sprite rips, builds keyframed multi-track
actions with spawns/particles, and exports a manifest the production
widget can consume.

Three pages:

| Page | Purpose |
|---|---|
| [`rich-editor.html`](rich-editor.html) | Author rich actions: timeline, keyframes, source-frame chips, atlas-cell editor, spawn graph, particle emitters, multi-slot saves. |
| [`pet-tester.html`](pet-tester.html) | Run a saved manifest through the production widget on a real-looking page. Verifies the embed-and-play flow before shipping. |
| [`playground.html`](playground.html) | 3D scene (three.js) where you can walk a saved character around, trigger every action, and see particles in world-space. |

Plus a starter-presets registry ([`presets.js`](presets.js)) shared by
all three pages — Ryu / Guile / Chun-Li hand-tuned manifests that
double as documentation of the manifest shape.

## Run locally

```bash
cd tools/rich-editor
./dev.sh                # default port 5174
./dev.sh 8080           # or any port
```

`dev.sh` builds the widget bundles + rips data on first run (skipped if
already present), then starts `serve.py`. Then open
<http://localhost:5174/rich-editor.html>.

If you'd rather drive each step manually:

```bash
pnpm build                                              # widget bundles → dist/
python3 scripts/build-rips-deploy.py tools/rich-editor   # rips/
cd tools/rich-editor && python3 serve.py 5174
```

`serve.py` exposes a tiny REST API for disk-backed saves:

```
POST /api/saves/<slug>      — { manifest, name, activeRipSlug, savedAt }
DELETE /api/saves/<slug>
GET /saves/index.json
GET /saves/<slug>.json
```

The editor detects localhost-style hostnames and dual-writes every
`💾 Save` / `Save As…` / Delete to both localStorage AND disk
(`saves/<slug>.json`). On Cloudflare Pages the disk path silently
no-ops — only localStorage saves work for non-dev users.

## Deploy

```bash
cd tools/rich-editor
./deploy.sh
```

Builds a fresh `build/` tree, copies in editor pages + bundles + rips
+ `saves/`, then runs `wrangler pages deploy` against the `ryu-pet`
project. Saved manifests under `saves/` ride along with the static
site so `pet-tester` and `playground` pickers list them on every
browser, no localStorage round-trip required.

`CLOUDFLARE_API_TOKEN` is sourced from `$SHARED_ENV` (defaults to
`../../../fixedcode/website/.env.local`) or take it from the
environment if already exported.

## Layout

```
tools/rich-editor/
├── rich-editor.html        # main authoring tool
├── pet-tester.html         # widget embed test page
├── playground.html         # 3D scene
├── presets.js              # shared starter-preset registry
├── editor.html             # legacy simpler atlas editor
├── test.html               # legacy basic-runtime smoke test
├── serve.py                # local dev server + saves REST API
├── deploy.sh               # build + wrangler pages deploy
├── ryu.json                # default Ryu manifest
├── ryu.png                 # raw Ryu rip
├── sprites.json            # Ryu rip's bbox metadata
├── spritesheet.png/.webp   # Ryu's packed atlas
├── blank-1x1.png           # transparent stub for source-frame manifests
├── dist/   →  ../../dist   # symlink to widget bundles (built artefact)
├── rips/                   # built by scripts/build-rips-deploy.py
├── saves/                  # disk-backed editor saves (gitignored)
└── scripts/                # sprite-pre-processing helpers
    ├── build_local.py      # rebuilds spritesheet.webp from picks.json
    ├── build_atlas.py      # legacy atlas builder
    ├── build_codex.py      # legacy codex-mode builder
    └── regen_review.py     # debug-only review-grid generator
```
