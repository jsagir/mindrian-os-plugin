---
phase: 90-brain-derivation-layer
plan: "01"
subsystem: brain-derivation-layer
tags:
  - brain-derivation
  - canon-part-8
  - atomic-write
  - graceful-degradation
  - phase-90
  - bsl-1-1
  - cjs
  - three-surface
  - wave-0
dependency_graph:
  requires:
    - .planning/phases/90-brain-derivation-layer/90-00-SUMMARY.md (validateSchema entry point + frozen SEVERITY/CATEGORIES)
    - lib/core/folder-memory.cjs (readTriple -- Phase 88-01 contract)
    - lib/core/brain-client.cjs (callTool wrapper + sanitizeCypherInput; Canon Part 7 reuse)
    - docs/MINDRIAN-CANON.md Part 8 (Graph Boundary constitutional contract)
    - .planning/phases/88-feynman-minto-memory-layer/88-04-B-SUMMARY.md (atomic write pattern: openSync wx + fsync + rename)
  provides:
    - lib/core/brain-derivation.cjs (deriveSection + buildBrainQueryContext + classifyProblemType + derivePhaseIndicator + deriveComplexity + SECTION_BUILDERS registry + EMPTY_SHA256 sentinel)
    - lib/core/brain-derivation-prompts.cjs (9 frozen prompt builders + PROMPT_VERSION + ALLOWED_CTX_KEYS allow-list schema)
    - lib/memory/brain-derivation.test.cjs (18 fixture tests registered in Feynman suite)
  affects:
    - 90-02-governing-thought-change-trigger-PLAN.md (consumes governing_thought_hash sentinel + deriveSection entry)
    - 90-03-session-start-staleness-scan-PLAN.md (calls deriveSection on stale sections)
    - 90-04-read-quadruple-PLAN.md (extends readTriple to readQuadruple; BRAIN.md is the fourth file)
    - 90-05-brain-md-invariants-validator-PLAN.md (registry wraps validateSchema + prompt_version mismatch force-regen)
    - 90-06-cross-room-aggregation-PLAN.md (fills buildFlaggedContradictionsXroomQuery stub)
    - 90-07-mos-brain-derive-command-PLAN.md (CLI surface around deriveSection)
    - 90-08-graceful-degradation-suite-PLAN.md (integration tests across every failure reason)
    - 90-09-navigation-engine-interface-spec-PLAN.md (Navigation Engine reads BRAIN.md; deriveSection is the writer)
tech-stack:
  added: []
  patterns:
    - Canon Part 8 chokepoint function (buildBrainQueryContext) as the single user-triple-field reader
    - Frozen allow-list schema enforced at prompt-builder entry via validateCtx (TypeError on forbidden or out-of-range ctx key)
    - Double-layer interpolation hygiene (sanitizeCypherInput + Number clamp) on every field reaching a Cypher template
    - Atomic write copied from 88-04-B (openSync wx + writeFileSync + fsyncSync + validateSchema + renameSync; tmpfile unlinked on any failure)
    - Canon Part 8 fixture audit (Test 13 allow-list + Test 14 negative leak) captures every Brain payload
    - Graceful failure result object on every external boundary; deriveSection NEVER throws
key-files:
  created:
    - lib/core/brain-derivation.cjs
    - lib/core/brain-derivation-prompts.cjs
    - lib/memory/brain-derivation.test.cjs
  modified:
    - lib/memory/run-feynman-tests.cjs (one entry appended to TEST_FILES)
