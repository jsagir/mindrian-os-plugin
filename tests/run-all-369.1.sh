#!/usr/bin/env bash
# Phase 369.1 (2026-10-04): Desktop plugin install, MindrianOS installable from
# Claude Desktop. Written ONCE by plan 369.1-01; later plans never edit it, so
# every planned test is named here now and guarded with run_if (a not-yet-landed
# leg reports SKIPPED (missing ...)). Exit 77 is SKIPPED (ENV GAP), never PASSED.
# Hyphens only.
#
# Modeled on tests/run-all-366.sh (run / run_if / run_known_if counters).
#
# Counters:
#   PASSED  exit 0
#   FAILED  non-zero and not 77 (and, for run_known_if, not the declared signature)
#   SKIPPED exit 77 (ENV GAP) or a missing planned file
#   KNOWN   a pre-existing red this phase does not own, matched by exact signature
# The script exits 0 only when FAILED=0.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0; SKIP=0; KNOWN=0

# run <label> <cmd...>: exit 0 -> PASSED, exit 77 -> SKIPPED (ENV GAP, never a
# pass), anything else -> FAILED.
run() {
  local label="$1"; shift
  echo "--- $label ---"
  "$@"
  local status=$?
  if [ "$status" -eq 0 ]; then echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

# run_if <label> <guard-file> <cmd...>: SKIPPED (missing ...) when the guard
# file is not there yet.
run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then run "$label" "$@"
  else echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""; fi
}

# run_known_if <label> <guard-file> <signature> <cmd...>
# A pre-existing red this phase does not own (the run-all-363.sh run_known idiom,
# guarded like run_if). Exit 0 -> PASSED (known red healed). Exit 77 -> SKIPPED.
# Non-zero exit whose combined output carries the literal signature -> KNOWN.
# Any other non-zero exit -> FAILED (a new failure mode, investigate).
run_known_if() {
  local label="$1"; local guard="$2"; local signature="$3"; shift 3
  echo "--- $label ---"
  if [ ! -f "$guard" ]; then echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""; return; fi
  local out
  out="$("$@" 2>&1)"
  local status=$?
  printf '%s\n' "$out" | tail -n 8
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED (known red healed)"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  elif printf '%s' "$out" | grep -qF -- "$signature"; then
    echo ">>> $label: KNOWN (pre-existing red, signature matched)"; KNOWN=$((KNOWN+1))
  else
    echo ">>> $label: FAILED (exit $status, recorded signature NOT found: $signature)"; FAIL=$((FAIL+1))
  fi
  echo ""
}

# --- (1) phase legs (static and offline) -------------------------------------
run_if "DPI-08 marketplace clean"                      tests/test-369.1-marketplace-clean.cjs     node tests/test-369.1-marketplace-clean.cjs
run_if "DPI-04 bin relocation"                         tests/test-369.1-bin-relocation.cjs        node tests/test-369.1-bin-relocation.cjs
run_if "DPI-02 DPI-03 desktop artifact"                tests/test-369.1-desktop-artifact.cjs      node tests/test-369.1-desktop-artifact.cjs
run_if "DPI-01 marketplace shape"                      tests/test-369.1-marketplace-shape.cjs     node tests/test-369.1-marketplace-shape.cjs
run_if "DPI-05 release lockstep"                       tests/test-369.1-release-lockstep.cjs      node tests/test-369.1-release-lockstep.cjs
run_if "downstream: 369-28 landed (plan 369.1-08 probe)" tests/test-369.1-369-28-precondition.cjs node tests/test-369.1-369-28-precondition.cjs
run_if "DPI-06 self-install (offline arms)"            tests/test-369.1-dep-self-install.cjs      node tests/test-369.1-dep-self-install.cjs --arm unit --arm responder-module --arm detached --arm entries
# Code-review fixes (369.1-REVIEW.md, iteration 1): one regression arm per finding, a plain leg, no tolerance.
run_if "369.1 review fixes (one arm per finding)"      tests/test-369.1-review-fixes.cjs          node tests/test-369.1-review-fixes.cjs

