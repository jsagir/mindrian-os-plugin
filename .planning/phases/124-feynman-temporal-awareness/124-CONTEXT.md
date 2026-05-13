---
phase: 124
slug: feynman-temporal-awareness
status: Ready for planning
priority: P2 -- Canon Part 9 surfacing; small, focused, high-readability win
created: 2026-05-13 (stub) / 2026-05-13 (expanded via /gsd:discuss-phase 124 -auto)
mode: discuss-phase auto-mode (every remaining gray area locked to the recommended default; surfaced transparently below)
milestone: v1.13.0 (or v1.14.0 if backwards-compat with existing FEYNMAN.md consumers is judged risky -- plan-phase decides; lean v1.13.0-beta.14 -- the cut just happened, FEYNMAN.md has no production consumers today)
beta_target: v1.13.0-beta.14 (preferred; the FEYNMAN sentinel idiom is additive)
canon_parts: [Part 9 (Memory Locality and Interpretation -- the Larry-explains face of memory_event), Part 5 (Evidence is graded by context -- "stale" surfaces alongside the existing evidence tier)]
depends_on:
  - Phase 88 (memory triple: ROOM.md / MINTO.md / FEYNMAN.md)
  - Phase 90 (BRAIN.md per-folder memory quadruple)
  - Phase 109 (memory_event log + navigation.findRecentChanges + navigation.findStaleDecisions + navigation.cjs chokepoint + source_section provenance field)
dependents: []
brain_impact: NONE (100% plugin-side; the Brain stays methodology-pure)
---

# Phase 124: FEYNMAN.md temporal awareness

**Status:** Ready for planning. Next: `/gsd:plan-phase 124` -> `/gsd:execute-phase 124`.

<domain>
## Phase Boundary

