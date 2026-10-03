---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 20
subsystem: ui-shell
tags: [design-canon-v3, tokens, fonts, primitives, frame, d-01, d-04, d-10, d-11, csp]
requires: [369-19, 369-32, 369-22]
provides:
  - "Design Canon v3 token sheet, bundled fonts, base styles in ui/shell/client/styles"
  - "Primitives: StateMark, TileMark, Legend, ActionButton, TextAction, Rule, LiveRegion, InlineError, ConfirmDialog"
  - "Frame: ShellFrame, ShellHeader, RoomSelector, PrimaryNav, StatusPanel, SessionIndicator (interim), Banners, useShell() context"
  - "tests/test-369-canon-skin.cjs (CANON369-04, CANON369-05)"
affects: [369-23, 369-24, 369-25, 369-26, 369-27, 369-29]
requirements: [CANON369-04, CANON369-05]
canon_parts: [8, 12]
key-files:
  created:
    - ui/shell/client/styles/tokens.css
    - ui/shell/client/styles/base.css
    - ui/shell/client/styles/fonts.css
    - ui/shell/client/primitives/ (nine TSX files and primitives.css)
    - ui/shell/client/frame/ (ShellFrame, ShellHeader, RoomSelector, PrimaryNav, StatusPanel, SessionIndicator, Banners, shell-context.ts, view-roots.ts, frame.css)
    - ui/shell/app/shell-page.tsx
    - ui/shell/app/[...view]/page.tsx
    - ui/shell/app/not-found.tsx
    - tests/test-369-canon-skin.cjs
  modified:
    - ui/shell/package.json
    - ui/shell/package-lock.json
    - ui/shell/app/layout.tsx
    - ui/shell/app/page.tsx
    - ui/shell/client/App.tsx
    - ui/shell/client/RoomPicker.tsx
    - ui/shell/client/copy.ts
key-decisions:
  - "Font packages approved by the navigator, pinned exactly at 5.3.0, installed with --ignore-scripts in the walled package only"
  - "Fonts are bundled by the chassis from relative url() into the walled package's node_modules; the above-the-fold preload URLs come from new URL(..., import.meta.url) so they are the same hashed files"
  - "The room selector precedes the wordmark in the DOM and grid areas draw the wordmark at the left, so the room name is literally the first header content"
  - "The shell owns its 404 page so no chassis inline-style page reaches the CSP"
metrics:
  duration: "about 2h (estimated; start time was not recorded)"
  tasks: 3
  files: 40
  completed: 2026-10-03
---

# Phase 369 Plan 20: Canon v3 skin, primitives and shell frame Summary

The shell now looks and behaves as Design Canon v3 says: one exact token sheet, four fonts served from its own origin, nine shared primitives that make the canon's rules (radius 0, ochre law, a tile never without words) the default, and a frame that carries the D-10 information architecture with the D-04 interim connection word. One test proves it, including a headless-Chromium run against the built shell.

## Task 1: Font package legitimacy check (checkpoint, resolved before execution)

The orchestrator presented the checkpoint to the navigator through AskUserQuestion on 2026-10-03, grounded against the live npm registry (read-only `npm view` and a tarball listing, nothing installed).

Navigator reply, verbatim: **"approved"** (the navigator selected "approved (Recommended)": all four packages at 5.3.0 with exact pins and --ignore-scripts; JetBrains Mono kept for status words, ids and legends per the UI-SPEC contract). Date: 2026-10-03. Four packages approved, JetBrains Mono kept (not struck).

Registry facts recorded by the orchestrator: `@fontsource-variable/fraunces`, `@fontsource-variable/dm-sans`, `@fontsource-variable/jetbrains-mono` and `@fontsource/bodoni-moda` are all 5.3.0, licence OFL-1.1, repository github.com/fontsource/font-files, maintainers lotusdevshack and jwr1 (the Fontsource project), no install, preinstall or postinstall scripts. Fraunces metadata.json exposes axes ital, opsz (9-144), wght, SOFT, WONK and styles italic and normal, so the opsz axis and the italic the UI-SPEC needs are present.

