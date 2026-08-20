# Phase 258: Reconcile the Wave (hard-gates all writing phases) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 258-reconcile-the-wave-hard-gates-all-writing-phases
**Areas discussed:** GRAPH-WRITE-LOG format, RECON-03 timing (operator leg), Order-collision surgery approach

---

## GRAPH-WRITE-LOG format

| Option | Description | Selected |
|--------|-------------|----------|
| Append-only file only | Brain repo, git-diffable, no new graph query surface | |
| Graph node only | Queryable via Cypher, doubles write surface | |
| Both, log node points at file's commit SHA | File is source of truth, node adds queryability | ✓ |

**User's choice:** Both, log node points at the file's commit SHA
**Notes:** File is source of truth (git-diffable), graph node is queryability layer.

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal (date, phase, commit SHA, summary) | Matches existing tracked-doc density | |
| Detailed (+ counts, requirement ID, operator name) | More audit-grade | ✓ |

**User's choice:** Detailed
**Notes:** Audit-grade traceability preferred over minimal maintenance burden.

| Option | Description | Selected |
|--------|-------------|----------|
| New label: GraphWriteEvent | Purpose-built, no collision with existing labels | ✓ |
| Reuse existing generic label | Avoids adding a label to an already-labeling-troubled graph | |

**User's choice:** New label: GraphWriteEvent

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add to P0-1 ontology-gate allowed set now | Closes the loop the debug doc diagnosed | ✓ |
| No, defer to Phase 260's ontology-gate work | Keep 258 narrowly scoped | |

**User's choice:** Yes, add it to the allowed set now

---

## RECON-03 timing (operator leg)

| Option | Description | Selected |
|--------|-------------|----------|
| Document as checklist, complete separately | Navigator's own timing, not a hard block | ✓ |
| Block phase completion until done synchronously | Pause execute-phase mid-run | |

**User's choice:** Document as a prerequisite checklist, complete separately

| Option | Description | Selected |
|--------|-------------|----------|
| RECON-04 waits for RECON-03 | Avoids baselining an incomplete graph | ✓ |
| RECON-04 runs independently | Unblocks downstream phases sooner | |

**User's choice:** RECON-04 waits for RECON-03

| Option | Description | Selected |
|--------|-------------|----------|
| Land RECON-01/02 now, checkpoint on RECON-03/04 | Real progress now, human_needed for the rest | ✓ |
| Hold the whole phase | Nothing lands until full sequence done in one sitting | |

**User's choice:** Land RECON-01/02 now, checkpoint on RECON-03/04

| Option | Description | Selected |
|--------|-------------|----------|
| Resume together when ready | Claude verifies + confirms admin-key rotation | ✓ |
| Purely own hands, just a checkbox | No Claude involvement in RECON-03 itself | |

**User's choice:** Resume together when ready

---

## Order-collision surgery approach

| Option | Description | Selected |
|--------|-------------|----------|
| Same card pattern as Enrichment Ceremony | Statement-level guard, id+name check, approve-before-write | ✓ |
| Lighter direct fix, no card | Just fix + log, skip per-item approval | |

**User's choice:** Same human-reviewed card pattern as the Enrichment Ceremony

| Option | Description | Selected |
|--------|-------------|----------|
| Card proposes value + marks r.order deprecated | Structural fix per the already-ruled order-channel decision | ✓ |
| Card only flags conflict, resolved live | Defers the value choice to the write session | |

**User's choice:** Card proposes the new order value + marks edge r.order deprecated

| Option | Description | Selected |
|--------|-------------|----------|
| Inside Phase 258 now | Phase 260 plans against an already order-clean graph | ✓ |
| Deferred into Phase 261's ceremony | Batch with the bigger enrichment writes | |

**User's choice:** Inside Phase 258 now

| Option | Description | Selected |
|--------|-------------|----------|
| Full admin-window discipline applies | "Any ceremony," not "any large ceremony" | ✓ |
| Lighter approval, full discipline reserved for 261 | Save the formal protocol for higher write volume | |

**User's choice:** Full admin-window discipline applies here too

---

## Claude's Discretion

- Exact GRAPH-WRITE-LOG file path/name within the Brain repo.
- `GraphWriteEvent` node's remaining property shape beyond the 4 named fields.
- Exact card wording/format for the 2 order-collision cards (follow the Enrichment
  Ceremony's existing template if one exists on disk).

## Deferred Ideas

None - discussion stayed within phase scope. 4 candidate todo matches were reviewed
(todo.match-phase for 258) but none folded: all scored on generic keyword overlap
("plan"/"phases"/"before"/"wave"; "brain"/"research"/"phase"/"writing"), none genuinely
about RECON-01..04's actual scope (census diff, order-collision surgery, second-machine
sync, write-log convention).
