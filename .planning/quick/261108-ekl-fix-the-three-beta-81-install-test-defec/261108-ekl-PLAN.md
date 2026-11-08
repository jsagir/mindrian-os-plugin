---
phase: quick-261108-ekl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/mos-status.cjs
  - lib/memory/mos-status-renderer.test.cjs
  - tests/test-261108-ekl-status-active-room.cjs
  - lib/core/doctor/shared.cjs
  - scripts/doctor.cjs
  - tests/test-261108-ekl-doctor-install-layout.cjs
  - tests/run-all-261108-ekl.sh
  - CHANGELOG.md
  - .planning/debug/beta-81-install-test-sweep.md
autonomous: true
requirements: [EKL-01, EKL-02, EKL-03, EKL-04]
canon_parts: [6, 7, 8]

must_haves:
  truths:
    - "From a folder that is not a room, /mos:status names the registry active room (PROVEN target: translational-capital-lab on this machine)"
    - "From $HOME, the legacy folder $HOME/room loses to the registry active room"
    - "Inside a room (a .room-root file or the 2-level ROOM.md layout), /mos:status still names that room, even when the registry names a different room"
    - "With no registry, the fixture cwd layout (sections with ROOM.md, no root ROOM.md) still resolves to the cwd"
    - "The status fix works with every CLAUDE_* env var removed (Tri-Polar: no CLI-only env var)"
    - "In an install layout, doctor --dogfood-acceptance prints SKIP for ACPT-01 to ACPT-06, counts 6 skipped and 0 failed, and exits 0"
    - "In an install layout, the 4 repo-only acceptance points print SKIP, count as skipped, and the run exits 0 when nothing else fails"
    - "In a repo checkout, the dogfood pass and the 4 acceptance points run as before and never print SKIP"
    - "The QA sweep file classifies every beta.81 install-test finding"
  artifacts:
    - path: "scripts/mos-status.cjs"
      provides: "resolveRoomRoot with the registry leg between the explicit marker walk and the legacy and fixture passes"
      contains: "resolve-active-room.cjs"
    - path: "tests/test-261108-ekl-status-active-room.cjs"
      provides: "status active-room regression test"
    - path: "lib/core/doctor/shared.cjs"
      provides: "detectPluginLayout(root), one layout detector, memoized per root"
      exports: ["detectPluginLayout"]
    - path: "scripts/doctor.cjs"
      provides: "install-layout SKIP for the dogfood pass and 4 repo-only acceptance points; SKIP tag and skipped count in both printers"
      exports: ["runDogfoodAcceptance", "runAcceptance", "pointTag"]
    - path: "tests/test-261108-ekl-doctor-install-layout.cjs"
      provides: "install-layout and repo-layout tests for doctor"
    - path: "tests/run-all-261108-ekl.sh"
      provides: "quick aggregator (precedent tests/run-all-261029-lcg.sh)"
    - path: ".planning/debug/beta-81-install-test-sweep.md"
      provides: "kind: qa-sweep report per docs/RCA-TEMPLATE.md"
      contains: "kind: qa-sweep"
  key_links:
    - from: "scripts/mos-status.cjs"
      to: "lib/core/resolve-active-room.cjs"
      via: "lazy require + resolveActiveRoom() inside resolveRoomRoot"
      pattern: "resolveActiveRoom\\("
    - from: "scripts/doctor.cjs"
      to: "lib/core/doctor/shared.cjs"
      via: "detectPluginLayout(pluginRoot) in runDogfoodAcceptance and buildAcceptanceChecklist"
      pattern: "detectPluginLayout\\("
    - from: "lib/core/doctor/shared.cjs"
      to: "hasOwnGitRoot"
      via: "the .git marker reuses the existing helper"
      pattern: "hasOwnGitRoot\\("
---

<objective>
Fix the three PROVEN beta.81 install-test defects and file the QA sweep.

1. /mos:status ignores the active room. scripts/mos-status.cjs::resolveRoomRoot guesses from process.cwd() only. From $HOME it prints "room: room". From the plugin folder it prints "room: 2.0.0-beta.81".
2. doctor --dogfood-acceptance prints FAIL 0/6 and exits 1 from an install, because the release does not ship tests/.
3. doctor --acceptance prints FAIL for 4 repo-only points from an install (version-of-record-published, verify-release-clean-tree, release-dry-run-output, cross-connection-honesty).

Purpose: an install must report the true active room and must not fail checks that need a repo checkout. A repo checkout keeps every gate blocking.
Output: 2 code fixes with tests, 1 quick aggregator, 2 CHANGELOG lines, 1 qa-sweep report.

Limits (all tasks):
- Do not add a Brain call. Do not add a network call. (Canon Part 8)
- Do not add a second registry reader. Reuse lib/core/resolve-active-room.cjs. (Canon Part 7)
- Do not use em-dashes or en-dashes. Use hyphens.
- Do not push. Do not use gsd-tools commit (it sweeps the whole index). Use `git add <paths>` then `git commit --only <paths>`.
- Run `git status --short` before each commit. Commit only the paths of the task. Do not revert a diff you do not own.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@docs/RCA-TEMPLATE.md
@scripts/mos-status.cjs
@lib/core/resolve-active-room.cjs
@scripts/resolve-room
@lib/core/doctor/verify-surface-module.cjs
@tests/test-380-status-parity.cjs

