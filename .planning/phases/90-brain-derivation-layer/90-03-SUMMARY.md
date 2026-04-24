---
phase: 90-brain-derivation-layer
plan: "03"
subsystem: brain-derivation-layer
tags:
  - brain-derivation
  - session-start
  - staleness-scan
  - canon-part-8
  - phase-90
  - bsl-1-1
  - cjs
  - three-surface
  - wave-1
dependency_graph:
  requires:
    - .planning/phases/90-brain-derivation-layer/90-00-SUMMARY.md (BRAIN.md schema + STALE_REASON enum)
    - .planning/phases/90-brain-derivation-layer/90-01-SUMMARY.md (deriveSection entry + governing_thought_hash writer)
    - .planning/phases/90-brain-derivation-layer/90-02-SUMMARY.md (brain-derivation-queue + drain transport)
    - .planning/phases/88-feynman-minto-memory-layer/88-07-SUMMARY.md (TRIPLE_CONTEXT formatter + session-start injection block)
    - lib/core/folder-memory.cjs (readTriple contract for governing_thought)
    - lib/core/brain-client.cjs (isAvailable + schema only; Canon Part 8)
    - lib/core/brain-md-schema.cjs (STALE_REASON enum)
  provides:
    - lib/core/brain-md-staleness.cjs (computeBrainStaleness + STALE_AGE_DAYS + BRAIN_STALE_AGE_DAYS env override)
    - lib/memory/triple-context-formatter.cjs fmtBrainLine extension + per-section brain field render
    - scripts/session-start Phase 90-03 injection inside the Phase 88-07 block (staleness scan + enqueue)
    - lib/memory/brain-md-staleness.test.cjs (13 unit tests wired into Feynman suite)
    - lib/memory/session-start-brain-staleness.test.cjs (5 integration tests spawning real bash session-start)
  affects:
    - 90-04-read-quadruple-PLAN.md (readQuadruple consumes the staleness annotations this plan surfaces)
    - 90-05-brain-md-invariants-validator-PLAN.md (registry validator reads the same staleness precedence)
    - 90-07-mos-brain-derive-command-PLAN.md (manual command may bypass the session-start scan; uses the same queue transport)
    - Phase 91 Navigation Engine (consumes staleness annotations as decision-gate signal)
tech-stack:
  added: []
  patterns:
    - Local-only staleness computation (Canon Part 8 invariant; proved by Test 13 fixture audit that runs 10 sections through computeBrainStaleness and asserts ZERO brain-client.query/search/smartSearch calls)
    - Narrow-dialect frontmatter parser scoped to BRAIN.md fields (zero cross-import from brain-md-schema per flat lib/core graph principle)
    - Precedence table (missing > parse_failed > hash_mismatch > age > version > fresh) expressed as linear if-returns for audit-friendliness
    - Offline demotion pattern: stale cases hold enqueue_when_brain_online instead of firing enqueue_regen (queue never drops; drain catches up when Brain returns)
    - Feature flag BRAIN_STALENESS_SKIP=1 for emergency disable (byte-stable fallback to pre-90-03 output)
    - Backward-compat suppression: rooms with zero BRAIN.md files emit no Brain annotation lines (noise avoidance for Brain-offline-forever users)
key-files:
  created:
    - lib/core/brain-md-staleness.cjs
    - lib/memory/brain-md-staleness.test.cjs
    - lib/memory/session-start-brain-staleness.test.cjs
  modified:
    - lib/memory/triple-context-formatter.cjs (fmtBrainLine renderer + per-section brain field)
    - scripts/session-start (Phase 90-03 injection inside the 88-07 block)
    - lib/memory/run-feynman-tests.cjs (two entries appended to TEST_FILES)
