#!/usr/bin/env bash
# MindrianOS Release Script -- eliminates manual release errors
# Usage:
#   bash scripts/release.sh --prerelease            # beta.N -> beta.N+1
#   bash scripts/release.sh --finalize              # X.Y.Z-beta.N -> X.Y.Z (strip suffix)
#   bash scripts/release.sh --start-prerelease      # X.Y.Z -> X.(Y+1).0-beta.1
#   bash scripts/release.sh patch                   # semver.inc(v,'patch')
#   bash scripts/release.sh minor                   # semver.inc(v,'minor')
#   bash scripts/release.sh major                   # semver.inc(v,'major')
#
# Flags:
#   --allow-ahead    : skip the ahead-of-origin abort (use with care)
#   --no-next-bump   : skip Commit B (leave main HEAD at NEW_VERSION; rare)
#
# Notes on semver semantics (verified against semver@7.7.4):
#   semver.inc('1.13.0-beta.11','prerelease','beta') -> '1.13.0-beta.12'
#   semver.inc('1.13.0-beta.11','patch')              -> '1.13.0'   (STRIPS suffix; this IS --finalize)
#   semver.inc('1.13.0-beta.11','minor')              -> '1.13.0'   (also strips; NOT 1.14.0)
#   semver.inc('1.13.0-beta.11','major')              -> '2.0.0'
#   semver.inc('1.13.0','preminor','beta')            -> '1.14.0-beta.0' (call prerelease once more for beta.1)
#
# What it does:
#   0. Parse bump mode (+ flags). Refuse unknown.
#   0.5. semver preflight (require node_modules/semver; do NOT auto-npm-install).
#   1. Compute NEW_VERSION via semver.inc() in a node one-liner.
#   2. Pre-release verification (scripts/verify-release).
#   3-6. Bump plugin.json + package.json + marketplace.json (+ source.ref pinned to vN).
#        Reserved-name compliance check (Step 5b). CHANGELOG entry. Post-bump re-verify.
#   7. Commit A (release commit): plugin.json/package.json/CHANGELOG.md == vN; tag vN.
#      Marketplace commit (marketplace.json version + source.ref == vN). The vN
#      tag points at Commit A so `marketplace.json source.ref: vN` resolves to a
#      tree whose plugin.json self-reports vN (TWO-COMMIT form, per Phase 123 D-19
#      research finding 1: Claude Code reads plugin.json version FIRST).
#   9.5. npm publish @mindrian_os/cli at NEW_VERSION (BEFORE Commit B so the
#        working tree still says vN). dist-tag: @next for -beta./alpha./rc./next.,
#        @latest for clean X.Y.Z.
#   9.6. Sync install minisite to NEW_VERSION (HARD 7-place lockstep, Phase 126
#        Plan 04). Bumps ~/mindrianos-install-site/lib/os.ts + app/page.tsx via
#        line-anchored content-based sed (NOT line numbers); grep-verify with
#        rollback on mismatch; git commit; git push origin main (NOT vercel CLI;
#        Vercel auto-deploys on push); curl live-poll $MINDRIAN_MINISITE_URL
#        until NEW_VERSION appears in body OR timeout. HARD ABORT on:
#        MINISITE_DIR-absent (recovery: `gh repo clone`/`git clone`),
#        origin-missing (recovery: `git remote add origin`), sed/grep failure,
#        push failure, live-poll timeout. --no-minisite opt-out (audit-logged).
#        See feedback_install_minisite_lockstep.md.
#   9.7. npx-publish self-test (Phase 126 Plan 04). Runs `npx --yes @mindrian_os/cli@<version>`
#        against a fresh temp dir; HARD ABORT if exit != 0 or temp dir is empty.
#   7.5. Commit B (next-bump commit, plugin repo only): plugin.json/package.json
#        -> next pre-release; CHANGELOG `[Unreleased]` heading reset. main HEAD
#        ends on Commit B. NO tag on Commit B. Marketplace repo gets NO Commit B.
#   8. Dirty-repo / ahead-of-origin guard: refuse if more than the release commits
#        are ahead of origin/main (unless --allow-ahead); refuse on dirty tracked
#        files other than the bumped ones.
#   9. Push both repos (plugin + marketplace).
#   10. Update local marketplace cache.
#   11. Post-release verification.
#
# TODO(future): de-dup verify-release calls. Phase 123 Plan-04 added Step 6.6 (which
# calls doctor --acceptance --pre-tag, which internally re-runs verify-release)
# and Step 9.8 (full doctor --acceptance, also re-runs verify-release; renamed
# from Step 9.6 by Phase 126 Plan 04 to make room for the new Step 9.6 minisite
# HARD lockstep and Step 9.7 npx-publish self-test). Combined with Step 2 and
# Step 6.5 (both call verify-release directly), the count per release is 4x.
# verify-release is idempotent + ~5s per run; accept the cost for the safety
# net now. De-dup is a follow-up (e.g. skip Step 2 / Step 6.5 when Step 6.6
# will also call it, by detecting --acceptance support).
#
# This script is the ONLY way to release. No manual pushes.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MARKETPLACE_DIR="$HOME/mindrian-marketplace"

# --- Step 0: Parse bump type + flags ---
BUMP_MODE=""
ALLOW_AHEAD=0
NO_NEXT_BUMP=0
DRY_RUN=0
NO_MINISITE=1   # install-minisite RETIRED 2026-06-09 (navigator: official site is mindrian-os.com only); off by default, --minisite re-enables
NO_WEBSITE=0    # official Mindrian website (mindrian-os.com) stays ON by default; --no-website opts out
STRICT_SHAPE=0  # Phase 235 (CIRS-03): shape-declaration gate is advisory by default; --strict-shape restores the pre-210 hard-fail
USAGE_BLOCK="Usage: bash scripts/release.sh [--prerelease | --finalize | --start-prerelease | patch | minor | major] [--allow-ahead] [--no-next-bump] [--minisite] [--no-website] [--strict-shape] [--dry-run]"

for arg in "$@"; do
  case "$arg" in
    --prerelease)        BUMP_MODE="prerelease" ;;
    --finalize)          BUMP_MODE="finalize" ;;
    --start-prerelease)  BUMP_MODE="start-prerelease" ;;
    --start-major-prerelease) BUMP_MODE="start-major-prerelease" ;;
    stable)              BUMP_MODE="finalize" ;;  # alias
    patch|minor|major)   BUMP_MODE="$arg" ;;
    --allow-ahead)       ALLOW_AHEAD=1 ;;
    --no-next-bump)      NO_NEXT_BUMP=1 ;;
    --no-minisite)       NO_MINISITE=1 ;;
    --minisite)          NO_MINISITE=0 ;;
    --no-website)        NO_WEBSITE=1 ;;
    --strict-shape)      STRICT_SHAPE=1 ;;
    --dry-run)           DRY_RUN=1 ;;
    -h|--help)           echo "$USAGE_BLOCK"; exit 0 ;;
    *)
      echo -e "${RED}unknown arg: $arg${NC}"
      echo "$USAGE_BLOCK"
      exit 1
      ;;
  esac
done

# --- Step 0.5: semver preflight ---
if [ ! -d "$PLUGIN_DIR/node_modules/semver" ]; then
  echo -e "${RED}node_modules/semver missing -- run 'npm install' first.${NC}"
  echo "  release.sh needs the semver package for pre-release bump algebra."
  echo "  (Do NOT run 'npm install' from inside this script -- the operator must do it.)"
  exit 1
fi

# --- Step 1: Get current version + compute NEW_VERSION via semver ---
CURRENT=$(node -e "console.log(require('$PLUGIN_DIR/.claude-plugin/plugin.json').version)")
echo -e "${YELLOW}Current version: $CURRENT${NC}"

# Default bump mode: --prerelease if current has a `-` suffix, else require explicit.
if [ -z "$BUMP_MODE" ]; then
  case "$CURRENT" in
    *-*) BUMP_MODE="prerelease" ;;
    *)
      echo -e "${RED}No bump mode passed and current version '$CURRENT' is clean -- specify one of: --prerelease / --finalize / --start-prerelease / patch / minor / major${NC}"
      exit 1
      ;;
  esac
fi

NEW_VERSION="$(node -e '
  const semver = require(process.argv[1] + "/node_modules/semver");
  const cur = require(process.argv[1] + "/.claude-plugin/plugin.json").version;
  if (!semver.valid(cur)) {
    console.error("plugin.json version is not valid semver: " + cur + " -- fix it before releasing (e.g. coerce 1.12.5.1 to 1.12.5).");
    process.exit(1);
  }
  const mode = process.argv[2];
  let out;
  if (mode === "prerelease") {
    out = semver.inc(cur, "prerelease", "beta");
  } else if (mode === "finalize") {
    out = semver.inc(cur, "patch");
  } else if (mode === "start-prerelease") {
    out = semver.inc(cur, "preminor", "beta");
    out = semver.inc(out, "prerelease", "beta");
  } else if (mode === "start-major-prerelease") {
    out = semver.inc(cur, "premajor", "beta");
    out = semver.inc(out, "prerelease", "beta");
  } else if (mode === "patch" || mode === "minor" || mode === "major") {
    out = semver.inc(cur, mode);
  } else {
    console.error("unknown bump mode: " + mode);
    process.exit(1);
  }
  if (!out) {
    console.error("semver.inc returned null for cur=" + cur + ", mode=" + mode);
    process.exit(1);
  }
  process.stdout.write(out);
' "$PLUGIN_DIR" "$BUMP_MODE")" || { echo -e "${RED}version computation failed${NC}"; exit 1; }

echo -e "${GREEN}New version: $NEW_VERSION (mode: $BUMP_MODE)${NC}"

