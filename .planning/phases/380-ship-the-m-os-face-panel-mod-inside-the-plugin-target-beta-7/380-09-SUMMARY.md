---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 09
subsystem: plugin-activation-release-gate
tags: [mos-face, activation, hooks-modules, installed-layout, release-gate, rule-10, state-owner, D-05, D-06, MOD380-01, MOD380-02, MOD380-06]
requires: [380-08]
provides:
  - hooks/mos-face.json (candidate B wiring) and manifest fields hooks and types in .claude-plugin/plugin.json
  - tests/test-380-installed-layout.cjs (pack, lay out, validate, real-engine load; strict in the gate)
  - tests/test-380-gate-wiring.cjs (35 checks)
  - tests/run-all-366.sh leg (2h): hard run of tests/run-all-380.sh
  - RULE 10 bullet The face panel, CHANGELOG line, ui/mos-face/README.md Surfaces section
  - panel state owner renamed from mos-face to mos (source, dist, fixtures)
affects: [380-10, 380-11]
requirements-completed: [MOD380-01, MOD380-02, MOD380-06]
completed: 2026-10-24
---

# Phase 380 Plan 09: Activation, installed-layout proof, release gate leg - Summary

The plugin now loads the face panel from `lib/mos-face/dist` through `hooks/mos-face.json` (candidate B). On a packed payload laid out like an installed plugin, the real engine answers `/mos-text` with the panel's own text. The phase tests ride the release suite gate as leg (2h). Nothing pushed, no branch created or switched, `scripts/release.sh` not run, no version bump, no receipt signed.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release` (main). Pre-plan sha: `a53902ea1657c99391c01d01275ef636abb1f505` (380-09-PRE-SHA.txt, branch tree commit 2d659675c).

## Commits (release tree)

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 4cc0284e6 | test(380-09): RED installed-layout proof for the shipped panel (D-05) |
| 2a (deviation) | bfc7cd798 | fix(380-09): the face panel keeps its state under the shipped plugin name mos (D-05) |
| 2b | 61b637a1d | feat(380-09): the plugin loads the face panel from lib/mos-face/dist (D-05, MOD380-01) |
| 3 | 3dac681e4 | feat(380-09): phase tests join the release suite gate, RULE 10 face panel bullet, changelog line (D-06) |

## The wiring choice and why (candidate B)

Decided by measurement, not by opinion.

- Candidate A (key `modules` in `hooks/hooks.json`) loads and validates once the state problem below is fixed. It fails criterion 3: it reds `tests/test-quick-260911-juq-hooks-json-top-level.cjs` (hooks.json top level must be exactly `["hooks"]`; the test guards the Claude Code 2.1.268 unknown-keys warning), `tests/test-380-budget.cjs` G5 (root hooks.json must not mention mos-face) and the SPEC-5 leg of `tests/run-all-198.sh`. A types field does not change that, so the rule sends us to B.
- Candidate B: `hooks/mos-face.json` holds `{ "modules": ["../lib/mos-face/dist/register.js"] }`. The manifest gets `"hooks": ["./hooks/hooks.json", "./hooks/mos-face.json"]` and `"types": "./lib/mos-face/dist/types/index.d.ts"`. `hooks/hooks.json` is byte-identical to HEAD. No `version` edit.
- Duplicate-load check (measured in a scratch plugin): with both files listed, a SessionStart shell hook in `hooks/hooks.json` ran once (marker count 1), the same as with only `mos-face.json` listed. The engine does not double-load the standard file.

## State-namespace finding (open risk 1 of the plan, now measured)

Root cause of the first failure, stated before the patch: the engine lets only the owner of a value write it, and the owner is the plugin name. The panel declared 37 atoms with `plugin: 'mos-face'`; the shipped plugin is named `mos`.

- Real engine, plugin named mos, module with `mos-face` atoms: `mos: session.start hook skipped: threw mos: state.set: denied: mos-face owns that value and only its owner writes it`. Same for turn.start and turn.complete. `/mos-text` did not run.
- `claude plugin validate --json`: 37 hooks errors, `$.state.set refers to mos-face.advice, which mos-face owns: only a value's owner writes it`.
- The types field alone does NOT fix it (measured: still 37 errors). Candidate B alone does not fix it either (same 37 errors).
- With the atoms and the `PluginState` key renamed to `mos`: `validate` shows 0 errors with the types field and 37 errors "mos.advice is not declared: the manifest's types contract must name it" without it. So both are needed: the rename and the types field.

