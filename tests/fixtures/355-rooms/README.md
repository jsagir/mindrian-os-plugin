# tests/fixtures/355-rooms

Three Claude-authored synthetic Data Rooms built for Phase 355 (HIPS-07) to
measure whether the connection engines (RS, HSI, whitespace) find something a
person would call useful, on rooms small enough to fully author and reason
about by hand.

## Never run in place

Every test and the measurement script (`scripts/measure-355-hit-rate.cjs`,
355-24/355-25) copies a room into `fs.mkdtempSync(os.tmpdir())` before running
any engine against it, and deletes the copy afterward. No engine, script, or
test in this repo may run directly against a path under this directory - the
same rule `tests/fixtures/icm-rooms/README.md` states for Phase 353's fixture
rooms.

## No real names

Every artifact is synthetic, working-notes prose with pseudonymous roles only
(the coordinator, the transport lead, the security lead). No person, company,
or real place name appears anywhere in this tree, per the repo's own hard
rule.

## Case index

### `room-ill-defined/`

An ill-defined problem: a network of rural clinics is losing patients between
referral and follow-up, and the team does not yet agree on where. Root
`ROOM.md` carries `pws_stage: ill_defined`. Four sections: `patient-flow`,
`transport-logistics`, `community-trust`, `staffing`.

### `room-extend/`

An existing, working opportunity (a cold-chain delivery service) reviewed for
how it could extend to an adjacent use. Root `ROOM.md` carries
`pws_stage: extend_opportunity`. Four sections: `operations`,
`materials-science`, `retail-demand`, `regulation`.

### `room-control/`

Four deliberately distant domains (`cell-biology`, `computer-security`,
`retail-marketing`, `river-hydrology`) with planted meaning bridges (the same
mechanism described in two different vocabularies) and planted same-word
different-meaning cases, so the direction-fidelity judgment has real cases to
judge. No `pws_stage`.

## Do not open `planted-cases.json` before judging

`planted-cases.json` is the ground truth for `room-control`'s meaning bridges
and same-word cases, joined only after the navigator has judged the shown
pairings blind. Opening it before judging would bias the judgment it exists
to score. Nothing in the room text itself names a case as planted; the words
"planted", "false friend", and "bridge case" do not appear anywhere under
`room-ill-defined/`, `room-extend/`, or `room-control/`.

## D-48 frontmatter mix

A deliberate subset of artifacts in every room carries a leading frontmatter
`framework:` (an exact name from `data/framework-names.json`) or
`methodology:` (a command slug whose registry `frameworks[0]` resolves); the
rest carry neither, so a stamp's `handle_unresolved` path is exercised too,
not only its resolved path.