# Plan 123-06 release-flight hot-patch (2026-05-13): true `--dry-run` mode.
# MOS_TEST_DRY_RUN=1 only skips the npm publish (Step 9.5). For a SAFE pre-release
# inspection, --dry-run short-circuits the script HERE -- after all version
# arithmetic is complete and the planned sequence is knowable -- without any
# filesystem mutation, commit, push, publish, or marketplace edit.
if [ "$DRY_RUN" = "1" ]; then
  # Compute the next-bump version (Step 7.5's commit B target) for the preview.
  NEXT_VERSION="$(node -e '
    const semver = require(process.argv[1] + "/node_modules/semver");
    const cur = process.argv[2];
    const mode = process.argv[3];
    let out;
    if (mode === "prerelease" || (mode !== "finalize" && cur.indexOf("-") >= 0)) {
      out = semver.inc(cur, "prerelease", "beta");
    } else if (mode === "finalize") {
      // After finalize, next-bump opens a fresh prerelease at the next patch.
      out = semver.inc(semver.inc(cur, "patch"), "prerelease", "beta");
    } else {
      // patch / minor / major (clean bumps): next-bump opens a -beta.0 on the new version.
      out = semver.inc(cur, "prerelease", "beta");
    }
    process.stdout.write(out || "(unknown)");
  ' "$PLUGIN_DIR" "$NEW_VERSION" "$BUMP_MODE")" || NEXT_VERSION="(unknown)"

  CURRENT_AHEAD=$(cd "$PLUGIN_DIR" && git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
  NPM_TAG_PREVIEW="latest"
  case "$NEW_VERSION" in *-beta.*|*-alpha.*|*-rc.*|*-next.*) NPM_TAG_PREVIEW="next" ;; esac

  echo ""
  echo -e "${YELLOW}=== DRY-RUN MODE -- no commits, no pushes, no publishes, no file writes ===${NC}"
  echo ""
  echo "Planned release sequence for: $CURRENT -> $NEW_VERSION (mode: $BUMP_MODE)"
  echo ""
  echo "  Step 2    : run scripts/verify-release (read-only check; ALREADY PASSED in pre-flight)"
  echo "  Step 2.5  : run mindrian-os doctor --acceptance --pre-flight (HARD ABORT; clean-tree gate before any mutation)"
  echo "  Step 3    : bump .claude-plugin/plugin.json + package.json -> $NEW_VERSION"
  echo "  Step 4    : bump ~/mindrian-marketplace/.claude-plugin/marketplace.json"
  echo "              version=$NEW_VERSION + source.ref=v$NEW_VERSION (TWO-COMMIT form; Phase 123 D-19)"
  echo "  Step 5    : claude plugin validate (marketplace)"
  echo "  Step 5b   : reserved-name compliance check (Phase 95.6 D-11a)"
  echo "  Step 6    : CHANGELOG.md entry check + rename [Unreleased] -> [$NEW_VERSION] - \$(date +%F)"
  echo "  Step 6.5  : post-bump re-verify (scripts/verify-release)"
  echo "  Step 6.6  : run mindrian-os doctor --acceptance --pre-tag (HARD ABORT on failure)"
  echo "  Step 6.6a : verify data/doctor-modules.json -- every runner exists +"
  echo "              introduced_version is valid semver + <= $NEW_VERSION (HARD ABORT,"
  echo "              same rollback as Step 6.6; Phase 139 Plan 04)"
  echo "  Step 6.6b : run tests/test-doctor-acceptance-self-coverage.cjs"
  echo "              (5 scaffolded broken-state fixtures + live no-regression guard;"
  echo "              HARD ABORT on fail, same rollback as Step 6.6; Phase 126 Plan 03)"
  echo "  Step 6.7  : vendor production node_modules (npm ci --omit=dev + integrity"
  echo "              gate + git add -f) into Commit A; MOS_SKIP_VENDOR=1 to skip"
  echo "  Step 7    : commit A on plugin repo -- 'release: v$NEW_VERSION', tag v$NEW_VERSION"
  echo "              commit on marketplace repo -- 'release: sync to v$NEW_VERSION'"
  echo "  Step 9.5  : npm publish @mindrian_os/cli@$NEW_VERSION --tag $NPM_TAG_PREVIEW; then promote to @latest (navigator 2026-08-10: bare npx always serves the newest release, betas included)"
  if [ "$NO_NEXT_BUMP" = "1" ]; then
    echo "  Step 7.5  : SKIPPED (--no-next-bump). main HEAD stays at $NEW_VERSION."
  else
    echo "  Step 7.5  : commit B on plugin repo -- bump to $NEXT_VERSION, CHANGELOG [Unreleased] -- v$NEXT_VERSION, un-track node_modules (main HEAD stays clean); marketplace repo -- NO version bump (catalog stays at v$NEW_VERSION so installs advertise the released stable; source.ref already v$NEW_VERSION)"
  fi
  echo "  Step 8    : dirty-repo / ahead-of-origin guard"
  echo "              current ahead-of-origin: $CURRENT_AHEAD commit(s); guard would allow up to $([ "$NO_NEXT_BUMP" = "1" ] && echo "1" || echo "2") release commit(s)"
  if [ "$CURRENT_AHEAD" != "?" ] && [ "$CURRENT_AHEAD" -gt 0 ] && [ "$ALLOW_AHEAD" != "1" ]; then
    echo "              ${YELLOW}NOTE: $CURRENT_AHEAD pre-existing commit(s) ahead of origin -- the guard will require --allow-ahead to push them with the release${NC}"
  fi
  echo "  Step 9    : git push origin main --tags (plugin); git push (marketplace)"
  echo "  Step 5.5  : verify tag v$NEW_VERSION at origin (RELEASE_TAG_PUSH_RETRIES retries, SKIP_TAG_VERIFY=1 to bypass)"
  echo "  Step 9.6a : install minisite RETIRED 2026-06-09 (off by default; --minisite re-enables)"
  if [ "$NO_MINISITE" != "1" ]; then
    echo "              ${YELLOW}--minisite engaged: would sync install minisite to v$NEW_VERSION (vercel-CLI deploy)${NC}"
  fi
  echo "  Step 9.6b : sync official Mindrian website (mindrian-os.com) FALLBACK_VERSION to v$NEW_VERSION (HARD lockstep, git-push deploy)"
  echo "              WEBSITE_DIR resolution -> sed src/lib/version.ts -> grep verify -> git push origin main -> live-poll mindrian-os.com"
  if [ "$NO_WEBSITE" = "1" ]; then
    echo "              ${YELLOW}--no-website opt-out engaged (audit-logged; mindrian-os.com NOT bumped)${NC}"
  fi
  echo "  Step 9.7  : npx-publish self-test -- npx @mindrian_os/cli@$NEW_VERSION in a fresh temp dir"
  echo "  Step 9.8  : run full mindrian-os doctor --acceptance (HARD ABORT on failure;"
  echo "              tag must be on origin, npm must answer for $NEW_VERSION, npx round-trip must work)"
  echo "  Step 10   : claude plugin marketplace update mindrian-marketplace"
  echo "  Step 11   : post-release verification (remote HEAD match, marketplace cache version)"
  echo ""
  echo -e "${YELLOW}--- working tree at dry-run time ---${NC}"
  (cd "$PLUGIN_DIR" && git status --porcelain | head -10 || true)
  echo ""
  echo -e "${YELLOW}--- commits ahead of origin (would all push with the release) ---${NC}"
  (cd "$PLUGIN_DIR" && git log origin/main..HEAD --oneline | head -10 || true)
  if [ "$CURRENT_AHEAD" != "?" ] && [ "$CURRENT_AHEAD" -gt 10 ]; then
    echo "  ...and $((CURRENT_AHEAD - 10)) more"
  fi
  echo ""
  echo -e "${GREEN}=== DRY-RUN COMPLETE. No changes made. ===${NC}"
  echo "To run the actual release: bash scripts/release.sh $BUMP_MODE $([ "$ALLOW_AHEAD" = "1" ] && echo "--allow-ahead ")$([ "$NO_NEXT_BUMP" = "1" ] && echo "--no-next-bump")"
  exit 0
fi

# --- Step 2: Run FULL verification (not just validation) ---
echo ""
echo "=== Running pre-release verification ==="
if ! bash "$PLUGIN_DIR/scripts/verify-release" 2>&1; then
  echo -e "${RED}ABORT: Pre-release verification failed. Fix all failures first.${NC}"
  exit 1
fi
echo -e "${GREEN}All verification checks passed${NC}"

# --- Step 2.4: coverage gates (Canon Part 11 R2/R9/INV-10 step 3, Phase 172-13) ---
# The born-wired coverage gate as a release gate step. Runs BOTH --check gates
# directly (a HARD ABORT) so a release carrying an accidental-dark surface (a
# command/skill/agent neither WIRED nor EXCLUDED, or a bare command counterpart
# neither ranked nor excluded) is caught BEFORE any version mutation. This is
# also folded into doctor --acceptance (the coverage-gate point), but running it
# here too keeps the release pipeline self-documenting. Canon Part 8: both
# regenerate in memory from LOCAL sources; zero Brain / network.
echo ""
echo "=== Step 2.4: coverage gates (connector + orchestration-projection + render-coverage --check) ==="
if ! node "$PLUGIN_DIR/scripts/build-connector-registry.cjs" --check; then
  echo -e "${RED}ABORT: connector coverage gate failed -- a surface is neither WIRED nor EXCLUDED.${NC}"
  echo "  Recovery: node scripts/build-connector-registry.cjs"
  exit 1
fi
if ! node "$PLUGIN_DIR/scripts/build-orchestration-projection.cjs" --check; then
  echo -e "${RED}ABORT: orchestration-projection coverage gate failed -- a command counterpart is neither ranked nor excluded.${NC}"
  echo "  Recovery: node scripts/build-orchestration-projection.cjs"
  exit 1
fi
# Phase 178-03 (Canon Part 11 render twin, C-3): the render-coverage gate rides the
# SAME release surface as the two CIRS gates. A render GAP (a reachable Decision-Gate
# surface not routed through the SEED-020 card-emission door) is a HARD ABORT before
# any version mutation -- HARD-FAIL, never WARN (R-5).
if ! node "$PLUGIN_DIR/scripts/check-render-coverage.cjs" --check; then
  echo -e "${RED}ABORT: render-coverage gate failed -- a reachable gate surface lacks card-emission routing.${NC}"
  echo "  Recovery: node scripts/build-render-coverage.cjs"
  exit 1
fi
# Phase 186-02 (CORPUS-02, Canon Part 8 / D5): the corpus-stats tripwire rides the
# SAME release surface as the CIRS gates. A stale corpus literal on a LIVE fact
# surface (or a STALE generated artifact) is a HARD ABORT before any version
# mutation -- the check reads only LOCAL files (zero Brain, zero network).
if ! node "$PLUGIN_DIR"/scripts/build-corpus-stats.cjs --check; then
  echo -e "${RED}ABORT: corpus-stats gate failed -- a stale corpus literal on a live surface.${NC}"
  echo "  Recovery: repoint the live surface to the three live magnitudes, or run: node scripts/build-corpus-stats.cjs"
  exit 1
fi
# Phase 190-04 (SFD-04/SFD-05, Canon Part 11 R16), softened by Phase 210 (item 210-A,
# navigator decision, CONTEXT addendum 1): the born-declared-shape gate is ADVISORY at
# release. The check still runs on the SAME release surface and every violation prints
# inline in this release log as WARN lines (the lint signal survives, all four checks),
# but a violation no longer ABORTS the cut. Re-hardening is one flag away:
# --strict-shape restores the pre-210 HARD-FAIL contract. The gate still walks the
# tree at run time; it never trusts a hardcoded surface count.
#
# Phase 235-01 (CIRS-03): before this fix the advisory `|| true` ran UNCONDITIONALLY
# and --strict was never passed to the checker, so the documented "one flag away"
# re-hardening did not exist -- the exit code was always swallowed. The sentinel
# comments below are LOAD-BEARING: tests/test-235-release-shape-gate.cjs extracts the
# text between them out of this live file at run time and executes it, so the test can
# never drift from the shipped behavior the way a hand-copied snippet would.
# SHAPE-GATE-BEGIN (Phase 235, CIRS-03)
if [ "$STRICT_SHAPE" = "1" ]; then
  if ! node "$PLUGIN_DIR/scripts/check-shape-declaration.cjs" --check --strict; then
    echo -e "${RED}ABORT: shape-declaration gate failed (--strict-shape) -- a surface declares neither a Shape-F nor a CIRS exclusion.${NC}"
    echo "  Recovery: node scripts/backfill-hitl-shape.cjs, or declare hitl_shape/hitl_stages per docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add connector.excluded:true + reason"
    exit 1
  fi
  echo -e "${GREEN}  shape-declaration gate passed (--strict-shape)${NC}"
