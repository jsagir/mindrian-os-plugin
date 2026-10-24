---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 13
subsystem: ui-mod-canon-faces
tags: [mos-face, canon, theo-face, events, labels, visual-change, D-10, D-11, MOD380-09]
requires: [380-12]
provides:
  - ui/mos-face/hooks/face-events.ts (FACE_STATES, EVENT_STATES, UNMAPPED_STATES, stateFor, stateForLead)
  - the panel draws all 11 canon states from the asset (box, band, pane), asset labels, no loop, no crew, no HOLLOW
  - ui/mos-face/tests/face-events.test.ts (W1 to W10, 20 tests), face-sheet.test.ts (W11), meter-pin.test.ts (18 kept pins)
  - ui/mos-face/scripts/face-sheet.cjs (contact sheet PNG)
affects: [380-14, 380-15]
requirements-completed: [MOD380-09]
completed: 2026-10-23
---

# Phase 380 Plan 13: Canon faces part two - Summary

The panel now draws its Theo face from the canon asset for all 11 canon states, with the asset's own labels. Events map to states only where a real event exists; Reframe is the one state no event reaches and it is listed as unmapped. The old poses, the crew faces, the face tick loop and the tone HOLLOW are gone. The change is recorded as a deliberate visual change in the README.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing pushed. No branch created or switched. `git rev-list --count origin/main..main` is 30 (27 before, plus the 3 below). The 27 earlier commits are untouched.

## Commits (release tree)

| Task | Commit | Subject |
|------|--------|---------|
| 1 | a461f4e21 | test(380-13): RED tests for the canon faces wiring, events, labels, voice and no invented hex (D-10, D-11) |
| 2 | b2e73314f | feat(380-13): the panel draws the canon Theo faces and maps real events to the 11 states (D-10) |
| 3 | 5f5ce876c | test(380-13): older tests follow the canon faces, 102 retired face pins recorded, contact sheet script (D-10 D-11) |

## RED and GREEN runs (PROVEN)

- Baseline before any edit: `claude plugin test .` 107 pass, 0 fail.
- RED (Task 1): 107 pass, 2 fail. The 2 fails: `tests/face-events.test.ts` and `tests/face-sheet.test.ts`, both "the file did not load: cannot import ../hooks/face-events". The 34 originals of `panel.test.tsx` all passed. The plan's own Task 1 verify command exited 0.
- After Task 2: 109 pass, 2 fail. All 20 new tests (W1 to W11) passed. The 2 fails were the older files that import removed names: `tests/colors.test.tsx` ("Export named HOLLOW not found") and `tests/raster-pin.test.ts` ("Export named CREW not found"). Task 3 repairs them.
- GREEN (after Task 3 and one added test): 129 pass, 0 fail (34 original plus 95 added). `node tests/test-380-engine-tests.cjs`: 129 pass, 0 fail. `node tests/test-380-copy.cjs`: 30 passed. `node tests/test-380-decisions.cjs`: 74 passed. `node tests/test-380-theo-faces.cjs`: 78 passed (F5 now scans 15 hook files, face.ts included). `node ui/mos-face/scripts/face-commands.cjs --check`: 0 problems. `node ui/mos-face/scripts/typecheck.cjs`: exit 0. `bash tests/run-all-380.sh`: PASSED=12 FAILED=0 SKIPPED=3 KNOWN=0 (the same 3 skips as before: plans 08 and 09 legs). `panel.test.tsx` still declares 34 tests. Dash scan with `LC_ALL=C grep -rlP '\xE2\x80[\x93\x94]'` over hooks, tests, scripts, README, types and the node tests: no hit.
- Mutations in a scratch copy (`.../scratchpad/mut`), each caught by the test named: tool.empty to boundary (W2, W3); label Searching back to Search (K5, W1, W3, W11); HOLLOW exported again (W9); a challenge thought that says "wrong" (W7); an event mapped to reframe (W2); the glossary guard removed (W3 suggestions, added after the first run missed it); the face size changed by a frame tick in the band and in the pane (W4, after the first version of W4 missed it: 10 ticks leave the parity of the counter unchanged, so the test now checks 11 single ticks); the asset read dropped (W3, W4, W5 x4, W6); tool.failed to boundary (W2, W3); a fourth style added (W6); an invented hex in register.tsx (S6); POSES in face.ts code (S7); the secondary text style changed (S6); Reframe marked mapped in the README (D2).
- The first 5 to 7 fails seen in one mutation run (B1, K4, C1, E1 with 5 to 6 second durations) came from machine load (load average 10). A re-run of the same mutation failed only W2. Repeated clean runs passed with 128 and then 129 tests, no failure.

