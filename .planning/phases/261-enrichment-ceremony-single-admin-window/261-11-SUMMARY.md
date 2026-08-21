---
phase: 261-enrichment-ceremony-single-admin-window
plan: 11
subsystem: brain-graph-ceremony-tooling
tags: [memgraph, mcp, admin-window, runbook, batch-integrity, brain-repo, wave-3]

# Dependency graph
requires:
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "01"
    provides: "docs/2026-08-21-WORKLIST-261-ceremony.md (ProblemsWorthSolving-Brain): the
      measured worklist every CER row set and its admin-exposure baseline (brain_write/
      ingest_framework both ABSENT at worklist time) this plan's runbook Section 1 reads"
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "02"
    provides: "payloads/tier-a-pattern-type-2026-08-21/ (batch_id pws-tierA-2026-08-21):
      CER-01's payload directory, named in this plan's runbook Section 4"
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "03"
    provides: "three CER-02 Cohort 1 batch A payloads, named in this plan's runbook Section 5"
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "04"
    provides: "three CER-02 Cohort 1 batch B payloads plus the Pyramid Principle node-identity
      ruling, named in this plan's runbook Section 5"
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "05"
    provides: "three CER-03 Cohort 2 batch A judgment payloads plus
      docs/2026-08-21-CARDS-cohort2-batch-a.md, named in this plan's runbook Section 5"
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "06"
    provides: "three CER-03 Cohort 2 batch B judgment payloads plus
      docs/2026-08-21-CARDS-cohort2-batch-b.md, named in this plan's runbook Section 5"
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "07"
    provides: "CER-04/CER-06/gated SAPPhIRE payloads plus docs/2026-08-21-CARDS-new-nodes.md,
      named in this plan's runbook Section 6"
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "08"
    provides: "payloads/alias-hygiene-2026-08-21/ (batch_id pws-aliashygiene-2026-08-21) plus
      docs/2026-08-21-CARDS-alias-hygiene.md, named in this plan's runbook Section 7"
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "09"
    provides: "payloads/archived-block-relabel-2026-08-21/ (batch_id pws-blockrelabel-2026-08-21),
      named in this plan's runbook Section 7"
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "10"
    provides: "payloads/command-framework-edges-2026-08-21/ (batch_id pws-cmdfwedges-2026-08-21)
      plus scripts/derive-command-framework-edges.mjs, named in this plan's runbook Section 8"
provides:
  - "payloads/emit-payload-json.mjs (ProblemsWorthSolving-Brain): serializes an .mjs framework
    payload's exported object to JSON on stdout for the HTTPS ingest_framework boundary,
    imports no pipeline module"
  - "scripts/check-ceremony-batch-integrity.mjs (ProblemsWorthSolving-Brain): the mechanical
    pre-window gate, 8 named checks, distinct exit codes 0/1/2, check 3 correctly reported
    DEFERRED TO WINDOW rather than a false PASS"
  - "docs/2026-08-21-RUNBOOK-261-ceremony.md (ProblemsWorthSolving-Brain): the full ordered
    window sequence, close (Section 9) authored before the open (Section 1), sequencing every
    write item this phase's nine authoring plans produced"
affects: [261-12, 261-13]

