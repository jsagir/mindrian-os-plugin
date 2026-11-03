#!/usr/bin/env bash
# Phase 369.6 (the Larry contract: voice and calibration; execution truth) verification aggregator.
#
# Modeled on tests/run-all-3692.sh and tests/run-all-340.sh (the run / run_if shape, the guarded per-planned-test-file
# idiom, the dash guard). It differs in one place on purpose: the older wrapper in tests/run-all-3692.sh passes a red test when ONE
# signature substring appears in its output, so a NEW failing leg that appears beside the known one is invisible
# (Codex C5, 369.6-REVIEWS.md). run_baseline below compares the EXACT set of failing legs and the exit code with
# tests/fixtures/3696-known-failures.json through tests/helpers/known-failures-3696.cjs.
#
# IMPORTANT: this aggregator is written ONCE, here, in 369.6-01 (Wave 1). Later plans add their own test files
# (tests/test-3696-*.cjs); the run_if legs below already name every one of them, so a landed file is picked up
# automatically and a missing planned file reports SKIPPED, never PASSED. Only plan 369.6-13 edits this file.
#
# Counters:
#   PASSED  - the leg exited 0
#   FAILED  - the leg exited non-zero (not 77), or a run_baseline leg shows a failing leg, an exit code or a
#             missing failing-leg line that the baseline does not hold
#   SKIPPED - exit 77 (ENV GAP) or a missing planned file; never PASSED
#   KNOWN   - a run_baseline leg failed with exactly its recorded failing legs and exit code; never PASSED,
#             never FAILED
#
# Usage:
#   bash tests/run-all-3696.sh              run every leg
#   bash tests/run-all-3696.sh --self-test  prove run_baseline: a known failing leg is KNOWN, the same leg plus one
#                                           extra failing leg is FAILED
#
# exit 0  -> FAILED=0
# exit 1  -> FAILED > 0
#
# The persona-reader legs below are the tests that read the persona files, the served instructions, the output
# style, the face or the session-start hook (grep over tests and lib at the plan base, run files only: the
# run-all-*.sh aggregators and fixtures that merely name those files are not legs). A test that passed at the plan
# base is a run leg; a test that failed at the plan base is a run_baseline leg.
#
# The legs run with the owner's rooms home replaced by a fresh temporary directory, and MINDRIAN_SKIP_LIVE_CLAUDE=1.
#
# bash only. No emoji. Hyphens only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
KNOWN=0

BASELINE="tests/fixtures/3696-known-failures.json"
HELPER="tests/helpers/known-failures-3696.cjs"
REGISTER="tests/fixtures/3696-immutable-sources.json"

# Per-leg time limit in seconds. The same limit was used when the baseline was recorded.
LEG_LIMIT=300

run() {
  local label="$1"; shift
  echo "--- $label ---"
  timeout "$LEG_LIMIT" "$@" < /dev/null
  local status=$?
  if [ "$status" -eq 0 ]; then
    echo ">>> $label: PASSED"; PASS=$((PASS+1))
  elif [ "$status" -eq 77 ]; then
    echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1))
  else
    echo ">>> $label: FAILED (exit $status)"; FAIL=$((FAIL+1))
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

# run_baseline <label> <cmd...>
# A pre-existing red this phase does not own. The command runs; its combined output goes to a file; the last 15
# lines print; the helper then compares the exact failing legs and the exit code with the baseline entry named by
# the label. The helper's verdict line sets the counter. A KNOWN leg is never PASSED and never hides a new leg.
run_baseline() {
  local label="$1"; shift
  echo "--- $label ---"
  local out status verdict
  out="$(mktemp)"
  timeout "$LEG_LIMIT" "$@" > "$out" 2>&1 < /dev/null
  status=$?
  tail -n 15 "$out"
  verdict="$(node "$HELPER" --label "$label" --exit "$status" --baseline "$BASELINE" < "$out")"
  printf '%s\n' "$verdict"
  rm -f "$out"
  case "$verdict" in
    "VERDICT: PASSED"*)  echo ">>> $label: PASSED (known red healed; re-record the baseline entry in a reviewed diff)"; PASS=$((PASS+1)) ;;
    "VERDICT: KNOWN"*)   echo ">>> $label: KNOWN (pre-existing red, exact failing legs matched)"; KNOWN=$((KNOWN+1)) ;;
    "VERDICT: SKIPPED"*) echo ">>> $label: SKIPPED (ENV GAP)"; SKIP=$((SKIP+1)) ;;
    *)                   echo ">>> $label: FAILED (exit $status, a failing leg or exit code the baseline does not hold)"; FAIL=$((FAIL+1)) ;;
  esac
  echo ""
}

