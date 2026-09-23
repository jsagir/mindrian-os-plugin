---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 16
subsystem: testing
tags: [close-out, concurrency, tri-polar, acceptance, phase-354, disposition-ledger]

# Dependency graph
requires:
  - phase: 354-13
    provides: "doctor.cjs runBoundedChild + per-point acceptance instrumentation (SYS-07); this plan's Measured gates table reruns it clean"
  - phase: 354-14
    provides: "status_read capability_floor.tool_registration (SYS-04); this plan's K1 leg re-confirms it live across two spawned servers"
  - phase: 354-15
    provides: "extract_shallow honest-parsing contract (SYS-05)"
  - phase: 354-17
    provides: "framework-command-ledger infrastructure (THEO-01 recall layer, offline-seed by design)"
  - phase: 354-18
    provides: "THEO-04 documentation + advisory check (doctor.cjs coverage-gate entry), this plan's ledger closes THEO-04 MITIGATED-DOCUMENTED citing it"
provides:
  - "tests/test-354-concurrency-surfaces.cjs: K1-K5, two real bin/mindrian-mcp-server.cjs stdio spawns (Desktop protocol), forked CLI graph writers, in-process human-decision-bypass proof, a real Playwright browser against the localhost POC in room mode -- 25/25 checks, exit 0"
  - "tests/helpers/write-lock-holder-354.cjs: new graph-write mode (real node write through graph-ops.cjs/node-insert.cjs, retry-on-held)"
  - "docs/reviews/phase-354-close-out.md: Measured gates table (17 commands), legacy localhost review recheck, Coverage map, six Residual risks, Decisions, Deployment status"
  - "docs/reviews/phase-354-disposition-ledger.md Section 11: Final disposition for all 13 IDs with commit references and re-run verification commands"
  - "docs/reviews/2026-09-20-full-system-code-review.md: ## Corrections (Phase 354, 2026-09-23) section, six overstatements corrected, nothing above it edited"
  - ".planning/REQUIREMENTS.md: Measured/Status line on all 13 Phase 354 rows"
  - "docs/OPEN-HANDOFFS.md: dated 2026-09-23 top entry, Phase 354 CLOSED"
  - "Research trail filed (plugin-side fallback; see Deviations) at MindrianOS/research/2026-09-23-phase-354-system-integrity-close-out.md"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-room isolation and no-lost-update proof via real StdioClientTransport spawns of the actual MCP server binary (test-248-surface-probes.cjs idiom), not an in-process stub, for the Desktop-protocol leg specifically"
    - "Human-decision-bypass proof reused the 354-02 in-process captured-server idiom (extra.sessionId passed directly to the real handler), the same 'MCP client' abstraction that ledger's own gate-ledger tests already use"
    - "Retry-on-explicit-held-error as the concurrency contract for a CLI-style writer: never a silent drop, always an IPC-reported outcome (written:true with an attempts count, or an error)"

key-files:
  created:
    - tests/test-354-concurrency-surfaces.cjs
    - docs/reviews/phase-354-close-out.md
    - MindrianOS/research/2026-09-23-phase-354-system-integrity-close-out.md
  modified:
    - tests/helpers/write-lock-holder-354.cjs
    - docs/reviews/phase-354-disposition-ledger.md
    - docs/reviews/2026-09-20-full-system-code-review.md
    - .planning/REQUIREMENTS.md
    - docs/OPEN-HANDOFFS.md

key-decisions:
  - "THEO-04 closed MITIGATED-DOCUMENTED in both the ledger and REQUIREMENTS.md, never FIXED-VERIFIED, exactly per the navigator's 2026-09-23 ruling: the underlying two-MCP-server structural exposure is not removed, only documented and surfaced by an advisory check."
  - "THEO-02 left BLOCKED (requirement row stays [ ]) -- Phase 351 (owner jsagir/theo) still has 0 plans as of this close-out; the plugin side is fully proven (live --dry-run shows current MISMATCH drift) but nothing in this repo can close the cross-repository gap unilaterally."
  - "The rethinking-mindrianos research-room mirror could not land this session (write-scope-check refused: active room was motj-ecosystem, not rethinking-mindrianos) -- the same refusal Phase 344/345/347/348's own close-outs hit. Filed the plugin-side fallback at MindrianOS/research/ with the full drafted content and an explicit mirror_status: PENDING frontmatter field, per established precedent, rather than attempting to route around the room-write governance hook."
  - "K3 (human-decision-bypass) implemented via the in-process captured-server handler-call idiom (extra.sessionId), not a second real stdio transport, because gate-ledger.cjs's ledger is an in-process module-level Map -- two genuinely separate stdio spawns would never share one ledger instance to test session-mismatch against."

