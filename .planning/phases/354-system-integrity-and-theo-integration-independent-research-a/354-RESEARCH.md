# Phase 354: System Integrity and Theo Integration - Research

## RESEARCH COMPLETE

**Researched:** 2026-09-23
**Domain:** Cross-layer defect repair (gate/decision writes, chain resume, file locking, room-path containment, Theo request/response contract, Brain egress typing, browser POC safety, MCP registration diagnostics)
**Confidence:** HIGH (every P1/P2 below is evidence-backed by a runnable, isolated reproduction; no finding here rests on inspection alone)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- No production fix before independent research and review (354-CONTEXT.md, docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md).
- Cover the whole plugin, not only the localhost interface; trace intent through command/skill/agent/pipeline, routing and gates, room binding, file and graph persistence, Theo consultation, rendering, and reuse.
- Reproduce each candidate (SYS-01..07, THEO-01..03) independently; classify CONFIRMED / REFUTED / ALREADY FIXED / BLOCKED with commands, output, source references, impact, confidence.
- Reconcile overlap with phases 273, 345, 350, 351, 352 -- reuse existing mechanisms, no competing resolvers/writers/registries/gates.
- Theo-side changes belong in Theo's own GSD workflow; never patch or deploy that repository from this plugin phase.
- This research pass applies NO production fix. Confirmed behaviors become failing regression tests during planning, before implementation.

### Claude's Discretion
- Exact repair sequencing within the four repair-sequence tiers below (lock ownership / gate subject / chain resume vs. filesystem boundaries vs. Theo contract-safety vs. POC hardening) -- reconcile against phase dependency ordering during planning.
- Whether SYS-05 (`extract_shallow` persistence contract) is resolved as "honest parsing" or "governed persistence" -- open question, decide during planning per the handoff's own framing.

### Deferred Ideas (OUT OF SCOPE)
- Any Theo-repository-side code change (THEO-02 provider workflow, THEO-01 provider schema) -- track and link back to this phase; do not implement there.
- Release/notification propagation work already owned by Phase 351 -- coordinate, do not duplicate.

**If no CONTEXT.md exists:** N/A -- 354-CONTEXT.md exists and is summarized above.
</user_constraints>

<research_summary>
## Summary

This is a bug-remediation phase, not a new-stack/greenfield phase, so "standard stack" and "don't hand-roll" sections below are intentionally thin -- the fixes are local, surgical corrections to existing chokepoints, not new library adoption.

Independent deep research (2026-09-23) reproduced 8 confirmed cross-layer failures plus 2 P2 findings against the production code paths, using disposable fixtures and synthetic text under `docs/reviews/phase-354-probes/` (no real rooms touched, no network calls to Theo). It is a follow-up to and partial correction of `docs/reviews/2026-09-20-full-system-code-review.md`.

