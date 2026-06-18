---
phase: 167-harness-manifest-and-surface-generator
plan: 05
subsystem: verify
tags: [adversarial-verdict, harness-as-code, part8-leak-scan, single-phase-gate, instrumentation, no-em-dash, harn-01, harn-02, harn-03]

# Dependency graph
requires:
  - phase: 167-01
    provides: scripts/build-harness-manifest.cjs + data/harness-manifest.json + recipe-maps.loadManifest() + the Wave-1 Part 8 boundary suite
  - phase: 167-02
    provides: the manifest --check pre-commit wiring (live hook + installable template) + run-all-167.sh CI leg
  - phase: 167-03
    provides: the fable-mode posture-scoped selfCritiqueFn seam in BOTH chain-executor paths
  - phase: 167-04
    provides: scripts/build-new-surface.cjs + commands/new-surface.md (the /mos:new-surface generator) + the transitive landing in connector-registry
provides:
  - tests/test-harness-167-verdict.cjs (the adversarial structured {passed, findings[]} verdict over HARN-01/02/03 + D-167-01..06 + the canon guards)
  - tests/test-harness-167-part8-leak.cjs (the Part 8 leak scan over every Phase-167 surface + the re-run planted-secret manifest tripwire)
  - tests/run-all-167.sh (FINALIZED as the single PASS/FAIL phase gate, 12 legs)
affects: [v1.14.0-execution-order-167-then-164-165]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "structured verdict accumulator: record(check, passed, detail) -> findings[]; verdict { passed, findings[] }; exit non-zero printing findings if ANY check failed (mirrors 166 W8 + 163 W6)"
    - "guard(check, fn): a thrown AssertionError becomes a FAILED finding carrying the assertion message, so a real defect is SURFACED, never silently swallowed"
    - "verdict-by-instrumentation: each requirement is exercised against the REAL surface (the real generator, the real runChain executor, the real connector-registry), never a promise"
    - "Part 9 explicit-N/A-with-named-rationale: an instrumented (no confirmNode / no review_status:confirmed in any 167 surface) reasoned N/A, NOT a rubber-stamp (LOW-1)"
    - "comment-filtered leak scan: strip CJS comment leaders before counting so a forbidden token named in prose cannot self-invalidate the gate; never a bare unfiltered == 0"

key-files:
  created:
    - tests/test-harness-167-verdict.cjs
    - tests/test-harness-167-part8-leak.cjs
  modified:
    - tests/run-all-167.sh

key-decisions:
  - "the verdict proves the manifest is a byte-stable 3-MAP DIGEST with EXACTLY three maps and rejects both a forced STALE and a per-surface 4th row (D-166-03 enforced by instrumentation)"
  - "the verdict drives the REAL runChain in BOTH the sync and async _runChainResilient paths and asserts the IDENTICAL quality_early_stop / LOW_QUALITY halt on a material step (MEDIUM-3 no-drift), skipping a trivially-safe step"
  - "the new-surface check reads the connector keys under the connector: block (the Phase 143.3 contract), NOT at the top level -- the verdict caught and I fixed an over-strict top-level-key regex; the Wave-4 generator emits the 11 keys correctly"
  - "Part 9 is recorded as an explicit N/A with the literal named rationale + an instrumented proof that no Phase-167 surface calls confirmNode / writes review_status:confirmed"
  - "the projection --check STALE is logged as DI-167-01 (a PRE-EXISTING Phase-157 artifact gap, out of scope); Phase 167's manifest digest byte-matches the committed projection, so the harness gate stays green and faithful"

requirements-completed: [HARN-01, HARN-02, HARN-03, D-167-01, D-167-02, D-167-03, D-167-04, D-167-05, D-167-06]

# Metrics
duration: ~30min
completed: 2026-06-18
---

# Phase 167 Plan 05: Adversarial Verify Wave Summary

**The adversarial structured verdict (tests/test-harness-167-verdict.cjs) returns a `{passed:true, findings:[9 checks]}` over HARN-01/02/03 + D-167-01..06 + the Part 8 boundary + the Part 9 explicit-N/A-with-named-rationale + the no-em-dash instrumentation, proving by INSTRUMENTATION (against the real generator, the real runChain executor in BOTH paths, and the real connector-registry) that the manifest is a byte-stable 3-map digest with no per-surface row, recipe-maps wraps without retiring, the manifest --check is enforced in BOTH pre-commit and CI, fable-mode is posture-scoped in both execution paths with no convergence stop and no fable tier, and /mos:new-surface emits + registers + lands transitively without touching ignite; a Part 8 leak scan (tests/test-harness-167-part8-leak.cjs) finds zero forbidden tokens across every Phase-167 surface and re-runs the planted-secret manifest tripwire; tests/run-all-167.sh is FINALIZED as the single PASS/FAIL phase gate at 12/12 green, with the 166 (23/23) + connector + command-registry + manifest regressions all green.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 of 2 complete
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

