# Radar Absorption 265: The Decision Record

Phase 138 died as an orphan on disk because its reasoning lived nowhere durable -- a
markdown table inside one phase's own CONTEXT.md, invisible to every tool and every
later reader. This document is Phase 265's answer: every judgment call this phase made,
in one place, cross-linked to `data/capability-ledger.json`. Supersede-never-delete
discipline applies here too -- nothing in Phase 138 or SEED-003 was erased, only marked
(see `.planning/phases/138-capability-radar-absorption-and-routing/138-CONTEXT.md` and
`.planning/seeds/SEED-003-claude-code-2-1-x-capability-adoption.md`).

## 1. A4 is settled

SEED-003's A4 ("Forked Subagents + Per-Agent `mcpServers`") and Phase 138's `a4_reeval`
both framed forked-subagent adoption as an open probabilistic question -- Phase 138's own
words: Opus dynamic workflows "likely SUPERSEDE" the fork path, and "this phase DECIDES
adopt-vs-supersede before any fork-subagent harness is built." That framing is wrong as of
Claude Code **2.1.232**: subagent forking is now on by default. There is nothing left to
decide. No hand-rolled harness ships, and none was ever going to be needed -- a repo-wide
grep for `CLAUDE_CODE_FORK_SUBAGENT` returns exactly two hits, both in stale reference
docs (`references/capability-radar/changelog-cache.md:45`,
`references/capability-radar/capabilities-index.md:127`), zero in `lib/`, `scripts/`,
`agents/`, `commands/`, `hooks/`, or `bin/`. Nothing in shipped code ever assumed the old
opt-in gate existed.

The variable itself still exists, but its polarity inverted: `CLAUDE_CODE_FORK_SUBAGENT=0`
now opts OUT of fork mode in every kind of session; `=1` opts IN for non-interactive
sessions and the Agent SDK, where the default is still off. A reader following the stale
reference docs today would set the variable believing it enables something already on by
default.

Phase 138-04's no-literal tripwire pattern is kept, for the opposite reason it was
originally written: the original tripwire (`tests/test-a4-supersede.cjs`) asserted the
literal's absence as evidence adoption had NOT happened. The Phase 265 successor,
`tests/test-265-no-fork-subagent-literal.cjs`, asserts the same absence as evidence no
code ever depended on the old opt-in gate, so flipping the platform default broke nothing.
Same shape, inverted meaning -- worth stating plainly so a future reader does not assume
the test regressed.

## 2. The corrected destination map, with the reasoning preserved

The ROADMAP goal that seeded this phase named `/mos:eureka`, `/mos:bono`,
`/mos:find-connections`, `/mos:whitespace`, and `/mos:find-analogies` as the destination
for default-forking adoption. That fact is stale. Not one of the five spawns a Claude Code
subagent:

| Surface | Actual dispatch mechanism | Spawns a subagent? |
|---|---|---|
| `/mos:eureka` | Fires one detached Node process, then polls status up to 3 times over roughly 15 seconds (D-05 fire-and-return) | No |
| `/mos:bono` | `Promise.all` over the (subdomain x hat) grid, in-process async (`cell-fanout.cjs:251`) | No, already parallel |
| `/mos:find-connections` | Sequential Brain MCP queries in the main context | No |
| `/mos:whitespace` | One `node scripts/whitespace-command.cjs` invocation per subcommand (8 subcommands) | No |
| `/mos:find-analogies` | Brain MCP calls plus `scripts/analogy-fitness-report.cjs` | No |

Default subagent forking changes nothing for any of the five. There is no
sequential-Task-call-that-could-be-parallel hiding in any of them.

The surfaces that DO dispatch real Claude Code subagents are different ones entirely:
`/mos:act --swarm`, `/mos:persona --parallel`, `/mos:grade --full`, and the
`/mos:trending-to-absurd` Expert path. The first three each carry a broken instruction
("Dispatch ... using the Agent tool with `run_in_background: true`") -- `run_in_background`
is a Bash-tool parameter that these command docs mistakenly attached to the Agent tool
(traceable to two 2026-era design specs never validated against the tool schema), and the
platform now removes that parameter from the Agent tool entirely under fork mode. The
fourth, trending-to-absurd, now states its dispatch shape explicitly as of Phase 265
Plan 04 (`commands/trending-to-absurd.md`, "Dispatch shape (Phase 265 RADAR-10)" section):
parallel, one subagent per lens, `subagent_type: persona-analyst`.

