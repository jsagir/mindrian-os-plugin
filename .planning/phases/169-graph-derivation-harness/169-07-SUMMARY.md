---
phase: 169-graph-derivation-harness
plan: "07"
subsystem: graph-derivation-harness
tags: [gdh-08, gdh-09, d-169-11, self-heal, nested-within, room-birth, room-lineage, full-citizen, fractal-joint, part-3-gate, part-8]
requires:
  - phase: 169-00
    provides: "NESTED_WITHIN minted into the frozen ALLOWED_EDGE_TYPES (the room-lineage edge the heal writes)"
  - phase: 169-01
    provides: "the shared IFACE + the three RED stubs this plan turns GREEN (test-sentinel-self-heal / test-room-lineage-edge / test-depth2-full-citizen) + run-all-169.sh registration"
  - phase: 169-02
    provides: "lib/core/room-root.cjs resolveRoomRoot (consumed by the detect walk + the parent-slug resolution)"
  - phase: 169-04
    provides: "lib/core/graph-derivation.cjs rollupSubRooms (the depth2 down-walk consumes it; _directChildSlugs reads NESTED_WITHIN from the PARENT db)"
provides:
  - "lib/core/graph-self-heal.cjs detectUnsentineledArtifactFolder(roomDir) -> [{folder, artifactCount}] (GDH-08)"
  - "lib/core/graph-self-heal.cjs healRoom({folder, parentRoomDir, slug, approvedBy, runTimeline}) -> {ok, roomDir, slug, parentSlug, lineageEdge} (GDH-09 + D-169-11), approvedBy-gated, arbitrary-depth, idempotent"
  - "lib/core/navigation/room-birth.cjs opts.parent additive amendment (the .room-root sentinel JSON + the registry both gain an optional parent field; the no-parent born-room case is byte-unchanged)"
affects: [169-05, 169-06, b2-journey-backfill, room-lineage-graph-walks]
tech-stack:
  added: []
  patterns:
    - "self-heal via REUSE not net-new scaffold: healRoom INVOKES birthRoom (threading approvedBy + parent) for the full SEED-001 wiring + the Phase 124 timeline-runner.refreshAll for the temporal section (Part 7, D-169-10)"
    - "the room-lineage edge lives in BOTH the child db (the canonical NESTED_WITHIN, asserted by the lineage test) AND the parent db (a discovery copy so the shipped rollupSubRooms _directChildSlugs walk traverses DOWN to children)"
    - "MINDRIAN_ROOMS_HOME pointed at parentRoomDir for the birthRoom registry create/update so the operational registry joint lands under the parent (the live nested case), env restored after birth so the heal has no global side-effect"
    - "opts.parent additive amendment: the sentinel gains parent + slug ONLY when parent is set, so the omitted born-room sentinel is byte-identical"
key-files:
  created:
    - lib/core/graph-self-heal.cjs
  modified:
    - lib/core/navigation/room-birth.cjs
    - scripts/check-substrate.cjs
key-decisions:
  - "healRoom REQUIRES approvedBy and writes NOTHING without it (the Part 3 Decision Gate; the room-birth.cjs:316 gate); the test asserts the refusal both ways"
  - "the NESTED_WITHIN edge is written into BOTH the child db (canonical) AND a parent-db discovery copy, because the SHIPPED rollupSubRooms reads NESTED_WITHIN from the PARENT db to discover children; this is how the depth2 down-walk works"
  - "the registry parent joint is threaded through birthRoom (opts.parent -> the existing `update <slug> parent <parent-slug>` verb, Part 7 reuse -- no new registry verb invented), with MINDRIAN_ROOMS_HOME pointed at the parent room dir so .rooms/registry.json lands there"
  - "the sentinel gains a `slug` field alongside `parent` (only when parent is set) so the rollup _childDirForSlug walk can match the healed sub-room by slug; the omitted case stays byte-unchanged"
