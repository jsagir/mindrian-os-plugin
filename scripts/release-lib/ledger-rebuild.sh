#!/usr/bin/env bash
# scripts/release-lib/ledger-rebuild.sh
#
# WHAT: a sourced library defining `mos_ledger_rebuild_step`, the Step 2.3 of scripts/release.sh
# (phase 379.1.1, work item 3, CLOSE379-03). It rebuilds data/section-command-ledger.json with the
# Jev-scored builder, but only when the offline check says the ledger is stale. It then commits the
# one file. The Step 2.4 offline staleness check stays as the gate that runs after this step.
#
# WHY: in the beta.73 cut the Jev-scored rebuild was a surprise manual step. A step the cut does not
# name cannot be planned, dry-run or audited. This makes it a named step with a dry-run line.
#
# WHY IT RUNS BEFORE STEP 2.5 AND STEP 2.6: the rebuild is a commit, so it moves HEAD. Step 2.6 needs
# a real-room receipt for the exact HEAD (RULE 10). The same step has a standalone mode,
# `bash scripts/release.sh --ledger-only`, to run BEFORE the human reads the real-room report. A cut
# with a stale ledger runs the step in place, and Step 2.6 then refuses until a receipt exists for the
# new HEAD. That refusal is correct and leaves no residue.
#
# THE KEY: only the builder reads the dev key. This file holds no key name and no vendor URL. It asks
# the builder for `--key-status`, which prints one word and never the value.
#
# NO RESIDUE: on every failure path the ledger file is restored with git, so no partial ledger and no
# commit remain. A ledger file with uncommitted changes aborts the step before any build.
#
# THE DRY-RUN CARVE-OUT (the real-room-gate.sh precedent): under dry_run=1 the offline check runs, the
# verdict is printed with a [DRY RUN] prefix, and the function returns 0. No build, no write, no commit.
# no_ledger_check=1 is the audited opt-out --no-ledger-check: one line, never silent.
#
# RULES for this file (real-room-gate.sh shape, copied on purpose): no `set -e`, no top-level side
# effects, safe under `set -u`, the function only returns codes and never terminates the caller shell.
#
# Phase 379.1.1 plan 02. Hyphens only.

# _mos_ledger_restore(plugin_dir) -- put the ledger file back to HEAD, staged or not.
_mos_ledger_restore() {
  local plugin_dir="${1:-}"
  git -C "$plugin_dir" reset -q -- data/section-command-ledger.json >/dev/null 2>&1 || true
  git -C "$plugin_dir" checkout -- data/section-command-ledger.json >/dev/null 2>&1 || true
}

