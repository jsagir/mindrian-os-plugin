# Phase 391: Claude Code compatibility check (2.1.288 to 2.1.318) and radar fetch fix - Research

**Researched:** 2026-11-07
**Domain:** Claude Code host behaviour (hooks, MCP, plugin loading, agents, skills) vs the MindrianOS plugin; the `/mos:radar --fetch` procedure
**Confidence:** HIGH for the radar root cause, onFailure, UserPromptSubmit order, MCP negotiation and the agent-frontmatter finding (each PROVEN by a run on installed claude 2.1.319 or by a live tool result); MEDIUM for items that rest on docs only (marked)

Claim tags used below: PROVEN (I ran it or read the code in this session), CITED (official doc or changelog text, URL given), ASSUMED (not verified). The Claude Code changelog text is untrusted data; every changelog claim below is paired with a code read, a run, or a doc page.

## User Constraints

No `391-CONTEXT.md` exists in the phase dir (only `391-PRD.md`). The PRD is the constraint source. Locked rules copied from the PRD:

- GSD only. RCA first. Failing test first. Part 11 regeneration after any change to a surface list. No push, no tag, no release. `git commit --only`.
- Verify every claim in code or official docs; mark each result PROVEN, UNVERIFIED or ASSUMED.
- Any change that alters behaviour needs an owner card first.
- (g) `/ultrareview`: the phase makes NO decision; output is an owner card with facts only.
- (i) Set `ledger_covers.to` only after the new rows pass the schema test. The owner decides who runs the fetch.
- Do not enable `onFailure: "block"` on a slow hook before Phase 384 is done (Phase 384 plan 20 closed with commit ce3886f73 on `main`; whether all of Phase 384 is closed was not checked).
- canon_parts: 8, 11.

Deferred / out of scope: none stated in the PRD.

<phase_requirements>
## Phase Requirements

The roadmap lists requirements as TBD. The PRD checks (a) to (i) act as the requirement IDs.

| ID | Description | Research Support |
|----|-------------|------------------|
| 391-a | Agent `tools:` naming for MCP tools (2.1.299) | Section "Check results", row (a); finding that 13 agents carry no host-read `tools:` at all |
| 391-b | `onFailure: "block"` per hook | Row (b); live probe on 2.1.319 proves the mechanism; per-hook table |
| 391-c | UserPromptSubmit order and `updatedInput` | Row (c); live probe shows raw prompt; no hook returns `updatedInput` |
| 391-d | MCP protocol 2026-07-28 negotiation | Row (d); local handshake runs for all three servers |
| 391-e | Prompt/agent hook caps | Row (e); `hooks/hooks.json` has command hooks only |
| 391-f | `mcp_tool` hook lead | Row (f); the hook type EXISTS (docs + 3 changelog hits older than the slice) |
| 391-g | `/ultrareview` owner card | Row (g); facts only |
| 391-h | Radar fetch bug | Section "Radar fetch bug: root cause" |
| 391-i | Ledger rows | Row (i); schema constraint on `ledger_covers.to` found |
</phase_requirements>

## Summary

Of the 27 changelog entries newer than the ledger, nothing found so far breaks the plugin outright. Three results need a decision. First, 13 of 17 agents list tools only under `allowed-tools:`, which the host does not read; the host warns "does not recognize or apply" for it (PROVEN on 2.1.319). Those 13 agents inherit every tool, so the "structurally cannot write" claims in their file comments do not hold. Second, `onFailure: "block"` already ships on the Part 8 egress guard and works end to end (PROVEN by 7 probe runs on 2.1.319); the web credential hook has no `onFailure`, and a test pins that absence (WH5). Third, the ledger schema test forces `ledger_covers.to` to equal the highest row version, so "add rows, then set `to` to 2.1.318" needs a row at 2.1.318.

The radar bug is real and has four stacked causes, not one. `commands/radar.md` asks WebFetch for "the 10 most recent entries"; WebFetch reads only characters 0 to 100000 of a 1,175,667 character file (8.5 percent); the procedure never checks which version it reached; and the command has no Bash grant, so it cannot download and parse locally. The cause that makes the skip silent is that nothing compares the oldest version obtained with `ledger_covers.to` before the mark is advanced.

The MCP protocol default is safe: the Brain shim and the MindrianOS server both negotiate 2026-07-28 in local runs, and the Eureka engine does too. The Eureka engine is never reached by the Claude Code host, only by a MindrianOS Node client, so the host default does not touch it.

**Primary recommendation:** Fix radar with a small deterministic changelog slicer (`lib/core/radar/changelog-slice.cjs` plus a thin script) that returns a coverage object; make `commands/radar.md` refuse to advance `ledger_covers.to` unless `coverage.complete` is true; keep a WebFetch paging fallback (offset steps of 100000) for surfaces without Bash. Take 4 owner cards: agent `tools:` enforcement, `onFailure` on the web credential hook, Bash grant for radar, `/ultrareview`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Changelog download + header parse + coverage report | Plugin shared core (`lib/core`, Node) | Script wrapper in `scripts/` | Deterministic, testable, no model in the loop; same shape as other `lib/core` helpers |
| Screening which entries touch shipped surfaces, writing ledger rows | Command prose (`commands/radar.md`, Larry) | Doctor organ reads the result | Human triage promotes rows; the injection fence stays in the command |
| Ledger freshness check | Doctor module (`lib/core/doctor/capability-ledger-module.cjs`) | `tests/test-265-ledger-freshness.cjs` | Reader only; never fetches |
| Hook fail posture (`onFailure`) | `hooks/hooks.json` (host-enforced) | Script exit codes | The host acts on `onFailure`; scripts decide exit 2 |
| Agent tool restriction | Agent frontmatter `tools:` (host-enforced) | `allowed-tools:` mirror (repo convention only) | Host reads `tools`, not `allowed-tools` |
| MCP protocol negotiation | `@modelcontextprotocol/server` v2 in the two plugin servers | Host client | Server SDK handles both eras with no per-era branching |

## Reuse Inventory (Canon Part 7: existing surfaces first)

Enumerated from disk in this session.

