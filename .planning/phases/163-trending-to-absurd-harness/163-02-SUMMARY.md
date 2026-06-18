---
phase: 163
plan: 02
subsystem: navigation/typed-domain
status: complete
tags: [domain-taxonomy, typed-nodes, edge-linker, chokepoint, D-163-01, D-163-04, wave-2-foundation-b]
requires:
  - lib/core/navigation/edges.cjs (ALLOWED_EDGE_TYPES with the four Wave-1 domain edges)
  - lib/core/node-insert.cjs (insertNode both-schema-safe minter)
  - lib/core/navigation.cjs (the 13-function chokepoint surface)
provides:
  - writeDomainNode (domain / subdomain / focus_area first-class typed node writer)
  - linkDomainToRelated (the four-edge domain hub linker, chokepoint-only)
  - DOMAIN_NODE_TYPES frozen Set {domain, subdomain, focus_area}
  - DOMAIN_EDGE_SUBSET frozen Set {DECOMPOSED_INTO, PART_OF, TAGGED_WITH, RELATED_TO}
  - navigation.cjs additive re-export of the two domain writers
affects:
  - Wave 3 getDomainsForTrendExtrapolation reader (walks the domain hub this substrate mints)
  - the Trending-to-the-Absurd trend agent (graph-native seeding, D-163-04)
tech-stack:
  added: []
  patterns:
    - typed-claim.cjs writer idiom (frozen-Set enum, 31-multiplier hash id-minter, additive-JSON props, never-throw)
    - memory-artifacts.cjs writeCortexLineageEdge subset-constraint idiom (DOMAIN_EDGE_SUBSET mirrors the CORTEX subset)
    - navigation.cjs writeClaimNode / writeCortexLineageEdge additive-re-export idiom
    - node-insert.cjs insertNode both-schema-safe mint (review_status defaults proposed)
key-files:
  created:
    - lib/core/navigation/typed-domain.cjs
    - tests/test-typed-domain.cjs
  modified:
    - lib/core/navigation.cjs
    - tests/run-all-163.sh
decisions:
  - "writeDomainNode mints via insertNode (proposed default), then a scoped review_status UPDATE promotes ONLY pure-taxonomy (taxonomy:true) nodes to confirmed -- the Part 9 v1.5 audit-node carve-out, keeping insertNode as the minting path per the plan key_link"
  - "linkDomainToRelated derives edge direction per D-163-03 (PART_OF/TAGGED_WITH: member->domain; DECOMPOSED_INTO/RELATED_TO: domain->target), with an optional caller properties override"
metrics:
  duration: ~1 session
  completed: 2026-06-18
  tasks: 2
  files: 4
---

# Phase 163 Plan 02: typed-domain writer + edge-linker Summary

WAVE 2 FOUNDATION-B landed: domain / subdomain / focus_area are now FIRST-CLASS typed
nodes (D-163-01) via `lib/core/navigation/typed-domain.cjs`, and a new domain hub links
to related existing nodes through the four Wave-1 domain edges using
`navigation.writeEdge` ONLY (the chokepoint, never raw SQL). The connective-taxonomy
substrate ships before the trend agent (D-163-04): the agent is graph-native from its
first run.

## What shipped

### Task 1 (commit 0bb74e20) -- typed-domain.cjs writer + test (TDD)
- New `lib/core/navigation/typed-domain.cjs` mirrors `typed-claim.cjs` verbatim: the
  allow-list header note, `isPlainObject`, the stable 31-multiplier `DOMAIN_NODE_ID`
  hash minter, additive-JSON props (the D-10 precedent), and the defensive
  never-throw contract.
- `DOMAIN_NODE_TYPES` frozen Set `{domain, subdomain, focus_area}` (D-163-01), mirroring
  the `KNOWLEDGE_TYPES` frozen-Set idiom at `typed-claim.cjs:48`.
- `writeDomainNode(db, params)` validates `domainType` against `DOMAIN_NODE_TYPES`
  (rejects `invalid_domain_type`), mints the node via `lib/core/node-insert.cjs`
  `insertNode` (both-schema safe per `node-insert.cjs:95`) with `created_by='system'`,
  and applies the proposed-vs-confirmed split:
  - truth-claim domain (`taxonomy` absent/false) -> `review_status 'proposed'`, NEVER
    auto-confirmed (Part 9 role 5);
  - pure-taxonomy domain (`taxonomy:true`) -> a scoped `review_status` UPDATE to
    `'confirmed'` by the system rule that wrote it (Part 9 v1.5 audit-node carve-out
    spirit -- a taxonomy label asserts no venture truth, exactly the `focus.cjs`
    `focus_changed` precedent).
  - props bag is additive JSON only (`name`, `domainType`, `parentId` default `''`,
    `evidenceTier` default `'None'`); never DDL columns.
- Idempotent id `'domain:'+sid+':'+hash(name)` makes re-writing the same
  `(name, sessionId)` an UPSERT, not a duplicate.
- `tests/test-typed-domain.cjs` covers all eight plan behaviors (Tests 1-8) plus a
  `DOMAIN_NODE_TYPES` frozen-Set sanity check over an in-memory Phase-109-migrated
  nodes schema + edges table (no SKIP path). RED confirmed before GREEN
  (`MODULE_NOT_FOUND` on the missing writer); GREEN PASS (9/9).

