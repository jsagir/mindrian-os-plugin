---
kind: seed
status: open
severity: high
created: 2026-07-18
canon_parts: [8, 10]
related: [SEED-063 (OpenCode host runtime), SEED-064 (Grok Build runner-up), SEED-065 (MCP ceiling), SEED-067 (subscription passthrough forbidden) -- 062 is the finding those four all depend on]
proving_case: "Full-tree audit of the shipped plugin artifact (v1.15.3-beta.24) 2026-07-18. lib/ = ~236,000 lines across 798 .cjs files, zero Claude-Code-specific imports, runs under bare node. commands/ + skills/ + agents/ = ~132,000 lines of markdown (111 commands, 124 SKILL.md, 9 subagents). The two files that look like an execution engine are not one: lib/workflow/command-resolver.cjs::composeWorkflow self-documents as 'Read-only: executes nothing'; lib/core/chain-executor.cjs::runChain requires a caller-supplied onStep, and the only two implementations in the codebase either log a no-op memory event (lib/mcp/tools/chain.cjs::makeDefaultOnStep) or hand off to a Claude Code Task-subagent reading agents/framework-runner.md."
source: "navigator question 2026-07-18 ('maybe MindrianOS should be a CLI?'). The audit run to answer it returned a more fundamental finding than the question asked for, and reframes every host-runtime decision downstream."
---

# SEED-062: The engine gap -- there is no agentic runtime in this codebase

## What's actually open

Nothing in 236,000 lines of `lib/` takes a framework name and produces a Lean Canvas.

**Claude Code is not hosting MindrianOS. Claude Code is executing it.**

The system decomposes into three parts, and the third is missing:

```
236K lines Node CJS  ->  portable substrate     graph/SQLite, memory, gating,
                                                MCP tools, statusline builders.
                                                Zero Claude-Code imports.
                                                Runs on bare node TODAY.

132K lines markdown  ->  the methodology        111 commands, 124 SKILL.md,
                                                9 subagents. Where the product
                                                actually lives.

      ???            ->  the thing that reads   DOES NOT EXIST IN THIS REPO
                         the markdown and acts
```

`runChain` is a genuinely good gated control loop -- budget brake (`maxSteps`, default
25), posture-based auto-run/halt, forced-material detection, retry/backoff, journal and
resume via `pipeline-state.cjs`. It is an engine block with no combustion in it. The
`onStep` callback that would do cognitive work is the caller's responsibility, and no
caller in this repo supplies a real one.

## Partial exception -- do NOT over-claim "zero LLM calls"

MindrianOS *does* call an LLM directly, in narrow bounded spots, via hand-rolled raw
`fetch` to `api.anthropic.com` (`x-api-key`, Haiku, heuristic fallback when no key is
set, no `@anthropic-ai/sdk` dependency):

- `lib/core/mva-classifier.cjs::_callHaiku` -- the project-wide idiom
- `lib/core/graph-derivation.cjs`, `lib/core/graph-candidate-producer.cjs`
- `lib/core/eureka/entity-classifier.cjs`
- `lib/chat/fabric-chat.cjs` (BYOAPI, NL-to-SQL)
- `lib/core/llm-name-suggester.cjs`, `lib/agents/mva/*.cjs`

Single-shot classifiers only. The pattern for a real inference layer is understood and
partially built -- it has never been generalised to a sustained, tool-using, multi-turn
loop that runs a methodology session or holds Larry's voice.

## Why this matters more than it sounds

It is not a criticism. It is the reason the extraction question has a cheap answer.

If the missing piece were the graph engine or the memory layer, we would be sunk --
nobody open-sources our substrate. The missing piece is **an agent loop**: read markdown
instructions, run a tool-use loop, spawn subagents, manage context, hold a conversation.
That is the single most commoditised component in the industry right now.

**We have been building the best possible payload for someone else's engine.** Payloads
are portable. Engines are rentable. See SEED-063.

## Do NOT

- Plan a standalone binary without budgeting for an agent loop. It does not exist here
  and it is not a small piece.
- Read the 55/45 portable-vs-bound line-count split as encouraging. The LOC ratio is
  misleading: the ~45% that is Claude-Code-bound contains the part that generates the
  product's output.
- Assume `runChain` or `composeWorkflow` can be pointed at a new host and "just run."
  They plan and gate. They do not execute.
