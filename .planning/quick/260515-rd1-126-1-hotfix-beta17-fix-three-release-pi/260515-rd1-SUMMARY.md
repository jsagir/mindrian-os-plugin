---
quick_id: 260515-rd1
slug: 126-1-hotfix-beta17-fix-three-release-pipeline-bugs
date: 2026-05-15
type: quick
phase: 126.1-hotfix-beta17
target_release: v1.13.0-beta.17
parent_phase: 126-install-lifecycle-harness-gaps
canon_parts: [Part 6, Part 7, Part 8]
commits:
  - a3cab9ca: "fix(126.1): add pre-flight tier + restore Test 2 + Step 2.5 release.sh gate (Bug 1)"
  - d12deb24: "fix(126.1): Commit B bumps marketplace.json (Bug 2) + Step 9.7 sandbox (Bug 3) + Tests H + I"
  - 3d4e16b9: "chore(126.1): verify mva-brief + mva-option teaching: frontmatter"
files_modified:
  - scripts/release.sh
  - scripts/doctor.cjs
  - tests/test-doctor-acceptance-preflight-checks.cjs
  - tests/test-release-bump-algebra.cjs
  - CHANGELOG.md
files_verified_only:
  - commands/mva-brief.md
  - commands/mva-option.md
status: complete
---

# Quick Task 260515-rd1 Summary

Three release-pipeline bugs surfaced during the v1.13.0-beta.16 cut, plus one
opportunistic Phase 122 invariant cleanup. All four atomic and self-contained.
No version bump in this hotfix; the version cut happens via
`scripts/release.sh --prerelease` afterward (will land as v1.13.0-beta.17).

## What Shipped

### Bug 1: Step 6.6 ordering hole (commit `a3cab9ca`)

**Problem.** Phase 126 beta.16 hotfix `3fc008b` moved `verify-release-clean-tree`
from `applies_to: ['pre-tag', 'full']` to `['full']` because `release.sh` Step
6.6 invokes `--pre-tag` AFTER its own Steps 3-6 intentionally bump 3 tracked
files (`plugin.json` + `package.json` + `CHANGELOG.md`). That made the cut sail
through, but the strict clean-tree gate no longer ran pre-tag AND Test 2 of
`tests/test-doctor-acceptance-preflight-checks.cjs` was converted to SKIP
rather than re-pointed. Predicted defense in
`docs/install-cache-family-premortem.md` Section 3.

**Fix (Option B per plan decision).** Introduce a new `pre-flight` tier that is
a strict subset of `pre-tag` MINUS in-flight-incompatible checks. Surface
added:

- `scripts/doctor.cjs`:
  - `flags.preFlight` added to the argument parser; `--pre-flight` CLI arm
    added; help text updated.
  - `--pre-flight` implies `--acceptance` (parallel to `--pre-tag`); if both
    are passed, `--pre-tag` wins downstream.
  - Tri-state mode resolver in `runAcceptance` and the JSON error fallback:
    `flagPreTag ? 'pre-tag' : (flagPreFlight ? 'pre-flight' : 'full')`.
  - `verify-release-clean-tree.applies_to` changed to `['pre-flight', 'full']`.
  - `release-dry-run-output` expected step list updated to include `'Step 2.5'`.

- `scripts/release.sh`:
  - New Step 2.5 inserted between Step 2 (verify-release) and Step 3 (bump):
    calls `node scripts/doctor.cjs --acceptance --pre-flight`. HARD ABORT
    on failure; no rollback needed because nothing has been mutated yet.
  - Dry-run planned-sequence echo updated to include the Step 2.5 line.

- `tests/test-doctor-acceptance-preflight-checks.cjs`:
  - Added `runAcceptancePreFlight(home, extraEnv)` and
    `runAcceptancePreFlightLive(extraEnv)` helpers (mirror the existing
    `runAcceptance` + `runAcceptanceLive` idiom but use `--pre-flight`).
  - Replaced the SKIP for Test 2 with a real synthesized-failure assertion
    under `--pre-flight` mode (mirrors the Tests 3-5 pattern with the new
    tier).
  - Added Test 8: `--pre-flight` tier filter sanity. Asserts
    `result.json.mode === 'pre-flight'`, the points array contains
    `verify-release-clean-tree`, AND does NOT contain any `applies_to:
    ['full']`-only entry (`version-of-record-published`, `npx-roundtrip`).
  - Updated file-header docstring to mention the Phase 126.1 hotfix +
    the `pre-flight` tier.

