---
kind: rca
slug: release-step-9.7-npx-self-test-false-alarm
status: resolved
severity: high
surface: release-pipeline
filed: 2026-05-31
filed_by: Phase 135 / beta.38 release session
owner: scripts/release.sh (release-infra owner)
observed_on:
  - v1.13.0-beta.37 (parallel session)
  - v1.13.0-beta.38 (this session)
---

# RCA: release.sh Step 9.7 npx-publish self-test aborts HEALTHY releases

## Summary

Step 9.7 (`npx-publish self-test`) runs `npx @mindrian_os/install@<version>` in a
fresh temp dir and treats a non-zero exit as "the published npm package is broken
for new installs", triggering the `R.4 yank + cut successor` recovery. The package
is NOT broken. `cli.js` shells out to the `mindrian-os` command, which is not on
the ephemeral npx sandbox PATH, so the shell prints `sh: 1: mindrian-os: not found`
and exits non-zero. The gate cannot distinguish "bin missing from the package"
(a real failure) from "bin present but shells to a command absent in the sandbox"
(a false alarm). Result: the gate aborts a release that actually published fine.

## Evidence (package is healthy)

- `npm view @mindrian_os/install@1.13.0-beta.38 bin` -> `{ 'mindrian-os': 'bin/cli.js' }` (bin IS published).
- npm publish succeeded; `dist-tags.next = 1.13.0-beta.38`.
- install minisite + website both live-polled green at beta.38.
- Identical abort on beta.37 (parallel session) and beta.38 (this session) -- same artifact, same false signal.

## Impact

The abort fires AFTER `npm publish` + both Vercel deploys but BEFORE the git push
completes, leaving a contained split-brain: npm `@next` + websites at the new
version, but plugin `origin/main` + tag + marketplace still at the prior version.
Every prerelease therefore requires manual completion:
`git push origin main --tags` (plugin) + marketplace push, then verify via
`git ls-remote`. Operational toil on every cut and a split-brain risk window.

`@latest` is unaffected (beta is `@next`, opt-in), and the marketplace install
pulls the git tag -- which is not pushed at abort time -- so no user can install a
half-published beta. The blast radius is operator toil, not user breakage.

## Root cause

The gate asserts on `cli.js`'s exit code. `cli.js` is a launcher that execs the
`mindrian-os` command; in the bare npx temp sandbox that command is not on PATH,
so the launcher exits non-zero for an environment reason, not a packaging reason.

## Fix options (recommend A)

- **A (recommended): assert the bin FILE is present + parseable in the resolved
  package**, not cli.js's runtime exit. Resolve the installed package's `bin`
  path and `test -f` + `node -c` it. That is the true signal of
  "publishable + installable" without depending on the launcher's PATH-sensitive
  shell-out.
- B: put the npx bin dir on PATH before the self-test so the shell-out resolves.
- C: invoke a non-shelling subcommand (`--version` / `--help`) that returns 0
  without exec'ing the sibling command.

## Non-code follow-up (until fixed)

Every prerelease cut must expect the 9.7 abort and complete with the two manual
pushes + marketplace catalog refresh. Documented here so the next operator does
not mistake the false alarm for a real `R.4 yank` situation.

## Note for the release-infra owner

This is separate from the ancient-stash corruption that briefly put merge markers
into release.sh on 2026-05-31 (that was restored from HEAD). The 9.7 gate is a
genuine over-strict-gate defect and should be hardened before the next cut.

## RESOLVED 2026-06-02 (recommendation A)
Both the release.sh Step 9.7 self-test AND the doctor.cjs `npx-roundtrip` acceptance
check now verify the published package via `npm install @mindrian_os/cli@<version>`
into a sandbox + assert bin/cli.js PRESENT + `node --check` PARSES + the
`.bin/mindrian-os` symlink exists. They no longer assert the PATH-sensitive
npx-by-name launcher runtime. Verified: the new logic PASSES against the
already-published (healthy) 1.13.0-beta.43. Package was also renamed
@mindrian_os/install -> @mindrian_os/cli (npx-safe; the unscoped `install`
collided with coreutils) and slimmed to the installer essentials. Contract
codified in docs/RELEASE-CEREMONY-RULING-SYSTEM.md (RULE 3).