# --- Self-test: prove run_baseline through the aggregator's own function --------------------------
if [ "${1:-}" = "--self-test" ]; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  node -e '
    const fs = require("fs");
    fs.writeFileSync(process.argv[1], JSON.stringify({ recorded_at: "self-test", entries: {
      "fake-known": { command: "fake", exit_code: 1, fail_pattern: "^\\s*(FAIL|not ok)\\b", failing_legs: ["FAIL: the known leg"] },
      "fake-extra": { command: "fake", exit_code: 1, fail_pattern: "^\\s*(FAIL|not ok)\\b", failing_legs: ["FAIL: the known leg"] }
    } }));
  ' "$TMP/baseline.json"
  BASELINE="$TMP/baseline.json"
  run_baseline "fake-known" node -e 'console.log("ok  a passing leg"); console.log("FAIL: the known leg"); process.exit(1)'
  KNOWN_AFTER_FIRST=$KNOWN
  FAIL_AFTER_FIRST=$FAIL
  run_baseline "fake-extra" node -e 'console.log("FAIL: the known leg"); console.log("FAIL: one extra leg"); process.exit(1)'
  echo "self-test counters: PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
  if [ "$KNOWN_AFTER_FIRST" -eq 1 ] && [ "$FAIL_AFTER_FIRST" -eq 0 ] && [ "$KNOWN" -eq 1 ] && [ "$FAIL" -eq 1 ] && [ "$PASS" -eq 0 ]; then
    echo "self-test: OK (a known leg alone is KNOWN; the same leg plus one extra failing leg is FAILED)"
    exit 0
  fi
  echo "self-test: BROKEN (expected the first run KNOWN and the second FAILED)"
  exit 1
fi

# Keep every persona-reader test away from the owner's rooms: a fresh temporary rooms home, no live claude calls.
SUITE_TMP="$(mktemp -d)"
trap 'rm -rf "$SUITE_TMP"' EXIT
export MINDRIAN_ROOMS_HOME="$SUITE_TMP/rooms-home"
export MINDRIAN_ROOMS_ROOT="$SUITE_TMP/rooms-root"
mkdir -p "$MINDRIAN_ROOMS_HOME" "$MINDRIAN_ROOMS_ROOT"
export MINDRIAN_SKIP_LIVE_CLAUDE=1

# --- 1. Phase legs, one plain run leg per landed test file (the label names the plan that lands it) ---
# 369.6-13 (2026-10-30): every planned leg landed, so every former run_if leg is a plain run leg. A missing file now
# fails the leg instead of reporting SKIPPED.
run "3696: measurement script and snapshots (369.6-01)" node tests/test-3696-measure-voice.cjs
run "3696: reply checks and labelled corpus (369.6-01)" node tests/test-3696-reply-checks.cjs
run "3696: isolation (369.6-02)" node tests/test-3696-isolation.cjs
run "3696: isolation cache skip (quick 261103-vdn)" node tests/test-3696-isolation-cache-skip.cjs
run "3696: rubric eval (369.6-02)" node tests/test-3696-rubric-eval.cjs
run "3696: identity parity (369.6-04)" node tests/test-3696-identity-parity.cjs
run "3696: persona drift (369.6-04)" node tests/test-3696-persona-drift.cjs
run "3696: holds-by lines (369.6-05)" node tests/test-3696-holds-by.cjs
run "3696: voice-first budget (369.6-08)" node tests/test-3696-voice-first-budget.cjs
run "3696: skill budget (369.6-09)" node tests/test-3696-skill-budget.cjs
run "3696: doctrine presence (369.6-10)" node tests/test-3696-doctrine-presence.cjs
run "3696: rubric and glyph consistency (369.6-06)" node tests/test-3696-rubric-glyph-consistency.cjs
run "3696: mod voice (369.6-11)" node tests/test-3696-mod-voice.cjs
run "3696: one next move (369.6-11)" node tests/test-3696-one-next-move.cjs
run "3696: operation doctrine (369.6-03)" node tests/test-3696-operation-doctrine.cjs
run "3696: operation probe (369.6-03)" node tests/test-3696-operation-probe.cjs
run "3696: voice log denominator (369.6-06)" node tests/test-3696-voice-log-denominator.cjs
run "3696: voice reminder (369.6-06)" node tests/test-3696-voice-reminder.cjs

