---
status: fixing        # H1, H2, N1, N2 fixed by quick 261030-eo7 (not released); 21 shell-string sites stay open for the next phase, so the file stays out of resolved/
kind: rca
trigger: "command-injection-commit-message-and-speaker-urlencode"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [6, 8]
created: 2026-10-30T07:30:00Z
updated: 2026-10-30T09:10:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `quick/261030-injection-h1-h2` @ bc75d431e (base, full sha bc75d431ea8bc5e4218c01a51f5c0a37b74d2295), worktree /home/jsagi/gsd-workspaces/injection-h1h2/MindrianOS-Plugin.
- **WIRE claims probe against:** none. The defects are local process execution. No Brain leg and no network leg (every test stubs curl through PATH).
- **Date of audit:** 2026-10-30
- **Re-verification rule:** re-read the 21 open inventory sites against HEAD before the next phase patches them; line numbers move.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: 4 sites pasted room-controlled text into shell text or interpreter program text (H1 commitArtifact, H2 urlencode, N1 --apply sed, N2 get-auto-push python). CONFIRMED for all 4; all 4 fixed on the branch.
test: 4 test files, each made red first for the stated reason (a marker file created or a file written), then green after the fix.
expecting: no marker in a fresh empty cwd; normal inputs byte-identical to the bc75d431e cut.
next_action: the next phase converts the 21 open shell-string sites (table below) to argv execution.

## Meta

- Repo: /home/jsagi/gsd-workspaces/injection-h1h2/MindrianOS-Plugin (worktree of the dev repo)
- Plugin version: 2.0.0-beta.76 in progress (dev tree); the released cut carries the same code at all 4 sites (ASSUMED from the base sha; the install cache was not read)
- Reported by: the security planning pass for quick 261030-eo7 (H1 = T1-01, H2 = T1-02); N1 and N2 found by the planner during the same pass; coordinator decision to add N1 and N2 to the quick
- Date first observed: 2026-10-30
- Related debug sessions: compute-team-analyze-room-python-date-fallback-injection (the same class: room text pasted into `python3 -c` program text)

## Problem Statement

A filed note heading, a room folder name, a meeting speaker name and a project context could run code on the user's machine, because 4 plugin sites pasted that text into a shell command line or into the text of a Python or sed program.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: room text reaches git, python3 and sed as data; nothing runs.
actual:
- P1 (H1): a scratch git room, cwd an empty dir, `commitArtifact(room, room/sec/a.md, 'Q3 plan $(touch mk1)')` created `mk1` in the cwd and returned `{ committed: true, message: 'Q3 plan $(touch mk1)' }`; `git log -1 --format=%B` printed `Q3 plan` plus 2 newlines (the shell replaced the substitution with nothing).
- P2 (H2): the bc75d431e urlencode function, called with `x'+str(open('mk','w').write('1'))+'` in an empty cwd, created `mk` and printed `x1`.
- P3 (H1, room path): a git room at `<dir>/room $(touch mk3) x`, `commitArtifact(room, room/sec/a.md)` with no message, created `mk3`, returned `{ committed: true, message: 'auto-generated' }`, and made NO commit (`git -C <room> log` exit 128).
- P4 (N1): `research-speaker <room> test-speaker 'Sample Speaker' 'x; touch mos-eo7-n1-e #/e;#' --apply` created `mos-eo7-n1-e` in the cwd (the sed `e` flag ran the changed line as a shell command); the context `x #/w mos-eo7-n1-w` plus a line break wrote the file `mos-eo7-n1-w` (the sed `w` flag).
- P5 (N2): with `$PWD/.rooms/registry.json` present, `git-ops get-auto-push <dir>/room'+str(open('mos-eo7-n2-proof','w').write('1'))+'` created `mos-eo7-n2-proof`; `git-ops commit` in that room reached the same site (the H1 chain); a workspace folder name of the same shape did the same.
errors: none printed; silent. Every script exit code stayed 0 for the hostile cases.
reproduction: the 4 test files below reproduce each proof on the bc75d431e code (RED lines in Evidence). Every run uses a throwaway dir under os.tmpdir() and a fresh empty cwd; marker names are `mos-eo7-*`.
started: present at bc75d431e for all 4 sites.

## Scope and Impact

