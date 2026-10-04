---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 46
subsystem: ui-shell e2e
tags: [gap-closure, gap-1, gap-2, gap-3, journey, e2e, human-verify, d-08, d-14, d-15]
requires: [369-45]
provides:
  - the eight-step recoverable journey on the shell's real controls, with a gate raised from the CLI path
  - ten measured non-void runs (gap 3 re-measured)
  - the navigator's verdict on both new flows and on the CR-01 behaviour
affects: [SHELL369-11, CM369-03, SHELL369-12, SHELL369-13, GREC369-05]
key-files:
  modified:
    - tests/e2e-369/journey.cjs
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-COUNTER-METRICS.md
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-MANUAL-VERIFICATION.md
decisions: []
metrics:
  completed: 2026-10-04
  tasks: 3
---

# Phase 369 Plan 46: The journey on the real controls, ten runs, the navigator's click test Summary

The recoverable journey now runs the way a person would, with nothing raised by the harness: a decision reached through the shell's own Ask Larry control, a decision raised in Claude Code and answered in the browser, and an old gate id that reads "This decision was already recorded." after both servers restart. It passed ten of ten consecutive non-void runs, and the navigator approved the two flows and the `/mos:dashboard shell` behaviour.

## Tasks and commits

| Task | Name | Commit |
|------|------|--------|
| 1a | Journey on the real controls, the CLI-raised arm, `--navigator` rework | 0224da0d6 |
| 1b | Ten measured runs recorded in 369-COUNTER-METRICS.md | 4f7934bdc |
| 2 | Navigator click test (checkpoint:human-verify) | none (the navigator's reply, recorded in Task 3) |
| 3 | Gap-closure verdict and the two old gaps marked closed | b2fa78059 |

## The eight steps (`node tests/e2e-369/journey.cjs`)

1. Sign-in (the launcher is asserted to print no sign-in code, CR-01; the consumer arms its own code through the control channel).
2. Room.
3. Evidence.
4. Decide through Ask Larry: "Ask Larry about this" shows a line naming the item; "Check for Larry's proposal" shows the no-proposal copy; a child process files Larry's proposed claim; the button opens the gate with approve checked; Approve shows "Decision recorded in the room." only after the room's answer. No `act(page, 'askClaude')` call remains (T-369-46-01).
5. Decide a gate raised in Claude Code (new): a Claude Code shaped stdio process raises the gate; within 10 s and without a reload it is listed under "Waiting for you" with "Raised by Larry outside this browser."; the browser answers it; the CLI's own `gate_answer` on its own id replays `answered_elsewhere`; the room holds one decision node for it.
6. Persisted.
7. Restart and recover: both servers restart, the old gate id reads "This decision was already recorded." (gap 2), offers nothing to answer, a browser re-answer is refused with nothing written, the room replays it with one node, and the read copy converges with 0 missing.
8. Offline.

## The ten measured runs

HEAD 0224da0d6, `git status --short -- lib bin scripts ui` empty at the start and end of every run; 0 void runs of 10. Full table and spread: 369-COUNTER-METRICS.md, "Gap closure counts (2026-10-04, plans 369-33 to 369-46)".

| Counter | Median | Range over ten runs |
|---------|--------|---------------------|
| gate_click_to_recorded_ms | 66.5 | 53 to 115 |
| raised_to_listed_ms | 809 | 681 to 825 |
| restart_catch_up_ms | 2805 | 2793 to 2815 |
| lost_writes | 0 | 0 in every run |
| answered_elsewhere_replays | 1 | 1 in every run |

Exit 0 in all ten; no STEP-EVIDENCE and no DAEMON-EXIT-UNEXPECTED line (gap 3, the step that restarts both servers, no longer flakes after plan 369-34).

## Navigator-mode check and verdict

`node tests/e2e-369/journey.cjs --navigator` (shell http://127.0.0.1:44577, throwaway fixture room `room-x` in a temporary home, gate raised from the CLI path at `/gate/gate-64425c9e0a0bcf55`, claim `claim:journey-prop-navigator-cli:cd3150d`). The navigator pressed through flow 1 (Decisions, "Raised by Larry outside this browser.", provenance line, Approve checked, "Decision recorded in the room.") and flow 2 (Evidence, Ask Larry: Copy the line, Check for Larry's proposal, the no-proposal copy, the arrival announcement after about 15 s, the gate opening with the recommendation checked), closed the window, then ran `/mos:dashboard shell` in their own Claude Code: no link and no code in the conversation, browser opening signed in.

Verdict, verbatim: "approved" (no notes, no issues). Claude Code build: not reported. Recorded in 369-MANUAL-VERIFICATION.md under "Gap closure verification (2026-10-04)", with a dated "closed by" line under each old gap: gap 1 (no browser control raises a gate) closed by 369-40/42/43/44/46 (journey steps 4 and 5); gap 2 (the restart re-answer wording) closed by 369-42/44/46 (journey step 7).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, test side] The old card's "Back to Work" action assertion**
- **Found during:** Task 1 (step 7)
- **Issue:** per the orchestrator's hand-off, the journey's check of the action offered on the old (already recorded) gate card needed a test-side fix. The assertion now reads the primary action labels and requires every one to match "Back to Work", so nothing on the old card answers it.
- **Fix:** in `tests/e2e-369/journey.cjs` only (committed in 0224da0d6). No file under `ui/`, `lib/`, `bin/` or `scripts/` was changed, and the dist was not rebuilt.

Otherwise none: the plan executed as written. Task 2 was a human-verify checkpoint, answered "approved" by the navigator; nothing was auto-approved.

## Processes

- Started and killed by this plan's journey runs: each run kills its own shell, daemon, CLI helper and headless browser in its `finally`; the ten measured runs left none behind. The individual pids of the earlier session (before this continuation) are not in the hand-off and are not claimed here.
- This continuation (Task 3 and this summary) spawned no processes.
- Left alone on purpose: the navigator-mode window (`node tests/e2e-369/journey.cjs --navigator`, pid 1836756, with its headed Chromium children and the temporary home under `/tmp/e2e-369-journey-*`), still running when this was written. It is not mine to stop from this continuation; the orchestrator's background command waits for it. Also untouched: the Phase 369.1 peer's files and processes.

## Known Stubs

None.

## Threat Flags

None. The navigator mode used a throwaway fixture room in a temporary home (T-369-46-02); the verdict is recorded verbatim (T-369-46-03); counts are numbers and milliseconds only (T-369-46-04).

## Self-Check: PASSED

- 0224da0d6, 4f7934bdc and b2fa78059 are ancestors of HEAD.
- 369-MANUAL-VERIFICATION.md carries "Gap closure verification", the verbatim verdict, "Claude Code build: not reported", and both dated "Closed 2026-10-04" lines; no em-dashes or en-dashes.
- STATE.md and ROADMAP.md were not written (the orchestrator owns them).
