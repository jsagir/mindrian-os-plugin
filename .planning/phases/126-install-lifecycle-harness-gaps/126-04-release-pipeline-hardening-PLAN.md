---
phase: 126
slug: install-lifecycle-harness-gaps
plan: 04
title: Release Pipeline Hardening (Tag-Push + Install-Minisite HARD Lockstep + npx-Publish Self-Test)
type: execute
wave: 3
depends_on:
  - 126-03-acceptance-gate-self-coverage-PLAN
  - 126-05-release-flight-preflight-in-acceptance-PLAN
files_modified:
  - scripts/release.sh
  - tests/test-release-bump-tag-and-publish-gates.cjs
  - tests/test-doctor-acceptance-preflight-checks.cjs
  - docs/install-cache-family-premortem.md
  - tests/run-all-126.sh
autonomous: true
requirements_addressed: []
canon_parts:
  - Part 6 (dog-fooding: the release pipeline self-tests end-to-end before declaring success)
  - Part 7 (reuse: extends scripts/release.sh + scripts/doctor.cjs --acceptance without forking)
beta_target: v1.13.0-beta.15
hotfix_discipline: true
gap_closure: false
must_haves:
  truths:
    - "release.sh Step 5.5 refuses to proceed if tag-push fails or if `git ls-remote --tags origin | grep <tag>` does not return the tag after push"
    - "release.sh Step 9.6 install-minisite lockstep is HARD (was Soft per existing release.sh): MINISITE_DIR resolution fails loud, sed+grep verification rolls back on mismatch, git push triggers Vercel auto-deploy, post-push live-poll verifies the deployed site reflects NEW_VERSION within configurable timeout (default 180s, 10s interval)"
    - "release.sh accepts --no-minisite opt-out (emergency releases ONLY); the opt-out logs an audit line to stderr (NOT a silent skip)"
    - "release.sh Step 9.7 refuses to declare release success if `npx @mindrian_os/install@<version>` against a temp directory exits non-zero OR produces no scaffold"
    - "If MINISITE_DIR is unset OR the directory does not exist AND `--no-minisite` is not passed, release.sh fails loud with the `gh repo clone` (or `git clone`) recovery command (NOT `git remote add origin`). The `git remote add origin` recovery is reserved for the separate origin-missing path covered by Test 6 (directory exists but has no `origin` remote configured)."
    - "MINDRIAN_MINISITE_URL env var (default https://mindrianos-install-site.vercel.app/) controls the live-poll endpoint (Open Question 8 settled)"
    - "sed pattern is line-anchored + content-based (matches the version-string literal, NOT line numbers 149/30) so a minisite refactor does not silently break the bump (Open Question 9 settled; aligns with the existing release.sh Step 9.6 sed pattern at lines 468 + 475)"
    - "Dry-run mode shows all FOUR new/renumbered gates (Step 5.5, Step 9.6, Step 9.7, Step 9.8) in --dry-run output"
    - "tests/test-release-bump-tag-and-publish-gates.cjs covers all three gates against scaffolded states (tag-push, install-minisite sed+commit+push+live-poll, npx-publish self-test) using a sandboxed minisite fixture + HTTP mock for the Vercel live-poll surface"
  artifacts:
    - path: "scripts/release.sh"
      provides: "Step 5.5 (tag-push verification), HARD Step 9.6 (install-minisite lockstep), Step 9.7 (npx-publish self-test), Step 9.8 (renamed full --acceptance gate), --no-minisite flag, MINISITE_DIR + MINDRIAN_MINISITE_URL env vars"
      contains: "Step 5.5|Step 9.7|Step 9.8|--no-minisite|MINDRIAN_MINISITE_URL"
    - path: "tests/test-release-bump-tag-and-publish-gates.cjs"
      provides: "End-to-end fixture covering tag-push gate + install-minisite gate (sandbox + HTTP mock) + npx-publish gate"
      min_lines: 250
    - path: "tests/test-doctor-acceptance-preflight-checks.cjs"
      provides: "Patched expectedSteps array in Entry 4 (release-dry-run-output check) to cover Step 5.5, Step 9.7, Step 9.8 (added by Plan 04 Wave 3 on top of Plan 05's Wave 2 scaffold)"
      contains: "Step 5.5|Step 9.7|Step 9.8"
    - path: "docs/install-cache-family-premortem.md"
      provides: "1-page (~50-80 lines) family pre-mortem doc per D4"
      contains: "Family history|Pattern across cases|Predicted next failure modes|Revisit cadence"
  key_links:
    - from: "scripts/release.sh Step 5.5"
      to: "git push origin <tag> + git ls-remote --tags origin"
      via: "after `git tag v$NEW_VERSION` at line 370, push the tag + verify it appears in origin's remote refs"
      pattern: "git ls-remote --tags origin"
    - from: "scripts/release.sh Step 9.6 (HARD)"
      to: "MINISITE_DIR (env override) + git push origin main + live-poll MINDRIAN_MINISITE_URL"
      via: "sed -i with line-anchored content match + grep verify + rollback on mismatch + git commit + git push + curl-poll until version string appears OR timeout"
      pattern: "git push origin main.*curl.*MINDRIAN_MINISITE_URL"
    - from: "scripts/release.sh Step 9.7"
      to: "npx @mindrian_os/install@<version>"
      via: "mktemp -d + cd + npx + assert exit 0 + assert expected scaffold marker file"
      pattern: "npx @mindrian_os/install"
    - from: "scripts/release.sh Step 9.8 (renamed from old Step 9.6)"
      to: "scripts/doctor.cjs --acceptance (full)"
      via: "comment header + echo line updated from 'Step 9.6' to 'Step 9.8'; block body unchanged"
      pattern: "Step 9.8: doctor --acceptance"
    - from: "tests/test-doctor-acceptance-preflight-checks.cjs Entry 4 expectedSteps"
      to: "release.sh --dry-run output (after Plan 04 rename + new steps)"
      via: "patch the array to add 'Step 5.5','Step 9.7','Step 9.8' and reorder for the 9.6 -> 9.8 rename"
      pattern: "expectedSteps.*Step 5\\.5.*Step 9\\.7.*Step 9\\.8"
---

<objective>
This is the LARGEST plan in Phase 126. It hardens three release-pipeline surfaces:

1. **Step 5.5 (tag-push verification)** -- the existing release.sh tags the commit (line 370) and pushes both `git push origin main --tags` (line 612) but does NOT verify the tag is actually at origin. The 2026-05-13 dogfood found the tag missing from the local marketplace-cache fetch (the real cause was a Windows-side fetch artifact; the tag IS at origin). A verification step closes the asymmetry by ALWAYS confirming the tag round-trips through origin BEFORE proceeding.

2. **Step 9.6 (install-minisite HARD lockstep)** -- the existing release.sh has a Step 9.6 at line 433 that runs in **soft-skip mode** (warns + continues, uses `vercel --prod --yes`). The memory rule `feedback_install_minisite_lockstep.md` promotes this from Soft to HARD on 2026-05-14. Plan 04 REPLACES the soft-skip implementation with a hard contract: MINISITE_DIR fail-loud, sed line-anchored content match, grep-verify-and-rollback, git commit + git push origin main (NOT vercel CLI), live-poll via `curl` against MINDRIAN_MINISITE_URL until the new version appears (configurable timeout), and a `--no-minisite` audit-logged opt-out for emergency releases.

