---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
plan: 07
subsystem: card-fire
tags: [card-fire, runtime-fix, turn-text, gate-relevance, deterministic, tri-polar, harness-classification, dial-chrome]

# Dependency graph
requires:
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
    plan: 02
    provides: "scripts/replay-card-fire.cjs (the replay harness, --code-root pre-phase, --only)"
  - phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
    plan: 05
    provides: "tests/fixtures/card-fire-replay/debug-cases.json (the 3 D-07 targets and 2 V3 carve-out cases), live-2026-09-23.json (the 2 live false blocks)"
provides:
  - "lib/hmi/turn-text.cjs: the 'harness' preceding-source class (classifyPrecedingUserContentSource(content, rec)), HARNESS_LEADS, preceding_user_is_meta threaded through readTurnText/readTranscriptTurn"
  - "scripts/check-card-fire.cjs: the PRIMARY synthetic guard treats 'harness' exactly like 'tool_result'; preceding_user_is_meta threaded through deriveTurnSignals with direct-field precedence"
  - "lib/core/gate-relevance.cjs: F1_DIAL_CHROME_TOKENS, stripped from the GATE side of gateSubjectTokens; subjectTokens and GATE_BOILERPLATE_TOKENS now also exported"
  - "tests/test-357-harness-source.cjs (10 behaviors, GATE357-04), tests/test-357-f1-chrome.cjs (12 behaviors, GATE357-05)"
  - "the full corpus replay on HEAD: 0 false_blocks, 0 new_misses, 0 parity mismatches (was 13 false_blocks pre-fix)"
