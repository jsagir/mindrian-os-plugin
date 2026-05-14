---
phase: 126
slug: install-lifecycle-harness-gaps
plan: 05
title: Release-Flight Pre-Flight Absorbed into --acceptance (5 Phase 123 Hot-Patches)
type: execute
wave: 2
depends_on:
  - 126-03-acceptance-gate-self-coverage-PLAN
files_modified:
  - scripts/doctor.cjs
  - tests/test-doctor-acceptance-preflight-checks.cjs
  - tests/run-all-126.sh
autonomous: true
requirements_addressed: []
canon_parts:
  - Part 6 (dog-fooding: the 5 hot-patches were discovered DURING Phase 123 release cut; Phase 126 makes them automated guards)
  - Part 7 (reuse: extends scripts/doctor.cjs --acceptance with additional class letters; no fork)
beta_target: v1.13.0-beta.15
hotfix_discipline: true
gap_closure: false
must_haves:
  truths:
    - "Each of the 5 hot-patches from Phase 123 cut now has a doctor class letter (extending the existing A-J roster)"
    - "doctor --acceptance --json output includes all 5 new checks under the checklist[] array"
    - "Running --acceptance against a known-broken state (e.g., stale .tmp file in tracked dir) fails the right check (not all checks; the targeted one)"
    - "The 5 new checks are: session-start active_version derivation correctness, verify-release Step 12 clean-tree, operator.md/doctor.md frontmatter YAML validity, release.sh --dry-run produces expected output, working-tree housekeeping (no orphan .tmp/.bak files)"
    - "Each new check is invocable independently via doctor --acceptance --pre-tag (all 5 are pre-tag-applicable)"
  artifacts:
    - path: "scripts/doctor.cjs"
      provides: "Acceptance checklist extended with 5 new entries (one per Phase 123 cut hot-patch)"
      contains: "session-start-active-version|verify-release-clean-tree|frontmatter-yaml|release-dry-run|working-tree-housekeeping"
    - path: "tests/test-doctor-acceptance-preflight-checks.cjs"
      provides: "Per-check fixture coverage (5 broken-state scaffolds; each asserts the corresponding check fails the right way)"
      min_lines: 200
  key_links:
    - from: "scripts/doctor.cjs buildAcceptanceChecklist"
      to: "5 new checklist entries (one per hot-patch)"
      via: "additive entries with applies_to: ['pre-tag','full']; run() implements the original hot-patch detection logic"
      pattern: "session-start-active-version|verify-release-clean-tree"
    - from: "tests/test-doctor-acceptance-preflight-checks.cjs"
      to: "doctor --acceptance --json --pre-tag"
      via: "spawnSync per broken-state fixture; assert the targeted check fails while others pass"
      pattern: "--acceptance.*--pre-tag.*--json"
---

<objective>
Phase 123's release cut (the v1.13.0-beta.13 ship) surfaced 5 hot-patches during the Plan-06 pre-flight checklist. Each was applied MANUALLY by the operator before tagging the release. That manual checklist is institutional knowledge -- it lives in the operator's head. Phase 126 Plan 05 absorbs the 5 hot-patches as doctor --acceptance class letters so they run automatically on every release.

Purpose: institutional knowledge in the operator's head = release risk. Every operator-applied manual check is a future failure mode when the operator forgets, is replaced, or is rushed. Promote each to a structured check.

Output: --acceptance gains 5 new checklist entries. Each has a class letter, applies_to ['pre-tag', 'full'], and a deterministic run() function. Per-check fixture coverage proves each check catches its targeted broken state.

The 5 hot-patches (from CONTEXT.md Plan 05):
1. session-start active_version derivation correctness
2. verify-release Step 12 clean-tree
3. operator.md / doctor.md frontmatter YAML validity
4. release.sh --dry-run produces expected output
5. working-tree housekeeping (no orphan .tmp/.bak files in tracked dirs)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/126-install-lifecycle-harness-gaps/126-CONTEXT.md
@.planning/phases/126-install-lifecycle-harness-gaps/126-03-acceptance-gate-self-coverage-PLAN.md
@scripts/doctor.cjs
@scripts/release.sh
@scripts/verify-release
@scripts/session-start
@commands/doctor.md
@commands/operator.md