decisions:
  - "Staleness precedence is LINEAR first-match-wins: file missing -> absent; parse-fail -> stale/parse_failed; hash mismatch -> stale/governing_thought_changed; age > threshold -> stale/age_exceeded; brain_graph_version < current schema -> stale/brain_graph_version_mismatch; else fresh. Hash mismatch wins over age because the governing-thought change is a stronger regeneration signal than calendar drift."
  - "parse_failed is a new stale_reason added to the 90-00 STALE_REASON enum informally (the frontmatter-parse error is tracked in-module rather than expanding the schema module). Rationale: parse failure means the file CAN be regenerated (not a permanent shape breach); treating it as stale with a descriptive reason matches user expectations better than bubbling a schema violation. Plan 90-05 registry validator will absorb this signal without needing its own parse-fail branch."
  - "Offline demotion: when brain-client.isAvailable() === false, recommended_action=enqueue_regen is downgraded to enqueue_when_brain_online. The queue layer (90-02) already supports this signal -- entries stay in the queue until drain sees Brain reachable. This preserves the invariant that queue entries are NEVER dropped because of transient Brain outages."
  - "Annotation rendering extends the existing 88-07 formatter rather than adding a new BRAIN_CONTEXT block. Per-section staleness is inherently per-section information; co-locating with the existing per-section block preserves the 88-07 weakest-first sort behavior (stalest BRAIN derivations sort alongside stalest MINTO reasoning)."
  - "BRAIN_STALENESS_SKIP=1 feature flag lives at the outer shell level, not inside the node -e payload. The shell-level check gates both the module imports AND the enqueue path with a single env read; when tripped, the inner formatter runs with no brain field attached and the output is byte-stable vs pre-90-03 for a room without BRAIN.md files. This is the emergency-disable surface required by the plan done criteria."
  - "Backward-compat suppression: when NO section in the room has a BRAIN.md file on disk, we delete the transient brain={staleness:'absent'} annotations from every section before formatting. Otherwise every section renders 'Brain derivation: absent' on a first-install room, which is noise, not signal. The 'absent' line surfaces once any section has had a successful derivation (so users see the new-section case that needs regen)."
  - "Enqueue payload constructs a fresh sha256 hash from the live triple.reasoning.governing_thought at enqueue-time rather than reusing the value computed inside computeBrainStaleness. The queue layer is authoritative on hash shape (Phase 90-02 isHashOrNull), and re-computing from the live triple eliminates a class of cross-module mismatches. Cost: one extra sha256 per enqueued section (negligible under STALE_AGE_DAYS=7)."
  - "Env override parser accepts ONLY positive integers. BRAIN_STALE_AGE_DAYS='0', 'abc', '-1', '3.5' all fall back to the 7-day default without a warning. Zero and negative values are silently rejected because a zero threshold would mark every derivation stale on the next session-start (pathological); the silent fallback preserves session-start wall-clock budget even when users typo the override."
requirements:
  - BRAIN-STALENESS-01
  - BRAIN-STALENESS-02
  - BRAIN-STALENESS-03
canon_parts:
  - "Part 3 Tri-Context Decision Gate (staleness footer appears in the BRAIN section of the TRIPLE_CONTEXT block; stale BRAIN.md entries surface alongside stale MINTO entries)"
  - "Part 7 Reuse Before Build (session-start injection pattern copied from Phase 88-07; staleness glyph scheme reuses fresh/warn/low pattern)"
  - "Part 8 Graph Boundary (staleness scan runs LOCAL: reads BRAIN.md frontmatter scalars + computes current hash locally; NEVER queries Brain during scan; Test 13 audits zero content queries across 10 sections)"
metrics:
  duration_minutes: ~35
  completed: 2026-04-20
  tests_added: 18
  feynman_baseline: "55 -> 57 (advance by exactly 2 per plan contract -- one test file per task)"
  feynman_suite_result: "57/57 passed, 0 skipped, 0 failed"
  lines_created: 1245
  runtime_deps_added: 0
---

# Phase 90 Plan 03: Session-start Staleness Scan Summary

