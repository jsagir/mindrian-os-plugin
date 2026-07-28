# Phase 236: room.db Data-Loss Fixes - Research

**Researched:** 2026-07-28
**Domain:** `node:sqlite` (`DatabaseSync`) transaction scope, WAL snapshot visibility, and typed open-failure classification over the room.db substrate
**Confidence:** HIGH

**Note on provenance.** This is the `gsd-phase-researcher` subagent's returned document. While the
subagent was still running, an interim fallback version of this file was written in its place; that
fallback is now superseded. This document keeps everything the fallback got right (both collapse call
sites, the repo-wide version-floor sweep, the chokepoint-not-call-site instinct, the criterion-1
imprecision warning) and **corrects two concrete errors in it** that would have produced a broken
implementation:

- The fallback guessed `INDEXER_OWNED_EDGE_TYPES = ['WIKILINK', ...]`. **No `WIKILINK` edge type exists
  anywhere in this codebase.** The indexer writes exactly one edge type, `BELONGS_TO`. Source-verified.
- The fallback proposed bumping `engines.node` to `>=22.13.0`. That is the floor at which the *module*
  unflagged, not the floor at which the **`timeout` option** exists. `timeout` was added in **v22.16.0**.
  Shipping `>=22.13.0` leaves the silent-no-op window (22.13-22.15) wide open, which is precisely what
  GRAPHDB-03 exists to close.

It also resolves the fallback's three open questions with measurements rather than recommendations to
measure later. Every load-bearing claim below was produced either by **running code against this
machine's real Node/SQLite build** (Node v22.23.1) or by quoting official nodejs.org / sqlite.org
documentation. The two remaining soft spots are named in the Assumptions Log.

## Summary

Phase 236 has three requirements in very different states of readiness. The single most important
finding is that **ROADMAP criterion 1, taken literally, is already GREEN on unmodified `main` and would
not catch the defect the phase exists to close.** I injected a SIGKILL between the DELETE and the COMMIT
inside a live `rebuildGraph` on a seeded room and every irreplaceable row survived: `memory_event` 25/25,
`truth_claim` 10/10, opportunity `stage_history` intact 5/5. The existing `BEGIN`/`COMMIT`/`ROLLBACK`
wrap at `lazygraph-ops.cjs:542-618` already delivers crash-safety. I then ran the same rebuild to normal
successful completion and the same room came back `memory_event=0, truth_claim=0, opportunity=0` with
only `Artifact=800 Section=4` remaining. **The loss does not happen on the crash path. It happens on the
happy path, atomically, every single time.** The mutation that must turn the GRAPHDB-01 gate red is
therefore **restoring the unscoped DELETE**, not "removing the transaction wrap."

Criterion 2 is likewise **already satisfied by current code**, and I proved it by observation rather than
from docs, exactly as the criterion demands. A child-process reader polled the room.db 1,239 times with
zero errors throughout a live 248 ms rebuild and observed exactly two distinct total-node counts, 25 and
484, with no intermediate value, no empty table, and no partial Artifact set. WAL snapshot isolation
holds on this Node/SQLite combination. The same run captured the defect from the reader's side:
`memory_event` jumped 25 -> 0 with nothing in between. The phase's job on criterion 2 is to **pin this
with a regression test**, not to build anything.

GRAPHDB-02 is the genuinely open work, and I reproduced its collapse live. There are **two** collapse
sites. The primary is `openRoomDbForCaller` (`lib/core/navigation/spine-events.cjs:362-371`), which ends
in a bare `catch (_e) { return null; }` sitting directly beneath an
`if (!fs.existsSync(dbPath)) return null;`. Those two `null`s are byte-identical to all ~30 downstream
callers, and the function's own comment instructs callers to read `null` as "Tier 0 cold start." The
second is `lib/core/graph-derivation.cjs:255`,
`try { db = openRoomDb(roomDir); } catch (_e) { db = null; }`. Busy, mid-migration, and corrupt room.db
all collapse into "this room has no database."

GRAPHDB-03 turned out sharper than "log only": the `timeout` option was **added in Node v22.16.0**,
`package.json` declares `>=22.5.0`, and node:sqlite **silently ignores unknown constructor options**
(verified live). On Node 22.13.0-22.15.x the `timeout: 5000` write-safety fix from Phase 218-02 is not an
error, it is a **silent no-op** - this milestone's own signature failure shape, living inside
`room-db.cjs`.

**Primary recommendation:** implement the RCA's Change 1 (an exported `INDEXER_OWNED_NODE_TYPES` /
`INDEXER_OWNED_EDGE_TYPES` allowlist scoping the DELETE to exactly `{Artifact, Section}` /
`{BELONGS_TO}`), leave the transaction wrap untouched, add a typed open-result door beside
`openRoomDbForCaller` that discriminates on `err.errcode & 0xff`, and bump `engines.node` to `>=22.16.0`.

<user_constraints>
## User Constraints (from CONTEXT.md)

**No CONTEXT.md exists for this phase.** `/gsd-discuss-phase` was not run; this was an explicit
orchestrator decision for an urgent, self-evident scope, not an oversight. ROADMAP.md's Phase 236
definition, REQUIREMENTS.md's GRAPHDB-01/02/03, and the routed-in RCA stand in as the constraint set.

- **Locked Decisions:** none.
- **Claude's Discretion:** everything below, bounded by the Project Constraints section.
- **Deferred Ideas (OUT OF SCOPE):** none recorded.

One item genuinely warrants navigator input before planning: the criterion-1 reconciliation in Open
Question 1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRAPHDB-01 | `rebuildGraph` cannot erase `memory_event` rows, confirmed truth-claims, decisions, or opportunity `stage_history`; the delete-then-reindex is wrapped in one transaction so a crash or concurrent reader never sees a partial/empty state | Root cause re-verified against current `main`. Transaction wrap already exists and already works, proven by crash injection (Evidence A) and a 1,239-sample concurrent-reader run (Evidence B). Remaining gap is DELETE SCOPE. Exact allowlist derived from source, not guessed (Pattern 1). |
| GRAPHDB-02 | A busy or mid-migration room.db open reports its real state (busy/broken) instead of collapsing into "no room db" / cold start | Collapse reproduced live end to end at both call sites (Evidence C). Full error taxonomy by `errcode` (Evidence D), and the non-obvious reason an already-migrated db does NOT fail busy, are documented (Pattern 2, Pitfalls 1-4, 6). |
| GRAPHDB-03 | The `timeout:5000` write-safety option's real version floor is documented and `package.json` engines reflects it | Floor established at **v22.16.0** from two official sources plus a live `PRAGMA busy_timeout` readback. Silent-no-op behavior on 22.13-22.15 verified live (Evidence E, Pitfall 5). Second stated floor found in CI (Pitfall 9). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Binding with the same authority as locked decisions.

| Constraint | Source | How it binds Phase 236 |
|------------|--------|------------------------|
| **Consult Context7 for `node:sqlite` before any transaction-wrapping fix** | CLAUDE.md grounding rule + ROADMAP Cross-Cutting Research Rules | Discharged. The orchestrator ran the Context7 leg; this file extends it against official nodejs.org and sqlite.org sources. Context7 MCP tools were NOT present in this agent's tool set (documented upstream tool-stripping bug) and `ctx7` is not on PATH; the fallback used the same authoritative primaries Context7 proxies. Stated honestly rather than papered over. |
| **CJS only, no TypeScript** | Conventions > Code | The allowlist constant and typed-open helper ship as `.cjs`. |
| **No em-dashes anywhere; use hyphens** | Writing and Structure | Applies to every new file, comment, and CHANGELOG entry. |
| **Canon Part 9 - navigation.cjs is the single SQL chokepoint** | Canon Compliance Core | The typed-open door MUST be a new MODE on `lib/core/navigation/spine-events.cjs`, never a second chokepoint. `scripts/check-substrate.cjs` fails the build otherwise. |
| **Canon Part 11 - every invocable surface declares a HITL shape** | Canon Compliance Core | `mcp:room_graph` has NO entry in `data/connector-registry.json` (verified: only `mcp:graph_query` and `mcp:graph_write` exist). The most destructive graph operation in the codebase carries no declared shape. |
| **Canon Part 7 - Reuse Before Build** | Canon Compliance Core | Reuse `Object.freeze(new Set([...]))` (`edges.cjs:32`), reuse `closeRoomDbForCaller`, reuse `insertNode` (`node-insert.cjs`). Do NOT add a second close helper or chokepoint. |
| **Canon Part 8 - LOCAL never egresses** | Canon Compliance Core | Pure local SQLite, zero network surface. The phase runner should carry the standard comment-stripped egress tripwire leg. |
| **Tri-Polar: CLI + Desktop + Cowork** | Tri-Polar Design Rule | Both fixes live in shared `lib/core/`, so all three inherit them. **Cowork matters most for GRAPHDB-02**: multi-user concurrent access is exactly what produces a busy room.db. State this rather than skipping it. |
| **GSD Workflow Enforcement** | CLAUDE.md | No direct repo edits outside `/gsd-execute-phase`. |
| **Dev-Research Compositing** | CLAUDE.md | This phase touches MindrianOS's own architecture, so findings must ALSO land at `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, cross-linked both ways. The RCA did this for GRAPHDB-01; the GRAPHDB-02/03 findings here are NEW and need their own mirrored entry. |
| **RCA discipline** | QA and RCA Reporting | On resolve, move `.planning/debug/graph-rebuild-truncates-memory-journal.md` to `.planning/debug/resolved/` and add a summary block to `.planning/debug/knowledge-base.md`. |

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scoping which graph rows the indexer may delete | Storage / Data (`lib/core/lazygraph-ops.cjs`) | - | Ownership is a property of the write path that creates the rows; it belongs beside the DELETE, not in a caller. |
| Declaring the ownership contract as readable data | Storage / Data (exported frozen Set) | Verification (tests + grep gate) | The RCA's key insight: make ownership DATA that other modules and tests can read, not an assumption buried in one SQL string. |
| Classifying an open failure (busy / broken / absent) | Storage / Data (`lib/core/room-db.cjs`) | Chokepoint (`lib/core/navigation/spine-events.cjs`) | Only the module performing the open sees the raw `errcode`. The chokepoint is where the typed result reaches callers who may not require `room-db.cjs`. |
| Surfacing busy/broken to a human | MCP / CLI surface | - | Out of scope beyond returning a typed result callers CAN render. Do not build UI here. |
| Gating the destructive `graph-rebuild` subcommand | MCP router + `data/connector-registry.json` | - | Part 11 declaration is a registry/router concern, not a storage concern. |
| Declaring the runtime version floor | `package.json` engines | CI workflow, docs | A runtime capability requirement is a manifest fact, but it is stated in more than one place (Pitfall 9). |

