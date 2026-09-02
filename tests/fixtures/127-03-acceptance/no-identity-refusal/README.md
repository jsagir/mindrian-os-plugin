# Fixture: no-identity-refusal (acceptance gates 1 and 4)

Backs gates 1 and 4 of `tests/test-127-03-acceptance-gates.sh`. Phase 262 Plan 03
(FLOOR-02) repurposed this fixture from the retired dead-tier keyless fixture:
the identity `git mv`'d, never deleted, so the coverage stays intact and its
history follows (the same technique 252-01 used for
`lib/core/tier0-messaging.cjs -> refusal-messaging.cjs`).

Hermetic state: a clean `HOME` via `mktemp`, `MINDRIAN_BRAIN_KEY` explicitly
unset, and `MINDRIAN_DISABLE_AUTO_REGISTER=1`. That last one is load-bearing:
silent registration is the default path since 250-04, so without it a live
`/register` would mint a real token and make this fixture non-deterministic.
The shim's stderr startup line must also match the canonical pattern
`[mindrian-brain] MCP server v<version> started (stdio)` within 3s of spawn.

Expected behavior, inverted: the keyless path REFUSES honestly. `brain_schema`
returns the byte-locked status `DIRECTOR_NOT_AVAILABLE` with reason
`MINDRIAN_BRAIN_KEY not set`, an `upgrade_hint` pointing at the brain-access
override path, and NO methodology content of any kind. Say the negative
explicitly: the keyless path serves nothing, it does not degrade, and there is
no reduced tier behind it.

Doctrine: `docs/BRAIN-IDENTITY-DESIGN.md` rules Option C (anonymous degraded
tier) dead by navigator decision. This fixture is the proof that the dead tier
did not quietly survive in the test suite.

Why this file was not deleted: FLOOR-02's contract is coverage kept, assertion
inverted, never deleted. Deleting it would drop the only end-to-end coverage
of the keyless path.

Locked constraint: `DIRECTOR_NOT_AVAILABLE` is byte-locked and must not be
renamed here or anywhere; changing it breaks the shim, the statusline and the
doctor Class-M cascade.