affects: [357-08, 357-09, 357-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The V3 human-upstream carve-out (Pattern 4, RESEARCH): classifyPrecedingUserContentSource(content, rec) stays a byte-identical 1-arg function for existing callers; the optional rec argument (isMeta, originKind, prevHumanUpstream) is purely additive, computed by readTurnText's own per-record walk that now tracks the previous role:user record's human-upstream status"
    - "Structural-only harness detection, never meaning: rule 1 is isMeta + not-prevHumanUpstream; rule 2 is a non-human origin.kind plus a frozen leading-tag match (HARNESS_LEADS). Neither rule inspects message content for semantics"
    - "The F1_DIAL_CHROME_TOKENS strip follows the GATE_BOILERPLATE_TOKENS precedent (893cee043) exactly: a frozen Set, GATE-side-only, asymmetric with the user side, pinned by an independent drift test that re-derives the tokens from a separately-authored literal list and asserts exact equality"

key-files:
  created:
    - tests/test-357-harness-source.cjs
    - tests/test-357-f1-chrome.cjs
  modified:
    - lib/hmi/turn-text.cjs
    - scripts/check-card-fire.cjs
    - lib/core/gate-relevance.cjs

key-decisions:
  - "PLAN_BASE = 712a63575c40d54df474338d67441f57e576b16a (HEAD at plan start; git status --short showed no peer diff on any of the 5 target files before editing)"
  - "Task 1 commit: a05ef931c (fix). Task 2 commit: f6999ed53 (fix). Plan-09's mutation leg reverts these two."
  - "Peer-framing prefix measured per step 2, against the R-D snapshot (~/.cache/mindrian-dev/357-raw/, sha256sum -c verified OK for all 5 files before inspection): the longest common prefix across all 30 origin.kind:'peer' role:user records in the 4-session snapshot is exactly 40 characters, 'Another Claude session sent a message:\\n<' (harness preamble framing, never conversation content). Kept and added to HARNESS_LEADS per the plan's own >= 8 char / harness-framing test. Every observed peer record also carries isMeta:true, so rule 1 (isMeta + not-prevHumanUpstream) already covers every real corpus case on its own; the added tag gives origin.kind-path coverage (rule 2) as an independent, redundant-by-design safety net, matching the R-A carve-out wording in the plan frontmatter ('or when its origin.kind is not human and its text leads with ... the observed peer framing')."
  - "F1_DIAL_CHROME_TOKENS final set (22 tokens, derived from lib/hmi/dial-presenter.cjs's static literals via subjectTokens, minus GATE_BOILERPLATE_TOKENS): choose, next, reach, recommendation, offline, pick, nothing, rank, anywhere, decision, gate, local, brain, signal, ranked, cold, prior, none, turn, investigate, blend, insight. None of the frequency-list-only words (research, claim, back, bring, spin, worked) are present, per D-08a/R-F's own rule (derive from literals, never frequency)."
  - "The R-C case (dogfood-0f86dd63-092046) was independently re-verified against the shipped F1_DIAL_CHROME_TOKENS set: after stripping 'prior' (chrome) and 'reach'/'investigate' (chrome) from its F.1 subject, real content overlap survives via 'governance' and 'thread' (non-chrome), so it still blocks on HEAD, exactly as RESEARCH Finding 5 and the 357-06 dogfood label sheet predicted. No plan-08 ruling was needed to make this plan's own acceptance criteria pass; the case is left exactly as the navigator will rule on it."

requirements-completed: [GATE357-04, GATE357-05]

# Metrics
duration: 80min
completed: 2026-09-23
---

# Phase 357 Plan 07: Runtime Fixes (D-07 Harness Class, D-08a F.1 Chrome Strip) Summary

**Lands both cited deterministic fixes (D-07/R-A harness-source classification in turn-text.cjs, D-08a/R-F F.1 dial-chrome stripping in gate-relevance.cjs) as TDD RED-then-GREEN commits, taking the full 60-entry corpus replay on HEAD from 13 false_blocks to 0, with 0 new_misses and 0 CLI/MCP parity mismatches.**

## Performance

- **Duration:** ~80 min
- **PLAN_BASE:** `712a63575c40d54df474338d67441f57e576b16a`
- **Task 1 commit:** `a05ef931c` (fix)
- **Task 2 commit:** `f6999ed53` (fix)
- **Tasks:** 2/2 completed
- **Files modified:** 5 (3 created: 2 test files + this summary; 3 runtime files modified: turn-text.cjs, check-card-fire.cjs, gate-relevance.cjs)

## Accomplishments

- `lib/hmi/turn-text.cjs`: `classifyPrecedingUserContentSource(content, rec)` grows a `'harness'` source class behind a byte-identical 1-arg contract (verified against the exact test-209 Behavior 14 assertions). `HARNESS_LEADS` (frozen, exported) holds `<task-notification`, `[Cross-session idle notice]`, and the measured 40-char peer-framing prefix. `readTurnText` tracks each role:user record's `isMeta`/`origin.kind` and the previous record's human-upstream status, threading `preceding_user_is_meta` through to `readTranscriptTurn`.
- `scripts/check-card-fire.cjs`: the PRIMARY-path synthetic guard (`:683`) now reads `t.preceding_user_text_source === 'tool_result' || t.preceding_user_text_source === 'harness'`. The stale comment at `:1332-1334` (which said a task-notification "classifies as typed and falls straight through") is corrected to describe the new harness class. `preceding_user_is_meta` threads through `readTranscriptTurn` and `deriveTurnSignals` with the same direct-field-wins precedence as every other signal. Diff size: 8 non-comment changed lines (cap was 12).
- `lib/core/gate-relevance.cjs`: `F1_DIAL_CHROME_TOKENS` (frozen Set, 22 tokens, exported) extends the `GATE_BOILERPLATE_TOKENS` precedent (893cee043) to F.1's own static dial chrome, derived from `lib/hmi/dial-presenter.cjs`'s literal template strings only, never from frequency. `gateSubjectTokens` strips it on the GATE side only (same asymmetric rule as boilerplate). `GATE_BOILERPLATE_TOKENS`, `subjectTokens`, `gateAlreadyAnswered`, `extractOptionLabels`, `isYesNoShapedGate` stay byte-identical; `subjectTokens` and `GATE_BOILERPLATE_TOKENS` are now additionally exported.
- `tests/test-357-harness-source.cjs` (10 behaviors, 260 lines): the 1-arg contract, both harness rules (isMeta+carve-out, origin-gated leading tag), the V3 carve-out proven end-to-end via `readTurnText` on real mkdtemp transcripts, `classifyCardFire` parity (harness passes synthetic, typed still force-fires), and a live subprocess replay leg against the real corpus (`--surface both --only <ids>`, 0 parity mismatches).
- `tests/test-357-f1-chrome.cjs` (12 behaviors, 285 lines): chrome-only overlap now reads irrelevant, real content overlap still relevant, the R-C shape still relevant, an all-chrome subject still conservative-relevant, the F.8 boilerplate floor unaffected, a drift leg (an independently-authored `DIAL_STATIC_LITERALS` copy, re-derived via the exported `subjectTokens`, deep-equals `F1_DIAL_CHROME_TOKENS`), `renderDial` exercised across `mode_a`/`mode_b`/`tier_0` (every rendered token is chrome, the context label, or the supplied row label), and a live subprocess replay leg (live-2026-09-23-02 OK, every 238 Half B `:s2`/`:s3` entry still blocks, 0 parity mismatches).
- Full corpus replay on HEAD (`node scripts/replay-card-fire.cjs --surface both --json`): **false_blocks: 0** (was 13), **new_misses: 0**, **known_misses: 1** (`debug-intern-w1-prose-fork`, unaffected, exactly as before), **parity_mismatches: 0**. Per-source breakdown: 238 = 18/18 OK, debug = 15 OK + 1 known-miss, live = 2/2 OK, dogfood = 24/24 OK (including the R-C case, `dogfood-0f86dd63-092046`, which correctly stays blocked).
- `node scripts/replay-card-fire.cjs --surface both --source live` exits **0** (both live entries OK on HEAD).

## Task Commits

Each task was committed atomically:

1. **Task 1: D-07 (R-A) harness source class in turn-text and the check-card-fire PRIMARY guard** - `a05ef931c` (fix)
2. **Task 2: D-08a (R-F) F.1 dial chrome strip in gate-relevance, with a renderer drift test** - `f6999ed53` (fix)

**Plan metadata:** (this commit, docs: complete plan)

_Both tasks were `tdd="true"`: test file written first and confirmed RED against the pre-fix code, then the runtime fix landed and confirmed GREEN, all inside a single atomic commit per task (test + implementation together), matching the plan's own action-step wording ("Run it and record that the new-behavior legs fail before the change (RED)" then "Run the new test (GREEN)")._

## Files Created/Modified

- `lib/hmi/turn-text.cjs` - `HARNESS_LEADS`, `classifyPrecedingUserContentSourceBase` (the original 1-arg body, unchanged), `classifyPrecedingUserContentSource(content, rec)` (the R-A extension), `readTurnText` (isMeta/originKind tracking, `preceding_user_is_meta`), `readTranscriptTurn` (passthrough), exports
- `scripts/check-card-fire.cjs` - the PRIMARY guard condition, the stale comment at `:1332-1334`, `readTranscriptTurn` (passthrough), `deriveTurnSignals` (`preceding_user_is_meta` threading)
- `lib/core/gate-relevance.cjs` - `F1_DIAL_CHROME_TOKENS`, `gateSubjectTokens` (the extra strip), exports (`subjectTokens`, `GATE_BOILERPLATE_TOKENS`, `F1_DIAL_CHROME_TOKENS` now additive-exported)
- `tests/test-357-harness-source.cjs` - new, 10 behaviors, GATE357-04
- `tests/test-357-f1-chrome.cjs` - new, 12 behaviors, GATE357-05

## Decisions Made

See `key-decisions` in the frontmatter. In addition:

- The peer-prefix measurement script ran as an inline `node` script against `~/.cache/mindrian-dev/357-raw/` from the session scratchpad (never committed to the repo), per the plan's own instruction. Output: 30 peer records found across the 4 sessions, longest common prefix 40 characters.
- The `DIAL_STATIC_LITERALS` list in `tests/test-357-f1-chrome.cjs` is a SEPARATE, independently-typed copy from `lib/hmi/dial-presenter.cjs`'s actual constants (not a `require` of the module's internal literals, which aren't exported) - this is the load-bearing drift-detection property: if a future renderer edit changes any of these literals without updating the test's copy, Behavior F.1 (verbatim presence check) fails first, and if the literal changes without the token set changing, Behavior F.2 (the deep-equal) fails.
- `renderDial`'s per-row label was supplied via `reach.command_slug` (bypassing `composeLabel`'s template-family lookup entirely) to keep the drift/chrome-subset test self-contained and independent of the dial-label-composer's own template corpus - this is Claude's Discretion per the plan (internal test layout), not a runtime code change.

