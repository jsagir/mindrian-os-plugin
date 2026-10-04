---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 44
subsystem: ui-shell-client
tags: [gap-closure, gap-1, gap-2, ui, decisions, work, gate-view, wr-06, rev369-04, d-09, d-10, d-11, d-15]
requires:
  - phase: 369-42
    provides: "listOpenGates merged with gate_list (raised_elsewhere, evidence_count, rationale, raised_unavailable); readGate mirror and answered record; approveDecision verdict_chosen_mismatch and answered_elsewhere"
  - phase: 369-43
    provides: "zero-import copy-reference module and the zod-in-browser CSP rule; views.cjs arm layout"
  - phase: 369-27
    provides: "gate-model.ts state machine, GateView, GateCard"
provides:
  - "useOpenGates follows the read copy (seq), at most one read a second, and reports raisedUnavailable"
  - "Work's Next decision panel reads the why line and evidence count from the list and never calls readGate"
  - "Decisions 'Waiting for you' rows and the Work panel say 'Raised by Larry outside this browser.' for a raised gate; caption when the raised list could not be read"
  - "Gate model and views: raised provenance line, lookup_failed refusal with Check again, verdict_mismatch error, answered-elsewhere read as already recorded"
  - "gate-button e2e arm 10 rewritten to the mirror contract; arms 14-16 new"
affects: [369-45, 369-46]
tech-stack:
  added: []
  patterns: ["a view describes a gate from the list item, never by reading it (reading raises a mirror and issues a nonce)", "a failed room lookup is a retryable refusal that keeps the gate"]
key-files:
  created: []
  modified:
    - ui/shell/client/views/hooks.ts
    - ui/shell/client/views/work/NextDecisionPanel.tsx
    - ui/shell/client/views/decisions/DecisionsView.tsx
    - ui/shell/client/views/gate/gate-model.ts
    - ui/shell/client/views/gate/GateCard.tsx
    - ui/shell/client/views/gate/GateView.tsx
    - ui/shell/client/copy.ts
    - tests/test-369-gate-web-mapping.cjs
    - tests/test-369-views-copy.cjs
    - tests/e2e-369/gate-button.cjs
    - lib/ui-shell/dist/ (rebuilt twice)
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-UI-SPEC.md
key-decisions:
  - "replay_lookup_failed maps to a new refusal key lookup_failed (not in DROPS_THE_GATE); Check again is a TextAction that sends a check_again event (refused/lookup_failed to opening) and re-runs the opening read, so the view keeps one primary action"
  - "During the checking state (an answer in flight) a failed lookup keeps checking (lost) instead of refusing, so a possibly saved answer is never shown as a refusal; the existing stalled Check again button covers it"
  - "verdict_chosen_mismatch moved out of CHOICE_REFUSALS into its own ready error verdict_mismatch with its own copy"
  - "classifyAnswer treats answered_elsewhere as replayed even without replayed:true; the heading names the room's chosen option when the answer carries it"
requirements-completed: [SHELL369-12, GREC369-05, REV369-06]
duration: ~2h
completed: 2026-10-04
---

# Phase 369 Plan 44: Raised gates in Work and Decisions, and the new gate states Summary

A gate Larry raises in Claude Code now appears live in Work's Next decision panel and in Decisions under "Waiting for you" with "Raised by Larry outside this browser.", opens as the same card with the raised provenance line, and the gate view says the true thing for a failed room lookup ("The room could not be checked just now." with Check again), a verdict mismatch, and an answer another session already gave ("This decision was already recorded.").

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 (RED) | 876a5b419 | 4 mapping arms (22 passed, 4 failed), 5 static arms (29 passed, 5 failed), browser arms 10, 14, 15 failing. First FAIL line: `FAIL 369-44: a gate the room holds from another session carries the raised provenance line` |
| 2 | e681f4aa5 | gate-model.ts, GateCard.tsx, GateView.tsx, copy.ts; dist rebuilt (source hash b40bf1bc915c1a94) |
| 3 | 4fba76763 | hooks.ts, NextDecisionPanel.tsx, DecisionsView.tsx, UI-SPEC dated section, gate-button fix-ups, views-copy UI-SPEC arm; dist rebuilt (bc057a5ce76adc60) |

