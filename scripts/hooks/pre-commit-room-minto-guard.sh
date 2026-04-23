#!/usr/bin/env bash
# MindrianOS pre-commit guard: every Data Room directory must have ROOM.md + MINTO.md.
#
# BSL 1.1. Copyright (c) Mindrian 2026.
#
# Purpose (SEC-04 / Phase 87-01a):
#   Enforce CLAUDE.md decision #15 + Phase 81 Feynman-MINTO invariant at git
#   commit time. The invariant states: every directory inside a Data Room must
#   hold both ROOM.md (ICM Layer 0 identity) and MINTO.md (Feynman-MINTO
#   reasoning state). Violations produce misfiling and cross-room leaks
#   (witnessed in Phase 83).
#
# Scoping (R-C4 regression fix):
#   The invariant applies ONLY to Data Room subtrees. A Data Room subtree is
#   marked by a `.room-root` sentinel file at its root. Plugin source dirs
#   (lib/, scripts/, commands/, templates/, etc.) have NO `.room-root` ancestor
#   and are NEVER blocked by this hook. This is the correct reading of
#   decision #15 -- the invariant targets user-facing Data Rooms, not plugin
#   source trees. If this scoping rule regresses, Test 5 in
#   lib/memory/room-minto-hook.test.cjs fails immediately.
#
# Worktree safety (R-87-01a-WIN):
#   The installer uses `git rev-parse --git-path hooks/pre-commit` to resolve
#   the effective hooks directory. In a linked worktree, `.git` is a FILE
#   containing `gitdir: <main-git-dir>/worktrees/<name>/`, and the real
#   hooks dir is NOT `<repo>/.git/hooks`. See scripts/setup-hooks.sh.
#
# Symlink safety (R-87-01a-WIN):
#   find_room_root walks ancestor dirs via `cd + pwd -P` (realpath) and
#   records visited realpaths in a VISITED associative array. A symlink that
#   points back into the walked tree is detected and the walk terminates
#   without looping.
#
# Exit codes:
#   0  -- all staged dirs either pass the invariant or are outside any Data
#         Room subtree (plugin source). Commit proceeds.
#   2  -- at least one Data Room dir is missing ROOM.md or MINTO.md. Commit
#         rejected with a clear stderr message pointing to decision #15.

set -u

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$REPO_ROOT" ]; then
  exit 0  # Not a git repo -- nothing to check
fi

# Resolve realpath of REPO_ROOT so we terminate the walk at the correct boundary
# even when the working tree is reached via a symlink.
REPO_ROOT_REAL=$(cd "$REPO_ROOT" 2>/dev/null && pwd -P)
[ -z "$REPO_ROOT_REAL" ] && REPO_ROOT_REAL="$REPO_ROOT"

VIOLATIONS=0
MESSAGES=()

# Directories that contain staged changes (added, modified, or renamed).
# We deduplicate and exclude empty entries ("." from dirname of top-level files).
STAGED_DIRS=$(git diff --cached --name-only --diff-filter=AMR 2>/dev/null \
  | xargs -n1 -I{} dirname "{}" 2>/dev/null \
  | sort -u)

# Walk up from $1 (a staged dir path, repo-relative) looking for `.room-root`.
# Realpath-normalize each step; dedupe via VISITED to prevent symlink loops.
# Prints the absolute realpath of the directory containing .room-root, or
# empty if none found.
find_room_root() {
  local dir="$1"
  local abs="$REPO_ROOT/$dir"
  local real
  declare -A VISITED
  while :; do
    real=$(cd "$abs" 2>/dev/null && pwd -P) || return 1
    # Termination: walked above the repo root
    case "$real" in
      "$REPO_ROOT_REAL"|"/") break ;;
    esac
    # Loop guard (symlink cycle detection)
    if [ -n "${VISITED[$real]:-}" ]; then
      break
    fi
    VISITED[$real]=1
    if [ -f "$real/.room-root" ]; then
      echo "$real"
      return 0
    fi
    abs=$(dirname "$real")
  done
  # Also check repo root itself (a Data Room rooted at the repo root)
  if [ -f "$REPO_ROOT_REAL/.room-root" ]; then
    echo "$REPO_ROOT_REAL"
    return 0
  fi
  echo ""
  return 1
}

