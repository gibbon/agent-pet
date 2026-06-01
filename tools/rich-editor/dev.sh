#!/usr/bin/env bash
# One-shot dev startup: ensure prereqs are built, then run serve.py.
#
# Usage: ./dev.sh [port]   (default 5174)

set -euo pipefail

EDITOR_DIR="$(dirname "$(readlink -f "$0")")"
REPO_ROOT="$(cd "$EDITOR_DIR/../.." && pwd)"
PORT="${1:-5174}"

cd "$EDITOR_DIR"

# ── Prereq: dist/ widget bundles ──────────────────────────────────────
if [[ ! -L dist && ! -d dist ]]; then
  echo "→ creating dist symlink → ../../dist"
  ln -sfn ../../dist dist
fi
if [[ ! -d "$REPO_ROOT/dist" || ! -f "$REPO_ROOT/dist/agent-pet-widget.iife.js" ]]; then
  echo "→ building widget (pnpm build)"
  (cd "$REPO_ROOT" && pnpm build)
fi

# ── Prereq: rips/ data ────────────────────────────────────────────────
if [[ ! -f rips/index.json ]]; then
  echo "→ building rips (scripts/build-rips-deploy.py)"
  python3 "$REPO_ROOT/scripts/build-rips-deploy.py" "$EDITOR_DIR"
fi

# ── Run ───────────────────────────────────────────────────────────────
echo
echo "✓ ready"
echo "  rich editor   →  http://localhost:$PORT/rich-editor.html"
echo "  pet tester    →  http://localhost:$PORT/pet-tester.html"
echo "  3D playground →  http://localhost:$PORT/playground.html"
echo
exec python3 serve.py "$PORT"
