---
methodology: find-bottlenecks (Reverse Salient -- Hughes 1983)
created: 2026-05-10
depth: deep
problem_type: ill-defined / complicated
venture_stage: Design
room_section: solution-design
brain_mode: mode-a confirmed (produced Tier 0 while Aura was paused; re-run 2026-05-10 -- graph confirms Reverse Salient Analysis FEEDS_INTO PWS Value Proposition, and the HSI / algorithmic-reverse-salient workflows FEED_INTO Reverse Salient Analysis -- which is the activation-gap argument in 09; see 00b)
---

# Reverse Salient -- MindrianOS Distribution & Onboarding

## System boundaries

From "a founder decides to try MindrianOS" -> "Larry greets her in a fully configured install." Not the rendering system (-> `03`). Not the methodology surface. Just: getting it onto the machine and working.

## System map

| Subsystem | Function | Current performance | Required | Gap |
|---|---|---|---|---|
| Catalog resolution | `marketplace update` + `plugin update` | Works, but the two-command path is widely forgotten -> users see stale versions | "Just works" / obvious | Small (doc) |
| Plugin fetch (git clone) | Clone the repo onto the machine | **Hard fail on Windows** -- a >260-char dir name in `.planning/phases/92-...trust-layer/` exceeds MAX_PATH; no `core.longpaths` preflight. Gary's CC fixed it manually. | Clone succeeds on Windows out of the box | **LARGE** |
| Dependency install (npm) | `npm install` for `mcp-server-brain/` etc.; the `@mindrian/os` package | `@mindrian/os` was **unpublished -> 404**; mcp-server-brain deps not always installed by `install.sh` | Deps resolve; published package exists | **LARGE** (partly fixed by the lockstep-npm release rule) |
| File registration (cp loop) | `install.sh` copies skills/agents/hooks, writes `settings.json` | **`install.sh` dies under `set -euo pipefail`** when an expected file (`skills/mullins-scaffold/SKILL.md`) is missing -> script exits, registration unfinished, `settings.json` half-written. Gary's CC manually completed it. | Atomic: fully registers or rolls back cleanly with a clear error | **LARGE** |
| Hook activation | SessionStart hook, workspace guard, statusline | Works *if registration completed* -- but Claude Code's third-party-plugin warning reads as a hard "no" to cautious users | Correct-by-design; needs an explainer that meets it head-on | Medium (trust gap, not code) |
| Scope clarity | "Does it run in every Claude project or only Mindrian ones?" | **Answered nowhere** in any onboarding doc. Gary surfaced it. | One plain-words answer in pre-install copy | Medium (comms) |
| First Larry greeting | Larry greets on first fresh session | Works once everything above completes | Reliably the first thing the user sees | Small (downstream) |
| Brain key config | Issue + deliver a 60-day key | Gary's key **leaked into chat history** the moment he pasted it -> revoke + reissue; the `KEY=cXX` QP-corruption bug is a separate landmine | Delivered via a channel that doesn't land in session history; never pasted into chat | Medium (security/UX) |

**Value flow:** `decision -> catalog -> clone -> npm -> cp-loop -> hook activation -> Larry greeting -> (Brain key)`. A chain -- each subsystem gates the next. Cruel detail: two failures (the cp-loop dying half-done, the npm 404) leave the system *looking complete but broken* -- the user doesn't know to keep going.

## The reverse salient

> **The install pipeline is not atomic and does not self-verify.** Every stage -- clone, npm, cp-loop -- can fail partway, leave the system half-configured, and report nothing useful. No preflight, no rollback, no "here's exactly what's missing and how to finish." Gary's *Claude Code* had to manually diagnose and complete the registration -- which means the system is asking the user (or the user's AI) to do the installer's job. The Windows long-path bug, the missing-file bug, the npm 404, the leaked key are four costumes on one constraint.

**Constraint type:** **technical** at the core (`install.sh` = `set -euo pipefail` with no trap, no staged-apply, no post-check; `.planning/` ships to the marketplace clone with a >260-char dir name) + a **trust/comms** layer on top (the third-party warning, the scope question -- those you *design around* with an explainer).

## Attack vector

Already under attack: Phase 95.1 (install-cache recovery + `/mos:doctor`), 95.2 (atomic recovery + SessionStart preflight), 95.3 (Gary's three bugs filed), and now **Phase 95.6 (Windows hardening + skill-loop resilience)** -- CRITICAL, hard deadline 2026-06-01 (NATO Defense College Rome embeds it in June classes), soft 2026-05-11.

- **Intervention:** ship 95.6's Tier 1 subset -- preflight (`core.longpaths`, expected-files check, npm-package-exists check) + staged atomic apply with rollback + post-install `/mos:doctor` auto-run (reports "85 commands / 6 skills / 9 agents / hook / default agent / env var -- all green" or names exactly what's missing and how to fix it) + the comms layer (third-party-warning explainer, scope answer in pre-install copy). **Add to scope:** stop shipping `.planning/` to the marketplace clone (or rename the >260-char Phase 92 dir) -- that's the *root*, not a fifth bug.
- **Solve or design around:** **solve** the technical part; **design around** the trust part.
- **Verification:** a cold Windows tester (Gary) installs with **zero manual intervention from their AI**, and `/mos:doctor` reports all-green on first session.

## Action plan

| Step | Action | Owner | Timeline | Depends on |
|---|---|---|---|---|
| 1 | `/gsd:plan-phase 95.6` -- generate remaining plans (artifacts ready, committed `a7ec823`) | Jonathan | now | -- |
| 2 | Execute Tier 1 (preflight + atomic apply + self-verify + comms + stop shipping `.planning/`) | Jonathan | by 2026-05-11 soft / 2026-06-01 hard | step 1 |
| 3 | Cold-Windows-tester verification (Gary, zero AI hand-holding) | Jonathan + Gary | before ship | step 2 |
| 4 | Ship as v1.13.0-beta.9; brief the NATO cohort path | Jonathan | before June | step 3 |

## Next bottleneck

Once install is atomic, the reverse salient **moves up the chain to first-session orientation** -- the *Prepare* step from `02`. "I'm installed; now what?" -- the empty room with no guidance (Lawrence's P1, since March), the unanswered "does setting a JTBD do anything," the dual-path opener. Phase 114 / 115 / 117 / 104 + v1.14.0's 104-01. Expect to be hunting *that* bottleneck the moment the NATO cohort lands and they're all installed but staring at empty rooms -- which is the activation gap (`09`) wearing yet another costume.
