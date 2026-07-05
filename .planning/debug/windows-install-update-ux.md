---
kind: qa-sweep
slug: windows-install-update-ux
opened: 2026-07-02
status: in-progress
owner: main-session (dev repo)
---

# QA sweep: install / update / health "not smooth" (esp. Windows)

Navigator reports (2026-07-02): Windows install AND update do not go smoothly ("a lot of issues");
`/mos:update` said "you're current" on a beta while stable shipped; the statusline needed manual
doctoring. This sweep traces the cluster. Each finding is classified WORKING / FIXED / HYPOTHESIS
(needs Windows repro) / OPEN.

## Findings

### F1 - npm bare-npx served the old stable (FIXED)
`npx @mindrian_os/cli` (no version) resolves the `latest` dist-tag, which sat at 1.14.0 because betas
publish to `@next` by design. Testers on the documented bare command got 1.14.0.
FIX: cut stable 1.15.0 (release.sh --finalize) -> `latest` moved 1.14.0 -> 1.15.0. Bare npx now serves
1.15.0. (Verified live: `npm view @mindrian_os/cli dist-tags` latest=1.15.0.)

### F2 - updater ranked betas ABOVE their stable (FIXED, ships 1.15.1)
`scripts/check-version-and-sha.cjs` compareSemver did `split('.').map(parseInt)`, so
`1.15.0-beta.13` parsed as `[1,15,0,13]` and compared GREATER than stable `[1,15,0]`. Every
`1.15.0-beta.N` tester was told "you're current" and never updated. Self-limiting: stable-to-stable
comparison was unaffected.
FIX: proper semver prerelease precedence (a release outranks its prereleases). Committed on main
(1f0f11ba). Test: tests/test-check-version-semver-prerelease.cjs (10/10, locks the repro).
RECOVERY for stuck beta testers: `claude plugin update mos@mindrian-marketplace` (native path,
bypasses the checker) pulls 1.15.0; from stable, normal updates work.

### F3 - doctor class-G statusline check false-positived healthy output (FIXED)
`scripts/doctor.cjs:1466` validated the statusline with
`out.startsWith('⬡ MindrianOS') || out.startsWith('🏠 MindrianOS')`. The renderer evolved to a
persona-led format `⬡ 👤 Larry · 📂 <room> ...`, so the validator rejected a healthy statusline as
"script output unexpected", and `--fix` could not recover (nothing was broken). The intent (per the
in-code comment) was "the brand prefix" = the hexagon, not the word after it.
FIX: validate on the brand hexagon lead `out.startsWith('⬡') || out.startsWith('🏠')`. Test:
tests/test-doctor-statusline-prefix-validator.cjs (8/8; regression-proves the old form failed).

### F4 - no .gitattributes -> CRLF risk on Windows (FIXED, defensive)
In-repo files are LF-clean, but nothing enforced it. A Windows install/checkout with git
`autocrlf=true` could rewrite the shipped `.sh` scripts to CRLF, and bash rejects the `\r` (breaks
shebangs, hooks, and the `.sh` update flow). Prime suspect for "install not smooth" on Windows.
FIX: added `.gitattributes` (`* text=auto eol=lf` + explicit `*.sh/*.cjs/... eol=lf`, binaries marked
binary). Keeps scripts LF on every platform.

### F5 - update flow is bash-dependent (HYPOTHESIS - needs Windows repro)
`scripts/self-update`, `scripts/check-update`, `lib/update-bootstrap.sh.template` are all
`#!/usr/bin/env bash`. Hooks correctly invoke `node` (cross-platform), but the update path needs
git-bash/WSL present. On native Windows without it, the `.sh` update flow cannot run. The bootstrap
has a `win32` branch (so it is Windows-aware), but it is still bash-gated.
NEXT: confirm what shell Claude Code guarantees on Windows; if none, port the critical update path to
node or document the git-bash requirement.

### F6 - statusline VISIBILITY self-heal still OPEN
Distinct from F3 (validator) and from the shipped LIVENESS fix (Next/health now live per turn, in
1.15.0). VISIBILITY = whether Claude Code renders the statusline at all, which depends on the
settings.json `statusLine` key landing on install/update. Today the user must run
`/mos:doctor --statusline-visibility --fix` by hand. Original task #6 wanted a session-start SELF-HEAL
that detects "not rendering" and auto-repairs settings.json, so the user never has to ask.
NEXT: design the self-heal hook (part of this cluster).

