#!/usr/bin/env bash
# Re-run preprocess on the rips that failed first time. Each call passes
# the actual dominant bg colour(s) discovered by whole-image sampling.
# Multi-bg uses repeated --bg flags for rips with tiled / gradient / two-
# tone panels.
set -e
cd "$(dirname "$0")/.."

run() {
  local slug=$1; shift
  local input=$1; shift
  local out="sprites/processed/$slug"
  mkdir -p "$out"
  echo "→ $slug"
  python3 scripts/preprocess-rip.py "sprites/$input" \
    --out "$out/$slug" --preview "$@" \
    2>&1 | grep -E '^(loaded|chroma|segmented|wrote)' | sed 's/^/   /'
}

# Wolverine: magenta sprite-cell bg + black grid borders.
run wolverine "Arcade - Marvel vs. Capcom - Fighters - Wolverine.png" \
  --bg "#ff00ff" --bg "#000000" --tolerance 18 --noise 16

# Mario: teal cells + black grid borders. Lots of teal variants from
# anti-aliasing — wider tolerance to catch them all.
run mario "SNES - Super Mario World - Playable Characters - Mario.png" \
  --bg "#009494" --bg "#000000" --tolerance 60 --noise 20 --min-gap-h 2 --min-gap-v 2

# Gundam: dark red bg.
run xxxg-01w-wing-gundam "SNES - Gundam Wing_ Endless Duel (JPN) - Fighters - XXXG-01W Wing Gundam.png" \
  --bg "#a24c4c" --tolerance 16 --noise 4 --min-gap-h 2 --min-gap-v 2

# Chun-Li GIF: black + dark navy two-tone bg.
run chun-li-snes "SNES - Super Street Fighter II_ The New Challengers - Fighters - Chun-Li.gif" \
  --bg "#000000" --bg "#000070" --tolerance 16 --noise 5 --min-gap-h 2 --min-gap-v 2

# Guile SNES GIF: light blue + dark navy.
run guile-snes "SNES - Super Street Fighter II_ The New Challengers - Fighters - Guile.gif" \
  --bg "#4898e0" --bg "#000070" --tolerance 12 --noise 5 --min-gap-h 2 --min-gap-v 2

# Ken GIF: sage + dark navy.
run ken "SNES - Super Street Fighter II_ The New Challengers - Fighters - Ken.gif" \
  --bg "#80b8a8" --bg "#000070" --tolerance 12 --noise 5 --min-gap-h 2 --min-gap-v 2

# Raphael arcade GIF: magenta bg.
run raphael-arcade "Arcade - Teenage Mutant Ninja Turtles_ Turtles in Time - Playable Characters - Raphael.gif" \
  --bg "#ff00ff" --tolerance 12 --noise 4 --min-gap-h 2 --min-gap-v 2

# Sub-Zero arcade: light blue panel + dark red panel.
run sub-zero-arcade "Arcade - Mortal Kombat - Kombatants - Sub-Zero.png" \
  --bg "#a5e7ff" --bg "#520101" --tolerance 24 --noise 6 --min-gap-h 4 --min-gap-v 3
