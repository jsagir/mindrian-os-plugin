#!/usr/bin/env bash
# Phase 365 (verification rung earned, not asserted: B2 floor, B3 unattended
# constraints) verification aggregator.
#
# WHAT THIS PHASE HAS TO PROVE, in one sentence per V365 group:
#   V365-01 baseline first: the acceptance and falsification tests were written
#     and run before any lib/ edit, and the failing baseline is on record.
#   V365-02..04 the byte, one-week and floor acceptance tests: two claims with
#     identical text differ in a computed filterable standing; a model-checked
#     claim approved at the default floor never reaches confirmed; a below-floor
#     approve lands needs_evidence and the approver saw why first.
#   V365-05..08 the floor is read from ROOM.md (never a number), enforced for
#     claim subjects only, explained by one shared why-line, and audited.
#   V365-09..13 the never-do list is read fresh, written only after an approval,
#     enforced in chain_run and the ambient runner, and grown from what tripped.
#   V365-14..16 standing is shown in words everywhere, two Zone 3 signals fire,
#     and one shared words map names the standing in every renderer.
#   V365-17 the ladder fence: no derived rung, person node, B4 split or
#     migration lands while data/verification-ladder.json says ratified:false.
#   V365-18 guardrails: Part 8 sweep, dash fence, every gate, and the five
#     regression suites no redder than at the phase base.
#
# IMPORTANT: this aggregator is written ONCE, here, in 365-01. NO LATER PLAN in
# this phase edits it. A later plan adds its own tests/test-365-*.cjs file; the
# glob discovery below picks it up with no edit here, and a later plan that
# lands a Part 8 or dash-fence target finds it already listed.
#
# DISCOVERY IS BY GLOB. Every "$TEST_365_PREFIX"*.cjs file (default
# tests/test-365-) is run. A run that discovers nothing FAILS; it never prints
# green. TEST_365_PREFIX exists so that guard, and a narrowed run, are provable
# without editing this file.
#
# RED-LIST RULE (tests/fixtures/365-baseline-red.json, written by 365-02):
#   {"schema":"mos.365-baseline-red/1","base_sha":"<sha>","legs":[{"leg":
#   "tests/test-365-acceptance-byte.cjs","signatures":[{"id":"RED-365-BYTE",
#   "healed_by_plan":"365-04"}]}]}
# A test prints one line per failing sub-check as "RED-365-<NAME>: <detail>";
# the token is RED-365-[A-Z0-9-]+. For a listed leg:
#   exit 0                          -> FAIL  NOW GREEN: remove it from the list
#   non-zero, no RED-365 token      -> FAIL  crash (a red must name itself)
#   a printed token not listed      -> FAIL  NEW RED
#   a listed token not printed      -> FAIL  STALE: remove it from the list
#   printed set equals listed set   -> KNOWN
# An unlisted leg: exit 0 PASSED, exit 77 SKIPPED (ENV GAP), else FAILED. A
# missing list file is an empty list; a malformed one FAILS the run.
#
# REGRESSION RULE (opt-in, RUN_365_REGRESSIONS=1): run-all-354/355/356/358/363
# run SEQUENTIALLY (parallel runs cause timeouts from CPU contention). Each
# suite's failing legs are compared with suites.<name>.failing_legs in
# tests/fixtures/365-regression-base.json, recorded at the phase base. A leg
# failing now that is not in the base set is FAIL "REDDER THAN BASE"; the same
# or a smaller set is PASSED (a peer healing a red is fine).
#
# Counters: PASSED, FAILED, SKIPPED (exit 77 or a listed-but-absent file),
# KNOWN (a recorded pre-existing red whose signature matched). Last line:
# PASSED=<n> FAILED=<n> SKIPPED=<n> KNOWN=<n>. exit 1 when FAILED > 0.
#
# Bash 3.2 compatible: no associative arrays, no mapfile. Hyphens only; the two
# dash characters are searched for only as byte escapes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (the run-all-216 idiom): the offline preload is inherited
# by every spawned leg and every detached eureka child.
export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

