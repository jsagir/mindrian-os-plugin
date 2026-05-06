---
date: 2026-05-06
severity: high
status: resolved
detected_by: jsagir (dogfood machine; /mos:doctor --all --json output flagged install.status === "missing" with drift.detected: false)
resolved_by: Phase 95.2 (v1.13.0-beta.6)
related_incidents:
  - 2026-04-13-wrong-workspace-incident.md
  - 2026-04-28-install-cache-drift-incident.md
incidents:
  - install-dir-missing-non-atomic-recovery
diagnostic_anti_patterns:
  - half-done-state-after-failed-cp
  - drift-detected-false-on-missing-install
  - fix-short-circuit-on-missing-install
  - detection-lag-via-no-preflight
  - exit-code-conflation
---

# Incident Autopsy: Install Dir Missing -- Non-Atomic Recovery Surfaces Third in Install-Cache Family

## Summary

On 2026-05-06, on the dogfood machine (jsagir), the live plugin install at `~/.claude/plugins/mindrian-os/` was missing entirely. Two stale backups (`mindrian-os.stale-1.10.10-20260428-095548` from the 2026-04-28 incident and `mindrian-os.stale-1.11.0-20260430-083458` from a subsequent 2026-04-30 recovery) sat alongside in `~/.claude/plugins/`. A read-only run of `/mos:doctor --all --json` reported `install.status === "missing"` but `drift.detected: false`, which short-circuited the `--fix` dispatch in `scripts/doctor.cjs:1247` (pre-Phase 95.2 line). The user could not auto-recover via the existing surface even though the marketplace cache held the full set of recoverable versions (1.11.0, 1.11.1, 1.11.2, 1.12.0, 1.12.5, 1.12.5.1).

Phase 95.2 (v1.13.0-beta.6) ships three deliverables for this failure family: (1) atomic-swap recovery (`performRecoveryAtomic` at `scripts/doctor.cjs:231-316`); (2) class A `--fix` eligibility for `install.status === "missing"` (`scripts/doctor.cjs:1305-1320`); and (3) a SessionStart preflight (`scripts/preflight-doctor.cjs`, 8th SessionStart entry in `hooks/hooks.json`) that warns above the banner before the user hits a broken state.

This is the third occurrence in the install-cache failure family: 2026-04-13 wrong-workspace, 2026-04-28 install-cache-drift, 2026-05-06 install-dir-missing. Each incident exposes a different cause sharing one surface (the cache directory and its recovery code path).

## Root Causes

### A. Non-atomic recovery in pre-95.2 `scripts/doctor.cjs`

The original `performRecovery` (Phase 93/95.1, lines 222-260 pre-rewrite) renamed the live install to a backup BEFORE copying the cache to the new location. If `cp -aT` (the prior shell-out) failed mid-recovery, the catch block attempted a rollback (`fs.renameSync(backupDir, INSTALL_DIR)`), but if the rollback itself failed (cross-fs EXDEV on a containerized install, permission flicker on a network mount, or a race against a concurrent doctor run), the error was swallowed (`catch (_) {}`) and the system was left with no live install AND no clear surfaced error. This is precisely the half-done state the 2026-05-06 dogfood machine surfaced, with no clear repro because the failure could not be observed after the fact.

The Phase 95.2 fix is structural: prepare-then-verify-then-swap. `performRecoveryAtomic` writes the new tree to `install.new` first via `fs.cpSync` (Finding A; Windows-functional and exec-free; same caller pattern as `scripts/vault-export-orchestrator.cjs:233`); reads `install.new/.claude-plugin/plugin.json` and asserts the version field equals the cache source version (Phase 3 verify, D-02); only then runs the two-step rename `mv install -> install.stale-X-<ts>` followed by `mv install.new -> install`. If either rename fails post-verify, the rollback (`safeRename(backupDir, INSTALL_DIR)`) restores the live install to its pre-recovery state and the doctor exits with the new exit code 4 (D-03).

### B. `drift.detected` false on missing install

The pre-95.2 drift-detection block at the equivalent of `scripts/doctor.cjs:1234-1243` only computed a comparison when BOTH `installResult.status === 'ok'` AND `cacheResult.status === 'ok'`. With install missing (`installResult.status === 'missing'`), the outer `if` short-circuited and `report.drift.detected` stayed at its initialized `false` value. The `--fix` dispatch then never fired -- the doctor effectively reported "looks fine" semantics on a clearly broken state.

