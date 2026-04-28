---
phase: 94-v1-11-2-tester-driven-fixer
plan: "02"
subsystem: rs-discovery-engine
tags: [rs-fetch, rs-discovery-engine, rs-sqlite-mirror, thesis, lawrence-reproducer, miriam-kaplan-qa, canon-part-4, canon-part-7, tdd, plan-deviation]

# Dependency graph
requires:
  - phase: 89-reverse-salient-engine
    provides: rs-discovery-engine.cjs Phase 4 Synthesis loop + theses[] generation
  - phase: 89.3-mind-map-and-aura-schema
    provides: rs-sqlite-mirror.writeDiscovery + REQUIRED_FIELDS schema authority
  - phase: 89.5-engine-and-nl-graph
    provides: rs-thesis-generator string-template return contract
provides:
  - "scripts/rs-discovery-engine.cjs Phase 4 Synthesis post-loop merge (theses[i] -> breakthroughs[i].thesis) so writerPayload always carries thesis on the success branch"
  - "scripts/rs-discovery-engine.cjs empty-fallback envelope thesis: 'no_thesis' sentinel string so writerPayload always carries thesis on the empty branch"
  - "lib/memory/rs-discovery-engine.test.cjs 3-fixture regression fence (T1 success-path merge, T2 empty-path stub, T3 e2e tier 0 sqlite write)"
affects:
  - 94-03 brain-mcp-server-resolution (consumes the same writerPayload schema; unblocked downstream consumer)
  - 94-10 v1.11.2-release-gate (Phase 94 closure depends on this plan landing)
  - 91-navigation-engine (decision-trace records rs-fetch fire_skill events; unblocked end-to-end pipeline allows real telemetry)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Producer-side merge fix that honors consumer schema authority. rs-sqlite-mirror REQUIRED_FIELDS at line 61 stays untouched; producer composes existing thesisGenerator output into the breakthrough envelope"
    - "Sentinel string for empty-payload fallback ('no_thesis') instead of object stub. Consumer validateRequiredFields requires non-empty STRING per typeof + length check"
    - "Defensive coercion in merge loop: non-string thesis (e.g., {error, reason} envelope from rs-thesis-generator on bad input) falls through to the same 'no_thesis' sentinel so the consumer schema is honored even on degenerate upstream input"
    - "Test seam reuse: opts._test_mocks shallow-merge pattern (rs-discovery-engine line 136-149) lets fixtures inject deterministic mocks per phase module without monkey-patching require's cache"

key-files:
  created:
    - lib/memory/rs-discovery-engine.test.cjs
    - .planning/phases/94-v1-11-2-tester-driven-fixer/94-02-rs-fetch-thesis-merge-fix-SUMMARY.md
  modified:
    - scripts/rs-discovery-engine.cjs (+32 lines; merge loop after Phase 4 Synthesis + empty-fallback envelope thesis sentinel + JSDoc tying both to consumer schema authority and plan deviation)
    - lib/memory/run-feynman-tests.cjs (+12 lines; TEST_FILES registration with Canon Part 7 + Part 4 traceability comment)

key-decisions:
  - "Plan deviation locked-in: empty-fallback shape is sentinel STRING 'no_thesis', not the plan's locked-decision object stub {summary: '', confidence: 0, evidence_refs: []}. Reason: consumer validateRequiredFields at lib/core/rs-sqlite-mirror.cjs line 121-130 requires every REQUIRED_FIELD to be a non-empty STRING. Producer rs-thesis-generator (lib/core/rs-thesis-generator.cjs line 167-176) returns a string on the success path. Producer + consumer agree on string; the plan's <interfaces> block had a speculative shape that did not match either side. Approved by user during execution."
  - "T3 deviation locked-in: programmatic E2E (in-process runDiscovery with mocked upstream + real sqliteMirror) instead of plan's prescribed CLI child_process spawn. Reason: CLI spawn hits real Tavily / Semantic Scholar / patents fetchers and is environment-dependent (network + rate limits); programmatic path tests the identical write code (sqliteMirror.writeDiscovery -> lazygraph.openGraph -> INSERT OR REPLACE) deterministically."
  - "Consumer schema authority preserved. rs-sqlite-mirror.cjs REQUIRED_FIELDS at line 61 unchanged. The producer side composes a complete envelope; the consumer side stays the source of truth for shape validation."
  - "Defensive coercion in merge loop: typeof + length guard on theses[i] before assignment. rs-thesis-generator.generateThesis can return {error, reason} envelope on validation failure; defensive coercion routes that case to the same sentinel as the empty-fallback branch."
  - "Mocks include fetcherExperts.mapExperts (sync, not fetchExperts async); deviation discovered during RED run at line 330 of rs-discovery-engine.cjs and fixed inline before continuing."