The trap worth naming explicitly: `cell-fanout.cjs:4-5`'s own header comment calls itself
"a REAL PARALLEL sub-agent fan-out." That comment is misleading. The function dispatches
JavaScript promises, not agents -- its per-cell worker runs in-process Node
(`personaDispatchCell` chains `extractContext -> runSourceLens -> wireAccept`, all local
calls). `agents/persona-analyst.md` describes itself as "dispatched in parallel by
`lib/core/bono/cell-fanout.cjs`," but no code path in `cell-fanout.cjs` reads, spawns, or
references that agent file. The agent is a conceptual persona the prose invokes, not a
spawned process. A future reader tempted to "fix" bono by making it spawn real agents
should read section 3 below first.

## 3. BONO's fan-out is deliberate and validated. Do not "fix" it

`cell-fanout.cjs:251` dispatches all planned cells via `Promise.all`, clamped to a grid
capped by `FUTURES_FANOUT_CAP`, whose default is **5**
(`lib/core/futures/orchestrator.cjs:33`; reused by the BONO cell fan-out per
`cell-fanout.cjs:49-54`). Each cell's dispatch is wrapped so a thrown error collapses to a
`defensiveStub` (neutral stance, zero confidence) instead of rejecting the whole batch
(`cell-fanout.cjs:103-112,257-259`) -- one bad cell can never crash the fan-out or tilt the
downstream debate.

Independent, cross-domain validation: the langtalks-graph-expert corpus source *Building an
Advanced Agentic Harness* (data4sci.com, 2026-07-15) describes its own production executor
as "a level-synchronous DAG walker: compute the ready set, launch every ready node
concurrently with `asyncio.gather` ... `MAX_CONCURRENT = 5` ... `semaphore =
asyncio.Semaphore(MAX_CONCURRENT)`," with per-node failure isolated so one rejection never
propagates. `cell-fanout.cjs` is a faithful implementation of the identical shape --
`Promise.all` over a ready set, a hard concurrency cap defaulting to 5, per-node failure
isolation via a defensive stub. An independent production source, built for a different
codebase entirely, converges on the same design. That is the strongest evidence available
that BONO's fan-out is not a placeholder or a workaround; it is the intended final design.
The navigator confirmed this reading during Phase 265: no code change to `cell-fanout.cjs`
is warranted, and none was made (`git diff --stat lib/` stays empty across every Phase 265
plan that touches this area).

## 4. Dispatch shapes now explicit

**trending-to-absurd (Expert path):** parallel. The four refinement lenses (economic,
technological, social, environmental) each refine the same seed trend with no data
dependency between them, so there is no coupling to preserve; a Brain graph query during
Phase 265 research placed the four lens concepts in separate low-connectivity communities
with no direct edges, which is weak topological evidence for independence, not a confirmed
methodology rule -- stated here honestly rather than overstated, per
`commands/trending-to-absurd.md`'s own "Dispatch shape (Phase 265 RADAR-10)" section.