**Decision rationale (Option B vs Option A).** Option A (move
`release.sh` Step 6.6 to BEFORE Step 3 bumps) would re-introduce the original
hotfix problem -- Steps 3-6 would then run AFTER the clean-tree check but the
file mutations would be unprotected by a subsequent re-check (the pre-existing
Step 6.5 "post-bump re-verification" covers post-bump state but not the
pre-bump clean-tree invariant). The minimal, surgical fix is the new
`pre-flight` tier called from a new Step 2.5 placed BEFORE Step 3, with the
existing Step 6.6 `--pre-tag` call still firing after Step 6 (still the right
tier for post-bump checks). Net surface added: 1 new tier in `applies_to`
enums, 1 new flag `--pre-flight` in `doctor.cjs`, 1 new ~10-line Step 2.5 in
`release.sh`.

### Bug 2: Commit B 7-place lockstep gap (commit `d12deb24`)

**Problem.** `scripts/release.sh` Step 7.5 (Commit B, the next-pre-release
advance) bumped `plugin.json` + `package.json` to `NEXT_VERSION` but left
`~/mindrian-marketplace/.claude-plugin/marketplace.json` at `vN`. Per
`feedback_install_minisite_lockstep.md`, the 7-place lockstep contract
requires the marketplace.json `version` field to advance with the plugin repo
on the next-pre-release transition. The bug recurred in beta.16. The
pre-existing structural test `tests/test-release-bump-algebra.cjs` did not yet
assert marketplace.json is in Commit B's bump set.

**Fix.** Step 7.5 now writes a second `node -e` block that bumps
`MARKETPLACE_DIR/.claude-plugin/marketplace.json` `m.plugins[0].version` to
`$NEXT_VERSION` (version field only -- `source.ref` deliberately stays at
`v$NEW_VERSION`, pinning the marketplace commit at Commit A's tag so installs
continue to resolve the released artifact). Parallel marketplace-repo `git
commit` follows with message `chore: bump marketplace.json to v$NEXT_VERSION
(Commit B 7-place lockstep)`. Dry-run echo for Step 7.5 updated to mention
the marketplace bump.

Test H added to `tests/test-release-bump-algebra.cjs`:
- Locates the `# --- Step 7.5: Commit B` block header in `scripts/release.sh`.
- Asserts the next ~6000 chars contain `marketplace.json`.
- Asserts the marketplace bump pattern matches
  `/m\.plugins\[0\]\.version\s*=\s*['"]\$NEXT_VERSION['"]/`.
- Asserts the `Commit B 7-place lockstep` commit message marker is present.

### Bug 3: Step 9.7 npx-publish self-test sandbox bug (commit `d12deb24`)

**Problem.** `scripts/release.sh` Step 9.7 ran `npx --yes
@mindrian_os/install@<version>` from an `mktemp -d` temp dir and checked the
dir was non-empty after the install -- but `@mindrian_os/install` installs
into `~/.claude/` (the Claude Code plugin install root), NOT into cwd. The
temp-dir check spuriously failed during the beta.16 cut.

**Fix (Option A per scope note).** HOME-override sandbox at
`~/.claude/_test-install-<sha8>/` (subpath under `~/.claude/` per the scope
note; mirrors the Phase 123 `doctor.cjs:2336` sandbox pattern). The npx run
sets:
- `HOME=$NPX_TEST_DIR`
- `USERPROFILE=$NPX_TEST_DIR`
- `npm_config_cache=$NPX_TEST_DIR/.npm`

