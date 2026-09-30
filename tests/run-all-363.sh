#!/usr/bin/env bash
# Phase 363 (Deep Research Planner - quick and deep research runs)
# verification aggregator.
#
# Modeled on tests/run-all-361.sh (the run/run_if/counter shape, the guarded
# per-planned-test-file idiom, the targeted em-dash guard, the CIRS leg), plus
# a third helper, run_known, for pre-existing reds 363 does not own.
#
# IMPORTANT: this aggregator is written ONCE, here, in 363-01. NO LATER PLAN
# in this phase edits it. A later plan adds its own test file
# (tests/test-363-*.cjs); the run_if legs below pick up a landed file
# automatically because each leg already names its guard file. A missing
# planned test file reports SKIPPED, never PASSED.
#
# Counters:
#   PASSED  - the leg exited 0
#   FAILED  - the leg exited non-zero (not 77), or a run_known leg failed with
#             an output that does NOT carry its recorded signature
#   SKIPPED - exit 77 (ENV GAP) or a missing planned file; never PASSED
#   KNOWN   - a run_known leg failed with its recorded pre-existing signature;
#             never PASSED, never FAILED
#
# exit 0  -> FAILED=0
# exit 1  -> FAILED > 0
#
# House rule: hyphens only; the two dash characters are searched for below
# only as printf byte escapes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
KNOWN=0

PD=".planning/phases/363-deep-research-planner-quick-and-deep-runs"
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
# A pre-existing red 363 does not own. Exit 0 -> PASSED ("known red healed").
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

# --- Guarded legs, one run_if per planned test file, wave order --------------
run_if "363: pre-phase baseline (363-01)"                  tests/test-363-baseline.cjs              node tests/test-363-baseline.cjs
run_if "363: fixture room + OpenAlex replay helpers (363-02)" tests/test-363-helpers.cjs           node tests/test-363-helpers.cjs
run_if "363: corpus honesty, D-16 (363-03)"                tests/test-363-corpus-honesty.cjs        node tests/test-363-corpus-honesty.cjs
run_if "363: cache counts and versioning, D-16 (363-04)"   tests/test-363-cache.cjs                 node tests/test-363-cache.cjs
run_if "363: plan schema (363-05)"                         tests/test-363-plan-schema.cjs           node tests/test-363-plan-schema.cjs
run_if "363: Minto pyramid, D-08 (363-06)"                 tests/test-363-pyramid.cjs               node tests/test-363-pyramid.cjs
run_if "363: research perspective, D-18 (363-07)"          tests/test-363-perspective.cjs           node tests/test-363-perspective.cjs
run_if "363: query families (363-08)"                      tests/test-363-families.cjs              node tests/test-363-families.cjs
run_if "363: research grants, D-04 (363-09)"               tests/test-363-grants.cjs                node tests/test-363-grants.cjs
run_if "363: audit ledger, D-04 (363-09)"                  tests/test-363-audit-ledger.cjs          node tests/test-363-audit-ledger.cjs
run_if "363: research structure, D-09/D-17 (363-10)"       tests/test-363-structure.cjs             node tests/test-363-structure.cjs
run_if "363: research-shape ledger --check (363-10)"       scripts/build-research-shape-ledger.cjs  node scripts/build-research-shape-ledger.cjs --check
run_if "363: evidence rows (363-11)"                       tests/test-363-evidence-rows.cjs         node tests/test-363-evidence-rows.cjs
run_if "363: quick run (363-12)"                           tests/test-363-run-quick.cjs             node tests/test-363-run-quick.cjs
run_if "363: deep run (363-13)"                            tests/test-363-run-deep.cjs              node tests/test-363-run-deep.cjs
run_if "363: filing, D-07/D-13 (363-14)"                   tests/test-363-filing.cjs                node tests/test-363-filing.cjs
run_if "363: CLI (363-15)"                                 tests/test-363-cli.cjs                   node tests/test-363-cli.cjs
run_if "363: ambient quick runs, D-05 (363-16)"            tests/test-363-ambient.cjs               node tests/test-363-ambient.cjs
run_if "363: research_run MCP tool, D-14 (363-17)"         tests/test-363-mcp-tool.cjs              node tests/test-363-mcp-tool.cjs
run_if "363: runner contract (363-18)"                     tests/test-363-runner-contract.cjs       node tests/test-363-runner-contract.cjs
run_if "363: command contract (363-19)"                    tests/test-363-command-contract.cjs      node tests/test-363-command-contract.cjs
run_if "363: acceptance whitespace, D-06 (363-20)"         tests/test-363-acceptance-whitespace.cjs node tests/test-363-acceptance-whitespace.cjs
run_if "363: acceptance diffusion, D-19 (363-20)"          tests/test-363-acceptance-diffusion.cjs  node tests/test-363-acceptance-diffusion.cjs
run_if "363: Part 8 sweep (363-20)"                        tests/test-363-part8-sweep.cjs           node tests/test-363-part8-sweep.cjs

