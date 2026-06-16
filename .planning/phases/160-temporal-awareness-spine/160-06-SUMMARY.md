---
phase: 160-temporal-awareness-spine
plan: 06
subsystem: temporal
tags: [date-sync-gate, has_event_date, valid_at, temporal-blindness-sentinel, shape-f, chrono-node, tri-polar, scout-cadence]

# Dependency graph
requires:
  - phase: 160-04
    provides: bitemporal node columns (valid_from/valid_to/invalidated_at/last_modified_at) + openRoomDb composition running the phase-160 migration
  - phase: 160-02
    provides: resolveRelativeTime (chrono-node) + dual-stamp + getReferenceNow anchor seam (D-01a)
provides:
  - "requireValidAt(filingNode, opts) - the ONE shared tri-polar date+sync gate enforcement chokepoint (GATE_BLOCK / GATE_PASS) for real-world-event artifacts (D-02)"
  - "Shape F.1 selector SPEC (when? + multi-select relates to?) returned by the gate, rendered per surface (CLI AskUserQuestion, MCP conversational)"
  - "has_event_date - the write-time real-world-event flag, READ by the gate (D-04), never inferred"
  - "INFORMS sync edges + f_selector_sync_confirmed emission on the gate multi-select (reusing the dial-close-reach idiom)"
  - "CLI (commands/file-meeting.md Step 4) + MCP (lib/mcp/prompts.cjs) wiring to the same shared gate chokepoint"
  - "sensorTemporalBlindness(ctx) - the scheduled temporal-blindness sentinel returning undated real-world nodes"
  - "temporal_blindness_surfaced - the new additive EVENT_TYPE the sentinel emits"
  - "scout-cadence-runner step 10 composing the sentinel as a LOCAL scheduled backstop (D-04)"
affects: [temporal-awareness, meeting-filing, scout-cadence, larry-reaches-sensors]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tri-polar enforcement: one lib/core function (requireValidAt), per-surface render of a returned SPEC (D-02)"
    - "Gate returns a selector SPEC, never a rendered prompt - the surface owns the render"
    - "Additive named-membership FLOOR for EVENT_TYPES (+1: temporal_blindness_surfaced), never an absolute size"
    - "Scheduled-backstop sensor composed into scout-cadence-runner (LOCAL room.db scan, not a fetch)"

key-files:
  created:
    - lib/core/temporal/date-sync-gate.cjs
    - lib/core/temporal/date-sync-gate.test.cjs
    - lib/core/sensors/sensor-temporal-blindness.cjs
    - tests/test-temporal-blindness-sentinel.cjs
  modified:
    - commands/file-meeting.md
    - lib/mcp/prompts.cjs
    - lib/core/navigation/memory-events.cjs
    - scripts/scout-cadence-runner.cjs

key-decisions:
  - "Gate enforcement lives in ONE shared lib/core chokepoint both CLI and MCP call (D-02); per-surface drift impossible (T-160-15 mitigated)"
  - "The gate returns a Shape F.1 selector SPEC, not a rendered prompt; each surface renders its own way"
  - "The multi-select sync edge reuses the existing INFORMS edge type (no new edge type, no canon amendment) + f_selector_sync_confirmed (reusing dial-close-reach)"
  - "valid_at / has_event_date ride the node properties JSON (additive idiom), not new DDL columns; phase-160 migration added only valid_from/valid_to/invalidated_at/last_modified_at"
  - "has_event_date is READ by the gate + sentinel, set explicitly at write by node type (D-04); never inferred"
  - "The sentinel is a SCHEDULED backstop (D-04) composed into the Phase 145 scout cadence as step 10, never fired per-turn; the R11 gate is the front line"

patterns-established:
  - "Date+sync gate: requireValidAt(node, opts) -> { verdict, valid_at, created_at, selector?, sync_edges?, sync_event? }"
  - "Sentinel sensor: sensorTemporalBlindness(ctx) -> { nodes, count, surfaced, eventEmitted }; node IDS ride the return, the event payload carries a count scalar only (Part 8)"

requirements-completed: [R11, R12]

# Metrics
duration: 8min
completed: 2026-06-16
---

# Phase 160 Plan 06: HITL date+sync gate + temporal-blindness sentinel Summary

**The human-owned-time enforcement layer: one shared tri-polar `requireValidAt` chokepoint blocks undated real-world artifacts at filing (CLI + MCP) and resolves free-typed dates against `getReferenceNow()`, while a scheduled temporal-blindness sentinel sweeps for undated real-world nodes as a standing backstop.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-16T09:40:12Z
- **Completed:** 2026-06-16T09:48:23Z
- **Tasks:** 3/3
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

