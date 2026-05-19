---
phase: 121
slug: trajectory-telemetry
status: ready-for-planning
created: 2026-05-05
refreshed: 2026-05-19
milestone: v1.13.0
canon_parts: [Part 7, Part 8, Part 9]
depends_on:
  - Phase 109 SQL navigation spine (shipped beta.1)
  - Phase 88.1 Plan 16 query-efficiency telemetry (shipped, source pattern)
  - Phase 88.2 + 125 F-shape selector ranker (shipped, capture point)
  - Phase 116 tension hook (shipped beta.5, capture point)
  - Phase 117 auto-explore (shipped beta.8, capture point)
  - Phase 118 30-second-MVA + mva-telemetry.cjs (shipped beta.17, INHERITED writer pattern)
  - Phase 119 room-as-receipt (shipped, capture point)
  - Phase 120 breakthrough-scan Category G (shipped, capture point)
dependents:
  - SEED-002 agent-lightning lab loop (>=100 events trigger)
beta_target: scaffolding + capture wiring ships across remaining v1.13.0 betas; corpus accumulates through final
estimated_days: 1.5 -- 2
related_seeds: [SEED-002]
supersedes: original 2026-05-05 stub (greenfield framing)
---

# Phase 121 -- Trajectory Telemetry (Context)

**Gathered:** 2026-05-19 (refreshed from 2026-05-05 stub)
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 121 delivers the **unified trajectory-event capture surface** for SEED-002's eventual consumption. Specifically:

1. **One** writer module enforcing one schema, one rotation, one Part 8 emit-time validator
2. **One** unified output stream (`~/.mindrian/telemetry/v1.13/events-YYYY-WNN.jsonl`)
3. **One-time migration** of the 4 existing piecemeal telemetry files (`mva.jsonl`, `selector.jsonl`, `navigation-bypass.jsonl`, plus query-efficiency JSONL) into the unified stream
4. **Eight capture points** wired across shipped v1.13.0 surfaces (88.2/125, 116, 117, 118, 119, 120, empathy audit, Hooked re-score) plus a 9th broad PostToolUse sweep in a separate type bucket
5. **Zero processing.** Pure capture. SEED-002 (deferred to v1.14.0+) does the consumption.

**Per Canon Part 7 (Reuse Before Build):** this is a CONSOLIDATION phase, not greenfield. The 2026-05-05 stub framed it as "build the writer module" -- in reality, 4 writers shipped piecemeal across 88.1/109/117/118 and a clean unification is now both possible and required before SEED-002 wakes up.

**Out of scope** (always, per Canon Part 8 + per scope-discipline):
- ANY processing, aggregation, scoring, training, or model interaction
- User-facing telemetry surfaces (silent observability per D-12)
- Cross-user telemetry aggregation (constitutional NEVER -- Canon Part 8)
- agent-lightning installation (deferred until SEED-002 trigger)

</domain>

<decisions>
## Implementation Decisions

### Consolidation Strategy

- **D-01:** Unified single stream at `~/.mindrian/telemetry/v1.13/events-YYYY-WNN.jsonl` with `type` discriminator (`mva.*` / `selector.*` / `nav_bypass` / `tension_engagement` / `auto_explore_decision` / `breakthrough_dismissed` / `hooked_axis_score` / `empathy_observation` / `room_receipt_written` / `command_invocation`). One writer module wraps the proven emit-time-validator pattern from `lib/core/mva-telemetry.cjs`. Simplest SEED-002 ingestion path -- single tail across all event types.

- **D-02:** **One-time idempotent merge script** ships as Plan 121-00. Script `scripts/migrate-telemetry-v1.cjs` reads the 4 existing files (`~/.mindrian/telemetry/mva.jsonl`, `selector.jsonl`, `navigation-bypass.jsonl`, plus `query-efficiency.jsonl` if present), normalizes each row into the unified schema (adds `schema_version: 1`, `type` discriminator, harmonizes timestamp field names), appends to `events-YYYY-WNN.jsonl` in original timestamp order, then renames the originals to `*.jsonl.pre-v121.bak` so they remain inspectable but no longer accept writes. Idempotent: script no-ops if any `events-YYYY-WNN.jsonl` already contains rows from the source files (detect via a sha256 of the first 5 timestamps). `scripts/hooked-rescore-117.cjs` repointed to read the unified stream in the same plan -- single atomic cutover.

- **D-03:** **ISO-week rotation** -- `events-2026-W19.jsonl`, `events-2026-W20.jsonl`, etc. Predictable file names align with beta cadence (~1 beta per week), enable date-window queries, and make gitignore-by-pattern trivial. Matches how the existing telemetry files are loosely organized.

