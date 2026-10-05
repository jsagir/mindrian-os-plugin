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
#   mos_restore_plugin_files <plugin_dir>
#       Restores plugin.json, package.json, CHANGELOG.md AND npm-shrinkwrap.json to HEAD (index and
#       worktree), one path at a time. Always returns 0. (369.1-REVIEW WR-08)
#   mos_verify_marketplace_commit <marketplace_dir> <version>
#       0 only when the marketplace's COMMITTED state (HEAD) carries mos and mos-desktop at
#       <version> and plugins/mos-desktop at <version>, with nothing staged or modified left over.
#   mos_unwind_marketplace_commit <marketplace_dir> <pre_sha> <version>
#       Puts this run's unpushed "release: sync to v<version>" commit back to <pre_sha> (local-only;
#       refuses anything that is not exactly that one commit, or is already on a remote branch).
#       Always returns 0.
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

mos_restore_plugin_files() {
  local plugin_dir="${1:-}"
  local f

  if [ -z "$plugin_dir" ] || [ ! -d "$plugin_dir" ]; then
    return 0
  fi

  # The four files the release mutates before Commit A: the version bumps (Step 3), the changelog,
  # and npm-shrinkwrap.json (Step 6.7 regenerates and stages it). HEAD form per path, so the index
  # is restored as well as the worktree and one path HEAD lacks never blocks the others
  # (369.1-REVIEW WR-08: the old raw checkout forgot the shrinkwrap, so the next cut started from
  # a dirty, staged tree and tripped the clean-tree gate).
  for f in .claude-plugin/plugin.json package.json CHANGELOG.md npm-shrinkwrap.json; do
    git -C "$plugin_dir" checkout HEAD -- "$f" >/dev/null 2>&1 || true
  done
  return 0
}

mos_verify_marketplace_commit() {
  local mp_dir="${1:-}"
  local version="${2:-}"

  if [ -z "$mp_dir" ] || [ -z "$version" ]; then
    echo "  x mos_verify_marketplace_commit: usage: mos_verify_marketplace_commit <marketplace_dir> <version>"
    return 1
  fi

  # Verify the COMMITTED state (git show HEAD:...), never the worktree: a commit that failed
  # (identity, hook, lock) leaves a perfect-looking worktree and a HEAD without the release.
  if ! git -C "$mp_dir" show HEAD:.claude-plugin/marketplace.json 2>/dev/null | node -e "
let s = '';
process.stdin.on('data', function (d) { s += d; }).on('end', function () {
  try {
    const m = JSON.parse(s);
    const v = process.argv[1];
    const ok = (m.plugins || []).some(function (p) { return p && p.name === 'mos' && p.version === v; }) &&
      (m.plugins || []).some(function (p) { return p && p.name === 'mos-desktop' && p.version === v; });
    process.exit(ok ? 0 : 1);
  } catch (e) { process.exit(1); }
});
" "$version"; then
    echo "  x marketplace HEAD does not carry mos and mos-desktop at $version in marketplace.json"
    return 1
  fi
  if ! git -C "$mp_dir" show HEAD:plugins/mos-desktop/.claude-plugin/plugin.json 2>/dev/null | node -e "
let s = '';
process.stdin.on('data', function (d) { s += d; }).on('end', function () {
  try { process.exit(JSON.parse(s).version === process.argv[1] ? 0 : 1); } catch (e) { process.exit(1); }
});
" "$version"; then
    echo "  x marketplace HEAD does not carry plugins/mos-desktop at $version"
    return 1
  fi
  # Everything the release staged must be in that commit: no staged or modified leftovers.
  if ! git -C "$mp_dir" diff --quiet HEAD -- plugins/mos-desktop .claude-plugin/marketplace.json >/dev/null 2>&1 \
     || ! git -C "$mp_dir" diff --cached --quiet >/dev/null 2>&1; then
    echo "  x the marketplace commit is missing part of the release (staged or modified paths remain)"
    return 1
  fi
  return 0
}

mos_unwind_marketplace_commit() {
  local mp_dir="${1:-}"
  local pre_sha="${2:-}"
  local version="${3:-}"
  local head parent subject

  if [ -z "$mp_dir" ] || [ -z "$pre_sha" ] || [ -z "$version" ] || [ ! -d "$mp_dir" ]; then
    return 0
  fi

  head=$(git -C "$mp_dir" rev-parse HEAD 2>/dev/null) || return 0
  if [ "$head" = "$pre_sha" ]; then
    return 0 # this run committed nothing
  fi
  parent=$(git -C "$mp_dir" rev-parse HEAD^ 2>/dev/null || echo "")
  subject=$(git -C "$mp_dir" log -1 --format=%s 2>/dev/null || echo "")
  if [ "$parent" != "$pre_sha" ] || [ "$subject" != "release: sync to v$version" ]; then
    echo "  ! not unwinding the marketplace: HEAD is not this run's release commit"
    return 0
  fi
  # Never rewrite a commit that already left this machine.
  if [ -n "$(git -C "$mp_dir" branch -r --contains "$head" 2>/dev/null)" ]; then
    echo "  ! not unwinding the marketplace: the release commit is already on a remote branch"
    return 0
  fi
  # Local-only: put the release commit back so the next cut starts from the last pushed state, not
  # from the committed bytes of this aborted release (mos_rollback_marketplace restores HEAD).
  git -C "$mp_dir" reset --hard -q "$pre_sha" >/dev/null 2>&1 || true
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

  # The Desktop copy must not carry the workspace build (quick 261005-l8h): Desktop never launches
  # it, and the bracket and @ names inside the Next build break Desktop's zip validator. The builder
  # drops lib/ui-shell/dist; this inverse guard keeps a hand-edited or hooked builder honest. (It
  # replaces the 369.1-14 force-add of that path past the marketplace .gitignore: nothing needs
  # force-adding now, and every ignored file fails the count check below.)
  if [ -d "$out_dir/lib/ui-shell/dist" ]; then
    echo "  x mos_build_desktop_copy: the Desktop copy must not carry lib/ui-shell/dist"
    mos_rollback_marketplace "$mp_dir"
    return 1
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
