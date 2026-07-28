# Verification Ledger - quick task 260728-8wo

Pinned source of truth: branch `main` @ `c683a4b8` (short sha), plugin version `1.15.3-beta.51`,
in `/home/jsagi/dev/MindrianOS-Plugin` (the only dev workspace). Every claim below is read
against this sha.

### CLAIM-01

command: `grep -n "DELETE FROM edges\|DELETE FROM nodes\|function rebuildGraph" lib/core/lazygraph-ops.cjs`
output:
```
517:async function rebuildGraph(conn, roomDir, _visited) {
545:    conn.exec('DELETE FROM edges; DELETE FROM nodes;');
```
verdict: DRIFTED (substance VERIFIED, line number differs from the brief's "around line 545",
which is actually exact for the DELETE statement; `rebuildGraph`'s own declaration is line 517,
not 545).
note: read in full context (`lib/core/lazygraph-ops.cjs:517-660`), the statement at line 545 is
UNCONDITIONAL: no type filter, no WHERE clause, targets the entire `edges` and `nodes` tables.
It sits inside an explicit `BEGIN` (line 542) / `COMMIT` (line 614) / `ROLLBACK`-on-throw (line
616) block, which the brief's framing did not anticipate; see the dedicated transaction analysis
in the RCA's Technical Root Cause and the new "SQLite Transaction Analysis" section. The
unconditional scope of the DELETE is confirmed exactly as claimed.

### CLAIM-02

command: `Read lib/core/lazygraph-ops.cjs` lines 517-660 (full body of `rebuildGraph`, declaration
through its final `return`).
output: after the DELETE (line 545) and inside the same transaction, the function only: (a) walks
every section directory found by `discoverSections`, indexing indexable files via
`_indexArtifactBody` (lines 547-561); (b) descends exactly one level into each section's child
directories for the Obsidian-nested-artifact convention, skipping any child carrying a
`.room-root` sentinel (lines 562-593); (c) indexes top-level ROOT .md/.docx/.html files (lines
596-612); (d) after COMMIT, recurses into direct sub-rooms, rebuilding each into its OWN room.db
via a fresh connection (lines 620-652).
verdict: VERIFIED.
note: every re-added row comes from `_indexArtifactBody`, which (per its own header comment at
lines 341-352) creates only Artifact/Section nodes and BELONGS_TO/INFORMS/CONTRADICTS edges
derived from wikilink scanning of file content on disk. Nothing in the function body calls
`recordMemoryEvent`, any `typed-claim.cjs`/`evidence-claim.cjs` writer, any
`typed-opportunity.cjs` stage-advance function, or any decision-node writer. The exact scope of
what is restored is: filesystem-derived Artifact and Section nodes plus their structural edges,
and nothing else.

### CLAIM-03

command: `grep -n "INSERT INTO nodes" lib/core/navigation/memory-events.cjs`
output: `723:      "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +`
verdict: VERIFIED.
note: the full statement (lines 722-725) is
`INSERT INTO nodes (...) VALUES (?, 'memory_event', ?, ?, ?, NULL, 'confirmed', ?, ?)`, i.e. the
memory-event writer targets the SAME `nodes` table `rebuildGraph` truncates, with a literal
`type='memory_event'` and a literal `review_status='confirmed'`.

### CLAIM-04

