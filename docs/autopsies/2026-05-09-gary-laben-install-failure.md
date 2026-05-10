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

The family pattern after case #4 is clearer: each incident extends the family with new defenses but doesn't generalize across failure modes. A single guard does not generalize across failure modes that share a surface. Case #5 will surface in approximately 4-6 weeks per Pattern B's incident cadence; Phase 95.6 must include forward-looking detection (install receipts per R-01, dependency audit per R-02, cross-shell wrapper per R-03, repo-data-integrity gate per R-04, install-permission allowlist per R-05, install-site CI gate per R-06) so that case #5 is detectable BEFORE the next tester hits it.

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

- 2026-04-13-wrong-workspace-incident.md (case #1 in family)
- 2026-04-28-install-cache-drift-incident.md (case #2 in family)
- 2026-05-06-install-dir-missing-incident.md (case #3 in family)
- 95.6-CONTEXT.md (locked decisions, including Priority Hierarchy table)
- 95.6-PACKAGING-RESEARCH.md (leading-approach packaging architecture)
- 95.6-FAMILY-AUDIT.md Section 1 (full case-#4 entry mirrors this autopsy in tabular form)
- docs/testers/gary-laben/FEEDBACK.md (2026-05-08 + 2026-05-09 entries; tester record)
- docs/testers/outbox/2026-05-07-gary-laben-welcome.md (gitignored; key rotation log)