`FEYNMAN.md` (the "explain it to a smart 12-year-old" layer of the per-folder memory triple, Phase 88) is a still photograph today. Phase 124 makes it temporally aware by appending a **hook-regenerated `## Timeline (auto)` section** to each `FEYNMAN.md`, reading from the Phase 109 `memory_event` log via `lib/core/navigation.cjs` (`findRecentChanges`, `findStaleDecisions`, and a "first-captured / last-touched" projection scoped to the folder's `source_section`). The body of `FEYNMAN.md` stays human-authored, sentinel-bounded; the section is the machine view, regenerated on demand or at session-start, never hand-edited.

In-scope: the renderer, the session-start cascade hook, the manual refresh command, the sentinel contract, the byte-preserving body-merge guarantee, the stale-threshold cascade, the per-folder section scoping, the test suite.

Out-of-scope (LOCKED yesterday, reaffirmed):
- Per-insight inline body timestamps (Option A; drifts; rejected).
- Sibling `TIMELINE.md` file extending the quadruple to a quintuple (Option D; canon-affordance expansion; deferred).
- Back-dating `memory_event` rows from existing FEYNMAN.md body parse (no parsing of human prose).
- Surfacing the timeline in `BRAIN.md` (Phase 90's BRAIN.md is Brain-derived; the timeline is LOCAL by definition).
- Statusline glyph / dashboard surface for stale FEYNMAN sections (Phase-125-ish follow-on).
- A Brain-side "summarize timeline" job (new entry in Phase 110's job vocab; separate discussion).

</domain>

<decisions>
## Implementation Decisions

### Locked from the 2026-05-13 design discussion (carried forward verbatim)

- **D-00 (LOCKED):** Make `FEYNMAN.md` aware of *when* its insights were captured, last touched, and whether they've gone stale -- by appending a hook-regenerated `## Timeline (auto)` section.
- **D-01 (LOCKED, Option B):** Auto-generated `## Timeline (auto)` section, **regenerated never hand-edited**. Body of FEYNMAN.md stays text-pure. (A, C, D rejected -- see Phase Boundary.)
- **D-02 (LOCKED, hard invariant):** The auto-section is sentinel-bounded by `<!-- TIMELINE_AUTO_START -->` ... `<!-- TIMELINE_AUTO_END -->`. Anything outside the sentinels is the human-authored body and is **byte-preserved** across regeneration. Anything inside is owned by the regenerator. Editing inside the sentinel is futile -- the next refresh blows it away.
- **D-03 (LOCKED):** The renderer reads ONLY `room.db` via the Phase 109 navigation chokepoint -- `lib/core/navigation.cjs` (`findRecentChanges`, `findStaleDecisions`, and a new helper `firstCapturedLastTouchedBySection(sectionId)`). No filesystem scanning, no FEYNMAN body parsing.

### Locked NOW (auto-mode 2026-05-13 -- recommended defaults)

- **D-04 (auto-locked) -- HOOK TRIGGER: hybrid session-start + manual command.**
  - **Session-start cascade slot:** `scripts/session-start` gains a best-effort regen pass (mirror of the cache-prune pattern at line ~1292; `|| true` on error; never blocks startup). The slot runs `lib/core/feynman/timeline-runner.cjs::refreshAll(roomDir)` which walks the room's section folders, finds each `FEYNMAN.md`, and regenerates the sentinel-bounded section if the most recent `memory_event` for that section is newer than the section's last-rendered timestamp (cheap watermark check via a hidden frontmatter field on FEYNMAN.md: `timeline_last_rendered: <ISO>`).
  - **Manual command:** `/mos:feynman-timeline-refresh [--all | --section <slug>]` mirrors the `/mos:brain-derive` shape (`commands/feynman-timeline-refresh.md` + `scripts/feynman-timeline-refresh-command.cjs`). `--all` regenerates every section unconditionally; `--section <slug>` targets one. Default = `--all`.
  - **NOT picked (and why):** post-write cascade on FEYNMAN.md itself (infinite-loop risk: the regenerator writes FEYNMAN.md, which would re-fire the cascade); per-`memory_event`-insert trigger (high-frequency, churns FEYNMAN.md every node insert -- noisy); UserPromptSubmit (the Phase 91 engine v1 hook -- wrong layer; that's for navigation decisions, not file generation); manual-only (no ambient surface; loses the "you see it without asking" benefit).

- **D-05 (auto-locked) -- SECTION FORMAT: hybrid (summary line + Recent + Stale).** The body of the `## Timeline (auto)` section, between the sentinels:
  ```
  ## Timeline (auto)

  <!-- TIMELINE_AUTO_START -->
  *Last refreshed: {ISO}. {N} insight events, first captured {first_iso}, last touched {last_iso} ({last_delta_human}).*

  **Recent events** (within 7 days, top 5):
  - {iso}: {event_type} -- {one_line_explain}
  - ...

  **Flagged stale** (over 30 days untouched, top 5):
  - {iso}: {event_type} on {target_summary} -- last touched {delta_human}
  - ...

  **Health:** recent={n_recent} / quiet={n_quiet} / stale={n_stale} / dormant={n_dormant}.
  <!-- TIMELINE_AUTO_END -->
  ```
  Bounded length (~12-25 lines per section). Templated explanation strings -- zero LLM in the loop (Phase 109 idiom). If a section has zero memory_event rows: render `*No timeline events yet.*` between the sentinels (empty-state).

- **D-06 (auto-locked) -- STALE THRESHOLDS: 7 / 30 / 90 day cascade.**
  - `recent`: last touched < 7 days ago
  - `quiet`: 7-30 days
  - `stale`: 30-90 days
  - `dormant`: > 90 days
  Thresholds live as constants in `lib/core/feynman/timeline-renderer.cjs`; overridable via `process.env.MINDRIAN_TIMELINE_THRESHOLDS_JSON` for tests + future tuning.

- **D-07 (auto-locked) -- RENDERER LOCATION: `lib/core/feynman/timeline-renderer.cjs` + `lib/core/feynman/ROOM.md` (ICM Layer 0).** The renderer takes `(db, section_id)`, calls the navigation primitives, returns the markdown body for the sentinel-bounded block. Sibling: `lib/core/feynman/timeline-runner.cjs` (the orchestrator that finds FEYNMAN.md files, reads them, calls the renderer, writes the sentinel-bounded replacement, byte-preserves the body).

- **D-08 (auto-locked) -- SECTION SCOPING: `memory_event.source_section` is the join key.** The Phase 109 `memory_event` node type already carries `source_section` (verified: `lib/core/navigation/insights.cjs` selects `ns.source_path AS source_section`). The renderer queries `memory_event` rows WHERE `source_section = <this folder's section slug>`. The folder->section slug mapping is the existing Phase-88 ROOM.md identity (the folder name *is* the section slug for the per-section FEYNMAN.md case; sub-rooms inherit a path-prefixed slug -- standard).

- **D-09 (auto-locked) -- FEYNMAN.md FRONTMATTER EXTENSION:** a new optional frontmatter field `timeline_last_rendered: <ISO>` is set by the runner after each successful regen, used as the watermark check for the session-start cascade. If absent (first run or older FEYNMAN.md): refresh unconditionally. If a refresh fails: leave the field unchanged, log a `feynman_timeline_refresh_failed` event (D-10 -- additive on the EVENT_TYPES enum).

- **D-10 (auto-locked) -- EVENT_TYPES extension (additive):** `lib/core/navigation/memory-events.cjs::EVENT_TYPES` Set gains 2 strings -- `feynman_timeline_refreshed` (success; logged by the runner) and `feynman_timeline_refresh_failed` (the runner caught an exception; logged with a redacted reason). Set goes 35 -> 37. Same pattern as Phase 110-02's brain_* extension and Phase 116-00's tension strings.

- **D-11 (auto-locked) -- TEST SUITE shape:**
  - `tests/test-feynman-timeline-renderer.cjs` -- unit: given a fixture room.db with seeded `memory_event` rows (10 events across 4 thresholds), the renderer returns the expected markdown body (snapshot test against a fixture).
  - `tests/test-feynman-timeline-runner.cjs` -- integration: a fixture room with a `FEYNMAN.md` containing sentinels + a human-authored body; runner regenerates; assert (a) sentinel-bounded section replaced with the rendered body, (b) human body byte-identical pre/post, (c) `timeline_last_rendered` frontmatter set, (d) idempotent re-run produces byte-identical output, (e) a memory_event of type `feynman_timeline_refreshed` was logged.
  - `tests/test-feynman-timeline-empty-state.cjs` -- a section with zero memory_event rows renders the `*No timeline events yet.*` placeholder.
  - `tests/test-feynman-timeline-canon-part-9-invariant.cjs` -- adversarial: the renderer never reads anything beyond `room.db`; no `fs.readFile` outside the FEYNMAN.md it's writing; no Brain calls (forbidden-substring sweep mirror of Phase 90's pattern).
  - `tests/run-all-124.sh` -- the scoped bash runner (mirror of `tests/run-all-110.sh` / `run-all-122.sh`).
  - All 4 suites registered in `lib/memory/run-feynman-tests.cjs`. Framework = `node:assert/strict` + `child_process` (no jest/mocha/vitest/zod).

- **D-12 (auto-locked) -- MANUAL COMMAND surface:** `/mos:feynman-timeline-refresh`. `commands/feynman-timeline-refresh.md` carries the Phase 122 frontmatter contract (`kind: utility`, `frameworks: []`, `produces: "room/*/FEYNMAN.md"`, `inputs: []`, `autonomous_safe: true`). Also adds `serves_jtbd: ["validate-idea", "build-knowledge"]` per the Phase 104 sweep convention. `scripts/feynman-timeline-refresh-command.cjs` parses `--all` / `--section <slug>` and delegates to `lib/core/feynman/timeline-runner.cjs`.

### Claude's Discretion (planner picks)

- The exact wording of the templated explanation strings per event_type (e.g. what `findStaleDecisions` rows render as in the Recent / Stale lists). Pull from the Phase 109 insights idioms.
- Whether the runner writes through a debouncer (mirror of `scripts/minto-debouncer.cjs`) or fires synchronously each refresh. Default: synchronous; the session-start cascade already runs in best-effort `|| true` shape so latency is fine.
- The exact ISO format + the "last touched 12 days ago" human delta library (use the existing `lib/core/relative-time.cjs` if one exists; otherwise a 20-line helper colocated with the renderer).
- The session-start watermark comparison granularity (millisecond vs second; pick second to avoid micro-thrash).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Canon (the constitution this phase enforces)
- `docs/MINDRIAN-CANON.md` Part 9 "Memory Locality and Interpretation" (canon v1.4, ratified 2026-05-12) -- "Files preserve meaning. SQL remembers and navigates. Brain reasons. Larry explains. Human confirms." This phase is the **Larry-explains** face of `memory_event`.
- `docs/MINDRIAN-CANON.md` Part 5 "Evidence Is Graded By Context" -- "stale" is a context signal that complements the existing evidence tier.
- `docs/CANON-PHASE-MAP.md` -- the Part 9 row + the v1.13.0 milestone table.

### Upstream phase artifacts (the substrate this consumes)
- `.planning/phases/88-feynman-minto-memory-layer/88-CONTEXT.md` -- the per-folder memory triple (ROOM.md / MINTO.md / FEYNMAN.md). FEYNMAN.md is what we extend.
- `.planning/phases/90-brain-derivation-layer/90-CONTEXT.md` -- the BRAIN.md quadruple. NOT touched by this phase (BRAIN.md is for Brain-derived reasoning; the timeline is purely LOCAL).
- `.planning/phases/109-sql-context-memory-navigation-spine/109-CONTEXT.md` D-03 (memory_event log) + D-04 (the 7 insight primitives incl. `findRecentChanges` + `findStaleDecisions`) + D-05 (navigation.cjs chokepoint) + D-06 (`source_section` provenance).
- `lib/core/navigation.cjs` -- the closed 14-export chokepoint. The renderer calls into this; never bypasses.
- `lib/core/navigation/memory-events.cjs::EVENT_TYPES` -- the closed Set this phase extends (additive +2).
- `lib/core/navigation/insights.cjs` -- the source-of-truth for `findRecentChanges` + `findStaleDecisions` shape + the `source_section` projection.

### Patterns to mirror
- `scripts/vault-section-minto-generator.cjs` + `scripts/minto-debouncer.cjs` -- the per-section regenerator pattern. The Phase 124 runner mirrors its shape but writes a sentinel-bounded section instead of a whole file.
- `scripts/brain-derive-command.cjs` + `commands/brain-derive.md` -- the per-folder regenerator command. `/mos:feynman-timeline-refresh` mirrors this.
- `scripts/session-start` line ~1292 (the cache-prune cascade slot) -- the best-effort `|| true` integration pattern. Phase 124 adds a sibling slot.
- `lib/core/brain-derivation.cjs` (Phase 90 5-tripwire pattern) + `lib/memory/brain-derivation.test.cjs` -- the test idiom (forbidden-substring grep sweep over the renderer output) for the D-11 Canon-Part-9-invariant test.

### Project conventions
- `./CLAUDE.md` -- NO em-dashes (hyphens); CJS not ESM; `node:assert/strict` + `child_process` is the test framework (no jest/mocha/vitest/zod); ICM Layer 0 ROOM.md per directory; the workspace guard; the Release Process.
- `docs/COMMAND-FRONTMATTER.md` (Phase 122) -- the frontmatter contract `/mos:feynman-timeline-refresh` honors.
- The Phase 104 `serves_jtbd` convention.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/navigation.cjs::findRecentChanges(db, sinceEpochMs)` -- THE primary consumer. Returns ranked memory_event rows newer than the threshold.
- `lib/core/navigation.cjs::findStaleDecisions(db, opts)` -- finds nodes whose last touched delta exceeds a threshold. The renderer composes from this.
- `lib/core/navigation/memory-events.cjs::EVENT_TYPES` + `logEvent` -- the closed Set the phase extends additively + the writer the runner uses for `feynman_timeline_refreshed` / `_failed`.
- `lib/core/navigation/insights.cjs` -- the `source_section` projection already works; we reuse the join shape.
- `scripts/vault-section-minto-generator.cjs` -- the per-section regenerator template.
- `scripts/brain-derive-command.cjs` -- the manual command template.

### Established Patterns
- "Sentinel-bounded auto-section in a human-authored file" -- new in this phase, but the closest precedent is the post-write cascade on MINTO.md (the whole file is regenerated; we narrow that to a sentinel-bounded section).
- "Session-start cascade with best-effort `|| true`" (cache-prune Phase 123, brain-derivation-queue Phase 90).
- "Manual `/mos:<thing>` command + a colocated `scripts/<thing>-command.cjs` wrapper" (Phase 122 commands; Phase 90 brain-derive).
- "Closed EVENT_TYPES extension, additive" (Phase 110-02 brain_*, Phase 116-00 tension_*).

### Integration Points
- `scripts/session-start` -- add a sibling cascade slot after cache-prune (line ~1300; conditional on `room.db` existing for the active room).
- `lib/core/navigation/memory-events.cjs` -- extend EVENT_TYPES Set (+2).
- `commands/feynman-timeline-refresh.md` (new) + `scripts/feynman-timeline-refresh-command.cjs` (new) + `data/command-registry.json` regenerated via `scripts/build-command-registry.cjs --refresh-names` (Phase 122 contract).
- `lib/memory/run-feynman-tests.cjs` -- register the 4 new test suites.
- `tests/run-all-124.sh` (new) -- scoped bash runner.
- `docs/CANON-PHASE-MAP.md` -- flip the Phase 124 row from Pending to Shipped at the end of execution.

### What does NOT need touching
- Phase 88's MINTO.md / ROOM.md (no edits; FEYNMAN.md is the only changed file in the triple).
- Phase 90's BRAIN.md (LOCAL only; Brain stays methodology-pure).
- `lib/core/brain-client.cjs` (no Brain calls).
- `scripts/check-schema-aliases.cjs` (no new chokepoint; the renderer uses the existing navigation chokepoint).

</code_context>

<specifics>
## Specific Ideas

- The renderer's invariant: **read SQL only; write FEYNMAN.md only inside the sentinels.** Anything else is a bug.
- The sentinel idiom is the "small bounded auto-section in a human-authored markdown file" pattern. After this phase ships, it may be worth extracting `lib/core/sentinel-section-merge.cjs` as a small helper if a future phase wants the same trick elsewhere. *Out of scope for 124; flag for backlog.*
- The session-start cascade slot is **best-effort** (`|| true`). If the renderer throws, the user's session still starts. The failure is logged via `feynman_timeline_refresh_failed` so it surfaces in `findRecentChanges` next time.
- The `timeline_last_rendered` frontmatter watermark is **second-resolution** to avoid micro-thrash. Compared against `MAX(memory_event.created_at)` for the section -- if the SQL value is greater, regenerate; else skip.

</specifics>

<deferred>
## Deferred Ideas

- **Per-insight inline timestamps** (Option A) -- rejected.
- **Sibling TIMELINE.md file** (Option D) -- deferred. Revisit only if Option B's auto-section proves too noisy or constraining.
- **Body parsing for back-dating** -- explicitly out of scope.
- **Statusline glyph / dashboard surface for stale FEYNMAN sections** -- Phase 125-ish follow-on; flag for backlog.
- **A Brain-side `summarize_timeline` job** in the Phase 110 closed vocabulary -- separate canon discussion.
- **Cross-section timeline aggregation** ("the room's overall timeline") -- a Phase 90 BRAIN.md-style cross-room aggregator could compose these; out of scope here.
- **`lib/core/sentinel-section-merge.cjs` helper extraction** -- worth a small future PR if a second consumer appears.

</deferred>

---

*Phase: 124-feynman-temporal-awareness*
*Context gathered: 2026-05-13 (stub) + 2026-05-13 auto-mode expansion (every remaining gray area locked to recommended defaults: D-04 hook trigger = hybrid session-start + manual; D-05 format = summary + Recent + Stale; D-06 thresholds = 7/30/90; D-07 location = lib/core/feynman/; D-08 scoping = memory_event.source_section join; D-09 watermark = timeline_last_rendered frontmatter; D-10 EVENT_TYPES += feynman_timeline_refreshed / _failed; D-11 4-suite test plan; D-12 /mos:feynman-timeline-refresh command). Decisions surfaced transparently for plan-phase to honor.*
