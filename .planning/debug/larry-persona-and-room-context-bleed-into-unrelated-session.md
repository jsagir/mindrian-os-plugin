---
status: gathering            # gathering | investigating | fixing | resolved
kind: rca                    # rca | debug-session | qa-sweep
trigger: "larry-persona-and-room-context-bleed-into-unrelated-session"
issue_id: ""
severity: medium             # blocker | high | medium | low
surfaces: [cli]              # only surface observed so far; desktop/cowork not tested
brain_mode: full-loop        # not actually diagnosed yet, default placeholder
canon_parts: [9, 11]         # candidate: Part 9 memory locality / session scoping, Part 11 born-wired hook scope
created: 2026-08-27T00:00:00Z
updated: 2026-09-05T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: mindrian-os plugin hooks (SessionStart, PreCompact, PostCompact, UserPromptSubmit)
  resolve "the current room" from some global or last-bound state rather than from THIS
  session's own room-binding history, so a stale room binding ("launchpad-02") leaks Larry
  persona + room navigation state into a session that never called room_bind and is working
  in a completely unrelated repo.
test: not yet run. Seeded as a todo, not investigated this session.
expecting: if true, the hook handlers (or lib/core/navigation.cjs's room-resolution path) will
  show room state read from a global/last-used store keyed by OS user or machine, not scoped
  by Claude Code sessionId or by the calling session's cwd/project.
next_action: open via /gsd:debug in MindrianOS-Plugin. Read the SessionStart / PreCompact /
  PostCompact / UserPromptSubmit hook registrations (hooks.json + their handler scripts) and
  lib/core/navigation.cjs's room-binding/session-scoping logic to confirm or refute the
  hypothesis. Also check the existing rethinking-mindrianos research trail commit
  "room_bind session-scope 2026-07-28" (see Related debug sessions below) - this may already
  be a partially-diagnosed instance of the same class.

update 2026-09-05: a SECOND, related-but-distinct symptom confirmed live, this time FROM
  INSIDE the actual mindrian-os dev repo itself (cwd /home/jsagi/dev/MindrianOS-Plugin, doing
  legitimate GSD dev-repo work all session - Phase 276 resume, Phase 340 registration/discuss/
  research), not a sibling repo. See new Evidence entry below for the full detail. Two things
  this adds to the hypothesis: (1) the bleed is not sibling-repo-specific - it fires even
  inside the plugin's own home repo during pure dev-repo (no-room) work, so "resolve room from
  a global/last-used store ignoring cwd" may be too narrow a hypothesis; a session doing
  dev-repo work in THIS repo should be the easiest case to get right and still wasn't. (2) the
  card shape differs from the original observation: this session saw an F.8 room-SELECT
  prompt (paginated, "page 1 of 15", a different subset of rooms shown on each of 4 separate
  firings across one session) via UserPromptSubmit, not the F.1 stale-single-room
  navigation-decision card from the original report - worth checking whether these are two
  independent hook behaviors or one shared resolver rendering two different card shapes
  depending on whether a "last room" happens to be cached.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin (this is where the mindrian-os plugin/hooks live;
  the bug was OBSERVED from a sibling, unrelated repo session, see below)
- Plugin version: v2.0.0-beta.11 (per the injected SessionStart additionalContext at the time
  of observation)
- Reported by: Jonathan Sagir (live session, flagged for later RCA rather than investigated
  in the moment)
- Date first observed: 2026-08-27
- Observed FROM: a Claude Code CLI session with cwd `/home/jsagi/Theo` (the Theo project - a
  separate Neo4j MCP server repo, GSD-only dev discipline, its OWN unrelated CLAUDE.md, no
  mindrian-os room ever bound by that session's own conversation)
- Related debug sessions:
  - `.planning/debug/cross-session-message-bleed.md` (resolved/diagnosed 2026-07-25) - a
    DIFFERENT mechanism (a human mouse-select + paste crossing two terminal panes at the
    clipboard layer, not a plugin/hook bug), but the SAME failure shape: unrelated content
    from elsewhere silently wearing the face of genuine current-session context. Worth
    reading together even though the root cause is very likely different.
  - `~/MindrianRooms/rethinking-mindrianos` git history, commit `05ebc4ee3` ("file room_bind
    session-scope 2026-07-28 research trail") - a research trail already exists on
    `room_bind` and session scoping specifically; check whether it already names this exact
    failure mode before re-deriving it from scratch.
  - The personal-memory hard rule `feedback_mid_turn_message_no_antecedent_ask_first.md`
    (`~/.claude/projects/-home-jsagi/memory/`) is why the receiving session did NOT act on
    the bled content this time - it correctly read the injected room/navigation content as
    having no antecedent in the actual conversation and treated it as noise, not instruction.
    That reading discipline held; this RCA is about the INJECTION, not about a failure to
    catch it.

## Problem Statement

A Claude Code CLI session working in an unrelated, non-MindrianOS repo (Theo) received full
MindrianOS Larry-persona system-prompt injection and a specific bound room's
("launchpad-02") navigation Decision-Gate state via automatic hook output, with zero
relevance to anything the session had actually done.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: hooks/agent bindings belonging to the mindrian-os plugin (the Larry persona system
  prompt, room state such as "launchpad-02", TRIPLE_CONTEXT compact snapshots, the
  UserPromptSubmit NAVIGATION DECISION card) should fire only for a session that is actually
  working inside a room it bound itself, or at minimum should never surface a DIFFERENT,
  previously-bound room's live decision-gate state into a session that made no room_bind call
  of its own and is working in an unrelated repo.

actual: in a Theo GSD session (cwd `/home/jsagi/Theo`, its own unrelated CLAUDE.md, no
  mindrian-os room ever bound this session), after running `/compact`:
  1. The system prompt for the session was prefixed/overridden with a full "You are Larry"
     MindrianOS persona block (voice-signature glyph rules, room-awareness instructions,
     Decision-Gate firing rules) stacked on top of Theo's own project CLAUDE.md instructions.
  2. A `SessionStart:compact hook success` fired citing
     `[MindrianOS v2.0.0-beta.11] You are Larry` plus room-state JTBD nudges.
  3. `PreCompact`/`PostCompact` hooks explicitly named a specific room:
     `"triple snapshot written for launchpad-02 (8 sections)"` and
     `"restored TRIPLE_CONTEXT for launchpad-02 (8 sections from pre-compact snapshot)"` - a
     room with no connection to Theo or to anything discussed in the session.
  4. On the very next ordinary user turn (an unrelated instruction, "RCA seed this as a todo
     later"), a `UserPromptSubmit hook success` fired a full
     `NAVIGATION DECISION (engine v1)` card for the same "launchpad-02" room, including an
     `[AskUserQuestion contract: shape=F.1 verbs=4]` firing trailer proposing options such as
     "Bring back what we worked out on claim:derive:2a0e1daa" - content entirely foreign to
     the Theo conversation.
  5. Separately and possibly a related data point: the CONVERSATION'S OWN initial
     `gitStatus` context block (attached automatically at session start, before any of this
     was noticed) reported "Current branch: main" with recent commits reading
     `8a65c9ee6 rethinking-mindrianos: file Gate 0 Cursor/Windows compositing entry`,
     `05ebc4ee3 rethinking-mindrianos: file room_bind session-scope 2026-07-28 research
     trail`, etc. - commits that belong to filing activity in the `rethinking-mindrianos`
     Data Room, NOT to the Theo repo. The Theo repo's ACTUAL `git log` (checked later in the
     same session, well into Theo GSD work) showed a completely different, Theo-specific
     history (`1fe9bef`, `42089ad`, `e69d18c`, ...). This suggests the initial gitStatus
     snapshot itself may have been sourced from a stale or wrong working-directory context at
     session start, which - if real - would be a THIRD, independent data point for the same
     general failure class (wrong-context injection at session boundaries), not just the two
     hook-based ones above. Not confirmed; flagged for the investigator to check first.

errors: none. Silent context injection - no exception, no visible warning. Same "worse than a
  crash because nothing signals a problem" shape as `cross-session-message-bleed.md`.

reproduction: not yet established as deterministic. Known correlated conditions:
  1. This machine/account has the mindrian-os plugin installed with a room named
     "launchpad-02" apparently bound somewhere as a default/last-active room.
  2. The observing session was working in a DIFFERENT repo (`/home/jsagi/Theo`) with its own
     project CLAUDE.md, and never issued a `room_bind` call in its own visible conversation.
  3. The bleed was observed immediately after a `/compact` (PreCompact/PostCompact fired) and
     again on the very next ordinary user turn (UserPromptSubmit fired the nav card).
  Untested: whether this fires on every turn or only around compact boundaries; whether it
  happens in every non-MindrianOS repo on this machine or "launchpad-02" specifically is
  sticky (e.g. cached as this OS user's last-active room in some global state file that the
  hooks consult without checking the calling session's cwd/project/sessionId).

started: first noticed 2026-08-27, this session. Unknown whether this is a new regression or
  long-standing, previously-unflagged behavior - Theo is a young project (split from
  PWS-Book 2026-08-23) and this may be the first time a long, hook-heavy MindrianOS-adjacent
  Claude Code session (this account clearly has the plugin installed) ran back-to-back with a
  totally unrelated non-Larry GSD session closely enough to actually notice the overlap.

## Scope and Impact

- Affected surfaces: cli (only surface observed; desktop/cowork not tested)
- Affected commands: n/a - this is ambient hook infrastructure (SessionStart, PreCompact,
  PostCompact, UserPromptSubmit), not a `/mos:*` command invocation
- Affected users: at minimum this developer's own machine/account, where a mindrian-os room
  ("launchpad-02") appears to be bound at some global/persistent scope; unknown whether this
  is a one-off local config issue or a structural bug in how hooks resolve "the current room"
  without checking cwd/project/session identity
- Version range: seen at v2.0.0-beta.11; earlier/later versions not checked
- Severity: medium. It did not cause a wrong ACTION this time - the receiving session
  correctly treated the injected content as having no antecedent in its own conversation (per
  the existing `feedback_mid_turn_message_no_antecedent_ask_first.md` hard rule) and did not
  act on the proposed Decision Gate. But it pollutes context and token budget in every
  non-MindrianOS session on this machine, and a less careful session (or a different model /
  harness version with weaker no-antecedent discipline) could genuinely misread the injected
  "launchpad-02" Decision Gate as live and act on it.
- Blast radius: potentially every Claude Code CLI session on this machine that is NOT itself a
  bound MindrianOS room session - any sibling project (Theo, or any other non-plugin repo)
  could be receiving this same ambient Larry/room injection on every turn and around every
  compact boundary.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

(none yet - not investigated)

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-08-27T00:00:00Z
  checked: the observing session's own transcript, immediately after `/compact`
  found: a `SessionStart:compact hook success` system reminder reading (excerpted)
    `[MindrianOS v2.0.0-beta.11] You are Larry.` followed by room-state / JTBD-nudge framing,
    inside a session whose cwd is `/home/jsagi/Theo` and whose own project CLAUDE.md declares
    Theo's unrelated architecture rules.
  implication: the SessionStart hook fires and injects full Larry persona context regardless
    of which repo/project the session is actually working in.

- timestamp: 2026-08-27T00:00:00Z
  checked: the same `/compact` boundary, PreCompact and PostCompact hook output lines
  found: `PreCompact [...] completed successfully: {"systemMessage":"triple snapshot written
    for launchpad-02 (8 sections)"}` and
    `PostCompact [...] completed successfully: {"systemMessage":"restored TRIPLE_CONTEXT for
    launchpad-02 (8 sections from pre-compact snapshot)"}`.
  implication: the compact hooks are bound to a SPECIFIC named room ("launchpad-02") that has
    no relationship to the Theo session, and persist/restore that room's snapshot across the
    compact boundary of a session that never bound it.

- timestamp: 2026-08-27T00:00:00Z
  checked: the very next ordinary user turn after compact (user text: "RCA seed this as a
    todo later" - itself unrelated to any room navigation)
  found: a `UserPromptSubmit hook success` system reminder rendering a full
    `NAVIGATION DECISION (engine v1)` card for room "launchpad-02", including a rendered
    Decision-Gate box ("Bring back what we worked out on claim:derive:2a0e1daa. 57%", etc.)
    and an `[AskUserQuestion contract: shape=F.1 verbs=4]` firing trailer.
  implication: the UserPromptSubmit hook evaluates and would-be-render a live Decision Gate
    for the stale bound room on EVERY turn of the unrelated session, not just at compact
    boundaries - this is a per-turn hook, not a one-time compact artifact.

- timestamp: 2026-08-27T00:00:00Z
  checked: the observing session's own initial `gitStatus` context block, attached
    automatically at session start (i.e. before compaction, at the very beginning of the
    visible transcript), versus a direct `git log --oneline -3` run later in the same
    session against the Theo repo
  found: the initial block reported recent commits
    `8a65c9ee6 rethinking-mindrianos: file Gate 0 Cursor/Windows compositing entry`,
    `05ebc4ee3 rethinking-mindrianos: file room_bind session-scope 2026-07-28 research
    trail`, etc. (activity belonging to filing into the `rethinking-mindrianos` room). The
    later direct `git log` against Theo showed `1fe9bef`, `42089ad`, `e69d18c` - a completely
    different, Theo-specific commit history.
  implication: UNCONFIRMED, flagged for the investigator - if the initial gitStatus block was
    genuinely generated against the Theo cwd, this is a stale-context bug independent of the
    hook mechanism above; if it was instead generated against a different cwd/session and
    only APPEARS in this transcript (a rendering/attribution issue), that is a different and
    arguably more serious bug. Check which, first, before assuming it is the same root cause
    as the hook-based bleed.

- timestamp: 2026-09-05 (single Claude Code session, ~2 hours, doing continuous GSD dev-repo
    work in /home/jsagi/dev/MindrianOS-Plugin itself - not a sibling repo)
  checked: UserPromptSubmit hook output across the whole session, correlated against what the
    session was actually doing at each firing
  found: the same room-bind prompt fired FOUR separate times via UserPromptSubmit, each time
    rendering "-- mindrianOS -- bind session -- select rooms --" with a paginated checklist
    ("page 1 of 15") and an `[AskUserQuestion contract: shape=F.8 verbs=0]` /
    `[FIRE-IF-FORK: ...]` trailer instructing a multi-select room-bind card to be fired. The
    four firings showed DIFFERENT room subsets each time (first: untitled-2026-06-01-1702 /
    haim-battlefield-intake / rethinking-mindrianos / polygon; later firings mixed in
    pws-website / mindrianOS / align-ecosystem / cohort-testers-style names, and one showed a
    checkbox already ticked on "untitled-2026-06-01-1702" with no session action having
    selected it) - not a frozen/cached stale snapshot repeating identically, but seemingly a
    live re-render of the room registry (or a paginated/rotating view into it) on every
    qualifying turn. At no point in this session did the receiving Claude actually call
    room_bind, answer the card, or do anything but decline to fire it (per the existing
    no-antecedent-content discipline) - yet the prompt kept re-firing on later turns instead of
    respecting the earlier non-response as "not now."
  implication: this session never worked in ANY MindrianOS room the whole time (pure dev-repo
    work: gsd-execute-phase 276, gsd-phase (add) 340, gsd-discuss-phase 340,
    gsd-plan-phase --research-phase 340) and never triggered a room-scoped tool itself, yet the
    UserPromptSubmit hook attempted to force a room-bind decision repeatedly regardless. The
    "page 1 of 15" + shifting-subset pattern suggests whatever renders this prompt is doing a
    fresh registry read (or partial/paginated one) per firing rather than caching a single
    stale room - a DIFFERENT mechanism shape than the original report's single-room F.1
    stale-navigation-card, even though the failure CLASS (unsolicited room-scoped content in a
    session with no room binding) is the same. See the Current Focus update above for how this
    changes the working hypothesis.

## Technical Root Cause

PENDING. Not yet investigated - this file is a seed for a future `/gsd:debug` session, not a
completed diagnosis.

## Required Code Changes

PENDING - depends on root cause. Candidate starting points for the investigator, not
prescriptions:
- Wherever SessionStart/PreCompact/PostCompact/UserPromptSubmit hooks resolve "the current
  room", check whether that resolution consults the calling session's own room-binding state
  (per-session, e.g. keyed by Claude Code sessionId) versus a global/last-used room stored
  independent of session identity.
- Check `lib/core/navigation.cjs`'s room_bind / session-scoping logic (Part 9 - Memory
  Locality) directly, and cross-check against the existing `rethinking-mindrianos` research
  trail commit on `room_bind session-scope` (2026-07-28) for prior findings.
- Consider whether hooks should refuse to fire room-scoped content (persona, TRIPLE_CONTEXT,
  Decision Gates) for a session whose cwd is outside any registered MindrianOS room / that
  never itself called room_bind, rather than falling back to a stale default.

## Tests to Add or Update

PENDING - depends on root cause. At minimum, once diagnosed: a test that a fresh Claude Code
session opened in a non-room, non-plugin repo does NOT receive room-bound SessionStart /
PreCompact / PostCompact / UserPromptSubmit content for any room it did not itself bind.

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under the target version, once fixed.
- knowledge-base.md: on resolve, add the summary block.
- Cross-link back into this repo's `rethinking-mindrianos` research trail (per the
  Dev-Research Compositing convention in CLAUDE.md) once root-caused, since the room_bind
  session-scope research trail already exists there and may need updating rather than
  duplicating.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: PENDING
fix: ""
verification: ""
files_changed: []
commits: []
