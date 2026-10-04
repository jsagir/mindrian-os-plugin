#!/usr/bin/env bash
# scripts/release-lib/desktop-copy-gate.sh
#
# WHAT: three sourceable functions that put the Claude Desktop copy of the plugin into the
# release ceremony: `mos_write_desktop_entry`, `mos_build_desktop_copy` and
# `mos_rollback_marketplace`. release.sh calls them at Step 6.8 and on every abort path that
# used to restore only marketplace.json.
#
# WHY (Phase 369.1, D-03, D-13): Claude Desktop cannot sync an npm-source plugin, so the
# marketplace carries a second entry, plugins[1] `mos-desktop`, whose source is the relative
# path ./plugins/mos-desktop: a bin-less copy of the npm pack payload built at release time.
# D-03 forbids hand edits to marketplace.json, so the entry and the tree are written only here.
# The copy rides the existing marketplace commit (Step 7) and push (Step 9); it is part of
# RULE 5 place 5 in docs/RELEASE-CEREMONY-RULING-SYSTEM.md, not a new lockstep place. Because
# the tree is a second artifact beside the manifest, every abort must roll BOTH back
# (mos_rollback_marketplace), or the next cut starts from a half-written tree (T-369.1-14-01).
# Extracted into this sourceable library (the shrinkwrap-gate.sh idiom) so each branch can be
# proved against sandbox repos with a fake builder.
#
# FUNCTIONS:
#   mos_write_desktop_entry <marketplace_dir> <version>
#       Rewrites .claude-plugin/marketplace.json so plugins is [mos, mos-desktop, ...others].
#       mos is found by name and kept untouched; any existing mos-desktop entries are dropped
#       and one fresh one is written. Idempotent (a second run is byte-identical). 1 when the
#       manifest is unreadable or has no mos entry.
#   mos_build_desktop_copy <plugin_dir> <marketplace_dir> <version>
#       Builds <marketplace_dir>/plugins/mos-desktop with the builder, writes plugins[1],
#       stages the tree scoped to its path, checks the staged count equals the built count
#       and that nothing was swallowed by an ignore rule. Never commits. On any failure it
#       rolls the marketplace back itself.
#   mos_rollback_marketplace <marketplace_dir>
#       Restores the manifest and the Desktop tree (first cut: removes it; later cut: restores
#       the committed bytes). Touches no other path. Always returns 0.
#
# RETURN CODES (mos_build_desktop_copy, mos_write_desktop_entry):
#   0  = done.
#   1  = fail closed, the caller must hard-abort. There is no warn code.
#
# HOOK ENV VARS:
#   MOS_DESKTOP_BUILD_HOOK  (optional, defaults to <plugin_dir>/scripts/release-lib/
#                           build-desktop-artifact.cjs) -- a node script called as
#                           node "$hook" build --source <plugin_dir> --out <mp>/plugins/mos-desktop
#                                 --version <v> --json
#                           and expected to print one JSON report line with a "files" count.
#
# RULES for this file:
#   - Does not enable bash's errexit option anywhere. The caller's shell options are never
#     inherited by force.
#   - No top-level side effects, no global variable assignments outside function bodies. Safe
#     to source more than once.
#   - Safe to source under `set -u`: every parameter expansion is guarded with `${VAR:-}`.

mos_write_desktop_entry() {
  local mp_dir="${1:-}"
  local version="${2:-}"

  if [ -z "$mp_dir" ] || [ -z "$version" ]; then
    echo "  x mos_write_desktop_entry: usage: mos_write_desktop_entry <marketplace_dir> <version>"
    return 1
  fi
  if [ ! -f "$mp_dir/.claude-plugin/marketplace.json" ]; then
    echo "  x mos_write_desktop_entry: $mp_dir/.claude-plugin/marketplace.json is missing"
    return 1
  fi

  MOS_MP_DIR="$mp_dir" MOS_DESKTOP_VERSION="$version" node -e "
const fs = require('fs');
const path = require('path');
const file = path.join(process.env.MOS_MP_DIR, '.claude-plugin', 'marketplace.json');
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
const plugins = Array.isArray(m.plugins) ? m.plugins : [];
const mos = plugins.find(function (p) { return p && p.name === 'mos'; });
if (!mos) {
  console.error('  x mos_write_desktop_entry: no entry named mos in marketplace.json');
  process.exit(1);
}
const others = plugins.filter(function (p) { return p !== mos && !(p && p.name === 'mos-desktop'); });
const desktop = {
  name: 'mos-desktop',
  displayName: 'MindrianOS',
  description: 'MindrianOS for Claude Desktop: Larry and the room tools in Cowork and the Code tab; Chat gets the skills and commands. In Claude Code, install mos instead.',
  version: process.env.MOS_DESKTOP_VERSION,
  source: './plugins/mos-desktop'
};
m.plugins = [mos, desktop].concat(others);
fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
" || return 1
  return 0
}

