# Phase 124 - Discuss-Phase Discussion Log

> Human-reference audit trail of the 2026-05-13 `/gsd:discuss-phase 124 -auto` session (auto-mode -- every remaining gray area locked to the recommended default). NOT consumed by downstream agents; they read `124-CONTEXT.md`.

## Setup

- Invoked: `/gsd:discuss-phase 124 -auto` (single-dash typo of `--auto`; intent unambiguous -- auto-mode honored).
- `workflow.discuss_mode` unset -> `discuss` workflow.
- CONTEXT.md existed as a 2026-05-13 stub (7.5KB) -- locked the big shape from the prior day's design conversation: Option B (auto-section, regenerated, sentinel-bounded); the hard invariant (body byte-preserved across regen); deferred A/C/D.
- Prior context loaded: PROJECT.md (Phase 109 + 110 shipped today; Phase 124 stub seeded today as `60818f7`); CANON-PHASE-MAP Part 9 + Part 5; the Phase 88 (memory triple) / Phase 90 (BRAIN.md quadruple) / Phase 109 (memory_event substrate + navigation.cjs chokepoint + `source_section` projection) artifacts.
- Codebase scout (10% context): confirmed `scripts/vault-section-minto-generator.cjs` + `scripts/minto-debouncer.cjs` + `scripts/feynman-minto-guardian.cjs` are the per-section regenerator template; `scripts/brain-derive-command.cjs` + `commands/brain-derive.md` are the manual-command template; `scripts/session-start` line ~1292 has the cache-prune best-effort cascade slot pattern; `lib/core/navigation/insights.cjs` already selects `source_section` from the memory_event rows -- the join key is free. No FEYNMAN.md files currently exist in the dev repo (this is a plugin codebase, not a user room) -- the renderer designs against the Phase-88 schema; no concrete file blocks the implementation.

## Auto-mode decisions (every remaining gray area, locked + transparent)

| # | Gray area | Options considered | Picked (auto-default) | -> CONTEXT |
|---|-----------|---------------------|------------------------|------------|
| D-04 | Hook trigger | (a) post-write cascade on FEYNMAN.md (infinite-loop risk); (b) session-start scan (cheap, ambient); (c) per-memory_event-insert trigger (high-frequency, churns); (d) UserPromptSubmit hook (wrong layer); (e) manual-only (no ambient surface); (f) **hybrid: session-start + manual command**. | **(f) hybrid** -- session-start cascade slot mirrors cache-prune (best-effort `|| true`); manual `/mos:feynman-timeline-refresh` mirrors `/mos:brain-derive`. No infinite-loop, no churn, has ambient surface, has explicit-redraw escape hatch. | D-04 |
| D-05 | Section format | (a) compact (4-6 summary rows); (b) detailed (chronological bullets); (c) **hybrid summary + Recent (top 5) + Stale (top 5)**; (d) full enumeration (no top-N cap, unbounded). | **(c) hybrid** -- bounded length (~12-25 lines per section); summary line + Recent events + Flagged stale + Health counts. Templated explanation strings; zero LLM in the loop. | D-05 |
| D-06 | Stale thresholds | (a) 3/14/60; (b) **7/30/90**; (c) 14/60/180; (d) configurable per-section. | **(b) 7/30/90** -- the sketched cascade from the stub. Overridable via `process.env.MINDRIAN_TIMELINE_THRESHOLDS_JSON` for tests + future tuning. Per-section configurability deferred. | D-06 |
| D-07 | Renderer location | (a) **`lib/core/feynman/timeline-renderer.cjs`**; (b) `lib/core/timeline-renderer.cjs` (flat); (c) extend `lib/core/folder-memory.cjs`. | **(a)** -- new dir `lib/core/feynman/` for the renderer + the runner; ICM Layer 0 ROOM.md per dir. | D-07 |
| D-08 | Section scoping | (a) parse folder name; (b) read ROOM.md identity; (c) **join `memory_event.source_section`**. | **(c)** -- Phase 109 already projects `source_section` on every memory_event row (verified in `insights.cjs`); free join key. | D-08 |
| D-09 | Watermark mechanism | (a) **frontmatter `timeline_last_rendered: <ISO>`**; (b) sidecar `.timeline-state.json`; (c) SQL table `timeline_render_log`; (d) no watermark (always regen). | **(a) frontmatter** -- one place, version-controllable, human-readable. Second-resolution to avoid micro-thrash. Regen unconditional if absent. | D-09 |
| D-10 | EVENT_TYPES extension | (a) additive +2 (`feynman_timeline_refreshed` / `_failed`) -- Phase 116-00 / Phase 110-02 pattern. | **(a) additive** -- 35 -> 37; same idiom that's been used twice already. | D-10 |
| D-11 | Test suite | 4 suites: renderer unit + runner integration + empty-state + Canon-Part-9-invariant grep. | **4 suites** + scoped bash runner (mirror of `tests/run-all-110.sh`). | D-11 |
| D-12 | Manual command surface | (a) **`/mos:feynman-timeline-refresh`** mirroring `/mos:brain-derive` shape; (b) extend `/mos:brain-derive`; (c) no manual command (session-start only). | **(a)** -- discoverable, mirrors an existing shape, Phase 104 `serves_jtbd` + Phase 122 frontmatter applied. | D-12 |

## Surfaced for plan-phase as Claude's Discretion (not locked)

- Templated explanation strings per event_type (in D-05's bullet format).
- Debouncer vs synchronous regen (default synchronous; session-start cascade already in `|| true` form).
- ISO format + the "12 days ago" human-delta helper (use `lib/core/relative-time.cjs` if it exists; else colocate a 20-liner).
- The watermark comparison granularity (second-resolution -- locked above).

## Deferred (carried forward from the stub + 2026-05-13 confirmation)

- Option A (inline body stamps), Option C (A+B), Option D (sibling TIMELINE.md).
- Body parsing for back-dating.
- Statusline / dashboard surface for stale sections (Phase 125-ish).
- A Brain-side `summarize_timeline` job (separate canon discussion).
- Cross-section timeline aggregation (BRAIN.md-style).
- Extracting `lib/core/sentinel-section-merge.cjs` as a reusable helper (worth a small PR if a second consumer appears; not this phase).

## Output

- `124-CONTEXT.md` rewritten: status `Ready for planning`; D-00..D-12 + Claude's Discretion + canonical_refs + code_context + specifics + deferred. Production-quality.
- This log.
- Next: `/gsd:plan-phase 124 --auto` (the shape is fully locked; expect 3-5 plans).