One-liner: Session-start now walks every active section, computes BRAIN.md staleness against four LOCAL signals (hash match, age, brain_graph_version, Brain reachability), surfaces per-section annotations in the TRIPLE_CONTEXT block, and enqueues regeneration for stale sections through the Phase 90-02 transport without blocking the user turn -- all while Canon Part 8 holds (zero content queries during the scan, proved by Test 13 fixture audit across 10 sections).

## What shipped

Phase 90 Wave 1 Plan 2 of 9 (Trigger 2 of 4 in the brain-derivation trigger taxonomy: Trigger 1 governing_thought change shipped in Plan 90-02, Trigger 3 cross-room aggregation ships in Plan 90-06, Trigger 4 manual invocation ships in Plan 90-07). All four triggers land on the same queue surface built in 90-02 -- this plan reuses that transport rather than adding a new one.

Three new artifacts plus two surgical edits:

1. `lib/core/brain-md-staleness.cjs` (357 lines, BSL 1.1, CJS only, zero npm deps)
2. `lib/memory/brain-md-staleness.test.cjs` (525 lines, 13 unit tests)
3. `lib/memory/session-start-brain-staleness.test.cjs` (363 lines, 5 integration tests that spawn real bash session-start with BRAIN.md fixtures)

Surgical edits:

1. `lib/memory/triple-context-formatter.cjs` (+62 lines): `fmtBrainLine(brain)` renderer + optional `brain` field on per-section triple shape + export. Backward-compatible: absent brain field emits no new line.
2. `scripts/session-start` (+66 lines inside the existing 88-07 block): computes staleness per section via `brain-md-staleness.cjs`, attaches result to `sections[name].brain`, enqueues regen for `recommended_action === 'enqueue_regen'` via `brain-derivation-queue.enqueue`, honors `BRAIN_STALENESS_SKIP=1` feature flag.

## API Surface

Exported from `lib/core/brain-md-staleness.cjs`:

| Export | Shape | Purpose |
| --- | --- | --- |
| `computeBrainStaleness(sectionPath, triple)` | `async (string, object) -> result` | Primary entry. Reads BRAIN.md if present, parses frontmatter, computes precedence vs triple + schema. Never throws. |
| `STALE_AGE_DAYS` | `7` | Default staleness threshold in days. Overridable via BRAIN_STALE_AGE_DAYS env var. |
| `DEFAULT_STALE_AGE_DAYS` | `7` | Frozen fallback when env var is missing / invalid. |

Result shape:

```
{
  exists: boolean,
  staleness: 'fresh' | 'stale' | 'absent',
  stale_reason: null | 'governing_thought_changed' | 'age_exceeded'
                | 'brain_graph_version_mismatch' | 'brain_offline'
                | 'parse_failed',
  brain_generated_at: string | null,
  brain_graph_version: number | null,
  age_days: number | null,
  recommended_action: 'none' | 'enqueue_regen' | 'enqueue_when_brain_online' | 'skip'
}
```

Renderer extension on `lib/memory/triple-context-formatter.cjs`:

| Export | Shape | Purpose |
| --- | --- | --- |
| `fmtBrainLine(brain)` | `(object) -> string` | Renders a single optional 'Brain derivation: ...' line per section, format: fresh(2d ago, v1) / stale(reason, regenerating\|pending Brain connection) / absent (Brain offline). |

## Staleness Precedence (linear first-match-wins)

| Order | Condition | Result |
| --- | --- | --- |
| 1 | BRAIN.md missing / non-regular / zero-byte | `exists:false, staleness:'absent', recommended_action:'enqueue_when_brain_online'` |
| 2 | Frontmatter unparseable (bad YAML / missing delimiters) | `stale, stale_reason:'parse_failed', recommended_action:'enqueue_regen'` |
| 3 | `governing_thought_hash` does not match current triple's sha256 | `stale, stale_reason:'governing_thought_changed'` |
| 4 | `age_days > BRAIN_STALE_AGE_DAYS` (default 7) | `stale, stale_reason:'age_exceeded'` |
| 5 | `brain_graph_version < brain-client.schema().brain_graph_version` (skipped when offline) | `stale, stale_reason:'brain_graph_version_mismatch'` |
| 6 | All checks pass | `staleness:'fresh', recommended_action:'none'` |

