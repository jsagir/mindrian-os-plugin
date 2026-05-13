# lib/core/feynman/

Phase 124 (FEYNMAN.md temporal awareness) renderer + runner ship here.

Contains (after Plans 124-01 and 124-02 land):
- `timeline-renderer.cjs` -- pure function `renderTimeline(db, sectionSlug, opts) -> { markdown_body, summary_stats }`. Reads ONLY via `lib/core/navigation.cjs` (the Phase 109 closed chokepoint): `findRecentChanges`, `findStaleDecisions`, and the new `firstCapturedLastTouchedBySection` (added as the 15th re-export in Plan 124-01, mirroring the Phase 110-03 `logMemoryEvent` re-export idiom). ZERO filesystem reads. ZERO Brain calls. ZERO LLM calls.
- `timeline-runner.cjs` -- `refreshAll(roomDir)` + `refreshSection(roomDir, sectionSlug)`. Walks the room's section folders, finds each `FEYNMAN.md` with the sentinel pair (creates the pair if absent on first run), reads the surrounding body, calls the renderer, writes the file back with the body byte-preserved and the sentinel-bounded section replaced, sets `timeline_last_rendered: <ISO>` frontmatter (second-resolution). Each refresh logs a `memory_event` of type `feynman_timeline_refreshed`. Idempotent (re-run -> byte-identical output).

Sentinel pair (D-02 hard invariant; bytes outside the pair are byte-preserved across regeneration):
- `<!-- TIMELINE_AUTO_START -->`
- `<!-- TIMELINE_AUTO_END -->`

Stale thresholds (D-06; overridable via `process.env.MINDRIAN_TIMELINE_THRESHOLDS_JSON` for tests):
- recent < 7 days
- quiet 7-30 days
- stale 30-90 days
- dormant > 90 days

Owner: Phase 124 FEYNMAN.md Temporal Awareness.
Canon: Part 9 (the Larry-explains face of memory_event). Renderer reads ONLY room.db via navigation.cjs (D-03). Writes ONLY FEYNMAN.md inside the sentinels (D-02 hard invariant).
Boundary: NO Brain calls (Canon Part 8); NO filesystem reads outside the FEYNMAN.md being written and the room.db family (allow-list pattern enforced by `tests/test-feynman-timeline-canon-part-9-invariant.cjs`).

Upstream: `lib/core/navigation.cjs` (Phase 109 chokepoint), `lib/core/navigation/memory-events.cjs` (EVENT_TYPES +2 in Plan 124-02), `lib/core/navigation/insights.cjs` (source_section provenance).

See: `.planning/phases/124-feynman-temporal-awareness/124-CONTEXT.md`.