<interfaces>
<!-- Key contracts extracted from scripts/doctor.cjs buildAcceptanceChecklist + the 5 hot-patches list -->

Existing checklist entries (scripts/doctor.cjs lines 2141+):
- id: 'install-state'                        applies_to: ['pre-tag', 'full']
- id: 'deployment-surfaces'                  applies_to: ['pre-tag', 'full']
- id: 'version-of-record-repo'               applies_to: ['pre-tag', 'full']
- id: 'verify-release'                       applies_to: ['pre-tag', 'full']
- id: 'version-of-record-published'          applies_to: ['full']
- id: 'npx-roundtrip'                        applies_to: ['full']
- id: 'doctor-all'                           applies_to: ['pre-tag', 'full']  (Phase 123 closer)

New entries (Plan 05; all pre-tag-applicable):
1. id: 'session-start-active-version'    -- session-start derives active_version correctly from installed_plugins.json + plugin.json
2. id: 'verify-release-clean-tree'       -- scripts/verify-release Step 12 confirms clean git tree
3. id: 'frontmatter-yaml-validity'       -- commands/operator.md + commands/doctor.md frontmatter parses cleanly
4. id: 'release-dry-run-output'          -- release.sh --dry-run produces expected output (all expected step names present)
5. id: 'working-tree-housekeeping'       -- no orphan .tmp/.bak/.swp files in tracked directories

Test-mode env hooks (existing pattern at scripts/doctor.cjs line 2153):
- DOCTOR_TEST_FAIL_POINT=<id> synthesizes a failure of the named point

