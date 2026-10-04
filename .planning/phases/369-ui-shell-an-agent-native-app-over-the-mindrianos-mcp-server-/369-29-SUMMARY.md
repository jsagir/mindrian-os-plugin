---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 29
subsystem: ui-shell
tags: [design-canon-v3, egress, contrast, e2e, d-01, d-11, canon369-07, wcag]
requires: [369-20, 369-22, 369-24, 369-25, 369-26, 369-27, 369-28]
provides:
  - tests/e2e-369/lib/canon-checks.cjs (WCAG luminance and contrast, computed-style walkers, token list, per-view counters, built-CSS colour scan)
  - tests/e2e-369/egress-and-canon.cjs (C1 to C11 over the built, launched shell; 31 screenshots for plan 30)
  - ui/shell DocumentDisplay demotes a room document's headings one level, so a view keeps exactly one H1 (found by C8)
affects: [369-30, 369-31]
requirements: [CANON369-07]
canon_parts: [8, 12]
key-files:
  created:
    - tests/e2e-369/lib/canon-checks.cjs
    - tests/e2e-369/egress-and-canon.cjs
  modified:
    - ui/shell/client/views/evidence/DocumentDisplay.tsx
    - tests/test-369-views-copy.cjs
    - lib/ui-shell/dist/ (rebuilt with the source change, same commit)
key-decisions:
  - "The e2e starts the shipped dist the way a person does (node lib/ui-shell/launch.cjs start --port N), against a hermetic flag-ON daemon the launcher finds through MINDRIAN_ROOMS_HOME's pidfile; the second sign-in for C10 is a second launcher run (the reuse path)."
  - "Page-side walkers are sent as string expressions, so nothing evaluates code inside the page and the shell's nonce CSP is never asked to allow anything (0 CSP events measured)."
  - "C9 is two legs: the shell's own built stylesheet (the one that declares the token sheet) must hold only token colours or color-mix of tokens (static, file:line:col), and every colour a rendered element actually draws with, on every screen, must be a token. The one vendor stylesheet (the document display's) holds 159 non-token literals that are never drawn; it is judged by what it draws, not by what it contains."
  - "Every walker has a negative control: a planted offender it must find and a clean twin it must not flag, run before the walk, so a PASS cannot be a walker that sees nothing."
  - "Screenshots that happen to hold the UTF-8 bytes of U+2014 or U+2013 are re-encoded as JPEG: run-all-369.sh's long-dash guard greps every file under tests/e2e-369, binaries included."
metrics:
  tasks: 2
  commits: 2
  completed: 2026-10-04
---

# Phase 369 Plan 29: Egress and Design Canon v3, measured on the shipped shell Summary

The eleven CANON369 checks run against the built shell (`lib/ui-shell/dist`, source hash f9e43808aec84a3e) across 15 screens at 1280 px and 390 px, all pass, and the run found and fixed one real defect: a room document's own `# Title` rendered as a second H1.

## What was built

