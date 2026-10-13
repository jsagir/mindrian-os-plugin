---
phase: quick-261013-k1u
plan: "01"
subsystem: session-start hook (SEED-128 T14, T23)
tags: [sessionstart, hook-envelope, json, context-budget, seed-128]
requires: []
provides:
  - lib/core/session-context-envelope.cjs (sanitizeText, splitMarkedContext, buildEnvelope, BLOCK_POLICY, assembleContext, writeFullContext, emit CLI)
  - references/personality/session-start-doctrine.md
  - tests/test-k1u-session-start-envelope.cjs (buildFixture, runSessionStart exported)
affects: [scripts/session-start, tests/run-all-366.sh, CHANGELOG.md]
tech-stack:
  added: []
  patterns: [GS block markers in a bash-built context, Node JSON.stringify hook envelope, ranked budget assembly with a pointer file]
key-files:
  created:
    - lib/core/session-context-envelope.cjs
    - references/personality/session-start-doctrine.md
    - tests/test-k1u-session-start-envelope.cjs
  modified:
    - scripts/session-start
    - tests/run-all-366.sh
    - CHANGELOG.md
    - .planning/debug/sessionstart-blocks-first-prompt-windows-arm64.md
decisions:
  - "Inline budget 9,000 characters (JS string length), 1,000 below the Claude Code 2.1.296 limit of 10,000"
  - "NAV card-fire contract stays inline as a required block (orchestrator ruling); only the long doctrine moved behind a pointer"
  - "Full context saved to <room>/.mindrian/session-context.txt (else $HOME/.mindrian/session-context.txt) on every run"
  - "I-8 (literal backslash-n) recorded as T25, not fixed"
metrics:
  completed: 2026-10-13
  commits: 3
---

# Quick 261013-k1u: session-start room context reaches the model again

The session-start hook now prints valid JSON through a Node encoder, and the context fits a pinned 9,000-character budget. The Larry identity comes first, then the room identity and its stage. Long blocks (the Room Map, the EDGE lines, the long doctrine) go to files that the context names. A live Claude Code 2.1.296 run now inlines the context: 3 of 3 probes answered OK YES.

## Commits

| Task | Commit | Files |
|---|---|---|
| 1 (T14 valid JSON) | 01c0e5e0f | lib/core/session-context-envelope.cjs, scripts/session-start, tests/test-k1u-session-start-envelope.cjs, tests/run-all-366.sh, 261013-k1u-PLAN.md |
| 2 (T23 budget and pointers) | e3afaaca0 | scripts/session-start, lib/core/session-context-envelope.cjs, references/personality/session-start-doctrine.md, tests/test-k1u-session-start-envelope.cjs |
| 3 (docs and proof) | 1269bba43 | CHANGELOG.md, .planning/debug/sessionstart-blocks-first-prompt-windows-arm64.md, 261013-k1u-baseline.txt, 261013-k1u-suites-after.txt, 261013-k1u-live-probe.txt |

All 3 commits are ancestors of HEAD. Nothing is pushed.

## Suites (baseline 01c729151 vs after 1269bba43)

Env for both passes: HOME = <scratchpad>/k1u-home (fresh per suite), MINDRIAN_BRAIN_URL=http://127.0.0.1:9, MINDRIAN_BRAIN_KEY unset. No suite ran against the real HOME.

| Suite | Before | After |
|---|---|---|
| lib/memory/session-start-triple-injection.test.cjs | 1 | 1 |
| lib/memory/session-start-brain-staleness.test.cjs | 1 | 1 |
| lib/memory/post-compact-reinjection.test.cjs | 0 | 0 |
| tests/test-251-skeleton-split.cjs | 0 | 0 |
| tests/test-209-session-start-exemplar.cjs | 0 | 0 |
| tests/test-267-1-first-install-hooked-audit.cjs | 0 | 0 |
| tests/test-session-start-banner.cjs | 0 | 0 |
| tests/test-session-start-node-preflight.cjs | 0 | 0 |
| tests/test-install-state-record.cjs | 0 | 0 |
| tests/test-36925-injection.cjs | 0 | 0 |
| tests/test-36925-readiness-gate.cjs | 0 | 0 |
| tests/test-l8g-theo-bare.cjs | 1 | 1 |
| tests/test-hook-envelope-shape.cjs | 0 | 0 |
| tests/test-245-trigger-arms.cjs | 0 | 0 |
| tests/test-267-2-w0-revert.cjs | 0 | 0 |
| lib/memory/room-minto-hook.test.cjs | 0 | 0 |
| tests/test-198-adapter-budget.test.cjs | 0 | 0 |
| bash tests/run-all-251.sh | 0 | 0 |
| bash -n scripts/session-start | 0 | 0 |

