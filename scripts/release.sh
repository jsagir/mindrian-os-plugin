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
#   9.5. npm publish @mindrian_os/install at NEW_VERSION (BEFORE Commit B so the
#        working tree still says vN). dist-tag: @next for -beta./alpha./rc./next.,
#        @latest for clean X.Y.Z.
#   9.6. Sync install minisite to NEW_VERSION (7-place lockstep). Bumps
#        ~/mindrianos-install-site/lib/os.ts + app/page.tsx, commits, runs
#        `vercel --prod --yes`. Override path via $MINDRIAN_INSTALL_SITE_DIR.
#        Soft-skip if dir missing OR vercel CLI not in PATH; hard-abort on
#        sed/grep/commit errors. See feedback_install_minisite_lockstep.md.
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
# TODO(future): de-dup verify-release calls. Plan-04 added Step 6.6 (which
# calls doctor --acceptance --pre-tag, which internally re-runs verify-release)
# and Step 9.6 (full doctor --acceptance, also re-runs verify-release). Combined
# with Step 2 and Step 6.5 (both call verify-release directly), the count per
# release is 4x. verify-release is idempotent + ~5s per run; accept the cost
# for the safety net now. De-dup is a follow-up (e.g. skip Step 2 / Step 6.5
# when Step 6.6 will also call it, by detecting --acceptance support).
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
USAGE_BLOCK="Usage: bash scripts/release.sh [--prerelease | --finalize | --start-prerelease | patch | minor | major] [--allow-ahead] [--no-next-bump] [--dry-run]"

for arg in "$@"; do
  case "$arg" in
    --prerelease)        BUMP_MODE="prerelease" ;;
    --finalize)          BUMP_MODE="finalize" ;;
    --start-prerelease)  BUMP_MODE="start-prerelease" ;;
    stable)              BUMP_MODE="finalize" ;;  # alias
    patch|minor|major)   BUMP_MODE="$arg" ;;
    --allow-ahead)       ALLOW_AHEAD=1 ;;
    --no-next-bump)      NO_NEXT_BUMP=1 ;;
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
  echo "  release.sh needs the semver devDep for pre-release bump algebra."
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
  echo "  Step 3    : bump .claude-plugin/plugin.json + package.json -> $NEW_VERSION"
  echo "  Step 4    : bump ~/mindrian-marketplace/.claude-plugin/marketplace.json"
  echo "              version=$NEW_VERSION + source.ref=v$NEW_VERSION (TWO-COMMIT form; Phase 123 D-19)"
  echo "  Step 5    : claude plugin validate (marketplace)"
  echo "  Step 5b   : reserved-name compliance check (Phase 95.6 D-11a)"
  echo "  Step 6    : CHANGELOG.md entry check + rename [Unreleased] -> [$NEW_VERSION] - \$(date +%F)"
  echo "  Step 6.5  : post-bump re-verify (scripts/verify-release)"
  echo "  Step 6.6  : run mindrian-os doctor --acceptance --pre-tag (HARD ABORT on failure)"
  echo "  Step 6.6b : run tests/test-doctor-acceptance-self-coverage.cjs"
  echo "              (5 scaffolded broken-state fixtures + live no-regression guard;"
  echo "              HARD ABORT on fail, same rollback as Step 6.6; Phase 126 Plan 03)"
  echo "  Step 7    : commit A on plugin repo -- 'release: v$NEW_VERSION', tag v$NEW_VERSION"
  echo "              commit on marketplace repo -- 'release: sync to v$NEW_VERSION'"
  echo "  Step 9.5  : npm publish @mindrian_os/install@$NEW_VERSION --tag $NPM_TAG_PREVIEW"
  if [ "$NO_NEXT_BUMP" = "1" ]; then
    echo "  Step 7.5  : SKIPPED (--no-next-bump). main HEAD stays at $NEW_VERSION."
  else
    echo "  Step 7.5  : commit B on plugin repo -- bump to $NEXT_VERSION, CHANGELOG [Unreleased] -- v$NEXT_VERSION"
  fi
  echo "  Step 8    : dirty-repo / ahead-of-origin guard"
  echo "              current ahead-of-origin: $CURRENT_AHEAD commit(s); guard would allow up to $([ "$NO_NEXT_BUMP" = "1" ] && echo "1" || echo "2") release commit(s)"
  if [ "$CURRENT_AHEAD" != "?" ] && [ "$CURRENT_AHEAD" -gt 0 ] && [ "$ALLOW_AHEAD" != "1" ]; then
    echo "              ${YELLOW}NOTE: $CURRENT_AHEAD pre-existing commit(s) ahead of origin -- the guard will require --allow-ahead to push them with the release${NC}"
  fi
  echo "  Step 9    : git push origin main --tags (plugin); git push (marketplace)"
  echo "  Step 9.6  : run full mindrian-os doctor --acceptance (HARD ABORT on failure;"
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