**Primary recommendation:** Repair in the sequence the research already derived from shared blast radius, not file order: (1) trust-and-state integrity -- gate subject promotion, chain resume identity/output recovery, lock ownership; (2) boundary integrity -- room symlink containment, Brain egress typing, chat/browser output safety; (3) Theo contract-safety -- classification round-trip, executable-chain validation, provenance labeling, taxonomy casing, tested against both repositories; (4) localhost POC hardening -- save format, origin model, then a real browser-to-room-to-graph journey; (5) acceptance-runner diagnostics. Turn each CONFIRMED finding into a failing regression test before writing the fix (test-first, not test-after).
</research_summary>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|-----------------|-----------|
| Gate approval -> claim promotion | Local graph (SQLite, `navigation.cjs`) | MCP tool layer (`lib/mcp/tools/gate.cjs`) | `confirmNode()` must target the card's actual subject node, not the newly-minted decision node; the write chokepoint is local, the bug is in what id the MCP tool hands it |
| Chain resume identity | HARNESS (chain-executor) | Durable journal (filesystem) | `chain-executor.cjs` owns step dispatch; the journal is the source of truth for "already completed" and predecessor output, so identity must be run/step-scoped, not command-name-scoped |
| Cross-process write lock | HARNESS (write-lock.cjs) | Database/Storage (graph-ops.cjs holds it across an await) | Lock ownership and staleness recovery is a filesystem-level primitive; every caller (graph-ops) depends on it being owner-aware |
| Room-path containment | HARNESS (tool-router.cjs lexical check) | Filesystem/Storage (views.cjs actual write) | Containment must be enforced at the point of the real filesystem write (realpath), not only at the earlier lexical/string check |
| Theo classification round-trip | Backend/API (brain-router.cjs, brain-client.cjs) | Brain (remote, Theo) | The plugin must carry typed state structurally into the composition request instead of re-deriving it from generated natural language |
| Theo executable-chain validation | Backend/API (brain-router.cjs, tool-router.cjs `act` init) | Methodology registry (local) | Final consumer input (the command chain) must be validated against the actual local registry before state initialization, not only logged as rejected |
| Theo provenance labeling | Backend/API (brain-router.cjs) | Brain (remote, Theo) | `chain_type: feeds_into` must not be asserted unless a real FEEDS_INTO traversal was computed provider-side |
| Brain egress typing | CONTEXT/GRAPH boundary (part8-egress-guard.cjs) | Backend/API (brain-client.cjs `brain.ask()`) | Canon Part 8 boundary enforcement belongs at the guard; a denylist-plus-vocabulary heuristic is not sufficient proof of "generic" |
| Taxonomy ladder casing | Backend/API (rung-vocabulary.cjs, taxonomy-climb.cjs) | Brain (remote, Theo `vocabulary.ts`) | Plugin-side mapping must match the provider's actual accepted enum casing |
| Browser POC safety (chat HTML, save round-trip, cross-origin write) | Browser/Client (chat-panel.js, localhost-poc/app.js, server.cjs) | -- | User-visible, browser-testable; inert rendering, conflict-safe document format, and origin/capability checks all belong client+server side of the POC |
| MCP tool-registration diagnostics | HARNESS (register-core-tools.cjs) | Startup/health surface | Sibling isolation is correct and must stay; the gap is invisibility, not the isolation itself |

</architectural_responsibility_map>

<standard_stack>
## Standard Stack

No new libraries. Every fix is local to existing modules already on the dependency graph (Node.js CJS, `node:sqlite`, existing MCP SDK, existing chat-panel renderer). Confirm library-version constraints already pinned in project `CLAUDE.md` (Node >=22.16.0 for `node:sqlite`'s `timeout` option) remain honored by any lock-ownership fix.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Data flow this phase touches (trace order, matches the handoff's own trace instruction)

```
User intent
  -> routing (tool-router.cjs)
  -> room binding / path containment (tool-router.cjs lexical check -> views.cjs realpath write)
  -> gate render/answer (gate-render.cjs, gate.cjs) -> confirmNode() on the CARD SUBJECT
  -> chain dispatch/resume (chain-executor.cjs) <-> durable journal (run+step identity, predecessor output)
  -> local graph persistence (navigation.cjs, the single write chokepoint)
  -> Brain/Theo consultation (part8-egress-guard.cjs -> brain-client.cjs -> brain-router.cjs -> remote Theo)
  -> rendering (chat-panel.js, localhost POC editor/graph tab)
  -> reuse (later retrieval/render, resource read paths in resources.cjs)
```

Every P1 below sits ON this trace, at a named point in it -- this is why the research groups repairs by shared root cause / shared blast radius rather than by file.

