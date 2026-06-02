---
phase: 131-research-as-graph-aware-workflow
plan: 06
subsystem: research / e2e-release-gate / fan-out-template
tags: [source-lens, e2e, fs-instrument, zero-leak, evidence-claim, correlation-id, rejection-as-data, dedup, feynman-runner, v1.14.0-template, phase-release-gate]

# Dependency graph
requires:
  - phase: 131-02 research-context-extractor
    provides: extractContext (Stage 1+2+3 pre-flight + lens_set)
  - phase: 131-03 source-lens-driver
    provides: runSourceLens (Stage 4 corpus rotation + ranked findings; _fetchCorpus seam)
  - phase: 131-04 research-filing-selector + findings-wirer + correlation-resolver
    provides: buildFilingSelector (Stage 6 F.1 gate) + wireAccept/wireReject/wireDefer (Stage 7) + resolveCorrelation (REAL teaching-graph resolver)
  - phase: 131-01 navigation substrate
    provides: writeEvidenceClaim + getResearchPreflight + CONTRADICTS/SUPERSEDES + 3 research events + run-all-131.sh aggregator
  - phase: 130.7 correlation-id-contract
    provides: computeCorrelationId + serializeLabelIndex/parseLabelIndex (the REAL index exports)
  - phase: 130.5 shared-corpus-cache
    provides: the .mindrian/research-cache the driver fetches cache-first via (the allow-listed E2E cache read)
provides:
  - tests/test-131-e2e.cjs (the 5 E2E tests = the Phase 131 release gate; full pipeline through navigation.cjs with the fs-instrument zero-leak gate)
  - tests/fixtures/phase-131/sample-room/seed.sql (the trimmed seed with FK anchors on BOTH local + teaching-graph targets)
  - lib/memory/run-feynman-tests.cjs Phase 131 block (all 6 suites registered additively)
  - docs/RESEARCH-AS-WORKFLOW-STEP.md (the v1.14.0 fan-out template)