**explore-opportunity:** sequential, through `runChain`. The four legs (web evidence,
timing, analogs, demand validation) are analytically independent -- no leg consumes
another's analytical output -- but they run in control-flow order because of three real
couplings: `runChain`'s `quality_early_stop` branch, which ends the chain when a step
returns LOW quality; `gateFn`, which halts on a non-push-forward posture before the
material-filing step; and a per-step retry-with-backoff-plus-journal path. The cost
consequence is the reason the order is worth keeping: two of the four legs ride the frozen
`deep_research` reach, and a cold `deep_research` leg returning `insufficient_evidence`
does not spend the other three legs under the sequential-with-early-stop shape, but would
under a parallel fan-out (`commands/explore-opportunity.md`, "Why the four legs run in
order" section).

The navigator's Task 3 decision from `265-04-SUMMARY.md`, recorded verbatim: option id
**`build-now-in-265`** selected -- the parallel pre-pass for explore-opportunity's four legs
gets built in-phase (Plan 265-18, Wave 4), rather than deferred to a follow-up phase
(`defer-to-followup-phase`) or the sequential design being kept as final
(`keep-sequential`). This implies ledger status `adopting` for the
`lib/core/eureka/explore-chain.cjs` row in `data/capability-ledger.json`. This was verified
against two independent, already-committed planning-record citations
(`.planning/ROADMAP.md`'s "Second planning pass, 2026-08-27" note, and
`.planning/phases/265-.../265-18-PLAN.md` lines 41-46, which states plainly: "If 265-04 has
not run yet when this plan is picked up, do not re-present the decision to anyone: it is
settled.")

## 5. Out of scope, recorded not forgotten

- **The `context: fork` skill capability (Claude Code 2.1.218).** Skills declared
  `context: fork` now run in background by default. Zero current usage in this repo
  (`grep -r "context: fork"` returns zero hits). Eureka's fire-and-return flow is a
  plausible future candidate, but adopting it is a design conversation of its own, not a
  mechanical read -- deserves its own phase.
- **The commands-merged-into-skills consolidation.** A `.claude/commands/x.md` and a
  `.claude/skills/x/SKILL.md` now both create `/x` and behave the same on current Claude
  Code. This repo maintains 113 commands plus 126 generated mirrors via
  `scripts/build-skill-mirrors.cjs`, whose own header (`build-skill-mirrors.cjs:10`) states
  a Windows-compositing rationale for the duplication. Whether that rationale still holds
  is a real question, but it touches 239 files -- a phase in its own right, not a
  documentation task.
- **Ingesting Fragmented #305 and #309 into the langtalks corpus.** See section 6's gap
  G-1. Cross-repo work against the langtalks corpus, worth doing, not a Phase 265
  deliverable.

## 6. Honest gaps

**G-1, named explicitly:** *Fragmented #305: Subagents explained: what they are, when (not)
to spawn them* is, on paper, the single most on-point source in the entire langtalks corpus
for this phase's central question. It is in the graph by TITLE ONLY, ingested from episode
#307's shownotes link list -- no transcript, no body. The graph knows the episode exists;
it does not know what it argues. Do not cite it as though it settled anything. The
corpus's genuinely load-bearing finding for this phase was the data4sci DAG-walker
validation in section 3 above, not this title-only node.

Three smaller, explicitly-reported gaps from the same grounding pass: Claude Code
subagent-forking mechanics and concurrency caps have zero coverage in the corpus (correctly
answered from the official changelog and docs instead, per CLAUDE.md's rule that langtalks
is one leg of the grounding stool, not the whole thing); the corpus's coverage of
parallel-agent result deduplication was dominated by Graph-RAG retrieval-side dedup, not
agent-output consolidation, so it does not answer the agent-side question; and MCP
elicitation schema shapes are not an agent-engineering concept at all, correctly answered
from the vendored SDK source instead.

## 7. Second-pass findings and what was deferred

Phase 265-23 is the phase's own last mile: ratify every dispatch grant wave 4 built, build the
one MCP diagnostic that was low-risk and well-defined, and record everything else instead of
guessing at it. This section lists what got deferred and points at `data/capability-ledger.json`
as the machine-readable record; the rows themselves carry the full reasoning, not this list.

**Deferred (status `dormant`), each a genuine architecture decision, not a mechanical fix:**

- `mcp-alwaysload-per-server-eager-token-trade` -- R-8's alwaysLoad trade. States both sides (the
  Brain cold-start case for it, the corpus's eager-loading-is-the-problem case against it), the
  per-server lever nobody has used (split the surface into a hot always-loaded server and a
  deferred long tail), and the explicit instruction not to silently drop it (Phase 114's
  cold-start regression was deliberately paid for). This is the row a future session is most
  likely to act on wrongly, so it is the one this phase's Task 3 checkpoint asked a human to read.
- `mcp-tool-annotations-title-modern-registertool-api` -- R-6. All 36 mindrian-os registrations
  use the legacy `server.tool()` form with no slot for `annotations`/`title`/`outputSchema`; the
  research itself says this is its own plan (36 registrations touched), not a fold-in.
- `mcp-requires-user-interaction-and-max-result-size-chars` -- R-11. Both `requiresUserInteraction`
  and `_meta["anthropic/maxResultSizeChars"]` are recorded as candidates with the mechanism
  explicitly UNVERIFIED (the former does not exist in vendored SDK 1.29.0's `ToolAnnotationsSchema`).
- `mcp-tool-type-hooks-for-part8-boundary` -- R-12. Ranked last in the research not because it is
  unimportant but because it is a behavior change to the constitutional guard path.
- `dispatch-token-task-vs-agent-spelling-reconciliation` -- the `Task` vs `Agent` dispatch-grant
  token spelling is not unified by any documented rule across the registry's 11 rows.
- `deep-grade-sequential-rundebate-second-half` -- plan 265-20 built the calibrate/fan/consolidate
  panel but explicitly fenced grade-grant's sequential debate step as a follow-on, not built here.
- `cross-segment-semantic-claim-dedup` -- plan 265-19's file-meeting fan-out correctly closes its
  OWN duplicate risk (same segment, two lenses, merged on `segment_id`) but does not address the
  narrower, genuine gap a peer session flagged during Wave 3: the same insight restated at two
  DIFFERENT segments is never merged today. The existing pure-JS embedding (`embedding-spine.cjs`)
  plus sqlite-vec similarity search (`vector-store.cjs`) already running inside `room.db` is named
  as the reuse path, per SEED-013 / Phase 134's shipped Python-elimination direction (do not
  introduce a Python clustering library for this).

**Closed, but by a DIFFERENT phase than the one that found them (recorded here so they do not
silently vanish from Phase 265's own accounting):**

- `mcp-instructions-2kb-host-boundary-overflow-fix` (2.1, finding OPEN-1) -- closed by Phase 266
  Plan 01 (MCPFIX-01); measured 1,888 bytes on this ratification run, under the 2,048-byte cap.
- `mcp-room-state-description-voice-dna-pollution-fix` (2.3, finding OPEN-3) -- closed by Phase
  266 Plan 02 (MCPFIX-02, commit `6f42861f`); verified via plan 265-09's own wire-level hygiene
  tripwire, which confirms the fix shipped and holds.
- `mcp-dep-heal-connect-path-timeout-budget-mismatch-fix` (2.9) -- closed by Phase 266 Plans 03
  and 05 (MCPFIX-03 and its gap closure); a single process-wide connect-path budget now bounds
  every dependency-heal call to the host's ~30-second connect timeout.
- `mcp-description-prose-check-coverage-and-ceiling-fix` (D-3, D-4) -- closed by Phase 266 Plan 04;
  `tests/test-234-tool-description-floor.cjs` now checks all 36 tools, not 8, and the ceiling is
  the real platform cap (2048 bytes) instead of a stale exemplar.

**Closed by a Phase 265 plan:**

- `elicitation-titled-enum-migration` (R-5, finding OPEN-2) -- closed by plan 265-02.
- `mcp-surface-doctor-tool-count-and-zero-tool-check` (2.6 OPEN, D-5) -- closed by THIS plan's
  Task 2 (`lib/core/doctor/mcp-surface-module.cjs`).
- `brain-tool-descriptions-retired-backend-names-fix` (D-7) -- closed by plan 265-09.
- `mcp-tool-count-and-token-budget-frozen-literal-drift-fix` (D-1, D-2, D-8) -- **partially**
  closed by plan 265-17 (`bin/mindrian-mcp-server.cjs`'s header plus three docs corrected). NOT
  fully closed: `lib/mcp/tool-router.cjs:1-6` still carries the identical "9 tools / under 7000
  token budget" drift, explicitly handed to Phase 266's MCPFIX-02 by 265-17's own decision record,
  and MCPFIX-02 as shipped only fixed the room_state splice (above), not this header. Ledger
  status left `dormant`, not `shipped`, because the drift this row names is still live in one file.

**Recorded historical, not edited:**

- `changelog-seed-003-a1-brain-portion-dormant-claim` (D-6) -- `CHANGELOG.md:2145` was true when
  written and superseded by Phase 127-00 (commit `5308e678`); deliberately left untouched as
  release-managed history rather than rewritten.

**Roll-up reconciliation (the audit's own Appendix: 7 OPEN, 5 SHIPPED, 9 N/A, 8 DRIFT):**

| Item | Verdict | Disposition |
|---|---|---|
| 2.1 instructions overflow | OPEN | Closed by Phase 266 MCPFIX-01 (external); ledger row `mcp-instructions-2kb-host-boundary-overflow-fix` |
| 2.2 elicitation schema | OPEN | Closed by 265-02; ledger row `elicitation-titled-enum-migration` |
| 2.3 room_state pollution | OPEN | Closed by Phase 266 MCPFIX-02 (external), verified by 265-09; ledger row `mcp-room-state-description-voice-dna-pollution-fix` |
| 2.5 mcp_tool hooks | OPEN | Dormant; ledger row `mcp-tool-type-hooks-for-part8-boundary` |
| 2.6 doctor tool-count | OPEN | Closed by this plan's Task 2; ledger row `mcp-surface-doctor-tool-count-and-zero-tool-check` |
| 2.9 dep-heal timeout | OPEN | Closed by Phase 266 MCPFIX-03/05 (external); ledger row `mcp-dep-heal-connect-path-timeout-budget-mismatch-fix` |
| 2.15/2.16 annotations + _meta | OPEN | Dormant, UNVERIFIED; ledger row `mcp-requires-user-interaction-and-max-result-size-chars` |
| SHIPPED (5 items: alwaysLoad both servers, tool-search opt-out, resource templates, no secrets in config, dist bundle alwaysLoad strip) | SHIPPED | Already fine; alwaysLoad itself carried forward as a live TRADE via ledger row `mcp-alwaysload-per-server-eager-token-trade`, the rest need no row |
| N/A items (2.4, 2.7, 2.10, 2.11, 2.13, 2.14, 2.17, 2.18, 2.20, 2.22) | N/A | No action needed; note the audit's own Appendix states this bucket's count as 9 but lists 10 item-numbers (2.13 covers four changelog versions in one row) -- a pre-existing arithmetic note in the research doc, not corrected here since this plan does not modify that file |
| D-1 "9 tools" claimed, 36 shipped | DRIFT | Partially closed by 265-17; ledger row `mcp-tool-count-and-token-budget-frozen-literal-drift-fix` (still dormant: `lib/mcp/tool-router.cjs` header unfixed) |
| D-2 "under 7000 tokens" breached | DRIFT | Same row as D-1; the false claim is fixed where 265-17 touched, the real over-budget condition is tracked via the alwaysLoad row + Task 2's budget warn |
| D-3 prose checks cover 8/36 | DRIFT | Closed by Phase 266 Plan 04 (external); ledger row `mcp-description-prose-check-coverage-and-ceiling-fix` |
| D-4 stale 600-char ceiling exemplar | DRIFT | Same row as D-3 |
| D-5 no tool-count cap on local server | DRIFT | Closed by this plan's Task 2 (deliberately as a report, not a cap); same ledger row as 2.6 |
| D-6 CHANGELOG Brain alwaysLoad "dormant" | DRIFT | Recorded historical, not edited; ledger row `changelog-seed-003-a1-brain-portion-dormant-claim` |
| D-7 retired-backend names in descriptions | DRIFT | Closed by 265-09; ledger row `brain-tool-descriptions-retired-backend-names-fix` |
| D-8 "49 MCP tools" in LAWRENCE-BRIEFING | DRIFT | Closed by 265-17; same row as D-1 |

Nothing from the audit's 7 OPEN + 8 DRIFT = 15 findings is unaccounted for: every item above either
carries a ledger row naming its status and evidence, or names the plan (in or out of Phase 265)
that closed it. The 5 SHIPPED and 9-or-10 N/A items needed no action and are not tracked as rows.

## Cross-references

- `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-capability-radar-265/` -- the
  durable evidence-and-reasoning trail (Dev-Research Compositing, CLAUDE.md mandatory
  deliverable), mirrored byte-identical to `/home/jsagi/MindrianOS/research/2026-08-27-capability-radar-265/`
  as source-of-record. This document holds the decisions; the room entry holds why they are
  believable.
- `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-capability-radar-265-second-pass/` --
  the second-pass sibling trail, covering the MCP layer audit, the file-meeting deep dive (including
  the navigator's economics-over-recall override), the generative redesign survey, the online-research
  gap, and the persona-builder duplication finding, mirrored byte-identical to
  `/home/jsagi/MindrianOS/research/2026-08-27-capability-radar-265-second-pass/` as source-of-record.
- `data/capability-ledger.json` -- the machine-readable ledger; rows whose disposition
  needed a judgment call carry `decision_ref: "docs/RADAR-ABSORPTION-265.md"` pointing back
  here.
- `.planning/seeds/SEED-003-claude-code-2-1-x-capability-adoption.md` -- superseded by
  Phase 265, body intact.
- `.planning/phases/138-capability-radar-absorption-and-routing/138-CONTEXT.md` -- superseded
  by Phase 265, body intact, errors E-1 through E-5 corrected in a trailing section.
- `.planning/phases/138/DRIFT.md` -- W007-138 closed with a forward pointer to this
  retirement.
