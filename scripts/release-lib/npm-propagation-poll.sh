#!/usr/bin/env bash
# scripts/release-lib/npm-propagation-poll.sh
#
# WHAT: a pure, errexit-safe registry-propagation poll for release.sh's Step
# 9.7 self-test gate: `mos_wait_for_npm_propagation`.
#
# WHY (quick task 260917-o1y, 2026-09-17): Step 9.7's poll used to read
#   PROP_SEEN="$(npm view "@mindrian_os/cli@$NEW_VERSION" version 2>/dev/null | tr -d '[:space:]')"
# inline, under release.sh's own `set -euo pipefail` (line 86). An npm E404
# (the registry still processing an asynchronous publish) makes the pipeline
# exit 1; pipefail carries that status onto the assignment; errexit then
# kills the whole ceremony BEFORE the loop prints its first "waiting for npm
# registry" line. Two observations on 2026-09-17 prove the poll never ran a
# second iteration: v2.0.0-beta.43 (09:58:03 UTC, publish-to-visible about 10
# minutes) and v2.0.0-beta.45 (14:09:24 UTC, publish-to-visible about 8
# minutes) both end one line after `-> sandbox: ...` with zero waiting
# lines, and the NPX_PROP_RETRIES / NPX_PROP_BACKOFF_S overrides
# deliberately set for beta.45 were inert because the loop never iterated.
# This library extracts the probe into a function whose command
# substitution ends in `|| true`, so an E404 is a poll MISS, not an errexit
# abort.
#
# RETURN CODES (the contract, exact -- do not improvise):
#   0  = the version is visible, having printed
#        "  -> registry propagated <pkg>@<version> (attempt N)". The global
#        MOS_NPM_PROP_SEEN is set to the version read.
#   10 = the budget was exhausted without the version appearing, having
#        printed a single timeout line naming the elapsed budget it
#        actually waited ("<retries> attempts x <backoff>s = <total>s
#        budget") and stating it is proceeding because the install
#        self-test still gates (timeout behavior is unchanged from before
#        this fix: proceed, never abort).
#   1  = missing or non-numeric arguments.
#
# HOOK ENV VARS (optional, resolved by name):
#   MOS_SLEEP_HOOK  (optional, defaults to the real `sleep`) -- called as
#                    "$hook" <seconds>; pauses between attempts. Never
#                    called after the final attempt.
#
# RULES for this file:
#   - No `set -e`. The caller's shell options are never inherited by force.
#   - No top-level side effects, no global variable assignments outside the
#     function body. Safe to source more than once.
#   - Safe to source under `set -u`: every parameter expansion here is
#     guarded with `${VAR:-}`.
#   - Never references a bare $GREEN/$YELLOW/$RED/$NC -- this file prints in
#     plain text only, matching the un-colored wording of the original Step
#     9.7 poll block.
#   - The version-read command substitution ends in `|| true`, so the
#     pipeline's exit status can never propagate to the caller under
#     `set -euo pipefail`. This is R1, the whole point of this file.
#   - MOS_NPM_PROP_SEEN is reset to empty at the top of every call so a
#     second call cannot inherit a stale value from a prior one.
#
# Quick task 260917-o1y.

mos_wait_for_npm_propagation() {
  local pkg="${1:-}"
  local version="${2:-}"
  local retries="${3:-}"
  local backoff="${4:-}"

  MOS_NPM_PROP_SEEN=""

  if [ "$#" -lt 4 ]; then
    echo "  x mos_wait_for_npm_propagation: missing arguments"
    return 1
  fi

  case "$retries" in
    ''|*[!0-9]*)
      echo "  x mos_wait_for_npm_propagation: retries '${retries}' is not numeric"
      return 1
      ;;
  esac
  case "$backoff" in
    ''|*[!0-9]*)
      echo "  x mos_wait_for_npm_propagation: backoff '${backoff}' is not numeric"
      return 1
      ;;
  esac

  local sleep_fn="${MOS_SLEEP_HOOK:-sleep}"
  local attempt=1
  local seen

  while [ "$attempt" -le "$retries" ]; do
    seen="$(npm view "${pkg}@${version}" version 2>/dev/null | tr -d '[:space:]' || true)"
    if [ "$seen" = "$version" ]; then
      echo "  -> registry propagated ${pkg}@${version} (attempt ${attempt})"
      MOS_NPM_PROP_SEEN="$seen"
      return 0
    fi
    echo "  ... waiting for npm registry to propagate ${pkg}@${version}; retry ${attempt}/${retries} in ${backoff}s"
    if [ "$attempt" -lt "$retries" ]; then
      "$sleep_fn" "$backoff"
    fi
    attempt=$((attempt+1))
  done

  local total=$((retries * backoff))
  echo "  ... registry propagation budget exhausted (${retries} attempts x ${backoff}s = ${total}s budget); proceeding because the install self-test still gates"
  return 10
}
