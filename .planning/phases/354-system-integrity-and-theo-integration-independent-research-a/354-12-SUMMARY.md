---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 12
subsystem: theo-integration
tags: [theo, journey, live-contract, cross-repo, provenance, tier-3-4, egress]

# Dependency graph
requires:
  - phase: 354-system-integrity-and-theo-integration-independent-research-a
    provides: "354-06 (THEO-03 closed-vocabulary egress gate), 354-09 (THEO-01 classification round trip, executable-chain validation, honest provenance), 354-10 (THEO-01 taxonomy-ladder Theo casing) -- this plan verifies all three, patches nothing"
provides:
  - "tests/test-354-theo-journey.cjs: hermetic four-case (H/U/S/T) teaching-to-action journey with a room-canary egress scan, real act-chain -> pipeline-state -> artifact_file -> room://section retrieval loop"
  - "tests/test-354-theo-live-contract.cjs: opt-in (MINDRIAN_354_LIVE=1) live synthetic contract test against theo-mcp.onrender.com, SKIP_EXIT_CODE=77 otherwise"
  - ".planning/phases/354-system-integrity-and-theo-integration-independent-research-a/354-THEO-EVIDENCE.md: the live contract run record (9/9 records passed) and the THEO-02 BLOCKED disposition with fresh Phase 351 evidence"
