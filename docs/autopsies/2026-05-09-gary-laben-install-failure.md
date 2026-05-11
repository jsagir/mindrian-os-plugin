---
date: 2026-05-09
severity: high
status: in-progress (awaiting v1.13.0-beta.9 ship per Phase 95.6)
detected_by: Gary Laben (Wave-2 critical tester) via Claude Code refusing the install prompt + live install call 2026-05-09
resolved_by: Phase 95.6 install-cache-windows-hardening-and-skill-loop-resilience (in flight; target v1.13.0-beta.9)
related_incidents:
  - 2026-04-13-wrong-workspace-incident.md
  - 2026-04-28-install-cache-drift-incident.md
  - 2026-05-06-install-dir-missing-incident.md
incidents:
  - install-windows-max-path-failure
  - install-sh-skill-loop-halt
  - npm-package-unpublished-phantom
  - install-incomplete-statusline-not-registered
  - install-shell-variability-powershell-vs-cmd
  - install-permission-prompt-fatigue
diagnostic_anti_patterns:
  - install-receipt-absent-no-completion-verification
  - external-dependencies-assumed-available
  - cross-shell-ergonomics-untested
  - repo-data-integrity-unchecked-skill-md
  - marketing-copy-advertises-broken-install-path
  - bsl-1-1-mislabeled-as-open-source
---

# Incident Autopsy: Gary Laben Install Failure (Case #4) -- Install-Cache Family Moves Upstream

## Summary

On 2026-05-08, Gary Laben (Wave-2 critical tester, head of advisory board at Johns Hopkins, intro via Lawrence Aronhime) attempted a fresh install of MindrianOS on his Surface Pro 7 (Windows 11) running Claude Code. The install failed in six distinct ways across two sessions (2026-05-08 Claude Code transcript + 2026-05-09 live 66-minute install call with the maintainer + Lawrence). Gary's Claude Code surfaced four product bugs explicitly + two user-experience friction surfaces; the maintainer manually walked Gary through a workable install path during the live call, and Gary's machine ended in a working state at ~36:18 of the call.

This is case #4 in the install-cache failure family. Cases #1-3 (2026-04-13 wrong-workspace, 2026-04-28 install-cache drift, 2026-05-06 install-dir-missing) were all RECOVERY incidents -- the install once worked and drifted from a working state. Case #4 is the first INSTALL incident in the family: the install never worked on Gary's machine to begin with. Every prior phase in the family assumed install correctness and built recovery on top of that assumption.

The autopsy convention from cases #1-3 requires this file to exist before Phase 95.6 ships as v1.13.0-beta.9. Status is "in-progress" pending Phase 95.6 ship; this file will be promoted to "resolved" with the resolved_by phase tag once 95.6 lands.

## Timeline

Reconstructed from docs/testers/gary-laben/FEEDBACK.md (2026-05-07, 2026-05-08, 2026-05-09 entries) and 95.6-RESEARCH.md (live call findings).

