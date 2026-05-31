---
status: resolved             # gathering | investigating | fixing | resolved
kind: rca                     # rca | debug-session | qa-sweep
trigger: "doctor-class-a-drift-topology-blind-false-positive"
issue_id: ""
severity: medium              # blocker | high | medium | low
surfaces: [cli]               # cli | desktop | cowork
brain_mode: full-loop         # full-loop | local-only | tier-0
canon_parts: [6]              # Part 6 Product-as-Venture (dog-fooded install lifecycle)
created: 2026-05-31T12:09:20Z
updated: 2026-05-31T13:30:00Z
---

## Current Focus

hypothesis: The SessionStart preflight "install dir missing" banner is a false positive. The class A drift check in scripts/doctor.cjs uses the hardcoded legacy INSTALL_DIR and never consults resolveActivePluginRoot(), so under marketplace-cache topology (where the legacy dir is correctly absent) it reports install-missing drift while the topology-aware class I gate reports healthy.
test: Run doctor --json (feeds the banner) vs doctor --install-state (class I) on the same healthy beta.38 marketplace-cache install and compare the drift verdicts.
expecting: doctor --json reports drift.detected=true reason=install-missing; doctor --install-state reports 0 drift / healthy. Confirmed.
next_action: Guard the class A install-missing drift branch on topology so a missing legacy INSTALL_DIR is not drift when resolveActivePluginRoot().topology === 'marketplace-cache' and the resolved root is healthy.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: 1.13.0-beta.38
- Reported by: smoke-test pass (beta.34-38), maintainer dogfood box
- Date first observed: 2026-05-31
- Related debug sessions: mos-update-silent-activation-gap.md (resolved; sibling activation-topology family), release-pipeline-install-state-corruption-2026-05-25.md (active; install-state family), stale-install-cache-audit-anti-pattern.md (resolved)

## Source-of-Truth Preamble

- CODE claims read against: origin/main HEAD @ a3f80cf9 (working tree clean, in sync with origin/main)
- WIRE claims probe against: local stdio shim bin/mindrian-brain-mcp-client.cjs @ 1.13.0-beta.38 (doctor --brain-smoke reached L5 e2e, exit 0)
- Date of audit: 2026-05-31
- Re-verification rule: every source-code claim below was read from origin/main HEAD @ a3f80cf9; no install-cache reads were used for CODE claims.

## Problem Statement

On every session under the modern marketplace-cache install topology, MindrianOS prints a yellow SessionStart banner "MindrianOS install dir missing; run /mos:doctor --fix to recover" even though the active install is healthy and serving the correct version. The banner is a false positive and its recommended remedy makes the topology worse.

## Symptoms

expected: On a healthy marketplace-cache install (installed_plugins.json points mos@mindrian-marketplace at cache/mindrian-marketplace/mos/1.13.0-beta.38), SessionStart prints no install-drift warning.
actual: SessionStart prints "⚠ MindrianOS install dir missing; run /mos:doctor --fix to recover. Backup: /home/jsagi/.claude/plugins/mindrian-os.stale-1.12.5-20260506-163240."
errors: no exception. doctor --json emits drift={"detected":true,"reason":"install-missing"} and install={"status":"missing","detail":"install dir does not exist: /home/jsagi/.claude/plugins/mindrian-os","recoverable":true}
reproduction:
  1. Have a marketplace-cache install: installed_plugins.json maps mos@mindrian-marketplace to cache/mindrian-marketplace/mos/<version>, and ~/.claude/plugins/mindrian-os does NOT exist.
  2. Start a session (or run: node scripts/doctor.cjs --json | node scripts/doctor-preflight-format.cjs).
  3. Observe the "install dir missing" banner, while node scripts/doctor.cjs --install-state reports "2 healthy / 0 drift / 0 warnings".
started: latent since the marketplace-cache topology became the default; class A drift predates resolveActivePluginRoot() (Phase 123). beta.32 repointed line-40 INSTALL_DIR to the resolver "for new code" but the class A SessionStart drift path was never repointed.