# --- (2) regression neighbours (must stay green) -----------------------------
run_if "regression: 341 marketplace npm source"        tests/test-341-marketplace-npm-source.cjs  node tests/test-341-marketplace-npm-source.cjs
run_if "regression: 341 shrinkwrap no dev"             tests/test-341-shrinkwrap-no-dev.cjs       node tests/test-341-shrinkwrap-no-dev.cjs
run_if "regression: 341 payload shrinkwrap present"    tests/test-341-payload-shrinkwrap-present.cjs node tests/test-341-payload-shrinkwrap-present.cjs
run_if "regression: 341 release shrinkwrap gate"       tests/test-341-release-shrinkwrap-gate.cjs node tests/test-341-release-shrinkwrap-gate.cjs
run_if "regression: mcp-dep-heal unit"                 lib/core/mcp-dep-heal.test.cjs             node lib/core/mcp-dep-heal.test.cjs
run_if "regression: npm-cli-resolve unit"              lib/core/npm-cli-resolve.test.cjs          node lib/core/npm-cli-resolve.test.cjs
run_if "regression: 341 eureka enable argv"            tests/test-341-eureka-enable-argv.cjs      node tests/test-341-eureka-enable-argv.cjs
run_if "regression: 266 connect path process budget"   tests/test-266-connect-path-process-budget.cjs node tests/test-266-connect-path-process-budget.cjs
run_if "regression: 266 dep heal connect budget"       tests/test-266-dep-heal-connect-budget.cjs node tests/test-266-dep-heal-connect-budget.cjs
run_if "regression: desktop stdio session binding"     tests/test-desktop-stdio-session-binding.cjs node tests/test-desktop-stdio-session-binding.cjs
run_if "regression: mcp no-instructions"               lib/mcp/no-instructions.test.cjs           node lib/mcp/no-instructions.test.cjs
run_if "regression: 265 mcp description hygiene"       tests/test-265-mcp-description-hygiene.cjs node tests/test-265-mcp-description-hygiene.cjs
run_if "regression: 354 theo mcp exposure"             tests/test-354-theo-mcp-exposure.cjs       node tests/test-354-theo-mcp-exposure.cjs
run_if "regression: 235 release shape gate"            tests/test-235-release-shape-gate.cjs      node tests/test-235-release-shape-gate.cjs
run_if "regression: 369 installed layout"              tests/test-369-installed-layout.cjs        node tests/test-369-installed-layout.cjs
run "regression: release.sh syntax"                    bash -n scripts/release.sh
run "regression: skill mirrors --check"                node scripts/build-skill-mirrors.cjs --check
run "regression: command registry --check"             node scripts/build-command-registry.cjs --check
run "regression: connector registry --check"           node scripts/build-connector-registry.cjs --check
run "regression: plugin path anchoring --check"        node scripts/check-plugin-path-anchoring.cjs --check
run "regression: plugin path anchoring --check-scripts" node scripts/check-plugin-path-anchoring.cjs --check-scripts
run "regression: tool honesty --check"                 node scripts/check-tool-honesty.cjs --check
run "regression: shape declaration --check (advisory: exit code proves nothing, plans diff its WARN lines)" node scripts/check-shape-declaration.cjs --check

# --- (3) D-16 payload ceiling (owned by this phase, plain legs, no tolerance) -
# These were red at planning (2026-10-04) on `declares hasInstallScript:true for:
# node_modules/sharp`. D-16 (navigator, 2026-10-04) folds that red into this
# phase: plan 369.1-08 turns them green and the close-out requires them green.
# They are PLAIN legs on purpose: no run_known_if, no tolerance.
run    "D-16 release payload ceiling --check"                                              node scripts/check-release-payload-ceiling.cjs --check
run_if "D-16 341 payload ceiling (harness policy)"     tests/test-341-payload-ceiling.cjs         node tests/test-341-payload-ceiling.cjs
run_if "D-16 DPI-13 sharp out (offline arms)"          tests/test-369.1-sharp-out.cjs             node tests/test-369.1-sharp-out.cjs --arm shrinkwrap --arm prune-fn --arm gate --arm text --arm release-step
run_if "regression: 369-28 dist, strict ceiling"       tests/test-369-ui-dist-fresh.cjs           env MOS_369_STRICT_CEILING=1 node tests/test-369-ui-dist-fresh.cjs