<interfaces>
Facts the executor needs. Line numbers are at HEAD 7fc10a417.

Status (task 1):
- scripts/mos-status.cjs lines 71 to 87: lazy requires (statuslineCache, folderMemory, navigation), each in try/catch.
- scripts/mos-status.cjs lines 119 to 185: resolveRoomRoot(cwd). Pass 1 walks up 6 hops. At each hop it checks (a) a .room-root file, (b) ROOM.md plus a non-dot subdir with ROOM.md, (c) a room/ subdir whose non-dot subdir has ROOM.md (the legacy layout). Pass 2 checks only cwd: any non-dot subdir with ROOM.md returns cwd.
- scripts/mos-status.cjs lines 627 to 660: main(). The --checks branch and the spine_read branch each call resolveRoomRoot, then fall back to navigation.detectActiveRoom().
- lib/core/resolve-active-room.cjs line 327: resolveActiveRoom(opts) returns {slug, abs_path} or null. It never throws. Precedence: CLAUDE_ACTIVE_ROOM env (an override only), then <MINDRIAN_ROOMS_HOME or HOME/MindrianRooms>/.rooms/registry.json field `active` (legacy `active_room` too). It honors sealed and archived marks, entry.abs_path, entry.path (absolute or relative to the rooms home), the Windows drive path mapping (Plan 386-44), and an exists-on-disk gate. This is the same registry read as Strategy 0 of scripts/resolve-room, which scripts/session-start line 103 calls.
- The live registry on this machine: active = translational-capital-lab, entry.path is absolute (/mnt/c/Users/jsagi/MindrianRooms/israel-frontier-criticality/translational-capital-lab). PROVEN.
- lib/memory/mos-status-renderer.test.cjs line 161: runRenderer(args, opts) spawns mos-status.cjs with Object.assign({}, process.env, o.env). Its fixture rooms (mkRoom at line 145) have sections with ROOM.md and no root ROOM.md, so they resolve only through pass 2. Its test 8 (line 449) expects "no active room" from an empty dir. With the real HOME, the new registry leg wins over pass 2 on a machine with a registry. So this test must isolate the registry.
- tests/test-129-read-surface-events.cjs uses a root ROOM.md plus a section ROOM.md (pass 1b). tests/test-365-portrait.cjs uses .room-root and sets MINDRIAN_ROOMS_HOME to an empty scratch home. Both stay unchanged.

Doctor (task 2):
- lib/core/doctor/shared.cjs line 474: hasOwnGitRoot(dir) returns true only when dir is the top of a git work tree (a .git dir, a .git file of a linked worktree, or git rev-parse --show-toplevel equal to dir). It is exported. In the install cache, which sits inside a HOME that is a git repo, it returns false. Reuse it for the .git marker.
- scripts/doctor.cjs line 826: buildAcceptanceChecklist(ctx) with ctx {home, pluginRoot, flagLightNpx, mode}. Points: version-of-record-published line 1002, verify-release-clean-tree line 1374, release-dry-run-output line 1471, cross-connection-honesty line 2201. Each point run() returns {ok, finding, detail}.
- The skip form that the acceptance points already use (DOCTOR_SKIP_CROSS_CONNECTION at line 2209): return { ok: true, finding: null, detail: { skipped: true, reason: '<text>' } }. The current printer shows it as PASS.
- The class D self-skip to copy: lib/core/doctor/verify-surface-module.cjs lines 44 to 49. When the dev harness file under tests/ is absent, check() returns status 'skip' with a detail reason. An install is never faulted for a missing dev harness. The acceptance and dogfood points carry the same meaning in their own result shape: the detail.skipped form above.
- scripts/doctor.cjs line 2387: runAcceptance(opts) with opts {home, pluginRoot, flagPreTag, flagPreFlight, flagSessionStart, onlyPoints, flagLightNpx}. Lines 2436 to 2457 build results, failed and summary {total, passed, failed, duration_ms, slowest}. Line 2443 writes the stderr progress line.
- scripts/doctor.cjs line 2485: ACPT_DRIVERS (6 entries). Line 2494: runDogfoodAcceptance(opts) with opts {pluginRoot}. It returns {gate, points, failed_points, summary {total, passed, failed}}.
- scripts/doctor.cjs lines 3705 to 3716: the acceptance printer. Lines 3786 to 3803: the dogfood printer. Both use tag = p.ok ? 'PASS' : 'FAIL'.
- scripts/doctor.cjs line 4772: module.exports. Line 4774: the require.main guard. The file is require-safe (tests/test-139-acceptance.cjs requires it).
- tests/run-all-224.sh, tests/run-all-355.sh and tests/run-all-3551.sh grep the last line that holds "failed:" and read the list after it with sed. Keep "; failed: a, b." as the last part of the roll-up line. Do not put the text "failed:" in a SKIP reason.
- release.sh Steps 2.5, 6.6 and 9.8 run "$PLUGIN_DIR/scripts/doctor.cjs" from the repo checkout. That checkout holds tests/, .git and scripts/release.sh, so the release gate stays blocking.
- tests/run-all-126.sh is the nearest suite that covers doctor --acceptance (self-coverage and preflight-checks).
</interfaces>