## Deviations from Plan

None (Rule 1-4 sense) - plan executed exactly as written, both fixes land exactly the cited direction (D-07/R-A structural harness classification; D-08a/R-F literal-derived chrome strip), and no architectural change, blocking issue, or missing-functionality gap was found during execution.

One clarification, not a deviation: the plan's Task 1 action step 1 corpus-leg check names 4 "OK" ids and 2 "block" ids to verify DURING RED (i.e., before the fix, confirming the fixtures reproduce the pre-fix defect); `tests/test-357-harness-source.cjs`'s Behavior 8 runs that same check as a standing GREEN assertion (post-fix, the 4 ids now correctly read OK and the 2 carve-out ids correctly still block) - this is the intended post-landing shape of that same corpus-leg check, not a scope change.

## Known Stubs

None. Both fixes are complete, load-bearing runtime code with no placeholder values, no hardcoded empty returns reaching the classification/relevance paths, and no deferred wiring.

## HEAD-vs-Pre-Phase Class Change List (SPEC R4/R5, T-357-20)

`node scripts/replay-card-fire.cjs --code-root pre-phase --surface both --json` vs `node scripts/replay-card-fire.cjs --surface both --json` (HEAD): **13 entries changed class**, every one of them a pre-phase-labeled-`pass` entry flipping `block` (pre-phase) -> `pass` (HEAD). **Zero** block-labeled entries changed class (the required invariant, verified programmatically, not just spot-checked):

