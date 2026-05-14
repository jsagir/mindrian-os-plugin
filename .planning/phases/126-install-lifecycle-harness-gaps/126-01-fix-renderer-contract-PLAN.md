---
phase: 126
slug: install-lifecycle-harness-gaps
plan: 01
title: --fix Renderer Contract Test + Fix
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/doctor.cjs
  - tests/test-doctor-fix-renderer.cjs
  - tests/run-all-126.sh
autonomous: true
requirements_addressed: []
canon_parts:
  - Part 6 (dog-fooding: renderer drift surfaced by real Windows dogfood, not synthetic tests)
  - Part 7 (reuse: extends scripts/doctor.cjs without forking)
beta_target: v1.13.0-beta.15
hotfix_discipline: true
gap_closure: false
must_haves:
  truths:
    - "doctor --fix output emits BOTH '✓ recovered to <version>' AND 'backup <path>' lines when recovery succeeds (per commands/doctor.md Step 3 contract)"
    - "doctor --fix summary line is consistent with the header (no '1 drift / 0 warnings' while header says 'recovered')"
    - "The renderer contract is tested against a SCAFFOLDED missing-install fixture state, not only against happy-path live install"
    - "commands/doctor.md Step 3 is the SINGLE source-of-truth for the renderer contract -- loaded as fixture input, not duplicated in test code"
  artifacts:
    - path: "tests/test-doctor-fix-renderer.cjs"
      provides: "Renderer-contract fixture asserting both required lines + summary semantics"
      min_lines: 80
    - path: "scripts/doctor.cjs"
      provides: "Renderer that emits BOTH '✓ recovered to <version>' AND 'backup <path>' lines on successful recovery"
      contains: "✓ recovered to"
  key_links:
    - from: "tests/test-doctor-fix-renderer.cjs"
      to: "commands/doctor.md Step 3"
      via: "fs.readFileSync of commands/doctor.md + regex extraction of the Step 3 contract block"
      pattern: "commands/doctor\\.md"
    - from: "scripts/doctor.cjs (renderer)"
      to: "performRecoveryAtomic return value"
      via: "if status==='ok' && recoveredVersion && backup, emit both lines"
      pattern: "✓ recovered to.*backup"
---

<objective>
Close the dogfood finding (3a): `/mos:doctor --fix` printed `-- doctor -- recovered --` header but OMITTED the `✓ recovered to <version>` line AND the `backup <path>` line documented in `commands/doctor.md` Step 3. The summary also said `1 drift / 0 warnings` -- semantically inconsistent with the "recovered" header.

Purpose: the renderer is the user's evidence that recovery worked. Drift between the renderer and its contract = silent breakage of user trust. A test fixture against the CONTRACT (not the live renderer) ensures the contract stays the source of truth.

Output: a fixture-backed renderer contract that scaffolds a missing-install state, runs `doctor --fix`, and asserts both required lines + summary consistency. The fixture loads `commands/doctor.md` Step 3 as the contract source -- the test does not duplicate the contract text.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/126-install-lifecycle-harness-gaps/126-CONTEXT.md
@.planning/phases/126-install-lifecycle-harness-gaps/126-FEEDBACK-2026-05-13-windows-dogfood.md
@.planning/phases/126-install-lifecycle-harness-gaps/126-STEP-0-MANUAL-RECOVERY.md
@commands/doctor.md
@scripts/doctor.cjs
@tests/test-doctor-class-i.cjs
@tests/test-doctor-acceptance.cjs

<interfaces>
<!-- Key contracts the executor needs. Extracted from scripts/doctor.cjs + commands/doctor.md -->

From commands/doctor.md Step 3 (the renderer contract, lines 64-66 + example lines 135-138):
```
The script outputs a 4-zone Shape E (Action Report) per skills/ui-system/SKILL.md.
Display the script's stdout directly. Do not re-format. Do not strip ANSI color codes.

Example output (recovered):
     ✓ recovered to 1.11.0
     backup /home/jsagi/.claude/plugins/mindrian-os.stale-1.10.10-20260428-095548

  Summary: 0 healthy / 0 drift / 0 warnings
```

