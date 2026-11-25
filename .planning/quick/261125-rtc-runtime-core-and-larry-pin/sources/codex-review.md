## Blocker

- **B1. The installer can overwrite the user’s chosen agent without an honest preview.** In [`commands.md`](</home/jsagi/mindrian-marketplace/plugins/get-mindrian/skills/get-mindrian/references/commands.md>), the pin script checks `settings.local.json` only when its `agent` differs from Larry. If the local file already says `mos:larry-extended` or `larry-extended`, the script proceeds to write the shared `settings.json`. The status check, however, treats *any* string in `settings.local.json` as the effective value and reports the local file as the source. That means preview can say the shared file will be pinned even though Claude will keep using the local override. **Fix:** always stop when a local `agent` key exists, including Larry values; show the effective source and require an explicit resolution. Also make preview report the actual effective setting.

- **B2. `undo` can erase someone else’s later change.** The record stores only the value that existed before installation, and `undo` restores it if the current shared value is still Larry’s. If the user intentionally changes that key back to Larry after installation, undo cannot distinguish their choice from the installer’s write and deletes or replaces it. It also does not verify that the record’s `file` and `key` match the paths it is about to alter. **Fix:** use a uniquely identified transaction record with a hash of the exact written file state, validate its target path and key, and refuse undo if anything has changed since apply. Preserve the record when undo is refused.

- **B3. The Larry pin is a broad project setting with side effects the disclosure omits.** The skill says Larry answers *every session* started in the rooms folder and describes the write as one setting. In Claude Code, that project-level `agent` setting starts the named agent for sessions rooted there, including work that may have nothing to do with MindrianOS. The procedure also accepts alternate `MINDRIAN_ROOMS_HOME` values, so the scope can be a folder containing unrelated projects. **Fix:** disclose that all Claude Code sessions rooted in that directory use Larry, and constrain or separately confirm the selected directory’s scope. Prefer a dedicated MindrianRooms directory.

## Major

- **M1. This release plan leaves the main runtime agent dependent on a deprecated plugin setting.** The plugin root [`settings.json`](</home/jsagi/dev/MindrianOS-Plugin-release/settings.json>) still says `"agent": "larry-extended"`. The cited changelog says the setting is deprecated but still applies and warns; it does not say that it has stopped working. The marketplace skill now writes a project pin, but only for users who install through that skill and accept it. Existing users do not receive that pin merely by updating the plugin. Leaving the key in beta.88 avoids an immediate removal regression, but does not guarantee Larry starts for every user. **Fix:** keep the key for beta.88, ship the installer pin, and add an update/doctor migration for existing users before removing the key in a later release. Do not describe the deprecation as though the default has already ceased to apply.

- **M2. A changed room path can make the installer pin one folder while Claude uses another.** The pin script derives the room path from `~/.claude/settings.json` or the process environment. The skill says to set `MINDRIAN_ROOMS_HOME` first, but the script does not read the environment value after that shell or agent process ends. The settings script and status check likewise choose sources independently. Users who set the value only for one command or session can get a pin in one directory and a later status check for another. **Fix:** persist the selected rooms path using the documented settings script before running the pin, and have preview, apply, status, and undo display and use the same resolved path. Do not rely on an ephemeral environment variable for a multi-step procedure.

- **M3. Publishing before a clean-install review exposed users to avoidable installer defects.** Commit `ff0cfaf` is on marketplace `master` and the worktree is clean. The script has only a bash code fence, despite claiming to work across shells; I could not establish behavior in native PowerShell or CMD from this checkout. It uses `node -e "..."`, which needs distinct quoting for PowerShell and CMD, and the single quotes inside the JavaScript are shell-significant in bash and zsh. The reported 28/28 test is against a test name, not evidence here of a fresh install through each supported shell. **Fix:** test the actual published skill on clean bash/zsh, PowerShell, and CMD profiles, covering preview/apply/undo, invalid JSON, local overrides, and moved rooms paths before publishing future installer changes.

- **M4. The core blurs “local runtime plus remote suggestions” into rules the code does not guarantee.** The style says room context must be read before venture answers, turns recorded, jobs shown and selected, and Theo matched to the confirmed job. It does not specify a reliable action or failure path for sessions where the relevant MCP tools are unavailable. The agent instructions say to disclose missing room tools on first reply; the style core omits that safeguard. It also describes “Theo gets the job and framework names” broadly, while the code comment at [`sensors.cjs`](</home/jsagi/dev/MindrianOS-Plugin-release/lib/mcp/tools/sensors.cjs:127>) says the method job is display-only and is read after move composition, not used to rank or filter it. **Fix:** make the core say which local runtime operations are required, what to do if unavailable, and limit the Theo/job statement to the specific calls that actually receive those handles. Keep the method-job display claim distinct from ranking behavior.

