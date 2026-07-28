---
status: investigating
kind: rca
trigger: "graph-rebuild-truncates-memory-journal"
issue_id: ""
severity: blocker
surfaces: [cli, desktop, cowork]
brain_mode: local-only
canon_parts: [3, 9, 11]
created: 2026-07-28T04:28:39Z
updated: 2026-07-28T04:28:39Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ `c683a4b8`, in the only dev workspace
  `/home/jsagi/dev/MindrianOS-Plugin`, plugin version `1.15.3-beta.51`.
- **WIRE claims probe against:** none. This is a pure LOCAL SQL/source-read finding. No Brain
  call, no network probe, no deployed server involved.
- **Date of audit:** 2026-07-28.
- **Re-verification rule:** every claim below was produced by a command reproduced verbatim in
  Evidence and in the sibling verification ledger
  (`.planning/quick/260728-8wo-file-rca-for-graph-rebuild-truncating-th/260728-8wo-VERIFICATION-LEDGER.md`),
  re-run against this sha before being written down here.

## Current Focus

hypothesis: `rebuildGraph` (`lib/core/lazygraph-ops.cjs:517-660`) runs an unconditional
`DELETE FROM edges; DELETE FROM nodes;` (line 545) against the room's ONE SQLite table that
also holds the append-only `memory_event` audit journal, human-confirmed truth-claim nodes,
decision nodes, and opportunity nodes carrying D-17 append-only `stage_history[]`. The function
re-indexes only filesystem-derived Artifact/Section nodes afterward, so every one of those
other node types is permanently gone once the enclosing transaction commits. The path is
reachable unattended through the MCP `room_graph` tool's `graph-rebuild` command (no gate, no
dry-run) and runs by DEFAULT inside every `runDeriveBackfill` call unless a caller opts out with
`skipRebuild:true`.
test: verified against the working tree by reading `rebuildGraph`'s full body, the memory-event
writer, the D-17 stage-history doctrine comments, the MCP tool-router case block and connector
registry, the `graph-ops.cjs` wrapper, and `graph-backfill.cjs`'s default/race logic; corroborated
by a documented near-miss in `.planning/STATE.md` (Phase 233-03).
expecting: a confirmed contract breach (one table, two populations, no declared ownership scope),
not a guess; the ledger records VERIFIED against all 12 claims plus the transaction analysis.
next_action: a separate follow-up quick task picks one of the three-plus candidate resolutions
in Required Code Changes and implements it. This filing is deliberately NOT that task; no code
under `lib/`, `scripts/`, `hooks/`, or `tests/` is touched here.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.51
- Reported by: background red-team investigation, verified by quick task 260728-8wo
- Date first observed: 2026-07-28
- Related debug sessions: `.planning/debug/resolved/hedge-fold-has-no-production-trigger.md` (the
  sibling filing from the same discipline: that one is silently INERT, a dead learning layer with
  no consequence beyond wasted design intent; this one silently DESTROYS irreplaceable data, with
  no soft-delete and no backup table to recover from, which is why this filing is one severity
  step above that one).

## Problem Statement

`rebuildGraph` truncates the entire `nodes` and `edges` tables and re-populates only what it can
re-derive from files on disk, permanently erasing every human-confirmed truth-claim, decision,
memory-event audit record, and opportunity stage-history row the room ever accumulated. The
destructive path is reachable unattended through the MCP `room_graph` tool and runs by default
inside every `runDeriveBackfill` call.

## Symptoms

expected: `graph-rebuild` refreshes the graph's filesystem-derived structure (Artifact/Section
nodes, wikilink-derived edges) without touching anything that did not come from a file on disk.
actual: it deletes ALL rows in `nodes` and `edges`, filesystem-derived or not, then re-adds only
the filesystem-derived subset. Every `memory_event` row, every confirmed truth-claim, every
decision node, every opportunity's `stage_history[]` is gone after the call completes.
errors: none, and that is the defect's shape. The tool returns
`{ success: true, artifacts: N, sections: M }` (`lib/core/graph-ops.cjs:88`), and N and M are
TRUE counts for what was re-indexed. The report is honest about what it restored and silent
about what it destroyed, which is exactly why the destruction is invisible from the caller's
side.
reproduction:
  1. Take any room with accumulated history: at least one `memory_event` row (written by any
     `recordMemoryEvent` caller through `lib/core/navigation/memory-events.cjs`), one
     human-confirmed truth-claim node, and one opportunity node that has advanced through
     `typed-opportunity.cjs`'s stage machine at least once (so it carries a non-empty
     `stage_history[]`).
  2. Run `SELECT type, COUNT(*) FROM nodes GROUP BY type;` against that room's `.mindrian/room.db`
     and record the counts.
  3. Invoke the MCP `room_graph` tool with `command: 'graph-rebuild'` (or call
     `graphOps.rebuildGraph(roomDir)` directly, or run any `runDeriveBackfill` caller that does
     not pass `skipRebuild: true`, e.g. `scripts/graph-heal-pipeline.cjs`).
  4. Observe the tool's response: `{ success: true, artifacts: N, sections: M }`, no error, no
     warning.
  5. Run the same `SELECT type, COUNT(*) FROM nodes GROUP BY type;` again. `memory_event`,
     confirmed-claim, decision, and opportunity-with-history counts are all zero. Only
     `Artifact` and `Section` counts survive (freshly re-derived, not the original rows).
