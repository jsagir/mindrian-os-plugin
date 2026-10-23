#!/usr/bin/env bash
# Phase 379.1.1 verification aggregator: post beta.73 close-out (the integrity
# gate on a fresh clone, the ledger release step, the ICM eval freshness check).
# Written once by plan 379.1.1-01; later plans never edit it; every test that a
# later plan creates is guarded by run_if, so a not-yet-landed leg reports
# SKIPPED (missing ...) and never crashes.
#
# Modeled on tests/run-all-366.sh (run / run_if / run_known_if counters).
# Hyphens only.
#
# Counters: PASSED (exit 0), FAILED (non-zero, not 77), SKIPPED (exit 77 or a
# missing planned file), KNOWN (a recorded pre-existing red). exit 0 -> FAILED=0.

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

# --- (1) Phase 379.1.1 tests (each created by its own plan) -------------------
run_if "379.1.1 integrity gate generated targets" tests/test-379.1.1-integrity-generated-targets.cjs node tests/test-379.1.1-integrity-generated-targets.cjs
run_if "379.1.1 ledger release step"              tests/test-379.1.1-ledger-release-step.cjs         node tests/test-379.1.1-ledger-release-step.cjs
run_if "379.1.1 eval freshness"                   tests/test-379.1.1-eval-freshness.cjs              node tests/test-379.1.1-eval-freshness.cjs

# --- (2) Neighbors the phase touches ------------------------------------------
run_if "353 release wiring"                       tests/test-353-release-wiring.cjs                  node tests/test-353-release-wiring.cjs
run_if "349 release wiring"                       tests/test-349-release-wiring.cjs                  node tests/test-349-release-wiring.cjs
run_if "349 docs lockstep"                        tests/test-349-docs-lockstep.cjs                   node tests/test-349-docs-lockstep.cjs
run_if "369.1 release lockstep"                   tests/test-369.1-release-lockstep.cjs              node tests/test-369.1-release-lockstep.cjs
run_if "353 grader agreement"                     tests/test-353-grader-agreement.cjs                node tests/test-353-grader-agreement.cjs
run_if "doctor module contract parity"            tests/test-doctor-module-contract-parity.cjs       node tests/test-doctor-module-contract-parity.cjs
# slow leg, about 3 to 5 minutes (it scans the whole tree)
run_if "366 semantic index integrity (slow)"      tests/test-366-semantic-index-integrity.cjs        node tests/test-366-semantic-index-integrity.cjs

# --- (3) The last ICM eval run record -----------------------------------------
run "evals/icm/last-run.json: key present, agreement >= 0.8, code checks all pass" node -e '
  const d = JSON.parse(require("node:fs").readFileSync("evals/icm/last-run.json", "utf8"));
  const ok = d.key_present === true && typeof d.agreement === "number" && d.agreement >= 0.8 && d.code_pass === d.code_total;
  if (!ok) { console.error("last-run.json check failed: " + JSON.stringify({ key_present: d.key_present, agreement: d.agreement, code_pass: d.code_pass, code_total: d.code_total })); process.exit(1); }
  console.log("last-run.json ok: " + JSON.stringify({ agreement: d.agreement, code_pass: d.code_pass, code_total: d.code_total }));'

# --- (4) Dash fence on this phase's files (hyphens only) ----------------------
# Only EXISTING paths are scanned (ls -d), so a missing path never masks a hit.
# LC_ALL=C is required: under a UTF-8 locale grep -P reads the byte escapes as
# code points and can match nothing, so the fence would pass vacuously.
run "no em-dash or en-dash in phase 379.1.1 files" bash -c '
  files=$(ls -d scripts/check-require-integrity.cjs \
    scripts/release-lib/ledger-rebuild.sh \
    lib/core/icm-eval-freshness.cjs \
    tests/test-379.1.1-*.cjs \
    tests/run-all-379.1.1.sh 2>/dev/null)
  [ -z "$files" ] && exit 0
  hits=$(LC_ALL=C grep -rlP "\xE2\x80\x94|\xE2\x80\x93" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
[ "$FAIL" -eq 0 ]