3. **Step 9.7 (npx-publish self-test)** -- the existing Step 9.5 publishes to npm; the existing Step 9.6 (in the second usage at line 615 -- the doctor --acceptance full gate) runs `npx-roundtrip` as part of --acceptance. Plan 04 adds an EXPLICIT npx-publish self-test at Step 9.7 that runs `npx @mindrian_os/install@<version>` against a fresh temp directory + asserts exit 0 + asserts expected scaffold marker. This catches the dogfood's "@mindrian_os/install npx round-trip broken (null)" finding even when --acceptance's npx-roundtrip point passes for some other reason.

Plus: ship the 1-page family pre-mortem doc (`docs/install-cache-family-premortem.md`) per D4 -- 4 sections, ~50-80 lines, no code.

Output: scripts/release.sh extended with 3 new gates + 2 env vars + 1 opt-out flag. End-to-end fixture coverage. Family pre-mortem doc shipped in parallel within Wave 3.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/126-install-lifecycle-harness-gaps/126-CONTEXT.md
@.planning/phases/126-install-lifecycle-harness-gaps/126-FEEDBACK-2026-05-13-windows-dogfood.md
@.planning/phases/126-install-lifecycle-harness-gaps/126-03-acceptance-gate-self-coverage-PLAN.md
@.planning/phases/126-install-lifecycle-harness-gaps/126-05-release-flight-preflight-in-acceptance-PLAN.md
@scripts/release.sh
@scripts/doctor.cjs
@$HOME/mindrianos-install-site/lib/os.ts
@$HOME/mindrianos-install-site/app/page.tsx
@.claude/includes/release-process.md
@/home/jsagi/.claude/projects/-home-jsagi/memory/feedback_install_minisite_lockstep.md

<interfaces>
<!-- Existing release.sh structure (verified via grep): -->

Line numbers of relevant existing steps:
- Line 339-358: Step 6.6 (--acceptance --pre-tag) -- HARD ABORT exists
- Line 360-370: Step 7 (Commit A, git tag v$NEW_VERSION) -- TAG CREATED locally; not yet pushed
- Line 376-431: Step 9.5 (npm publish @mindrian_os/install) -- exists, HARD ABORT
- Line 433-517: Step 9.6 (current SOFT install-minisite sync via `vercel --prod --yes`) -- to REPLACE with HARD contract
- Line 519-573: Step 7.5 (Commit B, next-bump commit)
- Line 575-607: Step 8 (ahead-of-origin guard)
- Line 609-613: Step 9 (`git push origin main --tags` -- the actual tag push happens HERE, AFTER Step 9.6/9.5)
- Line 615-651: Step 9.6 (the SECOND Step-9.6 -- doctor --acceptance full, HARD ABORT) -- this is a numbering collision in the existing file (the soft minisite block was inserted AS Step 9.6 alongside the existing full --acceptance Step 9.6). Plan 04 RENAMES the existing soft block to be replaced AND keeps the full --acceptance Step at its current spot. New numbering: Step 5.5 (new tag-push), Step 7 (Commit A + tag), Step 9 (push), Step 9.5 (npm publish), Step 9.6 (HARD minisite), Step 9.7 (NEW npx-publish self-test), Step 9.8 (renumbered from existing Step 9.6 full --acceptance).

NEW step placement (Plan 04):
- Step 5.5: tag-push verification -- INSERT between current line 370 (`git tag v$NEW_VERSION`) and line 372 (`cd $MARKETPLACE_DIR`). But push at this point is premature (Commit B not yet made). REVISED: Step 5.5 is actually the POST-Step-9 tag-push verification -- AFTER the existing line 612 `git push origin main --tags`, verify the tag appears in origin's remote refs.
- Step 9.6 HARD: REPLACES the soft block at lines 433-517 with the hard contract.
- Step 9.7: NEW; INSERT between the HARD Step 9.6 and the existing full --acceptance gate (which becomes Step 9.8).
- Step 9.8: RENAMED from existing Step 9.6 (the full --acceptance gate at lines 615-651).