Pre-existing reds (baseline): triple-injection Test 6 (wall time 15,014 ms against 2,500 ms; the 15 s spawnSync timeout with pipes held by background jobs, F6), brain-staleness Test 3 (same timeout), l8g-theo-bare A4.

Timing flake, recorded: in the full after pass (run while the live probes ran) triple-injection also failed Tests 7 and 9, and brain-staleness Tests 1 to 5, all with status null at the 15 s spawnSync timeout. A rerun on a quiet machine showed only the baseline set (triple Test 6; brain-staleness Test 3). A back-to-back run of the triple suite on a baseline copy and on HEAD failed only Test 6 in both. A 20-section probe with pipes took 22.5 / 28.9 / 22.7 s at baseline and 20.3 / 22.3 / 22.2 s at HEAD, so the change does not make the hook slower.

run-all-366 (LC_ALL=C, scratch HOME): before PASSED=71 FAILED=0 SKIPPED=1 KNOWN=1; after PASSED=72 FAILED=0 SKIPPED=1 KNOWN=1. The only verdict diff is the new leg ">>> k1u session-start envelope (valid JSON, inline budget): PASSED". SKIPPED (366 spike substrate prepare, ENV GAP) and KNOWN (pin 355 direction agreement) are unchanged.

doctor --acceptance (scratch HOME): before 19/24, failed ids activation-reached-the-wire, deployment-surfaces, install-state, session-start-active-version, version-of-record-published (all from the scratch HOME). The first after run read 18/24 with verify-release-clean-tree added, because CHANGELOG.md and the debug file were uncommitted at that time. A rerun on the clean tree after commit 3 reads 19/24 with the same 5 failed ids as the baseline.

## Inline length per tier and shape (large fixture 14 x 3, sealed room)

| Run | Inline chars | Full file chars | Shortened or left out |
|---|---|---|---|
| minimal | 8,855 | 16,518 | room memory, nudges, room state body |
| balanced | 8,962 | 21,885 | room memory, nudges, proactive, recent sessions, room state body, user context, learnings |
| rich | 8,958 | 24,462 | same as balanced |
| Cursor flat (minimal) | 8,891 | 17,498 | room memory, nudges, recent sessions, room state body |
| bash fallback (minimal) | 5,978 | none | C-locale cut at 8,500 bytes |
| cold first install | 4,886 | 5,058 | nothing |

Before (01c729151): rich 24,198 characters and invalid JSON ("Bad control character") in every room tier.

## Final caps

No tuning was necessary. The caps are the plan table values: room-focus 800, other-rooms 700, room-memory 2,800, opp-bank 400, returning-user 400, scratchpad 600, nudges 1,000, proactive 1,200 (EDGE lines dropped), recent-sessions 800, room-state body 1,200 (box lines dropped), user-context 600, learnings 500, ctx-budget 300, integrations 200, update-notice 300, unmarked 500. Room-state head at most 600. Pointer reserve 600 (widened per run when the Pointers block is longer). J4, J5, J7 of test-36925-injection and Tests 4, 5, 7 of the triple-injection suite stay green.

## Live proof (Claude Code 2.1.296, synthetic room)

| Probe | session-start N (debug "provided additionalContext") | Outcome | persisted-output | Answer |
|---|---|---|---|---|
| P1 head 'You are scoped to the room: venture' | 9,000 | success | 0 | OK YES |
| P2 former tail 'NAVIGATION CARD-FIRE CONTRACT' | 8,951 | success | 0 | OK YES |
| P3 pointer (Read of the full file, 'Proactive Room Intelligence') | 8,935 | success | 0 | OK YES |