<evidence>
Measured by the main session on 2026-11-08 against the installed 2.0.0-beta.81 marketplace cache (no .git, no tests/, no scripts/release.sh). scripts/mos-status.cjs is byte-identical between the install and origin/main (PROVEN by diff). Task 3 copies these facts into the sweep.

Defect 1 (PROVEN). resolveRoomRoot(cwd) walks up 6 levels from process.cwd() for a .room-root file, a ROOM.md with a ROOM.md subdir, or a room/ subdir. Pass 2 returns cwd itself when any subdir has ROOM.md. It never reads the active-room registry. From inside the room it prints "room: translational-capital-lab, 15 sections, 15 filled, 5 stale". From /home/jsagi it prints "room: room" (the legacy folder /home/jsagi/room) with "(no MINTO yet)" rows. From the plugin dir it prints "room: 2.0.0-beta.81, 1 section, 0 filled". scripts/resolve-room from the same shells returned /mnt/c/Users/jsagi/MindrianRooms/israel-frontier-criticality/translational-capital-lab every time. commands/status.md runs node "${CLAUDE_PLUGIN_ROOT}/scripts/mos-status.cjs" $ARGUMENTS with no room argument.

Defect 2 (PROVEN). node scripts/doctor.cjs --dogfood-acceptance from the install printed FAIL for ACPT-01 to ACPT-06, each "driver missing: test-acpt-0N-<slug>.cjs", then "0/6 ACPT points passed", exit 1. The drivers live under tests/, which the release does not ship.

Defect 3 (PROVEN). node scripts/doctor.cjs --acceptance --light-npx from the install: 21/25. FAIL version-of-record-published ("git tag v2.0.0-beta.81 not found"). FAIL verify-release-clean-tree ("git status failed (exit 128)"). FAIL release-dry-run-output ("release.sh --dry-run exited 127"). FAIL cross-connection-honesty ("calibrate-citation-check.cjs --check exited 1", root: ENOENT tests/fixtures/355-citation-pairs.items.json). All 4 need a repo checkout.

Other measurements (PROVEN, for the sweep):
- doctor --all: 21 healthy, 8 drift, 0 warnings, 32 classes. Drift rows: mcp-surface (about 21918 tokens over the 8000 budget, measurement warning); mcp-write-path OFF (MINDRIAN_MCP_FIRST unset); ui-compliance 183 violations; deprecated-usage 6 commands in 7 days (/mos:query 988 times); room-md 46 dirs missing ROOM.md or MINTO.md; graph-derive-health (semantic encoder not installed, 2 of 58 rooms); room-map 8 drift findings; section-ruling 410 drift findings.
- brain-smoke: L0 to L5 PASS (origin theo-mcp.onrender.com, mode ok, sha eaaa6dd0, handshake mindrian-brain v2.0.0-beta.81). L6 FAIL: node_count 22436 below the floor 27000, GraphRagMeta refreshed 2026-10-16. Seeded as SEED-145 (.planning/seeds/SEED-145-theo-store-identity-floor-vs-live-node-count.md).
- ICM walk on translational-capital-lab: 28 nests, 11 of 11 core sections, identity 7 of 7 keys, 0 nests with every face, 25 of 35 face files without an edit-surface marker, duplications 0 of 3.
- bind-check: advisory "session not bound" (expected from a plain shell).
- resolve-room, help-renderer, room-question, claim-checks: answer correctly.
</evidence>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: /mos:status resolves the registry active room after the explicit marker walk (EKL-01)</name>
  <files>scripts/mos-status.cjs, lib/memory/mos-status-renderer.test.cjs, tests/test-261108-ekl-status-active-room.cjs, CHANGELOG.md</files>
  <behavior>
    - S1: cwd is an empty temp dir. A temp rooms home holds .rooms/registry.json with active "fixture-active" and an absolute path to a fixture room (root ROOM.md, section problem-definition/ROOM.md). The output holds "room: fixture-active".
    - S2: cwd is a temp dir with the legacy layout room/market-analysis/ROOM.md. The same registry exists. The output holds "room: fixture-active" and does not hold "room: room".
    - S2b: the same legacy cwd with no registry (the rooms home is an empty temp dir). The output holds "room: room" (the legacy fallback still works, as Strategy 2 of scripts/resolve-room).
    - S3: cwd is a second fixture room with a .room-root file. The same registry exists. The output names the cwd room, not fixture-active (the explicit marker wins).
    - S4: no registry (the rooms home is an empty temp dir). cwd is a fixture dir with sections that have ROOM.md and no root ROOM.md. The output holds "room: " plus the basename of cwd (the fixture pass still works).
    - S5: no registry. cwd is an empty temp dir. The output holds "no active room" and the exit code is 0.
    - S6: S1 again with every env key that starts with CLAUDE_ removed. The output holds "room: fixture-active" (Tri-Polar: no CLI-only env var).
    - S7: the source of scripts/mos-status.cjs requires resolve-active-room.cjs, and its non-comment lines do not hold the text registry.json (no second registry reader).
  </behavior>
  <action>