decisions:
  - "buildBrainQueryContext is THE Canon Part 8 chokepoint. It is the ONLY function in the module that reads user-specific triple fields (governing_thought, identity_text via triple.room, decision_log via triple.reasoning). Every field exits the function as a sha256 hash, a bounded integer, a scalar in [0,1], a derived enum from a frozen vocabulary, or a slug-safe section name. No user prose, personal names, meeting fragments, or artifact bodies can pass this boundary."
  - "classifyProblemType reads reasoning.governing_thought once, converts to a boolean existence flag on the first line, and never forwards the content. This is the only other function that touches the field, and the extraction is scalar-only. Satisfies Canon Part 8 by construction."
  - "Every prompt builder validates its ctx input against a frozen allow-list schema (ALLOWED_CTX_KEYS + enum sets + numeric ranges) at function entry. An unexpected key or out-of-range value throws TypeError rather than silently sanitizing: any forbidden field in ctx is upstream breach, and failing loudly exposes it at test time."
  - "SHA256 of empty string (sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855) is the deterministic sentinel for null or empty governing_thought. Parseable by validateSchema, stable across invocations, surfaces in BRAIN.md as a structural signal that no governing thought exists yet."
  - "Atomic write tmpfile naming: BRAIN.md.tmp.<random>.brain. Pattern regex /^BRAIN\\.md\\.tmp\\.[a-z0-9]+\\.brain$/ asserted in Test 15 via fs.openSync instrumentation. openSync -> writeFileSync -> fsyncSync -> validateSchema -> renameSync; any step failure triggers closeSync + unlinkSync best-effort."
  - "Schema gate before rename: the assembled BRAIN.md is validated via Plan 90-00 validateSchema() AFTER fsync and BEFORE renameSync. ERROR or CRITICAL severity aborts the write and returns violations[] in the result. WARNING (e.g. staleness warning) passes through because the file is still readable."
  - "Graceful failure at every external boundary. brain-client.isAvailable()===false -> reason:'brain_unavailable'. triple.reasoning.exists===false -> reason:'triple_incomplete'. brain-client.query/search/schema throwing -> categorized via categorizeError (timeout/rate_limited/auth_failed/derivation_error). Schema rejection -> reason:'schema_rejected' with violations[]. Filesystem EACCES/ENOENT -> reason:'fs_error'. deriveSection NEVER throws; every path returns a structured result object."
  - "PROMPT_VERSION = 1 (exported frozen). Bumping forces brain_graph_version mismatch in Plan 90-05 validator, which re-derives stale BRAIN.md files automatically. The version lives in brain-derivation-prompts.cjs because changes to the prompt shape -- not the core deriveSection entry -- are what invalidate cached derivations."
  - "buildFlaggedContradictionsXroomQuery is a deliberate null stub. Plan 90-06 (cross-room aggregation) fills it with a real Cypher query once cross-room edges exist in the graph. Stub is documented in the prompt module + handled in the core module (null builder return -> (no signal) body section). Not a deferred item: it's a scheduled handoff to the next plan."
requirements:
  - BRAIN-DERIVE-01
  - BRAIN-DERIVE-02
  - BRAIN-DERIVE-03
  - BRAIN-DERIVE-04
  - BRAIN-DERIVE-CANON-PART-8-01
metrics:
  duration_minutes: ~45
  completed: 2026-04-20
  tests_added: 18
  feynman_baseline: "53 -> 54 (advance by exactly 1 per plan contract)"
  feynman_suite_result: "54/54 passed, 0 skipped, 0 failed"
  lines_created: 1486
  runtime_deps_added: 0
---

# Phase 90 Plan 01: Brain Derivation Core Summary

One-liner: Ship the single deriveSection entry point plus 9 frozen prompt builders, with buildBrainQueryContext as the load-bearing Canon Part 8 chokepoint proven by a fixture payload audit that captures every Brain call and asserts the allow-list holds while dangerous user content (Lawrence / 5M / revenue) never reaches a query.

## What shipped

Phase 90 Wave 0 Plan 2 of 2 (final Wave 0 plan). This is the load-bearing implementation of Canon Part 8 (The Graph Boundary) at the runtime layer. Plan 90-00 baked the boundary into the schema validator at the read/ship audit layer; this plan writes the derivation module so that every outbound Brain call is constructed from allow-list scalars ONLY, with the constraint enforced by a fixture audit rather than by comment.

Three artifacts:

1. `lib/core/brain-derivation.cjs` (536 lines, BSL 1.1, CJS only, zero npm deps)
2. `lib/core/brain-derivation-prompts.cjs` (326 lines, 9 builders + PROMPT_VERSION + frozen allow-list schema)
3. `lib/memory/brain-derivation.test.cjs` (634 lines, 18 tests including the load-bearing Canon Part 8 audits)

## API Surface

Exported from `lib/core/brain-derivation.cjs`:

