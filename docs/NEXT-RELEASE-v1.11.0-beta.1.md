# v1.11.0-beta.1 -- Release Pipeline Hardening + Self-Service Diagnostic

**Status:** Planned (not yet started)
**Target:** Beta release to Lawrence first, promote to 1.11.0 stable after validation
**Milestone:** v1.11.0 Release Pipeline Hardening
**Parent incident:** [docs/autopsies/2026-04-13-wrong-workspace-incident.md](autopsies/2026-04-13-wrong-workspace-incident.md)

---

## Why Beta First

Everything in this release is **release infrastructure**. A bug in release infrastructure is the hardest kind of bug to recover from because a broken release script can prevent you from shipping its own fix. Ship as `1.11.0-beta.1` first. Lawrence is the canary. Promote to `1.11.0` stable only after he runs all six commands below and nothing throws.

Install the beta:

```bash
claude plugin update mos@mindrian-marketplace --version 1.11.0-beta.1
```

Rollback to stable anytime:

```bash
claude plugin update mos@mindrian-marketplace --version 1.10.0
```

---

## Scope (4 deliverables)

### 1. `/mos:doctor` -- Self-Service Diagnostic

**Problem:** Lawrence had to manually run a 10-section diagnostic prompt I wrote by hand. Future users won't have that luxury. They need a one-command self-service version.

**Deliverable:** `scripts/doctor` (bash) + `commands/doctor.md` (command frontmatter).

