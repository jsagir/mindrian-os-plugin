---
status: resolved
kind: rca
trigger: "statusline room-health chip never updates (stuck showing stale drift/warn, suggesting a dead-end /mos:doctor --fix)"
issue_id: ""
severity: medium
surfaces: [cli]
canon_parts: [8, 11]
created: 2026-07-31
updated: 2026-08-01
---

## Current Focus

status: RESOLVED 2026-08-01. Root cause confirmed and FIXED under TDD; the fix is verified end to
end through the real stdio MCP server. Changes are in the working tree, uncommitted, pending the
session manager's archival + follow-up filing.

hypothesis: CONFIRMED and FIXED. A missing CALLER, not a broken writer. `persistRoomHealth()` had
exactly one caller in the tree (the manual `doctor.cjs --bind-check` CLI flag, which nothing in the
shipped product ever invoked). The fix extracts that flag's composition into
`room-health-cache.runBindHealthCheck()` and wires it to the two LIVE bind front doors: the
`room_bind` MCP tool and the F.8 `session-binding-consumer._bindTimeJob` (whose
`typeof doctor.bindTimeCheck === 'function'` guard was permanently-false dead code).
test: DONE. `tests/test-room-bind-health-signal.cjs` (7 legs, written RED first: 4 of 7 failed
before the fix, all 7 green after). Plus the full `tests/run-all-194.sh` suite: 16 passed, 0 failed.
expecting: MET. A live `room_bind` through the real stdio MCP server rewrote a stale
`{"status":"drift"}` reading to a fresh `{"status":"sound","at":"2026-08-01T06:43:34.530Z"}` - the
exact reported symptom (a stale drift warning that never clears) resolving through the shipped path.
next_action: NONE for the fix. Session manager owns: archival to `.planning/debug/resolved/`, the
`knowledge-base.md` block, the CHANGELOG Fixed entry, the `rethinking-mindrianos` research filing,
and the commit.

## Reasoning Checkpoint (pre-fix, retained as audit trail)

