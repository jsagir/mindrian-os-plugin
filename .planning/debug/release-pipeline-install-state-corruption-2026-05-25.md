---
slug: release-pipeline-install-state-corruption-2026-05-25
kind: rca
priority: P1
status: open
filed: 2026-05-25
filed_by: claude-code session 2026-05-25 (release-ceremony attempt for v1.13.0-beta.34)
blocked_release: v1.13.0-beta.34 (Phase 127.3 + housekeeping + label realignment, 27 commits ready)
canon_parts:
  - Part 6 (dog-fooding mandate -- the release pipeline self-tested and refused to ship; the gate caught a real corruption Pre-tag; this is the system working correctly)
  - Part 7 (reuse-before-build -- doctor.cjs is the canonical install-state classifier; doctor --acceptance is the canonical pre-tag gate)
prior_incident_refs:
  - .planning/debug/resolved/install-cache-windows-hardening (Phase 95.6 lineage; second autopsy in install-cache failure family)
  - docs/autopsies/2026-04-13-wrong-workspace-incident.md (the first wrong-workspace incident)
  - docs/install-cache-family-premortem.md (predicted next failure modes -- this might match case G "Bash-heredoc POSIX leaks in non-room-registry sites" OR a NEW case not yet predicted)
---

# RCA -- release-pipeline-install-state-corruption-2026-05-25

## Symptom

`scripts/release.sh --allow-ahead` HARD ABORTED at Step 6.6 (`doctor --acceptance --pre-tag`) with **install-state** point FAIL.

Two distinct failure modes surfaced in sequence (each fix unearthed the next layer):

### Mode 1 (initial finding, before any fix)

```
FAIL  install-state: install-state record present + snapshot matches a live spot-check
       -- legacy clone present at /home/jsagi/.claude/plugins/mindrian-os
          alongside marketplace-cache install -- migration candidate
          (run with --fix to backup-then-remove)
```

### Mode 2 (after parking the legacy clone + re-running session-start)

```
FAIL  install-state: install-state record present + snapshot matches a live spot-check
       -- version-of-record divergence: IP=1.13.0-beta.32 vs PB=1.13.0-beta.24
```

Release.sh rolled back cleanly both times (Step 2.5 + Step 6.6 invariant honored). No tag, no push, no marketplace mutation, no npm publish.

## Reproduction

1. Working tree: `/home/jsagi/MindrianOS-Plugin` on `main`, 27 commits ahead of `origin/main`, plugin.json at `1.13.0-beta.33` (post-bump from previous beta.32 ship).
2. `git status` clean (housekeeping commit 53ce6f31 + label realignment ef762484 landed before ceremony attempt).
3. `bash scripts/release.sh --allow-ahead` -> abort at Step 6.6 (Mode 1 above).
4. `mv /home/jsagi/.claude/plugins/mindrian-os /home/jsagi/.claude/plugins/mindrian-os.parked-2026-05-25` -> false-positive legacy-clone finding cleared.
5. `SESSION_START_NODE_PREFLIGHT_SKIP=1 bash /home/jsagi/MindrianOS-Plugin/scripts/session-start` -> wrote a fresh `~/.mindrian/install-state.json`.
6. `node scripts/doctor.cjs --acceptance --pre-tag` -> Mode 2 above.

## Concrete findings

### F1. `~/.claude/installed_plugins.json` is MISSING

```bash
$ ls -la /home/jsagi/.claude/installed_plugins.json
ls: cannot access '/home/jsagi/.claude/installed_plugins.json': No such file or directory
```

Doctor's "session-start-active-version" point PASSES, which says session-start "derives active_version correctly from installed_plugins.json". But the file does not exist. Either:
- The check is reading from a different file and reporting it as `installed_plugins.json`
- The check has a graceful-degradation path that returns PASS on absent
- There is a different path Claude Code now uses (rename / move / cache-redirect)

This is the load-bearing question for the RCA. Until we know where session-start reads `active_version` from, we cannot trust the install-state record it writes.

### F2. `~/.mindrian/install-state.json` points at a non-existent path

After session-start ran in Step 5 of the reproduction, the record contains:

```json
{
  "active_version": "1.13.0-beta.32",
  "active_root": "/home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/1.13.0-beta.32",
  "topology": "marketplace-cache",
  "resolved_at": "2026-05-25T06:39:23.708Z"
}
```

But `ls /home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/` shows ONLY `1.13.0-beta.19`, `1.13.0-beta.22`, `1.13.0-beta.24`. The `1.13.0-beta.32` directory does NOT exist on disk.