# --- Step 7: Commit A (release commit) -- finalizes vN, NEVER git add -A ---
# Commit A holds the version-of-record at vN. The vN git tag points HERE.
# An install via `marketplace.json source.ref: vN` checks out THIS commit, so
# Claude Code reads plugin.json.version == vN and self-reports vN. The next-bump
# (Commit B) follows Step 9.5 below.
echo ""
echo "=== Step 7: Commit A (release commit) -- plugin + marketplace ==="
cd "$PLUGIN_DIR"
git add .claude-plugin/plugin.json package.json CHANGELOG.md
git commit -m "release: v$NEW_VERSION" || echo "Nothing to commit in plugin (Commit A)"
git tag "v$NEW_VERSION" 2>/dev/null || echo "Tag v$NEW_VERSION already exists"

cd "$MARKETPLACE_DIR"
git add .claude-plugin/marketplace.json
git commit -m "release: sync to v$NEW_VERSION" || echo "Nothing to commit in marketplace"

# --- Step 9.5: Publish @mindrian_os/install at NEW_VERSION (BEFORE Commit B) ---
# Memory canon feedback_release_lockstep_npm: every plugin release publishes
# @mindrian_os/install to npm. -beta./alpha./rc./next. suffixes -> @next dist-tag;
# clean X.Y.Z -> @latest. If publish fails, HALT -- never ship unpublished.
# MOS_TEST_DRY_RUN=1 exercises the gate without touching the live registry.
#
# IMPORTANT: Publish runs HERE (after Commit A, before Commit B) so the working
# tree's package.json says NEW_VERSION (vN). If we published from Commit B's
# tree, npm would receive NEXT_VERSION (vN+1) -- wrong.
echo ""
echo "=== Step 9.5: npm publish (@mindrian_os/install) ==="
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
echo "  payload review OK -- only allowlisted paths present"

if [ "${MOS_TEST_DRY_RUN:-0}" = "1" ]; then
  echo "  [DRY RUN] would run: npm publish --tag $NPM_TAG"
else
  if npm publish --tag "$NPM_TAG"; then
    echo -e "${GREEN}  Published @mindrian_os/install@$NEW_VERSION to npm (@$NPM_TAG)${NC}"
  else
    echo ""
    echo -e "${RED}  x npm publish failed for @mindrian_os/install@$NEW_VERSION.${NC}"
    echo "    Commit A has already been made and tagged v$NEW_VERSION (not yet pushed),"
    echo "    so the lockstep contract is now BROKEN until you recover. To recover:"
    echo "      1. Fix the npm issue (auth: 'npm whoami'; scope: ensure"
    echo "         package.json name is '@mindrian_os/install' and you have publish"
    echo "         rights on the @mindrian_os org)."
    echo "      2. Re-run JUST the publish: npm publish --tag $NPM_TAG"
    echo "      3. Verify: npm view @mindrian_os/install@$NPM_TAG version"
    echo "      4. Then resume by running Commit B + push manually, OR reset"
    echo "         (git reset --hard HEAD^ + git tag -d v$NEW_VERSION) and re-run release.sh."
    echo "    Do NOT cut another plugin release until npm is in sync."
    exit 1
  fi
