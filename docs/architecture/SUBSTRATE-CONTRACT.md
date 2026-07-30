# ADR: The Substrate Contract

- **Status:** Accepted
- **Date:** 2026-05-30
- **Phase:** 128 (substrate-contract-adr), Plan 01
- **Codifies canon parts:** Part 6 (Product-as-Venture dog-fooding), Part 7 (Reuse
  Before Build), Part 8 (The Graph Boundary), Part 9 (Memory Locality).
- **One-line contract:** `lib/core/navigation.cjs` is the ONLY door to `room.db`.
  No other module reads or writes the local graph except through its closed,
  named export surface.

This ADR is binding. Phases 129, 130, 131, and every future phase that touches
`room.db` reference it. The Plan 02 guard (`scripts/check-substrate.cjs`) enforces
it structurally. The Plan 03 hook wiring makes the enforcement live. The guard
cannot be specified without this document: the allow-list scope, the severity, and
the supersede-vs-extend decision all live here.

## Why this ADR exists

Phase 109 shipped the navigation chokepoint. Nothing made it the ONLY door, and no
document pinned the door's surface by name. The 2026-05-15 5-cluster audit and the
2026-05-30 21-agent dog-food review both confirmed drift slipping past code review
because there was no STRUCTURAL gate. This ADR is the contract; the guard is the gate.

## The four substrates

| Substrate | Owns | Access pattern |
|---|---|---|
| Local SQLite (`room.db`) | The navigator's room: artifacts, encodings, scores, F-shape decisions, telemetry, hats state, memory_event log, typed nodes and edges | `lib/core/navigation.cjs` chokepoint ONLY |
| Aura Neo4j (remote) | External scholarly graph: Author / Paper / Institution / Patent / Industry | Parameterized Cypher MATCH, read-mostly, no user-content interpolation |
| Brain MCP (remote) | Teaching methodology: frameworks, problem-types, chains, phase progressions | `brain_ask` DirectiveEnvelope, GUIDED default, typed packet only |
| Pinecone (remote) | Vector embeddings for semantic search | `mcp__pinecone__*` tool surface |

Each datum has exactly one owning substrate. `room.db` data never egresses to Brain
(Canon Part 8). Brain methodology may flow into LOCAL. The substrates do not share
code paths and do not write to each other.

## Cross-cutting mandates

- **M1 Substrate Contract.** Each datum has exactly one owning substrate; no datum
  is co-owned. Rationale: dual ownership creates a dual source of truth and a silent
  divergence surface (the bare-vs-provenance `nodes` schema split is the live proof).

- **M2 Local Graph Awareness.** Read `room.db` only via `lib/core/navigation.cjs`.
  Rationale: the chokepoint is the single place that knows the provenance schema,
  the truth-state transitions, and the memory_event log; folder-scanning around it
  loses all three.

- **M3 No direct sqlite require.** No `require('node:sqlite')` or
  `require('better-sqlite3')` outside the chokepoint and its allow-listed substrate
  files. Rationale: a direct driver handle bypasses every navigation invariant and
  can write an un-provenanced row that violates Part 9.

- **M4 No Cypher user-content interpolation.** No Cypher MATCH that interpolates a
  user-content variable into the query string. Rationale: this is the Canon Part 8
  breach pattern; user bytes must never reach a remote substrate, and string-built
  Cypher also opens an injection surface.

- **M11 navigation.cjs export allow-list (the closed door, by name).** The chokepoint
  surface is the named list below, copied verbatim from `lib/core/navigation.cjs`
  `module.exports`. This is the M11 fix: the door is now auditable by exported
  function name, not by prose.

### M11 export allow-list

The closed chokepoint surface is exactly these export keys from
`lib/core/navigation.cjs` `module.exports`:

- `getActiveFocus`
- `setFocus`
- `getNeighborhood`
- `findContradictions`
- `findUnsupportedClaims`
- `findBlockingAssumptions`
- `findStaleDecisions`
- `findOpenQuestions`
- `findSurfaceableTensions`
- `findRecentChanges`
- `findRelevantOpportunities`
- `buildBrainPacket`
- `storeBrainSuggestions`
- `getRoomHomeView`
- `promoteNodeStatus`
- `logMemoryEvent`
- `firstCapturedLastTouchedBySection`
- `writeEdge`
- `detectActiveRoom`
- `getRecentDecisionNeighborhood`
- `logSpineRead`
- `logJtbdTransition`
- `logOperatorTransition`
- `logWorkflowStage`
- `logSuggestionSurfaced`
- `getCurrentJTBD`
- `getCurrentOperator`
- `confirmNode`
- `resolveByUser`
- `writeHatState`
- `readHatState`
- `readAllHatStates`
- `writeLensFinding`
- `writeEvidenceClaim`
- `getResearchPreflight`

The originally documented "closed 13" was the Phase 109 surface (Focus, Neighborhood,
the insight queries, `findRecentChanges`, `findRelevantOpportunities`,
`buildBrainPacket`, `storeBrainSuggestions`, `getRoomHomeView`, `promoteNodeStatus`).
It was relaxed additively to the current surface via per-export justification comments
in the source: `logMemoryEvent` (Phase 110-03), `firstCapturedLastTouchedBySection`
(Phase 124-01), `writeEdge` (Phase 125-00), and `detectActiveRoom` plus
`getRecentDecisionNeighborhood` (Phase 118-02). Each addition is a thin re-export of
an internal helper so consumers never reach into `lib/core/navigation/` directly.

**Amendment rule:** Each FUTURE addition to this surface requires a new amendment line
in this ADR naming the export, the phase, and the consumer. The list above is the
closed surface until amended. Adding an export to `navigation.cjs` without an amendment
line here is itself a contract violation.

### Amendments

- **Phase 129-01 (2026-05-30).** Added seven spine-helper exports re-exported from
  `lib/core/navigation/spine-events.cjs`: `logSpineRead`, `logJtbdTransition`,
  `logOperatorTransition`, `logWorkflowStage`, `logSuggestionSurfaced`,
  `getCurrentJTBD`, `getCurrentOperator`. **Consumer:** the 6 spine scripts
  (`mos-status`, `suggest-next-command`, `act-command` / `pipeline-command`,
  `jtbd-command`, `operator-command`, `memory-command`), which are NOT in the
  `check-substrate.cjs` allow-list and so must reach `room.db` ONLY through this
  chokepoint. Each `log*` helper takes a `roomDir` (never a db handle), opens
  `room.db` internally via `lib/core/room-db.cjs` (legal -- `lib/core/navigation/`
  is allow-listed), writes a `memory_event` via the internal `logEvent` helper, and
  closes the handle. `getCurrentJTBD` / `getCurrentOperator` are event-log-authoritative
  with the `jtbd-state.json` / `conversation-operator.json` cache file as fallback.
  `spine-events.cjs` is a thin re-export of internal navigation helpers, so consumers
  never reach into `lib/core/navigation/` directly.

- **Phase 129.5-02 (2026-05-31).** Added two exports re-exported from
  `lib/core/navigation/confirm-node.cjs`: `confirmNode` and `resolveByUser`.
  **Consumer:** the Plan 03 Decision Gate APPROVE path (the selector dispatcher),
  plus future gates (Phase 130 lens-engine accept, Phase 116 tension resolution).
  `confirmNode(db, id, byUser, reason?)` is the single chokepoint for the
  `proposed -> confirmed` promotion: it resolves the node's current `review_status`
  and delegates to `promoteNodeStatus`. After this plan, `promoteNodeStatus` is no
  longer called directly by any production code outside `confirm-node.cjs` (a
  source-grep test in `tests/test-129.5-confirm-node.cjs` enforces this).
  `resolveByUser(roomDir)` reads the active room's `USER.md` navigator identity and
  maps it to a non-agent `byUser`, defaulting to `navigator` and never returning an
  agent identity (`larry` / `brain` / `system` / `assistant`). `confirm-node.cjs`
  writes NO Cypher and NO raw INSERT / UPDATE / DELETE on `nodes` / `edges`: it
  delegates ALL writes to `promoteNodeStatus`, so it is allow-listed under
  `lib/core/navigation/` without adding any substrate bypass. The human-attribution
  guard lives in `promoteNodeStatus` (the `AGENT_IDENTITIES` REJECT on confirm /
  validate of truth-claim node types) per the Canon Part 9 v1.5 audit-node carve-out.

