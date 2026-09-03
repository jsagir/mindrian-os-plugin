#!/usr/bin/env bash
# MindrianOS pre-commit guard: every Data Room directory must have ROOM.md + MINTO.md.
#
# BSL 1.1. Copyright (c) Mindrian 2026.
#
# CANONICAL SOURCE (Phase 235-01, CIRS-01):
#   This file is the ONE canonical git pre-commit hook body. Its byte-identical
#   twin scripts/hooks/pre-commit-room-minto-guard.sh is what BOTH installers
#   (scripts/setup-hooks.sh and scripts/install-pre-commit.sh) copy verbatim.
#   Before Phase 235 these were three independently hand-authored bodies that
#   drifted, and session-start ran both installers every session, so the
#   narrower body silently overwrote the richer one and the born-wired gates
#   were never live in the installed hook. Never hand-edit only one of the two
#   files: `cmp scripts/hooks/pre-commit scripts/hooks/pre-commit-room-minto-guard.sh`
#   must report no difference (proved by tests/test-235-cirs-commit-gate-worktree.cjs).
#
# Consultation confirmation (Phase 235-01 Task 1, per CLAUDE.md "Consult ALL
# Relevant Grounding Sources"): git pre-commit hooks and Claude Code's
# hooks/hooks.json are separate systems; this change touches only the former.
#   Evidence: hooks/hooks.json declares only Claude-Code-internal lifecycle
#   events (SessionStart, PreCompact, PostCompact, Stop, SessionEnd, PreToolUse,
#   PostToolUse, UserPromptSubmit, FileChanged, CwdChanged, SubagentStop,
#   TaskCompleted) and contains zero references to `.git/hooks`, `pre-commit`,
#   or `git commit`. This hook is invoked by the git binary itself from
#   $(git rev-parse --git-path hooks/pre-commit), entirely outside Claude Code's
#   hook loader and its matchers. Changing this file cannot affect hooks.json.
#
# Purpose (SEC-04 / Phase 87-01a):
#   Enforce CLAUDE.md decision #15 + Phase 81 Feynman-MINTO invariant at git
#   commit time. The invariant states: every directory inside a Data Room must
#   hold both ROOM.md (ICM Layer 0 identity) and MINTO.md (Feynman-MINTO
#   reasoning state). Violations produce misfiling and cross-room leaks
#   (witnessed in Phase 83).
#
# Scoping (R-C4 regression fix):
#   The invariant applies ONLY to Data Room subtrees. A Data Room subtree is
#   marked by a `.room-root` sentinel file at its root. Plugin source dirs
#   (lib/, scripts/, commands/, templates/, etc.) have NO `.room-root` ancestor
#   and are NEVER blocked by this hook. This is the correct reading of
#   decision #15 -- the invariant targets user-facing Data Rooms, not plugin
#   source trees. If this scoping rule regresses, Test 5 in
#   lib/memory/room-minto-hook.test.cjs fails immediately.
#
# Worktree safety (R-87-01a-WIN):
#   The installer uses `git rev-parse --git-path hooks/pre-commit` to resolve
#   the effective hooks directory. In a linked worktree, `.git` is a FILE
#   containing `gitdir: <main-git-dir>/worktrees/<name>/`, and the real
#   hooks dir is NOT `<repo>/.git/hooks`. See scripts/setup-hooks.sh.
#
# Symlink safety (R-87-01a-WIN):
#   find_room_root walks ancestor dirs via `cd + pwd -P` (realpath) and
#   records visited realpaths in a VISITED associative array. A symlink that
#   points back into the walked tree is detected and the walk terminates
#   without looping.
#
# Exit codes:
#   0  -- all staged dirs either pass the invariant or are outside any Data
#         Room subtree (plugin source). Commit proceeds.
#   2  -- at least one Data Room dir is missing ROOM.md or MINTO.md. Commit
#         rejected with a clear stderr message pointing to decision #15.

set -u

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [ -z "$REPO_ROOT" ]; then
  exit 0  # Not a git repo -- nothing to check
fi