# Tech tracking
tech-stack:
  added: []
  patterns: ["serializer-only bridge pattern for a client-side .mjs-to-HTTPS JSON boundary: an
    emitter that imports and prints, never validates/dedups/embeds, so no second ingest path is
    written client-side", "mechanical batch-integrity gate with an explicit DEFERRED-vs-PASS
    distinction: a check that cannot run from a given machine is printed as its own verdict
    class, never folded into a false PASS", "close-written-first runbook authoring order: the
    close section is drafted and verified before any other section exists, so the admin-window
    document's own authoring process embodies the discipline it prescribes"]

key-files:
  created:
    - ProblemsWorthSolving-Brain/payloads/emit-payload-json.mjs
    - ProblemsWorthSolving-Brain/scripts/check-ceremony-batch-integrity.mjs
    - ProblemsWorthSolving-Brain/docs/2026-08-21-RUNBOOK-261-ceremony.md
  modified: []

key-decisions:
  - "Disclosed, rather than assumed away, a real gap between the FIX-01 carry document's
    assertions and what the HTTPS admin surface actually returns: src/http/admin-tools.mjs's
    ingest_framework tool response is a narrower projection ({committed, dryRun, accepted,
    rejected}) than payloads/run-ingest.mjs's in-process printout, and does NOT surface
    result.plan.propReport or result.plan.dedup.decision over the wire. The carry document's
    step-3 assertions on propReport.applied/skipped were written for the in-process path and
    cannot be read from this window's HTTPS response. Recorded in Section 3 of the runbook, with
    the load-bearing falsification check repointed to the all-seven-key direct read comparison
    (step 5), which needs no propReport visibility at all and was already the carry document's
    own strongest check"
  - "Hardcoded the file inventories (new .mjs payloads, new fixtures, phase-authored payloads/
    and docs/ files) inside check-ceremony-batch-integrity.mjs rather than deriving them from a
    git log range, because every one of this phase's nine prior SUMMARY.md files documents at
    least one concurrent Claude Code session committing unrelated work into this same working
    tree throughout the phase -- a git-range diff would either silently pick up files this phase
    did not author or miss files whose commit message did not carry a 261- tag. The hardcoded
    lists are sourced from the 261-01 through 261-10 SUMMARY.md key-files blocks, so a future
    mismatch is a finding about the inventory going stale, not about the batch itself"
  - "Check 6's write-file parameterisation heuristic treats a file with zero active statements,
    or a predicate-scoped statement with no name reference at all (the self-loop DELETE, which
    needs neither a $param nor an inlined name because it references no specific framework),
    as a legitimate PASS with the reason stated explicitly, rather than a false FAIL against a
    literal $-presence requirement that does not fit every write shape this phase's payloads use"
  - "requirements-completed left empty. This plan's own objective states plainly it authors no
    payload and opens no window; none of CER-01 through CER-06 is actually closed by this plan's
    three deliverables (a transport helper, a mechanical gate, and a runbook) -- they are closed
    by plan 261-12's actual admin-window execution. Marking them complete here would be the same
    false-completion class plans 261-09 and 261-10 already flagged and declined to commit"

requirements-completed: []

# Metrics
duration: ~50min
completed: 2026-08-21
---

# Phase 261 Plan 11: Payload Emitter, Batch-Integrity Gate, Window Runbook Summary

**Authored the three things the enrichment-ceremony sitting cannot run without -- an .mjs-to-JSON
transport helper for the HTTPS admin seam, a mechanical pre-window gate (8 checks, 0/1/2 exit
codes, a genuine PASS-vs-DEFERRED distinction on the one check that cannot run from this machine),
and the full ordered window runbook whose close section was authored and verified before any
other section existed -- while disclosing a real gap between the FIX-01 carry document's
propReport assertions and what the HTTPS ingest_framework tool actually returns over the wire.
No payload authored, no window opened, nothing pushed.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2/2 completed
- **Files created:** 3, all in `ProblemsWorthSolving-Brain`

## Accomplishments

- Built `payloads/emit-payload-json.mjs`: reuses `run-ingest.mjs`'s exact module-loading pattern
  (`pathToFileURL` + `mod.payload ?? mod.default`), prints `JSON.stringify(payload, null, 2)` and
  nothing else to stdout, all diagnostics to stderr. Verified: round-trips
  `payloads/reverse-salient-analysis.mjs` to a valid object carrying `framework.name`, `nodes`,
  `edges`; `grep -c "src/ingest"` on the file returns 0 (imports no pipeline module); zero
  em-dashes.
- Built `scripts/check-ceremony-batch-integrity.mjs`: 8 named checks. Check 1 (nothing pushed)
  reads `git log origin/main..HEAD` / `HEAD..origin/main` directly and FAILs on an ahead-count of
  0 (the freeze-broken case), not just on a non-empty behind-count. Check 2 verifies
  `compile_only`/`review_required`/`not_executed` across all four of this phase's manifests plus
  `relabel-fix-260820`'s. Check 3 is printed `DEFERRED TO WINDOW`, explicitly excluded from the
  PASS tally, naming all five batch_ids the window's own `[90.x]` dry-runs must independently
  clear. Check 4 imports and asserts the shape of all 15 `.mjs` framework payloads this phase
  authored. Check 5 confirms all 16 phase-added fixtures are discovered by the harness's own
  `discoverFixtures()`. Check 6 scans every numbered write file across the four new payload
  directories for an inlined quoted framework-name literal (the actual hazard), treating a
  predicate-scoped or zero-active-statement file as a legitimate pass with the reason stated,
  not a forced $-param requirement. Check 7 confirms every `90-dry-run.cypher` carries zero
  write-clause keywords in its active (non-comment) lines. Check 8 scans 52 phase-authored
  `payloads/`/`docs/` files for em-dashes. Distinct exit codes 0/1/2; ran twice (after Task 1:
  32 PASS/0 FAIL/1 MISSING/1 DEFERRED, exit 2, the one MISSING being Task 2's own not-yet-written
  runbook; after Task 2: 32 PASS/0 FAIL/0 MISSING/1 DEFERRED, exit 0) -- both runs recorded here
  honestly rather than only the final green one.
