#!/usr/bin/env bash
# Phase 380 verification aggregator: the /m:os face panel mod shipped inside the plugin
# (walled package ui/mos-face, 34 engine tests, the install-and-load proof).
# Written once by plan 380-01; later plans never edit it; every test that a
# later plan creates is guarded by run_if, so a not-yet-landed leg reports
# SKIPPED (missing ...) and never crashes.
#
# Modeled on tests/run-all-379.1.1.sh (run / run_if / run_known_if counters).
# Hyphens only.
#
# Counters: PASSED (exit 0), FAILED (non-zero, not 77), SKIPPED (a missing planned
# file, or exit 77 from a plain run), KNOWN (a recorded pre-existing red).
# exit 0 -> FAILED=0.
#
# Fail-closed legs: the engine tests and the installed-layout proof never skip on an
# environment gap. A missing claude CLI, npm or registry FAILS the cut. The person fixes
# the machine and runs again.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0; SKIP=0; KNOWN=0

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

run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then run "$label" "$@"
  else echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""; fi
}

# run_strict <label> <cmd...>
# Like run, but exit 77 counts as FAILED: the gate never skips the 34 tests silently.
run_strict() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: FAILED (claude CLI missing: the engine tests did not run)"; FAIL=$((FAIL+1))
  else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# run_strict_if <label> <guard-file> <cmd...>
# A missing guard file is SKIPPED (the test has not landed yet). Once the file exists,
# exit 77 counts as FAILED: an environment gap blocks the cut instead of skipping the check.
run_strict_if() {
  local label="$1"; local guard="$2"; shift 2
  echo "--- $label ---"
  if [ ! -f "$guard" ]; then echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""; return; fi
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: FAILED (environment gap blocks the cut: $label)"; FAIL=$((FAIL+1))
  else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# run_known_if <label> <guard> <signature> <cmd...>
# A pre-existing red this phase does not own (the run-all-366.sh idiom, guarded
# like run_if). Exit 0 -> PASSED (known red healed). Non-zero exit whose
# combined output carries the literal signature -> KNOWN. Any other non-zero
# exit -> FAILED (a new failure mode, investigate).
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

# --- (1) Phase 380 tests (each created by its own plan) -----------------------
run_strict    "380 engine tests (34 original, claude plugin test)" node tests/test-380-engine-tests.cjs
run_if        "380 wall (root manifests untouched, one pinned devDependency)" tests/test-380-wall.cjs            node tests/test-380-wall.cjs
run_if        "380 typecheck"                                      tests/test-380-typecheck.cjs                  node tests/test-380-typecheck.cjs
run_if        "380 egress (Canon Part 8, own words)"               tests/test-380-egress.cjs                     node tests/test-380-egress.cjs
run_if        "380 budget (probe, polling, hook cost)"             tests/test-380-budget.cjs                     node tests/test-380-budget.cjs
run_if        "380 copy (plain-English words)"                     tests/test-380-copy.cjs                       node tests/test-380-copy.cjs
run_if        "380 command copy check"                             ui/mos-face/scripts/face-commands.cjs         node ui/mos-face/scripts/face-commands.cjs --check
run_if        "380 decisions"                                      tests/test-380-decisions.cjs                  node tests/test-380-decisions.cjs
run_if        "380 build"                                          tests/test-380-build.cjs                      node tests/test-380-build.cjs
run_if        "380 rename (source owner mos-face, dist owner mos)"  tests/test-380-rename.cjs                     node tests/test-380-rename.cjs
run_strict_if "380 installed layout (install and load)"            tests/test-380-installed-layout.cjs           node tests/test-380-installed-layout.cjs
run_if        "380 gate wiring"                                    tests/test-380-gate-wiring.cjs                node tests/test-380-gate-wiring.cjs
run_if        "380 shots harness"                                  tests/test-380-shots-harness.cjs              node tests/test-380-shots-harness.cjs
run_if        "380 canon Theo faces (asset hash, structure, no hand-copied numbers)" tests/test-380-theo-faces.cjs node tests/test-380-theo-faces.cjs
run_if        "380 canon Theo faces fixture check"                 ui/mos-face/scripts/theo-faces.cjs            node ui/mos-face/scripts/theo-faces.cjs --check
run_if        "380 job line (taxonomy parity, outcomes, no outbound word)" tests/test-380-jobs.cjs             node tests/test-380-jobs.cjs
run_if        "380 job table check (generated from the taxonomy)"  ui/mos-face/scripts/face-jobs.cjs             node ui/mos-face/scripts/face-jobs.cjs --check
run_if        "380 status parity (every status line field mapped, real status line on a fixture home)" tests/test-380-status-parity.cjs node tests/test-380-status-parity.cjs
run_if        "380 glossary hold (no glossary first sentences ship)" tests/test-380-glossary-hold.cjs        node tests/test-380-glossary-hold.cjs

# --- (2) Dash fence on this phase's files (hyphens only) ----------------------
# Only EXISTING paths are scanned (ls -d), so a missing path never masks a hit.
# LC_ALL=C is required: under a UTF-8 locale grep -P reads the byte escapes as
# code points and can match nothing, so the fence would pass vacuously.
run "no em-dash or en-dash in phase 380 files" bash -c '
  files=$(ls -d tests/test-380-*.cjs \
    tests/run-all-380.sh \
    scripts/build-mos-face.cjs \
    lib/mos-face/dist 2>/dev/null)
  ui=$(find ui/mos-face \( -name node_modules -o -name package-lock.json -o -path "ui/mos-face/.claude-plugin/types" \) -prune -o -type f -print 2>/dev/null)
  all="$files $ui"
  [ -z "${all// /}" ] && exit 0
  hits=$(LC_ALL=C grep -rlP "\xE2\x80\x94|\xE2\x80\x93" $all)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
[ "$FAIL" -eq 0 ]
