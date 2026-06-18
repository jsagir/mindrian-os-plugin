---
kind: seed
status: open
created: 2026-06-17
canon_parts: [2, 4]
severity: high
surfaces: [cli, desktop, cowork]
proving_case: ~/MindrianRooms/aion-eureka-synergy (AION Eureka demo build, 2026-06-16)
qa_ref: .planning/debug/aion-eureka-demo-build-qa-session.md (F3)
source: dogfood (AION C08 demo build)
---

# SEED: Workflow final synthesis step is a single point of failure (no retry/fallback)

## Defect (observed)
Across the AION session, the final synthesis / opportunity-extraction agent failed
in THREE separate multi-agent workflows, each time on the load-bearing LAST step:
- `eureka-build-run`: `opportunities:arnon-jtbd` failed (API 500)
- `eureka-crossdomain-rs`: `opportunities:crossdomain-arnon` failed (API 500)
- `eureka-pattern-analogies`: `consolidate-eureka` failed (API 529 Overloaded)

All upstream parallel stages (research, validation, generation) SUCCEEDED. Only the
single terminal synthesizer died, and its structured output was lost. Recovery was
manual: re-derive the consolidation / re-extract opportunities by hand from the
partial results persisted on disk.

## Why it matters
The terminal synthesis step carries the most value (the brief, the opportunities,
the consolidated Eureka). A single transient 5xx on that one agent discards the
value of an entire workflow even though every other stage succeeded. The standing
"file findings as they rise" contract silently depended on hand-finishing. This is
a reliability gap in the Workflow runtime, not a one-off.

## Required capability (acceptance)
1. The final synthesis/opportunity step (and ideally any `agent()` call) supports
   bounded RETRY-with-backoff on transient 5xx (500/502/503/529).
2. On terminal failure after retries, the step returns a GRACEFUL PARTIAL result
   structured for downstream filing (not `null`), e.g. the upstream stage results
   plus a `synthesis_failed: true` marker, so the orchestrator can hand-finish or
   re-run from cache.
3. Surface the resume journal so a failed terminal stage can be re-run from cached
   upstream results without re-running the whole workflow (the resume-from-runId
   mechanism already exists and worked well - expose it for partial re-run).

## Test
- A workflow unit test that injects a 500 on the final `agent()` and asserts:
  (a) it retries N times with backoff, and (b) on exhaustion returns a structured
  partial (upstream results preserved), never `null`.

## Suggested approach (reuse-first, Part 7)
Extend the Workflow runtime's `agent()` with an optional `{retry, onExhaust}` and
default the terminal-stage to a small bounded retry. Reuse the existing
resume/journal substrate for partial re-run; do not build a new orchestration path.

## Patterns that WORKED (keep)
- resume-from-runId caching (stop a run, edit the script to insert a validation
  phase, resume - the unchanged research agents returned cached). Excellent.
- mid-run validation-phase insertion. Excellent. Preserve both.

---
**Related research (2026-06-18):** see `.planning/research/2026-06-18-orchestration-executor-dual-graph-conversation.md` + Phase 166 (gated-chain-executor). The Gated Chain Executor (runChain spine) is the runtime this seed assumes; that doc carries the full Q&A + 11-agent fan-out.