hypothesis: (as confirmed against dev workspace HEAD `2bb9f643`, not just the shipped
1.16.0-beta.5 cache). `lib/statusline/cockpit-signals.cjs`'s `readHealthStatus()` reads
`~/.mindrian/room-health.json`, written only by `lib/statusline/room-health-cache.cjs`'s
`persistRoomHealth()`, which itself has exactly one caller in the whole tree: `scripts/doctor.cjs`'s
`--bind-check <roomDir>` CLI flag handler. Nothing in the shipped product ever invokes that flag, so
the cache is permanently stale after whatever the last manual run was. Two orphaned integration
points, confirmed live against HEAD:
  1. `room_bind` MCP tool (`lib/mcp/tool-router.cjs:1611-1621` registration site) - the real D-03
     binding front door. Zero reference to doctor/bind-check/health anywhere in its body.
  2. `session-binding-consumer.cjs:_bindTimeJob` (lines 77-96) - tried, but dead code: line 84 guards
     `if (typeof doctor.bindTimeCheck === 'function')` before calling it; `scripts/doctor.cjs`'s
     `module.exports` (line 3888) never defines/exports `bindTimeCheck`. The guard is permanently
     false by construction (comment at line 81 admits it: "missing exported bindTimeCheck is a clean
     no-op and NEVER blocks the bind"). Even if it fired, the sibling branch (lines 92-93) calls
     `presence.registerPresence()` directly, bypassing `persistRoomHealth` entirely.
test: implement + TDD - write a failing test asserting that binding a room via the real integration
point results in `~/.mindrian/room-health.json` being written with a status derived from a genuine
bind-time health check, then wire the fix to pass it.
expecting: after the fix, completing a room bind (via `room_bind` MCP tool, the live front door)
writes a fresh, honest `room-health.json` entry every time, so the statusline chip reflects current
reality instead of whatever was last written by a manual CLI invocation.
next_action: pick the integration point (room_bind MCP tool recommended - the session-binding-consumer
path is dead code either way and Phase 194-07 Wave 5 never shipped bindTimeCheck), write the failing
test first, implement a real doctor.cjs export (or an equivalent lightweight in-process health check,
NOT a subprocess spawn from inside an MCP tool handler) that `room_bind` calls synchronously after a
successful bind, verify, and run the full relevant test suites.

reasoning_checkpoint:
  hypothesis: "`~/.mindrian/room-health.json` is permanently stale because `persistRoomHealth()` has
    exactly one caller in the tree - `scripts/doctor.cjs`'s `--bind-check` CLI flag branch - and no
    shipped runtime path (MCP tool, hook, session flow) ever invokes that flag."
  confirming_evidence:
    - "Direct read of `lib/statusline/room-health-cache.cjs`: `persistRoomHealth` is exported; a
      tree-wide grep for its call sites returns exactly one hit, `scripts/doctor.cjs:2761`."
    - "Direct read of `lib/mcp/tool-router.cjs:1629-1674` (the whole `room_bind` handler body): it
      calls `writeSessionBinding` on the explicit and cwd paths and returns; zero doctor / health /
      persistRoomHealth reference anywhere in the handler."
    - "Direct read of `lib/workflow/session-binding-consumer.cjs:82-87`: the guard is
      `typeof doctor.bindTimeCheck === 'function'`, and `scripts/doctor.cjs:3895` exports only
      `{ runAccumulativeEngine, renderHumanReport, computeSummary, _walResetAdvisory,
      _sqliteVersionLt }`. The guard is false by construction, so that branch never executes."
  falsification_test: "Bind a room through the real `room_bind` handler with HOME isolated to a temp
    dir and assert `HOME/.mindrian/room-health.json` exists afterwards. If the file is written today,
    the hypothesis is wrong and some other caller exists. (Run as the RED test - it must fail.)"
  fix_rationale: "The root cause is a MISSING CALLER, not a broken writer. The write side
    (`persistRoomHealth` / `statusFromBindReport`) and the check side
    (`session-presence.runBindCheck`) both ship correct and are unit-tested. So the fix wires the
    live binding front door (`room_bind`) to the same in-process composition the `--bind-check` CLI
    flag already performs. This addresses the cause (nothing calls the writer) rather than the
    symptom (the chip shows a stale value)."
  blind_spots:
    - "Only `room_bind` is wired. A session that binds by some other route (a hook writing
      session-binding directly, `room-registry set-active`) still produces no health write. Accepted:
      `room_bind` is the declared D-03 front door; wiring every write path is a wider change."
    - "The health status is only as honest as `checkRoomStructure` (.room-root + room.db nodes/edges).
      A room that is structurally intact but semantically broken still reads `sound`."
    - "Verified on Linux only. The composition is pure fs + node:sqlite read, no spawn, so Windows /
      Mac correctness is by construction, not by execution."

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ `2bb9f643` (working tree,
  `/home/jsagi/dev/MindrianOS-Plugin`). Original discovery was against the shipped plugin cache at
  `/home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/1.16.0-beta.5/`; every claim below was
  RE-VERIFIED live against this dev workspace HEAD before this file was written, not carried over by
  assumption.
- **WIRE claims probe against:** none. This is a pure LOCAL statusline/health-cache defect. Canon
  Part 8 (LOCAL only, zero Brain egress) is untouched by both the bug and the fix.
- **Date of audit:** 2026-07-31
- **Re-verification rule:** `grep -rn "bindTimeCheck"`, `grep -n "module.exports" scripts/doctor.cjs`,
  and `grep -n "doctor\|bind-check\|bindCheck|room_bind" lib/mcp/tool-router.cjs` all re-run live
  against HEAD `2bb9f643` before writing this section.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version at discovery: 1.16.0-beta.5 (shipped cache); dev HEAD now at 1.16.0-beta.6-next
- Reported by: live session (statusline `⚠ · -> run /mos:doctor --fix` chip never cleared across
  two `/mos:doctor` and one `/mos:doctor --fix` run in the same session)
