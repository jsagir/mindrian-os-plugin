# Phase 84 - Smart Notebook (Co-Pilot) Design

- **Date**: 2026-04-14
- **Target release**: v1.10.8
- **Phase**: 84 (plans 84-01/02/03 already shipped; this spec governs 84-04 through 84-10)
- **Status**: design approved after review + external research + reshape, spec in review
- **Supersedes**: reverted commit `23d4318` (straw-man spec that did not reflect actual repo state) and `.planning/phases/84-smart-notebook/` Revision 1 plan files for 84-04 through 84-09 (uncommitted drafts that will be replaced when `writing-plans` runs)
- **Authority trail**:
  - `docs/research/2026-04-14-stakeholder-graph-deep-research.md` - external research on knowledge-graph-powered stakeholder analysis (authority for v1.11.x Stakeholder Intelligence milestone)
  - `docs/research/2026-04-14-feynman-minto-scn-benchmark.md` - evaluation protocol for Feynman-MINTO as a taxonomy-constrained SCN extraction engine (novel MindrianOS development, v1.11.x authority)
  - `.planning/research/smart-notebook-cofounder.md` (978 lines, pass 1)
  - `.planning/research/smart-notebook-cofounder-appendix.md` (821 lines, pass 2)
  - Live codebase trace from this session of `lib/core/lazygraph-ops.cjs`, `lib/core/memory-ops.cjs`, `lib/core/proactive-intelligence.cjs`, `lib/core/intelligence-cascade.cjs`, `scripts/on-stop`, `scripts/intent-classifier.cjs`, `lib/import/PRECONDITIONS.md`, `lib/core/room-db.cjs`, `scripts/memory-lifecycle.cjs`
  - External research via Tavily on 2026 LLM agent memory architectures (Mem0, Zep, Letta, LangChain, NotebookLM, Copilot Notebooks, Dependabot alert-fatigue case study)
  - Independent code review by `superpowers:code-reviewer` agent (findings folded in as B1, B2, I1, I3, I4, I7, M1, M2, M3)

## State of Phase 84 (as of 2026-04-14 22:30 UTC)

| Plan | Status | Evidence |
|---|---|---|
| **84-01** | **DONE** | commit `f020f81` "extend initMemorySchema with 4 smart-notebook tables"; tables `scaffold_log`, `voice_log`, `held_contradictions`, `decisions_index` live in `memory-ops.cjs` L82-128; helpers `logScaffoldAction()` and `writeVoiceLogStub()` at L444-490; `84-01-SUMMARY.md` present |
| **84-02** | **DONE** | commit `8011d9a` "add room-db.cjs composition module"; `lib/core/room-db.cjs` (57 lines) exports `openRoomDb`/`closeRoomDb`; `84-02-SUMMARY.md` present |
| **84-03** | **DONE** | commits `bd42654` + `d8b364e` + `fe33d3b` + gitignore touches; `scripts/memory-lifecycle.cjs` (320 lines) with 4 subcommands; wired into `scripts/on-stop` L175-190, session-start hook, pre/post-compact hooks; `84-03-SUMMARY.md` present (17KB) |
| 84-04 | NOT STARTED | Revision 1 plan file exists (8.6KB); scope was Mullins 20-section scaffold JSON + loader |
| 84-05 | NOT STARTED | Revision 1 plan file exists (5.8KB); scope was `/mos:organize --materialize-section` subcommand |
| 84-06 | NOT STARTED | Revision 1 plan file exists (7.8KB); scope was voice-retrieval `scopedRead` primitive |
| 84-07 | NOT STARTED | Revision 1 plan file exists (7.5KB); scope was voice-log markdown writer + intent classifier augmentation |
| 84-08 | NOT STARTED | Revision 1 plan file exists (9.2KB); scope was fixture-based tests |
| 84-09 | NOT STARTED | Revision 1 plan file exists (19.5KB); scope was honesty layer + release |

**3 of 9 Revision 1 plans shipped. 6 not started.** This spec governs the 6 unfilled slots.

## Problem

v1.10.7 (Phase 83) closed the cross-session leak with scope-by-construction: read-time injection, write-time interception, message-time intent classification, honesty rule. The v1.10.7 CHANGELOG "Changed" section openly acknowledged that MindrianOS does not yet have real cross-session memory, and promised v1.10.8 would promote the SQLite memory layer at `lib/core/memory-ops.cjs` to load-bearing.

Plans 84-01/02/03 partially delivered that promise in this same session: the schema was extended, a composition module (`room-db.cjs`) was added, and a memory lifecycle dispatcher (`memory-lifecycle.cjs`) was wired into the session-start, stop, and compact hooks. What landed is a real per-room SQLite lifecycle with session rows, fragment rows, voice-log stubs, and scaffold-log audit events.

**What did not land is the load-bearing question**: how do findings the system already detects flow into user-visible channels?

A live trace of the repo shows the answer: today they do not. The intelligence cascade (`lib/core/intelligence-cascade.cjs`, 843 lines) already runs a 6-step pipeline on every PostToolUse Write, already calls `graph-ops` to update `lazygraph-ops.cjs`, already writes edges of type `CONTRADICTS`, `CONVERGES`, `INVALIDATES`, `ENABLES`, `HSI_CONNECTION`, `REVERSE_SALIENT`, `ANALOGOUS_TO`, `WHITESPACE_DETECTED`, `ROOT_CAUSE_OF`, `CASCADES_TO`, and 9 others into the per-room graph. Three existing delivery speakers (`scripts/on-stop`, `lib/core/daily-briefing.cjs`, `lib/core/opportunity-extractor.cjs`) already consume cascade output on their normal schedules. But all three speakers read from a flat JSON file at `room/.proactive-intelligence.json`, populated by a bash script called `analyze-room` that does its own keyword text scan. **None of the speakers query the graph directly.** The graph's `CONTRADICTS` edges sit in SQLite unread, and the speakers only announce findings from a parallel, weaker detector.