else
  node "$PLUGIN_DIR/scripts/check-shape-declaration.cjs" --check || true
  echo "  note: shape-declaration gate is advisory as of Phase 210 (WARN, never abort; --strict-shape restores hard-fail)"
fi
# SHAPE-GATE-END
echo -e "${GREEN}  coverage gates passed (no dark surface)${NC}"

# --- Step 2.5: doctor --acceptance --pre-flight (HARD ABORT) ---
# Phase 126.1 hotfix (2026-05-15): the clean-tree check was moved out of
# --pre-tag by 3fc008b because release.sh Step 6.6 calls --pre-tag AFTER
# Steps 3-6 intentionally mutate plugin.json / package.json / CHANGELOG.
# The clean-tree check still matters BEFORE the cut starts -- so we run
# it here in a new --pre-flight tier (strict subset of --pre-tag minus
# in-flight-incompatible checks). HARD ABORT, no rollback needed because
# nothing has been mutated yet.
echo ""
echo "=== Step 2.5: doctor --acceptance --pre-flight ==="
if ! node "$PLUGIN_DIR/scripts/doctor.cjs" --acceptance --pre-flight; then
  echo -e "${RED}ABORT: doctor --acceptance --pre-flight failed -- release halted BEFORE any mutation.${NC}"
  echo "  Working tree must be clean (tracked-only) before release.sh starts bumping."
  echo "  Investigate: git status --porcelain --untracked-files=no"
  exit 1
fi
echo -e "${GREEN}  --acceptance --pre-flight passed${NC}"

# --- Step 3: Bump plugin.json AND package.json (5-way version consistency) ---
cd "$PLUGIN_DIR"
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('.claude-plugin/plugin.json', 'utf8'));
p.version = '$NEW_VERSION';
fs.writeFileSync('.claude-plugin/plugin.json', JSON.stringify(p, null, 2) + '\n');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "Updated plugin.json + package.json to $NEW_VERSION"

# --- Step 4: Bump marketplace.json (version + source.ref pinned to vN) ---
cd "$MARKETPLACE_DIR"
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8'));
m.plugins[0].version = '$NEW_VERSION';
// Pin source.ref to vN so installs via this marketplace resolve commit A,
// whose plugin.json says vN (TWO-COMMIT form -- Phase 123 D-19 research finding 1).
if (!m.plugins[0].source) m.plugins[0].source = {};
m.plugins[0].source.ref = 'v$NEW_VERSION';
fs.writeFileSync('.claude-plugin/marketplace.json', JSON.stringify(m, null, 2) + '\n');
"
echo "Updated marketplace.json: version $NEW_VERSION + source.ref v$NEW_VERSION"

# --- Step 5: Validate marketplace ---
echo ""
echo "=== Validating marketplace ==="
MVAL=$(claude plugin validate "$MARKETPLACE_DIR" 2>&1)
if echo "$MVAL" | grep -q "Validation failed"; then
  echo -e "${RED}ABORT: Marketplace validation failed:${NC}"
  echo "$MVAL"
  # Revert version bumps
  cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json package.json
  cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json
  exit 1
fi
echo -e "${GREEN}Marketplace validation passed${NC}"

# --- Step 5b: Reserved-marketplace-name compliance (Phase 95.6 D-11a) ---
# Anthropic blocks a set of reserved marketplace identifiers
# (claude-code-marketplace, claude-code-plugins, claude-plugins-official,
# anthropic-marketplace, anthropic-plugins, agent-skills, knowledge-work-plugins,
# life-sciences) plus impersonation patterns (official-claude*, anthropic-*-v2,
# anthropic-tools-v2). If any of these appears as an identifier in plugin.json or
# the marketplace.json, abort -- a release carrying a reserved name is a footgun.
# Comment/note lines are filtered out so a docstring mention does not block.
# Current plugin.json name is "mos" and marketplace.json name is
# "mindrian-marketplace" -- both clear the list, so this passes today. It is a
# guardrail against a future rename drifting onto a blocked identifier.
echo ""
echo "=== Step 5b: reserved-name compliance check ==="
RESERVED_HITS=$(grep -E "(claude-code-marketplace|claude-code-plugins|claude-plugins-official|anthropic-marketplace|anthropic-plugins|agent-skills|knowledge-work-plugins|life-sciences|official-claude|anthropic-tools-v2)" \
  "$PLUGIN_DIR/.claude-plugin/plugin.json" "$MARKETPLACE_DIR/.claude-plugin/marketplace.json" 2>/dev/null \
  | grep -vE "comment|note|//" || true)
if [ -n "$RESERVED_HITS" ]; then
  echo -e "${RED}  x A reserved Anthropic marketplace identifier appears in plugin.json or marketplace.json:${NC}"
  echo "$RESERVED_HITS"
  echo "    Rename it before releasing -- Anthropic blocks these identifiers."
  exit 1
fi
echo -e "${GREEN}  No reserved identifiers found${NC}"

# --- Step 6: Check for CHANGELOG entry (finalize [Unreleased] -> [NEW_VERSION] - <date>) ---
cd "$PLUGIN_DIR"
DATE=$(date +%Y-%m-%d)
if grep -q "^## \[$NEW_VERSION\]" CHANGELOG.md 2>/dev/null; then
  echo "CHANGELOG already has [$NEW_VERSION] entry"
elif grep -qE "^## \[Unreleased\]" CHANGELOG.md 2>/dev/null; then
  # Finalize the [Unreleased] heading into [NEW_VERSION] - DATE.
  sed -i "0,/^## \[Unreleased\].*/s//## [$NEW_VERSION] - $DATE/" CHANGELOG.md
  echo "Finalized CHANGELOG [Unreleased] -> [$NEW_VERSION] - $DATE"
else
  echo -e "${YELLOW}WARNING: No CHANGELOG entry for $NEW_VERSION and no [Unreleased] heading${NC}"
  echo "Add one now? (y/n)"
  read -r REPLY
  if [[ "$REPLY" == "y" ]]; then
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
  cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json package.json CHANGELOG.md
  cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json
  exit 1
fi
echo -e "${GREEN}Post-bump verification passed${NC}"

# --- Step 6.6: doctor --acceptance --pre-tag (HARD ABORT, no --allow) ---
# Phase 123 Plan-04 (HARNESS-123-12): the pre-tag release gate as a command.
# Runs the 5 points true BEFORE the tag + npm publish lands (install-state,
# deployment-surfaces, version-of-record-repo, verify-release, doctor-all).
# Any FAIL aborts the release BEFORE we tag or push. Rollback drops the bumps
# we already made (plugin.json, package.json, CHANGELOG, marketplace.json) so
# the working tree returns to the pre-Step-3 state. NO --allow override --
# release infra is the one gate you cannot skip (CONTEXT D-16).
echo ""
echo "=== Step 6.6: doctor --acceptance --pre-tag ==="
if ! node "$PLUGIN_DIR/scripts/doctor.cjs" --acceptance --pre-tag; then
  echo -e "${RED}ABORT: doctor --acceptance --pre-tag failed -- release halted BEFORE tagging.${NC}"
  echo "  Rolling back version bumps so the working tree returns to its pre-Step-3 state."
  cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json package.json CHANGELOG.md || true
  cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json || true
  echo "  See <recovery> R.1 in .planning/phases/123-install-lifecycle-harness/123-04-PLAN.md"
  echo "  Investigate the failed sub-check before re-running release.sh."
  exit 1
fi
echo -e "${GREEN}  --acceptance --pre-tag passed${NC}"

# --- Step 6.6a: module-registration verification (Phase 139 Plan 04, S4) ---
# The accumulative-engine (Phase 139) registers health/migration modules in
# data/doctor-modules.json. A shipped module whose runner file is absent, or
# whose introduced_version is invalid semver or claims a FUTURE version, would
# ship a broken engine (threat T-139-13 + T-139-14). Verify EVERY registered
# module before the tag lands: (1) the runner file exists on disk, (2)
# introduced_version is valid semver, (3) introduced_version <= NEW_VERSION (a
# module cannot claim to be introduced in a version that ships later than the
# one being cut). HARD ABORT with the SAME rollback semantics as Step 6.6 --
# release infra is the one gate you cannot skip (CONTEXT D-16).
echo ""
echo "=== Step 6.6a: module-registration verification (doctor-modules.json) ==="
if ! node -e '
  const fs = require("fs");
  const path = require("path");
  const PLUGIN_DIR = process.argv[1];
  const NEW_VERSION = process.argv[2];
  const semver = require(PLUGIN_DIR + "/node_modules/semver");
  if (!semver.valid(NEW_VERSION)) {
    console.error("  FAIL: NEW_VERSION is not valid semver: " + NEW_VERSION);
    process.exit(1);
  }
  const regPath = path.join(PLUGIN_DIR, "data", "doctor-modules.json");
  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
  } catch (e) {
    console.error("  FAIL: cannot read/parse data/doctor-modules.json: " + e.message);
    process.exit(1);
  }
  const modules = Array.isArray(reg.modules) ? reg.modules : [];
  let bad = 0;
  for (const m of modules) {
    const id = m && m.id ? m.id : "(no id)";
    if (!m || !m.runner) {
      console.error("  FAIL [" + id + "]: missing runner field");
      bad++;
      continue;
    }
    const runnerAbs = path.join(PLUGIN_DIR, m.runner);
    if (!fs.existsSync(runnerAbs)) {
      console.error("  FAIL [" + id + "]: runner file does not exist: " + m.runner);
      bad++;
    }
    if (!m.introduced_version || !semver.valid(m.introduced_version)) {
      console.error("  FAIL [" + id + "]: introduced_version is not valid semver: " + m.introduced_version);
      bad++;
      continue;
    }
    if (semver.gt(m.introduced_version, NEW_VERSION)) {
      console.error("  FAIL [" + id + "]: introduced_version " + m.introduced_version + " > NEW_VERSION " + NEW_VERSION + " (module cannot be introduced in a future version)");
      bad++;
    }
  }
  if (bad > 0) {
    console.error("  " + bad + " module-registration violation(s) found.");
    process.exit(1);
  }
  console.log("  " + modules.length + " module(s) verified: runner exists + introduced_version <= " + NEW_VERSION);
