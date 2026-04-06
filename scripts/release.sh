#!/usr/bin/env bash
# MindrianOS Release Script -- eliminates manual release errors
# Usage: bash scripts/release.sh [patch|minor|major]
#
# What it does:
#   1. Validates plugin (zero errors or ABORT)
#   2. Bumps version in plugin.json
#   3. Syncs version to marketplace.json
#   4. Validates marketplace (zero errors or ABORT)
#   5. Commits both repos
#   6. Pushes both repos
#   7. Updates local marketplace cache
#   8. Runs post-release verification
#
# This script is the ONLY way to release. No manual pushes.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MARKETPLACE_DIR="$HOME/mindrian-marketplace"

# --- Step 0: Parse bump type ---
BUMP="${1:-patch}"
if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo -e "${RED}Usage: bash scripts/release.sh [patch|minor|major]${NC}"
  exit 1
fi

# --- Step 1: Get current version ---
CURRENT=$(node -e "console.log(require('$PLUGIN_DIR/.claude-plugin/plugin.json').version)")
echo -e "${YELLOW}Current version: $CURRENT${NC}"

# Bump version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac
NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# --- Step 2: Run FULL verification (not just validation) ---
echo ""
echo "=== Running pre-release verification ==="
if ! bash "$PLUGIN_DIR/scripts/verify-release" 2>&1; then
  echo -e "${RED}ABORT: Pre-release verification failed. Fix all failures first.${NC}"
  exit 1
fi
echo -e "${GREEN}All verification checks passed${NC}"

# --- Step 3: Bump plugin.json ---
cd "$PLUGIN_DIR"
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('.claude-plugin/plugin.json', 'utf8'));
p.version = '$NEW_VERSION';
fs.writeFileSync('.claude-plugin/plugin.json', JSON.stringify(p, null, 2) + '\n');
"
echo "Updated plugin.json to $NEW_VERSION"

# --- Step 4: Bump marketplace.json ---
cd "$MARKETPLACE_DIR"
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8'));
m.plugins[0].version = '$NEW_VERSION';
fs.writeFileSync('.claude-plugin/marketplace.json', JSON.stringify(m, null, 2) + '\n');
"
echo "Updated marketplace.json to $NEW_VERSION"

# --- Step 5: Validate marketplace ---
echo ""
echo "=== Validating marketplace ==="
MVAL=$(claude plugin validate "$MARKETPLACE_DIR" 2>&1)
if echo "$MVAL" | grep -q "Validation failed"; then
  echo -e "${RED}ABORT: Marketplace validation failed:${NC}"
  echo "$MVAL"
  # Revert version bumps
  cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json
  cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json
  exit 1
fi
echo -e "${GREEN}Marketplace validation passed${NC}"

# --- Step 6: Check for CHANGELOG entry ---
cd "$PLUGIN_DIR"
if ! grep -q "\[$NEW_VERSION\]" CHANGELOG.md 2>/dev/null; then
  echo -e "${YELLOW}WARNING: No CHANGELOG entry for $NEW_VERSION${NC}"
  echo "Add one now? (y/n)"
  read -r REPLY
  if [[ "$REPLY" == "y" ]]; then
    DATE=$(date +%Y-%m-%d)
    # Prepend entry
    TEMP=$(mktemp)
    echo "## [$NEW_VERSION] - $DATE" > "$TEMP"
    echo "" >> "$TEMP"
    echo "### Changed" >> "$TEMP"
    echo "- " >> "$TEMP"
    echo "" >> "$TEMP"
    cat CHANGELOG.md >> "$TEMP"
    mv "$TEMP" CHANGELOG.md
    ${EDITOR:-nano} CHANGELOG.md
  fi
fi

# --- Step 6.5: Post-bump re-verification ---
echo ""
echo "=== Re-verifying after version bump ==="
REVAL=$(bash "$PLUGIN_DIR/scripts/verify-release" 2>&1 || true)
if echo "$REVAL" | grep -q "DO NOT RELEASE"; then
  echo -e "${RED}ABORT: Post-bump verification failed. Rolling back version bumps.${NC}"
  cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json
  cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json
  exit 1
fi
echo -e "${GREEN}Post-bump verification passed${NC}"

# --- Step 7: Commit plugin (specific files only - NEVER git add -A) ---
echo ""
echo "=== Committing plugin ==="
cd "$PLUGIN_DIR"
git add .claude-plugin/plugin.json CHANGELOG.md
# Add any other modified tracked files (but NOT untracked files)
git diff --name-only | xargs -r git add
git commit -m "release: v$NEW_VERSION" || echo "Nothing to commit in plugin"
git tag "v$NEW_VERSION" 2>/dev/null || echo "Tag v$NEW_VERSION already exists"

# --- Step 8: Commit marketplace (specific files only) ---
echo ""
echo "=== Committing marketplace ==="
cd "$MARKETPLACE_DIR"
git add .claude-plugin/marketplace.json README.md
git commit -m "release: sync to v$NEW_VERSION" || echo "Nothing to commit in marketplace"

# --- Step 9: Push both ---
echo ""
echo "=== Pushing ==="
cd "$PLUGIN_DIR" && git push origin main --tags 2>&1
cd "$MARKETPLACE_DIR" && git push origin master 2>&1

# --- Step 10: Update local cache ---
echo ""
echo "=== Updating local marketplace cache ==="
claude plugin marketplace update mindrian-marketplace 2>&1

# --- Step 11: Post-release verification ---
echo ""
echo "=== Post-release verification ==="

# Check remote HEAD matches local
REMOTE_HEAD=$(git ls-remote https://github.com/jsagir/mindrian-os-plugin.git HEAD | cut -f1)
LOCAL_HEAD=$(cd "$PLUGIN_DIR" && git rev-parse HEAD)
if [ "$REMOTE_HEAD" = "$LOCAL_HEAD" ]; then
  echo -e "${GREEN}Plugin remote HEAD matches local${NC}"
else
  echo -e "${RED}WARNING: Plugin remote HEAD mismatch!${NC}"
fi

# Check cached marketplace version
CACHED_VER=$(node -e "
const fs = require('fs');
const files = require('child_process').execSync('find ~/.claude -path \"*mindrian-marketplace*marketplace.json\" 2>/dev/null', {encoding:'utf8'}).trim().split('\n');
if (files[0]) { const m = JSON.parse(fs.readFileSync(files[0],'utf8')); console.log(m.plugins[0].version); }
" 2>/dev/null || echo "?")

if [ "$CACHED_VER" = "$NEW_VERSION" ]; then
  echo -e "${GREEN}Marketplace cache: v$CACHED_VER (correct)${NC}"
else
  echo -e "${RED}WARNING: Marketplace cache shows v$CACHED_VER, expected v$NEW_VERSION${NC}"
fi

# Final validation
cd "$PLUGIN_DIR"
claude plugin validate . 2>&1 | tail -1

echo ""
echo -e "${GREEN}=== Release v$NEW_VERSION complete ===${NC}"
echo ""
echo "Users can update with: claude plugin update mos"
echo "New users install with: claude plugin marketplace add jsagir/mindrian-marketplace && claude plugin install mos@mindrian-marketplace"