patterns-established:
  - "REUSE-the-deriver self-heal: detect + parent-pointer + NESTED_WITHIN edge + composition is the net-new; birthRoom + timeline-runner are reused verbatim"
  - "heal-first separation: healRoom does detect+birth+joints+timeline and RETURNS; it never indexes or derives (Plan 05 owns the index+derive AFTER the heal)"
requirements-completed: [GDH-08, GDH-09, D-169-11]
duration: 9min
completed: 2026-06-19
---

# Phase 169 Plan 07: THE CONSTITUTIONAL CORE (GDH-08 + GDH-09 + D-169-11) Summary

**lib/core/graph-self-heal.cjs detects a sentinel-less artifact folder (the live b2-journey case) and, on the navigator's APPROVE at the Decision Gate, self-heals it into a full-citizen room byte-indistinguishable from a born room (birthRoom reuse), joined to its parent BOTH operationally (registry parent + sentinel parent) AND graph-navigably (the NESTED_WITHIN lineage edge), with a `## Timeline (auto)` temporal section, composing at arbitrary depth, halting at the gate, touching no Brain wire.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-19T16:35:00Z
- **Completed:** 2026-06-19T16:44:00Z
- **Tasks:** 2 (both TDD; turned three RED stubs GREEN)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **GDH-08 detect.** `detectUnsentineledArtifactFolder(roomDir)` reads the direct child directories of a room and returns `{folder, artifactCount}` for each non-dot child that holds at least one `.md`/`.docx`/`.html` artifact but lacks its OWN `.room-root` sentinel. It REUSES the `scripts/heal-command.cjs:889-928` sub-rooms-container precedent (the `.room-root` `existsSync` check) rather than re-inventing the sentinel test, and never throws.
- **GDH-09 full-citizen heal.** `healRoom({folder, parentRoomDir, slug, approvedBy, runTimeline})` is HUMAN-GATED: without `approvedBy` it returns `{ok:false, reason:'no_approval'}` and writes nothing. On APPROVE it runs the ordered sequence (0) gate, (1) INVOKE `birthRoom` (threading `approvedBy` + `parent` for the full SEED-001 wiring: ROOM.md + STATE.md + MINTO.md + per-section FEYNMAN.md + BRAIN enqueue + room_created memory_event + own `.mindrian/room.db`), (2) the operational joint (registry parent + sentinel parent, done by birthRoom via the Task-1 opts.parent amendment), (3) the GRAPH-NAVIGABLE joint (the NESTED_WITHIN edge), (4) the FEYNMAN temporal joint (`timeline-runner.refreshAll`), (5) RETURN. It never indexes or derives (the heal-first separation; Plan 05 owns the index+derive).
- **The room-birth.cjs opts.parent additive amendment (Task 1).** `birthRoom` now accepts `opts.parent`: when non-empty it threads the parent slug into BOTH the `.room-root` sentinel JSON (a `parent` field, plus a `slug` field for the rollup walk) AND the registry (via the existing `update <slug> parent <parent-slug>` verb, Part 7 reuse). When `parent` is omitted, the sentinel + registry are byte-unchanged from prior born-room behavior, and the `approvedBy` gate is intact.
- **The D-169-11 fractal joint, both ways, at arbitrary depth.** The NESTED_WITHIN edge `room:<child> -> room:<parent>` is written into the child's OWN room.db (the canonical lineage edge the lineage test asserts) AND a discovery copy into the parent's room.db so the SHIPPED `rollupSubRooms` walk (`graph-derivation.cjs::_directChildSlugs` reads NESTED_WITHIN from the PARENT db) traverses DOWN to children. A 3-level chain (motj-ecosystem -> jonathan-contractor-motj -> b2-journey) links each level UP one hop and the leaf is visible from the top rollup DOWN (the depth2 acceptance).

## Task Commits

Each task was committed atomically:

1. **Task 1: room-birth.cjs parent-field amendment (sentinel + registry)** - `b13dd9ac` (feat)
2. **Task 2: graph-self-heal.cjs -- detect + the full-citizen heal** - `0eaf0cfb` (feat)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP) committed separately.

_The three RED stubs (test-sentinel-self-heal 4/4, test-room-lineage-edge 3/3, test-depth2-full-citizen 4/4) were turned GREEN by Task 2; Task 1's parent amendment is exercised through them._

