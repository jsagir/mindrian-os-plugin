#!/usr/bin/env bash
# scripts/release-lib/canon-snapshot-gate.sh
#
# WHAT: a sourced library defining `mos_canon_snapshot_gate`, the LAGGING
# preflight gate for RULE 5 place 9 (canon snapshot freshness) of
# docs/RELEASE-CEREMONY-RULING-SYSTEM.md. It refuses a release when
# data/framework-names.json carries no `theo_stamp`, or when its
# `theo_stamp.mapped_by` names a version other than the CURRENT plugin
# version.
#
# WHY (Phase 366 Plan 06, D-17): the canon resolver matches exact canon
# names, so it is only as current as the snapshot it reads. Place 8 asserts
# Theo re-emitted against the current version N; place 9 asserts the snapshot
# was refreshed AFTER that re-emit, i.e. its stamp also names N. The stamp is
# written only by `node scripts/refresh-framework-names.cjs --live`, which
# reads Theo's mappedBy with the same call the place-8 gate makes.
#
# OFFLINE: this gate never touches the network. It reads one local JSON file
# and the repo version. Same LAGGING limit as place 8: it blocks release N+1
# when the snapshot was never refreshed after release N's re-emit.
#
# SEAMS (tests/test-366-snapshot-gate.cjs drives both, hermetically):
#   MINDRIAN_CANON_SNAPSHOT_PATH  snapshot file (default
#                                 <plugin_dir>/data/framework-names.json)
#   MINDRIAN_PLUGIN_VERSION_CMD   version reader (default
#                                 node <plugin_dir>/lib/core/repo-version.cjs)
#
# VERDICTS: PASS, LAGGING (stamp absent or older), READ FAILURE (file
# missing, unparseable, or a malformed theo_stamp). A READ FAILURE is never
# reported as LAGGING and never passes. Under dry_run=1 every verdict is
# printed and the function returns 0 (WD-20 precedent). no_check=1 is the
# audited opt-out --no-canon-snapshot-check: one line, never silent.
#
# RULES for this file (theo-stamp-gate.sh's shape, copied on purpose): no
# `set -e`, no top-level side effects, safe under `set -u`, the function only
# returns codes and never terminates the caller's shell. Prints versions and
# paths only, never environment values (T-366-25).
#
# Phase 366 Plan 06 (EPV366-21, D-17). Hyphens only.

# _canon_snapshot_read(snapshot_path) -- prints one line:
#   STAMP<TAB><mapped_by>   a well-formed theo_stamp
#   NOSTAMP                 a readable snapshot with no theo_stamp
#   ERR<TAB><reason>        anything else
_canon_snapshot_read() {
  MINDRIAN_CANON_SNAPSHOT_READ_PATH="${1:-}" node -e '
    var fs = require("fs");
    var p = process.env.MINDRIAN_CANON_SNAPSHOT_READ_PATH || "";
    var raw;
    try { raw = fs.readFileSync(p, "utf8"); } catch (e) { process.stdout.write("ERR\tcannot read " + p); process.exit(0); }
    var s;
    try { s = JSON.parse(raw); } catch (e) { process.stdout.write("ERR\tnot valid JSON: " + p); process.exit(0); }
    if (!s || typeof s !== "object" || !Array.isArray(s.framework_names)) { process.stdout.write("ERR\tnot a framework-names snapshot: " + p); process.exit(0); }
    if (!Object.prototype.hasOwnProperty.call(s, "theo_stamp")) { process.stdout.write("NOSTAMP"); process.exit(0); }
    var st = s.theo_stamp;
    if (!st || typeof st !== "object" || typeof st.mapped_by !== "string" || !st.mapped_by.trim()) { process.stdout.write("ERR\tmalformed theo_stamp (mapped_by must be a non-empty string)"); process.exit(0); }
    process.stdout.write("STAMP\t" + st.mapped_by.trim());
  ' 2>/dev/null || true
}

