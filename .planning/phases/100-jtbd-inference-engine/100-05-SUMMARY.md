---
phase: 100-jtbd-inference-engine
plan: 05
subsystem: hooks
tags: [jtbd, hooks, classifier, state, claude-code-hooks, hmi]

# Dependency graph
requires:
  - phase: 100-jtbd-inference-engine
    provides: lib/hmi/jtbd-classifier.cjs (Plan 100-02), lib/hmi/jtbd-state.cjs (Plan 100-03), lib/hmi/jtbd-taxonomy.json (Plan 100-01), lib/state/state-md-parser.cjs (Plan 100-02 side-effect)
  - phase: 99-conversation-operator-state-machine
    provides: lib/conversation/operator.cjs getCurrent (operator scalar input to classifier)
  - phase: 95-bash-hook-envelope-and-cascade-side-channel
    provides: BASH-95-01 envelope schema (stdin JSON), active-room guard pattern
provides:
  - "Hook entry point at scripts/jtbd-update.cjs wiring classifier + state on every Larry turn"
  - "UserPromptSubmit + Stop hook registrations in hooks/hooks.json (additive only)"
  - "9-class integration test suite asserting wiring, transition, manual override, graceful degradation, latency, hook registration"
  - "Per-room JTBD inference now persists across UserPromptSubmit + Stop without blocking Larry"
affects:
  - "Phase 100-04 jtbd-command (read JTBD state at .mindrian/jtbd-state.json)"
  - "Phase 91 navigation-engine (Mode A/B option generation reads current JTBD)"
  - "Phase 88.2 uiux-selector-block (Shape F.1 Next Move filtered by current JTBD)"
  - "Future Brain-derived team enrichment (BRAIN.md Pattern Matches gated on JTBD signal)"

# Tech tracking
tech-stack:
  added: []  # Zero new runtime deps (Phase 87 invariant maintained)
  patterns:
    - "Detached hook entry point mirroring scripts/operator-update.cjs (Phase 99-04)"
    - "Tier 0 graceful module load: optional deps fail-soft to no-recency / no-operator strata"
    - "Active-room resolution: env override (CLAUDE_ACTIVE_ROOM) -> registry fallback"
    - "Transition gating: jtbd change OR same-jtbd confidence delta > 0.15"

key-files:
  created:
    - scripts/jtbd-update.cjs
  modified:
    - hooks/hooks.json
    - tests/test-jtbd-hook-integration.cjs (was Wave-0 stub)
    - lib/hmi/jtbd-classifier.cjs (Rule 3 deviation fix)

key-decisions:
  - "Sister hook to operator-update.cjs (distinct script, runs in own process; hook chain order is order-independent because both read each other's persisted state from disk)"
  - "Active-room resolution prefers CLAUDE_ACTIVE_ROOM env var (test-friendly) over registry, with registry as production fallback (mirrors Phase 99-04 scaffold byte-for-byte where applicable)"
  - "Transition gate: jtbd change is unconditional; same-jtbd updates require |confidence delta| > 0.15 to avoid history-table churn from classifier noise"
  - "Stop event re-classifies ONLY when last response contains /mos: invocation pattern (methodology completion heuristic per 100-05-PLAN task 1 step 2). Plain prose closes silently"
  - "Hook script passes manual=false to setCurrent; the manual override gate lives entirely in lib/hmi/jtbd-state.cjs (single source of truth per 100-03 spec)"
  - "JUST_TALK 0.8-threshold guard is preserved by passing operator scalar through to classifier unchanged; the guard is a classifier responsibility, not a hook responsibility"

patterns-established:
  - "Pattern 1: Hook scripts as detached child processes — defensive try/catch around main(), exit 0 on any error, never block hook chain (mirrors Phase 99-04 operator-update.cjs)"
  - "Pattern 2: Tier 0 graceful module loading — top-level try/catch on each require; optional deps degrade to lower-resolution stratum without crashing"
  - "Pattern 3: Test-friendly env override for active-room resolution (CLAUDE_ACTIVE_ROOM) layered above production registry (~/MindrianRooms/.rooms/registry.json)"
  - "Pattern 4: Transition gates with hysteresis-aware compare — separate same-vs-different jtbd paths; confidence delta threshold prevents noise-driven history bloat"

requirements-completed: [HMI-100-05]

# Metrics
duration: ~25 min
completed: 2026-05-01
---

# Phase 100 Plan 05: JTBD Hook Integration Summary

**Wired lib/hmi/jtbd-classifier.cjs (100-02) and lib/hmi/jtbd-state.cjs (100-03) into Claude Code hooks via scripts/jtbd-update.cjs (199 lines, mirrors Phase 99-04 scaffold), registered on UserPromptSubmit + Stop with additive-only edits to hooks/hooks.json, replaced Wave-0 stub with 9-class integration suite (9/9 GREEN), zero regression on Phase 99-04 hook tests.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-01T13:25Z
- **Completed:** 2026-05-01T13:50Z
- **Tasks:** 3 (all autonomous; no checkpoints)
- **Files created:** 1 (scripts/jtbd-update.cjs)
- **Files modified:** 3 (hooks/hooks.json, tests/test-jtbd-hook-integration.cjs, lib/hmi/jtbd-classifier.cjs)

