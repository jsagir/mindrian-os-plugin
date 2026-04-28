---
phase: 94-v1-11-2-tester-driven-fixer
plan: "03"
subsystem: brain-mcp-server-resolution
tags: [brain-mcp, mcp-server-name, canonical-prefix, mindrian-brain, frontmatter-sweep, lawrence-qa-handoff, miriam-kaplan-qa, canon-part-7, canon-part-8, plan-deviation, scope-expansion]

# Dependency graph
requires:
  - phase: 87-security-hardening-cascade-refactor
    provides: brain-client.cjs allow-listed scalar chokepoint (preserved untouched)
  - phase: 88.1-uiux-polish
    provides: scripts/frontmatter-schema-validator.cjs (Phase 88.1-07 advisory hook reused as T5 smoke gate)
  - phase: 90-brain-derivation-layer
    provides: Mode A / Mode B / Tier 0 routing tier semantics (Brain server-name resolution feeds the Mode A path)
provides:
  - "commands/*.md (17 files): single canonical prefix `mcp__mindrian-brain__` for every Brain MCP tool reference (frontmatter + body prose)"
  - "docs/install/BRAIN-SETUP.md (190 lines): user-facing install guide with canonical name + .mcp.json snippet + verification steps + migration from v1.11.0/v1.11.1 + required tool surface table"
  - "lib/memory/brain-server-resolution.test.cjs (322 lines): 5-fixture regression fence asserting zero non-canonical brain refs anywhere in commands/*.md"
affects:
  - 94-04 mcp-server-brain-deps (consumes the canonical name; FIX-3 may collapse to deprecation per CONTEXT.md decisions)
  - 94-10 v1.11.2-release-gate (CHANGELOG narrative cites Brain reachability fix)
  - 91-navigation-engine (Mode A path now resolvable -- routing_source: engine and brain_md_tier_mode: mode_a/mode_b reachable when user wires their Neo4j MCP under canonical name)
  - All future Brain-touching plugin commands (canonical prefix is now the single contract)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canonical name sweep with frontmatter + body-prose alignment. Server-name standardization happens at the resolver boundary (allowed-tools list) and at every body-prose mention; the two MUST stay in sync or grep fences regress."
    - "Single-key YAML allowed-tools parser in test fixture. Tolerates list form, inline form, and absent-key form without a real YAML lib (Phase 88-01 readTriple precedent)."
    - "Plan-spec scope expansion as Rule 2 deviation. Plan listed 10 files; reality showed 17. The must_haves invariant is the canonical contract, not the files_modified list."
    - "Phase 88.1-07 frontmatter-schema-validator as a T5 smoke gate. Validator is advisory (always exits 0); the test asserts invokability, not content compliance, since this plan's content gate lives in T1-T4."
    - "BRAIN-SETUP.md as the user-side contract surface. Plugin commands declare the canonical prefix; users register their Neo4j MCP under that name. Zero plugin-side .mcp.json edits required (deferred to Plan 94-04)."

key-files:
  created:
    - lib/memory/brain-server-resolution.test.cjs (322 lines; 5 fixture tests; BSL 1.1)
    - docs/install/BRAIN-SETUP.md (190 lines; 5-section install guide)
    - .planning/phases/94-v1-11-2-tester-driven-fixer/94-03-brain-mcp-server-resolution-SUMMARY.md (this file)
  modified:
    - commands/act.md (frontmatter sweep: -2 non-canonical refs, +1 canonical)
    - commands/compare-ventures.md (frontmatter sweep + 2 body-prose sweeps)
    - commands/deep-grade.md (2 body-prose sweeps)
    - commands/diagnose.md (1 body-prose sweep)
    - commands/find-analogies.md (frontmatter sweep)
    - commands/find-connections.md (frontmatter + 1 body-prose sweep)
    - commands/grade.md (1 body-prose sweep)
    - commands/help.md (1 body-prose sweep)
    - commands/organize.md (1 body-prose sweep)
    - commands/pipeline.md (1 body-prose sweep)
    - commands/research.md (1 body-prose sweep)
    - commands/rs-experts.md (frontmatter sweep)
    - commands/rs-explain.md (frontmatter sweep)
    - commands/rs-fetch.md (frontmatter sweep)
    - commands/rs-thesis.md (frontmatter sweep)
    - commands/scout.md (frontmatter sweep)
    - commands/suggest-next.md (frontmatter + 1 body-prose sweep)
    - lib/memory/run-feynman-tests.cjs (+15 lines TEST_FILES registration with Canon Part 7 + Part 8 traceability comment)