Two detectors, one speaker array, wire connected to the wrong detector. That is the v1.10.8 problem.

## The scenario frame and chosen path

Before committing to the reshape, the decision was mapped as a 2x2 scenario matrix on two axes of real uncertainty:

- **Y - Storage shape**: Graph-primary (relationships as nodes and edges) vs SQL-primary (relationships as rows in tables)
- **X - Signal delivery**: Pull (user queries on demand) vs Push (system interrupts mid-conversation)

Four named quadrants with distinct failure modes:

1. **Q1 The Library** (Graph + Pull) - quiet, correct, under-used. Fails by detecting contradictions nobody ever queries.
2. **Q2 The Co-Pilot** (Graph + Push) - the room talks back. Fails only if false positives become noise, mitigated by Phase 54 suppression and an env-gated kill switch.
3. **Q3 The Ledger** (SQL + Pull) - reinventing graph concepts in SQL rows. Fails by double-maintained truth.
4. **Q4 The Alarm Clock** (SQL + Push) - loud reinvention. Worst of both worlds.

External research via Tavily on 2026 LLM agent memory architectures confirms Q2 direction:

- **Mem0, Zep, and Letta all treat contradiction detection as a write-time signal that must flow into agent context.** A graph that writes `CONTRADICTS` edges with no downstream consumer matches none of the live 2026 patterns. Source: mem0.ai/blog/state-of-ai-agent-memory-2026; evermind.ai/blogs/zep-alternative.
- **15-point LongMemEval gap** between graph-only systems (Mem0 at 49.0%) and graph-plus-context systems (Zep at 63.8%). Measurable retention cost for leaving the graph unread. Source: vectorize.io/articles/best-ai-agent-memory-systems.
- **Dependabot is the cautionary tale for push channels without suppression.** A Go security lead publicly called it "a noise machine... turn it off." GitHub's response was an auto-dismiss rules engine. Suppression must be built in from day one. Source: devclass.com/security/2026/02/26/github-dependabot-is-a-noise-machine.
- **Notebook framing in 2026 wraps co-pilot, not either/or.** Microsoft Copilot Notebooks + NotebookLM both pair a structured writing surface with a live AI channel. Retention pattern is co-present, not either/or. Source: support.microsoft.com/en-us/topic/compare-microsoft-loop-copilot-pages-and-copilot-notebooks.

**The chosen path is Path C (Hybrid)**: ship both the notebook writing surface (Mullins 20-section scaffold) and the co-pilot inject channel (bridge + UserPromptSubmit hook). C is the only quadrant corroborated by both bodies of evidence.

Within Path C, external research by the project lead on knowledge-graph-powered stakeholder analysis (`docs/research/2026-04-14-stakeholder-graph-deep-research.md`) raised a refinement: **C2** adds a Stakeholder node type to `lazygraph-ops` because stakeholder-as-node (not row) is the only way to get multi-hop influence paths, PageRank, betweenness, and community detection. The reviewer's earlier pushback (I7) that Stakeholder has no v1.10.8 consumer was overridden by the research: the bridge function itself becomes the first consumer, via multi-hop traversals from `CONTRADICTS`/`CONVERGES` edges back to stakeholders and across their other claims, without requiring the GDS algorithm layer.

Within C2, the schema shape decision resolved to **option Z (minimal + metadata JSON blob)**: Stakeholder node has identity + type + name + canonical_ref + notes + JSON metadata blob. Power/interest/stance live as edge properties in v1.11.x when Initiative and Claim node types land as edge targets. Storing stance on the Stakeholder node today would put the data on the wrong side of the model and guarantee a migration pass.

**Option W** (ship stakeholder-to-stakeholder Feynman-MINTO extraction in v1.10.8, defer initiative/claim extraction to v1.11.x) was considered and explicitly rejected. W is model-correct but splits one conceptual feature across two releases, which is two builds of the same thing. W is recorded in the "Out of scope" section below so future planners do not relitigate.

## Architecture

### Current state (as of 84-03 shipped)

```
File Write (Write / Edit / MultiEdit tool)
  -> intelligence-cascade.cjs runCascade() at lines 507 and 788
     -> graph-ops updates lazygraph-ops (SQLite edges, 19 edge types)
     |    DEAD END: no downstream consumer reads these edges
     -> analyze-room bash keyword scan
        -> proactiveIntel.persistIntelligence() writes room/.proactive-intelligence.json
           -> scripts/on-stop (reads JSON at end of response)
           -> lib/core/daily-briefing.cjs (reads JSON for morning brief)
           -> lib/core/opportunity-extractor.cjs (reads JSON for Opportunity Bank)

Session lifecycle (84-03 delivered)
  -> scripts/memory-lifecycle.cjs
     -> session-start: creates session row in memory-ops
     -> addFragment: writes fragment rows
     -> stop: writes voice_log stub row, closes session
     -> pre-compact / post-compact: session state transitions
```

### Proposed state (84-04 through 84-09)

