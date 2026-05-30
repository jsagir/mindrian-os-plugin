#!/usr/bin/env bash
# Phase 108-05 - install pre-commit hook for schema alias drift guard.
# Phase 128-03 - extended to also wire the Substrate Contract guard
#                (scripts/check-substrate.cjs --diff).
# Usage:
#   bash scripts/install-pre-commit.sh
# Effect:
#   Creates .git/hooks/pre-commit (or appends to it if existing) that invokes
#   node scripts/check-schema-aliases.cjs to enforce D-05 "do not invent
#   parallel schema," PLUS node scripts/check-substrate.cjs --diff to reject any
#   net-new bypass of the lib/core/navigation.cjs chokepoint (Canon Part 9).
#
# Per RESEARCH Open Question #6: contributors run this once after cloning.
# Defer auto-install via npm postinstall to a later phase if friction warrants.
#
# The tracked artifacts are scripts/check-schema-aliases.cjs +
# scripts/check-substrate.cjs + scripts/install-pre-commit.sh. The
# .git/hooks/pre-commit file itself is NOT tracked by git (per standard git
# convention). The hook is opt-in by repository convention, not a runtime
# guarantee.
#
# Bypass policy: git commit --no-verify always bypasses the hook. Per Phase
# 108 social convention, any --no-verify for schema work requires opening a
# canon-amendment PR within 24 hours. Document, do not enforce.
#
# Canon Part 8: hook is git-surface only; zero Brain queries, zero network.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_PATH="$REPO_ROOT/.git/hooks/pre-commit"

if [ -f "$HOOK_PATH" ]; then
  # Idempotency: consider the hook fully installed only when BOTH guards wired.
  if grep -q "check-schema-aliases.cjs" "$HOOK_PATH" && grep -q "check-substrate.cjs" "$HOOK_PATH"; then
    echo "Pre-commit hook already installed (schema-aliases + substrate). No changes."
    exit 0
  fi
  echo "WARNING: $HOOK_PATH exists but is missing one or more MindrianOS guards."
  echo "Appending the missing invocation(s). Review the file after this script completes."
  # Append schema-aliases guard only if absent.
  if ! grep -q "check-schema-aliases.cjs" "$HOOK_PATH"; then
    cat >> "$HOOK_PATH" <<'HOOK_TRAILER_ALIASES'

# Phase 108-05 - schema alias drift guard
node "$REPO_ROOT_PLACEHOLDER/scripts/check-schema-aliases.cjs" || exit 1
HOOK_TRAILER_ALIASES
  fi
  # Append substrate guard only if absent (Phase 128-03).
  if ! grep -q "check-substrate.cjs" "$HOOK_PATH"; then
    cat >> "$HOOK_PATH" <<'HOOK_TRAILER_SUBSTRATE'

# Phase 128-03 - Substrate Contract guard (net-new chokepoint-bypass tripwire).
# Strict superset of the retired --check-chokepoint (CONTEXT finding H1).
# Recovery: route room.db access through lib/core/navigation.cjs (Canon Part 9),
# or add the path to ALLOWED_DIRECT_IMPORT in scripts/check-substrate.cjs.
# Contract: docs/architecture/SUBSTRATE-CONTRACT.md
node "$REPO_ROOT_PLACEHOLDER/scripts/check-substrate.cjs" --diff || exit 1
HOOK_TRAILER_SUBSTRATE
  fi
  sed -i "s|\$REPO_ROOT_PLACEHOLDER|$REPO_ROOT|g" "$HOOK_PATH"
else
  cat > "$HOOK_PATH" <<HOOK_BODY
#!/usr/bin/env bash
# Auto-installed by scripts/install-pre-commit.sh (Phase 108-05 + 128-03).
# Phase 108-05 - schema alias drift guard.
# Phase 128-03 - Substrate Contract guard (lib/core/navigation.cjs is the only door).
set -euo pipefail
node "$REPO_ROOT/scripts/check-schema-aliases.cjs" || exit 1
# Phase 128-03 - reject net-new chokepoint bypass on staged files.
# Strict superset of the retired --check-chokepoint (CONTEXT finding H1).
# Recovery: route room.db access through lib/core/navigation.cjs (Canon Part 9),
# or add the path to ALLOWED_DIRECT_IMPORT in scripts/check-substrate.cjs.
# Contract: docs/architecture/SUBSTRATE-CONTRACT.md
node "$REPO_ROOT/scripts/check-substrate.cjs" --diff || exit 1
HOOK_BODY
fi

chmod +x "$HOOK_PATH"
echo "Pre-commit hook installed at $HOOK_PATH (schema-aliases + substrate guards)."
echo "To bypass for emergency commits: git commit --no-verify"
echo "  (per Phase 108 social convention: open a canon-amendment PR within 24 hours)"
