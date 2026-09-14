#!/usr/bin/env bash
# scripts/release-lib/theo-stamp-gate.sh
#
# WHAT: a sourced library defining `mos_theo_stamp_gate`, the WD-13 LAGGING
# preflight gate that blocks a release when Theo's command-layer stamp was
# never re-emitted against the CURRENT plugin version -- the version this
# release is about to supersede. See docs/RELEASE-CEREMONY-RULING-SYSTEM.md
# RULE 5 (place 8) and docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md WD-13/WD-20/WD-21.
#
# WHY (Phase 343 Plan 07, CENSUS-13): five betas shipped with zero Theo
# command-registry re-syncs, and the seam stayed open because nothing could
# fail. This gate makes the seam fail.
#
# THE PROBE FACTS THIS SHAPE IS BUILT AGAINST (343-07 Task 1/Task 2,
# measured live, no key value ever printed):
#   - A key resolves through lib/core/brain-client.cjs in the release
#     environment (getApiKey()); the wire is reachable (bc.stats() returns
#     a real object).
#   - Tool used: command_neighborhood, called as
#       bc.callTool('command_neighborhood', { command: '/mos:act' })
#   - Response shape observed: result.rows[0].mappedBy and
#     result.rows[0].registryHash are both populated on a live call.
#   - Stamp format: "command-registry@<plugin_version>", e.g.
#       command-registry@2.0.0-beta.12
#   - The batch id embedded in a re-emit is deterministic with no
#     timestamp, so a re-generation against an unchanged registry is
#     provably a no-op -- a fact about Theo's own re-emit contract,
#     recorded here for the next reader, not a claim this gate proves.
#   - Measured 2026-09-14 at the navigator checkpoint: mappedBy was
#     command-registry@2.0.0-beta.12 against a repo version of
#     2.0.0-beta.40 -- Theo had not re-emitted in five betas. This gate,
#     once wired, correctly FAILS on that tree until Theo re-emits.
#
# THE LAGGING-GATE REASONING (its one real limit, stated so it is never
# glossed): Theo cannot re-emit against a version that does not exist yet,
# so this gate asserts the CURRENT version's stamp. That blocks release N+1
# when release N was never re-emitted -- it cannot catch the very first
# miss, only the second and every one after.
#
# THE READER SEAM (WD-21): the stamp value is obtained by running a command
# held in MINDRIAN_THEO_STAMP_CMD when set, defaulting to a `node -e`
# one-liner against lib/core/brain-client.cjs. This is a TEST SEAM: it is
# how tests/test-343-theo-stamp-gate.cjs proves the pass, mismatch and
# unreachable paths hermetically, with zero network calls. A gate whose own
# failure path cannot be tested is an untested backup.
#
# THE DRY-RUN CARVE-OUT (WD-20, unamended by the navigator): scripts/
# doctor.cjs --acceptance shells `release.sh --dry-run` (RULE 4). Under
# DRY_RUN=1 this gate still performs the real read and PRINTS its verdict,
# but never aborts -- a Theo outage must not be able to red the whole
# acceptance roll-up. A real release (DRY_RUN unset or 0) still fails
# closed on the exact same mismatch.
#
# THE AUDITED OPT-OUT (T-343-06): --no-theo-check, parsed by release.sh
# beside --no-minisite / --no-website, is the only way to skip this gate.
# Skipping always prints an explicit line naming the flag, the version
# being released, and the operator-visible consequence -- never silent.
#
# INFORMATION DISCLOSURE (T-343-31): this file never prints the API key,
# the Brain URL's credentials, or any response field other than the stamp
# value and the hash. Do not add a print statement that echoes more of the
# response than that.
#
# RULES for this file (verify-tag-push.sh's shape, copied on purpose):
#   - No `set -e`. The caller's shell options (release.sh runs under
#     `set -euo pipefail`) are never fought here; every command whose
#     failure is a normal, expected branch is explicitly guarded so it
#     cannot trip the caller's errexit by accident.
#   - No top-level side effects, no global variable assignments outside a
#     function body. Safe to source more than once.
#   - Safe to source under `set -u`: every parameter expansion here is
#     guarded with `${VAR:-}`, including the color constants, which may be
#     unset when this file is sourced outside release.sh (e.g. by the test).
#
# Phase 343 Plan 07 (CENSUS-13).

