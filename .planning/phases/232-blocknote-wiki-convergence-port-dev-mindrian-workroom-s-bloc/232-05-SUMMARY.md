---
phase: 232-blocknote-wiki-convergence-port-dev-mindrian-workroom-s-bloc
plan: 05
subsystem: ui
tags: [blocknote, wikilink, pdfmake, docx, esbuild, react, wiki, editor]

# Dependency graph
requires:
  - phase: 232-03
    provides: "editor-src esbuild build island, index.jsx mount + identity transform seams, mos-blocknote-theme.css token contract"
  - phase: 232-04
    provides: "server-side /api/raw, /api/save, /api/pages, BlockNote editor mount route (consumed, not touched)"
provides:
  - "Pure load/save block-tree transforms (textRunsToWikilinks / wikilinksToTextRuns) bridging [[target]] text and wikilink inline nodes (D-09)"
  - "createReactInlineContentSpec wikilink pill rendered inside the editing surface, resolving via /api/pages (D-08, SPEC Req 6)"
  - "Client-side PDF (pdfmake) and DOCX (docx) exporters over BlockNote block JSON (SPEC Req 3)"
  - "Rebuilt vendored editor-dist bundle with the full feature set"
  - "Hermetic round-trip transform test suite"
affects: [232-06, static-export-share-surface]

# Tech tracking
tech-stack:
  added: [pdfmake, docx]
  patterns:
    - "Pure dependency-free CJS transform module testable by plain node AND bundleable by esbuild"
    - "Client mirror of a server-side resolver (buildPageIndex/postProcessPageName) via a module-level cached /api/pages promise"
    - "Fail-open transform posture: only positively-recognized shapes are rewritten; everything else round-trips as literal text (D-07/D-09)"

key-files:
  created:
    - lib/wiki/editor-src/src/wikilink-transforms.cjs
    - lib/wiki/editor-src/src/wikilink-spec.jsx
    - lib/wiki/editor-src/src/exporters.js
    - tests/test-232-transforms.cjs
  modified:
    - lib/wiki/editor-src/src/index.jsx
    - lib/wiki/editor-src/src/mos-blocknote-theme.css
    - lib/wiki/editor-dist/wiki-editor.js
    - lib/wiki/editor-dist/wiki-editor.css

key-decisions:
  - "Wikilink resolution mirrors page-renderer.cjs exactly (lowercase + whitespace-to-hyphen, id/title/basename index, /wiki/ fallback) so the pill and the read-view resolve identically"
  - "Exporters receive wikilinksToTextRuns(editor.document) so PDF/DOCX match on-disk markdown; a stray wikilink node is still handled defensively"
  - "codeBlock exported with pdfmake's default (Roboto) font rather than a mono face, because the vendored vfs_fonts ships only Roboto and a missing font would throw at export time"

patterns-established:
  - "Transform seams from Plan 03 replaced in place: load applies textRunsToWikilinks before replaceBlocks, save applies wikilinksToTextRuns before blocksToMarkdownLossy"
  - "Custom inline content wired via BlockNoteSchema.create({ inlineContentSpecs: { ...defaultInlineContentSpecs, wikilink } }) passed to useCreateBlockNote"

requirements-completed: [SPEC Req 3, SPEC Req 6]

# Metrics
duration: ~35min
completed: 2026-07-20
---

# Phase 232 Plan 05: Wikilink Pill + PDF/DOCX Export Summary

**BlockNote editor now renders [[wikilink]] as clickable blue pills that resolve via /api/pages and save back to literal [[target]] markdown, plus MIT pdfmake/docx exporters produce PDF and Word files from current editor content.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-20
- **Tasks:** 2 (Task 1 via TDD: RED + GREEN)
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments
- Pure, dependency-free load/save transforms (D-09) proven by 6 hermetic round-trip tests including nested trees and fail-open on malformed/unrecognized shapes.
- Wikilink inline pill (D-08, SPEC Req 6): rendered inside the editing surface, styled per UI-SPEC item 5 (blue text, faint blue tint, blue bottom-border, zero radius, hover underline), navigating via the exact page-renderer resolution semantics.
- Client-side PDF and DOCX export (SPEC Req 3) from the current (possibly unsaved) editor content, using the Plan-03-approved MIT pdfmake + docx packages (not the AGPL @blocknote/xl-* exporters), with the UI-SPEC export-failed red bar on failure.
- Vendored editor-dist bundle rebuilt (wiki-editor.js 1.75mb -> 4.4mb with pdfmake/docx/fonts) and recommitted.