Fix (commit bfc7cd798, deviation, see below): 37 atom literals in `ui/mos-face/hooks/register.tsx`, the `PluginState` key in `ui/mos-face/types/index.d.ts`, the package manifest name `ui/mos-face/.claude-plugin/plugin.json` (mos-face to mos, so `claude plugin test` still owns the state), the test fixtures that stamp a render or a press with the plugin name, and `lib/mos-face/dist` rebuilt with `node scripts/build-mos-face.cjs`. The engine needs plugin and key as literals in source, so the name cannot sit in a constant; a comment above the first atom says why.

## Criteria table (Task 2)

| Criterion | Baseline (before) | Candidate A (+ types) | Candidate B (+ types), kept |
|-----------|-------------------|-----------------------|-----------------------------|
| 1 validate --json on repo root | success true; manifest 0 errors, 0 warnings; one content item (CLAUDE.md, 1 warning, pre-existing) | exit 1 without types (37 errors); exit 0 with types: hooks.json 0 errors, 0 warnings, 22 notes | exit 0: mos-face.json 0 errors, 0 warnings, 22 notes (session.start, 14 command.run, prompt.submit, turn.start, tool.call, turn.complete, 4 ui.render components); no $.process.run |
| 2 shell hooks object equal to pre-plan sha | n/a | equal (JSON compare of `git show PRE:hooks/hooks.json` hooks object) | equal; hooks.json unchanged |
| 3 hook-reading tests keep their result | table below | FAILS: juq top-level test, 380-budget G5, run-all-198 | same as baseline |
| 4 installed layout L1 to L6 | RED (6 failed) | not run as a final state | 29 passed, 0 failed |

Hook-reading tests (28 files found by `grep -rl "hooks/hooks.json" tests`, each run with a 300 s timeout), before vs candidate A vs candidate B. P = exit 0, F = non-zero.

| Test | Before | A | B |
|------|--------|---|---|
| run-all-179.sh | F | F | F |
| run-all-198.sh | P | F (SPEC-5 juq leg) | P |
| run-all-239.sh, run-all-267.2.sh | P | P | P |
| test-120-02-scaffold.sh, test-127.2-04, test-198-adapter-budget, test-239 (2), test-260906-gr1, test-267-2, test-355-part8-egress | P | P | P |
| test-121-03-scaffold.sh | F | F | F |
| test-346-catalogue-schema.cjs | F | F | F |
| test-3551-tri-polar.cjs | F | F | F |
| test-369-hook-require-graph, test-369-installed-layout, test-369.1-desktop-artifact | P | P | P |
| test-36925-brief-wiring.cjs | P | F | F (load, see below) |
| test-380-budget.cjs | P | F (G5) | P |
| test-380-installed-layout.cjs | F (RED) | P | P |
| test-auto-explore-canon-part-8, test-auto-explore-fingerprint, test-mux-card-before-answer | F | F | F |
| test-derivation-drain-fires, test-post-compact-nav04-closure, test-r1-posttooluse-interceptor-spike | P | P | P |
| test-quick-260911-juq-hooks-json-top-level.cjs | P | F | P |

The red rows before the plan (run-all-179, test-121-03, test-346, test-3551, the two auto-explore tests, test-mux) are red before and after: pre-existing, not owned here.

test-36925-brief-wiring.cjs BW4 (on-stop wall time, a timing test): fails under heavy machine load. Wall ms 2452, 2445, 2436 in the baseline run; 7951, 8164, 8264 in the run with B (load average 15 to 48, caused by two peer processes at 400 to 1000 percent CPU, pids 3153634 and 3368749, in the beta.69 plugin cache). It also failed with A. The edited files (hooks.json reverted, plugin.json, hooks/mos-face.json) are not read by BW4 in any way I could find. UNVERIFIED: a green rerun under low load; the load never dropped below 14 during this plan.

## Real-engine line (L6, home path scrubbed)

`engine line: mos: /m:os state, read never  [21 s, exit 0]` followed by the WRITES TO, READS, NOW, ROOM, FILED, STALE, HEALTH, THEO STATE, VERSION, NEXT MOVE, NEXT and JOB lines of the panel text (seen in the scratch run of the dist; the layout test checks the `/m:os state` line and the absence of any state, atom or load error). Layout test: 29 passed, 0 failed (L0 environment, L1 pack, L2 content incl. pinned canon asset sha256 e54e7c6a3c11a039059fb47833b09e865cd3981e2910b4f13571e87c06682da2, L3 21 dist files re-hashed, L4 no shell hook and shell hooks object equal to the working tree, L5 validate, L6 real engine, L7 note).

L7, as printed: `UNVERIFIED - this run drew the panel text on the Claude Code terminal only; it cannot tell whether Desktop, VS Code or mobile drew any panel text`.

