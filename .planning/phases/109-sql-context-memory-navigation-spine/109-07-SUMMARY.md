---
phase: 109-sql-context-memory-navigation-spine
plan: "07"
subsystem: navigation
tags: [brain-packet-builder, canon-part-8, scalar-policy, sha256-hashing, hsi-band, navigation-api]

requires:
  - phase: 109-sql-context-memory-navigation-spine/03-memory-events
    provides: findRecentChanges(db, sinceEpochMs, opts) returning memory_event projections
  - phase: 109-sql-context-memory-navigation-spine/04-neighborhood
    provides: getNeighborhood(db, focusNodeId, opts) recursive CTE; navigation.cjs chokepoint with stubs
  - phase: 109-sql-context-memory-navigation-spine/05-insights
    provides: findContradictions, findUnsupportedClaims, findRelevantOpportunities (with HSI scoring)

provides:
  - lib/core/navigation/packet.cjs - buildBrainPacket(db, job, focusNodeId, opts) returning D-06 shape; surface_banked_opportunities scalar shaper; shortText helper
  - lib/core/navigation.cjs - buildBrainPacket stub replaced with live re-export from packet.cjs (10 of 13 LIVE; storeBrainSuggestions + getRoomHomeView + 1 internal stay stubbed)
  - tests/test-navigation-packet-builder.cjs - 10 GREEN sub-tests covering shape, defaults, truncation, topK, scalar policy, constraints literal, token budget
  - tests/test-navigation-packet-part8-leak.cjs - 8 GREEN tripwire assertions on JSON.stringify output (no body leak, no absolute paths, no email, no transcript-like long strings, id_hash 12-hex, generic tags only, hsi_band enum, composite_score 2-decimal rounding)

affects:
  - 109-08 (storeBrainSuggestions replaces stub - reads brain response and writes proposed-status nodes; Plan 109-07 leaves the stub in place)
  - 109-09 (getRoomHomeView replaces stub - consumes buildBrainPacket as nextMove substrate)
  - Phase 110 (Brain Context Packets - wraps buildBrainPacket with validateAndSendBrainPacket schema validator)
  - Phase 112 (GraphRAG Retrieval - consumes packet output for retrieval staging)

tech-stack:
  added: []
  patterns:
    - "5-tripwire pattern from Phase 90 buildBrainQueryContext inherited verbatim: hashed ids + HSI bands + rounded scores + summary truncation + JSON.stringify regex scan"
    - "Safe-shape projection mappers (safeNodeProjection / safeContradictionProjection / safeUnsupportedProjection / safeRecentChangeProjection) are the single chokepoint where helper outputs become packet payload; raw bodies / properties / transcripts NEVER bypass these mappers"
    - "surface_banked_opportunities sha256-hashes opportunity ids (12-char hex slice) so Brain wire never carries raw user-content opportunity ids"
    - "shortText helper truncates to 117+'...' when > 120 chars (4-byte ellipsis budget per RESEARCH section 7.1 max_tokens=1200 approximation)"
    - "_mocks seam: opts._mocks.jtbd and opts._mocks.operator override the require() calls for hermetic testing (mirrors Plan 109-02 + 109-05 pattern; the test mocks return {current: ...}-shaped state)"

key-files:
  created:
    - lib/core/navigation/packet.cjs
    - .planning/phases/109-sql-context-memory-navigation-spine/109-07-SUMMARY.md
  modified:
    - lib/core/navigation.cjs (require packet module + swap buildBrainPacket stub for live re-export; 1 of 3 stubs replaced)
    - tests/test-navigation-packet-builder.cjs (Wave 0 stub replaced with 10 GREEN sub-tests)
    - tests/test-navigation-packet-part8-leak.cjs (Wave 0 stub replaced with 8 GREEN tripwire assertions)