**The 10 checks (from Lawrence's diagnostic format, verbatim):**

1. Environment (uname, shell, claude --version, node, npm, git, HOME, PWD)
2. Claude Code config (~/.claude/settings.json, project .claude/settings.json)
3. Plugin registry (claude plugin list, installed_plugins.json, known_marketplaces.json)
4. MindrianOS files on disk (plugin cache, marketplace dir, active version)
5. Commands and skills registration (commands/ count, skills/ with SKILL.md)
6. Hooks and settings (plugin settings.json, hooks.json, .claude-plugin/plugin.json)
7. MCP and Brain connection (.mcp.json, MINDRIAN_BRAIN_KEY set, brain ping)
8. Logs and errors (~/.claude/logs/, plugin logs)
9. Session health (current session start time, claude processes, /mos: commands visible)
10. Known issues (read lib/import/PRECONDITIONS.md, flag anything active)

**Output modes:**
- `/mos:doctor` -- Body Shape D status dashboard (pass/fail per check, action footer)
- `/mos:doctor --fix` -- Runs auto-fix for known-recoverable issues (stale statusLine paths, orphaned data dirs, temp_git_* cleanup)
- `/mos:doctor --dump` -- Plain text dump of all 10 sections, ready to paste into a support message (API key redacted automatically)

**Credit comment in source:** "10-section format based on Lawrence Aronhime's QA diagnostic from 2026-04-13. See docs/autopsies/2026-04-13-wrong-workspace-incident.md."

**Requirement IDs:** DOCTOR-01 through DOCTOR-10 (one per section), DOCTOR-11 (auto-fix), DOCTOR-12 (dump mode)

### 2. `/mos:update` Preflight -- Changelog Diff Before Upgrading

**Problem:** Users upgrade blind. They don't know what's about to change or what might break.

**Deliverable:** Modify `commands/update.md` to add a preflight phase before the install.

**Flow:**

```
Old: check -> confirm -> install
New: check -> fetch CHANGELOG.md -> show diff from current -> confirm -> install
```

**The diff renderer:** Read CHANGELOG.md from the fetched tag, extract all entries between the user's current version and the target version, group by category (Added, Changed, Fixed, BREAKING), render in Body Shape B (semantic tree) with glyphs per category (■ Added, ▶ Changed, ✓ Fixed, ⚡ BREAKING). Any entry marked BREAKING forces a second confirmation.

**Requirement IDs:** PREFLIGHT-01 (fetch + diff), PREFLIGHT-02 (BREAKING detection + second confirm), PREFLIGHT-03 (backup user modifications before install)

### 3. `scripts/release.sh` -- 5-Gate Release Pipeline

**Problem:** Version numbers drift across `package.json`, `plugin.json`, CHANGELOG head, git tag, and marketplace.json. On 2026-04-13 all five were saying different things.

**Deliverable:** `scripts/release.sh <version>` that enforces all five gates before any push is allowed.

**The 5 gates (refuse to proceed if any fails):**

1. CHANGELOG.md has a `## [X.Y.Z]` entry at the top matching the version
2. `package.json` version field matches X.Y.Z
3. `.claude-plugin/plugin.json` version field matches X.Y.Z
4. Git tag `vX.Y.Z` does NOT already exist (refuses re-tag)
5. Working tree is clean (no uncommitted changes)

**Additional pipeline steps after gates pass:**

- Create git tag `vX.Y.Z` with auto-generated message from CHANGELOG
- Push `git push origin main && git push origin vX.Y.Z`
- Update `~/mindrian-marketplace/.claude-plugin/marketplace.json`:
  - Set `plugins[0].version` to X.Y.Z
  - Set `plugins[0].source.ref` to `vX.Y.Z`
- Commit marketplace change with message `release: sync to vX.Y.Z`
- Push marketplace: `git push origin master`
- Print "Released vX.Y.Z" + next-step hints to user

**The hard rule:** Never bump version numbers by hand again. Always go through `scripts/release.sh`.

**Requirement IDs:** RELEASE-01 (5-gate check), RELEASE-02 (tag + push plugin), RELEASE-03 (marketplace sync), RELEASE-04 (safe failure reporting)

### 4. Session-Start Divergence Warning

**Problem:** On 2026-04-13 the wrong-workspace incident was exacerbated because the cache-dir session and the real-workspace session had no awareness of each other. `origin/main` had moved forward on GitHub and this session's clone didn't know.

**Deliverable:** Extend `scripts/session-start` (already has the workspace guard from v1.10.0) to also fetch origin and warn on divergence.

**Logic:**

```bash
# Only run if we are in a git repo + real workspace (already guarded)
if git rev-parse --git-dir >/dev/null 2>&1; then
  # Fetch origin main quietly (10s timeout, don't block the session)
  timeout 10 git fetch origin main 2>/dev/null || true
  
  # Count ahead/behind
  AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
  BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
  
  if [ "$AHEAD" -gt 0 ] && [ "$BEHIND" -gt 0 ]; then
    echo "WARNING: Local branch has diverged from origin/main."
    echo "  $AHEAD commits ahead, $BEHIND commits behind."
    echo "  Run /gsd:health to reconcile."
  elif [ "$BEHIND" -gt 5 ]; then
    echo "NOTICE: Local branch is $BEHIND commits behind origin/main."
    echo "  Consider: git pull --rebase origin main"
  fi
fi
```

**Edge cases:**
- Offline users: `git fetch` fails silently, warning does not fire
- First session in a fresh clone: no divergence, no warning
- 5-commit behind threshold: noise filter so small lags don't nag
- Timeout at 10s: session start must still complete in under 2s for responsiveness

**Requirement IDs:** DIVERGENCE-01 (fetch + check), DIVERGENCE-02 (threshold + messaging), DIVERGENCE-03 (offline safe)

---

## Test Plan (for Lawrence as beta tester)

```bash
# Install the beta
claude plugin update mos@mindrian-marketplace --version 1.11.0-beta.1

# 1. Self-service diagnostic
/mos:doctor
#   Expected: Status dashboard with 10 checks, 9-10 passing (PRECONDITIONS may flag 1)
/mos:doctor --dump
#   Expected: Plain text dump of all 10 sections, API key auto-redacted
/mos:doctor --fix
#   Expected: Offers to fix stale statusLine and orphaned dirs, asks confirmation

# 2. Update preflight
/mos:update
#   Expected: Shows changelog diff from 1.11.0-beta.1 to whatever is latest,
#   groups by Added/Changed/Fixed/BREAKING, asks for confirmation before install

# 3. Release script (dry-run only -- Lawrence should not actually cut a release)
scripts/release.sh 1.11.0 --dry-run
#   Expected: All 5 gates report PASS or FAIL with reasoning, no actual push happens

# 4. Session-start divergence
# Pull in a way that creates local-only commits, then start a new session
cd ~/MindrianOS-Plugin
git commit --allow-empty -m "test local commit"
# Start new Claude Code session
#   Expected: Session start prints NOTICE about being 1 commit ahead of origin/main
git reset --hard HEAD^
```

---

## Success Criteria

- [ ] `/mos:doctor` completes in under 5 seconds on a clean install
- [ ] `/mos:doctor --dump` output is paste-ready for GitHub issues or support email
- [ ] `/mos:doctor --fix` never destroys user data, always asks confirmation
- [ ] `/mos:update` refuses to install without user seeing the changelog diff
- [ ] BREAKING changes require a second explicit confirmation
- [ ] `scripts/release.sh` refuses to proceed if any of the 5 gates fail
- [ ] Release script succeeds with all 5 gates passing on the 1.11.0 cut
- [ ] Session-start divergence warning fires correctly when local is ahead OR behind
- [ ] Session-start total time stays under 2 seconds including the fetch
- [ ] All new commands work on CLI, Desktop (via MCP), and Cowork (shared state)
- [ ] Zero em-dashes in any new file (enforced via grep in tests)
- [ ] Lawrence approves promotion to 1.11.0 stable

---

## Promotion Path

1. Ship `1.11.0-beta.1` via `scripts/release.sh 1.11.0-beta.1` (once release.sh exists, bootstrap manually first time)
2. Email Lawrence with install instructions and test plan
3. Wait for Lawrence feedback (at least 48 hours of real use)
4. Iterate on bugs as `1.11.0-beta.2`, `1.11.0-beta.3` as needed
5. When Lawrence signs off: ship `1.11.0` stable via `scripts/release.sh 1.11.0`
6. Update CLAUDE.md to reference the new release pipeline as MANDATORY
7. Retire hand-rolled version bumps -- `release.sh` is the only way in

---

## Open Questions

1. Does `claude plugin update --version X.Y.Z-beta.N` actually work against pinned-ref marketplaces? Need to test. If not, we may need to temporarily unpin `source.ref` during beta windows, or ship beta as a separate marketplace entry.
2. Should `/mos:doctor` auto-fire on session-start for high-severity issues? Or is that too noisy?
3. Does `scripts/release.sh` also need to run the test suite (`node lib/import/run-all-tests.cjs`) as a 6th gate? Probably yes.
4. `scripts/release.sh` needs a `--dry-run` flag for Lawrence's beta test above. Add to RELEASE-04 scope.
5. Should the session-start divergence warning be silenced with an env var for users who don't want it? (`MINDRIAN_SKIP_DIVERGENCE_CHECK=1`)

---

## Credit

The 10-section structure of `/mos:doctor` is directly derived from Lawrence Aronhime's QA diagnostic output on 2026-04-13. The diagnostic prompt he ran (which I wrote for him by hand) became the spec for a general-purpose self-service tool. Source comment:

```bash
# /mos:doctor -- self-service diagnostic
# Based on Lawrence Aronhime's QA format from 2026-04-13.
# See docs/autopsies/2026-04-13-wrong-workspace-incident.md for context.
```
