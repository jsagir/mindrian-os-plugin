#!/usr/bin/env bash
# Copyright (c) 2026 Mindrian. BSL 1.1.
#
# tests/272-dispatch-chokepoint.sh
#
# Phase 272, PYPORT-04. Acceptance grep for D-04's dispatch chokepoint
# (272-CONTEXT.md D-04, RESEARCH.md Finding F-8). RED BY DESIGN TODAY:
# lib/core/rs-backend-dispatch.cjs does not exist yet, and none of the three
# real callers routes backend selection through it.
#
# Pitfall 6 (RESEARCH.md) names the exact failure mode this guards against:
# "Shipping a CJS backend no caller can select ... exactly Phase 134's
# failure, reproduced inside its own remediation."
#
# WHAT THIS CHECKS, per Finding F-8's full spawn-site audit:
#   lib/agents/reverse-salient-agent.cjs     (execFileSync, spawns rs-engine.py)
#   lib/core/intelligence-cascade.cjs        (spawns compute-hsi.py, among others)
#   lib/core/futures/orchestrator.cjs        (spawns compute-hsi.py and rs-engine.py)
#
# Each of these three MUST require lib/core/rs-backend-dispatch.cjs and route
# its CJS-vs-Python decision through it -- no module outside the dispatch
# chokepoint may decide directly (mirrors the connector-spine "no second
# selection brain" rule, CLAUDE.md "Connector Spine" section).
#
# DELIBERATELY OUT OF SCOPE: one additional spawn target inside
# lib/core/intelligence-cascade.cjs, used for a different analyzer (not
# rs-engine.py, not compute-hsi.py), is explicitly OUT of this phase's D-04
# dispatch-wiring scope -- PYPORT-04's own VALIDATION.md test-map row names
# only rs-engine.py and compute-hsi.py as this chokepoint's targets. This
# script must never grep for that other target's filename.
#
# PRACTICAL CHECK (grep-based, per the plan's own instruction): proving full
# reachability-through-dispatch by pure grep is not possible with complete
# precision, so this script checks the provable proxy -- each caller must
# require rs-backend-dispatch.cjs, and the dispatch module itself must exist
# and export a resolveBackend-named function. That require is what is
# missing today, which is what makes this script RED by design.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DISPATCH_MODULE="lib/core/rs-backend-dispatch.cjs"
CALLERS=(
  "lib/agents/reverse-salient-agent.cjs"
  "lib/core/intelligence-cascade.cjs"
  "lib/core/futures/orchestrator.cjs"
)

OK=1

echo "--- 272 dispatch chokepoint acceptance grep (PYPORT-04, D-04) ---"
echo ""

# --- Assert: the dispatch module itself exists and exports a resolveBackend- ---
# --- named function (module.exports containing resolveBackend / resolve_backend). ---
if [ -f "$ROOT/$DISPATCH_MODULE" ]; then
  if grep -Eq "module\.exports" "$ROOT/$DISPATCH_MODULE" \
     && grep -Eiq "resolve[_-]?[Bb]ackend" "$ROOT/$DISPATCH_MODULE"; then
    echo "    PASS: $DISPATCH_MODULE exists and appears to export a resolveBackend-named function"
  else
    echo "    FAIL: $DISPATCH_MODULE exists but does not appear to export a resolveBackend-named function"
    OK=0
  fi
else
  echo "    FAIL: $DISPATCH_MODULE does not exist yet (expected until plan 272-04 lands)"
  OK=0
fi

echo ""

# --- Assert: every real caller from F-8's table requires the dispatch ---
# --- chokepoint. This is a practical, grep-based proxy for "routes its ---
# --- backend decision through the single chokepoint, never decides directly." ---
for f in "${CALLERS[@]}"; do
  target="$ROOT/$f"
  if [ ! -f "$target" ]; then
    echo "    FAIL: $f does not exist (expected to exist and require the dispatch module)"
    OK=0
    continue
  fi
  if grep -Fq "rs-backend-dispatch" "$target" && grep -Eq "require\(" "$target"; then
    echo "    PASS: $f requires rs-backend-dispatch.cjs"
  else
    echo "    FAIL: $f does not require rs-backend-dispatch.cjs -- it must route backend selection through the D-04 dispatch chokepoint, not decide directly (Pitfall 6)"
    OK=0
  fi

  # Informational only (not a blocking check): the fallback python branch is
  # expected to still reference the literal script path somewhere in the file
  # once the dispatch wiring lands, since D-04 keeps python as a retained
  # fallback, not a deletion.
  if grep -Eq "rs-engine\.py|compute-hsi\.py" "$target"; then
    echo "      note: $f still references a python script path (expected -- D-04 retains it as the fallback branch)"
  fi
done

echo ""
if [ "$OK" -eq 1 ]; then
  echo ">>> 272 dispatch chokepoint: PASSED"
  exit 0
else
  echo ">>> 272 dispatch chokepoint: FAILED (expected today -- the dispatch chokepoint lands in a later wave)"
  exit 1
fi
