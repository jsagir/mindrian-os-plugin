#!/usr/bin/env bash
# MindrianOS Universal Installer
# Works with or without the Claude Code plugin marketplace.
#
# Usage:
#   curl -sL https://raw.githubusercontent.com/jsagir/mindrian-os-plugin/main/install.sh | bash
#   -- OR --
#   git clone https://github.com/jsagir/mindrian-os-plugin.git && cd mindrian-os-plugin && bash install.sh

set -euo pipefail

REPO="https://github.com/jsagir/mindrian-os-plugin.git"
INSTALL_DIR="${HOME}/.claude/plugins/mindrian-os"
CLAUDE_DIR="${HOME}/.claude"
# Phase 95.6 D-09: hoisted up from old Step 7 so register_statusline() (which
# runs FIRST, before any cp/ln loop) can write the canonical statusLine block.
SETTINGS_FILE="${CLAUDE_DIR}/settings.json"
# Phase 95.6 D-09 / R-01: the install receipt. install.sh appends one
# {name,exit} entry per step and stamps completed_at at the very end; a halted
# install leaves a partial receipt on disk -- which is what /mos:doctor class H
# reads to tell you what is missing. The receipt lives INSIDE $INSTALL_DIR, so
# it can only be written once the clone (Step 2) has run.
RECEIPT_FILE="${INSTALL_DIR}/.install-receipt.json"

# Phase 95.6 D-01: OS detection (testable via MOS_TEST_FORCE_OS).
# `windows`/`Windows`/`WINDOWS` force Windows; MINGW*/MSYS*/CYGWIN* are what
# `uname -s` reports under Git Bash / MSYS2 / Cygwin on Windows; anything else
# (Linux, Darwin, `linux`, `mac`, ...) is treated as non-Windows.
case "${MOS_TEST_FORCE_OS:-$(uname -s 2>/dev/null)}" in
  windows|Windows|WINDOWS|MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=1 ;;
  *) IS_WINDOWS=0 ;;
esac

# Phase 95.6 D-01: on Windows + Git Bash, this repo contains paths that can
# exceed the Windows MAX_PATH limit (260 chars). git refuses to create them
# unless core.longpaths is enabled. We set it globally (the only scope that
# affects a fresh clone) and tell the user exactly what changed. On non-Windows
# this is a no-op pass-through -- no global git config is touched.
enable_longpaths_on_windows() {
  [ "$IS_WINDOWS" = "1" ] || return 0
  if ! command -v git >/dev/null 2>&1; then
    echo "  x You appear to be on Windows but 'git' is not on PATH." >&2
    echo "    Install Git for Windows (it includes Git Bash): https://git-scm.com/download/win" >&2
    echo "    Then re-run this installer from the Git Bash prompt." >&2
    exit 1
  fi
  echo ""
  echo "  Windows detected. Enabling git long-path support..."
  echo "  -> running: git config --global core.longpaths true"
  echo "     (this changes your global git config so the clone can create"
  echo "      deeply-nested directories; it is the standard fix for the"
  echo "      Windows 260-character path limit and is safe to leave on)"
  git config --global core.longpaths true
  echo "  . Long-path support enabled"
  echo ""
}

# Phase 95.6 D-09: write the MindrianOS statusLine block into the user's
# ~/.claude/settings.json. Runs FIRST in install order (right after the
# node+git preflight and the clone), BEFORE any cp/ln loop, so it survives
# even if a later step fails -- the "silent install-incomplete" fix. The
# block shape matches what scripts/doctor.cjs class G/H expects: a
# `bash "<install-dir>/scripts/statusline-mos"` command. Idempotent: a
# second run does not duplicate or corrupt the block.
register_statusline() {
  echo "  . Registering statusline..."
  mkdir -p "$CLAUDE_DIR" 2>/dev/null || true
  if [ ! -f "$SETTINGS_FILE" ]; then echo '{}' > "$SETTINGS_FILE"; fi
  node -e "
const fs = require('fs');
const p = '$SETTINGS_FILE';
let s = {};
try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {}
if (!s || typeof s !== 'object') s = {};
const want = { type: 'command', command: 'bash \"$INSTALL_DIR/scripts/statusline-mos\"' };
const cur = s.statusLine;
if (!cur || typeof cur !== 'object' || cur.command !== want.command) {
  s.statusLine = want;
  fs.writeFileSync(p, JSON.stringify(s, null, 2));
  console.log('    statusLine block written');
} else {
  console.log('    statusLine block already present');
}
"
}