### Task 2 (commit 5da70cec) -- linkDomainToRelated wiring + navigation re-export + suite registration
- `linkDomainToRelated(db, params)` (authored in `typed-domain.cjs` alongside the
  writer) constrains its accepted edge set to `DOMAIN_EDGE_SUBSET`
  `{DECOMPOSED_INTO, PART_OF, TAGGED_WITH, RELATED_TO}` -- a frozen subset of the
  Wave-1 `ALLOWED_EDGE_TYPES`, mirroring `memory-artifacts.cjs writeCortexLineageEdge`
  constraining to its CORTEX subset (`edges.cjs:271-274`). For each relation it calls
  `navigation.writeEdge` (the chokepoint, never raw SQL). Edge DIRECTION follows
  D-163-03: `DECOMPOSED_INTO` and `RELATED_TO` are `domain -> target`; `PART_OF` and
  `TAGGED_WITH` are `member -> domain`. A relation outside the subset returns a FAILURE
  ENTRY (`edge_not_in_domain_subset`), never a throw. Returns
  `{ written, edges, failures }` mirroring `writeCascadeEdges` in
  `futures/orchestrator.cjs:283-310`. Props stay ENUM/scalar only (a relation enum + the
  taxonomy node id; never prose, Part 8).
- `lib/core/navigation.cjs` additively re-exports `writeDomainNode`,
  `linkDomainToRelated`, `DOMAIN_NODE_TYPES`, `DOMAIN_EDGE_SUBSET`, `DOMAIN_NODE_ID` on
  the closed surface, following the `writeClaimNode` / `writeCortexLineageEdge` /
  `writeLineageEdge` re-export idiom (the closed surface comment block).
- `tests/run-all-163.sh`: registered `test-typed-domain.cjs` in `CJS_SUITES` (appended
  after the Wave 1 floor test, never rewriting Wave 1) and added `typed-domain.cjs`,
  `navigation.cjs`, and `test-typed-domain.cjs` to the em-dash sweep targets.

## Verification results

- `node tests/test-typed-domain.cjs` -> PASS (9/9: the eight behaviors + the frozen-Set
  sanity check).
- Re-export resolves: `node -e "... require('./lib/core/navigation.cjs') ..."` ->
  `REEXPORT_OK` (`writeDomainNode` + `linkDomainToRelated` callable).
- `bash tests/run-all-163.sh` -> Total 3, Passed 3, Failed 0 (floor test 6/6 +
  typed-domain 9/9 + em-dash sweep clean).
- Chokepoint-only (Test 8): `typed-domain.cjs` carries zero direct require of
  `room-db.cjs` / `lazygraph-ops.cjs` / `node:sqlite`. It requires only
  `../node-insert.cjs` (the both-schema minter) and `./edges.cjs` (`writeEdge`, the
  chokepoint primitive).
- Part 8: zero Brain egress. `writeDomainNode` + `linkDomainToRelated` are pure LOCAL
  SQLite over a caller-owned handle; edge props are ENUM/scalar only; no network surface.
- No em-dashes anywhere (CLAUDE.md HARD RULE) -- the run-all-163.sh sweep over all eight
  targets PASSED.

## Deviations from Plan

### Auto-fixed / clarified during execution

**1. [Rule 3 - blocking] insertNode cannot set review_status to 'confirmed'**
- **Found during:** Task 1 (Test 4 -- taxonomy:true must land 'confirmed').
- **Issue:** The plan key_link mandates minting via `insertNode`, but `insertNode`
  (the both-schema-safe helper) always lands `review_status` at the column DEFAULT
  `'proposed'` and exposes no review_status override. Test 4 requires a pure-taxonomy
  node to carry `'confirmed'`.
- **Fix:** `writeDomainNode` mints via `insertNode` (satisfying the key_link grep
  `insertNode`, lands 'proposed'), then for `taxonomy === true` ONLY runs a scoped
  `UPDATE nodes SET review_status = 'confirmed' WHERE id = ?`. This is NOT a
  truth-claim promotion (that stays on the human `confirmNode` byUser path) -- it is the
  system rule that wrote the taxonomy bookkeeping label confirming its own write, the
  Part 9 v1.5 audit-node carve-out spirit. The UPDATE is PRAGMA-guarded so an
  un-migrated 3-column schema (no review_status column) degrades safely without
  failing the node write.
- **Files modified:** lib/core/navigation/typed-domain.cjs
- **Commit:** 0bb74e20

**2. [clarification] Single-module landing across the two tasks**
- `writeDomainNode` and `linkDomainToRelated` both live in `typed-domain.cjs` (one
  module), and the eight behaviors live in one test file. Task 1 committed the module +
  test (writer headline); Task 2 committed the navigation.cjs re-export + the
  run-all-163.sh registration. No behavior change -- the commit boundary follows the
  plan's logical task split, not a per-function file split.

## Known Stubs

None. `writeDomainNode` and `linkDomainToRelated` are fully wired through the
navigation chokepoint and exercised by the 9-check suite. The Wave-3 consumer
(`getDomainsForTrendExtrapolation`) is out of scope for this plan (a downstream wave).

## Self-Check: PASSED

- FOUND: lib/core/navigation/typed-domain.cjs
- FOUND: tests/test-typed-domain.cjs
- FOUND: lib/core/navigation.cjs (modified -- additive re-export)
- FOUND: tests/run-all-163.sh (modified -- suite + em-dash targets registered)
- FOUND commit: 0bb74e20 (Task 1)
- FOUND commit: 5da70cec (Task 2)
- VERIFIED: node tests/test-typed-domain.cjs -> 9/9; bash tests/run-all-163.sh -> 3/3 green