- **2026-05-07** -- Gary emails (via Lawrence): Claude Code refuses the install-script prompt on third-party-plugin / social-engineering grounds (correct-by-design), and he asks the scope question (does it run in every Claude Code project). Onboarded as Wave-2; 60-day Brain key issued; welcome email drafted (gitignored, key redacted from any committed file).
- **2026-05-08** -- Gary's Claude Code works through the corrected git-clone install path (paste 17:27, executed 18:02). `npx @mindrian/os@next` (the "fastest path" the install site advertises) fails with a 404 -- the package has never been published. Gary's CC falls back to `git clone`; the clone fails on Windows MAX_PATH at the 189-char `.planning/phases/92-...` leaf; Gary's CC fixes locally with `git config --global core.longpaths true` and re-clones. `bash install.sh` then dies at the skill-loop on `cp: cannot stat '.../skills/mullins-scaffold//SKILL.md'` because `set -euo pipefail` aborts the whole script; agents/, hooks, settings.json, the larry-extended default, and MINDRIAN_OS_ROOT are all left unregistered. Gary's CC manually completes those steps (agent symlinks + settings.json fragments). The statusLine block -- which sits later in install.sh, past the halt point -- is never written; Gary's manual recovery does not include it, so the bottom-of-terminal statusline the SessionStart contract promises never renders.
- **2026-05-09 (live 66-minute install call: Lawrence Aronhime + Gary Laben + Jonathan Sagir)** -- Gary starts the install in Windows PowerShell; the command fails. After ~6 minutes of troubleshooting the maintainer has Gary open CMD ("Start, type CMD") and the install proceeds -- same OS, same machine, same command, different shell, different behavior. Gary clicks through 10+ separate Claude Code permission prompts (one per Bash invocation); Lawrence's standing rule on the call ("I always hit two") shows the prompt fatigue is already trained into testers. The install reaches a working state at ~36:18 of the call: 85 commands, 6 skills, 9 agents, SessionStart hook, larry-extended default, MINDRIAN_OS_ROOT all registered. The statusline visibility is never verified on the call. Gary's CC also flags the Brain API key as exposed in chat history (correctly -- compromised the moment it was pasted); the key is REVOKED 2026-05-09 and a new 60-day key issued via a fresh narrow channel.
- **2026-05-10** -- The three product bugs (plus the four-failure-mode picture) are filed as Phase 95.6 (install-cache failure family case #4). A code-reviewer subagent dispatch verifies four prior-art audit claims against source files and surfaces internal contradictions; 95.6-CONTEXT.md is patched (D-05 expands to D-05a/b/c/d; D-10 + D-11 added; the corrected D-05 root cause: `scripts/release.sh` has Steps 1-11 with NO Step 9.5 and `grep "npm publish\|@mindrian" scripts/release.sh` returns zero matches -- a missing feature, not a broken one).

## Root Causes (six distinct, four upstream of install.sh)

### Cause 1: Windows MAX_PATH (260-char) failure on git clone

`.planning/phases/92-refactor-constitution-and-trust-layer-formalizes-audit-driven-refactor-work-constitution-v1-1-directive-1-validation-directive-2-consolidation-directive-3-unidirectional-flow-trust-layer/` has a 189-character leaf name. Combined with Gary's home path (`C:\Users\GaryLaben\.claude\plugins\mindrian-os\...`), the resulting full path exceeds Windows MAX_PATH on the second clone attempt. Git clone failed with `fatal: cannot create directory at '.planning/phases/92-...': Filename too long`. Gary's CC fixed locally with `git config --global core.longpaths true` but the install.sh script does not preflight this on Windows.

**Resolution path:** Phase 95.6 D-01 (Windows long-path preflight) + D-02 (rename 92-trust-layer-refactor to short leaf).

### Cause 2: install.sh skill-loop halt on missing SKILL.md

The `cp` loop in install.sh hits `set -euo pipefail` and exits with code 1 when a skill directory exists but lacks SKILL.md. As of 2026-05-09, `skills/mullins-scaffold/` is the known-broken case: directory exists, SKILL.md absent. install.sh dies at this step (~step 7 of ~14), leaving agents/, hooks/, settings.json, larry-extended default agent, and MINDRIAN_OS_ROOT env var all unregistered. Gary's CC manually completed those steps via symlinks + settings.json fragments during the live call.

**Resolution path:** Phase 95.6 D-03 (skill-loop hardening: backfill missing SKILL.md + defensive pre-filter in install.sh).

### Cause 3: @mindrian/os npm package was never published (phantom)

The install site at mindrianos-install-site.vercel.app advertises `npx @mindrian/os@next` as the "fastest path" with a copy button. The package returns 404 on the npm registry: never published. `scripts/release.sh` has Steps 1-11 with no `npm publish` invocation anywhere; the memory entry `feedback_release_lockstep_npm.md` claims a Step 9.5 was added 2026-05-06 but the actual file does not contain it. v1.13.0-beta.1 through beta.8 all shipped without the npm side because the gate that was supposed to enforce lockstep publishing did not exist.

**Resolution path:** Phase 95.6 D-05a (add Step 9.5 npm publish gate) + D-05b (update marketplace.json to npm source). Until D-05a ships, the install site cannot keep promising what the registry cannot serve.

### Cause 4: statusLine block never written to settings.json after halted install

When install.sh halts at the skill-loop (Cause 2), the statusLine registration step (which sits later in the script) never runs. Gary's manual recovery via his CC included hooks + larry-extended default + MINDRIAN_OS_ROOT env var but did NOT include a statusLine entry. Net effect: any tester whose install.sh halts before the statusline step is left with a half-installed UI surface and no error to indicate it. The session-start banner per v1.12.5.1 SessionStart contract prompts users with "Look at the bottom of your terminal. Do you see a line starting with ⬡ MindrianOS-Plugin?" -- but for Gary the line never appeared.

**Resolution path:** Phase 95.6 D-09 (statusline registration in install.sh + /mos:doctor --fix integration as new drift class).

### Cause 5: PowerShell vs CMD shell variability (NEW, surfaced live)

Gary started the install in Windows PowerShell. The install command failed. After ~6 minutes of live troubleshooting, the maintainer instructed Gary to open CMD via "Start, type CMD" and the install proceeded. Same OS, same machine, same install command, different shell, different behavior. install.sh runs INSIDE Git Bash and cannot detect what shell launched it. Three candidate root causes: (a) `.sh` script invocation through Git Bash needs different escaping in PowerShell vs CMD, (b) PowerShell's execution policy was blocking something, (c) the path-quoting parses differently between shells.

**Resolution path:** Phase 95.6 D-01 expanded with shell-detection preflight (sub-decision documented in 95.6-RESEARCH.md Section 2 D-01).

### Cause 6: Permission-prompt fatigue during install (NEW, surfaced live)

The install process triggers 10+ separate permission prompts in Claude Code, one per Bash invocation. Even when install.sh runs cleanly, the user is forced through 10+ prompt cycles. Lawrence's standing rule on the live call: "I always hit two" -- he has trained himself to autopilot through the prompts without reading. Gary clicked yes at least 10 times during install. This is not strictly a bug but a security-theater problem: testers trained to autopilot through prompts no longer get the safety value the prompts were designed to provide.

**Resolution path:** Phase 95.6 D-03 sub-decision (install permission ergonomics: bundle commands into fewer Bash invocations OR ship a settings.json permission allowlist for install paths OR document `--dangerously-skip-permissions` with explicit scope warnings).

## Detection (how case #4 was caught)

Pattern B from the family audit (95.6-FAMILY-AUDIT.md Section 3): detection lags by exactly one incident, and every case has been caught by a HUMAN (Lawrence x2, Jonathan x1, Gary x1), never by automated monitoring. Case #4 was caught by Gary's Claude Code refusing the original install prompt on social-engineering grounds (correctly), then by the live 2026-05-09 install call surfacing the four product bugs in real time, then by a 2026-05-09 brain-admin.cjs revoke + reissue of Gary's compromised Brain key, then by a code-reviewer subagent dispatch on 2026-05-10 that verified four prior-art audit claims against source files and identified internal contradictions.

## Generalization

Cases #1-3 are recovery incidents fixable from inside the existing install. Case #4 is the first install incident in the family; four of its six root causes are upstream of install.sh and cannot be fixed by extending the recovery code. Phase 95.6's leading-approach packaging architecture (95.6-PACKAGING-RESEARCH.md) addresses this by adding scripts/release.sh extensions, a bin/cli.js value-add layer, and SessionStart hook for runtime dependency reconciliation -- four plans that operate OUTSIDE the install.sh boundary because install.sh ITSELF cannot reach those layers.

## The family pattern

Case #4 is the fourth incident in the install-cache failure family:

- **Case #1** -- 2026-04-13 wrong-workspace incident (workspace guard). A full milestone executed in the plugin cache directory instead of the dev workspace. Fix: `scripts/session-start` workspace guard.
- **Case #2** -- 2026-04-28 install-cache-drift incident, shipped via Phase 93 (v1.11.1 hotfix install-cache-drift-recovery + brain-telemetry-visibility). The cache drifted from a working state. Fix: drift-recovery in `/mos:doctor`.
- **Case #3** -- 2026-05-06 install-dir-missing incident, shipped via Phase 95.2 (install-cache-atomic-recovery-sessionstart-preflight, v1.13.0-beta.6). The cache directory went missing entirely. Fix: atomic recovery + SessionStart preflight.
- **Case #4** -- this incident (2026-05-08/09 Gary Laben install). The install never worked on the target machine in the first place. Fix: Phase 95.6 Tier 1 plans (below).

The pattern: a single guard does not generalize across failure modes that share a surface; each case adds one independent defense. Cases #1-3 are all RECOVERY incidents (the install once worked and drifted); case #4 moves the family upstream -- it is the first INSTALL incident, where the install never worked to begin with. The reverse-salient framing (docs/UI-UX-CONVERGENCE-2026-05-10/04-REVERSE-SALIENT-INSTALL.md) names the underlying constraint: install is not atomic and does not self-verify -- the four bugs Gary hit are costumes on one constraint. Case #5 will surface in approximately 4-6 weeks per Pattern B's incident cadence (95.6-FAMILY-AUDIT.md Section 3: detection lags by exactly one incident, and every case so far has been caught by a HUMAN -- Lawrence x2, Jonathan x1, Gary x1 -- never by automated monitoring); Phase 95.6 adds forward-looking detection (install receipts per R-01, dependency audit per R-02, cross-shell wrapper per R-03, repo-data-integrity gate per R-04, install-permission allowlist per R-05, install-site CI gate per R-06) so that case #5 is detectable BEFORE the next tester hits it.

## Fixes shipped (Phase 95.6, v1.13.0-beta.9)

The Tier 1 subset (NATO Defense College Rome June 2026-06-01 deadline gates this set):

- **95.6-01 (D-02)** -- rename `.planning/phases/92-refactor-constitution-...` (189-char leaf) to `.planning/phases/92-trust-layer-refactor/`; update all internal references; carry the long name as `full_slug` for searchability. Removes the MAX_PATH trigger at the source.
- **95.6-03 (D-03)** -- harden the install.sh skill-loop: pre-filter to only iterate skill directories that have SKILL.md present, warn-and-continue on the rest; backfill the canonical missing `skills/mullins-scaffold/SKILL.md`. Plus the permission-ergonomics sub-decision.
- **95.6-04 (D-01)** -- Windows long-path preflight in install.sh: set `git config --global core.longpaths true` before the clone on Windows + Git Bash, with a banner-line explanation; shell-detection preflight (PowerShell vs CMD); retry cleanup of a partial clone.
- **95.6-05 (D-09)** -- `register_statusline()` runs FIRST in the install order (independent of the skill-loop); write a `.install-receipt.json`; new `/mos:doctor` drift class H (install-incomplete) with `--fix` that restamps the statusLine block idempotently; auto-run `/mos:doctor` on a fresh first session.
- **95.6-06 (D-05a)** -- this plan: `scripts/release.sh` Step 9.5 npm publish gate (between push and cache-update), dist-tag on the version suffix, MOS_TEST_DRY_RUN escape hatch, `npm pack --dry-run` payload review against the `files` allowlist, explicit halt + recovery message on publish failure. `package.json` renamed to `@mindrian/os`, `private:true` removed, `files` allowlist added. The actual live `npm publish` happens at release time (95.6-10), using THIS Step 9.5 as the vehicle.
- **Cold-machine manual gate** -- `tests/manual/95.6-windows-cold-install-acceptance.md`: a release-time manual acceptance run on a fresh Windows machine, because the four bugs above can only be verified end-to-end outside CI.

Tier 2 (D-05b marketplace npm source, D-05c bin/cli.js, D-05d SessionStart npm-install hook) targets beta.9 but defers to beta.10 if NATO pressure compresses. Tier 3 (D-04 README manual recovery, D-06 BSL-1.1 license sweep, D-07 SEED-007 scanner, D-10 subagent parity doc, D-11 reserved names + Deferred Tool Loading) is beta.10. The install-site `npx @mindrian/os@next` block stays REMOVED (or rewritten to advertise the now-working npm path) until the recovery publish lands -- a manual action in the separate `~/mindrianos-install-site/` repo, noted in the 95.6-10 release checklist, not a file edit in this repo.

## Resolution status

Phase 95.6 in flight as of 2026-05-10 with 7 planning artifacts in `~/MindrianOS-Plugin/.planning/phases/95.6-install-cache-windows-hardening-and-skill-loop-resilience/`:

```
95.6-CONTEXT.md               9 decisions D-01..D-09 + D-05a/b/c/d expansion + D-10 + D-11
95.6-RESEARCH.md              live call findings + NATO June 2026-06-01 deadline
95.6-PACKAGING-RESEARCH.md    leading-approach packaging architecture (Path A + B + C)
95.6-FAMILY-AUDIT.md          cross-phase audit of cases #1-4
95.6-INSIGHTS.md              code-review findings 2026-05-10
95.6-RECOMMENDATIONS.md       GSD action sequence (22 RECs)
95.6-01-PLAN.md               partial plan for D-02 rename
```

This autopsy will be promoted from "in-progress" to "resolved" once Phase 95.6 ships as v1.13.0-beta.9 (target 2026-06-01 per NATO Defense College Rome June course; ideal 2026-05-23 for 8-day Lawrence dogfood window).

## Cross-references

- docs/autopsies/2026-04-13-wrong-workspace-incident.md (case #1 in family -- wrong-workspace; workspace guard)
- docs/autopsies/2026-04-28-install-cache-drift-incident.md (case #2 in family -- install-cache drift; shipped via Phase 93, v1.11.1)
- docs/autopsies/2026-05-06-install-dir-missing-incident.md (case #3 in family -- install-dir missing; shipped via Phase 95.2, v1.13.0-beta.6)
- docs/UI-UX-CONVERGENCE-2026-05-10/04-REVERSE-SALIENT-INSTALL.md ("install is not atomic and does not self-verify -- the four bugs are costumes on one constraint")
- 95.6-CONTEXT.md (locked decisions, including the Priority Hierarchy table)
- 95.6-RESEARCH.md (live-call findings + NATO June 2026-06-01 deadline)
- 95.6-PACKAGING-RESEARCH.md (leading-approach packaging architecture)
- 95.6-FAMILY-AUDIT.md Section 1 (full case-#4 entry mirrors this autopsy in tabular form) + Section 3 (Pattern B detection cadence)
- 95.6-01-PLAN.md / 95.6-03-PLAN.md / 95.6-04-PLAN.md / 95.6-05-PLAN.md / 95.6-06-PLAN.md (the five Tier 1 plans)
- docs/testers/gary-laben/FEEDBACK.md (2026-05-07 + 2026-05-08 + 2026-05-09 entries; tester record -- Brain key UUIDs redacted per REC-05)
- docs/testers/outbox/2026-05-07-gary-laben-welcome.md (gitignored; key rotation log; live key never committed)
