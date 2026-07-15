# Phase 223: JTBD-driven intelligence pipeline + governed double-fan bono - Research

**Researched:** 2026-07-15
**Domain:** Internal MindrianOS plugin architecture (CJS module seams, connector wiring, graph-write contract). No external stack; this is an evolve-existing-modules phase.
**Confidence:** HIGH (every claim below is file:line-verified against the working tree at commit `cfa48e3f9`; zero training-data reliance, zero external dependency).

## Summary

This phase adds two born-wired surfaces over one shared spine. Nothing here is a greenfield
technology decision: every "standard stack" question is really "what is the exact signature of
an already-shipped module, and where is the clean seam to insert governed behavior without
rebuilding?" I answered each of the planner's ten questions directly from source. The Phase 164
bono substrate (`runCellFanout`, `runDebate`, `runDerivation`, `wireAccept/wireReject`,
`assembleTeam`) is real and reusable exactly as CONTEXT claims; the four net-new files
(`hat-governance.cjs`, `persona-research.cjs`, `commands/intel-pipeline.md`,
`skills/intel-pipeline/SKILL.md`) do not exist anywhere in the tree.

Two BUILD-BRIEF assumptions are stale against the current tree. The first is already caught by
CONTEXT D-03 (compute-hsi.py retired, use eureka measured legs). The second is NEW and matters:
the `sensor_triggers` "drift" the SPEC and BUILD-BRIEF frame as a bug to "reconcile" is actually
the documented, correct DESENSITIZE convention baked into `build-skill-mirrors.cjs`. The command
carries `[SENS-05]`, the mirror carries `[]`, and that asymmetry is intentional and enforced.
The task is to RE-RUN the mirror generator after the bono body change, not to make the two files
agree. Framing it as "converge them" would break the connector registry's duplicate-tuple check.

The Req-4 write-side gap that dominated the SPEC addendum is resolved cleanly by CONTEXT D-01,
and better than the brief knew: `opportunity-ops.cjs` already ships `fileOpportunity` and
`bankOpportunity` markdown writers. D-01's write-through .md should REUSE those (Part 7), not
hand-roll a new writer. The reader that `compute-opportunity-state` calls requires exactly six
frontmatter fields, listed below.

**Primary recommendation:** Build the four net-new files as thin composition wrappers over the
verified seams below. Reuse `fileOpportunity`/`bankOpportunity` for D-01. Treat the
sensor_triggers asymmetry as correct output of `build-skill-mirrors.cjs`, not a defect. The only
genuinely net-new logic is: the hat-governance map (data, not runtime), the persona-research
research-pipe wrapper, the intel-pipeline orchestration prose, and a read-side `--version-log`
SUPERSEDES chain walker (no existing walker ships).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hat governance discipline | `lib/core/bono/` (debate logic) | command prose | Scoped to bono's debate ONLY, never a live-conversation hard-fail (the Phase 210 caution, CONTEXT canonical_refs) |
| Per-persona web research | `lib/core/bono/` + `lib/lens-engine/` | Part 8 egress guard | SIGNAL->LOCAL research ingestion; guarded pre-egress |
| JTBD orientation | `lib/hmi/jtbd-state.cjs` | command prose | Room-local state file, read at calibrate, written at gate |
| Fan sizing / cost | `lib/core/dispatch-optimizer.cjs` | command HITL gates | Budget metadata; the fan-approve gate is the human cost control |
| Compute step (HSI recompute) | `scripts/eureka-room-report.cjs` + `rs-differential-scorer.cjs` | `embedding-spine.cjs` | D-03: measured legs replace the retired compute-hsi.py |
| All graph writes | `lib/core/navigation.cjs` | `navigation/edges.cjs` | Part 9 single chokepoint; proposed-only; byUser confirms |
| Opportunity bank surfacing | `lib/core/opportunity-ops.cjs` (.md) | `navigation/typed-opportunity.cjs` (node) | D-01 dual-write: .md is the bank's source of truth; node rides 224 derivation |
| Connector wiring / gates | `scripts/build-connector-registry.cjs` + siblings | `check-shape-declaration.cjs` | Born-wired, machine-generated, never hand-trusted |

## Standard Stack

Zero new npm dependencies (hard constraint, verified enforceable: `run-all-224.sh` already ships
a git-diff leg on `package.json`/`package-lock.json` that fails on any drift; 223 must copy it).
The "stack" is the set of already-shipped modules this phase composes.