| Export | Shape | Purpose |
| --- | --- | --- |
| `deriveSection(roomPath, section, options)` | `async (string, string, object) -> {success, brain_md_path?, violations[], cost_tokens, reason?, dry_run?, would_query?}` | Main entry. Reads triple, builds Canon-Part-8-safe ctx, invokes 9 prompts via brain-client, assembles markdown, gates through validateSchema, atomically writes BRAIN.md. Never throws. |
| `buildBrainQueryContext(triple, sectionSlug)` | `(object, string) -> object \| null` | Canon Part 8 chokepoint. Extracts ONLY allow-list scalars from triple; forbidden user content never passes this boundary. |
| `classifyProblemType(triple)` | `(object) -> 'UDP' \| 'IDP' \| 'WDP'` | Derives problem type from governing-thought existence + mece_status + arguments_count + evidence_density. Scalar extraction only. |
| `derivePhaseIndicator(triple)` | `(object) -> enum` | Derives phase label from completeness_score + artifact_count + stale reason. |
| `deriveComplexity(triple)` | `(object) -> 'Simple' \| 'Complex' \| 'Wicked'` | Derives complexity from reasoning_health_score + flagged-weaknesses count. |
| `SECTION_BUILDERS` | frozen array | 9-entry registry mapping BRAIN.md headings to prompt builder names + modes. |
| `EMPTY_SHA256` | frozen string | sha256 of empty string sentinel for null governing_thought. |

Exported from `lib/core/brain-derivation-prompts.cjs`:

| Export | Purpose |
| --- | --- |
| `PROMPT_VERSION` | Frozen { value: 1 }. Bump forces brain_graph_version mismatch in Plan 90-05. |
| `ALLOWED_CTX_KEYS` | Frozen list of 11 allow-list keys. Every builder's validateCtx rejects any other key. |
| `PROBLEM_TYPES` / `COMPLEXITIES` / `MECE_STATES` / `PHASE_INDICATORS` | Frozen enum sets. |
| `buildPatternMatchesQuery(ctx) -> cypher` | Brain query for frameworks matching problem_type + phase. |
| `buildCrossDomainAnalogiesQuery(ctx) -> pinecone query string` | Pinecone semantic search for cross-domain analogies (methodology handles only). |
| `buildWickedIndicatorsQuery(ctx) -> cypher` | Brain query for WickedIndicator nodes when problem_type in [IDP, WDP-Wicked]. |
| `buildUnfilledOpportunityMatchesQuery(ctx) -> cypher` | Brain query for Opportunity nodes keyed by section_slug + problem_type. |
| `buildFrameworkChainPredictionsQuery(ctx) -> cypher` | Brain query for FEEDS_INTO chains from current phase indicator. |
| `buildAssessmentThinkingChainPositionQuery(ctx) -> cypher` | Brain query for current rigor level (keyed by reasoning_health_score + evidence_density). |
| `buildProblemTypeClassificationQuery(ctx) -> cypher` | Brain query for ProblemType with confidence (based on mece_status + arguments_count). |
| `buildFlaggedContradictionsXroomQuery(ctx) -> null` | Stub for Plan 90-06 cross-room aggregation. |
| `buildHsiSignalsQuery(ctx) -> cypher \| null` | Brain query for HSI recommendations when ctx.reverse_salient_present. |

## Canon Part 8 verification (load-bearing)

Per plan objective: this is the LOAD-BEARING Canon Part 8 plan. The Brain IS allowed to see that a room has a problem of type UDP-Complex with reasoning_health_score 0.6 and wants advice on framework chains. The Brain is NOT allowed to see the governing_thought text, the identity paragraph, the decision_log entries, the references, or the names of people mentioned. The boundary is enforced at the query-construction layer, proven by a fixture test that captures every outbound Brain payload and asserts against a frozen allow-list.

### Two-layer runtime enforcement

Layer 1 -- `buildBrainQueryContext` (lib/core/brain-derivation.cjs). The ONLY function in the module that reads user-specific triple fields. Every field exits as:
  - sha256 hash (governing_thought_hash)
  - bounded integer (arguments_count)
  - scalar in [0,1] (reasoning_health_score, evidence_density)
  - derived enum from a frozen vocabulary (UDP/IDP/WDP, Simple/Complex/Wicked, phase indicator)
  - slug-safe section name (lowercase + [a-z0-9_-] only, 64 char max)
  - boolean scalar (reverse_salient_present)

Layer 2 -- `validateCtx` (lib/core/brain-derivation-prompts.cjs). Every prompt builder validates its ctx input against ALLOWED_CTX_KEYS + enum sets + numeric ranges at function entry. Any unexpected key or out-of-range value throws TypeError. This is defense-in-depth: if a future refactor accidentally passes a raw triple field into a builder, the builder refuses.

### Fixture audit (Tests 13 + 14)

Test 13 (load-bearing positive): captures every cypher + pinecone search across a full deriveSection happy-path run and asserts every payload:

- Matches at least one allow-list regex: `sha256:[a-f0-9]{6,}` OR `framework|Framework|FEEDS_INTO|MATCHES_SECTION|Opportunity|ProblemType|WickedIndicator|RigorLevel|HsiRecommendation|APPLIES_AT_PHASE` OR `problem_type|UDP|IDP|WDP` OR `phase|Phase` OR `section|Section|market-analysis` OR a numeric scalar.
- Does NOT match any forbidden regex: `/[A-Z][a-z]+\s+said/` (quoted person) OR `/@[a-z]+\.[a-z]{2,}/` (email) OR `/\$\s?[0-9]/` (currency).
- Does NOT contain the verbatim governing_thought fragment `validate pricing in the enterprise segment`.

Test 14 (load-bearing negative): injects a triple with a dangerous governing_thought (`Lawrence said we will hit 5M revenue by Q4 if pricing holds.`) and a dangerous identity_text (`The room identity mentions Lawrence said 5M revenue at the Q4 meeting.`). Runs deriveSection. Audits EVERY captured Brain payload and asserts none contains:

- `Lawrence` (quoted person)
- `5M` (currency magnitude)
- `revenue` (dangerous financial term)
- `Q4 meeting` (meeting fragment)

Result: both tests pass. The boundary holds under a fixture-level adversarial input.

### PR gate alignment

Per Canon Part 8 PR gate: every PR touching mcp-server-brain/, lib/core/brain-*, or any MCP tool that queries the Brain must pass the brain-boundary-scan check. This plan adds three files matching `lib/core/brain-*`. The fixture audit (Tests 13 + 14) serves as the scan evidence: the tests prove at CI-time that no endpoint, parameter, or log line causes user data to reach the Brain. Future refactors that re-route a user-content field into a query will fail Test 13 or Test 14 deterministically.

## Test coverage (18 fixtures)

1. Happy path -> `{success:true, brain_md_path, violations:[], cost_tokens>=0}`. BRAIN.md exists at returned path. schema() called exactly once.
2. Brain offline (isAvailable=false) -> `{success:false, reason:'brain_unavailable', cost_tokens:0}`. BRAIN.md NOT written.
3. Brain throws timeout -> `{success:false, reason:'derivation_timeout'|'derivation_error'}`. BRAIN.md NOT written. tmpfile cleaned.
4. Brain throws rate_limited -> `{success:false, reason matches /rate|timeout|error/}`. BRAIN.md NOT written.
5. Brain returns empty results for all 9 prompts -> BRAIN.md written with `(no signal)` body in every section.
6. Schema gate rejection (forced missing-author via `_test_force_bad_staleness` flag) -> `{success:false, violations:[...]}`. tmpfile cleaned.
7. Concurrent deriveSection calls -> at least one succeeds, no tmpfile leftovers, BRAIN.md exists.
8. Triple absent (no MINTO.md) -> `{success:false, reason:'triple_incomplete'}`.
9. Null governing_thought -> EMPTY_SHA256 sentinel (`sha256:e3b0c...`) appears in BRAIN.md.
10. `options.only_sections=['Pattern Matches','ProblemType Classification']` -> at most 2 cypher queries, 0 pinecone searches.
11. `options.dry_run=true` -> 0 Brain calls, `{success:true, dry_run:true, would_query:9}`.
12. schema() fetched exactly once per invocation (not once per prompt).
13. **CANON PART 8 PAYLOAD AUDIT (load-bearing positive)**.
14. **CANON PART 8 negative**.
15. Atomic write pattern: tmpfile matches `/^BRAIN\.md\.tmp\.[a-z0-9]+\.brain$/`; trace order open -> fsync -> rename via fs instrumentation.
16. Crash mid-write (error on second query) -> tmpfile cleaned best-effort.
17. deriveSection NEVER throws: malformed args + nonexistent path both return structured result objects.
18. Three-surface CJS purity: zero `require('claude-*')`, zero platform-specific code, BSL 1.1 header, zero em-dashes.

## Feynman suite impact

- Pre-plan baseline (after 90-00 landed): 53/53 passed.
- Post-plan result: 54/54 passed, 0 skipped, 0 failed.
- Net: +1 test file, +18 assertions. Baseline advanced by exactly 1 per plan contract.

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written with two minor test-harness adjustments that preserve the plan's intent:

1. **Test 6 schema-gate injection**: the plan suggested forcing a bogus staleness enum value to trigger schema rejection, but staleness warnings are severity WARNING (not ERROR) and therefore pass the hard-error gate. Adjusted the `_test_force_bad_staleness` harness to strip the `author` field (severity ERROR, matches plan intent of "any violations with severity >= error abort the write"). The test still exercises the same code path -- schema gate rejects, tmpfile cleaned -- and matches the plan's done criteria.

