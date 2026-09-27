# Phase 355.1: Ambient trigger, the room starts the breakthrough run -- Close-out

Published by: 355.1-16 (Task 1, requirements registration and validation finalization;
Task 2, this record, the handoff entry and the rethinking-mindrianos room filing). Closes
`355.1-PRD.md`'s AC1-AC8, `355.1-CHECKPOINT.md`'s single human checkpoint, and every
`355.1-*-SUMMARY.md` on disk.

## What the navigator ruled, and why

The room, never the user, starts the breakthrough run. The navigator's own words, recorded
verbatim in substance in `355.1-PRD.md`: users will not know when to trigger the breakthrough
engine, the point of MindrianOS is ever-growing opportunities and breakthroughs depending on
context and the need of the user, never on the user explicitly asking; rare are the users who
will know to ask for it, all will gain from using it. This phase widens the Phase 117 ambient
door (a filed artifact already starts a background check) so a room change of any of five
kinds, not only a new file, can start the same kind of unattended run, on every surface the
plugin ships to, with the same honesty rules Phase 355 already built for a cross-connection
finding: a real stamp, a proposed-only file, one card, never a score.

## What shipped, one line per requirement

- **AMB-01, delta vocabulary.** Five room-delta classes (claims past a floor, a CONTRADICTS
  edge, a stage change, a sub-room created, a filed artifact) detected only through
  `navigation.cjs` reads, never a second SQL door. Proof: `node tests/test-3551-delta-classes.cjs`
  33/33, `node tests/test-3551-chokepoint.cjs` 6/6 (a planted second SQL reader caught).
- **AMB-02, one detector, an existing reach.** `SENS-21` (the PRD's `SENS-20` corrected once
  Phase 345 was found already holding that id) rides the existing `context_block` reach and
  fires only as the honest fallback offer. Proof: `node tests/test-3551-lockstep.cjs` 10/10,
  `node tests/test-3551-sensor-fires.cjs` 8/8.
- **AMB-03, the run underneath.** The Phase 117 fire child's new ambient mode composes the five
  Phase 355 producers behind one lock, `proposed`-only writes, nothing needing a human to ratify
  until the gate. Proof: `node tests/test-3551-evaluator.cjs` 19/19, `node
  tests/test-3551-one-spawner.cjs` 3/3, `node tests/test-3551-ambient-run.cjs` 18/18, `node
  tests/test-3551-child.cjs` 22/22.
- **AMB-04, run ledger, no re-runs.** The same delta hash never re-runs; a disclosed hourly
  throttle; a lock file against a duplicate child. Proof: `node tests/test-3551-ledger.cjs`
  100/100, `node scripts/check-floor-ledger.cjs --check` (37 rows, 0 unresolved).
- **AMB-05, surfacing, Hooked.** One card, once, only `strong`/`indirect` stamps reach it; the
  Hooked audit discloses the 14 percent frontmatter-coverage limit plainly, no praise, no grade,
  no count. Proof: `node tests/test-3551-hooked-audit.cjs` 18/18, `node
  tests/test-3551-double-card.cjs` 17/17, `node tests/test-3551-surfacing.cjs` 79/79, `node
  tests/test-3551-mcp-fire-once.cjs` 44/44.
- **AMB-06, tri-polar.** CLI keeps the PostToolUse fingerprint plus gains a new async Stop-hook
  entry; Desktop and Cowork evaluate the same delta at the MCP server's own close-out;
  `/mos:auto-explore` stays a documented fallback. Proof: `node tests/test-3551-tri-polar.cjs`
  24/24, `node tests/test-3551-prose.cjs` 73/73.
- **AMB-07, strategy not keywords.** The card's framing follows a non-keyword lookup chain
  (ratified rung, `ROOM.md` stage, STATE.md fields, the structural classifier, then neutral); the
  three phrases were confirmed by the PWS author at the checkpoint. Proof: `node
  tests/test-3551-framing.cjs` 18/18, `node tests/test-3551-prose.cjs` 73/73.
- **AMB-08, boundaries.** Canon Part 8 (local reads, handles-only to Theo, no room bytes in argv
  or logs), Part 9 (machinery confirms nothing) and Part 11 (born wired or excluded) all hold;
  the four structural gates stay green. Proof: `node tests/test-3551-part8-egress.cjs` 68/68,
  `node tests/test-355-part8-egress.cjs` 31/31, and all four of
  `build-connector-registry.cjs --check` / `build-orchestration-projection.cjs --check` /
  `check-render-coverage.cjs` / `check-shape-declaration.cjs --check` exit 0.
- **AMB-09, proof and close.** The phase's own aggregator green with its external reds named,
  doctor unregressed, every AMB id registered here. Proof: `bash tests/run-all-3551.sh`
  PASS=63 FAIL=4 SKIP=0 (all 4 pre-existing, none caused by any 355.1 file); `node
  scripts/doctor.cjs --acceptance` 20/22, the same failing-point set as `BASE_3551`.

## The six rulings and the checkpoint outcome

`355.1-CHECKPOINT.md` recorded the navigator's answer to all ten sheet items plus one accepted
follow-up, approved 2026-09-27, no ruling overturned:

1. The Hooked audit as filed: APPROVE.
2. Claim floor N = 5 (measured median claims per active room-hour, p50 5, across 31 live rooms):
   APPROVE.
3. Throttle 1 ambient run per room per hour: APPROVE.
4. The three framing phrases, confirmed by the PWS author (role only, never a name):
   APPROVE, `framing_hash` verified equal to
   `02e90c9d97a9945c5284f68541079fd447760cf853d37219fdd7625d993d9795`.
5. Ruling 1, stamping allowed on Desktop and Cowork (the child calls `brain-client` directly,
   including the keyless one-shot silent registration): stands.
6. Ruling 2, fire-once on hookless surfaces recorded at the Stop-time close-out, extending
   Phase 355's own fire-once mark rather than replacing it: stands.
7. Ruling 3, `/mos:eureka` and `/mos:scout` stay `halt` in the registry, the child calls their
   library functions directly, no posture reclassification this phase: stands.
8. Ruling 4, the AI-SPEC's two trigger moments shape the card's framing only, never gate the
   run: stands.
9. Ruling 5, on a filed artifact the stamped SENS-13 card wins over the older Phase 117 card:
   stands.
10. Ruling 6, the framing phrases get the PWS author's confirmation at this checkpoint, role
    only: stands.
11. Accepted, not on the filed sheet: the ambient eureka adapter (plan 355.1-07) ranks pairs by
    raw `abs_diff` only, not the full AHP-weighted ranking a stand-alone script already computes.
    Accepted for this phase with a named follow-up: extract a rank-only export from that script
    in the upcoming MCP intelligence-layer phase (logged in `deferred-items.md`).

## Release-note items for the next `scripts/release.sh` cut

- A new async Stop-hook entry, `scripts/ambient-stop.cjs --stop` (`hooks/hooks.json`, `async:
  true`, `timeout: 5`), evaluating room-delta classes (a) through (d) on every CLI turn end.
- The Phase 117 fire child's `--ambient` mode, composing the five Phase 355 producers behind one
  ledger and lock.
- `SENS-21` registered in `lib/core/insight-sensors.cjs`'s canonical order, riding the existing
  `context_block` reach, firing only as the honest fallback offer.
- `/mos:auto-explore` reworded as the fallback path and listing `SENS-01` and `SENS-21` in its
  `sensor_triggers`, never presented as the way in.
- `SENS-13`'s card gains a problem-type framing prefix (three phrases, confirmed by the PWS
  author) ahead of the existing stamp line.

## Nothing here is live yet

Every commit named above is on `main`. Per this repository's own release process
(`docs/RELEASE-CEREMONY-RULING-SYSTEM.md`, `.claude/includes/release-process.md`), a `main`
commit is not live until `scripts/release.sh <version>` cuts a version (all five lockstep files
updated, the git tag pushed) and a user runs the two-command manual update path (`/plugin
marketplace update` then `claude plugin update mos@mindrian-marketplace`; third-party plugins
never auto-push). No release was cut by this phase. No user is running any Phase 355.1 change
yet.

## Open limits, stated plainly

- **14 percent frontmatter coverage makes the reward sparse.** Only 472 of 3,333 live artifacts
  carry the `framework:`/`methodology:` frontmatter a stamp needs to resolve an endpoint, so most
  real-room ambient findings will stamp `unverified` and never reach the card until rooms carry
  that frontmatter (`355.1-HOOKED-AUDIT.md`).
- **A chat-only turn can re-offer a card between close-outs on a hookless surface.** Ruling 2
  records fire-once at the Stop-time close-out on every surface rather than inside `decide()`,
  the accepted cost of keeping `suggest_next` a pure read; a card already shown this session can
  in principle surface again before the next close-out clears it.
- **Cowork server locality (A1).** If the MCP server on Cowork does not run as a local process
  able to spawn a detached child, the ambient child never starts on that surface; the degrade
  path is the same `SENS-21` honest fallback offer built for a spawn failure anywhere.
- **Missing python or scikit-learn on a user machine (A3).** The HSI, whitespace and rs-engine
  producers degrade to `deps_missing`; the same `SENS-21` fallback covers this case, and the card
  may never fire on that surface until the dependency is present.
- **Find-connections stamps only pairs other producers surfaced (C11).** `stamp-connections.cjs`
  is prompt-driven: in an unattended ambient run it can only stamp pairs another producer already
  handed it, never generate its own; a stated limitation, not an omission.

## The Theo-side analog

Theo's own graph vocabulary already carries a `Sensor` node label and a `TRIGGERS` relationship
type, minted for the plugin's sensor layer at an earlier phase (`/home/jsagi/Theo/notes/graph-
rulebook.md`, read only, lines 395-437). Theo's projection of the plugin's `sensor_index` gains a
`SENS-21` `Sensor` node on its next re-emission, the same pattern as every prior sensor id; no
Theo file is edited by this phase or this close-out.

## Deployment status

Fixed on `main`, not live until released and picked up. `git rev-parse HEAD` at the time of this
close-out: `0a3fb30e2` (`node lib/core/repo-version.cjs` reports `2.0.0-beta.50`). The next
release cut should include every commit this phase produced; `scripts/release.sh`'s own
Theo-notify step (Step 5.6) will fire a `repository_dispatch: theo-resync` at that time.