All 5 new entries support the test-mode injection (consistency with existing pattern).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add 5 new --acceptance checklist entries to scripts/doctor.cjs</name>
  <files>scripts/doctor.cjs</files>
  <read_first>
    - scripts/doctor.cjs lines 2118-2400 (buildAcceptanceChecklist + the 7 existing entries -- the pattern to mirror)
    - scripts/release.sh lines 152-220 (--dry-run output -- the expected step names this checklist entry will grep for)
    - scripts/verify-release (Step 12 clean-tree logic -- the original hot-patch detection target)
    - scripts/session-start lines 1-227 (active_version derivation -- the original hot-patch detection target)
    - commands/operator.md (the YAML frontmatter to validate)
    - commands/doctor.md (the YAML frontmatter to validate)
  </read_first>
  <behavior>
    - Each new checklist entry mirrors the existing entry shape: `{ id, label, severity: 'blocker', applies_to: ['pre-tag','full'], run: async function () {...} }`.
    - Each run() returns `{ ok: boolean, finding: string|null, detail: object }`.
    - Each entry honors the test-mode injection: `if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === <id>) return { ok: false, finding: '<id> synthesized failure (test mode)', detail: {} };`
    - No regression: existing 7 entries continue to pass against the dev workspace.
    - All 5 new entries are pre-tag-applicable (applies_to: ['pre-tag','full']) since they verify pre-release-cut state.
  </behavior>
  <action>
    Inside `buildAcceptanceChecklist` (scripts/doctor.cjs line 2141), APPEND 5 new entries to the returned array. Each implementation:

    **Entry 1: session-start-active-version**
    ```javascript
    {
      id: 'session-start-active-version',
      label: 'session-start derives active_version correctly from installed_plugins.json',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'session-start-active-version') {
          return { ok: false, finding: 'session-start-active-version synthesized failure (test mode)', detail: {} };
        }
        try {
          // Read installed_plugins.json + extract the mos@mindrian-marketplace active version.
          const ipPath = path.join(home, '.claude', 'installed_plugins.json');
          if (!fs.existsSync(ipPath)) {
            return { ok: false, finding: 'installed_plugins.json absent', detail: { ipPath: ipPath } };
          }
          const ip = JSON.parse(fs.readFileSync(ipPath, 'utf8'));
          const plugins = ip.plugins || {};
          const mosKey = Object.keys(plugins).find(function (k) { return k.startsWith('mos@mindrian-marketplace'); });
          if (!mosKey) return { ok: false, finding: 'no mos@mindrian-marketplace entry in installed_plugins.json', detail: {} };
          const recordedVersion = plugins[mosKey].version || null;
          // Compare to the active plugin root's plugin.json.
          const activeResolved = require(path.join(pluginRoot, 'lib', 'core', 'active-plugin-root.cjs'));
          const r = activeResolved.resolveActivePluginRoot ? activeResolved.resolveActivePluginRoot({ home: home }) : null;
          if (!r || !r.root) return { ok: false, finding: 'active plugin root unresolvable', detail: {} };
          const pjPath = path.join(r.root, '.claude-plugin', 'plugin.json');
          if (!fs.existsSync(pjPath)) return { ok: false, finding: 'plugin.json missing in active root', detail: { pjPath: pjPath } };
          const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
          const ok = pj.version === recordedVersion;
          return { ok: ok, finding: ok ? null : ('plugin.json says ' + pj.version + ' but installed_plugins.json says ' + recordedVersion), detail: { pluginJson: pj.version, recordedVersion: recordedVersion } };
        } catch (e) {
          return { ok: false, finding: 'session-start-active-version threw: ' + e.message, detail: {} };
        }
      },
    },
    ```

    **Entry 2: verify-release-clean-tree**
    ```javascript
    {
      id: 'verify-release-clean-tree',
      label: 'verify-release Step 12 reports clean git tree',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'verify-release-clean-tree') {
          return { ok: false, finding: 'verify-release-clean-tree synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        try {
          // git status --porcelain (no -uall; per CLAUDE.md). Untracked files allowed; tracked-dirty is the failure.
          const r = cp.spawnSync('git', ['-C', pluginRoot, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8', timeout: 10000 });
          if (r.status !== 0) return { ok: false, finding: 'git status failed', detail: { stderr: (r.stderr || '').slice(-200) } };
          const dirty = (r.stdout || '').trim();
          const ok = dirty === '';
          return { ok: ok, finding: ok ? null : ('tracked-file drift: ' + dirty.split('\n').length + ' file(s)'), detail: { dirty: dirty.slice(0, 500) } };
        } catch (e) {
          return { ok: false, finding: 'verify-release-clean-tree threw: ' + e.message, detail: {} };
        }
      },
    },
    ```

    **Entry 3: frontmatter-yaml-validity**
    ```javascript
    {
      id: 'frontmatter-yaml-validity',
      label: 'commands/operator.md + commands/doctor.md frontmatter YAML parses cleanly',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'frontmatter-yaml-validity') {
          return { ok: false, finding: 'frontmatter-yaml-validity synthesized failure (test mode)', detail: {} };
        }
        const targets = [
          path.join(pluginRoot, 'commands', 'operator.md'),
          path.join(pluginRoot, 'commands', 'doctor.md'),
        ];
        const failures = [];
        for (const t of targets) {
          if (!fs.existsSync(t)) { failures.push(t + ' (absent)'); continue; }
          const content = fs.readFileSync(t, 'utf8');
          // Frontmatter: file starts with ^---\n, ends with \n---\n
          const m = content.match(/^---\n([\s\S]*?)\n---\n/);
          if (!m) { failures.push(t + ' (no YAML frontmatter)'); continue; }
          const yaml = m[1];
          // Basic YAML hygiene: every non-blank non-list line is `<key>: <value>` (no tabs, no colons-without-spaces).
          const lines = yaml.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            if (ln.trim() === '') continue;
            if (ln.indexOf('\t') !== -1) { failures.push(t + ' line ' + (i + 1) + ' contains tab'); break; }
            if (!ln.startsWith(' ') && !/^[A-Za-z_][A-Za-z0-9_]*:/.test(ln) && !ln.startsWith('-') && !ln.startsWith('#')) {
              failures.push(t + ' line ' + (i + 1) + ' not key:value');
              break;
            }
          }
        }
        const ok = failures.length === 0;
        return { ok: ok, finding: ok ? null : ('YAML drift: ' + failures.join('; ')), detail: { failures: failures } };
      },
    },
    ```

    **Entry 4: release-dry-run-output**
    ```javascript
    {
      id: 'release-dry-run-output',
      label: 'release.sh --dry-run produces all expected step names',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'release-dry-run-output') {
          return { ok: false, finding: 'release-dry-run-output synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        try {
          const r = cp.spawnSync('bash', [path.join(pluginRoot, 'scripts', 'release.sh'), '--dry-run'], { encoding: 'utf8', timeout: 30000 });
          if (r.status !== 0) return { ok: false, finding: 'release.sh --dry-run exited ' + r.status, detail: { stderr: (r.stderr || '').slice(-200) } };
          const out = r.stdout || '';
          // Expected step names from scripts/release.sh --dry-run output (lines 184-215). All must be present.
          // NOTE: This array is patched by Plan 04 (Phase 126 Wave 3) to add Step 5.5, Step 9.7, Step 9.8 and
          // reorder Step 9.6 -> 9.8 for the rename. If you edit this list, make sure release.sh --dry-run output
          // still matches in order. Wave 2 (this plan) ships the initial array; Wave 3 (Plan 04) patches it.
          const expectedSteps = ['Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 5b', 'Step 6', 'Step 6.5', 'Step 6.6', 'Step 7', 'Step 9.5', 'Step 9.6'];
          const missing = expectedSteps.filter(function (s) { return out.indexOf(s) === -1; });
          const ok = missing.length === 0;
          return { ok: ok, finding: ok ? null : ('missing step names: ' + missing.join(', ')), detail: { missing: missing } };
        } catch (e) {
          return { ok: false, finding: 'release-dry-run-output threw: ' + e.message, detail: {} };
        }
      },
    },
    ```

    **Entry 5: working-tree-housekeeping**
    ```javascript
    {
      id: 'working-tree-housekeeping',
      label: 'no orphan .tmp/.bak/.swp files in tracked directories',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'working-tree-housekeeping') {
          return { ok: false, finding: 'working-tree-housekeeping synthesized failure (test mode)', detail: {} };
        }
        const cp = require('child_process');
        try {
          // git ls-files (tracked only). Filter to .tmp/.bak/.swp suffixes.
          const r = cp.spawnSync('git', ['-C', pluginRoot, 'ls-files'], { encoding: 'utf8', timeout: 10000 });
          if (r.status !== 0) return { ok: false, finding: 'git ls-files failed', detail: { stderr: (r.stderr || '').slice(-200) } };
          const tracked = (r.stdout || '').split('\n').filter(Boolean);
          const orphans = tracked.filter(function (p) { return /\.(tmp|bak|swp|swo)$/.test(p); });
          const ok = orphans.length === 0;
          return { ok: ok, finding: ok ? null : ('orphan tracked tmp/bak files: ' + orphans.slice(0, 5).join(', ') + (orphans.length > 5 ? ' (+' + (orphans.length - 5) + ' more)' : '')), detail: { orphans: orphans } };
        } catch (e) {
          return { ok: false, finding: 'working-tree-housekeeping threw: ' + e.message, detail: {} };
        }
      },
    },
    ```

    Insert all 5 entries at the END of the buildAcceptanceChecklist return array (after the existing 'doctor-all' entry). Order them logically: 1, 2, 3, 4, 5 as listed above.

    Workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.

    Settled in plan-phase: Wave 2 ordering -- Plan 05 depends on Plan 03 (Plan 03 establishes the self-coverage aggregator which Plan 05's new checks must also pass under). Plan 05's new checks should turn GREEN against the dev workspace BEFORE Plan 04 (Wave 3) wires the full release pipeline.
  </action>
  <verify>
    <automated>node -c scripts/doctor.cjs && node scripts/doctor.cjs --acceptance --pre-tag --json | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); const ids=j.acceptance.checklist.map(x=>x.id); const need=['session-start-active-version','verify-release-clean-tree','frontmatter-yaml-validity','release-dry-run-output','working-tree-housekeeping']; const missing=need.filter(n=>!ids.includes(n)); if(missing.length){console.error('missing:',missing); process.exit(1)} else console.log('OK 5 new checks present')"</automated>
  </verify>
  <acceptance_criteria>
    - `node -c scripts/doctor.cjs` exits 0 (syntactically valid)
    - `node scripts/doctor.cjs --acceptance --pre-tag --json` output includes all 5 new entries in `acceptance.checklist[].id`
    - Against the dev workspace (clean tree, no orphan .tmp files): all 5 new checks PASS
    - Against a fabricated broken state (e.g., `touch foo.tmp && git add foo.tmp`): the `working-tree-housekeeping` check FAILS the right way (other 4 still pass)
    - DOCTOR_TEST_FAIL_POINT=<each-id> synthesizes the corresponding failure for testing
  </acceptance_criteria>
  <done>
    5 new checklist entries land. Each is independently invocable. Each honors test-mode injection. No regression in existing 7 entries.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create per-check fixture coverage</name>
  <files>tests/test-doctor-acceptance-preflight-checks.cjs</files>
  <read_first>
    - tests/test-doctor-acceptance-self-coverage.cjs (Plan 03's aggregator -- the established fixture-spawn pattern)
    - scripts/doctor.cjs buildAcceptanceChecklist (Task 1 above)
    - tests/test-doctor-acceptance.cjs (existing DOCTOR_TEST_FAIL_POINT pattern)
  </read_first>
  <behavior>
    - Test 1 (session-start-active-version): scaffold a HOME where installed_plugins.json says one version but the active plugin root's plugin.json says another. Invoke doctor --acceptance --pre-tag --json. Assert checklist[id=session-start-active-version].ok === false.
    - Test 2 (verify-release-clean-tree): inject a tracked-dirty state by setting DOCTOR_TEST_FAIL_POINT=verify-release-clean-tree (using existing test-mode hook -- the SAFE proxy; we do NOT actually dirty the dev workspace). Assert checklist[id=verify-release-clean-tree].ok === false + finding mentions 'synthesized failure (test mode)'.
    - Test 3 (frontmatter-yaml-validity): set DOCTOR_TEST_FAIL_POINT=frontmatter-yaml-validity. Assert failure surfaces correctly. Optionally: scaffold a temp commands/operator.md with a tab character in the frontmatter (override pluginRoot via a test env var if doctor.cjs exposes one; otherwise rely on DOCTOR_TEST_FAIL_POINT).
    - Test 4 (release-dry-run-output): set DOCTOR_TEST_FAIL_POINT=release-dry-run-output. Assert failure.
    - Test 5 (working-tree-housekeeping): set DOCTOR_TEST_FAIL_POINT=working-tree-housekeeping. Assert failure.
    - Test 6 (no synthetic failures -- all 5 PASS against dev workspace): invoke doctor --acceptance --pre-tag --json against the live dev workspace WITHOUT any DOCTOR_TEST_FAIL_POINT. Assert all 5 new checks pass.
    - Test 7 (one failure ISOLATED -- the others pass): set DOCTOR_TEST_FAIL_POINT=working-tree-housekeeping. Assert that ONLY working-tree-housekeeping fails; the other 4 new checks AND the existing 7 checks pass.
  </behavior>
  <action>
    Create `tests/test-doctor-acceptance-preflight-checks.cjs`. Pattern: 7 sub-tests, each invokes doctor --acceptance --pre-tag --json with different env, asserts the checklist breakdown.

    Helper pattern (same as Plan 03 aggregator):
    ```javascript
    const { spawnSync } = require('child_process');
    function runAcceptance(extraEnv) {
      const env = Object.assign({}, process.env, { DOCTOR_TEST_MODE: '1' }, extraEnv || {});
      const r = spawnSync('node', [path.join(__dirname, '..', 'scripts', 'doctor.cjs'), '--acceptance', '--pre-tag', '--json'], { env, encoding: 'utf8', timeout: 60000 });
      try { return { exit: r.status, json: JSON.parse(r.stdout) }; } catch (_) { return { exit: r.status, json: null, stdout: r.stdout }; }
    }
    function entry(json, id) { return (json.acceptance.checklist || []).find(function (x) { return x.id === id; }); }
    ```

    Wire into tests/run-all-126.sh as a CJS suite entry.

    Settled in plan-phase: prefer DOCTOR_TEST_FAIL_POINT injection over real broken-state scaffolding for Tests 2-5 because (a) it mirrors the established Phase 123 test pattern (tests/test-doctor-acceptance.cjs uses the same hook), (b) it does NOT pollute the dev workspace, (c) the check IMPLEMENTATIONS already include the injection hook so this proves the END-TO-END plumbing. Test 1 scaffolds real state (mktemp HOME) for ONE check to prove the actual detection logic works against a real fixture.
  </action>
  <verify>
    <automated>node tests/test-doctor-acceptance-preflight-checks.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-doctor-acceptance-preflight-checks.cjs` exits 0 (all 7 sub-tests GREEN)
    - File compiles cleanly: `node -c tests/test-doctor-acceptance-preflight-checks.cjs`
    - Wired in tests/run-all-126.sh
    - Test 7 (isolation) proves no cross-check contamination
  </acceptance_criteria>
  <done>
    7-case test file exists, runs to completion, all GREEN. Tests 2-5 use DOCTOR_TEST_FAIL_POINT injection; Test 1 uses real mktemp scaffolding; Test 6 is regression guard; Test 7 is isolation guard.
  </done>
</task>

</tasks>

<verification>
- `node -c scripts/doctor.cjs` exits 0
- `node scripts/doctor.cjs --acceptance --pre-tag --json` includes all 5 new checklist entries
- `node tests/test-doctor-acceptance-preflight-checks.cjs` passes all 7 sub-tests
- `bash tests/run-all-123.sh` passes (no regression in test-doctor-acceptance.cjs)
- Live: against dev workspace, all 7 EXISTING + 5 NEW checks pass
- `bash tests/run-all-126.sh` includes this test suite and passes
</verification>

<success_criteria>
- All must_haves satisfied
- Plan 05 acceptance criteria from CONTEXT.md "Acceptance Criteria (Nyquist UAT)" block all pass:
  - Each of the 5 hot-patches from Phase 123 cut now has a doctor class letter (checklist entry)
  - doctor --acceptance --json output includes all 5 new checks
  - Running against a known-broken state fails the right check
- No regression in Phase 123 / 95.2 / 95.1 / 93 test runners
- The 5 hot-patches are no longer institutional knowledge in the operator's head
</success_criteria>

<output>
After completion, create `.planning/phases/126-install-lifecycle-harness-gaps/126-05-SUMMARY.md` covering:
- The 5 hot-patches absorbed (one-line each describing the original cut-time finding + the check that now catches it)
- The test-injection pattern reused (DOCTOR_TEST_FAIL_POINT)
- The isolation guard (one failure does not cascade to others)
- Reference forward to Plan 04 (release pipeline) which wires the full --acceptance (including these 5) into Step 9.6 post-publish gate; Plan 04 also patches Entry 4's `expectedSteps` array to absorb Step 5.5 / 9.7 / 9.8 (the release.sh rename + new steps land in Wave 3 on top of this fixture's Wave 2 scaffold)
</output>
</content>
</invoke>