## Files Created/Modified

- `lib/core/graph-self-heal.cjs` (created) - `detectUnsentineledArtifactFolder` (GDH-08) + `healRoom` (GDH-09 + D-169-11): the approvedBy-gated, arbitrary-depth, idempotent full-citizen self-heal (birthRoom reuse + operational joint + NESTED_WITHIN graph joint + FEYNMAN timeline).
- `lib/core/navigation/room-birth.cjs` (modified) - `birthRoom` opts.parent additive amendment: the `.room-root` sentinel JSON + the registry gain an optional `parent` field; byte-unchanged when parent is omitted; approvedBy gate intact.
- `scripts/check-substrate.cjs` (modified) - allow-lists `lib/core/graph-self-heal.cjs` (it requires room-db.cjs openRoomDb ONLY to open the caller-owned write handle for the NESTED_WITHIN edge; the edge WRITE routes through the navigation chokepoint; zero Brain) alongside graph-derivation.cjs.

## Decisions Made

- **The NESTED_WITHIN edge is written into BOTH the child db AND a parent-db discovery copy.** The lineage test asserts the edge in the child db (the canonical lineage edge per Part 8); the SHIPPED `rollupSubRooms` discovers children by reading NESTED_WITHIN from the PARENT db (`_directChildSlugs`). Writing both satisfies the lineage test, the depth2 down-walk, and Part 8 (the canonical edge is the child's LOCAL edge; the parent copy is the discovery index the rollup needs).
- **The registry parent joint is threaded through birthRoom using the existing `update` verb, not a new `set-parent` verb** (Part 7 reuse). `MINDRIAN_ROOMS_HOME` is pointed at `parentRoomDir` for the duration of birthRoom so `.rooms/registry.json` lands under the parent (the live nested case where each room carries its own registry); the env value is restored afterward so the heal has no global side-effect.
- **The sentinel gains a `slug` field alongside `parent` (only when parent is set)** so the rollup `_childDirForSlug` walk can match the healed sub-room by slug. The omitted (born-room) case stays byte-unchanged.
- **`timeline-runner.refreshAll` is called with `force:true` + a db handle** so each healed section's FEYNMAN.md gains its `## Timeline (auto)` sentinel-bounded section even when the watermark would otherwise skip and even when the section carries no events yet (the merge appends the header in the empty-state case).

## Deviations from Plan

None - plan executed exactly as written. Two `type="auto" tdd="true"` tasks; no auto-fixes, authentication gates, or architectural escalations. The plan's Task-2 action to register the three tests in `run-all-169.sh` was already satisfied by Plan 01 (the stubs were registered when the contracts-on-disk bus was laid), so no further edit to the aggregator was needed.

## Issues Encountered

- The depth2 down-walk initially required understanding that the SHIPPED `rollupSubRooms` (`graph-derivation.cjs`, Plan 04) reads NESTED_WITHIN from the PARENT db, not the child db. Resolved by writing the edge into BOTH dbs (the canonical child edge + a parent discovery copy), which makes the lineage test, the depth2 acceptance, and Part 8 all pass without changing the shipped rollup.

## User Setup Required

None - no external service configuration required. The heal is LOCAL fs + navigation.cjs only; zero Brain wire.

## Next Phase Readiness

- The self-heal harness ships: GDH-08 detect + GDH-09 full-citizen heal + the D-169-11 fractal joint (operational + graph-navigable) at arbitrary depth, halting at the gate, touching no Brain wire.
- Plan 05 (graph-backfill.cjs + the sweep hook) can now consume the heal-first step: `healRoom` lands the room + the joints and RETURNS, then the backfill indexes + derives into the healed db (the heal itself never indexes/derives).
- The two remaining 169 RED stubs (`test-derive-backfill-acceptance` = Plan 05, `test-169-brain-boundary` = Plan 06) are intentionally untouched (Waves 5-6).

## Known Stubs

None. `graph-self-heal.cjs` is fully wired: the detect reads real folders, the heal invokes the real birthRoom + the real timeline-runner + the real navigation.writeEdge chokepoint. No hardcoded empty values, no placeholder text, no unwired data source.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced beyond the plan's `<threat_model>`. The heal is approvedBy-gated (T-169-21 mitigated: refuses no_approval, writes nothing), writes the frozen NESTED_WITHIN type via navigation.writeEdge only (T-169-22: PART_OF / BELONGS_TO not used), uses enum/scalar-only edge properties (T-169-23: `{relation:'nested', parent:<slug>}`), invokes birthRoom + timeline-runner for full-citizen wiring (T-169-24: no bare-sentinel anti-pattern), and the opts.parent amendment is additive + default-omitted (T-169-25: the no-parent sentinel is byte-unchanged). Zero new packages (T-169-SC). The Part-8 grep sweep in run-all-169.sh PASSED; `graph-self-heal.cjs` has zero fetch/http/brain/mcp surface.

## Verification

- `node tests/test-sentinel-self-heal.cjs` GREEN (4/4): detect finds the sentinel-less child; healRoom refuses without approvedBy and writes no `.room-root`; with approvedBy writes `.room-root` + own room.db + ROOM.md/STATE.md/MINTO.md (birthRoom reuse); registers the child with parent + the sentinel carries a parent field.
- `node tests/test-room-lineage-edge.cjs` GREEN (3/3): healRoom reports the lineage edge; a NESTED_WITHIN edge `room:child-room -> room:parent-room` is present in the child room.db; the edge properties are enum/scalar only.
- `node tests/test-depth2-full-citizen.cjs` GREEN (4/4): the two nested levels heal into full-citizen rooms; MID + LEAF are full citizens (ROOM.md + room.db + per-section FEYNMAN + `## Timeline (auto)` + NESTED_WITHIN up); the leaf is visible from the top rollup DOWN (transitive depth>=2).
- `bash tests/run-all-169.sh`: Total 17, Passed 15, Failed 2 (the 2 remaining failures are `test-derive-backfill-acceptance` = Plan 05 + `test-169-brain-boundary` = Plan 06, both RED-untouched as required). The carried floors (`test-edges-room-lineage-floor`, `test-edges-part4-cascade-floor`) + the Plan-04 stubs (recursive-rollup, subroom-rollup, graph-derivation-loop, derive-idempotence, candidate-producer, room-root-resolver) stay GREEN. The Part-8 grep sweep + the em-dash sweep PASSED.
- `node -e "require('./lib/core/navigation/room-birth.cjs')"` loads; `ROOMBIRTH_PARENT_OK` (Task 1 verify).
- `SELF_HEAL_OK` (Task 2 verify): graph-self-heal.cjs loads, carries NESTED_WITHIN + refreshAll + no_approval, the tests are registered in run-all-169.sh.
- Em-dash sweep over `graph-self-heal.cjs` + `room-birth.cjs` + `check-substrate.cjs` + this SUMMARY: zero literal em-dashes.
- `graph-self-heal.cjs` is EXEMPT from the substrate violation scan (allow-listed) and carries zero fetch/http/brain/mcp surface.

## Commits

- `b13dd9ac` feat(169-07): room-birth.cjs opts.parent additive amendment (sentinel + registry)
- `0eaf0cfb` feat(169-07): graph-self-heal.cjs -- detect + full-citizen heal (GDH-08/09 + D-169-11)

## Self-Check: PASSED

- Created file exists: `lib/core/graph-self-heal.cjs` (FOUND).
- Modified files exist: `lib/core/navigation/room-birth.cjs`, `scripts/check-substrate.cjs` (FOUND).
- Commit hashes exist in git: `b13dd9ac`, `0eaf0cfb` (both FOUND).
- The three target RED stubs are GREEN; the two Wave-5/6 stubs are RED-untouched; the carried floors + Plan-04 stubs stay GREEN.
- Em-dash sweep over all created/modified files including this SUMMARY: zero literal em-dashes.

---
*Phase: 169-graph-derivation-harness*
*Completed: 2026-06-19*
