---
phase: 131-research-as-graph-aware-workflow
plan: 05
subsystem: research
tags: [source-lens, evidence-claim, cascade-edges, ci-guard, isomorphism, tool-router, mos-research]

# Dependency graph
requires:
  - phase: 131-02 research-context-extractor
    provides: extractContext (Stages 1+2+3 pre-flight + lens_set)
  - phase: 131-03 source-lens-driver
    provides: runSourceLens (Stage 4 corpus rotation + ranked findings)
  - phase: 131-04 research-filing-selector + findings-wirer
    provides: buildFilingSelector (Stage 6 F.1 gate) + wireAccept/wireReject/wireDefer (Stage 7)
  - phase: 130.7 correlation-id-contract
    provides: computeCorrelationId + CORRELATION_ID_LENGTH (the correlation_id shape the guard recognizes)
provides:
  - commands/research.md rewritten as the 7-stage canonical workflow step invoking the Plan 02-04 modules in sequence
  - both invocation modes (called-BY a methodology returns EvidenceClaim IDs; standalone surfaces the F.1 next-move selector)
  - --broad retained as a 3-lens lens_set preset of the SAME pipeline (not a legacy code path)
  - scripts/check-research-isomorphism.cjs CI guard (typed-node + typed-edge contract + zero-Python directive gate)
  - tests/test-131-isomorphism.cjs (12 assertions; the guard suite)