- **M5. The “runtime core” is not equivalent to the Larry agent.** [`destijl.md`](</home/jsagi/dev/MindrianOS-Plugin-release/output-styles/destijl.md:18>) claims “the agent text wins” when present, but agent instructions do not inherently outrank an output style based on file type alone. More importantly, the core omits agent rules such as tool-failure disclosure, persona selection, approved chain handoff, and the distinction between local-first claim capture and remote calls. The marker proves only that text was returned in response to a prompt, not that tools or hooks work. Its test checks strings in files, not runtime behavior. **Fix:** call it a partial fallback policy, state its limits, and make a runtime check exercise tool availability and room/egress behavior rather than infer readiness from marker tokens.

- **M6. The style is forced even when another agent is selected, with no evidence that the content is safe or compatible there.** The style grows from 4,740 to 7,493 bytes, and `force-for-plugin: true` applies it whenever the plugin is enabled. Its instructions say “you are Larry” and require Larry’s voice, even when the active agent is `mos:grading` or another plugin agent. That may conflict with those agents’ purpose and increases prompt cost in unrelated sessions. The handoff itself recognizes that style reaches sessions with another main agent. **Fix:** remove identity/voice directives from the global forced style or gate the runtime core to explicitly activated MindrianOS/Larry conversations. Measure the behavior and size in a session with another agent.

- **M7. The rename is a migration, not a frontmatter edit.** References include `settings.json`, the team lead in `teams/mindrian.json`, tests/fixtures, identity checks, evals, docs, commands that dispatch agents, and the published `mos:larry-extended` pin. A root-level grep already shows these categories. Renaming to `/m:os-Theo_Local` also introduces `/`, `:` and uppercase into paths/mentions and host surfaces. The throwaway agent experiment only supports the narrow claim that Claude Code 2.1.329 accepted the tested name and `--agent` form; it does not validate settings, `@agent-` mentions, Agent tool dispatch, Windows, Desktop, or Cowork. **Fix:** retain the old name as a compatibility alias for at least one release; update internal dispatch and tests first; publish installer support for both names; then change the canonical pin only after host compatibility testing. Treat `/m:os-Theo_Remote` as a display/name concept until a separate MCP/tool migration is designed. Do not rename MCP server `mindrian-brain` or tools `brain_ask`/`brain_query` by inference from “remote graph.”

- **M8. The original wiring bugs remain unfixed, so intents 2 and 4 are not complete.** The review brief identifies claims written without edges and `artifact_file` not indexing notes. The current code comments corroborate the claim-node write’s node-only behavior at [`typed-claim.cjs`](</home/jsagi/dev/MindrianOS-Plugin-release/lib/core/navigation/typed-claim.cjs:124>) and the artifact-file flow needs tracing beyond the style change. The new commits do not touch either wiring path. The plugin commits are local and ahead of origin; no release is shown. **Fix:** resolve and implement the reported wiring faults, verify their boundaries, then include them explicitly in the beta.88 release review. A changelog entry alone is not a release.

- **M9. The Phase 400.1 addendum is untracked and lives only in the other worktree.** `git ls-files` reports the file is not tracked in the 399 worktree. The addendum says phases 399 and 400 are closed and need no redo, while also leaving open whether the runtime core should reflect Phase 400’s domain/move types. It does not revise the phase artifacts themselves. **Fix:** decide the open alignment question and put the accepted addendum in the intended tracked phase branch; do not treat it as completed planning work yet.

- **M10. The consent is incomplete and the “undo” promise is overstated.** The skill asks before applying the setting, but does not say that sessions rooted in the rooms folder will start as Larry even for unrelated work. The “one command takes it out again” claim is not reliable after user edits, because undo only checks the current agent string. **Fix:** correct both disclosures and the undo guard before further distribution.

## Minor

- **m1. Shell-history and portability claims are unsubstantiated.** Bash/zsh history expansion, quoting, Windows PowerShell, and CMD were not reproduced in clean shells here. The code block is marked `bash` and passes the mode as an unquoted trailing argument. Don’t claim universal shell support without end-to-end execution.

- **m2. Backup behavior is asymmetric.** Apply backs up only an existing `settings.json`; undo does not back up the state it is about to restore. If undo writes malformed or unexpected data, recovery is harder. Add a pre-undo backup after validating the transaction.

