---
phase: 126
slug: install-lifecycle-harness-gaps
plan: 03
title: Acceptance-Gate Self-Coverage (Scaffolded Broken-State Fixtures)
type: execute
wave: 2
depends_on:
  - 126-07-install-state-schema-v2-migration-PLAN
files_modified:
  - tests/test-doctor-acceptance-self-coverage.cjs
  - scripts/doctor.cjs
  - scripts/release.sh
  - tests/run-all-126.sh
autonomous: true
requirements_addressed: []
canon_parts:
  - Part 6 (dog-fooding: the gate must test ITSELF against scaffolded broken state, not just happy-path live install)
  - Part 7 (reuse: extends scripts/doctor.cjs --acceptance + scripts/release.sh Step 6.6 without forking)
beta_target: v1.13.0-beta.15
hotfix_discipline: true
gap_closure: false
must_haves:
  truths:
    - "The acceptance gate self-tests against 5 scaffolded broken-state fixtures BEFORE asserting pass-against-live-install"
    - "Each fixture scaffolds a specific broken state and asserts doctor --acceptance --json reports the EXPECTED pass/fail breakdown"
    - "Self-coverage runs as part of scripts/release.sh Step 6.6 (the acceptance gate during release)"
    - "Live doctor --acceptance --json continues to pass against the current dev workspace (no regression)"
    - "Each fixture exercises ONE distinct failure surface: install-dir-missing, install-state-v1-pre-migration, marketplace-cache-with-stale-topology, renderer-drift-state, deployment-surfaces-drift"
  artifacts:
    - path: "tests/test-doctor-acceptance-self-coverage.cjs"
      provides: "Aggregator running 5 scaffolded fixtures + asserting per-fixture pass/fail breakdown"
      min_lines: 200
    - path: "scripts/doctor.cjs"
      provides: "Optional extension to acceptance to write last_acceptance_run timestamp into install-state.json (depends on Plan 07's v2 schema)"
    - path: "scripts/release.sh"
      provides: "Step 6.6 invokes the new self-coverage aggregator AFTER --acceptance --pre-tag passes"
      contains: "test-doctor-acceptance-self-coverage"
  key_links:
    - from: "tests/test-doctor-acceptance-self-coverage.cjs"
      to: "scripts/doctor.cjs --acceptance --json"
      via: "spawnSync per-fixture; assert the JSON checklist[].ok breakdown"
      pattern: "--acceptance.*--json"
    - from: "scripts/release.sh Step 6.6"
      to: "tests/test-doctor-acceptance-self-coverage.cjs"
      via: "post --pre-tag invocation; FAIL aborts release"
      pattern: "test-doctor-acceptance-self-coverage"
    - from: "scripts/doctor.cjs --acceptance handler"
      to: "lib/core/install-state.cjs writeInstallState (last_acceptance_run field)"
      via: "after the 7-point checklist completes, write timestamp + passed/failed counts to install-state.json"
      pattern: "last_acceptance_run"
---

<objective>
Phase 123 shipped `doctor --acceptance` as a 7-point release gate. The gate verifies the LIVE install topology + repo state + npm publish state. But it does NOT verify ITSELF against scaffolded broken-state fixtures -- which is precisely how the 2026-05-13 Windows dogfood findings slipped through (the gate happily reported "all-pass" against happy-path live state while the renderer was silently broken).

Purpose: the acceptance gate is the release-flight checkpoint. It must self-test against KNOWN broken states + assert the expected pass/fail breakdown for each. If a fixture for "install-dir-missing" doesn't produce "install-state: FAIL" in --acceptance --json output, then the gate has a hole and is no longer trustworthy. Plan 03 closes those holes.

Output: a 5-fixture aggregator that scaffolds each broken state + runs doctor --acceptance --json + asserts the per-point breakdown. Wired into release.sh Step 6.6 (after the existing --pre-tag check). Optionally extends scripts/doctor.cjs to write last_acceptance_run into install-state.json v2.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/126-install-lifecycle-harness-gaps/126-CONTEXT.md
@.planning/phases/126-install-lifecycle-harness-gaps/126-FEEDBACK-2026-05-13-windows-dogfood.md
@.planning/phases/126-install-lifecycle-harness-gaps/126-01-fix-renderer-contract-PLAN.md
@.planning/phases/126-install-lifecycle-harness-gaps/126-07-install-state-schema-v2-migration-PLAN.md
@scripts/doctor.cjs
@scripts/release.sh
@scripts/verify-release
@tests/test-doctor-acceptance.cjs
@lib/core/install-state.cjs