# Live smoke: only when MOS_363_LIVE=1 (spends a small metered budget).
if [ "${MOS_363_LIVE:-}" = "1" ]; then
  run_if "363: live OpenAlex smoke (363-20)" tests/test-363-live-smoke.cjs node tests/test-363-live-smoke.cjs
else
  echo "--- 363: live OpenAlex smoke (363-20) ---"
  echo ">>> 363: live OpenAlex smoke (363-20): SKIPPED (MOS_363_LIVE unset)"; SKIP=$((SKIP+1)); echo ""
fi

# --- Existing suites (research spine and neighbors 363 must keep green) -------
run "363: existing run-all-130.5"                  bash tests/run-all-130.5.sh
run_known "363: existing run-all-131 (red at PLAN_BASE: e2e + substrate, outside 363)" \
  "Failed:  2" \
  bash tests/run-all-131.sh
run_known "363: existing run-all-219 (one red leg: T-218-VD-5 encoder_unavailable, outside 363)" \
  "Phase 219: PASS=12 FAIL=1 SKIP=0" \
  bash tests/run-all-219.sh
run_known "363: existing run-all-221 (red at PLAN_BASE, outside 363)" \
  "Phase 221: PASS=11 FAIL=3 SKIP=0" \
  bash tests/run-all-221.sh
run_known "363: existing run-all-164 (red at PLAN_BASE: canon-version assertion, outside 363)" \
  "    - canon-version assertion" \
  bash tests/run-all-164.sh
run_known "363: existing run-all-3551 (red at PLAN_BASE, outside 363)" \
  "Phase 355.1: PASS=63 FAIL=5 SKIP=0" \
  bash tests/run-all-3551.sh
run_known "363: existing run-all-361 (its 3 known reds, outside 363)" \
  "PASSED=26 FAILED=3 SKIPPED=0" \
  bash tests/run-all-361.sh
run "363: existing 221 envelopes"                  node tests/test-221-envelopes.cjs
run "363: existing 270 tool schema budget"         node tests/test-270-tool-schema-budget.cjs
run "363: existing 234 tool description floor"     node tests/test-234-tool-description-floor.cjs
run "363: existing 265 swarm task grant"           node tests/test-265-swarm-task-grant.cjs
run "363: existing 265 declaration truth"          node tests/test-265-declaration-truth.cjs

# --- Gates (plain run) --------------------------------------------------------
run "363: skill-mirrors generator --check"         node scripts/build-skill-mirrors.cjs --check
run "363: command-registry generator --check"      node scripts/build-command-registry.cjs --check
run "363: connector-registry generator --check"    node scripts/build-connector-registry.cjs --check
run "363: orchestration-projection generator --check" node scripts/build-orchestration-projection.cjs --check
run "363: harness-manifest generator --check"      node scripts/build-harness-manifest.cjs --check
run "363: render-coverage check"                   node scripts/check-render-coverage.cjs
run "363: layer-declaration check"                 node scripts/check-layer-declaration.cjs
run "363: shape-declaration check"                 node scripts/check-shape-declaration.cjs --check
run "363: floor-ledger check"                      node scripts/check-floor-ledger.cjs --check

# --- CIRS plan-declaration leg (over every 363 plan file) --------------------
CIRS_PLANS=()
while IFS= read -r -d '' f; do
  CIRS_PLANS+=("$f")
done < <(find "$PD" -maxdepth 1 -name '363-*-PLAN.md' -print0 2>/dev/null | sort -z)
if [ "${#CIRS_PLANS[@]}" -eq 0 ]; then
  echo "--- 363: CIRS plan-declaration check ---"
  echo ">>> 363: CIRS plan-declaration check: SKIPPED (no $PD/363-*-PLAN.md found)"
  SKIP=$((SKIP+1))
  echo ""
else
  run "363: CIRS plan-declaration check" node scripts/check-cirs-declaration.cjs --check "${CIRS_PLANS[@]}"
fi

# --- Pre-existing reds 363 does not own (signatures confirmed in 363-01) -----
run_known "363: known red FDA known-tool-shapes" \
  'shipped brain_ask methodology question (unproven free-form tokens): expected verdict "ambiguous"' \
  node tests/test-260906-fda-known-tool-shapes.cjs
