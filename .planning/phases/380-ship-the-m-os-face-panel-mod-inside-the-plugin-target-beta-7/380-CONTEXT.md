# Phase 380: Ship the M:OS face panel mod inside the plugin - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Method:** discuss-phase answered from the canon (mos-brand book e947a5d, /home/jsagi/mos-brand, 2.43.0), then the navigator ruled the conflicts by card. Full rulings with segment citations: 380-BOOK-RULINGS.md in this folder (read it before planning).

<domain>
## Phase Boundary

Ship the existing /m:os face panel mod (side panel, one status line, prompt-box buttons, /mos-* commands) inside the plugin so it installs and loads with no manual copy. Scope is fixed by ROADMAP.md (MOD380-01 to 06). No new panel features.

**The mod was built WITHOUT GSD.** This phase is where it enters GSD. Treat every earlier claim as unverified. The adoption audit (section 4 of 380-BOOK-RULINGS.md) found: the tests number 34, not 29 (`claude plugin test` in a scratch copy: 34 pass, 0 fail); the backup ~/dev/mos-face-mod is identical to the live copy; the type-check cannot run (tsconfig extends a missing base file). Plans must re-verify, not trust.
</domain>

<decisions>
## Implementation Decisions (locked by the navigator, 2026-10-23)

- **D-01 Canon:** the canon is /home/jsagi/mos-brand at e947a5d. Cite it as "mos-brand book e947a5d" plus the segment path. It is not labelled v5. Segments marked proposed (experience/terminal) carry that status in every ruling that uses them.
- **D-02 Colors (N2):** the panel and face follow the canon: blue, red, yellow, black, white by state (identity/theo/states). The older workspace-mod ruling C-32 (no yellow, no blue) is superseded for this panel. Blue is attention, never proof.
- **D-03 Own words (N3, Canon Part 8):** keep the 2026-10-21 owner ruling as written: only brain_ask carries the cleaned 240-char excerpt of the person's own prompts, on by default, /mos-words turns it off, shown in full; never assistant text, room files or claims. REMOVE the mcp__theo__search path that sends up to 8 words; that call sends handles only. Also close the gap that a venture name typed in prose is not stripped by sanitize (decide the stripping rule in planning, test it).
- **D-04 Name and voice (N8):** the panel is Theo's face. Words are plain English, short, warm and demanding, with no stack words (no ICM, no Brain, no MCP). Larry is not named in the panel.
- **D-05 Packaging (N10):** a walled package built for the release, following the Phase 369.26 precedent (ui/mindrian-workspace-mod): its own folder and lockfile, never in the root package.json, only built assets ship. Fits CLAUDE.md D-17. The plan must prove install-and-load with a test that runs on an installed layout (tests/test-369-installed-layout.cjs pattern).
- **D-06 Test count:** the gate runs all 34 tests, not 29. Correct MOD380-02 in ROADMAP.md.

### Claude's Discretion (book silent; planner proposes, then the navigator rules in review)
- N1: the stale "Canon v5" text in the book's proposed terminal segment and the mindrian-tui-designer skill is a book issue. Record it as a book follow-up; do not edit the book from this phase.
- N4 two status lines: default keep both (the plugin line and the pinned panel line), as the book records the old line still draws beside a band. Flag the clash with ui/mindrian-workspace-mod, which also draws a band and a pane.
- N5 commands: keep /mos-* (hyphen) and /mos-words. Propose a book segment entry for opt-out and consent controls.
- N6 secondary text on ink: default "dimmed paper" until the book has a token; propose the token.
- N7 surfaces: panel draws only in Claude Code terminal; Desktop and Cowork get plain MCP reads for this beta. Propose a fallback segment. State the tri-polar skip as deliberate.
- N9 states: map the 7 drawn states to the book's 11 only where a real event exists; list the unmapped ones.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/phases/380-*/380-BOOK-RULINGS.md` - the book rulings G1 to G12 and the adoption audit
- `.planning/phases/380-*/380-HANDOFF.md` - the owner's handoff for the mod
- `/home/jsagi/mos-brand` (e947a5d): segments/experience/terminal, identity/theo/states, writing/voice, experience/accessibility, foundations/tokens, references/workflow-adoptions.md
- `~/.claude/dev-mods/*/mos-face` (live) and `~/dev/mos-face-mod` (identical backup): the mod source
- `ui/mindrian-workspace-mod` and Phase 369.26: the walled-package precedent
- `CLAUDE.md` Part 8 (graph boundary), D-17 (TypeScript rules), hook budgets
- memory: feedback_panel_may_send_own_words_to_theo.md
</canonical_refs>

<specifics>
## Open risks to plan around
- probe.ts needs python3 (absent on default Windows) and polls two URLs every 120 s: a prompt-starvation and Windows risk (see SEED-142: python missing on Windows).
- The type-check is broken (tsconfig base missing).
- Real-terminal screenshots are required by the book and not yet captured.
- Release gate and RULE 10 wiring for the mod are unverified.
</specifics>

<deferred>
## Deferred Ideas
- Desktop and Cowork panel parity (own phase).
- Book fixes (stale v5 label, secondary-text token, opt-out segment): propose in the book repo, not here.
</deferred>

---
*Phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7*
*Context gathered: 2026-10-23 via discuss-phase with the mos-brand book*
