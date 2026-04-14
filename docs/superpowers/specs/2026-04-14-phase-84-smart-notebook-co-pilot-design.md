# Phase 84 - Smart Notebook (Co-Pilot) Design

- **Date**: 2026-04-14
- **Target release**: v1.10.8
- **Phase**: 84 (renumbered from original 9-plan draft to 7-plan reshape)
- **Status**: design approved, spec in review, writing-plans pending
- **Supersedes**: `.planning/phases/84-smart-notebook/84-CONTEXT.md` Revision 1 and its 9 plan files (uncommitted artifacts from the first planning pass)
- **Authority trail**:
  - `.planning/research/smart-notebook-cofounder.md` (978 lines, pass 1 research)
  - `.planning/research/smart-notebook-cofounder-appendix.md` (821 lines, pass 2 research)
  - This session's live codebase trace of `lib/core/lazygraph-ops.cjs`, `lib/core/memory-ops.cjs`, `lib/core/proactive-intelligence.cjs`, `lib/core/intelligence-cascade.cjs`, `scripts/on-stop`, `scripts/post-write`, `lib/import/PRECONDITIONS.md`

## Problem

MindrianOS does not have real cross-session memory today. v1.10.7 (Phase 83) closed the cross-session leak by injecting scope guardrails at read time, intercepting writes that cross room boundaries, classifying intent mid-session, and adding an honesty rule that forbids saying "I do not have that in working memory." The language rule is literally true because no such layer is wired.

v1.10.7 was honest about what it was not. v1.10.8 is supposed to make it untrue in the good way - ship the real memory layer. The CHANGELOG [1.10.7] "Changed" block names the promise: promote the SQLite memory layer at `lib/core/memory-ops.cjs` to load-bearing, deliver persistent cross-session memory, voice-log per room, synthesis voice room-scoping.

The first v1.10.8 planning pass produced a 9-plan chain that did real work but worked off a stale mental model of the codebase. That plan proposed four new SQL tables in memory-ops (`scaffold_log`, `voice_log`, `held_contradictions`, `decisions_index`), a Mullins 20-section scaffold JSON, and a `/mos:organize --materialize-section` subcommand. The plan was internally consistent but inherited two assumptions that turned out to be wrong on inspection of the repo.

### The two wrong assumptions

**Assumption 1: memory-ops is where new relationship data should live.** False. `lib/core/lazygraph-ops.cjs` already exists, is per-room SQLite in the same `room/.mindrian/room.db` file, and already defines 19 semantic edge types including `CONTRADICTS`, `CONVERGES`, `INVALIDATES`, `ENABLES`, `HSI_CONNECTION`, `REVERSE_SALIENT`, `ANALOGOUS_TO`, `WHITESPACE_DETECTED`, `ROOT_CAUSE_OF`, and `CASCADES_TO`. Three of the four proposed new tables (`held_contradictions`, `decisions_index`, and a stakeholder registry that would have followed) are graph concepts being reinvented as SQL rows. Forcing a contradiction into a row loses the edges to the claims it collides between. Forcing a decision into a row loses its structural edges to alternatives, assumptions, stakeholders, and outcomes.

**Assumption 2: the graph will be read by somebody if we write to it.** Trace evidence says no. The intelligence cascade (`lib/core/intelligence-cascade.cjs`, 843 lines) already runs a 6-step pipeline on every PostToolUse Write, already updates the graph via `graph-ops`, already computes HSI scores, already regenerates presentation views. And three delivery speakers already consume the cascade's output: `scripts/on-stop` reads at end-of-response, `lib/core/daily-briefing.cjs` reads at morning briefing time, `lib/core/opportunity-extractor.cjs` reads for the Opportunity Bank. But all three speakers read from `room/.proactive-intelligence.json`, a flat JSON file populated by a bash script called `analyze-room` that does its own keyword text scan. None of the speakers query the graph directly. The graph's `CONTRADICTS` edges sit in SQLite unread, and the speakers only announce findings from a parallel, weaker detector. Two detectors, one speaker array, wire connected to the wrong detector.