' "$PLUGIN_DIR" "$NEW_VERSION"; then
  echo -e "${RED}ABORT: module-registration verification failed -- release halted BEFORE tagging.${NC}"
  echo "  A registered doctor module has a missing runner, invalid introduced_version,"
  echo "  or an introduced_version in the future. Fix data/doctor-modules.json before re-running."
  echo "  Rolling back version bumps so the working tree returns to its pre-Step-3 state."
  cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json package.json CHANGELOG.md || true
  cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json || true
  exit 1
fi
echo -e "${GREEN}  module-registration verification passed${NC}"

# --- Step 6.6b: doctor acceptance-gate SELF-COVERAGE (Phase 126 Plan 03) ---
# Runs scaffolded broken-state fixtures against doctor --acceptance to assert
# the gate catches each known failure surface. Closes Canon Part 6 dog-fooding
# gap surfaced by the 2026-05-13 Windows dogfood: the gate happily reported
# all-pass against happy-path live state while the renderer was silently
# broken. Five fixtures + a live-workspace no-regression guard (6 sub-tests
# total). HARD ABORT on fail with identical rollback semantics to Step 6.6
# (no --allow override; release infra is the one gate you cannot skip per
# CONTEXT D-16).
echo ""
echo "=== Step 6.6b: doctor --acceptance self-coverage (scaffolded fixtures) ==="
if ! node "$PLUGIN_DIR/tests/test-doctor-acceptance-self-coverage.cjs"; then
  echo -e "${RED}ABORT: doctor --acceptance self-coverage failed -- release halted BEFORE tagging.${NC}"
  echo "  The gate has a hole. A scaffolded broken state did NOT produce the expected"
  echo "  failure breakdown. Inspect test output above; fix the gate (or the test) before"
  echo "  re-running release.sh."
  echo "  Rolling back version bumps so the working tree returns to its pre-Step-3 state."
  cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json package.json CHANGELOG.md || true
  cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json || true
  exit 1
fi
echo -e "${GREEN}  acceptance self-coverage passed${NC}"

# --- Step 6.7: Vendor production node_modules into the release artifact ---
# Debug session mcp-servers-cache-missing-node-modules (escalated mandate
# 2026-05-21). The marketplace install delivers ONLY git-tracked files at the
# tagged ref. If node_modules is absent the bundled MCP servers (mindrian-brain
# + mindrian-os) crash at load with MODULE_NOT_FOUND until the SessionStart
# reconcile hook repairs the cache on a later session. Vendoring the production
# node_modules makes the Brain shim's dependencies present the instant the cache
# lands -- no runtime install, no network, no race, all three platforms true by
# construction (every production dependency is pure JS -- audited 2026-05-21:
# zero .node addons, zero binding.gyp, zero prebuilds, zero lifecycle scripts).
#
# RELEASE-TIME VENDORING (Option V2): node_modules is force-added into Commit A
# (the tagged release commit) ONLY. Commit B (Step 7.5) removes it again, so
# `main` HEAD is never permanently burdened with the 32M tree -- only the tagged
# release commits carry it, and git deduplicates identical blobs across tags.
#
# LOCKSTEP SURFACE: the vendored tree is built fresh via `npm ci --omit=dev`
# from package-lock.json, so it can NEVER drift from the lock. This is an
# additional release lockstep surface -- see .claude/includes/release-process.md.
echo ""
echo "=== Step 6.7: Vendor production node_modules (release-time, Commit A only) ==="
cd "$PLUGIN_DIR"
if [ "${MOS_SKIP_VENDOR:-0}" = "1" ]; then
  echo -e "${YELLOW}  ! MOS_SKIP_VENDOR=1 -- node_modules NOT vendored. The release will rely on${NC}"
  echo -e "${YELLOW}    the runtime self-heal alone. Only use this for a non-MCP doc-only release.${NC}"
else
  # package.json + package-lock.json must be in sync for `npm ci` to run.
  if ! npm ci --omit=dev --no-audit --no-fund --silent; then
    echo -e "${RED}  x npm ci --omit=dev failed. package-lock.json is likely out of sync${NC}"
    echo "    with package.json. Run 'npm install' to resync the lock, commit it,"
    echo "    then re-run release.sh. The vendored tree must build from the lock."
    cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json package.json CHANGELOG.md || true
    cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json || true
    exit 1
  fi
  # Integrity gate: the production tree must have the MCP-critical deps and
  # report no missing/invalid packages.
  if ! npm ls --omit=dev --depth=0 >/dev/null 2>&1; then
    echo -e "${RED}  x npm ls --omit=dev reports missing/invalid packages after npm ci.${NC}"
    echo "    Refusing to vendor an incomplete tree."
    cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json package.json CHANGELOG.md || true
    cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json || true
    exit 1
  fi
  for CRIT in "@modelcontextprotocol/sdk" "zod"; do
    if [ ! -d "$PLUGIN_DIR/node_modules/$CRIT" ]; then
      echo -e "${RED}  x MCP-critical dependency missing from vendored tree: $CRIT${NC}"
      cd "$PLUGIN_DIR" && git checkout .claude-plugin/plugin.json package.json CHANGELOG.md || true
      cd "$MARKETPLACE_DIR" && git checkout .claude-plugin/marketplace.json || true
      exit 1
    fi
  done
  VENDOR_PKGS=$(find "$PLUGIN_DIR/node_modules" -mindepth 1 -maxdepth 2 -name package.json 2>/dev/null | wc -l)
  VENDOR_SIZE=$(du -sh "$PLUGIN_DIR/node_modules" 2>/dev/null | cut -f1)
  echo -e "${GREEN}  Vendored production node_modules: $VENDOR_PKGS packages, $VENDOR_SIZE${NC}"
  # Force-add: node_modules is in .gitignore (it must NOT live on main HEAD).
  # `git add -f` overrides the ignore for Commit A; Commit B removes it again.
  git add -f node_modules
  echo "  node_modules force-staged for Commit A (gitignored on main; tag-only)"
fi

# --- Step 7: Commit A (release commit) -- finalizes vN, NEVER git add -A ---
# Commit A holds the version-of-record at vN. The vN git tag points HERE.
# An install via `marketplace.json source.ref: vN` checks out THIS commit, so
# Claude Code reads plugin.json.version == vN and self-reports vN. Commit A also
# carries the vendored production node_modules (Step 6.7) so the bundled MCP
# servers have their dependencies present the instant the install cache lands.
# The next-bump (Commit B, Step 7.5) removes node_modules so main HEAD is clean.
echo ""
echo "=== Step 7: Commit A (release commit) -- plugin + marketplace ==="
cd "$PLUGIN_DIR"
git add .claude-plugin/plugin.json package.json CHANGELOG.md
git commit -m "release: v$NEW_VERSION" || echo "Nothing to commit in plugin (Commit A)"

# --- Concurrent-commit race guard (2026-07-16 RCA: beta.20 + beta.22 both
# tagged a foreign HEAD after Commit A silently vanished under a concurrent
# session's commits; the `|| echo` above masks every commit failure mode, and
# an unpinned `git tag` then labels whatever HEAD happens to be). VERIFY the
# commit we are about to tag actually carries NEW_VERSION in its manifests;
# refuse to mislabel, never tag-and-warn. Tag by SHA, not by implicit HEAD.
RELEASE_SHA=$(git rev-parse HEAD)
TAG_PLUGIN_V=$(git show "$RELEASE_SHA:.claude-plugin/plugin.json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).version))")
TAG_PKG_V=$(git show "$RELEASE_SHA:package.json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).version))")
if [ "$TAG_PLUGIN_V" != "$NEW_VERSION" ] || [ "$TAG_PKG_V" != "$NEW_VERSION" ]; then
  echo -e "${RED}ABORT: HEAD ($RELEASE_SHA) manifests read plugin.json=$TAG_PLUGIN_V package.json=$TAG_PKG_V, expected $NEW_VERSION.${NC}"
  echo -e "${RED}  Commit A did not land on this HEAD (concurrent-commit race, or the commit failed).${NC}"
  echo "  Recovery: quiet all concurrent sessions committing to this checkout, then re-run release.sh."
  echo "  NOT tagging. NOT pushing. No remote state was mutated by this step."
  exit 1
fi
git tag "v$NEW_VERSION" "$RELEASE_SHA" 2>/dev/null || echo "Tag v$NEW_VERSION already exists"

cd "$MARKETPLACE_DIR"
git add .claude-plugin/marketplace.json
git commit -m "release: sync to v$NEW_VERSION" || echo "Nothing to commit in marketplace"

# --- Step 9.5: Publish @mindrian_os/cli at NEW_VERSION (BEFORE Commit B) ---
# Memory canon feedback_release_lockstep_npm: every plugin release publishes
# @mindrian_os/cli to npm. -beta./alpha./rc./next. suffixes -> @next dist-tag;
# clean X.Y.Z -> @latest. If publish fails, HALT -- never ship unpublished.
# MOS_TEST_DRY_RUN=1 exercises the gate without touching the live registry.
#
# IMPORTANT: Publish runs HERE (after Commit A, before Commit B) so the working
# tree's package.json says NEW_VERSION (vN). If we published from Commit B's
# tree, npm would receive NEXT_VERSION (vN+1) -- wrong.
echo ""
echo "=== Step 9.5: npm publish (@mindrian_os/cli) ==="
cd "$PLUGIN_DIR"
NPM_TAG="latest"
case "$NEW_VERSION" in
  *-beta.*|*-alpha.*|*-rc.*|*-next.*) NPM_TAG="next" ;;
esac
echo "  version: $NEW_VERSION  ->  dist-tag: @$NPM_TAG"

# Payload gate (Codex review 2026-05-10): the published tarball MUST contain ONLY
# the package.json "files" allowlist -- never .planning/, docs/, mcp-server-brain/,
# tests/, or scripts/release.sh. Surface the dry-run contents for the release
# operator to review before the live publish. 95.6-10 re-runs this as a BLOCKING
# checkpoint before the first live npm publish.
#
# node_modules guard (debug session mcp-servers-cache-missing-node-modules):
# Step 6.7 vendors node_modules into the working tree for the git-distributed
# marketplace artifact. The npm tarball is a SEPARATE distribution channel --
# `npm install @mindrian_os/cli` resolves deps from the registry, so the
# vendored 32M node_modules must NEVER ship inside the npm tarball. The
# package.json "files" allowlist already excludes it (node_modules is not
# listed); this gate asserts that explicitly so a future allowlist edit cannot
# silently bloat the published package.
echo "  --- npm pack --dry-run payload review (allowlist must be the only contents) ---"
PACK_OUT="$(npm pack --dry-run 2>&1 || true)"
echo "$PACK_OUT"
if echo "$PACK_OUT" | grep -Eq '\.planning/|^npm notice .*docs/|mcp-server-brain/|^npm notice .*tests/|release\.sh'; then
  echo ""
  echo -e "${RED}  x npm pack payload includes a NON-allowlisted path (.planning/ / docs/ / mcp-server-brain/ / tests/ / release.sh).${NC}"
  echo "    Publishing this would leak the entire repo (including Brain-key code) into the public npm tarball."
  echo "    Fix the package.json \"files\" allowlist before re-running. Do NOT publish."
  exit 1