## Visual change

Recorded in `ui/mos-face/README.md` section `## Visual change (D-10)`: the date, the old model, the new model, the old-to-new state table, the pin counts, the digest, the deferred crew style and D-11.

- Old pin table digest: sha256 of the text of the object `PIN` of `tests/raster-pin.test.ts` at commit 4e0888481 (120 entries) is `c48c6cba043e5ee9e506ef2ea44abffabd826cbdd803d1b64e9e1baf23c9a5c4`. sha256 of the whole old file: `f364b71dba891900596aded70a1a347ecd62692225b97576214491ed696bc2c4`.
- Pins retired: 102 (84 state pins: 7 states, 4 ticks, 3 sizes; 18 crew pins: 6 faces, 3 sizes). Pins added in plan 380-12 and standing: 44 (`theo-face-pin.test.ts`, 11 states, sizes 6, 8, 12, 16). Pins kept: 18 (see deviation 3).

### Old to new state table

| Old id | Old label | New id | New label |
|--------|-----------|--------|-----------|
| rest | Rest | rest | Rest |
| listen | Listening | listen | Listening |
| search | Search | search | Searching |
| found | Found | found | Found |
| none | Limit | limit | Nothing found |
| refused | Boundary | boundary | Boundary |
| handover | Handover | handover | Handover |
| none | none | challenge, contradiction, decision | reached through the red, yellow and black lead square |
| none | none | reframe | drawn, no real event reaches it |

A failed call to Theo and a turn that ended on an error used to show Boundary. They now show Nothing found (the plan says an empty or failed result). A call the permission mode refused and a refusal by the model still show Boundary.

## Event table

| Event name (EVENT_STATES) | State | Where it happens |
|---------------------------|-------|------------------|
| turn.start | listen | turn.start of the main loop; also the state after a call, 1400 ms later |
| tool.call | search | a call of the main loop that is not a panel read |
| tool.ok | found | the call returned material |
| tool.empty, tool.failed | limit | the call returned an empty result or an error |
| tool.denied, turn.refusal | boundary | the permission mode denied the call; the model refused |
| turn.complete | handover | a finished answer with a blue or white lead square or none |
| turn.error | limit | the turn ended on an error |
| turn.aborted | rest | the person interrupted the turn; also the state 9000 ms after a finished turn |
| lead.red, lead.yellow, lead.black | challenge, contradiction, decision | the first glyph of the reply |

UNMAPPED_STATES: `reframe`. Reason: in the canon colors yellow stands for contradiction or reframe, and the reply marker does not say which. The persona marker names the yellow square contradiction, so it maps to Contradiction. The plugin has no reframe marker. Test W2 checks that mapped plus unmapped equals the 11 ids, that nothing is both, and that every id is in the asset.

## Suggestion commands chosen (recommend, STATE_COMMANDS)

All commands exist in the registry and in WHY (`face-commands.cjs --check` and test W10).

| State | Command | Source |
|-------|---------|--------|
| challenge | /mos:challenge-assumptions | plan text |
| contradiction | /mos:memory-cortex-reach | the one registry teaching line that names a contradiction as its trigger ("a fresh contradiction has just landed against a claim"). Its registry `surface` is `internal`. See RISKS. Alternatives: /mos:reanalyze (its body reports contradictions), /mos:challenge-assumptions (commands/scout.md uses it to "address contradictions found") |
| reframe | /mos:beautiful-question | plan text |
| decision | /mos:status | plan text |
| search | /mos:research | added: W10 needs a command for each of the 11 states, and the old list for search was empty |
| rest, listen, found, limit, boundary, handover | unchanged | the old lists, renamed from none and refused |

