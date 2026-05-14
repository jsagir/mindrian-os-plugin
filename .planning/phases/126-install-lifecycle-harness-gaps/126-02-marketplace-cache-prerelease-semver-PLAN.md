---
phase: 126
slug: install-lifecycle-harness-gaps
plan: 02
title: Marketplace-Cache Prerelease Semver-Pick Fix
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/doctor.cjs
  - tests/test-marketplace-cache-prerelease-pick.cjs
  - tests/run-all-126.sh
autonomous: true
requirements_addressed: []
canon_parts:
  - Part 6 (dog-fooding: semver-pick bug surfaced from real Windows dogfood cache layout)
  - Part 7 (reuse: semver@^7.7.4 already runtime dep -- reuse, do not hand-roll prerelease comparison)
beta_target: v1.13.0-beta.15
hotfix_discipline: true
gap_closure: false
must_haves:
  truths:
    - "When marketplace cache contains both beta.9 and beta.13 directories, doctor picks beta.13 (NOT beta.9)"
    - "Prerelease semver ordering follows npm-semver semantics: beta.13 > beta.9 (numeric-aware, not lexicographic)"
    - "Stable versions sort AFTER their corresponding prereleases (1.13.0 > 1.13.0-beta.X)"
    - "Newer minor prerelease sorts after older stable (1.14.0-beta.1 > 1.13.0)"
    - "The fix reuses the existing semver@^7.7.4 runtime dep -- no hand-rolled prerelease comparison"
  artifacts:
    - path: "scripts/doctor.cjs"
      provides: "Cache-pick logic using semver.compare (or semver.rcompare/maxSatisfying) for prerelease ordering"
      contains: "require('semver')"
    - path: "tests/test-marketplace-cache-prerelease-pick.cjs"
      provides: "5-case fixture covering prerelease ordering edge cases"
      min_lines: 100
  key_links:
    - from: "scripts/doctor.cjs checkMarketplaceCache (line ~224)"
      to: "semver package (require('semver'))"
      via: "replace cmpVersion's localeCompare branch with semver.compare"
      pattern: "semver\\.compare"
    - from: "tests/test-marketplace-cache-prerelease-pick.cjs"
      to: "scripts/doctor.cjs checkMarketplaceCache result.latest"
      via: "spawnSync doctor.cjs --json against scaffolded cache fixtures"
      pattern: "checkMarketplaceCache|latest"
---

<objective>
Close the dogfood finding (3b): on a Windows machine with marketplace cache containing both `1.13.0-beta.9/` and `1.13.0-beta.13/`, doctor recovered the install at `1.13.0-beta.9` (NOT beta.13). The cache-pick `cmpVersion` helper in scripts/doctor.cjs (lines 194-205) compares prereleases via `localeCompare` which sorts STRINGS lexicographically: `"beta.10"` < `"beta.9"` lexicographically because `'1'` < `'9'` as ASCII. The correct ordering treats numeric components NUMERICALLY: `beta.9 < beta.10 < beta.13`.

Purpose: incorrect cache-pick = recovery restores the wrong version. This is the Phase 95.2 atomic-swap contract's worst failure mode: atomicity works, but the destination version is stale.

Output: cache-pick uses the existing `semver@^7.7.4` runtime dep (already in package.json) for prerelease-aware comparison. Five fixture cases prove the behavior against scaffolded cache trees.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/126-install-lifecycle-harness-gaps/126-CONTEXT.md
@.planning/phases/126-install-lifecycle-harness-gaps/126-FEEDBACK-2026-05-13-windows-dogfood.md
@scripts/doctor.cjs
@package.json
@tests/test-doctor-class-i.cjs

<interfaces>
<!-- Key contracts extracted from scripts/doctor.cjs lines 181-253 -->

