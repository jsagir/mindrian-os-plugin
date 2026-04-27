#!/usr/bin/env bash
#
# release-beta-preflight.sh
#
# Pre-tag tripwire for beta releases. Refuses to allow tag operations when
# .claude-plugin/plugin.json `version` does NOT end with `-beta.N` and when
# package.json drifts from plugin.json. Pure file-state check; never invokes
# git. Runs BEFORE Task 6a's release commit and BEFORE Task 6b's tag in the
# Phase 89.6 release-gate plan.
#
# Reference: .planning/phases/89.6-release-gate-beta-1/89.6-CONTEXT.md (Area 4
# Q1 — tripwire decision); .claude/includes/release-process.md (§Version
# Consistency Rule + §Pre-release versions for beta testing).
#
# Exit codes:
#   0 — plugin.json version matches `-beta.N` AND package.json agrees
#   1 — version does not match, files disagree, or files missing
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_JSON="$REPO_ROOT/.claude-plugin/plugin.json"
PKG_JSON="$REPO_ROOT/package.json"

if [[ ! -f "$PLUGIN_JSON" ]]; then
  echo "[preflight] REFUSED: $PLUGIN_JSON not found" >&2
  exit 1
fi
if [[ ! -f "$PKG_JSON" ]]; then
  echo "[preflight] REFUSED: $PKG_JSON not found" >&2
  exit 1
fi

read_version() {
  local file="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r .version "$file"
  else
    grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' "$file" \
      | head -1 \
      | sed 's/.*"\(.*\)"/\1/'
  fi
}

VERSION="$(read_version "$PLUGIN_JSON")"
PKG_VERSION="$(read_version "$PKG_JSON")"

if [[ -z "${VERSION:-}" || "$VERSION" == "null" ]]; then
  echo "[preflight] REFUSED: could not read version from $PLUGIN_JSON" >&2
  exit 1
fi
if [[ -z "${PKG_VERSION:-}" || "$PKG_VERSION" == "null" ]]; then
  echo "[preflight] REFUSED: could not read version from $PKG_JSON" >&2
  exit 1
fi

if [[ ! "$VERSION" =~ -beta\.[0-9]+$ ]]; then
  echo "[preflight] REFUSED: plugin.json version is '$VERSION' but expected suffix -beta.N. Refusing tag operation." >&2
  exit 1
fi

if [[ "$VERSION" != "$PKG_VERSION" ]]; then
  echo "[preflight] REFUSED: plugin.json ($VERSION) and package.json ($PKG_VERSION) disagree." >&2
  exit 1
fi

echo "[preflight] OK: plugin.json version is $VERSION (matches -beta.N pattern)"
echo "[preflight] OK: package.json version agrees ($PKG_VERSION)"
exit 0