affects: [v1.14.0 source-lens fan-out (13 surfaces), v1.14.0 P9 framework-lens migration, Phase 136 render spine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fs-instrument zero-leak E2E idiom (130-04/129/109): proxy installed BEFORE each flow, leaked non-SQLite reads filtered to EXCLUDE the allow-list asserted empty"
    - "allow-list = USER.md + the 130.5 research-cache (public SIGNAL corpus, never room.db data per Canon Part 8); room.db touched ONLY via navigation.cjs"
    - "fetchCorpus stub seam (_fetchCorpus): the full pipeline drives with zero live network, deterministic findings"
    - "REAL resolver in the gate: test 3 exercises resolveCorrelation (not a stub) over a serializeLabelIndex fixture; INFORMS target == computeCorrelationId(canonical, Framework)"
    - "lens-set inequality (notDeepEqual): contrasting persona + section + JTBD yield structurally different lens_sets"
    - "additive Feynman-runner registration (every prior block byte-unchanged; 32 insertions, 0 deletions)"

key-files:
  created:
    - tests/test-131-e2e.cjs
    - tests/fixtures/phase-131/sample-room/seed.sql
    - docs/RESEARCH-AS-WORKFLOW-STEP.md
    - .planning/phases/131-research-as-graph-aware-workflow/131-06-SUMMARY.md
  modified:
    - lib/memory/run-feynman-tests.cjs
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "The Phase 130.5 on-disk research-cache (.mindrian/research-cache/*.json) is ALLOW-LISTED in the E2E zero-leak gate alongside USER.md. The consume-130.5 contract mandates the driver fetch cache-first; the cache holds PUBLIC SIGNAL corpus snippets (never user content, never room.db data per Canon Part 8), so a cache read is the allow-listed cache the phase CONTRACT names, NOT a LOCAL leak. The zero-leak invariant (room.db reached only via navigation.cjs) is fully preserved."
  - "The teaching-graph correlation_id target node is seeded by test 3 at RUNTIME (not in seed.sql) because the id is a runtime 130.7 hash, not a static SQL literal. The seed.sql header documents this; LOCAL section/claim FK anchors stay in SQL."
  - "Tests 2 and 3 differentiate lens_sets by seeding contrasting room state (focus + jtbd_transitioned event) so the REAL getResearchPreflight returns contrasting context, then assert notDeepEqual -- the lens set is genuinely context-derived, not fixed."

patterns-established:
  - "Pattern 1: the full-pipeline E2E -- extractContext -> runSourceLens (stub) -> buildFilingSelector -> wireAccept/Reject/Defer, all through navigation.cjs under the zero-leak gate; the template every v1.14.0 fan-out surface mirrors"
  - "Pattern 2: the REAL-resolver release-gate assertion -- the gate does not close green on a stub-only correlation path; at least one E2E lands a teaching-graph edge on a real correlation_id"

metrics:
  duration: ~40m
  completed: 2026-06-02
  tasks: 3
  files_created: 4
  files_modified: 3
  commits: 3
---

# Phase 131 Plan 06: 5 E2E Release Gate + Feynman Registration + v1.14.0 Fan-Out Template Summary

Shipped the Phase 131 release gate: 5 instrumented E2E tests that drive the FULL source-lens pipeline (extractContext -> runSourceLens -> buildFilingSelector -> wireAccept/wireReject/wireDefer) end to end ONLY through `navigation.cjs`, with the 130-04 fs-instrument zero-leak gate holding (allow-list = USER.md + the 130.5 research-cache, the external-corpus layer, never room.db data); plus the additive Feynman-runner registration of all 6 Phase 131 suites and `docs/RESEARCH-AS-WORKFLOW-STEP.md`, the v1.14.0 fan-out template. This CLOSES Phase 131.

## What shipped

| Deliverable | What | Where |
|---|---|---|
| The 5 E2E release gate | full pipeline through navigation.cjs + the fs-instrument zero-leak gate; REAL correlation resolver in test 3 | `tests/test-131-e2e.cjs` |
| The trimmed seed fixture | FK anchors on BOTH local section/claim targets AND (runtime-seeded) the teaching-graph correlation_id | `tests/fixtures/phase-131/sample-room/seed.sql` |
| Feynman CI registration | all 6 Phase 131 suites, additive (every prior block byte-unchanged) | `lib/memory/run-feynman-tests.cjs` |
| The v1.14.0 fan-out template | requires_evidence: auto-dispatch + chain-back contract + LOCKED 136 forward contracts + invariants + recipe | `docs/RESEARCH-AS-WORKFLOW-STEP.md` |

## The 5 E2E test names

1. `E2E 1: STANDALONE full pipeline produces EvidenceClaim + LOCAL INFORMS edge + research_filed + F.1 next-move`
2. `E2E 2: CALLED-BY-BUILD-THESIS chains back accepted EvidenceClaim IDs + findRecentChanges shows research_filed`
3. `E2E 3: CALLED-BY-USER-NEEDS different lens_set + destination + REAL correlation_id teaching-graph edge`
4. `E2E 4: REJECTION-AS-DATA writes one REJECTED_BECAUSE + reason + research_rejected; zero INFORMS`
5. `E2E 5: DEDUP suppresses the prior-url finding + the 130.5 cache path is taken on the repeat (no second fetch)`

## What each E2E proves (the must_haves)

- **STANDALONE (1):** an EvidenceClaim node lands `review_status proposed` (Canon Part 9 role 5, never auto-confirmed); exactly one INFORMS edge whose target is the LOCAL room.db node id `section:financial-model` (NOT a correlation_id); a `research_filed` memory_event written via the `navigation.cjs` `logMemoryEvent` re-export (NOT raw `logEvent`); an F.1 next-move selector surfaced post-filing.
- **CALLED-BY-BUILD-THESIS (2):** the accepted EvidenceClaim node id is RETURNED to the caller (chain-back), the chain-back payload carries handles only (asserted to contain zero finding prose -- Canon Part 8), and `findRecentChanges` surfaces the `research_filed` event.
- **CALLED-BY-USER-NEEDS (3):** a contrasting investor-persona + problem-definition section + user-needs JTBD yields a lens_set that `notDeepEqual`s the build-thesis lens_set (user-needs carries `competitive-intelligence`, build-thesis does not) AND a different filing destination; the flow files a TEACHING-GRAPH finding via the REAL `resolveCorrelation` (not a stub) over a `serializeLabelIndex` fixture, and asserts the INFORMS edge target EQUALS `computeCorrelationId('SWOT Analysis','Framework')` -- a real correlation_id, never the raw name. This is the non-stubbed correlation assertion the release gate requires.
- **REJECTION-AS-DATA (4):** exactly one REJECTED_BECAUSE edge carrying the captured reason scalar + a `research_rejected` event; ZERO INFORMS edges for that finding (Canon Part 4).
- **DEDUP (5):** a prior EvidenceClaim url (injected on `preflight.prior_research`) is dedup-suppressed by Stage 4 (the fresh finding survives), and the 130.5 research-cache path is taken on the repeat -- a third run adds ZERO `fetchCorpus` calls (spy-counted; the count stays put).

## Commits

| Task | Type | Hash | Subject |
|---|---|---|---|
| 1 | test | `c5270081` | 5 E2E tests (phase release gate) drive full pipeline through navigation.cjs |
| 2 | test | `5c55ff84` | register all 6 Phase 131 suites in the Feynman CI runner (additive) |
| 3 | docs | `02d29f8a` | RESEARCH-AS-WORKFLOW-STEP.md -- the v1.14.0 fan-out template |

## run-all-131.sh result (the phase release gate)

```
test-131-substrate.cjs          PASSED
test-131-context-extractor.cjs  PASSED
test-131-source-lens-driver.cjs PASSED
test-131-findings-wirer.cjs     PASSED
test-131-isomorphism.cjs        PASSED
test-131-e2e.cjs                PASSED
Passed: 6  Failed: 0  Skipped: 0
```

6/6 GREEN. The phase release gate is met -- Phase 131 is COMPLETE.

## Zero-regression confirmation

- `bash tests/run-all-130.sh` -> 4/4 GREEN
- `bash tests/run-all-130.7.sh` -> 7/7 GREEN
- `node tests/test-navigation-acceptance.cjs` -> 1/1 GREEN (the Phase 109 zero-non-SQLite-reads invariant holds)
- `node scripts/check-research-isomorphism.cjs` (default --directives) -> exit 0 (zero Python spawn)
- `node scripts/check-substrate.cjs --baseline` -> no Phase 131 file flagged (the E2E + fixture are test files; the wirer/driver/extractor/selector were already substrate-clean per Plans 02-04)
- Em-dash scan over all three new deliverables -> zero

## HARD-GATE confirmation

- **ZERO live Brain writes.** The E2E uses a `fetchCorpus` stub (no live network). The only Brain touch in the pipeline is the read-only `brain` lens inside the SHIPPED 130.5 corpus (generic methodology handles via the Phase 110 packet path). No deliverable in this plan writes to Brain. brain_impact: NONE-NEW honored.
- **ZERO new dependencies.** No npm/pip/cargo install. No `package.json` / `package-lock.json` change. Native `node:` built-ins + existing local modules + a SQL fixture + a markdown doc only.
- **navigation.cjs is the only door.** The full pipeline reaches room.db ONLY through `navigation.cjs` (the extractor's `getResearchPreflight`, the driver's `rotate`, the wirer's `writeEvidenceClaim` / `writeEdge` / `logMemoryEvent`). The fs-instrument gate PROVES it by instrumentation: zero non-SQLite filesystem reads outside the allow-listed USER.md + the 130.5 cache.
- **Substrate guard + brain-boundary-scan passed on every commit** (no `--no-verify`; all three commits ran the live Phase 128 substrate guard + brain-boundary-scan pre-commit hooks).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The 130.5 on-disk research-cache is a legitimate non-SQLite read; allow-listed it in the zero-leak gate**
- **Found during:** Task 1 (first E2E run; all 5 tests failed the zero-leak gate on `.mindrian/research-cache/*.json` reads).
- **Issue:** The consume-130.5 contract mandates the driver fetch CACHE-FIRST via the Phase 130.5 shared corpus, which reads/writes a JSON cache at `<roomDir>/.mindrian/research-cache/*.json`. The fs-instrument proxy flagged these as non-SQLite filesystem reads, failing the zero-leak gate.
- **Fix:** Added `.mindrian/research-cache/*.json` to the test's `isAllowedNonDbRead` allow-list alongside USER.md, with a clear comment. This is CONTRACT-ALIGNED: the phase CONTRACT's stated allow-list is "zero non-SQLite filesystem reads outside allow-listed cache/USER.md." The cache holds PUBLIC SIGNAL corpus snippets (never user content, never room.db data per Canon Part 8), so a cache read is the external-corpus layer, NOT a LOCAL-to-anywhere leak. The zero-leak invariant (room.db reached ONLY through navigation.cjs) is fully preserved -- the cache is not the local mind.
- **Files modified:** `tests/test-131-e2e.cjs` (the allow-list + its explanatory comment).
- **Commit:** `c5270081`.

No architectural changes (Rule 4 not triggered); no auth gates; no package installs; no other deviations.

## Known Stubs

None. The `fetchCorpus` stub is a documented test seam (`_fetchCorpus`) that the SHIPPED driver exposes by design so the E2E drives with zero live network -- it is NOT a production stub. Every other surface (the extractor, the selector, the wirer, the REAL correlation resolver) runs its real implementation through `navigation.cjs`. The doc + the Feynman registration carry no placeholders.

## Self-Check: PASSED

- FOUND: tests/test-131-e2e.cjs
- FOUND: tests/fixtures/phase-131/sample-room/seed.sql
- FOUND: docs/RESEARCH-AS-WORKFLOW-STEP.md
- FOUND commit: c5270081
- FOUND commit: 5c55ff84
- FOUND commit: 02d29f8a
