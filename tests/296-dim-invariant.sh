#!/usr/bin/env bash
# tests/296-dim-invariant.sh -- RSLOCAL-04 source gate, SKIP-tolerant by
# design (296-RESEARCH.md Finding F-4, the 384-dim/1024-dim non-mixing
# invariant).
#
# This gate probes whether plan 296-04's repoint has landed yet. Until it
# does, lib/core/rs_cache.py still imports the pinecone SDK for its
# multilingual-e5-large (1024-dim) integrated embedding path, and this gate
# SKIPs honestly rather than asserting a fact that is not yet true.
# tests/run-all-296.sh's run_may_skip arm turns a leading "SKIP:" line into a
# SKIPPED count (not a PASS, not a FAIL), so bash tests/run-all-296.sh stays
# green through waves 1-3 instead of carrying a red arm nobody expects to
# pass yet -- exactly the class of false-success this repo has already paid
# for when a gate is left red-and-ignored.
#
# Once the probe passes (296-04 has landed), this gate asserts four things:
#   1. lib/core/rs_cache.py contains zero occurrences of the literal 1024.
#   2. lib/core/rs_cache.py contains zero occurrences of multilingual-e5-large.
#   3. scripts/rs-engine.py still contains the runtime backstop that compares
#      every vector length against `dim` inside _build_sem_matrix_from_records
#      (`len(v) != dim`) -- the guard that turns a dimensional mix into a
#      clean None and a local re-embed instead of a silent wrong cosine.
#   4. lib/core/rs-engine.cjs still documents the invariant. Its header
#      comment naming "1024" is EXPECTED and must not be swept; this gate
#      only asserts the file exists, never that the warning is removed.
#
# All post-probe assertions run on comment-stripped input:
#   grep -v '^[[:space:]]*#'                       for Python
#   grep -v '^[[:space:]]*\(//\|\*\|/\*\)'          for CJS
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RS_CACHE_PY="lib/core/rs_cache.py"
RS_ENGINE_PY="scripts/rs-engine.py"
RS_ENGINE_CJS="lib/core/rs-engine.cjs"

# ---------------------------------------------------------------------------
# Probe: has the 296-04 repoint landed? Comment-stripped rs_cache.py still
# importing the pinecone SDK means it has not.
# ---------------------------------------------------------------------------
if [ ! -f "$RS_CACHE_PY" ]; then
  echo "SKIP: $RS_CACHE_PY does not exist (unexpected -- this file predates this phase)"
  exit 0
fi

STRIPPED_RS_CACHE="$(grep -v '^[[:space:]]*#' "$RS_CACHE_PY")"
if printf '%s\n' "$STRIPPED_RS_CACHE" | grep -qE 'import pinecone|from pinecone'; then
  echo "SKIP: rs_cache.py still on the Pinecone path (repoint lands in plan 296-04)"
  exit 0
fi

# ---------------------------------------------------------------------------
# Post-repoint assertions
# ---------------------------------------------------------------------------
FAIL=0

# 1. rs_cache.py: zero occurrences of the literal 1024.
hits="$(printf '%s\n' "$STRIPPED_RS_CACHE" | grep -Ec '1024' || true)"
if [ "$hits" -gt 0 ]; then
  echo "FAIL: assertion 1 -- $RS_CACHE_PY still contains '1024' ($hits match(es))"
  FAIL=1
fi

# 2. rs_cache.py: zero occurrences of multilingual-e5-large.
hits="$(printf '%s\n' "$STRIPPED_RS_CACHE" | grep -Ec 'multilingual-e5-large' || true)"
if [ "$hits" -gt 0 ]; then
  echo "FAIL: assertion 2 -- $RS_CACHE_PY still contains 'multilingual-e5-large' ($hits match(es))"
  FAIL=1
fi

# 3. rs-engine.py: the runtime dim-mismatch backstop must still be present.
if [ ! -f "$RS_ENGINE_PY" ]; then
  echo "FAIL: assertion 3 -- $RS_ENGINE_PY does not exist"
  FAIL=1
else
  hits="$(grep -v '^[[:space:]]*#' "$RS_ENGINE_PY" | grep -Fc 'len(v) != dim' || true)"
  if [ "$hits" -eq 0 ]; then
    echo "FAIL: assertion 3 -- $RS_ENGINE_PY is missing the 'len(v) != dim' runtime backstop"
    FAIL=1
  fi
fi

# 4. rs-engine.cjs: must still exist and document the invariant. A "1024" in
# its header comment is EXPECTED and is NOT swept here.
if [ ! -f "$RS_ENGINE_CJS" ]; then
  echo "FAIL: assertion 4 -- $RS_ENGINE_CJS does not exist"
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "PASS"
  exit 0
else
  exit 1
fi