- Built `docs/2026-08-21-RUNBOOK-261-ceremony.md`: Section 9 (the close) was authored first,
  before any other section existed on disk, and the document's own opening states this and why
  (the 2026-08-11 two-day-open incident, quoting its execution record's stated lesson verbatim).
  Section 0 states the sitting's shape (one open, one write sequence, one close, every count
  measured post-write by a fresh probe, never from a tool's own return value). Section 1 (open)
  states the expected starting admin-exposure baseline from the worklist and names an
  already-open surface as a finding, not a convenience. Section 2 (Session 0) transcribes the
  `RETURN 1 AS session_open` no-op-write snapshot-forcing pattern with the `snapshotWarning`
  hard-stop rule. Section 3 transcribes the FIX-01 carry document's five numbered steps, all four
  dry-run assertions, and the all-seven-key comparison, adapted to the HTTPS `ingest_framework`
  seam, and states the before-CER-01-through-CER-04 ordering rule in bold prose. Sections 4
  through 8 each name a payload directory, `batch_id`, dry-run file, gating card, write files in
  commit order, verify file, and undo file for every batch this phase's nine authoring plans
  produced (all four `batch_id` values appear). Section 7 states the read-tier-probe-between rule
  with its attribution reason. Section 9 requires closure verified by a live tool-surface listing
  showing both admin tools absent (the expected "Tool brain_write not found" signal, per
  `payloads/order-collision-dishare-2026-08-20/05-close-window.md`'s precedent), and states in
  capitals that the close is the LAST SCRIPTED WRITE ITEM. Section 10 specifies one
  `GRAPH-WRITE-LOG` row per batch (not one per sitting) and names the single push as plan 261-13's
  item, appearing nowhere else in the document. Section 11 defines all four abort/defer branches
  (cannot open the window, Session 0 warns, the FIX-01 round-trip fails, a card is answered
  hold/abort), and every branch still runs the close.
- Disclosed a real, load-bearing finding rather than assuming the carry document's assertions
  transfer unchanged to the HTTPS seam: `src/http/admin-tools.mjs`'s `ingest_framework` tool
  response does not surface `propReport` or `dedup.decision`, only
  `{committed, dryRun, accepted, rejected}`. Section 3 states this plainly and repoints the
  round-trip's load-bearing falsification check to the direct all-seven-key read comparison,
  which was already the carry document's own strongest check and needs no `propReport`
  visibility at all.

## Task Commits

Both commits made in `ProblemsWorthSolving-Brain` (local, NOT pushed, per the standing freeze;
confirmed via `git log HEAD..origin/main` empty and `git log origin/main..HEAD --oneline | wc -l`
= 59 after both commits):

1. **Task 1: Build the payload JSON emitter and the batch integrity gate** - `45748cc` (feat)
2. **Task 2: Write the window runbook, close procedure first** - `5dc4d6a` (docs)

**Plan metadata (this repo, MindrianOS-Plugin):** this SUMMARY.md plus STATE.md/ROADMAP.md,
committed and pushed as this plan's final commit.

## Files Created/Modified

- `ProblemsWorthSolving-Brain/payloads/emit-payload-json.mjs` (54 lines) - the JSON serializer
- `ProblemsWorthSolving-Brain/scripts/check-ceremony-batch-integrity.mjs` (431 lines) - the
  8-check mechanical pre-window gate
- `ProblemsWorthSolving-Brain/docs/2026-08-21-RUNBOOK-261-ceremony.md` (429 lines) - the full
  ordered window sequence, close written first

## Decisions Made

See `key-decisions` in the frontmatter above for the full, sourced list. The single most
load-bearing one: the propReport/HTTPS-response gap is a genuine finding this plan disclosed
rather than papered over, and the runbook's Section 3 now points the operator at the check that
actually works (the direct read comparison) instead of a tool-response field that does not exist
on the wire.

## Deviations from Plan

### Auto-fixed Issues

None. Both files matched their plan-specified shape on first authoring; the integrity check's
one MISSING result between Task 1 and Task 2 was the expected, designed sequencing (Task 2's own
deliverable did not exist yet when Task 1's check ran), not a defect requiring a fix -- it
resolved itself once Task 2 landed, and both runs are recorded above rather than only the final
green one.

**Total deviations:** 0. **Impact on plan:** None; the plan executed as written, including its
own instruction to run the check and record failure honestly if one occurred -- the one
transient MISSING result is recorded per that instruction even though it was not a defect.

## Issues Encountered

- The FIX-01 carry document's propReport-based assertions do not transfer to the HTTPS
  `ingest_framework` admin tool's actual response shape (see Decisions). Not a blocker for this
  plan (which authors documentation, not code) -- disclosed in the runbook itself so plan 261-12's
  operator does not attempt to read a field the tool never sends. Whoever next touches
  `src/http/admin-tools.mjs`'s `ingest_framework` handler could consider surfacing `propReport` in
  the tool's returned JSON, but that is a production-code change outside this plan's
  `files_modified` scope and is not attempted here.
- `requirements-completed` intentionally left empty; see the frontmatter key-decision. This
  matches the honest-completion discipline plans 261-09 and 261-10 already established for this
  phase's requirement-to-plan mapping.

## User Setup Required

None - no external service configuration required. No admin window was opened; every check this
plan ran is filesystem-and-git-only or a hermetic module import, per the plan's own
`mcp_tools` note (no MCP tools needed).

## Known Stubs

None. All three deliverables are complete, runnable artifacts: the emitter round-trips a real
payload, the integrity gate ran twice against real files with real exit codes, and the runbook
sequences real, already-authored payload directories and cards, not placeholders.

## Threat Flags

None. This plan's own `<threat_model>` register (T-261-56 through T-261-61, T-261-SC) maps 1:1
onto this plan's own deliverables, and every mitigation is verifiably present: the close is
Section 9 and was authored first (T-261-56); the emitter forbids any `src/ingest` import,
confirmed by grep (T-261-57); check 3 prints `DEFERRED TO WINDOW` and contributes no PASS
(T-261-58); the FIX-01 round-trip is write item 1 with the before-CER-01-through-CER-04 ordering
rule stated in bold (T-261-59); Section 1 directs `gen_random_uuid()` minted inside the database
(T-261-60); Section 10 specifies one `GRAPH-WRITE-LOG` row per batch with a probe between the
relabel and the edge batch (T-261-61); no package-manager install occurred (T-261-SC).

## Next Phase Readiness

- The full window sequence exists as one document; plan 261-12 can execute it directly without
  improvising ordering at any point, including the close.
- `scripts/check-ceremony-batch-integrity.mjs` is ready to be re-run at the start of plan 261-12's
  own execution, immediately before the window opens, as its own fresh pre-flight confirmation
  (canon and the local working tree can both move between this plan's authoring time and 261-12's
  execution time).
- The propReport/HTTPS-response gap is now a named, disclosed constraint for 261-12's operator
  rather than a surprise discovered mid-window.
- `ProblemsWorthSolving-Brain` sits at 59 commits ahead of `origin/main`, 0 behind; this plan's
  two commits (`45748cc`, `5dc4d6a`) are among the accumulated unpushed set under the standing
  freeze. Plan 261-13 is the only plan permitted to push.

---
*Phase: 261-enrichment-ceremony-single-admin-window*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `ProblemsWorthSolving-Brain/payloads/emit-payload-json.mjs`
- FOUND: `ProblemsWorthSolving-Brain/scripts/check-ceremony-batch-integrity.mjs`
- FOUND: `ProblemsWorthSolving-Brain/docs/2026-08-21-RUNBOOK-261-ceremony.md`
- FOUND commit: `45748cc` (Task 1)
- FOUND commit: `5dc4d6a` (Task 2)

All claimed files exist on disk; both claimed commit hashes resolve in
`ProblemsWorthSolving-Brain`'s local git history. No missing items.
