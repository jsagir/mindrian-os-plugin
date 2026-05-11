#!/usr/bin/env bash
# Phase 95.6 D-05a -- structural assertion on scripts/release.sh Step 9.5.
#
# Owning plan: 95.6-06 (release.sh Step 9.5 npm publish gate).
# RED until Plan 95.6-06 (release.sh Step 9.5 npm publish gate) lands.
#
# Per memory entry feedback_release_lockstep_npm: every plugin release publishes
# @mindrian_os/cli to npm in lockstep. The gate runs AFTER `git push` (Step 9) and
# BEFORE the local cache update (Step 10). dist-tag logic branches on the version
# suffix (@next for -beta./alpha./rc./next., @latest for clean X.Y.Z). A
# MOS_TEST_DRY_RUN=1 path lets the gate be exercised without touching the live
# registry. A recovery message surfaces if publish fails after the plugin push.
#
# Pure structural assertion -- no fixture. Mirrors tests/test-89-07-pattern-doc.sh.
# bash only. No emoji. No em-dashes.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

REL=scripts/release.sh

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -f "$REL" ] || fail "release script missing: $REL"

# Gate 1: an `npm publish` invocation exists at all.
grep -q "npm publish" "$REL" || fail "no 'npm publish' invocation in $REL (Step 9.5 not landed -- D-05a)"

# Gate 2: ordering -- npm publish sits between `git push` (Step 9) and `# --- Step 10`.
LINE_PUSH="$(grep -n 'git push origin main' "$REL" | head -1 | cut -d: -f1 || true)"
LINE_PUBLISH="$(grep -n 'npm publish' "$REL" | head -1 | cut -d: -f1 || true)"
LINE_STEP10="$(grep -n '# --- Step 10' "$REL" | head -1 | cut -d: -f1 || true)"
[ -n "$LINE_PUSH" ] || fail "could not locate the 'git push origin main' line in $REL"
[ -n "$LINE_PUBLISH" ] || fail "could not locate the 'npm publish' line in $REL"
[ -n "$LINE_STEP10" ] || fail "could not locate the '# --- Step 10' marker in $REL"
[ "$LINE_PUSH" -lt "$LINE_PUBLISH" ] || fail "npm publish (line $LINE_PUBLISH) must come AFTER git push (line $LINE_PUSH)"
[ "$LINE_PUBLISH" -lt "$LINE_STEP10" ] || fail "npm publish (line $LINE_PUBLISH) must come BEFORE Step 10 (line $LINE_STEP10)"

# Gate 3: dist-tag selection branches on the version suffix.
grep -Eq "beta\.|alpha\.|rc\.|next\.|--tag next|--tag latest" "$REL" \
  || fail "no dist-tag suffix logic (@next vs @latest) found near the publish gate -- D-05a lockstep rule"
# A conditional (if .*beta / case on version) precedes the publish line.
COND_LINE="$(grep -nE 'if .*(beta|alpha|rc|next|-)|case .*(NEW_VERSION|VERSION)' "$REL" | awk -F: -v p="$LINE_PUBLISH" '$1 < p {l=$1} END{print l}')"
[ -n "$COND_LINE" ] || fail "no version-suffix conditional precedes the npm publish line -- the gate must pick the dist-tag, not publish blindly"

# Gate 4: a dry-run escape hatch exists.
grep -q "MOS_TEST_DRY_RUN" "$REL" || fail "no MOS_TEST_DRY_RUN escape hatch -- the gate must be exercisable without the live registry"

# Gate 5: a recovery / failure message surfaces if publish fails.
grep -Eq "npm publish failed|publish failed|recover" "$REL" \
  || fail "no recovery/failure message near the npm publish invocation -- the gate must halt loudly, not silently ship unpublished"

# Gate 6: no em-dashes in release.sh (memory rule feedback_no_emdashes).
EMDASH="$(printf '\xe2\x80\x94')"
if grep -F "$EMDASH" "$REL" >/dev/null 2>&1; then fail "em-dash present in $REL"; fi

echo "OK: release.sh npm-publish gate passes 6 structural gates"
