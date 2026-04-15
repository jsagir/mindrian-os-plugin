#!/usr/bin/env bash
# tests/fixtures/cmd-shim.sh
#
# Phase 85-04 (WIN-FIX-F-02): Linux-runnable simulation of cmd.exe exit-code
# propagation through hooks/run-hook.cmd. Real cmd.exe emulation would require
# wine or a Windows runner; neither is available in CI. Instead this shim does
# a structural check plus a behavioral check:
#
#   1. Structural: assert that hooks/run-hook.cmd contains the three textual
#      patterns that make Finding F fix correct. If any are missing, exit 3
#      (shim-detected regression) regardless of hook behavior.
#
#        - setlocal enabledelayedexpansion
#        - set "RC=!ERRORLEVEL!"  (captured after every bash invocation)
#        - endlocal & exit /b %RC%  (used for every exit path)
#
#   2. Behavioral: locate the referenced hook under scripts/<hook-name>,
#      exec it with the remaining args, pipe stdin through unchanged, and
#      propagate its exit code to the caller. This is the same contract the
#      fixed run-hook.cmd guarantees on Windows; by matching it on Linux we
#      can run the regression test on CI.
#
# Usage: cmd-shim.sh <path-to-run-hook.cmd> <hook-name> [args...]
#
# Exit codes:
#   0   hook allowed (or no-op)
#   2   hook blocked (e.g. write-scope-check cross-room)
#   3   structural regression (one of the three required patterns missing)
#   *   whatever the hook script returned
#
# Constraints: bash only, no new runtime deps, no em-dashes.

set -u

if [ $# -lt 2 ]; then
  echo "cmd-shim.sh: usage: $0 <run-hook.cmd> <hook-name> [args...]" >&2
  exit 64
fi

CMD_FILE="$1"
HOOK_NAME="$2"
shift 2

if [ ! -f "$CMD_FILE" ]; then
  echo "cmd-shim.sh: run-hook.cmd not found at $CMD_FILE" >&2
  exit 66
fi

MISSING=""
grep -q 'setlocal enabledelayedexpansion' "$CMD_FILE" \
  || MISSING="$MISSING setlocal-enabledelayedexpansion"
grep -q 'set "RC=!ERRORLEVEL!"' "$CMD_FILE" \
  || MISSING="$MISSING rc-capture"
grep -q 'endlocal & exit /b %RC%' "$CMD_FILE" \
  || MISSING="$MISSING endlocal-exit"

if [ -n "$MISSING" ]; then
  echo "cmd-shim.sh: REGRESSION in run-hook.cmd, missing patterns:$MISSING" >&2
  echo "cmd-shim.sh: see tests/test-run-hook-cmd.cjs and WIN-FIX-F-01" >&2
  exit 3
fi

# Behavioral: locate and exec the referenced hook.
CMD_DIR="$(cd "$(dirname "$CMD_FILE")" && pwd)"
PLUGIN_ROOT="$(cd "${CMD_DIR}/.." && pwd)"
SCRIPTS_DIR="${PLUGIN_ROOT}/scripts"
HOOK_PATH="${SCRIPTS_DIR}/${HOOK_NAME}"

if [ ! -f "$HOOK_PATH" ]; then
  echo "cmd-shim.sh: hook script not found at $HOOK_PATH" >&2
  exit 66
fi

export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
bash "$HOOK_PATH" "$@"
exit $?
