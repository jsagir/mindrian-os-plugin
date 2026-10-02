# Phase 267 Verification Gates (267-18 Task 1)

Final gate measurement on the migrated tree, compared row by row with
`267-BASELINE.md`. Measured 2026-10-02 by the 267-18 executor.

```
MEASURED_AT_HEAD=ba67f66b578fd4b08f64f58c6969f1f3599a1093   (ba67f66b5, the 267-17 summary commit)
repo version (node lib/core/repo-version.cjs): 2.0.0-beta.56
claude --version: 2.1.287 (Claude Code)
node: v22.23.1 (shell), v22.22.2 (the WSL node Claude Desktop launches)
```

How to read the Delta column: **same** means the outcome equals the baseline
(including a baseline red that is still red for the same reason), **fixed**
means red before and green now, **NEW RED** means green before and red now for
a reason this phase caused, and **WORSE (masked)** means red before and red now
but the failure is broader or has a different, phase-caused reason hidden
behind the old red. A row whose red is caused by a peer session's later work
(not by Phase 267) is labelled **same + peer drift** and says so.

## Hygiene and deviations from the plan's literal commands

- Every suite ran with `HOME=$(mktemp -d) MINDRIAN_ROOMS_HOME=$(mktemp -d)`
  (shared-tree rule), logs kept outside the repo.
- Two rows could not give a true answer under an empty HOME and were re-run
  with a documented, narrow exception:
  - `doctor --acceptance`: install-state, installed_plugins.json and the
    marketplace checkout live under the real HOME. Re-run with the real HOME and
    a throwaway `MINDRIAN_ROOMS_HOME` (read-only diagnostic, no `--fix`). The
    hermetic run (16/22) is recorded as the ENV artifact it is.
  - The live CLI probe needs the real HOME to authenticate `claude -p`. Run with
    the real HOME and a throwaway `MINDRIAN_ROOMS_HOME` (the probe also makes
    its own fixture room).
  - `test-354-concurrency-surfaces` K4 needs a Playwright browser. Re-run with
    `PLAYWRIGHT_BROWSERS_PATH=/home/jsagi/.cache/ms-playwright` and the hermetic HOME.
- `tests/run-all-267.sh` does NOT end FAIL=0 (see row 1). The plan's acceptance
  line expected FAIL=0. That cannot be met without refreshing peer-drifted
  baselines, which this plan's file list does not cover. Carried forward below
  with owners.

## Gate table

