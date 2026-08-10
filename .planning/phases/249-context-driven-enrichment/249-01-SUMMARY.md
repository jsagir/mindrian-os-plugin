---
phase: 249-context-driven-enrichment
plan: 01
subsystem: api
tags: [brain, enrichment-queue, brain-client, cjs, tdd, part8]

# Dependency graph
requires:
  - phase: 247-brain-surface-contract-02
    provides: "lib/core/brain-client.cjs loop wrappers (orchestrationReadiness, discoverStructure) + tier_denied sentinel"
provides:
  - "lib/core/enrichment-queue.cjs: Part-8-audited typed enrichment-queue module (enqueue, captureReadinessMiss, readQueue, writeQueueAtomic, closed-enum constants)"
  - "scripts/enrichment-queue-append.cjs: one-line CLI, append mode + --from-census seed mode"
  - "brain-client.cjs capture seams: orchestrationReadiness/discoverStructure gain optional opts={roomDir,contextClass,db}"
  - "framework-chain-slice.cjs: fetchFrameworkChainSlice per-seed readiness piggyback probe"
  - "navigation/packet.cjs: roomDir threaded into the framework-chain-slice fetcher"
  - "enrichment_queue_captured registered in the closed EVENT_TYPES set (navigation/memory-events.cjs)"
  - "skills/brain-connector/SKILL.md: Larry-direct (Desktop/Cowork MCP) enrichment-queue append leg"
  - "tests/run-all-249.sh: glob-discovery phase runner (found-eq-0 guard, em-dash fence, hot-path fence)"