```
File Write
  -> intelligence-cascade.cjs (unchanged)
     -> graph-ops updates lazygraph-ops (now includes Stakeholder node type)
        -> proactive-intelligence.cjs persistIntelligence() (extended)
           -> [NEW BRIDGE] readGraphFindings(roomDir, sinceTimestamp)
           -> queries graph for recent CONTRADICTS / CONVERGES / INVALIDATES edges
           -> walks claims -> stakeholders -> other claims via existing edges
           -> maps each to insight shape identical to parseAnalyzeOutput() output
           -> merges into .proactive-intelligence.json at both cascade call sites (L507 AND L788)
           -> existing shouldSuppress() dedup works because insight ID shape is preserved
     -> analyze-room bash scan (unchanged)
     -> union of graph findings + bash findings written to .proactive-intelligence.json

Read-time (existing Phase 83 hook, extended)
  -> UserPromptSubmit fires scripts/intent-classifier.cjs
     -> topic classification (unchanged Phase 83 behavior)
     -> [NEW: env-gated] readGraphFindings tail of .proactive-intelligence.json
     -> top-3 non-suppressed findings injected as additionalContext
     -> env gate: MINDRIAN_COPILOT_INJECT_FINDINGS defaults to 1 (ON) with hardcoded top-3 cap
     -> kill switch: MINDRIAN_COPILOT_INJECT_FINDINGS=0 restores byte-identical Phase 83 behavior

Session lifecycle (84-07 extends 84-03)
  -> scripts/memory-lifecycle.cjs (extended)
     -> stop: voice_log row now populated from session fragments (not just stub)
     -> on-stop: reads voice_log for the closing session, surfaces in end-of-response summary
     -> closes the "nobody reads the store" anti-pattern at v1.10.8 time, not v1.10.9
```

### Storage split

**memory-ops.cjs (per-room SQLite in `room/.mindrian/room.db`)** - tables already present from 84-01, helpers already present. v1.10.8 additions:

- voice_log population from session fragments (currently stub, 84-07 fills it)
- scaffold_log audit events written from 84-04 scaffold materialization

No new tables in v1.10.8. No schema migration. The 84-01 schema is sufficient.

**lazygraph-ops.cjs (per-room SQLite, same db file)** - v1.10.8 additions:

- `Stakeholder` node type (person, org, coalition, role). Minimal schema: id (UUID), type, name, canonical_ref, notes, metadata (JSON blob), created_at, updated_at. Helpers: `createStakeholder({type, name, metadata})`, `getStakeholder(id)`, `findStakeholdersByClaim(claimId)`, `upsertStakeholder(canonical_ref, fields)`.
- No new edge types. Existing `INFORMS`, `BELONGS_TO`, and `CONTRADICTS` are sufficient for bridge traversal from claim to stakeholder to other claims.
- Power/interest/stance fields are **not** added to the node. Per the research, they are edge properties on `IS_STAKEHOLDER_IN` and `INFLUENCES` edges, which land in v1.11.x when Initiative and Claim node types land as edge targets.

### Cross-room scope

Per-room remains the structural default. Phase 83 scope-by-construction still holds: the graph is per-room, so cross-room leak is structurally impossible at the storage layer. Cross-room features are v1.11.x scope via the existing `scripts/cross-room-detect.cjs` path and a future `scopedRead.unseal(reason)` primitive.

## Components (7 concrete pieces, 6 plans)

1. **Mullins 20-section scaffold JSON + loader (plan 84-04)**. A declarative `skills/mullins-scaffold/scaffold.json` file listing the 20 canonical Mullins 7-domain venture assessment sections (market, industry, team, mission, connections, execution, margin + subsections). A small CJS loader at `lib/core/mullins-scaffold.cjs` that reads the JSON and exposes query helpers: `listSections()`, `getSection(id)`, `sectionExists(id)`. The scaffold is optional: room STATE.md can reference it for section structure, but rooms that do not are untouched. Users can skip the scaffold entirely. **Rigidity lock**: template, not mandatory skeleton.

2. **Stakeholder node type in lazygraph-ops (part of plan 84-05)**. Schema extension to `lazygraph-ops.cjs initSchema()`: new `stakeholders` table with the minimal + metadata JSON blob shape described in the Storage split section. Helper functions added to the lazygraph-ops public API. No edge type additions. Integrates with existing `MERGE`-style idempotency patterns.

3. **The bridge (part of plan 84-05)**. New function `readGraphFindings(roomDir, sinceTimestamp)` in `lib/core/proactive-intelligence.cjs`. Queries lazygraph for recent edges of type `CONTRADICTS`, `CONVERGES`, `INVALIDATES`. For each edge, walks to the Stakeholder nodes connected to either endpoint via `INFORMS` edges (if present), gathering up to 5 other claims from those stakeholders. Maps the edge + stakeholder + related claims into an insight record using the exact shape `parseAnalyzeOutput()` produces: `{type, subtype?, section?, confidence, message}`, with a stable ID derivation that matches the bash-script findings so `shouldSuppress()` dedup works. Returns the merged insight array.

4. **Bridge integration at cascade call sites (part of plan 84-05)**. The function `persistIntelligence(roomDir, analyzeOutput)` in proactive-intelligence.cjs is extended to call `readGraphFindings()` after the bash-script parse, merge the two arrays, run the existing dedup/suppression filter, then write the union to `.proactive-intelligence.json`. **Both** call sites in `intelligence-cascade.cjs` (line ~507 AND line ~788) must be covered, per reviewer finding I1. Wrapped in try/catch so graph query failure never breaks the cascade.

