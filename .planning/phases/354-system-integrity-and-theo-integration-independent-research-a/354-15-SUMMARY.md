---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 15
subsystem: mcp-tools
tags: [extract-shallow, tool-honesty, contract, canon-part-11, mcp]

requires:
  - phase: 354-system-integrity-and-theo-integration-independent-research-a
    provides: >
      tests/helpers/fixture-room-354.cjs (makeScratchRoom), the McpServer +
      Client-over-InMemoryTransport regression idiom (354-05's
      test-354-room-symlink-containment.cjs), registerCoreTools's ctx shape
      (354-14's test-354-registration-diagnostics.cjs)
provides:
  - "extract_shallow's public contract settled as honest parsing (D-354-SYS05): tool description, response fields (persisted:false, persist_via:'claim_write'), connector hitl_why, code comments and agents/larry-extended.md all agree"
  - "tests/test-354-extract-shallow-contract.cjs -- handler + disk + database-after-reopen regression pinning the pure-parse contract"
affects: [mcp-tool-honesty, agents-larry-extended, connector-registry]

tech-stack:
  added: []
  patterns:
    - "McpServer + Client over InMemoryTransport + a fresh openRoomDb handle after the call, to verify a tool's write-claim against real disk/database state rather than trusting response text alone"

key-files:
  created:
    - tests/test-354-extract-shallow-contract.cjs
  modified:
    - lib/mcp/tools/dual-path.cjs
    - lib/core/shallow-doc-parser.cjs
    - agents/larry-extended.md
    - data/connector-registry.json
    - data/mcp-tool-connectors.json
    - data/harness-manifest.json

key-decisions:
  - "D-354-SYS05 implemented as decided in 354-CONTEXT.md: extract_shallow is a pure parse by contract, not governed persistence. Both documented callers (the hookless runtime loop, ignite Door 2) run before a room exists or is bound; persistence stays owned by claim_write (writeClaimNode, the single node chokepoint, review_status proposed)."

patterns-established:
  - "A tool's honesty regression asserts through the real MCP handler AND a freshly reopened database handle AND the connector/agent-prose surfaces, not response JSON alone."

requirements-completed: [SYS-05]

duration: 35min
completed: 2026-09-23
---

# Phase 354 Plan 15: extract_shallow Pure-Parse Contract (SYS-05) Summary

**extract_shallow's description, response, connector metadata and agent prose all now agree it is a pure parse that writes nothing; claim_write is named as the only governed persistence step.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- Settled decision D-354-SYS05: extract_shallow's public contract is honest parsing, not governed persistence, per the navigator-available-to-veto (never vetoed) ruling in 354-CONTEXT.md.
- Wrote a regression that calls extract_shallow through a real MCP handler (McpServer + SDK Client over InMemoryTransport, `registerCoreTools`), reopens room.db through a fresh handle, and does a recursive directory listing before/after -- proving the tool already writes nothing to disk or the graph.
- Corrected every surface that previously claimed otherwise: the tool description ("Routes graph writes through lib/core/navigation.cjs setFocus + memory_event" -> "writes nothing to the room or its graph"), the connector's `hitl_why` (no longer describes a mismatch -- states the pure-parse contract as designed), `agents/larry-extended.md` ("The parser writes 3-5 nodes to local room.db" -> writes nothing, `claim_write` is the persistence step), and comments in `lib/core/shallow-doc-parser.cjs` explaining the MCP path's no-op setFocus/memory_event calls are by design.
- Added `persisted: false` and `persist_via: 'claim_write'` to the tool's response payload so the contract is machine-checkable, not just prose.
- Regenerated `data/connector-registry.json` and `data/mcp-tool-connectors.json` from the corrected born-wired source; regenerated `data/harness-manifest.json` (Rule 3, see Deviations) so the pre-commit hook's harness-manifest gate passes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing contract regression through the MCP handler, disk and database** - `4d1c3117e` (test)
2. **Task 2: Make every surface state the pure-parse contract** - `c08436443` (feat)

_TDD-shaped plan (test-first per CTX-TESTFIRST): Task 1 is RED (description/prose assertions fail, no-write assertions already pass -- proving behavior was already honest, only the promise lied), Task 2 is GREEN (all 13 assertions pass)._

## Files Created/Modified

- `tests/test-354-extract-shallow-contract.cjs` - New regression: extract_shallow via a real MCP handler, room.db counts (nodes/edges/memory_event) before/after through a fresh `openRoomDb` handle, directory listing before/after, `persisted`/`persist_via` response fields, tool description text, and `agents/larry-extended.md` prose
- `lib/mcp/tools/dual-path.cjs` - Honest `extract_shallow` description; response now carries `persisted: false, persist_via: 'claim_write'`; connector `hitl_why` rewritten to state the pure-parse contract (no longer describes a mismatch); header comment cites D-354-SYS05
- `lib/core/shallow-doc-parser.cjs` - Comments around `safeRecord`/setFocus and the Tri-Polar `extractDomains` note now state the MCP path's no-op writes are by design (D-354-SYS05), not an omission; no behavior change
- `agents/larry-extended.md` - The Door 2 / upload-path step now says extract_shallow writes nothing, and that `claim_write` (review_status proposed) is the governed persistence step once a room is bound and the navigator confirms; D-17's rationale reworded to "populated at the first CONFIRMED claim, not silently by the parser"
- `data/connector-registry.json`, `data/mcp-tool-connectors.json` - Regenerated from `lib/mcp/tools/dual-path.cjs`'s `connectors` export via `scripts/build-connector-registry.cjs`
- `data/harness-manifest.json` - Regenerated via `scripts/build-harness-manifest.cjs` (Rule 3, see Deviations)

## Decisions Made

- D-354-SYS05 implemented exactly as specified in 354-CONTEXT.md's Claude's Discretion section: honest-parsing-only contract, not governed persistence. Evidence: both documented callers (`lib/mcp/runtime-instructions.cjs:31`, `commands/ignite.md:140` / `skills/ignite/SKILL.md:136`) run extract_shallow before a room exists or is bound; persisting there would either need a nonexistent room or break the "never write a room artifact before binding" rule. Governed persistence already exists at `claim_write`; adding a second writer inside extract_shallow would duplicate it (Canon Part 7) and bypass the confirmation gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] `data/harness-manifest.json` staleness blocked the Task 2 commit**
- **Found during:** Task 2 commit (pre-commit hook)
- **Issue:** The commit hook's harness-manifest check failed: the manifest digest for `agents/larry-extended.md` (which I edited) was stale, and the hook also reported pre-existing stale digests for `lib/core/chain-executor.cjs` and `lib/core/navigation-engine.cjs` -- both unmodified in this commit (`git status --short` confirmed clean), so their drift predates this plan (an unregenerated manifest after a prior sibling-session commit).
- **Fix:** Ran `node scripts/build-harness-manifest.cjs` to regenerate the manifest against current on-disk content (my edit plus the pre-existing sibling drift), then staged only `data/harness-manifest.json` alongside this task's own files.
- **Files modified:** `data/harness-manifest.json`
- **Verification:** Re-ran the commit; the harness-manifest gate passed (`harness-manifest: OK`). The only non-blocking output was the pre-existing shape-declaration advisory WARN (53 violations, none touching this plan's files), unaffected by this fix.
- **Committed in:** `c08436443` (part of Task 2's commit)

---

**Total deviations:** 1 auto-fixed (Rule 3).
**Impact on plan:** Necessary to land the commit through the repo's own commit-time gate; no scope creep -- `chain-executor.cjs`/`navigation-engine.cjs` themselves were never touched, only the manifest's digest of their current (already-committed) content was refreshed.

## Issues Encountered

None beyond the harness-manifest gate above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

SYS-05 is closed. `tests/run-all-354.sh` reports 17 passed, 0 failed, 2 skipped (the `MINDRIAN_354_LIVE=1`-gated live Theo contract leg, and the not-yet-landed `test-354-concurrency-surfaces.cjs` close-out leg -- both pre-existing gaps unrelated to this plan). No new out-of-scope failures were found during this plan's execution; `deferred-items.md` was not appended to.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: tests/test-354-extract-shallow-contract.cjs
- FOUND: lib/mcp/tools/dual-path.cjs
- FOUND: agents/larry-extended.md
- FOUND commit: 4d1c3117e (test)
- FOUND commit: c08436443 (feat)
