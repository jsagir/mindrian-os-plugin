---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 05
subsystem: canon-resolution
tags: [canon, resolver, translations, framework-node, uses-framework, part8, part9]
requires:
  - 366-01 (run-all-366 aggregator leg for test-366-canon-handles.cjs)
provides:
  - lib/core/canon-translations.cjs (TRANSLATIONS_RELPATH, listRows, readTranslations, proposeRow, ratifyRow)
  - verification-stamp.cjs resolveEndpoint fourth check (via translation) and resolverCtxFor(roomDir)
  - lib/core/navigation/framework-node.cjs (mintFrameworkNode, linkThingToFramework), re-exported from navigation.cjs
affects:
  - 366-08 recall substrate, 366-09 artifact_file and indexer, 366-10 backfill, 366-11 gated release (all call these, never a second resolver or raw SQL)
tech-stack:
  added: []
  patterns:
    - ratified-only translation rows in a room-local YAML frontmatter table, JSON-quoted strings
    - realpath containment to <room>/references (symlink escape reads empty, refuses writes)
    - node before edge through insertNode (on_conflict nothing) then writeEdge upsert
key-files:
  created:
    - lib/core/canon-translations.cjs
    - lib/core/navigation/framework-node.cjs
    - tests/test-366-canon-handles.cjs
  modified:
    - lib/core/verification-stamp.cjs
    - lib/core/navigation.cjs
    - data/render-coverage-registry.json (regenerated; pre-existing staleness)
decisions:
  - "Translation check runs after framework, methodology and title, exact string only, and requires names.has(canon_name); a stale or forged row resolves nothing"
  - "proposeRow is idempotent on an identical (term, canon_name) and refuses the same term mapped to a different canon name (term_conflict)"
  - "linkThingToFramework refuses a thing id with no node row (thing_missing), so neither endpoint of a USES_FRAMEWORK edge can dangle"
  - "framework-node.cjs issues no BEGIN/COMMIT; batch callers (indexer, backfill) own the transaction"
metrics:
  duration: ~30min
  completed: 2026-10-01
  tasks: 2
  files: 6
---

# Phase 366 Plan 05: Canon handle primitives Summary

One canon resolver extended by a room-local, ratified-only translation table (`references/canon-translations.md`, realpath-contained), plus one node-then-edge writer that mints `framework:<slug>` through insertNode before its idempotent USES_FRAMEWORK edge through writeEdge.

## What was built

- **`lib/core/canon-translations.cjs`**: zero-dependency parser and writer for `<room>/references/canon-translations.md`. `listRows` returns every row, `readTranslations` returns a Map of ratified rows only. `proposeRow` refuses non-canon names, empty or over-80-char terms and conflicting terms. `ratifyRow` sets an ISO date or returns `row_missing`. Writes are atomic (tmp plus rename) and nothing throws. Every read and write is realpath-contained: if `references/` is a symlink out of the room, reads come back empty and writes return `outside_room`. Fresh read on every call. The header states the Part 8 rule: the file never leaves the machine.
- **`verification-stamp.cjs`**: `resolveEndpoint` has a fourth exact check (`via: 'translation'`) after framework, methodology and title. It checks carried framework, then methodology, then title against `ctx.translations`. A row counts only if its canon_name is still in the snapshot. `resolverCtxFor(roomDir)` builds `{ names, registry, translations }` fresh. There is no fuzzy matching and no network.
- **`lib/core/navigation/framework-node.cjs`**: `mintFrameworkNode` calls insertNode with type `framework`, epistemic_type `observation`, source_path `system:canon-framework` and on_conflict `nothing`. `linkThingToFramework` validates the canon name and checks that the thing node exists. It then mints the node first and writes the edge after, using properties `{ relation: 'uses_framework', framework: <slug>, origin }`. It never throws (a closed db gives `write_failed`). The caller owns the transaction. Both functions are re-exported from `navigation.cjs` next to `FRAMEWORK_NODE_ID`.
- **`tests/test-366-canon-handles.cjs`**: hermetic legs C1-C12 (53 checks), with isolated HOME and MINDRIAN_ROOMS_HOME and a net guard.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 24b92f737 | test(366-05): add failing canon handle legs C1-C7 for the translation table |
| 1 GREEN | da43d4042 | feat(366-05): ratified-only canon translation table and the translation check in resolveEndpoint |
| 2 | 71561e9c2 | feat(366-05): framework node writer mints the node before its USES_FRAMEWORK edge, idempotently |

## Verification

- `node tests/test-366-canon-handles.cjs`: PASS 53 FAIL 0
- `node tests/test-seed103-eureka-perspective.cjs`: PASS 39 FAIL 0
- `grep -c "via: 'translation'" lib/core/verification-stamp.cjs` = 1. `resolverCtxFor` is both defined and exported.
- `grep -ciE "levenshtein|fuzzy|similarity" lib/core/canon-translations.cjs` = 0
- In framework-node.cjs, `on_conflict: 'nothing'` is on line 49, before the `edges.writeEdge` call on line 81.
- `node -e "...navigation.cjs...typeof linkThingToFramework"` prints `function`
- `check-schema-aliases.cjs` exits 0. A `check-substrate` scanFiles run over the four touched lib files finds no violations, and the pre-commit `--diff` gate passed on both feat commits.
- `LC_ALL=C bash tests/run-all-366.sh`: PASSED=39 FAILED=0 SKIPPED=26 KNOWN=1. The "366 canon handles" leg passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] linkThingToFramework refuses a missing thing node**
- **Found during:** Task 2
- **Issue:** The plan guarded only the framework endpoint. A USES_FRAMEWORK edge from a thing id with no node row would still count in SENS-19 `edge_rows_missing_endpoint`.
- **Fix:** Before minting, a read-only `SELECT 1 FROM nodes WHERE id = ?` runs inside the navigation submodule. If the thing is missing the function returns `thing_missing` and writes nothing (leg C11).
- **Commit:** 71561e9c2

**2. [Rule 3 - Blocking] render-coverage registry stale since 366-03**
- **Found during:** Task 1 commit
- **Issue:** The pre-commit gate refused the commit because `data/render-coverage-registry.json` still listed commands/eureka.md and skills/eureka/SKILL.md as F.8. That drift came from 366-03, not this plan.
- **Fix:** Regenerated the registry with `node scripts/build-render-coverage.cjs` and committed it with Task 1. It was not hand-edited.
- **Commit:** da43d4042

**3. No node-type list to extend.** Neither `check-schema-aliases.cjs` nor `check-substrate.cjs` keeps a node-type allowlist (aliases.yml maps Codex terms, and the substrate guard scans writes, not types). Nothing needed to learn `framework`.

### Acceptance criterion not met (out of scope)

- `bash tests/run-all-355.sh` does not end with FAILED=0. The remaining reds were there before this plan and are unrelated to it: direction-agreement leg H (known baseline), part8-egress-guard PB8-03, 272-cache-probe (transformers dependency API) and the 356 chain-executor verdict legs. Every 355 stamp and resolver leg passes. Logged in deferred-items.md.

## TDD Gate Compliance

Task 1 followed RED (24b92f737), then GREEN (da43d4042). For Task 2, the C8-C12 legs went into the same commit as the implementation (71561e9c2), so no separate failing-test commit was recorded for that task.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: lib/core/canon-translations.cjs, lib/core/navigation/framework-node.cjs, tests/test-366-canon-handles.cjs
- FOUND commits: 24b92f737, da43d4042, 71561e9c2
