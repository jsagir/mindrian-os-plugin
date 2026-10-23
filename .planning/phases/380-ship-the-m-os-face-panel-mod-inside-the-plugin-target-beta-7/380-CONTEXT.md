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
- **D-07 Reply chip (navigator ruling, 2026-10-23: "Quote the reply as is"):** no panel-authored string names Larry (D-04 holds for everything the panel writes). The colored chip in a reply quotes the reply's own lead as it stands, so the word Larry appears there only when the reply put it there. The chip adds, removes and rewrites nothing in the quoted text. This closes the open question about the chip; it is no longer an item for the navigator.
- **D-08 Status parity (navigator, 2026-10-23, after the real captures real4/wide.png and real3/std.png):** the panel (the dock) shows "Context: waiting", "WRITES TO nothing - this session is not bound", NOW, NEXT and ASK. It does not keep what the plugin status line shows. The panel must carry ALL of that content: room name, context percent with a bar, whether Theo is on, the "Next:" move, the health state, the plugin version, and every conditional segment the status line can print (voice mark and who speaks, stance, mode, recorded job, post-update restart), plus the room and filing facts: room name, venture stage, entries filed and sections, where a filing would go (WRITES TO), and what is stale. Reuse the status line's own local sources (scripts/context-monitor and lib/statusline). Add no new network read and no new prompt-time read; budget tests B1 to B8 must still pass. Map every status-line field to a panel field, with a test that fails if one is missing. Where the proposed terminal segment says context, stage and version stay on the plugin line, this ruling governs this panel and the segment gets a book follow-up.
- **D-09 JTBD line (navigator, 2026-10-23):** the panel shows one "Job" line: a jobs-to-be-done statement (when I am in this situation, I want to do this, so that I get this) predicted from LOCAL data only: the person's recent prompts in this session and the room state (stage, open section). It is a guess and is labelled as a guess (canon: do not present generated content as validated). It sends nothing anywhere: no Theo call, no Brain call (Canon Part 8). Plain English, Theo's voice (D-04). The person can correct or dismiss it with one action. The form comes from the JTBD method the plugin already has (commands/jtbd.md, skills/jtbd, lib/hmi/jtbd-taxonomy.json and its classifier); no new method (Canon Part 7).
- **D-10 Canon faces (navigator, 2026-10-23):** the mod draws its faces from the canon asset, not from the older robot-faces v2.6.0 poses. Source of truth: /home/jsagi/mos-brand at e947a5d, segments/identity/theo/entries/2026-10-19/asset-fa8504998f.json (geometry, 400 unit master) and its renderer asset-d96217b320.js. All 11 states with the canon names (Rest, Listening, Searching, Found, Challenge, Contradiction, Reframe, Nothing found, Your decision, Boundary, Handover). Rasterize the canon geometry into the terminal block faces; do not hand-copy numbers: copy the asset byte for byte into ui/mos-face with a test that its hash equals the canon file, and a test that every drawn state has a canon source. Map the mod's events to states only where a real event exists; the others stay unmapped and listed. The raster pins of plan 02 are replaced by pins taken from the new source, with the change recorded (a deliberate visual change, not a refactor). The label "Limit" becomes "Nothing found".
- **D-11 Dim text (navigator, 2026-10-23):** secondary text on the ink ground stays dimmed paper as the mod does now. No invented hex. A proposed segment text for the book repo goes into the follow-up file of the phase folder; nothing is written into ~/mos-brand.

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