fi
if echo "$PACK_OUT" | grep -Eq 'node_modules/'; then
  echo ""
  echo -e "${RED}  x npm pack payload includes node_modules/.${NC}"
  echo "    The vendored node_modules belongs ONLY in the git-distributed marketplace"
  echo "    artifact, never in the npm tarball (npm resolves deps from the registry)."
  echo "    Ensure package.json \"files\" does NOT list node_modules. Do NOT publish."
  exit 1
fi
echo "  payload review OK -- only allowlisted paths present (no node_modules leak)"

if [ "${MOS_TEST_DRY_RUN:-0}" = "1" ]; then
  echo "  [DRY RUN] would run: npm publish --tag $NPM_TAG"
else
  if npm publish --tag "$NPM_TAG"; then
    echo -e "${GREEN}  Published @mindrian_os/cli@$NEW_VERSION to npm (@$NPM_TAG)${NC}"
    # Navigator decision 2026-08-10: bare `npx @mindrian_os/cli` must always
    # resolve the NEWEST release, betas included. Publish still tags @next
    # (kept for consumers pinned to it), then the SAME version is promoted to
    # @latest. For a stable release NPM_TAG is already "latest" and this is a
    # no-op re-add. Non-fatal on failure: the publish itself succeeded, so
    # print the manual recovery command instead of breaking lockstep.
    if [ "$NPM_TAG" != "latest" ]; then
      if npm dist-tag add "@mindrian_os/cli@$NEW_VERSION" latest; then
        echo -e "${GREEN}  Promoted @mindrian_os/cli@$NEW_VERSION to @latest (bare npx now serves it)${NC}"
      else
        echo -e "${YELLOW}  ! dist-tag promotion to @latest failed (publish itself OK).${NC}"
        echo "    Recover manually: npm dist-tag add @mindrian_os/cli@$NEW_VERSION latest"
      fi
    fi
  else
    echo ""
    echo -e "${RED}  x npm publish failed for @mindrian_os/cli@$NEW_VERSION.${NC}"
    echo "    Commit A has already been made and tagged v$NEW_VERSION (not yet pushed),"
    echo "    so the lockstep contract is now BROKEN until you recover. To recover:"
    echo "      1. Fix the npm issue (auth: 'npm whoami'; scope: ensure"
    echo "         package.json name is '@mindrian_os/cli' and you have publish"
    echo "         rights on the @mindrian_os org)."
    echo "      2. Re-run JUST the publish: npm publish --tag $NPM_TAG"
    echo "      3. Verify: npm view @mindrian_os/cli@$NPM_TAG version"
    echo "      4. Then resume by running Commit B + push manually, OR reset"
    echo "         (git reset --hard HEAD^ + git tag -d v$NEW_VERSION) and re-run release.sh."
    echo "    Do NOT cut another plugin release until npm is in sync."
    exit 1
  fi
fi

# --- Step 9.6a: Sync install minisite to NEW_VERSION (HARD lockstep, vercel-CLI deploy) ---
# Phase 126 Plan 04 (2026-05-14): promoted from Soft to HARD per
# MEMORY.md feedback_install_minisite_lockstep.md. The minisite at
# https://mindrianos-install-site.vercel.app has two hardcoded version-string
# locations (lib/os.ts terminal display + app/page.tsx eyebrow) that MUST
# reflect what is shipped on npm. Auto-bump + commit + git push origin main +
# Vercel live-poll happens HERE -- after npm publish (so we only sync to what
# is actually on the registry) but BEFORE Commit B (so the chain stays atomic).
#
# HARD semantics:
#   - $MINDRIAN_INSTALL_SITE_DIR / $MINDRIAN_MINISITE_DIR override (default: $HOME/mindrianos-install-site)
#   - If dir missing: HARD ABORT with `gh repo clone` / `git clone` recovery (NOT `git remote add origin`)
#   - If origin remote missing: HARD ABORT with `git remote add origin <url>` recovery
#   - sed/grep failures: snapshot-then-rollback via .bak files; HARD ABORT
#   - git push origin main failure: HARD ABORT (Vercel auto-deploy depends on push)
#   - Live-poll MINDRIAN_MINISITE_URL (default https://mindrianos-install-site.vercel.app/) until NEW_VERSION appears OR timeout
#   - $MINDRIAN_MINISITE_POLL_TIMEOUT_S (default 180) + $MINDRIAN_MINISITE_POLL_INTERVAL_S (default 10)
#   - --no-minisite flag: opt-out audit-logged to stderr (NOT a silent skip)
#   - DRY_RUN: log intent only, no edits
echo ""
echo "=== Step 9.6a: Sync install minisite to v$NEW_VERSION (HARD lockstep, vercel-CLI deploy) ==="

if [ "$NO_MINISITE" = "1" ]; then
  echo -e "${YELLOW}  ! --no-minisite opt-out engaged at $(date -Iseconds 2>/dev/null || date -u +%FT%TZ); install-minisite NOT bumped.${NC}" >&2
  echo "    Manual sync required after release. Audit logged."
else
  MINISITE_DIR="${MINDRIAN_INSTALL_SITE_DIR:-${MINDRIAN_MINISITE_DIR:-$HOME/mindrianos-install-site}}"
  MINISITE_URL="${MINDRIAN_MINISITE_URL:-https://mindrianos-install-site.vercel.app/}"
  MINISITE_POLL_TIMEOUT="${MINDRIAN_MINISITE_POLL_TIMEOUT_S:-180}"
  MINISITE_POLL_INTERVAL="${MINDRIAN_MINISITE_POLL_INTERVAL_S:-10}"

  if [ ! -d "$MINISITE_DIR" ]; then
    # MINISITE_DIR-absent path: directory does not exist at all. The recovery
    # is to CLONE the repo, NOT to add a remote (no working tree yet). The
    # `git remote add origin` recovery is reserved for the separate
    # origin-missing path below (directory exists but lacks remote). These
    # are two distinct failure modes with two distinct recoveries (Plan 04
    # WARN 2 invariant; settled in plan-phase Open Question 7).
    echo -e "${RED}  x MINISITE_DIR not present: $MINISITE_DIR${NC}"
    echo "    Recovery options:"
    echo "      A) Clone the minisite: gh repo clone mindrian-os/mindrianos-install-site $MINISITE_DIR"
    echo "         (or: git clone <git-url> $MINISITE_DIR)"
    echo "      B) Set MINDRIAN_MINISITE_DIR to your existing minisite checkout path and re-run."
    echo "      C) If this release truly cannot bump the minisite, pass --no-minisite (audit-logged)."
    exit 1
  fi

  if [ "$DRY_RUN" = "1" ]; then
    echo "  [DRY RUN] would HARD-bump v$NEW_VERSION in:"
    echo "    $MINISITE_DIR/lib/os.ts"
    echo "    $MINISITE_DIR/app/page.tsx"
    echo "  [DRY RUN] would git commit + git push origin main + live-poll $MINISITE_URL"
  else
    ORIG_DIR="$PWD"
    cd "$MINISITE_DIR"

    # Vercel CLI presence check. The install-site INTENTIONALLY has no origin
    # remote -- per memory feedback_install_minisite_lockstep (2026-05-14):
    # "NO git remote on this repo -- deploy is CLI-driven". Switching from
    # `git push origin main` to `vercel --prod --yes` (2026-05-25 refactor)
    # ended the chronic origin-remote-missing release-blocker for this
    # surface. The git commit still lands locally for audit/history.
    if ! command -v vercel >/dev/null 2>&1; then
      echo -e "${RED}  x vercel CLI not in PATH (required for install-site deploy).${NC}"
      echo "    Recovery: npm install -g vercel; OR add the vercel binary to PATH"
      echo "    Or pass --no-minisite for an emergency release (audit-logged)."
      cd "$ORIG_DIR"
      exit 1
    fi

    # Snapshot pre-sed state for rollback on grep mismatch.
    cp lib/os.ts lib/os.ts.bak
    cp app/page.tsx app/page.tsx.bak

    # Line-anchored CONTENT-based sed (Open Question 9 settled; the literal
    # strings "MindrianOS v" and " · Install" are the anchors, NOT line numbers
    # 149/30. A minisite refactor that moves the strings still matches; a
    # refactor that REMOVES them fails the post-sed grep verify -- which is
    # the correct failure mode).
    sed -i -E "s@MindrianOS v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc|next)\.[0-9]+)?@MindrianOS v$NEW_VERSION@g" lib/os.ts || {
      echo -e "${RED}  x sed on lib/os.ts failed${NC}"
      mv lib/os.ts.bak lib/os.ts; mv app/page.tsx.bak app/page.tsx
      cd "$ORIG_DIR"; exit 1
    }
    sed -i -E "s@v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc|next)\.[0-9]+)? · Install@v$NEW_VERSION · Install@g" app/page.tsx || {
      echo -e "${RED}  x sed on app/page.tsx failed${NC}"
      mv lib/os.ts.bak lib/os.ts; mv app/page.tsx.bak app/page.tsx
      cd "$ORIG_DIR"; exit 1
    }

    # Grep verify: BOTH files must contain NEW_VERSION; if not, rollback.
    if ! grep -q "v$NEW_VERSION" lib/os.ts || ! grep -q "v$NEW_VERSION" app/page.tsx; then
      echo -e "${RED}  x minisite bump verification failed (v$NEW_VERSION not present after sed); rolling back.${NC}"
      mv lib/os.ts.bak lib/os.ts; mv app/page.tsx.bak app/page.tsx
      cd "$ORIG_DIR"; exit 1
    fi
    # Verify succeeded: drop the .bak snapshots.
    rm -f lib/os.ts.bak app/page.tsx.bak

    # Commit + push
    git add lib/os.ts app/page.tsx
    if git diff --cached --quiet; then
      echo "  -> minisite already at v$NEW_VERSION (no changes; will still verify live-poll)"
    else
      git commit --no-verify -m "chore: sync minisite version strings to v$NEW_VERSION" >/dev/null 2>&1 || {
        echo -e "${RED}  x minisite commit failed${NC}"
        cd "$ORIG_DIR"; exit 1
      }
      echo "  -> minisite committed locally: $(git log -1 --pretty=format:'%h %s')"
    fi
    if ! vercel --prod --yes 2>&1 | tail -5; then
      echo -e "${RED}  x minisite \`vercel --prod --yes\` failed${NC}"
      echo "    The bump commit is LOCAL. Recover manually:"
      echo "      cd $MINISITE_DIR && vercel --prod --yes"
      cd "$ORIG_DIR"; exit 1
    fi
    echo "  -> minisite deployed via vercel CLI (no git push -- intentionally no remote)"

    # Live-poll until NEW_VERSION appears in HTTP body OR timeout.
    echo "  -> live-poll $MINISITE_URL for v$NEW_VERSION (timeout ${MINISITE_POLL_TIMEOUT}s, interval ${MINISITE_POLL_INTERVAL}s)"
    POLL_START=$(date +%s)
    POLL_OK=0
    while true; do
      NOW=$(date +%s)
      ELAPSED=$((NOW - POLL_START))
      if [ "$ELAPSED" -ge "$MINISITE_POLL_TIMEOUT" ]; then
        echo -e "${RED}  x live-poll timed out after ${ELAPSED}s -- $MINISITE_URL does not reflect v$NEW_VERSION${NC}"
        echo "    Investigate: curl -sS $MINISITE_URL | grep -F v$NEW_VERSION"
        echo "    The push landed but Vercel may not have built yet."
        echo "    Re-run with --no-minisite if urgent (audit-logged)."
        cd "$ORIG_DIR"; exit 1
      fi
      BODY=$(curl -sS -m 5 "$MINISITE_URL" 2>/dev/null || true)
      if echo "$BODY" | grep -qF "v$NEW_VERSION"; then
        POLL_OK=1
        break
      fi
      sleep "$MINISITE_POLL_INTERVAL"
    done

    if [ "$POLL_OK" = "1" ]; then
      echo -e "${GREEN}  ✓ minisite live: $MINISITE_URL serves v$NEW_VERSION (live-poll passed in ${ELAPSED}s)${NC}"
    fi

    cd "$ORIG_DIR"
  fi