**Why this map matters here:** the likeliest tier misassignment is putting busy/broken classification in
the *callers* (~30 `if (db === null)` sites) instead of at the open. That would be thirty places to get
right and thirty places to regress. Classification belongs at the single point that can see the error.
</architectural_responsibility_map>

<standard_stack>
## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` (`DatabaseSync`) | built-in; **>=22.16.0 required** (see GRAPHDB-03); v22.23.1 observed on this machine | The entire room.db substrate | Already the repo's fixed choice (Canon Part 9: "SQL (room.db) is the local mind"). Not a decision this phase reopens. |

### Supporting

**None.** This phase adds **zero** new dependencies. Everything needed already exists:

| Existing module | Path | Reuse it for |
|-----------------|------|--------------|
| Frozen-Set taxonomy idiom | `lib/core/navigation/edges.cjs:32` (`ALLOWED_EDGE_TYPES`) | The shape for `INDEXER_OWNED_*_TYPES` |
| Shared NOT-NULL-safe node insert | `lib/core/node-insert.cjs` (`insertNode`) | Already the indexer's write chokepoint; do not bypass |
| Chokepoint door precedent | `lib/core/navigation/spine-events.cjs:431` (`openRoomDbReadOnlyForCaller`) | Template for a new open MODE without a second chokepoint |
| Tolerant close | `spine-events.cjs:373` (`closeRoomDbForCaller`) | Reuse; its header says "Do NOT add a duplicate close helper" |
| Grep-gate hygiene idiom | `tests/run-all-233.sh`, `run-all-158.sh` | Comment-stripped source gates with a negative self-test |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Scoped DELETE via type allowlist | An `owner`/`provenance` discriminator column on `nodes` | Cleaner long-term, but needs a migration across two live schema generations (3-column legacy and phase-109 wide). Disproportionate. Note as long-term direction; do not build now. |
| Scoped DELETE | Soft-delete / tombstone column | Same migration cost plus every reader must learn to filter. RCA CLAIM-11 confirms no tombstone exists. |
| Typed open result object | Throwing typed error subclasses | ~30 callers do `if (!db)`. A thrown error changes control flow at all of them. An additive NEW sibling door leaves every existing caller byte-unchanged, matching how Phase 211-02 and Phase 232.1 both extended this exact file. |
| `err.errcode` discrimination | `sqlite.constants.SQLITE_BUSY` | **Does not exist.** Verified live: `sqlite.constants` exports ONLY the eight `SQLITE_CHANGESET_*` names. See Pitfall 3. |
| Hand-wrapped BEGIN/COMMIT (current) | better-sqlite3's `db.transaction(fn)` | Not applicable. `DatabaseSync` has no `transaction()` method - confirmed against the live prototype: `open, close, prepare, exec, function, location, aggregate, createSession, applyChangeset, enableLoadExtension, loadExtension`. The repo already documents this at `lazygraph-ops.cjs:529-537`. |
| `file:...?mode=ro` URI for read-only | The documented `readOnly: true` option (added v22.5.0) | The URI form is the established repo idiom in four places. Out of scope; noted only so the planner is not surprised the option exists. |

**Installation:** N/A. No `npm install` in this phase.
</standard_stack>

## Package Legitimacy Audit

**Not applicable.** This phase installs **zero** external packages. Every module it touches is a Node
built-in (`node:sqlite`, `node:fs`, `node:path`, `node:os`, `node:crypto`, `node:child_process`) or
already-vendored first-party code under `lib/`. No registry surface, no `postinstall` surface, no
slopsquatting exposure is introduced.

**Packages removed due to slopcheck [SLOP] verdict:** none (none proposed).
**Packages flagged as suspicious [SUS]:** none (none proposed).

## Live Evidence

Produced by running code on this machine against the repo's real `lib/core/*.cjs` modules, on **Node
v22.23.1**, in worktree `.claude/worktrees/agent-ab7fdf6d6e8c978c7`. Probe scripts lived under
`.planning/tmp-236-probe/` and were removed after the runs; the plan should re-create permanent
equivalents.

### Evidence A - Crash injection mid-rebuild (GRAPHDB-01, criterion 1)

Room seeded with 800 artifact files plus 25 `memory_event`, 10 `truth_claim`, and 5 `opportunity` nodes
carrying two-entry `stage_history[]`. A child process opened the room and called
`lazygraph.rebuildGraph`; the parent SIGKILLed it 60 ms in (after `BEGIN` + the DELETE, before `COMMIT`).

```
BEFORE: memory_event=25 opportunity=5 truth_claim=10
child exited code=null signal=SIGKILL
AFTER : memory_event=25 opportunity=5 truth_claim=10
>>> memory_event survived : 25/25
>>> truth_claim survived  : 10/10
>>> stage_history intact  : true (5/5 opportunity rows)
```

Same fixture, allowed to run to **normal successful completion**:

```
BEFORE: memory_event=25 opportunity=5 truth_claim=10
child exited code=0  DONE {"success":true,"artifacts":800,"sections":4,"subRooms":0}
AFTER : Artifact=800 Section=4
>>> memory_event survived : 0/25
>>> truth_claim survived  : 0/10
>>> stage_history intact  : false (0/5 opportunity rows)
```

**[VERIFIED: live run, this machine]** The crash path is SAFE on unmodified `main`. The happy path
destroys everything. This is the most decision-relevant fact in this document, and it also settles the
fallback's worry that "a real SIGKILL can't be scripted in-process" - it can, from a parent process.

### Evidence B - Concurrent reader throughout a live rebuild (GRAPHDB-01, criterion 2)

480 artifact files + 25 `memory_event` rows. A **separate child process** (a genuinely separate SQLite
connection) polled `SELECT count(*) FROM nodes` plus per-type counts through a read-only
`file:...?mode=ro` handle while the parent ran a real `rebuildGraph`.

```
rebuildGraph took 248 ms -> {"success":true,"artifacts":480,"sections":4,"subRooms":0}
reader samples: 1239 | errors: 0
distinct total node counts observed  : [25, 484]
distinct memory_event counts observed: [25, 0]
distinct Artifact counts observed    : [0, 480]
>>> reader EVER saw an empty nodes table?   false
>>> reader EVER saw a PARTIAL Artifact set? false
>>> reader EVER saw memory_event count < 25? true   <-- the data-loss defect, observed live
```

**[VERIFIED: live run, this machine]** WAL snapshot isolation holds. 1,239 samples, zero errors, zero
intermediate states. Criterion 2 passes on current code; the work is to pin it. The same run
independently reproduces the defect from a reader's viewpoint as an atomic 25 -> 0.

### Evidence C - The cold-start collapse (GRAPHDB-02, criterion 3)

Three scenarios against real `openRoomDb` / `navigation.openRoomDbForCaller`:

```
S1 already-migrated db + EXCLUSIVE lock : openRoomDb -> OK (no write work needed) | 1ms
S2 pending-migration db + EXCLUSIVE lock: openRoomDb -> THREW {"message":"database is locked",
                                          "code":"ERR_SQLITE_ERROR","errcode":5} | 1ms
S2 openRoomDbForCaller                  -> null | 1ms
S2 openRoomDbForCaller(room with no db) -> null
>>> COLLAPSE CONFIRMED? YES -- a BUSY / mid-migration room.db is byte-identical to "no room db"

S3 corrupt db : openRoomDb -> THREW {"message":"database disk image is malformed","errcode":11}
S3 openRoomDbForCaller         -> null (SAME as no-room-db)
S3 openRoomDbReadOnlyForCaller -> handle   <-- opens fine, throws only at first QUERY
```

**[VERIFIED: live run, this machine]** S1 is the subtle one and it drives the whole test design
(Pitfall 1).

### Evidence D - The `node:sqlite` open-failure taxonomy

| Failure class | `err.code` | `err.errcode` | `err.message` | Throws at |
|---------------|-----------|--------------|---------------|-----------|
| Busy / locked | `ERR_SQLITE_ERROR` | **5** (`SQLITE_BUSY`) | `database is locked` | first WRITE, not construction |
| Corrupt pages | `ERR_SQLITE_ERROR` | **11** (`SQLITE_CORRUPT`) | `database disk image is malformed` | first read/write touching a bad page; construct + `PRAGMA journal_mode=WAL` + `CREATE TABLE` all SUCCEED first |
| Cannot open (dir in place of file, chmod 000) | `ERR_SQLITE_ERROR` | **14** (`SQLITE_CANTOPEN`) | `unable to open database file` | **construction** |
| Not a database (garbage bytes) | `ERR_SQLITE_ERROR` | **26** (`SQLITE_NOTADB`) | `file is not a database` | first `exec`; construction SUCCEEDS |
| NOT NULL constraint | `ERR_SQLITE_ERROR` | **1299** (extended) | `NOT NULL constraint failed: ...` | statement run |
| CHECK constraint | `ERR_SQLITE_ERROR` | **275** (extended) | `CHECK constraint failed: ...` | statement run |

**[VERIFIED: live run, this machine]** `err.code` is the constant string `ERR_SQLITE_ERROR` for every
SQLite failure and is **useless for discrimination**. `err.errcode` carries the SQLite result code and is
the only usable discriminator. The 1299 and 275 rows prove node:sqlite surfaces **extended** result
codes, which is why the mask in Pitfall 4 is mandatory. This resolves what the fallback correctly flagged
as its LOW-confidence open question.

### Evidence E - Busy timeout is real, and unknown options are silently ignored (GRAPHDB-03)

```
known-timeout        -> ACCEPTED (no throw)
unknown-bogusOption  -> ACCEPTED (no throw)
unknown-fileMustExist-> ACCEPTED (no throw)
unknown-nonsense     -> ACCEPTED (no throw)
wrongtype-timeout    -> THREW {"message":"The \"options.timeout\" argument must be an integer.",
                               "code":"ERR_INVALID_ARG_TYPE"}

node v22.23.1
busy_timeout PRAGMA readback with NO timeout option: {"timeout":0}
busy_timeout PRAGMA readback with timeout:5000     : {"timeout":5000}
busy_timeout PRAGMA readback with a BOGUS option   : {"timeout":0}
```

**[VERIFIED: live run, this machine]** Unknown constructor options are accepted and dropped without
warning. Only a wrong-TYPE *known* option throws. Therefore on any Node where `timeout` is not yet
implemented, `{ timeout: 5000 }` is a silent no-op and the busy timeout stays 0.

### Evidence F - The busy handler is skipped inside a transaction

Two contrasting observations against the same exclusive lock:

- A bare autocommit `CREATE TABLE` waited the full **5043 ms**, then threw `errcode 5`.
- `openRoomDb`'s migration chain (deferred `BEGIN`, then a write) threw `errcode 5` in **1 ms**, ignoring
  the 5000 ms timeout entirely.

Documented SQLite behavior, not a node:sqlite quirk **[CITED: sqlite.org/c3ref/busy_handler.html]**:
*"If SQLite determines that invoking the busy handler could result in a deadlock, it will go ahead and
return SQLITE_BUSY to the application instead of invoking the busy handler."*

**Planning consequence:** a busy `openRoomDb` fails in about 1 ms, not 5 seconds, and `timeout: 5000`
does **not** protect the migration chain. It protects autocommit writes only.

<architecture_patterns>
## Architecture Patterns

### System Architecture Diagram

```
                        MCP client / CLI / hook / doctor
                                     |
                     +---------------+----------------+
                     |                                |
          lib/mcp/tool-router.cjs            scripts/*, bin/*, lib/core/doctor/*
          case 'graph-rebuild'                        |
          [NO gate, NO hitl_shape]                    |
                     |                                |
          lib/core/graph-ops.cjs                      |
          rebuildGraph(roomDir)                       |
          returns {success, artifacts, sections}      |
          [no destroyed-row accounting]               |
                     |                                |
                     |          lib/core/graph-backfill.cjs
                     |          runDeriveBackfill({...})
                     |          skipRebuild defaults FALSE  <-- opt-OUT required
                     |                    |
                     +---------+----------+
                               |
                   lib/core/lazygraph-ops.cjs
                   rebuildGraph(conn, roomDir)
                               |
              conn.prepare('BEGIN').run()          <-- line 542, CORRECT, leave alone
                               |
              DELETE FROM edges; DELETE FROM nodes;  <-- line 545, THE DEFECT
                               |                         (unscoped: no WHERE, no type filter)
              _indexArtifactBody() x N               <-- restores ONLY Artifact/Section/BELONGS_TO
                               |
              conn.prepare('COMMIT').run()         <-- line 614
                               |
                        room.db  nodes / edges
                        (ONE table, TWO populations)
                               |
        +----------------------+------------------------+
        |                                               |
   DERIVED (regenerable)                     ORIGINAL (irreplaceable)
   Artifact, Section                         memory_event, truth_claim, decision,
   BELONGS_TO                                opportunity(stage_history), claim,
        ^                                    open_question, EvidenceClaim, lens_finding,
        |                                    brain_insight, planning_artifact, requirement,
   written by the indexer                    focus, operator, HatState, governing_thought,
                                             navigator_persona, memory_artifact, ...
                                                       ^
                                             written by ~22 other production modules
                                             (lib/core/navigation/*, close-loop-writer,
                                              breakthrough/schema, hsi-to-graph, ...)

  --- separate concern, GRAPHDB-02: TWO collapse sites ---

  ~30 callers (lib/mcp/tools/*, doctor modules, scripts/*, bin/*)
        |
  navigation.openRoomDbForCaller(roomDir)      <-- spine-events.cjs:362  [PRIMARY]
        |
        +-- roomDir falsy ------------------> return null  \
        +-- !fs.existsSync(dbPath) ---------> return null   |  ALL FOUR
        +-- openRoomDb() throws BUSY -------> return null   |  INDISTINGUISHABLE
        +-- openRoomDb() throws CORRUPT ----> return null  /
        |
  caller reads null as "Tier 0 cold start" and abstains silently

  lib/core/graph-derivation.cjs:255            <-- [SECONDARY, same shape]
        try { db = openRoomDb(roomDir); } catch (_e) { db = null; }
```

### Pattern 1: The ownership allowlist (GRAPHDB-01)

**What:** turn "which rows does the indexer own" from an implicit assumption inside one SQL string into
an exported frozen Set that tests and other modules can read.

**When to use:** any destructive bulk operation over a shared table. This is the generalizable lesson.

**The exact allowlist, derived from source, not guessed.** `rebuildGraph`'s reindex calls only
`_indexArtifactBody` (`lazygraph-ops.cjs:376-420`), which writes exactly three things:

```javascript
// Source: lib/core/lazygraph-ops.cjs:392-401, verbatim from current main
insertNode(conn, id, 'Artifact', artifactProps);
insertNode(conn, section, 'Section', sectionProps);
conn.prepare(
  'INSERT INTO edges (source, target, type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
).run(id, section, 'BELONGS_TO');
```

Therefore:

```javascript
// Reuses the Object.freeze(new Set([...])) idiom from
// lib/core/navigation/edges.cjs:32 ALLOWED_EDGE_TYPES (Canon Part 7).
const INDEXER_OWNED_NODE_TYPES = Object.freeze(new Set(['Artifact', 'Section']));
const INDEXER_OWNED_EDGE_TYPES = Object.freeze(new Set(['BELONGS_TO']));
```

**CRITICAL - what must NOT go in the allowlist.**

- **`CausalClaim` and `WhitespaceZone`.** `lib/core/node-insert.cjs`'s header lists four indexer-adjacent
  node types (`Section`, `Artifact`, `CausalClaim`, `WhitespaceZone`), which makes them a tempting
  allowlist. But `CausalClaim` and `WhitespaceZone` are written by `createCausalClaim` and
  `addWhitespaceZone`, which `rebuildGraph` **never calls**. Allowlisting them would delete rows the
  reindex never restores, creating a brand-new data-loss bug inside the fix for a data-loss bug. This is
  the highest-risk trap in the phase.