Acceptance: `ui/shell/package.json` had no `@fontsource` entry before the reply (confirmed at the start of this run); nothing was installed until after it. Lockfile integrity hashes were taken from `npm view <pkg>@5.3.0 dist.integrity`.

## What was built

**Task 2 (commit 57d5cd25a): tokens, fonts, base styles, primitives**
- `tokens.css`: the eleven colour tokens with exact hexes, four font tokens, easing and three durations, `--radius: 0`, spacing `--space-xs..3xl` (4 to 64 px), the four type roles, fixed heights, grid values.
- `fonts.css`: eleven `@font-face` blocks (Fraunces normal and italic with opsz, DM Sans normal and italic, JetBrains Mono, Bodoni Moda 700), latin and latin-ext subsets by unicode-range, `font-display: swap`, relative urls only. The build emits 480 KB of woff2 under `/_next/static/media` and the built CSS has zero `http` strings.
- `base.css`: radius 0 on everything except `[data-mark="circle"]`, the focus ring (2 px ochre outline, 4 px offset, 1 px ink edge), ink links with 1 px underline at 3 px offset and 2 px on hover, the 12-column and 4-column grid with the 768 and 1280 breakpoints, Display 32 px on phones and 40 px from 768, reduced-motion collapse.
- Primitives: `StateMark` (aria-hidden; triangle is an inline svg so its ochre fill carries a 1 px ink stroke on paper and none on ink), `TileMark` (status required by the type, throws in development and renders nothing in production when empty, `data-tile` on a wrapper whose text is the status), `Legend`, `ActionButton` (primary and secondary, states idle, disabled via `aria-disabled`, saving with the ochre progress line, success with the rust square, error), `TextAction`, `Rule` (CSS-only draw and rise), `LiveRegion` plus `LiveRegionProvider` and `useAnnounce` (debounced to one message per 2 s), `InlineError` (What / Why / Fix), `ConfirmDialog` (native dialog, Esc cancels, secondary focused, focus returns to the opener, content exists only while open).

**Task 3 (commit 5d188d252): the frame and the test**
- `ShellFrame` owns the shell state (status, rooms, waiting gates, polled every 5 s while visible) and shares it through `useShell()` in `shell-context.ts`. It renders a skip link, header, nav, banners, the view outlet (`<main id="view">`, remounted on a room switch), the Status panel, the room-switch dialog and exactly one live region.
- `ShellHeader`: 64 px, 2 px ink rule, room selector first, wordmark "M:OS" in Bodoni Moda with the colon as two outlined squares (rust over cobalt), session indicator slot, Status control.
- `RoomSelector`: listbox of `listRooms`, keyboard support, bound room marked "Open now"; a `gate_open` answer opens the "Leave this decision unanswered?" dialog with the UI-SPEC body, "Switch to {room}" and "Stay here" (focused); the retry sends `confirmLeave: true`.
- `PrimaryNav`: Work / Evidence / Decisions / Deliverables, a 1 px rule, Graph; `aria-current="page"`, a 2 px cobalt bar that grows in over 200 ms, "Decisions (n waiting)" in words, horizontal scroll that keeps the current tab in view.
- `StatusPanel`: 400 px right panel (full screen on phones), not a modal, Esc and "Close status", rows for Connection, Address, MindrianOS version, MCP session (8 characters), Browser copy, Last update, and the InlineError when the shell server does not answer.
- `SessionIndicator`: first line `// INTERIM(plan 24)`, one of "Connected", "Reconnecting...", "Disconnected" from `/api/status`.
- `Banners`: connection-lost banner with "Reconnect now", and the one-line failure banner.
- Glue: `app/layout.tsx` imports the five stylesheets and preloads DM Sans and Fraunces; `App.tsx` and `RoomPicker.tsx` now sit inside the frame and use the primitives.

## Verification