key-decisions:
  - "Canonical server name: `mindrian-brain`. Chosen because it already appeared in 6 of the 10 plan-listed commands as a partial canonical, has the project namespace, and was the cheapest sweep per QA handoff Section 2 FIX-2 Option A. Option B (alias system in plugin .mcp.json) and Option C (auto-detect at session-start) deferred to v1.12."
  - "Plan deviation locked-in (Rule 2): scope expanded from 10 to 17 commands. The plan's files_modified list under-counted; ground truth showed mcp__neo4j-brain__ refs in 17 commands and mcp__pinecone-brain__ refs in 4 commands. The must_haves invariant ('Zero references to mcp__neo4j-brain__ or mcp__pinecone-brain__ remain in commands/*.md after the sweep') is the canonical contract; the files_modified list was an underestimate. Swept all 17 files to honor the must_have."
  - "Plan deviation logged (Rule 3 informational): brain-derive.md, query.md, and admin.md (3 of the plan's 10 files_modified) had ZERO non-canonical refs at execution time -- they were already canonical. Listed as no-op-modified for traceability and audit-completeness."
  - "Body-prose mapping: `mcp__neo4j-brain__get_neo4j_schema` -> `mcp__mindrian-brain__get_neo4j_schema` preserves the documented fallback semantics in 7 commands (deep-grade, diagnose, grade, help, organize, pipeline) where the body says 'try brain_schema first, then get_neo4j_schema as fallback'. The fallback chain remains intact; only the server-name prefix standardizes."
  - "Body-prose mapping: `mcp__pinecone-brain__search-records` body ref in compare-ventures.md line 43 -> `mcp__mindrian-brain__brain_search`. The pinecone-records semantic-search semantics map onto brain_search; the prose was rewritten to drop the explicit `Pinecone returns RESOURCE_EXHAUSTED` branch since it's no longer applicable when the call routes through the canonical brain_search interface."
  - "Plugin-side .mcp.json untouched. Plan 94-03 explicitly does NOT add a `mindrian-brain` entry to the plugin's .mcp.json (that would be a Brain bundling decision owned by Plan 94-04 -- which per CONTEXT.md may collapse to a deprecation of the bundled mcp-server-brain in favor of user's own Neo4j MCP). Users register the canonical name in their personal config."
  - "Canon Part 8 boundary preserved. brain-client.cjs chokepoint untouched. This plan only standardizes the MCP server name passed in. Zero new endpoints, zero new params, zero user-data egress added or removed. The Phase 87 Cypher sanitization + allow-list scalars contract carries forward unchanged."

patterns-established:
  - "Pattern: Single-canonical-prefix sweep across a command surface. When the plugin frontmatter contract drifts across phases (3 prefix variants accumulated v1.0 -> v1.11.0), the cheapest fix is a one-prefix sweep + an install doc that locks the contract for users. No alias system, no auto-detect; both add surface area without deepening the moat."
  - "Pattern: must_haves invariant beats files_modified list. When a plan's frontmatter under-counts the file scope, the must_haves block (which states the canonical contract) is the source of truth for what 'done' means. The files_modified list is a hint, not a contract."
  - "Pattern: install doc as user-side contract surface. Plugin-side declares the canonical prefix; user-side registers the MCP server under that name. The install doc (docs/install/BRAIN-SETUP.md) is the bridge. Future canonical-name standardizations follow this shape."
  - "Pattern: T5 smoke gate for advisory hooks. When a Phase 88.1-07-style advisory hook (always-exit-0) is the only available structural validator for a frontmatter contract, the test gate asserts invokability + non-crash, not exit-code-as-policy. The content gate lives in fixture-level greps (T1-T3 + T4 substring assertions)."

