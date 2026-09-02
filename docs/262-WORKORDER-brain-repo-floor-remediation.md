# Work Order: Brain-Repo Floor Remediation (Phase 262)

## 1. What This Is and What It Is Not

This is a work order FROM `MindrianOS-Plugin` Phase 262 TO the `ProblemsWorthSolving-Brain`
repo's own todo / phase intake. It is a request with evidence, not an executed change. Nothing
in this document was run against canon, and nothing in the Brain repo was created or edited to
produce it.

Reason this travels as a document rather than an inline edit: the two repos have independent
`.planning/` trees and independent roadmaps. An edit made in the Brain repo's codebase or graph
from a session working under a MindrianOS-Plugin phase number would be invisible to the Brain's
own STATE.md and ledger - exactly the unattributable-write class Pitfall 6 (RECON-01) exists to
kill. Filing this as a request into that repo's own intake keeps the work visible to whoever
next opens that repo.

## 2. The Blocker, Stated as a Measurement

From Plan 262-04's `tools/list` check against `https://pws-brain-mcp.onrender.com` (read-tier
key, measured against the incumbent Brain on 2026-09-02): 31 tools total. `brain_write`:
ABSENT. `ingest_framework`: ABSENT. `BRAIN_HTTP_ADMIN=deny` since 2026-09-01T20:54:40Z.

Six of the items below need a graph write and therefore need an operator-opened admin window
before they can land. Item 3 (FLOOR-03) is the exception and needs no admin window at all - it
is a read-path code change.

## 3. Item 1: The SEP Name Repair

Node ids 28757 (the HSI Semantic Surprise Analysis Assistant phantom) and 28775 (the PWS Triple
Validation Compass phantom). Both nodes carry a `<SEP>`-corrupted, multi-sentence `name`
property instead of the framework's actual name (measured against the incumbent Brain on
2026-09-02, `docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 4). The live per-row counts:
HSI Semantic Surprise Analysis Assistant resolves to 2 canonical matches (score 2/4); PWS Triple
Validation Compass resolves to 2 canonical matches (score 3/4).

The causal link, stated plainly: these two nodes break two NAMED rows of the ratified
28-framework floor. This is not cosmetic hygiene; it has a named consumer (the floor gate) and a
named measured cost (two floor rows red).

Cross-reference: the Brain repo's own Phase 5 Success Criterion 3 already owns the
archived-block name repair for the 71-node `<SEP>`-corrupted set that both phantom nodes belong
to (ids 28000-29000).

Acceptance condition, written as a behavior per assumption A2, not as a state: the repair is
done when `normalize_framework_name` returns exactly 1 canonical match for "HSI Semantic
Surprise Analysis Assistant" and returns exactly 1 canonical match for "PWS Triple Validation
Compass". NOT "the names are repaired" - a truncated-but-still-substring-colliding repair (for
example, a name cut to its leading sentence that still contains the framework's name as a
substring) would satisfy a state condition like "the name is fixed" while leaving both floor
rows red, because the direct-match branch of `NORMALIZE_NAME_CYPHER` would still return two
hits.

## 4. Item 2: The `pattern_type` Write-Path Shortfall

Cross-reference:
`ProblemsWorthSolving-Brain/.planning/todos/pending/2026-09-02-fix-pattern-type-readiness-shortfall-on-existing-frameworks.md`.
This was explicitly reviewed during that repo's own `/gsd-discuss-phase 5` and explicitly kept
OUT of Phase 5's scope, because it is a scoring/readiness-pipeline defect rather than a
graph-schema/entity-reconciliation one. Consequence: it is currently unowned by any planned
phase in either repo.

Measured per-dimension evidence, all against the incumbent Brain on 2026-09-02
(`docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 5): `pattern_type` reads 0 on seven of the
eight MISS rows (HSI Semantic Surprise Analysis Assistant, PWS Triple Validation Compass, The
Pyramid Principle, Adaptive Leadership, Four Lenses of Innovation, MECE, Mullins Model). Scenario
Planning is the sole exception, already carrying `pattern_type = 1`. Applying a +1 correction to
every affected row yields roughly 22/28, not 28/28 - Adaptive Leadership and Mullins Model clear
to PASS on this fix alone; Four Lenses of Innovation and MECE carry an honest sub-floor ceiling
their own 261-05 and 261-07 payloads already disclosed and need real content enrichment beyond a
scoring fix; HSI stays blocked by its resolver defect (Item 1); The Pyramid Principle stays
blocked by the name-target mismatch (Item 4).

This is a request for scoping, not a request for a fix. Per D-02, this defect needs its own
root-cause pass and probably its own Brain-repo phase; Phase 262 does not absorb it.

