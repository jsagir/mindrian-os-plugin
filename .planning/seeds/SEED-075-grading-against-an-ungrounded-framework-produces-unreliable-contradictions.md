---
seed: grading-against-an-ungrounded-framework-produces-unreliable-contradictions
canon_parts: [12, 9]
status: proposed
created: 2026-07-25
source: same-day dev-repo review, this session (langtalks-graph-expert grounding check + Tavily corroboration, no room bound this session)
gated_on: a second live instance of the Stop-gate/contradiction pipeline grading content against an external framework claim that also turns out to be under-evidenced, OR a decision to formalize a framework-grounding pre-check in contradiction_check/stop_gate_check
---

# SEED-075 — A contradiction glyph that grades content against a claimed framework can't tell "framework is real but re-worded" from "framework is asserted but empty," because nothing checks the framework's own grounding first

## Where this came from

Same-day thread as SEED-074, different angle. A Stop-gate output graded some room content
against an article's own "Then → Now" framework — two axes, `rules → judgment` and
`examples → interfaces` — and surfaced a yellow contradiction glyph. Per this file's own
"Consult langtalks-graph-expert During Dev Work (MANDATORY)" rule, checked the framework
itself against the corpus before trusting the contradiction as signal, then widened the
check to a live Tavily sweep at the user's explicit request ("add tavily search that will
help guide the seed with why and how").

## What the grounding check found (langtalks-graph-expert, real tool calls, not memory)

- `judgment` as an entity: not in the corpus at all. `get_entity("judgment")` → `found:
  false`, zero citations, zero edges.
- `rule` is real: 4 citations (Text-to-SQL ep42, Qodo Memory ep57 w/ Itamar Friedman, two
  Memgraph research clips). But `multihop_query(rule, judgment)` → zero shared episodes, and
  `relationship_path` → `found: false`, 0 hops. No connection exists in the graph.
- `examples` is real too: 4 citations (LangGraph ep33 w/ Eden Marco, Almog Baku's LLM
  app-dev guide ep35, Text-to-SQL ep42, one research clip). One single-hop, auto-extracted
  edge does exist — `examples --alternative_to--> "Design interfaces"` — but the target node
  itself has zero citations of its own. An orphan, extracted once, never independently
  discussed.
- Neither axis has one shared episode backing it as a coherent, single-source Then→Now claim.

## Tavily corroboration — the two axes are NOT equally weak (this is the actual finding)

Ran it wider than the podcast corpus on purpose, two searches:

1. Exact-phrase match for the framework's own wording (`"rules to judgment" "examples to
   interfaces"`) returns nothing that is this framework — only generic "how to write AI
   coding agent rules" content (aicodingrules.org, Cursor/CLAUDE.md rules guides,
   agentrulegen.com). The framework's specific wording is not a recognized, citable term
   anywhere on the open web either.
2. The idea behind axis 1 IS real and current, just phrased differently. Kognitos's 2026
   RPA-to-agents guide frames the identical move as "Instruction-Based → Goal-Based" /
   "micromanaging → delegating": *"RPA operates on a strict If-This-Then-That logic... AI
   Agents are Goal-Based... This shift from micromanaging to delegating is the key to
   unlocking the next tier of operational efficiency."* That's `rules → judgment` in
   different words, live, dated, and credible.
3. Axis 2 has no such corroboration anywhere in the sweep. logic.inc's 2026 agent-build
   guide lists few-shot examples as a still-current, actively-used technique — *"dynamic
   learning... retrieves similar examples as few-shot context at inference time. The agent
   gets better as it processes more inputs"* — not something already being retired in favor
   of "interfaces."

So the two axes fail differently. Axis 1's corpus gap was a vocabulary gap — the real trend
exists, this article just didn't use the industry's actual words for it. Axis 2's gap looks
like a substance gap — nothing, in the podcast corpus or the wider sweep, backs "examples are
being replaced by interfaces" as a real, current move.

## The gap this exposes in MindrianOS's own pipeline

A contradiction-surfacing pass that grades content against a claimed external framework, then
reports one contradiction glyph, currently can't distinguish those two failure modes from each
other. Today nothing in the Stop-gate / `contradiction_check` path checks the target
framework's own grounding before treating a mismatch against it as signal — the pipeline
trusts the framework's premise and only checks consistency against it, not whether the
premise itself holds up. That's a real, present-tense gap in judgment quality, independent
of how often it actually produces a wrong verdict.

## Why this is a SEED, not a phase

One instance, same day, not yet a repeated pattern. Canon Part 7 (Reuse Before Build) says a
single felt need doesn't clear the bar for a new pre-check wired into the contradiction
pipeline. This also lands squarely in the standing WATCH already open in personal memory
(`feedback_false_success_silent_skip_gates_academy_testers.md` — recurring bug class: silently
skipped gates, false room-status claims, false tool-success reports) — this is a fresh,
adjacent instance of that same family (false *contradiction*-confidence, not false success),
worth logging there too rather than treated as a one-off.

## Suggested first move, if anyone picks this up before the gate opens

Cheapest next action, not a new pre-check itself: when a contradiction is graded against an
external framework or article, log which axis of that framework was actually checked for its
own grounding (langtalks-graph-expert / Tavily / whatever's relevant) and surface that
alongside the contradiction glyph — so "we checked the premise" becomes visible by default,
instead of something a human has to explicitly ask for, the way this SEED itself only
happened because the user said "review it."

## Cross-references

- `.planning/seeds/SEED-074-local-graph-read-layer-lacks-salience-and-query-time-joins.md` —
  same-day sibling, same "verify the source before treating a mismatch as signal" instinct,
  applied to a crate/paper instead of a graded framework claim.
- `feedback_false_success_silent_skip_gates_academy_testers.md` (personal memory,
  `~/.claude/projects/-home-jsagi/memory/`) — the standing WATCH this SEED is a fresh instance
  of.
- `CLAUDE.md` "Consult langtalks-graph-expert During Dev Work (MANDATORY)" — the rule this
  SEED's own review followed.
- This session's live tool calls: `langtalks-graph-expert` (`get_entity`, `multihop_query`,
  `relationship_path` on `rule`/`judgment`/`examples`/`Design interfaces`); Tavily
  `tavily_search` (advanced depth) — exact-phrase sweep, then a year-scoped industry sweep
  (plus8soft.com, mightybot.ai, vellum.ai, faros.ai, logic.inc, kognitos.com).
- Canon Part 12 (Pedagogy — grading and contradiction-surfacing are measured by reliability,
  not just by firing), Part 9 (Memory Locality — `contradiction_check` reads through
  `navigation.cjs`, the chokepoint any future pre-check would also have to respect).