for dir in $STAGED_DIRS; do
  [ -z "$dir" ] && continue
  [ "$dir" = "." ] && continue

  # Scoping gate: only enforce within a .room-root subtree.
  # If no ancestor holds .room-root, this is plugin source -- SKIP.
  ROOM_ROOT=$(find_room_root "$dir")
  if [ -z "$ROOM_ROOT" ]; then
    continue  # Plugin source dir -- not a Data Room -- skip silently
  fi

  # Inside a Data Room subtree -- enforce ROOM.md + MINTO.md
  abs_dir="$REPO_ROOT/$dir"
  if [ -d "$abs_dir" ]; then
    if [ ! -f "$abs_dir/ROOM.md" ]; then
      MESSAGES+=("MISSING ROOM.md: $dir")
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
    if [ ! -f "$abs_dir/MINTO.md" ]; then
      MESSAGES+=("MISSING MINTO.md: $dir")
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "MindrianOS pre-commit guard: ROOM.md + MINTO.md invariant violated ($VIOLATIONS issue(s))." >&2
  for m in "${MESSAGES[@]}"; do echo "  $m" >&2; done
  echo "" >&2
  echo "Per CLAUDE.md decision #15: every Data Room directory must have ROOM.md (identity) + MINTO.md (reasoning)." >&2
  echo "This check fires only for dirs inside a subtree marked with a .room-root sentinel." >&2
  echo "Generate with: node scripts/generate-section-intelligence.cjs <dir>" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Phase 88-13 guardian: block commit on critical/error invariant violations.
#
# Iterates over each DISCOVERED room root from the find_room_root loop above
# (NOT a nonexistent top-level $ROOM_DIR variable). For each unique Data Room
# root that owns staged files, runs the Feynman-MINTO guardian in pre-commit
# mode. The guardian runs every registered validator against each section
# whose staged file lives under it and exits 2 on critical/error severity.
#
# Plugin source commits (no .room-root ancestor anywhere) never reach this
# block because the find_room_root loop above has nothing to add to
# DISCOVERED_ROOM_ROOTS for them. See 88-13-SUMMARY.md.
# ---------------------------------------------------------------------------
#
# Re-walk staged dirs to collect unique Data Room roots (dedup). The 87-01a
# loop above only needs the immediate dir; we need the ancestor root.
declare -A _DISCOVERED_ROOTS
for _dir in $STAGED_DIRS; do
  [ -z "$_dir" ] && continue
  [ "$_dir" = "." ] && continue
  _root=$(find_room_root "$_dir" 2>/dev/null || echo "")
  if [ -n "$_root" ]; then
    _DISCOVERED_ROOTS["$_root"]=1
  fi
done

# Locate the plugin root for the guardian script. Prefer $PLUGIN_ROOT if set
# by the caller; otherwise walk up from this script's directory.
_GUARDIAN_PLUGIN_ROOT="${PLUGIN_ROOT:-}"
if [ -z "$_GUARDIAN_PLUGIN_ROOT" ]; then
  _SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd -P)
  # The installed hook lives at <repo>/.git/hooks/pre-commit (or worktree equiv);
  # its siblings in this source file live at <repo>/scripts/hooks/. Walk up to
  # find scripts/feynman-minto-guardian.cjs.
  _candidate="$REPO_ROOT_REAL"
  if [ -f "$_candidate/scripts/feynman-minto-guardian.cjs" ]; then
    _GUARDIAN_PLUGIN_ROOT="$_candidate"
  fi
fi

if [ -n "$_GUARDIAN_PLUGIN_ROOT" ] && [ -f "$_GUARDIAN_PLUGIN_ROOT/scripts/feynman-minto-guardian.cjs" ] && command -v node >/dev/null 2>&1; then
  for _discovered_room in "${!_DISCOVERED_ROOTS[@]}"; do
    [ -z "$_discovered_room" ] && continue
    node "$_GUARDIAN_PLUGIN_ROOT/scripts/feynman-minto-guardian.cjs" pre-commit "$_discovered_room"
    _GUARDIAN_EXIT=$?
    if [ "$_GUARDIAN_EXIT" -ne 0 ]; then
      echo "" >&2
      echo "MindrianOS pre-commit guard: commit blocked by feynman-minto-guardian in room: $_discovered_room" >&2
      echo "Fix violations or use --no-verify at your own risk." >&2
      exit "$_GUARDIAN_EXIT"
    fi
  done
fi

exit 0
