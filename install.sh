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
  echo "  . Cloning MindrianOS..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --quiet "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Step 3: Install npm dependencies
echo "  . Installing dependencies..."
npm install --quiet --no-audit --no-fund 2>/dev/null

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

# Step 5: Register skills
echo "  . Registering skills..."
SKILLS_DIR="${CLAUDE_DIR}/skills"
mkdir -p "$SKILLS_DIR"

for skill_dir in "$INSTALL_DIR"/skills/*/; do
  skill_name=$(basename "$skill_dir")
  mkdir -p "$SKILLS_DIR/$skill_name"
  ln -sf "$skill_dir/SKILL.md" "$SKILLS_DIR/$skill_name/SKILL.md" 2>/dev/null || cp "$skill_dir/SKILL.md" "$SKILLS_DIR/$skill_name/SKILL.md"
done

SKILL_COUNT=$(ls -d "$INSTALL_DIR"/skills/*/ | wc -l)
echo "    $SKILL_COUNT skills registered"

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

# Step 7: Configure hooks
echo "  . Configuring hooks..."
SETTINGS_FILE="${CLAUDE_DIR}/settings.json"

# Create settings.json if it doesn't exist
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