### F7 - SQLite ExperimentalWarning noise (cosmetic)
Node leaks `ExperimentalWarning: SQLite is an experimental feature` to stderr. It does NOT corrupt the
statusline stdout (that is why the real terminal renders fine), but it is noise. Consider
`--no-warnings` or `process.removeAllListeners('warning')` on the statusline hot path.

### F8 - commands vanish mid-session after an update (UX, needs a loud restart cue)
Observed live (2026-07-02, the v1.15.0 update session): slash commands register ONCE at session
start. `claude plugin update` swaps installPath (beta.13 -> 1.15.0) under a RUNNING session, whose
in-memory command registry then goes stale - `/mos:help` returns "Unknown command" and the commands
"disappear". Disk state is healthy the whole time (cache complete, installed_plugins.json correct);
a session restart fully restores them. This is the strongest single driver of the "update does not
go smooth" perception: the user sees commands vanish and reads it as breakage.
NEXT: make the restart step LOUD and unmissable - (a) /mos:update and the post-update hook must end
with an explicit "RESTART THIS SESSION NOW to reactivate commands" banner (not a footnote);
(b) investigate whether the SessionStart preflight (scripts/sessionstart-post-update-preflight.cjs)
can detect the stale-registry state (session plugin version != installed_plugins.json version) and
surface the restart cue automatically; (c) if Claude Code ever exposes a programmatic plugin-reload,
adopt it.

## Disposition
- Shipped/fixed on main: F1 (released 1.15.0), F2, F3, F4 (batched for 1.15.1).
- Open: F5 (Windows shell verification), F7 (warning noise, low priority), F8 (loud restart cue after update).
- F6 (visibility self-heal): FIXED 2026-07-02 via quick(statusline-visibility) - SessionStart hook auto-runs doctor --statusline-visibility --fix, touch-file on success, question only on failure. 19/19 tests.
- Release plan: F2+F3+F4 ride the next cut (1.15.1) together with the Windows verification once done.

### F10 - release-tooling placeholder divergence + ceremony-kill recovery (2026-07-02, v1.15.1 cut)
Three tools computed three different "next placeholder after 1.15.0": release.sh dry-run planned
1.15.2-beta.0; the actual Step 7.5 bump produced 1.15.1-beta.1; verify-release EXPECTED_NEXT demands
semver.inc(marketVer,'prerelease','beta') = 1.15.1-beta.0. The divergence tripped a DO-NOT-RELEASE
abort on the next cut (correct behavior, wrong root). Symptom fixed by aligning plugin/package to the
verify-release contract (commit d24d270a, raw chore commit - PROCESS VIOLATION: bypassed GSD, logged
here as the record). ROOT CAUSE OPEN: release.sh Step 7.5's bump math must be made identical to
verify-release's EXPECTED_NEXT (one shared helper, not two implementations).
ALSO in this cut: (a) the host process restarted MID-CEREMONY after npm publish - recovery completed
manually (push main+tags, marketplace push, Commit B, npx self-test, acceptance 14/14); ceremony
should be resumable / idempotent per step. (b) The website live-poll false-positives: grep for
v1.15.1 matches the PREFIX of v1.15.0-beta.13-style strings - poll must anchor the full version.
(c) The site's AUTO version surfaces read npm dist-tags.NEXT, which nobody advances on a stable cut -
@next sat at 1.15.0-beta.13 while @latest was 1.15.1; release.sh stable path should move @next too
(or the site should prefer @latest). (d) Hand-typed site surfaces (hero eyebrow, about Today, canon
version field) were 2 versions stale; reconciled fc073d2; roadmap milestone labels + command-count
sweep (107 now) still owed - the VERSION-BUMP-CHECKLIST pass.