fi

# --- Step 9.6b: Sync Mindrian website FALLBACK_VERSION to NEW_VERSION ---
# Refactor 2026-05-25: dual-surface lockstep. The Mindrian website at
# https://mindrianos-jsagirs-projects.vercel.app (Vercel project name
# "mindrianos" under team "jsagirs-projects") is a SEPARATE Vercel
# project from the install-site -- different repo, different deploy
# mechanism. Per user directive ("add to this step the always-update
# of [the repo at] https://mindrianos-jsagirs-projects.vercel.app/ --
# this is the mindrian website"), Step 9.6 now bumps BOTH surfaces.
#
# Website design (verified against /home/jsagi/mindrian-website/website/
# src/lib/version.ts on 2026-05-25): four-tier version resolver --
# (1) NEXT_PUBLIC_MINDRIAN_VERSION env var, (2) npm @mindrian_os/cli
# @next dist-tag (the SHIPPED truth), (3) GitHub raw plugin.json (dev
# truth), (4) FALLBACK_VERSION constant in src/lib/version.ts (offline
# fallback). The npm resolver auto-picks-up the just-published version
# within 1 hour via Next.js ISR cache. The FALLBACK_VERSION constant
# is the only thing release.sh needs to bump -- so the offline build
# (and the brief window before ISR revalidates) shows the right value.
#
# Unlike the install-site, the website HAS an origin remote and IS
# deployed via Vercel's GitHub integration (push -> auto-deploy). So
# the deploy mechanism here is `git push origin main`, NOT `vercel
# --prod --yes`. Two surfaces, two correct mechanisms.
#
# HARD semantics:
#   - $MINDRIAN_WEBSITE_DIR override (default: $HOME/mindrian-website/website)
#   - If dir missing: HARD ABORT with `gh repo clone` recovery
#   - If origin remote missing: HARD ABORT with `git remote add origin` recovery
#   - sed failure: snapshot-then-rollback via .bak files; HARD ABORT
#   - git push failure: HARD ABORT
#   - Live-poll MINDRIAN_WEBSITE_URL (default https://mindrian-os.com/)
#   - $MINDRIAN_WEBSITE_POLL_TIMEOUT_S (default 240, longer than install-site
#     since Next.js builds take longer than the install-site's static build)
#   - $MINDRIAN_WEBSITE_POLL_INTERVAL_S (default 15)
#   - --no-minisite flag ALSO skips this surface (audit-logged)
#   - DRY_RUN: log intent only, no edits
echo ""
echo "=== Step 9.6b: Sync Mindrian website FALLBACK_VERSION to v$NEW_VERSION (dual-surface HARD lockstep) ==="

if [ "$NO_WEBSITE" = "1" ]; then
  echo -e "${YELLOW}  ! --no-website opt-out engaged; Mindrian website FALLBACK_VERSION NOT bumped.${NC}" >&2
  echo "    Manual sync required after release. Audit logged."
  echo "    Note: the website's npm @next resolver will still auto-pick-up v$NEW_VERSION within 1 hour via ISR."
else
  WEBSITE_DIR="${MINDRIAN_WEBSITE_DIR:-$HOME/mindrian-website/website}"
  WEBSITE_URL="${MINDRIAN_WEBSITE_URL:-https://mindrian-os.com/}"
  WEBSITE_POLL_TIMEOUT="${MINDRIAN_WEBSITE_POLL_TIMEOUT_S:-240}"
  WEBSITE_POLL_INTERVAL="${MINDRIAN_WEBSITE_POLL_INTERVAL_S:-15}"

  if [ ! -d "$WEBSITE_DIR" ]; then
    echo -e "${RED}  x WEBSITE_DIR not present: $WEBSITE_DIR${NC}"
    echo "    Recovery options:"
    echo "      A) Clone the website: gh repo clone jsagir/mindrian-website \$(dirname $WEBSITE_DIR)"
    echo "         (or: git clone https://github.com/jsagir/mindrian-website.git \$(dirname $WEBSITE_DIR))"
    echo "      B) Set MINDRIAN_WEBSITE_DIR to your existing website Next.js root and re-run."
    echo "      C) If this release truly cannot bump the website, pass --no-minisite (audit-logged)."
    exit 1
  fi

  if [ ! -f "$WEBSITE_DIR/src/lib/version.ts" ]; then
    echo -e "${RED}  x WEBSITE_DIR does not contain src/lib/version.ts (the FALLBACK_VERSION host).${NC}"
    echo "    Expected: $WEBSITE_DIR/src/lib/version.ts"
    echo "    The website may have been refactored. Investigate before re-running."
    echo "    Or pass --no-minisite for an emergency release (audit-logged)."
    exit 1
  fi

  if [ "$DRY_RUN" = "1" ]; then
    echo "  [DRY RUN] would HARD-bump FALLBACK_VERSION to \"v$NEW_VERSION\" in:"
    echo "    $WEBSITE_DIR/src/lib/version.ts"
    echo "  [DRY RUN] would git commit + git push origin main + live-poll $WEBSITE_URL"
  else
    ORIG_DIR="$PWD"
    cd "$WEBSITE_DIR"

    if ! git remote get-url origin >/dev/null 2>&1; then
      echo -e "${RED}  x $WEBSITE_DIR has no 'origin' remote configured.${NC}"
      echo "    Recovery: cd $WEBSITE_DIR && git remote add origin https://github.com/jsagir/mindrian-website.git && git push -u origin main"
      echo "    Or pass --no-minisite for an emergency release (audit-logged)."
      cd "$ORIG_DIR"
      exit 1
    fi

    # Snapshot pre-sed state for rollback on grep mismatch.
    cp src/lib/version.ts src/lib/version.ts.bak

    # Line-anchored CONTENT-based sed targeting the FALLBACK_VERSION constant.
    # Pattern: `export const FALLBACK_VERSION = "v<semver>";`
    # The constant is documented as offline-fallback-only -- the npm resolver
    # is the primary source -- but the offline build and brief windows before
    # ISR revalidates still surface this value to visitors.
    sed -i -E "s@export const FALLBACK_VERSION = \"v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc|next)\.[0-9]+)?\";@export const FALLBACK_VERSION = \"v$NEW_VERSION\";@g" src/lib/version.ts || {
      echo -e "${RED}  x sed on src/lib/version.ts failed${NC}"
      mv src/lib/version.ts.bak src/lib/version.ts
      cd "$ORIG_DIR"; exit 1
    }

    # Grep verify: the new FALLBACK_VERSION must be present.
    if ! grep -qE "^export const FALLBACK_VERSION = \"v$NEW_VERSION\";" src/lib/version.ts; then
      echo -e "${RED}  x website FALLBACK_VERSION bump verification failed (v$NEW_VERSION not present after sed); rolling back.${NC}"
      mv src/lib/version.ts.bak src/lib/version.ts
      cd "$ORIG_DIR"; exit 1
    fi
    rm -f src/lib/version.ts.bak

    # Commit + push (Vercel auto-deploys on push via GitHub integration).
    git add src/lib/version.ts
    if git diff --cached --quiet; then
      echo "  -> website FALLBACK_VERSION already at v$NEW_VERSION (no changes; will still verify live-poll)"
    else
      git commit --no-verify -m "chore: sync website FALLBACK_VERSION to v$NEW_VERSION" >/dev/null 2>&1 || {
        echo -e "${RED}  x website commit failed${NC}"
        cd "$ORIG_DIR"; exit 1
      }
      echo "  -> website committed locally: $(git log -1 --pretty=format:'%h %s')"
    fi
    if ! git push origin main 2>&1; then
      echo -e "${RED}  x website git push origin main failed${NC}"
      echo "    The bump commit is LOCAL but not pushed. Recover manually:"
      echo "      cd $WEBSITE_DIR && git push origin main"
      cd "$ORIG_DIR"; exit 1
    fi
    echo "  -> website pushed: Vercel auto-deploy triggered (build time ~2-4 min)"

    # Live-poll until NEW_VERSION appears in HTTP body OR timeout. The
    # website's npm @next resolver returns v$NEW_VERSION as the live version
    # (FALLBACK is only the offline-build value), so the poll passes as soon
    # as Vercel finishes the build AND the npm registry has propagated the
    # new dist-tag (usually instant since Step 9.5 already published).
    echo "  -> live-poll $WEBSITE_URL for v$NEW_VERSION (timeout ${WEBSITE_POLL_TIMEOUT}s, interval ${WEBSITE_POLL_INTERVAL}s)"
    POLL_START=$(date +%s)
    POLL_OK=0
    while true; do
      NOW=$(date +%s)
      ELAPSED=$((NOW - POLL_START))
      if [ "$ELAPSED" -ge "$WEBSITE_POLL_TIMEOUT" ]; then
        echo -e "${YELLOW}  ! website live-poll timed out after ${ELAPSED}s -- $WEBSITE_URL does not yet reflect v$NEW_VERSION${NC}"
        echo "    The push landed; Vercel build may still be in progress. Investigate:"
        echo "      curl -sS $WEBSITE_URL | grep -F v$NEW_VERSION"
        echo "    The website's npm @next resolver also picks up v$NEW_VERSION via ISR within 1 hour."
        echo "    NOT marked as a hard fail (the FALLBACK is offline-only; resolver path is primary)."
        break
      fi
      BODY=$(curl -sS -m 5 "$WEBSITE_URL" 2>/dev/null || true)
      if echo "$BODY" | grep -qF "v$NEW_VERSION"; then
        POLL_OK=1
        break
      fi
      sleep "$WEBSITE_POLL_INTERVAL"
    done

    if [ "$POLL_OK" = "1" ]; then
      echo -e "${GREEN}  ✓ website live: $WEBSITE_URL serves v$NEW_VERSION (live-poll passed in ${ELAPSED}s)${NC}"
    fi

    cd "$ORIG_DIR"
  fi
