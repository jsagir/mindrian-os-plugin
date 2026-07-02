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

## Disposition
- Shipped/fixed on main: F1 (released 1.15.0), F2, F3, F4 (batched for 1.15.1).
- Open: F5 (Windows shell verification), F6 (visibility self-heal), F7 (warning noise, low priority).
- Release plan: F2+F3+F4 ride the next cut (1.15.1) together with the Windows verification once done.
