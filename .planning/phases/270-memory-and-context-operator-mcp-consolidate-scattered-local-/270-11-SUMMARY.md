---
phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-
plan: 11
subsystem: mcp
tags: [identity, cross-room, born-wired, hooked-model]

requires:
  - phase: 270-01
    provides: "270-DECISIONS.md's OQ-2 ANSWER (oq2-ship-caller), the branch this plan runs under"
  - phase: 270-04
    provides: "tests/test-270-identity-write.cjs, the 5-leg RED pin this plan turns green"
  - phase: 270-10
    provides: "the born-wired auto-discovery seam and connector-coverage test this plan's new tool must clear"
provides:
  - "identity_write MCP Tool, the first writer for ~/.mindrian-user.md"
affects: []

tech-stack:
  added: []
  patterns:
    - "Synchronous MCP tool handler: identity_write's callback is a plain (non-async) function, not because async handlers are wrong in general (every other tool this phase shipped is async), but because writeUserMdAtomic is fully synchronous (fs.*Sync only) and tests/test-270-identity-write.cjs leg 3 calls the registered callback directly without await -- an async handler would have returned an unresolved Promise to that call site instead of the resolved {content:[...]} shape the test asserts on."

key-files:
  created:
    - lib/mcp/tools/identity.cjs
  modified:
    - data/mcp-tool-connectors.json
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "identity_write exposes 7 identity-describing fields (canonical_role, journey_stage, problem_type, venture_stage, larry_persona, brain_persona, user_id) plus a per-axis role_blend object, matching emptyUser()'s field set MINUS the bookkeeping/internal fields (schema_version, last_detected_at, last_updated_at, detection_confidence, update_threshold, consecutive_signal_count, parse_failed, override_active) -- those are system-managed state-machine fields, not identity facts an MCP client should set arbitrarily."
  - "role_blend is passed through as a PARTIAL object exactly as lib/core/navigation/room-birth.cjs:566-568's own existing call site already does (a single-axis {founder: 1} object, not a fully-populated 7-axis object) -- mirroring the established real-world usage pattern rather than defensively filling in the other 6 axes to 0, which no shipped caller does today."
  - "The handler returns a scalar reason ('write_failed') on error, never the caught exception's raw message, per T-270-30. writeUserMdAtomic's own thrown messages can carry the destination path (an absolute filesystem path under the user's home directory), which the tool's own schema deliberately never accepts as client input and should not leak back out either."

requirements-completed: [MEMOP-08]

duration: 100min
completed: 2026-08-27
---

# Phase 270 Plan 11: identity_write MCP Tool Summary

**`~/.mindrian-user.md` -- the promised cross-room "who is this user" file whose absent writer originated this whole phase -- now has its first writer, reachable before any room exists. `writeUserMdAtomic` was reused unmodified, and `tests/test-270-identity-write.cjs` (RED on legs 3-4 since plan 270-04) is now 5/5 green.**

## Performance

- **Duration:** 100 min
- **Tasks:** 2
- **Files modified:** 5 (1 new, 4 regenerated)

## Accomplishments

- `lib/mcp/tools/identity.cjs`: registers `identity_write`, the ONE memory tool in this phase deliberately NOT room-scoped -- it never calls `resolveSessionRoomDir`, never calls `openRoomDbForCaller`, and never returns `no_room_db`. Built entirely on `writeUserMdAtomic(USER_MD_PATH(), data)`, unmodified. `USER_MD_PATH()` resolves `os.homedir()` at CALL time (not module load), so the isolated-HOME test fixture takes effect and the real developer HOME is never touched by a test run in the same process.
- No destination-path parameter of any kind (the schema has no `path`/`dest`/`file`/`target` field): the write target is hardwired to `USER_MD_PATH()`. Every string field carries `.max()`. The handler is a plain synchronous function (see `key-decisions`), matching `writeUserMdAtomic`'s own fully-synchronous implementation and the test's synchronous call pattern.
- `tests/test-270-identity-write.cjs`: 5/5 legs green (legs 1-2 were already green as a pin on the pre-existing mechanism; legs 3-4 flip RED to GREEN here; leg 5, the guard-on-the-guard, confirms the real `~/.mindrian-user.md` and `~/.mindrian-onboarded` mtimes are unchanged across the whole run).
- `lib/core/user-md-ops.cjs` and `lib/core/navigation/room-birth.cjs` byte-unchanged (`git diff --exit-code` on both exits 0) -- the mechanism was reused, not rebuilt or modified.
- Registries regenerated: `data/mcp-tool-connectors.json` (26 MCP-tool connectors, was 25), `data/connector-registry.json`, `data/connector-coverage-ledger.json`, `data/harness-manifest.json`. All three born-wired gates pass; a second `build-connector-registry.cjs` run against the committed state produces no diff. `tests/test-234-tool-description-floor.cjs`: 39 tools (was 38), prose-shape coverage 39/39. `tests/test-270-connector-coverage.cjs`: 6/6 legs green (39/39 wire tools checked against 26 declared connectors). `node scripts/doctor.cjs --acceptance`: 17/18, same pre-existing environmental `verify-release-clean-tree` failure every prior plan this phase recorded -- no new failure.
- Zero edit to `lib/mcp/register-core-tools.cjs`, `lib/mcp/tool-router.cjs`, or `bin/mindrian-mcp-server.cjs` -- the auto-discovery seam did its job. `node --check bin/mindrian-mcp-server.cjs` exits 0.

