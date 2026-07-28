# Phase 236: room.db Data-Loss Fixes - Research

**Researched:** 2026-07-28
**Domain:** node:sqlite (Node.js built-in) transaction scoping, WAL semantics, and open-failure handling in `lib/core/room-db.cjs` / `lib/core/lazygraph-ops.cjs`
**Confidence:** HIGH

**Note on provenance:** This document was compiled directly by the plan-phase orchestrator, not a `gsd-phase-researcher` subagent run. The dispatched researcher subagent (Phase 236, spawned with full RCA + Context7 grounding) did not return after 12+ minutes (well past the normal 1-5 min window) and did not answer a direct status-check ping. Rather than stall the workflow indefinitely, the orchestrator performed the same investigation directly — every finding below was produced by a tool call in this session (Context7 queries, `grep`/`Read` against `main` at the current worktree HEAD), not recalled from training data. This is flagged transparently in the final plan-phase report.

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase (discuss-phase was not run; orchestrator explicitly chose "Continue without context" per the phase's urgent/self-evident scope). All decisions below are Claude's discretion, constrained by ROADMAP.md's Phase 236 success criteria and REQUIREMENTS.md's GRAPHDB-01/02/03.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

Single-tier application (Node.js CJS library + CLI/MCP surface) — all capabilities reside in the shared `lib/core/*.cjs` tier, consumed by both the CLI (`bin/*.cjs`) and the MCP server (`lib/mcp/tool-router.cjs`).

| Capability | Primary Tier | Rationale |
|------------|-------------|-----------|
| GRAPHDB-01 (rebuild ownership scoping) | `lib/core/lazygraph-ops.cjs` (data layer) | The DELETE statement and its scope live here; MCP wrapper (`graph-ops.cjs`) and tool-router are secondary (gate/report only) |
| GRAPHDB-02 (typed open-failure result) | `lib/core/room-db.cjs` (data layer) | `openRoomDb` is the single chokepoint every caller uses |
| GRAPHDB-03 (version floor) | `package.json` (build config) | Doc/config-only, no runtime code |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 236 closes two real room.db data-loss/availability risks. **GRAPHDB-01 is NOT a missing-transaction bug** — `rebuildGraph` (`lib/core/lazygraph-ops.cjs:517-660`) already wraps its `DELETE FROM edges; DELETE FROM nodes;` plus the full filesystem reindex in an explicit `BEGIN`/`COMMIT`/`ROLLBACK` (Plan 87-06, confirmed present at lines 542-618). The real bug, already root-caused and evidence-backed in a routed-in RCA (`.planning/debug/graph-rebuild-truncates-memory-journal.md`), is that the DELETE is **unscoped**: it wipes every row in `nodes`/`edges` including `memory_event` audit rows, confirmed truth-claims, decisions, and opportunity `stage_history` — populations the reindex never restores because they aren't filesystem-derived. The fix is an ownership allowlist (`INDEXER_OWNED_NODE_TYPES` / `INDEXER_OWNED_EDGE_TYPES`) that scopes the DELETE, not a new transaction wrap.

**GRAPHDB-02 is a real, unaddressed gap.** `openRoomDb` has zero busy/broken-open handling. At least one production call site (`lib/core/graph-derivation.cjs:256`) demonstrates the exact "cold-start collapse" shape the roadmap describes: `try { db = openRoomDb(roomDir); } catch (_e) { db = null; }` — ANY thrown error (SQLITE_BUSY from a lock, a mid-migration exception, a genuinely-missing room) collapses to the same `null`, indistinguishable downstream. This needs a typed result at the `openRoomDb` boundary itself, not per-call-site patching (30+ call sites exist; see Open Questions).

**GRAPHDB-03 is log-only.** `package.json` currently states `"node": ">=22.5.0"` (line 38), which is the version `node:sqlite` was *introduced* behind the `--experimental-sqlite` flag — but no flag is passed anywhere in this repo (`bin/*.cjs` shebangs are plain `#!/usr/bin/env node`, no `NODE_OPTIONS`). The flag requirement wasn't lifted until **v22.13.0** (confirmed via Context7 against the official Node.js v22.x API docs). On Node 22.5.0–22.12.x, `require('node:sqlite')` in `room-db.cjs:30` would throw outright. The stated floor is wrong for the code as written.

**Primary recommendation:** Three independent, narrowly-scoped fixes, no shared file overlap between them or with Phase 242:
1. Add an ownership allowlist constant and scope the two DELETEs in `rebuildGraph` to it (GRAPHDB-01).
2. Wrap `DatabaseSync` construction in `openRoomDb` with typed error classification (busy vs. broken/mid-migration vs. genuinely absent) and return/throw a discriminated result instead of a bare exception (GRAPHDB-02).
3. Bump `package.json` engines to `>=22.13.0` with a comment citing the Context7-verified flag-removal version, no behavioral gate (GRAPHDB-03).
</research_summary>

<standard_stack>
## Standard Stack

No new libraries. This phase works entirely within the existing `node:sqlite` built-in (`DatabaseSync`) already used throughout `lib/core/`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` (built-in) | Node >=22.13.0 (unflagged) | Room graph + memory storage | Already the repo's fixed choice (Canon: "SQL (room.db) is the local mind"); no alternative under consideration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-wrapped BEGIN/COMMIT (current) | better-sqlite3's `db.transaction(fn)` | Not applicable — `node:sqlite`'s `DatabaseSync` has NO native `.transaction()` helper (confirmed via Context7; that API is better-sqlite3-only). This repo is correctly NOT using it; nothing to change here. |

**Installation:** N/A — no new packages.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Data Flow: `rebuildGraph`'s Current (Broken-Scope) Behavior

```
MCP room_graph(graph-rebuild)          runDeriveBackfill (default: skipRebuild=false)
        |                                        |
        v                                        v
   graph-ops.cjs rebuildGraph(roomDir)  <---------+
        |
        v
   lazygraph-ops.cjs rebuildGraph(conn, roomDir)
        |
        v
   conn.prepare('BEGIN').run()                     <-- txn boundary starts (already correct)
        |
        v
   conn.exec('DELETE FROM edges; DELETE FROM nodes;')  <-- UNSCOPED: wipes memory_event,
        |                                                   confirmed claims, decisions,
        |                                                   opportunity stage_history too
        v
   walk sections/nested/root files -> _indexArtifactBody()  <-- restores ONLY
        |                                                       Artifact/Section nodes
        v
   conn.prepare('COMMIT').run()                    <-- txn boundary ends (already correct)
        |
        v
   { success: true, artifacts: N, sections: M }     <-- honest about what it restored,
                                                          silent about what it destroyed
```

### Pattern 1: Ownership-Scoped Destructive Reindex (GRAPHDB-01 fix)
**What:** Replace the unscoped DELETE with a DELETE restricted to an explicit, exported allowlist of node/edge types the indexer itself owns and can fully regenerate.
**When to use:** Any "rebuild from source of truth" operation sharing a table with append-only or human-confirmed data.
**Example (target shape, from the RCA's Required Code Changes / Change 1):**
```javascript
// lib/core/lazygraph-ops.cjs — new exported constants near the top of the file
const INDEXER_OWNED_NODE_TYPES = ['Artifact', 'Section']; // verify exact type strings via
                                                            // _indexArtifactBody's INSERT calls
const INDEXER_OWNED_EDGE_TYPES = ['WIKILINK', /* ... */];  // verify exact type strings

// Inside rebuildGraph, replacing the current line ~545:
const nodePlaceholders = INDEXER_OWNED_NODE_TYPES.map(() => '?').join(',');
const edgePlaceholders = INDEXER_OWNED_EDGE_TYPES.map(() => '?').join(',');
conn.prepare(`DELETE FROM edges WHERE type IN (${edgePlaceholders})`).run(...INDEXER_OWNED_EDGE_TYPES);
conn.prepare(`DELETE FROM nodes WHERE type IN (${nodePlaceholders})`).run(...INDEXER_OWNED_NODE_TYPES);
```
**Do NOT touch:** the existing `BEGIN`/`COMMIT`/`ROLLBACK` wrapping (lines 542, 614-618) — it is already correct and should be preserved byte-for-byte around the now-scoped DELETE.

### Pattern 2: Typed Open-Result at the DatabaseSync Boundary (GRAPHDB-02 fix)
**What:** `openRoomDb` currently either returns a working `DatabaseSync` handle or throws whatever raw error `node:sqlite` produces (or whatever migration code throws). Callers that `try/catch` around it (e.g. `graph-derivation.cjs:256`) collapse every failure mode to the same `null`. The fix classifies the failure at the source.
**When to use:** Any chokepoint function whose callers currently can't distinguish "doesn't exist yet" from "exists but is unavailable right now."
**Example (target shape — exact error discrimination needs verification during planning):**
```javascript
// lib/core/room-db.cjs — openRoomDb, wrapping the DatabaseSync construction
let db;
try {
  db = (opts && opts.allowExtension === true)
    ? new DatabaseSync(dbPath, { allowExtension: true, timeout: 5000 })
    : new DatabaseSync(dbPath, { timeout: 5000 });
} catch (e) {
  // node:sqlite throws a generic Error; classify by inspecting e.message /
  // e.code (needs verification — DatabaseSync error shapes are not fully
  // documented in the Context7-fetched API pages; direct behavioral testing
  // required during planning, e.g. seed a locked file and a mid-migration
  // artifact and inspect the actual thrown error's fields).
  if (/* busy signature */) throw new RoomDbBusyError(dbPath, e);
  if (/* broken/corrupt signature */) throw new RoomDbBrokenError(dbPath, e);
  throw e; // genuinely unexpected — do not swallow
}
```
Migration-mid-flight detection likely needs a SEPARATE mechanism (e.g. a sentinel row / lock file written before a migration starts and cleared after), since a normal SQLite-level exception during a migration function call (`runPhase109SessionFocus(db)` etc., lines 134+) would just look like "some JS error" unless those migration functions are also wrapped with typed rethrows.

### Anti-Patterns to Avoid
- **Patching every call site instead of the chokepoint:** 30+ call sites use `openRoomDb`. Fixing `graph-derivation.cjs:256` alone (or any single site) leaves the other 29+ swallowing the same way. GRAPHDB-02's fix belongs in `room-db.cjs` itself.
- **Touching `scripts/hsi-to-graph.cjs`:** that file has its own un-transacted `DELETE FROM edges WHERE type = 'HSI_CONNECTION'` / `'REVERSE_SALIENT'` (lines 61-62), explicitly named in the routed-in RCA as **out of scope for Phase 236** ("Named follow-up, out of scope here") and explicitly owned by Phase 242 ("The Moat") per ROADMAP.md's soft-dependency line. Phase 236's plan must not modify this file.
- **Re-adding a transaction wrap to `rebuildGraph`:** it already has one and it is correct (verified: real crash-safety, real WAL snapshot-isolation for concurrent readers — see RCA's "SQLite Transaction and Concurrency Analysis" section). Touching it is unnecessary churn and risks regressing something that already works.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction atomicity for the rebuild | A new BEGIN/COMMIT scheme | The existing wrap at `lazygraph-ops.cjs:542-618` | Already correct, already tested in production (Phase 233-03 near-miss exercised it), touching it is pure risk |
| better-sqlite3-style `db.transaction(fn)` helper | A custom higher-order wrapper mimicking it | Explicit `exec('BEGIN')`/`.run()`/`exec('COMMIT')`/`exec('ROLLBACK')` (the pattern already used) | `node:sqlite` has no such helper (Context7-confirmed); inventing one is unnecessary abstraction over a codebase that already knows and documents this constraint |
| Busy/lock error classification | Guessing at `err.message` string matching without verification | Direct behavioral test: seed a locked `room.db` (second `DatabaseSync` connection with a held write) and a mid-migration failure, then inspect the ACTUAL thrown error's `.code`/`.message` at this Node/node:sqlite version, before writing the classifier | Context7's fetched API pages document the `timeout` option and its default but do NOT enumerate the exact error object shape thrown when the busy timeout is exceeded or the file is corrupt — this must be observed, not assumed, matching the roadmap's own explicit "proven by observation... not asserted from docs" instruction for the WAL criterion, which applies with equal force here |

**Key insight:** every piece of "new" machinery this phase might be tempted to build (a transaction helper, a rebuild-safety wrapper) already exists correctly in this codebase. The actual work is narrower and more surgical than the roadmap's success-criterion prose suggests: scope one DELETE statement, classify one function's failure modes, and fix one config line.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Conflating "add a transaction" with the actual GRAPHDB-01 fix
**What goes wrong:** A planner reads ROADMAP.md's success criterion 1 literally ("removing the transaction wrap turns this gate red") and plans to add/modify transaction wrapping, missing that the wrap already exists and the real defect is DELETE scope.
**Why it happens:** The roadmap wording was written before the RCA's deeper analysis was filed; it's not wrong (a mutation test removing SOME transaction-adjacent protection should still exist and turn red) but it's imprecise about which change is load-bearing.
**How to avoid:** Design the mutation-provable test as "revert the DELETE to unscoped `DELETE FROM edges; DELETE FROM nodes;`" (per the RCA's own Test 1/Test 2), not "remove BEGIN/COMMIT." Both mutations should arguably be tested, but the DELETE-scope one is the one that matches the actual historical defect and the actual fix.
**Warning signs:** A plan whose only task under GRAPHDB-01 is "wrap rebuildGraph in a transaction" with no allowlist/scoping constant anywhere.

### Pitfall 2: Treating GRAPHDB-02 as a single-call-site fix
**What goes wrong:** Fixing only `graph-derivation.cjs:256` (the one site this research directly traced) satisfies a narrow test but leaves ~29 other `openRoomDb(...)` call sites (see grep list in Open Questions) swallowing busy/broken errors the same way, because most of them don't even try/catch at all — they let the raw exception propagate uncaught, which is a DIFFERENT failure shape (crash) than the cold-start-collapse shape (silent null) this phase is chartered to fix.
**Why it happens:** The symptom that's easiest to find (one grep hit) isn't the same as the chokepoint that actually needs fixing.
**How to avoid:** Fix classification INSIDE `openRoomDb` itself (room-db.cjs) so every caller — whether it try/catches or lets exceptions propagate — gets a typed, discriminable error/result from the one shared function. Do not distribute the fix across call sites.
**Warning signs:** A plan with tasks touching `graph-derivation.cjs` or other individual callers instead of (or in addition to) `room-db.cjs` itself.

### Pitfall 3: Assuming Node version floor bump alone satisfies GRAPHDB-03
**What goes wrong:** Bumping `package.json` engines without also verifying (and logging, per the roadmap's explicit "log-only" instruction) that no other file in the repo hardcodes or assumes the old `22.5.0` floor (README install instructions, CI config, `.nvmrc` if present).
**Why it happens:** `package.json` is the obvious single source of truth but isn't necessarily the only stated floor in a repo this size.
**How to avoid:** Grep for `22.5.0` and `node.*>=` patterns repo-wide (excluding `node_modules`) before declaring GRAPHDB-03 done; this is log-only so no behavioral test is required, just accuracy.
**Warning signs:** Only `package.json` changes; no verification that the new floor is consistent elsewhere.
</common_pitfalls>

<code_examples>
## Code Examples

### Current `rebuildGraph`'s transaction wrap (verified correct, DO NOT modify the wrapping itself)
```javascript
// Source: lib/core/lazygraph-ops.cjs:542-618 (read directly from main @ current HEAD)
conn.prepare('BEGIN').run();
try {
  // Clear all existing data (edges first for FK compliance)
  conn.exec('DELETE FROM edges; DELETE FROM nodes;');   // <-- THIS LINE is what GRAPHDB-01 scopes
  // ... section walk, nested walk, ROOT-FILES pass, each calling _indexArtifactBody(conn, ...) ...
  conn.prepare('COMMIT').run();
} catch (err) {
  try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
  throw err;
}
```

### Current `openRoomDb` construction (no busy/broken classification — GRAPHDB-02 target)
```javascript
// Source: lib/core/room-db.cjs:100-140 (read directly from main @ current HEAD)
function openRoomDb(roomDir, opts) {
  // ...
  const db = (opts && opts.allowExtension === true)
    ? new DatabaseSync(dbPath, { allowExtension: true, timeout: 5000 })
    : new DatabaseSync(dbPath, { timeout: 5000 });
  db.exec('PRAGMA journal_mode = WAL');
  // ... 4 chained migration functions run unconditionally here, each can throw ...
}
```

### Current cold-start-collapse call site (the shape GRAPHDB-02 must eliminate)
```javascript
// Source: lib/core/graph-derivation.cjs:254-257 (read directly from main @ current HEAD)
let db = null;
if (roomDir) {
  try { db = openRoomDb(roomDir); } catch (_e) { db = null; }  // busy, broken, AND
                                                                  // genuinely-absent all
                                                                  // collapse to the same null
}
```

### Node.js `DatabaseSync` constructor options (Context7-verified, `/websites/nodejs_latest-v22_x_api`)
```
DatabaseSync(path, options)
options.timeout (number, optional) — "the busy timeout in milliseconds." Default: 0.
options.allowExtension (boolean, optional) — Default: false.
```
No documented `.transaction()` method exists on the class; `exec()` and `prepare()` are the only write-path primitives.
</code_examples>

<sota_updates>
## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `node:sqlite` required `--experimental-sqlite` flag | Flag removed, module loads unflagged (still marked experimental, not stable) | Node v22.13.0 | `package.json`'s current `>=22.5.0` floor is wrong for code with no flag passed anywhere; GRAPHDB-03 should bump to `>=22.13.0` |

**Deprecated/outdated:** N/A — no library swap involved in this phase.
</sota_updates>

<validation_architecture>
## Validation Architecture

**Framework:** plain Node.js scripts (`node:assert` + process exit codes) — the repo convention, no jest/vitest/pytest. Pattern: `tests/test-236-<description>.cjs`, individually runnable via `node tests/test-236-<description>.cjs`, aggregated by a new glob-discovery `tests/run-all-236.sh` (mirroring `tests/run-all-234.sh`'s "GLOB-DISCOVERS every tests/test-236-* file" pattern — no hand-maintained file list).

**Quick run command:** `node tests/test-236-<description>.cjs` (per-file, ~1-3s each — direct `DatabaseSync` operations against a throwaway `:memory:` or tmp-dir room, no network, no LLM calls)
**Full suite command:** `bash tests/run-all-236.sh`
**Estimated runtime:** <10s total (all node:sqlite operations are synchronous and local)

**Mandatory mutation-provable tests (must exist, each with a documented "revert X, watch it turn red" step):**

| Test | Requirement | Given | When | Then | Mutation that must turn it red |
|------|-------------|-------|------|------|-------------------------------|
| `test-236-rebuild-preserves-journal.cjs` | GRAPHDB-01 | Room seeded with 1 `memory_event` row, 1 confirmed truth-claim, 1 opportunity with non-empty `stage_history[]` | `rebuildGraph` runs | All three rows survive with original `id`/`properties`/`stage_history` unchanged | Reverting the DELETE to unscoped `DELETE FROM edges; DELETE FROM nodes;` (RCA Test 1) |
| `test-236-backfill-default-preserves-journal.cjs` | GRAPHDB-01 | Same seeded room | `runDeriveBackfill({roomDir})` runs with default options (no `skipRebuild`) | memory_event/claim/stage_history counts unchanged before vs. after | Same DELETE-scope reversion (RCA Test 2) |
| `test-236-rebuild-crash-mid-transaction.cjs` | GRAPHDB-01 (success criterion 1) | Seeded room, rebuild in flight | Process/connection killed between DELETE and COMMIT (simulate via forced exception + verifying no partial commit, since a real SIGKILL can't be scripted in-process) | Original nodes/edges rows fully intact on reopen | Removing the BEGIN/COMMIT/ROLLBACK wrap |
| `test-236-rebuild-wal-concurrent-read.cjs` | GRAPHDB-01 (success criterion 2) | Two live connections to the same room.db, one rebuilding | Second connection polls throughout the rebuild | Never observes a partial/empty nodes table — only pre-rebuild-complete or post-rebuild-complete states | Removing the transaction wrap (same mutation exposes a torn-read window) |
| `test-236-open-busy-detected.cjs` | GRAPHDB-02 (success criterion 3) | A room.db held open by a live writer connection (simulated lock) | A second `openRoomDb` call is made | Returns/throws a typed busy result, NOT a generic error and NOT silent `null` | Reverting to the current bare `try{}catch{db=null}` collapse pattern |
| `test-236-open-broken-detected.cjs` | GRAPHDB-02 (success criterion 3) | A room.db file corrupted or caught mid-migration (simulate: truncate the file after WAL header, or inject a throw inside one of the 4 chained migration calls) | `openRoomDb` is called | Returns/throws a typed broken/migration result, distinguishable from both busy AND "no room db" | Same collapse-pattern reversion |
| `test-236-engines-floor.cjs` (or a `scripts/check-*.cjs` gate) | GRAPHDB-03 (log-only) | `package.json` | Read `engines.node` | Value is `>=22.13.0` (or whatever floor this phase's own Context7 re-verification confirms) with a comment citing the source | N/A — log-only per roadmap, no phase-blocking gate required, but a simple assertion is cheap and prevents silent regression |

**Sampling rate:** after every task commit, run the specific `test-236-*.cjs` file(s) that task's `<read_first>`/`<acceptance_criteria>` reference; after each wave, run the full `bash tests/run-all-236.sh`; before `/gsd-verify-work`, full suite must be green.

**Wave 0 requirements:** none beyond what's listed above — no new test framework to install, `node:assert` + `node:sqlite`'s `:memory:` mode are both already available in this repo's runtime.

**Manual-only verifications:** none identified — every success criterion above has a scriptable, deterministic reproduction (seeded room + direct function call + assertion), consistent with this repo's existing `tests/test-233-*` / `tests/test-234-*` pattern for similar transaction/data-integrity phases.
</validation_architecture>

<open_questions>
## Open Questions

1. **What is the exact thrown-error shape for a busy (locked) `DatabaseSync` open, and for a genuinely corrupt/mid-migration file, on this repo's actual Node/node:sqlite version?**
   - What we know: `timeout` option (default 0, this repo sets 5000ms) governs how long SQLite retries before giving up; the underlying engine is standard SQLite (`SQLITE_BUSY` is the classic C-level code), but `node:sqlite`'s JS-level error object shape for this case is not enumerated in the Context7-fetched API pages.
   - What's unclear: whether the thrown Error has a `.code` property matching `SQLITE_BUSY`/`SQLITE_CANTOPEN`, or only a `.message` string, and what a mid-migration exception (thrown by one of the four chained `runPhaseNNN...` functions in `openRoomDb`) looks like by comparison.
   - Recommendation: the planner/executor MUST do a direct behavioral probe (seed a locked `room.db` with a second live `DatabaseSync` connection holding a write, then call `openRoomDb` from a second process/handle and inspect the real thrown error) before finalizing the classification logic. This is a "prove by observation, not docs" task, mirroring the roadmap's own instruction for the WAL-visibility criterion.

2. **What is the full census of `openRoomDb` call sites, and which ones currently swallow errors vs. let them propagate?**
   - What we know: at least 25+ non-test call sites exist across `lib/core/` (room-auto-create.cjs, room-discard-cascade.cjs, graph-backfill.cjs, graph-self-heal.cjs, graph-refine-loop.cjs, lazygraph-ops.cjs, url-ingest.cjs, breakthrough/scanner.cjs, eureka/*, navigation/*, room-naming-selector.cjs, rs-sqlite-mirror.cjs, unknowns/verdict.cjs). Only `graph-derivation.cjs:256` was directly confirmed to swallow-to-null; others were not individually traced.
   - What's unclear: whether GRAPHDB-02's success criterion 3 ("the seeded-lock run shows the real state and the old cold-start collapse cannot be reproduced") requires updating every swallowing call site to surface the typed result, or whether fixing `openRoomDb` itself (so it throws a typed/discriminable error) is sufficient because callers that don't catch will now propagate a MORE informative error even without their own changes.
   - Recommendation: scope the phase's code changes to `room-db.cjs` (the chokepoint) plus AT MOST the one demonstrated collapse site (`graph-derivation.cjs`) as the acceptance-test target; treat updating all other call sites as a documented follow-up if the planner judges it out of budget for one phase, but flag this explicitly rather than silently narrowing scope.

3. **Exact `type` column values for `INDEXER_OWNED_NODE_TYPES`/`EDGE_TYPES` (GRAPHDB-01).**
   - What we know: `_indexArtifactBody` (called from `rebuildGraph`) writes `'Artifact'`/`'Section'`-shaped nodes and wikilink-derived edges; the RCA names these as the two node types but doesn't enumerate the exact edge `type` string(s) written by `_indexArtifactBody`.
   - What's unclear: the precise literal strings used in the `nodes.type`/`edges.type` columns for filesystem-derived structural edges (need to read `_indexArtifactBody`'s body directly, not yet done in this research pass).
   - Recommendation: planner/executor reads `_indexArtifactBody` in full (`lib/core/lazygraph-ops.cjs`, referenced throughout `rebuildGraph` but not yet read end-to-end in this research pass) to enumerate every `type` value it inserts, before writing the allowlist constant.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `/websites/nodejs_latest-v22_x_api` (Context7) — `DatabaseSync` constructor options (`timeout` default 0), confirmed no native `.transaction()` helper, confirmed `node:sqlite` unflagged as of v22.13.0 (still experimental)
- Direct source reads against `main` @ current worktree HEAD: `lib/core/lazygraph-ops.cjs` (rebuildGraph, lines 505-660+), `lib/core/room-db.cjs` (openRoomDb, lines 1-140+), `lib/core/graph-ops.cjs` (rebuildGraph wrapper), `lib/core/graph-derivation.cjs` (cold-start-collapse call site, lines 235-284), `package.json` (engines field, line 37-39)
- `.planning/debug/graph-rebuild-truncates-memory-journal.md` — routed-in RCA (per ROADMAP.md line 21), fully evidence-verified against this same codebase revision, includes a dedicated SQLite Transaction and Concurrency Analysis section directly answering the WAL-visibility question

### Secondary (MEDIUM confidence)
- `grep -rn "openRoomDb(" lib/` output — call-site census (25+ sites), not individually traced for error-handling shape beyond the one confirmed collapse site

### Tertiary (LOW confidence - needs validation)
- The exact thrown-error shape for busy/broken opens (Open Question 1) — no source found; requires direct behavioral testing during planning/execution, not documentation
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: `node:sqlite` `DatabaseSync` (built-in, no alternative under consideration)
- Ecosystem: N/A (single built-in module, no library selection)
- Patterns: transaction scoping/ownership, typed error classification at a chokepoint function
- Pitfalls: mutation-test precision (transaction vs. scope), chokepoint-vs-call-site fix placement, version-floor accuracy

**Confidence breakdown:**
- GRAPHDB-01 root cause and fix shape: HIGH — independently corroborated by a full, evidence-verified RCA plus direct source reads
- GRAPHDB-02 root cause (cold-start collapse) and chokepoint location: HIGH for the demonstrated site; MEDIUM for full call-site census (see Open Question 2)
- GRAPHDB-02 exact error classification mechanics: LOW — genuinely requires behavioral testing, not documentable in advance (see Open Question 1)
- GRAPHDB-03: HIGH — directly Context7-verified against official Node.js docs

**Research date:** 2026-07-28
**Valid until:** 30 days (stable domain — `node:sqlite` API surface changes slowly even while marked experimental; the codebase-specific findings (RCA, call sites) are valid until the underlying code changes, which this very phase will do)
</metadata>

---

*Phase: 236-room-db-data-loss-fixes*
*Research completed: 2026-07-28*
*Ready for planning: yes*