requirements-completed: []

# Metrics
duration: 22min
completed: 2026-04-28
---

# Plan 94-03 Summary

## QA reproducer (Lawrence's harness, 2026-04-28)

The v1.11.0 QA harness adopted Dr. Miriam Kaplan persona (CU Boulder JILA, NV-diamond magnetometry biomedical sensing) and ran the Brain reachability matrix against a fresh install. Phase 1 Brain probe:

```
$ /mos:compare-ventures
[graceful Tier 0 path]
"This command needs Larry's Brain connected. Run /mos:setup brain to set it up."
[zero Brain queries fire even though user has mcp__my-neo4j__read_neo4j_cypher
 returning 7,353 LazyGraphConcept nodes, 119,706 CO_OCCURS edges,
 20+ named PWS frameworks (Lean Canvas, Pyramid Principle, MECE, JTBD,
 Cynefin, Beautiful Question, Four Lenses, Systems Thinking, Design
 Thinking, etc.)]
```

Pre-94-03 root cause:

- Plugin command frontmatter declared 3 inconsistent server-name prefixes:
  - `mcp__neo4j-brain__` in 17 commands (frontmatter + body prose)
  - `mcp__pinecone-brain__` in 4 commands (frontmatter + body prose)
  - `mcp__mindrian-brain__` in 6 commands (already canonical)
- User's `.mcp.json` declared the Brain server under `my-neo4j`.
- Claude Code resolves `mcp__neo4j-brain__read_neo4j_cypher` against
  `mcpServers['neo4j-brain']`. That key does not exist in the user's
  config. The call drops, the command falls through to Tier 0.
- Decision-traces confirmed: `routing_source: legacy` and
  `brain_md_tier_mode: tier_0` on every session, regardless of Brain
  reachability.

Post-94-03 (this plan):

- All 17 commands declare a single canonical prefix: `mcp__mindrian-brain__`.
- User registers their Neo4j MCP under `mindrian-brain` in `.mcp.json`
  (per docs/install/BRAIN-SETUP.md Section 2).
- `mcp__mindrian-brain__read_neo4j_cypher` resolves against
  `mcpServers['mindrian-brain']`. The call routes. Brain becomes
  reachable from /mos:* commands.
- Decision-traces (after user wires their MCP) show `routing_source:
  engine` and `brain_md_tier_mode: mode_a` or `mode_b` on Brain-enriched
  paths. Manual end-to-end verification is deferred to Plan 94-10
  release-gate smoke.

## Files modified (17 commands + 1 install doc + 2 test infra + 1 SUMMARY)

```
commands/act.md                              -2/+1   frontmatter sweep
commands/compare-ventures.md                 -3/+2   frontmatter + 2 body
commands/deep-grade.md                       -2/+2   2 body-prose
commands/diagnose.md                         -1/+1   1 body-prose
commands/find-analogies.md                   -2/+1   frontmatter sweep
commands/find-connections.md                 -2/+2   frontmatter + 1 body
commands/grade.md                            -1/+1   1 body-prose
commands/help.md                             -1/+1   1 body-prose
commands/organize.md                         -1/+1   1 body-prose
commands/pipeline.md                         -1/+1   1 body-prose
commands/research.md                         -1/+1   1 body-prose
commands/rs-experts.md                       -1/+1   frontmatter sweep
commands/rs-explain.md                       -1/+1   frontmatter sweep
commands/rs-fetch.md                         -1/+1   frontmatter sweep
commands/rs-thesis.md                        -1/+1   frontmatter sweep
commands/scout.md                            -1/+1   frontmatter sweep
commands/suggest-next.md                     -3/+2   frontmatter + 1 body

docs/install/BRAIN-SETUP.md                 +190    NEW (5-section guide)
lib/memory/brain-server-resolution.test.cjs +322    NEW (5 fixture tests)
lib/memory/run-feynman-tests.cjs            +15     registration

.planning/phases/94-.../94-03-...-SUMMARY.md  new   this file
```

