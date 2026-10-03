#!/usr/bin/env bash
# Phase 369 plan 15: production build of candidate A (the workroom chassis).
#
# Run setup.sh first. Builds inside app/ only, telemetry off, then copies public/
# and .next/static into .next/standalone/ as Next's standalone output requires
# (the standalone server serves neither on its own). Prints the build seconds and
# the standalone output size; plan 18 measures formally.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$HERE/app"
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
export DO_NOT_TRACK=1 NEXT_TELEMETRY_DISABLED=1

[ -d "$APP/node_modules" ] || { echo "app/ is not set up: run setup.sh first" >&2; exit 1; }

cd "$APP"
START=$(date +%s)
NEXT_TELEMETRY_DISABLED=1 npx next build
END=$(date +%s)

STANDALONE="$APP/.next/standalone"
[ -f "$STANDALONE/server.js" ] || { echo "build produced no .next/standalone/server.js" >&2; exit 1; }
[ -d "$APP/public" ] && { mkdir -p "$STANDALONE/public"; cp -R "$APP/public/." "$STANDALONE/public/"; }
mkdir -p "$STANDALONE/.next"
rm -rf "$STANDALONE/.next/static"
cp -R "$APP/.next/static" "$STANDALONE/.next/static"

echo "build_seconds=$((END - START))"
echo "standalone_bytes=$(du -sb "$STANDALONE" | cut -f1)"
echo "static_bytes=$(du -sb "$APP/.next/static" | cut -f1)"