### Core (reuse, verified present)
| Module | Export | Signature (verified) | Role in 223 |
|--------|--------|----------------------|-------------|
| `lib/core/bono/cell-fanout.cjs` | `runCellFanout(opts)` async | `opts={subdomains[],hats[],cap,roomDir,dispatchCell,researchFn,selfCritique,...}` -> `{cells,dropped,plan,dispatchPlan}` | Fan #1 grid; persona-research hooks the `dispatchCell`/`researchFn` seam |
| `lib/core/bono/debate-composition.cjs` | `runDebate(opts)` sync | `opts={cells[],hypothesis,hypothesisId,hats[],roomDir,db,expertsByHat,runChainFn,runDerivationFn,wireAcceptFn,wireRejectFn,selfCritiqueFn,deriveFn,onStep,gateFn,onHalt,journalFns}` | Fan #2 governed debate; hat-governance feeds `deriveFn`/`onStep`/`gateFn` |
| `lib/core/graph-derivation.cjs` | `runDerivation(args)` sync | `args={roomDir,runChain,selfCritiqueFn,deriveFn,artifactPairs,llm}` -> `{proposedNodes,edges,trace}` | claim -> proposed node + CASCADE_SUBSET |
| `lib/core/findings-wirer.cjs` | `wireAccept(db,params)` / `wireReject(db,params)` | `params={finding{title,source,url,retrieved_at,evidence_tier,summary},decision{target_section,target_kind},topic,sessionId}` -> `{ok,node_id,...}` | EvidenceClaim proposed + INFORMS edge |
| `lib/core/expert-library.cjs` | `assembleTeam` | (roster assembly; anti-ossification guards) | persona roster |
| `lib/core/dispatch-optimizer.cjs` | `planDispatch(roomDir,options)` | `options={remainingContext,preferredModel}` -> `{...,budget:{...}}` | fan sizing (advisory cost metadata) |
| `lib/core/research-context-extractor.cjs` | `extractContext(opts)` | -> preflight `{lensSet,...}`; also exports `computeLensSet` | research pre-flight |
| `lib/lens-engine/source-lens-driver.cjs` | `runSourceLens(opts)` async | web-research ingestion -> ranked findings | persona-research web leg |
| `lib/hmi/jtbd-state.cjs` | `getCurrent(roomDir)` / `setCurrent(roomDir,opts)` | see JTBD contract below | intel-pipeline calibrate |
| `lib/memory/narrative-schema.cjs` | `validateNarrative(obj)` | `{governing_thought<=250, key_claims: 3-5 strings each<=200}` -> `{valid,errors}` | Req 2 conclusion shape |
| `lib/core/navigation.cjs` | `writeEdge`, `writeOpportunityNode`, `writeClaimNode`, `writeEvidenceClaim`, `confirmNode` | see graph-write contract below | Part 9 chokepoint |
| `lib/core/navigation/edges.cjs` | `writeEdge(db,params)`, `ALLOWED_EDGE_TYPES` | see edges contract below | edge writer + frozen allow-list |
| `lib/core/opportunity-ops.cjs` | `fileOpportunity`, `bankOpportunity`, `computeOpportunityBankState`, `listOpportunities` | see D-01 contract below | bank .md source of truth (zero db refs) |
| `lib/core/navigation/typed-opportunity.cjs` | `writeOpportunityNode(db,params)` | see contract below | opportunity node (born proposed) |
| `lib/core/rs-differential-scorer.cjs` | `scoreMeasured(a,b,opts)` async | Part-8-guarded measured semantic leg | D-03 compute |
| `scripts/eureka-room-report.cjs` | `main(argv)` async | `--db <roomDir> --offline --top <n> --out <path>` | D-03 per-room HSI recompute entry |
| `lib/core/temporal/supersession.cjs` | `supersede(db,oldNodeId,newNodeId,opts)` | writes ONE SUPERSEDES edge via chokepoint | Req 2 version-cut WRITE side |
| `lib/core/part8-egress-guard.cjs` | `classify(payload,opts)` | see Part 8 contract below | egress guard |

### Net-new (verified absent from the entire tree)
| File | What it is | Smallest correct form |
|------|-----------|------------------------|
| `lib/core/bono/hat-governance.cjs` | A governance MAP keyed by hat (white/black/yellow/green/red/blue) encoding BUILD-BRIEF Section 5's scrutiny table + 5 cross-cutting rules. DATA, not a runtime. | Exports an object + a small selector; `runDebate` consumes it via `deriveFn`/`onStep`/`gateFn` injection seams (all already injectable, verified). |
| `lib/core/bono/persona-research.cjs` | Per-cell `extractContext` -> `runSourceLens` -> `wireAccept` wrapper. | A wrapper injected as `runCellFanout`'s `dispatchCell` (current default is `researchCorpus.fetchCorpus`, NOT the source-lens pipe - so this is genuinely net-new wiring). |
| `commands/intel-pipeline.md` + `skills/intel-pipeline/SKILL.md` | The meta orchestrator surface. | Model the connector block on `commands/act.md` (verified `kind: meta`, `reach_id: context_block`, `sub_mode: act`, `framework: null`, `posture: hold`, `autonomous_safe: false`, `sensor_triggers: []`, `web_scope: null`, `surface: F.1`). |
| `--version-log` SUPERSEDES chain WALKER | Read-side chain traversal for Req 2. | NET-NEW: `supersession.cjs` writes the edge but ships NO chain-read/walk helper. Verified via grep. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `fileOpportunity`/`bankOpportunity` for D-01 .md | Hand-rolling a new bank .md writer | Rejected: Part 7 reuse-before-build; the writers already emit the exact frontmatter the reader needs |
| `persona-research.cjs` as a new file | Extending `cell-fanout.cjs` in place | Either is legal per SPEC Req 1; a new file keeps the fan-out module's parallel-dispatch core untouched and is easier to fixture-test in isolation |

