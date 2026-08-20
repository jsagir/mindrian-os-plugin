# Phase 258: Reconcile the Wave (hard-gates all writing phases) - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 13 new/modified (12 in `/home/jsagi/dev/ProblemsWorthSolving-Brain`, 0 code files in MindrianOS-Plugin)
**Analogs found:** 12 / 13

**CROSS-REPO WARNING FOR THE PLANNER AND EXECUTOR.** Every file in this map lives in
`/home/jsagi/dev/ProblemsWorthSolving-Brain`, a SEPARATE git repo from MindrianOS-Plugin.
Paths below are relative to that repo root unless prefixed. Only the phase's `.planning/`
artifacts live in MindrianOS-Plugin. Both repos forbid em-dashes (hyphens only).

**Em-dash trap, read this before copying anything.** Several of the analog files quoted below
(`payloads/chunk-document-repair/*.cypher`, its `README.md`, `src/ingest/allowlist.mjs`
comments) contain literal em-dashes in their own headers. Those are pre-existing violations of
both repos' CLAUDE.md rule. **Copy their STRUCTURE, replace every em-dash with a hyphen.**
Do not propagate the character.

---

## File Classification

| New/Modified File (Brain repo) | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `docs/GRAPH-WRITE-LOG.md` | new | doc (standing contract) | append-only ledger | `SCHEMA.md` (header + section 7 ledger table) and `docs/VECTOR-INDEX-DISPOSITIONS.md` (SCREAMING-CASE standing doc) | exact (role+flow) |
| `payloads/order-collision-dishare-2026-08-2X/manifest.json` | new | payload config | batch declaration | `payloads/chunk-document-repair/manifest.json` | exact |
| `payloads/order-collision-dishare-2026-08-2X/README.md` | new | payload doc | prose + evidence tables | `payloads/chunk-document-repair/README.md` | exact |
| `payloads/.../90-dry-run.cypher` | new | payload script | read-only probe | `payloads/chunk-document-repair/90-dry-run.cypher` | exact |
| `payloads/.../01-dishare-24219.cypher`, `02-dishare-gen-innov-opp.cypher` | new | payload script | targeted graph surgery | `payloads/chunk-document-repair/01-tier1-documents-partof.cypher` (file shape) + `docs/2026-08-11-RUNBOOK-249-alias-collapse.md` Step 2 (guard idiom) | exact |
| `payloads/.../03-graphwriteevent.cypher`, `04-graphragmeta-stamp.cypher` | new | payload script | singleton MERGE | `payloads/graphragmeta-stamp-2026-08-19.cypher` | exact |
| `payloads/.../91-verify.cypher` | new | payload script | read-only assertion | `payloads/chunk-document-repair/91-verify.cypher` | exact |
| `payloads/.../99-undo.cypher` | new | payload script | reverse write | `payloads/chunk-document-repair/99-undo.cypher` | exact |
| `tests/graph-write-log-shape.test.mjs` | new | test | fs + git, zero network | `tests/bounded-read-single-seam.test.mjs` (fs-scanning structural invariant) + `tests/schema-contract.test.mjs` (node:test idiom) | role-match |
| `tests/schema-contract.test.mjs` | modified | test | pure assertion | itself (extend in place) | exact |
| `SCHEMA.md` | modified | doc (contract) | amendment | itself, section 1 Tier 3 table + section 7 ledger | exact |
| `src/contracts/schema-contract.mjs` | modified | config (machine contract) | frozen set | itself, `TIER3_LABELS` line 35 | exact |
| `src/ontology.mjs` + `src/ingest/allowlist.mjs` | modified | config (declared ontology) | frozen list, mirrored | each other (they are deliberate mirrors) | exact |
| `scripts/probe-wave-attribution.mjs` | new | script | read-tier Cypher over HTTPS | `scripts/run-schema-census.mjs` (`resolveReadKey`/`call`/`q` helpers) | exact |

---

## Pattern Assignments

### 1. `docs/GRAPH-WRITE-LOG.md` (doc, append-only ledger) - NEW

**Analog A (heading + status-preamble style):** `SCHEMA.md` lines 1-12, verbatim:

```markdown
# SCHEMA.md - the Brain's schema contract

Status: DRAFT v0.1 (2026-08-18). Authored as Phase 1 of the reconcile-in-place unification
program. Once ratified, this file is the constitution: writes conform to it or are refused
by the schema validator (src/contracts/schema-contract.mjs, Phase 1b). The live graph is
reconciled TOWARD this contract wave by wave; the contract is never silently widened to
match the graph.

Principle: the graph is whatever the last machine left behind until a written contract
exists. This is the written contract. Amendments are commits, reviewed like code.

---

## 1. Canonical node labels
```