## Scope and Impact

- Affected surfaces: cli (the SessionStart banner is a CLI surface; Desktop/Cowork have no statusline but the one-line state echo could inherit the same report)
- Affected commands: doctor --json drift fields, the SessionStart preflight banner (scripts/preflight-doctor.cjs -> scripts/doctor-preflight-format.cjs)
- Affected users: every install on marketplace-cache topology without a legacy ~/.claude/plugins/mindrian-os dir (the modern default for fresh installs and post-beta.24 updates)
- Version range: latent through 1.13.0-beta.38 (current)
- Severity: medium (no functional breakage; erodes trust via a recurring false alarm and steers users to a remedy that creates a legacy-clone the class I gate then flags)
- Blast radius: any consumer of doctor --json report.drift / report.install (preflight banner; potentially the Desktop/Cowork state echo); the class A --fix recovery path (performRecoveryAtomic) which would recreate the legacy dir

## Eliminated

- hypothesis: The active install is genuinely missing / unactivated (a real beta.32-class activation gap).
  evidence: installed_plugins.json maps mos@mindrian-marketplace -> cache/mindrian-marketplace/mos/1.13.0-beta.38 (lastUpdated 2026-05-31); resolveActivePluginRoot() returns {root: cache/.../1.13.0-beta.38, source: installed_plugins.json, topology: marketplace-cache}; doctor --brain-smoke reached L5 e2e exit 0; doctor --install-state reports healthy. The wire serves beta.38.
  timestamp: 2026-05-31T12:05:00Z

## Evidence

- timestamp: 2026-05-31T11:58:00Z
  checked: node scripts/doctor.cjs --install-state (class I, topology-aware)
  found: "install-cache healthy (undefined); dev-source consistent (1.13.0-beta.38); Summary: 2 healthy / 0 drift / 0 warnings"
  implication: The topology-aware gate sees no drift; the install is healthy.
- timestamp: 2026-05-31T12:00:00Z
  checked: node scripts/doctor.cjs --json | parse drift + install
  found: drift={"detected":true,"reason":"install-missing"}; install={"status":"missing","detail":"install dir does not exist: /home/jsagi/.claude/plugins/mindrian-os"}
  implication: The class A drift path disagrees with class I. It keys off the hardcoded legacy INSTALL_DIR, not the resolved active root.
- timestamp: 2026-05-31T12:02:00Z
  checked: node scripts/doctor.cjs --json | node scripts/doctor-preflight-format.cjs
  found: Emits the exact SessionStart banner. The formatter fires solely on report.drift.detected (scripts/doctor-preflight-format.cjs:41) and reads install.status for the {missing|drifted} word (line 42).
  implication: The banner is a pure function of the class A drift verdict. Fixing class A drift fixes the banner with no formatter change.
- timestamp: 2026-05-31T12:04:00Z
  checked: scripts/doctor.cjs:48-65 (INSTALL_DIR constant) + 3415-3421 (class A missing-install drift) + 3437-3438 (--fix recovery gate)
  found: INSTALL_DIR = path.join(PLUGIN_HOME, 'mindrian-os') (legacy clone path). The missing-install drift branch fires on installResult.status==='missing' && cacheResult.status==='ok' with no topology guard. --fix then calls performRecoveryAtomic, which builds INSTALL_DIR + '.new' and renames it into INSTALL_DIR (scripts/doctor.cjs:420-488), i.e. it RECREATES the legacy dir from cache.
  implication: Running /mos:doctor --fix would recreate ~/.claude/plugins/mindrian-os as a copy of the cache, producing a legacy clone that class I (scripts/doctor.cjs:1745-1752) then reports as a migration candidate to backup-then-remove. The two subsystems contradict each other.

## Technical Root Cause

