#!/usr/bin/env bash
# scripts/release-lib/shrinkwrap-gate.sh
#
# WHAT: a pure, injectable shrinkwrap-generation-plus-assertion function for
# release.sh's Step 6.7 slot: `mos_generate_shrinkwrap`.
#
# WHY (D-06, 341-RESEARCH Pattern 1): Step 6.7 used to vendor a production
# node_modules tree into the tagged release commit, on a 2026-05-21 premise
# ("every production dependency is pure JS") that expired 2026-07-05 when the
# heavy embedding stack landed. Under D-01's npm-source distribution, the
# loader installs dependencies itself via `npm ci --ignore-scripts` off a
# published npm-shrinkwrap.json -- this library generates and triple-asserts
# that file instead of vendoring anything. Extracted into this sourceable
# library (the verify-tag-push.sh idiom) so every branch -- a failing
# shrinkwrap, a dev-only entry, a missing pack-payload entry -- can be proved
# by a test with fake hooks, without a real npm shrinkwrap or a real publish.
#
# RETURN CODES (the contract, exact -- do not improvise):
#   0  = shrinkwrap generated and all three assertions passed.
#   1  = fail closed, the caller must hard-abort. There is no warn code here:
#        a missing lockfile in the tarball is not a warning, it is the single
#        highest-risk assertion in the phase (T-341-16) -- a user's install
#        would silently skip the dependency step and both alwaysLoad MCP
#        servers would fail on require, with no log entry pointing at why.
#
# HOOK ENV VARS (injected, resolved by name via `command -v`):
#   MOS_SHRINKWRAP_HOOK   (optional, defaults to the real `npm shrinkwrap`)
#                         -- called as "$hook", no args, cwd is the caller's
#                         responsibility (mos_generate_shrinkwrap cd's into
#                         plugin_dir first). Returns 0 on success.
#   MOS_PACK_PROBE_HOOK   (optional, defaults to the real
#                         `npm pack --dry-run --json`) -- called as "$hook",
#                         no args, must print an `npm pack --dry-run --json`
#                         shaped array on stdout (or an equivalent fixture in
#                         tests).
# Both default to the real thing when unset, so production behavior is
# unchanged when nothing is injected.
#
# RULES for this file:
#   - Does not enable bash's errexit option anywhere. The caller's shell
#     options are never inherited by force.
#   - No top-level side effects, no global variable assignments outside the
#     function body. Safe to source more than once.
#   - Safe to source under `set -u`: every parameter expansion here is
#     guarded with `${VAR:-}`.
#
# NODE_ENV / omit (341-RESEARCH Pattern 1 discretion item): the production
# environment variable that flips npm's install-time omit default is NEVER
# assigned anywhere in this file or in release.sh. `npm ci`'s `omit` default
# is `[]` unless that variable names the production environment, and the
# loader controls its own environment, not this script's. Setting it at
# release time would only change what the SHRINKWRAP records, and a
# shrinkwrap generated with that variable pinned to production can omit
# metadata a later `npm ci` needs. The correct control is assertion 2 below
# (zero dev entries), not the environment.
#
# Phase 341 (D-06). Replaces the vendoring formerly in release.sh Step 6.7.

mos_generate_shrinkwrap() {
  local plugin_dir="${1:-}"

  if [ -z "$plugin_dir" ]; then
    echo "  x mos_generate_shrinkwrap: missing <plugin_dir> argument"
    return 1
  fi

  local shrinkwrap_hook="${MOS_SHRINKWRAP_HOOK:-}"
  local pack_probe_hook="${MOS_PACK_PROBE_HOOK:-}"

  # 1. Run the shrinkwrap hook (or the real `npm shrinkwrap` if unset).
  if [ -n "$shrinkwrap_hook" ]; then
    if ! command -v "$shrinkwrap_hook" >/dev/null 2>&1; then
      echo "  x mos_generate_shrinkwrap: MOS_SHRINKWRAP_HOOK '${shrinkwrap_hook}' is not callable"
      return 1
    fi
    if ! (cd "$plugin_dir" && "$shrinkwrap_hook"); then
      echo "  x npm shrinkwrap failed. package-lock.json is likely out of sync with package.json."
      return 1
    fi
  else
    if ! (cd "$plugin_dir" && npm shrinkwrap); then
      echo "  x npm shrinkwrap failed. package-lock.json is likely out of sync with package.json."
      return 1
    fi
  fi

  # 2. Assert zero dev entries. The loader passes NO --omit flag, so a
  #    dev:true entry in the shrinkwrap WOULD be installed on every user's
  #    machine -- this is a real exposure, not hygiene.
  local shrinkwrap_path="$plugin_dir/npm-shrinkwrap.json"
  if [ ! -f "$shrinkwrap_path" ]; then
    echo "  x npm-shrinkwrap.json does not exist at $shrinkwrap_path after the shrinkwrap hook reported success."
    return 1
  fi
  if ! node -e "
const l = require('$shrinkwrap_path');
const packages = (l && l.packages) || {};
const hasDev = Object.keys(packages).some(function (k) { return packages[k] && packages[k].dev === true; });
process.exit(hasDev ? 1 : 0);
"; then
    echo "  x npm-shrinkwrap.json contains dev-only packages; the loader would install them on every user machine."
    return 1
  fi

  # 3. Assert the lockfile is IN the pack payload. The single highest-risk
  #    assertion in the phase (T-341-16): without it the loader skips the
  #    dependency install WITHOUT a log entry and both MCP servers fail to
  #    load, with nothing pointing at why.
  local pack_json
  if [ -n "$pack_probe_hook" ]; then
    if ! command -v "$pack_probe_hook" >/dev/null 2>&1; then
      echo "  x mos_generate_shrinkwrap: MOS_PACK_PROBE_HOOK '${pack_probe_hook}' is not callable"
      return 1
    fi
    pack_json="$(cd "$plugin_dir" && "$pack_probe_hook")"
  else
    pack_json="$(cd "$plugin_dir" && npm pack --dry-run --json 2>/dev/null)"
  fi

  if ! printf '%s' "$pack_json" | node -e "
let s = '';
process.stdin.on('data', function (d) { s += d; });
process.stdin.on('end', function () {
  try {
    const j = JSON.parse(s)[0];
    process.exit((j && Array.isArray(j.files) && j.files.some(function (f) { return f.path === 'npm-shrinkwrap.json'; })) ? 0 : 1);
  } catch (e) {
    process.exit(1);
  }
});
"; then
    echo "  x npm-shrinkwrap.json is NOT in the pack payload. Add it to package.json \"files\"."
    echo "    Without it the loader skips the dependency install WITHOUT a log entry and both MCP servers fail to load."
    return 1
  fi

  git -C "$plugin_dir" add npm-shrinkwrap.json
  return 0
}
