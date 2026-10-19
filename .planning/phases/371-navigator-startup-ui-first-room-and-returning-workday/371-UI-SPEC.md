---
phase: 371
slug: navigator-startup-ui-first-room-and-returning-workday
status: approved
shadcn_initialized: false
preset: none
created: 2026-10-19
reviewed_at: 2026-10-19
review_method: inline gsd-ui-checker rubric
canon_parts: [3, 7, 8, 9, 11, 12]
design_system: M:OS Design Canon v5
---

# Phase 371 - Navigator startup UI design contract

Scope: first-room preparation and approval; existing-room selection, memory
restoration and workday briefing. This is the target contract for subsequent UI
implementation. The working backend and current screenshots are the baseline.
They are not certified as visually conforming to this contract.

## Authority and evidence

1. `371-CONTEXT.md`: user scope and existing behavior to preserve.
2. `lib/mcp/app-html/rooms.html`, `lib/mcp/room-app.cjs`,
   `lib/mcp/tools/startup.cjs`, `lib/mcp/startup-operations.cjs`,
   `lib/core/navigation/room-workday.cjs`: current implementation.
3. `tests/test-startup-flows.cjs`, `tests/test-room-first-entry.cjs`,
   `tests/test-gpt-plugin-ui.cjs`: existing local protocol/browser evidence.
4. External, read-only `/home/jsagi/dev/mindrian-website/docs/DESIGN-CANON.md`
   v5, especially sections 4-8, 14, 34, 37-41; `design/CANON-V5-WEBSITE-SYSTEM.md`;
   `design/CONCEPT-STRUCTURED-SPACE.md`; `website/public/design-tokens.json` v5.

v5 governs this new phase. The older v3 shell contract does not override it.
Numerical sizing below is a **contract default** specialized for a host panel;
the canon identifies its numerical defaults as proposals rather than product law.

## Design System

| Property | Value |
|---|---|
| Tool | none; manual CSS custom properties and native semantic HTML |
| Preset | not applicable |
| Component library | none; reuse the existing room App and shared MCP bridge |
| Icon library | none; retain the existing product mark; CSS/SVG structural planes only |
| Font | Figtree 700 for headings/questions; DM Sans 400/700 for UI and body; JetBrains Mono 400 only for machine paths/identifiers |
| Asset delivery | package licensed font files with their notices; embed in the App resource with an explicitly compatible CSP; no runtime font service, new root dependency or CDN font request |
| Fallback | Arial, sans-serif; paths use monospace; readable controls remain available if a font is missing |

No shadcn initialization gate applies: this surface is HTML/CSS, not a React,
Next.js or Vite application. The existing pinned MCP Apps SDK remains the bridge;
this phase adds no component registry or framework. Do not copy site components
or introduce a second action loop.

## Spacing Scale

| Token | Value | Usage |
|---|---|---|
| xs | 4px | label-to-help and focus offset |
| sm | 8px | related controls, list rows |
| md | 16px | control padding and narrow-panel gutter |
| lg | 24px | panel padding and content grouping |
| xl | 32px | space between understanding and workday sections |
| 2xl | 48px | decision threshold separation; minimum control target height |
| 3xl | 64px | maximum major section break in a wide host |

Exceptions: none. Borders (1px ordinary, 2px boundary, 3px focus) are strokes,
not spacing tokens. Use only the scale for margin, padding and layout gap.
The v5 general spacing set is narrowed here to the GSD contract scale.

## Typography

Exactly four sizes and two weights (400 and 700). No fluid or additional sizes.

| Role | Size | Weight | Line Height |
|---|---|---|---|
| Label / provenance | 14px | 400; 700 for form labels | 1.5 |
| Body / controls | 16px | 400; 700 for selected option labels | 1.5 |
| Section / gate question | 24px | 700 | 1.2 |
| Room / opening question | 32px | 700 | 1.2 |

Use Figtree for the last two roles. DM Sans carries the first two, including
timestamps. Use the label size for paths. No all-caps kicker above a heading,
serif heading, light-weight display, italic CTA or forced uppercase paragraph.