command: `grep -rn "INSERT INTO nodes" --include=*.cjs lib/ scripts/ | grep -v test` and
`grep -n "stage_history" lib/core/navigation/typed-opportunity.cjs`
output (representative, non-test production writers into `nodes`): `memory-events.cjs:723`
(memory_event, confirmed), `typed-claim.cjs:161` (truth-claim nodes), `evidence-claim.cjs:169`,
`planning-artifacts.cjs:136,175`, `memory-artifacts.cjs:223,270,308,388`,
`typed-open-question.cjs:115`, `lens-nodes.cjs:117,208`, `focus.cjs:72`, `ingestion.cjs:43`,
`node-insert.cjs:105,117` (the generic writer, but see `close-loop-writer.cjs:19`, which states it
issues NO raw INSERT and routes only through typed writers). `typed-opportunity.cjs` carries
`stage_history` at lines 40, 73, 96, 114, 136, 155, 183, 191, 231, 246, 253, 286, 320-326, 289.
Doctrine quotes: `typed-opportunity.cjs:40` "(open|deferred|rejected|archived) AND an APPEND-ONLY
stage_history[] of", `typed-opportunity.cjs:155` "D-17's never-delete rule",
`typed-opportunity.cjs:192` "every move lands in the append-only", `navigation.cjs:338`
"an immutable stage_history entry (D-17: never overwrite prior state)".
verdict: VERIFIED.
note: the destroyed node types include, at minimum: `memory_event` (append-only audit journal,
always `review_status='confirmed'`), truth-claim nodes written by `typed-claim.cjs` and
`evidence-claim.cjs`, open-question nodes (`typed-open-question.cjs`), lens/persona nodes
(`lens-nodes.cjs`), planning-artifact and memory-artifact nodes, focus nodes (`focus.cjs`), and
opportunity nodes carrying the D-17 append-only `stage_history[]` (`typed-opportunity.cjs`). None
of these types are re-emitted anywhere inside `rebuildGraph`.

### CLAIM-05

command: `grep -n "graph-rebuild" lib/mcp/tool-router.cjs` then read the `case 'graph-rebuild':`
block (lines 915-920).
output:
```
915:        case 'graph-rebuild': {
916:          const graphOps = require('../core/graph-ops.cjs');
917:          const rebuildResult = await graphOps.rebuildGraph(roomDir);
918:          await fireCascade(roomDir, command, section, rebuildResult);
919:          return textResponse(JSON.stringify(rebuildResult, null, 2) + formatSuggestedNext(...));
920:        }
```
verdict: VERIFIED.
note: the case block calls `graphOps.rebuildGraph(roomDir)` directly on receiving the command, with
no confirmation prompt, no Decision Gate call, no dry-run parameter, and no row-count warning
between the tool invocation and the DELETE. `fireCascade` runs AFTER the rebuild already
completed, so it cannot gate it.

### CLAIM-06

command: `Read lib/mcp/tool-router.cjs` line 895 (the `room_graph` tool description string).
output: `"Operate on the room's own knowledge graph: build and repair it (graph-index,
graph-rebuild), interrogate it (graph-query, graph-stats), ..."`
verdict: VERIFIED.
note: the literal phrase "build and repair it (graph-index, graph-rebuild)" is the tool's own
sales pitch for the destructive command, framing it as repair rather than as a full truncate.

### CLAIM-07

