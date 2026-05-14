---
status: partial
phase: 126-install-lifecycle-harness-gaps
source: [126-VERIFICATION.md]
started: 2026-05-14T11:30:00Z
updated: 2026-05-14T11:30:00Z
verifier: gsd-verifier (sonnet)
auto_score: 9/9 must-haves verified
auto_proof: all 7 Phase 126 test files + Phase 123/95.1/95.2 regression guards GREEN; cross-plan invariants (WARN 1/2/3) confirmed; acc.5 deferred-failure RESOLVED post-Plan-04 rename
---

## Current Test

[awaiting human testing — requires the beta.15 release cut]

## Tests

### 1. Step 9.6 install-minisite HARD lockstep end-to-end

expected:
- Run `scripts/release.sh --prerelease` for beta.15 from `/home/jsagi/MindrianOS-Plugin/`
- FIRST RUN expected failure: `~/mindrianos-install-site` has no `origin` remote → release.sh fails loud with the exact recovery command `cd ~/mindrianos-install-site && git remote add origin <url> && git push -u origin main` (the WARN 2 invariant — origin-missing path emits `git remote add origin`, NOT `gh repo clone`).
- After one-time bootstrap (operator runs the recovery command), re-run `scripts/release.sh --prerelease` completes Step 9.6 cleanly:
  - sed-rewrites `lib/os.ts:149` + `app/page.tsx:30` to v1.13.0-beta.15
  - grep-verifies new version present + old version absent
  - commits + pushes `release: v1.13.0-beta.15` to minisite repo
  - polls `https://mindrianos-install-site.vercel.app/` for the new version string within 180s timeout

result: [pending]

### 2. Tester upgrade path — install-state.json v1 → v2 migration

expected:
- Pull beta.15 on a machine that has been on beta.13 or beta.14 (Lawrence's box, Gary's box, or a clean local snapshot)
- Session-start emits the migration message: `[session-start] install-state migrated v1 -> v2` (one line, plain stderr)
- New v2 fields populate correctly: `schema_version: 2`, `topology_class`, `last_acceptance_run`, `renderer_contract_version`
- Existing v1 fields preserved byte-identical (the 9 D-04 keys from Phase 123)
- NO manual `/mos:doctor --fix` required — migration is transparent
- Running `/mos:doctor --acceptance --json` post-migration shows all 5 new preflight checks from Plan 05 in the output

result: [pending]

### 3. Vercel live-deploy confirmed

expected:
- After Step 9.6 completes the git push to `~/mindrianos-install-site/`, Vercel's auto-deploy fires (NOT a release.sh-invoked `vercel --prod`; just the git-push-triggered webhook)
- Browser visit to `https://mindrianos-install-site.vercel.app/` shows `v1.13.0-beta.15` in BOTH locations:
  - The terminal-display string from `lib/os.ts:149`
  - The eyebrow text from `app/page.tsx:30`
- This closes the `feedback_install_minisite_lockstep.md` Hard-tier enforcement loop end-to-end (the 5-times-stale drift from beta.9 → beta.14 cannot recur because release.sh now fails loud if any of the three checkpoints — MINISITE_DIR resolution, sed verify, Vercel live-poll — fail)

result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Pre-work

Before Test 1 can fire its happy-path branch, the operator must complete the one-time minisite origin bootstrap (handoff open decision #2 from the start of this session):

```bash
cd ~/mindrianos-install-site
git remote add origin <github-or-gitlab-url>
git push -u origin main
```

The Plan 04 design INTENTIONALLY chose the fail-loud-with-recovery approach (Open Question 7 option b) over auto-bootstrap (option a). The first beta.15 cut serves a dual purpose: it ships the new code AND it surfaces the origin-missing recovery message in a real, observed run, which is the strongest possible end-to-end proof that Step 9.6's failure-mode-routing works.

## Gaps

[none — all 9 must-haves verified at the automation level; pending items are live-environment behaviors awaiting the beta.15 release cut]