- Date first observed: 2026-07-31
- Related debug sessions: none found under this slug. Phase 194-07 (PSB-14) and quick-task
  20260702-statusline-live-signals both touch this area but neither owns the missing caller.

## Problem Statement

The statusline's room-health chip (`⚠`/`✓`) is meant to reflect the current health of the active
room, escalating to "run /mos:doctor --fix" on drift. In practice it never updates after the first
manual write, because nothing in the live product (MCP tool, hook, or session flow) ever calls the
one function that writes its backing cache.

## Symptoms

expected: the room-health chip updates whenever the session (re)binds to a room, reflecting a real,
current health read.
actual: the chip is frozen at whatever `~/.mindrian/room-health.json` said the last time someone
manually ran `doctor.cjs --bind-check <roomDir>` from a shell. Running `/mos:doctor` or
`/mos:doctor --fix` (any flag) does not move it, because those are a fully separate code path.
errors: none - this is a silent no-op, not a crash. The dead guard at
`session-binding-consumer.cjs:84` fails closed with zero visible signal.
reproduction:
  1. `cat ~/.mindrian/room-health.json` - shows a status + timestamp from an old manual run (or
     absent entirely on a fresh box).
  2. Run `/mos:doctor` and `/mos:doctor --fix` in the live session - `room-health.json` is untouched
     by either (confirmed: doctor.cjs's own flag parser has no bare-run or `--fix` path that reaches
     `persistRoomHealth`).
  3. `grep -rn "bindTimeCheck" .` (dev workspace) -> exactly 3 hits, all inside
     `session-binding-consumer.cjs`'s own dead guard block (lines 81, 84, 85); zero definitions or
     exports anywhere.
  4. `grep -n "module.exports" scripts/doctor.cjs | tail -1` -> line 3888:
     `{ runAccumulativeEngine, renderHumanReport, computeSummary, _walResetAdvisory, _sqliteVersionLt }`
     - `bindTimeCheck` absent.
  5. `grep -n "doctor\|bind-check\|bindCheck|room_bind" lib/mcp/tool-router.cjs` -> the `room_bind`
     tool registration (line 1611-1621) and its F.8 connector metadata (1808+), zero doctor/health
     reference in between.
started: the `--bind-check` CLI flag and `persistRoomHealth()` write function both ship correctly
(quick-task 20260702-statusline-live-signals, closed/green). The gap is that nothing was ever wired
to call `--bind-check` automatically. `session-binding-consumer.cjs:73-75` self-documents this as a
deliberate temporary stub pending "Wave 5 (194-07)" - which never shipped a real `bindTimeCheck`.

## Scope and Impact

