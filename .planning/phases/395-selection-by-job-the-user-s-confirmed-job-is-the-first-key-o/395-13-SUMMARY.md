---
phase: 395-selection-by-job
plan: 13
subsystem: part8-egress
tags: [part8, egress-guard, sprout-shape, brain-client, hook, owner-ruling-35, owner-ruling-37]
requires: [395-10, 395-11, 395-12]
provides:
  - "body = 3 sentences or more (owner ruling 35)"
  - "cutPastedText + PASTE_NOTE in lib/core/part8-sprout-shape.cjs"
  - "classifyAndCut in lib/core/part8-egress-guard.cjs"
  - "shim cut + egress_disclosure pasted_text in lib/core/brain-client.cjs"
affects: [scripts/part8-egress-guard-hook.cjs, tests/run-all-395.sh]
tech-stack:
  added: []
  patterns: ["redact at field level, send the rest (graduated enforcement)", "fail-closed refuse-and-resend for routes with no shim"]
key-files:
  created: [tests/test-395-egress-body.cjs]
  modified:
    - lib/core/part8-sprout-shape.cjs
    - lib/core/part8-egress-guard.cjs
    - scripts/part8-egress-guard-hook.cjs
    - lib/core/brain-client.cjs
    - tests/test-386-sprout-body-shape.cjs
    - tests/run-all-395.sh
decisions:
  - "A body is sentences >= 3 only; word count, newline count and a quoted span no longer make a body (ruling 35)."
  - "Pasted text (quote pair of 4+ words, block quote, code fence) is cut to [pasted text kept local] and the rest is decided by the rules (ruling 37)."
  - "The hook never returns updatedInput; a shim-backed route proceeds and the shim cuts, any other Brain route gets exit 2 with the cut input."
metrics:
  duration: "about 15 min"
  completed: 2026-11-16
  tasks: 3
  files: 7
---

# Phase 395 Plan 13: a body is 3 sentences or more; pasted text is cut, the rest is sent - Summary

The Part 8 shape rule now makes a body from 3 or more sentences only, so a 2-sentence generic question goes to the Brain; a pasted quote, block quote or code block is cut to `[pasted text kept local]` by one guard function (`classifyAndCut`) used by both the PreToolUse hook and the brain-client shim, and credentials, emails, identifiers and room-lexicon terms still block on the whole text.

## Commits

| Stage | Commit | Files |
|-------|--------|-------|
| RED (step 6.3) | b76fcc06d | tests/test-395-egress-body.cjs |
| Part A + Part B + steps 6.6, 6.7 (one commit, rule 10) | 80208f14f | lib/core/part8-sprout-shape.cjs, lib/core/part8-egress-guard.cjs, scripts/part8-egress-guard-hook.cjs, lib/core/brain-client.cjs, tests/test-386-sprout-body-shape.cjs, tests/run-all-395.sh |

HEAD was never at Part A only. Part A and Part B are in the same commit.

## Stage counts (tests/test-395-egress-body.cjs)

| Stage | Expected | Result |
|-------|----------|--------|
| 6.3 RED | 7 passed, 11 failed (E2 E4 E5 E10 E12 P1-P6 fail) | 7 passed, 11 failed, same set (PROVEN) |
| 6.4 after Part A | 11 passed, 7 failed (E4 P1-P6 fail) | 11 passed, 7 failed, same set (PROVEN) |
| 6.5 after Part B | 18 passed, 0 failed | 18 passed, 0 failed, exit 0 (PROVEN) |

## How the edits were applied

The edit blocks were taken from the plan text by line range (sections 6.3, 6.4, 6.5, 6.6) and applied with the planner script `apply-plan.cjs` (it reads the Find/Replace fences of the plan and stops when a Find count is not 1). Every Find count was 1. The 6 resulting files are byte-identical (`cmp`) to the planner tested tree `scratchpad/p13/final`. Step 6.7 added 1 name with 1 space to the `for` list of `tests/run-all-395.sh`.

## Verification (isolated mktemp HOME, MINDRIAN_BRAIN_KEY and CLAUDE_CODE_SESSION_ID unset, MINDRIAN_BRAIN_URL=http://127.0.0.1:9, < /dev/null)

- Baseline before edits: test-386-sprout-body-shape, test-386-over-blocking-narrowed, test-3692-theo-verdict, test-391-hooks-contract, test-c8j-brain-wire: all exit 0.
- After: test-395-egress-body 18/0 exit 0; test-386-sprout-body-shape exit 0 (SH2 2 strings body, SH3 6 strings edge, SH5 thresholds hold); test-386-over-blocking-narrowed exit 0; test-3692-theo-verdict 26/0; test-391-hooks-contract 25/0 (arm H2, no updatedInput); test-c8j-brain-wire exit 0; test-380-egress 29/0.
- `bash tests/run-all-395.sh`: exit 0, 14 of 14 PASSED.
- Step 7.1 require and `node -c`: OK. Step 7.7 em/en dash grep: nothing. Step 7.8 `grep -c updatedInput`: 0 in each of the 4 files.
- 395-15 W1b gate: W1b-0 `git log -1 -- lib/core/part8-egress-guard.cjs` names 80208f14f; `node p15-w1.js "Pre-mortem Analysis" "Macro Trends/Macro Trending"` printed `W1 OK 2 names`, rc 0.

## Deviations from Plan

- The plan rule 4 says "Do not commit". The main session prompt orders commits (RED test first, then Part A and Part B together). The commit order follows the prompt; HEAD never held Part A without Part B.
- None in code: the edits are the plan text, byte-identical to the planner tested tree.

## Deferred / Not run

- Step 7.5 (the 296-test before/after comparison) was not run again in this session. The planner ran it on scratch copies (section 8.2), and this tree is byte-identical to that tested tree. UNVERIFIED in this worktree.
- STATE.md and ROADMAP.md were not updated (main session instruction).

## Known Stubs

None.

## Threat Flags

None outside the plan threat surface. The hook block message for a route with no shim carries the cut input (no pasted byte, PROVEN by check P5).

## Self-Check: PASSED

- FOUND: tests/test-395-egress-body.cjs
- FOUND: b76fcc06d
- FOUND: 80208f14f
