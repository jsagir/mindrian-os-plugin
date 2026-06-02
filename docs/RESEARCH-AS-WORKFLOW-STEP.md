# Research as a Workflow Step -- the v1.14.0 source-lens fan-out template

> Phase 131 (research-as-graph-aware-workflow, shipped in the v1.13.1 band). The PILOT that turns `/mos:research` from a fortune-cookie topic-to-prose command into the canonical 7-stage workflow step other methodologies dispatch -- producing typed `EvidenceClaim` nodes + cascade edges other commands consume, not throwaway markdown. This doc is the TEMPLATE the v1.14.0 fan-out follows to bring the 13 remaining research surfaces onto the same pattern. See also: `docs/WORKFLOWS.md` (the framework-to-command layer), `docs/MINDRIAN-CANON.md` Part 2 Engine 1 + Part 3 + Part 4 + Part 5 + Part 8 + Part 9, `commands/research.md` (the rewritten command this doc explains).

---

## 1. Why this exists

The deep-research audit (2026-05-15) found 0 of 14 research surfaces were Canon Part 9 compliant: none emitted a `memory_event` on invocation, none routed writes through `navigation.cjs`, none surfaced findings via an F-shape selector, and research findings existed as prose markdown rather than typed graph artifacts other commands could consume. Two surfaces even hit the same external API through two code paths with no shared cache (duplicate quota).

Phase 131 fixes ONE surface (`/mos:research`, the source-lens family) as the pilot, end to end, and locks the contract so the other 13 can fan out in v1.14.0 by repointing -- not re-deriving. The pilot is proven by 5 instrumented E2E tests (`tests/test-131-e2e.cjs`) that drive the full pipeline through `navigation.cjs` with a zero-leak gate.

The 13 fan-out surfaces (v1.14.0): scout / opportunities / scheduled-tasks / radar / rs-fetch's research arm / the 4 GSD researchers / file-meeting research / reanalyze / find-analogies external arm. Plus the P9 framework-lens migration (the same lens-engine + cascade-edge pattern, applied to the framework family instead of the source family).

---

## 2. The 7-stage pipeline

```
   /mos:research [topic]   (or: a methodology auto-dispatches it via requires_evidence:)
        |
   [1] PRE-FLIGHT + PLAN   research-context-extractor.extractContext({roomDir, sessionId, topic, db})
        |                    ONE batched navigation.getResearchPreflight read (8 inputs:
        |                    active_workflow / active_jtbd / operator / current_section /
        |                    recent_changes / evidence_gaps / prior_research / role_blend)
        |                    -> a Body Shape A context summary (Larry-voiced, dominant-role framed)
        |                    -> a context-DERIVED ordered weighted lens_set (never hardcoded)
        v
   [2] EXECUTION            source-lens-driver.runSourceLens({roomDir, topic, lensSet, preflight, ...})
        |                    drives the Plan-02 lens_set through the Phase 130 lens-engine rotate()
        |                    (the activated `source` family + the weighted-by-context mode); fetches
        |                    EXCLUSIVELY via the Phase 130.5 shared corpus (cache-first; the Canon
        |                    Part 8 pre-egress audit is the SHARED hook inside fetchCorpus); dedups
        |                    against prior_research; ranks by evidence-tier (Part 5) + relevance;
        |                    caps at top-5. ZERO Python; ZERO fetcher of its own.
        v
   [3] PRESENTATION         the top-5 findings: title + summary + source + url + retrieved_at +
        |                    evidence_tier + candidate sections (% match) + persona-aware framing.
        v
   [4] F.1 FILING GATE      research-filing-selector.buildFilingSelector(finding, candidates, opts)
        |                    a Shape F.1 envelope produced by ROUTING THROUGH lib/hmi/selector-
        |                    dispatcher.cjs pickShape (NOT a bespoke selector). Five closed-vocabulary
        |                    verbs: File to primary / File to secondary / Split / Defer / Reject.
        |                    Mode A pre-fills one confident recommendation above the 0.7 gate; the
        |                    human gate stays (Canon Part 9 role 5).
        v
   [5] WIRING               findings-wirer.wireAccept / wireReject / wireDefer (through navigation.cjs)
        |                    ACCEPT -> EvidenceClaim node (review_status proposed) + INFORMS edge
        |                       (+ CONTRADICTS if it kills a claim, + SUPERSEDES if a better tier)
        |                       + research_filed memory_event (provenance: url + retrieved_at + tier).
        |                    REJECT -> EXACTLY ONE REJECTED_BECAUSE edge carrying the captured reason
        |                       scalar + research_rejected (rejection IS data per Canon Part 4).
        |                    DEFER  -> research_deferred memory_event queued to a milestone audit.
        v
   [6] POST-FILING          called BY a methodology -> RETURN the accepted EvidenceClaim node IDs
   (chain-back / next-move)  (the chain-back contract; handles only, never prose per Canon Part 8).
                            STANDALONE -> surface an F.1 next-move selector.
```