5. **UserPromptSubmit graph-findings injection (plan 84-06)**. Extends `scripts/intent-classifier.cjs` (Phase 83-07 deliverable) with an env-gated code path. When `MINDRIAN_COPILOT_INJECT_FINDINGS` is truthy (default `1`, ON), reads the top 3 non-suppressed findings from the active room's `.proactive-intelligence.json`, formats them into the hook's stdout alongside existing topic classification output. Hardcoded top-3 cap is the suppression mechanism (Dependabot lesson: suppression from day one). Kill switch: `MINDRIAN_COPILOT_INJECT_FINDINGS=0` restores byte-identical Phase 83 behavior. Existing 200ms budget still applies; JSON read is fast. Writes nothing. On any internal error, exits 0 silent (no injection, no prompt disruption).

6. **Voice-log writer + reader (plan 84-07)**. Extends `scripts/memory-lifecycle.cjs stop` to populate `voice_log` with structured rows built from the session's fragments (not just the current stub). Extends `scripts/on-stop` to read the voice_log tail at session end and surface a short "session summary" alongside existing cascade output. This closes the "nobody reads the store" anti-pattern at v1.10.8 time: writer AND reader both ship together. Essential per the external research Q3 finding that shipping just the writer would reinvent the bug Phase 84 was meant to fix.

7. **Self-update script rewrite for versioned-cache model (plan 84-09)**. Rewrites `scripts/self-update` to stop fighting the versioned cache model. The current script uses `STAGE="$CACHE_DIR/.update-stage"` where `$CACHE_DIR` is the version-named dir (e.g., `mos/1.10.5/`), then does `mv $CACHE_DIR $OLD_DIR` followed by `mv $STAGE $CACHE_DIR`. The first `mv` takes `.update-stage` with it (because it is inside `$CACHE_DIR`), so the second `mv` reads a stale path and fails. This was observed live on 2026-04-14 during an attempted v1.10.5 -> v1.10.7 update on the project lead's machine and left the cache in a broken state that required manual recovery (the staged v1.10.7 install was moved from `1.10.5.old-807316/.update-stage` to `mos/1.10.7/` by hand). The rewrite drops the atomic swap dance entirely: clone the target version into a new sibling directory `mos/<new-version>/` via a fresh `git clone` + `git checkout <tag>`, never touch the previous version's directory, let the 83-01 statusline-mos wrapper resolve highest-semver automatically. Preserve `.env` and user modifications via the existing backup step (which was working correctly; it was only the atomic swap that failed). The new script has four steps: (a) clone target version to staging area OUTSIDE any version dir (e.g., `/tmp/mos-update-$$`), (b) validate staged copy, (c) `mv` staging area to `mos/<new-version>/`, (d) run `npm install` in the new dir. No rename-to-old, no in-place swap, no mv-reorder hazard. Closes SCOPE-NB-14.

8. **Honesty layer sibling section + 5-gate release (plan 84-10)**. Adds `### When memory is real (v1.10.8 and later)` sub-section to `skills/larry-personality/SKILL.md`, placed immediately after the existing `### No fake recall` sub-section. Narrows (does not replace) the Phase 83-08 rule: "I have that in memory" becomes a TRUE statement when the finding comes from the graph-backed `readGraphFindings()` path. Still forbidden for cross-room content, still forbidden for sealed rooms, still forbidden for older-than-history-limit content. The 83-08 test stays byte-identical and still passes; a new test asserts the sibling section exists and lexically follows the 83-08 section. Then the 5-gate release sequence: CHANGELOG [1.10.8] entry, `plugin.json` 1.10.7 -> 1.10.8, `package.json` 1.10.7 -> 1.10.8, git tag `v1.10.8`, marketplace.json version + source.ref pinned.

Plan 84-08 covers tests for all of the above including self-update fixtures (see Testing section).

## Data flow

**Write-time path** (user edits a file):

1. PostToolUse fires `scripts/post-write` which calls `intelligence-cascade.runCascade()`.
2. Cascade runs its 6 existing steps. Step 2 updates lazygraph via graph-ops with any new `CONTRADICTS`/`CONVERGES`/`INVALIDATES` edges.
3. Cascade runs analyze-room bash script (unchanged).
4. Cascade calls `proactiveIntel.persistIntelligence(roomDir, analyzeOutput)` at line ~507 (single write path) or ~788 (batched write path).
5. **NEW**: `persistIntelligence()` now also calls `readGraphFindings(roomDir, sinceLastRun)` which queries lazygraph for recent edges, walks to Stakeholders via `INFORMS` edges, builds insight records in the `parseAnalyzeOutput()` shape, returns the array.
6. `persistIntelligence()` merges the bash-script insights and the graph insights, runs `shouldSuppress()` dedup, writes the union to `.proactive-intelligence.json`.
7. Existing speakers (on-stop, daily-briefing, opportunity-extractor) read the richer JSON on their normal schedules. No changes to their read paths.

**Read-time path** (user opens a prompt):

1. Claude Code fires UserPromptSubmit hook.
2. Hook dispatches `scripts/intent-classifier.cjs` via `run-hook.cmd`.
3. Classifier runs topic classification (Phase 83 behavior, unchanged).
4. **NEW**: if `MINDRIAN_COPILOT_INJECT_FINDINGS` is truthy, reads top 3 non-suppressed findings from active room's `.proactive-intelligence.json`.
5. Formats topic warnings AND graph findings into stdout.
6. Claude Code injects stdout as additionalContext into the user's prompt.
7. Claude reads the injected findings before generating the response, can acknowledge the contradiction, cite the graph-backed provenance, or ask for reframe.

**Session-end path** (user stops talking, Claude finishes):