### Task 1 - the adversarial verdict + the Part 8 leak scan (commit 7b63e978)

- **tests/test-harness-167-verdict.cjs** (9 checks, the structured `{passed, findings[]}` verdict): a `record(check, passed, detail)` accumulator + a `guard()` wrapper that turns a thrown AssertionError into a FAILED finding carrying the real message. It exercises:
  1. **HARN-01 / D-167-01** -- `buildManifest()` byte-stable across two calls; EXACTLY three maps `{posture, wiring, ranked_next_reach}` named by role+path+sha256-digest (no inlined contents, only the four machinery keys); `methodology_tier=mindrian-operation`; `--check` exits 0 clean; a forced in-memory STALE digest trips `validateManifest().stale`; a per-surface 4th row trips `validateManifest().malformed` (D-166-03 by instrumentation).
  2. **D-167-02** -- `recipe-maps.loadManifest()` returns the 3-role declared binding (tier mindrian-operation), `manifest()` aliases it, `postureForCommand` / `wiringForReach` / `rankedNextReach` all return their shipped shapes (NOT retired), and the source still documents `CONTRACT-ONLY` + cites `D-167-02`.
  3. **D-167-03** -- `build-harness-manifest.cjs --check` present in BOTH `scripts/install-pre-commit.sh` AND `tests/run-all-167.sh`.
  4. **HARN-02 / D-167-04 (sync + async)** -- drives the REAL `runChain` with a material step + a low `selfCritiqueFn` and asserts the existing `quality_early_stop` / LOW_QUALITY halt fires in the SYNC path; drives `_runChainResilient` (via roomDir + an injected no-op sleep, asserting `partial:false`) and asserts the IDENTICAL halt (MEDIUM-3 no-drift); a trivially-safe push_forward step is NOT critiqued in either path.
  5. **HARN-02 / D-167-04 (grep)** -- chain-executor (comment-filtered) has no `loop until` / `until converge` / `all passing` convergence branch (166 B3), still carries `quality_early_stop`, mints no `'fable':` model alias; `model-profiles.cjs` has no fable tier and still names opus/sonnet/haiku.
  6. **HARN-03 / D-167-05** -- emits an 11-key surface to a tmp dir (env override) and asserts every connector key appears under the `connector:` block; an off-frozen reach_id is REFUSED (emitSurface throws + validateSurface flags OFF_FROZEN); the REAL `/mos:new-surface` is registered in connector-registry.json; the manifest `--check` is clean and the manifest still has exactly three maps (transitive landing, no per-surface row); `commands/ignite.md` is not listed as a `files_modified` in any Phase-167 plan.
  7. **D-167-06 (Part 8)** -- spawns the Wave-1 boundary suite (the planted-secret tripwire) and asserts exit 0.
  8. **D-167-06 (Part 9)** -- an explicit NOT-APPLICABLE finding with the LITERAL named rationale ("no Phase-167 surface writes a truth-claim node; fable-mode augments quality and halts, never promotes to confirmed; the Part 9 confirm-gate is upstream (Phase 129.5) and untouched"), INSTRUMENTED by asserting no Phase-167 surface calls `confirmNode(` or writes `review_status: confirmed` (so the N/A is reasoned, not a rubber-stamp, LOW-1).
  9. **D-167-06 (no em-dash)** -- zero U+2014 across all 17 Phase-167 files.
- **tests/test-harness-167-part8-leak.cjs** (4 checks): a comment-filtered Brain-write / raw-fetch / external-http leak scan over all six Phase-167 surfaces (the manifest generator, recipe-maps, the chain executor, the new-surface generator + command, the framework-runner agent); a SHARP-SCAN self-test (proves the regexes catch a planted `mcp__brain_write(` + a planted raw `fetch(`, do NOT false-positive on a `.fetchCorpus(` chokepoint, and do NOT trip on a comment); the re-run planted-secret manifest tripwire (seed a room/ path into an in-memory manifest copy -> RED, prove the real artifact clean -> GREEN); a no-em-dash check.

### Task 2 - finalize run-all-167.sh as the single phase gate (commit bb694e71)