# --- 2. The exact failing-leg comparison, written in this plan ---
run "3696: known-set helper and aggregator comparison (369.6-01)"   node tests/test-3696-known-set.cjs
run "3696: aggregator self-test, known plus extra leg fails (369.6-01)" bash tests/run-all-3696.sh --self-test

# --- 3. Persona-reader tests (passed at the plan base: run; failed at the plan base: run_baseline) ---
run "lib/mcp/no-instructions.test.cjs" node lib/mcp/no-instructions.test.cjs
run_baseline "lib/memory/body-shape-coverage.test.cjs" node lib/memory/body-shape-coverage.test.cjs
run "lib/memory/brain-derivation-queue.test.cjs" node lib/memory/brain-derivation-queue.test.cjs
run_baseline "lib/memory/debouncer-drain-at-prompt.test.cjs" node lib/memory/debouncer-drain-at-prompt.test.cjs
run_baseline "lib/memory/mcp-server-brain-deps.test.cjs" node lib/memory/mcp-server-brain-deps.test.cjs
run "lib/memory/minto-debounce-consumer-census.test.cjs" node lib/memory/minto-debounce-consumer-census.test.cjs
run "lib/memory/minto-debouncer.test.cjs" node lib/memory/minto-debouncer.test.cjs
run "lib/memory/navigation-invariants.test.cjs" node lib/memory/navigation-invariants.test.cjs
run_baseline "lib/memory/offer-presenter.test.cjs" node lib/memory/offer-presenter.test.cjs
run "lib/memory/post-compact-reinjection.test.cjs" node lib/memory/post-compact-reinjection.test.cjs
run_baseline "lib/memory/problem-type-router.test.cjs" node lib/memory/problem-type-router.test.cjs
run "lib/memory/room-classifier-strict-mode.test.cjs" node lib/memory/room-classifier-strict-mode.test.cjs
run_baseline "lib/memory/session-start-brain-staleness.test.cjs" node lib/memory/session-start-brain-staleness.test.cjs
run_baseline "lib/memory/session-start-triple-injection.test.cjs" node lib/memory/session-start-triple-injection.test.cjs
run "lib/memory/skill-activation-router.test.cjs" node lib/memory/skill-activation-router.test.cjs
run_baseline "lib/memory/userpromptsubmit-integration.test.cjs" node lib/memory/userpromptsubmit-integration.test.cjs
run "tests/test-114-substrate-preload.sh" bash tests/test-114-substrate-preload.sh
run "tests/test-115-persona-variants.sh" bash tests/test-115-persona-variants.sh
run_baseline "tests/test-115-surfaces-grep.sh" bash tests/test-115-surfaces-grep.sh
run "tests/test-120-03-scaffold.sh" bash tests/test-120-03-scaffold.sh
run_baseline "tests/test-127.3-sibling-sweep.sh" bash tests/test-127.3-sibling-sweep.sh
run "tests/test-135-decide-wiring-e2e.cjs" node tests/test-135-decide-wiring-e2e.cjs
run "tests/test-143.2-doctrine-presence.cjs" node tests/test-143.2-doctrine-presence.cjs
run "tests/test-150-5-render-atomicity.cjs" node tests/test-150-5-render-atomicity.cjs
run "tests/test-150-5-sensor-firability.cjs" node tests/test-150-5-sensor-firability.cjs
run "tests/test-150-orphans.cjs" node tests/test-150-orphans.cjs
run "tests/test-150-render-unlock.cjs" node tests/test-150-render-unlock.cjs
run_baseline "tests/test-158-reach-presentation-counter.cjs" node tests/test-158-reach-presentation-counter.cjs
run_baseline "tests/test-159-integration-2turn-suppress.cjs" node tests/test-159-integration-2turn-suppress.cjs
run "tests/test-159-turn-start-wiring.cjs" node tests/test-159-turn-start-wiring.cjs
run "tests/test-198-stop-gate-retry-ceiling.test.cjs" node tests/test-198-stop-gate-retry-ceiling.test.cjs
run "tests/test-205-elevation-doctrine-floor.cjs" node tests/test-205-elevation-doctrine-floor.cjs
run_baseline "tests/test-209-declared-implies-wired.cjs" node tests/test-209-declared-implies-wired.cjs
run "tests/test-209-engine-arm-contract.cjs" node tests/test-209-engine-arm-contract.cjs
run "tests/test-209-primary-sidechannel.cjs" node tests/test-209-primary-sidechannel.cjs
run "tests/test-209-session-start-exemplar.cjs" node tests/test-209-session-start-exemplar.cjs
run "tests/test-222-fold-wired.cjs" node tests/test-222-fold-wired.cjs
run "tests/test-225-answer-narrowing.cjs" node tests/test-225-answer-narrowing.cjs
run "tests/test-225-gate-degrade.cjs" node tests/test-225-gate-degrade.cjs
run "tests/test-225-zero-score-gate.cjs" node tests/test-225-zero-score-gate.cjs
run "tests/test-226-session-binding-key-alignment.cjs" node tests/test-226-session-binding-key-alignment.cjs
run "tests/test-227-reach-relevance-gate.cjs" node tests/test-227-reach-relevance-gate.cjs
run "tests/test-235-cirs-commit-gate-worktree.cjs" node tests/test-235-cirs-commit-gate-worktree.cjs
run "tests/test-245-brain-verb-not-starved.cjs" node tests/test-245-brain-verb-not-starved.cjs
run "tests/test-245-dial-reactivity.cjs" node tests/test-245-dial-reactivity.cjs
run "tests/test-245-trigger-arms.cjs" node tests/test-245-trigger-arms.cjs
run "tests/test-248-resolver-census.cjs" node tests/test-248-resolver-census.cjs
run "tests/test-251-block-budget.cjs" node tests/test-251-block-budget.cjs
run "tests/test-251-hitrate-report.cjs" node tests/test-251-hitrate-report.cjs
run "tests/test-251-payload-dedup.cjs" node tests/test-251-payload-dedup.cjs
run "tests/test-251-skeleton-split.cjs" node tests/test-251-skeleton-split.cjs
run "tests/test-251-suppress-unchanged.cjs" node tests/test-251-suppress-unchanged.cjs
run_baseline "tests/test-252-guard-census.cjs" node tests/test-252-guard-census.cjs
run "tests/test-260917-binding-gate-offscope.cjs" node tests/test-260917-binding-gate-offscope.cjs
run "tests/test-260917-rooms-home-precedence.cjs" node tests/test-260917-rooms-home-precedence.cjs
run "tests/test-266-room-state-description.cjs" node tests/test-266-room-state-description.cjs
run "tests/test-267-1-first-install-hooked-audit.cjs" node tests/test-267-1-first-install-hooked-audit.cjs
run "tests/test-267-2-helpers.cjs" node tests/test-267-2-helpers.cjs
run "tests/test-267-2-w0-revert.cjs" node tests/test-267-2-w0-revert.cjs
run_baseline "tests/test-267-mcpv2-dual-era.cjs" node tests/test-267-mcpv2-dual-era.cjs
run_baseline "tests/test-267-mcpv2-registration-api.cjs" node tests/test-267-mcpv2-registration-api.cjs
run "tests/test-267.3-session-start-declaration.cjs" node tests/test-267.3-session-start-declaration.cjs
run "tests/test-267.3-surface-declarations.cjs" node tests/test-267.3-surface-declarations.cjs
run "tests/test-271-plugin-path-anchoring.cjs" node tests/test-271-plugin-path-anchoring.cjs
run "tests/test-298-contract-parity.cjs" node tests/test-298-contract-parity.cjs
run "tests/test-298-policies-schema.cjs" node tests/test-298-policies-schema.cjs
run "tests/test-298-voice-log.cjs" node tests/test-298-voice-log.cjs
run "tests/test-339-origin-single-source.cjs" node tests/test-339-origin-single-source.cjs
run "tests/test-341-legacy-install-teardown.cjs" node tests/test-341-legacy-install-teardown.cjs
run "tests/test-345-doctrine.cjs" node tests/test-345-doctrine.cjs
run "tests/test-345-goal-version-stamp.cjs" node tests/test-345-goal-version-stamp.cjs
run_baseline "tests/test-346-catalogue-schema.cjs" node tests/test-346-catalogue-schema.cjs
run "tests/test-348-doctrine-present.cjs" node tests/test-348-doctrine-present.cjs
run "tests/test-354-extract-shallow-contract.cjs" node tests/test-354-extract-shallow-contract.cjs
run "tests/test-356-larry-contract.cjs" node tests/test-356-larry-contract.cjs
run "tests/test-357-harness-source.cjs" node tests/test-357-harness-source.cjs
run "tests/test-357-replay.cjs" node tests/test-357-replay.cjs
run "tests/test-359-declared-arm.cjs" node tests/test-359-declared-arm.cjs
run_baseline "tests/test-359-forward-harness.cjs" node tests/test-359-forward-harness.cjs
run "tests/test-359-prose-budget.cjs" node tests/test-359-prose-budget.cjs
run "tests/test-360-harness-picker.cjs" node tests/test-360-harness-picker.cjs
run "tests/test-360-picker-policy.cjs" node tests/test-360-picker-policy.cjs
run "tests/test-360-snapshot-replay.cjs" node tests/test-360-snapshot-replay.cjs
run "tests/test-360-tripwire.cjs" node tests/test-360-tripwire.cjs
run_baseline "tests/test-369-launch-surface.cjs" node tests/test-369-launch-surface.cjs
run "tests/test-36925-injection.cjs" node tests/test-36925-injection.cjs
# 2026-10-30 (369.6-13): the N6 leg healed (the persona base pin was re-based by plans 07 to 11 under the two-window rule), so this is a plain run leg and its baseline entry is removed.
run "tests/test-36925-naming.cjs" node tests/test-36925-naming.cjs
run "tests/test-36925-readiness-gate.cjs" node tests/test-36925-readiness-gate.cjs
run "tests/test-380-build.cjs" node tests/test-380-build.cjs
run "tests/test-380-theo-faces.cjs" node tests/test-380-theo-faces.cjs
run "tests/test-acpt-01-engine-fires.cjs" node tests/test-acpt-01-engine-fires.cjs
run "tests/test-acpt-06-dial-atomic-emission.cjs" node tests/test-acpt-06-dial-atomic-emission.cjs
run "tests/test-active-session-ownership.cjs" node tests/test-active-session-ownership.cjs
run "tests/test-bch-01-ownership.cjs" node tests/test-bch-01-ownership.cjs
run "tests/test-canon-entry-38-sourced-claims-floor.cjs" node tests/test-canon-entry-38-sourced-claims-floor.cjs
run "tests/test-capability-dial-committed.cjs" node tests/test-capability-dial-committed.cjs
run "tests/test-chain-executor-part8-leak.cjs" node tests/test-chain-executor-part8-leak.cjs
run_baseline "tests/test-check-render-coverage.cjs" node tests/test-check-render-coverage.cjs
run "tests/test-cross-session-room-bleed.cjs" node tests/test-cross-session-room-bleed.cjs
run "tests/test-decide-part8-invariant.cjs" node tests/test-decide-part8-invariant.cjs
run "tests/test-f7-dial-gap-zero-confirm.cjs" node tests/test-f7-dial-gap-zero-confirm.cjs
run "tests/test-gate-native-fire-w1.cjs" node tests/test-gate-native-fire-w1.cjs
run "tests/test-harness-manifest-precommit-wiring.cjs" node tests/test-harness-manifest-precommit-wiring.cjs
run "tests/test-install-state-record.cjs" node tests/test-install-state-record.cjs
run "tests/test-k1u-session-start-envelope.cjs" node tests/test-k1u-session-start-envelope.cjs
run_baseline "tests/test-l8g-theo-bare.cjs" node tests/test-l8g-theo-bare.cjs
run "tests/test-l9o-rooms-python-floor.cjs" node tests/test-l9o-rooms-python-floor.cjs
run "tests/test-larry-handoff-seam.cjs" node tests/test-larry-handoff-seam.cjs
run "tests/test-larry-theo-face-apps.cjs" node tests/test-larry-theo-face-apps.cjs
run_baseline "tests/test-meter-gate-reach.cjs" node tests/test-meter-gate-reach.cjs
run_baseline "tests/test-mux-card-before-answer.cjs" node tests/test-mux-card-before-answer.cjs
run "tests/test-nav01-populated-room-engine-fires.cjs" node tests/test-nav01-populated-room-engine-fires.cjs
run "tests/test-platform.cjs" node tests/test-platform.cjs
run "tests/test-posture-ids-drift.cjs" node tests/test-posture-ids-drift.cjs
run "tests/test-r1-posttooluse-interceptor-spike.cjs" node tests/test-r1-posttooluse-interceptor-spike.cjs
run "tests/test-reach-gate-stale-turn-input.cjs" node tests/test-reach-gate-stale-turn-input.cjs
run "tests/test-reach-ids-drift.cjs" node tests/test-reach-ids-drift.cjs
run "tests/test-reach-label-claim-text.cjs" node tests/test-reach-label-claim-text.cjs
run_baseline "tests/test-render-registry-build.cjs" node tests/test-render-registry-build.cjs
run "tests/test-retrieval-seed.cjs" node tests/test-retrieval-seed.cjs
run "tests/test-reverse-salient-persona.cjs" node tests/test-reverse-salient-persona.cjs
run "tests/test-room-context-latency.cjs" node tests/test-room-context-latency.cjs
run "tests/test-sensor-spine-dispatch.cjs" node tests/test-sensor-spine-dispatch.cjs
run "tests/test-session-start-banner.cjs" node tests/test-session-start-banner.cjs
run "tests/test-session-start-node-preflight.cjs" node tests/test-session-start-node-preflight.cjs
run "tests/test-stance-voice-glyph-override.cjs" node tests/test-stance-voice-glyph-override.cjs
run "tests/test-trigger-invariant.cjs" node tests/test-trigger-invariant.cjs
run_baseline "tests/test-card-fire-relevance-gate.cjs" node tests/test-card-fire-relevance-gate.cjs
run_baseline "tests/test-hmi-compliance-e2e.cjs" node tests/test-hmi-compliance-e2e.cjs