- Affected surfaces: cli only (the statusline chip is a CLI-only affordance; `room_bind` itself is
  used by all three surfaces, but the health-chip consumer is CLI-specific per
  `lib/statusline/cockpit-signals.cjs`'s own header).
- Affected commands: any session that binds a room and then looks at the statusline for health
  status. `/mos:doctor` itself is unaffected functionally - its own checks are accurate - only the
  STATUSLINE's independent cached read is stuck.
- Severity: medium. Not a data-integrity or Brain-boundary issue (Part 8 untouched); it is a
  trust/UX defect - a stale warning that never resolves erodes confidence in the diagnostic surface
  and sends navigators down a dead-end `--fix` path.
- Version range: since `--bind-check` shipped (quick-task 20260702) with no caller ever added.

## Eliminated

- hypothesis: `/mos:doctor --fix` should clear this and silently fails to.
  evidence: `doctor.cjs`'s flag parser and module registry (`data/doctor-modules.json`) have no
  `room-health` or `bind-check` entry reachable from a bare run or `--fix` - it is a structurally
  separate code path (`--bind-check` is its own top-level flag branch), not a module that `--fix`
  iterates. There is nothing for `--fix` to have "silently failed" - it was never in scope.
  timestamp: 2026-07-31T00:00:00Z

- hypothesis: a detached/manual CLI invocation of `--bind-check <roomDir>` is a valid way to refresh
  the cache going forward.
  evidence: manually running it from a detached shell against the shipped cache produced
  `ADVISORY ... off-scope: session not bound to "<room>"` and wrote a false/artificial `drift`
  reading - a bare subprocess cannot reproduce the live session's actual binding state. Confirms the
  fix must be a real in-session caller, not a documented manual workaround.
  timestamp: 2026-07-31T00:00:00Z

## Evidence

- timestamp: 2026-07-31T00:00:00Z
  checked: `lib/statusline/room-health-cache.cjs` (dev HEAD) and its one caller
  found: `persistRoomHealth()` exported; grep for its call sites across the tree returns exactly one,
  inside `scripts/doctor.cjs`'s `--bind-check` flag branch.
  implication: the WRITE function is correct and tested in isolation; the gap is entirely on the
  CALLER side.

- timestamp: 2026-07-31T00:00:00Z
  checked: `lib/mcp/tool-router.cjs:1611-1621` (`room_bind` registration) and full tool body
  found: writes only the session-binding record (`writeSessionBinding()`) or returns
  `needs_binding_card`; no doctor/health reference anywhere.
  implication: the cleanest, most-used integration point (every session that binds through the MCP
  front door) has zero attempt at wiring this - not broken, never tried.

- timestamp: 2026-07-31T00:00:00Z
  checked: `lib/workflow/session-binding-consumer.cjs:77-96` (`_bindTimeJob`)
  found: line 81's own comment: "missing exported bindTimeCheck is a clean no-op and NEVER blocks
  the bind"; line 84's guard (`typeof doctor.bindTimeCheck === 'function'`) is permanently false
  because `doctor.cjs` never exports that name (confirmed against `module.exports` at line 3888).
  Sibling branch (92-93) calls `presence.registerPresence()` directly, which never reaches
  `persistRoomHealth`.
  implication: this call site tried to wire the fix and shipped a permanent dead branch instead -
  self-documented as intentional-but-temporary, and the temporary window never closed.

## Technical Root Cause

- Site: `lib/workflow/session-binding-consumer.cjs:84-85` (dead guard, never true) and
  `lib/mcp/tool-router.cjs`'s `room_bind` tool body (no attempt at all).
- Cause: two separate work items (Phase 194-07 Wave 5, and quick-task 20260702-statusline-live-signals)
  each assumed the other had already wired a real caller for `scripts/doctor.cjs`'s `--bind-check`
  CLI flag / `persistRoomHealth()` write function. Neither one actually connected a live caller to it.
- Why it surfaces now: it has been latent since `persistRoomHealth()` shipped. It becomes visible
  the moment a navigator looks at the statusline after the very first stale write and expects it to
  ever move again.

## Required Code Changes (proposed - to be confirmed/implemented by the debug session manager + TDD)

- Change 1:
  - Location: `lib/mcp/tool-router.cjs`, `room_bind` tool handler body.
  - Current behavior: writes the session-binding record only; no health signal produced.
  - Required behavior: after a successful bind (not on the `needs_binding_card` early-return path),
    call a lightweight, IN-PROCESS health check (NOT a `child_process` spawn of `doctor.cjs` from
    inside an MCP tool handler - that is the wrong shape for a synchronous tool call) and call
    `persistRoomHealth(status)` from `lib/statusline/room-health-cache.cjs` directly, reusing
    `statusFromBindReport` if the existing `--bind-check` report shape can be produced in-process
    without shelling out.
  - `scripts/doctor.cjs`'s CLI `--bind-check` flag stays as the documented manual/scripted entry
    point (unchanged), but is no longer the ONLY caller.
- Change 2 (cleanup, may be deferred to a separate item - navigator call):
  - Location: `lib/workflow/session-binding-consumer.cjs:77-96`.
  - The `bindTimeCheck` dead-guard branch (81-90) is provably permanent dead code once Change 1
    ships via `room_bind`. Either remove it or point it at the same real health-check function so
    both call sites are consistent, rather than leaving a second, differently-broken path alive.

## Tests to Add or Update

- New failing test (TDD, write first): assert that calling the `room_bind` tool handler against a
  real (or fixture) room results in `~/.mindrian/room-health.json` (HOME-overridden for the test)
  being written with a status derived from an actual health read, not left untouched.
- Regression: `tests/test-statusline-live-signals.cjs` (persistRoomHealth/readHealthStatus/
  statusFromBindReport unit coverage) must stay green - the write-side contract is not changing,
  only who calls it.
- `tests/test-doctor-bind-check.test.cjs` and `tests/test-session-binding-consumer.test.cjs` - re-run
  and update their stale "SKIPs until Wave 5" framing once a real caller exists, so they stop giving
  false confidence.

## Non-Code Follow-ups

- DONE 2026-08-01 - `rethinking-mindrianos` room: filed per the Dev-Research Compositing convention
  (CLAUDE.md) at
  `~/MindrianRooms/rethinking-mindrianos/research/2026-08-01-health-chip-writer-with-no-caller/2026-08-01-health-chip-writer-with-no-caller.md`,
  cross-linked back to this file. Auto-committed by the room's data-room-autocommit hook; MINTO
  regen queued. It sits alongside its three siblings in the same defect family
  (`2026-07-28-minto-debounce-consumer-dead-end`, `2026-07-28-hedge-fold-no-production-trigger`,
  and `graph-edge-pending-undrained-dead-letter-queue` in the knowledge base) and names the
  inversion that distinguishes this one: those three are an honest PRODUCER with no consumer, this
  one is a correct, unit-tested WRITER with no live caller and a perfectly working consumer.
- DONE 2026-08-01 - CHANGELOG.md: Fixed entry added under `## [Unreleased] -- v1.16.0-beta.6
  (in progress)`.
- DONE 2026-08-01 - knowledge-base.md: summary block appended under the slug
  `statusline-room-health-chip-never-updates`, and this file moved to `.planning/debug/resolved/`.
- Release lockstep: this is a code fix with no version bump of its own. When it rides a release, the
  five-place lockstep in `.claude/includes/release-process.md` applies as usual.
- STILL OPEN - nothing is committed in the plugin repo. All code and test changes are in the working
  tree. Per the standing rule, a `main` commit is not live until a release ships AND is picked up by
  the install cache, so this fix is NOT yet observable in any running session.
- STILL OPEN (navigator call, deliberately not decided here) - `tests/test-room-bind-health-signal.cjs`
  was not registered in any runner. `tests/run-all.sh` globs only `test-*.sh`, and this test's closest
  siblings (`test-statusline-live-signals.cjs`, `test-room-bind-stdio-session-fallback.cjs`) are
  likewise unregistered, so leaving it out matches local convention. Flagged rather than silently
  chosen, because an unregistered regression test for a missing-caller bug is itself a small instance
  of the same defect class this RCA is about.

## Resolution

root_cause: |
  A missing CALLER, not a broken writer. `lib/statusline/room-health-cache.cjs`'s
  `persistRoomHealth()` is the only writer of `~/.mindrian/room-health.json`, the cache
  `lib/statusline/cockpit-signals.cjs`'s `readHealthStatus()` feeds the statusline health chip from.
  Across the whole tree `persistRoomHealth()` had exactly ONE call site:
  `scripts/doctor.cjs:2761`, inside the `--bind-check <roomDir>` CLI flag branch. Nothing in the
  shipped product (no MCP tool, no hook, no session flow) ever invoked that flag, so the cache was
  only ever written by a manual shell run and the chip froze at whatever that run left behind. A
  second, orphaned integration point made the gap invisible: `session-binding-consumer._bindTimeJob`
  guarded its call on `typeof doctor.bindTimeCheck === 'function'`, and `scripts/doctor.cjs` never
  exported `bindTimeCheck`, so that branch was permanently-false dead code that looked wired.
  Two work items (Phase 194-07 Wave 5 and quick-task 20260702-statusline-live-signals) each assumed
  the other had connected the caller. Neither did.

fix: |
  Wire real, live, in-process callers to the existing write contract. No child_process spawn, no
  change to `persistRoomHealth` / `statusFromBindReport`, no Brain call (Canon Part 8 untouched).

  1. NEW `runBindHealthCheck(opts)` exported from `lib/statusline/room-health-cache.cjs` (plus a
     `roomsHome()` helper). It is the `--bind-check` flag's composition extracted for in-process
     callers: resolve the room directory (explicit `roomDir` wins, else the ONE slug -> dir
     derivation `resolve-active-room.registryRoomPath`, else the flat `<home>/<slug>` so a missing
     directory reports an honest `room-dir-missing` finding instead of a fabricated green), run
     `session-presence.runBindCheck`, map through `statusFromBindReport`, persist. Never throws;
     returns null and writes NOTHING when the check cannot run at all.
  2. `lib/mcp/tool-router.cjs` `room_bind` handler: new guarded local `persistBindHealth()` helper,
     called after BOTH successful bind paths (explicit room, cwd auto-bind). Deliberately NOT called
     on the `needs_binding_card` ambiguity path - no bind happened, so no health status is honest
     there. Wrapped in try/catch: a health fault can never break or block a bind.
  3. `lib/workflow/session-binding-consumer.cjs` `_bindTimeJob` (Change 2): the permanently-false
     `doctor.bindTimeCheck` guard now calls the SAME `runBindHealthCheck`. Chosen over deleting the
     branch because the F.8 gate is the CLI's own bind path (the surface the bug was reported from);
     deleting it would have left CLI binds health-blind while MCP binds were wired. Result: exactly
     ONE honest bind-time health path, not two differently-broken ones. The sibling
     `presence.registerPresence()` call is untouched (live, working, separate concern).

  `scripts/doctor.cjs --bind-check` is unchanged and still works as the manual/scripted entry point;
  it is simply no longer the only caller.

  Test hygiene (required by the change, not optional): the bind-time job writes to
  `HOME/.mindrian/`, so two tests that drove real bind paths without isolating HOME were overwriting
  the developer's real statusline cache. Both now pin HOME to their fixture. A targeted sweep of 11
  other binding/classifier tests found no further polluters.

verification: |
  TDD gate (RED first, captured before any production code):
    $ node tests/test-room-bind-health-signal.cjs
      FAIL explicit-room bind writes a fresh room-health.json
        room_bind must write the room-health cache the statusline reads
          (/tmp/mos-bind-health-home-HL3qEo/.mindrian/room-health.json)
      FAIL the persisted status is derived from a real health read (sound vs drift)
        ENOENT: no such file or directory, open '.../room-health.json'
      FAIL cwd auto-bind also writes the health signal
        ENOENT: no such file or directory, open '.../room-health.json'
      ok   the needs_binding_card path writes no health status
      FAIL a throwing health check never breaks a successful bind
        the room-health-cache module must be loaded by the bind path
      ok   the room_bind health path spawns no doctor.cjs subprocess
      ok   this test file is em-dash-free
      room-bind-health-signal: 4 FAILED   (EXIT=1)

  GREEN after the fix: `room-bind-health-signal: ALL PASS` (7 of 7, EXIT=0).

  Suites (all EXIT=0, zero regressions, zero pre-existing failures encountered):
    tests/test-room-bind-health-signal.cjs .............. 7/7 ALL PASS  (new)
    tests/test-statusline-live-signals.cjs .............. 10/10 checks passed
    tests/test-doctor-bind-check.test.cjs ............... PASS (rewritten: skip -> hard fail)
    tests/test-session-binding-consumer.test.cjs ........ PASS (rewritten: skip -> hard fail)
    tests/test-binding-gate-degrade.test.cjs ............ PASS
    tests/test-room-bind-stdio-session-fallback.cjs ..... 4/4 ALL PASS
    tests/test-tool-router-active-room-misroute.cjs ..... 4/4 ALL PASS
    tests/test-tool-router-grouped-reference.cjs ........ 4/4 ALL PASS
    tests/test-194-local-only.test.cjs .................. PASS (Part 8 floor, 7/7 modules,
                                                          zero Brain/network token)
    tests/test-198-concurrency-mcp.test.cjs ............. PASS
    tests/test-225-answer-narrowing.cjs ................. 4/4 checks
    bash tests/run-all-194.sh ........................... Passed 16, Failed 0, Skipped 0

  Gates:
    node scripts/build-connector-registry.cjs --check ... connector-registry: OK        (EXIT=0)
    node scripts/build-orchestration-projection.cjs --check
                                                        orchestration-projection: OK    (EXIT=0)
    node scripts/check-render-coverage.cjs .............. 16 covered / 0 gap; md-keyspace
                                                          202 wired / 0 unwired          (EXIT=0)
    node scripts/check-shape-declaration.cjs --check .... EXIT=0. Two ADVISORY WARNs
                                                          (skills/vault, skills/visualize) are
                                                          PRE-EXISTING and unrelated - neither file
                                                          was touched by this fix.

  END-TO-END through the REAL stdio MCP server (bin/mindrian-mcp-server.cjs, JSON-RPC
  initialize + tools/call room_bind, HOME and MINDRIAN_ROOMS_HOME isolated to a fixture):
    BEFORE (stale reading left by a manual `doctor.cjs --bind-check` run, which reported
            "ADVISORY off-scope: session not bound to demo-room" - the exact false-drift the
            Eliminated section documented):
      {"status":"drift","at":"2026-08-01T06:43:14.057Z"}
    room_bind result: { "ok": true, "bound": true, "primary": "demo-room" }
    AFTER:
      {"status":"sound","at":"2026-08-01T06:43:34.530Z"}
  The stale drift warning CLEARED, with a fresh timestamp, through the shipped front door. That is
  the reported symptom resolving end to end.

  Also confirmed: `~/.mindrian/room-health.json` (the developer's real cache) is untouched after the
  full sweep - the HOME-isolation fixes hold.

  Gate coverage honesty: Canon Part 8 verified (zero Brain/network token, asserted by
  test-194-local-only). Tri-Polar: the health chip is a CLI-only affordance, but the fix sits on
  `room_bind` (all three surfaces) and the CLI F.8 consumer, so Desktop and Cowork are correct by
  construction. Cross-platform: pure fs + a read-only node:sqlite open, no spawn and no shell, so
  Windows/Mac are correct by construction; EXECUTED on Linux only.

files_changed:
  - lib/statusline/room-health-cache.cjs (NEW exports `runBindHealthCheck` + `roomsHome`; header
    updated. The `persistRoomHealth` / `statusFromBindReport` write contract is unchanged.)
  - lib/mcp/tool-router.cjs (NEW guarded `persistBindHealth()` helper in `registerRouterTools`;
    called after both successful `room_bind` paths, never on `needs_binding_card`.)
  - lib/workflow/session-binding-consumer.cjs (Change 2: the dead `doctor.bindTimeCheck` guard in
    `_bindTimeJob` now calls the same `runBindHealthCheck`; header comment corrected.)
  - tests/test-room-bind-health-signal.cjs (NEW, 7 legs, the TDD gate.)
  - tests/test-doctor-bind-check.test.cjs (stale "SKIPs until Wave 5" framing removed; guards are
    hard failures now; the original TODOs implemented as real assertions.)
  - tests/test-session-binding-consumer.test.cjs (same de-skilling; HOME isolated; new assertion
    that the previously-dead bind-time branch now writes a real health status.)
  - tests/test-room-bind-stdio-session-fallback.cjs (HOME pinned to the fixture - it drives
    `room_bind`, which now writes `HOME/.mindrian/`.)
  - tests/test-225-answer-narrowing.cjs (HOME added to the classifier spawn env, same reason.)

commits: none - changes left uncommitted in the working tree for the session manager.