- Affected surfaces: cli (the post-write hook runs the cascade, Step 7b calls commitArtifact); desktop and cowork through the MCP server (lib/mcp/tool-router.cjs `fireCascade` passes `result.filePath` into `runCascade`, so Step 7b runs on any machine with bash and git); cowork shared rooms carry headings and folder names that another member wrote. H2 and N1 run where the meeting command runs scripts/research-speaker through bash (commands/file-meeting.md, skills/file-meeting/SKILL.md).
- Affected commands: the cascade Step 7b (every filed note in a git room), `git-ops commit` and `git-ops status` (both call `get-auto-push`), the meeting command speaker research and its `--apply` confirmation.
- Affected users: every install with bash and git (H1), plus python3 (H2, N2), plus GNU sed (N1 `e` flag is a GNU extension; the `w` flag is POSIX). N2 needs `$PWD/.rooms/registry.json` in the working folder.
- Version range: bc75d431e and earlier (first-bad not bisected).
- Severity: high (code execution from room content, no network leg).
- Blast radius: 21 more shell-string sites stay open (inventory table under Required Code Changes).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: the `$(touch ...)` speaker name is a live H2 vector.
  evidence: bash does not parse an expanded value again, so python3 got the literal text in the bc75d431e cut too (H2 leg D2 and G2 pass before the fix). The leg guards a future rewrite.
  timestamp: 2026-10-30T07:40:00Z
