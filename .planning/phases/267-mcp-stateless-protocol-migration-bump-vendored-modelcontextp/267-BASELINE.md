# Phase 267 Baseline (267-01)

Captured on the UNCHANGED tree, before any dependency or registration edit
(locked_stage W0). Every later Phase 267 plan compares against the numbers
here, never against a re-derived guess. Task 1's own commit (the wire helper,
aggregator, era test, lockstep test) landed AFTER this measurement pass
started but BEFORE this file itself, per the plan's own two-task split --
none of those four files touch bin/, lib/, or scripts/, so they do not
invalidate any number below.

```
PLAN_BASE=211030b133d233b3cd5f1372957947e3d3b45f29
```

Captured: 2026-09-24 (executor session). Repo version (`node
lib/core/repo-version.cjs`): `2.0.0-beta.48`.

## Installed versions

| Package | Version |
|---|---|
| `@modelcontextprotocol/sdk` | 1.29.0 |
| `@modelcontextprotocol/ext-apps` | 1.5.0 |
| `zod` | 3.25.76 |
| `express` | 5.2.1 |

`LATEST_PROTOCOL_VERSION` in the installed SDK's `dist/cjs/types.js`:
`2025-11-25` (confirms 267-RESEARCH.md F-1: a version bump is not adoption).

## Wire surface counts

Captured via `tests/helpers/mcp-wire-267.cjs` `wireSnapshot()` against a
fresh hermetic env (isolated HOME + rooms home, single synthetic `room-267`
fixture room, unreachable `MINDRIAN_BRAIN_URL`). Raw snapshot:
`tests/fixtures/267/wire-snapshot-zod3.json`.

| Server | Tools | Prompts | Resources | Templates |
|---|---|---|---|---|
| `bin/mindrian-mcp-server.cjs` (local) | 44 | 9 | 10 | 3 |
| `bin/mindrian-brain-mcp-client.cjs` (brain shim) | 6 | - | - | - |

**Note on the resource count:** 267-RESEARCH.md's live probe (run against a
populated production room) measured 61 resources / 3 templates. This
baseline's hermetic fixture room (`room-267`, one `STATE.md`, no meetings, no
sections) measures 10. Tool and prompt counts are code-defined and match
research's order of magnitude (44 vs. research's 42, 27 days and several
peer-session commits apart -- "the count moved 36 -> 42 in 27 days" per
267-RESEARCH.md State of the Art). Resource counts are room-content-dependent
by design (`room://sections`, `room://meetings`, etc. enumerate what exists on
disk) and will never match a synthetic fixture room to a populated one. Later
plans comparing wire snapshots must diff tool/prompt/schema fields, not raw
resource counts, unless they also control the room fixture.

## CIRS gate baseline

```
CONNECTOR_DESCRIPTORS=31
SHAPE_VIOLATIONS=53
```

`SHAPE_VIOLATIONS` is the size of `tests/fixtures/267/shape-violations-baseline.txt`
(`node scripts/check-shape-declaration.cjs --check --strict`, unique surface
paths). Zero of the 53 are under `lib/mcp/` (`grep -c "^lib/mcp"` = 0), which
is the CIRS gate's hard invariant -- any surface under `lib/mcp/` appearing in
a later run is a real regression, never accepted into the baseline.

`CONNECTOR_DESCRIPTORS` is `listMcpToolConnectorDescriptors().length` from
`scripts/build-connector-registry.cjs`. 267-RESEARCH.md's plan-time note said
"29 at plan time"; this baseline measures 31 on the actual unchanged tree at
execution time (research's own posture throughout: "record what THIS run
measures, never a literal" -- the delta is peer-session tool additions
between the 2026-09-23 research pass and this 2026-09-24 execution, not a
defect in either measurement).

## zod importer set

`tests/fixtures/267/zod-importers-baseline.txt`: 27 non-test production files
under `bin/`, `lib/`, `scripts/`, `hooks/` whose non-comment source requires
`zod` (or `requireWithHeal('zod`), including the `zod/v4` subpath users
(`lib/core/pitch-feedback-schemas.cjs`, `lib/core/skillopt-schemas.cjs`,
`scripts/skillopt-codereview.cjs`, `scripts/skillopt-genqueries.cjs`). This is
the CTX "zod boundary discipline" floor -- later plans may not grow this set
outside `lib/mcp` registrars and bin entry points.

## Zod 4 breaking-pattern scan