## Color

| Role | Value | Usage |
|---|---|---|
| Dominant (60%) | Paper #F7F5EE | canvas and quiet space |
| Secondary (30%) | White #FFFFFF; quiet tint #E9EBF7 | retained understanding and proposed-room resting planes |
| Accent budget (10%) | Ink #111111 | one human action plane and its explicit decision threshold |
| Text / structure | Ink #111111; ink-soft #4B4943 | text, rules, selection outlines, neutral failure notices |
| Evidence | Blue #1F3FBF | labeled, recorded evidence/source markers only |
| Assumption | Red #D6281F | an explicitly labeled assumption needing examination only |
| Contradiction | Yellow #F2C200 | labeled contradiction plane with ink text only |
| Destructive | not applicable | no delete, archive or overwrite action in scope |

60/30/10 is the composition target for content planes, not a text-pixel quota.
Ink also carries neutral text and lines. Accent is reserved for the active
primary CTA and human decision frame; never every link or interactive element.
Role colors are semantic exceptions, appear only when the records contain that
role, and never indicate selection, completion, errors or generic decoration.
No invented contradiction or colored completion badge. White text on ink is
the primary action treatment. Secondary buttons are paper with an ink rule.

Selection uses a heavier ink outline plus a selected label/check state. Unknown
information uses a dashed ink boundary and explicit text. Error notices use an
ink frame and a recovery instruction. Never encode state by color alone.

The paper composition remains explicit in both light and dark host surroundings;
do not invert epistemic color meanings with prefers-color-scheme. Honor forced
colors with system colors and visible native control/focus states. No gradients,
translucency, soft shadows, rounded containers, circular decorative nodes or
colored notice side stripes.

## Composition and focal points

The human question is the first focal point, the retained/proposed room space
the second, and the current human action the third. The question and content
regions maintain this order; a readable ink action may be the darkest control.
The host header remains compact and does not compete with the room title.

Lead with one compact, fixed parallel-projection room picture: paper/white
rectangular planes, hard ink edges, a retained layer, an explicitly empty gap,
and a visible open gate at the human boundary. It represents the room and the
startup stages. It is not a fabricated knowledge graph, readiness score or 3D
product claim. Solid lines mean actual workflow sequence; a dashed continuation
means awaiting a decision. A legend/text equivalent states those meanings.

For a new room the picture is labeled "Proposed room - not created" until the
server receipt confirms creation. For a returning room it is labeled "Saved
room" and may show a retained record layer. Do not draw graph relationships or
evidence tiles unless the corresponding records exist. No animated closure,
scroll-driven approval or always-moving background. The gate remains open until
an actual decision receipt arrives; reject/defer are labeled outcomes, not success.

The forms and briefing share a meaningful ink axis with the room picture.
Use an offset context plane beside the governing question in a wide panel and
an independently composed shallow room section beside the title in a narrow
panel. Avoid equal-weight card grids and full-screen introductory illustrations.
The picture is presentational (aria-hidden); adjacent text conveys all state.

## Layout and responsive behavior

Contract defaults: support 320px container width and text zoom to 200% without
horizontal scrolling. At 320-599px use a 16px gutter, one reading column, a
shallow room picture, wrapped paths and vertically arranged full-width decision
controls. At 600px and above use a 24px gutter, max 960px content width, and a
2:1 reading-to-context grid when it fits. The gate follows the room preview or
briefing in DOM order in every layout. No fixed-width form, sticky footer that
covers content, or viewport-height welcome screen.

Measure the iframe/container, not the browser window. The host owns inline,
expanded and side-panel placement and persistence. Use the existing Apps SDK
resize/context bridge; a size or theme notification never changes a room or
submits a gate. Switching rooms is explicit. Render with normal document scroll.

## Component Inventory

