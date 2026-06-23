---
phase: 173-publish-jtbd-need-selector
plan: 01
subsystem: publish-visualize
tags: [jtbd, need-selector, data-contract, cirs, persona-adaptive, part-7, part-8, part-10]
requires:
  - data/command-registry.json (Phase 122 -- resolves_to reality check)
  - lib/core/reverse-salient-persona-suffix.cjs (the dominant-role control flow precedent)
provides:
  - data/publish-needs.json (the JTBD need->command map; lanes + jobs single source of truth)
  - scripts/check-publish-needs.cjs (the --check validator; R2/R7 enforcement)
  - lib/core/publish-needs-default-lane.cjs (defaultLaneForRoleBlend + LANES + DEFAULT_LANE; R6)
affects:
  - 173-02 (the /mos:show selector reads publish-needs.json + defaultLaneForRoleBlend)
  - 173-03 (the show/share trigger sensor reads the same map)
tech-stack:
  added: []
  patterns:
    - "data-driven map in data/*.json (mirrors help-groups.json + dispatch-framework-map.json)"
    - "read-only LOCAL validator with build-connector-registry.cjs --check exit discipline"
    - "dominant-role-from-role_blend read mirrored verbatim from reverse-salient-persona-suffix"
key-files:
  created:
    - data/publish-needs.json
    - scripts/check-publish-needs.cjs
    - lib/core/publish-needs-default-lane.cjs
    - tests/test-publish-needs-map.cjs
  modified: []
decisions:
  - "Omitted /mos:export as a job row: format-conversion only, fails the R7 connections|gaps moat bar"
  - "make-land lane routes to the MOSDeckEngine skill handle (D-01), not a /mos:deck (deferred to Phase 175)"
  - "give-me-a-link routes to the unchanged /mos:publish (D-02); no repoint"
metrics:
  duration: ~20m
  completed: 2026-06-23
  tasks: 2
  files: 4
---

# Phase 173 Plan 01: Publish JTBD Need-Selector Data Contracts Summary

The two NET-NEW data contracts every later 173 plan consumes now ship: a declarative
`data/publish-needs.json` JTBD need->command map (R2) with the "show the unseen"
admission tag (R7), its `--check` validator, and the `defaultLaneForRoleBlend`
persona->lane mapper (R6). This is the interface-first wave - the /mos:show selector
(173-02) and the show/share trigger sensor (173-03) both read these artifacts, so they
land first.

## What shipped

### Task 1 - data/publish-needs.json (R2 + R7)

A flat data-map mirroring `data/dispatch-framework-map.json` (the `version` + `_note`
convention) and `data/help-groups.json` (the lane idiom). Top-level `version`, `_note`,
a `_lanes` labels block keyed by the 4 frozen JTBD lane ids, and a `jobs` array.

The 4 lanes, in user-voice JTBD: `know-stand` ("Know where I stand"),
`find-broken` ("Find what's broken"), `make-land` ("Make it land"),
`get-into-world` ("Get it into the world").

8 job rows, each `{ job, jtbd_line, resolves_to, lane, persona_weight, shows }`:

| job (user-voice) | resolves_to | lane | shows |
|------------------|-------------|------|-------|
| show me how my pieces connect | /mos:graph | know-stand | connections |
| give me the one-screen state of my room | /mos:dashboard | know-stand | connections |
| let me read my venture as one connected story | /mos:wiki | know-stand | connections |
| show me where I'm weakest | /mos:radar | find-broken | gaps |
| make this simple enough for an outsider | MOSDeckEngine | make-land | gaps |
| walk me through this for a meeting | /mos:present | make-land | gaps |
| give me a link I can send | /mos:publish | get-into-world | connections |
| give me a frozen copy to hand off | /mos:snapshot | get-into-world | connections |

The locked navigator example rows are all present (graph/radar/MOSDeckEngine/publish).
Every job label is solution-agnostic user-voice; zero label contains a `/mos:` token or
a bare command name (Part 10 commands-are-internals). Every row's `shows` is exactly
`connections` or `gaps` (the R7 admission bar enforced IN the data).

### Task 2 - the --check validator (R2/R7) + the role_blend->lane mapper (R6)

`scripts/check-publish-needs.cjs` - a read-only LOCAL validator over the map. Mirrors the
`build-connector-registry.cjs --check` exit discipline: exit 0 clean, exit 1 with a
one-line stderr reason + a recovery hint on the first violation. It enforces (1) every
`/mos:` resolves_to is a real command in `data/command-registry.json` and every skill
handle resolves to a `skills/<handle>/` directory (R2); (2) every job carries a `shows`
of exactly `connections` or `gaps` (R7); (3) no job label leaks a `/mos:` token and every
`lane` is one of the 4 frozen ids (Part 10). Zero Brain, zero network (Part 8).

`lib/core/publish-needs-default-lane.cjs` - exports `defaultLaneForRoleBlend(roleBlend)`,
`LANES` (the frozen 4-id list), and `DEFAULT_LANE` ('know-stand'). Mapping per R6:
founder-dominant -> 'get-into-world', researcher-dominant -> 'find-broken',
investor-dominant -> 'find-broken', any other / cold-start / empty / all-zero / null ->
DEFAULT_LANE. Dominant-role selection mirrors `reverse-salient-persona-suffix.suffixFor`
verbatim (canonical-key filter, positive-weight strict-greater walk over sorted keys,
default on no winner). Never throws.

`tests/test-publish-needs-map.cjs` - 11 assertions: the committed map passes `--check`
(exit 0); a tmp-dir mutated fixture with a fake resolves_to fails (exit 1); a mutated
fixture with a missing shows fails (exit 1); the four R6 lane cases (founder ->
get-into-world, researcher -> find-broken, empty -> know-stand, null -> know-stand) plus
investor -> find-broken, all-zero -> default, and the LANES/DEFAULT_LANE shape fences.

## Verification

- `node scripts/check-publish-needs.cjs` exits 0 on the committed map.
- `node tests/test-publish-needs-map.cjs` -> 11 assertions passed (exit 0).
- All 4 lane ids represented across the jobs; `_lanes` carries all 4 labels.
- Every resolves_to resolves to a real command (7) or a real skill (MOSDeckEngine).
- No em-dashes in any new file; all new files are CJS / JSON (no TypeScript, no build step).

## Deviations from Plan

None - plan executed exactly as written. The only judgment call inside the plan's own
R7 admission bar: `/mos:export` was evaluated as a candidate job row and OMITTED because
it is format-conversion only and does not surface connections or gaps (the plan's
behavior block explicitly directs omitting decoration-only candidates rather than
slotting them). dashboard/wiki/present/snapshot WERE admitted because each genuinely
surfaces connections (one-screen room state, cross-linked story, walkable narrative,
frozen connected handoff) or gaps (the present narrative exposes argument holes).

## Authentication Gates

None.

## Known Stubs

None. The map is fully populated with real resolves_to targets; no placeholder rows, no
empty-data flows. The persona_weight enum keys are generic role handles (Part 8-clean),
not stubbed user data.

## Self-Check: PASSED

Files (all FOUND):
- data/publish-needs.json
- scripts/check-publish-needs.cjs
- lib/core/publish-needs-default-lane.cjs
- tests/test-publish-needs-map.cjs

Commits (verified in git log):
- bc7f2159: feat(173-01): author data/publish-needs.json JTBD need-command map (R2/R7)
- 5cbf3f6f: feat(173-01): publish-needs --check validator + role_blend->lane mapper (R2/R7/R6)
