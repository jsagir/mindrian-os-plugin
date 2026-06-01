---
phase: 131
plan: 01
subsystem: navigation-chokepoint / research-substrate
tags: [research, source-lens, evidence-claim, cascade-edges, forward-contract, phase-136-lock]
requires:
  - Phase 130-01 lens-nodes.cjs (the writeLensFinding INSERT shape + caller-owned-db-handle idiom mirrored by evidence-claim.cjs)
  - Phase 130-01 ALLOWED_EDGE_TYPES INFORMS / REJECTED_BECAUSE (the additive-edge idiom extended here)
  - Phase 109 navigation.cjs chokepoint readers (getActiveFocus / findRecentChanges / findUnsupportedClaims / findBlockingAssumptions)
  - Phase 129-01 spine getCurrentJTBD / getCurrentOperator (event-log-authoritative reads composed by getResearchPreflight)
  - Phase 115 USER.md role_blend (read by getResearchPreflight via user-md-ops)
  - Phase 128 substrate-guard (the /^lib\/core\/navigation\// allow-list both new submodules sit inside)
provides:
  - "writeEvidenceClaim: the LOCKED Phase 136 EvidenceClaim node writer (review_status proposed + source/url/retrieved_at/evidence_tier)"
  - "getResearchPreflight: the batched Stage-1 8-input pre-flight read (one navigation.cjs round-trip)"
  - "CONTRADICTS + SUPERSEDES additive ALLOWED_EDGE_TYPES members (the Stage 7 cascade vocabulary)"
  - "research_filed / research_rejected / research_deferred additive EVENT_TYPES members (the Stage 7 wiring-decision trail)"
  - "tests/run-all-131.sh: the single-owner phase aggregator pre-registering all 6 Phase 131 suites"
affects:
  - Plan 131-03 source-lens driver (consumes getResearchPreflight + the corpus to fill prior_research)
  - Plan 131-04 findings-wirer + F.1 selector (consumes writeEvidenceClaim + CONTRADICTS/SUPERSEDES + the 3 events)
  - Plan 131-05 command orchestration (consumes the full pre-flight -> wire flow)
  - Phase 136 render spine (consumes the LOCKED EvidenceClaim schema + CONTRADICTS predicate without a migration)
tech-stack:
  added: []
  patterns:
    - "additive frozen-Set extension (named-membership delta, never absolute size)"
    - "caller-owned db handle (zero node:sqlite require -> zero substrate bypass)"
    - "composition-not-duplication (getResearchPreflight reuses existing chokepoint readers; zero new SQL)"
    - "RED-first substrate suite + single-owner graceful-skip aggregator"
key-files:
  created:
    - lib/core/navigation/evidence-claim.cjs
    - lib/core/navigation/research-preflight.cjs
    - tests/test-131-substrate.cjs
    - tests/run-all-131.sh
  modified:
    - lib/core/navigation/edges.cjs
    - lib/core/navigation/memory-events.cjs
    - lib/core/navigation.cjs
    - docs/architecture/SUBSTRATE-CONTRACT.md
decisions:
  - "EvidenceClaim is a TRUTH-CLAIM node (NOT carved out): lands review_status proposed; only a human APPROVE promotes it (Canon Part 9 role 5). Deliberate contrast with the 130-01 HatState system-bookkeeping node."
  - "ZERO new deps: the EvidenceClaim node-id idempotency hash is a native polynomial roll over the url string, not a new hashing package."
  - "getResearchPreflight is read-only over room.db + USER.md; prior_research is a documented placeholder the Plan 03 driver fills via the 130.5 cache + Pinecone dedup -- the corpus is NOT called here."
metrics:
  duration: ~8m
  completed: 2026-06-01
---

# Phase 131 Plan 01: Wave-1 Research Substrate + Phase 136 Forward-Contract Lock Summary

Locked the three forward contracts Phase 136 consumes without a migration -- the EvidenceClaim node property schema, the CONTRADICTS / SUPERSEDES cascade-edge predicates (added additively to the closed allow-list), and the batched `navigation.getResearchPreflight` Stage-1 pre-flight read -- as the file-disjoint shared substrate every later Phase 131 plan writes against, plus the single-owner Phase 131 aggregator.

## What shipped

| Contract (LOCKED for Phase 136) | Surface it extends/replaces (Canon Part 7) | Where |
|---|---|---|
| EvidenceClaim node property schema | NEW typed truth-claim node; mirrors the 130-01 `writeLensFinding` INSERT shape (proposed truth-claim, not the HatState system-bookkeeping carve-out) | `lib/core/navigation/evidence-claim.cjs` `writeEvidenceClaim` |
| CONTRADICTS + SUPERSEDES cascade-edge predicates | EXTENDS the shipped 130-01 `ALLOWED_EDGE_TYPES` vocabulary (INFORMS / REJECTED_BECAUSE); never invented per-phase | `lib/core/navigation/edges.cjs` |
| `getResearchPreflight` batched 8-input read | COMPOSES existing 109/129 chokepoint readers into one round-trip; replaces 8 sequential Stage-1 reads (4.8 re-baseline) | `lib/core/navigation/research-preflight.cjs` |
| research_filed / research_rejected / research_deferred | EXTENDS the 130-02 `EVENT_TYPES` additive idiom (the Stage 7 mandatory wiring-decision trail per Canon Part 9) | `lib/core/navigation/memory-events.cjs` |

## Commits

| Task | Type | Hash | Subject |
|---|---|---|---|
| 1 (RED) | test | `12ea612b` | RED substrate suite (14 assertions) + pre-register the full Phase 131 aggregator |
| 2 (GREEN) | feat | `db6287a2` | add CONTRADICTS + SUPERSEDES edges and 3 research events (additive) |
| 3 (GREEN) | feat | `a3e8285c` | evidence-claim writer + getResearchPreflight + M11 amendment |

## Set deltas (named-membership, never absolute size)

- `ALLOWED_EDGE_TYPES`: 8 -> 10 (net-new delta exactly 2: CONTRADICTS, SUPERSEDES). INFORMS / REJECTED_BECAUSE / all prior members byte-unchanged.
- `EVENT_TYPES`: 70 -> 73 (net-new delta exactly 3: research_filed, research_rejected, research_deferred). The lens block + all prior blocks untouched.

## Test results

- `node tests/test-131-substrate.cjs` -> 14/14 GREEN (was 0/14 RED at Task 1, as required).
- `bash tests/run-all-131.sh` -> 1 passed, 0 failed, 5 skipped (the not-yet-created suites skip-with-note; the aggregator is runnable in every wave and exits non-zero only on a PRESENT-suite failure).
- `bash tests/run-all-130.sh` -> 4/4 GREEN (zero regression on the shipped edge/event Sets + lens substrate).
- `bash tests/run-all-130.7.sh` -> 7/7 GREEN (correlation-id contract intact).
- `node tests/test-navigation-acceptance.cjs` -> 1/1 GREEN (the zero-non-SQLite-reads invariant still holds).
- `node scripts/check-substrate.cjs --baseline` -> CLEAN on both new submodules (no bypass; caller-owned db handle, zero `node:sqlite` require).
- Em-dash scan on both new modules -> zero.

## HARD-GATE confirmation

- **ZERO live Brain writes.** No module touches Brain. `getResearchPreflight` is read-only over `room.db` + `USER.md`; `writeEvidenceClaim` writes a LOCAL room.db node only. brain_impact: NONE-NEW honored.
- **ZERO new dependencies.** No npm/pip/cargo install. Native `node:` built-ins + existing modules only. The EvidenceClaim idempotency node-id uses a native polynomial roll over the url string (no new hashing package).
- **navigation.cjs is the only door.** Both new submodules are allow-listed navigation submodules taking a caller-owned db handle; EvidenceClaim writes + (future) cascade edges route through `navigation.cjs`. Cascade-edge targets are canonical `correlation_ids` (Phase 130.7) -- documented in the edge block and the M11 amendment; the Plan 04 wirer resolves the canonical id before `writeEdge`.
- **Substrate guard + brain-boundary-scan passed on every commit** (no `--no-verify`; the Phase 128 substrate guard + brain-boundary-scan pre-commit hooks ran on all three commits).

## Deviations from Plan

None - plan executed exactly as written. No bugs, no missing critical functionality, no blocking issues, no architectural changes. Tasks 1-3 ran in order; RED was confirmed before GREEN.

## Self-Check: PASSED

- FOUND: lib/core/navigation/evidence-claim.cjs
- FOUND: lib/core/navigation/research-preflight.cjs
- FOUND: tests/test-131-substrate.cjs
- FOUND: tests/run-all-131.sh
- FOUND commit: 12ea612b
- FOUND commit: db6287a2
- FOUND commit: a3e8285c