| Existing surface | Path | Use in this phase |
|---|---|---|
| Radar command (the only radar surface) | `commands/radar.md` | Edit in place. No new command. |
| Radar skill mirror | `skills/radar/SKILL.md` (body identical to the command; PROVEN by `diff`) | Regenerate with `node scripts/build-skill-mirrors.cjs`; `--check` passes today (112 mirrors) |
| Dist bundles of the mirror | `dist/generic-claude-dir/.claude/skills/radar/SKILL.md`, `dist/zed/.agents/skills/radar/SKILL.md` | Regenerate with `scripts/build-dist-bundles.cjs` |
| Ledger (source of record) | `data/capability-ledger.json` (57 entries, `ledger_covers.to = 2.1.287`) | Add rows, then move `to` |
| Ledger freshness organ | `lib/core/doctor/capability-ledger-module.cjs` | Reader only. Returns `ok` today with a 32-patch gap (see Pitfall 5). No change required. |
| Schema tripwire | `tests/test-265-capability-ledger-schema.cjs` | Gate for (i) |
| Radar prose tripwire | `tests/test-265-radar-writes-ledger.cjs` (6 arms; arm 6 pins `allowed-tools` to exactly Read, Write, WebFetch, Glob, AskUserQuestion) | Must stay green or be changed under an owner card |
| Freshness tripwire | `tests/test-265-ledger-freshness.cjs` | Unchanged |
| Rendered views | `references/capability-radar/capabilities-index.md`, `changelog-cache.md` | Regenerated by the command from the ledger |
| Decision record | `docs/RADAR-ABSORPTION-265.md` | Cross-link; fork-subagent decision (section 1) already settled |
| Public-source fetcher precedents | `scripts/query-semantic-scholar.cjs`, `lib/core/rs-fetcher-industry.cjs`, `lib/core/rs-fetcher-patents.cjs` | Pattern for a non-Brain public GET |
| Existing MCP wire tests | `tests/test-267-mcpv2-brain-shim.cjs`, `tests/test-267-mcpv2-dual-era.cjs` | Reuse for (d); no new handshake test needed for the two plugin servers |
| Existing hook tests | `tests/test-261029-qef-hook-timeouts.cjs` (A5 pins `onFailure` on the egress guard only), `tests/test-386-web-credential-hook.cjs` (WH5 pins `noOnFailure`) | Touch only under an owner card |
| Agent contract test | `tests/test-361-agent-contract.cjs` | Template for the `tools:` parser test |
| Changelog parser | NONE found on disk (searched `scripts/`, `lib/`, `commands/`, `agents/`, `skills/`) | Net-new, justified: no surface parses a changelog |

Net-new surface proposed: one `lib/core` module, one thin script, two test files. No new command, agent, skill or pipeline, so no Part 11 born-wired declaration is added. The script is not an invocable surface.

## Standard Stack

No external packages. Node built-ins only (Node v22.23.1 is installed; repo floor is >=22.18.0 per CLAUDE.md). Plain Node test scripts in the style of `tests/test-265-*.cjs`, run through `tests/run-all-<N>.sh` globs (template: `tests/run-all-387.sh`, `tests/run-all-265.sh` with its found-eq-0 guard).

### Package Legitimacy Audit

No external package is recommended. slopcheck was not needed. `Packages removed due to slopcheck [SLOP] verdict: none`. `Packages flagged [SUS]: none`.

### Installation

None.

## Check results (a) to (i)

### (a) Agent `tools:` naming for MCP tools (2.1.299)