## Task Commits

1. **Task 1 (RED): failing round-trip tests** - `eb825009` (test)
2. **Task 1 (GREEN): pure wikilink block-tree transforms** - `587820c7` (feat)
3. **Task 2: wikilink pill + exporters + bundle rebuild** - `cc02af21` (feat)

_Task 1 followed the TDD cycle (test -> feat)._

## Files Created/Modified
- `lib/wiki/editor-src/src/wikilink-transforms.cjs` - textRunsToWikilinks / wikilinksToTextRuns; 0 require() calls; never mutates input
- `lib/wiki/editor-src/src/wikilink-spec.jsx` - createReactInlineContentSpec wikilink pill + cached /api/pages resolver mirroring buildPageIndex/postProcessPageName
- `lib/wiki/editor-src/src/exporters.js` - exportPdf (pdfmake) + exportDocx (docx) walking BlockNote block JSON
- `lib/wiki/editor-src/src/index.jsx` - schema wiring, real load/save transforms, Export PDF/Word buttons, export-error red bar, title derivation
- `lib/wiki/editor-src/src/mos-blocknote-theme.css` - .mos-wikilink pill + .mos-export-btn rules
- `lib/wiki/editor-dist/wiki-editor.{js,css}` - rebuilt vendored bundle
- `tests/test-232-transforms.cjs` - 6 hermetic transform tests (glob-discovered by run-all-232.sh)

## Decisions Made
- Pill resolution copies page-renderer.cjs semantics verbatim so in-editor and read-view links land identically; navigation only builds same-origin /wiki/ paths (threat register T-232-05-01/02).
- Exporters flatten wikilink pills to literal [[target]] before serialization so exported documents match disk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a self-authored RED test input**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Test 6's input string `"[[unclosed and ]]stray brackets"` accidentally formed a *valid* `[[unclosed and ]]` wikilink, so the module (correctly) split it, failing an assertion that expected an untouched node. The module behavior was right; the test input was wrong.
- **Fix:** Replaced with three genuinely-unbalanced fragments (`[[` with no close, `]]` with no open, lone single brackets) that the regex `/\[\[([^\[\]]+)\]\]/` truly never matches.
- **Files modified:** tests/test-232-transforms.cjs
- **Verification:** 6/6 transform tests pass; full run-all-232.sh PASS=4 FAIL=0
- **Committed in:** `587820c7` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 test-construction bug). No production-code deviation.
**Impact on plan:** None on scope. The regex spec in the plan was honored exactly.

## Issues Encountered
- **codeBlock export font:** pdfmake's vendored `vfs_fonts` ships only Roboto, so requesting a mono face (e.g. Courier) at export time would throw. codeBlock content is exported with the default font (distinct margins/size preserved) rather than mono. Minor visual-fidelity compromise; keeps export robust. DOCX code uses "Courier New" (a Word system font, safe there).

## User Setup Required
None - no external service configuration required. pdfmake and docx entered the tree at the Plan 03 legitimacy checkpoint with the lockfile committed; no new installs this plan.

## Threat Flags
None - no new security surface beyond the plan's threat_model. The pill navigates same-origin only; export is fully client-side.

## Next Phase Readiness
- Plan 06 (static export / read-only share surface) is unblocked; the editor bundle no-ops on pages without `#mos-editor-root`, so static exports are unaffected.
- The read-only path (lib/wiki/page-renderer.cjs) is byte-unchanged, verified via `git diff --exit-code`.

## Self-Check: PASSED

All created files verified present on disk; all three task commits (`eb825009`, `587820c7`, `cc02af21`) verified in git history. Full phase suite `bash tests/run-all-232.sh` = PASS=4 FAIL=0. Read-only path `lib/wiki/page-renderer.cjs` byte-unchanged (`git diff --exit-code`).

---
*Phase: 232-blocknote-wiki-convergence-port-dev-mindrian-workroom-s-bloc*
*Completed: 2026-07-20*
