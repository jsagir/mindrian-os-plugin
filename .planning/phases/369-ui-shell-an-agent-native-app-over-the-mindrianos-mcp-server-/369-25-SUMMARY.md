---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 25
subsystem: ui-shell
tags: [views, hooked, first-screen, blocknote, d-08, d-09, d-10, d-11, d-12, d-13, shell369-06, shell369-07]
requires: [369-13, 369-22, 369-23, 369-20, 369-21, 369-24]
provides:
  - tileFor, the five-square state mapping with written statuses and precedence (pure erasable TypeScript)
  - Work (the D-09 opening screen), Evidence, Decisions, Deliverables and the text-only Graph tab, registered in client/routes.ts
  - DocumentDisplay, the read-only BlockNote 0.51.4 document display, CSP-clean under the nonce policy
  - projection version 2 (nodes carry confirmed_by and confirmed_at) and a last-visit marker that keeps its day
affects: [369-27 gate view (route /gate/<gate_id> is linked from Work and Decisions), 369-28 and later egress-and-canon leg]
key-files:
  created:
    - ui/shell/client/views/tile-model.ts
    - ui/shell/client/views/format.ts
    - ui/shell/client/views/hooks.ts
    - ui/shell/client/views/ItemRow.tsx
    - ui/shell/client/views/LinkedTo.tsx
    - ui/shell/client/views/HomeRoute.tsx
    - ui/shell/client/views/guarded.tsx
    - ui/shell/client/views/views.css
    - ui/shell/client/views/work/WorkView.tsx
    - ui/shell/client/views/work/SinceLastVisit.tsx
    - ui/shell/client/views/work/NextDecisionPanel.tsx
    - ui/shell/client/views/evidence/EvidenceView.tsx
    - ui/shell/client/views/evidence/EvidenceList.tsx
    - ui/shell/client/views/evidence/EvidenceReader.tsx
    - ui/shell/client/views/evidence/DocumentDisplay.tsx
    - ui/shell/client/views/evidence/LazyDocument.tsx
    - ui/shell/client/views/evidence/document-display.css
    - ui/shell/client/views/decisions/DecisionsView.tsx
    - ui/shell/client/views/deliverables/DeliverablesView.tsx
    - ui/shell/client/views/graph/GraphView.tsx
    - tests/test-369-views-copy.cjs
    - tests/e2e-369/views.cjs
  modified:
    - ui/shell/client/routes.ts
    - ui/shell/client/copy.ts
    - ui/shell/client/replica/ReplicaProvider.tsx
    - ui/shell/app/layout.tsx
    - ui/shared/src/projection.ts
    - ui/shared/src/replica.ts
    - tests/test-369-shared-core.cjs
    - tests/e2e-369/replica.cjs
key-decisions:
  - "The root route is Work once a room is open and the room picker when none is; /?rooms keeps the picker reachable on a loaded page (a room opened from it brings the person to Work)"
  - "The room's question is read out of the question card text the room document carries (questionOf), and roomDoc says whether the room has one; an empty-state H1 shows only when the room says it has none"
  - "DocumentDisplay uses BlockNote's raw view (no bundled component library) so no Mantine style element exists; the editor core's one style element takes the page nonce; the policy is not loosened"
  - "Projection version 2 adds confirmed_by and confirmed_at to nodes so a settled claim is attributed from the room's own field, never inferred from its status"
  - "The last-visit marker moves up to the change the copy is current through while Work is open (the list holds the marker it read at the start); a write at page unload does not reliably finish"
  - "Deliverables lists the whole artifacts collection: the projection has no field that says which documents are deliverables"
requirements-completed: [SHELL369-06, SHELL369-07]
duration: about 2 h
completed: 2026-10-04
---

# Phase 369 Plan 25: The review views Summary

The shell now has the surface a person reviews a room on: a Hooked opening screen that answers the room's question, what changed since the last visit (or honestly what the room holds now) and the next decision; Evidence with provenance and a read-only document display; Decisions grouped Waiting for you, Proposed and Settled with human attribution in words; Deliverables; and a text-only Graph tab. Every row carries one of the five Larry squares together with its written status.