| # | Command | Baseline outcome | Final outcome | Delta |
|---|---------|------------------|---------------|-------|
| 1 | `bash tests/run-all-267.sh` | n/a (aggregator written at baseline, legs mostly SKIP) | PASS=29 FAIL=3 SKIP=1. FAIL: CIRS (c) 31 vs 32, zod4 contract (a)(b)(d), 354 concurrency K4. SKIP: the opt-in live CLI leg only | same + peer drift (rows 2, 3, 19 explain every red) |
| 2 | `node tests/test-267-mcpv2-cirs-gates.cjs` | PASS (31 descriptors, 53 shape violations, 0 under lib/mcp) | PASS=2 FAIL=1: Check (c) expects 31 descriptors, tree has 32 (`research_run`, Phase 363-17, a peer addition) | same + peer drift. Zero surfaces under lib/mcp in the shape baseline, so the hard invariant holds. Needs a baseline refresh to 32 |
| 3 | (zod4 contract, a run-all-267 leg) `tests/test-267-mcpv2-zod4-contract.cjs` | n/a | PASS=1 FAIL=3: (a) description diff on `tool:orchestration` (Phase 366-16 `8a66273ce`, router stub wording), (b) extras `tool:research_run:membership` and the same description, (d) importer `scripts/fork359-permission-probe.cjs` (359-05, it required zod before 267) | same + peer drift. No Phase 267 commit changed a tool description or added a zod importer |
| 4 | `bash tests/run-all-198.sh` | 13 pass, 3 fail (Part 8 local-only, SPEC-2, SPEC-5) | 13 pass, 3 fail, same three legs | same verdict. See row 26: SPEC-2's red now has a different, phase-caused cause |
| 5 | `bash tests/run-all-234.sh` | 8 pass, 3 fail | PASS=9 FAIL=2 (free-core-network-scan, plugin-root-migrated) | fixed (dist-bundle is green now) |
| 6 | `bash tests/run-all-199.sh` | 3 pass, 2 fail (AS-01/06/07, AS-09) | 3 pass, 2 fail, same legs | same |
| 7 | `bash tests/run-all-266.sh` | PASS=11 | PASS=11 FAIL=0 | same |
| 8 | `bash tests/run-all-127.sh` | 12 pass, 4 fail (fixture-gated) | 12 pass, 4 fail, same four | same |
| 9 | `node tests/test-257-brain-tool-egress-invariant.cjs` | FAIL (Arm 2, zero egress on a canary) | FAIL, same arm (a blocked brain_query still opened a socket carrying `theo_health`) | same (known, deferred-items.md 267-01) |
| 10 | `node tests/test-257-envelope-passthrough.cjs` | PASS 6/6 | PASS | same |
| 11 | `node tests/test-257-refusal-egress-kind.cjs` | PASS 6/6 | PASS | same |
| 12 | `node tests/test-257-shim-honest-refusal.cjs` | FAIL (Arm 4, `egress_disclosure` key missing) | FAIL, same arm | same (known, deferred-items.md 267-01) |
| 13 | `node tests/test-257-strict-input-shapes.cjs` | FAIL: Arm B (flaky boot race) and Arm F (stale fixture) only; every other arm ran | exit 1 at "UNEXPECTED ERROR: shim exited (code=1) before responding". Arms Z1..Z4c pass, then the run aborts. Arms A to G never execute | **WORSE (masked)**. See "Finding F-A" below |
| 14 | `node lib/core/mcp-dep-heal.test.cjs` | PASS 9/9 | PASS 9/9 | same |
| 15 | `node tests/test-265-gate-render-elicit-schema.cjs` | PASS (5 arms) | PASS (5 arms) | same |
| 16 | `node tests/test-265-mcp-surface-organ.cjs` | PASS 16/16 | PASS 16/16 | same |
| 17 | `node tests/test-248-surface-probes.cjs` | PASS 25/25 | PASS 25/25 | same |
| 18 | `node tests/test-248-resolver-census.cjs` | PASS 4/4 | PASS 4/4 | same |
| 19 | `node tests/test-354-concurrency-surfaces.cjs` | PASS (25 checks) | hermetic HOME: FAIL 1 of 19 (K4, no Playwright browser). With `PLAYWRIGHT_BROWSERS_PATH` set: PASS - 25 checks | same (K4 is an ENV GAP under an empty HOME, not a regression; proven by the 25/25 re-run) |
| 20 | `node tests/test-354-egress-typed-question.cjs` | PASS 46/46 | PASS 46/46 | same |
| 21 | `node tests/test-354-extract-shallow-contract.cjs` | PASS 13 | PASS 13 | same |
| 22 | `node tests/test-354-registration-diagnostics.cjs` | PASS 12 | PASS 12 | same |
| 23 | `node tests/test-354-room-symlink-containment.cjs` | PASS 10 | PASS 10 | same |
| 24 | `node tests/test-354-theo-journey.cjs` | PASS 15/15 | PASS 15/15 | same |
| 25 | `node tests/test-276-claim-write-primitive.cjs` | PASS 44/44 | PASS 44/44 | same |
| 26 | `node tests/test-198-contract-schema.test.cjs` | FAIL (zod 3 `_def.typeName` introspection, then "context_assemble schema PARSES a synthesized sample") | FAIL at line 57, "contract_version registers (flag off)": the file's `makeFakeServer()` only implements `tool()`, so every migrated registrar logs `server.registerTool is not a function` | **WORSE (masked)**. See "Finding F-B" below |
| 27 | `node scripts/check-release-payload-ceiling.cjs --check` | PASS, entryCount=1916 unpackedSize=31168458 size=9529708 | PASS, entryCount=1982 unpackedSize=32873598 size=10022740, 0 findings | same (within ceiling; +66 entries, +1.7 MB unpacked, +0.49 MB packed from the v2 packages and the new tests) |
| 28 | `node tests/test-341-shrinkwrap-no-dev.cjs` | PASS 4/4 | PASS 4/4 | same |
| 29 | `node scripts/build-connector-registry.cjs --check` | n/a (not in the baseline command list) | `connector-registry: OK` | same (green) |
| 30 | `node scripts/doctor.cjs --acceptance` | 21/22, sole FAIL verify-release-clean-tree (peer's dirty file) | hermetic HOME: 16/22 (ENV: install-state, deployment-surfaces, marketplace, installed_plugins, L4 handshake skipped). Real HOME: 21/22, sole FAIL verify-release-clean-tree ("tracked-file drift: 10 file(s)", all in peer-owned `.planning/` seeds, ROADMAP and 364-INPUT; none are 267-18 files) | same |
| 31 | Live wireSnapshot, `bin/mindrian-mcp-server.cjs` (hermetic fixture room) | 44 tools, 9 prompts, 10 resources, 3 templates | 45 tools, 9 prompts, 10 resources, 3 templates | same + peer drift (+1 tool is `research_run`, 363-17; `wire-snapshot-zod4.json` was refreshed to 45 in 267-11) |
| 32 | Live wireSnapshot, `bin/mindrian-brain-mcp-client.cjs` | 6 tools | 6 tools | same |

### Extra legs measured (not in the baseline, recorded so the next session does not rediscover them)

| Command | Final outcome | Class |
|---------|---------------|-------|
| `bash tests/run-all-354.sh` | PASSED=14 FAILED=5 SKIPPED=1: concurrency K4, chat inert render, POC save origin, POC room journey (all four Playwright, ENV GAP), framework command ledger T2 (`plugin_version drift: ledger=2.0.0-beta.48 repo=2.0.0-beta.56`, known/version drift) | ENV GAP x4, known x1. Equal to 267-16 and 267-17 |
| `bash tests/run-all-363.sh` | PASSED=43 FAILED=2 SKIPPED=1 KNOWN=8. FAILED: "no new dependency" (fixture `tests/fixtures/363-pre-phase.json` still lists `@modelcontextprotocol/sdk@^1.30.1` and `ext-apps@^1.5.0`; the tree now has `ext-apps@^2.0.3` and `@modelcontextprotocol/node@^2.1.0`), and "run-all-3551 recorded signature NOT found (PASS=63 FAIL=5)" | "no new dependency": known, already stale before 267-17 and now one more difference (phase-caused, harmless, needs a fixture refresh). run-all-3551: not a 267 file, peer drift |
| `node tests/test-270-dynamic-tree.cjs` | FAIL `server.registerResource is not a function` (its stub implements only `resource()`) | NEW FAILURE caused by 267-09, logged in deferred-items.md (267-11). Fix: teach the stub `registerResource`. Not fixed here |
| `node tests/test-238-chosen-validation.cjs` | FAIL (memory_event count +2, expected +1) | known (deferred-items.md 267-07, Phase 345/354/355 growth) |
| `node tests/test-345-gate-ratify.cjs` | PASS (33 checks) | fixed relative to the 267-07 note (red then) |
| `node tests/test-237-approve-executes.cjs` | FAIL Leg 7, mutation needle drifted | known (267-07, Phase 347 CR-01) |
| `node tests/test-347-visualize-real-chain.cjs` | FAIL 1 check (safeResolveSection count 7 vs 6) | known (267-06) |
| `node tests/test-353-filing-gate.cjs` | FAIL `EVENT_TYPES.size is 102` | known (267-07) |
| `node tests/test-358-b1-surfaces.cjs` | PASS 87/87 | fixed (267-08 closed the scanner gap) |

## Findings (honest record, not fixed here: this plan changes no code)

### Finding F-A (WORSE, masked): `test-257-strict-input-shapes.cjs` Arms A to G are dark

Baseline: only Arms B and F were red; every other arm ran. Now the file aborts
right after Arm Z4c with `UNEXPECTED ERROR: shim exited (code=1) before
responding`, MODULE_NOT_FOUND from `requireWithHeal` at line 58 of the scratch
copy of the pre-migration shim (`7093e79b`).

Root cause, reproduced by hand: the scratch shim symlinks `lib/` back to the
repo, so `lib/core/mcp-dep-heal.cjs` runs from the repo's real path. Its
`require('@modelcontextprotocol/sdk/...')` therefore resolves against the repo's
`node_modules`, never the scratch `node_modules` that 267-17 built with a v1
symlink. The v1 SDK is gone from the repo's `node_modules`, so the require fails;
dep-heal then runs a live `npm install` in the dev repo (it ran three times
during this measurement; manifests and shrinkwrap stayed byte-identical, only
`node_modules/.package-lock.json` is touched) and the require fails again.
267-17 recorded this file as "equal to baseline"; that recorded run appears to
have happened before the v1 package left `node_modules` (its Task 1 table), and
the later suite table was not a fresh measurement.

Why it matters: Arms E, F, G are the before-versus-after legs that prove the
shim's refusal and egress behaviour did not change across the migration. Today
they prove nothing, and the file also triggers a stray `npm install` in the repo
each run. The Part 8 shim canary itself (`test-267-mcpv2-brain-shim.cjs`,
PASS=6) is a separate green test and still guards the boundary.

Options (navigator decision, one recommended): (1) recommended, rewrite the
scratch shim's three `requireWithHeal('@modelcontextprotocol/sdk/...')` calls to
plain absolute `require()` of the on-disk v1 copy in `mcp-server-brain/node_modules`
(about five lines, no dependency change), keep the explicit SKIP when that copy
is absent; (2) vendor a small v1 fixture; (3) retire the before-versus-after legs
and keep the strict-shape arms. Owner: a `/gsd-quick` against the 267 phase, not
a Phase 366 file.

### Finding F-B (WORSE, masked): `test-198-contract-schema.test.cjs` red for a different reason

Baseline red: zod 3 introspection (`_def.typeName`), fixed by 267-03, which left
only the older "context_assemble sample" assertion red. Now it dies earlier: the
file's `makeFakeServer()` has `tool()` only, so contract_version and every
`registerCore` tool fail to register (`server.registerTool is not a function`).
The same stale-stub disease 267-06/07 fixed in ten other fixtures; this one hid
behind SPEC-2's already-red status (run-all-198 still shows the same three red
legs). A scratch copy with a `registerTool` sibling added only moves the failure
to "contract_version.def is a zod schema": the test's introspection reads a raw
shape while `registerTool` hands over a `z.object`, so a real fix is a small
rewrite of the test's schema walk, not a one-liner. Class: NEW FAILURE caused
by 267-06 (contract-version.cjs) hidden by a known red. Not fixed here.