Total diff: +537 / -25 across 20 files.

## Test count + Feynman baseline delta

```
brain-server-resolution: 5/5 tests passed
  T1 every brain reference in allowed-tools uses canonical prefix  PASS
  T2 zero mcp__neo4j-brain__ references in commands/*.md           PASS
  T3 zero mcp__pinecone-brain__ references in commands/*.md        PASS
  T4 docs/install/BRAIN-SETUP.md exists with canonical content     PASS
  T5 frontmatter-schema-validator runnable smoke                   PASS

Feynman runner: baseline +1 fixture file
  Pre-94-03 baseline:  102 fixtures (per Phase 94-02 SUMMARY)
  Post-94-03 baseline: 103 fixtures (Plan 94-03 adds brain-server-resolution.test.cjs)

  Suite result: 101/103 passed, 0 skipped, 2 failed
  The 2 failures are inherited from Phase 89.4 chain-wiring (per Phase
  89.5 STATE.md note "NET IMPROVEMENT (4 -> 2 inherited failures from
  89.4)"). Identical failure set as Plan 94-02 reported. Zero new
  regressions introduced by this plan.

  Pre- and post- 94-03 failure set:
    - test/84-smart-notebook-copilot.test.cjs Test 15 phase 83 regression guard
    - tests/test-self-update-platform.cjs (5/24 self-update Windows / POSIX)
```

## Canon traceability

**Canon Part 7 (Reuse Before Build).** Option A from QA handoff Section 2 FIX-2 was the cheapest path: standardize the canonical server name across existing command frontmatter; no new alias system, no auto-detect, no new MCP server entry in the plugin's .mcp.json. The justification bar for net-new capability is met (zero net-new surface). Option B (full alias system) and Option C (auto-detect at session-start) deferred to v1.12 -- they would add surface area without deepening the moat.

**Canon Part 8 (Graph Boundary).** The Brain query chokepoint (lib/core/brain-client.cjs from Phase 87+88+90) is byte-identical pre- and post-94-03. The Phase 87 Cypher sanitization + allow-list scalars contract carries forward. Zero new endpoints, zero new params, zero user-data egress added or removed. This plan ONLY standardizes the MCP server name passed in to the chokepoint.

## End-to-end smoke evidence

```
$ grep -lE "mcp__neo4j-brain__|mcp__pinecone-brain__" commands/*.md
[empty -- exit 1 from grep, zero matches]

$ node lib/memory/brain-server-resolution.test.cjs
PASS T1 every brain reference in allowed-tools uses canonical prefix
PASS T2 zero mcp__neo4j-brain__ references in commands/*.md
PASS T3 zero mcp__pinecone-brain__ references in commands/*.md
PASS T4 docs/install/BRAIN-SETUP.md exists with canonical name + mcpServers snippet
PASS T5 frontmatter-schema-validator runnable on each modified file

brain-server-resolution: 5/5 passed
[exit 0]

$ node lib/memory/run-feynman-tests.cjs 2>&1 | tail -3
brain-server-resolution: 5/5 passed
PASS lib/memory/brain-server-resolution.test.cjs

Feynman test runner: 101/103 passed, 0 skipped, 2 failed
```

The 2 failures are pre-existing inherited failures from Phase 89.4 (test/84-smart-notebook-copilot.test.cjs Test 15 + tests/test-self-update-platform.cjs). Identical failure set pre- and post-94-03.

## Plan deviations (locked-in)

