---
status: resolved
kind: rca
trigger: "Windows-only: os.rename() is not POSIX rename(2) on Windows, silently wedges the room registry after the first write. Found live by the user testing v1.15.3-beta.38 on their Windows install."
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: tier-0
canon_parts: [6]
created: 2026-07-23T00:00:00Z
updated: 2026-07-23T00:00:00Z
resolved: 2026-07-23T00:00:00Z
classification: NEW FAILURE
---

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED. Python's `os.rename(src, dst)` is NOT POSIX `rename(2)` on Windows. Python's own docs: "On Windows, if dst exists a FileExistsError is always raised" (it maps to a bare `MoveFileW`, no MOVEFILE_REPLACE_EXISTING flag). The four room-registry-family scripts each perform the textbook atomic-write pattern inside Python heredocs embedded in bash (write `<file>.tmp`, then swap over the real path) and used `os.rename(tmp, dst)` for the swap. On Linux/macOS `os.rename` silently overwrites an existing destination (POSIX semantics), so the FIRST write (destination absent -- e.g. cold room creation, first `/mos:rooms list`) succeeds on every platform, which is exactly why room creation and the list render looked healthy. Every SUBSEQUENT write to that now-existing destination on Windows (`set-active`, `update`, `archive`, `git-config`, STATE.md upsert, ICM index rebuild, cwd-change activation) raised an uncaught FileExistsError [WinError 183], exited non-zero, left an orphaned `.tmp` on disk, and froze the real file at its last successful state. Presentation: "the tool works, but nothing I do sticks." Corroborated on-disk by the reporter's registry.json.tmp being dated weeks newer than registry.json. Corroborating internal evidence: scripts/track-analytics:155 already used the correct `os.replace(tmp_file, analytics_file)` -- the primitive was already the house standard for atomic writes; the registry family simply missed it.

fix: One-word primitive swap `os.rename` -> `os.replace` at all 9 confirmed callsites across the four scripts. `os.replace()` maps to `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING` and overwrites an existing destination on ALL platforms -- byte-for-byte identical to what `os.rename` ALREADY did on Linux/macOS, so Linux/macOS behavior is provably unchanged while the Windows crash is removed. Callsites:
  - scripts/resolve-room:169 (registry bootstrap)
  - scripts/update-icm-index:146 (parent INDEX.md rebuild)
  - scripts/on-cwd-changed:100 (cwd-change active-room flip)
  - scripts/room-registry:198 (STATE.md frontmatter upsert), 252 (create), 411 (update), 454 (set-active), 524 (archive), 587 (git-config)
  ADJACENT same-defect fix beyond the original 9 (flagged, not silent): the identical `os.rename`-for-atomic-write anti-pattern lived in a test cleanup trap at tests/test-jtbd-auto-anchor-empirical.sh:91,110 (registry + memory sidecar cleanup). Fixed both to `os.replace` so the defect does not survive anywhere in tracked source and a future grep gate stays green. Deliberately NOT touched (out of scope, confirmed unaffected): Node's ~30 `fs.renameSync` callsites (libuv already implements MOVEFILE_REPLACE_EXISTING on Windows for those), and anything under ~/.claude/plugins/mindrian-os/ (install cache, a ghost patch per the WORKSPACE GUARD).

