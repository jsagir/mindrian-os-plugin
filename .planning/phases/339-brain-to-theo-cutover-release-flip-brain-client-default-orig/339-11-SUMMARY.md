---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 11
subsystem: release
tags: [release, npm, verify-release, doctor-acceptance, prep-cut, theo-cutover]

requires:
  - phase: 339 (plans 01-10)
    provides: all wave 1-3 adaptations (origin-keyed alias tables, schema memo, enrichment capture, refusal honesty, literal sweep, connector docs, PREP changelog + tester note)
provides:
  - v2.0.0-beta.17 released and verified on npm, tag, marketplace pin, and install cache
  - one direct fix (commands/file-meeting.md:350 anchoring) required to clear verify-release
  - diagnosed and worked around a doctor.cjs npx-roundtrip cold-cache timing false-alarm (--light-npx)
  - recovered from a release.sh Step 5.5 tag-visibility false-alarm by manually completing Steps 9.8/10/11
affects: [339-12, 339-13, 339-14]

tech-stack:
  added: []
  patterns:
    - "check-plugin-path-anchoring.cjs violation attribution: trust the tool's own live --check output over static advisory text embedded in a different gate's error message (verify-release's gate 10c prints stale historical guidance)"
    - "doctor.cjs npx-roundtrip has a hardcoded 120s spawnSync timeout on a cold-cache npm install in a fresh sandbox HOME; --light-npx (npm view metadata only) is the sanctioned fallback when that times out, already proven correct by the untimed Step 9.7 npx self-test passing the same package"
    - "release.sh's Step 5.5 tag-visibility poll (3 retries x 5s) can false-alarm on GitHub ref-API propagation lag after a large commit (Commit A here included a full node_modules vendoring diff); the tag existing at origin is independently verifiable via git ls-remote, and the script's numeric step labels do not reflect execution order (9.5 publish runs before 5.5 verify)"

key-files:
  created: []
  modified:
    - commands/file-meeting.md (anchored the one unanchored references/ citation, commit 7b6c5787)
    - skills/file-meeting/SKILL.md (regenerated mirror, same commit)
    - .claude-plugin/plugin.json (2.0.0-beta.16 -> 2.0.0-beta.17 -> 2.0.0-beta.18, via release.sh Commits A and B)
    - package.json (same)
    - CHANGELOG.md (Unreleased -> v2.0.0-beta.17 released heading, fresh Unreleased -> v2.0.0-beta.18 opened)
    - dist/BUNDLE-VERSION.json (release.sh)

key-decisions:
  - "Navigator approved 5 explicit gates in sequence rather than one blanket go-ahead: (1) Task 1's 7-item precondition checklist, (2) proceed to Task 2, (3) how to clear the verify-release FAIL, (4) how to clear the doctor npx-roundtrip FAIL, (5) run Task 3 (the actual publish), (6) how to finish the Step 5.5-truncated tail"
  - "Fixed commands/file-meeting.md:350 directly (added ${CLAUDE_PLUGIN_ROOT}/ prefix) rather than allowlisting, once the real violating file was traced correctly -- it is a genuine, mechanically-fixable citation gap (same shape and same fix as the already-resolved DEVIATION-271-03-A on doctor.md), not a case needing a permanent suppression"
  - "Used --light-npx for both doctor --acceptance runs (pre-cut and post-cut) after confirming via direct timing (142s vs 120s hardcoded timeout) that the full install-based check was a timing false-alarm, not a real defect -- corroborated independently by Session T confirming registry health and by Step 9.7's own untimed npm-install check passing cleanly in the actual release run"
  - "Did not re-run release.sh after Step 5.5's exit 1 -- local version state had already advanced to beta.18 via Commit B, so a re-invocation would have misfired as a fresh beta.19 cut on top of an unfinished beta.17 tail. Instead manually ran the three steps that never got a chance to run (9.8, 10, 11), matching release.sh's own logic exactly, without touching any version file"
  - "Left two unrelated Phase 275 commits (d654f4f5, cf7b0bca) that landed on the local tree during Task 4's verification, unpushed and untouched -- not this plan's work, not reviewed by this plan, a normal shared-tree artifact per this repo's own documented incident pattern, and the release's own commits (cf99f110, 5b4bf79d) were independently confirmed pushed and matching origin"
  - "Pre-339 orphaned debris (6 deleted persona fixtures + docs/prototypes/specs/.scratch + a stray Phase 275/SEED-084 ROADMAP hunk, all predating both phase 339 and phase 276) was stashed losslessly (stash@{0}) rather than committed or discarded, per navigator decision, to clear Task 1's clean-tree gate"

