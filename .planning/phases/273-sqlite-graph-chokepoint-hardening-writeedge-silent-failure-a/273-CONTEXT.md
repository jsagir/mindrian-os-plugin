# Phase 273: SQLite Graph Chokepoint Hardening (writeEdge silent-failure + propagation-gap fixes) - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Repair the write path of `lib/core/navigation.cjs`'s SQLite graph chokepoint -- the single
door this repo's own CLAUDE.md claims all typed edges and `memory_event` nodes are written
through. A code-reviewer-skill pass (`specs/mindrianos-plugin_sqlite-graph-layer_code-review.md`)
found 5 Critical + 12 Major + 10 Minor issues in `lib/core/room-db.cjs`,
`lib/core/navigation.cjs`, `lib/core/navigation/*.cjs`, and `lib/core/node-insert.cjs`, three
of the five Criticals reproduced empirically against this checkout. This phase's job: close
the two highest-value Criticals (C1 `writeEdge` silent-discard, C2 `writeEdge` schema
mismatch against `lazygraph-ops.openGraph`), close C3 (Brain edge-type allowlist bypass),
correct the M2 comment/enforcement mismatch, and reconcile the M4 substrate-baseline drift
(195 documented vs. 208 measured). Full propagation of every good fix to every sibling site
(C4's ~20 openers, M5-M8's transaction/retry/runtime-floor issues) is explicitly a fast-follow,
not this phase's scope.

</domain>

<decisions>
## Implementation Decisions

### Fix scope
- **D-01:** Land the two highest-value fixes now: make `writeEdge`
  (`lib/core/navigation/edges.cjs:833-842`) `changes`-aware (check `run()`'s actual `changes`
  count, don't just return `ok: true` because the query didn't throw), and add the same
  `PRAGMA table_info(edges)` fallback `node-insert.cjs` already uses for `nodes` so `writeEdge`
  degrades gracefully against a `lazygraph-ops.openGraph` handle missing the `review_status`
  column instead of throwing `table edges has no column named review_status`. Per the
  reviewer's own verdict, this single change closes C1 and C2 together, in one function.
- **D-02:** Full propagation of the same fix pattern to its ~20 sibling openers (C4's
  busy-timeout gap), the other 8 `BEGIN` sites lacking the nested-transaction guard (M6), the
  3 migrations with unguarded `ROLLBACK` (M7), and the 33+ call sites not yet consuming typed
  errors (C5/M8) is explicitly OUT of this phase's scope -- registered as a fast-follow phase,
  not silently dropped. Rationale: the two-fix core is landable and high-value on its own;
  full propagation is roadmap-scale work in its own right and would make this phase sprawl.

### C3 -- Brain edge-type allowlist bypass
- **D-03:** Fix defensively, do not spend phase time investigating whether
  `lib/core/navigation/ingestion.cjs:57`'s raw `INSERT OR IGNORE` (which bypasses
  `ALLOWED_EDGE_TYPES` and `writeEdge` entirely) was a deliberate Phase 109-08 exemption or an
  artifact of predating Phase 125-00's `writeEdge`. Route the Brain-ingestion edge write
  through `writeEdge` (or apply the same allowlist check inline if routing through `writeEdge`
  is structurally awkward for the ingestion call shape) regardless of original intent -- a
  remote-controlled bypass of a closed allowlist is a real integrity risk either way, and the
  fix is small and contained. Do not lose the reviewer's own open question (`specs/...code-review.md`
  §6 Q3) -- record it as answered-by-fix, not investigated, in case the historical intent
  matters later.

### M2 -- cross-room aggregation fence
- **D-04:** Fix the comment only. The fence already holds structurally: `writeEdge` takes
  `(db, params)` and is physically incapable of opening a second room's db, so the
  enforcement is real even though it isn't an explicit runtime assertion. Correct
  `lib/core/navigation/edges.cjs:45`'s comment to describe the actual mechanism (a structural
  guarantee via function signature) rather than implying a checked invariant that doesn't
  exist in code. Do not add a new runtime assertion in this phase -- no reproduced or
  hypothesized code path exists where a room's db handle is swapped mid-call, so the added
  defense-in-depth has no identified failure mode to catch yet.

### M4 -- substrate baseline drift (195 documented vs. 208 measured)
- **D-05:** Burn the debt down before touching the baseline number. Re-run
  `scripts/check-substrate.cjs --baseline` after D-01/D-02/D-03 land and measure how much of
  the 195->208 delta those fixes already close (C3's raw `INSERT OR IGNORE` is itself one of
  the 55+ raw-write sites the guard counts, so closing it directly reduces the count). Only
  after that re-measurement does `docs/architecture/SUBSTRATE-BASELINE.md` get updated to the
  new honest number -- never regenerated at 208 as a first move, since that would launder
  debt this same phase is positioned to reduce. If sites remain that are genuinely out of this
  phase's fix scope (e.g. debt belonging to the C4/M5-M8 fast-follow), the baseline update
  documents that explicitly rather than silently absorbing it.