1. **Scope expansion: 10 files -> 17 files.** Plan frontmatter `files_modified` listed 10 commands. Ground-truth grep at execution time showed `mcp__neo4j-brain__` references in 17 commands (act, compare-ventures, deep-grade, diagnose, find-analogies, find-connections, grade, help, organize, pipeline, research, rs-experts, rs-explain, rs-fetch, rs-thesis, scout, suggest-next) and `mcp__pinecone-brain__` references in 4 commands (act, compare-ventures, find-analogies, suggest-next). The plan's `must_haves.truths` block is unambiguous: "Zero references to mcp__neo4j-brain__ or mcp__pinecone-brain__ remain in commands/*.md after the sweep" -- the contract is the must-have, not the files_modified list. Swept all 17 files to honor the must-have. Per phase context: "user has already approved the deviation pattern in 94-02 and 94-05. Just ship the most surgical fix that honors the plan's spirit and document the call." (Rule 2 deviation: must_haves invariant requires the broader sweep.)

2. **No-op-modified files retained for traceability.** Plan listed `commands/brain-derive.md`, `commands/query.md`, and `commands/admin.md` in `files_modified`. At execution time, grep showed ZERO non-canonical brain refs in any of them -- they were already canonical (allowed-tools lists Read/Bash/Glob with no Brain MCP entries; admin.md lists only Read/Bash/Glob; query.md lists only Read/Bash; brain-derive.md lists only `Bash(node *)`). Logged as no-op-modified in this SUMMARY for audit-completeness. The 17 actually-modified files are the canonical scope.

3. **Pinecone body-prose semantics rewrite.** Plan locked-decision said: "compare-ventures.md and suggest-next.md, the body says 'mcp__neo4j-brain tools fail' -- update to 'mcp__mindrian-brain tools fail' to match frontmatter." Implementation extended this to compare-ventures.md line 43 where the body referenced `mcp__pinecone-brain__search-records` as a fallback. Rewrote to drop the explicit `Pinecone returns RESOURCE_EXHAUSTED` branch and route through `mcp__mindrian-brain__brain_search` directly. Reason: the pinecone-records semantic-search semantics map onto brain_search (per plan locked-decision tool-name suffix mapping at line 132 of PLAN); preserving the explicit Pinecone branch in body prose would resurrect the exact drift the canonical sweep is supposed to fix.

## Closure

Plan 94-03 ready for 94-10 release-gate dependency closure. Plugin command frontmatter + body prose declare a single canonical Brain MCP prefix (`mcp__mindrian-brain__`) across 17 commands. docs/install/BRAIN-SETUP.md documents the user-side contract (canonical name + .mcp.json snippet + verification + migration + tool surface).

Brain reachability is now a one-line user config change: rename the user's existing Neo4j MCP server key to `mindrian-brain` in their personal `.mcp.json`, restart the session, and `routing_source: engine` plus `brain_md_tier_mode: mode_a/mode_b` become reachable on the next Brain-enriched command run.

Plan 94-04 (mcp-server-brain-deps) per CONTEXT.md may collapse to a deprecation path now that 94-03 Option A is shipped; FIX-3 follow-up to be evaluated when 94-04 is filed.

The 2 inherited Feynman failures from Phase 89.4 chain-wiring are pre-existing and not in scope for this plan; they will be addressed in 94-10 release-gate plan if they block tag promotion.

## Self-Check: PASSED

- [x] lib/memory/brain-server-resolution.test.cjs exists, 5/5 tests passing
- [x] docs/install/BRAIN-SETUP.md exists, contains canonical name + mcpServers snippet
- [x] All 17 commands swept; zero `mcp__neo4j-brain__` or `mcp__pinecone-brain__` references remain in commands/*.md (frontmatter OR body)
- [x] lib/memory/run-feynman-tests.cjs registers the new fixture suite (count 101/103 PASS, +1 from baseline 100/102, zero new failures)
- [x] All 3 task commits exist: 9b778dc (RED), 5f436f4 (GREEN partial), 5442079 (Task 3)
- [x] Zero em-dashes in any file modified by this plan (verified via grep -P "[\\x{2014}]")
- [x] BSL 1.1 header on lib/memory/brain-server-resolution.test.cjs
- [x] Canon Part 7 + Part 8 traceability stated in SUMMARY + BRAIN-SETUP.md
- [x] Three deviations documented (scope expansion, no-op-modified files, pinecone body-prose semantics rewrite)