## Edits to adopted tests and gates (all listed)

- `panel.test.tsx` (the 34 originals): NO edit. The only label-like assertion, `not.toBeUndefined /^Search/` at the test "the panel reads quietly", still holds because Searching starts with Search.
- `tests/colors.test.tsx` (plan 07): imports (HOLLOW, POSES, rasterState removed; the asset loader and the fixture added); `CANON_ID` removed and POSES built from the asset text of the fixture; K1 (HOLLOW gone, seven tokens only); K4 loops 3 styles instead of 4; K5 first test (LABEL equals the asset labels) and K5 second test (11 of 11 drawn; the conflict Search / Limit against Searching / Nothing found pinned); K6 (colors from the asset poses, no HOLLOW); K7 geometry (poses read from the asset text equal `tests/canon.ts`); K7 colors (11 planes, ink only for Your decision); K9 (drawn by `rasterFace`; the ground line row is `ceil(y / px) - 1` because of the half open sampling of plan 380-12, deviation 4). K2 and K3 unchanged.
- `tests/copy.test.tsx` (plan 06): sweep covers 3 styles; `StateName` is the 10 reachable ids; C1 titles `none` and `refused` renamed `limit` and `boundary`; three C1 tests added (challenge, contradiction, decision, reached through the lead square); every sweep gets the asset through `files`; C2 runs mos-style 3 times; C4 asserts 11 keys in THOUGHTS, LABEL and LINE_FACE. No scan rule changed.
- `tests/test-380-copy.cjs` (plan 06): legs S6 (every color literal of the hooks is a canon token; secondary text is dimmed paper) and S7 (no POSES, CREW, rasterState, rasterCrew or HOLLOW outside a comment; no crew in register.tsx) added. S1 to S5 unchanged.
- `tests/test-380-decisions.cjs` (plan 07): K1s (seven tokens, no HOLLOW); D2 (11 states, columns Drawn label, State id, Mapping, Event or reason, Book spelling; only Reframe unmapped); D6 (HOLLOW removed by D-10); D7 one added check (the fallback); D8 added (the Visual change section).
- `tests/test-380-theo-faces.cjs` (plan 12): the F5 exemption `LEGACY_EXEMPT` for `hooks/face.ts` removed.
- `tests/raster-pin.test.ts` (plan 02 and 07): deleted. `tests/meter-pin.test.ts`: new; its 18 pins and its test R3 are the original lines, value for value (diff of the pin lines is empty).
- `tests/budget.test.ts` (plan 05): NO edit. B8 still holds (see deviation 2). `README` budget table cell for Timers edited.
- `hooks/theo-face.ts` (plan 12): one comment line only (the old drawings are gone from face.ts). No code changed. The 44 pins did not move.
- `scripts/face-commands.cjs`: one string (`import type { FaceState }` to `import type { FaceId }`) so that `--write` still finds the import line of commands.ts. `--write` is a no-op on the current file (diff empty).

## Deviations from Plan

**1. [Rule 3 - blocking] `FaceState` stays the 7 old ids; the 11 ids are `FaceId`**
- Root cause (PROVEN): the plan says FaceState becomes the union of 11 ids, and also says the vendored `hooks/glossary.ts` must not be edited. glossary.ts is typed `Record<FaceState, Word[]>` with the 7 old keys (rest, listen, search, found, none, refused, handover). With an 11 member FaceState it fails the type check (missing keys and extra keys).
- Fix: `types/index.d.ts` exports `FaceId` (the 11 asset ids) and keeps `FaceState` as the 7 old ids, with a comment that says why. `voice.ts glossaryWords(id)` maps limit to the lines kept under none and boundary to the lines kept under refused, and returns an empty list for any other id. glossary.ts is byte for byte unchanged. A regenerated glossary file from the owner still compiles.
- Cost: the name FaceState is now a legacy name. The navigator may prefer to rename the type inside glossary.ts (one import line) when the owner next regenerates it.