### Capture Surface Scope (Phase 121 wires ALL 9 capture points)

- **D-04:** **F-shape selector picks** (Phase 88.2 + Phase 125 ranker). Every F.0/F.1/F.2/F.3/F.7 verb pick the user makes lands as an event. Event payload includes: sub-shape, mode (A/B/Tier 0), 125-ranker confidence score for the picked option, whether RECOMMENDED was rendered, options_count, room_slug_sha256. THE highest-signal trajectory data per SEED-002 paper -- verb-pick under tri-context IS the navigation graph in motion. The existing `selector.jsonl` (Phase 88.1 Plan 16) is the migration source.

- **D-05:** **Tension hook engagement** (Phase 116). User response to cross-session contradictions surfaced by the hook. Payload: tension_type (contradicts/converges/invalidates), user_response (resolve/defer/ignore), TTR seconds, room_slug_sha256, context_hash. Wires into Phase 116's pending-tension-store emit path.

- **D-06:** **Auto-explore acceptance** (Phase 117). User decision on auto-discovered domains/findings. Payload: finding_type, user_response (kept/redid/ignored), domain_match_score, room_slug_sha256. Wires into Phase 117's PostToolUse auto-explore hook.

- **D-07:** **Breakthrough dismissal + F.7 verb picks** (Phase 120). Surfaced breakthrough event + verb chosen + ethics-fence tier classification (HARD_FLOOR/SOFT_BAND/NEUTRAL/GREEN) + voice-audit pass/fail. Phase 120's D-19 per-detector dismissal-rate canary IS a dismissal-rate telemetry surface -- normalize its events into the unified stream. High signal for variable-reward calibration. Wires into Phase 120's scanner.cjs surfaceBreakthrough path.

- **D-08:** **MVA option router (Phase 118) + Hooked axis re-score** (Phase 117 scripts). Both already have emit-time-validated writers shipped. Phase 121 inherits them via migration -- no new wiring, only schema normalization to add `type` + `schema_version` fields. `lib/core/mva-telemetry.cjs` becomes the architectural ANCESTOR of the new unified writer (its emit-time validator pattern is the model); after Plan 121-00 it becomes a thin shim delegating to the unified writer, then deprecates in v1.14.0.

- **D-09:** **Empathy audit + Room-as-receipt (119) + PostToolUse broad sweep.** Three lower-priority points all land in Phase 121:
  - Empathy audit observations (manual harness): one event per tester observation (engaged_past_15m / handed_back_material / returned_within_48h / TTR).
  - Room-as-receipt writes (Phase 119): one event each time Larry's conversation generates a room as side-effect. Low volume, high signal for Canon Part 10 sub-claim 3 validation.
  - **PostToolUse broad sweep** -- captures every `/mos:*` invocation + outcome + duration under `type: command_invocation` (separate bucket from high-signal events). 100% sampling. Consumers can filter by type -- no drown risk because the bucket is opt-in for ingestion. Cheaper than per-command opt-in frontmatter.

### Schema + Enforcement

- **D-10:** **Frozen v1 schema with per-row `schema_version: 1`.** Every event carries the field. Future schema_version: 2 events can coexist in the same file. Consumer dispatches on version. Cleanest evolution path -- SEED-002 reads v1 + v2 + future via per-version handler. Locks v1 forever (additive-only changes would be allowed but the version bump is the right escape hatch when structural changes land).

- **D-11:** **Emit-time validator inside writer module** -- the canonical Part 8 enforcement layer. Match the `lib/core/mva-telemetry.cjs` pattern: writer rejects events containing forbidden content patterns (Brain query bodies, room artifact strings, user-identifying free text) at emit time, throws if detected. Single chokepoint per Canon Part 9 (navigation.cjs precedent). Pre-commit guard is redundant under this pattern -- the emit-time path IS the guard. Already proven safe across 6 months of MVA telemetry in production.

- **D-12:** **Silent observability** -- no user-facing surface for corpus accumulation toward SEED-002's >=100 trigger. Telemetry is lab-side concern. User doesn't need to see it. SEED-002's `/gsd:new-milestone` trigger scan reads + decides when threshold hits. Lower cognitive load, no premature commitment to a `/mos:status` row or dashboard widget that may not survive when SEED-002 takes over.

### Claude's Discretion

