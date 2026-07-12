# Phase 218: Eureka Entity Extraction - Research

**Researched:** 2026-07-12
**Domain:** Tier-1 named-entity extraction from markdown prose into room.db (node:sqlite), through the navigation.cjs chokepoint
**Confidence:** HIGH (every claim below is grounded in a live source read or a live query on this machine; zero training-data-only claims)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Entity taxonomy):** Ship exactly three node types this phase: `company`, `technology`, `market`. No `person`/`funding_round`/`regulation`/`product`. Frozen-Set pattern in `lib/core/navigation/typed-domain.cjs` makes adding more types a trivial additive edit later.
- **D-02 (Edge vocabulary):** Add exactly three new edge types to `ALLOWED_EDGE_TYPES`: `COMPETES_WITH`, `USES_COMPONENT`, `SUPPLIES_TO`. Additive only, after line ~632 in `edges.cjs`, one comment block citing this phase (Phase 200-02 idiom). Test precedent: `tests/test-200-02-rs-edge-vocab.cjs` (floor-test style: assert named membership + prior-floor survival, never assert `.size`).
- **D-03 (Invocation surface):** Standalone dispatcher script `scripts/entity-extract.cjs ROOM_DIR start/status/report`, cloning `eureka-command.cjs`'s detached-spawn + status.json shape exactly. No new `/mos:` command or subcommand. Zero Canon Part 11 CIRS governance overhead. Rejected: a hidden `/mos:eureka extract` subcommand. Deferred (not rejected): an automatic freshness-gated pre-step inside `/mos:eureka run`.
- **D-04 (Test room):** Use `aion-eureka-synergy` for Requirement 5's before/after numeric comparison. No dedicated synthetic fixture this phase. It is a directional regression proof (structural-vs-structural top-25 pair share drops below 50% from a measured 100%), not a precision/recall claim.
- **D-05 (SQLite write safety):** `openRoomDb()` passes `{ timeout: 5000, ...existing opts }` to the `DatabaseSync` constructor (not a separate `PRAGMA busy_timeout` exec) plus `db.exec('PRAGMA synchronous=NORMAL')` (no constructor equivalent). Extraction batch writes wrapped in ONE explicit `BEGIN`/`COMMIT`/`ROLLBACK`. Verified live on Node v22.22.2: default (no timeout) fails in 0ms under write contention; `{ timeout: 2000 }` waits ~2009ms. The 5000ms value is a ceiling (SQLite uses exponential backoff with jitter), not a promise; actual contention resolves in ms since WAL readers never block writers (writer-vs-writer only).

### Claude's Discretion
- Exact regex/heading-heuristic rules for tier-1 extraction (capitalization patterns, code-span backtick handling, heading-context propagation) - fit to real artifact prose in `aion-eureka-synergy`.
- Exact `entity-extract.cjs` file layout and internal module boundaries - follow existing `lib/core/eureka/*.cjs` conventions; pattern-mapper confirms the home.
- MISC-label-style disambiguation heuristics are NOT this phase's concern (tier-2 territory) - do not build entity-type disambiguation beyond simple capitalization/heading-context rules.

### Deferred Ideas (OUT OF SCOPE)
- Tier-2 NER (ONNX models) / tier-3 relation extraction (GLiREL) - tier-1 must be verified first.
- Auto pre-step inside `/mos:eureka run` with a freshness gate.
- Rewiring `/mos:find-connections` / `/mos:find-analogies` onto room.db (separate follow-on).
- Multi-room portfolio entity resolution/dedup (Phase 215 territory).
- Fleet-wide backfill of all existing rooms.
- SEED-037's fix (dead-API-account bug in `graph-candidate-producer.cjs`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-1 | Domain-entity node extraction (>=1 non-scaffold typed node per naming artifact, `review_status='proposed'`, edge back to its `memory_artifact`) | The exact template exists: `lib/core/navigation/typed-domain.cjs::writeDomainNode`. Mirror it verbatim as a new `typed-entity.cjs`. Node write lands `review_status='proposed'` automatically via the column DEFAULT (`node-insert.cjs::insertNode`). Live schema confirmed below. |
| REQ-2 | Domain-typed relationship edges added additively, writable only through `writeEdge()` | `ALLOWED_EDGE_TYPES` is a frozen Set at `edges.cjs:32-633` (37 members, confirmed by live count). Add 3 after line 632. `writeEdge(db, params)` signature + validation confirmed below. Floor-test pattern in `tests/test-200-02-rs-edge-vocab.cjs`. |
| REQ-3 | Reuse existing embedding infra (no second embedding path) | `vector-store.cjs` exports `ensureStore(db, dim, opts)` + `insertVector(db, nodeId, vec)`. The full-corpus re-embed already walks the whole `nodes` table (`tri-modal-index.cjs::indexNodes`), so the next `/mos:eureka run` embeds new entity nodes with zero new call path. See Open Question 1 for the direct-vs-deferred embed decision. |
| REQ-4 | Zero-touch propagation to `whitespace_scan`/`contradiction_check`/`graph_query` | These read the same `{roomDir}/.mindrian/room.db` `nodes`/`edges` tables. Writing through the shared path means they see richer output with zero code change (acceptance = `git diff` shows no change to `insights.cjs`/`graph-ops.cjs`). |
| REQ-5 | Measurable reduction in structural-noise pairing (top-25 structural-vs-structural share < 50%, from 100% baseline) | Live baseline captured below (647 nodes / 92 edges; 38 `memory_artifact` scaffold nodes; the top-25 eureka pairs are 100% `memory_artifact`-vs-`memory_artifact`). Adding typed entity nodes + typed edges gives the ranker non-structural pairs to surface. |
</phase_requirements>

