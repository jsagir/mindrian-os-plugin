#!/usr/bin/env bash
# Phase 383 verification aggregator (the beta.77 QA fixes: Windows room birth, skill routing, gate
# honesty, voice).
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence each:
#   QA383-01: a room can be created on Windows: one resolver finds a working Git Bash and a working
#     Python 3.9 or newer, rejects the WSL launcher and the Microsoft Store stub, and every spawn of
#     scripts/room-registry goes through one helper.
#   QA383-02: a plain request for a room routes to the room-creation surface, not to a side skill.
#   QA383-03: the room-creation card offers a real fork and never a fork the user cannot take.
#   QA383-04: a preview of a room checks the environment first; with no working runtime there is no
#     card and no write.
#   QA383-05: a failed room creation says what failed in plain words, never a raw code or a path.
#   QA383-06: the card text speaks to the user in the second person and never about "the navigator".
#   QA383-07: a number shown to the user carries its source, or it is not shown.
#   QA383-08: a reply stays inside the length limit unless it is a deliverable.
#   QA383-09: the doctor names a missing runtime and a doubled room tree, and cleans only on a digest.
#   QA383-10: nothing is written to disk before the gate is approved, and an absolute room path never
#     nests inside the rooms home.
#
# DISCOVERY IS BY GLOB (mirrors tests/run-all-381.sh). Every tests/test-383-*.cjs file is discovered
# and run. Adding one needs NO edit here. The found-eq-0 guard is load-bearing: a run that discovers
# nothing FAILS, it never prints green. TEST_383_PREFIX exists only so that guard is provable without
# editing this file.
#
# PART 8 SOURCE SWEEP: the files this phase adds or rewrites are swept for Brain and network egress
# tokens. A target that does not exist yet is SKIPPED and does not fail the leg.
#
# DASH FENCE: every file this phase adds or edits is swept for U+2014 and U+2013.
#
# Bash 3.2 compatible: no associative arrays, no mapfile. Hyphens only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (the run-all-216 idiom): the offline preload is inherited by every spawned leg.
export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

PREFIX="${TEST_383_PREFIX:-tests/test-383-}"
PHASE_DIR=".planning/phases/383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones"

PASS=0
FAIL=0
SKIP=0

run_may_skip() {
  local label="$1"; shift
  local out rc
  echo "--- $label ---"
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out"
  if [ "$rc" -ne 0 ]; then
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  elif printf '%s' "$out" | grep -qE '^SKIP'; then
    echo ">>> $label: SKIPPED"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# DISCOVERY
# ---------------------------------------------------------------------------
DISCOVERED_TEST_FILES=()
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  DISCOVERED_TEST_FILES+=("$t")
  run_may_skip "$(basename "$t")" node "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no Phase 383 test files discovered (TEST_383_PREFIX=$PREFIX)"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# ---------------------------------------------------------------------------
# PART 8 SOURCE SWEEP (the run-all-270 forbidden-token regex)
# ---------------------------------------------------------------------------
echo "--- 383 Part 8 source sweep ---"
PART8_OK=1
PART8_TARGETS=(
  "lib/core/platform.cjs"
  "lib/mcp/startup-operations.cjs"
  "lib/hmi/larry-reply-checks.cjs"
  "scripts/check-voice-style.cjs"
  "lib/core/doctor/room-runtime-module.cjs"
  "lib/core/doctor/doubled-room-trees-module.cjs"
  "scripts/room-registry"
)
PART8_FORBIDDEN='brain-client|brain_query|pws-brain|fetch\(|https?://|node:https?|curl |wget '
for t in "${PART8_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    case "$t" in
      scripts/room-registry)
        hits="$(grep -v '^\s*\(//\|\*\|/\*\|#\)' "$f" | grep -Ec "$PART8_FORBIDDEN" || true)" ;;
      *)
        hits="$(grep -v '^\s*\(//\|\*\|/\*\)' "$f" | grep -Ec "$PART8_FORBIDDEN" || true)" ;;
    esac
    if [ "${hits:-0}" -gt 0 ]; then
      echo "    FORBIDDEN egress token(s) in: $t ($hits match(es))"
      PART8_OK=0
    else
      echo "    clean: $t"
    fi
  else
    echo "SKIP $t (not built yet)"
  fi
done
if [ "$PART8_OK" -eq 1 ]; then
  echo ">>> 383 Part 8 source sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 383 Part 8 source sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# DASH FENCE (U+2014 em-dash, U+2013 en-dash)
# ---------------------------------------------------------------------------
echo "--- 383 dash fence ---"
DASH_OK=1
DASH_TARGETS=(
  "tests/run-all-383.sh"
  "tests/helpers/harness-383.cjs"
  "lib/core/platform.cjs"
  "lib/core/room-open.cjs"
  "lib/core/navigation/room-birth.cjs"
  "lib/core/navigation/room-identity.cjs"
  "lib/core/room-auto-create.cjs"
  "lib/core/graph-backfill.cjs"
  "lib/mcp/startup-operations.cjs"
  "lib/mcp/tool-router.cjs"
  "scripts/room-registry"
  "scripts/session-start"
  "scripts/check-voice-style.cjs"
  "scripts/doctor.cjs"
  "lib/hmi/larry-reply-checks.cjs"
  "data/doctor-modules.json"
  "agents/larry-extended.md"
  "commands/rooms.md"
  "skills/rooms/SKILL.md"
  "commands/doctor.md"
  "commands/new-project.md"
  "skills/new-project/SKILL.md"
)
for t in "${DISCOVERED_TEST_FILES[@]}"; do
  DASH_TARGETS+=("$t")
done
shopt -s nullglob
for t in "$PHASE_DIR"/*.md; do
  DASH_TARGETS+=("$t")
done
shopt -u nullglob
for t in "${DASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -cP '\x{2014}|\x{2013}' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      DASH_OK=0
    elif [ "${hits:-0}" -gt 0 ]; then
      echo "    FORBIDDEN dash ($hits line(s)) in: $t"
      DASH_OK=0
    fi
  else
    echo "    SKIPPED (not present): $t"
  fi
done
# CHANGELOG.md: only the block from the top line to the first line that starts with
# "## [2.0.0-beta.77]" (the file holds older dashes below that line).
if [ -f "$ROOT/CHANGELOG.md" ]; then
  hits="$(awk '/^## \[2\.0\.0-beta\.77\]/ { exit } { print }' "$ROOT/CHANGELOG.md" | LC_ALL=C.UTF-8 grep -cP '\x{2014}|\x{2013}' 2>/dev/null)"; rc=$?
  if [ "$rc" -ge 2 ]; then
    echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: CHANGELOG.md top block"
    DASH_OK=0
  elif [ "${hits:-0}" -gt 0 ]; then
    echo "    FORBIDDEN dash ($hits line(s)) in: CHANGELOG.md top block"
    DASH_OK=0
  fi
else
  echo "    SKIPPED (not present): CHANGELOG.md"
fi
if [ "$DASH_OK" -eq 1 ]; then
  echo ">>> 383 dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 383 dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

echo "======================================"
echo "Phase 383: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