- **The four cascade edge types** (`CONTRADICTS` / `INFORMS` / `ENABLES` / `INVALIDATES`).
  `lazygraph-ops.cjs:398-414` documents that Phase 169 D-169-08 **disabled** the indexer's raw-SQL
  cascade writes; derivation via `navigation.writeEdge` is now their sole writer. The indexer cannot
  restore them, so it must not delete them. This is exactly the Phase 233-03 near-miss recorded in
  `STATE.md` ("wrote 20 connection edges" into a room that finished with ZERO).
- **`WIKILINK`.** No such edge type exists in this codebase. It appeared in the interim fallback as a
  guess and is corrected here.

**Anti-pattern:** deriving the allowlist from `EDGE_TYPES` at `lazygraph-ops.cjs:25` (23 members) or from
`ALLOWED_EDGE_TYPES` in `edges.cjs`. Those are the *legal vocabulary*, not the *indexer's ownership*.
Using either would delete nearly every edge in the room.

### Pattern 2: Typed open result as an additive sibling door (GRAPHDB-02)

**What:** add a new MODE on the existing chokepoint returning a discriminated result, leaving the
existing `null`-returning door byte-unchanged.

**When to use:** when ~30 callers depend on the current contract and only some need richer information.

**Precedent to copy exactly:** `openRoomDbReadOnlyForCaller` (`spine-events.cjs:431`) was added at Phase
232.1 as a NEW MODE beside `openRoomDbForCaller`, with a header explaining why it is not a second
chokepoint: *"This is a NEW sibling MODE of entry through the SAME lib/core/navigation/ chokepoint -
never a second chokepoint."*

```javascript
// errcode values VERIFIED live (Evidence D). sqlite.constants does NOT export
// these (Pitfall 3), so they are named locally. The 0xff mask is mandatory:
// node:sqlite surfaces EXTENDED result codes (observed 1299, 275).
const SQLITE_BUSY = 5, SQLITE_CORRUPT = 11, SQLITE_CANTOPEN = 14, SQLITE_NOTADB = 26;

function classifyOpenError(err) {
  const primary = (err && typeof err.errcode === 'number') ? (err.errcode & 0xff) : null;
  if (primary === SQLITE_BUSY) return 'busy';
  if (primary === SQLITE_CORRUPT || primary === SQLITE_NOTADB) return 'broken';
  if (primary === SQLITE_CANTOPEN) return 'unreadable';
  return 'error';
}

// Returns a DISCRIMINATED result, never a bare null:
//   { state: 'absent',     db: null }        // genuinely no room.db - Tier 0 cold start
//   { state: 'ok',         db: <handle> }
//   { state: 'busy',       db: null, err }   // another connection holds a write lock
//   { state: 'broken',     db: null, err }   // corrupt / not-a-database
//   { state: 'unreadable', db: null, err }   // permissions, path is a directory
function openRoomDbTypedForCaller(roomDir) { /* ... */ }
```

**Do NOT** change `openRoomDbForCaller`'s return contract. Its `null` is load-bearing at ~30 sites
including `scripts/intent-classifier.cjs`, whose comment at line 1850 explicitly documents the
null-means-Tier-0 reading.

**On the chokepoint-vs-call-site question:** the fix belongs at a chokepoint, not distributed across call
sites. Note the nuance: `openRoomDbForCaller` swallows for the ~30 navigation-door callers, while direct
`openRoomDb` callers mostly do NOT try/catch and would propagate a raw exception - a *crash* shape,
distinct from the silent-null *collapse* shape. Both improve once classification happens at the origin.

### Pattern 3: Leave the transaction wrap alone

The wrap at `lazygraph-ops.cjs:542-618` is correct, deliberate (its comment cites "Plan 87-06"), and
empirically load-bearing (Evidence A and B). The RCA's own recommendation is explicit: *"rebuildGraph's
transaction wrapping is already the correct pattern and should not be changed on the atomicity axis."*
Any plan task that modifies `BEGIN`/`COMMIT`/`ROLLBACK` here is regression risk with no upside.

### Anti-Patterns to Avoid

- **Believing criterion 1's literal wording.** "Removing the transaction wrap turns this gate red" is
  false for the memory-survival assertion. A plan implementing criterion 1 verbatim ships green with the
  data loss fully intact.
- **Testing the busy path against an already-migrated room.db.** It will not fail (Evidence C, S1) and
  the test proves nothing. See Pitfall 1.
- **Discriminating on `err.code`.** It is always `ERR_SQLITE_ERROR`.
- **Reaching for `sqlite.constants.SQLITE_BUSY`.** It is `undefined` (Pitfall 3).
- **Comparing `err.errcode === 5` without masking.** Breaks on extended codes (Pitfall 4).
- **Touching `scripts/hsi-to-graph.cjs`.** Phase 242's territory. See Scope Boundary.
- **Changing `runDeriveBackfill`'s `skipRebuild` default.** Once the DELETE is scoped, the default is no
  longer a destruction hazard. Flipping it is a behavior change to every caller with no remaining safety
  justification (RCA Change 3 agrees). Leave it.
</architecture_patterns>

## Scope Boundary: Phase 236 vs Phase 242 (verify before planning)

**`scripts/hsi-to-graph.cjs` is OUT OF SCOPE for Phase 236.** Confirmed on both sides:

- The routed-in RCA lists it under **"Named follow-up, out of scope here"**: lines 61-62 run
  `DELETE FROM edges WHERE type = 'HSI_CONNECTION'` and the `'REVERSE_SALIENT'` equivalent as **bare,
  un-transacted autocommit statements**, with a genuine torn-read window under WAL that `rebuildGraph`'s
  wrap does not share.
- ROADMAP.md Phase 242 ("The Moat") owns it, and scopes 242 as a **soft** dependency that *"soft-reuses
  Phase 236's crash-injection + transaction-wrap proof pattern"* - the same PROOF PATTERN, a different
  file.

**Planner instruction:** Phase 236's file list must not contain `scripts/hsi-to-graph.cjs`. A human
checking overlap against Phase 242's plan later should find zero shared files and one shared test idiom.
If both plans name that file, one of them is wrong.

One genuine coupling to note without acting on it: `scripts/hsi-to-graph.cjs` DOES call `insertNode`
from `lib/core/node-insert.cjs` for its Section upsert. If Phase 236 exports the allowlist, Phase 242 can
consume it - the RCA's stated long-term direction. Export it so that consumption is easy; do not build
the consumption here.

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction wrapping for the rebuild | A new BEGIN/COMMIT scheme, a savepoint scheme, or a `transaction(fn)` shim | The wrap at `lazygraph-ops.cjs:542-618` | It exists, it is correct, and Evidence A/B prove it works. node:sqlite has no `transaction(fn)` to shim to. |
| SQLite result-code names | A hand-copied full result-code table | Four named numeric constants (5/11/14/26), masked | `sqlite.constants` does not export them. A four-entry local table is honest and auditable; a copied 80-entry table rots. |
| A second room.db opening chokepoint | A new module requiring `node:sqlite` directly | A new MODE on `lib/core/navigation/spine-events.cjs` | Canon Part 9 + `scripts/check-substrate.cjs` fail the build. Only allow-listed paths may touch the substrate (both `room-db.cjs` and `lazygraph-ops.cjs` are already allow-listed, so the fixes need no allow-list edit). |
| A duplicate close helper | `closeRoomDbTypedForCaller` | The existing `closeRoomDbForCaller` | Its header explicitly forbids a duplicate; it already tolerates any handle shape. |
| Node/edge type vocabulary | A new taxonomy | `Object.freeze(new Set([...]))` beside `ALLOWED_EDGE_TYPES` | One frozen-Set idiom in the repo; matching it makes the constant discoverable. |
| Busy/lock error classification | Guessing at `err.message` string matching | The `errcode` table in Evidence D, masked to the primary code | Already observed rather than assumed, per the roadmap's own "proven by observation, not asserted from docs" instruction. |
| Detecting whether a room "has a graph" | Counting rows through the read-only door | Nothing new, but see Pitfall 6 | The read-only door OPENS a corrupt db successfully and only throws at query time, where `countTable`'s catch-all reads it as 0 rows. |