affects: [v1.14.0 source-lens fan-out (13 research surfaces), Phase 136 render spine, Phase 06 e2e suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin command orchestrator: /mos:research invokes shipped CJS modules via node ${CLAUDE_PLUGIN_ROOT}/... rather than free-prose agent dispatch"
    - "lens_set preset override (--broad) flows through the same extractor/driver/selector/wirer modules, not a fork"
    - "Isomorphism CI guard: a pure scanRoom/scanRoomDb/scanDirectives API mirroring check-substrate.cjs (dual scan: typed-graph contract + directive grep)"
    - "correlation_id shape recognized via the REAL 130.7 CORRELATION_ID_LENGTH export, never a phantom correlation.resolve"

key-files:
  created:
    - scripts/check-research-isomorphism.cjs
    - tests/test-131-isomorphism.cjs
  modified:
    - commands/research.md
    - data/command-registry.json

key-decisions:
  - "Open room.db in the guard via navigation.openRoomDbForCaller (the Canon Part 9 chokepoint), NOT a direct room-db.cjs require, so the guard stays substrate-clean instead of being allow-listed as a bypass"
  - "--broad is RESOLVED NOW as a documented 3-lens preset (scholarly + industry + patent, equal weight) flowing through the same modules; not deleted (Canon Part 7), not a separate legacy path"
  - "The guard scopes the typed-edge contract to edges ORIGINATING at an EvidenceClaim node, so unrelated local edges (decision/HatState/spine) are not false-flagged"
  - "Markdown directive grep tracks fenced-code blocks so a .py mention in prose is not a false-positive; only code positions are scanned"

patterns-established:
  - "Pattern 1: command-as-orchestrator -- the command surface documents the 7 stages and the exact module entry points; all logic stays in the shipped Plan 02-04 modules"
  - "Pattern 2: isomorphism guard -- assert /mos:research output is graph-isomorphic to the Phase 136 forward contract (provenance schema + typed predicates + canonical targets)"

metrics:
  duration: ~35m
  completed: 2026-06-02
  tasks: 2
  files_created: 2
  files_modified: 2
  commits: 2
---

# Phase 131 Plan 05: Research as the 7-Stage Canonical Workflow Step + Isomorphism Guard Summary

Rewrote `/mos:research` from a prose-and-agent command into a thin orchestrator that invokes the Plan 02-04 pipeline modules in the canonical 7-stage sequence, supporting both invocation modes (chain-back EvidenceClaim IDs / standalone F.1 next-move selector); shipped the `check-research-isomorphism.cjs` CI guard that fails closed on missing provenance, an untyped cascade edge, a raw-name cascade target, an un-reasoned rejection, or a re-introduced Python spawn.

## What shipped

### Task 1 -- commands/research.md (commit a62da09d)

The command is now a thin 7-stage orchestrator. The 8-stage 131-CONTEXT spec collapses to 7 per the 4.8 re-baseline (Stage 1 is one batched pre-flight read; Stages 2+3 merge into one reasoning pass inside `extractContext`). Each stage invokes a shipped module:

1. **PRE-FLIGHT + PLAN** -> `research-context-extractor.extractContext` (surfaces the Body Shape A context_summary + the computed lens_set).
2. **EXECUTION** -> `source-lens-driver.runSourceLens` (Stage 4 corpus rotation; fetch + pre-egress audit are inherited from the 130.5 shared corpus; zero Python).
3. **PRESENTATION** -> top-5 findings with title + summary + source + url + retrieved_at + evidence_tier + candidate sections + % match, persona-framed.
4. **F.1 FILING SELECTOR** -> `research-filing-selector.buildFilingSelector` (the dispatcher-produced Shape F.1 gate; pre-filled confident recommendation in Mode A above the 0.7 gate).
5. **WIRING** -> `findings-wirer.wireAccept / wireReject / wireDefer`.
6. **POST-FILING** -> called-BY a methodology returns the accepted EvidenceClaim node IDs (handles only, never prose -- Canon Part 8); standalone surfaces the F.1 next-move selector.

`--broad` is retained as a documented 3-lens lens_set preset (scholarly + industry + patent, equal weight 1.0) that flows through the SAME extractor / driver / selector / wirer modules -- NOT a deleted capability and NOT a separate legacy code path (Canon Part 7). The dead `scripts/compute-hsi.py` reference was removed (the zero-Python directive). Phase 122 workflow-layer frontmatter (kind / frameworks / produces / inputs / autonomous_safe) is preserved; `emits_evidence_claims: true` + the requires_evidence auto-dispatch docs were added. `data/command-registry.json` was regenerated to clear the drift the frontmatter teaching-string change introduced.

### Task 2 -- check-research-isomorphism.cjs + suite (commit 86e8448c)

`scripts/check-research-isomorphism.cjs` mirrors the `scripts/check-substrate.cjs` structure (a pure scan API + a CLI mode + exit-0-informational / exit-1-on-violation; node built-ins only; zero network; zero Brain). Two scan modes:

- **scanRoom / scanRoomDb** (the typed-node contract): (a) every EvidenceClaim node carries source + url + retrieved_at + evidence_tier with evidence_tier in the closed Canon Part 5 set; (b) every cascade edge FROM an EvidenceClaim node has a predicate in {INFORMS, CONTRADICTS, SUPERSEDES, REJECTED_BECAUSE}; (c) every cascade-edge target is a LOCAL room.db node id (present in the nodes table OR a `:`-namespaced id) OR a 130.7 correlation_id (the bare 16-char lowercase hex, recognized via the REAL `CORRELATION_ID_LENGTH` export -- never a phantom `correlation.resolve`); (d) a REJECTED_BECAUSE edge carries a non-empty reason scalar.
- **scanDirectives** (the zero-Python directive gate, the default CLI mode): scans the four pipeline modules + the command for any Python spawn (child_process / spawn / execSync / .py / scripts/hsi), stripping comment-only and markdown-prose lines (grep-gate hygiene), and fails closed on a hit.

`tests/test-131-isomorphism.cjs` carries 12 assertions: a clean fixture (local + correlation_id targets) passes; six planted violations (missing url, off-set evidence_tier, untyped predicate, raw-name target, un-reasoned REJECTED_BECAUSE, plus a reasoned-rejection pass) fail/pass as expected; three directive-grep assertions (real modules clean, planted Python spawn fails, comment-only mention does not false-flag); a real room.db round-trip (a wired EvidenceClaim + INFORMS edge from `findings-wirer.wireAccept` passes scanRoomDb); and a no-phantom guard asserting the guard sources its correlation_id length from the REAL 130.7 export and never references `correlation.resolve`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repointed the guard's room.db open through the navigation chokepoint**
- **Found during:** Task 2 (substrate guard --baseline / --diff flagged the new file)
- **Issue:** The guard's `--room` CLI mode initially used `require('../lib/core/room-db.cjs')` to open room.db. `scripts/check-research-isomorphism.cjs` is NOT on the substrate allow-list, so `check-substrate.cjs --diff` flagged it as a `chokepoint-require` bypass -- which would fail the success criterion "substrate guard passes on every commit."
- **Fix:** Repointed `runRoom` to `navigation.openRoomDbForCaller(roomDir)` + `navigation.closeRoomDbForCaller(db)` (the Canon Part 9 chokepoint re-export, designed for exactly this non-allow-listed-caller case; returns null gracefully on a Tier 0 cold start). This is canon-aligned (route through navigation.cjs) and superior to allow-listing a bypass.
- **Files modified:** scripts/check-research-isomorphism.cjs
- **Commit:** 86e8448c (the fix landed before the Task 2 commit)

**2. [Rule 3 - Blocking] Regenerated data/command-registry.json**
- **Found during:** Task 1 (the Phase 122 registry-drift pre-commit guardian)
- **Issue:** Changing the research.md frontmatter `teaching` string left `data/command-registry.json` stale, which the command-registry drift tripwire (build-command-registry.cjs --check) rejects at commit time.
- **Fix:** Ran `node scripts/build-command-registry.cjs` to regenerate the registry (the documented recovery). Diff was the single research teaching row.
- **Files modified:** data/command-registry.json
- **Commit:** a62da09d

No other deviations. Both tasks executed as written.

## Hard gates

- **ZERO live Brain writes:** the command adds no Brain endpoint; the only Brain touch is the read-only `brain` lens inside the shared 130.5 corpus (generic methodology handles via the Phase 110 packet path). The guard makes zero Brain calls (node builtins only). All graph writes are LOCAL room.db via navigation.cjs inside the wirer.
- **ZERO new dependencies:** no package.json / lock change; node: built-ins + existing local modules only.
- **Tri-Polar coverage:** CLI runs the four modules via node invocations; Desktop/Cowork route `/mos:research` through the `intelligence` tool in `lib/mcp/tool-router.cjs` (the `research` command), behind which the same four modules are the execution layer. The command documents both surfaces explicitly.
- **No --no-verify:** every commit passed the live pre-commit hook chain (ROOM.md/MINTO.md invariant + command-registry drift + brain-packet-schema + sendpacket guard + feynman-minto guardian).

## Verification

- `node tests/test-131-isomorphism.cjs` -> 12 passed / 0 failed.
- `node scripts/check-research-isomorphism.cjs --help` -> exit 0; `--directives` (default) -> exit 0 (clean, zero Python spawn across the 4 modules + command).
- `bash tests/run-all-131.sh` -> 5 passed / 0 failed / 1 skipped (test-131-e2e.cjs; Plan 06 owns the e2e suite per the run-all-131 registration note).
- Zero regression: run-all-130 4/4, run-all-130.7 7/7, test-navigation-acceptance 1/1.
- `node scripts/check-substrate.cjs --diff` on the staged guard -> exit 0 (clean; the guard is NOT a bypass after the repoint).
- `grep -v '^[[:space:]]*//' lib/lens-engine/source-lens-driver.cjs lib/core/findings-wirer.cjs lib/core/research-context-extractor.cjs | grep -cE "child_process|\.py|scripts/hsi"` -> 0.
- `node scripts/build-command-registry.cjs --check` -> OK (research.md frontmatter valid).
- Em-dash scan over commands/research.md + scripts/check-research-isomorphism.cjs + tests/test-131-isomorphism.cjs -> 0.

## Known Stubs

None. The command surface documents real module entry points; the guard + suite are fully wired and green.

## Self-Check: PASSED

- Files: commands/research.md, scripts/check-research-isomorphism.cjs, tests/test-131-isomorphism.cjs, 131-05-SUMMARY.md all FOUND.
- Commits: a62da09d (Task 1), 86e8448c (Task 2) both FOUND in git history.