### Anti-Patterns to Avoid (this phase, evidence-backed)
- **Confirming the wrong node on approval:** confirming whatever node the write path most recently minted (`decision:gate:*`) instead of the card's declared subject claim. Root cause of P1 "Gate approval promotes the wrong node."
- **Using command name as step identity in a resumable chain:** `journal.chain.indexOf(step.command)` collapses repeated commands (`research -> validate -> research`) into one identity. Root cause of P1 chain-resume finding.
- **Age-only lock staleness with unconditional unlink-by-path release:** no PID-liveness check before takeover, no ownership token before release. Root cause of P1 write-lock finding.
- **Lexical/string path containment followed by a separate realpath write:** the check and the write are not the same operation, so a symlink introduced between them (or already present) escapes containment. Root cause of P1 room-symlink finding.
- **Re-deriving typed state from generated natural language:** turning an enum into a sentence, then re-classifying the sentence with a different marker vocabulary than the enum. Root cause of P1 Theo classification round-trip.
- **Trusting a denylist-plus-keyword match as proof of "generic":** a private sentence containing a methodology word (e.g. "Use the SWOT framework on our confidential plan: ...") passes. Root cause of P1 Brain egress finding.
- **Asserting derived provenance the provider didn't compute:** labeling ranked-candidate output as an execution chain with FEEDS_INTO provenance when no FEEDS_INTO traversal ran. Root cause of P2 Theo provenance finding.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Node-vs-edge write path | A second local-graph write function | The existing single chokepoint: `lib/core/navigation.cjs` | Canon Part 9 -- SQL (room.db) is the local mind; only one write chokepoint is allowed |
| Path containment | A new symlink-detection utility per caller | One realpath-containment helper invoked at every write site (section, destination, existing parent) before the write happens | Reuse Before Build (Canon Part 7); the finding is that containment is checked once lexically and not again at the real write -- fix the seam, don't add a parallel checker |
| Lock ownership | A bespoke mutex service | Extend `lib/core/write-lock.cjs` with a lock token + owner-aware release, still the single lock module every caller (`graph-ops.cjs` and siblings) already depends on | One governed reach path; do not mint a second locking primitive |
| Egress classification | A smarter denylist/keyword heuristic | Typed fields and canonical methodology identifiers at the `part8-egress-guard.cjs` boundary, per Canon Part 8 | Canon Part 8 requires this boundary to be structural, not lexical-heuristic |