- **Phase 130-01 (2026-05-31).** Added four exports re-exported from
  `lib/core/navigation/lens-nodes.cjs`: `writeHatState`, `readHatState`,
  `readAllHatStates`, and `writeLensFinding`. **Consumer:** the Plan 02
  `lib/core/lens-engine.cjs` (onAccept writes a `lens_finding` node via
  `writeLensFinding` then an `INFORMS` edge FROM it; onReject a `REJECTED_BECAUSE`
  edge) and the Plan 03 `lib/core/hat-persistence.cjs` rewrite (the 6 filesystem
  `.mindrian/hats/{color}/STATE.md` writes RETIRE to typed `HatState` nodes in
  `room.db`). Unlike the Phase 129-01 spine helpers, each lens-node writer takes a
  caller-owned `db` handle (obtained via `lib/core/room-db.cjs` `openRoomDb`)
  EXACTLY like `writeEdge` -- the module NEVER requires `node:sqlite` and NEVER
  opens `room.db` itself, so it carries zero direct `room.db` open and stays inside
  the `lib/core/navigation/` allow-list with zero substrate bypass (a source-grep
  test in `tests/test-130-lens-substrate.cjs` enforces the no-direct-sqlite
  invariant). `writeHatState` UPSERTs a node `id 'hatstate:'+color`, type
  `HatState`, `created_by='system'`, `review_status='confirmed'`; this is
  canon-legal WITHOUT a human `byUser` because a `HatState` node is a
  system-bookkeeping node per the Canon Part 9 v1.5 audit-node carve-out (it is NOT
  in the truth-claim set `{claim, CausalClaim, assumption, decision, opportunity}`).
  `writeLensFinding` UPSERTs a node type `lens_finding` `review_status='proposed'`
  `created_by='system'` -- a proposed surface awaiting the Decision Gate, never
  auto-confirmed.