Step 1 (RED). Write tests/test-261108-ekl-status-active-room.cjs. Use CJS and Node built-ins only. Copy the check()/say() and spawnSync style of tests/test-380-status-parity.cjs. Make every fixture under fs.mkdtempSync(os.tmpdir()). Spawn process.execPath with scripts/mos-status.cjs and the leg cwd. For each spawn, set env HOME and USERPROFILE to a temp home, MINDRIAN_ROOMS_HOME to the leg rooms home, and CLAUDE_ACTIVE_ROOM to an empty string. Write the registry in the current shape: {version: 1, active: slug, rooms: {[slug]: {path: absPath, status: 'active'}}}. Implement legs S1, S2, S2b and S3 to S7 from the behavior block. Remove the scratch root at the end. Exit 1 on any failure. Run it. S1, S2 and S6 must fail now. Record the RED output.

Step 2 (GREEN). Edit scripts/mos-status.cjs, per the constraint from the main session (Canon Part 7, Canon Part 8).
- Add a lazy require of path.join(__dirname, '..', 'lib', 'core', 'resolve-active-room.cjs') beside the other lazy requires, in the same try/catch form. Name it activeRoomResolver.
- Split pass 1 of resolveRoomRoot into two walks. Walk A (first): walk up 6 hops and check only the .room-root file and the 2-level ROOM.md layout. Return the first hit.
- Registry leg (second): when walk A finds nothing, call activeRoomResolver.resolveActiveRoom(). When it returns an object with a string abs_path, return abs_path. Wrap the call in try/catch. A throw or a missing module falls through.
- Walk B (third): walk up 6 hops and check only the legacy room/ subdir layout. This is the order of scripts/resolve-room: the registry (Strategy 0) before the legacy room/ fallback (Strategy 2).
- Pass 2 (last): keep the fixture cwd pass unchanged.
- In main(), remove the two navigation.detectActiveRoom() fallbacks after resolveRoomRoot. resolveRoomRoot now carries the registry leg, so the file keeps one registry read path. Keep the navigation require, because emitSpineRead and renderChecks use it.
- Update the resolveRoomRoot doc comment. State the 4-step order and the reason: an explicit marker wins; the registry active room beats a cwd guess; the legacy room/ layout loses to the registry; the fixture pass stays for tests.
- Do not spawn scripts/resolve-room. A bash plus python3 spawn does not run on a Windows host without bash, and it costs startup time. resolveActiveRoom reads the same registry file and the same `active` field with the same home default.
- Do not read process.env.CLAUDE_CODE_SESSION_ID or any CLI-only env var. Do not add http, https, fetch or a Brain token (the existing test 9 of the renderer test greps for them).

Step 3. Edit lib/memory/mos-status-renderer.test.cjs. In runRenderer, create one empty rooms home with mkTmp('mos-status-rooms-home-') once at module scope. Merge {MINDRIAN_ROOMS_HOME: thatDir, CLAUDE_ACTIVE_ROOM: ''} into env before o.env. Add a one-line comment: the fixtures resolve through the cwd pass, so the test isolates the registry. Do not change any assertion.

Step 4. Add one line to CHANGELOG.md under "## [Unreleased] -- v2.0.0-beta.82 (in progress)". Create a "### Fixed" heading below the "### Added" block if it is absent. Text: "- **`/mos:status` now shows your active room from any folder.** It used to guess from the working folder, so from your home folder it showed an old `room` folder and from the plugin folder it showed the plugin itself. When the folder is not inside a room, it now uses the room you made active. <!-- 261108-ekl -->"

