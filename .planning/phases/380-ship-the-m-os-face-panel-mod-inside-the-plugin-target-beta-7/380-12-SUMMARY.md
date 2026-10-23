---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 12
subsystem: ui-mod-canon-faces
tags: [mos-face, canon, theo-face, asset, rasterizer, pins, D-10, MOD380-09]
requires: [380-07]
provides:
  - ui/mos-face/assets/asset-fa8504998f.json and asset-d96217b320.js (canon asset, byte copy)
  - ui/mos-face/hooks/theo-face.ts (loadFaceAsset, readFaceAsset, composeFace, rasterFace, FACE_ASSET_PATHS)
  - ui/mos-face/scripts/theo-faces.cjs (--write and --check for tests/face-fixture.ts)
  - tests/test-380-theo-faces.cjs (F1 to F5), ui/mos-face/tests/theo-face.test.ts (G1 to G3, G5), theo-face-pin.test.ts (G4, 44 pins)
affects: [380-13]
requirements-completed: [MOD380-09]
completed: 2026-10-23
---

# Phase 380 Plan 12: Canon faces part one - Summary

The canon Theo face asset is in the package byte for byte. The package can now draw all 11 canon states from it, equal to the canon renderer's own attributes, with palette colors only. The running panel is untouched; plan 13 does the swap.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing pushed. No branch created or switched. `git rev-list --count origin/main..main` is 27 (25 earlier plus the 2 below).

## Commits (release tree)

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 5d54ee731 | test(380-12): canon Theo face asset copied byte for byte, generator and RED tests (D-10) |
| 2 | 4e0888481 | feat(380-12): canon Theo face loader, composition and rasterizer from the asset, 44 new pins (D-10) |

## Canon and hashes (PROVEN)

- Book `/home/jsagi/mos-brand`, cited canon e947a5d. Live HEAD seen: 9f4ee34 (2 commits ahead). `git status --porcelain` count was 2 before and after (two untracked `consumers/*.json` files, not mine). Nothing was written there.
- `git diff --name-only e947a5d HEAD` per used segment: `segments/identity/theo` 0 files, `segments/foundations/color` 0, `segments/experience/terminal` 0. So the segments used by this plan are identical. One other segment differs: `segments/experience/accessibility` (1 file; an added paragraph "CSS enhancements need a base that works"). This plan does not use it.
- sha256 asset JSON `e54e7c6a3c11a039059fb47833b09e865cd3981e2910b4f13571e87c06682da2`; renderer `9ba50a842158058aabc91356eea3f12c7de0ade619c13c7b3ad1cc6b50ce0d75`. Both equal the plan values and the canon files (`cmp` exit 0).

## RED and GREEN runs (PROVEN)

- RED (before theo-face.ts existed): `claude plugin test .` printed 91 pass, 2 fail. The 2 fails were the two new files: "the file did not load: cannot import ../hooks/theo-face". The 34 originals all passed. The plan's own Task 1 verify command exited 0.
- GREEN: 107 pass, 0 fail (34 original plus 73 added; 12 new tests in theo-face.test.ts and 1 in the pin file are included). `node tests/test-380-engine-tests.cjs`: 107 pass, 0 fail. `node tests/test-380-theo-faces.cjs`: 76 passed, 0 failed. `node ui/mos-face/scripts/theo-faces.cjs --check`: exit 0. `node ui/mos-face/scripts/typecheck.cjs`: exit 0. `bash tests/run-all-380.sh`: PASSED=12 FAILED=0 SKIPPED=3 KNOWN=0 (the 3 skips are the legs of plans 08 and 09). Dash scan with `LC_ALL=C /usr/bin/grep -rlP '\xE2\x80[\x93\x94]'` over hooks, tests, scripts, assets and the node test: no hit.

## Renderer cross-check (PROVEN)

The canon renderer ran in a `vm` context with a small fake DOM (svg element, innerHTML parsing of data-part elements, dataset, setAttribute, querySelectorAll, firstElementChild, replaceChildren, matchMedia, requestAnimationFrame, performance). No piece was missing, so no BLOCKED. For each of the 11 states the generator also checks that mounting at the state and reaching it with `setState(instant)` give the same attributes. G2 compares `composeFace` with the recorded attributes of all 9 records per state (ground, plane, vertical, horizontal, bar, bar rect, one, two, frame) and passes for all 11. Mutations in a scratch copy were caught: BAR_HALF 7 to 8 (G2), plane height plus 1 (G2), frame ring always on (G4, G3), one fixture value changed (generator --check), one asset byte (F1, F2, F3, F4), one renderer byte (F1, F4), a planted pose tuple in a hook (F5).

## State names (navigator ruling)

The code and tests use the asset's own visible labels: Rest, Listening, Searching, Found, Challenge, Contradiction, Reframe, Nothing found, Your decision, Boundary, Handover. The book's states table (segment `identity/theo/states`) spells Search and Limit. Recorded for the book follow-ups: the asset label "Searching" and "Nothing found" versus the table word "Search" and "Limit". Plan 07 had printed Search and Limit in the panel; plan 13 will change them to the asset labels.

