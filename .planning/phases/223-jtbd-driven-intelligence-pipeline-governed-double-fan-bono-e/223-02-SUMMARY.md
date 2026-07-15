---
phase: 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono
plan: 02
subsystem: close-the-loop-graph-write
tags: [navigation-chokepoint, dual-write, supersedes-chain, open-question, provenance, cjs, part9]

# Dependency graph
requires:
  - phase: 224
    provides: edges.review_status column + writeEdge review_status param + buildFixtureRoom224 base fixture
  - phase: 219
    provides: typed-opportunity writeOpportunityNode (extraProps precedent, born-proposed no-confirm-path)
  - phase: 150.8
    provides: typed-claim writeClaimNode (the additive-JSON-props discipline extended here)
  - phase: 160
    provides: temporal/supersession supersede (the ONLY legal SUPERSEDES write path)
  - phase: 88
    provides: narrative-schema validateNarrative (governing_thought <=250 + key_claims [3,5])
  - phase: 13
    provides: opportunity-ops bankOpportunity / listOpportunities / computeOpportunityBankState
provides:
  - lib/core/navigation/typed-open-question.cjs (writeOpenQuestionNode, OPEN_QUESTION_NODE_ID)
  - lib/core/navigation/typed-claim.cjs optional extraProps bag (PROTECTED_CLAIM_KEYS)
  - lib/core/navigation.cjs re-export of writeOpenQuestionNode
  - lib/core/close-loop-writer.cjs (writeCloseLoop, findPriorConclusion, mintArtifactId, topicHashOf)
  - lib/core/opportunity-ops.cjs bankOpportunity additive artifact_id + six-reader-field passthrough
  - lib/core/temporal/supersession.cjs walkSupersedesChain (the net-new read-side chain walker)
affects: [223-03 bono --version-log + 8-phase governed body, 223-04 intel-pipeline write-to-graph]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-01 dual write: bank .md FIRST (opportunity-ops), room.db node SECOND, one shared artifact_id minted before either -- a mid-crash leaves a bank-visible artifact, never a dangling node"
    - "conclusion-as-claim-with-marker: a conclusion is a claim-type node carrying extraProps kind:'conclusion' + topic_hash, NOT a new node type (the truth-claim closed set stays frozen)"
    - "run-unique conclusion node id (run_id in the sourceSegment key) so a re-run mints a NEW node -- the substrate the SUPERSEDES chain needs"
    - "read-only chain walker over caller-owned handle: reads are legal outside the write chokepoint; all writes stay in supersede"

key-files:
  created:
    - lib/core/navigation/typed-open-question.cjs
    - lib/core/close-loop-writer.cjs
    - tests/test-223-close-loop.cjs
    - tests/test-223-supersedes-chain.cjs
  modified:
    - lib/core/navigation/typed-claim.cjs
    - lib/core/navigation.cjs
    - lib/core/temporal/supersession.cjs
    - lib/core/opportunity-ops.cjs

key-decisions:
  - "artifact_id scheme = 'artifact:' + 31-multiplier-hash(topic + '|' + name + '|' + date) -- deterministic per (topic,name,day) so a same-day re-run mints the SAME id and dedups alongside bankOpportunity's problem_hash; zero new deps"
  - "opportunity-ops DID need the additive passthrough (the D-01 files_modified NOTE resolved YES): bankOpportunity now emits funder/program/deadline/relevance_score/artifact_id when supplied; reader + six required fields untouched"
  - "the conclusion knowledge_type is 'mental_model' (a governing thought is a synthesis / mental model); the kind:'conclusion' extraProps marker is what distinguishes it, not the node type"
  - "validateNarrative gates via a synthesized COMPLETE MINTO narrative whose only test-driving bounds are governing_thought<=250 + key_claims[3,5]; the other required fields derive from the conclusion text and always pass"

patterns-established:
  - "writeCloseLoop is the ONE spine both surfaces terminate through; injectable seams (bankWriteFn/nodeWriters/edgeWriter/supersedeFn) make every leg hermetically testable"
  - "per-section disclosed failures (SEED-059): a degraded section is reported structurally in summary.failures, never silently dropped"

