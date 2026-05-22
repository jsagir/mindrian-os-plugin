---
status: investigating
trigger: "release-sh-post-publish-gates-misfire"
created: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Two gates in scripts/release.sh that run AFTER the irreversible npm publish (Step 9.5) misfire on a correct release. Step 9.7 (npx self-test) races npm CDN propagation; Step 9.8 (doctor --acceptance) reads the post-Commit-B next-dev version from plugin.json instead of the released version. Both fired during the v1.13.0-beta.24 cut on 2026-05-22, aborting release.sh after npm publish had already succeeded and forcing a full manual completion of Steps 7.5 -> 11.
test: Re-cut a beta from a clean tree; confirm Step 9.7 survives a cold npm publish and Step 9.8 checks the RELEASED version not the next-dev version.
expecting: Step 9.7 retries npx until the just-published version resolves; Step 9.8 derives the release-of-record version from marketplace source.ref (or the newest vN tag), never from a post-Commit-B plugin.json.
next_action: Fix bug_1 (Step 9.7 propagation retry) and bug_2 (Step 9.8 version source). Both are release-pipeline correctness bugs in a path that runs post-publish, so a misfire leaves a half-published release. Ship as a release.sh-only change; verify via --dry-run plus one real beta cut.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `bash scripts/release.sh --prerelease --allow-ahead --no-minisite` runs end to end and cuts the beta cleanly: npm publish, Commit B, push, post-publish verification all green.
actual: release.sh aborted (exit 1) AFTER Step 9.5 npm publish succeeded. Commit A + tag v1.13.0-beta.24 existed locally, @mindrian_os/install@1.13.0-beta.24 was live on npm, but Commit B had not run and nothing was pushed. A partial release.
errors: Step 9.7 npx self-test wrote only `sh: 1: mindrian-os: not found` to /tmp/npx-selftest-out.log. Separately, a later `node scripts/doctor.cjs --acceptance` reported FAIL version-of-record-published ("git tag v1.13.0-beta.25 not found") and FAIL npx-roundtrip ("npx round-trip failed (127)").
reproduction: Cut any beta with release.sh. Step 9.7 runs npx against the just-published package within seconds of publish. Step 9.8 runs doctor --acceptance after Commit B has bumped plugin.json to the next-dev version.
started: Observed on the v1.13.0-beta.24 cut, 2026-05-22. Step 9.7 + Step 9.8 are Phase 126 Plan 04 additions; Step 9.7 was already hotfixed once (Phase 126.1).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The published @mindrian_os/install@1.13.0-beta.24 package is broken.
  evidence: The published tarball was inspected (well-formed bin/files) and the installer was run three independent ways - normal env, HOME-override sandbox, and the exact Step 9.7 no-subcommand invocation - all exit 0 and install correctly. The package is good.
  timestamp: 2026-05-22T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-22T00:00:00Z
  checked: bug_1 - Step 9.7 npx self-test (scripts/release.sh ~line 783)
  found: Step 9.7 runs `npx --yes @mindrian_os/install@$NEW_VERSION` within seconds of the Step 9.5 `npm publish`. The just-published version is not yet resolvable on the npm CDN, so npx fails to resolve/link the package bin and the shell reports `mindrian-os: not found`. Minutes later the identical invocation succeeds (verified 3x). Classic publish/propagation race.
  implication: Step 9.7 needs a poll-and-retry on npx (mirror the Step 5.5 tag-verify retry loop: RELEASE_TAG_PUSH_RETRIES style), or gate on `npm view @mindrian_os/install@$NEW_VERSION version` resolving before the npx test runs.

- timestamp: 2026-05-22T00:00:00Z
  checked: bug_2 - Step 9.8 doctor --acceptance (scripts/doctor.cjs version-of-record-published + npx-roundtrip)
  found: Both checks read `plugin.json.version` directly (doctor.cjs:2362-2363 and :2398-2399). release.sh runs Step 9.8 AFTER Step 7.5 Commit B, which bumps plugin.json to the next-dev pre-release (e.g. beta.25). So version-of-record-published looks for git tag v1.13.0-beta.25 (never created - beta.25 is unreleased by design) and npx-roundtrip runs `npx @mindrian_os/install@1.13.0-beta.25` (never published) -> exit 127. Both FAIL on a perfectly correct release.
  implication: The post-publish acceptance checks must derive the release-of-record version from marketplace.json `source.ref` (Commit B deliberately leaves it at v<released>) or the newest vN git tag - never from plugin.json after Commit B. Alternatively release.sh must run the post-publish --acceptance before Commit B. As written, Step 9.8 would HARD ABORT every release run from the dev tree.

- timestamp: 2026-05-22T00:00:00Z
  checked: v1.13.0-beta.24 release-of-record, direct verification
  found: git tag v1.13.0-beta.24 present on origin; marketplace.json source.ref = v1.13.0-beta.24; npm view @mindrian_os/install@1.13.0-beta.24 = 1.13.0-beta.24; npm dist-tag `next` -> 1.13.0-beta.24; install minisite live at v1.13.0-beta.24. The release itself is complete and correct - only the two gates misfired.
  implication: beta.24 shipped fine via manual completion of Steps 7.5 -> 11. The bug is purely in the two post-publish gates, not in the release artifact.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: PARTIAL. Two independent release-pipeline defects, both in post-publish gates:
  bug_1 - Step 9.7 npx self-test has no retry, so it races npm CDN propagation and false-fails on a cold publish.
  bug_2 - Step 9.8 doctor --acceptance reads the version from plugin.json, which Step 7.5 Commit B has already advanced to the next-dev pre-release, so it checks a version that was never released.
The combined effect: release.sh cannot complete a release unattended - it aborts post-publish, leaving a half-published state that needs manual recovery.

fix: NOT YET APPLIED. Proposed: (1) Step 9.7 - wrap the npx call in a retry loop with backoff, or precondition it on `npm view` resolving. (2) Step 9.8 - the version-of-record-published and npx-roundtrip checks should accept an explicit released-version argument, or read marketplace source.ref / newest vN tag, instead of plugin.json. release.sh should pass the released vN to doctor --acceptance.

verification: pending - re-cut one beta end to end with release.sh and confirm both gates pass without manual intervention.

files_changed: none yet (investigation only).
