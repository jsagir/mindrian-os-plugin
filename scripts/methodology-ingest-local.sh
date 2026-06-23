#!/usr/bin/env bash
# Mindrian methodology-ingest LOCAL step (Phase 171, the "local step 7").
#
# Run this AFTER a methodology is written to the remote Brain (Neo4j + Pinecone),
# to make it operable by the LOCAL intelligence + framework-invocation mapping
# WITHOUT any live Brain call. There are no local framework embeddings; local
# intelligence runs on these generated, committed JSON registries + projection.
#
# Order matters: command-registry (framework->command) -> connector-registry
# (reach wiring) -> orchestration-projection (the local intelligence cache the
# navigation engine / dial / f-selector-ranker read). Each is drift-checked.
#
# House rule: hyphens only, no em-dashes.
set -u
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1
fail=0

echo "[1/4] framework-names allowlist (refresh from Brain if reachable; else keep snapshot)"
node scripts/build-command-registry.cjs --refresh-names || echo "  (Brain unavailable; keeping committed framework-names.json snapshot)"

echo "[2/4] command registry (framework -> /mos command)"
node scripts/build-command-registry.cjs && node scripts/build-command-registry.cjs --check || { echo "  DRIFT: command-registry"; fail=1; }

echo "[3/4] connector registry (sensor/reach wiring)"
node scripts/build-connector-registry.cjs && node scripts/build-connector-registry.cjs --check || { echo "  DRIFT: connector-registry"; fail=1; }

echo "[4/4] brain-orchestration projection (the LOCAL intelligence cache)"
node scripts/build-orchestration-projection.cjs && node scripts/build-orchestration-projection.cjs --check || { echo "  DRIFT: orchestration-projection"; fail=1; }

if [ "$fail" -eq 0 ]; then
  echo "OK: local intelligence + invocation mapping refreshed; framework operable Local-Only."
else
  echo "FAIL: one or more registries drifted or flagged UN-WIRED/UN-RANKED. See output above."
fi
exit "$fail"