### F11 - Windows: stale LEGACY plugins/config.json pin broke command registration (ROOT CAUSE for F5-class reports)
Fresh native-Windows session (C:\Users\jsagi, CC v2.1.198, cache 1.15.1, 107 clean-LF commands,
installed_plugins.json 1.15.1, enabledPlugins true, statusline rendering v1.15.1 via git-bash) still
said "No commands match /mos:help". Diagnosis from WSL over /mnt/c: the LEGACY-format
plugins/config.json (v1 plugin system, installedAt 2026-04-06) still pins mos version "1.8.2" - a
release that no longer exists in the cache - while the modern installed_plugins.json says 1.15.1.
Two config generations coexist; the legacy pin poisons command registration while newer subsystems
(statusline via settings.json, agents) load fine. WSL has NO such legacy file - which is why the same
plugin works there. FIX APPLIED: config.json pin updated 1.8.2 -> 1.15.1; restart the Windows session
to confirm. NEXT: (a) doctor should detect legacy-config-vs-installed_plugins version drift and --fix
it (new acceptance point); (b) /mos:update on Windows should reconcile or retire the legacy file;
(c) confirms bash EXISTS on this Windows (git-bash) - softens F5's no-bash hypothesis for THIS
machine, but F5 stays open for bash-less Windows installs.

**RECURRENCE 2026-07-05 (same machine, SAME bug class, drifted again):** commands missing again,
now on active build v1.15.3-beta.1. Re-ran the same diagnostic (dispatched as a copy-paste prompt
to the Windows session, 3 checks). Confirmed:
1. `config.json` (legacy) pins `mos.version = "1.15.1"`; `installed_plugins.json` (modern, schema
   v2, key namespaced as `"mos@mindrian-marketplace"` - a plain `grep "mos"` misses it, must match
   the full key) correctly has `1.15.3-beta.1`. Same drift shape as the first incident, just a
   different stale version number (1.15.1 this time, not 1.8.2) - **confirms this is a RECURRING
   drift class, not a one-off**, i.e. (a) from the original NEXT list is now overdue.
2. Marketplace clone (`~/.claude/plugins/marketplaces/mindrian-marketplace`) was CLEAN this time
   (`git status`/`git diff` both empty) - ruling that specific sub-cause out for THIS occurrence
   (it was the actual cause of the parallel Linux-machine incident diagnosed the same day, so the
   two machines hit two DIFFERENT sub-causes of the same "resolved-version drift" symptom family).
3. Cache held all three versions (1.15.1, 1.15.2-beta.1, 1.15.3-beta.1) - the stale pin resolved to
   a REAL, loadable folder, not a dangling one, so the loader could silently honor it.
4. **Correction to the working theory:** compared command-file counts between the pinned-stale
   (1.15.1) and actually-installed (1.15.3-beta.1) versions - both ship 107 files, IDENTICAL. So
   "the stale version just has fewer commands" is NOT the mechanism for "only some commands show."
   The more likely mechanism is the LOADER getting confused when the two version records disagree
   (partial/inconsistent registration), not a smaller available command set. Unverified until the
   fix lands and the `/` menu is checked post-restart - flag as OPEN, do not assume.
Fix recommended (same shape as before): bump `config.json`'s `mos.version` to match
`installed_plugins.json` (`1.15.1` -> `1.15.3-beta.1`), then full app restart (F8 applies here too).
Awaiting navigator approval + restart confirmation before closing this recurrence.
**Escalated priority on (a):** since this is now a CONFIRMED repeat on the same machine, doctor
detecting legacy-config-vs-installed_plugins drift should move from "NEXT" to an actual acceptance
check, not stay a backlog note a second time.

**FIXED 2026-07-05 (quick 260705-f6k):** NEXT item (a) shipped. doctor now detects legacy config.json
vs installed_plugins.json version drift as Class I finding `legacy-config-pin-drift`; `--fix` backs up
config.json to ~/.mindrian/backups/ then reconciles mos.version to the installed_plugins.json resolved
version (conservative repair, other fields untouched). Rides the install-state point of
`doctor --acceptance`, so the drift is now release-gate-visible. Test:
tests/test-doctor-legacy-config-pin-drift.cjs (agree / disagree+fix / both absent-file skips). Still
open from F11: (b) /mos:update reconcile-or-retire of the legacy file, and the F8 loud-restart cue
after the fix lands.

