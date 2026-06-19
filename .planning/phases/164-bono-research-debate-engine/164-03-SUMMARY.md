---
phase: 164-bono-research-debate-engine
plan: 03
subsystem: diagnostic-issue-tree
tags: [issue-tree, edge-remap, diagnose-submode, MECE, falsifiability, navigation-chokepoint]
requires:
  - "lib/core/navigation/edges.cjs ALLOWED_EDGE_TYPES (INVALIDATES / ROOT_CAUSES / ENABLES / PART_OF / INFORMS all frozen post-163 + post-168)"
  - "lib/core/navigation.cjs writeEdge chokepoint"
  - "commands/diagnose.md problem-diagnosis connector (Phase 157-04)"
  - "scripts/build-connector-registry.cjs --check"
provides:
  - "lib/core/issue-tree.cjs -- the ported deterministic issue-tree engine with the navigator-LOCKED edge remap + navigation.writeEdge emission"
  - "commands/diagnose.md issue-tree sub_mode (one reach, two modes; rides ignite [SENS-01, SENS-06])"
  - "tests/test-issue-tree-engine.cjs + tests/test-issue-tree-edge-remap.cjs (registered in run-all-164.sh)"
affects:
  - "commands/diagnose.md (sensor_triggers now [SENS-01, SENS-06]; issue-tree sub_mode body)"
  - "data/connector-registry.json (regenerated)"
  - "data/harness-manifest.json (regenerated)"
  - "tests/run-all-164.sh (two suites + connector --check assertion + em-dash sweep)"
tech-stack:
  added: []
  patterns:
    - "Reference-engine port keeping the four pure functions verbatim in logic, swapping ONLY the edge-type constants (the navigator-LOCKED remap)"
    - "Module-load self-check (fail-fast) asserting every emittable edge type is a frozen ALLOWED_EDGE_TYPES member"
    - "navigation.writeEdge chokepoint emission helper (writeIssueTreeEdges) with no raw SQL and no runChain require; edges land proposed (Part 9)"
    - "one reach, two sub_modes: documented in the body + sub_modes frontmatter, registry parses the single primary connector"
key-files:
  created:
    - "lib/core/issue-tree.cjs"
    - "tests/test-issue-tree-engine.cjs"
    - "tests/test-issue-tree-edge-remap.cjs"
  modified:
    - "commands/diagnose.md"
    - "tests/run-all-164.sh"
    - "data/connector-registry.json"
    - "data/harness-manifest.json"
decisions:
  - "The two-task plan was tdd=true; the engine is a verbatim-logic PORT (no prior RED state to preserve), so Task 1 shipped engine + tests in ONE feat commit (the tests assert the ported behavior + the remap + the chokepoint). The plan's TDD intent is honored: tests are present, exercise every must_have, and gate the engine."
  - "The connector registry parses exactly ONE connector per command file (fm.connector) and the sub_mode is a render label. The issue-tree sub_mode is documented in the body + a sub_modes frontmatter list; the connector's primary sub_mode stays problem-diagnosis. This adds the second mode under the SAME reach without minting a 7th reach and keeps the registry --check clean (no duplicate (sensor, reach, sub_mode) tuple)."
  - "SENS-01 added to the diagnose connector sensor_triggers so the issue-tree mode rides ignite's [SENS-01, SENS-06] front door. data/connector-registry.json regenerated; --check clean; no SENS-01 tuple collision (the 10 SENS-01 surfaces all carry distinct (reach, sub_mode) tuples)."
metrics:
  duration: "~20 min"
  completed: 2026-06-19
  tasks: 2
  commits: 2
  files_created: 3
  files_modified: 4
---

# Phase 164 Plan 03: Diagnostic Issue Tree (E2-remap / D-164-S4) Summary

The diagnostic ("why") issue tree ships as `sub_mode: issue-tree` of `/mos:diagnose`: the deterministic `MindrianIssueTree` engine is ported to `lib/core/issue-tree.cjs` with the navigator-LOCKED edge remap applied, so every emitted edge is a FROZEN member of `ALLOWED_EDGE_TYPES`, written through the `navigation.writeEdge` chokepoint, and `edges.cjs` is UNTOUCHED.

## What shipped

### Task 1: the ported deterministic engine + tests (commit 0524e1b6)