## The scenario frame

Before committing to the reshape, the decision was mapped as a 2x2 scenario matrix on two axes of real uncertainty:

- **Y - Storage shape**: Graph-primary (decisions/contradictions as nodes and edges) vs SQL-primary (rows in tables)
- **X - Signal delivery**: Pull (user queries on demand) vs Push (system interrupts mid-conversation)

Four named quadrants with distinct failure modes:

1. **Q1 The Library** (Graph + Pull) - quiet, correct, under-used. Fails by detecting contradictions nobody ever queries.
2. **Q2 The Co-Pilot** (Graph + Push) - the room talks back. Fails only if false positives become noise, which is mitigated by Phase 54 suppression (3-repeat threshold) and an env-gated kill switch.
3. **Q3 The Ledger** (SQL + Pull) - the original 9-plan draft. Fails by reinventing the graph in SQL and double-maintaining truth.
4. **Q4 The Alarm Clock** (SQL + Push) - worst of both worlds. Loud reinvention.

**Q2 is the only quadrant that pays off the Phase 83 investment.** Phase 83 built the `UserPromptSubmit` hook as a structurally unignorable mid-conversation channel. Q2 fills that channel with real signal from the graph MindrianOS already owns. The others leave Phase 83's channel empty or fill it with reinvented signal.

Q2 is the design.

## Architecture

### Current state

```
File Write
  -> intelligence-cascade.cjs (6 steps, debounced, batched)
     -> LazyGraph (SQLite edges, 19 edge types) ......... DEAD END (no reader)
     -> analyze-room (bash keyword scan)
        -> room/.proactive-intelligence.json (flat file)
           -> scripts/on-stop (speaker)
           -> lib/core/daily-briefing.cjs (speaker)
           -> lib/core/opportunity-extractor.cjs (speaker)
```

### Proposed state

```
File Write
  -> intelligence-cascade.cjs (unchanged, 6 steps)
     -> LazyGraph (authoritative, now includes Decision + Stakeholder node types)
        -> proactive-intelligence.cjs (NEW: bridge function queries graph edges as insights)
           -> room/.proactive-intelligence.json (cached view, suppression state preserved)
              -> scripts/on-stop (unchanged speaker)
              -> lib/core/daily-briefing.cjs (unchanged speaker)
              -> lib/core/opportunity-extractor.cjs (unchanged speaker)
              -> scripts/intent-classifier (NEW speaker: UserPromptSubmit hook reads recent findings, injects)
```

The only load-bearing new code path is the bridge function inside `proactive-intelligence.cjs` that queries LazyGraph for recent edges and returns them in the same insight format the JSON file already stores. Every downstream consumer keeps working without modification, because the JSON file format and the suppression logic stay identical. The graph goes from wall decoration to first-class input.

The `UserPromptSubmit` hook shipped in Phase 83 (`scripts/intent-classifier`) currently does token-overlap topic classification only. v1.10.8 extends it with an env-gated code path that also reads the most recent findings from `room/.proactive-intelligence.json` (already-suppressed, already-deduplicated) and injects the top 1-3 into the hook's stdout alongside any topic mismatch warning. This is the structurally unignorable channel.

### Storage split

**memory-ops.cjs (per-room SQLite in `room/.mindrian/room.db`)** - reserved for genuine event-log-shaped data only:

- `voice_log` - append-heavy raw fragments with timestamps and session id. Honestly row-shaped.
- `scaffold_log` - audit trail of which Mullins sections have been materialized when. Honestly row-shaped.

**lazygraph-ops.cjs (per-room SQLite, same db file)** - extended with two new node types that reuse the existing 19-edge vocabulary:

