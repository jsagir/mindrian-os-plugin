#!/usr/bin/env bash
# scripts/release-lib/suite-gate.sh
#
# WHAT: a sourced library defining `mos_suite_gate`, the release's phase
# suite gate. It runs every aggregator named in RELEASE_GATE_SUITES (each
# with `bash`, from the plugin root) and fails closed when any of them is red
# or missing.
#
# WHY (Phase 366 Plan 06, EPV366-01): "register in the release gate" means
# release.sh shells the phase aggregator. tests/run-all-366.sh carries every
# seed103 wave-1 leg plus the Phase 366 legs, so it is the default (and today
# the only) entry. A later phase adds its own aggregator to the array; it
# never edits release.sh for that.
#
# SEAM: MINDRIAN_RELEASE_SUITES (colon-separated paths, absolute or relative
# to plugin_dir) replaces the list. tests/test-366-suite-gate.cjs drives it
# with stub scripts, so the real aggregator is never run from its own test
# (no recursion, T-366-24).
#
# VERDICTS: one PASS or FAIL line per suite. Under dry_run=1 the suites still
# run and every verdict is printed, but the function returns 0. no_check=1 is
# the audited opt-out --no-suite-check: one line, never silent, nothing runs.
# release.sh itself previews this gate under --dry-run instead of calling it,
# because doctor's release-dry-run-output self-test gives release.sh --dry-run
# a 30s budget and the aggregator takes longer (see release.sh Step 0.6c).
#
# RULES (theo-stamp-gate.sh's shape): no `set -e`, safe under `set -u`, the
# function only returns codes and never terminates the caller's shell. The
# one top-level assignment is the default list below, a plain constant.
# Prints suite paths and a short output tail only, never environment values
# (T-366-25).
#
# Phase 366 Plan 06 (EPV366-01). Hyphens only.

RELEASE_GATE_SUITES=(tests/run-all-366.sh)

# mos_suite_gate(plugin_dir, dry_run, no_check)
mos_suite_gate() {
  local plugin_dir="${1:-}"
  local dry_run="${2:-0}"
  local no_check="${3:-0}"

  if [ -z "$plugin_dir" ]; then
    echo "  x suite-gate: missing plugin_dir argument"
    return 1
  fi

  local -a suites=()
  if [ -n "${MINDRIAN_RELEASE_SUITES:-}" ]; then
    IFS=':' read -r -a suites <<< "${MINDRIAN_RELEASE_SUITES}"
  else
    suites=("${RELEASE_GATE_SUITES[@]}")
  fi

  if [ "$no_check" = "1" ]; then
    echo -e "${YELLOW:-}  ! suite-gate: SKIPPED via --no-suite-check. The phase release suites (${suites[*]}) were NOT run; this release ships without the phase gate's verdict. Re-run without the flag once they are green.${NC:-}"
    return 0
  fi

  local prefix=""
  [ "$dry_run" = "1" ] && prefix="[DRY RUN] "

  local failed=0
  local suite suite_path log status
  for suite in "${suites[@]}"; do
    [ -z "$suite" ] && continue
    case "$suite" in
      /*) suite_path="$suite" ;;
      *) suite_path="$plugin_dir/$suite" ;;
    esac
    if [ ! -f "$suite_path" ]; then
      echo -e "${RED:-}  ${prefix}x suite-gate: FAIL -- ${suite} is missing.${NC:-}"
      failed=1
      continue
    fi
    log="$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/mos-suite-gate.$$.log")"
    status=0
    ( cd "$plugin_dir" && LC_ALL=C bash "$suite_path" ) >"$log" 2>&1 || status=$?
    if [ "$status" -eq 0 ]; then
      echo -e "${GREEN:-}  ${prefix}suite-gate: PASS -- ${suite}${NC:-}"
    else
      echo -e "${RED:-}  ${prefix}x suite-gate: FAIL -- ${suite} returned ${status}. Last lines:${NC:-}"
      tail -n 12 "$log" 2>/dev/null | sed 's/^/      /' || true
      failed=1
    fi
    rm -f "$log" 2>/dev/null || true
  done

  if [ "$failed" -eq 0 ]; then
    return 0
  fi
  if [ "$dry_run" = "1" ]; then
    echo -e "${YELLOW:-}  [DRY RUN] suite-gate: a real release would ABORT here.${NC:-}"
    return 0
  fi
  echo "    Recovery: make every suite above green (LC_ALL=C bash <suite>), then re-run this release."
  echo "    Audited opt-out: re-run with --no-suite-check."
  return 1
}
