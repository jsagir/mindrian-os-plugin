---
phase: 370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude
plan: 06
subsystem: review-contract
tags: [review-contract, hook, pretooluse, log-only, tdd]
requires: [370-04, 370-08, 370-10]
provides:
  - scripts/review-contract-hook.cjs (PreToolUse hook, Write tool only, log-only by owner answer O6B)
  - hooks/hooks.json: one PreToolUse entry (matcher Write, timeout 3, no onFailure)
  - tests/test-370-hook.cjs (arms H1 to H11)
affects: [370-11]
key-files:
  created:
    - scripts/review-contract-hook.cjs
    - tests/test-370-hook.cjs
  modified:
    - hooks/hooks.json
    - tests/test-261029-qef-hook-timeouts.cjs
    - tests/test-389-hook-unwire.cjs
    - data/arbitration-rule-catalogue.json
key-decisions:
  - "O6B LOG-ONLY: the hook logs rows and never blocks. The enforce path exists in the script and is OFF (data/review-contract.json enforcement.hook_mode is log-only)."
  - "O8 FRONTMATTER: the hook finds a review by its frontmatter header (isReviewArtifact), after a string pre-check for methodology: or review_contract."
  - "Path rules run before the content: not .md, inside the plugin repo root, or a repo-source segment in the path relative to the payload cwd means skip. An absolute path outside the cwd and the repo root is never skipped on segment names."
requirements-completed: [REV370-10]
completed: 2026-11-08
---

# Phase 370 Plan 06: Review contract hook for the Write tool Summary

On the CLI, a review written with the Write tool is checked at write time. In log-only mode (the owner answer) the hook writes one local log row with rule ids, classes and line numbers and exits 0. It never blocks. The enforce path (exit 2 with a plain message) exists and is off.

## Gates (PROVEN)

- `370-gate.cjs gate-item 370-DECISION.md O6B`: exit 0, `RESOLVED O6B=LOG-ONLY`.
- `370-gate.cjs gate-item 370-DECISION.md O8 --need FRONTMATTER`: exit 0, `RESOLVED O8=FRONTMATTER`.
- data/review-contract.json enforcement.hook_mode: `log-only`.
- BASE = b8d202ea4238c2ef5703f008cace83fea49a3caa. `git status --short hooks/hooks.json tests/test-261029-qef-hook-timeouts.cjs` was empty before the edits. The plan ran. It was not declined.

## Commits

| Commit | Files |
|--------|-------|
| 11c124739 | tests/test-370-hook.cjs (RED) |
| see the GREEN commit in git log (subject starts with feat(370-06)) | scripts/review-contract-hook.cjs, hooks/hooks.json, tests/test-261029-qef-hook-timeouts.cjs, tests/test-389-hook-unwire.cjs, data/arbitration-rule-catalogue.json, this SUMMARY |

Not pushed. No tag, no version change, no dist regeneration. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## TDD record

RED (11c124739), the test before the script existed:

```
FAIL test-370-hook: cannot find scripts/review-contract-hook.cjs (review-contract-hook missing; plan 370-06 creates it)
PASS: 0 FAIL: 1
```

RED for the pins (hooks.json edited, pins not yet updated), `node tests/test-261029-qef-hook-timeouts.cjs`:

```
FAIL A1 shape ... FAIL A2 (expected 40 command hooks, found 41) ... FAIL A4 (rows cover 40 of 41 entries) ... FAIL A7 (parsed 41 entries)
hook-timeouts: 4 FAILED
```

GREEN: `node tests/test-370-hook.cjs` gives `PASS: 15 FAIL: 0` (arms H1 to H9, H10, H10b, H10c, H10d, H10e, H11). `node tests/test-261029-qef-hook-timeouts.cjs` gives `ALL PASS` (A1 to A9 plus the new A5b).

## Latency budget (arm H11)

Budget: for a payload that is not a review, the median of 20 spawns of the hook is at most the median of 20 spawns of `node -e 0` plus 50 ms. For a review payload (pre-fix fixture, enforce mode) at most that baseline plus 150 ms. The three spawns share each round (interleaved, hrtime). One warm-up round is not counted. The budget is far below the 3 second hook timeout: 10 x 150 ms = 1500 ms, at most 3000 ms (pinned in P370, arm A5b, and in arm H9).

Measured, run alone on a quiet machine (no other suite in parallel), final run:

| Case | median | margin to budget |
|------|--------|------------------|
| node -e 0 (baseline) | median 22.0 ms | - |
| hook, payload that is not a review | median 19.3 ms | 52.6 ms below the +50 ms limit (hook is under the baseline) |
| hook, review payload | median 39.0 ms | 133.0 ms below the +150 ms limit (+17.0 ms over baseline) |

An earlier run, during development: baseline median 21.3 ms, non-review median 19.8 ms, review median 38.3 ms. No retry was needed in either run. The non-review median is under the baseline because the script reads stdin, fails the quick header check and exits before it loads any module.

## What was built

