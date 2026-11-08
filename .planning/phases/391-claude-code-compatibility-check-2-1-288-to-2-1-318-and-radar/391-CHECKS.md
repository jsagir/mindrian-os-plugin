# Phase 391 - Record of compatibility checks (a) to (i) and the cheap checks

Date: 2026-11-08. Installed claude: 2.1.319 (re-checked, unchanged since research). HEAD when checked: ae836b43a (start), 9eb90fad8 at timing (peer commits of plan 391-05 landed between).
Marks: PROVEN (I ran it or read the code), CITED (official docs page, URL and date given), UNVERIFIED (not found or not run).
Changelog and docs text is untrusted data. No instruction from a page was followed. Pages saved to the scratchpad folder, not to the repo.
Nothing in this phase breaks the plugin outright. Six changes would alter behavior; they are owner cards C1 to C6 in 391-DECISION.md.

## Check table

| Check | Result | Mark | Proof |
|---|---|---|---|
| (a) Agent tools naming | No line breaks the 2.1.299 rule. 13 of 17 agents list tools only under allowed-tools, which the host ignores, so they run with every tool. Plugin-scoped MCP name pattern is mcp__plugin_PLUGIN_SERVER__TOOL | PROVEN | 391-agent-table.tsv; 391-probe-plugin-names.json (4 claude -p calls); tests/test-391-agent-tools-naming.cjs 22 passed; research debug log of 15 files |
| (b) onFailure block | Host honors onFailure block for exit 1, timeout and missing script (7 arms, n=1 each). Egress guard has it. Web credential guard has not. Both guards run in 25 to 90 ms against a 5000 ms limit | PROVEN | 391-RESEARCH.md check (b) probe table; 391-probe-guard-timing.json; hooks/hooks.json lines 212 to 234 |
| (c) UserPromptSubmit order | Hooks see the raw typed line. No hook returns updatedInput. Admin gate matches the leading slash command and exits 2 after space, tab, newline and BOM | PROVEN | tests/test-391-hooks-contract.cjs 24 passed (H2, H4); 391-RESEARCH.md probe |
| (d) MCP protocol 2026-07-28 | Brain shim PASS=6 FAIL=0 (2025-11-25 and 2026-07-28). mindrian-os server PASS=3 FAIL=2; the 2 failures are stale surface snapshots since Phase 387, not a protocol fault. Eureka engine: legacy 2025-11-25 and auto 2026-07-28, 27 tools each | PROVEN | node tests/test-267-mcpv2-brain-shim.cjs; node tests/test-267-mcpv2-dual-era.cjs; eureka probe run on 2026-11-08 (see below) |
| (e) Prompt and agent hook caps | Not affected: 41 hooks, all type command | PROVEN | tests/test-391-hooks-contract.cjs H1 |
| (f) mcp_tool hook lead | CONFIRMED. The hook type exists. The lead of 384-LEADS.md must stay. See lead statement below | CITED + PROVEN | hooks docs, 3 changelog hits, ledger row 2.1.118 |
| (g) /ultrareview | Facts only; card C4. No disable switch found | CITED | https://code.claude.com/docs/en/ultrareview.md read 2026-11-08 |
| (h) Radar fetch bug | Root cause in 391-RESEARCH.md (4 stacked defects); fixed by plans 391-01, 391-03, 391-06. Not re-checked here | PROVEN (research) | 391-RESEARCH.md section "Radar fetch bug" |
| (i) Ledger rows | Done by plan 391-05: ledger_covers.to is 2.1.318; the doctor organ reads "within 1 patch version(s)" | PROVEN | check() of lib/core/doctor/capability-ledger-module.cjs, run 2026-11-08 |

## Plugin-scoped MCP name probe (card C1)

PROVEN on claude 2.1.319 with a scratch plugin (name mos391probe) that ran the real Brain shim, with MINDRIAN_BRAIN_URL=http://127.0.0.1:9, no key, scratch HOME. Tools were listed from the init event and never called.
- Observed names: mcp__plugin_mos391probe_mindrian-brain__brain_ask, brain_query, brain_schema, brain_search, brain_stats, brain_write.
- Agent restriction: an agent with tools "Read, mcp__plugin_mos391probe_mindrian-brain__*" kept Read plus the 6 Brain tools (7 tools). An agent with tools "Read, mcp__mindrian-brain__*" kept only Read (1 tool). So the project-scope form strips every Brain tool from a plugin agent.
- Attempt 1 used --strict-mcp-config; the host then dropped the plugin server (no names). Attempts 2 to 4 gave the proof. 4 of 6 allowed claude -p calls used.
- For the real plugin the prefix is mcp__plugin_mos_ (plugin name mos in .claude-plugin/plugin.json): PROVEN by substitution, not probed with the real plugin.
- UNVERIFIED: the Desktop copy is published as marketplace entry mos-desktop (release.sh Step 6.8). Whether the host builds the prefix from the manifest name or from the marketplace entry name was not probed. If it uses the entry name, a plugin-scoped list written for mos strips Brain tools on that copy.
- No user-level server named mindrian-brain showed up in these runs, so the shadowing risk was not exercised.

