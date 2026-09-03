#!/usr/bin/env bash
# tests/296-pinecone-residue.sh -- the two-sided Pinecone boundary gate
# (296-06, Task 1).
#
# Most residue checks only assert absence. This one asserts BOTH directions,
# because the likelier failure here is an over-eager cleanup silently
# breaking scripts/compute-hsi.py Tier 2, not a missed removal:
#
#   PRESENCE -- the two Pinecone surfaces 296-CONTEXT.md D-06 deliberately
#     KEPT (requirements-hsi.txt's pinecone declaration, compute-hsi.py's
#     Tier 2 PINECONE_API_KEY read, lib/core/pinecone-inference.cjs's
#     api.pinecone.io egress) are still present and still load.
#   ABSENCE -- the one Pinecone surface this phase RETIRED
#     (lib/core/rs_cache.py's SDK calls, and the pinecone_id /
#     eureka_vec-direct-read hazards named in 296-RESEARCH.md) is gone from
#     every file plan 296-04/296-05 touched.
#
# Cited: 296-CONTEXT.md D-06 ("PINECONE_API_KEY and the pinecone package
# stay -- still load-bearing for compute-hsi.py Tier 2 and
# lib/core/pinecone-inference.cjs"). 296-RESEARCH.md Pitfall 4 ("pinecone
# leaves requirements-hsi.txt; compute-hsi.py --tier 2 breaks; the failure
# is SILENT because the import is try/except-guarded and the feature just
# returns a degraded result... HSI scores that look plausible but changed
# after the edit").
#
# Discovered automatically by tests/run-all-296.sh's "$PREFIX"*.sh arm -- no
# runner edit needed.
#
# Every count below pipes through strip_py or strip_cjs first. A bare
# grep -c against an unfiltered file is forbidden in this script: rs_cache.py,
# rs_hybrid.py and rs-engine.py all document the retirement in prose and
# would otherwise fail their own gate on a docstring mention.
#
# bash only. No em-dashes (hyphens only).

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

strip_py() {
  grep -v '^[[:space:]]*#'
}

strip_cjs() {
  grep -v '^[[:space:]]*\(//\|\*\|/\*\)'
}

FAIL=0
fail() {
  # $1=assertion id  $2=file  $3=description of the token counted
  echo "FAIL: $1 -- $2 ($3)"
  FAIL=1
}

# ---------------------------------------------------------------------------
# PRESENCE side: the surfaces D-06 deliberately kept must still be present
# and must still load.
# ---------------------------------------------------------------------------

# P1. requirements-hsi.txt still declares pinecone. REQUIRED, not merely
# permitted.
F="requirements-hsi.txt"
if [ ! -f "$F" ]; then
  fail "P1" "$F" "file does not exist"
else
  hits="$(strip_py < "$F" | grep -Ec 'pinecone' || true)"
  if [ "$hits" -eq 0 ]; then
    fail "P1" "$F" "zero occurrences of 'pinecone', expected at least 1 (pinecone>=5.0.0)"
  fi
fi

# P2. scripts/compute-hsi.py non-comment source still references
# PINECONE_API_KEY (the Tier 2 gate).
F="scripts/compute-hsi.py"
if [ ! -f "$F" ]; then
  fail "P2" "$F" "file does not exist"
else
  hits="$(strip_py < "$F" | grep -Ec 'PINECONE_API_KEY' || true)"
  if [ "$hits" -eq 0 ]; then
    fail "P2" "$F" "zero occurrences of 'PINECONE_API_KEY' in non-comment source"
  fi
fi

# P3. lib/core/pinecone-inference.cjs exists and its non-comment source
# still contains api.pinecone.io (Phase 272's audited /embed egress).
F="lib/core/pinecone-inference.cjs"
if [ ! -f "$F" ]; then
  fail "P3" "$F" "file does not exist (Phase 272's deliberate, audited /embed module)"
else
  hits="$(strip_cjs < "$F" | grep -Ec 'api\.pinecone\.io' || true)"
  if [ "$hits" -eq 0 ]; then
    fail "P3" "$F" "zero occurrences of 'api.pinecone.io' in non-comment source"
  fi
fi