patterns-established:
  - "Pattern: Producer-side compose-and-comply for schema gates. When a consumer declares a REQUIRED_FIELDS contract, the producer fits the contract by composing existing module output rather than relaxing the consumer. Canon Part 7 reuse before build."
  - "Pattern: Test seam reuse for deterministic E2E. rs-discovery-engine.cjs ships an opts._test_mocks shallow-merge surface; new fixtures inject mocks for network-dependent phases and let pure-deterministic phases (rs-thesis-generator) and write-path phases (rs-sqlite-mirror) run for real. Future RS pipeline regressions land here without touching production wiring."
  - "Pattern: Plan-spec divergence escalation. When a plan's <interfaces> block contradicts ground truth, halt before writing tests, document evidence (consumer line numbers + producer return shape), surface to user with concrete options. The plan author's intent (writerPayload always carries thesis) is preserved even when the prescribed shape is wrong."

requirements-completed: []

# Metrics
duration: 38min
completed: 2026-04-28

---

# Plan 94-02 Summary

## QA reproducer (Lawrence's harness, 2026-04-28)

Lawrence's QA harness adopted the Dr. Miriam Kaplan persona (CU Boulder JILA, NV-diamond magnetometry) and ran the v1.11.0 test matrix against a fresh install. Phase 4 Test 4.2 prescribed:

```
Run /mos:rs-fetch "NV-diamond magnetometry biomedical sensing"
  - Phase Gate-style transcript renders
  - Files results to a structured location in the room
  - Exit code 0
  - At least one VERDICT line in the transcript
```

Pre-94-02 reproducer (root cause):

```
$ node scripts/rs-discovery-engine.cjs "NV-diamond magnetometry biomedical"
TypeError: rs-sqlite-mirror: missing required field: thesis
    at validateRequiredFields (lib/core/rs-sqlite-mirror.cjs:127:13)
    at writeDiscovery (lib/core/rs-sqlite-mirror.cjs:349:3)
exit: 1
```

Post-94-02 (this plan):

```
$ cd /tmp/rs-fetch-94-02-smoke
$ node /home/jsagi/MindrianOS-Plugin/scripts/rs-discovery-engine.cjs "test topic 94-02"
... (full bundle JSON) ...
exit: 0
```

## Files modified (2 production + 1 test infra + 1 SUMMARY)

```
scripts/rs-discovery-engine.cjs           +32 lines   GREEN
lib/memory/rs-discovery-engine.test.cjs  +322 lines   NEW (RED + GREEN coverage)
lib/memory/run-feynman-tests.cjs          +12 lines   registration
.planning/.../94-02-...-SUMMARY.md          new       this file
```

## Test count + Feynman baseline delta

```
rs-discovery-engine: 3/3 tests passed
  T1 success-path merge       PASS  (writerPayload.thesis === mocked-thesis-string-94-02)
  T2 empty-path stub          PASS  (writerPayload.thesis === 'no_thesis')
  T3 e2e tier 0 sqlite write  PASS  (room.db nodes table COUNT > 0; no TypeError)

Feynman runner: baseline +1 fixture file
  Pre-94-02 baseline:  101 fixtures (per Phase 89.5 closure note in STATE.md)
  Post-94-02 baseline: 102 fixtures (Plan 94-02 adds rs-discovery-engine.test.cjs)

  Suite result: 100/102 passed, 0 skipped, 2 failed
  The 2 failures are inherited from Phase 89.4 chain-wiring (per Phase 89.5
  STATE.md note "NET IMPROVEMENT (4 -> 2 inherited failures from 89.4)").
  Pre- and post- 94-02 failure count: identical. Zero regressions introduced.
```

