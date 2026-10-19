#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node tests/test-371-startup-ui.cjs
node tests/test-startup-flows.cjs --browser
node tests/test-room-first-entry.cjs --browser
node tests/test-gpt-plugin-ui.cjs --browser
node lib/mcp/no-instructions.test.cjs
node tests/test-room-birth.cjs
node tests/test-36925-rid-birth.cjs
node tests/test-36925-rft-birth.cjs
node scripts/build-connector-registry.cjs --check
node scripts/build-orchestration-projection.cjs --check
node scripts/build-harness-manifest.cjs --check
node scripts/check-render-coverage.cjs
git diff --check
printf '\nPhase 371 local acceptance: PASS. Real ChatGPT host verification is separate.\n'
