---
phase: 363-deep-research-planner-quick-and-deep-runs
artifact: follow-ons and carry-forwards
written_by: 363-22 Task 1
date: 2026-10-01
---

# Phase 363 follow-ons and carry-forwards

Phase 363 is closed on `main` and NOT live for any user until `scripts/release.sh` cuts a version and users
update. This file lists everything the phase did not finish, with the reason and the source of each item. Nothing
here was fixed at close: the plan's scope is records, and each item below needs its own test and its own
decision. Part A is what the close found or had to re-open. Part B is the list the plan named in advance.

## Part A. Open at close (found or re-confirmed while closing)

### A1. The live OpenAlex smoke (closed at phase close; one run, floors kept)

- History: 363-20 built `tests/test-363-live-smoke.cjs` and did not run it (`MOS_363_LIVE` unset, live spend not
  approved), so DRP363-16 was reopened at the first close pass. The navigator then approved live spend and the
  smoke was run once on 2026-10-01: exit 0, PASS 11, FAIL 0, keyless. Quick run 3 searches, verdict `thin`,
  3.2 s wall; deep run 3 searches, stop `saturation`, 2 unresolved branches, 1.0 s wall; per-query latency 278 to
  1586 ms; 6 searches at $0.001 each. The `LIVE_METRICS` line is verbatim in `363-ACCEPTANCE.md`. DRP363-16 is
  re-ticked and all 20 DRP363 rows are closed.
- What stays open from it: one run of one generic phrase set is too thin to move a floor, so all 14 rows stay
  `disclosed`. `verdict.GAP_COUNT_FLOOR` (3) is the one to revisit: in this run the exact phrase found 0 and the
  synonym cover found 5, so the floor of 3 decided the verdict (`thin`; a floor of 5 would have read
  `gap-confirmed`). Next: a small labelled sample (phrases with a known published-or-not answer), then
  re-decide the floor and the two time budgets (live wall times were about 5 and 0.1 percent of them).
- Source: 363-20 SUMMARY, 363-ACCEPTANCE.md "Live smoke result" and "Floor decisions after the live run".

### A2. `zone_term` is missing from production `whitespace-results.json`

- What: `scripts/compute-whitespace-gaps.py` writes the file with no `zone_term`, so a room-started (ambient) run
  on a real room answers `context_insufficient` / `no_zone_term` and sends nothing. The acceptance fixture adds a
  term, which is why W9 passes; W9b pins the production shape so the gap cannot go quiet.
- Why it is not closed: 363-19 and 363-20 had no ambient.cjs, planner or CLI change in scope, and a term written
  into the generated file would be lost on the next `map`.
- Recommended: a `/gsd-quick` before anyone relies on room-started runs in real rooms. The design is in the 363-19
  SUMMARY ("Follow-on: exact design proposal"): a room-local sidecar
  `.mindrian/whitespace-zone-terms.json` (`mos.whitespace-zone-terms/1`), written only after the navigator
  approves the F.0 grant card that lists the term, through one facade function `recordZoneTerm` and one CLI
  subcommand `zone-term set`; `ambient.zoneTermOf` reads `gap.zone_term`, then the sidecar, then falls back to
  `no_zone_term`. One new leg each in `test-363-ambient` and `test-363-cli`; W9b must be updated when it lands.
- Source: 363-19 SUMMARY, 363-20 SUMMARY, 363-ACCEPTANCE.md "Known limitation".

### A3. Research cards sit flat in `opportunity-bank/` with funder, program and deadline null

- What: a research opportunity card is written as `opportunity-bank/<date>-research-<slug>-<n>.md` with
  `methodology: research-opportunity` and `status: proposed`. `opportunity-ops.listOpportunities` reads every flat
  `.md` in that folder, so it returns these cards with `funder`, `program` and `deadline` null.
- Risk: any consumer that treats every listed item as a funding call (scoring, deadline alerts, exports) will be
  misled by a literature gap that has no funder.
- Why it is this way: the plan required the flat folder convention so the existing listing finds the card.
- Next: decide between filtering on `methodology`, a separate sub-folder the listing skips, or a typed field the
  consumers read; add a test with a research card beside a funding card. Audit the consumers of
  `listOpportunities` first.
- Source: 363-14 SUMMARY threat flag `listing-visibility` and "Opportunity-bank card path convention matched".

### A4. The restatement heuristic flags most of a one-domain plan (design question)

- What: `lib/core/research-planner/pyramid.cjs` lines 309-316 warn when a non-stated leaf "repeats the stated
  question", using the issue-tree overlap check. In the D-06 review it flagged 8 of 11 non-stated leaves, because
  every leaf of a plan about one domain shares words with the stated question.
