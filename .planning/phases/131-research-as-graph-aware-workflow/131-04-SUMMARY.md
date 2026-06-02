---
phase: 131
plan: 04
subsystem: research-pipeline-wiring / filing-gate / teaching-graph-resolver
tags: [research, findings-wirer, f1-selector, correlation-resolver, cascade-edges, evidence-claim, rejection-as-data, phase-136-lock, tdd]
requires:
  - Phase 131-01 navigation.writeEvidenceClaim (the LOCKED Phase 136 EvidenceClaim node writer; review_status proposed)
  - Phase 131-01 navigation.writeEdge + ALLOWED_EDGE_TYPES INFORMS / CONTRADICTS / SUPERSEDES / REJECTED_BECAUSE (the closed cascade vocabulary)
  - Phase 131-01 navigation.logMemoryEvent re-export + research_filed / research_rejected / research_deferred EVENT_TYPES members
  - Phase 131-03 runSourceLens findings shape ({ source, url, retrieved_at, evidence_tier, relevance, summary, title })
  - Phase 130.7 correlation.computeCorrelationId (the REAL 2-arg hash) + correlation-label-index.parseLabelIndex / serializeLabelIndex (the REAL index exports)
  - lib/brain/chain-recommender.cjs no-fork canonical-pick heuristic (REUSED for a single name; Framework-preferred, most-edged)
  - lib/hmi/selector-dispatcher.cjs pickShape F.1 sub-shape (the gate-as-write-node contract MIRRORED, not forked)
provides:
  - "lib/lens-engine/correlation-resolver.cjs resolveCorrelation(name, opts): the consumer-side teaching-graph target resolver built from 130.7's REAL exports (the resolver 130.7 itself does not ship)"
  - "lib/core/research-filing-selector.cjs buildFilingSelector(finding, candidateSections, opts): the Stage 6 F.1 filing gate mirroring selector-dispatcher (strict-superset forward contract for Phase 136)"
  - "lib/core/findings-wirer.cjs wireAccept / wireReject / wireDefer: the Stage 7 typed-node + cascade-edge writer (local-node-id for local targets; correlation_id for teaching-graph targets)"
affects:
  - Plan 131-05 command orchestration (consumes the selector -> gate -> wirer flow after the driver)
  - Phase 136 render spine (consumes the EvidenceClaim node + the 4 cascade predicates + the F.1 gate widget as a strict superset, without a migration)
tech-stack:
  added: []
  patterns:
    - "consumer-side resolver composition (build the missing resolver from two REAL shipped exports; never reference a phantom dotted helper)"
    - "single resolveTarget chokepoint enforcing the local-vs-teaching-graph branch in one place"
    - "mirror-not-fork selector (route through the shipped dispatcher pickShape F.1; zero bespoke AskUserQuestion construction)"
    - "rejection-as-data (file the rejected finding as a proposed EvidenceClaim node so the REJECTED_BECAUSE edge has a real FK source)"
    - "caller-owned db handle (zero node:sqlite require -> zero substrate bypass; navigation.cjs only door)"
    - "test seam defaults (_resolveCorrelation defaults to the REAL resolver; _resolveLocalTarget to the section-node convention; both overridable)"
    - "RED-first behavior suite exercising the REAL resolver against a serializeLabelIndex fixture (not an injected stub)"
key-files:
  created:
    - lib/lens-engine/correlation-resolver.cjs
    - lib/core/research-filing-selector.cjs
    - lib/core/findings-wirer.cjs
    - tests/test-131-findings-wirer.cjs
  modified: []
decisions:
  - "The rejected finding is STILL filed as a proposed EvidenceClaim node (the REJECTED_BECAUSE source). The edges table FKs BOTH endpoints to nodes(id) with foreign_keys ON, so a synthetic rejection-handle source would fail the FK. Filing the node makes rejection a first-class graph datum per Canon Part 4 (the why-not node + edge teach the next dedup) and satisfies the FK. wireReject still writes ZERO INFORMS edges."
  - "The LOCAL section-node id convention is 'section:' + section (mirrors lib/core/navigation-engine-offer.cjs); a fully-qualified id carrying a ':' namespace prefix passes through. There is no generic navigation node-lookup chokepoint to query, so the convention IS the resolution."
  - "The selector mirrors selector-dispatcher by routing through pickShape({requestedShape:'F.1'}) (the documented entry point that dispatches the F.1 sub-shape via dispatchShapeFSubShape internally). Mode A -> tier 2, Mode B -> tier 1 so the dispatcher's own Mode mapping agrees with the requested mode without re-implementing tier logic; recommend marker stays the dispatcher's >= 0.7 Phase 88.2 invariant."
  - "ZERO new deps: the consumer-side resolver reuses chain-recommender's LABEL_PREFERENCE heuristic + 130.7's computeCorrelationId; the rejection-source idempotency falls back to the EvidenceClaim node-id hash (native polynomial roll, no hashing package)."