**2. [Rule 1 - plan fact wrong] The 220 ms timer had no spinner of the Theo calls pane to keep**
- Root cause (PROVEN): the plan says keep "the 220 ms spinner of the Theo calls pane". In the adopted file the 220 ms timer only wrote the `frame` counter, and the only readers of that counter drew the running mark on the face and the section flash. The constant SPIN was declared and used nowhere. Removing the face tick would have left the timer with no reader, and B8 (plan 05) pins the timer.
- Fix: the timer is kept as plan 05 built it. The Theo calls pane now shows a spinner character in the status column of a call that is running (`running-`, `running\`` and so on; the column keeps its width of 8). The face has no timer. Test W4 proves that the frame counter ticks while the face grid stays identical at 11 single ticks, in the band and in the pane.

**3. [Rule 1 - plan count wrong] 18 of the 120 pins described the context canvas, not a face**
- Root cause (PROVEN with a count of the keys of `PIN`): 84 `state:` pins, 18 `crew:` pins and 18 `meter:` pins. The plan retires all 120 and deletes the file. The 18 meter pins describe `hooks/meter.ts`, which D-10 did not change, and no other test pins that canvas.
- Fix: the 102 face pins are retired; the 18 canvas pins moved unchanged to `tests/meter-pin.test.ts`. `tests/raster-pin.test.ts` is gone, as the verify asks. The README and this summary say 102 retired, 44 added, 18 kept.

**4. [Rule 1 - test assumption] K9 ground line row**
- Root cause: K9 asked for the ink row `floor(y / px)`. `rasterFace` samples the cell center on a half open interval (plan 380-12), so a line centered on the edge between two cells (y = 225 at 16 cells) belongs to the cell above. The line is one ink row at the canon height, half a cell apart from the old rule.
- Fix: K9 uses `ceil(y / px) - 1`. On the sheet the ground line sits at the same height as in the SVG (0.5 to 0.58 of the face height against 0.5625).

**5. [Plan fact wrong] The old crew had 6 faces, not 10**
- `CREW` held 6 entries (challenge, perspectives, connections, structure, intent, experiment). The README says six.

**6. [Method] The type check was red between the Task 2 and the Task 3 commit**
- `colors.test.tsx` and `raster-pin.test.ts` import removed names and sit in the tsconfig include. The Task 2 verify needed exit 0 or 77. The plan says to leave those two files for Task 3, so the Task 2 type check had exactly those errors and none else. After Task 3 it is exit 0.

**7. [Rule 3] The contact sheet draws the bottom row as square pixels, not with `toHtml`**
- Root cause (PROVEN with `380-13-evidence/faces-sheet-v1-font-seams.png`, opened): `toHtml` draws the half block with a font glyph, and at the harness font that glyph leaves a dark seam between rows, which made the faces hard to compare.
- Fix: `face-sheet.cjs` reads the ANSI text with `parseAnsi` and `colorToRgb` of the same pipeline and draws two square pixels per cell (the top half takes the foreground, the bottom half the background). The colors are the same; the seam is gone. `toHtml` is not used.

**8. [Plan fact] `$.plugin.root` works in an engine test**
- Plan 12 recorded that the test driver `$` has no `plugin` or `fs`. A hook receives the engine's own `$`, which has both. The real `$.fs.read` path is now covered: W5 reads the asset through the world's `fs.read` handler (dev path first; dist path second; both denied; damaged text).

**9. [Plan wording] Face sizes**
- Pane: 12 on a wide panel (50 columns or more, rows 24 or more), 8 on a standard panel (40 to 49 columns, or a short panel), 6 in the mini style, none below 40 columns, in plain mode and in the line style. Box above the prompt: 12 in the tile style, 6 in mini, none in line. The old box drew a fixed 6. This makes the box 6 text rows tall where it was 3. See RISKS.
- The `line` style used to draw the tile and add a line face. It now draws words only.

