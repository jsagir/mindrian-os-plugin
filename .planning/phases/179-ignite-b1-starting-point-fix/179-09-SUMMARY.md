---
phase: 179
plan: "09"
subsystem: ga4-card-fire-interceptor
tags: [gap-closure, fix-wave, R-1-cure, stop-hook, bounded-escape, part-8, cirs-r15]
kind: summary
requires:
  - scripts/check-card-fire.cjs (Plan 179-01 substrate, 179-08 transcript wiring)
  - scripts/on-stop (the transcript-read idiom reused)
  - tests/test-ga4-card-fire-e2e-179.cjs (Plan 179-08 e2e, extended here)
provides:
  - A bounded-escape counter that CONVERGES on the LIVE (BACKSTOP) path -- the production livelock killed
  - A transcript-growth-INVARIANT gate identity (session_id + last-user-message anchor)
  - WR-06 fix -- the card-fired signal scoped to the LAST assistant message (no stale-card bleed)
  - WR-05 fix -- the 3 residual exit-2 inline comments reconciled to decision:block-on-exit-0
  - A GROWING-transcript convergence e2e assertion (the anti-test-theater proof the prior fixture lacked)
affects:
  - tests/test-ga4-card-fire-e2e-179.cjs (e2e 19 -> 25 assertions)
tech-stack:
  added: []
  patterns:
    - transcript-growth-invariant retry identity (last-USER-message anchor, sha256 of index+content)
    - last-assistant-message-scoped signal extraction (output_text + askFired share one turn scope)
    - GROWING-transcript spawnSync convergence proof (append one assistant turn per run)
key-files:
  created: []
  modified:
    - scripts/check-card-fire.cjs
    - tests/test-ga4-card-fire-e2e-179.cjs
decisions:
  - CR-02 gate identity = session_id + last_user_anchor (the PREFERRED option from the re-review): the
    last USER message is fixed across all assistant re-emissions of the same stuck gate, so it converges;
    gate_turn_index (assistantCount) is retained only as a LOWEST-precedence legacy fallback, never live.
  - WR-06 askFired scoped to the LAST assistant message object (same scope as output_text); the
    whole-transcript OR accumulation and the cross-turn obj.content double-scan removed.
metrics:
  duration: ~0.4h
  completed: 2026-06-25
---

# Phase 179 Plan 09: GA-4 Bounded-Escape Convergence Fix (CR-02 BLOCKER + WR-06 + WR-05) Summary

The GA-4 card-fire interceptor's bounded-escape counter now CONVERGES on the live BACKSTOP path: a single transcript-growth-invariant key climbs to `MAX_FORCE_RETRIES` and degrades at MAX+1, instead of minting a fresh `count:1` key every retry (the production livelock the re-review proved).

## What This Plan Did

A second re-review of Phase 179 found a SECOND blocker in the same failure class as the first (BL-01): a headline guarantee dead at runtime, masked by a non-production test fixture. CR-02: the bounded-escape "no infinite loop" guarantee never converged on the LIVE path. This plan fixed CR-02 (BLOCKER) + WR-06 (WARNING) + WR-05 (WARNING) in one atomic commit, with a growing-transcript convergence e2e that fails pre-fix and passes post-fix.

### CR-02 (BLOCKER) -- the bounded escape now converges on the LIVE path

**Root cause (re-review, proven live):** the retry key fell back to `gate_turn_index = assistantCount` computed over the WHOLE Stop transcript. A Stop transcript is the entire conversation, and it GROWS by one assistant message every time the interceptor blocks and the model re-emits the gate. So every retry minted a BRAND-NEW key at `count:1` and re-blocked; `MAX_FORCE_RETRIES` was never reached -- a user-facing livelock on a genuinely card-incapable surface (bounded only by the 3000ms hook timeout, not the retry ceiling). The deferred PRIMARY `ran_entries` key path is dead because nothing produces `ran_entries` (WR-04), so the live BACKSTOP path always hit the growing fallback.

**Fix:** `readTranscriptTurn` now also derives `last_user_anchor` -- a sha256 over the LAST USER message's ordinal index + content. The model APPENDS assistant turns on re-prompt; the last USER message stays FIXED across all retries of the same stuck response, and is per-gate (a different user request yields a different anchor -> a different counter). `turnContextHash` precedence is now `ran_entries` (deferred) -> `last_user_anchor` (the live identity) -> `gate_turn_index` (lowest-precedence legacy fallback only, never the live identity). `deriveTurnSignals` threads `last_user_anchor` through. `assistantCount` is no longer the gate identity on any live path.

**Live proof (the side-file showing ONE converging key, not 5 distinct):**

Pre-fix (`179-09-CR02-prefix-livelock-proof.txt`) -- a GROWING transcript (run k = k prior assistant turns + the box), same `session_id`:

```
run 1: BLOCK
run 2: BLOCK
run 3: BLOCK
run 4: BLOCK
side-file keys: 4
  40e772910cf4a5eb -> count=1
  835a101aaf6d1f24 -> count=1
  01b1f7f27daef758 -> count=1
  ea6159fd356077d1 -> count=1
VERDICT: LIVELOCK -- 4 DISTINCT keys each count:1, never converges
```

Post-fix (`179-09-CR02-postfix-convergence-proof.txt`) -- same GROWING transcript, same session, same fixed last-USER message:

```
run 1: BLOCK  | side-file: 1 key(s) [cddef5545c8f=>count:1]
run 2: BLOCK  | side-file: 1 key(s) [cddef5545c8f=>count:2]
run 3: BLOCK  | side-file: 1 key(s) [cddef5545c8f=>count:3]
run 4: DEGRADE | side-file: 0 key(s) [(empty -- cleared on degrade)]
AT THE CEILING (run 3): 1 key, count=3 -- ONE converging key, NOT 3 distinct.
VERDICT: CONVERGES -- ONE key climbed to 3 then degraded+cleared at MAX+1
```