- Site: scripts/doctor.cjs:3415-3421, the class A missing-install drift branch (the constant it reads is INSTALL_DIR at scripts/doctor.cjs:55).
- Cause: The branch treats `installResult.status === 'missing' && cacheResult.status === 'ok'` as recoverable `install-missing` drift. installResult is computed against the hardcoded legacy INSTALL_DIR (~/.claude/plugins/mindrian-os). Under marketplace-cache topology the legacy dir is correctly absent (Claude Code loads the plugin from the cache path recorded in installed_plugins.json), so "legacy dir absent" is the healthy state, not drift. The branch has no topology awareness, unlike the class I gate which resolves via resolveActivePluginRoot() (lib/core/active-plugin-root.cjs).
- Why it surfaces now: marketplace-cache is the default install topology since the beta.24 vendoring work; fresh installs and updates land in cache/mindrian-marketplace/mos/<version> and never create the legacy dir. beta.32 repointed doctor.cjs line-40 to resolveActivePluginRoot() "for new code" but left the class A SessionStart drift path on the legacy constant, so the banner fires for everyone on the modern topology.

## Required Code Changes

- Change 1:
  - Location: scripts/doctor.cjs:3415-3421, the `install-missing` drift branch in the report builder
  - Current behavior: Reports drift.detected=true reason=install-missing whenever the legacy INSTALL_DIR is absent and the cache has versions, regardless of topology.
  - Required behavior: Make the branch topology-aware. When resolveActivePluginRoot() returns topology==='marketplace-cache' AND the resolved root exists and is healthy (resolves to a valid plugin.json version), a missing legacy INSTALL_DIR is NOT drift. Only fire install-missing drift when the resolved active root is the legacy path (topology !== 'marketplace-cache') and that path is genuinely missing, OR when no healthy active root can be resolved at all.
  - Short-term patch: Guard the branch: `if (installResult.status === 'missing' && cacheResult.status === 'ok' && resolveActivePluginRoot().topology !== 'marketplace-cache')`. This silences the false banner immediately while preserving the legacy-topology recovery path.
  - Long-term fix: Compute installResult against resolveActivePluginRoot().root rather than the hardcoded INSTALL_DIR constant, so class A and class I share one source of truth for "where the active install is". Keep INSTALL_DIR only for the legacy-clone migration semantics (class I).
- Change 2:
  - Location: scripts/doctor.cjs:3437-3438, the class A --fix recovery gate (defense-in-depth)
  - Current behavior: On any drift.detected (outside --install-state), --fix calls performRecoveryAtomic which recreates the legacy dir.
  - Required behavior: Do not recreate the legacy dir under marketplace-cache topology. With Change 1 in place, drift.detected is already false for the healthy marketplace-cache case, so this gate is no longer reached for that case. Add an assertion/guard so a future regression cannot re-enable legacy-dir recreation when topology==='marketplace-cache'.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: tests/test-doctor-class-a-topology-drift.cjs (new)
  - Given: a synthesized marketplace-cache topology (resolveActivePluginRoot mocked/env-injected to topology==='marketplace-cache' with a healthy resolved root) and an absent legacy INSTALL_DIR
  - When: the doctor report builder computes drift
  - Then: report.drift.detected === false (no install-missing); assert the SessionStart formatter (formatPreflightWarning) returns '' for that report
  - Runner registration: register in lib/memory/run-feynman-tests.cjs and add to the relevant tests/run-all-*.sh aggregator
- Test 2:
  - Type: unit
  - Location: tests/test-doctor-class-a-topology-drift.cjs (same file)
  - Given: a legacy topology (topology !== 'marketplace-cache') with a genuinely missing active root and a cache that has versions
  - When: the doctor report builder computes drift
  - Then: report.drift.detected === true reason==='install-missing' (the legacy recovery path is preserved, no regression)
  - Runner registration: same as Test 1