From scripts/doctor.cjs performRecoveryAtomic (lines 286-371):
```javascript
// Returns one of:
//   { status: 'ok', backup: <path|null>, recoveredVersion: <version> }
//   { status: 'error', detail: <string>, stage: <string>, exitCode?: number }
```

The renderer currently lives in the main entry path (run/main function around line ~2400-2900). It receives the performRecoveryAtomic result and must emit:
1. Header line: `✓ recovered to <recoveredVersion>` (when status === 'ok')
2. Backup line: `backup <backup-path>` (when backup !== null)
3. Summary line consistent with recovery: `0 healthy / 0 drift / 0 warnings` (NOT `1 drift / 0 warnings`)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create renderer-contract fixture test</name>
  <files>tests/test-doctor-fix-renderer.cjs</files>
  <read_first>
    - commands/doctor.md (the renderer contract -- specifically Step 3 + the "Example output (recovered)" block lines 130-145)
    - scripts/doctor.cjs (current renderer behavior -- specifically performRecoveryAtomic + the main/run path that prints the recovery output)
    - tests/test-doctor-class-i.cjs (existing fixture pattern: env-var injection, mktemp HOME, spawnSync doctor.cjs)
    - tests/test-doctor-acceptance.cjs (existing assertion style)
    - tests/test-install-state-record.cjs (existing pattern for scaffolding missing-install state)
  </read_first>
  <behavior>
    - Test 1: Loads commands/doctor.md, extracts the "Example output (recovered)" block via regex, parses out the two required line patterns (`✓ recovered to .+` and `backup .+`). FAILS LOUD if the regex cannot find both lines in the contract source (catches future drift in the contract itself).
    - Test 2: Scaffolds a missing-install state in a mktemp HOME: creates ~/.claude/plugins/cache/mindrian-marketplace/mos/1.13.0-beta.99/ with a valid plugin.json AND a fresh marketplace.json mirror; does NOT create ~/.claude/plugins/mindrian-os/ (the missing-install condition).
    - Test 3: Spawns `node scripts/doctor.cjs --fix` against the scaffolded HOME. Asserts exit code 2 (drift detected and recovered per docs/doctor.md "Exit codes" line 174).
    - Test 4: Greps stdout for `✓ recovered to 1.13.0-beta.99` -- MUST match.
    - Test 5: Greps stdout for `backup ` followed by an absolute path containing `mindrian-os.stale-` + a timestamp -- MUST match.
    - Test 6: Greps stdout for a Summary line. Asserts the Summary line does NOT include `1 drift` (semantic consistency with the "recovered" header). Asserts the Summary line includes `0 drift` OR explicitly classifies the recovery as a healthy/recovered count (the test accepts either `0 healthy / 0 drift / 0 warnings` per the contract example OR an alternative passing renderer that surfaces "1 recovered" -- but NEVER `1 drift / 0 warnings`).
    - Test 7: Re-runs `doctor --fix` against the now-recovered state. Asserts exit 0 + no `recovered to` line emitted (idempotency).
  </behavior>
  <action>
    Create `tests/test-doctor-fix-renderer.cjs`. Use the pattern from `tests/test-doctor-class-i.cjs` for scaffolding a mktemp HOME with a fake `~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/` tree (copy the `mktempHome` + `seedCache` helpers; do NOT duplicate -- factor into `tests/lib/doctor-fixtures.cjs` if not already there; if a helper module already exists, require it). Wire the test into `tests/run-all-126.sh` as a CJS suite.

    Critical implementation details:
    1. Contract-extraction regex (Test 1): `/^## Step 3:.*?^## /ms` to grab the section, then `/✓ recovered to (.+)/m` + `/backup (\S+)/m` for the two line patterns. Fail with explicit message naming the missing pattern.
    2. mktemp HOME setup: `fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-render-'))` then `process.env.HOME = tmpHome` (capture original; restore in finally). Create `~/.claude/plugins/cache/mindrian-marketplace/mos/1.13.0-beta.99/.claude-plugin/plugin.json` with `{ "version": "1.13.0-beta.99", "name": "mindrian-os" }`. Do NOT create `~/.claude/plugins/mindrian-os/` (the missing-install).
    3. spawnSync invocation: `spawnSync('node', [path.join(__dirname, '..', 'scripts/doctor.cjs'), '--fix'], { env: { ...process.env, HOME: tmpHome }, encoding: 'utf8', timeout: 30000 })`.
    4. Stdout matching: strip ANSI escape codes via `r.stdout.replace(/\[[0-9;]*m/g, '')` before grep (otherwise color codes break the regex).
    5. Cleanup: `fs.rmSync(tmpHome, { recursive: true, force: true })` in finally; restore process.env.HOME.

    Settled in plan-phase: Open Question 1 (Wave 1 parallelism) -- this plan touches only `scripts/doctor.cjs` renderer + tests/test-doctor-fix-renderer.cjs; Plan 02 touches the same `scripts/doctor.cjs` parseVersion/cmpVersion helpers + a DIFFERENT test file; Plan 06 touches `lib/core/cache-prune.cjs` + a DIFFERENT test file. Same-file overlap (scripts/doctor.cjs) is real but in DIFFERENT functions; safe for parallel work IF executor confirms the renderer + the cache-pick helpers do not touch the same lines. If line conflict surfaces during execution, serialize Plan 01 before Plan 02 (Plan 06 stays parallel since it touches a separate file).
  </action>
  <verify>
    <automated>node tests/test-doctor-fix-renderer.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-doctor-fix-renderer.cjs` exits 0
    - All 7 sub-tests pass
    - Test 1 succeeds in extracting the contract from commands/doctor.md (proves the test is not duplicating the contract)
    - Tests 4 + 5 fail with the CURRENT renderer (proving the test would have caught the dogfood finding)
    - Test 6 explicitly rejects `1 drift / 0 warnings` summary
    - File compiles cleanly: `node -c tests/test-doctor-fix-renderer.cjs`
  </acceptance_criteria>
  <done>
    Test file exists, runs to completion, captures the dogfood finding behavior against the CURRENT (broken) renderer (the test fails RED until Task 2 lands). Wire registered in tests/run-all-126.sh as a CJS suite entry.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix the renderer in scripts/doctor.cjs</name>
  <files>scripts/doctor.cjs</files>
  <read_first>
    - tests/test-doctor-fix-renderer.cjs (the contract the fix must satisfy -- written in Task 1)
    - scripts/doctor.cjs (current renderer behavior -- specifically the main/run function path that handles `--fix` mode after performRecoveryAtomic returns; also performRecoveryAtomic itself at lines 286-371)
    - commands/doctor.md Step 3 + Example output block
  </read_first>
  <behavior>
    - Test (from Task 1) must turn GREEN: doctor --fix output includes BOTH `✓ recovered to <version>` AND `backup <path>` lines AND summary line excludes `1 drift / 0 warnings`.
    - No regression in existing tests: tests/run-all-123.sh must still pass.
    - No regression in --fix happy path: a healthy install + --fix run still exits 0 with no "recovered" output.
    - --fix on missing-install where recovery FAILS (e.g., MOS_TEST_FORCE_FAIL=verify): still emits a coherent error message; no spurious "recovered" line.
  </behavior>
  <action>
    Locate the renderer code path in scripts/doctor.cjs that handles `--fix` mode AFTER performRecoveryAtomic returns. The current path (per the dogfood finding) emits the header but omits the two contract lines.

    Implementation:
    1. After performRecoveryAtomic returns `{ status: 'ok', backup: <path>, recoveredVersion: <version> }`, emit:
       ```
       ✓ recovered to <recoveredVersion>
       backup <backup>
       ```
       (Lines indented to match the existing 4-zone Shape E layout per skills/ui-system/SKILL.md; preserve the existing GREEN ANSI color on the checkmark.)
    2. Fix the Summary line to be semantically consistent. After successful recovery, the drift was RESOLVED -- the summary must NOT report `1 drift`. Options (pick whichever fits the existing renderer architecture without restructuring):
       - Option A: After recovery, decrement the drift count BEFORE the Summary line is rendered (the drift was the missing install; recovery closed it).
       - Option B: Add a "recovered" count alongside drift/warnings: `Summary: 0 healthy / 0 drift / 0 warnings / 1 recovered` (extension; Test 6 must accept this shape).
       Prefer Option A for minimum surface delta (Canon Part 7 reuse-before-build).
    3. If the backup is null (performRecoveryAtomic returned no backup -- e.g., install dir didn't exist beforehand, so nothing to back up), omit the `backup <path>` line. The contract specifies the line is emitted WHEN a backup exists, not unconditionally. Update Task 1 Test 5 if needed (it already asserts the line for the scaffolded missing-install case which produces a `backup-tag=missing` directory per doctor.cjs line 294).

    Settled in plan-phase: Open Question 1 (parallelism) -- Task 2 modifies scripts/doctor.cjs renderer code. Plan 02 modifies scripts/doctor.cjs cmpVersion/parseVersion helpers (lines 181-205). The two regions are non-overlapping; safe to merge in either order. If git-merge conflict arises, Task 1 (the test) and Plan 02 task 1 are independent -- merge Plan 01 first since it is upstream of acceptance-gate verification.

    Preserve workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.
  </action>
  <verify>
    <automated>node tests/test-doctor-fix-renderer.cjs && bash tests/run-all-123.sh</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-doctor-fix-renderer.cjs` exits 0 (all 7 sub-tests GREEN)
    - `bash tests/run-all-123.sh` continues to pass (no regression in existing harness tests)
    - Live `node scripts/doctor.cjs --fix` against a synthesized missing-install state emits BOTH `✓ recovered to <version>` AND `backup <path>` lines
    - Live Summary line does NOT print `1 drift / 0 warnings` after successful recovery
    - The renderer fix is a minimal-surface delta (Canon Part 7); no new functions, no new modules
  </acceptance_criteria>
  <done>
    Renderer emits both required lines + semantically-consistent Summary. Tests are GREEN. No regression in Phase 123 test suite.
  </done>
