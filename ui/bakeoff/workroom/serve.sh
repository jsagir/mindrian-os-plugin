#!/usr/bin/env bash
# Phase 369 plan 15: serve candidate A's production build on loopback only.
#
#   MOS_DAEMON_URL        required: the flag-ON MindrianOS daemon, e.g. http://127.0.0.1:<port>
#   PORT                  default 8091 (the agent-native candidate takes 8092): two fixed,
#                         distinct ports clear of the daemon's ephemeral port and the shell's
#                         3369, so both candidates run side by side during measurement
#   MOS_PROPOSAL_SOURCE   fixed (default) or adapter (plan 14's claude-adapter.ts)
#
# Binds 127.0.0.1 only; Next telemetry off. The adapter module is loaded from this
# repo's ui/shared at run time (MOS_SHARED_DIR), never copied into the app.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$HERE/app"
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"

[ -n "${MOS_DAEMON_URL:-}" ] || { echo "MOS_DAEMON_URL is required (the MindrianOS daemon base URL, loopback)" >&2; exit 1; }
[ -f "$APP/.next/standalone/server.js" ] || { echo "no production build: run setup.sh then build.sh" >&2; exit 1; }

export MOS_SHARED_DIR="${MOS_SHARED_DIR:-$(cd "$HERE/../../shared" && pwd)}"
cd "$APP/.next/standalone"
HOSTNAME=127.0.0.1 PORT="${PORT:-8091}" NEXT_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 \
  MOS_DAEMON_URL="${MOS_DAEMON_URL}" MOS_PROPOSAL_SOURCE="${MOS_PROPOSAL_SOURCE:-fixed}" \
  MOS_SHARED_DIR="$MOS_SHARED_DIR" \
  exec node server.js