command: `grep -n "hitl_shape\|hitl_why\|hitl_stages" lib/mcp/tool-router.cjs`, then cross-checked
against `data/connector-registry.json`'s `connectors` array (198 entries) filtered to every
`surface` starting with `mcp:`.
output: the only `hitl_shape` hits in `tool-router.cjs` belong to OTHER tools (`room_bind`'s F.8
card at lines 1820-1821, an unrelated `eureka`/`criticRule` comment at lines 81 and 1686 declaring
`hitl_shape: none`). The connector registry enumerates `mcp:graph_query` (`hitl_shape: "none"`,
reason "Pure read... no fork") and `mcp:graph_write` (`hitl_shape: "F.1"`, reason "Mints a typed
graph edge... a material graph mutation") as siblings, but there is NO `mcp:room_graph` entry in
the registry at all (0 matches for `room_graph` anywhere in `data/connector-registry.json`).
verdict: VERIFIED.
note: `room_graph` (the 13-subcommand router covering `graph-index`, `graph-rebuild`,
`graph-query`, `graph-stats`, the six `reasoning-*` commands, and three `visualize-*` commands)
carries NO declared HITL shape anywhere: not in the tool-router source, not in the connector
registry that already distinguishes a read tool (`graph_query`, none) from a write tool
(`graph_write`, F.1). The single most destructive subcommand this tool exposes is unclassified.

### CLAIM-08

command: `grep -n "async function rebuildGraph" lib/core/graph-ops.cjs`, then read the body
(lines 83-93).
output:
```
83: async function rebuildGraph(roomDir) {
84:   return enqueueWrite(roomDir, async () => {
85:     const { db, conn } = await lazygraph.openGraph(roomDir);
86:     try {
87:       const result = await lazygraph.rebuildGraph(conn, roomDir);
88:       return { success: true, artifacts: result.artifacts, sections: result.sections };
89:     } finally {
90:       await lazygraph.closeGraph(db);
91:     }
92:   });
93: }
```
verdict: VERIFIED.
note: opens the graph, calls `lazygraph.rebuildGraph`, closes the graph, and returns
`{ success: true, artifacts: N, sections: M }`. No destroyed-row count of any kind (no
`memory_event` count, no confirmed-claim count, no opportunity count) is computed or reported;
`success: true` is unconditional on the underlying rebuild resolving without throwing.

### CLAIM-09

command: `grep -n "skipRebuild\|_rebuildRoom" lib/core/graph-backfill.cjs`, then read the
`runDeriveBackfill` jsdoc (lines 487-516) and the `skipRebuild` assignment (line 552).
output: `552:  const skipRebuild = (opts.skipRebuild === true);` preceded by the comment (lines
550-551) "Default FALSE: absent an explicit opt-in, every pre-233 caller keeps the internal
rebuild it has always had." The jsdoc (lines 493-503) states plainly: "skipRebuild (optional,
default FALSE...): suppress this function's own internal structural rebuild... The internal
rebuild is a DELETE FROM edges; DELETE FROM nodes; then reindex."
verdict: VERIFIED.
note: the default falls toward destruction. A caller must explicitly pass `skipRebuild: true` to
avoid the internal wipe; every caller that does not know about this option (or forgets to set it)
gets the destructive rebuild by default. The jsdoc even names the caller that MUST NOT skip it
("A caller that heals folders (approvedBy) must NOT, because a freshly-minted child room still
needs its first index pass"), confirming the DELETE is reachable, by default, from the routine
child-room-healing path.

### CLAIM-10

command: `Read lib/core/graph-backfill.cjs` lines 195-204 (`_rebuildRoom`), 341-371
(`_runBackfillSync`), 379-421 (`_runBackfillAsync`).
output: `_runBackfillSync` (line 353): `if (!skipRebuild) { try { _rebuildRoom(t); } catch (_e) {
/* tolerate */ } }` -- called WITHOUT `await`, immediately followed by synchronous derivation work
on the same target. `_runBackfillAsync` (line 421): `if (!skipRebuild) { try { await
_rebuildRoom(t); } catch (_e) { /* tolerate */ } }` -- awaited, with the preceding comment (lines
414-417) stating "STEP 2 is SEQUENCED here: the rebuild is awaited so derivation never runs
against a not-yet-rebuilt index... and the after-count never reads mid-rebuild."
The KNOWN, ACCEPTED RACE comment (lines 343-348) reads verbatim: "this runner is synchronous for
byte-compat with pre-224 callers, so the async _rebuildRoom is fire-and-forget here -- derivation
may run against the pre-rebuild index and the after-count may read mid-rebuild. A caller that
needs STEP 2 sequenced before STEP 3 must use the async path."
verdict: VERIFIED.
note: the sync path fires `_rebuildRoom` un-awaited (a genuine race with the DELETE still
in-flight when derivation reads); the async path awaits it. The acceptance reasoning in the
KNOWN, ACCEPTED RACE comment is scoped ENTIRELY to derivation-ordering correctness (does
derivation see the rebuilt index, does the after-count land post-rebuild). It never once weighs
that the racing statement is also the same unconditional `DELETE FROM edges; DELETE FROM nodes;`
that destroys the memory journal, confirmed claims, decisions, and stage_history -- the acceptance
was scoped to ordering, not to scope-of-destruction.

### CLAIM-11

command: `grep -n "backup\|deleted_at\|tombstone\|archive\|soft" lib/core/lazygraph-ops.cjs`, and
`Read` the `CREATE TABLE` schema block (lines 34-38 for `nodes`, 51-57 for `edges`).
output: zero matches for `backup`, `deleted_at`, `tombstone`, or `soft` in `lazygraph-ops.cjs`
(the only `archive` hits are unrelated to this path). The `nodes` schema is exactly
`id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}'`; the `edges` schema is
exactly `source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT
'{}', PRIMARY KEY (source, target, type)`. Neither table carries a `deleted_at`, `archived`, or
any other soft-delete column.
verdict: VERIFIED.
note: confirmed. There is no soft-delete, no backup table, no tombstone, and no archive mechanism
anywhere on this path. Once a `rebuildGraph` transaction reaches `COMMIT`, the deleted rows are
gone from `room.db` with nothing on disk to recover them from (short of a filesystem-level backup
outside this codebase's control, e.g. a user's own `.git` history of markdown files, which does
NOT cover `room.db` itself since it lives under `.mindrian/` and is not the artifact source).

### CLAIM-12

command: `grep -n "233-03\|fatal as stage" -B 3 -A 10 .planning/STATE.md`
output (verbatim, `.planning/STATE.md:39`): "The live run found a defect that reading the code
could not have. Run end to end against the RCA's own evidence room, the pipeline printed 'wrote
20 connection edges' into a room that finished with ZERO. Root cause traced: `runDeriveBackfill`'s
internal `_rebuildRoom` opens with `DELETE FROM edges; DELETE FROM nodes;`, which is correct as
stage 1 (stage 3 rewrites afterward) and fatal as stage 4 (nothing runs after it). That is the
same confident-success-over-empty-result shape this whole phase is about, reproduced inside its
own fix. Fixed with an opt-in `skipRebuild` (default OFF, every existing caller byte-unchanged),
carved out when `approvedBy` is set." Corroborated by `.planning/STATE.md:3025`: "Phase 233-03:
runDeriveBackfill gained an opt-in skipRebuild (default off) because its internal DELETE-then-
reindex was erasing the HSI edges the heal pipeline stage 3 had just written."
verdict: VERIFIED.
note: this is a near-miss receipt, not a fix of the finding in this RCA. Phase 233-03 hit the
exact same DELETE statement destroying its OWN freshly-written `HSI_CONNECTION`/`REVERSE_SALIENT`
edges during a live run, root-caused it as a STAGE-ORDERING problem (the rebuild ran after the
edges it should have preserved), and shipped `skipRebuild` as an opt-in fix for ORDERING. The
DELETE itself stayed completely unscoped, and the default still falls toward running it (CLAIM-09).
Nobody asked, at that time, whether the same statement also destroys `memory_event` rows,
confirmed claims, decisions, or `stage_history` on every call that does not pass `skipRebuild:true`.

### Optional check: production callers of `runDeriveBackfill`

command: `grep -rn "runDeriveBackfill" --include=*.cjs lib/ scripts/`
output: production callers are `scripts/graph-heal-pipeline.cjs:285` (`const r = await
runDeriveBackfill(args)`, part of the RCA-mandated heal pipeline: structural-index -> scoped HSI
-> hsi-to-graph -> cascade-derive) and comments referencing it in
`lib/workflow/reach-hedge-ranker.cjs:444` and `scripts/hedge-refit-pipeline.cjs:132` (both
precedent-citing comments, not additional call sites).
verdict: VERIFIED (recorded for completeness; not one of the 12 required claims).
note: `graph-heal-pipeline.cjs` is the one production entry point exercising this path today,
navigator-triggered per its own header comment ("Navigator-triggered only, never on the write
path"). It does not appear to pass `skipRebuild: true` in the grepped call, so it takes the
default (destructive) path per CLAIM-09.

## SQLite Transaction Analysis (explicit user requirement, beyond the plan text)

This section verifies the three specific sub-questions the task brief required beyond the
plan's own CLAIM-01 through CLAIM-12, and the recommendation that follows from them. Full detail
and the contrast with the Moat/HSI scoring layer sit in the RCA's own "SQLite Transaction and
Concurrency Analysis" section; this ledger entry is the command-backed source for it.

1. **Wrapped in a transaction, or bare statements?** WRAPPED. `lib/core/lazygraph-ops.cjs:542`
   runs `conn.prepare('BEGIN').run();` BEFORE the DELETE at line 545, and `conn.prepare('COMMIT').run();`
   at line 614 AFTER the full reindex (section walk + nested walk + ROOT-FILES pass) completes,
   with an explicit `catch` at line 615-617 that runs `ROLLBACK` and re-throws on any error inside
   the try block. This is DIFFERENT from what the task brief's phrasing implied; the code comment
   at lines 529-537 names it explicitly: "Wrap entire rebuild in a transaction for atomicity. If
   anything throws mid-rebuild, the DB rolls back to pre-rebuild state," with a NOTE citing
   "Plan 87-06" as the origin of the explicit BEGIN/COMMIT/ROLLBACK pattern (chosen because
   node:sqlite's `DatabaseSync` does not expose a `transaction(fn)` helper the way better-sqlite3
   does).
2. **Crash between the deletes and the reindex step: is the delete permanent?** NO, not if the
   crash happens before `COMMIT` reaches disk. Because the DELETE and the full reindex share one
   SQLite transaction, a hard process kill (SIGKILL, OOM-kill, power loss) between line 545 and
   line 614 leaves the transaction uncommitted. SQLite's own durability guarantee (independent of
   the JS-level `catch`/`ROLLBACK`, which only fires for a normal JS exception, never for a hard
   kill) means an uncommitted transaction is discarded on the next `openGraph()` call: the
   original `nodes`/`edges` rows are intact, not partially deleted. The failure mode this ledger's
   analysis actually confirms as UNMITIGATED is the ordinary, successful-completion case: once
   `COMMIT` succeeds (the overwhelmingly common path, since nothing today interrupts a normal
   rebuild), the destroyed rows are durably, permanently gone (CLAIM-11: no soft-delete, no
   backup). Atomicity protects against a torn crash; it does nothing about the wrong rows being in
   scope for the DELETE in the first place.
3. **Under WAL mode, can a concurrent reader observe the empty/partial state mid-operation?**
   Command: `grep -n "journal_mode" lib/core/lazygraph-ops.cjs` -> `309:  db.exec('PRAGMA
   journal_mode = WAL');` (set unconditionally in `openGraph`, line 309, immediately after opening
   the `DatabaseSync` connection). Given WAL mode's MVCC-style snapshot isolation, a SEPARATE
   reader connection to the same `room.db` cannot observe the intermediate delete-then-not-yet-
   reindexed state during `rebuildGraph`, BECAUSE that entire sequence lives inside one
   uncommitted transaction and WAL readers only ever see committed data: before `COMMIT`, a
   concurrent reader still sees the full pre-rebuild graph; after `COMMIT`, it sees the full
   post-rebuild graph (memory_event/confirmed-claim/decision/stage_history rows already gone).
   There is no window where a reader sees a genuinely empty or partially-reindexed `nodes` table.
   THIS IS THE OPPOSITE of the Moat/HSI scoring layer shape referenced in the task brief:
   `scripts/hsi-to-graph.cjs:61-62` runs `conn.prepare("DELETE FROM edges WHERE type =
   'HSI_CONNECTION'").run();` and the following `REVERSE_SALIENT` delete as BARE, un-transacted
   autocommit statements (verified: no `BEGIN`/`COMMIT` anywhere in that file's write path), so
   each DELETE commits to the WAL individually and IS immediately visible to any concurrent reader
   -- a real torn-read window that `rebuildGraph`'s own BEGIN/COMMIT wrapping does not share.
   Recommendation carried into the RCA: `rebuildGraph`'s existing transaction wrapping is sound
   for atomicity and should be the pattern `hsi-to-graph.cjs` is brought into line with (a
   separate, out-of-scope follow-up); for `rebuildGraph` itself, the required fix is SCOPE (which
   rows the DELETE targets), not atomicity, which is already correct.

No em-dashes in this file.