### Claude's Discretion
- Exact commit/wave sequencing of D-01 through D-04 (e.g., whether C1/C2's shared fix and
  C3's allowlist fix land in the same commit or separate ones) -- not dictated beyond "the
  two-fix core (D-01) is the highest-priority single change."
- Whether C3's fix routes through `writeEdge` directly or applies an equivalent inline
  allowlist check -- planner/researcher should confirm which is structurally cleaner against
  `ingestion.cjs`'s actual call shape before committing to one.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The review and its corroboration
- `specs/mindrianos-plugin_sqlite-graph-layer_code-review.md` -- the full code review: all
  5 Critical + 12 Major + 10 Minor findings, the reviewer's own "Questions for the author"
  (§6, directly informs D-03's C3 decision and D-04's M2 decision), and the verdict (§7,
  names the writeEdge changes-aware + PRAGMA fallback fix as highest-value, per D-01).
- `specs/mindrianos-plugin_room-graph-memory_reverse_spec.md` -- independent spec-mining pass
  corroborating the same root weakness from a different angle (`room-birth.cjs`'s
  nested-`BEGIN` silently voiding `setFocus`/`confirmNode` during room creation).
- `docs/architecture/SUBSTRATE-BASELINE.md` -- the stale 195-violation baseline D-05 governs
  the update of. Do not edit until after re-measurement per D-05.

### Prior-art grounding (langtalks-graph-expert, standing consult per CLAUDE.md)
- `.planning/research/2026-08-27-langtalks-grounding-for-phase-272-and-273.md` -- Finding 1
  (HIGH relevance): the navigator's own 2026-07-25 research note already diagnosed the same
  general failure class C1 rediscovered ("a chokepoint reports success while the actual data
  never moves"), at the opposite pipeline end (read-time BFS collapse vs. write-time silent
  discard), backed by the SAG paper (arXiv 2606.15971v1). Read before treating C1 as an
  isolated bug rather than a recurring architectural pattern.
- Same file, Finding 2: independent one-month-apart corroboration that native-extension SQLite
  graph crates (`sqlite-knowledge-graph`, `sqlite-graph`) are the wrong dependency choice for
  this stack (compiled-per-platform cost) -- context for why `dpapathanasiou/simple-graph`
  (pure SQL, no native binary) is the reference implementation named in ROADMAP.md instead.

### Reference implementation (schema/traversal patterns, NOT a dependency to adopt)
- ROADMAP.md's own Phase 273 section, "A second prior-art candidate" subsection --
  `dpapathanasiou/simple-graph`'s `sql/schema.sql` (virtual-column id-derivation pattern,
  relevant to M12) and `sql/traverse.template` (bidirectional recursive-CTE pattern, relevant
  to U-2). Explicitly NOT this phase's scope to port -- named here so planning for a future
  M12/U-2 fix phase doesn't have to re-derive the reference. Two required modifications if
  ever ported are already named in ROADMAP.md: drop the FK constraint (Phase 169 D-169-11
  cross-room reasoning), keep `review_status`/provenance columns as real columns (ICM Layer 4 +
  Canon Part 9 requirement).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/core/node-insert.cjs` -- already implements the `PRAGMA table_info(nodes)` fallback
  pattern D-01 needs to mirror for `edges`. Clone the pattern, don't reinvent it.
- `ALLOWED_EDGE_TYPES` (the closed edge-type allowlist `writeEdge` already enforces) -- D-03's
  fix reuses this existing allowlist rather than inventing a second one.

### Established Patterns
- The Phase 236 (GRAPHDB-02) typed-error taxonomy (`RoomDbBusyError`/`RoomDbBrokenError`) --
  already exists, already well-researched per the reviewer's own positive feedback, just
  under-consumed (2 of 35+ call sites). This phase's C1/C2 fix does not need to invent new
  error types, only make `writeEdge` check what it already has available (`changes` count).
- Phase 169 D-169-11's cross-room `NESTED_WITHIN` reasoning (no FK on `edges.source`/`target`)
  -- constrains any future M12/simple-graph schema work; not touched by this phase's D-01
  through D-05 scope but documented so it isn't accidentally violated later.

### Integration Points
- `writeEdge` (`lib/core/navigation/edges.cjs`) is the single site D-01's fix touches for
  C1+C2. `lib/core/navigation/ingestion.cjs:57` is the site D-03's fix touches for C3.
  `lib/core/navigation/edges.cjs:45`'s comment is the site D-04's fix touches for M2.
  `scripts/check-substrate.cjs` and `docs/architecture/SUBSTRATE-BASELINE.md` are what D-05's
  re-measurement and baseline update touch.

</code_context>

<specifics>
## Specific Ideas

No UI/UX requests -- this is a backend data-integrity and technical-debt-accounting
discussion. All specifics are captured as decisions above.

</specifics>

<deferred>
## Deferred Ideas

- **Full propagation sweep (C4's ~20 openers, M5 BEGIN-IMMEDIATE, M6's 8 remaining
  nested-tx-guard sites, M7's 3 unguarded-ROLLBACK migrations, M8's retry/backoff contract,
  M9's runtime Node-floor assertion, M10's unguarded JSON.parse, M11's hand-rolled SQL
  escaper)** -- explicitly out of scope per D-02, registered as a fast-follow phase once the
  two-fix core (D-01) and C3/M2/M4 (D-03/D-04/D-05) land.
- **M12 schema unification / U-2 bidirectional traversal via the `simple-graph` reference
  pattern** -- named in ROADMAP.md as a reference to plan against, not this phase's scope.
  Future phase should read the canonical_refs entry above before starting that work.
- **SEED-075** (ICM semantic substrate provenance/dependency graph) -- explicitly gated on
  this phase's 5 Critical bugs landing first, per `.planning/seeds/SEED-075-...md`'s own
  sequencing note. Not started here; this phase's two-fix core plus C3/M2/M4 is the
  precondition, not the full precondition list (the fast-follow propagation phase may also
  need to land first -- planner should re-check SEED-075's exact gate condition at that time).

</deferred>

---

*Phase: 273-sqlite-graph-chokepoint-hardening-writeedge-silent-failure-a*
*Context gathered: 2026-08-31*