## Task Commits

1. **Task 1: identity_write MCP Tool** -- `75b44778` (feat)
2. **Task 2: registry regeneration + cross-reference** -- see this commit (docs, filed alongside SUMMARY)

## Files Created/Modified

- `lib/mcp/tools/identity.cjs` -- the new tool
- `data/mcp-tool-connectors.json`, `data/connector-registry.json`, `data/connector-coverage-ledger.json`, `data/harness-manifest.json` -- regenerated

## Decisions Made

See `key-decisions` above.

## `check-shape-declaration.cjs` observation (OQ-3 empirical evidence)

Ran `node scripts/check-shape-declaration.cjs --check` both before and after this plan's work. **The violation count is identical: 53 both times**, and `identity_write` / `lib/mcp/tools/identity.cjs` appears ZERO times in its output either time. Read the script's own surface-enumeration code to confirm WHY, empirically, rather than guessing from the unchanged count alone: `scripts/check-shape-declaration.cjs:701-725` enumerates exactly four surface classes -- `commands/*.md`, `agents/*.md`, `pipelines/*/`, and `skills/*/SKILL.md` -- via `fs.readdirSync` over those four directories. `lib/mcp/tools/*.cjs` files are never enumerated by this script at all; MCP-tool `hitl_shape` declarations live in a completely separate surface (the `connectors` export each tool module carries, folded by `scripts/build-connector-registry.cjs` into `data/mcp-tool-connectors.json`, checked by `tests/test-270-connector-coverage.cjs`, not by `check-shape-declaration.cjs`).

**Factual statement for OQ-3's record:** `identity_write`'s `F.1` declaration did NOT register with `check-shape-declaration.cjs` -- it is structurally invisible to that script, not merely unflagged. This directly confirms 270-DECISIONS.md's existing OQ-3 disposition ("MCP tools are not among the four R16 surface classes... may be a parallel MCP-specific convention rather than a constitutional mandate") with a concrete before/after empirical check rather than a reading of the doctrine document alone. Phase 270 continues to behave as if MCP-tool `hitl_shape` IS mandated (every tool this phase added declares `connector` + `hitl_shape` + `hitl_why`), which remains the conservative, correct-under-either-answer choice this plan's own action text called for.

## Cross-reference: Phase 267.2 W2 (GAP I-1)

1. **Phase 270 shipped the CALLER.** `lib/mcp/tools/identity.cjs`, tool `identity_write`, `hitl_shape: 'F.1'`, built on `writeUserMdAtomic` UNMODIFIED (`lib/core/user-md-ops.cjs:442`).
2. **Phase 267.2 W2 must NOT build a home-directory writer. One exists and works.** Cite `lib/core/user-md-ops.cjs:442` (`writeUserMdAtomic`, an absolute-path atomic writer with zero room coupling) and this phase's own `RESEARCH.md` 4.3, which is the correction that collapsed W2's original framing ("needs a net-new mechanism") down to "needs a caller, which now exists."
3. **Phase 267.2 W2 still owns the TRIGGER, and Phase 267.3 owns hook-surface declaration jurisdiction.** Phase 270 deliberately did not decide either. `identity_write` is reachable and correct; nothing in this repo currently calls it automatically, and nothing in this plan decides whether anything should.
4. **The honest limitation, restated so it cannot be lost:** an MCP tool the model must choose to call is not deterministic on first install, when there may be no MCP session at all (the FIRST_INSTALL surface is a bash hook injecting prose, `scripts/session-start`). If Phase 267.2 concludes a hook-side writer is needed for determinism, that is a SECOND caller of the SAME unmodified `writeUserMdAtomic`, not a second mechanism -- the same one-line pattern this file already demonstrates (`writeUserMdAtomic(USER_MD_PATH(), data)`), just invoked from a hook instead of (or in addition to) an MCP tool call.
5. **`check-shape-declaration.cjs` observation, recorded for OQ-3:** see the section immediately above. `identity_write`'s `F.1` is invisible to that script (53 violations before and after, no mention of `identity_write` in either run) -- direct empirical confirmation that MCP-tool `hitl_shape` and the four-class R16 shape-declaration surface are two separate declaration systems today.