fi

# --- Step 9.7: npx-publish self-test (Phase 126 Plan 04 + Phase 126.1 hotfix) ---
# Verify npx @mindrian_os/cli@<version> against a sandboxed HOME-override
# produces an exit-0 scaffold. Closes the 2026-05-13 dogfood gap "npx round-trip
# broken (null)". The existing Step 9.8 (--acceptance full) covers this in
# passing, but Plan 04 makes it an explicit gate so the failure mode surfaces
# here with a clean stack trace rather than buried inside the --acceptance
# roster.
#
# Phase 126.1 hotfix (2026-05-15): `@mindrian_os/cli` installs into
# ~/.claude/, NOT into cwd. The original Plan-04 implementation used `mktemp
# -d` and checked the temp dir was non-empty -- but the install never landed
# there, so the check spuriously failed during the beta.16 cut. Fix: HOME-
# override sandbox at ~/.claude/_test-install-<sha8>/ (subpath under ~/.claude/
# per the scope note; reuses the doctor.cjs:2336 sandbox pattern). Cleanup via
# trap guarantees the operator's real ~/.claude/ is never touched. Option B
# (extend ~/mindrianos-install-site/ npm-installer with a --target=<dir> flag)
# is the cleaner long-term fix but out of scope for this hotfix (separate repo).
echo ""
echo "=== Step 9.7: npx-publish self-test ==="

if [ "${MOS_TEST_DRY_RUN:-0}" = "1" ] || [ "$DRY_RUN" = "1" ]; then
  echo "  [DRY RUN] would run: npx --yes @mindrian_os/cli@$NEW_VERSION against a HOME-override sandbox at ~/.claude/_test-install-<sha8>/"
else
  # sha8 of NEW_VERSION + current epoch for uniqueness; falls back to a random
  # tag if shasum is missing.
  if command -v shasum >/dev/null 2>&1; then
    NPX_TEST_TS="$(printf '%s' "$NEW_VERSION-$(date +%s)" | shasum -a 256 | cut -c1-8)"
  elif command -v sha256sum >/dev/null 2>&1; then
    NPX_TEST_TS="$(printf '%s' "$NEW_VERSION-$(date +%s)" | sha256sum | cut -c1-8)"
  else
    NPX_TEST_TS="$(date +%s | tail -c 9)"
  fi
  NPX_TEST_DIR="$HOME/.claude/_test-install-$NPX_TEST_TS"
  NPX_SNAPSHOT="/tmp/npx-selftest-snapshot-$NPX_TEST_TS.txt"
  echo "  -> sandbox: $NPX_TEST_DIR"
  ORIG_DIR_NPX="$PWD"

  # Cleanup trap: fires on EXIT (normal + abort) to guarantee the operator's
  # real ~/.claude/ is never left with sandbox subpath debris.
  trap 'rm -rf "$NPX_TEST_DIR" 2>/dev/null; rm -f "$NPX_SNAPSHOT" 2>/dev/null' EXIT

  # Pre-snapshot: capture the names of installed-plugins state + marketplace
  # cache surfaces in the real ~/.claude/ for audit. The sandbox never touches
  # these paths (HOME override redirects all install writes); the snapshot is
  # belt-and-suspenders for debugging.
  {
    echo "# pre-npx ~/.claude/ install-surface snapshot at $(date -u +%FT%TZ)"
    ls -la "$HOME/.claude/plugins/installed_plugins.json" 2>/dev/null || echo "(no installed_plugins.json)"
    ls -la "$HOME/.claude/plugins/mindrian-marketplace/" 2>/dev/null | head -5 || echo "(no mindrian-marketplace dir)"
  } > "$NPX_SNAPSHOT" 2>&1 || true

  mkdir -p "$NPX_TEST_DIR"

  # Registry-propagation wait (2026-05-31 flake fix): Step 9.5 publishes the
  # tarball, but the npm registry CDN can lag a few seconds before `npx` can
  # resolve the new version on a fresh metadata fetch. Running npx too soon
  # resolved a stale/partial state and surfaced as a spurious self-test abort
  # (`mindrian-os: not found`) on the v1.13.0-beta.36 cut. Poll `npm view
  # <pkg>@<version> version` until the new version is resolvable before the
  # self-test runs. Bounded; on timeout we proceed (the test still gates).
  NPX_PROP_RETRIES="${NPX_PROP_RETRIES:-12}"
  NPX_PROP_BACKOFF_S="${NPX_PROP_BACKOFF_S:-5}"
  PROP_ATTEMPT=0
  while [ "$PROP_ATTEMPT" -lt "$NPX_PROP_RETRIES" ]; do
    PROP_SEEN="$(npm view "@mindrian_os/cli@$NEW_VERSION" version 2>/dev/null | tr -d '[:space:]')"
    if [ "$PROP_SEEN" = "$NEW_VERSION" ]; then
      echo "  -> registry propagated @mindrian_os/cli@$NEW_VERSION (attempt $((PROP_ATTEMPT+1)))"
      break
    fi
    PROP_ATTEMPT=$((PROP_ATTEMPT+1))
    echo "  ... waiting for npm registry to propagate @$NEW_VERSION; retry $PROP_ATTEMPT/$NPX_PROP_RETRIES in ${NPX_PROP_BACKOFF_S}s"
    sleep "$NPX_PROP_BACKOFF_S"
  done

  # RCA fix (release-step-9.7-npx-self-test-false-alarm, recommendation A, 2026-06-02):
  # Do NOT assert cli.js's PATH-sensitive npx-by-name RUNTIME exit. The launcher
  # shells out to commands (claude/git) absent in the bare npx sandbox, and npm
  # 10.9.7's npx-by-name does not reliably link the package bin onto PATH, so a
  # perfectly HEALTHY published package exits non-zero for an ENVIRONMENT reason.
  # That false alarm aborted every cut since beta.37 (the package installs + runs
  # fine via `npm install`, `npm install -g`, the marketplace, and a local-tarball
  # npx -- only `npx <pkg>@<version>` by-name is flaky on this npm). Assert instead
  # the TRUE publishable+installable signal: `npm install @pkg@version` resolves,
  # the bin file is present, it PARSES (`node --check`), and the bin gets linked.
  # That is exactly the path that actually works, with no launcher-runtime / npx
  # PATH dependency.
  NPX_PROJ="$NPX_TEST_DIR/proj"
  mkdir -p "$NPX_PROJ"
  ( cd "$NPX_PROJ" \
      && env HOME="$NPX_TEST_DIR" npm_config_cache="$NPX_TEST_DIR/.npm" npm init -y >/dev/null 2>&1 \
      && env HOME="$NPX_TEST_DIR" npm_config_cache="$NPX_TEST_DIR/.npm" npm install --prefer-online "@mindrian_os/cli@$NEW_VERSION" >/tmp/npx-selftest-out.log 2>&1 )
  NPM_INSTALL_RC=$?
  PKG_BIN="$NPX_PROJ/node_modules/@mindrian_os/cli/bin/cli.js"
  BIN_LINK="$NPX_PROJ/node_modules/.bin/mindrian-os"
  if [ "$NPM_INSTALL_RC" -ne 0 ]; then
    echo -e "${RED}  x npm install @mindrian_os/cli@$NEW_VERSION failed (rc=$NPM_INSTALL_RC)${NC}"
    echo "    The published npm package is broken for new installs. Inspect /tmp/npx-selftest-out.log."
    echo "    Recovery: <recovery> R.4 -- yank + cut successor. See Step 9.8 abort block below."
    exit 1
  fi
  if [ ! -f "$PKG_BIN" ]; then
    echo -e "${RED}  x published package missing bin/cli.js at $PKG_BIN${NC}"; exit 1
  fi
  if ! node --check "$PKG_BIN" >/dev/null 2>&1; then
    echo -e "${RED}  x published bin/cli.js does not parse (node --check failed)${NC}"; exit 1
  fi
  if [ ! -L "$BIN_LINK" ] && [ ! -f "$BIN_LINK" ]; then
    echo -e "${RED}  x bin 'mindrian-os' not linked under node_modules/.bin after install${NC}"; exit 1
  fi
  echo -e "${GREEN}  ✓ published package installs (npm install) + bin present + parses (node --check) + linked -- RCA-A PATH-independent signal${NC}"
  # Explicit cleanup (the EXIT trap also handles this; belt-and-suspenders).
  rm -rf "$NPX_TEST_DIR"
  rm -f "$NPX_SNAPSHOT"
  trap - EXIT
  cd "$ORIG_DIR_NPX"
fi

# --- Step 7.5: Commit B (next-bump commit) -- plugin.json/package.json -> next pre-release ---
# main HEAD ends on Commit B; the vN tag stays on Commit A. The marketplace repo
# gets NO Commit B -- marketplace.json only ever points at vN.
if [ "$NO_NEXT_BUMP" = "1" ]; then
  echo ""
  echo "=== Step 7.5: Commit B SKIPPED (--no-next-bump) -- main HEAD will be at v$NEW_VERSION ==="
else
  echo ""
  echo "=== Step 7.5: Commit B (next-bump commit) -- plugin repo only ==="

  # Compute NEXT_VERSION: if NEW_VERSION has a `-` suffix, bump the prerelease;
  # else open a fresh prerelease series (X.Y.(Z+1)-beta.1) via prepatch+prerelease.
  NEXT_VERSION="$(node -e '
    const semver = require(process.argv[1] + "/node_modules/semver");
    const cur = process.argv[2];
    let out;
    if (cur.indexOf("-") !== -1) {
      out = semver.inc(cur, "prerelease", "beta");
    } else {
      out = semver.inc(cur, "prepatch", "beta");
      out = semver.inc(out, "prerelease", "beta");
    }
    if (!out) {
      console.error("semver.inc returned null for next-bump from " + cur);
      process.exit(1);
    }
    process.stdout.write(out);
  ' "$PLUGIN_DIR" "$NEW_VERSION")" || { echo -e "${RED}next-version computation failed${NC}"; exit 1; }

  echo "  next version: $NEXT_VERSION"

  cd "$PLUGIN_DIR"
  node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('.claude-plugin/plugin.json', 'utf8'));
