#!/usr/bin/env bash
# Bake-off candidate B: serve the production build on 127.0.0.1 only (Phase 369
# plan 16). Never `agent-native dev`: dev binds every interface and starts a PTY
# terminal server (spike 007, trail 8). Port 8092 is a chosen default distinct
# from the workroom candidate's 8091, so both serve side by side; PORT overrides.
# Requires MOS_DAEMON_URL (the daemon base URL, 127.0.0.1 only). The proposal
# source is MOS_PROPOSAL_SOURCE (fixed or adapter), as candidate A.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -z "${MOS_DAEMON_URL:-}" ]; then
  echo "serve.sh: MOS_DAEMON_URL is required (for example http://127.0.0.1:3847)" >&2
  exit 2
fi
cd "$HERE/app"
export DO_NOT_TRACK=1 AGENT_NATIVE_TELEMETRY_DISABLED=1 AUTH_DISABLED=true
export MOS_DAEMON_URL
# D-14 and SEED-067: no agent-native model loop, chat, integrations or terminal.
export AGENT_NATIVE_DISABLED_PLUGINS="agent-chat,integrations,terminal,onboarding,observational-memory,context-xray"
[ -d .output ] || { echo "serve.sh: no production build; run build.sh first" >&2; exit 3; }
PORT="${PORT:-8092}" HOST=127.0.0.1 HOSTNAME=127.0.0.1 NITRO_HOST=127.0.0.1 NITRO_PORT="${PORT:-8092}" exec pnpm start