- `node tests/test-369-canon-skin.cjs`: 30 passed, 0 failed, exit 0 (static arms, mutation arms that plant bad sheets, behaviour arms that transpile and render the primitives and the frame with the walled package's own TypeScript and React, and the Playwright render arm against the built shell).
- Render arm facts: zero `securitypolicyviolation` events and zero CSP console errors across the whole run; only 127.0.0.1 hosts; computed radius 0 on every element (with the Status panel and the room-switch dialog open); exactly one `aria-current` tab, one H1 and one `role="status"` region; at 390 px `scrollWidth <= innerWidth` on load, with the room list open and with the Status panel open; Fraunces, DM Sans, JetBrains Mono and Bodoni Moda all report `loaded` and every font request is `127.0.0.1/_next/static/media/...`; Cancel sends no `confirmLeave`, Switch does.
- Regression: `test-369-walled-manifest` 8/8, `test-369-ts-erasable-gate` 8/8, `test-369-shell-server` 35/35 (build, live arm), `test-369-shell-actions` 17/17, `test-369-launch-surface` 17/17, `test-369-constitution` 7/7, `test-369-installed-layout` 7/7, `node scripts/build-connector-registry.cjs --check` clean. `npm run build` in ui/shell exits 0 and `tsc --noEmit` is clean.
- Nothing was added to the root `package.json` (`git status` clean for it; the walled-manifest test and a canon-skin arm both assert no `@fontsource` there).
- Visual check by screenshot at 1280 and 390 px (header, nav, room list open, phone layout): hierarchy and the canon read as intended.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lockfile shape preserved by hand**
- **Found during:** Task 2 (install)
- **Issue:** `npm install --save-exact` rewrote ui/shell/package-lock.json into the link shape (`resolved: "../shared", link: true`) and pruned the MCP client, core and eventsource packages that `mos-ui-shared` needs. The plan 19 lockfile is in the `install-links` shape, and a fresh `npm ci` only works with `--install-links` (see Deferred Issues).
- **Fix:** restored the committed lockfile, added the four package entries and the root `dependencies` block by script with the registry integrity hashes, verified `npm ci --install-links --ignore-scripts` succeeds and restores the hoisted packages. The lockfile diff is +44 lines, nothing else.
- **Files modified:** ui/shell/package.json, ui/shell/package-lock.json
- **Commit:** 8c9d580be

**2. [Rule 1 - Bug] VIEW_ROOTS imported from a client module crashed the server render**
- **Found during:** Task 3 (render arm)
- **Issue:** the route glue imported the `VIEW_ROOTS` array from `PrimaryNav.tsx`, a `'use client'` module, so the server component received a client reference and `/decisions` answered 500.
- **Fix:** moved the array to `client/frame/view-roots.ts` (no React, no directive).
- **Commit:** 5d188d252

**3. [Rule 1 - Bug] Moving `app/page.tsx` broke `test-369-shell-server`**
- **Found during:** regression run
- **Issue:** the first approach replaced `app/page.tsx` with an optional catch-all `app/[[...view]]/page.tsx`; the plan 19 test names `app/page.tsx`.
- **Fix:** `app/page.tsx` stays at the root, a required catch-all `app/[...view]/page.tsx` serves the deeper paths, and both call one shared `renderShell()` in `app/shell-page.tsx`. Route files are unchanged (`test-369-shell-actions` still sees exactly the seven `route.ts` files).
- **Commit:** 5d188d252

**4. [Rule 2 - Missing critical functionality] The shell's own 404 page**
- **Found during:** Task 3 (render arm)
- **Issue:** the chassis 404 page draws inline `style` attributes that the nonce CSP blocks (a `securitypolicyviolation` on any unknown path) and speaks in a non-canon voice. UI-SPEC Egress section: "No chassis chrome survives".
- **Fix:** `app/not-found.tsx` with plain markup in the token sheet. The copy is new and not in the UI-SPEC (`NOT_FOUND` in `client/copy.ts`: "This page is not part of the workspace." / "The workspace has five views: Work, Evidence, Decisions, Deliverables and Graph." / "Go back to Work."); the navigator can reword it.
- **Commit:** 5d188d252

### Plan-versus-UI-SPEC and structure notes (UI-SPEC wins, differences recorded)

- **Extra files outside the plan's list**, all inside `ui/shell`: `client/primitives/primitives.css` and `client/frame/frame.css` (the plan names three stylesheets; primitive and frame styles needed a home that is not base.css), `client/frame/shell-context.ts` (breaks the ShellFrame/RoomSelector import cycle), `client/frame/view-roots.ts`, `app/shell-page.tsx`, `app/[...view]/page.tsx`, `app/not-found.tsx`, and additions to `client/copy.ts`.
- **Mount point:** the plan says "mount ShellFrame as the root layout". The frame is mounted by `App` for signed-in sessions rather than in `app/layout.tsx`, because the layout also wraps the "not signed in" page, which has no room, no status and nothing to poll. The layout carries the stylesheets and font preloads.
- **Header DOM order:** the room selector comes before the wordmark in the document (so the room name is literally the first header content, as the plan's static arm and SKILL.md Zone 1 require) and CSS grid areas draw the wordmark at the left. Keyboard focus therefore reaches the room selector before the wordmark.
- **Nav bar motion:** the cobalt bar grows in from the left over 200 ms on each tab rather than sliding between tabs; a true slide needs measured positions, which would need a style attribute the CSP forbids.
- **Dialog primary action:** the dialog's primary action uses the primary ActionButton (with its triangle). The dialog renders its content only while open, so no closed dialog adds a second triangle to a view.
- **Test split across commits:** `tests/test-369-canon-skin.cjs` is committed with Task 3 (it asserts frame files that do not exist at the Task 2 commit); Task 2's checks ran green against the working tree before either commit.

## Authentication Gates

None. The package legitimacy checkpoint was a human-verify gate, resolved by the orchestrator before this run (see Task 1).

## Deferred Issues

- **README build recipe fails on npm 10.9.8:** `ui/shell/README.md` says `npm ci --ignore-scripts`, but plan 19's lockfile is in the `install-links` shape and plain `npm ci` stops with "Missing: mos-ui-shared@0.1.0 from lock file" (reproduced against the committed HEAD lockfile in a temp copy). It works with `--install-links`. Pre-existing and out of scope; plan 28 (release build) should either regenerate the lockfile or document `--install-links`.
- **Chassis route announcer:** Next injects a `next-route-announcer` (a shadow-DOM `role="alert"` element, styled through CSSOM, which the CSP allows). It is not our LiveRegion and cannot be switched off by config; CANON369 C8-style counts should look for `role="status"` only.

## Known Stubs

| File | What | Resolved by |
|------|------|-------------|
| `client/frame/StatusPanel.tsx` | "Browser copy" row reads "Not started" (no replica exists yet); no "Rebuild the browser copy" action | plan 369-23 |
| `client/frame/Banners.tsx` | `copySeq` prop defaults to null, so the banner reads "Lost the connection to the room." without the "last copy, up to change {seq}" clause | plan 369-23 passes the change number |
| `client/frame/RoomSelector.tsx` | purpose line and child-room path render only when the server supplies them; `listRooms` answers slugs only | a follow-on that extends `listRooms` |
| `client/frame/SessionIndicator.tsx` | interim body, marked `INTERIM(plan 24)` | plan 369-24 (signed design note) |
| `client/routes.ts` registry | only `/` is registered; `/evidence`, `/decisions`, `/deliverables`, `/graph` show the "No room open" state inside the frame | plans 369-25 and 369-27 |

## Threat Flags

None beyond the plan's threat model. T-369-20-SC (install gate, exact pins, --ignore-scripts), T-369-20-01 (no outside host: relative urls, `font-src 'self'`, egress capture in the render arm), T-369-20-02 (TileMark requires a status) and T-369-20-03 (`gate_open` drives the confirmation, the switch only retries with `confirmLeave`) are each covered by a test arm. The new `[...view]` catch-all adds no new data path: it renders the same session-gated page body and 404s any first segment outside the six view roots.

## Self-Check: PASSED

- Files found: tokens.css, base.css, fonts.css, TileMark.tsx, ActionButton.tsx, ShellFrame.tsx, SessionIndicator.tsx, not-found.tsx, tests/test-369-canon-skin.cjs.
- Commits found: 8c9d580be, 57d5cd25a, 5d188d252.
- STATE.md, ROADMAP.md and the root package.json are untouched.
