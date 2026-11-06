---
quick_id: 261106-eureka-critic-baseline-ships
status: complete
date: 2026-11-06
---

# Quick 261106: eureka_critic baseline file now ships

## Root cause

lib/core/eureka-critic.cjs builds BASELINE_PATH as `<plugin root>/evals/eureka/212-critic-baseline.json`
and reads it with fs.readFileSync on every criticRule call. The file is tracked in git, but
package.json "files" listed no entry for evals/. The npm pack payload therefore lacked the file,
and the installed copy failed with ENOENT. The tool needs no engine, so the fault was packaging only.

## Change

- package.json "files": added `"evals/eureka/212-critic-baseline.json"` and `"!evals/eureka/README.md"`.
  The second entry is needed because npm always packs a README.md that sits in an included folder
  (arm 3 of the new test caught `evals/eureka/README.md` after the first entry alone). The negated
  entry uses the same form as the existing `!lib/...` and `!scripts/...` entries.
  Version and dependencies are unchanged. .npmignore does not exist. npm-shrinkwrap.json has no
  "files" key, so it needs no change.
- tests/test-quick-261106-critic-baseline-ships.cjs (new): 3 arms (file exists and parses; payload holds
  the file; payload holds no other evals/ file). RED before the change (arm 2 failed), 3/3 after.
- tests/test-387-eureka-installed-layout.cjs: the critic pin was narrowed to the answering state
  (a ruling JSON with a verdict). A peer commit (1a2179deb) had already loosened it to accept both the
  ENOENT error and a ruling, and asked for narrowing once this fix landed. The comment cites this quick.

## Verification (PROVEN, all run offline)

| Suite | Before | After |
|-------|--------|-------|
| test-quick-261106-critic-baseline-ships | arm 2 FAIL | 3/3 PASS |
| test-341-shrinkwrap-no-dev | PASS | PASS |
| test-341-payload-ceiling | PASS | PASS |
| test-341-payload-shrinkwrap-present | PASS | PASS |
| test-341-release-shrinkwrap-gate | PASS | PASS |
| test-369-installed-layout | PASS | PASS |
| test-369-walled-manifest | PASS | PASS |
| test-369.1-desktop-artifact | PASS | PASS |
| test-369.1-bin-relocation | PASS | PASS |
| test-369.1-sharp-out | PASS | PASS |
| test-387-eureka-installed-layout | PASS (8) | PASS (8, narrowed pin) |

Installed-layout run (scratch npm pack extraction, no engine, no network): eureka_critic answered
`isError false` with `{"verdict":"pseudoscience","confidence":"unknown","reasoning_tag":"calibration_unknown"}`
in all 6 engine scenarios, bound and unbound. Input was synthetic (rubric_pattern 000000, tags
engineering and biology). The same call from the repo returns the identical answer.

## Notes

- Phase 388 (ship less) may later move this file under data/. If it does, change BASELINE_PATH in
  lib/core/eureka-critic.cjs, the files entry, and the new test together.
- The ruling for the synthetic pattern is calibration_unknown. That is the real answer for that
  pattern, not a stub. The baseline status is `calibrated`.

## Deviations

- Rule 1 (packaging): a second files entry `!evals/eureka/README.md` was added, because npm packed the
  folder README alongside the one named file. The task demanded exactly one evals file.
- Rule 3: the 387 pin edit was a narrowing of a peer-loosened pin, not a rewrite of a recorded error row.