Note the idiom: `# FILENAME.md - one-line what-this-is`, then a bold-free `Status:` or
`**Filed:**` line naming the phase that authored it, then a `Principle:` paragraph stating
the rule the file exists to enforce, then `---`, then numbered `## N. Topic` sections.

**Analog A' (the alternative preamble form)** from `docs/VECTOR-INDEX-DISPOSITIONS.md` lines 1-3:

```markdown
# Vector Index Dispositions (CONTRACT-04)

**Filed:** 247-01 Task 3, 2026-08-10.
```

Either is idiomatic. `SCHEMA.md`'s form is closer since GRAPH-WRITE-LOG is a standing
convention rather than a one-time filing.

**Analog B (the append-only ledger table this file's rows must look like)** - `SCHEMA.md`
section 7, verbatim head:

```markdown
## 7. Reconciliation status ledger

| Wave | Scope | Status |
|---|---|---|
| 249-03 | JTBD/Scenario/Four Lenses/Mullins alias collapse | EXECUTED 2026-08-11 |
| 2026-08-18 curation | JTBD HAS_STEP re-edge, RS mislabel+aliases, fragment flags | EXECUTED 2026-08-18 |
| Wave 1 | __Entity__ strip (4,357 -> 232 bare) + edge retypes, 9/9 | EXECUTED 2026-08-18 (census after-picture: docs/census-2026-08-18.md) |
```

Table conventions to copy exactly: pipe-delimited, `|---|---|---|` separator with no
alignment colons and no padding, backticked identifiers, parenthetical cross-references to
other tracked file paths inline in the cell. Newest rows are appended at the BOTTOM of
section 7 (chronological), so GRAPH-WRITE-LOG should append at the bottom too and say so in
its preamble.

**The D-02 8-column row shape** (from RESEARCH.md F-8, consistent with the above):

```markdown
| date | phase | requirement | commit_sha | operator | nodes | edges | summary |
|---|---|---|---|---|---|---|---|
| 2026-08-2X | 258 | RECON-02 | `<sha>` | Jonathan Sagir | 4 | 6 | Dis-shared 2 order-collision ProcessStep nodes |
```

---

### 2. `payloads/order-collision-dishare-2026-08-2X/` (payload directory) - NEW

**Analog:** `payloads/chunk-document-repair/` (the most complete of the four live payload
dirs; `payloads/orphan-linking-2026-08-18/` is a leaner variant of the same manifest).

**Directory listing to mirror** (`ls payloads/chunk-document-repair/`):

```
01-tier1-documents-partof.cypher
02-tier1-nextchunk.cypher
03-tier2-title-partof.cypher
90-dry-run.cypher
91-verify.cypher
99-undo.cypher
README.md
SCHEMA-AMENDMENT-PROPOSAL.md
manifest.json
```

Numbering law visible here: `01..NN` = one concern per write file, `90` = read-only dry run,
`91` = read-only verify, `99` = undo. Phase 258 adds `03-graphwriteevent.cypher` and
`04-graphragmeta-stamp.cypher` into the `01..NN` band, and per D-11 the admin-window CLOSE is
the last scripted write item, so it must be a numbered file above them (e.g. `05-close-window`
or documented as the final numbered step), never prose in the README.

#### `manifest.json` - EXACT field structure to copy

Verbatim from `payloads/chunk-document-repair/manifest.json`:

```json
{
  "batch_id": "pws-chunkdoc-2026-08-18",
  "created": "2026-08-18",
  "compile_only": true,
  "review_required": true,
  "schema_gated": {
    "blocked_on": "SCHEMA-AMENDMENT-PROPOSAL.md (Document label, PART_OF + NEXT_CHUNK edges)",
    "if_rejected": "discard entire directory; no partial execution"
  },
  "files": [
    "SCHEMA-AMENDMENT-PROPOSAL.md",
    "90-dry-run.cypher",
    "01-tier1-documents-partof.cypher",
    "02-tier1-nextchunk.cypher",
    "03-tier2-title-partof.cypher",
    "91-verify.cypher",
    "99-undo.cypher"
  ],
  "statement_counts": {
    "90-dry-run.cypher": { "active": 6, "writes": 0 },
    "01-tier1-documents-partof.cypher": { "active": 1 },
    "02-tier1-nextchunk.cypher": { "active": 1 },
    "03-tier2-title-partof.cypher": { "active": 1, "recommendation": "HOLD (near-1:1 wrappers)" },
    "91-verify.cypher": { "active": 6, "writes": 0 },
    "99-undo.cypher": { "active": 2 }
  },
  "edge_vocabulary_used": ["PART_OF", "NEXT_CHUNK"],
  "edge_vocabulary_status": "NOT in SCHEMA.md closed set - proposed via amendment; batch blocked until accepted",
  "evidence_basis": {
    "rehearsal": "...",
    "provenance_census": "...",
    "recompile_required": "90-dry-run.cypher against the live Render graph before review sign-off ..."
  },
  "invariants": {
    "node_creation": "Document ONLY - declared deviation; every created node stamped batch_id + created_by:'payload'",
    "no_detach_delete": true,
    "no_orphan_predicate": "...",
    "every_merged_edge_carries_batch_id": true,
    "idempotent": "MERGE on node keys and edges throughout; re-run adds nothing",
    "undo": "99-undo.cypher - edges by batch_id, then edge-less batch Documents"
  },
  "unresolved_residue": {
    "amnesiac_chunks": 306,
    "detail": "... need human review, never forced",
    "chain_gaps": "..."
  },
  "coordination": {
    "git": "files only, no commits from this session - repo git state owned by the primary session tonight",
    "execution_window": "next admin window (BRAIN_HTTP_ADMIN=allow), Render write endpoint, alongside ..."
  }
}
```

(Em-dashes in the original replaced with hyphens above. `evidence_basis` / `unresolved_residue`
values are truncated with `...` only where the prose is chunk-repair-specific; every KEY shown
is required.)

The leaner `payloads/orphan-linking-2026-08-18/manifest.json` variant drops `compile_only`,
`schema_gated`, `unresolved_residue` and `coordination`, and renames residue to
`unresolved_orphans`. It also shows the inline-undo form:

```json
  "invariants": {
    "no_node_creation": true,
    "no_detach_delete": true,
    "match_only_on_nodes_merge_only_on_edges": true,
    "every_merged_edge_carries_batch_id": true,
    "undo": "MATCH ()-[r {batch_id:'pws-orphanlink-2026-08-18'}]-() DELETE r; plus revert null-only property keys marked merge_batch_id"
  },
```

**Phase 258 delta the planner must encode:** RECON-02 DOES create nodes (dis-sharing means a
per-framework copy), so `invariants.node_creation` takes the chunk-repair form
("`ProcessStep` ONLY - declared deviation ..."), not orphan-linking's `no_node_creation: true`.
`review_required: true` is the machine form of D-08's navigator approval and is non-negotiable.
`compile_only` starts `true` and the README's execution record records the flip.

#### `99-undo.cypher` - EXACT header-comment convention

Verbatim from `payloads/chunk-document-repair/99-undo.cypher` (em-dashes in the original;
reproduce with hyphens):

```cypher
// 99-undo.cypher - batch pws-chunkdoc-2026-08-18
// Full revert. Order matters: edges first, then the (now edge-less) batch
// Documents. No DETACH DELETE - if statement 2 errors on a remaining edge,
// that edge came from a LATER batch attaching to these Documents; stop and
// review rather than forcing the delete.

MATCH ()-[r {batch_id: 'pws-chunkdoc-2026-08-18'}]-() DELETE r;

MATCH (d:Document {batch_id: 'pws-chunkdoc-2026-08-18'}) DELETE d;
```

The convention in four parts: (1) line 1 is `// <filename> - batch <batch_id>`;
(2) a plain-language statement of what the file does; (3) an explicit statement of ORDER and
WHY (edges then nodes); (4) an explicit statement of what to do when it errors, which is
always "stop and review", never "force". Never `DETACH DELETE`.

#### `90-dry-run.cypher` / `91-verify.cypher` - header + numbered-statement convention

```cypher
// 90-dry-run.cypher - batch pws-chunkdoc-2026-08-18
// READ-ONLY recompilation against the LIVE graph (run before review sign-off).
// Rehearsal numbers came from the July replica; these queries regenerate every
// expected count on the canon. No orphan predicate anywhere: chunks are keyed
// purely on metadata content (canon chunks may legitimately carry edges).

// [90.1] Cohort census: how do the live chunks split?
MATCH (n:MethodologyChunk)
RETURN count(n) AS total_chunks,
       ...
```

```cypher
// 91-verify.cypher - batch pws-chunkdoc-2026-08-18
// READ-ONLY post-run verification. Expected values come from the 90-dry-run
// recompile on the canon (NOT the replica rehearsal numbers).

// [91.1] Batch inventory: everything this batch created, by kind.
MATCH (d:Document {batch_id: 'pws-chunkdoc-2026-08-18'})
RETURN count(d) AS batch_documents,
       ...

// [91.2] Batch edges by type.
MATCH ()-[r {batch_id: 'pws-chunkdoc-2026-08-18'}]->()
```

Copy the `// [NN.M] <plain-language question this statement answers>` per-statement labelling
scheme. `91-verify` must carry the RECON-02 done-signal (`parents = 1` on both nodes, RESEARCH
"done-signal assertion") as a numbered statement.

#### `01-*.cypher` write-file header convention

```cypher
// 01-tier1-documents-partof.cypher - batch pws-chunkdoc-2026-08-18
// SCHEMA-GATED: requires SCHEMA-AMENDMENT-PROPOSAL.md accepted (Document label,
// PART_OF edge). Do not execute before the amendment lands in SCHEMA.md.
//
// Creates one Document per distinct metadata source_file and a PART_OF edge
// from every chunk that names it. DECLARED DEVIATION: this batch creates nodes
// (Document only); every created node and every merged edge carries the batch_id.
// Keyed purely on metadata - no orphan predicate (canon chunks are Tier 3,
// vector-connected by design; orphanhood is not the criterion).
// Idempotent: MERGE on both node key and edge; re-running adds nothing.
// Replica rehearsal: 798 Documents, 9,811 PART_OF (dry-run matched to the digit).

MATCH (n:MethodologyChunk)
...
  MERGE (d:Document {source_file: src})
    ON CREATE SET d.batch_id = 'pws-chunkdoc-2026-08-18',
                  d.created_by = 'payload',
```

Six required header elements: filename+batch line, any gate/precondition, what it does in
plain language, DECLARED DEVIATION if it creates nodes, idempotency claim, and the
predicted count with its provenance. Then the statement, with `ON CREATE SET` stamping
`batch_id` + `created_by = 'payload'` on every created node.

#### `README.md` inside the payload dir

**Analog:** `payloads/chunk-document-repair/README.md` lines 1-45. Structure:

```markdown
# Chunk-document repair payload batch: pws-chunkdoc-2026-08-18

COMPILE-ONLY drafts. Nothing here has been executed against the canon, and
nothing here CAN be executed yet: **this batch is SCHEMA-GATED** ...

## Provenance (the rehearsal)

Rehearsed 2026-08-18 against the **local July replica** ...

| Step | Predicted | Written |
|---|---|---|
| Tier 1 Documents (per distinct `source_file`) | 798 | 798 |
| Tier 1 `NEXT_CHUNK` chains | 9,013 | 8,841 (172 chunks lacked parseable `chunk_index`) |

## Doctrine corrections baked into this batch (vs. the rehearsal)

1. **Chunk orphans on the canon are BY DESIGN** (SCHEMA.md section 5 ...) ...
2. **No orphan predicate.** ...
3. **RECOMPILE REQUIRED before the admin window.** ...
```

Note the `| Step | Predicted | Written |` table: predictions and actuals side by side, with
the honest miss annotated inline in the Written cell rather than silently corrected. That IS
the "honest deviation recording" pattern RESEARCH.md Pattern 3 names, and Phase 258's README
must carry both this table and an appended Execution record section.

---

### 3. `tests/graph-write-log-shape.test.mjs` (test, fs + git, zero network) - NEW

**Analog A (the `node:test` idiom used repo-wide):** `tests/schema-contract.test.mjs` lines 1-27:

```javascript
// tests/schema-contract.test.mjs
// =============================================================================
// Phase 1b: hermetic tests for the schema contract validator. Fail-closed
// discipline proven both ways: conforming intents pass, and every violation
// class is REFUSED loudly (the red-proof shape this repo requires of guards).
// No em-dashes.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateNodeIntent,
  validateEdgeIntent,
  validateWriteIntent,
  SchemaViolation,
} from '../src/contracts/schema-contract.mjs';

const NOW = '2026-08-18T08:00:00.000Z';

const goodNode = () => ({
  labels: ['Framework'],
  props: { name: 'Test Framework', created_at: NOW, batch_id: 'b1', created_by: 'test' },
});

test('conforming Tier 1 node intent passes', () => {
  assert.equal(validateNodeIntent(goodNode()), true);
});
```

Idiom facts to copy: flat `test('...', () => {})` (NOT `describe`); `import { test } from
'node:test'`; a banner comment block ending with `// No em-dashes.`; test names prefixed
`RED:` for the negative/violation cases; module-level fixture factories.

**Analog B (the fs-scanning structural-invariant shape, which is exactly what a
GRAPH-WRITE-LOG shape test is):** `tests/bounded-read-single-seam.test.mjs` lines 1-45:

```javascript
// CONTRACT-05 STRUCTURAL INVARIANT: bounded-read has exactly ONE seam.
//
// ... A comment saying "only call this from the seam" is not a control. This source scan is.
// If a second file under src/ starts passing the mode, the moat has been widened somewhere
// nobody reviewed, and that is a FAILING TEST rather than a thing discovered by a later
// audit. This repo's recorded failure mode is work (and holes) that exist but cannot be
// seen; this is the cheapest possible way to make one class of hole visible.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const SEAM = join(SRC, 'http', 'bounded-read.mjs');

test('the bounded-read mode is passed from exactly one file, and it is the seam', () => {
  const callers = FILES.filter((f) => { ... });
  assert.deepEqual(
    callers.map((f) => relative(ROOT, f).replace(/\\/g, '/')),
    ['src/http/bounded-read.mjs'],
```

Copy: `assert from 'node:assert/strict'` for structural tests, the
`fileURLToPath(new URL('..', import.meta.url))` repo-root idiom, `readFileSync(f, 'utf8')`,
`relative(ROOT, f).replace(/\\/g, '/')` for platform-stable path assertions, and the header
comment that states WHY a file-scan is the control rather than a convention.

**Registration:** none needed. `package.json` runs `node --test tests/*.test.mjs`; a new
`tests/*.test.mjs` file is picked up by the glob automatically.

---

### 4. `tests/schema-contract.test.mjs` (test, MODIFIED) - exact insertion point

The file is 98 lines, flat `test()` calls, no describe blocks. The current node-label tests
run lines 25-66 and the file has **no `TIER3_LABELS` membership test at all today** - the
closest existing coverage is the behavioural line 29:

```javascript
test('conforming Tier 3 node without a name passes (chunks are nameless by design)', () => {
  assert.equal(validateNodeIntent({ labels: ['MethodologyChunk'], props: {} }), true);
});
```

**Where the D-03 assertions go:** immediately after that line-29 test, before line 33's
`'Archived may accompany one primary label'`. Two tests, matching existing style (one
positive, one `RED:`), and they require adding `TIER3_LABELS` (and, for the negative, the
`src/ontology.mjs` sets) to the import block at lines 11-16:

```javascript
test('GraphWriteEvent is a Tier 3 label and validates as a nameless platform node', () => {
  assert.ok(TIER3_LABELS.has('GraphWriteEvent'));
  assert.equal(validateNodeIntent({ labels: ['GraphWriteEvent'], props: {} }), true);
});

test('RED: GraphWriteEvent never enters the methodology projection', () => {
  assert.ok(!METHODOLOGY_LABELS.includes('GraphWriteEvent'));
  assert.ok(!SUBSTRATE_LABELS.includes('GraphWriteEvent'));
});
```

(Second test imports from `../src/ontology.mjs`. RESEARCH.md Pitfall 3 is the reason both
halves exist: Tier-3 membership alone does not prove the projection stayed clean.)

---

### 5. The four ontology-gate surfaces (MODIFIED) - EXACT current blocks to change

#### 5a. `src/contracts/schema-contract.mjs`, `TIER3_LABELS` (lines 35-41), current text verbatim:

```javascript
export const TIER3_LABELS = new Set([
  'MethodologyChunk', 'Chunk', 'GraphRagMeta', 'DialConfig', 'DialPhase', 'Reach',
  'Mode', 'ModeTrigger', 'MindrianCommand', 'Command', 'Persona',
  'AssessmentComponent', 'GradeBand', 'WorthinessCriteria', 'PyramidLevel',
  'PedagogicalPattern', 'Room', 'RoomGroup', 'RoomRoot', 'DataRoomSection',
  'Archived',
]);
```

Diff-precise change: insert `'GraphWriteEvent',` on line 36 immediately after
`'GraphRagMeta',` (keeping the platform-singleton neighbours together). Nothing else in this
file changes; `CANONICAL_LABELS` at line 51 already unions the three tiers:

```javascript
export const CANONICAL_LABELS = new Set([
  ...TIER1_LABELS, ...TIER2_LABELS, ...TIER3_LABELS,
]);
```

That union is why this one edit is what stops the next census printing
`UNKNOWN(GraphWriteEvent)` (see `scripts/run-schema-census.mjs` `judgeLabelCombo`, quoted in
section 6 below).

#### 5b. `src/ontology.mjs`, `AGENT_LANE_LABELS` (lines 73-79), current text verbatim:

```javascript
// Populated but NOT curated corpus -- agent/run state. Mirrors AGENT_LANE_LABELS in
// allowlist.mjs; a trailing '*' is a prefix match. Kept here so the declared ontology
// states the full partition rather than only the half it likes.
export const AGENT_LANE_LABELS = [
  'GraphRagMeta', 'Orchestrator*', 'BookExtraction', 'RSD*', 'QuarantinedChunk',
];
```

Diff-precise change: `'GraphRagMeta', 'GraphWriteEvent', 'Orchestrator*', ...`.
**Do NOT touch** the adjacent `SUBSTRATE_LABELS` (lines 70-72) - it currently reads:

```javascript
export const SUBSTRATE_LABELS = [
  'MethodologyChunk', 'Chunk', 'Document', 'Book', 'Person', 'Concept', 'Product',
];
```

Adding `GraphWriteEvent` there is Pitfall 3 (it would enter `ALL_DECLARED_LABELS` and the
MAGE methodology projection).

#### 5c. `src/ingest/allowlist.mjs`, `AGENT_LANE_LABELS` (lines 38-45), current text verbatim
(note the em-dash in the original comment; do not reproduce it):

```javascript
// Agent-owned / run-state lanes. A trailing '*' means prefix-match. These are
// POPULATED labels that are nonetheless NOT curated corpus - they are agent state.
export const AGENT_LANE_LABELS = [
  'GraphRagMeta',
  'Orchestrator*',
  'BookExtraction',
  'RSD*',
  'QuarantinedChunk',
];
```

Diff-precise change: insert `'GraphWriteEvent',` as its own line after `'GraphRagMeta',`.
Note the FORMATTING DIFFERENCE from 5b: this file is one-label-per-line, `ontology.mjs` is
comma-packed. Match each file's own layout; do not normalise them. The mirror is deliberate
(`ontology.mjs` says "Mirrors AGENT_LANE_LABELS in allowlist.mjs") - do not DRY them in this
phase.

#### 5d. `SCHEMA.md` section 1 Tier 3 table (lines 48-57), current text verbatim:

```markdown
### Tier 3 - retrieval and platform (edge-poor BY DESIGN; never counted as orphans)

| Label | Meaning |
|---|---|
| `MethodologyChunk` / `Chunk` | Vector-retrieval units; connected via embedding space, not edges |
| `GraphRagMeta`, `DialConfig`, `DialPhase`, `Reach`, `Mode`, `ModeTrigger` | Platform config singletons |
| `MindrianCommand`, `Command` | Command registry mirrors |
| `Persona`, `AssessmentComponent`, `GradeBand`, `WorthinessCriteria`, `PyramidLevel`, `PedagogicalPattern` | Grading/teaching machinery |
| `Room`, `RoomGroup`, `RoomRoot`, `DataRoomSection` | Room scaffolding handles (generic, Part 8-safe) |
| `Archived` | Tombstone marker label (always secondary) |
```

Diff-precise change: add ONE row after the `GraphRagMeta, DialConfig...` row:

```markdown
| `GraphWriteEvent` | Per-write-session provenance record; carries the GRAPH-WRITE-LOG.md commit SHA |
```

#### 5e. `SCHEMA.md` section 7 ledger (line 170+) - append one row at the bottom of the table,
in the style shown in Pattern Assignment 1, Analog B. Existing rows use
`EXECUTED <date> (<evidence>)` or `QUEUED (<worklist path>)` as the Status value; use one of
those two forms, not a new vocabulary.

Also relevant, `SCHEMA.md` section 6 "Write discipline" (lines 157-168) is the rule this
phase's payload obeys and should be cited by the payload README:

```markdown
1. Every write arrives via a versioned payload/bundle (payloads/ or the
   mindrian-brain-ingestion compiler) with `batch_id` + undo path.
2. Admin window (`BRAIN_HTTP_ADMIN=allow`) opens for the run, closes after.
3. Eval fixtures (tests/fixtures/framework-evals/) guard structural regressions;
   scoped assertions per fixture class.
4. GraphChat / Lab / interactive sessions are READ-ONLY surfaces.
5. Dedup check before any CREATE of a named Tier 1/2 node
   (`toLower(name)` match + ALIAS_OF traversal).
```

---

### 6. `scripts/probe-wave-attribution.mjs` (script, read-tier Cypher over HTTPS) - NEW

**Analog:** `scripts/run-schema-census.mjs`. Reuse its three helpers VERBATIM rather than
minting a second HTTP client (Canon Part 7; the repo's own "Don't Hand-Roll" rule).

**Shebang + banner + import block** (lines 1-42), the exact preamble idiom:

```javascript
#!/usr/bin/env node
'use strict';

/*
 * scripts/run-schema-census.mjs
 * =============================================================================
 * Phase 2 of the reconcile-in-place unification program: the contract census.
 * READ-ONLY. Measures the live graph against SCHEMA.md / schema-contract.mjs
 * and emits the keep/rename/merge/delete worksheet that drives the
 * reconciliation runbooks.
 *
 * Sections:
 *   1. Label census: ...
 *
 * Usage: node scripts/run-schema-census.mjs   (read-tier key: MINDRIAN_BRAIN_KEY
 * env or ~/.mindrian.env). Writes docs/census-<date>.md and prints a summary.
 *
 * No em-dashes.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CANONICAL_LABELS, DEPRECATED_LABELS, TIER1_LABELS, TIER2_LABELS,
  CANONICAL_EDGES, DEPRECATED_EDGES, TIMESTAMP_RE,
} from '../src/contracts/schema-contract.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://pws-brain-mcp.onrender.com';
const TIMEOUT_MS = 60000;
```

**`resolveReadKey()`, verbatim (lines 44-54) - copy as-is:**

```javascript
function resolveReadKey() {
  if (process.env.MINDRIAN_BRAIN_KEY) return process.env.MINDRIAN_BRAIN_KEY.trim();
  const envPath = path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), '.mindrian.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*MINDRIAN_BRAIN_KEY\s*=\s*(.*)\s*$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}
```

**`call()` - the SSE-aware JSON-RPC client, verbatim (lines 56-73) - copy as-is:**

```javascript
async function call(key, method, params, id) {
  const res = await fetch(BRAIN_URL + '/mcp', {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: 'Bearer ' + key,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  const dataLine = text.split(/\r?\n/).find((l) => l.startsWith('data: '));
  const body = JSON.parse(dataLine ? dataLine.slice(6) : text);
  if (body.error) throw new Error(`${body.error.code} ${body.error.message}`);
  return body.result;
}
```

**`q()` - the brain_query wrapper with the fail-loud payload check, verbatim (lines 75-86) -
copy as-is:**

```javascript
let seq = 1;
async function q(key, cypher) {
  const result = await call(key, 'tools/call', { name: 'brain_query', arguments: { cypher } }, ++seq);
  const text = result?.content?.[0]?.text || '[]';
  const parsed = JSON.parse(text);
  // Read-tier brain_query returns a bare row array; some wrappers envelope it
  // as {records:[...]}. Accept both; anything else is a loud failure, never
  // silently an empty census (the all-zeros census cannot be allowed to pass).
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.records)) return parsed.records;
  throw new Error('unrecognized brain_query payload shape: ' + text.slice(0, 120));
}
```

**The mandatory `initialize` handshake before any `q()` call (lines 99-104):**

```javascript
  const key = resolveReadKey();
  if (!key) { console.error('No read key (MINDRIAN_BRAIN_KEY).'); process.exit(1); }
  await call(key, 'initialize', {
    protocolVersion: '2024-11-05', capabilities: {},
    clientInfo: { name: 'schema-census', version: '1.0.0' },
  }, 1);
```

Change only `clientInfo.name` (e.g. `'wave-attribution'`). Omitting the handshake is a silent
failure mode.

**The `say()` markdown-emitter + file-write tail (lines 106-107, 181-188) - copy this if the
probe emits a tracked artifact:**

```javascript
  const lines = [];
  const say = (s) => { lines.push(s); console.log(s); };
  ...
  const outPath = path.join(REPO_ROOT, 'docs', `census-${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log('\nWritten: ' + outPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('FAIL: ' + (e && e.stack ? e.stack : e)); process.exit(1); });
}
```

The `import.meta.url === pathToFileURL(process.argv[1]).href` main-guard is the repo idiom for
script-or-module dual use; copy it so the probe's helpers stay importable by a test.

**Verdict helper worth reusing if the probe judges labels** (lines 88-96) - this is the exact
function that will print `UNKNOWN(GraphWriteEvent)` if edit 5a is skipped:

```javascript
function judgeLabelCombo(labels) {
  const unknown = labels.filter((l) => !CANONICAL_LABELS.has(l) && !DEPRECATED_LABELS.has(l));
  const deprecated = labels.filter((l) => DEPRECATED_LABELS.has(l));
  const primaries = labels.filter((l) => l !== 'Archived');
  if (unknown.length) return `UNKNOWN(${unknown.join('+')})`;
  if (primaries.length > 1) return 'CHIMERA';
  if (deprecated.length) return `DEPRECATED(${deprecated.join('+')})`;
  return 'ok';
}
```

---

## Shared Patterns

### A. The statement-level guard (id + name double bind)
**Source:** `docs/2026-08-11-RUNBOOK-249-alias-collapse.md` Step 2 (quoted in RESEARCH.md F-5).
**Apply to:** every write statement in `01-*.cypher` and `02-*.cypher`.

```cypher
MATCH (variant:Framework) WHERE id(variant) = 27390 AND variant.name = 'PWS-JTBD Innovation Discovery Framework'
MATCH (canon:Framework)   WHERE id(canon)   = 31103 AND canon.name   = 'Jobs to Be Done (JTBD)'
MERGE (variant)-[:ALIAS_OF]->(canon)
RETURN variant.name AS aliased, canon.name AS canonical, id(variant) AS variant_id, id(canon) AS canonical_id
```

Rationale to restate in the payload README: Memgraph internal ids can be reused after a node
deletion, so the id+name double bind makes a stale card a zero-row no-op rather than a silent
wrong-node write. Never a JS-side check; the guard lives in the statement.

### B. Batch provenance stamping on every created node and merged edge
**Source:** `payloads/chunk-document-repair/01-tier1-documents-partof.cypher`.
**Apply to:** all `01..NN` write files.

```cypher
  MERGE (d:Document {source_file: src})
    ON CREATE SET d.batch_id = 'pws-chunkdoc-2026-08-18',
                  d.created_by = 'payload',
```

`SCHEMA.md` section 3 makes `batch_id`, `source`/`source_doc`, `created_by` REQUIRED on every
write batch, and `created_at` must match `TIMESTAMP_RE` in `src/contracts/schema-contract.mjs`
exactly (`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`). This is also what makes
`99-undo.cypher` possible at all - the undo keys on `batch_id`.

### C. Undo keyed on batch_id, edges then nodes, never DETACH DELETE
**Source:** `payloads/chunk-document-repair/99-undo.cypher` (full text in Pattern Assignment 2).
**Apply to:** `99-undo.cypher`.

### D. Honest deviation recording (predicted vs written table)
**Source:** `payloads/chunk-document-repair/README.md` "Provenance (the rehearsal)" table.
**Apply to:** the payload README's Execution record section.
Predictions and actuals side by side; the miss annotated in the actual cell with its cause
(`8,841 (172 chunks lacked parseable chunk_index)`), never silently corrected upward.

### E. Test banner + RED-case naming
**Source:** `tests/schema-contract.test.mjs` header and its `test('RED: ...')` names.
**Apply to:** both test files.
Every guard gets a positive test AND a `RED:` test that proves the guard fires. Banner comment
block closes with `// No em-dashes.`.

### F. No em-dashes, everywhere
**Source:** both repos' `CLAUDE.md`; `run-schema-census.mjs` and `schema-contract.mjs` both
carry a literal `No em-dashes.` marker in their banners.
**Apply to:** every file this phase writes, including the ones whose ANALOGS violate the rule.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| The RECON-03 operator prerequisite checklist (D-04, location TBD by planner) | doc (manual checklist) | human-only | Nearest thing on disk is `docs/2026-08-18-SESSION-e2e-unquilting.md` lines 36-52, which is a session close-out narrative, not a standing checklist artifact. RESEARCH.md F-7 already contains the 7-row table in checklist form; the planner should lift that table rather than pattern-match a container. Also note: no `.planning/` exists in the Brain repo, so if this checklist must live there it is a new-file-kind decision. |

---

## Metadata

**Analog search scope:** `/home/jsagi/dev/ProblemsWorthSolving-Brain/` - `docs/` (24 files),
`payloads/` (4 dirs + 7 loose files), `tests/` (60+ `*.test.mjs`), `scripts/`, `src/contracts/`,
`src/ingest/`, `src/ontology.mjs`, `SCHEMA.md`, `CLAUDE.md`.
**Files opened and excerpted:** `SCHEMA.md`, `src/contracts/schema-contract.mjs`,
`src/ontology.mjs`, `src/ingest/allowlist.mjs`, `scripts/run-schema-census.mjs`,
`tests/schema-contract.test.mjs`, `tests/bounded-read-single-seam.test.mjs`,
`payloads/chunk-document-repair/{manifest.json,README.md,90-dry-run.cypher,91-verify.cypher,99-undo.cypher,01-tier1-documents-partof.cypher}`,
`payloads/orphan-linking-2026-08-18/manifest.json`, `docs/VECTOR-INDEX-DISPOSITIONS.md`,
`ProblemsWorthSolving-Brain/CLAUDE.md`.
**Pattern extraction date:** 2026-08-20