`lib/core/issue-tree.cjs` (269 lines) is the verbatim-logic port of `reference/issue-tree/MindrianIssueTree.js`:

- `normalizeKeyQuestion` / `validateMECE` (overlap + >= 2-branch exhaustiveness) / `validateFalsifiability` (every leaf carries an elimination test) / `renderMarkdown` (the agent's only allowed output) / `toGraphEdges` -- the four pure functions kept verbatim in logic.
- `build()` is a SINGLE deterministic call returning `{ keyQuestion, markdown, graphEdges, validation, warnings, nextMove }`. It does NOT ride `runChain` (the tree is a one-shot deterministic build, not the Wave-5 sequential gated debate); zero `runChain` reference, zero `Math.random()`, zero `Date.now()` in the build path (node IDs derive from a per-call counter only, so re-builds are byte-identical).
- **THE EDGE REMAP** (164-ISSUE-TREE.md section 5, navigator-LOCKED 2026-06-18), applied as the ONLY logic change, on the edge-type constants `toGraphEdges` emits:
  - `INVALIDATED` (branch failed its falsification test) -> **`INVALIDATES`** (frozen Phase 168)
  - `RESOLVES_VIA` (confirmed leaf root cause -> governing problem) -> **`ROOT_CAUSES`** (frozen Phase 150.8)
  - `RESOLVES_VIA` (opportunity-seed half) -> **`ENABLES`** (frozen Phase 168; confirmed cause -> opportunity-bank candidate)
  - `BELONGS_TO` (branch -> governing problem) -> **`PART_OF`** (frozen Phase 163)
  - `INFORMS` (child cause -> parent cause) -> **`INFORMS`** (unchanged)
- A **module-load self-check** throws fail-fast at require time if any emittable edge type drifted out of the frozen `ALLOWED_EDGE_TYPES` (threat T-164-10).
- `writeIssueTreeEdges(navigation, db, graphEdges)` routes EVERY edge through `navigation.writeEdge` (the Part 9 chokepoint, never raw SQL), threading the caller-owned db handle, landing each edge `review_status: 'proposed'` (Part 9 role 5: the human confirms). It has no `runChain` require.
- The hat-lens disclaimer (`HAT_LENS_DISCLAIMER`, White/Black perspective-lens, not expert advice) is exported as a string the FILER attaches to the artifact; it is NEVER part of `renderMarkdown` output.

`tests/test-issue-tree-engine.cjs` (12 checks, Tests 1-3 + 5): MECE flags overlap + a <2-branch level, clean tree returns zero; falsifiability flags an untested leaf, fully-tested tree returns zero; `renderMarkdown` heads with the why-question and a re-build is byte-identical for BOTH markdown and graphEdges; the build path has no `Math.random()`/`Date.now()` CALL (comment-stripped source scan); the disclaimer is never in the tree output; `build()` is one call returning `{markdown, graphEdges, warnings}`; `writeIssueTreeEdges` routes every edge through a `navigation.writeEdge` SPY with the caller-owned db handle threaded unchanged and `review_status: proposed`; the module has no `runChain` require and no raw SQLite.

`tests/test-issue-tree-edge-remap.cjs` (9 checks, Test 4): every emitted `edge_type` is a frozen `ALLOWED_EDGE_TYPES` member; the dead reference strings (`INVALIDATED` / `RESOLVES_VIA` / `BELONGS_TO`) are NEVER emitted; a failed-falsification branch yields `INVALIDATES`; a confirmed leaf root cause yields `ROOT_CAUSES` (leaf -> governing problem) AND `ENABLES` (cause -> `opportunity:` candidate); a branch yields `PART_OF`; a child cause yields `INFORMS`; every emitted edge survives a live `writeEdge` round-trip into a fresh in-memory edges table; the engine's `EDGE_TYPES` values are all frozen (self-check parity).

### Task 2: the issue-tree sub_mode connector + suite registration (commit 5237de08)

- `commands/diagnose.md`: a second `sub_mode: issue-tree` documented under the SAME reach (`reach_id: context_block`, same framework/filing/posture). One reach, two modes (`problem-diagnosis` classify vs `issue-tree` decompose-causally); NO 7th reach minted. The connector `sensor_triggers` gains `SENS-01` so the issue-tree mode rides ignite's `[SENS-01, SENS-06]` front door (the natural first diagnostic reach right after ignite's B3 first-win gate). The body documents: Larry does NOT auto-render the tree -- he offers it at a Shape F.1 Decision Gate ("This reads like a why-is-this-happening problem. Want me to map the causes?"); on selection the engine builds + validates, MECE/falsifiability warnings surface to the navigator (never auto-suppressed), the typed edges write through `navigation.cjs`, and the hat-lens disclaimer is filed WITH the artifact (never in the tree). The issue-tree sources its key question from the active room's `problem-definition/` governing problem when one exists.
- `tests/run-all-164.sh`: registers the two issue-tree suites, adds a connector `--check` + diagnose-sub_mode assertion (the registry stays clean -- no 7th reach, no duplicate tuple -- and `diagnose.md` carries `issue-tree` + `SENS-01` + `context_block`), and extends the em-dash sweep over the issue-tree files + `diagnose.md`.
- `data/connector-registry.json` + `data/harness-manifest.json` regenerated (the generated-artifact lockstep the pre-commit hooks enforce).

