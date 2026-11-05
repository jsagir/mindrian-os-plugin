---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
plan: 07
subsystem: voice
tags: [card-copy, second-person, reply-length, shadow-row, harness-policy, changelog]

requires:
  - phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
    provides: RED tests C1 to C5 and V1 to V7 (plan 02), card copy doctrine line and C4 green (plan 06)
provides:
  - findThirdPersonNavigator, checkReplyLength, REPLY_SENTENCE_LIMIT, LENGTH_EXEMPT_RE in lib/hmi/larry-reply-checks.cjs
  - mode card text that speaks to the person
  - Rule 5 (policy_id voice-length) in scripts/check-voice-style.cjs, shadow mode
  - data/harness-policies/voice-length.json at rung declared
affects: [383-08, 383-11]

tech-stack:
  added: []
  patterns:
    - "A new Stop-hook measurement reuses the existing voice observer and the reply-check module (Canon Part 7); the row holds counts only"

key-files:
  created:
    - data/harness-policies/voice-length.json
  modified:
    - lib/hmi/larry-reply-checks.cjs
    - scripts/session-start
    - scripts/check-voice-style.cjs
    - tests/test-359-prose-budget.cjs
    - data/harness-manifest.json
    - CHANGELOG.md

key-decisions:
  - "Reply length is a shadow row only: logged as sentences=N, limit=8, never blocked. Promotion is a human edit after a reviewed window."
  - "The corpus figure cited in the policy notes and the CHANGELOG is the measured line: CORPUS over8=9 of 98."
  - "agents/larry-extended.md is untouched: C4 was already green from plan 06, so the 17 B headroom is intact."

requirements-completed: [QA383-07, QA383-09]

duration: not timed (start not recorded)
completed: 2026-11-05
---

# Phase 383 Plan 07: Card copy lint and the reply-length shadow row Summary

**Two pure checks join the reply-check module (third-person card copy, and reply length with a list/plan/full-answer exemption), the mode card now speaks to "you", and every Stop turn logs a count-only `voice-length` shadow row under a declared harness policy.**

## Accomplishments

- `findThirdPersonNavigator(text)`: every "the navigator", "the user" or "the founder" is a hit `{kind: 'third_person_navigator', term}`. Pure, never throws.
- `checkReplyLength(text, ctx)`: `countSentences` with `skipIdentityLine`; limit 8; exempt when the user text matches `LENGTH_EXEMPT_RE` ("just tell me", "the full answer", "give me a list", and the rest of the plan list). Verdict carries `fields {sentences, limit, exempt}`.
- `scripts/session-start`: MODE_MENU and the cold-start line say "when the reply is talk instead of a pick". `Just Talk`, `AskUserQuestion` and `SEED-021` are kept. C3 printed no hit (16 static card strings scanned), so no other label needed a rewrite.
- `scripts/check-voice-style.cjs` Rule 5: own try/catch, one row `voice-length` with `detail: sentences=N, limit=8` and the session id. No reply text, no user text (T-383-12). Header comment names the rule as shadow mode.
- `data/harness-policies/voice-length.json`: kind voice, rung declared, runner scripts/check-voice-style.cjs, pinned by tests/test-383-voice-length.cjs. Manifest regenerated (19 policies digested).
- CHANGELOG.md: one bullet in the Unreleased Added block (it replaced the empty `- ` placeholder), ends with "Not live until a release carries it.", cites 9 of 98 example replies.

## Task Commits

1. Task 1: detectors and mode card text - `f60d83947`
2. Task 2: Rule 5, policy file, manifest - `5c740b42d`
3. CHANGELOG bullet (alone, `git commit --only`) - `010a27b9e`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The session-start pin of the prose-budget test moved**
- **Found during:** Task 1 (test-359-prose-budget B5 "session-start outside the doctrine line is byte-untouched" failed after the MODE_MENU edit)
- **Fix:** re-based `SESSION_START_OUTSIDE_DOCTRINE` in tests/test-359-prose-budget.cjs with a dated comment (was f685765b084a...4447, now c7a69e82ab28...58ecdbf4). The NAV_CARD_FIRE_DOCTRINE line is unchanged.
- **Commit:** `f60d83947`

None other. The `LARRY_OUTSIDE_GATES` pin did not move (larry-extended untouched).

## Verification (measured in this run)

- `node tests/test-383-card-second-person.cjs`: exit 0, PASS 5 FAIL 0 PENDING 0.
- `node tests/test-383-voice-length.cjs`: exit 0, PASS 7 FAIL 0 PENDING 0; the test prints `CORPUS over8=9 of 98`.
- `agents/larry-extended.md`: 15327 B whole file (untouched this plan; body 12,735 B as recorded by plan 06, cap 12,752 B). test-3696-voice-first-budget exit 0; test-3696-operation-doctrine 25/25; test-359-prose-budget 18/18.
- Exit 0: test-3696-reply-checks (143/143), test-3696-mod-voice, test-3696-rubric-eval, test-209-session-start-exemplar, test-session-start-banner, test-383-no-room-routing, test-3696-voice-log-denominator, test-platform, test-startup-flows, test-369-hook-require-graph, test-251-skeleton-split, test-3696-persona-drift, test-143.2-doctrine-presence, test-3696-one-next-move, test-209-card-fire-gate, test-359-declared-arm, test-298-policies-schema (8/8), `bash -n scripts/session-start`.
- `node scripts/run-harness.cjs --check` exit 0; lists `voice-length  declared  declared rung: report only, not spawned`.
- `node scripts/check-hook-schema-compatibility.cjs` exit 0.
- Gates, all exit 0: build-connector-registry --check, build-orchestration-projection --check, check-render-coverage, build-harness-manifest --check, build-skill-mirrors --check.
- `node tests/test-card-fire-relevance-gate.cjs`: 6 passed, 5 failed, the baseline.
- No em-dash or en-dash in the added CHANGELOG line or in any file written by this plan.
- Run-all results: see the final report (run-all-3696 and run-all-383 lines are quoted there).

## Known Stubs

None.

## Threat Flags

None. T-383-12 mitigated (row holds counts only; V6 asserts no reply text in any field). T-383-13 mitigated (Rule 5 in its own try/catch; every path still ends in silentSuccess). T-383-06 accepted (local file only).

## UNVERIFIED

- Live rate of over-length turns in a real session (needs the voice log after the plan 383-11 retest).
- Desktop and Cowork rows: no Stop hook there [ASSUMED]; no measurement on those surfaces.
- test-298-contract-parity clean-tree leg fails while the other session has Phase 384 files modified (tests/test-384-perf-harness.cjs, tools/perf/); same cause as plans 05 and 06, not fixed here.

## Self-Check: PASSED

- FOUND commits: f60d83947, 5c740b42d, 010a27b9e.
- FOUND file: data/harness-policies/voice-length.json.