## What was built

- **gate-model.ts:** `toGateViewModel` sets the provenance line from `proposal_from` (`claude_code` keeps its line, `raised_elsewhere` gets "Raised by Larry outside this browser. Only a person can approve it."). `replay_lookup_failed` maps to refusal key `lookup_failed`; a new `check_again` event takes `refused/lookup_failed` to `opening` (any other state unchanged, a gone gate is not re-asked). `verdict_chosen_mismatch` is the ready error `verdict_mismatch`. `answered_elsewhere` reads as recorded and replayed with the room's verdict.
- **GateCard / GateView:** the lookup-failed InlineError carries the TextAction "Check again" (`onReopen`); the mismatch InlineError sits above the still-enabled options; the card section now carries `data-refusal`. GateView re-runs the opening read on Check again (a `reads` counter), shows the same state with Check again on the bare page when the open itself failed the lookup, keeps checking when a confirm read hits a lookup failure, and names the room's chosen option when an answer comes back `answered_elsewhere`.
- **hooks.ts:** `useOpenGates` depends on the read copy's `seq` (`useReplicaOptional`), throttled by `OPEN_GATES_MIN_GAP_MS = 1000`, and returns `raisedUnavailable`. The `OpenGate` type carries `raised_elsewhere`, `evidence_count`, `rationale`.
- **NextDecisionPanel:** the readGate effect is gone (zero occurrences of `readGate` in the file); why and evidence count come from the list item; a raised item shows the caption-size raised line under the title.
- **DecisionsView:** a raised waiting row keeps the black square and WAITING FOR YOU and carries the raised line as meta; the caption "Decisions raised in other sessions could not be read just now." sits between the Waiting and Proposed headings; the "No decisions yet" line is suppressed while the raised list is unreadable.
- **copy.ts:** `RAISED_LINE`, `PROPOSAL_RAISED`, `RAISED_UNAVAILABLE`, `GATE_VERDICT_MISMATCH`, and `gateRefusalCopy('lookup_failed')`, all verbatim from the plan. The UI-SPEC has a dated section "Gap closure 2026-10-04: gates raised outside this browser, and three gate states (SHELL369-12, GREC369-05, REV369-06)" recording every string and state, pinned by a static arm.
- **gate-button.cjs:** arm 10 rewritten to the mirror contract: a second signed-in session lists the first session's gates as `raised_elsewhere`, reads one with its options and the raised provenance line; session one answers a second gate and session two's stale click reads "This decision was already recorded." (and a fresh read says the same); the cross-session `session_mismatch` copy stays covered by the stubbed route. New arms 14 (a gate raised by the live stdio CLI helper in room-q shows in Work and then Decisions within 10 s without a reload, zero readGate requests while on Work or Decisions, opens with the raised provenance and the recommendation checked, Approve records exactly one decision node), 15 (readGate and approveDecision fulfilled with `replay_lookup_failed` keep the gate with Check again and never say "no longer open"; a `verdict_chosen_mismatch` keeps the options enabled with its own refusal; the next answer records) and 16 (a second browser context answers first; the first session's click reads "This decision was already recorded." and no second decision node is written). The radius arm is now 17 and egress 18.

## Verification (final tree, nvm Node)

- `node tests/test-369-gate-web-mapping.cjs`: 26 passed, 0 failed. `node tests/test-369-views-copy.cjs`: 35 passed, 0 failed. `node tests/test-198-gate-renderers.test.cjs`: PASS. `node tests/test-369-canon-skin.cjs`: 30 passed, 0 failed.
- `node tests/e2e-369/gate-button.cjs`: PASS all 18 arms, run three times on the final build (the last after the final commit); `node tests/e2e-369/views.cjs`: PASS all 15 arms; `node tests/e2e-369/egress-and-canon.cjs`: C1 to C11 and CSP all PASS (31 captures, zero CSP events).
- `node scripts/build-ui-shell.cjs --check` exits 0 (source hash bc057a5ce76adc60, 106 files). Dash guard (`LC_ALL=C grep -nP "\xE2\x80\x94|\xE2\x80\x93"`) over every touched file prints nothing. `grep -c readGate ui/shell/client/views/work/NextDecisionPanel.tsx` is 0.

## Deviations from Plan

**1. [Rule 1 - the old test encoded the old contract] verdict_chosen_mismatch removed from the mapping test's choice_refused loop**
- The existing arm listed `verdict_chosen_mismatch` with the generic choice refusal. REV369-04 gives it its own state, so that arm now lists the other four reasons and a new arm pins the mismatch. Not a weakening: the old assertion is replaced by a stricter one on the new state.

**2. [Rule 1 - test bug found on the first browser run] arm 17 (radius) minted a fresh gate; arm 14 leaves and re-enters the room**
- A card minted before a room switch is refused `room_switched` (arm 8). Arm 14 switches to room-q and back, so the radius arm now mints its own gate instead of reusing arm 10's. Arm 14 switches rooms with the `openRoom` action (confirmLeave) from a loaded page rather than the room-list UI, because the UI route timed out when a gate is open.

**3. [Judgement] a failed lookup during the checking state keeps checking**
- The plan says a failed lookup is a retryable refusal. While an answer is in flight, refusing would hide a possibly saved answer, so a lookup failure in the confirm loop counts as "lost" (the existing four-try loop and the stalled Check again button), and only the opening read and the approve answer produce the `lookup_failed` refusal.

**4. [Observation] the list already followed raised gates through the frame's waiting beat**
- The RED browser run showed the Work panel already picked up a CLI-raised gate within 10 s through the frame's status beat (it re-reads on the waiting count). The seq dependency the plan asks for is added anyway and throttled; the browser arms prove the visible behaviour either way. One earlier run showed three `style-src-elem inline` CSP events after an arm 14 failure left the page on the room list; I could not reproduce it in three clean full runs and the egress-and-canon leg is clean, so I treat it as a side effect of that failed run (no inline style or style element exists in the shell source).

No auth gates. STATE.md, ROADMAP.md, lib/mcp/*, ui/shell/server/actions.ts and every 369.1-owned file untouched.

## Notes for plans 45 and 46

- The dist now carries source hash bc057a5ce76adc60. A guard that reasons about the client bundle should expect `useReplicaOptional` in hooks.ts and no `readGate` in the Work panel.
- The journey (46) can click: raise a gate in the CLI helper, see it in Work with "Raised by Larry outside this browser.", open it (the provenance line appears), Approve. A stale second session reads "This decision was already recorded."
- `Check again` after a lookup failure is a TextAction, so a gate screen still has exactly one primary action.

## Known Stubs

None.

## Threat Flags

None new. T-369-44-01 (mirrors raised by looking): static arm bans `readGate` in the Work panel and the browser arm counts zero readGate requests on Work and Decisions. -02 (saved answer hidden): lookup failure keeps the gate (arm 15) and an answered record reads "already recorded" (arms 10, 16). -03 (spoofed origin): the raised provenance is written in words; adapter proposals keep their own line (mapping arm). -04 (script in room text): rows and card render room text as React text; egress-and-canon C1 to C11 and the CSP event guard pass.

## Self-Check: PASSED

Commits 876a5b419, e681f4aa5 and 4fba76763 exist on main; the touched source, test and UI-SPEC files exist; `build-ui-shell.cjs --check` exits 0; STATE.md, ROADMAP.md, lib/mcp/*, actions.ts and 369.1-owned files not edited.