P3 called Read on <fixture room>/.mindrian/session-context.txt. The coordinator hook has the same statusMessage "Loading room context..." and provided 649 to 855 characters separately. The scratch HOME with the credentials copy was deleted; 0 credentials copies remain in scratchpads.

## Added cost

One more node start per SessionStart: 25 to 37 ms on Linux for the encoder with a 3 KB plus 4 KB sample (5 runs). The planner calibrated 154 to 164 ms per node start on Windows ARM64.

## Deviations from Plan

1. [Orchestrator constraint] Commit 1 also carries 261013-k1u-PLAN.md (the orchestrator required the PLAN in the first commit), so it holds 5 files, not 4.
2. [Rule 1 - Bug] The fallback `tr` deletes CR as well (`tr -d '\000-\010\013-\037'`). The plan kept CR, but the T14 check requires no C0 character except LF and TAB in the parsed context, and sanitizeText also drops CR. The trailing line feeds are kept with a sentinel.
3. [Rule 1 - Bug, own test] The unit check "left out" first used a 2,100-character identity, which leaves 300 characters of room (a cut, not a leave-out). The fixture now uses 2,300 (100 characters of room).
4. [Rule 2] assembleContext widens the pointer reserve when the Pointers block is longer than 600 characters (long paths in the live run), and re-walks the optional pieces, so the hard cut of rule 8 fires only when the required pieces are too large. Rule 8 lists "the end of the required blocks" in the Pointers block.
5. [Interpretation] The "every run" checks for the NAV contract and the doctrine pointer run on the 5 encoder runs. The bash fallback has no Pointers block and keeps only the first 8,500 bytes; its checks are budget, clean JSON, and marker removal (the context starts with the Larry identity).
6. [Interpretation] The cold run uses an empty rooms home, so no ACTIVE ROOM CONTEXT block enters the first-install path.
7. [Order] The doctrine reference file was written before the Task 2 RED run, so its check passed at RED; every other Task 2 check failed at RED (17 of 35).
8. [Scratch HOME] Every existing suite, run-all-366 and doctor ran with HOME at <scratchpad>/k1u-home for both baseline and after, because several suites run session-start with process.env, and memory-lifecycle and the dogfood drain resolve rooms from HOME.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. The full-context file is T-k1u-03 (accepted).

## Self-Check: PASSED

- FOUND: lib/core/session-context-envelope.cjs, references/personality/session-start-doctrine.md, tests/test-k1u-session-start-envelope.cjs
- FOUND commits: 01c0e5e0f, e3afaaca0, 1269bba43 (all ancestors of HEAD)
- node tests/test-k1u-session-start-envelope.cjs: PASS 35 of 35
- Dash count 0 in every touched file

## Report

STATUS: DONE
CHANGED: 01c0e5e0f, e3afaaca0, 1269bba43 (files above). This SUMMARY is uncommitted.
VERIFIED: k1u test 35/35; suite exit codes equal to baseline 19/19; run-all-366 72/0/1/1 with the k1u leg PASSED; doctor failed-id set equal on the clean tree; live probes P1, P2, P3 OK YES with N 9,000 / 8,951 / 8,935 and 0 persisted-output; doctrine lines moved 22, missing 0; out-of-scope files byte-unchanged.
UNVERIFIED: Windows ARM64 run (no host); Desktop and Cowork (no SessionStart hook there, not applicable); a real-room run (forbidden by I-7, synthetic only).
RISKS: one more node start per SessionStart (about 30 ms Linux, about 160 ms Windows ARM64); room text that holds a GS byte (0x1d) would break the block split (sanitized, but the pairing is lost); <room>/.mindrian/session-context.txt is new room-local state; the bash fallback cuts bytes in a C locale, so a multibyte character can be cut (parses as U+FFFD); triple-injection and brain-staleness timing tests stay flaky at the 15 s spawnSync timeout (pre-existing, F6).
NEXT: review the 3 commits ahead of origin (plus the 3 earlier debug commits), then cut the beta.68 release when T1 and T13 are ready.
