# Phase 242: The Moat - Research

**Researched:** 2026-07-28
**Domain:** node:sqlite transaction safety (SQLite BEGIN/COMMIT/ROLLBACK + WAL) and a repo-hygiene machine-checked assertion script
**Confidence:** HIGH (MOAT-01 mechanism, verified against this repo's own proven pattern + official docs) / HIGH (MOAT-02 scope, verified by direct grep census of the tree)

## Summary

Phase 242 has two independent, small-blast-radius fixes. MOAT-01 wraps `scripts/hsi-to-graph.cjs`'s unguarded DELETE-then-rewrite of `HSI_CONNECTION`/`REVERSE_SALIENT` edges in one BEGIN/COMMIT/ROLLBACK transaction, reusing the EXACT idiom `lib/core/lazygraph-ops.cjs` already ships twice in the same file (`indexArtifact`, `rebuildGraph`) -- there is no new pattern to invent, only a third call site to add. MOAT-02 replaces one dead prose checkbox in `docs/MOAT-MANDATE.md` ("Does this work without KuzuDB edges?") with a small script, mirroring the existing `scripts/check-hook-schema-compatibility.cjs` allowlist-grep pattern already proven in this repo's release gate.

For MOAT-01, the room.db opened by `openGraph()` already runs `PRAGMA journal_mode = WAL` at open time (confirmed by reading `lazygraph-ops.cjs` directly, and independently proven live by the existing `tests/test-sqlite-concurrent.cjs` SQLITE-03 suite). Official SQLite documentation (fetched live this session, not recalled from training data) confirms WAL gives every reader a fixed snapshot as of the reader's transaction start -- a reader can never see a writer's uncommitted rows, and a writer never blocks a reader. Official SQLite docs also confirm that a transaction with no commit record in the WAL (the state left behind by a crash between BEGIN and COMMIT) is simply invisible/ignored on the next open -- no manual recovery code is needed. This means the transaction wrap alone, combined with the WAL mode this file already inherits from `openGraph`, satisfies BOTH halves of MOAT-01's success criterion (crash-safety AND concurrent-reader-never-sees-empty). Node's own `node:sqlite` docs (fetched live) confirm there is no built-in `.transaction(fn)` helper on `DatabaseSync` -- explicit `BEGIN`/`COMMIT`/`ROLLBACK` via `.prepare()`/`.exec()` is the only available idiom, exactly what `lazygraph-ops.cjs` already does.

For MOAT-02, a full-tree grep census (168 "kuzu" hits across ~38 files, done live this session) found ZERO live `require('kuzu')`, `import ... from 'kuzu'`, or `package.json`/`package-lock.json` dependency entries anywhere in the tree today. Every hit is either a historical comment ("Migrated from X-to-kuzu.cjs"), the `docs/MOAT-MANDATE.md` correction banner itself, a backward-compat exported alias name (`buildGraphFromKuzu`, which is SQLite code under a legacy name) or a backward-compat CLI subcommand string (`case 'build-kuzu':`). This confirms the audit's "doc fix, no RCA" verdict: there is nothing to root-cause today, the assertion only needs to catch a FUTURE reintroduction.

**Primary recommendation:** MOAT-01 -- wrap `scripts/hsi-to-graph.cjs`'s DELETE + both write loops in one `conn.prepare('BEGIN').run()` / `conn.prepare('COMMIT').run()` block with a catch-and-`ROLLBACK`-then-rethrow, byte-identical in shape to `rebuildGraph`'s existing block (lazygraph-ops.cjs lines 542-618). MOAT-02 -- add `scripts/check-kuzu-reintroduction.cjs` (new script, modeled directly on `scripts/check-hook-schema-compatibility.cjs`'s allowlist-grep-then-exit-nonzero shape), wire it into `scripts/verify-release` next to the existing `STOP_SCHEMA_OUT` gate, and replace the `docs/MOAT-MANDATE.md` line 96 checkbox with a one-line pointer to the script.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HSI edge rewrite transaction safety (MOAT-01) | Database / Storage (room.db via `lib/core/lazygraph-ops.cjs`) | API/Backend script (`scripts/hsi-to-graph.cjs` is the call site that must change) | The fix is a storage-layer atomicity guarantee; the call site is a one-shot CLI script invoked by `runHsiScan` (via `execFileSync`), not a long-lived server process. No browser/frontend tier involved. |
| PR checklist machine assertion (MOAT-02) | Build/CI tooling (`scripts/*.cjs` release-gate family) | Docs (`docs/MOAT-MANDATE.md`) | This is a repo-hygiene static-analysis check, the same tier as `check-hook-schema-compatibility.cjs` and `check-shape-declaration.cjs` -- wired into `scripts/verify-release`, not the runtime app. |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOAT-01 | The HSI-to-graph edge rewrite is transaction-wrapped so a crash or concurrent reader never sees a zeroed scoring layer (MW-1, includes MW-2 and MW-3 as the same root cause). | Confirmed exact unguarded call site (hsi-to-graph.cjs lines 61-129); confirmed the proven local BEGIN/COMMIT/ROLLBACK idiom in the same dependency file (lazygraph-ops.cjs `indexArtifact`/`rebuildGraph`); confirmed WAL is already active via `openGraph`; confirmed via official SQLite docs that WAL snapshot isolation + BEGIN/COMMIT covers both the crash-safety and concurrent-reader halves of the success criterion with no extra recovery code. |
| MOAT-02 | The PR checklist's KuzuDB warning sign is replaced with a real, machine-checked assertion (MW-4). | Confirmed the exact dead prose line (`docs/MOAT-MANDATE.md` line 96); confirmed zero live kuzu dependency exists today (grep census); confirmed a directly-reusable script pattern already in this repo (`check-hook-schema-compatibility.cjs`) and an existing release-gate wiring point (`scripts/verify-release`). |

## Files This Phase Touches

Concrete paths this research assumes MOAT-01/MOAT-02 will edit, for the human cross-phase-overlap check against Phase 236 (which touches the SAME dependency file, `lazygraph-ops.cjs`, but a DIFFERENT function -- `rebuildGraph` -- and a different call site entirely):

- `scripts/hsi-to-graph.cjs` -- MOAT-01 primary edit (add BEGIN/COMMIT/ROLLBACK around the existing DELETE + write-loop body).
- `lib/core/lazygraph-ops.cjs` -- READ ONLY for this phase's research; possible edit ONLY if the planner decides to extract a shared `withTransaction(conn, fn)` helper (see "Shared Helper Decision" below). Phase 236 also touches this file's `rebuildGraph` function directly -- if both phases land a helper extraction here, that is a genuine merge-collision risk a human should check before both phases execute in parallel.
- `docs/MOAT-MANDATE.md` -- MOAT-02 edit (replace line 96 checkbox with a pointer to the new script).
- `scripts/check-kuzu-reintroduction.cjs` -- MOAT-02 NEW file (the machine-checked assertion).
- `scripts/verify-release` -- MOAT-02 edit (wire the new script in as a gate, mirroring the existing `STOP_SCHEMA_OUT` block at line ~444).
- `tests/test-hsi-to-graph-transaction.cjs` (or similarly named, does not exist yet) -- NEW test file for MOAT-01's mutation-proof crash-injection + concurrent-reader gate.
- `tests/test-kuzu-reintroduction-gate.cjs` (or similarly named, does not exist yet) -- NEW test file for MOAT-02's seed-one-kuzu-reference-and-watch-it-fail proof.
- `tests/run-all-242.sh` -- NEW phase test aggregator, following the `tests/run-all-233.sh` glob-discovery precedent (discovers every `tests/test-242-*` file, no per-plan edits needed as plans add coverage).

**NOT touched by this phase** (confirmed by reading, not assumed): `lib/core/room-db.cjs` (a separate `DatabaseSync` open path used for a DIFFERENT db purpose, already passes `timeout: 5000`; `openGraph` in lazygraph-ops.cjs does NOT pass a timeout option today -- this is a real gap but belongs to Phase 236/GRAPHDB-03's scope, not MOAT-01's stated ask of "transaction wrap," and no success criterion of Phase 242 requires it).

## Standard Stack

### Core

No new dependency is required for either requirement. Both fixes use only what the repo already ships:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` (`DatabaseSync`) | Node builtin, this repo runs Node v22.23.1 (verified: `node -e "console.log(process.version)"`) | The room.db connection MOAT-01's transaction wraps | Already the sole SQLite binding used throughout `lib/core/lazygraph-ops.cjs`, `lib/core/room-db.cjs`; zero new deps, Canon Part 8 floor (no network surface). |

### Supporting

None. MOAT-02's script is pure Node builtins (`fs`, `path`), following the `check-hook-schema-compatibility.cjs` precedent exactly (verified by reading that file: it imports only `node:fs` and `node:path`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `BEGIN`/`COMMIT`/`ROLLBACK` in `hsi-to-graph.cjs` | `better-sqlite3`'s `.transaction(fn)` higher-order helper | Not applicable -- this repo deliberately uses Node's built-in `node:sqlite` (Canon Part 8 zero-new-deps floor), which has no such helper (confirmed live via Context7-equivalent official docs, see below). Not a live option. |
| A new standalone kuzu-scan script | Folding the kuzu-reintroduction check into the existing `doctor.cjs` "coverage-gate" organ (the pattern that already rolls up `connector`/`projection`/`render`/`skill-mirrors`/`shape-declaration` into one doctor acceptance point, `scripts/doctor.cjs` lines ~1002-1035) | Either works; a standalone script wired into `verify-release` matches MOAT-02's closer precedent (`check-hook-schema-compatibility.cjs`, also NOT folded into doctor's coverage-gate) more directly. Folding into doctor's coverage-gate is a valid alternative if the planner wants it to also surface in `doctor --acceptance`'s day-to-day report, not just at release time -- flagged as the planner's call, not decided here. |

**Installation:** none (zero new packages for this phase).

**Version verification:** N/A -- no package versions to verify; `node:sqlite` is a Node builtin, and its version floor is a Node engine question (see Context7 Grounding below), not an npm registry question.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages (no `npm install` of any kind). MOAT-01 uses only the already-vendored `node:sqlite` builtin; MOAT-02's script uses only `node:fs`/`node:path` builtins, mirroring every other `scripts/check-*.cjs` gate in this repo. The Package Legitimacy Gate protocol is skipped for this reason -- there is nothing for `slopcheck` or a registry lookup to check.

## Context7 Grounding

**Context7 MCP tools were not available in this session's toolset** (no `mcp__context7__*` tools were present, and the `ctx7` CLI fallback binary is not installed on this machine -- confirmed via `command -v ctx7`). Per the documentation-lookup fallback order, this research used direct `WebFetch` against the OFFICIAL Node.js API docs and the OFFICIAL SQLite docs instead (both HIGH-confidence primary sources, same tier as Context7 would have provided -- this is a same-session, live-fetched CITED source, not a training-data recall). This satisfies the CLAUDE.md "Consult ALL Relevant Grounding Sources" mandate's substance (verify the node:sqlite API contract against an authoritative live source before writing/reviewing a transaction-wrapping fix); the specific TOOL used differs from the nominal Context7 path only because that tool was unavailable in this environment.

**What was confirmed live (fetched this session, `[CITED]`):**

1. **Version floor (the genuine open question the orchestrator flagged):** Per the official Node.js v22.x API docs (`https://nodejs.org/docs/latest-v22.x/api/sqlite.html`, fetched live): `node:sqlite` was added behind the `--experimental-sqlite` flag starting at v22.5.0, and became available **WITHOUT the flag starting at Node v22.13.0** ("SQLite is no longer behind `--experimental-sqlite` but still experimental"). This repo's `package.json` engines floor is `>=22.5.0` -- which is BEFORE the unflagged version. **This is a genuine gap**, but it is the SAME gap Phase 236's GRAPHDB-03 (log-only, no phase-blocking fix) already exists to document. MOAT-01 inherits the same `node:sqlite` dependency surface but does not need to re-fix or re-document this; it should simply not regress it. This repo's actual dev/CI environment runs Node v22.23.1 (confirmed: `node -e "console.log(process.version)"`), well past the unflag point, and every existing test (`tests/test-sqlite-concurrent.cjs`, `tests/test-sqlite-battle.cjs`, `tests/test-sqlite-ops.cjs`) already runs `node:sqlite` successfully today with zero flag -- so this is a non-blocking, already-proven-working-in-practice gap for MOAT-01's purposes, not an open unknown.
2. **No built-in transaction helper:** confirmed -- `DatabaseSync` has no `.transaction(fn)` method; manual `exec('BEGIN')` / try-COMMIT / catch-ROLLBACK is the documented idiom, exactly matching `lazygraph-ops.cjs`'s existing code.
3. **`timeout` constructor option:** confirmed -- busy-timeout in milliseconds, **default `0`** (immediate failure on lock contention, no retry wait). `openGraph()` in `lazygraph-ops.cjs` does NOT pass this option (confirmed by reading the source: `new DatabaseSync(dbPath)` with no options object), so it runs at the default of 0. This is unrelated to MOAT-01's transaction-wrap ask (a `timeout` governs contended WRITE acquisition, not commit atomicity or read-snapshot visibility) but is worth flagging to the planner as a latent, out-of-scope gap shared with Phase 236's file.
4. **WAL mode -- NOT documented by Node's own sqlite.html page** (the Node docs page is silent on WAL/journal-mode/snapshot-isolation specifics for `DatabaseSync`). This is expected: WAL semantics are a SQLite-engine property, not a Node-binding property, so the correct authoritative source is `sqlite.org`, not `nodejs.org`.
5. **WAL snapshot isolation and crash recovery -- confirmed live via the OFFICIAL SQLite docs** (`https://www.sqlite.org/wal.html`, fetched this session): a reader's read transaction fixes an "end mark" at the last valid COMMIT record present in the WAL at the moment the read begins, and that end mark is unchanged for the read's duration -- a reader can NEVER see a writer's uncommitted rows, full stop, regardless of how long the writer's transaction runs. On a crash mid-transaction, the WAL simply contains write records with no trailing commit marker; SQLite ignores everything past the last valid commit record on the next open, with ZERO manual recovery code required. Readers and writers never block each other in WAL mode (writers only block other writers, one writer at a time).

**What was NOT independently re-verified this session (left as an open item, honestly flagged, not asserted as fact):** whether `node:sqlite`'s specific `DatabaseSync` implementation deviates in any way from vanilla SQLite's WAL guarantees (e.g., a Node-side buffering or connection-pooling layer that could break the snapshot-isolation guarantee described above). No such deviation is documented anywhere found this session, and the repo's OWN existing test (`tests/test-sqlite-concurrent.cjs`, SQLITE-03, "reader does not block during write") already empirically exercises exactly this scenario today and passes -- that is stronger, repo-native evidence than either doc source alone. MOAT-01's planned test should extend this same empirical-proof approach (a real fork()'d reader against a real mid-transaction writer) rather than relying on documentation claims alone, per this repo's own stated rigor bar ("real end-to-end runs against seeded rooms," not documentation-only proof).

## Architecture Patterns

### System Architecture Diagram

```
.hsi-results.json (produced by compute-hsi.py, upstream of this phase)
        |
        v
scripts/hsi-to-graph.cjs main()
        |
        |-- openGraph(roomDir) --> lib/core/lazygraph-ops.cjs
        |         |
        |         |-- new DatabaseSync(room.db)
        |         |-- PRAGMA journal_mode = WAL   (already active today)
        |         |-- PRAGMA foreign_keys = ON
        |         `-- initSchema (idempotent CREATE TABLE IF NOT EXISTS)
        |
        |-- [CURRENT: unguarded, MOAT-01 fixes this]
        |     DELETE FROM edges WHERE type='HSI_CONNECTION'
        |     DELETE FROM edges WHERE type='REVERSE_SALIENT'
        |     for each hsi_pair: upsertEdge(HSI_CONNECTION)      <-- crash here today = permanent zero
        |     for each reverse_salient: insertNode + upsertEdge(REVERSE_SALIENT)
        |
        |-- [TARGET: MOAT-01 wraps the whole block above in]
        |     conn.prepare('BEGIN').run()
        |     try { ...same body... ; conn.prepare('COMMIT').run() }
        |     catch (e) { conn.prepare('ROLLBACK').run(); throw e }
        |
        `-- closeGraph(db) in finally

Concurrent reader (a separate DatabaseSync handle, e.g. graphStats() or an MCP
graph.cjs tool call mid-rewrite):
   WAL end-mark fixed at last COMMIT before the read started -->
   sees either the FULL pre-rewrite edge set (mid-transaction) or the FULL
   post-rewrite edge set (after COMMIT) -- NEVER a partial/empty state.
```

### Recommended Project Structure

No new directories. `scripts/hsi-to-graph.cjs` stays a flat script; the new MOAT-02 script joins the existing flat `scripts/check-*.cjs` family.

### Pattern 1: Explicit BEGIN/COMMIT/ROLLBACK (the only transaction idiom `node:sqlite` supports)

**What:** Wrap a multi-statement write sequence in `conn.prepare('BEGIN').run()`, do the work inside a `try`, `conn.prepare('COMMIT').run()` on success, and on any thrown error `conn.prepare('ROLLBACK').run()` (itself wrapped in a nested try/catch that swallows ROLLBACK-specific errors) then re-throw the ORIGINAL error.

**When to use:** Any multi-statement write to room.db where a partial completion would leave data in a worse state than either "all old rows" or "all new rows" -- exactly MOAT-01's DELETE-then-rewrite shape.

**Example (the exact existing precedent this phase reuses, from `lib/core/lazygraph-ops.cjs` lines 542-618, `rebuildGraph`):**
```javascript
// Source: lib/core/lazygraph-ops.cjs (this repo, verified by direct read this session)
conn.prepare('BEGIN').run();
try {
  conn.exec('DELETE FROM edges; DELETE FROM nodes;');
  // ...write loop(s)...
  conn.prepare('COMMIT').run();
} catch (err) {
  try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
  throw err;
}
```

**MOAT-01's target shape (recommended, not yet written), applied to `scripts/hsi-to-graph.cjs`:**
```javascript
// scripts/hsi-to-graph.cjs -- inside main(), replacing the current unguarded body
conn.prepare('BEGIN').run();
try {
  conn.prepare("DELETE FROM edges WHERE type = 'HSI_CONNECTION'").run();
  conn.prepare("DELETE FROM edges WHERE type = 'REVERSE_SALIENT'").run();
  // ...same upsertEdge loops as today, unchanged...
  conn.prepare('COMMIT').run();
} catch (err) {
  try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
  throw err; // existing outer catch (e) block already handles this: logs + process.exit(1)
}
```
Note: `hsi-to-graph.cjs`'s existing outer `try {...} catch (e) { process.stderr.write(...); process.exit(1); }` already exists around the whole `main()` body (lines 55-146) -- the ROLLBACK-then-rethrow above composes cleanly with it; the outer catch does not need to change.

### Shared Helper Decision (flagged for the planner, not decided here)

After the MOAT-01 fix, this exact BEGIN/try/COMMIT/catch-ROLLBACK-rethrow shape will exist at THREE call sites in `lib/core/lazygraph-ops.cjs` + `scripts/hsi-to-graph.cjs` combined (`indexArtifact`, `rebuildGraph`, and the new `hsi-to-graph.cjs` block) -- plus however many Phase 236 adds to `rebuildGraph` itself (which already has it, so Phase 236 likely does NOT add a new call site, just hardens the existing one). Three near-identical inline blocks is Canon Part 7 "Reuse Before Build" territory: a `withTransaction(conn, fn)` helper exported from `lazygraph-ops.cjs` would collapse all of them to one line each. **This research recommends extracting it IF it is cheap** (it is -- roughly 10 lines), but explicitly flags this as a PLANNER decision, not a unilateral research call, for two reasons: (1) Phase 236 is being planned concurrently in a sibling worktree and may independently decide to do the same extraction inside `rebuildGraph`'s own file -- a human should check for a collision before both phases land competing versions of the same helper; (2) `_indexArtifactBody` deliberately does NOT wrap itself in BEGIN/COMMIT (the comment at lazygraph-ops.cjs lines 341-347 explains why: nested transactions are forbidden without SAVEPOINT, so `rebuildGraph` calls the un-wrapped `_indexArtifactBody` directly) -- a shared helper needs to preserve this "body function vs. wrapped function" split, which is a design decision with more than one reasonable shape (e.g. `withTransaction(conn, fn)` taking a callback vs. keeping the current copy-pasted BEGIN/COMMIT text). If the planner declines this refactor, MOAT-01 still succeeds with a third literal inline copy of the same six lines -- it is not blocking.

### Anti-Patterns to Avoid

- **Wrapping only the DELETE statements, not the write loops:** would still leave a crash-during-write-loop window where edges are deleted but not yet rewritten -- this is the ENTIRE bug MOAT-01 exists to close. The whole DELETE + both write loops must be inside one BEGIN/COMMIT.
- **Nested BEGIN:** SQLite rejects `BEGIN` while already inside a transaction (without `SAVEPOINT`). If a future refactor calls `indexArtifact()` (which itself opens its own BEGIN/COMMIT) from inside the new outer transaction, it will throw. hsi-to-graph.cjs today calls `insertNode()` directly (not through `indexArtifact`), which is safe -- `insertNode` issues no transaction of its own (confirmed by reading `lib/core/node-insert.cjs`: pure `conn.prepare(...).run(...)`, no BEGIN/COMMIT). Keep it that way inside the new wrap.
- **Passing a `timeout` option as a substitute for the transaction wrap:** `timeout` only governs how long a WRITER waits to acquire a lock before failing; it does nothing for atomicity or crash-safety. Do not conflate the two (this is the GRAPHDB-03/Phase-236 concern, not MOAT-01's).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite transaction semantics | A custom "shadow table + swap" pattern, a custom write-ahead JSON log, or any bespoke crash-recovery bookkeeping | `BEGIN`/`COMMIT`/`ROLLBACK` + the WAL mode `openGraph` already turns on | SQLite's WAL already gives exactly the atomicity + snapshot-isolation guarantee MOAT-01 needs, for free, confirmed by official docs this session. Any custom recovery layer on top would duplicate what the engine already does and introduce new bugs. |
| Detecting "did kuzu come back" | A one-off manual PR-review habit, or a fuzzy semantic/AI-based scan | A literal grep-with-allowlist script (the `check-hook-schema-compatibility.cjs` pattern) | The problem is narrow and lexical (does a NEW `require`/`import`/dependency-manifest line reference a package literally named `kuzu`/`kuzu-*`); a deterministic grep is exactly right-sized and matches this repo's own established idiom for this exact class of gate. |

**Key insight:** Both requirements are "reuse, do not invent" phases -- MOAT-01 reuses a pattern that already exists twice in the SAME file it edits; MOAT-02 reuses a pattern that already exists in a sibling `scripts/check-*.cjs` file. Neither needs new architecture.

## MOAT-02: Concrete Target and Assertion Design

**Exact dead prose location (confirmed by direct read):** `docs/MOAT-MANDATE.md`, line 96, under `## PR Review Checklist for Moat Assessment` > `### Surface Area Warning Signs`:
```
- [ ] Does this work without KuzuDB edges?
```
This sits alongside three other manual-judgment checklist items (lines 94-97) that are NOT in scope -- only this one line is a stale/factually-wrong claim (the local graph has been SQLite, not KuzuDB, since the file's own "CORRECTION (2026-06-14, KuzuDB-drift sweep)" banner at line 3).

**Census of what "kuzu" actually means in this tree today (grep -rniE "kuzu", 168 hits / ~38 files, `[VERIFIED: direct grep this session]`):**

| Category | Example | Disposition for the assertion |
|----------|---------|-------------------------------|
| Historical/migration comments | `scripts/hsi-to-graph.cjs`: `"Migrated from hsi-to-kuzu.cjs (KuzuDB Cypher) to SQLite prepared statements."` | LEGITIMATE -- must stay exempt (deleting comment history is not the ask, and MOAT-02 is a light doc fix, not a comment-scrub) |
| Backward-compat exported alias | `lib/core/graph-ops.cjs`: `const buildGraphFromKuzu = buildGraphFromSQLite;` (the function body IS SQLite; only the export NAME says Kuzu, for callers that have not migrated) | LEGITIMATE -- this is an alias name, not a `require('kuzu')` call; a naive `grep -i kuzu` on JS identifiers would false-positive here if the assertion isn't scoped to require/import/dependency-manifest lines specifically |
| Backward-compat CLI subcommand string | `bin/mindrian-tools.cjs`: `case 'build-kuzu': { // backward-compat alias` | Same as above -- a string literal case label, not a live dependency |
| Doc/spec historical references | `docs/MWP-SPECIFICATION.md`, `docs/lazygraph-schema.md`, `references/research/*.md`, `docs/research/*.md` | LEGITIMATE -- describes the RETIRED engine as history, same as the `MOAT-MANDATE.md` correction banner itself |
| Package/dependency manifest | `package.json`, `package-lock.json` | **ZERO hits today** (`grep -n "kuzu" package.json` and `package-lock.json` both return nothing) -- this is the highest-signal spot a REAL reintroduction would show up first |
| Live `require`/`import` of a kuzu package | none found | **ZERO hits today** (`grep -rniE "require\(.kuzu\|from ['\"]kuzu\|import.*kuzu"` across all `.cjs`/`.js` returns nothing) -- this is the second highest-signal spot |

**Recommendation for the assertion's actual check:** do NOT attempt a blanket "the string kuzu must not appear anywhere" scan -- that would immediately false-positive against the ~38 legitimate files above and force a giant allowlist that itself becomes stale/fragile. Instead, scope the check narrowly to the two zero-hit-today categories that are the genuine reintroduction signal, mirroring `check-hook-schema-compatibility.cjs`'s "one self-identifying forbidden pattern, checked only against the files that can actually matter" design:

1. **`package.json` / `package-lock.json` dependency check:** fail if any dependency name matches `/^kuzu(-.*)?$/` (covers `kuzu`, `kuzu-wasm`, a hypothetical `@kuzudb/*` scope, etc. -- adjust the regex to the actual npm package family if the planner wants to be more specific after a quick npm-registry lookup of what the real kuzu package is named).
2. **Live `require`/`import` scan of tracked `.cjs`/`.js` source files (excluding `docs/`, `references/`, `pipelines/`, `.md` files, and this scanner's own source, mirroring `check-hook-schema-compatibility.cjs`'s self-exempt-and-doc-exempt precedent):** fail if any line matches a `require`/`import`/`from` statement referencing a `kuzu` package literally (not the word "kuzu" in a comment or string literal used as a case-label/alias-name).

This two-check design proves MOAT-02's own success criterion directly: "seeding one kuzu reference" (e.g. adding `const kuzu = require('kuzu');` to a scratch file, or adding a `"kuzu": "^1.0.0"` line to `package.json`) trips category 1 or 2 and fails; the CURRENT tree (zero hits in both categories, confirmed above) passes.

**Host script recommendation:** new file `scripts/check-kuzu-reintroduction.cjs`, structured identically to `scripts/check-hook-schema-compatibility.cjs` (exit 0 clean / exit 1 forbidden pattern found / exit 2 scanner failure; an `ALLOWLIST` `Set` for any file that legitimately needs to mention the literal package name, e.g. this scanner's own source or a future migration doc that quotes the exact `require` line as an example). Wire it into `scripts/verify-release` immediately after the existing `STOP_SCHEMA_OUT` block (line ~444), following that exact `$(node ... 2>&1) && CODE=0 || CODE=$?` capture idiom already used there. Replace `docs/MOAT-MANDATE.md` line 96 with a pointer, e.g.:
```
- [ ] `scripts/check-kuzu-reintroduction.cjs` passes (machine-checked: no live kuzu dependency or require/import re-enters the tree; historical/comment references are exempt).
```
Optionally fold the new script into `scripts/doctor.cjs`'s existing "coverage-gate" organ (the same fold-in pattern already used for `render-coverage`/`skill-mirrors`, doctor.cjs lines ~1002-1035) so it also surfaces in `doctor --acceptance`'s day-to-day report, not only at release time -- flagged as the planner's call (see Alternatives Considered above), not decided here.

## Crash-Injection Test Harness Precedent

**The orchestrator's framing needs one correction, made honestly here rather than silently carried forward:** the STATE.md Phase 233 entry (grepped and read directly this session) does NOT contain an actual "kill process mid-DELETE, reopen, assert intact" test. What Phase 233-03 actually shipped was `skipRebuild` -- an opt-in flag on `runDeriveBackfill`'s internal `_rebuildRoom` helper (`lib/core/graph-backfill.cjs` lines 197-209) to avoid CALLING `rebuildGraph` redundantly after a stage that already wrote fresh edges (the bug was "rebuild wipes what stage 3 just wrote," fixed by NOT re-triggering a rebuild, not by hardening rebuild's crash-safety). `_rebuildRoom` itself is a thin wrapper that calls the ALREADY-transaction-wrapped `rebuildGraph` from `lazygraph-ops.cjs` -- so there is no separate crash-injection test to reuse from that specific fix. **This is a gap, not a precedent** -- no test in this repo today actually kills a process mid-transaction and asserts recovery. Phase 236 and Phase 242 both need to build this test shape fresh; whichever phase's plan builds it first should be the shared reference for the other (a human coordination point worth flagging, since these are sibling worktrees today).

**What DOES already exist and IS a strong, directly reusable precedent (`[VERIFIED: direct read this session]`):**

1. **The fork()-based concurrent-reader pattern** -- `tests/test-sqlite-concurrent.cjs`, suite `SQLITE-03: WAL concurrent access`. Uses `child_process.fork()` to spin up a genuinely separate OS process holding its own `DatabaseSync` read-only handle against the same `room.db` file, while the parent process holds a second handle and performs a write, then asserts both reader handles see consistent data. This is the exact mechanism MOAT-01's "a concurrent reader during a live rewrite never observes an empty scoring layer" criterion needs -- extend this pattern so the child reader polls `SELECT COUNT(*) FROM edges WHERE type IN ('HSI_CONNECTION','REVERSE_SALIENT')` in a tight loop WHILE the parent is mid-rewrite (inside BEGIN, before COMMIT), and assert the count is NEVER 0 and NEVER a partial in-between value (WAL snapshot isolation guarantees this per the Context7 Grounding section above -- the count reader sees is either the full pre-rewrite set or the full post-rewrite set, nothing else).
2. **The `execFileSync` invocation precedent for hsi-to-graph.cjs** -- `lib/core/futures/orchestrator.cjs` line 533: `execFileSync(process.execPath, [hsiToGraph, resolvedRoom], { stdio: 'pipe', cwd: pluginRoot })`. For crash-injection, the test should use `child_process.spawn` (not `execFileSync`, which cannot be killed mid-flight synchronously) so the harness can send `SIGKILL` at a controlled point. Since `hsi-to-graph.cjs` currently has NO artificial delay, the harness will need either (a) a small `MINDRIAN_HSI_CRASH_TEST_DELAY_MS` env-var hook the test injects ONLY under test (a seam precedented elsewhere in this repo by `probeOpts`/`_forceUnavailable`-style test seams in `graph-backfill.cjs`), or (b) seed a LARGE enough `hsi_pairs`/`reverse_salients` array that the write loop takes long enough to reliably land a `SIGKILL` mid-loop without a dedicated hook. Option (a) is more deterministic and is the recommended approach -- flag for the planner to decide the exact seam name.
3. **The "seeded, already-scored room" fixture precedent** -- `tests/test-futures-hsi-integration.cjs` exercises the REAL `register -> assert -> compute-hsi.py -> hsi-to-graph.cjs -> read-back` pipeline end-to-end, but depends on `python3` + HSI deps being installed (it self-degrades to a Tier-0 no-op without them, per its own `result.degraded` branch). For a DETERMINISTIC crash-injection test that must run in any CI environment regardless of Python availability, the research recommends NOT reusing this fixture directly, but instead: (1) directly write a `.hsi-results.json` fixture file by hand (bypassing `compute-hsi.py` entirely -- the JSON shape is fully documented by reading `hsi-to-graph.cjs`'s own parsing code, lines 46-52), (2) pre-seed room.db with EXISTING `HSI_CONNECTION`/`REVERSE_SALIENT` edges from a prior "already-scored" run (representing the prior scoring layer the crash must not zero), (3) run `hsi-to-graph.cjs` as a child process via `spawn` against this fixture, (4) kill it mid-rewrite via the injected delay seam, (5) reopen room.db fresh and assert the PRE-crash edge set is still fully present (not the post-crash intended new set -- MOAT-01's stated bar is "leaves the PRIOR scoring layer fully intact on reopen," i.e. old-data survival, not new-data completion).

## Common Pitfalls

### Pitfall 1: Wrapping the DELETE but not the write loops (partial transaction)
**What goes wrong:** If only the two `DELETE FROM edges` statements are wrapped in BEGIN/COMMIT and the write loops run in a SEPARATE, later transaction (or no transaction), a crash between the two transactions still zeros the scoring layer -- the exact bug MOAT-01 exists to fix, reintroduced by an incomplete wrap.
**Why it happens:** It is tempting to treat "delete" and "rewrite" as two logically separate steps and wrap them separately, especially if refactoring incrementally.
**How to avoid:** One BEGIN before the first DELETE, one COMMIT after the last `upsertEdge.run()` call in both loops, one ROLLBACK path covering the whole span. Mirror `rebuildGraph`'s existing shape exactly (single BEGIN/COMMIT wrapping the ENTIRE delete-then-reindex body, confirmed by reading `lazygraph-ops.cjs` lines 542-618).
**Warning signs:** A code review that finds more than one `BEGIN` or more than one `COMMIT` inside `hsi-to-graph.cjs`'s `main()` function.

### Pitfall 2: Assuming a `timeout` option fixes crash-safety
**What goes wrong:** Adding `{ timeout: 5000 }` to `openGraph`'s `DatabaseSync` constructor call (mirroring `room-db.cjs`) does NOT provide atomicity or crash-safety -- it only affects how long a write waits to acquire a lock before giving up. A developer might confuse this with MOAT-01's actual ask.
**Why it happens:** Both `timeout` and the transaction wrap live in the same "SQLite write-safety" conversation (this is literally GRAPHDB-03's territory, adjacent to MOAT-01 in the same milestone), making it easy to conflate the two fixes.
**How to avoid:** Keep them conceptually separate in the plan: `timeout` = contention handling (Phase 236/GRAPHDB-03's concern, NOT touched by this phase), BEGIN/COMMIT/ROLLBACK = atomicity (MOAT-01's actual, sole concern).
**Warning signs:** A plan task that mentions `timeout:` when the success criterion only asks about "transaction wrap."

### Pitfall 3: A MOAT-02 grep regex that is too broad or too narrow
**What goes wrong:** Too broad (`grep -i kuzu` over the whole tree) immediately fails against ~38 legitimate historical/comment files today, forcing either a giant fragile allowlist or a false "FAIL" on the very first run. Too narrow (only checking `package.json`) misses a reintroduction that adds a `require('kuzu-something')` call without ever touching the manifest (e.g. a vendored/inlined copy, or a `require` of a transitive dependency already present for another reason).
**Why it happens:** The natural first instinct for "grep for kuzu" undersells how many legitimate historical mentions already exist in a corrected-in-2026-06-14 doc ecosystem.
**How to avoid:** Scope the check to the two genuinely zero-hit-today categories identified in the MOAT-02 census above (dependency manifest entries + live `require`/`import` statements in `.cjs`/`.js` source, excluding docs/comments/case-label-strings) rather than a blanket string search.
**Warning signs:** The new script's FIRST run against the current, un-mutated tree does not exit 0 cleanly -- that is a signal the scope is miscalibrated (per MOAT-02's own success criterion: "passes on the current tree").

## Code Examples

### hsi-to-graph.cjs transaction wrap (target state)
```javascript
// Source: this repo, lib/core/lazygraph-ops.cjs rebuildGraph (verified live read this
// session) -- the exact idiom to replicate in scripts/hsi-to-graph.cjs's main()
conn.prepare('BEGIN').run();
try {
  conn.prepare("DELETE FROM edges WHERE type = 'HSI_CONNECTION'").run();
  conn.prepare("DELETE FROM edges WHERE type = 'REVERSE_SALIENT'").run();
  // ...unchanged upsertEdge / insertNode loops from the current file...
  conn.prepare('COMMIT').run();
} catch (err) {
  try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
  throw err;
}
```

### Fork-based concurrent-reader assertion (extend the existing precedent)
```javascript
// Source: this repo, tests/test-sqlite-concurrent.cjs (verified live read this
// session) -- extend this exact fork() shape for MOAT-01's mutation-proof test
const child = fork(childReaderScript, [dbPath], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
// child reader polls: SELECT COUNT(*) FROM edges WHERE type IN
//   ('HSI_CONNECTION','REVERSE_SALIENT') in a tight loop while the parent
// triggers hsi-to-graph.cjs's rewrite; assert count is never 0 mid-rewrite.
```

### check-hook-schema-compatibility.cjs's allowlist-grep shape (template for MOAT-02)
```javascript
// Source: this repo, scripts/check-hook-schema-compatibility.cjs (verified live
// read this session) -- the exact scaffold to copy for check-kuzu-reintroduction.cjs
const ALLOWLIST = new Set([
  'scripts/check-kuzu-reintroduction.cjs', // self
]);
// exit 0 = clean, exit 1 = forbidden pattern found (blocks release),
// exit 2 = scanner failure (could not read a required file)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Local graph on KuzuDB (Cypher queries) | Local graph on `node:sqlite` (`room/.mindrian/room.db`) | 2026-06-14 KuzuDB-drift sweep (per `docs/MOAT-MANDATE.md`'s own correction banner) | The entire premise of the dead checklist line MOAT-02 fixes; MOAT-02 is the last remaining stale-prose artifact of this migration, per the audit's own "doctrine-rot" classification. |
| Raw hand-rolled cascade edge writes inside `_indexArtifactBody` | Cascade edges (`CONTRADICTS`/`INFORMS`/`ENABLES`/`INVALIDATES`) written SOLELY via `graph-derivation.cjs`'s `navigation.writeEdge` chokepoint | Phase 169 D-169-08 (MEDIUM-4), per in-code comments read this session | Not directly relevant to MOAT-01 (HSI/REVERSE_SALIENT edges are NOT part of this cascade-chokepoint change -- `hsi-to-graph.cjs` legitimately writes them via raw SQL, as the file's own header states: "via lazygraph-ops.cjs raw SQL, never through navigation.writeEdge"), but useful context for why hsi-to-graph.cjs's write pattern looks different from the newer cascade-edge writers. |

**Deprecated/outdated:** "KuzuDB" as a current claim anywhere in this repo is deprecated as of 2026-06-14; only historical/comment references should remain after MOAT-02 (and they should remain, per the correction-banner precedent -- deleting history is not the ask).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact npm package name a real "kuzu" reintroduction would use is `kuzu` (or a `kuzu-`/`@kuzudb/`-prefixed variant) -- not independently verified against the actual KuzuDB npm package name this session (no live npm registry lookup was performed, since zero such package needs installing for this phase). | MOAT-02: Concrete Target and Assertion Design, recommendation #1 | If the real package name differs (e.g. it ships only as `kuzu-node` or similar), the dependency-manifest regex in the new script would need a one-line adjustment. Low risk: the planner or executor can confirm the exact name with a 10-second `npm view kuzu version` check before finalizing the regex, and the live-`require`/`import` scan (recommendation #2) would still catch most reintroduction shapes regardless of exact package name, as a second layer. |
| A2 | No CONTEXT.md exists yet for Phase 242 (directory `.planning/phases/242-the-moat/` was empty at research time) -- this research assumes no user discussion has locked any decisions beyond the ROADMAP/REQUIREMENTS text already quoted verbatim above. | Whole document | If a CONTEXT.md is filed before planning begins, the planner should re-check this research against it; nothing here should contradict a plausible discuss-phase outcome given how narrowly scoped both requirements already are. |

**If this table is empty:** N/A -- two items above.

## Open Questions

1. **Should the shared `withTransaction(conn, fn)` helper extraction happen in this phase or be left as three independent inline copies?**
   - What we know: the pattern will exist at 2-3 call sites after MOAT-01 lands; extraction is cheap (~10 lines); Phase 236 touches the same file's `rebuildGraph` function concurrently in a sibling worktree.
   - What's unclear: whether Phase 236's plan independently decides to do this same extraction, creating a collision risk if both land competing helper shapes.
   - Recommendation: the Phase 242 planner should make this call explicitly (do it, or explicitly defer it with a one-line note), and a human should diff Phase 242's plan against Phase 236's actual plan once both exist, specifically checking for a `lazygraph-ops.cjs` merge collision on this exact helper.

2. **Does the `check-kuzu-reintroduction.cjs` gate belong in `verify-release` only, or also in `doctor.cjs`'s coverage-gate organ?**
   - What we know: `check-hook-schema-compatibility.cjs` (the closest sibling precedent) lives ONLY in `verify-release`, not in doctor's coverage-gate; `check-shape-declaration.cjs`/`render-coverage`/`skill-mirrors` DO live in doctor's coverage-gate.
   - What's unclear: no stated reason in the codebase for why some release-gate scripts are folded into doctor's day-to-day acceptance report and others are release-time-only.
   - Recommendation: default to `verify-release`-only (matching the closest sibling precedent, `check-hook-schema-compatibility.cjs`), and let the planner add the doctor.cjs fold-in only if there is a stated reason to want kuzu-reintroduction surfaced outside of release time.

3. **What is the exact crash-injection seam name/shape for `hsi-to-graph.cjs` (an env-var delay hook vs. a large-fixture timing approach)?**
   - What we know: two viable approaches exist (see Crash-Injection Test Harness Precedent, item 2); this repo has precedent for test-only seams (`probeOpts`, `_forceUnavailable`) in `graph-backfill.cjs`.
   - What's unclear: the exact seam name/env-var this phase should introduce has not been decided.
   - Recommendation: the planner should pick one in the plan itself (not left to the executor to invent ad hoc); a `MINDRIAN_HSI_CRASH_TEST_DELAY_MS` (or similarly named) env-var read only inside the write loop, defaulting to 0/no-op in production, is the recommended shape.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node:sqlite` (`DatabaseSync`) | MOAT-01 (the transaction wrap itself) | Yes | Node builtin, unflagged since Node v22.13.0; this repo runs v22.23.1 | None needed -- already proven working via 3 existing passing test files (`test-sqlite-concurrent.cjs`, `test-sqlite-battle.cjs`, `test-sqlite-ops.cjs`) |
| `python3` + HSI deps (sentence-transformers, LSA) | NOT required by this phase directly -- only relevant if the crash-injection test fixture reuses `tests/test-futures-hsi-integration.cjs`'s live `compute-hsi.py` path | Not checked this session (irrelevant per the recommendation above to bypass Python and hand-write the `.hsi-results.json` fixture) | -- | The recommended fixture approach (hand-written JSON, no Python invocation) makes this a non-dependency for MOAT-01's test |
| `node:child_process` `fork`/`spawn` | MOAT-01's crash-injection + concurrent-reader test harness | Yes | Node builtin | None needed |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none actually missing; python3 is a non-dependency by design per the recommended fixture approach above.

## Validation Architecture

`.planning/config.json`'s `workflow.nyquist_validation` is `true` (confirmed by direct read), so this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` (via `require('node:test')` -- confirmed the pattern used throughout `tests/test-sqlite-*.cjs`), plus a small number of plain-script (`process.exit(0/1)`) tests like `tests/test-futures-hsi-integration.cjs`. No third-party test framework (no Jest/Mocha) anywhere in `tests/`. |
| Config file | none -- `node:test` needs no config file; tests are run directly (`node tests/test-*.cjs`) or via `bash tests/run-all-<phase>.sh` aggregators. |
| Quick run command | `node tests/test-hsi-to-graph-transaction.cjs` (per-file, once written) |
| Full suite command | `bash tests/run-all-242.sh` (new aggregator, glob-discovery pattern copied from `tests/run-all-233.sh`) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOAT-01 | Crash injected mid-rewrite on a seeded already-scored room leaves the prior scoring layer intact on reopen | integration (real child-process kill) | `node tests/test-hsi-to-graph-transaction.cjs` | ❌ Wave 0 |
| MOAT-01 | A concurrent reader during a live rewrite never observes an empty scoring layer | integration (real `fork()`, extends `test-sqlite-concurrent.cjs`'s SQLITE-03 pattern) | `node tests/test-hsi-to-graph-transaction.cjs` (same file, second `describe` block, or a dedicated second file) | ❌ Wave 0 |
| MOAT-01 | Removing the transaction wrap turns the gate red (mutation-proof) | unit/integration (temporarily comment out BEGIN/COMMIT in a scratch copy, or assert the gate fails against a deliberately-reverted fixture per this repo's stated mutation-proof convention) | same file, an explicit mutation-proof assertion | ❌ Wave 0 |
| MOAT-02 | Machine-checked assertion fails when a kuzu reference re-enters the tree, passes on the current tree | unit (script exit-code assertion, seed-and-restore fixture) | `node tests/test-kuzu-reintroduction-gate.cjs` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node tests/test-hsi-to-graph-transaction.cjs` / `node tests/test-kuzu-reintroduction-gate.cjs` (whichever the task touches)
- **Per wave merge:** `bash tests/run-all-242.sh`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test-hsi-to-graph-transaction.cjs` -- covers MOAT-01 (all three success-criterion legs: crash-safety, concurrent-read, mutation-proof)
- [ ] `tests/test-kuzu-reintroduction-gate.cjs` -- covers MOAT-02 (seed-and-fail + current-tree-passes)
- [ ] `tests/run-all-242.sh` -- phase aggregator, copy `tests/run-all-233.sh`'s glob-discovery shape
- [ ] `scripts/check-kuzu-reintroduction.cjs` -- the production script itself (not a test file, but a Wave 0 build artifact the tests above depend on)
- Framework install: none needed -- `node:test` is a Node builtin already used throughout this repo's `tests/` directory.

## Security Domain

`security_enforcement` is not set in `.planning/config.json`; per the default-enabled rule, this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | This phase touches no auth surface. |
| V3 Session Management | No | Not applicable. |
| V4 Access Control | No | Not applicable. |
| V5 Input Validation | Yes (narrowly) | `hsi-to-graph.cjs` already uses parameterized `?` placeholders for every `INSERT`/`upsertEdge` call (confirmed by reading the file -- no string-concatenated SQL anywhere in the write path); the transaction wrap does not change this and must not introduce any new string-built SQL. |
| V6 Cryptography | No | Not applicable -- no crypto in scope. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| SQL injection via `.hsi-results.json` field values (`pair.left_id`, `rs.source_section`, etc., which originate from an upstream Python script's output, i.e. semi-trusted input) | Tampering | Already mitigated -- every write in `hsi-to-graph.cjs` uses `conn.prepare(...).run(param1, param2, ...)` parameter binding, never string interpolation into SQL text. The transaction wrap MUST preserve this (it only adds `BEGIN`/`COMMIT`/`ROLLBACK` around the existing calls, touching no parameter-binding code). `tests/test-sqlite-battle.cjs`'s existing `BATTLE-08: queryGraph SQL injection safety` suite is a repo-native precedent proving this class of concern is already taken seriously here. |
| Partial-write data corruption (the core MOAT-01 bug) | Tampering / Denial of Service (a zeroed scoring layer denies the moat's own value) | The transaction wrap itself IS the mitigation -- this is what MOAT-01 exists to fix. |

## Sources

### Primary (HIGH confidence)
- `https://nodejs.org/docs/latest-v22.x/api/sqlite.html` -- fetched live this session via WebFetch (Context7 MCP unavailable; this is the direct official-docs fallback). Confirmed: no `.transaction(fn)` helper, `timeout` option default `0`, unflagged since Node v22.13.0.
- `https://www.sqlite.org/wal.html` -- fetched live this session via WebFetch. Confirmed: WAL snapshot isolation (readers fix an "end mark" at read-start, never see uncommitted writer rows), crash-mid-transaction leaves no trailing commit record and is ignored on next open with zero manual recovery.
- This repo's own source, read directly this session: `scripts/hsi-to-graph.cjs`, `lib/core/lazygraph-ops.cjs`, `lib/core/room-db.cjs` (timeout option context), `lib/core/node-insert.cjs`, `docs/MOAT-MANDATE.md`, `lib/core/graph-backfill.cjs` (`_rebuildRoom`), `lib/core/futures/orchestrator.cjs` (`runHsiScan`), `tests/test-sqlite-concurrent.cjs`, `tests/test-sqlite-battle.cjs`, `tests/test-futures-hsi-integration.cjs`, `scripts/check-hook-schema-compatibility.cjs`, `scripts/doctor.cjs` (coverage-gate organ), `scripts/verify-release`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`.

### Secondary (MEDIUM confidence)
- None used -- every claim in this document is either a direct repo-source read (HIGH, `[VERIFIED]`) or a live official-docs fetch (HIGH, `[CITED]`). No WebSearch was needed for this narrow, well-precedented phase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, both fixes reuse already-shipped, already-tested code paths in this exact repo.
- Architecture: HIGH -- the target pattern (BEGIN/COMMIT/ROLLBACK) already exists twice in the file MOAT-01 edits; the target pattern for MOAT-02 already exists in a sibling file in the same directory.
- Pitfalls: HIGH -- derived directly from reading the actual unguarded code and the actual proven-working sibling code, not speculation.
- Context7/node:sqlite WAL grounding: HIGH for the documented claims (official Node + official SQLite docs, fetched live this session); MEDIUM for "does `node:sqlite`'s specific binding deviate from vanilla SQLite WAL behavior" (no deviation found, but not exhaustively ruled out beyond this repo's own passing empirical test).

**Research date:** 2026-07-28
**Valid until:** 30 days (stable domain -- SQLite/WAL semantics do not change; the only fast-moving element, the `node:sqlite` experimental-flag status, is already resolved as of Node v22.13.0 and this repo already runs well past that version).

## RESEARCH COMPLETE