**Key insight:** every confirmed P1 is a *seam* defect -- a place where two layers each hold a locally-consistent story that stops agreeing once you look at both together (a claim vs. the node actually confirmed; a command name vs. a step's real identity; lock age vs. lock owner liveness; a lexical path check vs. the realpath actually written; a typed enum vs. its natural-language echo). The fix pattern is uniformly "make the second layer check the first layer's actual state," not new architecture.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Testing the intermediate representation, not the consumed one
**What goes wrong:** A test validates the shape a function returns, but the next layer consumes a different derived value, so the test passes while the assembled behavior is wrong (confirmed pattern across P1: `tests/test-276-meeting-gate-wiring.cjs:214` only checks "some node is confirmed," missing that it's the WRONG node).
**Why it happens:** Unit tests are written against the function under test's own contract, not the downstream contract.
**How to avoid:** For every fix in this phase, add a regression test asserting the exact ID/value the NEXT layer will actually consume (e.g., the original claim ID stays `proposed: false` / becomes `confirmed`, not just "a node became confirmed").
**Warning signs:** A passing test suite alongside a reproducible cross-layer failure -- exactly what the 2026-09-23 research found eight times.

### Pitfall 2: Treating "old research" as current proof
**What goes wrong:** The 2026-09-20 full-system-code-review's subjective 5/10 and 6/10 ratings, or its blanket URI-traversal and graph-rebuild claims, get carried into planning unchallenged.
**Why it happens:** Prior review documents read as authoritative once written down.
**How to avoid:** The "Corrected or bounded earlier findings" section of the 2026-09-23 research already narrows several of these (URI percent-encoding did not escape through the SDK matcher; graph rebuild is scoped/transactional and passed; taxonomy casing is limited to the taxonomy-ladder path only, not `recommendChain`). Planning must use the corrected findings, not the original review, wherever they conflict.
**Warning signs:** A plan task citing `docs/reviews/2026-09-20-full-system-code-review.md` for a claim that `docs/reviews/2026-09-23-deep-system-research.md`'s "Corrected or bounded" section already narrows or refutes.

### Pitfall 3: Declaring the acceptance-runner timeout a defect from one run
**What goes wrong:** SYS-07 (acceptance command timeout) was investigated; sandbox-mock-server restrictions affected the failing runs, and a subsequent non-sandbox run did not produce a trustworthy completion signal before being stopped -- so acceptance remains UNRESOLVED, not confirmed as a product defect.
**Why it happens:** A single timed-out run looks like proof, but a 20-second timeout alone proves nothing about root cause (environment vs. real hang).
**How to avoid:** Per the handoff's SYS-07 row: reproduce with an explicit time budget and phase diagnostics; separate normal duration, environment restriction, network wait, and child-process hang; verify no orphan processes before calling it fixed or calling it a defect.
**Warning signs:** A plan task that "fixes" SYS-07 without first instrumenting phase timing and bounded child-process diagnostics per the recommended-repair-sequence item 5.
</common_pitfalls>

<code_examples>
## Code Examples

Concrete file:line references from the reproduced findings (source: `docs/reviews/2026-09-23-deep-system-research.md`, full text below in Sources):

- `lib/mcp/tool-router.cjs:1563,:1653` -- gate contract statement; `lib/mcp/tools/gate.cjs:303-304` -- `confirmNode(writeResult.node_id)` targets the wrong node.
- `lib/core/chain-executor.cjs:1367-1377` -- `journal.chain.indexOf(step.command)`; `:1331` -- `previousOutput = null` not restored from journal `output_path`.
- `lib/core/write-lock.cjs:59` (age-only staleness), `:101-104` (`releaseLock()` unlinks by path, no ownership token); `lib/core/graph-ops.cjs:22-29` (holds lock across an awaited op, releases in `finally`).
- `lib/mcp/tool-router.cjs:145-151` (lexical containment) vs. `lib/mcp/tools/views.cjs:206-207` (actual write through resolved path).
- `lib/mcp/brain-router.cjs:316-327` (typed state -> NL) vs. `lib/core/brain-client.cjs:1172` (re-classification with a mismatched marker set).
- `lib/mcp/brain-router.cjs:374-400` (invalid command IDs in chain output) + `lib/mcp/tool-router.cjs:1802` (initializes `act` chain from the unvalidated first element).
- `lib/mcp/brain-router.cjs:414-421` (unconditional `chain_type: feeds_into` label).
- `lib/core/part8-egress-guard.cjs:521-531` (denylist + methodology-token false-safe path).
- `lib/core/strategy/rung-vocabulary.cjs:102`, `lib/core/strategy/taxonomy-climb.cjs:145` (lowercase/hyphenated casing Theo's schema rejects).
- `lib/chat/chat-panel.js:20-44,379,539` (assistant HTML through `innerHTML`); `docs/reviews/localhost-poc/app.js:3-4` (lossy HTML<->Markdown round trip); `docs/reviews/localhost-poc/server.cjs:45-60` (accepts cross-origin POST).
- `lib/mcp/register-core-tools.cjs:39-75` (silent partial tool-surface registration, no diagnostic emitted).
- `lib/mcp/resources.cjs:260-263` (reasoning resource accepts an unchecked section name -- noted while bounding the URI-traversal finding).
</code_examples>

<open_questions>
## Open Questions

1. **SYS-05: is `extract_shallow` supposed to persist or only parse?**
   - What we know: its current connector explanation already acknowledges pure parsing; the earlier review incorrectly claimed all connector metadata promises writes.
   - What's unclear: whether the PUBLIC CONTRACT should be honest-parsing-only or upgraded to governed persistence.
   - Recommendation: decide during planning (Claude's Discretion per CONTEXT.md), then test the chosen behavior through the MCP handler and disk/database after reopening -- not response text alone.

2. **SYS-07: acceptance-runner timeout -- environment or real hang?**
   - What we know: sandbox mock-server restrictions affected earlier failing runs; a non-sandbox rerun did not produce a trustworthy completion signal before being stopped.
   - What's unclear: whether there is a real child-process hang independent of the sandbox.
   - Recommendation: instrument phase timing and bounded child-process diagnostics (recommended-repair-sequence item 5), rerun in a clean environment, THEN classify.

3. **Ownership/dependency map completeness vs. phases 273, 345, 350, 351, 352.**
   - What we know: the research explicitly flags THEO-02 (release registry sync) as needing coordination with Phase 351, not duplication.
   - What's unclear: exact plan-level boundary between this phase's THEO-02 disposition and Phase 351's existing scope.
   - Recommendation: planner cross-reads Phase 351's CONTEXT/SUMMARY (if closed) before writing THEO-02 tasks; do not re-plan work Phase 351 already owns.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence -- direct reproduction against production code)
- `docs/reviews/2026-09-23-deep-system-research.md` (commit `3b928628e`) -- the full research document this file summarizes; READ IN FULL during planning, this summary is not a substitute.
- `docs/reviews/phase-354-probes/` (`browser.cjs`, `persistence.cjs`, `registration.cjs`, `resources.cjs`, `theo.cjs`) -- runnable, isolated reproduction scripts backing every CONFIRMED finding above. Disposable fixtures and synthetic text only; no real rooms modified, no network calls to Theo.
- `docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md` -- the phase mandate, candidate issue ledger (SYS-01..07, THEO-01..03), and required repair/verification outcome per ID. Mandatory reading before planning per 354-CONTEXT.md.

### Secondary (MEDIUM confidence -- superseded/bounded by the primary research)
- `docs/reviews/2026-09-20-full-system-code-review.md` (commit `594bc5ce8`) -- provisional input only, NOT authoritative; several of its claims are corrected or bounded by the 2026-09-23 research (see Pitfall 2 above). Read the "Corrected or bounded earlier findings" section of the 2026-09-23 doc before trusting any specific claim from this earlier review.
- `docs/reviews/2026-09-20-localhost-workspace-review.md` -- recheck its legacy dashboard/refresh/layout/chat-integration findings during planning rather than silently excluding them (per the handoff).

### Tertiary (LOW confidence / not yet independently re-verified)
- None claimed as fact without the primary probes above. The handoff itself calls for "An independent GSD review [to] challenge the reproductions and proposed fixes" -- that independent challenge is the gsd-plan-checker step of this same `/gsd-plan-phase` run, not a separate research pass, per the handoff's prescribed sequence (`/gsd-plan-phase 354 --prd docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md`, then plan checker, then `/gsd-execute-phase 354`).
</sources>

<metadata>
## Metadata

**Research scope:**
- Core: production code paths (gate, chain-executor, write-lock, tool-router/views path containment, brain-router/brain-client, part8-egress-guard, taxonomy strategy modules, chat-panel, localhost POC, MCP tool registration)
- Ecosystem: Theo's own source/instructions at `/home/jsagi/Theo` (read-only comparison of consumer vs. provider contracts)
- Patterns: seam defects between layers (see Don't Hand-Roll "Key insight")
- Pitfalls: intermediate-representation testing, stale-review reuse, single-run timeout misclassification

**Confidence breakdown:**
- Findings (CONFIRMED list): HIGH -- each has a runnable isolated reproduction plus exact file:line source references
- Corrected/bounded earlier findings: HIGH -- explicitly re-tested, not just asserted
- Open questions (SYS-05, SYS-07, cross-phase boundary): MEDIUM -- genuinely undecided, flagged for planning-time resolution, not a research gap
- Standard stack / architecture patterns: N/A framing (bug-remediation phase, not new-stack research) -- HIGH confidence in the seam-defect pattern itself

**Research date:** 2026-09-23
**Valid until:** Treat as current through Phase 354's planning and execution; any further code change to the named files before execution invalidates the specific line references above (not the defect patterns).
</metadata>

---

*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Research completed: 2026-09-23*
*Ready for planning: yes*
*Full source document (read this too, not just this summary): docs/reviews/2026-09-23-deep-system-research.md*
*Reproduction probes: docs/reviews/phase-354-probes/*
