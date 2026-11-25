---
phase: quick-261125-rtc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /home/jsagi/dev/MindrianOS-Plugin-release/output-styles/destijl.md
  - /home/jsagi/dev/MindrianOS-Plugin-release/tests/test-261125-runtime-core-forced-style.cjs
  - /home/jsagi/dev/MindrianOS-Plugin-release/CHANGELOG.md
  - /home/jsagi/mindrian-marketplace/plugins/get-mindrian/skills/get-mindrian/SKILL.md
  - /home/jsagi/mindrian-marketplace/plugins/get-mindrian/skills/get-mindrian/references/commands.md
  - /home/jsagi/mindrian-marketplace/plugins/get-mindrian/skills/get-mindrian/references/troubleshooting.md
  - /home/jsagi/dev/mw-261125-install-trust (website worktree, branch quick/261125-install-trust-rooms-setting)
autonomous: false
recorded: after the fact, 2026-11-25. The work ran in one owner session without a plan file. This file records the plan it followed.
---

# Quick 261125-rtc: keep MindrianOS operating when the Larry agent does not load, and pin Larry in the rooms folder

## Why

Claude Code 2.1.323 deprecated the default agent of a plugin (`settings.json` `agent`; it still applies and warns). The MindrianOS operating rules lived only in `agents/larry-extended.md`. An agent the person set for all their projects wins over the plugin default, and nothing checked for it.

## Owner decisions in the session (2026-11-25)

- O-1 The install checks, and fixes only an override. After six goldfish reviews this became: never change a user-wide `agent`; pin inside the rooms folder only.
- O-2 The work goes out in the immediate version cut (beta.88).
- O-3 The runtime is local, and the job to be done drives its suggestions.
- O-4 Push the skill hotfix after the Codex review (card answer "Push the hotfix").
- O-5 The remote graph keeps its names for now ("leave the remote brain for the future").
- O-6 OPEN: rename the agent `larry-extended` to `/m:os-Theo_Local`. Not done in this quick.
- O-7 Register this work in GSD before any version cut, then cut once it clears.

## Tasks

1. Measure: a rooms-folder pin naming a plugin agent, and a pin naming a missing agent.
2. Plugin: a runtime core in the forced output style, with a marker and a text test.
3. Marketplace: the Larry pin in the get-mindrian skill (status line, pin script with preview, apply and undo, disclosure, troubleshooting).
4. Reviews: six goldfish on the proposal, one goldfish on the skill bytes, one Codex deep review.
5. Fix what the reviews found; publish the hotfix only on the owner card.
6. Website: the trust line of the install chooser, in a clean worktree, not deployed.
7. Phase 400.1: an addendum beside its research file.