</task>

</tasks>

<verification>
- `node tests/test-doctor-fix-renderer.cjs` exits 0
- `bash tests/run-all-123.sh` passes (no regression)
- `bash tests/run-all-126.sh` includes this test suite and passes
- Manual smoke test on a synthesized missing-install state confirms both lines emit + summary is consistent
- `commands/doctor.md` Step 3 contract is unchanged (the test is the contract enforcer, not the contract author)
</verification>

<success_criteria>
- All must_haves satisfied (truths, artifacts, key_links)
- Plan 01 acceptance criteria from CONTEXT.md "Acceptance Criteria (Nyquist UAT)" block all pass:
  - tests/test-doctor-fix-renderer.cjs passes
  - Live run of doctor --fix emits BOTH required lines
  - Summary line consistent with header semantics
  - commands/doctor.md Step 3 contract is loaded as fixture input (not duplicated)
- No regression in Phase 123 / 95.2 / 95.1 / 93 test runners
</success_criteria>

<output>
After completion, create `.planning/phases/126-install-lifecycle-harness-gaps/126-01-SUMMARY.md` covering:
- The renderer contract drift discovered + closed
- The fixture pattern established (contract-as-source vs. duplicated-in-test)
- Any future-drift signals to watch (e.g., if commands/doctor.md Step 3 ever evolves, the test's regex extraction will need updating)
- Reference forward to Plan 03 (acceptance-gate self-coverage) which will incorporate this fixture into the broader scaffolded-broken-state aggregator
</output>