so the install resolves into the sandbox subpath, never touching the
operator's real `~/.claude/`. Scaffold marker check now asserts
`$NPX_TEST_DIR/.claude/plugins/installed_plugins.json` exists AND is parseable
JSON. `trap` cleanup guarantees the sandbox dir + the pre-snapshot file are
removed even on abort. The sha8 of `$NEW_VERSION + $(date +%s)` provides
uniqueness; falls back to `date +%s` tail if `shasum`/`sha256sum` is
unavailable. Pre-snapshot of the operator's real `~/.claude/plugins/`
install-surface is captured to `/tmp/npx-selftest-snapshot-<sha8>.txt` for
debugging.

Test I added to `tests/test-release-bump-algebra.cjs`:
- Locates the `# --- Step 9.7: npx-publish self-test` block header.
- Asserts the block contains `_test-install-` (sandbox path marker).
- Asserts the block does NOT contain `mktemp -d -t mos-npx-selftest` (the
  legacy broken pattern).
- Asserts the block contains `HOME=$NPX_TEST_DIR` (HOME-override marker).

**Option B deferred follow-up.** Option B (extend
`~/mindrianos-install-site` npm-installer with a `--target=<dir>` flag) is
the cleaner long-term fix but out of scope for this hotfix (separate repo;
two-commit surface). Logged here for v1.14.0 consideration:

> **Deferred: `~/mindrianos-install-site` npm-installer `--target=<dir>` flag.**
> Refactor the npm-installer entry to accept a `--target=<dir>` argument that
> redirects the install root from `~/.claude/` to an arbitrary path. Then
> `release.sh` Step 9.7 could just call `npx --yes @mindrian_os/install@<v>
> --target=/tmp/sandbox-<sha8>` and a plain `mktemp -d` temp-dir check would
> work. Eliminates the HOME-override hack. Out of scope for Phase 126.1
> because the change lives in a separate repo (`~/mindrianos-install-site`)
> and needs its own publish + version-bump cycle. Track for v1.14.0.

### Verification-only: Phase 122 `teaching:` frontmatter (commit `3d4e16b9`)

**Inspection finding.** The plan flagged
`commands/mva-brief.md` + `commands/mva-option.md` as potentially missing
`teaching:` frontmatter (per `.planning/phases/118-30-second-mva-reward-before-investment/deferred-items.md` lines 5-20). Reading both files showed the
strings were already added between Plan 118-06 and this audit. All four Phase
122 invariants from `docs/COMMAND-FRONTMATTER.md` section 3 verified clean:

| Invariant | mva-brief.md | mva-option.md | Constraint |
|-----------|--------------|---------------|------------|
| Length (chars) | 200 | 180 | 50 <= chars <= 300 |
| Em-dashes | 0 | 0 | ZERO (`feedback_no_emdashes.md`) |
| Sentence count | 2 | 2 | 1 or 2 (terminal `.!?`) |
| Larry-voice | YES | YES | WHY before WHAT |

`node scripts/build-command-registry.cjs --check` exits 0 (no missing-field
reports). `node scripts/build-command-registry.cjs` regen wrote 88-command
registry byte-identical to the on-disk file. No source edits required;
verification-only commit. The pre-existing `118/deferred-items.md`
"Pre-existing build-command-registry teaching-field gap" entry can be marked
RESOLVED in a follow-up doc edit (out of scope for this hotfix).

## Whole-Task Gate Results

```bash
node tests/test-doctor-acceptance-preflight-checks.cjs
  -> 7 PASS + 1 known maintainer-env FAIL (Test 7).
     Tests 1, 2, 3, 4, 5, 6, 8 all PASS.
     Test 2 (verify-release-clean-tree synthesized failure under --pre-flight) NEW GREEN.
     Test 8 (--pre-flight tier filter sanity) NEW GREEN.
     Test 7 (isolation test) is the pre-existing maintainer-env issue
     documented in 118/deferred-items.md line 45: this maintainer's box has
     a legacy plugin clone at /home/jsagi/.claude/plugins/mindrian-os
     alongside the marketplace-cache install. The install-state check
     correctly flags real drift. Not a Phase 126.1 regression.

node tests/test-release-bump-algebra.cjs
  -> 9/9 PASS (A-I).
     Tests H (Commit B marketplace.json bump) and I (Step 9.7 sandbox)
     are NEW GREEN.

node scripts/build-command-registry.cjs --check
  -> Exit: 0 (command-registry: OK).

bash scripts/release.sh --dry-run
  -> Exit: 0. Emits in planned sequence:
       Step 2.5  : run mindrian-os doctor --acceptance --pre-flight
                   (HARD ABORT; clean-tree gate before any mutation)
       Step 7.5  : commit B on plugin repo -- bump to v$NEXT, CHANGELOG
                   [Unreleased] -- v$NEXT; marketplace repo -- bump
                   marketplace.json to v$NEXT (7-place lockstep; source.ref
                   stays at v$NEW)
       Step 9.7  : npx-publish self-test
                   (sandbox underneath now ~/.claude/_test-install-<sha8>/)
     No mutation to working tree.
```

