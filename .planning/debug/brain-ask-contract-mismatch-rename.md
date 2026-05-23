---
status: gathering
kind: rca
trigger: "brain-ask-contract-mismatch-rename"
issue_id: ""
severity: low
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [3, 8, 10]
created: 2026-05-23T04:21:06Z
updated: 2026-05-23T04:21:06Z
---

## Current Focus

hypothesis: `brain_ask`'s tool description sets the wrong expectation. The verb "ask" reads to any new user (and any LLM consumer of the tool registry) as "ask a question, get an answer." The tool actually returns a DirectiveEnvelope -- a routing decision, GUIDED mode, framework chain suggestions -- not a synthesized answer. That is the intended contract per Phase 127 + Canon Part 10 (Larry IS the product, conversation IS the surface, methodology routing is the work), but the description does not say so out loud.
test: re-read the description string at `mcp-server-brain/lib/brain-ask.cjs` line 506 against the Windows beta-tester transcript from the 2026-05-23 post-fix sweep, which flagged the contract mismatch in those exact words.
expecting: confirmed -- the description tells the consumer to "ask the Brain anything in natural language" and "use this instead of brain_query or brain_search," neither of which prepares the consumer for the routing-envelope payload shape.
next_action: ship a two-line description rewrite naming the actual return contract -- routing envelope, not synthesized answer.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: 1.13.0-beta.25
- Reported by: Windows beta-tester pass (2026-05-23 end-to-end Brain test)
- Date first observed: 2026-05-23
- Related debug sessions: brain-ask-empty-envelope.md (resolved, .planning/debug/resolved/) -- the SEMANTIC fix landed on the wire; this is the COSMETIC follow-up on the description string

## Problem Statement

`brain_ask`'s MCP tool description tells consumers they will get an answer to a natural-language question. The tool actually returns a methodology routing envelope. The wire behaves correctly; the description sets the wrong expectation, which surfaces as a silent-degradation experience on first contact with the tool.

## Symptoms

expected: The tool description prepares the consumer (human or LLM) for a routing-envelope payload -- "returns a DirectiveEnvelope with a framework recommendation and a chain of follow-up frameworks", not "returns an answer."
actual: The tool description opens with "Ask the Brain anything in natural language. Returns a DirectiveEnvelope payload (populated directive + next_gate + mode_signals) synthesized from the teaching graph, plus supporting search results." The verb "ask" + the framing "ask anything" + the phrase "synthesized from the teaching graph" all read as synthesized-answer semantics. The "DirectiveEnvelope" technical noun comes later and is not glossed.
errors: None. No exit code. No stack. No log entry. The mismatch surfaces as user confusion only.
reproduction:
  1. Fresh Claude Desktop session, plugin installed, Brain MCP connected.
  2. Tool palette shows `brain_ask: Ask the Brain anything in natural language...`
  3. Consumer asks "What framework should I use for a wicked problem at discovery stage?"
  4. Tool returns a DirectiveEnvelope: `directive.guided.framework = "..."`, `next_gate.options = [...]`, `mode_signals.mode = "GUIDED"`.
  5. Consumer expected a synthesized answer; receives a routing decision instead.
started: At the original brain_ask handler ship (pre-Phase 127). The description string has been stable since then; the Phase 127 server-side directive synthesis (commit c40afc71, 2026-05-22) added the DirectiveEnvelope payload but did not rewrite the description to match.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the tool description is the same string on all three; the mismatch is surface-agnostic)
- Affected commands: brain_ask (MCP tool); any LLM agent that reads the tool registry and routes user questions to brain_ask based on the description
- Affected users: ALL users on first contact with the tool, especially new users and LLM consumers that read tool descriptions to plan routing
- Version range: pre-Phase-127 (description stable) -- present (1.13.0-beta.25)
- Severity: low -- the wire is correct, the contract is correct, only the description is misleading. No code path breaks. The same mismatch shape as larger silent-degradation classes (the Python interpreter risk on fresh user machines), but at minimum severity.
- Blast radius: ALL consumers of the MCP tool description, because they form their mental model from this string. Includes the LLM that routes calls (Larry, sub-agents, persona-analyst, etc.).

## Eliminated

- hypothesis: The tool wire is returning the wrong payload shape.
  evidence: The Windows beta-tester sweep on 2026-05-23 confirmed `brain_ask` returns a valid DirectiveEnvelope ("brain_ask returned a DirectiveEnvelope (pedagogical routing), not a Brain-sourced answer"). The CH1-CH3 gates of the post-fix chain probe passed: populated envelope, framework name match against `brain_schema`, no regression of NF-1. The wire is correct; the description is the surface that needs the patch.
  timestamp: 2026-05-23T04:21:06Z

