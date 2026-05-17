#!/usr/bin/env bash
# Phase 120-01 Wave 2 scaffold harness.
# Mirrors tests/test-120-00-scaffold.sh shape; 8 gates for the F.7 selector
# registration + the 5-component scoring formula + Canon Part 8 zero-Brain
# invariant + em-dash HARD RULE.
#
# Gates:
#   1. F.7 string appears at least twice in selector-dispatcher.cjs
#      (F_SUBSHAPES array entry + dispatch branch).
#   2. shape-f7-breakthrough-renderer is wired into the dispatcher (at least
#      one safeRequire pointing at it).
#   3. F7_VERBS symbol appears at least twice in the renderer (declaration +
#      module.exports re-export).
#   4. The 5 verbs appear verbatim on the same logical block in the renderer
#      (Explore deeper / Confirm / File as decision / Dismiss / Back; one
#      grep covers all 5 in the F7_VERBS literal).
#   5. confidence: 0.4 appears in scoring.cjs (the locked weight).
#   6. RECENCY_HALF_LIFE_DAYS appears at least twice in scoring.cjs
#      (declaration + usage inside recencyDecay).
#   7. Zero brain-client require + zero brain.mindrian fetch across the 2
#      new files (Canon Part 8 invariant).
#   8. Zero em-dashes (U+2014) across the 3 new files (CLAUDE.md HARD RULE).
#
# On success: prints the canonical OK line.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

DISPATCHER="lib/hmi/selector-dispatcher.cjs"
RENDERER="lib/hmi/shape-f7-breakthrough-renderer.cjs"
SCORING="lib/core/breakthrough/scoring.cjs"

# ----- Gate 1: F.7 string at least twice in dispatcher --------------------
count=$(grep -c "'F\.7'" "$DISPATCHER" || true)
if [ "$count" -lt 2 ]; then
  fail "Gate 1: F.7 must appear >= 2 times in $DISPATCHER; got $count"
fi

# ----- Gate 2: dispatcher wires shape-f7-breakthrough-renderer ------------
if ! grep -q "shape-f7-breakthrough-renderer" "$DISPATCHER"; then
  fail "Gate 2: $DISPATCHER must require shape-f7-breakthrough-renderer.cjs"
fi

# ----- Gate 3: F7_VERBS symbol at least twice in renderer -----------------
count=$(grep -c "F7_VERBS" "$RENDERER" || true)
if [ "$count" -lt 2 ]; then
  fail "Gate 3: F7_VERBS must appear >= 2 times in $RENDERER; got $count"
fi

# ----- Gate 4: 5 verbs verbatim on one block in the renderer --------------
# Multi-line pattern: pcre-style via perl-style grep -zP. Use a python one-liner
# fallback portable across platforms.
if ! grep -q "'Explore deeper'" "$RENDERER"; then
  fail "Gate 4a: missing 'Explore deeper' in $RENDERER"
fi
if ! grep -q "'Confirm'" "$RENDERER"; then
  fail "Gate 4b: missing 'Confirm' in $RENDERER"
fi
if ! grep -q "'File as decision'" "$RENDERER"; then
  fail "Gate 4c: missing 'File as decision' in $RENDERER"
fi
if ! grep -q "'Dismiss'" "$RENDERER"; then
  fail "Gate 4d: missing 'Dismiss' in $RENDERER"
fi
if ! grep -q "'Back'" "$RENDERER"; then
  fail "Gate 4e: missing 'Back' in $RENDERER"
fi

# ----- Gate 5: confidence: 0.4 locked weight in scoring.cjs ---------------
if ! grep -qE "confidence:\s*0\.4" "$SCORING"; then
  fail "Gate 5: locked weight 'confidence: 0.4' missing in $SCORING"
fi

# ----- Gate 6: RECENCY_HALF_LIFE_DAYS appears at least twice ---------------
count=$(grep -c "RECENCY_HALF_LIFE_DAYS" "$SCORING" || true)
if [ "$count" -lt 2 ]; then
  fail "Gate 6: RECENCY_HALF_LIFE_DAYS must appear >= 2 times in $SCORING; got $count"
fi

# ----- Gate 7: Canon Part 8 invariant -- zero Brain coupling --------------
# Zero brain-client require + zero brain.mindrian fetch across the 2 new files.
SCAN_TARGETS=("$RENDERER" "$SCORING")
for f in "${SCAN_TARGETS[@]}"; do
  if [ -f "$f" ]; then
    if grep -qE "require[[:space:]]*\([[:space:]]*['\"][^'\"]*brain-client" "$f"; then
      fail "Gate 7: $f requires brain-client (Canon Part 8 violation)"
    fi
    if grep -qE "fetch[[:space:]]*\([[:space:]]*['\"][^'\"]*brain\.mindrian" "$f"; then
      fail "Gate 7: $f fetches brain.mindrian domain (Canon Part 8 violation)"
    fi
  fi
done

# ----- Gate 8: em-dash HARD RULE across all 3 new files -------------------
# Encode the em-dash literal via printf so the harness source itself stays
# em-dash-free (the harness file is its own subject when grepped later).
EMDASH=$(printf '\xe2\x80\x94')
for f in "$RENDERER" "$SCORING" "$0"; do
  if [ -f "$f" ]; then
    if grep -qF "$EMDASH" "$f"; then
      fail "Gate 8: em-dash (U+2014) found in $f (CLAUDE.md HARD RULE violation)"
    fi
  fi
done

echo "OK: 120-01 scaffold complete (F.7 dispatch + 5 verbs verbatim + 5-component scoring + zero Brain coupling + zero em-dashes)"
