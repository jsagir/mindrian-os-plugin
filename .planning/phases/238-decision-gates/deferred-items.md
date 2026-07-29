# Deferred Items -- Phase 238 Plan 02

## scripts/on-stop line-count budget exceeded (out of scope)

`bash tests/run-all-198.sh` fails one pre-existing leg: `SPEC-5 hooks/ adapter-only budget`
(`tests/test-198-adapter-budget.test.cjs`). `scripts/on-stop` is 612 lines against a recorded
budget of 570 (`checkAdapterBudget()`'s `lineBudget.pass:false`).

`scripts/on-stop` was last touched by Phase 241 (`c7fb00db feat(241-05): run the guardian on
the shared mindrian-core Stop path`), well before this plan started. This plan's only change
is `lib/mcp/gate-render.cjs` (lifting `validateChosenAgainstCard` into an export); it never
touches `scripts/on-stop` or the adapter-budget test. Confirmed pre-existing by diffing this
plan's commit (`dc764ace`) against the failure: the file `scripts/on-stop` does not appear in
either of this plan's diffs.

Out of scope per this plan's own `<out_of_scope>` section (which names only
`lib/mcp/tools/{gate,chain}.cjs`, the room-resolver copies, and Phase 236/237 territory) and
per the executor's Scope Boundary rule (only auto-fix issues directly caused by the current
task's changes). Not fixed here. Surfacing for a future Phase 241-line plan or a dedicated
quick task to either raise the recorded budget or trim `scripts/on-stop`.

## Phase 238 Plan 05

### tests/test-209-room-pick-sensor.cjs fails (pre-existing, out of scope)

`bash tests/run-all-209.sh` reports `PASS=8 FAIL=1` with the failing leg `209-05 room-pick
sensor (E5)` (`tests/test-209-room-pick-sensor.cjs`). The failure is inside an E5
"REJECT-with-reason writes a typed REJECTED edge and does NOT promote" assertion, unrelated
to card-fire, the retry store, or any file this plan touches.

Confirmed pre-existing and out of scope: `tests/test-209-room-pick-sensor.cjs` is
byte-identical to its state before this plan's commits (diffed against `e7b0efe9`, the parent
commit at plan start), and the file contains zero references to `check-card-fire` or
`write-lock`. This plan's files_modified are `scripts/check-card-fire.cjs` and
`tests/test-238-retry-counter-fence.cjs` only; neither is referenced by the failing test.
Not fixed here per the Scope Boundary rule. Surfacing for whichever future session owns the
209-05 sensor test.