- hypothesis: The fix requires renaming the MCP tool from `brain_ask` to something else.
  evidence: Renaming the wire tool would break every existing consumer (the plugin's own commands, the Brain MCP client shim, any third-party MCP consumer). The cost of a wire rename is structural; the cost of a description rewrite is two lines. The mismatch lives in the description, not the name; fix the description, not the name.
  timestamp: 2026-05-23T04:21:06Z

## Evidence

- timestamp: 2026-05-23T04:21:06Z
  checked: live MCP tool description at mcp-server-brain/lib/brain-ask.cjs line 506 (the registerTool description argument)
  found: The string opens with "Ask the Brain anything in natural language. Returns a DirectiveEnvelope payload (populated directive + next_gate + mode_signals) synthesized from the teaching graph, plus supporting search results. Searches 23K methodology nodes and 12K semantic embeddings; automatically handles Pinecone semantic search with Neo4j Cypher fallback. Use this instead of brain_query or brain_search - it handles routing internally."
  implication: "Ask anything" + "returns a payload synthesized from the teaching graph" + "use this instead of brain_query or brain_search" reads as synthesized-answer semantics. The actual return contract (a routing envelope) is named with a technical noun, not described in plain language.

- timestamp: 2026-05-23T04:21:06Z
  checked: Windows beta-tester end-to-end sweep transcript (2026-05-23 ~20:31Z, jsagi)
  found: Tester reported "brain_ask returned a DirectiveEnvelope (pedagogical routing), not a Brain-sourced answer" with the explicit framing "the tool name reads to any new user (or any LLM) as 'ask a question, get an answer.'"
  implication: The mismatch is confirmed externally. The tester's mental model matched the description; the wire surprised them in a benign way. Same shape as Finding 2 (schema sprawl, the future-debugging tax) and the larger Python-on-Windows class (silent-degradation), at minimum severity.

## Technical Root Cause

- Site: mcp-server-brain/lib/brain-ask.cjs line 506 (the description argument to registerTool)
- Cause: The description was written for the pre-Phase-127 brain_ask surface (raw search-hits payload from commit dc363c54), then never rewritten when Phase 127 added server-side directive synthesis (commit c40afc71, 2026-05-22). The description names the new return shape (DirectiveEnvelope, directive + next_gate + mode_signals) but does not name what those terms mean to a first-contact consumer.
- Why it surfaces now: The Phase 127 commit chain landed and was verified on Windows on 2026-05-23. The wire change exposed the description mismatch -- the description was already wrong; the new payload made the wrongness visible.

## Required Code Changes

- Change 1:
  - Location: mcp-server-brain/lib/brain-ask.cjs line 506, the registerTool description argument
  - Current behavior: Opens with "Ask the Brain anything in natural language. Returns a DirectiveEnvelope payload (populated directive + next_gate + mode_signals) synthesized from the teaching graph, plus supporting search results."
  - Required behavior: Opens with a plain-language statement of the return contract: "Get a methodology routing decision for a natural-language question. Returns a DirectiveEnvelope -- a recommended framework + a chain of follow-up frameworks + a GUIDED/AUTONOMOUS/HYBRID mode signal -- NOT a synthesized answer to the question. For a synthesized answer, use brain_search for semantic retrieval or compose your own answer from the routing envelope's framework chain." Keep the curated-op MODE description intact (the second half of the current string covers list_frameworks / framework_edges / framework_chain_slice and is correct).
  - Short-term patch: The two-line description rewrite above.
  - Long-term fix: Per Phase 100 (jtbd-inference-engine, deferred to v1.14.0, sub-claim 4 of Canon Part 10), commands become internals and Larry routes via heuristic -- at that point the brain_ask tool description matters only to LLM consumers, not to users. The description rewrite is correct for both eras.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: mcp-server-brain/lib/brain-ask.test.cjs (new file if absent, else append)
  - Given: the MCP tool registry as loaded from registerBrainAsk(server)
  - When: the brain_ask tool description is read
  - Then: the description does NOT open with the verb "ask" in a sentence that promises an answer; the description DOES contain the phrase "routing decision" or "routing envelope" or equivalent; the description DOES say "NOT a synthesized answer" or equivalent disclaimer
  - Runner registration: register in mcp-server-brain/tests/run-all.sh (if it exists) or the Feynman runner per Phase 122 build-command-registry pattern

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under v1.13.0-beta.26 (or whatever version ships the rewrite): "brain_ask tool description rewritten to name the routing-envelope return contract (not a synthesized answer)."
- Release lockstep: standard 7-place lockstep applies on the next release. See .claude/includes/release-process.md.
- Canon: no canon text change. Reference Canon Part 10 sub-claim 1 (Larry IS the product) in the CHANGELOG entry.
- knowledge-base.md: on resolve, add the summary block under "brain-ask-contract-mismatch-rename" with error-pattern keywords (silent degradation, contract mismatch, tool description, DirectiveEnvelope, routing envelope, synthesized answer).

## MindrianOS gates

1. **Canon Part 8 (Graph Boundary):** Description string lives in the server-side handler that synthesizes the DirectiveEnvelope; the rewrite is plain English with no Cypher, no user content, no payload changes. No Part 8 surface touched.
2. **Tri-Polar (three surfaces):** CLI, Desktop, Cowork all read the same description from the MCP tool registry. A description rewrite propagates to all three by construction. Verify on CLI first; the rest verify-by-construction.
3. **Cross-platform:** Description is a static string; no platform-specific behavior.
4. **Release lockstep:** Applies on next release. Name it in the CHANGELOG entry.
5. **No em-dashes:** Description rewrite uses hyphens only.
6. **Reuse before build (Canon Part 7):** The fix extends the existing registerTool description argument; no new command, skill, agent, or hook added.

## Resolution

root_cause: <pending -- code change not yet shipped>
fix: <pending>
verification: <pending>
files_changed: <pending>
commits: <pending>
