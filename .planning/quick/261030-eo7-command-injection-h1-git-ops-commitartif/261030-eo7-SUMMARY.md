---
phase: 261030-eo7-command-injection-h1-git-ops-commitartif
plan: 01
quick_id: 261030-eo7
subsystem: security (room text to child processes)
tags: [security, command-injection, argv, git-ops, research-speaker]
requires: []
provides:
  - commitArtifact on execFileSync with an argument array (H1)
  - research-speaker urlencode on sys.argv (H2)
  - research-speaker --apply placeholder replacement on awk ENVIRON (N1)
  - git-ops get-auto-push on sys.argv (N2)
affects: [lib/core/intelligence-cascade.cjs Step 7b, lib/mcp/tool-router.cjs fireCascade, commands/file-meeting.md, skills/file-meeting/SKILL.md]
tech-stack:
  added: []
  patterns: [argv execution instead of shell strings, interpreter input through sys.argv or ENVIRON, git archive oracle for byte identity]
key-files:
  created:
    - tests/test-261030-eo7-commit-artifact-injection.cjs
    - tests/test-261030-eo7-research-speaker-urlencode.cjs
    - tests/test-261030-eo7-research-speaker-apply-context.cjs
    - tests/test-261030-eo7-git-ops-auto-push.cjs
    - .planning/debug/command-injection-commit-message-and-speaker-urlencode.md
  modified:
    - lib/core/git-ops.cjs
    - scripts/research-speaker
    - scripts/git-ops
    - CHANGELOG.md
decisions:
  - "C-3: fix only the HIGH sites (H1, H2, plus N1 and N2 by coordinator decision); no shared argv helper; 21 shell-string sites stay for the next phase"
  - "N1 uses awk with ENVIRON (POSIX, no python dependency) and index/substr, so the result equals the old sed line for normal contexts"
  - "N2 keeps the double-quoted python3 -c program of scripts/resolve-room and moves the 3 paths to sys.argv"
metrics:
  duration: about 100 minutes
  completed: 2026-10-30
  tasks: 5 planned plus 2 added pairs (N1, N2)
  commits: 9
---

# Phase 261030-eo7 Plan 01: Command injection H1, H2, N1, N2 Summary

Four sites that pasted room text into shell text or into Python or sed program text now pass that text as data (execFileSync argv, sys.argv, awk ENVIRON). Normal inputs give byte-identical results against the bc75d431e cut.

## What changed

- H1: lib/core/git-ops.cjs `commitArtifact` calls `execFileSync('bash', args)`. The commit message, the file path and the room path are argv items. A typeof guard keeps `{ committed: false, message: 'git not enabled' }` for a truthy non-string message. The 5 other execSync functions did not change.
- H2: scripts/research-speaker line 120 gives the query text to python3 as `sys.argv[1]`. The sed fallback line did not change. The fix commit changes 1 line.
- N1: scripts/research-speaker `--apply` replaces the placeholder with awk. The replacement text comes from the environment (`RS_REPLACEMENT`, read through `ENVIRON`), never from sed program text. The rule is the same as the old sed line: the first literal placeholder on each line.
- N2: scripts/git-ops `get-auto-push` reads the registry path, the room path and the workspace path from `sys.argv[1..3]`.
- CHANGELOG.md: 4 Fixed bullets (H1, H2, N1, N2) under `[Unreleased] -- v2.0.0-beta.76 (in progress)`. Each bullet ends with "Not live until a release carries it."
- RCA: .planning/debug/command-injection-commit-message-and-speaker-urlencode.md (status fixing; the 21 open sites keep it out of resolved/).

## Commits

| # | Commit | Subject |
|---|--------|---------|
| 1 | 24f77eb33 | test(261030-eo7): add failing tests for the commit message injection in commitArtifact |
| 2 | 06489c922 | fix(261030-eo7): commitArtifact passes the commit message, file and room as arguments, never as shell text |
| 3 | 3b66650bf | test(261030-eo7): add failing tests for the speaker name injection in research-speaker urlencode |
| 4 | c0de221b0 | fix(261030-eo7): research-speaker gives the speaker name to python as an argument, never as program text |
| 5 | eec0f3b00 | test(261030-eo7): add failing tests for the project context injection in research-speaker --apply |
| 6 | ab30db055 | fix(261030-eo7): research-speaker --apply gives the project context to awk as data, never as sed program text |
| 7 | ef82e0e3d | test(261030-eo7): add failing tests for the room path injection in git-ops get-auto-push |
| 8 | 343c8e20d | fix(261030-eo7): git-ops get-auto-push gives the registry, room and workspace paths to python as arguments, never as program text |
| 9 | (this commit) | docs(261030-eo7): changelog, RCA and summary for the commit message, speaker name, project context and room path injection fixes |