Brain-offline override at every stage: stale cases downgrade `recommended_action` from `enqueue_regen` to `enqueue_when_brain_online` (held in the queue for the next drain attempt; 90-02 contract).

## Canon Part 8 verification (load-bearing)

Per plan objective: the scan NEVER queries the Brain for content. The only allowed Brain touches during `computeBrainStaleness` are `brain-client.isAvailable()` (boolean, cached, no network on cache hit) and `brain-client.schema()` (returns `brain_graph_version` scalar; no user content leaves the local process).

### Test 13 (load-bearing audit)

A fixture builds 10 sections (~3 absent, ~3 fresh, ~4 stale via age), runs `computeBrainStaleness` against each, and asserts that the mock brain-client captured:

- `query_calls === 0` (no Cypher queries)
- `search_calls === 0` (no Pinecone semantic searches)
- `smartSearch_calls === 0` (no hybrid multi-index searches)
- `isAvailable_calls >= 1` (allowed)

Result: 0 / 0 / 0 / >= 1. The boundary holds under fixture audit.

### PR gate alignment

Per Canon Part 8 PR gate: every PR touching `lib/core/brain-*` must pass the brain-boundary-scan check. This plan adds `lib/core/brain-md-staleness.cjs`. The Test 13 fixture audit is the scan evidence: at CI time, the test proves no code path inside `computeBrainStaleness` invokes a user-content Brain query. Future refactors that accidentally route content through `query` / `search` / `smartSearch` will fail Test 13 deterministically.

## Test coverage

### lib/memory/brain-md-staleness.test.cjs (13 unit tests)

1. BRAIN.md absent -> `{exists:false, staleness:'absent', recommended_action:'enqueue_when_brain_online'}`
2. Fresh BRAIN.md (hash matches, recent, version matches) -> `{staleness:'fresh'}`
3. Hash mismatch -> `{staleness:'stale', stale_reason:'governing_thought_changed', recommended_action:'enqueue_regen'}`
4. Age > 7 days -> `{staleness:'stale', stale_reason:'age_exceeded'}`
5. Hash mismatch AND age exceeded -> hash mismatch wins (precedence rule)
6. `brain_graph_version < current` -> `{staleness:'stale', stale_reason:'brain_graph_version_mismatch'}`
7. Brain offline + BRAIN.md absent -> `{staleness:'absent', recommended_action:'enqueue_when_brain_online'}`
8. Brain offline + BRAIN.md stale -> `recommended_action='enqueue_when_brain_online'` (demoted from enqueue_regen)
9. Brain offline + BRAIN.md fresh -> `{staleness:'fresh', recommended_action:'none'}` (no action)
10. `BRAIN_STALE_AGE_DAYS=3` env override -> 4-day-old file becomes stale
11. `BRAIN_STALE_AGE_DAYS='abc'` invalid -> fallback to 7; 4-day-old file stays fresh
12. Malformed BRAIN.md frontmatter -> `{exists:true, staleness:'stale', stale_reason:'parse_failed'}`
13. **CANON PART 8 AUDIT (load-bearing)**: 10 sections processed, zero content queries captured, isAvailable invoked

### lib/memory/session-start-brain-staleness.test.cjs (5 integration tests)

1. 3-section mix (fresh / stale / absent) -> TRIPLE_CONTEXT contains `Brain derivation: fresh` + `Brain derivation: stale (governing_thought changed, regenerating)` lines
2. Brain offline + stale section -> stale annotation present AND queue has zero entries (enqueue suppressed)
3. Brain online + stale -> enqueue lands in `.mindrian/brain-derivation-queue.json` AND wall-clock < 5000ms (WSL2 ceiling)
4. `BRAIN_STALENESS_SKIP=1` -> TRIPLE_CONTEXT still emitted, Brain annotation lines absent
5. Room with zero BRAIN.md files -> no `Brain derivation:` lines anywhere (backward-compat)