## 5. Item 3: FLOOR-03, the Hop-Depth-1 Alias Fork

This is the one item that needs NO admin window: it is a read-path code change, not a graph
content write.

Traced mechanism, measured against the incumbent Brain on 2026-09-02
(`docs/262-LIVE-MEASUREMENT-EVIDENCE.md` Measurement 2 and Measurement 3): the live alias
topology is `18880 "Scenario Planning Methodology" -[:ALIAS_OF]-> 23450 "Scenario planning
methodology" -[:ALIAS_OF]-> 34362 "Shell Scenario Planning Method" (terminal)`. The alias
branch of `NORMALIZE_NAME_CYPHER` (`src/arm1-orchestrator.mjs:87`) stops at one hop and emits
node 23450's own name as canonical instead of walking to the terminal node 34362. `reduce`
dedups by string, not by node, so both survive: `normalize_framework_name("Scenario Planning")`
returns `["Shell Scenario Planning Method", "Scenario planning methodology"]`, a live count of
2, confirmed independently four times across two graph states.

Frame the ask in D-05's exact terms: close the gap between the current Brain's silent-fork
behavior and the refusal-on-fork behavior Theo's resolver already ships. Theo's own
`resolveFramework`, read at `/home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts`,
already treats this exact shape - a fork one hop into an alias chain - as a named `ALIAS_FORK`
refusal code, never a silent multi-match. This is a gap-closure with a working reference
implementation, not a from-scratch design.

Two candidate fix shapes, per assumption A1:

1. **Mirrored terminal guard on the alias branch** (the Part 7 reuse answer): add
   `AND NOT exists((canon)-[:ALIAS_OF]->(:Framework))` to the alias branch's `WHERE` clause,
   mirroring the guard the direct branch already carries.
2. **Variable-length `-[:ALIAS_OF*1..3]->` form**: riskier, carries cycle exposure and cost, and
   needs a live execution check on this Memgraph build before it can be trusted.

Both candidate forms must be executed READ-ONLY against canon before either is written into a
Brain-repo plan, per assumption A1's discharge procedure - exactly as 260's own research flag
was discharged before it shipped.

Blast-radius warning: the guard changes `normalize_framework_name` for every framework, so it is
a floor-wide change, not a single-row patch. Re-run the full 28-row floor gate against the
modified Cypher before and after. `NORMALIZE_NAME_CYPHER` is already exported from
`src/arm1-orchestrator.mjs` (deliberately, by 260-03), so a before/after matrix across every
name-matching reader is directly reproducible.

## 6. Item 4: The Pyramid Principle Card, Carried Across Unadjudicated

Two nodes, both measured against the incumbent Brain on 2026-09-02: the ratified floor name
"The Pyramid Principle" (node 30242, readiness 0/4) and the node `minto-pyramid.mjs` actually
enriches, "Minto Pyramid" (node 38968, readiness 3/4). Both competing 261-08 rulings - author a
fresh payload directly against node 30242, or formally retarget the floor's ratified name to
node 38968 - survive intact here, unadjudicated.

Phase 262 declined to decide this. It is a Brain-repo content decision, and Phase 262 does not
own Brain-repo content decisions (D-02's own routing rule). The full card, with both rulings
named, lives in `docs/262-FLOOR-01-GAP-LEDGER.md` Section 7.

## 7. Security Constraints (Restated, So They Travel With the Request)

- **Parameterized `$raw` only.** Never string-interpolate a framework name into Cypher, in the
  proposed fix or in any variant of it - the guard must stay parameterized on every branch it
  touches. This applies to both candidate shapes named in Item 3 above.
- **`brain_query`, not `text2cypher`.** `brain_query` is read-only, bounded, and refuses
  non-reads. `text2cypher` executes model-authored Cypher and is a known open exposure per the
  2026-08-10 Brain service audit; it must never be reached for for this remediation, including
  for the read-only discharge probes named in Item 3.
- **Admin-disable is the LAST scripted item of any window that opens.** The 2-day-open lesson:
  ceremony order is itself a security control, and disabling admin access is the final scripted
  step, after probes and records, not before.

## 8. Filing Instruction

File this into the Brain repo's own `.planning/todos/pending/` intake, or its phase intake, from
a session actually working in `ProblemsWorthSolving-Brain`. Do not execute any part of this work
order from `MindrianOS-Plugin` - Item 1 and Item 4 need a graph write behind an admin window
this repo cannot open; Item 3 is a code change in a repo this session accessed read-only; Item 2
is a scoping request for a defect this repo does not own.
