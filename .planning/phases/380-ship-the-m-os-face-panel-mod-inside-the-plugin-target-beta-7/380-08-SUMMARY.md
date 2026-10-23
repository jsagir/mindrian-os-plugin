---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 08
subsystem: ui-mod-release-build
tags: [mos-face, build, dist, freshness-gate, manifest, tarball, real-engine, D-05, MOD380-04]
requires: [380-15]
provides:
  - scripts/build-mos-face.cjs (build and --check; excluded from the tarball)
  - ui/mos-face/tsconfig.build.json
  - lib/mos-face/dist (17 plain JS modules, types/index.d.ts, the two canon face assets, manifest.json)
  - tests/test-380-build.cjs (115 checks)
affects: [380-09, 380-10, 380-11]
requirements-completed: [MOD380-04]
completed: 2026-10-23
---

# Phase 380 Plan 08: Release-built dist with a freshness gate - Summary

lib/mos-face/dist is built from the walled package by a plain tsc emit, committed, and guarded by `node scripts/build-mos-face.cjs --check`, which runs inside `tests/run-all-380.sh` (leg "380 build"). The built module loads in the real engine from a folder that holds only the dist.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing pushed, no branch created or switched, no version bump, release.sh not run and not edited.

## Commits (release tree)

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 7505c0767 | feat(380-08): build script, build tsconfig and RED build test (D-05) |
| 2 | a53902ea1 | build(380-08): lib/mos-face/dist built from ui/mos-face, build tool kept out of the tarball (D-05) |

## RED run (Task 1, before the first build)

Test run with no dist: B1 failed (3 checks: no manifest, --check exit 1, no "fresh" line), B2 failed (control: the scratch copy is not fresh; README, test and panel-test change; the hash message), then B3 crashed on the missing `job.js` (a read of a file that does not exist). That crash is the RED state; B5, B6, B8 and the rest were not reached. I added a guard in `copyTree` (missing source gives an empty folder) so later legs fail by assertion, and kept the crash in B3 as is (the dist is the precondition).

## GREEN run (Task 2)

First build: exit 0, source hash f18c5c20b670068a over 36 files, typescript 7.0.2, 22 files written. First full test run: 107 pass, 7 fail. Root causes, all test-side or the pending package.json edit:
- B6/B7 (4 checks): package.json did not have the exclusion yet (Step 3, done after).
- B5 control: my control comment held a foreign host. Hosts are scanned in comments too (as in the build-ui-shell precedent); the control was wrong. Fixed, and a mutation "foreign host in a comment is refused" added.
- B13: `git check-ignore -q` accepts one path only; with two it exits 128. Fixed to one call per path.
After the fixes: 115 pass, 0 fail. After the commit the B7 leg compares the introducing commit with its parent: one added line, nothing else.

## Dist files (lib/mos-face/dist, 22 files)

advice.js 21602, assets/asset-d96217b320.js 5753, assets/asset-fa8504998f.json 7515, bind.js 772, commands.js 29458, face-events.js 3153, face.js 3506, glossary.js 12883, job.js 8408, jobs.js 5705, lines.js 16421, manifest.json 2044, meter.js 3885, paths.js 2099, probe.js 6026, proposals.js 1642, register.js 65688, source.js 8498, status.js 14728, theo-face.js 10725, types/index.d.ts 6046, voice.js 8832 (bytes).

## importRewrite is false, and why

Decided by the real engine, not by guess. The plain tsc emit keeps extensionless relative imports (`import { boundRoom } from './bind'`). In the throwaway plugin folder (only `.claude-plugin/plugin.json`, `hooks/hooks.json` with `modules: ["../lib/mos-face/dist/register.js"]`, and the dist), `claude -p "/mos-text" --plugin-dir <folder>` exits 0 and prints (B8 engine line):

`mos-face: /m:os state, read never`

followed by the WRITES TO, NEXT and JOB lines of the panel text. Control (manual, scratch): replacing `bind.js` by a module without `boundRoom` makes the engine say `hooks module did not load: ...register.js:373: the function handed $ "boundRoom" is imported from "./bind", which exports no function of that name`. So the engine does resolve `./bind` to `bind.js` and checks the export. The rewrite step exists in the script behind the `IMPORT_REWRITE` switch (unused, untested by the real engine because it was not needed).

## Dist path of the face asset (the patch to the plan)

The two canon files are copied byte for byte to `lib/mos-face/dist/assets` and listed in the manifest with the pinned sha256 values of `tests/test-380-theo-faces.cjs` (B10). Proof on the BUILT output: the built `theo-face.js` is imported in Node from a scratch copy; `readFaceAsset` with a plugin root that holds only `lib/mos-face/dist/assets` returns `path = lib/mos-face/dist/assets/asset-fa8504998f.json` and 11 states; with a dev `assets/` folder present the dev path wins; a damaged dist asset and an absent asset both give no face and a plain reason.

## Tarball (B6)

`npm pack --dry-run --json --ignore-scripts` (scratch HOME and scratch npm cache): every one of the 22 dist files is listed; no path starts with `ui/` or `tools/`; `scripts/build-mos-face.cjs` is not listed; no `.ts` or `.tsx` under `lib/mos-face` other than the declaration file.

## Root package.json (T-380-31)

One added line in the files array, beside the older exclusion: `"!scripts/build-mos-face.cjs",`. No dependency, no script, no version, no npm-shrinkwrap change.

## Tests run