All 5 integration tests spawn real bash `scripts/session-start` with a Strategy-0b compatible `MindrianRooms` fixture (mirrors the 88-07 harness pattern).

## Feynman suite impact

- Pre-plan baseline (after 90-02 landed): 55/55 passed.
- Post-plan result: 57/57 passed, 0 skipped, 0 failed.
- Net: +2 test files, +18 assertions. Baseline advanced by exactly 2 (one test file per task) per the plan contract of "baseline +5 = 90-00, 90-01, 90-02, 90-03 unit, 90-03 integration" (baseline 53 before 90-00 -> 54 after 90-00 -> 55 after 90-01 ... wait this math only tracks per-plan +1 not per-file +1; after 90-02 wave baseline was 55 including both wiring tests under ONE file; Plan 90-03 adds a second separate file for integration. Net +2 is correct for the two-file structure of this plan).

## Three-surface verification

- `lib/core/brain-md-staleness.cjs`: pure CJS, node built-ins only (`fs`, `path`, `crypto`). No CLI/MCP/Cowork-specific branches.
- `scripts/session-start` extension: bash + `env VAR=val node -e` pattern -- identical fire across CLI (SessionStart hook), Desktop MCP (SessionStart equivalent), and Cowork (multi-user SessionStart equivalent). The `MINDRIAN_BRAIN_KEY` env propagation works identically on all three.
- Formatter extension: unchanged surface-agnostic behavior (no fs / no child_process).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 2 env var name mismatch** (discovered during Task 2 integration runs)

- **Found during:** First GREEN run of session-start-brain-staleness.test.cjs.
- **Issue:** Initial test used `MINDRIAN_BRAIN_API_KEY` as the env var to control `brain-client.isAvailable()`. The actual contract in `lib/core/brain-client.cjs` line 122 is `MINDRIAN_BRAIN_KEY`. The wrong name meant the "offline" test saw Brain online (getApiKey fell back to `~/.mindrian.env`), which enqueued one entry and failed Test 2's zero-entry assertion.
- **Fix:** Renamed all five test-level env references from `MINDRIAN_BRAIN_API_KEY` to `MINDRIAN_BRAIN_KEY` AND added `HOME=<tmp>/_home` override in `invokeSessionStart` to neutralize the global `~/.mindrian.env` fallback AND added explicit empty-string -> delete handling so the spawned subprocess sees the env var as undefined (not empty string).
- **Files modified:** lib/memory/session-start-brain-staleness.test.cjs (replace_all rename + invokeSessionStart harness)
- **Commit:** 8f59414 (Task 2 commit).

**2. [Rule 3 - Blocking issue] node -e async IIFE suppressed output when BRAIN_STALENESS_SKIP=1**

- **Found during:** Test 4 of the integration suite.
- **Issue:** The first implementation of the Phase 90-03 injection block placed `if (!brainStale) return;` as the first statement of the async IIFE. When `BRAIN_STALENESS_SKIP=1` tripped the feature flag to load `brainStale = null`, the IIFE returned before the formatter ran, so the TRIPLE_CONTEXT block never reached stdout. Test 4 failed with "TRIPLE_CONTEXT still emitted" assertion.
- **Fix:** Restructured so the staleness-scan block only runs when `brainStale` is non-null, but the `fmt.formatTripleContext` call + `process.stdout.write` ALWAYS run at the end of the IIFE. The formatter handles missing `brain` fields gracefully (fmtBrainLine returns empty string), so the skip path is byte-stable vs pre-90-03 output.
- **Files modified:** scripts/session-start (Phase 90-03 injection block IIFE structure)
- **Commit:** 8f59414 (Task 2 commit).