## Commit Chain

| # | Hash | Subject |
|---|------|---------|
| 1 | `a3cab9ca` | `fix(126.1): add pre-flight tier + restore Test 2 + Step 2.5 release.sh gate (Bug 1)` |
| 2 | `d12deb24` | `fix(126.1): Commit B bumps marketplace.json (Bug 2) + Step 9.7 sandbox (Bug 3) + Tests H + I` |
| 3 | `3d4e16b9` | `chore(126.1): verify mva-brief + mva-option teaching: frontmatter` |

All commits authored under standard pre-commit hook (no `--no-verify`).

## No Version Bump

This hotfix lands on `main` as a non-tag commit chain. `scripts/release.sh
--prerelease` will cut beta.17 afterward; the new `[Unreleased] --
v1.13.0-beta.17 (in progress)` heading at the top of `CHANGELOG.md` absorbs
the three `### Fixed` bullets (Bug 1, Bug 2, Bug 3) and one `### Changed`
bullet (the teaching-field verification audit).

## Deviations from Plan

**None for Bugs 1, 2, 3 -- executed exactly as planned.** Option B chosen for
Bug 1 (introduce `pre-flight` tier + Step 2.5) and Option A chosen for Bug 3
(HOME-override sandbox under `~/.claude/_test-install-<sha8>/`) per the plan's
explicit `<scope>` notes.

**Task 3 was verification-only** as anticipated by the plan's inspection note:
"Inspection note: I read `commands/mva-brief.md` + `commands/mva-option.md`
directly and BOTH files already have `teaching:` strings in their frontmatter
... if they honor the Phase 122 invariants, Task 3 is a verification-only
no-op." Both strings honored all 4 invariants; no source edits applied; the
commit is a `chore:` audit-trail commit + CHANGELOG entry only.

## Canon Parts Honored

- **Part 6 (Product-as-Venture / Dog-Fooding).** The release pipeline itself
  is a venture surface that gets hardened with every cut. Bugs 1, 2, 3 were
  all surfaced by an actual production cut (beta.16), absorbed into the
  pipeline's own self-tests (`tests/test-doctor-acceptance-preflight-checks.cjs`
  Test 2 + Test 8, `tests/test-release-bump-algebra.cjs` Tests H + I), and
  defended structurally by the new `--pre-flight` gate + the Commit B
  marketplace bump + the HOME-override sandbox.
- **Part 7 (Reuse Before Build).** Bug 1's `pre-flight` tier reuses the
  existing `applies_to` filter logic with a new tier rather than forking a
  separate gate. Bug 3's HOME-override sandbox reuses the `doctor.cjs:2336`
  sandbox pattern. Bug 2's Commit B marketplace bump reuses the existing
  `node -e` JSON-mutate idiom from Step 4 (which already bumps marketplace.json
  for Commit A).
- **Part 8 (Graph Boundary).** Zero new network surface. The npx self-test
  was already permitted post-publish; the sandbox change is local-only. All
  three bugs sit in the release-infrastructure layer below the
  LOCAL/BRAIN/SIGNAL contract.

## Deferred Follow-Ups (out of scope)

1. **`~/mindrianos-install-site` npm-installer `--target=<dir>` flag** (Bug 3
   Option B): cleaner long-term fix than the HOME-override sandbox. Track for
   v1.14.0. Separate repo, two-commit surface.