metrics:
  duration: ~26m
  completed: 2026-06-02
---

# Phase 131 Plan 04: Stage 6 F.1 Filing Selector + Stage 7 Findings-Wirer Summary

Wired the gate decision over a ranked research finding into typed graph data. Stage 6 is the F.1 filing selector that MIRRORS the shipped `lib/hmi/selector-dispatcher.cjs` (it is NOT a bespoke selector, so Phase 136's gate widget is a strict superset). Stage 7 is the findings-wirer that turns ACCEPT / REJECT / DEFER into an `EvidenceClaim` node (proposed) plus `INFORMS` / `CONTRADICTS` / `SUPERSEDES` / `REJECTED_BECAUSE` cascade edges through `navigation.cjs`, landing local-target edges on the LOCAL `room.db` node id and teaching-graph-target edges on a REAL canonical `correlation_id` resolved consumer-side from Phase 130.7's shipped exports.

## What shipped

| Module | Surface it extends/mirrors (Canon Part 7) | Where |
|---|---|---|
| Consumer-side teaching-graph resolver | COMPOSES 130.7's REAL `computeCorrelationId` + `parseLabelIndex` (130.7 ships no tuple-returning resolver); REUSES `chain-recommender` no-fork pick for a single name | `lib/lens-engine/correlation-resolver.cjs` `resolveCorrelation` |
| Stage 6 F.1 filing gate | ROUTES THROUGH `selector-dispatcher.pickShape('F.1', ...)` (the gate-as-write-node forward contract); NOT a bespoke selector | `lib/core/research-filing-selector.cjs` `buildFilingSelector` |
| Stage 7 typed-node + cascade-edge writer | Mirrors the lens-engine `applyAccept` / `applyReject` idiom; writes through `navigation.writeEvidenceClaim` / `writeEdge` / `logMemoryEvent` | `lib/core/findings-wirer.cjs` `wireAccept` / `wireReject` / `wireDefer` |

## Edge-target scoping (the load-bearing design clarification)

- **LOCAL target** (room section / local claim): the edge target is the LOCAL `room.db` node id (`'section:' + section`, the navigation-engine-offer convention). It is NOT a `correlation_id`. Most 131 cascade edges are local-to-local.
- **TEACHING-GRAPH target** (`decision.target_kind === 'teaching-graph'`): the edge target is the canonical `correlation_id` from the consumer-side resolver, so a cascade edge does not fork across cross-label duplicates.

The local-vs-teaching-graph branch is enforced in ONE place: the `resolveTarget(targetSection, targetKind, ctx)` chokepoint. `_resolveCorrelation` defaults to the REAL `lib/lens-engine/correlation-resolver.cjs` resolver (NOT a phantom dotted helper); `_resolveLocalTarget` defaults to the section-node convention; both are overridable for tests.

## Commits

| Task | Type | Hash | Subject |
|---|---|---|---|
| 1 (RED) | test | `2ad1d423` | RED suite (11 assertions, 0/11 RED) for wirer + F.1 selector + teaching-graph resolver |
| 2 (GREEN) | feat | `3771422e` | correlation-resolver + F.1 filing selector (Stage 6, mirrors selector-dispatcher); 5/11 GREEN |
| 3 (GREEN) | feat | `5ee3e354` | findings-wirer (Stage 7; local-node-id + correlation_id targets); 11/11 GREEN |

## Gate-path behavior (Canon Part 4: every choice is graph data)

- **ACCEPT** -> `writeEvidenceClaim` (review_status `proposed`, never auto-confirmed per Canon Part 9 role 5) + `INFORMS` edge to the resolved target (local-node-id OR correlation_id per kind) + `CONTRADICTS` when `decision.kills_claim` + `SUPERSEDES` when `decision.better_tier_than` + a Split reference `INFORMS` to a secondary target + `research_filed` event with url/retrieved_at/evidence_tier provenance.
- **REJECT** -> files the rejected finding as a proposed `EvidenceClaim` (the rejection source node; FK-required) + EXACTLY ONE `REJECTED_BECAUSE` edge carrying the captured reason scalar + url/retrieved_at provenance (open-decision 4 RESOLVED) + `research_rejected` event; ZERO `INFORMS` edges.
- **DEFER** -> `research_deferred` memory_event queued to milestone audit; NO cascade edge.

All memory-event writes go through the `navigation.cjs` RE-EXPORT `navigation.logMemoryEvent` (the chokepoint), NEVER the raw `logEvent`.

## Test results

- `node tests/test-131-findings-wirer.cjs` -> 11/11 GREEN (0/11 RED at Task 1, as required; 5/11 after Task 2; 11/11 after Task 3).
- `bash tests/run-all-131.sh` -> 4 passed / 0 failed / 2 skipped (the Plan 05 isomorphism + e2e suites skip-with-note; the aggregator was pre-registered by Plan 01).
- Zero regression: `run-all-130` 4/4, `run-all-130.7` 7/7, `test-navigation-acceptance` 1/1.
- `node scripts/check-substrate.cjs --baseline` -> CLEAN on all three new modules (none flagged; zero `node:sqlite` / `room-db.cjs` require -- caller owns the db handle).
- Em-dash scan on all three new modules -> zero.

## HARD-GATE confirmation

- **ZERO live Brain writes.** None of the three modules touches Brain. The resolver is PURE over the LOCAL `correlation_labels` body (generic methodology handles + label enums + integer degrees; zero user content; never egresses). `EvidenceClaim` + cascade-edge writes are LOCAL `room.db` via `navigation.cjs` ONLY (Canon Part 9). brain_impact: NONE-NEW honored; a grep for `brain.*write` / `fetch` / `http` / `onrender` / `tavily` across the three files returns zero.
- **ZERO new dependencies.** No npm/pip/cargo install; `package.json` + `package-lock.json` byte-unchanged. Native `node:` built-ins + existing local modules only (the rejection-source idempotency reuses the native polynomial-roll node-id hash, no hashing package).
- **navigation.cjs is the only door.** The wirer requires `lib/core/navigation.cjs` (for `writeEvidenceClaim` / `writeEdge` / `logMemoryEvent`) + `lib/lens-engine/correlation-resolver.cjs` (for the teaching-graph id) ONLY; zero direct `room.db` open.
- **Substrate guard + brain-boundary-scan passed on every commit** (no `--no-verify`; all three commits ran the Phase 128 substrate guard + brain-boundary-scan pre-commit hooks).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header-prose false-positive on the coarse `correlation.resolve` grep**
- **Found during:** Task 2 (verification grep after writing the resolver).
- **Issue:** The module header documented the absence of the phantom interface by NAMING the literal `correlation.resolve` token ("There is NO correlation.resolve ..."), which tripped both the plan's coarse `!/correlation\.resolve/` verify grep and the asserting `test11` source scan despite zero functional surface. This is the identical header-prose pattern auto-fixed in 131-02 and 131-03.
- **Fix:** Rephrased the header prose to "no such dotted helper exists" / "a phantom dotted resolver on the correlation module" so the literal token no longer appears, while preserving the meaning. Zero production-logic change.
- **Files modified:** `lib/lens-engine/correlation-resolver.cjs` (comment only).
- **Commit:** `3771422e`.

**2. [Rule 1 - Bug] REJECTED_BECAUSE edge FK requires a real source node**
- **Found during:** Task 3 (test9 failed: `edge_write_failed`).
- **Issue:** The first wireReject drafted a synthetic `research_rejection:<sid>:<hash>` source-node id for the `REJECTED_BECAUSE` edge. The `edges` table FKs BOTH `source` AND `target` to `nodes(id)` with `foreign_keys` ON, so the synthetic non-existent source failed the FK (the recurring 129/130 FK incident).
- **Fix:** wireReject now files the rejected finding as a proposed `EvidenceClaim` node (via `navigation.writeEvidenceClaim`) and uses that node id as the `REJECTED_BECAUSE` source. This is CANON-ALIGNED (Canon Part 4 rejection-IS-data: the why-not node + its edge teach the next dedup) and satisfies the FK by construction. wireReject still writes ZERO `INFORMS` edges. The plan's "no EvidenceClaim filed for a rejected finding" implementation hint was superseded by the FK reality; the success-criterion (one `REJECTED_BECAUSE` + reason + research_rejected; zero INFORMS) is fully met.
- **Files modified:** `lib/core/findings-wirer.cjs`.
- **Commit:** `5ee3e354`.

No architectural changes (Rule 4 not triggered); no auth gates; no blocking issues beyond the two auto-fixes above.

## Known Stubs

None. The resolver runs the REAL no-fork pick against the REAL `correlation_labels` index (exercised by `test4` / `test7` against a `serializeLabelIndex` fixture, not an injected stub). The selector routes through the REAL shipped dispatcher. The wirer writes real nodes + edges + events through the REAL navigation chokepoint. The `_resolveCorrelation` / `_resolveLocalTarget` seams DEFAULT to the real implementations and are overridable only for test isolation.

## Self-Check: PASSED

- FOUND: lib/lens-engine/correlation-resolver.cjs
- FOUND: lib/core/research-filing-selector.cjs
- FOUND: lib/core/findings-wirer.cjs
- FOUND: tests/test-131-findings-wirer.cjs
- FOUND commit: 2ad1d423
- FOUND commit: 3771422e
- FOUND commit: 5ee3e354