**Installation:** None. Zero new npm dependencies. Verify enforceability by copying
`run-all-224.sh`'s package.json git-diff leg into `run-all-223.sh`.

## Package Legitimacy Audit

Not applicable. This phase installs zero external packages (hard constraint, gated by a
git-diff tripwire on `package.json`/`package-lock.json`). No registry verification required.

## Architecture Patterns

### System Architecture Diagram

```
                        /mos:intel-pipeline (kind: meta, reach_id: context_block)
                                        |
     read STATE/MINTO + jtbd-state.getCurrent(roomDir)
                                        |
                          [HITL F.1 calibrate gate] -- navigator confirms JTBD
                                        |
                     jtbd-state.setCurrent(roomDir,{jtbd,...})   <-- one-shot; see drift loop note
                                        |
                    derive dimensions from JTBD cues (+ generic Brain dims, Part 8 classify)
                                        |
                          planDispatch(roomDir) -> N (budget metadata)
                                        |
                          [HITL F.1 fan-approve gate] -- navigator approves N
                                        |
        dispatch N passes: extractContext -> runSourceLens -> wireAccept (per pass)
                    (quality: low  ===> HALT, disclosed per SEED-059)
                                        |
        compute: scoreMeasured / eureka-room-report.cjs (HSI recompute, D-03)
                                        |
                          [HITL F.5 synthesize gate] -- bull/bear + ACH skeptics
                                        |
        ===================== SHARED CLOSE-THE-LOOP SPINE =====================
        navigation.cjs writes (proposed): claim / opportunity / open_question nodes
              + edges from ALLOWED_EDGE_TYPES (INFORMS/SUPPORTS/CONTRADICTS/CONVERGES/
                REJECTED_BECAUSE/SUPERSEDES)
        D-01: EACH opportunity ALSO writes opportunity-bank/*.md  (.md FIRST, node SECOND)
                                        |
        bash scripts/compute-opportunity-state <roomDir>  (reads .md frontmatter ONLY)
                                        |
        224 auto-derivation fires on the filed .md (feature, assert it) -> derived edges
                                        |
        human confirms via navigation.confirmNode(byUser)   [Part 9]


   /mos:bono (evolved, kind: methodology, reach_id: hats, sub_mode: bono)
     Shape F selector -> runCellFanout (Fan #1, now persona-research per cell)
       -> runDebate (Fan #2, hat-governance map injected)
       -> narrative-schema conclusion + map-unknowns matrix
       -> SAME close-the-loop spine above
       -> version cut: supersession.supersede(prior conclusion) + --version-log walker
```

### Recommended Structure (net-new files only)
```
lib/core/bono/
  hat-governance.cjs      # governance map (data) + selector
  persona-research.cjs    # extractContext -> runSourceLens -> wireAccept per cell
commands/
  intel-pipeline.md       # kind: meta connector, modeled on act.md
skills/intel-pipeline/
  SKILL.md                # generated mirror (build-skill-mirrors.cjs)
tests/
  test-223-bono-v2.cjs
  test-223-intel-pipeline.cjs
  run-all-223.sh          # copy run-all-224.sh aggregator shape
  helpers/fixture-room-223.cjs  # copy buildFixtureRoom224 shape
```

### Pattern 1: Inject governed behavior through existing seams (do not fork runtimes)
**What:** `runDebate` already exposes `deriveFn`, `onStep`, `gateFn`, `selfCritiqueFn`,
`postureFn`, `onHalt` as injectable options (verified lines 262-293). Hat-governance rides these.
**When:** Requirement 1 (governed hats) and the debate HITL gates.
**Example:**
```javascript
// Source: lib/core/bono/debate-composition.cjs:279-293 (default deriveFn shape)
// A governed deriveFn MUST return an ARRAY synchronously. runDerivation throws
// LOUDLY on a Promise-returning deriveFn (CR-01, graph-derivation.cjs:156-159).
const deriveFn = (args) => {
  const pair = args && args.artifactPair;
  if (!pair) return [];
  return [{ source: pair.b, target: pair.a, edge_type: 'CONVERGES', reason: '...' }];
};
```