Step 5. Run the verify command before the commit (its em-dash check reads git diff HEAD). Then run git add on the new test, and git commit --only with the 4 paths. Message: "fix(261108-ekl): /mos:status resolves the registry active room outside a room". End the message with the attribution line of the executor session.
  </action>
  <verify>
    <automated>cd /home/jsagi/gsd-workspaces/status-active-room/MindrianOS-Plugin && node tests/test-261108-ekl-status-active-room.cjs && node lib/memory/mos-status-renderer.test.cjs && node tests/test-129-read-surface-events.cjs && node tests/test-365-portrait.cjs && (cd "$(mktemp -d)" && node /home/jsagi/gsd-workspaces/status-active-room/MindrianOS-Plugin/scripts/mos-status.cjs | head -1) && (cd "$HOME" && node /home/jsagi/gsd-workspaces/status-active-room/MindrianOS-Plugin/scripts/mos-status.cjs | head -1) && ! git diff -U0 HEAD -- scripts/mos-status.cjs lib/memory/mos-status-renderer.test.cjs CHANGELOG.md | grep '^+' | LC_ALL=C grep -qP '\xE2\x80[\x93\x94]' && ! LC_ALL=C grep -qP '\xE2\x80[\x93\x94]' tests/test-261108-ekl-status-active-room.cjs</automated>
  </verify>
  <done>
    - The new test passes all 8 legs. RED output (S1, S2, S6 failing before the fix) is recorded in the SUMMARY.
    - lib/memory/mos-status-renderer.test.cjs prints "All 12 mos-status-renderer tests passed." tests/test-129-read-surface-events.cjs and tests/test-365-portrait.cjs exit 0.
    - From a new temp dir and from $HOME, the first output line is "/mos:status -- room: translational-capital-lab" on this machine.
    - scripts/mos-status.cjs holds no registry.json text and no navigation.detectActiveRoom call.
    - One commit holds exactly the 4 paths.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: doctor self-skips the dogfood pass and 4 repo-only acceptance points in an install layout (EKL-02, EKL-03)</name>
  <files>lib/core/doctor/shared.cjs, scripts/doctor.cjs, tests/test-261108-ekl-doctor-install-layout.cjs, tests/run-all-261108-ekl.sh, CHANGELOG.md</files>
  <behavior>
    - D1: detectPluginLayout(stubInstall) returns layout 'install' and missing ['tests/', '.git', 'scripts/release.sh']. The stub is a temp dir with .claude-plugin/plugin.json and an empty scripts/ dir only.
    - D2: detectPluginLayout(REPO) returns layout 'repo' and missing [].
    - D3: await runDogfoodAcceptance({pluginRoot: stubInstall}) gives 6 points. Each point has ok true, skipped true and a detail.reason that starts with "dev harness tests/ not present in this layout". failed_points is [], summary.failed is 0, summary.skipped is 6. pointTag(point) is 'SKIP' for each point.
    - D4: await runAcceptance({home: tempHome, pluginRoot: stubInstall, onlyPoints: the 4 ids}) gives 4 points. Each point has skipped true and a detail.reason that starts with "repo-only point, not a repo checkout". failed_points is [] (the exit condition of the CLI), summary.skipped is 4.
    - D5: a stub repo is a temp dir with tests/ (empty), scripts/release.sh (a stub that prints nothing and exits 0), git init and one commit. detectPluginLayout gives 'repo'. runDogfoodAcceptance gives 6 points that are not skipped and fail with "driver missing:" (the old repo behavior). runAcceptance with onlyPoints 'verify-release-clean-tree,release-dry-run-output' gives 2 points that are not skipped. release-dry-run-output fails with "missing step names" (the point still blocks).
    - D6: no reason text holds the string "failed:".
  </behavior>
  <action>
Step 0 (baseline). Before any edit, run these 2 commands in the repo. Save the output to the scratchpad of the executor session. They are the before-state for the done check.
- node scripts/doctor.cjs --dogfood-acceptance
- node scripts/doctor.cjs --acceptance --only=version-of-record-published,verify-release-clean-tree,release-dry-run-output,cross-connection-honesty
- bash tests/run-all-126.sh
Do not fix a baseline FAIL that has nothing to do with the layout. Record it as pre-existing.

Step 1 (RED). Write tests/test-261108-ekl-doctor-install-layout.cjs. Use CJS and Node built-ins only. Require lib/core/doctor/shared.cjs and scripts/doctor.cjs in-process. Set process.env.MINDRIAN_ACCEPTANCE_PROGRESS to '0' before the calls. Build the stubs under fs.mkdtempSync(os.tmpdir()). For the stub repo commit, use git -c user.email=t@example.invalid -c user.name=t. Implement legs D1 to D6. Run it. It must fail now (detectPluginLayout and the exports are absent).

Step 2 (GREEN), lib/core/doctor/shared.cjs. Add detectPluginLayout(root). It returns {layout, root, missing}. missing lists, in this order, 'tests/' when root/tests is not a directory, '.git' when hasOwnGitRoot(root) is false, and 'scripts/release.sh' when that file is absent. layout is 'install' when missing is not empty, else 'repo'. Memoize the result in a Map keyed by path.resolve(root), so one run detects the layout once. Never throw: a failure of one probe counts as the marker being missing. Export it beside hasOwnGitRoot. Do not add a second git probe; reuse hasOwnGitRoot (Canon Part 7).