| Component | Purpose / source |
|---|---|
| Room identity | existing mark, current room name and server-provided location; full path wraps |
| Room space | static SVG/CSS composition described above, backed by adjacent state text |
| Room selector | native radio group from room_list; no default selection |
| First-room form | name (1-100 chars), purpose (1-2000 chars), labeled help; no arbitrary folder picker |
| Creation preview | server-returned name, purpose, exact destination; stronger ink human boundary |
| F.0 controls | server-normalized approve/reject/defer options through gate_answer |
| Saved understanding | bounded recorded understanding, source/freshness where available; unknown remains unknown |
| Workday briefing | saved next action, changes and baseline, open questions, pending gate headers |
| F.1 next move | server-returned choices; free-text field with visible label, one explicit choice submission |
| Recovery notice | specific failure, retained room identity, safe retry/refresh/continue action |
| Room outline | semantic section list after the briefing; no fabricated counts or decorative tiles |

Do not change backend option IDs to match copy. A displayed friendly label must
remain mapped to the server's exact normalized option; specialize gate labels
at their existing producer rather than replace gate authority in the widget.

## Interaction Contract

1. Open: room_list displays the chooser. An empty result exposes the first-room
   form immediately. A read failure is not an empty list. Do not silently bind,
   choose yesterday's room, heal it, register a navigator or contact Theo.
2. Prepare: the name and purpose produce a room_create preview. No room or folder
   is created. Editing either field invalidates the preview and requires a new
   one. Display the exact server-selected folder before approval.
3. Decide: F.0 approval calls gate_answer on the displayed gate. Reject and defer
   leave the filesystem unchanged. Disable controls during a pending call; a
   timeout is unknown, not failure. Retain the gate ID and retry that answer for
   its durable receipt; do not mint another room on an uncertain response.
4. Open confirmed room: after a created/replayed receipt, or explicit existing
   selection, verify effective binding, then context_assemble, room_startup and
   room-dashboard. Validate every returned room identity. A mismatch stops the
   flow; no stale prior-room context may be presented as the chosen room.
5. Return: show recorded understanding, where work stopped, changes since the
   saved baseline, unanswered questions and pending decisions. Show timestamps
   in local time with timezone and a machine-readable datetime. A missing session
   summary, missing checkpoint, absent changes and unavailable memory are four
   distinct states. Use the persisted visit baseline on retries.
6. Choose today: the F.1 next-move gate follows the briefing. Its normalized
   choices are continue, review_changes, another_direction and free_text. Require
   text before submitting free_text. Submit once, show the receipt, then carry
   the bounded intent/context to the chat. Replayed/answered gates are read-only.
7. Pending decisions: show existing headers/counts only. Viewing startup never
   answers old gates. Further work/proposals use the existing conversation and
   command mechanisms and their own gates; no automatic Theo or command run.
8. Reopen/switch: clear the old view while binding a selected room. Reconnection
   requires checking the binding again. Preserve unsent form text for a same-view
   bridge interruption, without silently migrating it to another room or session.

## Copywriting Contract

| Element | Copy |
|---|---|
| Picker heading / CTA | "Which room are we working in?" / "Open selected room" |
| Empty heading | "Start your first room" |
| Empty body / CTA | "Give this work a name and a purpose. Review its local folder before creating it." / "Prepare room" |
| Purpose label | "What problem or opportunity will this room work on?" |
| Creation gate heading / CTA | "Create this room?" / "Approve and create room" |
| Reject / defer display labels | "Do not create room" / "Decide later"; preserve reject/defer option IDs |
| Folder help | "This folder is on the connected MindrianOS server." |
| Opening progress | "Opening [room name]..." then "Loading saved room context..." |
| Workday heading / sections | "Your workday briefing"; "Where we left off"; "What changed"; "Still open"; "Pending decisions" |
| No saved session | "No previous session summary was recorded. Choose what to work on today." |
| No baseline | "No previous checkpoint is recorded. Changes cannot be compared yet." |
| No changes | "No changes were recorded since [baseline]." |
| No open questions | "No open questions were found in these saved records." |
| No pending decisions | "No open decision gates were recorded." |
| Partial changes | "Showing a bounded selection of recorded activity." |
| Today question / label | "What would you like to work on?" / "Tell Larry what you need today" |
| F.1 labels | "Continue the unfinished work" (or "Review the room understanding"); "Review what changed"; "Choose another direction"; "Tell Larry what you need today" |
| After recorded choice | "Your startup choice is recorded. Continue in chat." |
| List failure / recovery | "The room list could not be read. Check the connection, then refresh rooms." / "Refresh rooms" |
| Binding failure | "This room could not be bound to the connection. Choose it again before continuing." |
| Memory failure | "Saved context could not be loaded. Retry loading context, or continue with that limitation." |
| Startup failure | "The workday briefing could not be loaded. Retry the briefing or continue in chat." |
| Room mismatch | "The returned context belongs to another room. Reopen your selected room before continuing." |
| Collision | "A room already uses that folder. Refresh rooms to open it, or prepare a different name." |
| Unknown creation outcome | "Creation has not been confirmed. Check this decision's receipt before preparing another room." / "Check creation result" |
| Expired decision | "This decision is no longer active. Refresh the room before choosing again." |
| Disconnected bridge | "MindrianOS is disconnected. Reconnect it, then refresh rooms. Nothing has been confirmed here." |
| Chat handover failure | "Your startup choice is recorded. Continue in the conversation." / "Continue in chat" |
| Destructive confirmation | not applicable; creating a new absent folder requires F.0 approval; overwrite/delete/archive are outside this phase |