PREFIX="${TEST_365_PREFIX:-tests/test-365-}"
PD=".planning/phases/365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt"
RED_FILE="tests/fixtures/365-baseline-red.json"
REG_BASE="tests/fixtures/365-regression-base.json"

PASS=0
FAIL=0
SKIP=0
KNOWN=0

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/run-all-365.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

run() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
  fi
  echo ""
}

# run_known <label> <signature> <cmd...>
# A recorded pre-existing red 365 does not own. Exit 0 -> PASSED ("known red
# healed"). Non-zero whose combined output carries the literal signature ->
# KNOWN. Any other non-zero exit -> FAILED (a new failure mode).
run_known() {
  local label="$1"; local signature="$2"; shift 2
  echo "--- $label ---"
  local out status
  out="$("$@" 2>&1)"
  status=$?
  printf '%s\n' "$out" | tail -n 15
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED (known red healed - drop its known_signature entry)"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  elif printf '%s' "$out" | grep -qF -- "$signature"; then
    echo ">>> $label: KNOWN (pre-existing red, signature matched)"; KNOWN=$((KNOWN+1))
  else
    echo ">>> $label: FAILED (exit $status, recorded signature NOT found: $signature)"; FAIL=$((FAIL+1))
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# RED LIST (read once, into leg|TOKEN lines)
# ---------------------------------------------------------------------------
RED_LIST="$TMP_DIR/red-list.txt"
node -e '
const fs = require("fs");
const f = process.argv[1];
if (!fs.existsSync(f)) process.exit(0);
let j;
try { j = JSON.parse(fs.readFileSync(f, "utf8")); }
catch (e) { console.log("ERR|malformed red list: " + e.message); process.exit(0); }
if (!j || !Array.isArray(j.legs)) { console.log("ERR|malformed red list: no legs array"); process.exit(0); }
for (const l of j.legs) {
  const sigs = Array.isArray(l.signatures) ? l.signatures : [];
  if (sigs.length === 0) console.log(l.leg + "|");
  for (const s of sigs) console.log(l.leg + "|" + s.id);
}
' "$RED_FILE" > "$RED_LIST"
RED_MALFORMED=0
if grep -q '^ERR|' "$RED_LIST"; then
  RED_MALFORMED=1
  echo "!!! $(grep '^ERR|' "$RED_LIST" | head -n 1 | cut -d'|' -f2) ($RED_FILE)"
  FAIL=$((FAIL+1))
  : > "$RED_LIST"
fi

# run_leg <leg path>: apply the red-list rule to one discovered test file.
run_leg() {
  local leg="$1" label out rc listed printed extra missing is_listed
  label="$(basename "$leg")"
  echo "--- $label ---"
  out="$(node "$leg" 2>&1)"; rc=$?
  is_listed="$(awk -F'|' -v l="$leg" '$1==l {c++} END {print c+0}' "$RED_LIST")"
  listed="$(awk -F'|' -v l="$leg" '$1==l && $2!="" {print $2}' "$RED_LIST" | sort -u)"
  if [ "$rc" -eq 0 ]; then
    printf '%s\n' "$out" | tail -n 5
  else
    printf '%s\n' "$out" | tail -n 25
  fi
  if [ "$rc" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  elif [ "$is_listed" -eq 0 ]; then
    if [ "$rc" -eq 0 ]; then
      echo ">>> $label: PASSED"; PASS=$((PASS+1))
    else
      echo ">>> $label: FAILED"; FAIL=$((FAIL+1))
    fi
  elif [ "$rc" -eq 0 ]; then
    echo ">>> $label: FAILED (NOW GREEN: remove $leg from $RED_FILE)"; FAIL=$((FAIL+1))
  else
    printed="$(printf '%s\n' "$out" | grep -oE 'RED-365-[A-Z0-9-]+' | sort -u)"
    if [ -z "$printed" ]; then
      echo ">>> $label: FAILED (crash: exit $rc with no RED-365 token; a listed red must name itself)"; FAIL=$((FAIL+1))
    else
      extra="$(comm -13 <(printf '%s\n' "$listed") <(printf '%s\n' "$printed"))"
      missing="$(comm -23 <(printf '%s\n' "$listed") <(printf '%s\n' "$printed"))"
      if [ -n "$extra" ] || [ -n "$missing" ]; then
        [ -n "$extra" ] && echo "    NEW RED: $(printf '%s' "$extra" | tr '\n' ' ')"
        [ -n "$missing" ] && echo "    STALE: $(printf '%s' "$missing" | tr '\n' ' ') no longer observed, remove from $RED_FILE"
        echo ">>> $label: FAILED (red signature set differs from the list)"; FAIL=$((FAIL+1))
      else
        echo ">>> $label: KNOWN (recorded red, signatures match: $(printf '%s' "$printed" | tr '\n' ' '))"; KNOWN=$((KNOWN+1))
      fi
    fi
  fi
  echo ""
}

# ---------------------------------------------------------------------------
# SECTION 1: DISCOVERY (glob) plus the red-list rule
# ---------------------------------------------------------------------------
DISCOVERED_TEST_FILES=()
shopt -s nullglob
found=0
for t in "$PREFIX"*.cjs; do
  found=$((found+1))
  DISCOVERED_TEST_FILES+=("$t")
  run_leg "$t"
done
shopt -u nullglob

if [ $found -eq 0 ]; then
  echo "!!! no Phase 365 test files discovered (TEST_365_PREFIX=$PREFIX)"
  echo "PASSED=$PASS FAILED=$((FAIL+1)) SKIPPED=$SKIP KNOWN=$KNOWN"
  exit 1
fi
echo "discovered $found test file(s)"
echo ""

# A listed leg whose file does not exist yet reports SKIPPED, never PASSED.
LISTED_LEGS="$(awk -F'|' '{print $1}' "$RED_LIST" | sort -u)"
if [ -n "$LISTED_LEGS" ]; then
  while IFS= read -r l; do
    [ -z "$l" ] && continue
    if [ ! -f "$l" ]; then
      echo "--- red-list entry $l ---"
      echo ">>> red-list entry $l: SKIPPED (listed, not yet created)"; SKIP=$((SKIP+1)); echo ""
    fi
  done <<EOF
$LISTED_LEGS
EOF
fi

# ---------------------------------------------------------------------------
# SECTION 2: PART 8 SOURCE SWEEP (the run-all-363.1 / run-all-270 regex)
# ---------------------------------------------------------------------------
echo "--- 365 Part 8 source sweep ---"
PART8_OK=1
PART8_TARGETS=(
  "lib/core/room-constraints.cjs"
  "lib/core/navigation/verification-floor.cjs"
  "lib/core/navigation/verification-signals.cjs"
  "lib/mcp/never-do-gate.cjs"
  "data/verification-ladder.json"
)
PART8_FORBIDDEN='brain-client|brain_query|pws-brain|fetch\(|https?://|node:https?|curl |wget '
for t in "${PART8_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(grep -v '^\s*\(//\|\*\|/\*\)' "$f" | grep -Ec "$PART8_FORBIDDEN" || true)"
    if [ "$hits" -gt 0 ]; then
      echo "    FORBIDDEN egress token(s) in: $t ($hits match(es))"
      PART8_OK=0
    else
      echo "    clean: $t"
    fi
  else
    echo "    SKIPPED (not yet created, does not fail this leg): $t"
  fi
done
if [ "$PART8_OK" -eq 1 ]; then
  echo ">>> 365 Part 8 source sweep: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 365 Part 8 source sweep: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# SECTION 3: DASH FENCE (U+2014 em-dash, U+2013 en-dash) over every file any
# 365 plan touches. A target that is not present is skipped (listed as such).
# The two characters are searched for as grep -P byte escapes only.
# ---------------------------------------------------------------------------
echo "--- 365 dash fence ---"
DASH_OK=1
DASH_TARGETS=(
  "lib/core/room-constraints.cjs"
  "lib/core/navigation/verification-floor.cjs"
  "lib/core/navigation/verification-signals.cjs"
  "lib/mcp/never-do-gate.cjs"
  "data/verification-ladder.json"
  "lib/core/navigation/verification.cjs"
  "lib/core/navigation/confirm-node.cjs"
  "lib/core/navigation/transitions.cjs"
  "lib/core/navigation/memory-events.cjs"
  "lib/core/navigation.cjs"
  "lib/core/frontmatter-schemas.cjs"
  "lib/core/navigation/room-home.cjs"
  "lib/core/navigation/graph-export.cjs"
  "lib/core/navigation/insights.cjs"
  "lib/core/navigation/research-preflight.cjs"
  "lib/core/proactive-intelligence.cjs"
  "lib/core/chain-executor.cjs"
  "lib/core/eureka/explore-chain.cjs"
  "lib/core/research-planner/ambient.cjs"
  "lib/mcp/gate-render.cjs"
  "lib/mcp/tools/gate.cjs"
  "lib/mcp/tools/chain.cjs"
  "lib/mcp/tools/research.cjs"
  "lib/mcp/tools/claim-verify.cjs"
  "lib/mcp/tool-router.cjs"
  "scripts/mos-status.cjs"
  "scripts/research-planner.cjs"
  "scripts/generate-presentation.cjs"
  "lib/graph/graph-detail-panel.js"
  "commands/status.md"
  "commands/research.md"
  "data/floor-ledger.json"
  "tests/run-all-365.sh"
)
shopt -s nullglob
for t in tests/test-365-*.cjs tests/helpers/*-365*.cjs tests/fixtures/365-*.json "$PD"/*; do
  DASH_TARGETS+=("$t")
done
shopt -u nullglob
for t in "${DASH_TARGETS[@]}"; do
  f="$ROOT/$t"
  if [ -f "$f" ]; then
    hits="$(LC_ALL=C.UTF-8 grep -cP '\x{2014}|\x{2013}' "$f" 2>/dev/null)"; rc=$?
    if [ "$rc" -ge 2 ]; then
      echo "    SCAN BROKE (grep -P unavailable or errored, rc=$rc) on: $t"
      DASH_OK=0
    elif [ "${hits:-0}" -gt 0 ]; then
      echo "    FORBIDDEN dash ($hits line(s)) in: $t"
      DASH_OK=0
    fi
  else
    echo "    SKIPPED (not present): $t"
  fi
done
if [ "$DASH_OK" -eq 1 ]; then
  echo ">>> 365 dash fence: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 365 dash fence: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# ---------------------------------------------------------------------------
# SECTION 4 and 5: neighbor legs and gates (always run). A leg that was red at
# the phase base is wrapped by run_known with its recorded first failing line;
# the signatures are in known_signature() below (empty = green at base).
# ---------------------------------------------------------------------------
known_signature() {
  case "$1" in
    # Measured at PLAN_BASE 748532076 (365-01, 2026-10-01); see 365-01-SUMMARY.md.
    # test-238: the one-ledger count sees two memory_events where it expects one
    tests/test-238-chosen-validation.cjs)
      echo 'expected memory_event count to increase by exactly 1 (before=0, after=2)' ;;
    # test-237: the mutation leg cannot find its dispatcher-call needle (harness pin drifted)
    tests/test-237-approve-executes.cjs)
      echo '7: MUTATION -- could not build the mutated copy (dispatcher-call needle not found' ;;
    # test-345: the strategy-ratification MCP round-trip leg fails at its final assert
    tests/test-345-gate-ratify.cjs)
      echo 'FAIL: test-345-gate-ratify' ;;
    # test-267: research_run membership (b) and the fork359 zod importer (d) are red, (a) passes
    tests/test-267-mcpv2-zod4-contract.cjs)
      echo 'tool:research_run:membership' ;;
    # test-198 contract schema: contract_version does not register on the fake server
    tests/test-198-contract-schema.test.cjs)
      echo 'AssertionError [ERR_ASSERTION]: contract_version registers (flag off)' ;;
    *) echo "" ;;
  esac
}

NEIGHBOR_TESTS=(
  tests/test-198-gate-renderers.test.cjs
  tests/test-198-chain-run-halt.test.cjs
  tests/test-238-chosen-validation.cjs
  tests/test-238-one-ledger.cjs
  tests/test-237-approve-executes.cjs
  tests/test-265-gate-render-elicit-schema.cjs
  tests/test-345-gate-ratify.cjs
  tests/test-347-resume-nonlinear.cjs
  tests/test-354-gate-subject-promotion.cjs
  tests/test-276-meeting-gate-wiring.cjs
  tests/test-354-concurrency-surfaces.cjs
  tests/test-i2x-t2-node-write-back.cjs
  tests/test-355-gate-opportunity-promotion.cjs
  tests/test-358-b1-core.cjs
  tests/test-358-b1-portrait.cjs
  tests/test-358-b1-cli.cjs
  tests/test-b1-verification.cjs
  tests/test-348-proposed-not-supersedable.cjs
  tests/test-348-agent-supersede-refused.cjs
  tests/test-363-ambient.cjs
  tests/test-363-mcp-tool.cjs
  tests/test-232-room-home.cjs
  tests/test-graph-export.cjs
  tests/test-graph-export-part8-leak.cjs
  tests/test-graph-export-golden-room.cjs
  tests/test-navigation-insights.cjs
  tests/test-navigation-memory-events.cjs
  tests/test-267-mcpv2-zod4-contract.cjs
  tests/test-276-theo-description-parity.cjs
  tests/test-270-tool-schema-budget.cjs
  tests/test-234-tool-description-floor.cjs
  tests/test-265-mcp-description-hygiene.cjs
  tests/test-198-contract-schema.test.cjs
)
for t in "${NEIGHBOR_TESTS[@]}"; do
  label="365: neighbor $(basename "$t")"
  if [ ! -f "$t" ]; then
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $t)"; SKIP=$((SKIP+1)); echo ""
    continue
  fi
  sig="$(known_signature "$t")"
  if [ -n "$sig" ]; then run_known "$label" "$sig" node "$t"; else run "$label" node "$t"; fi
done

GATE_COMMANDS=(
  "scripts/build-connector-registry.cjs --check"
  "scripts/build-command-registry.cjs --check"
  "scripts/build-skill-mirrors.cjs --check"
  "scripts/build-orchestration-projection.cjs --check"
  "scripts/check-render-coverage.cjs"
  "scripts/check-shape-declaration.cjs --check"
  "scripts/check-floor-ledger.cjs --check"
  "scripts/check-tool-honesty.cjs --check"
)
for g in "${GATE_COMMANDS[@]}"; do
  label="365: gate ${g%% *}"
  label="${label/scripts\//}"
  # shellcheck disable=SC2086
  sig="$(known_signature "$g")"
  if [ -n "$sig" ]; then run_known "$label" "$sig" node $g; else run "$label" node $g; fi
done

# CIRS plan-declaration leg over every 365 plan file.
CIRS_PLANS=()
shopt -s nullglob
for f in "$PD"/365-*-PLAN.md; do CIRS_PLANS+=("$f"); done
shopt -u nullglob
if [ "${#CIRS_PLANS[@]}" -eq 0 ]; then
  echo "--- 365: CIRS plan-declaration check ---"
  echo ">>> 365: CIRS plan-declaration check: SKIPPED (no $PD/365-*-PLAN.md found)"
  SKIP=$((SKIP+1)); echo ""
else
  run "365: CIRS plan-declaration check" node scripts/check-cirs-declaration.cjs --check "${CIRS_PLANS[@]}"
fi

# ---------------------------------------------------------------------------
# SECTION 6: REGRESSION BLOCK (opt-in): RUN_365_REGRESSIONS=1
# ---------------------------------------------------------------------------
# base_legs <suite> prints suites.<suite>.failing_legs from the recorded base.
base_legs() {
  node -e '
const fs = require("fs");
const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const s = (j.suites || {})[process.argv[2]];
if (!s) { console.log("ERR|no base record for " + process.argv[2]); process.exit(0); }
for (const l of (s.failing_legs || [])) console.log(l);
' "$REG_BASE" "$1"
}

base_exit() {
  node -e '
const fs = require("fs");
const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const s = (j.suites || {})[process.argv[2]] || {};
console.log(String(s.exit === undefined ? 0 : s.exit));
' "$REG_BASE" "$1"
}

# failing_legs_of <output file>: the "FAILED" leg lines, counts and trailing
# detail stripped, so a leg compares by its label only.
failing_legs_of() {
  grep -E '^>>> .*: FAILED' "$1" | sed -e 's/^>>> //' -e 's/: FAILED.*$//' | sort -u
}

regress_suite() {
  local name="$1" out rc cur base bad leg base_rc
  out="$TMP_DIR/reg-$name.out"; cur="$TMP_DIR/reg-$name.cur"; base="$TMP_DIR/reg-$name.base"
  echo "--- regression run-all-$name ---"
  bash "tests/run-all-$name.sh" > "$out" 2>&1; rc=$?
  failing_legs_of "$out" > "$cur"
  base_legs "$name" | sort -u > "$base"
  if grep -q '^ERR|' "$base"; then
    echo "    $(grep '^ERR|' "$base" | cut -d'|' -f2)"
    echo ">>> regression run-all-$name: FAILED (no base record)"; FAIL=$((FAIL+1)); echo ""; return
  fi
  echo "    rc=$rc, failing legs now: $(wc -l < "$cur" | tr -d ' '), at base: $(wc -l < "$base" | tr -d ' ')"
  bad=0
  while IFS= read -r leg; do
    [ -z "$leg" ] && continue
    if ! grep -qxF -- "$leg" "$base"; then
      echo "    REDDER THAN BASE: run-all-$name: $leg"
      bad=1
    fi
  done < "$cur"
  # A non-zero exit that names no failing leg is a failure mode the base did not
  # have, unless the base itself exited non-zero with no failing leg either.
  if [ "$rc" -ne 0 ] && [ ! -s "$cur" ]; then
    base_rc="$(base_exit "$name")"
    if [ "$base_rc" = "0" ] || [ -s "$base" ]; then
      echo "    REDDER THAN BASE: run-all-$name exited rc=$rc with no failing leg label"
      bad=1
    fi
  fi
  if [ "$bad" -eq 0 ]; then
    echo ">>> regression run-all-$name: PASSED"; PASS=$((PASS+1))
  else
    echo ">>> regression run-all-$name: FAILED"; FAIL=$((FAIL+1))
  fi
  echo ""
}

if [ "${RUN_365_REGRESSIONS:-0}" = "1" ]; then
  for s in 354 355 356 358 363; do
    regress_suite "$s"
  done
else
  echo "--- 365 regression block ---"
  echo ">>> 365 regression block: SKIPPED (RUN_365_REGRESSIONS unset)"; SKIP=$((SKIP+1)); echo ""
fi

echo "======================================"
echo "Phase 365: PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
echo "======================================"
echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
