#!/usr/bin/env bash
# Phase 217 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# doctor.cjs architecture rethink (migrate 13 ad-hoc check* functions into the
# accumulative-engine module registry, split each into its own runner file, wire
# print + fix structurally, harden the whole thing behind the D-03 contract gate,
# add the D-05 card-fire-health module, and reconcile commands/doctor.md via the
# D-04 audit + doc-parity guard).
#
# The phase gate has TWO legs (the 211/215/216 pattern):
#   (1) this aggregator green (all offline, hermetic, zero network), AND
#   (2) the Plan 07 navigator real-room smoke recorded (a HUMAN runs
#       node scripts/doctor.cjs --all TWICE on the real machine and confirms the
#       same visible rows appear both runs -- the Pitfall-1 watermark kill shot --
#       plus a bare run and a run of THIS script; hermetic tests cannot safely
#       simulate every real ~/MindrianRooms room-registry edge case).
#
# ZERO-network expectation: every leg is a LOCAL diagnostic. The doctor checks
# read local files (install cache, room registry, ~/.mindrian, session
# transcripts); none reach the Brain or any network (Canon Part 8). The two async
# smokes (brain-smoke M, eureka-smoke S) are the only network-capable surfaces and
# are DELIBERATELY excluded from this aggregator (they are opt-in / carve-outs).
#
# DELIBERATE EXCLUSIONS:
#   - test-doctor-class-p / test-doctor-class-q: KNOWN pre-existing failures at the
#     phase base commit, confirmed unrelated to this migration by quick 260711-nrd,
#     logged to deferred-items.md. Excluded on purpose so the migration never masks
#     or "fixes" them; they stay isolated.
#   - brain-smoke (M) / eureka-smoke (S): opt-in async carve-outs, network-capable.
#
# bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# (1) D-03 module contract-parity: the HARD-BLOCKING declaration-completeness gate
#     over every data/doctor-modules.json entry (the migration's enforcement organ).
run "217 D-03 module contract-parity" \
  node tests/test-doctor-module-contract-parity.cjs

# (2) The accumulative-engine selector: cadence:always runs every invocation,
#     watermark gating, findings-spread into report.checks[<id>], flag gate.
run "217 module selector (engine)" \
  node tests/test-doctor-module-selector.cjs

# (3) The generic fix-renderer + Summary parity (12 sub-tests).
run "217 fix-renderer + summary parity" \
  node tests/test-doctor-fix-renderer.cjs

# (4) D-05 card-fire-health instrument-health module (absent/valid/malformed/stale log).
run "217 D-05 card-fire-health module" \
  node tests/test-doctor-card-fire-health.cjs

# (5) D-04 doc-vs-code parity: doctor.md flags vs parseArgs flags + --fix class set.
run "217 D-04 doc-parity" \
  node tests/test-doctor-doc-parity.cjs

# (6-15) The migrated class checks + their fixes (regression coverage over the
#        moved runner files). Class B carries its NEWLY-wired Plan-04 fix.
run "217 class B (cascade-rooms sentinel + fix)" \
  node tests/test-doctor-class-b.cjs

run "217 class C (active-room guard silence)" \
  node tests/test-doctor-class-c.cjs

run "217 class E (room-md + fix)" \
  node tests/test-doctor-class-e.cjs

run "217 class F (ui-compliance scan)" \
  node tests/test-doctor-class-f.cjs

run "217 class G (statusline-visibility)" \
  node tests/test-doctor-class-g.cjs

run "217 class G fix" \
  node tests/test-doctor-class-g-fix.cjs

run "217 class H (install-incomplete)" \
  node tests/test-doctor-class-h.cjs

run "217 class H fix" \
  node tests/test-doctor-class-h-fix.cjs

run "217 class I (install-state + topology + version-of-record)" \
  node tests/test-doctor-class-i.cjs

run "217 class J (deployment-surfaces)" \
  node tests/test-doctor-class-j.cjs

# (16) Class N silent-disable watchdog (the plugin-enabled-state module).
run "217 class N plugin-disabled-state" \
  node tests/test-doctor-plugin-disabled-state.cjs

# (17) The doctor's own UI-Ruling self-compliance (the renderer's glyph/zone contract).
run "217 doctor UI self-compliant" \
  node tests/test-doctor-ui-self-compliant.cjs

echo "======================================"
echo "Phase 217: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