Never show secrets, stack traces, raw protocol objects, framework names or
internal F-shape codes as product copy. Dynamic names/purpose/path/headers are
text, never HTML. An unavailable context is not a successful memory recall.

## Accessibility and motion

Use a single h1, ordered headings, explicit input labels, fieldset/legend and
native radios. Support keyboard-only selection and submission with visible
focus; no hover-only action. Control targets are at least 48px high. Selected
states retain native semantics even when borders change. Keep a live polite
status region; announce failures once and associate field errors with inputs.
After successful opening focus the room title; after preview focus its heading;
after a failed submission focus the error or first invalid field. Never steal
focus during background size updates. Preserve labels and focus at 200% zoom.

Use at least 4.5:1 contrast for normal text, 3:1 for large text and meaningful
control boundaries, checked from the shipped colors. No role-colored fine text
on paper if it misses contrast. Use ink text with a labeled role plane instead.
Focus is a 3px ink outline with 4px offset, with system-color handling in forced
colors. Font loading must not hide the form or move a confirmation under a click.

Static startup is the default. Optional state change opacity/transforms are
limited to 200ms and honor prefers-reduced-motion with immediate updates and
identical meaning. Never animate a gate closing before its receipt. Without JS
show a static room picture, a connection explanation and instructions to
continue in chat; do not render nonfunctional creation controls as enabled.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|---|---|---|
| none | none; native controls and existing local bridge | not applicable; no third-party component registry introduced |

Locally packaged fonts retain their license notices. Existing SDK transport is
not evidence of a reviewed third-party component registry; no new script origin
is authorized by this UI contract.

## Verification and implementation delta

The baseline currently uses Georgia headings, old palette values, extra type
sizes and off-scale spacing. Its blue CTA, yellow side stripe, kicker above the
heading and generic section card rows require replacement. Recovery controls,
timezone labels, keyboard focus transitions and a canon-compliant room picture
must be implemented and checked; do not claim they already passed.

Preserve the existing tool tests. Extend browser coverage for 320/390/600/960px
containers; 200% text zoom; forced colors; reduced motion; keyboard journeys;
first preview, reject, defer, approve, collision, timeout receipt check; effective
binding, wrong-room refusal, missing memory, missing checkpoint, partial/empty
changes, pending gates and one-time next-move submission. Check both direct
room_create and room_startup resource entry as well as room_list entry.

Capture both journeys in narrow and wide hosts using synthetic room data.
Check the room-space picture against v5's squint/no-copy/five-role tests without
implying fabricated room content; mobile is reviewed as its own composition.
Verify local font delivery and no new external requests. A real ChatGPT host
smoke test is a separate acceptance item after connection refresh; a synthetic
iframe test does not establish a persistent side panel or a live installation.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

Approval: approved 2026-10-19. Review applies to the contract, not the implemented screens.