- `Decision` - a conclusion node. Edges: `INFORMED_BY` to claims, `CONTRADICTS` to prior decisions, `INVALIDATED_BY` to later evidence, `BELONGS_TO` the active room.
- `Stakeholder` - a person node. Edges: `INFORMED_BY` connecting a person to claims they made, `BELONGS_TO` the active room. Canonical cross-room identity is out of scope for v1.10.8; stakeholders are per-room until v1.11.x federation.

No new tables are added to memory-ops beyond `voice_log` and `scaffold_log`. No new SQL types reinvent graph concepts.

### Cross-room scope

Per-room remains the structural default. This preserves Phase 83's scope-by-construction thesis: the graph is per-room, so cross-room leak is structurally impossible at the storage layer. Any future cross-room feature uses the existing `scripts/cross-room-detect.cjs` path or a future explicit `scopedRead.unseal(reason)` primitive (v1.11.x).

The hybrid storage question raised earlier (some tables global, some per-room) dissolves under graph-primary framing: decisions and stakeholders that the user wanted global are graph nodes that already live in per-room graphs and can be traversed across rooms later via the existing federation entry point. No global SQL db is needed for v1.10.8 or v1.10.9.

## Components

1. **PRECONDITIONS.md blocker fix** - `lib/core/lazygraph-ops.cjs` has a top-level `require('better-sqlite3')` that crashes the import path for any consumer even at `--help` time. Phase 78-02 carryover, documented in `lib/import/PRECONDITIONS.md` as "still broken". Lazy-require inside the function that opens the database. Blocks nothing gracefully, restores the import path.

2. **memory-ops schema extension** - add `voice_log` and `scaffold_log` tables via `initMemorySchema()`. `CREATE IF NOT EXISTS` idempotency. Per-room room.db, same file lazygraph already owns. New public functions: `writeVoice(roomDir, fragment)`, `readVoice(roomDir, opts)`, `writeScaffoldEvent(roomDir, section, action)`, `readScaffoldLog(roomDir, opts)`.

3. **lazygraph node type extension** - add `Decision` and `Stakeholder` node types. Reuse existing edge types (`INFORMS`, `CONTRADICTS`, `BELONGS_TO`, `INVALIDATES`, `ENABLES`). New helpers: `createDecision(db, {id, rationale, alternatives})`, `createStakeholder(db, {id, name, role})`. Edge creation functions already exist.

4. **The bridge** - extend `lib/core/proactive-intelligence.cjs` with `readGraphFindings(roomDir, sinceTimestamp)`. Queries `lazygraph-ops` for recent `CONTRADICTS`, `CONVERGES`, `INVALIDATES` edges, maps each to an insight record in the same shape `parseAnalyzeOutput()` produces, merges with the existing JSON file's insight array, runs through the existing `shouldSuppress()` filter, returns the merged set. Caller in `intelligence-cascade.cjs` at line ~507 already requires proactive-intelligence; extend the call site to also call `readGraphFindings()` after the bash script finishes and write the union. **This is the load-bearing change.** After it lands, every existing speaker reads graph-sourced findings for free.

5. **UserPromptSubmit graph-findings injection** - extend `scripts/intent-classifier.cjs` (Phase 83 deliverable) with an env-gated block: when `MINDRIAN_COPILOT_INJECT_FINDINGS` is truthy (default OFF in v1.10.8, flipped to ON in v1.10.9 after one release of field testing), read the top 3 non-suppressed findings from the active room's `.proactive-intelligence.json`, format them into the hook's stdout output. Budget: existing 200ms cap still applies. Writes nothing. Reads only.

6. **Honesty layer sibling section** - `skills/larry-personality/SKILL.md` already has a `## Honesty about memory` section from Phase 83 with a `### No fake recall` sub-section. Add a sibling sub-section `### When memory is real (v1.10.8 and later)` that narrows (not replaces) the 83-08 rule: "I have that in memory" becomes a TRUE statement when the finding comes from the graph-backed `readGraphFindings()` path. Still forbidden for cross-room (scope rules still apply), still forbidden for sealed rooms (GUARDRAIL.md still applies), still forbidden for older-than-history-limit. The 83-08 test stays byte-identical and still passes.

