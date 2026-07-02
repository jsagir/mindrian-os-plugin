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
  # Idempotency: consider the hook fully installed only when ALL guards wired
  # (schema-aliases + substrate + the Phase 167 harness-manifest drift guard +
  # the Phase 172-13 coverage gates: connector --check + projection --check).
  if grep -q "check-schema-aliases.cjs" "$HOOK_PATH" && grep -q "check-substrate.cjs" "$HOOK_PATH" && grep -q "build-harness-manifest.cjs --check" "$HOOK_PATH" && grep -q "build-connector-registry.cjs --check" "$HOOK_PATH" && grep -q "build-orchestration-projection.cjs --check" "$HOOK_PATH" && grep -q "check-render-coverage.cjs --check" "$HOOK_PATH" && grep -q "build-corpus-stats.cjs --check" "$HOOK_PATH" && grep -q "check-shape-declaration.cjs --check" "$HOOK_PATH"; then
    echo "Pre-commit hook already installed (schema-aliases + substrate + harness-manifest + coverage gates + corpus-stats + shape-declaration). No changes."
    exit 0
  fi
  echo "WARNING: $HOOK_PATH exists but is missing one or more MindrianOS guards."
  echo "Wiring the missing invocation(s). Review the file after this script completes."
  # Build the missing-guard snippet in a temp file, then splice it into the hook.
  # CRITICAL: if the existing hook (e.g. one written by scripts/setup-hooks.sh)
  # ends in a terminal `exit 0`, a blind `cat >>` would land the guards AFTER
  # that exit and they would NEVER run. We therefore splice the snippet in
  # BEFORE the LAST `exit 0` line when one exists, and only fall back to append
  # when the hook has no terminal `exit 0`.
  GUARD_SNIPPET="$(mktemp)"
  if ! grep -q "check-schema-aliases.cjs" "$HOOK_PATH"; then
    cat >> "$GUARD_SNIPPET" <<'HOOK_TRAILER_ALIASES'

# Phase 108-05 - schema alias drift guard
node "$REPO_ROOT_PLACEHOLDER/scripts/check-schema-aliases.cjs" || exit 1
HOOK_TRAILER_ALIASES
  fi
  if ! grep -q "check-substrate.cjs" "$HOOK_PATH"; then
    cat >> "$GUARD_SNIPPET" <<'HOOK_TRAILER_SUBSTRATE'

# Phase 128-03 - Substrate Contract guard (net-new chokepoint-bypass tripwire).
# Strict superset of the retired --check-chokepoint (CONTEXT finding H1).
# Recovery: route room.db access through lib/core/navigation.cjs (Canon Part 9),
# or add the path to ALLOWED_DIRECT_IMPORT in scripts/check-substrate.cjs.
# Contract: docs/architecture/SUBSTRATE-CONTRACT.md
node "$REPO_ROOT_PLACEHOLDER/scripts/check-substrate.cjs" --diff || exit 1
HOOK_TRAILER_SUBSTRATE
  fi
  if ! grep -q "build-harness-manifest.cjs --check" "$HOOK_PATH"; then
    cat >> "$GUARD_SNIPPET" <<'HOOK_TRAILER_MANIFEST'

# Phase 167 (D-167-03) - harness-manifest drift guard.
# When the manifest, its generator, OR any of the three named source maps
# (command-registry / connector-registry / brain-orchestration-projection) is
# staged, regenerate the manifest in memory and reject the commit on drift
# (STALE / UNRESOLVED / MALFORMED). A change to any source map can stale the
# manifest digests, so the trigger is path-scoped on all five paths. STRONGER
# than the connector/projection precedent (whose --checks run only in test
# aggregators): the manifest --check is wired into BOTH pre-commit and
# tests/run-all-167.sh. Canon Part 8: the check is a local byte-compare +
# map-resolve; it never touches the Brain.
# Recovery on drift: node scripts/build-harness-manifest.cjs
if git diff --cached --name-only | grep -qE '^(scripts/build-harness-manifest\.cjs|data/harness-manifest\.json|data/command-registry\.json|data/connector-registry\.json|data/brain-orchestration-projection\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT_PLACEHOLDER/scripts/build-harness-manifest.cjs" ]; then
    node "$REPO_ROOT_PLACEHOLDER/scripts/build-harness-manifest.cjs" --check || { echo "harness-manifest drift -- run: node scripts/build-harness-manifest.cjs" >&2; exit 1; }
  fi