run_known "363: known red part8-egress-guard self-test" \
  'PB8-03: generic framework question must ALLOW' \
  node lib/core/part8-egress-guard.test.cjs
run_known "363: known red 209 declared-implies-wired" \
  'if this list changed: either a surface was fixed' \
  node tests/test-209-declared-implies-wired.cjs
run_known "363: known red 198 contract schema (red at PLAN_BASE, outside 363)" \
  'AssertionError [ERR_ASSERTION]: contract_version registers (flag off)' \
  node tests/test-198-contract-schema.test.cjs

# --- No-new-dependency leg (D-01, DRP363-18) ----------------------------------
run "363: no new dependency (package.json + npm-shrinkwrap.json vs fixture)" node -e '
  const t = require("./tests/test-363-baseline.cjs");
  const fx = t.loadFixture();
  const got = t.sortKeys(t.depsInWorkingTree());
  const want = t.sortKeys(fx.deps);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    const added = got.package_json.filter((d) => !want.package_json.includes(d));
    const removed = want.package_json.filter((d) => !got.package_json.includes(d));
    console.log("FAIL: dependency set changed; added=" + JSON.stringify(added) + " removed=" + JSON.stringify(removed) +
      " shrinkwrap " + want.shrinkwrap_packages_count + " -> " + got.shrinkwrap_packages_count);
    process.exit(1);
  }
  console.log("PASS: dependency sets equal the pre-phase fixture (" + got.package_json.length + " package.json deps, " +
    got.shrinkwrap_packages_count + " shrinkwrap packages)");
'

# --- Quick-pass line preservation leg -----------------------------------------
run "363: quick-pass ask line preserved (count vs fixture)" node -e '
  const fs = require("fs");
  const path = require("path");
  const fx = require("./tests/fixtures/363-pre-phase.json");
  const line = "Ask: \"Quick pass or deep dive?\"";
  let n = 0;
  for (const f of fs.readdirSync("commands")) {
    if (!f.endsWith(".md")) continue;
    if (fs.readFileSync(path.join("commands", f), "utf8").split("\n").includes(line)) n += 1;
  }
  if (n < fx.quick_pass_line_count) {
    console.log("FAIL: " + n + " command files carry the quick-pass ask line, fixture pinned " + fx.quick_pass_line_count);
    process.exit(1);
  }
  console.log("PASS: " + n + " command files carry the quick-pass ask line (fixture " + fx.quick_pass_line_count + ")");
'

# --- Em-dash guard (always) ---------------------------------------------------
# Named 363 surfaces plus globs; a missing path is skipped silently (not
# counted). Both the em-dash and the en-dash are searched for.

echo "--- 363: em-dash guard ---"
EMDASH_HIT=0
EM="$(printf '\xe2\x80\x94')"
EN="$(printf '\xe2\x80\x93')"
EMDASH_FILES=(
  "scripts/research-planner.cjs"
  "scripts/build-research-shape-ledger.cjs"
  "data/research-shape-ledger.json"
  "lib/mcp/tools/research.cjs"
  "agents/research-lane-analyst.md"
  "commands/map-unknowns.md"
  "commands/root-cause.md"
  "commands/think-hats.md"
  "commands/diffusion.md"
  "commands/whitespace.md"
  "commands/research.md"
  "tests/run-all-363.sh"
)
while IFS= read -r -d '' f; do EMDASH_FILES+=("$f"); done < <(find lib/core/research-planner -type f -print0 2>/dev/null)
while IFS= read -r -d '' f; do EMDASH_FILES+=("$f"); done < <(find tests -maxdepth 1 -name 'test-363-*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do EMDASH_FILES+=("$f"); done < <(find tests/helpers -maxdepth 1 -name '*-363.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do EMDASH_FILES+=("$f"); done < <(find tests/fixtures -name '363-*' -type f -print0 2>/dev/null)
while IFS= read -r -d '' f; do EMDASH_FILES+=("$f"); done < <(find tests/fixtures -path '*/363-*/*' -type f -print0 2>/dev/null)
while IFS= read -r -d '' f; do EMDASH_FILES+=("$f"); done < <(find "$PD" -type f -print0 2>/dev/null)
for f in "${EMDASH_FILES[@]}"; do
  if [ -f "$f" ] && grep -lqF -e "$EM" -e "$EN" "$f" 2>/dev/null; then
    echo "em-dash or en-dash found in $f"
    EMDASH_HIT=1
  fi
done
if [ "$EMDASH_HIT" -eq 0 ]; then
  echo ">>> 363: em-dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 363: em-dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary ------------------------------------------------------------------

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
exit $(( FAIL > 0 ? 1 : 0 ))