Step 3 (GREEN), scripts/doctor.cjs.
- Import detectPluginLayout from ./lib/core/doctor/shared.cjs through the existing shared destructure.
- Add 2 constants. DOGFOOD_SKIP_REASON = 'dev harness tests/ not present in this layout'. REPO_ONLY_SKIP_REASON = 'repo-only point, not a repo checkout'.
- Add a helper layoutSkip(reason, layout). It returns { ok: true, finding: null, detail: { skipped: true, reason: reason + ' (missing: ' + layout.missing.join(', ') + ')', layout: 'install', missing: layout.missing } }. This is the detail.skipped form that the DOCTOR_SKIP_* arms already return, and it carries the class D meaning: a missing dev harness is a skip, never a fault.
- runDogfoodAcceptance: call detectPluginLayout(pluginRoot) once at the top. When layout is 'install', each point run() returns layoutSkip(DOGFOOD_SKIP_REASON, layout) before the driver existsSync check. When layout is 'repo', keep the code path unchanged, including the "driver missing" FAIL.
- buildAcceptanceChecklist: compute const layout = detectPluginLayout(pluginRoot) once at the top. In the 4 points, add this line after the DOCTOR_TEST_FAIL_POINT arm (and after DOCTOR_SKIP_CROSS_CONNECTION for cross-connection-honesty), before any git, bash or npm spawn: when layout.layout is 'install', return layoutSkip(REPO_ONLY_SKIP_REASON, layout). Do not change any other point.
- Both runners: add skipped: !!(r.ok && r.detail && r.detail.skipped === true) to each result row. Add top-level skipped_points (the ids). Set summary.skipped to the count. Set summary.passed to total minus failed minus skipped. A skipped row never enters failed_points. The stderr progress line prints 'skip' for a skipped row.
- Add pointTag(p). It returns 'SKIP' when p.skipped is true, 'PASS' when p.ok is true, else 'FAIL'. Use it in both printers. For a SKIP row, print '  -- ' + p.detail.reason as the suffix.
- The acceptance roll-up line: 'Acceptance <mode>: P/T points passed' + (S > 0 ? ', ' + S + ' skipped' : '') + failSuffix + '.'. Keep failSuffix ('; failed: a, b') last and unchanged.
- The dogfood roll-up line: 'Dogfood acceptance (loop-fires gate): P/T ACPT points passed' + (S > 0 ? ', ' + S + ' skipped' : '') + failSuffix + '.'. When S equals T, print 'Exit 0: no ACPT driver ran in this layout; run the gate from a repo checkout.' in place of the "Larry Reaches" line. Keep both exit codes unchanged: 1 only when a point failed.
- Add runDogfoodAcceptance, runAcceptance and pointTag to module.exports. Keep every existing export.
- Do not change applies_to of any point. Do not change the repo-layout behavior. Do not add a network call.

Step 4. Write tests/run-all-261108-ekl.sh. Copy the shape of tests/run-all-261029-lcg.sh (run() helper, PASS and FAIL counts, exit 0 only when FAIL is 0). Run: the 2 new tests, lib/memory/mos-status-renderer.test.cjs, tests/test-129-read-surface-events.cjs, tests/test-doctor-acceptance-preflight-checks.cjs, and a no-em-dash and no-en-dash check over the 2 new tests and this script. chmod +x it.

Step 5. Add one line to CHANGELOG.md under the "### Fixed" heading of the beta.82 block (task 1 created it). Text: "- **`/mos:doctor` no longer fails checks that need a development copy when it runs from an install.** The dogfood gate and four release checks need the test files, the git history or the release script, and an install has none of them. They now say SKIP with the reason, and the summary counts them as skipped. In a development copy they still run and still block. <!-- 261108-ekl -->"

Step 6. Run node tests/test-261108-ekl-doctor-install-layout.cjs and bash tests/run-all-261108-ekl.sh. When both pass, run git add on the new files and git commit --only with the 5 paths. Message: "fix(261108-ekl): doctor self-skips dev-harness and repo-only points in an install layout". End the message with the attribution line of the executor session.

Step 7. Run the full verify command after the commit. verify-release-clean-tree and the preflight suite need a clean tracked tree, and the em-dash check reads git show HEAD. When a check fails, fix it and make one more commit with --only and the same paths.
  </action>
  <verify>
    <automated>cd /home/jsagi/gsd-workspaces/status-active-room/MindrianOS-Plugin && node tests/test-261108-ekl-doctor-install-layout.cjs && bash tests/run-all-261108-ekl.sh && bash tests/run-all-126.sh && ! git show -U0 --format= HEAD -- scripts/doctor.cjs lib/core/doctor/shared.cjs CHANGELOG.md tests/test-261108-ekl-doctor-install-layout.cjs tests/run-all-261108-ekl.sh | grep '^+' | LC_ALL=C grep -qP '\xE2\x80[\x93\x94]' && echo GATE-OK; node scripts/doctor.cjs --dogfood-acceptance | tee /dev/stderr | { grep -c '^SKIP' || true; }; node scripts/doctor.cjs --acceptance --only=version-of-record-published,verify-release-clean-tree,release-dry-run-output,cross-connection-honesty | tee /dev/stderr | { grep -c '^SKIP' || true; }</automated>
  </verify>
  <done>
    - The gating part prints GATE-OK. The 2 doctor runs at the end print the count 0 for SKIP rows (the repo layout never skips).
    - The new test passes legs D1 to D6. RED output is recorded in the SUMMARY.
    - bash tests/run-all-261108-ekl.sh exits 0. bash tests/run-all-126.sh gives the same result as before the edit (record both).
    - In the repo, --dogfood-acceptance prints no SKIP row. Each ACPT row has the same PASS or FAIL tag as the Step 0 baseline, and the exit code equals the baseline exit code.
    - In the repo, the 4-point --acceptance run prints no SKIP row. Each point has the same tag as the baseline, except a change that the clean tree after the commit explains (record it).
    - One commit holds exactly the 5 paths.
  </done>