1. Stop hook fires `scripts/on-stop`.
2. on-stop calls `memory-lifecycle.cjs stop`, which now populates `voice_log` from the session's fragment rows (not just a stub).
3. on-stop reads the latest `voice_log` row for this session.
4. on-stop surfaces a short summary line based on the voice_log row, alongside existing STATE.md analytics update.

Every new path defaults to silent exit 0 on internal error. Cascade, session-start, on-stop, and the intent-classifier hook never fail due to Phase 84 code.

## Error handling

Every new code path follows the Phase 83 pattern:

- `readGraphFindings()` returns empty array on any graph read failure. Graph db missing, tables missing (before 84-05 lands), unreadable, locked - all return `[]`.
- The bridge call site at both L507 and L788 wraps the `readGraphFindings()` call in try/catch. Failure is logged to stderr debug only, cascade continues with bash-script insights alone.
- The intent-classifier extension exits 0 silent if the JSON file is missing, corrupted, or the env gate is off. No injection, no prompt disruption, no stderr.
- voice_log writer writes are best-effort; failure is stderr debug and does not propagate.
- on-stop voice_log read: if read fails, fall through to existing analytics summary. Zero user-visible change.

**Hard constraint**: nothing in Phase 84 is allowed to break any existing Phase 81, 82, or 83 test. Specifically, the 83-08 honesty layer test, 83-04 scope injection test, 83-06 write-scope-check test, 83-07 intent-classifier test, all 82-04 wiki generation tests, all 81 Feynman engine tests, and the 84-01/02/03 tests that already passed in their SUMMARY files must remain green on every commit in the 84-04 through 84-09 chain.

## Testing

Same pattern as Phase 83:

- Fixture directories under `/tmp/84-test-fixtures/<uuid>/`.
- `HOME`, `CLAUDE_CONFIG_DIR`, `MINDRIAN_ROOMS_ROOT` overridden into fixture so nothing touches real user state.
- Every test wraps in try/finally with `fs.rmSync` cleanup.
- Uses node built-in `assert` only. No jest/vitest/mocha.
- Registered with `lib/memory/run-feynman-tests.cjs`, same pattern as 83-04 through 83-08 test files.

Specific test coverage in plan 84-08:

1. Stakeholder node type: create, get, upsert, findByClaim (all 4 helpers with fixture data)
2. Stakeholder metadata JSON blob: write structured metadata, read back via `json_extract`, verify forward-compat path
3. Bridge happy path: synthetic graph with 2 CONTRADICTS edges and 2 linked Stakeholders, call `readGraphFindings()`, assert 2 insights with correct IDs
4. Bridge dedup: bash-script output mentions the same contradiction the graph also has; assert merged insight list has 1 entry via `shouldSuppress()` existing dedup
5. Bridge failure path: graph db does not exist; assert empty array returned, no throw
6. Bridge L507 call site coverage: single-write cascade path surfaces graph findings
7. Bridge L788 call site coverage: batched-write cascade path surfaces graph findings (reviewer finding I1)
8. UserPromptSubmit injection happy path: env gate ON, 3 findings in JSON, assert stdout contains all 3
9. UserPromptSubmit injection env-OFF byte-identical: env gate `MINDRIAN_COPILOT_INJECT_FINDINGS=0`, assert stdout is byte-for-byte identical to Phase 83 baseline (reviewer finding I3)
10. UserPromptSubmit injection cap: 100 findings in JSON, assert exactly 3 in stdout
11. UserPromptSubmit injection error path: corrupt JSON, assert exit 0 silent, no prompt disruption
12. Voice-log writer: stop hook populates voice_log with structured row (not stub), assert row fields
13. Voice-log reader: on-stop reads voice_log tail, assert summary line present in output
14. Honesty layer sibling section: SKILL.md contains both `### No fake recall` (Phase 83-08, unchanged) and `### When memory is real (v1.10.8 and later)`, and the lexical order is preserved (83-08 first, 84 sibling second)
15. Phase 83 test regression: all existing 83-04/05/06/07/08 tests still pass after 84 lands (run the full runner as part of 84-08 pre-commit check)
16. Mullins scaffold loader: fixture scaffold JSON, assert `listSections()` returns 20, `getSection()` returns correct shape, `sectionExists("market")` returns true
17. Self-update happy path: fixture cache with `mos/1.10.5/`, run rewritten self-update targeting `1.10.6`, assert `mos/1.10.6/` exists alongside `mos/1.10.5/`, both dirs intact, new version `plugin.json` reports 1.10.6, statusline-mos wrapper resolves to 1.10.6
18. Self-update preserves `.env` and node_modules: fixture `mos/1.10.5/.env` with test content, run update, assert `mos/1.10.6/.env` has identical content, `mos/1.10.6/node_modules` present, old `mos/1.10.5/.env` untouched

Insight-ID-shape requirement (reviewer finding I4): graph findings MUST use the same insight shape and ID derivation as `parseAnalyzeOutput()` produces, so `shouldSuppress()` repeat-count keying works. Explicit test case 4 above validates this.

## Plan chain (v1.10.8, seven plans, linear, parallel_safe: false)

