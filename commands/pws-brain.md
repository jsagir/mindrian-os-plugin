---
name: pws-brain
description: "RETIRED TEST HARNESS (superseded 2026-07-22): compared the then-production mindrian-brain MCP against the neo4j-agent Aura Agent over Neo4j. Both routes are superseded by the unified pws-brain-mcp Memgraph backend. Kept for deliberate historical re-runs only."
help_jtbd: "Ask one generic methodology question and see how the production Brain and the experimental Aura Agent each answer it, side by side."
body_shape: E (Action Report)
body_shape_detail: two labeled answer blocks (A production Brain, B Aura Agent) plus a short observed-differences note
hitl_shape: "none"
hitl_why: "A read-only comparison report that runs one question through two backends and takes no navigator decision, so it reaches no genuine fork."
argument-hint: "<generic methodology question>"
serves_jtbd: ["audit-room"]
teaching: "When you want to see how the experimental Aura Agent answers next to the production Brain, /mos:pws-brain runs the same methodology question through both and shows the answers side by side. An evaluation harness, not a production surface."
disable-model-invocation: true
# Reward-before-investment (docs/reward-before-investment-rule.md): explicit opt-out.
# This is a RETIRED, deliberately-invoked evaluation harness, not a navigator entry
# flow, so it has no first variable reward to deliver and never will.
interactive_first_reward: --none (scripting only)
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - mcp__mindrian-brain__brain_ask
  - mcp__mindrian-brain__brain_search
  - mcp__mindrian-brain__brain_query
  - mcp__neo4j-agent__Larry
# --- Quick-260716-VFT CIRS R1 exclude (Canon Part 11) ---
# Born WIRED-or-EXCLUDED: this surface is declared EXCLUDED-with-reason, not left
# dark. It is a deliberately-run evaluation harness (mirrors /mos:agentshield's
# precedent), so it never reacts to a navigator problem-state and takes no reach
# on the spine.
connector:
  excluded: true
  reason: "RETIRED evaluation harness (declared 2026-07-16, superseded 2026-07-22). It compared the then-production mindrian-brain backend against the neo4j-agent Aura Agent candidate over the same live Neo4j graph. BOTH routes are now superseded by the unified pws-brain-mcp Memgraph backend, whose origin lib/core/brain-client.cjs defines once as its BRAIN_URL default (Phase 339 moves that origin from Memgraph to Theo; this reason string does not hardcode a host so it does not need updating again when it does). Kept on disk as historical reference for a deliberate re-run; fires no reach, opens no spine wire, never sensor-triggered (Part 11 R1 EXCLUDED-with-reason, mirrors /mos:agentshield)."
---

# /mos:pws-brain

> **RETIRED / STALE as of 2026-07-22.** Do NOT run this to learn how the Brain
> behaves today. BOTH routes compared below are superseded: route A's
> `mindrian-brain` MCP and route B's `neo4j-agent` Aura Agent both spoke to the old
> Neo4j graph. The live backend is now the unified `pws-brain-mcp` Memgraph service.
> In-repo proof the migration already shipped: `lib/core/brain-client.cjs` names
> that service's origin as its `BRAIN_URL` default, and its file header names it
> "step 4 of the 2026-07-22 Memgraph migration" (check that file, not this doc, for
> the current URL -- Phase 339 is moving it again, to Theo). A run of this harness
> therefore measures a backend pair production no longer uses. Everything below is
> preserved as historical reference for a deliberate re-run, not as live truth.

**EXPERIMENTAL.** This is a side-by-side evaluation harness. It runs the SAME
methodology question through two different routes to the SAME live Neo4j teaching
graph (Instance01, "PWS Framework - Mondrian") and shows both answers next to each
other.

- **Route A - the production Brain.** The shipped `mindrian-brain` MCP (Neo4j plus
  Pinecone vectors). This is the real Brain every user reaches.