### Finding F-C: the live CLI moved to the 2026 era between 2.1.281 and 2.1.287

See `267-TRIPOLAR-PROBES.md`, "## CLI (post-migration)". Short version: the
pre-migration probe saw `initialize` at `2025-11-25` with `elicitation` declared;
Claude Code 2.1.287 now opens stdio with `server/discover` and
`subscriptions/listen` and never sends `initialize`. The migrated server answers
that era, so the connection works. By the 267-11 design (proved by the dual-era
test), a 2026-era connection gets no inline `elicitInput`, so the CLI gate drops
from rung (a) to rung (b). This is the exact consequence 267-11's decision rule
asked a navigator to rule on for Desktop; it now applies to the CLI.

## RCA check (Task 1 step 3)

- `ls .planning/debug/ | grep -E "mcp-http-flag-off|app-views-schema|gate-elicitation|runtime-loop-prompts|mcp-server-sigterm|mcp-http-listen-error"` prints nothing.
- All six are under `.planning/debug/resolved/`.
- RCA 7, `.planning/debug/mcp-shim-preseeded-session-id-rejected.md`, exists and is open with its fix PENDING a navigator decision.
- Also open and not this phase's to fix: `.planning/debug/desktop-session-binding-fallback.md` (Desktop `room_bind` `no_session_id` and the registry-`active` fallback). The post-migration Desktop smoke records whether it changed.