(NOTE: the existing two Step 9.6's are a numbering collision in the current file. Plan 04 resolves the collision by renaming the second one to 9.8 and inserting 9.7 in between.)

Existing line-anchored sed patterns (Plan 04 REUSES these from release.sh line 468 + 475):
```bash
# lib/os.ts: "MindrianOS v<version> installed"
sed -i -E "s@MindrianOS v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc|next)\.[0-9]+)?@MindrianOS v$NEW_VERSION@g" lib/os.ts

# app/page.tsx: "v<version> · Install"
sed -i -E "s@v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc|next)\.[0-9]+)? · Install@v$NEW_VERSION · Install@g" app/page.tsx
```

These patterns are line-anchored to CONTENT (the literal strings "MindrianOS v" and " · Install"), NOT to line numbers 149/30. A refactor in the minisite that moves the strings to different lines still matches. A refactor that REMOVES the strings would fail the post-sed grep verify -- which is the CORRECT failure mode (Open Question 9 settled).

Current minisite repo state (verified 2026-05-14 in /home/jsagi/mindrianos-install-site):
- No `origin` remote configured (`git remote -v` returns empty per Open Question 7)
- HEAD at `132fe71 chore: sync minisite version strings to v1.13.0-beta.14`
- Files at: lib/os.ts:149 + app/page.tsx:30 (verified line numbers)

Open Question 7 settlement: TWO distinct failure modes with DIFFERENT recovery messages:

| Failure mode | Recovery message |
|---|---|
| `MINISITE_DIR` env var unset OR directory does not exist | `gh repo clone mindrian-os/mindrianos-install-site $HOME/mindrianos-install-site` (preferred, public bootstrap) OR `git clone <url> $HOME/mindrianos-install-site`. Plus the `--no-minisite` opt-out as an emergency-only alternative. |
| `MINISITE_DIR` exists but has no `origin` remote | `cd $HOME/mindrianos-install-site && git remote add origin <url> && git push -u origin main` (Test 6 recovery) |

The exact remote URL must be specified by the operator OR pulled from a documented constant (recommendation: `https://github.com/<TBD>/mindrianos-install-site.git` -- planner notes the URL is operator-supplied because the repo is not yet on GitHub; if the operator chooses to set it up, --bootstrap-minisite flag automates `gh repo create` + `git remote add`).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: End-to-end fixture for all 3 new gates</name>
  <files>tests/test-release-bump-tag-and-publish-gates.cjs</files>
  <read_first>
    - scripts/release.sh (current structure -- particularly the soft Step 9.6 minisite block at lines 433-517 that this plan replaces)
    - tests/test-release-bump-algebra.cjs (existing release.sh test pattern; how to mock $PLUGIN_DIR + $MARKETPLACE_DIR for sandboxed invocation)
    - tests/test-doctor-acceptance.cjs (DOCTOR_TEST_MODE pattern -- the analog for release.sh would be RELEASE_TEST_MODE + RELEASE_TEST_FAIL_POINT)
    - $HOME/mindrianos-install-site/lib/os.ts + app/page.tsx (the actual files to sed-fixture)
    - feedback_install_minisite_lockstep.md (the 7-place lockstep rule -- the test must verify all 3 new gates honor it)
  </read_first>
  <behavior>
    - Test 1 (tag-push gate -- happy path): mock a release scenario where `git tag v9.99.99` is created locally + push succeeds + `git ls-remote --tags origin` returns the tag. Step 5.5 PASSES.
    - Test 2 (tag-push gate -- push fails): mock a push failure (e.g., disconnected from network in the mock). Step 5.5 FAILS LOUD with actionable error. release.sh exits non-zero. NO tag exists at origin afterward (since push failed).
    - Test 3 (tag-push gate -- push succeeds but verify fails): rare race; mock `git push` succeeds but `git ls-remote --tags origin` does not show the tag within a verification window. Step 5.5 retries N times (recommended: 3 with 5s backoff) then FAILS LOUD. Settled in plan-phase: retry policy is 3 attempts with 5s between (operator can override via RELEASE_TAG_PUSH_RETRIES env).
    - Test 4 (install-minisite HARD -- happy path): sandbox a minisite fixture (mktemp dir; copy real ~/mindrianos-install-site/lib/os.ts + app/page.tsx into the sandbox; `git init` + commit initial state; add a fake `origin` remote pointing at a local bare repo `--mirror` clone). Set MINISITE_DIR=$SANDBOX. Set MINDRIAN_MINISITE_URL=http://127.0.0.1:<port> with a local HTTP mock server returning the NEW_VERSION in the body after 30s. Run release.sh against a release that triggers Step 9.6. Assert: lib/os.ts + app/page.tsx now contain NEW_VERSION; commit landed in sandbox; push to local mirror succeeded; live-poll returned within timeout; Step 9.6 PASSES.
    - Test 5 (install-minisite HARD -- MINISITE_DIR absent + no --no-minisite): unset MINISITE_DIR + MINDRIAN_INSTALL_SITE_DIR + ensure default $HOME/mindrianos-install-site does NOT exist (mock HOME to mktemp). Run release.sh WITHOUT --no-minisite. Assert release.sh exits non-zero with actionable error mentioning `--no-minisite` AND the `gh repo clone` / `git clone` recovery command. Assert the error message does NOT contain `git remote add origin` (that recovery is reserved for the separate origin-missing path in Test 6 -- different failure mode, different fix).
    - Test 6 (install-minisite HARD -- MINISITE_DIR set but origin remote missing): sandbox a minisite without an `origin` remote configured. Run release.sh. Assert: actionable error includes the exact `cd $MINISITE_DIR && git remote add origin <url>` recovery command (Open Question 7 settled). This is the ONLY failure mode where `git remote add origin` is the correct recovery.
    - Test 7 (install-minisite HARD -- sed succeeds but grep verify fails): inject a synthetic failure (e.g., set RELEASE_TEST_MINISITE_FAIL=grep) so post-sed grep does not find NEW_VERSION. Assert: rollback runs (lib/os.ts + app/page.tsx revert to pre-sed state); commit NOT made; Step 9.6 FAILS LOUD.
    - Test 8 (install-minisite HARD -- --no-minisite opt-out): set --no-minisite flag. Assert: Step 9.6 skips ENTIRELY; an audit line emits to stderr ("--no-minisite opt-out engaged at <timestamp>; install-minisite NOT bumped; manual sync required"); release.sh exits 0 (does not abort).
    - Test 9 (install-minisite HARD -- live-poll timeout): mock HTTP server NEVER returns NEW_VERSION. Assert: live-poll runs for the timeout duration (override via RELEASE_TEST_MINISITE_POLL_TIMEOUT_S=10 for test speed), then Step 9.6 FAILS LOUD with timeout message.
    - Test 10 (npx-publish self-test -- happy path): mock `npx @mindrian_os/install@<version>` via a fake `npx` shim on PATH that creates a marker file in the cwd + exits 0. Step 9.7 PASSES.
    - Test 11 (npx-publish self-test -- npx fails): mock npx shim exits 1. Step 9.7 FAILS LOUD. release.sh exits non-zero.
    - Test 12 (npx-publish self-test -- npx exits 0 but no scaffold): mock npx shim exits 0 but creates NO marker file in cwd. Step 9.7 FAILS LOUD with "expected scaffold marker not present".
    - Test 13 (--dry-run shows all 3 gates): run `release.sh --dry-run`. Assert output mentions "Step 5.5", "Step 9.6", "Step 9.7", and "Step 9.8" by name.
  </behavior>
  <action>
    Create `tests/test-release-bump-tag-and-publish-gates.cjs`. This is the most complex test in Phase 126. Use a layered approach:

    1. **Sandboxed plugin repo**: mktemp dir + git init + seed plugin.json/package.json at v9.99.98 (so release.sh can compute v9.99.99 as prerelease bump). Add a fake `origin` remote pointing at a local bare clone (`git clone --bare` of the sandbox). This lets `git push origin main --tags` succeed locally.

    2. **Sandboxed marketplace repo**: mktemp dir + git init + seed marketplace.json. Add a fake `origin` (local bare clone).

    3. **Sandboxed minisite repo**: mktemp dir + git init + copy `~/mindrianos-install-site/lib/os.ts` + `~/mindrianos-install-site/app/page.tsx` into <sandbox>/lib/ + <sandbox>/app/. Initial commit. Add `origin` as a local bare clone.

    4. **HTTP mock**: bind a local HTTP server on 127.0.0.1:<random-port> that returns a configurable response. Used for the live-poll test (the response can be controlled per test to return the version or NOT return it).

    5. **npx shim**: write a wrapper script `<sandbox>/bin/npx` that is invoked via PATH prepend. The shim's behavior is controlled by an env var (e.g., NPX_SHIM_MODE=ok|fail|no-scaffold).

    6. **Invoke release.sh** with PLUGIN_DIR + MARKETPLACE_DIR + MINISITE_DIR + MINDRIAN_MINISITE_URL overrides + RELEASE_TEST_MODE env vars (the plan adds these to release.sh in Task 2 -- the test asserts the behavior the implementation must provide).

    7. **Assertions per test**: spawnSync release.sh; capture exit + stdout + stderr; inspect sandbox state (file contents, commits, tags at origin via `git ls-remote --tags <bare-clone>`).

    8. **Cleanup**: fs.rmSync all sandboxes; close HTTP server; restore PATH.

    Implementation skeleton:
    ```javascript
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const http = require('http');
    const { spawnSync, execSync } = require('child_process');

    function makeSandbox() {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gates-'));
      const pluginDir = path.join(root, 'plugin');
      const marketplaceDir = path.join(root, 'marketplace');
      const minisiteDir = path.join(root, 'minisite');
      const bareRoot = path.join(root, 'bares');
      // ... git init + seed + bare-clone + remote-add ...
      return { root, pluginDir, marketplaceDir, minisiteDir, bareRoot };
    }

    function startMockMinisiteServer(versionInBody) {
      const server = http.createServer(function (req, res) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>' + (versionInBody || '') + '</body></html>');
      });
      return new Promise(function (resolve) {
        server.listen(0, '127.0.0.1', function () {
          const port = server.address().port;
          resolve({ server, url: 'http://127.0.0.1:' + port + '/' });
        });
      });
    }

    function makeNpxShim(sandboxRoot, mode) {
      const binDir = path.join(sandboxRoot, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      const shimPath = path.join(binDir, 'npx');
      let content;
      if (mode === 'ok') {
        content = '#!/bin/bash\ntouch "$PWD/.mindrian-scaffold-marker"\nexit 0\n';
      } else if (mode === 'fail') {
        content = '#!/bin/bash\nexit 1\n';
      } else { // no-scaffold
        content = '#!/bin/bash\nexit 0\n';
      }
      fs.writeFileSync(shimPath, content, { mode: 0o755 });
      return binDir;
    }

    // ... 13 sub-tests ...
    ```

    Wire into tests/run-all-126.sh as a CJS suite entry.

    Settled in plan-phase:
    - Open Question 1 (parallelism): Plan 04 is Wave 3. Doc deliverable runs in parallel within Wave 3 (Task 3 below).
    - Open Question 7 (origin remote missing): fail loud with exact recovery command; `--bootstrap-minisite` flag GATED to a separate explicit operator action (not the default release path).
    - Open Question 8 (live-poll URL configurability): MINDRIAN_MINISITE_URL env var, default `https://mindrianos-install-site.vercel.app/`.
    - Open Question 9 (sed regex robustness): line-anchored CONTENT-based pattern (reuse existing release.sh line 468 + 475 patterns); a minisite refactor that REMOVES the strings fails the grep verify (correct).
  </action>
  <verify>
    <automated>node tests/test-release-bump-tag-and-publish-gates.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-release-bump-tag-and-publish-gates.cjs` runs to completion
    - With the CURRENT release.sh (Step 9.6 soft-skip; no Step 5.5; no Step 9.7): Tests 1, 4, 5, 8, 10, 13 may pass; Tests 2, 3, 6, 7, 9, 11, 12 FAIL RED because the gates do not exist yet. Each RED is expected; turns GREEN when Task 2 lands.
    - File compiles cleanly: `node -c tests/test-release-bump-tag-and-publish-gates.cjs`
    - Wired in tests/run-all-126.sh
  </acceptance_criteria>
  <done>
    13-case end-to-end test exists. Uses sandboxed plugin + marketplace + minisite + HTTP mock + npx shim. RED on missing gates; GREEN after Task 2.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement 3 new release.sh gates + --no-minisite flag + env vars</name>
  <files>scripts/release.sh, tests/test-doctor-acceptance-preflight-checks.cjs</files>
  <read_first>
    - tests/test-release-bump-tag-and-publish-gates.cjs (the 13-case contract from Task 1)
    - scripts/release.sh (current structure -- particularly lines 70-95 arg parsing, line 370 tag creation, lines 433-517 SOFT Step 9.6, line 612 push, lines 615-651 existing full --acceptance)
    - tests/test-doctor-acceptance-preflight-checks.cjs (Plan 05 Wave 2 fixture; Plan 04 Wave 3 patches its Entry 4 `expectedSteps` array to absorb the rename + new steps)
    - tests/test-doctor-acceptance.cjs (existing Step 9.6 references at lines 28, 277, 280, 281 -- these MUST be updated for the 9.6 -> 9.8 rename because they assert `Step 9.6:` in the doctor --acceptance context; the new Step 9.6 in release.sh is the minisite block, not the --acceptance block)
  </read_first>
  <behavior>
    - Implementation-only task: the test contract lives in Task 1. This task lands the production code that makes Task 1 GREEN. No new behavioral surface beyond what Task 1 asserts.
    - One additional load-bearing edit: patch `tests/test-doctor-acceptance-preflight-checks.cjs` Entry 4 `expectedSteps` array to cover the rename + new steps (without this patch, Plan 05's acceptance gate silently drops verification of three release.sh steps).
  </behavior>
  <action>
    - **Arg parsing** (lines 79-95): add `--no-minisite` flag. Initialize `NO_MINISITE=0`. Case branch: `--no-minisite) NO_MINISITE=1 ;;`.
    - **Step 5.5 (tag-push verification)**: AFTER existing Step 9 (line 612 `git push origin main --tags`), insert a new sub-step that verifies the tag is at origin. Hard-abort if not. Retry policy: 3 attempts with 5s sleep between, configurable via RELEASE_TAG_PUSH_RETRIES env var. (NOTE: numbering -- "Step 5.5" is the CONTEXT.md name for this gate; in the actual release.sh sequence it lives AFTER the push at line 612. The name is symbolic, not positional. Document this with a comment block: `# --- Step 5.5 (tag-push verification): runs AFTER Step 9 push; named 5.5 per CONTEXT.md Plan 04 spec. ---`).

      Bash skeleton (placement: insert between current line 613 and line 615):
      ```bash
      # --- Step 5.5 (tag-push verification): runs AFTER Step 9 push; named 5.5 per CONTEXT.md Plan 04 spec. ---
      # Closes the 2026-05-13 dogfood asymmetry where the local tag was assumed to be at origin.
      # Retry policy: RELEASE_TAG_PUSH_RETRIES attempts (default 3), 5s backoff. Set SKIP_TAG_VERIFY=1 to bypass (NOT recommended).
      echo ""
      echo "=== Step 5.5: Verify tag v$NEW_VERSION is at origin ==="

      if [ "${SKIP_TAG_VERIFY:-0}" = "1" ]; then
        echo -e "${YELLOW}  ! SKIP_TAG_VERIFY=1 -- skipping tag-push verification (audit-logged)${NC}" >&2
      else
        TAG_PUSH_RETRIES="${RELEASE_TAG_PUSH_RETRIES:-3}"
        TAG_PUSH_BACKOFF_S="${RELEASE_TAG_PUSH_BACKOFF_S:-5}"
        ATTEMPT=1
        TAG_VERIFIED=0
        while [ "$ATTEMPT" -le "$TAG_PUSH_RETRIES" ]; do
          if git ls-remote --tags origin 2>/dev/null | grep -q "refs/tags/v$NEW_VERSION$"; then
            TAG_VERIFIED=1
            echo -e "${GREEN}  ✓ tag v$NEW_VERSION verified at origin (attempt $ATTEMPT/$TAG_PUSH_RETRIES)${NC}"
            break
          fi
          if [ "$ATTEMPT" -lt "$TAG_PUSH_RETRIES" ]; then
            echo "  ... tag not yet visible at origin; retry $((ATTEMPT+1))/$TAG_PUSH_RETRIES in ${TAG_PUSH_BACKOFF_S}s"
            sleep "$TAG_PUSH_BACKOFF_S"
          fi
          ATTEMPT=$((ATTEMPT+1))
        done
        if [ "$TAG_VERIFIED" != "1" ]; then
          echo -e "${RED}  x tag v$NEW_VERSION NOT visible at origin after $TAG_PUSH_RETRIES attempts${NC}"
          echo "    Investigate: git ls-remote --tags origin | grep v$NEW_VERSION"
          echo "    Recovery: git push origin v$NEW_VERSION (push the tag explicitly)"
          exit 1
        fi
      fi
      ```

    - **Step 9.6 HARD (install-minisite lockstep)**: REPLACE the existing soft block (lines 433-517) with the HARD implementation. Behavior:
      ```bash
      # --- Step 9.6: Sync install minisite to NEW_VERSION (HARD 7-place lockstep) ---
      # feedback_install_minisite_lockstep.md (2026-05-14): promoted from Soft to HARD.
      # No silent skip. MINISITE_DIR resolution + git push (NOT vercel CLI) +
      # post-push live-poll. `--no-minisite` opt-out audit-logged.
      echo ""
      echo "=== Step 9.6: Sync install minisite to v$NEW_VERSION (HARD lockstep) ==="

      if [ "$NO_MINISITE" = "1" ]; then
        echo -e "${YELLOW}  ! --no-minisite opt-out engaged at $(date -Iseconds); install-minisite NOT bumped.${NC}" >&2
        echo "    Manual sync required after release. Audit logged."
      else
        MINISITE_DIR="${MINDRIAN_INSTALL_SITE_DIR:-${MINDRIAN_MINISITE_DIR:-$HOME/mindrianos-install-site}}"
        MINISITE_URL="${MINDRIAN_MINISITE_URL:-https://mindrianos-install-site.vercel.app/}"
        MINISITE_POLL_TIMEOUT="${MINDRIAN_MINISITE_POLL_TIMEOUT_S:-180}"
        MINISITE_POLL_INTERVAL="${MINDRIAN_MINISITE_POLL_INTERVAL_S:-10}"

        if [ ! -d "$MINISITE_DIR" ]; then
          # MINISITE_DIR-absent path: the directory does not exist at all.
          # Recovery is to CLONE the repo, NOT to add a remote (no working tree yet).
          # The `git remote add origin` recovery is reserved for the separate
          # origin-missing path below (directory exists but lacks remote).
          echo -e "${RED}  x MINISITE_DIR not present: $MINISITE_DIR${NC}"
          echo "    Recovery options:"
          echo "      A) Clone the minisite: gh repo clone mindrian-os/mindrianos-install-site $MINISITE_DIR"
          echo "         (or: git clone <git-url> $MINISITE_DIR)"
          echo "      B) Set MINDRIAN_MINISITE_DIR to your existing minisite checkout path and re-run."
          echo "      C) If this release truly cannot bump the minisite, pass --no-minisite (audit-logged)."
          exit 1
        fi

        if [ "$DRY_RUN" = "1" ]; then
          echo "  [DRY RUN] would HARD-bump v$NEW_VERSION in: $MINISITE_DIR/lib/os.ts + app/page.tsx"
          echo "  [DRY RUN] would git commit + git push origin main + live-poll $MINISITE_URL"
        else
          ORIG_DIR="$PWD"
          cd "$MINISITE_DIR"

          # Origin remote check (Open Question 7 settled: separate failure mode from MINISITE_DIR-absent).
          # This is the ONLY path where `git remote add origin` is the correct recovery.
          if ! git remote get-url origin >/dev/null 2>&1; then
            echo -e "${RED}  x $MINISITE_DIR has no 'origin' remote configured.${NC}"
            echo "    Recovery: cd $MINISITE_DIR && git remote add origin <git-url> && git push -u origin main"
            echo "              (e.g., git remote add origin git@github.com:mindrian-os/mindrianos-install-site.git)"
            echo "    Or pass --no-minisite for an emergency release (audit-logged)."
            cd "$ORIG_DIR"
            exit 1
          fi

          # Snapshot pre-sed state for rollback
          cp lib/os.ts lib/os.ts.bak
          cp app/page.tsx app/page.tsx.bak

          # Line-anchored CONTENT-based sed (Open Question 9 settled; reused from prior soft block)
          sed -i -E "s@MindrianOS v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc|next)\.[0-9]+)?@MindrianOS v$NEW_VERSION@g" lib/os.ts || {
            echo -e "${RED}  x sed on lib/os.ts failed${NC}"
            mv lib/os.ts.bak lib/os.ts; mv app/page.tsx.bak app/page.tsx
            cd "$ORIG_DIR"; exit 1
          }
          sed -i -E "s@v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc|next)\.[0-9]+)? · Install@v$NEW_VERSION · Install@g" app/page.tsx || {
            echo -e "${RED}  x sed on app/page.tsx failed${NC}"
            mv lib/os.ts.bak lib/os.ts; mv app/page.tsx.bak app/page.tsx
            cd "$ORIG_DIR"; exit 1
          }

          # Grep verify: BOTH files must contain NEW_VERSION; if not, rollback.
          if ! grep -q "v$NEW_VERSION" lib/os.ts || ! grep -q "v$NEW_VERSION" app/page.tsx; then
            echo -e "${RED}  x minisite bump verification failed (NEW_VERSION not present after sed); rolling back.${NC}"
            mv lib/os.ts.bak lib/os.ts; mv app/page.tsx.bak app/page.tsx
            cd "$ORIG_DIR"; exit 1
          fi
          # Verify succeeded: drop the .bak files.
          rm -f lib/os.ts.bak app/page.tsx.bak

          # Commit + push
          git add lib/os.ts app/page.tsx
          if git diff --cached --quiet; then
            echo "  -> minisite already at v$NEW_VERSION (no changes; will still verify live-poll)"
          else
            git commit --no-verify -m "chore: sync minisite version strings to v$NEW_VERSION" >/dev/null 2>&1 || {
              echo -e "${RED}  x minisite commit failed${NC}"; cd "$ORIG_DIR"; exit 1
            }
          fi
          git push origin main 2>&1 || {
            echo -e "${RED}  x minisite git push origin main failed${NC}"
            echo "    The bump commit is LOCAL but not pushed. Recover manually: cd $MINISITE_DIR && git push origin main"
            cd "$ORIG_DIR"; exit 1
          }
          echo "  -> minisite pushed: Vercel auto-deploy triggered"

          # Live-poll until NEW_VERSION appears in HTTP body OR timeout
          echo "  -> live-poll $MINISITE_URL for v$NEW_VERSION (timeout ${MINISITE_POLL_TIMEOUT}s, interval ${MINISITE_POLL_INTERVAL}s)"
          POLL_START=$(date +%s)
          POLL_OK=0
          while true; do
            NOW=$(date +%s)
            ELAPSED=$((NOW - POLL_START))
            if [ "$ELAPSED" -ge "$MINISITE_POLL_TIMEOUT" ]; then
              echo -e "${RED}  x live-poll timed out after ${ELAPSED}s -- $MINISITE_URL does not reflect v$NEW_VERSION${NC}"
              echo "    Investigate: curl -sS $MINISITE_URL | grep -F v$NEW_VERSION"
              echo "    The push landed but Vercel may not have built yet. Re-run release.sh with --no-minisite if urgent."
              cd "$ORIG_DIR"; exit 1
            fi
            BODY=$(curl -sS -m 5 "$MINISITE_URL" 2>/dev/null || true)
            if echo "$BODY" | grep -qF "v$NEW_VERSION"; then
              POLL_OK=1
              break
            fi
            sleep "$MINISITE_POLL_INTERVAL"
          done

          if [ "$POLL_OK" = "1" ]; then
            echo -e "${GREEN}  ✓ minisite live: $MINISITE_URL serves v$NEW_VERSION (live-poll passed in ${ELAPSED}s)${NC}"
          fi

          cd "$ORIG_DIR"
        fi
      fi
      ```
    - **Step 9.7 (npx-publish self-test)**: INSERT between the HARD Step 9.6 above AND the existing full --acceptance Step (renamed to Step 9.8). Behavior:
      ```bash
      # --- Step 9.7: npx-publish self-test (Phase 126 Plan 04) ---
      # Verify npx @mindrian_os/install@<version> against a fresh temp dir
      # produces an exit-0 scaffold. Closes the dogfood "npx round-trip broken (null)" gap.
      echo ""
      echo "=== Step 9.7: npx-publish self-test ==="

      if [ "${MOS_TEST_DRY_RUN:-0}" = "1" ] || [ "$DRY_RUN" = "1" ]; then
        echo "  [DRY RUN] would run: npx @mindrian_os/install@$NEW_VERSION against a temp dir"
      else
        NPX_TEST_DIR="$(mktemp -d -t mos-npx-selftest-XXXXXX)"
        echo "  -> sandbox: $NPX_TEST_DIR"
        cd "$NPX_TEST_DIR"
        if npx --yes "@mindrian_os/install@$NEW_VERSION" 2>&1 | tee /tmp/npx-selftest-out.log; then
          # Check for an expected scaffold marker. The exact marker depends on what
          # @mindrian_os/install creates; minimum-surface check: SOMETHING new exists in cwd.
          if [ -z "$(ls -A "$NPX_TEST_DIR" 2>/dev/null)" ]; then
            echo -e "${RED}  x npx exited 0 but produced no scaffold in $NPX_TEST_DIR${NC}"
            cd "$PLUGIN_DIR"; rm -rf "$NPX_TEST_DIR"; exit 1
          fi
          echo -e "${GREEN}  ✓ npx scaffold verified${NC}"
        else
          echo -e "${RED}  x npx @mindrian_os/install@$NEW_VERSION failed${NC}"
          cd "$PLUGIN_DIR"; rm -rf "$NPX_TEST_DIR"; exit 1
        fi
        cd "$PLUGIN_DIR"
        rm -rf "$NPX_TEST_DIR"
      fi
      ```
    - **Step 9.8 (renamed existing Step 9.6 full --acceptance)**: keep existing block content unchanged; UPDATE the comment header + echo line to read `Step 9.8` (resolving the numbering collision). Specifically:
      - `scripts/release.sh` line 615: change `# --- Step 9.6: doctor --acceptance (full, HARD ABORT, no --allow) ---` to `# --- Step 9.8: doctor --acceptance (full, HARD ABORT, no --allow) ---`
      - `scripts/release.sh` line 636: change `#   R.4  Step 9.6 fail (this gate): YANK + cut successor + NOTIFY` to `#   R.4  Step 9.8 fail (this gate): YANK + cut successor + NOTIFY`
      - `scripts/release.sh` line 641: change `echo "=== Step 9.6: doctor --acceptance (full) ==="` to `echo "=== Step 9.8: doctor --acceptance (full) ==="`
      - `scripts/release.sh` line 208 (--dry-run output): change `echo "  Step 9.6  : run full mindrian-os doctor --acceptance ..."` to `echo "  Step 9.8  : run full mindrian-os doctor --acceptance ..."` AND add new lines for Step 5.5, Step 9.6 (minisite), Step 9.7 (npx self-test) -- see next bullet.
    - **--dry-run output (lines 184-215)**: extend with new step names. Add lines mentioning "Step 5.5" (tag-push verify), "Step 9.6" (minisite HARD), "Step 9.7" (npx self-test), "Step 9.8" (full --acceptance, renamed from the old 9.6).
    - **Usage block (line 77)**: update USAGE_BLOCK to include `[--no-minisite]`.
    - **Patch `tests/test-doctor-acceptance-preflight-checks.cjs` Entry 4 `expectedSteps` array**: Plan 05 (Wave 2) scaffolds the fixture with `expectedSteps = ['Step 2','Step 3','Step 4','Step 5','Step 5b','Step 6','Step 6.5','Step 6.6','Step 7','Step 9.5','Step 9.6']`. Plan 04 (Wave 3) MUST patch this array to absorb the rename + new steps. The patched array, in canonical order:
      ```javascript
      const expectedSteps = ['Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 5b', 'Step 5.5', 'Step 6', 'Step 6.5', 'Step 6.6', 'Step 7', 'Step 9.5', 'Step 9.6', 'Step 9.7', 'Step 9.8'];
      ```
      Open `tests/test-doctor-acceptance-preflight-checks.cjs`, locate Entry 4 (`id: 'release-dry-run-output'`), find the `expectedSteps` array declaration, and replace it with the array above. This is a one-line change but a load-bearing one -- without it the acceptance gate silently drops verification of three release.sh steps (Step 5.5, Step 9.7, Step 9.8) and continues to assert the old `Step 9.6` semantics (which is now the minisite step, not the --acceptance step it was originally checking).
    - **Update `tests/test-doctor-acceptance.cjs`** for the Step 9.6 -> 9.8 rename. The existing file (verified 2026-05-14) has Step 9.6 references at:
      - Line 28 (comment block describing the test): `Step 9.5, Step 9.6; assert ordering AND that both literal` -- update to `Step 9.5, Step 9.8` (this test specifically checks the doctor --acceptance ordering after Step 9.5 npm publish; the assertion is about the full --acceptance block, which is now Step 9.8).
      - Line 277: `const off96 = findOffset('Step 9.6:');` -- rename variable to `off98` and update the literal to `'Step 9.8:'`.
      - Lines 280-281: update both assertion messages and the variable references (`off96` -> `off98`) for the renamed step.

    Workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.

    Settled in plan-phase:
    - The numbering collision between the existing two Step 9.6's is resolved by RENAMING the second one to Step 9.8 in this plan; new Step 9.7 sits between them.
    - The HARD Step 9.6 REPLACES the soft-skip block at lines 433-517. The replacement is a wholesale rewrite of that block, not an extension.
    - The minisite repo at /home/jsagi/mindrianos-install-site has no origin -- the first time this gate fires on the dev box, it will fail loud with the recovery command. The operator runs `git remote add origin <url> + git push -u origin main` once (one-time bootstrap), then subsequent releases sail through. This is INTENTIONAL per Open Question 7 option (b).
    - The MINISITE_DIR-absent path and the origin-missing path are DISTINCT failure modes with DIFFERENT recoveries. The MINISITE_DIR-absent path recovers via `gh repo clone` / `git clone` (no working tree exists yet); the origin-missing path recovers via `git remote add origin <url>` (working tree exists but lacks remote). Each error message MUST emit only the recovery that applies to its failure mode -- crossing the two would mislead the operator.
  </action>
  <verify>
    <automated>bash -n scripts/release.sh && node tests/test-release-bump-tag-and-publish-gates.cjs && bash scripts/release.sh --dry-run | grep -E "Step 5\\.5|Step 9\\.6|Step 9\\.7|Step 9\\.8|--no-minisite"</automated>
  </verify>
  <acceptance_criteria>
    - `bash -n scripts/release.sh` exits 0 (syntactically valid bash)
    - `node tests/test-release-bump-tag-and-publish-gates.cjs` exits 0 (all 13 sub-tests GREEN)
    - `bash scripts/release.sh --dry-run` output contains all FOUR step names (Step 5.5, Step 9.6, Step 9.7, Step 9.8) + `--no-minisite` mention
    - `grep -c "Step 5.5\\|Step 9.7\\|Step 9.8\\|--no-minisite\\|MINDRIAN_MINISITE_URL" scripts/release.sh` returns >= 5
    - Step 9.6 -> Step 9.8 rename does NOT leave stale references. Affected test files are explicitly enumerated:
      - `tests/test-doctor-acceptance.cjs` (lines 28, 277, 280, 281 -- the doctor --acceptance ordering check; was asserting the old `Step 9.6:` literal which referred to the full --acceptance block, now renamed to `Step 9.8:`). Update both the literal strings AND the variable names (`off96` -> `off98`).
      - `tests/test-doctor-acceptance-preflight-checks.cjs` Entry 4 `expectedSteps` array (Plan 05 fixture; Plan 04 patches it per the bullet above to add Step 5.5/9.7/9.8 and accommodate the rename).
    - Verify there are NO remaining `Step 9.6` references in the `--acceptance` context after the rename:
      ```bash
      # No remaining references to old Step 9.6 in --acceptance context (must equal 0)
      grep -rn "Step 9.6" scripts/ tests/ | grep -v "minisite" | grep -v "Sync install" | wc -l   # expected: 0
      ```
      The grep excludes references to the NEW Step 9.6 (the install-minisite block). Any non-minisite reference to `Step 9.6` after the rename is a stale reference that must be updated to `Step 9.8`.
    - MINISITE_DIR-absent path emits the clone recovery, NOT the remote-add recovery:
      ```bash
      # MINISITE_DIR-absent path emits the clone recovery (must succeed with at least one match)
      MINDRIAN_MINISITE_DIR=/nonexistent-path-test ./scripts/release.sh --prerelease 2>&1 | grep -E "gh repo clone|git clone .* mindrianos-install-site"
      # AND must NOT contain 'git remote add origin' when MINISITE_DIR is absent (must equal 0):
      MINDRIAN_MINISITE_DIR=/nonexistent-path-test ./scripts/release.sh --prerelease 2>&1 | grep -c "git remote add origin"
      ```
      (Run in a sandbox where the absent-MINISITE_DIR path fires before any destructive step. Test 5 in Task 1's fixture covers this assertion in isolation.)
    - Existing tests/run-all-123.sh continues to pass: confirm by running `bash tests/run-all-123.sh` after the patches above (the rename touches `test-doctor-acceptance.cjs`; updating its literals + variable names preserves the assertion intent because the full --acceptance block now lives at Step 9.8).
    - Live: against dev workspace with NO origin on the minisite, `bash scripts/release.sh --prerelease --dry-run` succeeds (dry-run doesn't trigger the network checks). A real `bash scripts/release.sh --prerelease` would fail at the origin-check + emit the recovery command (expected on first run).
  </acceptance_criteria>
  <done>
    Step 5.5 / 9.6 HARD / 9.7 implemented. Step 9.8 renamed from old 9.6. --no-minisite flag wired. MINDRIAN_MINISITE_URL env var honored. 13-case test GREEN. --dry-run mentions the new gates. Plan 05's `expectedSteps` array patched to cover Step 5.5 / 9.7 / 9.8 and absorb the 9.6 -> 9.8 rename. `tests/test-doctor-acceptance.cjs` ordering check updated for the rename. No regression in Phase 123 release-bump-algebra test (the bump arithmetic is unchanged).
  </done>
</task>

<task type="auto">
  <name>Task 3: Author docs/install-cache-family-premortem.md (the D4 deliverable, in parallel)</name>
  <files>docs/install-cache-family-premortem.md</files>
  <read_first>
    - docs/CANON-PHASE-MAP.md Part 6 row (the family of install-cache cases as already mapped)
    - docs/autopsies/2026-04-13-wrong-workspace-incident.md (case #1)
    - docs/autopsies/2026-04-28-install-cache-drift-incident.md (case #2)
    - docs/autopsies/2026-05-06-install-dir-missing-incident.md (case #3)
    - CONTEXT.md D4 (4 sections, ~50-80 lines, doc-only)
    - feedback_install_minisite_lockstep.md (the 2026-05-14 promotion to HARD -- one of the predicted-next-defenses already shipped this phase)
  </read_first>
  <action>
    Create `docs/install-cache-family-premortem.md`. Strictly ~50-80 lines, 4 sections per D4:

    **Section 1: Family history (table of 6 cases).** One row per case:
    | # | Case | Year-month | Phase | The single defense added |
    |---|------|-----------|-------|--------------------------|
    | 1 | Wrong-workspace incident | 2026-04 | Phase 93 antecedent | Workspace guard in session-start + CLAUDE.md hard rule |
    | 2 | Install-cache drift | 2026-04 | Phase 93 | /mos:doctor drift detection |
    | 3 | Install-dir missing | 2026-05 | Phase 95.2 | Atomic-swap recovery + session-start preflight |
    | 4 | Windows MAX_PATH + skill-loop | 2026-05 | Phase 95.6 | Windows MAX_PATH guard + npm-installer reserved-name compliance |
    | 5 | Phase 123 release-cut hot-patches | 2026-05 | Phase 123 ship | 5 manual hot-patches applied during cut (absorbed into doctor --acceptance in Phase 126 Plan 05) |
    | 6 | Windows dogfood + install-minisite stale | 2026-05 | Phase 126 (THIS phase) | renderer contract test + semver prerelease pick + tag-push verify + install-minisite HARD lockstep + npx self-test + schema v2 migration + acceptance self-coverage |

    **Section 2: Pattern across cases.** Two paragraphs:
    1. The shape: each case shares a SURFACE with a prior case but defeats the single guard added there. Example: Phase 95.2 added atomic-swap recovery (case #3 defense); Phase 126 found the recovery WORKED but recovered to the wrong version (case #6's semver-pick bug). Each new case is "the guard works AT its surface but the failure mode shifted to a new surface that the guard does not cover."
    2. The implication: ONE defense per case is the steady-state. Adding multiple defenses per case (chaos engineering, property-based testing) was considered + rejected per D4 (wrong shape for Path D). The cadence is acceptable IF each case's defense is comprehensive AT its surface.

    **Section 3: Predicted next 3-5 failure modes (each one paragraph + the missing defense).**

    Recommended predictions (planner draft; executor refines based on actual case-by-case patterns):

    - **Prediction A: install-minisite drift across non-dev maintainer machines.** Phase 126 Plan 04 HARD-enforced the bump on the dev box. But if a different operator's machine has MINISITE_DIR set to a stale checkout, the bump goes against a stale tree. Missing defense: minisite checkout must be re-fetched + clean-tree-verified BEFORE the sed/commit. Future phase: extend Step 9.6 with `git fetch origin && git reset --hard origin/main` as the first action (after the origin-check).

    - **Prediction B: schema v3 evolution -- v2 install-state.json drifts again.** Plan 07 shipped v2. The next field addition (e.g., Plan 04's renderer_contract_version cross-check + Plan 03's last_acceptance_run) will require v3. Missing defense: schema_version comparison currently uses integer equality; v3 will exercise the future-version path against ANY v3-aware install rolling back to a v2 plugin. Future phase: explicit downgrade-rejection path with operator escalation + (optionally) the migration framework being made bidirectional with explicit field-deletion fences.

    - **Prediction C: env-var-driven config drift (MOS_CACHE_PRUNE_AGE_DAYS, MINDRIAN_MINISITE_URL, MINDRIAN_MINISITE_POLL_TIMEOUT_S).** Plan 04 + Plan 06 added 3+ env vars without an audit surface. Missing defense: doctor --acceptance should snapshot the env vars present at release time + persist into install-state.json + warn on next session if values differ. Future phase: env-vars-of-record class K (extending the A-J roster).

    - **Prediction D: live-poll false-positive (200 OK with stale content from a cached CDN edge).** Plan 04 polls until NEW_VERSION appears in body. If Vercel's CDN serves the OLD version from edge cache for several minutes, the live-poll could time out OR (worse) return false-success if a different edge returns NEW_VERSION while the canonical edge still serves OLD. Missing defense: poll multiple geographic edges OR add a cache-buster query param. Future phase: extend live-poll with `?_cb=<timestamp>` + assertion across 3 geo-distributed pings.

    - **Prediction E: the canonical replacement of hardcoded version strings (build-time fetch).** The memory rule `feedback_install_minisite_lockstep.md` already names this: "replace hardcoded strings with NEXT_PUBLIC_MINDRIAN_VERSION env var OR build-time npm-registry fetch." This is the FUNDAMENTAL fix that retires the entire Plan 04 Step 9.6 surface. Future phase (v1.14.0+): deploy the env-var-driven minisite + retire Step 9.6 entirely. The pre-mortem PREDICTS this defense will land within 2 milestones.

    **Section 4: Revisit cadence.** One paragraph:
    "Revisit at every install-cache failure surface OR at every v1.X.0 milestone audit gate, whichever comes first. The table in Section 1 is the canonical record; appending a row IS the revisit. Cross-link from CANON-PHASE-MAP.md Part 6 row so the map points at this doc."

    Add to `docs/CANON-PHASE-MAP.md` Part 6 row: a new entry under Phase 126 mentioning the pre-mortem doc.

    Workspace guard: edits run from /home/jsagi/MindrianOS-Plugin/.

    Settled in plan-phase: Task 3 runs IN PARALLEL with Task 1 + Task 2 within Wave 3. Zero code overlap. Executor can land Task 3's doc commit while Task 1 + Task 2 are still being implemented.
  </action>
  <verify>
    <automated>test -f docs/install-cache-family-premortem.md && wc -l docs/install-cache-family-premortem.md</automated>
  </verify>
  <acceptance_criteria>
    - `docs/install-cache-family-premortem.md` exists
    - Line count is in range ~50-100 (the upper bound is loose; the doc should NOT bloat past 100 lines)
    - Contains all 4 required sections (Family history table, Pattern, Predicted failure modes, Revisit cadence)
    - Section 1 table has at least 6 rows (one per case)
    - Section 3 has at least 3 predicted failure modes (target 5)
    - `docs/CANON-PHASE-MAP.md` Part 6 row updated to mention the pre-mortem doc
  </acceptance_criteria>
  <done>
    Pre-mortem doc shipped. CANON-PHASE-MAP cross-link in place. Doc-only deliverable; zero technical risk.
  </done>
</task>

</tasks>

<verification>
- `bash -n scripts/release.sh` exits 0
- `node tests/test-release-bump-tag-and-publish-gates.cjs` passes all 13 sub-tests
- `bash scripts/release.sh --dry-run` output contains Step 5.5 / 9.6 / 9.7 / 9.8 / --no-minisite
- `bash tests/run-all-123.sh` passes (regression guard: tests/test-release-bump-algebra.cjs + test-doctor-acceptance.cjs continue to pass; the rename of the doctor --acceptance ordering check from Step 9.6 -> Step 9.8 preserves the assertion intent)
- `bash tests/run-all-126.sh` includes this test suite and passes
- `docs/install-cache-family-premortem.md` exists with the 4 required sections
- Live smoke (cautious): a `bash scripts/release.sh --prerelease --dry-run` on the dev box runs to completion + shows the new gates
- Real release smoke (when the next beta cuts): the first run will fail at minisite origin-check (no origin on /home/jsagi/mindrianos-install-site); operator runs `git remote add origin <url> + git push -u origin main` once; next run succeeds
</verification>

<success_criteria>
- All must_haves satisfied
- Plan 04 acceptance criteria from CONTEXT.md "Acceptance Criteria (Nyquist UAT)" block all pass:
  - tests/test-release-bump-tag-and-publish-gates.cjs passes
  - release.sh Step 5.5 refuses to proceed if tag-push fails
  - release.sh Step 9.6 rewrites lib/os.ts + app/page.tsx in MINISITE_DIR (grep verification before commit)
  - release.sh Step 9.6 commits + git push origin main; failure refuses to declare release success
  - release.sh Step 9.6 polls MINDRIAN_MINISITE_URL for new version within timeout; failure refuses to declare release success
  - release.sh --no-minisite opt-out works + is logged (no silent skip)
  - release.sh Step 9.7 refuses to declare success if npx-publish self-test fails
  - Dry-run mode shows all THREE new gates (Step 5.5, 9.6, 9.7) + the renamed Step 9.8
  - If MINISITE_DIR is unset AND --no-minisite is not passed, release.sh fails with actionable error (the `gh repo clone` / `git clone` recovery, NOT `git remote add origin`)
- Pre-mortem doc acceptance criteria from CONTEXT.md:
  - docs/install-cache-family-premortem.md exists
  - Contains all 4 required sections
  - Linked from docs/CANON-PHASE-MAP.md Part 6 row
- No regression in Phase 123 release-bump-algebra test (test-doctor-acceptance.cjs literals + variable names updated for the 9.6 -> 9.8 rename; assertion intent preserved)
</success_criteria>

<output>
After completion, create `.planning/phases/126-install-lifecycle-harness-gaps/126-04-SUMMARY.md` covering:
- The 3 new release-pipeline gates (5.5 / 9.6-HARD / 9.7)
- The Step 9.6 numbering collision resolution (old 9.6 renamed to 9.8; new 9.7 between them)
- The 2 new env vars (MINDRIAN_MINISITE_URL + MINDRIAN_MINISITE_POLL_TIMEOUT_S) + MOS_CACHE_PRUNE_AGE_DAYS reused from Plan 06
- The --no-minisite opt-out audit-log behavior
- The 7-place lockstep contract fully enforced (CHANGELOG + plugin.json + package.json + npm-installer/package.json + git tag + marketplace.json ref + install-minisite)
- The family pre-mortem doc + its 5 predicted failure modes
- The first-run minisite-origin-bootstrap action (one-time operator gesture; subsequent releases sail through)
- The cross-plan `expectedSteps` patch in Plan 05's fixture (Task 2 final edit; load-bearing for acceptance gate coverage of Step 5.5 / 9.7 / 9.8)
- The two distinct minisite failure modes + their distinct recoveries (MINISITE_DIR-absent -> `gh repo clone`; origin-missing -> `git remote add origin`)
- Reference forward to v1.14.0+ "replace hardcoded version strings with build-time fetch" (Prediction E retires this gate's surface entirely)
</output>
</content>
</invoke>