fi

# --- Step 9.6: Sync install minisite to NEW_VERSION (Hard 7-place lockstep) ---
# Enforces the install-minisite half of the 7-place lockstep contract from
# MEMORY.md feedback_install_minisite_lockstep.md (2026-05-14). The minisite
# at https://mindrianos-install-site.vercel.app has two hardcoded version-string
# locations that must reflect what is shipped on npm. Auto-bump + commit + deploy
# happens HERE -- after npm publish (so we only sync to what is actually on
# the registry) but BEFORE Commit B (so the chain stays atomic).
#
# Behavior:
#   - $MINDRIAN_INSTALL_SITE_DIR override (default: $HOME/mindrianos-install-site)
#   - If dir missing: soft warn, continue release (some maintainer boxes lack it)
#   - sed/grep/commit failures: hard abort (the rule is non-negotiable for this box)
#   - vercel CLI missing: soft warn + commit locally + tell user to deploy manually
#   - DRY_RUN: log intent only, no edits
echo ""
echo "=== Step 9.6: Sync install minisite to v$NEW_VERSION (7-place lockstep) ==="

MINISITE_DIR="${MINDRIAN_INSTALL_SITE_DIR:-$HOME/mindrianos-install-site}"

if [ ! -d "$MINISITE_DIR" ]; then
  echo -e "${YELLOW}  ! $MINISITE_DIR not present -- skipping minisite sync.${NC}"
  echo "    Bump manually after this release: edit lib/os.ts + app/page.tsx,"
  echo "    git commit, then 'vercel --prod --yes' from \$MINDRIAN_INSTALL_SITE_DIR."
elif [ "$DRY_RUN" = "1" ]; then
  echo "  [DRY RUN] would bump v$NEW_VERSION in:"
  echo "    $MINISITE_DIR/lib/os.ts"
  echo "    $MINISITE_DIR/app/page.tsx"
  echo "  [DRY RUN] would run: git commit + vercel --prod --yes"
else
  ORIG_DIR="$PWD"
  cd "$MINISITE_DIR"

  # Bump lib/os.ts terminal-display message: "MindrianOS v<...> installed"
  # Delimiter is @ (not |) so the ERE alternations inside (alpha|beta|rc|next) do
  # not collide with sed's substitution delimiter.
  sed -i -E "s@MindrianOS v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc|next)\.[0-9]+)?@MindrianOS v$NEW_VERSION@g" lib/os.ts || {
    echo -e "${RED}  x failed to bump lib/os.ts${NC}"
    cd "$ORIG_DIR"
    exit 1
  }

  # Bump app/page.tsx eyebrow: "v<...> · Install"
  sed -i -E "s@v[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc|next)\.[0-9]+)? · Install@v$NEW_VERSION · Install@g" app/page.tsx || {
    echo -e "${RED}  x failed to bump app/page.tsx${NC}"
    cd "$ORIG_DIR"
    exit 1
  }

  # Verify the bumps actually landed (sed-no-match is silent; grep catches it)
  if ! grep -q "v$NEW_VERSION" lib/os.ts || ! grep -q "v$NEW_VERSION" app/page.tsx; then
    echo -e "${RED}  x minisite version-string bump failed verification${NC}"
    echo "    lib/os.ts and/or app/page.tsx do not contain v$NEW_VERSION after sed."
    echo "    Inspect $MINISITE_DIR/lib/os.ts:149 and app/page.tsx:30 manually."
    cd "$ORIG_DIR"
    exit 1
  fi

  # Commit (--no-verify to match release.sh's plugin-repo style; no pre-commit hooks here anyway)
  git add lib/os.ts app/page.tsx
  if git diff --cached --quiet; then
    echo "  -> minisite already at v$NEW_VERSION (no changes to commit)"
  else
    git commit --no-verify -m "chore: sync minisite version strings to v$NEW_VERSION" >/dev/null 2>&1 || {
      echo -e "${RED}  x minisite commit failed${NC}"
      cd "$ORIG_DIR"
      exit 1
    }
    echo "  -> minisite committed locally: $(git log -1 --pretty=format:'%h %s')"
  fi

  # Deploy via Vercel CLI
  if command -v vercel >/dev/null 2>&1; then
    if vercel --prod --yes >/dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Minisite deployed: https://mindrianos-install-site.vercel.app/ now serves v$NEW_VERSION${NC}"
    else
      echo -e "${YELLOW}  ! vercel deploy failed -- minisite committed but NOT live.${NC}"
      echo "    Recover: cd $MINISITE_DIR && vercel --prod --yes"
    fi
  else
    echo -e "${YELLOW}  ! vercel CLI not in PATH -- minisite committed but NOT deployed.${NC}"
    echo "    Recover: install vercel CLI, then 'cd $MINISITE_DIR && vercel --prod --yes'"
  fi

  cd "$ORIG_DIR"
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

  # Reset CHANGELOG: insert [Unreleased] -- vNEXT (in progress) above the finalized [NEW_VERSION] entry.
  TEMP=$(mktemp)
  echo "## [Unreleased] -- v$NEXT_VERSION (in progress)" > "$TEMP"
  echo "" >> "$TEMP"
  echo "### Added" >> "$TEMP"
  echo "- " >> "$TEMP"
  echo "" >> "$TEMP"
  cat CHANGELOG.md >> "$TEMP"
  mv "$TEMP" CHANGELOG.md

  git add .claude-plugin/plugin.json package.json CHANGELOG.md
  git commit -m "chore: bump to v$NEXT_VERSION (next pre-release)" || echo "Nothing to commit in plugin (Commit B)"
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

