---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 21
subsystem: testing
tags: [part8, egress-sweep, cirs, doctor-blocker, tripwire, d-57-file, verification-stamp]

# Dependency graph
requires:
  - phase: 355-06
    provides: "lib/core/verification-stamp.cjs (Stamp, POSTURE, stampFinding(s), loadFrameworkNames, resolveEndpoint), lib/core/verification-stamp-format.cjs, tests/helpers/theo-replay-355.cjs, tests/fixtures/355/theo-stub-responses.json"
  - phase: 355-07
    provides: "scripts/jev-devtime-client.cjs's EGRESS_PROFILES precedent, the BANNED-list tripwire idiom"
  - phase: 355-15
    provides: "tests/fixtures/355-hsi-measurement-record.json (jev_model, fixture_sha256), scripts/measure-hsi-thinking-mode.cjs --check (exit 0/77/1)"
  - phase: 355-16
    provides: "scripts/whitespace-command.cjs (whitespaceEndpoints), scripts/hsi-to-graph.cjs (hsiEndpoints)"
  - phase: 355-17
    provides: "scripts/stamp-connections.cjs (main, parsePairs), the rs-pairs.json producer fixture shape"
  - phase: 355-18
    provides: "scripts/eureka-portfolio-report.cjs (eurekaEndpoints, stampRankedPairs), the eureka-report.json producer fixture shape"
provides:
  - "tests/test-355-part8-egress.cjs: the phase-wide Part 8 egress sweep (legs a-f) -- no egress token in the five 355 target files, every callTool captured across five recorded producer fixtures is find_connections/{from,to}/snapshot-names, the REAL part8-egress-guard classify() refuses a planted room sentence (degrading to unverified/unavailable/egress_refused) while 50 real snapshot names classify allow/known_tool_shape, BANNED_355 appears on no non-comment lib/ or hooks/ line (scratch negative control), hooks/hooks.json references no 355 script, zero fetch attempts"
  - "tests/test-355-cirs-wiring.cjs: the D-17 CIRS proof -- the stamp module's declared POSTURE, no new reach id (sensor-eureka still rides deep_research), chain-executor.cjs never references the stamp module or stamp-connections, stamp-connections is not a registry command, find-connections keeps hitl_shape F.8, the three born-wired gates exit 0, the posture-grid todo carries the folded data point"
  - ".planning/todos/pending/2026-09-08-autonomous-safe-posture-reversibility-audit.md: '## Data point: Phase 355 verification stamp' section (read-only, consequence low, the no-gate quadrant)"
  - "scripts/check-cross-connection-honesty.cjs: checkCrossConnectionHonesty({ repoRoot, spawnImpl }), offline, zero network -- a Theo-unreachable self-test, --check replays of the 355 measurement scripts, and (when present) rule-table provenance"
  - "scripts/doctor.cjs: the 'cross-connection-honesty' acceptance blocker (id, label, severity blocker, applies_to pre-tag/full), a DOCTOR_TEST_FAIL_POINT arm, a DOCTOR_SKIP_CROSS_CONNECTION=1 escape"
  - "tests/test-355-doctor-point.cjs: 27 assertions across source hygiene, the exit 0/77/1 replay legs, matching/mismatching rule-table provenance (tmp copies), and the real doctor --acceptance point spawned end to end"
