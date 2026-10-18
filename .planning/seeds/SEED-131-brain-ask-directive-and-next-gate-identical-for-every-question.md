---
id: SEED-131
title: "brain_ask returns the same directive and next_gate for every question: _composeTheoAsk restates the chain of a guessed rung"
status: filed
priority: medium
filed: 2026-10-18
source: "debug session part8-egress-guard-name-class-blocks-unknown-tool-names (2026-10-18), second defect"
depends_on: lib/core/brain-client.cjs (_composeTheoAsk, _inferRungFromQuestion, ask), scripts/mindrian-brain-mcp-client.cjs (brain_ask tool), quick 260910-hni, Phase 339 compose, 354-09 (problem_type round trip)
promotes_to: a /gsd-quick for the description fix, or a phase slice for a real next_gate derived from the rows; the navigator decides.
---

# SEED-131: directive and next_gate do not depend on the question

## Problem

Seven brain_ask calls in one session returned the same DirectiveEnvelope: directive.framework "Four Lenses of Innovation", problem_type IllDefined (heuristic), and the same next_gate options (Four Lenses, JTBD, Cross-Disciplinary Thinking, Process Mapping). Only grounding.rows varied.

The plugin builds this, not Theo. Theo returns rows only (answer_mode structured_rows). The tool description at scripts/mindrian-brain-mcp-client.cjs:189 says directive and next_gate "are composed from the graph-grounded rows behind the answer plus a recommended framework chain". Only the chain feeds them. The rows feed grounding.rows alone.

## Evidence

- PROVEN (source read): scripts/mindrian-brain-mcp-client.cjs:193 calls `brainClient.ask(question)` with no problem_type. `ask()` in lib/core/brain-client.cjs passes `{ rung: opts && opts.problem_type }` to `_composeTheoAsk`, which is undefined here. `_composeTheoAsk` then takes the rung from `_inferRungFromQuestion`, a keyword table with default IllDefined ("which" and "should we" are IllDefined markers). It makes ONE `recommend_chain(rung, 4)` call and writes directive.guided.framework as the first option, directive.guided.stage as the rung, and next_gate.options as the chain. grounding.problem_type_source is "heuristic".
- PROVEN (stubbed run, no network): three different questions with three different row sets, all landing on IllDefined, gave identical directive and identical next_gate (3 of 3) and three different grounding.rows.
- Line numbers measured at HEAD 99bbbaa66: `_inferRungFromQuestion` at lib/core/brain-client.cjs:1123, `_composeTheoAsk` at :1198, `ask` at :1394.
- UNVERIFIED: how often a real question lands on a rung other than IllDefined. The marker table is the only input.

## Proposed direction

Pick one or combine:

1. Let the caller pass a structured problem_type. `ask(question, { problem_type })` already supports it (354-09). Add an optional `problem_type` field (closed enum Undefined, IllDefined, WellDefined, Wicked) to the brain_ask input schema. The calling model already classifies silently.
2. Derive next_gate options from the frameworks named in the returned rows, and use the chain only as a fallback.
3. Correct the tool description so it does not claim the rows feed the directive.

Option 3 is a one-line honesty fix and can land alone.

## Canon Part 8 impact

None on egress: the change is on the return path and a closed enum on the way out. A new input field must pass the typed-question gate (a closed enum value, no free text). Decision 8 (honest refusal everywhere) applies: a description that overstates what feeds the directive is a small honesty gap.

## Link

Debug session: .planning/debug/resolved/part8-egress-guard-name-class-blocks-unknown-tool-names.md