### Pattern 2: D-01 dual-write via existing bank writers
**What:** Write the bank .md FIRST (reuse `fileOpportunity`/`bankOpportunity`), the room.db node
SECOND (`writeOpportunityNode`). A mid-crash leaves a bank-visible artifact, never a dangling node.
**When:** Every opportunity either surface produces (Requirement 4).
**Example:**
```javascript
// Source: lib/core/opportunity-ops.cjs:648-666 (fileOpportunity frontmatter)
// Reader (computeOpportunityBankState/listOpportunities) requires these fields:
//   funder, program, deadline, relevance_score, status, created
// (verified lib/core/opportunity-ops.cjs:176-180, 1055). Everything else is body.
```

### Anti-Patterns to Avoid
- **Making bono command and skill mirror sensor_triggers agree.** They are SUPPOSED to differ
  (`[SENS-05]` vs `[]`). The DESENSITIZE convention in `build-skill-mirrors.cjs:25-52` rewrites
  that one field to `[]` in the mirror on purpose, so the mirror does not duplicate the command's
  governed tuple into the connector registry. Making them identical would trip
  `build-connector-registry.cjs`'s duplicate-tuple (CONN-03) check.
- **A Promise-returning `deriveFn`.** `runDerivation` is a synchronous composer; it throws loudly
  rather than silently deriving nothing (CR-01). Pre-resolve candidates per pair.
- **Auto-confirming any node.** `writeOpportunityNode` is born `proposed` with no review_status
  arg; only `confirmNode(byUser)` promotes (Part 9). A first-insert `confirmed` edge requires a
  non-empty `byUser` handle (edges.cjs:742-753).
- **Minting a new edge type.** `ALLOWED_EDGE_TYPES` is a frozen Set; `writeEdge` rejects any type
  not in it. All six 223 edge types (INFORMS/SUPPORTS/CONTRADICTS/CONVERGES/REJECTED_BECAUSE/
  SUPERSEDES) are already present.
- **Live-conversation hat hard-fail.** Hat-governance stays scoped to bono's debate logic only
  (Phase 210 caution, CONTEXT canonical_refs). Never a runtime enforcement gate on chat.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bank .md writer for D-01 | New frontmatter emitter | `opportunity-ops.fileOpportunity` / `bankOpportunity` | Already emit the exact 6 fields the reader needs; Part 7 |
| SUPERSEDES edge write | Raw edge insert | `temporal/supersession.supersede(db,old,new,opts)` | Chokepoint-routed, idempotent |
| Frontmatter parse | New YAML parser | `opportunity-ops.parseFrontmatter` | Exported precisely so callers do not hand-roll (Part 7 note in source) |
| Egress classification | Custom deny-list | `part8-egress-guard.classify(payload,opts)` | Default-deny, fail-closed, verdict `allow/block/ambiguous` |
| HSI recompute | compute-hsi.py (RETIRED) | `eureka-room-report.cjs` + `scoreMeasured` | D-03; Python path retired Phase 211 |
| Fan cost math | Custom budget calc | `dispatch-optimizer.planDispatch` | Ships budget metadata |
| Narrative validation | Custom schema check | `narrative-schema.validateNarrative` | Enforces <=250 / 3-5 claims + no-dash walk |
| Test aggregation | New runner | Copy `run-all-224.sh` run/run_if shape | Established PASS/FAIL/SKIP contract |
| Room fixture | New builder | Copy `fixture-room-224.buildFixtureRoom224` | Same room.db + `graphOps.indexArtifact` shape |

**Key insight:** The net-new surface area is deliberately small (CONTEXT/BUILD-BRIEF agree). Every
capability except the hat-governance map (data), the persona-research wrapper, the intel-pipeline
prose, and the `--version-log` walker is a compose-existing-engine task.

## Runtime State Inventory

This is a surface-additive phase, not a rename/refactor. But because it writes to two disconnected
stores (room.db + bank .md), the disconnection inventory is load-bearing:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `room.db` typed nodes (via navigation.cjs) AND `opportunity-bank/*.md` frontmatter (via opportunity-ops.cjs) are TWO DISCONNECTED stores. `opportunity-ops.cjs` has zero `db.`/`openRoomDb`/`navigation` references (verified). | D-01 dual-write bridges them at write time; no reader change |
| Live service config | None. Both surfaces are plugin files; no external service holds 223 state. | None - verified |
| OS-registered state | None. No scheduler/daemon registration. | None - verified |
| Secrets/env vars | `SEMANTIC_FLOOR`, eureka diff-floor, staleness-hours env vars read by scorers - unchanged, code reads them by name. | None; do not rename |
| Build artifacts | `data/connector-registry.json`, `data/render-coverage-registry.json` are GENERATED and must be regenerated after wiring; `skills/bono/SKILL.md` and `skills/intel-pipeline/SKILL.md` are generated mirrors. | Regenerate via build-connector-registry.cjs + build-skill-mirrors.cjs |