Planner picks:
- Exact module location for the unified writer (`lib/core/telemetry/writer.cjs` vs `lib/core/trajectory-telemetry.cjs` vs extension of `lib/core/mva-telemetry.cjs`)
- Exact filename pattern conventions for the per-week files (zero-padded week? `2026-W05` vs `2026-W5`?)
- Backup naming convention for the originals (`*.pre-v121.bak` is fine; planner may prefer `*.archived-by-phase-121.jsonl`)
- Test strategy for the emit-time validator (unit tests + a Canon Part 8 adversarial fixture suite mirroring Phase 110-05's seed-pattern approach)
- Whether `lib/core/mva-telemetry.cjs` ships a deprecation warning in v1.13.0 or stays silent until v1.14.0

### Folded Todos

None -- `todo match-phase 121` returned zero matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 121 source materials
- `.planning/phases/121-trajectory-telemetry/121-CONTEXT.md` (this file)
- `.planning/v1.13.1-EXECUTION-PLAN.md` Wave 2 section (paragraph "Stream C: /gsd:discuss-phase 121 -> plan -> execute -> next beta (parallel)")
- `.planning/seeds/SEED-002-agent-lightning-lab-loop.md` (the downstream consumer; refinement entry 2026-05-05 explicitly names Phase 121 as activation gate)

### Canon
- `docs/MINDRIAN-CANON.md` Part 7 (Reuse Before Build -- the framing reversal that makes this a consolidation phase, not greenfield)
- `docs/MINDRIAN-CANON.md` Part 8 (Graph Boundary -- the constitutional reason emit-time validation is non-negotiable; the LOCAL-only telemetry locality requirement)
- `docs/MINDRIAN-CANON.md` Part 9 (Memory Locality and Interpretation -- single-chokepoint pattern that the writer module honors)
- `docs/CANON-PHASE-MAP.md` Part 8 row "Plan 88.1-16 query efficiency telemetry is Part 8-compliant" -- precedent for LOCAL JSONL telemetry under Canon Part 8

### Existing telemetry surfaces (Phase 121 consolidates these)
- `lib/core/mva-telemetry.cjs` -- THE architectural ancestor. Emit-time-validator pattern. Schema-enforced. ~6 months proven. Phase 121's unified writer copies its shape verbatim.
- `lib/core/mva-option-router.cjs` (lines 152, 254) -- consumer of mva-telemetry.cjs; references the same `~/.mindrian/telemetry/v1.13/mva.jsonl` path
- `scripts/query-efficiency-telemetry.cjs` -- Phase 88.1 Plan 16 writer; second migration source
- `scripts/hooked-rescore-117.cjs` -- consumer that already reads `~/.mindrian/telemetry/v1.13/*.jsonl`; must be repointed in Plan 121-00 atomic cutover
- `lib/memory/query-efficiency-telemetry.test.cjs` -- proven test pattern for emit-time validator coverage
- `~/.mindrian/telemetry/mva.jsonl` (production data, migration source 1)
- `~/.mindrian/telemetry/selector.jsonl` (production data, migration source 2)
- `~/.mindrian/telemetry/navigation-bypass.jsonl` (production data, migration source 3)
- `~/.mindrian/telemetry/v1.13/mva.jsonl` (production data, migration source 4 if separate from root)

### Capture-point source modules
- `lib/hmi/selector-dispatcher.cjs` + `lib/hmi/shape-f7-breakthrough-renderer.cjs` (D-04 wire-in)
- `lib/memory/pending-tension-store.cjs` (D-05 wire-in for Phase 116 tension events)
- Phase 117 auto-explore hooks (D-06 wire-in; locate via `grep -rn auto-explore lib/ scripts/ hooks/`)
- `lib/core/breakthrough/scanner.cjs` + `lib/core/breakthrough/canary.cjs` (D-07 wire-in for Phase 120 dismissal events)
- Phase 119 receipt write surface (D-09; locate via the Phase 119 SUMMARY files in `.planning/phases/119-room-as-receipt-invariant/`)

### Downstream consumer
- arXiv 2508.03680 (agent-lightning paper) -- the APO loop pattern SEED-002 implements. Phase 121's schema choices must NOT preclude span-based consumption (i.e. timestamps must be ISO-8601, ordering must be stable per file, room/session boundaries must be discoverable from the event stream alone)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Canon Part 7 -- ~85% reuse)

- **`lib/core/mva-telemetry.cjs`** -- the emit-time-validator pattern. Phase 121's unified writer copies this shape: single `emit(event, payload)` entry point, schema validation at write time, throws on Part 8 forbidden patterns, atomic JSONL append. The new writer extends with: `type` discriminator routing, per-week rotation, broader event-type schema dispatch.
- **`scripts/query-efficiency-telemetry.cjs`** -- Phase 88.1 Plan 16 precedent. Confirms the "LOCAL JSONL under `~/.mindrian/telemetry/`" architectural decision is already a project norm.
- **`scripts/hooked-rescore-117.cjs`** (line 19 has the Canon Part 8 reference comment) -- proves the consumer side. Phase 121 repoints its read path from the 4 source files to the unified stream.
- **`lib/memory/query-efficiency-telemetry.test.cjs`** -- proven test pattern for emit-time validator coverage. New tests for the unified writer mirror this structure.

### Established Patterns

- **LOCAL JSONL telemetry under `~/.mindrian/telemetry/`** -- proven, Canon Part 8 compliant, zero network surface. Phase 121 stays inside this established locality.
- **Emit-time validation** -- mva-telemetry's pattern is the model. Single chokepoint matches Canon Part 9 navigation.cjs architecture.
- **Per-version subdirectory** (`~/.mindrian/telemetry/v1.13/`) -- already the convention. Phase 121's per-week files live inside it. v1.14.0+ will start fresh in `~/.mindrian/telemetry/v1.14/` when the next milestone cuts.

### Integration Points

- `scripts/hooked-rescore-117.cjs` (read path -- repoint to unified stream in Plan 121-00 atomic cutover)
- `lib/core/mva-option-router.cjs` (lines 152, 254 -- write path -- delegate via shim or repoint to unified writer)
- 8 capture-point wire-ins (D-04 through D-09) -- each is a 5-20 line addition to an existing module's existing emit path
- Plan 121-00 migration script bootstraps the unified stream; subsequent plans wire individual capture points

### Reuse-vs-Build Audit (per Canon Part 7)

- Build new: `lib/core/telemetry/writer.cjs` (single unified entry point) -- ~200 LOC
- Build new: `scripts/migrate-telemetry-v1.cjs` (one-time idempotent migration) -- ~150 LOC
- Reuse: `lib/core/mva-telemetry.cjs` pattern verbatim
- Reuse: emit path of all 8 capture-point modules (D-04 -- D-09)
- Reuse: test pattern from `query-efficiency-telemetry.test.cjs`
- Reuse: file locality + naming convention from existing telemetry sub-tree

Net new LOC: ~400. Net consolidation impact: 4 writers + 4 readers collapse to 1 writer + 1 reader.

</code_context>

<specifics>
## Specific Ideas

- The 2026-05-05 stub said this was a 1-day phase. Refresh: ~1.5 -- 2 days, because consolidation work is added scope. The merge script (Plan 121-00) is the load-bearing first plan; getting it idempotent + correct unblocks everything downstream.
- Plan 121-00 must ship the unified writer + the migration script + the hooked-rescore-117 repoint as ONE atomic plan. Splitting them risks a half-migrated state where the consumer reads stale data.
- The PostToolUse `command_invocation` bucket (D-09) is the wildcard. If the volume is unexpectedly high (>500 events/session), revisit at Plan 121-04 -- can drop to 10% sampling without schema break (just adds `sampled: true/false` to the row).
- The unified writer module location is Claude's discretion, but suggested: `lib/core/telemetry/writer.cjs` with sibling `lib/core/telemetry/validator.cjs` (the Part 8 emit-time validator broken out for adversarial testing).

</specifics>

<deferred>
## Deferred Ideas

- **`lib/core/mva-telemetry.cjs` deprecation timeline** -- after Plan 121-00 makes it a shim, the actual deletion belongs in v1.14.0. Captured as a v1.14.0 housekeeping todo, NOT in this phase.
- **agent-lightning consumption pipeline** -- SEED-002's domain. Activates when >=100 events accumulate. NOT this phase.
- **Cross-user telemetry aggregation** -- constitutional NEVER (Canon Part 8). Filed here so future phase planners know this was already rejected.
- **Per-command frontmatter telemetry opt-in** (`telemetry: true` per `/mos:*.md` command) -- considered for the PostToolUse broad sweep, rejected in favor of single-bucket 100% sampling (D-09). If volume issues surface, can be added in v1.14.0 without schema break.
- **User-facing corpus surface** (e.g. `Trajectory corpus: 47 / 100 events` in `/mos:status`) -- explicitly rejected (D-12 silent observability). Filed here so future planners don't re-propose without revisiting the rationale.
- **Dashboard widget for telemetry** -- same rejection as above.
- **Pre-commit guard scanning files post-write** -- redundant under D-11 emit-time validation. Not added.
- **Reviewed Todos (not folded):** none -- `todo match-phase 121` returned zero matches; no backlog items relevant to this phase.

</deferred>

---

*Phase: 121-trajectory-telemetry*
*Context refreshed: 2026-05-19*
*Supersedes 2026-05-05 stub (greenfield framing)*
