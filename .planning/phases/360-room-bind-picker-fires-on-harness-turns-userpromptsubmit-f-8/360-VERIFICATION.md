---
phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
verified: 2026-09-24T12:06:53Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 360: Room-bind picker fires on harness turns (UserPromptSubmit F.8) Verification Report

**Phase Goal:** The UserPromptSubmit room-bind picker (F.8) fires only on human-originated turns: in a
replay of the four snapshot sessions, harness-triggered picker fires go from 33 to 0 while
human-triggered fires stay at 2. Amendments R10/R11 add a cwd-outside-rooms-home suppression and a
"dev repo / no room" session-memory suppression.

**Verified:** 2026-09-24T12:06:53Z
**Status:** passed
**Re-verification:** No, initial verification

All commands were re-run independently in this session against the live repo (no reliance on SUMMARY
narration or cached results).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Harness turns emit no room-resolution output and write no side channel/trace/marker (BIND360-01) | VERIFIED | `scripts/intent-classifier.cjs:550` `if (TURN_IS_HARNESS) return 0;` sits directly after `if (!message) return 0;`, before the strict-mode override, zero-score gate, F.8 gate and legacy advisory. `node tests/test-360-harness-picker.cjs` r1 legs (34 of 45 checks) all `ok`, including every harness shape suppressing and the human/control legs firing. |
| 2 | Harness turns never consume a pending binding answer (BIND360-02) | VERIFIED | `scripts/intent-classifier.cjs:3665` wraps `consumePriorBindingAnswer(...)` in `if (!TURN_IS_HARNESS)`. `r2-sequence` check in test-360-harness-picker.cjs passes (spy count 0 on harness turn, following human label binds). |
| 3 | Human turns keep byte-identical behavior; R3 suites and wider net do not regress (BIND360-03) | VERIFIED | `node tests/test-360-r3-suites.cjs` -> `PASS test-360-r3-suites.cjs (18 suites)` (all ok), covering the six named R3 suites plus the four MCP room-bind suites plus 8 wider suites. `r3-*` legs in test-360-harness-picker.cjs (6/6) all ok. |
| 4 | One shared classifier; no harness-lead literal or isMeta/origin read in intent-classifier.cjs (BIND360-04) | VERIFIED | `grep -n "isMeta\|<task-notification\|<agent-message\|<cross-session-message\|Cross-session idle\|Another Claude session sent" scripts/intent-classifier.cjs` returns 0 hits. `grep -n "TURN_IS_HARNESS\|harnessVerdict" scripts/intent-classifier.cjs` shows it calls `tt.classifyUserPromptText(text)` from `lib/hmi/turn-text.cjs`. `node tests/test-360-tripwire.cjs` r4a-d all ok. |
| 5 | HARNESS_LEADS covers all 5 SPEC R5 shapes; mid-text quote stays non-harness; 357 replay stays green (BIND360-05) | VERIFIED | `lib/hmi/turn-text.cjs:119-125` `HARNESS_LEADS` is a frozen 5-entry array (`<task-notification`, `[Cross-session idle notice]`, `Another Claude session sent a message`, `<agent-message`, `<cross-session-message`). `node tests/test-360-leads.cjs` -> `PASS (26 checks)`. `bash tests/run-all-357.sh` -> `PASS=16 FAIL=0 SKIP=0`. |
| 6 | A classifier/policy fault fails toward human path, exit 0 (BIND360-06) | VERIFIED | `r6-*` legs (4) in test-360-harness-picker.cjs all ok (throwing/missing export, human path unchanged, exit 0); `fault-throwing-picker-policy` in test-360-picker-policy.cjs ok. |
| 7 | Local snapshot replay: harness 33->0, human 2->2 (BIND360-07) | VERIFIED (local-only) | `node tests/test-360-snapshot-replay.cjs` run live against `~/.cache/mindrian-dev/357-raw/`: prints `layer h: post harness unbound fires is 0 (got 0)`, `layer h: post human unbound fires is 2 (got 2)`, `layer h: 0 human-attributed runs carry a harness verdict (got 0)`. Exit 0 (PASS). |
| 8 | Committed fixtures are sanitized placeholders; no raw snapshot content committed (BIND360-08) | VERIFIED | `tests/test-360-tripwire.cjs` r8a-e (5/5) all ok. `git ls-files \| grep -i '357-raw\|.cache/mindrian'` returns nothing. No new `.jsonl` added by any of 360's 17 commits (`git show --name-only` across all 360-tagged commits, filtered for `.jsonl$`, 0 hits). `cases.json` carries a `sanitization_statement` and placeholder names (`sample-session-a`/`sample-room`/`sample-peer`-style, `copper-ledger`/`tin-orchard`/`quantum-bakery`). |
| 9 | Tri-Polar parity: no lib/mcp/ path in 360's own commits; MCP room-bind suites green (BIND360-09) | VERIFIED | `git log --grep='(360-' --format=%H` (17 commits) -> `git show --name-only` on each, filtered for `^lib/mcp/`, 0 hits. Note: a raw `PLAN_BASE..HEAD` diff DOES show 6 changed `lib/mcp/` files from 9 unrelated peer commits on this shared tree (verified directly) -- the requirement is scoped to 360's own commits, which is what was checked and holds. `test-360-r3-suites.cjs` includes the 4 MCP room-bind suites, all ok. |
| 10 | Cwd-outside-rooms-home suppression; ancestor/missing/relative/nonexistent still fire (BIND360-10, R10) | VERIFIED | `lib/core/room-bind-picker-policy.cjs` `cwdRoomsHomeVerdict` implements inside/outside/ancestor/unresolvable per spec. `node tests/test-360-picker-policy.cjs` r10 legs (10 of 34) all ok, including `r10-ancestor` (still fires, P-1) and `r10-harness-inside` (harness guard wins independently). Snapshot replay layer c: `human post fires after the cwd rule is 0`, `the anchor session has 0 human post fires`. |
| 11 | "Dev repo / no room" answer remembered per session_id; new session asks again; explicit rebind restores gating (BIND360-11, R11) | VERIFIED | `node tests/test-360-picker-policy.cjs` r11 legs (3/3) ok: `r11-typed-remembered`, `r11-after-zero-score-remembered`, `r11-explicit-rebind-restores-gating`. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/intent-classifier.cjs` | Harness guard (D-06/D-07), consumer guard (D-08), cwd/no-room guard (N-1/N-2) | VERIFIED | `TURN_IS_HARNESS` computed at module init (line 445), single early guard at line 550, consumer guard at line 3665, `unboundPickerSuppressed` guard at line 573. All read directly, matching SUMMARY claims. |
| `lib/hmi/turn-text.cjs` | Widened `HARNESS_LEADS` (5 entries), `classifyUserPromptText` export | VERIFIED | Lines 96-125 (leads), 250-256 (`classifyUserPromptText`), 407-416 (module.exports includes both). |
| `lib/core/room-bind-picker-policy.cjs` | `cwdRoomsHomeVerdict`, `unboundPickerSuppression`, no throw, no new store | VERIFIED | File exists, reads as described; composes `room-path-containment.cjs` and `session-binding.cjs`'s `NO_ROOM_SLUG` (reuse, not re-typed). |
| `tests/test-360-leads.cjs` | 26 unit legs | VERIFIED (run live) | `PASS test-360-leads.cjs (26 checks)`. |
| `tests/test-360-harness-picker.cjs` | 45 spawn-level checks (r1/r2/r3/r6) | VERIFIED (run live) | `PASS test-360-harness-picker.cjs (45 checks)`. |
| `tests/test-360-picker-policy.cjs` | 34 checks (r10/r11/fault) | VERIFIED (run live) | `PASS test-360-picker-policy.cjs (34 checks)`. |
| `tests/test-360-tripwire.cjs` | R4/R8/R9 static checks | VERIFIED (run live) | `PASS test-360-tripwire.cjs (11 checks)`. |
| `tests/test-360-snapshot-replay.cjs` | Local-only R7/R10 replay | VERIFIED (run live) | `PASS test-360-snapshot-replay.cjs (layer all)`, real local snapshot present and used. |
| `tests/test-360-r3-suites.cjs` | R3/MCP/wider suite compare | VERIFIED (run live) | `PASS test-360-r3-suites.cjs (18 suites)`. |
| `tests/run-all-360.sh` | Phase aggregator | VERIFIED (run live) | `Phase 360: PASS=8 FAIL=0 SKIP=0` (6 pre-declared legs + 357 compat leg + em-dash guard). |
| `tests/fixtures/ups-harness-360/cases.json` | Sanitized fixtures | VERIFIED | `sanitization_statement` present, placeholder names, no raw snapshot content. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `scripts/intent-classifier.cjs` main() | `lib/hmi/turn-text.cjs` | `harnessVerdict()` -> `require(...turn-text.cjs).classifyUserPromptText(text)` | WIRED | Direct read of lines 437-445; no local harness-lead literal or `isMeta` comparison anywhere in intent-classifier.cjs (confirmed by grep). |
| `scripts/intent-classifier.cjs` main() | `lib/core/room-bind-picker-policy.cjs` | `unboundPickerSuppressed()` -> `require(...room-bind-picker-policy.cjs).unboundPickerSuppression(...)` | WIRED | Lines 463-472; composes `session-binding.cjs` reader for the same session key the F.8 path already uses. |
| Guard placement | Room-resolution outputs | Single early return before strict-mode/zero-score/F.8/advisory | WIRED | Directly confirmed by reading lines 540-600: harness guard then cwd/no-room guard both precede `detectStrictMode` call and all downstream emitters. |
| `test-360-*` files | `scripts/intent-classifier.cjs` (live, not a copy) | `spawnSync` via `spawn-kit.cjs` | WIRED | Tests spawn the actual live classifier file; PASS results reflect the real runtime code, not a fixture stub. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BIND360-01 | 360-04, 360-07 | Harness turns emit no room-resolution output | SATISFIED | r1 legs pass; guard read directly in source |
| BIND360-02 | 360-04, 360-07 | Harness turns never consume binding answer | SATISFIED | r2-sequence passes; guard read directly |
| BIND360-03 | 360-01, 360-04, 360-07 | Human turns byte-identical; suites no worse | SATISFIED | r3 legs + 18-suite compare pass |
| BIND360-04 | 360-02, 360-06, 360-07 | One shared classifier, no local lead list/isMeta read | SATISFIED | grep confirms 0 hits; tripwire r4 passes |
| BIND360-05 | 360-03, 360-06 | HARNESS_LEADS covers all 5 shapes | SATISFIED | leads test passes (26/26); 357 replay green |
| BIND360-06 | 360-04, 360-05, 360-07 | Fault fails toward human path | SATISFIED | r6 legs + fault-throwing-picker-policy pass |
| BIND360-07 | 360-03, 360-06, 360-08 | Snapshot replay 33->0, 2->2 | SATISFIED | replay run live, matches exactly |
| BIND360-08 | 360-02, 360-08 | Sanitized fixtures, no raw content committed | SATISFIED | tripwire r8 passes; git ls-files clean |
| BIND360-09 | 360-01, 360-02, 360-08 | Tri-Polar: no lib/mcp/ in 360 commits | SATISFIED | grep over 17 360 commits, 0 hits |
| BIND360-10 | 360-03, 360-05, 360-07 | Cwd-outside suppression | SATISFIED | r10 legs pass; replay layer c matches |
| BIND360-11 | 360-05, 360-07 | No-room session memory | SATISFIED | r11 legs pass |

All 11 BIND360 requirements marked `[x]` in `.planning/REQUIREMENTS.md` are independently confirmed by
re-running the referenced test legs live, not by trusting the checkmarks.

### Anti-Patterns Found

None blocking. No `TBD`/`FIXME`/`XXX` markers in any 360-touched file (`scripts/intent-classifier.cjs`,
`lib/hmi/turn-text.cjs`, `lib/core/room-bind-picker-policy.cjs`, all `tests/test-360-*.cjs`,
`tests/run-all-360.sh`). One informational note carried from 360-02-SUMMARY.md: `r8d`'s peer-name leak
scan found 0 peer names to check against in the live snapshot (a known scan-coverage gap for a future
widening), but `r8b`/`r8c` already give full static coverage of the committed placeholders and `r8d` is
explicitly additive defense-in-depth, not the sole safety net -- not a blocker for this phase's goal.

### Human Verification Required

None. Every observable truth for this phase is a deterministic, scriptable behavior (hook stdout/stdin,
file writes, replay counts), and all of it was independently re-run and re-verified in this session
against the live repository and the real local snapshot.

### Gaps Summary

No gaps. All 11 BIND360 requirements, the roadmap goal's replay numbers (harness 33->0, human 2->2), and
the R10/R11 amendments were independently re-verified against live source and live test runs, not
SUMMARY claims. The one deviation from literal SPEC wording (BIND360-09's proof uses a `git log --grep`
scoped diff rather than a raw `PLAN_BASE..HEAD` diff) was checked directly: a raw diff over the shared
tree does show unrelated `lib/mcp/` changes from 9 peer commits, which would have produced a false
failure -- the scoped check is the correct one and it passes.

---

_Verified: 2026-09-24T12:06:53Z_
_Verifier: Claude (gsd-verifier)_