## Accomplishments

- **scripts/jtbd-update.cjs (NEW, 199 lines, < 200 plan budget):** Single hook entry point with CLI shape `node scripts/jtbd-update.cjs <event>` where event ∈ {userprompt, stop}. Reads operator state, recent decisions, current JTBD; calls classify(); writes state on transition. Defensive try/catch wrapping main() so Larry's turn is never blocked.
- **hooks/hooks.json registrations:** Two additive hook entries — UserPromptSubmit (after operator-update.cjs) and Stop (after on-stop + operator-update.cjs). Both at 3000ms timeout (matches operator-update). Zero modifications to existing entries; Phase 99-04 entries untouched.
- **tests/test-jtbd-hook-integration.cjs (REPLACED stub):** End-to-end harness via child_process.spawnSync + tmpdir room fixtures. 9 assertion classes covering UserPromptSubmit transition, Stop /mos: heuristic, manual override gate, graceful degradation paths (no room, empty msg, classifier-error), latency budget, and hooks.json registration. All 9 GREEN.
- **Phase 99-04 hook tests:** 12/12 still GREEN (no regression on operator-update path).
- **Wave-1 JTBD test suite:** classifier 6/6, state-io 9/9, taxonomy 8/8 still GREEN.

## Task Commits

1. **Task 1: scripts/jtbd-update.cjs hook entry point** — `bd8ec89` (feat) — also includes Rule 3 classifier fix (taxonomy iteration)
2. **Task 2: hooks.json UserPromptSubmit + Stop registrations** — `869e7f4` (feat)
3. **Task 3: 9-class integration test suite** — `791e4bd` (test)

**Plan metadata:** _to be added in final commit_

## Files Created/Modified

- `scripts/jtbd-update.cjs` — Hook entry point, 199 lines. CLI: `node scripts/jtbd-update.cjs <userprompt|stop>`. Loads classifier + state lazily; resolves active room from env or registry; reads STATE.md decisions + operator scalar; classifies; writes state on transition; graceful exit 0 on any error path.
- `hooks/hooks.json` — Two additive entries: UserPromptSubmit jtbd-update.cjs userprompt (after operator-update); Stop jtbd-update.cjs stop (after on-stop + operator-update).
- `tests/test-jtbd-hook-integration.cjs` — Replaced 5-line Wave-0 stub with 287-line 9-class integration suite.
- `lib/hmi/jtbd-classifier.cjs` — Rule 3 deviation fix: introduced `_taxonomyEntries()` helper that prefers `entries[]` (canonical Wave-1 shape) and accepts `jtbds[]` for legacy tolerance. Without fix, classify() always returned `{classifier-error, taxonomy_missing}`.

## Decisions Made

- **Hook chain order is order-independent.** operator-update.cjs and jtbd-update.cjs are registered as separate scripts on the same events. They communicate via per-room state files on disk (`.mindrian/conversation-operator.json` and `.mindrian/jtbd-state.json` respectively), not via in-memory handoff. This means either can run first; the second to run reads the first's persisted output.
- **Active-room resolution prefers env override.** `CLAUDE_ACTIVE_ROOM` env var beats registry — this is what makes the integration test fixture trivial (no need to create a registry per test). Production code paths fall back to `~/MindrianRooms/.rooms/registry.json` matching Phase 99-04's resolveActiveRoom() byte-for-byte.
- **Transition gating with confidence delta threshold (0.15).** Same JTBD with confidence drift below 0.15 is no-op (prevents history-table churn). Different JTBD or delta > 0.15 triggers write. Per `must_haves.truths`: "Transition trigger: current.jtbd changes OR confidence shifts > 0.15".
- **Stop event /mos: heuristic is the methodology-completion gate.** Per plan task 1 step 2: re-classify on stop ONLY when last response contains `/mos:` invocation. Plain prose closes silently. This avoids burning frame budget on every dead-air stop.
- **Manual override gate lives in jtbd-state.cjs, not in hook.** The hook passes manual=false; the gate (current.expires_at > now → block + history row) is enforced atomically inside setCurrent. Single source of truth per 100-03 spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] lib/hmi/jtbd-classifier.cjs taxonomy iteration mismatch**
- **Found during:** Task 1 (smoke verification of script)
- **Issue:** Classifier read `TAXONOMY.jtbds` but the taxonomy file ships entries under `TAXONOMY.entries` (the Wave-1 100-01/100-02 integration-fix commit `294403a` left this shape mismatch). Without fix, every `classify()` call returned `{jtbd: null, confidence: 0, evidence: ['classifier-error', 'taxonomy_missing']}` — meaning Phase 100-05's hook would NEVER write a non-null state. The Wave-1 6/6 classifier tests passed only because they verified shape-of-return, not actual classification correctness.
- **Fix:** Introduced `_taxonomyEntries()` helper in classifier.cjs that prefers `entries[]` (canonical) and accepts `jtbds[]` as legacy tolerance. Both buildCaches() (module init) and classify() (runtime) routed through the helper.
- **Files modified:** lib/hmi/jtbd-classifier.cjs
- **Verification:** Wave-1 6/6 classifier tests still GREEN; new integration suite Class 1 transitions write `find-bottleneck` correctly; taxonomy 8/8 still GREEN.
- **Committed in:** bd8ec89 (Task 1 commit)

