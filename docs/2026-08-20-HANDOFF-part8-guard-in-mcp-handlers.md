# 2026-08-20 HANDOFF: Part 8 egress guard into the Brain MCP tool handlers

> **Status:** branch `fix/part8-guard-in-mcp-handlers` created off `main` @ `f566310c` (v2.0.0-beta.8). No code changes yet.
> **Entry point:** `/gsd:quick` (the full task brief is section 5 below, paste-ready).
> **Origin:** authored from a Windows session that could not honor the WORKSPACE GUARD. This file is the tracked carrier, per CLAUDE.md.

---

## 1. The one-line job

Canon Part 8 enforcement on direct Brain MCP tool calls currently depends on a Claude-Code-only `PreToolUse` hook. Move it into the tool handlers so it holds on every host.

## 2. Why this surfaced now

The navigator asked whether MindrianOS could ship as an OpenAI/ChatGPT plugin. Researching that turned up a governance hole that is not ChatGPT-specific.

**What is true about OpenAI hosts as of 2026-08-20 (verified, not recalled):**

- ChatGPT "plugins" are long gone. The live surfaces are **Apps SDK** (reviewed, published apps) and **custom MCP connectors** via Settings -> Apps -> Advanced -> Developer mode. Plus/Pro/Business/Enterprise only, no Free tier. Custom connectors require a **remote** endpoint (Streamable HTTP or SSE). No stdio, no local filesystem.
- **Agent Plugins 1.0.0** shipped **2026-08-06**, published by a TSC from Amazon, Cursor, Microsoft, OpenAI and Vercel (Google joining). A plugin is a folder: required `plugin.json`, optional `skills/`, optional `mcp.json`. Vendor extensions go under reverse-DNS namespaces such as `com.example.client`, and other clients ignore what they do not understand. Supported at launch by ChatGPT, Codex, Cursor, GitHub Copilot, Kiro and VS Code. **Anthropic is not a maintainer; Claude Code keeps its own format.**
- **Codex CLI** is the real Claude Code analog, not ChatGPT: AGENTS.md, skills at `~/.agents/skills`, subagents, stdio MCP, and hooks behind `[features].hooks = true` in `~/.codex/config.toml` (`codex_hooks` is the deprecated alias; engine is `Stage::UnderDevelopment`).

**The Codex hook events:** SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PermissionRequest, PreCompact, PostCompact, SubagentStart, SubagentStop, Stop.

**The limitation that matters:** Codex fires `PreToolUse` / `PostToolUse` for **Bash tool events only**. No file-write events. No MCP tool events. And its `PreToolUse` can only DENY, never modify tool input.

## 3. The hole, stated precisely

`hooks/hooks.json` registers:

| Event | Matcher | Script |
|---|---|---|
| PreToolUse | `mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain\|pws-brain-mcp)__.*` | `scripts/part8-egress-guard-hook.cjs` |
| PostToolUse | same matcher | `scripts/brain-response-sanitize-hook.cjs` |

Both are MCP-tool matchers. On Codex, and on any host without MCP-scoped tool hooks, **neither ever fires** and nothing announces that.

`git grep part8-egress-guard origin/main` shows the guard wired into **9 local lib call sites**:

- `lib/core/brain-client.cjs` x5 (approx lines 450, 640, 994, 1108, 1789)
- `lib/core/bono/persona-research.cjs`
- `lib/core/grill-engine.cjs`
- `lib/core/intel-pipeline.cjs`
- `lib/core/rs-expert-brain-projection.cjs`
- `lib/core/security/agentshield-scanner.cjs`

and into **zero** MCP tool handlers:

- `bin/mindrian-brain-mcp-client.cjs` -> no reference
- `mcp-server-brain/` -> no reference (only `lib/query-embedder.cjs` and a cypher file mention part8/egress incidentally)

**So:** anything that goes through `brain-client.cjs` is guarded in-process and is fine on every host. A **direct model-issued** `mcp__...mindrian-brain__brain_ask | brain_query | brain_search | brain_write` bypasses `brain-client.cjs` entirely and is guarded ONLY by the hook. That is the exposed path.

## 4. Why it is worth doing regardless of the ChatGPT decision

Phase 234 **D-04** already decided: *"Enforce governance SERVER-SIDE, in MCP tool handlers, not via client hooks."* The decision is right and it is not yet true in code for the Brain tools. This closes that gap. It is the same fix for Codex, for ChatGPT, and for Claude Code hardening. It is not contingent on any port going ahead.

Related standing decisions to respect: **D-06** (nothing proprietary in a SKILL.md), **D-08** (free core stays local and copyable), **D-10** (never gate a `/mos:` methodology run behind a paid check).

## 5. Paste-ready task brief for `/gsd:quick`