7. **5-gate release** - CHANGELOG [1.10.8] entry, `plugin.json` 1.10.7 -> 1.10.8, `package.json` 1.10.7 -> 1.10.8, git tag `v1.10.8`, marketplace.json version + source.ref pinned. Same 5-gate sequence as Phase 83.

## Data flow

Write-time path:

1. User triggers a Write/Edit/MultiEdit via any tool.
2. PostToolUse fires `scripts/post-write`, which calls `intelligence-cascade.runCascade()`.
3. Cascade runs 6 steps. Step 2 updates LazyGraph via graph-ops. New edges of type CONTRADICTS/CONVERGES/INVALIDATES get written as a side effect of artifact indexing.
4. Cascade also runs `analyze-room` (unchanged).
5. After both finish, cascade calls `proactiveIntel.persistIntelligence(roomDir, analyzeOutput)` (existing call site at intelligence-cascade.cjs line ~507).
6. **NEW**: `persistIntelligence()` now also calls `readGraphFindings(roomDir, sinceLastRun)` and merges the result into the insight array before writing the JSON file.
7. JSON file `.proactive-intelligence.json` now contains insights sourced from BOTH the bash script AND the graph edges, deduplicated and suppression-filtered.
8. Existing speakers (on-stop, daily-briefing, opportunity-extractor) read the richer JSON on their normal schedules.

Read-time path (NEW, via Phase 83 hook):

1. User submits a prompt via any Claude Code surface.
2. UserPromptSubmit hook fires `scripts/intent-classifier` (existing Phase 83 script).
3. Hook runs token-overlap topic classification (existing behavior, byte-identical when no new findings present).
4. **NEW**: hook also reads top 3 non-suppressed findings from `room/.proactive-intelligence.json` if env gate is on.
5. Hook formats topic warnings AND graph findings into stdout.
6. Claude Code injects stdout as additionalContext into the user's prompt.
7. Claude reads the injected findings before generating the response and can acknowledge the contradiction, cite the graph edge, or ask for reframe.

The entire read path is advisory. Never blocks. Exit 0 on any internal error. Kill switch: `MINDRIAN_COPILOT_INJECT_FINDINGS=0`.

## Error handling

Every new code path follows the Phase 83 pattern: internal errors default to silent exit 0. False negatives are always preferable to false positives in a release channel. Specifically:

- `readGraphFindings()` returns empty array on graph read failure, unreadable db, missing tables (graceful before Phase 84-01 lands).
- The intent-classifier extension exits 0 silent if the JSON file is missing, corrupted, or the env gate is off.
- The bridge call site in intelligence-cascade is wrapped in try/catch so cascade never breaks if graph query fails.
- memory-ops `voice_log` and `scaffold_log` writes are best-effort; a write failure logs to stderr debug and does not propagate to the caller.

Hard constraint: nothing in Phase 84 is allowed to break any existing Phase 81/82/83 test. The 83-08 honesty layer test, 83-04 scope injection test, 83-06 write-scope-check test, 83-07 intent-classifier test, all 82-04 wiki generation tests must remain green on every commit in the Phase 84 chain.

## Testing

Same pattern as Phase 83:

- Fixture directories under `/tmp/84-test-fixtures/<uuid>/`.
- `HOME`, `CLAUDE_CONFIG_DIR`, `MINDRIAN_ROOMS_ROOT` overridden into the fixture so nothing touches real user state.
- Every test wraps in try/finally with `fs.rmSync` cleanup.
- Uses node built-in `assert` only. No jest/vitest/mocha.
- Registered with `lib/memory/run-feynman-tests.cjs`, same registration pattern as 83-04 through 83-08.

Specific test coverage required:

1. PRECONDITIONS fix: `require('./lazygraph-ops.cjs')` succeeds without a `Database` instance existing yet; `--help` code paths that previously crashed no longer crash.
2. memory-ops voice_log round-trip: write fragment, read fragment, assert ordering and timestamp.
3. memory-ops scaffold_log round-trip.
4. lazygraph Decision node create + query.
5. lazygraph Stakeholder node create + query.
6. Bridge happy path: synthetic graph with 2 CONTRADICTS edges, call `readGraphFindings()`, assert 2 insights returned in the expected shape.
7. Bridge deduplication: synthetic analyze-room output mentions the same contradiction that the graph also has; assert the merged insight list contains 1 entry, not 2.
8. Bridge failure path: graph db does not exist; assert empty array returned, no throw.
9. Hook injection happy path: synthetic JSON file with 3 findings, `MINDRIAN_COPILOT_INJECT_FINDINGS=1`, assert stdout contains all 3.
10. Hook injection kill switch: same fixture, env var unset or 0, assert stdout does not contain findings.
11. Hook injection budget: synthetic JSON with 100 findings, assert cap at 3 in output.
12. Honesty layer sibling section: SKILL.md contains both `### No fake recall` (unchanged, 83-08 test) AND `### When memory is real (v1.10.8 and later)`. Lexical order preserved (83 rule first, 84 narrowing second).
13. Phase 83 test regression: all existing 83-04/05/06/07/08 tests still pass after 84 lands.

## Plan chain (v1.10.8, seven plans, linear, parallel_safe: false)

| # | Plan | Size | Est min |
|---|---|---|---|
| 84-01 | Fix lazygraph-ops lazy-require (unblock PRECONDITIONS.md tech debt from Phase 78-02 carryover) | small | 20 |
| 84-02 | Wire memory-ops: add voice_log and scaffold_log per-room tables with read/write helpers | medium | 45 |
| 84-03 | Add Decision and Stakeholder node types to lazygraph-ops with create/query helpers | medium | 60 |
| 84-04 | The bridge: teach proactive-intelligence.cjs readGraphFindings() and wire into persistIntelligence() | large | 90 |
| 84-05 | UserPromptSubmit hook graph-findings injection (env-gated) in scripts/intent-classifier.cjs | large | 75 |
| 84-06 | Fixture-based tests: 13 cases covering bridge, hook, node types, memory tables, tech debt fix, Phase 83 regression | large | 90 |
| 84-07 | Honesty layer sibling section + CHANGELOG [1.10.8] + version bumps + git tag + marketplace 5-gate release | medium | 60 |

**Total: ~7 hours. Same-day shippable with rest breaks.**

## Out of scope for v1.10.8 (moves to v1.10.9 Compound release)

The first planning pass bundled several features into v1.10.8 that are genuinely payoff-on-top-of-foundation, not foundation itself. Pushing them to v1.10.9 makes v1.10.8 shippable in a single session and keeps the bridge function as the load-bearing focus.

- Mullins 20-section scaffold JSON + loader (original 84-04)
- `/mos:organize --materialize-section` and `--show-scaffold` subcommands (original 84-05)
- `lib/core/voice-retrieval.cjs` `scopedRead` primitive (original 84-06)
- Assumption node type + assumption invalidation propagation
- Decision provenance (Larry cites edges in responses)
- Dashboard intelligence strip live graph findings feed
- Cross-session drift detection at write time

Also explicitly out of scope for v1.10.8:

- Canonical cross-room Stakeholder identity (v1.11.x federation)
- `scopedRead.unseal()` explicit cross-room traversal primitive (v1.11.x federation)
- LLM embedding or semantic search over graph or memory-ops content (v1.11.x or later)
- Any dashboard or wiki UI changes
- Any MCP tool additions
- Desktop-mode-specific behavior differences

## Requirements (SCOPE-NB prefix)

