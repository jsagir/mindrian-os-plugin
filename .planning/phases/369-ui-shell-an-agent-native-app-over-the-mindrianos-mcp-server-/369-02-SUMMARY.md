---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 02
subsystem: tooling
tags: [typescript, erasable, walled-package, release-gate, wave-0]
requires: []
provides:
  - tools/ts-check walled package (typescript 7.0.2 exact, own lockfile)
  - erasable-only gate runner (check.cjs) with core, forbidden, allowed and grep stages
  - root-manifest and npm-pack wall test
  - release.sh Step 2.4 erasable gate block
affects: [every later 369 plan that adds core .ts or ui/ packages]
tech-stack:
  added: [typescript@7.0.2 (tools/ts-check only)]
  patterns: [walled-off author-time package (Phase 232 editor-src precedent), fixture-proven gate]
key-files:
  created:
    - tools/ts-check/package.json
    - tools/ts-check/package-lock.json
    - tools/ts-check/tsconfig.core.json
    - tools/ts-check/check.cjs
    - tools/ts-check/README.md
    - tools/ts-check/fixtures/forbidden/enum.ts
    - tools/ts-check/fixtures/forbidden/namespace.ts
    - tools/ts-check/fixtures/forbidden/param-property.ts
    - tools/ts-check/fixtures/forbidden/esm-in-cjs.ts
    - tools/ts-check/fixtures/allowed/shape-a.ts
    - tools/ts-check/fixtures/allowed/types.ts
    - tools/ts-check/fixtures/allowed/dep.cjs
    - tools/ts-check/fixtures/allowed/ambient.d.ts
    - tools/ts-check/fixtures/allowed/run-shape-a.cjs
    - tests/test-369-ts-erasable-gate.cjs
    - tests/test-369-walled-manifest.cjs
  modified:
    - scripts/release.sh
key-decisions:
  - "Forbidden fixtures are compiled together with ambient.d.ts so the only error is the one construct under test (no stray TS2591 noise)."
  - "release.sh runs under --dry-run short-circuit before Step 2.4, so the dry-run preview list gained a Step 2.4 line and the real block also carries a guarded DRY_RUN branch."
  - "@types/node deliberately not installed (not in the legitimacy audit); tsconfig types: [] plus a fixture-local ambient declaration."
requirements-completed: [TS369-03, TS369-06]
duration: 20min
completed: 2026-10-02
---

# Phase 369 Plan 02: Erasable TypeScript gate and walled manifest Summary

A walled tools/ts-check package (typescript 7.0.2 only) enforces the D-17 erasable-only rule with `erasableSyntaxOnly` plus `verbatimModuleSyntax`, proves it against fixtures, and `scripts/release.sh` now fails the cut closed if it fails; a second test proves the root manifest and the npm tarball carry no TypeScript, UI or build package.

## What was built

- **Gate runner** (`tools/ts-check/check.cjs`): resolves tsc from the walled package (exit 77 if not installed), then four stages. Core: zero `.ts`/`.mts`/`.cts` under `lib/` today, stated as vacuous. Forbidden: enum, namespace and parameter property each rejected with TS1294; ESM `export` in a CommonJS `.ts` rejected with TS1287. Allowed: shape (a) fixture compiles clean and Node runs it by stripping types (`shape-a sum=5`). Greps: no `paths` key in any tsconfig under `lib/` or `ui/`, no `.tsx` under `lib/`.
- **Wall test** (`tests/test-369-walled-manifest.cjs`): no dev/peer/optional dependency fields, 16-entry denylist over every dependency field, no `tools`/`ui` entry in `files`, `npm pack --dry-run --json` lists no `tools/`, `ui/` or lib `.tsx` path, every walled package is private, shrinkwrap has no dev entries.
- **release.sh**: Step 2.4 gains the erasable gate after the render-coverage block (installs the walled package with `npm ci --ignore-scripts` if absent, runs check.cjs, any nonzero exit including 77 aborts with a red line naming the gate). Heading and dry-run preview updated. No RULE 5 lockstep place added (no version string).

## Verification

- `node tests/test-369-ts-erasable-gate.cjs`: 8 passed, 0 failed
- `node tests/test-369-walled-manifest.cjs`: 7 passed, 0 failed
- `node tests/test-341-shrinkwrap-no-dev.cjs`: PASS=4 FAIL=0
- `node tests/test-353-release-wiring.cjs` PASS=8, `node tests/test-235-release-shape-gate.cjs` 5/5 (release.sh edit regression check)
- `bash -n scripts/release.sh` ok; `grep -c tools/ts-check/check.cjs scripts/release.sh` = 5
- `git check-ignore tools/ts-check/node_modules` ignored; npm pack listing has no `tools/` or `ui/` path

## Task commits

1. Task 1, walled package, runner, fixtures, gate test: `4e28e89dd`
2. Task 2, wall test and release.sh gate: `843efa834`

## Deviations from Plan

None in behaviour. Two small implementation choices recorded above (ambient.d.ts added to forbidden runs; Step 2.4 line added to the dry-run preview because the script exits before reaching Step 2.4 under --dry-run).

## RULE 6 note

This is a release-infrastructure change (release.sh gains a gate). It ships as a beta first; the gate cannot be exercised end to end until a real cut.

## Notes for later plans

- The first real `lib/core` `.ts` file must add `@types/node` behind its own package-legitimacy check; until then the gate fails on such a file, which is the intended signal.
- `tools/ts-check/node_modules` is git-ignored; a fresh machine needs `npm --prefix tools/ts-check ci --ignore-scripts` (release.sh does this itself).
- Peers touched CLAUDE.md, decisions.md and the engines floor in parallel (plans 01 and 09); this plan did not touch them.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or trust-boundary file access beyond the plan's threat model.

## Self-Check: PASSED

All 16 created files and the release.sh edit exist; commits 4e28e89dd and 843efa834 are on HEAD.