- Test 3:
  - Type: integration
  - Location: tests/test-doctor-class-a-topology-drift.cjs (same file)
  - Given: the live repo on origin/main HEAD
  - When: doctor --json and doctor --install-state run on the same install
  - Then: their drift verdicts agree (both healthy on marketplace-cache); this is the cross-gate consistency invariant

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under the next beta ("SessionStart no longer prints a false 'install dir missing' banner on marketplace-cache installs; the class A drift check is now topology-aware and agrees with --install-state").
- Release lockstep: ships in a beta; the release-process lockstep applies (plugin.json, package.json, package-lock.json, CHANGELOG, git tag, marketplace.json, install minisite). See .claude/includes/release-process.md.
- Canon: touches Part 6 (Product-as-Venture, dog-fooded install lifecycle). No canon text change; update docs/CANON-PHASE-MAP.md Part 6 row only if a phase is assigned. Declare canon_parts in the fix's frontmatter.
- knowledge-base.md: on resolve, add the summary block (slug, date, keywords: install-missing, marketplace-cache, topology-blind, false-positive banner; root cause; fix; files changed).
- Docs / monitoring: none. The fix is internal to doctor.cjs + a new test.

## MindrianOS gates (pre-resolution checklist)

1. Canon Part 8 (Graph Boundary): the fix touches scripts/doctor.cjs drift logic only; zero Brain wire; no user bytes egress. PASS by construction.
2. Tri-Polar (three surfaces): the banner is a CLI surface; the fix is in shared doctor.cjs report logic so Desktop/Cowork state-echo consumers inherit it. Verify CLI directly; Desktop/Cowork verified by construction (same report builder).
3. Cross-platform: the fix touches path/topology resolution. resolveActivePluginRoot() is already cross-platform; the guard adds no new path logic. Verify on Linux; Windows/Mac by construction (no new spawn/path code).
4. Release lockstep: named above.
5. No em-dashes: this RCA, the code comments, the CHANGELOG entry, and the commit message use hyphens only.
6. Reuse before build (Part 7): the fix reuses the existing resolveActivePluginRoot() resolver (lib/core/active-plugin-root.cjs) rather than adding a new topology probe. No net-new command/skill/agent/hook.

## Resolution

root_cause: The class A "install-missing" drift branch in scripts/doctor.cjs (the branch that feeds the SessionStart preflight banner via scripts/doctor-preflight-format.cjs) was topology-blind. It fired on `installResult.status === 'missing' && cacheResult.status === 'ok'` keyed off the hardcoded legacy INSTALL_DIR (~/.claude/plugins/mindrian-os, scripts/doctor.cjs:55), with no consultation of resolveActivePluginRoot(). Under marketplace-cache topology that legacy dir is CORRECTLY absent (Claude Code loads the plugin from the cache path recorded in installed_plugins.json), so "legacy dir absent" is the healthy state -- but class A reported it as recoverable install-missing drift, firing a false banner on every session, while the topology-aware class I gate (--install-state) correctly reported healthy.

fix: Added a topology guard to the class A install-missing drift branch (scripts/doctor.cjs:3418-3420): the branch now also requires `resolveActivePluginRoot().topology !== 'marketplace-cache'`. Because resolveActivePluginRoot() only returns a marketplace-cache root after isPluginDir() validates a real .claude-plugin/plugin.json, a marketplace-cache topology already implies a healthy resolved active root. A defense-in-depth guard was added to the --fix recovery gate (scripts/doctor.cjs:3449-3450) so a future regression cannot re-enable performRecoveryAtomic recreating the legacy dir under marketplace-cache topology. The legacy/dev recovery path is preserved: a genuinely-missing active root under any non-marketplace-cache topology still reports install-missing drift and is still recoverable via --fix. Reuse-before-build honored: the existing resolveActivePluginRoot() resolver was reused; no new topology probe was added.