So session-start fabricated `active_version: 1.13.0-beta.32` from somewhere (probably F1's mystery source). The doctor `version-of-record-published` check then compares this fabricated value (IP=beta.32) against the actual newest cache dir (PB=beta.24) and FAILS the divergence gate.

### F3. The legacy clone was actually `~/` inheriting via parent `.git`

`/home/jsagi/.claude/plugins/mindrian-os/` was NOT a separate git clone. It had no `.git` directory. Running `git` from inside it bubbled up to `/home/jsagi/.git`, which is itself a git repo with origin `https://github.com/jsagir/mindrian-agno-backend.git`.

So the "legacy clone" doctor flagged was a directory of plugin files that, when probed for git state, returned `~/`'s git state. The "3 unpushed commits" (`dc6e55de2`, `d95c4e45a`, `128d47efb`) belong to `~/`, not to any actual mindrian-os clone:

```
dc6e55de2 deploy: publish presentation
d95c4e45a docs: resolve debug heal-command-cwd-misfire-scaffolds-spurious-sections
128d47efb docs(05-03): complete QUAL-04 + QUAL-05 -- THE-BRAIN.md live numbers + v1.13.0 compat report
```

These look like academy / dr-vasquez-thesis work. NOT MindrianOS-Plugin work. Whoever / whatever put them there committed against the home-as-repo by accident, similar to the 2026-04-13 incident.

After parking the legacy dir aside, doctor's legacy-clone check passes. So the dev-clone heuristic is correct in this codepath -- the false-positive came from `~/` having a git repo at all.

### F4. Marketplace cache is behind every other surface

The cache only has versions through beta.24:

```
1.13.0-beta.19
1.13.0-beta.22
1.13.0-beta.24
```

But the dev workspace plugin.json is at beta.33 (pre-bumped). And the install-state record says active_version is beta.32. So FIVE surfaces are out of sync:
- Marketplace cache: latest is beta.24
- Install-state record: beta.32 (fabricated)
- plugin.json (dev): beta.33 (pre-bumped from previous ship)
- Latest tag (origin): v1.13.0-beta.32
- Local main HEAD: post-127.3 work, 27 commits ahead

The Phase 123 install-lifecycle-harness was supposed to keep these in lockstep. Something broke it. Either a recent beta cut skipped the install-cache update, or `claude plugin marketplace update` was never run after beta.30/.32, or the cache prune ran too aggressively.

## Hypotheses to investigate

| # | Hypothesis | Evidence | Falsifier |
|---|-----------|----------|-----------|
| H1 | Claude Code renamed/moved `installed_plugins.json` to a new path; doctor + session-start use both paths with different fallbacks | F1 file missing but session-start-active-version PASSES | Grep `installed_plugins.json` across doctor.cjs and session-start; find both read paths; compare |
| H2 | A recent Claude Code release stopped writing `installed_plugins.json` entirely; session-start derives active_version from cache-dir listing instead | F1 file missing + F2 active_version doesn't match cache contents | Read scripts/session-start; find where active_version actually comes from |
| H3 | The marketplace cache was manually pruned between beta.24 ship and now; beta.32 was installed but its dir got removed before this session | F2 active_version=beta.32 but dir absent + F4 cache only has .19/.22/.24 | Check ~/.claude/plugins/cache/mindrian-marketplace/.cache-prune-log or similar; look for evidence of pruning |
| H4 | The legacy dir at ~/.claude/plugins/mindrian-os was the previous-active install (beta.32 era) and got partially removed leaving the dir but not the binaries | Legacy dir had 105M of stuff + was last-modified 2026-05-24 20:12 | Inspect parked-2026-05-25 dir contents: does it have plugin.json? what version? |
| H5 | `claude plugin update mos@mindrian-marketplace` was never run after beta.32 cut; the marketplace.json on the marketplace repo points to beta.32 ref, but the user's local cache never auto-fetched it | F4 cache is at .24 not .32 | Check ~/mindrian-marketplace/.claude-plugin/marketplace.json source.ref; check if any auto-update channel is enabled |

## Recovery options (not yet attempted)

Listed least-destructive to most:

1. **Restore the parked legacy clone, run `claude plugin marketplace update + claude plugin update mos@mindrian-marketplace`.** May force the cache to fetch beta.32, repopulating the missing dir, and the install-state record becomes consistent.
2. **Manually rewrite `~/.mindrian/install-state.json`** to active_version=1.13.0-beta.24 (the actual latest cache dir) + matching active_root path. Re-run `doctor --acceptance --pre-tag`. If it passes, the ceremony can proceed.
3. **Add `DOCTOR_SKIP_INSTALL_STATE_GATE=1` env var support to doctor.cjs** (parallel pattern to existing `DOCTOR_SKIP_ACTIVATION_GATE=1`; ~5 lines of code). Use it once for the ceremony. File a Phase-X cleanup immediately.
4. **Manually `rm -rf ~/.claude/plugins/cache/mindrian-marketplace/mos/`** then `claude plugin marketplace update + install`. Forces a clean re-install of the marketplace cache. Most thorough; some risk of breaking the running plugin temporarily.

## Acceptance criteria for resolution

- [ ] H1 / H2 answered: we know where session-start derives active_version from on this version of Claude Code.
- [ ] `~/.claude/installed_plugins.json` either restored OR documented-as-deprecated (Claude Code moved it).
- [ ] `~/.mindrian/install-state.json` matches an actual on-disk install root.
- [ ] `node scripts/doctor.cjs --acceptance --pre-tag` PASSES 9/9.
- [ ] Decision made about the parked legacy clone (`/home/jsagi/.claude/plugins/mindrian-os.parked-2026-05-25/`): inspected? restored? archived? deleted?
- [ ] Pre-mortem doc `docs/install-cache-family-premortem.md` updated with case from this RCA (either new case #8 or new sub-case under existing).
- [ ] knowledge-base entry added so gsd-debugger surfaces this pattern next time.
- [ ] v1.13.0-beta.34 release ceremony re-attempted and passes Step 6.6 cleanly.

## Recovery state recorded (for resume)

- Working tree at: `/home/jsagi/MindrianOS-Plugin`, branch `main`, 27 commits ahead of origin
- Latest commits ready to ship: `ef762484` (label realignment) on top of `53ce6f31` (housekeeping) on top of `ddf5dac4` (Plan 07 close)
- All Phase 127.3 work landed in commits 62ce006f -> ddf5dac4 (24 commits)
- Plugin.json at 1.13.0-beta.33 (the WIP marker; release.sh would ship as .34)
- Legacy dir parked at `/home/jsagi/.claude/plugins/mindrian-os.parked-2026-05-25` (105M, inspect before deciding fate)
- Last `~/.mindrian/install-state.json` write at `2026-05-25T06:39:23.708Z` (session-start fired during reproduction Step 5)

## Resume

`/gsd:debug release-pipeline-install-state-corruption-2026-05-25`