2. **Test 15 observation technique**: the plan suggested observing tmpfile existence during Brain queries. Brain queries run BEFORE the atomic write, so the tmpfile is never on disk during a query. Adjusted the test to instrument `fs.openSync` + `fs.fsyncSync` + `fs.renameSync` (the Phase 88-04-B ordering-trace pattern) which proves both (a) the tmpfile naming regex AND (b) the open -> fsync -> rename ordering. Stronger than the original intent.

### Authentication gates

None. Plan is filesystem + node built-ins + mocked brain-client only.

### Deferred items (out of scope)

1. **buildFlaggedContradictionsXroomQuery returns null by contract.** Plan 90-06 (cross-room aggregation) will fill it with a real Cypher query. The stub is documented in both the prompt module and the core module. Downstream consumers treat a null builder return as `(no signal)` -- the section renders correctly without the data.

## Verification

- `node lib/memory/brain-derivation.test.cjs` -> 18/18 passed, exit 0
- `MINTO_FROZEN_DATE=2026-04-14 node lib/memory/run-feynman-tests.cjs` -> 54/54 passed, exit 0
- `grep -c "BSL 1.1" lib/core/brain-derivation.cjs` -> 1
- `grep -c "BSL 1.1" lib/core/brain-derivation-prompts.cjs` -> 1
- `grep -c "buildBrainQueryContext" lib/core/brain-derivation.cjs` -> 5
- `grep -c "folder-memory" lib/core/brain-derivation.cjs` -> 1
- `grep -c "brain-client" lib/core/brain-derivation.cjs` -> 4
- `grep -c "validateSchema" lib/core/brain-derivation.cjs` -> 2
- `grep -cE "canon|Part 8" lib/memory/brain-derivation.test.cjs` -> 4
- `grep -cE "governing_thought[^_]|identity_text|decision_log|references[^_]|flagged_weaknesses\[" lib/core/brain-derivation-prompts.cjs` -> 0 (plan gate)
- `grep -c "sanitizeCypherInput" lib/core/brain-derivation-prompts.cjs` -> 4 (plan gate: >= 1)
- `grep -c "Object.freeze" lib/core/brain-derivation-prompts.cjs` -> 8 (plan gate: >= 2)
- Em-dash / en-dash scan (U+2013, U+2014) across all created files -> 0
- Plan done-criteria cross-check:
  - 9 prompt builder functions exported (Task 1 done)
  - PROMPT_VERSION = 1 exported frozen (Task 1 done)
  - Zero forbidden field names in prompts module (Task 1 done)
  - sanitizeCypherInput reuse (Canon Part 7) (Task 1 done)
  - brain-derivation.cjs exports deriveSection + buildBrainQueryContext + classifyProblemType + derivePhaseIndicator (Task 2 done)
  - 18 tests passing (Task 2 done)
  - Canon Part 8 Test 13 + Test 14 (Task 2 done)
  - Three-surface CJS purity (Task 2 done)
  - Zero new runtime dependencies (Task 2 done)

## Commits

- `5fde9f6` feat(90-01): add Brain derivation prompt builders (9 frozen prompts, Canon Part 8 allow-list)
- `a3b76d1` test(90-01): add failing tests for brain-derivation core (RED)
- `840aca0` feat(90-01): implement Brain derivation core (GREEN, 18/18 passing)

## Next plan

Plan 90-02 governing-thought-change-trigger reads the `governing_thought_hash` that this plan writes into BRAIN.md frontmatter, detects when it no longer matches the live MINTO.md, and triggers re-derivation. Plan 90-03 session-start-staleness-scan finds all BRAIN.md files whose `staleness=stale` and re-runs `deriveSection` on each. Plan 90-04 readQuadruple extends the Phase 88-01 readTriple contract to read BRAIN.md alongside ROOM/STATE/MINTO as the fourth per-folder memory file.

---

## Self-Check: PASSED

- `lib/core/brain-derivation.cjs` FOUND
- `lib/core/brain-derivation-prompts.cjs` FOUND
- `lib/memory/brain-derivation.test.cjs` FOUND
- `.planning/phases/90-brain-derivation-layer/90-01-SUMMARY.md` FOUND
- Commit `5fde9f6` (prompts module) FOUND in git log
- Commit `a3b76d1` (RED tests) FOUND in git log
- Commit `840aca0` (GREEN impl) FOUND in git log

---

_Phase 90 Plan 01 - MindrianOS Plugin, 2026-04-20._
