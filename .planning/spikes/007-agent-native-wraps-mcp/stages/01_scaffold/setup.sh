#!/usr/bin/env bash
# Spike 007, stage 01: scaffold the agent-native app and lay the spike overlay on it.
# Reproducible: the generated app (mos-ui/) is git-ignored; this script rebuilds it.
# Telemetry off (the agent-native CLI reports to analytics.agent-native.com by default).
# Removes the scaffold's CLAUDE.md, .claude/ and .mcp.json: a nested CLAUDE.md
# auto-loads into any Claude session that reads files here (observed 2026-10-02).
set -euo pipefail
cd "$(dirname "$0")/../.."
export DO_NOT_TRACK=1 AGENT_NATIVE_TELEMETRY_DISABLED=1 CI=1
if [ ! -d mos-ui ]; then
  npx --yes @agent-native/core@0.198.8 create mos-ui --standalone --template chat
fi
rm -f mos-ui/CLAUDE.md
rm -rf mos-ui/.claude mos-ui/.mcp.json
cp -r stages/02_actions/overlay/. mos-ui/
cp stages/02_actions/env.spike mos-ui/.env
cd mos-ui
pnpm install --reporter=silent
pnpm add @modelcontextprotocol/sdk@1.29.0 --reporter=silent
echo "mos-ui ready. Next: stages/01_scaffold/serve.sh"