requirements-completed: [SYS-01, SYS-02, SYS-03, SYS-04, SYS-05, SYS-06, SYS-07, SYS-08, SYS-09, THEO-01, THEO-03, THEO-04]

# Metrics
duration: ~200min
completed: 2026-09-23
---

# Phase 354 Plan 16: Concurrency Close-out, Measured Gates and Final Dispositions Summary

**Closed Phase 354 against the handoff's Acceptance and close-out section point by point: a new 25-check concurrency/tri-polar test proves CLI, MCP-stdio and browser clients never cross rooms, lose updates, or bypass a human decision; 17 measured gate commands ran clean (two pre-existing, unrelated failures correctly classified, not hidden); the disposition ledger closes all 13 IDs (11 FIXED-VERIFIED, THEO-04 MITIGATED-DOCUMENTED by design, THEO-02 BLOCKED on Phase 351); the 2026-09-20 review gained a Corrections section; REQUIREMENTS.md gained a Measured/Status line on every row; and Phase 354 is CLOSED.**

## Performance

- **Duration:** ~200 min (reading 20+ context files, writing and debugging a 552-line
  multi-transport concurrency test, running ~40 gate commands, writing ~800 lines of
  disposition/close-out/correction documentation)
- **Tasks:** 3
- **Files modified:** 8 (3 created in this repo, 5 modified, plus 1 created in a sibling
  research-room repo)

## Accomplishments

- **Task 1 (K1-K5 concurrency test).** Wrote `tests/test-354-concurrency-surfaces.cjs`: K1
  spawned two real `bin/mindrian-mcp-server.cjs` processes via `StdioClientTransport`, 10
  concurrent `artifact_file` writes each, proved room A and room B hold exactly their own 10
  files and 10 memory_event rows with zero cross-room leakage, and `status_read` reports
  `tool_registration.complete: true` on both. K2 forked 5 CLI-style graph writers (a new
  `graph-write` mode added to `tests/helpers/write-lock-holder-354.cjs`, writing a real node
  through `graph-ops.cjs`/`node-insert.cjs`) concurrently with 5 MCP `artifact_file` calls;
  4 of 5 writers hit real OS-level lock contention and correctly retried (observed 2-5
  attempts each) rather than dropping silently; all 10 writes present afterward. K3 proved a
  wrong-session `gate_answer` is refused `session_mismatch` and burns the gate (a correct-
  session retry is refused `unknown_or_expired_gate`), while a fresh file-meeting plus the
  correct session's approve confirms the exact claim. K4 started the localhost POC server in
  room mode plus a real Playwright browser, filed a new version of the SAME artifact through
  the MCP `artifact_file` tool while the page was clean (silent reload) and while dirty (409
  conflict, banner shown, disk never silently overwritten). K5 printed the required
  `HOST UI NOT RUN: Claude Desktop app, Cowork app` line. 25/25 checks pass, exit 0, stable
  across reruns.