## Strict gate leg (T-380-35)

- `tests/run-all-380.sh` already ran the engine tests with `run_strict` and the layout test with `run_strict_if` (plan 380-01); W2 and W7 prove it. Not edited.
- W8: with only the node binary on PATH, `node tests/test-380-installed-layout.cjs` exits 77 in 0.03 s with `SKIPPED (ENV GAP): npm is not on PATH ...` and `An environment gap blocks the cut`. The aggregator function `run_strict_if`, cut out of the real file and run against a stub that exits 77, prints `FAILED (environment gap blocks the cut: ...)` and counts FAIL=1, SKIP=0. Control: a missing guard file is SKIPPED.
- `tests/run-all-366.sh` leg (2h) is a plain `run` line (not run_if); `grep -c run-all-380 tests/run-all-366.sh` prints 1.
- `scripts/release.sh` and `scripts/release-lib/suite-gate.sh`: `git diff --quiet a53902ea1... HEAD -- ...` exits 0 (unchanged since the recorded pre-plan sha, which is an ancestor of HEAD).

## Release suite before and after

| Run | Result |
|-----|--------|
| `bash tests/run-all-366.sh` before leg (2h) (at 61b637a1d) | PASSED=75 FAILED=0 SKIPPED=0 KNOWN=1 (KNOWN: pin 355 direction agreement, signature matched) |
| After leg (2h), first run (3dac681e4 minus the dash fix) | PASSED=75 FAILED=1 KNOWN=1; the one fail was the dash fence on my own new test (raw dashes written by the editor in test-380-gate-wiring.cjs). Fixed by building the character class from char codes. The 380 engine leg passed in that run |
| After leg (2h), final run (3dac681e4, 32 minutes) | PASSED=75 FAILED=1 SKIPPED=0 KNOWN=1. The one fail is leg 380 face panel, because its engine-tests sub-leg failed under load average 43 to 48: `Error: timed out after 5000 ms` in 14 of 16 failures of `claude plugin test` (the same signature plan 08 recorded). Every other sub-leg of the aggregator, including the dash fence and the installed layout, passed |
| `bash tests/run-all-380.sh` alone, after the final test edit | PASSED=18 FAILED=0 SKIPPED=0 KNOWN=0 (load about 15) |
| `node tests/test-380-engine-tests.cjs` alone | 182 pass, 0 fail (low load, before the load spike); 140 to 168 pass under load 42 to 48 |
| `claude plugin test .` in ui/mos-face after the rename | 182 pass, 0 fail |

UNVERIFIED: one final full green run of run-all-366 with the peer load gone. The leg is correct (it was green before the load spike and 18/0/0 alone); the cut will fail until the machine is quiet, by design.

Other tests (Task 3 step 6), before then after: test-366-suite-gate 0/0, test-349-docs-lockstep 0/0, test-349-release-wiring 0/0, test-341-registry-drift 0/0, test-198-adapter-budget 0/0, test-380-gate-wiring 35 pass.

## Desktop payload (W5)

`node scripts/release-lib/build-desktop-artifact.cjs --check` exits 0: files=2061 (gate 4500), bytes=34405128 (gate 180000000), maxRatio=18.2 (gate 50). `npm pack --dry-run` lists `hooks/mos-face.json` and 22 files under `lib/mos-face/dist/`, no `ui/` path. So the Desktop copy carries the new hooks entry and the dist.

## RULE 10 text added (docs/RELEASE-CEREMONY-RULING-SYSTEM.md, before The limit)

"The face panel. The real-room run never draws the panel: it runs the research jobs on a fixture room and prints a report, and the panel is a Claude Code terminal screen that no job opens (Phase 380, MOD380-06). What stands in its place is `tests/run-all-380.sh`, a hard leg inside the release suite gate: it runs the panel's own tests in the real engine, loads the packed plugin on an installed layout, and fails the cut when claude, npm or the registry is missing. The real terminal screenshots of the panel, kept with the phase, show what a person sees. The person who signs the receipt must also record what the panel does on the cut's Desktop copy. No panel is claimed there, and no test proves it draws nothing there, so the observation is written down at the cut."

CHANGELOG Unreleased, Added: "The /m:os face panel now ships inside the plugin, for the Claude Code terminal ..." (Theo is the only name; framework name, problem type and optional short excerpt; `/mos-words` turns it off; Desktop and Cowork do not draw it).

## Deviations from Plan

