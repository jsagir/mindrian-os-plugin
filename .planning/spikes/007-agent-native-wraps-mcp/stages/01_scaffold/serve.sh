#!/usr/bin/env bash
# Spike 007: serve the app. Default: production build on 127.0.0.1:8090 (loopback
# only; gate on screen in about 1 s). --dev: Vite dev server on :8080 (binds ALL
# interfaces, about 6.6 s to first gate). Production refuses PGlite for its own
# tables (agent chat errors in the log); the gate view needs none of them.
set -euo pipefail
cd "$(dirname "$0")/../../mos-ui"
export DO_NOT_TRACK=1 AGENT_NATIVE_TELEMETRY_DISABLED=1 AUTH_DISABLED=true
export MOS_MCP_URL="${MOS_MCP_URL:-http://127.0.0.1:3847/mcp}"
if [ "${1:-}" = "--dev" ]; then
  exec pnpm exec agent-native dev
fi
[ -d .output ] || pnpm build
PORT=8090 HOST=127.0.0.1 exec pnpm start