Scanned the zod importer set plus every file under `tests/`. Grep-based, so a
count includes any line-level substring match (a small number of hits,
especially for `.errors`, are unrelated non-zod code that happens to contain
the substring -- listed as a measurement caveat, not corrected by hand, since
the point of this table is a reproducible floor to diff against, not a hand
-curated list).

| Pattern | Count | Notable sites |
|---|---|---|
| `._def` | 2 | `tests/test-198-contract-schema.test.cjs:210-211` (the known pre-existing introspection break, see below) |
| `.errors` | 29 | mostly non-zod substring matches (`result.errors`, etc.) across `tests/test-233-*`, `tests/test-236-*`, `tests/test-275-*` |
| `invalid_type_error` | 0 | - |
| `required_error` | 0 | - |
| `errorMap` | 0 | - |
| `z.coerce` | 6 | - |
| `.flatten(` | 0 | - |
| `.format(` | 0 | - |
| `z.nativeEnum` | 0 | - |
| `.merge(` | 0 | - |
| `.deepPartial(` | 0 | - |
| `.strict()` | 4 | `lib/core/behavioral/observation-schema.cjs:45`, `lib/core/verification-stamp.cjs:154,165,174` |
| `.passthrough()` | 2 | `lib/core/verification-stamp.cjs:330`, `lib/mcp/tool-router.cjs:304` |
| `.superRefine(` | 1 | `lib/core/verification-stamp.cjs:174` |
| `z.record(` (single-arg heuristic) | 7 | `bin/mindrian-brain-mcp-client.cjs:220,229`, `lib/mcp/tools/graph.cjs:225,259`, `lib/mcp/tools/status.cjs:134`, `scripts/jev-response-schema.cjs:32,38` -- matches 267-RESEARCH.md's "4 live sites... zod 4.6.5 still accepts single-argument z.record" observation (line-count differs from research's file-count; do not spend effort reconciling per Pitfall 2's own guidance) |

## Suite / test results (step 5)

Every command below was run against the unchanged tree. PASS/FAIL as
measured this session; every pre-existing FAIL is named. None was fixed
(scope boundary: this plan changes no production file).

| Command | Result | Detail |
|---|---|---|
| `bash tests/run-all-198.sh` | FAIL (13 pass, 3 fail, 0 skip) | Pre-existing, matches 267-RESEARCH.md: "Part 8 local-only floor", "SPEC-2 contract-version + per-tool schema validity", "SPEC-5 hooks/ adapter-only budget" |
| `bash tests/run-all-234.sh` | FAIL (8 pass, 3 fail) | Pre-existing: `test-234-dist-bundle.cjs`, `test-234-free-core-network-scan.cjs`, `test-234-plugin-root-migrated.cjs` |
| `bash tests/run-all-199.sh` | FAIL (3 pass, 2 fail) | Pre-existing: "AS-01/06/07 scanSurface engine...", "AS-09 PR-gate CLI + final e2e smoke" |
| `bash tests/run-all-266.sh` | PASS (11 pass, 0 fail) | - |
| `bash tests/run-all-127.sh` | FAIL (12 pass, 4 fail) | Pre-existing, fixture-gated: `test-127-03-acceptance-gates.sh`, `127.1-embedding-integrity.test.cjs`, `127.1-index-config.test.cjs`, `127.1-graphrag-overlap.test.cjs` (missing fixtures, `MINDRIAN_127_1_FIXTURE_MODE` not set) |
| `node tests/test-257-brain-tool-egress-invariant.cjs` | FAIL (1 failure) | **NEW pre-existing red, not named in 267-RESEARCH.md**: Arm 2 "zero egress on a canary" fails. Reproduced 2x, not flaky. Out of scope (`lib/core/part8-egress-guard.cjs` is on the plan's Never-Edit list) -- logged to `deferred-items.md` |
| `node tests/test-257-envelope-passthrough.cjs` | PASS (6/6) | - |
| `node tests/test-257-refusal-egress-kind.cjs` | PASS (6/6) | - |
| `node tests/test-257-shim-honest-refusal.cjs` | FAIL (1 failure) | **NEW pre-existing red, not named in 267-RESEARCH.md**: Arm 4 "G3 on the wire -- ambiguous proceeds and egress_disclosure reaches the model" fails (missing `egress_disclosure` key). Reproduced 2x, not flaky. Out of scope, same boundary as above -- logged to `deferred-items.md` |
| `node tests/test-257-strict-input-shapes.cjs` | FAIL (2 failures) | Pre-existing, matches 267-RESEARCH.md exactly: Arm B (flaky `theo_health` boot race -- "the handler did not run" false alarm) and Arm F (stale `brain_ask` description fixture, catalog-parity byte mismatch) |
| `node lib/core/mcp-dep-heal.test.cjs` | PASS (9/9) | - |
| `node tests/test-265-gate-render-elicit-schema.cjs` | PASS (5 arms) | - |
| `node tests/test-265-mcp-surface-organ.cjs` | PASS (16/16) | - |
| `node tests/test-248-surface-probes.cjs` | PASS (25/25) | - |
| `node tests/test-248-resolver-census.cjs` | PASS (4/4) | - |
| `node tests/test-354-concurrency-surfaces.cjs` | PASS (25 checks) | - |
| `node tests/test-354-egress-typed-question.cjs` | PASS (46/46) | - |
| `node tests/test-354-extract-shallow-contract.cjs` | PASS (13 checks) | - |
| `node tests/test-354-registration-diagnostics.cjs` | PASS (12 checks) | - |
| `node tests/test-354-room-symlink-containment.cjs` | PASS (10 checks) | - |
| `node tests/test-354-theo-journey.cjs` | PASS (15/15) | - |
| `node tests/test-276-claim-write-primitive.cjs` | PASS (44/44) | - |
| `node tests/test-198-contract-schema.test.cjs` | FAIL | Pre-existing, matches 267-RESEARCH.md exactly: `_def.typeName` introspection at lines 210-211 fails under zod 3 today too ("already fails on zod 3 today"). Will be rewritten in Wave 0's zod-4 task, not this plan. |
| `node scripts/check-release-payload-ceiling.cjs --check` | PASS | `entryCount=1916 unpackedSize=31168458 size=9529708`, 0 findings |
| `node tests/test-341-shrinkwrap-no-dev.cjs` | PASS (4/4) | - |
| `node scripts/doctor.cjs --acceptance` | 21/22 points passed | Sole FAIL: `verify-release-clean-tree` ("tracked-file drift: 1 file(s)") -- caused by a peer session's live uncommitted edit to `evals/plurai/211-baseline.json` present throughout this measurement pass (per this repo's multi-session tree-sharing reality); not a Phase 267 defect, not reproducible on a genuinely clean tree, not logged to `deferred-items.md` |