- **Phase 131-01 (2026-06-01).** Added two exports re-exported from two new
  allow-listed navigation submodules: `writeEvidenceClaim` (from
  `lib/core/navigation/evidence-claim.cjs`) and `getResearchPreflight` (from
  `lib/core/navigation/research-preflight.cjs`). **Consumers:** the Plan 03
  source-lens driver, the Plan 04 wirer + F.1 selector, and the Plan 05 command
  orchestration. These are the source-lens research pipeline's two forward-contract
  surfaces, LOCKED for Phase 136 consumption without a migration. `writeEvidenceClaim`
  is the Stage 7 ACCEPT-path node writer: it UPSERTs a node type `EvidenceClaim`,
  `created_by='system'`, `review_status='proposed'`, with the LOCKED Phase 136
  provenance schema `{ source, url, retrieved_at, evidence_tier }` plus `topic` +
  `summary`. Unlike the Phase 130-01 `HatState` node, an `EvidenceClaim` IS a
  truth-claim node (it asserts something about the venture's world), so it is NOT
  carved out by the Part 9 v1.5 audit-node carve-out: it lands `proposed` and is
  NEVER auto-confirmed; only a human APPROVE (routed through `confirmNode` by the
  Plan 04 wirer) promotes it to `confirmed` (Canon Part 9 role 5). `evidence_tier`
  validates against the closed Canon Part 5 set `{Academic, Operational,
  Practitioner, None}`. `getResearchPreflight(db, opts)` is the batched Stage-1
  read that collapses the 8 pre-flight inputs (active_workflow, active_jtbd,
  operator, current_section, recent_changes, evidence_gaps, prior_research,
  role_blend) into ONE navigation.cjs round-trip; it is READ-ONLY over `room.db` +
  `USER.md` (it does NOT call the corpus -- `prior_research` is a documented
  placeholder the driver fills via the Phase 130.5 cache + Pinecone dedup at Stage
  4). Both modules take a caller-owned `db` handle (and `getResearchPreflight` also
  a `roomDir` for the roomDir-keyed reads); NEITHER requires `node:sqlite` and
  NEITHER opens `room.db` itself, so both carry zero direct `room.db` open and stay
  inside the `lib/core/navigation/` allow-list with zero substrate bypass (a
  source-grep test in `tests/test-131-substrate.cjs` enforces the no-direct-sqlite
  invariant). The CONTRADICTS / SUPERSEDES cascade edges these surfaces feed are
  added additively to `ALLOWED_EDGE_TYPES` (extending the shipped 130-01 INFORMS /
  REJECTED_BECAUSE vocabulary); cascade-edge targets are canonical `correlation_ids`
  (Phase 130.7), not raw names, so edges do not fork across cross-label duplicates.

- **Phase 239-06 (2026-07-30, BRAIN-03 decision record, NOT an export
  addition).** `brain-client.sendPacket` is the SOLE typed-packet wire path
  into the Brain (the M11 export list above governs `room.db`, the local
  substrate; `sendPacket` is a Brain-substrate function and is not itself an
  M11 export, so this entry records a decision, not a contract change --
  `sendPacket` is not being added to or removed from any surface). As of this
  date it has ZERO production consumers: a full census across `lib/`,
  `scripts/`, `bin/` and `pipelines/` found no production `sendPacket(` call
  site. In place of a consumer, the recorded decision is explicit: `sendPacket`
  is PARKED rather than wired, because wiring it to a real production job is
  net-new feature work, out of scope for Phase 239's remediation-only
  milestone. Consequence: the PB8-10 classifier belt inside `sendPacket`
  (`lib/core/brain-client.cjs`) is correct code sitting on a path no
  production caller reaches, and must NOT be counted as live Part 8 coverage
  -- the live in-process Part 8 coverage on the Brain door is sibling plan
  239-05's raw-field classify-before-sanitize-before-interpolate guard in
  `hatAwareRecommend()` and `suggestValidationSteps()`. The dated park note
  lives at the call surface, immediately above `async function sendPacket(` in
  `lib/core/brain-client.cjs`; this amendment is its doc-side twin, and the
  two must not diverge. **Re-open condition:** the first real production
  `sendPacket(` caller, caught by the existing D-08 layer-2 pre-commit guard
  (`scripts/check-schema-aliases.cjs --check-sendpacket`, which requires any
  new caller to be lexically preceded by `buildBrainPacket(`) and by
  `tests/test-239-sendpacket-parked.cjs`'s census, which goes red the day one
  appears.

## Reuse-vs-build decision (Canon Part 7)

**Decision (2026-05-30):** The new `scripts/check-substrate.cjs` (Plan 02) SUPERSEDES
the pre-existing `scripts/check-schema-aliases.cjs --check-chokepoint` subcommand.

**Context.** A `--check-chokepoint` guard ALREADY EXISTS at
`scripts/check-schema-aliases.cjs` (the `checkChokepoint()` function at lines 374-401,
dispatched by the `--check-chokepoint` argument at line 488). It scans staged files for
relative or bare-absolute `require()` of `room-db` / `lazygraph-ops` / `memory-ops`
against the `ALLOWED_DIRECT_IMPORT` allow-list (lines 305-320) and the `BANNED_PATTERNS`
list (lines 322-333). But the live pre-commit hook never invokes it; it runs only
`--check-sendpacket`.

**Why supersede, not extend.** `check-substrate.cjs` is a strict superset. It catches
every `--check-chokepoint` require pattern PLUS the `openGraph` openers PLUS raw
`INSERT INTO nodes` / `edges` / `memory_event` outside the chokepoint PLUS direct
`sqlite` / `better-sqlite3` require PLUS Cypher user-content interpolation (M4). Shipping
a second overlapping guard is surface area without integration, which the Moat Mandate
names as technical debt. One guard that is a strict superset is the smallest correct
surface.

**Retirement plan.** `--check-chokepoint` is NOT deleted in Phase 128. It stays in
`scripts/check-schema-aliases.cjs` as a no-op-compatible alias so any external
invocation keeps working. What changes (in Plan 03) is the LIVE pre-commit hook: it
stops calling `--check-chokepoint` and calls `scripts/check-substrate.cjs --diff`
against staged files instead. The alias is removed only in a later phase, after one
release confirms no external caller depends on it.

**Binding effect.** This decision binds Plan 02 (the guard MUST be a strict superset of
`--check-chokepoint`, never a parallel partial overlap) and Plan 03 (the hook swaps the
call from `--check-chokepoint` to `check-substrate.cjs --diff`).

## Compliance vs violation worked examples

**Compliant.** A module that does `const nav = require('../core/navigation.cjs')` and
calls `nav.writeEdge(...)` to add a typed cascade edge, or `nav.logMemoryEvent(db, ...)`
to append a memory event, is compliant. It touches `room.db` only through the M11
surface, so the provenance schema, the truth-state transitions, and the memory_event
log all stay intact. This satisfies M2, M3, and M11.

**Violation A (the #1 production bypass).** `lib/core/lazygraph-ops.cjs` opens `room.db`
via its `openGraph` path and runs un-provenanced `INSERT INTO nodes (id, type,
properties)` against the bare 3-column schema it defines at lines 33-37 (`id`, `type`,
`properties` only). This is the real production graph writer, opened by roughly 15
scripts via `openGraph`. It writes a `nodes` schema that diverges from the Phase-109
provenance schema (which adds `source_path`, `review_status`, and truth-state columns
and is created only by `openRoomDb`, never by `openGraph`). The result is TWO divergent
`nodes` schemas on the same `room.db`, reproduced live as `NOT NULL constraint failed:
nodes.source_path`. It breaks M1 (one owning substrate, one schema), M2 (read and write
only via navigation.cjs), and M11 (the door is bypassed entirely).

**Violation B.** A raw `fs.readFile` of a `room.db` path from any module outside
`lib/core/navigation.cjs` reads the local graph without the chokepoint. It breaks M2:
the navigation surface, not the filesystem, is the only legitimate read path.

**Violation C.** A Cypher `MATCH` that interpolates a user-content variable into the
query string (for example, splicing an artifact body or a meeting transcript into the
MATCH clause) breaks M4 and Canon Part 8. Aura access must be a parameterized read that
binds only generic handles, never user bytes.

## Known-backlogged boundary item (H5)

The Phase 110 Brain Context Packet schema (`data/brain-packet-schema.json`) leaves the
`summary` and `explanation` fields as UNBOUNDED `string` types (no maxLength, no
pattern). This is a latent Canon Part 8 value-space leak: the schema does not
structurally prevent user-content bytes from being placed in those fields. The fix
(bounding or enumerating those fields) is BACKLOGGED and is NOT in scope for Phase 128.

The leak is latent in the schema, not active in the live path. The 2026-05-30 review
confirmed the LIVE Brain path (`lib/core/brain-derivation.cjs`) is genuinely clean: it
sends hashes (sha256), frozen enum scalars, and clamped floats only. The ADR names this
item so it is tracked, not silently omitted.

## Scope boundary

Phase 128 is the CONTRACT plus the GUARD. It is NOT the migration. The actual
schema-unification refactor (collapsing the bare `lazygraph-ops` schema into the
Phase-109 provenance schema) and the spine-script rewrites are owned by Phase 129 /
129.5 / 130, per the CONTEXT Open Decisions (this ADR is the contract, not the
backfill).

The known violations that the Plan 03 baseline report will enumerate, and that
downstream phases own, include: the roughly 15 `openGraph` openers (via
`lib/core/lazygraph-ops.cjs`), `scripts/hsi-to-graph.cjs` (raw SQL via `conn.prepare`),
and the hats persistence path (`hat-persistence.cjs`, filesystem writes to
`.mindrian/hats/{color}/STATE.md` instead of `room.db`). Plan 02 produces an
informational baseline report over these; Plan 03 makes the guard hard-fail on net-new
violations. None are fixed in Phase 128.