fi
HOOK_TRAILER_MANIFEST
  fi
  if ! grep -q "build-connector-registry.cjs --check" "$HOOK_PATH"; then
    cat >> "$GUARD_SNIPPET" <<'HOOK_TRAILER_CONNECTOR'

# Phase 172-13 (Canon Part 11 R2/R9) - connector coverage gate (born-wired
# HARD-FAIL). When any commands/*.md, skills/*/SKILL.md, agents/*.md, or the
# connector/coverage-ledger/framework-names JSONs are staged, regenerate the
# connector registry in memory and reject the commit on STALE, any CONN-03
# validation failure, OR any GAP surface (neither WIRED nor EXCLUDED). A
# born-dark surface can no longer reach merge. Canon Part 8: zero Brain calls.
# Recovery on drift: node scripts/build-connector-registry.cjs
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|skills/.*/SKILL\.md|agents/.*\.md|data/connector-registry\.json|data/connector-coverage-ledger\.json|data/framework-names\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT_PLACEHOLDER/scripts/build-connector-registry.cjs" ]; then
    node "$REPO_ROOT_PLACEHOLDER/scripts/build-connector-registry.cjs" --check || { echo "connector-registry drift / dark surface -- run: node scripts/build-connector-registry.cjs" >&2; exit 1; }
  fi
fi
HOOK_TRAILER_CONNECTOR
  fi
  if ! grep -q "build-orchestration-projection.cjs --check" "$HOOK_PATH"; then
    cat >> "$GUARD_SNIPPET" <<'HOOK_TRAILER_PROJECTION'

# Phase 172-13 (Canon Part 11 R2/R9) - orchestration-projection coverage gate
# (born-wired HARD-FAIL). When any commands/*.md, skills/*/SKILL.md, agents/*.md,
# or the projection/ledger/registry JSONs are staged, regenerate the projection
# in memory and reject the commit on STALE / UN-WIRED / UN-RANKED OR any
# command_gap (a bare command counterpart neither ranked nor excluded). Canon
# Part 8: zero Brain calls.
# Recovery on drift: node scripts/build-orchestration-projection.cjs
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|skills/.*/SKILL\.md|agents/.*\.md|data/connector-registry\.json|data/connector-coverage-ledger\.json|data/command-registry\.json|data/cross-domain-analogues\.json|data/orchestration-unwired-allowlist\.json|data/brain-orchestration-projection\.json|data/orchestration-command-ledger\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT_PLACEHOLDER/scripts/build-orchestration-projection.cjs" ]; then
    node "$REPO_ROOT_PLACEHOLDER/scripts/build-orchestration-projection.cjs" --check || { echo "orchestration-projection drift / command gap -- run: node scripts/build-orchestration-projection.cjs" >&2; exit 1; }
  fi
fi
HOOK_TRAILER_PROJECTION
  fi
  if ! grep -q "check-render-coverage.cjs --check" "$HOOK_PATH"; then
    cat >> "$GUARD_SNIPPET" <<'HOOK_TRAILER_RENDER'