| id | pre-phase cli class | HEAD cli class | expected_verdict_class |
|----|---------------------|-----------------|-------------------------|
| debug-room-bind-task-notification | block | pass | pass |
| debug-harness-peer-after-tool-result | block | pass | pass |
| debug-harness-idle-notice | block | pass | pass |
| live-2026-09-23-01 | block | pass | pass |
| live-2026-09-23-02 | block | pass | pass |
| dogfood-0208790f-091452 | block | pass | pass |
| dogfood-0208790f-092655 | block | pass | pass |
| dogfood-0f86dd63-065920 | block | pass | pass |
| dogfood-0f86dd63-070027 | block | pass | pass |
| dogfood-0f86dd63-093356 | block | pass | pass |
| dogfood-21829408-092938 | block | pass | pass |
| dogfood-21829408-093038 | block | pass | pass |
| dogfood-21829408-093053 | block | pass | pass |

**Remaining FALSE_BLOCK ids: none.** `dogfood-0f86dd63-092046` (the R-C case, RESEARCH Open Question 2 / CONTEXT R-C) did NOT change class - it was OK (correctly block) before this plan and remains OK (correctly block) after, exactly as the 357-06 dogfood label sheet's own analysis predicted (overlap survives on the non-chrome content tokens `governance`/`thread` even after `prior` is stripped as chrome). This plan's own acceptance bar (0 false_blocks, 0 new_misses) is met without needing the plan-08 navigator ruling on R-C; the ruling on whether R-C's *label* should change from `block` to `known_false_block` remains squarely plan-08's job, per the plan's own scope note.

## Regression Suite Counts (Before -> After This Plan)

- `node tests/test-card-fire-relevance-gate.cjs`: **6 passed, 5 failed** before this plan (pre-existing, "expected until plan 210-05 lands", R-J) -> **6 passed, 5 failed** after (unchanged, no worse).
- `node tests/test-209-primary-sidechannel.cjs`: 36/36 before -> 36/36 after.
- `node tests/test-238-card-fire-corpus.cjs`: 32/32 before -> 32/32 after.
- `node tests/test-198-stop-gate-retry-ceiling.test.cjs`: 15/15 before -> 15/15 after.

## Verification Results

