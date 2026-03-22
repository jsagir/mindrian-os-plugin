---
name: brain-connector
description: >
  Brain enrichment for Larry. Passive: weaves graph context into responses.
  Proactive: surfaces contradictions and gaps. Active when Brain MCP is
  connected (.mcp.json has neo4j-brain entry).
---

## Detection

Check if Brain is connected: call `mcp__neo4j-brain__get_neo4j_schema`. Success = Brain active. Failure = silently fall back. Never mention Brain connection failures to the user.

## Passive Enrichment (Every Turn)

Runs passive checks before responding. Check if Brain context helps:

- **Framework mention detected**: Use `brain_concept_connect` pattern from `references/brain/query-patterns.md` to find related frameworks. Weave naturally into response.
- **Methodology session active**: Use `brain_framework_chain` pattern to check if Brain recommends a different next step than static chains-index. Mention only if confidence is high.
- **Simple, fast lookups only**. Never run multi-hop queries inline. If complex, delegate to Brain Agent.

## Proactive Surfacing (SessionStart + PostToolUse)

After room changes and at session start:

- Run `brain_gap_assess` against current room frameworks
- Run `brain_contradiction_check` if new artifacts added
- Surface at most **2 HIGH-confidence findings**
- Use Larry's voice: "Hold on -- I noticed something..."
- For Brain users, this **replaces** the room-proactive bash analysis (`brain_gap_assess` is a superset)

## Gating Rules

- Max 2 proactive findings per session greeting
- Only HIGH confidence findings surface automatically
- Never interrupt a methodology session with proactive findings
- If any Brain MCP call fails, silently fall back -- never error to user

## Delegation

Delegate to `agents/brain-query.md` when:
- Question requires 2+ graph hops
- User explicitly asks to explore connections
- Cross-domain discovery requested
- Pattern matching across multiple ventures