- hypothesis: the double-quote escaping in commitArtifact stopped a quote break-out.
  evidence: H1 leg A3 (`"; touch mk; "`) passes before the fix; the vector is `$( )`, backticks and the room path, which double quotes do not stop.
  timestamp: 2026-10-30T08:20:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-10-30T08:20:00Z
  checked: `node tests/test-261030-eo7-commit-artifact-injection.cjs` at bc75d431e code (commit 24f77eb33).
  found: rc 1, `commit-artifact-injection: 6 FAILED`. `not ok - A1.` (cwd holds `mos-eo7-h1-subst`), `not ok - A2.` (`mos-eo7-h1-tick`), `not ok - A4.` (`mos-eo7-h1-nl`), `not ok - A5a.` (saved body `say "hi" C:\path\x \q\ end`, expected `say "hi" C:\path\x \"q\" end`), `not ok - C.` (cwd holds `mos-eo7-h1-room`, `mos-eo7-h1-room2`, `mos-eo7-h1-subst2`), `not ok - E.` (execSync( call sites 6 !== 5). A3, A5b, B, D1, D2, D3 passed.
  implication: H1 confirmed for the message and the room path.
- timestamp: 2026-10-30T08:30:00Z
  checked: the same test after the fix (commit 06489c922).
  found: rc 0, `commit-artifact-injection: ALL PASS` (12 legs).
  implication: H1 fixed; the soft-fail contract (D1 to D3) holds.
- timestamp: 2026-10-30T08:35:00Z
  checked: `node tests/test-261030-eo7-research-speaker-urlencode.cjs` at the urlencode of bc75d431e (commit 3b66650bf).
  found: rc 1, `research-speaker-urlencode: 6 FAILED`. `not ok - A2.` (old python3 line), `not ok - A3.` (diff [] not [120]), `not ok - D1.` (cwd holds `mos-eo7-h2-proof`), `not ok - E.` (NEW gave `%22Dana+O'Sample%22+edtech`), `not ok - G1.` (whole script: cwd holds `mos-eo7-h2-proof`), `not ok - H.` (lines that hold `quote('` 1 !== 0). A1, B, C, D2, F, G2 passed.
  implication: H2 confirmed at function level and in a whole-script run.
- timestamp: 2026-10-30T08:40:00Z
  checked: the same test after the fix (commit c0de221b0).
  found: rc 0, `research-speaker-urlencode: ALL PASS` (12 legs). The numstat of the fix commit is `1 1 scripts/research-speaker`.
  implication: H2 fixed; plain names byte-identical; the 3 stubbed URLs equal the pinned literals and the bc75d431e cut.
- timestamp: 2026-10-30T08:45:00Z
  checked: `node tests/test-261030-eo7-research-speaker-apply-context.cjs` at the --apply block of bc75d431e (commit eec0f3b00).
  found: rc 1, `research-speaker-apply-context: 7 FAILED`. `not ok - A1.` (cwd holds `mos-eo7-n1-e`), `not ok - A2.` (cwd holds `mos-eo7-n1-w`), `not ok - B1.` (`sed: -e expression #1, char 90: unknown option to s`, rc 1), `not ok - B2.` (saved `R[To be filled after proactive research]D ...`), `not ok - B3.` (`invalid reference \1 on s command's RHS`, rc 1), `not ok - B4.` (`unterminated s command`, rc 1), `not ok - D.` (sed lines that hold PROJECT_CONTEXT 1 !== 0). C passed.
  implication: N1 confirmed for the `e` flag and the `w` flag; plain contexts with a slash, a backslash or a line break also broke the update.
- timestamp: 2026-10-30T08:50:00Z
  checked: the same test after the fix (commit ab30db055).
  found: rc 0, `research-speaker-apply-context: ALL PASS` (8 legs); leg C compared 18 runs (6 normal contexts on 3 profile shapes) byte for byte against the bc75d431e cut.
  implication: N1 fixed; normal contexts byte-identical.
- timestamp: 2026-10-30T08:55:00Z
  checked: `node tests/test-261030-eo7-git-ops-auto-push.cjs` at the get-auto-push of bc75d431e (commit ef82e0e3d).
  found: rc 1, `git-ops-auto-push: 6 FAILED`. `not ok - A1.` (workspace holds `mos-eo7-n2-proof`), `not ok - A2.` (`mos-eo7-n2-sys`, through os.system), `not ok - A4.` (git-ops commit chain: `mos-eo7-n2-proof`), `not ok - A5.` (hostile workspace folder: `mos-eo7-n2-ws`), `not ok - C.` (NEW value off for the apostrophe path), `not ok - D.` (source holds `'$REGISTRY_FILE'`). A3 and B passed.
  implication: N2 confirmed through the room path, the workspace path and the commit chain.
- timestamp: 2026-10-30T09:00:00Z
  checked: the same test after the fix (commit 343c8e20d).
  found: rc 0, `git-ops-auto-push: ALL PASS` (8 legs); leg B compared 9 normal cases byte for byte against the bc75d431e cut.
  implication: N2 fixed; normal paths byte-identical.
- timestamp: 2026-10-30T09:05:00Z
  checked: a one-off scratchpad compare of the bc75d431e commitArtifact and the fixed one on 6 normal headings (plain, parentheses, apostrophe, `100% & more?=#; a|b <c>`, non-ASCII, no message).
  found: `identical 6/6` (result object and saved body).
  implication: H1 normal headings byte-identical.

## Technical Root Cause

- Site H1: lib/core/git-ops.cjs:49-50 function `commitArtifact`.
  - Cause: one shell string `bash "<script>" commit "<room>" "<file>" "<message>"` ran through execSync (/bin/sh). Only `"` in the message was escaped; `$( )`, backticks and `\` stayed live inside double quotes, and the room and file paths were not escaped at all.
  - Why it matters: the cascade Step 7b (lib/core/intelligence-cascade.cjs:402-407) makes the message from the first `# ` heading of the filed file, so room content became shell text at filing time.
- Site H2: scripts/research-speaker:120 function `urlencode`.
  - Cause: `python3 -c "... quote('$string')"` pasted the query text (it holds the speaker display name) into a Python string literal; a `'` closed the literal.
- Site N1: scripts/research-speaker:226 (the `--apply` block).
  - Cause: `sed "s/<placeholder>/Researched on ... ${PROJECT_CONTEXT}/"` pasted the context into the sed program; a `/` closed the replacement, and the text after it became sed flags (`e` runs the pattern space as a command, `w` writes a file) and sed commands.
- Site N2: scripts/git-ops:189-204 subcommand `get-auto-push`.
  - Cause: `python3 -c "... open('$REGISTRY_FILE') ... realpath('$ROOM_PATH') ... join('$WORK_DIR', rp)"` pasted 3 paths into Python string literals; a `'` in a folder name closed the literal.
- Why it surfaces now: the security review before the beta.77 cut; the class was already known from the compute-team RCA.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1 (H1, done):
  - Location: lib/core/git-ops.cjs, function `commitArtifact`.
  - Required behavior: call `execFileSync('bash', [scriptPath, 'commit', resolved, resolvedFile, message], { timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })`; pass no fourth argument when the message is empty or undefined; throw inside the try for a truthy non-string message so the old `{ committed: false, message: 'git not enabled' }` result holds.
- Change 2 (H2, done):
  - Location: scripts/research-speaker:120.
  - Required behavior: `python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$string"`; keep the sed fallback line byte for byte.
- Change 3 (N1, done):
  - Location: scripts/research-speaker, the `--apply` block, the placeholder replacement.
  - Required behavior: give the replacement text to awk through the environment (`RS_REPLACEMENT=... awk '... ENVIRON["RS_REPLACEMENT"] ...'`), replace the first literal placeholder on each line with `index()` and `substr()` (the same result as the old sed line). The 2 other sed lines in the block hold only the date and stay.
- Change 4 (N2, done):
  - Location: scripts/git-ops, subcommand `get-auto-push`.
  - Required behavior: read the 3 paths from `sys.argv[1]`, `sys.argv[2]`, `sys.argv[3]` and pass `"$REGISTRY_FILE" "$ROOM_PATH" "$WORK_DIR"` after the program (the scripts/resolve-room argv model).
- Change 5 (next phase, open): convert the 21 sites below to argv execution. Do not add a shared helper unless the count of call sites justifies it (coordinator rule C-3).

Shell-string inventory, next-phase input (planner count 23; rows 22 and 23 of the planner table were N2 and N1 and are fixed here, so 21 stay open):

| # | Site | What goes into the shell or program text | Who controls it |
|---|------|------------------------------------------|-----------------|
| 1 | lib/core/git-ops.cjs isGitEnabled (execSync) | room path | room folder name (user, model, or a shared room) |
| 2 | lib/core/git-ops.cjs pushIfConfigured | room path | same |
| 3 | lib/core/git-ops.cjs initRepo | room path | same |
| 4 | lib/core/git-ops.cjs setupLfs | room path | same |
| 5 | lib/core/git-ops.cjs getStatus | room path | same |
| 6 | lib/core/graph-ops.cjs:54 | room path, output path | room folder name, caller |
| 7 | lib/core/graph-ops.cjs:148 | room path, output path | same |
| 8 | lib/core/asset-ops.cjs:29-35 fileAsset | room path, asset file path, section, meetingId | file name of the filed asset, caller, meeting id |
| 9 | lib/core/asset-ops.cjs:120 updateManifest | room path | room folder name |
| 10 | lib/core/room-ops-sync.cjs:60 | room path | same |
| 11 | lib/core/meeting-ops.cjs:23 | room path | same |
| 12 | lib/core/meeting-ops.cjs:43 | room path | same |
| 13 | lib/core/state-ops.cjs:55 | room path | same |
| 14 | scripts/discovery-cycle.cjs:446 | room path | same |
| 15 | scripts/discovery-cycle.cjs:245-249 runDiscoveryStep | room path (python3) | same |
| 16 | scripts/discovery-cycle.cjs:339-343 runInterpretation | room path (node) | same |
| 17 | scripts/discovery-cycle.cjs:506-507 | plugin script path inside python program text | install path (plugin) |
| 18 | scripts/diagnostics-command.cjs:109 | room path | room folder name |
| 19 | scripts/generate-snapshot.cjs:1401 | snapshot dir in a file URL | room path |
| 20 | scripts/generate-snapshot.cjs:1402 | same | same |
| 21 | scripts/generate-snapshot.cjs:1403 | same | same |

Reviewed and not counted: scripts/label-topic-forest.cjs:81 (POSIX single-quote escaping, safe under /bin/sh; not safe under cmd.exe, UNVERIFIED on Windows); lib/quickview/server.cjs:515 (fixed command and a numeric port); 2 test files under lib/memory (fixed patterns). Hardening note (ASSUMED risk, not reproduced): `python3 -c` puts the cwd first on sys.path, so a planted `urllib/` or `json/` package in the cwd would load; `python3 -I` prevents it. H2 and N2 keep the coordinator form without `-I`.

## Tests to Add or Update

- Test 1 (H1): tests/test-261030-eo7-commit-artifact-injection.cjs (12 legs: A1-A5b hostile and edge messages, B auto message, C hostile room path, D1-D3 soft-fail contract, E source pins).
- Test 2 (H2): tests/test-261030-eo7-research-speaker-urlencode.cjs (12 legs: A1-A3 extraction pins, B byte identity, C sed fallback, D1-D2 hostile names, E pinned divergence, F-G whole script with a curl stub, H source pins). Leg A3 was re-pinned by the N1 fix commit to compare the script up to the `--apply` block.
- Test 3 (N1): tests/test-261030-eo7-research-speaker-apply-context.cjs (8 legs: A1-A2 sed `e` and `w` flags, B1-B4 slash, ampersand, backslash, line break, C 18 normal runs against the bc75d431e cut, D source pins; curl and date stubbed).
- Test 4 (N2): tests/test-261030-eo7-git-ops-auto-push.cjs (8 legs: A1-A3 hostile room names, A4 the commit chain, A5 hostile workspace name, B 9 normal cases against the bc75d431e cut, C pinned divergence, D source pins).
- Runner registration: none. The 4 tests are in no runner; tests/run-all-363.1.sh is owned by another phase. Register them in the next phase.

## Non-Code Follow-ups

- CHANGELOG.md: 4 Fixed bullets under `[Unreleased] -- v2.0.0-beta.76 (in progress)`, each ending with "Not live until a release carries it." (done).
- Release lockstep: the fixes ship only through scripts/release.sh; the lockstep of RULE 5 in docs/RELEASE-CEREMONY-RULING-SYSTEM.md applies. Not live until a release carries it.
- Canon: Part 6 (the plugin's own room is exposed too) and Part 8 (untouched; see the gates). No CANON-PHASE-MAP.md change for a quick.
- knowledge-base.md: on resolve (after the next phase closes the 21 sites), add the summary block and move this file to .planning/debug/resolved/.

## MindrianOS gates (RCA-TEMPLATE section 5)

1. Canon Part 8: no Brain wire is touched. research-speaker keeps its single pre-existing web search call (curl); the tests stub it and assert 3 recorded URLs per run. No user bytes reach the Brain.
2. Tri-Polar: CLI verified by the tests (the scripts and lib/core/git-ops.cjs run the same on every surface). Desktop and Cowork verified by construction: they reach commitArtifact through `fireCascade` -> `runCascade` -> Step 7b, the same function.
3. Cross-platform: the fixes remove the shell parse (H1, H2, N2) and the sed program parse (N1), so they are correct by construction on Linux, macOS and WSL. Verified on Linux (WSL2) only. Windows native (Git Bash through CreateProcess) and the macOS awk (`ENVIRON`, `index`, `substr` are POSIX) are UNVERIFIED.
4. Release lockstep: CHANGELOG only in this quick; not live until a release carries it.
5. No dashes: the code comments, the 4 CHANGELOG bullets, the 8 commit messages, the 4 test files and this file use hyphens only.
6. Reuse before build: no new command, skill, agent, hook or lib file; no new dependency. N1 uses awk, which the scripts already use.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: 4 sites pasted room-controlled text into shell text (H1) or into Python or sed program text (H2, N2, N1), so the text was parsed as code.
fix: H1 execFileSync with an argument array; H2 and N2 sys.argv (the scripts/resolve-room model); N1 awk with the replacement text from the environment. Normal inputs keep byte-identical results. Intended divergences, pinned in tests and named in the CHANGELOG: H2 encodes an apostrophe, a backslash and a line break exactly (an apostrophe gives %27, where the old code took the sed fallback); N1 saves a context with a slash, an ampersand, a backslash or a line break exactly (the old code failed or changed the text); N2 finds the setting for a path with an apostrophe or a backslash sequence (the old code fell back to off); H1 saves a message with double quotes and backslashes exactly.
verification:
- the 4 new tests: ALL PASS (12, 12, 8, 8 legs).
- tests that reach the cascade (grep of tests/ for intelligence-cascade): test-224-per-write-derive PASS (11/11), test-224-proposed-only PASS (18/18), test-237-post-write-session-stamp 7/7, test-240.1-state-version-preserved PASS (5 scenarios), test-276-room-content-honesty 26 passed 0 failed, test-cascade-surface-loop-fires 1 passed 0 failed, test-compute-state-persists ALL PASS, test-segment-aware-filing-guard rc 0, 296-blast-radius rc 0, 272-dispatch-chokepoint PASSED; test-355-direction-agreement PASS 187 FAIL 1 (leg H, 2 unrelated files; the same failure at bc75d431e, PROVEN by a run on a git archive of the base).
- test-369-hook-require-graph 5 passed 0 failed; test-359-prose-budget 18 passed 0 failed.
- build-connector-registry --check rc 0; build-orchestration-projection --check `orchestration-projection: OK`.
- run-all-381 PASS=11 FAIL=0; run-all-363.1 PASS=12 FAIL=0 SKIP=1.
- test-phase-13 32 passed 0 failed; test-phase-27-room-structure 8/8; test-phase-27-sqlite-schema 17/17; test-phase-27-meetings 0 passed 21 failed (`conn.query is not a function`, the same result at bc75d431e, PROVEN by a run on a git archive of the base). tests/fixtures git status clean before and after.
files_changed:
  - lib/core/git-ops.cjs (commitArtifact on execFileSync; the 5 other functions unchanged)
  - scripts/research-speaker (line 120 argv urlencode; the --apply placeholder replacement on awk)
  - scripts/git-ops (get-auto-push reads the 3 paths from sys.argv)
  - tests/test-261030-eo7-commit-artifact-injection.cjs, tests/test-261030-eo7-research-speaker-urlencode.cjs, tests/test-261030-eo7-research-speaker-apply-context.cjs, tests/test-261030-eo7-git-ops-auto-push.cjs (new)
  - CHANGELOG.md (4 Fixed bullets)
commits: 24f77eb33 (H1 test), 06489c922 (H1 fix), 3b66650bf (H2 test), c0de221b0 (H2 fix), eec0f3b00 (N1 test), ab30db055 (N1 fix), ef82e0e3d (N2 test), 343c8e20d (N2 fix), plus the docs commit of quick 261030-eo7
