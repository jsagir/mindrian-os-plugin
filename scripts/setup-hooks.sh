#!/usr/bin/env bash
# MindrianOS git hooks installer.
#
# BSL 1.1. Copyright (c) Mindrian 2026.
#
# Purpose (SEC-04 / Phase 87-01a):
#   Install the pre-commit hook that enforces the ROOM.md + MINTO.md
#   invariant (CLAUDE.md decision #15) scoped to `.room-root` subtrees.
#   Plugin source commits are NEVER blocked -- the guard fires only inside
#   Data Room subtrees.
#
# Worktree safety (R-87-01a-WIN):
#   The effective hooks/pre-commit path is resolved via
#   `git rev-parse --git-path hooks/pre-commit`, NOT
#   `git rev-parse --show-toplevel/.git/hooks/`. In a linked worktree, `.git`
#   is a FILE pointing to the real git dir under <main-git-dir>/worktrees/,
#   so `--show-toplevel` gives the wrong answer.
#
# Idempotency + race safety:
#   The install is a byte-compare (cmp -s) -- re-running over an identical
#   hook is a no-op with a "no-op" stdout message. Writes go through a
#   tempfile + atomic rename to avoid partial writes when two concurrent
#   sessions race (Cowork scenario).
#
# Windows companion:
#   If scripts/hooks/pre-commit-room-minto-guard.cmd exists, it is also
#   installed next to the .sh hook at <hooks-dir>/pre-commit.cmd. This
#   gives Windows GUI clients a non-silent fallback. See the .cmd file
#   header for the rationale.

set -eu

# Resolve repo root (caller may run from anywhere)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$REPO_ROOT" ]; then
  echo "[setup-hooks] Not inside a git repo -- skipping" >&2
  exit 0
fi

# R-87-01a-WIN: resolve effective hooks/pre-commit path via --git-path.
# This returns the correct path in git-worktree checkouts, where the
# working-tree's .git is a FILE pointing at the linked git dir under
# <main-git-dir>/worktrees/<name>/. `--show-toplevel/.git/hooks/` would
# miss the linked-worktree case.
HOOKS_PRECOMMIT=$(git rev-parse --git-path hooks/pre-commit 2>/dev/null || echo "")
if [ -z "$HOOKS_PRECOMMIT" ]; then
  echo "[setup-hooks] git rev-parse --git-path failed; fallback to .git/hooks/pre-commit" >&2
  HOOKS_PRECOMMIT="$REPO_ROOT/.git/hooks/pre-commit"
fi
# Convert relative path (git returns relative when CWD is inside repo) to absolute
case "$HOOKS_PRECOMMIT" in
  /*) ;;  # already absolute
  *)  HOOKS_PRECOMMIT="$REPO_ROOT/$HOOKS_PRECOMMIT" ;;
esac
HOOKS_DIR=$(dirname "$HOOKS_PRECOMMIT")

GUARD_SRC="$REPO_ROOT/scripts/hooks/pre-commit-room-minto-guard.sh"
GUARD_CMD_SRC="$REPO_ROOT/scripts/hooks/pre-commit-room-minto-guard.cmd"
HOOK_DST="$HOOKS_PRECOMMIT"
HOOK_CMD_DST="$HOOKS_DIR/pre-commit.cmd"

if [ ! -f "$GUARD_SRC" ]; then
  echo "[setup-hooks] Guard source missing: $GUARD_SRC" >&2
  exit 1
fi

# Idempotent install: copy only if contents differ.
# R-87-01a-WIN: atomic rename via tmp file to prevent partial writes
# when two concurrent sessions race (Cowork scenario).
if [ -f "$HOOK_DST" ] && cmp -s "$GUARD_SRC" "$HOOK_DST"; then
  echo "[setup-hooks] Pre-commit hook already installed at $HOOK_DST -- no-op"
else
  mkdir -p "$HOOKS_DIR"
  TMPDST="${HOOK_DST}.tmp.$$"
  cp "$GUARD_SRC" "$TMPDST"
  chmod +x "$TMPDST"
  mv "$TMPDST" "$HOOK_DST"  # atomic
  echo "[setup-hooks] Installed pre-commit hook: $HOOK_DST"
fi

# Install Windows .cmd companion if the source exists (safe to ship on all OSes).
# The companion lives alongside the .sh hook at <hooks-dir>/pre-commit.cmd.
# Windows GUI clients that invoke hooks via cmd.exe find it and either run bash
# or emit a clear skip message.
if [ -f "$GUARD_CMD_SRC" ]; then
  if [ -f "$HOOK_CMD_DST" ] && cmp -s "$GUARD_CMD_SRC" "$HOOK_CMD_DST"; then
    : # already matches -- no-op
  else
    TMPCMD="${HOOK_CMD_DST}.tmp.$$"
    cp "$GUARD_CMD_SRC" "$TMPCMD"
    mv "$TMPCMD" "$HOOK_CMD_DST"
    echo "[setup-hooks] Installed Windows companion: $HOOK_CMD_DST"
  fi
fi