started: the DELETE has existed since `rebuildGraph`'s original authoring (pre-dates this audit;
no regression commit to bisect to, since the destructive scope was never scoped in the first
place). Phase 233-03 (2026-07-28, same day, earlier session) hit the same statement destroying
its own freshly-written HSI edges and treated it as an ordering bug; see Eliminated and CLAIM-12.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork. All three, because the defect lives in shared
  `lib/core/lazygraph-ops.cjs` and `lib/core/graph-backfill.cjs`, not in any surface adapter.
- Affected commands: the MCP `room_graph` tool's `graph-rebuild` command (`lib/mcp/tool-router.cjs:915-920`),
  and every default (non-`skipRebuild:true`) `runDeriveBackfill` caller, including
  `scripts/graph-heal-pipeline.cjs` (the RCA-mandated heal pipeline: structural-index -> scoped
  HSI -> hsi-to-graph -> cascade-derive).
- Affected users: all installs. The blast radius is WORST for the rooms with the MOST
  accumulated history (the most memory events, the most confirmed claims, the most opportunities
  with deep stage histories), which inverts the usual severity gradient: a brand-new room has
  almost nothing to lose, while a room that has been worked hardest for the longest loses the
  most. That inversion is itself worth stating plainly, since it means the defect's damage grows
  with exactly the kind of use the product is meant to reward.
- Version range: present in `1.15.3-beta.51` and, per the Phase 233-03 near-miss, present before
  it; no version introduced this, since the DELETE's scope was never narrowed at any point in the
  function's history.
- Severity: blocker. CLAIM-05 and CLAIM-07 confirm the MCP path is unattended (no confirmation
  prompt, no Decision Gate, no dry-run, no declared `hitl_shape` anywhere for `room_graph` in
  `data/connector-registry.json`) AND CLAIM-11 confirms no backup, soft-delete, or tombstone
  mechanism exists on this path. Per the deterministic rule this filing follows, that combination
  is `blocker`, not `high`.
- Blast radius: every consumer of the destroyed node types is affected downstream: `contradiction_check`
  and `whitespace_scan` (which read confirmed claims and open questions), any dashboard or wiki
  view that renders `memory_event` history, any opportunity-stage reporting that depends on
  `stage_history[]`, and the outcome-learning fold this repo's own sibling filing
  (`hedge-fold-has-no-production-trigger.md`) documents, which depends on `f_selector_decision`
  rows recorded as part of the same broader node population.

## Eliminated

- hypothesis: "the rebuild re-emits what it deleted, so nothing is actually lost."
  evidence: refuted by CLAIM-02. Reading `rebuildGraph`'s full body (lines 517-660) shows it calls
  only `_indexArtifactBody` over the section walk, the one-level nested-artifact walk, and the
  ROOT-FILES pass, plus a sub-room recursion that opens each sub-room's OWN db. None of these
  paths call `recordMemoryEvent`, any typed-claim writer, any decision-node writer, or any
  opportunity stage-advance function. Only Artifact/Section nodes and their structural edges are
  restored.
  timestamp: 2026-07-28T04:28:39Z

- hypothesis: "the Phase 233-03 `skipRebuild` fix already covers this."
  evidence: refuted by CLAIM-12. That fix addressed STAGE ORDERING ONLY: the heal pipeline wrote
  HSI edges in its stage 3, then `runDeriveBackfill`'s internal rebuild ran as stage 4 and deleted
  them, so `skipRebuild` was added as an opt-in for a caller that has ALREADY indexed the room.
  The DELETE itself stayed completely unscoped, and the default (`opts.skipRebuild === true`,
  false unless explicitly set) still falls toward running it on every caller that does not know
  to opt out. Nobody asked, at the time, whether the same statement also destroys `memory_event`
  rows, confirmed claims, decisions, or `stage_history`.
  timestamp: 2026-07-28T04:28:39Z