# Phase 178-03 (Canon Part 11 render twin, C-3) - render-coverage gate (born-wired
# HARD-FAIL). The render-plane twin of the connector/projection gates above: when
# any render entry point (lib/hmi/*, lib/agents/*, lib/render/*, lib/core render
# surfaces) or the render registry is staged, run the deterministic card-emission
# predicate and reject the commit on STALE OR any render GAP (a reachable
# Decision-Gate surface not routed through the SEED-020 card-emission door). A
# WARN-only render gate is the SKILL fence with extra steps (R-5) and rots like
# 143.x/144.1 did before the CIRS R9 flip; this is HARD-FAIL (exit 1), never WARN.
# Canon Part 8: zero Brain calls (a local byte-compare + source scan).
# Recovery on drift / dark surface: node scripts/build-render-coverage.cjs
if git diff --cached --name-only | grep -qE '^(lib/hmi/.*\.cjs|lib/agents/.*\.cjs|lib/render/.*\.cjs|lib/core/.*\.cjs|scripts/intent-classifier\.cjs|data/render-coverage-registry\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT_PLACEHOLDER/scripts/check-render-coverage.cjs" ]; then
    node "$REPO_ROOT_PLACEHOLDER/scripts/check-render-coverage.cjs" --check || { echo "render-coverage drift / dark surface -- run: node scripts/build-render-coverage.cjs" >&2; exit 1; }
  fi
fi
HOOK_TRAILER_RENDER
  fi
  if ! grep -q "build-corpus-stats.cjs --check" "$HOOK_PATH"; then
    cat >> "$GUARD_SNIPPET" <<'HOOK_TRAILER_CORPUS'

# Phase 186-02 (CORPUS-02) - corpus-stats coverage gate (Canon Part 8 / D5).
# When any LIVE corpus-fact surface or the committed magnitude source / generated
# artifact is staged, regenerate the artifact in memory and reject the commit on a
# STALE artifact OR any stale corpus literal on a LIVE surface (historical
# provenance is allow-listed via the script's documented excludedRegion). Canon
# Part 8: the check reads only LOCAL files (the source + the live surfaces); zero
# Brain calls, zero network.
# Recovery on drift / stale literal: repoint the live surface to the three live
# magnitudes, or regenerate: node scripts/build-corpus-stats.cjs
if git diff --cached --name-only | grep -qE '^(CLAUDE\.md|\.claude/includes/moat\.md|docs/THE-BRAIN\.md|docs/brain-setup\.md|\.planning/PROJECT\.md|docs/MINDRIAN-CANON\.md|docs/CANON-PHASE-MAP\.md|data/corpus-stats-source\.json|docs/CORPUS-STATS\.generated\.md)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT_PLACEHOLDER/scripts/build-corpus-stats.cjs" ]; then
    node "$REPO_ROOT_PLACEHOLDER/scripts/build-corpus-stats.cjs" --check || { echo "corpus-stats drift / stale literal -- run: node scripts/build-corpus-stats.cjs" >&2; exit 1; }
  fi
fi
HOOK_TRAILER_CORPUS
  fi
  if ! grep -q "check-shape-declaration.cjs --check" "$HOOK_PATH"; then
    cat >> "$GUARD_SNIPPET" <<'HOOK_TRAILER_SHAPE'

# Phase 190-04 (SFD-04/SFD-05, Canon Part 11 R16) - born-declared-shape gate
# (HARD-FAIL). The fourth CIRS-family tripwire: when any invocable surface across
# the FOUR declaring classes (commands/*.md, agents/*.md, pipelines/*/CHAIN.md,
# skills/*/SKILL.md) is staged, re-scan the tree and reject the commit unless every
# surface DECLARES its Shape-F (hitl_shape/hitl_why or hitl_stages) OR, for a
# no-fork skill, carries the CIRS connector.excluded:true + reason exemption. A
# surface silently missing both a Shape-F declaration and a CIRS exclusion can no
# longer reach merge. A WARN-only shape gate is the 143.x/144.1 regression with
# extra steps (R9); this is HARD-FAIL (exit 1), never WARN. Canon Part 8: the check
# reads only LOCAL frontmatter; zero Brain calls, zero network.
# Recovery: run node scripts/backfill-hitl-shape.cjs, hand-author the missing
# declaration per docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add
# connector.excluded:true + reason if a new skill reaches no fork.
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|agents/.*\.md|pipelines/.*/CHAIN\.md|skills/.*/SKILL\.md)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT_PLACEHOLDER/scripts/check-shape-declaration.cjs" ]; then
    node "$REPO_ROOT_PLACEHOLDER/scripts/check-shape-declaration.cjs" --check || { echo "shape-declaration gap -- run: node scripts/backfill-hitl-shape.cjs, or declare hitl_shape/hitl_stages per docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add connector.excluded:true + reason" >&2; exit 1; }
  fi
