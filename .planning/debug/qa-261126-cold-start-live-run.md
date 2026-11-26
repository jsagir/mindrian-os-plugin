---
kind: qa-sweep
type: qa-findings
classification: NEW FAILURE (F1-F10), all confirmed against installed v2.0.0-beta.91 code
date: 2026-11-26
source: two driven 20-turn runs on installed v2.0.0-beta.91 (one mock room copy, one live session bound to a real room)
scope: beta.87 to beta.91 changes (runtime core, goal job, decision advisor, cause-and-effect, job sentences, relay) plus defects found on the way
---

# QA 2026-11-26: cold-start live run, findings for one fix phase

## Context

A navigator session drove a second session (Larry, bound to a large real room: 431 notes, 3,830 claim nodes) for 20 turns, and a mock harness ran the same changes on a scratch copy. The beta.87 to beta.91 changes pass their own tests (41 of 41 test files). The defects below show up only on the live MCP path with a large, unratified room. The product goal the run tested: a cold user gets a right next move in minute one without an expert in the chair.

## Findings (each with the verified root cause)

F1. Goal-job offers and the goal card carry bare ids.
- Seen: `suggest_next` `goal_job.offers` is an array of 19 ids (`find-problem`, ...). The strategy_goal card shows only "Set this job" / "Not now"; the job id sits in a hidden preview.
- Root cause: `data/job-vocabulary.json` ships `summary` and `sentence` for 20 of 20 jobs, but nothing joins them into `goal_job.offers` (lib/mcp/tools/sensors.cjs goalJobFor) or the strategy_goal card.
- Fix: offers carry `{ id, label (summary), sentence }`; the goal card shows the plain job label and sentence.

F2. A set goal job ranks nothing when no nest is active.
- Seen: after the goal job was ratified, `suggest_next` returned `next_move.primary null`, reason `no_active_nest`. With `section` given, the same call returned a ranked move.
- Root cause: lib/mcp/tools/sensors.cjs resolveNextMove needs an active nest; nothing picks one for a cold user.
- Fix: when no nest is active and a goal job is set, pick the nest from data/section-job-canon.json (highest probe_confidence section for that job that exists in the room); report `nest_source: "goal_job_map"`.

F3. Cause-and-effect domain is inert on a default install.
- Seen: domain `complex` stored; moves and reasons unchanged. With MINDRIAN_DECISION_ADVISOR=on the order changes.
- Root cause: lib/workflow/command-resolver.cjs advisorOptsForRoom reads the domain only on the advisor-on path; the advisor ships off by owner ruling 2026-11-24.
- Fix (no ruling change): keep the advisor flag off; when a domain is set and the advisor is off, add a `domain_note` to the next move ("stored domain complex: probe first; the ranked moves are not domain-ordered") so the navigator is not told nothing. Flipping the flag stays an owner decision.

F4. With the advisor on, the shortlist and the alternatives disagree.
- Seen: advisor ranks beautiful-question, analyze-systems, causal; alternatives returned causal, user-needs (advisor #2 dropped, a ledger move mixed in). Same on prepare-pitch and validate-idea in the mock.
- Root cause: lib/core/feyminto/next-move.cjs merges the advisor primary with ledger alternatives.
- Fix: when the advisor state is ok, alternatives come from the advisor shortlist in its order; ledger moves follow only after them.

F5. Framework-name resolver is exact-match only.
- Seen: composeWorkflow(["Beautiful Question"]) -> command null, optional true. Only "Beautiful Question Framework" resolves. Same for "Beautiful Questions", "beautiful-question", "A More Beautiful Question".
- Root cause: lib/workflow/command-resolver.cjs registry lookup has no alias or normalization step; an unresolved step silently degrades to optional.
- Fix: normalize (case, hyphens, plural, trailing "Framework"), accept a command id, and return `unresolved: true` with a reason instead of a silent optional.

F6. context_assemble cortex leg ignores the budget.
- Seen: ~2,296,314 chars for the cortex leg at the defaults and at the tightest dial; one pull ~2.3M to 2.96M chars (~576k tokens). The estimate undercounts the real reply by ~650k.
- Root cause: lib/core/navigation/room-context.cjs legD selects all five cortex node types ORDER BY created_at DESC with no LIMIT and never reads the budget options.
- Fix: cap legD (new budget param `cortex_k`, default small) after recency ranking, report `top_k_cap` in `_meta.omitted` with the full count; make the estimate measure the same serialisation as the real reply.

F7. Neighbourhood traversal is outgoing-only.
- Seen: focus on a section (27 inbound BELONGS_TO, 0 outbound) -> no neighbours; graph_query also empty. An inbound WHITESPACE_DETECTED edge on a note is invisible.
- Root cause: lib/core/navigation/neighborhood.cjs NEIGHBORHOOD_SQL recursion joins `e.source = nh.id` to `e.target` only.
- Fix: walk both directions (union of source->target and target->source), keep edge direction in edge_path, keep ranking rules.

F8. The gap scan reads an unratified room as clean; no isolated-note check.
- Seen: whitespace_scan gap_count 0 in a room where 3,830 of 3,830 claims are `proposed` and 0 SUPPORTS edges exist; 72 notes have no INFORMS or CONVERGES edge.
- Root cause: lib/core/navigation/insights.cjs findUnsupportedClaims filters review_status IN ('confirmed','needs_evidence'); no detector for isolated artifacts.
- Fix: report unratified unsupported claims as a separate count (`unratified_unsupported`), never mixed into the ratified list (Part 9 holds), and add `isolated_artifacts` (artifact nodes with no INFORMS/CONVERGES/SUPPORTS edge in either direction).

F9. Eureka projection carries empty text for most nodes.
- Seen: eureka_graph_find_similar_unlinked_items on 50 ids: 47 empty_text_nodes; the key note was never compared.
- Root cause: the graph projection reads node text from node properties, and artifact nodes keep their body in the file, not in properties.
- Fix: when an artifact node has no text property, project a bounded excerpt of its file body (room-relative path, size cap), local only (no egress change).

F10. Gate cards ship without option descriptions or a recommended option.
- Seen: cause_effect stage 1 and stage 2 cards: every description null, recommended null; strategy_goal card has no plain job label (see F1).
- Root cause: lib/core/cause-effect-card.cjs option set has labels only.
- Fix: add a plain one-line description per option from data/cynefin-domains.json; no recommended option (the domain is the navigator's call).

## Smaller notes (fix if cheap, else seed)
- SENS-SHOW fires on the words "Show me" (read as share intent).
- Theo envelope: coverage status "partial" while coverage_label says "full".
- method_job is returned only for suggest_next's own primary, never for advisor picks.
- status_read has no egress segment.

## Out of scope (owner rulings)
- Flipping MINDRIAN_DECISION_ADVISOR to on by default (ruling 2026-11-24: opt-in until an independent measurement exists).

## Acceptance for the phase
A cold-start replay on a copy of a large room: offers show plain jobs; a set goal job returns a ranked move with no section given; context pull under a stated cap; a section focus returns neighbours; the gap scan reports unratified and isolated counts; "Beautiful Question" resolves.
