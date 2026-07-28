#!/usr/bin/env bash
# MindrianOS pre-commit hook installer (dev-clone path).
#
# BSL 1.1. Copyright (c) Mindrian 2026.
#
# Usage:
#   bash scripts/install-pre-commit.sh
#
# What it does (Phase 235-01, CIRS-01 -- read this before changing anything):
#   It byte-copies scripts/hooks/pre-commit-room-minto-guard.sh into the
#   repository's effective hooks/pre-commit path. That is the SAME canonical
#   hook, from the SAME single source file, that scripts/setup-hooks.sh
#   installs, using the SAME cmp-then-copy idiom. This script no longer authors
#   any hook content of its own.
#
# Why the old behavior was retired (the C-1 divergence bug):
#   Until Phase 235 this script hand-authored the hook body two different ways:
#   it either spliced "missing guard" heredoc snippets into an existing foreign
#   hook just before its terminal `exit 0`, or wrote a fresh from-scratch
#   HOOK_BODY template. That made it a SECOND independent source of hook
#   content, and it drifted from scripts/hooks/pre-commit and from
#   scripts/hooks/pre-commit-room-minto-guard.sh -- none of the three was a
#   superset of the other two. Because scripts/session-start runs BOTH
#   installers every session (install-pre-commit.sh on a dev-clone version
#   change, then setup-hooks.sh unconditionally), and setup-hooks.sh's
#   `cmp -s` reinstall check fires whenever the installed hook differs and
#   overwrites it with the guard source, whichever body this script produced
#   was immediately replaced. The born-wired connector-registry /
#   orchestration-projection / shape-declaration gates were therefore never
#   live in the actual installed .git/hooks/pre-commit. One canonical source
#   copied verbatim by both installers makes that divergence impossible by
#   construction rather than by discipline (Canon Part 11: one governed path).
#
#   The historical "append the missing guards to an existing foreign hook"
#   behavior is retired on purpose. A foreign hook is now overwritten with the
#   canonical body, exactly as setup-hooks.sh already did; splicing into an
#   unknown body was the second half of the divergence bug.
#
# Worktree safety (R-87-01a-WIN):
#   The effective hooks/pre-commit path is resolved via
#   `git rev-parse --git-path hooks/pre-commit`, NOT `<toplevel>/.git/hooks/`.
#   In a linked worktree `.git` is a FILE pointing at the real git dir under
#   <main-git-dir>/worktrees/<name>/, so the naive path is wrong there. Both
#   installers must resolve the SAME destination or they would each write a
#   different file in a worktree and the convergence guarantee would be void.
#
# Idempotency + race safety:
#   The install is a byte-compare (cmp -s) -- re-running over an identical hook
#   is a no-op. Writes go through a tempfile + atomic rename so two concurrent
#   sessions cannot leave a partial hook behind (Cowork scenario).
#
# Bypass policy: git commit --no-verify always bypasses the hook. Per the Phase
# 108 social convention, any --no-verify for schema work requires opening a
# canon-amendment PR within 24 hours. Document, do not enforce.
#
# Canon Part 8: git-surface only; zero Brain queries, zero network.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
if [ -z "$REPO_ROOT" ]; then
  echo "[install-pre-commit] Not inside a git repo -- skipping" >&2
  exit 0
fi

# Resolve the installer's own directory so the canonical hook source is found
# even when installing into a DIFFERENT repo (test-harness scenario) or when
# the current repo is not the plugin repo.
SCRIPT_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
if [ -z "$SCRIPT_SRC_DIR" ]; then
  SCRIPT_SRC_DIR="$(dirname "${BASH_SOURCE[0]}")"
fi

GUARD_SRC="$SCRIPT_SRC_DIR/hooks/pre-commit-room-minto-guard.sh"
if [ ! -f "$GUARD_SRC" ]; then
  echo "[install-pre-commit] Canonical hook source missing: $GUARD_SRC" >&2
  exit 1
fi

HOOK_PATH="$(git rev-parse --git-path hooks/pre-commit 2>/dev/null || echo "")"
if [ -z "$HOOK_PATH" ]; then
  echo "[install-pre-commit] git rev-parse --git-path failed; fallback to .git/hooks/pre-commit" >&2
  HOOK_PATH="$REPO_ROOT/.git/hooks/pre-commit"
fi
# git returns a relative path when the CWD is inside the repo; make it absolute.
case "$HOOK_PATH" in
  /*) ;;
  *)  HOOK_PATH="$REPO_ROOT/$HOOK_PATH" ;;
esac
HOOKS_DIR="$(dirname "$HOOK_PATH")"

if [ -f "$HOOK_PATH" ] && cmp -s "$GUARD_SRC" "$HOOK_PATH"; then
  echo "[install-pre-commit] Canonical pre-commit hook already installed at $HOOK_PATH -- no-op"
  exit 0
fi

mkdir -p "$HOOKS_DIR"
TMPDST="${HOOK_PATH}.tmp.$$"
cp "$GUARD_SRC" "$TMPDST"
chmod +x "$TMPDST"
mv "$TMPDST" "$HOOK_PATH"  # atomic

echo "[install-pre-commit] Installed canonical pre-commit hook: $HOOK_PATH"
echo "  Source: $GUARD_SRC (same file scripts/setup-hooks.sh installs)"
echo "To bypass for emergency commits: git commit --no-verify"
echo "  (per Phase 108 social convention: open a canon-amendment PR within 24 hours)"