# --- Step 9.6: doctor --acceptance (full, HARD ABORT, no --allow) ---
# Phase 123 Plan-04 (HARNESS-123-12): the post-publish release gate as a command.
# Runs the FULL 7-point checklist (the 5 pre-tag points PLUS
# version-of-record-published + npx-roundtrip). If anything fails HERE, the
# git tag is on origin, the npm publish has landed, and the marketplace
# source.ref points at vN -- the published artifact is INCONSISTENT.
#
# WORST CASE: npm version slot for vN is burned. The recovery is
# yank-+-cut-successor (NOT a retry of --acceptance against the broken
# artifact). See <recovery> R.4 in 123-04-PLAN.md:
#   - npm deprecate @mindrian_os/install@$NEW_VERSION "broken -- see vNEXT"
#   - npm dist-tag rm @mindrian_os/install next
#   - Fix the cause locally
#   - bash scripts/release.sh --prerelease  (cuts vN+1 with the fix)
#   - Notify Lawrence + any registered tester (REQUIRED, not optional).
# Append the recovery path to ~/.mindrian/recovery-log.txt (R.7).
#
# Recovery quick-reference (cite when this aborts):
#   R.1  Step 7 fail BEFORE publish: local-only reset, no notify
#   R.2  Step 9.5 fail (publish errored): retry publish per Step 9.5 stanza
#   R.3  Step 9 fail (push errored): retry push; investigate upstream
#   R.4  Step 9.6 fail (this gate): YANK + cut successor + NOTIFY
#   R.5  Operator notification template (Lawrence + testers/)
#   R.6  Decision matrix (yank vs retry vs successor)
#   R.7  Recovery log audit trail at ~/.mindrian/recovery-log.txt
echo ""
echo "=== Step 9.6: doctor --acceptance (full) ==="
if ! node "$PLUGIN_DIR/scripts/doctor.cjs" --acceptance; then
  echo -e "${RED}ABORT: doctor --acceptance (post-publish) failed.${NC}"
  echo "  The release commit + tag + npm publish + push ALREADY LANDED, but the"
  echo "  published artifact is INCONSISTENT. INVESTIGATE before any further releases."
  echo ""
  echo "  Recovery path: <recovery> R.4 (yank + cut successor):"
  echo "    1. npm deprecate @mindrian_os/install@$NEW_VERSION \"broken -- see successor\""
  echo "    2. npm dist-tag rm @mindrian_os/install next"
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