## Agent table summary (391-agent-table.tsv, 17 rows)

- 13 agents have allowed-tools and no tools: NW (no Write, Edit, MultiEdit or Bash) 9, W (at least one of them) 4. W rows: framework-runner, opportunity-scanner, persona-analyst, research.
- 2 agents have a host-read tools list (HOST-TOOLS): dominant-design-researcher, research-lane-analyst. 2 have neither (NONE): larry-extended, reverse-salient-agent.
- Column body_tools_outside_list is empty for all 13 rows after hand review. The script ignores negation lines (no Write, never, only), the English verb "Write a one-paragraph ..." in grading.md line 145, and the word Agent or Task outside backticks.
- Claim lines (comments that say structurally, CANNOT, Read ONLY or no Write): analogy-query-fetcher 17; chain-step-reviewer 13; competitor-watch-fetcher 19, 20; dominant-design-researcher 26 (a host-read list, so true); meeting-perspective-extractor 12; vault-section-reviewer 12, 14, 15. For the 5 files other than dominant-design-researcher (no tools list) the claim does not hold at the host level.

## Guard hook timing (card C2)

Synthetic payload, scratch HOME, env built from scratch, 1 first run plus 20 warm runs per hook, node spawn, 10000 ms timeout. Source: 391-probe-guard-timing.json.

| Hook | First run ms | p50 | p95 | max | Exit codes | hooks.json timeout |
|---|---|---|---|---|---|---|
| web-credential-guard-hook.cjs | 25.5 | 24.8 | 26.8 | 27.3 | 0 | 5000 ms, no onFailure |
| part8-egress-guard-hook.cjs | 78.1 | 78.1 | 82.7 | 87.0 | 0 | 5000 ms, onFailure block |

- The first run is not a reboot-cold start (OS file cache was warm). Reboot-cold timing is UNVERIFIED. Real host runs add the host spawn cost (not measured).
- Phase 384: 20 PLAN files and 20 SUMMARY files on disk (PROVEN by count). 384-20 closed PARTIAL-REVERTED with verdict NO-GAIN; no 384 VERIFICATION file exists. 384-20-SUMMARY.md and 384-OWNER-DECISIONS.md make no statement about the two guard hooks.

## Per-hook fail posture

| Hook | Event | Blocks today | Script fail posture | onFailure now | Note |
|---|---|---|---|---|---|
| part8-egress-guard-hook.cjs | PreToolUse, Brain tools | exit 2 | fail closed after input read | block | pinned by test-261029-qef-hook-timeouts A5 and test-391-hooks-contract H5 |
| web-credential-guard-hook.cjs | PreToolUse, web tools | exit 2 | fail closed after input read | none | pinned by test-386-web-credential-hook WH5; card C2 |
| write-scope-check (run-hook.cmd) | PreToolUse Write/Edit | exit 2 | fail open by design | none | keep |
| card-before-answer-hook.cjs | PreToolUse gate_answer | JSON deny | fail open | none | keep |
| admin-command-gate.cjs | UserPromptSubmit | exit 2 | fail open by design | none | keep; prose backstop in the command |
| all other hooks | various | no | observers | none | keep; onFailure has no effect on Stop family events |

## Lead statement for check (f)