- Registered the two Wave-5 suites in `CJS_SUITES` (`test-harness-167-verdict.cjs` + `test-harness-167-part8-leak.cjs`) as the final gated legs; added both to the em-dash sweep targets; rewrote the header to name the FINALIZED single PASS/FAIL gate.
- All prior legs were already present from Waves 1-4 (the per-suite loop with missing-file-gates-to-FAIL, the manifest `--check` CI leg, the new-surface `--check` tmp-dir fixture leg, the Part 8 grep sweep, the em-dash sweep). The full gate runs to completion, prints per-suite PASS/FAIL + a final tally, exits 0 only when the whole phase is green.
- **Full gate: Total 12, Passed 12, Failed 0.**

## Findings

The adversarial verdict caught one issue during execution, surfaced and resolved per the leak-net mandate:

**FINDING-167-05-01 (instrumentation defect, FIXED in-wave):** the verdict's first
draft asserted the 11 connector keys at the TOP LEVEL of the emitted surface
frontmatter via `(^|\n)key:`. The verdict fired RED ("missing connects_to_spine").
On inspection the Wave-4 generator emits the 11 keys CORRECTLY under the
`connector:` block (the Phase 143.3 connector-frontmatter contract), indented
beneath it -- so the generator is correct and the verdict's regex was over-strict.
Fixed the verdict to assert each key as a (possibly indented) YAML key plus the
presence of the `connector:` block. This is the verdict behaving as designed: it
caught a discrepancy, was investigated, and the defect was in the test
instrumentation, not the shipped surface. No production code changed.

No REAL defect was found in any Phase-167 shipped surface. All nine verdict
checks pass by instrumentation.

## Deferred Issues (out of scope)

**DI-167-01: data/brain-orchestration-projection.json is STALE against its own
generator (PRE-EXISTING Phase-157 artifact gap).** `node
scripts/build-orchestration-projection.cjs --check` exits 1 (the generator emits
213 nodes; the committed artifact carries 207, a +92-line diff from surfaces
that landed since the last projection regeneration at Phase 157-04). This is the
Phase 157 projection surface, NOT a Phase 167 deliverable. Phase 167's harness
manifest DIGESTS the committed projection BYTES and is internally consistent: the
manifest `ranked_next_reach` digest byte-matches the committed projection
(verified by instrumentation) and `harness-manifest --check` is GREEN. Logged to
`.planning/phases/167-harness-manifest-and-surface-generator/deferred-items.md`;
NOT fixed (out of the executor scope boundary -- the projection regeneration is a
multi-surface Phase-157 maintenance action, with Phase 137 the natural home for
continuous sync). The committed projection artifact was left untouched.

## Authentication Gates

None.

## Known Stubs

None. Both new suites drive the REAL surfaces (the real generator via `require`,
the real `runChain` / `_runChainResilient` executor, the real on-disk
connector-registry + manifest, the real Wave-1 boundary suite spawned as a
subprocess). The Part 9 N/A is an explicit instrumented finding, not a stub.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or trust-boundary
schema was introduced -- this is a verify-only wave (two test files + an aggregator
edit). The threat register dispositions are honored by instrumentation:
T-167-21 (no merge / no per-surface row) by the 3-map-digest + per-surface-row
rejection check; T-167-22 (material low-quality auto-run) by the sync+async
LOW_QUALITY halt drive; T-167-23 (convergence stop / fable tier) by the
comment-filtered negative greps; T-167-24 (any egress) by the 6-surface leak scan
+ the re-run planted-secret tripwire; T-167-25 (hand-edited surface) by the
OFF_FROZEN refusal; T-167-26 (em-dash) by the 17-file no-em-dash sweep; T-167-27
(rubber-stamp Part 9) by the instrumented named-N/A; T-167-SC (installs) by zero
new packages.

## Verification

- `node tests/test-harness-167-verdict.cjs` -> `VERDICT: {"passed":true,"checks":9,"failed":0}` (exit 0)
- `node tests/test-harness-167-part8-leak.cjs` -> 4 passed, 0 failed (exit 0)
- `bash tests/run-all-167.sh` -> **Total 12, Passed 12, Failed 0** (the single phase gate, exit 0)
- `bash tests/run-all-166.sh` -> 23/23 (the 166 regression, green)
- `node scripts/build-connector-registry.cjs --check` -> `connector-registry: OK`
- `node scripts/build-command-registry.cjs --check` -> `command-registry: OK`
- `node scripts/build-harness-manifest.cjs --check` -> `harness-manifest: OK`
- manifest `ranked_next_reach` digest byte-matches the committed projection bytes (instrumented)
- DI-167-01: `build-orchestration-projection.cjs --check` STALE (PRE-EXISTING, out of scope, logged + not fixed)

## Self-Check: PASSED

All created/modified files exist on disk (tests/test-harness-167-verdict.cjs,
tests/test-harness-167-part8-leak.cjs, tests/run-all-167.sh) and both per-task
commit hashes (7b63e978, bb694e71) are present in the git log.