- hypothesis: "the explicit `BEGIN`/`COMMIT`/`ROLLBACK` transaction wrapping around the DELETE
  already makes this safe."
  evidence: refuted in part, confirmed in part; see the dedicated SQLite Transaction and
  Concurrency Analysis section below. The transaction wrapping (verified real, at
  `lazygraph-ops.cjs:542-618`) makes the operation ATOMIC and CRASH-SAFE: a hard process kill
  between the DELETE and the reindex leaves the transaction uncommitted, and SQLite discards it on
  next open, so a crash does not leave a permanently half-deleted graph. It does NOT make the
  operation SAFE in the sense this RCA is about: once the transaction reaches a normal, successful
  COMMIT (the overwhelmingly common case), the destroyed rows are exactly as permanently gone as
  they would be without the wrapper, because CLAIM-11 confirms no soft-delete or backup exists at
  any layer. Atomicity is orthogonal to scope; this operation is atomically wrong.
  timestamp: 2026-07-28T04:28:39Z

## Evidence

- timestamp: 2026-07-28T04:28:39Z
  checked: `grep -n "DELETE FROM edges\|DELETE FROM nodes\|function rebuildGraph" lib/core/lazygraph-ops.cjs`
  found: `rebuildGraph` declared at line 517; the DELETE at line 545:
  `conn.exec('DELETE FROM edges; DELETE FROM nodes;')`, unconditional, no WHERE, no type filter.
  implication: the destructive statement targets every row in both tables regardless of type or
  provenance.

- timestamp: 2026-07-28T04:28:39Z
  checked: Read `lib/core/lazygraph-ops.cjs:517-660` in full (the entire `rebuildGraph` body).
  found: after the DELETE, the function restores only Artifact/Section nodes and their
  wikilink-derived edges via `_indexArtifactBody`, across the section walk, the one-level nested
  walk, and the ROOT-FILES pass, then recurses into sub-rooms (each into its own db). No call to
  `recordMemoryEvent`, `typed-claim.cjs`, `evidence-claim.cjs`, `typed-opportunity.cjs`, or any
  decision writer exists anywhere in this function.
  implication: the indexer's restoration scope is exactly the filesystem-derived subset; every
  other node type it deleted stays deleted.

- timestamp: 2026-07-28T04:28:39Z
  checked: `grep -n "INSERT INTO nodes" lib/core/navigation/memory-events.cjs`
  found: line 723-724, `INSERT INTO nodes (id, type, properties, source_path, created_by,
  confidence, review_status, created_at, last_seen_at) VALUES (?, 'memory_event', ?, ?, ?, NULL,
  'confirmed', ?, ?)`.
  implication: the append-only memory-event audit journal shares the exact table `rebuildGraph`
  truncates, with a hard-coded `review_status='confirmed'` on every row.

- timestamp: 2026-07-28T04:28:39Z
  checked: `grep -rn "INSERT INTO nodes" --include=*.cjs lib/ scripts/ | grep -v test`, plus
  `grep -n "stage_history\|APPEND-ONLY\|D-17\|never overwrite\|never-delete" lib/core/navigation/typed-opportunity.cjs lib/core/navigation.cjs`.
  found: production writers into `nodes` beyond memory-events include `typed-claim.cjs:161`
  (truth-claim nodes), `evidence-claim.cjs:169`, `typed-open-question.cjs:115`, `lens-nodes.cjs`,
  `focus.cjs:72`, `planning-artifacts.cjs`, `memory-artifacts.cjs`. `typed-opportunity.cjs:40`
  states "an APPEND-ONLY stage_history[]"; `typed-opportunity.cjs:155` states "D-17's never-delete
  rule"; `navigation.cjs:338` states "an immutable stage_history entry (D-17: never overwrite
  prior state)".
  implication: the doctrine is explicit and repeated across multiple files: these node types are
  designed to be permanent and append-only. `rebuildGraph`'s unconditional DELETE inverts that
  doctrine by construction, not by a rare edge case.

- timestamp: 2026-07-28T04:28:39Z
  checked: Read `lib/mcp/tool-router.cjs:915-920` (the `case 'graph-rebuild':` block) and line 895
  (the `room_graph` tool description).
  found: the case block calls `graphOps.rebuildGraph(roomDir)` directly, with no confirmation
  prompt, no Decision Gate, no dry-run flag, and no row-count warning between the tool
  invocation and the DELETE. The tool's own description reads: "Operate on the room's own
  knowledge graph: build and repair it (graph-index, graph-rebuild)..." -- selling the destructive
  command as repair.
  implication: an agent (or a navigator prompting an agent) can reach the DELETE in one
  unattended MCP call, sold to it as a repair operation, with zero gate in between.