# Phase 95.6 D-09 / R-01: incremental install-receipt helpers. Every call is
# best-effort (2>/dev/null || true) -- a receipt write must NEVER abort the
# install (the receipt is diagnostic, not load-bearing).
PLUGIN_VERSION="unknown"
receipt_refresh_version() {
  PLUGIN_VERSION=$(node -e "try{process.stdout.write(require('$INSTALL_DIR/.claude-plugin/plugin.json').version||'unknown')}catch(e){process.stdout.write('unknown')}" 2>/dev/null || echo unknown)
}
receipt_init() {
  receipt_refresh_version
  mkdir -p "$INSTALL_DIR" 2>/dev/null || true
  node -e "require('fs').writeFileSync('$RECEIPT_FILE', JSON.stringify({version:'$PLUGIN_VERSION',completed_at:null,steps:[]},null,2))" 2>/dev/null || true
}
receipt_step() {  # $1 = step name, $2 = exit code
  node -e "
const fs=require('fs'); const p='$RECEIPT_FILE';
let r={version:'$PLUGIN_VERSION',completed_at:null,steps:[]};
try{r=JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){}
if(!r||typeof r!=='object'){r={version:'$PLUGIN_VERSION',completed_at:null,steps:[]}}
if(!Array.isArray(r.steps)){r.steps=[]}
r.steps.push({name:'$1',exit:Number('$2')||0});
fs.writeFileSync(p,JSON.stringify(r,null,2));
" 2>/dev/null || true
}
receipt_done() {
  node -e "
const fs=require('fs'); const p='$RECEIPT_FILE';
let r={version:'$PLUGIN_VERSION',completed_at:null,steps:[]};
try{r=JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){}
if(!r||typeof r!=='object'){r={version:'$PLUGIN_VERSION',completed_at:null,steps:[]}}
r.completed_at=new Date().toISOString();
fs.writeFileSync(p,JSON.stringify(r,null,2));
" 2>/dev/null || true
}

echo ""
echo "  ╭────────────────────────────────────────────╮"
echo "  │                                            │"
echo "  │   MindrianOS Installer                     │"
echo "  │   Your AI innovation co-founder            │"
echo "  │                                            │"
echo "  ╰────────────────────────────────────────────╯"
echo ""

# Step 1: Check prerequisites
echo "  Checking prerequisites..."

# Phase 95.6 D-01: run the Windows long-path preflight FIRST. On Windows with no
# git on PATH it exits here with the Windows-specific "Git for Windows" message;
# on Windows with git it sets core.longpaths globally and returns; on non-Windows
# it returns immediately and the generic checks below run exactly as before.
enable_longpaths_on_windows

if ! command -v git &>/dev/null; then
  echo "  x Git not found. Install git first: https://git-scm.com"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "  x Node.js not found. Install Node 18+: https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "  x Node.js $NODE_VERSION detected. MindrianOS needs Node 18+."
  exit 1
fi

echo "  . Git found"
echo "  . Node.js $(node -v) found"

# Step 2: Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  . Existing install found -- updating..."
  cd "$INSTALL_DIR"
  git pull --quiet origin main
else
  if [ -d "$INSTALL_DIR" ]; then
    # Phase 95.6 D-01: a directory exists but has no .git -- almost certainly a
    # partial clone left behind by a prior failed attempt (e.g. a MAX_PATH error
    # mid-clone). Remove it so the retry is clean and does not re-trigger the
    # same "Filename too long" failure on the second run.
    echo "  . Found a partial/incomplete install at $INSTALL_DIR -- removing it before re-cloning"
    rm -rf "$INSTALL_DIR"
  fi
  echo "  . Cloning MindrianOS..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --quiet "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Phase 95.6 D-09 / R-01: now that $INSTALL_DIR exists, start the install