key-decisions:
  - "Identity table insert in test fixture uses (key, value, updated_at) per memory-ops.cjs schema NOT NULL constraint; the plan's stripped-down INSERT was a Rule 3 blocker fixed inline so the room_stage round-trip test would compile"
  - "shortText candidates ordered (summary, claim, title, text); decision nodes seed properties.summary; claim nodes seed properties.summary; assumption nodes seed properties.claim - each maps cleanly to the first non-empty candidate"
  - "safeNodeProjection re-fetches properties via db.prepare instead of carrying neighborhood properties through; this is the trade between 1 extra SELECT per nearest_claim row and the structural guarantee that body/transcript/email never enter the projection scope"
  - "surface_banked_opportunities tag filter (length <= 30) is a generic-tag tripwire: any opportunity with a tag longer than 30 chars (likely raw problem text) is dropped before the packet ships; tripwire 6 in test-navigation-packet-part8-leak.cjs asserts this"
  - "buildBrainPacket reads identity.value WHERE key='stage'; falls back to 'unknown' (RESEARCH section 11.9 Open Question recommendation a). No new identity row migration; future plans may seed it"

patterns-established:
  - "Wave 3 builder pattern: re-uses Plan 109-04 getNeighborhood + Plan 109-05 findContradictions / findUnsupportedClaims / findRelevantOpportunities + Plan 109-03 findRecentChanges; ZERO new SQL queries (Canon Part 7)"
  - "Phase 109 ships the BUILDER; Phase 110 ships the SCHEMA VALIDATOR (validateAndSendBrainPacket). Phase 109 does NOT validate job vocabulary; Phase 110 enforces the closed job set"
  - "Phase 109-08 storeBrainSuggestions and Phase 109-09 getRoomHomeView remain stubs in navigation.cjs; the chokepoint module now has 10 LIVE re-exports + 2 remaining notImplementedYet factories"

metrics:
  duration: ~10 minutes
  completed: 2026-05-05
  json_packet_length_chars: 2769
  json_packet_approx_tokens: 692
  budget_ratio_percent: 57.7
  builder_tests_passing: 10
  part8_tripwires_passing: 8
  navigation_stubs_remaining: 2
  navigation_live_exports: 11
---

# Phase 109 Plan 07: Brain Packet Builder Summary

Brain Packet Builder ships at `lib/core/navigation/packet.cjs` with `buildBrainPacket(db, job, focusNodeId, opts)` returning the D-06 shape; `navigation.cjs` chokepoint swaps the Plan 109-04 stub for the live re-export. Canon Part 8 LOAD-BEARING preserved by construction: zero raw room content egress, surface_banked_opportunities sha256-hashes opportunity ids and bands HSI scores, every helper output passes through a safe-shape projection mapper before reaching the packet payload.

## Deliverables

| Deliverable | File | Lines | Status |
|---|---|---|---|
| buildBrainPacket builder | lib/core/navigation/packet.cjs | 178 | LIVE |
| surface_banked_opportunities scalar shaper | lib/core/navigation/packet.cjs (export) | inline | LIVE |
| shortText helper (120-char truncation) | lib/core/navigation/packet.cjs (export) | inline | LIVE |
| navigation.cjs chokepoint live re-export | lib/core/navigation.cjs | 1 stub replaced | LIVE |
| Builder test suite | tests/test-navigation-packet-builder.cjs | 200 | 10/10 GREEN |
| Part 8 leak tripwire suite | tests/test-navigation-packet-part8-leak.cjs | 105 | 8/8 GREEN |

## Acceptance Verification

```text
node tests/test-navigation-packet-builder.cjs
  PASS test1_shape
  PASS test2_packetVersion
  PASS test3_jobPassthrough
  PASS test4_roomStageDefault
  PASS test5_activeContextDefaults
  PASS test6_focusSummaryTruncation
  PASS test7_nearestClaimsTopK
  PASS test8_bankedOpportunitiesScalar
  PASS test9_constraintsLiteral
  PASS test10_tokenBudget
  test-navigation-packet-builder: 10/10 passed

node tests/test-navigation-packet-part8-leak.cjs
  test-navigation-packet-part8-leak: PASS (8 tripwires)

node -e "const n=require('./lib/core/navigation.cjs'); console.log(typeof n.buildBrainPacket);"
  function

JSON.stringify(packet) on standard fixture
  json_len = 2769 chars
  approx_tokens = 692.3 (57.7% of 1200 budget)

grep -lP "[\x{2014}\x{2013}]" packet.cjs navigation.cjs builder-test.cjs leak-test.cjs
  (no output -- zero em-dashes or en-dashes)
```

