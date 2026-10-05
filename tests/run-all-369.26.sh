#!/usr/bin/env bash
# Phase 369.26 (2026-10-06): the Mindrian Workspace mod, an orientation band and a docked
# review. Written ONCE by plan 369.26-01; later plans never edit it, so every planned test is
# named here now and guarded with run_if (a not-yet-landed leg reports SKIPPED (missing ...)).
# Exit 77 is SKIPPED (ENV GAP), never PASSED. Hyphens only.
#
# Modeled on tests/run-all-369.1.sh (run / run_if / run_known_if counters).
#
# Counters:
#   PASSED  exit 0
#   FAILED  non-zero and not 77 (and, for run_known_if, not the declared signature)
#   SKIPPED exit 77 (ENV GAP) or a missing planned file
#   KNOWN   a pre-existing red this phase does not own, matched by exact signature
# The script exits 0 only when FAILED=0.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0; SKIP=0; KNOWN=0
MOD=ui/mindrian-workspace-mod

# run <label> <cmd...>: exit 0 -> PASSED, exit 77 -> SKIPPED (ENV GAP, never a
# pass), anything else -> FAILED.
run() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# run_if <label> <guard-file> <cmd...>: SKIPPED (missing ...) when the guard
# file is not there yet.
run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then run "$label" "$@"
  else echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""; fi
}

# run_known_if <label> <guard-file> <signature> <cmd...>
# A pre-existing red this phase does not own (the run-all-363.sh run_known idiom,
# guarded like run_if). Exit 0 -> PASSED (known red healed). Exit 77 -> SKIPPED.
# Non-zero exit whose combined output carries the literal signature -> KNOWN.
# Any other non-zero exit -> FAILED (a new failure mode, investigate).
run_known_if() {
  local label="$1"; local guard="$2"; local signature="$3"; shift 3
  echo "--- $label ---"
  if [ ! -f "$guard" ]; then echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""; return; fi
  local out
  out="$("$@" 2>&1)"
  local status=$?
  printf '%s\n' "$out" | tail -n 8
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED (known red healed)"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  elif printf '%s' "$out" | grep -qF -- "$signature"; then
    echo ">>> $label: KNOWN (pre-existing red, signature matched)"; KNOWN=$((KNOWN+1))
  else
    echo ">>> $label: FAILED (exit $status, recorded signature NOT found: $signature)"; FAIL=$((FAIL+1))
  fi
  echo ""
}

# run_claude <label> <subcommand> <dir>: a `claude plugin <subcommand> <dir>` leg. Exit 77
# (ENV GAP) when the claude binary is not on PATH, so a machine without it never reports PASSED.
run_claude() {
  local label="$1"; local sub="$2"; local dir="$3"
  if ! command -v claude >/dev/null 2>&1; then
    echo "--- $label ---"; echo ">>> $label: SKIPPED (ENV GAP, claude not on PATH)"; SKIP=$((SKIP+1)); echo ""; return
  fi
  run "$label" claude plugin "$sub" "$dir"
}

# --- (1) the wall and the mod under the real engine ---------------------------
run_if     "WS-01 wall guard"                          tests/test-369.26-wall.cjs  node tests/test-369.26-wall.cjs
run_claude "WS-01 claude plugin validate"              validate "$MOD"
run_claude "WS-01 claude plugin test"                  test     "$MOD"
run_if     "WS-01 mod type-check (tsc -p)"             "$MOD/scripts/typecheck.cjs" node "$MOD/scripts/typecheck.cjs"

# --- (2) phase legs, named now, landed by later plans (run_if) ----------------
run_if "copy deck"                                     tests/test-369.26-copy.cjs           node tests/test-369.26-copy.cjs
run_if "palette sync"                                  tests/test-369.26-palette-sync.cjs   node tests/test-369.26-palette-sync.cjs
run_if "render parser"                                 tests/test-369.26-render-parser.cjs  node tests/test-369.26-render-parser.cjs
run_if "registry sync"                                 tests/test-369.26-registry-sync.cjs  node tests/test-369.26-registry-sync.cjs
run_if "Canon Part 8 boundary"                         tests/test-369.26-part8.cjs          node tests/test-369.26-part8.cjs
run_if "source guards"                                 tests/test-369.26-source-guards.cjs  node tests/test-369.26-source-guards.cjs

# --- (3) regression neighbours (must stay green) ------------------------------
run_if "regression: 369 walled manifest"               tests/test-369-walled-manifest.cjs   node tests/test-369-walled-manifest.cjs
run_if "regression: 369 erasable TypeScript gate"      tests/test-369-ts-erasable-gate.cjs  node tests/test-369-ts-erasable-gate.cjs

# --- (4) long-dash guard (hyphens only) ---------------------------------------
# Only EXISTING paths are scanned (ls -d), so a missing path never masks a hit. LC_ALL=C is
# required: under a UTF-8 locale grep -P reads the byte escapes as code points and can match
# nothing, so the guard would pass vacuously. The two dashes appear only as printf byte
# escapes, never literally, so this file passes its own guard. The engine-written types
# folder is excluded.
run "no em-dash or en-dash in phase 369.26 files" bash -c '
  files=$(ls -d tests/run-all-369.26.sh tests/test-369.26-*.cjs ui/mindrian-workspace-mod \
    .planning/phases/369.26-mindrian-workspace-mod-an-orientation-band-and-docked-review/*.md 2>/dev/null)
  [ -z "$files" ] && exit 0
  pat="$(printf "\xE2\x80\x94|\xE2\x80\x93")"
  hits=$(LC_ALL=C grep -rlIP --exclude-dir=node_modules --exclude-dir=types --exclude-dir=output "$pat" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
[ "$FAIL" -eq 0 ]