patterns-established:
  - "When a release gate's OWN error text names a specific pre-existing blocker, verify against the tool's live output directly before accepting that attribution -- verify-release's gate 10c printed stale advisory text naming commands/doctor.md (already fixed by Phase 267.3), while the actual live violation was commands/file-meeting.md:350"

requirements-completed: [FLIP-01, FLIP-02, FLIP-03, FLIP-04, FLIP-05, FLIP-06, FLIP-07, FLIP-08]

duration: ~3h (across Task 1 gate presentation, Task 2 full suite run + one real fix, Task 3 the release itself, and Task 4's cache verification)
completed: 2026-09-04
---

# Phase 339 Plan 11: The PREP Cut (v2.0.0-beta.17) Summary

**v2.0.0-beta.17 is released, published, tagged, and verified on all four surfaces (npm, git tag at origin, marketplace pin, install cache) -- the PREP cut ships every wave 1-3 adaptation while leaving `brain-client.cjs` line 24 exactly on the incumbent, safe by construction.**

## Performance

- **Duration:** ~3h wall-clock across Task 1-4 (most of it test-suite runtime and one real npm-install-timing investigation)
- **Completed:** 2026-09-04
- **Tasks:** 4/4 (Task 1 blocking gate cleared, Task 2 full pre-flight suite, Task 3 the release, Task 4 four-surface verification)
- **Files modified:** 6 (2 hand-fixed, 4 release.sh-managed version files)

## Accomplishments

### Task 1: The blocking human gate

All 7 preconditions confirmed live, quoted verbatim to the navigator, then approved:
1. Phase 276 paused cleanly after 276-15 (SUMMARY exists); 276-16 parked at its own separate human-verification checkpoint, not mid-execution.
2. `git status --porcelain` empty -- pre-existing orphaned debris (6 deleted persona fixtures under `tests/fixtures/sample-room-personas/personas/`, untracked `docs/2026-08-20-gate0-queries.cypher`, `docs/2026-09-03-DESIGN-t2-write-back-minimal.md`, `docs/2026-09-03-HANDOFF-RESPONSE-*.md`, `docs/MINDRIANOS-PRD.md`, `prototypes/`, `specs/`, `.scratch/`, plus a modified `ROADMAP.md`/`SEED-084` hunk from Phase 275, all predating phases 339 and 276 -- Phase 276's last commit `d5ca9cfa` sits below 339-01 in the log) was stashed losslessly: `git stash push -u -m "pre-339 orphaned debris..."`, recoverable at `stash@{0}`.
3. 439 commits ahead of origin, pushed in Task 2.
4. `npm whoami` -> `jsagir`, succeeds.
5. `~/mindrian-website/website` present, origin remote confirmed.
6. `claude plugin validate` on PATH, OK.
7. `CHANGELOG.md` carried `## [Unreleased] -- v2.0.0-beta.17 (in progress)`.

### Task 2: Full pre-flight suite, one real fix

Pushed 439 commits (`8da9ed62..67b95465`). Ran the phase 339/250/252 suites (all green), 8 individual named test files (all green), the phase 276 suite (green -- the cut does not break the concurrent phase), the registry/projection/coverage/anchoring checks, then `verify-release`.

**Found and traced a real FAIL**, not phase 339's own: `verify-release` gate 10c reported 1 unanchored `references/` citation, with its own error text naming `commands/doctor.md` (a stale reference to an already-resolved Phase 267.3 blocker, DEFERRED-271-D1). Traced the tool's own live `--check` output directly instead of trusting that static text: the real, sole, current violation was `commands/file-meeting.md:350`, a bare backtick citation of `references/meeting/filing-protocol.md` introduced at commit `2f1f4cf3` (2026-09-03), predating phase 339 and already named in this repo's own 2026-09-03 handoff doc as measured baseline noise from `276-15`.

Fixed directly (commit `7b6c5787`): added the `${CLAUDE_PLUGIN_ROOT}/` prefix inside the existing backticks, matching the exact precedent already established for the identical citation shape on `commands/doctor.md` (DEVIATION-271-03-A / Phase 267.3 plan 05). Regenerated the `skills/file-meeting/SKILL.md` mirror (it had gone stale on the same line). `check-plugin-path-anchoring.cjs --check`: 0 violations (was 1). Pushed (`67b95465..7b6c5787`).

Re-ran `verify-release`: **36 passed, 0 failed, 2 warnings** (both expected/cosmetic: 39 pre-existing render-quality description-length nits, and the CHANGELOG-not-yet-renamed-to-beta.17 warning the plan already predicted). **CLEAR TO RELEASE v2.0.0-beta.16.**

`doctor.cjs --acceptance` (bare): 17/18, one FAIL (`npx-roundtrip`, `npm install @mindrian_os/cli@2.0.0-beta.15 failed (null)`). Diagnosed: `null` is spawnSync's status when its hardcoded 120000ms timeout fires; a direct timed re-run measured 142s wall-clock for the same cold-cache install (a fresh `mktemp` HOME + `npm_config_cache` every run, by design) -- a timing limit, not a registry or package defect (Session T independently confirmed the registry and package name were both healthy). Used the tool's own sanctioned lighter path, `--light-npx` (npm view metadata only, no install): **18/18**.

`bash scripts/release.sh --prerelease --dry-run`: confirmed `2.0.0-beta.16 -> 2.0.0-beta.17`, 0 commits ahead of origin.

### Task 3: The release

Navigator approved. Ran `bash scripts/release.sh --prerelease`. Substantively succeeded in full:
- **npm publish**: `@mindrian_os/cli@2.0.0-beta.17` published, tarball payload-gate clean (6 allowlisted files: `CHANGELOG.md`, `LICENSE`, `README.md`, `bin/cli.js`, `lib/core/active-plugin-root.cjs`, `package.json` -- no `node_modules` leak), dist-tags `latest` and `next` both promoted to `2.0.0-beta.17`.
- **Website sync** (Step 9.6b): committed and pushed to `mindrian-website` (`fcdd71d..efe504d`), live-polled `https://mindrian-os.com/` and confirmed serving v2.0.0-beta.17 in 33s.
- **npx self-test** (Step 9.7, untimed): PASSED -- "published package installs (npm install) + bin present + parses (node --check) + linked."
- **Push** (Step 9): plugin `main` + tag `v2.0.0-beta.17` pushed (`7b6c5787..5b4bf79d`); marketplace `master` pushed (`c5e9d6c..c2b764a`).

**Step 5.5 (tag-visibility verification, 3 retries x 5s) false-alarmed and called `exit 1`**: GitHub's ref API had not yet reflected the fresh push (a large diff -- Commit A vendors/un-vendors `node_modules` -- can widen this window past the default 15s retry budget). A direct `git ls-remote --tags origin | grep beta.17` immediately after confirmed the tag genuinely was there. Because the script runs under `set -euo pipefail`, this halted execution before Steps 9.8 (post-publish `doctor --acceptance`), 10 (marketplace cache update), and 11 (final HEAD-match / cache-version / validate checks) ever ran.

**Shipped tag, read back from git, never from prose:** `v2.0.0-beta.17` (commit `cf99f110`). `.claude-plugin/plugin.json` after Commit B: `2.0.0-beta.18`. `CHANGELOG.md` top heading after the cut: `## [2.0.0-beta.17] - 2026-09-04` followed by a fresh `## [Unreleased] -- v2.0.0-beta.18`.

**Recovery decision**: did NOT re-run `release.sh --prerelease` (local version state had already advanced to `beta.18` via Commit B; a re-run would have misfired as a fresh `beta.19` cut layered on an unfinished `beta.17` tail rather than resuming it). Instead manually ran the three steps that release.sh itself never reached, in the same order and with the same logic, touching no version file:
- **Step 9.8 retry**: `node scripts/doctor.cjs --acceptance` hit the SAME cold-cache `npx-roundtrip` timeout, now against `beta.17` (`npm install @mindrian_os/cli@2.0.0-beta.17 failed (null)`) -- confirming the diagnosis from Task 2 was correct and reproducible, not a one-off. `--light-npx`: **18/18**.
- **Step 10**: `claude plugin marketplace update mindrian-marketplace` -- succeeded.
- **Step 11**: marketplace cache version confirmed `2.0.0-beta.17` (matches expected). Remote-vs-local plugin-repo HEAD check reported a mismatch -- traced to two unrelated Phase 275 commits (`d654f4f5`, `cf7b0bca`, "ICM-layer room schema enlargement") that landed on the shared local tree during this task's verification window, from a concurrent session; not this plan's work, left unpushed and untouched by this plan. The release's OWN commits (`cf99f110`, `5b4bf79d`) were independently confirmed present at origin before this discrepancy was even investigated. `claude plugin validate .` passed with one pre-existing, unrelated warning (root `CLAUDE.md` not auto-loaded as plugin context; recommends a skill instead -- not a release blocker, not new).

### Task 4: Four-surface post-release verification (against the CACHE, not the dev tree)

- **npm**: `2.0.0-beta.17` present in `npm view @mindrian_os/cli versions`; `dist-tags` = `{ latest: '2.0.0-beta.17', next: '2.0.0-beta.17' }`.
- **Tag at origin**: `git ls-remote --tags origin | grep v2.0.0-beta.17` -> `cf99f1108a29997abd49492690dac2c460e180c7 refs/tags/v2.0.0-beta.17`.
- **Marketplace pin**: `~/mindrian-marketplace/.claude-plugin/marketplace.json` version `2.0.0-beta.17`, `source.ref` presumed pinned to the tag per Step 4's own contract (verified via the earlier dry-run's Step 4 description and the marketplace repo's clean, pushed state -- `git status --porcelain` empty, 0 ahead of origin).
- **Install cache**: ran the two-command update path (`claude plugin marketplace update mindrian-marketplace`, then `claude plugin update mos@mindrian-marketplace`) -- cache moved from `2.0.0-beta.13` to `2.0.0-beta.17`. Confirmed in the cached tree at `~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.17/`:
  - `plugin.json` version: `2.0.0-beta.17`.
  - `lib/core/brain-client.cjs:24`: `const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://pws-brain-mcp.onrender.com';` -- **still the incumbent, line 24 did not move**, exactly as required for the PREP cut.
  - `THEO_ORIGINS` and `_schemaCacheOrigin` both present (4 occurrences each) -- the PREP adaptations shipped in the cache, not just the dev tree.
  - `lib/core/update-path.cjs` exists in the cache.
  - Nothing written under `~/.claude/plugins/` beyond the CLI's own managed cache/marketplace/`installed_plugins.json` updates (the expected side effect of the two update commands themselves).
- **`FALLBACK_VERSION` sync**: ran (not skipped with `--no-website`); deploy push succeeded and the live site was confirmed serving the new version within 33s.

## Deviations

1. **verify-release's real violation was mis-attributed by its own static advisory text** (Rule 1, root-caused before patching): fixed the actual site (`commands/file-meeting.md:350`), not the one named in the tool's stale error copy.
2. **doctor.cjs `npx-roundtrip` false-alarmed twice** (once pre-cut against beta.15, once post-cut against beta.17), both confirmed as the same 120s-timeout-on-cold-cache-install class, both cleared via the tool's own `--light-npx` escape hatch after independent corroboration (timing measurement, registry health check by Session T, and the untimed Step 9.7 self-test passing).
3. **release.sh Step 5.5 false-alarmed and aborted the script early**, after the substantive release (publish, website, push) had already succeeded. Recovered by manually completing Steps 9.8/10/11 rather than re-invoking the script, since local version state had already moved past what a fresh invocation would expect.

None of these three findings are phase 339 defects; all three are pre-existing environment/tooling quirks this plan's execution surfaced and worked through, each with the navigator's explicit sign-off at the point of decision.

## Requirements Completed

FLIP-01, FLIP-02, FLIP-03, FLIP-04, FLIP-05, FLIP-06, FLIP-07, FLIP-08 -- all shipped in a released, published, cache-verified artifact, not merely committed.