| Test | Result |
|------|--------|
| tests/test-380-build.cjs | 115 pass, 0 fail |
| bash tests/run-all-380.sh (load 9.9) | PASSED=16 FAILED=0 SKIPPED=2 KNOWN=0 |
| ui/mos-face tests (`claude plugin test .`) | 182 pass, 0 fail |
| node ui/mos-face/scripts/typecheck.cjs | clean (TypeScript 7.0.2) |
| test-380-wall, test-380-decisions | pass |
| test-369-walled-manifest, test-369-hook-require-graph, test-341-shrinkwrap-no-dev, test-341-payload-shrinkwrap-present, test-341-release-shrinkwrap-gate | pass |
| test-369-bakeoff-workroom, test-369-ui-dist-fresh, test-369.1-* (4 files), test-369.26-source-guards, test-369.26-wall, test-release-bump-tag-and-publish-gates | pass |
| tests/test-release-npm-gate.sh | FAIL: "release.sh does not reference @mindrian_os/install -- Plan 123-01 D-21 rename not landed". It greps scripts/release.sh, which this plan did not touch. Pre-existing, not caused by the package.json edit (UNVERIFIED by a before-run: I did not revert the edit on the shared tree to measure it). |

The two SKIPPED legs of the aggregator now are "installed layout" (plan 09) and "gate wiring" (plan 10). The "380 build" leg was skipped before this plan and now runs and passes.

Engine tests under load: the first aggregator run (load 14) failed 8 tests, the standalone rerun failed 9 (different sets each time), every one with `timed out after 5000 ms`. The rerun at load 4.7 gave 182 pass, 0 fail, and the second aggregator run passed. Cause: load from the peer session, not a code change.

## Edits to existing tests

None. No existing test file was edited. `tests/test-380-build.cjs` is new in this plan (two commits).

## Deviations from Plan

1. **[Rule 3 - ambiguity] `panel.test.tsx` is excluded from the source hash.** The plan lists `tests` but the panel test sits at the package root. It is a test of the same kind; hashing it would stale the dist on every test edit. Test B2 proves a change of README, a tests/ file and panel.test.tsx does not stale the dist.
2. **[Rule 3] `types/index.d.ts` is allowed although the rule says "no .ts file".** The plan also says the dist holds a copy of the type declarations. The rule is: a `.d.ts` under `types/` is a declaration, any other `.ts`, `.tsx`, `.mts`, `.cts` is refused (mutations in B5).
3. **[Scope] The renderer asset is exempt from the module rules.** It holds the SVG namespace `http://www.w3.org/2000/svg` as inert text; it is a data file the engine never loads as a module. It is still checked for dashes and build-machine paths, byte equality and the pinned hash.
4. **[Plan step 1] `npm ci --ignore-scripts` was not run.** The walled install already matched the lockfile: the build's own check (installed typescript 7.0.2 equals the lock; hidden lockfile equals the lock entries) passed and `git status` showed no lockfile change. This avoids a network read and a write to the real npm cache.
5. **Addition: the string reader.** The banned-word rule needs the string literals of the output, so the script holds a small JS reader (adapted from the S1 reader of tests/test-380-copy.cjs). The word list is a mirror of that test; B13 fails if the two lists differ.
6. **The Task 2 commit also holds `tests/test-380-build.cjs`** (the test-side fixes above), besides the dist and package.json named in the plan.

## Safety (home folder)

Every test and mutation that writes uses a scratch folder (`mkdtemp` under the temp folder). Children (npm, the engine, node) get `HOME`, `USERPROFILE` and `MINDRIAN_ROOMS_HOME` inside scratch; the engine leg uses a scratch `CLAUDE_CONFIG_DIR` with a symlink to the login file and a scratch work folder. `assertDistRemovable` is tested only with scratch paths. The real home is never passed to a function that writes.

Listing before and after (files under `~/.mindrian` and `~/MindrianRooms`, path, size, mtime): 105180 files before, 105183 after. The difference is NOT from this plan: it is live activity of other sessions on the machine.
- `~/.mindrian`: appends to `telemetry/navigation-bypass.jsonl`, `telemetry/v1.13/mva.jsonl`, `voice-style.jsonl`, and two `bridge/*.json` session files (hook output of running sessions).
- `~/MindrianRooms`: `room.db-shm` mtimes in about 45 rooms (a reader of every room database), and a live working session in `jhtv-oliver-kuntz` (3 new files `room.db-shm`, `room.db-wal`, `recompile-stamps.json.tmp.*`, and changes to its STATE.md, team files and `.mindrian/*`).
- The leftovers of the earlier incident named in the 380-15 summary (`stance-state.json`, `update-check.json`, `voice-mark.json`, `bridge/brain-health.json`, `room-health.json`, `install-state.json`) are byte and mtime unchanged by this run; I did not touch them.
- Strict byte equality of the whole tree cannot hold on a machine with live sessions. I cannot prove from the listing alone that no byte came from this run; I can state that no process of this plan received the real HOME except `claude plugin test .` and `bash tests/run-all-380.sh` (the older wrapper from plan 01, which runs the engine test in the package folder with the real environment).

## Known Stubs

None.

## Threat Flags

None. T-380-29 to T-380-32 and T-380-SC are mitigated as planned: B1 to B4 (freshness and bytes), B5 (paths, hosts, source files), B6 (tarball), B9 (removal guard, drifted install, seam), no new package.

## Self-Check

- scripts/build-mos-face.cjs, ui/mos-face/tsconfig.build.json, tests/test-380-build.cjs, lib/mos-face/dist/manifest.json: FOUND in the release tree.
- Commits 7505c0767 and a53902ea1: FOUND on release-tree main; `git diff --diff-filter=D` on the second commit shows no deletion.
- `node scripts/build-mos-face.cjs --check` exits 0.

## Self-Check: PASSED
