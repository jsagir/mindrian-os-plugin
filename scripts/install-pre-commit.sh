#!/usr/bin/env bash
# Phase 108-05 - install pre-commit hook for schema alias drift guard.
# Usage:
#   bash scripts/install-pre-commit.sh
# Effect:
#   Creates .git/hooks/pre-commit (or appends to it if existing) that invokes
#   node scripts/check-schema-aliases.cjs to enforce D-05 "do not invent
#   parallel schema."
#
# Per RESEARCH Open Question #6: contributors run this once after cloning.
# Defer auto-install via npm postinstall to a later phase if friction warrants.
#
# The tracked artifacts are scripts/check-schema-aliases.cjs +
# scripts/install-pre-commit.sh. The .git/hooks/pre-commit file itself is NOT
# tracked by git (per standard git convention). The hook is opt-in by
# repository convention, not a runtime guarantee.
#
# Bypass policy: git commit --no-verify always bypasses the hook. Per Phase
# 108 social convention, any --no-verify for schema work requires opening a
# canon-amendment PR within 24 hours. Document, do not enforce.
#
# Canon Part 8: hook is git-surface only; zero Brain queries.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_PATH="$REPO_ROOT/.git/hooks/pre-commit"

if [ -f "$HOOK_PATH" ]; then
  if grep -q "check-schema-aliases.cjs" "$HOOK_PATH"; then
    echo "Pre-commit hook already installed. No changes."
    exit 0
  fi
  echo "WARNING: $HOOK_PATH exists but does not invoke check-schema-aliases.cjs."
  echo "Appending invocation. Review the file after this script completes."
  cat >> "$HOOK_PATH" <<'HOOK_TRAILER'

# Phase 108-05 - schema alias drift guard
node "$REPO_ROOT_PLACEHOLDER/scripts/check-schema-aliases.cjs" || exit 1
HOOK_TRAILER
  sed -i "s|\$REPO_ROOT_PLACEHOLDER|$REPO_ROOT|g" "$HOOK_PATH"
else
  cat > "$HOOK_PATH" <<HOOK_BODY
#!/usr/bin/env bash
# Auto-installed by scripts/install-pre-commit.sh (Phase 108-05).
# Phase 108-05 - schema alias drift guard.
set -euo pipefail
node "$REPO_ROOT/scripts/check-schema-aliases.cjs" || exit 1
HOOK_BODY
fi

chmod +x "$HOOK_PATH"
echo "Pre-commit hook installed at $HOOK_PATH."
echo "To bypass for emergency commits: git commit --no-verify"
echo "  (per Phase 108 social convention: open a canon-amendment PR within 24 hours)"