# receipt and backfill the steps that already completed (the node+git
# preflight and the clone). Every receipt call is best-effort.
receipt_init
receipt_step preflight 0
receipt_step clone 0

# Step 3: Install npm dependencies
echo "  . Installing dependencies..."
npm install --quiet --no-audit --no-fund 2>/dev/null

# Step 3b (Phase 94-04): bundled mcp-server-brain dependencies.
# Optional/legacy path. Users on the canonical 'mindrian-brain' MCP via
# their own Neo4j MCP do NOT need this. See docs/install/BRAIN-SETUP.md
# for the recommended v1.11.2 wiring.
# Tier 0 graceful: when the directory or package.json is absent (advanced
# user removed it, or a stripped-down install) the hook silently skips
# instead of erroring per Canon Decision 8.
#
# NOTE (Phase 123 Plan-07, SEC-02): install.sh does NOT write ~/.mindrian.env.
# The Brain API key is written by /mos:setup brain (commands/setup.md), which
# chmods it 0600 after the write. If a future install.sh code path ever writes
# the file, it MUST add `chmod 600 "$HOME/.mindrian.env" 2>/dev/null || true`
# immediately after the write -- otherwise lib/core/resolve-brain-key.cjs's
# SEC-02 POSIX permission gate will refuse to load the key on POSIX systems.
if [ -d "mcp-server-brain" ] && [ -f "mcp-server-brain/package.json" ]; then
  echo "  . Installing bundled mcp-server-brain dependencies (optional)..."
  if (cd mcp-server-brain && npm install --quiet --no-audit --no-fund 2>/dev/null); then
    echo "    bundled Brain server deps ready"
  else
    echo "    WARN: mcp-server-brain npm install failed (non-fatal)."
    echo "          See docs/install/BRAIN-SETUP.md for the canonical-name path."
  fi
fi

# Phase 95.6 D-09: register the statusLine block FIRST -- before any cp/ln
# loop -- so a failure in a later registration step can never again leave the
# statusline unstamped (the Gary Laben 2026-05-08 + Jonathan "other machine"
# symptom). This must run after the clone (so $INSTALL_DIR exists) and after
# 95.6-04's Windows long-path preflight, but before Step 4.
register_statusline
receipt_step register_statusline 0

# Step 4: Create symlinks for commands
echo "  . Registering commands..."
COMMANDS_DIR="${CLAUDE_DIR}/commands"
mkdir -p "$COMMANDS_DIR"

# Create mos/ directory for namespaced commands
MOS_DIR="${COMMANDS_DIR}/mos"
mkdir -p "$MOS_DIR"

