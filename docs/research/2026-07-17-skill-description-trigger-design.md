# Skill-Description Trigger Design -- generic, transferable insight (pending Brain ingestion)

- **Date**: 2026-07-17
- **Status**: verified in production, blocked on Brain admin-key ingestion
- **Origin**: Phase 230 (MindrianOS Skill Fleet Optimization), `docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md`
- **Brain write attempted, blocked**: `brain_query`/`brain_write` require an admin key this session's Brain MCP connection does not carry ("Contact Jonathan for elevated access"). This file is the durable, ready-to-ingest staging copy until a session with that key can run the actual write. See the companion todo: `.planning/todos/pending/2026-07-17-ingest-skill-description-insight-to-brain.md`.

## The insight (generic -- applies to any agent-skill system using progressive disclosure, not MindrianOS-specific)

An AI agent's skill/tool description is the entire routing signal before the agent decides to load anything more -- get it wrong and the skill silently never fires, or fires when it shouldn't. Four principles:

1. **State WHAT and WHEN, not just capability.** A description naming only what a skill does reads as a blurb; an agent needs the trigger conditions -- the situations, phrasing, and intent that should invoke it -- to actually route correctly.
2. **Near-miss siblings need explicit differentiation.** In any dense namespace (multiple skills doing adjacent things), a vague description loses to a sharper sibling's description on genuinely ambiguous queries -- not a bug in the routing, a gap in the wording.
3. **Test against the full candidate roster, not one skill in isolation.** Grading a description alone cannot see competitive collisions -- two skills fighting over one query. Judging the SAME query against every candidate at once is the only way to catch it, and it is cheaper too (one roster-wide call beats N isolated calls).
4. **Revisions need a held-out validation set.** A description "improvement" that only helps the training queries can silently break phrasing that used to work -- real gain must be measured on queries never used to write the fix, selecting the best iteration by validation pass-rate, not the last one produced.
5. **Write in third person.** The description is injected into the system prompt alongside every other skill's metadata; inconsistent point-of-view ("I can help you...", "You can use this to...") measurably causes discovery problems. Always "Processes X and generates Y," never framed as address to or from the user.

## Verification: this is not just filed prose -- it is already load-bearing, verified 2026-07-17

Four of five principles are frozen, verbatim, in the shipped Phase 230 rubric files that actually run in production today; the fifth is a genuine, small, fixable gap, disclosed rather than glossed over:

| Principle | Where it lives | Verbatim confirmation |
|---|---|---|
| 1. WHAT + WHEN | `references/methodology/skillopt-revise-rubric.md` | "Write it as a routing rule, not a tagline... 1. WHAT the skill does... 2. WHEN to invoke it" |
| 2. Near-miss differentiation | `references/methodology/skillopt-queries-rubric.md` | "The highest-value negatives are near-misses: a query that shares keywords with a SIBLING in this same family but actually needs the different sibling... spend your best effort here" |
| 3. Roster-wide testing | `references/methodology/skillopt-judge-rubric.md` | "You stand in for progressive disclosure... you receive the FULL MindrianOS skill roster... Predict which ONE skill would actually fire" |
| 4. Held-out validation | `references/methodology/skillopt-revise-rubric.md` | "You never see the validation-set queries or their results... if you could see it you would overfit to it and the check would be worthless" |
| 5. Third-person writing | **not yet in `skillopt-revise-rubric.md`** | Grepped for "third person" / first-/second-person phrasing instruction -- absent. A model-generated rewrite could technically drift into first/second person. Small, one-line fix; not applied here because Plan 230-07's live smoke run may be reading this exact frozen rubric file while it executes -- editing a shared frozen instruction mid-run risks an inconsistent evaluation. Follow-up, not forgotten: see the todo below. |

Grep-verified directly against the files, not asserted from memory (2026-07-17, this session).

## External research (verified 2026-07-17, live fetch/search, not from memory)