| # | Plan | Size | Est min |
|---|---|---|---|
| 84-04 | Mullins 20-section scaffold JSON + loader (`lib/core/mullins-scaffold.cjs`) | medium | 75 |
| 84-05 | Stakeholder node type in lazygraph-ops + bridge `readGraphFindings()` in proactive-intelligence.cjs + wire into both cascade call sites | large+ | 120 |
| 84-06 | UserPromptSubmit graph-findings injection in intent-classifier.cjs (env-gated, top-3 cap, default ON, kill switch) | large | 75 |
| 84-07 | Voice-log writer + reader: extend memory-lifecycle stop + on-stop integration | medium | 60 |
| 84-08 | Fixture-based tests (16 cases covering all above plus Phase 83 regression guard) | large | 90 |
| 84-09 | Self-update script rewrite for versioned-cache model (drop atomic-swap, clone to sibling dir, preserve .env and mods) | medium | 60 |
| 84-10 | Honesty layer sibling section + CHANGELOG [1.10.8] + version bumps + git tag + marketplace 5-gate release | medium | 60 |

**Total: ~8-9 hours. Single long session or split across two.**

Plans are linear (`parallel_safe: false`), each depends on the previous. 84-05 is the largest because it combines the Stakeholder node type and the bridge into one plan; splitting them would force two commits touching the same file boundary in lazygraph-ops / proactive-intelligence, which is worse than one focused commit.

## Out of scope for v1.10.8

### Deferred to v1.10.9 Compound release

- `/mos:organize --materialize-section` and `--show-scaffold` subcommands (materialization path from scaffold into room sections)
- Voice-retrieval `scopedRead` primitive (cross-session content retrieval helper)
- Assumption node type with propagation logic
- Decision node type (reviewer finding I7: no v1.10.8 consumer; deferred until Initiative + Claim nodes land)
- Decision provenance with edge citations in Larry responses
- Dashboard intelligence strip live graph-findings feed
- Cross-session drift detection at write time
- Writing-plans execution of the reshaped 84-04 through 84-09 plan files

### Deferred to v1.11.x Stakeholder Intelligence milestone

- `Initiative` and `Claim` node types in lazygraph-ops
- Extended edge vocabulary per the stakeholder research doc (IS_STAKEHOLDER_IN, INFLUENCES, FUNDS, REGULATES, PARTNERS_WITH, OPPOSES, IS_MEMBER_OF, COMMUNICATES_WITH) with power/interest/stance as edge properties
- Feynman-MINTO as taxonomy-constrained SCN extraction engine (see v1.11.x authority section below)
- GDS algorithms (PageRank, Louvain community detection, betweenness centrality) in userspace CJS or wired to Brain MCP
- `/mos:stakeholders` command with influence path traversal
- Brain MCP integration for Neo4j + GDS execution
- Canonical cross-room Stakeholder identity resolution
- Full agentic research loop (LLM extracts -> graph ingest -> GDS -> LLM reasons -> new research queries)

### Option W: explicitly rejected

**Option W** would have shipped stakeholder-to-stakeholder Feynman-MINTO extraction in v1.10.8 (the `Stakeholder x Stakeholder` subset of the full codomain) and deferred initiative/claim extraction to v1.11.x. W is model-correct (it uses the graph as the relationship store, not SQL rows) but splits one conceptual feature across two releases. Two builds of the same engine, same tests, same bridge. Rejected in favor of Z (no extractor in v1.10.8 at all) because the interesting bits of the research are primarily about stakeholders in relation to initiatives and claims, not just each other, and shipping a partial codomain creates migration debt when the full codomain lands. **W is explicitly recorded here so future planning does not relitigate it.**

### Also out of scope (unchanged from the Revision 1 plan's explicit out-of-scope list)

- LLM embedding or semantic search over graph or memory-ops content
- Any dashboard or wiki UI changes in v1.10.8
- MCP tool additions
- Desktop-mode-specific behavior differences

## v1.11.x Stakeholder Intelligence milestone (authority paragraph)

*v1.11.x Stakeholder Intelligence milestone will use the Feynman-MINTO engine (`skills/feynman-engine/`, Phase 81 deliverable) as the taxonomy-constrained extraction pipeline. Design brief: Feynman-MINTO produces taxonomy-guided NER + relation extraction yielding `{name, type, evidence, candidate_edges: [{target_type, target_id, edge_type, power, interest, stance}]}` tuples. The v1.10.8 stakeholder helpers (`createStakeholder`, `upsertStakeholder`) accept these tuples now via the `metadata` blob; v1.11.x adds Initiative and Claim node types and migrates the blob contents into proper edge properties. See `docs/research/2026-04-14-stakeholder-graph-deep-research.md` for full scope and `docs/research/2026-04-14-feynman-minto-scn-benchmark.md` for the evaluation protocol governing the engine's first deployment as an SCN extractor.*

## Requirements (SCOPE-NB prefix)

