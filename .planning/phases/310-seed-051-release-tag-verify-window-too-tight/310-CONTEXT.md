# Phase 310: SEED-051 - release.sh Step 5.5 Tag-Verify Window Too Tight

## Domain

Fix the disclosed false-alarm bug in `scripts/release.sh` Step 5.5 (tag-push verification,
lines ~1338-1372): a still-not-visible tag at origin after the retry window is treated as a
hard abort (`exit 1`) even when the push demonstrably succeeded and the tag simply had not
finished replicating on GitHub's side yet. This happened for real on the v1.15.0 release
(2026-07-02): every actual release action succeeded, but the ceremony ended on a false red.

## What was already done before this phase (PARTIAL, confirmed by direct code read)

`RELEASE_TAG_PUSH_RETRIES` (default 3) and `RELEASE_TAG_PUSH_BACKOFF_S` (default 5s) are
already env-configurable, plus a documented `SKIP_TAG_VERIFY=1` emergency bypass
(audit-logged). This closes the seed's first bullet (widen the retry window) partially - the
window is configurable, not yet widened by default, and the seed's actual core ask (treat a
still-not-visible tag as a WARNING, not an abort, when the push demonstrably succeeded) is
NOT implemented: the block still ends in an unconditional `exit 1` (line ~1371).

## Decision: the "push demonstrably succeeded" condition, precisely

`set -euo pipefail` is active at the top of `release.sh` (line 71). Step 9's push
(`git push origin main --tags`) runs with `errexit` active, so if that combined push failed
outright, the script would already have exited before Step 5.5 is ever reached - Step 5.5
being reached at all is a partial guarantee the push command itself returned 0.

This is NOT sufficient on its own: `git push <remote> <branch> --tags` pushes multiple refs
in one invocation, and a partial failure (main succeeds, one tag ref rejected) is a real,
documented git edge case that does not always surface as a distinguishable exit code per-ref.
**Decision: add an explicit, independent `git ls-remote origin refs/heads/main` check that
`main`'s remote SHA matches local `HEAD`'s SHA, as the seed's own "push demonstrably
succeeded" condition** - not relying on `set -e` alone. Only when that independent main-match
check passes does a still-not-visible tag downgrade to a warning; if main itself does not
verify at origin, the original hard abort behavior is preserved (a genuinely failed or
partial push must still stop the ceremony).

## Decision: extract the gate into a pure, testable function (Canon Part 7 pattern)

Step 5.5's current form is inline bash with no injectable seam, making its abort-vs-warn
logic untestable without actually running a release against a real or sandboxed remote (the
existing `tests/test-release-bump-tag-and-publish-gates.cjs` sandbox harness tests
`--dry-run` output, but `--dry-run` short-circuits BEFORE Step 5.5 runs at all, so today's
gate has zero behavioral test coverage, only a structural/regex source-text check).

**Decision: extract the gate's decision logic into a small, separately-invokable shell
function or script (e.g. `scripts/release-lib/verify-tag-push.sh`, or an inline function
`_verify_tag_at_origin` sourced by `release.sh`) that takes its two `git ls-remote` calls as
overridable command hooks** (mirroring this session's own `spawnImpl`-injection pattern used
throughout `scripts/skillopt-*.cjs`), so a test can substitute fake `git` output (tag never
appears, tag appears late, main matches, main does not match) without any real network call
or real git remote. `release.sh` itself calls the extracted function with real `git`; the
test calls it with fakes.

## Decision: what changes for the ceremony's other steps

Per the seed's third bullet: Steps 9.8/10/11 (final acceptance, marketplace update,
post-verify) must still run even when Step 5.5 warns instead of erroring. Since the warning
path no longer calls `exit 1`, this should already hold structurally once the abort is
replaced with a warning - confirm it explicitly rather than assume, since `set -e` means any
OTHER unguarded nonzero exit in the warning branch would still silently abort the ceremony.

## Canonical Refs

- `.planning/seeds/SEED-051-release-tag-verify-window.md` - the seed, the v1.15.0 false-alarm proving case
- `scripts/release.sh` lines 71 (`set -euo pipefail`), 1298-1330 (Step 8/9, the push this gate follows), 1338-1372 (Step 5.5 itself), 1370-1420 (Step 9.8, the next gate that must still run)
- `tests/test-release-bump-tag-and-publish-gates.cjs` - the existing sandbox test harness; read its `runReleaseDryRun`/`makeSandbox` pattern to understand why `--dry-run` cannot exercise this gate, and do not attempt to extend dry-run coverage to Step 5.5 - build a separate, pure-function test instead

## Deferred Ideas (out of this phase's scope)

- Any change to Step 9's push mechanism itself (still one combined `git push origin main --tags`).
- Any change to `SKIP_TAG_VERIFY`'s existing emergency-bypass behavior.
- Widening the DEFAULT retry count/backoff beyond what is already configurable - the seed's
  own fix is about the abort-vs-warn decision, not the specific numbers, and changing shipped
  defaults on the real release ceremony is a separate, lower-priority call.