**Key insight:** almost every instinct this phase invites ("add a transaction," "add a retry," "add a
constants table," "add a helper") is already satisfied somewhere in this repo. The one genuinely new
thing is the **ownership allowlist**, and it is one constant plus one SQL predicate.
</dont_hand_roll>

## Runtime State Inventory

Included because this phase has a real runtime-state consequence beyond code, named explicitly by the
RCA. Not a rename, but the "what still carries the old state after the code is fixed" question applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data (already-damaged rooms)** | Any room that has ALREADY run `graph-rebuild` (via the MCP tool, or any default `runDeriveBackfill` caller such as `scripts/graph-heal-pipeline.cjs`) has ALREADY lost its `memory_event` history, confirmed claims, decisions, and opportunity `stage_history`. `.planning/STATE.md` records `motj-ecosystem` as one such room from the Phase 233-03 run. RCA CLAIM-11 confirms no backup, tombstone, or soft-delete at any layer. | **NONE RECOVERABLE by code.** Surface it to affected navigators. The plan should include a task that WRITES THIS DOWN where a navigator will meet it (CHANGELOG + `knowledge-base.md` summary block), never a task implying repair is possible. |
| **Live service config** | None. No n8n workflow, Datadog tag, Tailscale ACL, or Cloudflare tunnel references room.db state. | None - verified by scope: pure local SQLite, zero network surface (Canon Part 8). |
| **OS-registered state** | None. No Task Scheduler entry, pm2 process name, launchd plist, or systemd unit references `rebuildGraph` or the room.db schema. | None - the destructive path is reached only via in-process calls and the MCP router. |
| **Secrets / env vars** | `MINDRIAN_DISABLE_BYPASS_AUDIT` (`room-db.cjs:57`) and `MINDRIAN_ALLOW_HOSTED_DERIVE` (Phase 233-02) sit near this code but neither is renamed or re-read. **No `--experimental-sqlite` flag and no `NODE_OPTIONS` anywhere in the repo** (verified by grep across the full tree excluding `node_modules`). | None for the fix. The absence of the flag is load-bearing for GRAPHDB-03: it is why `>=22.5.0` is wrong. |
| **Build artifacts / schema generations** | Two live `nodes` schema generations coexist: the legacy 3-column form from `initSchema` and the phase-109 wide NOT-NULL form (`node-insert.cjs` detects both). Separately, `initSchema`'s `CREATE TABLE IF NOT EXISTS edges` comment states the Phase 169 FK removal *"applies to NEW dbs only; existing dbs keep their prior schema."* | **A pre-Phase-169 room.db may still carry hard FKs from `edges(source/target)` to `nodes(id)`.** Since `openRoomDb` sets `PRAGMA foreign_keys = ON`, a newly-SCOPED `DELETE FROM nodes WHERE type IN (...)` could hit FK violations or cascades where the current unscoped delete-edges-first never could. **The plan MUST handle this** - keep scoped-edges-before-scoped-nodes ordering, and add a legacy-FK fixture. See Pitfall 7. |

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: The busy test silently proves nothing on an already-migrated room.db

**What goes wrong:** you seed a room, lock it exclusively from a second connection, call `openRoomDb`,
and it **succeeds in 1 ms**. The busy-detection test passes trivially and asserts nothing.

**Why it happens:** on a fully-migrated db, `openRoomDb` performs **zero writes**. Every
`CREATE TABLE IF NOT EXISTS` is a no-op, `PRAGMA journal_mode = WAL` on an already-WAL db is a no-op, and
all five migrations return early on their identity sentinels. SQLite never needs a write lock. Verified
live (Evidence C, S1).

**How to avoid:** the busy path requires the open to have **real write work**. Two valid fixtures:
(a) delete a migration sentinel from the `identity` table and revert its schema change (my probe removed
`phase_224_edge_review_status_v1` and dropped `edges.review_status`), or (b) use a room whose `room.db`
does not exist yet. Fixture (a) is the honest simulation of criterion 3's "caught mid-migration" and is
what reproduced the collapse.

**Warning signs:** the busy leg returns in ~1 ms with `state: 'ok'`; the test passes before the fix.

### Pitfall 2: Budgeting 5 seconds for the busy failure

**What goes wrong:** a test waits ~5 s for `timeout: 5000` to expire. The migration-chain busy failure
returns in **~1 ms**.

**Why it happens:** SQLite skips the busy handler when invoking it could deadlock, exactly the
deferred-`BEGIN`-then-upgrade shape the migrations use **[CITED: sqlite.org/c3ref/busy_handler.html]**.
Observed contrast: bare autocommit `CREATE TABLE` waited 5043 ms; `openRoomDb`'s migration threw in 1 ms
(Evidence F).

**How to avoid:** assert on the returned `state`, never on elapsed time. Comment that `timeout: 5000`
protects autocommit writes, not the transaction-wrapped migration chain.

### Pitfall 3: `sqlite.constants.SQLITE_BUSY` does not exist

**What goes wrong:** `if ((err.errcode & 0xff) === sqlite.constants.SQLITE_BUSY)` compares against
`undefined`, is always false, and every busy open classifies as `'error'`.

**Why it happens:** `sqlite.constants` exports **only** the eight `SQLITE_CHANGESET_*` names. Verified
live via `Object.keys(sqlite.constants)` and confirmed in the official docs
**[CITED: nodejs.org/docs/latest-v22.x/api/sqlite.html]**.

**How to avoid:** define the four numeric constants locally with a source comment. Add a test asserting
`sqlite.constants.SQLITE_BUSY === undefined`, so if Node ever adds them the test tells you rather than
the classifier silently changing meaning.

### Pitfall 4: Comparing `errcode` without masking to the primary code

**What goes wrong:** `err.errcode === 5` misses `SQLITE_BUSY_RECOVERY` (261) and `SQLITE_BUSY_SNAPSHOT`
(517), so a busy open under WAL recovery classifies as `'error'`.

**Why it happens:** node:sqlite surfaces **extended** result codes. Proven live against this repo's own
schema: NOT NULL reported `errcode: 1299`, CHECK reported `275` (Evidence D).

**How to avoid:** always `const primary = err.errcode & 0xff;` before comparing. Include an extended-code
fixture so the mask is mutation-proven.

### Pitfall 5: `timeout: 5000` is a SILENT no-op on Node 22.13.0-22.15.x

**What goes wrong:** the Phase 218-02 write-safety fix is present in source, passes review, and does
nothing at runtime. Contended writes fail at 0 ms with SQLITE_BUSY exactly as before.

**Why it happens:** the `timeout` option was **added in v22.16.0**
**[CITED: nodejs.org/docs/latest-v22.x/api/sqlite.html options version-history table]**, and node:sqlite
**silently ignores unknown constructor options** - four bogus names were all accepted without a throw,
and `PRAGMA busy_timeout` read back `0` with a bogus option versus `5000` with the real one (Evidence E).
`package.json` declares `>=22.5.0`, which permits 22.13-22.15.

**How to avoid:** bump `engines.node` to `>=22.16.0`. Optionally add a startup assertion reading back
`PRAGMA busy_timeout` and warning if it is 0 while `timeout` was requested - turning a silent no-op into
a visible signal, which is precisely this milestone's theme.

**Warning signs:** none at all. That is the point.

### Pitfall 6: A corrupt room.db passes the READ-ONLY door and reads as "zero rows"

**What goes wrong:** `openRoomDbReadOnlyForCaller` returns a **live handle** for a corrupted database
(Evidence C, S3). It only constructs; it never queries. The first real query throws `errcode 11`, and
`room-graph-density-module.cjs`'s `countTable` catch-all reads that as **0 rows**. A corrupt room silently
reports an empty graph rather than a broken one.

**Why it happens:** SQLite defers page validation until a page is actually read. Construction and even
`CREATE TABLE` can succeed against a corrupt file (Evidence D).

**How to avoid:** the typed door must **probe with a real statement** (e.g. `SELECT count(*) FROM
sqlite_schema`) before declaring `state: 'ok'`. A construction that did not throw is not evidence of a
healthy database. If the plan scopes GRAPHDB-02 to the read-write door only, say so explicitly and record
the read-only door's behavior as a dated known gap.

### Pitfall 7: Scoping the DELETE can hit foreign keys on legacy room.db files

**What goes wrong:** `DELETE FROM nodes WHERE type IN ('Artifact','Section')` throws an FK violation or
cascade-deletes edges meant to be preserved - on old rooms only, so it passes every test written against
a freshly-created fixture.

**Why it happens:** current `initSchema` defines `edges` with **no foreign keys** (Phase 169 D-169-11
removed them; PK is `(source, target, type)`). But its own comment states the change *"applies to NEW dbs
only; existing dbs keep their prior schema."* Meanwhile `openRoomDb` sets `PRAGMA foreign_keys = ON`, and
node:sqlite's `enableForeignKeyConstraints` also defaults to `true`
**[CITED: nodejs.org/docs/latest-v22.x/api/sqlite.html]**.

**How to avoid:** preserve the edges-before-nodes ordering in the scoped form, and add a fixture built on
a legacy `edges` schema WITH the FKs. `PRAGMA foreign_key_list(edges)` is the runtime probe that
identifies which generation a room is on. See Assumption A1.

### Pitfall 8: The `_runBackfillSync` un-awaited rebuild

**What goes wrong:** `graph-backfill.cjs:353` fires `_rebuildRoom(t)` **without `await`** in the sync
runner, immediately followed by synchronous derivation on the same target. A test that seeds rows, calls
`runDeriveBackfill` with defaults, and asserts immediately may read a state the rebuild has not finished
writing.

**Why it happens:** documented as a KNOWN, ACCEPTED RACE at `graph-backfill.cjs:343-348`, accepted for
byte-compat with pre-224 callers.

**How to avoid:** drive the default-path preservation test through the **async** path, or poll to
quiescence. Do not "fix" the race in this phase; once the DELETE is scoped it is no longer a destruction
hazard, and changing it is a behavior change to every caller.

### Pitfall 9: `package.json` is not the only place the Node floor is stated

**What goes wrong:** engines is bumped but a second stated floor drifts.

**Why it happens:** verified by grep - `.github/workflows/agentshield-scan.yml:52` carries the comment
*"Pinned to the Node major matching package.json engines (>=22.5.0)."* That comment goes stale the moment
engines changes.

**How to avoid:** grep for `22\.5\.0` and `>=22` repo-wide (excluding `node_modules`) as part of the
GRAPHDB-03 task. No `.nvmrc` exists. This is log-only per the roadmap, so accuracy is the whole
deliverable.
</common_pitfalls>

<code_examples>
## Code Examples

### The exact line to change (verified against current main)

```javascript
// Source: lib/core/lazygraph-ops.cjs:542-545
conn.prepare('BEGIN').run();
try {
  // Clear all existing data (edges first for FK compliance)
  conn.exec('DELETE FROM edges; DELETE FROM nodes;');   // <-- THE defect. Line 542's BEGIN stays.
```

### The scoped form (shape, not final code)

```javascript
// Keep edges-before-nodes ordering (Pitfall 7: legacy dbs may still carry FKs).
// Bind the allowlist as parameters rather than interpolating, so the constant
// stays the single source of truth and no SQL string carries a second copy.
const nodeTypes = [...INDEXER_OWNED_NODE_TYPES];
const edgeTypes = [...INDEXER_OWNED_EDGE_TYPES];
conn.prepare(
  'DELETE FROM edges WHERE type IN (' + edgeTypes.map(() => '?').join(',') + ')'
).run(...edgeTypes);
conn.prepare(
  'DELETE FROM nodes WHERE type IN (' + nodeTypes.map(() => '?').join(',') + ')'
).run(...nodeTypes);
```

### Current `openRoomDb` construction (GRAPHDB-02 target)

```javascript
// Source: lib/core/room-db.cjs:100-140
const db = (opts && opts.allowExtension === true)
  ? new DatabaseSync(dbPath, { allowExtension: true, timeout: 5000 })
  : new DatabaseSync(dbPath, { timeout: 5000 });
db.exec('PRAGMA journal_mode = WAL');
// ... initSchema + initMemorySchema + 5 chained migrations, each of which can throw ...
```

### The two collapse sites (the shape GRAPHDB-02 must eliminate)

```javascript
// PRIMARY - Source: lib/core/navigation/spine-events.cjs:362-371
function openRoomDbForCaller(roomDir) {
  try {
    if (!roomDir || typeof roomDir !== 'string') return null;
    if (!fs.existsSync(_roomDbPath(roomDir))) return null;   // "absent"
    return roomDbMod.openRoomDb(roomDir);
  } catch (_e) {
    return null;                                             // busy / broken / unreadable
  }                                                          // ALL become the SAME null
}

// SECONDARY - Source: lib/core/graph-derivation.cjs:253-256
let db = null;
if (roomDir) {
  try { db = openRoomDb(roomDir); } catch (_e) { db = null; }
}
```

### Classifying the open failure

```javascript
// errcode values VERIFIED live on Node v22.23.1 (Evidence D).
// sqlite.constants does NOT export these (Pitfall 3), so they are named locally.
// The 0xff mask is mandatory: node:sqlite surfaces EXTENDED result codes,
// observed as 1299 (NOT NULL) and 275 (CHECK) against this repo's own schema.
const SQLITE_BUSY = 5, SQLITE_CORRUPT = 11, SQLITE_CANTOPEN = 14, SQLITE_NOTADB = 26;

function classifyOpenError(err) {
  const primary = (err && typeof err.errcode === 'number') ? (err.errcode & 0xff) : null;
  if (primary === SQLITE_BUSY) return 'busy';
  if (primary === SQLITE_CORRUPT || primary === SQLITE_NOTADB) return 'broken';
  if (primary === SQLITE_CANTOPEN) return 'unreadable';
  return 'error';
}
```

### The concurrent-reader observation (criterion 2's proof shape)

```javascript
// Reader must be a SEPARATE PROCESS to be a genuinely separate SQLite connection.
// PASS condition: the set of observed total-node counts has NO intermediate value.
const samples = [];
while (!stop) {
  const db = new DatabaseSync('file:' + dbPath + '?mode=ro');
  samples.push({ total: db.prepare('SELECT count(*) c FROM nodes').get().c });
  db.close();
}
// Observed on this machine: distinct totals were exactly [25, 484]. Never partial.
```
</code_examples>

<sota_updates>
## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node:sqlite` behind `--experimental-sqlite` | Module unflagged, still experimental | **v22.13.0** (and v23.4.0), PR 55890 **[CITED: nodejs/node doc/api/sqlite.md YAML changes block]** | On 22.5.0-22.12.x, `require('node:sqlite')` throws without the flag. No shebang, npm script, or `NODE_OPTIONS` in this repo passes it. `>=22.5.0` is flatly wrong. |
| No busy-timeout option | `timeout` constructor option, number, **Default: 0** | **v22.16.0** **[CITED: nodejs.org/docs/latest-v22.x/api/sqlite.html options version-history table]** | The real floor for GRAPHDB-03. Below it the option is silently dropped (Pitfall 5). |
| Stability 1.0 experimental | **Stability 1.2 - Release candidate** as of v25.7.0 / v24.15.0 (PR 61262); still 1.1 "Active development" in the v22.x line | v25.7.0 / v24.15.0 | The substrate is maturing but is NOT stable in the Node line this repo targets. Worth one CHANGELOG sentence. |
| `edges` with hard FKs to `nodes(id)` | `edges` with PK `(source, target, type)`, no FKs | Phase 169 D-169-11 | New dbs have no FKs; **old dbs keep theirs**. Drives Pitfall 7. |
| Indexer wrote cascade edges via raw SQL | Derivation via `navigation.writeEdge` is the SOLE cascade writer | Phase 169 D-169-08 | The indexer can no longer restore cascade edges, so it must not delete them. Directly determines the allowlist. |

**Deprecated / outdated:** better-sqlite3 idioms (`db.transaction(fn)`, `fileMustExist`) do not exist in
node:sqlite. Both are already correctly flagged in repo comments (`lazygraph-ops.cjs:529-537`,
`spine-events.cjs:414`). Do not reintroduce either name. Note that a `readOnly: true` option DOES exist
(added v22.5.0); the "no fileMustExist" comment is about a different thing.
</sota_updates>

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | Yes | **v22.23.1** (above the 22.16.0 floor) | - |
| `node:sqlite` `DatabaseSync` | room.db substrate | Yes | built-in, unflagged, `timeout` honored (`PRAGMA busy_timeout` reads back 5000) | - |
| `node:child_process` | two-process concurrency tests | Yes | built-in | - |
| Context7 MCP (`mcp__context7__*`) | CLAUDE.md mandatory grounding | **No** - absent from this agent's tool set (documented upstream MCP-stripping bug) | - | **Used:** official nodejs.org docs + raw `doc/api/sqlite.md` from nodejs/node `main`, plus live runtime probes. Equivalent or better authority for these specific claims. The orchestrator's own Context7 leg is preserved and extended. |
| `ctx7` CLI | Context7 fallback | **No** - not on PATH | - | Same as above. Did NOT use `npx --yes` (forbidden: silently executes unverified packages). |
| `slopcheck` | package legitimacy gate | Not run | - | Not needed: zero packages installed. |
| `langtalks-graph-expert` MCP | CLAUDE.md grounding rule | Not consulted for this file | - | Deliberate and recorded. GRAPHDB-01/02/03 are `node:sqlite` API-contract questions, and CLAUDE.md's own rule says to pick the source that actually covers the claim rather than defaulting to langtalks. The RCA already discharged the langtalks leg for GRAPHDB-01 and recorded an honest **corpus gap** ("destructive reindex sharing storage with an append-only audit log" returned only weak co-occurrence edges). Re-querying would not change that. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Context7 MCP and `ctx7`, both covered by the official primary
sources Context7 would have proxied anyway.

<validation_architecture>
## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`, so this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Hand-rolled CJS assertion scripts + bash aggregators (repo convention; no jest/vitest/mocha anywhere) |
| Config file | none - each `tests/run-all-<phase>.sh` is the harness |
| Quick run command | `node tests/test-236-<name>.cjs` |
| Full suite command | `bash tests/run-all-236.sh` |
| Estimated runtime | under ~30 s total (local SQLite only; the two-process legs dominate) |

**Convention to copy:** `tests/run-all-233.sh` is the best model. It **glob-discovers** every
`tests/test-233-*` file (`.cjs` and `.sh`) so later plans add coverage without editing the harness, runs
the relevant pre-existing generic gates unmodified, and ends with a comment-stripped Canon Part 8 egress
tripwire carrying a **negative self-test** proving the gate bites before it is trusted. Phase 236's
harness should have all three properties.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPHDB-01 | A **normally completing** `rebuildGraph` preserves every `memory_event`, `truth_claim`, `decision`, and opportunity `stage_history` row | integration | `node tests/test-236-rebuild-survival.cjs` | Wave 0 |
| GRAPHDB-01 | Mutation gate: restoring the unscoped `DELETE FROM edges; DELETE FROM nodes;` turns the above RED | integration (mutation) | same file, control leg | Wave 0 |
| GRAPHDB-01 | `runDeriveBackfill({roomDir})` with DEFAULT options preserves the same counts (use the ASYNC path, Pitfall 8) | integration | `node tests/test-236-backfill-default-preserves.cjs` | Wave 0 |
| GRAPHDB-01 | Crash injection mid-rebuild leaves all rows intact (pins the EXISTING wrap against regression) | integration, 2-process SIGKILL | `node tests/test-236-crash-injection.cjs` | Wave 0 |
| GRAPHDB-01 | Mutation gate: removing `BEGIN`/`COMMIT` turns the **crash** test red, and correctly does NOT turn the survival test red | integration (mutation) | same file, control leg | Wave 0 |
| GRAPHDB-01 (crit. 2) | A separate-process reader polling throughout a live rebuild observes no empty and no partial state | integration, 2-process | `node tests/test-236-wal-concurrent-reader.cjs` | Wave 0 |
| GRAPHDB-01 | Allowlist correctness: `CausalClaim`, `WhitespaceZone`, and all four cascade edge types are NOT allowlisted | unit | `node tests/test-236-indexer-ownership.cjs` | Wave 0 |
| GRAPHDB-01 | Source gate: no unscoped `DELETE FROM nodes`/`edges` under `lib/` (comment-stripped), PLUS an anti-vacuity assertion that the literal token still exists unstripped | source gate | `node scripts/check-unscoped-node-delete.cjs` | Wave 0 |
| GRAPHDB-02 | A room.db with a PENDING migration held under an exclusive lock returns `state:'busy'`, distinguishable from `state:'absent'` | integration | `node tests/test-236-typed-open.cjs` | Wave 0 |
| GRAPHDB-02 | A corrupt room.db returns `state:'broken'`, not `'absent'` and not `'ok'` | integration | same file | Wave 0 |
| GRAPHDB-02 | The old collapse cannot be reproduced: busy / broken / absent yield three DIFFERENT states | integration | same file | Wave 0 |
| GRAPHDB-02 | `openRoomDbForCaller`'s null contract is byte-unchanged (no regression at the ~30 existing call sites) | unit | same file, control leg | Wave 0 |
| GRAPHDB-02 | `errcode` masking handles extended codes; `sqlite.constants.SQLITE_BUSY` asserted `undefined` | unit | `node tests/test-236-errcode-taxonomy.cjs` | Wave 0 |
| GRAPHDB-03 | `engines.node` is `>=22.16.0`, the running Node satisfies it, and no stale floor remains elsewhere | unit + grep | `node tests/test-236-engines-floor.cjs` | Wave 0 |
| GRAPHDB-03 | `PRAGMA busy_timeout` reads back 5000 on a handle from `openRoomDb` (proves the option is live, not silently dropped) | integration | same file | Wave 0 |
| Part 11 | `data/connector-registry.json` has an `mcp:room_graph` entry with a declared `hitl_shape` | source gate | `node scripts/build-connector-registry.cjs --check` + `node scripts/check-shape-declaration.cjs` | exists (needs the new entry) |

### Sampling Rate

- **Per task commit:** `node tests/test-236-<file the task touched>.cjs`
- **Per wave merge:** `bash tests/run-all-236.sh`
- **Phase gate:** `bash tests/run-all-236.sh` green, PLUS no-regression on the suites owning the modified
  files - `bash tests/run-all-224.sh` (owns `graph-backfill.cjs`), `bash tests/run-all-233.sh` (owns the
  heal pipeline calling it), `bash tests/run-all-232.1.sh` (owns the read-only door in
  `spine-events.cjs`), and `node scripts/doctor.cjs --acceptance`.

### Wave 0 Gaps

Every test is new. There is **no existing test file** named for `rebuildGraph`, `lazygraph-ops`, or
`room-db` (verified: `ls tests/ | grep -iE "rebuild|lazygraph|room-db"` returns nothing). Nearest
neighbours are `tests/test-200-graph-chokepoint.cjs` and `tests/test-232.1-room-graph-density.cjs`.

- [ ] `tests/run-all-236.sh` - glob-discovering harness on the `run-all-233.sh` model
- [ ] `tests/test-236-rebuild-survival.cjs` - GRAPHDB-01 core + mutation control
- [ ] `tests/test-236-backfill-default-preserves.cjs` - default path, async runner
- [ ] `tests/test-236-crash-injection.cjs` - two-process SIGKILL; pins the existing wrap
- [ ] `tests/test-236-wal-concurrent-reader.cjs` - two-process poll; criterion 2
- [ ] `tests/test-236-indexer-ownership.cjs` - allowlist membership + exclusions
- [ ] `tests/test-236-typed-open.cjs` - busy / broken / absent trichotomy
- [ ] `tests/test-236-errcode-taxonomy.cjs` - masking + `sqlite.constants` assertion
- [ ] `tests/test-236-engines-floor.cjs` - GRAPHDB-03 + repo-wide stale-floor grep
- [ ] `scripts/check-unscoped-node-delete.cjs` - source gate with anti-vacuity leg
- [ ] Shared fixture helper seeding the four irreplaceable node types. **Schema constraints discovered
      the hard way:** `nodes.source_path` is NOT NULL and `nodes.created_by` carries
      `CHECK (created_by IN ('user','larry','import','brain','system'))`. A naive 3-column insert fails
      with `errcode 1299`. Route seeds through `insertNode` (`lib/core/node-insert.cjs`) or supply all
      provenance columns.
- Framework install: **none needed.**

**Manual-only verifications:** none. Every success criterion has a scriptable, deterministic
reproduction - all of them were rehearsed as working probes during this research pass.
</validation_architecture>

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface; local file substrate only. |
| V3 Session Management | no | No sessions in this path. |
| V4 Access Control | **yes** | The MCP `room_graph` router exposes the most destructive graph operation in the codebase with **no gate and no declared `hitl_shape`** (verified: no `mcp:room_graph` entry in `data/connector-registry.json`). Control: the Part 11 declaration plus a Decision Gate on the `graph-rebuild` subcommand only, mirroring `mcp:graph_write`'s `F.1`. Read subcommands must not be over-gated. |
| V5 Input Validation | **yes** | The DELETE predicate must be built from a **frozen allowlist bound as parameters**, never string-interpolated. `graph-query` already accepts arbitrary SQL through the same router, so keeping the new predicate parameterized matters. |
| V6 Cryptography | no | None involved. |
| V7 Error Handling / Logging | **yes** | The heart of GRAPHDB-02. The bare `catch (_e) { return null; }` is a textbook swallowed-exception defect: it destroys distinguishing information and reports a benign state. Control: classify at the origin, return a typed state, never invent "absent" from an error. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unattended destructive operation reachable in one tool call, sold as "repair" | Denial of Service / Tampering | Decision Gate + `hitl_shape` on the destructive subcommand; honest tool description (current text at `tool-router.cjs:895` sells `graph-rebuild` as "build and repair it"). |
| Silent data destruction reported as `{success: true}` | Repudiation | RCA Change 4: count and report preserved/affected rows so the receipt matches reality. |
| Swallowed exception collapsing distinct failures into a benign state | Repudiation / DoS | The typed open result. This IS the GRAPHDB-02 fix. |
| SQL injection via interpolated type list | Tampering | Parameterized `IN (?, ?)` from a frozen constant. |
| TOCTOU between `fs.existsSync(dbPath)` and the open | Tampering | Pre-existing in both doors. Low severity locally; the typed door should classify the resulting throw rather than re-checking. |
| Concurrent multi-writer corruption (Cowork surface) | Tampering | WAL plus a busy timeout that is actually in effect - which is why GRAPHDB-03's version floor is security-adjacent, not cosmetic. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pre-Phase-169 `room.db` files carrying hard FKs on `edges(source/target)` still exist in real user rooms | Runtime State Inventory, Pitfall 7 | If true and unhandled, the scoped DELETE throws FK violations or cascade-deletes preserved edges on exactly the oldest, most valuable rooms. If false, one test fixture is wasted. **Cheap to settle:** run `PRAGMA foreign_key_list(edges)` against an aged room such as `motj-ecosystem` before finalizing the SQL. |
| A2 | `decision` nodes are among the destroyed population | GRAPHDB-01 scope | Verified empirically for `memory_event`, `truth_claim`, and `opportunity`. `decision` was verified only as a string literal in a navigation writer plus the RCA's claim, not by seeding one through its real writer. Low risk (same table, not allowlisted, so preserved either way), but the survival test should seed a `decision` row through its real writer. |

Everything else is `[VERIFIED]` by a live run on this machine or `[CITED]` to nodejs.org / sqlite.org /
a verbatim source read of current `main`.

<open_questions>
## Open Questions

1. **ROADMAP criterion 1's mutation clause contradicts the empirical evidence. Which wins?**
   - What we know: the criterion says *"the delete-then-reindex rides ONE transaction; removing the
     transaction wrap turns this gate red."* Evidence A shows the wrap already exists, the crash path
     already preserves 25/25 + 10/10 + 5/5, and destruction happens on the **successful** path where the
     wrap is irrelevant.
   - What's unclear: whether the navigator wants the criterion re-worded, or both gates.
   - **Recommendation:** keep both and say which mutation proves which. Criterion 1 becomes (a)
     normal-completion survival, mutation = restore the unscoped DELETE; (b) crash-injection survival,
     mutation = remove the transaction wrap. That satisfies the literal text AND closes the real defect.
     **This is the one item genuinely warranting navigator input before planning**, because a plan built
     on the literal wording alone ships green with the data loss intact.

2. **Does GRAPHDB-02's typed result cover the read-only door too?**
   - What we know: `openRoomDbReadOnlyForCaller` has the same bare `catch -> null`, AND additionally
     returns a live handle for a corrupt db that only throws at query time (Evidence C, S3), where
     `countTable`'s catch-all silently reads it as 0 rows.
   - **Recommendation:** cover both. The read-only door is what doctor/census modules use, and a silent
     zero there is a worse lie than a null. If scoped to the read-write door only, record the read-only
     gap as a dated known issue rather than leaving it unstated.

3. **Should `graph-rebuild` be gated in this phase or deferred?**
   - What we know: RCA Change 2 names it; Canon Part 11 requires the declaration; `mcp:room_graph` has no
     registry entry at all. But it is a behavior change on a live MCP surface, and none of the three
     GRAPHDB requirement texts mention gating.
   - **Recommendation:** ship the **registry declaration** (a cheap Part 11 compliance fact, no behavior
     change) in this phase; treat the Decision Gate itself as a separate call. Once Change 1 lands,
     `graph-rebuild` is no longer destructive to irreplaceable data, which materially lowers the gate's
     urgency. Say this explicitly rather than letting it drift.

4. **How far does GRAPHDB-02's code change reach?**
   - What we know: two collapse sites confirmed (`spine-events.cjs:362`, `graph-derivation.cjs:255`).
     Most direct `openRoomDb` callers do not try/catch at all and would propagate a raw exception - a
     crash shape, not the collapse shape this phase is chartered to fix.
   - **Recommendation:** scope code changes to `room-db.cjs` (classification at origin) plus
     `spine-events.cjs` (the typed door) plus AT MOST `graph-derivation.cjs` as a second acceptance
     target. Updating all other call sites is a documented follow-up; flag that narrowing explicitly
     rather than doing it silently.

5. **What is done about already-damaged rooms?**
   - What we know: no code fix recovers them (RCA CLAIM-11: no backup, no tombstone, no soft-delete).
     `motj-ecosystem` is a named, dated instance in `STATE.md`.
   - **Recommendation:** one task that writes the fact where a navigator will meet it (CHANGELOG +
     `knowledge-base.md`). Do not create a task implying recovery is possible.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- **Live runtime probes on this machine**, Node v22.23.1, against the repo's real `lib/core/*.cjs`:
  crash injection (A), 1,239-sample concurrent reader (B), busy/corrupt collapse through the real
  chokepoint doors (C), open-failure `errcode` taxonomy (D), option-validation policy and
  `PRAGMA busy_timeout` readback (E), busy-handler-skipped-in-transaction timing (F).
- **Verbatim source reads of current `main`** in this worktree: `lib/core/lazygraph-ops.cjs`
  (`rebuildGraph` 517-660, `_indexArtifactBody` 376-420, `initSchema` 25-75, `EDGE_TYPES` line 25),
  `lib/core/room-db.cjs` (all 162 lines), `lib/core/navigation/spine-events.cjs` (340-455),
  `lib/core/graph-ops.cjs` (75-93), `lib/core/graph-derivation.cjs` (250-262),
  `lib/mcp/tool-router.cjs` (885-930), `lib/core/graph-backfill.cjs` (341-421, 487-559),
  `lib/core/node-insert.cjs`, `lib/core/navigation/edges.cjs`, `lib/core/navigation/graph-export.cjs`,
  all six files in `lib/core/migrations/`, `scripts/check-substrate.cjs`, `package.json`,
  `data/connector-registry.json`, `.github/workflows/agentshield-scan.yml`.
- **nodejs.org official API docs** - https://nodejs.org/docs/latest-v22.x/api/sqlite.html : module added
  v22.5.0; `--experimental-sqlite` removed v22.13.0; still experimental; `timeout` **Added in v22.16.0**,
  number, **Default 0**; `enableForeignKeyConstraints` default `true`; `readOnly` exists;
  `sqlite.constants` exports only `SQLITE_CHANGESET_*`; `database.open()` semantics.
- **nodejs/node `main` doc source** - https://raw.githubusercontent.com/nodejs/node/main/doc/api/sqlite.md :
  YAML `changes` block confirming v22.13.0 / v23.4.0 unflagging (PR 55890) and the v25.7.0 / v24.15.0
  promotion to Stability 1.2 release candidate (PR 61262); `timeout` **Default: 0**.
- **sqlite.org** - https://www.sqlite.org/c3ref/busy_handler.html : verbatim deadlock-avoidance passage
  explaining why the busy handler is skipped on a lock upgrade.
- **`.planning/debug/graph-rebuild-truncates-memory-journal.md`** - the routed-in RCA (12 claims plus a
  transaction/concurrency analysis, verified against sha `c683a4b8`). Every claim I re-checked against
  current `main` held.
- **Context7 `/websites/nodejs_latest-v22_x_api`** - the orchestrator's own leg, preserved: `timeout`
  default 0, no native `.transaction()` helper, module unflagged at v22.13.0.

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` Phase 233-03 entry - the documented live near-miss corroborating that this defect
  class has already fired once.
- `.planning/ROADMAP.md` (Phase 236 and 242 sections, Cross-Cutting Research Rules) and
  `.planning/REQUIREMENTS.md` (GRAPHDB-01/02/03 plus the traceability table).

### Tertiary (LOW confidence)

- None. Nothing here rests on an unverified web search. The two soft spots are both in the Assumptions
  Log with a named, cheap way to settle each.
</sources>

<metadata>
## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| GRAPHDB-01 root cause + fix shape | **HIGH** | RCA re-verified against current `main`; allowlist derived from a verbatim source read rather than inference; destruction and preservation both reproduced live in one session. |
| GRAPHDB-01 criterion reconciliation | **HIGH** | Crash-vs-completion contrast measured directly, both directions, same fixture. |
| Criterion 2 (WAL visibility) | **HIGH** | 1,239 samples, two processes, zero errors, on the exact Node/SQLite combination the criterion names - observed, not asserted from docs. |
| GRAPHDB-02 collapse + error taxonomy | **HIGH** | Reproduced end to end through the real chokepoint; all four error classes probed and tabulated. This upgrades the interim fallback's LOW-confidence open question to a measured table. |
| GRAPHDB-02 recommended fix shape | **MEDIUM-HIGH** | The additive-sibling-door pattern is proven twice in this exact file (Phases 211-02 and 232.1), but the typed result's precise field names remain a design choice. |
| GRAPHDB-03 version floor | **HIGH** | Two official sources agree on v22.16.0; the silent-no-op consequence verified live via `PRAGMA busy_timeout` readback. Corrects the interim fallback's `>=22.13.0`. |
| Legacy-FK risk (A1) | **MEDIUM** | The schema comment is explicit that old dbs keep their prior schema, but real aged rooms could not be enumerated from this worktree. Named as an assumption with a one-command way to settle it. |
| Test design | **MEDIUM-HIGH** | Every test shape was rehearsed as a working probe this session, so the shapes are known to run. Their permanent form still has to be written. |

**Research date:** 2026-07-28
**Valid until:** 2026-08-27 (30 days). The `node:sqlite` findings are version-pinned and stable; source
line numbers drift with any edit to `lazygraph-ops.cjs`, `room-db.cjs`, or `spine-events.cjs`, so
re-confirm them at execution time rather than trusting them blind.
</metadata>

---

*Phase: 236-room-db-data-loss-fixes*
*Research completed: 2026-07-28*
*Ready for planning: yes*