affects: [354-13, 354-16, 354-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Monkey-patch-and-restore on a shared module's exported function (brainRouter.recommend) to observe the EXACT object a downstream handler used, instead of re-parsing rendered text or risking a second Tier-1-cache-hit call"
    - "Canary-scan invariant applied across all four provider conditions from one shared capture-server `captured` array, reset per case"
    - "Live-network opt-in test gated on an explicit env var, SKIP_EXIT_CODE=77 (never exit 0) so a CI harness can tell SKIPPED from PASSED without parsing stdout"

key-files:
  created:
    - tests/test-354-theo-journey.cjs
    - tests/test-354-theo-live-contract.cjs
    - .planning/phases/354-system-integrity-and-theo-integration-independent-research-a/354-THEO-EVIDENCE.md
  modified: []

key-decisions:
  - "Case S ('invalid schema') scripts brain_ask as a VALID structured_rows response and recommend_chain as the malformed leg ({chain: 'not-an-array'}), exercising _composeTheoAsk's chainStatus:'unreachable' branch specifically -- documented in the test file's own header as a resolution of the plan's slightly ambiguous two-clause case description, since recommend_chain is only ever called downstream of a successfully-parsed brain_ask response (ask()'s own dispatch logic), so a literal 'brain_ask returns an unrecognized object' AND a reached recommend_chain malformed response cannot both occur in the same single-ask() call"
  - "Actually ran the live contract test this session (MINDRIAN_354_LIVE=1): network was reachable and MINDRIAN_BRAIN_KEY was already resolved in the environment, so THEO-01/THEO-03 live certification is CLOSED by measured evidence, not left open on an ENV GAP -- 9/9 records passed against the real theo-mcp.onrender.com origin in ~11s"
  - "requirements mark-complete called for THEO-01 and THEO-03 (both plans co-owning them, 354-09+354-10+354-12 and 354-06+354-12 respectively, have now all landed and this plan's own verification -- hermetic AND live -- passed); NOT called for THEO-02, whose own REQUIREMENTS.md row text bars marking it complete while the Theo-side consumer is absent, independent of how well it is dispositioned"
  - "THEO-02 stays BLOCKED on Phase 351 (still registered, 0 plans, checked fresh this session, unchanged from 354-CONTEXT.md's planning-time snapshot) -- no Theo-side code touched, per CTX-THEO-READONLY"

requirements-completed: [THEO-01, THEO-03]

# Metrics
duration: ~95min
completed: 2026-09-23
---

# Phase 354 Plan 12: Theo Journey, Live Contract Certification, and THEO-02 Disposition Summary

**Hermetic four-provider-condition teaching-to-action journey (H/U/S/T) with a room-canary egress scan, PLUS an actually-executed live synthetic contract run against theo-mcp.onrender.com (9/9 records passed) that closes THEO-01 and THEO-03's live-certification clause, PLUS a fresh-evidence BLOCKED disposition for THEO-02 coordinated with (not duplicating) Phase 351.**

## Performance

- **Duration:** ~95 min
- **Completed:** 2026-09-23
- **Tasks:** 3 (all `type="auto"`, verification-only per the plan's own objective -- no production code was patched)
- **Files modified:** 3 (all created: 2 new test files, 1 new evidence file)

## Accomplishments

- **Task 1 (hermetic journey):** `tests/test-354-theo-journey.cjs` drives the real
  `act-chain` orchestration handler (`lib/mcp/tool-router.cjs`) through
  `brainRouter.recommend()` -> `brainRoute()` -> the real wire path against
  `tests/helpers/brain-capture-server.cjs`, reads `pipeline-state.cjs`'s
  resulting chain, files a recommendation artifact through the real
  `artifact_file` handler (`lib/mcp/tools/views.cjs`), and retrieves it back
  through `room://section/recommendations` via a real
  `@modelcontextprotocol/sdk` `Client` over `InMemoryTransport` -- never a
  direct file read. Four provider conditions: H (healthy, scripted
  `brain_ask` + `recommend_chain` + `query`) source `brain`,
  `chain_type: 'ranked_candidates'`, captured `recommend_chain`
  `problem_type: 'IllDefined'`; U (HTTP 503) local source with a disclosure
  field; S (a well-shaped `brain_ask` but a malformed, non-array
  `recommend_chain.chain`) local source, no brain provenance; T (a
  well-shaped but empty `recommend_chain.chain`) local source with
  `brain_router_note` set. A room file, a governed `writeClaimNode` claim,
  and STATE.md's own body text all carry a per-case random canary
  (`CANARY_354_ROOM_BYTES_<hex>`); every captured `tools/call` body across
  all four cases was scanned and none contained it. 15/15 checks passed on
  the first clean run (no production bug found, no production file
  touched).
- **Task 2 (live contract):** `tests/test-354-theo-live-contract.cjs` is
  opt-in (`MINDRIAN_354_LIVE=1`, `SKIP_EXIT_CODE=77` otherwise, mirroring
  the Phase 354 `tests/helpers/fixture-room-354.cjs` convention). Actually
  run live this session (network reachable, `MINDRIAN_BRAIN_KEY` already
  resolved): `recommendChain` for all 4 Theo rungs, `taxonomy_ladder` for
  all 4 Theo rungs, and one `brain_ask` call all passed against the real
  `theo-mcp.onrender.com` origin -- 9/9 records `ok: true`, exit 0, ~11s.
  The taxonomy-ladder assertion reads the REAL live response shape
  (`{ rung, question_label, rungs: [{id, gloss, marked}], ladder }`,
  discovered live before finalizing the test) and confirms exactly one
  rung is marked and it matches the request, for all four rungs. The
  `brain_ask` call confirmed `grounding.problem_type: 'IllDefined'` and
  `grounding.rung_source: 'structured'` live -- the classification round
  trip (354-09) proven against production, not only a capture-server
  double. Full JSON evidence recorded in `354-THEO-EVIDENCE.md`.
- **Task 3 (THEO-02 disposition):** Ran and recorded all six required
  commands: `run-all-349.sh` (14/14 passed, 213s), `test-343-theo-stamp-gate.cjs`
  (7/7 arms passed), a live `release.sh patch --dry-run` theo-stamp preview
  (confirmed non-mutating by the phase's own `test-349-dry-run-never-sends.cjs`)
  which itself surfaced fresh, current plugin-side evidence of the drift:
  **"theo-stamp-gate: MISMATCH -- Theo's stamp is `command-registry@2.0.0-beta.42`,
  expected `command-registry@2.0.0-beta.48`"** (six betas behind now, worse
  than the five measured at Phase 349's 2026-09-16 baseline), plus three
  read-only `/home/jsagi/Theo` inspection commands cross-checked against the
  GitHub API (`gh api repos/jsagir/theo/actions/workflows`) -- both surfaces
  agree: exactly three workflows exist (`ci.yml`, `theo-liveness.yml`,
  `theo-seam-audit.yml`), zero `theo-resync` hits. Phase 351 checked fresh:
  still registered, `0 plans`, unowned by this repo -- unchanged from the
  354-CONTEXT.md planning-time snapshot. Disposition recorded:
  **BLOCKED - external dependency: Phase 351 (owner jsagir/theo)**.

## Task Commits

1. **Task 1: Hermetic four-case teaching-to-action journey with canary egress check** - `1b3aa48e2` (test)
2. **Task 2: Opt-in live synthetic contract run against Theo** - `539e5e261` (test)
3. **Task 3: THEO-02 plugin-side verification and read-only provider inspection** - `7026a644b` (docs)

**Plan metadata:** pending (this commit, docs: complete plan)

## Files Created/Modified

- `tests/test-354-theo-journey.cjs` - 441-line hermetic four-case journey (H/U/S/T), canary egress scan, real act-chain -> pipeline-state -> artifact_file -> room:// retrieval loop
- `tests/test-354-theo-live-contract.cjs` - opt-in live synthetic contract test, SKIP_EXIT_CODE=77 convention, zero room reads
- `.planning/phases/354-system-integrity-and-theo-integration-independent-research-a/354-THEO-EVIDENCE.md` - live contract run record (9/9 passed) and THEO-02 BLOCKED disposition with fresh six-command evidence

## Decisions Made

- Case S's script design (see key-decisions in frontmatter): scripted
  `brain_ask` valid, `recommend_chain` malformed, to exercise the specific
  "invalid schema downstream of a valid classification" seam the plan names
  literally, while documenting why the plan's alternate phrasing
  ("brain_ask returns an unrecognized object") describes the router-level
  OUTCOME rather than a second reachable script leg.
- Ran the live leg for real rather than leaving it to the user to run later
  out-of-sandbox: network access and a valid `MINDRIAN_BRAIN_KEY` were both
  already present in this execution environment, so live certification is
  now CLOSED evidence, not a deferred TODO.
- `requirements mark-complete THEO-01 THEO-03` (both now fully landed across
  their co-owning plans); THEO-02 deliberately left unchecked per its own
  REQUIREMENTS.md row text.

## Deviations from Plan

None - plan executed exactly as written. No production code was patched (as
the plan's own objective requires: this plan verifies, it does not repair);
no new finding required patching, since all four hermetic journey cases and
all nine live contract records passed on the first clean run.

## Issues Encountered

- `git -C /home/jsagi/Theo status --short` before and after Task 3's
  read-only inspection commands were NOT byte-identical: a concurrent peer
  session was actively committing to `/home/jsagi/Theo` during this task's
  ~4-minute window (confirmed by `git log -1`'s timestamp falling inside
  that window). This plan made zero writes to that repository -- every
  command against it was `git log`, `git status`, `ls`, or `grep` (read-only
  by construction). Recorded honestly in `354-THEO-EVIDENCE.md` per the
  "two-session tree collision" watch pattern rather than silently reporting
  a false "identical"; CTX-THEO-READONLY held throughout.

## Known Stubs

None - this plan adds only test files and an evidence document; no UI or
data-rendering surface.

## Threat Flags

None - this plan adds no new network endpoint, auth path, file-access
pattern, or schema change at a trust boundary. Both new test files exercise
EXISTING production surfaces (act-chain, artifact_file, room:// resources,
the Theo wire) under synthetic/scripted or read-only conditions; the live
contract test sends only closed rung enums and one literal generic question,
matching the threat model's own T-354-24 mitigation.

## User Setup Required

None - no external service configuration required. (The live contract test
found `MINDRIAN_BRAIN_KEY` already resolved in this session's environment;
no new credential was minted or requested.)

## Next Phase Readiness

- THEO-01 and THEO-03 are now fully closed: every sub-finding (classification
  round trip, executable-chain validation, honest provenance, degradation
  disclosure, taxonomy casing, the hermetic four-case journey, the D-354-EGR
  closed-vocabulary gate, AND live certification) is landed and proven, both
  hermetically and against the real production origin.
- THEO-02 stays open and BLOCKED on Phase 351, with fresh (not stale)
  plugin-side evidence -- the next session to plan or execute Phase 351 has
  a concrete, evidence-backed Theo-side deliverable named in
  `354-THEO-EVIDENCE.md`'s disposition section.
- `bash tests/run-all-354.sh`: PASSED=13 FAILED=0 SKIPPED=5 (the 5 skips are
  sibling plans' not-yet-landed test files -- 354-acceptance-diagnostics,
  354-registration-diagnostics, 354-extract-shallow-contract,
  354-concurrency-surfaces -- unrelated to this plan; `test-354-theo-journey`
  PASSED and `test-354-theo-live-contract` SKIPPED under the aggregator's
  default no-env-var run, exactly as this plan's own `<verification>` block
  names as acceptable).
- No blockers for 354-13 through 354-18 from this plan's changes.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created files confirmed present on disk (tests/test-354-theo-journey.cjs,
tests/test-354-theo-live-contract.cjs, 354-THEO-EVIDENCE.md, this SUMMARY.md).
All three task commits (1b3aa48e2, 539e5e261, 7026a644b) confirmed present in
git log.