- **SCOPE-NB-01**: `lib/core/lazygraph-ops.cjs` import path no longer crashes consumers that do not instantiate a database (PRECONDITIONS.md tech debt closed).
- **SCOPE-NB-02**: `memory-ops.cjs` exposes `writeVoice`, `readVoice`, `writeScaffoldEvent`, `readScaffoldLog` with per-room scope enforced by the room.db file path.
- **SCOPE-NB-03**: `lazygraph-ops.cjs` supports Decision and Stakeholder node types with create and query helpers.
- **SCOPE-NB-04**: `proactive-intelligence.cjs` reads LazyGraph edges as insights via `readGraphFindings()`, merged into the existing insight array with deduplication against bash-script findings.
- **SCOPE-NB-05**: `scripts/intent-classifier.cjs` reads top-N findings from `room/.proactive-intelligence.json` and injects into hook stdout when `MINDRIAN_COPILOT_INJECT_FINDINGS` is truthy.
- **SCOPE-NB-06**: Phase 83 test regression: all existing 83-NN tests remain green.
- **SCOPE-NB-07**: Test coverage: the 13 cases listed in the Testing section pass.
- **SCOPE-NB-08**: `skills/larry-personality/SKILL.md` contains both `### No fake recall` (unchanged) and `### When memory is real (v1.10.8 and later)` sub-sections.
- **SCOPE-NB-09**: CHANGELOG [1.10.8] entry present, credits the scenario reshape, names the 5 new code paths, notes the 9-to-7 plan consolidation.
- **SCOPE-NB-10**: 5-gate release: plugin.json 1.10.8, package.json 1.10.8, git tag v1.10.8, marketplace.json version + source.ref v1.10.8.

## Risks

1. **The bridge is a real behavior change.** Phase 83's read-time surface was designed to be byte-identical when no findings exist. v1.10.8 breaks that by adding a new data source. Mitigation: the bridge reads an existing JSON file that the hook already reads. The hook's injection is env-gated with a default that should be reviewed before ship. If the env gate defaults OFF, v1.10.8 ships byte-identical and users turn it on manually. If it defaults ON, users get the behavior change immediately. This is the single most important open decision before execution.

2. **graph edge write frequency may surface too many findings.** Every cascade run may produce CONTRADICTS/CONVERGES/INVALIDATES edges, and the suppression logic in `proactive-intelligence.cjs` only suppresses after 3 repeats. A noisy first session could inject 10+ findings into every prompt. Mitigation: the injection cap at 3 findings per prompt is a hard limit; suppression kicks in on repeated appearances; the env kill switch is always available.

3. **PRECONDITIONS.md fix has ripple effects.** Lazy-requiring `better-sqlite3` means consumers that previously crashed at import time now fail at first-query time instead. Mitigation: every caller of openGraph is already wrapped in try/catch per the existing defensive patterns in `scripts/cross-room-detect.cjs` and `lib/wiki/graph-links.cjs`. Plan 84-01 includes a grep for `require.*lazygraph-ops` to enumerate callers and verify each one's error handling.

4. **Test runner duration.** Phase 83 tests run in ~50 seconds total for the session-start bash invocations. Phase 84 adds graph queries to the test suite, which may add meaningful time. Mitigation: Phase 84 tests avoid spawning session-start where possible and call CJS functions directly.

5. **The "when memory is real" honesty rule is narrow.** It only applies when the finding comes from `readGraphFindings()`, not from filesystem searches that happen later in the response. Mitigation: the sibling section explicitly states this. Larry's response language still uses "let me search" for anything outside the graph-surfaced findings.

6. **False positives become prompt noise.** If the graph detects spurious CONTRADICTS edges (semantic drift, text-similarity rather than real contradiction), users experience the Co-Pilot as a chatty nag. Mitigation: (a) suppression threshold already exists; (b) env kill switch; (c) v1.10.9 adds confidence scoring and the injection can filter on confidence.