# P4. compute-hsi.py must still load and run.
if ! python3 scripts/compute-hsi.py --help >/dev/null 2>&1; then
  fail "P4" "scripts/compute-hsi.py" "'python3 scripts/compute-hsi.py --help' did not exit 0"
fi

# P5. pinecone-inference.cjs must still be requireable.
if ! node -e "require('./lib/core/pinecone-inference.cjs')" >/dev/null 2>&1; then
  fail "P5" "lib/core/pinecone-inference.cjs" "require() did not exit 0"
fi

# ---------------------------------------------------------------------------
# ABSENCE side: the one Pinecone surface this phase retired must be gone
# from every file it touched.
# ---------------------------------------------------------------------------

# A1. lib/core/rs_cache.py non-comment source: zero of the retired
# Pinecone-SDK tokens.
F="lib/core/rs_cache.py"
if [ ! -f "$F" ]; then
  fail "A1" "$F" "file does not exist"
else
  A1_STRIPPED="$(strip_py < "$F")"
  A1_FORBIDDEN='import pinecone|from pinecone|PINECONE_API_KEY|create_index_for_model|upsert_records|describe_index|api\.pinecone\.io'
  hits="$(printf '%s\n' "$A1_STRIPPED" | grep -Ec "$A1_FORBIDDEN" || true)"
  if [ "$hits" -gt 0 ]; then
    fail "A1" "$F" "$hits forbidden token match(es) (import pinecone|from pinecone|PINECONE_API_KEY|create_index_for_model|upsert_records|describe_index|api.pinecone.io)"
  fi
fi

# A2. lib/core/rs_hybrid.py non-comment source: zero PINECONE_API_KEY.
F="lib/core/rs_hybrid.py"
if [ ! -f "$F" ]; then
  fail "A2" "$F" "file does not exist"
else
  hits="$(strip_py < "$F" | grep -Ec 'PINECONE_API_KEY' || true)"
  if [ "$hits" -gt 0 ]; then
    fail "A2" "$F" "$hits occurrence(s) of 'PINECONE_API_KEY' in non-comment source"
  fi
fi

# A3. scripts/rs-engine.py non-comment source: zero PINECONE_API_KEY.
F="scripts/rs-engine.py"
if [ ! -f "$F" ]; then
  fail "A3" "$F" "file does not exist"
else
  hits="$(strip_py < "$F" | grep -Ec 'PINECONE_API_KEY' || true)"
  if [ "$hits" -gt 0 ]; then
    fail "A3" "$F" "$hits occurrence(s) of 'PINECONE_API_KEY' in non-comment source"
  fi
fi

# A4. No pinecone_id key remains anywhere under lib/ or scripts/ in .py or
# .cjs files.
hits=0
while IFS= read -r -d '' f; do
  case "$f" in
    *.py) c="$(strip_py < "$f" | grep -Ec 'pinecone_id' || true)" ;;
    *.cjs) c="$(strip_cjs < "$f" | grep -Ec 'pinecone_id' || true)" ;;
    *) c=0 ;;
  esac
  if [ "$c" -gt 0 ]; then
    fail "A4" "$f" "$c occurrence(s) of 'pinecone_id' in non-comment source"
    hits=$((hits + c))
  fi
done < <(find lib scripts \( -name '*.py' -o -name '*.cjs' \) -print0)

# A5. No Python file under lib/core/ or scripts/ names eureka_vec or
# eureka_vec_fallback in non-comment source (the F-2 direct-read fence,
# held a second time here so it survives a node-side refactor of
# tests/296-vector-read-both-backends.test.cjs).
while IFS= read -r -d '' f; do
  c="$(strip_py < "$f" | grep -Ec 'eureka_vec_fallback|eureka_vec\b' || true)"
  if [ "$c" -gt 0 ]; then
    fail "A5" "$f" "$c occurrence(s) of 'eureka_vec'/'eureka_vec_fallback' in non-comment Python source (direct-read hazard, F-2)"
  fi
done < <(find lib/core scripts -name '*.py' -print0)

# ---------------------------------------------------------------------------
if [ "$FAIL" -eq 0 ]; then
  echo "PASS"
  exit 0
else
  exit 1
fi
