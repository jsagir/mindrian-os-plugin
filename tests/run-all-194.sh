#!/usr/bin/env bash
# Phase 194 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# per-session-room-binding + multi-session-reconcile cluster. Cloned verbatim
# from tests/run-all-188.sh (run/run_if helpers byte-identical), retargeted to
# the PSB-01..16 test map.
#
# Phase 194 kills the single-global-active-room RACE: it replaces the shared
# mutable reg.active string with (a) a per-session room binding SET + primary
# (the F.8 gate), and (b) an optimistic lost-update reconcile on the existing
# nodes.last_modified_at CAS token at the navigation.cjs chokepoint (the F.9
# gate). It mints NO new frozen scalar: MAX_K=3, DIAL_REACH_K=6, 0.70/0.15,
# F.8 MAX_TOGGLE_N=4, F.9 PAGE_CEILING=4 are byte-untouched. The one new scalar
# (stale-reap 5m = 300000 ms) is NOT a frozen-family member; it matches the
# shipped orphan-sweep window.
#
# WAVE 0 CONTRACT: this runner is authored before the modules land. Every module
# leg is run_if (SKIP-safe until the enabling file exists), so Wave 0 exits
# cleanly with SKIPs. Each leg's run_if gates on the NET-NEW artifact its wave
# introduces (e.g. the reconcile-guard leg gates on
# lib/core/navigation/reconcile-guard.cjs); missing files SKIP, they never FAIL.
# As the waves land, the SKIPs flip to runs and the gate tightens.
#
# The two legs that MUST be accounted for in Wave 0 are:
#   (1) the Part 8 local-only source-grep floor (test-194-local-only.test.cjs) --
#       authored to PASS green in Wave 0 (zero modules exist yet, so nothing to
#       flag), and it stays green as each new module lands clean;
#   (2) the last_modified_at coverage floor (test-194-lastmod-discipline.test.cjs)
#       -- run_if-gated on the Wave-4 sentinel lib/core/navigation/reconcile-guard.cjs
#       so it SKIPs until Wave 4 (194-06) repairs the read-merge-write UPDATE
#       sites, then flips to a hard run.
#
# bash only. No emoji. No em-dashes.

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
    echo "--- $label ---"
    echo ">>> $label: SKIPPED (file not present: $file)"
    echo ""
    SKIP=$((SKIP+1))
  fi
}

# ---------------------------------------------------------------------------
# FLOOR 1 (Part 8 local-only, HARD, green in Wave 0). Source-greps every NEW
# 194 module that exists for a Brain/network token and FAILs if one appears.
# Green today because zero 194 modules exist yet; stays green as each lands clean.
# ---------------------------------------------------------------------------
run "PSB Part 8 local-only floor (zero Brain/network token in new modules)" \
  node tests/test-194-local-only.test.cjs

# ---------------------------------------------------------------------------
# FLOOR 2 (last_modified_at coverage). Phase 194-06 Task 1 repaired the four
# read-merge-write UPDATE sites (abstraction-claim + both breakthrough sites +
# check-pending), so this floor is now a HARD run (flipped from run_if). It is
# the standing guardrail against a future writer re-opening the lost-update hole.
# ---------------------------------------------------------------------------
run "PSB last_modified_at coverage floor (CAS token discipline)" \
  node tests/test-194-lastmod-discipline.test.cjs

# ---------------------------------------------------------------------------
# Wave 1 -- session/presence file primitives (PSB-01, PSB-11/12/13).
# ---------------------------------------------------------------------------
run_if "PSB-01 session-binding file (read/write + safe defaults)" \
  lib/core/session-binding.cjs \
  node tests/test-session-binding-file.test.cjs

run_if "PSB-11/12 presence fast-path (no co-session -> skip guard; live -> arm)" \
  lib/core/session-presence.cjs \
  node tests/test-presence-fast-path.test.cjs

run_if "PSB-13 presence stale-reap (dead pid OR mtime>5m reaped; live never)" \
  lib/core/session-presence.cjs \
  node tests/test-presence-stale-reap.test.cjs