**1. [Rule 3 - Blocking] State owner renamed from mos-face to mos (commit bfc7cd798).**
- Found during: Task 2, first real-engine run.
- Issue: the plan expected a types field to cure a refused state namespace. It does not (measured above); the engine refuses `state.set` for any plugin that is not the owner, and the owner is the plugin name.
- Fix: rename in source, types declaration, package manifest name, test fixtures; rebuild dist. The files are outside the plan's `files_modified` list; the alternative (a build-time rewrite of the dist only) would ship code the 34 engine tests never ran, so the source was changed instead. This is a reversible commit.
- Consequence for the owner's live dev copy (`~/.claude/dev-mods/*/mos-face`, plugin name mos-face, not edited): it keeps its own namespace. If both the shipped plugin and the dev copy are enabled in one session, two panels draw. UNVERIFIED how the engine lays out two panels; remove or disable the dev copy before testing the shipped one.

**2. [Rule 3] Candidate B instead of A,** by the plan's own decision rule (criterion 3 failed for a reason the types field does not fix).

**3. [Rule 2] Test W6 skips when the planning file is absent** (the pre-plan sha lives in the untracked planning tree, not in the repo). It runs here (found, 3 checks pass). The `git diff --quiet PRE HEAD` check on release.sh and suite-gate.sh is NOT in the permanent test (it would break at the first later legitimate edit); it ran in this plan's verify block.

## Edits to existing tests (full list)

- `ui/mos-face/panel.test.tsx`: 2 fixture literals `plugin: 'mos-face'` to `'mos'` (BAND, PANE).
- `ui/mos-face/tests/support.ts`: 2 literals, same.
- `ui/mos-face/tests/colors.test.tsx`: 1 literal.
- `ui/mos-face/tests/copy.test.tsx`: 3 literals.
- `ui/mos-face/tests/face-events.test.ts`: 2 literals.
- `tests/test-380-build.cjs`: B8 throwaway plugin name `mos-face` to `mos`.
No test of other phases was edited (the juq and 380-budget tests stay untouched because B was chosen). Test names and test counts are unchanged (still 34 originals in panel.test.tsx, 182 in total).

## Known pre-existing failure (not fixed here, follow-up)

`bash tests/test-release-npm-gate.sh` prints `FAIL: release.sh does not reference @mindrian_os/install -- Plan 123-01 D-21 rename not landed` (re-run at HEAD in this plan). The string is absent at origin/main. Follow-up for the owner of the release scripts.

## Files created outside the repo

All under the scratchpad folder `/tmp/claude-1000/-home-jsagi/c03816a4-113f-4230-9448-0156b88f0247/scratchpad/s09/` (about 20 MB): validate reports, hook-test logs, run-all logs, scratch plugin folders (A, B, D1, D2, M, M2, X), `eng.sh`, `hooktests.sh`. Each layout run, engine run and pack uses its own `mkdtemp` root under the system temp folder and removes it in a finally (no `/tmp/mos-380-*` left behind). Nothing was installed in the real `~/.claude/plugins`; no `claude plugin install` or `update` was run. The real `~/.claude/.credentials.json` was only read through a symlink in a scratch config folder; its mtime is 2026-10-24 00:13 (inside the window of my runs). Many other claude sessions run on this machine and refresh that file too, so I cannot prove the change is not from a run of mine through the symlink (RISK, UNVERIFIED).

## Known Stubs

None.

## Threat Flags

None new. T-380-33 (no new shell hook): L4 plus the shell-hooks equality to the pre-plan sha. T-380-34: activation is the last code change; run-all-380 and `build --check` were green first. T-380-35: strict legs plus W8. T-380-36: `build --check` inside run-all-380, L3 re-hash. T-380-37 accepted: Desktop behavior UNVERIFIED, recorded in RULE 10. T-380-SC: `npm ci --ignore-scripts` of the repo shrinkwrap in scratch only; no new package.

## UNVERIFIED (carried)

- What Desktop, Cowork, VS Code or mobile draw (engine type header lists desktop, vscode, mobile as mod surfaces).
- A green rerun of BW4 and of the full run-all-366 under low machine load.
- That the real credentials file was not touched by a refresh through my scratch symlink.
- How two panels look if the dev copy and the shipped plugin are both enabled.

## Self-Check

- FOUND in the release tree: tests/test-380-installed-layout.cjs, tests/test-380-gate-wiring.cjs, hooks/mos-face.json, lib/mos-face/dist/register.js.
- Commits 4cc0284e6, bfc7cd798, 61b637a1d, 3dac681e4: FOUND in `git log` of release-tree main; `git diff --diff-filter=D` on each shows no deletion.
- `node scripts/build-mos-face.cjs --check` exits 0.

## Self-Check: PASSED (with the load caveat above)
