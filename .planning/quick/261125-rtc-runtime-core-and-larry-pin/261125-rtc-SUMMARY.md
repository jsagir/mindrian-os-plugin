---
phase: quick-261125-rtc
plan: 01
subsystem: install, runtime
tags: [install, skill, marketplace, output-style, agent, goldfish, codex-review]
provides:
  - a partial runtime floor in output-styles/destijl.md for a MindrianOS conversation without the Larry agent
  - the Larry pin in the get-mindrian skill (rooms folder only), with preview, apply and undo
  - a second trust line on the website install chooser (claim C-99), on a local branch
affects:
  - /home/jsagi/mindrian-marketplace (master, pushed)
  - /home/jsagi/dev/mindrian-website (branch quick/261125-install-trust-rooms-setting in worktree /home/jsagi/dev/mw-261125-install-trust, local)
  - Phase 400.1 research inputs (addendum, in an ignored folder of the 399 worktree)
completed: 2026-11-25
---

# Quick 261125-rtc Summary

## Commits

| Repo | Branch | Commit | State | Subject |
|---|---|---|---|---|
| mindrian-marketplace | master | ff0cfaf | pushed, then superseded | feat(get-mindrian): pin Larry as the running agent in the rooms folder |
| mindrian-marketplace | master | a6e71b4 | pushed (owner card O-4) | fix(get-mindrian): Larry pin hotfix after the Codex review |
| MindrianOS-Plugin-release | main | 2086ed966 | local | feat(261125): runtime core in the forced output style |
| MindrianOS-Plugin-release | main | 8f8e9c737 | local | docs(quick-261125-rtc): website handoff |
| MindrianOS-Plugin-release | main | ccd7a09bb | local | fix(261125): scope the runtime core and correct what it claims |
| mindrian-website | quick/261125-install-trust-rooms-setting | bf3e07af | local, not deployed | feat(quick-261125): the install chooser trust line |

## Measured (2026-11-25)

- Claude Code 2.1.332, Windows, `claude -p`: a project pin `mos:grading` in a folder made the session answer as the grading agent while the user file named `mos:larry-extended`. A pin naming `mos:does-not-exist` did not stop the session.
- Claude Code 2.1.329, WSL, `--plugin-dir` on 2086ed966: marker reply `MOS-STYLE-CORE-1 MOS-AGENT-PRESENT` by default, `MOS-STYLE-CORE-1` with `--agent mos:grading`.
- Pin script: 8 cases in a throwaway home on bash; preview, apply and undo in Windows PowerShell 5.1 and CMD.
- `tests/test-261119-g5g-get-mindrian.cjs` 28/28 on a6e71b4. `tests/test-261125-runtime-core-forced-style.cjs` 7/7 (text only).
- Agent names: a throwaway plugin on 2.1.329 accepted `theo-local`, `Theo_Local`, `m:os-Theo_Local` and `/m:os-Theo_Local` with `--agent`. Settings files, mentions, dispatch, Windows and Desktop were not tested.

## Reviews

- Six goldfish on the proposal (sources/proposal-as-reviewed-by-six-goldfish.md): no user-level agent copy; pin in the rooms folder; never rewrite a user-wide agent; the Larry label is not proof.
- One goldfish on the skill bytes of ff0cfaf: PASS, 4 Major fixed before the push.
- Codex deep review (sources/codex-review.md): 3 Blocker, 10 Major, 4 Minor. Fixed in a6e71b4: B1, B2, B3, M2, M10, m2, m3. Fixed in ccd7a09bb: M4, M5, M6.

## Open, by Codex finding

- M1 The plugin root `settings.json` still names the deprecated default agent. Kept for beta.88. Existing users get no pin by updating: a doctor step is owed before the key is removed.
- M3 No clean-machine install of the published skill. zsh not run.
- M7 The rename to `/m:os-Theo_Local` (owner decision O-6): a migration with an alias release. 134 files name `larry-extended`, 60 of them tests.
- M8 The room wiring faults of docs/2026-11-24-HANDOFF-room-wiring-faults-critical.md (main worktree) are diagnosed and not fixed: `lib/mcp/tools/views.cjs` fileArtifact never indexes the note and calls no cascade; `lib/core/navigation/typed-claim.cjs` writes no source edge; `lib/core/navigation/section-gate.cjs:115` reads the section job without the room.
- M9 The Phase 400.1 addendum sits in an ignored folder of the 399 worktree.
- Process: ff0cfaf was pushed without an owner review (rule W3). a6e71b4 was pushed on the owner card.
- A fact for the owner: on main no code sends the job to the remote graph on each turn. The goal job ranks the next move locally (lib/mcp/tools/sensors.cjs), and the method job statement is display only. The Phase 399 advisor is opt-in and on another branch.

## Not changed by this quick

`agents/larry-extended.md`, the plugin root `settings.json`, every hook, the MCP server.

## Release gate note

On main, before and after this quick, these fail: test-359-prose-budget (B5, 3 checks), test-3696-voice-first-budget (V7), lib/memory/body-shape-coverage.test.cjs (5a, 6, 7). This quick did not cause them.