(The 131-CONTEXT spec names 8 stages; the 4.8 re-baseline collapses Stage 1 into one batched pre-flight read and merges Stages 2+3 into one reasoning pass inside `extractContext`, so the shipped pipeline is 7 stages. The naming is consistent across `commands/research.md` and this doc.)

---

## 3. How a methodology declares `requires_evidence:` (the auto-dispatch declaration)

A calling methodology declares that it needs graded evidence by adding a `requires_evidence:` block to its command frontmatter. This is the inbound trigger that lets the navigation engine OFFER to auto-dispatch `/mos:research` when the room's evidence is below the declared threshold.

```yaml
# commands/<some-methodology>.md frontmatter
requires_evidence:
  tier: academic            # the Canon Part 5 floor this methodology demands here
  on: [financial-model]     # the section(s) whose claim graph must clear the tier
  dispatch: /mos:research    # the workflow step that fills the gap
```

The GUIDED-default rule (Canon Part 3 option-generation tier-awareness + the Brain GUIDED-default): a `requires_evidence:` declaration NEVER auto-fires material work. When the room evidence is below the declared tier, the navigation engine surfaces an F.1 selector with a confident recommendation:

> "Evidence here is thin (2 claims at None-tier, you need Academic for the investability gate). Run `/mos:research` against this context? -- [run research] [proceed anyway] [defer]"

The human picks. Auto-dispatch means "the system OFFERS at the right moment," never "the system fetches behind your back." The recommend marker only renders in Mode A at confidence >= 0.7 (the Phase 88.2 invariant, enforced by the dispatcher).

The `/mos:research` command itself declares the reciprocal `emits_evidence_claims: true` in its frontmatter (see `commands/research.md`), so the workflow layer knows this command is an evidence PRODUCER a `requires_evidence:` consumer can be wired to.

---

## 4. How the caller consumes the returned EvidenceClaim IDs (the chain-back contract)

When `/mos:research` is called BY another methodology (Stage 6 POST-FILING), it RETURNS the accepted `EvidenceClaim` node IDs so the calling command resumes with the exact evidence it needed:

```js
// inside the calling methodology, after the user accepts findings at the F.1 gate:
const res = runResearchPipeline({ roomDir, topic, db, calledBy: '/mos:build-thesis' });
// res.chain_back = {
//   called_by: '/mos:build-thesis',
//   evidence_claim_ids: ['EvidenceClaim:sess-4:1a2b3c', ...],   // HANDLES ONLY
//   lens_set: [{ lens: 'scholarly', weight: 1.0 }, ...]
// }
// The caller then reads the confirmed/proposed claims by id through navigation.cjs
// and resumes its own gate (e.g. the build-thesis investability step) with them.
```

The chain-back payload carries **node-id handles only** -- never the finding prose, never the abstract, never the source body. This is a hard Canon Part 8 boundary: handles and enums cross the call boundary; LOCAL content stays in the local graph. The E2E (`test-131-e2e.cjs` E2E 2) asserts the chain-back payload contains zero finding prose.