mos_rollback_marketplace() {
  local mp_dir="${1:-}"

  if [ -z "$mp_dir" ] || [ ! -d "$mp_dir" ]; then
    return 0
  fi

  # HEAD form: restores the index too, since the build stages the manifest before a count check can fail.
  git -C "$mp_dir" checkout HEAD -- .claude-plugin/marketplace.json >/dev/null 2>&1 || true
  # Unstage everything under the Desktop path, then put back what HEAD has (later cuts), then
  # remove whatever is left that HEAD does not have (first cut, stray untracked files).
  git -C "$mp_dir" rm -r -q --cached --ignore-unmatch -- plugins/mos-desktop >/dev/null 2>&1 || true
  git -C "$mp_dir" checkout HEAD -- plugins/mos-desktop >/dev/null 2>&1 || true
  # -x: also remove ignored leftovers under this one path (e.g. a .next/ the catalog .gitignore hides).
  git -C "$mp_dir" clean -fdxq -- plugins/mos-desktop >/dev/null 2>&1 || true
  return 0
}

mos_build_desktop_copy() {
  local plugin_dir="${1:-}"
  local mp_dir="${2:-}"
  local version="${3:-}"

  if [ -z "$plugin_dir" ] || [ -z "$mp_dir" ] || [ -z "$version" ]; then
    echo "  x mos_build_desktop_copy: usage: mos_build_desktop_copy <plugin_dir> <marketplace_dir> <version>"
    return 1
  fi

  local builder="${MOS_DESKTOP_BUILD_HOOK:-$plugin_dir/scripts/release-lib/build-desktop-artifact.cjs}"
  if [ ! -f "$builder" ]; then
    echo "  x mos_build_desktop_copy: builder '$builder' is missing"
    mos_rollback_marketplace "$mp_dir"
    return 1
  fi

  local out_dir="$mp_dir/plugins/mos-desktop"
  local report
  report=$(node "$builder" build --source "$plugin_dir" --out "$out_dir" --version "$version" --json)
  local build_rc=$?
  if [ "$build_rc" -ne 0 ]; then
    echo "  x mos_build_desktop_copy: the builder exited $build_rc"
    mos_rollback_marketplace "$mp_dir"
    return 1
  fi

  # Last non-empty line is the one-line JSON report.
  local line
  line=$(printf '%s\n' "$report" | awk 'NF { l = $0 } END { print l }')
  local built_files built_bytes
  built_files=$(printf '%s' "$line" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);console.log(Number.isInteger(r.files)?r.files:'')}catch(e){console.log('')}})")
  built_bytes=$(printf '%s' "$line" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);console.log(Number.isFinite(r.bytes)?r.bytes:0)}catch(e){console.log(0)}})")
  if [ -z "$built_files" ]; then
    echo "  x mos_build_desktop_copy: the builder report has no integer files count"
    mos_rollback_marketplace "$mp_dir"
    return 1
  fi

  if ! mos_write_desktop_entry "$mp_dir" "$version"; then
    mos_rollback_marketplace "$mp_dir"
    return 1
  fi

  if ! git -C "$mp_dir" add --all -- plugins/mos-desktop .claude-plugin/marketplace.json >/dev/null 2>&1; then
    echo "  x mos_build_desktop_copy: git add failed in $mp_dir"
    mos_rollback_marketplace "$mp_dir"
    return 1
  fi

  # The release-built UI dist (lib/ui-shell/dist, Phase 369) legitimately contains a .next/ server
  # build, which the marketplace repo's catalog-level .gitignore (D-06: no stray .next/ at the repo
  # top) would swallow, silently dropping 259 files the payload needs. Force-add exactly that one
  # path; every OTHER ignored file still fails the count check below. Found by the 369.1-14
  # rehearsal against a clone of the real marketplace repo.
  if [ -d "$out_dir/lib/ui-shell/dist" ]; then
    git -C "$mp_dir" add --force --all -- plugins/mos-desktop/lib/ui-shell/dist >/dev/null 2>&1
  fi

  local ignored_line
  ignored_line=$(git -C "$mp_dir" status --porcelain --ignored -- plugins/mos-desktop 2>/dev/null | grep '^!!' | head -n 1)
  local staged_count
  staged_count=$(git -C "$mp_dir" ls-files -- plugins/mos-desktop | wc -l | tr -d ' ')
  if [ -n "$ignored_line" ] || [ "$staged_count" != "$built_files" ]; then
    echo "  x mos_build_desktop_copy: built $built_files files but $staged_count are staged; first ignored path: ${ignored_line:-none}"
    mos_rollback_marketplace "$mp_dir"
    return 1
  fi

  echo "  Desktop copy: $built_files files, $built_bytes bytes, plugins[1] mos-desktop at $version"
  return 0
}