## What was built

- `tile-model.ts`: `tileFor(item, ctx)` returns `{ tile, status, primary, extra }` for every row of the UI-SPEC table. Precedence is black over yellow over red over blue over white; the other applicable states are written after the primary in written order, so the UI-SPEC example reads exactly "WAITING FOR YOU . CONFIRMED . CONTRADICTION". A status word the table does not know is written as it is on the white tile, never reinterpreted. `contradictionPartners` finds both ends of a CONTRADICTS edge.
- Work (D-09): the room's question is the one H1 under the cobalt "Current question" circle; `SinceLastVisit` reads the last-visit marker from the copy once when it opens and lists items whose revision is above it, newest first, five rows then "Show all {n} changes", with the legend. First visit or a lost marker shows "What the room holds now" (counts by type plus open decisions) and never a history; no change shows "Nothing changed since your last visit on {date}." `NextDecisionPanel` (paper-deep, 2 px ink frame) names the next waiting decision with its why and evidence count and carries the view's one primary action and one ochre triangle, or says "No decision is waiting for you." and offers the evidence. Phones stack question, panel, then Since you were here.
- Evidence (D-10, D-13): list in columns 1-5 and reader in 6-12 (phone: the reader replaces the list with "Back to evidence"); rows show tile, status, title, provenance, and the yellow tile with "Contradicts {title}" linking to the other item; the reader shows the provenance block, the document, and "Linked to".
- `DocumentDisplay` (D-13): BlockNote 0.51.4 read only (`editable={false}`, no side menu, formatting toolbar, slash menu, link toolbar, file panel, table handles, emoji picker or comments), markdown from the `readArtifact` action (the `room_artifact` tool), front matter dropped, themed by `document-display.css` (paper, ink, DM Sans, Fraunces headings at 24 px, radius 0, no shadow). Failure shows the UI-SPEC What / Why / Fix with `/mos:open {name}`; a shortened document says so. It loads lazily when a document is opened.
- Decisions (D-08): three H2 groups in order; a waiting row links to `/gate/<gate_id>`; settled rows read "Confirmed by you, 4 Oct 2026" from `confirmed_by` and `confirmed_at`; the recorded decision nodes are settled rows too.
- Deliverables (D-08, D-13): ruled list with the white "DELIVERED" tile, opens in `DocumentDisplay`, no export, publish or download control.
- Graph (D-12): relations of the selected item as a ruled list (type in mono, other item, its status) with the typed-links caption; without a selection a list of items that have typed links; no canvas.
- Plumbing: `HomeRoute` and `guarded.tsx` (a view with no room open shows the picker), `hooks.ts` (focus the H1 on every view, selected item in the address, open gates), `ItemRow`, `LinkedTo`, `format.ts` (day and relative time, attribution, room question reader, readable document path), `views.css`, `copy.ts` strings.
- Shared package: PROJECTION_VERSION 2 with `confirmed_by` and `confirmed_at` on nodes; `setLastVisit` also stores the time and `getLastVisitAt` reads it (exposed on the replica context). The edited files were copied into `ui/shell/node_modules/mos-ui-shared/src/` by hand before building.

## Tasks and commits

| Task | Commit | Content |
|------|--------|---------|
| 1 | c8ae20692 | tile mapping, formatters, hooks, row, Work (WorkView, SinceLastVisit, NextDecisionPanel), HomeRoute, copy, views.css, projection v2 and last-visit day, replica.cjs and shared-core pin updates |
| 2 | 9e9230819 | Evidence (list, reader, view), read-only DocumentDisplay with its theme, LazyDocument, LinkedTo, Graph |
| 3 | 11aef39a5 | Decisions, Deliverables, route registry, tests/test-369-views-copy.cjs, tests/e2e-369/views.cjs |

## Verification