Standalone invocation (no caller) instead surfaces an F.1 next-move selector ("now `/mos:build-thesis` can consume these claims" etc.), so the navigator always has a next move.

---

## 5. The LOCKED forward contracts (consumed by Phase 136)

These shapes are LOCKED now (Phase 131-01) so Phase 136's render spine consumes them without a migration. The fan-out surfaces MUST honor them.

| Contract | Locked shape | Phase 136 consumer |
|---|---|---|
| **EvidenceClaim provenance schema** | `review_status: proposed` + the four provenance fields `source` / `url` / `retrieved_at` / `evidence_tier` (the last from the closed Part 5 set {Academic, Operational, Practitioner, None}) | the detail-pane dual-render + `getConfirmedFacts` read EXACTLY these four fields. Do NOT rename or drop any without a Phase 136 migration. |
| **Cascade-edge predicates** | `INFORMS` / `CONTRADICTS` / `SUPERSEDES` / `REJECTED_BECAUSE` are members of the allow-listed `ALLOWED_EDGE_TYPES` (INFORMS + REJECTED_BECAUSE shipped via 130-01; CONTRADICTS / SUPERSEDES added additively in 131-01, never invented per-phase) | Phase 136 renders CONTRADICTS as BOTH a graph edge and a sentence (D-06). |
| **F.1 selector IS the gate-as-write-node** | Stage 4/6 mirrors `lib/hmi/selector-dispatcher.cjs` (no bespoke research selector) | Phase 136's richer multi-select gate widget (D-13) is a strict SUPERSET of 131's inline F.1 gate -- "file a finding" and "commit a decision" are the same write path. |
| **Cascade-edge targets are canonical correlation_ids** | a teaching-graph cascade target lands on the canonical `correlation_id` from Phase 130.7 (resolved consumer-side via `lib/lens-engine/correlation-resolver.cjs`), NOT a raw name; a LOCAL-section target lands on the LOCAL `room.db` node id | edges never fork across cross-label duplicates; Phase 136 traverses one canonical node per concept. |

The local-vs-teaching-graph branch is enforced in ONE place: the `resolveTarget` chokepoint in `findings-wirer.cjs`. A LOCAL target resolves to `'section:' + section` (the navigation-engine-offer convention); a `teaching-graph` target resolves to `computeCorrelationId(canonical_name, primary_label)` via the REAL 130.7 exports. The E2E (`test-131-e2e.cjs` E2E 3) exercises the REAL resolver (not a stub) and asserts the teaching-graph edge lands on a real `correlation_id`.

---

## 6. The invariants the fan-out MUST honor

1. **Consume-130.5, build NO fetcher.** Every fan-out surface fetches EXCLUSIVELY through the Phase 130.5 shared corpus (`lib/core/research-corpus.cjs` `fetchCorpus`, cache-first via `lib/core/research-cache.cjs`). NO surface adds a fetcher, a second cache, or a second pre-egress audit. The Canon Part 8 pre-egress audit is the SHARED hook inside `fetchCorpus`, inherited on every fetch. This closes the duplicate-API-quota drift the audit found.
2. **Zero Python on the user machine.** No surface spawns an interpreter subprocess, requires a `.py` script, or calls `scripts/hsi-*.py`. Ranking is CJS-native (source-keyed evidence-tier + token-overlap relevance). HSI-scoring of findings is DEFERRED to v1.14.0 behind Phase 134's CJS HSI; the pilot ships zero Python. The `scripts/check-research-isomorphism.cjs` directive gate fails closed on a re-introduced Python spawn.
3. **navigation.cjs is the only door.** Every room.db read and write routes through `lib/core/navigation.cjs`. No surface requires `node:sqlite` / `room-db.cjs` directly; the db handle is caller-owned. The `scripts/check-substrate.cjs` guard (Phase 128) enforces this. The 5 E2E tests prove it by instrumentation: zero non-SQLite filesystem reads outside the allow-listed cache + USER.md.
4. **All memory_event writes flow through the logMemoryEvent re-export.** Every wiring decision (`research_filed` / `research_rejected` / `research_deferred`) is journaled via the `navigation.cjs` re-export `navigation.logMemoryEvent` (the chokepoint), NEVER the raw `logEvent`.
5. **An EvidenceClaim lands `proposed`, never auto-confirmed.** An EvidenceClaim is a TRUTH-CLAIM node (Canon Part 9 role 5). Only a human APPROVE at a Decision Gate promotes it to `confirmed` (via `navigation.confirmNode`); the wirer never shortcuts that.
6. **LOCAL stays LOCAL (Canon Part 8).** The chain-back payload, the edge properties, and the event payloads carry enum/scalar + node-id handles + provenance scalars only. The finding prose lives on the EvidenceClaim NODE, never on an edge, never in a chain-back, never in a Brain query string.