- **SCOPE-NB-01**: Mullins 20-section scaffold JSON exists at `skills/mullins-scaffold/scaffold.json` with all 7 domains and 20 canonical sections
- **SCOPE-NB-02**: `lib/core/mullins-scaffold.cjs` exposes `listSections`, `getSection`, `sectionExists` with full JSDoc and error handling
- **SCOPE-NB-03**: `lazygraph-ops.cjs` adds `Stakeholder` node type with minimal + metadata JSON blob schema
- **SCOPE-NB-04**: `lazygraph-ops.cjs` exposes `createStakeholder`, `getStakeholder`, `findStakeholdersByClaim`, `upsertStakeholder` helpers
- **SCOPE-NB-05**: `proactive-intelligence.cjs` exposes `readGraphFindings(roomDir, sinceTimestamp)` that queries lazygraph edges and returns insights in `parseAnalyzeOutput()` shape
- **SCOPE-NB-06**: `persistIntelligence()` merges graph insights with bash-script insights at both cascade call sites (L507 AND L788)
- **SCOPE-NB-07**: Graph findings use the same insight shape and ID derivation as `parseAnalyzeOutput()` output so `shouldSuppress()` dedup works (reviewer finding I4)
- **SCOPE-NB-08**: `scripts/intent-classifier.cjs` reads top-3 findings from `.proactive-intelligence.json` when `MINDRIAN_COPILOT_INJECT_FINDINGS` is truthy (default ON), byte-identical to Phase 83 when kill switch is set to 0 (reviewer finding I3)
- **SCOPE-NB-09**: `scripts/memory-lifecycle.cjs stop` populates `voice_log` with structured rows built from session fragments (not stub)
- **SCOPE-NB-10**: `scripts/on-stop` reads `voice_log` tail at session end and surfaces a short session summary
- **SCOPE-NB-11**: `skills/larry-personality/SKILL.md` contains both `### No fake recall` (Phase 83, unchanged) and `### When memory is real (v1.10.8 and later)` sub-sections; the 83 test still passes and a new test asserts the sibling
- **SCOPE-NB-12**: Phase 83 test regression guard: all existing 83-04/05/06/07/08 tests remain green
- **SCOPE-NB-13**: CHANGELOG [1.10.8] entry, `plugin.json` 1.10.8, `package.json` 1.10.8, git tag `v1.10.8`, marketplace.json version + source.ref pinned. All 5 gates green
- **SCOPE-NB-14**: `scripts/self-update` successfully installs a new version into a sibling `mos/<version>/` cache directory without moving, renaming, or deleting the previous version's directory. User modifications and `.env` are preserved via the existing backup path. The 83-01 statusline-mos wrapper resolves to the highest installed version after install completes. Fixture-based tests in 84-08 validate the behavior before 84-10 ships

## Risks

1. **Graph query failure in hot path.** The bridge runs inside the cascade on every write. A slow or locked SQLite read could degrade write latency. Mitigation: `readGraphFindings()` is wrapped in try/catch with silent empty-array return; the cascade batch-queue from Phase 54 already rate-limits writes per room; the query itself is indexed on edge type + timestamp so it hits the fast path even under load.

2. **UserPromptSubmit 200ms budget blown by JSON read.** The classifier's existing budget is 200ms. Adding a JSON file read + top-3 selection uses ~5-20ms. Mitigation: hard cap at 3 findings; read only the tail of the JSON; if the existing topic classification already took 150ms, skip the graph-findings read and return topic-only.

3. **False positives become prompt noise.** The Dependabot case study is explicit: push channels without suppression become noise. Mitigation: (a) top-3 hardcoded cap IS the suppression; (b) existing Phase 54 suppression threshold (3-repeat) already deduplicates; (c) env kill switch `MINDRIAN_COPILOT_INJECT_FINDINGS=0` is always available; (d) v1.10.9 adds confidence-based filtering if noise proves to be an issue.

4. **Insight ID mismatch breaks dedup.** If graph-sourced findings use a different ID derivation than `parseAnalyzeOutput()` output, `shouldSuppress()` will double-count and users will see repeated findings. Mitigation: SCOPE-NB-07 makes ID-shape alignment a hard requirement; explicit test case 4 validates dedup on synthetic input with both a graph edge and a bash-script mention of the same contradiction.

5. **voice_log writer without reader recreates the anti-pattern.** External research Q3 flagged this: writing to a store nobody reads is exactly the bug Phase 84 was meant to fix. Mitigation: plan 84-07 ships writer AND reader together. Both are required for the plan to be considered done; neither lands without the other.

6. **Phase 83 regression in the honesty layer test.** The 83-08 test asserts specific markdown anchors in SKILL.md. Adding a sibling section near the 83-08 section risks breaking the anchor test. Mitigation: the new section is placed AFTER the 83-08 section in lexical order, not before; the 83-08 test uses a "section present and CORRECT lexically before INCORRECT" pattern that does not care about sibling sections; a new explicit test in 84-08 asserts the sibling is present and lexically follows.

7. **Env gate default ON contradicts the reviewer's earlier OFF recommendation.** Reviewer I3 suggested OFF for byte-identical Phase 83 behavior on upgrade. External research (Mem0/Zep 15-point LongMemEval gap, Dependabot case) flipped this to ON with top-3 cap as the suppression mechanism. The kill switch `MINDRIAN_COPILOT_INJECT_FINDINGS=0` provides escape for any user who wants Phase 83-byte-identical behavior. Mitigation: the decision is explicitly locked here after weighing both inputs; documented in the CHANGELOG; kill switch instructions in the release notes.

8. **Release-infrastructure bug class (witnessed 2026-04-14).** During this design session, an attempted `scripts/self-update install` from v1.10.5 to v1.10.7 failed on the project lead's machine at the atomic-swap step, leaving the cache in a half-state (old `1.10.5` renamed to `1.10.5.old-807316`, new v1.10.7 stranded inside `.update-stage`). Root cause: the script's `$STAGE` variable is computed as `$CACHE_DIR/.update-stage` then `$CACHE_DIR` is renamed away, leaving `$STAGE` pointing at a path that no longer exists. The v1.10.7 self-update script is byte-identical to v1.10.5, so every v1.10.5 user hits the same failure on their next update. Recovery requires manual `mv` from the `.old-<pid>` directory. Mitigation: plan 84-09 rewrites the script using a clone-to-sibling model that is structurally immune to the bug class. Fixture tests in 84-08 validate the new behavior. Plan 84-10 (5-gate release) only proceeds if 84-09 tests pass. If the rewrite itself has bugs, plan 84-10 is held until 84-09 is re-executed.

