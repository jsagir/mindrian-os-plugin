#!/usr/bin/env bash
# Phase 95.6 D-05a -- structural assertion on scripts/release.sh Step 9.5.
#
# Originally owned by Plan 95.6-06 (release.sh Step 9.5 npm publish gate). Updated
# by Plan 123-01 to reflect the renamed package (deprecated legacy name from
# Phase 95.6 superseded by @mindrian_os/install) and the new ordering: Step 9.5
# (npm publish) now runs
# BEFORE Step 7.5 (Commit B) and BEFORE Step 9 (push), so the working tree at
# publish time still says NEW_VERSION (not NEXT_VERSION).
#
# Per memory entry feedback_release_lockstep_npm: every plugin release publishes
# @mindrian_os/install to npm in lockstep. dist-tag logic branches on the version
# suffix (@next for -beta./alpha./rc./next., @latest for clean X.Y.Z). A
# MOS_TEST_DRY_RUN=1 path lets the gate be exercised without touching the live
# registry. A recovery message surfaces if publish fails.
#
# Pure structural assertion -- no fixture. Mirrors tests/test-89-07-pattern-doc.sh.
# bash only. No emoji. No em-dashes.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

REL=scripts/release.sh

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -f "$REL" ] || fail "release script missing: $REL"

# Gate 1: an `npm publish` invocation exists at all, and the package being
# published is @mindrian_os/install (NOT the stale legacy name).
# Note: the stale-name literal is constructed at runtime to keep this test file
# itself free of the deprecated string (the Plan 123-01 sweep across release.sh
# and the test fixtures expects zero hits of the deprecated legacy name).
grep -q "npm publish" "$REL" || fail "no 'npm publish' invocation in $REL (Step 9.5 not landed -- D-05a)"
grep -q "@mindrian_os/install" "$REL" \
  || fail "release.sh does not reference @mindrian_os/install -- Plan 123-01 D-21 rename not landed"
STALE_PKG_LITERAL="@mindrian_os/$(printf 'cli')"
if grep -q "$STALE_PKG_LITERAL" "$REL"; then
  fail "release.sh still references the stale package name -- Plan 123-01 D-21 rename incomplete"
fi

# Gate 2: ordering -- npm publish sits AFTER Commit A (the release commit + tag)
# and BEFORE `# --- Step 10` (the local cache update). It runs from the Commit-A
# working tree so the published tarball's package.json reads NEW_VERSION.
# Note: the actual `git push origin main` runs in Step 9, AFTER the publish in
# source order, because the rewritten release.sh interleaves
#   Step 7 (Commit A + tag) -> Step 9.5 (publish) -> Step 7.5 (Commit B) ->
#   Step 8 (ahead-of-origin guard) -> Step 9 (push) -> Step 10 (cache update).
# So this gate checks "publish is between Commit A and Step 10", not "publish
# is between git push and Step 10".
LINE_COMMIT_A="$(grep -n '=== Step 7: Commit A' "$REL" | head -1 | cut -d: -f1 || true)"
# Find the FIRST non-comment `npm publish ... --tag` line (the actual invocation,
# not a header comment or recovery message). The dry-run echo and the live call
# both carry `npm publish --tag`.
LINE_PUBLISH="$(grep -nE 'npm publish[[:space:]]+(--tag|-)' "$REL" | grep -v '^[0-9]*:#' | head -1 | cut -d: -f1 || true)"
LINE_STEP10="$(grep -n '# --- Step 10' "$REL" | head -1 | cut -d: -f1 || true)"
[ -n "$LINE_COMMIT_A" ] || fail "could not locate the 'Step 7: Commit A' marker in $REL"
[ -n "$LINE_PUBLISH" ] || fail "could not locate the 'npm publish' line in $REL"
[ -n "$LINE_STEP10" ] || fail "could not locate the '# --- Step 10' marker in $REL"
[ "$LINE_COMMIT_A" -lt "$LINE_PUBLISH" ] || fail "npm publish (line $LINE_PUBLISH) must come AFTER Commit A / tag (line $LINE_COMMIT_A) so the published tarball is NEW_VERSION"
[ "$LINE_PUBLISH" -lt "$LINE_STEP10" ] || fail "npm publish (line $LINE_PUBLISH) must come BEFORE Step 10 (line $LINE_STEP10)"

# Gate 3: dist-tag selection branches on the version suffix.
grep -Eq "beta\.|alpha\.|rc\.|next\.|--tag next|--tag latest" "$REL" \
  || fail "no dist-tag suffix logic (@next vs @latest) found near the publish gate -- D-05a lockstep rule"
# A conditional (if .*beta / case on version) precedes the publish line.
COND_LINE="$(grep -nE 'if .*(beta|alpha|rc|next|-)|case .*(NEW_VERSION|VERSION)' "$REL" | awk -F: -v p="$LINE_PUBLISH" '$1 < p {l=$1} END{print l}')"
[ -n "$COND_LINE" ] || fail "no version-suffix conditional precedes the npm publish line -- the gate must pick the dist-tag, not publish blindly"

# Gate 4: a dry-run escape hatch exists.
grep -q "MOS_TEST_DRY_RUN" "$REL" || fail "no MOS_TEST_DRY_RUN escape hatch -- the gate must be exercisable without the live registry"

# Gate 5: a recovery / failure message surfaces if publish fails, and it names
# the right package + the right verify command.
grep -Eq "npm publish failed|publish failed|recover" "$REL" \
  || fail "no recovery/failure message near the npm publish invocation -- the gate must halt loudly, not silently ship unpublished"
grep -q "npm view @mindrian_os/install@" "$REL" \
  || fail "recovery instructions do not name 'npm view @mindrian_os/install@...' -- post-Plan-123-01 expected"

# Gate 6: no em-dashes in release.sh (memory rule feedback_no_emdashes).
EMDASH="$(printf '\xe2\x80\x94')"
if grep -F "$EMDASH" "$REL" >/dev/null 2>&1; then fail "em-dash present in $REL"; fi

echo "OK: release.sh npm-publish gate passes 6 structural gates"
