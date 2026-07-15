---
phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in
plan: 04
subsystem: infra
tags: [mode-select, sidechannel, selector-dispatcher, conversation-mode, ignite, hitl]

# Dependency graph
requires:
  - phase: 227-01
    provides: "lib/core/mode-select-sidechannel.cjs exporting recordLanePick/readLanePick"
provides:
  - "lib/hmi/selector-dispatcher.cjs's pickShape trailer now records a mode-select F.1 card fire (lane: 'card-fired') via recordLanePick, scoped to the mode-select card only via a subject-text check"
  - "skills/conversation-mode/SKILL.md's Lane Picker section instructs Larry to record the default-stated resolution (lane: 'default-stated') when a lane is inferred without firing the card"
  - "skills/conversation-mode/SKILL.md Mode 3 now routes through /mos:ignite --express (Entry Routing Directive path) instead of invoking /mos:new-project directly, bypassing Gate B1 and reaching Gate B2"
affects: [227-01, 227-05, conversation-mode, ignite, mode-select-checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Additive sibling try/catch block pattern next to an existing sidechannel producer call, sharing a hoisted local instead of recomputing it", "Subject-text scoping check (two required substrings, case-insensitive) to narrow a shared render shape (F.1) to one specific card"]

key-files:
  created: []
  modified: ["lib/hmi/selector-dispatcher.cjs", "skills/conversation-mode/SKILL.md"]

key-decisions:
  - "Hoisted the existing gateSubjectText const (previously scoped inside the card-fire-sidechannel try block) to a shared `let` declared just above both try blocks, so the new block reads the identical computed value instead of recomputing the header+body join a second time, per the plan's explicit instruction. The existing recordReachedGate call itself is untouched."
  - "Scoped the new recordLanePick call to result.shape === 'F.1' AND gateSubjectText containing both 'brainstorming' and 'building something' (case-insensitive) - the two words unique to the Lane Picker's exact card text - so other F.1 gates (e.g. trending-to-absurd's trend-selection stage) never get misrecorded as a mode-select card fire (T-227-11 mitigation)."
  - "lane: 'card-fired' only (not which of the three lanes the user later picks) since the trailer fires at render time, before the answer; sufficient for the doctor checkpoint's silent-skip purpose."
  - "sessionId intentionally not threaded into the new call site, matching the existing card-fire-sidechannel producer's own NO_SESSION_KEY gap at this exact location; mode-select-sidechannel.cjs's union-read already accounts for this."
  - "Mode 3 routes through ignite's Directive/Imperative --express path (not Gate B1's four-door card) per the corrected D-11/D-12 in 227-CONTEXT.md, since conversation-mode's Mode 2-to-Mode-3 transition already establishes a determinable role/venture, which bypasses B1 per commands/ignite.md's own documented rule."
  - "commands/ignite.md left completely untouched (verified byte-identical via git diff) - Mode 3 enters via the existing Directive path, no new door, no Phase 223 reference."

patterns-established:
  - "When a shared render shape (F.*) needs a narrower-than-shape recording scope, use a subject-text substring check against the gate's own already-rendered header+body content rather than any caller-supplied metadata."

requirements-completed: [REQ-1, REQ-5]

# Metrics
duration: 22min
completed: 2026-07-16
---

# Phase 227 Plan 04: Mode-select sidechannel wiring + Mode 3 routes through ignite Summary

**Wired both D-03 call sites of the mode-select silent-skip checkpoint (the F.1 card-fire trailer in selector-dispatcher.cjs, and a prose-instructed default-stated fallback in conversation-mode/SKILL.md) and re-routed conversation-mode's Mode 3 from a direct /mos:new-project call to ignite's Directive/--express path, reaching Gate B2 without re-triggering Gate B1's four-door card.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-16T00:57:00Z (approx)
- **Completed:** 2026-07-16T01:19:00Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- `lib/hmi/selector-dispatcher.cjs`'s `pickShape` trailer now fires `recordLanePick({lane: 'card-fired'})` (from `lib/core/mode-select-sidechannel.cjs`, plan 227-01) as an additive sibling to the existing card-fire-sidechannel call, in its own try/catch, scoped specifically to the mode-select F.1 lane-picker card via a subject-text check for both `"brainstorming"` and `"building something"` — so other F.1 gates in the app (e.g. trending-to-absurd's trend-selection stage) are never misrecorded.
- `skills/conversation-mode/SKILL.md`'s Lane Picker section gained a new bullet instructing Larry to record the `lane: 'default-stated'` resolution via a `node -e` one-liner (reusing the file's existing `<plugin_root>` convention) when the lane is inferred from an already-signaled opener without firing the F.1 card — closing D-03's second call site so only a genuine silent skip leaves the doctor checkpoint (plan 227-01) with no record.
- `skills/conversation-mode/SKILL.md` Mode 3's first bullet no longer invokes `/mos:new-project` directly. It now routes through `/mos:ignite --express`, carrying the established conversational context (persona, problem, venture) as the blueprint seed, citing ignite's `## Entry Routing` Directive/Imperative path and Gate B1's own documented determinable-role/venture bypass rule, landing straight at Gate B2 (Blueprint).
- Mode 1's and Mode 2's own pre-existing `/mos:new-project` references (lines 86 and 99) are untouched; `commands/ignite.md` is byte-identical to its pre-plan state (`git diff` shows zero changes).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the card-fire call site in selector-dispatcher.cjs's pickShape trailer (D-03 site 1)** - `3b07d08d` (feat)
2. **Task 2: Conversation-mode.md default-stated recording + Mode 3 routes through ignite (D-03 site 2, D-11, D-12)** - `c5396e56` (feat)