### Intended ROADMAP.md text (for plan 270-12 to carry across; not edited here per this plan's explicit scope boundary)

Plan 270-12 owns the ROADMAP.md update for Phase 270's own completion. Separately, when Phase 267.2 is next touched (270-12 or later), its `### Phase 267.2` entry's W2 paragraph should be updated to read (replacing the current "Either wire a home-directory writer, or remove the prose instruction so the product stops promising something it does not do" framing, which now describes a solved problem):

> **W2 - Decide the TRIGGER for the investment write that now has a caller (GAP I-1, mechanism shipped by Phase 270 plan 270-11).** `identity_write` (`lib/mcp/tools/identity.cjs`) is a working, non-room-scoped MCP tool that calls `writeUserMdAtomic` unmodified. What remains is deciding WHEN it fires: an MCP tool the model must choose to call is not deterministic on a first install with no MCP session, so W2's real work is choosing a trigger (a hook-side second caller of the same writer, a model-prompted call, or both) and Phase 267.3's jurisdiction question (can a hook declare and honor its own `hitl_shape`, the same question GAP R-1's `check-onboard --write` fragility already raises).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Necessary, plan-directed] `data/harness-manifest.json` needed regeneration**
- **Found during:** Task 2, the same drift-on-new-connector gate every prior plan in this phase already hit
- **Fix:** Ran `node scripts/build-harness-manifest.cjs`, committed alongside the connector registries
- **Committed in:** this plan's Task 2 commit

**2. [Verify-command precision] The plan's own `git diff --exit-code data/mcp-tool-connectors.json data/connector-registry.json` verify line, run BEFORE committing, correctly showed a diff against the last commit -- not a bug, just a timing note.**
- The plan's `<verify>` line for Task 2 runs `build-connector-registry.cjs` a SECOND time and checks for NO diff, meaning "regeneration is idempotent," not "matches the last git commit." Running it before this plan's own commit landed correctly shows a diff (the new `identity_write` entry, not yet committed); after committing, a fresh double-run produces byte-identical output. Recorded so a future reader does not mistake the ordering for a real inconsistency.

---

**Total deviations:** 2 (1 now-familiar regeneration step, 1 verify-ordering note, no design changes). **Impact:** None.

## Issues Encountered

None beyond the two deviations above. The plan's own `data` shape investigation (`read_first` on `user-md-ops.cjs`, `room-birth.cjs`'s two call sites, `user-archetype.cjs`'s read side) paid off directly: `user-archetype.cjs:64` turned out to read `~/.mindrian-user.md` as a raw full-text regex scan for archetype-indicating WORDS, not a frontmatter-field-specific parser -- meaning the exact field name this tool writes matters less to that particular reader than the VALUE landing somewhere in the file. Recorded in the tool's own header comment so a future reader does not assume a tighter coupling than actually exists.

## Next Phase Readiness

- Wave 6 (plan 270-11, this plan) is complete. 11 of 12 plans done.
- Plan 270-12 (Wave 7) depends on 270-05, 270-06, 270-08, 270-09, 270-10, and this plan (all complete) and is now fully unblocked. Concrete inputs waiting for it: (a) the OQ-6 gate on foreign-host Resource parity; (b) conditional `room_state_bound` retirement; (c) `tests/test-270-tool-schema-budget.cjs`'s `BASELINE.toolCount` needs updating from 36 to the phase's FINAL count (39 after this plan, unless 270-12 itself adds more); (d) the ROADMAP.md `### Phase 267.2` W2 text update recorded above, ready to carry across; (e) the Dev-Research Compositing filing to `~/MindrianRooms/rethinking-mindrianos/` (standing repo-wide rule).
- `tests/run-all-270.sh`'s "270 no-em-dash fence" leg should now clear (its last missing `PART8_TARGETS` entry, `lib/mcp/tools/identity.cjs`, now exists) -- confirm as part of 270-12's own verification pass.

---
*Phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-*
*Completed: 2026-08-27*
