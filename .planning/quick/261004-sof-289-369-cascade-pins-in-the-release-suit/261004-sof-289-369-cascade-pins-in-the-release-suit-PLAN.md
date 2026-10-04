---
phase: quick
plan: 261004-sof
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/test-363-mcp-tool.cjs
  - tests/test-366-gated-term-release.cjs
autonomous: true
planner: orchestrator-authored (navigator budget ruling 2026-10-04, gsd-planner skipped to save tokens)
must_haves:
  truths:
    - "bash tests/run-all-366.sh (the release suite gate, scripts/release-lib/suite-gate.sh RELEASE_GATE_SUITES) reports 0 failed"
    - "test-366-gated-term-release R6b asserts the shipped 369 semantics: a wrong-session consume is refused with session_mismatch and does NOT spend the gate; the owning session still consumes it; no fetch happened"
    - "test-363-mcp-tool M3-M7 read the gate_answer reply where the daemon actually puts the grant resume result; the room M3 produces feeds M4, M5, M7 again"
  artifacts:
    - path: tests/test-366-gated-term-release.cjs
      provides: R6b moved to the 369 semantics with a dated reason comment
    - path: tests/test-363-mcp-tool.cjs
      provides: M3 reads the live reply key with a dated reason comment
---

# Quick 261004-sof: 289/369 cascade pins in the release suite gate

## Why

`tests/run-all-366.sh` is the beta.56 release suite gate (Step 0.6c). Two legs are red because
the test expectations lag behaviour that Phase 289 and Phase 369 shipped on purpose; the av2 and
369-47 summaries list them as known pre-existing reds (369-38 / 369-41 cascade). Measured
2026-10-04 after av2 (gate.cjs final, GATE_BASE ea60b398b):

- `tests/test-366-gated-term-release.cjs`: PASS 27 FAIL 1. R6b: `wrong` =
  `{ok:false, reason:'session_mismatch'}` as expected, but `right` is a consume result, not
  `null`. Since 369 a wrong-session attempt no longer spends the gate (durable, session-scoped
  consumption, consumed after COMMIT inside withRoomTx), so the owning session still consumes it.
- `tests/test-363-mcp-tool.cjs`: PASS 11 FAIL 4. M3 throws `TypeError ... reading 'slice'` at
  line 196: `JSON.stringify(ans.chain_result).slice(...)` with `ans.chain_result` undefined. The
  gate_answer reply for a grant gate no longer carries the resume under `chain_result` in the
  place the test reads. M4, M5, M7 fail only because M3 produced no room.
- `tests/test-363-live-smoke.cjs` exits 77: that is its SKIP code (no live Theo flag), not a red.

Not in scope (not in the release gate; follow-on quick): `tests/test-345-gate-ratify.cjs`
(one strict-equal false !== true) and `tests/test-353-filing-gate.cjs` (EVENT_TYPES.size 102 pin).

## Shared-tree rules

Main tree at /home/jsagi/dev/MindrianOS-Plugin, `export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH`.
A Phase 369.1 code fixer runs beside you on lib/core/mcp-dep-heal.cjs, mcp-install-responder.cjs,
dep-install-detached.cjs, npm-cli-resolve.cjs, scripts/sessionstart-npm-reconcile.cjs,
scripts/mindrian-mcp-server.cjs, scripts/release.sh, scripts/release-lib/*, scripts/doctor.cjs,
tests/test-369.1-*.cjs, tests/run-all-369.1.sh and the 369.1 phase docs: never stage any of that.
Write ONLY the two test files named above plus your SUMMARY. `git status --short -- <file>` before
each edit; STOP on a foreign diff on your files. Commit per task with `git add <path>` (`-f` under
.planning/) then `git commit --only -m "<msg>" -- <paths>`; never `git add .`/`-A`, `commit -a`,
`stash`, `reset`, `--no-verify`. Never kill a mindrian-mcp-server or shell you did not start. No
`npm install` at the root. No lib/ edits: if a leg can only go green by changing shipped code,
STOP and report (that is a defect, not a pin). Hyphens only, no em-dashes or en-dashes
(`/usr/bin/grep -P '[\x{2013}\x{2014}]'`). No STATE.md or ROADMAP.md writes.

<task type="auto" id="1">
  <name>R6b: pin the 369 session-scoped consume semantics</name>
  <files>tests/test-366-gated-term-release.cjs</files>
  <action>
Line 298-304. Rename the leg to say the gate is NOT spent by the wrong session, and assert:
`wrong && wrong.ok === false && wrong.reason === 'session_mismatch'`, `right` is the owning
session's successful consume (a non-null result; use the shape consumeGate actually returns for the
owning session, read lib/mcp/gate-ledger.cjs consumeGate to name it), and `calls.length === before`.
Add a two-line comment dated 2026-10-04 naming Phase 369 (durable consume after COMMIT,
session-scoped) as the reason the old `right === null` expectation moved.
  </action>
  <verify>node tests/test-366-gated-term-release.cjs -> PASS 28 FAIL 0 (record the line)</verify>
  <done>R6b green with the reason comment; nothing else in the file changed</done>
</task>

<task type="auto" id="2">
  <name>M3: read the gate_answer reply where the daemon puts the grant resume</name>
  <files>tests/test-363-mcp-tool.cjs</files>
  <action>
Find where gate_answer builds its reply for a chain-halt / grant gate (lib/mcp/tools/gate.cjs,
and whatever research_run's grant_request hands the ledger) and name the key that now carries the
resumed step's result (print `ans` once from the leg while diagnosing, then remove the print). Move
lines 189-226 to read that key, keeping every check M3 makes (ok, single use `replayed`, the odd
answer flagged, the room it produces for M4/M5/M7). Add a comment dated 2026-10-04 naming the
369 reply-shape change. If the resume result is genuinely absent from the reply, STOP and report
the exact reply JSON (first 300 chars) instead of weakening the test.
  </action>
  <verify>node tests/test-363-mcp-tool.cjs -> PASS 15 FAIL 0 (record the line)</verify>
  <done>M3-M7 green; the test still proves single use and the odd-answer flag</done>
</task>

<task type="auto" id="3">
  <name>Release suite gate end to end, then SUMMARY</name>
  <files>.planning/quick/261004-sof-289-369-cascade-pins-in-the-release-suit/261004-sof-289-369-cascade-pins-in-the-release-suit-SUMMARY.md</files>
  <action>
Run `bash tests/run-all-366.sh` once, end to end, and record its aggregator line. If a leg other
than the two above is red, do not fix it: record the leg name and the first FAIL line in the SUMMARY
(a hygiene sweep from the peer's tests can SIGKILL a daemon mid-run; if the red smells like that,
rerun that single test once and record both results). Write the SUMMARY (frontmatter: phase quick,
plan 261004-sof, status, commits; body: the two moves with before/after assertions and the measured
lines) and commit it with `git add -f` + `git commit --only`.
  </action>
  <verify>SUMMARY committed; run-all-366 aggregator line recorded</verify>
  <done>Hand back the aggregator line and the three commit shas</done>
</task>
