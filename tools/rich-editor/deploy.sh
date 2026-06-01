#!/usr/bin/env bash
# Push the rich editor / pet-tester / playground to Cloudflare Pages.
#
# Builds a fresh deploy tree under ./build/ from the in-repo source
# files, then runs `wrangler pages deploy`. Disk-backed saves under
# ./saves/ get mirrored into the deploy so the pet-tester + playground
# pickers list them on every browser.
#
# Usage:
#   cd tools/rich-editor && ./deploy.sh
#
# Required:
#   - CLOUDFLARE_API_TOKEN (sourced from $SHARED_ENV if not exported)
#   - dist/ built (run `pnpm build` from the repo root)
#   - rips/ generated (run `python3 ../../scripts/build-rips-deploy.py .`)

set -euo pipefail

EDITOR_DIR="$(dirname "$(readlink -f "$0")")"
REPO_ROOT="$(cd "$EDITOR_DIR/../.." && pwd)"
BUILD_DIR="$EDITOR_DIR/build"

# ── Sanity ────────────────────────────────────────────────────────────
if [[ ! -d "$REPO_ROOT/dist" ]]; then
  echo "Repo dist/ not built — run 'pnpm build' from $REPO_ROOT first." >&2
  exit 1
fi
if [[ ! -d "$EDITOR_DIR/rips" ]]; then
  echo "tools/rich-editor/rips/ missing — run:" >&2
  echo "  python3 $REPO_ROOT/scripts/build-rips-deploy.py $EDITOR_DIR" >&2
  exit 1
fi

# ── Assemble build dir ────────────────────────────────────────────────
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

cp -f \
  "$EDITOR_DIR"/index.html \
  "$EDITOR_DIR"/rich-editor.html \
  "$EDITOR_DIR"/pet-tester.html \
  "$EDITOR_DIR"/playground.html \
  "$EDITOR_DIR"/editor.html \
  "$EDITOR_DIR"/test.html \
  "$EDITOR_DIR"/presets.js \
  "$EDITOR_DIR"/blank-1x1.png \
  "$EDITOR_DIR"/ryu.json \
  "$EDITOR_DIR"/ryu.png \
  "$EDITOR_DIR"/sprites.json \
  "$EDITOR_DIR"/spritesheet.png \
  "$EDITOR_DIR"/spritesheet.webp \
  "$BUILD_DIR/"

# Widget bundles + CSS — Cloudflare Pages serves these alongside the
# editor pages. <script src="/dist/...iife.js"> tags resolve here.
cp -r "$REPO_ROOT/dist" "$BUILD_DIR/dist"

# Rips — pre-built source-frame data (rip image + sprites.json per
# character + a top-level index.json the editor reads).
cp -r "$EDITOR_DIR/rips" "$BUILD_DIR/rips"

# Disk-backed saves. pet-tester + playground fetch /saves/index.json
# + /saves/<slug>.json on boot.
if [[ -d "$EDITOR_DIR/saves" ]]; then
  cp -r "$EDITOR_DIR/saves" "$BUILD_DIR/saves"
  echo "saves: $(ls "$BUILD_DIR/saves"/*.json 2>/dev/null | wc -l) file(s)"
fi

# Promoted preset overrides. presets.js fetches /presets/index.json on
# load and merges per-slug overrides on top of the inline defaults so
# 📦 Presets reflects whatever the editor has promoted.
if [[ -d "$EDITOR_DIR/presets" ]]; then
  cp -r "$EDITOR_DIR/presets" "$BUILD_DIR/presets"
  echo "preset overrides: $(ls "$BUILD_DIR/presets"/*.json 2>/dev/null | grep -v index.json | wc -l) file(s)"
fi

# ── Deploy ────────────────────────────────────────────────────────────
SHARED_ENV="${SHARED_ENV:-$REPO_ROOT/../fixedcode/website/.env.local}"
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -f "$SHARED_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SHARED_ENV"
  set +a
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN not set (export it or fix SHARED_ENV)." >&2
  exit 1
fi

cd "$BUILD_DIR"
npx -y wrangler@latest pages deploy . --project-name=ryu-pet --commit-dirty=true
