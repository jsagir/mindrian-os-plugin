#!/usr/bin/env bash
# Phase 401 plan F1 (quick 261127-f1a) verification aggregator.
#
# Runs the 4 tests of plan F1, each in its own new temp home (HOME,
# USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME), with the Brain URL pointed
# at a closed local port and no room or session variable set.
#
#
# Counters: PASSED, FAILED, SKIPPED (exit 77), KNOWN (always 0 here).
# exit 0 -> FAILED=0; exit 1 -> FAILED > 0.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
KNOWN=0

TMP_ALL="$(mktemp -d)"
trap 'rm -rf "$TMP_ALL"' EXIT

run() {
  local label="$1"; shift
  echo "--- $label ---"
  local h
  h="$(mktemp -d "$TMP_ALL/home.XXXXXX")"
  mkdir -p "$h/.mindrian" "$h/rooms"
  env -u CLAUDE_ACTIVE_ROOM -u CLAUDE_CODE_SESSION_ID -u MINDRIAN_ROOM \
    HOME="$h" USERPROFILE="$h" MINDRIAN_HOME="$h/.mindrian" MINDRIAN_ROOMS_HOME="$h/rooms" \
    MINDRIAN_BRAIN_URL="http://127.0.0.1:9" \
    "$@" </dev/null
  local status=$?
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  fi
  echo ""
}

run "401: frontmatter split (rule F1, rule B)" node tests/test-401-frontmatter-split.cjs
run "401: tool grants (rules G1, G2)" node tests/test-401-tool-grants.cjs
run "401 no brain preapproval" node tests/test-401-no-brain-preapproval.cjs
run "401: release order (R1 to R4)" node tests/test-401-release-order.cjs
run "401 keep-list" node tests/test-401-keep-list.cjs
run "401 admin tool not shipped" node tests/test-401-admin-tool-not-shipped.cjs
run "401 brain backend retired" node tests/test-401-brain-backend-retired.cjs

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
exit $(( FAIL > 0 ? 1 : 0 ))