requirements-completed: ["Req 2", "Req 4"]

# Metrics
duration: 18min
completed: 2026-07-15
---

# Phase 223 Plan 02: Close-the-loop graph-write spine Summary

**The ONE close-the-loop writer both 223 surfaces terminate through: every AI-composed finding enters room.db as a born-proposed typed node through the navigation chokepoint, every opportunity is a governed D-01 dual write (bank .md FIRST + room.db node SECOND joined by one shared artifact_id, crash-tested), every semantic edge lands 'proposed' (D-02) while the SUPERSEDES edge binds NULL (D-04), and the net-new read-side walkSupersedesChain makes the version-cut chain provable end to end.**

## Performance
- **Duration:** ~18 min
- **Completed:** 2026-07-15
- **Tasks:** 3 (all TDD)
- **Files created:** 4; modified: 4

## Accomplishments
- **`writeOpenQuestionNode` (net-new navigation submodule):** closes the write-side gap for the `open_question` type that `insights.findOpenQuestions` has always SELECTed but navigation never shipped a writer for. Born proposed, no-downgrade UPSERT, protected-key extraProps, caller-owned handle (inside the check-substrate allow-list). Re-exported on navigation.cjs.
- **`writeClaimNode` additive extraProps bag:** an optional plain-object bag merged after the fixed keys with a protected-key filter that can never override knowledge_type / text / provenance keys. Carries the conclusion marker + the G-1 provenance tag WITHOUT a new node type or schema change; byte-identical when absent.
- **`close-loop-writer.cjs` (the shared spine):** `writeCloseLoop` implements BUILD-BRIEF Section 6 row by row -- claims, relations (writer-local allow-list SUPPORTS/CONTRADICTS/CONVERGES/INFORMS), killed claims (REJECTED_BECAUSE), conclusion (validateNarrative-gated), knowns (+SUPPORTS to conclusion), unknowns (open_question), opportunities (D-01 dual write), supersession (D-04). `findPriorConclusion` is the read-only lookup Plan 03's version cut uses. `mintArtifactId` is the D-01 cross-reference id.
- **`opportunity-ops.bankOpportunity` additive passthrough:** funder/program/deadline/relevance_score/artifact_id emit into frontmatter when supplied; the reader and the six required fields are unchanged.
- **`walkSupersedesChain` (net-new read walker):** two-direction SUPERSEDES walk to both chain ends, newest->oldest, cycle-guarded, review_status ignored; `supersede`'s body untouched. Ready for Plan 03's `--version-log`.

## Task Commits
1. **Task 1: open_question writer + claim extraProps** - `833a4543` (feat) -- test-223-close-loop Section A green (21 checks)
2. **Task 2: close-loop-writer spine + opportunity-ops passthrough** - `1b6ddad7` (feat) -- test-223-close-loop Section B green (45 checks total)
3. **Task 3: walkSupersedesChain + Req 2 proof** - `a611a731` (feat) -- test-223-supersedes-chain green (21 checks)

## The writeCloseLoop payload contract (Plans 03/04 consume this)
```
payload = {
  surface?: string,                 // also settable via opts.surface: 'bono' | 'intel-pipeline'
  run_id?: string,                  // also opts.run_id; run-unique so re-runs mint new conclusion nodes
  conclusion?: { governing_thought<=250, key_claims: string[3..5], topic },
  claims?:  [{ text, knowledge_type? }],
  knowns?:  [{ text, knowledge_type? }],       // each mints a claim + SUPPORTS -> conclusion
  unknowns?: [ string | { question } ],         // each mints an open_question node
  killed?:  [{ text, reason }],                 // each mints a claim + one REJECTED_BECAUSE edge
  relations?: [{ source_index|source_id, target_index|target_id, edge_type, reason }],
  opportunities?: [{ name, problem, funder?, program?, deadline?, relevance_score?, supports_claim_ids? }],
  priorConclusionId?: string        // when present + conclusion valid -> supersede(prior, new), NULL edge
}
opts = { surface, run_id, sessionId?, dateStr?, nodeWriters?{claim,opportunity,openQuestion}, edgeWriter?, bankWriteFn?, supersedeFn? }
returns { ok, claim_ids[], conclusion_id|null, opportunity:[{node_id, md_path, artifact_id}], open_question_ids[], edges_written, superseded|null, failures:[{section, reason, detail?}] }
```
Note: `supersede` requires the prior conclusion to be CONFIRMED (confirmed->superseded is the only legal transition). The version-cut caller (Plan 03) must confirm-then-supersede; a proposed prior yields a disclosed `supersession` failure, never a silent no-op.

