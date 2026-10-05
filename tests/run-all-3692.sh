#!/usr/bin/env bash
# Phase 369.2 (Research Searches Online, For Real) verification aggregator.
#
# Modeled on tests/run-all-363.sh (the run / run_if / run_known shape, the guarded
# per-planned-test-file idiom, the dash guard, the CIRS leg, the no-new-dependency leg).
#
# IMPORTANT: this aggregator is written ONCE, here, in 369.2-03 (Wave 0). Later plans add their
# own test files (tests/test-3692-*.cjs); the run_if legs below already name every one of them,
# so a landed file is picked up automatically and a missing planned file reports SKIPPED, never
# PASSED. No later plan edits this file except plan 34, which only removes a run_known wrapper
# that a phase plan healed.
#
# Counters:
#   PASSED  - the leg exited 0
#   FAILED  - the leg exited non-zero (not 77), or a run_known leg failed with an output that
#             does NOT carry its recorded signature
#   SKIPPED - exit 77 (ENV GAP) or a missing planned file; never PASSED
#   KNOWN   - a run_known leg failed with its recorded pre-existing signature; never PASSED,
#             never FAILED
#
# exit 0  -> FAILED=0
# exit 1  -> FAILED > 0
#
# House rule: hyphens only; the two dash characters are searched for below only as printf byte
# escapes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
KNOWN=0

PD=".planning/phases/369.2-research-searches-online-for-real"
FIXTURE="tests/fixtures/363-pre-phase.json"

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

run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# run_known <label> <signature> <cmd...>
# A pre-existing red this phase does not own. Exit 0 -> PASSED ("known red healed").
# Non-zero exit whose combined output contains the literal signature -> KNOWN.
# Any other non-zero exit -> FAILED (a new failure mode, investigate).
run_known() {
  local label="$1"; local signature="$2"; shift 2
  echo "--- $label ---"
  local out
  out="$("$@" 2>&1)"
  local status=$?
  printf '%s\n' "$out" | tail -n 15
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED (known red healed - drop the run_known wrapper at phase close)"; PASS=$((PASS+1))
  elif printf '%s' "$out" | grep -qF -- "$signature"; then
    echo ">>> $label: KNOWN (pre-existing red, signature matched)"; KNOWN=$((KNOWN+1))
  else
    echo ">>> $label: FAILED (exit $status, recorded signature NOT found: $signature)"; FAIL=$((FAIL+1))
  fi
  echo ""
}

# --- 1. Guarded legs, one run_if per planned test file (the label names the plan that lands it) -
run_if "3692: Theo verdict, the egress guard speaks to Theo (369.2-01)"          tests/test-3692-theo-verdict.cjs      node tests/test-3692-theo-verdict.cjs
run_if "3692: web lines go out free, the real-corpus seam (369.2-02)"           tests/test-3692-web-lines.cjs         node tests/test-3692-web-lines.cjs
run_if "3692: W1 closure bar, the beta.61 real-room run (369.2-03)"             tests/test-3692-w1-closure.cjs        node tests/test-3692-w1-closure.cjs
run_if "3692: perspective plans reach the web (369.2-04)"                       tests/test-3692-perspectives-web.cjs  node tests/test-3692-perspectives-web.cjs
run_if "3692: grant card lists every exact string (369.2-09)"                   tests/test-3692-grant-card.cjs        node tests/test-3692-grant-card.cjs
run_if "3692: search ledger (369.2-13)"                                         tests/test-3692-ledger.cjs            node tests/test-3692-ledger.cjs
run_if "3692: ledger wiring (369.2-14)"                                         tests/test-3692-ledger-wiring.cjs     node tests/test-3692-ledger-wiring.cjs
run_if "3692: counterevidence budget (369.2-15)"                                tests/test-3692-ce-budget.cjs         node tests/test-3692-ce-budget.cjs
run_if "3692: wording (369.2-16)"                                               tests/test-3692-wording.cjs           node tests/test-3692-wording.cjs
run_if "3692: routing (369.2-17)"                                               tests/test-3692-routing.cjs           node tests/test-3692-routing.cjs
run_if "3692: recovery (369.2-20)"                                              tests/test-3692-recovery.cjs          node tests/test-3692-recovery.cjs
run_if "3692: thin answers (369.2-18)"                                          tests/test-3692-thin.cjs              node tests/test-3692-thin.cjs
run_if "3692: roll-up (369.2-18)"                                               tests/test-3692-rollup.cjs            node tests/test-3692-rollup.cjs
run_if "3692: query kinds (369.2-21)"                                           tests/test-3692-query-kinds.cjs       node tests/test-3692-query-kinds.cjs
run_if "3692: quick cap (369.2-22)"                                             tests/test-3692-quick-cap.cjs         node tests/test-3692-quick-cap.cjs
run_if "3692: baseline (369.2-23)"                                              tests/test-3692-baseline.cjs          node tests/test-3692-baseline.cjs
run_if "3692: providers (369.2-25)"                                             tests/test-3692-providers.cjs         node tests/test-3692-providers.cjs
run_if "3692: readiness (369.2-27)"                                             tests/test-3692-readiness.cjs         node tests/test-3692-readiness.cjs
run_if "3692: judge line (369.2-27)"                                            tests/test-3692-judge-line.cjs        node tests/test-3692-judge-line.cjs
run_if "3692: analogies (369.2-28)"                                             tests/test-3692-analogies.cjs         node tests/test-3692-analogies.cjs
run_if "3692: the four commands (369.2-29)"                                     tests/test-3692-four-commands.cjs     node tests/test-3692-four-commands.cjs
run_if "3692: seed118 room (369.2-31)"                                          tests/test-3692-seed118-room.cjs      node tests/test-3692-seed118-room.cjs
run_if "3692: phase closure (369.2-32)"                                         tests/test-3692-closure.cjs           node tests/test-3692-closure.cjs

