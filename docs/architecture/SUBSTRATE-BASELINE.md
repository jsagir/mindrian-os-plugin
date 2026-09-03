# Substrate Baseline Violation Report

Status: INFORMATIONAL (not blocking)
Date: 2026-05-30
Phase: 128-03 (Substrate Contract ADR + CI Guards, Wave 3)
Source: `node scripts/check-substrate.cjs --baseline`
Contract: docs/architecture/SUBSTRATE-CONTRACT.md
Canon: Part 6 (dog-fooding), Part 8 (graph boundary), Part 9 (memory locality)

---

## What this report is (and is NOT)

This is the known-debt ledger: a dated enumeration of every PRE-EXISTING substrate
violation that lived in `lib/**` and `scripts/**` at the moment the Phase-128 guard was
wired into the live pre-commit hook (commit 1aba10d0, Phase 128-03 Task 1).

- It is INFORMATIONAL and NOT blocking. The baseline scan (`--baseline`) exits 0.
- The pre-commit hook runs `check-substrate.cjs --diff`, which blocks only NET-NEW
  violations introduced in STAGED files AFTER this baseline. The pre-existing rows
  below are deliberately NOT blocked; migrating them is owned by downstream phases.
- NONE of these violations are fixed in Phase 128. Phase 128 is the CONTRACT plus the
  GUARD, not the migration (per the ADR Scope boundary section and CONTEXT Open
  Decision 3).

The full-repo scan found 195 violations across 5 rules. The tables below enumerate them
grouped by rule, each row carrying its owning downstream phase.

---

## Headline finding: lazygraph-ops.cjs is the #1 bypass

`lib/core/lazygraph-ops.cjs` is the REAL production graph writer, NOT
`scripts/hsi-to-graph.cjs` as the original 2026-05-15 audit assumed. The 2026-05-30
21-agent dog-food review confirmed it is opened by roughly 15 scripts via its `openGraph`
opener and writes the bare 3-column schema `INSERT INTO nodes (id, type, properties)`
with NO provenance, NO `review_status`, NO truth-state.

This produces TWO divergent `nodes` schemas on the SAME `room.db`:

- the BARE 3-column schema written by `lazygraph-ops.cjs` via `openGraph`, versus
- the Phase-109 PROVENANCE schema written only by `openRoomDb`
  (`phase-109-nodes-provenance.cjs`), never by `openGraph`.

The divergence reproduces live as `NOT NULL constraint failed: nodes.source_path` when a
provenance-schema reader meets a bare-schema-written row. The guard exempts the
`lazygraph-ops.cjs` body itself (its internal INSERTs are baseline debt, not net-new
code to block) and instead flags every CALLER that reaches the graph via `openGraph`
outside the chokepoint. The schema-unification refactor that collapses the bare schema
into the Phase-109 provenance schema is owned by Phase 129, not Phase 128.

---

## Owning-phase legend