affects: [249-02-enrichment-pipeline, 250-honest-refusal, 252-flagship-floor-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clone-verbatim queue mechanics (Canon Part 7): lib/core/enrichment-queue.cjs mirrors brain-derivation-queue.cjs's atomic tmp+fsync+rename write, self-healing reader, SOFT_CAP/HARD_CAP -- only the entry schema and idempotency key (framework name vs section) differ"
    - "Closed-enum context_class validation sourced from 3 existing frozen vocabularies (sensor-types.cjs REACH_IDS/TRIGGER_TIERS, dispatch-framework-map.json keys, cross-room-aggregator.cjs PROBLEM_TYPE_ENUM) rather than a new enum -- invalid members are silently DROPPED, never stored or rejected-whole-entry"
    - "Capture-after-resolve side branch: wrappers call callTool first, capture in a try/catch AFTER resolution, return the raw result unchanged in every path -- preserves 247-02's zero-reshaping contract"
    - "Lossy dimensions_inferred:true fallback (deterministic score-arithmetic heuristic) used until the brain repo's per-dimension server field (249-02) lands; precise probeResult.dimensions vector is preferred when present"
    - "Source-priority rule on re-enqueue: a census_seed re-miss never downgrades an existing live_reach/refusal entry's provenance (research OQ3 honesty)"

key-files:
  created:
    - lib/core/enrichment-queue.cjs
    - scripts/enrichment-queue-append.cjs
    - tests/test-249-enrichment-queue.cjs
    - tests/test-249-capture-seam.cjs
    - tests/run-all-249.sh
  modified:
    - lib/core/brain-client.cjs
    - lib/brain/framework-chain-slice.cjs
    - lib/core/navigation/packet.cjs
    - lib/core/navigation/memory-events.cjs
    - skills/brain-connector/SKILL.md

key-decisions:
  - "problem_type closed enum sourced from cross-room-aggregator.cjs's PROBLEM_TYPE_ENUM (UDP/IDP/WDP) -- the one module whose own header explicitly names itself 'the frozen problem_type enum', matching the research's literal grep instruction, over the lowercase 4-value variant in rs-brain-substrate-prompts.cjs (a different, narrower Part-8 chokepoint's own vocabulary)."
  - "enrichment_queue_captured added to navigation/memory-events.cjs's closed EVENT_TYPES set (Rule 2, missing critical functionality) -- without it the plan's required memory_event logging would silently no-op (logEvent rejects any event_type outside the set), so the additive registration is load-bearing, not decorative."
  - "roomDir threading into _surfaceFrameworkChainHint needed zero new plumbing: buildBrainPacket already passes its own `options` object (which already carries options.roomDir) straight through as the `opts` param, so only the fetcher call site itself needed a new `roomDir: ...` key, not a new argument path."

requirements-completed: [ENRICH-01]

# Metrics
duration: ~10min
completed: 2026-08-10
---

# Phase 249 Plan 01: Context-Driven Enrichment - Queue + Capture Seams Summary

**Cloned the Part-8-audited brain-derivation-queue pattern into a typed enrichment-queue module (framework-name idempotency key, closed-enum context_class, dimensions_inferred fallback), wired capture into the two 247-02 brain-client loop wrappers plus the framework-chain-slice derivation-drain piggyback, and seeded the day-one operator backlog from the census gap table (24/24 census_seed entries) -- all without adding a single readiness probe to the 1200ms hot path.**

## Performance

- **Duration:** ~10 min (18:24:30 - 18:34:25 local)
- **Started:** 2026-08-10T18:24:30+03:00
- **Completed:** 2026-08-10T18:34:25+03:00
- **Tasks:** 3/3 completed
- **Files modified/created:** 10 (5 created, 5 modified)

## Accomplishments
- `lib/core/enrichment-queue.cjs`: a verbatim-mechanics clone of `brain-derivation-queue.cjs` (atomic tmp+fsync+rename, self-healing reader, SOFT_CAP 500 / HARD_CAP 1000) carrying the ENRICH-01 typed entry shape, keyed on canonical framework name for idempotency.
- `scripts/enrichment-queue-append.cjs`: the one-line CLI both the brain-connector skill leg and Phase 250's refusal rail need -- append mode plus `--from-census` seed mode.
- Capture seams landed at exactly the chokepoints the research specified: the `orchestrationReadiness`/`discoverStructure` wrapper resolution path in `brain-client.cjs`, and the per-seed piggyback probe inside `fetchFrameworkChainSlice`'s async drain pass -- never `decide()`, never a sensor.
- Census seed proof run live this session: `node scripts/enrichment-queue-append.cjs --from-census data/brain-census.generated.json --room <tmp>` produced exactly 24/24 `census_seed` entries (the full gap table), each with honest `census_seed` provenance never disguised as a live miss.
- `skills/brain-connector/SKILL.md` extended (not a new skill, Part 7) with the Larry-direct append leg for the Desktop/Cowork MCP path, where Larry bypasses `brain-client.cjs` entirely.
- All 27 tests across both suites green, plus the standalone `tests/run-all-249.sh` phase runner (em-dash fence + hot-path fence + found-eq-0 guard).

## Task Commits

Each task followed the full TDD RED -> GREEN cycle (Task 3 is `type="auto"`, single commit):

1. **Task 1 RED: failing test for enrichment-queue module + CLI** - `10d05524` (test)
2. **Task 1 GREEN: enrichment-queue module + append CLI** - `d8efac96` (feat)
3. **Task 2 RED: failing test for capture seams** - `9fdc4b1c` (test)
4. **Task 2 GREEN: capture seams for enrichment-queue misses** - `251c697d` (feat)
5. **Task 3: census seed proof, brain-connector skill leg, phase runner** - `bdefc72a` (feat)

_Plan-metadata commit (this SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md) lands separately per the final_commit protocol._

## TDD Gate Compliance

Both `tdd="true"` tasks followed the full RED -> GREEN sequence, verified in git log:

**Task 1:**
- `10d05524` `test(249-01): add failing test for enrichment-queue module + CLI` (RED gate) -- ran before any implementation existed; all 13 tests failed (module/CLI did not exist).
- `d8efac96` `feat(249-01): enrichment-queue module + append CLI (ENRICH-01)` (GREEN gate) -- all 13 tests pass immediately after.

**Task 2:**
- `9fdc4b1c` `test(249-01): add failing test for capture seams` (RED gate) -- ran against the UNMODIFIED 247-02 wrappers; 5 of 14 tests failed (Tests 1, 6, 9, 10, 13 -- exactly the behaviors this task adds: real-miss capture, memory_event logging, drain piggyback, roomDir threading). The other 9 passed trivially because the pre-249 wrappers already ignored a second argument, which happens to satisfy every "must NOT capture" assertion for the wrong reason (no capture code existed yet) -- the RED proof is the 5 genuine failures, not the 9 accidental passes.
- `251c697d` `feat(249-01): capture seams for enrichment-queue misses (ENRICH-01)` (GREEN gate) -- all 14 tests pass immediately after.

## Files Created/Modified
- `lib/core/enrichment-queue.cjs` - the typed queue module (694 lines incl. tests+CLI in that commit; module itself ~430 lines)
- `scripts/enrichment-queue-append.cjs` - append CLI, two modes
- `lib/core/brain-client.cjs` - `orchestrationReadiness`/`discoverStructure` gain optional `opts`, `_maybeCaptureEnrichmentMiss` side branch
- `lib/brain/framework-chain-slice.cjs` - per-seed piggyback probe when `opts.roomDir` is set
- `lib/core/navigation/packet.cjs` - `roomDir` threaded into the `fetchFrameworkChainSlice` fetcher args
- `lib/core/navigation/memory-events.cjs` - `enrichment_queue_captured` added to the closed `EVENT_TYPES` set
- `skills/brain-connector/SKILL.md` - Larry-direct enrichment-queue append leg
- `tests/test-249-enrichment-queue.cjs` - 13 tests (idempotency, allowlist shape, source enum, context_class closed enums, Part-8 audit, self-healing, atomic write, caps, never-throws, dimensions inference, CLI x2, CLI failure exit)
- `tests/test-249-capture-seam.cjs` - 14 tests (wrapper capture on genuine miss, sentinel/null exclusion, no-opts backward compat, enqueue-failure isolation, memory_event logging, drain piggyback x3, roomDir threading, hot-path fence)
- `tests/run-all-249.sh` - glob-discovery phase runner

## Decisions Made

See `key-decisions` in the frontmatter above:
1. `problem_type` closed enum sourced from `cross-room-aggregator.cjs`'s `PROBLEM_TYPE_ENUM` (the module whose own comment literally says "frozen problem_type enum").
2. `enrichment_queue_captured` registered in the closed `EVENT_TYPES` set as a Rule 2 auto-fix (the plan's own memory_event requirement would silently no-op without it).
3. `roomDir` threading into `_surfaceFrameworkChainHint` required zero new argument plumbing -- the existing `options` object already carried it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Registered `enrichment_queue_captured` in the closed EVENT_TYPES set**
- **Found during:** Task 2, implementing the memory_event logging the plan requires ("mirroring the existing brain_packet_rejected precedent")
- **Issue:** `navigation/memory-events.cjs`'s `logEvent(db, eventType, payload)` rejects any `eventType` not present in its closed `EVENT_TYPES` Set (`{ ok: false, reason: 'invalid_event_type' }`). The plan's required capture-logging behavior would have silently no-op'd every time without this registration -- no error, just a missing audit trail.
- **Fix:** Added `enrichment_queue_captured` to the Set following the file's own established additive-extension idiom (comment block citing the phase, the emission site, and the Part 8/Part 9 rationale, mirroring the immediately-prior `derivation_skipped` entry).
- **Files modified:** `lib/core/navigation/memory-events.cjs`
- **Verification:** Test 9 in `tests/test-249-capture-seam.cjs` asserts a real `memory_event` row lands in a temp room's SQLite db with `event_type = 'enrichment_queue_captured'` and the correct scalar payload.
- **Committed in:** `251c697d` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 2, missing critical functionality)
**Impact on plan:** Necessary for the plan's own stated memory_event requirement to actually function; no scope creep, no architectural change.

## Issues Encountered

- `lib/memory/brain-cypher-chain-slice.test.cjs` fails with `MODULE_NOT_FOUND` on this machine (hardcoded absolute require path `/home/jsagi/MindrianOS-Plugin/...`, missing `/dev/`) -- confirmed pre-existing and unrelated to any Phase 249 edit (the file's own content predates this phase). Logged, not fixed (out of this plan's file scope). See `.planning/phases/249-context-driven-enrichment/deferred-items.md`.
- A concurrent 249-02 executor landed `check-flagship-floor.cjs` + `tests/test-249-floor-gate.cjs` mid-session (non-worktree shared checkout); `git pull --rebase origin main` before the final push showed the branch already up to date with no divergence -- zero file overlap with this plan's file list, confirming the plan's stated "zero overlap by design."

## User Setup Required

None - no external service configuration required. All work is local CJS + a live read-tier probe already covered by the existing `~/.mindrian.env` key (no admin key touched).

## Next Phase Readiness

- **249-02** (dimensions server field + eval harness + floor gate) can now build on a landed, tested `captureReadinessMiss` contract: when the brain repo's per-dimension field ships, `captureReadinessMiss` already prefers `probeResult.dimensions` over the lossy inference with zero further plugin-side changes needed.
- **Phase 250** (HONEST-01 visible refusal) has a proven, callable-from-CJS-and-Bash API: `enrichmentQueue.captureReadinessMiss` / `enqueue` from CJS, `scripts/enrichment-queue-append.cjs` from a one-line Bash invocation. The `source: 'refusal'` vocabulary member is already validated and accepted end-to-end (frozen now, reserved for 250 to actually emit).
- **Phase 252** (flagship floor gate) can read the same census gap table this plan seeded from; no new dependency introduced.
- No blockers.

---
*Phase: 249-context-driven-enrichment*
*Completed: 2026-08-10*

## Self-Check: PASSED

All 10 created/modified files confirmed present on disk. All 5 task commit
hashes (`10d05524`, `d8efac96`, `9fdc4b1c`, `251c697d`, `bdefc72a`) confirmed
present in `git log --oneline --all`. This SUMMARY.md confirmed present on
disk.