# --- 2. Suites wave W1 moves (they must be green once W1 closes) ----------------------------------
run "3692: part8-egress-guard self-test"          node lib/core/part8-egress-guard.test.cjs
run "3692: 200 brain projection"                  node tests/test-200-brain-projection.cjs
run "3692: part8-egress-guard hook"               node tests/part8-egress-guard-hook.test.cjs
run "3692: 245 egress contentless"                node tests/test-245-egress-contentless.cjs
run "3692: 246 census guard"                      node tests/test-246-census-guard.cjs
run "3692: 260906 FDA known-tool shapes"          node tests/test-260906-fda-known-tool-shapes.cjs
run "3692: 260917 DGF part8 hook disposition"     node tests/test-260917-dgf-part8-hook-disposition.cjs
run "3692: 245 brain envelope shape"              node tests/test-245-brain-envelope-shape.cjs
run "3692: 354 egress typed question"             node tests/test-354-egress-typed-question.cjs
run "3692: 239 query egress canary"               node tests/test-239-query-egress-canary.cjs
run "3692: 257 shim honest refusal"               node tests/test-257-shim-honest-refusal.cjs
run "3692: 254 ambiguous disclosure"              node tests/test-254-ambiguous-disclosure.cjs
run "3692: 130.5 corpus migration"                node tests/test-130.5-corpus-migration.cjs
run "3692: 221 envelopes"                         node tests/test-221-envelopes.cjs
run "3692: research-corpus"                       node lib/core/research-corpus.test.cjs
run "3692: rs-fetcher academic"                   node lib/memory/test-rs-fetcher-academic.cjs
run "3692: rs-fetcher patents"                    node lib/memory/test-rs-fetcher-patents.cjs
run "3692: 363 corpus honesty"                    node tests/test-363-corpus-honesty.cjs
run "3692: 220 part8 egress"                      node tests/test-220-part8-egress.cjs
run "3692: 214 online fence"                      node tests/test-214-online-fence.cjs
run "3692: 363 families"                          node tests/test-363-families.cjs
run "3692: 366 egress policy"                     node tests/test-366-egress-policy.cjs
run "3692: 363 CLI"                               node tests/test-363-cli.cjs
run "3692: 366 MCP plan only"                     node tests/test-366-mcp-plan-only.cjs
run "3692: 363 grants"                            node tests/test-363-grants.cjs
run "3692: seed104 grant family loop"             node tests/test-seed104-grant-family-loop.cjs
run "3692: 363 run quick"                         node tests/test-363-run-quick.cjs
run "3692: 365 never-do ambient"                  node tests/test-365-never-do-ambient.cjs
run "3692: 363 acceptance whitespace"             node tests/test-363-acceptance-whitespace.cjs
run "3692: 363 part8 sweep"                       node tests/test-363-part8-sweep.cjs
run "3692: 363 ambient"                           node tests/test-363-ambient.cjs
run "3692: 363 MCP tool"                          node tests/test-363-mcp-tool.cjs
run "3692: 366 Theo lateral lane"                 node tests/test-366-theo-lateral-lane.cjs
run "3692: mux card before answer"                node tests/test-mux-card-before-answer.cjs
run "3692: 366 guard navigator release"           node tests/test-366-guard-navigator-release.cjs
run "3692: 369 hook require graph"                node tests/test-369-hook-require-graph.cjs

# --- 3. Pre-existing reds this phase does not own (signatures measured on HEAD in 369.2-03) -------
run_known "3692: known red 257 brain tool egress invariant (plan 08 investigates)" \
  'brain_query: a blocked call must open no socket at all' \
  node tests/test-257-brain-tool-egress-invariant.cjs
run_known "3692: known red rs-fetcher industry (Tavily orchestration)" \
  'FAIL  Test 1: happy path Tavily orchestration' \
  node lib/memory/test-rs-fetcher-industry.cjs
run_known "3692: known red muy real-room rule (CHANGELOG names the rule)" \
  'G10b' \
  node tests/test-muy-real-room-rule.cjs