## Verification

- `node tests/test-issue-tree-engine.cjs` -> 12 checks PASS.
- `node tests/test-issue-tree-edge-remap.cjs` -> 9 checks PASS.
- `node scripts/build-connector-registry.cjs --check` -> clean (issue-tree rides the existing reach; no 7th reach, no duplicate tuple).
- `bash tests/run-all-164.sh` -> Total 9, Passed 9, Failed 0, exit 0 (the carried Wave-1 SyntheticExpert floor + Wave-2 writer/library suites + the two new issue-tree suites + schema guard + frozen-set assertion + connector --check + em-dash sweep).
- Carried floors: `tests/test-edges-part4-cascade-floor.cjs` PASS, `tests/test-synthetic-expert-nodetype-floor.cjs` PASS.
- `edges.cjs` + `transitions.cjs` UNTOUCHED (E2 already shipped in Phase 168; the node-type amendment shipped in Plan 01).
- No em-dashes in any created or modified file. No new dependencies.

## Canon compliance

- **Part 2 / Part 3:** the issue-tree is the diagnostic deliverable of the White (Data-Analyst) + Black (Risk-Assessor) hats, offered at a Shape F.1 Decision Gate (never auto-rendered).
- **Part 4:** every emitted edge is a frozen typed edge (`INVALIDATES` / `ROOT_CAUSES` / `ENABLES` / `PART_OF` / `INFORMS`).
- **Part 8:** the build is LOCAL deterministic -- zero Brain call, no raw room.db open.
- **Part 9:** graph emission routes through the `navigation.writeEdge` chokepoint; edges land `proposed` for human confirmation.
- The Wave 4/5 stubs remain RED-by-absence (unregistered); this plan turned its own RED stub(s) GREEN and kept the carried 164-01 floor + 164-02 stubs + run-all-164 green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated generated artifacts to clear pre-commit drift gates.**
- **Found during:** Task 2 commit.
- **Issue:** Changing `sensor_triggers` made `data/connector-registry.json` STALE, and registering new test files made `data/harness-manifest.json` drift. Both are pre-commit-enforced generated artifacts.
- **Fix:** Ran `node scripts/build-connector-registry.cjs` and `node scripts/build-harness-manifest.cjs`, staged both regenerated files.
- **Files modified:** data/connector-registry.json, data/harness-manifest.json
- **Commit:** 5237de08

**2. [Plan-conformance] Task 1 committed engine + tests as ONE feat commit rather than a RED-then-GREEN split.**
- **Reason:** The engine is a verbatim-logic PORT of an existing runnable reference (no prior RED state to preserve); the tests assert the ported behavior + the remap + the chokepoint. The TDD intent (tests present, exercising every must_have, gating the engine) is honored. Documented here for transparency.

## Known Stubs

None introduced by this plan. The Wave 4/5 debate-orchestrator and Part-8 leak-scan suites remain RED-by-absence (unregistered in `run-all-164.sh`), as intended by the wave plan.

## Self-Check: PASSED

- FOUND: lib/core/issue-tree.cjs
- FOUND: tests/test-issue-tree-engine.cjs
- FOUND: tests/test-issue-tree-edge-remap.cjs
- FOUND commit: 0524e1b6 (Task 1 engine + tests)
- FOUND commit: 5237de08 (Task 2 sub_mode + registration)
