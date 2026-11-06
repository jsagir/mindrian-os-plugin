---
phase: 385
plan: 02
subsystem: dependencies
tags: [cleanup, flexsearch, lockfiles]
requirements-completed: [CLEAN385-02]
key-files:
  created: [tests/test-385-no-flexsearch-dependency.cjs]
  modified: [package.json, npm-shrinkwrap.json, package-lock.json]
completed: 2026-11-06
---

# Phase 385 Plan 02: Remove the unused flexsearch dependency Summary

package.json and both lock files no longer list flexsearch. No source requires it. Outputs are unchanged.

## Commit

- 45713ce56 chore(385-02): remove unused flexsearch dependency (4 paths).
- Revert note: `git revert 45713ce56` restores the dependency in all 3 files. The next release regenerates the shrinkwrap (release.sh Step 6.7).

## Caller proof (re-run at HEAD 6f105be50)

- `git grep -l -I -i flexsearch` (outside .planning) lists 9 files: the 3 manifests (removed), CHANGELOG.md, references/security/cve-db.json, scripts/generate-snapshot.cjs, templates/showcase/library.html (CDN script tag), tests/fixtures/363-pre-phase.json, tests/test-visible-room-search-engine.cjs (all kept).
- No `require`, `from` or `import()` of flexsearch anywhere: 0 hits.
- `lib/core/mcp-dep-heal.cjs`: 0 mentions, not touched.

## RED evidence

```
FAIL package.json dependencies has no flexsearch key: flexsearch is still in package.json dependencies
FAIL npm-shrinkwrap.json has no flexsearch package or root dependency: npm-shrinkwrap.json still has node_modules/flexsearch
FAIL package-lock.json has no flexsearch package or root dependency: package-lock.json still has node_modules/flexsearch
ok   no tracked source requires or imports flexsearch
exit 1
```

## Baseline before the change

test-267-mcpv2-lockstep PASS=6; test-341-shrinkwrap-no-dev PASS=4; test-341-payload-shrinkwrap-present PASS=4; test-341-release-shrinkwrap-gate 5/5; test-341-shrinkwrap-platform-coverage PASS=22; test-visible-room-search-engine 25/25; prune-shrinkwrap check: nothing to prune; `npm ci --dry-run --omit=dev --offline`: added 10 packages (the planner's 147 count differs because the local node_modules already holds most packages; the delta is what matters).

## Diff

`git diff --stat`: npm-shrinkwrap.json 7 deletions, package-lock.json 7 deletions, package.json 1 deletion. The npm-synced root version lines were restored by Edit (beta.79 and beta.56).

## Verify after the change

- New test: 4/4 ok. All 6 pinned tests and the prune check: same results as the baseline.
- `npm ci --dry-run --omit=dev --offline`: exit 0, "added 10 packages, and removed 1 package" (one fewer than the baseline; the removal is the local flexsearch copy).
- `git grep -c flexsearch` on the 3 manifests: 0 matches each. HEAD holds exactly the 4 expected paths. Never-touch guard: 0.
- orchestration-projection: OK.
- End-of-wave run (coordinator ruling: long suites run once): run-all-341 PASS=31 FAIL=4, same 4 legs as the baseline. doctor 24/25 (only the peer clean-tree point), equal to baseline.
- run-all-267: PASS=27 FAIL=6 SKIP=1. No baseline for run-all-267 was recorded before the change (plan text expected 0 or baseline). The failing legs are CIRS gates (connector-descriptor count 35 expected, 62 found), zod4 contract (eureka_capability_job_* tool membership extras), registration API and titles, local server dual era, HTTP flag-OFF, and in-repo clients. None touches flexsearch or the lock lists; test-267-mcpv2-lockstep (Check 1 and 2) passes 6/6. Cause: stale 267 snapshot against current tool and connector counts (UNVERIFIED by a pre-change run).

## Deviations

None.
