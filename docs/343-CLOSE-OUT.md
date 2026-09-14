# Phase 343 Close-Out: The Room-Graph Census and the Counter-Metric Rule

Status: CLOSED, 2026-09-15
Phase: 343 (the room-graph audit node and the counter-metric rule)
Ledger: `docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md` (cited throughout, not restated)
Validation map: `.planning/phases/343-the-room-graph-audit-node-and-the-counter-metric-rule-graph-/343-VALIDATION.md`

This document is the tracked record of what Phase 343 measured, what it shipped, what it
deliberately left unfixed, and who owns the fix. `.planning/` is gitignored in this repository
(`.gitignore:97-98`), so a reader on another machine cannot open this phase's `343-RESEARCH.md`,
`343-ICM-CONSULT.md`, `343-LANGTALKS-CONSULT.md`, or any PLAN/SUMMARY file. Everything load-bearing
that this phase produced lives here, in `docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md`, or in the code
itself.

---

## One: What this phase measured

Phase 343 shipped `lib/core/doctor/room-graph-integrity-module.cjs`, a counts-only doctor organ
answering four measurable defect statements plus two counts beside them, and two named
`not_measurable` records. Every number below was produced today, 2026-09-15, by running the
shipped organ directly (`node -e "console.log(JSON.stringify(require('./lib/core/doctor/room-graph-integrity-module.cjs').check({flags:{cascadeRooms:true}}).totals))"`),
not copied from the 2026-09-14 research snapshot.

The four measurable defect statements, fleet-wide:

- `edge_rows_missing_endpoint`: 2,657 (an edge row whose source or target node id does not exist)
- `claim_nodes_no_anchor_total`: 7,836 (a claim node carrying no `SOURCED_FROM` or `DERIVED_FROM`
  out-edge; `claim_nodes_no_anchor_legacy`: 7,824, `claim_nodes_no_anchor_new`: 0, per WD-4's
  two-column rule)
- `proposed_nodes_past_window`: 10,219 (a `proposed` node older than the 30-day `STALE_PROPOSED_DAYS`
  window)
- `edge_rows_type_outside_allowlist`: 1,822, across seven offending type names (`ADVISED_BY`,
  `BELONGS_TO`, `HSI_CONNECTION`, `PRESENTED`, `REVERSE_SALIENT`, `SHARES_THEME`,
  `WHITESPACE_DETECTED`), computed as a live set difference against the exported
  `ALLOWED_EDGE_TYPES` from `lib/core/navigation/edges.cjs`, never a copied literal

The two counts beside them: `contradicts_edges` 0, `self_referencing_edges` 11.

The two `not_measurable` records, shipped as records rather than as defect statements that
structurally cannot fire (`lib/core/navigation/graph-integrity-counts.cjs::NOT_MEASURABLE`):

- `stub_or_placeholder_node`: no working definition survives contact with the schema. The obvious
  test (`properties IS NULL OR properties = '' OR properties = '{}'`) returns zero fleet-wide,
  because `insertNode` requires `epistemic_type` and fills provenance columns on every write.
- `memory_event_provenance_edge`: named in the LangExtract two-tier anchor rule as a second
  structural anchor, but `lib/core/navigation/memory-events.cjs:764-777`'s `logEvent` writes zero
  edges; of 23,736 `memory_event` nodes fleet-wide, only 953 are any edge's endpoint at all, and
  none of those edges are a provenance link.

**Drift rule, stated once:** these are a close-date snapshot, not a fixed fact. They will drift
with every session that writes a claim, opens an edge, or ages a proposed node past 30 days. A
number quoted in a future plan, summary, or doctor run must be re-measured against the live
fleet, never copied from this document or from `docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md`'s own
2026-09-14 baseline. Comparing the two snapshots already shows drift in one day:
`self_referencing_edges` moved from 10 to 11, and `edge_rows_type_outside_allowlist` moved from
1,294 across three types (`BELONGS_TO`, `WHITESPACE_DETECTED`, `HSI_CONNECTION`) to 1,822 across
seven, which is either genuine new writing through the bypass or a broader query surfacing types
the research-time measurement missed. Either reading is consistent with the drift rule; neither
is investigated further here, because doing so would be new phase work, not close-out.

---

## Two: What shipped