verification: All evidence captured from live commands on this beta.38 marketplace-cache dogfood box at origin/main HEAD a3f80cf9.
  - `node scripts/doctor.cjs --json | node scripts/doctor-preflight-format.cjs` -> prints NOTHING (banner_output=[]). Was the false "install dir missing" banner before the fix.
  - `node scripts/doctor.cjs --json` -> drift={"detected":false} (was drift={"detected":true,"reason":"install-missing"}); doctor --json exit 0 (was exit 1).
  - `node scripts/doctor.cjs --install-state` -> "Summary: 2 healthy / 0 drift / 0 warnings" (unchanged -- cross-gate consistency now achieved: --json and --install-state agree).
  - New test tests/test-doctor-class-a-topology-drift.cjs: 3/3 PASS (a.1 marketplace-cache absent-legacy -> no drift + empty banner; a.2 non-marketplace-cache topology -> install-missing drift preserved; a.3 cross-gate --json vs --install-state agree).
  - Regression: full doctor + install-state suite 20/20 GREEN (test-doctor-class-i 11/11, test-doctor-class-j, test-doctor-acceptance 6/6, test-doctor-atomic-swap 9/9, test-doctor-fix-renderer 7/7, classes B/C/E/F/G/G-fix/H/H-fix, ui-self-compliant, install-state-record, install-state-migration, preflight-format 9/9, acceptance-preflight-checks, acceptance-self-coverage). Two suites (atomic-swap, fix-renderer) needed a hermetic adaptation: they model LEGACY-clone recovery but resolveActivePluginRoot() reads os.homedir() not MINDRIAN_PLUGIN_HOME, so on a marketplace-cache host the new guard would otherwise suppress the recovery under test -- both now pin MINDRIAN_OS_ROOT at the scratch legacy path to classify a non-marketplace-cache topology. The renderer/recovery contract is unchanged; only the topology context that triggers it is pinned. This is itself confirmation the fix works: --fix no longer recreates the legacy dir under marketplace-cache topology.

files_changed:
  - scripts/doctor.cjs (+21 lines: topology guard on the install-missing drift branch at :3418-3420 + defense-in-depth guard on the --fix recovery gate at :3449-3450, both with explanatory comments; no em-dashes introduced)
  - tests/test-doctor-class-a-topology-drift.cjs (NEW, 3 hermetic scenarios: marketplace-cache no-drift+no-banner, non-marketplace-cache recovery preserved, cross-gate consistency)
  - lib/memory/run-feynman-tests.cjs (registered the new test in the doctor block)
  - tests/test-doctor-atomic-swap.cjs (runDoctor pins MINDRIAN_OS_ROOT to keep the legacy-recovery scenario hermetic against the host topology)
  - tests/test-doctor-fix-renderer.cjs (runDoctor pins MINDRIAN_OS_ROOT for the same reason)

commits: (deferred -- per session instructions, no release lockstep / git push from this debug flow; changes implemented + verified in the working tree at a3f80cf9; CHANGELOG Fixed entry + plugin.json bump to be applied at the next beta release cut per .claude/includes/release-process.md)

mindrianos_gates:
  - Canon Part 8 (Graph Boundary): PASS by construction -- the fix touches scripts/doctor.cjs drift logic + reuses resolveActivePluginRoot() (LOCAL file reads, zero network); no Brain wire; no user-byte egress.
  - Tri-Polar (CLI/Desktop/Cowork): the banner is a CLI surface; the fix is in the shared doctor.cjs report builder so Desktop/Cowork state-echo consumers inherit it. CLI verified directly; the other two by construction (same report builder).
  - Cross-platform: reuses the already-cross-platform resolveActivePluginRoot(); the guard adds no new path/spawn logic. Verified on Linux; Windows/Mac by construction.
  - No em-dashes: PASS -- all added code comments + this RCA use hyphens. (One pre-existing em-dash in scripts/doctor.cjs:13 header comment was NOT introduced by this fix and left untouched to avoid unrelated churn.)
  - Reuse before build (Part 7): PASS -- reused resolveActivePluginRoot() (lib/core/active-plugin-root.cjs); no net-new command/skill/agent/hook/probe.