ONE key `cddef5545c8f` climbs 1 -> 2 -> 3 across the GROWING transcript, then degrades and clears at MAX+1. The livelock is killed.

### WR-06 (WARNING) -- card-fired signal scoped to the LAST assistant message

`readTranscriptTurn` was OR-ing `askFired` across ALL assistant messages (`askFired |= true`) while `output_text` was scoped to the LAST assistant message. So a STALE earlier AskUserQuestion (three turns ago) suppressed interception of the CURRENT flat-box turn. Fix: track the last assistant message's content object and evaluate `scanContentForAskUserQuestion` on IT ALONE after the walk. The whole-transcript accumulation and the cross-turn top-level `obj.content` double-scan (the WR-06 bleed source) are removed; the top-level fallback now only applies to the same last-assistant record.

### WR-05 (WARNING) -- residual exit-2 comments reconciled

The 3 inline "exit-2" comments (the `classifyCardFire` doc at the verdict block, the `buildEnforcementEnvelope` doc, the `main` inline) were replaced with `decision:block-on-exit-0` / `Stop-block`, matching the already-reconciled header. The header's own reconciliation note (lines 21-22: "It is NOT an exit-2 block; earlier drafts... called it an exit-2 PostToolUse interceptor") is the correct intentional explanation and is left in place. The bounded-escape header doctrine was also updated to describe the growth-invariant anchor honestly (no longer claiming the assistant counter is the live identity).

### Anti-test-theater e2e (the proof the prior fixture lacked)

The prior 179-08 "convergence" assertion held `assistantCount` constant at 1 per fixture, which is exactly what masked CR-02. This plan added a GROWING-transcript convergence block that drives the real script (`spawnSync`) with run k = k prior assistant turns + the box turn, same session, same fixed last-user message, each turn carrying unique prose:

- runs 1..MAX return `decision:block` (the counter climbs on ONE growth-invariant key),
- the side-file holds exactly ONE key at the ceiling (not MAX distinct),
- run MAX+1 DEGRADES (`continue:true`, no block).

Plus a WR-06 stale-card-then-box test (earlier turn fires a card, last turn renders a box -> MUST `decision:block`) and its converse (a card on the LAST turn no-ops even after an earlier box -> last-turn scope proven).

**Pre-fix-fails / post-fix-passes evidence:** against the pre-fix code (HEAD `check-card-fire.cjs` restored, new e2e run), the new CR-02 ceiling assertion FAILED with `AssertionError: (CR-02) at the ceiling the side-file holds exactly ONE converging key (not MAX distinct keys)` (`actual: false`). Against the fixed code the full e2e passes `25 assertions` (was 19).

## Deviations from Plan

None - the three fixes were executed exactly as specified in the re-review's recommended fix for CR-02 / WR-05 / WR-06. No Rule 1-4 deviations; no architectural changes.

## Test Results

| Suite | Result |
| ----- | ------ |
| `tests/test-ga4-card-fire-e2e-179.cjs` (post-fix) | PASS 25 assertions (was 19; +CR-02 growing-transcript +WR-06 stale-card) |
| `tests/test-ga4-card-fire-e2e-179.cjs` (pre-fix, new assertions) | FAILS on CR-02 ceiling assertion (proves the fix is load-bearing) |
| `tests/test-ga4-card-fire-interceptor.cjs` (the 22 unit assertions) | PASS 22/22 (backward-compat preserved) |
| `tests/run-all-179.sh` | 12 passed / 0 failed / 0 skipped (FULLY GREEN incl the new growing-transcript assertion) |
| `tests/run-all-178.sh` | 10 passed / 0 failed / 0 skipped |
| `tests/run-all-172.sh` | 20 passed / 0 failed |

## Gate Compliance

- **Part 8 (Graph Boundary):** the changed script carries zero network/Brain symbols (grep clean). `last_user_anchor` is a sha256 HASH of the last-user index + content -- the raw user text never leaves `readTranscriptTurn`; the transcript is read, scanned, discarded, never egressed.
- **No em-dashes:** zero U+2014/U+2013 in both changed files (precise unicode scan).
- **Frozen contracts byte-unchanged:** `lib/core/navigation/edges.cjs`, `lib/core/navigation/transitions.cjs`, `lib/core/navigation/room-birth.cjs` all `git diff --quiet HEAD` clean. Mints no reach / posture / edge / node.
- **Frozen Part 3 contracts:** MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the glyphs -- untouched (reach-ids 6 + posture-ids 3 drift fences green in run-all-179).
- **CIRS born-wired gates:** `check-render-coverage --check` exits 0.
- **Reuse:** the transcript-read idiom mirrors `scripts/on-stop:33`; no new parsing invented.

## Commits

- `c91a0520` -- fix(179-09): CR-02 bounded-escape converges on the LIVE path (last-user anchor) + WR-06 + WR-05

## Known Stubs

None. The PRIMARY `ran_entries` detector remains DEFERRED (WR-04, no producer exists) and is honestly documented as such in the file header; the live BACKSTOP path is now both detection-live (179-08) and convergence-correct (this plan).

## Self-Check: PASSED

- FOUND: scripts/check-card-fire.cjs (modified) + tests/test-ga4-card-fire-e2e-179.cjs (modified)
- FOUND: 179-09-SUMMARY.md + 179-09-CR02-prefix-livelock-proof.txt + 179-09-CR02-postfix-convergence-proof.txt
- FOUND: commit c91a0520
- No em-dashes in SUMMARY (precise unicode scan: 0)
