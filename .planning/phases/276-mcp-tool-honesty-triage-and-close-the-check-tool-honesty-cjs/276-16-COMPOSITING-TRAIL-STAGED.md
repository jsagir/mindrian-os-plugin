# Same-Disease Consolidation: MCP tool honesty + local-graph false-success deep fixes

**STAGED, not landed.** Attempted write to
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-03-same-disease-consolidation/2026-09-03-same-disease-consolidation.md`
was blocked by the `scripts/write-scope-check` PreToolUse guard:

```
Blocked: write to rethinking-mindrianos denied. Active room is jonathan-contractor-motj.
To authorize, run: /mos:rooms switch rethinking-mindrianos
(Or save the artifact in the active room if it belongs there.)
```

Per this plan's own phase_rules ("if the write-scope guard blocks that room ... stage the
trail content in the phase directory and record exactly what blocked it, as Phase 270-12
did; never bypass a guard"), the guard was NOT bypassed. This file is the staged body.
**Pending navigator action** (three steps, matching the 267.3-08 precedent):

1. Switch the active room: `/mos:rooms switch rethinking-mindrianos`
2. Copy this file's body (below the horizontal rule) to
   `~/MindrianRooms/rethinking-mindrianos/research/2026-09-03-same-disease-consolidation/2026-09-03-same-disease-consolidation.md`
3. Mirror it to `~/MindrianOS/research/` per the standing Dev-Research Compositing
   convention.

---

Filed from MindrianOS-Plugin Phase 276 (`276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs`),
plan 276-16 (close-out). Cross-links back to the phase directory:
`.planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/` in
`/home/jsagi/dev/MindrianOS-Plugin`. Mirror to `~/MindrianOS/research/` once landed.

## The one-disease-two-layers thesis

One repeating disease, found at two depths in the same codebase:

- **Layer 1 (MCP tool description vs. actual behavior).** A tool's description was written
  from the CLI command's real behavior, then wired over an MCP reference-echo handler that
  cannot perform it: `orchestration.scout` claims "ordinary reads and writes" while its
  handler returns a static reference; `room_content` calls itself "the WRITE surface" while
  three of its commands echo `commands/new-project.md` back as text; `export` tells a caller
  a dashboard was "generated" when it returned an instruction sheet. Three, then seven
  instances of the same pattern this repo's own standing WATCH item already names
  (`feedback_false_success_silent_skip_gates_academy_testers.md`).
- **Layer 2 (local-graph substrate claims a status it doesn't have).** `spine-events.cjs`
  proves `room.db` exists via `fs.statSync`, then reports `no_room_db` anyway because its
  catch block never inspects why the open failed (C5). The busy-timeout constructor option
  that makes a contended write wait instead of failing in 0ms was applied at exactly one
  opener out of 32 (C4). Both are the "propagation gap" Phase 273's own reviewer named as its
  real thesis: "several of the good fixes here were applied at exactly one site and never
  carried to their siblings."

Same shape, one layer down: a write or read path silently reports success, or a
wrong-but-plausible status, instead of the true state.

## The D-1 discovery and why a header comment claiming an unrun verification is the
## cautionary case for regex-over-AST

The phase's own detector, `scripts/check-tool-honesty.cjs`, shipped with a dead
`switch (command)` branch splitter: `splitBranches` ran `/\bcase\s+/` over text where string
literals had already been masked to spaces, so the greedy `\s+` swallowed the case value and
every label was rejected. Every `switch`-dispatched tool (`room_state`, `room_content`,
`room_graph`) was graded against its whole handler body instead of per command, hiding 14
findings (4 of them genuine HIGH RISK defects) behind a single write anywhere in a
15-command tool.

The script's own header comment claimed this fall-through grouping was "verified against
real fall-through in this codebase" -- a claim that cannot have been true, because the
switch path never produced a label to verify against. This is the tool built to catch
"claims it did X, did not do X" containing an instance of that exact defect, inside its own
paperwork. The fix was one line (anchor at `lm.index + 4`, skip whitespace in the original
text rather than the masked text); the live sweep moved from 10 findings to a corrected 24,
tool/branch discovery totals completely unchanged (36/130 both before and after) -- proof the
fix changed classification accuracy, not discovery coverage.

The lesson carried into the Theo coordination SEED (`docs/2026-09-03-THEO-SEED-tool-honesty-
ts-ast-port.md`): a hand-rolled regex-over-source detector is failure-prone in exactly this
way, and a real parser (`ts.createSourceFile`) removes the entire class of bug D-1
represents, because there is no hand-rolled scanner left to have a bug in.

## The propagation-gap framing carried from Phase 273's reviewer

Phase 273's own C1/C5 review named the standing lesson this phase exists to apply a second
time: a good fix applied at one site and never carried to its siblings leaves the disease
free to reaccumulate everywhere the fix didn't reach. Phase 276 is the propagation pass for
the MCP-description layer (Layer 1) and the substrate layer (Layer 2) at once, deliberately
scoped as ONE phase rather than split, because splitting is exactly how Phase 273's own C4
and C5 got orphaned in the first place (D-276-1).

## The icm-architect promotion bar: the same false-success shape from five independent
## sources

The false-success pattern was independently observed at: `rooms-open` (2026-07-27 RCA),
`meeting.file-meeting` (2026-09-03 RCA, the session that produced this phase),
`orchestration.scout` (this phase, F-1), `export`'s seven commands (this phase, F-2..F-8),
and `room_content`'s four-command echo group (this phase, F-11..F-14) -- five independent
instances of one pattern, well past the three-instance bar `icm-architect`'s own promotion
discipline names for treating a repeated shape as a standing class rather than a one-off.

## The measured before-and-after

| | Before this phase (first sweep) | After the D-1 fix | Final, post-fix |
|---|---|---|---|
| Tools / branches | 36 / 130 | 36 / 130 | 37 / 131 (claim_write added) |
| HIGH_RISK | 1 | 5 | **0** |
| MEDIUM | 8 | 18 | 12 (permanently visible, D-276-2) |
| UNKNOWN | 1 | 1 | 0 |
| OK | 120 | 106 | 119 |

Busy-timeout propagation (C4): the elapsed time under a genuinely held foreign write lock
moved from ~0.3-1.4ms (instant `SQLITE_BUSY` failure) to ~5018-5032ms (a genuine bounded
busy-wait) at every read-write room.db opener that can contend. Typed reasons (C5):
`spine-events.cjs` now reports `room_db_busy`/`room_db_broken`/`room_db_open_failed` instead
of unconditionally claiming `no_room_db` about a database it just proved exists.

## Decisions D-276-1 through D-276-6, with rejected alternatives

- **D-276-1**: the meeting Tri-Polar gap stays in this phase (wave 1 rules the vocabulary and
  surface-shape questions, later waves build). REJECTED alternative: splitting the meeting
  work into its own phase, exactly how Phase 273's C4/C5 got orphaned.
- **D-276-2**: closed means a written disposition per finding, verified by re-running the
  checker. No new suppression path; MEDIUM/UNKNOWN stay never-suppressible. REJECTED
  alternative: allowlisting the residual MEDIUM rows to reach a hollow "zero findings" state.
- **D-276-3**: `gate_render` gets a description correction (an in-memory ledger mint is not
  persistence), not a `STRONG_VERBS` change. REJECTED alternative: widening the verb
  vocabulary to catch the inflection "minted," which would have flipped the row to HIGH RISK
  for a mint that genuinely is not persistent state a user can lose.
- **D-276-4**: C4 is option-only at the room.db write openers; Group C/D (read-only,
  `:memory:`) are excluded with `room-db.cjs`'s own sentence (WAL readers never block
  writers) as the reason. REJECTED alternative: routing `lazygraph-ops` through `openRoomDb`
  (the researcher's own A9 recommendation), overruled because `openRoomDb` is async, returns
  a different `{db, conn}` shape across roughly 50 call sites, and runs a 7-step migration
  chain on every open -- the same ~40-file regression shape Phase 273 D-01a already rejected.
- **D-276-5**: C5 is the return-shape variant (`room_db_busy`/`room_db_broken`,
  `err.name` checked before `instanceof` since `spine-events` cannot re-throw). REJECTED
  alternative: a JS-level retry/backoff wrapper for M8, since `timeout: 5000` already IS the
  retry, implemented in SQLite, not JS.
- **D-276-6**: of the 24 findings, only `gate_render` lands on a Theo-absorbed tool.
  `gate_answer` and `chain_run` were checked against Theo's own constants rather than
  assumed diverged; `chain_run` measured IDENTICAL, correcting an inherited research claim.
  REJECTED alternative: pushing the `gate_render` fix directly into the Theo checkout,
  forbidden by Theo D-04 (coordinated, never executed cross-repo).

## Cross-link

Phase directory: `.planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/`
in `/home/jsagi/dev/MindrianOS-Plugin`. This staged trail is cited from that phase's
`ROADMAP.md` Phase 276 entry under the "Dev-Research Compositing" line, with the pending
navigator action recorded there too.

---
*Filed by phase 276 plan 276-16, 2026-09-04. STAGED pending navigator room-switch action.*