## Locked decisions (all 6 brainstorm questions answered)

1. **Path C2 + Z**: Hybrid path (bridge + UserPromptSubmit + Mullins scaffold) with Stakeholder node type added in v1.10.8 via option Z (minimal + metadata JSON blob, power/interest/stance deferred to v1.11.x as edge properties).
2. **Env gate default**: `MINDRIAN_COPILOT_INJECT_FINDINGS=1` (ON) with hardcoded top-3 cap as built-in suppression. Kill switch: set to `0` for byte-identical Phase 83 behavior.
3. **Decision + Stakeholder node types**: Stakeholder KEPT in v1.10.8 (reviewer I7 overridden by research evidence: bridge is the first consumer). Decision DEFERRED to v1.11.x (reviewer I7 still valid: no v1.10.8 consumer, needs centrality + communities to be meaningful).
4. **Suppression budget for the bridge**: top-3 cap per UserPromptSubmit injection. Honesty layer remains about language not volume.
5. **Mullins scaffold rigidity**: template, not mandatory skeleton. Users can skip the scaffold entirely.
6. **Voice-log reader for v1.10.8**: writer AND reader both land in v1.10.8 (plan 84-07). Deferring the reader would recreate the anti-pattern Phase 84 was meant to fix.
7. **Self-update rewrite in scope for v1.10.8 as plan 84-09** (user decision "go", accepting recommendation A during GSD dispatch on 2026-04-14). Not hotfixed as v1.10.7.1 because release-infrastructure beta-gating rules in `.claude/includes/release-process.md` make a hotfix slower than v1.10.8 itself. Not deferred to v1.10.9 because every v1.10.5 user would hit the same install failure between now and v1.10.9. v1.10.8 ships as a safely upgradeable patch for the entire v1.10.5 install base.

## Definition of done

1. All 7 plans (84-04 through 84-10) shipped with atomic commits, each with a `feat(84-NN):` or `test(84-NN):` message and Co-Authored-By footer.
2. `lib/memory/run-feynman-tests.cjs` runner reports all previously-passing test files still green plus the new 84-08 file, on the day of execution (exact count is whatever the registration shows at that time, not a hardcoded number).
3. `plugin.json`, `package.json`, git tag, and `~/mindrian-marketplace/.claude-plugin/marketplace.json` all show 1.10.8 / v1.10.8.
4. CHANGELOG [1.10.8] entry present at top crediting the v1.10.8 reshape story and the v1.11.x Stakeholder Intelligence milestone as the next milestone.
5. `scripts/intent-classifier.cjs` has the env-gated injection path; default `MINDRIAN_COPILOT_INJECT_FINDINGS=1` documented in CHANGELOG with kill switch instructions.
6. `skills/larry-personality/SKILL.md` has both `### No fake recall` (unchanged) and `### When memory is real (v1.10.8 and later)` sub-sections in the correct lexical order.
7. **The Jonathan test**: within 2 sessions of install, the UserPromptSubmit hook injects at least one real graph-sourced finding into a prompt; Larry can cite the graph edge with provenance; the injection adds information Larry would not have produced without the graph source.

## Appendix: what changed from the reverted spec `23d4318`

The original 7-plan reshape committed at 23d4318 was built on two false assumptions caught by the independent code reviewer:

- **B1 (blocking)**: the reverted spec claimed the four SQL tables (scaffold_log, voice_log, held_contradictions, decisions_index) were proposed by the Revision 1 planner and rejected this session. The reality: all four were already committed on main via plan 84-01 earlier in the same session (`f020f81`). The reverted spec was arguing against a straw man.
- **B2 (blocking)**: the reverted spec used edge type names `INFORMED_BY` and `INVALIDATED_BY` which do not exist in lazygraph-ops. The real edge types are `INFORMS` and `INVALIDATES` (active voice, source-to-target).
- **I1 (important)**: the bridge must extend both cascade call sites L507 AND L788, not just L507.
- **I3 (important)**: the env gate byte-identical guarantee should be stated as "when env gate is OFF", not "when no findings exist".
- **I4 (important)**: graph findings must use the same insight shape and ID derivation as `parseAnalyzeOutput()` produces, or `shouldSuppress()` dedup silently breaks.
- **I7 (important)**: Decision + Stakeholder node types had no v1.10.8 consumer in the reverted spec. This spec resolves it: Stakeholder is kept (the bridge is the consumer, per the research); Decision is deferred (still no consumer).
- **M1 (minor)**: canonical IDs. Reverted spec proposed content-hash IDs for Decision with "same rationale + room + made_at" as the hash key; reviewer noted millisecond collision risk and normalization risk. This spec uses UUID for Stakeholder identifiers. Content-hash is a secondary dedup key only, not canonical ID.
- **M2 (minor)**: plan 84-05 now explicitly includes the `grep 'require.*lazygraph-ops'` caller enumeration step to verify no other consumers break when the new node type lands.
- **M3 (minor)**: "12 previously-passing test files" count removed from Definition of Done; replaced with "whatever the current runner registration reports on execution day" to avoid hardcoding.

The reverted spec at commit 23d4318 is preserved in git history (`git show 23d4318`). This spec is the replacement.

---

**Design status**: written, in review.
**Next step on approval**: invoke `superpowers:writing-plans` (via `/gsd:plan-phase 84`) to generate 84-04 through 84-10 plan files in `.planning/phases/84-smart-notebook/`, replacing the existing Revision 1 drafts on disk.