| Deliverable | File |
|---|---|
| The doctor organ and its registry row | `lib/core/doctor/room-graph-integrity-module.cjs`, `data/doctor-modules.json` |
| The shared statement homes | `lib/core/navigation/graph-integrity-counts.cjs`, `lib/core/navigation/claim-counter-metric.cjs` |
| The navigation folder contract and its routing row | `lib/core/navigation/CONTEXT.md`, `.claude/includes/architecture.md` |
| The corrected path and the five annotations | `docs/lazygraph-schema.md`, plus `lib/core/rs-engine.cjs`, `lib/core/rs_corpus_exclude.py`, `lib/core/cross-room-aggregator.cjs`, `lib/core/eureka/reasoning-mode.cjs`, `scripts/eureka-command.cjs` |
| The counter-metric declaration and its gate arm | `lib/core/sensors/sensor-priority.cjs`, `scripts/build-connector-registry.cjs` |
| The first pair and its doctrine | `lib/core/navigation/claim-counter-metric.cjs`, `docs/COUNTER-METRIC-DOCTRINE.md` |
| SENS-19 and its seven registration places | `lib/core/sensors/sensor-graph-integrity.cjs`, `lib/core/insight-sensors.cjs`, `lib/core/sensors/sensor-priority.cjs`, `lib/core/navigation-engine.cjs` |
| The single-home lockstep and the Theo gate | `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` (RULE 5), `scripts/release-lib/theo-stamp-gate.sh`, `scripts/release.sh` |
| The help-map layer label and the six-signals document | `scripts/help-renderer.cjs`, `docs/LOOP-VERSUS-GRAPH-SIGNALS.md` |

Nine deliverables across eight plans (343-01 minted the requirements and the ledger rather than
shipping code, so it has no row of its own here).

---

## Three: What was deliberately not fixed, and by whom

Two structural gaps were measured, not fixed. Both are Phase 273's inheritance. Both are handed
over with their blast radius already mapped by the icm-architect consult (`343-ICM-CONSULT.md`,
"Anchor ownership" and "Objects"/"Processes" sections), so Phase 273 opens onto a scoped fix, not
an audit.

**The claim-anchor writer gap.** `lib/core/navigation/typed-claim.cjs:121`'s `writeClaimNode`
writes a claim node and zero edges. `lib/core/navigation/reasoning-write.cjs:185` is the only
`SOURCED_FROM` writer in the repository and has produced zero rows in practice, because both of
its own callers currently supply an empty evidence list; the file's own design floor at
`reasoning-write.cjs:163-165` forbids fabricating provenance to fill that gap, so the honest zero
stands. The owner is not `node-insert.cjs` (the node chokepoint has no edge surface at all) and
not `reasoning-write.cjs` (already correct); it is `writeClaimNode` itself, as the one place "a
claim was created" is observable and the one file that already owns the claim's shape.

Blast radius, carried forward intact: one writer contract (`typed-claim.cjs::writeClaimNode`
gains a required `anchor` parameter), eight call sites of which five BREAK
(`lib/core/domain-insight-sweep.cjs:176`, `lib/core/eureka/grade-grant.cjs:493`,
`lib/core/navigation/room-birth.cjs:856`, `lib/mcp/tools/claim.cjs:133`,
`lib/mcp/tool-router.cjs:1475`, each currently writing no edge at all) and three adapt with a
one-line change (`lib/core/graph-derivation.cjs:330`, `lib/core/unknowns/edge-writer.cjs:128`,
`scripts/huji-intake.cjs:393`, each already writing a typed edge whose existing target becomes
the anchor), two of the five breaks are MCP tool schema changes (`claim.cjs`, `tool-router.cjs`),
and one root-node exemption (`room-birth.cjs:856`'s venture claim is the room's own root and has
nothing above it to anchor to; this is the genuine hard case that makes the rule "anchor, or an
explicit recorded exemption," not "anchor, full stop"). The migration for the 7,824 existing
unanchored claims is a three-tier plan whose third tier freezes the legacy cohort as a permanent,
non-decreasing count: (1) derivable claims whose `source_segment` resolves to a known artifact or
`memory_event` id, anchored deterministically, scale unmeasured; (2) root-exempt claims from
`room-birth.cjs`, marked with an explicit exemption rather than a fabricated edge; (3) the vast
un-derivable majority, left as-is and reported forever as a frozen legacy cohort, so a
post-fix `unanchored_claims_new` column can be structurally zero and a non-zero value there
becomes a genuine alarm instead of background noise.

**The edge chokepoint bypass.** `CLAUDE.md:153`'s claim that typed edges are written only through
`navigation.cjs` does not currently hold on the measured evidence. Raw `INSERT INTO edges`
statements bypass the `writeEdge` chokepoint (and therefore its `ALLOWED_EDGE_TYPES` membership
check) at `lib/core/graph-ops.cjs:196`, `:250`, `:262`, and at six sites in
`scripts/build-ecosystem-graph.cjs` (`:352`, `:393`, `:415`, `:423`, `:443`, `:477`), plus a
scattering of `DELETE FROM edges`/`nodes` calls in `lib/memory/test-rs-sqlite-mirror.cjs` (test
fixture cleanup, not production writes) and `scripts/hsi-to-graph.cjs`. This is the measured cause
of the seven type names in Section One's fourth defect statement. `scripts/check-substrate.cjs`
(an advisory, non-blocking gate as of Phase 233) already names these sites on every run; Phase 343
adds no new visibility here beyond confirming the same sites are still live and quantifying their
output. Fixing the bypass, wiring `graph-ops.cjs` and `build-ecosystem-graph.cjs` through
`writeEdge`, is Phase 273 territory alongside the anchor gap, because both are the same class of
problem: a chokepoint that exists on paper and is bypassed in practice.

**A third, smaller, separately-owned gap, not Phase 273's:** `lib/core/doctor/cascade-rooms-module.cjs:52-56`'s
`resolveRoomPath` reads `info.path` only and silently returns `null` (causing that room to be
skipped) for any registry entry that carries `abs_path` alone instead of `path`. Measured live
today: zero registry entries currently hit this path (`grep -c abs_path` on the live registry
returns 0), so this is a structural gap with no current victim, not an active undercount. It is
named here because a doctor organ that silently skips a room without a defect emitted is exactly
the "clean bill of health that is actually an unmeasured gap" pattern Section One's own
`not_measurable` records exist to avoid, and it deserves its own quick task, not a drive-by fix
inside this close-out.

---

## Four: The decisions, and where they live

Every working decision this phase made lives in `docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md`
Section 2, twenty-one rows (WD-1 through WD-21), each dated 2026-09-14. At this close (2026-09-15)
every row carries a settled status: 2 RULED (WD-13, WD-20, both flipped by the navigator's
`ship-as-designed` ruling at the 343-07 Task 2 checkpoint) and 19 STANDING (shipped exactly as
decided, never challenged, the phase closing on them as-is). Zero rows remain bare WORKING. Of
Section 6's four originally-open navigator questions, two are now RESOLVED (whether
`--no-theo-check` should exist at all, settled by the same checkpoint ruling; whether
`release.sh` can reach Theo without a credential, settled by the Task 1 live probe showing the
wire is reachable) and two remain genuinely OPEN (the divergence-ratio threshold that would turn
the counter-metric pair into a finding; whether `contradiction` or `context_block` is the
semantically correct reach id for SENS-19). This document does not restate any of the twenty-one
decisions or the two still-open questions; read the ledger.

