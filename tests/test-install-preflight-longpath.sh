#!/usr/bin/env bash
# Phase 95.6 D-01 -- hermetic Windows long-path preflight fixture.
#
# Owning plan: 95.6-04 (install.sh Windows long-path preflight + OS detection).
# RED until Plan 95.6-04 (Windows long-path preflight + OS detection) lands.
#
# Reproduces Gary Laben's 2026-05-08 git-clone failure: on Windows + Git Bash,
# `git clone` of a repo with a 189-char phase-dir leaf fails with a MAX_PATH
# error unless `git config --global core.longpaths true` ran first. install.sh
# must (a) detect Windows, (b) set core.longpaths before the clone, (c) surface
# a banner explaining the global git-config change, and (d) on Windows without
# Git for Windows, exit non-zero with a named error.
#
# OS detection is injected via MOS_TEST_FORCE_OS (the override 95.6-04 will add:
# `windows` or `linux`). A fake `git` is placed early on PATH so the test can
# observe what install.sh asks it to do without touching the real global config.
#
# Mirrors the shell-fixture style of tests/test-session-start-preflight.sh.
# bash only. No emoji. No em-dashes.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
REPO_ROOT="$(pwd)"

fail() { echo "FAIL: $1" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FAKE_HOME="$WORK/fakehome"
INSTALL_DIR="$FAKE_HOME/.claude/plugins/mindrian-os"
mkdir -p "$FAKE_HOME/.claude"
mkdir -p "$INSTALL_DIR/.git"   # existing-install branch -> install.sh skips the real clone
cp "$REPO_ROOT/install.sh" "$INSTALL_DIR/install.sh"
for d in scripts commands agents skills; do
  if [ -d "$REPO_ROOT/$d" ]; then
    mkdir -p "$INSTALL_DIR/$d"
    cp -r "$REPO_ROOT/$d/." "$INSTALL_DIR/$d/" 2>/dev/null || true
  fi
done

# --- Fake git: logs every invocation to git-calls.log, exits 0. Also a real-ish
#     `node` is needed (install.sh shells node for settings.json) -- leave node on PATH. ---
GIT_CALLS="$WORK/git-calls.log"
: > "$GIT_CALLS"
SHIM_DIR="$WORK/shim-bin"
mkdir -p "$SHIM_DIR"
cat > "$SHIM_DIR/git" <<EOF
#!/usr/bin/env bash
echo "\$@" >> "$GIT_CALLS"
# Mimic just enough of git for install.sh's existing-install branch.
case "\$1" in
  pull) exit 0 ;;
  config) exit 0 ;;
  clone) exit 0 ;;
  *) exit 0 ;;
esac
EOF
chmod +x "$SHIM_DIR/git"

REAL_NODE_DIR="$(dirname "$(command -v node)")"

run_install() {
  # $1 = MOS_TEST_FORCE_OS value; $2 = include_git (yes|no)
  local force_os="$1" include_git="$2"
  local out="$WORK/install.$force_os.$include_git.log"
  local path_val
  if [ "$include_git" = "yes" ]; then
    path_val="$SHIM_DIR:$REAL_NODE_DIR:/usr/bin:/bin"
  else
    # Drop git from PATH entirely; keep node + coreutils.
    path_val="$REAL_NODE_DIR:/usr/bin:/bin"
    # Guard: if a git still resolves on /usr/bin, skip the no-git assertion.
    if PATH="$path_val" command -v git >/dev/null 2>&1; then
      echo "__GIT_STILL_ON_PATH__" > "$out"
      echo "$out"
      return 0
    fi
  fi
  set +e
  HOME="$FAKE_HOME" MOS_TEST_FORCE_OS="$force_os" PATH="$path_val" bash "$INSTALL_DIR/install.sh" >"$out" 2>&1
  echo "RC=$?" >> "$out"
  set -e
  echo "$out"
}

# --- Case 1: forced Windows + fake git -> core.longpaths is set + banner emitted ---
: > "$GIT_CALLS"
OUT1="$(run_install windows yes)"
grep -q "config --global core.longpaths true" "$GIT_CALLS" \
  || fail "forced-Windows install.sh did not call 'git config --global core.longpaths true' before cloning (D-01 preflight). git calls:\n$(cat "$GIT_CALLS")"
grep -q "core.longpaths" "$OUT1" \
  || fail "forced-Windows install.sh did not emit a banner mentioning core.longpaths (D-01 banner). output:\n$(cat "$OUT1")"

# --- Case 2: forced Linux + fake git -> core.longpaths is NOT set ---
: > "$GIT_CALLS"
OUT2="$(run_install linux yes)"
if grep -q "config --global core.longpaths true" "$GIT_CALLS"; then
  fail "forced-Linux install.sh wrongly set core.longpaths (should be Windows-only). git calls:\n$(cat "$GIT_CALLS")"
fi

# --- Case 3: forced Windows, NO git on PATH -> non-zero exit + named "Git for Windows" error ---
OUT3="$(run_install windows no)"
if grep -q "__GIT_STILL_ON_PATH__" "$OUT3"; then
  echo "SKIP: could not remove git from PATH in this environment -- skipping the no-Git-for-Windows assertion."
else
  grep -q "RC=0" "$OUT3" && fail "forced-Windows install.sh with no git exited 0; expected non-zero. output:\n$(cat "$OUT3")"
  grep -qi "Git for Windows" "$OUT3" \
    || fail "forced-Windows install.sh with no git did not name 'Git for Windows' in its error. output:\n$(cat "$OUT3")"
fi

echo "OK: Windows long-path preflight fixture passes (longpaths set on Windows, not on Linux, named error when Git for Windows absent)"