## Summary

This is a low-novelty, high-precedent phase. Every hard part already has a shipped, live-tested analog inside this repo; the work is disciplined cloning, not invention. The single most important finding: **`lib/core/navigation/typed-domain.cjs` is a near-exact structural template for this entire phase.** It is a Phase 163-02 module that mints exactly three typed node types (`domain`/`subdomain`/`focus_area`) from a frozen 3-member Set, routes node writes through the shared `node-insert.cjs::insertNode` chokepoint (which lands `review_status='proposed'` by column DEFAULT), constrains its edge writes to a frozen 3-member subset of `ALLOWED_EDGE_TYPES` via `navigation.writeEdge`, and is re-exported through `navigation.cjs` as `writeDomainNode`. The plan should create `lib/core/navigation/typed-entity.cjs` that mirrors it verbatim: `ENTITY_NODE_TYPES = {company, technology, market}`, `ENTITY_EDGE_SUBSET = {COMPETES_WITH, USES_COMPONENT, SUPPLIES_TO}`, a `writeEntityNode(db, params)` writer, and a `navigation.writeEntityNode` re-export.

The three remaining pieces are equally well-precedented: (1) the standalone dispatcher clones `scripts/eureka-command.cjs`'s `run`/`start`/`status`/`report` switch-case + detached-spawn + `status.json` shape; (2) the tier-1 prose parser clones `lib/core/shallow-doc-parser.cjs`'s regex-heuristic, graceful-degradation, route-through-navigation, zero-egress discipline (it is Phase 115's "shallow file" parser that extracts venture/claim nodes from CV/memo prose - the closest existing "parse markdown into typed nodes" convention); (3) the SQLite write-safety change is a two-line edit to `openRoomDb()` plus a `BEGIN/COMMIT/ROLLBACK` wrapper in the new batch writer, empirically verified on this machine.

There is **no new dependency, no network surface, and no schema migration** - the `nodes`/`edges` tables already carry every column this phase needs (`review_status`, `type`, `source_path`, `created_by`), and the entity node types ride the existing `type TEXT` column with no DDL change.

**Primary recommendation:** Clone `typed-domain.cjs` -> `typed-entity.cjs`; clone `eureka-command.cjs` -> `scripts/entity-extract.cjs`; clone `shallow-doc-parser.cjs`'s parsing discipline for the tier-1 extractor; add 3 edge types to `edges.cjs` after line 632; add `{timeout:5000}` + `synchronous=NORMAL` to `openRoomDb()`. Verify against the live `aion-eureka-synergy` baseline.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read artifact `.md` prose | Filesystem read (Node fs) | - | Same fs-walk that `lazygraph-ops.cjs::rebuildGraph` and eureka's room scanner already do; no new tier. |
| Tier-1 entity/relationship extraction | Pure CJS compute (regex/heuristics) | - | Zero network by construction (Canon Part 8). In-process, synchronous. |
| Node write (`company`/`technology`/`market`) | Database / navigation chokepoint | - | `navigation.writeEntityNode` -> `node-insert.cjs::insertNode` -> room.db. No raw SQL from new code. |
| Edge write (typed relationships + source link) | Database / navigation chokepoint | - | `navigation.writeEdge` only. Frozen `ALLOWED_EDGE_TYPES`. |
| Entity-node embedding | Database / vector-store | - | Reuse `vector-store.cjs::ensureStore`/`insertVector`, or defer to next `indexNodes` full re-embed. |
| Invocation / orchestration | CLI script (detached spawn) | - | `scripts/entity-extract.cjs`, open-work-close-per-invocation (single-writer safe). |

## Standard Stack

### Core (all already vendored / built-in - ZERO new install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:sqlite` `DatabaseSync` | Node >=22.5.0 (live: v22.22.2) | room.db read/write | The only DB driver in this repo; `openRoomDb` wraps it. `[VERIFIED: live query this session]` |
| `node:child_process` `spawn` | built-in | detached background run | `eureka-command.cjs:48` already uses this exact pattern for fire-and-return. |
| `node:fs` / `node:path` | built-in | artifact prose read | House convention; no markdown-parser dependency anywhere in `lib/core`. |
| `sqlite-vec` | >=0.1.9 (pinned) | vector store backend | Already loaded via `vector-store.cjs`'s manual `enableLoadExtension`/`loadExtension` path. Do NOT switch to `sqliteVec.load(db)` (needs Node >=23.5.0; unused here). |
| `@huggingface/transformers` | ^4.2.0 (pinned) | embedding (reused, not new) | Already the eureka embedding backend via `embedding-spine.cjs`. Only touched if you embed directly during extraction. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled regex parser (`shallow-doc-parser` clone) | A markdown-AST library (`remark`, `unified`) | Rejected: adds a dependency for zero benefit; the repo has no markdown-parser dep and every existing prose reader uses `split('\n')` + regex. Canon Part 7 (reuse before build). |
| Cloning `typed-domain.cjs` | A generic `insertNode` call from the extractor directly | Rejected: bypasses the frozen-Set type validation + navigation re-export discipline that every other typed writer follows. The clone IS the pattern. |

**Installation:** None. `npm install` adds nothing this phase.

## Package Legitimacy Audit

Not applicable - this phase installs **zero** external packages. All dependencies are Node built-ins or already-pinned repo dependencies (`sqlite-vec`, `@huggingface/transformers`) that shipped in Phases 211-216. No slopcheck run needed.

## Architecture Patterns

### System Architecture Diagram

```
  scripts/entity-extract.cjs ROOM_DIR start
        |
        | (spawn detached, exit 0 immediately - D-03 fire-and-return)
        v
  scripts/entity-extract.cjs ROOM_DIR run  (background child)
        |
        |-- fs walk artifact .md files under ROOM_DIR ---------+
        |                                                       |
        v                                                       v
  tier-1 extractor (pure CJS, regex/heading/caps)       write status.json
        |  (zero network - Canon Part 8)                  (started/running/done)
        |
        |  { company|technology|market entities, COMPETES_WITH|USES_COMPONENT|SUPPLIES_TO rels }
        v
  openRoomDb(ROOM_DIR, {allowExtension:true, timeout:5000})   <-- D-05 write safety
        |
        |  BEGIN                                        <-- D-05 one explicit txn
        |    navigation.writeEntityNode(db, {...})      --> node-insert.insertNode --> INSERT INTO nodes
        |      (type in ENTITY_NODE_TYPES,                   (review_status='proposed' by DEFAULT)
        |       review_status='proposed')
        |    navigation.writeEdge(db, {                 --> INSERT INTO edges
        |       edge_type: DESCRIBES|COMPETES_WITH|...      (validated vs ALLOWED_EDGE_TYPES)
        |       source: entityId, target: artifactId })
        |    [optional] vector-store.insertVector(db, entityId, vec)  <-- REQ-3 (or defer)
        |  COMMIT (ROLLBACK on error)
        v
  room.db nodes/edges  <---- read unchanged by whitespace_scan, contradiction_check,
                             graph_query, /mos:eureka (REQ-4 zero-touch propagation)
```

### Pattern 1: The typed-writer clone (THE central pattern)
**What:** A frozen-Set node-type validator + a defensive `writeXNode(db, params)` that mints via `node-insert.cjs::insertNode` and links via `navigation.writeEdge`, re-exported through `navigation.cjs`.
**When to use:** Every new typed node family. This phase's `writeEntityNode`.
**Example (verbatim shape from `lib/core/navigation/typed-domain.cjs:55-137`):**
```javascript
// Source: lib/core/navigation/typed-domain.cjs (live read this session)
const { insertNode } = require('../node-insert.cjs');
const { writeEdge } = require('./edges.cjs');

const DOMAIN_NODE_TYPES = Object.freeze(new Set([
  'domain', 'subdomain', 'focus_area',            // -> ENTITY: 'company','technology','market'
]));
const DOMAIN_EDGE_SUBSET = Object.freeze(new Set([
  'DECOMPOSED_INTO', 'PART_OF', 'TAGGED_WITH', 'RELATED_TO',  // -> ENTITY edge subset
]));

function writeDomainNode(db, params) {
  if (!isPlainObject(params)) return { ok: false, reason: 'invalid_params' };
  const { domainType, name, sessionId, parentId, evidenceTier } = params;
  if (typeof domainType !== 'string' || !DOMAIN_NODE_TYPES.has(domainType)) {
    return { ok: false, reason: 'invalid_domain_type', detail: String(domainType).slice(0, 40) };
  }
  if (typeof name !== 'string' || name.length === 0) return { ok: false, reason: 'invalid_name' };
  const props = { name, domainType, parentId: parentId || '', evidenceTier: evidenceTier || 'None' };
  const nodeId = DOMAIN_NODE_ID(sessionId, name);           // stable 31-multiplier hash -> UPSERT, not dup
  const sourcePath = 'domain:' + sessionId + ':' + name;
  try {
    insertNode(db, nodeId, domainType, JSON.stringify(props), {
      source_path: sourcePath, created_by: 'system',        // lands review_status DEFAULT 'proposed'
    });
  } catch (e) { return { ok: false, reason: 'domain_write_failed', detail: String(e.message).slice(0, 80) }; }
  // ... (linkDomainToRelated routes each rel through writeEdge, rejecting anything outside the subset)
}
```
**Key difference for entity:** Entity nodes are pure truth-claims (`review_status='proposed'`), so **omit** the `taxonomy===true` -> `'confirmed'` promotion branch entirely (D-domain has a taxonomy carve-out; entities never do). Every entity node stays `'proposed'` per REQ-1 + the CONTEXT HITL constraint.

### Pattern 2: The dispatcher clone (`eureka-command.cjs` shape)
**What:** `process.argv` switch-case router with `run`/`start`/`status`/`report` verbs; `start` spawns `run` detached and exits 0; both maintain a `status.json` under `<ROOM_DIR>/.mindrian/<subdir>/`.
**Example (from `scripts/eureka-command.cjs:115-244`):**
```javascript
// Source: scripts/eureka-command.cjs (live read this session)
const { spawn } = require('node:child_process');
function statusPath(roomDir) { return path.join(roomDir, '.mindrian', 'eureka', 'status.json'); }
// 'start': fire-and-return
const child = spawn(process.execPath, [__filename, roomDir, 'run'].concat(forwarded), {
  detached: true, stdio: 'ignore',
});
child.unref();
process.stdout.write('scan started (background)\n');
```
Choose a distinct subdir (e.g. `<ROOM_DIR>/.mindrian/entity-extract/`) so the two pipelines' status files never collide.

### Pattern 3: The tier-1 prose parser (`shallow-doc-parser.cjs` discipline)
**What:** Regex heuristics over `text.split('\n')`, graceful degradation (return empty on parse failure, NEVER throw), route ALL writes through `navigation.cjs`, zero Brain/network egress.
**Where:** `lib/core/shallow-doc-parser.cjs` (Phase 115-02) - `parseVentureHint`, `parseClaims`, `nodeIdFor`, `stripPii`. This is the single closest existing "parse markdown prose into typed graph nodes" convention. The extractor is Claude's discretion on the exact regexes, but it MUST inherit these four disciplines.

### Anti-Patterns to Avoid
- **Raw `INSERT INTO nodes`/`INSERT INTO edges` from `entity-extract.cjs` or the extractor:** forbidden by Canon Part 7/9. Route through `navigation.writeEntityNode` / `navigation.writeEdge` only. Acceptance criterion greps for this.
- **A persistent long-lived DB writer / daemon:** `DatabaseSync` has no multi-process write safety. Open-work-close within one invocation (the `eureka-command.cjs` shape).
- **Per-row autocommit for the batch:** wrap the whole node+edge batch in ONE `BEGIN`/`COMMIT`/`ROLLBACK` (D-05).
- **Adding a `.size` assertion to the edge-vocab test:** the floor test asserts named membership + prior-floor survival only, so additive growth can never regress it (`test-200-02` idiom).
- **A taxonomy/`confirmed` shortcut for entity nodes:** entities are truth-claims; they stay `'proposed'`.
- **Switching to `sqliteVec.load(db)`:** needs Node >=23.5.0; the manual `enableLoadExtension`/`loadExtension` path is proven on the pinned floor. Do not "fix" this non-problem.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Insert a typed node with correct provenance columns | A raw `INSERT INTO nodes (...)` | `node-insert.cjs::insertNode(db, id, type, props, {source_path, created_by})` | Handles both migrated (16-col) and legacy (3-col) schemas; lands `review_status='proposed'` by DEFAULT; UPSERTs on `id` conflict. |
| Validate + write an edge | A raw `INSERT INTO edges` | `navigation.writeEdge(db, {source_id, target_id, edge_type, properties})` | Validates against frozen `ALLOWED_EDGE_TYPES`; UPSERTs on `(source,target,type)`; defensive, never throws. |
| Frozen node-type family + edge subset | An ad-hoc `if (type === ...)` | Clone `typed-domain.cjs`'s `Object.freeze(new Set([...]))` + subset-constrained `writeEdge` | The established, reviewed chokepoint idiom (typed-claim, typed-domain, memory-artifacts all follow it). |
| Detached background run + status polling | Custom process management | Clone `eureka-command.cjs`'s `spawn(...,{detached:true}); child.unref()` + `status.json` | Fire-and-return is the shipped D-05/216 convention; single-writer-safe by construction. |
| Stable idempotent node id | A random/timestamp id | `typed-domain.cjs`'s 31-multiplier hash minter (`X_NODE_ID(sessionId, name)`) | Re-runs UPSERT instead of duplicating; crypto-free, dependency-free. |
| Embed the new entity nodes | A second embedding call path/model | `vector-store.cjs::ensureStore`+`insertVector`, or let the next `tri-modal-index.indexNodes` full re-embed pick them up | REQ-3 forbids a second path; signatures must be unchanged (`git diff`). |

**Key insight:** This phase writes almost no genuinely new logic - it wires three existing chokepoints (`insertNode`, `writeEdge`, `vector-store`) behind one new frozen-Set validator and one new dispatcher, both cloned from live siblings.

## Concrete file:line reference sheet (for the planner)

### `openRoomDb()` - the D-05 write-safety edit site
`lib/core/room-db.cjs:98-128`. Current construction (lines 106-110):
```javascript
const db = (opts && opts.allowExtension === true)
  ? new DatabaseSync(dbPath, { allowExtension: true })
  : new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
```
D-05 target: fold `timeout: 5000` into the `DatabaseSync` options object on BOTH branches (so the extension and non-extension callers both get it), and add `db.exec('PRAGMA synchronous = NORMAL')` after the FK pragma. Note the two-branch construction: the options object currently only carries `allowExtension` on one branch, so the edit must add `{ timeout: 5000 }` to the bare branch too (or unify both branches to always pass an options object). This is a **global** change to every `openRoomDb` caller in the repo - verify no existing test asserts on the exact 0ms-fail behavior (none found this session, but the planner should re-grep).

### `writeEdge()` - the edge chokepoint signature
`lib/core/navigation/edges.cjs:650-681`. Signature: `writeEdge(db, { source_id, target_id, edge_type, properties })`. Returns `{ ok:true, edge_id, type, source, target }` or `{ ok:false, reason, detail? }`. Validates `edge_type` via `ALLOWED_EDGE_TYPES.has(edge_type)` (line 661). Inserts `INSERT INTO edges (source, target, type, properties) VALUES (?,?,?,?) ON CONFLICT(source,target,type) DO UPDATE SET properties = excluded.properties` (lines 674-676). Re-exported at `navigation.cjs:143` as `writeEdge`.

### `ALLOWED_EDGE_TYPES` - the D-02 additive edit site
`lib/core/navigation/edges.cjs:32` (open) to `633` (close `]))`). **37 members** (live-counted this session): `DEFERRED, REJECTED, DERIVED_FROM, FILED_AS_DECISION, FOLLOWS_FROM, OPERATOR_TRANSITION, INFORMS, REJECTED_BECAUSE, CONTRADICTS, SUPERSEDES, AFFILIATED_WITH, PIVOTED, SELECTED_REACH, FEEDS_INTO, VALIDATES, STATES, SUPPORTS, DESCRIBES, REFINES, ROOT_CAUSES, INSTANTIATES, DECOMPOSED_INTO, PART_OF, TAGGED_WITH, RELATED_TO, CONVERGES, INVALIDATES, ENABLES, NESTED_WITHIN, SHARES_JOB, ELEVATES_TO, UMBILICAL_TO, DISCOVERED, AUTHORED_BY, REMEMBERED_AS, ATTRIBUTED_TO, NOT_REMEMBERED_BECAUSE`. Add the 3 new types after line 632 (before the closing `]))` at 633) with a Phase 218 comment block modeled on the Phase 200-02 block at lines 541-632. Post-phase count = 40 (satisfies REQ-2's ">=40 entries").

### `review_status='proposed'` handling
Two live references:
- **The DEFAULT (how a proposed node is born):** `lib/core/migrations/phase-109-nodes-provenance.cjs:299-300` - `review_status TEXT NOT NULL DEFAULT 'proposed' CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated'))`. `node-insert.cjs::insertNode` (line 100-112) deliberately omits `review_status` from its INSERT column list so the DEFAULT applies - this is exactly why `writeEntityNode` gets `'proposed'` for free.
- **The propose-then-confirm discipline (the pattern to honor):** `lib/core/graph-derivation.cjs:210-263` - writes the PROPOSED truth-claim node via `navigation.writeClaimNode`, probes `SELECT review_status FROM nodes WHERE id=?` first (idempotence guard GDH-07), and NEVER downgrades a `'confirmed'` node (the `ON CONFLICT DO UPDATE` clause EXCLUDES `review_status`). `typed-claim.cjs:135-148` shows the same: `VALUES (?, 'claim', ?, ?, 'system', 1.0, 'proposed', ?, ?) ON CONFLICT(id) DO UPDATE SET properties=..., last_seen_at=...` - `review_status` deliberately absent from the UPDATE set. `writeEntityNode` inherits this no-downgrade guarantee automatically because `insertNode`'s UPSERT also excludes `review_status`.

### The typed-writer template
`lib/core/navigation/typed-domain.cjs` (whole file, ~245 lines). Node types: `55-58`. Edge subset: `63-65`. Id minter: `75-83`. Writer: `98-159`. Exports: `240`. Re-exported at `navigation.cjs:252` as `writeDomainNode`.

### The dispatcher template
`scripts/eureka-command.cjs` (whole file). Verb router: `115-244`. Detached spawn: `237-244`. status.json helpers: `56-84`.

### The prose-parser discipline template
`lib/core/shallow-doc-parser.cjs` (Phase 115-02). `parseVentureHint:90`, `parseClaims:113`, `nodeIdFor:131`, `safeRecord:142`, `stripPii:267`.

## Live baseline (aion-eureka-synergy, captured this session)

```
nodes: 647   edges: 92
node types:  memory_event 515 | claim 83 | memory_artifact 38 | governing_thought 10 | navigator_persona 1
edge types:  INFORMS 75 | STATES 10 | INSTANTIATES 3 | SUPPORTS 3 | DESCRIBES 1
review_status: confirmed 564 | proposed 83
nodes columns (16, migrated schema): id, type, properties, source_path, created_by, confidence,
  review_status, created_at, last_seen_at, source_section, confirmed_by, confirmed_at,
  valid_from, valid_to, invalidated_at, last_modified_at
edges columns: source, target, type, properties  (PRIMARY KEY (source, target, type))
```
Note: **zero** `company`/`technology`/`market` nodes exist today (confirming the gap). The 38 `memory_artifact` nodes are the one-per-section scaffold nodes; the top-25 eureka pairs are 100% `memory_artifact`-vs-`memory_artifact` (Requirement 5's 100% denominator). The room grew from the CONTEXT's "646 nodes" to 647 (a memory_event was added by this session's activity) - the planner should re-capture the exact top-25 baseline immediately before extraction, not rely on the frozen 646/92 numbers.

## Exact current schema (for correct INSERT statements)

**`nodes`** (post-migration, the live shape - migrated by phase-109 then phase-160):
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PRIMARY KEY | stable hash id (UPSERT key) |
| `type` | TEXT NOT NULL | `company`/`technology`/`market` ride here - NO DDL change |
| `properties` | TEXT DEFAULT '{}' | JSON blob; additive keys only (name, entityType, sourceArtifact, etc.) |
| `source_path` | TEXT NOT NULL | e.g. `entity:<sid>:<name>` |
| `created_by` | TEXT NOT NULL | CHECK IN ('user','larry','import','brain','system') - use `'system'` |
| `confidence` | REAL | nullable |
| `review_status` | TEXT NOT NULL DEFAULT 'proposed' | CHECK IN (8 values); leave to DEFAULT |
| `created_at` | INTEGER NOT NULL | epoch ms; `insertNode` stamps it |
| `last_seen_at` | INTEGER NOT NULL | epoch ms; `insertNode` stamps it |
| `source_section` | TEXT | nullable |
| `confirmed_by` | TEXT | nullable (human gate) |
| `confirmed_at` | INTEGER | nullable |
| `valid_from` | INTEGER | phase-160 bitemporal; nullable |
| `valid_to` | INTEGER | nullable |
| `invalidated_at` | INTEGER | nullable |
| `last_modified_at` | INTEGER | nullable |

Base (fresh-db) definition is `lib/core/lazygraph-ops.cjs:34-38` (3-col: id/type/properties); the migrations widen it. `node-insert.cjs::insertNode` handles BOTH shapes via `isMigratedSchema(conn)` (line 100) - so the writer never hard-codes the 16-col insert. **Do not write raw INSERTs; call `insertNode`.**

**`edges`** (`lib/core/lazygraph-ops.cjs:51-57`): `source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT '{}', PRIMARY KEY (source, target, type)`. No FK to `nodes(id)` (removed in Phase 169 D-169-11), so an entity->artifact edge is accepted even if endpoint ordering differs. Indices: `idx_edges_source`, `idx_edges_target`, `idx_edges_type`, `idx_edges_source_type`, `idx_edges_target_type`.

## Common Pitfalls

### Pitfall 1: Entity node not embedded on the run that extracts it
**What goes wrong:** REQ-3 acceptance wants entity nodes in the next `/mos:eureka run`'s `graph_nodes` provenance. If extraction only writes nodes and never triggers embedding, the entity nodes are un-embedded until a full re-index.
**Why it happens:** `vector-store.insertVector` needs a vector; the encoder lives in `embedding-spine.cjs`/`tri-modal-index.cjs`. Extraction could skip it.
**How to avoid:** Two valid routes (Open Question 1): (a) call `tri-modal-index.indexNodes(db)` at the end of extraction (it full-corpus re-embeds the whole `nodes` table in one batch, picking up new entity nodes) - simplest, reuses the exact path eureka uses; or (b) embed inline via `ensureStore`+`insertVector`, needing an encoder handle. Route (a) is lower-risk and keeps `vector-store` signatures untouched. Either satisfies "signatures unchanged".
**Warning signs:** `graph_nodes` count in the post-extraction eureka provenance unchanged.

### Pitfall 2: `openRoomDb` timeout added to only one construction branch
**What goes wrong:** `openRoomDb` has two `new DatabaseSync(...)` branches (extension vs bare, `room-db.cjs:106-108`). Adding `{timeout:5000}` to only the `allowExtension` branch leaves every other caller unprotected.
**How to avoid:** Add `timeout:5000` to both, or refactor to always build one options object then pass it. Acceptance criterion checks `busy_timeout=5000` is set - verify via `PRAGMA busy_timeout` after open in the test.

### Pitfall 3: `DatabaseSync` has no `.transaction()` helper
**What goes wrong:** Copying a `better-sqlite3` pattern (`db.transaction(fn)`) fails - `node:sqlite` doesn't have it.
**How to avoid:** Explicit `db.exec('BEGIN'); ...; db.exec('COMMIT')` with `try/catch` -> `db.exec('ROLLBACK')`. This is the D-05 requirement verbatim.

### Pitfall 4: Over-extraction noise re-introducing the problem
**What goes wrong:** A greedy capitalization regex tags every Title-Case token (headings, sentence starts, "The", "This") as a company, flooding the graph with junk entity nodes - re-creating the noise this phase exists to remove.
**How to avoid:** This is why D-01 caps at 3 well-signaled types and D-04 verifies directionally on real prose. Strip code spans (backtick), skip heading-only tokens unless they recur in body prose, use heading context to type (a "## Competitors" section's capitalized tokens lean `company`). Tune against `aion-eureka-synergy`'s actual artifacts (Claude's discretion). The `shallow-doc-parser.cjs::stripPii` + bounded `parseClaims(max)` discipline (cap the count) is the precedent for keeping output bounded.

### Pitfall 5: Status-file collision with eureka
**What goes wrong:** Writing `status.json` under `.mindrian/eureka/` clobbers the eureka pipeline's own status.
**How to avoid:** Use a distinct subdir, e.g. `.mindrian/entity-extract/status.json`.

## Runtime State Inventory

Not a rename/refactor/migration phase - this is additive net-new. **None** - no stored data renamed, no live-service config, no OS-registered state, no secrets/env vars, no build artifacts affected. The `openRoomDb` change is additive (new pragma + option) and idempotent; it does not migrate or rename any existing data. Verified: the `nodes`/`edges` schema is unchanged (entity types ride the existing `type` column; no ALTER TABLE).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | Yes | v22.22.2 (floor >=22.5.0) | - |
| `node:sqlite` DatabaseSync | room.db | Yes | built-in (experimental, live) | - |
| `sqlite-vec` extension | embedding (REQ-3) | Yes | pinned >=0.1.9, loaded live this session | cjs-fallback backend (already handled by `ensureStore`) |
| `@huggingface/transformers` | embedding (REQ-3) | Yes | ^4.2.0 pinned | offline/lexical-only degrade (already handled by `indexNodes`) |
| aion-eureka-synergy room + room.db | REQ-5 verification | Yes | `~/MindrianRooms/aion-eureka-synergy/.mindrian/room.db` confirmed present | a smaller fixture room (SPEC allows) |
| Network | NOTHING (Canon Part 8) | N/A | tier-1 makes zero network calls by construction | - |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none blocking.

## Validation Architecture

> nyquist_validation is `true` (`.planning/config.json` -> `workflow.nyquist_validation: true`, live-read this session).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain-node assertion scripts (`node tests/test-*.cjs`, hand-rolled `check()`/`ok()` PASS/FAIL counters, `node:assert/strict`) + bash aggregators (`tests/run-all-<phase>.sh`). NO jest/vitest (house convention across all 21x phases). |
| Config file | none - convention-based (`tests/run-all-<N>.sh`) |
| Quick run command | `node tests/test-218-entity-writer.cjs` (Wave 0) |
| Full suite command | `bash tests/run-all-218.sh` (Wave 0) plus regression `bash tests/run-all-211.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-1 | `writeEntityNode` rejects invalid type, mints a `company`/`technology`/`market` node at `review_status='proposed'`, links to its artifact | unit (in-memory DatabaseSync or fixture room) | `node tests/test-218-entity-writer.cjs` | Wave 0 |
| REQ-2 | 3 new edge types present, prior 37-member floor survives, non-member still rejected, Set still frozen | unit (floor test) | `node tests/test-218-edge-vocab.cjs` | Wave 0 |
| REQ-2 | `writeEdge()` accepts each new type and rejects an arbitrary unlisted type | unit | (leg in edge-vocab test) | Wave 0 |
| REQ-2 | no raw `INSERT INTO edges`/`nodes` outside the chokepoints in new code | grep gate | `! grep -rnE "INSERT INTO (nodes\|edges)" scripts/entity-extract.cjs lib/core/<extractor>.cjs` | Wave 0 |
| REQ-3 | entity nodes embedded via existing store; `vector-store.cjs` signatures unchanged | unit + `git diff` | `git diff --exit-code lib/core/eureka/vector-store.cjs` (in the aggregator) | Wave 0 |
| REQ-4 | zero code change to `insights.cjs`/`graph-ops.cjs`; before/after `whitespace_scan`+`contradiction_check` differ | integration + `git diff` gate | `git diff --exit-code lib/core/navigation/insights.cjs lib/core/graph-ops.cjs` | Wave 0 |
| REQ-5 | post-extraction top-25 structural-vs-structural share < 50% (from 100%) | integration (against aion-eureka-synergy, before/after logged to a verification artifact) | `node tests/test-218-noise-reduction.cjs` (or a manual-verify leg logged in VERIFICATION) | Wave 0 |
| D-05 | `openRoomDb` sets `busy_timeout=5000`+`synchronous=NORMAL`; batch in one BEGIN/COMMIT/ROLLBACK | unit (`PRAGMA busy_timeout`/`synchronous` post-open; rollback-on-error) | `node tests/test-218-write-safety.cjs` | Wave 0 |
| Part 8 | zero network calls in the tier-1 path | grep gate | `! grep -rnE "fetch\|http[s]?\.|require\('node:http" <extractor files>` | Wave 0 |
| regression | 211-216 engine unregressed | regression | `bash tests/run-all-211.sh && bash tests/run-all-216.sh` | exists |

### Sampling Rate
- **Per task commit:** the touched offline `node tests/test-218-*.cjs` (<5s, no model/network).
- **Per wave merge:** `bash tests/run-all-218.sh` + `bash tests/run-all-211.sh` (no-regression on the substrate this composes with) + `node scripts/build-connector-registry.cjs --check` (D-03 adds no command, so this must stay clean - proves no surface leaked).
- **Phase gate:** full `run-all-218` green + `node scripts/doctor.cjs --acceptance` + no-em-dash sweep + the REQ-5 before/after numbers logged in the phase's VERIFICATION artifact.

### Wave 0 Gaps
- [ ] `tests/test-218-entity-writer.cjs` - covers REQ-1 (mirror `typed-domain` test style; assert `review_status='proposed'`, invalid-type rejection, artifact link edge).
- [ ] `tests/test-218-edge-vocab.cjs` - covers REQ-2 (clone `tests/test-200-02-rs-edge-vocab.cjs` floor-test verbatim; assert the 3 new members + prior-floor survival + frozen + non-member-rejected; NEVER `.size`).
- [ ] `tests/test-218-write-safety.cjs` - covers D-05 (`PRAGMA busy_timeout`/`synchronous` post-open; BEGIN/COMMIT/ROLLBACK-on-error).
- [ ] `tests/test-218-noise-reduction.cjs` - covers REQ-5 (extract on a fixture/aion-eureka-synergy copy, recompute top-25 structural share; may run as a logged manual-verify leg if a full eureka run is too heavy for CI).
- [ ] `tests/run-all-218.sh` - the aggregator (clone `run-all-216.sh` structure; `NODE_OPTIONS`/offline preload if any leg embeds; `run`/`run_if` legs + the `git diff --exit-code` gates for REQ-3/REQ-4).
- [ ] No framework install needed (convention-based node scripts).

## Security Domain

> Canon Part 8 (zero egress) is the governing security standard for this phase - it supersedes generic ASVS network-input categories because the tier-1 path has no network surface by construction.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Frozen-Set validation on both node type (`ENTITY_NODE_TYPES.has`) and edge type (`ALLOWED_EDGE_TYPES.has`); defensive never-throw writers; parameterized SQL only (`db.prepare(...).run(...)`, never string-concatenated SQL). |
| V6 Cryptography | no | No secrets, no crypto beyond the existing `crypto.randomBytes` edge-id salt (unchanged). |
| V2/V3/V4 Auth/Session/Access | no | No auth surface; local-only file writes under the room's `.mindrian/`. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via extracted entity names | Tampering | Parameterized `db.prepare(...).run(...)` only (never interpolate the entity name into SQL text). `insertNode`/`writeEdge` already enforce this. |
| Local data egress to Brain (Canon Part 8 breach) | Information Disclosure | Tier-1 makes zero network calls (grep gate in tests). No Brain call, no `fetch`, no HTTP import in the extractor. |
| Un-vetted node/edge type opening the closed surface | Tampering | Frozen `Object.freeze(new Set(...))` + `.has()` validation; a non-member is rejected (floor test asserts this). |
| Unbounded/junk entity flood (availability of a useful graph) | Denial of Service (of signal) | Bound extraction output per artifact (the `parseClaims(max)` precedent); type only well-signaled capitalized tokens (Pitfall 4). |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | REQ-3 is best satisfied by letting the next `indexNodes` full re-embed pick up entity nodes (route a) rather than inline `insertVector` (route b) | Pitfall 1 / Open Q1 | Low - both routes satisfy the acceptance criterion; this is an efficiency/simplicity preference, not a correctness claim. Planner picks. |
| A2 | No existing test asserts on `openRoomDb`'s current 0ms-fail-under-contention behavior, so adding `timeout:5000` breaks nothing | file:line sheet (openRoomDb) | Low - re-grep before the edit confirms; the change is strictly more forgiving (a longer wait, never a new failure mode). |

**Everything else in this research was verified via live source read or live query this session.** No `[ASSUMED]` package names (zero packages installed). No web research was needed - the phase is entirely intra-repo pattern reuse and the two external research passes (transformers.js ESM/CJS, SQLite busy_timeout) were already filed and empirically verified per CONTEXT/SPEC.

## Open Questions (RESOLVED)

1. **Embed inline during extraction, or defer to the next `indexNodes` full re-embed?**
   - What we know: `vector-store.ensureStore`/`insertVector` are the reuse target (REQ-3); `tri-modal-index.indexNodes(db)` already re-embeds the whole `nodes` table in one batch and is what `/mos:eureka run` calls.
   - What's unclear: whether extraction should call `indexNodes` itself (route a, simplest, zero new signatures touched) or embed each entity inline (route b, needs an encoder handle in the extractor).
   - Recommendation: route (a) - call `tri-modal-index.indexNodes(db)` at the end of a successful extraction batch (after COMMIT), or simply document that entity nodes embed on the next `/mos:eureka run`. Keeps `vector-store` signatures provably unchanged and reuses the exact eureka path. Planner decides; both pass acceptance.
   - **RESOLVED (Plan 218-03, Task 1):** route (a) locked - `entity-extract.cjs` calls `tri-modal-index.indexNodes(db)` after a successful batch COMMIT; no inline per-entity embedding, no new encoder handle in the extractor.

2. **Does `entity-extract.cjs run` re-embed synchronously, or leave embedding to eureka?**
   - What we know: D-03 says fire-and-return; embedding is the slow leg (model load).
   - Recommendation: keep the extraction batch (node+edge writes) as the D-05 transaction; run embedding (if route a) AFTER the COMMIT as a separate best-effort step so a slow/absent encoder never blocks or rolls back the entity writes (matches eureka's "degrade to lexical-only, never throw" contract).
   - **RESOLVED (Plan 218-03, Task 1):** post-commit, best-effort - the `indexNodes` re-embed call runs after the D-05 transaction commits, wrapped so a slow or absent encoder never blocks or rolls back the entity/edge writes already committed.

3. **How to compute the REQ-5 "top-25 structural-vs-structural share" for the before/after log?**
   - What we know: the eureka pair ranking lives in the portfolio report JSON (`portfolio-report.json`); a top-25 pair is structural when both endpoints are `memory_artifact`.
   - Recommendation: capture the pre-extraction share by parsing the existing report JSON (or re-running `/mos:eureka`), extract, re-run, re-parse. Log both numbers in the VERIFICATION artifact. The planner should re-capture the baseline immediately before extraction (the room count drifted 646->647 this session; do not hardcode).
   - **RESOLVED (Plan 218-03, Task 3):** baseline is re-captured live, immediately before extraction runs, in Task 3 Step 1 - never hardcoded from this session's 646/92 measurement, since the room drifts under active use.

## Sources

### Primary (HIGH confidence - live source read / live query, this session, this machine)
- `lib/core/navigation/typed-domain.cjs` (whole) - the central clone template.
- `lib/core/navigation/edges.cjs:32-683` - `ALLOWED_EDGE_TYPES` (37 members) + `writeEdge` signature.
- `lib/core/node-insert.cjs:90-122` - `insertNode` dual-schema chokepoint.
- `lib/core/navigation/typed-claim.cjs:100-149` - proposed-node UPSERT + no-downgrade idiom.
- `lib/core/graph-derivation.cjs:200-289` - propose-then-confirm HITL pattern + idempotence guard.
- `lib/core/room-db.cjs:92-141` - `openRoomDb` construction (D-05 edit site).
- `lib/core/migrations/phase-109-nodes-provenance.cjs:291-330` + `phase-160-nodes-bitemporal.cjs:45-121` + `lib/core/lazygraph-ops.cjs:34-63` - the live `nodes`/`edges` schema.
- `scripts/eureka-command.cjs:48-244` - dispatcher clone template.
- `lib/core/shallow-doc-parser.cjs` (whole) - tier-1 prose-parser discipline template.
- `lib/core/eureka/vector-store.cjs:290-398` + `tri-modal-index.cjs:58,206-235` - embedding reuse path.
- `tests/test-200-02-rs-edge-vocab.cjs` (whole) - floor-test pattern.
- `.planning/phases/{216,214,212}-*/*-RESEARCH.md` - Validation Architecture section format (matched here).
- Live query on `~/MindrianRooms/aion-eureka-synergy/.mindrian/room.db` (Node v22.22.2) - baseline counts + schema.

### Secondary / Tertiary
- None. This phase required no web research; all findings are intra-repo and live-verified. External research (transformers.js, SQLite busy_timeout) was pre-filed in the rethinking-mindrianos room per SPEC/CONTEXT and is out of tier-1's scope.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new packages; all reuse targets live-read.
- Architecture: HIGH - the clone templates (typed-domain, eureka-command, shallow-doc-parser) are shipped, live, and structurally near-identical to what this phase needs.
- Pitfalls: HIGH - each is grounded in a specific file:line or the live schema/baseline.

**Research date:** 2026-07-12
**Valid until:** 2026-08-11 (stable - intra-repo patterns; re-capture the aion-eureka-synergy baseline counts immediately before execution as the room drifts with use).