## Pre-existing reds (do not fix in this phase unless a plan says so)

1. `run-all-198.sh`: "Part 8 local-only floor", "SPEC-2 contract-version + per-tool schema validity", "SPEC-5 hooks/ adapter-only budget".
2. `run-all-234.sh`: `test-234-dist-bundle.cjs`, `test-234-free-core-network-scan.cjs`, `test-234-plugin-root-migrated.cjs`.
3. `run-all-199.sh`: "AS-01/06/07 scanSurface engine + CSV parity + zero-network + perf", "AS-09 PR-gate CLI + final e2e smoke".
4. `run-all-127.sh`: `test-127-03-acceptance-gates.sh`, `127.1-embedding-integrity.test.cjs`, `127.1-index-config.test.cjs`, `127.1-graphrag-overlap.test.cjs` (fixture-gated, `MINDRIAN_127_1_FIXTURE_MODE`).
5. `tests/test-257-strict-input-shapes.cjs` Arm B (flaky `theo_health` boot race) and Arm F (stale `brain_ask` description fixture).
6. `tests/test-198-contract-schema.test.cjs` (`_def.typeName` introspection, fails on zod 3 today; Wave 0 rewrites it against zod 4).
7. `tests/test-257-brain-tool-egress-invariant.cjs` Arm 2 (zero-egress-on-canary) -- NEW find this session, see `deferred-items.md`.
8. `tests/test-257-shim-honest-refusal.cjs` Arm 4 (G3 `egress_disclosure` on the wire) -- NEW find this session, see `deferred-items.md`.

## REGRESSION LEGS filled into tests/run-all-267.sh

Per Task 2 step 7: only individual test files that PASSED in the table above
are wired as `run_if` aggregator legs, so `tests/run-all-267.sh` stays
green-able. Suites carrying a pre-existing red (`run-all-198`, `run-all-234`,
`run-all-199`, `run-all-127`, `test-257-strict-input-shapes.cjs`,
`test-198-contract-schema.test.cjs`, `test-257-brain-tool-egress-invariant.cjs`,
`test-257-shim-honest-refusal.cjs`) are NOT aggregator legs -- every later
plan compares them against this file by hand instead.