```
Wire the already-shipped Part 8 egress guard (lib/core/part8-egress-guard.cjs, a pure LOCAL
classifier) into the Brain MCP tool handlers so Canon Part 8 enforcement is HOST-INDEPENDENT
instead of depending on a Claude-Code-only PreToolUse hook. Evidence and rationale:
docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md (read it, do not re-derive).

SCOPE (surgical, reuse before build, Canon Part 7):
1. bin/mindrian-brain-mcp-client.cjs - call classify() inside each Brain tool handler
   (brain_ask, brain_query, brain_search, brain_write) BEFORE any network egress. Refuse with
   a clear Part 8 refusal payload on a non-clean verdict. Read the 5 existing call sites in
   lib/core/brain-client.cjs FIRST and match their convention exactly. Do not invent a second
   convention.
2. Decide and implement whether mcp-server-brain/ also needs the guard. It sits on the FAR
   side of the network boundary and Canon Part 8 says the Brain must never RECEIVE user
   content, so a check there is a genuine last line of defence rather than redundancy. It
   deploys standalone (its own package.json, render.yaml) and cannot require the local lib/
   tree, so either vendor the pure classifier or keep it local-only and document the call.
3. Keep the hooks in hooks.json. They become defence-in-depth, not the only belt. Do not
   delete them.
4. Add a locked-invariant test, modelled on lib/mcp/no-instructions.test.cjs, asserting every
   Brain MCP tool handler routes through the guard, so this cannot silently regress.

CONSTRAINTS:
- Fail-safe direction is a real decision. scripts/part8-egress-guard-hook.cjs deliberately
  fails OPEN, on the reasoning that a false block is worse than a false allow for a safety
  hook. An in-handler guard on the egress path is a different risk profile. Decide fail-open
  vs fail-CLOSED deliberately and justify it in the summary. Do not copy the hook posture by
  reflex.
- Do not change what classify() does. It is shipped and consumed by 9 modules.
- D-10: do not gate any /mos: methodology run behind a paid check.
- Tri-Polar: state the effect on CLI, Desktop and Cowork.
- No em-dashes. Hyphens only.
- Run tests/run-all-234.sh if present, plus any brain/part8 suites, and
  node scripts/doctor.cjs --acceptance. Report results honestly, including failures.
- Atomic commits.
```

## 6. State when this was written

- Branch `fix/part8-guard-in-mcp-handlers` exists off `main` @ `f566310c` (v2.0.0-beta.8), in sync with `origin/main`.
- 18 untracked files were present in the workspace (`.planning/debug/*.md`, `docs/MINDRIANOS-PRD.md`, `prototypes/`). None touch the target files. Left alone deliberately.
- Five stashes exist, several tagged as other concurrent sessions' WIP. Left alone deliberately.
- A stray branch of the same name was created in the stale Windows clone at `C:\Users\jsagi\Desktop\Mindrian\mindrian-os-plugin-src` (v1.16.0-beta.12) before the guard caught it, and has been deleted. That clone is NOT canonical. Ignore it.

## 7. Open follow-ups, not in scope here

- **The ChatGPT connector.** The navigator chose a Tier-0 ChatGPT thin connector (Brain reads only). Note honestly that this reopens **D-07**, which chose licensed-server open-core OVER Brain-as-a-service on 2026-07-18. Record that reopening explicitly rather than letting it happen silently. Good news: `mcp-server-brain/server.cjs` is already Express + `StreamableHTTPServerTransport`, stateless (`sessionIdGenerator: undefined`), `POST /mcp`, Bearer auth against Supabase `brain_api_keys`, deployed by `render.yaml`. That is most of what a ChatGPT custom connector needs. Real gaps: confirm ChatGPT accepts a static Bearer key rather than requiring OAuth; `plan: free` on Render will cold-start and read as a broken app; and with no skills channel on ChatGPT, tool descriptions become the ONLY carrier for Larry's voice, which makes D-03 load-bearing rather than advisory.
- **Agent Plugins 1.0.0 packaging.** Worth scoping as its own phase. The 234 host survey predates the standard entirely and under-weighted Codex (7 mentions) and OpenAI (3) against Zed (106). Codex is now the closest non-Anthropic host to full parity.
- **D-04 re-examination for Codex.** D-04 said hooks are not portable enough to carry governance. Still true for MCP-scoped hooks. Now partially stale for Codex generally, which does have SessionStart, UserPromptSubmit, Stop, PreCompact, PostCompact and SubagentStop.

## 8. Sources

- Agent Plugins spec: https://github.com/agentplugins/agent-plugins-spec and https://agent-plugins.org/
- Vercel announcement: https://vercel.com/blog/introducing-agent-plugins
- Codex customization docs: https://learn.chatgpt.com/docs/customization/overview
- Codex hooks: https://deepwiki.com/openai/codex/3.11-hooks-system and https://agenticcontrolplane.com/blog/codex-cli-hooks-reference
- ChatGPT developer mode and MCP: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