for cmd in "$INSTALL_DIR"/commands/*.md; do
  name=$(basename "$cmd" .md)
  ln -sf "$cmd" "$MOS_DIR/$name.md" 2>/dev/null || cp "$cmd" "$MOS_DIR/$name.md"
done

CMD_COUNT=$(ls "$INSTALL_DIR"/commands/*.md | wc -l)
echo "    $CMD_COUNT commands registered as /mos:*"
receipt_step register_commands 0

# Step 5: Register skills
echo "  . Registering skills..."
SKILLS_DIR="${CLAUDE_DIR}/skills"
mkdir -p "$SKILLS_DIR"

SKILL_REGISTERED=0
SKILL_SKIPPED=0
for skill_dir in "$INSTALL_DIR"/skills/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name=$(basename "$skill_dir")
  # D-03 (Phase 95.6): pre-filter -- a skill dir without SKILL.md is
  # structurally incomplete. Skills are non-critical for first-load
  # (commands + agents are the load-bearing surface), so WARN and
  # continue rather than aborting under strict mode (the -e -u -o
  # pipefail flags set at the top). This is the bug that broke Gary
  # Laben's install 2026-05-08/09.
  if [ ! -f "$skill_dir/SKILL.md" ]; then
    echo "    WARN: skipping skill $skill_name: no SKILL.md" >&2
    SKILL_SKIPPED=$((SKILL_SKIPPED + 1))
    continue
  fi
  mkdir -p "$SKILLS_DIR/$skill_name"
  if ln -sf "$skill_dir/SKILL.md" "$SKILLS_DIR/$skill_name/SKILL.md" 2>/dev/null \
     || cp "$skill_dir/SKILL.md" "$SKILLS_DIR/$skill_name/SKILL.md" 2>/dev/null; then
    SKILL_REGISTERED=$((SKILL_REGISTERED + 1))
  else
    echo "    WARN: skipping skill $skill_name: could not link or copy SKILL.md" >&2
    SKILL_SKIPPED=$((SKILL_SKIPPED + 1))
  fi
done

SKILL_COUNT="$SKILL_REGISTERED"
if [ "$SKILL_SKIPPED" -gt 0 ]; then
  echo "    $SKILL_REGISTERED skills registered ($SKILL_SKIPPED skipped -- see WARN above)"
else
  echo "    $SKILL_REGISTERED skills registered"
fi
receipt_step register_skills 0

# Step 6: Register agents
echo "  . Registering agents..."
AGENTS_DIR="${CLAUDE_DIR}/agents"
mkdir -p "$AGENTS_DIR"

for agent in "$INSTALL_DIR"/agents/*.md; do
  name=$(basename "$agent")
  ln -sf "$agent" "$AGENTS_DIR/$name" 2>/dev/null || cp "$agent" "$AGENTS_DIR/$name"
done

AGENT_COUNT=$(ls "$INSTALL_DIR"/agents/*.md | wc -l)
echo "    $AGENT_COUNT agents registered"
receipt_step register_agents 0

# Step 7: Configure hooks
# Note: this node block writes .agent, .hooks.SessionStart and
# .env.MINDRIAN_OS_ROOT. It never wrote a .statusLine block -- that is
# register_statusline()'s job and it already ran above (Phase 95.6 D-09).
echo "  . Configuring hooks..."

# Create settings.json if it doesn't exist (register_statusline already did
# this when it ran first, but stay defensive in case settings.json was removed
# between the two steps).
if [ ! -f "$SETTINGS_FILE" ]; then
  echo '{}' > "$SETTINGS_FILE"
fi

# Add MindrianOS hooks using node
node -e "
const fs = require('fs');
const path = '$SETTINGS_FILE';
let settings = {};
try { settings = JSON.parse(fs.readFileSync(path, 'utf8')); } catch(e) {}

// Set default agent to Larry
if (!settings.agent) settings.agent = 'larry-extended';

// Ensure hooks array exists
if (!settings.hooks) settings.hooks = {};

// Add SessionStart hook if not present
const hookMarker = 'mindrian-os';
const hasHook = JSON.stringify(settings.hooks).includes(hookMarker);

if (!hasHook) {
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
  settings.hooks.SessionStart.push({
    matcher: 'startup|clear|compact',
    hooks: [{
      type: 'command',
      command: 'bash \"$INSTALL_DIR/scripts/session-start\"',
      async: false,
      statusMessage: 'Loading room context...',
      _source: hookMarker
    }]
  });
}

// Set environment variable for scripts to find the install
if (!settings.env) settings.env = {};
settings.env.MINDRIAN_OS_ROOT = '$INSTALL_DIR';

fs.writeFileSync(path, JSON.stringify(settings, null, 2));
console.log('    Hooks configured');
"
receipt_step configure_hooks 0

# Step 8: Summary
echo ""
echo "  ╭────────────────────────────────────────────╮"
echo "  │                                            │"
echo "  │   MindrianOS installed!                    │"
echo "  │                                            │"
echo "  │   $CMD_COUNT commands  |  $SKILL_COUNT skills  |  $AGENT_COUNT agents      │"
echo "  │                                            │"
echo "  │   Restart Claude Code to activate.         │"
echo "  │   Then just start talking to Larry.        │"
echo "  │                                            │"
echo "  │   /mos:help     -- see all commands        │"
echo "  │   /mos:status   -- check your room         │"
echo "  │                                            │"
echo "  ╰────────────────────────────────────────────╯"
echo ""
echo "  Install location: $INSTALL_DIR"
echo ""

# Phase 95.6 D-09 / R-01: stamp the receipt complete. A halted install never
# reaches this line, so the receipt on disk stays {completed_at:null} with a
# partial steps[] list -- which is what /mos:doctor class H reads.
receipt_done