# --- 4. Gate (plain run) ---
run "3696: harness-manifest generator --check"  node scripts/build-harness-manifest.cjs --check

# --- 5. Dash guard (always) ---
# Phase 369.6 surfaces by glob. The two dash characters are searched for only as printf byte escapes. A path
# or field registered in tests/fixtures/3696-immutable-sources.json is skipped by exact name (Codex C11): a
# verbatim copy of a historical text is never normalized to meet a house rule.
echo "--- 3696: dash guard ---"
DASH_HIT=0
EM="$(printf '\xe2\x80\x94')"
EN="$(printf '\xe2\x80\x93')"
IMMUTABLE_PATHS="$(node -e 'try { const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); (r.paths || []).forEach((p) => console.log(p.path)); } catch (e) {}' "$REGISTER")"
DASH_FILES=("tests/run-all-3696.sh")
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find tests -maxdepth 1 -name 'test-3696-*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find tests/helpers -maxdepth 1 -name '*-3696.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find lib/hmi -maxdepth 1 -name 'larry-*.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find scripts -maxdepth 1 -name '*-larry-voice.cjs' -print0 2>/dev/null)
while IFS= read -r -d '' f; do DASH_FILES+=("$f"); done < <(find evals/larry-voice -maxdepth 1 -name '*.cjs' -print0 2>/dev/null)
for f in "${DASH_FILES[@]}"; do
  if printf '%s\n' "$IMMUTABLE_PATHS" | grep -qxF -- "$f"; then continue; fi
  if [ -f "$f" ] && grep -lqF -e "$EM" -e "$EN" "$f" 2>/dev/null; then
    echo "em-dash or en-dash found in $f"
    DASH_HIT=1
  fi
done
if [ "$DASH_HIT" -eq 0 ]; then
  echo ">>> 3696: dash guard: PASSED"; PASS=$((PASS+1))
else
  echo ">>> 3696: dash guard: FAILED"; FAIL=$((FAIL+1))
fi
echo ""

# --- Summary ---
echo "=========================================="
echo "Phase 369.6 verification: PASSED=$PASS FAILED=$FAIL SKIPPED=$SKIP KNOWN=$KNOWN"
echo "=========================================="
[ "$FAIL" -eq 0 ]