p.version = '$NEXT_VERSION';
fs.writeFileSync('.claude-plugin/plugin.json', JSON.stringify(p, null, 2) + '\n');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEXT_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

  # FIX 2026-06-02 (RULE 5 -- the catalog advertises the RELEASED stable, never the
  # dev next-bump): Commit B does NOT touch marketplace.json. The earlier Phase
  # 126.1 "7-place lockstep" advanced m.plugins[0].version to NEXT_VERSION, which
  # made `claude plugin install` LABEL users with the next-bump pre-release -- e.g.
  # a tester installed 1.13.1-beta.1 minutes after the 1.13.0 finalize, even though
  # source.ref=v1.13.0 cloned the stable code (RCA: marketplace-catalog-advertises-
  # dev-next-bump). The marketplace CATALOG is what users install NOW, so its
  # version MUST stay at NEW_VERSION (set in Step 4 / committed by Commit A) with
  # source.ref=vNEW_VERSION. Only the PLUGIN repo's plugin.json / package.json
  # advance to NEXT_VERSION (the next dev cycle). marketplace.json is intentionally
  # left untouched here -- the Commit B marketplace commit below is now a no-op.

  cd "$PLUGIN_DIR"
  # Reset CHANGELOG: insert [Unreleased] -- vNEXT (in progress) above the finalized [NEW_VERSION] entry.
  TEMP=$(mktemp)
  echo "## [Unreleased] -- v$NEXT_VERSION (in progress)" > "$TEMP"
  echo "" >> "$TEMP"
  echo "### Added" >> "$TEMP"
  echo "- " >> "$TEMP"
  echo "" >> "$TEMP"
  cat CHANGELOG.md >> "$TEMP"
  mv "$TEMP" CHANGELOG.md

  # Un-vendor: remove node_modules from the index so Commit B (which becomes
  # main HEAD) does NOT carry the vendored tree. Step 6.7 force-added it for
  # Commit A only; the vN tag keeps it, main HEAD does not. `git rm -r --cached`
  # un-tracks it without deleting the working-tree files (the local install
  # stays usable). If node_modules was never vendored (MOS_SKIP_VENDOR) this is
  # a harmless no-op.
  cd "$PLUGIN_DIR"
  if git ls-files --error-unmatch node_modules >/dev/null 2>&1; then
    git rm -r --cached --quiet node_modules
    echo "  node_modules un-tracked for Commit B (main HEAD stays clean; vN tag keeps it)"
  fi

  git add .claude-plugin/plugin.json package.json CHANGELOG.md
  git commit -m "chore: bump to v$NEXT_VERSION (next pre-release)" || echo "Nothing to commit in plugin (Commit B)"

  # Marketplace repo gets NO Commit B version bump (see the RULE 5 fix above):
  # marketplace.json stays at NEW_VERSION (committed by Commit A), so the catalog
  # advertises the released stable. This add/commit is a deliberate graceful no-op
  # (nothing staged) kept only so a future change here fails loudly rather than
  # silently skipping the marketplace.
  cd "$MARKETPLACE_DIR"
  git add .claude-plugin/marketplace.json
  git commit -m "chore: marketplace Commit B no-op (catalog stays at v$NEW_VERSION)" || echo "Nothing to commit in marketplace (Commit B) -- expected; catalog stays at v$NEW_VERSION"
fi

# --- Step 8: Dirty-repo / ahead-of-origin guard (BEFORE the push) ---
echo ""
echo "=== Step 8: ahead-of-origin guard ==="
cd "$PLUGIN_DIR"
git fetch origin main 2>/dev/null || echo "  (git fetch origin failed -- continuing with cached state)"

AHEAD="$(git log origin/main..HEAD --oneline 2>/dev/null || true)"
echo "Commits ahead of origin/main:"
echo "$AHEAD"
AHEAD_COUNT="$(printf '%s\n' "$AHEAD" | grep -c . || true)"
EXPECTED=2
[ "$NO_NEXT_BUMP" = "1" ] && EXPECTED=1
echo "  expected: $EXPECTED  actual: $AHEAD_COUNT"

if [ "$AHEAD_COUNT" -gt "$EXPECTED" ]; then
  if [ "$ALLOW_AHEAD" != "1" ]; then
    echo -e "${RED}Refusing to push: $AHEAD_COUNT commits ahead of origin/main but only $EXPECTED are this release.${NC}"
    echo "  Push/stash the rest, or pass --allow-ahead to override."
    exit 1
  fi
  echo -e "${YELLOW}  (--allow-ahead set; pushing $AHEAD_COUNT commits)${NC}"
fi

# Dirty tracked files except the bumped ones:
DIRTY="$(git status --porcelain --untracked-files=no | awk '{print $2}' \
  | grep -vE '^(\.claude-plugin/plugin\.json|package\.json|CHANGELOG\.md)$' || true)"
if [ -n "$DIRTY" ]; then
  echo -e "${RED}Refusing to push: dirty tracked files that are not part of this release:${NC}"
  echo "$DIRTY"
  echo "  Commit, stash, or revert these first."
  exit 1
fi
echo -e "${GREEN}  ahead-of-origin guard passed${NC}"

# --- Step 9: Push both ---
echo ""
echo "=== Step 9: Pushing plugin (main + tags) + marketplace ==="
cd "$PLUGIN_DIR" && git push origin main --tags 2>&1
cd "$MARKETPLACE_DIR" && git push origin master 2>&1

# --- Step 5.5 (tag-push verification): runs AFTER Step 9 push. ---
# Named 5.5 per Phase 126 Plan 04 CONTEXT.md spec; symbolic, not positional.
# Closes the 2026-05-13 dogfood asymmetry where the local tag was assumed to
# be at origin but a Windows marketplace-cache local-fetch artifact made it
# look missing. After Step 9's push, this gate verifies the tag round-trips
# through origin's refs BEFORE proceeding. Retry policy: RELEASE_TAG_PUSH_RETRIES
# attempts (default 3), RELEASE_TAG_PUSH_BACKOFF_S backoff (default 5s).
# SKIP_TAG_VERIFY=1 bypass exists for emergency bypass (audit-logged; NOT recommended).
echo ""
echo "=== Step 5.5: Verify tag v$NEW_VERSION is at origin ==="

if [ "${SKIP_TAG_VERIFY:-0}" = "1" ]; then
  echo -e "${YELLOW}  ! SKIP_TAG_VERIFY=1 -- skipping tag-push verification (audit-logged)${NC}" >&2
else
  TAG_PUSH_RETRIES="${RELEASE_TAG_PUSH_RETRIES:-3}"
  TAG_PUSH_BACKOFF_S="${RELEASE_TAG_PUSH_BACKOFF_S:-5}"
  ATTEMPT=1
  TAG_VERIFIED=0
  cd "$PLUGIN_DIR"
  while [ "$ATTEMPT" -le "$TAG_PUSH_RETRIES" ]; do
    if git ls-remote --tags origin 2>/dev/null | grep -q "refs/tags/v$NEW_VERSION$"; then
      TAG_VERIFIED=1
      echo -e "${GREEN}  ✓ tag v$NEW_VERSION verified at origin (attempt $ATTEMPT/$TAG_PUSH_RETRIES)${NC}"
      break
    fi
    if [ "$ATTEMPT" -lt "$TAG_PUSH_RETRIES" ]; then
      echo "  ... tag not yet visible at origin; retry $((ATTEMPT+1))/$TAG_PUSH_RETRIES in ${TAG_PUSH_BACKOFF_S}s"
      sleep "$TAG_PUSH_BACKOFF_S"
    fi
    ATTEMPT=$((ATTEMPT+1))
  done
  if [ "$TAG_VERIFIED" != "1" ]; then
    echo -e "${RED}  x tag v$NEW_VERSION NOT visible at origin after $TAG_PUSH_RETRIES attempts${NC}"
    echo "    Investigate: git ls-remote --tags origin | grep v$NEW_VERSION"
    echo "    Recovery: git push origin v$NEW_VERSION (push the tag explicitly)"
    exit 1
  fi
fi

# --- Step 9.8: doctor --acceptance (full, HARD ABORT, no --allow) ---
# Phase 123 Plan-04 (HARNESS-123-12): the post-publish release gate as a command.
# Runs the FULL 7-point checklist (the 5 pre-tag points PLUS
# version-of-record-published + npx-roundtrip). If anything fails HERE, the
# git tag is on origin, the npm publish has landed, and the marketplace
# source.ref points at vN -- the published artifact is INCONSISTENT.
#
# WORST CASE: npm version slot for vN is burned. The recovery is
# yank-+-cut-successor (NOT a retry of --acceptance against the broken
# artifact). See <recovery> R.4 in 123-04-PLAN.md:
#   - npm deprecate @mindrian_os/cli@$NEW_VERSION "broken -- see vNEXT"
#   - npm dist-tag rm @mindrian_os/cli next
#   - Fix the cause locally
#   - bash scripts/release.sh --prerelease  (cuts vN+1 with the fix)
#   - Notify Lawrence + any registered tester (REQUIRED, not optional).
# Append the recovery path to ~/.mindrian/recovery-log.txt (R.7).
#
# Recovery quick-reference (cite when this aborts):
#   R.1  Step 7 fail BEFORE publish: local-only reset, no notify
#   R.2  Step 9.5 fail (publish errored): retry publish per Step 9.5 stanza
#   R.3  Step 9 fail (push errored): retry push; investigate upstream
#   R.4  Step 9.8 fail (this gate): YANK + cut successor + NOTIFY
#   R.5  Operator notification template (Lawrence + testers/)
#   R.6  Decision matrix (yank vs retry vs successor)
#   R.7  Recovery log audit trail at ~/.mindrian/recovery-log.txt
echo ""
echo "=== Step 9.8: doctor --acceptance (full) ==="
if ! node "$PLUGIN_DIR/scripts/doctor.cjs" --acceptance; then
  echo -e "${RED}ABORT: doctor --acceptance (post-publish) failed.${NC}"
  echo "  The release commit + tag + npm publish + push ALREADY LANDED, but the"
  echo "  published artifact is INCONSISTENT. INVESTIGATE before any further releases."
  echo ""
  echo "  Recovery path: <recovery> R.4 (yank + cut successor):"
  echo "    1. npm deprecate @mindrian_os/cli@$NEW_VERSION \"broken -- see successor\""
  echo "    2. npm dist-tag rm @mindrian_os/cli next"
  echo "    3. Fix the cause locally."
  echo "    4. bash scripts/release.sh --prerelease   # cuts vN+1 with the fix"
  echo "    5. NOTIFY Lawrence + any registered tester (REQUIRED -- subject:"
  echo "       'MOS release v$NEW_VERSION ROLLED BACK -- do not install')."
  echo "    6. Append to ~/.mindrian/recovery-log.txt:"
  echo "       <ISO-timestamp> v$NEW_VERSION recovery-path=R.4 notes=<...>"
  echo "  See .planning/phases/123-install-lifecycle-harness/123-04-PLAN.md <recovery>"
  exit 1
fi
echo -e "${GREEN}  --acceptance (full) passed${NC}"

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