# mos_ledger_rebuild_step(plugin_dir, dry_run, no_ledger_check)
# Returns 0 on success or skip, 1 on abort.
mos_ledger_rebuild_step() {
  local plugin_dir="${1:-}"
  local dry_run="${2:-0}"
  local no_check="${3:-0}"
  local ledger_rel="data/section-command-ledger.json"

  if [ -z "$plugin_dir" ]; then
    echo "  x ledger-rebuild: missing plugin_dir argument"
    return 1
  fi

  # 1. The audited opt-out. One line, never silent.
  if [ "$no_check" = "1" ]; then
    echo -e "${YELLOW:-}  ! ledger-rebuild: SKIPPED via --no-ledger-check. A deliberately stale ledger ships this release and no rebuild runs. The Step 2.4 staleness check is skipped too.${NC:-}"
    return 0
  fi

  # 2. The offline check. Keep its text.
  local check_text check_rc
  check_text="$(node "$plugin_dir/scripts/build-section-command-ledger.cjs" --check 2>&1)"
  check_rc=$?
  if [ "$check_rc" = "0" ]; then
    echo -e "${GREEN:-}  ledger-rebuild: the section-command ledger is current for the repo version. Rebuild skipped.${NC:-}"
    return 0
  fi
  local first_line
  first_line="$(printf '%s\n' "$check_text" | head -n 1)"

  # 3. Stale. Under a dry run, print the verdict and run nothing else.
  if [ "$dry_run" = "1" ]; then
    echo -e "${YELLOW:-}  [DRY RUN] ledger-rebuild: ${first_line} -- would rebuild with the Jev-scored builder and commit ${ledger_rel}${NC:-}"
    return 0
  fi

  echo "  ledger-rebuild: ${first_line}"

  # 4. The dev key must exist. The builder says present or absent; it never prints the value.
  if ! node "$plugin_dir/scripts/build-section-command-ledger.cjs" --key-status >/dev/null 2>&1; then
    echo -e "${RED:-}  x ledger-rebuild: ABORT -- the ledger is stale and the dev key is absent, so the Jev-scored rebuild cannot run.${NC:-}"
    echo "    Recovery: put the dev key in ~/.secrets/typesafe.env, then re-run."
    echo "    Or pass --no-ledger-check (audited opt-out; a stale ledger ships)."
    echo "    Or run the builder with --offline-seed for a key-free degraded ledger."
    return 1
  fi

  # 5. The ledger file must be clean before the build, so a restore can never lose a person's edit.
  local dirty
  dirty="$(git -C "$plugin_dir" status --porcelain -- "$ledger_rel" 2>/dev/null || true)"
  if [ -n "$dirty" ]; then
    echo -e "${RED:-}  x ledger-rebuild: ABORT -- ${ledger_rel} has uncommitted changes. Commit or discard them, then re-run.${NC:-}"
    return 1
  fi

  # 6. The live Jev-scored build. On failure, restore the file.
  echo "  ledger-rebuild: running the Jev-scored build (this calls the vendor and Theo)"
  if ! node "$plugin_dir/scripts/build-section-command-ledger.cjs"; then
    _mos_ledger_restore "$plugin_dir"
    echo -e "${RED:-}  x ledger-rebuild: ABORT -- the Jev-scored build failed. ${ledger_rel} was restored.${NC:-}"
    return 1
  fi

  # 7. The rebuilt ledger must pass the offline check.
  if ! node "$plugin_dir/scripts/build-section-command-ledger.cjs" --check >/dev/null 2>&1; then
    _mos_ledger_restore "$plugin_dir"
    echo -e "${RED:-}  x ledger-rebuild: ABORT -- the rebuilt ledger failed the offline check. ${ledger_rel} was restored.${NC:-}"
    return 1
  fi

  # 8. Commit the one file. The subject names the version, the model, the frameworks and the rows.
  local version facts model frameworks rows subject
  version="$(node "$plugin_dir/lib/core/repo-version.cjs" 2>/dev/null | tr -d '[:space:]')"
  [ -z "$version" ] && version="unknown"
  facts="$(node -e '
    var l = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write([String(l.jev_model), String(l.theo_frameworks), String(Object.keys(l.rows || {}).length)].join(" "));
  ' "$plugin_dir/$ledger_rel" 2>/dev/null || true)"
  model="${facts%% *}"
  frameworks="${facts#* }"; frameworks="${frameworks%% *}"
  rows="${facts##* }"
  if [ -z "$facts" ]; then
    _mos_ledger_restore "$plugin_dir"
    echo -e "${RED:-}  x ledger-rebuild: ABORT -- the rebuilt ledger could not be read. ${ledger_rel} was restored.${NC:-}"
    return 1
  fi
  subject="chore(release): Jev-scored rebuild of the section-command ledger for ${version} (${model}, ${frameworks} Theo frameworks, ${rows} rows)"
  if ! git -C "$plugin_dir" add -- "$ledger_rel" >/dev/null 2>&1 \
     || ! git -C "$plugin_dir" commit --only -q -m "$subject" -- "$ledger_rel" >/dev/null 2>&1; then
    _mos_ledger_restore "$plugin_dir"
    echo -e "${RED:-}  x ledger-rebuild: ABORT -- the commit of ${ledger_rel} failed. The file was restored.${NC:-}"
    return 1
  fi

  # 9. HEAD moved. Say what that means for Step 2.6.
  local new_sha
  new_sha="$(git -C "$plugin_dir" rev-parse --short HEAD 2>/dev/null || true)"
  echo -e "${GREEN:-}  ledger-rebuild: rebuilt and committed ${new_sha}.${NC:-}"
  echo "    HEAD moved, so Step 2.6 needs a real-room receipt for the new HEAD (RULE 10)."
  return 0
}
