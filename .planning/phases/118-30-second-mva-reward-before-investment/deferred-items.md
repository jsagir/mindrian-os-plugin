# Phase 118 - Deferred Items

Logged during execution of Plan 118-06 (rule-linter-dror-harness).

## Pre-existing build-command-registry teaching-field gap (out of scope)

**Discovered:** 2026-05-15 during Plan 118-06 Task 2 pre-commit gate.

**Symptom:** `node scripts/build-command-registry.cjs --check` exits non-zero with:
```
[build-command-registry] ERROR: 2 commands missing teaching field: /mos:mva-brief, /mos:mva-option
```

**Cause:** `commands/mva-brief.md` and `commands/mva-option.md` (shipped by Plans 118-04 + 118-05) do not declare a `teaching` field in their frontmatter. The Phase 122 build-command-registry guard expects every interactive command to carry that field (per docs/COMMAND-FRONTMATTER.md). The two MVA helper commands were intentionally minimal and the teaching prose was deferred.

**Scope boundary:** Plan 118-06 only touches the 4 commands the reward-before-investment rule doc names (new-project, file-meeting, grade, onboard). Plan 06's scope is the LINTER and the 4-COMMAND DECLARATIONS, not the Phase 122 teaching-field invariant on Plan 04/05's MVA helpers.

**Resolution path:** Add `teaching:` strings to `commands/mva-brief.md` + `commands/mva-option.md` in a follow-up commit (or roll into Plan 118-06 SUMMARY work if time permits). The strings should be one-to-two-sentence Larry-voice descriptions per Phase 104.1 conventions (50-300 chars, no em-dashes).

**Status during Plan 118-06 commit chain:** Plan 06 commits use `COMMIT_NO_VERIFY=1` (per memory hard rule + Phase 125-08 wave-protocol invariant: bypass allowed for emergency / wave-protocol; open canon-amendment PR or follow-up phase within 24 hours). Tracked here so the gap is not silently absorbed.

## Live `.git/hooks/pre-commit` is stale

**Discovered:** 2026-05-15 during Plan 118-06 Task 2 hook-wire verification.

**Symptom:** `.git/hooks/pre-commit` (234 lines, installed from an earlier version of `scripts/hooks/pre-commit`) does not contain the Plan 118-06 linter block (the source-of-truth tracked file is now 272 lines).

**Cause:** `scripts/install-pre-commit.sh` is a one-shot installer; it does not re-sync the live hook when `scripts/hooks/pre-commit` is updated. Phase 87-01a + Phase 108-05 + Phase 122 all had this issue and contributors re-run the installer manually.

**Resolution path:** The Plan 118-06 deliverable is the SOURCE file (`scripts/hooks/pre-commit`) + the linter scripts. Contributors who want the live hook to enforce the new linter must re-run `bash scripts/install-pre-commit.sh` (the same Phase 108-05 convention). A future hardening phase could make the installer idempotent + auto-syncing.

**Status during Plan 118-06 commit chain:** Test 8 (T8 in `lib/core/mva-rule-linter.test.cjs`) asserts the SOURCE file is wired. Test 9 (T9) copies the SOURCE file into a temp git repo + runs it directly via `bash` -- proving the source's correctness independent of the install state. Both tests GREEN.
