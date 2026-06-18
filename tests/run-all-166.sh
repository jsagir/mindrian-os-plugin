#!/usr/bin/env bash
# Phase 166 verification aggregator -- the single PASS/FAIL phase gate for the
# gated-chain-executor. Wave 1 (FOUNDATION) registers the two pre-work-blocker
# foundation suites (B1 pipeline-state isNext hard gate + B4 recipe-maps
# three-map authority); later waves append their suites here.
#
# This runner MUST run to completion (no crash) even when any suite fails: a
# missing file gates to a FAIL line, never a crash (mirrors run-all-156.sh:55-67).
#
# Mirrors tests/run-all-156.sh. bash only. No emoji. No em-dashes (hyphens
# only): the em-dash grep below is written via its codepoint escape (U+2014) so
# this file itself carries no literal em-dash to trip its own sweep.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
START_TIME=$(date +%s)

# Phase-166 CJS suites. Wave 1 (FOUNDATION) registers the two foundation suites;
# later waves (the runChain loop, capture/pass, gate) append below.
CJS_SUITES=(
  test-pipeline-state-isnext-gate.cjs
  test-recipe-maps-authority.cjs
  test-chain-executor-loop.cjs
  test-chain-executor-gate.cjs
  test-chain-retry-backoff.cjs
  test-chain-graceful-partial.cjs
  # Wave 4 MIGRATE act (the donor -> thinnest caller). Dependency order: the
  # pre-migration behavior CAPTURE runs FIRST (it writes/asserts the baseline
  # fixture the migration identity suite reads), then the migration + PRE===POST
  # identity suite. There is NO pre-existing act regression suite to register
  # (confirmed: tests/ carried none) -- the snapshot IS the regression net this
  # wave creates.
  test-act-prebehavior-snapshot.cjs
  test-act-on-runchain.cjs
  # Wave 5 MIGRATE pipeline (the consumer onto runChain). Dependency order: the
  # FIRST-ever pipeline-state.cjs shipped-behavior CAPTURE runs FIRST (it is the
  # regression net this wave creates -- pipeline-state.cjs shipped untested), then
  # the migration + provenanceFn + sole-truth-resume + PRE===POST identity suite.
  # There is NO pre-existing pipeline regression suite to register (confirmed:
  # tests/ carried none) -- the shipped-behavior capture IS the net.
  test-pipeline-state-shipped-behavior.cjs
  test-pipeline-on-runchain.cjs
  # Wave 6 MIGRATE ignite (the CONSUMER where the gate is ALWAYS material). The
  # ignite migration suite validates the runChain CONTRACT the doc commits to
  # (all-material halts + birthRoom ordering guard + promotion sequencing +
  # Defer/[stop] preserves the scratchpad). The three EXISTING birth-gate
  # regression suites are registered alongside it so the migration cannot drift
  # the shipped birth behavior unnoticed (the doc-content grep gate below proves
  # the DOC committed to runChain, since ignite.md is markdown with no runtime).
  test-ignite-on-runchain.cjs
  test-room-birth.cjs
  test-scratchpad-birth-answers.cjs
  test-memory-events-birth-floor.cjs
  # Wave 7 MIGRATE the larry seam (the LAST migration): larry-extended post-gate
  # HANDOFF to runChain + larry-personality auto-sequence branch. The handoff
  # suite validates the runChain CONTRACT both larry docs commit to (post-gate
  # handoff + still-halts-on-material + GUIDED-default preserved + resolver/Part 8
  # discipline). The EXISTING larry-personality reach-id drift doctrine suite is
  # registered alongside it so the SKILL.md edit cannot drift the frozen reach-id
  # doctrine / the GUIDED-default contract unnoticed (the doc-content grep gate
  # below proves both larry markdown surfaces committed to runChain AND preserved
  # the non-autonomous_safe safe-halt rule verbatim, since both are docs with no
  # runtime).
  test-larry-handoff-seam.cjs
  test-reach-ids-drift.cjs
  # Wave 8 VERIFY (the single phase gate, the harness-as-code property 6). The
  # adversarial structured verdict drives the SHIPPED runChain spine through every
  # SPEC acceptance scenario + the canon guards (B2 decide()-unchanged, B3
  # no-convergence-stop negative grep, B4 three-map authority, Part 9 journal,
  # EXEC-05 graceful partial, EXEC-06 cap, no-em-dash), and the Part 8 leak scan
  # sweeps every Phase-166 lib + command + skill + agent surface. The verdict
  # DELEGATES its Part 8 check to the leak suite, so both are registered here.
  test-chain-executor-verdict.cjs
  test-chain-executor-part8-leak.cjs
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

echo "========================================"
echo "  Phase 166 verification aggregator"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Every Phase-166 CJS suite. A missing file gates to a FAIL line (never a
# crash). Wave 1 covers the two pre-work blockers that MUST land before any
# runChain loop code exists (B1 + B4).
# ---------------------------------------------------------------------------
for c in "${CJS_SUITES[@]}"; do
  ((TOTAL++))
  p="$SCRIPT_DIR/$c"
  echo "--- Running: $c ---"
  if [[ ! -f "$p" ]]; then
    ((FAILED++)); FAILED_TESTS+=("$c (missing)"); echo ">>> $c: MISSING (FAIL)"; echo ""; continue
  fi
  if node "$p"; then
    ((PASSED++)); echo ">>> $c: PASSED"
  else
    ((FAILED++)); FAILED_TESTS+=("$c"); echo ">>> $c: FAILED"
  fi
  echo ""
done

# ---------------------------------------------------------------------------
# Part-8 grep sweep over the Phase-166 lib surfaces present so far for forbidden
# user-content-to-Brain / raw-external-egress tokens. recipe-maps.cjs joins
# posture ONLY from the LOCAL command-registry and reads the projection as a
# Brain-DERIVED LOCAL cache; it must open NO Brain-write / raw-fetch path.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Part-8 grep sweep (Phase-166 lib surfaces) ---"
PART8_OK=1
SWEEP_TARGETS=(
  "lib/core/recipe-maps.cjs"
  "lib/core/chain-executor.cjs"
  "lib/core/chain-retry.cjs"
  "lib/mcp/pipeline-state.cjs"
)

# No Brain-write MCP call / brain-write helper (the canonical Part 8 breach).
BRAIN_WRITE='mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain'
# No raw external HTTP egress (recipe-maps reads only local committed JSON maps).
RAW_FETCH='[^a-zA-Z_]fetch[[:space:]]*\('
for t in "${SWEEP_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    MISSING sweep target: $t"; PART8_OK=0; continue
  fi
  # Strip comment lines so a doc-comment naming a forbidden token cannot
  # self-invalidate the count (grep -v '^#'-style filtering for CJS comments).
  CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$f")
  if echo "$CODE" | grep -nE "$BRAIN_WRITE" >/dev/null 2>&1; then
    echo "    FORBIDDEN Brain-write token in: $t"; PART8_OK=0
  fi
  if echo "$CODE" | grep -nE "$RAW_FETCH" >/dev/null 2>&1; then
    echo "    FORBIDDEN raw fetch( egress in: $t"; PART8_OK=0
  fi
  if echo "$CODE" | grep -nE "https?://" | grep -vE "github\.com" >/dev/null 2>&1; then
    echo "    FORBIDDEN external http(s) endpoint in: $t"; PART8_OK=0
  fi
  if echo "$CODE" | grep -nE "brain-client|brainClient|brain_client" >/dev/null 2>&1; then
    echo "    FORBIDDEN brain-client require in: $t"; PART8_OK=0
  fi
done

# Wave 7: extend the Part-8 sweep to the two larry markdown surfaces. The
# auto-sequence branch must keep the Brain push an OFFER (the fetch fires only
# after the gate, SKILL.md reach rule 5). Assert NO new pre-gate Brain fetch was
# added to either larry doc: no mcp__brain_ fetch call, no brain-write helper.
# Markdown comment lines (<!-- ... -->) are stripped so a doc-comment naming a
# forbidden token cannot self-invalidate the count (grep -v '^#'-style filtering).
LARRY_PART8_TARGETS=(
  "agents/larry-extended.md"
  "skills/larry-personality/SKILL.md"
)
# A pre-gate Brain FETCH is the breach the OFFER-not-fetch rule guards against. We
# match an mcp__brain_ tool CALL idiom or a brain-write helper; the words
# "Brain push" / "Brain consult" / "Brain says" prose are NOT a fetch and are
# allowed (they are the OFFER, not the call).
LARRY_BRAIN_FETCH='mcp__brain_[a-z]+\(|fetch[[:space:]]*\(|writeBrain|sendToBrain|ingestToBrain'
for t in "${LARRY_PART8_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ ! -f "$f" ]]; then
    echo "    MISSING Part-8 larry target: $t"; PART8_OK=0; continue
  fi
  # Strip HTML/markdown comment lines so a quoted token cannot self-invalidate.
  LDOC=$(grep -vE '^[[:space:]]*(<!--|#)' "$f")
  if echo "$LDOC" | grep -nE "$LARRY_BRAIN_FETCH" >/dev/null 2>&1; then
    echo "    FORBIDDEN pre-gate Brain fetch added to larry surface: $t (OFFER-not-fetch breach)"; PART8_OK=0
  fi
done

if [[ $PART8_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Part-8 grep sweep: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Part-8 grep sweep"); echo ">>> Part-8 grep sweep: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Wave 8 FROZEN-CONTRACT checks (the constitutional grep-asserts). Three checks,
# each comment-stripped (grep -v '^#'-style for CJS) so a doc-comment naming a
# forbidden token cannot self-invalidate the count -- never a bare unfiltered
# == 0 gate. These are the lightweight grep mirrors of the verdict's instrumented
# proofs (the verdict's B2 deep-equal + B3 negative + B4 layered are the real
# proof; these gate the source even when node is unavailable):
#   (a) B2 -- chain-executor.cjs does NOT MUTATE decide()'s return shape. The
#       loop must read decide().decision_trace and store the REFERENCE; it must
#       never reassign decision.decision_trace or rebuild the decision object.
#       Scan for the forbidden mutation idiom (an assignment INTO decide()'s
#       returned decision: `decision.<known-key> =`).
#   (b) B4 -- the three recipe maps are read each for ONE job and NONE is merged.
#       recipe-maps.cjs must expose postureForCommand + wiringForReach +
#       rankedNextReach as three SEPARATE exports; assert each is present and that
#       no merge idiom (Object.assign over the three loaders) collapses them.
#   (c) B3 -- chain-executor.cjs CODE has NO autonomous-convergence termination
#       branch (the harness "loop until all PASSING" stop is REJECTED; the chain
#       halts on posture per Part 3). Scan the CODE (comments stripped) for the
#       forbidden convergence-stop pattern, mirroring the (a) B2 mutation grep.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Wave-8 frozen-contract checks (B2 no-mutate + B4 layered maps + B3 no-convergence-stop) ---"
FROZEN_OK=1
CHAIN_EXEC="$REPO_ROOT/lib/core/chain-executor.cjs"
RECIPE_MAPS="$REPO_ROOT/lib/core/recipe-maps.cjs"

# (a) B2: no decide()-return mutation. Strip CJS comment lines, then scan the
# CODE for an assignment INTO the decision object's known frozen keys. The loop
# READS decision.decision_trace (a read, `= (decision && decision.decision_trace)`),
# which is NOT a mutation; a mutation would be `decision.decision_trace =` or
# `decision.fire_skill =` (assignment with the key on the LEFT of `=`).
if [[ ! -f "$CHAIN_EXEC" ]]; then
  echo "    MISSING B2 target: lib/core/chain-executor.cjs"; FROZEN_OK=0
else
  CE_CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$CHAIN_EXEC")
  # Forbidden: an assignment statement whose LHS is decision.<known-key>.
  if echo "$CE_CODE" | grep -nE 'decision\.(decision_trace|fire_skill|offer_next_step|suppress_skills|persona_updates)[[:space:]]*=[^=]' >/dev/null 2>&1; then
    echo "    FORBIDDEN B2 breach: chain-executor.cjs MUTATES a decide()-return key (decision.<key> = ...)"; FROZEN_OK=0
  fi
fi

# (b) B4: three layered map authorities, none merged.
if [[ ! -f "$RECIPE_MAPS" ]]; then
  echo "    MISSING B4 target: lib/core/recipe-maps.cjs"; FROZEN_OK=0
else
  for fn in postureForCommand wiringForReach rankedNextReach; do
    if ! grep -qE "function $fn|$fn:" "$RECIPE_MAPS"; then
      echo "    MISSING B4 authority: recipe-maps.cjs does not expose $fn (the three maps must stay layered)"; FROZEN_OK=0
    fi
  done
  RM_CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$RECIPE_MAPS")
  # A merge idiom that collapses the three loaders into one map is the B4 breach.
  if echo "$RM_CODE" | grep -nE 'Object\.assign\([[:space:]]*_(loadConnectors|loadProjection)' >/dev/null 2>&1; then
    echo "    FORBIDDEN B4 breach: recipe-maps.cjs MERGES the map loaders (the three maps must stay layered, not merged)"; FROZEN_OK=0
  fi
fi

# (c) B3: NO autonomous-convergence stop branch in chain-executor.cjs CODE.
if [[ -f "$CHAIN_EXEC" ]]; then
  CE_CODE=$(grep -vE '^[[:space:]]*(//|\*|/\*)' "$CHAIN_EXEC")
  if echo "$CE_CODE" | grep -niE 'all.?passing|all.?green|loop until all|until.*converge|convergence' >/dev/null 2>&1; then
    echo "    FORBIDDEN B3 breach: chain-executor.cjs CODE has an autonomous-convergence stop branch (the chain must halt on posture per Part 3, never on convergence)"; FROZEN_OK=0
  fi
  # Positive proof that the legitimate posture/quality/budget stop conditions are present.
  for stop in gate_halt quality_early_stop budget_brake; do
    if ! grep -q "$stop" "$CHAIN_EXEC"; then
      echo "    MISSING legitimate stop condition '$stop' in chain-executor.cjs (B3: the chain must stop on posture/quality/budget)"; FROZEN_OK=0
    fi
  done
fi

if [[ $FROZEN_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Wave-8 frozen-contract checks: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Wave-8 frozen-contract checks"); echo ">>> Wave-8 frozen-contract checks: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Wave 6 DOC-CONTENT GREP GATE (HIGH-2). commands/ignite.md is markdown with NO
# runtime, so the stubbed .cjs contract test alone can pass while the DOC still
# describes the OLD hand-rolled loop. The .cjs test validates the runChain
# contract; THIS gate proves the DOC actually committed to it. Two assertions:
#   (a) ignite.md NAMES the runtime -- both "chain-executor" AND "runChain" must
#       be present (fail if either is missing).
#   (b) the OLD hand-rolled sequential-loop language is removed/neutralized -- the
#       gate FAILS if surviving prose still describes ignite OWNING the B1->B2->B3
#       walk (the forbidden affirmative phrase co-locating "in sequence" with the
#       three birth gates). Comment lines are filtered (grep -v '^#'-style) so a
#       comment cannot self-invalidate the count; this is NOT a bare unfiltered
#       == 0 gate -- it scans the doc BODY for the specific forbidden phrasing.
# A doc still describing the old loop MUST fail RED here.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Wave-6 doc-content grep gate (ignite.md names runChain + old loop neutralized) ---"
IGNITE_DOC="$REPO_ROOT/commands/ignite.md"
DOC_OK=1
if [[ ! -f "$IGNITE_DOC" ]]; then
  echo "    MISSING doc: commands/ignite.md"; DOC_OK=0
else
  # (a) NAMES the runtime: both tokens must be present.
  if ! grep -q "chain-executor" "$IGNITE_DOC"; then
    echo "    ignite.md does NOT name chain-executor (the runtime the gates ride)"; DOC_OK=0
  fi
  if ! grep -q "runChain" "$IGNITE_DOC"; then
    echo "    ignite.md does NOT name runChain (the shared spine)"; DOC_OK=0
  fi
  # (b) old hand-rolled sequential-loop language removed/neutralized. Strip
  # markdown comment/HTML-comment lines first so a quoted comment cannot
  # self-invalidate the count, then scan the BODY for the FORBIDDEN affirmative
  # phrasing: prose that describes ignite OWNING the B1/B2/B3 walk "in sequence".
  # The negated form on line ~40 ("do NOT run under a hand-rolled in-sequence
  # loop") is intentionally NOT matched -- the gate targets the affirmative claim
  # that ignite orchestrates the three gates in sequence with its own loop.
  DOC_BODY=$(grep -vE '^[[:space:]]*(#|<!--)' "$IGNITE_DOC")
  if echo "$DOC_BODY" | grep -nE "orchestrates three birth gates \(B1, B2, B3\) in sequence" >/dev/null 2>&1; then
    echo "    FORBIDDEN old loop prose: ignite.md still says it orchestrates the three gates in sequence"; DOC_OK=0
  fi
  # Belt-and-suspenders: any surviving line that AFFIRMATIVELY co-locates "three
  # birth gates" + "in sequence" WITHOUT a neutralizing negation (not / NOT / do
  # not / belongs to runChain) is the old hand-rolled loop language and fails.
  OLD_LOOP=$(echo "$DOC_BODY" | grep -nE "three birth gates.*in sequence|in sequence.*three birth gates" | grep -viE "not |belongs to runChain|do NOT|does NOT")
  if [[ -n "$OLD_LOOP" ]]; then
    echo "    FORBIDDEN old loop prose (affirmative in-sequence walk) in ignite.md:"; echo "$OLD_LOOP"; DOC_OK=0
  fi
  # Confirm the load-bearing ordering-guard content string survived (re-anchored
  # on content, not a stale line number).
  if ! grep -q "B3 fires ONLY after birthRoom succeeds" "$IGNITE_DOC"; then
    echo "    MISSING ordering-guard content string 'B3 fires ONLY after birthRoom succeeds'"; DOC_OK=0
  fi
fi

if [[ $DOC_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Wave-6 doc-content grep gate: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Wave-6 doc-content grep gate"); echo ">>> Wave-6 doc-content grep gate: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Wave 7 DOC-CONTENT GREP GATE (HIGH-2 FIX). Both larry surfaces
# (agents/larry-extended.md + skills/larry-personality/SKILL.md) are markdown with
# NO runtime, so the stubbed .cjs contract test alone can pass while the docs still
# describe the OLD suggest-and-wait loop OR silently weaken the safe-halt rule. The
# .cjs test validates the runChain handoff contract; THIS gate proves the DOCS
# committed to it AND kept the safe-halt rule verbatim. Four assertions:
#   (a) BOTH larry docs NAME the runtime -- "chain-executor" AND "runChain" must be
#       present in EACH file (fail if either string is missing from either file).
#   (b) SKILL.md documents the auto-sequence branch (the "auto-sequence" token).
#   (c) the non-autonomous_safe SAFE-HALT rule is preserved VERBATIM -- the
#       GUIDED-default line "ends in a Decision Gate, not a verdict" must still be
#       present byte-intact in SKILL.md (fail if deleted or reworded).
#   (d) the "One reach per beat" rule survives in SKILL.md.
# Comment lines are filtered (grep -v '^#'-style) where a comment could
# self-invalidate the count; this is NOT a bare unfiltered == 0 gate.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: Wave-7 doc-content grep gate (both larry docs name runChain + auto-sequence + safe-halt verbatim) ---"
LARRY_EXTENDED="$REPO_ROOT/agents/larry-extended.md"
LARRY_SKILL="$REPO_ROOT/skills/larry-personality/SKILL.md"
LARRY_DOC_OK=1
if [[ ! -f "$LARRY_EXTENDED" ]]; then
  echo "    MISSING doc: agents/larry-extended.md"; LARRY_DOC_OK=0
fi
if [[ ! -f "$LARRY_SKILL" ]]; then
  echo "    MISSING doc: skills/larry-personality/SKILL.md"; LARRY_DOC_OK=0
fi
if [[ $LARRY_DOC_OK -eq 1 ]]; then
  # (a) BOTH docs NAME the runtime -- chain-executor AND runChain in EACH file.
  for d in "$LARRY_EXTENDED" "$LARRY_SKILL"; do
    if ! grep -q "chain-executor" "$d"; then
      echo "    $(basename "$d") does NOT name chain-executor (the handoff runtime)"; LARRY_DOC_OK=0
    fi
    if ! grep -q "runChain" "$d"; then
      echo "    $(basename "$d") does NOT name runChain (the handoff target)"; LARRY_DOC_OK=0
    fi
  done
  # (b) the auto-sequence branch is documented in SKILL.md.
  if ! grep -q "auto-sequence" "$LARRY_SKILL"; then
    echo "    SKILL.md does NOT document the auto-sequence branch (the 'auto-sequence' token is missing)"; LARRY_DOC_OK=0
  fi
  # (c) the non-autonomous_safe SAFE-HALT rule preserved VERBATIM (D-166-05). The
  # GUIDED-default line must survive byte-intact so the auto-sequence branch can
  # never be read as weakening it.
  if ! grep -q "ends in a Decision Gate, not a verdict" "$LARRY_SKILL"; then
    echo "    MISSING/REWORDED safe-halt rule: SKILL.md no longer carries 'ends in a Decision Gate, not a verdict' verbatim"; LARRY_DOC_OK=0
  fi
  # (d) the "One reach per beat" rule survives in SKILL.md.
  if ! grep -q "One reach per beat" "$LARRY_SKILL"; then
    echo "    MISSING 'One reach per beat' rule in SKILL.md (the GUIDED-default one-reach contract)"; LARRY_DOC_OK=0
  fi
fi

if [[ $LARRY_DOC_OK -eq 1 ]]; then
  ((PASSED++)); echo ">>> Wave-7 doc-content grep gate: PASSED"
else
  ((FAILED++)); FAILED_TESTS+=("Wave-7 doc-content grep gate"); echo ">>> Wave-7 doc-content grep gate: FAILED"
fi
echo ""

# ---------------------------------------------------------------------------
# Em-dash sweep (CLAUDE.md HARD RULE: hyphens only). The forbidden glyph is
# matched via its codepoint escape (U+2014) so this runner itself carries no
# literal em-dash to trip its own sweep.
# ---------------------------------------------------------------------------
((TOTAL++))
echo "--- Running: em-dash sweep (Phase 166 lib files + test suites + runner) ---"
EMDASH=$'\u2014'
EMDASH_OK=1
EMDASH_TARGETS=(
  "lib/mcp/pipeline-state.cjs"
  "lib/core/recipe-maps.cjs"
  "lib/core/chain-executor.cjs"
  "lib/core/chain-retry.cjs"
  "tests/test-pipeline-state-isnext-gate.cjs"
  "tests/test-recipe-maps-authority.cjs"
  "tests/test-chain-executor-loop.cjs"
  "tests/test-chain-executor-gate.cjs"
  "tests/test-chain-retry-backoff.cjs"
  "tests/test-chain-graceful-partial.cjs"
  # Wave 4: the migrated donor + its command doc + the two new act suites.
  "scripts/act-command.cjs"
  "commands/act.md"
  "tests/test-act-prebehavior-snapshot.cjs"
  "tests/test-act-on-runchain.cjs"
  # Wave 5: the migrated pipeline consumer + its command doc + the two new suites.
  "commands/pipeline.md"
  "tests/test-pipeline-state-shipped-behavior.cjs"
  "tests/test-pipeline-on-runchain.cjs"
  # Wave 6: the migrated ignite doc + the new ignite-on-runchain suite.
  "commands/ignite.md"
  "tests/test-ignite-on-runchain.cjs"
  # Wave 7: the two migrated larry surfaces + the new handoff-seam suite.
  "agents/larry-extended.md"
  "skills/larry-personality/SKILL.md"
  "tests/test-larry-handoff-seam.cjs"
  # Wave 8: the adversarial verdict + the Part 8 leak scan (the phase gate suites).
  "tests/test-chain-executor-verdict.cjs"
  "tests/test-chain-executor-part8-leak.cjs"
  "tests/run-all-166.sh"
)
for t in "${EMDASH_TARGETS[@]}"; do
  f="$REPO_ROOT/$t"
  if [[ -f "$f" ]] && grep -q "$EMDASH" "$f"; then
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
echo "  Summary (166 verification)"
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