---

## Five: The numbers at close

Every number here was produced by a command run today, 2026-09-15, in this close-out's own
session, none copied from an earlier plan's summary or from research.

**Fleet totals**, via `node -e "console.log(JSON.stringify(require('./lib/core/doctor/room-graph-integrity-module.cjs').check({flags:{cascadeRooms:true}}).totals))"`:
`edge_rows_missing_endpoint` 2,657, `claim_nodes_no_anchor_total` 7,836, `proposed_nodes_past_window`
10,219, `edge_rows_type_outside_allowlist` 1,822 across 7 types, `contradicts_edges` 0,
`self_referencing_edges` 11, across 55 registered rooms (37 with a readable `room.db`, 18
not-measurable).

**The counter-metric pair**, from the same command's `totals.claim_counter_metric`:
`claims_filed` 7,836, `claims_filed_past_citation_lag` 7,028, `claims_with_contradicts_edge` 0,
`claims_no_incoming_edge_past_citation_lag` 7,026, `rooms_diverged` 12, `rooms_not_diverged` 16,
`rooms_not_measurable` 18. Reported as counts and a per-room boolean, never a ratio, per WD-9.

**The per-layer command distribution**, via `node -e "const r=require('./data/command-registry.json');const c={};for(const x of (r.commands||r)){c[x.layer||'MISSING']=(c[x.layer||'MISSING']||0)+1}console.log(JSON.stringify(c))"`:
113 commands total, `loop` 47, `harness` 23, `graph` 18, `none` 17, `context` 5, `prompt` 3. This
matches 343-08's own precondition measurement exactly (`343-08-SUMMARY.md`), confirming the
distribution has not shifted since that plan landed.

**`SENS_PRIORITY` size**, via `node -e "console.log(require('./lib/core/sensors/sensor-priority.cjs').SENS_PRIORITY.length)"`:
21 records (20 pre-existing plus SENS-19, this phase's own sensor).

---

## Six: Open after this phase

Every one of the seventeen CENSUS-01 through CENSUS-17 requirement rows closed with a `Measured:`
clause in `.planning/REQUIREMENTS.md` during this close-out's own Task 1; zero rows remain open.
`bash tests/run-all-343.sh` reports `PASS=11 FAIL=0 SKIP=0`, and `node scripts/doctor.cjs
--acceptance` reports 20/20 (both re-confirmed on a clean tree after Task 1's commit, 2026-09-15).

What remains open is not a requirement, but two navigator questions the ledger names as still
genuinely unanswered (`docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md` Section 6):

- **The divergence ratio that counts as a finding.** The first counter-metric pair reads 7,836
  claims filed, 0 contradicted, 7,026 never cited past the citation lag, today. What ratio or
  threshold turns that divergence into a doctor or sensor finding, rather than a passive count
  reported forever, is unset. This phase deliberately ships counts and a boolean, never a score
  (WD-9), so answering this question was never in this phase's scope.
- **Whether `contradiction` or `context_block` is the right reach id for SENS-19.** WD-6 shipped
  `contradiction` at MEDIUM research confidence; `context_block` is the alternative recent
  sensors have favored, and no checkpoint in this phase revisited the choice.

And the two structural gaps from Section Three, handed to Phase 273 with their blast radius
mapped, plus the smaller `cascade-rooms-module.cjs` under-count named as its own separate quick
task rather than folded into Phase 273's scope.
