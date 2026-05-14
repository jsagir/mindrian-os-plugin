---
phase: 126
slug: install-lifecycle-harness-gaps
step: 0
title: Step 0 Manual Recovery (Path-E historical-record completeness)
status: partially-completed (tag already at origin 2026-05-13; npm publish of beta.13 optional)
absorbs_into: First execution commit of Phase 126 (D2 from CONTEXT.md)
workspace_guard: /home/jsagi/MindrianOS-Plugin/ (NOT ~/.claude/plugins/mindrian-os/)
created: 2026-05-14
---

# Phase 126 Step 0 -- Manual Recovery Commands

> **Status (Path E -- 2026-05-14):** under Path E reordering, Step 0 is no longer a tester-unblocker (Phase 125 ships beta.14 first; testers' current install paths work). Step 0 becomes a **historical-record completeness** action plus a reproducibility artifact that documents what the Plan 04 release.sh hardening must prevent going forward.

## Context

The 2026-05-13 Windows dogfood session (filed at `126-FEEDBACK-2026-05-13-windows-dogfood.md`) surfaced two release-pipeline gaps from the v1.13.0-beta.13 ship:

1. Git tag `v1.13.0-beta.13` appeared missing -- subsequently verified PRESENT at origin via `git ls-remote --tags origin | grep v1.13.0-beta.13` (commit `09ee5a4`, "release: v1.13.0-beta.13"). The Windows-side "tag not found" was a marketplace-cache local-fetch artifact, not a real origin gap. **No action needed.**
2. `@mindrian_os/install@1.13.0-beta.13` was never successfully published to npm -- `npm view @mindrian_os/install@1.13.0-beta.13 version` returns empty / 404. **Optional retroactive publish below.**

Decision D2 in CONTEXT.md absorbs Step 0 as the FIRST execution commit of Phase 126 (rather than spawning a separate Phase 123.1 hotfix or hand-patching outside any phase). This document records the exact commands so the manual steps remain reproducible if Phase 126 Plan 04 (release.sh tag-push + npx-publish gates) ever fails on a future release cut.

## Workspace guard (CLAUDE.md, MANDATORY)

Every command below MUST be run from `/home/jsagi/MindrianOS-Plugin/`. Running from `~/.claude/plugins/mindrian-os/` silently diverges (the 2026-04-13 incident). Verify with:

```bash
pwd  # MUST print /home/jsagi/MindrianOS-Plugin
```

If you're in the plugin cache, `cd ~/MindrianOS-Plugin` and restart the session.

## Action 1: Verify v1.13.0-beta.13 git tag at origin (verification only -- already passed)

```bash
# From /home/jsagi/MindrianOS-Plugin/
git ls-remote --tags origin | grep "refs/tags/v1.13.0-beta.13"
```

**Expected output:**

```
09ee5a4...    refs/tags/v1.13.0-beta.13
```

If the tag IS at origin (as verified 2026-05-13), no action needed. The dogfood "missing tag" report was a Windows marketplace-cache local-fetch artifact.

If the tag is NOT at origin (regression future-state):

```bash
# Find the beta.13 ship commit (CHANGELOG entry says 2026-05-13):
git log --all --oneline | grep -i "release: v1.13.0-beta.13"
# Expected: 09ee5a4 release: v1.13.0-beta.13

# Recreate + push the tag (idempotent; tag may already exist locally):
git tag v1.13.0-beta.13 09ee5a4 2>/dev/null || true
git push origin v1.13.0-beta.13

# Verify:
git ls-remote --tags origin | grep v1.13.0-beta.13
```

## Action 2: Optional retroactive npm publish of @mindrian_os/install@1.13.0-beta.13

Under Path E this is **historical-record completeness, not an unblocker.** Phase 125 ships beta.14 via release.sh Step 9.5 (which DOES publish to npm); once beta.14 is on npm the user-facing `npx @mindrian_os/install` works for the current version. beta.13's missing npm presence is an asymmetry (git tag present, npm version absent) -- closed via these steps OR closed by Plan 04 preventing the asymmetry going forward.

```bash
# From /home/jsagi/MindrianOS-Plugin/
git status                                # confirm clean (or stash dirty work)
git stash                                 # park any dirty state
git checkout v1.13.0-beta.13              # detached HEAD at beta.13 ship commit
# Verify the working tree's package.json says 1.13.0-beta.13:
node -e "console.log(require('./package.json').version)"
# Expected: 1.13.0-beta.13

# Auth check (must be authenticated to @mindrian_os org):
npm whoami
# Expected: a username with publish rights on @mindrian_os

# Payload review (Codex review 2026-05-10: tarball MUST be allowlist-only):
npm pack --dry-run
# Inspect output -- MUST NOT include .planning/, docs/, mcp-server-brain/, tests/, scripts/release.sh

# Publish with @next dist-tag (per release.sh Step 9.5 logic for -beta.* suffixes):
npm publish --tag=next
# Expected: "+ @mindrian_os/install@1.13.0-beta.13"

# Verify the publish landed:
npm view @mindrian_os/install@1.13.0-beta.13 version
# Expected: 1.13.0-beta.13

# Round-trip test against a clean temp directory:
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
npx @mindrian_os/install@1.13.0-beta.13
# Expected: exit 0 + expected scaffold output

# Return to dev workspace:
cd /home/jsagi/MindrianOS-Plugin
git checkout main                         # back to the current branch
git stash pop 2>/dev/null || true         # restore dirty state if any
```

## Action 3: Absorb commands into the first Phase 126 execution commit

Per CONTEXT.md D2, the first commit of Phase 126 execution carries the meta-record of Step 0 (this document) -- it does NOT require a separate commit because the tag is already at origin and the npm publish (Action 2) is optional under Path E.

If Action 2 is run, the publish itself produces no git commit -- npm registry state is updated separately from the plugin repo. The plugin repo's first Phase 126 execution commit (after the planner finishes) lands per the wave structure in CONTEXT.md; this doc is checked in as part of that wave so the manual steps are reproducible.

## Recovery on Plan 04 future-state failure

If Plan 04's release.sh Step 5.5 (tag-push) OR Step 9.7 (npx-publish self-test) ever fails during a future release cut, the operator can:

1. Identify the exact step that failed from release.sh stderr.
2. Re-run JUST the failing step:
   - Tag-push: `git push origin v<version> && git ls-remote --tags origin | grep v<version>`
   - npx-publish self-test: rerun `npx @mindrian_os/install@<version>` against a fresh temp dir
3. If neither manual rerun succeeds, fall back to the rollback path documented in release.sh Step 9.5/9.6 stanzas (npm deprecate + cut successor vN+1 with the fix).
4. File a Phase 126 follow-up issue documenting the failure mode for the family pre-mortem (`docs/install-cache-family-premortem.md`) to predict defense #N+1.

## Acceptance criteria (Nyquist UAT -- from CONTEXT.md Step 0 block)

- [x] `git ls-remote --tags origin | grep v1.13.0-beta.13` returns `09ee5a4 refs/tags/v1.13.0-beta.13` (verified 2026-05-13 -- already passing)
- [ ] (optional) `npm view @mindrian_os/install@1.13.0-beta.13 version` returns `1.13.0-beta.13` (Path E: deferred to historical-record completeness; Phase 125's beta.14 publish supersedes for user-facing concerns)
- [ ] (optional) `npx @mindrian_os/install@1.13.0-beta.13` against a clean test dir exits 0 + produces expected scaffold (gated on optional Action 2 above)
- [x] `126-STEP-0-MANUAL-RECOVERY.md` documents the exact commands run (this file)

## Cross-references

- CONTEXT.md D2 (Step 0 absorbed into Phase 126 as first execution commit)
- CONTEXT.md "Path E rationale for deferring beta.13 npm publish" block
- `126-FEEDBACK-2026-05-13-windows-dogfood.md` (source of the two release-pipeline gaps)
- Plan 04 (`126-04-release-pipeline-hardening-PLAN.md`) prevents recurrence
- `feedback_release_lockstep_npm.md` (the 6-place npm lockstep rule)
- `feedback_install_minisite_lockstep.md` (the 7-place minisite lockstep -- Plan 04 promotes from Soft to Hard)
- `.claude/includes/release-process.md` (the 5-gate version consistency rule extended to 7 by the two feedback files above)

---

*Phase 126 Step 0 manual recovery doc -- absorbs into Phase 126 first execution commit per D2.*