fi
HOOK_TRAILER_SHAPE
  fi
  # Find the LAST `exit 0` line (a bare terminal exit). If present, splice the
  # guards in just before it; otherwise append to the end of the hook.
  LAST_EXIT_LINE="$(grep -n '^exit 0[[:space:]]*$' "$HOOK_PATH" | tail -1 | cut -d: -f1 || true)"
  if [ -n "$LAST_EXIT_LINE" ]; then
    SPLICED="$(mktemp)"
    head -n "$((LAST_EXIT_LINE - 1))" "$HOOK_PATH" > "$SPLICED"
    cat "$GUARD_SNIPPET" >> "$SPLICED"
    tail -n "+$LAST_EXIT_LINE" "$HOOK_PATH" >> "$SPLICED"
    mv "$SPLICED" "$HOOK_PATH"
  else
    cat "$GUARD_SNIPPET" >> "$HOOK_PATH"
  fi
  rm -f "$GUARD_SNIPPET"
  sed -i "s|\$REPO_ROOT_PLACEHOLDER|$REPO_ROOT|g" "$HOOK_PATH"
else
  cat > "$HOOK_PATH" <<HOOK_BODY
#!/usr/bin/env bash
# Auto-installed by scripts/install-pre-commit.sh (Phase 108-05 + 128-03 + 167).
# Phase 108-05 - schema alias drift guard.
# Phase 128-03 - Substrate Contract guard (lib/core/navigation.cjs is the only door).
# Phase 167 (D-167-03) - harness-manifest drift guard.
set -euo pipefail
node "$REPO_ROOT/scripts/check-schema-aliases.cjs" || exit 1
# Phase 128-03 - reject net-new chokepoint bypass on staged files.
# Strict superset of the retired --check-chokepoint (CONTEXT finding H1).
# Recovery: route room.db access through lib/core/navigation.cjs (Canon Part 9),
# or add the path to ALLOWED_DIRECT_IMPORT in scripts/check-substrate.cjs.
# Contract: docs/architecture/SUBSTRATE-CONTRACT.md
node "$REPO_ROOT/scripts/check-substrate.cjs" --diff || exit 1
# Phase 167 (D-167-03) - harness-manifest drift guard.
# When the manifest, its generator, OR any of the three named source maps
# (command-registry / connector-registry / brain-orchestration-projection) is
# staged, regenerate the manifest in memory and reject the commit on drift
# (STALE / UNRESOLVED / MALFORMED). A change to any source map can stale the
# manifest digests, so the trigger is path-scoped on all five paths. STRONGER
# than the connector/projection precedent (whose --checks run only in test
# aggregators): the manifest --check is wired into BOTH pre-commit and
# tests/run-all-167.sh. Canon Part 8: the check is a local byte-compare +
# map-resolve; it never touches the Brain.
# Recovery on drift: node scripts/build-harness-manifest.cjs
if git diff --cached --name-only | grep -qE '^(scripts/build-harness-manifest\.cjs|data/harness-manifest\.json|data/command-registry\.json|data/connector-registry\.json|data/brain-orchestration-projection\.json)\$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-harness-manifest.cjs" ]; then
    node "$REPO_ROOT/scripts/build-harness-manifest.cjs" --check || { echo "harness-manifest drift -- run: node scripts/build-harness-manifest.cjs" >&2; exit 1; }
  fi