**Plan metadata:** committed below as part of this summary + STATE.md/ROADMAP.md update.

## Files Created/Modified

- `lib/hmi/selector-dispatcher.cjs` - Additive sidechannel-recording sibling block in `pickShape`'s `emitTelemetry` trailer; hoisted `gateSubjectText` to a shared local; new try/catch scoped to the mode-select F.1 card via a subject-text check calling `recordLanePick({lane: 'card-fired'})`.
- `skills/conversation-mode/SKILL.md` - Lane Picker section: new bullet + `node -e` instruction for recording `lane: 'default-stated'`. Mode 3 section: first bullet rewritten to route through `/mos:ignite --express` instead of `/mos:new-project`, citing Gate B1's bypass rule and Gate B2.

## Decisions Made

See `key-decisions` in frontmatter. The most consequential one operationally: hoisting `gateSubjectText`'s declaration out of the existing card-fire-sidechannel `try` block (from `const` to a shared `let` assigned inside that same try) so the new sibling block could read the identical value instead of recomputing the header+body join. This changes only where the variable is declared/assigned — the existing `recordReachedGate` call and its inputs are byte-identical to before.

## Deviations from Plan

None - plan executed exactly as written. Both edits match the plan's `<action>` blocks and `<done>` criteria precisely; no Rule 1-4 triggers encountered.

## Issues Encountered

A concurrent Claude Code session sharing this working directory was mid-flight through a version-bump/release commit (`v1.15.3-beta.22`) during this plan's execution. Effects observed and handled:

- `git branch --show-current` was re-checked before each commit; it stayed `main` throughout, so no branch-switch recovery was needed.
- One `git status`/`git add` attempt hit `.git/index.lock` because the concurrent session's `git commit -m "release: v1.15.3-beta.22"` was actively running at that moment. Waited (no destructive lock removal) until the lock cleared on its own (under 2 seconds), matching the plan's own warning about this exact hazard.
- After the lock cleared, `git status` showed the concurrent session had staged ~8,880 `node_modules/*` files as a large, apparently unintended `git add`. My own `git add`ed `skills/conversation-mode/SKILL.md` from moments earlier had been reset back to unstaged (not swept into that pile) by whatever operation the concurrent session ran in between. Re-verified the file's diff was still intact, then committed Task 2 using the pathspec form (`git commit -m "..." -- skills/conversation-mode/SKILL.md`) so the commit touched only that one file's worktree content regardless of the concurrent session's unrelated staged content in the index. Never ran `git add -A`/`git add .` at any point.

Neither incident affected the correctness of this plan's changes; both are documented per the plan's explicit pre-flight instructions.

## User Setup Required

None - no external service configuration required.

## Threat Model Compliance (self-check against this plan's STRIDE register)

- **T-227-10 (DoS - new trailer block throwing):** mitigated. The new block is wrapped in its own `try/catch`, isolated from the existing card-fire-sidechannel block's `try/catch`. Verified by reading the committed diff: two separate `try { ... } catch (_e) { ... }` blocks, each independently swallowing faults.
- **T-227-11 (Tampering via over-broad recording):** mitigated. The subject-text scoping check (`result.shape === 'F.1'` AND both `"brainstorming"` and `"building something"` present, case-insensitive) narrows recording to the mode-select card specifically; confirmed the check reads the exact Lane Picker question text from `skills/conversation-mode/SKILL.md`.
- **T-227-12 (EoP via the prose-instructed node -e invocation):** accepted per plan (no code change required) - the added instruction is a fixed, argument-free one-liner calling only `recordLanePick` with a fixed `lane` value, identical in shape/risk to this file's own pre-existing `scratchpad-ops.cjs`/`bank-opportunity` `node -e` instructions.

## Next Phase Readiness

- Both D-03 call sites are now live: `recordLanePick` will actually observe real session gate resolutions going forward (card-fired via code, default-stated via prose instruction), which is what plan 227-01's doctor checkpoint (`mode-select-checkpoint-module.cjs`) needs to report real signal instead of always-warn/always-silent-ok.
- Mode 3's routing change is self-contained to `skills/conversation-mode/SKILL.md`; no other file depends on the old `/mos:new-project` direct-call wording having been removed, since Mode 1/Mode 2's own references were explicitly left alone.
- No blockers for plan 227-05.

## Self-Check: PASSED

- FOUND: lib/hmi/selector-dispatcher.cjs
- FOUND: skills/conversation-mode/SKILL.md
- FOUND: .planning/phases/227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in/227-04-SUMMARY.md
- FOUND: commit 3b07d08d
- FOUND: commit c5396e56
- Confirmed on branch `main` at self-check time

---
*Phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in*
*Completed: 2026-07-16*