- timestamp: 2026-07-28T04:28:39Z
  checked: `grep -n "hitl_shape\|hitl_why\|hitl_stages" lib/mcp/tool-router.cjs`, cross-checked
  against every `surface` starting `mcp:` in `data/connector-registry.json`'s `connectors` array.
  found: `mcp:graph_query` declares `hitl_shape: "none"` ("Pure read... no fork");
  `mcp:graph_write` declares `hitl_shape: "F.1"` ("Mints a typed graph edge... a material graph
  mutation"). There is NO `mcp:room_graph` entry in the registry at all.
  implication: sibling single-purpose graph tools are correctly classified by destructiveness;
  the multi-command `room_graph` router, which contains the single most destructive graph
  operation in the codebase, carries no classification whatsoever under Canon Part 11.

- timestamp: 2026-07-28T04:28:39Z
  checked: Read `lib/core/graph-ops.cjs:83-93` (the `rebuildGraph` MCP-facing wrapper).
  found: opens the graph, calls `lazygraph.rebuildGraph`, closes the graph, returns
  `{ success: true, artifacts: result.artifacts, sections: result.sections }`. No destroyed-row
  accounting of any kind.
  implication: the reported success is real and simultaneously misleading: true for what it
  measures, silent on what it destroyed.

- timestamp: 2026-07-28T04:28:39Z
  checked: Read `lib/core/graph-backfill.cjs:487-559` (`runDeriveBackfill`'s jsdoc and body), line
  552 (`const skipRebuild = (opts.skipRebuild === true);`).
  found: jsdoc states "skipRebuild (optional, default FALSE...): suppress this function's own
  internal structural rebuild... The internal rebuild is a DELETE FROM edges; DELETE FROM nodes;
  then reindex." Line 550-551 comment: "Default FALSE: absent an explicit opt-in, every pre-233
  caller keeps the internal rebuild it has always had."
  implication: a caller must actively opt OUT of destruction; the default, absent explicit
  action, is to run the unconditional DELETE.

- timestamp: 2026-07-28T04:28:39Z
  checked: Read `lib/core/graph-backfill.cjs:341-421` (`_runBackfillSync` and `_runBackfillAsync`),
  focused on their `_rebuildRoom(t)` calls and the KNOWN, ACCEPTED RACE comment at lines 343-348.
  found: the sync runner fires `_rebuildRoom(t)` WITHOUT `await` (line 353) immediately followed
  by synchronous derivation on the same target; the async runner awaits it (line 421) with an
  explicit sequencing comment. The KNOWN, ACCEPTED RACE comment reads: "this runner is synchronous
  for byte-compat with pre-224 callers, so the async _rebuildRoom is fire-and-forget here --
  derivation may run against the pre-rebuild index and the after-count may read mid-rebuild. A
  caller that needs STEP 2 sequenced before STEP 3 must use the async path."
  implication: the acceptance reasoning behind this documented race is scoped entirely to
  derivation-ordering correctness. It never weighs that the racing statement is the same
  unconditional DELETE that destroys the memory journal; the acceptance addressed ordering, not
  scope-of-destruction.

- timestamp: 2026-07-28T04:28:39Z
  checked: `grep -n "backup\|deleted_at\|tombstone\|archive\|soft" lib/core/lazygraph-ops.cjs`;
  Read the `CREATE TABLE` schema for `nodes` (lines 34-38) and `edges` (lines 51-57).
  found: zero matches for any soft-delete mechanism. `nodes` schema is exactly
  `id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}'`; no `deleted_at`,
  `archived`, or tombstone column exists on either table.
  implication: once a rebuild transaction commits, the destroyed rows have no recovery path
  anywhere in this codebase's own data model.

- timestamp: 2026-07-28T04:28:39Z
  checked: `grep -n "233-03\|fatal as stage" -B 3 -A 10 .planning/STATE.md`
  found: (`.planning/STATE.md:39`, verbatim) "The live run found a defect that reading the code
  could not have. Run end to end against the RCA's own evidence room, the pipeline printed 'wrote
  20 connection edges' into a room that finished with ZERO. Root cause traced:
  `runDeriveBackfill`'s internal `_rebuildRoom` opens with `DELETE FROM edges; DELETE FROM nodes;`,
  which is correct as stage 1 (stage 3 rewrites afterward) and fatal as stage 4 (nothing runs
  after it)... Fixed with an opt-in `skipRebuild` (default OFF, every existing caller
  byte-unchanged), carved out when `approvedBy` is set."
  implication: this repo has already been burned by this exact statement once, root-caused it
  correctly for the ordering failure in front of it, shipped a real fix for that failure, and the
  scoping question this RCA raises went unexamined at the time. The strongest single piece of
  evidence that this is a live, previously-triggered defect class, not a theoretical one.

- timestamp: 2026-07-28T04:28:39Z
  checked: `grep -n "journal_mode" lib/core/lazygraph-ops.cjs`; Read `lib/core/lazygraph-ops.cjs:529-618`
  (the transaction wrapping around the DELETE and reindex).
  found: `openGraph` sets `db.exec('PRAGMA journal_mode = WAL')` unconditionally (line 309).
  `rebuildGraph` wraps its DELETE and full reindex in an explicit `BEGIN` (line 542) / `COMMIT`
  (line 614) / `ROLLBACK`-on-throw (lines 615-617), per a code comment (lines 529-537) that names
  this deliberate: "Wrap entire rebuild in a transaction for atomicity. If anything throws
  mid-rebuild, the DB rolls back to pre-rebuild state," citing "Plan 87-06" as the origin.
  implication: see the dedicated SQLite Transaction and Concurrency Analysis section. This
  confirms the operation is atomic and crash-safe; it does not confirm the operation is safe in
  the sense that matters here, since CLAIM-11 shows the post-commit state has no recovery path.

## SQLite Transaction and Concurrency Analysis

This section discharges the explicit requirement to document the transaction implications of the
DELETE, beyond what the underlying plan text asked for.

1. **Is the DELETE wrapped in a transaction, or run as bare statements?** WRAPPED. Contrary to a
   surface reading of the brief, `rebuildGraph`'s DELETE at `lib/core/lazygraph-ops.cjs:545` sits
   inside an explicit `BEGIN` (line 542) that opens before it and a `COMMIT` (line 614) that closes
   after the ENTIRE reindex (section walk, nested walk, ROOT-FILES pass) completes, with a
   `ROLLBACK` on any thrown error (lines 615-617). This is a real, deliberate transaction boundary,
   not an oversight; the surrounding comment names its own origin ("Plan 87-06") and its own
   purpose (atomicity across the whole rebuild).

2. **What happens if the process crashes between the deletes and the reindex step? Is the delete
   permanent even though the rebuild never finished?** NO, the delete is NOT permanent in that
   scenario. Because the DELETE and the full reindex are one SQLite transaction, a hard process
   kill (SIGKILL, OOM-kill, host power loss) anywhere between line 545 and line 614 leaves that
   transaction uncommitted at the SQLite engine level. This holds independent of the JS-level
   `catch`/`ROLLBACK` (which only fires for a normal JS exception inside the `try`, never for a
   hard kill that never reaches a `catch` at all): SQLite's own durability contract means an
   uncommitted transaction is simply discarded the next time the database is opened, whether via
   rollback-journal replay or WAL-frame discard. The original `nodes`/`edges` rows survive fully
   intact. The failure mode this analysis confirms is UNMITIGATED is the opposite one: the
   ordinary, successful-completion case. Once `COMMIT` succeeds -- which is what happens on every
   call that does not crash or throw, i.e. nearly every call in production -- the destroyed rows
   are exactly as gone as they would be without any transaction wrapper at all, because CLAIM-11
   confirms no soft-delete or backup exists anywhere on this path. The transaction protects against
   a torn, half-rebuilt disk state; it does nothing to protect against a fully-committed, wholly
   successful rebuild that atomically deletes rows it should never have touched.

3. **Under WAL mode, can a concurrent reader with its own connection observe the empty/partial
   state mid-operation before the reindex completes?** NO, for THIS code path specifically,
   because of the same transaction wrapping. `openGraph` sets `PRAGMA journal_mode = WAL`
   unconditionally (`lazygraph-ops.cjs:309`). Under WAL's snapshot-isolation semantics, a separate
   reader connection to the same `room.db` only ever sees COMMITTED data: before `rebuildGraph`'s
   transaction commits, a concurrent reader still sees the full pre-rebuild graph (memory events,
   confirmed claims, decisions, stage histories, all present); the instant it commits, a reader
   starting a fresh read sees the full post-rebuild graph (those rows already gone). There is no
   window in which a concurrent reader observes a genuinely empty or partially-reindexed `nodes`
   table, because that intermediate state is never committed and WAL readers do not see
   uncommitted writes from another connection, regardless of whether the reader itself wraps its
   reads in an explicit transaction.

   This is the OPPOSITE of the shape the task brief flagged for comparison: the Moat/HSI scoring
   layer's own wipe-then-rewrite. Verified directly: `scripts/hsi-to-graph.cjs:61-62` runs
   `conn.prepare("DELETE FROM edges WHERE type = 'HSI_CONNECTION'").run();` immediately followed
   by the equivalent `REVERSE_SALIENT` delete, as BARE autocommit statements with no `BEGIN`/
   `COMMIT` anywhere in that file's write path. Each of those two DELETEs commits to the WAL
   individually, the instant it runs, and is immediately visible to any concurrent reader -- a
   real torn-read window in which a reader connecting between the two deletes, or between the
   deletes and the edge-rewrite loop that follows, observes a table with SOME rows already gone
   and the replacement rows not yet written. `rebuildGraph`'s existing BEGIN/COMMIT wrapping does
   not share that exposure, because the whole delete-plus-reindex sequence is one atomic unit from
   any other connection's point of view.

   **Recommendation:** `rebuildGraph`'s transaction wrapping is already the correct pattern and
   should not be changed on the atomicity axis; if anything, `scripts/hsi-to-graph.cjs`'s
   un-transacted wipe-then-rewrite should be brought into line with it as a separate, out-of-scope
   follow-up (recorded in Non-Code Follow-ups). For `rebuildGraph` itself, wrapping the delete and
   reindex in one transaction is NOT the fix this defect needs, because that wrapping already
   exists and already delivers atomicity; the required fix is narrowing what the DELETE is
   allowed to touch (see Required Code Changes, Change 1). An atomic operation that deletes the
   wrong rows is still, atomically, wrong.

## Technical Root Cause

- Site: `lib/core/lazygraph-ops.cjs:517-660`, function `rebuildGraph`; the destructive statement
  at line 545 inside the `BEGIN`/`COMMIT` block spanning lines 542-618.
- Cause: one SQLite table (`nodes`, and its companion `edges`) serves two populations with
  opposite lifecycles, and nothing in the schema, the function, or the call path distinguishes
  them. The first population is DERIVED: Artifact and Section nodes, and their structural edges,
  built by walking files on disk. This population is correctly disposable, because it can always
  be regenerated by walking the same files again -- deleting it and rebuilding it is the entire
  point of a "rebuild" operation. The second population is ORIGINAL: `memory_event` rows born from
  an append-only audit journal (CLAIM-03), truth-claim nodes born from human confirmation
  (CLAIM-04), decision nodes, and opportunity nodes carrying a D-17 append-only `stage_history[]`
  that the codebase's own doctrine comments repeatedly call "never overwrite" and "never-delete"
  (CLAIM-04). This population exists NOWHERE else; there is no markdown file, no external log, no
  secondary store that `rebuildGraph` (or anything else) could re-derive it from. A rebuild
  operation is only safe over the first population. `rebuildGraph` never declared which rows it
  owns, so its DELETE targets everything and its reindex restores only its own half. The
  generalizable form: a destructive reindex is safe exactly to the degree its ownership scope is
  explicit and enforced; this one has none, at any layer -- not the schema (no `owner` or `source`
  discriminator column usable for a scoped delete), not the function (no type filter on the
  DELETE), and not the call path (no gate before the MCP tool reaches it, no distinction in
  `runDeriveBackfill`'s default between a caller that has irreplaceable state to lose and one that
  does not).
- Why it surfaces now: it never surfaced as THIS finding before. Phase 233-03 hit the identical
  statement from the ordering angle earlier the same day this filing was written (CLAIM-12),
  fixed the ordering with `skipRebuild`, and the scoping question was never asked, because the
  symptom in front of that session was "my own freshly-written edges disappeared," not "a
  navigator's confirmed history disappeared." This filing is the first time the same statement has
  been read for what it does to the second population rather than the first.

## Required Code Changes

None of the following are implemented in this filing. This is filing only, per the plan's explicit
scope; a follow-up quick task picks one.

- Change 1 (recommended):
  - Location: `lib/core/lazygraph-ops.cjs:517-660`, function `rebuildGraph`, specifically the
    DELETE at line 545.
  - Current behavior: `conn.exec('DELETE FROM edges; DELETE FROM nodes;')` targets every row in
    both tables with no type filter.
  - Required behavior: scope the DELETE to only the node and edge types the indexer itself owns
    and can regenerate: `DELETE FROM nodes WHERE type IN ('Artifact', 'Section', ...)` and the
    matching edge-type scoping, driven by an explicit, exported allowlist constant (e.g.
    `INDEXER_OWNED_NODE_TYPES`, `INDEXER_OWNED_EDGE_TYPES`) so the ownership contract becomes DATA
    that other modules and tests can read, rather than an implicit assumption baked into one SQL
    string. `memory_event`, confirmed truth-claim nodes, decision nodes, and any node carrying
    `stage_history` must never appear in that allowlist.
  - Short-term patch: same as the required behavior; this is a small, mechanical, high-value
    change (one SQL string plus one constant), not a multi-step migration.
  - Long-term fix: the same allowlist constant becomes the single source of truth other
    destructive or bulk-scan operations in this codebase (including `scripts/hsi-to-graph.cjs`'s
    own wipe-then-rewrite, flagged separately in Non-Code Follow-ups) can consult, so ownership
    scoping is declared once and enforced everywhere, not re-derived per call site.
  - Recommendation: implement this first. It closes the actual data-loss hole directly, requires
    no behavior change to the MCP surface or to `runDeriveBackfill`'s defaults, and every other
    change in this list becomes strictly defense-in-depth once this one lands.

- Change 2:
  - Location: `lib/mcp/tool-router.cjs:915-920` (the `case 'graph-rebuild':` block) and
    `data/connector-registry.json` (the `connectors` array, which has no `mcp:room_graph` entry).
  - Current behavior: `graph-rebuild` calls `graphOps.rebuildGraph(roomDir)` directly with no
    gate, and the tool as a whole carries no declared `hitl_shape` anywhere.
  - Required behavior: route `graph-rebuild` through a Decision Gate as a material step, with a
    declared `hitl_shape` (mirroring the pattern `mcp:graph_write`'s `F.1` declaration already
    sets), and correct the tool description at line 895 so it no longer sells `graph-rebuild` as
    unqualified "repair" without at least naming what it destroys.
  - Short-term patch: add the `mcp:room_graph` registry entry (or a per-subcommand entry, since
    `graph-index`/`graph-query`/`graph-stats`/the `reasoning-*` and `visualize-*` commands are
    pure reads or additive writes and do not need the same gate as `graph-rebuild`) with an
    explicit `hitl_shape` for the destructive subcommand.
  - Long-term fix: extend Canon Part 11's per-tool declaration discipline to per-SUBCOMMAND
    declarations for any multi-command MCP router tool, since `room_graph` demonstrates that a
    single blanket declaration on a 13-subcommand tool would either over-gate nine harmless reads
    or under-gate the one destructive command.

- Change 3:
  - Location: `lib/core/graph-backfill.cjs:552` (`const skipRebuild = (opts.skipRebuild ===
    true);`) and the un-awaited `_rebuildRoom(t)` call in `_runBackfillSync` (line 353).
  - Current behavior: `skipRebuild` defaults to `false`, so a caller must actively opt OUT of the
    destructive rebuild; the sync runner fires it un-awaited, racing derivation against a
    document-accepted ordering hazard that was never re-examined for its destruction hazard.
  - Required behavior: once Change 1 lands, this default becomes lower-stakes (the rebuild no
    longer destroys anything irreplaceable), but the un-awaited race in `_runBackfillSync` should
    still be resolved on its own merits: either await it (accepting the byte-compat cost the
    original comment cites) or make the sync runner refuse to fire the rebuild un-awaited when the
    target room has any non-indexer-owned rows worth ordering-correctness for.
  - Short-term patch: none beyond Change 1; the ordering race is a correctness concern that Change
    1 defangs as a destruction concern, but does not eliminate as an ordering concern.
  - Long-term fix: re-decide the KNOWN, ACCEPTED RACE acceptance explicitly once Change 1 ships,
    since the original acceptance reasoning (documented at `graph-backfill.cjs:343-348`) never
    weighed the destruction angle at all and should not be treated as still-settled without a
    fresh look.

- Change 4 (optional, defensive receipt):
  - Location: `lib/core/graph-ops.cjs:83-93` (the `rebuildGraph` wrapper) and
    `lib/core/lazygraph-ops.cjs:517-660`.
  - Current behavior: returns `{ success: true, artifacts: N, sections: M }` unconditionally, with
    no accounting of what was destroyed.
  - Required behavior: count non-indexer-owned rows immediately before the DELETE (a single
    `SELECT type, COUNT(*) FROM nodes WHERE type NOT IN (...) GROUP BY type` against the allowlist
    from Change 1) and either refuse the rebuild when that count is nonzero and Change 1 has not
    yet shipped, or report the count in the returned object once Change 1 has shipped, so a
    caller (and any surface rendering the response) can see the true shape of what happened
    instead of a bare `success: true`.
  - Short-term patch: report-only (never refuse), so no existing caller's control flow changes.
  - Long-term fix: same shape, promoted from optional to load-bearing once a surface exists that
    reads it.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: a new `tests/test-graph-rebuild-survival.cjs` (or an addition to the existing
    Phase-169 rebuild test suite if one already exercises `rebuildGraph`)
  - Given: a room seeded with one `memory_event` row (via `recordMemoryEvent`), one confirmed
    truth-claim node, and one opportunity node advanced through `typed-opportunity.cjs`'s stage
    machine at least once (non-empty `stage_history[]`).
  - When: `rebuildGraph` runs against that room (directly, or through `graphOps.rebuildGraph`).
  - Then: all three seeded rows survive with their original `id`, `properties`, and (for the
    opportunity) an UNCHANGED `stage_history[]` array. Mutation-proven: restoring the unscoped
    `DELETE FROM edges; DELETE FROM nodes;` (i.e. reverting Change 1) must turn this test red.
  - Runner registration: add to the phase test runner that owns `lazygraph-ops.cjs` (currently
    exercised piecemeal across the Phase 169 suite; a dedicated `run-all-<phase>.sh` leg once the
    fix phase is assigned a number).

- Test 2:
  - Type: integration
  - Location: same file as Test 1, or a new `tests/test-backfill-default-preserves-journal.cjs`
  - Given: a room seeded as in Test 1.
  - When: `runDeriveBackfill({ roomDir })` runs with DEFAULT options (no `skipRebuild` passed).
  - Then: the `memory_event` count, confirmed-claim count, and opportunity `stage_history[]`
    length are UNCHANGED before and after the call. This closes the gap CLAIM-09 identifies: the
    default path must not reduce these counts, regardless of whether a caller remembered to opt
    out.
  - Runner registration: same runner as Test 1.

- Test 3:
  - Type: source-level gate (grep-gate, comment-stripped per the repo's grep-gate-hygiene idiom)
  - Location: a new `scripts/check-unscoped-node-delete.cjs` or an addition to an existing
    `scripts/check-*.cjs` gate script, wired into the release/commit gate list alongside
    `check-shape-declaration.cjs`.
  - Given: the full `lib/` tree with comments stripped before matching (so the gate cannot be
    self-invalidated by its own header prose describing the pattern it forbids).
  - When: the gate scans for `DELETE FROM nodes` (or `DELETE FROM edges`) with no `WHERE` clause
    anywhere in the comment-stripped source.
  - Then: the gate fails if any unscoped occurrence remains under `lib/` after Change 1 ships. To
    prove the gate is not vacuous, it must ALSO assert against the UNSTRIPPED source that the
    literal token `DELETE FROM nodes` still exists somewhere in the codebase (scoped, with a
    WHERE) -- proving the gate discriminates "unscoped" from "absent" rather than passing because
    nothing matches at all.
  - Runner registration: commit-time and release-time gate list, alongside the existing
    `check-shape-declaration.cjs` / `build-connector-registry.cjs --check` family.

## Non-Code Follow-ups

- CHANGELOG.md: no entry until a resolution ships. This filing changes no behavior.
- Release lockstep: not applicable to this filing.
- Canon: Part 9 (memory locality, only a human confirms a truth-claim node) is the central breach;
  an unattended agent turn that deletes every human-confirmed node inverts that doctrine
  completely. Part 3 (Tri-Context Decision Gate) applies because an unattended destructive step is
  a material choice that never met a Decision Gate. Part 11 (Invocation Constitution) applies
  because `room_graph` carries no declared `hitl_shape` for its one destructive subcommand. All
  three map onto whichever Change above ships; `docs/CANON-PHASE-MAP.md` gets the phase entry at
  that time, not here.
- knowledge-base.md: add the summary block on resolve, not before.
- Dev-Research Compositing (CLAUDE.md): mirrored as a dated entry at
  `~/MindrianRooms/rethinking-mindrianos/research/2026-07-28-graph-rebuild-truncates-memory-journal/2026-07-28-graph-rebuild-truncates-memory-journal.md`,
  cross-linked both directions.
- langtalks-graph-expert consult outcome (CLAUDE.md mandatory dev-work consult, discharged before
  writing this Technical Root Cause): two bounded `relationship_path` queries against the corpus
  ("GraphRAG reindexing" <-> "durable agent memory", and "knowledge graph reindex" <-> "append-only
  audit log") both returned `found: true` but only via WEAK co-occurrence edges (both entities
  merely mentioned in the same general AI-memory-systems podcast episodes, e.g. "From Data to
  Knowledge Graphs: Building Self Improving AI Memory Systems"), with no typed relationship
  describing the specific pattern here (a destructive reindex sharing storage with an append-only
  audit/memory log, and the ownership-scoping fix for it). Recorded honestly as NOT IN THE CORPUS
  YET for this specific pattern, per CLAUDE.md's explicit instruction not to paper over a corpus
  gap with an ungrounded guess.
- Named operational follow-up: any room that has already run `graph-rebuild` (via the MCP tool
  directly, or via any default `runDeriveBackfill` caller such as `scripts/graph-heal-pipeline.cjs`)
  has ALREADY lost its `memory_event` history, confirmed claims, decisions, and opportunity
  stage-histories, and no code fix in this list recovers that data. This is a fact to be surfaced
  to any navigator whose room is affected, not something a schema or code change can undo.
- Named follow-up, out of scope here: `scripts/hsi-to-graph.cjs:61-62` runs its own
  wipe-then-rewrite (`DELETE FROM edges WHERE type = 'HSI_CONNECTION'` / `'REVERSE_SALIENT'`) as
  bare, un-transacted autocommit statements, with a real torn-read window under WAL mode that
  `rebuildGraph`'s own BEGIN/COMMIT wrapping does not share. Bringing it into line with
  `rebuildGraph`'s transaction pattern is a separate, smaller follow-up, tracked here rather than
  fixed in this filing.

## Resolution

root_cause: CONFIRMED per this filing's Evidence and the sibling verification ledger: one SQLite
table (`nodes`, and its companion `edges`) serves two populations with opposite lifecycles
(filesystem-DERIVED and re-generable, versus human/system-ORIGINAL and irreplaceable), and
`rebuildGraph`'s unconditional `DELETE FROM edges; DELETE FROM nodes;` never declared which rows it
owns, so it deletes both populations and restores only the first. No code fix ships in this
filing.
fix: PENDING, filing only.
verification: PENDING.
files_changed: []
commits: []
