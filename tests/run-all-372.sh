#!/usr/bin/env bash
# Phase 372 (context_assemble reports what it omitted: _meta.omitted) aggregator.
# Modeled on tests/run-all-347.sh. bash only. Hyphens only, no em-dashes.
#
# Environment note. A peer session can leave the repository node_modules without
# the packages that lib/core/navigation.cjs and lib/mcp/tools/context.cjs load
# (ajv, gray-matter). This file never installs anything. It keeps the NODE_PATH
# you set if those packages resolve; otherwise it tries a read-only fallback and
# prints one line. The legs that start the MCP server also need the repository
# node_modules itself: the server starts a self-heal npm install when that
# folder is missing, so those legs refuse to run instead of triggering it.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0

# ---- NODE_PATH: keep it when ajv resolves, else use a read-only fallback ----
needs_resolve() {
  node -e "for (const m of ['ajv/dist/2020', 'gray-matter']) require.resolve(m)" >/dev/null 2>&1
}
if ! needs_resolve; then
  FALLBACKS=("$HOME/Theo/node_modules")
  for d in "$HOME"/.claude/plugins/cache/mindrian-marketplace/mos/*/node_modules; do
    [ -d "$d" ] && FALLBACKS+=("$d")
  done
  CHOSEN=""
  for cand in "${FALLBACKS[@]}"; do
    [ -d "$cand" ] || continue
    if NODE_PATH="$cand${NODE_PATH:+:$NODE_PATH}" needs_resolve; then CHOSEN="$cand"; break; fi
  done
  if [ -n "$CHOSEN" ]; then
    export NODE_PATH="$CHOSEN${NODE_PATH:+:$NODE_PATH}"
    echo "note: ajv did not resolve from the repository; NODE_PATH now includes $CHOSEN (read-only fallback)"
  else
    echo "note: ajv does not resolve and no fallback node_modules was found; legs that load navigation.cjs will fail"
  fi
fi

run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# A leg that starts the MCP server. Refuse when the repository node_modules is
# missing: the server would start a detached npm install in the repository.
run_wire() {
  local label="$1"; shift
  if [ ! -d "$ROOT/node_modules" ]; then
    echo "--- $label ---"
    echo ">>> $label: FAILED (repository node_modules is missing; the server would start an npm install, so this leg did not run)"
    FAIL=$((FAIL+1)); echo ""
    return
  fi
  run "$label" "$@"
}

# ---- the new test and the golden compare ----
run "372 omitted test (SPEC 1 to 7)" node tests/test-372-omitted.cjs
run "372 golden compare (pre-existing fields unchanged)" node tests/helpers/fixture-room-372.cjs --compare-golden

# ---- the existing room-context and focus tests ----
run "get-room-context" node tests/test-get-room-context.cjs
run "room-context latency" node tests/test-room-context-latency.cjs
run "room-context Part 8 invariant" node tests/test-room-context-part8-invariant.cjs
run "347 context focus" node tests/test-347-context-focus.cjs
run "347 ranked-set exclusion" node tests/test-347-ranked-set-exclusion.cjs
run "353 turn budget" node tests/test-353-turn-budget.cjs
run "legD recency golden" node tests/test-legd-recency-golden.cjs

# ---- the description pins (decision D3) ----
run "connector registry check" node scripts/build-connector-registry.cjs --check
run_wire "267 dual-era wire snapshot" node tests/test-267-mcpv2-dual-era.cjs
run_wire "267 zod4 contract wire snapshot" node tests/test-267-mcpv2-zod4-contract.cjs
run_wire "270 tool-schema budget" node tests/test-270-tool-schema-budget.cjs
run_wire "234 tool description floor" node tests/test-234-tool-description-floor.cjs
run_wire "265 mcp description hygiene" node tests/test-265-mcp-description-hygiene.cjs

# ---- the honesty ledger: the failure set must equal the two known rows ----
leg_276_failure_set() {
  local out names expected
  out="$(node tests/test-276-tool-honesty-findings-closed.cjs 2>&1)"
  names="$(printf '%s\n' "$out" | sed -n 's/^  - live non-OK row \([^ ]*\) has a ledger disposition.*/\1/p' | sort | tr '\n' ' ')"
  expected="room_list.(default) room_search.(default) "
  printf '%s\n' "$out" | grep -E "passed|failed" | tail -n 1
  echo "failing rows: ${names:-none}"
  if [ "$names" = "$expected" ]; then return 0; fi
  echo "expected exactly: $expected"
  return 1
}
run "276 failure set unchanged (room_list and room_search only)" leg_276_failure_set

leg_honesty_scan() {
  local out
  out="$(node scripts/check-tool-honesty.cjs --check 2>&1)"
  printf '%s\n' "$out" | grep "WARN" | cut -c1-140
  if printf '%s\n' "$out" | grep -q "context_assemble"; then
    echo "the honesty scan names context_assemble"
    return 1
  fi
  return 0
}
run "honesty scan does not name context_assemble" leg_honesty_scan

# ---- em-dash and en-dash guard (U+2014 and U+2013 as UTF-8 bytes) ----
leg_dash_guard() {
  local files=(
    tests/test-372-omitted.cjs
    tests/helpers/fixture-room-372.cjs
    tests/run-all-372.sh
    lib/core/navigation/room-context.cjs
    lib/mcp/tools/context.cjs
  )
  local f
  for f in .planning/phases/372-*/*.md; do [ -f "$f" ] && files+=("$f"); done
  local hit=0
  for f in "${files[@]}"; do
    [ -f "$f" ] || continue
    if grep -n -e $'\xe2\x80\x94' -e $'\xe2\x80\x93' "$f"; then
      echo "dash found in $f"; hit=1
    fi
  done
  return $hit
}
run "no em-dash or en-dash in the files this phase owns" leg_dash_guard

# ---- whitespace check limited to the files this phase owns ----
run "git diff --check on phase-owned files" git diff --check -- \
  lib/core/navigation/room-context.cjs lib/mcp/tools/context.cjs \
  tests/helpers/fixture-room-372.cjs tests/test-372-omitted.cjs tests/run-all-372.sh \
  tests/fixtures/267/wire-snapshot-zod4.json tests/fixtures/267/wire-snapshot-zod3.json

echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