- **Task 2 (measured gates).** Created `docs/reviews/phase-354-close-out.md` with a Measured
  gates table: 17 rows, each with the exact command, exit status, wall-clock duration and a
  result excerpt. `doctor --acceptance --pre-tag --json` ran clean (18/18, 56.1s, zero
  timeouts, zero orphans, matching the SYS-07 RCA's own WORKING classification).
  `run-all-349.sh` (14/14), the full `write-lock-atomic.test.cjs`, all 19 egress/part8-egress
  files and all 13 `test-345-*.cjs` files ran; two pre-existing, unrelated failures
  (`test-345-gate-ratify.cjs`, `test-257-brain-tool-egress-invariant.cjs` Arm 2) were
  correctly classified from `deferred-items.md`, not silently re-run until green. Rechecked
  all five legacy localhost review findings via a fresh `audit-localhost-workspace-review.cjs`
  browser capture: foreign-Host-read is ALREADY FIXED (354-08; this recheck's own script uses
  `fetch()`, which silently discards a forged Host header -- a false negative explained and
  cross-checked against the correctly-instrumented `test-354-dashboard-host-read.cjs`, which
  shows 403 on every route); `ROOM_DATA` empty, no visible refresh, and mobile overflow all
  stay CONFIRMED still open on the legacy `scripts/serve-dashboard-live` dashboard (no Phase
  354 plan targeted that file's templating/client-script/CSS); the browser-chat architecture
  finding is carried forward as PRODUCT GAP.
- **Task 3 (final dispositions, corrections, requirements, handoff, research filing).**
  Published Section 11 ("Final disposition") in `docs/reviews/phase-354-disposition-ledger.md`:
  all 13 IDs, each with a real commit reference and a verification command with its actual
  exit status from Task 2's run. 11 of 13 are FIXED-VERIFIED; THEO-04 is
  MITIGATED-DOCUMENTED (explicitly never claimed fixed: the underlying two-MCP-server
  structural exposure is not removed); THEO-02 stays BLOCKED on Phase 351 (checked fresh --
  still 0 plans, Theo's own workflows still have no `theo-resync` consumer at commit
  `98e337d`). Added Coverage, Residual risks (6 named), Decisions and Deployment status
  sections to the close-out doc (fixed on `main`, not live -- no release was cut by this
  phase). Appended `## Corrections (Phase 354, 2026-09-23)` to
  `docs/reviews/2026-09-20-full-system-code-review.md` (6 overstatements corrected with
  evidence links; nothing above it edited or deleted, confirmed via `git diff`). Added a
  Measured or Status line to every one of the 13 rows in `.planning/REQUIREMENTS.md`. Added a
  dated top entry to `docs/OPEN-HANDOFFS.md` announcing Phase 354 CLOSED, preserving the
  existing 2026-09-20 registration line. Filed the Dev-Research Compositing trail (see
  Deviations for the room-write governance block encountered).

## Task Commits

1. **Task 1: Concurrency and Tri-Polar surface checks** - `807aeeb81` (test)
2. **Task 2: Measured gate run with command, exit, duration and environment** - `6713c6153` (docs)
3. **Task 3: Final dispositions, review corrections, requirement rows, handoff entry** - `6805f876d` (docs)

**Cross-repo (rethinking-mindrianos research filing, plugin-side fallback):** `888560cbc`
(in the `/home/jsagi` home-level repository that tracks `MindrianRooms/` and `MindrianOS/`)

**Plan metadata:** pending (this commit, docs: complete plan)

## Files Created/Modified

- `tests/test-354-concurrency-surfaces.cjs` - K1-K5 concurrency/tri-polar regression, 552 lines
- `tests/helpers/write-lock-holder-354.cjs` - new `graph-write` mode (backward compatible)
- `docs/reviews/phase-354-close-out.md` - Measured gates, legacy recheck, Coverage, Residual
  risks, Decisions, Deployment status
- `docs/reviews/phase-354-disposition-ledger.md` - Section 11, Final disposition (all 13 IDs)
- `docs/reviews/2026-09-20-full-system-code-review.md` - Corrections section appended
- `.planning/REQUIREMENTS.md` - Measured/Status line on all 13 Phase 354 rows
- `docs/OPEN-HANDOFFS.md` - dated top entry, Phase 354 CLOSED
- `MindrianOS/research/2026-09-23-phase-354-system-integrity-close-out.md` - research trail
  (plugin-side fallback; see Deviations)

## Decisions Made

See key-decisions in frontmatter: THEO-04 MITIGATED-DOCUMENTED (never fixed), THEO-02 stays
BLOCKED, the research-room mirror fallback, and K3's in-process transport choice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] K1/K2/K4's MCP clients needed `MINDRIAN_MCP_FIRST=all` and
`graph-write`'s `insertNode` call needed a JSON-string properties argument and a valid
`ALLOWED_EPISTEMIC_TYPES` member**
- **Found during:** Task 1, first run of `tests/test-354-concurrency-surfaces.cjs`.
- **Issue:** An unrecognized MCP client (this test's own probe identity) is write-path OFF by
  design (`write_path_disabled`, D-04/D-12 in `lib/mcp/mcp-first-flag.cjs`) unless it opts in
  via the same flag a real Claude Code session sets. Separately, the new `graph-write` mode's
  first draft passed a plain object to `insertNode`'s `properties` parameter (which requires a
  JSON string) and used `epistemic_type: 'fact'` (not a member of the closed
  `ALLOWED_EPISTEMIC_TYPES` set).
- **Fix:** Added `MINDRIAN_MCP_FIRST: 'all'` to every spawned stdio client's env (the same
  opt-in `tests/test-354-gate-subject-promotion.cjs` already uses for its in-process harness);
  changed `insertNode`'s properties argument to `JSON.stringify(...)` and the epistemic type to
  `'extracted_fact'` (a real member of the enum).
- **Files modified:** `tests/test-354-concurrency-surfaces.cjs`, `tests/helpers/write-lock-holder-354.cjs`.
- **Verification:** re-ran the full test twice after each fix; final run 25/25 checks passed,
  exit 0, K2 observed real lock contention (4 of 5 writers retrying 2-5 times each) exercising
  the exact retry-on-held-error path the plan requires.
- **Committed in:** `807aeeb81` (Task 1).

**Total deviations:** 1 auto-fixed (Rule 3), plus one environmental block handled per
established precedent (below, not a rule-1/2/3 fix since it is outside this repo's control).

## Issues Encountered

- **Rethinking-mindrianos research-room write blocked (environmental, not an error in this
  plan's work).** Writing the dated research entry to
  `~/MindrianRooms/rethinking-mindrianos/research/` was refused by this machine's own
  `write-scope-check` hook (active room was `motj-ecosystem`, not `rethinking-mindrianos`) --
  the identical refusal `docs/OPEN-HANDOFFS.md` already records for Phase 344, 345, 347 and
  348's own close-outs. Per that established precedent, did NOT attempt to route around the
  hook (no `/mos:rooms switch` is reachable from this non-interactive execution context, and
  forcing a write around a room-scoping governance hook would be exactly the kind of
  unauthorized bypass this repo's own CLAUDE.md and memory notes warn against). Filed the full
  drafted content at the documented plugin-side fallback location,
  `MindrianOS/research/2026-09-23-phase-354-system-integrity-close-out.md`, with an explicit
  `mirror_status: PENDING` frontmatter field naming the exact follow-up (`/mos:rooms switch
  rethinking-mindrianos` then file the identical content at the same filename in that room's
  own `research/`). Committed with the same `rethinking-mindrianos: file ...` message
  convention the four prior close-outs used. This means the plan's own Task 3 acceptance
  criterion "a new dated research entry exists under
  `~/MindrianRooms/rethinking-mindrianos/research/`" is NOT literally satisfied by this run --
  it is satisfied at the documented fallback location, honestly flagged, exactly matching how
  this exact same gap has been handled four times before in this repository's own history.

## Known Stubs

None -- every artifact this plan produced (test file, docs, requirement rows) reflects real,
independently-verified state; no placeholder or empty-value stub was introduced.

## Threat Flags

None beyond what the plan's own threat model already named and this plan's K1-K3 verify:
T-354-32 (gate_answer cross-session), T-354-33 (cross-room writes under concurrency),
T-354-30 (published close-out/ledger, synthetic data only, no secrets, hyphen-checked),
T-354-34 (rethinking-room filing, markdown only, no room.db/graph write -- and in fact no
write landed in that room at all this session, only the documented fallback).

## User Setup Required

None -- no external service configuration required. The one open follow-up (filing the
rethinking-mindrianos mirror) requires a session with that room active, not new credentials
or configuration.

## Next Phase Readiness

**Phase 354 is CLOSED.** All 18 plans complete, all 13 SYS-01..09/THEO-01..04 requirement rows
in `.planning/REQUIREMENTS.md` carry a Measured or Status line, the disposition ledger's Final
disposition section accounts for every ID, the close-out doc states actual coverage and
residual risk, and the 2026-09-20 review carries its Corrections. THEO-02 is the one
requirement intentionally left `[ ]` -- it stays BLOCKED until Phase 351 (owner `jsagir/theo`,
still 0 plans as of this close-out) ships Theo's own `theo-resync` consumer workflow; nothing
in this repository can close it unilaterally. No release was cut by this phase; every fix is
on `main`, not live until a version is cut and users update. Peer sessions waiting on this
phase's close (per `docs/OPEN-HANDOFFS.md`'s own "wait for Phase 354 to close" note on the
Phase 355 entry) can now proceed.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created/modified files verified present on disk
(tests/test-354-concurrency-surfaces.cjs, tests/helpers/write-lock-holder-354.cjs,
docs/reviews/phase-354-close-out.md, docs/reviews/phase-354-disposition-ledger.md,
docs/reviews/2026-09-20-full-system-code-review.md, .planning/REQUIREMENTS.md,
docs/OPEN-HANDOFFS.md, MindrianOS/research/2026-09-23-phase-354-system-integrity-close-out.md,
this SUMMARY.md). All four commits (`807aeeb81`, `6713c6153`, `6805f876d`, `888560cbc`)
verified present in `git log --oneline --all` (the last in the separate home-level repository
that tracks `MindrianOS/`).