## Deviations from Plan

### Auto-fixed / decisions inside plan scope
**1. [Rule 2 - required for correctness] opportunity-ops.cjs additive passthrough (anticipated by the plan's files_modified NOTE).**
- **Found during:** Task 2. `bankOpportunity` did NOT emit funder/program/deadline/relevance_score/artifact_id, so the D-01 "six reader fields + artifact_id" acceptance could not pass through the shipped writer.
- **Fix:** added an additive frontmatter passthrough following the shipped `provenance`/`engine_mode` idiom (emit only when supplied). Reader + six required fields untouched; every existing caller byte-identical.
- **Files modified:** lib/core/opportunity-ops.cjs. **Commit:** 1b6ddad7.

**2. [scope decision] validateNarrative wrapper.** The shipped `validateNarrative` requires a FULL Feynman-MINTO narrative (section/essence/mental_model/sweet_spot/...), not just governing_thought+key_claims. `writeCloseLoop` wraps the compact conclusion into a complete narrative whose synthesized required fields derive from the conclusion text and always satisfy their bounds, so the verdict is driven ENTIRELY by the two bounds the D-09 threat model names (governing_thought<=250, key_claims[3,5]). This honors the plan's "validateNarrative gates the conclusion" contract while keeping the caller-facing payload compact.

## Issues Encountered (pre-existing, NOT 223-02 regressions; logged to deferred-items.md)
- **`run-all-164.sh` 17/3** -- stale canon-version assertion + test-issue-tree-edge-remap + test-bono-verdict; Phase-224 review_status schema drift, import zero 223-02 files (additional_notes explicit: not ours).
- **`test-219-banking.cjs` Test 4** -- linkOpportunityEvidence DERIVED_FROM assertion on the fresh edges schema (same 224 drift class as the documented run-all-219 11/2). Verified pre-existing by running the test against the HEAD (pre-223-02) opportunity-ops.cjs -- it fails identically; my additive frontmatter change cannot touch linkOpportunityEvidence/writeEdge.
- **`opportunity-ops.cjs:769` em-dash** -- from commit eb59231b (Phase 13-03), far from my additive block; my diff is em-dash clean (verified).

## Verification
- `node tests/test-223-close-loop.cjs` exits 0 (45 checks: Section A 1-4, Section B 1-7)
- `node tests/test-223-supersedes-chain.cjs` exits 0 (21 checks)
- `bash tests/run-all-224.sh` PASS=17 FAIL=0 (shared edges/derivation leg holds)
- `node tests/test-graph-derive-sweep.cjs` 4/4
- Source gates: navigation.cjs required in close-loop-writer; zero raw INSERT INTO nodes|edges; review_status 'proposed' on semantic edges, none on the supersede path; walkSupersedesChain body has zero write tokens; zero new deps.

## User Setup Required
None.

## Next Phase Readiness
- Plan 03 (bono surface) wires `writeCloseLoop` into the 8-phase governed flow and renders `walkSupersedesChain` through `--version-log`; the confirm-then-supersede version-cut contract is documented above.
- Plan 04 (intel-pipeline) calls the SAME `writeCloseLoop` with `opts.surface: 'intel-pipeline'` -- the G-1 provenance marker distinguishes the two surfaces' claims downstream.

## Self-Check: PASSED
All 4 created files exist on disk; all 3 task commits are in the git log.

---
*Phase: 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono*
*Completed: 2026-07-15*
