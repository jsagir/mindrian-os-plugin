# Scaffolder checklist

Writer graded: the room-map scaffolder, `lib/core/room-map.cjs` (`buildRoomMap`, `writeRoomMap`,
`renderSelfBlock`, `writeSelfBlocks`, `SELF_BLOCK_KINDS`), wired into
`lib/core/room-skeleton-scaffold.cjs` as its last scaffold step (353-01-SUMMARY.md).

All three items are `kind: code`: the scaffolder's own contract is entirely structural (a byte
comparison and a fingerprint recompute), so nothing here needs a Jev judgment. No item in this
checklist sends any byte to Jev; room content never crosses because nothing crosses at all.

## Item 1: every blocked-kind directory carries an icm_self block, and no artifact folder does

- kind: code
- contract: `lib/core/room-map.cjs::SELF_BLOCK_KINDS` (`root | section | structural | sub-room`)
  and `renderSelfBlock`/`writeSelfBlocks`; R-353-B (artifact folders are excluded by rule).
- check: for every node in the built map whose `kind` is a member of `SELF_BLOCK_KINDS`, its
  ROOM.md carries an `icm_self` frontmatter block; for every node whose `kind` is `'artifact'`,
  its ROOM.md (if one even exists) carries no `icm_self` block at all.
- crosses the wire: nothing. Local file read only, zero network.

## Item 2: the block's fingerprint equals the map's per-node fingerprint

- kind: code
- contract: `lib/core/room-map.cjs::mapFingerprint` (reused as `mapFingerprint([node])` for the
  per-node value, per 353-01-SUMMARY.md's key-decisions).
- check: recompute `mapFingerprint([node])` for the node the block claims to describe and assert
  it equals the block's own `fingerprint` field, so a stale block is caught by disagreement, not
  by trust.
- crosses the wire: nothing. Pure local hash comparison, zero network.

## Item 3: a missing root ROOM.md was created from the identity template

- kind: code
- contract: `lib/core/room-map.cjs::createRootIdentityFile` and the scaffolder's atomic-write
  contract (`room-skeleton-scaffold.cjs::atomicWrite`).
- check: on a fixture copy with the root ROOM.md deleted before the run, the scaffolder recreates
  it from the identity template rather than leaving the room headless; the recreated file still
  carries a valid `icm_self` block afterward.
- crosses the wire: nothing. Local file creation only, zero network.