## Carried forward (owners)

| Item | Owner | Why it is not closed here |
|------|-------|---------------------------|
| CIRS Check (c) baseline 31 to 32 and zod4 (a)(b)(d) refresh (research_run membership, orchestration wording, fork359 importer) | whoever lands Phase 366 and refreshes the pinned baselines together (one commit, all three re-measured) | peer 366 is still changing `research_run` and router wording in this tree; a refresh now would be stale in a day |
| F-A test-257 before-legs | navigator decision, then a `/gsd-quick` | needs a choice of option 1, 2 or 3 |
| F-B test-198-contract-schema | `/gsd-quick` | small test rewrite, outside this plan's file list |
| test-270-dynamic-tree stub | `/gsd-quick` (267-09 fallout) | outside this plan's file list |
| `tests/fixtures/363-pre-phase.json` refresh | Phase 363 owner | fixture, not 267 production |
| stale "ajv via sdk" comment `lib/core/brain-client.cjs:2358`, `references/security/cve-db.json` hono/ajv "via sdk" notes, `lib/core/mcp-dep-heal.cjs` rationale comments naming v1 | seed (d) of this plan | brain-client is on this plan's never-edit list; the other two are comment or note prose |
| run-all-198 Part 8 local-only (sensors.cjs names `brain-client.cjs`), SPEC-5 (`scripts/on-stop` 618 lines vs 570 budget), run-all-199 AS-01/06/07 and AS-09, test-198-adapter-budget, run-all-127 fixture-gated four, run-all-234 network-scan and plugin-root-migrated, test-257 egress and shim reds, test-238, test-237, test-347, test-353, test-354 framework-command-ledger T2 | their own phases | classified below, none is a Phase 267 regression |

## Classification of the other known reds (docs/RCA-TEMPLATE.md vocabulary)