## Sheet image (PROVEN: I opened both PNGs)

Files: `380-13-evidence/faces-sheet-final.png` (sha256 `6cf09772781c024f504464f8f4be2a9ebf27ce85fdcf85d68af6415ba3067ccd`) and `faces-sheet-v1-font-seams.png`. Top row: the canon renderer's SVG for each state. Bottom row: the panel's 12 by 12 block face from `rasterFace`. Rendered in a browser page by the Playwright CLI. This is not a terminal capture.

What I see, state by state:
- Plane color: matches in all 11 (Rest, Listening, Nothing found and Handover white; Searching and Found blue; Challenge and Boundary red; Contradiction and Reframe yellow; Your decision ink).
- Bar tilt: matches. Rest and Listening and Handover lean right, Searching leans right more; Challenge and Reframe lean left; Found, Contradiction, Your decision and Boundary stand upright; Nothing found lies flat. At 12 cells a tilted bar is a staircase of 2 to 4 steps.
- Eye size: matches in kind. Listening has the larger eyes; Searching has the paper eye in the blue plane and the ink eye below; Nothing found has the two grey eyes (soft ink); Your decision has the paper eye in the ink plane.
- Ground line: same height as in the SVG.
- Defects, all from the coarse grid and not from the data:
  1. Handover (hollow) reads as solid ink. The SVG shows an outlined white bar and two outlined white squares; at 12 cells the outline is wider than the shape and the bar and eyes fill with ink. Handover and Rest then differ mainly by the bar position and the eye shapes. The label sits beside the face (threat T-380-51). Not fixed: a fix would change the rasterizer rules and 4 pins of plan 380-12, and the only palette option I see (soft ink for a ring that is too thin) needs a design ruling.
  2. Reframe: the two adjacent eyes (gap 12 units) merge into one wide black bar.
  3. Boundary and Challenge: the flat eyes (12 and 14 units high) are widened to one cell, so they look like small squares, not dashes.
  4. No frame ring at 12 cells (plan 380-12 deviation 1, a constant).
- Implementation complete; visual verification in a real terminal is pending (plan 380-10 or a capture with the harness of plan 380-03). The sheet is a browser page, not a terminal.

## Book conflict recorded for the follow-ups

The book states table (`segments/identity/theo/states`, mos-brand book e947a5d) spells two states Search and Limit. The asset's visible labels, which the panel now draws by navigator ruling, spell them Searching and Nothing found. D-10 also says "Limit" becomes "Nothing found". Recorded in the README (N9) and pinned by test K5 (the pair `Search / Searching` and `Limit / Nothing found`). The proposed terminal segment uses a third set of older words. The book needs one spelling. Nothing was written into /home/jsagi/mos-brand (`git -C /home/jsagi/mos-brand status` shows the same 2 untracked consumer files as before; HEAD 9f4ee34, cited canon e947a5d).

## Known Stubs

None. The words-only line face with its one sentence is intentional (D-10, test W5).

## Threat Flags

None new. The one new read is the asset file through `$.fs.read` of two fixed relative paths under `$.plugin.root`, checked by `loadFaceAsset` (T-380-49). The reply marker only reads the first glyph (T-380-51, W3, W7). T-380-52: W1 and W2. T-380-53: W5. T-380-54: S6, S7, F5, W9. No network, no subprocess, no change to what leaves the machine.

## Self-Check

Commits a461f4e21, b2e73314f and 5f5ce876c are on `main` of the release tree and are ancestors of HEAD. Files exist: `hooks/face-events.ts`, `tests/face-events.test.ts`, `tests/face-sheet.test.ts`, `tests/meter-pin.test.ts`, `scripts/face-sheet.cjs`. `tests/raster-pin.test.ts` is deleted (the only deletion in the 3 commits). PASSED.