- Effect: a warning only (the D-00 gate is separate and is not affected), but a warning that fires on most leaves
  teaches the navigator to ignore warnings.
- Design question for the navigator: keep as a warning, tighten (for example a higher overlap threshold or
  comparing the leaf's dimension and falsifier, not only its words), or drop. The navigator ruled the D-06 review
  PASS with this caveat disclosed.
- Source: 363-21 SUMMARY caveat 3, 363-05 SUMMARY post-plan fix note.

### A5. Navigator-ruled follow-on: the wish gate applies to every deep plan

- **RESOLVED 2026-10-01 by quick task 261001-wgd.** RED `f7c62ea03` (test-363-cli leg C15), GREEN `6c8821fd4`
  (`planner.assess` now turns a deep, non scientific-roadmapping plan with no limiter into `wish` with
  `no_nameable_limiter`; quick mode and the scientific-roadmapping branch are unchanged; C14 now asserts the wish
  for the zero-limiter set and exercises every combination through the new `map-unknowns-limiter` fixture).
  Decision on the scope note below: only `no_nameable_limiter` gates outside scientific-roadmapping; missing forum
  roles and an unquantified goal stay advisory. Consequence to know: a deep whitespace plan, including the
  "run deep on this?" escalation, is a wish unless the question set names a limiter; in a researcher room a named
  limiter switches the deep run to per-limiter lanes. See the quick SUMMARY for the test updates.
  The original finding follows, kept as the record.

- **Navigator ruling (2026-10-01, answered via AskUserQuestion): "Apply it to every deep plan."** Any deep plan
  with no nameable limiter is a wish and does not run, regardless of `template_id`, per DRP363-19.
- Not implemented in 363-22 (the close is records only). To be fixed through `/gsd-quick` with a RED leg first:
  a deep plan on the `map-unknowns` question set with no limiter must come back `wish` (not `ready`) for the
  founder (constraint-layer) and researcher (scientific-roadmapping engine) rooms.
- The defect: `planner.assess` in `lib/core/research-planner/planner.cjs` gates on perspective errors only when
  `plan.origin.template_id === 'scientific-roadmapping'`. On `tests/fixtures/363-question-sets/map-unknowns.json`
  (0 paths, 0 limiters, 0 unlock chains) a deep `buildPlan` returns `status: ready` while the perspective reports
  `no_nameable_limiter`, `forum_role_missing:*` and (researcher) `goal_not_quantified`. The empty
  `perspective.ranking` seen in `tests/test-363-cli.cjs` leg C14 is the same fact: `rankByUnlock` ranks every
  limiter, so no limiters means an empty ranking. C14's `continue` on an empty ranking exercises only 3 of the 4
  engine and question-set combinations; the quick task should give that combination a limiter-bearing fixture too.
- Scope note for the quick task: decide in the RED leg whether the other perspective errors (missing forum roles,
  unquantified goal) also make a deep plan `incomplete`; the ruling covers only "no nameable limiter".
- Source: reproduced at close with a scratch script over the four engine and question-set combinations (not committed).

### A6. DRP363-05 (audit ledger) was delivered but left unticked

- Verified at close: `node tests/test-363-audit-ledger.cjs` A1-A5 PASS and `node tests/test-363-part8-sweep.cjs`
  S6 PASS; `AUDIT_KEYS` in `audit-ledger.cjs` holds every D-04 field. Ticked in `.planning/REQUIREMENTS.md` with a
  Measured line naming both tests. Resolved; listed so the history is complete.
- Source: 363-20 SUMMARY "Flag for phase close".

### A7. Theo 20.2 follow-ons for the plugin

- Map the `not_scored` refusal to `not_ready`. `lib/core/refusal-messaging.cjs` `REFUSAL_KINDS` is
  `no_key, unreachable, tier_denied, not_ready, rate_limited, egress_blocked` and has no `not_scored`;
  `find_bottlenecks` now refuses `not_scored` (Theo 20.2), which must read as `not_ready` (the graph has not
  scored it yet), never as `unreachable`. Needs a RED leg in the refusal-messaging tests first. Phase 364 depends
  on it (364-INPUT.md requirement 5).
- Make the doctor stamp key on `recompute_run_id`. `scripts/doctor.cjs` (around lines 4599-4600) prints
  `schema_version` and `last_reconciled` from the Brain stamp, but `GraphRagMeta` carries neither; the stamp
  should key on `recompute_run_id`. A quick task with a fixture stamp.
- Source: the Theo 20.2 hand-off relayed to this close; 364-INPUT.md.

### A8. The phase aggregator

- `tests/run-all-363.sh` already wires every 363 test, including command-contract, runner-contract,
  acceptance-whitespace, acceptance-diffusion and part8-sweep, each behind a `run_if` guard that reports SKIPPED
  (never PASSED) when a file is missing. Nothing was added at close. The only SKIPPED leg is the opt-in live
  smoke (A1).

### A9. Traceability count mismatch (open item for the navigator; not fixed)

- Recorded at planning time (2026-09-29): the Traceability paragraph in `.planning/REQUIREMENTS.md` said "392
  active requirements" at its top and "373" at its bottom; Phase 362's plan commit set both to 398; the 363
  planner raised both to 418 (+20) and reconciled nothing.
- Recomputed at close: a census of `- [ ]` and `- [x]` rows with an ID (the same method as the planner,
  counting `SEED-A` and `SEED-B`) gives 429 rows, of which 20 are DRP363 and 11 are the BIND360 family. The stated
  number is still 418. The gap of 11 is unchanged and equals the BIND360 family's size, so the prose count very
  likely omits that family. The close flipped rows only and did not touch the stated count.
- Checkbox state at close: 368 ticked, 61 open across the whole file (DRP363: 20 ticked, 0 open; DRP363-16 was re-ticked after the live smoke).

## Part B. Carry-forwards named by the plan

| Item | Reason it is not in 363 | Source |
|------|-------------------------|--------|
| Migrate `/mos:dominant-designs` onto the engine (its web provider under a grant) | Phase 361's research mode shipped its own fetcher; moving it is a separate phase, and 363 only generalizes the precedent | 363-CONTEXT D-02, D-14 |
| The remaining D-02 commands (beautiful-question, challenge-assumptions and the rest of the candidate list) | The first wave is five commands plus whitespace as the D-06 case; more commands are each a new question-set contributor | 363-CONTEXT D-02 candidate list |
| Proactive sensor surfacing of room-started cards | A room-started run leaves an unfiled evidence card and a `pending` door; a sensor that raises it unprompted needs its own CIRS wiring and Part 12 review | 363-16 SUMMARY, 363-CONTEXT D-05 |
| Deep execution on Desktop and Cowork | Deep runs need the Agent tool and the lane analyst, which exist in Claude Code only; the MCP `deep_plan` op returns the plan and says where it runs | D-14, 363-17 SUMMARY, W8 |
| Semantic Scholar RCA | `scripts/query-semantic-scholar.cjs` still has an ungated egress; out of scope by D-16 and filed | `.planning/debug/whitespace-external-semantic-scholar-ungated-egress.md`, 363-01 SUMMARY |
| Theo companion: `theo_gaps` | Theo-side work alongside Theo SEED-015; the plugin ships the ledger route so it does not wait | 363-CONTEXT deferred, 363-RESEARCH |
| Theo companion: empty `framework_step` labels | Theo returns null label and runIt for the scientific frameworks (property-schema mismatch in the sr-v1 batch); the shipped `research-shape-ledger.json` avoids it, and Phase 364 step walking waits on Theo Phase 25 | D-17, 363-10 SUMMARY, 364-INPUT.md |
| Theo companion: diffusion problem-type edges | Adoption-Capacity Theory, Diffusion Theory and Law of Diffusion of Innovation have no problem-type edge; diffusion lens selection is local by design (D-19), so the tie is a follow-on | 363-CONTEXT lines 274-279, 363-10 SUMMARY |
| Journal-quality and retraction lists (DOAJ, predatory-journal lists) | The retracted flag shipped; quality lists were left to discretion and need a data-source check first | 363-CONTEXT Claude's Discretion |
| Jev passage filtering (Jev through Theo, BM25 as the no-key fallback) | Left to discretion; needs the guarded shim and a policy check; rows are already quote-first and hash-anchored without it | 363-CONTEXT Claude's Discretion |
| Stale irreversibility ledger entries for `/mos:diffusion`, `/mos:map-unknowns`, `/mos:root-cause`, `/mos:think-hats`, `/mos:whitespace`, `/mos:research`, `/mos:room` and others | `scripts/build-command-irreversibility-ledger.cjs --check` warns STALE (exit 0); the ledger is Phase 356's and is scored by Jev, so it was recorded, not rebuilt | 363-18 and 363-19 SUMMARY |
| Remaining SEED-097 perspectives (RS, HSI, Find Analogies, Eureka) as research-mode fixtures | Sequenced after the first slice per the Astra review | 363-CONTEXT deferred |

## Part C. Pre-existing reds the aggregator counts KNOWN

Counted KNOWN, not caused by 363, each with its recorded signature in `tests/run-all-363.sh`: `run-all-131`,
`run-all-219`, `run-all-221`, `run-all-164`, `run-all-3551`, `run-all-361`, the FDA known-tool-shapes test, the
part8-egress-guard self-test, `test-209-declared-implies-wired` and `test-198-contract-schema`.