Each test commit and each fix commit holds one item, so one pair can be dropped. Exception: commit 6 (N1 fix) also re-pins H2 leg A3 to compare the script only up to the `--apply` block. The re-pinned leg passes with or without the N1 pair (PROVEN: it compares lines that N1 does not change).

## RED and GREEN evidence (PROVEN, each run in this session)

| Item | RED (before the fix) | GREEN (after the fix) |
|------|----------------------|------------------------|
| H1 | 6 FAILED: A1 marker `mos-eo7-h1-subst`, A2 `mos-eo7-h1-tick`, A4 `mos-eo7-h1-nl`, A5a saved body changed, C markers `mos-eo7-h1-room`, `mos-eo7-h1-room2`, `mos-eo7-h1-subst2`, E 6 execSync sites | ALL PASS (12 legs) |
| H2 | 6 FAILED: A2, A3, D1 marker `mos-eo7-h2-proof`, E, G1 marker `mos-eo7-h2-proof` (whole script), H | ALL PASS (12 legs) |
| N1 | 7 FAILED: A1 marker `mos-eo7-n1-e` (sed `e` flag ran touch), A2 file `mos-eo7-n1-w` (sed `w` flag), B1 sed error rc 1, B2 text changed, B3 sed error rc 1, B4 sed error rc 1, D | ALL PASS (8 legs) |
| N2 | 6 FAILED: A1 marker `mos-eo7-n2-proof`, A2 `mos-eo7-n2-sys` (os.system), A4 `mos-eo7-n2-proof` through git-ops commit, A5 `mos-eo7-n2-ws` (workspace folder), C, D | ALL PASS (8 legs) |

The RED sets of H1 and H2 are exactly the sets the plan predicted.

## Byte identity for normal inputs (PROVEN)

- H1: 6 normal headings (plain, parentheses, apostrophe, `100% & more?=#; a|b <c>`, non-ASCII, no message): `identical 6/6` against the bc75d431e commitArtifact (result object and saved body). Legs A and B pin the exact body.
- H2: 11 plain inputs equal the bc75d431e bytes (leg B); the sed fallback equals (leg C); a whole-script run records the same 3 URLs and the same stdout as the bc75d431e script (leg F).
- N1: 18 runs (6 normal contexts on 3 profile shapes) give the same profile bytes and stdout as the bc75d431e script (leg C).
- N2: 9 normal cases (absolute, space, non-ASCII, no key, not registered, symlink, relative, no registry, bad JSON) give the same stdout bytes as the bc75d431e script (leg B).
- Intended divergences, pinned in tests and named in the CHANGELOG: H2 apostrophe, backslash, line break (leg E); N1 slash, ampersand, backslash, line break (legs B1 to B4); N2 apostrophe and backslash paths (leg C); H1 double quotes with backslashes (leg A5a).

## Shell-string inventory: next-phase input

The planner counted 23 sites outside H1 and H2. Rows 22 (N2) and 23 (N1) of that table are fixed in this quick by coordinator decision. 21 sites stay open:

| # | Site | What goes into the shell or program text | Who controls it |
|---|------|------------------------------------------|-----------------|
| 1 | lib/core/git-ops.cjs isGitEnabled | room path | room folder name (user, model, or a shared room) |
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

Decision (C-3): fix only the HIGH sites in this quick. Do not add a shared argv helper; commitArtifact is the only changed lib call site.

## N1 and N2: found by the planner, fixed in this quick

- N1 proof: the context `x; touch <marker> #/e;#` closed the sed replacement and added the GNU `e` flag; sed ran the changed line as a shell command (marker created, rc 0, profile changed). The `w` flag wrote a file. Fixed in ab30db055.
- N2 proof: with `$PWD/.rooms/registry.json` present, a room folder named `room'+str(open('<marker>','w').write('1'))+'` created the marker; `git-ops commit` and `git-ops status` reach this site. Fixed in 343c8e20d.

