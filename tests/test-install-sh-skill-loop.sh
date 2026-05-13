#!/usr/bin/env bash
# Phase 95.6 D-03 -- hermetic install.sh skill-loop completion fixture.
#
# Owning plan: 95.6-03 (skill-loop pre-filter + WARN-and-continue) and 95.6-05
# (register_statusline runs FIRST). RED until Plan 95.6-03 (skill-loop pre-filter)
# AND 95.6-05 (register_statusline first) land.
#
# Reproduces the Wave-2 tester's 2026-05-08/09 install failure: a skill directory with
# no SKILL.md hits `set -euo pipefail` inside install.sh's skill-loop, the script
# exits, and agents/hooks/settings.json/larry-extended/MINDRIAN_OS_ROOT/statusLine
# never get registered. After the fix, install.sh must WARN, skip the broken skill,
# and finish registration.
#
# Mirrors the shell-fixture style of tests/test-session-start-preflight.sh: a
# scratch repo placed at the path install.sh expects ($HOME/.claude/plugins/mindrian-os),
# a fake ~/.claude, and a deliberately broken skill dir injected.
#
# No new test framework. bash only. No emoji. No em-dashes.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
REPO_ROOT="$(pwd)"

fail() { echo "FAIL: $1" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FAKE_HOME="$WORK/fakehome"
INSTALL_DIR="$FAKE_HOME/.claude/plugins/mindrian-os"
mkdir -p "$FAKE_HOME/.claude"
mkdir -p "$(dirname "$INSTALL_DIR")"

# Build the scratch "installed" repo: copy install.sh + the dirs it iterates.
mkdir -p "$INSTALL_DIR"
cp "$REPO_ROOT/install.sh" "$INSTALL_DIR/install.sh"
for d in scripts commands agents; do
  if [ -d "$REPO_ROOT/$d" ]; then
    mkdir -p "$INSTALL_DIR/$d"
    # shellcheck disable=SC2086
    cp -r "$REPO_ROOT/$d/." "$INSTALL_DIR/$d/" 2>/dev/null || true
  fi
done
# Skills: copy the real ones, then inject a broken one with NO SKILL.md.
mkdir -p "$INSTALL_DIR/skills"
cp -r "$REPO_ROOT/skills/." "$INSTALL_DIR/skills/" 2>/dev/null || true
mkdir -p "$INSTALL_DIR/skills/_test-broken-skill"
echo '{"note":"this skill has no SKILL.md on purpose -- regression fixture for D-03"}' > "$INSTALL_DIR/skills/_test-broken-skill/data.json"
# Pre-populate .git so install.sh takes the "existing install" branch (skips clone).
mkdir -p "$INSTALL_DIR/.git"

# Stub `git` so the "existing install" branch's `git pull` is a no-op (the
# scratch .git is not a real repo). Keep node + coreutils on PATH (install.sh
# shells node + npm for settings.json / deps). npm install is stubbed to a no-op
# so the fixture stays offline.
SHIM_DIR="$WORK/shim-bin"
mkdir -p "$SHIM_DIR"
cat > "$SHIM_DIR/git" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$SHIM_DIR/npm" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$SHIM_DIR/git" "$SHIM_DIR/npm"
REAL_NODE_DIR="$(dirname "$(command -v node)")"

# Run install.sh against the fake home. Capture stdout+stderr separately.
OUT_LOG="$WORK/install.out"
ERR_LOG="$WORK/install.err"
set +e
HOME="$FAKE_HOME" PATH="$SHIM_DIR:$REAL_NODE_DIR:/usr/bin:/bin" bash "$INSTALL_DIR/install.sh" >"$OUT_LOG" 2>"$ERR_LOG"
RC=$?
set -e

# --- Assertions (FAIL until 95.6-03 + 95.6-05 land; RED by design) ---

[ "$RC" -eq 0 ] || fail "install.sh exited non-zero ($RC) on a repo with a SKILL.md-less skill dir; expected WARN-and-continue (D-03). stderr:\n$(cat "$ERR_LOG")"

grep -q "WARN: skipping skill" "$ERR_LOG" \
  || fail "expected a 'WARN: skipping skill _test-broken-skill: no SKILL.md' line on stderr (D-03 pre-filter). stderr:\n$(cat "$ERR_LOG")"
grep -q "_test-broken-skill" "$ERR_LOG" \
  || fail "the WARN line should name the broken skill (_test-broken-skill). stderr:\n$(cat "$ERR_LOG")"

SETTINGS="$FAKE_HOME/.claude/settings.json"
[ -f "$SETTINGS" ] || fail "install.sh did not write ~/.claude/settings.json (registration halted before it)"

node -e "
const fs = require('fs');
let s;
try { s = JSON.parse(fs.readFileSync('$SETTINGS','utf8')); } catch (e) { console.error('settings.json is not valid JSON: ' + e.message); process.exit(2); }
const problems = [];
if (s.agent !== 'larry-extended') problems.push('agent !== larry-extended (got ' + JSON.stringify(s.agent) + ')');
if (!s.env || !s.env.MINDRIAN_OS_ROOT) problems.push('env.MINDRIAN_OS_ROOT not set');
const hooksStr = JSON.stringify(s.hooks || {});
if (!hooksStr.includes('mindrian-os')) problems.push('no SessionStart hook entry mentioning mindrian-os');
if (!s.statusLine || !s.statusLine.command) problems.push('statusLine.command not set (D-09: register_statusline must run, ideally FIRST)');
if (problems.length) { console.error('settings.json incomplete: ' + problems.join('; ')); process.exit(2); }
" || fail "settings.json is incomplete after install.sh (see node error above) -- D-03 + D-09 contract"

echo "OK: install.sh skill-loop fixture passes (WARN-and-continue, full registration, statusLine present)"