# --- (4) pre-existing reds this phase does not own ---------------------------
# Signatures measured at planning, 2026-10-04, HEAD 45563da11. KNOWN is not PASS.
# Any other failure mode is FAILED. A healed leg reports PASSED by itself. A
# changed count (for example 4 new agentshield findings, or 4 failed bump-algebra
# tests) is FAILED and must be investigated, never re-signatured silently.
run_known_if "known red: release bump algebra"         tests/test-release-bump-algebra.cjs   "3 test(s) failed."                                   node tests/test-release-bump-algebra.cjs
run_known_if "known red: 234 dist bundle"              tests/test-234-dist-bundle.cjs        "test-234-dist-bundle: FAILED (4 check(s))"           node tests/test-234-dist-bundle.cjs
run_known_if "known red: agentshield scan"             scripts/agentshield-scan-cli.cjs      "FAIL: 3 new finding(s) not in the baseline"          node scripts/agentshield-scan-cli.cjs
run_known_if "known red: 234 plugin root migrated"     tests/test-234-plugin-root-migrated.cjs "18 passed, 1 failed"                               node tests/test-234-plugin-root-migrated.cjs

# --- (5) long-dash guard (hyphens only) --------------------------------------
# Only EXISTING paths are scanned (ls -d), so a missing path never masks a hit.
# LC_ALL=C is required: under a UTF-8 locale grep -P reads the byte escapes as
# code points and can match nothing, so the guard would pass vacuously. -I skips
# binary files and the output directory of the 369 screenshots is excluded.
run "no em-dash or en-dash in phase 369.1 files" bash -c '
  files=$(ls -d tests/run-all-369.1.sh tests/test-369.1-*.cjs \
    scripts/release-lib/build-desktop-artifact.cjs \
    scripts/release-lib/desktop-copy-gate.sh \
    scripts/release-lib/prune-shrinkwrap.cjs \
    scripts/release-lib/shrinkwrap-gate.sh \
    scripts/check-release-payload-ceiling.cjs \
    lib/core/mcp-install-responder.cjs \
    lib/core/dep-install-status.cjs \
    scripts/sessionstart-npm-reconcile.cjs \
    lib/core/dep-install-detached.cjs \
    lib/core/mcp-dep-heal.cjs \
    lib/core/npm-cli-resolve.cjs \
    scripts/mindrian-mcp-server.cjs \
    scripts/mindrian-brain-mcp-client.cjs \
    scripts/mindrian-mcp-shim.cjs \
    scripts/mindrian-tools.cjs \
    scripts/local-chain-recommender.cjs \
    bin/mindrian-mcp-server.cjs \
    bin/mindrian-brain-mcp-client.cjs \
    bin/mindrian-mcp-shim.cjs \
    bin/mindrian-tools.cjs \
    bin/local-chain-recommender.cjs \
    .mcp.json \
    docs/RELEASE-CEREMONY-RULING-SYSTEM.md \
    .claude/includes/release-process.md \
    .planning/phases/369.1-desktop-plugin-install-mindrianos-installable-from-claude-de/*.md 2>/dev/null)
  [ -z "$files" ] && exit 0
  hits=$(LC_ALL=C grep -rlIP --exclude-dir=output --exclude-dir=node_modules "\xE2\x80\x94|\xE2\x80\x93" $files)
  if [ -n "$hits" ]; then echo "dash hits:"; echo "$hits"; exit 1; fi
  exit 0'

# --- (6) live legs (slowest last) --------------------------------------------
run_if "DPI-13 sharp out (npm ci from the pruned shrinkwrap, live)" tests/test-369.1-sharp-out.cjs        node tests/test-369.1-sharp-out.cjs --arm install
run_if "DPI-06 self-install (real npm ci, live)"                    tests/test-369.1-dep-self-install.cjs  node tests/test-369.1-dep-self-install.cjs --arm real-npm
run_if "regression: 267 dual era (live)"                            tests/test-267-mcpv2-dual-era.cjs      node tests/test-267-mcpv2-dual-era.cjs
run_if "DPI-07 CLI install (live, last)"                            tests/test-369.1-cli-install.cjs       node tests/test-369.1-cli-install.cjs

# --- Human legs (not executable here) ----------------------------------------
# DPI-09 (live Desktop, Cowork, Code tab, Chat) and DPI-10 (the Customize >
# Plugins sync spike) are human checkpoints recorded in 369.1-MANUAL-VERIFICATION.md
# and 369.1-SPIKE.md; this script never reports them as PASSED.
echo "--- DPI-09 live Desktop verification ---"
echo ">>> DPI-09 live Desktop verification: SKIPPED (human checkpoint, 369.1-MANUAL-VERIFICATION.md)"
SKIP=$((SKIP+1))
echo "--- DPI-10 Customize > Plugins sync spike ---"
echo ">>> DPI-10 Customize > Plugins sync spike: SKIPPED (human checkpoint, 369.1-SPIKE.md)"
SKIP=$((SKIP+1))
echo ""

echo "PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
[ "$FAIL" -eq 0 ]