- `node tests/test-357-harness-source.cjs && node tests/test-357-f1-chrome.cjs && node tests/test-209-primary-sidechannel.cjs && node tests/test-238-card-fire-corpus.cjs && node tests/test-198-stop-gate-retry-ceiling.test.cjs` - all exit 0.
- `node scripts/replay-card-fire.cjs --surface both --source live` - exit 0, both live entries OK.
- `! grep -rn "api.typesafe.ai" lib/ hooks/` - clean.
- `git diff --name-only 712a63575c40d54df474338d67441f57e576b16a..HEAD | grep -E '(lib/mcp/brain-router|lib/core/write-lock|lib/core/part8-egress-guard|scripts/doctor|lib/core/graph-ops|scripts/eval-icm-writers|tests/test-353-grader-agreement|tests/test-353-ledger-shape|lib/core/navigation)\.cjs$|docs/OPEN-HANDOFFS\.md$'` - prints nothing (protected files untouched).
- `grep -v '^\s*//' lib/hmi/turn-text.cjs | grep -c "agent-message\|cross-session-message\|SYSTEM NOTIFICATION"` - 0 (R-A dropped tags absent).
- `grep -v '^\s*//' scripts/check-card-fire.cjs | grep -c "=== 'harness'"` - 1 (exactly one live match site).
- `node -e` 1-arg contract check - exits 0 (`typed,tool_result,none,none`).
- `git diff $PLAN_BASE -- scripts/check-card-fire.cjs` non-comment changed-line count - 8 (cap 12).
- `node -e` `F1_DIAL_CHROME_TOKENS` frozen-Set / no-frequency-extras / has-gate check - exits 0.
- `git diff $PLAN_BASE -- lib/core/gate-relevance.cjs` - `GATE_BOILERPLATE_TOKENS` literal count 0 (untouched).
- `grep -v '^\s*//' lib/core/gate-relevance.cjs | grep -c "zero-option\|labels.length === 0"` - 1, matching the pre-plan count exactly (D-08: no zero-option-labels rule added).
- Em-dash guard (`grep -c $'\xe2\x80\x94'`) - 0 on all 5 touched files.
- Full corpus replay on HEAD - `false_blocks:0 new_misses:0 known_misses:1 parity_mismatches:0`.
- Post-commit deletion check on both commits (`git diff --diff-filter=D --name-only`) - empty both times.

## Issues Encountered

None. Both fixes landed exactly as researched and ruled (D-07/R-A, D-08a/R-F), with no unexpected corpus regressions, no architectural forks, and no protected-file collisions with concurrent peer sessions on the shared tree (verified before each edit via `git status --short` on the exact target paths, and after each commit via the protected-file diff check).

## User Setup Required

None - no external service configuration, no secrets, no network egress (both fixes are pure local string/structural logic; every replay spawn ran under a fetch-thrower NODE_OPTIONS preload and NET_ATTEMPTS was asserted 0 in both test files).

## Next Phase Readiness

- Plan 08 (the human checkpoint, `357-JEV-LABEL-REPORT.md` + dogfood label ratification) can proceed: the R-C case's structural behavior on HEAD is now settled (still blocks) and independently confirmed against the shipped `F1_DIAL_CHROME_TOKENS` set, so the navigator's ruling on its *label* is a pure judgment call, not blocked on any further code change.
- Plan 09 (baseline.json, standing-gate wiring, the mutation leg) can now write `baseline.json` against a HEAD that legitimately reports `false_blocks:0` - this plan's own commits (`a05ef931c`, `f6999ed53`) are the exact two commits the mutation leg is expected to revert-and-recheck.
- Plan 10 (Larry prose shrink, manifest regen, D-17 filing, requirement closure) is unblocked: GATE357-04 and GATE357-05 are both satisfied per the acceptance criteria above.
- Per this plan's own scope contract (orchestrator owns shared state), no `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` write was made; `requirements-completed: [GATE357-04, GATE357-05]` is recorded in this file's frontmatter for the orchestrator to apply.

---
*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Plan: 07*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 5 touched files verified present on disk with the expected content (`lib/hmi/turn-text.cjs`, `scripts/check-card-fire.cjs`, `lib/core/gate-relevance.cjs`, `tests/test-357-harness-source.cjs`, `tests/test-357-f1-chrome.cjs`). Both commits (`a05ef931c` Task 1, `f6999ed53` Task 2) verified present in `git log --oneline`. Both new test files verified passing standalone (`node tests/test-357-harness-source.cjs` -> PASS 10/10; `node tests/test-357-f1-chrome.cjs` -> PASS 12/12). Full corpus replay on HEAD verified `false_blocks:0 new_misses:0 parity_mismatches:0`. No missing items.
