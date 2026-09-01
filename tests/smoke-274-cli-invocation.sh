#!/usr/bin/env bash
# Phase 274-01 - the D-02 CLI runtime smoke test (ANCHOR-08).
#
# THE FOUR-ARM RESOLUTION-FAILURE ORACLE (274-RESEARCH.md Code Example 3,
# measured live this session against scripts/wikilink-file.cjs). Generalized
# here over two distinct, already-shipping scripts behind two different
# commands, to satisfy D-02's "representative sample" language rather than a
# single-script proof:
#   - scripts/wikilink-file.cjs      (behind commands/room.md, file-meeting)
#   - scripts/build-new-surface.cjs  (behind commands/new-surface.md, skill.md)
#
# From a scratch cwd that is provably NOT the plugin root:
#   Arm A (bare)                                -> resolution-failure signature
#   Arm B (short-form, CLAUDE_PLUGIN_ROOT set)  -> interpreter finds/starts the file
#   Arm C (short-form, CLAUDE_PLUGIN_ROOT unset) -> the SAME resolution-failure
#                                                    signature (why skills need
#                                                    the long form)
#   Arm D (long fail-closed, both vars unset)   -> the shell's own
#                                                    ${VAR:?message} refusal,
#                                                    naming the fix
#
# ASSERTS ON THE RESOLUTION SIGNATURE ONLY (Pattern 6) -- never a script's
# business outcome, never a scaffolded fake room. This test does not depend
# on the markdown sweep (274-02..04): the scripts it drives already ship, so
# it passes today against the already-shipping repo.
#
# D-02's stated Desktop/Cowork gap: this smoke test drives the CLI surface
# only. Desktop and Cowork get the same static path-correctness check
# (scripts/check-plugin-path-anchoring.cjs --check-scripts) but no automated
# runtime execution test -- no harness exists for those two surfaces today.
# That is a deliberate, stated gap (Tri-Polar Design Rule), not an oversight.
#
# House rule: hyphens only, no em-dashes, no emoji.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

PASS=0
FAIL=0

arm_result() {
  local label="$1" verdict="$2"
  if [ "$verdict" = "PASS" ]; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label"
    FAIL=$((FAIL + 1))
  fi
}

is_resolution_failure() {
  echo "$1" | grep -qE 'Cannot find module|MODULE_NOT_FOUND'
}

is_refused_fail_closed() {
  echo "$1" | grep -q 'install root not found'
}

run_four_arms() {
  local script_name="$1"
  echo "--- ${script_name} ---"

  # Arm A: bare, from the scratch cwd.
  local out_a
  out_a="$(cd "$SCRATCH" && node "scripts/${script_name}" 2>&1)"
  if is_resolution_failure "$out_a"; then
    arm_result "${script_name} Arm A (bare) shows the resolution-failure signature" "PASS"
  else
    arm_result "${script_name} Arm A (bare) shows the resolution-failure signature (got: $(echo "$out_a" | head -1))" "FAIL"
  fi

  # Arm B: short-form anchored, CLAUDE_PLUGIN_ROOT set to the real repo root.
  local out_b
  out_b="$(cd "$SCRATCH" && CLAUDE_PLUGIN_ROOT="$REPO_ROOT" bash -c "node \"\${CLAUDE_PLUGIN_ROOT}/scripts/${script_name}\"" 2>&1)"
  if is_resolution_failure "$out_b"; then
    arm_result "${script_name} Arm B (anchored) interpreter found and started the file (got: $(echo "$out_b" | head -1))" "FAIL"
  else
    arm_result "${script_name} Arm B (anchored) interpreter found and started the file" "PASS"
  fi

  # Arm C: short form, CLAUDE_PLUGIN_ROOT unset -- proves why skills need the
  # fail-closed long form (the short form resolves to a wrong path and dies
  # confusingly, rather than refusing loudly).
  local out_c
  out_c="$(cd "$SCRATCH" && env -u CLAUDE_PLUGIN_ROOT bash -c "node \"\${CLAUDE_PLUGIN_ROOT}/scripts/${script_name}\"" 2>&1)"
  if is_resolution_failure "$out_c"; then
    arm_result "${script_name} Arm C (short-form, env unset) shows the same resolution-failure signature" "PASS"
  else
    arm_result "${script_name} Arm C (short-form, env unset) shows the same resolution-failure signature (got: $(echo "$out_c" | head -1))" "FAIL"
  fi

  # Arm D: long fail-closed form, both vars unset -- refuses, naming the fix.
  # Message string copied verbatim from skills/export/SKILL.md:80 (Pattern 2).
  local out_d
  out_d="$(cd "$SCRATCH" && env -u CLAUDE_PLUGIN_ROOT -u MINDRIAN_OS_ROOT bash -c "node \"\${MINDRIAN_OS_ROOT:-\${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/${script_name}\"" 2>&1)"
  if is_refused_fail_closed "$out_d"; then
    arm_result "${script_name} Arm D (long fail-closed, both unset) refuses, naming the fix" "PASS"
  else
    arm_result "${script_name} Arm D (long fail-closed, both unset) refuses, naming the fix (got: $(echo "$out_d" | head -1))" "FAIL"
  fi
}

run_four_arms "wikilink-file.cjs"
run_four_arms "build-new-surface.cjs"

echo "======================================"
echo "smoke-274-cli-invocation: PASS=$PASS FAIL=$FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