verification: New regression test tests/test-room-registry-windows-atomic-replace.cjs (21/21 PASS) exercises the previously-untested path that Windows wedged -- a SECOND write to an EXISTING registry.json -- and asserts the on-disk content actually CHANGED (not merely exit 0, which a frozen-file false-success would pass) plus that no orphaned `.tmp` remains (the reporter's fingerprint). It also runs a pure-Python os.replace() overwrite-semantics probe (dst=A, tmp=B, replace, assert dst==B and tmp consumed) proving the cross-platform property, and a structural assertion that zero `os.rename(` survive in the four scripts and exactly 9 `os.replace(` remain. Auto-discovered by tests/run-all.sh (test-*.cjs glob). Existing suites green post-fix: test-room-registry-windows-path.cjs 25/25, test-room-registry-path-resolution.cjs 25/25, test-127.2-04-windows-path-and-update-activation.sh 16/16, test-tool-router-active-room-misroute.cjs ALL PASS, test-room-state-active-room-misroute.cjs ALL PASS, test-204-room-chooser.cjs 49/49, test-jtbd-auto-anchor-empirical.sh PASS (the edited file). Gates cleared: no em-dashes in any touched file (0 across all 6), cross-platform (the fix is the cross-platform correctness), Canon Part 8 (LOCAL disk only, no Brain egress), reuse-before-build (os.replace is the primitive track-analytics already used).

CORRECTION (post-resolution, same day): the line below originally read "the platform-specific crash cannot be reproduced live here (no Windows runtime in this environment)". That was true when written and is now FALSE -- the reporter ran this session's exact fix on his actual wedged Windows install and reported back with paste-ready evidence (see Evidence entries below, timestamps 2026-07-23T09:27:32Z and 09:30:00Z). Leaving the superseded claim standing in a "resolved" doc would itself be a stale-contradiction bug of the same shape this repo already tracks elsewhere (check-card-fire.cjs over-enforcement instances) -- corrected here rather than silently edited away, so the retraction is visible.

files_changed: scripts/resolve-room, scripts/update-icm-index, scripts/on-cwd-changed, scripts/room-registry, tests/test-jtbd-auto-anchor-empirical.sh (adjacent same-defect), tests/test-room-registry-windows-atomic-replace.cjs (new regression test), scripts/verify-release (new wired gate, section 15).

commits: e2a35b31 (fix), 7d133214 (initial RCA), plus this update.

deferred: A standalone lint gate rejecting bare `os\.rename(` in scripts/ was considered and initially deferred, then ADDED same-day after live Windows verification underscored the value: scripts/verify-release section "15. Windows-Unsafe Rename Primitive" now fails the release if a bare os.rename( reappears anywhere in scripts/ (excluding its own descriptive comment lines). Verified it has real teeth: reverted scripts/resolve-room to os.rename( locally, re-ran verify-release, confirmed the gate fails and names the exact site, then restored the fix. This gate runs at release time (scripts/release.sh calls verify-release); it is NOT wired into a pre-commit hook -- that would be the next tier of enforcement if wanted, not done here. Also flagged: no CHANGELOG.md entry / version bump was added -- this is a small bugfix not tied to the just-shipped release; raise if a beta bump is wanted.

remediation_for_already_wedged_installs: os.replace() self-heals on the NEXT write -- no migration script is needed, and there is no data corruption (the frozen file was always valid, just stale). What IS unrecoverable: every write attempt between the registry's last successful write and the fix landing on that install (for the reporter, 17 days -- registry.json last modified 2026-07-06, registry.json.tmp dated 2026-07-23) silently returned non-zero and its intent (a room switch, an archive, a git-config sync) is gone, not replayable from any log. No corruption, only lost intent -- worth surfacing to any Windows user who has been on an affected version. Cheap forward-looking detector proposed for /mos:doctor (not implemented here, flagged as a follow-up): a `<file>.tmp` sibling with an mtime newer than its target is the exact fingerprint of a wedged install and can be checked with a single stat comparison per registry-family file.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED (re-verified via grep against this exact repo before this session opened, not just taken on the reporter's word). Every one of 4 scripts writes via the textbook atomic-write pattern (write to `<file>.tmp`, then rename to the real path) using Python heredocs embedded in bash scripts, and calls the Python builtin `os.rename(tmp, dst)` to do the swap. Python's own docs state plainly: "On Windows, if dst exists a FileExistsError is always raised" -- `os.rename` is NOT POSIX `rename(2)` on Windows; the cross-platform overwrite-safe primitive is `os.replace()` (maps to `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING` instead of a bare `MoveFileW`). On Linux/macOS `os.rename(tmp, dst)` silently overwrites `dst` if it exists (POSIX semantics), so it works the FIRST time a destination file doesn't exist yet and explodes with an uncaught `FileExistsError: [WinError 183]` on every write after that, once the destination exists -- Windows only.
test: Re-grepped `os\.rename(` across scripts/ in this exact repo and confirmed all 9 call sites match exactly what was reported (see Evidence). UPDATE (same day, post-fix): the reporter subsequently tested the fix live on his own wedged Windows install -- both the raw platform-semantics claim (os.rename fails / os.replace succeeds, isolated tmpdir) and the end-to-end fix (his real 17-day-frozen registry.json unwedged: set-active/read/update-icm-index all exit 0, content actually changes, no orphaned .tmp) are now CONFIRMED live, not just via grep + documentation. See Evidence entries dated 2026-07-23T09:27:32Z and 2026-07-23T09:30:00Z.
expecting: After the fix (`os.rename` -> `os.replace` at all 9 sites), a second write to an existing destination file on Windows should succeed (overwrite) instead of raising `FileExistsError: [WinError 183]`. On Linux/macOS behavior is provably unchanged (both calls overwrite silently there). CONFIRMED on Linux by the new regression test.
next_action: DONE. Fix applied at all 9 sites + 2 adjacent test-cleanup sites; regression test added and green; existing suites green; RCA resolved and archived.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.38 (just released this session) / 1.15.3-beta.39 (current in-progress placeholder)
- Reported by: Jonathan, live symptom from testing the just-shipped v1.15.3-beta.38 release on his Windows install
- Do NOT touch: anything under `~/.claude/plugins/mindrian-os/` (the install cache) -- a prior hand-patch there is explicitly a "ghost" that dies on the next `claude plugin update`. The ONLY real fix location is this dev repo's `scripts/`, per this repo's own CLAUDE.md WORKSPACE GUARD.
- Do NOT touch: Node's `fs.renameSync` call sites (~30 of them across room-birth.cjs, navigation/*, mva-state.cjs, etc.) -- confirmed unaffected, libuv already implements POSIX overwrite semantics on Windows for those.

## Problem Statement

Every write to `registry.json` (and its siblings `STATE.md` frontmatter, `INDEX.md`, and the ICM routing index) on a Windows install of MindrianOS uses a Python-heredoc-in-bash atomic-write pattern that calls `os.rename(tmp, dst)`. The very first write succeeds (destination absent), which is exactly why room creation appears to work and `/mos:rooms list` renders correctly. Every subsequent write to that same destination (`set-active`, `update`, `archive`, git-config sync) throws an uncaught `FileExistsError: [WinError 183]` and exits non-zero, leaving an orphaned `.tmp` file on disk and the real file frozen at whatever it last successfully wrote. The failure mode presents as "the tool works, but nothing I do sticks" -- any Windows user who has ever created a second room, or switched the active room even once, has a silently wedged registry today.

Surfaces widened from `[cli]` to `[cli, desktop, cowork]`: all three surfaces shell out to the exact same `scripts/*` files (they are not CLI-specific -- Desktop and Cowork both invoke the same room-registry family on a Windows host). This is genuinely all three surfaces failing on ONE host OS, not a CLI-only defect. That framing exposes a real structural gap in this repo's own Tri-Polar Design Rule (CLAUDE.md): the model's three axes are CLI / Desktop / Cowork, with no host-OS axis at all. A defect that is invariant across all three surfaces but fires only on Windows is invisible to that matrix by construction -- worth its own note for whoever next revisits the Tri-Polar model, not something this RCA can fix by itself. `canon_parts` includes Part 6 (Dog-Fooding Mandate): the plugin corrupted its OWN room registry on the maintainer's own machine, which is a CONTRADICTS edge against the plugin's own canon, not just a user-facing bug.

## Evidence

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    Re-grepped `os\.rename\(` across `scripts/` in this exact repo (not taken on faith from the reporter's paste). Exact match, 9 call sites across 4 files:
    ```
    scripts/resolve-room:169:os.rename(tmp, '$REGISTRY_FILE')
    scripts/update-icm-index:146:os.rename(tmp, '$INDEX_FILE')
    scripts/on-cwd-changed:100:os.rename(tmp, reg_path)
    scripts/room-registry:198:        os.rename(tmp, state_path)
    scripts/room-registry:252:os.rename(tmp, reg_file)
    scripts/room-registry:411:os.rename(tmp, reg_file)
    scripts/room-registry:454:os.rename(tmp, reg_file)
    scripts/room-registry:524:os.rename(tmp, reg_file)
    scripts/room-registry:587:os.rename(tmp, reg_file)
    ```
    `scripts/room-registry` carries 6 of the 9 (line 198 for STATE.md frontmatter upsert; 252/411/454/524/587 for create/set-active/update/archive/git-config).
  source: live grep, this session, against /home/jsagi/dev/MindrianOS-Plugin

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    Reporter's own registry.json.tmp was dated far newer than registry.json itself on their Windows install (weeks apart) -- the fingerprint of repeated failed writes leaving a fresh orphaned tmp against a stale target, consistent with the write-once-then-frozen state machine above.
  source: user-reported (Windows install), this session

- timestamp: 2026-07-23T00:00:00Z
  finding: |
    Corroborating internal evidence surfaced during the fix: scripts/track-analytics:155 ALREADY used `os.replace(tmp_file, analytics_file)` for its atomic write. So the overwrite-safe primitive was already the house standard elsewhere in scripts/ -- the room-registry family is the outlier that missed it, not a case where os.replace was unknown to the codebase.
  source: live grep, this session, during fix application

- timestamp: 2026-07-23T09:27:32Z
  finding: |
    End-to-end fix verification on the reporter's real, live-wedged Windows install
    (Windows 11, v1.15.3-beta.38):
    BEFORE fix: registry.json mtime 2026-07-06 23:35, registry.json.tmp mtime
    2026-07-23 12:25 (17 days of failed writes accumulated). `room-registry
    set-active` -> FileExistsError [WinError 183], exit 1. Repeated attempts
    -> identical failure every time.
    AFTER fix (os.rename -> os.replace at all 9 sites):
    `set-active motj-ecosystem` -> exit 0, active room actually changed.
    `room-registry read` -> last_opened field updated. `update-icm-index` ->
    "INDEX.md updated: 4 active, 1 archived", exit 0. No orphaned .tmp
    remaining in .rooms/ or MindrianRooms/. Registry had been frozen since
    2026-07-06; every room switch attempted in that 17-day window silently
    no-op'd.
  source: live Windows install, v1.15.3-beta.38, reporter's own machine, this session (relayed via the user)

- timestamp: 2026-07-23T09:30:00Z
  finding: |
    Live Windows platform-semantics proof (Windows 11, Python 3.13.6), isolated
    tmpdir, destination pre-existing:
    os.rename  -> FAIL: FileExistsError [WinError 183]; dst content unchanged
                  ('OLD'); src (.tmp) left ORPHANED on disk.
    os.replace -> OK: overwrote cleanly; dst content 'NEW'; src consumed (no
                  orphan).
    Confirms both halves of the hypothesis simultaneously, from one paired
    experiment: the exception AND the orphaned-tmp fingerprint are produced
    by the exact same call, in one step, on real Windows -- not inferred from
    documentation alone.
  source: live Windows install, Python 3.13.6, this session (relayed via the user)

## Eliminated

(none -- root cause confirmed on first pass via direct grep + Python platform-semantics documentation, no false leads pursued; subsequently corroborated live on the reporter's actual Windows install, see Evidence above)
</content>
</invoke>