### Authentication gates

None. Plan uses mocked brain-client for unit tests; integration tests toggle availability via env var only.

### Deferred items (out of scope)

1. **Pre-existing `minto-debouncer.test.cjs` Test 8 timing flake.** Previously logged in 90-02-SUMMARY deferred-items; did not reproduce on post-90-03 run. Continues tracked but no current action.
2. **Snapshot-path staleness enrichment.** When `.mindrian/session-snapshot.json` is present, the snapshot provides a pre-fetched triple per section. Plan 90-03 re-reads the live triple via `fm.readTriple(sp)` to compute the hash (authoritative source of truth). This is a ~20ms redundancy per section. Acceptable at current room sizes; future optimization could trust the snapshot hash when snapshot age is < 1s. Not in scope for 90-03.

## Verification

- `node lib/memory/brain-md-staleness.test.cjs` -> 13/13 passed, exit 0
- `node lib/memory/session-start-brain-staleness.test.cjs` -> 5/5 passed, exit 0
- `MINTO_FROZEN_DATE=2026-04-14 node lib/memory/run-feynman-tests.cjs` -> 57/57 passed, exit 0
- `grep -c "BSL 1.1" lib/core/brain-md-staleness.cjs` -> 1
- `grep -cE "brainClient\.query|brainClient\.search|brainClient\.smartSearch" lib/core/brain-md-staleness.cjs` -> 0 (Canon Part 8 grep gate)
- `grep -cE "STALE_AGE_DAYS|BRAIN_STALE_AGE_DAYS" lib/core/brain-md-staleness.cjs` -> 14 (env override support)
- `grep -c "brain-md-staleness" scripts/session-start` -> 3 (Phase 90-03 injection present)
- `grep -c "BRAIN_STALENESS_SKIP" scripts/session-start` -> 3 (feature flag wired)
- `grep -c "brain" lib/memory/triple-context-formatter.cjs` -> 25 (fmtBrainLine + per-section field)
- Em-dash / en-dash scan (U+2013, U+2014) across all modified and created files -> 0

## Commits

- `bb1da28` test(90-03): add failing tests for brain-md-staleness (RED)
- `cd5ffa7` feat(90-03): implement brain-md-staleness (GREEN, 13/13 passing)
- `8f59414` feat(90-03): wire Brain staleness into session-start (5/5 integration tests)

## Next plan

Plan 90-04 readQuadruple extends Phase 88-01 readTriple to read BRAIN.md alongside ROOM/STATE/MINTO. The staleness annotations this plan surfaces in TRIPLE_CONTEXT will be exposed as a first-class field on the quadruple struct. Plan 90-05 brain-md-invariants-validator wraps validateSchema + computeBrainStaleness in the registry-discoverable invariants layer. Plan 90-07 `/mos:brain-derive` command may bypass this scan for manual invocation, but uses the same queue transport that this plan feeds.

---

## Self-Check: PASSED

- `lib/core/brain-md-staleness.cjs` FOUND
- `lib/memory/brain-md-staleness.test.cjs` FOUND
- `lib/memory/session-start-brain-staleness.test.cjs` FOUND
- `lib/memory/triple-context-formatter.cjs` MODIFIED (fmtBrainLine export present)
- `scripts/session-start` MODIFIED (Phase 90-03 injection block present, BRAIN_STALENESS_SKIP wired)
- `lib/memory/run-feynman-tests.cjs` MODIFIED (two new entries appended)
- `.planning/phases/90-brain-derivation-layer/90-03-SUMMARY.md` FOUND
- Commit `bb1da28` (RED tests) FOUND in git log
- Commit `cd5ffa7` (GREEN module) FOUND in git log
- Commit `8f59414` (session-start wiring) FOUND in git log
- Feynman suite 57/57 passing (baseline 55 -> 57)

---

_Phase 90 Plan 03 - MindrianOS Plugin, 2026-04-20._