---

## 7. The fan-out recipe (how a v1.14.0 surface adopts the pattern)

For each of the 13 remaining surfaces:

1. **Compute a lens_set from context** (reuse / extend `research-context-extractor.computeLensSet`; the rules are context-derived, never hardcoded). A surface with a different intent (scout vs. opportunities vs. radar) seeds a different lens family weighting.
2. **Drive `runSourceLens`** (or the framework-lens driver for the P9 framework-lens migration) over the 130.5 corpus. Do not add a fetcher.
3. **Surface findings through the F.1 filing selector** (`buildFilingSelector`; mirror the dispatcher, no bespoke selector).
4. **Wire the gate decision through `findings-wirer`** (`wireAccept` / `wireReject` / `wireDefer`). Local targets -> local node ids; teaching-graph targets -> canonical correlation_ids.
5. **Declare `emits_evidence_claims: true`** in the command frontmatter; wire any `requires_evidence:` consumers to it via the workflow layer.
6. **Add an instrumented E2E** mirroring `tests/test-131-e2e.cjs` (the fs-instrument zero-leak gate + the REAL correlation-resolver assertion) and register it in the phase aggregator + `lib/memory/run-feynman-tests.cjs`.
7. **Run `scripts/check-research-isomorphism.cjs`** -- the CI guard asserts every finding has provenance, every cascade edge has a typed predicate, every cascade target is a local node id or a canonical correlation_id, every rejection carries a reason, and zero Python spawned.

Each surface adds an E2E and a frontmatter declaration -- it does NOT re-derive the extractor, the driver, the selector, the wirer, the corpus, or the resolver. That is the point of the pilot: the fan-out is wiring, not re-building (Canon Part 7 reuse).

---

## 8. CANON-PHASE-MAP cross-reference

This doc + the Phase 131 pilot implement the research surface of the canon across SIX parts:

- **Part 2 Engine 1** (Act 1 intelligence surface) -- research becomes a graph-aware Act 1 surface: context extraction + lens computation + ranked findings feed the Opportunity Bank and the team.
- **Part 3** (Tri-Context Decision Gate) -- the F.1 filing selector is the gate-as-write-node for every finding (LOCAL + BRAIN + SIGNAL contexts collapse to a typed edge).
- **Part 4** (every choice is graph data) -- typed `EvidenceClaim` nodes + INFORMS / CONTRADICTS / SUPERSEDES cascade edges on accept; REJECTED_BECAUSE on reject (rejection IS data).
- **Part 5** (evidence graded by context) -- findings carry an `evidence_tier`; the stage threshold tightens the floor (commit drops None-tier).
- **Part 8** (the graph boundary) -- pre-egress audit on every external fetch (the shared 130.5 hook); provenance preserved; LOCAL stays LOCAL; chain-back carries handles only.
- **Part 9** (memory locality) -- all reads + writes through `navigation.cjs`; mandatory `memory_event`; an EvidenceClaim is a proposed truth-claim node a human confirms.

Per Canon Part 6 (Product-as-Venture / dog-fooding), the canon names the phase that implements the canon: this is Phase 131, the source-lens pilot.

---

_Research as a Workflow Step -- MindrianOS Plugin (Phase 131, the v1.14.0 fan-out template)_