# ---------------------------------------------------------------------------
# Wave 2 -- session-aware resolution (PSB-02, PSB-03, PSB-15). The new resolver
# entry points land inside the existing resolve-active-room.cjs, so these legs
# gate on the Wave-1 net-new dependency lib/core/session-binding.cjs (the reader
# they compose) rather than on the pre-existing resolver file.
# ---------------------------------------------------------------------------
run_if "PSB-02 resolveWriteRoom (.room-root -> primary -> reg.active demoted)" \
  lib/core/session-binding.cjs \
  node tests/test-resolve-write-room.test.cjs

run_if "PSB-03 resolveSessionScope (on-scope iff top room in bound)" \
  lib/core/session-binding.cjs \
  node tests/test-resolve-session-scope.test.cjs

# ---------------------------------------------------------------------------
# Wave 3 -- the binding gate (PSB-04/05, PSB-06, PSB-07). The write-guard flip
# lands inside the existing write-scope-check.cjs, so its leg gates on the
# Wave-1 net-new dependency lib/core/session-binding.cjs.
# ---------------------------------------------------------------------------
run_if "PSB-04/05 session-binding consumer (F.8 set -> session file, no-room option)" \
  lib/workflow/session-binding-consumer.cjs \
  node tests/test-session-binding-consumer.test.cjs

run_if "PSB-06 binding gate degrade (exit-0 on injected error)" \
  lib/workflow/session-binding-consumer.cjs \
  node tests/test-binding-gate-degrade.test.cjs

run_if "PSB-07 write-scope set-membership (block off-bound, allow no-room)" \
  lib/core/session-binding.cjs \
  node tests/test-write-scope-set-membership.test.cjs

# ---------------------------------------------------------------------------
# Wave 4 -- reconcile (PSB-08/09, PSB-10) + the e2e concurrency integration.
# ---------------------------------------------------------------------------
run_if "PSB-08/09 reconcile-guard (drift->conflict, equal->pass, NULL->no-claim, append->no-op)" \
  lib/core/navigation/reconcile-guard.cjs \
  node tests/test-reconcile-guard.test.cjs

run_if "PSB-10 reconcile F.9 adapter (APPROVE re-applies, REJECT NOT_APPLIED, DEFER CONTRADICTS)" \
  lib/workflow/reconcile-f9-adapter.cjs \
  node tests/test-reconcile-f9-adapter.test.cjs

run_if "PSB e2e two-session lost-update -> reconcile integration" \
  lib/core/navigation/reconcile-guard.cjs \
  node tests/test-194-concurrency-integration.test.cjs

# ---------------------------------------------------------------------------
# Wave 5 -- health + lifecycle (PSB-14). The bind-check job lands inside the
# existing doctor.cjs, so this leg gates on the Wave-1 net-new dependency
# lib/core/session-presence.cjs (the presence register it composes).
# ---------------------------------------------------------------------------
run_if "PSB-14 doctor --bind-check (healthy/unhealthy; registers presence; no Brain call)" \
  lib/core/session-presence.cjs \
  node tests/test-doctor-bind-check.test.cjs

# ---------------------------------------------------------------------------
# RCA resolve-active-room-cross-session-bleed. The regression floor for the two
# defects that made the PSB session precedence unreachable in practice:
#   D2 -- leg 2 derived the bound room's dir as path.join(home, primary), which
#         is false for every SUB-room, so a bound session silently degraded to
#         the machine-wide reg.active.
#   D1 -- scripts/intent-classifier.cjs resolved the F.1 / F.8 room via the
#         MACHINE-WIDE resolver and never consulted the session binding at all.
# Together these meant reg.active was still the de-facto authority for every
# session, which is exactly what Phase 194 set out to kill.
# ---------------------------------------------------------------------------
run "PSB cross-session room bleed (bound session resolves its OWN room, incl. sub-rooms)" \
  node tests/test-cross-session-room-bleed.cjs

echo "========================================"
echo "  Summary (194 verification)"
echo "  Passed: $PASS   Failed: $FAIL   Skipped: $SKIP"
echo "========================================"
[ "$FAIL" -eq 0 ]