### Task 1 - the ONE shared tri-polar date+sync gate chokepoint (R11, D-02) [TDD]
`lib/core/temporal/date-sync-gate.cjs` exports `requireValidAt(filingNode, opts)`, `GATE_BLOCK`, `GATE_PASS`. It is the single enforcement rule:
- A real-world event (`type==='meeting'` always, or `has_event_date===true`) with no resolvable `valid_at` returns `GATE_BLOCK` with a Shape F.1 selector SPEC (a "when?" question + a multi-select "relates to?" question) - a SPEC, not a rendered prompt.
- A free-typed "when?" answer (e.g. "last Tuesday") resolves `valid_at` via `resolveRelativeTime` anchored to `getReferenceNow()`; an explicit numeric `valid_at` is honored. `created_at` stays the filing moment, distinct from `valid_at`.
- A multi-selected relation writes one `INFORMS` sync edge per relation via `navigation.writeEdge` and emits `f_selector_sync_confirmed` via `navigation.logMemoryEvent`, reusing the dial-close-reach idiom verbatim (`lib/workflow/dial-close-reach.cjs:361`).
- A pure idea/assumption (not a real-world event) returns `GATE_PASS` with `valid_at = filing time` silently, no selector.
- `has_event_date` is READ off the node (D-04), never inferred.
- RED -> GREEN -> 6/6 tests pass (including the real-db sync-edge leg).

### Task 2 - wire the gate into CLI + MCP, tri-polar (R11, D-02)
- `commands/file-meeting.md` Step 4: a new "Date+Sync Gate" subsection calls `requireValidAt` BEFORE the artifact write; an undated meeting BLOCKS and renders the Shape F.1 selector via AskUserQuestion; the doctrine names the shared lib/core chokepoint as the single rule and sets `has_event_date=true` at write by node type (D-04).
- `lib/mcp/prompts.cjs` file-meeting handler: calls the SAME `requireValidAt` chokepoint; on `GATE_BLOCK` it injects a conversational two-question render of the same selector spec into the prompt; `meetingDate` threads as the free-typed "when?" answer.
- Verified: `grep -q requireValidAt` finds it in BOTH surfaces (file-meeting.md 3x, prompts.cjs 4x); gate is the shared path, not a CLI-only path.

### Task 3 - temporal-blindness sentinel on the Phase 145 cadence (R12, D-04) [TDD]
- `temporal_blindness_surfaced` added to `EVENT_TYPES` via the additive named-membership FLOOR idiom (Set +1).
- `lib/core/sensors/sensor-temporal-blindness.cjs` exports `sensorTemporalBlindness(ctx)`: scans `room.db` for real-world-event nodes (`type='meeting'` OR `has_event_date===true`) with `valid_at IS NULL`, returns exactly those N, emits `temporal_blindness_surfaced` when any surface; returns empty and emits nothing when none.
- Composed into `scripts/scout-cadence-runner.cjs` as step 10 - a SCHEDULED backstop (D-04), a PURE LOCAL room.db scan, never a fetch.
- RED -> GREEN -> 16/16 checks pass.

## Verification Results (actual)

| Check | Result |
|-------|--------|
| R11 gate test (`node --test lib/core/temporal/date-sync-gate.test.cjs`) | `# tests 6 # pass 6 # fail 0` |
| (a) meeting with no date BLOCKS until valid_at set | R11.1 + R11.4b PASS (GATE_BLOCK + selector spec) |
| (b) "last Tuesday" resolves valid_at vs getReferenceNow | R11.2 PASS (valid_at = 2026-06-09, created_at = filing moment, distinct) |
| (c) multi-select writes sync edge + emits f_selector_sync_confirmed | R11.3 PASS (INFORMS edge + event row in real db) |
| (d) requireValidAt in BOTH commands/file-meeting.md AND lib/mcp/prompts.cjs | YES (3x / 4x) |
| R12 sentinel (`node tests/test-temporal-blindness-sentinel.cjs`) | `16/16 checks passed` (exactly-N + empty+silent) |
| EVENT_TYPES FLOOR after the addition | birth-floor 20/20, navigation-memory-events 10/10 |
| Phase 157 Part 8 boundary scan | `connector Part-8 boundary scan: 4 passed, 0 failed` |
| sensors Part-8 5-tripwire sweep (spans the new sensor) | `1 passed, 0 failed over 11 file(s)` |
| sensors routing fence Phase 144 (spans the new sensor) | `2 passed, 0 failed over 11 file(s)` |
| full temporal suite (per-file) | 57/57 pass across 7 files |

## Deviations from Plan

None for Rules 1-4. One minor in-task self-correction during Task 3:

**[Rule 1 - Bug] Part-8 sweep tripped on a forbidden token inside a comment**
- **Found during:** Task 3 (first sensor write)
- **Issue:** the sensor's header comment literally contained the string `projectText` (while describing the forbidden-token list), and the Part-8 5-tripwire sweep is a literal substring match - so it flagged the comment.
- **Fix:** reworded the comment to "no egress-projection helpers, no hashing call sites" (no literal forbidden token).
- **Files modified:** lib/core/sensors/sensor-temporal-blindness.cjs
- **Commit:** 107fb408 (rolled into the Task 3 GREEN commit)

## Notes

- **`node --test lib/core/temporal/` (directory form) reports a single fake failure** on this Node 22 build: it tries to `require` the directory as a module (`Cannot find module .../lib/core/temporal`) instead of globbing it. This is a runner quirk, NOT a test failure - every one of the 7 temporal test files passes individually (57/57). All plan-named verify commands target individual files and pass.
- The pre-existing em-dashes in `lib/mcp/prompts.cjs` (its header comment + prompt descriptions) were left untouched (out of scope); all NEW lines I added use hyphens only.

## Self-Check: PASSED