- **Route B - the Aura Agent (internally named Larry).** The `neo4j-agent` MCP, one
  tool with five Aura sub-tools: `classify_problem_type`,
  `find_frameworks_for_problem_type`, `Text2Cypher`, `Search` over
  `MethodologyChunk` embeddings, and `find_commands_for_problem_type`.

This command exists to EVALUATE route B as a candidate alternative path. It is NOT
a production reach, it does NOT replace any Brain path, and it is never
sensor-triggered. The navigator invokes it deliberately or not at all.

## Part 8 Boundary (LOCKED)

BOTH backends may ONLY receive GENERIC methodology queries: framework names,
problem-type classifications, command names, and public topic terms. NEVER room
content, user artifacts, venture specifics, meeting text, or personal data.

This rule binds route B exactly as hard as route A. The Aura Agent is the same
graph behind a different door, and an evaluation harness gets NO boundary discount.

If the navigator's question carries room-specific or venture-specific material, do
NOT send it to either backend. Stop and ask for a generic reformulation, and offer
an example of how to genericize:

> \- Instead of naming the venture, ask the shape of the problem.
> \- Bad (venture-specific): "which frameworks fit Acme's B2B pricing rollout?"
> \- Good (generic): "which frameworks fit a market-sizing problem?"

Only once the question is generic does the run proceed.

## Pre-flight

Two availability checks. Either backend missing means STOP: a one-sided run is not
a comparison. Never silently degrade to a single backend and present it as a
comparison result.

**Check 1 - production Brain.** If the `mcp__mindrian-brain__*` tools are
unavailable:

```
x Production Brain not connected
  Why: the mindrian-brain MCP server is not reachable in this session
  Fix: connect the Brain MCP, then re-run /mos:pws-brain
```

**Check 2 - Aura Agent.** If `mcp__neo4j-agent__Larry` is unavailable:

```
x Aura Agent not available
  Why: this command needs the USER-LEVEL neo4j-agent MCP server, a dev-machine evaluation dependency that does NOT ship with the plugin
  Fix: add or enable the neo4j-agent server in your Claude Code MCP config, then re-run /mos:pws-brain
```

Both present -> proceed. Either absent -> stop with the matching error above.

## Run the comparison

Take `$ARGUMENTS` as the methodology question. If it is empty, ask for one generic
methodology question and stop.

Run the Part 8 screen above FIRST. Only after it passes, send the SAME question
text to both backends:

- **Route A** calls `mcp__mindrian-brain__brain_ask` with the question. If
  `brain_ask` errors, fall back ONCE to `mcp__mindrian-brain__brain_search` and
  LABEL the fallback in the output.
- **Route B** calls `mcp__neo4j-agent__Larry` with the IDENTICAL string in its
  query parameter, verbatim, no rephrasing. Rephrasing would invalidate the
  comparison.

Call A, then B. Do NOT merge, summarize, or cross-pollinate one answer into the
other's call. Each backend answers the same question cold.

## Present the report (Shape E)

Render one action report:

```
------------------------------
  Comparison: "[the question asked]"
------------------------------

  A. mindrian-brain (production)
  [route A's answer verbatim; note "(brain_search fallback)" if it fell back]

  B. neo4j-agent Aura Agent (experimental)
  [route B's answer verbatim]

  Observed differences
  \- Coverage: [which answer named more, or fewer, frameworks/commands]
  \- Grounding: [does each answer cite frameworks/commands that exist in the graph]
  \- Specificity: [which answer was more concrete vs more generic]
  \- Refusal / deferral: [did either backend refuse, hedge, or defer]
  \- [one more only if there is a real fifth difference]
------------------------------
```

Never declare a winner. Never grade. The navigator judges. State the observed
differences plainly and stop.

## Zone 4 (Action Footer)

> \- Note what you saw for the ongoing Aura Agent evaluation.
> \- Run another generic question -> /mos:pws-brain "<question>"