Current cache-pick helpers (scripts/doctor.cjs):
```javascript
// Line 181-192:
function parseVersion(v) {
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!m) return null;
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    prerelease: m[4] || null,
    raw: v,
  };
}

// Line 194-205 -- THE BUG:
function cmpVersion(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && b.prerelease) {
    return a.prerelease.localeCompare(b.prerelease);  // BUG: lexicographic, not numeric-aware
  }
  return 0;
}

// Line 224-253 -- checkMarketplaceCache uses cmpVersion to pick latest:
function checkMarketplaceCache() {
  // ... reads ~/.claude/plugins/cache/mindrian-marketplace/mos/ subdirs ...
  versions.sort((a, b) => cmpVersion(a.parsed, b.parsed));
  return {
    status: 'ok',
    versions: versions.map(v => v.raw),
    latest: versions[versions.length - 1].raw,
    latestParsed: versions[versions.length - 1].parsed,
  };
}
```

From package.json (confirmed via `grep '"semver"' package.json`):
```json
"semver": "^7.7.4"
```

semver@7.7.4 API (already used in scripts/release.sh for pre-release algebra):
- `semver.compare(a, b)` returns -1 / 0 / 1 with NUMERIC prerelease awareness (npm-semver spec). `beta.9 < beta.10` per spec section 11.4.4.
- `semver.rcompare(a, b)` is reverse compare for descending sort.
- `semver.valid(v)` returns the version string if valid, null otherwise.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create 5-case prerelease ordering fixture test</name>
  <files>tests/test-marketplace-cache-prerelease-pick.cjs</files>
  <read_first>
    - scripts/doctor.cjs (current parseVersion + cmpVersion + checkMarketplaceCache at lines 181-253)
    - tests/test-doctor-class-i.cjs (existing fixture pattern: mktemp HOME, seed marketplace cache directory tree)
    - tests/test-doctor-acceptance.cjs (existing JSON output assertion style via `--json` flag)
    - package.json (confirm semver is "^7.7.4" -- already runtime dep)
  </read_first>
  <behavior>
    - Test 1 (beta.9 vs beta.13): cache contains 1.13.0-beta.9/ and 1.13.0-beta.13/. Expected `latest = "1.13.0-beta.13"`. CURRENT renderer returns beta.9 (the bug). Test FAILS RED until Task 2 lands.
    - Test 2 (beta.13 vs beta.14): cache contains 1.13.0-beta.13/ and 1.13.0-beta.14/. Expected `latest = "1.13.0-beta.14"`.
    - Test 3 (beta.13 vs rc.1): cache contains 1.13.0-beta.13/ and 1.13.0-rc.1/. Expected `latest = "1.13.0-rc.1"` (rc > beta per semver spec).
    - Test 4 (beta.13 vs stable 1.13.0): cache contains 1.13.0-beta.13/ and 1.13.0/. Expected `latest = "1.13.0"` (stable > prerelease at same major.minor.patch).
    - Test 5 (newer minor prerelease vs older stable): cache contains 1.13.0/ and 1.14.0-beta.1/. Expected `latest = "1.14.0-beta.1"` (newer minor's prerelease > older stable).
  </behavior>
  <action>
    Create `tests/test-marketplace-cache-prerelease-pick.cjs`. Use the same mktemp HOME pattern as `tests/test-doctor-class-i.cjs`:

    1. Helper `seedCache(home, versions)`: creates `<home>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/.claude-plugin/plugin.json` for each version in the array. plugin.json content: `{ "version": "<version>", "name": "mindrian-os" }`. Also create a minimal marketplace.json so doctor sees a valid mos@mindrian-marketplace registry entry.

    2. Helper `invokeDoctor(home)`: `spawnSync('node', [doctorPath, '--json'], { env: { ...process.env, HOME: home }, encoding: 'utf8', timeout: 30000 })`. Parse stdout as JSON. Return the parsed object.

    3. The 5 sub-tests each call seedCache + invokeDoctor + assert. The doctor --json output structure includes a `marketplaceCache` block with a `latest` field (verified from current doctor.cjs line 250). Each sub-test asserts `result.marketplaceCache.latest === <expected>`.

    4. Cleanup: `fs.rmSync(tmpHome, { recursive: true, force: true })` in finally; restore process.env.HOME.

    5. Wire into tests/run-all-126.sh as a CJS suite entry.

    Settled in plan-phase: Open Question 2 (semver as runtime dep vs devDep) -- the semver package is ALREADY a runtime dep at `"semver": "^7.7.4"` (verified via `grep '"semver"' package.json`). No package.json edit needed. The cache-pick fix in Task 2 reuses the existing dep -- Canon Part 7 reuse honored.

    Settled in plan-phase: Open Question 1 (Wave 1 parallelism with Plan 01) -- this test file is independent of Plan 01's test file. Both can be created in parallel. The shared file is scripts/doctor.cjs but the edit regions are non-overlapping (Plan 01 = renderer near main/run; this plan = cmpVersion helpers at lines 181-205). If git conflict arises during the FIX task (Task 2 below + Plan 01 Task 2), serialize: land Plan 01 Task 2 first, then this plan's Task 2.
  </action>
  <verify>
    <automated>node tests/test-marketplace-cache-prerelease-pick.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-marketplace-cache-prerelease-pick.cjs` runs to completion (test framework loads + executes 5 sub-tests)
    - With the CURRENT (buggy) cmpVersion, Test 1 FAILS RED with `expected "1.13.0-beta.13", got "1.13.0-beta.9"` (proving the test would have caught the dogfood finding)
    - File compiles cleanly: `node -c tests/test-marketplace-cache-prerelease-pick.cjs`
    - Wired in tests/run-all-126.sh
  </acceptance_criteria>
  <done>
    Test file exists, all 5 cases scaffold + invoke + assert. Test 1 RED against current bug; all 5 GREEN once Task 2 lands.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace cmpVersion's localeCompare branch with semver.compare</name>
  <files>scripts/doctor.cjs</files>
  <read_first>
    - tests/test-marketplace-cache-prerelease-pick.cjs (the 5-case contract from Task 1)
    - scripts/doctor.cjs lines 181-205 (parseVersion + cmpVersion -- the surface to fix)
    - scripts/doctor.cjs line 224-253 (checkMarketplaceCache -- the consumer of cmpVersion)
    - scripts/release.sh lines 99-148 (existing semver.inc usage pattern -- the established way to invoke semver in this codebase)
    - package.json (`"semver": "^7.7.4"`)
  </read_first>
  <behavior>
    - All 5 fixture cases from Task 1 turn GREEN.
    - cmpVersion (or its replacement) correctly orders: beta.9 < beta.10 < beta.13 < beta.14 < rc.1 < 1.13.0 < 1.14.0-beta.1.
    - No regression: existing scripts/doctor.cjs tests (test-doctor-class-i, test-doctor-acceptance, test-doctor-class-{b,c,e,f,g,h}, test-cache-prune, test-install-state-record) all still pass.
    - Backward-compatibility: if `parseVersion` returns null for some entry (e.g., a non-semver directory name in the cache), checkMarketplaceCache must continue to filter it out gracefully -- no crash on require('semver') input validation.
  </behavior>
  <action>
    Replace the `localeCompare` branch in cmpVersion (line 202) with a semver.compare call. Minimum-surface fix:

    Option A (preserve cmpVersion signature; reuse semver internally for the prerelease branch only):
    ```javascript
    const semver = require('semver');
    function cmpVersion(a, b) {
      if (a.major !== b.major) return a.major - b.major;
      if (a.minor !== b.minor) return a.minor - b.minor;
      if (a.patch !== b.patch) return a.patch - b.patch;
      if (a.prerelease && !b.prerelease) return -1;
      if (!a.prerelease && b.prerelease) return 1;
      if (a.prerelease && b.prerelease) {
        // FIX (Plan 126-02): numeric-aware prerelease ordering per npm-semver spec.
        // localeCompare was lexicographic which sorts beta.10 BEFORE beta.9.
        return semver.compare(a.raw, b.raw);
      }
      return 0;
    }
    ```
    Note: when both prereleases are non-null, the cmpVersion early-returns above guarantee major/minor/patch are equal, so semver.compare's full comparison reduces to the prerelease comparison -- safe.

    Option B (delegate the whole comparison to semver, drop hand-rolled cmpVersion):
    ```javascript
    function cmpVersion(a, b) {
      // Both inputs are parseVersion results; if both raw fields are valid semver, defer entirely.
      if (semver.valid(a.raw) && semver.valid(b.raw)) {
        return semver.compare(a.raw, b.raw);
      }
      // Fallback path for legacy 4-component non-semver (e.g., 1.12.5.1) which parseVersion's regex already rejects -- this branch is effectively unreachable for fixture inputs.
      return 0;
    }
    ```

    Prefer Option A (minimum delta; preserves the existing function shape; Canon Part 7 reuse-before-build).

    Wire `const semver = require('semver')` at the top of the cmpVersion stanza or at the module top alongside other requires. Confirm by `grep '^const semver' scripts/doctor.cjs` after edit.

    Additional safety: leave parseVersion unchanged. Its regex already filters non-conforming entries (return null). Versions with `null` parsed values are filtered before the sort in checkMarketplaceCache (line 238: `if (parsed) versions.push(...)`).

    Settled in plan-phase: Open Question 1 (parallelism). The edit region (lines ~194-205) does NOT overlap with Plan 01's renderer-fix region (main/run path, line ~2400+). Safe for parallel work. If git merge surfaces a conflict (e.g., both branches reordered imports), Plan 01 Task 2 merges first (it ships earlier in the parallel timeline because Plan 01 has fewer tasks).

    Preserve workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.
  </action>
  <verify>
    <automated>node tests/test-marketplace-cache-prerelease-pick.cjs && bash tests/run-all-123.sh</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-marketplace-cache-prerelease-pick.cjs` exits 0 (all 5 sub-tests GREEN)
    - `bash tests/run-all-123.sh` continues to pass (no regression in Phase 123 harness suite -- which includes test-doctor-class-i + test-doctor-acceptance that already depend on cmpVersion indirectly via checkMarketplaceCache)
    - `bash tests/run-all-95.2.sh` continues to pass (Phase 95.2 atomic-swap tests also depend on this cache-pick path)
    - Live run: scaffold a cache with beta.9 + beta.13 directories; `node scripts/doctor.cjs --json | jq .marketplaceCache.latest` returns `"1.13.0-beta.13"` (NOT beta.9)
    - `grep -n "require('semver')" scripts/doctor.cjs` returns at least one line
    - `grep -c "localeCompare" scripts/doctor.cjs` returns 0 (the buggy branch is gone)
  </acceptance_criteria>
  <done>
    Cache-pick uses semver-spec prerelease ordering. 5 fixture cases GREEN. No regression in Phase 123 / 95.2 test runners. semver dep reused (Canon Part 7).
  </done>
</task>

</tasks>

<verification>
- `node tests/test-marketplace-cache-prerelease-pick.cjs` passes all 5 cases
- `bash tests/run-all-123.sh` passes (regression guard)
- `bash tests/run-all-95.2.sh` passes (atomic-swap depends on cache-pick)
- Live smoke: scaffold beta.9 + beta.13; doctor reports beta.13 as latest
- No new dependency added (semver was already runtime; package.json unchanged)
</verification>

<success_criteria>
- All must_haves satisfied
- Plan 02 acceptance criteria from CONTEXT.md "Acceptance Criteria (Nyquist UAT)" block all pass:
  - tests/test-marketplace-cache-prerelease-pick.cjs passes all 5 cases
  - beta.9 vs beta.13: beta.13 wins
  - beta.13 vs beta.14: beta.14 wins
  - beta.13 vs rc.1: rc.1 wins
  - beta.13 vs 1.13.0 stable: 1.13.0 wins
  - 1.13.0 vs 1.14.0-beta.1: 1.14.0-beta.1 wins
  - semver package is in devDep OR runtime (verified: it IS runtime at ^7.7.4)
- No regression in upstream test runners
</success_criteria>

<output>
After completion, create `.planning/phases/126-install-lifecycle-harness-gaps/126-02-SUMMARY.md` covering:
- The localeCompare bug discovered + closed
- The 5-case fixture pattern (beta-vs-beta, beta-vs-newer-beta, beta-vs-rc, beta-vs-stable, older-stable-vs-newer-prerelease)
- semver dep reuse (Canon Part 7)
- Reference forward to Plan 03 which incorporates this fixture into the broader acceptance-gate self-coverage aggregator
</output>
