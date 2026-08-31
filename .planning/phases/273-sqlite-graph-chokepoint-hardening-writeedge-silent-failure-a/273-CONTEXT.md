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
- **D-01a (research correction, 2026-08-31):** the C1 fix is an ADDITIVE `written: boolean`
  field on `writeEdge`'s return, NOT a change to what `ok` means. 273-RESEARCH.md found 77
  call sites reading `.ok`, ~30 branching on it, and `room-birth.cjs:948` throwing + rolling
  back an entire room birth on `!ok` -- flipping `ok`'s semantics to reflect `changes` would be
  a 43-file regression risk. `ok` keeps meaning "the statement executed without error";
  `written` means "a row was actually inserted/updated." Callers that care about silent
  no-ops (C1's whole point) check the new field; existing callers are unaffected.
- **D-01b (research correction, 2026-08-31):** confirmed by execution -- an
  `openGraph`-opened handle has exactly three tables and no `identity` table (the Phase 224
  migration that adds `review_status` writes its sentinel there and cannot run against this
  handle; `room-db.cjs:31` also requires `lazygraph-ops.cjs` at top level, making a
  migration-side fix circular). The `writeEdge`-side `PRAGMA table_info(edges)` fallback is
  therefore the ONLY viable fix site -- not a preference, a structural conclusion. When the
  fallback detects the column is missing, `writeEdge` returns an explicit
  `review_status_persisted: false` flag rather than silently dropping the value or throwing
  (**D-06**, decided below) -- never mask the gap the way C1's original bug did.
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
  artifact of predating Phase 125-00's `writeEdge`. A remote-controlled bypass of a closed
  allowlist is a real integrity risk either way, and the fix is small and contained. Do not
  lose the reviewer's own open question (`specs/...code-review.md` §6 Q3) -- record it as
  answered-by-fix, not investigated, in case the historical intent matters later.
- **D-03a (research resolution, 2026-08-31):** apply the allowlist check INLINE in
  `ingestion.cjs`, do NOT route the write through `writeEdge`. `ingestion.cjs` uses
  `INSERT OR IGNORE` (skip on conflict); `writeEdge` uses `ON CONFLICT DO UPDATE` (overwrite
  existing edge properties). Routing through `writeEdge` would silently grant the Brain the
  power to mutate existing LOCAL edge properties it does not have today -- a Canon Part 9
  regression introduced by the very phase meant to harden Part 9. This settles the "Claude's
  Discretion" item originally left open in this section.
- **D-05 correction (research, 2026-08-31): D-05's premise was factually wrong, corrected here
  not deleted.** `check-substrate.cjs`'s raw-write count is UNCHANGED by this fix -- confirmed
  by execution two independent ways: `lib/core/navigation/` (where `ingestion.cjs` lives) is
  path-allowlisted at `check-substrate.cjs:70`, AND the guard's `RE_RAW_WRITE` regex does not
  match `INSERT OR IGNORE INTO` syntax at all. Fixing C3 changes the substrate count by
  exactly zero. This phase's M4/D-05 work becomes: re-measure after D-01/D-03 land, confirm
  208 is unchanged, and document BOTH exemption reasons in the baseline reconciliation note.
  The actual `docs/architecture/SUBSTRATE-BASELINE.md` number update is deferred to the
  fast-follow propagation phase (D-02) -- that phase's C4/M5-M8 work is what can actually move
  the count; updating the number here would either lock in unreduced debt or falsely credit
  this phase's fixes for a change they structurally cannot produce.

### M2 -- cross-room aggregation fence
- **D-04:** Fix the comment. The fence already holds structurally: `writeEdge` takes
  `(db, params)` and is physically incapable of opening a second room's db, so the
  enforcement is real even though it isn't an explicit runtime assertion. Correct the
  misleading comment to describe the actual mechanism (a structural guarantee via function
  signature) rather than implying a checked invariant that doesn't exist in code. Do not add
  a new runtime assertion in this phase -- no reproduced or hypothesized code path exists
  where a room's db handle is swapped mid-call, so the added defense-in-depth has no
  identified failure mode to catch yet.
- **D-04a (research correction + navigator decision, 2026-08-31):** the misleading
  "Cross-room aggregation forbidden" comment appears **11 times** in
  `lib/core/navigation/edges.cjs` (lines 45, 64, 236, 269, 366, 419, 583, 629, 667, 705, 746),
  not the 1 (line 45) originally cited by the code review. Fix ALL 11 occurrences, not just
  line 45 -- same false claim repeated, same one-line comment fix, zero functional risk;
  leaving 10 copies of the same corrected lie in place defeats the point of D-04.

### M4 -- substrate baseline drift (195 documented vs. 208 measured)
- **D-05 (superseded by the correction recorded under C3/D-05 above, kept here as the
  section anchor):** see the C3 section's D-05 correction entry -- the original text below is
  struck by that correction and kept only for the paper trail.
  ~~Burn the debt down before touching the baseline number. Re-run
  `scripts/check-substrate.cjs --baseline` after D-01/D-02/D-03 land and measure how much of
  the 195->208 delta those fixes already close (C3's raw `INSERT OR IGNORE` is itself one of
  the 55+ raw-write sites the guard counts, so closing it directly reduces the count).~~ **This
  premise is factually wrong** -- see the D-05 correction under the C3 section above for what
  this phase actually does instead (re-measure, confirm unchanged, document why, defer the
  baseline-number update to the fast-follow phase).

### D-06 -- review_status handling on the PRAGMA fallback path (navigator decision, 2026-08-31)
- **D-06:** When `writeEdge`'s `PRAGMA table_info(edges)` fallback (D-01b) detects the handle
  is missing the `review_status` column, return an explicit `review_status_persisted: false`
  flag on the write result rather than silently dropping the value or throwing. Matches D-01's
  whole point -- never silently mask a data-shape gap, which is exactly the failure class C1
  already proved is dangerous in this same file. A hard reject was considered and rejected:
  it would restore today's crash behavior for a caller shape research could not confirm is
  absent in production (open question: does a live caller actually pass an `openGraph` handle
  into `writeEdge`? -- not worth phase time to answer, same disposition as the C3 Q3 question).

### Claude's Discretion
- Exact commit/wave sequencing of D-01/D-01a/D-01b, D-03/D-03a, D-04/D-04a, and D-06 (e.g.,
  whether C1/C2's shared fix and C3's allowlist fix land in the same commit or separate ones)
  -- not dictated beyond "the two-fix core (D-01) is the highest-priority single change."

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary technical grounding (read first)
- `273-RESEARCH.md` (this phase directory) -- re-verified every code citation below against
  the live checkout, re-reproduced C1/C2/C3 with transcripts, settled the writeEdge-vs-openGraph
  fix-site question definitively (D-01b), and is the source of the D-01a/D-01b/D-03a/D-04a/D-05
  corrections recorded in `<decisions>` above. Six Wave-0 test files identified with concrete
  assert tables -- read its test-convention section before designing new tests.

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