- **m3. Status output can claim Larry is pinned when an unrecognized local override shape is present.** It parses invalid or missing JSON as `{}` and only treats a string-valued local `agent` as an override. Invalid `settings.local.json` is silently ignored; this can falsely report that the shared setting is effective.

- **m4. The version-cut evidence is only a local changelog edit.** `2086ed966` and `8f8e9c737` are local commits; the branch is ahead by three commits, not pushed. There is no beta.88 tag/release in the evidence. The phrase “reaches users with the beta.88 cut” in the addendum is a plan, not proof.

## Verified

- Marketplace `ff0cfaf` is present on `master` and the local checkout is clean.
- Plugin `main` is three commits ahead of `origin/main`; commits `2086ed966` and `8f8e9c737` exist locally. The plugin worktree also contains two unrelated untracked debug notes.
- `2086ed966` changes the forced output style, adds a string-assertion test, and edits the unreleased beta.88 changelog. It does not change `agents/larry-extended.md` or root `settings.json`.
- The style is 7,493 bytes locally versus 4,740 bytes at the parent commit.
- The phase addendum exists in the 399 worktree but is untracked.
- The marketplace status check treats any string `agent` in `settings.local.json` as effective. The pin script permits a local override when it already names Larry, then writes shared settings.
- `undo` checks only the shared `agent` string before restoring the recorded prior value. It does not validate the record’s target path or a file-state hash.
- The project-level pin can make Larry the agent for all sessions rooted in that directory. Its scope disclosure does not say this plainly.
- The reported original wiring fixes are absent from the two plugin commits under review.

## Could not verify

- Native PowerShell/CMD execution, zsh history behavior, or a clean-machine install. No disposable cross-platform host was available here.
- The Windows measurements of agent precedence, missing-agent startup, and the exact Claude Code versions.
- Whether the forced style runtime marker behaves as reported on 2.1.329, whether it changes another agent’s behavior, or how Desktop/Cowork handle the style and project setting.
- The `test-261119-g5g-get-mindrian.cjs` 28/28 result, the seven pre-existing failures, and the agent-name experiment. I did not run tests, consistent with the review-only instruction.
- Full semantics of Claude Code’s `agent` setting beyond the documented and reported behavior.
- Whether the remote Brain requests actually contain only generic JTBD/framework handles for every `brain_ask`/`brain_query` call. The core’s text does not establish that guarantee.

## The agent was wrong about

- The changelog citation does not support “the plugin default no longer applies.” It says the setting is deprecated but continues to apply and warns.
- “Inside the rooms folder the pin wins over both” is overbroad without verifying `settings.local.json` precedence and host/session behavior. The script itself detects a conflicting local agent, but fails to stop when that override already says Larry; the status check reports the local file as the source.
- “Nothing outside the rooms folder changes” omits that the setting affects every session rooted there, regardless of task, and the script reads the user settings file to resolve the room path.
- “A pin that outlives the plugin does no harm” is too broad. A missing agent may fall back without preventing startup, but it can still change which agent is used and removes the promised Larry runtime; the reported probe does not establish harmlessness.
- The addendum’s “one sentence” summary that Theo matches method to the goal job is stronger than the code supports for ranking. `methodJobFor()` is documented as display-only and read after move composition.
- The marker test does not prove forced-style loading or runtime readiness. It asserts frontmatter and token strings only.

## Recommended order of next actions

1. **Owner:** review the already-published marketplace change and decide whether to hotfix or revert it. Before further distribution, fix override handling, preview/source reporting, undo integrity, and the scope disclosure.
2. Reproduce the corrected pin on clean bash/zsh and Windows shells, with invalid JSON, local overrides, and a moved `MINDRIAN_ROOMS_HOME`; keep all test HOME data disposable.
3. **Owner:** decide whether a forced style should identify Larry in sessions whose main agent is something else. If yes, define activation and compatibility rules.
4. Fix the reported typed-claim edge and `artifact_file` indexing faults; verify them against the Windows handoff report.
5. Keep the deprecated plugin `agent` setting during beta.88, then ship and verify an existing-user migration before removing it.
6. **Owner:** decide the `/m:os-Theo_Local` and `/m:os-Theo_Remote` naming scheme. Test all host and dispatch surfaces before changing the published pin; retain an alias period.
7. Update the phase 399/400/400.1 planning artifacts with the runtime core’s actual scope, style cost, and release dependency; track the accepted addendum.
8. **Owner:** review commits before any push or release. Current evidence shows no plugin push, beta.88 tag, or release.