- `scripts/review-contract-hook.cjs`: CJS, Node built-ins at the top. Order: bounded stdin read (1000000 bytes), JSON parse, tool_name must be Write when present, `tool_input.file_path` must be a string, path rules, content must be a string, quick header check (`methodology:` or `review_contract`), then lazy require of `lib/core/review-contract.cjs`, `isReviewArtifact`, mode from `enforcement.hook_mode`, `checkReview(content, { softTerms: 'skip', contract })`. Log-only: `appendVoiceStyleRow` with policy `review-contract-body` and `rule/class@line` triples. Enforce: stderr with rule, class and line, exit 2. Any throw exits 0.
- `--contract <path>` is for tests only. hooks.json passes no argument. No environment override.
- hooks.json: one object after the web credential guard, matcher `Write`, command `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-contract-hook.cjs"`, timeout 3, no other key. hooks.json now holds 41 command hooks: PreToolUse 5, UserPromptSubmit 6. Exactly two hooks carry `onFailure: block` (the Part 8 egress guard and the web credential guard).
- Output and log hold rule ids, classes and line numbers only (arms H1 and H3 grep the nine planted strings).

## Deliberate pin changes

- `tests/test-261029-qef-hook-timeouts.cjs`: new P370 record (added PreToolUse entry, script, timeout 3), `EXPECTED` plus P370.added, the A1 base comparison removes P370 additions as it does P386, the A4 row `['PreToolUse', 'review-contract-hook.cjs', 3]`, and a new arm A5b (matcher Write, timeout 3, no onFailure, `HOOK_BUDGET_REVIEW_MS = 150`, `10 * 150 <= 3 * 1000`). No other pinned value changed.
- `tests/test-389-hook-unwire.cjs`: the census arm expected PreToolUse 4 and total 40. It now expects PreToolUse 5 and total 41 (one deliberate addition, with a comment). The arm that pins exactly two `onFailure: block` commands is unchanged and passes.
- `data/arbitration-rule-catalogue.json`: one entry in `_doc.not_a_judgment_rule` for `review-contract-hook.cjs`, with a reason. The catalogue states that a new hook is either catalogued or named there; without the entry `tests/test-346-catalogue-schema.cjs` arm 12 would have listed one more uncovered mechanism than at baseline.

## Verification (PROVEN, run in this session)

| Command | Result |
|---------|--------|
| node tests/test-370-hook.cjs | PASS 15 FAIL 0 |
| node tests/test-261029-qef-hook-timeouts.cjs | ALL PASS |
| node tests/test-quick-260911-juq-hooks-json-top-level.cjs | exit 0 |
| node tests/test-369-hook-require-graph.cjs | 5 passed, 0 failed |
| node tests/test-386-web-credential-hook.cjs | all arms passed |
| node tests/test-391-hooks-contract.cjs | 25 passed, 0 failed |
| node tests/test-389-hook-unwire.cjs | exit 0 (after the pin update) |
| bash tests/run-all-370.sh | Phase 370: PASS=13 FAIL=0 SKIP=0 |
| build-connector-registry --check, build-orchestration-projection --check, check-render-coverage | exit 0, exit 0, exit 0 |
| non-ASCII bytes and U+2013, U+2014 in the written files | none |

## Baseline reds (UNCHANGED, checked against HEAD hooks.json before this plan)

These fail at BASE and fail the same way after. Counts compared:

- `tests/test-3696-isolation.cjs`: PASS 69 FAIL 1 (arm B5b) before and after.
- `tests/test-connector-tier-d-hooks.cjs`: 3 passed, 1 failed (CHECK 4, brain-derivation-drain) before and after.
- `tests/test-346-catalogue-schema.cjs`: arm 12 lists the same two uncovered mechanisms (`ambient-stop.cjs`, `card-before-answer-hook.cjs`) before and after; the review hook is covered.
- `tests/test-3551-tri-polar.cjs`: 8 passed, 1 failed (PreToolUse differs from BASE_NON_STOP) before and after. HEAD already differs because of the earlier web credential guard.
- `tests/test-auto-explore-fingerprint.cjs`, `test-auto-explore-canon-part-8.cjs`, `test-mux-card-before-answer.cjs` (PASS=18 FAIL=1), `test-hmi-compliance-e2e.cjs` (10 passed, 1 failed): same result before and after.
- `tests/test-36925-brief-wiring.cjs` failed once (arm BW2) while another session ran heavy suites on the machine, and passed twice on re-run (6 passed, 0 failed). At BASE it passed. It is timing flaky, not caused by the hook.

## Stated limits

- Edit and MultiEdit carry a diff, not the whole file, so the hook does not cover them. The door, the pre-file step and the doctor template lint cover those.
- Arm H10e: a student whose payload cwd is a folder above a folder named agents, tests, skills and so on, and who writes a review there, is skipped. This is the accepted fail-open (a false block is worse than a false allow).
- Log-only is the live mode. Nothing blocks until the owner sets `enforcement.hook_mode` to `enforce`.

## Deviations from Plan

**1. [Rule 2 - missing registration] data/arbitration-rule-catalogue.json entry.** The file is not in the plan's files_modified. The catalogue's own rule says a new hook must be catalogued or named in not_a_judgment_rule. The entry keeps the baseline red count of test-346 arm 12 equal.

**2. [Rule 3 - blocking pin] tests/test-389-hook-unwire.cjs census arm.** It pinned PreToolUse 4 and total 40, so the plan's own hook entry failed it. Updated deliberately, with a comment. Not in the plan's files_modified.

**3. [Detail] Header comment of test-261029.** The long header comment still names the 46-hook history; the P370 record carries the new facts. No other text changed.

## Known Stubs

None.

## Threat Flags

None. Local files only, no network, no Brain call. The hook adds no new trust boundary beyond the plan threat model (T-370-26 to T-370-31).

## Self-Check: PASSED (files and commits verified below in the closing step)
