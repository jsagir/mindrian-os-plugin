---
id: SEED-145
title: "Plugin agents ignore allowed-tools, mcpServers and initialPrompt: 13 agents run with every tool and the comments that say otherwise do not hold"
status: open
priority: medium
filed: 2026-11-08
planted_during: "Phase 391 plan 04"
origin: "the host debug log on claude 2.1.319 (391-RESEARCH.md check a) and the agent table of plan 391-04"
trigger_when: "the next phase that edits agents/*.md, or the owner answer on card C1 of 391-DECISION.md, or a new claim in an agent file that a tool is unavailable"
scope: medium
surfaces: [MindrianOS-Plugin]
related: [SEED-107, SEED-143]
promotes_to: "plan 391-07 if the owner answers card C1 with an APPLY token; otherwise a quick that fixes the comments"
---

# SEED-145: Plugin agents ignore allowed-tools, mcpServers and initialPrompt

## As found

The host reads `tools:` in an agent file. It does not read `allowed-tools:`. For a plugin agent it also ignores `mcpServers:` and `initialPrompt:`. It logs unknown keys. Facts below were read on 2026-11-08 on claude 2.1.319.

| Fact | Mark |
|------|------|
| 15 agent files carry `allowed-tools:`; the host logs "does not recognize or apply" for each. | PROVEN (host debug log, 391-RESEARCH.md check a) |
| 13 of those 15 have no `tools:` list, so each runs with every tool. | PROVEN (391-agent-table.tsv) |
| The 13: analogy-query-fetcher, brain-query, chain-step-reviewer, competitor-watch-fetcher, framework-runner, grading, grant-reviewer, investor, meeting-perspective-extractor, opportunity-scanner, persona-analyst, research, vault-section-reviewer. | PROVEN |
| Only dominant-design-researcher and research-lane-analyst carry a host-read `tools:` list. | PROVEN |
| `mcpServers` is ignored for plugin agents: agents/larry-extended.md and agents/reverse-salient-agent.md. | PROVEN (debug log) |
| `initialPrompt` is ignored: agents/larry-extended.md. | PROVEN (debug log) |
| Unknown keys logged: persona_variants, extends, activation_gate, hitl_shape, hitl_why. | PROVEN (debug log) |
| The Phase 95.6 comment that relies on `mcpServers` is not true for the plugin install. | PROVEN (follows from the ignored key) |
| Comments in 5 files say the agent cannot write or has no Write or Brain tool: analogy-query-fetcher (line 17), chain-step-reviewer (13), competitor-watch-fetcher (19, 20), meeting-perspective-extractor (12), vault-section-reviewer (12, 14, 15). | PROVEN (391-agent-table.tsv, claim_lines) |
| A plugin agent with `tools: Read, mcp__plugin_mos391probe_mindrian-brain__*` keeps Read plus the 6 Brain tools; with `mcp__mindrian-brain__*` it keeps only Read. | PROVEN (391-probe-plugin-names.json) |

## Evidence

- Host debug log on claude 2.1.319 with `--plugin-dir` on a scratch copy of the 17 agent files (391-RESEARCH.md check a).
- 391-agent-table.tsv: one row per agent with group (NW 9, W 4, HOST-TOOLS 2, NONE 2), claim lines and keys the host ignores.
- 391-probe-plugin-names.json: 4 claude -p calls with a scratch plugin and a dead loopback Brain URL.
- Docs: https://code.claude.com/docs/en/sub-agents lists the fields a plugin agent supports; `allowed-tools` is not among them (CITED in 391-RESEARCH.md).

## Why it matters

The comments in these files tell a reader that the agent is read-only or cannot reach the Brain. The host does not enforce that. A reviewer who trusts the comment will think a Part 8 guarantee exists where it does not. The Part 8 egress hook still guards Brain calls, so no data crossing is claimed here. The gap is a wrong claim and an unrestricted tool set, not a proven leak.

## What was not done

No agent file was edited by plan 391-04. Card C1 in 391-DECISION.md offers: a `tools:` list on all 13 agents (APPLY-ALL), on the 9 agents with no write tools (APPLY-NO-WRITE-GROUP), a note line only (FIX-COMMENTS-ONLY), DEFER or NO. The other cards are separate. The `mcpServers`, `initialPrompt` and unknown-key findings have no card; they need a separate quick for larry-extended and reverse-salient-agent.