# Resolve realpath of REPO_ROOT so we terminate the walk at the correct boundary
# even when the working tree is reached via a symlink.
REPO_ROOT_REAL=$(cd "$REPO_ROOT" 2>/dev/null && pwd -P)
[ -z "$REPO_ROOT_REAL" ] && REPO_ROOT_REAL="$REPO_ROOT"

VIOLATIONS=0
MESSAGES=()

# Directories that contain staged changes (added, modified, or renamed).
# We deduplicate and exclude empty entries ("." from dirname of top-level files).
STAGED_DIRS=$(git diff --cached --name-only --diff-filter=AMR 2>/dev/null \
  | xargs -n1 -I{} dirname "{}" 2>/dev/null \
  | sort -u)

# Walk up from $1 (a staged dir path, repo-relative) looking for `.room-root`.
# Realpath-normalize each step; dedupe via VISITED to prevent symlink loops.
# Prints the absolute realpath of the directory containing .room-root, or
# empty if none found.
find_room_root() {
  local dir="$1"
  local abs="$REPO_ROOT/$dir"
  local real
  declare -A VISITED
  while :; do
    real=$(cd "$abs" 2>/dev/null && pwd -P) || return 1
    # Termination: walked above the repo root
    case "$real" in
      "$REPO_ROOT_REAL"|"/") break ;;
    esac
    # Loop guard (symlink cycle detection)
    if [ -n "${VISITED[$real]:-}" ]; then
      break
    fi
    VISITED[$real]=1
    if [ -f "$real/.room-root" ]; then
      echo "$real"
      return 0
    fi
    abs=$(dirname "$real")
  done
  # Also check repo root itself (a Data Room rooted at the repo root)
  if [ -f "$REPO_ROOT_REAL/.room-root" ]; then
    echo "$REPO_ROOT_REAL"
    return 0
  fi
  echo ""
  return 1
}

for dir in $STAGED_DIRS; do
  [ -z "$dir" ] && continue
  [ "$dir" = "." ] && continue

  # Scoping gate: only enforce within a .room-root subtree.
  # If no ancestor holds .room-root, this is plugin source -- SKIP.
  ROOM_ROOT=$(find_room_root "$dir")
  if [ -z "$ROOM_ROOT" ]; then
    continue  # Plugin source dir -- not a Data Room -- skip silently
  fi

  # Inside a Data Room subtree -- enforce ROOM.md + MINTO.md
  abs_dir="$REPO_ROOT/$dir"
  if [ -d "$abs_dir" ]; then
    if [ ! -f "$abs_dir/ROOM.md" ]; then
      MESSAGES+=("MISSING ROOM.md: $dir")
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
    if [ ! -f "$abs_dir/MINTO.md" ]; then
      MESSAGES+=("MISSING MINTO.md: $dir")
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "MindrianOS pre-commit guard: ROOM.md + MINTO.md invariant violated ($VIOLATIONS issue(s))." >&2
  for m in "${MESSAGES[@]}"; do echo "  $m" >&2; done
  echo "" >&2
  echo "Per CLAUDE.md decision #15: every Data Room directory must have ROOM.md (identity) + MINTO.md (reasoning)." >&2
  echo "This check fires only for dirs inside a subtree marked with a .room-root sentinel." >&2
  echo "Generate with: node scripts/generate-section-intelligence.cjs <dir>" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Phase 122-02 guardian: command-registry drift tripwire.