The Phase 95.2 fix widens the drift predicate (D-05). The new `else if` at `scripts/doctor.cjs:1314-1320` flips `drift.detected` to `true` AND attaches a `drift.reason: 'install-missing'` discriminator whenever `install.status === 'missing'` AND the cache holds at least one valid version. The reason field is a pure addition, lets automation route the missing-install case distinctly, and keeps the existing `compare` semantics byte-stable for the drift-between-versions path.

### C. `--fix` short-circuit on missing install

Even with the autopsy paper trail from Incident #2 (2026-04-28), the `--fix` dispatch at `scripts/doctor.cjs:1330` read `report.drift.detected` directly. That predicate was the conjunction of "both sides readable" AND "version mismatch" -- so the missing-install case made the action gating predicate false. The user got no remediation.

The Phase 95.2 fix unifies eligibility (D-06): `--fix` reads the widened `drift.detected`, which now fires on `install-missing` as well. The recovery body is unchanged; only the gating predicate widens. The `install.recoverable` boolean (D-07; pure JSON addition) lets automation distinguish "auto-recoverable" from "needs manual intervention" without parsing `cache.versions[]`.

### D. Detection lag via no preflight surface

The user only discovered the missing install state after a full `/mos:doctor --all --json` run. SessionStart hooks fired (banner, statusline, onboard-statusline, memory-resume-nudge, migrate-stale-user-settings, statusline-fallback-echo, preflight-tension-surface from Phase 116) but none probed install integrity. By the time the user ran doctor manually, multiple sessions had silently failed to load room context.

The Phase 95.2 fix adds `scripts/preflight-doctor.cjs` as the 8th SessionStart entry. It spawns `node scripts/doctor.cjs --json` with a 1500ms subprocess timeout, parses the result, and emits a Claude Code SessionStart envelope with `hookSpecificOutput.systemMessage` carrying a one-line ANSI-yellow warning when drift or missing-install is detected. Healthy installs see zero noise. The preflight honors both `MOS_NO_COLOR=1` (CONTEXT.md D-09 parity) and standard `NO_COLOR=1` (project convention via `scripts/vault-export-orchestrator.cjs:33`).

### E. Workspace ambiguity (cross-cutting with 2026-04-13)

Recovery code that runs FROM the install cache could itself be running on a corrupted version. Phase 95.2 introduces the `MINDRIAN_PLUGIN_HOME` env override (D-14, mirrors the `MINDRIAN_ROOMS_HOME` pattern from 95.1 D-05) so the regression test at `tests/test-doctor-atomic-swap.cjs` runs nine hermetic scenarios against scratch fixtures, never against the live `~/.claude/plugins/`.

## How It Was Detected

Sequence on 2026-05-06:

1. The user noticed Larry was acting "amnesic" across sessions -- room context did not persist.
2. The user ran `ls ~/.claude/plugins/`. Two `.stale-*` directories were visible (`mindrian-os.stale-1.10.10-20260428-095548` and `mindrian-os.stale-1.11.0-20260430-083458`) but no bare `mindrian-os/`.
3. The user ran `/mos:doctor --all --json` from `/home/jsagi/MindrianOS-Plugin/`. The JSON output included:
   ```json
   {
     "install": { "status": "missing", "detail": "install dir does not exist: /home/jsagi/.claude/plugins/mindrian-os" },
     "cache": { "status": "ok", "latest": "1.12.5.1", "versions": ["1.11.0","1.11.1","1.11.2","1.12.0","1.12.5","1.12.5.1"] },
     "drift": { "detected": false }
   }
   ```
   The contradiction `install.status === "missing"` AND `drift.detected: false` immediately surfaced the bug class.
4. Cross-checked cache: `~/.claude/plugins/cache/mindrian-marketplace/mos/` held six recoverable versions. Recovery WAS possible. The doctor just refused to attempt it.

The exact stdout/JSON snapshot is captured in `.planning/phases/95.2-install-cache-atomic-recovery-sessionstart-preflight/95.2-DOGFOOD-VERIFICATION.md`.

## Diagnostic Anti-Patterns Observed (and the lessons they teach)

### Anti-pattern: half-done-state-after-failed-cp