## Canon Part 8 Tripwire Status (5-tripwire pattern from Phase 90)

| Tripwire | Mechanism | Status |
|---|---|---|
| 1. surface_banked_opportunities sha256-hashes ids | crypto.createHash('sha256').digest('hex').slice(0, 12) | ENFORCED + tested (tripwire 5) |
| 2. NEVER includes properties.body / .claim / .evidence raw text | safeNodeProjection / safeContradictionProjection / safeUnsupportedProjection re-fetch properties only to compute shortText summary | ENFORCED + tested (tripwire 1) |
| 3. JSON.stringify regex scan for forbidden keys | tests/test-navigation-packet-part8-leak.cjs tripwires 1-4: no body, no /home/ paths, no emails, no >500-char strings | ENFORCED + tested |
| 4. storeBrainSuggestions sets review_status='proposed' always | OUT OF SCOPE for 109-07 (Plan 109-08 owns this stub; this plan leaves it as notImplementedYet) | DEFERRED to 109-08 |
| 5. Phase 108 invariant SQL post-ingestion | OUT OF SCOPE for 109-07 (Plan 109-08 ships ingestion + invariant test) | DEFERRED to 109-08 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Identity table insert missing updated_at column**
- Found during: Task 1 RED test authoring
- Issue: The plan's test fixture used `INSERT OR REPLACE INTO identity (key, value) VALUES (...)` but the schema in `lib/core/memory-ops.cjs` declares `updated_at TEXT NOT NULL`. The test would fail to compile / fail at runtime with a NOT NULL constraint violation.
- Fix: Changed the test fixture to `INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)` with `new Date().toISOString()` as the third argument. Mirrors the working pattern in `lib/core/migrations/phase-109-session-focus.cjs:90` and `lib/core/memory-ops.cjs:144`.
- Files modified: tests/test-navigation-packet-builder.cjs (test4_roomStageDefault makeRoom helper)
- Commit: 3a1dc61

No other deviations. Plan 109-07 executed exactly as written aside from the schema-NOT-NULL fix above.

## Authentication Gates

None. Plan executed end-to-end without external service interaction.

## Parallel Worktree Discipline

Plan 109-07 ran in worktree-agent-a6d547e98cd8a20c2 in parallel with sibling Plan 109-08 and Plan 109-09 worktrees. Files modified by this plan:
- lib/core/navigation/packet.cjs (NEW; only this plan touches it)
- lib/core/navigation.cjs (only the buildBrainPacket stub line replaced; storeBrainSuggestions and getRoomHomeView stubs left untouched for 109-08 and 109-09)
- tests/test-navigation-packet-builder.cjs (only this plan touches it)
- tests/test-navigation-packet-part8-leak.cjs (only this plan touches it)

The merge with main pulled in 109-04, 109-05, 109-06 outputs (neighborhood, insights, chokepoint hook) which Plan 109-07 depends on per the wave 3 prerequisites.

All commits used `--no-verify` per the parallel-execution constraint.

## Next Plans Unblocked

- **Plan 109-08 (Brain Result Ingestion)** -- file-disjoint with this plan; can proceed in parallel within Wave 3.
- **Plan 109-09 (Room Home Driver)** -- depends on this plan completing because getRoomHomeView consumes buildBrainPacket as nextMove substrate.

## Self-Check

Verified:
- lib/core/navigation/packet.cjs exists and exports buildBrainPacket + surface_banked_opportunities + shortText
- lib/core/navigation.cjs require('./navigation/packet.cjs') present + live re-export wired
- tests/test-navigation-packet-builder.cjs exits 0 (10/10 GREEN)
- tests/test-navigation-packet-part8-leak.cjs exits 0 (8 tripwires GREEN)
- Commits: 3a1dc61 (RED tests) + 7ba6c60 (GREEN packet.cjs + chokepoint wiring)
- Zero em-dashes / en-dashes across all 4 files

## Self-Check: PASSED
