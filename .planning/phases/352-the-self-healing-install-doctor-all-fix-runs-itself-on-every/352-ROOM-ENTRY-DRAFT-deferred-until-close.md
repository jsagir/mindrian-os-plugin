---
title: The self-healing install - doctor auto-heal after every install and update
date: 2026-09-16
kind: research-trail
informs: MindrianOS-Plugin Phase 352
evidence: MindrianOS-Plugin .planning/debug/doctor-auto-heal-qa-sweep-2026-09-16.md
grounding: claude-code-guide (hooks.md, plugins-reference.md), langtalks-graph-expert (relationship_path, get_entity)
canon_parts: [6, 7, 8, 11, 12]
---

# The self-healing install

## The question

Why does a MindrianOS install still need its owner to type `/mos:doctor --fix` after every update, and what would it take for the installed plugin to heal itself, once, on the first run of a new version, on any user's machine?

## What was measured (2026-09-16, installed beta.37, repo beta.40)

Five hand-run doctor invocations were needed to reach a clean install. Along the way the doctor's own reporting proved untrustworthy for unattended use:

| # | Finding | Site |
|---|---|---|
| F1 | The skill's documented command resolves to `/scripts/doctor.cjs` (env var empty) and its fallback path does not exist on the marketplace-cache topology | `skills/doctor/SKILL.md` Step 2 |
| F2 | `brain-smoke` renders `undefined` under `--all`; passes 7/7 standalone | `scripts/doctor.cjs:3439-3480` |
| F3 | Four `fix ...: undefined` log lines although the fixes landed | `install-state-module.cjs:482`, `deployment-surfaces-module.cjs:386`, renderer `:2291` |
| F4 | Same-run post-fix re-check reports stale findings (3 -> 2 -> 0 on next run) | module loop re-check |
| F5 | graph-derive reads "35 need re-enqueue" before and after re-enqueue (enqueue is not derive) | `graph-derive-health-module.cjs:496` |
| F6 | The Next Move gate offers `--fix` when nothing flagged is fixable | F.1 gate render |
| F7 | `-v` adds no violation detail | render |
| F8 | 155 UI violations = 89 real + 66 scanner noise (comments, Shape-B tree glyphs) | `ui-compliance-module.cjs:92` |
| F9 | `--json` has no summary, exit code or fixable ids | JSON shape |
| F10 | False "beta.37 -> beta.5 downgrade" banner: first `installed_plugins.json` row wins | `sessionstart-post-update-preflight.cjs:185` |
| F11 | First-session banner asks the user to run a doctor command by hand | first-touch copy |
| F12 | Node SQLite ExperimentalWarning printed above every De Stijl header | entry point |
| F13 | Two registry rows point at rooms whose directories are gone | cascade-rooms |
| F14 | mcp-surface budget warning with no fix path; 756 uses of retired command names in 7 days | mcp-surface, deprecated-usage |

## What the grounding said

- Claude Code has no hook for plugin install, update, enable or path swap. `SessionStart` is the earliest code point after an update. Hook stdout never reaches the user; a reward line must ride `additionalContext`. `CLAUDE_PLUGIN_ROOT` carries no guarantee in slash-command bash steps; `installed_plugins.json` scope resolution is undocumented. (claude-code-guide, current docs)
- The langtalks corpus links Measurement decay to Verification loops in four hops, and carries Self-healing through the AI SRE episode (Komodor, ep 65). The transferable learning: an auto-heal is an SRE loop, detect / remediate / verify, and the verify step must re-measure from disk after remediation or the loop decays inside a single run. F4 and F5 are that decay, live.

## The decision (registered as Phase 352)

1. Trigger on `SessionStart`, once per new version, keyed on the accumulative engine's existing watermark (`~/.mindrian/doctor-applied.json`), never on a new touch file.
2. Only modules declared `auto_heal: true` run unattended (idempotent, LOCAL). Destructive or judgment fixes surface as "needs your call" behind an F.1 gate. Enforced by the D-03 parity test.
3. One reward line on the next turn, glyph first, designed through the hooked-model lens: trigger (new version), action (none), reward (it healed and said so), investment (the watermark, so it never asks again).
4. The doctor renders truthfully: no `undefined` ever, every row rendered, every fix record carries a detail, JSON carries a summary.
5. The UI scanner learns comments and Shape B; then the 44 renderers missing Zone 1 / Zone 4 are swept, not waived. Acceptance: `doctor --ui-compliance` at 0.
6. Registered as a harness policy so the release train fails if the policy stops running.
7. Acceptance is a fresh-user number: install, one session start, no command typed, `doctor --all` reports 0 healable drift.

## Why it matters beyond the doctor

A plugin that needs its owner after every update never survives a stranger's machine. The self-healing loop is the difference between "works on the founder's laptop" and "works on install". It is also the first surface a user meets after an update, which makes it a Hooked-model first step, not a maintenance chore.

## Cross-references

- Phase card: MindrianOS-Plugin `.planning/ROADMAP.md` Phase 352
- Evidence: `.planning/debug/doctor-auto-heal-qa-sweep-2026-09-16.md`, `352-EVIDENCE-doctor-all-json-2026-09-16.json`, `352-EVIDENCE-ui-compliance-json-2026-09-16.json`
- Ancestors: Phase 217 (module engine, D-03), Phase 127.2 (post-update preflight), Phase 224-02 (derive re-enqueue)
- Same-day context: beta.41 cut by a peer session while this was being registered; Phase 352 ships in the beta after it
