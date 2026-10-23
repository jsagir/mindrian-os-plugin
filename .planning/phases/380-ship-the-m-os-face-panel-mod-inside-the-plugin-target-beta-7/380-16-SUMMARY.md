---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 16
completed: 2026-10-24
requirements: [MOD380-03, MOD380-08]
---

# Plan 380-16 Summary: the sent line (G1, G3) and the Job line (G4)

Statement: Implementation complete; visual verification pending (plan 10 captures the sent line on a real screen).

## Commits (release tree /home/jsagi/dev/MindrianOS-Plugin-release, main, not pushed)

| Step | Commit | Subject |
|------|--------|---------|
| RED | d4dea1c8a | test(380-16): RED tests for the sent line, the left-out words and the Job line rule, contract stub |
| GREEN | 8860d3cd2 | feat(380-16): one honest sent line, a new ask clears the old one, left-out words by kind |
| Dist | d1c7bc205 | build(380-16): dist rebuilt for the sent line |

Branch tree (/home/jsagi/dev/MindrianOS-Plugin): 44201b73a (G4 facts, RED evidence), b62352235 (book proposal, green evidence), plus the commit of this review and summary.

## RED (before the fix)

380-16-evidence/red-sent.txt: 193 pass, 16 fail. Failing: S2, S2p, S3, S3p, S4, S4p, S8, S7, S9 to S11d (not implemented), J7 (the new hint). Passing by design: S1, S5, S6, S6b, S6c (edge pins), J1 to J6, the 34 tests of panel.test.tsx and all earlier tests.
GREEN: 380-16-evidence/green-sent.txt: 209 pass, 0 fail. A first green attempt under load (other sessions, load average above 20) timed out on 7 unrelated tests: kept as green-sent-loaded-attempt.txt; the rerun alone at load under 4 passed. No timeout was raised.

## Measured missing-tool shape (PROVEN)

A call to a tool that is not in the session makes the engine THROW: `$.tool.call: no tool named "<tool>" in this session` (380-16-evidence/probe-missing-tool.txt; scratch HOME, scratch config, login by symlink). The plan guessed a returned isError.

## G1 root cause (PROVEN)

hooks/advice.ts (code before this plan), askTheo loop: the `catch` path set `wentOut = words` (old line 413) and the non-error path set it before the isError check (old lines 366 to 369), while a denied call set only the note. The shim (missing tool, thrown) therefore kept the excerpt, and the raw call (denied) then wrote "Theo was not asked: the call was not allowed". The render (hooks/register.tsx old lines 1301 to 1316) drew the failed note and the sent row independently, so both showed (shots real-8, real-9). Second defect: runAdvice set status asking with a spread of the old advice, so the old sent row stayed in flight (old line 508).
Fix: every call is classified (outcomeOf), deliveryOf decides one Delivery from all calls, the render reads one SentRow, and the ask start clears sent and delivery.

Deviation from the plan text: the plan said a thrown missing tool is treated as failed. A message that proves the call was never dispatched is classified unavailable instead, because "may have been received" would be false. Other throws are failed. Recorded in 380-16-G4-FACTS.md.
Deviation: a throwing `tool:` handler in the test world is skipped by the engine, so S2, S3, S4 drive askTheo with a fake engine and S2p, S3p, S4p use returned shapes on the pane.
Deviation: the stub commit also touched advice.ts, register.tsx and types/index.d.ts (a delivery field with value none, stubs of sanitizeNoted and wordsForNoted) so the stub type-checks and the test file loads. Behavior unchanged.
Deviation: the Job hint test J7 is RED by owner decision, so the RED verify rule "J1 to J6 pass, no fail in job-guess.test.ts" holds for J1 to J6 only.

## G3 cause

hooks/advice.ts line 195 (old) removes any token of 28 or more characters, so a folder such as eureka-engine-harvest-2026-10-19 (32 characters) is removed and the stem reads "About the ' ' section". The "(a name) / " part of the shot was REPRODUCED: with the known names that runAdvice builds, a section word equal to a known name (a part of the room slug) is replaced by "(a name)" (scratch run: known ['market-analysis-room'] gives "About the '(a name) / sizing' section"). Fix: the sent row names the kind (left out: a long name, a name). The wire text is unchanged (S9).

## G4 verdict

BY DESIGN. hooks/job.ts line 159 (at least 2 distinct cues of one job with a strict lead; plan 14 J3); input recentUser from register.tsx line 834, call at line 309. Two real prompts hold no cue. Pinned by J1 to J6. Owner decision (card, 2026-10-24): the rule stays; only the hint changed to: "Job: no guess yet. Say what you want to decide, test or find, in two different phrases, and one may come." (J7). Facts and options: 380-16-G4-FACTS.md.
NEEDS_HUMAN (answered B by the card; kept as the record): Keep the Job line rule as designed (2 distinct cues) and approve the reworded hint (option B), or add the open section as a second cue source (option C)?

## Review

380-16-REVIEW.md: Approve, no critical or major finding. Five minor items, two questions (book wording of an edge; does the engine time out a hung tool call).

## Verification

- node ui/mos-face/scripts/typecheck.cjs: exit 0.
- claude plugin test in ui/mos-face: 209 pass, 0 fail (34 tests in panel.test.tsx). One run under load timed out once on C1 rest; the rerun alone passed.
- node tests/test-380-egress.cjs 29 passed; test-380-budget.cjs 11 passed; test-380-copy.cjs 37 passed; test-380-build.cjs 115 passed; build-mos-face.cjs --check fresh (hash 6a2a5a624ab319c0).
- bash tests/run-all-380.sh: PASSED=19 FAILED=0.

## Claims

- PROVEN: missing-tool shape; G1 cause; G3 cause and reproduction; G4 rule and verdict; wire text byte equal on six texts.
- UNVERIFIED: the returned "No such tool available" shape; the sent line on a real screen (plan 10); whether the engine times out a hung call.
- PREFERENCE: the wording of the unsure row.

## Canon

mos-brand book e947a5d, segments/experience/terminal/entries/2026-10-20/GUIDE.md (status proposed): Rules that hold everywhere, Priority order (honesty above usability and brand), Side panel template (One signal). Proposal P16-1 in 380-16-BOOK-PROPOSALS.md. Skills: typescript-pro (no any, no enum, exhaustive unions), test-master (RED first, specific assertions), code-reviewer.

## Not done

No push. STATE.md and ROADMAP.md not edited. Plans 17 and 18 not started.