- **tests/e2e-369/lib/canon-checks.cjs** (CJS, built-ins only). `TOKEN_HEXES` (11 entries: the UI-SPEC token sheet), `relativeLuminance`, `contrastRatio`, `selfTest` (the canon's own measured pairs), `walkTextContrast` and `measureTextContrast` (every text-bearing element: computed colour, ancestor background chain composited from the nearest opaque layer, ancestor opacity, large-text thresholds 24 px or 18.66 px bold), `radiusViolations` (elements plus ::before and ::after, `[data-mark="circle"]` exempt), `ochreViolations` (ochre text; ochre fill or border on a paper surface without a 1 px ink outline; SVG fill and stroke), `colourViolations` (built CSS, declarations only, with file, line and column), `computedColourViolations`, `countPerView`, `tileViolations`, `runningAnimations`, `iframeViolations`.
- **tests/e2e-369/egress-and-canon.cjs**: hermetic daemon with `MINDRIAN_TEST_MODE=1`, fixture room (question, evidence with a CONTRADICTS pair, a confirmed claim, a recorded decision, a deliverable with a real file), shell started through `launch.cjs`, one egress capture over every request, websocket and EventSource of every page of every context, then the walk. One PASS or FAIL line per check, offenders printed with selector, or file:line:col.

The walk (each at 1280 px and 390 px): rooms list, Work first visit, Work with changes (a decision waiting), Evidence with a document open, Decisions, Deliverables with a document open, Graph, Status panel, room-switch dialog, gate ready, saving (response held), recorded approve, recorded reject, stale_subject refusal, persistence failure (the `.test-fault-gate-persist` marker). A second browser session with `reducedMotion: 'reduce'` (signed in by a second launcher run) loads Work, Evidence and a gate, answers the gate, and samples animations at load, 120 ms later, and after the answer.

## Measured numbers (the recorded run, Node v22.23.1, headless Chromium, 2026-10-04)

| Check | Result |
|-------|--------|
| C1 egress | 1,095 requests (document 23, eventsource 18, fetch 354, font 105, script 572, stylesheet 23, websocket 0); host set exactly `127.0.0.1:<port>`; iframes checked on all 31 captures: none |
| C2 dist scan | 262 files, 10.0 MiB (js, css, html, map, json, fonts all read as bytes), 13 host names (the six UI-SPEC hosts plus seven analytics hosts): 0 hits |
| C3 radius | 31 captures, every element and ::before ::after: 0 violations (only `[data-mark="circle"]`) |
| C4 ochre | 31 captures: 0 violations (ochre only as the CTA triangle on ink and the yellow tile with its 1 px ink border) |
| C5 contrast | 972 text runs measured, 0 below 4.5:1 (3:1 for large text). Tightest margin: 5.78:1 against 4.5:1, the success-coloured status "Decision recorded in the room." on paper |
| C6 fonts | Bodoni Moda, DM Sans, Fraunces, JetBrains Mono all `loaded` in `document.fonts`; 105 font file requests, all from 127.0.0.1 |
| C7 tiles | every `[data-tile]` on 31 captures carries its written status in the tile, its row and its accessible name; mark is aria-hidden |
| C8 counts | 31 captures: one h1, at most one primary action, one circle, one ochre triangle (inert subtrees and, when a modal dialog is open, the page behind it are not counted), no sideways scroll at 390 px on any screen |
| C9 colours | shell stylesheet: 15 colour literals (11 tokens, 2 transparent, 2 color-mix of tokens), 0 violations; computed colours of every element on 31 captures: 0 non-token |
| C10 reduced motion | 0 running animations at load, 120 ms later, and after the gate answer; the recorded status is visible (opacity 1, laid out) with its rust completion square. Control: 1 animation runs on Work without the preference, so the check can see motion |
| C11 dashes | 248 text files in the dist: 0 of U+2014 or U+2013 |
| CSP | 0 `securitypolicyviolation` events, 0 unexpected console or page errors |
| Screenshots | 31 files in `tests/e2e-369/output/screenshots/` (15 screens at 1280 px, 15 at 390 px, plus the reduced-motion gate), git-ignored |

Contrast calibration (the library against the UI-SPEC pairs, tolerance 0.3): ink on paper 14.54 (14.5), ink-soft on paper 6.96 (7.0), ink-soft on paper-deep 5.99 (6.0), paper-light on ink 15.71 (15.7), ochre on ink 6.64 (6.6), ochre on paper 2.19 (2.2), ochre on paper-deep 1.89 (1.9), rust on paper 5.17 (5.2), cobalt on paper 6.2 (6.2), success on paper 5.78 (5.8), error on paper 6.28 (6.3). Wall time for the whole e2e: about 34 s.

## Verification

| Check | Result |
|-------|--------|
| `node tests/e2e-369/egress-and-canon.cjs` | exit 0, C1 to C11 PASS (run three times, including after the commit) |
| `node scripts/build-ui-shell.cjs --check` | fresh, source hash f9e43808aec84a3e, 103 files |
| `cd ui/shell && npx tsc --noEmit` | clean; the dist build (`next build`) clean |
| `bash tests/run-all-369.sh` | PASS=52 FAIL=2 SKIP=2. "369: egress and canon (CANON369-07)" PASSED; "UI dist fresh (TS369-08)" PASSED; canon skin, gate button e2e, replica e2e, shell server, launch surface, long-dash guard PASSED. The two FAILs and two SKIPs are named below |
| `node tests/test-369-views-copy.cjs` | 24 passed (one new scenario for the heading demotion) |
| `node tests/e2e-369/views.cjs` | 12 of 12 arms, three consecutive runs, after the one flake in the aggregator run |

## Deviations from Plan

**1. [Rule 1 - Bug] A room document added a second H1 to Evidence and Deliverables (found by C8).**
- **Found during:** Task 2, first full run: `[evidence-document @1280] 2 h1 elements` and the same for deliverable-document at both widths.
- **Issue:** the document display shows the room's markdown through BlockNote; a file that starts `# Interview notes` rendered an `<h1>` inside the page that already has its H1 ("Evidence", "Deliverables"). UI-SPEC and Canon s7: one unmistakable H1 per view. Plan 25's views e2e checked `h1s` only before a document was opened, so it never saw it.
- **Fix:** `demoteHeadings` in `ui/shell/client/views/evidence/DocumentDisplay.tsx` runs on the parsed blocks before they are shown (heading level +1, capped at 3, applied to nested children). Every heading is drawn at the same Heading size in `document-display.css`, so only the outline changes, not the look. About 14 lines in one file, not the one-line CSS or copy correction the plan names; I judged it a Rule 1 bug whose fix is small, contained and checkable, and the alternative was a plan whose acceptance cannot pass. A reviewer who disagrees can revert the single commit hunk and C8 will name the offender again.
- **Verification:** C8 passes on all 31 captures; `tsc --noEmit` clean; `test-369-views-copy` has a new scenario that pins the function, its use before `replaceBlocks` and the cap; views e2e 12 of 12.
- **Files:** `ui/shell/client/views/evidence/DocumentDisplay.tsx`, `tests/test-369-views-copy.cjs`, `lib/ui-shell/dist/` rebuilt (source hash fa36f426f00b5062 to f9e43808aec84a3e, 4 files renamed for the new build id, 27 modified, nothing deleted).
- **Commit:** 9a927ca5a

**2. [Rule 1 - Bug, in my own walker] The first C9 run flagged `color: rgb(0,0,0)` on the gate's native radio inputs.** A radio drawn with `appearance: none` keeps the browser's default text colour but paints no text. `color` is now counted only where it paints text (an element with its own text, a text-entry control, a button, or generated content); every colour the radio actually draws (border, background) is still checked. Not a shell defect.

**3. [Rule 2 - Missing critical] Latent flake in the aggregator's long-dash guard.** `run-all-369.sh` greps every file under `tests/e2e-369` for the UTF-8 bytes of U+2014 and U+2013, binaries included. A 2 MB set of compressed PNGs holds those three bytes by chance about once in four runs, so adding screenshots to that directory would have made the guard red at random. The aggregator is frozen ("no later 369 plan edits this file"), so the e2e re-encodes any screenshot that holds the sequence as JPEG until it is clean (tested with a forced hit). The cleaner fix, for whoever next owns the aggregator: exclude `tests/e2e-369/output` from that `find`.

**4. [Scope addition] Negative controls** (17 lines of output before the walk) are not in the plan; they are what makes the PASS lines mean something, and they cost 1 s.

## Known reds left alone (named, not mine)

- `release payload ceiling` (aggregator regression leg): the `sharp` install-script finding, ruled into Phase 369.1 D-16.
- `views e2e` failed once inside the aggregator run (arms 11 and 12: the room-q open timed out, then three `style-src-elem` CSP events were reported): the known load flake of arms 11-12. Three consecutive standalone runs pass 12 of 12. Not caused by the heading change (the nonce path is untouched). Worth noting for 369.1: the CSP events appear only after the arm 11 timeout, so they may be a symptom, not a second problem.
- `installed layout exact floor`: SKIPPED, no Node 22.18.0 binary or Docker (ENV GAP, as in plans 03 and 28).
- `recoverable journey`: SKIPPED, `tests/e2e-369/journey.cjs` is plan 31's.
- Not run here: test-237, test-345, test-363 M3, test-365-floor-gate, test-366 R6b, run-all-267 (3), zod4 `room_list` description (known reds named in the brief; nothing in this plan touches them).

## What the machine cannot judge (for plan 30's visual review)

The screenshots are in `tests/e2e-369/output/screenshots/` (numbered by screen, suffix 1280 or 390; a `.jpg` appears in place of a `.png` only if the PNG held the dash bytes). Composition, hierarchy and rhythm are still a human call. Two things I saw while checking the pictures: at 390 px the dialog's secondary button "Stay here" wraps to two lines, while the primary "Switch to room-q" stays on one; and the first-visit and with-changes Work screens are the ones where the asymmetric 8 plus 4 composition collapses to a single column, so they deserve the closest look.

## Limits of what was measured

- States, not interactions: hover, active and keyboard-focus styling were not walked (the focus ring is an outline, outside the ochre-fill rule by design). Copy-heavy refusals other than stale_subject (room_switched, gate_expired, session_mismatch, human_only, replayed) and the empty, error and connection-lost states are covered by plans 25 to 27 for copy and by the radius, ochre and token rules only where a screen above shows them.
- The dialog's `::backdrop` cannot be read through `getComputedStyle` here; its colour is covered by the static C9 leg (a color-mix of tokens).
- C9 does not require the vendor (document display) stylesheet's 159 literals to be tokens; it requires that nothing drawn is outside the tokens. Two screens draw a document, and both pass.
- Text over a background image or gradient would be reported as unmeasurable, never passed; there was none.
- C1 names the exact `127.0.0.1:<port>` host and the capture saw the EventSource leg (18 requests) but no websocket, because the shell opens none.

## Known Stubs

None.

## Threat Flags

None new. T-369-29-01 (outside-host requests) is covered by C1 over 1,095 requests and C2 over 262 files; T-369-29-02 (third-party iframe) by the iframe check on 31 captures; T-369-29-03 (state shown by colour alone) by C7 and C4.

## Commits

- `5e9456681` test(369-29): canon check library (WCAG contrast, radius, ochre law, colour tokens, per-view counters)
- `9a927ca5a` test(369-29): egress and canon e2e over the built shell, C1 to C11; a room document no longer adds an H1

STATE.md and ROADMAP.md were not touched (the orchestrator owns them); nothing was added to the root package.json; no version was bumped.