# mos_canon_snapshot_gate(plugin_dir, dry_run, no_check)
mos_canon_snapshot_gate() {
  local plugin_dir="${1:-}"
  local dry_run="${2:-0}"
  local no_check="${3:-0}"
  local refresh_cmd="node scripts/refresh-framework-names.cjs --live"

  if [ -z "$plugin_dir" ]; then
    echo "  x canon-snapshot-gate: missing plugin_dir argument"
    return 1
  fi

  local snapshot_path="${MINDRIAN_CANON_SNAPSHOT_PATH:-$plugin_dir/data/framework-names.json}"
  local version_cmd="${MINDRIAN_PLUGIN_VERSION_CMD:-}"
  local current_version
  if [ -n "$version_cmd" ]; then
    current_version="$(bash -c "$version_cmd" 2>/dev/null || true)"
  else
    current_version="$(node "$plugin_dir/lib/core/repo-version.cjs" 2>/dev/null || true)"
  fi
  current_version="$(printf '%s' "$current_version" | tr -d '[:space:]')"

  if [ "$no_check" = "1" ]; then
    echo -e "${YELLOW:-}  ! canon-snapshot-gate: SKIPPED via --no-canon-snapshot-check for version ${current_version:-unknown}. data/framework-names.json was NOT verified as refreshed after Theo's re-emit (RULE 5 place 9); this release may ship a stale canon snapshot. Run ${refresh_cmd} and re-run without the flag.${NC:-}"
    return 0
  fi

  local prefix=""
  [ "$dry_run" = "1" ] && prefix="[DRY RUN] "

  if [ -z "$current_version" ]; then
    if [ "$dry_run" = "1" ]; then
      echo -e "${YELLOW:-}  ${prefix}canon-snapshot-gate: READ FAILURE -- the current plugin version could not be read. A real release would ABORT here.${NC:-}"
      return 0
    fi
    echo -e "${RED:-}  x canon-snapshot-gate: READ FAILURE -- the current plugin version could not be read via lib/core/repo-version.cjs. Refusing to release.${NC:-}"
    return 1
  fi

  local read_out kind payload
  read_out="$(_canon_snapshot_read "$snapshot_path")"
  kind="${read_out%%$'\t'*}"
  payload=""
  [ "$kind" != "$read_out" ] && payload="${read_out#*$'\t'}"
  [ -z "$read_out" ] && kind="ERR" && payload="no output from the snapshot reader"

  if [ "$kind" = "ERR" ] || { [ "$kind" != "STAMP" ] && [ "$kind" != "NOSTAMP" ]; }; then
    if [ "$dry_run" = "1" ]; then
      echo -e "${YELLOW:-}  ${prefix}canon-snapshot-gate: READ FAILURE -- ${payload}. A real release would ABORT here.${NC:-}"
      return 0
    fi
    echo -e "${RED:-}  x canon-snapshot-gate: READ FAILURE -- ${payload}. Treated as a failure, never a pass.${NC:-}"
    echo "    Recovery: restore a valid data/framework-names.json, then run ${refresh_cmd}."
    echo "    Audited opt-out: re-run with --no-canon-snapshot-check."
    return 1
  fi

  if [ "$kind" = "NOSTAMP" ]; then
    if [ "$dry_run" = "1" ]; then
      echo -e "${YELLOW:-}  ${prefix}canon-snapshot-gate: LAGGING -- data/framework-names.json has never been stamped (no theo_stamp); expected a stamp for ${current_version}. A real release would ABORT here. Recovery: ${refresh_cmd} after Theo's re-emit.${NC:-}"
      return 0
    fi
    echo -e "${RED:-}  x canon-snapshot-gate: LAGGING -- data/framework-names.json has never been stamped (no theo_stamp); expected a stamp for ${current_version}.${NC:-}"
    echo "    Recovery: once Theo has re-emitted for ${current_version} (RULE 5 place 8), run ${refresh_cmd}, commit the snapshot, then re-run this release."
    echo "    Audited opt-out: re-run with --no-canon-snapshot-check."
    return 1
  fi

  local mapped_by="$payload"
  local stamped_version="$mapped_by"
  case "$mapped_by" in
    *@*) stamped_version="${mapped_by##*@}" ;;
  esac

  if [ "$stamped_version" = "$current_version" ]; then
    echo -e "${GREEN:-}  ${prefix}canon-snapshot-gate: PASS -- the snapshot's theo_stamp.mapped_by (${mapped_by}) matches the current version (${current_version}).${NC:-}"
    return 0
  fi

  if [ "$dry_run" = "1" ]; then
    echo -e "${YELLOW:-}  ${prefix}canon-snapshot-gate: LAGGING -- the snapshot's theo_stamp.mapped_by is ${mapped_by} (version ${stamped_version}), expected ${current_version}. A real release would ABORT here. Recovery: ${refresh_cmd} after Theo's re-emit.${NC:-}"
    return 0
  fi
  echo -e "${RED:-}  x canon-snapshot-gate: LAGGING -- the snapshot's theo_stamp.mapped_by is ${mapped_by} (version ${stamped_version}), expected ${current_version}. The canon snapshot was not refreshed after Theo's re-emit for the version this release supersedes.${NC:-}"
  echo "    Recovery: once Theo has re-emitted for ${current_version} (RULE 5 place 8), run ${refresh_cmd}, commit the snapshot, then re-run this release."
  echo "    Audited opt-out: re-run with --no-canon-snapshot-check."
  return 1
}