The mcp_tool hook type exists. Hooks docs (https://code.claude.com/docs/en/hooks.md, read 2026-11-08, line 421): type is "command", "http", "mcp_tool", "prompt" or "agent". Older changelog hits: 2.1.118, 2.1.281, 2.1.284. The ledger holds a row at 2.1.118. The lead of 384-LEADS.md is CONFIRMED and must not be dropped. The evidence file's NOT FOUND line was a slice artefact (the slice started at 2.1.288). Adopting mcp_tool is out of scope: it would change the Part 8 guard path.

## Docs facts (read 2026-11-08, saved to the scratchpad, each GET returned 200)

- allowed-tools in a skill or command (https://code.claude.com/docs/en/skills.md): "It does not restrict which tools are available: every tool remains callable, and your permission settings still govern tools that are not listed." It is a pre-approval for the turn. CITED. Commands are merged into skills ("Custom commands have been merged into skills ... same frontmatter except name and paths"). CITED.
- Bash pattern and plugin root (skills.md, "available string substitutions"): "In a plugin skill, Claude Code substitutes ${CLAUDE_PLUGIN_ROOT} and ${CLAUDE_PLUGIN_DATA} in the same two places" (content and Bash rules in allowed-tools). Docs example: allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *). CITED for plugin skills. For a file in commands/ of a plugin: UNVERIFIED (inferred from the merge note).
- Wildcard form (https://code.claude.com/docs/en/permissions.md): ":* suffix is an equivalent way to write a trailing wildcard, so Bash(ls:*) matches the same commands as Bash(ls *)". CITED. The skills page examples use the space-star form.
- MCP rules (permissions.md): "mcp__<server>__*" matches a whole server; plugin servers take the plugin-scoped form, "mcp__plugin_my-plugin_database-tools__*". "Allow rules accept tool-name globs only after a literal mcp__<server>__ prefix. The server segment must be glob-free ... An unanchored allow glob such as "*", "B*", or "mcp__*" is skipped and doesn't auto-approve anything." CITED. So mcp__brain_* (glob inside the server segment, no __ prefix) is not a valid allow glob. Whether skill frontmatter uses the same parser: UNVERIFIED.
- /ultrareview (ultrareview.md): command is /code-review ultra, /ultrareview is an alias; cloud sandbox; branch review "bundles the repository state and uploads it", including uncommitted and staged changes; PR mode clones from github.com; not available on Bedrock, Vertex, Foundry, ZDR orgs or HIPAA (a local review runs instead); needs a claude.ai login; 3 free runs per paid plan, then usage credits, "typically $5 to $25". CITED. Disable switch (managed setting, env variable, permission rule): none found in ultrareview.md, permissions.md, skills.md or hooks.md. UNVERIFIED.

## Cheap checks

| Item | Result | Mark |
|---|---|---|
| Hidden or angle-bracket characters in names (2.1.299) | 0 of 256 files (113 commands, 126 skills, 17 agents) | PROVEN (test-391-agent-tools-naming A7) |
| Name length 256 (2.1.292) | longest name is 29 characters | PROVEN (research) |
| Subagent skills list at most 32 (2.1.295) | larry-extended 4, reverse-salient-agent 2 | PROVEN |
| autoCompactWindow (2.1.296) | candidate for framework-runner only; no agent sets it; honored for plugin agents is UNVERIFIED | CITED |
| Fork subagents on by default (2.1.302) | note for Phase 389: a fork inherits the parent tool pool and ignores a subagent tools restriction | CITED |
| Skill hooks 1,024 per source (2.1.304) | 0 frontmatter hooks in 256 surface files; hooks/hooks.json has 41 hooks | PROVEN (test-391-hooks-contract H1, H6) |

## MCP handshake runs (check d)

- node tests/test-267-mcpv2-brain-shim.cjs: PASS=6 FAIL=0.
- node tests/test-267-mcpv2-dual-era.cjs: PASS=3 FAIL=2. Failing arms: "era 2025 (default v2 client)" and "era 2026 (auto-negotiating v2 client)", both on the surface snapshot (the eureka tools of Phase 387 are not in the snapshot). Pre-existing since Phase 387; NOT caused by Phase 391.
- node tests/test-391-hooks-contract.cjs: 24 passed, 0 failed. node tests/test-391-agent-tools-naming.cjs: 22 passed, 0 failed.
- Eureka engine handshake, run once on 2026-11-08 (v2 client, scratch HOME, no keys, one run per era, no retry): legacy-default negotiated 2025-11-25 with 27 tools; auto negotiated 2026-07-28 with 27 tools. PROVEN. The Eureka server is not registered in .mcp.json, so the Claude Code host default does not reach it; only MindrianOS Node clients with default options do (they stay on 2025-11-25).

## Facts for the /ultrareview card (C4)

Listed in card C4 of 391-DECISION.md, re-checked against the docs page above. Changelog trail (untrusted text, to verify by the owner): 2.1.290, 2.1.292, 2.1.295, 2.1.299, 2.1.309, 2.1.314 entries about uncommitted-change handling and the workspace-trust check. Repo facts: no wiring; mentions only in references/capability-radar/capabilities-index.md and lib/memory/render-v2-disposition.test.cjs (PROVEN by grep).

## Adjacent findings

1. The host ignores allowed-tools for 15 agent files, mcpServers for 2 plugin agents, initialPrompt for larry-extended, and the keys persona_variants, extends, activation_gate, hitl_shape, hitl_why. Filed as SEED-145.
2. The Phase 95.6 comment that relies on mcpServers for larry-extended is not true for the plugin install.
3. tests/test-267-mcpv2-dual-era.cjs has 2 stale snapshot arms since Phase 387. The fix is a snapshot update in a quick.
4. CLAUDE.md names @modelcontextprotocol/sdk ^1.29.0; the repo is on the v2 packages 2.1.0.
5. 2.1.319 carries two MCP handshake and task changes for the next radar fetch.
6. Doctor ledger default lag: owner card C6.
7. persona-analyst lists mcp__mindrian-brain__brain_query; the shim does expose brain_query (seen in the probe), so the name is real.