#
# When any commands/*.md or data/command-registry.json or data/framework-names
# .json is staged, regenerate the registry in memory and reject the commit if
# the on-disk registry is stale OR a command declares an unresolvable framework
# name. Generated, never hand-written; drift impossible to commit (Reliability
# rule 2, .planning/WORKFLOW-LAYER-SPEC.md). Canon Part 8: the check never
# touches the Brain.
# Recovery on drift: node scripts/build-command-registry.cjs
# (the guard runs:  node scripts/build-command-registry.cjs --check )
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|data/command-registry\.json|data/framework-names\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-command-registry.cjs" ]; then
    node "$REPO_ROOT/scripts/build-command-registry.cjs" --check || { echo "command-registry drift -- run: node scripts/build-command-registry.cjs" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Phase 143.3-02 guardian: connector-registry drift + four CONN-03 validations.
#
# When any commands/*.md, skills/*/SKILL.md, agents/*.md,
# data/connector-registry.json, data/connector-coverage-ledger.json, or
# data/framework-names.json is staged, regenerate the connector registry in
# memory and reject the commit if the on-disk registry is stale OR any of the
# four CONN-03 validations fail (reach_id not in frozen 6, posture not in frozen
# 3, framework unresolvable via commandsForFramework, or a duplicate
# (sensor,reach,sub_mode) tuple) OR any surface is a GAP (neither WIRED nor
# EXCLUDED). The gap check is a HARD FAIL as of Phase 172-13 (Canon Part 11
# R2/R9): a born-dark surface can no longer reach merge. Generated, never
# hand-written; drift impossible to commit. Canon Part 8: the check never
# touches the Brain.
# Recovery on drift: node scripts/build-connector-registry.cjs
# (the guard runs:  node scripts/build-connector-registry.cjs --check )
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|skills/.*/SKILL\.md|agents/.*\.md|data/connector-registry\.json|data/connector-coverage-ledger\.json|data/framework-names\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-connector-registry.cjs" ]; then
    node "$REPO_ROOT/scripts/build-connector-registry.cjs" --check || { echo "connector-registry drift / dark surface -- run: node scripts/build-connector-registry.cjs" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Phase 157-04 guardian: orchestration-projection drift + the 3-mode taxonomy.
#
# When any commands/*.md, skills/*/SKILL.md, agents/*.md, data/connector-registry
# .json, data/command-registry.json, data/cross-domain-analogues.json,
# data/orchestration-unwired-allowlist.json, or data/brain-orchestration
# -projection.json is staged, regenerate the projection in memory and reject the
# commit on any of the three named failure modes (BOG-08, D-04): STALE (a surface
# changed without regenerating), UN-WIRED (a framework not reachable to one of
# the 6 frozen reaches and not allowlisted -- the generalization of the
# /mos:futures un-wired gap, BOG-06), or UN-RANKED (a connector-derived node
# missing reach_id/hierarchy_rank/posture). Generated, never hand-written; drift
# impossible to commit. Canon Part 8: the check never touches the Brain.
# Recovery on drift: node scripts/build-orchestration-projection.cjs
# (the guard runs:  node scripts/build-orchestration-projection.cjs --check )
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|skills/.*/SKILL\.md|agents/.*\.md|data/connector-registry\.json|data/connector-coverage-ledger\.json|data/command-registry\.json|data/cross-domain-analogues\.json|data/orchestration-unwired-allowlist\.json|data/brain-orchestration-projection\.json|data/orchestration-command-ledger\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-orchestration-projection.cjs" ]; then
    node "$REPO_ROOT/scripts/build-orchestration-projection.cjs" --check || { echo "orchestration-projection drift / command gap -- run: node scripts/build-orchestration-projection.cjs" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Phase 254 Plan 03 guardian: framework-vocabulary-drift (WIRE-04).
#
# When lib/core/framework-chain-composer.cjs, data/command-registry.json,
# data/brain-orchestration-projection.json, lib/mcp/brain-router.cjs, or the
# gate script itself is staged, run the WIRE-04 declared-drift-ledger gate.
# It fails the commit on an UNDECLARED divergence between KNOWN_FRAMEWORKS,
# the registry's declared frameworks, and the projection's framework nodes --
# never on a declared entry with a stated reason. It also fails on a dangling
# declaration (a ledger entry naming a composer name that no longer exists)
# or a broken alias target (an alias_of pointing at a registry name that
# disappeared), so the ledger itself cannot silently rot. Generated nothing;
# reads three committed local sources in memory. Canon Part 8: the check
# never touches the Brain.
# Recovery on drift: node scripts/check-framework-vocabulary-drift.cjs --report
# (the guard runs:  node scripts/check-framework-vocabulary-drift.cjs --check )
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(lib/core/framework-chain-composer\.cjs|data/command-registry\.json|data/brain-orchestration-projection\.json|lib/mcp/brain-router\.cjs|scripts/check-framework-vocabulary-drift\.cjs)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-framework-vocabulary-drift.cjs" ]; then
    node "$REPO_ROOT/scripts/check-framework-vocabulary-drift.cjs" --check || { echo "framework-vocabulary drift -- run: node scripts/check-framework-vocabulary-drift.cjs --report" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Quick task 260705-sy9 guardian: skill-mirror staleness tripwire.
#
# Every commands/<name>.md is mirrored into skills/<name>/SKILL.md (the Windows
# commands-registration workaround, 260705-ob7). When any commands/*.md or
# skills/*/SKILL.md is staged, run the mirror --check and reject the commit if
# any mirror is missing/stale OR a SKIP_LIST skill was deleted or reverted to a
# plain copy of its command. Canon Part 8: local byte compares only, zero
# Brain calls.
# Recovery on drift: node scripts/build-skill-mirrors.cjs
# (the guard runs:  node scripts/build-skill-mirrors.cjs --check )
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|skills/.*/SKILL\.md)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-skill-mirrors.cjs" ]; then
    node "$REPO_ROOT/scripts/build-skill-mirrors.cjs" --check || { echo "skill-mirror drift -- run: node scripts/build-skill-mirrors.cjs" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Phase 110 guardian: brain-packet-schema drift / malformed-schema tripwire.
#
# When data/brain-packet-schema.json or scripts/build-brain-packet-schema.cjs
# is staged, regenerate the schema in memory and reject the commit if the
# on-disk schema drifts from the generator output. Mirrors Phase 122 pattern
# (Reliability rule 2, .planning/WORKFLOW-LAYER-SPEC.md). Canon Part 8: the
# check never touches the Brain.
# Recovery on drift: node scripts/build-brain-packet-schema.cjs
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(data/brain-packet-schema\.json|scripts/build-brain-packet-schema\.cjs)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-brain-packet-schema.cjs" ]; then
    node "$REPO_ROOT/scripts/build-brain-packet-schema.cjs" --check || { echo "brain-packet-schema drift -- run: node scripts/build-brain-packet-schema.cjs --check" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Phase 110 guardian (D-08 layer 2): refuse a bare sendPacket( not preceded
# by buildBrainPacket( in the same staged file. The origin string on a
# Brain Context Packet is in-process-forgeable; this hook is the real teeth
# that catches a packet built outside lib/core/navigation.cjs::buildBrainPacket.
# Allow-list (always allowed): brain-client.cjs / navigation.cjs / navigation/
# / tests/ / scripts/. Canon Part 8 (Graph Boundary) + Part 9 (Memory Locality).
# Recovery: build the packet via navigation.buildBrainPacket(...) before
# calling brain-client.sendPacket(...), or add the path to
# ALLOWED_SENDPACKET_FILES in scripts/check-schema-aliases.cjs.
# ---------------------------------------------------------------------------
if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-schema-aliases.cjs" ]; then
  node "$REPO_ROOT/scripts/check-schema-aliases.cjs" --check-sendpacket || { echo "bare sendPacket( introduced -- per D-08 it must be lexically preceded by buildBrainPacket(" >&2; exit 2; }
fi

# ---------------------------------------------------------------------------
# Phase 118-06 guardian: reward-before-investment rule linter.
#
# When any commands/*.md is staged, run scripts/check-reward-before-investment
# .cjs against THE STAGED FILES. The linter validates that every interactive
# command declares an interactive_first_reward field in YAML frontmatter with a
# value from the v1.13.0 REWARD_TYPES closed vocabulary (or `--none (scripting
# only)` per rule doc line 81). Exits non-zero if any staged commands/*.md
# change introduces a missing or invalid declaration.
#
# Phase 245-02 root-cause fix: this block used to pass "$REPO_ROOT/commands",
# scanning the WHOLE directory, which contradicted the contract stated one
# paragraph above. With 103 of 112 commands never having declared the field,
# one pre-existing offender blocked every commit that touched any command file,
# so the guardian had become a permanent forced-bypass rather than a gate. It
# now passes --staged, which discovers the file set from `git diff --cached`.
# The per-file verdict is UNCHANGED and still fails closed: stage a command
# with a missing or invalid declaration and the commit is still blocked. The
# repo-wide debt remains visible through the full-audit mode (run the CLI with
# no --staged flag), which CI and manual sweeps still use.
#
# Bypass: COMMIT_NO_VERIFY=1 (wave-protocol invariant per Phase 125-08
# SUMMARY; mirrors the Phase 108 social convention -- if you bypass, open a
# canon-amendment PR within 24 hours).
#
# Source-of-truth: docs/reward-before-investment-rule.md.
# Library: lib/core/mva-rule-linter.cjs (scanFiles for the staged path,
# scanCommands for the full audit; one shared classifier).
# Recovery on failure: declare interactive_first_reward in the offending
# commands/*.md frontmatter. Allowed values: reframe_question, instant_brief,
# schema_preview, calibration_distribution_preview, paragraph_preview,
# --none (scripting only).
# Canon Part 8: zero network, zero Brain calls; LOCAL-only fs + index read.
# ---------------------------------------------------------------------------
if [ -z "${COMMIT_NO_VERIFY:-}" ]; then
  if git diff --cached --name-only --diff-filter=ACM | grep -qE '^commands/.+\.md$'; then
    if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-reward-before-investment.cjs" ]; then
      # Lint the STAGED commands/*.md only. The linter's exit code is the gate;
      # its stdout/stderr are the diagnostic surface.
      if ! node "$REPO_ROOT/scripts/check-reward-before-investment.cjs" --staged "$REPO_ROOT"; then
        echo "" >&2
        echo "MindrianOS pre-commit guard: reward-before-investment rule violated." >&2
        echo "See docs/reward-before-investment-rule.md for the rule + remediation values." >&2
        echo "Bypass for emergency commits: COMMIT_NO_VERIFY=1 git commit ..." >&2
        exit 2
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Phase 88-13 guardian: block commit on critical/error invariant violations.
#
# Iterates over each DISCOVERED room root from the find_room_root loop above
# (NOT a nonexistent top-level $ROOM_DIR variable). For each unique Data Room
# root that owns staged files, runs the Feynman-MINTO guardian in pre-commit
# mode. The guardian runs every registered validator against each section
# whose staged file lives under it and exits 2 on critical/error severity.
#
# Plugin source commits (no .room-root ancestor anywhere) never reach this
# block because the find_room_root loop above has nothing to add to
# DISCOVERED_ROOM_ROOTS for them. See 88-13-SUMMARY.md.
# ---------------------------------------------------------------------------
#
# Re-walk staged dirs to collect unique Data Room roots (dedup). The 87-01a
# loop above only needs the immediate dir; we need the ancestor root.
declare -A _DISCOVERED_ROOTS
for _dir in $STAGED_DIRS; do
  [ -z "$_dir" ] && continue
  [ "$_dir" = "." ] && continue
  _root=$(find_room_root "$_dir" 2>/dev/null || echo "")
  if [ -n "$_root" ]; then
    _DISCOVERED_ROOTS["$_root"]=1
  fi
done

# Locate the plugin root for the guardian script. Prefer $PLUGIN_ROOT if set
# by the caller; otherwise walk up from this script's directory.
_GUARDIAN_PLUGIN_ROOT="${PLUGIN_ROOT:-}"
if [ -z "$_GUARDIAN_PLUGIN_ROOT" ]; then
  _SELF_DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd -P)
  # The installed hook lives at <repo>/.git/hooks/pre-commit (or worktree equiv);
  # its siblings in this source file live at <repo>/scripts/hooks/. Walk up to
  # find scripts/feynman-minto-guardian.cjs.
  _candidate="$REPO_ROOT_REAL"
  if [ -f "$_candidate/scripts/feynman-minto-guardian.cjs" ]; then
    _GUARDIAN_PLUGIN_ROOT="$_candidate"
  fi
fi

if [ -n "$_GUARDIAN_PLUGIN_ROOT" ] && [ -f "$_GUARDIAN_PLUGIN_ROOT/scripts/feynman-minto-guardian.cjs" ] && command -v node >/dev/null 2>&1; then
  for _discovered_room in "${!_DISCOVERED_ROOTS[@]}"; do
    [ -z "$_discovered_room" ] && continue
    node "$_GUARDIAN_PLUGIN_ROOT/scripts/feynman-minto-guardian.cjs" pre-commit "$_discovered_room"
    _GUARDIAN_EXIT=$?
    if [ "$_GUARDIAN_EXIT" -ne 0 ]; then
      echo "" >&2
      echo "MindrianOS pre-commit guard: commit blocked by feynman-minto-guardian in room: $_discovered_room" >&2
      echo "Fix violations or use --no-verify at your own risk." >&2
      exit "$_GUARDIAN_EXIT"
    fi
  done
fi

# ===========================================================================
# Phase 235-01 (CIRS-01): the 8 guard blocks below were previously authored
# ONLY inside scripts/install-pre-commit.sh's HOOK_BODY heredoc, which is why
# they were silently dropped every time setup-hooks.sh reinstalled the narrower
# body. They are ported here verbatim (trigger regex, recovery echo, and doc
# comment unchanged) so the union lives in ONE file. Exit code normalized to 2
# to match this file's existing convention (git only requires nonzero).
# ===========================================================================

# ---------------------------------------------------------------------------
# Phase 108-05 - schema alias drift guard.
#
# Phase 235-01 note: install-pre-commit.sh's retired heredoc expanded the
# plugin's absolute $REPO_ROOT at INSTALL time, so it could invoke this
# unconditionally. This canonical hook resolves $REPO_ROOT at RUN time and is
# installed into whatever repo asks for it (a user's room repo, a test
# fixture), so the invocation carries the same `command -v node` + `[ -f ... ]`
# existence guard every other block in this file uses. Without it the hook
# hard-fails every commit in any repo that is not the plugin checkout.
# ---------------------------------------------------------------------------
if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-schema-aliases.cjs" ]; then
  node "$REPO_ROOT/scripts/check-schema-aliases.cjs" || exit 2
fi

# ---------------------------------------------------------------------------
# Phase 128-03 - reject net-new chokepoint bypass on staged files.
# Strict superset of the retired --check-chokepoint (CONTEXT finding H1).
# Recovery: route room.db access through lib/core/navigation.cjs (Canon Part 9),
# or add the path to ALLOWED_DIRECT_IMPORT in scripts/check-substrate.cjs.
# Contract: docs/architecture/SUBSTRATE-CONTRACT.md
# ---------------------------------------------------------------------------
if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-substrate.cjs" ]; then
  node "$REPO_ROOT/scripts/check-substrate.cjs" --diff || exit 2
fi

# ---------------------------------------------------------------------------
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
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(scripts/build-harness-manifest\.cjs|data/harness-manifest\.json|data/command-registry\.json|data/connector-registry\.json|data/brain-orchestration-projection\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-harness-manifest.cjs" ]; then
    node "$REPO_ROOT/scripts/build-harness-manifest.cjs" --check || { echo "harness-manifest drift -- run: node scripts/build-harness-manifest.cjs" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Phase 178-03 (Canon Part 11 render twin, C-3) - render-coverage gate (born-wired HARD-FAIL).
# Recovery on drift / dark surface: node scripts/build-render-coverage.cjs
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(lib/hmi/.*\.cjs|lib/agents/.*\.cjs|lib/render/.*\.cjs|lib/core/.*\.cjs|scripts/intent-classifier\.cjs|data/render-coverage-registry\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-render-coverage.cjs" ]; then
    node "$REPO_ROOT/scripts/check-render-coverage.cjs" --check || { echo "render-coverage drift / dark surface -- run: node scripts/build-render-coverage.cjs" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Phase 186-02 (CORPUS-02) - corpus-stats coverage gate (Canon Part 8 / D5).
# Recovery on drift / stale literal: node scripts/build-corpus-stats.cjs
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(CLAUDE\.md|\.claude/includes/moat\.md|docs/THE-BRAIN\.md|docs/brain-setup\.md|\.planning/PROJECT\.md|docs/MINDRIAN-CANON\.md|docs/CANON-PHASE-MAP\.md|data/corpus-stats-source\.json|docs/CORPUS-STATS\.generated\.md)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/build-corpus-stats.cjs" ]; then
    node "$REPO_ROOT/scripts/build-corpus-stats.cjs" --check || { echo "corpus-stats drift / stale literal -- run: node scripts/build-corpus-stats.cjs" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Phase 190-04 (SFD-04/SFD-05, Canon Part 11 R16) - born-declared-shape gate (HARD-FAIL).
# Recovery: node scripts/backfill-hitl-shape.cjs, or declare hitl_shape/hitl_stages per
# docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add connector.excluded:true + reason.
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|agents/.*\.md|pipelines/.*/CHAIN\.md|skills/.*/SKILL\.md)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-shape-declaration.cjs" ]; then
    node "$REPO_ROOT/scripts/check-shape-declaration.cjs" --check || { echo "shape-declaration gap -- run: node scripts/backfill-hitl-shape.cjs, or declare hitl_shape/hitl_stages per docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add connector.excluded:true + reason" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Quick task 20260702-help-coverage-gate (Canon Part 11 born-listed exclusion) -
# /mos:help coverage gate (HARD-FAIL). Rejects a commit where a user-facing
# command is absent from data/help-groups.json, a grouped/excluded name has no
# file (ghost), or a deprecated:true command is not born-listed in
# deprecated_aliases. Canon Part 8: LOCAL frontmatter + manifest only.
# Recovery: add the command to data/help-groups.json, or list a deprecation in
# deprecated_aliases.
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(commands/.*\.md|data/help-groups\.json)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-help-coverage.cjs" ]; then
    node "$REPO_ROOT/scripts/check-help-coverage.cjs" || { echo "help-coverage gap -- add the command to data/help-groups.json, or list a deprecation in deprecated_aliases" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Quick task 260705-jeq (Canon Part 7 / Part 11) - command-registration
# precondition sweep (HARD-FAIL). Catches the static authoring mistakes that make
# Claude Code SILENTLY skip a command file: a broken frontmatter fence, a tab in
# the YAML block, an illegal command name, or a case-insensitive basename
# collision. Canon Part 8: LOCAL file reads only.
# Recovery: fix the flagged frontmatter fence / tab / name / collision.
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^commands/.*\.md$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/lib/core/command-registration-check.cjs" ]; then
    node "$REPO_ROOT/lib/core/command-registration-check.cjs" || { echo "command-registration precondition FAIL - a command would silently not register" >&2; exit 2; }
  fi
fi

# ---------------------------------------------------------------------------
# Quick task 260903-ljj - MCP tool-honesty advisory gate (description-vs-
# behavior mismatch scanner, RCA .planning/debug/meeting-file-meeting-false-
# success.md's named follow-up sweep). ADVISORY, not HARD-FAIL: the surface
# has never been swept this way and the findings need human triage first
# (Phase 210 posture, same as the shape-declaration block above).
#
# Deliberately NO `|| { ...; exit 2; }` tail here, and that omission is
# load-bearing, not an oversight: the script's own `--check` already exits 0
# by design on findings (it WARNs and enumerates instead of failing), so
# adding a failure tail would silently re-harden this gate the day someone
# changes the script's default posture without anyone noticing the hook
# quietly started blocking commits. Recovery: run `node scripts/
# check-tool-honesty.cjs --report` to see the full per-branch table, or add a
# triaged entry to ALLOWED_UNVERIFIED in scripts/check-tool-honesty.cjs.
# ---------------------------------------------------------------------------
if git diff --cached --name-only | grep -qE '^(lib/mcp/tool-router\.cjs|lib/mcp/tools/.*\.cjs|lib/mcp/contract-version\.cjs)$'; then
  if command -v node >/dev/null 2>&1 && [ -f "$REPO_ROOT/scripts/check-tool-honesty.cjs" ]; then
    node "$REPO_ROOT/scripts/check-tool-honesty.cjs" --check
  fi
fi

exit 0
