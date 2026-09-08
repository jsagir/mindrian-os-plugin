#!/usr/bin/env bash
# scripts/release-lib/verify-tag-push.sh
#
# WHAT: a pure, injectable decision function for release.sh's Step 5.5
# tag-push verification gate: `mos_verify_tag_at_origin`.
#
# WHY (SEED-051, the v1.15.0 stable release false alarm, 2026-07-02): Step
# 5.5 used to hard-abort the WHOLE release ceremony (`exit 1`) whenever a
# just-pushed tag had not finished replicating on GitHub's side after the
# retry window, even when every real release action -- the push included --
# had already succeeded. This library extracts that abort-vs-warn decision
# out of release.sh so it can be exercised by a test with fake git results,
# and adds an independent "did the push actually land" check (an origin/main
# sha match) instead of trusting `set -e` alone to prove the push worked.
#
# RETURN CODES (the contract, exact -- do not improvise):
#   0  = tag verified visible at origin. Unchanged success path.
#   10 = tag still NOT visible after all retries, BUT origin/main's sha
#        independently matched the caller's expected sha ("the push
#        demonstrably succeeded"). Caller should WARN and continue.
#   1  = tag NOT visible AND the main-sha check failed to confirm the push
#        (mismatch, empty/unreadable remote sha, missing args, or an
#        unusable hook). Fail closed -- caller should hard-abort.
#
# HOOK ENV VARS (injected, resolved by name via `command -v`):
#   MOS_TAG_PROBE_HOOK  (required, caller must set) -- called as
#                        "$hook" <tag_ref>; returns 0 if the tag is visible
#                        at origin, nonzero otherwise.
#   MOS_MAIN_SHA_HOOK   (required, caller must set) -- called as "$hook"
#                        with no args; prints origin's refs/heads/main sha
#                        on stdout, empty if unreadable.
#   MOS_SLEEP_HOOK      (optional, defaults to the real `sleep`) -- called
#                        as "$hook" <seconds>; pauses.
#
# RULES for this file:
#   - No `set -e`. The caller's shell options are never inherited by force.
#   - No top-level side effects, no global variable assignments outside the
#     function body. Safe to source more than once.
#   - Safe to source under `set -u`: every parameter expansion here is
#     guarded with `${VAR:-}`. Safe with no colors defined -- this file
#     never references a bare $GREEN/$YELLOW/$RED/$NC, only the
#     `${GREEN:-}` / `${YELLOW:-}` / `${NC:-}` guarded forms.
#   - The main-sha probe fires ONLY after the tag-probe retry loop is
#     exhausted. The happy path (tag verified on an early attempt) makes
#     zero calls to MOS_MAIN_SHA_HOOK, so it costs zero extra network calls
#     and stays behaviorally identical to the pre-Phase-310 gate.
#   - Every command substitution here is guarded with `|| true` so an
#     unusable hook cannot kill the caller's shell out from under it.
#
# Phase 310 (SEED-051-B / SEED-051-C).

mos_verify_tag_at_origin() {
  local tag_ref="${1:-}"
  local retries="${2:-}"
  local backoff="${3:-}"
  local expected_main_sha="${4:-}"

  if [ "$#" -lt 4 ]; then
    echo "  x mos_verify_tag_at_origin: missing arguments"
    return 1
  fi

  local tag_probe="${MOS_TAG_PROBE_HOOK:-}"
  local main_sha_fn="${MOS_MAIN_SHA_HOOK:-}"
  local sleep_fn="${MOS_SLEEP_HOOK:-sleep}"

  if [ -z "$tag_probe" ] || ! command -v "$tag_probe" >/dev/null 2>&1; then
    echo "  x mos_verify_tag_at_origin: probe hook '${tag_probe}' is not callable"
    return 1
  fi
  if [ -z "$main_sha_fn" ] || ! command -v "$main_sha_fn" >/dev/null 2>&1; then
    echo "  x mos_verify_tag_at_origin: probe hook '${main_sha_fn}' is not callable"
    return 1
  fi

  local attempt=1
  while [ "$attempt" -le "$retries" ]; do
    if "$tag_probe" "$tag_ref"; then
      echo -e "${GREEN:-}  ✓ tag ${tag_ref} verified at origin (attempt ${attempt}/${retries})${NC:-}"
      return 0
    fi
    if [ "$attempt" -lt "$retries" ]; then
      echo "  ... tag not yet visible at origin; retry $((attempt+1))/${retries} in ${backoff}s"
      "$sleep_fn" "$backoff"
    fi
    attempt=$((attempt+1))
  done

  # Retry loop exhausted. Only now, and never on the success path, ask the
  # independent question: did the push actually land on origin/main?
  local remote_main
  remote_main="$("$main_sha_fn" 2>/dev/null || true)"

  if [ -n "$remote_main" ] && [ -n "$expected_main_sha" ] && [ "$remote_main" = "$expected_main_sha" ]; then
    local short_sha="${remote_main:0:7}"
    echo -e "${YELLOW:-}  ! tag ${tag_ref} not visible at origin after ${retries} attempts, but origin/main already matches local HEAD (${short_sha})${NC:-}"
    echo "    The push demonstrably succeeded; GitHub tag replication is lagging. Continuing (non-fatal)."
    echo "    Confirm later: git ls-remote --tags origin | grep ${tag_ref}"
    return 10
  fi

  if [ -n "$remote_main" ]; then
    echo "  x mos_verify_tag_at_origin: origin/main sha '${remote_main}' does not match local HEAD '${expected_main_sha}'"
  else
    echo "  x mos_verify_tag_at_origin: could not read origin/main sha from origin"
  fi
  return 1
}