| Red | Class |
|-----|-------|
| run-all-198 Part 8 local-only floor, SPEC-5 / adapter-budget, run-all-199, run-all-127, run-all-234 (2 left) | known tracked (pre-existing at baseline) |
| test-257 egress-invariant Arm 2, shim-honest-refusal Arm 4 | known tracked (deferred-items.md 267-01); recorded as NEW FAILURE there at baseline discovery, not caused by 267 |
| test-354 concurrency K4, chat-inert-render, POC save origin, POC room journey, Playwright legs | ENV GAP (no Playwright browser under an empty HOME; K4 proven green with the browser path) |
| test-354 framework-command-ledger T2 | known (version drift beta.48 vs beta.56) |
| test-270-dynamic-tree | NEW FAILURE, caused by 267-09, filed in deferred-items.md |
| test-257 strict-input-shapes A to G, test-198-contract-schema | NEW FAILURE (phase-caused, masked by an old red), findings F-A and F-B above |
| zod4 (a)(b), CIRS (c) | known, peer drift (Phase 363-17, 366) |
| test-238, test-237, test-347, test-353 | known tracked (deferred-items.md 267-06/07, other phases' counts) |
| run-all-363 "no new dependency" | known, fixture stale |
| doctor hermetic-HOME 16/22 | ENV GAP (needs the real install state) |

## After the navigator's rulings (re-measured 2026-10-02, same hygiene)

Rulings: (a) the CLI at rung (b) on the 2026-era host is accepted (F-C); (b) the test-257 v1
before-versus-after legs are RETIRED (F-A, option 3); (c) the human Desktop smoke and the Cowork probe
are deferred. Quick 261002-by3 (122766d8a, e4733065e, fc7c6c552) carried out (b) and also fixed F-B
and the test-270 stubs.

| Row | Before the rulings | After | Delta |
|-----|--------------------|-------|-------|
| `test-257-strict-input-shapes.cjs` (row 13) | aborts after Z4c, Arms A to G dark | Z1 to Z4c, A, C, D, E, E2 run and pass; only Arm B fails (the baseline's flaky `theo_health` boot race, recorded since 267-01); the v1 before-legs are gone and no stray `npm install` fires | F-A closed by retirement; back to the baseline red |
| `test-198-contract-schema.test.cjs` (row 26) | FAIL at line 57 (stub knows only `tool()`) | exit 0 | fixed (F-B closed) |
| `bash tests/run-all-198.sh` (row 4) | 13 pass, 3 fail | 14 pass, 2 fail (Part 8 local-only floor, SPEC-5), SPEC-2 green | fixed (one leg better than baseline) |
| `test-270-dynamic-tree.cjs` | FAIL `registerResource` stub | exit 0 | fixed |
| `bash tests/run-all-267.sh` (row 1) | PASS=29 FAIL=3 SKIP=1 | PASS=29 FAIL=3 SKIP=1: CIRS (c), zod4 (a)(b)(d), 354 concurrency K4 (ENV GAP). Same three, same reasons | same + peer drift, carried forward |

Zero NEW RED rows remain. The only reds left in the phase's own aggregator are the two peer-drift
baselines (MCPV2-08 and MCPV2-03 stay `[ ]` until a combined refresh after Phase 366 lands) and the
Playwright ENV GAP.

## Tri-Polar and research trail

- CLI post-migration: `267-TRIPOLAR-PROBES.md`, "## CLI (post-migration)".
- Desktop-surrogate (automated, not a human probe): `267-TRIPOLAR-PROBES.md`, "## Desktop-surrogate".
- Desktop and Cowork post-migration: DEFERRED 2026-10-02 by navigator ruling, recorded in
  `267-TRIPOLAR-PROBES.md` ("## Desktop (post-migration)", "## Cowork (post-migration)"). MCPV2-13 stays open.
- Research trail (dual home): the room write to `~/MindrianRooms/rethinking-mindrianos/research/` was
  REFUSED by the write-scope-check hook (active room `egain-des-liquid-conductor`) and was not routed around.
  Filed instead at `/home/jsagi/MindrianOS/research/2026-10-02-mcp-sdk-v2-migration-closeout-267.md`
  with `mirror_status: PENDING` (commit b5db689fa in the `/home/jsagi` repository, precedent 55e077bef).
  Follow-up: `/mos:rooms switch rethinking-mindrianos`, then file the identical content at
  `research/2026-10-02-phase-267-mcp-v2-closeout/phase-267-mcp-v2-closeout.md`.
- Follow-up seeds: `.planning/seeds/SEED-108` to `SEED-111`.