# --- 4. Gates (plain run) -------------------------------------------------------------------------
run "3692: skill-mirrors generator --check"             node scripts/build-skill-mirrors.cjs --check
run "3692: connector-registry generator --check"        node scripts/build-connector-registry.cjs --check
run "3692: orchestration-projection generator --check"  node scripts/build-orchestration-projection.cjs --check
run "3692: render-coverage check"                       node scripts/check-render-coverage.cjs
run "3692: shape-declaration check"                     node scripts/check-shape-declaration.cjs --check

# --- 5. CIRS plan-declaration leg (over every 369.2 plan file) ------------------------------------
CIRS_PLANS=()
while IFS= read -r -d '' f; do
  CIRS_PLANS+=("$f")
done < <(find "$PD" -maxdepth 1 -name '369.2-*-PLAN.md' -print0 2>/dev/null | sort -z)
if [ "${#CIRS_PLANS[@]}" -eq 0 ]; then
  echo "--- 3692: CIRS plan-declaration check ---"
  echo ">>> 3692: CIRS plan-declaration check: SKIPPED (no $PD/369.2-*-PLAN.md found)"
  SKIP=$((SKIP+1))
  echo ""
else
  run "3692: CIRS plan-declaration check" node scripts/check-cirs-declaration.cjs --check "${CIRS_PLANS[@]}"
fi

# --- 6. No-new-dependency leg (the 363 leg, rebased onto this phase's own start) --------------------
# The 363 fixture (tests/fixtures/363-pre-phase.json) is stale for this phase: package.json moved on
# in Phase 369 (UI and MCP SDK dependencies), so comparing to it is red on a clean HEAD. The baseline
# here is the dependency set at the parent of the first 369.2 code commit (a git object, so it cannot
# drift); the leg fails only when package.json or npm-shrinkwrap.json gained or lost a dependency
# since the phase began.
run "3692: no new dependency (package.json + npm-shrinkwrap.json vs the phase start)" node -e '
  const cp = require("child_process");
  const t = require("./tests/test-363-baseline.cjs");
  const first = cp.spawnSync("git", ["log", "--reverse", "--format=%H", "-E", "--grep=^(test|feat|fix|refactor|chore|perf)\\(369\\.2-"], { encoding: "utf8" }).stdout.trim().split("\n")[0];
  const base = first ? cp.spawnSync("git", ["rev-parse", first + "^"], { encoding: "utf8" }).stdout.trim() : "HEAD";
  const got = t.sortKeys(t.depsInWorkingTree());
  const want = t.sortKeys(t.depsAt(base));
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    const added = got.package_json.filter((d) => !want.package_json.includes(d));
    const removed = want.package_json.filter((d) => !got.package_json.includes(d));
    console.log("FAIL: dependency set changed since " + base.slice(0, 9) + "; added=" + JSON.stringify(added) + " removed=" + JSON.stringify(removed) +
      " shrinkwrap " + want.shrinkwrap_packages_count + " -> " + got.shrinkwrap_packages_count);
    process.exit(1);
  }
  console.log("PASS: dependency sets equal the phase start " + base.slice(0, 9) + " (" + got.package_json.length + " package.json deps, " +
    got.shrinkwrap_packages_count + " shrinkwrap packages)");
'

# --- 7. Dash guard (always) -----------------------------------------------------------------------
# Named 369.2 surfaces plus globs; a missing path is skipped silently (not counted). Both the
# em-dash and the en-dash are searched for, as printf byte escapes only.

echo "--- 3692: dash guard ---"
DASH_HIT=0
EM="$(printf '\xe2\x80\x94')"
EN="$(printf '\xe2\x80\x93')"
DASH_FILES=(
  "tests/run-all-3692.sh"
  "lib/core/part8-room-lexicon.cjs"
  "lib/core/research-planner/operations.cjs"
)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find tests -maxdepth 1 -name 'test-3692-*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find tests/helpers -maxdepth 1 -name '*-3692.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find tests/fixtures -name '3692-*' -type f -print0 2>/dev/null)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find tests/fixtures -path '*/3692-*/*' -type f -print0 2>/dev/null)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find tests/fixtures/release-room-seed118 -type f -print0 2>/dev/null)
# The phase dir, minus two things that carry dashes from outside this phase's authorship (measured
# in 369.2-03, listed in its SUMMARY for the planner): fixtures/phase0 is verbatim captured tool
# output (evidence, never rewritten), and 369.2-VALIDATION.md is the GSD-generated template.
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find "$PD" -type f -not -path "$PD/fixtures/phase0/*" -not -name '369.2-VALIDATION.md' -print0 2>/dev/null)
for f in "${DASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lqF -e "$EM" -e "$EN" "$f" 2>/dev/null; then
    echo "em-dash or en-dash found in $f"
    DASH_HIT=1
  fi
done
if [ "$DASH_HIT" -eq 0 ]; then
  echo ">>> 3692: dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 3692: dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary --------------------------------------------------------------------------------------

echo "Phase 369.2: PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
exit $(( FAIL > 0 ? 1 : 0 ))