7. **Scope creep back into v1.10.8.** The Compound release backlog is tempting. Mitigation: the 7-plan chain is locked before `writing-plans` runs. Any new plans go to v1.10.9.

## Open decisions to resolve before execution

1. **Env gate default for `MINDRIAN_COPILOT_INJECT_FINDINGS`**. OFF is safer, preserves Phase 83 byte-identical behavior on first upgrade, requires manual opt-in. ON is smarter on ship day, but changes behavior the moment v1.10.8 lands. **Recommendation: default OFF in v1.10.8, flip to ON in v1.10.9 after one release of field testing.**

2. **Node type canonical IDs**. Decisions and Stakeholders need stable identifiers. Options: (a) content-hash, (b) user-provided slug, (c) UUID. **Recommendation: content-hash for Decision (same rationale + same room + same made_at = same id), UUID for Stakeholder (names are not unique, disambiguation needed).**

3. **PRECONDITIONS.md fix scope**. Does 84-01 also fix any other lazy-require issues flagged in PRECONDITIONS.md, or only the better-sqlite3 one? **Recommendation: only the better-sqlite3 one. Other issues are out of scope; cite them in the commit message for the follow-up ticket.**

These three decisions are flagged for user confirmation before `writing-plans` runs.

## Definition of done

1. All 7 plans shipped with atomic commits.
2. `lib/memory/run-feynman-tests.cjs` runner shows all 12 previously-passing test files still green, plus the new 84 test file passing.
3. `plugin.json`, `package.json`, git tag, and `~/mindrian-marketplace/.claude-plugin/marketplace.json` all show 1.10.8 / v1.10.8.
4. CHANGELOG [1.10.8] entry present at top with the scenario-reshape story.
5. `scripts/intent-classifier.cjs` has the env-gated injection path, default env state documented in CHANGELOG.
6. `skills/larry-personality/SKILL.md` has the sibling honesty section.
7. The Jonathan test: within 2 sessions of install, the UserPromptSubmit hook injects at least one real graph-sourced finding into a prompt, and the injection surfaces a contradiction Larry can cite with provenance.

## Appendix: what changed from the original 9-plan draft

| Original | New | Reason |
|---|---|---|
| 84-01 schema extension (scaffold_log, voice_log, held_contradictions, decisions_index) | Split: 84-02 (voice_log + scaffold_log in memory-ops) + 84-03 (Decision + Stakeholder as graph node types) | held_contradictions and decisions_index are graph concepts being reinvented in SQL; move to graph. |
| 84-02 room-db.cjs composition module | Dropped | Not needed. lazygraph and memory-ops already share `room/.mindrian/room.db`. |
| 84-03 session lifecycle wiring | Dropped as a separate plan | Absorbed into 84-04 bridge work, since the bridge is the thing that makes session data actually flow. |
| 84-04 Mullins scaffold JSON + loader | Dropped to v1.10.9 | Not foundation. Payoff on top of foundation. |
| 84-05 /mos:organize materialize subcommand | Dropped to v1.10.9 | Depends on scaffold loader which is now v1.10.9. |
| 84-06 voice-retrieval scopedRead primitive | Dropped to v1.10.9 / v1.11.x | Part of federation layer. Not needed until cross-room traversal is real. |
| 84-07 voice-log markdown writer + intent classifier memory augmentation | Rewritten as 84-05 | Hook injection is the right frame, not "memory augmentation". |
| 84-08 test suite | Kept as 84-06, scope reduced to the 7-plan chain | Fewer plans = fewer test fixtures. |
| 84-09 honesty layer + release | Kept as 84-07 | Unchanged. |

From 9 plans / ~10 hours / 2-3 sessions to 7 plans / ~7 hours / 1 session.

---

**Design status**: written, in review.
**Next step on approval**: invoke superpowers:writing-plans to generate 84-01 through 84-07 plan files to replace the existing Revision 1 drafts on disk.
