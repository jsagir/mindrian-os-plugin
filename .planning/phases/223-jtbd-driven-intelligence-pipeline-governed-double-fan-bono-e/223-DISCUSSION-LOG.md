# Phase 223: JTBD-driven intelligence pipeline + governed double-fan bono - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono-e
**Framing:** "223 in a post 224 world" (navigator's words) - all four areas re-grounded against
Phase 224's SHIPPED implementation (complete, verified 7/7, threat-secure) rather than its plans.
**Areas discussed:** Req-4 write-side gap, 224-derivation interplay, Compute layer swap,
SUPERSEDES chain semantics

---

## Req-4 write-side gap

| Option | Description | Selected |
|--------|-------------|----------|
| Write-through .md pair | Each opportunity node also files a bank markdown artifact; zero reader changes; 224 derives on the filed .md too | Y |
| Extend opportunity-ops to read room.db | One write, but touches a shipped reader and creates two sources of truth | |
| Accept the gap this phase | Nodes visible via /mos:graph only; needs a SPEC amendment | |

**User's choice:** Write-through .md pair
**Notes:** Grounded in the 2026-07-15 concurrent-session finding committed into 223-SPEC.md:
compute-opportunity-state -> opportunity-ops.cjs reads only opportunity-bank/*.md frontmatter
(zero db references confirmed); Phase 224's four pipes are all the opposite direction, so 224
shipping did NOT close this. Write ordering locked: .md first, node second.

---

## 224-derivation interplay

| Option | Description | Selected |
|--------|-------------|----------|
| Direct writes, proposed, D-05 pattern | Semantic/stance edges written directly (incl. CONTRADICTS, which 224's classifier never claims), review_status='proposed'; PRIMARY KEY idempotency + WR-06 clobber guard absorb overlap | Y |
| Route everything through 224's harness | File markdown only; loses all stance edges - guts bono's core value | |

**User's choice:** Direct writes, proposed, D-05 pattern

---

## Compute layer swap

| Option | Description | Selected |
|--------|-------------|----------|
| Eureka measured legs | The shipped 211-216 machinery - the exact replacement Phase 211 D2 named when retiring compute-hsi.py's LSA path | Y |
| Keep compute-hsi.py scripts | Honors BUILD-BRIEF Section 3 literally but calls a retired path and adds Python to a fresh surface | |

**User's choice:** Eureka measured legs
**Notes:** BUILD-BRIEF Section 3 formally overridden on this point in CONTEXT.md D-03.

---

## SUPERSEDES chain semantics

| Option | Description | Selected |
|--------|-------------|----------|
| NULL (mechanical edge) | "A newer run exists" is a system fact, not a truth-claim; matches D-05's documented NULL semantics; --version-log stays mechanical | Y |
| proposed (navigator ratifies) | More Part-9-pure but leaves two live conclusions until ratification and makes chain order confirmation-contingent | |

**User's choice:** NULL (mechanical edge)

---

## Claude's Discretion

- Hat-governance map encoding (BUILD-BRIEF Section 5 as source)
- Artifact-id cross-reference scheme for the node + .md pair
- intel-pipeline SKILL.md prose (Requirement 6 fallback)
- Fan sizing / planDispatch budget defaults

## Deferred Ideas

- opportunity-ops.cjs room.db second-source reader (rejected D-01 alternative)
- Multi-room / portfolio intel-pipeline fan-out
- ~/mindrian-designs/ reconciliation fast-follow
- SEED-057 synthesis-as-votable-expert (gate half-cleared by 222+224; separate navigator call)