## How thin lines are handled (rule in the code comment)

Sampling is at the cell center, last part in canon order wins, no blending.
- A bar or an eye thinner than one cell is widened to one cell about its center (the 14 unit bars, the 12 unit Boundary eyes). Half open interval so an exactly one cell shape covers one cell.
- A hollow shape (Handover) with a stroke thinner than a cell is a one cell ink ring with the fill inside. At sizes 6 to 16 the shapes are 1 to 3 cells wide, so the ring often fills the shape; the Handover read comes from the moved bar and the white plane.
- The frame: true band when the stroke is a cell or thicker; a one cell ring only while a cell is under 2 times the stroke (size 15 and up).

## Deviations from Plan

**1. [Rule 1 - plan rule produced a bad face] The frame ring is not drawn at sizes 6, 8 and 12**
- Root cause (PROVEN with PNG): the plan rule "draw a stroke thinner than a cell as a one cell ink ring" makes the ring 20 of 36 cells at size 6 and 28 of 64 at size 8. Together with the widened bars the faces were nearly all ink. I opened `380-12-evidence/faces-with-frame-ring-v1.png` (rows 2 and 3 are black blobs). The same rule also left Challenge and Boundary at 7.6 percent plane at size 12, below the plan's own 8 percent test.
- Fix: the ring is drawn only while a cell is under 2 times the stroke (size 15 and up, in practice 16). The plane share at size 12 is now 13.2 to 16 percent for the plane states. Evidence: `380-12-evidence/faces-final-v2.png` (opened). Row 1 is the canon drawn from the fixture attributes, rows 2 to 5 are sizes 6, 8, 12, 16. Nothing in the tests was weakened.
- Plan 13 may choose another rule; it is one constant (`FRAME_OVERSTATE`) and the 44 pins record the choice.

**2. [Rule 3 - blocking] The engine test driver has no `fs` and no `plugin` member**
- Measured with a probe in a scratch copy: the test `$` has tool, command, config, telemetry, prompt, skill, attribution, agent, session, turn, ui, classic. So G1 and G5 cannot use a mocked `fs.read` through the engine. They drive `readFaceAsset` with a stand-in object that has `fs.read` and `plugin.root` (the two members the function uses). The real engine path (`$.fs.read` of `$.plugin.root`) stays unproven in a test until plan 13 reads the asset from a hook.

**3. [Rule 1 - plan assertion wrong] F5 would fail on `hooks/face.ts`**
- face.ts (plan 07) holds the same pose tuples, and the plan forbids editing it. F5 scans every hook file except `face.ts`, names that exemption in the test output, and plan 13 removes it with the old poses. The scan has a self-test (a planted tuple is found).

**4. [Rule 1 - plan assertion wrong] G3 "eye color at the eye center pixel"**
- An eye whose center sits on a cell edge (for example y 100 at size 8) is drawn in the cell on one side. The test looks at the 2 by 2 cells around the center. A hollow face is tested for ink instead of its fill.

**5. [Method] Pins taken with node, then confirmed by the engine**
- Node 22.23 runs `theo-face.ts` directly (type stripping), so the 44 hashes were computed with node from the same function and written once. The engine run then passed all 44, which proves the engine gives the same grids. No pin was edited after.

**6. [Plan note] The dash fence needed no edit**
- `tests/run-all-380.sh` already scans every file under `ui/mos-face` (assets, scripts, fixture included) and `tests/test-380-*.cjs`. Two legs were appended before the fence as the plan says.

**7. [Scope] Task 2 also committed `theo-face.test.ts`**
- The plan listed two files for the Task 2 commit; the test file changed for deviations 2 and 4, so it is in that commit.

## Findings for plan 13 (PROVEN, from the PNG)

- Size 6 is coarse: widened 14 unit bars are 1 cell of 6 and the faces read as blocks. All 11 are still pairwise different at 6, 8, 12 and 16 (test G3). Recommend the panel draws the face at 12 or 16, and uses 8 only where space forces it.
- Handover (hollow) does not read as outlines below size 16 in a grid this coarse; the bar position and the white plane carry it.
- `FACE_ASSET_PATHS` lists the dev path and the shipped dist path `lib/mos-face/dist/assets/asset-fa8504998f.json`. Plan 08 must copy the asset there.
- Visual verification in a real terminal is pending: the PNGs are a block grid drawn by a script, not a terminal capture. Implementation complete; visual verification pending (plan 13).

## Known Stubs

None. The new code is not yet wired into the panel on purpose (plan 13).

## Threat Flags

None. The generator runs the canon renderer in a vm with only fake DOM objects, no require, no fs, no network, 2 second timeout (T-380-48). Malformed assets give null (T-380-49, G1).

## Self-Check

Files exist: assets (2), theo-face.ts, theo-faces.cjs, face-fixture.ts, three test files, test-380-theo-faces.cjs. Commits 5d54ee731 and 4e0888481 are on `main` of the release tree. PASSED.