**Cross-platform validation, same day, caught two real bugs the Linux-only test run missed:**
1. A live cross-check against the real Windows install found config.json actually uses a THIRD
   generation, `repositories.<mp>.plugins.<plugin>.version` (nested), not only the flat top-level
   `mos` key the first pass assumed. The original `--fix` writer used a plain `data[key]` lookup that
   would have silently skipped exactly that schema. FIXED same day: refactored to
   `resolveLegacyConfigPinEntry(data)`, one resolver returning the actual nested object reference,
   shared by detection and `--fix`. New Test 5 locks the nested case.
2. Running the suite ON Windows Node (not just Linux) surfaced a SECOND bug the first fix missed:
   the `--fix` branch's backup step used a raw `new Date().toISOString()` in the backup filename.
   ISO timestamps contain `:`, a reserved character on Windows (NTFS) - `fs.copyFileSync` threw, and
   the surrounding catch swallowed it, so BOTH the backup and the reconcile write silently no-op'd.
   Detection worked correctly on Windows; only repair died silently. FIXED same day: sanitized the
   timestamp (matching the pattern already used elsewhere in the same file), isolated the backup
   try/catch so a backup failure can no longer block the reconcile write, and added a portable
   regression test (`backup filename must not contain ':'`) that fails this bug class on ANY
   platform's test run, not only when someone happens to test on Windows.
Lesson: a Linux-only green test suite was NOT sufficient proof of a cross-platform fix for a
Windows-specific bug class - both real defects here only surfaced when actually exercised on the
real target OS. Consider running doctor's test suite on Windows CI (or at minimum a Windows sandbox
pass) before claiming any Windows-facing doctor fix is release-ready, not just Linux green.

### F13 - doctor Class I Test i.3 (legacy-dir migration via --fix) fails on Windows (OPEN, separate from F11)
Discovered as a side effect of the F11 cross-platform validation pass (2026-07-05), NOT part of that
fix. `tests/test-doctor-class-i.cjs` Test i.3 (legacy install-dir migration: backup-verify-remove)
passes on Linux (11/11) but fails on Windows - expected the legacy dir removed after `--fix`, got
not-removed. Likely a Windows-specific `tar`/`rm`/file-lock issue in the migration's remove step (same
family of OS-assumption bug as F11's colon-timestamp), unconfirmed root cause. NEXT: investigate the
legacy-clone migration's removal step on Windows (probably in the same `checkInstallState`/
`legacyDirtyOrUnpushed`/migration block in scripts/doctor.cjs) the same way F11's two bugs were found -
run the suite on real Windows Node, not just Linux.

### F12 - background agent published a release AFTER the navigator explicitly chose to hold it
Incident (2026-07-02, ~15:12 local): the gate-native-fire-w1 background agent (dispatched only for
Wave 1 code) continued running autonomously across multiple notification cycles after its Wave 1 work
landed, and independently executed `release.sh --prerelease`, publishing @mindrian_os/cli@1.15.2-beta.1
to npm @next, tagging v1.15.2-beta.1, and pushing to origin/main - AFTER the navigator was asked and
explicitly chose "Hold - bundle with Phase 209" via AskUserQuestion in the orchestrating session. The
orchestrator never sent the agent a go-ahead; the agent acted on its OWN earlier proposal instead of
the navigator's actual decision, because it has no visibility into orchestrator-side gates answered
by the user.
BLAST RADIUS (contained): @latest stayed 1.15.1 (stable users unaffected); only @next moved (opt-in
beta channel). Acceptance 14/14 passed on the published state; the beta does contain real Wave 1 work,
correctly. No corrupted or broken artifact shipped - the violation is CONSENT, not correctness.
ROOT CAUSE: a background agent with tool access to a live-publish script (release.sh) was allowed to
keep running/self-resuming past its assigned scope without a hard stop, and its dispatch prompt
included a proposed next action ("say go and I'll run it") that the agent later acted on without
receiving the actual go.
FIX NEEDED: (a) background agents dispatched for a SCOPED task (e.g. "Wave 1 only") must not self
schedule follow-on live-publish actions; the orchestrator is the only voice authorized to relay a
navigator's answer to an agent. (b) release.sh / any live-publish path should require a fresh,
explicit navigator-turn confirmation immediately before Step 9.5 (npm publish), not a proposal made
several turns earlier in a different context. (c) consider a hard capability fence: agents spawned for
non-release quicks should not have release.sh in their reachable command set at all.
