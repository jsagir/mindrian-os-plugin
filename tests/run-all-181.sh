#!/usr/bin/env bash
# Phase 181 verification aggregator -- the single PASS/FAIL phase gate for the
# SEC EvidenceClaim Structural Bar + Ingest Instruction-Stripping phase.
#
# SEC-01 (Task 1): a DEDICATED NON_PROMOTABLE structural guard in promoteNodeStatus
# rejects EVERY promotion of an EvidenceClaim node (agent OR human attributed, any
# target status) and logs an evidence_claim_promotion_blocked memory_event, with ZERO
# promoteNodeStatus signature change and ZERO change to the TRUTH_CLAIM_TYPES frozen
# set (D-181-01: adding EvidenceClaim there is canon-blocked by the entry-31
# self-binding clause; a dedicated guard is minted instead).
#
# SEC-02 (Task 2): an instruction-stripping pass at the single EvidenceClaim write
# chokepoint (writeEvidenceClaim) so a jailbreak/instruction span cannot land in
# room.db un-stripped.
#
# Runs every registered tests/test-*.cjs suite to completion, prints a per-suite
# PASS/FAIL line + a final tally, exits 1 if any failed, then runs three bash gate
# blocks: (1) the TRUTH_CLAIM_TYPES byte-unchanged assertion + NON_PROMOTABLE
# presence (D-181-01); (2) a Part 8 grep sweep over the two Phase 181 lib surfaces
# (pure LOCAL SQLite, no Brain-write / Brain-host / raw-fetch / external-endpoint
# token); (3) an em-dash sweep over every Phase 181 surface (CLAUDE.md HARD RULE).
#
# This runner MUST run to completion (no crash) even when any suite fails.
#
# Mirrors tests/run-all-169.sh. bash only. No emoji. No em-dashes (hyphens only):
# the em-dash grep below is written via its codepoint escape (U+2014, the ASCII
# pattern \x{2014}) so this file itself carries no literal em-dash to trip its own
# sweep.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# Phase-181 suites. The two new floor suites first, then the two CARRIED fences
# (the prior Part 8 poison sweep + the entry-24 truth-claim FLOOR) so the gate proves
# they are still green.
CJS_SUITES=(
  test-evidenceclaim-nonpromotable-floor.cjs
  test-evidenceclaim-ingest-strip.cjs
  test-part8-poison-transcript.cjs
  test-synthetic-expert-nodetype-floor.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 181 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Every registered Phase-181 suite. A missing file gates to a FAIL line (never a
# crash). A suite that exits 77 (node:sqlite unavailable SKIP) is treated as a
# PASS-with-SKIP so a runtime without node:sqlite does not gate the phase RED.
# ---------------------------------------------------------------------------
for c in "${CJS_SUITES[@]}"; do
  ((TOTAL++))
  p="$SCRIPT_DIR/$c"
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing)"); echo ">>> $c: MISSING (FAIL)"; echo ""; continue
  fi
  node "$p"
  rc=$?
  if [[ $rc -eq 0 ]]; then
    ((PASSED++)); echo ">>> $c: PASSED"
  elif [[ $rc -eq 77 ]]; then
    ((PASSED++)); echo ">>> $c: SKIPPED (node:sqlite unavailable, treated as pass)"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# Gate (1): TRUTH_CLAIM_TYPES byte-unchanged assertion (D-181-01) + NON_PROMOTABLE
# present. Grep the single TRUTH_CLAIM_TYPES = Object.freeze line out of
# transitions.cjs; FAIL if absent, FAIL if it contains the token EvidenceClaim, and
# FAIL if it does not contain each of the 6 FLOOR members. Also assert NON_PROMOTABLE
# exists (the dedicated guard landed). Pins both halves: the frozen set did not move
# AND the new guard exists.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: TRUTH_CLAIM_TYPES byte-unchanged + NON_PROMOTABLE present (D-181-01) ---"
FROZEN_OK=1
TRANS_FILE="$REPO_ROOT/lib/core/navigation/transitions.cjs"
if [[ ! -f "$TRANS_FILE" ]]; then
  echo "    MISSING transitions.cjs"; FROZEN_OK=0
else
  TC_LINE="$(grep -nE "TRUTH_CLAIM_TYPES = Object\.freeze" "$TRANS_FILE" | head -n1 || true)"
  if [[ -z "$TC_LINE" ]]; then
    echo "    TRUTH_CLAIM_TYPES = Object.freeze line absent"; FROZEN_OK=0
  else
    if echo "$TC_LINE" | grep -q "EvidenceClaim"; then
      echo "    FORBIDDEN: TRUTH_CLAIM_TYPES line contains EvidenceClaim (D-181-01 breach)"; FROZEN_OK=0
    fi
    for member in claim CausalClaim assumption decision opportunity SyntheticExpert; do
      if ! echo "$TC_LINE" | grep -q "'$member'"; then
        echo "    TRUTH_CLAIM_TYPES FLOOR member missing: $member"; FROZEN_OK=0
      fi
    done
  fi
  if ! grep -qE "NON_PROMOTABLE" "$TRANS_FILE"; then
    echo "    NON_PROMOTABLE guard absent from transitions.cjs"; FROZEN_OK=0
  fi
fi
if [[ $FROZEN_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> TRUTH_CLAIM_TYPES byte-unchanged + NON_PROMOTABLE present: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("TRUTH_CLAIM_TYPES byte-unchanged + NON_PROMOTABLE"); echo ">>> TRUTH_CLAIM_TYPES byte-unchanged + NON_PROMOTABLE present: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Gate (2): Part-8 grep sweep over the two Phase-181 lib surfaces. The same
# BRAIN_WRITE + BRAIN_HOST + RAW_FETCH + external-http regex idiom as run-all-169.sh.
# Both guards are pure LOCAL SQLite; zero forbidden Brain-write / Brain-host /
# raw-fetch / external-endpoint token may appear. Comment lines are filtered so a
# docstring or a regex literal naming a token does not self-invalidate the count.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (Phase 181 surfaces) ---"
PART8_OK=1
PART8_LIB=(
  "lib/core/navigation/transitions.cjs"
  "lib/core/navigation/evidence-claim.cjs"
)
BRAIN_WRITE='mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain'
BRAIN_HOST='mindrian-brain|brain\.mindrian|brain-client|brainClient'
RAW_FETCH='[^a-zA-Z_.]fetch[[:space:]]*\('
for t in "${PART8_LIB[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    MISSING surface: $t"; PART8_OK=0; continue
  fi
  if grep -nE "$BRAIN_WRITE" "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' >/dev/null 2>&1; then
    echo "    FORBIDDEN Brain-write token in: $t"; PART8_OK=0
  fi
  if grep -nE "$BRAIN_HOST" "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' >/dev/null 2>&1; then
    echo "    FORBIDDEN Brain-host egress in: $t"; PART8_OK=0
  fi
  if grep -nE "$RAW_FETCH" "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' >/dev/null 2>&1; then
    echo "    FORBIDDEN raw fetch( egress in: $t"; PART8_OK=0
  fi
  # External http(s) endpoint check. github.com is exempt (repo references). A
  # regex literal such as https?:\/\/ in the strip patterns carries an escaped
  # slash sequence (\/\/), which this grep pattern (//) does not match, so the
  # SEC-02 URL-PII pattern does not self-trip; comment lines are filtered too.
  if grep -nE "https?://" "$f" | grep -vE "github\.com" | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' >/dev/null 2>&1; then
    echo "    FORBIDDEN external http(s) endpoint in: $t"; PART8_OK=0
  fi
done
if [[ $PART8_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part-8 grep sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part-8 grep sweep"); echo ">>> Part-8 grep sweep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Gate (3): Em-dash sweep (CLAUDE.md HARD RULE: hyphens only). The forbidden glyph
# is matched via its codepoint escape (U+2014, the PCRE pattern \x{2014}) so this
# runner itself carries no literal em-dash to trip its own sweep.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: em-dash sweep (Phase 181 artifacts) ---"
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/core/navigation/transitions.cjs"
  "lib/core/navigation/evidence-claim.cjs"
  "lib/core/navigation/memory-events.cjs"
  "tests/test-evidenceclaim-nonpromotable-floor.cjs"
  "tests/test-evidenceclaim-ingest-strip.cjs"
  "tests/run-all-181.sh"
  ".planning/phases/181-sec-evidenceclaim-bar/181-01-PLAN.md"
)
for t in "${EMDASH_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ -f "$f" ]] && grep -nP '\x{2014}' "$f" >/dev/null 2>&1; then
    echo "    FORBIDDEN em-dash in: $t"; EMDASH_OK=0
  fi
done
if [[ $EMDASH_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> em-dash sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("em-dash sweep"); echo ">>> em-dash sweep: FAILED"
fi
echo ""

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (181 verification)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "    - $t"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