# _theo_stamp_read(plugin_dir) -- runs the reader command (overridable via
# MINDRIAN_THEO_STAMP_CMD), bounded by an 8s external timeout so a hung
# Theo read can never hang the release train or blow the 30s budget
# scripts/doctor.cjs's release-dry-run-output self-test gives release.sh
# --dry-run. Prints the raw stamp string on stdout; prints nothing on any
# failure. Always returns 0 -- callers judge success by whether the printed
# string is non-empty and parseable, never by this function's exit code.
_theo_stamp_read() {
  local plugin_dir="${1:-}"
  local default_reader
  default_reader="node -e \"const bc=require('${plugin_dir}/lib/core/brain-client.cjs'); bc.callTool('command_neighborhood',{command:'/mos:act'}).then(function(r){var rows=(r&&r.rows)||[]; var row=rows[0]||{}; process.stdout.write(row.mappedBy||'');}).catch(function(){process.stdout.write('');});\""
  local reader_cmd="${MINDRIAN_THEO_STAMP_CMD:-$default_reader}"
  if command -v timeout >/dev/null 2>&1; then
    timeout 8 bash -c "$reader_cmd" 2>/dev/null || true
  else
    bash -c "$reader_cmd" 2>/dev/null || true
  fi
}

# mos_theo_stamp_gate(plugin_dir, dry_run, no_theo_check) -- the gate.
#
# Returns 0 on: a matching stamp, an audited --no-theo-check skip, or any
# outcome while dry_run=1 (WD-20 -- dry-run always reports, never aborts).
# Returns 1 on: a mismatching stamp or an unreadable stamp, on a real
# (non-dry-run) release with no-theo-check not set. An unreadable stamp is
# NEVER a pass (T-343-30) -- it is a named READ FAILURE, distinct from a
# named MISMATCH, so the two failure classes are never conflated in output.
mos_theo_stamp_gate() {
  local plugin_dir="${1:-}"
  local dry_run="${2:-0}"
  local no_theo_check="${3:-0}"

  if [ -z "$plugin_dir" ]; then
    echo "  x theo-stamp-gate: missing plugin_dir argument"
    return 1
  fi

  local current_version
  current_version="$(node "$plugin_dir/lib/core/repo-version.cjs" 2>/dev/null || true)"
  if [ -z "$current_version" ]; then
    echo -e "${RED:-}  x theo-stamp-gate: could not read the current version via lib/core/repo-version.cjs -- refusing to release${NC:-}"
    return 1
  fi

  if [ "$no_theo_check" = "1" ]; then
    echo -e "${YELLOW:-}  ! theo-stamp-gate: SKIPPED via --no-theo-check for version ${current_version}. Theo's command-layer stamp was NOT verified against this release. Consequence: if Theo has not re-emitted since the last release, this ships methodology mapped to a stale command registry with no automatic warning. Re-run without the flag once Theo is reachable, or trigger the re-emit manually.${NC:-}"
    return 0
  fi

  local raw_stamp
  raw_stamp="$(_theo_stamp_read "$plugin_dir")"

  # Expected format: command-registry@<version>. Empty, no '@', or a
  # transport failure are all a READ FAILURE -- never a pass, never
  # reported as a mismatch.
  if [ -z "$raw_stamp" ] || [ "${raw_stamp#*@}" = "$raw_stamp" ]; then
    if [ "$dry_run" = "1" ]; then
      echo -e "${YELLOW:-}  [DRY RUN] theo-stamp-gate: READ FAILURE -- Theo's command-registry stamp could not be read (empty response, unparseable, or transport failure). A real release would ABORT here.${NC:-}"
      return 0
    fi
    echo -e "${RED:-}  x theo-stamp-gate: READ FAILURE -- Theo's command-registry stamp could not be read (empty response, unparseable, or transport failure). Treated as a failure, never a pass.${NC:-}"
    echo "    Audited opt-out (only for a known Theo outage): re-run with --no-theo-check."
    return 1
  fi

  local stamped_version="${raw_stamp#*@}"

  if [ "$stamped_version" = "$current_version" ]; then
    local prefix=""
    [ "$dry_run" = "1" ] && prefix="[DRY RUN] "
    echo -e "${GREEN:-}  ${prefix}theo-stamp-gate: PASS -- Theo's stamp (${raw_stamp}) matches the current version (${current_version}).${NC:-}"
    return 0
  fi

  if [ "$dry_run" = "1" ]; then
    echo -e "${YELLOW:-}  [DRY RUN] theo-stamp-gate: MISMATCH -- Theo's stamp is ${raw_stamp}, expected command-registry@${current_version}. A real release would ABORT here. Recovery: trigger Theo's command-registry re-emit for ${current_version}, then re-run.${NC:-}"
    return 0
  fi

  echo -e "${RED:-}  x theo-stamp-gate: MISMATCH -- Theo's stamp is ${raw_stamp}, expected command-registry@${current_version}. Theo's command layer was never re-emitted against the version this release is about to supersede.${NC:-}"
  echo "    Recovery: trigger Theo's command-registry re-emit for ${current_version}, confirm the new stamp, then re-run this release."
  echo "    Audited opt-out (only for a known Theo outage): re-run with --no-theo-check."
  return 1
}