## Deviations from Plan

### Scope added by coordinator decision

**1. N1 and N2 added as 2 more test and fix pairs.** The plan listed them as out of scope (T-6 accept). The coordinator sent YES during execution. Commits eec0f3b00, ab30db055, ef82e0e3d, 343c8e20d. The docs commit covers 4 CHANGELOG bullets, not 2. The Task 5 verify command counts 2 added bullets; the count is 4 now (PROVEN: 4 added, 0 dash characters, each ends with the release sentence).

### Auto-fixed Issues

**1. [Rule 3 - Blocking] H2 leg A3 re-pinned in the N1 fix commit.**
- Found during: the N1 fix.
- Issue: leg A3 required a whole-file diff of exactly line 120; the N1 fix changes the `--apply` block.
- Fix: leg A3 compares the script up to the `# --apply mode: update PROFILE.md` line. The N1 test covers the block.
- Files modified: tests/test-261030-eo7-research-speaker-urlencode.cjs
- Commit: ab30db055

### Host hold

The cascade tests, the gate checks and the suites were deferred during the host hold and ran after the RELEASE message. All results are in VERIFIED.

## Known Stubs

None.

## Test registration gap

The 4 new tests are in no runner. tests/run-all-363.1.sh is owned by another phase. Register the 4 tests in the next phase.

## Hardening note (ASSUMED risk, not reproduced)

`python3 -c` puts the cwd first on sys.path. A planted `urllib/` or `json/` package in the cwd would load in H2 and N2. `python3 -I` prevents it. This quick keeps the coordinator form without `-I`.

## Unexpected

- The post-write hook of this session ran a cascade when the RCA file was written. It wrote only the gitignored runtime file .planning/.mindrian/last-cascade.json. It made no commit and did not change the RCA. The file is not staged.
- 2 existing tests fail at bc75d431e too (PROVEN by runs on a git archive of the base): test-355-direction-agreement leg H (unresolved hits in lib/core/rs-chain-feeder.cjs and lib/memory/test-rs-discovery-engine.cjs) and test-phase-27-meetings (0 passed, 21 failed, `conn.query is not a function`). This quick does not touch those files.

## Self-Check: PASSED

- The 4 test files, the RCA and this SUMMARY exist (PROVEN by git status before the docs commit).
- Commits 24f77eb33, 06489c922, 3b66650bf, c0de221b0, eec0f3b00, ab30db055, ef82e0e3d, 343c8e20d exist on branch quick/261030-injection-h1-h2 (PROVEN by git log bc75d431e..HEAD).

STATUS: DONE
CHANGED: lib/core/git-ops.cjs, scripts/research-speaker, scripts/git-ops, 4 new tests, CHANGELOG.md, the RCA, this SUMMARY, the PLAN; commits 24f77eb33..343c8e20d plus the docs commit
VERIFIED: the 4 new tests ALL PASS; test-224-per-write-derive PASS (11/11); test-224-proposed-only PASS (18/18); test-237 7/7; test-240.1 PASS; test-276 26/0; test-cascade-surface-loop-fires 1/0; test-compute-state-persists ALL PASS; test-segment-aware-filing-guard rc 0; 296-blast-radius rc 0; 272-dispatch-chokepoint PASSED; test-369-hook-require-graph 5/0; test-359-prose-budget 18/0; build-connector-registry --check rc 0; build-orchestration-projection --check OK; run-all-381 PASS=11 FAIL=0; run-all-363.1 PASS=12 FAIL=0 SKIP=1; test-phase-13 32/0; test-phase-27-room-structure 8/0; test-phase-27-sqlite-schema 17/0; tests/fixtures clean before and after; bash -n and node --check pass
UNVERIFIED: Windows native (Git Bash through CreateProcess) and macOS (BSD awk, BSD sed) behavior, by construction only; the released install cache was not read
RISKS: the 21 open sites still accept room text as shell text; test-355 leg H and test-phase-27-meetings fail at the base too; the 4 new tests are in no runner
NEXT: review the 9 commits on quick/261030-injection-h1-h2, then merge; plan the next phase for the 21 open sites