fi
# Phase 172-13 (Canon Part 11 R2/R9) - connector coverage gate (born-wired HARD-FAIL).
# Recovery on drift / dark surface: node scripts/build-connector-registry.cjs
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|skills/.*/SKILL\.md|agents/.*\.md|data/connector-registry\.json|data/connector-coverage-ledger\.json|data/framework-names\.json)\$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-connector-registry.cjs" ]; then
    node "$REPO_ROOT/scripts/build-connector-registry.cjs" --check || { echo "connector-registry drift / dark surface -- run: node scripts/build-connector-registry.cjs" >&2; exit 1; }
  fi
fi
# Phase 172-13 (Canon Part 11 R2/R9) - orchestration-projection coverage gate (born-wired HARD-FAIL).
# Recovery on drift / command gap: node scripts/build-orchestration-projection.cjs
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|skills/.*/SKILL\.md|agents/.*\.md|data/connector-registry\.json|data/connector-coverage-ledger\.json|data/command-registry\.json|data/cross-domain-analogues\.json|data/orchestration-unwired-allowlist\.json|data/brain-orchestration-projection\.json|data/orchestration-command-ledger\.json)\$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-orchestration-projection.cjs" ]; then
    node "$REPO_ROOT/scripts/build-orchestration-projection.cjs" --check || { echo "orchestration-projection drift / command gap -- run: node scripts/build-orchestration-projection.cjs" >&2; exit 1; }
  fi
fi
# Phase 178-03 (Canon Part 11 render twin, C-3) - render-coverage gate (born-wired HARD-FAIL).
# Recovery on drift / dark surface: node scripts/build-render-coverage.cjs
if git diff --cached --name-only | grep -qE '^(lib/hmi/.*\.cjs|lib/agents/.*\.cjs|lib/render/.*\.cjs|lib/core/.*\.cjs|scripts/intent-classifier\.cjs|data/render-coverage-registry\.json)\$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-render-coverage.cjs" ]; then
    node "$REPO_ROOT/scripts/check-render-coverage.cjs" --check || { echo "render-coverage drift / dark surface -- run: node scripts/build-render-coverage.cjs" >&2; exit 1; }
  fi
fi
# Phase 186-02 (CORPUS-02) - corpus-stats coverage gate (Canon Part 8 / D5).
# Recovery on drift / stale literal: node scripts/build-corpus-stats.cjs
if git diff --cached --name-only | grep -qE '^(CLAUDE\.md|\.claude/includes/moat\.md|docs/THE-BRAIN\.md|docs/brain-setup\.md|\.planning/PROJECT\.md|docs/MINDRIAN-CANON\.md|docs/CANON-PHASE-MAP\.md|data/corpus-stats-source\.json|docs/CORPUS-STATS\.generated\.md)\$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-corpus-stats.cjs" ]; then
    node "$REPO_ROOT/scripts/build-corpus-stats.cjs" --check || { echo "corpus-stats drift / stale literal -- run: node scripts/build-corpus-stats.cjs" >&2; exit 1; }
  fi
fi
# Phase 190-04 (SFD-04/SFD-05, Canon Part 11 R16) - born-declared-shape gate (HARD-FAIL).
# Recovery: node scripts/backfill-hitl-shape.cjs, or declare hitl_shape/hitl_stages per
# docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add connector.excluded:true + reason.
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|agents/.*\.md|pipelines/.*/CHAIN\.md|skills/.*/SKILL\.md)\$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-shape-declaration.cjs" ]; then
    node "$REPO_ROOT/scripts/check-shape-declaration.cjs" --check || { echo "shape-declaration gap -- run: node scripts/backfill-hitl-shape.cjs, or declare hitl_shape/hitl_stages per docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add connector.excluded:true + reason" >&2; exit 1; }
  fi
fi
HOOK_BODY
fi

chmod +x "$HOOK_PATH"
echo "Pre-commit hook installed at $HOOK_PATH (schema-aliases + substrate + coverage gates + corpus-stats + shape-declaration)."
echo "To bypass for emergency commits: git commit --no-verify"
echo "  (per Phase 108 social convention: open a canon-amendment PR within 24 hours)"