## Canon traceability

**Canon Part 7 (Reuse Before Build).** The producer composes the existing `thesisGenerator.generateThesis` output (string return) into the existing `breakthroughs[i]` envelope. No new methodology command, no new MCP tool, no new schema. Consumer `rs-sqlite-mirror.cjs REQUIRED_FIELDS` at line 61 is the schema authority and stays unchanged. The justification bar for net-new capability is met (zero net-new surface).

**Canon Part 4 (Every Choice Is Graph Data).** rs-discovery-engine writes RSDiscovery rows into the local room graph (per Phase 89 reverse-salient-engine contract). Pre-94-02, the writer threw before any row landed; the graph edge never fired. Post-94-02, every successful tier 0 run lands at least one node row in `<room>/.mindrian/room.db` nodes table. Discovery becomes durable graph data on the room side; the Brain side stays untouched (Canon Part 8 boundary preserved).

## End-to-end smoke evidence

```
$ cd /tmp/rs-fetch-94-02-smoke && node /home/jsagi/MindrianOS-Plugin/scripts/rs-discovery-engine.cjs "test topic 94-02" 2>&1 | tail -5
"confidence": 0,
      "reasoning": "no rule matched"
    }
  ]
}
EXIT: 0
```

Empty-fallback path proven (zero fetchers returned data; engine fell through to the empty-fallback envelope; sqliteMirror accepted thesis: 'no_thesis'; bundle JSON returned cleanly to stdout).

## Plan deviations (locked-in)

1. **Empty-fallback shape: sentinel string instead of object stub.** Plan locked `{summary: '', confidence: 0, evidence_refs: []}`. Implementation uses `'no_thesis'` (non-empty string sentinel). Reason: consumer validateRequiredFields at lib/core/rs-sqlite-mirror.cjs line 121-130 requires non-empty STRING per REQUIRED_FIELD. Plan's `<interfaces>` block claimed `generateThesis(...) -> {summary, confidence, evidence_refs}` but the actual return at lib/core/rs-thesis-generator.cjs line 167-176 is a STRING. Producer + consumer agree on string; the plan's shape was speculative. Surfaced to user, A-path approved before any code lands.

2. **T3 implementation: programmatic E2E instead of CLI child_process spawn.** Plan prescribed `node scripts/rs-discovery-engine.cjs <topic>` via `execFileSync`. Implementation calls `runDiscovery()` in-process with mocked network phases + real `thesisGenerator` + real `sqliteMirror`. Reason: CLI path hits Tavily / Semantic Scholar / patents fetchers and is environment-dependent. Programmatic path tests the identical write code path deterministically. Spirit of the verify (writer fires, sqlite row lands, no TypeError) preserved.

3. **Mocks include `fetcherExperts.mapExperts` (sync) not `fetchExperts` (async).** Plan's `<interfaces>` block was silent on this; correct method name resolved by reading rs-discovery-engine.cjs line 330 during RED run.

## Closure

Plan 94-02 ready for 94-10 release-gate dependency closure. /mos:rs-fetch tier 0 end-to-end pipeline now produces:
- writerPayload always carries thesis (success + empty branches both honored)
- sqliteMirror.writeDiscovery accepts the payload (REQUIRED_FIELDS satisfied)
- room.db nodes table receives at least one row per run
- CLI exit code 0 on the empty-fallback path (no network, no Brain, no fetchers)

Lawrence's QA harness Test 4.2 (rs-fetch exit 0 + Phase Gate transcript + structured filing) is unblocked.

The 2 inherited Feynman failures from Phase 89.4 chain-wiring are pre-existing and not in scope for this plan; they will be addressed in 94-10 release-gate plan if they block tag promotion.