Renaming live state before the new state is verified leaves a window of corruption. If anything goes wrong between the rename and the cp, the user has no live install AND no clean rollback path. The lesson: destructive operations only AFTER non-destructive verification has passed. The atomic-swap pattern (cp -> verify -> two-step rename) is the canonical fix; it is used by apt, npm install, Debian dpkg, and atomic-deployment systems precisely because the failure mode of the simpler "rename-then-cp" pattern is unrecoverable. Phase 95.2 D-01 ports this pattern.

### Anti-pattern: drift-detected-false-on-missing-install

The class A drift comparison required BOTH sides to be readable. A "we have nothing on disk" case looks like "no drift" by default because the comparison short-circuits. The lesson: enumerate the recoverable states explicitly, do not infer them by short-circuit. A missing install with a populated cache is a recoverable drift; a missing install with an empty cache is a non-recoverable error; both must be classified, not implicitly defaulted. Phase 95.2 D-05 widens the drift predicate to fire on missing-install.

### Anti-pattern: fix-short-circuit-on-missing-install

The `--fix` dispatch read `report.drift.detected`, which was false. The user got "looks fine" semantics on a clearly broken state and was left with no actionable next step from the doctor surface. The lesson: the action-gating predicate must include all states the action can recover, not just the most common one. Phase 95.2 D-06 unifies the eligibility.

### Anti-pattern: detection-lag-via-no-preflight

SessionStart had hooks for banner, statusline, onboard, memory-resume-nudge, migrate-stale-user-settings, statusline-fallback-echo, preflight-tension-surface. None probed install integrity. The lesson: the cheapest detection happens at the front door. A 1500ms subprocess at session start is a small price to pay to surface a broken install state before the user invests in a session that will silently fail to load room context. Phase 95.2 D-08 adds the preflight.

### Anti-pattern: exit-code-conflation

The pre-95.2 exit code chain conflated "drift detected and recovery failed" with "drift detected and not attempted" (both exited 1) and conflated "internal error reading the cache" with "internal error in recovery" (both exited 3). Automation could not tell whether a re-attempt of `--fix` would help or whether the system was stuck. The lesson: distinct failure modes deserve distinct exit codes. Phase 95.2 adds exit code 4 for the rollback-after-commit-failure case (D-03), distinct from 0 (healthy), 1 (drift detected; not recovered), 2 (drift detected and recovered), 3 (internal error pre-recovery).

## Lessons Applied (Phase 95.2 specifically)

| Anti-pattern | Phase 95.2 fix | File:line |
|---|---|---|
| half-done-state-after-failed-cp | `performRecoveryAtomic` (cp via fs.cpSync to install.new -> verify version field on install.new/.claude-plugin/plugin.json -> two-step rename); rollback-on-commit-failure with exit code 4; safeRename helper with EXDEV cpSync+rmSync fallback | scripts/doctor.cjs:231-331 |
| drift-detected-false-on-missing-install | Drift detection widens: `install.status === 'missing' && cache.versions.length > 0` -> drift.detected=true, drift.reason='install-missing' | scripts/doctor.cjs:1305-1320 |
| fix-short-circuit-on-missing-install | `--fix` dispatch reads widened drift.detected; recovery body unchanged; install.recoverable JSON field exposes "auto-recoverable" vs "needs manual intervention" | scripts/doctor.cjs:1322-1342 |
| detection-lag-via-no-preflight | SessionStart entry #8 in hooks/hooks.json runs scripts/preflight-doctor.cjs (1500ms doctor subprocess; emits envelope warning above banner via hookSpecificOutput.systemMessage; honors MOS_NO_COLOR + NO_COLOR) | scripts/preflight-doctor.cjs (new) + scripts/doctor-preflight-format.cjs (new) |
| exit-code-conflation | Exit code 4 (NEW): "recovery attempted but rolled back to backup state". Distinct from 0 (healthy), 1 (drift), 2 (recovered), 3 (internal error pre-recovery) | scripts/doctor.cjs:1437-1448 |
| hermetic-test-against-real-install | MINDRIAN_PLUGIN_HOME env override mirrors MINDRIAN_ROOMS_HOME from 95.1 D-05; tests/test-doctor-atomic-swap.cjs runs 9 scenarios under scratch fixtures; 4 MOS_TEST_FORCE_FAIL injection points (copy/verify/rename-old/commit) exercise every failure stage | scripts/doctor.cjs:32-38 + tests/test-doctor-atomic-swap.cjs |

### Explicit non-goals (out of Phase 95.2 scope)

