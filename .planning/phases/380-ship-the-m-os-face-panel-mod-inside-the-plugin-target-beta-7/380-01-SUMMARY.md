---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 01
subsystem: ui-mod-packaging
tags: [mos-face, walled-package, wall-test, engine-tests, aggregator]
requires: []
provides:
  - ui/mos-face walled package (release tree, main)
  - tests/test-380-wall.cjs
  - tests/test-380-engine-tests.cjs
  - tests/run-all-380.sh
affects: [380-02, 380-03, 380-04, 380-05, 380-06, 380-07, 380-08, 380-09, 380-10, 380-11]
tech-stack:
  added: [typescript 7.0.2 (devDependency of ui/mos-face only)]
  patterns: [walled package, fail-closed aggregator legs (run_strict, run_strict_if)]
key-files:
  created:
    - ui/mos-face/** (16 adopted source files)
    - ui/mos-face/package.json
    - ui/mos-face/package-lock.json
    - ui/mos-face/.gitignore
    - ui/mos-face/README.md
    - tests/test-380-wall.cjs
    - tests/test-380-engine-tests.cjs
    - tests/run-all-380.sh
  modified:
    - ui/mos-face/panel.test.tsx (two em-dash literals spelled as an escape, see Deviations)
key-decisions:
  - "Test count is 34, measured. The 29 in 380-HANDOFF.md line 11 is wrong (D-06)."
  - "The dash fence found 2 em-dash literals in the adopted test file. They became the escape u2014. The assertion is unchanged."
requirements-completed: [MOD380-02, MOD380-04]
duration: about 25 minutes
completed: 2026-10-23
---

# Phase 380 Plan 01: Adopt the mod as a walled package - Summary

The face panel mod now lives in the release tree as the walled package `ui/mos-face`, with its own lockfile, a wall test, a 34-test wrapper and the phase aggregator `tests/run-all-380.sh`.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing was pushed. No branch was created or switched.

## Commits (release tree)

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 8bef2d5fc | feat(380-01): adopt the mos-face panel source as found (byte-identical to ~/dev/mos-face-mod) |
| 2 | 74d8695e3 | feat(380-01): walled package manifest, lockfile and wall test |
| fix | ee2359b83 | fix(380-01): spell the em-dash probe in panel.test.tsx as an escape so the dash fence is honest |
| 3 | 54af25284 | test(380-01): engine-test wrapper and the phase aggregator |

## Preflight (PROVEN)

- `git branch --show-current`: `main`.
- `git status --porcelain --untracked-files=no`: empty.
- `node lib/core/repo-version.cjs`: `2.0.0-beta.74`.
- `git rev-list --count origin/main..main`: 1 before this plan. 5 after (the 1 earlier commit plus the 4 above). Review all 5 before any push.
- `diff -rq -x types` between the backup and the live copy `~/.claude/dev-mods/0edce8e1-.../mos-face`: no output, exit 0. The `-x types` flag also hides the top-level `types/` folder, so a second `diff -rq` ran on `types/`, on `hooks/` and on `plugin.json`: all identical. The backup equals the live copy.

## Adopt proof (T-380-01)

- 16 files copied. `cmp` against the backup: no difference for any file, before the adopt commit.
- `.claude-plugin/types/` was not copied. The `.gitignore` of the package excludes it.
- `grep -c '^test(' panel.test.tsx`: 34.
- sha256 of the adopted files (the state at commit 8bef2d5fc):

```
37dc0274f53d527fe571154c7057035aa9d980c2228beca60168c09aac92fda1  .claude-plugin/plugin.json
19ba59881d96ce3d330fbe82c4618ec18f6dc84ab982e2e3082b087226fa7bcb  hooks/advice.ts
6614a1e684afb300296e41ea52ca08d553162017bc01538c7bba9ca7d64d2d5e  hooks/bind.ts
60f2c9938caeebac0d42050d6b88afb62d9c69abeba089b0d0bcf2c27ea6017b  hooks/commands.ts
976ab158ad82910d492cfc716d724376c568a72cf24c4a4dc33980b01345ad4e  hooks/face.ts
2ec0c786400054912c707070a49a2106c4b2763b4775b4157ca07054f2ff571e  hooks/glossary.ts
d842d789476d67282d0f04b7e5fdc68a3d981ccec65dd79cfa2d11eed13fb828  hooks/hooks.json
82f00e202e19854106af35c4572d515201b70a8bebecdaab88d378b29f30c935  hooks/lines.ts
2ee1158b9facc1e149ade292ceb17b8d91b238d0342c11fe36477bd704d0ce26  hooks/meter.ts
cfa943d033d42e2c6769c84cb76e7670a5e8648ccb4ceba5bc2100f08fb9dfd9  hooks/probe.ts
0cb85d567e99b577b528d579662d37ab4a7c793f9b6a9914b879d96b2639623a  hooks/register.tsx
a656f9725eb8de4b96e5102e5f1eb2b310f958368e5b21159667a3f56487a4f2  hooks/source.ts
c57caaa989ebb300668ae7cba861ebcf8b841845a75e2243de149357f5cca417  hooks/voice.ts
9e979bdbd2ede429a93e5259b6c03e468074b240f7d8c820d0ea5af39876d85d  panel.test.tsx   (before the fix commit)
4087cf0ba92fde503ed0e7c56f37bcb26ad0c085873f10219d0336c0f19b5a8f  tsconfig.json
c2089fef35a7717908193f1bdbcd9ae7047718e762bc294b7610b3e1e65e2a2b  types/index.d.ts
```

## 34 versus 29 (T-380-03)

`claude --version`: 2.1.309 (Claude Code). `claude plugin test .` in `ui/mos-face`:

```
 34 pass
 0 fail
Ran 34 tests across 1 file. [3.34s]
```

380-HANDOFF.md line 11 says "29 engine tests". That figure is wrong. The count is 34, both declared (`^test(` lines) and passed. The file was not edited (owner file). ROADMAP.md still needs the MOD380-02 correction to 34 (D-06); this plan did not change ROADMAP.md.

`claude plugin validate ui/mos-face`: "Validation passed with warnings". Informational, not a gate:
- The repository root was taken to be the release tree and LICENSE was taken from it.
- `hooks/hooks.json` names a hooks module under `modules`. The directory checks apply no rules to such code.
- Advice: the README has no marketplace install line for `mos-face`. No action: the package is not published on its own.

## Wall test: RED then GREEN

- RED (before the manifest existed): W3, W4, W7 FAILED (package.json, package-lock.json missing). W1, W2, W5, W6 passed.
- GREEN (after): `7 passed, 0 failed`.
- W6 (mutation arm) proves the check function rejects a root manifest with a typescript devDependency, and that the clean copy still passes.
- `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` then `npm ci --ignore-scripts`: both ran; the registry was reachable; 2 packages added at the top level of `node_modules` (typescript and its scoped native packages; 21 `node_modules/` lock keys). The lock entry for typescript equals tools/ts-check: version 7.0.2, same integrity string (W4).
- `git diff --quiet HEAD -- package.json npm-shrinkwrap.json`: exit 0. The root manifests are unchanged.
- npm 10.9.8.

## Aggregator run (PROVEN)

`bash tests/run-all-380.sh`: `PASSED=3 FAILED=0 SKIPPED=10 KNOWN=0`, exit 0.
- PASSED: engine tests (34), wall, dash fence.
- SKIPPED (missing file, later plans create them): typecheck, egress, budget, copy, face-commands check, decisions, build, installed-layout, gate-wiring, shots-harness.
- Fail-closed proof: with a PATH that holds only `node` and `bash`, the engine leg reports `FAILED (claude CLI missing: the engine tests did not run)` and the run ends `PASSED=1 FAILED=1 SKIPPED=11`.
- `bash -n tests/run-all-380.sh`: ok. `grep -c run_strict_if`: 3 (a comment line, the definition and the one use).
- `run_strict_if` exit-77-is-FAILED branch is not exercised yet, because `tests/test-380-installed-layout.cjs` does not exist. It is code-reviewed only (UNVERIFIED by a run).

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] Em-dash literals in the adopted test file tripped the dash fence**
- **Found during:** Task 3, first run of `tests/run-all-380.sh`.
- **Root cause:** `panel.test.tsx` lines 373 and 572 assert `expect(text).not.toContain('<em-dash>')` and wrote the literal character. The phase dash fence scans all of `ui/mos-face`, so it flagged the test file. The adopt commit had to stay byte-identical, so the fix came after it.
- **Fix:** the literal became the escape `'—'`. The assertion is identical. After the fix, 34 pass, 0 fail.
- **Files modified:** `ui/mos-face/panel.test.tsx`
- **Commit:** ee2359b83 (separate commit; the adopt commit 8bef2d5fc stays byte-identical to the backup).
- **Consequence:** `ui/mos-face/panel.test.tsx` now differs from `~/dev/mos-face-mod` by those 2 lines. Later plans must treat the repo copy as the source of truth.

None other: the plan ran as written.

## Notes for later plans

- Environment: the shell `grep` in this session is a function that wraps `ugrep`. `grep -P` with byte escapes gave false negatives at the prompt. The aggregator runs under `bash` with GNU grep and `LC_ALL=C` and found the hit. Verify the dash fence with GNU grep (`/usr/bin/grep`) or with a Node byte search, not with the session function.
- `ui/mos-face/node_modules` exists now (ignored by `.gitignore`). `ui/mos-face/.claude-plugin/types/` is written by the engine on test and stays uncommitted.
- Scripts named in `ui/mos-face/package.json` (`typecheck`, `build`, `check`, `copy-check`, `shots`) do not exist yet. Later plans create them.
- Tri-polar: the panel draws in the Claude Code terminal only. Desktop and Cowork get no panel in this phase. This is a deliberate skip (D-05, N7), stated in the package README.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or file access outside the plan's threat model. T-380-01, T-380-02, T-380-SC and T-380-03 are mitigated as listed above.

## Self-Check: PASSED

- Files exist in the release tree: `ui/mos-face/package.json`, `ui/mos-face/package-lock.json`, `tests/test-380-wall.cjs`, `tests/test-380-engine-tests.cjs`, `tests/run-all-380.sh` (checked by running them).
- Commits 8bef2d5fc, 74d8695e3, ee2359b83, 54af25284 are on `main` in the release tree (`git log` shows all 4).
