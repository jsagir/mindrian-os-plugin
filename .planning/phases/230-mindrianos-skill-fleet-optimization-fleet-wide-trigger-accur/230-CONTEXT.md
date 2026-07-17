# Phase 230: MindrianOS Skill Fleet Optimization - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Source:** superpowers:brainstorming session (context explored, clarifying questions asked and answered one at a time, design proposed and approved this session) -- formalized here in the standard CONTEXT.md shape rather than run again through `/gsd-discuss-phase`, since the decisions below are already locked, not open.

<domain>
## Phase Boundary

A fleet-wide skill-quality pipeline for MindrianOS-Plugin's own 124 `SKILL.md` files (`skills/` in this repo only -- not other installed plugins). Two independent workstreams merge into one human-gated report; nothing auto-applied to any real `SKILL.md` or script.

</domain>

<decisions>
## Implementation Decisions

### Scope
- Full fleet, all 124 skills, not a smaller pilot (explicit navigator choice over a pilot-subset option).
- Workstream 1 (trigger-accuracy) covers all 124 skills. Workstream 2 (code-quality) covers only the ~10-20 skills backed by real `scripts/*.cjs` machinery, identified by the inventory step (grep for `scripts/*.cjs`, `bin/*.cjs`, `Workflow(` references in each SKILL.md body).

### Rigor / approach
- Judge-funnel first, real-test only flagged skills (explicit navigator choice over both "full literal trigger-test on all 124" and "judge-funnel only, no code-quality bundling"): a cheap roster-wide LLM-judge pass scores every generated eval query against the FULL 124-skill roster at once; only skills with a train-set miss (or a low-confidence judgment) escalate to agentskills.io's literal real trigger-test loop (actual Skill-tool invocation, train/validation split, up to 5 description-revision iterations, best-by-validation selected).
- Code-quality review for the script/workflow-backed subset rides in the SAME pipeline run, independent of a skill's trigger-flag status -- not gated behind trigger flagging.

### Safety / output
- Nothing is auto-applied. Every proposed change (description rewrite or code-quality finding) lands in the pipeline's own report/output only. Real writes to `SKILL.md` or `scripts/*.cjs` happen only after explicit, itemized human approval -- batched or per-skill, navigator's choice at that point.
- No silent skip: a query-generation failure, judge timeout, or agent crash is recorded explicitly as `not_evaluated` with its reason, never absorbed as a pass or no-finding. This directly answers two already-logged silent-skip incidents in this repo's own memory (`feedback_false_success_silent_skip_gates_academy_testers.md`) and is Critical Failure Mode 3 in the AI-SPEC.
- Code-quality findings are adversarially verified (a second, independent pass tries to refute each finding) before being reported -- only CONFIRMED/PLAUSIBLE survivors appear.

### Execution mechanism
- No `Workflow`-tool call in this phase. Fleet-wide execution (the actual 124-skill run) is explicitly deferred to a future step requiring the user's own explicit multi-agent-orchestration opt-in, per this session's tool-use constraints -- this phase builds and smoke-tests the harness, it does not itself trigger the full paid run.
- Framework: Claude Agent SDK / Claude Code native agent-orchestration primitives (subagents, the `Skill` tool, hooks, MCP) -- zero new third-party AI framework, locked in `230-AI-SPEC.md` Section 2 with full rationale and alternatives-considered table.

### Claude's Discretion
- Exact per-family batching strategy for eval-query generation, exact concurrency pool size (guardrailed to 3-4 in the AI-SPEC to avoid 429 storms), exact on-disk artifact layout under `.planning/phases/230-.../out/` -- these are implementation details not raised as open questions during brainstorming, left to the planner/executor within the AI-SPEC's guardrails.

</decisions>

<specifics>
## Specific Ideas

- Near-miss eval queries should exploit REAL sibling confusion in this repo's own dense namespace families (e.g. `mos:find-connections` / `mos:find-analogies` / `mos:find-bottlenecks`; `mos:explore-domains` / `mos:explore-trends` / `mos:explore-futures`), generated per-family (one agent sees every skill in a family at once) rather than per-skill in isolation.
- The check-card-fire.cjs over-enforcement bug already logged three times this session (`.planning/todos/pending/2026-07-05-fix-stop-hook-forcing-irrelevant-decision-gate-cards.md`) is the concrete worked example of exactly the code-quality finding class Workstream 2 exists to catch systematically.
- Smoke-test the harness on a small handful of already-known skills before spending the full 124-skill budget -- implementation hygiene, not a re-opening of the "full fleet" scope decision.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design
- `docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md` -- the full approved design (architecture, data flow, error handling, testing/rollout-safety, output artifacts, out-of-scope). Authoritative source for scope and behavior; this CONTEXT.md summarizes it, does not replace it.

### AI Design Contract
- `.planning/phases/230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur/230-AI-SPEC.md` -- framework decision + rationale (Section 2), implementation guidance including the real Skill-fire detection mechanism and a documented CLI envelope pitfall (Section 3/4), domain context and rubric (Section 1b), evaluation strategy / guardrails / production monitoring (Sections 5-7). Locks technical approach before planning.

### In-repo precedent (reuse-before-build, Canon Part 7)
- `scripts/huji-run-one.cjs`, `scripts/huji-batch.cjs`, `lib/core/pitch-feedback-schemas.cjs` (Phase 229 HUJI pilot) -- the proven spawn/schema/stream-json pattern this phase's implementation should mirror, per the AI-SPEC's own research.
- The repo's existing `code-review` skill pattern -- reused for Workstream 2 rather than a net-new reviewer.

</canonical_refs>

<deferred>
## Deferred Ideas

- The actual fleet-wide `Workflow`-tool run (spending the ~800-1,000+ funnel calls across all 124 skills) -- explicitly out of scope for this phase per the design spec; requires the user's own explicit opt-in when it happens.
- Any auto-apply of proposed description rewrites or code fixes -- explicitly out of scope; always human-gated.

</deferred>

---

*Phase: 230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur*
*Context gathered: 2026-07-17 via superpowers:brainstorming, formalized into CONTEXT.md ahead of /gsd-plan-phase*