- `node tests/test-369-views-copy.cjs`: 23 passed, 0 failed (verbatim UI-SPEC strings in `client/copy.ts` and in the UI-SPEC, banned CTA words, no praise or exclamation mark, no long dash, every row of the tile table, precedence, formatters, room-question reader, `editable={false}` once with no save path, BlockNote pin 0.51.4 equal to the wiki editor's, no dangerouslySetInnerHTML or indexedDB, no TileRoom or data-tile-room and a TileMark only beside an item, a written status on every TileMark and ItemRow, the legend under every list with marks, no canvas in Graph, no export or publish text in Deliverables, the three Decisions groups in order, the Work wiring and the routes).
- `node tests/e2e-369/views.cjs`: 12 of 12 arms PASS in a real browser on a hermetic daemon (first visit; a decision waiting with one primary action, one triangle, one circle; leave, a write lands, come back; no change; Evidence with Contradicts and a document with no editable element, toolbar or side menu and a script tag in the document that never runs; Decisions with "Confirmed by you,"; Deliverables with no publish control; Graph text only; one H1 and focus on it per view; 390 px with no sideways scroll and the panel above Since you were here; the empty-question room; egress loopback only, zero securitypolicyviolation events, no console error).
- Suites run after the last source edit: test-369-canon-skin 30/30, shell-server 35, shell-actions 17, human-only 10, walled-manifest 8, ts-erasable-gate 8, shared-core 13, session-indicator 11/11; `tsc --noEmit` and `npm run build` in ui/shell clean.
- tests/e2e-369/replica.cjs: 12/12 on four runs, 11/12 on one run (arm 11, a stored copy of room-s was missing when checked, a diagnostic the test already prints; see Deferred Issues).
- Screenshots of every view at 1280 px and 390 px can be saved with `MOS_VIEWS_SHOTS=<dir> node tests/e2e-369/views.cjs` for the manual review against Canon v3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Projection version 2 for human attribution**
- **Found during:** Task 3 (Decisions)
- **Issue:** the nodes projection dropped `confirmed_by` and `confirmed_at`, so "Confirmed by you, {date}" (D-08) could only have been guessed from a claim's status.
- **Fix:** added both fields to nodes in `ui/shared/src/projection.ts` and bumped PROJECTION_VERSION to 2 (the designed way to change the schema: the database name carries the version, old copies are removed and rebuilt); updated the three version pins in `tests/test-369-shared-core.cjs` and the `-p1--` regex in `tests/e2e-369/replica.cjs` arm 10.
- **Commit:** c8ae20692

**2. [Rule 2 - Missing critical functionality] The last-visit marker keeps its day**
- **Found during:** Task 1
- **Issue:** "Nothing changed since your last visit on {date}." needs a date and the marker stored only the change number.
- **Fix:** `setLastVisit` stores `at` in the same local document; `getLastVisitAt` added to the replica and to `ReplicaProvider`'s context. A rebuilt copy still loses both.
- **Commit:** c8ae20692

**3. [Rule 3 - Blocking] Root route and the existing picker tests**
- **Found during:** Task 1 and the replica e2e
- **Issue:** the nav's Work link is `/` and plan 32 registered the room picker there; a view for Work needs that path once a room is open, which hid the picker from `tests/e2e-369/replica.cjs` (its `openRoom` helper goes to `/` and clicks a row).
- **Fix:** `HomeRoute` shows the picker when no room is open or on a page loaded with `/?rooms`, Work otherwise; a room opened from the picker drops the flag and shows Work; the helper in `replica.cjs` now goes to `/?rooms`. test-369-session-indicator and test-369-canon-skin needed no change.
- **Commit:** c8ae20692

**4. [Rule 1 - Bug] The room document's question is the whole question card**
- **Found during:** Task 3 browser run
- **Issue:** `roomDoc` and the copy's `room.question` carry the rendered question card ("Governing question (version 1 of 1): ... Origin: ... Set at: ..."), and the same field holds "No governing question recorded yet." when there is none, so showing it as the H1 would have printed the card.
- **Fix:** `questionOf` reads the question sentence out of the card; the roomDoc action's `has_question` decides whether the empty-state H1 shows.
- **Commit:** c8ae20692 (format.ts, WorkView)

**5. [Rule 2 - Missing critical functionality] The marker moves while Work is open**
- **Found during:** Task 3 browser run
- **Issue:** the only writes were at page hide and unmount; a write during navigation did not reliably land, so a revisit showed "What the room holds now" again.
- **Fix:** while Work is open and the copy is current, the stored marker moves up to the copy's change number after 400 ms. The list holds the marker it read when it opened, so it never empties under the person's eyes.
- **Commit:** c8ae20692

**6. [Rule 3 - Blocking] BlockNote under the nonce policy**
- **Found during:** Task 3 browser run
- **Issue:** the editor core injects a style element, which `style-src` with a nonce refused (3 securitypolicyviolation events).
- **Fix:** the raw view is used (no Mantine style elements) and the editor is given the page's nonce through its `_tiptapOptions.injectNonce` (an internal option, named in the file). Zero violations afterwards; the policy is unchanged.
- **Commit:** 9e9230819

### Decisions inside the plan's latitude

- Evidence is every node except sections and the question frame; a document is asked of the room only when `source_path` is a room-relative `.md` path (many nodes carry a synthetic handle such as `meeting:ab12:inline`, which has no document), otherwise "This item has no source document in the room."
- Deliverables lists every artifact in the room (see Notes).
- The Next decision panel reads the gate card with `callAction('readGate')` for its why and evidence count and keeps no render nonce; the gate view that shows a card for answering is the one that holds a nonce.
- A row's time is the day the item was created, confirmed or filed (the copy carries no change time).

## Deferred Issues

- `tests/e2e-369/replica.cjs` arm 11 failed once in five runs after this plan (the stored copy of room-s was not present at its check). The helper change is one line and the other four runs were green; it may be an existing timing race in that arm (its message already prints a diagnostic) but a baseline comparison at the previous commit was not made.

## Notes for the navigator and later plans

- Gate view (plan 27): Work and Decisions link to `/gate/<gate_id>`; `NextDecisionPanel` reads the card but never answers; `approveDecision` appears in no view here (the static test pins it).
- Server follow-up worth a quick plan: `roomDoc` and the feed's room document should carry the plain question and `has_question`; the shell now parses the card text, which would break if the card's wording changes.
- Projection follow-up: an `artifacts` field saying a document is a deliverable would let Deliverables list only those; today it lists every filed artifact.
- Decisions "Proposed" and "Settled" list claim-type nodes (claim, CausalClaim, assumption, opportunity, SyntheticExpert) and the recorded decision nodes; other node types appear in Evidence only.
- The D-11 five-square tile room is not drawn anywhere in the shell; the static test pins its absence.
- The shell's CSS stays inside the CANON369 checks (token colours only, radius 0, no shadow, no opacity); the editor's own rounded corners are overridden in `document-display.css`.

## Known Stubs

None. Every view reads the browser copy; the only placeholder-like text is the UI-SPEC empty-state copy.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: nonce-issuance | ui/shell/client/views/work/NextDecisionPanel.tsx | The panel calls readGate for the card's rationale; the server issues a render nonce for that browser session and gate that this view discards, and a later gate view re-reads and gets a fresh one (a re-issue replaces the earlier nonce, an approve with the old one is refused as human_only and re-read once by client/api.ts). No approval path is added. |

## Self-Check: PASSED

- FOUND: ui/shell/client/views/tile-model.ts, work/WorkView.tsx, evidence/DocumentDisplay.tsx, decisions/DecisionsView.tsx, deliverables/DeliverablesView.tsx, graph/GraphView.tsx, tests/test-369-views-copy.cjs, tests/e2e-369/views.cjs
- FOUND commits: c8ae20692, 9e9230819, 11aef39a5
- `grep -c "editable={false}" ui/shell/client/views/evidence/DocumentDisplay.tsx` prints 1; `grep -rc canvas ui/shell/client/views/graph` prints 0; `@blocknote/core` is 0.51.4; no U+2014 or U+2013 in the touched files.