<interfaces>
<!-- Key contracts from scripts/doctor.cjs lines 2141-2300+ (buildAcceptanceChecklist) -->

Acceptance checklist (Phase 123, 7 points):
1. `install-state`         -- install-state record present + snapshot matches a live spot-check
2. `deployment-surfaces`   -- every owned deployment surface reconciled
3. `version-of-record-repo` -- plugin.json / package.json / CHANGELOG top entry consistent
4. `verify-release`        -- scripts/verify-release passes
5. `version-of-record-published` -- git tag + marketplace ref + npm view (full-only)
6. `npx-roundtrip`         -- npx round-trip resolves cleanly (full-only)
7. `doctor-all`            -- doctor --all exits 0 (the meta-check)

Each point has `applies_to: ['pre-tag', 'full']` or `['full']`.
Each point's run() returns `{ ok, finding, detail }`.

--json output shape (verified from doctor.cjs):
```json
{
  "acceptance": {
    "checklist": [
      { "id": "install-state", "ok": true|false, "finding": null|"...", "detail": {...} },
      ...
    ],
    "passed": <int>,
    "failed": <int>
  }
}
```

Test-mode env hooks (from doctor.cjs lines 2135-2145):
- `DOCTOR_TEST_MODE=1`             -- enables test-mode injections
- `DOCTOR_TEST_FAIL_POINT=<id>`    -- synthesize a failure of the named point
- `DOCTOR_TEST_STUB_POST_PUBLISH=1` -- post-publish points throw if invoked (asserts --pre-tag filter works)
- `DOCTOR_VERIFY_RELEASE_PATH=<path>` -- override scripts/verify-release path
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create 5-fixture acceptance-gate self-coverage aggregator</name>
  <files>tests/test-doctor-acceptance-self-coverage.cjs</files>
  <read_first>
    - scripts/doctor.cjs lines 2118-2300+ (buildAcceptanceChecklist + the 7 points + their test-mode injection hooks)
    - tests/test-doctor-acceptance.cjs (existing acceptance fixture pattern -- DOCTOR_TEST_MODE + DOCTOR_TEST_FAIL_POINT usage)
    - tests/test-doctor-class-i.cjs (mktemp HOME + scaffold install-state pattern)
    - tests/test-install-state-record.cjs (install-state.json fixture pattern -- particularly v1-shaped fixture writes)
    - lib/core/install-state.cjs (Plan 07's module -- exports SCHEMA_VERSION + writeInstallState; the v2 schema this fixture aggregator must respect)
    - 126-01 plan (renderer drift simulation: the renderer-drift fixture (d) simulates by mocking the renderer to omit lines)
  </read_first>
  <behavior>
    - Test 1 (Fixture a -- install-dir-missing): scaffold mktemp HOME with marketplace-cache present (1.13.0-beta.99) BUT no $HOME/.claude/plugins/mindrian-os/. Invoke doctor --acceptance --json. Assert:
      - checklist[id=install-state].ok === false
      - checklist[id=install-state].finding contains 'absent' or 'missing'
      - other applicable points have ok === true OR fail with a related finding (deployment-surfaces may also fail downstream of missing install)
    - Test 2 (Fixture b -- install-state-v1-pre-migration): scaffold HOME with a v1-shaped install-state.json (NO schema_version field) + valid marketplace cache + valid mindrian-os/ dir. Invoke doctor --acceptance --json. Assert:
      - checklist[id=install-state].ok === true (Plan 07 migration runs transparently)
      - Post-invocation: re-read install-state.json from disk; assert schema_version === 2 (verifies migration fired during the acceptance run)
    - Test 3 (Fixture c -- marketplace-cache with stale topology): scaffold HOME with marketplace-cache containing beta.9 AND beta.13 (the dogfood condition); install dir at beta.9 (stale relative to cache). Invoke doctor --acceptance --json. Assert:
      - checklist[id=install-state].ok === false (topology drifted; install version != latest cache version)
      - checklist[id=install-state].finding mentions 'stale' or 'drift' or 'beta.9'
    - Test 4 (Fixture d -- renderer-drift state, SIMULATED): set env DOCTOR_TEST_FAIL_POINT=install-state. Invoke doctor --acceptance --json. Assert:
      - checklist[id=install-state].ok === false
      - checklist[id=install-state].finding === 'install-state synthesized failure (test mode)' (verifies the test-mode injection AND that the aggregator catches it)
    - Test 5 (Fixture e -- drift between deployed surfaces and manifest): scaffold a HOME where one deployment surface from data/deployment-surfaces.json is intentionally missing (e.g., delete $HOME/.claude/statusline-mos). Invoke doctor --acceptance --json. Assert:
      - checklist[id=deployment-surfaces].ok === false
      - checklist[id=deployment-surfaces].finding mentions 'surface(s) drifted' (matches the live shape from doctor.cjs line 2197)
    - Test 6 (no regression -- live workspace): invoke doctor --acceptance --json AGAINST the dev workspace (no mktemp HOME; current real state). Assert exit 0 + all applicable points pass OR fail with a known-acceptable finding. This is the "self-coverage doesn't introduce a regression" guard.
  </behavior>
  <action>
    Create `tests/test-doctor-acceptance-self-coverage.cjs`. Pattern: aggregator with 6 sub-tests. Each sub-test scaffolds + invokes + asserts.

    Helper structure:
    ```javascript
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { spawnSync } = require('child_process');
    const { writeInstallState } = require('../lib/core/install-state.cjs');

    function mktempHome() {
      return fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-self-cov-'));
    }

    function seedMarketplaceCache(home, versions) {
      // Create ~/.claude/plugins/cache/mindrian-marketplace/mos/<v>/.claude-plugin/plugin.json for each
      // Also create the marketplace registry file ~/.claude/plugins/cache/mindrian-marketplace/.claude-plugin/marketplace.json
    }

    function seedInstall(home, version) {
      // Create ~/.claude/plugins/mindrian-os/.claude-plugin/plugin.json with the given version
    }

    function seedInstalledPluginsJson(home, version) {
      // Create ~/.claude/installed_plugins.json keyed to mos@mindrian-marketplace@version
    }

    function runDoctorAcceptance(home, extraEnv) {
      const env = Object.assign({}, process.env, { HOME: home }, extraEnv || {});
      const r = spawnSync('node', [
        path.join(__dirname, '..', 'scripts', 'doctor.cjs'),
        '--acceptance', '--json', '--pre-tag',
      ], { env, encoding: 'utf8', timeout: 60000 });
      // doctor.cjs exits 1 on any failure; exit 0 on all-pass. Both produce parseable JSON.
      return { exitCode: r.status, json: tryParseJson(r.stdout), stderr: r.stderr };
    }

    function findChecklistEntry(result, id) {
      const cl = result.json && result.json.acceptance && result.json.acceptance.checklist;
      if (!Array.isArray(cl)) return null;
      return cl.find(function (x) { return x.id === id; });
    }
    ```

    Each sub-test follows the pattern:
    ```javascript
    function testFixtureA_installDirMissing() {
      const home = mktempHome();
      try {
        seedMarketplaceCache(home, ['1.13.0-beta.99']);
        seedInstalledPluginsJson(home, '1.13.0-beta.99');
        // INTENTIONALLY do NOT seedInstall -- this IS the missing-install state.
        const result = runDoctorAcceptance(home);
        const entry = findChecklistEntry(result, 'install-state');
        assert(entry, 'install-state checklist entry not found');
        assert.strictEqual(entry.ok, false, 'expected install-state.ok=false');
        assert.match(entry.finding, /absent|missing/, 'expected absent/missing in finding');
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    }
    ```

    For Test 4 (renderer-drift, SIMULATED): use DOCTOR_TEST_MODE=1 + DOCTOR_TEST_FAIL_POINT=install-state (the existing test-mode hook at scripts/doctor.cjs line 2153). This proves the AGGREGATOR catches synthetic failures -- a cheap proxy for actual renderer-drift detection.

    Test 6 (no regression -- live workspace): do NOT mktemp; just run doctor against the real workspace and assert exit 0 + 'doctor-all' point passes. This is the regression guard.

    Wire into tests/run-all-126.sh as a CJS suite entry.

    Settled in plan-phase: Wave 2 ordering -- this plan depends on Plan 07 (lib/core/install-state.cjs must exist for Test 2's post-migration assertion + for writeInstallState helper). Wave 2 order: 07 → 03 → 05.

    Settled in plan-phase: Open Question 1 (parallelism within Wave 2) -- 07 → 03 → 05 is STRICTLY SEQUENTIAL per CONTEXT.md sequencing block ("Wave 2 Sequential (build on Wave 1 + each other)"). Do NOT attempt to parallelize within Wave 2.
  </action>
  <verify>
    <automated>node tests/test-doctor-acceptance-self-coverage.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-doctor-acceptance-self-coverage.cjs` runs to completion + exits 0
    - All 6 sub-tests pass against the CURRENT acceptance gate (no doctor.cjs change required for the test to pass; the existing acceptance gate ALREADY handles the 5 scaffolded states correctly -- this plan PROVES that via fixture coverage)
    - File compiles cleanly: `node -c tests/test-doctor-acceptance-self-coverage.cjs`
    - Wired in tests/run-all-126.sh
    - If a sub-test FAILS RED: that's a real gate hole; surface to the planner before the executor lands the test as GREEN
  </acceptance_criteria>
  <done>
    5-fixture aggregator + no-regression Test 6 exists. All 6 GREEN against the existing acceptance gate. Any RED case is escalated as a real gate hole.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend scripts/doctor.cjs --acceptance to write last_acceptance_run into install-state v2</name>
  <files>scripts/doctor.cjs</files>
  <read_first>
    - lib/core/install-state.cjs (Plan 07's writeInstallState + readInstallState exports)
    - scripts/doctor.cjs lines 2118-2400 (buildAcceptanceChecklist + the renderer that prints summary after the checklist)
    - CONTEXT.md Plan 07 (v2 schema includes last_acceptance_run: { timestamp, passed, failed })
  </read_first>
  <behavior>
    - After --acceptance (full or --pre-tag) completes its checklist runs, doctor writes `last_acceptance_run = { timestamp: <ISO>, passed: <int>, failed: <int> }` into install-state.json.
    - Write happens BEFORE the final exit (so even on failed --acceptance the state captures the run).
    - Write is best-effort: if writeInstallState throws (e.g., install-state file absent), do NOT crash --acceptance. Emit a stderr note.
    - install-state.json must already be v2 (or the migration runs first). Plan 07 wires the migration into session-start. If --acceptance runs in a context where session-start hasn't run (e.g., during the test fixture's spawnSync), call migrateIfNeeded({ home }) FIRST inside the acceptance handler before writeInstallState.
    - No regression: Phase 123 test-doctor-acceptance.cjs continues to pass.
  </behavior>
  <action>
    Locate the --acceptance handler in scripts/doctor.cjs that runs after `buildAcceptanceChecklist` and aggregates results. After the checklist runs but before exit:

    ```javascript
    // Phase 126 Plan 03: persist last_acceptance_run into install-state v2 (additive; best-effort)
    try {
      const installStateMod = require(path.join(__dirname, '..', 'lib', 'core', 'install-state.cjs'));
      const homeForState = process.env.HOME || os.homedir();
      // Migration is idempotent: if file is v1, promote to v2; if v2, no-op; if future-version, defer.
      installStateMod.migrateIfNeeded({ home: homeForState });
      const current = installStateMod.readInstallState({ home: homeForState });
      if (current) {
        const updated = Object.assign({}, current, {
          last_acceptance_run: {
            timestamp: new Date().toISOString(),
            passed: <passed-count>,
            failed: <failed-count>,
          },
        });
        installStateMod.writeInstallState({ home: homeForState, state: updated });
      }
    } catch (err) {
      process.stderr.write('[doctor --acceptance] failed to persist last_acceptance_run: ' + err.message + '\n');
    }
    ```

    Substitute `<passed-count>` and `<failed-count>` with the actual aggregated counts from the checklist run.

    Place this block AFTER the checklist execution AND BEFORE the final process.exit / return that --acceptance uses. Mirror the existing render path's structure.

    No-op when install-state.json is absent (readInstallState returns null → skip write entirely).

    Workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.
  </action>
  <verify>
    <automated>node tests/test-doctor-acceptance-self-coverage.cjs && bash tests/run-all-123.sh</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-doctor-acceptance-self-coverage.cjs` continues to pass
    - `bash tests/run-all-123.sh` passes (tests/test-doctor-acceptance.cjs continues to pass)
    - Live test: run `doctor --acceptance --pre-tag` in dev workspace; verify install-state.json now contains `last_acceptance_run` with current timestamp + counts
    - When install-state.json is absent: --acceptance does NOT crash; emits a single stderr note + completes normally
  </acceptance_criteria>
  <done>
    --acceptance writes last_acceptance_run into install-state.json v2. Best-effort. No regression.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire self-coverage into scripts/release.sh Step 6.6</name>
  <files>scripts/release.sh</files>
  <read_first>
    - scripts/release.sh lines 339-358 (Step 6.6 -- the existing --acceptance --pre-tag invocation)
    - tests/test-doctor-acceptance-self-coverage.cjs (the aggregator from Task 1)
  </read_first>
  <action>
    Locate scripts/release.sh Step 6.6 (line 339, marked `# --- Step 6.6: doctor --acceptance --pre-tag (HARD ABORT, no --allow) ---`). AFTER the existing `--pre-tag` check passes (line 358 `${GREEN} --acceptance --pre-tag passed${NC}`), insert a new sub-step that invokes the self-coverage aggregator:

    ```bash
    # --- Step 6.6b: doctor acceptance-gate SELF-COVERAGE (Phase 126 Plan 03) ---
    # Runs scaffolded broken-state fixtures against doctor --acceptance to assert
    # the gate catches each known failure surface. Closes Canon Part 6 dog-fooding
    # gap surfaced by the 2026-05-13 Windows dogfood (the gate happily reported
    # all-pass against happy-path live state while renderer was silently broken).
    echo ""
    echo "=== Step 6.6b: doctor --acceptance self-coverage (scaffolded fixtures) ==="
    if ! node "$PLUGIN_DIR/tests/test-doctor-acceptance-self-coverage.cjs"; then
      echo -e "${RED}ABORT: doctor --acceptance self-coverage failed -- release halted BEFORE tagging.${NC}"
      echo "  The gate has a hole. A scaffolded broken state did NOT produce the expected"
      echo "  failure breakdown. Inspect test output above; fix the gate (or the test) before"
      echo "  re-running release.sh."
      echo "  Rolling back version bumps so the working tree returns to its pre-Step-3 state."
      cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json package.json CHANGELOG.md || true
      cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json || true
      exit 1
    fi
    echo -e "${GREEN}  acceptance self-coverage passed${NC}"
    ```

    Insertion point: BETWEEN existing Step 6.6 success line and Step 7 (Commit A). This keeps the gate-self-test under the same hard-abort rollback umbrella.

    Workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.

    Settled in plan-phase: HARD ABORT on self-coverage fail (same as --pre-tag); rollback identical (`git checkout` of the bumped files). No `--allow` override (Canon Part 7 release-infra-is-the-gate-you-cannot-skip per CONTEXT D-16).
  </action>
  <verify>
    <automated>bash -n scripts/release.sh && bash scripts/release.sh --dry-run | grep -F "Step 6.6b"</automated>
  </verify>
  <acceptance_criteria>
    - `bash -n scripts/release.sh` exits 0 (syntax valid)
    - `bash scripts/release.sh --dry-run` shows the new Step 6.6b in the planned sequence (extend the existing --dry-run output stanza around line 193-208 to mention 6.6b too)
    - `grep -c "Step 6.6b" scripts/release.sh` returns >= 2 (the comment + at least one echo line)
    - `grep -c "test-doctor-acceptance-self-coverage" scripts/release.sh` returns >= 1
  </acceptance_criteria>
  <done>
    Step 6.6b inserted between --pre-tag pass and Commit A. HARD ABORT on fail. Rollback identical to existing Step 6.6 rollback. Dry-run output mentions the new step.
  </done>
</task>

</tasks>

<verification>
- `node tests/test-doctor-acceptance-self-coverage.cjs` passes all 6 sub-tests
- `bash tests/run-all-123.sh` passes (no regression in existing acceptance test)
- `bash -n scripts/release.sh` exits 0
- `bash scripts/release.sh --dry-run` mentions Step 6.6b
- Live smoke: `node scripts/doctor.cjs --acceptance --pre-tag` in dev workspace exits 0; install-state.json now contains last_acceptance_run with current timestamp
- `bash tests/run-all-126.sh` includes this test suite and passes
</verification>

<success_criteria>
- All must_haves satisfied
- Plan 03 acceptance criteria from CONTEXT.md "Acceptance Criteria (Nyquist UAT)" block all pass:
  - tests/test-doctor-acceptance-self-coverage.cjs passes
  - All 5 fixture scenarios (a-e) covered
  - Wired into release.sh Step 6.6 (the acceptance gate during release)
  - Live doctor --acceptance --json continues to pass against current dev workspace
- No regression in Phase 123 acceptance suite
- last_acceptance_run is written into install-state v2 (proves Plan 07 + Plan 03 interlock works)
</success_criteria>

<output>
After completion, create `.planning/phases/126-install-lifecycle-harness-gaps/126-03-SUMMARY.md` covering:
- The 5 scaffolded broken-state fixtures + their expected failure breakdowns
- The renderer-drift simulation strategy (DOCTOR_TEST_FAIL_POINT injection vs. real-renderer mocking)
- The Step 6.6b insertion point + rollback semantics
- last_acceptance_run wire-up (Plan 07 v2 schema consumer)
- Reference forward to Plan 05 (release-flight pre-flight) which absorbs additional checks into --acceptance
</output>