**Principle 1 (WHAT + WHEN) -- directly confirmed by the primary source.** Anthropic's own skill-authoring guidance states it almost verbatim: "The `description` field enables Skill discovery and should include both what the Skill does and when to use it... Be specific and include key terms. Include both what the Skill does and specific triggers/contexts for when to use it." (`platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`, "Writing effective descriptions" section). The same page adds one convention this write-up had not captured: **always write in third person** ("Processes Excel files and generates reports", never "I can help you..."), because the description is injected into the system prompt and inconsistent point-of-view causes discovery problems.

**Principle 2 (near-miss differentiation) -- directly confirmed.** agentskills.io: "the most valuable negative test cases are near-misses -- queries that share keywords or concepts with your skill but actually need something different... these test whether the description is precise, not just broad." (`agentskills.io/skill-creation/optimizing-descriptions`, "Should-not-trigger queries").

**Principle 3 (roster-wide testing) -- this is original synthesis, not a restatement of the source methodology, and the write-up should say so plainly.** agentskills.io's own reference implementation tests one skill in isolation (`claude -p "$query"` with a single target skill installed, checking whether that one skill's tool_use fires). Testing every candidate against the full roster at once, so competitive collisions are visible, was this project's own refinement on top of that baseline -- not something agentskills.io itself recommends. It does have real academic grounding in a different literature: LLM-routing research frames the same architectural choice as **multi-label classification (all candidates scored against one query at once) versus independent per-candidate binary classifiers** (arXiv 2502.00409, "Doing More with Less: A Survey on Routing Strategies for Resource Optimisation in LLM-Based Systems"; the CARGO confidence-aware-routing framework, arXiv 2509.14899, uses the same single-pass-scores-all-candidates shape). The trade-off named in that literature is exactly the one this project made: full-roster scoring costs one call instead of N, and it is the only shape that can see a candidate stealing another candidate's query.

**Principle 4 (held-out validation) -- directly confirmed, and Anthropic's own guidance independently converges on the same discipline from a different angle.** agentskills.io's train/validation split is the direct source (already cited). Separately, Anthropic's best-practices page prescribes "Build evaluations first... establish a baseline... iterate" as its own eval-driven development loop -- a sibling discipline (measure before and after, never just "does it feel better"), though scoped to skill *usefulness* generically rather than description *trigger-accuracy* specifically.

**Gap this surfaced, worth flagging honestly (not yet in the Phase 230 harness):** Anthropic's checklist explicitly requires testing a skill "with Haiku, Sonnet, and Opus" -- description effectiveness can vary by model tier ("What works perfectly for Opus might need more detail for Haiku"). Phase 230's harness uses different models for different pipeline *roles* (haiku for inventory, sonnet for the judge, opus for adversarial review) but does not test whether a given skill's description triggers consistently across the *end-user's* model tier. Not fixed here -- logged as an honest limitation for whoever picks up the next iteration.

## Related graph content

Brain already holds generic skill-authoring / progressive-disclosure material (T3, `prior_art` tier, e.g. the `skill-creator` chunk and progressive-disclosure explanation surfaced via `brain_search` this session). This insight extends that material with the pieces it does not yet cover: the third-person writing convention, roster-wide competitive testing (#3, with the honest note that it is original synthesis, not sourced from agentskills.io itself), held-out-validation-gated revision (#4), and the cross-model-tier testing gap.

## Sources
- `docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md`
- `.planning/phases/230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur/230-AI-SPEC.md`
- `references/methodology/skillopt-queries-rubric.md`, `skillopt-judge-rubric.md`, `skillopt-revise-rubric.md` (Phase 230, plans 230-02/230-03)
- Anthropic, "Skill authoring best practices": https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices (fetched live 2026-07-17)
- agentskills.io, "Optimizing skill descriptions": https://agentskills.io/skill-creation/optimizing-descriptions (fetched live this session)
- "Doing More with Less: A Survey on Routing Strategies for Resource Optimisation in LLM-Based Systems": https://arxiv.org/pdf/2502.00409
- "CARGO: A Framework for Confidence-Aware Routing of Large Language Models": https://arxiv.org/pdf/2509.14899
