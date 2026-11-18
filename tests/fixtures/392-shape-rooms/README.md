# 392-shape-rooms: synthetic rooms for the Part 8 shape packet

These three directories are SYNTHETIC fixture rooms for
`tests/test-396-shape-packet.cjs` (Phase 392, plan 08). Every value in them is
INVENTED. No directory here is a copy of a real room. No value names a real
venture, a real person, a real URL or a Brain identifier. The stage words,
the role weights, the constraint lines and the thesis line are made up so the
builder has something to read; they carry no meaning outside this test.

Rules the fixtures obey:

- Every line in every fixture file is 60 characters or shorter.
- No real room slug from `~/MindrianRooms` appears anywhere.
- The builder reads these directories through the `roomDir` argument only.
  It never reads `~/MindrianRooms` in a test.
- The test hashes this tree before and after the run and fails when any byte
  changed: the builder must not write.

| Room | Files | What it exercises |
|------|-------|-------------------|
| room-a | STATE.md, USER.md, .mindrian/jtbd-state.json | every source present: jtbd goal rung, venture_stage, role_blend argmax, domain key, two constraint lines |
| room-b | STATE.md, USER.md | no jtbd goal (classify path), no domain key, role_blend tie (role_default), no constraint key |
| room-empty | STATE.md | frontmatter with no venture_stage, no USER.md, no jtbd: every default |

Invented values, by file:

- room-a/STATE.md: `venture_stage: Validation` (a VALID_STAGES member),
  `domain: finance` (a critic tag), two invented constraint lines.
- room-a/USER.md: an invented role_blend (investor 0.6, founder 0.3) and an
  invented `canonical_role`.
- room-a/.mindrian/jtbd-state.json: an invented goal with rung WellDefined.
- room-b/STATE.md: `venture_stage: Discovery`, an invented thesis line and
  three reasoning scalars chosen so classifyProblemType returns IDP.
- room-b/USER.md: a role_blend of seven equal weights (a tie).
- room-empty/STATE.md: one counter and nothing else.

Hyphens only, no em dash.