| Phase | Scope it owns |
|-------|---------------|
| 129 | spine-script rewrites: route the production graph writers (graph-ops, wiki/graph-links, the spine scripts) through navigation.cjs; collapse the bare lazygraph-ops schema into the Phase-109 provenance schema |
| 129.5 | the rs-* reverse-salient family (rs-mind-map, rs-sqlite-mirror, rs-expert-mapper) graph-write migration |
| 130 | the hats persistence path (hat-persistence.cjs filesystem writes) and the breakthrough/* graph writers |
| v1.14.0 | backlog: the remaining one-off scripts (build-ecosystem-graph, causal-to-graph, whitespace-to-graph, generate-export, generate-presentation) + the Aura Cypher interpolation hardening (M4 / Part 8) |
| test-debt | test + fixture files that exercise the bare schema directly; migrate alongside the production code they cover (allow-list candidates for ALLOWED_DIRECT_IMPORT once the production path is fixed) |

---

## Rule 1: openGraph bypass (the #1 production bypass) -- 34 hits

The `openGraph(...)` opener is the lazygraph-ops door. Every non-allowlisted caller is a
bypass of the navigation.cjs chokepoint.

### Production callers

| File | Owning phase |
|------|--------------|
| lib/core/lazygraph-ops.cjs (the opener itself, ~15 callers) | 129 |
| lib/core/graph-ops.cjs (6 calls: :67, :85, :103, :119, :181, :210) | 129 |
| lib/wiki/graph-links.cjs (4 calls: :63, :114, :163, :227) | 129 |
| lib/core/rs-expert-mapper.cjs:244 | 129.5 |
| lib/core/rs-mind-map.cjs:168 | 129.5 |
| lib/core/rs-sqlite-mirror.cjs:368 | 129.5 |
| scripts/hsi-to-graph.cjs:55 | 129 |
| scripts/discovery-cycle.cjs:198 | 129 |
| scripts/cross-room-detect.cjs:84 | 129 |
| scripts/build-graph-from-sqlite.cjs:67 | 129 |
| scripts/build-ecosystem-graph.cjs:143 | v1.14.0 |
| scripts/causal-to-graph.cjs:65 | v1.14.0 |
| scripts/whitespace-to-graph.cjs:105 | v1.14.0 |
| scripts/generate-export.cjs:421 | v1.14.0 |
| scripts/generate-presentation.cjs:495 | v1.14.0 |
| scripts/rs-explain-command.cjs:102 | 129.5 |
| scripts/rs-thesis-command.cjs:117 | 129.5 |

### Test / fixture callers (exercise the bare schema directly)

| File | Owning phase |
|------|--------------|
| lib/memory/lazygraph-rs-discoveries-view.test.cjs:46 | test-debt |
| lib/memory/test-rs-expert-mapper.cjs:121 | test-debt |
| lib/memory/test-rs-mind-map.cjs (:124, :135, :319) | test-debt |
| lib/memory/test-rs-sqlite-mirror.cjs (:128, :138, :148, :157, :166) | test-debt |

---

## Rule 2: raw graph write (un-provenanced INSERT/UPDATE/DELETE) -- 50 hits

Raw `INSERT INTO | UPDATE | DELETE FROM` against `nodes | edges | memory_event` outside
the chokepoint. This is the bare 3-column un-provenanced write class.

### Production writers

| File | Owning phase |
|------|--------------|
| lib/core/graph-ops.cjs (:189 edges, :219 nodes, :234 edges, :246 edges) | 129 |
| lib/core/rs-sqlite-mirror.cjs (:322-327 DELETE FROM edges/nodes) | 129.5 |
| lib/core/breakthrough/scanner.cjs:413 (UPDATE nodes) | 130 |
| lib/core/breakthrough/schema.cjs:126 (INSERT INTO nodes) | 130 |
| lib/core/breakthrough/verb-dispatch.cjs:197 (UPDATE nodes) | 130 |
| scripts/build-ecosystem-graph.cjs (:146, :171, :178, :183, :224, :246, :254, :274, :308) | v1.14.0 |
| scripts/hsi-to-graph.cjs (:60, :61 DELETE; :65, :69 INSERT -- raw conn.prepare) | 129 |

### Test / fixture writers

| File | Owning phase |
|------|--------------|
| lib/core/breakthrough/*.test.cjs (detectors, resurfacing, scanner, scanner-d17-d18, schema, verb-dispatch) | test-debt |
| lib/memory/index-artifact-transaction.test.cjs:243 | test-debt |
| lib/memory/lazygraph-rs-discoveries-view.test.cjs (:52, :67) | test-debt |
| lib/memory/test-rs-sqlite-mirror.cjs (:248, :249, :360-367) | test-debt |
| scripts/check-pending-breakthrough.test.cjs:48 | test-debt |

---

## Rule 3: chokepoint require (direct require of room-db / lazygraph-ops / memory-ops) -- 28 hits

A direct `require()` of `room-db.cjs`, `lazygraph-ops.cjs`, or `memory-ops.cjs` from a
non-allowlisted path. Carried-forward strict-superset of the retired
`--check-chokepoint`.

### Production requires

| File | Owning phase |
|------|--------------|
| lib/agents/auto-explore-agent.cjs:814 (lazygraph-ops) | 129 |
| lib/agents/reverse-salient-agent.cjs:296 (lazygraph-ops) | 129.5 |
| lib/agents/tension-hook-agent.cjs:288 (lazygraph-ops) | 129 |
| lib/core/breakthrough/scanner.cjs:40 (room-db) | 130 |
| lib/core/graph-ops.cjs:14 (lazygraph-ops) | 129 |
| lib/core/proactive-intelligence.cjs:131 (lazygraph-ops) | 129 |
| lib/core/room-auto-create.cjs (:211, :266 room-db) | 129 |
| lib/core/room-discard-cascade.cjs (:94, :202 room-db) | 129 |
| lib/core/room-naming-selector.cjs (:301, :324 room-db) | 129 |
| lib/core/rs-expert-mapper.cjs:64 (lazygraph-ops) | 129.5 |
| lib/core/rs-mind-map.cjs:45 (lazygraph-ops) | 129.5 |
| lib/core/rs-neo4j-writer.cjs:52 (lazygraph-ops) | 129.5 |
| lib/core/rs-sqlite-mirror.cjs:57 (lazygraph-ops) | 129.5 |
| lib/wiki/graph-links.cjs:32 (lazygraph-ops) | 129 |
| scripts/causal-to-graph.cjs:20 (lazygraph-ops) | v1.14.0 |
| scripts/hsi-to-graph.cjs:18 (lazygraph-ops) | 129 |
| scripts/whitespace-to-graph.cjs:26 (lazygraph-ops) | v1.14.0 |

### Test requires

| File | Owning phase |
|------|--------------|
| lib/core/llm-name-suggester.test.cjs, room-discard-cascade.test.cjs, room-naming-selector.test.cjs | test-debt |
| lib/memory/index-artifact-transaction.test.cjs, lazygraph-rs-discoveries-view.test.cjs, test-rs-expert-mapper.cjs, test-rs-mind-map.cjs, test-rs-sqlite-mirror.cjs | test-debt |

---

## Rule 4: direct sqlite require (M3) -- 20 hits

A direct `require('node:sqlite')` or `require('better-sqlite3')` outside the chokepoint
(M3 breach). The driver must be reached only via lib/core/navigation.cjs.

### Production requires

| File | Owning phase |
|------|--------------|
| lib/conversation/operator.cjs:190 | 129 |
| lib/core/breakthrough/review-queue.cjs:33 | 130 |
| lib/core/chat-context-builder.cjs:35 | 129 |
| lib/core/proactive-intelligence.cjs:138 | 129 |
| lib/core/venture-shape-nudge.cjs:88 | 129 |
| lib/hmi/selector-telemetry.cjs:220 | 129 |
| lib/hmi/shape-f0-renderer.cjs:105 | 129 |
| lib/hmi/shape-f6-plan-review-renderer.cjs (:216, :270) | 129 |
| scripts/auto-explore-fingerprint.cjs (:99, :129) | 129 |
| scripts/discovery-cycle.cjs:128 | 129 |
| scripts/dogfood-derive.cjs:118, scripts/dogfood-emit.cjs:37 | v1.14.0 |
| scripts/feynman-timeline-refresh-command.cjs:113 | 129 |
| scripts/preflight-tension-surface.cjs (:160, :342) | 129 |

### Test requires

| File | Owning phase |
|------|--------------|
| lib/memory/heal-command.test.cjs:366, index-artifact-transaction.test.cjs:58, rs-discovery-engine.test.cjs:69 | test-debt |

---

## Rule 5: Cypher MATCH user-content interpolation (M4 / Part 8) -- 63 hits

A Cypher `MATCH` that splices a variable into the query string (template-literal `${...}`
or string concatenation) instead of binding a parameter. The Aura read must bind only
generic handles, never user bytes (Canon Part 8). Most of these 63 hits are FALSE-POSITIVE
ASSERTION-STRING matches (test files containing the word "match" in an assertion message,
e.g. `'... does not match ...' + x`), but the genuine production Cypher-interpolation
breaches are real and owned downstream.

### Genuine production Cypher interpolation

| File | Owning phase |
|------|--------------|
| lib/core/brain-client.cjs (:571, :768 -- `[:CO_OCCURS*1..${maxDepth}]`, `[:FEEDS_INTO*1..${chainDepth}]`; depth ints, not user content -- candidate allow-list) | v1.14.0 |
| lib/core/brain-derivation-prompts.cjs (:239, :241, :300, :301 -- section slug / problem-type name spliced into MATCH) | v1.14.0 |
| lib/core/rs-mind-map.cjs (:388, :389 -- Aura traversal) | 129.5 |
| scripts/generate-chat-embed.cjs:95 (section name spliced) | v1.14.0 |
| scripts/load-embeddings-into-neo4j.cjs (:339, :348, :450 -- label interpolation) | v1.14.0 |
| scripts/seed-brain-commands.cjs (:255, :266, :275 -- command/framework name spliced) | v1.14.0 |
| scripts/whitespace-to-brain.cjs (:162, :163 -- hash / framework name spliced) | v1.14.0 |

### Known false-positive cluster (assertion strings, not Cypher)

Roughly 45 of the 63 hits are test/assertion strings containing the literal word "match"
(for example `'... must match ...' + got`) in `lib/memory/test-*`, `lib/core/*.test.cjs`,
`scripts/intent-classifier.cjs`, `scripts/doctor.cjs`. These are NOT Aura queries and
carry no user-content egress. They are noted here for transparency; tightening the M4
regex to reduce this noise is a v1.14.0 backlog item and does NOT change the net-new gate
(the `--diff` gate only blocks files a developer is actively staging).

---

## Hats persistence (Cluster-2 finding, filesystem-state write)

`lib/core/hat-persistence.cjs` writes hats state to the filesystem
(`.mindrian/hats/{color}/STATE.md`) instead of `room.db`. The current
`check-substrate.cjs` rule set does not yet have a dedicated filesystem-state-write rule
for the hats path, so it does not surface in the scan above; it is named here as known
Cluster-2 debt for completeness. Migrating the hats persistence path into `room.db` via
the chokepoint is owned by Phase 130.

---

## Hook enforcement proof

The live pre-commit hook (and the installer template) run
`node scripts/check-substrate.cjs --diff` over staged files. The following transcript
proves the guard HARD-FAILS a net-new violation. A throwaway fixture containing a raw
`INSERT INTO nodes` (outside navigation.cjs) was driven through the guard via the
`MINDRIAN_HOOK_STAGED_FILES` + `MINDRIAN_HOOK_STAGED_CONTENT_DIR` seams, then removed.

Command:

```
MINDRIAN_HOOK_STAGED_FILES=scripts/__substrate_fixture_netnew.cjs \
MINDRIAN_HOOK_STAGED_CONTENT_DIR=<tmp> \
  node scripts/check-substrate.cjs --diff
```

Fixture body (the offending line):

```
return db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)').run(id, 'x', '{}');
```

Output (stderr) and exit code:

```
[check-substrate] FAIL (--diff): staged changes bypass the navigation.cjs chokepoint:
[raw-graph-write] 1 violation(s):
  scripts/__substrate_fixture_netnew.cjs:4: INSERT INTO nodes

Route the access through lib/core/navigation.cjs, or add the path to ALLOWED_DIRECT_IMPORT in scripts/check-substrate.cjs.
=== EXIT CODE: 1 ===
```

Exit code 1 (non-zero) means the pre-commit hook would REJECT this commit. The fixture
was deleted immediately after the proof; no fixture file is left in the tree. This closes
the H1 finding: the guard is no longer inert -- a net-new chokepoint bypass cannot land.

---

## Summary

- 195 pre-existing violations enumerated across 5 rules. This is the known-debt ledger.
- The #1 bypass is `lib/core/lazygraph-ops.cjs` (opened by ~15 callers via `openGraph`),
  writing the bare 3-column un-provenanced schema that diverges from the Phase-109
  provenance schema on the same `room.db`.
- Every row is assigned to a downstream owning phase (129 / 129.5 / 130 / v1.14.0); none
  are fixed in Phase 128.
- This report is informational and not blocking. The hook blocks only NET-NEW violations.

---

## 2026-08-31 re-measurement (Phase 273)

Result: **208**, unchanged from the pre-fix measurement. Re-ran `node scripts/check-substrate.cjs --baseline` after landing Phase 273's C1/C2/C3 fixes (273-03: writeEdge changes-aware + PRAGMA fallback; 273-04: inline `ALLOWED_EDGE_TYPES` guard in `ingestion.cjs`), per-rule breakdown `chokepoint-require 47, m3-direct-sqlite-require 33, m4-cypher-interpolation 35, opengraph-bypass 38, raw-graph-write 55`.

This is expected, not a regression. Two independent reasons, both verified by execution:

1. `lib/core/navigation/` (where `ingestion.cjs` and `edges.cjs` live) is path-allowlisted at
   `check-substrate.cjs:70` (`/^lib\/core\/navigation\//`).
2. The guard's `RE_RAW_WRITE` regex (`check-substrate.cjs:132`) does not match
   `INSERT OR IGNORE INTO` syntax at all.

Phase 273's C3 fix (an inline `ALLOWED_EDGE_TYPES` guard in `ingestion.cjs`) was therefore
structurally incapable of moving this count, regardless of fix quality. The remaining +13 delta
from the previously-documented 195 is pre-existing accrual on lines this phase's scope did not
touch; it is owned by the C4/M5-M8 fast-follow phase (busy-timeout propagation, nested-tx
guards, unguarded ROLLBACK sites) and by the M3 regex-hole fix (widening `RE_RAW_WRITE` to
catch `INSERT OR IGNORE`), both explicitly deferred per 273-CONTEXT.md D-02. Widening the regex
in this phase would increase the count and make this reconciliation note uninterpretable, so it
is deliberately not done here.

Cross-reference: `.planning/phases/273-sqlite-graph-chokepoint-hardening-writeedge-silent-failure-a/`
(273-RESEARCH.md's D-05 finding, 273-CONTEXT.md's D-05 correction, `tests/test-273-substrate-baseline-honest.cjs`).
- The hook enforcement proof confirms a net-new raw `INSERT INTO nodes` is hard-rejected.

---

## 2026-09-03 re-measurement (260903-gdm, R17 node-write consolidation Task 3)

Result: **205**, down from 208. Re-ran `node scripts/check-substrate.cjs --baseline` after
landing Tasks 1-3 of the R17 node-write-consolidation plan (16 sites across 11 files routed
through `lib/core/node-insert.cjs::insertNode`), per-rule breakdown `chokepoint-require 47,
m3-direct-sqlite-require 33, m4-cypher-interpolation 35, opengraph-bypass 38, raw-graph-write 52`.

This matches the plan's stated expectation exactly: `raw-graph-write` drops by 3 (55 to 52),
every other rule count is UNCHANGED from the 2026-08-31 measurement (47/33/35/38 all identical).

The `-3` on `raw-graph-write` accounts for the three sites that are NOT under
`lib/core/navigation/`'s path allowlist (`check-substrate.cjs:70`) and so were counted as raw
`INSERT INTO nodes` violations before this task:

- `lib/core/graph-ops.cjs:225` (the 3-column legacy `indexOpportunity` fallback)
- `lib/core/breakthrough/schema.cjs:126` (the `breakthrough` node write)
- `lib/core/doctor/umbilical-module.cjs:459` (`ensureNode`, the umbilical-cord FK-target write)

The 11 sibling `lib/core/navigation/*` sites consolidated in Task 2 contributed ZERO to this
count either before or after (path-allowlisted), so their consolidation is invisible to this
guard by design; their only regression net is the named behavioral test suite (Tasks 2 and 3),
all green.

`lib/core/node-insert.cjs`'s own two `INSERT INTO nodes` statements (the chokepoint's low-level
primitive) remain counted in `raw-graph-write` throughout, unchanged by this task -- they are
the sanctioned door every other production site now routes through, not a bypass.

Two named coverage gaps remain OUTSIDE this chokepoint after Task 3, per the ratified R17
exclusions (NOT closed by this consolidation, carried forward, never to be described as R17
being fully closed):

- `lib/core/navigation/memory-events.cjs:772` -- append-only bookkeeping dedupe contract, only
  ever writes `memory_event` nodes.
- `lib/core/rs-sqlite-mirror.cjs:407` -- bulk-write hot path; a per-row `insertNode` call would
  add a `PRAGMA table_info(nodes)` round trip per row.

Cross-reference: `.planning/quick/260903-gdm-implement-r17-node-write-consolidation-t/260903-gdm-PLAN.md`,
`tests/test-273-substrate-baseline-honest.cjs`.