**2. [Plan-author oversight, surfaced as documentation] Plan task 1 verify command does not pass with shipped Wave-1 scoring formula**
- **Found during:** Task 1 verify execution
- **Issue:** Plan's verify command sets only one `/mos:rs-fetch` decision and "where is the bottleneck" message with no operator pre-seed. With shipped scoring (cues weighted 0.5 saturating at min(n,3)/3, recency 0.2, operator 0.3 flat, JUST_TALK threshold 0.8), this fixture scores 0.234 — well below the 0.6 non-JUST_TALK threshold and well below the 0.8 JUST_TALK threshold (which is hit because operator-update.cjs cold-starts to JUST_TALK). The verify command therefore would always report failure even with a perfectly correct hook implementation.
- **Resolution:** No code change; the integration suite (Task 3) replaces the unrealistic plan smoke with a realistic one — pre-seeds operator state to METHODOLOGY (so threshold = 0.6) AND saturates recency to 3 hits, which exercises the actual transition path. The plan smoke was a check on the wiring, not on the classifier's accuracy at that fixture.
- **Files modified:** None (issue is in plan-author smoke command; addressed by the more thorough Task 3 test suite, not by relaxing the script)
- **Documented:** SUMMARY (here) so future planner refines fixtures.

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking) + 1 documentation-only.
**Impact on plan:** Rule 3 fix was essential — without it, ZERO Phase 100 functionality would be live (all of 100-05's hook writes depend on classifier returning non-null). Documentation-only deviation has zero code impact; it explains why my integration tests use stronger fixtures than the plan's smoke. No scope creep.

## Issues Encountered

- **Initial smoke fixture too weak.** The plan's verify command (`'where is the bottleneck'` + 1 decision + no operator) is below threshold under shipped Wave-1 scoring. Resolution: realistic integration tests in Task 3 with proper fixtures (operator pre-seeded to METHODOLOGY, 3 recency hits). Documented as a deviation.

- **Worktree + .planning/ asymmetry.** This worktree was forked from `ui/destijl-rebuild` before Wave 1 landed. Required `git merge main` at the start of execution to bring lib/hmi/* dependencies into the worktree. Plan files (.planning/phases/100-*) live only in the main repo working tree (gitignored from the merge), so SUMMARY.md was filed under a freshly-created `.planning/phases/100-jtbd-inference-engine/` directory in the worktree. Outer orchestrator will need to copy SUMMARY back to the main repo planning tree.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 100-04 (jtbd-command):** Can proceed in parallel (Wave 2 sibling). Reads `<roomDir>/.mindrian/jtbd-state.json` written by this hook. State schema is locked at 100-03 v1.
- **Phase 91 navigation-engine:** Mode A/B option generation can now consume current JTBD as a routing signal. Hook fires on every UserPromptSubmit so navigation gates always have fresh JTBD context.
- **Phase 88.2 uiux-selector-block:** Shape F.1 Next Move can filter `next_move_verbs` from the active JTBD's taxonomy entry once 100-04 wires the read-side surface.
- **Cross-room aggregation:** Per-room JTBD state is LOCAL by Canon Part 8 construction. Phase 90 cross-room aggregator does NOT see jtbd-state.json (the aggregator's path scope is opt-in per registry; jtbd-state.json is not on its read list). This is correct.

---
*Phase: 100-jtbd-inference-engine*
*Plan: 05*
*Completed: 2026-05-01*

## Self-Check: PASSED

- [x] scripts/jtbd-update.cjs exists (199 lines, < 200 plan budget)
- [x] hooks/hooks.json registers UserPromptSubmit jtbd-update.cjs userprompt
- [x] hooks/hooks.json registers Stop jtbd-update.cjs stop
- [x] hooks/hooks.json valid JSON (parsed without error)
- [x] tests/test-jtbd-hook-integration.cjs replaces stub with 9 assertion classes
- [x] tests/test-jtbd-hook-integration.cjs exits 0 (9/9 PASS)
- [x] Wave-1 classifier tests still GREEN (6/6)
- [x] Wave-1 state-io tests still GREEN (9/9)
- [x] Wave-1 taxonomy tests still GREEN (8/8)
- [x] Phase 99-04 hook tests still GREEN (12/12 — no regression)
- [x] Task commits exist: bd8ec89 (Task 1), 869e7f4 (Task 2), 791e4bd (Task 3)
- [x] Canon Part 8 LOCAL: hook reads/writes only local files; zero Brain queries; zero new deps