**JTBD drift loop (SPEC addendum, non-blocking):** `jtbd-state.setCurrent` is called once at
calibrate; no second call corrects against findings. `setCurrent` also has a manual-override window
(`manualOverrideActive`) that BLOCKS auto writes inside the window (verified lines 116-133). The
planner should either add a fixture asserting intel-pipeline does NOT silently re-write JTBD as a
side effect of findings, OR name drift-correction explicitly out-of-scope (SPEC's own convention).

## Common Pitfalls

### Pitfall 1: Treating the sensor_triggers asymmetry as a defect (SECOND staleness)
**What goes wrong:** SPEC Constraints and BUILD-BRIEF Section 8 both say to "reconcile the
`sensor_triggers` drift between `commands/bono.md` (`[SENS-05]`) and `skills/bono/SKILL.md` (`[]`)."
Read literally, an executor makes them match, which re-introduces a duplicate governed tuple.
**Why it happens:** The word "drift" implies unintended divergence. It is not.
`build-skill-mirrors.cjs:44-51` deliberately rewrites `sensor_triggers` to `[]` in the mirror for
any command with `connects_to_spine:true` and non-empty `sensor_triggers` (the CONN-03 / DESENSITIZE
exception). The current tree ALREADY shows this correct state (skill line 38 = `[]`, command line 38
= `[SENS-05]`).
**How to avoid:** The task is: after the bono.md body change, RE-RUN `build-skill-mirrors.cjs` so
the mirror stays byte-identical to the command EXCEPT the one desensitized field. Do NOT converge.
**Warning signs:** `build-connector-registry.cjs --check` reporting a duplicate (sensor,reach_id,
sub_mode) tuple after edits.

### Pitfall 2: A Promise-returning deriveFn silently deriving nothing
**What goes wrong:** The score-based / async-LLM producer returns a Promise; a naive synchronous
composer would drop it silently.
**Why it happens:** `runDerivation` is synchronous by design.
**How to avoid:** Post-224 it throws loudly (CR-01, graph-derivation.cjs:156-159). Pre-resolve
candidates per pair before calling. Both bono's default deriveFn and any 223 producer are sync.
**Warning signs:** A thrown "Promise-returning deriveFn" error at debate time.

### Pitfall 3: Req-4 acceptance measuring the wrong store
**What goes wrong:** Asserting `compute-opportunity-state` surfaces a node written ONLY to room.db.
It never will - the reader reads .md frontmatter only.
**Why it happens:** The two stores are disconnected (documented gap).
**How to avoid:** D-01 dual-write. The Req-4 acceptance test must assert BOTH: node in room.db
(proposed) AND opportunity visible in the bank rollup via the written-through .md (CONTEXT specifics).
**Warning signs:** A green room.db assertion with an empty bank rollup.

### Pitfall 4: compute-hsi.py in the compute step
**What goes wrong:** BUILD-BRIEF Section 3 reuse map lists `compute-hsi.py` / `discover-*-whitespace.py`.
**Why it happens:** The brief predates Phase 211's D2 retirement of the LSA path.
**How to avoid:** D-03 override - use `eureka-room-report.cjs` + `scoreMeasured`. No Python from
the new surface (SEED-013 direction).

### Pitfall 5: Feynman/MINTO prompt byte-drift
**What goes wrong:** The conclusion step touches `lib/memory/feynman-prompts.cjs`, which is
byte-checked, and the check fails.
**How to avoid:** If the conclusion step references those prompts, keep them byte-identical
(SPEC constraint).

## Code Examples

### JTBD state contract (Requirement 3 calibrate)
```javascript
// Source: lib/hmi/jtbd-state.cjs:83-150, path = roomDir/.mindrian/jtbd-state.json
const jtbd = require('./lib/hmi/jtbd-state.cjs');
const current = jtbd.getCurrent(roomDir);
// -> { jtbd, confidence, entered_at, evidence:[], expires_at } | null
jtbd.setCurrent(roomDir, { jtbd: 'decide-pursue', confidence: 0.8,
  evidence: ['...'], trigger: 'intel-pipeline-calibrate', manual: false });
// NOTE: an active manual-override window blocks a non-manual setCurrent (records a
// blocked history row, leaves current untouched). Relevant to the drift-loop guardrail.
```

### edges.cjs review_status + SUPERSEDES (D-02, D-04)
```javascript
// Source: lib/core/navigation/edges.cjs:717-774
// VALID_REVIEW_STATUS = {'proposed','confirmed'}; absent binds NULL.
// D-02 semantic edges: pass review_status:'proposed'.
navigation.writeEdge(db, { source_id, target_id, edge_type:'CONTRADICTS',
  properties:{...}, review_status:'proposed' });
// D-04 SUPERSEDES: pass NO review_status (binds NULL, "not a proposal").
navigation.writeEdge(db, { source_id:newConcl, target_id:priorConcl,
  edge_type:'SUPERSEDES', properties:{...} });   // NULL review_status
// WR-06: a 'confirmed' row is never downgraded and its properties are withheld on
// re-derivation. byUser required for a first-insert 'confirmed' edge.
```

### Part 8 egress classify (per-persona research boundary)
```javascript
// Source: lib/core/part8-egress-guard.cjs:231-270
const guard = require('./lib/core/part8-egress-guard.cjs');
const v = guard.classify(payload, { toolName: 'brain_ask' });
// -> { verdict:'allow'|'block'|'ambiguous', class, reason }  (reason carries NO offending bytes)
// Default-deny content scan first; only generic methodology vocab -> allow.
```

### Eureka measured compute (D-03)
```javascript
// Source: rs-differential-scorer.cjs:483-595 ; scoreMeasured is async, auditQueryString-guarded.
const { scoreMeasured } = require('./lib/core/rs-differential-scorer.cjs');
const r = await scoreMeasured(textA, textB, { vectors:[vA, vB] });
// Per-room recompute entry: node scripts/eureka-room-report.cjs --db <roomDir> [--offline]
// Needs eureka_vec index populated (triModal.indexNodes) + encoder available; encoder_unavailable
// is disclosed honestly, not silently zeroed (SEED-059).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| compute-hsi.py LSA path | eureka measured legs (`scoreMeasured` + embedding-spine) | Phase 211 D2 | D-03 override of BUILD-BRIEF Section 3 |
| Undifferentiated bono hats | governed hat personas (this phase) | Phase 223 | Req 1 |
| bono conclusion with no version awareness | SUPERSEDES chain + `--version-log` | Phase 223 | Req 2 (walker is net-new) |
| edges with no review lifecycle | edge-level review_status (proposed/confirmed/NULL) | Phase 224 D-05 | D-02/D-04 ride it |
| Normal .md writes never derived into graph | per-write auto-derivation (CONVERGES/INFORMS) | Phase 224 | 223's filed .md gains derived edges (assert as feature) |

**Deprecated/outdated:**
- `scripts/compute-hsi.py`, `discover-*-whitespace.py` in the compute step: retired Phase 211,
  overridden by CONTEXT D-03.
- BUILD-BRIEF Section 8's "reconcile sensor_triggers drift" framing: the asymmetry is correct
  DESENSITIZE output, not a defect.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact governed-flow prose for bono.md and intel-pipeline SKILL.md is drafted from SPEC + BUILD-BRIEF Sections 5/6, not transcribed (source dir `~/mindrian-designs/` absent) | Net-new files | SPEC Constraint Clarity 0.55; prose may not match original designer intent. Reconcile as fast-follow if the dir surfaces (Req 6). |
| A2 | `persona-research.cjs` should inject as `runCellFanout`'s `dispatchCell` seam | Pattern 1 | Cell-fanout currently uses `researchCorpus.fetchCorpus`; if the intended integration point is different, wiring differs (both are legal per Req 1). |
| A3 | D-01 write-through should reuse `fileOpportunity`/`bankOpportunity` | Don't Hand-Roll | If those writers omit a field a future reader needs, a thin extension is required (current 6 fields verified sufficient). |
| A4 | The `--version-log` walker is net-new (no existing chain-read helper) | Net-new | Verified by grep; low risk. |

## Open Questions

1. **Artifact-id cross-reference scheme for D-01's node + .md pair (Claude's Discretion).**
   - What we know: `writeOpportunityNode` mints `OPPORTUNITY_NODE_ID(sessionId, name)`;
     `fileOpportunity` names the .md `${today}-${slug}.md`; `bankOpportunity` dedups on
     `problem_hash` (8-char prefix).
   - What's unclear: which id is the durable cross-reference (node_id in the .md frontmatter, or a
     shared artifact_id minted first).
   - Recommendation: mint one `artifact_id` before either write, put it in the .md frontmatter AND
     `writeOpportunityNode`'s `extraProps`, so the pair is joinable from either store. Decide at plan time.

2. **Fan sizing / planDispatch budget defaults (Claude's Discretion).**
   - What we know: `planDispatch(roomDir, options)` returns a `budget` block; `runCellFanout` clamps
     to `FUTURES_FANOUT_CAP`.
   - Recommendation: cap per-persona research fan low by default; the fan-approve F.1 gate is the
     navigator-facing cost control, not a hidden limit (SPEC constraint).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js CJS runtime | all modules | Yes | >=22.5.0 (package.json) | none needed |
| `better-sqlite3` (room.db) | navigation writes, eureka index | Yes (shipped dep) | vendored | none |
| `@huggingface/transformers` encoder | eureka measured leg (D-03) | Optional | lazy-loaded | `encoder_unavailable` disclosed (SEED-059); `--offline` stub encoder for tests |
| Python | compute step | N/A | - | NOT USED (D-03 retires it) |
| Web (SIGNAL) for persona research | Req 1 web legs | runtime | - | Part 8 classify gates every egress; research degrades to LOCAL-only if blocked |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the transformers encoder (offline stub / disclosed unavailable).

## Validation Architecture

Nyquist enabled (no `workflow.nyquist_validation:false` in config).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Custom: bash aggregator (`run-all-<phase>.sh`) driving node `.cjs` test files with in-file asserts. No jest/mocha. |
| Config file | none - aggregator convention |
| Quick run command | `node tests/test-223-bono-v2.cjs` (single leg) |
| Full suite command | `bash tests/run-all-223.sh` |

### Phase Requirements -> Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| REQ-1 | Governed hats: Black cites disconfirming evidence first; heterogeneity (no two cells share a lens); persona cannot cite a source outside its wired INFORMS set | unit | `node tests/test-223-bono-v2.cjs` | Wave 0 |
| REQ-2 | 2-run fixture -> exactly one SUPERSEDES edge + `--version-log` order; 1-run -> zero | unit | `node tests/test-223-bono-v2.cjs` | Wave 0 |
| REQ-3 | `--dry-run` emits phase/fan plan; real run writes >=1 claim; halts at 3 hitl_stages; `quality:low` forced HALT | integration | `node tests/test-223-intel-pipeline.cjs` | Wave 0 |
| REQ-4 | Both surfaces write claim/opportunity/open_question (proposed) in room.db; `compute-opportunity-state` surfaces via .md; `confirmNode` requires `byUser` | integration | `node tests/test-223-intel-pipeline.cjs` + bono leg | Wave 0 |
| REQ-5 | connector-registry `--check` (+2 entries, 0 changed reach), check-shape-declaration, orchestration-projection `--check`, render-coverage, Part 8 egress test, doctor `--acceptance` | gate | legs in `run-all-223.sh` | Wave 0 |
| REQ-6 | `grep -r "mindrian-designs" commands/ skills/ lib/core/bono/` returns nothing | gate | grep leg in `run-all-223.sh` | Wave 0 |

### Sampling Rate
- **Per task commit:** the single relevant `node tests/test-223-*.cjs` leg.
- **Per wave merge:** `bash tests/run-all-223.sh`.
- **Phase gate:** full suite PASS 0 FAIL 0 SKIP + `node scripts/doctor.cjs --acceptance` (subset-of-documented-baseline rule per run-all-224.sh).

### Wave 0 Gaps
- [ ] `tests/test-223-bono-v2.cjs` - Req 1, Req 2
- [ ] `tests/test-223-intel-pipeline.cjs` - Req 3, Req 4
- [ ] `tests/run-all-223.sh` - copy run-all-224.sh aggregator + package.json git-diff zero-dep leg + Part 8 grep sweep + Req 6 grep leg + structural gate legs
- [ ] `tests/helpers/fixture-room-223.cjs` - copy `buildFixtureRoom224` shape (room.db + `graphOps.indexArtifact`); confirm reusability vs a 223-specific artifact set
- [ ] Register in `run-feynman-tests.cjs` (CONTEXT integration point)

## Security Domain

`security_enforcement` is not disabled; the phase's security surface is Canon Parts 8 and 9.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Part 9: only `confirmNode(byUser)` promotes a node; no auto-confirm |
| V5 Input Validation | yes | `narrative-schema.validateNarrative`; `writeEdge` rejects non-allow-list edge types; `writeOpportunityNode` validates lifecycle |
| V6 Cryptography | no | none introduced |
| V10 Malicious Code / Egress | yes | Part 8: `part8-egress-guard.classify` default-deny on every Brain call; grep-gated egress test asserts no LOCAL content reaches Brain |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LOCAL user content egressing to Brain via persona/dimension research | Information Disclosure | `classify` fail-closed + generic-handle-only; seeded-breach rejection test (Req 5) |
| Unbounded per-persona research fan (cost DoS) | Denial of Service | `FUTURES_FANOUT_CAP` clamp + planDispatch budget + fan-approve gate |
| AI-proposed claim auto-confirmed as truth | Elevation of Privilege | proposed-only writes; byUser required; WR-10 gate |
| Unreviewed proposed edges competing with confirmed in scoring | Tampering | WR-06 clobber guard (confirmed never downgraded); noted lower-severity eureka read-all in AI-SPEC Section 6 |

## Sources

### Primary (HIGH confidence - verified in working tree)
- `commands/bono.md`, `skills/bono/SKILL.md` - current bono flow + connector block + sensor_triggers state
- `lib/core/bono/cell-fanout.cjs:195-304`, `debate-composition.cjs:247-322` - runCellFanout/runDebate signatures + seams
- `lib/core/graph-derivation.cjs:148-191` - runDerivation CR-01 sync/throw contract
- `lib/core/findings-wirer.cjs:133-175` - wireAccept params
- `lib/hmi/jtbd-state.cjs:83-220` - getCurrent/setCurrent + manual override
- `lib/core/dispatch-optimizer.cjs:214-282` - planDispatch
- `lib/core/research-context-extractor.cjs:253-283`, `lib/lens-engine/source-lens-driver.cjs:422-719` - extractContext/runSourceLens
- `lib/core/opportunity-ops.cjs:158-188, 640-684, 1032-1111, 1127+, 1371-1400` - reader fields + fileOpportunity/bankOpportunity
- `lib/core/navigation/typed-opportunity.cjs:194-279` - writeOpportunityNode born-proposed
- `lib/core/navigation/edges.cjs:32-154, 695-774` - ALLOWED_EDGE_TYPES + review_status + WR-06/WR-10
- `lib/core/part8-egress-guard.cjs:223-274` - classify
- `lib/core/rs-differential-scorer.cjs:413-595`, `scripts/eureka-room-report.cjs:286-340`, `lib/core/eureka/embedding-spine.cjs` - D-03 compute
- `lib/core/temporal/supersession.cjs:49-145` - supersede (write only; no walker)
- `lib/memory/narrative-schema.cjs:34-375` - validateNarrative
- `scripts/build-skill-mirrors.cjs:25-52` - DESENSITIZE convention (staleness finding)
- `commands/act.md:7-59` - kind:meta connector reference
- `scripts/check-shape-declaration.cjs:161-228` - hitl_stages gate (advisory WARN)
- `tests/run-all-224.sh:1-60`, `tests/helpers/fixture-room-224.cjs:211-280` - test infra shapes

### Secondary
- `223-SPEC.md`, `223-CONTEXT.md`, `223-BUILD-BRIEF.md` - locked requirements + decisions (this phase)
- `./CLAUDE.md`, `.claude/includes/*` - Canon Parts 3/7/8/9/11/12, release lockstep, no-em-dash rule

### Tertiary
- None. No web research needed or performed (internal-architecture phase).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - every module signature file:line-verified in the working tree.
- Architecture: HIGH - seams confirmed by reading the injectable-option blocks directly.
- Pitfalls: HIGH - the two staleness findings (compute-hsi.py, sensor_triggers) verified against
  source, not inferred.
- Governed-flow prose (A1): MEDIUM - drafted per Req 6 fallback; source dir absent.

**Research date:** 2026-07-15
**Valid until:** 2026-08-14 for module signatures (stable internal code); re-verify if Phase 224/225
lands further edge-lifecycle or opportunity-bank changes.

## RESEARCH COMPLETE

**Phase:** 223 - JTBD-driven intelligence pipeline + governed double-fan bono
**Confidence:** HIGH

Five most decision-relevant findings:
1. **SECOND staleness (new, matters):** the bono `sensor_triggers` "drift" (`[SENS-05]` command vs
   `[]` mirror) is the CORRECT, enforced DESENSITIZE convention in `build-skill-mirrors.cjs`, not a
   bug. The task is RE-RUN the mirror generator, never converge the two - converging would trip the
   connector registry's duplicate-tuple check. This changes planning: it is a "regenerate" task, not
   a "reconcile" task.
2. **D-01 has a better reuse than the brief knew:** `opportunity-ops.cjs` already ships
   `fileOpportunity`/`bankOpportunity` .md writers emitting exactly the six frontmatter fields the
   reader needs (funder, program, deadline, relevance_score, status, created). The write-through .md
   should reuse them (Part 7), not hand-roll.
3. **All seams are already injectable:** `runDebate` exposes `deriveFn/onStep/gateFn/selfCritiqueFn/
   postureFn/onHalt`; `runCellFanout` exposes `dispatchCell/researchFn/selfCritique`. Hat-governance
   and persona-research wire in through these - zero runtime rebuild. But `runDerivation` throws
   loudly on a Promise deriveFn (CR-01): pre-resolve candidates.
4. **The `--version-log` SUPERSEDES chain WALKER is genuinely net-new** - `supersession.cjs` writes
   the edge (`supersede`) but ships no chain-read helper. D-04's NULL review_status on SUPERSEDES is
   the default (pass no review_status arg).
5. **Req-4 write-side gap is real and D-01 resolves it:** `opportunity-ops.cjs` has zero db
   references (verified), `writeOpportunityNode` writes room.db only - the dual-write is mandatory,
   and the Req-4 acceptance test must assert BOTH stores. Compute step uses eureka measured legs
   (D-03), not the retired compute-hsi.py (BUILD-BRIEF Section 3 stale on this, already overridden).