CITED rule (https://code.claude.com/docs/en/sub-agents): `tools: mcp__github__*` grants a whole server; a server name that contains a double underscore needs the full name plus `__*`, for example `mcp__reports__v2__*`; without `__*`, `mcp__reports__v2` matches none of that server's tools. The page lists no `allowed-tools` subagent field; unknown fields are ignored.

PROVEN scan of `agents/*.md` (17 files), `skills/*/SKILL.md` (126), `commands/**/*.md` (113):

- Only 2 agents carry a host-read `tools:` list: `agents/dominant-design-researcher.md:12` and `agents/research-lane-analyst.md:11`. Their MCP tokens are exact tool names (`mcp__tavily__tavily-search`, `mcp__tavily-mcp__tavily-search`). Server names `tavily` and `tavily-mcp` contain no `__`. Not affected by 2.1.299.
- The two shipped plugin servers are `mindrian-os` and `mindrian-brain` (`.mcp.json`). Neither name contains `__`. The plugin-scoped name pattern is `mcp__plugin_<plugin>_<server>__<tool>` (CITED: https://code.claude.com/docs/en/mcp); the plugin `name` is `mos` (`.claude-plugin/plugin.json`).
- 79 `mcp__` tokens appear in `tools:` and `allowed-tools:` lines across all three surface classes. Exactly 1 token is a glob that is not of the form `mcp__<server>__*`: `skills/intelligence-orchestrator/SKILL.md:20`, `allowed-tools: ... mcp__brain_*`. It matches no real server today. UNVERIFIED how the host parses it. Changing it to a working form would GRANT Brain tools to that skill, so it is a behaviour change and a Part 8 question (owner card).
- No line breaks the 2.1.299 rule as written. The "table of lines that break" is therefore: 0 lines under the 2.1.299 rule; 1 line with a non-conforming glob (`mcp__brain_*`).

Bigger finding, PROVEN by running claude 2.1.319 with `--plugin-dir` on a scratch copy of all 17 agent files and reading `--debug-file`: the host logs `has a frontmatter key Claude Code does not recognize or apply: "allowed-tools" (did you mean "tools"?)` for 15 agent files. Of those 15, 13 have no `tools:` at all, so they inherit every tool. Which 13: analogy-query-fetcher, brain-query, chain-step-reviewer, competitor-watch-fetcher, framework-runner, grading, grant-reviewer, investor, meeting-perspective-extractor, opportunity-scanner, persona-analyst, research, vault-section-reviewer. The same log also shows: `mcpServers` ignored for plugin agents (`agents/larry-extended.md:12`, `agents/reverse-salient-agent.md:11`), `initialPrompt` ignored (`agents/larry-extended.md:14`), and unknown keys `persona_variants`, `extends`, `activation_gate`, `hitl_shape`, `hitl_why`. Phase 361 research already named the rule ("the host only enforces `tools:` for subagents", 361-RESEARCH Pitfall 1) and applied it to 2 agents. The comments in `chain-step-reviewer.md` and `meeting-perspective-extractor.md` ("Read ONLY", "structurally cannot") are not true at the host level.

If a `tools:` list is added, the MCP names must use the plugin-scoped form (`mcp__plugin_mos_mindrian-brain__brain_ask`) or `mcp__plugin_mos_mindrian-brain__*`, not the project-scope names now written in the `allowed-tools:` mirrors; otherwise the agent loses its Brain tools. ASSUMED (derived from the CITED naming rule and the plugin name; not probed with a live plugin-scoped call).

Failing test first (PRD): `tests/test-391-agent-tools-naming.cjs`. Parse every `tools:` and `allowed-tools:` line (YAML list or space-separated string). Reject: a bare `mcp__<server>` entry in a `tools:` list; any entry whose server segment (from `.mcp.json` names plus `plugin_mos_<server>`) contains `__` and lacks the `__*` form; any glob that is not `mcp__<server>__*`. Tier B (report, not fail, until an owner card lands): an agent with `allowed-tools:` and no `tools:`. The test is RED today only on `mcp__brain_*`.

### (b) `onFailure: "block"` for hooks (2.1.295; SDK callbacks 2.1.317)

CITED (https://code.claude.com/docs/en/hooks): `onFailure` takes `"continue"` or `"block"` (needs 2.1.295). With `"block"`, a command hook that cannot start, times out, or exits with a code other than 0 or 2 blocks the action. Unset, those are non-blocking and the action goes ahead. Exit 2 blocks on blocking events regardless. Not affected: Stop, SubagentStop, TaskCompleted, TeammateIdle, and hooks with `async` or `asyncRewake`.

PROVEN on installed claude 2.1.319 (`claude -p`, model haiku, scratch project dir, PreToolUse `Bash` hook, `timeout: 2`, 1 run per arm, command writes a marker file):

| Arm | Hook behaviour | onFailure | Command ran? |
|---|---|---|---|
| A | exits 1 | unset | yes |
| B | exits 1 | block | NO |
| C | sleeps 6 s (timeout 2) | unset | yes |
| D | sleeps 6 s (timeout 2) | block | NO |
| E | script path does not exist | unset | yes |
| F | script path does not exist | block | NO |
| G | `true` (control) | unset | yes |

This closes the "end-to-end honouring is UNVERIFIED" line in `386-29-SUMMARY.md`. Caveat: n=1 per arm.

PROVEN per-hook table from `hooks/hooks.json` (41 hooks, all `type: command`; SessionStart 9, PostToolUse 9, UserPromptSubmit 7, Stop 5, PreToolUse 4, PreCompact 1, PostCompact 1, SessionEnd 1, FileChanged 1, CwdChanged 1, SubagentStop 1, TaskCompleted 1):

| Hook | Event | Blocks today? | Script fail posture (read in code) | onFailure now | Proposal (decision is the owner's) |
|---|---|---|---|---|---|
| `part8-egress-guard-hook.cjs` | PreToolUse (Brain tools) | exit 2 | fail-closed after input read (plan 386-30) | `block` (hooks.json:214) | Keep. Already shipped; pinned by `test-261029-qef-hook-timeouts.cjs` A5 |
| `web-credential-guard-hook.cjs` | PreToolUse (WebSearch, WebFetch, Tavily) | exit 2 | fail-closed after input read (plan 386-29 option a) | none, pinned by `test-386-web-credential-hook.cjs` WH5 | Fail closed: add `onFailure: "block"`. Closes timeout and cannot-start, which the script cannot cover. Needs owner card and edits to WH5 and A5. Risk: a slow 5 s hook then blocks a web call. |
| `write-scope-check` (via `run-hook.cmd`) | PreToolUse (Write/Edit) | exit 2 | fail-open by design (`write-scope-check.cjs` header) | none | Keep fail open (a false block is worse). |
| `card-before-answer-hook.cjs` | PreToolUse (`gate_answer`) | JSON deny at exit 0 | fail-open (script header) | none | Keep fail open. |
| `admin-command-gate.cjs` | UserPromptSubmit | exit 2 | fail-open by design (script header) | none | Keep fail open; prose backstop in the command body. |
| 6 other UserPromptSubmit hooks, PostToolUse, SessionStart, PreCompact, PostCompact | various | no | observers | none | Keep. Observers must never block. |
| 5 Stop hooks, SubagentStop, TaskCompleted | Stop family | no | n/a | none | `onFailure` has no effect on these events (CITED). |

Risk to record: a guard hook that times out would block the call. Both guard hooks have `timeout: 5` and measured cold start is the 384 subject; read `384-20-SUMMARY.md` before deciding.

### (c) UserPromptSubmit order and `updatedInput` (2.1.299, 2.1.300)

PROVEN on 2.1.319: a project `UserPromptSubmit` hook that dumps stdin received `prompt: "/probe hello"` for a slash command whose file body contained a marker; the marker did not appear in the payload. So hooks see the raw typed line, not the expanded body. CITED (hooks doc): "the hook receives that line as you typed it rather than the expanded skill content"; a block also stops `!` shell commands the skill would inject. Rewriting the prompt is not offered for this event: the doc says UserPromptSubmit "can't replace the prompt; it only injects `additionalContext`". `updatedInput` exists for PreToolUse and PermissionRequest only (CITED); the "unknown keys dropped" rule (2.1.300) is changelog-only (the doc excerpt read did not state validation rules; UNVERIFIED in docs).

PROVEN by grep of `scripts/`, `hooks/`, `lib/`, `tests/`, `bin/`: the string `updatedInput` appears only in a comment in `scripts/fork359-permission-probe.cjs:25`. No plugin hook returns `updatedInput`. The seven UserPromptSubmit hooks return `additionalContext`, exit codes, or nothing.

Code read: `scripts/admin-command-gate.cjs:14-19` already assumes the raw prompt ("fires on the raw prompt text before the body is expanded"); `detectInvokedCommand` matches a LEADING `/name`. It is correct under the new order. `intent-classifier.cjs`, `mva-detect.cjs`, `first-install-router.cjs`, `jtbd-update.cjs` classify `payload.prompt`. If any of them ever depended on the expanded body of a slash command, behaviour changed at 2.1.299. No code or comment in them says so; UNVERIFIED whether older sessions saw the expanded body. The skill-frontmatter UserPromptSubmit change does not apply: 0 skills, commands or agents declare frontmatter `hooks:` (PROVEN scan).

Also CITED: UserPromptSubmit default timeout is 30 s for command hooks; all 7 plugin hooks set an explicit timeout of 3 or 5 s (PROVEN in hooks.json).

### (d) MCP protocol 2026-07-28 default

CITED (https://code.claude.com/docs/en/mcp): Claude Code asks HTTP, stdio and claude.ai connector servers whether they support the 2026-07-28 revision; `MCP_PROTOCOL_NEGOTIATION=legacy` keeps every server on the earlier handshake; `MCP_SDK_GENERATION=v1|v2` picks the runtime. Changelog: stdio default at 2.1.292.

PROVEN local handshakes (v2 `Client`, `versionNegotiation: { mode: 'auto' }`):

- `mindrian-brain` shim: `node tests/test-267-mcpv2-brain-shim.cjs` gives PASS=6 FAIL=0; the 2026 arm negotiates 2026-07-28, the 2025 arm 2025-11-25, both list the same 6 tools.
- `mindrian-os` server: `node tests/test-267-mcpv2-dual-era.cjs` gives PASS=3 FAIL=2. Both eras negotiate correctly (the elicitation arms print `negotiated 2025-11-25` and `negotiated 2026-07-28`). The 2 failures are the surface-snapshot comparison: the server now lists `eureka_*` tools (Phase 387) that the snapshot lacks. This is a stale test snapshot, not a protocol fault. Pre-existing; name it in the plan so it is not blamed on 391. Fix is an "accepted delta" update to the snapshot (a test edit).
- Eureka engine (`/home/jsagi/dev/mindrian-eureka`, Python `mcp` 2.3.0 in its `.venv`): a throwaway Node probe using the repo's v2 client against `.venv/bin/eureka-mcp` gave `legacy era=legacy version=2025-11-25 tools=27` and `auto era=modern version=2026-07-28 tools=27`.
- Architecture fact: the Eureka server is NOT registered in `.mcp.json` or in `~/.claude.json` (checked server names). Only MindrianOS code connects to it, through `lib/mcp/tools/eureka-capability-run.cjs` and `eureka-capability-jobs.cjs` with a default-options client (no `versionNegotiation`), so that path stays on 2025-11-25 whatever the host default is. The host default cannot affect it.

SDK versions: `npm-shrinkwrap.json` pins `@modelcontextprotocol/server`, `client`, `core`, `node` at 2.1.0. CLAUDE.md still says `@modelcontextprotocol/sdk ^1.29.0`; that text is stale (docs drift, not a code fault).

### (e) Prompt and agent hook caps (2.1.302, 2.1.312)

PROVEN: `hooks/hooks.json` has 41 hooks, all `type: command`. 0 `prompt`, 0 `agent`, 0 `http`, 0 `mcp_tool`. The cap (12 concurrent per event; 24 per session) applies to prompt and agent hooks (CITED, hooks doc: "12 of those run at once"). Result: NOT AFFECTED. The mod file `hooks/mos-face.json` is a mod module, not a settings hook; see Additional findings.

### (f) The `mcp_tool` hook lead (`384-LEADS.md`)

The lead is CORRECT; the "0 hits in the slice" reading was a slice artefact. PROVEN in the full changelog (fetched with curl, 1,176,779 bytes): `mcp_tool` appears 3 times, in 2.1.118 ("Hooks can now invoke MCP tools directly via `type: "mcp_tool"`"), 2.1.281 and 2.1.284, all older than the 2.1.288 slice. CITED (https://code.claude.com/docs/en/hooks): handler types are command, http, mcp_tool, prompt, agent; `mcp_tool` "call a tool on a configured MCP server". The plugin ledger already holds a row for it (`data/capability-ledger.json` line 264, 2.1.118). Record in the phase summary: lead confirmed, do not drop it. Adoption stays out of scope: it would change the Part 8 guard path (the ledger row already says it "deserves its own plan"). A plugin-bundled server is addressed as `plugin:<plugin>:<server>` in the hook's `server` field (CITED, mcp doc).

### (g) `/ultrareview` owner card (facts only; no decision)

- It is a built-in command; the doc names `/code-review ultra` with `/ultrareview` as an alias. It runs as a cloud session on Anthropic infrastructure (CITED, https://code.claude.com/docs/en/ultrareview).
- A branch review "bundles the repository state and uploads it to a cloud sandbox", including uncommitted and staged changes; PR mode uploads nothing from the machine (CITED).
- It is not available on Bedrock, Vertex, Foundry, with Zero Data Retention, HIPAA configuration, or CMEK; in those cases a local review runs (CITED).
- It needs a claude.ai login; 3 free runs per account, then usage credits, "typically $5 to $25" per review (CITED).
- Changelog trail (untrusted text, listed so the owner can check): 2.1.290 fixes about uncommitted-change handling; 2.1.292 and 2.1.295 fix files under `~/.claude/seed-admin`; 2.1.299 stops suggesting `git add .` (could stage `.env`); 2.1.309 adds the workspace-trust requirement for `claude ultrareview`; 2.1.314 checks trust before git and refuses an untrusted folder at once when `CI` is set.
- Repo facts: the plugin ships no ultrareview wiring. Mentions exist only in `references/capability-radar/capabilities-index.md` and `lib/memory/render-v2-disposition.test.cjs` (PROVEN grep).
- Not found on the doc page: a managed setting or env switch that turns the command off. UNVERIFIED. `CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK=1` turns off only the trust check (changelog 2.1.309).
- Part 8 question for the owner: room files are LOCAL data; a branch review uploads the working tree of whatever repo it runs in, including a Data Room folder if the room is a git repo.

### (h) Radar command bug: see the next section.

### (i) Ledger rows

PROVEN by reading `tests/test-265-capability-ledger-schema.cjs`: row keys are the 8 required keys plus optional `decision_ref`; `status` is one of dormant, adopting, shipped, superseded, no-op; `domain` is one of models, code, desktop_cowork, plugins_mcp, visualization; and `ledger_covers.to` must EQUAL the highest dotted-triple version among rows (the failure message is "ledger_covers.to ... does not equal the highest dotted-triple version among entries"). Current highest row version is 2.1.287 (PROVEN by script). So:

1. Adding the 5 rows (versions 2.1.292 to 2.1.317) while `to` is 2.1.287 FAILS the schema test. The PRD order "rows first, then `to`" cannot be followed row by row; add rows and `to` in one change, then run the test.
2. For `to = 2.1.318` the highest row version must be 2.1.318. The highest version among the 5 rows would be 2.1.310 (monitors, as tabled) or 2.1.317 if the monitors row cites the exit-prompt change. Recommended: add one extra `no-op` row at 2.1.318 (the subagent progress-summary wait change, low relevance) so `to = 2.1.318` passes without editing the test. The alternative is `to = 2.1.317`, which leaves 2.1.318 formally unscreened. Planner picks; recommend the extra row.
3. `date` may be `null` (41 existing rows use null). The changelog slice has no dates. Release pages exist (`https://github.com/anthropics/claude-code/releases/tag/v2.1.299` returned HTTP 200).
4. The command prose caps `leverage` and `evidence` at "roughly 240 characters" but some existing rows exceed that (longest `leverage` is 1537, `evidence` 1089 characters; PROVEN by script). Keep new rows near 240.

Proposed rows (all `status: dormant` per PRD; `installed_claude_version` becomes 2.1.319):

| capability | version | domain | destination | note for `leverage` |
|---|---|---|---|---|
| hook-onfailure-block | 2.1.295 | code | hooks/hooks.json | Already on the Part 8 egress guard; candidate for the web credential hook; SDK callbacks at 2.1.317 |
| agent-tools-mcp-server-naming | 2.1.299 | plugins_mcp | agents/ | `tools:` takes whole-server names; 13 agents have no host-read `tools:` |
| mcp-protocol-2026-07-28-default | 2.1.292 | plugins_mcp | none | Proven clean on both plugin servers; opt-out `MCP_PROTOCOL_NEGOTIATION=legacy`. Honest status may be `no-op`; PRD says dormant, owner may override |
| userpromptsubmit-before-expansion | 2.1.299 | code | hooks/hooks.json | Hooks see the raw line; `updatedInput` validated for tool hooks only |
| plugin-monitors | 2.1.310 | code | none | `monitors/monitors.json` (or `experimental.monitors`) background processes; replaces poll-style hooks as a candidate only; not started with `-p` |
| (extra) subagent-progress-summary-cold-cache | 2.1.318 | code | none | `no-op`, only so `to = 2.1.318` passes the schema rule |

CITED for monitors: https://code.claude.com/docs/en/plugins-reference (monitors live under `experimental.monitors`, default file `monitors/monitors.json`, `when` is `always` or `on-skill-invoke:<skill>`; "Monitors don't start with the `-p` flag").

Failing test first: `tests/test-391-ledger-rows.cjs` asserts the 5 capability names exist, `ledger_covers.to === '2.1.318'` and `installed_claude_version === '2.1.319'`; RED until the change lands; then `node tests/test-265-capability-ledger-schema.cjs` must pass.

## Radar fetch bug: root cause (stated before any patch idea)

**Trace.** `commands/radar.md` Step 3, item 1 calls WebFetch on `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` with the prompt "Extract the 10 most recent changelog entries ... Focus on features related to: plugins, MCP, hooks, statusline, context window, models, agents." Step 3 item 2 says to treat `ledger_covers.to` as the low-water mark. Step 3b item 4 says to "Update `ledger_covers.to`" with no rule for what value. The `allowed-tools` set is Read, Write, WebFetch, Glob, AskUserQuestion (no Bash).

**Measurements (PROVEN).**

- The file today is 1,175,667 characters (1,176,779 bytes), 10,126 lines, 437 version headers, all of the form `## x.y.z`, strictly descending, no code fences, no `## ` inside a fence.
- A live WebFetch of that URL in this session returned: `this page's text is 1175667 characters long and the answer above covers only characters 0 to 100000; the final 1075667 were not read - to read on, call WebFetch again with the same url and offset: 100000.` The headers it saw: 2.1.319 down to 2.1.309, and 2.1.309 was cut mid-entry. The tool therefore reads 100000 characters per call, which is 8.5 percent of the file, and it prints the offset to continue.
- Header offsets (characters): 2.1.319 at 13; 2.1.318 at 21741; 2.1.309 at 94876; 2.1.304 at 119235; 2.1.303 at 130368; 2.1.288 at 275749; 2.1.287 at 288964. The ledger gap (28 entries newer than 2.1.287, from 2.1.319 down to 2.1.288) spans characters 13 to 288964, so a full read needs 3 calls (offsets 0, 100000, 200000 cover to 300000).
- Why the evidence file says "2.1.304 and later": the 2.1.319 entry is 21,728 characters (21741 minus 13). Before 2.1.319 was added, the 100000 cut sat 21,728 characters deeper in today's numbering, inside 2.1.304 (PROVEN arithmetic; the earlier state is inferred). The cut position is fixed, so each release pushes more of the gap below it. Today the unread span is 2.1.288 to 2.1.308 (21 entries), not 2.1.288 to 2.1.303 as in the PRD.

**Root cause.** Four stacked defects; the first three produce the skip and the third makes it silent:

1. Read cap: WebFetch returns at most the first 100000 characters per call, and the procedure makes one call.
2. Prompt cap: the prompt asks for "the 10 most recent entries", so even a full read yields at most 10 of the 28 entries the ledger lacks.
3. No coverage check (the silent part): nothing compares the oldest version obtained with `ledger_covers.to`, the tool's own "covers only characters 0 to 100000" note is never read by the procedure, and Step 3b moves `ledger_covers.to` forward over versions that were never read. The next run then starts from the new mark, so the skipped range is never revisited.
4. No deterministic path: with no Bash grant, the command cannot download the file and parse it by header, so the model extraction is the only route.

Secondary observations (not causes): the doctor organ reported `ok` for this ledger (`installed 2.1.319 is within 32 patch version(s)`; PROVEN by running it) because its lag threshold is the constant `DEFAULT_MAX_VERSION_LAG = 40` patches, so nothing else flagged the gap. The previous refresh (commit ade7b31cb) already met the same limit ("main CHANGELOG.md only carries 2.1.281 and later") and was closed by hand from release notes (commit a061b7a2a).

### Fix shape (after the cause; reuse first)

- New `lib/core/radar/changelog-slice.cjs` (Node built-ins): `sliceChangelog(text, { after, maxChars })` returns `{ entries: [{ version, bullets }], coverage: { complete, truncated, newest, oldest, headers, charsRead, charsTotal, reason } }`. It splits on `^## (\d+\.\d+\.\d+)$`. `complete` is true only when the header for `after` (or a lower one) was seen inside the text read. Bullets are cut to 240 characters and stripped of backticks, links and HTML (keeps the injection fence of `radar.md` Step 3b item 3).
- Thin `scripts/radar-changelog-slice.cjs`: GET the fixed URL (one host, redirects not followed off-host, size cap, timeout), write to `os.tmpdir()` (never into the repo), print JSON, exit non-zero with a typed reason when `coverage.complete` is false unless `--allow-partial`.
- `commands/radar.md` Step 3: call the script; Step 3b item 4 gains the rule "set `ledger_covers.to` only to a version whose coverage is `complete`; on `truncated`, say so with the covered range and do not advance the mark". Keep a WebFetch fallback for Desktop and Cowork surfaces with no Bash: page with `offset` 0, 100000, 200000 until a header at or below `ledger_covers.to` is read, and print the covered range; this keeps the Tri-Polar rule.
- Bash must be added to `allowed-tools` for the script path. `tests/test-265-radar-writes-ledger.cjs` arm 6 pins the set to 5 tools, so this is a widened tool grant: owner card, plus an edit to arm 6.
- Egress: the GET carries no user data; no Brain call; Part 8 holds. Check the repo's network-surface registry before adding a network-calling script (`docs/BACKEND-MAP.md` lists the other public fetchers; whether a test enumerates allowed network files was not checked; UNVERIFIED).
- After the edit: `node scripts/build-skill-mirrors.cjs` (write mode), `node scripts/build-dist-bundles.cjs`, then `--check` forms, `node scripts/build-connector-registry.cjs --check`, `node scripts/check-render-coverage.cjs` (Part 11 regeneration).

Failing test first: `tests/test-391-radar-changelog-slice.cjs`. Build the fixture at run time (no 1 MB file in git): 40 descending versions, each entry about 3,500 characters, total above 100000 characters, newest at the top; set `after` so the gap lies below character 100000. Arms: (1) a read capped at `maxChars: 100000` must return `coverage.complete === false`, `truncated === true`, `oldest` above `after`, and a `reason` that names the covered range; it must not return the below-cut versions; (2) the uncapped read returns exactly the versions above `after`, `complete === true`; (3) bullet sanitising and the 240 cap; (4) the CLI exits non-zero on incomplete coverage; (5) prose arm: `commands/radar.md` names the script and the rule not to advance `ledger_covers.to` when coverage is incomplete, and still contains the strings checked by `test-265-radar-writes-ledger.cjs`. RED today: the module does not exist, and arm 5 fails on the current prose. Optional live arm behind `MOS_RADAR_LIVE=1` (network), off by default.

## Additional findings (cheap checks and adjacent surfaces)

| Item | Result |
|---|---|
| Names with hidden or `<>` characters (2.1.299) | PROVEN scan of 256 files (113 commands, 126 skills, 17 agents): 0 flagged in file names, folder names or `name:` values; no non-ASCII character in any of them |
| Name length 256 (2.1.292) | PROVEN: longest name or file stem is 29 characters |
| Subagent `skills:` max 32 (2.1.295) | PROVEN: `larry-extended.md` lists 4, `reverse-salient-agent.md` lists 2. Note: `larry-extended.md` is a plugin agent; `skills:` is not in the ignored-field list, `mcpServers` and `initialPrompt` are |
| `autoCompactWindow` (2.1.296, 2.1.312) | CITED: value 100000 to 1000000 tokens, needs 2.1.296; 2.1.312 lowers `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, never raises it. No agent sets it. Candidate for `framework-runner`. Whether the host honours it for plugin agents is UNVERIFIED. Candidate only, no change |
| Fork subagents default on (2.1.302) | CITED: a fork "inherits the parent conversation" and "receive[s] the main conversation's exact tool pool", skipping the filters. Note for Phase 389: a fork ignores a subagent `tools:` restriction, which matters for the Part 8 reasoning of the parallel Test step. `tests/test-265-no-fork-subagent-literal.cjs` already guards the old opt-in literal |
| Skill hooks 1,024 per source (2.1.304) | PROVEN: 0 skills, commands or agents declare frontmatter `hooks:`; `hooks/hooks.json` has 41 hooks. The limit is for skill hooks, so it is far from reached |
| Mod hooks (`hooks/mos-face.json`, module `lib/mos-face/dist/register.js`) | `claude plugin validate .` passes with 1 warning (CLAUDE.md at plugin root is not loaded as context) and lists 17 gating mod hooks "without .catch" (15 `command.run`, `prompt.submit`, `tool.call`). CITED (mods events doc): a gating hook with no `.catch` that throws or times out is skipped and the action goes on. PROVEN by reading `ui/mos-face/hooks/register.tsx`: the mod never returns `deny` or `drop`; it only observes. So fail-open is the right posture and no `.catch` is needed |
| `turn.start` now also fires for subagents (2.1.299) | PROVEN not affected: `ui/mos-face/hooks/register.tsx:1052-1053` and the built `lib/mos-face/dist/register.js:968-969` test `e.agentId === undefined` |
| `claude plugin validate` | Available; use it as a verification step (read-only) |
| Docs drift | `CLAUDE.md` says SDK `^1.29.0`; the repo is on the v2 `@modelcontextprotocol/server` 2.1.0. `hooks/hooks.json` is described as "42 of 42 type: command" in a ledger row; today it is 41 |

## Common Pitfalls

### Pitfall 1: Believing `allowed-tools:` restricts an agent
**What goes wrong:** 13 agents run with every tool while their comments say they cannot write or fetch.
**Why:** the host reads `tools`, not `allowed-tools` (PROVEN by the debug warning).
**Avoid:** any `tools:` addition uses plugin-scoped MCP names and goes through an owner card; add the Tier B report to the new test.
**Warning sign:** `--debug-file` lines containing `does not recognize or apply`.

### Pitfall 2: Setting `ledger_covers.to` before the rows exist
**What goes wrong:** `tests/test-265-capability-ledger-schema.cjs` fails ("does not equal the highest ... version").
**Avoid:** add the rows and the new `to` in one change; include a row at the version of `to`.

### Pitfall 3: Advancing the radar mark over unread versions
**What goes wrong:** the skipped range is never revisited, because the next run starts at the new mark.
**Avoid:** advance `ledger_covers.to` only when `coverage.complete` is true.

### Pitfall 4: Trusting the model-side extraction of a 1 MB untrusted file
**What goes wrong:** instruction-shaped text in the changelog can reach the ledger.
**Avoid:** parse locally, keep only whitelisted fields, cap strings at 240 characters; keep the existing injection fence sentences (test-265 arm 3 pins "Never write raw fetched markdown").

### Pitfall 5: Trusting the doctor freshness organ as the gap alarm
**What goes wrong:** it counts patch numbers against a constant of 40, so a 32-patch gap reads `ok`.
**Avoid:** the coverage report from the slicer is the gap alarm. Changing the threshold is optional and out of scope.

### Pitfall 6: Editing `commands/radar.md` without regenerating the mirrors
**What goes wrong:** `skills/radar/SKILL.md` and two dist copies drift; the build-skill-mirrors `--check` then fails the release gate.
**Avoid:** run the Part 11 regeneration list above.

### Pitfall 7: Adding `onFailure` to an observer hook
**What goes wrong:** a slow observer blocks the user's prompt or tool call.
**Avoid:** only the two guard hooks are candidates; Stop-family hooks ignore the field.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Version compare | a third semver comparator | copy `compareDotted` from the schema test into the new module and export it once | Two private copies already exist (`parseDotted` in the doctor module, `compareDotted` in the test) |
| Skill mirror text | hand-edit `skills/radar/SKILL.md` | `scripts/build-skill-mirrors.cjs` | It is generated; `--check` fails on a hand edit |
| MCP handshake proof | a new harness | `tests/test-267-mcpv2-brain-shim.cjs`, `test-267-mcpv2-dual-era.cjs` | Already drive the real v2 client in both eras |
| Frontmatter reader | a YAML dependency | the local YAML-subset reader pattern in `tests/test-361-agent-contract.cjs` | No new dependency |
| Hook behaviour proof | reading the doc only | the 7-arm probe in (b) (scratch dir, `claude -p`, haiku, marker file) | Cheap and exact |

## Code Examples

Coverage object shape the test pins (design, not yet code):

```javascript
// coverage for a read that stopped at 100000 characters
{ complete: false, truncated: true, newest: '2.1.319', oldest: '2.1.309',
  after: '2.1.287', headers: 9, charsRead: 100000, charsTotal: 1175667,
  reason: 'read covers 2.1.319 to 2.1.309 only; versions 2.1.308 down to 2.1.288 were not read' }
```

Probe pattern used for (b) and (c) (isolated, no user hooks):

```bash
# project settings hook; run from a scratch dir
claude -p "<prompt>" --model haiku --setting-sources project --strict-mcp-config \
  --max-turns 3 --allowedTools "Bash" < /dev/null
```

Agent frontmatter probe (reads host warnings; no hooks fire because the scratch plugin has none):

```bash
claude -p "say ok" --model haiku --plugin-dir <scratch-plugin> --setting-sources project \
  --strict-mcp-config --max-turns 1 --debug-file <log> < /dev/null
grep "does not recognize or apply" <log>
```

## State of the Art

| Old approach | Current approach | Since | Impact |
|---|---|---|---|
| Hook failure fails open | `onFailure: "block"` fails closed (command, http) | 2.1.295 | Shipped on the egress guard only |
| UserPromptSubmit saw expanded text (unverified for older versions) | Sees the raw line; block also stops `!` commands | 2.1.299 | Matches `admin-command-gate.cjs` design |
| MCP 2025-11-25 only | 2026-07-28 asked by default (stdio, HTTP, connectors) | 2.1.292 to 2.1.299 | Both plugin servers already dual-era (Phase 267) |
| Agent tools via `allowed-tools` mirror | Host reads `tools` only | long-standing; warning visible on 2.1.319 | 13 agents unrestricted |

**Deprecated/outdated:** the `CLAUDE.md` SDK line (v1); the evidence file's "mcp_tool: NOT FOUND" (the hook type exists since 2.1.118).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | WebFetch's 100000-character cap behaves the same in Desktop and Cowork as in this CLI session | Radar root cause | The fallback paging path may differ; the script path does not depend on it |
| A2 | The changelog format (`## x.y.z`, descending) stays stable | Fix shape | Parser returns incomplete coverage; the typed failure makes this loud, not silent |
| A3 | Plugin-scoped tool names are `mcp__plugin_mos_<server>__<tool>` for plugin `mos` | (a) | A wrong `tools:` list would strip Brain tools from an agent; probe live before any `tools:` edit |
| A4 | Each onFailure arm behaves as probed on other models and in interactive mode (n=1, `claude -p`, haiku) | (b) | Low; the doc text agrees |
| A5 | Older sessions (before 2.1.299) gave UserPromptSubmit hooks the expanded body | (c) | If wrong, there is no behaviour change at all |
| A6 | `autoCompactWindow` is honoured for plugin agents | Additional | Candidate has no effect; no harm |
| A7 | A repo test may enumerate allowed network-calling scripts | Fix shape | A new script could trip a Part 8 surface scan; run the Part 8 and Part 11 gates early |
| A8 | `mcp__brain_*` matches nothing in the host | (a) | If it matches something, the skill already has more Brain access than intended |
| A9 | No managed setting or env switch disables `/ultrareview` | (g) | Owner card would offer a switch that exists |

## Open Questions (owner cards the plan must raise; research makes no decision)

1. **Agent `tools:` enforcement.** What: 13 agents have no host-read `tools:`. Options: add `tools:` mirrors with plugin-scoped names; or accept and fix the false comments. Behaviour change, Part 8 relevant (research.md and others reach the Brain and Write).
2. **`onFailure` on `web-credential-guard-hook.cjs`.** Fail closed on timeout and cannot-start versus the risk that a slow 5 s hook blocks web calls. Needs edits to WH5 and A5.
3. **Bash grant for `/mos:radar`.** Needed for the local parse. Without it, only the WebFetch paging fallback is possible and the parse stays model-side.
4. **`/ultrareview`.** The card in (g).
5. **`mcp__brain_*` in `skills/intelligence-orchestrator/SKILL.md:20`.** Leave (matches nothing), remove, or replace with a real, narrow grant.
6. **Extra `no-op` ledger row at 2.1.318** versus `to = 2.1.317`.
7. **Who runs the fetch** (PRD item i, owner decision). The planner should not run `--fetch` without it; the fetch writes ledger and cache files.
8. Adjacent, not 391 scope: `larry-extended.md` `mcpServers` and `initialPrompt` are ignored for plugin agents (PROVEN warning). The Phase 95.6 comment that relies on `mcpServers` is no longer true for the plugin install. Raise as a separate quick task.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| claude CLI | probes for (b), (c), agents; `plugin validate` | yes | 2.1.319 | none needed |
| node | tests, slicer | yes | v22.23.1 | none |
| curl | changelog download in research | yes | present | Node `fetch` in the script |
| Network to raw.githubusercontent.com | radar fetch | yes (HTTP 200, 1,176,779 bytes) | n/a | WebFetch paging fallback |
| uv + Eureka `.venv` | Eureka handshake | yes | `mcp` 2.3.0 in `.venv` | skip the Eureka arm |
| Python `mcp` (system) | not used | 1.25.0 in `~/.local` | n/a | n/a |

No missing dependency blocks execution.

## Validation Architecture

(`workflow.nyquist_validation` is true in `.planning/config.json`.)

### Test Framework
| Property | Value |
|---|---|
| Framework | Plain Node scripts (CJS), phase aggregator shell script; no node:test, no dependency |
| Config file | none; `tests/run-all-391.sh` to create (copy `tests/run-all-387.sh`, glob prefix `tests/test-391-`, keep the found-eq-0 guard and the em-dash fence) |
| Quick run command | `node tests/test-391-radar-changelog-slice.cjs` |
| Full suite command | `bash tests/run-all-391.sh`, plus `bash tests/run-all-265.sh` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| 391-a | `tools:`/`allowed-tools:` forms obey the documented rule; Tier B report | unit | `node tests/test-391-agent-tools-naming.cjs` | Wave 0 |
| 391-b | each guard hook's `onFailure` matches the owner's ruling | unit | `node tests/test-261029-qef-hook-timeouts.cjs` and `node tests/test-386-web-credential-hook.cjs` (edited only under an owner card) | yes |
| 391-b | host honours `onFailure` | manual probe (7 arms, scratch dir, costs model calls) | script kept in the phase summary | recorded in this file |
| 391-c | no hook returns `updatedInput`; raw prompt seen | unit grep + manual probe | `node tests/test-391-hooks-contract.cjs` (grep arm) | Wave 0 |
| 391-d | handshake in both eras | integration | `node tests/test-267-mcpv2-brain-shim.cjs`; `node tests/test-267-mcpv2-dual-era.cjs` (2 snapshot arms red from Phase 387, fix the snapshot) | yes |
| 391-e | no prompt or agent hooks in `hooks.json` | unit | arm in `test-391-hooks-contract.cjs` | Wave 0 |
| 391-f | `mcp_tool` lead recorded | doc | phase summary line | n/a |
| 391-h | slicer reports truncation / full range | unit | `node tests/test-391-radar-changelog-slice.cjs` | Wave 0 |
| 391-i | rows present, `to` moved, schema green | unit | `node tests/test-391-ledger-rows.cjs && node tests/test-265-capability-ledger-schema.cjs` | Wave 0 |
| names | no hidden/`<>` chars, length <= 256, `skills:` <= 32 | unit | arm in `test-391-agent-tools-naming.cjs` or a sibling | Wave 0 |

### Sampling Rate
- Per task commit: the task's own test file plus `node tests/test-265-radar-writes-ledger.cjs`.
- Per wave merge: `bash tests/run-all-391.sh && bash tests/run-all-265.sh`.
- Phase gate: both aggregators green, then `node scripts/build-skill-mirrors.cjs --check`, `node scripts/build-connector-registry.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance`. Note: the 387 executor measured doctor acceptance at about 68 s on this machine, above the 60 s timeout of `tests/test-244-doctor-fts-health.cjs` (a known red; source `384-LEADS.md` item 4).

### Wave 0 Gaps
- [ ] `tests/test-391-radar-changelog-slice.cjs` (RED first; covers 391-h)
- [ ] `tests/test-391-agent-tools-naming.cjs` (covers 391-a and the names/skills checks)
- [ ] `tests/test-391-hooks-contract.cjs` (391-c grep arm, 391-e)
- [ ] `tests/test-391-ledger-rows.cjs` (391-i)
- [ ] `tests/run-all-391.sh`

## Security Domain

`security_enforcement` is not set to false, so this applies.

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V5 Input Validation | yes | The changelog is untrusted: local parse, whitelist fields, 240 character cap, no links or code, no execution (injection fence in `commands/radar.md` Step 3b item 3) |
| V12 Files and Resources | yes | Download to `os.tmpdir()`, not the repo; size cap; fixed host; no off-host redirect |
| V9 Communications | yes | HTTPS to one fixed host; no user data in the request |
| V2/V3/V4 | no | No auth, session or access change in this phase |
| V6 Cryptography | no | none |

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Instruction-shaped text in the changelog reaching the ledger | Tampering | Field whitelist, length cap, link/code stripping, tripwire arm 3 |
| Oversized or hostile response | Denial of service | Byte cap and timeout in the script |
| Agent with unintended tools (13 agents) | Elevation of privilege | Owner card on `tools:` enforcement |
| Hook timeout lets a guarded call through | Bypass | `onFailure: "block"` on guard hooks (owner ruling) |
| `/ultrareview` uploading a room folder | Information disclosure | Owner card (g) |

Canon Part 8: the radar GET is public, carries no user bytes and makes no Brain call.

## Project Constraints (from CLAUDE.md)

- Work through GSD; no direct edits outside a GSD workflow. This research made no code edit and no push.
- Canon Part 8 (no user data to Brain), Part 7 (reuse before build, inventory above), Part 11 (regeneration after a surface-list change; the mirrors for `radar`), Part 3 (material choices through the decision gate, so the owner cards).
- No em-dashes anywhere (hyphens only); Feynman-simplified, JTBD prose in user-facing text.
- `.planning/` is gitignored but key phase files are force-tracked: new phase files need `git add -f`; commit with `git commit --only` (shared-tree collision protocol).
- Node >=22.18.0; hooks and the MCP server stay `.cjs`; no dependency in the root `package.json` for tooling.
- Tri-Polar rule: radar must keep a path for Desktop and Cowork (no Bash), hence the WebFetch paging fallback.
- QA findings use the RCA standard (`docs/RCA-TEMPLATE.md`): this file classes the radar bug as a NEW FAILURE with the root cause above, the agent `tools:` finding as a NEW FAILURE, and the `test-267-mcpv2-dual-era` red arms as a known stale snapshot.
- Grounding sources used: Claude Code official docs (code.claude.com), the Claude Code changelog, live runs on claude 2.1.319. Context7 and the claude-code-guide agent were not available in this session; the official docs pages were read directly.

## Sources

### Primary (HIGH confidence)
- Live runs on claude 2.1.319 in this session: 7-arm `onFailure` probe; `UserPromptSubmit` payload probe; `--plugin-dir` agent frontmatter debug log; `claude plugin validate .`; live WebFetch of the changelog URL (tool note: 1175667 characters, covered 0 to 100000).
- Repo files read: `commands/radar.md`, `lib/core/doctor/capability-ledger-module.cjs`, `data/capability-ledger.json`, `hooks/hooks.json`, `.mcp.json`, `agents/*.md`, `scripts/{admin-command-gate,part8-egress-guard-hook,web-credential-guard-hook,card-before-answer-hook}.cjs`, `tests/test-265-*.cjs`, `tests/test-261029-qef-hook-timeouts.cjs`, `tests/test-386-web-credential-hook.cjs`, `tests/test-267-mcpv2-*.cjs`, `ui/mos-face/hooks/register.tsx`.
- Local test runs: `test-267-mcpv2-brain-shim` (PASS=6), `test-267-mcpv2-dual-era` (PASS=3 FAIL=2, snapshot), `test-265-capability-ledger-schema` (57 rows pass), `test-265-radar-writes-ledger`, `test-265-ledger-freshness`, `test-261029-qef-hook-timeouts`, `test-386-web-credential-hook`, `build-skill-mirrors --check` (112 match).
- https://code.claude.com/docs/en/hooks (handler types, `onFailure`, exit codes, UserPromptSubmit, caps; the page text is 289919 characters and I read characters 0 to 200000)
- https://code.claude.com/docs/en/sub-agents (frontmatter fields, MCP naming, 32 skills, plugin-agent restrictions, `autoCompactWindow`, forks; read 0 to 100000 of 116722)
- https://code.claude.com/docs/en/mcp (`MCP_PROTOCOL_NEGOTIATION`, plugin tool naming; read 0 to 100000 of 157203)
- https://code.claude.com/docs/en/plugins-reference (manifest, monitors, validate)
- https://code.claude.com/docs/en/plugins/mods/reference.md and https://code.claude.com/docs/en/plugins/mods/events.md (gating hooks, `.catch`, limits)
- https://code.claude.com/docs/en/ultrareview
- Changelog: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md (curl, 2026-11-07; entries 2.1.288 to 2.1.319 read, plus every `mcp_tool` hit)

### Secondary (MEDIUM confidence)
- `.planning/audits/CLAUDE-CODE-RADAR-DIFF-2.1.288-TO-2.1.318.md` (relayed evidence; every claim re-checked above; one correction: `mcp_tool` exists; the "2.1.304 and later" figure is explained above)

### Tertiary (LOW confidence)
- None used as a basis for a recommendation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no external packages)
- Architecture: HIGH (reuse inventory enumerated from disk; fix shape follows the measured cause)
- Pitfalls: HIGH for items 1 to 3 (proven by runs), MEDIUM for items 5 to 7

**Research date:** 2026-11-07
**Valid until:** 2026-11-21 (the host ships a version about every few days; re-run the three probes if claude moves past 2.1.319 before execution)