- **No auto-cleanup of stale backups.** The retention rule (D-04) is unchanged from Phase 93/95.1: `.stale-*` directories accumulate; the user manually cleans up after 24 hours of normal use. The 2026-05-06 incident demonstrated value of indefinite retention -- both prior `.stale-*` dirs were still on disk and supplied forensic evidence for this autopsy.
- **No recovery from a `.stale-*` backup when no marketplace cache exists.** Considered, deferred to 95.3 if surfaced. The existing `cache.status === 'ok'` precondition is strong enough; if it fails, manual intervention is correct.
- **No retroactive propagation.** Machines already in missing-install state get the patch only after the install is restored (forward-protective). Acceptable per the "tradeoff to flag" framing in the Phase 95.2 CONTEXT.md.
- **No new `--json` shape fields beyond `install.recoverable` + `drift.reason`.** Existing JSON contract preserved; users have automation that depends on it.

### Three-surface coverage

SessionStart hooks fire on Claude Code CLI only. The asymmetry is unavoidable:

| Surface | SessionStart fires? | How user discovers install drift |
|---|---|---|
| Claude Code CLI | YES (every session start, clear, compact) | Yellow warning line above banner via preflight-doctor.cjs |
| Claude Desktop | NO | Manual `/mos:doctor` run reports drift; no proactive surface |
| Cowork | NO | Manual `/mos:doctor` run reports drift; no proactive surface |

This is documented in the script header at `scripts/preflight-doctor.cjs` and called out in the v1.13.0-beta.6 CHANGELOG entry. Per the tri-polar rule in CLAUDE.md, hooks are a CLI-only primitive; Desktop and Cowork users still get the recovery path (via `/mos:doctor --fix` after Plan 95.2-00 lands the missing-install class A eligibility), they just get it on-demand rather than proactively.

## Provenance

- **Detected:** 2026-05-06 by jsagir (dogfood machine; same operator as the 2026-04-28 install-cache-drift autopsy).
- **Phase scope:** scripts/doctor.cjs (atomic-swap + missing-state eligibility); scripts/preflight-doctor.cjs (new); scripts/doctor-preflight-format.cjs (new); hooks/hooks.json (8th SessionStart entry, length 7 -> 8); tests/test-doctor-atomic-swap.cjs + tests/test-doctor-preflight-format.cjs + tests/test-session-start-preflight.sh (new); lib/memory/run-feynman-tests.cjs (test registration); CHANGELOG, plugin.json, package.json (5-gate release).
- **Triangulation:** third autopsy in the install-cache failure family. Cross-link: `docs/autopsies/2026-04-13-wrong-workspace-incident.md` (wrong-workspace cause; workspace guard fix); `docs/autopsies/2026-04-28-install-cache-drift-incident.md` (install-cache drift cause; doctor.cjs initial recovery surface in Phase 93). Each incident exposed a different cause; the surface (cache directory and its recovery code) is shared.
- **Ship target:** v1.13.0-beta.6. Slots between beta.5 (Phase 116 unresolved-tension-hook) and the upcoming beta.6 promotion path. Beta-channel testers exercise the fix; promoted into v1.13.0 stable for everyone else after the empathy audit.
- **Dog-fooding (Canon Part 6):** the patched doctor was self-tested against jsagir's actual missing-install state before merge. See `.planning/phases/95.2-install-cache-atomic-recovery-sessionstart-preflight/95.2-DOGFOOD-VERIFICATION.md`. The "we cannot credibly ship a recovery patch we haven't run on the broken state" rule was honored.
- **Reuse before build (Canon Part 7):** Phase 95.2 extends Phase 95.1's `scripts/doctor.cjs` surface; no parallel script. The new `scripts/preflight-doctor.cjs` is a thin SessionStart wrapper that subprocesses the existing diagnostic; it does not re-implement detection logic.
- **Graph boundary (Canon Part 8):** the SessionStart preflight is purely LOCAL. Zero network surface, no Brain queries, no telemetry. Verified by `grep -E "fetch|http:|curl|brain\.mindrian|tavily" scripts/preflight-doctor.cjs scripts/doctor-preflight-format.cjs` returning 0 matches outside comments and URLs.
- **R1 invariant preserved:** `lib/hmi/shape-f6-renderer.cjs` sha256 unchanged at `1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf`. Phase 95.2 deliberately did not touch the sealed Phase 101-01 surface.
