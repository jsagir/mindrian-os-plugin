# Phase 354: System Integrity and Theo Integration - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning
**Source:** PRD Express Path (`docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md`)

<domain>
## Phase Boundary

Independently research the whole plugin and its Theo integration, reproduce or refute the prior review's findings, then repair confirmed failures and verify complete user journeys. Covers the whole plugin (not only the localhost interface): command/skill/agent/pipeline routing, gates, room binding, file and graph persistence, Theo consultation, rendering, and subsequent reuse.

Independent research is COMPLETE (see `354-RESEARCH.md`, sourced from `docs/reviews/2026-09-23-deep-system-research.md`, commit `3b928628e`, with runnable probes at `docs/reviews/phase-354-probes/`). This phase now covers: publish the disposition ledger, plan-check it (the handoff's "independent GSD review [to] challenge the reproductions"), write failing regression tests for every CONFIRMED finding, implement repairs, and verify complete user journeys per the Acceptance and close-out section below.

</domain>

<decisions>
## Implementation Decisions

### Research gate (already satisfied -- locked)
- No production fix before independent research and review. Independent research is complete and recorded in `354-RESEARCH.md` / `docs/reviews/2026-09-23-deep-system-research.md`. Treat it as evidence to challenge and convert into regression tests, not as permission to skip the GSD plan-checker's independent challenge.
- Prior review `docs/reviews/2026-09-20-full-system-code-review.md` (commit `594bc5ce8`) is provisional input only, NOT authoritative; its 5/10 and 6/10 ratings are subjective estimates, not measured acceptance criteria. Several of its specific claims are corrected or bounded by the 2026-09-23 research -- use the corrected version wherever they conflict.

### CONFIRMED findings requiring repair (from `354-RESEARCH.md` / deep research, file:line evidence already captured there)
- **SYS gate/state integrity (P1):** Gate approval must promote the card's actual subject claim, not the newly-minted decision node (`lib/mcp/tools/gate.cjs:303-304` calling `confirmNode(writeResult.node_id)` is wrong; must target the subject claim ID). Test must assert the exact claim ID transitions `proposed` -> `confirmed`, not just "some node confirmed."
- **SYS chain resume (P1):** `lib/core/chain-executor.cjs:1367-1377` must use stable run+step identity, not `journal.chain.indexOf(step.command)` (command name is not step identity -- breaks on repeated commands). `:1331` must restore the journaled predecessor `output_path` before dispatching a resumed step instead of `previousOutput = null`.
- **SYS write-lock ownership (P1):** `lib/core/write-lock.cjs:59` (age-only staleness) and `:101-104` (`releaseLock()` unlinks by path, no ownership token) must become owner-aware: a lock token, and staleness must not override a demonstrably live owner without an explicit recovery protocol. `lib/core/graph-ops.cjs:22-29`'s hold-across-await pattern is correct and must keep working under the new lock. Add multi-process tests: long writes, crashed owners, takeover, old-owner release.
- **SYS room-symlink containment (P1):** `lib/mcp/tool-router.cjs:145-151` (lexical containment) and `lib/mcp/tools/views.cjs:206-207` (actual write through resolved path) must both hold: define a symlink policy and enforce realpath containment for section, destination, and existing parent immediately before the write, not only earlier as a lexical check.
- **THEO-01 classification round-trip (P1):** `lib/mcp/brain-router.cjs:316-327` must carry the already-classified state structurally into the composition request instead of re-deriving it from generated natural language that `lib/core/brain-client.cjs:1172` then misclassifies. Regression-test router -> composer -> captured Theo arguments end to end.
- **THEO-01 executable-chain validation (P1):** `lib/mcp/brain-router.cjs:374-400` must not emit command IDs the methodology registry doesn't contain (e.g. `designthinking`, `build-mvp`); `lib/mcp/tool-router.cjs:1802` must validate the final consumer input BEFORE `act`-chain state initialization, not only log the rejection after using the invalid first element.
- **THEO-01 provenance (P2):** `lib/mcp/brain-router.cjs:414-421` must not unconditionally label output `chain_type: feeds_into` / "derived from `brain_ask FEEDS_INTO recommendations`" unless a real FEEDS_INTO traversal was computed provider-side. Either preserve ranked-candidate provenance honestly, or obtain and verify actual dependency edges first.
- **Brain egress typing (P1):** `lib/core/part8-egress-guard.cjs:521-531`'s denylist-plus-methodology-token heuristic is not sufficient proof of "generic." Use typed fields and canonical methodology identifiers at the egress boundary per Canon Part 8; do not forward free-form user prose through a "generic" channel.
- **THEO-01 taxonomy casing (P2):** `lib/core/strategy/rung-vocabulary.cjs:102` and `lib/core/strategy/taxonomy-climb.cjs:145` send lowercase/hyphenated values; Theo's schema accepts `UnDefined`/`IllDefined`/`WellDefined`/`Wicked`. Fix is scoped to the taxonomy-ladder path specifically -- do NOT generalize into `recommendChain`'s already-correct normalization (already inspected separately, should not be touched).
- **SYS-06 localhost POC safety (P1, three sub-findings):** `lib/chat/chat-panel.js:20-44,379,539` renders assistant HTML via `innerHTML` (inert rendering needed, preserve useful formatting, no execution). `docs/reviews/localhost-poc/app.js:3-4` converts an untouched document to lossy HTML<->Markdown, changing headings/spacing without an edit (needs a conflict-safe document format / atomic save that preserves untouched content). `docs/reviews/localhost-poc/server.cjs:45-60` accepts a cross-origin browser POST (needs origin/capability protection).
- **SYS-04 MCP registration diagnostics (P2):** `lib/mcp/register-core-tools.cjs:39-75` silently drops failed tool registrations with no diagnostic and no degraded health state, while healthy siblings keep working. Preserve sibling isolation (correct behavior); add startup diagnostics and health-state exposure for failed registrations. Keep MCP stdout protocol-clean.

### Corrected/bounded findings -- do NOT re-open these as if unconfirmed
- MCP URI percent-encoded traversal did NOT escape through the installed SDK's URI-template matcher in the probe -- the room-symlink path (above) is the real containment gap, not raw traversal. `lib/mcp/resources.cjs:260-263`'s reasoning resource still accepts an unchecked section name and should be covered by the same containment fix.
- Current graph-rebuild behavior is scoped and transactional; rebuild-preservation tests passed. The earlier "blanket graph-destruction" concern from the 2026-09-20 review is not current behavior -- do not plan a fix for it.
- Theo's `recommendChain` path already performs correct origin-specific normalization; the casing failure is specifically the `taxonomy_ladder` path (see THEO-01 taxonomy casing above). Do not generalize the casing fix into `recommendChain`.
- Plugin-side release notification exists, but inspected Theo source has no consumer workflow -- this is a tracked CROSS-REPOSITORY gap (coordinate with Phase 351 per THEO-02 below), not proof of current deployed GitHub state, and not something to "fix" unilaterally from this repo.
- SYS-07 acceptance-runner timeout is UNRESOLVED, not a confirmed product defect: sandbox mock-server restrictions affected the failing runs; a subsequent non-sandbox rerun did not produce a trustworthy completion signal before being stopped. Do not close this as fixed OR as a defect without first instrumenting phase timing + bounded child-process diagnostics and rerunning clean (recommended-repair-sequence item 5).

### Cross-phase ownership (do not duplicate)
- THEO-02 (release registry synchronization): coordinate with Phase 351; do not duplicate its scope or claim historical drift is still current without checking Phase 351's actual state first.
- Reconcile overlap with phases 273, 345, 350, 351, 352 generally -- reuse existing mechanisms (single navigation.cjs write chokepoint, single write-lock module, single egress guard) rather than building competing resolvers/writers/registries/gates.
- Theo-repository-side changes (THEO-01 provider schema, THEO-02 provider consumer workflow) belong in Theo's own GSD workflow at `/home/jsagi/Theo`. Never patch or deploy that repository incidentally from this plugin phase. This plugin phase links its concrete task and verification back to Theo's side where needed, and does not mark the integration complete while the provider-side dependency remains open.

### Recommended repair sequence (locked ordering, from the research)
1. Trust/state integrity: gate subject promotion, chain resume identity/output recovery, lock ownership -- these can silently corrupt user trust or state.
2. Boundary integrity: room-symlink containment, Brain egress typing, chat/browser output safety.
3. Theo contract-safety: classification round-trip, executable-command validation, provenance, taxonomy casing -- contract tests span both repositories (read-only on Theo's side from this repo).
4. Localhost POC hardening: save format + origin model, then a real browser-to-room-to-graph journey.
5. Acceptance-runner diagnostics: phase timing + bounded child-process diagnostics, then a clean rerun.

### Test-first requirement (locked)
Every CONFIRMED finding gets a FAILING regression test written before its fix, asserting the exact value/ID the next layer actually consumes (not the intermediate representation) -- this is the specific pattern that let all 8 P1s ship with a green test suite. See `354-RESEARCH.md` Pitfall 1.

### Claude's Discretion
- SYS-05 (`extract_shallow` persistence contract): decide during planning whether the public contract is honest-parsing-only or governed persistence; its current connector explanation already acknowledges pure parsing, and the earlier review incorrectly claimed all connector metadata promises writes. Test the chosen behavior through the MCP handler and disk/database after reopening, not response text alone.
- Exact plan/wave breakdown and file-level task sequencing within each repair-sequence tier above.
- Whether repair-sequence tiers 1-5 become one phase's worth of plans or need sub-phase splitting given the number of confirmed P1s -- planner's call based on wave/dependency analysis.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase mandate and ledger
- `docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md` -- phase mission, candidate issue ledger (SYS-01..07, THEO-01..03) with required repair/verification outcome per ID, acceptance and close-out criteria.
- `.planning/phases/354-system-integrity-and-theo-integration-independent-research-a/354-RESEARCH.md` -- this phase's RESEARCH.md, summarizing and indexing the findings below.

### Research evidence (primary)
- `docs/reviews/2026-09-23-deep-system-research.md` (commit `3b928628e`) -- full findings, file:line references, corrected/bounded earlier findings, recommended repair sequence. READ IN FULL, not just the RESEARCH.md summary.
- `docs/reviews/phase-354-probes/` (`browser.cjs`, `persistence.cjs`, `registration.cjs`, `resources.cjs`, `theo.cjs`) -- runnable reproduction scripts backing every CONFIRMED finding; reuse these as the starting point for the failing regression tests this phase requires.

### Superseded/bounded input (read with caution, per Corrected/bounded findings above)
- `docs/reviews/2026-09-20-full-system-code-review.md` (commit `594bc5ce8`) -- provisional input, several claims corrected or bounded by the primary research above.
- `docs/reviews/2026-09-20-localhost-workspace-review.md` -- recheck its legacy dashboard/refresh/layout/chat-integration findings rather than silently excluding them.

### Canon and architecture
- `docs/MINDRIAN-CANON.md` Part 8 (Graph Boundary -- governs the Brain egress typing fix), Part 9 (Memory Locality -- governs the single navigation.cjs write chokepoint and lock-ownership fix), Part 11 (Invocation Constitution -- CIRS, relevant if any tool registration/health surface changes touch declared wiring).
- Project `CLAUDE.md` -- GSD Workflow Enforcement (no direct edits outside GSD), Node >=22.16.0 `node:sqlite` `timeout` constraint (relevant to any lock-ownership implementation choice).

</canonical_refs>

<specifics>
## Specific Ideas

- Every fix in repair-sequence tier 1-3 is a "seam" defect: two layers each locally consistent, disagreeing once you look at both together. Plans should name, for each task, which two layers disagree and what makes them agree after the fix (mirrors `354-RESEARCH.md`'s Don't Hand-Roll "Key insight").
- Reuse the existing `docs/reviews/phase-354-probes/*.cjs` scripts as the seed for the required failing regression tests rather than writing new reproduction logic from scratch.
- For THEO-01/THEO-02/THEO-03, keep the plugin-side test/fix strictly read-only toward `/home/jsagi/Theo` -- comparisons and contract tests only, no writes to that repository from this phase.

</specifics>

<deferred>
## Deferred Ideas

- Any Theo-repository-side implementation (provider schema fixes for THEO-01, provider consumer workflow for THEO-02) -- out of scope for this repo's phase; link the concrete task and verification back here once Theo's own GSD workflow addresses it.
- Release/notification propagation work already owned by Phase 351 -- do not duplicate.
- SYS-05's final contract decision is deferred to planning time (see Claude's Discretion), not resolved here.

</deferred>

---

*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Context gathered: 2026-09-23 via PRD Express Path*