</task>

<task type="auto">
  <name>Task 3: file the beta.81 install-test QA sweep (EKL-04)</name>
  <files>.planning/debug/beta-81-install-test-sweep.md</files>
  <action>
Write .planning/debug/beta-81-install-test-sweep.md to docs/RCA-TEMPLATE.md section 3, in the fixed section order. Use the <evidence> block in the context of this plan and the commit ids of tasks 1 and 2. Read .planning/debug/windows-build-brain-python-qa.md lines 143 to 170 for the Results table shape of a qa-sweep. Write in STE-style English. Mark each claim PROVEN, UNVERIFIED or ASSUMED. Do not write a real person's name; write "owner install test (main session)".

Frontmatter: status: fixing; kind: qa-sweep; trigger: "beta-81-install-test-sweep"; severity: medium; surfaces: [cli, desktop, cowork]; brain_mode: full-loop; canon_parts: [6, 7, 8]; created and updated as 2026-11-08 UTC timestamps.

Sections, in order:
- Source-of-Truth Preamble (template section 2.5). CODE: the install cache 2.0.0-beta.81 (no .git, no tests/, no scripts/release.sh), and scripts/mos-status.cjs byte-identical to origin/main (PROVEN by diff); the fixes on branch quick/261108-status-active-room at the task 2 commit sha. WIRE: theo-mcp.onrender.com on 2026-11-08, sha eaaa6dd0, handshake mindrian-brain v2.0.0-beta.81. Date 2026-11-08.
- Current Focus. next_action: after the beta.82 cut is installed, run /mos:status from $HOME, doctor --dogfood-acceptance and doctor --acceptance --light-npx from the install, then set status resolved and move the file to .planning/debug/resolved/.
- Meta. Repo /home/jsagi/dev/MindrianOS-Plugin (fix made in the worktree /home/jsagi/gsd-workspaces/status-active-room/MindrianOS-Plugin). Plugin version 2.0.0-beta.81 tested, fixes in 2.0.0-beta.82 (in progress). Related: .planning/seeds/SEED-145-theo-store-identity-floor-vs-live-node-count.md.
- Problem Statement, Symptoms (the 3 defects with the verbatim outputs and exit codes), Scope and Impact.
- Results table with columns Test, Component, Result, Class. One row for each finding:
  - R1 /mos:status active room: NEW FAILURE, resolved by quick 261108-ekl task 1 (commit sha).
  - R2 doctor --dogfood-acceptance from the install, 0/6 and exit 1: NEW FAILURE, resolved by task 2 (commit sha).
  - R3 doctor --acceptance --light-npx from the install, 21/25 with 4 repo-only FAILs: NEW FAILURE, resolved by task 2 (commit sha).
  - R4 doctor --all ran: 21 healthy, 8 drift, 0 warnings, 32 classes: WORKING (the run completes).
  - R5 to R12, the 8 drift rows: mcp-surface (about 21918 tokens against the 8000 budget, measurement warning), mcp-write-path OFF (MINDRIAN_MCP_FIRST unset), ui-compliance (183 violations), deprecated-usage (6 commands in 7 days, /mos:query 988 times), room-md (46 dirs without ROOM.md or MINTO.md), graph-derive-health (semantic encoder not installed, 2 of 58 rooms), room-map (8 drift findings), section-ruling (410 drift findings). Classify each one as known or ENV GAP. Use ENV GAP when the cause is local machine state: room content, an opt-in flag that is not set, or an optional dependency that is not installed. Use known when a tracker exists: run grep -rl for the module id in .planning/seeds/ and .planning/debug/, and cite the file. When neither test holds, write "known (no tracker found)" and list the row under Non-Code Follow-ups as a seed candidate. Do not create a seed.
  - R13 brain-smoke L0 to L5 PASS: WORKING.
  - R14 brain-smoke L6 FAIL, node_count 22436 below the floor 27000, GraphRagMeta refreshed 2026-10-16: known, tracked by SEED-145.
  - R15 ICM walk on translational-capital-lab (28 nests, 11 of 11 core sections, identity 7 of 7 keys, 0 nests with every face, 25 of 35 face files without an edit-surface marker, duplications 0 of 3): WORKING. State that the face counts are room content state, not a plugin defect.
  - R16 bind-check advisory "session not bound": WORKING (expected from a plain shell).
  - R17 to R20 resolve-room, help-renderer, room-question, claim-checks: WORKING.
