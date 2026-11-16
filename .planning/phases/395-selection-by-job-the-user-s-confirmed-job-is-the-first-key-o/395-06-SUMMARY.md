# 395-06 Summary: the per-turn offer is the selector primary

Date: 2026-11-16. Branch `work/395-selection-by-job`. Base of this slice: `a0f421370`.

## What changed

* `lib/core/navigation-engine-offer.cjs` (R1): when the candidates come from the selector and the first selector id has a row in the ranked list, that row is the offer. It runs after every abstention rule: it changes which command is offered, not whether one is.
* `lib/core/navigation-engine.cjs` (R2): a framework chain proposal fills an empty offer only when its command is the selector primary; else the offer stays empty and the rationale gets 1 sentence.
* `data/harness-manifest.json`: 1 line, by its generator (digest of the engine file).
* Switch: env `MINDRIAN_NAV_NO_PRIMARY_PIN=1` gives the old behaviour (hook stdout byte-identical on 32 of 32 turns).
* New `tests/test-395-offer-is-primary.cjs` (21 checks); `tests/run-all-395.sh` lists it.

Cause of the old fault: the 3 selector ids get equal ranker scores; fusion by position then ordered them by the order of the registry file.

## What ran

* New test: 11 checks fail on the old code (scratch copy), 21 of 21 pass with the change. `bash tests/run-all-395.sh`: 6 files PASSED. Harness manifest check OK.
* 47 single test files: same exit codes before and after. Suite 36925 and suite 3696: same failing sets (one load-dependent arm passed this time).
* Cold check (`docs/designs/selection-path/runs/395-06/cold-check.md`): COMMIT, 0 blockers, 3 majors, 8 minors, on its own fixture and turns.
  * R1, 7,056 turns: an offer on 1,764 turns before and after, the same turns. With a selector primary and an offer (1,512 turns), the offer is the primary on 852 before and 1,512 after.
  * R2, 1,960 chain turns: `offer_next_step` not null on 1,624 before and 392 after. Of the 1,232 that lose it: 328 named a command that is not a selector id; 24 named a selector id that is not the first (a useful offer is lost); 880 named a framework with no command (no offer line was printed before; a malformed field line goes away).
  * Protections: a rejected or deferred primary now gives no offer (more careful than before); operator modes with no offer and the margin floor hold; no new egress or write.

## Decisions made without the owner (he can overrule)

* D1: never an offer where there was none. D2: a rejected primary gives silence, not the next selector id.
* D3 (rule R2): a chain proposal for another command is held. The visible loss: the line `Framework chain: X FEEDS_INTO Y` leaves the block on those turns, and 24 of 1,960 sweep turns lose a useful offer. The owner must confirm D3 before a version cut. Changes 3, 4 and 6 of the plan can be removed alone.

## Carried to a later plan

* MA1: keep `Framework chain: X FEEDS_INTO Y (held ...)` in the rationale of the held branch (`navigation-engine.cjs` near 1900); the held sentence is not true when the chain named a framework with no command.
* MA2: the offer path and the selector do not read `never-do.json` (before or after). With a command on the list as the selector primary, the old code offered it on 56 percent of the offer turns and the new code on 100 percent. Fix: `composeNextMove` drops a candidate that `room-constraints.checkStep` names. The list's own text says it governs unattended steps.
* MA3 (latent): `if (chosen === top)` at `navigation-engine-offer.cjs:206` lets the pin replace a tier 0 minimal verb when it is the top row. Not reachable today (no registry command is in the minimal set).
* Minor: the switch is read in 2 places and is not in `docs/ENV-TUNING.md`; `tests/test-36925-practical.cjs` arm P7 has a name ("KNOWN GAP") that is now false and an assertion that never could fail.
* Not verified: Mode A and Mode B through the hook; a live host. Desktop and Cowork get nothing from this change through the MCP server.

## Owner ruling on D3 (2026-11-16)

The owner confirmed D3 before the beta.85 cut: "Keep it held". A chain proposal for another command stays held; the held line names the chain (395-08).