2. **`118/deferred-items.md` lines 5-20 mark RESOLVED**: the
   "Pre-existing build-command-registry teaching-field gap" entry can be
   marked RESOLVED in a follow-up doc edit. Separate doc edit, not in this
   Task's scope.
3. **`docs/install-cache-family-premortem.md` Section 3 Prediction E**
   (`NEXT_PUBLIC_MINDRIAN_VERSION` env-var fix) remains the v1.14.0+ retire
   path for Step 9.6 + Step 9.7 entirely -- eliminates both the minisite
   hardcoded-version surface AND the npx-roundtrip self-test (the env-var
   approach is build-time, not install-time, so there's nothing to round-trip
   against).
4. **Test 7 (`tests/test-doctor-acceptance-preflight-checks.cjs` isolation
   test)** continues to FAIL on the maintainer's box because of the legacy
   plugin clone at `/home/jsagi/.claude/plugins/mindrian-os` alongside the
   marketplace-cache install. Remedy: operator runs `mindrian-os doctor --fix
   --install-state` to migrate the legacy clone (backup-then-remove pattern).
   Not in scope for Phase 126.1 (per `118/deferred-items.md` line 45, this is
   Phase 95.1/95.2/123 substrate, and the failure is correctly flagging real
   drift -- the test asserts a clean box).

## Authentication Gates

None. All work was local file edits + git commits; no external services
contacted.

## Self-Check

- [x] All 3 tasks executed
- [x] Each task committed atomically (3 commits: `a3cab9ca`, `d12deb24`, `3d4e16b9`)
- [x] Gate 1 (`tests/test-doctor-acceptance-preflight-checks.cjs`): 7 PASS + 1 known maintainer-env FAIL (Test 7); Tests 2 + 8 NEW GREEN
- [x] Gate 2 (`tests/test-release-bump-algebra.cjs`): 9/9 PASS A-I; Tests H + I NEW GREEN
- [x] Gate 3 (`scripts/build-command-registry.cjs --check`): exit 0
- [x] Gate 4 (`scripts/release.sh --dry-run`): exit 0; Step 2.5 + Step 7.5 (marketplace) + Step 9.7 emitted
- [x] No em-dashes anywhere in commits, files, or output (verified by Perl-regex grep on modified files; output empty)
- [x] Workspace = `/home/jsagi/MindrianOS-Plugin/` (never `~/.claude/plugins/`)
- [x] No version bump in this hotfix (release.sh --prerelease will cut beta.17 afterward)
- [x] ROADMAP.md not updated (quick tasks track in STATE.md "Quick Tasks Completed", not ROADMAP)
- [x] No `--no-verify` used on any commit

## Self-Check: PASSED

All claimed commits exist:

```
$ git log --oneline -3
3d4e16b9 chore(126.1): verify mva-brief + mva-option teaching: frontmatter
d12deb24 fix(126.1): Commit B bumps marketplace.json (Bug 2) + Step 9.7 sandbox (Bug 3) + Tests H + I
a3cab9ca fix(126.1): add pre-flight tier + restore Test 2 + Step 2.5 release.sh gate (Bug 1)
```

All modified files exist on disk:
- `scripts/doctor.cjs` FOUND
- `scripts/release.sh` FOUND
- `tests/test-doctor-acceptance-preflight-checks.cjs` FOUND
- `tests/test-release-bump-algebra.cjs` FOUND
- `commands/mva-brief.md` FOUND (verified only; teaching: line 6 unchanged)
- `commands/mva-option.md` FOUND (verified only; teaching: line 6 unchanged)
- `CHANGELOG.md` FOUND (3 `### Fixed` bullets + 1 `### Changed` bullet under new
  `[Unreleased] -- v1.13.0-beta.17 (in progress)` heading)

## Known Stubs

None. All edits are full implementations; no placeholders.

---

_Quick task 260515-rd1 closed 2026-05-15. Ready for `bash scripts/release.sh --prerelease` to cut v1.13.0-beta.17 when the operator is ready._