affects: ["355-27 (phase close-out reads this plan's gates as satisfied)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-cutting egress-sweep test: rather than adding assertions to each producer's own test file, a phase-closing plan drives every producer's exported endpoint seam directly (reusing the existing tests/fixtures/355/producers/*.json fixtures) to prove a PHASE-WIDE property (every wire call is find_connections/{from,to}/snapshot-names) no single producer's own test file is positioned to prove alone"
    - "Second-wall proof: a guarded callTool wrapper that runs the REAL part8-egress-guard classify() (not a mock) on the outbound {from,to} payload, so the egress_blocked -> unavailable/egress_refused degradation is proven against production classification logic, not an assumption about it"
    - "Doctor acceptance point as a pure programmatic checker + thin in-process call: scripts/check-cross-connection-honesty.cjs follows scripts/check-tool-honesty.cjs's module-shape precedent (a pure exported function, no CLI wrapper needed here since the one caller is the doctor point itself and the one direct caller in tests is the export)"

key-files:
  created:
    - tests/test-355-part8-egress.cjs
    - tests/test-355-cirs-wiring.cjs
    - scripts/check-cross-connection-honesty.cjs
    - tests/test-355-doctor-point.cjs
  modified:
    - scripts/doctor.cjs
    - .planning/todos/pending/2026-09-08-autonomous-safe-posture-reversibility-audit.md
    - .planning/ROADMAP.md

key-decisions:
  - "Leg (c)'s planted 'room sentence' uses a real Canon FORBIDDEN_PATTERNS hit (an email address, e.g. jordan.example@mindrian-test.dev) rather than merely an unsafe-shape string, so the REAL classify() verdict is genuinely 'block' (content_set), not just 'ambiguous' -- proving the strongest form of the second wall, not the weakest one that would still pass a fail-closed wrapper"
  - "The guarded callTool wrapper in leg (c) treats classify().verdict !== 'allow' as egress_blocked (matching brain-client.cjs's own actual fail-closed behavior, D-09), not only verdict === 'block' -- an 'ambiguous' verdict must also refuse, since Part 8's own design is fail-closed toward gate, never silent-allow"
  - "checkCrossConnectionHonesty resolves lib/core/verification-stamp.cjs via a FIXED path relative to the checker script itself (not via the caller-supplied repoRoot), so the rule-table-provenance test legs can use a lightweight tmp scratch root (only data/hsi-thinking-mode-rules.json + tests/fixtures/355-hsi-measurement-record.json, no lib/ tree copy needed) -- repoRoot is used only for the --check replay scripts and the two provenance files, which is exactly what those two checks need and nothing more"
  - "The doctor blocker's --check replay leg checks scripts/calibrate-citation-check.cjs (355-26's own script) by existence-guard: absent on this checkout -> not_run, never a failure -- the same missing-script-degrades-like-a-missing-record pattern icm-ruling-eval-fresh already established for a missing evals/icm/last-run.json"
  - "No row added to data/doctor-modules.json: that file's own $schema_note describes it as the accumulative-engine's organ-module registry, not the acceptance-checklist's; the icm-ruling-eval-fresh precedent (an inline point with no doctor-modules.json row) is followed exactly, per the plan's own 'open question ruled' must_have"
  - "STATE.md and REQUIREMENTS.md intentionally NOT touched this run, per the 355-06..23 precedent recorded in every prior plan's own SUMMARY.md: this working tree is shared with concurrent Phase 357/358/360/361 sessions, and a state.*/requirements.* write has previously reverted a peer's uncommitted work in this exact scenario. ROADMAP.md's phase-355-scoped checklist row (355-21 checked, Plans counter 22/28 -> 23/28) is the durable progress record instead; HIPS-04/HIPS-08/HIPS-09/HIPS-10 remain unregistered in REQUIREMENTS.md by design (355-27 registers and closes the whole HIPS family at phase close-out)"

patterns-established:
  - "The 'second wall' pattern for any future egress-adjacent stamp test: build a guarded callTool that runs the REAL classify() (never a stub) before delegating to the underlying replay/null callTool, so a test proves the actual production refusal path rather than merely asserting a degrade shape in isolation"

requirements-completed: [HIPS-04, HIPS-08, HIPS-09, HIPS-10]

# Metrics
duration: ~110min
completed: 2026-09-24
---

# Phase 355 Plan 21: Part 8 Egress Sweep, CIRS Wiring, Doctor Blocker Summary

**Two phase-wide proof tests (a six-leg Part 8 egress sweep over every 355 producer plus the real part8-egress-guard classify() second wall, and a D-17 CIRS wiring proof) land alongside one new offline doctor acceptance blocker (`cross-connection-honesty`) that fails a release if the stamp stops degrading honestly or the 355 measurement records stop replaying -- all four of this plan's standing gates (HIPS-04, HIPS-08, HIPS-09, HIPS-10) are now machine-checked.**

## Performance

- **Duration:** ~110 min (single continuous session, sequential executor on the shared main tree)
- **Tasks:** 2 completed (both `tdd="true"`; Task 1 landed as a `test` commit -- RED gate at plan level; Task 2 as a `feat` commit -- GREEN gate at plan level)
- **Files modified:** 4 created, 3 modified

## Accomplishments

- `tests/test-355-part8-egress.cjs` (22/22 assertions): leg (a) a comment-stripped egress-token sweep over the five 355 target files (a missing target FAILS, never SKIPs); leg (b) every `callTool` call captured while stamping all five recorded producer fixtures (whitespace zone, whitespace novelty, HSI via a synthetic scratch room, find-bottlenecks, eureka, find-connections) is `find_connections` with exactly the keys `{from, to}`, both values members of the local canon Framework-name snapshot; leg (c) a planted room sentence carrying a real email address is classified `block` by the REAL `part8-egress-guard.classify()`, a guarded `callTool` wrapper turns that into `{error: 'egress_blocked'}`, and the resulting stamp degrades to `unverified`/`unavailable`/`egress_refused` -- while 50 real snapshot names each pair with a fixed canon name as `allow`/`known_tool_shape` (the positive control proving the negative control is not vacuous); leg (d) `BANNED_355` (this phase's own dev-time-Jev ban list) appears on no non-comment `lib/` or `hooks/` line, with a scratch negative control (`lib/core/__scratch_355_egress.cjs`, deleted in `finally`) proving the sweep actually catches a violation; leg (e) `hooks/hooks.json` references no 355 script; leg (f) `installNetGuard().attempts() === 0`.
- `tests/test-355-cirs-wiring.cjs` (16/16 assertions): the stamp module's declared `POSTURE` (`autonomous_safe: true`, `reversibility: 'n/a (read-only)'`, `consequence: 'low'`, `writes: 'none'`); the frozen `REACH_IDS` six-member bank carries no `stamp`/`verification`/`cross_connection` member and `sensor-eureka`'s own `REACH_ID` is still `'deep_research'`; `lib/core/chain-executor.cjs` carries zero non-comment references to `verification-stamp` or `stamp-connections`; `data/command-registry.json` registers no command containing `stamp-connections`; `commands/find-connections.md`'s `hitl_shape` frontmatter is still exactly `F.8`; the three born-wired gates (`build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`, `check-shape-declaration.cjs --check`) all exit 0; the posture-grid todo carries the folded `## Data point: Phase 355 verification stamp` section.
- `.planning/todos/pending/2026-09-08-autonomous-safe-posture-reversibility-audit.md`: appended the folded posture-grid data point -- one read-only Theo call per distinct pair, zero writes of its own, canon names only; reversibility `n/a (read-only)`, consequence `low`, the no-gate quadrant; not a chain step, coordinated with Phase 356's own Jev-seat policy.
- `scripts/check-cross-connection-honesty.cjs`: `checkCrossConnectionHonesty({ repoRoot, spawnImpl })`, offline and zero network. A self-test stamps three real canon-name findings through the REAL `verification-stamp.cjs` with a Theo-unreachable `callTool` and demands every one degrades to `unverified`/`unavailable` with no path; `--check` replays of `scripts/measure-hsi-thinking-mode.cjs` and `scripts/calibrate-citation-check.cjs` must exit 0 or 77 (a missing script degrades to `not_run`, exactly like a missing record does -- `calibrate-citation-check.cjs` is 355-26's own script and does not exist on this checkout yet); when `data/hsi-thinking-mode-rules.json` exists, its `jev_model`/`fixture_sha256` must match `tests/fixtures/355-hsi-measurement-record.json`'s (it does not exist on this checkout, so this leg degrades to `not_run` for free). Never requires `brain-client`, never calls `fetch`, never reads a vendor key.
- `scripts/doctor.cjs`: one appended acceptance point, id `cross-connection-honesty`, immediately after `icm-ruling-eval-fresh` -- a `DOCTOR_TEST_FAIL_POINT` arm, a `DOCTOR_SKIP_CROSS_CONNECTION=1` escape, and an in-process call to the checker above. No row added to `data/doctor-modules.json` (confirmed by grep, per the plan's own "open question ruled" must_have).
- `tests/test-355-doctor-point.cjs` (27/27 assertions): source hygiene (no `brain-client`, no vendor key, no `fetch(` on a non-comment line); the exit 0/77/1 replay legs, each with an injected `spawnImpl` against the REAL repo (so the missing `calibrate-citation-check.cjs` and the missing rule table degrade for free, no fixture needed); matching and mismatching rule-table provenance via lightweight tmp-copy scratch roots; the real `doctor --acceptance --pre-tag --json` point spawned end to end under `DOCTOR_TEST_MODE=1` with `DOCTOR_TEST_ONLY_POINTS=cross-connection-honesty` (a hermetic HOME, 300000ms timeout) proving `DOCTOR_TEST_FAIL_POINT=cross-connection-honesty` reports `ok: false` and `DOCTOR_SKIP_CROSS_CONNECTION=1` reports `ok: true` with `detail.skipped === true`.
- `node scripts/doctor.cjs --acceptance` (full, unfiltered): 21/22 points pass; the sole failure is `verify-release-clean-tree`, the same pre-existing environment-driven gap `355-BASELINE.md` documents (a genuinely dirty shared tree mid-development). `cross-connection-honesty` itself PASSES. No new regression against the `BASE_355` baseline.
- `node tests/test-doctor-acceptance-self-coverage.cjs` (6/6), `node tests/test-doctor-acceptance.cjs` (6/6), `node tests/test-doctor-acceptance-preflight-checks.cjs` (8/8) all green -- the new point introduces no regression in any doctor-acceptance-family test.

## Task Commits

Each task was committed atomically (normal `git commit`, sequential executor on the shared main tree, hooks NOT skipped):

1. **Task 1: Part 8 egress sweep, CIRS wiring test, posture-grid entry (D-17, AC8)** - `9dbcf2796` (test)
2. **Task 2: The cross-connection-honesty doctor blocker (HIPS-10)** - `9e5b0a27f` (feat)

**Plan metadata:**
- `e839cf4be` (docs: ROADMAP checkbox + Plans counter 22/28 -> 23/28, staged via `git apply --cached` against a hand-built patch to avoid sweeping a peer session's concurrent unrelated blank-line hunk near Phase 267, exactly as the 355-10..23 precedent)

## Files Created/Modified

- `tests/test-355-part8-egress.cjs` - the six-leg Part 8 egress sweep (HIPS-04, HIPS-08, HIPS-09)
- `tests/test-355-cirs-wiring.cjs` - the D-17 CIRS wiring proof
- `.planning/todos/pending/2026-09-08-autonomous-safe-posture-reversibility-audit.md` - the folded posture-grid data point
- `scripts/check-cross-connection-honesty.cjs` - the doctor blocker's pure checker (HIPS-10)
- `scripts/doctor.cjs` - one appended acceptance point (`cross-connection-honesty`)
- `tests/test-355-doctor-point.cjs` - 27 assertions proving the checker's and the doctor point's pass/degrade/fail paths
- `.planning/ROADMAP.md` - 355-21 row checked, Plans counter 22/28 -> 23/28

## Decisions Made

See `key-decisions` in frontmatter: the real-email planted sentence (genuine `content_set` block, not merely `ambiguous`), the fail-closed `verdict !== 'allow'` wrapper semantics, the fixed-relative-path require for `verification-stamp.cjs` inside the checker (enabling lightweight tmp-copy provenance legs), the existence-guarded `calibrate-citation-check.cjs` replay leg, and the deliberate no-row decision for `data/doctor-modules.json`.

## Deviations from Plan

### Auto-fixed Issues

None - both `type="auto" tdd="true"` tasks were followed per their action text; no Rule 1/2/3 auto-fixes were needed against already-shipped production code.

### Scope-boundary items (documented, not auto-fixed)

**1. [Scope Boundary] `git commit --only -- <paths>` requires already-tracked pathspecs; new files must be `git add`ed first**

- **Found during:** Committing Task 1
- **Issue:** `git commit -m "..." --only -- <new-file-1> <new-file-2>` errored with `did not match any file(s) known to git` for two brand-new, untracked test files (the same ordering/tracking issue 355-11/355-16 logged in substance).
- **Why not a deviation from tested contract:** Not a code bug -- `git commit --only` operates on pathspecs that must already exist in the index or working tree as tracked/stageable paths; a bare `--only` cannot introduce a wholly new path into the commit by itself. Resolved by `git add`ing the two new files first, then re-running the identical `--only -- <paths>` commit, which succeeded and staged/committed exactly the three intended files (two new, one modified) with nothing else swept in.
- **Files modified:** none beyond the plan's own three (the fix was procedural, not a file change)
- **Verification:** `git show --stat HEAD` on the resulting commit shows exactly `tests/test-355-part8-egress.cjs`, `tests/test-355-cirs-wiring.cjs` (both `create mode`), and `.planning/todos/pending/2026-09-08-autonomous-safe-posture-reversibility-audit.md` (modified) -- nothing else
- **Committed in:** `9dbcf2796` (Task 1 commit itself)

---

**Total deviations:** 0 auto-fixed against tested code; 1 documented procedural note (git tooling ordering, no functional impact).
**Impact on plan:** None on any stated acceptance criterion -- both tasks' automated verify commands and acceptance_criteria greps pass exactly as specified; `node tests/test-355-part8-egress.cjs` (22/22), `node tests/test-355-cirs-wiring.cjs` (16/16), `node tests/test-355-doctor-point.cjs` (27/27) all green; the scratch negative controls confirm both sweeps actually catch a planted violation, not vacuously pass.

## Issues Encountered

- `.planning/ROADMAP.md` on disk carried the same peer-session concurrent unrelated hunk flagged in the shared-tree briefing (a blank-line removal near Phase 267). Resolved via the established 355-10..23 precedent: built a patch from `git show HEAD:.planning/ROADMAP.md` plus this plan's own two edits applied to that clean copy, applied it to the index only with `git apply --cached`, confirmed via `git diff --cached` that exactly the two intended hunks were staged, committed the index directly (no `--only`, no `-a`), then hand-applied the identical two edits to the on-disk working-tree file via `Edit` so it matches the new `HEAD` for these rows while leaving the peer's hunk untouched and still unstaged (confirmed via `diff <(git show HEAD:.planning/ROADMAP.md) .planning/ROADMAP.md` showing only the peer's blank-line hunk remaining).
- `scripts/doctor.cjs` (one of the six D-57 shared files, also touched by peer Phase 358 sessions today per the shared-tree briefing) was re-read from disk immediately before editing and confirmed clean (zero uncommitted diff) both before and after this plan's own edit; the resulting diff is exactly and only the one appended acceptance-point object (confirmed via `git diff scripts/doctor.cjs` before committing).
- `node tests/test-doctor-acceptance-self-coverage.cjs`, `node tests/test-doctor-acceptance.cjs`, and `node tests/test-doctor-acceptance-preflight-checks.cjs` each take on the order of a minute or more to run (they spawn real `node scripts/doctor.cjs --acceptance` child processes against hermetic scratch HOMEs); each was run to completion and confirmed fully green rather than assumed from a partial run.

## User Setup Required

None - no external service configuration required. No vendor key is used or required by any file this plan created; every test drives an offline `deps.callTool`/`spawnImpl` double or `installNetGuard()`.

## Next Phase Readiness

- All four of this plan's standing gates (HIPS-04, HIPS-08, HIPS-09, HIPS-10) are now machine-checked: the egress surface, the posture, and the release gate for Phase 355 are all enforced by code, not by convention -- this is the render-and-egress gate 355-27 (close-out) can point to as satisfied alongside 355-23's own render gate.
- `scripts/check-cross-connection-honesty.cjs`'s rule-table provenance leg is ready for 355-28's conditional data (`data/hsi-thinking-mode-rules.json`) the moment a future re-measure clears the D-45 adoption bar and that file is written -- today it correctly degrades to `not_run` since 355-15's `not_adopted` ruling means 355-28 skipped writing it.
- `scripts/check-cross-connection-honesty.cjs`'s `calibrate-citation-check.cjs` replay leg is ready for 355-26 the moment that script lands -- today it correctly degrades to `not_run` since the script does not exist on this checkout.
- STATE.md and REQUIREMENTS.md intentionally NOT touched this run, per the shared-tree briefing and the 355-06..23 precedent recorded in every prior plan's own SUMMARY.md. `.planning/ROADMAP.md`'s phase-355 checklist row (355-21 checked, Plans counter 23/28) is the durable progress record instead.
- Blocker/concern carried forward: none blocking any other 355 plan. HIPS-04/HIPS-08/HIPS-09/HIPS-10 remain unregistered in `.planning/REQUIREMENTS.md` by design (355-27 registers and closes the whole HIPS family at phase close-out, per the 355-06 precedent already recorded there); this plan's `requirements-completed` frontmatter records them for that eventual registration pass.

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 4 created files verified present on disk (`tests/test-355-part8-egress.cjs`,
`tests/test-355-cirs-wiring.cjs`, `scripts/check-cross-connection-honesty.cjs`,
`tests/test-355-doctor-point.cjs`); all 3 commits (`9dbcf2796`, `9e5b0a27f`,
`e839cf4be`) verified present in `git log`.