- Eliminated. Record: "the install ships a stale mos-status.cjs" is eliminated, because the file is byte-identical to origin/main.
- Evidence (append-only form), Technical Root Cause (one block for each NEW FAILURE, with path, function and line range), Required Code Changes (as done), Tests to Add or Update (the 2 new tests, the renderer test isolation, tests/run-all-261108-ekl.sh).
- Non-Code Follow-ups: the 2 CHANGELOG lines are done; the release lockstep applies at the next cut; the fixes are not live until beta.82 is released and installed; the README refresh rule applies after the version ships; re-run the 3 install checks on the beta.82 install.
- MindrianOS gates (template section 5), one line each. Part 8: no Brain wire touched, no network call added. Tri-Polar: the status fix uses the registry file, not a CLI env var (test leg S6), and doctor runs where scripts run. Cross-platform: path.join and fs only, the Windows drive mapping comes from resolve-active-room.cjs, verified on Linux (WSL) only, so the Windows and Mac results are by construction (UNVERIFIED). Release lockstep: applies at the next cut. No em-dashes. Reuse before build: resolve-active-room.cjs, hasOwnGitRoot and the existing detail.skipped form are reused, and no surface is added.
- Resolution: root_cause, fix, verification (the commands of tasks 1 and 2 and their output lines), files_changed, commits.

Then run the verify command. Then run git add -f on the file and git commit --only on the file. Message: "docs(261108-ekl): file the beta.81 install-test QA sweep". End the message with the attribution line of the executor session.
  </action>
  <verify>
    <automated>cd /home/jsagi/gsd-workspaces/status-active-room/MindrianOS-Plugin && f=.planning/debug/beta-81-install-test-sweep.md && test -f "$f" && grep -q '^kind: qa-sweep' "$f" && grep -q '^trigger: "beta-81-install-test-sweep"' "$f" && [ "$(grep -c 'NEW FAILURE' "$f")" -ge 3 ] && grep -q 'SEED-145' "$f" && grep -q 'ENV GAP' "$f" && grep -q 'WORKING' "$f" && grep -q 'Source-of-Truth Preamble' "$f" && ! LC_ALL=C grep -qP '\xE2\x80[\x93\x94]' "$f" && git log -1 --name-only --format= | grep -qx "$f"</automated>
  </verify>
  <done>
    - The file exists with kind: qa-sweep and every section of the template, in order.
    - Every finding of the evidence block has a row and a class. R1 to R3 cite the commit ids of tasks 1 and 2.
    - The file holds no em-dash and no en-dash.
    - The last commit holds only this file.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local registry file to mos-status | ~/MindrianRooms/.rooms/registry.json is user-writable; it picks the folder that /mos:status reads |
| plugin root layout to doctor gate | the presence of tests/, .git and scripts/release.sh decides SKIP or run for 10 gate points |
| plugin to Brain | not crossed by this quick; no Brain call is added |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ekl-01 | Tampering | resolveRoomRoot registry leg | accept | The registry belongs to the same local user. resolveActiveRoom already gates on exists-on-disk and on sealed or archived marks. mos-status only reads section files. |
| T-ekl-02 | Information disclosure | scripts/mos-status.cjs | mitigate | No network or Brain token is added. Test 9 of lib/memory/mos-status-renderer.test.cjs greps the source for http, https, fetch and curl, and it stays green (Canon Part 8). |
| T-ekl-03 | Elevation of privilege | detectPluginLayout and the 10 gate points | mitigate | A repo checkout misread as an install would skip release-gate points. Leg D2 asserts that the real repo root reads as 'repo'. Leg D5 asserts that a repo stub keeps the points blocking. release.sh runs doctor from a checkout that holds all 3 markers. |
| T-ekl-04 | Repudiation | doctor printers and summary | mitigate | A skip is never shown as a pass. Rows print SKIP with the reason and the missing markers. The summary carries a skipped count and skipped_points. |
| T-ekl-05 | Denial of service | hasOwnGitRoot probe | accept | One git rev-parse with a 1500 ms timeout, only when .git is absent, memoized per root. |
</threat_model>

<verification>
- Task 1, Task 2 and Task 3 verify commands exit 0. The 2 doctor commands at the end of the Task 2 command report results; they do not gate on exit 0, because the baseline can hold a pre-existing FAIL.
- git log origin/main..HEAD shows the seed commit plus exactly 3 new commits with the paths of tasks 1, 2 and 3.
- No commit is pushed.
</verification>

<success_criteria>
- /mos:status from a non-room folder and from $HOME names translational-capital-lab on this machine (PROVEN by the task 1 verify command).
- In an install layout, doctor reports SKIP (not FAIL) for the dogfood pass and the 4 repo-only points, counts them as skipped, and exits 0 when nothing else fails (PROVEN by legs D3 and D4).
- In a repo checkout, doctor behavior does not change (PROVEN by leg D5 and by the baseline comparison).
- .planning/debug/beta-81-install-test-sweep.md classifies every finding.
</success_criteria>

<output>
Create .planning/quick/261108-ekl-fix-the-three-beta-81-install-test-defec/261108-ekl-SUMMARY.md when done. Include the RED and GREEN outputs, the baseline and after outputs of the 2 doctor commands, the 3 commit ids, and the report fields STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT.
</output>
